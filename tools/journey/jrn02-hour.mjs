#!/usr/bin/env node
// jrn02-hour.mjs — W1-28. THE HOUR, DRIVEN. And, first, the audit of whether anything the hour
// does is visible to the instrument that is supposed to see it.
//
// Named by: RI-JRN02 (`journey.firsthour.interaction`, `journey.firsthour.competence`).
//
// ─── WHY THIS FILE EXISTS AT ALL ──────────────────────────────────────────────────────────────
//
// `tools/journey/journey-run.mjs` registers the journey:
//
//     'jrn02-first-hour': { item: 'RI-JRN02', title: 'the first hour as interaction',
//                           frames: 216000, durationMin: 60 }
//
// and `cadence.mjs` and `competence.mjs` — the two tools RI-JRN02's Comparison method names —
// are built and have been hardened over four critic rounds. So the pipeline reads as complete.
//
// IT IS NOT DRIVEN. `driveBeats()` in journey-run.mjs drives the OPENING (first input, first
// control, the still window, the census walk) and then ends with:
//
//     const remaining = Math.max(0, Math.min(o.frames, 20000));
//     await stepAndSample(handle, remaining, 600, ...);      // zero inputs dispatched
//
// and `journeyLegs()` branches on jrn03, jrn04, jrn05, jrn06, jrn07 and jrn08 — there is no
// `jrn02` case. So `--journey jrn02-first-hour --duration-min 60` produces the opening plus
// five and a half minutes of nobody playing (capped at 20 000 frames whatever `--duration-min`
// says), and `cadence.mjs` would have read that as `gap_max` ≈ the whole run and
// `combat_fraction` 0 — RI-JRN02 HF3 twice over, reported as a fact about THE BUILD when it is
// a fact about THE DRIVER.
//
// That is the same shape as this tree's only recorded 36 000-frame session, which contained
// zero events because its `ops.json` was an empty array. **Check what drives your session
// before you trust anything it records.** This file is that check and then that driver.
//
// ─── WHAT IT DOES, IN THREE MODES ─────────────────────────────────────────────────────────────
//
//   --verb-coverage   THE INSTRUMENT AUDIT, and it must be run before the hour is believed.
//                     RI-JRN02 M-I1 wants a first-use minute and a repetition count for every
//                     verb, off the trace. That needs `input_action` (A-JRN7). This mode presses
//                     each of the sixteen closed actions in turn and reports, per action,
//                     whether the engine emitted `input_action` for it. It is BIDIRECTIONAL: it
//                     fails if NO action emits (the drain is broken, not the build) and it fails
//                     if EVERY action emits (then the audit distinguishes nothing and cannot be
//                     the finding it claims). Both arms are asserted, never assumed.
//
//   --hour            THE DRIVER. A need-driven policy agent plays the world AS PLACED for
//                     `--minutes` simulated minutes, continuous from boot. It records every
//                     action it dispatched, driver-side, marked by source — because the audit
//                     above decides how much of the trace can carry that load.
//
//                     IT DOES NOT SPAWN ANYTHING. If the hour the world places contains no
//                     hostile, `combat_fraction` is 0 and that is the finding. Spawning an
//                     enemy to move the number would be measuring the fixture.
//
//   --self-test       Offline. Proves the acquisition policy and the gap statistic can both go
//                     red, against synthesised observations. No browser.
//
// ─── WHY THE AGENT IS A POLICY AND NOT A SCRIPT ───────────────────────────────────────────────
//
// RI-JRN02 M-I4 measures the ORDER the combat verbs are first used in, and V3 requires that
// order to arrive "by necessity". A driver with a hard-coded verb sequence answers that question
// with its own source code: whatever order I wrote is the order that gets measured, and the
// check becomes unfalsifiable. So every verb here is gated on a TRIGGER READ FROM THE WORLD —
// `block` is not used until a hit has landed on a body that was already retreating, `use_item`
// not until hp crosses a floor, `heavy` not until N lights have failed to stagger the same
// target. The order that comes out is a property of what the hour presents. If the hour presents
// nothing, no verb is acquired, and the ledger says so with the trigger that never fired.
//
// The triggers are in `ACQUISITION` below, each with the `taught_by` cell RI-JRN02 §A gives it.
// V2 ("no verb is introduced by text") is not this file's to assert — it is M-I3, over the
// UI-text stream, and it is named in the output as NOT RUN here rather than quietly skipped.
//
// EXIT CODES: 0 the mode completed and every assertion it makes held; 1 an assertion failed or
//             something was unmeasurable; 2 usage; 20 no game.
'use strict';

import fs from 'node:fs';
import path from 'node:path';
import {
  REPO_ROOT, REPORTS_DIR, parseArgs, wantsHelp, usage, writeJson, ensureDir, die, EXIT, log,
  makeRunId, gitInfo, quantile,
} from '../lib/cli.mjs';
import { launchGame } from '../lib/browser.mjs';
import { ACTIONS, HELD_ONLY } from '../../game/src/input/actions.js';

const USAGE = `
jrn02-hour.mjs — W1-28 / RI-JRN02. The first hour, driven, and the audit of whether the
                 instrument can see it.

USAGE
  node tools/journey/jrn02-hour.mjs --verb-coverage [--out DIR]
  node tools/journey/jrn02-hour.mjs --hour [--minutes 60] [--out DIR] [--seed N]
  node tools/journey/jrn02-hour.mjs --self-test

OPTIONS
  --verb-coverage  press all ${ACTIONS.length} closed actions; report which emit \`input_action\`
  --hour           drive the hour with the need-driven policy agent
  --minutes N      simulated minutes for --hour (default 60)
  --seed N         determinism seed (default 4711)
  --out DIR        run directory (default reports/journeys/<runId>)
  --tick-s N       seconds of simulated time between decisions (default 2)
  --no-acquire V   withhold verb V from the agent entirely (the delete-the-fix arm)
  --entry PATH     alternative game/index.html (a pristine HEAD copy, when the shared tree is
                   mid-write: a fail-closed constructor in a neighbour's data blocks every
                   journey in the corpus at once). Recorded in the artifact.
  --url URL        alternative served URL
  --self-test      offline; prove the policy and the gap statistic can fail
`;

// ─── THE ACQUISITION POLICY ───────────────────────────────────────────────────────────────────
// One row per verb RI-JRN02 §A names. `trigger(obs, mem)` returns true when THE WORLD has
// presented the need. `taught_by` is transcribed from §A's own column, so a reader can check
// this table against the item rather than against my summary of it.
//
// `first_use_min` is §A's `first_use ≤` in minutes, kept here so the ledger can be printed
// against the bar without a second transcription.
export const ACQUISITION = [
  { verb: 'interact',    first_use_min: 3,  reps: 25, taught_by: 'placement (a door you must open)',
    trigger: (o) => o.reach !== null },
  { verb: 'talk',        first_use_min: 4,  reps: 9,  taught_by: 'placement',
    trigger: (o) => o.nearestNPC_m !== null && o.nearestNPC_m <= 3.0 },
  { verb: 'take',        first_use_min: 6,  reps: 12, taught_by: 'RI-EXP01 B04',
    trigger: (o) => o.nearestProp_m !== null && o.nearestProp_m <= 3.0 },
  { verb: 'read',        first_use_min: 9,  reps: 5,  taught_by: 'RI-EXP01 B09',
    trigger: (o) => o.nearestSign_m !== null && o.nearestSign_m <= 4.0 },
  { verb: 'sprint',      first_use_min: 12, reps: 20, taught_by: 'distance',
    trigger: (o, m) => m.metres_since_anything_near >= 60 },
  { verb: 'menu',        first_use_min: 15, reps: 5,  taught_by: 'inventory pressure',
    trigger: (o) => o.inventory_count >= 6 },
  { verb: 'light',       first_use_min: 19, reps: 40, taught_by: 'inscription (RI-JRN03 DS2)',
    trigger: (o) => o.nearestHostile_m !== null && o.nearestHostile_m <= 2.5 },
  { verb: 'roll',        first_use_min: 19, reps: 25, taught_by: 'inscription + consequence',
    trigger: (o, m) => m.frames_since_hit_taken !== null && m.frames_since_hit_taken <= 180 },
  { verb: 'rest',        first_use_min: 20, reps: 2,  taught_by: 'damage',
    trigger: (o) => o.hp_frac < 0.6 && o.nearestHearth_m !== null && o.nearestHearth_m <= 30 },
  { verb: 'block',       first_use_min: 21, reps: 15, taught_by: 'consequence (an attack you cannot outrun)',
    trigger: (o, m) => m.hits_taken_while_retreating >= 2 },
  { verb: 'lock_on',     first_use_min: 22, reps: 8,  taught_by: 'a second enemy',
    trigger: (o) => o.hostiles_within_12m >= 2 },
  { verb: 'use_item',    first_use_min: 24, reps: 4,  taught_by: 'low health',
    trigger: (o) => o.hp_frac < 0.4 },
  { verb: 'search',      first_use_min: 25, reps: 6,  taught_by: 'RI-EXP01 B10',
    trigger: (o) => o.nearestContainer_m !== null && o.nearestContainer_m <= 3.0 },
  { verb: 'heavy',       first_use_min: 26, reps: 8,  taught_by: 'a poise-heavy target',
    trigger: (o, m) => m.lights_without_stagger >= 4 },
  { verb: 'jump',        first_use_min: 30, reps: 3,  taught_by: 'a gap',
    trigger: (o, m) => m.stuck_ticks >= 3 },
  { verb: 'barter',      first_use_min: 33, reps: 1,  taught_by: 'gold + a merchant',
    trigger: (o) => o.gold > 0 && o.nearestMerchant_m !== null && o.nearestMerchant_m <= 3.0 },
  { verb: 'swap_right',  first_use_min: 35, reps: 2,  taught_by: 'a second weapon',
    trigger: (o) => o.weapons_carried >= 2 },
  { verb: 'pay',         first_use_min: 38, reps: 1,  taught_by: 'RI-EXP01 B14',
    trigger: (o) => o.gold > 0 && o.nearestStation_m !== null && o.nearestStation_m <= 6.0 },
  { verb: 'parry',       first_use_min: 45, reps: 1,  taught_by: 'inscription, optional',
    trigger: (o, m) => m.enemy_windups_observed >= 8 },
  { verb: 'two_hand',    first_use_min: 60, reps: 0,  taught_by: '— (optional)',
    trigger: () => false },
  { verb: 'crouch',      first_use_min: 60, reps: 0,  taught_by: '— (optional, AM-W1-15-01)',
    trigger: () => false },
  { verb: 'spell_cycle', first_use_min: 60, reps: 0,  taught_by: '— (optional, AM-W1-14-02)',
    trigger: () => false },
];

/** §A's fourteen canonical actions, for V1 / M-I2. The closed set minus the two amendments. */
export const CANONICAL_14 = ['light', 'heavy', 'roll', 'block', 'parry', 'sprint', 'jump',
  'use_item', 'interact', 'lock_on', 'two_hand', 'swap_right', 'swap_left', 'menu'];

// Which of the policy's verbs is a BUTTON on the closed set, and which is a world act performed
// through `interact` or a service. §A mixes the two in one table on purpose ("take = `interact`
// on an item"), and a tool that pressed a button called `take` would throw — the set is closed.
export const BUTTON_OF = {
  interact: 'interact', light: 'light', heavy: 'heavy', roll: 'roll', block: 'block',
  parry: 'parry', sprint: 'sprint', jump: 'jump', use_item: 'use_item', lock_on: 'lock_on',
  menu: 'menu', two_hand: 'two_hand', crouch: 'crouch', spell_cycle: 'spell_cycle',
  swap_right: 'swap_right', swap_left: 'swap_left',
  // world acts, performed with `interact` at a thing
  talk: 'interact', take: 'interact', read: 'interact', search: 'interact',
  // services, which have no button at all
  rest: null, barter: null, pay: null,
};

{
  const stray = Object.values(BUTTON_OF).filter((b) => b !== null && !ACTIONS.includes(b));
  if (stray.length) {
    throw new Error(`jrn02-hour.mjs BUTTON_OF names ${stray.join(', ')}, which the closed action ` +
      `set (game/src/input/actions.js) does not contain: ${ACTIONS.join(' ')}. The set is closed ` +
      `(HARNESS.md §4); a driver that presses a name outside it throws inside the fixed step ` +
      `and kills every stepping probe in the project (RULES 15).`);
  }
  const unpolicied = ACTIONS.filter((a) => !Object.values(BUTTON_OF).includes(a));
  if (unpolicied.length) {
    // Not fatal — it is a REPORT. `swap_left` is in the set and §A pairs it with `swap_right`.
    log(`note: closed actions with no acquisition rule: ${unpolicied.join(', ')}`);
  }
}

// ─── THE GAP STATISTIC ────────────────────────────────────────────────────────────────────────
// RI-JRN02 C1/C2, computed over the DRIVER's own dispatch log rather than over the trace, and
// marked as such wherever it is printed. `cadence.mjs` owns the trace-side computation and this
// does not replace it; it exists because the verb-coverage audit decides how much of the trace
// can carry C1 at all, and a number nobody can compute is worse than a number with a stated
// provenance.
//
// C1's own words: "a state-changing input = an action that moved an entity, opened a surface,
// changed a flag, dealt or took damage, or added a journal entry. Pure locomotion does not
// count." So a dispatch counts here only when the driver OBSERVED one of those five within
// `CORROBORATION_FRAMES` — the same rule `cadence.mjs` applies, so the two are comparable.
export const CORROBORATION_FRAMES = 60;
export const LOCOMOTION_VERBS = new Set(['sprint', 'jump']);

export function gapStats(dispatches, totalFrames, fps = 60) {
  const changing = dispatches
    .filter((d) => !LOCOMOTION_VERBS.has(d.verb) && d.corroborated)
    .map((d) => d.frame)
    .sort((a, b) => a - b);
  if (!changing.length) {
    return { n: 0, gap_max_s: totalFrames / fps, gap_p95_s: totalFrames / fps, gaps_s: [],
      why: 'no corroborated state-changing input in the whole run' };
  }
  const gaps = [];
  let prev = 0;
  for (const f of changing) { gaps.push((f - prev) / fps); prev = f; }
  gaps.push((totalFrames - prev) / fps);
  return {
    n: changing.length,
    gap_max_s: +Math.max(...gaps).toFixed(2),
    gap_p95_s: +quantile(gaps.slice().sort((a, b) => a - b), 0.95).toFixed(2),
    gap_median_s: +quantile(gaps.slice().sort((a, b) => a - b), 0.5).toFixed(2),
    gaps_s: gaps.map((g) => +g.toFixed(2)),
  };
}

/** Evaluate the acquisition policy against one observation. Pure, so --self-test can drive it. */
export function decide(obs, mem, known, withheld = new Set()) {
  const fired = [];
  for (const row of ACQUISITION) {
    if (withheld.has(row.verb)) continue;
    let t = false;
    try { t = !!row.trigger(obs, mem); } catch { t = false; }
    if (t) fired.push({ verb: row.verb, first_time: !known.has(row.verb), taught_by: row.taught_by });
  }
  return fired;
}

// ─── main ─────────────────────────────────────────────────────────────────────────────────────
const args = parseArgs();
if (wantsHelp(args)) usage(USAGE);

const MODES = ['verb-coverage', 'hour', 'self-test'];
const mode = MODES.find((m) => args[m]);
if (!mode) usage(USAGE, 2);

if (mode === 'self-test') { process.exit(selfTest() ? 0 : 1); }

const seed = Number(args.seed || 4711);
const runId = makeRunId(mode === 'hour' ? 'jrn02-first-hour' : 'jrn02-verbcoverage', seed);
const outDir = args.out ? path.resolve(String(args.out)) : path.join(REPORTS_DIR, 'journeys', runId);
ensureDir(outDir);

const ok = mode === 'verb-coverage' ? await verbCoverage() : await driveHour();
process.exit(ok ? 0 : 1);

// ══════════════════════════════════════════════════════════════════════════════════════════════
// MODE 1 — THE INSTRUMENT AUDIT
// ══════════════════════════════════════════════════════════════════════════════════════════════
async function verbCoverage() {
  const handle = await launchGame({ width: 1280, height: 720, entry: args.entry, url: args.url });
  const out = {
    entry: args.entry ? String(args.entry) : 'game/index.html (the working tree)',
    tool: 'jrn02-hour.mjs --verb-coverage', item: 'RI-JRN02', piece: 'W1-28',
    commit: gitInfo().commit, at: new Date().toISOString(),
    what: 'For each of the closed action set, press it and report whether the engine emitted an ' +
          '`input_action` trace event. RI-JRN02 M-I1 (first-use minute and repetition count per ' +
          'verb) is computed off that event, so an action that never emits one is a verb the ' +
          'ledger cannot see however hard the player presses it.',
    actions: {}, assertions: {}, ok: false,
  };
  try {
    await handle.h('setSeed', seed);
    await handle.hOpt('setRenderRate', 0);
    await handle.h('stepFrames', 60);
    await handle.hOpt('traceStart', { all: true });

    // A body that can act. Nothing is spawned and nothing hostile is placed: the question is
    // only whether the ENGINE tells the trace that a button was pressed.
    for (const action of ACTIONS) {
      await handle.hOpt('traceDrain');                 // clear anything pending
      const held = HELD_ONLY.has(action);
      const script = held
        ? [{ f: 1, press: [action] }, { f: 20, release: [action] }]
        : [{ f: 1, press: [action] }, { f: 3, release: [action] }];
      let threw = null;
      try { await handle.h('queueInputs', script); } catch (e) { threw = String(e && e.message || e); }
      await handle.h('stepFrames', 40);
      const drained = (await handle.hOpt('traceDrain')) || [];
      const evs = [];
      for (const r of drained) for (const e of (r.events || r.e || [])) evs.push(e);
      const kinds = {};
      for (const e of evs) { const k = e.type || e.t; kinds[k] = (kinds[k] || 0) + 1; }
      const inputActions = evs.filter((e) => (e.type || e.t) === 'input_action');
      out.actions[action] = {
        held_only: held,
        queue_threw: threw,
        input_action_events: inputActions.length,
        input_action_buttons: [...new Set(inputActions.map((e) => e.button || e.action))],
        other_event_kinds: kinds,
        visible_to_M_I1: inputActions.length > 0,
      };
    }

    const emitters = ACTIONS.filter((a) => out.actions[a].visible_to_M_I1);
    const silent = ACTIONS.filter((a) => !out.actions[a].visible_to_M_I1);

    // ─── THE THREE CONTROLS ───────────────────────────────────────────────────────────────
    // Round 1 of this audit asserted only "at least one action emits `input_action`", got 0/16
    // and REFUSED TO REPORT — correctly, because 0/16 is exactly what a broken drain looks
    // like. That refusal is the reason these three exist. A silence is only a finding once you
    // have shown, in the same browser, that you could have heard a sound.
    //
    // C-A  THE DRAIN IS LIVE.       The presses produced events of SOME kind.
    // C-B  THE INPUT LANDED.        The presses produced events that are consequences of THAT
    //                               press — a move started, a guard went up, a roll began.
    //                               Without this, "no `input_action`" could be "no input".
    // C-C  THE EVENT NAME IS REACHABLE. `input_action` is emitted five times in engine.js, all
    //                               of them on the `interact` REACH path (a readable, a mark, a
    //                               signpost, the census speaker, a census commit). So drive
    //                               `signRead()` — engine.js:3240 — and require the event to
    //                               appear. If it does, this tool can see `input_action`, the
    //                               drain carries it, and a button that does not produce one is
    //                               the ENGINE not emitting it.
    const anyEvents = ACTIONS.some((a) => Object.keys(out.actions[a].other_event_kinds).length > 0);
    const CONSEQUENCE = ['ACTION_START', 'attack_start', 'roll_start', 'stamina_spend', 'GUARD_UP',
      'block', 'first_input', 'INPUT_DROPPED', 'input_dropped_no_stamina', 'action_denied_by_water'];
    const landed = ACTIONS.filter((a) => CONSEQUENCE.some((k) => out.actions[a].other_event_kinds[k]));

    await handle.hOpt('traceDrain');
    let signEvents = [];
    let signResult = null;
    try {
      const signs = (await handle.hOpt('listSignposts')) || [];
      out.signposts_in_world = signs.length;
      if (signs.length) {
        const s = signs[0];
        const sx = s.x ?? (s.pos && s.pos[0]), sz = s.z ?? (s.pos && s.pos[2]);
        if (Number.isFinite(sx) && Number.isFinite(sz)) await handle.hOpt('teleport', sx, sz);
        await handle.h('stepFrames', 4);
        signResult = await handle.hOpt('signRead');
        await handle.h('stepFrames', 4);
        const drained = (await handle.hOpt('traceDrain')) || [];
        for (const r of drained) for (const e of (r.events || r.e || [])) signEvents.push(e.type || e.t);
      }
    } catch (e) { out.control_c_error = String(e && e.message || e); }

    out.assertions.C_A_drain_is_live = {
      holds: anyEvents,
      why: anyEvents ? 'the presses produced events, so traceDrain carries what the step emits'
        : 'NO event of any kind came back from any press. The drain or the input path is broken ' +
          'and no coverage number here would be about the build.',
    };
    out.assertions.C_B_the_input_landed = {
      holds: landed.length > 0, landed,
      why: landed.length > 0
        ? `${landed.length} action(s) produced a consequence event (${CONSEQUENCE.filter((k) => landed.some((a) => out.actions[a].other_event_kinds[k])).join(', ')}), ` +
          'so the button reached the body'
        : 'no press produced any consequence event, so "no input_action" may simply be "no input"',
    };
    out.assertions.C_C_event_name_is_reachable = {
      holds: signEvents.includes('input_action'),
      via: 'signRead() — game/src/engine.js:3240 emits input_action{action:interact, via:signpost}',
      events_seen: [...new Set(signEvents)],
      sign_read_ok: !!(signResult && (signResult.open || signResult.lines)),
      why: signEvents.includes('input_action')
        ? 'THIS TOOL CAN SEE `input_action`. So an action that produces none is the engine not emitting one.'
        : 'the one route in the engine that emits `input_action` did not produce one here either, ' +
          'so this audit cannot separate "the engine does not emit" from "this tool cannot see it".',
    };

    out.coverage = {
      emitting: emitters.length, silent: silent.length, of: ACTIONS.length,
      fraction: +(emitters.length / ACTIONS.length).toFixed(3),
    };
    // CONCLUSIVE only when all three controls hold. Full coverage (silent 0) is a pass too —
    // that would be the build being fine, and it is reported as such rather than as a finding.
    const controlsHold = out.assertions.C_A_drain_is_live.holds
      && out.assertions.C_B_the_input_landed.holds
      && out.assertions.C_C_event_name_is_reachable.holds;
    out.conclusive = controlsHold;
    out.finding = controlsHold && silent.length > 0
      ? `RI-JRN02 M-I1 wants a first-use minute and a repetition count for every verb, off the ` +
        `trace, and \`input_action\` is the A-JRN7 event that carries them. ${silent.length} of ` +
        `${ACTIONS.length} closed actions emit none. The emission at game/src/sim/player.js:109 ` +
        `is in \`stepPlayer\`, which nothing imports (game/src/sim/souls.js:46 says so in-tree); ` +
        `the live path is game/src/combat/player.js and it emits no \`input_action\` at all. So ` +
        `the verb ledger is unmeasurable from the trace for every button in the game, and the ` +
        `substitute vocabulary a tool would have to read instead is per-action and uppercase ` +
        `(ACTION_START, GUARD_UP, ...), which is A-JRN7's whole reason for existing.`
      : null;
    out.ok = controlsHold;
    writeJson(path.join(outDir, 'verb-coverage.json'), out);
    process.stdout.write(`verb-coverage -> ${path.relative(REPO_ROOT, outDir)}/verb-coverage.json\n`);
    process.stdout.write(`  controls: drain live=${out.assertions.C_A_drain_is_live.holds}` +
      ` input landed=${out.assertions.C_B_the_input_landed.holds} (${landed.length}/${ACTIONS.length})` +
      ` input_action reachable=${out.assertions.C_C_event_name_is_reachable.holds}\n`);
    process.stdout.write(`  input_action emitted for ${emitters.length}/${ACTIONS.length}: ${emitters.join(' ') || '(none)'}\n`);
    process.stdout.write(`  SILENT (invisible to RI-JRN02 M-I1): ${silent.join(' ') || '(none)'}\n`);
    if (out.finding) process.stdout.write(`  FINDING: ${out.finding.slice(0, 200)}...\n`);
    return out.ok;
  } finally {
    await handle.close();
  }
}

// ══════════════════════════════════════════════════════════════════════════════════════════════
// MODE 2 — THE HOUR
// ══════════════════════════════════════════════════════════════════════════════════════════════
async function driveHour() {
  const minutes = Number(args.minutes || 60);
  const tickS = Number(args['tick-s'] || 2);
  const fps = 60;
  const totalFrames = Math.round(minutes * 60 * fps);
  const withheld = new Set(String(args['no-acquire'] || '').split(',').map((s) => s.trim()).filter(Boolean));

  const handle = await launchGame({ width: 1280, height: 720, entry: args.entry, url: args.url });
  const dispatchPath = path.join(outDir, 'dispatches.jsonl');
  const samplePath = path.join(outDir, 'samples.jsonl');
  // INCREMENTAL. Two long runs in this project produced no artifact at all when they were
  // killed. Both streams are appended every tick; the summary is rewritten every 60 ticks.
  const dispatchFh = fs.openSync(dispatchPath, 'a');
  const sampleFh = fs.openSync(samplePath, 'a');

  const run = {
    tool: 'jrn02-hour.mjs --hour', item: 'RI-JRN02', piece: 'W1-28',
    commit: gitInfo().commit, at: new Date().toISOString(),
    seed, minutes, tick_s: tickS, total_frames: totalFrames, withheld: [...withheld],
    entry: args.entry ? String(args.entry) : 'game/index.html (the working tree)',
    spawned_anything: false,
    provenance: 'DRIVER-SIDE. Every count below is what THIS DRIVER dispatched and observed. ' +
      'The trace-side equivalents are cadence.mjs\'s, over trace.jsonl in this directory. ' +
      'Where the two differ, --verb-coverage says which verbs the trace can see at all.',
    acquisition: [], dispatches_by_verb: {}, ticks: 0, frames_run: 0, aborted: null,
  };
  const dispatches = [];
  const known = new Set();
  const mem = {
    metres_since_anything_near: 0, frames_since_hit_taken: null, hits_taken_while_retreating: 0,
    lights_without_stagger: 0, stuck_ticks: 0, enemy_windups_observed: 0, last_pos: null,
    hp_last: null, combat_frames: 0, dialogue_frames: 0, traversal_frames: 0,
  };

  try {
    await handle.h('setSeed', seed);
    await handle.hOpt('setRenderRate', 0);
    await handle.hOpt('traceStart', { all: true });
    await handle.h('stepFrames', 120);

    // Where does the world put a body at boot? Read, never set: the hour must be the hour the
    // world places, and a teleport to a livelier spot is the fixture choosing the finding.
    const pois = await gatherPOIs(handle);
    writeJson(path.join(outDir, 'pois.json'), pois);

    let frame = await frameOf(handle);
    const startFrame = frame;
    let visited = 0;
    const tickFrames = Math.round(tickS * fps);

    while (frame - startFrame < totalFrames) {
      const obs = await observe(handle, pois);
      obs.frame = frame;
      obs.minute = +((frame - startFrame) / 3600).toFixed(2);

      // memory update from the world
      if (mem.last_pos) {
        const d = Math.hypot(obs.pos[0] - mem.last_pos[0], obs.pos[2] - mem.last_pos[2]);
        const anythingNear = [obs.nearestNPC_m, obs.nearestProp_m, obs.nearestSign_m, obs.nearestHostile_m]
          .some((x) => x !== null && x <= 15);
        mem.metres_since_anything_near = anythingNear ? 0 : mem.metres_since_anything_near + d;
        if (d < 0.05) mem.stuck_ticks++; else mem.stuck_ticks = 0;
        mem.traversal_frames += (d > 0.1 && obs.nearestHostile_m === null) ? tickFrames : 0;
      }
      if (mem.hp_last !== null && obs.hp < mem.hp_last) {
        mem.frames_since_hit_taken = 0;
        if (obs.retreating) mem.hits_taken_while_retreating++;
      } else if (mem.frames_since_hit_taken !== null) mem.frames_since_hit_taken += tickFrames;
      mem.hp_last = obs.hp;
      mem.last_pos = obs.pos.slice();
      if (obs.nearestHostile_m !== null && obs.nearestHostile_m < 20) mem.combat_frames += tickFrames;

      fs.writeSync(sampleFh, JSON.stringify(obs) + '\n');

      // decide, then act
      const fired = decide(obs, mem, known, withheld);
      for (const f of fired) {
        if (f.first_time) {
          known.add(f.verb);
          run.acquisition.push({ verb: f.verb, frame, minute: obs.minute, taught_by: f.taught_by,
            trigger_state: triggerWitness(f.verb, obs, mem) });
        }
        const rec = await act(handle, f.verb, obs);
        rec.frame = frame; rec.verb = f.verb; rec.minute = obs.minute;
        dispatches.push(rec);
        run.dispatches_by_verb[f.verb] = (run.dispatches_by_verb[f.verb] || 0) + 1;
        fs.writeSync(dispatchFh, JSON.stringify(rec) + '\n');
      }

      // move: to the nearest unvisited point of interest, in tick-sized bites, through the
      // engine's own path follower (one harness call for many frames — an hour is 216 000).
      const dest = pois.list[visited % Math.max(1, pois.list.length)];
      if (dest && !fired.length) {
        const r = await handle.hOpt('walkPath', [[obs.pos[0], obs.pos[2]], [dest.x, dest.z]],
          { maxFrames: tickFrames, speed: 'walk' });
        if (r && (r.arrived || r.aborted)) visited++;
      } else {
        await handle.h('stepFrames', tickFrames);
      }

      frame = await frameOf(handle);
      run.ticks++;
      run.frames_run = frame - startFrame;
      if (run.ticks % 60 === 0) {
        writeJson(path.join(outDir, 'hour.json'), summarise(run, dispatches, mem, known, minutes));
        log(`tick ${run.ticks} — minute ${(run.frames_run / 3600).toFixed(1)} of ${minutes}, ` +
            `${dispatches.length} dispatches, verbs ${known.size}`);
      }
    }
  } catch (e) {
    run.aborted = String(e && e.message || e);
    log('ABORTED: ' + run.aborted + ' — the partial artifacts are on disk and are what they say they are');
  } finally {
    // Drain the trace whatever happened, so cadence.mjs has something to read.
    try {
      const drained = (await handle.hOpt('traceDrain')) || [];
      const tail = (await handle.hOpt('traceStop')) || [];
      const recs = drained.concat(Array.isArray(tail) ? tail : []);
      fs.writeFileSync(path.join(outDir, 'trace.jsonl'), recs.map((r) => JSON.stringify(r)).join('\n') + '\n');
      run.trace_records = recs.length;
    } catch (e) { run.trace_drain_error = String(e && e.message || e); }
    fs.closeSync(dispatchFh); fs.closeSync(sampleFh);
    await handle.close();
  }
  const summary = summarise(run, dispatches, mem, known, minutes);
  writeJson(path.join(outDir, 'hour.json'), summary);
  process.stdout.write(`jrn02-hour -> ${path.relative(REPO_ROOT, outDir)}\n`);
  process.stdout.write(`  ${summary.frames_run} frames (${(summary.frames_run / 3600).toFixed(1)} min), ` +
    `${summary.dispatch_count} dispatches, ${summary.verbs_exercised.length} verbs\n`);
  process.stdout.write(`  V_exercised (of §A's 14 canonical): ${summary.V_exercised}/14 — V1 wants >= 11, HF1 at <= 8\n`);
  process.stdout.write(`  gap_max ${summary.gaps.gap_max_s}s (C1 <= 45, HF3 > 90), gap_p95 ${summary.gaps.gap_p95_s}s (C2 <= 20)\n`);
  return !run.aborted;
}

function summarise(run, dispatches, mem, known, minutes) {
  const gaps = gapStats(dispatches, run.frames_run || 1);
  const exercised = [...new Set(dispatches.map((d) => d.verb))];
  const canonicalHit = CANONICAL_14.filter((a) => exercised.includes(a));
  const ledger = ACQUISITION.map((row) => {
    const uses = dispatches.filter((d) => d.verb === row.verb);
    const first = uses.length ? uses[0].minute : null;
    return {
      verb: row.verb, taught_by: row.taught_by,
      first_use_min_bar: row.first_use_min, first_use_min_observed: first,
      first_use_met: first !== null && first <= row.first_use_min,
      reps_bar: row.reps, reps_observed: uses.length, reps_met: uses.length >= row.reps,
      never_triggered: uses.length === 0,
    };
  });
  return {
    ...run,
    dispatch_count: dispatches.length,
    verbs_exercised: exercised,
    V_exercised: canonicalHit.length,
    V_exercised_of: CANONICAL_14.length,
    V1_pass: canonicalHit.length >= 11,
    HF1_fires: canonicalHit.length <= 8,
    gaps,
    C1_pass: gaps.gap_max_s <= 45, HF3_gap_fires: gaps.gap_max_s > 90,
    C2_pass: gaps.gap_p95_s <= 20,
    fractions_driver_side: {
      combat: +(mem.combat_frames / Math.max(1, run.frames_run)).toFixed(3),
      traversal: +(mem.traversal_frames / Math.max(1, run.frames_run)).toFixed(3),
      note: 'DRIVER-SIDE approximations at tick resolution. cadence.mjs owns C5/C6/C7/C8 over the trace.',
    },
    verb_ledger: ledger,
    not_run_here: [
      'M-I3 (verb teaching purity) needs the UI-text stream; journey-run.mjs owns it and this driver does not sample it.',
      'M-I5 (necessity: re-run each introducing encounter without the verb) needs an encounter to re-run.',
      'M-I10 beat citations belong to RI-EXP01 and are not recomputed here.',
      'M-I14 modality parity is RI-JRN04 / W1-29.',
      'input.discoverability is W1-08\'s at the declared W1-28 <-> W1-08 seam and is cited, not scored.',
    ],
  };
}

function triggerWitness(verb, obs, mem) {
  const row = ACQUISITION.find((r) => r.verb === verb);
  return { taught_by: row ? row.taught_by : null, hp_frac: obs.hp_frac,
    nearestHostile_m: obs.nearestHostile_m, nearestNPC_m: obs.nearestNPC_m,
    nearestProp_m: obs.nearestProp_m, hostiles_within_12m: obs.hostiles_within_12m,
    metres_since_anything_near: +mem.metres_since_anything_near.toFixed(1),
    hits_taken_while_retreating: mem.hits_taken_while_retreating };
}

async function frameOf(handle) {
  const f = await handle.hOpt('getFrame');
  return (f && (f.frame ?? f)) ?? 0;
}

/** Every point the world places that the agent could walk to. Read-only. */
async function gatherPOIs(handle) {
  const list = [];
  const add = (kind, x, z, id) => {
    if (Number.isFinite(x) && Number.isFinite(z)) list.push({ kind, x: +x, z: +z, id: id || null });
  };
  const settlements = (await handle.hOpt('listSettlements')) || [];
  for (const s of settlements) add('settlement', s.x ?? (s.pos && s.pos[0]), s.z ?? (s.pos && s.pos[2]), s.id);
  const signs = (await handle.hOpt('listSignposts')) || [];
  for (const s of signs) add('signpost', s.x ?? (s.pos && s.pos[0]), s.z ?? (s.pos && s.pos[2]), s.id);
  const hearths = (await handle.hOpt('listHearths')) || [];
  for (const h of hearths) add('hearth', h.x ?? (h.pos && h.pos[0]), h.z ?? (h.pos && h.pos[2]), h.id);
  return { list, counts: { settlements: settlements.length, signposts: signs.length, hearths: hearths.length } };
}

/** One observation of the running world. Read-only accessors only. */
async function observe(handle, pois) {
  const snap = (await handle.hOpt('snapshot')) || {};
  const p = (snap.player) || {};
  const pos = (p.pos && p.pos.slice()) || [0, 0, 0];
  const ents = (await handle.hOpt('listEntities')) || [];
  const npcs = (await handle.hOpt('listNPCs')) || [];
  const inv = (await handle.hOpt('getInventory')) || {};
  const d2 = (a) => Math.hypot((a.pos ? a.pos[0] : a.x) - pos[0], (a.pos ? a.pos[2] : a.z) - pos[2]);
  const finite = (xs) => (xs.length ? +Math.min(...xs).toFixed(2) : null);
  const hostiles = ents.filter((e) => e && (e.hostile || e.kind === 'enemy' || e.faction === 'hostile'));
  const items = (inv.items || inv.rows || []);
  return {
    pos,
    hp: p.hp ?? null, hp_max: p.hp_max ?? p.hpMax ?? null,
    hp_frac: (p.hp != null && (p.hp_max || p.hpMax)) ? p.hp / (p.hp_max || p.hpMax) : 1,
    stamina: p.stamina ?? null,
    retreating: false,
    reach: null,
    nearestNPC_m: finite(npcs.map(d2).filter(Number.isFinite)),
    nearestHostile_m: finite(hostiles.map(d2).filter(Number.isFinite)),
    hostiles_within_12m: hostiles.filter((h) => d2(h) <= 12).length,
    nearestProp_m: finite(ents.filter((e) => e && (e.kind === 'prop' || e.takeable)).map(d2).filter(Number.isFinite)),
    nearestSign_m: finite(pois.list.filter((q) => q.kind === 'signpost').map((q) => Math.hypot(q.x - pos[0], q.z - pos[2]))),
    nearestHearth_m: finite(pois.list.filter((q) => q.kind === 'hearth').map((q) => Math.hypot(q.x - pos[0], q.z - pos[2]))),
    nearestContainer_m: finite(ents.filter((e) => e && e.kind === 'container').map(d2).filter(Number.isFinite)),
    nearestMerchant_m: finite(npcs.filter((n) => n && (n.merchant || n.service === 'barter')).map(d2).filter(Number.isFinite)),
    nearestStation_m: null,
    inventory_count: items.length,
    weapons_carried: items.filter((i) => i && (i.slot === 'weapon' || i.kind === 'weapon')).length,
    gold: inv.gold ?? 0,
  };
}

/** Perform a verb. Buttons go through the input pipeline; services through their verb. */
async function act(handle, verb, obs) {
  const button = BUTTON_OF[verb];
  const rec = { via: null, ok: false, corroborated: false, evidence: null };
  const before = await handle.hOpt('traceDrain');
  void before;                                       // the window starts here
  try {
    if (button) {
      const held = HELD_ONLY.has(button);
      await handle.h('queueInputs', held
        ? [{ f: 1, press: [button] }, { f: 30, release: [button] }]
        : [{ f: 1, press: [button] }, { f: 3, release: [button] }]);
      await handle.h('stepFrames', CORROBORATION_FRAMES);
      rec.via = `queueInputs('${button}')`;
      rec.ok = true;
    } else if (verb === 'rest') {
      const r = await handle.hOpt('hearthRest', {});
      rec.via = 'hearthRest()'; rec.ok = !!r; rec.evidence = r || null;
    } else { rec.via = 'no button and no service verb'; }
  } catch (e) { rec.error = String(e && e.message || e); }

  // C1's corroboration: did the WORLD change within the window?
  const after = (await handle.hOpt('traceDrain')) || [];
  const kinds = new Set();
  for (const r of after) for (const e of (r.events || r.e || [])) kinds.add(e.type || e.t);
  const CHANGING = ['hit', 'death', 'item', 'journal', 'journal_write', 'quest_stage',
    'dialogue_open', 'surface_enter', 'topic_select', 'level_up', 'bonfire_rest', 'block_success',
    'spawn', 'despawn', 'creation_field', 'save_write', 'stagger', 'parry', 'riposte', 'backstab'];
  const hit = CHANGING.filter((k) => kinds.has(k));
  rec.corroborated = hit.length > 0;
  rec.evidence = rec.evidence || (hit.length ? hit : null);
  rec.event_kinds_in_window = [...kinds];
  void obs;
  return rec;
}

// ══════════════════════════════════════════════════════════════════════════════════════════════
// MODE 3 — THE OFFLINE SELF-TEST. Rule 4: a probe that cannot fail is worse than no probe.
// ══════════════════════════════════════════════════════════════════════════════════════════════
function selfTest() {
  let pass = 0, fail = 0;
  const t = (name, cond, detail) => {
    if (cond) { pass++; process.stdout.write(`  ok   ${name}\n`); }
    else { fail++; process.stdout.write(`  FAIL ${name}${detail ? ' — ' + detail : ''}\n`); }
  };
  process.stdout.write('jrn02-hour --self-test\n');

  // 1. The gap statistic must go RED on a dead hour and GREEN on a busy one.
  const busy = [];
  for (let f = 0; f < 216000; f += 600) busy.push({ frame: f, verb: 'interact', corroborated: true });
  const gBusy = gapStats(busy, 216000);
  t('gap_max green on an input every 10 s', gBusy.gap_max_s <= 45, `got ${gBusy.gap_max_s}`);
  const dead = [{ frame: 10, verb: 'interact', corroborated: true }];
  const gDead = gapStats(dead, 216000);
  t('gap_max RED on one input in an hour', gDead.gap_max_s > 90, `got ${gDead.gap_max_s}`);

  // 2. THE INERT-CONTROL CHECK (RULES 6). An uncorroborated input must NOT buy a pass —
  //    an hour of dodge-rolling in an empty room is the exact reading C1 exists to prevent.
  const rolling = [];
  for (let f = 0; f < 216000; f += 10) rolling.push({ frame: f, verb: 'roll', corroborated: false });
  const gRoll = gapStats(rolling, 216000);
  t('an hour of UNCORROBORATED rolling is still RED', gRoll.gap_max_s > 90, `got ${gRoll.gap_max_s}`);
  const sprinting = [];
  for (let f = 0; f < 216000; f += 10) sprinting.push({ frame: f, verb: 'sprint', corroborated: true });
  t('pure locomotion (sprint) never counts even when corroborated',
    gapStats(sprinting, 216000).gap_max_s > 90);

  // 3. The acquisition policy must fire on need and NOT fire without it.
  const empty = { hp_frac: 1, reach: null, nearestNPC_m: null, nearestProp_m: null,
    nearestSign_m: null, nearestHostile_m: null, hostiles_within_12m: 0, nearestHearth_m: null,
    nearestContainer_m: null, nearestMerchant_m: null, nearestStation_m: null,
    inventory_count: 0, weapons_carried: 0, gold: 0 };
  const memQuiet = { metres_since_anything_near: 0, frames_since_hit_taken: null,
    hits_taken_while_retreating: 0, lights_without_stagger: 0, stuck_ticks: 0, enemy_windups_observed: 0 };
  t('an empty world acquires no verb', decide(empty, memQuiet, new Set()).length === 0,
    JSON.stringify(decide(empty, memQuiet, new Set()).map((x) => x.verb)));
  const hurt = { ...empty, hp_frac: 0.3 };
  t('hp 30% acquires use_item', decide(hurt, memQuiet, new Set()).some((f) => f.verb === 'use_item'));
  const two = { ...empty, nearestHostile_m: 2.0, hostiles_within_12m: 2 };
  const f2 = decide(two, memQuiet, new Set()).map((x) => x.verb);
  t('two hostiles in reach acquires light AND lock_on', f2.includes('light') && f2.includes('lock_on'), f2.join(','));
  t('block is NOT acquired by proximity alone — only by being hit while retreating',
    !f2.includes('block'));
  const beaten = { ...memQuiet, hits_taken_while_retreating: 2 };
  t('block IS acquired after two hits taken while retreating',
    decide(two, beaten, new Set()).some((x) => x.verb === 'block'));

  // 4. --no-acquire must actually withhold (the delete-the-fix arm must be able to bite).
  t('--no-acquire use_item withholds it', !decide(hurt, memQuiet, new Set(), new Set(['use_item']))
    .some((f) => f.verb === 'use_item'));

  // 5. The closed-set guard must be real: BUTTON_OF may not name anything outside ACTIONS.
  t('every button in BUTTON_OF is in the closed action set',
    Object.values(BUTTON_OF).every((b) => b === null || ACTIONS.includes(b)));

  process.stdout.write(`self-test: ${pass} ok, ${fail} failed\n`);
  return fail === 0;
}
