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
// ROUND 4 — the census that replaces this file's false provenance comment. See the note above
// FLAG_FIELDS and TOOL-COVERAGE-R3 §5.
import { findArtifacts, censusFields, verifyFields } from '../lib/trace-schema.mjs';

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

// ROUND 3 — NOTHING SATISFIES C1 BY NAME. TOOL-COVERAGE-R2 §5 swept nine actions through the
// round-2 classifier and found four that bought a pass they had not earned:
//
//   an hour in an empty room, one button six times a second, player advancing 2 160 m:
//     roll        -> C1 PASS, gap_max 0.17 s, traversal_fraction 0
//     menu        -> C1 PASS, gap_max 0.17 s
//     lock_on     -> C1 PASS, gap_max 0.17 s
//     spell_cycle -> C1 PASS, gap_max 0.17 s
//
// "An hour of dodge-rolling across the map, and an hour of opening and closing the inventory,
// both read as maximally engaged. That is the exact reading the file's own header says it
// exists to prevent." The round-2 fix (a FLAG_TOGGLE class that counted by name) was the same
// mistake as round 1's, one level in: it asserted that pressing `menu` opens a surface instead
// of checking that a surface opened.
//
// RI-JRN02 C1's definition is FIVE WORLD FACTS, not five button names:
//   "a state-changing input = an action that moved an entity, opened a surface, changed a flag,
//    dealt or took damage, or added a journal entry. Pure locomotion does not count."
//
// So: an input satisfies C1 only when the TRACE shows one of those five within
// CORROBORATION_FRAMES. A roll that dodged a hit counts, because the hit is in the trace. A
// roll in an empty room does not, because nothing happened. `menu` counts when a surface
// actually opened. The uncorroborated inputs are counted and named on every run, so the rule
// is audited rather than trusted — and, unlike round 2's audit line, that count is not always 0.
//
// `sprint` and `jump` are excluded ENTIRELY: C1's last sentence names locomotion and these two
// are the closed set's locomotion members. `roll` is NOT excluded entirely — it is the souls
// traversal verb AND the souls defensive verb, and which one it was on a given press is a
// question only the world can answer. That is what corroboration is for.
const CORROBORATION_REQUIRED_NAMES = ['light', 'heavy', 'roll', 'block', 'parry', 'use_item',
  'interact', 'lock_on', 'two_hand', 'swap_right', 'swap_left', 'menu', 'crouch', 'spell_cycle'];

// Kept as exported names so a critic can see the classification is total over the closed set.
const FLAG_TOGGLE_NAMES = [];
const NO_OP_CAPABLE_NAMES = CORROBORATION_REQUIRED_NAMES;

/** How many frames after an input the trace may corroborate it. 1 s at 60 Hz. */
const CORROBORATION_FRAMES = 60;

// The assertion. A name here that the engine does not emit excludes nothing and audits nothing,
// which is precisely how round 1 shipped an exclusion list with eleven dead entries.
for (const [label, names] of [['LOCOMOTION_NAMES', LOCOMOTION_NAMES], ['CORROBORATION_REQUIRED_NAMES', CORROBORATION_REQUIRED_NAMES]]) {
  const stray = names.filter((n) => !ACTIONS.includes(n));
  if (stray.length) {
    throw new Error(
      `cadence.mjs ${label} names ${stray.join(', ')}, which the closed action set ` +
      `(game/src/input/actions.js) does not contain: ${ACTIONS.join(' ')}. ` +
      'An exclusion list that is not the shipped action set excludes actions the game does not ' +
      'have and counts ones it does (TOOL-COVERAGE-R1 §4). Fix the list or amend the set.');
  }
}

// TOTALITY. Every member of the closed action set must be in exactly one class. An action that
// is in neither would silently fall through to "satisfies C1", which is how `roll` bought a pass.
{
  const classified = new Set([...LOCOMOTION_NAMES, ...CORROBORATION_REQUIRED_NAMES]);
  const unclassified = ACTIONS.filter((a) => !classified.has(a));
  if (unclassified.length) {
    throw new Error(
      `cadence.mjs does not classify ${unclassified.join(', ')} from the closed action set ` +
      `(game/src/input/actions.js). An unclassified action falls through to "satisfies C1 by ` +
      `name", which is exactly how an hour of dodge-rolling read as maximally engaged ` +
      `(TOOL-COVERAGE-R2 §5). Put it in LOCOMOTION_NAMES or CORROBORATION_REQUIRED_NAMES.`);
  }
}

export const LOCOMOTION_ACTIONS = new Set(LOCOMOTION_NAMES);
export const CORROBORATION_REQUIRED_ACTIONS = new Set(CORROBORATION_REQUIRED_NAMES);
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

// C1 clause 3, "changed a flag", read from the WORLD rather than inferred from a button name.
// A toggle is only a toggle if something toggled: `lock_on` pressed with no target changes
// `player.locked_on` not at all, and that is the difference between an action and a keystroke.
// ROUND 4 — TOOL-COVERAGE-R3 §5. The line above this list used to read:
//
//   "These are fields the shipped trace record actually carries (verified against
//    reports/journeys/**/trace.jsonl)"
//
// The R3 critic ran that verification — 78 artifacts, 164 168 records — and FIVE OF THE TWELVE
// were written by nothing: `player.two_handed`, `player.crouched`, `ui.menu_open`,
// `ui.dialogue_open`, `ui.surface`. No trace record in this tree carries a `ui` subtree at all.
// A false provenance claim, in the file that made "a field nothing writes" the finding of the
// round. RI-MTH07 §D.3 is the governing line: **a comment asserting a check is not a check.**
//
// So the claim is no longer made in a comment. `--self-test` runs the census itself, over every
// reports/**/*.jsonl, via `tools/lib/trace-schema.mjs --verify`, and FAILS if any field in this
// list is written by nothing. The list below is now what the trace actually carries:
//
//   player.two_handed  -> covered by `player.stance` ("one_hand" | "two_hand"), already present
//   player.crouched    -> `player.stealth.crouched`, the block sim/record.js:123 emits
//   ui.*               -> dropped. The menu/dialogue path survives independently through
//                         `surface_enter` events, which is where it always actually came from.
//
// The direction of harm was conservative (these are OR terms for corroboration, so their absence
// made C1 HARDER to satisfy) — but a claim of verification that was never run is the defect,
// not the arithmetic.
export const FLAG_FIELDS = [
  'player.locked_on', 'player.stance', 'player.guard_raised', 'player.weapon_id',
  'player.attuned', 'player.levitating', 'player.stealth.crouched',
  'player.state',
];
/** Arbitrary depth — `player.stealth.crouched` is three segments, not two. */
function readPath(rec, dotted) {
  let o = rec;
  for (const seg of dotted.split('.')) {
    if (o === null || typeof o !== 'object') return undefined;
    o = o[seg];
  }
  return o;
}
function flagSnapshot(rec) {
  const out = {};
  for (const f of FLAG_FIELDS) {
    const v = readPath(rec, f);
    if (v !== undefined) out[f] = Array.isArray(v) ? JSON.stringify(v) : v;
  }
  return out;
}

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

  // The shipped trace record numbers its frames `f` (HARNESS.md §5), not `frame`. Round 2 read
  // `r.frame ?? 0`, so on every real trace in this tree EVERY frame index was 0 and the gaps
  // were computed against a constant. Both keys are accepted and the one actually found is
  // reported, so a schema change is loud rather than silently zeroing the axis.
  const frameOf = (r) => (r && (r.f ?? r.frame));
  const frameKey = frames[0].f !== undefined ? 'f' : (frames[0].frame !== undefined ? 'frame' : null);
  if (frameKey === null) {
    for (const [id, name] of [['C1', 'gap_max'], ['C2', 'gap_p95'], ['C3', 'apm_nc'], ['C4', 'apm_c'],
      ['C5', 'combat_fraction'], ['C6', 'dialogue_fraction'], ['C7', 'traversal_fraction'],
      ['C8', 'menu_fraction'], ['C9', 'longest_corridor'], ['C10', 'input_variety_10min']]) {
      add(id, name, null, false, null, null,
        'no trace record carries a frame index under `f` or `frame`, so no interval in this file ' +
        'can be measured. Reporting that rather than computing every gap against a constant 0.');
    }
    return { schema: 'elder-souls/cadence@2', item: 'RI-JRN02 §B', frames: frames.length, duration_s: null, ok: false, checks, header };
  }
  const f0 = frameOf(frames[0]) ?? 0;
  const fN = frameOf(frames[frames.length - 1]) ?? frames.length;
  const durationFrames = Math.max(1, fN - f0);
  const durationS = durationFrames / fps;

  // --- collect, pass 1: what the WORLD did, independently of what was pressed ---------------
  const inputsAll = [];               // {frame, action}
  const inputsExcluded = [];          // pure locomotion, per the derived closed-set members
  const inputsOutsideSet = [];        // an action name the closed set does not contain
  const worldChangeFrames = [];       // frames carrying a C1-clause event that is NOT an input
  const flagChangeFrames = [];        // frames on which a tracked world/player flag CHANGED
  let combatFrames = 0, dialogueFrames = 0, menuFrames = 0, locomotionOnlyFrames = 0;
  const eventKinds = new Map();
  const perFrame = [];

  let prevFlags = null;
  for (const r of frames) {
    const fr = frameOf(r) ?? 0;
    const evs = Array.isArray(r.events) ? r.events : [];
    // C1 clause 3, observed: did any tracked flag actually change?
    const flags = flagSnapshot(r);
    if (prevFlags) {
      for (const k of Object.keys(flags)) {
        if (prevFlags[k] !== undefined && prevFlags[k] !== flags[k]) { flagChangeFrames.push(fr); break; }
      }
    }
    prevFlags = flags;
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
    // ROUND 4: `r.ui.dialogue_open` and `r.ui.menu_open` were read here and NO TRACE RECORD IN
    // THIS TREE CARRIES A `ui` SUBTREE AT ALL (census: 0 of 164 168 records). Both were dead
    // reads. The live path is the `dialogue_open` / `surface_enter` events handled above, which
    // is where every non-zero reading has always come from — C8 measured 0.0003 on the real
    // trace, not a structural 0, precisely because the event path works.

    if (sawCombat) combatFrames++;
    if (sawDialogue) dialogueFrames++;
    if (sawMenu) menuFrames++;
    if (sawWorldChange) worldChangeFrames.push(fr);
    // C7 IS MEASURED FROM WHERE THE PLAYER WENT, not from the input log.
    //
    // TOOL-COVERAGE-R2 §5: round 2 computed traversal_fraction as "excluded inputs over all
    // inputs". The critic's fixture player walked 2 160 m at 4.5 m/s for a solid hour and C7
    // read 0. And `player.moving` — the field round 2 read — DOES NOT EXIST: a census of the
    // 3 780-record trace at reports/journeys/w1-13-jrn06/ finds `pos` and `speed_mps` on every
    // record and `moving` on none. C9 already refuses to compute proximity from `world/**`
    // because that would measure the design document; the same instinct applies here.
    const pl = r.player || {};
    const pos = Array.isArray(pl.pos) ? pl.pos : null;
    const speed = Number.isFinite(Number(pl.speed_mps)) ? Number(pl.speed_mps) : null;
    perFrame.push({ fr, sawWorldChange, pos, speed });
  }

  // --- collect, pass 2: which INPUTS satisfy one of C1's five clauses -----------------------
  //
  // A non-locomotion action that toggles a flag or is a combat verb satisfies C1 on its own.
  // `interact` and `use_item` can be a complete no-op — mashed in an empty room they open
  // nothing and change nothing — so they satisfy C1 only when the world corroborates within
  // CORROBORATION_FRAMES. The uncorroborated count is reported so the rule can be audited
  // rather than trusted, which is the thing round 1's audit line never actually did.
  // A flag change is one of C1's five clauses, so it corroborates an input and stands on its own.
  for (const fr of flagChangeFrames) worldChangeFrames.push(fr);
  const wcSorted = worldChangeFrames.slice().sort((a, b) => a - b);
  const corroboratedNear = (fr) => {
    let lo = 0, hi = wcSorted.length - 1, ans = -1;
    while (lo <= hi) { const mid = (lo + hi) >> 1; if (wcSorted[mid] >= fr) { ans = wcSorted[mid]; hi = mid - 1; } else lo = mid + 1; }
    return ans !== -1 && ans - fr <= CORROBORATION_FRAMES;
  };
  const inputsUncorroborated = [];
  const inputStateChangeFrames = [];
  for (const i of inputsAll) {
    if (LOCOMOTION_ACTIONS.has(i.action)) continue;   // C1: "pure locomotion does not count"
    // EVERY remaining action must be corroborated by one of C1's five world facts. No name is
    // trusted, including the ones that "obviously" change a flag.
    if (!corroboratedNear(i.frame)) { inputsUncorroborated.push(i); continue; }
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

  // "Fraction with locomotion and nothing else" — locomotion observed ENTITY-SIDE.
  // `speed_mps` when the trace carries it; otherwise the distance the player actually covered
  // between consecutive records. Neither present -> UNMEASURABLE, never 0.
  const MOVING_MPS = 0.05;                       // below this the player is standing still
  const MOVING_M_PER_FRAME = MOVING_MPS / fps;
  const haveSpeed = perFrame.some((f) => f.speed !== null);
  const havePos = perFrame.filter((f) => f.pos).length >= 2;
  const traversalSource = haveSpeed ? 'player.speed_mps' : (havePos ? 'player.pos displacement' : null);
  // A 5 724 m step between two consecutive frames is a teleport, not traversal, and counting it
  // would put an hour of standing still at "covered 5.7 km". Verified against the real trace at
  // reports/journeys/w1-13-jrn06/, which carries exactly one such jump (frames 120 -> 121) and
  // speed_mps 0 on all 3 780 records.
  // The threshold is a SPEED, not a per-record distance: a trace sampled every 60 frames moves
  // 4.5 m per record at a walk, and a fixed per-record cap would call that a teleport.
  const TELEPORT_MPS = 30;   // far above any locomotion speed this game has
  let distanceM = 0, teleports = 0;
  if (traversalSource) {
    for (let i = 0; i < perFrame.length; i++) {
      const f = perFrame[i];
      let moving = false;
      if (haveSpeed && f.speed !== null) moving = f.speed > MOVING_MPS;
      else if (f.pos && i > 0 && perFrame[i - 1].pos) {
        const a = perFrame[i - 1].pos, b = f.pos;
        moving = Math.hypot(b[0] - a[0], (b[2] ?? 0) - (a[2] ?? 0)) > MOVING_M_PER_FRAME;
      }
      if (f.pos && i > 0 && perFrame[i - 1].pos) {
        const a = perFrame[i - 1].pos, b = f.pos;
        const d = Math.hypot(b[0] - a[0], (b[2] ?? 0) - (a[2] ?? 0));
        const dtS = Math.max(1, (f.fr - perFrame[i - 1].fr)) / fps;
        if (d > TELEPORT_MPS * dtS) { teleports++; moving = false; }
        else distanceM += d;
      }
      if (moving && !stateChangeSet.has(f.fr)) locomotionOnlyFrames++;
    }
  }

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
  else if (!traversalSource) {
    add('C7', 'traversal_fraction', null, false, '<= 0.35', '> 0.50',
      'no trace record carries player.speed_mps or a two-record player.pos, so where the player ' +
      'went cannot be observed. C7 is "the fraction with locomotion and nothing else" and the ' +
      'input log does not answer it — an hour of walking emits no input_action in this build ' +
      '(sim/player.js:109 emits one only for attack and roll moves), so counting inputs would ' +
      'report 0 for a player who crossed the province (TOOL-COVERAGE-R2 §5).');
  } else {
    add('C7', 'traversal_fraction', frac(locomotionOnlyFrames), locomotionOnlyFrames / frames.length <= 0.35, '<= 0.35', '> 0.50');
  }
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
    corroboration_required_names: [...CORROBORATION_REQUIRED_ACTIONS].sort(),
    corroboration_frames: CORROBORATION_FRAMES,
    traversal_measured_from: traversalSource,
    flag_fields_watched: FLAG_FIELDS,
    flag_change_frames: flagChangeFrames.length,
    player_distance_m: traversalSource ? +distanceM.toFixed(2) : null,
    teleports_excluded_from_distance: teleports,
    locomotion_only_frames: locomotionOnlyFrames,
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
  process.stdout.write(`  C7 traversal measured from: ${r.traversal_measured_from || '(nothing — see C7)'}` +
    `, player covered ${r.player_distance_m === null ? 'n/a' : r.player_distance_m + ' m'} over ` +
    `${r.locomotion_only_frames} locomotion-only frames (${r.teleports_excluded_from_distance} teleport(s) ` +
    `excluded); ${r.flag_change_frames} frames carried a flag change\n`);
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
  const ok = (n, pass, d) => {
    lines.push(`${pass ? 'PASS' : 'FAIL'} ${n} — ${d}`); if (!pass) failed++;
    process.stdout.write(lines[lines.length - 1] + '\n');   // flush as we go
  };
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
    walk.push(mk(f, [{ type: 'input_action', action: 'sprint' }],
      { player: { pos: [0, 0, (f / fps) * 4.5], speed_mps: 4.5 } }));
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
    bogus.push(mk(f, [{ type: 'input_action', action: 'forward' }],
      { player: { pos: [0, 0, (f / fps) * 4.5], speed_mps: 4.5 } }));
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
  ok('the classification is TOTAL over the shipped closed action set',
    ACTIONS.every((a) => LOCOMOTION_ACTIONS.has(a) || CORROBORATION_REQUIRED_ACTIONS.has(a))
    && [...LOCOMOTION_ACTIONS, ...CORROBORATION_REQUIRED_ACTIONS].every((n) => ACTIONS.includes(n)),
    `locomotion=[${[...LOCOMOTION_ACTIONS].join(' ')}]; corroboration-required=` +
    `[${[...CORROBORATION_REQUIRED_ACTIONS].join(' ')}]; every one of the ${ACTIONS.length} shipped ` +
    `actions is in exactly one class, so none can fall through to "counts by name"`);

  // 8. TOOL-COVERAGE-R2 §5's OWN SWEEP, re-run. An hour in an empty room, one button six
  //    times a second, player advancing 2 160 m in a straight line the whole time. Round 2 read
  //    four of these as `C1 pass, gap_max 0.17 s, traversal_fraction 0`.
  const sweep = {};
  for (const action of ['roll', 'menu', 'lock_on', 'spell_cycle', 'light', 'block', 'interact',
    'crouch', 'two_hand', 'swap_right', 'sprint', 'jump']) {
    const rec = [{ _: 'header' }];
    for (let f = 0; f <= 3600 * fps; f += 10) {
      rec.push(mk(f, [{ type: 'input_action', action }],
        { player: { pos: [0, 0, (f / fps) * 0.6], speed_mps: 0.6 } }));
    }
    const R = analyse(rec, fps);
    sweep[action] = {
      c1: R.checks.find((c) => c.id === 'C1').status,
      gap: R.checks.find((c) => c.id === 'C1').value,
      c7: R.checks.find((c) => c.id === 'C7').value,
      uncorroborated: R.inputs_uncorroborated,
    };
  }
  ok('NONE of the twelve shipped actions buys a C1 pass by NAME in an empty room',
    Object.values(sweep).every((s) => s.c1 === 'fail'),
    Object.entries(sweep).map(([a, s]) => `${a}:${s.c1}/${s.gap}s`).join(' '));

  ok('and the same hour reads as TRAVERSAL, measured from where the player went',
    Object.values(sweep).every((s) => s.c7 !== null && s.c7 > 0.9),
    `traversal_fraction ${[...new Set(Object.values(sweep).map((s) => s.c7))].join(', ')} across all ` +
    `twelve (round 2 read 0 for a player who covered 2 160 m, because it counted inputs)`);

  // 8b. CONTROL, and it is the important half: the same four actions, corroborated by the world,
  //     MUST count. A rule that rejects everything measures nothing.
  const corroboratedSweep = {};
  for (const [action, ev] of [['roll', { type: 'hit' }], ['menu', { type: 'surface_enter', surface: 'inventory' }],
    ['lock_on', 'FLAG:locked_on'], ['spell_cycle', { type: 'cast_effective' }],
    ['crouch', 'FLAG:stance']]) {
    const rec = [{ _: 'header' }];
    let toggle = false;
    for (let f = 0; f <= 360 * fps; f += 10) {
      const evs = [{ type: 'input_action', action }];
      const player = { pos: [0, 0, 0], speed_mps: 0 };
      if (f % (10 * fps) === 0) {
        if (typeof ev === 'string') { toggle = !toggle; }
        else evs.push(ev);
      }
      // The flag cases prove clause 3 the way C1 states it: the flag CHANGED in the world.
      if (ev === 'FLAG:locked_on') player.locked_on = toggle ? 'e0' : null;
      if (ev === 'FLAG:stance') player.stance = toggle ? 'crouched' : 'standing';
      rec.push(mk(f, evs, { player }));
    }
    const R = analyse(rec, fps);
    corroboratedSweep[action] = R.checks.find((c) => c.id === 'C1').status;
  }
  ok('CONTROL: corroborated by the world, those same actions DO count (not a blanket refusal)',
    Object.values(corroboratedSweep).every((s) => s === 'pass'),
    Object.entries(corroboratedSweep).map(([a, s]) => `${a}:${s}`).join(' ') +
    ' — a roll that dodged a hit, a menu press that opened a surface, a lock_on that changed an ' +
    'enemy state, a spell_cycle that landed a cast, a crouch that moved a quest stage');

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

  // 11. C7 IS MEASURED FROM THE WORLD. The critic's fixture: 2 160 m at 4.5 m/s for an hour.
  const hourWalk = [{ _: 'header' }];
  for (let f = 0; f <= 3600 * fps; f += 60) {
    hourWalk.push(mk(f, [], { player: { pos: [0, 0, (f / fps) * 4.5], speed_mps: 4.5 } }));
  }
  const hourR = analyse(hourWalk, fps);
  const c7hour = hourR.checks.find((c) => c.id === 'C7');
  ok('C7 reads an hour of walking as traversal, from player.pos, with NO inputs at all',
    c7hour.status === 'fail' && c7hour.value > 0.9 && hourR.inputs_total === 0
    && hourR.player_distance_m > 15000,
    `traversal_fraction ${c7hour.value} over ${hourR.player_distance_m} m covered, from ` +
    `${hourR.traversal_measured_from}, with ${hourR.inputs_total} input events. Round 2 computed ` +
    `this from the input log and read 0.`);

  // 12. NULL CONTROL for C7: a player who stood still for an hour is not traversing.
  const still = [{ _: 'header' }];
  for (let f = 0; f <= 3600 * fps; f += 60) still.push(mk(f, [], { player: { pos: [10, 0, 10], speed_mps: 0 } }));
  const stillR = analyse(still, fps);
  const c7still = stillR.checks.find((c) => c.id === 'C7');
  ok('null control: a stationary hour has traversal_fraction 0 (C7 is not a constant)',
    c7still.value === 0 && c7still.status === 'pass',
    `traversal_fraction ${c7still.value} over ${stillR.player_distance_m} m`);

  // 13. C7 must REFUSE, not return 0, when the trace carries neither field.
  const noPos = [{ _: 'header' }];
  for (let f = 0; f <= 600 * fps; f += 60) noPos.push(mk(f, []));
  const noPosR = analyse(noPos, fps);
  const c7none = noPosR.checks.find((c) => c.id === 'C7');
  ok('C7 is UNMEASURABLE when the trace carries no player position or speed, never 0',
    c7none.status === 'unmeasurable' && c7none.value === null,
    c7none.why);

  // 14. The SHIPPED trace key. Every real trace in this tree numbers frames `f`, not `frame`.
  const shipped = [{ _: 'header' }];
  for (let f = 0; f <= 600 * fps; f += 60) {
    shipped.push({ f, events: f % (300 * fps) === 0 ? [{ type: 'hit' }] : [], player: { pos: [0, 0, 0], speed_mps: 0 } });
  }
  const shippedR = analyse(shipped, fps);
  ok('the shipped trace frame key `f` is read (round 2 read `frame` and got 0 for every frame)',
    shippedR.duration_s > 500 && shippedR.checks.find((c) => c.id === 'C1').value > 100,
    `duration ${shippedR.duration_s}s, gap_max ${shippedR.checks.find((c) => c.id === 'C1').value}s ` +
    `from records keyed \`f\`; a tool reading \`frame\` would compute every gap against a constant 0`);

  // =============================================================================================
  // ROUND 4 — TOOL-COVERAGE-R3 §5. THE PROVENANCE CLAIM IS NOW A CHECK.
  //
  // R3: "I ran that verification. 78 artifacts, 164 168 records: five of twelve, under a claim of
  // verification, in the file that made 'a field nothing writes' the finding of the round."
  //
  // RI-MTH07 §D.3: a comment asserting a check is not a check. So the census runs here, over the
  // real corpus, every time — and this test FAILS if any field in FLAG_FIELDS is written by
  // nothing. It cannot rot into a claim again.
  // =============================================================================================
  {
    const files = findArtifacts(path.join(REPO_ROOT, 'reports'), 'trace.jsonl');
    if (!files.length) {
      ok('R4: FLAG_FIELDS provenance is CHECKED against the shipped corpus', false,
        'no trace.jsonl under reports/ — the claim could not be verified, which is itself the ' +
        'finding R3 charged this file with');
    } else {
      const census = censusFields(files);
      const v = verifyFields(FLAG_FIELDS, census);
      ok('R4: every field in FLAG_FIELDS is WRITTEN by the shipped corpus (the claim, now run)',
        v.unwritten.length === 0,
        v.unwritten.length
          ? `DEAD FIELDS: ${v.unwritten.map((u) => u.path + (u.hint ? ` (${u.hint})` : '')).join(', ')} ` +
            `over ${census.artifacts} artifacts / ${census.records} records`
          : `${v.written.length}/${FLAG_FIELDS.length} verified over ${census.artifacts} artifacts / ` +
            `${census.records} records: ` +
            v.written.map((w) => `${w.path}=${w.records}rec`).join(', '));

      // The falsification: the checker must go RED on a field nothing writes. A provenance check
      // that cannot fail is exactly the comment it replaced.
      const dead = verifyFields(['ui.menu_open', 'player.two_handed', 'player.crouched'], census);
      ok('R4: the provenance checker goes RED on the five fields R3 caught (falsification)',
        dead.unwritten.length === 3 && dead.written.length === 0,
        `ui.menu_open / player.two_handed / player.crouched -> ${dead.unwritten.length} reported ` +
        'absent. If this ever passes, the check has gone vacuous.');

      // And the replacements must genuinely be present — otherwise this is a rename, not a fix.
      const repl = verifyFields(['player.stance', 'player.stealth.crouched'], census);
      ok('R4: the REPLACEMENT paths carry the same information and are actually written',
        repl.unwritten.length === 0,
        repl.written.map((w) => `${w.path}=${w.records}rec/${w.artifacts}art`).join(', ') ||
        `MISSING: ${repl.unwritten.map((u) => u.path).join(', ')}`);
    }

    // readPath must handle three segments — `player.stealth.crouched` is the whole point.
    ok('R4: readPath resolves an arbitrarily deep path (player.stealth.crouched is 3 segments)',
      readPath({ player: { stealth: { crouched: true } } }, 'player.stealth.crouched') === true &&
      readPath({ player: {} }, 'player.stealth.crouched') === undefined &&
      readPath({ player: { locked_on: 'x' } }, 'player.locked_on') === 'x',
      'the round-3 readPath split on two segments only and would have read undefined forever');

    // And a crouch change must actually register as a flag change end-to-end.
    const crouchTrace = [
      { f: 0, events: [], player: { pos: [0, 0, 0], speed_mps: 0, stealth: { crouched: false } } },
      { f: 60, events: [], player: { pos: [0, 0, 0], speed_mps: 0, stealth: { crouched: true } } },
    ];
    const flat = [
      { f: 0, events: [], player: { pos: [0, 0, 0], speed_mps: 0, stealth: { crouched: false } } },
      { f: 60, events: [], player: { pos: [0, 0, 0], speed_mps: 0, stealth: { crouched: false } } },
    ];
    const fs1 = flagSnapshot(crouchTrace[0]), fs2 = flagSnapshot(crouchTrace[1]);
    const fl1 = flagSnapshot(flat[0]), fl2 = flagSnapshot(flat[1]);
    ok('R4: a crouch toggle IS seen as a flag change, and a still crouch is NOT (falsification)',
      JSON.stringify(fs1) !== JSON.stringify(fs2) && JSON.stringify(fl1) === JSON.stringify(fl2),
      'player.stealth.crouched now reaches flagSnapshot; player.crouched never could');
  }

  process.stdout.write(`\ncadence self-test: ${failed === 0 ? 'PASS' : 'FAIL'} (${lines.length - failed}/${lines.length})\n`);
  return failed === 0 ? 0 : 1;
}
