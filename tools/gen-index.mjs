#!/usr/bin/env node
// gen-index.mjs — regenerate orchestration/INDEX.md, the one page an agent reads to orient.
//
// Why. There are 400+ tools, 145 reference items and 30 pieces. With a dozen agents running,
// every hour of "where does X live / is there already a tool for this / who owns this file" is
// paid a dozen times over. Worse, an agent that cannot find a tool writes a second one: the
// project already has duplicate instruments that were each written by someone who could not see
// the other. The index is generated, so it cannot drift from the tree the way a hand-written map
// would — and a hand-written map is what everyone would stop trusting after the first week.
//
// It is DERIVED, never authored. Everything here comes from the tree: the first comment line of
// each tool, the front-matter of each reference item, the piece list, the gates, the harness
// surface, and who currently owns which files.
//
// Run: node tools/gen-index.mjs   (wired into .githooks/pre-commit)
import { readFileSync, writeFileSync, readdirSync, existsSync, statSync, mkdirSync } from 'node:fs';
import { join, relative, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const P = (...p) => join(ROOT, ...p);
const rel = p => relative(ROOT, p).split('\\').join('/');

function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) { if (!/node_modules|__pycache__|\.git/.test(e.name)) walk(p, out); }
    else out.push(p);
  }
  return out;
}

/** A tool's purpose is the first real sentence of its header comment — the thing its author wrote
 *  to explain it. If there isn't one, say so: an unexplained tool is a finding, not a blank. */
function purposeOf(file) {
  let head;
  try { head = readFileSync(file, 'utf8').slice(0, 2600).split('\n'); } catch { return null; }
  const lines = [];
  for (const l of head) {
    const t = l.trim();
    if (t.startsWith('#!')) continue;
    if (/^(\/\/|#)/.test(t)) { lines.push(t.replace(/^(\/\/|#)\s?/, '')); continue; }
    if (!t && !lines.length) continue;
    break;                                   // first non-comment line ends the header
  }
  const text = lines.join(' ').replace(/\s+/g, ' ').trim();
  if (!text) return null;
  // The first sentence, minus the tool's own filename if the author led with it.
  const first = (text.split(/(?<=[.!?])\s/)[0] || text).replace(/^[\w.-]+\.(mjs|py|cjs|js)\s*[—:-]\s*/, '');
  return first.slice(0, 160);
}

// ---- tools ---------------------------------------------------------------------------------
const toolFiles = walk(P('tools')).filter(f => /\.(mjs|cjs|js|py)$/.test(f) && !/\/lib\/.*\.json$/.test(f));
const byArea = new Map();
for (const f of toolFiles) {
  const r = rel(f);
  const area = r.split('/').length > 2 ? r.split('/')[1] : '(top level)';
  if (!byArea.has(area)) byArea.set(area, []);
  byArea.get(area).push({ path: r, purpose: purposeOf(f) });
}
for (const list of byArea.values()) list.sort((a, b) => a.path.localeCompare(b.path));
const undocumented = [...byArea.values()].flat().filter(t => !t.purpose);

// ---- reference items -----------------------------------------------------------------------
const itemFiles = walk(P('corpus')).filter(f => /\/RI-[A-Z0-9-]+.*\.md$/.test(rel(f)));
const items = itemFiles.map(f => {
  const src = readFileSync(f, 'utf8');
  const id = (rel(f).match(/(RI-[A-Z]+\d+)/) || [])[1] || rel(f);
  const title = (src.match(/^#\s+(.+)$/m) || [, ''])[1].replace(/^RI-[A-Z0-9]+\s*[—:-]\s*/, '');
  const judges = (src.match(/^judges:\s*(.+)$/m) || [, ''])[1].trim();
  return { id, title: title.slice(0, 90), judges: judges.slice(0, 160), path: rel(f) };
}).sort((a, b) => a.id.localeCompare(b.id));

// ---- gates ---------------------------------------------------------------------------------
const gates = [
  ['node tools/boot-check.mjs', 'does the engine construct AND draw a frame'],
  ['node tools/check-data.mjs', 'every file in game/data/index.json exists; NPC settlements resolve; **the two soul ledgers agree**'],
  ['node tools/check-souls-world.mjs', "the world's cached soul roll-up (`population-posts.json`) equals what the statblocks pay, row by row. `--totals` prints the current figure in one line"],
  ['node tools/check-quests.mjs', 'hooks and entry topics name quests and journal entries that exist'],
  ['node tools/check-content.mjs', 'no quest resolution has disappeared'],
  ['node tools/check-prose.mjs', 'questions, exclamations, punchline rate, tic list'],
  ['node tools/corpus-index.mjs', 'corpus coherence; C8 reports tools named by items but absent'],
  ['node tools/publish.mjs', 'rebuilds the site and fails on an unplotted verdict or a broken image'],
].filter(([cmd]) => existsSync(P(cmd.split(' ')[1])));

// ---- who owns what, right now --------------------------------------------------------------
// THE LIVENESS TEST IS OWNED BY `tools/ownership.mjs` AND MIRRORED HERE. It is mirrored rather
// than imported because ownership.mjs runs its CLI at import time and pays one `git log`
// subprocess per live piece, which this generator runs inside the pre-commit hook and must not.
// The two must agree: `node tools/gen-index.mjs --check-ownership` shells out to ownership.mjs
// and fails if the counts diverge. Run it if you change either.
//
// What this replaces, and why it mattered: the old test was `!/complete|blocked/i.test(j.state)`
// against the raw `state` string only. It reported **208 pieces in flight** on 2026-08-14 when a
// sweep established 56 and ownership.mjs reported 54. Two independent bugs, both found by the
// ownership fix: 78 of 452 status files record their endpoint in `status`, not `state`, so they
// counted live no matter what they said; and `builder_delivery_complete` never matched
// `/complete/` at a word boundary, so compound machine-generated states counted live too. A
// number an index states about the tree is a claim, and this one was wrong by ~4x (DOC-POLICY 4).
const TERMINAL_WORD_RE =
  /\b(complete|completed|done|closed|landed|committed|published|banked|fixed|satisfied|delivered|filed|blocked)\b/i;
// A builder handed to a critic has stopped editing its own claimed files.
const AWAITING_CRITIC_RE = /\bawaiting\b[\s\S]{0,20}\bcritic(?!al)/i;
const normaliseForMatch = s => String(s || '').replace(/[_-]+/g, ' ');
function isTerminal(j) {
  if (j && j.ownership_claim_released) return true;   // a fact about the claim, not a guess from state text
  const c = normaliseForMatch(`${(j && j.state) || ''} ${(j && j.status) || ''}`);
  return TERMINAL_WORD_RE.test(c) || AWAITING_CRITIC_RE.test(c);
}

const statusDir = P('orchestration', 'status');
const live = [];
if (existsSync(statusDir)) {
  for (const f of readdirSync(statusDir).filter(f => f.endsWith('.json'))) {
    try {
      const j = JSON.parse(readFileSync(join(statusDir, f), 'utf8'));
      const claimed = [...new Set([...(j.files_touched || j.files || []), ...(j.files_claimed || [])])];
      live.push({
        task: j.task_id || f.replace(/\.json$/, ''),
        state: String(j.state || j.status || '?').replace(/[|\n]/g, ' ').slice(0, 44),
        files: claimed.slice(0, 4),
        more: Math.max(0, claimed.length - 4),
        terminal: isTerminal(j),
        at: statSync(join(statusDir, f)).mtime,
      });
    } catch { }
  }
}
live.sort((a, b) => b.at - a.at);
const active = live.filter(l => !l.terminal);

// `--check-ownership`: the tripwire for the mirrored logic above. Not run in the hook.
if (process.argv.includes('--check-ownership')) {
  const { execSync } = await import('node:child_process');
  const out = execSync('node tools/ownership.mjs', { cwd: ROOT, encoding: 'utf8' });
  const n = Number((out.match(/ownership:\s+(\d+)\s+live/) || [])[1]);
  const ok = n === active.length;
  console.log(`gen-index --check-ownership: gen-index says ${active.length}, ownership.mjs says ${n} — ${ok ? 'agree' : 'DIVERGED'}`);
  process.exit(ok ? 0 : 1);
}

// ---- harness surface -----------------------------------------------------------------------
let verbs = [];
const apiPath = P('game', 'src', 'harness', 'api.js');
if (existsSync(apiPath)) {
  const src = readFileSync(apiPath, 'utf8');
  verbs = [...new Set([...src.matchAll(/^\s{2,4}([a-zA-Z_$][\w$]*)\s*(?:\(|:\s*(?:async\s*)?\()/gm)].map(m => m[1]))]
    .filter(v => !/^(if|for|while|switch|catch|return|function|constructor)$/.test(v)).sort();
}

// ---- render --------------------------------------------------------------------------------
const stamp = await execish('git rev-parse --short HEAD').catch(() => 'unknown');
async function execish(cmd) {
  const { execSync } = await import('node:child_process');
  return execSync(cmd, { cwd: ROOT, encoding: 'utf8' }).trim();
}

// ---- satellites: the full listings, generated OFF the read path -----------------------------
// DOC-POLICY rule 6: "An index points; it does not contain." Everything below used to be inline
// in INDEX.md, which every agent reads before doing anything — 24k tokens of tool listing, 7k of
// item table, 2k of harness verbs, 16k of in-flight rows, paid by every agent on every cold start
// whether or not it needed any of it. The listings are still generated in full, byte for byte, and
// nothing has been dropped; they now live beside the index and are opened only when needed. Grep
// is the interface, and the index says so.
const IDX = P('orchestration', 'index');
if (!existsSync(IDX)) mkdirSync(IDX, { recursive: true });

const banner = n => `<!-- GENERATED by tools/gen-index.mjs. Do not edit; your changes will be overwritten. -->
<!-- Full listing, deliberately OFF the cold-start read path. Pointed at by orchestration/INDEX.md. -->
# ${n}

`;

writeFileSync(join(IDX, 'TOOLS.md'), banner(`Every tool — ${toolFiles.length}, one line each`) +
  `Grep this; do not read it. \`grep -i <word> orchestration/index/TOOLS.md\`. A tool that does what
you need already exists more often than not — this project already has duplicate instruments that
were each written by someone who could not find the other.

${[...byArea.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([area, list]) => `
## \`tools/${area === '(top level)' ? '' : area + '/'}\` — ${list.length}

${list.map(t => `- \`${t.path}\`${t.purpose ? ` — ${t.purpose}` : ' — **no header comment**'}`).join('\n')}`).join('\n')}

${undocumented.length ? `\n> **${undocumented.length} of ${toolFiles.length} tools have no header comment**, so nobody can tell what\n> they do without reading them. That is a rediscovery tax paid by every agent that meets one.\n` : ''}`);

writeFileSync(join(IDX, 'ITEMS.md'), banner(`Every reference item — ${items.length}`) +
  `Grep this; do not read it. \`grep -i <word> orchestration/index/ITEMS.md\`.

The \`judges:\` front-matter is authoritative for which paths an item scores. **Never assemble an
item set by listing a directory** — a piece was once scored against a set built that way and seven
of its twelve items judged none of its declared paths.

| item | judges | file |
|---|---|---|
${items.map(i => `| **${i.id}** ${i.title} | ${i.judges || '—'} | \`${i.path}\` |`).join('\n')}`);

writeFileSync(join(IDX, 'HARNESS.md'), banner(`\`window.__HARNESS\` — ${verbs.length} verbs`) +
  `Grep this; do not read it. \`grep -i <word> orchestration/index/HARNESS.md\`.

\`window.__ENGINE\` is also published by \`main.js\`, which is a **back door**: capability
prohibitions installed on the harness do not cover it.

${verbs.length ? '`' + verbs.join('`, `') + '`' : '_(api.js not found)_'}`);

// Item families, so the index can say what exists without listing 157 rows.
const families = new Map();
for (const i of items) {
  const fam = (i.id.match(/^RI-([A-Z]+)/) || [, '?'])[1];
  families.set(fam, (families.get(fam) || 0) + 1);
}

// ---- render the index itself ----------------------------------------------------------------
const topLevel = (byArea.get('(top level)') || []);

let out = `<!-- GENERATED by tools/gen-index.mjs. Do not edit; your changes will be overwritten. -->
# The index

**An index points; it does not contain.** Regenerated from the tree on every commit, so it cannot
drift. At \`${stamp}\`: **${toolFiles.length} tools**, **${items.length} reference items**,
**${active.length} pieces in flight**.

Its purpose is to stop every concurrent agent paying separately to discover the same things — which
only works if it is cheap to read. **The full listings are generated beside this file and are
deliberately off the read path. Grep them; do not read them.**

| what you want to know | the one line that answers it |
|---|---|
| does a tool for this already exist? | \`grep -i <word> orchestration/index/TOOLS.md\` — all ${toolFiles.length}, one line each |
| which reference item governs this? | \`grep -i <word> orchestration/index/ITEMS.md\` — all ${items.length}, with their \`judges:\` paths |
| is there a harness verb for it? | \`grep -i <word> orchestration/index/HARNESS.md\` — ${verbs.length} verbs |
| who is in this file right now? | \`node tools/ownership.mjs --for <path>\` |
| am I about to collide with someone? | \`node tools/ownership.mjs --conflicts\` |
| what can I safely start? | \`node tools/dispatchable.mjs\` |
| may I open a browser? | \`node tools/contention.mjs --gate\` (exit 3 = do something else first) |
| how do I put work on the branch? | \`node tools/land.mjs "<headline>" --paths <yours>\` |

**If what you need is not here, that is a finding: say so in your report.**

## The gates, and what each one actually asserts

Run these; do not invent your own equivalents.

| command | asserts |
|---|---|
${gates.map(([c, w]) => `| \`${c}\` | ${w} |`).join('\n')}

\`tools/boot-check.mjs\` is a forwarding shim; the real file is \`tools/harness/boot-check.mjs\`.
Both work. Note that \`node … 2>&1 | tail -1 ; echo exit=$?\` reports the **pipe's** exit code, so
a check that never ran can read as one that passed.

## The ${topLevel.length} tools you will actually reach for

Everything else is by area below, and in full in \`orchestration/index/TOOLS.md\`.

${topLevel.map(t => `- \`${t.path}\`${t.purpose ? ` — ${t.purpose}` : ' — **no header comment**'}`).join('\n')}

## Tools by area — counts only

\`grep -i <word> orchestration/index/TOOLS.md\` for the one you want.

${(() => {
    const areas = [...byArea.entries()].filter(([a]) => a !== '(top level)').sort((a, b) => b[1].length - a[1].length);
    const cells = areas.map(([a, l]) => `\`${a}\` ${l.length}`);
    return cells.join(' · ');
  })()}

${undocumented.length ? `> **${undocumented.length} of ${toolFiles.length} tools have no header comment**, so nobody can tell what they\n> do without reading them. That is a rediscovery tax paid by every agent that meets one.\n` : ''}
## Reference items — ${items.length}, by family

\`grep -i <word> orchestration/index/ITEMS.md\` for the item, its \`judges:\` paths and its file.
**Never assemble an item set by listing a directory** — a piece was once scored against a set built
that way and seven of its twelve items judged none of its declared paths.

${[...families.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([f, n]) => `\`RI-${f}\` ${n}`).join(' · ')}

## Read these before you re-derive them

Each one is a sweep somebody has already run. Re-running it is the single most common way an hour
disappears here.

| if you are about to… | read instead |
|---|---|
| conclude a file of yours is missing, or re-sweep the branch for lost work | \`reports/RECOVERY-20260814.md\` — all 1,401 commits swept, 8 commits guilty, **all 74 missing files are back** |
| re-triage why the \`corpus gate\` workflow is red | \`reports/ci-triage/TRIAGE-20260814.md\` — 1222 runs, and the rulings |
| re-derive the fresh-checkout verdict failures | \`reports/ci-triage/EVIDENCE-RECOVERY-20260814.md\` — took FAIL from **54 to 9** |
| argue about which verdict schema applies | \`reports/ci-triage/DOCTYPE-20260814.md\` — the **9 to 8** split |

**\`corpus/90-verdicts/\` holds two document types and they are not interchangeable.** A build critic
files a \`critic-verdict\` (\`corpus/00-doctrine/verdict.schema.json\`); a blind judge files a
\`blind-judgement\` (\`corpus/00-doctrine/blind-judgement.schema.json\`). **Write \`"document_type"\`
in your file** — omit it and the validator falls back to the stricter critic-verdict contract, which
is deliberate: forgetting the field can never buy leniency. \`"schema": "elder-souls/verdict@1"\` is
RETIRED and refused. A judge that deliberately did **not** read an item says so with
\`reference_items[].not_read: { reason, why }\`; a critic that could not measure one says
\`measured: "unmeasurable"\` with \`score_0_10: 0\`, and may never use \`not_read\`.

**A verdict citation must resolve in a fresh clone.** Run \`node tools/verdict-evidence.mjs
--recover\` before you file a verdict citing anything under \`reports/\`. Evidence over 1 MiB is
pinned, not committed.

## Numbers you must not read off a status file

A status file records what was true at the commit it was written at. Twice in one day an
orchestrator handed an agent a soul total it had read off one (**16,335**, then **21,664**) and both
were stale — the second by a third. **Ask the tree, it costs one command:**

| question | the one line that answers it |
|---|---|
| what is the placed world worth in souls, and what level does the crossing buy? | \`node tools/check-souls-world.mjs --totals\` |
| have the two soul ledgers drifted apart again? | same command — it exits non-zero and names the stale one |
| what is one enemy worth? | \`node -p "require('./game/data/combat/enemies/inf_trash.json').souls"\` — the statblock is the ledger a kill actually reads (\`game/src/sim/souls.js\` \`awardFor()\`) |

\`game/data/world/population-posts.json\` is a **generated cache**, not a source. Never hand-edit it;
re-run \`node tools/world/build-population.mjs --write\`.

## In flight right now — ${active.length} live pieces

**Read the status file of anything near your files before you write**, and record your own as you
go (\`files_touched\`, \`files_claimed\`). Three container restarts in one day killed every agent
each time; a status file written as you work is the difference between resuming and starting over.

\`node tools/ownership.mjs --for <path>\` answers "who is in this file" precisely, with each
claimant's age and a stale hint past two days. This table is the overview, not the instrument.

${active.length ? `| piece | state | files claimed |
|---|---|---|
${active.map(l => `| \`${l.task}\` | ${l.state} | ${l.files.map(f => `\`${f}\``).join(' ') || '— **declares nothing**'}${l.more ? ` +${l.more}` : ''} |`).join('\n')}` : '_nothing in flight_'}
`;

writeFileSync(P('orchestration', 'INDEX.md'), out);
const kb = n => `${(n / 1024).toFixed(0)}k`;
console.log(`gen-index: ${toolFiles.length} tools (${undocumented.length} undocumented), ${items.length} items, ${active.length} in flight`);
console.log(`gen-index: orchestration/INDEX.md ${kb(out.length)}  (~${Math.round(out.length / 4 / 100) / 10}k tokens, on the read path)`);
console.log(`gen-index: orchestration/index/{TOOLS,ITEMS,HARNESS}.md written  (full listings, off the read path)`);
