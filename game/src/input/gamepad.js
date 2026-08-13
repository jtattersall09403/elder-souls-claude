// The gamepad translation layer — RI-JRN04 §C/§D/§E.
//
// This is the subject of RI-JRN04. Everything between a `Gamepad` object and an action name
// lives here, and nowhere else, so that a shim injecting at the `navigator.getGamepads()` seam
// (A-JRN2, tools/journey/gamepad-shim.mjs) drives the identical code a physical GameSir X2s
// drives. RI-JRN04 "How we lose" #15 is explicit that a test which reaches `queueInputs()`
// exercises the action layer and never the translation layer, which is the item's whole subject.
//
// What is here and which rule requires it:
//
//   §C   two complete profiles, `souls-default` and `souls-handheld`, read from
//        game/data/input/profiles.json — never hard-coded, so a perturbation of the data file
//        changes which button swings (RI-MTH07 CONSUMPTION).
//   G0   `.value` is read for the analog indices; `.pressed` is never read on a trigger.
//   G1   every action of the closed set is bound in BOTH profiles, asserted at construction.
//   G2   `mapping !== 'standard'` consults game/data/input/pad-quirks.json for an index
//        permutation; an unknown id gets the generic HID fallback AND the calibration sequence,
//        and the game never refuses to run.
//   §D   radial deadzone with rescale, walk/run by magnitude, trigger hysteresis and the
//        T_full charge gate, rest auto-zero, drift guard, per-rAF snapshot polling.
//   §E   L1 (invisible until first press), L2 connect, L3/L4 disconnect releases every held
//        action on the same frame, L5 reconnect restores, L6 most-recently-active wins,
//        L7 active-device glyph, L8 hidden, L9 no "connect a controller" screen.
//
// Frame clock: the hold discriminators are counted in FIXED SIM FRAMES (f@60), read from the
// sim, not in rAF ticks. A pad sampled twice in one sim frame must not promote a tap to a hold
// twice as fast.
'use strict';

import { shouldPromote, promotedAtRelease, framesHeld, framesHeldWhileDown, STEP_MS } from './hold-gate.js';

/** RI-JRN04 §B — the W3C Standard Gamepad. Recalled, and the axis sign convention matters. */
export const STANDARD = {
  buttons: 17,
  axes: 4,
  analog_indices: [6, 7],
  guide_index: 16,
  dpad: { up: 12, down: 13, left: 14, right: 15 },
  axis: { move_x: 0, move_y: 1, look_x: 2, look_y: 3 },
  y_is_down: true,
};

/** RI-JRN04 §A: `vendor: 3537 product: 1004` and the trimmed id are both matchable keys. */
export function normaliseId(id) {
  const s = String(id || '').toLowerCase();
  const vid = /vendor:\s*([0-9a-f]{2,4})/.exec(s);
  const pid = /product:\s*([0-9a-f]{2,4})/.exec(s);
  const vidpid = vid && pid ? `${vid[1]}:${pid[1]}` : null;
  const trimmed = s.replace(/\(.*?\)/g, ' ').replace(/standard gamepad/g, ' ').replace(/\s+/g, ' ').trim();
  return { vidpid, trimmed, raw: s };
}

/**
 * A snapshot of one pad, normalised onto the §B layout.
 * `values` is length 17 of numbers in [0,1]; `axes` is length 4; `pressed` is NEVER carried
 * through for an analog index (G0) — the caller applies its own thresholds.
 */
function makeSnapshot() {
  return { values: new Array(17).fill(0), raw_pressed: new Array(17).fill(false), axes: [0, 0, 0, 0], id: null, index: -1, mapping: '', quirk: null, ts: 0 };
}

export class GamepadRouter {
  /**
   * @param {InputPipeline} pipe
   * @param {object} profiles game/data/input/profiles.json
   * @param {object} quirks   game/data/input/pad-quirks.json
   */
  constructor(pipe, profiles, quirks) {
    if (!profiles || !profiles.pad_profiles) throw new Error('GamepadRouter: game/data/input/profiles.json is required and was not supplied. The button map is DATA (RI-MTH07); there is no hard-coded fallback to silently run on.');
    if (!quirks || !Array.isArray(quirks.entries)) throw new Error('GamepadRouter: game/data/input/pad-quirks.json is required (RI-JRN04 G2).');
    this.pipe = pipe;
    this.profiles = profiles;
    this.quirks = quirks;
    this.analog = profiles.analog;
    this.profileName = profiles.default_pad_profile || 'souls-default';
    this.profile = profiles.pad_profiles[this.profileName];

    // Per-pad live state, keyed by pad index.
    this.pads = new Map();
    this.activeIndex = null;
    this.lastActivityFrame = -1;
    this.connected = false;
    this.lastId = null;
    this.lastMapping = null;
    this.quirkUsed = null;
    this.pollCount = 0;
    this.calibration = null;      // set when an unknown non-standard pad appears
    this.calibrationResult = null;
    this.sessionProfiles = new Map();  // L5: id -> {profileName, calibration}
    this.chargeIntent = 0;
    this.invertPitch = this.analog.right_stick.invert_pitch_default === true;
    this.uiMode = false;          // a cursor-driven surface is open; the D-pad walks the list
    this.log = [];                // A-JRN7 side-channel; NOT the consumer of anything
    this.onConnect = null;
    this.onDisconnect = null;
    this.onDeviceActive = null;
    this._snapshot = makeSnapshot();
    this._assertProfilesComplete();
  }

  /** G1, asserted at construction rather than discovered by a player in a boss room. */
  _assertProfilesComplete() {
    const set = this.profiles.action_set;
    const missing = [];
    for (const [name, prof] of Object.entries(this.profiles.pad_profiles)) {
      const bound = new Set(Object.keys(prof.buttons || {}));
      for (const g of Object.values(prof.hold_gate || {})) { bound.add(g.tap); bound.add(g.hold); }
      for (const a of Object.keys(prof.secondary || {})) bound.add(a);
      for (const a of set) if (!bound.has(a)) missing.push(`${name}: ${a}`);
      for (const i of prof.unbound_always || []) {
        if (Object.values(prof.buttons || {}).includes(i)) missing.push(`${name}: index ${i} must never be bound (RI-JRN04 §C)`);
      }
    }
    if (missing.length) {
      throw new Error(`RI-JRN04 G1: a pad profile leaves an action of the closed set unreachable — ${missing.join('; ')}. A profile with an unbound action is a hard fail because part of the game is unreachable on that device.`);
    }
  }

  setProfile(name) {
    const p = this.profiles.pad_profiles[name];
    if (!p) throw new Error(`unknown pad profile '${name}'. Known: ${Object.keys(this.profiles.pad_profiles).join(', ')}`);
    this.profileName = name;
    this.profile = p;
    // A pad adopted before the switch carries its OWN `profileName`, which `_applyButtons`
    // reads. Without this line a profile change moved the router's default and left every
    // already-connected pad on the old map — so `souls-handheld` selected on a phone did
    // nothing at all for the pad already in the player's hands (L1: it is invisible until its
    // first press, so it is adopted mid-session by definition).
    for (const st of this.pads.values()) st.profileName = name;
    this._resetPadStates();
    return name;
  }

  /** H2/§C: the profile follows the DEVICE CLASS, which comes from media queries, not the pad list. */
  selectProfileForDeviceClass(deviceClass) {
    return this.setProfile(deviceClass === 'handheld' ? 'souls-handheld' : 'souls-default');
  }

  _resetPadStates() { for (const s of this.pads.values()) { s.gate = Object.create(null); s.trig = Object.create(null); s.down = Object.create(null); } }

  // ---- G2: mapping normalisation ---------------------------------------------------------

  /** @returns {object|null} the quirk entry for this pad, or null when the mapping is standard. */
  findQuirk(id, mapping) {
    if (mapping === 'standard') return null;
    const n = normaliseId(id);
    for (const e of this.quirks.entries) {
      if (e.mapping === 'standard') continue;
      if (e.key && n.vidpid && e.key.toLowerCase() === n.vidpid) return e;
      if (e.id_match && n.raw.includes(String(e.id_match).toLowerCase())) return e;
    }
    return { ...this.quirks.generic_hid_fallback, key: null, unknown: true };
  }

  /**
   * Normalise a raw `Gamepad` onto the §B layout. This is the function RI-JRN04's whole item
   * is about, and the one a `queueInputs()` test can never reach.
   */
  normalise(pad, out = this._snapshot) {
    out.values.fill(0);
    out.raw_pressed.fill(false);
    out.axes[0] = out.axes[1] = out.axes[2] = out.axes[3] = 0;
    out.id = pad.id || '';
    out.index = pad.index === undefined ? 0 : pad.index;
    out.mapping = pad.mapping === undefined ? '' : pad.mapping;
    out.ts = pad.timestamp || 0;
    const btns = pad.buttons || [];
    const axes = pad.axes || [];
    const readBtn = (i) => {
      const b = btns[i];
      if (b === undefined || b === null) return { v: 0, p: false };
      if (typeof b === 'number') return { v: b, p: b > 0.5 };
      return { v: typeof b.value === 'number' ? b.value : (b.pressed ? 1 : 0), p: !!b.pressed };
    };

    const quirk = this.findQuirk(out.id, out.mapping);
    out.quirk = quirk ? (quirk.key || (quirk.unknown ? 'generic-hid-fallback' : 'unnamed')) : null;

    if (!quirk) {
      for (let i = 0; i < 17; i++) { const r = readBtn(i); out.values[i] = r.v; out.raw_pressed[i] = r.p; }
      for (let i = 0; i < 4; i++) out.axes[i] = Number(axes[i] || 0);
      return out;
    }

    // Permuted: standard index <- raw index. Anything unnamed stays 0, which is what
    // M-P2 asks for on a descriptor with no index 16 (no exception, no `undefined` read).
    const perm = quirk.button_permutation || {};
    for (const [std, raw] of Object.entries(perm)) {
      const r = readBtn(Number(raw));
      out.values[Number(std)] = r.v;
      out.raw_pressed[Number(std)] = r.p;
    }
    // A generic HID pad reports the analog triggers on axes in [-1,1] as well as, or instead
    // of, on the button. Prefer whichever is further from rest: a digital trigger button reads
    // 0/1 and a resting analog axis reads -1.
    if (quirk.analog_trigger_axes) {
      for (const [std, ax] of Object.entries(quirk.analog_trigger_axes)) {
        const v = axes[Number(ax)];
        if (typeof v === 'number') {
          const scaled = (v + 1) / 2;             // [-1,1] -> [0,1]
          if (scaled > out.values[Number(std)]) out.values[Number(std)] = scaled;
        }
      }
    }
    // The D-pad arrives as a hat axis with 8 detents plus a rest value outside [-1,1].
    if (typeof quirk.dpad_from_hat_axis === 'number') {
      const h = axes[quirk.dpad_from_hat_axis];
      const d = hatToDpad(h);
      out.values[12] = d.up ? 1 : 0;
      out.values[13] = d.down ? 1 : 0;
      out.values[14] = d.left ? 1 : 0;
      out.values[15] = d.right ? 1 : 0;
    }
    const ap = quirk.axis_permutation || { 0: 0, 1: 1, 2: 2, 3: 3 };
    for (const [std, raw] of Object.entries(ap)) out.axes[Number(std)] = Number(axes[Number(raw)] || 0);
    return out;
  }

  // ---- the poll ---------------------------------------------------------------------------

  /**
   * @param {Array<Gamepad|null>} rawPads the array `navigator.getGamepads()` returned — a
   *        SNAPSHOT (§D). Never cached; a cached Gamepad silently freezes input in Chrome.
   * @param {number} frame the fixed sim frame about to be simulated
   * @param {number} nowMs S39's `inputNow()` — ms. `event.timeStamp` has no meaning for a pad
   *        (the Gamepad API is polled, not evented), so in mode `play` this is the rAF's own
   *        wall clock and in harness modes it is `frame * STEP_MS`. Every duration below whose
   *        two endpoints are both in the player's HANDS is measured with it; the rest stay f@60.
   * @returns {object|null} an observation for A-JRN6. NOT the consumer of anything.
   */
  poll(rawPads, frame, nowMs = frame * STEP_MS) {
    this.pollCount++;
    const live = [];
    for (const p of (rawPads || [])) if (p && p.connected !== false) live.push(p);

    // L3/L4/L6: a pad that has gone is released on THIS frame, not at the next event loop.
    for (const idx of Array.from(this.pads.keys())) {
      if (!live.some((p) => (p.index === undefined ? 0 : p.index) === idx)) this._dropPad(idx, frame);
    }
    if (!live.length) {
      if (this.connected) { this.connected = false; this.activeIndex = null; }
      return null;
    }

    // L6: the most recently ACTIVE pad drives the game. Activity is any button above rest or
    // any stick outside the deadzone; a pad that is merely plugged in does not steal control,
    // and switching device must not drop a held input on the one being left.
    let chosen = null;
    for (const p of live) {
      const snap = this.normalise(p, makeSnapshot());
      const idx = snap.index;
      let st = this.pads.get(idx);
      // A DIFFERENT pad at the same index is a different pad. Without this the quirk map, the
      // profile and any calibration of the pad that was unplugged are silently applied to the
      // one plugged in after it — and on a phone, where the pad is invisible until its first
      // press, index 0 is the only index there ever is.
      if (st && (st.id !== snap.id || st.mapping !== snap.mapping)) { this._dropPad(idx, frame); st = null; }
      if (!st) { st = this._adoptPad(snap, frame); }
      st.snap = snap;
      // L6/L7. `lastActive` picks WHICH pad drives the game when two are attached. It is also
      // the only evidence anywhere that a pad is the device in the player's hands right now, and
      // round 1 threw that half away: `onDeviceActive` fired only when the chosen INDEX changed,
      // so a player who put the phone down, tapped the glass and then picked the pad back up
      // kept a fingertip glyph on every door prompt until the pad was physically unplugged and
      // replugged. L7's rule is "the ACTIVE device", not "the most recently connected one", and
      // M-P14 caught it the first time it ran: driving a pad button reported `activeDevice:
      // 'touch'`.
      if (this._isActive(snap, st)) {
        st.lastActive = frame;
        this.onDeviceActive && this.onDeviceActive('gamepad');
      }
    }
    for (const [idx, st] of this.pads) {
      // `!chosen` is TRUE for index 0 — the classic falsy-zero bug, and here it meant that with
      // two pads attached the FIRST one could never stay active: index 0 was chosen, then
      // immediately displaced by index 1, and `_releasePad` dropped whatever index 0 was
      // holding. One player, one pad in each hand, and the one they were using went dead.
      if (chosen === null || (st.lastActive > this.pads.get(chosen).lastActive)) chosen = idx;
    }
    if (chosen !== this.activeIndex) {
      if (this.activeIndex !== null && this.pads.has(this.activeIndex)) this._releasePad(this.pads.get(this.activeIndex));
      this.activeIndex = chosen;
      this.onDeviceActive && this.onDeviceActive('gamepad');
    }
    const st = this.pads.get(this.activeIndex);
    if (!st) return null;
    this.connected = true;
    this.lastId = st.snap.id;
    this.lastMapping = st.snap.mapping;
    this.quirkUsed = st.snap.quirk;

    if (this.calibration && !this.calibration.done) { this._calibrationPoll(st, frame); return this._observe(st); }

    this._applyRest(st, frame, nowMs);
    this._applyButtons(st, frame, nowMs);
    this._applySticks(st, frame);
    return this._observe(st);
  }

  _isActive(snap, st) {
    for (let i = 0; i < 17; i++) if (snap.values[i] > 0.5) return true;
    const m = Math.hypot(snap.axes[0], snap.axes[1]);
    const r = Math.hypot(snap.axes[2], snap.axes[3]);
    return m > this.analog.left_stick.inner_deadzone || r > this.analog.right_stick.inner_deadzone;
  }

  _adoptPad(snap, frame) {
    const st = {
      index: snap.index, id: snap.id, mapping: snap.mapping, quirk: snap.quirk,
      down: Object.create(null),     // standard index -> bool, for digital edges
      gate: Object.create(null),     // standard index -> {pressFrame, promoted}
      trig: Object.create(null),     // standard index -> {firing, charging}
      restBias: new Array(17).fill(0), restFrames: 0,
      restRange: STANDARD.analog_indices.map(() => ({ lo: Infinity, hi: -Infinity })),
      drift: null, lastActive: frame, snap, connectedFrame: frame,
      profileName: this.profileName,
    };
    this.pads.set(snap.index, st);
    // L5: a pad that has been seen before in this session keeps its profile and calibration.
    const remembered = this.sessionProfiles.get(normaliseId(snap.id).raw);
    if (remembered) {
      st.profileName = remembered.profileName;
      if (remembered.calibration) this.calibrationResult = remembered.calibration;
    } else if (snap.mapping !== 'standard' && snap.quirk === 'generic-hid-fallback') {
      // G2.3: unknown non-standard pad. The game RUNS on the fallback while the player
      // calibrates; it does not refuse and it does not show a raw index table.
      this._beginCalibration(snap);
    }
    this.onConnect && this.onConnect({ id: snap.id, index: snap.index, mapping: snap.mapping, quirk: snap.quirk });
    return st;
  }

  /** L3/L4 — the single most important rule in §E. */
  _dropPad(idx, frame) {
    const st = this.pads.get(idx);
    if (!st) return;
    this._releasePad(st);
    // An unfinished calibration belongs to the physical pad that started it. Keeping it after
    // a cable drop makes a replacement device answer the old pad's remaining prompts and eats
    // its first real button. Completed records live in `sessionProfiles` and remain untouched.
    if (this.calibration && !this.calibration.done &&
        this.calibration.index === idx && this.calibration.id === st.id) {
      this.calibration = null;
    }
    this.pads.delete(idx);
    if (this.activeIndex === idx) this.activeIndex = null;
    if (!this.pads.size) this.connected = false;
    this.onDisconnect && this.onDisconnect({ id: st.id, index: idx, frame });
  }

  /** Release every action this pad is holding, on this frame. Move goes to zero too. */
  _releasePad(st) {
    for (const [k, v] of Object.entries(st.down)) if (v) { this.pipe.edgeUp(v); st.down[k] = null; }
    for (const [k, t] of Object.entries(st.trig)) if (t && t.firing) { this.pipe.edgeUp(t.action); t.firing = false; t.charging = false; }
    for (const [k, g] of Object.entries(st.gate)) if (g && g.promoted) { this.pipe.edgeUp(g.holdAction); }
    st.gate = Object.create(null);
    this.chargeIntent = 0;
    this.pipe.setMove(0, 0);
    this.pipe.setUIMove(0, 0);
    this.pipe.chargeIntent = 0;
  }

  // ---- §D analog ---------------------------------------------------------------------------

  /** Hall triggers do not always rest at 0, and hair-trigger mode changes travel. */
  _applyRest(st, frame, nowMs = frame * STEP_MS) {
    // S39 FIGURES 13 AND 14. Both windows below are opened by the pad being PLUGGED IN and
    // closed by the pad still being there, so both endpoints are the player's, not the sim's:
    // category (b), stamped in ms, converted to f@60 once. They were worse than S39's own
    // arithmetic said, because neither counted sim frames — both counted POLLS, and a poll is
    // one rAF. At the 2.32 rAF Hz the round-1 critic's numbers imply, `drift_guard.frames = 600`
    // is 258 s of real time before the guard that exists to stop a drifting stick fires, not
    // S39's already-bad 51.7 s and not the 10.0 s the figure means. Written as `f@60` in the
    // data and converted here; the DATA IS UNCHANGED.
    const tol = this.analog.trigger.rest_tolerance;
    if (st.restFromMs === undefined) st.restFromMs = nowMs;
    const autozeroMs = this.analog.trigger.autozero_frames * STEP_MS;   // 30 f@60 = 500 ms
    if (nowMs - st.restFromMs < autozeroMs) {
      st.restFrames++;
      for (let k = 0; k < STANDARD.analog_indices.length; k++) {
        const i = STANDARD.analog_indices[k];
        const v = st.snap.values[i];
        const r = st.restRange[k];
        r.lo = Math.min(r.lo, v); r.hi = Math.max(r.hi, v);
      }
    } else if (!st.restFinalised) {
      // Auto-zero only a stable resting signal. A trigger being pulled during the first half
      // second spans a wide range and must not teach that pull as its neutral position.
      for (let k = 0; k < STANDARD.analog_indices.length; k++) {
        const i = STANDARD.analog_indices[k], r = st.restRange[k];
        if (Number.isFinite(r.lo) && r.hi - r.lo <= tol && r.hi > tol && r.hi < this.analog.trigger.t_fire) {
          st.restBias[i] = (r.lo + r.hi) / 2;
        }
      }
      st.restFinalised = true;
    }
    // Drift guard: a stick that never leaves a 0.03 band but sits above the deadzone
    // enumerated mid-motion. Re-centre and log; do not walk the player into a wall for it.
    const ax = st.snap.axes;
    if (!st.drift) st.drift = { lo: ax.slice(), hi: ax.slice(), n: 0, bias: [0, 0, 0, 0] };
    const d = st.drift;
    if (d.fromMs === undefined) d.fromMs = nowMs;
    for (let i = 0; i < 4; i++) { if (ax[i] < d.lo[i]) d.lo[i] = ax[i]; if (ax[i] > d.hi[i]) d.hi[i] = ax[i]; }
    d.n++;
    const driftWindowMs = this.analog.drift_guard.frames * STEP_MS;     // 600 f@60 = 10,000 ms
    if (nowMs - d.fromMs >= driftWindowMs) {
      for (let i = 0; i < 4; i++) {
        const w = d.hi[i] - d.lo[i];
        const centre = (d.hi[i] + d.lo[i]) / 2;
        if (w <= this.analog.drift_guard.band_width && Math.abs(centre) > this.analog.left_stick.inner_deadzone) {
          d.bias[i] = centre;
          this.log.push({ frame, what: 'stick_drift_recentred', axis: i, bias: centre });
        }
      }
      d.n = 0; d.fromMs = nowMs; d.lo = ax.slice(); d.hi = ax.slice();
    }
  }

  _triggerValue(st, i) { return Math.max(0, st.snap.values[i] - st.restBias[i]); }

  _applyButtons(st, frame, nowMs) {
    const prof = this.profiles.pad_profiles[st.profileName] || this.profile;
    const gates = prof.hold_gate || {};
    const analogB = prof.analog_buttons || {};
    // A CALIBRATION BELONGS TO THE PAD IT WAS LEARNED ON, AND ONLY TO THAT PAD.
    // `_adoptPad` already refuses to hand a new pad the old one's profile and quirk map — "A
    // DIFFERENT pad at the same index is a different pad" — but `calibrationResult` is instance
    // state, set when a calibration completes and only ever REPLACED when a remembered id comes
    // back. So the permutation a player taught an unrecognised pad went on being applied after
    // that pad was unplugged and a standard-mapping one was plugged in: on the new pad, A opened
    // nothing and rolled instead. Found by M-K18/M-P23, which sat red for a whole round while the
    // rebinding surface they blamed was working — the check pressed `interact` and the pad fired
    // `roll`, and nothing in either check's output could say so until it was made to prove the
    // mapping before measuring.
    const perm = this.calibrationResult && this.calibrationResult.id === st.id ? this.calibrationResult.map : null;

    const actionFor = (idx) => {
      if (perm && perm[idx]) return perm[idx];
      for (const [a, i] of Object.entries(prof.buttons)) if (i === idx) return a;
      for (const [a, i] of Object.entries(prof.secondary || {})) if (i === idx) return a;
      return null;
    };

    for (let i = 0; i < 17; i++) {
      if ((prof.unbound_always || []).includes(i)) continue;     // M-P2: index 16, always
      const gate = gates[String(i)];
      const analogAction = analogB[String(i)];

      if (analogAction) {
        // G0 — `.value` and our own thresholds, with hysteresis. `.pressed` is never read.
        const t = st.trig[i] || (st.trig[i] = { firing: false, charging: false, action: analogAction });
        t.action = analogAction;
        const v = this._triggerValue(st, i);
        if (!t.firing && v >= this.analog.trigger.t_fire) { t.firing = true; this.pipe.edgeDown(analogAction); }
        else if (t.firing && v <= this.analog.trigger.t_release) { t.firing = false; t.charging = false; this.pipe.edgeUp(analogAction); }
        if (i === prof.charge_button) {
          // M-P4: the charge gate. Held past T_full is a charged heavy; held at 0.5 is not.
          t.charging = t.firing && v >= this.analog.trigger.t_full;
          this.chargeIntent = t.charging ? 1 : 0;
          this.pipe.chargeIntent = this.chargeIntent;
        }
        continue;
      }

      const downNow = st.snap.values[i] > 0.5;

      if (gate) {
        // §C's tap/hold discriminator. Released within `frames` of the press => the TAP action
        // is emitted ON RELEASE; still held at `frames` => the HOLD action is held from that
        // frame until release. Never both, never neither (M-P5).
        const g = st.gate[i] || (st.gate[i] = { pressFrame: -1, tDown: -1, promoted: false, holdAction: gate.hold });
        g.holdAction = gate.hold;
        // §C: "released within 12 frames of press => roll; still held at frame 12 => sprint".
        // The quantity is FRAMES HELD, which is `frame - pressFrame + 1` — the press frame
        // counts. M-P5 releases at 4, 8, 11, 12, 13, 20, 60 and requires roll at 11 and sprint
        // at 12; measured against the raw delta this was off by one and 12 came out as a roll.
        //
        // The arithmetic now lives in `./hold-gate.js` and NOT here, because `input/touch.js`
        // had its own copy of this same line and T5 promises the touchscreen uses "the SAME
        // 12-frame discriminator" — a promise two copies cannot keep (RULES 10). The state
        // machine below is still the pad's own; only the RULE is shared.
        if (downNow && g.pressFrame < 0) { g.pressFrame = frame; g.tDown = nowMs; g.promoted = false; }
        else if (downNow && !g.promoted && shouldPromote(g.tDown, nowMs, gate)) {
          g.promoted = true;
          g.framesHeld = framesHeldWhileDown(g.tDown, nowMs);   // f@60, still down
          this.pipe.edgeDown(gate.hold);
        } else if (!downNow && g.pressFrame >= 0) {
          // S39: the release re-asks in ms. A pad is POLLED, so at 2.32 rAF Hz the whole press
          // can happen between two polls and `g.promoted` never gets a chance to be set — the
          // same inversion the touchscreen had, by a different route.
          g.framesHeld = framesHeld(g.tDown, nowMs);            // f@60, at the release
          if (g.promoted || promotedAtRelease(g.tDown, nowMs, gate)) {
            if (!g.promoted) this.pipe.edgeDown(gate.hold);
            this.pipe.edgeUp(gate.hold);
          } else { this.pipe.edgeDown(gate.tap); this.pipe.edgeUp(gate.tap); }
          g.pressFrame = -1; g.tDown = -1; g.promoted = false;
        }
        continue;
      }

      const action = actionFor(i);
      if (!action) continue;
      const was = !!st.down[i];
      if (downNow && !was) { st.down[i] = action; this.pipe.edgeDown(action); }
      else if (!downNow && was) { const a = st.down[i]; st.down[i] = null; this.pipe.edgeUp(a); }
    }
  }

  _applySticks(st, frame) {
    const prof = this.profiles.pad_profiles[st.profileName] || this.profile;
    const bias = (st.drift && st.drift.bias) || [0, 0, 0, 0];
    const ls = this.analog.left_stick;
    let x = (st.snap.axes[prof.axes.move_x] || 0) - bias[prof.axes.move_x];
    let y = -((st.snap.axes[prof.axes.move_y] || 0) - bias[prof.axes.move_y]);   // §C: [x, -y]

    // §D — RADIAL deadzone on the vector magnitude, never per axis, then a linear rescale so
    // there is no dead step at the deadzone edge. M-P6's 36-bearing sweep exists for this.
    const shaped = shapeMoveStick(x, y, ls.inner_deadzone, ls.outer_saturation);
    x = shaped[0]; y = shaped[1];

    // The D-pad drives `move` while a cursor-driven surface is open, so every list in the game
    // is walkable with a thumb — and ONLY then, because RI-JRN04 §C gives 14/15 to
    // `swap_left`/`swap_right` and 12/13 to declared reserved functions during play. A surface
    // has no left-hand equipment to cycle, so nothing is shadowed. It is read from the
    // NORMALISED indices, so a hat-axis HID pad walks the same lists a standard pad does.
    if (this.uiMode) {
      if (st.snap.values[14] > 0.5) x = -1; else if (st.snap.values[15] > 0.5) x = 1;
      if (st.snap.values[13] > 0.5) y = -1; else if (st.snap.values[12] > 0.5) y = 1;
    }
    const m = Math.hypot(x, y);
    this.pipe.setMove(m > 1 ? x / m : x, m > 1 ? y / m : y);
    // Preserve the D-pad's UI direction on its own production channel. `consumeUI()` clears
    // locomotion deliberately, and an in-combat menu must still leave swap actions live; using
    // the shared movement pair for all three meanings made the focus edge disappear.
    this.pipe.setUIMove(this.uiMode ? (st.snap.values[14] > 0.5 ? -1 : st.snap.values[15] > 0.5 ? 1 : 0) : 0,
      this.uiMode ? (st.snap.values[13] > 0.5 ? -1 : st.snap.values[12] > 0.5 ? 1 : 0) : 0);

    const rs = this.analog.right_stick;
    const lx = (st.snap.axes[prof.axes.look_x] || 0) - bias[prof.axes.look_x];
    const ly = (st.snap.axes[prof.axes.look_y] || 0) - bias[prof.axes.look_y];
    const d = shapeRightStick(lx, ly, rs);
    if (d[0] || d[1]) {
      // The camera contract matches a direct touch drag: right turns right and up looks up.
      // Gamepad axes use +y down, hence the default (non-inverted) path reverses both of the
      // old signs. `invertPitch` remains available as an accessibility preference.
      this.pipe.addLook(-d[0], this.invertPitch ? -d[1] : d[1]);
    }
  }

  // ---- G2.3 the diegetic calibration sequence ----------------------------------------------

  _beginCalibration(snap) {
    const cal = this.quirks.calibration;
    this.calibration = {
      id: snap.id, index: snap.index,
      i: 0, prompts: cal.prompts, map: Object.create(null),
      inputs: 0, budget: cal.input_budget, done: false, seen: Object.create(null),
    };
  }

  /** Pad-only, six prompts, <= 8 inputs, no raw index table, never a refusal (M-P15). */
  _calibrationPoll(st, frame) {
    const c = this.calibration;
    for (let i = 0; i < 17; i++) {
      const down = st.snap.values[i] > 0.5;
      const was = !!c.seen[i];
      c.seen[i] = down;
      if (down && !was) {
        c.inputs++;
        if (i === 16) continue;                            // never bindable (§C)
        if (c.map[i] !== undefined) continue;               // already claimed
        c.map[i] = c.prompts[c.i].action;                   // standard index -> action name
        c.i++;
        if (c.i >= c.prompts.length) {
          c.done = true;
          this.calibrationResult = { map: c.map, inputs: c.inputs, id: st.id };
          this.sessionProfiles.set(normaliseId(st.id).raw, { profileName: st.profileName, calibration: this.calibrationResult });
          this.calibration = null;
        }
        return;
      }
    }
  }

  /** The surface the renderer draws. Returns null when no calibration is in progress. */
  calibrationPrompt() {
    if (!this.calibration || this.calibration.done) return null;
    return { line: this.calibration.prompts[this.calibration.i].line, step: this.calibration.i + 1, of: this.calibration.prompts.length };
  }

  _observe(st) {
    return {
      id: st.snap.id, index: st.snap.index, mapping: st.snap.mapping, quirk: st.snap.quirk,
      profile: st.profileName, values: st.snap.values.slice(), axes: st.snap.axes.slice(),
      chargeIntent: this.chargeIntent, calibrating: !!this.calibration,
    };
  }
}

// ---- pure shaping, exported so a probe can check the maths without a browser ----------------

/** RI-JRN04 §D / RI-CAM02 §C — radial, rescaled, direction never reshaped. */
const _mv = [0, 0];
export function shapeMoveStick(x, y, inner, outer) {
  const m = Math.hypot(x, y);
  if (m <= inner + Number.EPSILON * 4) { _mv[0] = 0; _mv[1] = 0; return _mv; }
  let mm = (Math.min(m, outer) - inner) / (outer - inner);
  if (mm > 1) mm = 1;
  _mv[0] = (x / m) * mm;
  _mv[1] = (y / m) * mm;
  return _mv;
}

/** RI-CAM02 §A / RI-JRN04 §D — degrees for THIS fixed step. Never per rendered frame. */
const _rs = [0, 0];
export function shapeRightStick(x, y, rs) {
  const m = Math.hypot(x, y);
  if (m <= rs.inner_deadzone) { _rs[0] = 0; _rs[1] = 0; return _rs; }
  let mm = (Math.min(m, rs.outer_saturation) - rs.inner_deadzone) / (rs.outer_saturation - rs.inner_deadzone);
  if (mm > 1) mm = 1;
  mm = Math.pow(mm, rs.curve_exponent);
  _rs[0] = (x / m) * mm * rs.deg_per_frame_yaw_at_full;
  _rs[1] = (y / m) * mm * rs.deg_per_frame_pitch_at_full;
  return _rs;
}

/** §D: walk below 0.55 of the rescaled magnitude, run above. */
export function gait(magnitude, threshold) { return magnitude <= 0 ? 'idle' : magnitude < threshold ? 'walk' : 'run'; }

/** A hat axis: 8 detents from -1, plus a rest value at or beyond +1 (or NaN on some drivers). */
export function hatToDpad(h) {
  const out = { up: false, down: false, left: false, right: false };
  if (typeof h !== 'number' || !isFinite(h) || h > 1.01) return out;
  const step = Math.round((h + 1) * 3.5);       // -1 -> 0 (up) … +1 -> 7 (up-left)
  if (step === 0 || step === 1 || step === 7) out.up = true;
  if (step === 3 || step === 4 || step === 5) out.down = true;
  if (step === 1 || step === 2 || step === 3) out.right = true;
  if (step === 5 || step === 6 || step === 7) out.left = true;
  return out;
}
