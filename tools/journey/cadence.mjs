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
// never fire. So locomotion actions are enumerated and excluded by name, and the excluded
// count is printed so the exclusion can be audited rather than trusted.
//
// EXIT CODES: 0 all measured checks inside their pass band; 1 one or more outside, or one or
//             more unmeasurable; 2 usage; 20 no trace.
'use strict';

import fs from 'node:fs';
import path from 'node:path';
import {
  REPO_ROOT, parseArgs, wantsHelp, usage, writeJson, readJsonl, quantile, die, EXIT, log,
} from '../lib/cli.mjs';

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

// RI-JRN02 C1's exclusion, enumerated. These are the closed action set's locomotion members.
export const LOCOMOTION_ACTIONS = new Set([
  'forward', 'back', 'left', 'right', 'move', 'walk', 'run', 'sprint', 'jog',
  'look', 'turn', 'camera', 'jump', 'crouch', 'sneak',
]);

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

  // --- collect ---------------------------------------------------------------------------
  const stateChanges = [];        // frames on which the world changed
  const inputsAll = [];           // {frame, action}
  const inputsExcluded = [];
  let combatFrames = 0, dialogueFrames = 0, menuFrames = 0, locomotionOnlyFrames = 0;
  const eventKinds = new Map();

  for (const r of frames) {
    const fr = r.frame ?? 0;
    const evs = Array.isArray(r.events) ? r.events : [];
    let sawCombat = false, sawDialogue = false, sawMenu = false, sawStateChange = false;
    for (const e of evs) {
      if (!e || !e.type) continue;
      eventKinds.set(e.type, (eventKinds.get(e.type) || 0) + 1);
      if (STATE_CHANGING_EVENTS.has(e.type)) sawStateChange = true;
      if (COMBAT_MARKERS.has(e.type)) sawCombat = true;
      if (e.type === 'dialogue_open') sawDialogue = true;
      if (e.type === 'surface_enter' && /menu|inventory|map/i.test(String(e.surface || ''))) sawMenu = true;
      if (e.type === 'input_action') {
        const a = String(e.action || e.button || '');
        inputsAll.push({ frame: fr, action: a });
        if (LOCOMOTION_ACTIONS.has(a)) inputsExcluded.push({ frame: fr, action: a });
        else sawStateChange = true;   // a non-locomotion action IS the C1 clause "an action that..."
      }
    }
    // Frame-level state the record carries directly, where it does.
    if (r.combat && (r.combat.aggro || r.combat.state === 'COMBAT')) sawCombat = true;
    if (r.enemies && Array.isArray(r.enemies) && r.enemies.some((x) => x && x.alertState === 'AGGRO')) sawCombat = true;
    if (r.ui && r.ui.dialogue_open) sawDialogue = true;
    if (r.ui && r.ui.menu_open) sawMenu = true;

    if (sawCombat) combatFrames++;
    if (sawDialogue) dialogueFrames++;
    if (sawMenu) menuFrames++;
    if (sawStateChange) stateChanges.push(fr);
    else if (r.player && r.player.moving) locomotionOnlyFrames++;
  }

  // --- C1 / C2: gaps between state-changing moments ---------------------------------------
  const marks = [f0, ...stateChanges, fN];
  const gaps = [];
  for (let i = 1; i < marks.length; i++) gaps.push((marks[i] - marks[i - 1]) / fps);
  const gapMax = gaps.length ? Math.max(...gaps) : null;
  const gapP95 = gaps.length ? quantile(gaps, 0.95) : null;

  add('C1', 'gap_max', gapMax === null ? null : +gapMax.toFixed(2), gapMax !== null && gapMax <= 45, '<= 45 s', '> 90 s');
  add('C2', 'gap_p95', gapP95 === null ? null : +gapP95.toFixed(2), gapP95 !== null && gapP95 <= 20, '<= 20 s', '> 40 s');

  // --- C3 / C4 -----------------------------------------------------------------------------
  const minutes = durationS / 60;
  const nonCombatChanges = stateChanges.length - Math.min(stateChanges.length, combatFrames);
  const apmNc = minutes > 0 ? nonCombatChanges / Math.max(minutes - combatFrames / fps / 60, 1e-6) : null;
  const apmC = combatFrames > 0 ? inputsAll.filter((i) => !LOCOMOTION_ACTIONS.has(i.action)).length / (combatFrames / fps / 60) : null;

  add('C3', 'apm_nc', apmNc === null ? null : +apmNc.toFixed(2), apmNc !== null && apmNc >= 4 && apmNc <= 14, '4..14', '< 2 or > 25');
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
  add('C7', 'traversal_fraction', frac(locomotionOnlyFrames), locomotionOnlyFrames / frames.length <= 0.35, '<= 0.35', '> 0.50');
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
    add('C10', 'input_variety_10min', worst, worst >= 5, '>= 5 in every window', '<= 3 in any window');
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
    event_kinds_seen: Object.fromEntries([...eventKinds.entries()].sort((a, b) => b[1] - a[1]).slice(0, 30)),
    combat_frames: combatFrames, dialogue_frames: dialogueFrames, menu_frames: menuFrames,
    checks,
    measured: measured.length, unmeasurable: checks.length - measured.length,
    ok: checks.every((c) => c.status === 'pass'),
  };
}

function report(r) {
  process.stdout.write(`cadence: ${r.frames} frames, ${r.duration_s}s, ${r.state_changing_moments} state-changing moments\n`);
  process.stdout.write(`  inputs ${r.inputs_total} (${r.inputs_excluded_as_locomotion} excluded as pure locomotion)\n`);
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
  const walk = [{ _: 'header' }];
  for (let f = 0; f <= 360 * fps; f += 10) {
    walk.push(mk(f, [{ type: 'input_action', action: 'forward' }], { player: { moving: true } }));
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

  for (const l of lines) process.stdout.write(l + '\n');
  process.stdout.write(`\ncadence self-test: ${failed === 0 ? 'PASS' : 'FAIL'} (${lines.length - failed}/${lines.length})\n`);
  return failed === 0 ? 0 : 1;
}
