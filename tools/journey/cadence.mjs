#!/usr/bin/env node
// cadence.mjs — RI-JRN02 §B, checks C1..C10: how busy the hour was, and in what.
//
// Named by: RI-JRN02's Comparison method, verbatim:
//   node tools/journey/cadence.mjs --in reports/journeys/<runId>
//
// WHAT IT MEASURES, AND WHY IT READS THE TRACE AND NOT THE DESIGN
// RI-MTH07 is binding: a tool that reads `regions.json` and reports on regions is measuring the
// design document. Every number here comes from the trace a running build emitted through
// journey-run.mjs — the frames the simulation actually stepped and the events it actually
// raised. There is no data-file fallback and there deliberately is not one: if the trace is
// empty, the answer is `unmeasurable`, not zero.
//
// THE DEFINITION THAT DOES THE WORK (RI-JRN02 C1, verbatim):
//   "a state-changing input = an action that moved an entity, opened a surface, changed a flag,
//    dealt or took damage, or added a journal entry. PURE LOCOMOTION DOES NOT COUNT."
// That exclusion is the whole check. A tool that counts every `input_action` reports a player
// who walked in a circle for an hour as maximally engaged, and C1's 45-second gap bar would
// never fire.
//
// ROUND 2. TOOL-COVERAGE-R1 §4 rejected round 1's exclusion list: it was documented as "the
// closed action set's locomotion members" and ELEVEN of its sixteen names were not in the closed
// action set at all (`forward back left right move walk run jog look turn camera` — taken from
// rebind.js's internal mapping, not from the emitted event). So the audit the file offered as
// its defence — "the excluded count is printed so the exclusion can be audited" — always printed
// empty and audited nothing, and the critic's seven-name sweep showed six of seven action names
// producing the exact reading the file exists to prevent.
//
// Three corrections, all of them the same correction: read the world, do not assume it.
//   1. `LOCOMOTION_ACTIONS` is DERIVED from `game/src/input/actions.js` — the closed set the
//      engine actually emits — and every member is asserted to be in it at module load. A name
//      that is not in `ACTIONS` throws, loudly, rather than silently excluding nothing.
//   2. `crouch` is no longer excluded. It is in the closed set, it is a TOGGLE (actions.js's own
//      amendment note says so), and a toggle changes a flag — which is a state change by C1's
//      own words.
//   3. An action name in the trace that is NOT in the closed set is reported under
//      `actions_seen_outside_the_closed_set`. That is the audit that actually bites: it fires
//      when the build and this tool disagree about what an action is called, which is the exact
//      condition round 1 could not detect.
//
// And RI-JRN02 C1's clause list is respected for the two actions that can be a complete no-op.
// `interact` and `use_item` mashed in an empty room open nothing and change nothing, so they
// count as a state change only when the trace CORROBORATES one of C1's five clauses on the same
// frame or within `CORROBORATION_FRAMES`. The uncorroborated count is reported. Every other
// non-locomotion action in the closed set either toggles a flag or is a combat verb, and counts
// on its own.
//
// EXIT CODES: 0 all measured checks inside their pass band; 1 one or more outside, or one or
//             more unmeasurable; 2 usage; 20 no trace.
'use strict';

import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  REPO_ROOT, parseArgs, wantsHelp, usage, writeJson, readJsonl, quantile, die, EXIT, log,
} from '../lib/cli.mjs';
import { ACTIONS } from '../../game/src/input/actions.js';

const USAGE = `
cadence.mjs — RI-JRN02 §B checks C1..C10 over a journey-run trace.

USAGE
  node tools/journey/cadence.mjs --in reports/journeys/<runId>
  node tools/journey/cadence.mjs --in <runDir> --json reports/cadence.json
  node tools/journey/cadence.mjs --self-test

OPTIONS
  --in DIR       a journey-run.mjs run directory (needs trace.jsonl)
  --json PATH    write the result
  --fps N        simulation rate (default 60, read from the trace header when present)
  --self-test    prove the instrument can fail: synthesise a trace with a 300 s dead gap and
                 assert C1 goes red; synthesise a pure-locomotion trace and assert it is NOT
                 counted as activity; assert an empty trace is unmeasurable and never a pass

CHECKS
  C1  gap_max            longest interval with no STATE-CHANGING input   <= 45 s   (fail > 90)
  C2  gap_p95            95th percentile of the same                     <= 20 s   (fail > 40)
  C3  apm_nc             state-changing inputs/min outside combat        4..14     (fail <2 >25)
  C4  apm_c              inputs/min inside combat                        >= 45     (fail < 30)
  C5  combat_fraction    fraction of the hour with a hostile in AGGRO    0.12-0.30 (fail <.08 >.45)
  C6  dialogue_fraction  fraction with a dialogue surface open           0.10-0.25 (fail <.05 >.35)
  C7  traversal_fraction fraction with locomotion and nothing else       <= 0.35   (fail > 0.50)
  C8  menu_fraction      fraction with a menu/inventory surface open     <= 0.08   (fail > 0.15)
  C9  longest_corridor   longest stretch with nothing within 15 m        <= 60 s   (fail > 120)
  C10 input_variety_10min distinct actions per rolling 10 min            >= 5      (fail <= 3)
`;

// RI-JRN02 C1's exclusion, DERIVED from the closed action set rather than assumed.
//
// Movement in this build is an AXIS, not an action: `sim/player.js:109` emits `input_action`
// only for attack and roll moves and `engine.js:1514` for census commits, so there is no
// `forward` event to exclude and there never was. What IS in the closed set and is pure
// locomotion is `sprint` and `jump`. Both are asserted below.
const LOCOMOTION_NAMES = ['sprint', 'jump'];

// Actions that change a flag by construction, so they satisfy C1 without corroboration.
// `crouch` is here and not in LOCOMOTION_NAMES: actions.js's AM-W1-15-01 note states it is a
// TOGGLE, and a toggle changes a flag.
const FLAG_TOGGLE_NAMES = ['crouch', 'lock_on', 'two_hand', 'swap_right', 'swap_left', 'menu', 'spell_cycle'];

// Actions that can be a complete no-op: pressed in an empty room they open nothing and change
// nothing, and "an action that opened nothing and changed nothing" is not one of C1's five
// clauses. They count only when the trace corroborates a clause nearby.
const NO_OP_CAPABLE_NAMES = ['interact', 'use_item'];

/** How many frames after an input the trace may corroborate it. 1 s at 60 Hz. */
const CORROBORATION_FRAMES = 60;

// The assertion. A name here that the engine does not emit excludes nothing and audits nothing,
// which is precisely how round 1 shipped an exclusion list with eleven dead entries.
for (const [label, names] of [['LOCOMOTION_NAMES', LOCOMOTION_NAMES], ['FLAG_TOGGLE_NAMES', FLAG_TOGGLE_NAMES], ['NO_OP_CAPABLE_NAMES', NO_OP_CAPABLE_NAMES]]) {
  const stray = names.filter((n) => !ACTIONS.includes(n));
  if (stray.length) {
    throw new Error(
      `cadence.mjs ${label} names ${stray.join(', ')}, which the closed action set ` +
      `(game/src/input/actions.js) does not contain: ${ACTIONS.join(' ')}. ` +
      'An exclusion list that is not the shipped action set excludes actions the game does not ' +
      'have and counts ones it does (TOOL-COVERAGE-R1 §4). Fix the list or amend the set.');
  }
}

export const LOCOMOTION_ACTIONS = new Set(LOCOMOTION_NAMES);
export const FLAG_TOGGLE_ACTIONS = new Set(FLAG_TOGGLE_NAMES);
export const NO_OP_CAPABLE_ACTIONS = new Set(NO_OP_CAPABLE_NAMES);
export const CLOSED_ACTION_SET = new Set(ACTIONS);

// An event kind that proves the world changed. C1's five clauses, mapped onto the engine's
// own event vocabulary (game/src/sim/events.js) so the mapping is checkable.
export const STATE_CHANGING_EVENTS = new Set([
  // "moved an entity"
  'spawn', 'despawn', 'takeObject', 'theft', 'pickpocket', 'item', 'travel_refused', 'lock_open',
  // "opened a surface"
  'dialogue_open', 'surface_enter', 'search_start', 'lockBegin', 'lock_attempt',
  // "changed a flag"
  'quest_stage', 'crime', 'bounty_change', 'arrest', 'witness', 'report', 'topic_select',
  'creation_field', 'level_up', 'save_write', 'bonfire_rest', 'fence_sale',
  // "dealt or took damage"
  'hit', 'spell_hit', 'hazard_damage', 'death', 'backstab', 'riposte', 'parry', 'block_success',
  'cast_effective', 'world_fall_damage',
  // "added a journal entry"
  'journal', 'journal_write',
]);

const COMBAT_MARKERS = new Set(['attack_start', 'hit', 'block', 'parry', 'roll_start', 'stagger',
  'whiff', 'guard_break', 'riposte', 'backstab', 'enemy_state', 'zone_alert']);

// TOOL-COVERAGE-R1 §4(b): `export function analyse` was DEAD — importing the module ran the CLI
// and exited, so no other tool could reuse it. The CLI is guarded now and the export is live.
const IS_MAIN = !!(process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href);
if (IS_MAIN) {
  const args = parseArgs();
  if (wantsHelp(args)) usage(USAGE);
  if (args['self-test']) process.exit(selfTest());

  const inDir = args.in ? path.resolve(String(args.in)) : null;
  if (!inDir) die(EXIT.USAGE, '--in <journey run directory> is required');
  const tracePath = path.join(inDir, 'trace.jsonl');
  if (!fs.existsSync(tracePath)) {
    die(EXIT.MEASUREMENT_FAIL,
      `${path.relative(REPO_ROOT, tracePath)} does not exist. cadence.mjs measures a RUN, not a ` +
      `design document (RI-MTH07). Produce one with:\n` +
      `  node tools/journey/journey-run.mjs --journey jrn02-first-hour --trace-events --out ${path.relative(REPO_ROOT, inDir)}`);
  }

  const records = readJsonl(tracePath);
  const result = analyse(records, Number(args.fps || 60));
  if (args.json) writeJson(String(args.json), result);
  else writeJson(path.join(inDir, 'cadence.json'), result);

  report(result);
  process.exit(result.ok ? 0 : 1);
}

// ---------------------------------------------------------------------------------------------
export function analyse(records, fps = 60) {
  const header = records.find((r) => r && r._ === 'header') || {};
  const frames = records.filter((r) => r && r._ !== 'header' && r._ !== 'footer');
  const checks = [];
  const add = (id, name, value, pass, band, fail, why) =>
    checks.push({ id, name, value, status: value === null ? 'unmeasurable' : (pass ? 'pass' : 'fail'), band, hard_fail: fail, why: why || null });

  if (!frames.length) {
    // The single most important branch in this file. An empty trace must never produce
    // "gap_max: 0 s, PASS" — which is what a naive implementation returns, because there are
    // no gaps in nothing.
    for (const [id, name] of [['C1', 'gap_max'], ['C2', 'gap_p95'], ['C3', 'apm_nc'], ['C4', 'apm_c'],
      ['C5', 'combat_fraction'], ['C6', 'dialogue_fraction'], ['C7', 'traversal_fraction'],
      ['C8', 'menu_fraction'], ['C9', 'longest_corridor'], ['C10', 'input_variety_10min']]) {
      add(id, name, null, false, null, null, 'the trace carries 0 simulation frames — nothing happened to measure');
    }
    return { schema: 'elder-souls/cadence@1', item: 'RI-JRN02 §B', frames: 0, duration_s: 0, ok: false, checks, header };
  }

  const f0 = frames[0].frame ?? 0;
  const fN = frames[frames.length - 1].frame ?? frames.length;
  const durationFrames = Math.max(1, fN - f0);
  const durationS = durationFrames / fps;

  // --- collect, pass 1: what the WORLD did, independently of what was pressed ---------------
  const inputsAll = [];               // {frame, action}
  const inputsExcluded = [];          // pure locomotion, per the derived closed-set members
  const inputsOutsideSet = [];        // an action name the closed set does not contain
  const worldChangeFrames = [];       // frames carrying a C1-clause event that is NOT an input
  let combatFrames = 0, dialogueFrames = 0, menuFrames = 0, locomotionOnlyFrames = 0;
  const eventKinds = new Map();
  const perFrame = [];

  for (const r of frames) {
    const fr = r.frame ?? 0;
    const evs = Array.isArray(r.events) ? r.events : [];
    let sawCombat = false, sawDialogue = false, sawMenu = false, sawWorldChange = false;
    for (const e of evs) {
      if (!e || !e.type) continue;
      eventKinds.set(e.type, (eventKinds.get(e.type) || 0) + 1);
      if (STATE_CHANGING_EVENTS.has(e.type)) sawWorldChange = true;
      if (COMBAT_MARKERS.has(e.type)) sawCombat = true;
      if (e.type === 'dialogue_open') sawDialogue = true;
      if (e.type === 'surface_enter' && /menu|inventory|map/i.test(String(e.surface || ''))) sawMenu = true;
      if (e.type === 'input_action') {
        const a = String(e.action || e.button || '');
        inputsAll.push({ frame: fr, action: a });
        if (!CLOSED_ACTION_SET.has(a)) inputsOutsideSet.push({ frame: fr, action: a });
        if (LOCOMOTION_ACTIONS.has(a)) inputsExcluded.push({ frame: fr, action: a });
      }
    }
    if (r.combat && (r.combat.aggro || r.combat.state === 'COMBAT')) sawCombat = true;
    if (r.enemies && Array.isArray(r.enemies) && r.enemies.some((x) => x && x.alertState === 'AGGRO')) sawCombat = true;
    if (r.ui && r.ui.dialogue_open) sawDialogue = true;
    if (r.ui && r.ui.menu_open) sawMenu = true;

    if (sawCombat) combatFrames++;
    if (sawDialogue) dialogueFrames++;
    if (sawMenu) menuFrames++;
    if (sawWorldChange) worldChangeFrames.push(fr);
    perFrame.push({ fr, sawWorldChange, moving: !!(r.player && r.player.moving) });
  }

  // --- collect, pass 2: which INPUTS satisfy one of C1's five clauses -----------------------
  //
  // A non-locomotion action that toggles a flag or is a combat verb satisfies C1 on its own.
  // `interact` and `use_item` can be a complete no-op — mashed in an empty room they open
  // nothing and change nothing — so they satisfy C1 only when the world corroborates within
  // CORROBORATION_FRAMES. The uncorroborated count is reported so the rule can be audited
  // rather than trusted, which is the thing round 1's audit line never actually did.
  const wcSorted = worldChangeFrames.slice().sort((a, b) => a - b);
  const corroboratedNear = (fr) => {
    let lo = 0, hi = wcSorted.length - 1, ans = -1;
    while (lo <= hi) { const mid = (lo + hi) >> 1; if (wcSorted[mid] >= fr) { ans = wcSorted[mid]; hi = mid - 1; } else lo = mid + 1; }
    return ans !== -1 && ans - fr <= CORROBORATION_FRAMES;
  };
  const inputsUncorroborated = [];
  const inputStateChangeFrames = [];
  for (const i of inputsAll) {
    if (LOCOMOTION_ACTIONS.has(i.action)) continue;
    if (NO_OP_CAPABLE_ACTIONS.has(i.action) && !corroboratedNear(i.frame)) {
      inputsUncorroborated.push(i);
      continue;
    }
    inputStateChangeFrames.push(i.frame);
  }

  // HARNESS.md §4: "an unknown button is an error, never a silent no-op." This tool mirrors that
  // rule rather than restating it. If ANY input in the trace names an action the closed set does
  // not contain, then this file and the build disagree about what an action is called, no
  // classification below can be trusted, and every check that depends on the classification is
  // UNMEASURABLE — never a pass. That is the difference between round 1's reading of the
  // critic's seven-name sweep (six of seven `pass`, gap 0.17 s, 0 excluded) and this one.
  const classificationReliable = inputsOutsideSet.length === 0;
  const unreliableWhy = classificationReliable ? null
    : `${inputsOutsideSet.length} of ${inputsAll.length} input_action events name an action the ` +
      `closed action set does not contain (${[...new Set(inputsOutsideSet.map((i) => i.action))].sort().join(', ')}). ` +
      `The closed set is ${ACTIONS.join(' ')} (game/src/input/actions.js) and HARNESS.md §4 makes ` +
      `an unknown button an error, never a silent no-op. Until the two agree, no input can be ` +
      `classified as locomotion or as a state change, so C1/C2/C3/C7/C10 cannot be evaluated. ` +
      `This is a build-or-tool disagreement, not a cadence finding.`;

  const stateChanges = [...new Set([...worldChangeFrames, ...inputStateChangeFrames])].sort((a, b) => a - b);
  const stateChangeSet = new Set(stateChanges);
  for (const f of perFrame) if (!stateChangeSet.has(f.fr) && f.moving) locomotionOnlyFrames++;

  // --- C1 / C2: gaps between state-changing moments ---------------------------------------
  const marks = [f0, ...stateChanges, fN];
  const gaps = [];
  for (let i = 1; i < marks.length; i++) gaps.push((marks[i] - marks[i - 1]) / fps);
  const gapMax = gaps.length ? Math.max(...gaps) : null;
  const gapP95 = gaps.length ? quantile(gaps, 0.95) : null;

  if (!classificationReliable) {
    add('C1', 'gap_max', null, false, '<= 45 s', '> 90 s', unreliableWhy);
    add('C2', 'gap_p95', null, false, '<= 20 s', '> 40 s', unreliableWhy);
  } else {
    add('C1', 'gap_max', gapMax === null ? null : +gapMax.toFixed(2), gapMax !== null && gapMax <= 45, '<= 45 s', '> 90 s');
    add('C2', 'gap_p95', gapP95 === null ? null : +gapP95.toFixed(2), gapP95 !== null && gapP95 <= 20, '<= 20 s', '> 40 s');
  }

  // --- C3 / C4 -----------------------------------------------------------------------------
  const minutes = durationS / 60;
  const nonCombatChanges = stateChanges.length - Math.min(stateChanges.length, combatFrames);
  const apmNc = minutes > 0 ? nonCombatChanges / Math.max(minutes - combatFrames / fps / 60, 1e-6) : null;
  const apmC = combatFrames > 0 ? inputsAll.filter((i) => !LOCOMOTION_ACTIONS.has(i.action)).length / (combatFrames / fps / 60) : null;

  if (!classificationReliable) add('C3', 'apm_nc', null, false, '4..14', '< 2 or > 25', unreliableWhy);
  else add('C3', 'apm_nc', apmNc === null ? null : +apmNc.toFixed(2), apmNc !== null && apmNc >= 4 && apmNc <= 14, '4..14', '< 2 or > 25');
  if (combatFrames === 0) {
    add('C4', 'apm_c', null, false, '>= 45', '< 30',
      'no frame in this trace carried a combat marker or an AGGRO hostile, so there is no ' +
      'in-combat interval to divide by. An hour with no combat is a C5 finding, not a C4 pass.');
  } else {
    add('C4', 'apm_c', +apmC.toFixed(2), apmC >= 45, '>= 45', '< 30');
  }

  // --- C5..C8 -------------------------------------------------------------------------------
  const frac = (n) => +(n / frames.length).toFixed(4);
  add('C5', 'combat_fraction', frac(combatFrames), combatFrames / frames.length >= 0.12 && combatFrames / frames.length <= 0.30, '0.12..0.30', '< 0.08 or > 0.45');
  add('C6', 'dialogue_fraction', frac(dialogueFrames), dialogueFrames / frames.length >= 0.10 && dialogueFrames / frames.length <= 0.25, '0.10..0.25', '< 0.05 or > 0.35');
  if (!classificationReliable) add('C7', 'traversal_fraction', null, false, '<= 0.35', '> 0.50', unreliableWhy);
  else add('C7', 'traversal_fraction', frac(locomotionOnlyFrames), locomotionOnlyFrames / frames.length <= 0.35, '<= 0.35', '> 0.50');
  add('C8', 'menu_fraction', frac(menuFrames), menuFrames / frames.length <= 0.08, '<= 0.08', '> 0.15');

  // --- C9: corridors -------------------------------------------------------------------------
  // "no interactable, no NPC, no enemy and no readable within 15 m". That needs a per-frame
  // proximity census, which the trace record carries only if the build emits it.
  const hasProximity = frames.some((r) => r && (r.nearby !== undefined || (r.world && r.world.nearby !== undefined)));
  if (!hasProximity) {
    add('C9', 'longest_corridor', null, false, '<= 60 s', '> 120 s',
      'no trace record carries a `nearby` census, so "nothing within 15 m" cannot be evaluated. ' +
      'Computing it from game/data/world/** instead would measure the design document (RI-MTH07). ' +
      'Needs a per-frame proximity field in the trace record.');
  } else {
    let run = 0, best = 0;
    for (const r of frames) {
      const near = (r.nearby || (r.world && r.world.nearby) || []);
      if (!near.length) { run++; best = Math.max(best, run); } else run = 0;
    }
    add('C9', 'longest_corridor', +(best / fps).toFixed(2), best / fps <= 60, '<= 60 s', '> 120 s');
  }

  // --- C10: rolling variety -------------------------------------------------------------------
  const windowFrames = 10 * 60 * fps;
  let worst = null;
  if (durationFrames >= windowFrames) {
    for (let start = f0; start + windowFrames <= fN; start += 60 * fps) {
      const set = new Set(inputsAll.filter((i) => i.frame >= start && i.frame < start + windowFrames).map((i) => i.action));
      worst = worst === null ? set.size : Math.min(worst, set.size);
    }
    if (!classificationReliable) add('C10', 'input_variety_10min', null, false, '>= 5 in every window', '<= 3 in any window', unreliableWhy);
    else add('C10', 'input_variety_10min', worst, worst >= 5, '>= 5 in every window', '<= 3 in any window');
  } else {
    add('C10', 'input_variety_10min', null, false, '>= 5', '<= 3',
      `the trace is ${durationS.toFixed(0)} s long; a rolling 10-minute window does not fit. ` +
      `RI-JRN02 measures an HOUR — run journey-run.mjs --journey jrn02-first-hour --duration-min 60.`);
  }

  const measured = checks.filter((c) => c.status !== 'unmeasurable');
  return {
    schema: 'elder-souls/cadence@1',
    tool: 'tools/journey/cadence.mjs',
    item: 'RI-JRN02 §B (C1..C10)',
    header,
    frames: frames.length, fps, duration_s: +durationS.toFixed(1),
    state_changing_moments: stateChanges.length,
    inputs_total: inputsAll.length,
    inputs_excluded_as_locomotion: inputsExcluded.length,
    locomotion_actions_excluded: [...new Set(inputsExcluded.map((i) => i.action))].sort(),
    // The exclusion list, derived from game/src/input/actions.js and printed so a reader can
    // check it against the set the engine emits rather than take this file's word for it.
    closed_action_set: ACTIONS.slice(),
    locomotion_names: [...LOCOMOTION_ACTIONS].sort(),
    flag_toggle_names: [...FLAG_TOGGLE_ACTIONS].sort(),
    no_op_capable_names: [...NO_OP_CAPABLE_ACTIONS].sort(),
    corroboration_frames: CORROBORATION_FRAMES,
    // THE AUDIT THAT BITES. An action name the trace carries that the closed set does not
    // contain means the build and this tool disagree about what an action is called — the exact
    // condition round 1's always-empty audit line could not detect.
    actions_seen_outside_the_closed_set: [...new Set(inputsOutsideSet.map((i) => i.action))].sort(),
    inputs_outside_the_closed_set: inputsOutsideSet.length,
    classification_reliable: classificationReliable,
    // `interact`/`use_item` presses with no world change within CORROBORATION_FRAMES: a player
    // mashing a no-op in an empty room is not interacting with anything.
    inputs_uncorroborated: inputsUncorroborated.length,
    uncorroborated_actions: [...new Set(inputsUncorroborated.map((i) => i.action))].sort(),
    actions_seen: [...new Set(inputsAll.map((i) => i.action))].sort(),
    event_kinds_seen: Object.fromEntries([...eventKinds.entries()].sort((a, b) => b[1] - a[1]).slice(0, 30)),
    combat_frames: combatFrames, dialogue_frames: dialogueFrames, menu_frames: menuFrames,
    checks,
    measured: measured.length, unmeasurable: checks.length - measured.length,
    ok: checks.every((c) => c.status === 'pass'),
  };
}

function report(r) {
  process.stdout.write(`cadence: ${r.frames} frames, ${r.duration_s}s, ${r.state_changing_moments} state-changing moments\n`);
  process.stdout.write(`  inputs ${r.inputs_total} (${r.inputs_excluded_as_locomotion} excluded as pure locomotion, ` +
    `${r.inputs_uncorroborated} uncorroborated no-ops)\n`);
  process.stdout.write(`  closed action set (game/src/input/actions.js): ${(r.closed_action_set || []).join(' ')}\n`);
  process.stdout.write(`  excluded as locomotion: ${(r.locomotion_names || []).join(' ') || '(none)'}\n`);
  if ((r.actions_seen_outside_the_closed_set || []).length) {
    process.stdout.write(`  *** ${r.inputs_outside_the_closed_set} input(s) name an action OUTSIDE the closed set: ` +
      `${r.actions_seen_outside_the_closed_set.join(', ')} — the build and this tool disagree about ` +
      `what an action is called, and every exclusion below is unreliable until that is settled\n`);
  }
  for (const c of r.checks) {
    const tag = c.status === 'pass' ? 'PASS' : c.status === 'fail' ? 'FAIL' : 'N/A ';
    process.stdout.write(`  ${tag} ${c.id} ${c.name.padEnd(20)} ${String(c.value).padEnd(10)} band ${c.band || '-'}` +
      (c.why ? `\n         ${c.why}` : '') + '\n');
  }
}

// ---------------------------------------------------------------------------------------------
function selfTest() {
  const lines = [];
  let failed = 0;
  const ok = (n, pass, d) => { lines.push(`${pass ? 'PASS' : 'FAIL'} ${n} — ${d}`); if (!pass) failed++; };
  const fps = 60;
  const mk = (frame, events = [], extra = {}) => ({ frame, events, ...extra });

  // 1. Empty trace must be unmeasurable, never a pass. This is the failure a naive
  //    implementation ships: no frames means no gaps means gap_max 0 means PASS.
  const empty = analyse([{ _: 'header' }], fps);
  ok('empty trace is unmeasurable, not a pass',
    !empty.ok && empty.checks.every((c) => c.status === 'unmeasurable'),
    `ok=${empty.ok}, ${empty.checks.filter((c) => c.status === 'unmeasurable').length}/${empty.checks.length} unmeasurable`);

  // 2. A busy trace passes C1.
  const busy = [{ _: 'header' }];
  for (let f = 0; f <= 60 * fps * 5; f += 30) {
    busy.push(mk(f, f % 300 === 0 ? [{ type: 'hit' }] : []));
  }
  const busyR = analyse(busy, fps);
  const c1busy = busyR.checks.find((c) => c.id === 'C1');
  ok('C1 passes on a trace with a state change every 5 s', c1busy.status === 'pass',
    `gap_max = ${c1busy.value} s`);

  // 3. THE FALSIFICATION: insert a 300-second dead gap. C1 must go red.
  const dead = [{ _: 'header' }];
  for (let f = 0; f <= 60 * fps; f += 30) dead.push(mk(f, f % 300 === 0 ? [{ type: 'hit' }] : []));
  for (let f = 60 * fps + 30; f <= 360 * fps; f += 30) dead.push(mk(f, []));   // 300 s of nothing
  dead.push(mk(361 * fps, [{ type: 'hit' }]));
  const deadR = analyse(dead, fps);
  const c1dead = deadR.checks.find((c) => c.id === 'C1');
  ok('C1 goes red on a 300 s dead gap (falsification)',
    c1dead.status === 'fail' && c1dead.value > 90,
    `gap_max = ${c1dead.value} s (hard fail band > 90 s)`);

  // 4. THE OTHER FALSIFICATION: pure locomotion must NOT count as activity. A tool that counts
  //    every input reports a player walking in a circle for an hour as maximally engaged.
  //    The action name is `sprint`, which IS in the closed action set — round 1 used `forward`,
  //    which is not, so this case passed against a list that excluded nothing real.
  const walk = [{ _: 'header' }];
  for (let f = 0; f <= 360 * fps; f += 10) {
    walk.push(mk(f, [{ type: 'input_action', action: 'sprint' }], { player: { moving: true } }));
  }
  const walkR = analyse(walk, fps);
  const c1walk = walkR.checks.find((c) => c.id === 'C1');
  ok('pure locomotion is not counted as a state change (falsification)',
    c1walk.status === 'fail' && walkR.inputs_excluded_as_locomotion === walkR.inputs_total,
    `${walkR.inputs_excluded_as_locomotion}/${walkR.inputs_total} inputs excluded; gap_max = ${c1walk.value} s ` +
    `(if this PASSED, an hour of walking in a circle would read as maximally engaged)`);

  // 5. No combat means C4 unmeasurable, not a pass and not a zero-that-reads-as-pass.
  const c4 = walkR.checks.find((c) => c.id === 'C4');
  ok('C4 is unmeasurable when no combat occurred', c4.status === 'unmeasurable',
    c4.why || String(c4.value));

  // 6. THE ROUND-2 FALSIFICATION. The exclusion list must be the SHIPPED action set. An action
  //    name the closed set does not contain must be REPORTED, not silently swallowed as
  //    locomotion and not silently counted as activity. Round 1 excluded eleven such names.
  const bogus = [{ _: 'header' }];
  for (let f = 0; f <= 360 * fps; f += 10) {
    bogus.push(mk(f, [{ type: 'input_action', action: 'forward' }], { player: { moving: true } }));
  }
  const bogusR = analyse(bogus, fps);
  const c1bogus = bogusR.checks.find((c) => c.id === 'C1');
  ok('an action outside the closed set makes C1 UNMEASURABLE, never a pass',
    bogusR.actions_seen_outside_the_closed_set.includes('forward')
      && bogusR.inputs_outside_the_closed_set === bogusR.inputs_total
      && bogusR.classification_reliable === false
      && ['C1', 'C2', 'C3', 'C7', 'C10'].every((id) => bogusR.checks.find((c) => c.id === id).status === 'unmeasurable'),
    `"forward" is not in the closed set (${ACTIONS.join(' ')}); ` +
    `${bogusR.inputs_outside_the_closed_set}/${bogusR.inputs_total} outside-set, ` +
    `C1 = ${c1bogus.status} (round 1 read this as PASS, gap 0.17 s, 0 excluded)`);

  // 7. The list membership assertion itself. Every name this file excludes must be in ACTIONS.
  ok('every exclusion name is in the shipped closed action set',
    [...LOCOMOTION_ACTIONS, ...FLAG_TOGGLE_ACTIONS, ...NO_OP_CAPABLE_ACTIONS].every((n) => ACTIONS.includes(n)),
    `locomotion=[${[...LOCOMOTION_ACTIONS].join(' ')}] toggles=[${[...FLAG_TOGGLE_ACTIONS].join(' ')}] ` +
    `no-op-capable=[${[...NO_OP_CAPABLE_ACTIONS].join(' ')}] all in ACTIONS`);

  // 8. `crouch` is a TOGGLE (actions.js AM-W1-15-01) and a toggle changes a flag, so it counts.
  //    Round 1 excluded it as locomotion.
  const crouch = [{ _: 'header' }];
  for (let f = 0; f <= 360 * fps; f += 30 * fps) crouch.push(mk(f, [{ type: 'input_action', action: 'crouch' }]));
  for (let f = 0; f <= 360 * fps; f += 30) if (f % (30 * fps)) crouch.push(mk(f, []));
  crouch.sort((a, b) => (a._ === 'header' ? -1 : b._ === 'header' ? 1 : a.frame - b.frame));
  const crouchR = analyse(crouch, fps);
  ok('crouch counts as a state change (a toggle changes a flag)',
    crouchR.state_changing_moments > 0 && crouchR.inputs_excluded_as_locomotion === 0,
    `${crouchR.state_changing_moments} state-changing moments from ${crouchR.inputs_total} crouch presses, ` +
    `${crouchR.inputs_excluded_as_locomotion} excluded as locomotion`);

  // 9. C1's clause list, applied to the two actions that can be a complete no-op. A player
  //    mashing `interact` in an empty room for an hour opened nothing and changed nothing.
  const mash = [{ _: 'header' }];
  for (let f = 0; f <= 360 * fps; f += 10) mash.push(mk(f, [{ type: 'input_action', action: 'interact' }]));
  const mashR = analyse(mash, fps);
  const c1mash = mashR.checks.find((c) => c.id === 'C1');
  ok('a no-op `interact` mashed with nothing to interact with does not read as engagement',
    c1mash.status === 'fail' && mashR.inputs_uncorroborated === mashR.inputs_total,
    `${mashR.inputs_uncorroborated}/${mashR.inputs_total} interact presses uncorroborated; ` +
    `gap_max = ${c1mash.value} s`);

  // 10. …and the control on that: the SAME presses, corroborated by a real surface opening,
  //     must count. A rule that rejects everything measures nothing.
  const real = [{ _: 'header' }];
  for (let f = 0; f <= 360 * fps; f += 10) {
    const evs = [{ type: 'input_action', action: 'interact' }];
    if (f % (20 * fps) === 0) evs.push({ type: 'surface_enter', surface: 'container' });
    real.push(mk(f, evs));
  }
  const realR = analyse(real, fps);
  const c1real = realR.checks.find((c) => c.id === 'C1');
  ok('control: corroborated `interact` DOES count (the rule is not a blanket refusal)',
    c1real.status === 'pass' && realR.inputs_uncorroborated < realR.inputs_total,
    `${realR.inputs_uncorroborated}/${realR.inputs_total} uncorroborated; gap_max = ${c1real.value} s`);

  for (const l of lines) process.stdout.write(l + '\n');
  process.stdout.write(`\ncadence self-test: ${failed === 0 ? 'PASS' : 'FAIL'} (${lines.length - failed}/${lines.length})\n`);
  return failed === 0 ? 0 : 1;
}
