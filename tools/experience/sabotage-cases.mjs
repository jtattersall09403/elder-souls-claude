// sabotage-cases.mjs — THE THREE REAL FAILURES, REPLAYED THROUGH THE FACILITY.
//
// RULES.md #4 says break the thing you measure and confirm the instrument goes red. For a
// facility whose whole job is to detect broken controls, that means something stricter than a
// synthetic fixture: **it has to reproduce controls that were actually shipped green on this
// tree and say why each of them measured nothing.** A control facility that cannot reproduce a
// known inert control is not evidence.
//
// Every number below is READ FROM AN ARTIFACT ON DISK that another agent wrote. Nothing here is
// hand-entered, hand-reconstructed or simulated; if a report moves, these cases move with it,
// and if a report is deleted the case reports its own absence and exits non-zero rather than
// quietly passing. The three failures and their sources:
//
//   CASE 1 — THE ARMS AGREED (W1-04 round 3, e37d327)
//     `reports/w1-04-r3-collision.json`
//       §`0_goes_red` is the PRE-FIX `__w1_04_townSolids`, re-created inside the page by the
//         successor and re-run through the same check: five towns, `shapes_with_walls` ==
//         `shapes_walls_cut` in all five. The walls never came out. -> must read INERT.
//       §`0_instrument` is the SAME check with the fix (one deleted line, `engine._townCell =
//         null`, in `game/src/harness/api.js`): 67/0, 94/0, 60/0, 72/0, 67/0. -> must read OK.
//     This is the only one of the three where a broken and a fixed version of the same verb were
//     both measured in the same browser session, which is why it is the cleanest demonstration.
//
//   CASE 2 — EACH GUARD MEASURED INERT ALONE (W1-SOULS round 3, 3124790)
//     `reports/critic-souls-r3-{INTACT,DELETED-identity,DELETED-boundary,DELETED-identity-boundary}.json`
//       Four real browser runs, one per cell of a 2x2 over {identity guard, boundary guard}.
//       Single-factor arms: 252 day / 342 night, identical to intact. Both arms.
//       Both broken:        0 / 0.
//     Run as the project usually runs delete-the-fix — one factor at a time — each arm is INERT
//     and reports its guard as dead code. Run as a factorial, the facility reports MASKED and
//     names the minimal breaking set. The second is the true finding and it took a critic a full
//     round to reach; the facility reaches it from the same four files.
//
//   CASE 4 — THE TEARDOWN SHORT-CIRCUITED UPSTREAM (W1-14 round 3), added in round 2 on the
//     r1 verdict's §C. `reports/w1-14-r3/dials{,-break-nocast}.json`.
//       The builder shipped `--break=nocast` as the control for its magnitude-dial census and
//       recorded "the instrument cannot manufacture a coupling out of arena noise". A human
//       critic (W1-14-r3.json, `inert_control:RI-MAG06`) found it inert in RULES #6's second
//       sense: every one of the 55 rows exits at `NOT_DELIVERED` BEFORE `readDial()` is called,
//       so the comparator under test never ran in the control arm. 33 coupled vs 0, loudly. ->
//       must read VACUOUS, with SHORT_CIRCUIT beside it in `concurrent_failures`.
//
//   CASE 5 — THE SAME TWO FILES, PASSED. Carried on purpose, as the facility's own limit.
//       Declare support as "effects the census EXAMINED" (55 in both arms) instead of "effects
//       that DELIVERED" (55 and 0) and the identical control reads OK. There is no rule over the
//       numbers that separates them — {33,55} vs {0,55} is the same shape as W1-04's fixed arm
//       at 67 -> 0 over 360. The only thing that separates them is the `unit` string, which
//       round 2 makes mandatory and puts on the record so a human can read it. This case exists
//       so that limit is in the tracked corpus rather than in a paragraph of a verdict.
//
//   CASE 3 — THE CONTROL HAD NOTHING IN IT (W1-13 round 4, b900460)
//     `reports/runs/W1-13-R4/clock-consequences.json` and
//     `reports/journeys/w1-13-r4-jrn06/journey.json`
//       `c2_night_roster_active` passed on npcs_moved 25 vs control 0 — with `roster_n` 0 in the
//       control arm, and 0 in EVERY arm of the aggregation. -> must read VACUOUS.
//       `c3_merchants_closed`, in the same run, off the same rest verb: 71 of 115 shops closed
//       vs 0 in the control, `shops_total` 115 in both arms. -> must read OK.
//     Same tool, same run, same rest. One clause had a population and one did not, and no
//     instrument in the wave could tell them apart. That is the whole case for support
//     accounting.
'use strict';

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { VERDICT } from './lib/sabotage.mjs';
import { resolveCase } from './sabotage-corpus.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const REPO = path.resolve(HERE, '..', '..');

/** Which path each artifact was actually read from, so the CLI can report tracked vs. origin. */
export const provenance = [];

/**
 * Read an artifact, or refuse. An absent artifact is an absence, never a pass (RULES #24).
 *
 * Round 2: prefer the TRACKED TWIN under `reports/experience/sabotage-corpus/`. Round 1 read the
 * originals, all nine of which are excluded by `reports/.gitignore`, so on a fresh clone every
 * case reported ABSENT and `--cases` exited 8 — the whole value of replaying real history is
 * that it is history, and history that is not tracked is not history (W1-25-r1 §C).
 * `tools/experience/sabotage-corpus.mjs` writes the twins and hash-verifies them against the
 * originals whenever the container still has both.
 */
function artifact(rel) {
  const r = resolveCase(rel);
  if (!r) {
    throw new Error(`ABSENT: ${rel} — this case replays a measurement another agent wrote and ` +
      `neither that file nor its tracked twin is on the tree. Run ` +
      `\`node tools/experience/sabotage-corpus.mjs --sync\` on a container that still has the ` +
      `original. The case cannot be run and must not be scored.`);
  }
  provenance.push({ origin: rel, read: r.path, tracked: r.tracked });
  return JSON.parse(fs.readFileSync(path.join(REPO, r.path), 'utf8'));
}

/** A measure() that just serves a recorded arm. Replay, not simulation. */
function replay(table) {
  return async (broken) => {
    const key = broken.length ? broken.slice().sort().join('+') : '(intact)';
    const row = table[key];
    if (!row) throw new Error(`no recorded arm for "${key}" — recorded arms: ${Object.keys(table).join(', ')}`);
    return row;
  };
}

// ---------------------------------------------------------------------------------------------

function case1() {
  const rel = 'reports/w1-04-r3-collision.json';
  const j = artifact(rel);
  const fixed = j.sections && j.sections['0_instrument'];
  const red = j.sections && j.sections['0_goes_red'] && j.sections['0_goes_red'].rows;
  if (!Array.isArray(fixed) || !Array.isArray(red)) {
    throw new Error(`ABSENT: ${rel} no longer carries both §0_instrument and §0_goes_red.rows.`);
  }
  const towns = (rows, on, off) => ({
    value: rows.map((r) => r[off]),
    support: rows.reduce((s, r) => s + Number(r[on] || 0), 0),
    detail: { per_town: rows.map((r) => ({ town: r.settlement, with_walls: r[on], walls_cut: r[off] })) },
  });
  const intact = (rows, on) => ({
    value: rows.map((r) => Number(r[on])),
    support: rows.reduce((s, r) => s + Number(r[on] || 0), 0),
  });

  return [
    {
      id: 'w1-04-collision.BROKEN (pre-fix verb, replayed from §0_goes_red)',
      what: 'walk into a settlement wall with the walls taken out — the pre-fix `__w1_04_townSolids`, ' +
        're-created in the page at e37d327 and re-run through the same check',
      metric: 'collision shapes in the settlement cell, per town',
      unit: 'collision shapes present in a settlement cell with the walls in (summed over the five towns)',
      source: rel + ' §0_goes_red',
      factors: [{ id: 'walls', what: '__w1_04_townSolids(false) — take the town walls out of the collision cell' }],
      minSupport: 5,
      measure: replay({
        '(intact)': intact(red, 'shapes_with_walls'),
        walls: towns(red, 'shapes_with_walls', 'shapes_walls_cut'),
      }),
      expect: VERDICT.INERT,
    },
    {
      id: 'w1-04-collision.FIXED (shipped verb, replayed from §0_instrument)',
      what: 'the same check with the one-line fix in game/src/harness/api.js',
      metric: 'collision shapes in the settlement cell, per town',
      unit: 'collision shapes present in a settlement cell with the walls in (summed over the five towns)',
      source: rel + ' §0_instrument',
      factors: [{ id: 'walls', what: '__w1_04_townSolids(false) — take the town walls out of the collision cell' }],
      minSupport: 5,
      measure: replay({
        '(intact)': intact(fixed, 'shapes_with_walls'),
        walls: towns(fixed, 'shapes_with_walls', 'shapes_walls_cut'),
      }),
      direction: 'lower',
      margin: { kind: 'differs' },
    },
  ];
}

// ---------------------------------------------------------------------------------------------

function case2() {
  const files = {
    '(intact)': 'reports/critic-souls-r3-INTACT.json',
    identity: 'reports/critic-souls-r3-DELETED-identity.json',
    boundary: 'reports/critic-souls-r3-DELETED-boundary.json',
    'boundary+identity': 'reports/critic-souls-r3-DELETED-identity-boundary.json',
  };
  const table = {};
  for (const [k, rel] of Object.entries(files)) {
    const j = artifact(rel);
    const d2 = j.arms && j.arms.D2_night_multiplier;
    if (!d2) throw new Error(`ABSENT: ${rel} no longer carries arms.D2_night_multiplier.`);
    table[k] = {
      value: { day_1400: d2.day_1400, night_2300: d2.night_2300 },
      support: Number(d2.bodies || 0),
      detail: { label: j.label, at: j.at, ratio: d2.ratio },
    };
  }
  const F = {
    identity: { id: 'identity', what: 'game/src/sim/souls.js — `_alive` keyed on the entity OBJECT (`rec.ref !== e`)' },
    boundary: { id: 'boundary', what: 'game/src/engine.js `_sessionObservers()` — `sim.souls.reset()` at BOTH boundaries' },
  };

  return [
    {
      id: 'w1-souls-guards.AS-RUN identity alone (one-factor delete-the-fix)',
      what: 'delete-the-fix as the round actually ran it: remove the identity guard and see whether the number moves',
      metric: 'souls paid for the same six-body fight, day and night',
      unit: 'bodies killed in the fight the souls were paid for',
      source: `${files['(intact)']} + ${files.identity}`,
      factors: [F.identity],
      measure: replay({ '(intact)': table['(intact)'], identity: table.identity }),
      expect: VERDICT.INERT,
    },
    {
      id: 'w1-souls-guards.AS-RUN boundary alone (one-factor delete-the-fix)',
      what: 'the other half, run the same way',
      metric: 'souls paid for the same six-body fight, day and night',
      unit: 'bodies killed in the fight the souls were paid for',
      source: `${files['(intact)']} + ${files.boundary}`,
      factors: [F.boundary],
      measure: replay({ '(intact)': table['(intact)'], boundary: table.boundary }),
      expect: VERDICT.INERT,
    },
    {
      id: 'w1-souls-guards.FACTORIAL 2x2 (what the facility does instead)',
      what: 'the same four browser runs, enumerated as a factorial over both guards',
      metric: 'souls paid for the same six-body fight, day and night',
      unit: 'bodies killed in the fight the souls were paid for',
      source: Object.values(files).join(' + '),
      factors: [F.identity, F.boundary],
      measure: replay(table),
      expect: VERDICT.MASKED,
    },
  ];
}

// ---------------------------------------------------------------------------------------------

function case3() {
  const relRun = 'reports/runs/W1-13-R4/clock-consequences.json';
  const relAgg = 'reports/journeys/w1-13-r4-jrn06/journey.json';
  const run = artifact(relRun);
  const m8 = run.checks && run.checks.a_method_8;
  if (!m8 || !m8.rested || !m8.control) throw new Error(`ABSENT: ${relRun} no longer carries checks.a_method_8.{rested,control}.`);

  // The aggregation: the same clause, rolled up, with roster {} in every arm.
  const agg = artifact(relAgg);
  const aggArms = [];
  (function walk(o) {
    if (!o || typeof o !== 'object') return;
    if (Object.prototype.hasOwnProperty.call(o, 'npcs_moved_n')) {
      const r = (o.before && o.before.roster) || o.roster || (o.after && o.after.roster) || null;
      if (r) aggArms.push({ moved: Number(o.npcs_moved_n), roster_n: Object.keys(r).length });
    }
    for (const k of Object.keys(o)) walk(o[k]);
  })(agg);

  const out = [];

  out.push({
    id: 'w1-13-r4.NIGHT-ROSTER at the hearth (the clause that set the score)',
    what: 'does resting move the NPC roster? — rested arm vs a no-rest control, at hearth-archon',
    metric: 'NPCs whose posting changed over the window',
    unit: 'NPCs on the hearth roster when the window opened — the population the clause ranged over',
    source: relRun + ' checks.a_method_8',
    factors: [{ id: 'no_rest', what: 'remove the rest — the control arm: advance no clock' }],
    measure: replay({
      '(intact)': { value: Number(m8.rested.npcs_moved_n), support: Number(m8.rested.before.roster_n), detail: { arm: 'rested' } },
      no_rest: { value: Number(m8.control.npcs_moved_n), support: Number(m8.control.before.roster_n), detail: { arm: 'control' } },
    }),
    expect: VERDICT.VACUOUS,
  });

  if (aggArms.length >= 2) {
    out.push({
      id: 'w1-13-r4.NIGHT-ROSTER in the aggregation (roster {} in every arm)',
      what: 'the same clause as the jrn06 journey rolled it up',
      metric: 'NPCs whose posting changed over the window',
      unit: 'NPCs on the roster the aggregation rolled up',
      source: relAgg,
      factors: [{ id: 'no_rest', what: 'the no-rest control arm' }],
      measure: replay({
        '(intact)': { value: aggArms[0].moved, support: aggArms[0].roster_n },
        no_rest: { value: aggArms[1].moved, support: aggArms[1].roster_n },
      }),
      expect: VERDICT.VACUOUS,
    });
  }

  const c3 = m8.clauses && m8.clauses.c3_merchants_closed;
  if (c3) {
    out.push({
      id: 'w1-13-r4.MERCHANTS-CLOSED — the sound clause from the same run',
      what: 'does resting close the shops? — same rest verb, same run, a population that is not empty',
      metric: 'shops closed over the window',
      unit: 'shops in the settlement the window ranged over',
      source: relRun + ' checks.a_method_8.clauses.c3_merchants_closed',
      factors: [{ id: 'no_rest', what: 'remove the rest — the control arm: advance no clock' }],
      measure: replay({
        '(intact)': { value: Number(c3.shops_closed), support: Number(m8.rested.before.shops_total || c3.of) },
        no_rest: { value: Number(c3.control_shops_closed), support: Number(m8.control.before.shops_total || c3.of) },
      }),
      direction: 'lower',
    });
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// CASE 4 and CASE 5 — the fourth historical failure, and the facility's own limit beside it.
// Added in round 2 on W1-25-r1 §C. Both are built from the SAME TWO artifacts; the only thing
// that differs between them is which number the caller calls `support`, and that is the point.

function case45() {
  const relI = 'reports/w1-14-r3/dials.json';
  const relB = 'reports/w1-14-r3/dials-break-nocast.json';
  const I = artifact(relI).summary, B = artifact(relB).summary;
  if (!I || !B) throw new Error(`ABSENT: ${relI} / ${relB} no longer carry \`summary\`.`);
  const F = [{ id: 'nocast', what: 'tools/harness/w1-14-r3-dials.mjs --break=nocast — the builder\'s declared teardown' }];
  const base = {
    what: 'does the magnitude-dial census manufacture couplings out of arena noise? (W1-14-r3\'s own control question)',
    metric: 'magnitude_coupled, of 55 effects',
    source: `${relI} + ${relB}`,
    factors: F,
  };
  return [
    {
      ...base,
      id: 'w1-14-r3.NOCAST — support = effects that reached the comparator',
      // `active` is the number of rows that got past `if (!base.delivered) continue;` and
      // therefore reached readDial(). 55 intact, 0 under the break.
      unit: 'magic effects that were delivered and therefore reached readDial()',
      measure: replay({
        '(intact)': { value: I.magnitude_coupled, support: I.active, detail: { active: I.active, not_delivered: (I.not_delivered || []).length } },
        nocast: { value: B.magnitude_coupled, support: B.active, detail: { active: B.active, not_delivered: (B.not_delivered || []).length } },
      }),
      expect: VERDICT.VACUOUS,
    },
    {
      ...base,
      id: 'w1-14-r3.NOCAST-AS-EXAMINED — the same control, passed (the facility\'s own limit)',
      what: base.what + ' — declared with support meaning "effects the census ENUMERATED" rather than ' +
        '"effects that reached the comparator". Identical files, identical values, and it passes.',
      unit: 'magic effects the census enumerated, delivered or not',
      measure: replay({
        '(intact)': { value: I.magnitude_coupled, support: I.total },
        nocast: { value: B.magnitude_coupled, support: B.total },
      }),
      // Declared OK on purpose. {33 over 55} vs {0 over 55} is byte-identical in shape to
      // W1-04's fixed arm at 67 -> 0 over 360, so no rule over the numbers can separate them.
      // What round 2 buys is that the wrong reading is now WRITTEN DOWN, in `unit`, on the
      // record, where a human reading the report can see "enumerated, delivered or not" beside
      // a control whose teardown stops delivery. That is the whole claim, and no more than it.
      expect: VERDICT.OK,
    },
  ];
}

/**
 * Every historical case. Each entry that cannot be built from disk is returned as a `broken`
 * record rather than thrown away, so the CLI can report the absence and exit non-zero.
 */
export function historicalCases() {
  const built = [], absent = [];
  provenance.length = 0;
  for (const [name, fn] of [['w1-04 collision', case1], ['w1-souls guards', case2],
    ['w1-13 empty control', case3], ['w1-14 nocast short-circuit', case45]]) {
    try { built.push(...fn()); } catch (e) { absent.push({ case: name, why: String((e && e.message) || e) }); }
  }
  return { cases: built, absent };
}
