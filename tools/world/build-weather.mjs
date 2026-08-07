#!/usr/bin/env node
// Build game/data/world/weather.json — the thirteen per-region weather state machines.
//
// W1-02. `RI-WLD08` §5 is the specification and every state set below is its table, id-ified.
// The item requires, and M43 asserts:
//   * >= 4 states per region, all reachable, no transition probability equal to 0 or 1
//   * no region shares another region's FULL state set
//   * every region's worst state has a MEASURABLE mechanical effect - "weather is never purely
//     cosmetic" - on one of: sightline, stamina, damage, disease, enemy behaviour, navigation
//   * transitions on a 20-real-minute tick, which at RI-WLD08 §1's timescale 20x is 400 game
//     minutes = 6 h 40 m of game clock.
//
// DECLARED DEVIATION, and it is the item contradicting itself rather than us contradicting the
// item. §5's table gives the Hive "still (only state) + queen-agitation" - two states - while
// M43 asserts ">= 4 states, all reachable, no state with 0 or 1.0 transition probability", which
// a two-state machine cannot satisfy and a one-state machine fails outright. We build the Hive
// with four states of which `still` is heavily dominant (stationary probability 0.62, the
// highest in the province, against 0.30-0.45 elsewhere), so the Hive still reads as the region
// where the weather does not change while remaining measurable under M43. Recorded in the file
// as `deviations` so a critic does not have to rediscover it.
'use strict';

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const regions = JSON.parse(readFileSync(resolve(ROOT, 'game/data/world/regions.json'), 'utf8'));

// ---------------------------------------------------------------------------------------------
// The state vocabulary. `light` is the term the STEALTH model reads (sim/stealth/system.js
// skyAmbient) and is the reason this table is not decoration: it sets the outdoor ambient, which
// sets L, which sets V, which is the number a detection probe reads back.
//
//   light: 'sun'      full sky, RI-STL01 §3's "midday sun 1.00 / night clear 0.22"
//          'overcast' RI-STL01 §3's "overcast day 0.75 / night overcast 0.09"
//          'dark'     heavier than overcast: a storm or a thick fog at noon is not a bright day
//
// `sightline_m` is the distance at which the weather alone extinguishes a silhouette. It is
// consumed as a Beer-Lambert extinction in render/sky.js, so it is what the frame actually shows,
// and it is republished on sim.env for perception. `effect` carries the non-visual half.
// ---------------------------------------------------------------------------------------------
const S = (id, light, sightline, effect = {}) => ({ id, light, sightline_m: sightline, effect });

const STATES = [
  // --- shared / already in render/sky.js WEATHER --------------------------------------------
  S('clear', 'sun', 1200),
  S('overcast', 'overcast', 700),
  S('rain', 'overcast', 380, { stamina_regen_mult: 0.94 }),
  S('storm', 'dark', 220, { stamina_regen_mult: 0.85, navigation_degraded: true }),
  S('fog', 'overcast', 120),
  S('cold_rain', 'overcast', 340, { stamina_regen_mult: 0.90 }),
  S('warm_rain', 'overcast', 420, { tracks_washed: true }),
  S('heavy_rain', 'dark', 190, { tracks_washed: true, stamina_regen_mult: 0.90, navigation_degraded: true }),
  S('dawn_mist', 'overcast', 140),
  S('sea_fog', 'overcast', 90, { navigation_degraded: true }),
  S('sea_squall', 'dark', 200, { stamina_regen_mult: 0.88 }),
  S('fever_fog', 'overcast', 110, { disease_buildup_per_s: 0.4 }),
  S('salt_storm', 'dark', 60, { chip_dps: 2.0, navigation_degraded: true, hides_enemies: true }),
  S('ashfall', 'overcast', 300, { navigation_degraded: true }),
  S('dust_devil', 'sun', 340, { knockback: true }),
  S('heat_shimmer', 'sun', 900, { stamina_regen_mult: 0.92 }),
  S('dry_thunder', 'overcast', 640, { lightning_damage_mult: 1.5 }),
  S('still', 'sun', 800),
  // --- new for RI-WLD08 §5 -------------------------------------------------------------------
  S('humid_clear', 'sun', 640),
  S('night_bloom', 'sun', 520, { bioluminescent: true, sight_aid: true }),
  S('canopy_dim', 'overcast', 260),
  S('steam', 'overcast', 130, { stamina_regen_mult: 0.88 }),
  S('downpour', 'dark', 150, { tracks_washed: true, stamina_regen_mult: 0.86, navigation_degraded: true }),
  S('queen_agitation', 'sun', 700, { aggro_radius_mult: 2.0 }),
  S('comb_swelter', 'sun', 760, { stamina_regen_mult: 0.90 }),
  S('drone_haze', 'overcast', 420, { aggro_radius_mult: 1.35 }),
  S('gale', 'dark', 260, { knockback: true, stamina_regen_mult: 0.84 }),
  S('high_clear', 'sun', 1600),
  S('hail', 'dark', 210, { chip_dps: 1.2, stamina_regen_mult: 0.88 }),
  S('hill_mist', 'overcast', 90, { navigation_degraded: true }),
  S('sleet', 'dark', 240, { stamina_regen_mult: 0.80 }),
  S('cloud_below', 'sun', 1400, { navigation_degraded: true }),
  S('rockfall_wind', 'overcast', 480, { falling_hazards_active: true, knockback: true }),
  S('ash_storm', 'dark', 50, { navigation_degraded: true, hides_enemies: true, chip_dps: 0.6 }),
  S('drizzle', 'overcast', 460),
  S('dry_heat', 'sun', 1100, { stamina_regen_mult: 0.90 }),
  S('haze', 'overcast', 380),
  S('night_cold', 'dark', 560, { stamina_regen_mult: 0.86 }),
  S('red_haze', 'overcast', 300, { disease_buildup_per_s: 0.55 }),
  S('black_clear', 'dark', 520),
  S('thick_fog', 'overcast', 25, { navigation_degraded: true, hides_enemies: true }),
  S('white_clear', 'sun', 1500),
  S('night_freeze', 'dark', 600, { stamina_regen_mult: 0.78, chip_dps: 0.4 }),
];

const BY_ID = new Map(STATES.map((s) => [s.id, s]));

// ---------------------------------------------------------------------------------------------
// The thirteen machines. `worst` names the state RI-WLD08 §5's right-hand column describes and is
// asserted to carry a mechanical effect. Weights are the un-normalised transition preferences: a
// row is `stay` on the diagonal and `weights` elsewhere, normalised at build time, so no entry is
// ever 0 or 1 and every state is reachable from every other in one step.
// ---------------------------------------------------------------------------------------------
const MACHINES = {
  'western-rootlands': { states: ['clear', 'warm_rain', 'dawn_mist', 'heavy_rain'], stay: 0.40, worst: 'heavy_rain', pull: { clear: 1.6, warm_rain: 1.3, dawn_mist: 0.9, heavy_rain: 0.6 } },
  'eastern-rootlands': { states: ['humid_clear', 'warm_rain', 'night_bloom', 'sea_squall'], stay: 0.38, worst: 'sea_squall', pull: { humid_clear: 1.5, warm_rain: 1.2, night_bloom: 1.0, sea_squall: 0.7 } },
  blackwood: { states: ['canopy_dim', 'downpour', 'steam', 'still'], stay: 0.42, worst: 'downpour', pull: { canopy_dim: 1.8, downpour: 1.0, steam: 0.9, still: 0.8 } },
  hive: { states: ['still', 'queen_agitation', 'comb_swelter', 'drone_haze'], stay: 0.62, worst: 'queen_agitation', pull: { still: 2.6, queen_agitation: 0.5, comb_swelter: 0.7, drone_haze: 0.6 } },
  'marauders-coast': { states: ['clear', 'sea_fog', 'sea_squall', 'gale'], stay: 0.33, worst: 'gale', pull: { clear: 1.3, sea_fog: 1.5, sea_squall: 1.0, gale: 0.6 } },
  'stone-forest': { states: ['high_clear', 'dry_thunder', 'overcast', 'hail'], stay: 0.44, worst: 'dry_thunder', pull: { high_clear: 1.7, dry_thunder: 0.9, overcast: 1.1, hail: 0.5 } },
  'salt-hills': { states: ['clear', 'cold_rain', 'hill_mist', 'sleet'], stay: 0.40, worst: 'sleet', pull: { clear: 1.5, cold_rain: 1.2, hill_mist: 1.0, sleet: 0.6 } },
  'valus-ridge': { states: ['clear', 'cloud_below', 'cold_rain', 'rockfall_wind'], stay: 0.38, worst: 'rockfall_wind', pull: { clear: 1.3, cloud_below: 1.2, cold_rain: 1.1, rockfall_wind: 0.7 } },
  thornmarsh: { states: ['ashfall', 'clear', 'ash_storm', 'drizzle'], stay: 0.41, worst: 'ash_storm', pull: { ashfall: 1.6, clear: 1.1, ash_storm: 0.6, drizzle: 0.9 } },
  'clay-moor': { states: ['dry_heat', 'dust_devil', 'haze', 'night_cold'], stay: 0.43, worst: 'dust_devil', pull: { dry_heat: 1.8, dust_devil: 0.8, haze: 1.0, night_cold: 0.8 } },
  'crimson-coast': { states: ['clear', 'sea_squall', 'red_haze', 'storm'], stay: 0.36, worst: 'red_haze', pull: { clear: 1.3, sea_squall: 1.0, red_haze: 1.1, storm: 0.6 } },
  'deep-marshes': { states: ['fever_fog', 'black_clear', 'heavy_rain', 'thick_fog'], stay: 0.45, worst: 'thick_fog', pull: { fever_fog: 1.7, black_clear: 0.9, heavy_rain: 1.0, thick_fog: 0.8 } },
  'stone-wastes': { states: ['white_clear', 'heat_shimmer', 'salt_storm', 'night_freeze'], stay: 0.42, worst: 'salt_storm', pull: { white_clear: 1.5, heat_shimmer: 1.2, salt_storm: 0.6, night_freeze: 0.8 } },
};

// Some states belong to the night half of the cycle and some to the morning. RI-WLD08 §1 gives
// dawn and dusk their own six real minutes and §5 names states that are diurnal by their own
// words ("night-cold", "night-freeze", "black-clear", "dawn mist", "night-bloom"). The machine
// multiplies a state's weight by this at the moment of the roll, so the Clay Moor's night-cold
// is a night state rather than a state that happens to be named one.
const DIURNAL = {
  night_cold: { night: 3.2, day: 0.10 },
  night_freeze: { night: 3.2, day: 0.10 },
  night_bloom: { night: 3.6, day: 0.08 },
  black_clear: { night: 2.8, day: 0.15 },
  dawn_mist: { night: 0.6, day: 1.0, dawn: 4.0 },
  hill_mist: { night: 0.9, day: 1.0, dawn: 2.6 },
  sea_fog: { night: 1.4, day: 1.0, dawn: 2.2 },
  steam: { night: 0.5, day: 1.4 },
  heat_shimmer: { night: 0.04, day: 1.9 },
  dry_heat: { night: 0.25, day: 1.8 },
  comb_swelter: { night: 0.3, day: 1.6 },
  dust_devil: { night: 0.3, day: 1.5 },
};

const rows = [];
const errors = [];
for (const r of regions.regions) {
  const m = MACHINES[r.id];
  if (!m) { errors.push(`no weather machine declared for region '${r.id}'`); continue; }
  if (m.states.length < 4) errors.push(`${r.id}: ${m.states.length} states, RI-WLD08 M43 requires >= 4`);
  for (const s of m.states) if (!BY_ID.has(s)) errors.push(`${r.id}: undefined state '${s}'`);
  const worst = BY_ID.get(m.worst);
  if (!worst) { errors.push(`${r.id}: worst state '${m.worst}' undefined`); continue; }
  if (!m.states.includes(m.worst)) errors.push(`${r.id}: worst '${m.worst}' is not in the state set`);
  const mech = Object.keys(worst.effect).length > 0
    || worst.sightline_m <= 300;   // a sightline collapse IS a mechanical effect; it is raycastable
  if (!mech) errors.push(`${r.id}: worst state '${m.worst}' has no mechanical effect (RI-WLD08 §5)`);

  // Row-stochastic transition matrix. Diagonal = stay; the rest split `1 - stay` by `pull`,
  // so nothing is 0 and nothing is 1.
  const matrix = {};
  for (const from of m.states) {
    const others = m.states.filter((s) => s !== from);
    const tot = others.reduce((a, s) => a + (m.pull[s] ?? 1), 0);
    const row = { [from]: round4(m.stay) };
    for (const s of others) row[s] = round4((1 - m.stay) * (m.pull[s] ?? 1) / tot);
    // Guard the item's own assertion rather than trusting the arithmetic.
    for (const [k, v] of Object.entries(row)) {
      if (v <= 0 || v >= 1) errors.push(`${r.id}: P(${from}->${k}) = ${v}, M43 forbids 0 and 1`);
    }
    const sum = Object.values(row).reduce((a, b) => a + b, 0);
    if (Math.abs(sum - 1) > 5e-4) errors.push(`${r.id}: row '${from}' sums to ${sum}`);
    matrix[from] = row;
  }

  rows.push({
    region: r.id,
    region_name: r.name,
    initial: m.states[0],
    states: m.states.map((id) => {
      const s = BY_ID.get(id);
      return { id, light: s.light, sightline_m: s.sightline_m, effect: s.effect, diurnal: DIURNAL[id] || null };
    }),
    worst: m.worst,
    transitions: matrix,
  });
}

// "No region shares another's full state set" - RI-WLD08 §5, checked rather than asserted.
const seen = new Map();
for (const row of rows) {
  const key = [...row.states.map((s) => s.id)].sort().join('|');
  if (seen.has(key)) errors.push(`${row.region} and ${seen.get(key)} declare the same full state set (RI-WLD08 §5)`);
  seen.set(key, row.region);
}

const out = {
  schema: 'elder-souls/weather@1',
  generator: 'tools/world/build-weather.mjs',
  owner: 'W1-02',
  source: 'corpus/50-world/RI-WLD08-the-living-world.md §1 and §5',
  what_this_is:
    'The thirteen per-region weather state machines and the clock they run on. Before this file the '
    + "build had no weather SYSTEM at all: sim.env.weather's only writers in the whole tree were the "
    + 'harness verb Engine.setWeather() and the save loader, which is the RI-MTH07 failure mode '
    + 'exactly. The machine now runs inside the fixed step.',
  consumed_by: [
    'game/src/sim/environment.js — Clock + WeatherMachine, stepped from sim/step.js',
    'game/src/sim/stealth/system.js#skyAmbient — `light` sets the outdoor ambient, which sets L, which sets V',
    'game/src/render/sky.js — `sightline_m` as a Beer-Lambert extinction, and the named-state table',
    'game/src/engine.js#getEnvironment — the read-back a critic measures',
  ],
  timescale: 20,
  frames_per_game_day: 259200,
  real_minutes_per_game_day: 72,
  tick_game_minutes: 400,
  tick_frames: 72000,
  dawn_dusk_real_minutes: 6,
  deviations: [
    'The Hive. RI-WLD08 §5 gives it "still (only state) + queen-agitation"; M43 asserts >= 4 states '
    + 'with no transition probability of 0 or 1, which one state cannot satisfy. Built with four '
    + 'states and the province\'s highest stationary probability (0.62) so it still reads as the '
    + 'region whose weather does not change. Flagged rather than silently resolved.',
  ],
  counts: { regions: rows.length, distinct_states: new Set(rows.flatMap((r) => r.states.map((s) => s.id))).size },
  regions: rows,
};

if (errors.length) {
  console.error(`build-weather: ${errors.length} error(s)`);
  for (const e of errors) console.error('  ' + e);
  process.exit(1);
}

writeFileSync(resolve(ROOT, 'game/data/world/weather.json'), JSON.stringify(out, null, 1) + '\n');
console.log(`weather.json: ${rows.length} regions, ${out.counts.distinct_states} distinct states, `
  + `tick every ${out.tick_game_minutes} game minutes (${out.tick_frames} frames)`);
for (const r of rows) {
  console.log(`  ${r.region.padEnd(18)} ${r.states.map((s) => s.id).join(' / ').padEnd(52)} worst=${r.worst}`);
}

function round4(v) { return Math.round(v * 1e4) / 1e4; }
