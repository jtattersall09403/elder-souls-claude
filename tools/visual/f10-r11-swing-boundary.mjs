#!/usr/bin/env node
/**
 * f10-r11-swing-boundary.mjs — DOES THE CHARACTER STEP UP 8 MM WHEN IT SWINGS?
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * WHY THIS EXISTS — HAZARDS §20d, and the half of it nobody has closed
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 *
 * F10 r9 gave the character a contrapposto; r10 found it stood the figure 7.96 mm off the floor
 * and compensated with `idle_ready.root_offset.y = -0.00796`, hand-authoring the same value onto
 * the phase-0 and phase-3 endpoints of **six** attack archetypes so the idle→attack boundary did
 * not step. `tools/harness/anim-tune.mjs` measures that boundary for **14** rows and reads
 * `snapIn 0.0000` on all of them.
 *
 * **BUT THE FOURTEEN ARE NOT THE POPULATION.** The archetypes in `game/data/combat/clips.json`
 * are the spine classes. Every weapon the player can actually hold resolves through
 * `MovesetLibrary.clipFor`, which builds its clip at RUNTIME with `swing.js buildSwing()` from
 * `game/data/weapons/clip-registry.json`. Enumerated by this tool, by command, at run time —
 * the count is in the report and is not carried from anywhere.
 *
 * `swing.js:327-341` authors that clip's `rootY` from **hard-coded literals**: `[0.0, 0.0]` at
 * phase 0 and `[3.0, -0.01 + cr*0.25]` at phase 3, with no stance term in the expression. The
 * r10 critic re-derived this after r10 filed the mechanism wrongly as a rounding-precision
 * problem (`r2()` rounds to THREE decimals, not two, so `-0.008` would have survived it fine),
 * and its ruling is that **only a value change can fix it**. This is that value change, measured.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * WHAT IT MEASURES
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 *
 *   A. the stance height the character is standing at   — `stanceRootOffsetY(idle_ready, 0, 1.0)`
 *   B. every registry clip's `rootY` at phase 0 and phase 3, built through the SHIPPED
 *      `buildSwing`, in two arms: `stanceRootY` absent (the shipped behaviour) and supplied
 *   C. the BOUNDARY STEP — |clip rootY at phase 0 − the idle's own root offset| — which is the
 *      vertical pop a player sees the instant an attack begins, per clip
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * SELF-TEST ARMS — required to disagree
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 *
 *   1. **BLINDNESS.** With `stanceRootY` omitted the phase-0 value must be EXACTLY 0 on every
 *      clip (the pre-round-11 behaviour); supplied, it must equal the value supplied. A reader
 *      that returned a constant would fail one of the two.
 *   2. **INJECTION.** A known non-zero `stanceRootY` must arrive at phase 0 to the digit, and
 *      must NOT alter the interior keys (phases cockP, 1.0, 2.0, 2.0+folP) — the authored crouch
 *      is somebody else's quantity and this must not touch it.
 *   3. **THE r10 DIAGNOSIS, TESTED RATHER THAN QUOTED.** `r2()` must round to three decimals and
 *      must carry −0.00796 through as −0.008. If r10's "two decimal places" had been right this
 *      arm goes red and the whole approach is wrong.
 *   4. **THE STANCE VALUE IS READ, NOT ASSUMED.** The idle offset must come out of
 *      `clips.json` through the SHIPPED `stanceRootOffsetY`, not from a literal in this file.
 *
 * Usage:
 *   node tools/visual/f10-r11-swing-boundary.mjs --self-test
 *   node tools/visual/f10-r11-swing-boundary.mjs --json=out.json
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../..');
const args = {};
for (const a of process.argv.slice(2)) {
  if (!a.startsWith('--')) continue;
  const [k, v] = a.slice(2).split('=');
  args[k] = v === undefined ? true : v;
}

const { buildSwing, r2 } = await import(pathToFileURL(join(ROOT, 'game/src/combat/swing.js')).href);
const { stanceRootOffsetY } = await import(pathToFileURL(join(ROOT, 'game/src/combat/clips.js')).href);
const clips = JSON.parse(readFileSync(join(ROOT, 'game/data/combat/clips.json'), 'utf8'));
const registry = JSON.parse(readFileSync(join(ROOT, 'game/data/weapons/clip-registry.json'), 'utf8'));

/** A. the height the character is standing at, read off the shipped data through the shipped fn. */
const IDLE_ROOT_Y = stanceRootOffsetY(clips.archetypes.idle_ready, 0, 1.0);

/** Phase-`p` value of a built swing's root_offset.y curve, by exact key lookup (no resampling). */
function keyAt(arch, p) {
  const c = (arch.root_offset && arch.root_offset.y) || [];
  for (const [ph, v] of c) if (Math.abs(ph - p) < 1e-9) return v;
  return null;
}

const clipIds = Object.keys(registry.clips);

function census(stanceRootY) {
  const rows = [];
  for (const id of clipIds) {
    const reg = registry.clips[id];
    if (!reg || !reg.profile) continue;
    const opts = { yawGain: 1, accGain: 1 };
    if (stanceRootY !== undefined) opts.stanceRootY = stanceRootY;
    const arch = buildSwing(reg.profile, opts);
    const p0 = keyAt(arch, 0);
    const p3 = keyAt(arch, 3);
    rows.push({ id, phase0: p0, phase3: p3, boundary_step_m: p0 === null ? null : +Math.abs(p0 - IDLE_ROOT_Y).toFixed(6) });
  }
  return rows;
}

if (args['self-test']) {
  const results = [];
  const off = census(undefined);
  const on = census(IDLE_ROOT_Y);
  results.push({
    arm: '1a with stanceRootY OMITTED every registry clip starts at EXACTLY 0 (the shipped pre-r11 curve; a reader that invents signal fails here)',
    ok: off.length > 0 && off.every((r) => r.phase0 === 0), n: off.length,
    distinct_phase0: [...new Set(off.map((r) => r.phase0))],
  });
  results.push({
    arm: '1b with it SUPPLIED every clip starts at the supplied value (a blind reader fails here)',
    ok: on.length > 0 && on.every((r) => r.phase0 === r2(IDLE_ROOT_Y)),
    supplied: IDLE_ROOT_Y, distinct_phase0: [...new Set(on.map((r) => r.phase0))],
  });
  // 2 — INJECTION, and the interior must not move.
  const probe = registry.clips[clipIds[0]];
  const a0 = buildSwing(probe.profile, { yawGain: 1, accGain: 1 });
  const a1 = buildSwing(probe.profile, { yawGain: 1, accGain: 1, stanceRootY: -0.0123 });
  const interior = (a) => ((a.root_offset && a.root_offset.y) || []).filter(([p]) => p > 1e-9 && Math.abs(p - 3) > 1e-9).map(([, v]) => v);
  results.push({
    arm: '2a an injected -0.0123 arrives at phase 0 to the digit', ok: keyAt(a1, 0) === r2(-0.0123),
    want: r2(-0.0123), got: keyAt(a1, 0),
  });
  results.push({
    arm: '2b the INTERIOR keys are byte-identical — the authored crouch is not this change\'s to move',
    ok: JSON.stringify(interior(a0)) === JSON.stringify(interior(a1)),
    interior_off: interior(a0), interior_on: interior(a1),
  });
  // 3 — r10's filed mechanism, tested rather than quoted.
  results.push({
    arm: '3 r2() rounds to THREE decimals and carries -0.00796 through as -0.008 (r10 filed TWO decimals; if r10 were right this arm goes red and a value change could not work)',
    ok: r2(-0.00796) === -0.008 && r2(0.0004) === 0, r2_of_minus_0_00796: r2(-0.00796), r2_of_0_0004: r2(0.0004),
  });
  // 4 — the stance value is read off the data, not a literal here.
  const mutated = JSON.parse(JSON.stringify(clips.archetypes.idle_ready));
  mutated.root_offset = { y: [[0, -0.05], [3, -0.05]] };
  results.push({
    arm: '4 the idle offset comes from clips.json through the SHIPPED stanceRootOffsetY — mutating the data moves it',
    ok: stanceRootOffsetY(mutated, 0, 1.0) === -0.05 && IDLE_ROOT_Y !== -0.05,
    shipped: IDLE_ROOT_Y, mutated: stanceRootOffsetY(mutated, 0, 1.0),
  });
  // 5 — THE SHIPPED PATH, not the function under it. Arms 1-4 exercise `buildSwing` directly and
  // would all stay green if nothing ever passed it the term — which is exactly the state the
  // quarantined round 11 work was recovered in, and exactly the shape of `RI-MTH07`'s consumption
  // defect: a correct rule with no caller. This arm builds a `MovesetLibrary` the way
  // `combat/system.js` does and reads the clip the GAME would play.
  const { MovesetLibrary } = await import(pathToFileURL(join(ROOT, 'game/src/combat/moveset.js')).href);
  // The same loader every combat tool in this repo uses, so the data is the game's data.
  const { loadCombatData } = await import(pathToFileURL(join(ROOT, 'tools/lib/combat-node.mjs')).href);
  const data = loadCombatData();
  const movesets = data.weaponMovesets;
  const mk = (s) => new MovesetLibrary(data.clipRegistry, data.weaponClasses, movesets, data.skeleton, data.hitgeometry, s);
  const libOld = mk(undefined);
  const libNew = mk(IDLE_ROOT_Y);
  const wid = Object.keys(movesets)[0];
  const sid = Object.keys(movesets[wid].slots)[0];
  const cOld = libOld.clipFor(wid, sid);
  const cNew = libNew.clipFor(wid, sid);
  results.push({
    arm: '5 the SHIPPED MovesetLibrary path carries the term into the clip the game plays (arms 1-4 pass even when NOTHING calls buildSwing with it — this is the arm that catches an unwired fix)',
    ok: cOld.rootOffsetYAt(0) === 0 && cNew.rootOffsetYAt(0) === r2(IDLE_ROOT_Y),
    weapon: wid, slot: sid,
    frame0_without: cOld.rootOffsetYAt(0), frame0_with: cNew.rootOffsetYAt(0),
  });

  // 6 — PRESERVATION (S59). WHAT COULD THIS HAVE TRADED AWAY, and the answer is measured over the
  // whole registry rather than argued from the key list. The one thing 1,160 clips carry that
  // this must not move is the ACTIVE window — `RI-CMB04` §B's `peak_tip_speed_mps` is solved over
  // it, `calibrateExcursion` damps against it, and `_bladeLength` reads it. The curve's keys at
  // phase 1.0 and 2.0 bracket that band and neither is touched, so the claim is that the sampled
  // curve is IDENTICAL inside it. Sampled at 601 points instead of asserted.
  const { sampleCurve } = await import(pathToFileURL(join(ROOT, 'game/src/combat/clips.js')).href);
  let maxAll = 0; let maxActive = 0; let maxStep = 0;
  for (const id of clipIds) {
    const reg = registry.clips[id];
    if (!reg || !reg.profile) continue;
    const a = buildSwing(reg.profile, { yawGain: 1, accGain: 1 }).root_offset.y;
    const b = buildSwing(reg.profile, { yawGain: 1, accGain: 1, stanceRootY: IDLE_ROOT_Y }).root_offset.y;
    let prev = null;
    for (let i = 0; i <= 600; i++) {
      const p = (3 * i) / 600;
      const d = Math.abs(sampleCurve(a, p) - sampleCurve(b, p));
      if (d > maxAll) maxAll = d;
      if (p >= 1 && p <= 2 && d > maxActive) maxActive = d;
      if (prev !== null) maxStep = Math.max(maxStep, Math.abs(d - prev));
      prev = d;
    }
  }
  results.push({
    arm: '6 PRESERVATION — the ACTIVE window (phase 1.0..2.0, where peak_tip_speed and the blade solve live) is sampled IDENTICALLY in both arms over all 1,160 clips',
    ok: maxActive === 0,
    max_delta_active_window_m: maxActive,
    max_delta_anywhere_m: +maxAll.toFixed(6),
    max_delta_change_per_1_600th_phase_m: +maxStep.toExponential(3),
    reading: 'the 8 mm lives entirely in the anticipation and the settle, ramps in over the whole startup, and is exactly 0 across the band every combat instrument measures',
  });

  const pass = results.every((r) => r.ok);
  console.log(JSON.stringify({ tool: 'f10-r11-swing-boundary --self-test', results, pass }, null, 2));
  process.exit(pass ? 0 : 1);
}

const off = census(undefined);
const on = census(IDLE_ROOT_Y);
const summarise = (rows) => {
  const steps = rows.map((r) => r.boundary_step_m).filter((v) => v !== null);
  return {
    n: rows.length,
    distinct_phase0: [...new Set(rows.map((r) => r.phase0))],
    distinct_phase3: [...new Set(rows.map((r) => r.phase3))].length,
    boundary_step_m: { max: Math.max(...steps), min: Math.min(...steps), over_1mm: steps.filter((v) => v > 0.001).length },
  };
};
const out = {
  tool: 'tools/visual/f10-r11-swing-boundary.mjs',
  generated: new Date().toISOString(),
  enumerating_command: "JSON.parse(game/data/weapons/clip-registry.json).clips -> Object.keys",
  registry_clip_count_field: registry.clip_count,
  registry_clips_enumerated: clipIds.length,
  idle_stance_root_offset_y_m: IDLE_ROOT_Y,
  idle_source: 'game/data/combat/clips.json archetypes.idle_ready.root_offset.y, sampled by the SHIPPED stanceRootOffsetY at phase 0, weight 1.0',
  arm_shipped_no_stance_term: summarise(off),
  arm_with_stance_term: summarise(on),
  what_the_step_is: 'the vertical distance the character\'s root jumps at the instant an attack begins, because the idle stands at the stance offset and the swing clip starts at its own phase-0 value',
};
const dest = args.json === true || !args.json ? null : resolve(ROOT, String(args.json));
if (dest) { mkdirSync(dirname(dest), { recursive: true }); writeFileSync(dest, `${JSON.stringify({ ...out, rows_shipped: off, rows_with_term: on }, null, 2)}\n`); }
console.log(JSON.stringify(out, null, 2));
