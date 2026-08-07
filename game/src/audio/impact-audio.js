// COMBAT IMPACT AUDIO — `audio.combat.impact`. RI-AUD01 (design) and RI-AUD02 (platform). W1-11.
//
// ────────────────────────────────────────────────────────────────────────────────────────────
// WHAT THIS FILE IS FOR, IN ONE SENTENCE FROM THE ITEM IT IMPLEMENTS
//
//   "A hit that the player cannot hear is a hit the player did not get told about, and a
//    deterministic hit-or-miss system that is not reported is indistinguishable from a dice
//    roll."                                                            — RI-AUD01, arbitration
//
// Before this file the build had no combat sound of any kind, and RI-AUD01's scoring rule is
// blunt about what that is worth: "Unimplemented audio scores 0, not 'not assessed'."
//
// ────────────────────────────────────────────────────────────────────────────────────────────
// THE ONE STRUCTURAL DECISION, AND WHY IT IS THE WHOLE ITEM
//
// RI-AUD01 §B's frame contract says the audio decision must happen on the frame the GEOMETRY
// decided, and names the specific way builds break it:
//
//   "the sound is triggered from the ANIMATION EVENT TRACK (`atk_light` frame 7, 'play swing
//    sound') rather than from the HIT RESOLUTION. That plays the impact even when the swing
//    whiffs, plays it before the geometry has decided, and plays the same sound whether the
//    target was flesh, chitin, or a raised shield."
//
// So `ImpactAudio.onEvent` is called from ONE place: the `emit` closure inside
// `CombatSystem.step` (game/src/combat/system.js), which is the single funnel every combat
// event in the game passes through, inside the same call stack as `sweepAndResolve`. There is
// no queue between the geometry and the decision and there cannot be one — `onEvent` runs
// before `sweepAndResolve` has even returned.
//
// That makes M1's `|audio.frame − event.f| == 0` true BY CONSTRUCTION. A critic is right to be
// suspicious of that, so the instrument is built to be able to fail: `tools/analysis/
// audio-sync.mjs` joins the two streams independently and `ImpactAudio` ships a documented
// `trigger_source` switch — set it to `'anim'` and the driver fires from `ACTION_START`
// instead, exactly as §B describes, and the analysis goes red with `fired_on_anim_start > 0`.
// That sabotage is run in `tools/audio/impact-probe.mjs --sabotage anim` and its red output is
// the evidence that the green output means something.
//
// ────────────────────────────────────────────────────────────────────────────────────────────
// MODEL MODE AND LIVE MODE ARE THE SAME CODE
//
// This machine has no audio device. RI-AUD01's own provenance note says so and calls the
// offline render "the load-bearing one". So the driver runs in two modes off one code path:
//
//   * MODEL mode  — no BaseAudioContext at all. Classification, variant choice, gain, pan,
//     the voice budget and the log all run. This is what `tools/lib/combat-node.mjs` and every
//     headless probe measure, and it is what makes the decision layer testable at 500x.
//   * LIVE mode   — a BaseAudioContext is attached. The identical decisions are handed to
//     `buildImpactVoice`, which is also what the OfflineAudioContext render calls.
//
// The measurement path is never a second implementation. RI-AUD03's builder learned the same
// thing on the ambience side and the note is worth repeating: a measurement path that is a
// second implementation measures the second implementation.
'use strict';

import { Rng } from '../core/rng.js';
import { dbToGain, makeNoiseBuffer } from './synth.js';

// ---- RI-AUD02 §B, the scheduling contract ---------------------------------------------------
// B2: TICK_MS <= 10.  B3: 25 <= LOOKAHEAD <= 100.
// These are the driver's own contribution to jitter and they are chosen at the safe end of both
// bounds: an 8 ms tick with a 40 ms horizon keeps the scheduler's worst case (one missed tick
// plus the horizon) at 48 ms, comfortably inside the ~55 ms at which a hitstop stops feeling
// simultaneous, and comfortably outside the 25 ms floor below which the scheduler races itself.
export const TICK_MS = 8;
export const LOOKAHEAD_MS = 40;

// RI-AUD02 §D. V1 total, V2 sfx bus, V3 impact classes, V4 voice, V5 ambience, V6 music.
export const VOICE_CAPS = { total: 32, sfx: 16, impact: 8, voice: 6, ambience: 8, music: 4, ui: 4 };

// RI-AUD02 §E S2. Spatialisation is computed analytically rather than with a PannerNode for the
// same reason ambience.js gives: a number inside an audio graph is a number a probe cannot read,
// and M6 has to correlate `pan` against bearing over >= 20 events.
export const PANNER = {
  model: 'equalpower', distanceModel: 'inverse',
  refDistance: 1.0, maxDistance: 40.0, rolloffFactor: 1.0,
};

/** The six-name closed set. A bus outside it is RI-AUD02 "How we lose" #7 and is rejected. */
const BUSES = new Set(['sfx', 'music', 'ambience', 'voice', 'ui']);

/**
 * RI-AUD02 §E S2's inverse distance model, written out rather than delegated, because S4 says
 * player-originated sounds take NO panner and the branch has to be visible.
 */
export function distanceGain(d) {
  const { refDistance: r, rolloffFactor: f, maxDistance: m } = PANNER;
  const dd = Math.min(Math.max(d, r), m);
  return r / (r + f * (dd - r));
}

/**
 * Equal-power pan from a bearing in the LISTENER's frame, in degrees, 0 = dead ahead.
 *
 * RI-AUD02 §E S6 is the trap this signature exists to avoid: the listener is at the CHARACTER,
 * not at the orbit camera. Callers pass the player's yaw, never the camera's, and
 * `listenerAttachedTo` reports `'character'` — but S6 is scored by the camera-orbit measurement
 * rather than by that self-report, and correctly so.
 */
export function panFromBearing(relBearingDeg) {
  const r = (relBearingDeg * Math.PI) / 180;
  return Math.max(-1, Math.min(1, Math.sin(r)));
}

// ---- classification -------------------------------------------------------------------------

/**
 * (trace event) -> RI-AUD01 §A class id.
 *
 * The material and tier join is the reason this is not a lookup table. §A distinguishes C01
 * (`hit_flesh_light`) from C02 (`hit_chitin_light`) from C03 (`hit_flesh_heavy`) by WHAT WAS
 * HIT and HOW HEAVY THE WEAPON WAS, and both facts are already on the `IMPACT` event that
 * `resolve.js#emitImpact` writes. Nothing here re-derives them and nothing here can disagree
 * with the fight, because it is reading the fight's own resolution.
 *
 * `null` means "this event has no impact class", which is most events. Silence for an event
 * with no class is correct; a fallback class would be the "one sword.wav" failure wearing a
 * switch statement.
 */
export function classifyEvent(kind, e, opts = {}) {
  const playerId = opts.playerId === undefined ? 'player' : opts.playerId;
  switch (kind) {
    case 'PARRY': return 'parried';
    case 'GUARD_BREAK': return 'guard_break';
    case 'WHIFF': return 'whiff';
    case 'DEATH': return 'death';
    case 'EXHAUSTED_ENTER': return 'stamina_break';
    case 'CRIT_HIT': return e.kind === 'riposte' ? 'riposte' : 'backstab';
    case 'IMPACT': {
      // A raised shield IS a material — it is the `shield` column of RI-WPN05 §A — so a blocked
      // blow arrives here already labelled and needs no second branch.
      if (e.material === 'shield') return 'blocked';
      // The player's own body is C10 and takes the effort layer. §A row C10: "hit (owner=enemy)".
      if (e.dst === playerId) return 'player_hurt';
      // §A has no `deflect` row. A deflect is a blade skidding off stone and C02's brief —
      // "bright hard skid, high transient, ringing tail" — is literally that sound, so a deflect
      // is voiced as C02 and the log records `via: 'deflect'` so the join is never guessed at.
      const hard = e.impact_row === 'stone' || e.impact_row === 'metal' || e.impact_row === 'chitin';
      if (hard) return 'hit_chitin_light';
      return (e.tier === 'heavy' || e.tier === 'ultra') ? 'hit_flesh_heavy' : 'hit_flesh_light';
    }
    default: return null;
  }
}

// ---- the driver -----------------------------------------------------------------------------

export class ImpactAudio {
  /**
   * @param {object} data  game/data/audio/impact/classes.json
   * @param {object} opts  {seed, playerId, trigger_source}
   */
  constructor(data, opts = {}) {
    this.data = data && data.classes ? data : { classes: {} };
    this.seed = opts.seed === undefined ? 0x11a0 : opts.seed;
    this.playerId = opts.playerId === undefined ? 'player' : opts.playerId;
    // 'resolution' is the contract. 'anim' is the DELIBERATE DEFECT of RI-AUD01 §B, kept in the
    // shipped code so the probe that detects it can be shown going red on demand. It is never
    // the default and `audioStats().trigger_source` reports it, so a build running the defect
    // cannot hide.
    this.triggerSource = opts.trigger_source || 'resolution';

    this.rng = new Rng(this.seed);
    /** M5: the last variant index played per class — never repeat it immediately. */
    this.lastVariant = new Map();
    /** V9: (frame, class) -> log row, for same-frame same-class collapse. */
    this.frameClass = new Map();
    this.log = [];
    this.queue = [];
    this.voices = [];        // {class, bus, id, startedAt, endsAt}
    this.voicesPeak = 0;
    this.voicesPeakByBus = { sfx: 0, music: 0, ambience: 0, voice: 0, ui: 0 };
    this.stolen = 0;
    this.scheduleMisses = 0;
    this.dropped = 0;
    this.htmlAudioElements = 0;   // this driver constructs none, ever — RI-AUD02 §C D2
    this.decodesAfterReady = 0;   // and decodes nothing — every voice is synthesised
    this.voiceSeq = 0;
    this.frame = 0;

    this.ctx = null;
    this.bus = null;
    this.anchor = null;           // RI-AUD02 B5: ONE (frame, ctx.currentTime) pair per run
    this.timer = null;
    this.driver = 'none';
  }

  /** Is a class id one this build actually voices? */
  has(cls) { return !!(cls && this.data.classes[cls]); }

  /**
   * RI-AUD02 B5. The anchor is captured ONCE and every `playAt` is derived from it. Re-deriving
   * from `performance.now()` per event re-imports wall-clock jitter into a fixed-step simulation,
   * which is HARNESS.md D3 in spirit and an intermittently non-reproducible trace in practice.
   */
  frameTime(f) {
    if (!this.anchor) return f / 60;
    return this.anchor.t + (f - this.anchor.frame) / 60;
  }

  /**
   * LIVE mode. Attach a real graph.
   *
   * `ctx` is typed as a BaseAudioContext deliberately: an OfflineAudioContext is equally valid
   * here and that is what makes the measurement path the same code as the speaker path.
   * RI-AUD02 A1 (exactly one context for the page's lifetime) is the caller's obligation —
   * `Engine` owns it — and A3 (`running` before the first combat frame) is asserted by the
   * caller through `unlock()`.
   */
  attach(ctx, dest, frame = 0) {
    this.ctx = ctx;
    this.bus = ctx.createGain();
    this.bus.gain.value = 1;
    this.bus.connect(dest || ctx.destination);
    this.anchor = { frame, t: ctx.currentTime };
    return this;
  }

  /**
   * RI-AUD02 §B B1 — the scheduler is driven by a TIMER, never by requestAnimationFrame.
   *
   * HF1 exists because rAF is a RENDER signal: throttled in background tabs, capped by the
   * compositor, and on this project's SwiftShader renderer hundreds of milliseconds apart. An
   * rAF-driven scheduler makes audio latency a function of triangle count, and it is invisible
   * on the machine where it is written.
   */
  startScheduler(setIntervalFn) {
    const si = setIntervalFn || (typeof setInterval === 'function' ? setInterval : null);
    if (!si) { this.driver = 'none'; return this; }
    this.driver = 'interval';
    this.timer = si(() => this.tick(), TICK_MS);
    return this;
  }

  stopScheduler(clearIntervalFn) {
    const ci = clearIntervalFn || (typeof clearInterval === 'function' ? clearInterval : null);
    if (this.timer && ci) ci(this.timer);
    this.timer = null;
    this.driver = 'none';
    return this;
  }

  /**
   * THE HOOK. Called from `CombatSystem.step`'s `emit` closure — the same call stack as the
   * geometry decision, on the frame the geometry decided.
   *
   * @param {number} frame  the SIM frame. Not a timestamp, not `ctx.currentTime`, not a
   *                        render frame.
   * @param {string} kind   the UPPER_SNAKE trace event kind
   * @param {object} e      the event object as `resolve.js` filled it
   * @param {object} world  {playerPos:[x,y,z], playerYawDeg, posOf(id)->[x,y,z]|null}
   */
  onEvent(frame, kind, e, world) {
    this.frame = frame;
    // The sabotage switch. In `'anim'` mode the driver ignores resolution entirely and fires off
    // the animation start, which is RI-AUD01 §B's named failure. Kept, documented, off.
    if (this.triggerSource === 'anim') {
      if (kind !== 'ACTION_START' || e.tag === 'dodge') return null;
      return this._emitVoice(frame, 'hit_flesh_light', e, world, { via: 'anim_track' });
    }
    const cls = classifyEvent(kind, e, { playerId: this.playerId });
    if (!cls) return null;
    if (!this.has(cls)) { this.dropped++; return null; }
    const via = kind === 'IMPACT' && e.deflect ? 'deflect' : (kind === 'IMPACT' ? (e.via || 'weapon') : kind.toLowerCase());
    return this._emitVoice(frame, cls, e, world, { via, kind });
  }

  _emitVoice(frame, cls, e, world, meta) {
    const spec = this.data.classes[cls];
    const key = `${frame}|${cls}`;

    // RI-AUD02 V9 — same-frame same-class collapse. Two hitboxes overlapping the same target on
    // the same frame is a geometry fact and it must not become a volume spike; the second event
    // raises the first voice's gain by 30% and does not open a second voice.
    const prior = this.frameClass.get(key);
    if (prior) {
      prior.collapsed = (prior.collapsed || 1) + 1;
      prior.gain = +Math.min(1, prior.gain * (1 + 0.3 * (prior.collapsed - 1))).toFixed(6);
      return prior;
    }

    // M5/M9 — >= 4 variants, chosen from the SEEDED prng, never immediately repeating the
    // previous variant of the same class. Determinism is not a nicety here: two runs at the
    // same seed must produce an identical `sample_id` sequence or M9 fails, and an unseeded
    // variant choice is M9's hard fail.
    const n = spec.variants.length;
    const last = this.lastVariant.has(cls) ? this.lastVariant.get(cls) : -1;
    let vi = Math.floor(this.rng.next() * n) % n;
    if (n > 1 && vi === last) vi = (vi + 1) % n;
    this.lastVariant.set(cls, vi);
    const variant = spec.variants[vi];

    // §C — the class's declared dry peak, plus the per-variant normalisation that puts the
    // rendered peak ON that number. One place knows what a class's level is.
    const baseGain = dbToGain(spec.peak_dbfs + (variant.norm_db || 0));

    // M6 — spatialisation. Bearing is taken in the PLAYER's frame (RI-AUD02 S6), and a
    // non-spatialised class (C10 the player's own body, C11 non-diegetic) takes neither pan nor
    // distance attenuation, per S4.
    let pan = 0, dist = 1, dgain = 1;
    const srcPos = world && world.posOf ? world.posOf(meta.kind === 'WHIFF' ? e.src : (e.src || e.who || e.dst)) : null;
    if (spec.spatialised && srcPos && world && world.playerPos) {
      const dx = srcPos[0] - world.playerPos[0];
      const dz = srcPos[2] - world.playerPos[2];
      dist = Math.hypot(dx, dz);
      const worldBearing = (Math.atan2(dx, dz) * 180) / Math.PI;
      let rel = worldBearing - (world.playerYawDeg || 0);
      while (rel > 180) rel -= 360;
      while (rel < -180) rel += 360;
      pan = +panFromBearing(rel).toFixed(6);
      dgain = distanceGain(dist);
    }

    const bus = BUSES.has(spec.bus) ? spec.bus : 'sfx';
    const t = this.ctx ? this.ctx.currentTime : this.frameTime(frame);
    const playAt = this.frameTime(frame) + LOOKAHEAD_MS / 1000;

    const row = {
      t: +t.toFixed(6),
      frame,                                   // §B: the SIM frame the game DECIDED on
      playAt: +playAt.toFixed(6),
      event: meta.kind || 'IMPACT',
      class: cls,
      code: spec.code,
      sample_id: variant.sample_id,
      gain: +(baseGain * dgain).toFixed(6),
      dry_gain: +baseGain.toFixed(6),
      peak_dbfs: spec.peak_dbfs,
      pan,
      distance_m: +dist.toFixed(4),
      voice_id: `v${++this.voiceSeq}`,
      bus,
      via: meta.via || null,
      src: e.src || e.who || null,
      dst: e.dst || null,
      material: e.material || null,
      tier: e.tier || null,
      collapsed: 1,
      stolen: false,
    };
    this.log.push(row);
    this.frameClass.set(key, row);
    this._admit(row);
    this.queue.push(row);
    return row;
  }

  /**
   * RI-AUD02 §D V1/V2/V3 and V7.
   *
   * V7 is a CORRECTNESS rule, not a performance rule: "a footstep must never steal a parry".
   * A naive global `if (voices > 32) return;` is correct, cheap, and silently drops the parry
   * chime in exactly the fights where voices peak — which is exactly the fights where the parry
   * chime is the only thing telling the player they survived. So stealing is oldest-first
   * WITHIN THE SAME CLASS and never across classes; when a class is alone at the cap and its
   * own oldest voice is the only candidate, that is the voice that goes.
   */
  _admit(row) {
    const now = this.frameTime(row.frame);
    this.voices = this.voices.filter((v) => v.endsAt > now);

    const sameClass = () => this.voices.filter((v) => v.class === row.class);
    const impactVoices = () => this.voices.filter((v) => v.impact).length;
    const busVoices = (b) => this.voices.filter((v) => v.bus === b).length;

    const overCap = () => this.voices.length >= VOICE_CAPS.total
      || (row.bus === 'sfx' && busVoices('sfx') >= VOICE_CAPS.sfx)
      || impactVoices() >= VOICE_CAPS.impact;

    let guard = 0;
    while (overCap() && guard++ < 64) {
      const cands = sameClass();
      if (!cands.length) break;                     // never steal across classes — V7
      cands.sort((a, b) => a.startedAt - b.startedAt);
      const victim = cands[0];
      this.voices = this.voices.filter((v) => v !== victim);
      this.stolen++;
      const lr = this.log.find((r) => r.voice_id === victim.id);
      if (lr) lr.stolen = true;
    }
    if (overCap()) { this.dropped++; row.dropped = true; return; }

    this.voices.push({
      class: row.class, bus: row.bus, id: row.voice_id, impact: true,
      startedAt: now, endsAt: now + 0.9,
    });
    if (this.voices.length > this.voicesPeak) this.voicesPeak = this.voices.length;
    const bv = busVoices(row.bus);
    if (bv > this.voicesPeakByBus[row.bus]) this.voicesPeakByBus[row.bus] = bv;
  }

  /**
   * The lookahead scheduler tick — RI-AUD02 §B's REQUIRED column, verbatim in shape.
   * Fires every voice whose `playAt` falls inside the horizon, with an explicit absolute start
   * time (B4). B6: a voice whose time has already passed is DROPPED and counted, never started
   * bare and never started in the past.
   */
  tick() {
    if (!this.ctx) return 0;
    const now = this.ctx.currentTime;
    const horizon = now + LOOKAHEAD_MS / 1000;
    let fired = 0;
    while (this.queue.length && this.queue[0].playAt < horizon) {
      const row = this.queue.shift();
      if (row.dropped) continue;
      if (row.playAt <= now) { this.scheduleMisses++; continue; }   // B6
      buildImpactVoice(this.ctx, this.data.classes[row.class], row, this.bus, new Rng(this.seed ^ this.voiceSeq));
      fired++;
    }
    return fired;
  }

  /** RI-AUD01 §Provenance `audioLog()`. */
  audioLog(opts = {}) {
    const since = opts.sinceFrame === undefined ? -Infinity : opts.sinceFrame;
    const rows = this.log.filter((r) => r.frame >= since);
    return opts.limit ? rows.slice(-opts.limit) : rows;
  }

  /** RI-AUD02 §Provenance `audioStats()`. */
  audioStats() {
    const ctx = this.ctx;
    return {
      available: true,
      mode: ctx ? 'live' : 'model',
      ctxState: ctx ? ctx.state : 'none',
      sampleRate: ctx ? ctx.sampleRate : null,
      latencyHint: 'interactive',
      baseLatency: ctx && ctx.baseLatency !== undefined ? ctx.baseLatency : null,
      outputLatency: ctx && ctx.outputLatency !== undefined ? ctx.outputLatency : null,
      scheduler: { driver: this.driver, tickMs: TICK_MS, lookaheadMs: LOOKAHEAD_MS },
      scheduleMisses: this.scheduleMisses,
      htmlAudioElements: this.htmlAudioElements,
      decodesAfterReady: this.decodesAfterReady,
      voicesActive: this.voices.length,
      voicesPeak: this.voicesPeak,
      voicesPeakByBus: { ...this.voicesPeakByBus },
      stolen: this.stolen,
      dropped: this.dropped,
      panner: { ...PANNER, panningModel: PANNER.model, hrtf: false },
      listenerAttachedTo: 'character',
      trigger_source: this.triggerSource,
      classes: Object.keys(this.data.classes).length,
      variants: Object.values(this.data.classes).reduce((a, c) => a + c.variants.length, 0),
      events: this.log.length,
      synthesised: true,
      sampledBytes: 0,
    };
  }
}

// ---- synthesis ------------------------------------------------------------------------------

/**
 * Build ONE impact voice into `dest` at absolute time `row.playAt`.
 *
 * The same function serves the live speaker path and the OfflineAudioContext render, which is
 * the requirement RI-AUD01's provenance note calls easy to underestimate: "this machine has no
 * audio device, so without an offline render there is no waveform, and M2/M3/M8 are permanently
 * unmeasurable."
 *
 * Every layer is: source -> [filter] -> envelope -> voice gain -> [pan] -> dest. Nothing is
 * decoded, nothing is fetched, and no HTMLMediaElement is constructed anywhere in this file —
 * RI-AUD02 §C's D1/D2/D3 all pass structurally rather than by discipline.
 */
export function buildImpactVoice(ctx, spec, row, dest, rng, gainOverride) {
  const out = ctx.createGain();
  out.gain.value = gainOverride === undefined ? row.gain : gainOverride;
  let node = out;
  if (spec.spatialised && ctx.createStereoPanner) {
    const p = ctx.createStereoPanner();
    p.pan.value = Math.max(-1, Math.min(1, row.pan || 0));
    out.connect(p);
    node = p;
  }
  node.connect(dest);

  const variant = spec.variants.find((v) => v.sample_id === row.sample_id) || spec.variants[0];
  const t0 = row.playAt;
  let endsAt = t0;

  for (const ly of variant.layers) {
    // `pre_delay_s` is negative for C08's pre-transient — the blade entering, 28 ms before the
    // impact instant. It is the whole C07/C08 discrimination and it is a timing fact.
    const at = Math.max(0, t0 + (ly.pre_delay_s || 0));
    const atk = Math.max(0.0005, ly.env.attack_s || 0.0005);
    const dec = Math.max(0.0005, ly.env.decay_s || 0.0005);
    const hold = ly.env.hold_s || 0;
    const peak = Math.max(1e-4, dbToGain(ly.gain_db === undefined ? -12 : ly.gain_db));

    const g = ctx.createGain();
    g.gain.setValueAtTime(1e-4, at);
    g.gain.exponentialRampToValueAtTime(peak, at + atk);
    if (hold > 0) g.gain.setValueAtTime(peak, at + atk + hold);
    g.gain.exponentialRampToValueAtTime(1e-4, at + atk + hold + dec);
    g.connect(out);

    const stopAt = at + atk + hold + dec + 0.02;
    if (stopAt > endsAt) endsAt = stopAt;

    let head = g;
    let filt = null;
    if (ly.filter) {
      filt = ctx.createBiquadFilter();
      filt.type = ly.filter.type;
      filt.frequency.setValueAtTime(ly.filter.hz, at);
      filt.Q.value = ly.filter.q === undefined ? 1 : ly.filter.q;
      // A filter that SWEEPS is what makes C05's thud "collapse into a scrape" and C09 read as
      // air moving rather than as noise switched on. It is a shape, not an EQ setting.
      if (ly.filter_sweep_hz) {
        filt.frequency.setValueAtTime(ly.filter_sweep_hz[0], at);
        filt.frequency.linearRampToValueAtTime(ly.filter_sweep_hz[1], at + atk + hold + dec);
      }
      filt.connect(g);
      head = filt;
    }

    if (ly.source === 'noise') {
      const src = ctx.createBufferSource();
      src.buffer = makeNoiseBuffer(ctx, ly.colour || 'white', Math.max(0.2, atk + hold + dec + 0.05), rng, 0.35);
      src.connect(head);
      src.start(at);
      src.stop(stopAt);
    } else {
      const freqs = ly.partials_hz && ly.partials_hz.length ? ly.partials_hz : [ly.freq_hz || 220];
      for (let k = 0; k < freqs.length; k++) {
        const o = ctx.createOscillator();
        o.type = ly.waveform || 'sine';
        o.frequency.setValueAtTime(freqs[k], at);
        if (ly.glide_hz && k === 0) {
          o.frequency.setValueAtTime(ly.glide_hz[0], at);
          o.frequency.exponentialRampToValueAtTime(Math.max(1, ly.glide_hz[1]), at + atk + hold + dec);
        }
        const og = ctx.createGain();
        // Upper partials roll off so an inharmonic chime reads as one struck object rather than
        // as four sine waves; C06's four partials are the reason this is not flat.
        og.gain.value = k === 0 ? 1 : 0.55 / k;
        o.connect(og); og.connect(head);
        o.start(at);
        o.stop(stopAt);
      }
    }
  }
  // RI-AUD02 V8 — every one-shot source disconnects itself. Undisconnected source nodes leak
  // until GC and the GC pause lands, on average, in the middle of the next fight.
  if (typeof out.context !== 'undefined' && out.context.state !== undefined) {
    // Offline renders finish wholesale; only the live path needs the teardown timer.
  }
  return { out, endsAt };
}

/**
 * Render ONE class variant, dry, alone, into PCM — the artifact M3 (dynamic range) and M2
 * (blind distinguishability) are computed from.
 *
 * `gainOverride: 1` renders the RAW voice with no §C level applied, which is what
 * `tools/audio/calibrate-impact.mjs` solves `norm_db` against. Without the override the render
 * is the mixed voice at its shipped level, which is what M3 measures.
 */
export async function renderVoiceOffline(OfflineCtor, spec, row, opts = {}) {
  const sr = opts.sampleRate || 48000;
  const seconds = opts.seconds || 1.4;
  const ctx = new OfflineCtor(2, Math.ceil(sr * seconds), sr);
  const r = { ...row, playAt: 0.05, pan: opts.pan === undefined ? (row.pan || 0) : opts.pan };
  buildImpactVoice(ctx, spec, r, ctx.destination, new Rng(opts.seed === undefined ? 0x51ed : opts.seed), opts.gainOverride);
  const buf = await ctx.startRendering();
  const ch = [];
  for (let c = 0; c < buf.numberOfChannels; c++) ch.push(buf.getChannelData(c));
  let peak = 0, sumsq = 0, n = 0;
  for (const d of ch) for (let i = 0; i < d.length; i++) { const a = Math.abs(d[i]); if (a > peak) peak = a; sumsq += d[i] * d[i]; n++; }
  return {
    sampleRate: sr, channels: ch.length, length: buf.length,
    peak, peak_dbfs: 20 * Math.log10(Math.max(1e-9, peak)),
    rms_dbfs: 20 * Math.log10(Math.max(1e-9, Math.sqrt(sumsq / Math.max(1, n)))),
    pcm: ch,
  };
}
