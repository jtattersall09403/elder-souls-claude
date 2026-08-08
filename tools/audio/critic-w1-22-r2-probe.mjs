#!/usr/bin/env node
// WRITTEN BY THE W1-22 ROUND-2 CRITIC (round-3 judgement). Declared under `method_deviations`.
//
// Two questions the shipped instruments do not ask, in ONE browser launch (rule 21).
//
// ============================================================================================
// P1 — IS THE `mute` VALIDITY CHECK A REFUSAL, OR AN ABSENCE WEARING A REFUSAL'S CLOTHES?
// ============================================================================================
// `tools/analysis/ambience-onsets.mjs` guards every subtraction in the tool with this, and the
// guard is the right idea — the whole measurement is `full - muted`, so if `mute` were ignored
// the residual would be silence and every level would be a fiction:
//
//     const a = await E.ambienceCapture({ region:'blackwood', seconds:4, sampleRate:8000, tod:'day' });
//     const b = await E.ambienceCapture({ ..., mute });
//     if (!ok || b.fired.length !== 0) { 'Refusing to report.'; exit(2) }
//
// It refuses when the MUTED arm still fires events. It never checks that the UNMUTED arm fired
// any. On the shipped tree the stored report records `mute_supported: {full: 0, muted: 0, ok: true}`
// — both arms empty — because 4 seconds is shorter than the shortest L3 interval band in the
// province, so no bed schedules an event in 4 s whatever `mute` does.
//
// A control whose two arms are both empty distinguishes nothing. This probe runs the guard's own
// call four ways and reports whether the refusal is REACHABLE:
//
//   a) shipped: 4 s, real mute      — what the tool does today
//   b) 4 s, NO-OP mute (bogus layer names that mute nothing)
//      If (a) and (b) agree, the guard cannot tell a working `mute` from a broken one.
//   c) long capture, real mute      — full > 0 and muted == 0: the guard now discriminates
//   d) long capture, NO-OP mute     — full > 0 and muted > 0: the guard now REFUSES, as designed
//
// (d) is the falsification handle. If (d) does not refuse, the guard is decorative at every
// duration. If (c) and (d) differ, the guard works and only its 4 s fixture was wrong.
//
// ============================================================================================
// P2 — CONSUMPTION (RI-MTH07 / ARBITRATION.md §3): DOES ANYTHING IN THE WORLD *READ* THE BED?
// ============================================================================================
// §3 requires a world-side consumer, demonstrated by perturbing the model and watching AN ENTITY
// CHANGE BEHAVIOUR. Rendering the perturbed bed and measuring that the render changed is the
// failure mode §3 names: a probe that calls a function measures the function.
//
// So the readout here is never audio. It is the simulation: `getStateHash()` over N stepped
// frames, plus every entity's position, plus the stealth/alert state — with the player WALKING,
// because a still target hides every steering defect (rule 8) and a sleeping sim would report
// "no change" for any perturbation at all.
//
// Three arms, same seed, same frame count, same scenario:
//   NULL      no perturbation                  -> establishes the run is reproducible at all
//   AMBIENCE  every bed layer's level_db to -60, every event_gain_db to 0, beds emptied
//   CONTROL   the stealth detection sound-radius table scaled                     (POSITIVE CONTROL)
//
// The CONTROL arm is the falsification handle and it is not optional. If perturbing a model that
// IS consumed also leaves the state hash untouched, this probe cannot see consumption and its
// reading on the ambience arm is worthless. A "no consumer" verdict is only admissible when the
// control arm moved.
//
//   node tools/audio/critic-w1-22-r2-probe.mjs [--frames 600] [--seconds 60] [--out <file>]
//
// Exit 0 = both probes produced a reading. 1 = a probe returned a defect-shaped answer.
// 2 = the build could not be driven, or the positive control failed and nothing is admissible.

import { writeFileSync, mkdirSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { launchGame } from '../lib/browser.mjs';
import { parseArgs, wantsHelp, usage } from '../lib/cli.mjs';

const USAGE = `
critic-w1-22-r2-probe.mjs — the W1-22 round-3 critic's two browser measurements.

  P1  is ambience-onsets.mjs's \`mute\` guard a reachable refusal or a vacuous control?
  P2  CONSUMPTION: does perturbing the ambience model change any entity's behaviour?
      (with a positive control that perturbs a model which IS consumed)

USAGE
  node tools/audio/critic-w1-22-r2-probe.mjs [--frames <n>] [--seconds <n>] [--out <file>]

Exit 0 = readings taken. 1 = a defect-shaped reading. 2 = undrivable, or the control failed.
`;

const args = parseArgs(process.argv.slice(2));
if (wantsHelp(args)) { usage(USAGE); process.exit(0); }
const FRAMES = Number(args.frames || 600);
const LONG_S = Number(args.seconds || 60);
const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..');

const out = {
  tool: 'tools/audio/critic-w1-22-r2-probe.mjs',
  taken_at: new Date().toISOString(),
  git: (() => {
    try {
      return { commit: execSync('git rev-parse --short HEAD', { cwd: ROOT }).toString().trim(),
               dirty: execSync('git status --porcelain', { cwd: ROOT }).toString().trim().length > 0 };
    } catch { return { commit: null, dirty: null }; }
  })(),
  frames: FRAMES, long_seconds: LONG_S,
  load_at_start: null,
  probes: {},
};
try { out.load_at_start = execSync('cat /proc/loadavg').toString().trim(); } catch { /* ignore */ }

const handle = await launchGame(args);
const { page } = handle;
let exitCode = 0;

try {
  // ------------------------------------------------------------------ P1: the refusal ---------
  const EVENT_MUTE = ['L3', 'L4', 'R7_strike'];
  const NOOP_MUTE = ['__no_such_layer_a', '__no_such_layer_b'];
  const p1 = await page.evaluate(async ({ real, noop, longS }) => {
    const E = window.__ENGINE;
    const cap = async (o) => {
      try {
        const r = await E.ambienceCapture(o);
        return { ok: !!r.ok, fired: (r.fired || []).length, why: r.why || null };
      } catch (e) { return { ok: false, fired: null, why: String(e && e.message || e) }; }
    };
    // (a) and (b) are the guard's own fixture, verbatim, with a real and a no-op mute.
    const a = await cap({ region: 'blackwood', seconds: 4, sampleRate: 8000, tod: 'day' });
    const a_m = await cap({ region: 'blackwood', seconds: 4, sampleRate: 8000, tod: 'day', mute: real });
    const b_m = await cap({ region: 'blackwood', seconds: 4, sampleRate: 8000, tod: 'day', mute: noop });
    // (c) and (d) are the same guard at a duration long enough for the bed to schedule anything.
    const c = await cap({ region: 'blackwood', seconds: longS, sampleRate: 8000, tod: 'day' });
    const c_m = await cap({ region: 'blackwood', seconds: longS, sampleRate: 8000, tod: 'day', mute: real });
    const d_m = await cap({ region: 'blackwood', seconds: longS, sampleRate: 8000, tod: 'day', mute: noop });
    return { short: { full: a, muted_real: a_m, muted_noop: b_m },
             long: { full: c, muted_real: c_m, muted_noop: d_m } };
  }, { real: EVENT_MUTE, noop: NOOP_MUTE, longS: LONG_S });

  // The guard's own predicate: it proceeds iff ok && muted.fired === 0.
  const guard = (full, muted) => (full.ok && muted.ok && muted.fired === 0);
  const shortReal = guard(p1.short.full, p1.short.muted_real);
  const shortNoop = guard(p1.short.full, p1.short.muted_noop);
  const longReal = guard(p1.long.full, p1.long.muted_real);
  const longNoop = guard(p1.long.full, p1.long.muted_noop);
  out.probes.P1_mute_guard = {
    raw: p1,
    guard_passes: { short_real_mute: shortReal, short_noop_mute: shortNoop,
                    long_real_mute: longReal, long_noop_mute: longNoop },
    short_arms_both_empty: p1.short.full.fired === 0 && p1.short.muted_real.fired === 0,
    // The defect: at the shipped 4 s fixture, a real mute and a mute that does nothing at all
    // produce the same verdict, so the guard cannot be failed by the thing it exists to catch.
    guard_is_vacuous_at_shipped_fixture: shortReal === shortNoop,
    // The handle: at a duration where the bed actually schedules events, the guard discriminates.
    guard_discriminates_when_given_events: longReal === true && longNoop === false,
    unmuted_arm_is_never_checked: true,
    what: 'ambience-onsets.mjs refuses to report when the MUTED arm still fires. It never checks '
      + 'that the UNMUTED arm fired anything, and at its 4 s fixture neither arm does — so the '
      + 'refusal is unreachable for the reason it exists. Remedy: assert full.fired > 0 as well, '
      + 'and size the fixture to the shortest interval band in the province.',
  };
  if (out.probes.P1_mute_guard.guard_is_vacuous_at_shipped_fixture) exitCode = 1;

  // ------------------------------------------------------------------ P2: CONSUMPTION ---------
  // One scenario, run three times from the same seed. The player WALKS and a guard is present,
  // so perception, motion and alert are all live and any consumer of the bed would have to show.
  const scenario = async (perturb) => page.evaluate(async (mode) => {
    const H = window.__HARNESS, E = window.__ENGINE;
    H.reset({ seed: 0xa3b1 });
    // Rebuild the perturbable models from a deep copy each run so arms cannot contaminate.
    const applied = { mode, changes: 0, note: null };
    if (mode === 'ambience') {
      // Perturb the AUDIO MODEL as hard as it can be perturbed without deleting it: every layer
      // inaudible, every corrective trim removed, every event list emptied.
      const beds = (E.data && E.data.ambience) || {};
      for (const bed of Object.values(beds)) {
        for (const L of Object.values(bed.layers || {})) {
          if (!L || typeof L !== 'object') continue;
          if (L.level_db !== undefined) { L.level_db = -60; applied.changes++; }
          if (L.event_gain_db !== undefined) { L.event_gain_db = 0; applied.changes++; }
          if (Array.isArray(L.events) && L.events.length) { L.events.length = 0; applied.changes++; }
        }
        if (Array.isArray(bed.emitters) && bed.emitters.length) { bed.emitters.length = 0; applied.changes++; }
        if (bed.bed_gain_db !== undefined) { bed.bed_gain_db = -60; applied.changes++; }
      }
    } else if (mode === 'control') {
      // POSITIVE CONTROL. Perturb a model the simulation demonstrably reads: the stealth
      // detection sound-radius table, which `sim/stealth/system.js` calls every step.
      const d = E.sim && E.sim.stealth && E.sim.stealth.d && E.sim.stealth.d.detection;
      const s = d && (d.sound || d.soundRadius || d);
      const scale = (o) => {
        if (!o || typeof o !== 'object') return;
        for (const [k, v] of Object.entries(o)) {
          if (typeof v === 'number') { o[k] = v * 8; applied.changes++; }
          else if (v && typeof v === 'object') scale(v);
        }
      };
      scale(s);
      if (!applied.changes) applied.note = 'could not reach the detection table';
    }
    // Drive the world. The player moves; a guard is present; perception is live.
    try { H.setPlayerMotion('walk'); } catch { /* not fatal */ }
    let guardId = null;
    try { const g = H.spawnGuard({}); guardId = (g && (g.id || g.entity)) || null; } catch { /* ok */ }
    const samples = [];
    const N = 6, per = Math.max(1, Math.floor(600 / N));
    for (let i = 0; i < N; i++) {
      H.stepFrames(per);
      let ents = [];
      try {
        ents = (H.listEntities() || []).map((e) => ({
          id: e.id, x: Math.round((e.pos ? e.pos[0] : e.x || 0) * 1000) / 1000,
          z: Math.round((e.pos ? e.pos[2] : e.z || 0) * 1000) / 1000,
          st: e.state || e.alert || null }));
      } catch { /* ok */ }
      let st = null;
      try { st = H.getStealthState(); } catch { /* ok */ }
      samples.push({
        hash: (() => { try { return H.getStateHash(); } catch { return null; } })(),
        n_ents: ents.length,
        ents,
        alert: st ? (st.alert !== undefined ? st.alert : (st.meter !== undefined ? st.meter : null)) : null,
        visible: st ? (st.visibility !== undefined ? st.visibility : null) : null,
      });
    }
    return { applied, guardId, samples };
  }, perturb);

  const nullArm = await scenario('null');
  const ambArm = await scenario('ambience');
  // Reload the page between the destructive arms so the control starts from clean data.
  await page.reload({ waitUntil: 'load' });
  await page.waitForFunction(() => !!(window.__HARNESS && window.__ENGINE), null, { timeout: 60000 });
  const nullArm2 = await scenario('null');
  const ctlArm = await scenario('control');

  const sig = (arm) => JSON.stringify(arm.samples.map((s) => [s.hash, s.ents, s.alert, s.visible]));
  const nullSig = sig(nullArm), nullSig2 = sig(nullArm2);
  const ambSig = sig(ambArm), ctlSig = sig(ctlArm);

  out.probes.P2_consumption = {
    reproducible: nullSig === nullSig2,
    ambience_perturbation_changes: ambArm.applied.changes,
    control_perturbation_changes: ctlArm.applied.changes,
    ambience_changed_the_world: ambSig !== nullSig,
    control_changed_the_world: ctlSig !== nullSig2,
    hashes: {
      null: nullArm.samples.map((s) => s.hash),
      ambience: ambArm.samples.map((s) => s.hash),
      null_rerun: nullArm2.samples.map((s) => s.hash),
      control: ctlArm.samples.map((s) => s.hash),
    },
    entities_seen: nullArm.samples.length ? nullArm.samples[0].n_ents : 0,
    admissible: null,
    verdict: null,
    what: 'ARBITRATION §3 CONSUMPTION. The ambience model is perturbed to inaudibility and the '
      + 'SIMULATION is read — state hash, entity positions, stealth alert — never the audio. The '
      + 'control arm perturbs the stealth detection table, a model the sim reads every step. A '
      + '"no consumer" reading is only admissible if the control arm moved.',
  };
  const p2 = out.probes.P2_consumption;
  p2.admissible = p2.reproducible && p2.control_changed_the_world && p2.control_perturbation_changes > 0;
  if (!p2.admissible) {
    p2.verdict = 'INADMISSIBLE — the positive control did not move, so this probe cannot see '
      + 'consumption and says nothing about the ambience model.';
    exitCode = 2;
  } else if (p2.ambience_changed_the_world) {
    p2.verdict = 'A WORLD-SIDE CONSUMER EXISTS — perturbing the bed changed the simulation.';
  } else {
    p2.verdict = 'NO WORLD-SIDE CONSUMER — the ambience model was perturbed to inaudibility '
      + `(${p2.ambience_perturbation_changes} fields) and every state hash, entity position and `
      + 'alert value over the run was identical, while the control arm moved.';
    exitCode = 1;
  }
} finally {
  try { await handle.close(); } catch { /* ignore */ }
}

const outPath = args.out ? String(args.out)
  : join(ROOT, 'reports', 'w1-22-critic', 'r2', 'critic-probe-r2-successor.json');
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, JSON.stringify(out, null, 2) + '\n');

const P1 = out.probes.P1_mute_guard, P2 = out.probes.P2_consumption;
if (P1) {
  console.log('P1  ambience-onsets.mjs `mute` guard');
  console.log(`      shipped 4 s fixture: full=${P1.raw.short.full.fired} muted_real=${P1.raw.short.muted_real.fired} `
    + `muted_noop=${P1.raw.short.muted_noop.fired}  -> guard passes real=${P1.guard_passes.short_real_mute} noop=${P1.guard_passes.short_noop_mute}`);
  console.log(`      ${LONG_S} s fixture:      full=${P1.raw.long.full.fired} muted_real=${P1.raw.long.muted_real.fired} `
    + `muted_noop=${P1.raw.long.muted_noop.fired}  -> guard passes real=${P1.guard_passes.long_real_mute} noop=${P1.guard_passes.long_noop_mute}`);
  console.log(`      VACUOUS AT SHIPPED FIXTURE: ${P1.guard_is_vacuous_at_shipped_fixture}   `
    + `DISCRIMINATES WHEN GIVEN EVENTS: ${P1.guard_discriminates_when_given_events}`);
}
if (P2) {
  console.log('P2  CONSUMPTION');
  console.log(`      reproducible=${P2.reproducible}  ambience fields perturbed=${P2.ambience_perturbation_changes}  `
    + `control fields perturbed=${P2.control_perturbation_changes}`);
  console.log(`      ambience changed the world=${P2.ambience_changed_the_world}  `
    + `control changed the world=${P2.control_changed_the_world}`);
  console.log(`      ${P2.verdict}`);
}
console.log(`  -> ${outPath.replace(ROOT + '/', '')}`);
process.exit(exitCode);
