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
import { inputNow, holdGateFrames, shouldPromote, promotedAtRelease, framesHeld, framesHeldWhileDown, STEP_MS } from './hold-gate.js';

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
    this._holds = Object.create(null);   // control -> {action, tDown (ms), frames (f@60), fired}
    this.frameOf = () => 0;              // set by the engine; the FIXED sim frame
    // S39: the loop mode selects the input clock. Set by the engine alongside `frameOf`; the
    // default is the harness clock, which is the safe one — it reads no wall clock at all.
    this.modeOf = () => 'harness';

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
    this.touch.now = (event) => this.inputNow(event);
    this.touch.onActivity = () => { this.activeDevice = 'touch'; this.onDeviceChange && this.onDeviceChange('touch'); };
    this.viewport.onResize = (s, insets) => { this.touch.setViewport(s.w, s.h, s.dpr, insets); this.onViewportChange && this.onViewportChange(s, insets); };

    // ---- rebinding (RI-JRN03 §E) ----------------------------------------------------------
    this.rebinder = new Rebinder(this.profiles, {
      onCommit: (device) => { if (device === 'keyboard' || device === null) this._rebuildKeyboard(); },
    });
    this.layoutMap = null;       // B2: KeyboardLayoutMap where the UA has one

    /** Text typed into a dialogue surface. Set by the engine; not part of the action set. */
    this.onTextChar = null;
    /**
     * Does a text field have the keyboard right now? Set by the engine to a predicate over the
     * surface that is open (`Engine._censusTakesText()`); null means "no text field anywhere",
     * which is the state the whole rest of the game is in and the reason movement is untouched.
     *
     * This is the one bit of knowledge that turns the keyboard from a button grid into a text
     * field, and its absence was W1-26 r2 §3: the device layer routed movement, then controls,
     * then text, so fourteen of the twenty-six letters never reached the field and `KeyE` —
     * `interact` — committed the answer mid-word. The engine has always known this
     * (`_censusTypeChar` tests `st.input.kind === 'text'`); it simply never told this file.
     */
    this.textFocus = null;
    this.textCharsTaken = 0;     // A-JRN6 observation only; nothing reads it as a control
    this._textConsumed = new Set();   // codes whose keydown became a character, not a button
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
    // S39. This method is the rAF entry point in mode `play` (engine.js sets `loop.beforeTick`
    // to call it), and rAF is OUTSIDE the fixed step — which makes it the one place a hand-clock
    // millisecond may legally be read in play mode. So the touchscreen's and the keyboard's held
    // presses are aged here too, from the same clock, in the same tick, as the pad's.
    //
    // In `harness` / `play-instrumented` the hand's clock is `frame * STEP_MS` and the ageing
    // happens in `tick(frame)` instead, inside the step, where it is deterministic. One
    // implementation (`hold-gate.js`), two call sites, selected by mode and by nothing else.
    const play = this.modeOf() === 'play';
    this.touch.playClock = play;
    if (play) {
      const nowMs = this.inputNow(null);
      this.touch.pollHolds(nowMs);
      this._pollHolds(nowMs);
    }
    if (!this.pad) return null;
    const pads = this.syntheticPads
      ? this.syntheticPads
      : (typeof navigator !== 'undefined' && navigator.getGamepads ? navigator.getGamepads() : []);
    const obs = this.pad.poll(pads, this.frameOf(), this.inputNow(null));
    if (obs) { this.touch.setPadActive(true); }
    else if (!this.pad.connected) this.touch.setPadActive(false);
    return obs;
  }

  /**
   * S39's `inputNow()` for this input tree: ms, `event.timeStamp` in play, `frame * STEP_MS`
   * otherwise. Every call site in `input/` goes through here so there is exactly one clock.
   */
  inputNow(event) { return inputNow(this.modeOf(), this.frameOf(), event); }

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
      // PL3 — THE WAY BACK IN. Escape is also the natural "close the menu" key, and closing the
      // menu re-requests pointer lock.
      //
      // Found by M-K9 the first time that check existed. `pointerlockchange` set `menuOpen` and
      // NOTHING cleared it except the lock being re-acquired, while `mousedown` refused to
      // request the lock *because* `menuOpen` was set. So the two guards held each other shut: a
      // player who pressed Escape got the menu and the cursor, and then a second Escape did
      // nothing and every subsequent click did nothing, forever. That is HF4 wearing the other
      // face — not gameplay with no menu, but a menu with no gameplay — and it is worse than the
      // state the item names, because there is no way out of it at all.
      //
      // The rebinding surface is deliberately excluded: it is a genuine cursor-driven surface and
      // the cursor belongs to it until it closes itself (RB11).
      if (e.code === 'Escape' && this.menuOpen && !this.rebinder.open) {
        this.menuOpen = false;
        this.requestPointerLock();
        return;
      }
      // A FOCUSED TEXT FIELD TAKES THE KEYBOARD BEFORE THE BUTTONS DO.
      //
      // This block used to sit at the BOTTOM of this handler, after the movement map and after
      // the control map, and W1-26 r2 §3 is the bill for it. `game/data/input/profiles.json`
      // binds fourteen letters (A C D E F G M R S T V W X Z), the digits 1-4 and `Space`, so
      // every one of those was eaten as a button and never reached the field: the critic
      // predicted `"Silt-Under-Salt"` -> `"il-Un-l"` from the bindings file alone, before
      // opening a browser, and then measured `"il-Un"` live — because `KeyE` is `interact` and
      // does not merely drop the character, it COMMITS the node in the middle of the word.
      //
      // Three things this deliberately does NOT do:
      //
      //   * it does not run when no text field is open. `textFocus` is null everywhere else in
      //     the game, so the movement and control maps below are reached on exactly the frames
      //     they were reached on before. An input layer that swallowed keys in the world would
      //     be the same defect wearing the other face.
      //   * it does not swallow the non-printing keys. `Enter`, `Escape`, `Tab` and the arrows
      //     fall through to the maps, which is what keeps the field usable: `interact` is bound
      //     to `["KeyE","Enter"]`, so `Enter` still commits the name, `Escape` is still `menu`,
      //     and the arrows still move the caret through the offered ledger names. `KeyE` types
      //     an `e`, which is the whole point.
      //   * it does not add an action. HARNESS.md §4's set stays closed and O17 still holds —
      //     the node is completable on a stick and two buttons without this path ever running.
      if (this.onTextChar && this.textFocus && this.textFocus()) {
        const takeAsText = (ch) => {
          this.onTextChar(ch); this.textCharsTaken++;
          // KB7's rule applied to this route: a press that never became a button press must not
          // produce a release either, or `keyup` below would hand the pipeline an `edgeUp` for
          // an action nothing pressed — `roll` released by typing a space in a name.
          this._textConsumed.add(e.code);
        };
        if (e.key === 'Backspace') { takeAsText('\b'); return; }
        if (e.key && e.key.length === 1 && /[\p{L}\p{N}\-' .]/u.test(e.key)) { takeAsText(e.key); return; }
      }
      const dir = this.moveCodes[e.code];
      if (dir) { this.moveDirs[dir] = true; this._pushMove(); return; }
      const action = this.controlMap[e.code];
      if (action) { this._down(e.code, action, e); return; }
      // The fallback for a build that has an `onTextChar` but no `textFocus` predicate — the
      // shape this file shipped in before r3. Unreachable for a character the maps above claim,
      // which is precisely the defect; kept so a caller that sets only `onTextChar` still types.
      if (this.onTextChar) {
        if (e.key === 'Backspace') this.onTextChar('\b');
        else if (e.key && e.key.length === 1 && /[\p{L}\p{N}\-' .]/u.test(e.key)) this.onTextChar(e.key);
      }
    });

    on(window, 'keyup', (e) => {
      if (this._textConsumed.delete(e.code)) return;   // it was a character, not a button
      const dir = this.moveCodes[e.code];
      if (dir) { this.moveDirs[dir] = false; this._pushMove(); return; }
      this._up(e.code, e);
    });

    on(this.canvas, 'mousedown', (e) => {
      e.preventDefault();
      this.activeDevice = 'mouse';
      this.onDeviceChange && this.onDeviceChange('mouse');
      const control = 'Mouse' + e.button;
      if (this._captureControl(control)) return;
      this._down(control, this.controlMap[control], e);
      if (this.dragLook) { this.dragLook.dragging = true; this.dragLook.x = e.clientX; this.dragLook.y = e.clientY; }
      // PL1/PL3: the lock is requested on the gesture that starts the game and RE-requested on
      // THE NEXT USER CLICK after any loss, because Chrome rejects a re-request made inside its
      // cooldown after an Escape-triggered exit and the item's ruling is written so it does not
      // matter whether that cooldown is 1 s or 2 s — the game retries on the click either way.
      //
      // The exclusion is the REBINDING SURFACE, not `menuOpen`. Excluding `menuOpen` is what
      // made the lock-loss menu inescapable (see the Escape handler above): the state Escape
      // puts you in IS "no lock", so refusing to re-request while in it means never re-
      // requesting at all. A cursor-driven surface genuinely owns the cursor; the menu the lost
      // lock opened is the thing this click is supposed to leave.
      if (!this.pointerLocked && !this.rebinder.open) {
        this.menuOpen = false;
        this.requestPointerLock();
      }
    });
    on(window, 'mouseup', (e) => {
      const control = 'Mouse' + e.button;
      this._up(control, e);
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
        // Inverted Y: moving the mouse down raises the camera, and moving it up lowers it.
        this.pipe.addLook(this._look(dx, this.lookSensitivity), -this._look(dy, this.lookSensitivityY));
        return;
      }
      // PL5: the lock failed permanently. The game stays fully playable — look falls back to
      // click-drag and every action is already keyboard-reachable (A1). No modal, ever.
      if (this.dragLook && this.dragLook.dragging) {
        const dx = e.clientX - this.dragLook.x, dy = e.clientY - this.dragLook.y;
        this.dragLook.x = e.clientX; this.dragLook.y = e.clientY;
        this.pipe.addLook(this._look(dx, this.lookSensitivity), -this._look(dy, this.lookSensitivityY));
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
        // Escape is the desktop pause/back gesture. Its visible menu is the settings ledger;
        // this also makes rebinding reachable through the native path rather than only through
        // __HARNESS.openRebinding(). A second Escape is consumed by RebindModel and returns.
        if (!this.rebinder.open) this.rebinder.openSurface('keyboard');
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
    // L9/H2 IS A STANDING RULE, NOT A BOOT-TIME ONE. Round 1 applied it once, here, so the
    // fallback was decided by whatever the media queries said at `attach()` and never again —
    // and the whole of §G then depended on the page having booted coarse. It is now a
    // subscription: the Viewport fires whenever the class actually changes and this applies
    // the same three consequences it applies at boot.
    this.viewport.onDeviceClass = (cls) => this.applyDeviceClass(cls);
    this.viewport.detectDeviceClass();
    const s = this.viewport.size();
    this.touch.setViewport(s.w, s.h, s.dpr, this.viewport.readSafeAreaInsets());
    this.applyDeviceClass(this.viewport.deviceClass);
    this.loadKeyboardLayout();
  }

  /**
   * L9/H2/L1 — everything that follows from the device class, in one place.
   *
   * A coarse-pointer device gets the touch fallback from the first frame and the handheld pad
   * profile, both decided by media query. There is no "connect a controller" screen and the
   * gamepad list is never consulted for device class. Going the other way releases every held
   * touch action rather than leaving one latched on a device that no longer has a screen to
   * press — the L3 rule applied to a device class instead of a cable.
   */
  applyDeviceClass(cls) {
    const handheld = cls === 'handheld';
    if (handheld) {
      this.touch.enabled = true;
      this.touch.attach();
      if (this.pad) this.pad.selectProfileForDeviceClass('handheld');
    } else if (this.touch.enabled) {
      this.touch.enabled = false;
      this.touch.detach();
      if (this.pad) this.pad.selectProfileForDeviceClass('desktop');
    }
    return this.touch.enabled;
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

  _down(control, action, event) {
    // A control may be bound directly AND as a hold. `Mouse1` is `parry`; `Mouse1Hold12` is
    // `lock_on`. Both are armed on the press; the hold fires 12 f@60 later if still down.
    //
    // S39 FIGURES 7, 8 AND 9. Figures 7/8 are the two `desktop.hold_gate_frames` rows; figure 9
    // was a BARE DUPLICATE LITERAL `12` on the `lock_on` line below, a second copy of the gate
    // constant that `./hold-gate.js` was written to eliminate and never reached. It now goes
    // through `holdGateFrames()` like every other gate in the tree, so there is one number and
    // one place to break it (RULES 10). The gate is still 12 f@60; only the route changed.
    const lockGate = { frames: this.profiles.desktop.hold_gate_frames.lock_on_secondary };
    const twoHandGate = { frames: this.profiles.desktop.hold_gate_frames.two_hand };
    const holdControl = control + 'Hold' + holdGateFrames(lockGate);
    const holdAction = this.controlMap[holdControl];
    const tDown = this.inputNow(event);            // ms — S39, stamped at the boundary
    if (action === 'two_hand') {
      // §B: `G` (hold >= 12 f@60 = 200 ms). A stray tap must not change stance mid-fight.
      this._holds[control] = { action: 'two_hand', tDown, gate: twoHandGate, fired: false };
      return;
    }
    if (holdAction) this._holds[control] = { action: holdAction, tDown, gate: lockGate, fired: false, alsoTap: action };
    if (action) this.pipe.edgeDown(action);
  }

  _up(control, event) {
    const h = this._holds[control];
    if (h) {
      delete this._holds[control];
      // S39, and this is the keyboard/mouse half of the touchscreen's headline fix: the release
      // re-asks the question in ms rather than trusting `h.fired`, which is only ever set by a
      // poll. A `KeyG` held for 400 ms that begins and ends between two rAF ticks used to be a
      // tap — the two-handed stance simply never happened, however long the key was down.
      const tUp = this.inputNow(event);
      h.framesHeld = framesHeld(h.tDown, tUp);     // f@60, for the harness and the tools
      const held = h.fired || promotedAtRelease(h.tDown, tUp, h.gate);
      if (held) {
        if (!h.fired) this.pipe.edgeDown(h.action);
        this.pipe.edgeUp(h.action);
        if (!h.alsoTap) return;
      } else if (h.action === 'two_hand') return;  // released before the gate: nothing happens
    }
    const action = this.controlMap[control];
    if (action) this.pipe.edgeUp(action);
  }

  /**
   * S39: age the keyboard/mouse hold gates. One implementation; the caller supplies the clock.
   * @param {number} nowMs ms
   */
  _pollHolds(nowMs) {
    for (const control of Object.keys(this._holds)) {
      const h = this._holds[control];
      if (!h.fired && shouldPromote(h.tDown, nowMs, h.gate)) {
        h.fired = true;
        h.framesHeld = framesHeldWhileDown(h.tDown, nowMs);   // f@60, still down
        this.pipe.edgeDown(h.action);
      }
    }
  }

  /** Called once per fixed step by the engine, before the latch. */
  tick(frame) {
    // S39: in harness modes the hand's clock IS `frame * STEP_MS`, so ageing here is exact and
    // deterministic. In mode `play` the rAF poll owns it (see `pollGamepad`) and this must not
    // run, or a starved rAF ages a 500 ms press as one frame all over again.
    if (this.modeOf() !== 'play') this._pollHolds(frame * STEP_MS);
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
    this._textConsumed.clear();
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
      // Whether a text field currently owns the keyboard, and how many characters have gone to
      // one. Observation, not control — A-JRN6. `text_focused false` in the world is the
      // assertion that this route is not swallowing anybody's movement keys.
      textFocused: !!(this.onTextChar && this.textFocus && this.textFocus()),
      textCharsTaken: this.textCharsTaken,
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
      pipelineDrops: this.pipe.pipelineDrops,
      bufferMisses: this.pipe.bufferMisses,
    };
  }
}
