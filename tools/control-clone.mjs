#!/usr/bin/env node
// control-clone.mjs — build, clean up, and prove the cheap null-control clone.
//
// See tools/lib/control-clone.mjs for the mechanism and why it exists (HAZARDS.md §5: the disk hit
// 99% twice in one day over exactly this). This file is the CLI: the thing a builder actually types
// instead of writing their own `fs.cpSync(ROOT/game, ...)`.
//
// USAGE
//   node tools/control-clone.mjs make --label <name> [--paths game,tools] [--extra <rel>,...]
//                                 [--writable <rel>,...] [--json <path>]
//   node tools/control-clone.mjs cleanup --dir <path> [--force]
//   node tools/control-clone.mjs sweep [--all --yes] [--older-than <min>] [--force] [--dry-run]
//   node tools/control-clone.mjs --self-test [--json <path>] [--keep]
//
// `make` prints the clone directory on stdout (and nothing else) so it composes in a shell:
//   SCRATCH=$(node tools/control-clone.mjs make --label my-control --writable game/data/world/x.json)
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { parseArgs, wantsHelp, usage, log, REPO_ROOT, ensureDir } from './lib/cli.mjs';
import {
  makeControlClone, removeClone, sweep, listClones, humanMB, DEFAULT_PATHS,
} from './lib/control-clone.mjs';

const HELP = `
control-clone — the cheap way to build a null-control scratch tree (HAZARDS.md §5).

USAGE
  node tools/control-clone.mjs make --label <name> [--paths game,tools] [--extra <rel>,...]
                                [--writable <rel>,...] [--json <path>]
  node tools/control-clone.mjs cleanup --dir <path> [--force]
  node tools/control-clone.mjs sweep [--all --yes] [--older-than <min>] [--force] [--dry-run]
  node tools/control-clone.mjs --self-test [--json <path>] [--keep]

make        Build a clone. Prints the clone directory to stdout. --writable lists every path (file
            or directory prefix) your OWN code will write into after the clone exists — anything not
            listed is a hard link and writing to it corrupts the real repository file. Get this list
            right; the tool cannot infer it for you.
cleanup     Remove one clone by path. Refuses a clone whose manifest says a live process (not this
            one) still owns it, unless --force.
sweep       Remove every clone this agent owns whose owning process has exited. Never touches a clone
            owned by another agent unless --all --yes (everyone's, dangerous) or --older-than
            <minutes> (age-based, still protects a live claim unless --force).
--self-test Proves the mechanism does what it claims: a real existing delete-the-fix case (the
            road/settlement join) gives byte-identical results whether its scratch tree was built by
            this tool or by a full \`fs.cpSync\` deep copy; the SAME cheap clone still goes red when
            the fix is torn down; and — on a synthetic tree, so nothing real is put at risk — writing
            into a path NOT declared writable corrupts the source while writing into a DECLARED
            writable path does not. Exits non-zero if any of that fails to hold.
`;

const args = parseArgs();
if (wantsHelp(args)) usage(HELP);
const cmd = args._[0];

function writeJsonMaybe(p, doc) {
  if (!p) return;
  ensureDir(path.dirname(path.resolve(p)));
  fs.writeFileSync(path.resolve(p), `${JSON.stringify(doc, null, 2)}\n`);
  log(`wrote ${p}`);
}

function splitList(v) {
  if (!v) return [];
  return String(v).split(',').map((s) => s.trim()).filter(Boolean);
}

// ---------------------------------------------------------------------------------------------
if (args['self-test'] || cmd === 'selftest') {
  const result = await selfTest({ keep: !!args.keep });
  writeJsonMaybe(args.json, result);
  process.stdout.write(`\n${result.ok ? 'SELF-TEST PASSED' : 'SELF-TEST FAILED'}\n`);
  process.exit(result.ok ? 0 : 1);
} else if (cmd === 'make') {
  const { dir, manifest } = makeControlClone({
    paths: args.paths ? splitList(args.paths) : DEFAULT_PATHS,
    extra: splitList(args.extra),
    writable: splitList(args.writable),
    label: args.label || 'control',
  });
  log(`clone at ${dir}`);
  log(`  linked ${manifest.stats.linked}, copied-writable ${manifest.stats.copiedWritable}, `
    + `link-fallback ${manifest.stats.copiedFallback}, apparent ${humanMB(manifest.stats.apparentBytes)}, `
    + `actually new on disk ${humanMB(manifest.stats.newBytes)}`);
  writeJsonMaybe(args.json, manifest);
  process.stdout.write(`${dir}\n`);
} else if (cmd === 'cleanup') {
  if (!args.dir) usage(HELP, 2);
  const r = removeClone(path.resolve(String(args.dir)), { force: !!args.force });
  log(r.removed ? `removed ${args.dir}` : `refused: ${r.reason}`);
  process.exit(r.removed ? 0 : 1);
} else if (cmd === 'sweep') {
  const r = sweep({
    all: !!args.all, yes: !!args.yes, force: !!args.force,
    olderThanMinutes: args['older-than'] != null ? Number(args['older-than']) : null,
    dryRun: !!args['dry-run'],
  });
  log(`owner o${r.ownerSlug}`);
  for (const x of r.removed) log(`  ${x.dryRun ? 'would remove' : (x.removed ? 'removed' : 'FAILED')}  ${x.dir}  (${x.reason})`);
  for (const x of r.protected) log(`  left alone   ${x.dir}  (${x.reason})`);
  writeJsonMaybe(args.json, r);
} else if (cmd === 'list') {
  for (const c of listClones()) {
    log(`${c.dir}  owner=${c.manifest?.owner?.slug || '?'} pid=${c.manifest?.pid || '?'} created=${c.manifest?.createdAt || '?'}`);
  }
} else {
  usage(HELP, 2);
}

// =================================================================================================
// SELF-TEST
// =================================================================================================
async function selfTest({ keep = false } = {}) {
  const checks = [];
  const check = (id, ok, detail) => { checks.push({ id, ok: !!ok, detail }); log(`  [${ok ? 'PASS' : 'FAIL'}] ${id}: ${detail}`); };
  const cleanupDirs = [];
  const sha = (p) => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex').slice(0, 16);
  const run = (cmdArgs, cwd) => {
    try { return { code: 0, out: execFileSync('node', cmdArgs, { cwd, encoding: 'utf8', maxBuffer: 64 << 20 }) }; }
    catch (e) { return { code: e.status ?? -1, out: (e.stdout || '') + (e.stderr || '') }; }
  };

  log('control-clone self-test');
  log('========================');

  // -----------------------------------------------------------------------------------------
  // PART 1 — MECHANISM SAFETY, on a synthetic tree. Nothing under REPO_ROOT is at risk here:
  // the "source" is a throwaway tree this test builds and deletes. This is where a write into a
  // path that was NOT declared writable is actually allowed to corrupt its source — safe only
  // because the source is synthetic — to prove the danger described in control-clone.mjs's header
  // is real, and that declaring `writable` is what stands between a control and that danger.
  // -----------------------------------------------------------------------------------------
  log('\npart 1 — mechanism safety (synthetic source, nothing real at risk)');
  const synthRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'control-clone-selftest-src-'));
  cleanupDirs.push(synthRoot);
  ensureDir(path.join(synthRoot, 'pkg/data'));
  fs.writeFileSync(path.join(synthRoot, 'pkg/readonly.txt'), 'ORIGINAL-READONLY');
  fs.writeFileSync(path.join(synthRoot, 'pkg/data/output.json'), '{"v":1}');
  const readonlyShaBefore = sha(path.join(synthRoot, 'pkg/readonly.txt'));
  const outputShaBefore = sha(path.join(synthRoot, 'pkg/data/output.json'));

  const good = makeControlClone({
    root: synthRoot, paths: ['pkg'], writable: ['pkg/data/output.json'], label: 'selftest-good',
  });
  cleanupDirs.push(good.dir);
  const goodReadonlyIno = fs.statSync(path.join(good.dir, 'pkg/readonly.txt')).ino;
  const srcReadonlyIno = fs.statSync(path.join(synthRoot, 'pkg/readonly.txt')).ino;
  check('LINKED-FILE-IS-SAME-INODE', goodReadonlyIno === srcReadonlyIno,
    `unwritable file shares an inode with the source (${goodReadonlyIno} === ${srcReadonlyIno}) — a real hard link, not a copy that happens to match`);
  const goodOutputIno = fs.statSync(path.join(good.dir, 'pkg/data/output.json')).ino;
  check('WRITABLE-FILE-IS-A-NEW-INODE', goodOutputIno !== fs.statSync(path.join(synthRoot, 'pkg/data/output.json')).ino,
    'declared-writable file got its own inode, not a link');

  // Mutate the clone's writable file the way a real control does — a plain overwrite.
  fs.writeFileSync(path.join(good.dir, 'pkg/data/output.json'), '{"v":2,"mutated":true}');
  check('DECLARED-WRITABLE-DOES-NOT-CORRUPT-SOURCE', sha(path.join(synthRoot, 'pkg/data/output.json')) === outputShaBefore,
    'writing into the declared-writable clone file left the source byte-identical');

  // The negative arm: the SAME mutation, but on a clone that did NOT declare the file writable.
  // This is the failure control-clone.mjs's `writable` list exists to prevent, demonstrated once,
  // deliberately, on a tree nothing real depends on.
  const bad = makeControlClone({ root: synthRoot, paths: ['pkg'], writable: [], label: 'selftest-bad' });
  cleanupDirs.push(bad.dir);
  fs.writeFileSync(path.join(bad.dir, 'pkg/data/output.json'), '{"v":2,"mutated":true}');
  const corrupted = sha(path.join(synthRoot, 'pkg/data/output.json')) !== outputShaBefore;
  check('UNDECLARED-WRITE-DOES-CORRUPT-SOURCE (expected, and why `writable` matters)', corrupted,
    corrupted
      ? 'confirmed: writing into a linked file with no `writable` entry mutated the shared inode — exactly the danger the header warns about, and exactly what declaring `writable` prevents (see the check above)'
      : 'did NOT reproduce — either the filesystem silently copy-on-wrote (unexpected on ext4) or linking silently failed; either way the danger claim in the header needs re-checking, not this test');
  // Repair the synthetic source for a clean second read, then it is deleted anyway.
  fs.writeFileSync(path.join(synthRoot, 'pkg/data/output.json'), '{"v":1}');

  // -----------------------------------------------------------------------------------------
  // PART 2 — REAL CASE EQUIVALENCE. tools/world/road-join-deletefix.mjs's own scratch (game +
  // tools + one corpus fixture) is the case this tool was modelled on; three other files
  // (critic-road-join-consume.mjs, road-join-consumption.mjs, and the same file) build an
  // identical scratch by hand today. This proves a clone from this tool gives the same instrument
  // result as the `fs.cpSync` deep copy those files use, and that the SAME cheap clone still tells
  // a clean join from a torn-down one.
  // -----------------------------------------------------------------------------------------
  log('\npart 2 — real case equivalence (the road/settlement join)');
  const REAL_PATHS = ['game', 'tools'];
  const REAL_EXTRA = ['corpus/50-world/world-scale.json'];
  const REAL_WRITABLE = ['game/data/world/roads.json'];
  const realRoadsBefore = fs.existsSync(path.join(REPO_ROOT, 'game/data/world/roads.json'))
    ? sha(path.join(REPO_ROOT, 'game/data/world/roads.json')) : null;

  const linked = makeControlClone({ paths: REAL_PATHS, extra: REAL_EXTRA, writable: REAL_WRITABLE, label: 'selftest-real-linked' });
  cleanupDirs.push(linked.dir);
  // `reports/` is where the instrument writes its own output — not part of the source tree copy
  // (nobody wants the real reports/ directory in a control), just an empty landing directory, the
  // same way tools/world/road-join-deletefix.mjs's makeScratch() creates one by hand.
  ensureDir(path.join(linked.dir, 'reports'));
  const fullCopyDir = path.join(os.tmpdir(), `control-clone-selftest-fullcopy-${process.pid}-${Date.now()}`);
  cleanupDirs.push(fullCopyDir);
  ensureDir(path.join(fullCopyDir, 'corpus/50-world'));
  ensureDir(path.join(fullCopyDir, 'reports'));
  fs.cpSync(path.join(REPO_ROOT, 'game'), path.join(fullCopyDir, 'game'), { recursive: true });
  fs.cpSync(path.join(REPO_ROOT, 'tools'), path.join(fullCopyDir, 'tools'), { recursive: true });
  fs.copyFileSync(path.join(REPO_ROOT, 'corpus/50-world/world-scale.json'), path.join(fullCopyDir, 'corpus/50-world/world-scale.json'));

  function measureJoin(dir, args2) {
    const build = run(['tools/world/build-roads.mjs', '--out', 'reports/selftest-roads.json', ...(args2 || [])], dir);
    const roadsOut = path.join(dir, 'reports/selftest-roads.json');
    const live = path.join(dir, 'game/data/world/roads.json');
    if (fs.existsSync(roadsOut)) fs.copyFileSync(roadsOut, live);
    const check2 = run(['tools/world/road-through-building.mjs', '--out', 'reports/selftest-rtb.json'], dir);
    const rtb = fs.existsSync(path.join(dir, 'reports/selftest-rtb.json'))
      ? JSON.parse(fs.readFileSync(path.join(dir, 'reports/selftest-rtb.json'), 'utf8')) : null;
    return {
      buildExit: build.code, buildTail: build.out.slice(-1500), checkExit: check2.code,
      legsBlocked: rtb ? rtb.legs.length : null, offences: rtb ? rtb.offences : null,
      roadsSha: fs.existsSync(live) ? sha(live) : null,
    };
  }

  const linkedClean = measureJoin(linked.dir, []);
  const fullCopyClean = measureJoin(fullCopyDir, []);
  check('EQUIVALENCE-BUILD-RAN', linkedClean.buildExit === 0 && fullCopyClean.buildExit === 0,
    `build exits: linked ${linkedClean.buildExit}, full-copy ${fullCopyClean.buildExit}`
    + (linkedClean.buildExit !== 0 ? ` — linked tail: ${linkedClean.buildTail}` : ''));
  check('EQUIVALENCE-SAME-BYTES', linkedClean.roadsSha !== null && linkedClean.roadsSha === fullCopyClean.roadsSha,
    `roads.json sha: linked ${linkedClean.roadsSha}, full-copy ${fullCopyClean.roadsSha}`);
  check('EQUIVALENCE-SAME-MEASUREMENT', linkedClean.legsBlocked === fullCopyClean.legsBlocked && linkedClean.offences === fullCopyClean.offences,
    `legs blocked: linked ${linkedClean.legsBlocked}, full-copy ${fullCopyClean.legsBlocked}; `
    + `offences: linked ${linkedClean.offences}, full-copy ${fullCopyClean.offences}`);
  // NOT a claim about whether the shipped join is currently perfect (that is W1-ROAD-JOIN's own
  // instrument's business, and this repository has many parallel agents moving settlement data —
  // the number below may be non-zero on any given day for reasons that have nothing to do with this
  // tool). What THIS self-test needs is that the linked clone and the full-copy clone see the SAME
  // shipped state, which EQUIVALENCE-SAME-MEASUREMENT just proved. Logged for context only.
  log(`  (context, not a pass/fail gate) shipped join through the linked clone today: `
    + `${linkedClean.legsBlocked} legs blocked, ${linkedClean.offences} offences`);

  // The SAME linked clone, torn down — an arm that must genuinely disagree with the one above.
  const linkedTornDown = measureJoin(linked.dir, ['--no-join']);
  check('DISCRIMINATES-TEARDOWN-GOES-RED', linkedTornDown.legsBlocked > 0 && linkedTornDown.roadsSha !== linkedClean.roadsSha,
    `--no-join through the SAME cheap clone: ${linkedTornDown.legsBlocked} legs blocked (was ${linkedClean.legsBlocked}), `
    + `bytes ${linkedTornDown.roadsSha} vs clean ${linkedClean.roadsSha} — the cheap clone still tells fixed from broken`);

  const realRoadsAfter = realRoadsBefore !== null ? sha(path.join(REPO_ROOT, 'game/data/world/roads.json')) : null;
  check('REAL-REPO-FILE-UNTOUCHED', realRoadsBefore === realRoadsAfter,
    `game/data/world/roads.json in the actual repository: before ${realRoadsBefore}, after ${realRoadsAfter}`);

  const apparent = linked.manifest.stats.apparentBytes;
  const newBytes = linked.manifest.stats.newBytes;
  log(`\n  disk: apparent size (what a full copy costs) ${humanMB(apparent)}; `
    + `this clone actually added ${humanMB(newBytes)} (${((newBytes / apparent) * 100).toFixed(2)}% of it) `
    + `— ${linked.manifest.stats.linked} files linked, ${linked.manifest.stats.copiedWritable} copied because declared writable, `
    + `${linked.manifest.stats.copiedFallback} copied because linking fell back`);

  if (!keep) {
    for (const d of cleanupDirs) fs.rmSync(d, { recursive: true, force: true });
  } else {
    log(`\n  kept: ${cleanupDirs.join(', ')}`);
  }

  const ok = checks.every((c) => c.ok);
  return {
    schema: 'elder-souls/control-clone-selftest@1',
    ok, checks,
    disk: { apparentBytes: apparent, newBytes, savingPercent: +((1 - newBytes / apparent) * 100).toFixed(2) },
  };
}
