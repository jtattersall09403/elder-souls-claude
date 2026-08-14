#!/usr/bin/env node
// check-citations.mjs — the documents that direct work must not hold false beliefs about
// what this repo contains.
//
// =============================================================================================
// WHY THIS EXISTS
//
// The project owner named this pattern on 2026-08-14 after it appeared three times in one day
// and called it the most expensive pattern in the project. It is not a code defect:
//
//   1. Twenty-nine build plans sat dispatchable against predicates that two rulings had
//      superseded that morning. Nothing in any plan mentioned the rulings existed.
//      (`orchestration/COST.md` W5: "one unpropagated directive, not twenty-nine defects".)
//   2. The exact HUD geometry six UI items needed was vendored on disk the whole time, at
//      `corpus/70-visual/refs/morrowind/REF-A12/mygui/`, and not one of the six cited it.
//      It was cited only by the acquisition report that fetched it — an inventory, which no
//      builder reads.
//   3. Thirty-three Morrowind interface screenshots had been on disk since 2026-08-06 at
//      `corpus/70-visual/refs/morrowind/REF-A12b/`, and the corpus told builders they were
//      not there. That is the worst shape: not an omission but a POSITIVE FALSE ASSERTION,
//      which actively stops people looking.
//
// So: three mechanical checks, one per shape.
//
//   A  ruling-propagation  a governing document cites a superseded ruling and never names
//                          the ruling that replaced it
//   B  uncited-asset       a vendored asset directory that no work-directing document cites
//                          (cited only by the inventory that fetched it does not count)
//   C  false-absence       a governing document asserts something is absent, and it is on disk
//
// =============================================================================================
// WHAT IT CANNOT DO — READ THIS BEFORE YOU TRUST A GREEN RUN
//
// Almost everything a document asserts about the repo is prose a machine cannot decide.
// This tool decides three narrow, mechanical sub-shapes. A green run means "the three shapes
// I can decide are clean", never "the documents are current". Check C in particular only fires
// when the sentence of absence contains a path or a REF-id that the tool can resolve; an
// absence claim written in pure English ("we have no reference for the character's back") is
// invisible to it and always will be.
//
// Coverage is printed on every run, computed from the tree, for exactly that reason.
//
// =============================================================================================
// USAGE
//
//   node tools/check-citations.mjs                 # all three checks, human output
//   node tools/check-citations.mjs --json          # machine output
//   node tools/check-citations.mjs --only A,C      # a subset
//   node tools/check-citations.mjs --self-test     # prove each check can go red
//
// Exit 0 clean, 1 findings, 2 the tool itself could not run.
//
// SUPPRESSING A LINE. Some absence claims are true history, deliberately preserved — a quote of
// what a document used to say, a dated note. Append `<!--citation-ok: why-->` to that line.
// The reason is required and is printed by --json, so a suppression is a claim somebody signed.

import { readFileSync, existsSync, readdirSync, statSync, writeFileSync, mkdirSync, rmSync, cpSync } from 'node:fs';
import { join, dirname, relative, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');

// ---------------------------------------------------------------------------------------------
// Which documents direct work, and which are dated records of what was believed at the time.
//
// A verdict, a report and a status file are HISTORY. They are supposed to say what was true when
// they were written and they must never be rewritten to match today — rewriting them destroys the
// record. So they are out of scope by construction, not by oversight.
// ---------------------------------------------------------------------------------------------
const GOVERNING = [
  /^corpus\/[0-9]{2}-[a-z-]+\/RI-[A-Z]+[0-9]+[^/]*\.md$/,
  /^corpus\/00-doctrine\/[^/]*\.md$/,
  /^corpus\/[0-9]{2}-[a-z-]+\/AMENDMENT-[^/]*\.md$/,
  /^orchestration\/plans\/[^/]*\.md$/,
  /^orchestration\/briefs\/[^/]*\.md$/,
  /^orchestration\/[^/]*\.md$/,
  /^CLAUDE\.md$/,
  /^AGENTS\.md$/,
];
const HISTORY = [
  /^corpus\/90-verdicts\//,
  /^reports\//,
  /^orchestration\/status\//,
  /^docs\/blog\//,
  /^orchestration\/evidence\//,
  /^orchestration\/audits\//,
  // The critiques ARE dated records of an audit; they say what was wrong on their date.
  /^corpus\/00-doctrine\/BAR-CRITIQUE/,
  /^corpus\/[0-9]{2}-[a-z-]+\/BAR-CRITIQUE/,
];

function tracked() {
  return execFileSync('git', ['ls-files'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 28 })
    .trim().split('\n').filter(Boolean);
}
const isGoverning = (p) => !HISTORY.some((r) => r.test(p)) && GOVERNING.some((r) => r.test(p));

function readLines(root, p) {
  try { return readFileSync(join(root, p), 'utf8').split('\n'); } catch { return null; }
}
const SUPPRESS = /<!--\s*citation-ok:\s*([^>]*?)\s*-->/;

// =============================================================================================
// CHECK A — a superseded ruling that never propagated
// =============================================================================================
//
// Reads the supersession graph out of `ARBITRATION.md` §2 itself rather than a hand-kept list,
// so a ruling superseded tomorrow is covered without editing this file. §2's own closing rule is
// "superseded rulings are struck through with the wave number that superseded them", which is
// what makes the graph extractable at all — if that rule stops being honoured, A2 below fires.

const ARB = 'corpus/00-doctrine/ARBITRATION.md';

export function supersessionGraph(root = ROOT) {
  const lines = readLines(root, ARB) || [];
  const rows = new Map();          // Sn -> row text
  for (const l of lines) {
    const m = l.match(/^\|\s*(S\d+)\s*\|/);
    if (m) rows.set(m[1], l);
  }
  // Two edge kinds, and the difference decides the severity downstream.
  //
  //   REPLACED   — the old row is dead and its text still says the old thing. A document citing
  //                the old id alone is reading an overruled predicate. This is S30 → S35, and it
  //                is the shape that sent twenty-nine plans at a superseded bar.
  //   IN-PLACE   — the successor edited the OLD row's own text ("Sx IS AMENDED IN PLACE"). A
  //                document citing the old id gets the corrected text, so it is not wrong; it is
  //                merely thin, because the successor's reasoning lives elsewhere. Warn, never error.
  const graph = [];                // { old, next[], struck, kind }
  const push = (old, next, kind) => {
    const e = graph.find((g) => g.old === old);
    if (e) { if (!e.next.includes(next)) e.next.push(next); if (kind === 'replaced') e.kind = 'replaced'; }
    else graph.push({ old, next: [next], struck: /~~/.test(rows.get(old) || ''), kind });
  };
  for (const [id, row] of rows) {
    for (const m of row.matchAll(/SUPERSEDED BY (S\d+)/gi)) push(id, m[1], 'replaced');
  }
  for (const [id, row] of rows) {
    for (const m of row.matchAll(/(S\d+) IS AMENDED/gi)) {
      if (m[1] !== id) push(m[1], id, 'in-place');
    }
  }
  return { graph, rows };
}

function checkA(root, files) {
  const findings = [];
  const { graph, rows } = supersessionGraph(root);
  if (!rows.size) {
    findings.push({ check: 'A0', severity: 'error', file: ARB,
      message: 'could not parse any S-rulings out of ARBITRATION.md §2 — the tool is blind, not the repo clean' });
    return { findings, graph };
  }

  // A2 — is §2's own append-only rule honoured? A superseded ruling must still be struck through.
  for (const g of graph) {
    if (g.kind === 'replaced' && !g.struck) {
      findings.push({ check: 'A2', severity: 'error', file: ARB, ruling: g.old,
        message: `${g.old} is recorded as superseded by ${g.next.join('/')} but its §2 row is not struck through; ` +
                 '§2\'s closing rule requires it' });
    }
  }

  // A1 — downstream documents still citing the old predicate with no pointer to the new one.
  for (const p of files) {
    if (!isGoverning(p)) continue;
    if (p === ARB) continue;
    const lines = readLines(root, p);
    if (!lines) continue;
    const text = lines.join('\n');
    for (const g of graph) {
      const oldRe = new RegExp(`\\b${g.old}\\b`);
      if (!oldRe.test(text)) continue;
      const named = g.next.filter((n) => new RegExp(`\\b${n}\\b`).test(text));
      if (named.length) continue;
      const n = lines.findIndex((l) => oldRe.test(l) && !SUPPRESS.test(l));
      if (n < 0) continue;                                   // every mention suppressed
      const replaced = g.kind === 'replaced';
      findings.push({ check: replaced ? 'A1' : 'A3', severity: replaced ? 'error' : 'warn',
        file: p, line: n + 1, ruling: g.old, supersededBy: g.next,
        message: replaced
          ? `cites ${g.old}, which ${g.next.join('/')} REPLACED, and never names ${g.next.join(' or ')} — ` +
            `a reader of this document is reading an overruled predicate`
          : `cites ${g.old} without naming ${g.next.join(' or ')}, which amended it in place — ` +
            `the text is current but the successor's reasoning is not reachable from here`,
        excerpt: lines[n].trim().slice(0, 160) });
    }
  }
  return { findings, graph };
}

// =============================================================================================
// CHECK B — an asset directory on disk that no work-directing document cites
// =============================================================================================
//
// The discriminator that matters, and the one the MyGUI case turned on: being named by the
// acquisition report that fetched it is NOT citation. An inventory records what was bought; an
// item tells a builder what to build against. Six UI items guessed at geometry that the
// inventory had been describing for a week.

const ASSET_ROOTS = ['corpus/70-visual/refs', 'corpus/86-ui'];
const ASSET_EXT = /\.(jpg|jpeg|png|webp|gif|mp4|webm|layout|skin|skin\.xml|xml|ttf|otf|dds|nif|wav|ogg)$/i;
// Documents that merely record acquisition. Being cited by one of these is not being cited.
const INVENTORY = /(ACQUISITION|ACQUIRE|MANIFEST|LICENCE-NOTE|TEMPORAL-ACQUISITION|_provenance|_computed|make-manifest|reference-metrics)/i;

function assetDirs(root) {
  const dirs = new Map();                                    // relpath -> asset file count
  const walk = (rel) => {
    const abs = join(root, rel);
    let ents; try { ents = readdirSync(abs, { withFileTypes: true }); } catch { return; }
    let n = 0;
    for (const e of ents) {
      if (e.name.startsWith('.') || e.name === '__pycache__' || e.name === 'node_modules') continue;
      if (e.isDirectory()) walk(join(rel, e.name));
      else if (ASSET_EXT.test(e.name)) n++;
    }
    if (n > 0) dirs.set(rel, n);
  };
  for (const r of ASSET_ROOTS) if (existsSync(join(root, r))) walk(r);
  return dirs;
}

function checkB(root, files) {
  const findings = [];
  const dirs = assetDirs(root);
  const docs = files.filter((p) => /\.(md|json|mjs|js|py)$/.test(p) && !p.startsWith('tools/node_modules/'));
  const cache = new Map();
  const bodyOf = (p) => {
    if (!cache.has(p)) { try { cache.set(p, readFileSync(join(root, p), 'utf8')); } catch { cache.set(p, ''); } }
    return cache.get(p);
  };

  for (const [dir, count] of dirs) {
    const base = basename(dir);
    // A directory is "named" by its full path, or by a basename distinctive enough to be a name.
    const distinctive = /^REF-[A-Z]?\d+/.test(base) || (base.length >= 5 && /[a-z]{4}/.test(base));
    const needles = [dir, ...(distinctive ? [base] : [])];
    const citedBy = [];
    for (const p of docs) {
      if (p.startsWith(dir + '/') || p === dir) continue;     // a file inside itself is not a citation
      const b = bodyOf(p);
      if (needles.some((n) => b.includes(n))) citedBy.push(p);
    }
    const governing = citedBy.filter((p) => isGoverning(p) && !INVENTORY.test(p));
    const inventoryOnly = citedBy.filter((p) => INVENTORY.test(p));
    if (governing.length === 0) {
      findings.push({
        check: citedBy.length === 0 ? 'B1' : 'B2',
        severity: citedBy.length === 0 ? 'error' : 'warn',
        file: dir, assets: count,
        citedByInventory: inventoryOnly.slice(0, 4),
        citedByOther: citedBy.filter((p) => !INVENTORY.test(p)).slice(0, 4),
        message: citedBy.length === 0
          ? `${count} asset file(s) that no document anywhere names — paid for and invisible`
          : `${count} asset file(s) named only by inventory/history, by no reference item, plan or brief — ` +
            'this is the MyGUI shape: on disk, described, and never reaching a builder',
      });
    }
  }
  return { findings, dirCount: dirs.size };
}

// =============================================================================================
// CHECK C — a positive false assertion of absence
// =============================================================================================
//
// The worst shape, because an omission merely fails to help while this actively steers work away
// from something the project already owns. Fires only when the sentence naming the absence also
// names something resolvable: a repo path, or a REF-id that has files behind it.

const ABSENCE = new RegExp([
  'we (?:have|had) no\\b',
  'there (?:is|are) no\\b',
  'no longer (?:exists?|available)',
  '\\bis empty\\b', '\\bare empty\\b',
  'does not exist\\b', 'do not exist\\b',
  '\\bnot (?:on disk|available|vendored|in the repo|present)\\b',
  '\\bnot vendored into this repo\\b',
  '\\bunobtainable\\b',
  '\\bnone exist\\b', '\\bexist nowhere\\b',
  '\\bno reference (?:for|to|exists)\\b',
  'TODO:\\s*acquire',
  '\\bn\\s*=\\s*0\\b',
  '\\bzero (?:plates?|references?|screenshots?|captures?|images?)\\b',
].join('|'), 'i');

// A claim of absence that is explicitly about the past is history, not a false belief.
const PAST = /\bwas empty\b|\bwere (?:empty|absent)\b|\bat authoring time\b|\bhas since\b|\bno longer true\b|\bused to (?:say|read)\b|\bhad been\b/i;

// A sentence that quotes an absence claim in order to REFUTE it is the opposite of the defect —
// it is the repair. `ARBITRATION.md` S55 does exactly this: it quotes the excuse "references were
// unobtainable" and answers "modern plates are on disk at …". Firing on that would train readers
// to ignore the check.
const REFUTED = /\b(?:is|are|was|were) on disk\b|\bis void\b|\bhas been on disk\b|\bexists? (?:on disk|at|now)\b|\bthat (?:sentence|claim) is false\b|\bno longer (?:true|holds)\b/i;

const PATHISH = /\b((?:corpus|orchestration|tools|game|docs|reports|refs)\/[A-Za-z0-9_@./*-]*[A-Za-z0-9_-])/g;
const REFID = /\bREF-([A-Z]{1,2}\d+[a-z]?)\b/g;

function refIndex(root) {
  const idx = new Map();                                     // REF-id -> example path
  const walk = (rel) => {
    let ents; try { ents = readdirSync(join(root, rel), { withFileTypes: true }); } catch { return; }
    for (const e of ents) {
      if (e.name.startsWith('.') || e.name === '__pycache__') continue;
      const m = e.name.match(/^REF-([A-Z]{1,2}\d+[a-z]?)/);
      if (m && !idx.has('REF-' + m[1])) idx.set('REF-' + m[1], join(rel, e.name));
      if (e.isDirectory()) walk(join(rel, e.name));
    }
  };
  walk('corpus/70-visual/refs');
  return idx;
}

function resolvePath(root, p) {
  // Strip trailing punctuation the prose glued on, and resolve a single glob segment.
  let q = p.replace(/[.,;:)"'`]+$/, '');
  if (existsSync(join(root, q))) return q;
  if (q.includes('*')) {
    const d = dirname(q), pat = basename(q);
    const re = new RegExp('^' + pat.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$');
    try { if (readdirSync(join(root, d)).some((n) => re.test(n))) return q; } catch { /* no dir */ }
  }
  return null;
}

function nonEmptyDir(root, rel) {
  try {
    const st = statSync(join(root, rel));
    if (!st.isDirectory()) return st.size > 0;
    return readdirSync(join(root, rel)).filter((n) => !n.startsWith('.') && n !== '__pycache__').length > 0;
  } catch { return false; }
}

// The claim and the thing must be in the SAME clause, or the check is noise.
//
// The first version of this check tested the whole line and produced 51 findings of which nearly
// all were false: `INDEX.md` rows read "`RI-CMB01.md` names phantom tool `m-cmb01.mjs` — the
// command does not exist on disk", where the absent thing is the tool and the present thing is
// the item, in one line. Two assertions sharing a line are not one assertion. So: segment on the
// boundaries prose actually uses — table cells, sentence ends, semicolons, em dashes — and require
// the resolvable name to sit inside the same segment as the words of absence.
function segments(line) {
  return line
    .split('|')                                              // a markdown table cell is its own claim
    .flatMap((s) => s.split(/(?<=[.;])\s+|\s+—\s+|\s+--\s+/)) // sentence / clause boundaries
    .filter((s) => s.trim().length);
}

function checkC(root, files) {
  const findings = [];
  const refs = refIndex(root);
  let scanned = 0, absenceLines = 0;

  for (const p of files) {
    if (!isGoverning(p)) continue;
    const lines = readLines(root, p);
    if (!lines) continue;
    scanned++;
    // Block suppression. A marker line suppresses itself and everything down to the next blank
    // line, because a quoted stale claim is usually a paragraph, not a sentence. Two markers are
    // honoured: this tool's own, and `<!-- dispatch-staleness: quoted -->`, which the project
    // already uses to mean "the text below quotes a claim; do not re-decide it".
    const suppressed = new Set();
    for (let i = 0; i < lines.length; i++) {
      if (!SUPPRESS.test(lines[i]) && !/<!--\s*dispatch-staleness:\s*quoted\s*-->/.test(lines[i])) continue;
      for (let j = i; j < lines.length && lines[j].trim() !== ''; j++) suppressed.add(j);
      suppressed.add(i);
    }
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i];
      if (!ABSENCE.test(l)) continue;
      absenceLines++;
      if (suppressed.has(i)) continue;
      if (/^\s*>/.test(l)) continue;                          // a quotation of somebody else

      const hits = [];
      let claim = null;
      for (const seg of segments(l)) {
        if (!ABSENCE.test(seg)) continue;
        if (PAST.test(seg)) continue;                         // "was empty", "at authoring time"
        if (REFUTED.test(seg)) continue;                      // the sentence is the correction
        for (const m of seg.matchAll(PATHISH)) {
          const r = resolvePath(root, m[1]);
          if (r && nonEmptyDir(root, r)) { hits.push({ kind: 'path', named: m[1], onDisk: r }); claim ??= seg.trim(); }
        }
        for (const m of seg.matchAll(REFID)) {
          const id = m[0];
          if (refs.has(id)) { hits.push({ kind: 'ref', named: id, onDisk: refs.get(id) }); claim ??= seg.trim(); }
        }
      }
      if (!hits.length) continue;
      const uniq = [...new Map(hits.map((h) => [h.named, h])).values()];
      findings.push({ check: 'C1', severity: 'error', file: p, line: i + 1, hits: uniq, claim,
        message: `asserts absence, but ${uniq.map((h) => h.named).join(', ')} is on disk at ${uniq.map((h) => h.onDisk).join(', ')}`,
        excerpt: (claim || l.trim()).slice(0, 220) });
    }
  }
  return { findings, scanned, absenceLines };
}

// =============================================================================================
// Coverage — printed every run, because a percentage nobody sees is a percentage nobody believes
// =============================================================================================
function coverage(root, files, c) {
  const gov = files.filter(isGoverning).length;
  return {
    governing_documents: gov,
    total_tracked_files: files.length,
    absence_sentences_seen: c.absenceLines,
    note: 'Check C can only decide an absence claim that names a resolvable path or REF-id. ' +
          'Claims written in pure English are invisible to this tool and always will be.',
  };
}

// =============================================================================================
// Self-test — every check is required to go red on a reintroduced real instance
// =============================================================================================
function selfTest() {
  const tmp = join(ROOT, 'tmp', 'check-citations-selftest');
  rmSync(tmp, { recursive: true, force: true });
  mkdirSync(tmp, { recursive: true });
  const results = [];

  const stage = (name, mutate) => {
    const dir = join(tmp, name);
    mkdirSync(dir, { recursive: true });
    // A minimal tree: only what each check reads.
    for (const p of [ARB, 'corpus/70-visual/RI-VIS02-fidelity-reference-set-modern.md']) {
      const dst = join(dir, p); mkdirSync(dirname(dst), { recursive: true });
      try { cpSync(join(ROOT, p), dst); } catch { /* optional */ }
    }
    mutate(dir);
    return dir;
  };

  // C — reintroduce instance 3: assert the REF-A12b screenshots are not on disk while they are.
  {
    const dir = stage('C', (d) => {
      const p = join(d, 'corpus/70-visual/RI-VIS09-reference-image-set.md');
      mkdirSync(dirname(p), { recursive: true });
      writeFileSync(p, '# RI-VIS09\n\nThere are no Morrowind interface screenshots in ' +
        '`corpus/70-visual/refs/morrowind/REF-A12b/`; the set does not exist and must be acquired.\n');
      // the assets themselves are read from the real tree, so link the refs dir in
      const rd = join(d, 'corpus/70-visual/refs');
      mkdirSync(dirname(rd), { recursive: true });
      try { execFileSync('ln', ['-s', join(ROOT, 'corpus/70-visual/refs'), rd]); } catch { /* fall back */ }
    });
    const f = checkC(dir, ['corpus/70-visual/RI-VIS09-reference-image-set.md']).findings;
    results.push({ arm: 'C:false-absence-reintroduced', red: f.length > 0, findings: f.length,
      expect: 'red', detail: f[0]?.message });
  }
  // C control — the same sentence with the claim made true (a path that really is absent).
  {
    const dir = stage('Cctl', (d) => {
      const p = join(d, 'corpus/70-visual/RI-VIS09-reference-image-set.md');
      mkdirSync(dirname(p), { recursive: true });
      writeFileSync(p, '# RI-VIS09\n\nThere are no screenshots in `corpus/70-visual/refs/morrowind/REF-A99-nope/`.\n');
    });
    const f = checkC(dir, ['corpus/70-visual/RI-VIS09-reference-image-set.md']).findings;
    results.push({ arm: 'C:control-claim-is-true', red: f.length > 0, findings: f.length, expect: 'green' });
  }
  // A — a plan that cites S30 and never names S35.
  {
    const dir = stage('A', (d) => {
      const p = join(d, 'orchestration/plans/W1-TEST.md');
      mkdirSync(dirname(p), { recursive: true });
      writeFileSync(p, '# W1-TEST\n\nPer S30 there is no map, so this piece ships no map surface.\n');
    });
    const f = checkA(dir, ['orchestration/plans/W1-TEST.md']).findings.filter((x) => x.check === 'A1');
    results.push({ arm: 'A:superseded-ruling-cited-alone', red: f.length > 0, findings: f.length,
      expect: 'red', detail: f[0]?.message });
  }
  // A control — the same plan, with the successor named. Must be green, or A1 is vacuous.
  {
    const dir = stage('Actl', (d) => {
      const p = join(d, 'orchestration/plans/W1-TEST.md');
      mkdirSync(dirname(p), { recursive: true });
      writeFileSync(p, '# W1-TEST\n\nS30 was overruled; S35 governs, and the map exists.\n');
    });
    const f = checkA(dir, ['orchestration/plans/W1-TEST.md']).findings.filter((x) => x.check === 'A1');
    results.push({ arm: 'A:control-successor-named', red: f.length > 0, findings: f.length, expect: 'green' });
  }
  // A2 — un-strike a superseded row and the append-only rule must go red.
  {
    const dir = stage('A2', (d) => {
      const p = join(d, ARB);
      const t = readFileSync(p, 'utf8').split('\n')
        .map((l) => (/^\|\s*S30\s*\|/.test(l) ? l.replace(/~~/g, '') : l)).join('\n');
      writeFileSync(p, t);
    });
    const f = checkA(dir, []).findings.filter((x) => x.check === 'A2');
    results.push({ arm: 'A2:strikethrough-removed', red: f.length > 0, findings: f.length,
      expect: 'red', detail: f[0]?.message });
  }
  // B — an asset directory nobody names.
  {
    const dir = stage('B', (d) => {
      const a = join(d, 'corpus/70-visual/refs/orphan-plates');
      mkdirSync(a, { recursive: true });
      writeFileSync(join(a, 'plate-01.png'), 'x');
      writeFileSync(join(a, 'plate-02.png'), 'x');
    });
    const f = checkB(dir, ['corpus/70-visual/refs/orphan-plates/plate-01.png']).findings;
    results.push({ arm: 'B:orphan-asset-directory', red: f.some((x) => x.check === 'B1'),
      findings: f.length, expect: 'red', detail: f[0]?.message });
  }

  let bad = 0;
  console.log('check-citations --self-test\n');
  for (const r of results) {
    const ok = (r.expect === 'red') === r.red;
    if (!ok) bad++;
    console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${r.arm.padEnd(36)} expect ${r.expect.padEnd(5)} got ${r.red ? 'red' : 'green'} (${r.findings})`);
    if (r.detail) console.log(`        ${r.detail}`);
  }
  const reds = results.filter((r) => r.expect === 'red').length;
  const greens = results.filter((r) => r.expect === 'green').length;
  console.log(`\n  ${reds} arms required to go red, ${greens} required to stay green.`);
  if (!reds || !greens) { console.log('  VACUOUS — a suite with no disagreeing arms proves nothing.'); bad++; }
  rmSync(tmp, { recursive: true, force: true });
  console.log(bad ? `\n${bad} arm(s) behaved wrongly — the instrument is broken.` : '\nAll arms behaved as required.');
  return bad ? 1 : 0;
}

// =============================================================================================
function main() {
  const argv = process.argv.slice(2);
  if (argv.includes('--self-test')) process.exit(selfTest());
  const only = (argv.find((a) => a.startsWith('--only='))?.slice(7)
    || (argv.includes('--only') ? argv[argv.indexOf('--only') + 1] : '') || 'A,B,C')
    .toUpperCase().split(',').map((s) => s.trim()).filter(Boolean);
  const asJson = argv.includes('--json');

  let files;
  try { files = tracked(); }
  catch (e) { console.error('check-citations: cannot list tracked files:', e.message); process.exit(2); }

  const findings = [];
  let a = { findings: [], graph: [] }, b = { findings: [], dirCount: 0 }, c = { findings: [], scanned: 0, absenceLines: 0 };
  if (only.includes('A')) { a = checkA(ROOT, files); findings.push(...a.findings); }
  if (only.includes('B')) { b = checkB(ROOT, files); findings.push(...b.findings); }
  if (only.includes('C')) { c = checkC(ROOT, files); findings.push(...c.findings); }

  const cov = coverage(ROOT, files, c);
  const errors = findings.filter((f) => f.severity === 'error');

  if (asJson) {
    console.log(JSON.stringify({
      generated: new Date().toISOString(),
      commit: (() => { try { return execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim(); } catch { return null; } })(),
      checks_run: only, coverage: cov, supersession_graph: a.graph,
      asset_directories_examined: b.dirCount, findings,
    }, null, 2));
    process.exit(errors.length ? 1 : 0);
  }

  const label = { A0: 'tool blind', A1: 'superseded ruling not propagated', A2: 'append-only rule broken', A3: 'in-place amendment not reachable from here',
    B1: 'asset nobody names', B2: 'asset only the inventory names', C1: 'FALSE ASSERTION OF ABSENCE' };
  for (const grp of ['C1', 'A1', 'A2', 'A0', 'B1', 'B2', 'A3']) {
    const g = findings.filter((f) => f.check === grp);
    if (!g.length) continue;
    console.log(`\n== ${grp} — ${label[grp]} — ${g.length}`);
    for (const f of g) {
      console.log(`  ${f.file}${f.line ? ':' + f.line : ''}`);
      console.log(`    ${f.message}`);
      if (f.excerpt) console.log(`    | ${f.excerpt}`);
    }
  }
  console.log(`\ncoverage: ${cov.governing_documents} governing documents of ${cov.total_tracked_files} tracked; ` +
              `${b.dirCount} asset directories; ${cov.absence_sentences_seen} absence sentences read.`);
  console.log(cov.note);
  console.log(`\n${errors.length} error(s), ${findings.length - errors.length} warning(s).`);
  process.exit(errors.length ? 1 : 0);
}

if (process.argv[1] && process.argv[1].endsWith('check-citations.mjs')) main();
