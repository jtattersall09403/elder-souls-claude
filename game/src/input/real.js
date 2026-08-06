// The real desktop input path — RI-JRN03 §C/§D.
//
// Connected ONLY in mode 'play' and 'play-instrumented'. In 'harness' mode every listener
// below is detached, because HARNESS.md R4 says input arrives exclusively via queueInputs()
// and a stray keystroke in CI must never enter a trace.
//
// Every hazard in RI-JRN03 §C/§D is handled here and each line names its rule.
'use strict';

import { DEFAULT_BINDINGS, MOVE_BINDINGS, PREVENT_DEFAULT_CODES, buildControlMap } from './bindings.js';

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
    this.lookSensitivity = 0.12;   // degrees per pixel, linear. PL8: no hidden acceleration.
    this.lookExponent = 1.0;
    this.moveDirs = { forward: false, back: false, left: false, right: false };
    this._handlers = [];
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
      if (action) this.pipe.edgeDown(action);
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
      this.pipe.addLook(dx * this.lookSensitivity, dy * this.lookSensitivity);
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
      deviceClass: 'desktop',
      held: this.pipe.heldNames().slice(),
      bindings: this.bindings,
      droppedInputs: this.pipe.droppedInputs,
    };
  }
}
