// The real input path — RI-JRN03 §C/§D (desktop) and RI-JRN04 §E/§F/§G (pad, phone, touch).
//
// Connected ONLY in mode 'play' and 'play-instrumented'. In 'harness' mode every listener below
// is detached, because HARNESS.md R4 says input arrives exclusively via queueInputs() and a
// stray keystroke in CI must never enter a trace.
//
// This file is the DEVICE layer. It owns no semantics: it turns a keydown, a mouse button, a
// wheel notch, a `Gamepad` object and a finger into edges on the one pipeline, and every hazard
// in RI-JRN03 §C/§D and RI-JRN04 §E is handled here with the rule named on the line.
//
// The pad's translation layer is `./gamepad.js`, the touch layer is `./touch.js`, the phone's
// viewport is `./viewport.js` and the rebinding model is `./rebind.js`. They are separate files
// because RI-JRN04 "How we lose" #11 is that touch gets built last, inside an input layer with
// fourteen hard-coded gamepad assumptions in it.
'use strict';

import { DEFAULT_BINDINGS, MOVE_BINDINGS, PREVENT_DEFAULT_CODES, buildControlMap, profiles as loadedProfiles, profilesLoaded } from './bindings.js';
import { GamepadRouter } from './gamepad.js';
import { TouchInput } from './touch.js';
import { Viewport } from './viewport.js';
import { Rebinder, labelOf } from './rebind.js';

/** RI-JRN03 §B: two-binding hold gates, `KeyG` for two_hand and `Mouse1` held for lock_on. */
const HOLD_SUFFIX = /^(.*)Hold(\d+)$/;

export class RealInput {
  /**
   * @param {InputPipeline} pipe
   * @param {HTMLCanvasElement} canvas
   * @param {object} data the loaded data tree; `data.inputProfiles` and `data.padQuirks`
   */
  constructor(pipe, canvas, data = null) {
    if (!profilesLoaded()) throw new Error('RealInput: setProfiles() must run before the input path is built. The binding table is data (game/data/input/profiles.json), not a literal.');
    this.pipe = pipe;
    this.canvas = canvas;
    this.profiles = (data && data.inputProfiles) || loadedProfiles();
    this.quirks = (data && data.padQuirks) || null;
    this.bindings = JSON.parse(JSON.stringify(DEFAULT_BINDINGS));
    this.moveBindings = JSON.parse(JSON.stringify(MOVE_BINDINGS));
    this.controlMap = buildControlMap(this.bindings);
    this.moveCodes = this._buildMoveCodes();
    this.attached = false;
    this.pointerLocked = false;
    this.hasFocus = true;
    this.activeDevice = 'keyboard';
    this.lockErrors = 0;
    this.lockRequests = 0;
    this.lockRetryPending = false;
    this.dragLook = null;        // PL5 fallback: click-drag look when the lock will not hold
    this.menuOpen = false;
    // RI-CAM02 §A: 0.120 °/px yaw, 0.100 °/px pitch, LINEAR, no acceleration at any setting.
    const lk = this.profiles.desktop.look;
    this.lookSensitivity = lk.deg_per_px_yaw;
    this.lookSensitivityY = lk.deg_per_px_pitch;
    this.lookExponent = lk.exponent;
    this.moveDirs = { forward: false, back: false, left: false, right: false };
    this._handlers = [];
    this._holds = Object.create(null);   // control -> {action, frames, since}
    this.frameOf = () => 0;              // set by the engine; the FIXED sim frame

    // ---- gamepad (RI-JRN04). The translation layer, not a button table. -------------------
    this.pad = this.quirks ? new GamepadRouter(pipe, this.profiles, this.quirks) : null;
    if (this.pad) {
      this.pad.onConnect = (info) => { this.activeDevice = 'gamepad'; this.padGlyphUntil = this.frameOf() + 120; this.onDeviceChange && this.onDeviceChange('gamepad'); this.onPadConnect && this.onPadConnect(info); };
      this.pad.onDisconnect = (info) => { this.onPadDisconnect && this.onPadDisconnect(info); };
      this.pad.onDeviceActive = () => { this.activeDevice = 'gamepad'; this.onDeviceChange && this.onDeviceChange('gamepad'); };
    }
    this.padGlyphUntil = -1;
    this.syntheticPads = null;   // A-JRN2 / __HARNESS.gamepad()

    // ---- phone + touch (RI-JRN04 §F/§G) ---------------------------------------------------
    this.viewport = new Viewport(canvas, this.profiles);
    this.touch = new TouchInput(pipe, canvas, this.profiles);
    this.touch.frame = () => this.frameOf();
    this.touch.onActivity = () => { this.activeDevice = 'touch'; this.onDeviceChange && this.onDeviceChange('touch'); };
    this.viewport.onResize = (s, insets) => { this.touch.setViewport(s.w, s.h, s.dpr, insets); this.onViewportChange && this.onViewportChange(s, insets); };

    // ---- rebinding (RI-JRN03 §E) ----------------------------------------------------------
    this.rebinder = new Rebinder(this.profiles, {
      onCommit: (device) => { if (device === 'keyboard' || device === null) this._rebuildKeyboard(); },
    });
    this.layoutMap = null;       // B2: KeyboardLayoutMap where the UA has one

    /** Text typed into a dialogue surface. Set by the engine; not part of the action set. */
    this.onTextChar = null;
    this.firstGestureDone = false;
  }

  _buildMoveCodes() {
    const m = Object.create(null);
    for (const [dir, codes] of Object.entries(this.moveBindings)) for (const c of codes) if (c) m[c] = dir;
    return m;
  }

  _rebuildKeyboard() {
    const b = this.rebinder.bindings.keyboard;
    this.bindings = {};
    this.moveBindings = { forward: [], back: [], left: [], right: [] };
    for (const [a, pair] of Object.entries(b)) {
      if (a.startsWith('move_')) this.moveBindings[a.slice(5)] = pair.slice();
      else this.bindings[a] = pair.slice();
    }
    this.controlMap = buildControlMap(this.bindings);
    this.moveCodes = this._buildMoveCodes();
  }

  /** B2 — the binding is physical, the LABEL is localised. Async because the API is. */
  async loadKeyboardLayout() {
    try {
      if (typeof navigator !== 'undefined' && navigator.keyboard && navigator.keyboard.getLayoutMap) {
        this.layoutMap = await navigator.keyboard.getLayoutMap();
        return true;
      }
    } catch { /* B2's fallback is the code itself, which is right on QWERTY */ }
    return false;
  }

  /** What the settings surface prints for a control on THIS layout (B2). */
  label(control) { return labelOf(control, this.layoutMap); }

  // ---- the pad --------------------------------------------------------------------------

  /**
   * Poll the pad. Called once per rAF from the engine's render loop in play mode and once per
   * `stepFrames` batch by the harness, so a scripted gamepad run and a real one go through the
   * identical code path. §D: the array is a SNAPSHOT and is never cached.
   */
  pollGamepad() {
    if (!this.pad) return null;
    const pads = this.syntheticPads
      ? this.syntheticPads
      : (typeof navigator !== 'undefined' && navigator.getGamepads ? navigator.getGamepads() : []);
    const obs = this.pad.poll(pads, this.frameOf());
    if (obs) { this.touch.setPadActive(true); }
    else if (!this.pad.connected) this.touch.setPadActive(false);
    return obs;
  }

  /**
   * A-JRN2 / `__HARNESS.gamepad()`. Pushes a synthetic pad ABOVE the router but BELOW nothing:
   * it is shaped exactly as `navigator.getGamepads()` returns, including a `mapping` string and
   * `.value` on every button, so the whole translation layer runs. `null` disconnects it.
   *
   * `buttons` accepts booleans OR numbers; a NUMBER sets `.value` and leaves `.pressed` FALSE,
   * which is how M-P3 detects a build that reads `.pressed` on a trigger.
   */
  pushGamepadState(state) {
    if (!state) { this.syntheticPads = []; const r = this.pollGamepad(); this.syntheticPads = null; return r; }
    const n = state.buttons_length || 17;
    const pad = {
      index: state.index === undefined ? 0 : state.index,
      id: state.id || 'GameSir-X2s Type-C (STANDARD GAMEPAD Vendor: 3537 Product: 1004)',
      connected: true,
      mapping: state.mapping === undefined ? 'standard' : state.mapping,
      timestamp: state.timestamp || 0,
      buttons: Array.from({ length: n }, (_, i) => {
        const v = (state.buttons || [])[i];
        if (typeof v === 'number') return { pressed: false, touched: v > 0, value: v };
        return { pressed: !!v, touched: !!v, value: v ? 1 : 0 };
      }),
      axes: Array.from({ length: state.axes_length || 4 }, (_, i) => Number((state.axes || [])[i] || 0)),
    };
    this.syntheticPads = [pad];
    return this.pollGamepad();
  }

  // ---- lifecycle ------------------------------------------------------------------------

  attach() {
    if (this.attached) return;
    this.attached = true;
    const on = (target, type, fn, opts) => {
      target.addEventListener(type, fn, opts);
      this._handlers.push([target, type, fn, opts]);
    };

    on(window, 'keydown', (e) => {
      if (e.repeat) return;                                      // KB2: auto-repeat ignored
      // KB4/KB5/KB6: Tab must not move focus, Space must not scroll, `/` must not open
      // quick-find, Backspace must not navigate. preventDefault runs BEFORE the ctrl/alt
      // bail-out for the keys we own, so Tab is suppressed whether or not a modifier is down.
      if (PREVENT_DEFAULT_CODES.has(e.code)) e.preventDefault();
      if (e.ctrlKey || e.altKey || e.metaKey) return;             // KB3: never bound
      this.activeDevice = 'keyboard';
      this.onDeviceChange && this.onDeviceChange('keyboard');
      if (this._captureControl(e.code)) { e.preventDefault(); return; }  // RB3
      const dir = this.moveCodes[e.code];
      if (dir) { this.moveDirs[dir] = true; this._pushMove(); return; }
      const action = this.controlMap[e.code];
      if (action) { this._down(e.code, action); return; }
      // Text entry into a dialogue surface. NOT a button — HARNESS.md §4's action set stays
      // closed, and the surface is completable without ever reaching this path (O17).
      if (this.onTextChar) {
        if (e.key === 'Backspace') this.onTextChar('\b');
        else if (e.key && e.key.length === 1 && /[\p{L}\p{N}\-' .]/u.test(e.key)) this.onTextChar(e.key);
      }
    });

    on(window, 'keyup', (e) => {
      const dir = this.moveCodes[e.code];
      if (dir) { this.moveDirs[dir] = false; this._pushMove(); return; }
      this._up(e.code);
    });

    on(this.canvas, 'mousedown', (e) => {
      e.preventDefault();
      this.activeDevice = 'mouse';
      this.onDeviceChange && this.onDeviceChange('mouse');
      const control = 'Mouse' + e.button;
      if (this._captureControl(control)) return;
      this._down(control, this.controlMap[control]);
      if (this.dragLook) { this.dragLook.dragging = true; this.dragLook.x = e.clientX; this.dragLook.y = e.clientY; }
      // PL1/PL3: the lock is requested on the gesture that starts the game and RE-requested on
      // the next click after any loss. Never on a "click to play" surface, and never while a
      // cursor-driven surface is open — that state is the menu and the cursor belongs to it.
      if (!this.pointerLocked && !this.menuOpen) this.requestPointerLock();
    });
    on(window, 'mouseup', (e) => {
      const control = 'Mouse' + e.button;
      this._up(control);
      if (this.dragLook) this.dragLook.dragging = false;
    });

    // PL9: a context menu over a boss fight is a lost run. Unconditional.
    on(this.canvas, 'contextmenu', (e) => e.preventDefault());

    on(window, 'mousemove', (e) => {
      if (this.pointerLocked) {
        // PL6/PL7: movementX/Y only, coalesced where available, accumulated per rAF and
        // consumed by the next fixed step. Never client coordinates, never per rendered frame.
        const events = (typeof e.getCoalescedEvents === 'function') ? e.getCoalescedEvents() : null;
        let dx = 0, dy = 0;
        if (events && events.length) { for (const ev of events) { dx += ev.movementX; dy += ev.movementY; } }
        else { dx = e.movementX; dy = e.movementY; }
        this.pipe.addLook(this._look(dx, this.lookSensitivity), this._look(dy, this.lookSensitivityY));
        return;
      }
      // PL5: the lock failed permanently. The game stays fully playable — look falls back to
      // click-drag and every action is already keyboard-reachable (A1). No modal, ever.
      if (this.dragLook && this.dragLook.dragging) {
        const dx = e.clientX - this.dragLook.x, dy = e.clientY - this.dragLook.y;
        this.dragLook.x = e.clientX; this.dragLook.y = e.clientY;
        this.pipe.addLook(this._look(dx, this.lookSensitivity), this._look(dy, this.lookSensitivityY));
      }
    });

    on(this.canvas, 'wheel', (e) => {
      e.preventDefault();
      const control = e.deltaY < 0 ? 'WheelUp' : 'WheelDown';
      if (this._captureControl(control)) return;
      const action = this.controlMap[control];
      if (action) { this.pipe.edgeDown(action); this.pipe.edgeUp(action); }
    }, { passive: false });

    // PL2/PL4: Escape always exits pointer lock and the page cannot prevent it, so lock exit IS
    // the menu-open signal, and every held action is released on that frame. There is no
    // reachable state that is gameplay with no lock and no menu (HF4).
    on(document, 'pointerlockchange', () => {
      const was = this.pointerLocked;
      this.pointerLocked = document.pointerLockElement === this.canvas;
      if (was && !this.pointerLocked) {
        this._releaseEverything();
        this.menuOpen = true;
        this.onLockLost && this.onLockLost();
      } else if (this.pointerLocked) {
        this.menuOpen = false;
      }
    });
    on(document, 'pointerlockerror', () => {                       // PL5
      this.lockErrors++;
      if (this.lockErrors >= 2 && !this.dragLook) this.dragLook = { dragging: false, x: 0, y: 0 };
      this.onLockError && this.onLockError(this.lockErrors);
    });

    // KB7/KB9: focus loss with keys held. The single most common browser-game input bug.
    on(window, 'blur', () => { this.hasFocus = false; this._releaseEverything(); });
    on(window, 'focus', () => { this.hasFocus = true; });
    on(document, 'visibilitychange', () => {
      if (document.hidden) { this.hasFocus = false; this._releaseEverything(); this.viewport.releaseWakeLock(); }
      else { this.viewport.requestWakeLock(); }
    });

    // RI-JRN04 L2/L3 — the pad's own events. The router releases on the poll as well, so a UA
    // that never fires `gamepaddisconnected` still cannot latch a held sprint; these make the
    // release land on the event rather than one poll later. The shim dispatches a CustomEvent
    // whose gamepad is on `.detail`, a real browser puts it on `.gamepad`; read both.
    on(window, 'gamepadconnected', (e) => {
      const g = e.gamepad || (e.detail && e.detail.gamepad);
      this.activeDevice = 'gamepad';
      this.padGlyphUntil = this.frameOf() + 120;                   // L2: <= 2 s, non-modal
      this.onDeviceChange && this.onDeviceChange('gamepad');
      this.onPadConnect && this.onPadConnect(g ? { id: g.id, index: g.index, mapping: g.mapping } : null);
    });
    on(window, 'gamepaddisconnected', (e) => {
      const g = e.gamepad || (e.detail && e.detail.gamepad);
      const idx = g && g.index !== undefined ? g.index : null;
      if (this.pad) { if (idx === null) { for (const i of Array.from(this.pad.pads.keys())) this.pad._dropPad(i, this.frameOf()); } else this.pad._dropPad(idx, this.frameOf()); }
      this.touch.setPadActive(false);
    });

    this.viewport.attach();
    this.viewport.detectDeviceClass();
    const s = this.viewport.size();
    this.touch.setViewport(s.w, s.h, s.dpr, this.viewport.readSafeAreaInsets());
    // L9/H2: a coarse-pointer device gets the touch fallback from the FIRST FRAME and the
    // handheld pad profile, both decided by media query. There is no "connect a controller"
    // screen and the gamepad list is never consulted for device class (L1).
    if (this.viewport.deviceClass === 'handheld') {
      this.touch.enabled = true;
      this.touch.attach();
      if (this.pad) this.pad.selectProfileForDeviceClass('handheld');
    }
    this.loadKeyboardLayout();
  }

  detach() {
    for (const [t, type, fn, opts] of this._handlers) t.removeEventListener(type, fn, opts);
    this._handlers.length = 0;
    this.attached = false;
    this.touch.detach();
    this.viewport.detach();
    this._releaseEverything();
  }

  /** RI-JRN01 O4 / H1 / H6 / H9 / PL1 — one gesture does all of it. */
  async firstGesture() {
    this.firstGestureDone = true;
    const vp = await this.viewport.onFirstGesture();
    if (!this.menuOpen) this.requestPointerLock();
    return vp;
  }

  // ---- hold-gated bindings (§B `KeyG` two_hand, `Mouse1Hold12` lock_on) ------------------

  _down(control, action) {
    // A control may be bound directly AND as a hold. `Mouse1` is `parry`; `Mouse1Hold12` is
    // `lock_on`. Both are armed on the press; the hold fires 12 frames later if still down.
    const holdControl = control + 'Hold' + (this.profiles.desktop.hold_gate_frames.lock_on_secondary || 12);
    const holdAction = this.controlMap[holdControl];
    const gateFrames = this.profiles.desktop.hold_gate_frames.two_hand || 12;
    if (action === 'two_hand') {
      // §B: `G` (hold >= 12 frames). A stray tap must not change stance mid-fight.
      this._holds[control] = { action: 'two_hand', at: this.frameOf() + gateFrames, fired: false };
      return;
    }
    if (holdAction) this._holds[control] = { action: holdAction, at: this.frameOf() + 12, fired: false, alsoTap: action };
    if (action) this.pipe.edgeDown(action);
  }

  _up(control) {
    const h = this._holds[control];
    if (h) {
      delete this._holds[control];
      if (h.fired) { this.pipe.edgeUp(h.action); if (!h.alsoTap) return; }
      else if (h.action === 'two_hand') return;    // released before the gate: nothing happens
    }
    const action = this.controlMap[control];
    if (action) this.pipe.edgeUp(action);
  }

  /** Called once per fixed step by the engine, before the latch. */
  tick(frame) {
    for (const [control, h] of Object.entries(this._holds)) {
      if (!h.fired && frame >= h.at) { h.fired = true; this.pipe.edgeDown(h.action); }
    }
    this.touch.tick(frame);
  }

  // ---- rebinding capture (RB3) ------------------------------------------------------------

  /** @returns {boolean} true when the surface swallowed this control as a binding. */
  _captureControl(control) {
    if (!this.rebinder.open || !this.rebinder.capturing) return false;
    if (control === 'Escape') return false;                 // menu backs out of the capture
    this.rebinder.offer(control);
    return true;
  }

  openRebinding(device) {
    this.rebinder.openSurface(device || (this.activeDevice === 'gamepad' ? 'gamepad' : this.activeDevice === 'touch' ? 'touch' : 'keyboard'));
    this.menuOpen = true;
    // RB11: a cursor-driven surface releases the lock on open.
    if (this.pointerLocked && document.exitPointerLock) { try { document.exitPointerLock(); } catch { /* PL5 */ } }
    if (this.pad) this.pad.uiMode = true;
    return this.rebinder.view(this.layoutMap);
  }

  closeRebinding() {
    this.rebinder.closeSurface();
    this.menuOpen = false;
    if (this.pad) this.pad.uiMode = false;
    this.requestPointerLock();       // PL3: re-request; Chrome may reject, so the next click retries
    return true;
  }

  // ---- helpers ---------------------------------------------------------------------------

  _look(delta, scale) {
    // PL8: one LINEAR scalar plus an optional exponent, default 1.0. No hidden acceleration
    // curve — that is the reason "the aim feels wrong" and it cannot be tuned out.
    if (this.lookExponent === 1.0) return delta * scale;
    return Math.sign(delta) * Math.pow(Math.abs(delta), this.lookExponent) * scale;
  }

  _releaseEverything() {
    this.moveDirs.forward = this.moveDirs.back = this.moveDirs.left = this.moveDirs.right = false;
    for (const k of Object.keys(this._holds)) delete this._holds[k];
    this.touch.releaseAll();
    this.pipe.setMove(0, 0);
    this.pipe.releaseAll();
  }

  _pushMove() {
    const x = (this.moveDirs.right ? 1 : 0) - (this.moveDirs.left ? 1 : 0);
    const y = (this.moveDirs.forward ? 1 : 0) - (this.moveDirs.back ? 1 : 0);
    const m = Math.hypot(x, y);
    this.pipe.setMove(m > 1 ? x / m : x, m > 1 ? y / m : y);
  }

  requestPointerLock() {
    this.lockRequests++;
    try { this.canvas.requestPointerLock && this.canvas.requestPointerLock(); } catch { /* PL5 */ }
  }

  /** A-JRN6 — the observation surface. Nothing here is a consumer of anything. */
  getInputState() {
    const padObs = this.pad
      ? {
        connected: this.pad.connected, id: this.pad.lastId, index: this.pad.activeIndex,
        mapping: this.pad.lastMapping, quirk: this.pad.quirkUsed, profile: this.pad.profileName,
        polls: this.pad.pollCount, pads: this.pad.pads.size,
        calibrating: !!this.pad.calibration, calibrationPrompt: this.pad.calibrationPrompt(),
        chargeIntent: this.pad.chargeIntent, log: this.pad.log.slice(-8),
      }
      : { connected: false, id: null, index: null, mapping: null, quirk: null, profile: null, polls: 0, pads: 0 };
    return {
      pointerLocked: this.pointerLocked,
      hasFocus: this.hasFocus,
      activeDevice: this.activeDevice,
      deviceClass: this.viewport.deviceClass,
      menuOpen: this.menuOpen,
      lockErrors: this.lockErrors,
      lockRequests: this.lockRequests,
      dragLookFallback: !!this.dragLook,
      gamepad: padObs,
      touch: this.touch.state(),
      viewport: this.viewport.state(),
      rebinding: { open: this.rebinder.open, capturing: this.rebinder.capturing, pending: this.rebinder.pending, message: this.rebinder.message, device: this.rebinder.device },
      held: this.pipe.heldNames().slice(),
      bindings: this.bindings,
      moveBindings: this.moveBindings,
      chargeIntent: this.pipe.chargeIntent,
      droppedInputs: this.pipe.droppedInputs,
      bufferMisses: this.pipe.bufferMisses,
    };
  }
}
