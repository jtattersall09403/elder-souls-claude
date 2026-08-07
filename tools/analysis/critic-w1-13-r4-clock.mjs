// critic-w1-13-r4-clock.mjs — W1-13 ROUND-4 CRITIC's own instrument, written with fresh context
// and declared under `method_deviations`.
//
// WHY IT IS NOT THE BUILDER'S PROBE. `tools/harness/w1-13-r4-clock-consequences.mjs` drives the
// browser build and monkeypatches the award clock at runtime (`sim.env.awardTimeOfDay =
// sim.env.timeOfDay`, line 310) to make its "fix deleted" arm. That is a *simulated* deletion:
// it leaves `§1b` executing and overwrites its output afterwards. RULES.md 6 asks for the change
// to be REMOVED. This file removes it FROM THE SOURCE — `game/src/sim/environment.js` §1b's four
// executable lines and `game/src/sim/souls.js`'s `awardHour` read are cut out of copies of the
// two files, and the copies are imported instead. Both modules have ZERO imports of their own
// (checked), so they relocate exactly.
//
// It also needs no browser, which matters: `pgrep -c headless_shell` was 18-24 and
// `/proc/loadavg` 16.9 on four cores for the whole of this critique (RULES.md 21, 26).
//
// WHAT IT MEASURES
//
//   A  THE ARMS ARE REAL. The two source texts differ, each cut matched exactly once, and a
//      deletion that matched nothing is a hard error rather than a silent pass.
//   B  THE FACTORIAL. `{award clock in §1b} x {souls.js reads it}` — 2x2, not 1x1, so "the fix is
//      where the builder says it is" is a measurement rather than a correlation.
//   C  THE INVARIANT OVER THE WHOLE DAY. Not two boundary hours: 96 start hours at 15-game-minute
//      resolution, dying vs living over matched frames, shipped and deleted.
//   D  DETERMINISM, properly: 40 repeats from 6 start states, and the FLOAT-ORDERING question a
//      sibling piece root-caused elsewhere, asked of this file's own accumulator.
//   E  METHOD 8's clauses recomputed off the shipped data with the engine's own readers
//      (`settlement.js#isOpen`, `npc.js#slotAt`), plus the N-rest round trip at N = 4, 8, 12 from
//      three start hours — and the question the builder's c6 does not ask: is the world RESTORED
//      or merely RE-READ?
//   F  DOES THE AWARD CLOCK REACH ANYTHING SOULS-SIDE IT SHOULD NOT? A static reach census over
//      `game/src/**` for every reader of the two clocks, classified against damage / poise /
//      stamina / frames.
//
// Exits non-zero if any arm is inert or any assertion this file makes turns out false. It has no
// "pass" branch it can reach without the delete-the-fix arms having actually differed.
'use strict';

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execSync } from 'node:child_process';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const SRC = path.join(ROOT, 'game/src/sim');
const DATA = path.join(ROOT, 'game/data');
const OUT = process.env.CRITIC_OUT
  || path.join(ROOT, 'corpus/90-verdicts/wave1/artifacts/W1-13-r4/critic-clock.json');
const SCRATCH = process.env.CRITIC_SCRATCH
  || '/tmp/claude-0/-home-user-elder-souls-claude/3c195166-6f14-54d0-bf0f-867f7b39d84b/scratchpad/w1-13-r4';

const rd = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
const fail = [];
const assert = (cond, what) => { if (!cond) fail.push(what); return !!cond; };

// ---------------------------------------------------------------------------------------------
// A. build the four module variants by CUTTING THE SOURCE
// ---------------------------------------------------------------------------------------------

const envSrc = fs.readFileSync(path.join(SRC, 'environment.js'), 'utf8');
const soulsSrc = fs.readFileSync(path.join(SRC, 'souls.js'), 'utf8');

// RULES.md 17: a delete-the-fix on a shared tree must check the git INDEX, not just the file.
function gitState() {
  const q = (c) => { try { return execSync(c, { cwd: ROOT }).toString().trim(); } catch { return null; } };
  return {
    commit: q('git rev-parse HEAD'),
    branch: q('git rev-parse --abbrev-ref HEAD'),
    dirty: (q('git status --porcelain') || '').length > 0,
    // the two files under test, as the INDEX sees them, not as the worktree does
    index_env: q('git diff --cached --name-only -- game/src/sim/environment.js') || '(clean)',
    index_souls: q('git diff --cached --name-only -- game/src/sim/souls.js') || '(clean)',
    worktree_env: q('git diff --name-only -- game/src/sim/environment.js') || '(clean)',
    worktree_souls: q('git diff --name-only -- game/src/sim/souls.js') || '(clean)',
  };
}

/** Cut one exact substring, exactly once. A cut that matches 0 or >1 times is a hard error. */
function cut(src, needle, replacement, label, log) {
  const n = src.split(needle).length - 1;
  if (n !== 1) throw new Error(`INERT CUT: "${label}" matched ${n} times, expected exactly 1. `
    + 'The instrument is measuring a file it does not understand; refusing to report a number.');
  log.push({ cut: label, matched: n, bytes_removed: needle.length - replacement.length });
  return src.replace(needle, replacement);
}

const cutLog = [];

// --- environment.js §1b: the award clock itself -----------------------------------------------
const ENV_1B = `    if (env._awardFrames === undefined || env._awardFrames === null) env._awardFrames = env._clockFrames | 0;
    if (!this.paused) env._awardFrames = ((env._awardFrames | 0) + 1) % FRAMES_PER_DAY;
    env.awardTimeOfDay = this._hoursFor(env._awardFrames | 0);`;
const ENV_DISCHARGE = `      env._awardFrames = env._clockFrames;`;

const envDeleted = cut(
  cut(envSrc, ENV_1B, '    /* §1b DELETED BY THE CRITIC */', 'environment.js §1b tick', cutLog),
  ENV_DISCHARGE, '      /* discharge DELETED BY THE CRITIC */', 'environment.js §1b discharge', cutLog,
);

// --- souls.js: the read ------------------------------------------------------------------------
const SOULS_READ = `      const awardHour = env && Number.isFinite(env.awardTimeOfDay) ? env.awardTimeOfDay : (env && env.timeOfDay);`;
const soulsDeleted = cut(soulsSrc, SOULS_READ,
  '      const awardHour = env && env.timeOfDay; /* r3 BEHAVIOUR RESTORED BY THE CRITIC */',
  'souls.js awardHour read', cutLog);

fs.mkdirSync(SCRATCH, { recursive: true });
const variants = {
  env_ship: path.join(SCRATCH, 'environment.ship.js'),
  env_del: path.join(SCRATCH, 'environment.del.js'),
  souls_ship: path.join(SCRATCH, 'souls.ship.js'),
  souls_del: path.join(SCRATCH, 'souls.del.js'),
};
fs.writeFileSync(variants.env_ship, envSrc);
fs.writeFileSync(variants.env_del, envDeleted);
fs.writeFileSync(variants.souls_ship, soulsSrc);
fs.writeFileSync(variants.souls_del, soulsDeleted);

assert(envSrc !== envDeleted, 'environment.js arms are byte-identical — the cut did nothing');
assert(soulsSrc !== soulsDeleted, 'souls.js arms are byte-identical — the cut did nothing');
assert(!/^\s*import /m.test(envSrc), 'environment.js has imports; relocating it is unsound');
assert(!/^\s*import /m.test(soulsSrc), 'souls.js has imports; relocating it is unsound');

const mods = {};
for (const [k, p] of Object.entries(variants)) mods[k] = await import(pathToFileURL(p).href);

// ---------------------------------------------------------------------------------------------
// the mini-sim: the SHIPPED modules, stepped in `sim/step.js`'s order (environment, then souls)
// ---------------------------------------------------------------------------------------------

const weather = rd(path.join(DATA, 'world/weather.json'));
const enemies = {};
for (const f of fs.readdirSync(path.join(DATA, 'combat/enemies')).sort()) {
  if (!f.endsWith('.json')) continue;
  const d = rd(path.join(DATA, 'combat/enemies', f));
  if (d && d.id) enemies[d.id] = d;
}
const ORDINARY = 'inf_trash';
assert(enemies[ORDINARY] && enemies[ORDINARY].souls === 42,
  `${ORDINARY} no longer declares souls: 42 — the fixture the whole round is stated in has moved`);

let EID = 1;
function body(id = ORDINARY) { return { eid: `e${EID++}`, id, tier: 'trash', hp: 100, state: 'IDLE' }; }

function makeSim(hour, { envMod, soulsMod }) {
  const Environment = envMod.Environment;
  const SoulsSystem = soulsMod.SoulsSystem;
  const sim = {
    frame: 0,
    entities: [],
    progression: { soulsHeld: 0 },
    _death: { active: false },
    player: null,
    env: { timeOfDay: hour, dayCount: 0, weather: weather.regions[0].initial },
  };
  sim.environment = new Environment(weather, () => null);
  sim.souls = new SoulsSystem(enemies, () => 0);
  return sim;
}

function step(sim, soulsMod, n = 1) {
  for (let i = 0; i < n; i++) {
    sim.frame++;
    sim.environment.step(sim, null);
    soulsMod.stepSouls(sim, null);
  }
}

/** Kill one ordinary enemy in the running mini-sim and return what the world paid for it. */
function killOne(sim, soulsMod) {
  const e = body();
  sim.entities.push(e);
  step(sim, soulsMod, 1);              // souls sees it alive
  const before = sim.progression.soulsHeld;
  e.hp = 0; e.state = 'DEAD';
  step(sim, soulsMod, 1);              // souls sees the transition and pays
  const paid = sim.progression.soulsHeld - before;
  sim.entities.length = 0;
  return paid;
}

/**
 * Spend `frames` either DEAD or ALIVE, then kill one ordinary enemy. This is the whole AR-1
 * question in one function: the two arms differ ONLY in whether `sim._death.active` was set.
 */
function arm({ hour, dying, deaths, surfaceFrames, envKey, soulsKey }) {
  const envMod = mods[envKey], soulsMod = mods[soulsKey];
  const sim = makeSim(hour, { envMod, soulsMod });
  step(sim, soulsMod, 1);
  const h0 = sim.env.timeOfDay, a0 = sim.env.awardTimeOfDay ?? sim.env.timeOfDay;
  let frames = 0;
  for (let d = 0; d < deaths; d++) {
    if (dying) sim._death.active = true;
    step(sim, soulsMod, surfaceFrames);
    frames += surfaceFrames;
    sim._death.active = false;
    step(sim, soulsMod, 1);            // the frame the body stands up / the blow lands
    frames += 1;
  }
  const paid = killOne(sim, soulsMod);
  const h1 = sim.env.timeOfDay, a1 = sim.env.awardTimeOfDay ?? sim.env.timeOfDay;
  const wrap = (x) => Math.round(((x % 24) + 24) % 24 * 1e6) / 1e6;
  return {
    hour_before: h0, hour_after: h1, award_before: a0, award_after: a1,
    frames_elapsed: frames,
    world_hours_burned: wrap(h1 - h0),
    award_hours_burned: wrap(a1 - a0),
    souls_for_one_ordinary_kill: paid,
  };
}

// ---------------------------------------------------------------------------------------------
// B. THE 2x2 FACTORIAL — is the fix where the builder says it is?
// ---------------------------------------------------------------------------------------------

const DEATHS = 40, SURFACE = 150;                     // 40 x 151 f@60 = 6,040 f@60, the builder's fixture
const BOUNDS = { out_of_the_night_window: 4.5, into_the_night_window: 20.966666 };

const factorial = {};
for (const [name, hour] of Object.entries(BOUNDS)) {
  factorial[name] = {};
  for (const envKey of ['env_ship', 'env_del']) {
    for (const soulsKey of ['souls_ship', 'souls_del']) {
      const cell = `${envKey === 'env_ship' ? 'env§1b IN' : 'env§1b OUT'} / ${soulsKey === 'souls_ship' ? 'souls READS award' : 'souls READS world'}`;
      const dying = arm({ hour, dying: true, deaths: DEATHS, surfaceFrames: SURFACE, envKey, soulsKey });
      const alive = arm({ hour, dying: false, deaths: DEATHS, surfaceFrames: SURFACE, envKey, soulsKey });
      factorial[name][cell] = {
        dying_paid: dying.souls_for_one_ordinary_kill,
        alive_paid: alive.souls_for_one_ordinary_kill,
        equal: dying.souls_for_one_ordinary_kill === alive.souls_for_one_ordinary_kill,
        world_h_burned_dying: dying.world_hours_burned,
        world_h_burned_alive: alive.world_hours_burned,
        award_h_burned_dying: dying.award_hours_burned,
      };
    }
  }
}

// ---------------------------------------------------------------------------------------------
// C. THE INVARIANT OVER THE WHOLE DAY, not at two hours
// ---------------------------------------------------------------------------------------------

const sweep = { shipped_unequal_hours: [], deleted_unequal_hours: [], n: 0 };
for (let q = 0; q < 96; q++) {                        // every 15 game minutes
  const hour = Math.round(q * 0.25 * 1e6) / 1e6;
  sweep.n++;
  for (const [tag, envKey, soulsKey] of [['shipped', 'env_ship', 'souls_ship'], ['deleted', 'env_del', 'souls_del']]) {
    // DEATHS, not 8. Draft 1 of this file used 8 deaths = 1,208 f@60 = 6.7 game minutes, which on
    // a quarter-hour start grid can never walk a living player across 05:00 or 21:00 — so BOTH arms
    // agreed everywhere and the sweep distinguished nothing. RULES.md 8. Recorded, not quietly fixed.
    const d = arm({ hour, dying: true, deaths: DEATHS, surfaceFrames: SURFACE, envKey, soulsKey });
    const a = arm({ hour, dying: false, deaths: DEATHS, surfaceFrames: SURFACE, envKey, soulsKey });
    if (d.souls_for_one_ordinary_kill !== a.souls_for_one_ordinary_kill) {
      sweep[`${tag}_unequal_hours`].push({ hour, dying: d.souls_for_one_ordinary_kill, alive: a.souls_for_one_ordinary_kill });
    }
  }
}

// ---------------------------------------------------------------------------------------------
// D. DETERMINISM — 40 repeats, 6 start states, and the float-ordering question
// ---------------------------------------------------------------------------------------------

function fingerprint(sim) {
  const e = sim.env;
  return JSON.stringify([
    e.timeOfDay, e.awardTimeOfDay ?? null, e.dayCount, e._clockFrames, e._awardFrames ?? null,
    e.phase, e.daylight, e.weather, e.weatherRegion, e.frontProgress, e.sightlineM,
    sim.progression.soulsHeld, sim.frame,
  ]);
}

/** rest = what `hearthRest` does to the clock: write `timeOfDay` from outside the step. */
function restScenario(startHour, rests, killBetween) {
  const sim = makeSim(startHour, { envMod: mods.env_ship, soulsMod: mods.souls_ship });
  step(sim, mods.souls_ship, 1);
  const trace = [fingerprint(sim)];
  for (let r = 0; r < rests; r++) {
    sim.env.timeOfDay = Math.round((((sim.env.timeOfDay + 6) % 24) + 24) % 24 * 1e6) / 1e6;
    if (sim.env.timeOfDay < 6) sim.env.dayCount = (sim.env.dayCount | 0) + 1;
    step(sim, mods.souls_ship, 1);
    if (killBetween) killOne(sim, mods.souls_ship);
    trace.push(fingerprint(sim));
  }
  return { final: fingerprint(sim), trace: trace.join('|'), hour: sim.env.timeOfDay, day: sim.env.dayCount };
}

const determinism = { repeats: {}, float_ordering: {} };
for (const startHour of [17, 3, 23.5, 0, 11.999, 20.966666]) {
  for (const rests of [4, 8, 12]) {
    // TWO POPULATIONS, not one. Draft 1 alternated `killBetween` across the 40 repeats and then
    // asked whether all 40 agreed — they cannot, because a kill costs two extra frames, so the
    // instrument reported a determinism defect that was its own fixture. RULES.md 8 again.
    for (const killBetween of [false, true]) {
      const runs = [];
      for (let i = 0; i < 40; i++) runs.push(restScenario(startHour, rests, killBetween));
      const uniq = new Set(runs.map((r) => r.trace));
      // the clock is stepped once per rest, so the hour lands `rests` f@60 past the start hour
      const drift = Math.abs(((runs[0].hour - startHour) % 24 + 24) % 24);
      determinism.repeats[`h${startHour}_x${rests}${killBetween ? '_kill' : ''}`] = {
        runs: runs.length,
        distinct_traces: uniq.size,
        bit_identical: uniq.size === 1,
        hour_after: runs[0].hour,
        drift_from_start_hour_frames: Math.round(drift * 259200 / 24),
        returns_to_start_hour_within_the_rest_frames: Math.round(drift * 259200 / 24) <= rests + 2,
        days_advanced: runs[0].day,
      };
    }
  }
}

// THE FLOAT-ORDERING QUESTION. `environment.js` builds its clock as an INTEGER frame counter and
// says so in its header. Is that load-bearing, or decoration? Compare it against the accumulate-
// a-float clock it replaced, over one game day.
{
  const FPD = mods.env_ship.FRAMES_PER_DAY;
  let acc = 0; const dt = 24 / FPD;
  for (let i = 0; i < FPD; i++) acc += dt;
  const integerWay = Math.round((FPD % FPD) * 24 / FPD * 1e6) / 1e6;
  determinism.float_ordering.clock = {
    accumulated_float_after_one_day: acc,
    exactly_24: acc === 24,
    integer_derived: integerWay,
    verdict: acc === 24
      ? 'the accumulator happens to land on 24 for this frame count too'
      : `the accumulator drifts by ${acc - 24} h over one day; the integer counter cannot`,
  };
  // AND THE ONE PLACE THIS FILE DOES SUM FLOATS: `_roll()`'s weight accumulator. Its determinism
  // rests on `m.states` ARRAY ORDER, not on the arithmetic being order-free. Show it.
  const region = JSON.parse(JSON.stringify(weather.regions[0]));
  const flipped = JSON.parse(JSON.stringify(weather));
  flipped.regions = [{ ...region, states: region.states.slice().reverse() }, ...weather.regions.slice(1)];
  const a = makeSim(12, { envMod: mods.env_ship, soulsMod: mods.souls_ship });
  const b = (() => {
    const s = makeSim(12, { envMod: mods.env_ship, soulsMod: mods.souls_ship });
    s.environment = new mods.env_ship.Environment(flipped, () => null);
    return s;
  })();
  step(a, mods.souls_ship, 40000);
  step(b, mods.souls_ship, 40000);
  determinism.float_ordering.weather_roll = {
    states_in_declared_order: a.env.weather,
    states_in_reversed_order: b.env.weather,
    order_is_load_bearing: a.env.weather !== b.env.weather,
    note: '_roll() accumulates `acc += w[i]` over m.states in ARRAY order. The clock itself is an '
      + 'integer counter and is immune; this accumulator is not, and its determinism is a property '
      + 'of weather.json\'s key order rather than of the arithmetic.',
  };
}

// ---------------------------------------------------------------------------------------------
// E. METHOD 8, recomputed off the shipped data with the engine's own readers
// ---------------------------------------------------------------------------------------------

const settlementMod = await import(pathToFileURL(path.join(SRC, 'settlement.js')).href);
const npcMod = await import(pathToFileURL(path.join(SRC, 'npc.js')).href);

const interiors = {};
const intDir = path.join(DATA, 'world/interiors');
for (const f of fs.existsSync(intDir) ? fs.readdirSync(intDir).sort() : []) {
  if (!f.endsWith('.json')) continue;
  const d = rd(path.join(intDir, f));
  if (d && d.id) { interiors[d.id] = d; continue; }                  // one file, one interior
  const rows = Array.isArray(d) ? d : (d.interiors || d.records || []);
  if (Array.isArray(rows)) for (const r of rows) { if (r && r.id) interiors[r.id] = r; }
}

// `isOpen` is a pure method of the settlement system over (interiorId, hour). Reproduce it here
// through the SHIPPED class rather than reimplementing the wrap, so a change to it turns this red.
const S = Object.create(settlementMod.SettlementSystem.prototype);
S.interiors = interiors;
S.interior = function (id) { return this.interiors[String(id)] || null; };

const openAt = (h) => {
  const o = {};
  for (const id of Object.keys(interiors)) o[id] = S.isOpen(id, h);
  return o;
};

const npcRecords = [];
(function walk(dir) {
  if (!fs.existsSync(dir)) return;
  for (const e of fs.readdirSync(dir, { withFileTypes: true }).sort((x, y) => (x.name < y.name ? -1 : 1))) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name.endsWith('.json')) {
      const d = rd(p);
      const list = Array.isArray(d) ? d : (d.npcs || d.records || []);
      if (Array.isArray(list)) for (const n of list) if (n && n.schedule) npcRecords.push(n);
    }
  }
})(path.join(DATA, 'npcs'));

const slotsAt = (h) => {
  const o = {};
  for (const n of npcRecords) {
    const sched = npcMod.normaliseSchedule(n.schedule);
    const i = npcMod.slotAt(sched, h);
    o[n.id || n.eid || JSON.stringify(n).slice(0, 24)] = i >= 0 ? (sched[i].at || null) : '(HOLE IN THE DAY)';
  }
  return o;
};

const diff = (a, b) => Object.keys(a).filter((k) => a[k] !== b[k]);

const method8 = {
  interiors_total: Object.keys(interiors).length,
  npc_records_with_a_schedule: npcRecords.length,
  shops_open_1700: Object.values(openAt(17.000741)).filter(Boolean).length,
  shops_open_2300: Object.values(openAt(23.003148)).filter(Boolean).length,
  shops_changed_1700_to_2300: diff(openAt(17.000741), openAt(23.003148)).length,
  npcs_moved_1700_to_2300: diff(slotsAt(17.000741), slotsAt(23.003148)).length,
  souls_1700: mods.souls_ship.awardFor(enemies[ORDINARY], 17.000741).souls,
  souls_2300: mods.souls_ship.awardFor(enemies[ORDINARY], 23.003148).souls,
};

// THE QUESTION c6 DOES NOT ASK. `isOpen(id, h)` and `slotAt(schedule, h)` are PURE FUNCTIONS OF
// THE HOUR. So "rest 4x and the shop state returns" cannot fail unless the clock arithmetic
// fails: it carries no information about the world being restored. Demonstrate both halves —
// (a) the readback is identical at any two hours 24 h apart regardless of what happened between,
// (b) a perturbation applied mid-loop SURVIVES the round trip, which a restoration would undo.
{
  const before = openAt(17.000741);
  const perturbedId = Object.keys(interiors).find((id) => interiors[id].open_h !== undefined
    && interiors[id].close_h !== undefined && S.isOpen(id, 17.000741));
  const savedOpen = interiors[perturbedId].open_h, savedClose = interiors[perturbedId].close_h;
  interiors[perturbedId].open_h = 1; interiors[perturbedId].close_h = 2;   // shut it at 17:00
  const perturbed = openAt(17.000741);
  const afterRoundTrip = openAt(17.004259);                                 // +24 h, 4 rests later
  method8.restoration_or_reread = {
    perturbed_interior: perturbedId,
    reader_is_live: before[perturbedId] === true && perturbed[perturbedId] === false,
    perturbation_survives_the_24h_round_trip: afterRoundTrip[perturbedId] === false,
    reading: 'c6 asserts the shop state "returns". `isOpen(id, hour)` is a pure function of the '
      + 'hour, so it returns for the same reason 17:00 + 24 h is 17:00. The perturbation is NOT '
      + 'undone by the round trip, which is what a restoration would do. c6 tests the clock, not '
      + 'the world.',
  };
  interiors[perturbedId].open_h = savedOpen; interiors[perturbedId].close_h = savedClose;
}

// The N-rest round trip, at N = 4, 8, 12, from three start hours.
method8.round_trips = {};
for (const h0 of [17.000741, 3.0, 23.5]) {
  for (const n of [4, 8, 12]) {
    const r = restScenario(h0, n, true);
    const start = openAt(h0), end = openAt(r.hour);
    method8.round_trips[`h${h0}_x${n}`] = {
      hours_of_rest: n * 6,
      hour_after: r.hour,
      whole_days: (n * 6) % 24 === 0,
      shops_changed: diff(start, end).length,
      npcs_moved: diff(slotsAt(h0), slotsAt(r.hour)).length,
      day_advanced: r.day,
    };
  }
}

// ---------------------------------------------------------------------------------------------
// G. WHAT THE SECOND CLOCK COSTS — the two consequences the round does not name
// ---------------------------------------------------------------------------------------------
//
// The fix buys the AR-1 invariant by letting the two clocks DIVERGE while a death is in flight.
// The offset is real, bounded only by how long you go without resting, and it is discharged by
// anything that writes the world clock from outside the step — including a LOAD. Two questions
// follow that the round asks of neither clock, and both are measured here rather than argued.

const G = {};
{
  // G1. How far apart can they get, and what does it look like when they disagree about NIGHT?
  //     Die repeatedly just before 21:00 and stop the moment the AWARD clock crosses while the
  //     WORLD clock has not. At that point the souls economy is at night and every shop in the
  //     province is still open.
  let deaths = 0, row = null;
  for (let n = 1; n <= 60; n++) {
    const r = arm({ hour: 20.7, dying: true, deaths: n, surfaceFrames: SURFACE, envKey: 'env_ship', soulsKey: 'souls_ship' });
    if (r.souls_for_one_ordinary_kill === 57 && r.hour_after < 21) { deaths = n; row = r; break; }
  }
  G.g1_the_two_clocks_disagree = {
    start_hour: 20.7,
    deaths_needed: deaths,
    world_clock_says: row ? row.hour_after : null,
    award_clock_says: row ? row.award_after : null,
    souls_paid: row ? row.souls_for_one_ordinary_kill : null,
    shops_open_at_the_world_hour: row ? Object.values(openAt(row.hour_after)).filter(Boolean).length : null,
    offset_h_per_death: Math.round(SURFACE * 24 / mods.env_ship.FRAMES_PER_DAY * 1e6) / 1e6,
    reading: 'the price is the NIGHT price and the province is still open for business. This is '
      + 'not AR-1 — living the same frames pays the same — but it is a state the world can be put '
      + 'in by dying, and no instrument in the round reports it.',
  };

  // G2. THE SAVE DISCHARGES IT. `save/state.js` persists `clock.time_of_day` and `day_count` and
  //     nothing else of the clock; `_awardFrames` is not in the blob. A load therefore writes
  //     `env.timeOfDay` from outside the step, `_syncFromFloat` re-seats the award clock on it,
  //     and the offset vanishes. Near the 05:00 edge the offset runs AGAINST the player — so
  //     reloading BUYS BACK the night rate.
  const sim = makeSim(4.8, { envMod: mods.env_ship, soulsMod: mods.souls_ship });
  step(sim, mods.souls_ship, 1);
  for (let d = 0; d < 20; d++) { sim._death.active = true; step(sim, mods.souls_ship, SURFACE); sim._death.active = false; step(sim, mods.souls_ship, 1); }
  const beforeReload = killOne(sim, mods.souls_ship);
  const saved = sim.env.timeOfDay;                       // exactly what the blob carries
  sim.env.timeOfDay = saved;                             // applySave writes this and nothing else
  sim.env._clockFrames = undefined;                      // a fresh env, as `SimState.reset()` makes one
  step(sim, mods.souls_ship, 1);                         // _syncFromFloat re-seats BOTH clocks
  const afterReload = killOne(sim, mods.souls_ship);
  G.g2_a_reload_buys_back_the_night_rate = {
    start_hour: 4.8,
    deaths: 20,
    world_clock: saved,
    award_clock_before_reload: sim.env.awardTimeOfDay,
    souls_before_reload: beforeReload,
    souls_after_reload: afterReload,
    the_reload_changed_the_price: beforeReload !== afterReload,
    saved_fields: 'save/state.js writes clock.time_of_day, clock.day_count, clock.weather. '
      + '_awardFrames and awardTimeOfDay are in NEITHER the blob nor the loader.',
    reading: beforeReload !== afterReload
      ? `a save and a reload turned ${beforeReload} souls into ${afterReload} for the same enemy, `
        + 'with no world event between them. RI-JRN05 M-D4 asks that nothing non-volatile change '
        + 'across a round trip; this is a volatile field with a price attached.'
      : 'the reload did not move the price at this fixture',
  };
}

// ---------------------------------------------------------------------------------------------
// F. REACH CENSUS — does either clock touch damage / poise / stamina / frames?
// ---------------------------------------------------------------------------------------------

const reach = { awardTimeOfDay: [], timeOfDay: [], isNight: [] };
(function walkSrc(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1))) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { walkSrc(p); continue; }
    if (!/\.(js|mjs)$/.test(e.name)) continue;
    const lines = fs.readFileSync(p, 'utf8').split('\n');
    lines.forEach((ln, i) => {
      if (/^\s*(\/\/|\*|\/\*)/.test(ln)) return;            // comments are not reach
      const rel = path.relative(ROOT, p);
      if (/awardTimeOfDay/.test(ln)) reach.awardTimeOfDay.push(`${rel}:${i + 1}`);
      if (/\bisNight\s*\(/.test(ln)) reach.isNight.push(`${rel}:${i + 1}`);
      if (/env\.timeOfDay|\.env\.timeOfDay/.test(ln)) reach.timeOfDay.push(`${rel}:${i + 1}`);
    });
  }
})(path.join(ROOT, 'game/src'));

const COMBAT_PATHS = /game\/src\/(sim\/combat|combat|sim\/damage|sim\/poise|sim\/stamina)/;
reach.award_clock_readers_in_combat_code = reach.awardTimeOfDay.filter((l) => COMBAT_PATHS.test(l));
reach.world_clock_readers_in_combat_code = reach.timeOfDay.filter((l) => COMBAT_PATHS.test(l));

// ---------------------------------------------------------------------------------------------
// verdict
// ---------------------------------------------------------------------------------------------

const f = factorial;
const shippedEqualEverywhere = sweep.shipped_unequal_hours.length === 0;
const deletedDiffersSomewhere = sweep.deleted_unequal_hours.length > 0;

assert(shippedEqualEverywhere, `shipped arm: dying != living at ${sweep.shipped_unequal_hours.length} of ${sweep.n} start hours`);
assert(deletedDiffersSomewhere, 'DELETE-THE-FIX ARM IS INERT: removing the award clock from the SOURCE changed no reading anywhere in the day');
assert(Object.values(determinism.repeats).every((r) => r.bit_identical), 'a rest scenario was not bit-identical across 40 repeats');

const report = {
  schema: 'elder-souls/critic-probe@1',
  tool: 'tools/analysis/critic-w1-13-r4-clock.mjs',
  item: 'RI-PRG04 / RI-JRN06 — W1-13 round 4, CRITIC',
  git: gitState(),
  taken_at: new Date().toISOString(),
  contention_note: 'node-side only. No browser was launched by this instrument; every figure is a '
    + 'soul count, an hour, a frame count or a boolean, and all are load-independent. S22: frame '
    + 'counts are written f@60.',
  a_arms_are_real: { cuts: cutLog, env_arms_differ: envSrc !== envDeleted, souls_arms_differ: soulsSrc !== soulsDeleted },
  b_factorial: factorial,
  c_whole_day_sweep: sweep,
  d_determinism: determinism,
  e_method_8_offline: method8,
  f_reach_census: reach,
  g_what_the_second_clock_costs: G,
  verdict: {
    shipped_invariant_holds_at_all_96_start_hours: shippedEqualEverywhere,
    source_level_delete_the_fix_reproduces_the_defect: deletedDiffersSomewhere,
    hours_of_the_day_where_deleting_the_fix_changes_the_price: sweep.deleted_unequal_hours.length,
    award_clock_reaches_combat_code: reach.award_clock_readers_in_combat_code.length,
    determinism_all_bit_identical: Object.values(determinism.repeats).every((r) => r.bit_identical),
    failures: fail,
  },
  ok: fail.length === 0,
};

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(report, null, 1));
console.log(JSON.stringify({ ...report, b_factorial: '<see artifact>', e_method_8_offline: '<see artifact>' }, null, 1));
console.log('\nartifact:', path.relative(ROOT, OUT));
if (fail.length) { console.error('\nFAILURES:\n - ' + fail.join('\n - ')); process.exit(1); }
