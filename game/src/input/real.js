// The real desktop input path — RI-JRN03 §C/§D.
//
// Connected ONLY in mode 'play' and 'play-instrumented'. In 'harness' mode every listener
// below is detached, because HARNESS.md R4 says input arrives exclusively via queueInputs()
// and a stray keystroke in CI must never enter a trace.
//
// Every hazard in RI-JRN03 §C/§D is handled here and each line names its rule.
'use strict';

import { DEFAULT_BINDINGS, MOVE_BINDINGS, PREVENT_DEFAULT_CODES, buildControlMap, GAMEPAD_BINDINGS } from './bindings.js';
import { shapeLookStick, moveStickMagnitude } from './pipeline.js';

const MOVE_CODES = Object.create(null);
for (const [dir, codes] of Object.entries(MOVE_BINDINGS)) for (const c of codes) MOVE_CODES[c] = dir;

export class RealInput {
  /**
   * @param {InputPipeline} pipe
   * @param {HTMLCanvasElement} canvas
   */
  constructor(pipe, canvas) {
    this.pipe = pipe;
    this.canvas = canvas;
    this.bindings = JSON.parse(JSON.stringify(DEFAULT_BINDINGS));
    this.controlMap = buildControlMap(this.bindings);
    this.attached = false;
    this.pointerLocked = false;
    this.hasFocus = true;
    this.activeDevice = 'keyboard';
    // RI-CAM02 §A: 0.120 °/px horizontal, 0.100 °/px vertical, LINEAR, and no mouse
    // acceleration at any sensitivity setting. The two axes differ; one shared constant
    // was a 20% over-rotation on pitch against a hard clamp.
    this.lookSensitivity = 0.120;   // degrees per pixel, yaw
    this.lookSensitivityY = 0.100;  // degrees per pixel, pitch
    this.lookExponent = 1.0;
    this.moveDirs = { forward: false, back: false, left: false, right: false };
    this._handlers = [];
    // ---- gamepad (RI-JRN04 §A; A-JRN2's shim reads the same state) --------------------
    // The user tests on a phone with a GameSir X2s Type-C clamped to it. That controller
    // reports as a standard-mapping Gamepad, so the standard mapping IS the binding table
    // and there is no per-pad quirk list to maintain.
    this.gamepadIndex = null;
    this.gamepadId = null;
    this.padHeld = 0;               // bitmask over GAMEPAD_BINDINGS' button indices
    this.padAxes = [0, 0, 0, 0];
    this.padConnected = false;
    this.padPollCount = 0;
    // A shim (a test, or CDP) can push a synthetic pad state through `pushGamepadState`.
    this.syntheticPad = null;
    /** Text typed into a dialogue surface. Set by the engine; not part of the action set. */
    this.onTextChar = null;
  }

  /**
   * Poll the pad. Called once per rAF from the engine's render loop in play mode, and once
   * per `stepFrames` batch by the harness gamepad shim, so a scripted gamepad run and a real
   * one go through the identical code path.
   */
  pollGamepad() {
    const pads = this.syntheticPad ? [this.syntheticPad]
      : (typeof navigator !== 'undefined' && navigator.getGamepads ? navigator.getGamepads() : []);
    let pad = null;
    for (const p of pads) { if (p && p.connected !== false) { pad = p; break; } }
    if (!pad) {
      if (this.padConnected) { this.padConnected = false; this._releaseEverything(); }
      return null;
    }
    this.padPollCount++;
    if (!this.padConnected) {
      this.padConnected = true;
      this.gamepadIndex = pad.index === undefined ? 0 : pad.index;
      this.gamepadId = pad.id || 'standard gamepad';
      this.activeDevice = 'gamepad';
      this.onDeviceChange && this.onDeviceChange('gamepad');
    }
    // Buttons: edges only, so a held button is one press exactly as a key is.
    for (const [action, idx] of Object.entries(GAMEPAD_BINDINGS.buttons)) {
      const b = pad.buttons[idx];
      const down = !!(b && (b.pressed || (typeof b === 'number' ? b > 0.5 : b.value > 0.5)));
      const bit = 1 << idx;
      const was = (this.padHeld & bit) !== 0;
      if (down && !was) { this.padHeld |= bit; this.activeDevice = 'gamepad'; this.pipe.edgeDown(action); }
      else if (!down && was) { this.padHeld &= ~bit; this.pipe.edgeUp(action); }
    }
    // D-pad, which the standard mapping puts on buttons 12-15, drives `move` so that every
    // list in the game can be walked with a thumb.
    const dpad = {
      up: !!(pad.buttons[12] && pad.buttons[12].pressed),
      down: !!(pad.buttons[13] && pad.buttons[13].pressed),
      left: !!(pad.buttons[14] && pad.buttons[14].pressed),
      right: !!(pad.buttons[15] && pad.buttons[15].pressed),
    };
    let mx = (pad.axes[0] || 0), my = -(pad.axes[1] || 0);
    if (moveStickMagnitude(mx, my) === 0) { mx = 0; my = 0; }
    if (dpad.left) mx = -1; else if (dpad.right) mx = 1;
    if (dpad.down) my = -1; else if (dpad.up) my = 1;
    const m = Math.hypot(mx, my);
    this.pipe.setMove(m > 1 ? mx / m : mx, m > 1 ? my / m : my);
    // Right stick is the camera, through RI-CAM02 §A's shaping — the same curve the harness
    // `look_stick` path uses, so a pad and a scripted stick produce identical degrees.
    const d = shapeLookStick(pad.axes[2] || 0, pad.axes[3] || 0);
    if (d[0] || d[1]) this.pipe.addLook(d[0], d[1]);
    this.padAxes = [pad.axes[0] || 0, pad.axes[1] || 0, pad.axes[2] || 0, pad.axes[3] || 0];
    return { id: this.gamepadId, buttons: this.padHeld, axes: this.padAxes.slice() };
  }

  /** A-JRN2: push a synthetic pad state. `null` disconnects it. */
  pushGamepadState(state) {
    this.syntheticPad = state
      ? {
        index: 0, id: state.id || 'shim standard gamepad', connected: true, mapping: 'standard',
        buttons: Array.from({ length: 17 }, (_, i) => ({ pressed: !!(state.buttons || [])[i], value: (state.buttons || [])[i] ? 1 : 0 })),
        axes: [0, 1, 2, 3].map((i) => Number((state.axes || [])[i] || 0)),
      }
      : null;
    return this.pollGamepad();
  }

  attach() {
    if (this.attached) return;
    this.attached = true;
    const on = (target, type, fn, opts) => {
      target.addEventListener(type, fn, opts);
      this._handlers.push([target, type, fn, opts]);
    };

    on(window, 'keydown', (e) => {
      if (e.repeat) return;                                     // KB2: auto-repeat ignored
      if (PREVENT_DEFAULT_CODES.has(e.code)) e.preventDefault(); // KB4/KB5/KB6
      if (e.ctrlKey || e.altKey || e.metaKey) return;            // KB3: never bound
      this.activeDevice = 'keyboard';
      const dir = MOVE_CODES[e.code];
      if (dir) { this.moveDirs[dir] = true; this._pushMove(); return; }
      const action = this.controlMap[e.code];
      if (action) { this.pipe.edgeDown(action); return; }
      // Text entry into a dialogue surface. NOT a button — HARNESS.md §4's action set stays
      // closed, and the surface is completable without ever reaching this path (RI-JRN01
      // O17), so nothing here is load-bearing for parity.
      if (this.onTextChar) {
        if (e.key === 'Backspace') this.onTextChar('\b');
        else if (e.key && e.key.length === 1 && /[\p{L}\p{N}\-' .]/u.test(e.key)) this.onTextChar(e.key);
      }
    });

    on(window, 'keyup', (e) => {
      const dir = MOVE_CODES[e.code];
      if (dir) { this.moveDirs[dir] = false; this._pushMove(); return; }
      const action = this.controlMap[e.code];
      if (action) this.pipe.edgeUp(action);
    });

    on(this.canvas, 'mousedown', (e) => {
      e.preventDefault();
      this.activeDevice = 'mouse';
      const action = this.controlMap['Mouse' + e.button];
      if (action) this.pipe.edgeDown(action);
      if (!this.pointerLocked) this.requestPointerLock();        // PL1/PL3: retry on a click
    });
    on(window, 'mouseup', (e) => {
      const action = this.controlMap['Mouse' + e.button];
      if (action) this.pipe.edgeUp(action);
    });

    // PL9: a context menu over a boss fight is a lost run.
    on(this.canvas, 'contextmenu', (e) => e.preventDefault());

    on(window, 'mousemove', (e) => {
      if (!this.pointerLocked) return;
      // PL6/PL7: movementX/Y only, coalesced where available, accumulated per rAF and
      // consumed by the next fixed step. Never client coordinates, never per rendered frame.
      const events = (typeof e.getCoalescedEvents === 'function') ? e.getCoalescedEvents() : null;
      let dx = 0, dy = 0;
      if (events && events.length) { for (const ev of events) { dx += ev.movementX; dy += ev.movementY; } }
      else { dx = e.movementX; dy = e.movementY; }
      this.pipe.addLook(dx * this.lookSensitivity, dy * this.lookSensitivityY);
    });

    on(this.canvas, 'wheel', (e) => {
      e.preventDefault();
      const action = this.controlMap[e.deltaY < 0 ? 'WheelUp' : 'WheelDown'];
      if (action) { this.pipe.edgeDown(action); this.pipe.edgeUp(action); }
    }, { passive: false });

    // PL2/PL4: Escape always exits pointer lock and the page cannot prevent it, so lock
    // exit IS the menu-open signal, and every held action is released on that frame.
    on(document, 'pointerlockchange', () => {
      this.pointerLocked = document.pointerLockElement === this.canvas;
      if (!this.pointerLocked) { this.pipe.releaseAll(); this.onLockLost && this.onLockLost(); }
    });
    on(document, 'pointerlockerror', () => { this.onLockError && this.onLockError(); }); // PL5

    // KB7/KB9: focus loss with keys held. The single most common browser-game input bug.
    on(window, 'blur', () => { this.hasFocus = false; this._releaseEverything(); });
    on(window, 'focus', () => { this.hasFocus = true; });
    on(document, 'visibilitychange', () => {
      if (document.hidden) { this.hasFocus = false; this._releaseEverything(); }
    });
  }

  detach() {
    for (const [t, type, fn, opts] of this._handlers) t.removeEventListener(type, fn, opts);
    this._handlers.length = 0;
    this.attached = false;
    this._releaseEverything();
  }

  _releaseEverything() {
    this.moveDirs.forward = this.moveDirs.back = this.moveDirs.left = this.moveDirs.right = false;
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
    // PL1: requested on the same gesture that starts the game. No "click to play" surface.
    try { this.canvas.requestPointerLock && this.canvas.requestPointerLock(); } catch { /* PL5 */ }
  }

  /** A-JRN6 */
  getInputState() {
    return {
      pointerLocked: this.pointerLocked,
      hasFocus: this.hasFocus,
      activeDevice: this.activeDevice,
      deviceClass: this.activeDevice === 'gamepad' ? 'gamepad' : 'desktop',
      gamepad: {
        connected: this.padConnected, id: this.gamepadId, index: this.gamepadIndex,
        polls: this.padPollCount, axes: this.padAxes.slice(),
        bindings: GAMEPAD_BINDINGS,
      },
      held: this.pipe.heldNames().slice(),
      bindings: this.bindings,
      droppedInputs: this.pipe.droppedInputs,
    };
  }
}
