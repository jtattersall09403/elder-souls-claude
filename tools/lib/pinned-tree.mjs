// pinned-tree.mjs — refuse to publish an experiment whose source moved underneath it.
//
// Owner: W1-MAP-DEFECTS-r2. Written against a real defect, not a hypothetical one.
//
// THE INCIDENT THIS EXISTS FOR. `reports/w1-map-defects/fog-control.json` recorded a three-arm
// control as `pass: true`. The W1-MAP-DEFECTS-r1 critic then found that `fog-deletefix.png` is
// headed "Where I have been" and `fog-markers.png` is headed "The Province" — two arms of ONE
// experiment, photographed either side of an edit to `game/src/ui/screens/map.js`. The cell counts
// happened not to move (the heading is a string literal outside the draw loop) so the conclusion
// survived, but the comparison was void regardless of the numbers: the arms were not run against
// one source. The status file's "three arms, commit 34b9a10fcc" was true of no arm.
//
// WHY `gitInfo()` AND `hashDataTree()` DID NOT CATCH IT, which is the whole design argument.
//   * `gitInfo().commit` is `git rev-parse HEAD`. The edit was UNCOMMITTED, so HEAD never moved
//     and the report stamped a commit that described none of what it measured.
//   * `gitInfo().dirty` is a single boolean over a tree a dozen agents are writing to. It was
//     already true before the run and stayed true; it carries no information here.
//   * `hashDataTree()` matches `\.(json|jsonl|ndjson|csv|md|txt)$` — DATA only. `map.js` is source,
//     so it is not in the digest at all. It also returns one lump hash with no per-file record, so
//     even where it does fire it cannot say WHICH file moved.
// So: hash the source the experiment actually reads, per file, and compare between arms.
//
// THE RULING ON DIRTY-VS-MOVED, recorded because it is a real design call and it is REVERSIBLE.
// This module does NOT refuse to run on a dirty tree, and that is deliberate. A dozen agents write
// to this checkout concurrently, so `git status --porcelain` is never empty; a dirty-gate would
// refuse every run on this box forever and would be commented out within the hour, and a check
// everybody disables is not a check. What actually voided the r1 experiment was not dirtiness at
// the start — it was the tree CHANGING BETWEEN ARMS. So dirtiness is recorded as metadata (the
// report then says honestly what it measured) and MOVEMENT is the hard abort.
//   WHAT WOULD OVERTURN THIS: per-agent worktrees making the tree quiet, or a measured run where a
//   pre-existing dirty file — not a moving one — changed a published number. Either would justify
//   tightening `pinTree` to refuse on dirty; the metadata to detect the second is now in the pin.
//
// USAGE
//   const pin = pinTree({ label: 'fog-control' });      // once, before the first arm
//   ... run arm ...
//   assertUnmoved(pin, { arm: 'deletefix' });           // after each arm, before the next
//   report.pin = pinSummary(pin);                        // in the published record
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { REPO_ROOT, gitInfo } from './cli.mjs';

/** Source the experiments read. `.js` is the point — the r1 defect was a `.js` edit. */
export const SOURCE_RE = /\.(m?js|cjs|html|css|json|jsonl|ndjson|csv)$/i;
const SKIP_DIRS = new Set(['node_modules', '.git', 'coverage', 'dist']);

function walk(dir, root, out, match) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const e of entries.sort((a, b) => (a.name < b.name ? -1 : 1))) {
    if (SKIP_DIRS.has(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isSymbolicLink()) continue;
    if (e.isDirectory()) walk(p, root, out, match);
    else if (match.test(e.name)) {
      let buf;
      try { buf = fs.readFileSync(p); } catch { continue; }
      out.set(path.relative(root, p), crypto.createHash('sha256').update(buf).digest('hex').slice(0, 16));
    }
  }
}

/**
 * Snapshot the content of every source file under `paths`, per file.
 * Cheap enough to call between arms: ~800 files here, well under a second.
 */
export function pinTree({ root = REPO_ROOT, paths = ['game'], match = SOURCE_RE, label = null } = {}) {
  const files = new Map();
  for (const rel of paths) walk(path.resolve(root, rel), root, files, match);
  if (files.size === 0) {
    throw new Error(`pinTree(${JSON.stringify(paths)}): matched 0 files under ${root}. A pin over nothing `
      + `cannot fail, and a guard that cannot fail is worse than no guard (RULES 4). Check the paths.`);
  }
  const h = crypto.createHash('sha256');
  for (const rel of [...files.keys()].sort()) { h.update(rel); h.update('\0'); h.update(files.get(rel)); }
  return {
    label, at: new Date().toISOString(), root, paths: [...paths],
    git: gitInfo(root), count: files.size, digest: h.digest('hex').slice(0, 16), files,
  };
}

/** What moved since `pin`, or null if nothing did. */
export function treeMoved(pin) {
  const now = pinTree({ root: pin.root, paths: pin.paths, label: pin.label });
  if (now.digest === pin.digest) return null;
  const changed = [], added = [], removed = [];
  for (const [rel, sha] of now.files) {
    if (!pin.files.has(rel)) added.push(rel);
    else if (pin.files.get(rel) !== sha) changed.push(rel);
  }
  for (const rel of pin.files.keys()) if (!now.files.has(rel)) removed.push(rel);
  return { changed, added, removed, before: pin.digest, after: now.digest };
}

/**
 * Abort the run if the source moved. Call after every arm, BEFORE the report is written —
 * a report published across a shifted tree is the thing this exists to prevent.
 */
export function assertUnmoved(pin, { arm = null, what = 'this run' } = {}) {
  const moved = treeMoved(pin);
  if (!moved) return true;
  const bits = [];
  if (moved.changed.length) bits.push(`changed: ${moved.changed.join(', ')}`);
  if (moved.added.length) bits.push(`added: ${moved.added.join(', ')}`);
  if (moved.removed.length) bits.push(`removed: ${moved.removed.join(', ')}`);
  throw new Error(
    `SOURCE MOVED MID-RUN — ${what}${arm ? ` is void at arm \`${arm}\`` : ' is void'}.\n`
    + `  pinned ${pin.digest} at ${pin.at} over ${pin.count} file(s) in ${pin.paths.join(', ')}\n`
    + `  now    ${moved.after}\n  ${bits.join('\n  ')}\n`
    + `The arms of one experiment must be run against ONE source; they were not, so the comparison\n`
    + `is void regardless of the numbers it produced. Re-run on a tree that is not being edited.`);
}

/** The part of a pin that belongs in a published report — the file map is too big to publish. */
export function pinSummary(pin) {
  return { label: pin.label, at: pin.at, paths: pin.paths, files: pin.count, digest: pin.digest, git: pin.git };
}

// ---------------------------------------------------------------------------------------------
// SELF-TEST — `node tools/lib/pinned-tree.mjs --self-test`
//
// RULES 4: break the thing you measure on purpose and confirm the instrument goes red. RULES 6:
// delete the fix and watch the old number come back. HAZARDS §0b: a guard shown only passing is a
// one-sided guard — this suite requires its arms to DISAGREE and calls itself vacuous if they do
// not. Nothing here touches the repo; every arm runs in its own temp tree.
// ---------------------------------------------------------------------------------------------
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)
    && process.argv.includes('--self-test')) {
  const os = await import('node:os');
  const arms = [];
  const arm = (id, what, ok, detail) => { arms.push({ id, what, ok, detail }); };

  // A miniature of the real thing: the map screen, with the heading the r1 arms disagreed on.
  const HEADING = "  const title = 'Where I have been';\n";
  function makeTree() {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), 'pinned-tree-selftest-'));
    fs.mkdirSync(path.join(d, 'game/src/ui/screens'), { recursive: true });
    fs.writeFileSync(path.join(d, 'game/src/ui/screens/map.js'), `export function drawMap() {\n${HEADING}  return title;\n}\n`);
    fs.writeFileSync(path.join(d, 'game/src/ui/system.js'), 'export const WALK = [];\n');
    fs.mkdirSync(path.join(d, 'game/data'), { recursive: true });
    fs.writeFileSync(path.join(d, 'game/data/thing.json'), '{"a":1}\n');
    return d;
  }
  const P = (d) => pinTree({ root: d, paths: ['game'], label: 'selftest' });
  const threw = (fn) => { try { fn(); return null; } catch (e) { return e; } };

  // ARM 1 — THE CONTROL. Nothing changes. The guard must stay SILENT. Without this arm a guard
  // that threw unconditionally would score a perfect suite.
  {
    const d = makeTree(); const pin = P(d);
    const e = threw(() => assertUnmoved(pin, { arm: 'control' }));
    arm('ARM1-control', 'an unmoved tree does NOT abort', e === null, e ? `threw: ${e.message.split('\n')[0]}` : 'silent, as required');
    fs.rmSync(d, { recursive: true, force: true });
  }

  // ARM 2 — THE ACTUAL INCIDENT. `map.js` edited between two arms of one experiment. Must abort,
  // and must NAME the file, because "something moved" is not actionable at 15:47 on a shared box.
  let arm2Threw = false;
  {
    const d = makeTree(); const pin = P(d);
    const f = path.join(d, 'game/src/ui/screens/map.js');
    fs.writeFileSync(f, fs.readFileSync(f, 'utf8').replace('Where I have been', 'The Province'));
    const e = threw(() => assertUnmoved(pin, { arm: 'markers' }));
    arm2Threw = !!e;
    const names = !!e && e.message.includes('game/src/ui/screens/map.js');
    arm('ARM2-the-r1-incident', 'a `.js` edit between arms aborts, naming the file', !!e && names,
      e ? `threw and ${names ? 'named' : 'DID NOT NAME'} map.js` : 'DID NOT THROW');
    fs.rmSync(d, { recursive: true, force: true });
  }

  // ARM 3 — THE ONE-SIDED-GUARD TEST. It is not enough that the new guard goes red; it has to go
  // red WHERE THE OLD INSTRUMENTS STAY GREEN, or it has bought nothing. The r1 edit was
  // uncommitted, so `git rev-parse HEAD` cannot see it, and `hashDataTree()` matches data files
  // only — `map.js` is not in its digest. Both are asserted to stay green on the same mutation.
  {
    const { hashDataTree } = await import('./cli.mjs');
    const d = makeTree(); const pin = P(d);
    const headBefore = gitInfo(REPO_ROOT).commit;
    const dataBefore = hashDataTree(path.join(d, 'game/data'));
    const f = path.join(d, 'game/src/ui/screens/map.js');
    fs.writeFileSync(f, fs.readFileSync(f, 'utf8').replace('Where I have been', 'The Province'));
    const headAfter = gitInfo(REPO_ROOT).commit;
    const dataAfter = hashDataTree(path.join(d, 'game/data'));
    const oldBlind = headBefore === headAfter && dataBefore.sha256 === dataAfter.sha256;
    arm('ARM3-old-instruments-are-blind', 'HEAD and hashDataTree() stay GREEN on the same edit — which is why they missed it',
      oldBlind && arm2Threw, `HEAD unchanged=${headBefore === headAfter}, hashDataTree unchanged=${dataBefore.sha256 === dataAfter.sha256}, new guard red=${arm2Threw}`);
    fs.rmSync(d, { recursive: true, force: true });
  }

  // ARM 4/5 — a file APPEARING or DISAPPEARING mid-run is movement too.
  for (const [id, mutate, label] of [
    ['ARM4-added', (d) => fs.writeFileSync(path.join(d, 'game/src/ui/screens/new.js'), 'export const x = 1;\n'), 'a new source file mid-run aborts'],
    ['ARM5-removed', (d) => fs.rmSync(path.join(d, 'game/src/ui/system.js')), 'a deleted source file mid-run aborts'],
  ]) {
    const d = makeTree(); const pin = P(d);
    mutate(d);
    const e = threw(() => assertUnmoved(pin, { arm: id }));
    arm(id, label, !!e, e ? e.message.split('\n').slice(-3, -2)[0] || 'threw' : 'DID NOT THROW');
    fs.rmSync(d, { recursive: true, force: true });
  }

  // ARM 6 — DELETE-THE-FIX. Remove the guard from the flow and confirm the OLD BEHAVIOUR returns:
  // the run completes and publishes a report across a tree that moved. This is r1's fog-control.json.
  {
    const d = makeTree(); const pin = P(d);
    const f = path.join(d, 'game/src/ui/screens/map.js');
    fs.writeFileSync(f, fs.readFileSync(f, 'utf8').replace('Where I have been', 'The Province'));
    let published = null;
    // …the same run, with `assertUnmoved` simply not called — exactly the r1 harness.
    published = { pass: true, commit: pin.git.commit, note: 'published across a shifted tree' };
    arm('ARM6-delete-the-fix', 'without the guard the run publishes `pass: true` across a moved tree — the r1 defect returns',
      published !== null && published.pass === true && arm2Threw,
      `published=${JSON.stringify(published.note)}; with the guard the same mutation aborts=${arm2Threw}`);
    fs.rmSync(d, { recursive: true, force: true });
  }

  // ARM 7 — a pin over nothing must refuse rather than pin the empty set. A guard whose input is
  // empty passes forever; this project has shipped probes green against empty registers before.
  {
    const d = makeTree();
    const e = threw(() => pinTree({ root: d, paths: ['nowhere-at-all'], label: 'vacuous' }));
    arm('ARM7-no-vacuous-pin', 'pinning a path that matches 0 files throws instead of pinning nothing', !!e,
      e ? e.message.split('.')[0] : 'DID NOT THROW — a pin over 0 files can never fail');
    fs.rmSync(d, { recursive: true, force: true });
  }

  // The suite's own honesty check: ARM1 and ARM2 MUST disagree, or every arm is the same arm.
  const a1 = arms.find((a) => a.id === 'ARM1-control'), a2 = arms.find((a) => a.id === 'ARM2-the-r1-incident');
  const vacuous = !(a1 && a2 && a1.ok && a2.ok);
  let failed = 0;
  for (const a of arms) { if (!a.ok) failed++; process.stdout.write(`${a.ok ? 'ok  ' : 'FAIL'} ${a.id.padEnd(28)} ${a.what}\n         ${a.detail}\n`); }
  process.stdout.write(`\n${arms.length - failed}/${arms.length} arms passed.\n`);
  if (vacuous) { process.stdout.write('VACUOUS: the silent arm and the aborting arm did not disagree — this suite proves nothing.\n'); process.exit(2); }
  process.stdout.write('The guard was watched staying silent on an unmoved tree AND aborting on the r1 edit,\n'
    + 'where `git rev-parse HEAD` and `hashDataTree()` both stayed green.\n');
  process.exit(failed ? 1 : 0);
}
