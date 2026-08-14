#!/usr/bin/env node
// W1-30D — the null controls for `actor-orbit-holes.mjs`, run against patched SOURCE TREES.
//
// WHY A SEPARATE TREE AND NOT A FLAG. A control that lives inside the instrument tests the
// instrument's own branch, not the build. `actor-orbit-holes --sabotage=...` is refused for that
// reason. This tool makes a real copy of the source, edits `render/actor.js` in it, and runs the
// unmodified instrument against the copy. What comes back is what would come back if somebody had
// actually committed that mistake.
//
// COST. It copies `game/src`, `game/data/combat` and `game/vendor` — about 7 MB — not the whole
// repository. HAZARDS.md §5 records that null-control clones have been copying 1.2 GB when a
// control needs 76 MB; the disk is the reason this is a file list and not `cp -r .`. Every copy is
// removed on exit, including on failure.
//
// THE SIX CONTROLS, and why these six. The first four must go RED; the last two must be CAUGHT by
// the silhouette guard while the crack count is flat or improving — those are the plausible wrong
// answers, not the trivial ones.
//
//   `break-joints`    put back the rule this build replaced: every joint ball a hair UNDER its
//                     limb. Must go red.
//   `unbed-belt`      put the belt back at 3 mm clearance from the waist. Must go red.
//   `refloat-crest`   lift the dorsal crest back off the back, where it used to hover. Must go red.
//   `unweld-tail`     put the tail root back on the surface of the pelvis instead of inside it.
//                     Must go red.
//   `hide-arm`        THE PLAUSIBLE WRONG ANSWER, and the one that matters. Delete the whole left
//                     arm. Crack pixels fall and the character loses a limb. If a green crack count
//                     were accepted on its own, this would read as an improvement. It is caught by
//                     the silhouette-area guard, not by the crack count.
//   `weld-arm-to-rib` the other plausible wrong answer: close every gap by fattening the torso
//                     until it swallows the arms. Cracks fall, area RISES, the character stops
//                     reading as a person. Same guard, opposite direction.
'use strict';

import { cpSync, rmSync, mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../..');
const SUBSET = ['game/src', 'game/data/combat', 'game/vendor'];

const CONTROLS = {
  // The shoulder alone was NOT the biggest hole — the shoulder-scale plate covers it — so this
  // control shrinks every joint ball back under its limb, which is the rule the fix replaced.
  'break-joints': (s) => s.replace(
    'function jointRadius(id) {\n  let r = 0;',
    'function jointRadius(id) {\n  let r = 0;\n  return ({upperarm_l:.080,upperarm_r:.080,lowerarm_l:.068,lowerarm_r:.068,hand_l:.052,hand_r:.052,thigh_l:.106,thigh_r:.106,calf_l:.086,calf_r:.086})[id] || 0;   // NULL CONTROL: the pre-fix table'),
  // NO LONGER ISOLATES, AND THAT IS RECORDED RATHER THAN TUNED AWAY.
  //
  // When the belt WAS the dominant remaining crack, this control went red as required (230 px
  // against 214). After the later morph work — which scales presentation offsets with `build` —
  // it comes back GREEN: 139 px against 178. The mechanism is not that the belt fix was wrong, it
  // is that at a residual of ~178 px across 640 frames the metric is near its floor, and a belt
  // standing proud of the waist is a large extra surface that merges or opens neighbouring pockets
  // for reasons unrelated to the seam it used to have. A single-variable control stops isolating
  // once the variable it moves is no longer the biggest thing in the frame.
  //
  // Left in, and left FAILING, because deleting it would remove the evidence that the crack metric
  // has a floor, and tuning it green would be the exact move this file exists to prevent.
  'unbed-belt': (s) => s.replace(
    "new THREE.TorusGeometry(.178,heavy?.050:.042,6,18)",
    "new THREE.TorusGeometry(.205,heavy?.035:.024,6,18)   /* NULL CONTROL: the 3 mm-clearance belt */"),
  'refloat-crest': (s) => s.replace(
    "    for (const [bi, a, b, r0, r1] of crest) {",
    "    for (const [bi, a, b, r0, r1] of crest.map(c=>[c[0],[c[1][0],c[1][1],c[1][2]-0.14],[c[2][0],c[2][1],c[2][2]-0.14],c[3],c[4]])) {   // NULL CONTROL: crest lifted back off the body\n"),
  'unweld-tail': (s) => s.replace(
    '[T(0, 0.010, -0.045), T(0, -0.10, -0.36), 0.115, 0.068],',
    '[T(0, 0.02, -0.13), T(0, -0.10, -0.36), 0.085, 0.068],   // NULL CONTROL: tail root back on the surface'),
  // The first version of this control removed only the upper-arm TUBE and moved the silhouette by
  // 0.8% — the shoulder ball, the shoulder plate and the forearm covered the hole, so the control
  // proved nothing. A control that fails to sabotage is indistinguishable from a build that passes.
  // It now removes the whole left arm chain, which is what "hide it instead of fixing it" means.
  'hide-arm': (s) => s
    .replace("  upperarm_l: { to: 'lowerarm_l', r0: 0.094, r1: 0.075, mat: 'skin', blend: 0.45 },", '  // NULL CONTROL')
    .replace("  lowerarm_l: { to: 'hand_l', r0: 0.075, r1: 0.058, mat: 'skin', blend: 0.45 },", '  // NULL CONTROL')
    .replace("  hand_l: { local: [0, -0.095, 0.012], r0: 0.055, r1: 0.042, mat: 'skin', blend: 0.4 },", '  // NULL CONTROL')
    .replace("  clavicle_l: { to: 'upperarm_l', r0: 0.105, r1: 0.088, mat: 'cloth', blend: 0.5 },", '  // NULL CONTROL')
    .replace('  upperarm_l: \'skin\', upperarm_r: \'skin\',', '  upperarm_r: \'skin\',')
    .replace('  lowerarm_l: \'skin\', lowerarm_r: \'skin\',', '  lowerarm_r: \'skin\',')
    .replace('  hand_l: \'skin\', hand_r: \'skin\',', '  hand_r: \'skin\','),
  'weld-arm-to-rib': (s) => s.replace(
    '[.228*M.build*M.shoulders,.20*M.build,.142*M.build]',
    '[.400*M.build*M.shoulders,.34*M.build,.300*M.build]   /* NULL CONTROL: swallow the arms */'),
  'baseline-head': (s) => s,   // handled specially: actor.js replaced from a git blob
};

async function measure(root, opts) {
  const mod = await import(pathToFileURL(join(ROOT, 'tools/visual/actor-orbit-holes.mjs')).href);
  const { summary } = await mod.run({ root, res: opts.res, family: opts.family, poses: opts.poses,
    angles: opts.angles, distances: opts.distances, out: null, json: null, verbose: false });
  return summary;
}

function makeTree(label, patch) {
  const dir = join(process.env.ES_SCRATCH || tmpdir(), `w1-30d-control-${label}-${process.pid}`);
  rmSync(dir, { recursive: true, force: true });
  for (const rel of SUBSET) {
    mkdirSync(join(dir, dirname(rel)), { recursive: true });
    cpSync(join(ROOT, rel), join(dir, rel), { recursive: true });
  }
  const p = join(dir, 'game/src/render/actor.js');
  const src = readFileSync(p, 'utf8');
  const out = patch(src);
  if (out === src) throw new Error(`control '${label}' patched nothing — its anchor text has moved. `
    + 'A control that silently fails to sabotage is worse than no control: fix the anchor.');
  writeFileSync(p, out);
  return dir;
}

/**
 * THE SILHOUETTE GUARD, and why 3% and not 8%.
 *
 * Welding a seam moves the outline of a character by, at most, the width of the seam. It cannot
 * plausibly change the area of the silhouette by a percent. Removing a limb, or fattening the
 * torso until it swallows the arms, changes it by several. 3% sits well above the noise of a
 * genuine seam fix (measured: -1.0% for the whole of this build's change) and well below the
 * cheapest way of gaming the crack count. It is the number that makes "improve the metric by
 * deleting the thing being measured" fail instead of pass.
 */
const AREA_GUARD_PCT = 3;

const opts = { res: 384, family: 'saxhleel', poses: 'smoke', angles: 12, distances: [1.5, 4], only: null, baselineRef: null };
for (const a of process.argv.slice(2)) {
  const [k, v] = a.replace(/^--/, '').split('=');
  if (k === 'res') opts.res = Number(v);
  else if (k === 'family') opts.family = v;
  else if (k === 'poses') opts.poses = v;
  else if (k === 'angles') opts.angles = Number(v);
  else if (k === 'distances') opts.distances = v.split(',').map(Number);
  else if (k === 'only') opts.only = v.split(',');
  else if (k === 'baseline-ref') opts.baselineRef = v;
}

const trees = [];
let failed = 0;
try {
  const now = await measure(ROOT, opts);
  console.log(`current build       : ${String(now.crackPx).padStart(6)} crack px, `
    + `${String(now.framesWithCracks).padStart(4)}/${now.frames} frames, mean silhouette ${now.meanBodyPx} px`);

  if (opts.baselineRef) {
    const { execFileSync } = await import('node:child_process');
    const blob = execFileSync('git', ['show', `${opts.baselineRef}:game/src/render/actor.js`], { cwd: ROOT, encoding: 'utf8' });
    const dir = makeTree('baseline', () => blob);
    trees.push(dir);
    const b = await measure(dir, opts);
    console.log(`baseline ${opts.baselineRef.padEnd(11)}: ${String(b.crackPx).padStart(6)} crack px, `
      + `${String(b.framesWithCracks).padStart(4)}/${b.frames} frames, mean silhouette ${b.meanBodyPx} px`);
    const areaDrift = 100 * (now.meanBodyPx - b.meanBodyPx) / b.meanBodyPx;
    console.log(`  -> crack px ${b.crackPx} -> ${now.crackPx}; silhouette area drift ${areaDrift.toFixed(1)}%`);
    if (Math.abs(areaDrift) > AREA_GUARD_PCT) {
      console.log(`  !! SILHOUETTE DRIFT > ${AREA_GUARD_PCT}%: the character changed size, not just its seams. Not a clean fix.`);
      failed++;
    }
  }

  for (const [label, patch] of Object.entries(CONTROLS)) {
    if (label === 'baseline-head') continue;
    if (opts.only && !opts.only.includes(label)) continue;
    const dir = makeTree(label, patch);
    trees.push(dir);
    const s = await measure(dir, opts);
    const areaDrift = 100 * (s.meanBodyPx - now.meanBodyPx) / now.meanBodyPx;
    const shouldGoRed = ['break-joints', 'unbed-belt', 'refloat-crest', 'unweld-tail'].includes(label);
    let verdict;
    if (shouldGoRed) verdict = s.crackPx > now.crackPx ? 'RED as required' : 'CONTROL DID NOT GO RED — the check is not measuring what it claims';
    else verdict = Math.abs(areaDrift) > AREA_GUARD_PCT ? 'CAUGHT by silhouette guard' : 'NOT CAUGHT — the guard is too loose';
    if (/DID NOT|NOT CAUGHT/.test(verdict)) failed++;
    console.log(`${label.padEnd(20)}: ${String(s.crackPx).padStart(6)} crack px, `
      + `${String(s.framesWithCracks).padStart(4)}/${s.frames} frames, silhouette ${s.meanBodyPx} px `
      + `(${areaDrift >= 0 ? '+' : ''}${areaDrift.toFixed(1)}%) — ${verdict}`);
  }
} finally {
  for (const d of trees) rmSync(d, { recursive: true, force: true });
}
console.log(failed === 0 ? 'controls: ALL BEHAVED AS DECLARED' : `controls: ${failed} MISBEHAVED`);
process.exit(failed === 0 ? 0 : 1);
