// The world clock and the regional weather machine. W1-02.
//
// WHY THIS FILE EXISTS, stated plainly because the absence it fixes is the project's most
// expensive recurring defect (`RI-MTH07`, ARBITRATION §3):
//
//   * `sim.env.timeOfDay` was initialised to 12.0 in `sim/state.js` and then never advanced by
//     anything in the fixed step. Its only writers in the entire build were `Engine.setTimeOfDay`
//     (a harness verb), `Engine.hearthRest` / `advanceTime`, and the save loader. There was no
//     day/night CYCLE — the sun did not move unless a critic moved it by hand.
//   * `sim.env.weather` was worse: its only writers were `Engine.setWeather` (a harness verb) and
//     the save loader. `regions.json` declared a `weather` array for all thirteen regions and
//     nothing read it. `render/sky.js`'s own comment said "W1-02 owns the transition machine".
//
// Both models therefore had exactly the shape ARBITRATION §3 forbids: a model whose only writer
// is a harness verb. This file is the world-side writer, and the world-side CONSUMERS it moves
// were already there and are real:
//
//   sim/stealth/system.js  skyAmbient(env) -> light.defaultAmbient -> L -> V   (detection)
//   sim/souls.js           isNight(timeOfDay)                                  (soul award)
//   sim/npc.js             slotAt(schedule, timeOfDay)                         (where people are)
//   sim/settlement.js      isOpen(interior, timeOfDay)                         (locked doors)
//   sim/hazards.js         stamps weather and hour onto every hazard context
//   render/sky.js          sun elevation, sky gradient, fog
//
// So a clock that moves is not a cosmetic: at 259,200 frames per game day, an unattended
// simulation walks a shopkeeper home, closes the door behind her, darkens the sky, and raises the
// player's V — none of which the build did before.
//
// DETERMINISM. The clock is an INTEGER frame counter, not an accumulated float: `24 * n / 259200`
// for integer `n` is the same double on every machine and every run, whereas `t += 9.259e-5`
// accumulates a different error depending on where the trace started. The weather roll is a hash
// of the tick index and the region index — no `Math.random`, no wall clock — so the whole file is
// safe under the armed determinism guard in `sim/step.js`.
'use strict';

/** `RI-WLD08` §1. 1 real minute = 20 game minutes. */
export const TIMESCALE = 20;
/** 24 game hours / 20x = 72 real minutes = 4320 s = 259,200 fixed frames at 60 Hz. */
export const FRAMES_PER_DAY = 259200;
/** `RI-WLD08` §5's 20-real-minute transition tick. */
export const WEATHER_TICK_FRAMES = 72000;
/** How long a front takes to pass. `RI-WLD08` §4 E8 wants a transition you can SEE arrive. */
export const FRONT_FRAMES = 2700;   // 45 real seconds

// `RI-WLD08` §1: 60/40 daylight/night, dawn and dusk 6 real minutes each = 2 game hours each.
// 14.4 h of daylight centred on noon gives 04:48 -> 19:12; the two 2 h ramps sit at its ends.
export const DAWN_START = 4.8;
export const DAWN_END = 6.8;
export const DUSK_START = 17.2;
export const DUSK_END = 19.2;

/** Deterministic 32-bit mix. Two integers in, a float in [0,1) out. No RNG, no clock. */
function hash2(a, b) {
  let h = (a | 0) * 0x27d4eb2d ^ (b | 0) * 0x165667b1;
  h ^= h >>> 15; h = Math.imul(h, 0x2545f491); h ^= h >>> 13;
  h = Math.imul(h, 0x27d4eb2d); h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/** Which half of the cycle an hour is in — the key `DIURNAL` weights in weather.json are keyed by. */
export function phaseOf(hours) {
  const h = ((hours % 24) + 24) % 24;
  if (h >= DAWN_START && h < DAWN_END) return 'dawn';
  if (h >= DUSK_START && h < DUSK_END) return 'dusk';
  if (h >= DAWN_END && h < DUSK_START) return 'day';
  return 'night';
}

/**
 * Fraction of full daylight at this hour, 0 at deep night and 1 in the middle of the day, ramping
 * across the two transitions. Published on `sim.env` so a probe can read the light the world
 * thinks it has without reconstructing the trigonometry in `render/sky.js`.
 */
export function daylightAt(hours) {
  const h = ((hours % 24) + 24) % 24;
  if (h >= DAWN_END && h < DUSK_START) return 1;
  if (h >= DAWN_START && h < DAWN_END) return (h - DAWN_START) / (DAWN_END - DAWN_START);
  if (h >= DUSK_START && h < DUSK_END) return 1 - (h - DUSK_START) / (DUSK_END - DUSK_START);
  return 0;
}

/**
 * The environment. One instance lives on `sim.environment`; `sim/step.js` calls `step()` once per
 * fixed frame, inside the armed guard, after the world has settled and before the people move —
 * so an NPC deciding where to be this frame reads this frame's clock, not last frame's.
 */
export class Environment {
  /**
   * @param {object} data      game/data/world/weather.json
   * @param {function} regionIdAt  (x, z) => region id, or null outside a province
   */
  constructor(data, regionIdAt) {
    if (!data || !Array.isArray(data.regions)) throw new Error('Environment: weather.json missing or malformed');
    this.data = data;
    this.regionIdAt = regionIdAt || (() => null);
    this.byRegion = new Map();
    data.regions.forEach((r, i) => this.byRegion.set(r.region, { ...r, index: i }));
    this.stateOf = new Map();
    for (const r of data.regions) for (const s of r.states) this.stateOf.set(`${r.region}/${s.id}`, s);
    /** Every state id declared anywhere, so `setWeather` can stay a closed set that includes them. */
    this.allStates = new Map();
    for (const r of data.regions) for (const s of r.states) if (!this.allStates.has(s.id)) this.allStates.set(s.id, s);
    this.paused = false;          // A-W1-02: `pauseClock()` for a critic who needs the sun still
  }

  /** The machine for the region the player is standing in, falling back to the first declared. */
  machineFor(regionId) {
    return this.byRegion.get(regionId) || this.data.regions[0];
  }

  /**
   * Bring `env`'s derived integer clock into line with `env.timeOfDay`.
   *
   * This is what makes the file safe to add without touching `save/state.js`, `hearthRest` or
   * `setTimeOfDay`. Any of them may write `timeOfDay` directly; on the next step we notice that
   * the float no longer matches the integer we last published and re-derive. So a load, a rest and
   * a harness pin all land the clock in the same place, and none of them can desynchronise it.
   */
  _syncFromFloat(env) {
    const expected = this._hoursFor(env._clockFrames | 0);
    if (env._clockFrames === undefined || Math.abs(expected - env.timeOfDay) > 1e-6) {
      const h = ((Number(env.timeOfDay) % 24) + 24) % 24;
      env._clockFrames = Math.round(h / 24 * FRAMES_PER_DAY) % FRAMES_PER_DAY;
    }
  }

  _hoursFor(frames) {
    // Integer -> double, once. `Math.round(x*1e6)/1e6` matches sim/state.js's q6 save grid so the
    // value the step publishes is a value the save can hold exactly.
    return Math.round((frames % FRAMES_PER_DAY) * 24 / FRAMES_PER_DAY * 1e6) / 1e6;
  }

  /**
   * One fixed frame of world time.
   * @returns {null|object} the event payload if something happened worth a trace line
   */
  step(sim, bus) {
    const env = sim.env;
    this._syncFromFloat(env);

    // ---- 1. the clock ------------------------------------------------------------------------
    //
    // W1-13 round 3. RI-PRG04 §6 rule 4 is one sentence and it is load-bearing:
    //
    //   > **The clock does NOT advance on death.** Only resting moves time. Dying repeatedly at a
    //   > boss must not burn a quest deadline.
    //
    // and §7's death-loop check says it again as an assertion — *"assert the world clock did not
    // advance"*. The clock ticked through the death surface anyway, and the W1-13 round-3
    // aggregation is what caught it: `m_d4_across_death_diff` came back with ONE non-volatile
    // path changed across a death, `clock.time_of_day` 15.000741 -> 15.019352, which is 201
    // frames — the whole window, the 150 dead ones included. Neither standalone probe could see
    // it, because neither diffed the whole save across a death.
    //
    // A death is 150 frames of `SURFACE_FRAMES` the player cannot act in. Charging those to the
    // world clock is exactly the deadline burn the item names, and it was measured rather than
    // argued (`tools/harness/w1-13-r3-clock.mjs`, `reports/runs/W1-13-R3/clock.json`): FORTY
    // deaths at 20:58, with this branch monkeypatched back to the unconditional tick, walk the
    // world clock 20.967 -> 21.527 — **33.6 minutes of in-game time burned by dying**. With the
    // hold in place the same forty deaths cost 40 frames, one per death, which is the frame the
    // killing blow lands on: the clock runs FIRST in `sim/step.js`'s frame order, so on that one
    // frame the player was still alive when it ticked.
    //
    // The consumers are real and named at the top of this file: `sim/npc.js` picks a schedule
    // slot from the clock, `sim/settlement.js` decides whether a door is locked from it, and
    // `sim/souls.js` pays a different award at night. So the clock is HELD from the death to the
    // respawn and released the moment the body stands up.
    //
    // Deliberately NOT rewound: time that passed while the player was alive stays passed. This
    // freezes the interval the player did not have, and nothing else.
    const heldByDeath = !!(sim._death && sim._death.active);
    env.clockHeldByDeath = heldByDeath;
    if (heldByDeath) env._clockFramesHeldByDeath = (env._clockFramesHeldByDeath | 0) + 1;
    const before = env.timeOfDay;
    const phaseBefore = phaseOf(before);
    if (!this.paused && !heldByDeath) {
      env._clockFrames = (env._clockFrames + 1) % FRAMES_PER_DAY;
      if (env._clockFrames === 0) env.dayCount = (env.dayCount | 0) + 1;
      env.timeOfDay = this._hoursFor(env._clockFrames);
    }
    env.daylight = daylightAt(env.timeOfDay);
    const phaseNow = phaseOf(env.timeOfDay);
    env.phase = phaseNow;
    if (bus && phaseNow !== phaseBefore) {
      const ev = bus.emit(sim.frame, 'day_phase');
      ev.phase = phaseNow; ev.was = phaseBefore;
      ev.hour = env.timeOfDay; ev.day = env.dayCount | 0;
    }

    // ---- 2. which machine is running ----------------------------------------------------------
    const p = sim.player ? sim.player.pos : null;
    const rid = p ? this.regionIdAt(p[0], p[2]) : null;
    const m = this.machineFor(rid);
    const regionChanged = env.weatherRegion !== m.region;
    env.weatherRegion = m.region;

    // A weather id written from outside (setWeather, a loaded save) is adopted rather than
    // overwritten, so a critic who pins the sky keeps it until the next tick.
    if (env.weather !== env._lastWeather) {
      env._lastWeather = env.weather;
      env._weatherFrom = env.weather;
      env._frontFrame = sim.frame;      // an externally-set state arrives instantly, no front
      env._frontLen = 1;
    }

    // ---- 3. the tick -------------------------------------------------------------------------
    // Anchored on an absolute frame count so the tick boundary does not move when the player walks
    // across a border: two neighbouring regions roll on the same schedule, which is what makes a
    // FRONT rather than a per-region flicker.
    const tick = Math.floor(sim.frame / WEATHER_TICK_FRAMES);
    let changed = null;
    const inSet = m.states.some((s) => s.id === env.weather);
    const dueTick = env._lastTick !== tick;
    // A region whose machine does not contain the current state has to resolve it. That is the
    // border case and it is deliberately NOT instantaneous: it rolls at the next tick unless the
    // state is foreign, in which case it rolls on arrival — otherwise walking into the Stone
    // Wastes in a Blackwood downpour leaves it raining on a salt pan for twenty real minutes.
    if (dueTick || (regionChanged && !inSet) || !inSet) {
      env._lastTick = tick;
      const next = this._roll(m, env, tick);
      if (next !== env.weather) {
        env._weatherFrom = env.weather;
        env._frontFrame = sim.frame;
        env._frontLen = FRONT_FRAMES;
        env.weather = next;
        env._lastWeather = next;
        changed = { from: env._weatherFrom, to: next, region: m.region, tick };
        if (bus) {
          const ev = bus.emit(sim.frame, 'weather_change');
          ev.from = changed.from; ev.to = next; ev.region = m.region;
          ev.hour = env.timeOfDay; ev.front_frames = FRONT_FRAMES;
        }
      }
    }

    // ---- 4. republish the derived terms the rest of the world reads ---------------------------
    const cur = this.stateOf.get(`${m.region}/${env.weather}`) || this.allStates.get(env.weather) || null;
    const prev = this.stateOf.get(`${m.region}/${env._weatherFrom}`) || this.allStates.get(env._weatherFrom) || cur;
    const age = sim.frame - (env._frontFrame ?? sim.frame);
    const t = env._frontLen > 1 ? Math.min(1, Math.max(0, age / env._frontLen)) : 1;
    env.frontProgress = Math.round(t * 1e4) / 1e4;
    if (cur) {
      // The sightline is interpolated ACROSS the front, so a fog bank arrives over 45 s rather
      // than snapping. `render/sky.js` turns it into a Beer-Lambert extinction, so this number is
      // literally how far the frame lets you see.
      const a = prev ? prev.sightline_m : cur.sightline_m;
      env.sightlineM = Math.round((a + (cur.sightline_m - a) * t) * 100) / 100;
      env.weatherLight = t < 0.5 && prev ? prev.light : cur.light;
      env.weatherEffect = cur.effect || {};
    }
    return changed;
  }

  /**
   * One transition roll. Deterministic in (tick, region), weighted by the declared row and by the
   * state's diurnal preference — so the Clay Moor's `night_cold` is genuinely a night state and
   * `heat_shimmer` genuinely is not.
   */
  _roll(m, env, tick) {
    const row = m.transitions[env.weather] || m.transitions[m.initial];
    const phase = phaseOf(env.timeOfDay);
    const ids = m.states.map((s) => s.id);
    const w = [];
    let tot = 0;
    for (const id of ids) {
      const s = m.states.find((x) => x.id === id);
      let p = row[id] ?? 0;
      if (s && s.diurnal) {
        const d = s.diurnal;
        const key = phase === 'dawn' && d.dawn !== undefined ? 'dawn'
          : phase === 'night' ? 'night' : phase === 'dusk' && d.night !== undefined ? 'night' : 'day';
        p *= (d[key] ?? 1);
      }
      w.push(p); tot += p;
    }
    if (tot <= 0) return m.initial;
    const r = hash2(tick, m.index * 7919 + 13) * tot;
    let acc = 0;
    for (let i = 0; i < ids.length; i++) { acc += w[i]; if (r < acc) return ids[i]; }
    return ids[ids.length - 1];
  }

  /** What a critic reads back. Everything here is derived from the step, not from the data file. */
  report(sim) {
    const env = sim.env;
    const m = this.machineFor(env.weatherRegion);
    const cur = this.stateOf.get(`${m.region}/${env.weather}`) || this.allStates.get(env.weather) || null;
    return {
      time_of_day: env.timeOfDay,
      day: env.dayCount | 0,
      clock_frames: env._clockFrames | 0,
      frames_per_day: FRAMES_PER_DAY,
      timescale: TIMESCALE,
      phase: env.phase || phaseOf(env.timeOfDay),
      daylight: env.daylight ?? daylightAt(env.timeOfDay),
      paused: this.paused,
      // RI-PRG04 §6 rule 4, made readable: whether the clock is being held right now, and how
      // many frames it has been held for in total. A probe can then assert "the clock did not
      // advance on death" against the frames it knows the player spent dead, instead of against
      // a whole window that also contains ordinary play.
      held_by_death: !!env.clockHeldByDeath,
      clock_frames_held_by_death: env._clockFramesHeldByDeath | 0,
      region: m.region,
      weather: env.weather,
      weather_from: env._weatherFrom ?? env.weather,
      front_progress: env.frontProgress ?? 1,
      states_here: m.states.map((s) => s.id),
      worst_here: m.worst,
      light: env.weatherLight ?? (cur ? cur.light : null),
      sightline_m: env.sightlineM ?? (cur ? cur.sightline_m : null),
      effect: env.weatherEffect || (cur ? cur.effect : {}),
      next_tick_frame: (Math.floor(sim.frame / WEATHER_TICK_FRAMES) + 1) * WEATHER_TICK_FRAMES,
    };
  }
}
