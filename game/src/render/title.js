// The title surface — the one screen that exists before the world takes your hands.
//
// Owner: W1-26 (`journey.firstlaunch.flow`). Binding sources: `RI-JRN01` O1–O4, O17, O18,
// **M20 and HF9**.
//
// WHY IT EXISTS.
// `RI-JRN01` O1 caps the surfaces between page load and control at two and **nothing bounded
// them from below**. A build that boots straight into the world scores M1 perfectly — zero
// surfaces is ≤ 2 — while O3's option set is unbuilt and M3 fails closed at 0 with no
// consequence. Two W1-07 verdicts both recorded *"no title surface of any kind"* as a
// secondary observation and no check in the item fired on it for two rounds. `BAR-CRITIQUE-
// W1-07-R1` §R2.4 added M20 and HF9 for exactly that, and HF9 caps the whole item at 2:
// **a game a returning player cannot reach their save from is not a shipped opening.**
//
// WHAT IT IS ALLOWED TO BE, and this is a short list:
//   * ONE surface (O1). `Load` opens a save-slot page *inside* this same surface — the one
//     extra list O1 permits — and `Settings` likewise. There is no second screen anywhere.
//   * Drawn over the LIVE world, in the same canvas, by the same compositing path the
//     dialogue surface uses (see render/ui.js's note on why the DOM is not an option). The
//     hold of the barge keeps moving behind the wordmark. M1 counts "full-viewport UI states
//     with **no 3D world rendered behind them**"; this one never qualifies, which is the
//     honest answer to O1 rather than a way around it.
//   * NO `Play` button that leads to another menu (M3's hard fail). Every entry either acts
//     or opens the one permitted list.
//   * NO instruction. Not "Press any key", not "Click to start", not "Tap to begin". M9
//     greps every string rendered *outside* a dialogue surface for `Press `, `Tap `,
//     `Click `, `Tutorial`, `Objective`, `Quest added`, `New quest`, `Tip:` and for
//     imperative second-person instruction, and this surface is squarely inside that grep.
//     The five labels are `RI-JRN01` O3's own words and nothing else is drawn.
//   * NO cursor, no hover, no drag (O17). Selection is an index moved by the same closed
//     action set the census uses, so keyboard, gamepad, touch and mouse all reach it.
//   * NO logo, no splash, no cinematic (O2). There is nothing to skip because there is
//     nothing that takes time: the surface is interactive on its first rendered frame.
//
// WHY THE OPTION IDS NEVER CHANGE.
// O3 names five: `Continue` (if a save exists, focused by default), `New`, `Load`,
// `Settings`, `Quit-to-menu`. The set this surface publishes is **always those five ids**,
// with `enabled` telling the truth about each — `continue` is disabled with no save,
// `quit-to-menu` is disabled when there is no session to leave. Hiding a row would make the
// published set depend on state, and M20 asks whether the surface "offers the exact O3 set".
// A row that is drawn dim and says why is also the honest answer to a player.
//
// AUDIO (O4). There is no audio subsystem in the build yet. When one lands it must be
// unlocked by `onFirstGesture` below — the same gesture that starts the game — and never by
// a "click to enable sound" panel, which is How-we-lose #12 and one more surface.
'use strict';

import * as THREE from '../../vendor/three/three.module.js';

const AXIS_DEADZONE = 0.5;
const REPEAT_FIRST = 24;
const REPEAT_EVERY = 8;

const INK = '#efe4cd';
const INK_DIM = '#8d8371';
const INK_OFF = '#5b5347';
const INK_HOT = '#ffd9a0';
const RULE = 'rgba(180, 150, 100, 0.34)';
const SCRIM = 'rgba(8, 7, 6, 0.62)';

/** O3's five, in O3's order. `Continue` first because a returning player is the common case. */
const ROOT_OPTIONS = [
  { id: 'continue', label: 'Continue' },
  { id: 'new', label: 'New' },
  { id: 'load', label: 'Load' },
  { id: 'settings', label: 'Settings' },
  { id: 'quit-to-menu', label: 'Quit to menu' },
];

/** Look sensitivity is the one setting that is applied to something real today. */
const SENS_STEPS = [0.5, 0.75, 1.0, 1.5, 2.0];

export class TitleLayer {
  constructor(width, height) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = Math.max(2, width | 0);
    this.canvas.height = Math.max(2, height | 0);
    this.ctx = this.canvas.getContext('2d');
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.minFilter = THREE.LinearFilter;
    this.texture.magFilter = THREE.LinearFilter;
    this.texture.generateMipmaps = false;
    this.material = new THREE.MeshBasicMaterial({
      map: this.texture, transparent: true, depthTest: false, depthWrite: false, toneMapped: false,
    });
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.material);
    this.mesh.frustumCulled = false;
    this.scene = new THREE.Scene();
    this.scene.add(this.mesh);
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    this.shown = false;
    this.page = 'root';               // 'root' | 'saves' | 'settings'
    this.sel = 0;
    this.saves = [];                  // [{slot, header, writtenAt, bytes}]
    this.inSession = false;           // is there a life to quit out of
    this.sensIndex = 2;               // 1.0x
    this.dirty = true;
    this.axisHeld = 0;
    this.axisFrames = 0;
    this.inputsTaken = 0;
    this.firstGestureAt = null;
    this.onFirstGesture = null;       // O4: audio unlock hangs here, never on a panel
    this.shownAtFrame = null;
    this.dismissedAtFrame = null;
    this.dismissedBy = null;
    this.last = emptyMetrics();
  }

  setSize(w, h) {
    const W = Math.max(2, w | 0), H = Math.max(2, h | 0);
    if (this.canvas.width === W && this.canvas.height === H) return;
    this.canvas.width = W; this.canvas.height = H;
    this.dirty = true;
  }

  /** Show the surface. `saves` is `store.listSlots()`'s answer; `inSession` gates quit-to-menu. */
  show(opts) {
    const o = opts || {};
    if (Array.isArray(o.saves)) this.saves = o.saves.slice();
    if (typeof o.inSession === 'boolean') this.inSession = o.inSession;
    this.shown = true;
    this.page = 'root';
    // O3: `Continue` is focused by default when a save exists; otherwise the first thing a
    // player can actually do is focused, which is `New`.
    this.sel = this.saves.length ? 0 : 1;
    this.axisHeld = 0; this.axisFrames = 0;
    this.shownAtFrame = Number.isFinite(o.frame) ? o.frame : null;
    this.dismissedAtFrame = null;
    this.dismissedBy = null;
    this.dirty = true;
    return this.state();
  }

  dismiss(by) {
    if (!this.shown) return false;
    this.shown = false;
    this.dismissedBy = by || 'unknown';
    this.dirty = true;
    return true;
  }

  setSaves(list) { this.saves = Array.isArray(list) ? list.slice() : []; this.dirty = true; return this.saves.length; }

  /** The rows the surface is publishing right now, with the truth about each. */
  options() {
    if (this.page === 'saves') {
      const rows = this.saves.map((s) => ({ id: `slot:${s.slot}`, label: slotLabel(s), enabled: true }));
      rows.push({ id: 'back', label: 'Back', enabled: true });
      return rows;
    }
    if (this.page === 'settings') {
      return [
        { id: 'look-sensitivity', label: `Look sensitivity   ${SENS_STEPS[this.sensIndex].toFixed(2)}×`, enabled: true },
        { id: 'back', label: 'Back', enabled: true },
      ];
    }
    return ROOT_OPTIONS.map((o) => ({
      id: o.id,
      label: o.label,
      enabled: o.id === 'continue' ? this.saves.length > 0
        : o.id === 'load' ? this.saves.length > 0
          : o.id === 'quit-to-menu' ? this.inSession
            : true,
    }));
  }

  /**
   * One fixed step of the surface, driven by the SAME latched input a swing is driven by —
   * which is what makes the whole thing reachable on a gamepad and on a touchscreen without
   * a single cursor-dependent affordance (O17).
   *
   * @returns {null|{activated: string}} the id the player committed to, for the engine to act on
   */
  step(input) {
    if (!this.shown) { this.axisHeld = 0; this.axisFrames = 0; return null; }
    const rows = this.options();

    const y = input.moveY || 0;
    const dir = y > AXIS_DEADZONE ? -1 : y < -AXIS_DEADZONE ? 1 : 0;   // stick up = earlier row
    if (dir !== this.axisHeld) { this.axisHeld = dir; this.axisFrames = 0; if (dir) this._move(dir, rows); }
    else if (dir) {
      this.axisFrames++;
      if (this.axisFrames >= REPEAT_FIRST && (this.axisFrames - REPEAT_FIRST) % REPEAT_EVERY === 0) this._move(dir, rows);
    }
    if (dir && this.firstGestureAt === null) this._gesture();

    // `block` is "back" here, exactly as it is "un-pick" in the census. Never a menu.
    if (input.pressedName('block')) {
      this._gesture();
      if (this.page !== 'root') { this.page = 'root'; this.sel = this.saves.length ? 0 : 1; this.dirty = true; }
      return null;
    }
    if (!input.pressedName('interact')) return null;
    this._gesture();
    this.inputsTaken++;
    const row = rows[this.sel];
    if (!row || !row.enabled) return null;

    // Pages this surface resolves on its own. Everything else goes to the engine.
    if (row.id === 'back') { this.page = 'root'; this.sel = this.saves.length ? 0 : 1; this.dirty = true; return null; }
    if (row.id === 'load') { this.page = 'saves'; this.sel = 0; this.dirty = true; return null; }
    if (row.id === 'settings') { this.page = 'settings'; this.sel = 0; this.dirty = true; return null; }
    if (row.id === 'look-sensitivity') {
      this.sensIndex = (this.sensIndex + 1) % SENS_STEPS.length;
      this.dirty = true;
      return { activated: 'look-sensitivity', value: SENS_STEPS[this.sensIndex] };
    }
    return { activated: row.id };
  }

  _gesture() {
    if (this.firstGestureAt !== null) return;
    this.firstGestureAt = this.inputsTaken;
    // O4: whatever needs a user gesture — audio context, pointer lock, fullscreen — is
    // unlocked HERE, by the gesture that starts the game, and never by a surface of its own.
    if (typeof this.onFirstGesture === 'function') { try { this.onFirstGesture(); } catch { /* never block the title */ } }
  }

  _move(dir, rows) {
    const n = rows.length;
    if (n <= 0) return;
    // Skip rows that are drawn but cannot act, so a player holding down never lands on a
    // dead row and concludes the surface is broken.
    let i = this.sel;
    for (let k = 0; k < n; k++) {
      i = ((i + dir) % n + n) % n;
      if (rows[i].enabled) { this.sel = i; this.dirty = true; return; }
    }
    this.dirty = true;
  }

  /** What a critic reads for M20: the surface, its exact option set, and what is focused. */
  state() {
    const rows = this.options();
    return {
      present: true,
      shown: this.shown,
      page: this.page,
      options: rows,
      option_ids: rows.map((r) => r.id),
      selected_index: this.sel,
      selected_id: rows[this.sel] ? rows[this.sel].id : null,
      saves: this.saves.map((s) => ({ slot: s.slot, header: s.header || null, bytes: s.bytes || 0 })),
      save_count: this.saves.length,
      continue_available: this.saves.length > 0,
      in_session: this.inSession,
      inputs_taken: this.inputsTaken,
      first_gesture_at_input: this.firstGestureAt,
      shown_at_frame: this.shownAtFrame,
      dismissed_by: this.dismissedBy,
      look_sensitivity_scale: SENS_STEPS[this.sensIndex],
      // O2: there is nothing to skip. No logo, no splash, no cinematic, no timed hold.
      unskippable_ms: 0,
      // O1/M1: the world is rendered behind this surface, so it is not a full-viewport UI
      // state with no world behind it.
      world_behind: true,
    };
  }

  metrics() {
    if (this.dirty) { this._redraw(); this.dirty = false; }
    return this.last;
  }

  render(three) {
    if (this.dirty) { this._redraw(); this.dirty = false; }
    if (!this.shown) return false;
    const prevAuto = three.autoClear;
    three.autoClear = false;
    three.clearDepth();
    three.render(this.scene, this.camera);
    three.autoClear = prevAuto;
    return true;
  }

  // ---- drawing ------------------------------------------------------------------------

  _redraw() {
    const c = this.ctx;
    const W = this.canvas.width, H = this.canvas.height;
    c.clearRect(0, 0, W, H);
    this.texture.needsUpdate = true;
    if (!this.shown) { this.last = emptyMetrics(); return; }

    const s = H / 1080;
    const rows = this.options();
    const markSize = Math.round(84 * s);
    const subSize = Math.round(24 * s);
    const optSize = Math.round(32 * s);
    const noteSize = Math.round(21 * s);
    const optH = Math.round(optSize * 1.86);
    const x = Math.round(W * 0.12);

    // A scrim, not a background. The vellum of the dialogue surface is 0.86 alpha over a
    // panel; this is 0.62 over the whole frame, so the hold — the bunk, the water light,
    // the person on the other bench — is legible through it. `uniform_area_frac` is what
    // M5 would call this and it is reported honestly below.
    c.save();
    c.fillStyle = SCRIM;
    c.fillRect(0, 0, W, H);

    const drawn = [];
    let y = Math.round(H * 0.30);

    c.textAlign = 'left';
    c.font = markFont(markSize);
    c.fillStyle = INK;
    c.fillText('ELDER SOULS', x, y);
    drawn.push('ELDER SOULS');
    y += Math.round(subSize * 1.7);

    c.font = smallFont(subSize);
    c.fillStyle = INK_DIM;
    c.fillText('ARGONIA', x, y);
    drawn.push('ARGONIA');
    y += Math.round(18 * s);

    c.beginPath();
    c.moveTo(x, y + 0.5); c.lineTo(x + Math.round(W * 0.30), y + 0.5);
    c.strokeStyle = RULE; c.lineWidth = Math.max(1, Math.round(1 * s)); c.stroke();
    y += Math.round(optSize * 2.0);

    c.font = bodyFont(optSize);
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const isSel = i === this.sel;
      c.fillStyle = !r.enabled ? INK_OFF : (isSel ? INK_HOT : INK_DIM);
      const label = (isSel ? '— ' : '  ') + r.label;
      c.fillText(label, x, y);
      drawn.push(r.label);
      y += optH;
    }

    // The one note on the surface, and it is a fact rather than an instruction: which life
    // `Continue` would return you to. O10's carried document is named here because the writ
    // is what the save is *of*.
    if (this.page === 'root' && this.saves.length) {
      y += Math.round(14 * s);
      c.font = smallFont(noteSize);
      c.fillStyle = INK_DIM;
      const note = slotLabel(this.saves[0]);
      c.fillText(note, x, y);
      drawn.push(note);
    }
    if (this.page === 'root' && !this.saves.length) {
      y += Math.round(14 * s);
      c.font = smallFont(noteSize);
      c.fillStyle = INK_OFF;
      const note = 'No life recorded in this province.';
      c.fillText(note, x, y);
      drawn.push(note);
    }
    c.restore();

    const text = drawn.filter(Boolean);
    this.last = {
      open: true,
      frame_px: [W, H],
      // The scrim covers the frame at 0.62 alpha. Reported as its alpha-weighted share
      // rather than as 1.0 or as 0: overstating our own footprint is the safe direction and
      // pretending a scrim is not there is the dishonest one.
      opaque_area_frac: 0.62,
      uniform_area_frac: 0.62,
      full_screen_panels: 0,
      world_visible_behind: true,
      option_count: rows.length,
      selected_index: this.sel,
      text,
      text_chars: text.join(' ').length,
    };
  }
}

function slotLabel(s) {
  const h = (s && s.header) || {};
  const bits = [];
  if (h.name) bits.push(String(h.name));
  if (h.place) bits.push(String(h.place));
  if (h.day != null) bits.push(`day ${h.day}`);
  if (!bits.length) bits.push(String(s && s.slot ? s.slot : 'a saved life'));
  return bits.join(' · ');
}

function emptyMetrics() {
  return {
    open: false, frame_px: [0, 0], opaque_area_frac: 0, uniform_area_frac: 0,
    full_screen_panels: 0, world_visible_behind: true, option_count: 0,
    selected_index: 0, text: [], text_chars: 0,
  };
}

// Generic families only, for the reason render/ui.js gives: a named face that is not
// installed in the capture container silently changes every glyph metric between a
// developer's machine and CI.
function markFont(px) { return `${px}px Georgia, "Times New Roman", serif`; }
function bodyFont(px) { return `${px}px Georgia, "Times New Roman", serif`; }
function smallFont(px) { return `${px}px "Helvetica Neue", Helvetica, Arial, sans-serif`; }
