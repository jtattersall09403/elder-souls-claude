// The regional ambience bed. W1-22, `audio.ambience.region`. Spec: RI-AUD03.
//
// THE CONSUMER (RI-MTH07). This module is driven from `Engine._afterStep()` — the one slot
// every way the world advances passes through (`stepFrames`, the rAF accumulator, `walkRoute`,
// `walkPath`, `travelRide`) and the same slot `_streamProvince()` uses, for the same reason:
// it is OUTSIDE `armSim()`'s determinism guard, so ambience cannot desynchronise a trace, and
// it is downstream of the frame's final position, so the bed answers for where the player
// actually ended the frame rather than where they started it.
//
// The input is `WorldField.regionAt(x, z)` — the live terrain raster, the same lookup
// `province.js` uses to decide what grows where. Nothing about ambience has its own idea of
// where the player is, which is why a border crossing cannot disagree with the ground.
//
// WHAT IS DELIBERATELY NOT HERE. Nothing in this file may write to `sim`. The bed reads the
// world and produces sound; if it ever fed back into the simulation, ambience would be a
// determinism hazard and every trace hash in the project would depend on whether a speaker was
// plugged in. The one place the world reads the bed back is `Engine.getAmbienceState()`, which
// is an observation surface for probes and the HUD, not a simulation input.
'use strict';

import { Rng } from '../core/rng.js';
import { buildContinuous, buildGrain, dbToGain, gainToDb } from './synth.js';

/** RI-AUD02 §D V5 — the ambience bus may not exceed eight concurrent voices. */
export const AMBIENCE_VOICE_CAP = 8;
/** RI-AUD03 §A — the region crossfade. */
export const CROSSFADE_S = 4.0;

const DAY_START = 6, DAY_END = 20;
export function todBand(hours) { return (hours >= DAY_START && hours < DAY_END) ? 'day' : 'night'; }

/** `when: {}` matches everything; `when: {tod:'night'}` matches only at night. R5. */
function matches(when, env) {
  if (!when) return true;
  if (when.tod && when.tod !== env.tod) return false;
  if (when.weather && when.weather !== env.weather) return false;
  return true;
}

/**
 * One layer's event clock. Shared, verbatim, by the live driver and the offline renderer —
 * that is the whole point of the class existing rather than each path rolling its own loop.
 * A measurement path that schedules events differently from the live path measures itself.
 *
 * RI-AUD03 R3: the interval comes from a seeded PRNG, deliberately giving up HARNESS.md §8's
 * permission for non-simulation code to use unseeded randomness. Ambience that is not
 * reproducible cannot be captured into a blind pack twice and compared.
 */
export class LayerClock {
  constructor(layer, rng, key) {
    this.layer = layer;
    this.rng = rng;
    this.key = key;
    this.next = layer ? this._draw(0) : Infinity;
  }

  _band(env) {
    // The Stone Forest's stone-tick RATE rises after dusk — a different clock, not a filter.
    if (env && env.tod === 'night' && this.layer.night_interval_s) return this.layer.night_interval_s;
    return this.layer.interval_s;
  }

  _draw(t, env) {
    const [lo, hi] = this._band(env) || [10, 30];
    return t + lo + this.rng.next() * (hi - lo);
  }

  /** Every event due in [t, t+dt). Returns [] when the layer is null — R1 costs nothing. */
  due(t, dt, env) {
    if (!this.layer) return [];
    const out = [];
    while (this.next < t + dt) {
      const at = this.next;
      const ev = this._pick(env);
      if (ev) out.push({ at, ev });
      this.next = this._draw(at, env);
      if (out.length > 32) break;   // a runaway clock is a bug, not a soundscape
    }
    return out;
  }

  /** Weighted pick among the events whose `when` matches the current environment. */
  _pick(env) {
    const pool = (this.layer.events || []).filter((e) => matches(e.when, env));
    if (!pool.length) return null;
    let total = 0;
    for (const e of pool) total += (e.weight || 1);
    let r = this.rng.next() * total;
    for (const e of pool) { r -= (e.weight || 1); if (r <= 0) return e; }
    return pool[pool.length - 1];
  }
}

// ---- positional emitters (RI-AUD03 R7) ------------------------------------------------------

/**
 * Where a world-anchored emitter sits in the mix, computed ANALYTICALLY rather than with a
 * `PannerNode`.
 *
 * This is the ambience contribution to S8: the world may not tell the player where they are
 * with an arrow, so it tells them with the bell buoy. That only works if pan and gain are real
 * functions of bearing and distance — which means B6 has to be able to read them and assert
 * monotonicity along a transect. A `PannerNode` would compute the same thing and hide it.
 *
 * Rolloff is inverse-distance clamped at `ref_m`, cut to silence beyond `audible_m`. The buoy
 * is "audible from 600 m" in `regions.json`, so 600 m is where it stops, not where it fades.
 *
 * @param e emitter record from the bed data
 * @param x,z player position, metres
 * @param yawRad player facing (0 = +Z, matching the sim's yaw convention)
 */
export function emitterPlacement(e, x, z, yawRad) {
  const dx = e.pos_m[0] - x, dz = e.pos_m[1] - z;
  const dist = Math.sqrt(dx * dx + dz * dz);
  if (dist > e.audible_m) return { audible: false, distance_m: dist, gain: 0, gain_db: -Infinity, pan: 0, bearing_deg: 0 };
  const ref = e.ref_m || 20;
  const gain = Math.min(1, ref / Math.max(ref, dist));
  // Bearing of the emitter RELATIVE to where the player is looking. Turning your head must
  // move the bell across the stereo field; if it does not, the emitter is not navigational.
  const world = Math.atan2(dx, dz);
  let rel = world - yawRad;
  while (rel > Math.PI) rel -= 2 * Math.PI;
  while (rel < -Math.PI) rel += 2 * Math.PI;
  return {
    audible: true,
    distance_m: dist,
    gain,
    gain_db: gainToDb(gain),
    pan: Math.sin(rel),
    bearing_deg: rel * 180 / Math.PI,
  };
}

/**
 * The Hive's L1 is the only gradient in the game: the chord flattens as you approach the
 * queen. Returns the detune, in cents, to apply to every partial.
 */
export function gradientCents(g, x, z) {
  if (!g) return 0;
  const dx = g.anchor_m[0] - x, dz = g.anchor_m[1] - z;
  const d = Math.sqrt(dx * dx + dz * dz);
  const t = Math.min(1, d / g.span_m);
  return g.pitch_cents_near + (g.pitch_cents_far - g.pitch_cents_near) * t;
}

// ---- the driver -----------------------------------------------------------------------------

/**
 * The world-side model. It runs every frame whether or not there is an audio device, because
 * a bed that only exists when a speaker is attached cannot be measured on a headless box —
 * and this box has no speaker. `attach(ctx)` connects it to real Web Audio when one exists.
 */
export class AmbienceDriver {
  constructor(beds, opts = {}) {
    this.beds = beds || {};
    this.seed = opts.seed === undefined ? 0xa3b1 : opts.seed;
    this.rng = new Rng(this.seed);
    this.region = null;
    this.prevRegion = null;
    this.t = 0;                     // seconds of world time the bed has been driven
    this.crossfade = 1;             // 1 = settled on `region`
    this.clocks = {};
    this.log = [];
    this.logCap = opts.logCap === undefined ? 4000 : opts.logCap;
    this.events = 0;
    this.voicesActive = 0;
    this.voicesPeak = 0;
    this.borderCrossings = 0;
    this.ctx = null;
    this.live = null;
    this.lastEnv = null;
    this.emitterState = [];
  }

  bedFor(id) { return this.beds[id] || null; }

  _rebuildClocks(bed) {
    // A fresh, region-derived seed so that entering the same region twice in a run produces
    // the same schedule, and two different regions never share one.
    let h = this.seed >>> 0;
    for (let i = 0; i < bed.id.length; i++) h = (Math.imul(h ^ bed.id.charCodeAt(i), 0x01000193)) >>> 0;
    this.rng = new Rng(h);
    this.clocks = {
      L3: new LayerClock(bed.layers.L3, this.rng, 'L3'),
      L4: new LayerClock(bed.layers.L4, this.rng, 'L4'),
    };
  }

  /**
   * One frame. Called from `Engine._afterStep()`.
   * @param s {{regionId,x,z,yawRad,timeOfDay,weather,frame,dt}}
   */
  step(s) {
    const dt = s.dt === undefined ? 1 / 60 : s.dt;
    const env = { tod: todBand(s.timeOfDay === undefined ? 12 : s.timeOfDay), weather: s.weather || 'clear' };
    this.lastEnv = env;

    if (s.regionId && s.regionId !== this.region) {
      const bed = this.bedFor(s.regionId);
      if (bed) {
        this.prevRegion = this.region;
        this.region = s.regionId;
        this.crossfade = 0;
        this._rebuildClocks(bed);
        if (this.prevRegion) this.borderCrossings++;
        this._emit({ frame: s.frame, type: 'region_change', bus: 'ambience', region: this.region,
                     from: this.prevRegion, crossfade_s: CROSSFADE_S });
        if (this.ctx && this.live) this._swapLive(bed);
      }
    }

    const bed = this.bedFor(this.region);
    if (!bed) return;
    if (this.crossfade < 1) this.crossfade = Math.min(1, this.crossfade + dt / CROSSFADE_S);

    // Continuous voices: L1 (always, if declared) plus every L2 sublayer whose `when` matches.
    let voices = 0;
    if (bed.layers.L1) voices += (bed.layers.L1.voices || 1);
    if (bed.layers.L2) {
      for (const sub of bed.layers.L2.sublayers || []) if (matches(sub.when, env)) voices += 1;
    }

    // Scheduled layers.
    for (const key of ['L3', 'L4']) {
      const clock = this.clocks[key];
      if (!clock) continue;
      for (const { at, ev } of clock.due(this.t, dt, env)) {
        const layer = bed.layers[key];
        const pan = ev.pan ? ev.pan[0] + this.rng.next() * (ev.pan[1] - ev.pan[0]) : 0;
        this.events++;
        voices += 1;
        this._emit({
          frame: s.frame, type: 'ambience_event', bus: 'ambience', region: this.region,
          layer: key, id: ev.id, classes: ev.classes || [],
          at_s: Math.round(at * 1000) / 1000,
          pan: Math.round(pan * 1000) / 1000,
          level_db: layer.level_db || 0,
        });
        if (this.ctx && this.live) {
          buildGrain(this.ctx, { ...ev, level_db: layer.level_db || 0 },
                     this.live.bus, this.rng, this.ctx.currentTime + Math.max(0, at - this.t), pan);
        }
      }
    }

    // R7 emitters. Recomputed every frame — this is the thing a player steers by.
    this.emitterState = [];
    for (const e of bed.emitters || []) {
      const p = emitterPlacement(e, s.x || 0, s.z || 0, s.yawRad || 0);
      this.emitterState.push({ id: e.id, ...p, pos_m: e.pos_m, audible_m: e.audible_m });
      if (p.audible) voices += 1;
    }

    this.voicesActive = voices;
    if (voices > this.voicesPeak) this.voicesPeak = voices;
    this.t += dt;
  }

  _emit(rec) {
    this.log.push(rec);
    if (this.log.length > this.logCap) this.log.splice(0, this.log.length - this.logCap);
  }

  /** RI-AUD02 §E `audioLog()` shape, ambience rows only. */
  audioLog(limit) {
    const n = limit === undefined ? this.log.length : Math.min(this.log.length, limit);
    return this.log.slice(this.log.length - n);
  }

  state() {
    const bed = this.bedFor(this.region);
    return {
      region: this.region,
      previous_region: this.prevRegion,
      crossfade: Math.round(this.crossfade * 1000) / 1000,
      crossfade_s: CROSSFADE_S,
      t_s: Math.round(this.t * 1000) / 1000,
      layers: bed ? {
        L1: bed.layers.L1 ? bed.layers.L1.id : null,
        L2: bed.layers.L2 ? bed.layers.L2.id : null,
        L3: bed.layers.L3 ? bed.layers.L3.id : null,
        L4: bed.layers.L4 ? bed.layers.L4.id : null,
      } : null,
      denies: bed ? (bed.denies || []).map((d) => d.class) : [],
      bed_lufs_target: bed ? bed.bed_lufs_target : null,
      emitters: this.emitterState,
      events: this.events,
      border_crossings: this.borderCrossings,
      voices_active: this.voicesActive,
      voices_peak: this.voicesPeak,
      voice_cap: AMBIENCE_VOICE_CAP,
      over_cap: this.voicesPeak > AMBIENCE_VOICE_CAP,
      tod: this.lastEnv ? this.lastEnv.tod : null,
      weather: this.lastEnv ? this.lastEnv.weather : null,
      context: this.ctx ? 'live' : 'model-only',
      beds_loaded: Object.keys(this.beds).length,
    };
  }

  // ---- live attachment ---------------------------------------------------------------------

  attach(ctx) {
    this.ctx = ctx;
    const bus = ctx.createGain();
    bus.gain.value = 1;
    bus.connect(ctx.destination);
    this.live = { bus, layers: [] };
    const bed = this.bedFor(this.region);
    if (bed) this._swapLive(bed);
    return true;
  }

  _swapLive(bed) {
    const ctx = this.ctx, now = ctx.currentTime;
    for (const old of this.live.layers) {
      old.gain.gain.setValueAtTime(old.gain.gain.value, now);
      old.gain.gain.linearRampToValueAtTime(0.0001, now + CROSSFADE_S);
      old.stop(now + CROSSFADE_S + 0.05);
    }
    this.live.layers = buildBedContinuous(ctx, bed, this.live.bus, new Rng(this.seed ^ 0x51ed),
                                          this.lastEnv || { tod: 'day', weather: 'clear' }, now, CROSSFADE_S);
  }

  detach() {
    if (this.live) { for (const l of this.live.layers) l.stop(this.ctx.currentTime); }
    this.ctx = null; this.live = null;
  }
}

/** Every continuous voice a bed has in this environment, faded in over `fadeIn` seconds. */
export function buildBedContinuous(ctx, bed, dest, rng, env, t0 = 0, fadeIn = 0, gradientPos = null) {
  const out = [];
  const mk = (synth, levelDb, gradient) => {
    const h = buildContinuous(ctx, synth, dest, rng, t0);
    const target = h.gain.gain.value * dbToGain(levelDb || 0);
    if (fadeIn > 0) {
      h.gain.gain.setValueAtTime(0.0001, t0);
      h.gain.gain.linearRampToValueAtTime(target, t0 + fadeIn);
    } else h.gain.gain.value = target;
    if (gradient && gradientPos && h.oscs) {
      const cents = gradientCents(gradient, gradientPos[0], gradientPos[1]);
      for (const o of h.oscs) o.detune.value += cents;
    }
    out.push(h);
  };
  if (bed.layers.L1) mk(bed.layers.L1.synth, bed.layers.L1.level_db, bed.layers.L1.gradient);
  if (bed.layers.L2) {
    for (const sub of bed.layers.L2.sublayers || []) {
      if (matches(sub.when, env)) mk(sub.synth, bed.layers.L2.level_db);
    }
  }
  return out;
}

/**
 * Render `seconds` of one region's ambience into PCM. THIS IS THE EVIDENCE PATH.
 *
 * RI-AUD03's comparison method wants a 20-second ambience-bus-only capture per region. This is
 * that capture, and it is built from the identical `buildBedContinuous` / `LayerClock` /
 * `buildGrain` code the live driver uses — so a spectrum measured here is a spectrum of what
 * the world plays, not of a measurement rig that resembles it.
 *
 * @param OfflineCtor `window.OfflineAudioContext`
 * @returns Promise<AudioBuffer>
 */
export async function renderBedOffline(OfflineCtor, bed, opts = {}) {
  const seconds = opts.seconds === undefined ? 20 : opts.seconds;
  const sampleRate = opts.sampleRate === undefined ? 24000 : opts.sampleRate;
  const env = { tod: opts.tod || 'day', weather: opts.weather || 'clear' };
  const ctx = new OfflineCtor(2, Math.ceil(seconds * sampleRate), sampleRate);
  const bus = ctx.createGain();
  bus.gain.value = 1;
  bus.connect(ctx.destination);

  let h = (opts.seed === undefined ? 0xa3b1 : opts.seed) >>> 0;
  for (let i = 0; i < bed.id.length; i++) h = (Math.imul(h ^ bed.id.charCodeAt(i), 0x01000193)) >>> 0;

  buildBedContinuous(ctx, bed, bus, new Rng(h ^ 0x51ed), env, 0, 0, opts.listener || null);

  const rng = new Rng(h);
  const clocks = { L3: new LayerClock(bed.layers.L3, rng, 'L3'), L4: new LayerClock(bed.layers.L4, rng, 'L4') };
  const fired = [];
  for (const key of ['L3', 'L4']) {
    for (const { at, ev } of clocks[key].due(0, seconds, env)) {
      const pan = ev.pan ? ev.pan[0] + rng.next() * (ev.pan[1] - ev.pan[0]) : 0;
      buildGrain(ctx, { ...ev, level_db: bed.layers[key].level_db || 0 }, bus, rng, at, pan);
      fired.push({ layer: key, id: ev.id, at_s: Math.round(at * 100) / 100, pan: Math.round(pan * 100) / 100 });
    }
  }
  // Emitters, if the caller placed a listener. `null` listener = the region bed alone, which
  // is what §C's blind clip wants: no landmarks, so the judge cannot navigate, only describe.
  if (opts.listener) {
    for (const e of bed.emitters || []) {
      const p = emitterPlacement(e, opts.listener[0], opts.listener[1], opts.listener[2] || 0);
      if (!p.audible) continue;
      const period = e.period_s || 20;
      for (let t = period * 0.5; t < seconds; t += period) {
        buildGrain(ctx, { ...e, level_db: e.level_db || 0 }, bus, rng, t, p.pan, p.gain);
        fired.push({ layer: 'emitter', id: e.id, at_s: Math.round(t * 100) / 100,
                     pan: Math.round(p.pan * 1000) / 1000, gain: Math.round(p.gain * 1000) / 1000,
                     distance_m: Math.round(p.distance_m) });
      }
    }
  }
  const buf = await ctx.startRendering();
  buf.__fired = fired;
  return buf;
}
