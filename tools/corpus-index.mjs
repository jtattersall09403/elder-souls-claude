#!/usr/bin/env node
/**
 * corpus-index.mjs — regenerate corpus/00-doctrine/INDEX.md
 *
 * Traceability index required by CORPUS-CONTRACT.md §4:
 *   game subsystem path -> reference items that judge it -> critic -> method
 *
 * Inputs
 *   corpus/00-doctrine/subsystems.json   canonical subsystem taxonomy (source of truth)
 *   corpus/**\/RI-*.md                   reference items, read via YAML front-matter
 *
 * Output
 *   corpus/00-doctrine/INDEX.md          generated; never hand-edit
 *
 * Usage
 *   node tools/corpus-index.mjs            regenerate
 *   node tools/corpus-index.mjs --check    THE CI GATE. exit 1 if INDEX.md is stale OR any
 *                                          error-level problem exists (bad front-matter,
 *                                          orphan `judges:` path, item judging nothing,
 *                                          broken shared-constant registry, missing
 *                                          native→ladder anchor row). Does not write.
 *   node tools/corpus-index.mjs --strict   as --check, and additionally fails on corpus holes
 *
 * --check became blocking in wave 0 (corpus-audit) to close BAR-CRITIQUE-01 G7. It used to
 * report errors on stdout and exit 0, which is why 147 orphan paths accumulated unnoticed.
 * The property it enforces is specified as a reference item: corpus/80-methods/RI-MTH05.
 *
 * Run it after ANY reference item is added, edited, or has its `judges:` changed,
 * and once at the start of every wave.
 */

import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative, dirname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const CORPUS = join(ROOT, 'corpus');
const TAXONOMY_FILE = join(CORPUS, '00-doctrine', 'subsystems.json');
const OUT_FILE = join(CORPUS, '00-doctrine', 'INDEX.md');

const args = new Set(process.argv.slice(2));
const CHECK_ONLY = args.has('--check');
const STRICT = args.has('--strict');

const VALID_KIND = ['number', 'structure', 'trace', 'image', 'text', 'graph'];
// `split` added wave 0 (corpus-audit): it is already a first-class value in subsystems.json's
// arb_legend and ARBITRATION §2 carries five SPLIT seam rulings. See CORPUS-CONTRACT §2.
const VALID_SIDE = ['souls', 'morrowind', 'modern-fidelity', 'neutral', 'split'];
const VALID_PROV = ['measured', 'derived', 'canonical-recall', 'constructed', 'community-data'];
const VALID_CONF = ['high', 'medium', 'low'];
const VALID_BLIND = ['yes', 'no'];
const REQUIRED_FM = ['id', 'title', 'kind', 'side', 'judges', 'provenance', 'confidence', 'blind_pair'];
const REQUIRED_SECTIONS = [
  'The bar', 'The reference artifact', 'Comparison method',
  'Scoring', 'How we lose', 'Provenance note',
];

// ---------------------------------------------------------------- fs helpers

function walk(dir, out = []) {
  let entries;
  try { entries = readdirSync(dir); } catch { return out; }
  for (const name of entries) {
    if (name === 'node_modules' || name.startsWith('.')) continue;
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

const rel = (p) => relative(ROOT, p).split(sep).join('/');

// ------------------------------------------------- minimal YAML front-matter
// Supports `key: value`, `key: [a, b]`, and block sequences (`key:` then `  - a`).
// That is the entire surface CORPUS-CONTRACT §2 specifies; anything richer is a
// contract violation and is reported rather than silently parsed.

function parseFrontMatter(text) {
  if (!text.startsWith('---')) return { data: null, error: 'no front-matter block' };
  const end = text.indexOf('\n---', 3);
  if (end === -1) return { data: null, error: 'unterminated front-matter block' };
  const block = text.slice(text.indexOf('\n') + 1, end);
  const data = {};
  let currentKey = null;
  for (const raw of block.split('\n')) {
    const line = raw.replace(/\s+#.*$/, '').trimEnd();
    if (!line.trim()) continue;
    const seq = line.match(/^\s+-\s*(.+)$/);
    if (seq && currentKey) {
      if (!Array.isArray(data[currentKey])) data[currentKey] = [];
      data[currentKey].push(unquote(seq[1].trim()));
      continue;
    }
    const kv = line.match(/^([A-Za-z_][\w-]*):\s*(.*)$/);
    if (!kv) continue;
    const [, key, rawVal] = kv;
    currentKey = key;
    const val = rawVal.trim();
    if (val === '') { data[key] = []; continue; }
    if (val.startsWith('[')) {
      data[key] = val.replace(/^\[|\]$/g, '')
        .split(',').map((s) => unquote(s.trim())).filter(Boolean);
    } else {
      data[key] = unquote(val);
    }
  }
  return { data, error: null };
}

const unquote = (s) => s.replace(/^["']|["']$/g, '');

// ------------------------------------------------------- C6: the ladder anchor row
// Added wave-1-prep to close BAR-CRITIQUE-02 C1 / N1. `SCORING.md` §1.2 makes a per-item
// native→ladder mapping MANDATORY and fail-closed ("an item with no ladder row is
// `unmeasurable` and scores 0"). The rule was live for an entire wave and 109 of 137 items
// never carried it, because nothing could see it. This is the thing that sees it.
//
// Three forms are recognised; §1.2 lists the same three:
//   A  the mandated row      | Ladder | 4 | 6 | 8 |  /  | Native | … | … | … |
//   B  a transposed table with a `Ladder`-titled column whose values cover 4, 6 and 8
//      (the `12-weapons` form, and the `Native | Band | Ladder ceiling` form)
//   C  a prose anchor line binding native values to ladder 4, 6 and 8
// A verdict-band table alone is NOT an anchor block: it fixes a ceiling, not an anchor.

function scoringSection(text) {
  const start = text.search(/^##\s+Scoring\s*$/m);
  if (start === -1) return null;
  const rest = text.slice(start);
  const next = rest.slice(3).search(/^##\s+/m);
  return next === -1 ? rest : rest.slice(0, next + 3);
}

const tableCells = (line) => line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((s) => s.trim());
const bare = (s) => s.replace(/[`*_]/g, '').trim();

function ladderAnchorForm(section) {
  if (!section) return null;
  const lines = section.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (!/^\s*\|/.test(lines[i])) continue;
    const head = tableCells(lines[i]).map(bare);
    let j = i + 1;
    if (!(j < lines.length && /^\s*\|[\s:|-]+\|\s*$/.test(lines[j]))) continue;
    const rows = []; j++;
    while (j < lines.length && /^\s*\|/.test(lines[j])) { rows.push(tableCells(lines[j]).map(bare)); j++; }
    // Form A — the mandated row. The header must be `Ladder` and its rungs must COVER 4, 6 and 8;
    // extra rungs are allowed and are encouraged on min-over-axes items.
    //
    // AMENDED wave 1 (BAR-CRITIQUE-W1-07-R1 §R5, SCORING.md §1.2b): the check previously required
    // the rungs to be EXACTLY `4,6,8` in the first three cells, which silently rejected the wider
    // `| Ladder | 0 | 2 | 4 | 6 | 8 |` row. That row is now the required form for any item whose
    // aggregation can produce a native 0 — five items scored a native 0 in wave 1 and three of
    // them were translated to ladder 4 because their anchor row said nothing below 4.
    if (/^ladder$/i.test(head[0])) {
      const rungs = head.slice(1).map((h) => Number(h)).filter((n) => Number.isFinite(n));
      if ([4, 6, 8].every((v) => rungs.includes(v))) {
        const nat = rows.find((r) => /^native/i.test(r[0]));
        if (nat && nat.slice(1, head.length).every((c) => c && c.length)) return 'A';
      }
    }
    // Form B — a ladder-titled column covering 4, 6 and 8.
    const li = head.findIndex((h) => /ladder/i.test(h));
    if (li !== -1 && rows.length) {
      const vals = new Set();
      for (const r of rows) { const c = r[li]; if (c === undefined) continue; for (const n of c.matchAll(/\d+/g)) vals.add(Number(n[0])); }
      if ([4, 6, 8].every((v) => vals.has(v))) return 'B';
    }
    i = j - 1;
  }
  // Form C — prose anchors.
  const prose = section.replace(/\n/g, ' ');
  const got = new Set();
  for (const m of prose.matchAll(/(?:→|->)\s*(?:ladder\s*)?\*{0,2}(\d{1,2})/gi)) got.add(Number(m[1]));
  for (const m of prose.matchAll(/ladder\s*\*{0,2}(\d{1,2})\*{0,2}/gi)) got.add(Number(m[1]));
  if ([4, 6, 8].every((v) => got.has(v))) return 'C';
  return null;
}

// Pull the "## Comparison method" section and derive the Method column.
function deriveMethod(text, kind) {
  const start = text.search(/^##\s+Comparison method\s*$/m);
  if (start === -1) return { summary: '(no ## Comparison method section)', refs: [] };
  const rest = text.slice(start);
  const nextHeading = rest.slice(3).search(/^##\s+/m);
  const body = nextHeading === -1 ? rest : rest.slice(0, nextHeading + 3);

  const refs = new Set();
  for (const m of body.matchAll(/corpus\/80-methods\/[A-Za-z0-9._/-]+/g)) refs.add(m[0]);
  for (const m of body.matchAll(/tools\/[A-Za-z0-9._/-]+\.mjs/g)) refs.add(m[0]);
  for (const m of body.matchAll(/`([a-z-]+\.mjs)`/g)) refs.add(m[1]);

  const checkIds = [...new Set([...body.matchAll(/\*\*(M\d+)\b/g)].map((m) => m[1]))]
    .sort((a, b) => Number(a.slice(1)) - Number(b.slice(1)));

  const parts = [];
  if (checkIds.length) {
    parts.push(checkIds.length > 2
      ? `in-item ${checkIds[0]}–${checkIds[checkIds.length - 1]} (${checkIds.length} checks)`
      : `in-item ${checkIds.join(', ')}`);
  } else {
    parts.push(`in-item procedure (kind: ${kind || '?'})`);
  }
  if (refs.size) parts.push([...refs].join(', '));
  return { summary: parts.join('; '), refs: [...refs] };
}

// ------------------------------------------------------------------ load

if (!existsSync(TAXONOMY_FILE)) {
  console.error(`FATAL: missing ${rel(TAXONOMY_FILE)}`);
  process.exit(2);
}
const taxonomy = JSON.parse(readFileSync(TAXONOMY_FILE, 'utf8'));
const subsystems = taxonomy.subsystems;
const critics = taxonomy.critics || {};
const aliases = taxonomy.aliases || {};
const knownPaths = new Set(subsystems.map((s) => s.path));

// Alias resolution: legacy path -> canonical path. Aliases are a migration aid, not a
// second vocabulary — every use is reported so the item's front-matter gets corrected.
const aliasUses = new Map(); // legacy -> [ "RI-XX (path)" ]
function resolvePath(p, itemLabel) {
  if (knownPaths.has(p)) return p;
  if (aliases[p] && knownPaths.has(aliases[p])) {
    if (!aliasUses.has(p)) aliasUses.set(p, []);
    aliasUses.get(p).push(itemLabel);
    return aliases[p];
  }
  return null;
}

const riFiles = walk(CORPUS)
  .filter((p) => /(^|\/)RI-[^/]*\.md$/.test(rel(p)))
  .sort();

const items = [];
const problems = [];   // {file, level, message}

for (const file of riFiles) {
  const text = readFileSync(file, 'utf8');
  const { data, error } = parseFrontMatter(text);
  const path = rel(file);
  if (error || !data) {
    problems.push({ file: path, level: 'error', message: `front-matter unreadable: ${error}` });
    continue;
  }
  for (const k of REQUIRED_FM) {
    if (data[k] === undefined || (Array.isArray(data[k]) && data[k].length === 0 && k !== 'judges')) {
      problems.push({ file: path, level: 'error', message: `missing required front-matter key \`${k}\`` });
    }
  }
  if (data.kind && !VALID_KIND.includes(data.kind)) problems.push({ file: path, level: 'error', message: `kind: "${data.kind}" not in ${VALID_KIND.join('|')}` });
  if (data.side && !VALID_SIDE.includes(data.side)) problems.push({ file: path, level: 'error', message: `side: "${data.side}" not in ${VALID_SIDE.join('|')}` });
  if (data.provenance && !VALID_PROV.includes(data.provenance)) problems.push({ file: path, level: 'error', message: `provenance: "${data.provenance}" not in ${VALID_PROV.join('|')}` });
  if (data.confidence && !VALID_CONF.includes(data.confidence)) problems.push({ file: path, level: 'error', message: `confidence: "${data.confidence}" not in ${VALID_CONF.join('|')}` });
  if (data.blind_pair && !VALID_BLIND.includes(String(data.blind_pair))) problems.push({ file: path, level: 'error', message: `blind_pair: "${data.blind_pair}" not yes|no` });
  if (!Array.isArray(data.judges) || data.judges.length === 0) {
    problems.push({ file: path, level: 'error', message: 'judges: must be a non-empty list of subsystem paths' });
  }
  for (const s of REQUIRED_SECTIONS) {
    if (!new RegExp(`^##\\s+${s}\\s*$`, 'm').test(text)) {
      problems.push({ file: path, level: 'warn', message: `missing mandatory section "## ${s}" (CORPUS-CONTRACT §2)` });
    }
  }
  const method = deriveMethod(text, data.kind);
  const anchorForm = ladderAnchorForm(scoringSection(text));
  if (!anchorForm) {
    problems.push({
      file: path,
      level: 'error',
      message: 'no native→ladder anchor row in `## Scoring` — SCORING.md §1.2 makes it mandatory and fail-closed, so this item is `unmeasurable` and scores 0 (RI-MTH05 C6)',
    });
  }
  const rawJudges = Array.isArray(data.judges) ? data.judges : [];
  const label = `${data.id || '(no id)'} (${path})`;
  const judges = [];
  const legacy = [];
  for (const j of rawJudges) {
    const canon = resolvePath(j, label);
    if (canon === null) {
      problems.push({ file: path, level: 'error', message: `judges: "${j}" is not a canonical subsystem path and has no alias (add it to subsystems.json, or fix the item)` });
      continue;
    }
    if (canon !== j) legacy.push(`${j} → ${canon}`);
    if (!judges.includes(canon)) judges.push(canon);
  }
  items.push({
    id: data.id || '(no id)',
    title: data.title || '',
    kind: data.kind || '',
    side: data.side || '',
    provenance: data.provenance || '',
    confidence: data.confidence || '',
    blind: String(data.blind_pair || ''),
    judges,
    rawJudges,
    legacy,
    path,
    area: path.split('/')[1] || '',
    method: method.summary,
    anchorForm,
  });
}

// ------------------------------------------------------------- build tables

const byPath = new Map(subsystems.map((s) => [s.path, []]));
for (const it of items) {
  for (const j of it.judges) if (byPath.has(j)) byPath.get(j).push(it);
}
const unresolved = problems.filter((p) => /is not a canonical subsystem path/.test(p.message));

// A path judged by a doctrine document (e.g. the coherence checklist) is NOT a hole.
const doctrineJudged = subsystems.filter((s) => byPath.get(s.path).length === 0 && s.judged_by_doctrine);
const holes = subsystems.filter((s) => byPath.get(s.path).length === 0 && !s.judged_by_doctrine);
const covered = subsystems.length - holes.length;
const roots = [...new Set(subsystems.map((s) => s.path.split('.')[0]))];

const dupIds = [...items.reduce((m, it) => m.set(it.id, (m.get(it.id) || 0) + 1), new Map())]
  .filter(([, n]) => n > 1).map(([id]) => id);
for (const id of dupIds) problems.push({ file: '(multiple)', level: 'error', message: `duplicate reference item id ${id}` });

// ------------------------------------------- corpus coherence checks (RI-MTH05)
// Added wave 0 (corpus-audit). Each corresponds to a numbered check in
// corpus/80-methods/RI-MTH05-corpus-coherence.md.

// C3 — an item whose `judges:` list resolves to nothing judges nothing, and is invisible to
// the critic hand-off in §2 even though it looks fine in the inventory.
for (const it of items) {
  if (it.judges.length === 0) {
    problems.push({ file: it.path, level: 'error', message: `judges nothing: every path in \`judges:\` failed to resolve, so this item is invisible to the critic hand-off (RI-MTH05 C3)` });
  }
}

// C7 — every subsystem path carries a wave assignment (added wave-1-prep, BAR-CRITIQUE-02 C3).
// "Not built yet" must be a DECLARED state, not a surprise at scoring time. `wave` is the wave
// in which a builder FIRST owns the path; later waves deepen it and never introduce it.
// docs/PLAN.md §4 is the human-readable form of the same assignment.
for (const s of subsystems) {
  if (s.wave === undefined || s.wave === null || !Number.isInteger(s.wave)) {
    problems.push({
      file: 'corpus/00-doctrine/subsystems.json',
      level: 'error',
      message: `subsystem \`${s.path}\` has no integer \`wave\` assignment — assign the wave it is first built in (see docs/PLAN.md §4) so "not built yet" is declared rather than discovered at scoring time (RI-MTH05 C7)`,
    });
  }
}

// C4 — the shared-constant registry must be well formed and single-owner.
const CONSTANTS_FILE = join(CORPUS, '00-doctrine', 'constants.json');
const knownIds = new Set(items.map((i) => i.id));
let constants = null;
if (!existsSync(CONSTANTS_FILE)) {
  problems.push({ file: 'corpus/00-doctrine/constants.json', level: 'error', message: 'missing shared-constant registry (RI-MTH05 C4)' });
} else {
  try {
    constants = JSON.parse(readFileSync(CONSTANTS_FILE, 'utf8'));
  } catch (e) {
    problems.push({ file: 'corpus/00-doctrine/constants.json', level: 'error', message: `unparseable: ${e.message} (RI-MTH05 C4)` });
  }
}
if (constants) {
  const seenConst = new Set();
  for (const c of constants.constants || []) {
    const where = 'corpus/00-doctrine/constants.json';
    if (!c.id) { problems.push({ file: where, level: 'error', message: 'constant with no id (RI-MTH05 C4)' }); continue; }
    if (seenConst.has(c.id)) problems.push({ file: where, level: 'error', message: `constant \`${c.id}\` declared twice — a constant has exactly one owner (RI-MTH05 C4)` });
    seenConst.add(c.id);
    if (!c.owner) {
      problems.push({ file: where, level: 'error', message: `constant \`${c.id}\` has no owner (RI-MTH05 C4)` });
    } else if (!knownIds.has(c.owner)) {
      problems.push({ file: where, level: 'error', message: `constant \`${c.id}\` is owned by \`${c.owner}\`, which is not a reference item id (RI-MTH05 C4)` });
    }
    for (const cons of c.consumers || []) {
      const m = String(cons).match(/^(RI-[A-Z]{2,3}\d{2})/);
      if (m && !knownIds.has(m[1])) {
        problems.push({ file: where, level: 'error', message: `constant \`${c.id}\` names consumer \`${m[1]}\`, which is not a reference item id (RI-MTH05 C4)` });
      }
    }
  }
  for (const d of constants.deliberate_divergences || []) {
    if (d.item && !knownIds.has(d.item)) {
      problems.push({ file: 'corpus/00-doctrine/constants.json', level: 'error', message: `deliberate divergence names \`${d.item}\`, which is not a reference item id (RI-MTH05 C4)` });
    }
  }
}

// C8 — the phantom-command sweep (RI-MTH06 method 1 / §E.1).
// Added wave 1 by BAR-CRITIQUE-W1-07-R1. RI-MTH06 method 1 had existed since wave 0 and had
// never been run; when it was, 67 of the 82 distinct tool paths named in `## Comparison method`
// sections did not exist on disk — only 15 did — including every quality instrument pointed at
// the opening. A sweep run once and never again is how 67 accumulated, so it lives in the gate now.
//
// Level is `warn` in wave 1 and becomes `error` at wave 2 (RI-MTH06 §E.1). It is deliberately
// not blocking today: 67 pre-existing misses would fail the coherence gate for every agent in
// the tree on the pass that first counted them, which is a way to get the check deleted rather
// than paid down. The number being visible is the change.
const phantomTools = new Map(); // toolPath -> Set(item file)
{
  const TOOL_RX = /tools\/[A-Za-z0-9_\-/.]*\.(?:mjs|cjs|js|py)/g;
  for (const it of items) {
    const text = readFileSync(it.path, 'utf8');
    const i = text.indexOf('## Comparison method');
    if (i < 0) continue;
    let body = text.slice(i);
    const end = body.indexOf('\n## Scoring');
    if (end > 0) body = body.slice(0, end);
    for (const m of body.matchAll(TOOL_RX)) {
      const p = m[0];
      if (existsSync(join(ROOT, p))) continue;
      if (!phantomTools.has(p)) phantomTools.set(p, new Set());
      phantomTools.get(p).add(rel(it.path));
    }
  }
  for (const [tool, where] of [...phantomTools].sort()) {
    problems.push({
      file: [...where].sort().join(', '),
      level: 'warn',
      message: `names phantom tool \`${tool}\` in its \`## Comparison method\` — the command does not exist on disk (RI-MTH06 §D/§E, C8). A dimension blocked ONLY by this is \`corpus_debt\`, not a zero against the build.`,
    });
  }
}

// ------------------------------------------------------------------ render

const now = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
const L = [];
const pct = (n, d) => (d === 0 ? '0' : ((100 * n) / d).toFixed(0));

L.push('# INDEX — traceability: subsystem → judging reference items → critic → method');
L.push('');
L.push('> **GENERATED FILE — DO NOT HAND-EDIT.**');
L.push('> Regenerate with `node tools/corpus-index.mjs`.');
L.push('> Source of truth: `corpus/00-doctrine/subsystems.json` (taxonomy) +');
L.push('> the YAML front-matter of every `corpus/**/RI-*.md` (`id`, `title`, `kind`, `side`,');
L.push('> `judges`, `provenance`, `confidence`, `blind_pair`).');
L.push('>');
L.push('> **This file MUST be regenerated at the start of every wave**, and again after any');
L.push('> reference item is added, retired, or has its `judges:` list changed. A stale index');
L.push('> hands critics the wrong bar and lets builders start on unjudged work.');
L.push('> Check staleness in CI with `node tools/corpus-index.mjs --check`.');
L.push('');
L.push(`Generated: ${now}`);
L.push('');
L.push('This index satisfies CORPUS-CONTRACT §4. Its rules:');
L.push('');
L.push('- **Every builder task names its subsystem path**, exactly as spelled here.');
L.push('- **Every critic is handed exactly the reference items whose `judges:` list contains');
L.push('  that path** — the "Judging items" column below is the hand-off list.');
L.push('- **A subsystem with zero judging items is a corpus hole and the builder MUST NOT');
L.push('  START** until the hole is filled (§4 of the contract, and §5 for how to fill it).');
L.push('');
L.push('---');
L.push('');

// Coverage summary
L.push('## 1. Coverage at a glance');
L.push('');
L.push(`- Canonical subsystem paths: **${subsystems.length}**`);
L.push(`- Reference items found: **${items.length}** across ${new Set(items.map((i) => i.area)).size || 0} area(s)`);
L.push(`- Subsystems with at least one judging reference item: **${subsystems.length - holes.length - doctrineJudged.length}**`);
L.push(`- Subsystems judged by a doctrine document instead: **${doctrineJudged.length}** (see §3b)`);
L.push(`- **Corpus holes (no judging item): ${holes.length}** (${pct(holes.length, subsystems.length)}%)`);
L.push(`- Front-matter problems: ${problems.filter((p) => p.level === 'error').length} error(s), ${problems.filter((p) => p.level === 'warn').length} warning(s)`);
L.push('');
L.push('| Root | Paths | Judged by RI | Judged by doctrine | Holes |');
L.push('|---|---:|---:|---:|---:|');
for (const r of roots) {
  const inRoot = subsystems.filter((s) => s.path.split('.')[0] === r);
  const judged = inRoot.filter((s) => byPath.get(s.path).length > 0).length;
  const doc = inRoot.filter((s) => byPath.get(s.path).length === 0 && s.judged_by_doctrine).length;
  L.push(`| \`${r}.*\` | ${inRoot.length} | ${judged} | ${doc} | ${inRoot.length - judged - doc} |`);
}
L.push('');
L.push('---');
L.push('');

// Main mapping table
L.push('## 2. The mapping table');
L.push('');
L.push('`Arb` = which side of the Arbitration Rule owns this path (`souls` inside the fight,');
L.push('`morrowind` outside it, `modern-fidelity` / `art-direction` for the visual');
L.push('bifurcation, `split` for a pre-decided seam, `neutral` where the corpus item defines');
L.push('the bar outright). `Method` is derived from each item\'s `## Comparison method`.');
L.push('');
for (const r of roots) {
  const inRoot = subsystems.filter((s) => s.path.split('.')[0] === r);
  L.push(`### \`${r}.*\``);
  L.push('');
  L.push('| Game subsystem path | What it means | Arb | Judging items | Critic | Method |');
  L.push('|---|---|---|---|---|---|');
  for (const s of inRoot) {
    const its = byPath.get(s.path);
    const judging = its.length
      ? its.map((i) => `[${i.id}](${'../../' + i.path})`).join('<br>')
      : (s.judged_by_doctrine ? '_doctrine_' : '**— HOLE —**');
    const method = its.length ? its.map((i) => i.method).join('<br>')
      : (s.judged_by_doctrine ? s.judged_by_doctrine : '_none_');
    L.push(`| \`${s.path}\` | ${s.title} | ${s.arb} | ${judging} | \`${s.critic}\` | ${method} |`);
  }
  L.push('');
}
L.push('---');
L.push('');

// Holes
L.push('## 3. Corpus holes');
L.push('');
L.push('Subsystem paths with **no** reference item judging them. Per CORPUS-CONTRACT §4, a');
L.push('builder must not start on one of these. Per §5, a critic that needs one writes the');
L.push('item rather than guessing, then regenerates this index.');
L.push('');
if (holes.length === 0) {
  L.push('_None. Every canonical subsystem path has at least one judging reference item._');
} else {
  L.push(`**${holes.length} of ${subsystems.length} paths are holes.**`);
  L.push('');
  L.push('| Subsystem path | What it means | Arb | Expected area | Critic |');
  L.push('|---|---|---|---|---|');
  for (const s of holes) {
    L.push(`| \`${s.path}\` | ${s.title} | ${s.arb} | \`corpus/${s.area}/\` | \`${s.critic}\` |`);
  }
}
L.push('');
L.push('### 3b. Paths judged by doctrine rather than by a reference item');
L.push('');
L.push('These are **not** holes. The named doctrine document carries the bar, the method,');
L.push('and the evidence requirement for the path. Everything not listed here needs an RI.');
L.push('');
if (doctrineJudged.length === 0) L.push('_None._');
else {
  L.push('| Subsystem path | Judged by |');
  L.push('|---|---|');
  for (const s of doctrineJudged) L.push(`| \`${s.path}\` | ${s.judged_by_doctrine} |`);
}
L.push('');
L.push('---');
L.push('');

// Path reconciliation
L.push('## 4. Path reconciliation');
L.push('');
L.push('### 4a. Legacy `judges:` spellings still in use');
L.push('');
L.push('These items name a path that is **not** canonical but has a registered alias in');
L.push('`subsystems.json`. The index resolved them so the mapping is usable today, but the');
L.push('front-matter should be corrected to the canonical spelling when the item is next');
L.push('touched. **New reference items must use canonical paths only** — aliases are a');
L.push('migration aid, not a second vocabulary.');
L.push('');
if (aliasUses.size === 0) {
  L.push('_None. Every item uses canonical paths._');
} else {
  L.push(`**${aliasUses.size} legacy spellings in use.**`);
  L.push('');
  L.push('| Legacy path | Canonical path | Used by |');
  L.push('|---|---|---|');
  for (const [legacyPath, who] of [...aliasUses].sort()) {
    L.push(`| \`${legacyPath}\` | \`${aliases[legacyPath]}\` | ${[...new Set(who)].join(', ')} |`);
  }
}
L.push('');
L.push('### 4b. Unresolved `judges:` targets');
L.push('');
L.push('Paths claimed by an item that are neither canonical nor aliased. An unresolved path');
L.push('means a critic would be judging something no builder was ever told to address. Fix');
L.push('the item, or append the path to `subsystems.json`, then regenerate.');
L.push('');
if (unresolved.length === 0) {
  L.push('_None._');
} else {
  L.push('| File | Problem |');
  L.push('|---|---|');
  for (const p of unresolved) L.push(`| \`${p.file}\` | ${p.message} |`);
}
L.push('');
L.push('---');
L.push('');

// Item inventory
L.push('## 5. Reference item inventory');
L.push('');
if (items.length === 0) {
  L.push('_No reference items found. The corpus is empty; every subsystem is a hole._');
} else {
  L.push('| Id | Title | Area | Kind | Side | Prov | Conf | Blind | Judges | File |');
  L.push('|---|---|---|---|---|---|---|---|---|---|');
  for (const i of items) {
    L.push(`| ${i.id} | ${i.title} | ${i.area} | ${i.kind} | ${i.side} | ${i.provenance} | ${i.confidence} | ${i.blind} | ${i.judges.map((j) => `\`${j}\``).join(' ')} | [${i.path}](${'../../' + i.path}) |`);
  }
}
L.push('');
L.push('---');
L.push('');

// Problems
L.push('## 6. Front-matter and contract problems');
L.push('');
if (problems.length === 0) {
  L.push('_None. Every reference item parses and declares canonical paths._');
} else {
  L.push('| Level | File | Problem |');
  L.push('|---|---|---|');
  for (const p of problems) L.push(`| ${p.level.toUpperCase()} | \`${p.file}\` | ${p.message} |`);
}
L.push('');
L.push('---');
L.push('');
L.push('## 7. How to use this index');
L.push('');
L.push('**Orchestrator, spawning a builder:** look up the piece\'s subsystem paths in §2,');
L.push('paste the union of their judging items into `<<REFERENCE_ITEMS>>` of');
L.push('`BUILDER-PROMPT-TEMPLATE.md`. If any path appears in §3, do not spawn — fill the hole.');
L.push('');
L.push('**Orchestrator, spawning a critic:** paste the *same* list into `<<REFERENCE_ITEMS>>`');
L.push('of `CRITIC-PROMPT-TEMPLATE.md`, plus the Method column so the critic knows which');
L.push('harness to run. Confirm the critic did not build the piece (CRITIC-DOCTRINE §8).');
L.push('');
L.push('**Critic, mid-verdict:** if your assigned items cannot judge something, write a new');
L.push('item under the area named in §3, add its `judges:` paths, run');
L.push('`node tools/corpus-index.mjs`, and list it in your verdict\'s `corpus_extended`.');
L.push('');
L.push('**Anyone adding a subsystem path:** append to `corpus/00-doctrine/subsystems.json`');
L.push('(append-only; never rename in place — a renamed path silently orphans every verdict');
L.push('that referenced it), then regenerate.');
L.push('');

const out = L.join('\n');
const errorCount = problems.filter((p) => p.level === 'error').length;
let gateFailed = false;

if (CHECK_ONLY || STRICT) {
  const existing = existsSync(OUT_FILE) ? readFileSync(OUT_FILE, 'utf8') : '';
  const strip = (s) => s.replace(/^Generated: .*$/m, '');
  if (strip(existing) !== strip(out)) {
    console.error('INDEX.md is STALE. Run: node tools/corpus-index.mjs');
    gateFailed = true;
  } else {
    console.log('INDEX.md is up to date.');
  }
}
if (!CHECK_ONLY && !STRICT) {
  writeFileSync(OUT_FILE, out);
  console.log(`Wrote ${rel(OUT_FILE)}`);
}

console.log(`  subsystem paths : ${subsystems.length}`);
console.log(`  reference items : ${items.length}`);
console.log(`  judged          : ${covered}`);
console.log(`  CORPUS HOLES    : ${holes.length}`);
console.log(`  legacy aliases  : ${aliasUses.size} in use`);
console.log(`  unresolved paths: ${unresolved.length}`);
console.log(`  ladder anchors  : ${items.filter((i) => i.anchorForm).length}/${items.length} items carry a native→ladder row (C6)`);
console.log(`  phantom tools   : ${phantomTools.size} named in Comparison methods but absent from disk (C8, RI-MTH06 §E) — warn in wave 1, error from wave 2`);
{
  const w = {};
  for (const s of subsystems) w[s.wave === undefined ? '?' : s.wave] = (w[s.wave === undefined ? '?' : s.wave] || 0) + 1;
  console.log(`  wave assignment : ${Object.keys(w).sort().map((k) => `w${k}=${w[k]}`).join(' ')} (C7)`);
}
console.log(`  problems        : ${problems.filter((p) => p.level === 'error').length} error, ${problems.filter((p) => p.level === 'warn').length} warn`);

if (holes.length) {
  console.log('\nHoles (builders must not start on these):');
  for (const s of holes) console.log(`  - ${s.path}`);
}
for (const p of problems) console.log(`  [${p.level}] ${p.file}: ${p.message}`);

// ------------------------------------------------------------------ the gate
// Wave 0 (corpus-audit): --check is now BLOCKING on error-level problems, not only on a
// stale index. See RI-MTH05. --strict additionally blocks on corpus holes.
if (CHECK_ONLY || STRICT) {
  if (errorCount) {
    console.error(`\nCORPUS COHERENCE GATE FAILED: ${errorCount} error(s). See RI-MTH05.`);
    gateFailed = true;
  }
  if (STRICT && holes.length) {
    console.error(`\n--strict: ${holes.length} corpus hole(s).`);
    gateFailed = true;
  }
  if (gateFailed) process.exit(1);
  console.log('\nCORPUS COHERENCE GATE PASSED.');
}
