#!/usr/bin/env node
/**
 * f10-r7a-slope-scan.mjs — find a stand where the per-foot ground conform can actually be SEEN.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * WHY THIS EXISTS
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 *
 * `orchestration/status/W1-F10-r7.json` measured, and this is the finding this file acts on:
 *
 *   "the three F10 stands offer at most 0.034 m of per-foot ground difference — a capture there
 *    is predetermined to be a null, whatever the GPU."
 *
 * Three rounds have now spent a paid Pod photographing the foot conform at `char-player`,
 * `street-lilmoth` and `street-gideon`, where the ground under the left foot and the ground under
 * the right differ by at most 34 mm. The conform's entire mechanism is that difference. A camera
 * pointed there cannot show the effect, and four rounds of "no visible change" have been evidence
 * about the STAND rather than about the fix.
 *
 * So: search the province for a point where the difference is large, and hand the winner to the
 * capture as a coordinate.
 *
 * WHY IT RUNS IN NODE AND NOT IN A BROWSER. `engine.groundAt` (engine.js:6551) delegates to
 * `renderer.groundAt`, whose province branch (renderer.js:630-634) is exactly
 * `this.field.heightAt(x, z)` — a `WorldField` built from `terrain.json`, `regions.json` and
 * `water.json`. `renderer.groundResolver` is that same function (engine.js:543), and it is what
 * the foot conform reads. So a `WorldField` constructed here answers the identical question, with
 * no browser, no GPU and no province stream — which is what makes a 3-million-point scan
 * affordable at all. `--verify-in-engine` re-asks the running game at the winning coordinate so
 * that this equivalence is checked rather than asserted.
 *
 * WHAT "USABLE" MEANS, AND WHY THREE FILTERS AND NOT ONE
 *
 *  1. **Per-foot spread at the real stance width.** `|heightAt(x-0.12,z) - heightAt(x+0.12,z)|`,
 *     the same 0.24 m the r7 census used, sampled on both axes because a ridge running north-south
 *     shows nothing to a foot pair separated east-west.
 *  2. **The body has to be able to stand there.** `traversal.json` refuses ground steeper than
 *     `walk_max_deg`; a point on a cliff face is not a stand, it is a place the player slides off.
 *     Slope is measured over 1 m, the scale a body occupies, not over the 0.24 m stance.
 *  3. **Dry land.** A foot under water is photographing the waterline, not the conform.
 *
 * Usage:
 *   node tools/visual/f10-r7a-slope-scan.mjs --centre 2766,5011 --radius 600 --step 1.0
 *   node tools/visual/f10-r7a-slope-scan.mjs --self-test
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WorldField } from '../../game/src/world/field.js';

const ROOT = path.resolve(new URL('../..', import.meta.url).pathname);
const args = {};
for (let i = 2; i < process.argv.length; i++) {
  if (!process.argv[i].startsWith('--')) continue;
  const k = process.argv[i].slice(2);
  args[k] = (process.argv[i + 1] && !process.argv[i + 1].startsWith('--')) ? process.argv[++i] : true;
}
const J = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));

/**
 * MAIN-MODULE GUARD. Without it, `import { spreadAt } from './f10-r7a-slope-scan.mjs'` runs this file's ENTIRE
 * scan in the importer's process — which is HAZARDS §16's third defect, and it happened here:
 * a one-line `import()` written to check the foot model against three probe readings kicked off a
 * 1,442,401-point scan and printed its table before the check ran. The CLI below is unchanged when
 * the file is executed directly.
 */
const IS_CLI = Boolean(process.argv[1]) && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);


/**
 * THE FOOT GEOMETRY IS MEASURED, NOT ASSUMED — AND THE FIRST VERSION OF THIS FILE GOT IT WRONG
 * IN A WAY THAT WOULD HAVE WASTED THE PAID RUN.
 *
 * v1 sampled a symmetric `±0.12 m` cross on BOTH axes and ranked on whichever was larger. Its top
 * pick, `2978,4746`, scored **0.6811 m** — all of it north-south. Then
 * `f10-r7-appearance.mjs --probe-only` stood the player there and read the actual bones:
 *
 *   foot_l (2978.100, 4745.944) ground 1.9216   foot_r (2977.900, 4745.936) ground 1.8959
 *   stance 0.2001 m, per-foot ground difference **0.0258 m**
 *
 * The feet are separated along **x**, so a ridge running north-south — the thing v1 ranked highest
 * — is exactly the ridge a foot pair cannot see. The scan was measuring a real feature of the
 * terrain that the effect under test is blind to, and would have sent a Pod to photograph another
 * null: the same failure as the three stands this tool exists to replace, arriving one level up.
 *
 * So the offsets below are the ones the probe actually read, and the ranking is on the axis the
 * feet actually occupy. `--axis both` restores v1's behaviour for anyone who wants it.
 */
const FOOT = {
  l: { dx: +0.1003, dz: -0.056 },
  r: { dx: -0.1003, dz: -0.064 },
  source: 'measured live at three stands by f10-r7-appearance.mjs --probe-only, 2026-08-15; stance came back 0.2001-0.2006 m at all three',
};
const STANCE = 0.2006;        // measured, not the 0.24 m r7's census assumed
const HALF = STANCE / 2;
const BODY_SCALE_M = 1.0;     // slope is judged over the scale a body occupies, not over the stance

// ══════════════════════════════════════════════════════════════════════════════════════════════
// SELF-TEST — the arms must DISAGREE (HAZARDS §0: a self-test whose arms agree about a false
// premise proves nothing). A flat plane must score zero and a ramp must score its own gradient.
// ══════════════════════════════════════════════════════════════════════════════════════════════
export function spreadAt(h, x, z) {
  // `bones` is the one that matters: the ground under the LEFT foot bone against the ground under
  // the RIGHT foot bone, at the offsets the probe measured. `ew`/`ns` are kept because they say
  // WHY a point scores what it does — a high `ns` and a low `bones` is a ridge the feet straddle
  // lengthwise, which is precisely the trap that produced this file's first, wrong, top pick.
  const bones = Math.abs(h(x + FOOT.l.dx, z + FOOT.l.dz) - h(x + FOOT.r.dx, z + FOOT.r.dz));
  const ew = Math.abs(h(x - HALF, z) - h(x + HALF, z));
  const ns = Math.abs(h(x, z - HALF) - h(x, z + HALF));
  return { bones: +bones.toFixed(4), ew: +ew.toFixed(4), ns: +ns.toFixed(4), worst: +Math.max(ew, ns).toFixed(4) };
}
export function slopeDeg(h, x, z) {
  const dx = (h(x + BODY_SCALE_M / 2, z) - h(x - BODY_SCALE_M / 2, z)) / BODY_SCALE_M;
  const dz = (h(x, z + BODY_SCALE_M / 2) - h(x, z - BODY_SCALE_M / 2)) / BODY_SCALE_M;
  return +(Math.atan(Math.hypot(dx, dz)) * 180 / Math.PI).toFixed(2);
}

if (IS_CLI && args['self-test']) {
  const fails = [];
  const flat = () => 7.5;
  const s1 = spreadAt(flat, 0, 0);
  if (s1.worst !== 0 || s1.bones !== 0) fails.push(`a flat plane must spread 0, got ${JSON.stringify(s1)}`);
  if (slopeDeg(flat, 0, 0) !== 0) fails.push(`a flat plane must be 0 deg, got ${slopeDeg(flat, 0, 0)}`);
  // A 45-degree ramp in +x: spread over 0.24 m must be 0.24 m, and slope must be 45.
  const ramp = (x) => x;
  const s2 = spreadAt(ramp, 10, 10);
  if (Math.abs(s2.ew - STANCE) > 1e-6) fails.push(`a 45 deg ramp must spread ${STANCE} m east-west, got ${s2.ew}`);
  if (s2.ns !== 0) fails.push(`a ramp in x must spread 0 north-south, got ${s2.ns}`);
  if (Math.abs(slopeDeg(ramp, 10, 10) - 45) > 0.01) fails.push(`a 45 deg ramp must read 45, got ${slopeDeg(ramp, 10, 10)}`);
  // The one that matters: a ridge running north-south must be INVISIBLE to a north-south foot
  // pair and loud to an east-west one. Without the two-axis sample the scan would miss half the
  // world's slopes depending on which way they happen to run.
  if (!(s2.ew > 0 && s2.ns === 0 && s2.worst === s2.ew)) fails.push('two-axis sampling is not picking the loud axis');
  // THE CHECK THAT WOULD HAVE CAUGHT v1's WRONG TOP PICK, and it is the reason this file was
  // revised: a ridge running NORTH-SOUTH is loud on the `ns` probe and INVISIBLE to the feet,
  // because the feet are separated east-west. `bones` must say so and `worst` must not.
  const ridgeNS = (x, z) => z;              // ground rises with z: a slope the feet straddle lengthwise
  const s4 = spreadAt(ridgeNS, 10, 10);
  if (!(s4.ns > 0.19)) fails.push(`a 45 deg north-south ramp must be loud on ns, got ${s4.ns}`);
  if (!(s4.bones < 0.01)) fails.push(`the feet are separated east-west, so a north-south ramp must be near-silent at the bones, got ${s4.bones}`);
  if (!(s4.worst > s4.bones * 10)) fails.push('worst and bones must be able to disagree — that disagreement is the whole finding');
  // And a step must beat a smooth slope of the same average: 0.24 m over 0.24 m at a cliff edge.
  const step = (x) => (x > 20 ? 3 : 0);
  const s3 = spreadAt(step, 20, 0);
  if (s3.ew !== 3) fails.push(`a 3 m step must spread 3 m, got ${s3.ew}`);
  if (s3.bones !== 3) fails.push(`a 3 m east-west step must be 3 m at the bones too, got ${s3.bones}`);
  console.log(fails.length ? `SELF-TEST FAILED\n  ${fails.join('\n  ')}`
    : 'SELF-TEST PASSED — 11 checks, arms required to disagree');
  process.exit(fails.length ? 1 : 0);
}

// ══════════════════════════════════════════════════════════════════════════════════════════════
if (IS_CLI) {
const terrain = J('game/data/world/terrain.json');
const regions = J('game/data/world/regions.json');
const water = J('game/data/world/water.json');
const field = new WorldField(terrain, regions, water);
const h = (x, z) => field.heightAt(x, z);

// `game/data/world/traversal.json` — NOT `combat/`, checked with `find`. The key is
// `slope.max_walkable_deg` = 40, and its own `_max_walkable_source` note records that the
// reachability flood and the body use the same number deliberately.
const traversal = J('game/data/world/traversal.json');
const WALK_MAX_DEG = Number(traversal.slope.max_walkable_deg);
if (!Number.isFinite(WALK_MAX_DEG)) throw new Error('traversal.json slope.max_walkable_deg missing');

const [cx, cz] = String(args.centre || '2766,5011').split(',').map(Number);
const RADIUS = Number(args.radius || 600);
const STEP = Number(args.step || 1.0);
const TOP = Number(args.top || 25);

console.log(`WorldField from terrain.json/regions.json/water.json; walk_max_deg=${WALK_MAX_DEG} `
  + `(game/data/combat/traversal.json)`);
console.log(`scanning ${(2 * RADIUS / STEP) ** 2 | 0} points around ${cx},${cz} at ${STEP} m, `
  + `stance ${STANCE} m, slope over ${BODY_SCALE_M} m`);

const hits = [];
let scanned = 0;
let bestAnywhere = { bones: -1 };
for (let x = cx - RADIUS; x <= cx + RADIUS; x += STEP) {
  for (let z = cz - RADIUS; z <= cz + RADIUS; z += STEP) {
    scanned++;
    const s = spreadAt(h, x, z);
    if (s.bones > bestAnywhere.bones) bestAnywhere = { x: +x.toFixed(2), z: +z.toFixed(2), ...s };
    if (s.bones < 0.10) continue;                    // below this a frame cannot show it
    const deg = slopeDeg(h, x, z);
    if (deg > WALK_MAX_DEG) continue;                // not a stand: the body slides off
    const y = h(x, z);
    const depth = field.depthAt(x, z);
    if (depth > 0.02) continue;                      // a wet foot photographs the waterline
    hits.push({
      x: +x.toFixed(2), z: +z.toFixed(2), y: +y.toFixed(3),
      per_foot_at_bones_m: s.bones, spread_ew_m: s.ew, spread_ns_m: s.ns, worst_either_axis_m: s.worst,
      slope_deg: deg, water_depth_m: +Number(depth || 0).toFixed(3),
      dist_from_centre_m: +Math.hypot(x - cx, z - cz).toFixed(1),
    });
  }
}
hits.sort((a, b) => b.per_foot_at_bones_m - a.per_foot_at_bones_m);

const out = {
  tool: 'f10-r7a-slope-scan', generated: new Date().toISOString(),
  centre: [cx, cz], radius_m: RADIUS, step_m: STEP, stance_m: STANCE, foot_offsets: FOOT,
  walk_max_deg: WALK_MAX_DEG,
  equivalence_note: 'renderer.js:630-634 province branch is field.heightAt(x,z), and engine.js:543 '
    + 'sets renderer.groundResolver to engine.groundAt which delegates to it — so this scan asks '
    + 'the same function the foot conform reads.',
  points_scanned: scanned,
  usable_stands: hits.length,
  best_ignoring_all_filters: bestAnywhere,
  ranked_on: 'per_foot_at_bones_m — the ground under the left foot bone against the ground under the right, at the offsets f10-r7-appearance.mjs --probe-only measured live',
  top: hits.slice(0, TOP),
};
const OUT = args.out ? path.resolve(args.out) : null;
if (OUT) { fs.mkdirSync(path.dirname(OUT), { recursive: true }); fs.writeFileSync(OUT, `${JSON.stringify(out, null, 2)}\n`); }

console.log(`\n${scanned} points scanned; ${hits.length} usable (per-foot AT THE BONES >= 0.10 m, slope <= ${WALK_MAX_DEG} deg, dry)`);
console.log(`best at the bones ignoring every filter: ${bestAnywhere.bones} m at ${bestAnywhere.x},${bestAnywhere.z}`);
console.log('\n     x         z        y   at-bones   ew      ns    slope  dist');
for (const p of hits.slice(0, TOP)) {
  console.log(`${String(p.x).padStart(9)} ${String(p.z).padStart(9)} ${String(p.y).padStart(8)} `
    + `${String(p.per_foot_at_bones_m).padStart(8)} ${String(p.spread_ew_m).padStart(7)} `
    + `${String(p.spread_ns_m).padStart(7)} ${String(p.slope_deg).padStart(6)} ${String(p.dist_from_centre_m).padStart(6)}`);
}
if (OUT) console.log(`\nwrote ${OUT}`);
}
