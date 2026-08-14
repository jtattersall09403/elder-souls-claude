#!/usr/bin/env node
// W1-30D/E critic — an attack on the 3% silhouette guard in tools/visual/actor-hole-control.mjs.
//
// The builder's own two plausible cheats move the silhouette by -3.3% and +9.0%, and are caught.
// The shipped fix itself moves it by -2.9%. So the guard separates "a legitimate fix" from "delete
// a limb" by 0.4 percentage points, and its docstring justifies the 3% figure by citing -1.0% for
// "the whole of this build's change" — a number three times smaller than the one the build
// actually produces.
//
// The question this probe asks: is there a mutilation that improves the crack count and stays
// UNDER 3%? If yes, the guard is too loose and the crack metric can still be gamed.
//
// Three candidates, each a real thing a builder under pressure might do:
//   `hide-hand`     delete the left hand only. Hands are one of the two features the plan says a
//                   person looks at first. Small area, real loss.
//   `shrink-arm`    thin the whole left arm by 30% instead of deleting it. Seams close because the
//                   arm no longer touches anything; the character keeps four limbs.
//   `sink-crest`    bury the dorsal crest INSIDE the body so it stops reading at all. The crest
//                   was defect #2; hiding it is the cheap version of welding it.
'use strict';

import { cpSync, rmSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = '/home/user/elder-souls-claude';
const SUBSET = ['game/src', 'game/data/combat', 'game/vendor'];
const AREA_GUARD_PCT = 3;

const CONTROLS = {
  // STRENGTHENED. The first version removed only the PALM entry in the segment table and left the
  // three fingers and thumb, which are built in a separate loop — so the silhouette moved 0.00%
  // and the control proved nothing. HAZARDS.md §0: a control that fails to sabotage is
  // indistinguishable from a build that passes. This removes the whole left hand.
  'hide-hand': (s) => s
    .replace("  hand_l: { local: [0, -0.095, 0.012], r0: 0.055, r1: 0.042, mat: 'skin', blend: 0.4 },", '  // CRITIC CONTROL: palm gone')
    .replace("  hand_l: 'skin', hand_r: 'skin',", "  hand_r: 'skin',")
    .replace("for (const [id, sideSign] of [['hand_l',-1],['hand_r',1]]) {", "for (const [id, sideSign] of [['hand_r',1]]) {   // CRITIC CONTROL: left digits gone"),
  'hide-both-hands': (s) => s
    .replace("  hand_l: { local: [0, -0.095, 0.012], r0: 0.055, r1: 0.042, mat: 'skin', blend: 0.4 },", '  // CRITIC CONTROL')
    .replace("  hand_r: { local: [0, -0.095, 0.012], r0: 0.055, r1: 0.042, mat: 'skin', blend: 0.4 },", '  // CRITIC CONTROL')
    .replace("  hand_l: 'skin', hand_r: 'skin',", "")
    .replace("for (const [id, sideSign] of [['hand_l',-1],['hand_r',1]]) {", "for (const [id, sideSign] of []) {   // CRITIC CONTROL: both hands gone"),
  'debeak-head': (s) => s.replace(
    "      for (let k = 0; k < 3 && M.crest > 0.01; k++) {",
    "      for (let k = 0; k < 0 && M.crest > 0.01; k++) {   // CRITIC CONTROL: head crest plates gone"),
};

async function measure(root, opts) {
  const mod = await import(pathToFileURL(join(ROOT, 'tools/visual/actor-orbit-holes.mjs')).href);
  const { summary } = await mod.run({ root, res: opts.res, family: opts.family, poses: opts.poses,
    angles: opts.angles, distances: opts.distances, out: null, json: null, verbose: false });
  return summary;
}

function makeTree(label, patch) {
  const dir = join(process.env.ES_SCRATCH || tmpdir(), `w1-30de-critic-${label}-${process.pid}`);
  rmSync(dir, { recursive: true, force: true });
  for (const rel of SUBSET) {
    mkdirSync(join(dir, dirname(rel)), { recursive: true });
    cpSync(join(ROOT, rel), join(dir, rel), { recursive: true });
  }
  const p = join(dir, 'game/src/render/actor.js');
  const src = readFileSync(p, 'utf8');
  const out = patch(src);
  if (out === src) throw new Error(`control '${label}' patched nothing — anchor moved`);
  writeFileSync(p, out);
  return dir;
}

const opts = { res: 384, family: 'saxhleel', poses: 'default', angles: 8, distances: [1.5] };
const trees = [];
try {
  const now = await measure(ROOT, opts);
  console.log(`shipped build   : ${String(now.crackPx).padStart(6)} crack px, silhouette ${now.meanBodyPx} px`);
  for (const [label, patch] of Object.entries(CONTROLS)) {
    const dir = makeTree(label, patch);
    trees.push(dir);
    const s = await measure(dir, opts);
    const drift = 100 * (s.meanBodyPx - now.meanBodyPx) / now.meanBodyPx;
    const improves = s.crackPx <= now.crackPx;
    const caught = Math.abs(drift) > AREA_GUARD_PCT;
    console.log(`${label.padEnd(16)}: ${String(s.crackPx).padStart(6)} crack px `
      + `(${improves ? 'IMPROVES' : 'worsens'} the metric), silhouette ${s.meanBodyPx} px `
      + `(${drift >= 0 ? '+' : ''}${drift.toFixed(2)}%) — ${caught ? 'caught' : 'NOT CAUGHT'}`
      + `${improves && !caught ? '  <<< ESCAPES THE GUARD' : ''}`);
  }
} finally {
  for (const d of trees) rmSync(d, { recursive: true, force: true });
}
void HERE; void resolve;
