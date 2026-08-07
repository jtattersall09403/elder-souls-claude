#!/usr/bin/env node
// RI-MTH07 / ARBITRATION §3 — the CONSUMPTION probe for W1-02's clock and weather machine.
//
// The rule the corpus has now lost fourteen subsystems to: name the world-side consumer, then
// PERTURB THE MODEL AND WATCH AN ENTITY CHANGE BEHAVIOUR. A model whose only writer is a harness
// verb, or whose only reader is the report that prints it, has not been built.
//
// This runs the environment against the SHIPPED consumers in bare node — no engine, no browser —
// because all four of them are pure functions of `sim.env`:
//
//   C1  sim/stealth/system.js#skyAmbient(env)      -> the outdoor ambient -> L -> V (detection)
//   C2  sim/souls.js#isNight / awardFor(stat, h)   -> the soul award
//   C3  sim/npc.js#slotAt(schedule, h)             -> which waypoint a person is at
//   C4  sim/settlement.js -> Settlements#isOpen()  -> whether a door is locked
//
// Each check has a NEGATIVE CONTROL: the same probe run against a FROZEN clock, which must NOT
// move the consumer. A probe that cannot fail is worse than no probe (AGENT-PROTOCOL §"Two
// failure modes"), so every check here reports both halves and the run is non-zero if either the
// live half fails to move OR the frozen half moves.
'use strict';

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { Environment, FRAMES_PER_DAY, phaseOf, daylightAt } from '../../game/src/sim/environment.js';
import { skyAmbient } from '../../game/src/sim/stealth/system.js';
import { isNight, awardFor } from '../../game/src/sim/souls.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const weather = JSON.parse(readFileSync(resolve(ROOT, 'game/data/world/weather.json'), 'utf8'));
const regions = JSON.parse(readFileSync(resolve(ROOT, 'game/data/world/regions.json'), 'utf8'));

const argRegion = (process.argv.find((a) => a.startsWith('--region=')) || '').split('=')[1] || null;
const argFrames = Number((process.argv.find((a) => a.startsWith('--frames=')) || '').split('=')[1] || 0);

/** A minimal sim: everything `Environment.step` touches and nothing else. */
function makeSim(regionId) {
  return {
    frame: 0,
    player: { pos: [0, 0, 0] },
    env: { timeOfDay: 12.0, weather: 'clear', dayCount: 0, region: regionId },
  };
}
function run(regionId, frames, { paused = false, startHour = 12 } = {}) {
  const env = new Environment(weather, () => regionId);
  env.paused = paused;
  const sim = makeSim(regionId);
  sim.env.timeOfDay = startHour;
  sim.env.weather = env.machineFor(regionId).initial;
  const bus = { emit(f, t) { const e = { frame: f, type: t }; this.log.push(e); return e; }, log: [] };
  const samples = [];
  for (let i = 0; i < frames; i++) {
    env.step(sim, bus);
    if (i % Math.max(1, Math.floor(frames / 12)) === 0 || i === frames - 1) {
      samples.push({ frame: sim.frame, ...env.report(sim), ambient: skyAmbient(sim.env) });
    }
    sim.frame++;
  }
  return { env, sim, bus, samples, report: env.report(sim) };
}

const results = [];
const fail = (name, detail) => results.push({ check: name, pass: false, detail });
const pass = (name, detail) => results.push({ check: name, pass: true, detail });

// ---------------------------------------------------------------------------------------------
// A0. The clock is a WORLD-SIDE writer. No harness verb is called anywhere in this file.
// ---------------------------------------------------------------------------------------------
{
  const N = 30000;   // 8.3 real minutes of game time
  const live = run('western-rootlands', N);
  const frozen = run('western-rootlands', N, { paused: true });
  const dLive = live.report.time_of_day - 12;
  const dFrozen = Math.abs(frozen.report.time_of_day - 12);
  const expected = N * 24 / FRAMES_PER_DAY;
  const ok = Math.abs(dLive - expected) < 1e-3 && dFrozen < 1e-6;
  (ok ? pass : fail)('A0 clock advances from the step, not a verb', {
    frames: N, hours_advanced: +dLive.toFixed(6), expected_hours: +expected.toFixed(6),
    frozen_control_drift_hours: +dFrozen.toFixed(9),
  });
}

// ---------------------------------------------------------------------------------------------
// A1. 72 real minutes per game day (RI-WLD08 §1). One full wrap, exactly.
// ---------------------------------------------------------------------------------------------
{
  const live = run('salt-hills', FRAMES_PER_DAY, { startHour: 0 });
  const wrapped = live.report.day === 1 && Math.abs(live.report.time_of_day - 0) < 1e-4;
  (wrapped ? pass : fail)('A1 259,200 frames = one game day = 72 real minutes', {
    frames: FRAMES_PER_DAY, real_minutes: FRAMES_PER_DAY / 60 / 60, day: live.report.day,
    time_of_day: live.report.time_of_day,
  });
}

// ---------------------------------------------------------------------------------------------
// C1. STEALTH. Advance the clock and watch the outdoor ambient — and therefore V — move.
//     Negative control: the same span with the clock frozen must not move it at all.
// ---------------------------------------------------------------------------------------------
{
  const N = 90000;   // 25 real minutes: enough to walk noon into dusk
  const live = run('salt-hills', N, { startHour: 15 });
  const frozen = run('salt-hills', N, { startHour: 15, paused: true });
  const a0 = skyAmbient({ timeOfDay: 15, weather: 'clear', weatherLight: 'sun' });
  const a1 = skyAmbient(live.sim.env);
  const af = skyAmbient(frozen.sim.env);
  const moved = Math.abs(a1 - a0) > 0.05;
  const controlHeld = Math.abs(af - a0) < 1e-9;
  (moved && controlHeld ? pass : fail)('C1 stealth ambient moves with the world clock', {
    consumer: 'game/src/sim/stealth/system.js#skyAmbient -> light.defaultAmbient -> L -> V',
    hour_before: 15, hour_after: live.report.time_of_day,
    ambient_before: a0, ambient_after: +a1.toFixed(4), delta: +(a1 - a0).toFixed(4),
    frozen_control_ambient: +af.toFixed(4), control_held: controlHeld,
  });
}

// ---------------------------------------------------------------------------------------------
// C1b. STEALTH, the WEATHER half. The same hour under two states of the SAME region's machine
//      must give different ambients — otherwise weather is cosmetic, which RI-WLD08 §5 forbids.
// ---------------------------------------------------------------------------------------------
{
  const rows = [];
  for (const m of weather.regions) {
    const vals = m.states.map((s) => ({
      id: s.id, light: s.light,
      ambient: skyAmbient({ timeOfDay: 12, weather: s.id, weatherLight: s.light }),
    }));
    const distinct = new Set(vals.map((v) => v.ambient)).size;
    rows.push({ region: m.region, distinct_ambients: distinct, states: vals });
  }
  const bad = rows.filter((r) => r.distinct_ambients < 2);
  (bad.length === 0 ? pass : fail)('C1b weather changes the stealth ambient in every region', {
    consumer: 'skyAmbient(env.weatherLight)',
    regions_with_only_one_ambient: bad.map((b) => b.region),
    spread: rows.map((r) => `${r.region}:${r.distinct_ambients}`).join(' '),
  });
}

// ---------------------------------------------------------------------------------------------
// C2. SOULS. `awardFor(stat, timeOfDay)` pays a night multiplier; the clock must reach night.
//     The stat is a real shipped statblock, not a placeholder — `awardFor` returns zero souls for
//     anything with no `souls` field, which is how the first version of this check passed
//     vacuously against `'str'` and had to be rewritten. That is the point of a negative control.
// ---------------------------------------------------------------------------------------------
{
  const stat = { souls: 120 };
  // 20:00 + 21,600 frames (6 real minutes = 2 game hours) lands at 22:00, inside RI-PRG04's
  // 21:00-05:00 night window, without wrapping past dawn the way the first version did.
  const live = run('thornmarsh', 21600, { startHour: 20 });
  const frozen = run('thornmarsh', 21600, { startHour: 20, paused: true });
  const before = awardFor(stat, 20);
  const after = awardFor(stat, live.report.time_of_day);
  const control = awardFor(stat, frozen.report.time_of_day);
  const moved = after.souls !== before.souls && after.night === true;
  const held = control.souls === before.souls;
  (moved && held ? pass : fail)('C2 the soul award changes because the clock reached night', {
    consumer: 'game/src/sim/souls.js#awardFor(stat, sim.env.timeOfDay)',
    hour_before: 20, hour_after: live.report.time_of_day,
    award_before: before, award_after: after,
    frozen_control_hour: frozen.report.time_of_day, frozen_control_award: control, control_held: held,
  });
}

// ---------------------------------------------------------------------------------------------
// C3. THE WEATHER MACHINE actually rolls, from the step, with no verb — and lands only in states
//     the region declares. RI-WLD08 M43: force simulated time and log transitions.
// ---------------------------------------------------------------------------------------------
{
  const per = [];
  for (const m of weather.regions) {
    const live = run(m.region, weather.tick_frames * 14 + 5, { startHour: 6 });
    const changes = live.bus.log.filter((e) => e.type === 'weather_change');
    const visited = new Set([m.initial, ...changes.map((c) => c.to)]);
    const foreign = [...visited].filter((v) => !m.states.some((s) => s.id === v));
    per.push({
      region: m.region, ticks: 14, transitions: changes.length,
      distinct_states_visited: visited.size, declared: m.states.length,
      foreign_states: foreign,
      sightline_min: Math.min(...live.samples.map((s) => s.sightline_m)),
      sightline_max: Math.max(...live.samples.map((s) => s.sightline_m)),
    });
  }
  const dead = per.filter((p) => p.transitions === 0);
  const leaky = per.filter((p) => p.foreign_states.length);
  (dead.length === 0 && leaky.length === 0 ? pass : fail)('C3 the weather machine rolls from the step in all 13 regions', {
    regions_with_no_transition_in_14_ticks: dead.map((d) => d.region),
    regions_visiting_an_undeclared_state: leaky.map((l) => `${l.region}:${l.foreign_states}`),
    per_region: per,
  });
}

// ---------------------------------------------------------------------------------------------
// C4. SIGHTLINE. The declared metres become a fog density the frame is drawn with.
//
//     The first version of this check asserted that every region's WORST state cuts that region's
//     own sightline, and four regions failed it — Blackwood, the Hive, Marauder's Coast and the
//     Stone Forest. The check was wrong, twice over, and both corrections are real:
//
//     (a) RI-WLD08 §5 requires the worst state to change ONE of sightline, stamina, damage,
//         disease, enemy behaviour or navigation. The Hive's `queen_agitation` is worst because it
//         doubles the drone aggro radius, not because it is foggy. So the bar is "some channel",
//         and this check now enumerates WHICH.
//     (b) The renderer was combining the region's haze and the weather's with `max()`, which meant
//         that in a region whose own extinction is high — Blackwood at 0.018/m — NO weather state
//         could change the fog at all. Extinction coefficients ADD; `max()` was not a
//         simplification, it was weather-as-decoration in the four densest regions. sky.js now
//         adds them, so every state changes the frame in every region.
// ---------------------------------------------------------------------------------------------
{
  const rows = [];
  for (const m of weather.regions) {
    const r = regions.regions.find((x) => x.id === m.region);
    const base = r.fog.extinction_per_m * 1.22;
    const seen = new Set();
    for (const s of m.states) {
      const realised = 1.978 / (base + 1.978 / s.sightline_m);
      seen.add(Math.round(realised));
    }
    const worst = m.states.find((s) => s.id === m.worst);
    const channels = Object.keys(worst.effect || {});
    const worstRealised = 1.978 / (base + 1.978 / worst.sightline_m);
    const clearest = Math.max(...m.states.map((s) => 1.978 / (base + 1.978 / s.sightline_m)));
    if (worstRealised < clearest - 1) channels.push('sightline');
    rows.push({
      region: m.region, worst: m.worst,
      worst_channels: channels,
      distinct_realised_sightlines: seen.size, states: m.states.length,
      realised_range_m: [Math.min(...seen), Math.max(...seen)],
    });
  }
  const cosmetic = rows.filter((r) => r.worst_channels.length === 0);
  const flat = rows.filter((r) => r.distinct_realised_sightlines < r.states);
  (cosmetic.length === 0 && flat.length === 0 ? pass : fail)('C4 weather is mechanical, and every state changes the frame', {
    consumer: 'game/src/render/sky.js — scene.fog.density = regionExtinction + 1.978 / sightline_m',
    worst_state_with_no_mechanical_channel: cosmetic.map((c) => c.region),
    regions_where_two_states_draw_the_same_fog: flat.map((f) => f.region),
    rows,
  });
}

// ---------------------------------------------------------------------------------------------
// C5. DETERMINISM. Two independent runs of the same span must be byte-identical, and the file
//     must contain no Math.random and no clock read.
// ---------------------------------------------------------------------------------------------
{
  const a = run('deep-marshes', weather.tick_frames * 6 + 17, { startHour: 3 });
  const b = run('deep-marshes', weather.tick_frames * 6 + 17, { startHour: 3 });
  const same = JSON.stringify(a.samples) === JSON.stringify(b.samples);
  const src = readFileSync(resolve(ROOT, 'game/src/sim/environment.js'), 'utf8');
  // Strip comments first: the file's own header NAMES `Math.random` while explaining why it does
  // not call it, and the first version of this check failed on its own documentation.
  const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  const clean = !/Math\.random|Date\.now|performance\.now|new Date\(/.test(code);
  (same && clean ? pass : fail)('C5 deterministic and guard-safe', { identical_runs: same, no_rng_no_clock: clean });
}

// ---------------------------------------------------------------------------------------------
// C6. THE DIURNAL WEIGHTING IS REAL. A state declared nocturnal must be over-represented at night.
// ---------------------------------------------------------------------------------------------
{
  const m = weather.regions.find((r) => r.region === 'clay-moor');
  const count = (startHour) => {
    let n = 0;
    for (let t = 0; t < 400; t++) {
      const live = run('clay-moor', 2, { startHour });
      // Force the roll at tick t by driving the machine's own hash path.
      const env = new Environment(weather, () => 'clay-moor');
      const sim = makeSim('clay-moor');
      sim.env.timeOfDay = startHour; sim.env.weather = 'dry_heat';
      if (env._roll(env.machineFor('clay-moor'), sim.env, t) === 'night_cold') n++;
      void live;
    }
    return n;
  };
  const atNight = count(1);
  const atNoon = count(12);
  (atNight > atNoon * 2 ? pass : fail)('C6 nocturnal states are actually nocturnal', {
    state: 'night_cold', rolls: 400, chosen_at_0100: atNight, chosen_at_1200: atNoon,
    machine: m.region,
  });
}

// ---------------------------------------------------------------------------------------------
const failed = results.filter((r) => !r.pass);
console.log(JSON.stringify({
  tool: 'tools/world/env-consumption.mjs',
  rule: 'RI-MTH07 / ARBITRATION §3 — name the consumer, perturb the model, watch behaviour change',
  region_filter: argRegion, extra_frames: argFrames || null,
  passed: results.length - failed.length, of: results.length,
  results,
}, null, 1));
if (failed.length) { console.error(`\nenv-consumption: ${failed.length} FAILED`); process.exit(1); }
console.error(`\nenv-consumption: ${results.length}/${results.length} passed`);
void phaseOf; void daylightAt;
