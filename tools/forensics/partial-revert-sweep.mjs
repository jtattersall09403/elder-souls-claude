#!/usr/bin/env node
// partial-revert-sweep.mjs — the CONTENT-level analogue of the HAZARDS §2f signature.
//
// §2f, and `RECOVERY-20260814` which implements it, ask a PER-PATH question:
//   does this commit's tree LACK A FILE its own parent has?
// That found 74 whole files. It is structurally blind to the other half of the
// disease, because a bad commit can also revert PART of a file that still
// exists — the path is in both trees, so nothing is "missing". This asks:
//   does this commit's tree LACK LINES its own parent introduced,
//   in a file that survives in BOTH trees?
//
// The proven instance: `091a6cec` kept `game/src/engine.js` and reverted 18
// lines of it — the faction registry loader, its install and
// `Engine.factionAccess()` — plus the whole body of a status file that still
// exists. Both survived `RECOVERY-20260814` untouched.
//
// ---------------------------------------------------------------------------
// TWO ARMS, because HAZARDS §0b: a guard that only fires in the direction its
// author expected fails on half the number line.
//   DROP      — the side ADDED lines against the merge base, the child lacks
//               them.  (finished work silently reverted)
//   RESURRECT — the side DELETED lines against the merge base, the child has
//               them back. (a deletion silently undone — the mirror defect, and
//               just as real: a stale snapshot re-adds code somebody removed.)
//
// ---------------------------------------------------------------------------
// THE NULL CONTROL IS THE PLAUSIBLE WRONG ANSWER, NOT THE TRIVIAL ONE.
//
// The trivial control is "a commit that removes nothing"; it proves only that a
// detector can stay quiet. The plausible wrong answer is A MERGE WHOSE SIDE
// LEGITIMATELY DELETED CODE AS PART OF A REFACTOR and where the merge correctly
// carried that deletion through. That leaves byte-for-byte the same evidence a
// partial revert leaves — content in the base, gone from the result, in files
// that survive — and a naive detector condemns the refactor.
//
// `--self-test` runs three arms and REQUIRES the naive detector to fire on the
// null control. If the naive arm stays quiet there, the control is not
// plausible, the suite is vacuous, and the tool says so and exits non-zero
// rather than reporting a clean sweep.
//
// Measured on this branch, 2026-08-14:
//   null control  b823e03d (p2 carries 78838f1f "remove idle VFX and vegetation
//                 shadow waste" + ff42b238 "remove marsh water lattice banding")
//                 naive 274 lines over 30 files  |  DROP 0  |  RESURRECT 0
//   positive      091a6cec  naive 661  |  DROP 83 over 6 files  |  RESURRECT 30
//   positive      c9603f64 p5 (W1-18)  naive 50  |  DROP 3798 over 26 files
//
// Read that last row twice. On the largest partial revert on the branch the
// naive detector sees 50 lines and this one sees 3,798 — while on the refactor
// the naive detector invents 274 findings and this one is silent. The naive
// answer is not merely noisier, it is pointed the wrong way.
//
// ---------------------------------------------------------------------------
// USAGE
//   node tools/forensics/partial-revert-sweep.mjs --self-test
//   node tools/forensics/partial-revert-sweep.mjs <commit> [<commit>...]
//   node tools/forensics/partial-revert-sweep.mjs --all-merges     # 194 today
//   node tools/forensics/partial-revert-sweep.mjs --all-commits    # slow
//   ... add --still-missing to keep only lines ABSENT FROM HEAD TODAY, which is
//   the decisive filter: a line a later restore put back is a wound that healed.
//
// LIMIT, stated rather than discovered later: this matches trimmed lines, so a
// pure reformat of a file reads as a total revert. For JSON, confirm with
// `--json-semantic`, which parses both sides and compares ids and leaf keys —
// a reformat has identical structure and a revert is missing ids.

import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const ARGV = process.argv.slice(2);
const has = (f) => ARGV.includes(f);

function git(args) {
  try { return execFileSync('git', ['-C', REPO, ...args], { encoding: 'utf8', maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'ignore'] }); }
  catch (e) { return e.stdout != null ? String(e.stdout) : ''; }
}

// Lines too weak to carry signal alone: closers, blanks, bare punctuation.
const NOISE = /^(\}+;?\)?,?|\{|\)+;?,?|\]+;?,?|,|;|""|''|`|\*\/|\/\*|--|\|)$/;
const meaningful = (l) => { const t = l.trim(); return t.length >= 12 && !NOISE.test(t); };
const SKIP = /\.(png|jpg|jpeg|gif|svg|webp|gz|zip|bin|glb|mp4|woff2?|ico|pdf)$/i;

const treeOf = (r) => new Set(git(['ls-tree', '-r', '--name-only', r]).split('\n').filter(Boolean));
const linesOf = (rev, p) => new Set((git(['show', `${rev}:${p}`]) || '').split('\n').map((x) => x.trim()));

/** One (child, side, base) triple, three arms. */
export function examine(child, side, base, { naive = false } = {}) {
  const tChild = treeOf(child), tSide = treeOf(side);
  const paths = git(['diff', '--name-only', '--no-renames', '-M0', base, side])
    .split('\n').filter((p) => p && !SKIP.test(p) && tChild.has(p) && tSide.has(p));

  const files = [];
  let naiveTotal = 0;
  for (const p of paths) {
    const sB = linesOf(base, p), sS = linesOf(side, p), sC = linesOf(child, p);
    const dropped = [], resurrected = [];
    let sideAdded = 0, sideDeleted = 0;
    for (const l of sS) if (meaningful(l) && !sB.has(l)) { sideAdded++; if (!sC.has(l)) dropped.push(l); }
    for (const l of sB) if (meaningful(l) && !sS.has(l)) { sideDeleted++; if (sC.has(l)) resurrected.push(l); }
    if (naive) for (const l of sB) if (meaningful(l) && !sC.has(l)) naiveTotal++;
    if (dropped.length || resurrected.length) {
      files.push({
        path: p, side_added: sideAdded, dropped: dropped.length,
        side_deleted: sideDeleted, resurrected: resurrected.length,
        // The damning shape: the child kept NONE of what the side wrote into a
        // file it did keep. Partial drops are usually a regenerated dashboard.
        total_revert: sideAdded > 0 && dropped.length === sideAdded,
        sample_dropped: dropped.slice(0, 5), sample_resurrected: resurrected.slice(0, 3),
        _dropped: dropped,
      });
    }
  }
  return {
    files_compared: paths.length,
    dropped_lines: files.reduce((a, f) => a + f.dropped, 0),
    resurrected_lines: files.reduce((a, f) => a + f.resurrected, 0),
    naive_lines_base_absent_from_child: naive ? naiveTotal : undefined,
    files,
  };
}

const parentsOf = (c) => git(['rev-list', '--parents', '-n1', c]).trim().split(/\s+/).slice(1);

export function sides(commit) {
  const ps = parentsOf(commit);
  if (!ps.length) return [];
  if (ps.length === 1) {
    const gp = parentsOf(ps[0]);
    return gp.length ? [{ side: ps[0], base: gp[0], kind: 'single-parent-vs-parent' }] : [];
  }
  const out = [];
  for (let i = 1; i < ps.length; i++) {
    const b = git(['merge-base', ps[0], ps[i]]).trim();
    if (b) out.push({ side: ps[i], base: b, kind: `merge-side-p${i + 1}` });
  }
  const b1 = git(['merge-base', ps[0], ps[1]]).trim();
  if (b1) out.push({ side: ps[0], base: b1, kind: 'merge-side-p1' });
  return out;
}

// ---------------------------------------------------------------- self-test
function selfTest() {
  const NULL_CONTROL = 'b823e03d';   // p2 side = two deliberate removal commits
  const POSITIVE = '091a6cec';       // the proven partial revert
  const POSITIVE2 = 'c9603f64';      // the octopus, W1-18 side

  const nSides = sides(NULL_CONTROL).filter((s) => s.kind === 'merge-side-p2');
  const pSides = sides(POSITIVE).filter((s) => s.kind === 'merge-side-p2');
  const p2Sides = sides(POSITIVE2).filter((s) => s.kind === 'merge-side-p5');
  if (!nSides.length || !pSides.length || !p2Sides.length) {
    console.error('self-test: a control commit is not reachable from this checkout — cannot run.');
    process.exit(2);
  }
  const nul = examine(NULL_CONTROL, nSides[0].side, nSides[0].base, { naive: true });
  const pos = examine(POSITIVE, pSides[0].side, pSides[0].base, { naive: true });
  const pos2 = examine(POSITIVE2, p2Sides[0].side, p2Sides[0].base, { naive: true });

  const arms = [
    ['null control is PLAUSIBLE: the naive detector fires on the refactor',
      nul.naive_lines_base_absent_from_child > 0, `naive=${nul.naive_lines_base_absent_from_child}`],
    ['null control: DROP arm silent on a legitimate refactor deletion',
      nul.dropped_lines === 0, `drop=${nul.dropped_lines}`],
    ['null control: RESURRECT arm silent on a legitimate refactor deletion',
      nul.resurrected_lines === 0, `resurrect=${nul.resurrected_lines}`],
    ['positive 091a6cec: DROP arm fires',
      pos.dropped_lines > 0, `drop=${pos.dropped_lines}`],
    ['positive 091a6cec: the reverted engine method is named',
      pos.files.some((f) => f.path === 'game/src/engine.js' && f._dropped.some((l) => l.includes('factionAccess'))),
      'engine.js / factionAccess'],
    ['RESURRECT arm is not decoration: it fires somewhere',
      pos.resurrected_lines > 0 || pos2.resurrected_lines > 0,
      `091a6cec=${pos.resurrected_lines} c9603f64=${pos2.resurrected_lines}`],
    ['positive c9603f64 p5: DROP arm fires, and harder than the naive arm does',
      pos2.dropped_lines > pos2.naive_lines_base_absent_from_child,
      `drop=${pos2.dropped_lines} naive=${pos2.naive_lines_base_absent_from_child}`],
  ];
  let bad = 0;
  for (const [name, ok, detail] of arms) {
    console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}  (${detail})`);
    if (!ok) bad++;
  }
  console.log(bad ? `partial-revert-sweep --self-test: ${bad} arm(s) FAILED.` : 'partial-revert-sweep --self-test: 7/7 arms pass.');
  process.exit(bad ? 1 : 0);
}

// ---------------------------------------------------------------- driver
if (has('--self-test')) selfTest();

let list = ARGV.filter((a) => !a.startsWith('--'));
if (has('--all-merges')) list = git(['rev-list', '--merges', 'HEAD']).split('\n').filter(Boolean);
if (has('--all-commits')) list = git(['rev-list', '--no-merges', 'HEAD']).split('\n').filter(Boolean);
if (!list.length) {
  console.error('usage: node tools/forensics/partial-revert-sweep.mjs [--self-test|--all-merges|--all-commits|<commit>...] [--still-missing]');
  process.exit(64);
}

// The decisive filter, and it is checked against the WHOLE HEAD tree rather than
// the same path — otherwise ordinary code motion manufactures findings.
let headCorpus = null;
if (has('--still-missing')) {
  headCorpus = new Set();
  for (const p of git(['ls-tree', '-r', '--name-only', 'HEAD']).split('\n').filter((x) => x && !SKIP.test(x))) {
    for (const l of (git(['show', `HEAD:${p}`]) || '').split('\n')) { const t = l.trim(); if (t) headCorpus.add(t); }
  }
}

const results = [];
for (const c of list) {
  const sha = git(['rev-parse', c]).trim();
  if (!sha) continue;
  const [date, subject] = git(['log', '-1', '--pretty=%ad%x00%s', '--date=short', sha]).trim().split('\0');
  for (const s of sides(sha)) {
    const r = examine(sha, s.side, s.base);
    if (!r.dropped_lines && !r.resurrected_lines) continue;
    for (const f of r.files) {
      f.still_absent_from_head = headCorpus ? f._dropped.filter((l) => !headCorpus.has(l)).length : undefined;
      delete f._dropped;
    }
    if (headCorpus) {
      r.files = r.files.filter((f) => f.still_absent_from_head > 0 || f.resurrected);
      if (!r.files.length) continue;
    }
    results.push({ commit: sha.slice(0, 8), date, subject, kind: s.kind, side: s.side.slice(0, 8), base: s.base.slice(0, 8), ...r });
  }
}
results.sort((a, b) => (b.dropped_lines + b.resurrected_lines) - (a.dropped_lines + a.resurrected_lines));
console.log(JSON.stringify({ population: list.length, flagged_commit_sides: results.length, results }, null, 1));
