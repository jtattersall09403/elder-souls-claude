#!/usr/bin/env node
/**
 * f10-r12c-stance-cost.mjs — THE BUDGET CLAUSE, MEASURED WHERE IT CAN BE MEASURED.
 *
 * WHY THIS EXISTS, AND IT IS A METHOD FINDING BEFORE IT IS A TOOL. S59's budget clause on the r11
 * remedy asks for the FRAME TIME at the Lilmoth stand, before and after, not rising more than 5%.
 * That measurement has now been attempted FIVE times on this box — the r12 builder twice (30 warm +
 * 240 timed per arm, neither arm finished inside 900 s), and the r12 critic three times (a bug of
 * mine that timed zero frames, then 30+120, then 8+40, neither finishing inside 780 s and 560 s).
 *
 * **The reason is not contention and it is not sample size. On SwiftShader the clause is
 * unmeasurable in principle at any affordable n.** A software-rasterised frame of a stilt town at
 * 1280x720 costs on the order of ten seconds on this hardware; the quantity under test is
 * `ceil(27/8) = 4` stance re-solves, which is CPU arithmetic over 20 bones. Asking whether four bone
 * solves move a ten-second software raster by 5% is asking a metric to resolve a part in ten
 * thousand against noise that is orders of magnitude larger. **That is S60's domain rule in the time
 * axis: the measure is being taken over a domain where the term under test is not present.**
 *
 * SO THIS MEASURES THE TERM ITSELF, ON THE SHIPPED PATH, AND STATES THE FRAME BUDGET IT IS COMPARED
 * AGAINST RATHER THAN MEASURING A NUMBER THAT CANNOT SEE IT. Three arms, and the third is the
 * required-to-disagree control:
 *
 *   A. RE-SOLVE — `poseStatic` called with an ADVANCING clock, so the window fires every call.
 *      This is the cost the clause is about.
 *   B. NO-OP — `poseStatic` called with a STATIONARY clock, so the window never fires: the same
 *      call, the same terrain conform, the same group writes, WITHOUT the re-solve. The difference
 *      A - B is the added per-actor cost and nothing else.
 *   C. CONTROL, REQUIRED TO DISAGREE — the same loop against a build with the re-solve branch
 *      removed must reproduce B and NOT A. Run it with `--control` from inside a patched clone.
 *
 * The result is reported as **ms per re-solve**, then multiplied by the measured re-solve count per
 * frame at the stand (`ceil(drawn/8)`), and expressed as a percentage of a **60 Hz budget of
 * 16.667 ms** — a stated denominator, not a measured one, and that limitation is the headline.
 *
 * Usage: node tools/visual/f10-r12c-stance-cost.mjs [--iters 4000] [--json out.json]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execSync } from 'node:child_process';
import crypto from 'node:crypto';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../..');
const args = {};
for (let i = 2; i < process.argv.length; i++) {
  if (!process.argv[i].startsWith('--')) continue;
  const body = process.argv[i].slice(2);
  const eq = body.indexOf('=');
  if (eq >= 0) { args[body.slice(0, eq)] = body.slice(eq + 1); continue; }
  args[body] = (process.argv[i + 1] && !process.argv[i + 1].startsWith('--')) ? process.argv[++i] : true;
}
const ITERS = Number(args.iters ?? 4000);
const WARM = Number(args.warm ?? 800);

const THREE = await import(pathToFileURL(join(ROOT, 'game/vendor/three/three.module.js')).href);
const actorMod = await import(pathToFileURL(join(ROOT, 'game/src/render/actor.js')).href);
const { Rig } = await import(pathToFileURL(join(ROOT, 'game/src/combat/skeleton.js')).href);
const { LoopClip } = await import(pathToFileURL(join(ROOT, 'game/src/combat/clips.js')).href);
const skel = JSON.parse(readFileSync(join(ROOT, 'game/data/combat/skeleton.json'), 'utf8'));
const hitgeo = JSON.parse(readFileSync(join(ROOT, 'game/data/combat/hitgeometry.json'), 'utf8'));
const clips = JSON.parse(readFileSync(join(ROOT, 'game/data/combat/clips.json'), 'utf8'));
const rig = new Rig(skel, hitgeo);
const mats = {};
for (const f of ['ground', 'water', 'bark', 'leaf', 'reed', 'wall', 'roof', 'plank', 'stone', 'darkStone',
  'skin', 'cloth', 'metal', 'moss', 'chitin', 'wet_chitin', 'bone', 'ember', 'resin']) {
  const m = new THREE.MeshStandardMaterial({ color: 0x808080 }); m.userData = { visualFamily: f }; mats[f] = m;
}
const stance = { pose: clips.archetypes.idle_ready, loop: new LoopClip('idle', clips.archetypes.idle_loop, 96), t: 0 };

function probe(name) {
  const g = actorMod.makeRiggedActor(mats, 0x8f9aa6, 0x8d9a72, 'saxhleel');
  g.userData.actor.civilian = true;
  g.name = name;
  actorMod.poseStatic(g, rig, [0, 0, 0], 0, undefined, stance);   // first solve
  return g;
}

/** @param advance true = clock moves each call (window fires), false = clock pinned (no re-solve) */
function run(advance, iters) {
  const g = probe('npc:cost-probe');
  let t = 1000;
  const t0 = process.hrtime.bigint();
  for (let i = 0; i < iters; i++) {
    if (advance) t += 8;                     // one full stagger window per call: always re-solves
    stance.t = t;
    actorMod.poseStatic(g, rig, [0, 0, 0], 0, undefined, stance);
  }
  const t1 = process.hrtime.bigint();
  return Number(t1 - t0) / 1e6 / iters;      // ms per call
}

run(true, WARM); run(false, WARM);
const reps = 7;
const A = [], B = [];
for (let r = 0; r < reps; r++) { A.push(run(true, ITERS)); B.push(run(false, ITERS)); }
const med = (a) => a.slice().sort((x, y) => x - y)[Math.floor(a.length / 2)];
const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
const sd = (a) => Math.sqrt(a.reduce((s, x) => s + (x - mean(a)) ** 2, 0) / (a.length - 1));

const perResolve = med(A) - med(B);
const DRAWN = Number(args.drawn ?? 27);
const N = actorMod.STANCE_STAGGER_N;
const perFrame = Math.ceil(DRAWN / N) * perResolve;
const BUDGET = 16.667;

let commit = 'unknown';
try { commit = execSync('git rev-parse HEAD', { cwd: ROOT, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); } catch { /* control clone */ }

const out = {
  tool: 'tools/visual/f10-r12c-stance-cost.mjs',
  commit, actor_js_sha256: crypto.createHash('sha256').update(readFileSync(join(ROOT, 'game/src/render/actor.js'))).digest('hex'),
  generated: new Date().toISOString(),
  node: process.version,
  WHAT_THIS_IS_AND_IS_NOT: 'This is NOT the frame time S59 asked for. It is the cost of the TERM the clause is about, measured on the shipped `poseStatic` path, because the frame-time pair is unmeasurable on SwiftShader at any affordable n (five attempts, builder and critic, none finished). The frame budget it is compared against is STATED (60 Hz), not measured.',
  iters_per_rep: ITERS, reps,
  arm_A_advancing_clock_ms_per_call: { median: med(A), mean: mean(A), sd: sd(A), samples: A },
  arm_B_pinned_clock_no_resolve_ms_per_call: { median: med(B), mean: mean(B), sd: sd(B), samples: B },
  ADDED_MS_PER_RE_SOLVE: perResolve,
  stagger_n: N, drawn_at_the_lilmoth_stand: DRAWN,
  re_solves_per_frame_at_that_stand: Math.ceil(DRAWN / N),
  ADDED_MS_PER_FRAME_AT_THE_STAND: perFrame,
  as_pct_of_a_60Hz_frame_budget: 100 * perFrame / BUDGET,
  budget_denominator_ms: BUDGET,
  the_clause: 'must not rise more than 5%',
};
if (args.json) writeFileSync(resolve(ROOT, String(args.json)), JSON.stringify(out, null, 1));
process.stdout.write(JSON.stringify(out, null, 2) + '\n');
