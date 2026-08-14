#!/usr/bin/env node
/**
 * road-join-deletefix.mjs — CUT THE JOIN OUT AND WATCH THE PROVINCE CLOSE AGAIN.
 *
 * `RULES.md` rule 6. W1-ROAD-JOIN taught `tools/world/build-roads.mjs` to read the settlement plan
 * so the trunk road stops going through people's houses. This tool removes that on a SCRATCH COPY
 * of the tree and confirms the old number comes back — and then confirms the two arms genuinely
 * differ, because this project has shipped three inert controls and one of them silently ran the
 * positive arm on both sides.
 *
 * THREE ARMS, and the third is the one that matters:
 *
 *   ON        `build-roads.mjs`                       — the join as shipped
 *   OFF-FLAG  `build-roads.mjs --no-join`             — the join's own opt-out
 *   OFF-GIT   `git show <base>:tools/world/build-roads.mjs` — THE FILE AS IT WAS BEFORE THE CHANGE
 *
 * OFF-FLAG alone would be a control over a boolean I wrote. OFF-GIT runs the actual pre-change
 * generator out of git, so "the old number returns" is a statement about the old code and not
 * about my own switch. If the two off arms disagree, the flag is not a faithful teardown and this
 * tool says so and exits non-zero.
 *
 * THE INERT-CONTROL GUARD. Each arm writes its own `roads.json`, and immediately before the
 * measurement this tool hashes the file `game/data/world/roads.json` AS IT LIES ON DISK in the
 * scratch tree and records it. If two arms measured the same bytes, the arms did not differ, and
 * that is reported as a failure of the control rather than as a result. Nothing is nulled and
 * re-read: the handle every arm tests — the roads file the instrument opens — is re-hashed per arm
 * from the filesystem, not carried in a variable the setup could have left pointing at one file.
 *
 * The measurement itself is `tools/world/road-through-building.mjs`, which this tool does not
 * reimplement and does not import: it runs it as a subprocess in the scratch tree and reads its
 * exit code and its report. The instrument is W1-01 r4's and is independent of the generator.
 *
 * Usage:
 *   node tools/world/road-join-deletefix.mjs [--scratch <dir>] [--out reports/w1-road-join/deletefix.json]
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync, execSync } from 'node:child_process';

const ROOT = path.resolve(new URL('../..', import.meta.url).pathname);
const argv = process.argv.slice(2);
const argOf = (f, d) => (argv.includes(f) ? argv[argv.indexOf(f) + 1] : d);
const OUT = path.join(ROOT, argOf('--out', 'reports/w1-road-join/deletefix.json'));
const SCRATCH = path.resolve(argOf('--scratch',
  '/tmp/claude-0/-home-user-elder-souls-claude/3c195166-6f14-54d0-bf0f-867f7b39d84b/scratchpad/deletefix'));
const BASE = argOf('--base', 'HEAD');

const log = (s) => process.stdout.write(s + '\n');
const sha = (p) => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex').slice(0, 16);

/** A minimal tree that `build-roads.mjs` and `road-through-building.mjs` can both run in. */
function makeScratch() {
  fs.rmSync(SCRATCH, { recursive: true, force: true });
  fs.mkdirSync(path.join(SCRATCH, 'corpus/50-world'), { recursive: true });
  fs.mkdirSync(path.join(SCRATCH, 'reports'), { recursive: true });
  fs.cpSync(path.join(ROOT, 'game'), path.join(SCRATCH, 'game'), { recursive: true });
  fs.cpSync(path.join(ROOT, 'tools'), path.join(SCRATCH, 'tools'), { recursive: true });
  fs.copyFileSync(path.join(ROOT, 'corpus/50-world/world-scale.json'), path.join(SCRATCH, 'corpus/50-world/world-scale.json'));
  fs.rmSync(path.join(SCRATCH, 'tools/runs'), { recursive: true, force: true });
}

function run(cmd, args, cwd) {
  try {
    const out = execFileSync(cmd, args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 * 1024 * 1024 });
    return { code: 0, out };
  } catch (e) {
    return { code: e.status === undefined ? -1 : e.status, out: (e.stdout || '') + (e.stderr || '') };
  }
}

/**
 * Build a road network with `gen`, put it where the instrument looks, hash what is actually there,
 * and measure. The hash is taken from the filesystem after the copy, so an arm that failed to
 * install its own roads.json is caught here and not in the conclusion.
 */
function arm(name, gen, extraArgs) {
  const roadsOut = path.join('reports', `roads-${name}.json`);
  const live = path.join(SCRATCH, 'game/data/world/roads.json');
  // The PRE-CHANGE generator has no `--out`: it was added by the same change this tool is
  // deleting. It ignores the flag and writes straight to game/data/world/roads.json, so that file
  // is stamped before the build and the arm falls back to it — having first checked the build
  // actually rewrote it, so a generator that silently did nothing cannot pass as a control.
  const stamp = fs.existsSync(live) ? sha(live) : null;
  fs.rmSync(path.join(SCRATCH, roadsOut), { force: true });
  const build = run('node', [gen, '--out', roadsOut, ...(extraArgs || [])], SCRATCH);
  let built = path.join(SCRATCH, roadsOut);
  if (!fs.existsSync(built)) {
    if (!fs.existsSync(live) || sha(live) === stamp) {
      return { arm: name, error: 'generator produced no roads.json and did not rewrite the live one', build_exit: build.code, build_tail: build.out.slice(-3000) };
    }
    built = live;
    fs.copyFileSync(live, path.join(SCRATCH, roadsOut));
    built = path.join(SCRATCH, roadsOut);
  }
  fs.copyFileSync(built, live);
  const installed_sha = sha(path.join(SCRATCH, 'game/data/world/roads.json'));
  const rep = path.join('reports', `rtb-${name}.json`);
  const check = run('node', ['tools/world/road-through-building.mjs', '--out', rep], SCRATCH);
  const doc = JSON.parse(fs.readFileSync(path.join(SCRATCH, rep), 'utf8'));
  const roads = JSON.parse(fs.readFileSync(built, 'utf8'));
  log(`  ${name.padEnd(9)} sha ${installed_sha}  legs blocked ${String(doc.legs.length).padStart(2)}/${roads.legs.length}  `
    + `named-route offences ${String(doc.offences).padStart(2)}  instrument exit ${check.code}`);
  return {
    arm: name, generator: gen, args: extraArgs || [],
    build_exit: build.code, instrument_exit: check.code,
    installed_roads_sha256_16: installed_sha,
    legs_total: roads.legs.length, legs_blocked: doc.legs.length, named_route_offences: doc.offences,
    blocked: doc.legs.map((l) => `${l.leg}: ${l.buildings.join(', ')}`),
    crossing_m: roads.named_routes.crossing.metres,
    long_way_m: roads.named_routes.long_way.metres,
    trunk_m: roads.total_trunk_m,
    join_declared: roads.settlement_join ? roads.settlement_join.performed : null,
  };
}

makeScratch();
// The pre-change generator, out of git, so the OFF arm is the OLD CODE and not my own boolean.
const before = execSync(`git show ${BASE}:tools/world/build-roads.mjs`, { cwd: ROOT, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
const beforePath = path.join(SCRATCH, 'tools/world/build-roads-BEFORE.mjs');
fs.writeFileSync(beforePath, before);
// `git show HEAD:` on a tree where the change is not yet committed gives the pre-change file. If
// the change IS committed, HEAD is the joined file and this arm would be a duplicate of ON — which
// would be an inert control. Detect that here rather than reporting a false negative.
//
// `--base` MUST be a commit from before the change. That is not the same as HEAD~1 on this tree:
// the orchestrator banks with `git add -A`, and while this join was being written EIGHT successive
// banks committed the file mid-edit under other agents' messages. `git log -- <path>` therefore
// names commits that already carry half of it. The marker below is the change's own task id, which
// no pre-change revision can contain, so the base is verified rather than assumed.
const beforeHasJoin = /W1-ROAD-JOIN/.test(before);

log(`delete-the-fix on the roads/settlements join`);
log(`  scratch ${SCRATCH}`);
log(`  OFF-GIT source: git show ${BASE}:tools/world/build-roads.mjs `
  + `(${beforeHasJoin ? 'ALREADY CONTAINS THE JOIN — this arm is not a control' : 'pre-join, good'})`);

const arms = [];
arms.push(arm('on', 'tools/world/build-roads.mjs'));
arms.push(arm('off-flag', 'tools/world/build-roads.mjs', ['--no-join']));
if (!beforeHasJoin) arms.push(arm('off-git', 'tools/world/build-roads-BEFORE.mjs'));

const on = arms.find((a) => a.arm === 'on');
const offs = arms.filter((a) => a.arm.startsWith('off'));
const checks = [];
const check = (id, ok, detail) => { checks.push({ id, pass: !!ok, detail }); log(`  [${ok ? 'PASS' : 'FAIL'}] ${id}: ${detail}`); };

log('');
check('ON-CLEAR', on.legs_blocked === 0 && on.named_route_offences === 0,
  `join on: ${on.legs_blocked} of ${on.legs_total} legs blocked, ${on.named_route_offences} named-route offences`);
for (const o of offs) {
  check(`${o.arm.toUpperCase()}-RETURNS`, o.legs_blocked === o.legs_total && o.named_route_offences > 0,
    `${o.arm}: ${o.legs_blocked} of ${o.legs_total} legs blocked, ${o.named_route_offences} named-route offences — the old number`);
  check(`${o.arm.toUpperCase()}-DIFFERS`, o.installed_roads_sha256_16 !== on.installed_roads_sha256_16,
    `the bytes the instrument read differ between the arms (${on.installed_roads_sha256_16} vs ${o.installed_roads_sha256_16})`);
}
if (offs.length === 2) {
  check('OFF-ARMS-AGREE', offs[0].legs_blocked === offs[1].legs_blocked,
    `the flag teardown and the pre-change file give the same answer (${offs[0].legs_blocked} vs ${offs[1].legs_blocked} legs blocked) — the flag is a faithful teardown`);
} else {
  check('OFF-ARMS-AGREE', false, 'the pre-change generator arm could not be built — the flag is the only teardown, which is weaker than this control claims');
}
// The arms must not merely differ in a number; they must be measuring different worlds.
const uniq = new Set(arms.map((a) => a.installed_roads_sha256_16));
check('NO-INERT-CONTROL', uniq.size === arms.length,
  `${uniq.size} distinct roads.json across ${arms.length} arms — every arm measured its own world`);

const doc = {
  schema: 'w1-road-join/deletefix@1',
  measured_at: new Date().toISOString(),
  git: { base: BASE, head: execSync('git rev-parse HEAD', { cwd: ROOT, encoding: 'utf8' }).trim() },
  scratch: SCRATCH,
  method: 'three generators, three roads.json, one unmodified instrument (tools/world/road-through-building.mjs) run as a subprocess per arm',
  arms, checks, ok: checks.every((c) => c.pass),
};
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(doc, null, 1) + '\n');
log(`\n${doc.ok ? 'DELETE-THE-FIX PASSES' : 'DELETE-THE-FIX FAILS'}\n  ${OUT}`);
process.exit(doc.ok ? 0 : 1);
