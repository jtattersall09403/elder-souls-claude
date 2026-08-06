// The input pipeline — one latch, consumed by exactly one fixed step.
//
// Owners: RI-JRN03 (desktop path, action set), RI-CMB11 (latency and edge semantics),
// RI-CMB09 §1 (the 8 f@60 buffer), HARNESS.md §4 (scripted input).
//
// Shape:
//
//   scripted events ─┐
//                    ├─► pending edge queue ─► latchForStep() ─► one sim step reads it
//   real DOM events ─┘        (per rAF)            (per step)
//
// Rules implemented here, each with the item that requires it:
//   * frames in a scripted script are RELATIVE to the frame at which queueInputs() was
//     called (HARNESS.md §4) — warm-up frames never shift a scenario;
//   * an unknown button throws (HARNESS.md §4, RI-MTH01 M6);
//   * a press and release in the same step delivers press now, release next step
//     (RI-CMB11 §3) so an edge can never be swallowed;
//   * exactly one action buffers, for the last 8 f@60 of a recovery; a later press
//     overwrites it; a press outside the window is dropped, not queued (RI-CMB09 §1);
//   * held actions are released wholesale on blur / visibility / pointer-lock loss
//     (RI-JRN03 KB7, KB9, PL4) — `releaseAll()`.
//
// Allocation discipline (RI-PLT01 P4): held/pressed/released are integer bitmasks and the
// per-step state is a single reused object. Nothing here allocates in steady state.
'use strict';

import { ACTIONS, BIT, bitOf, maskToNames } from './actions.js';

export const BUFFER_FRAMES = 8;      // f@60 — RI-CMB09 §1, excluded from the S22 rebase.

export class InputPipeline {
  constructor() {
    // Latched state consumed by the current sim step.
    this.held = 0;
    this.pressed = 0;
    this.released = 0;
    this.moveX = 0; this.moveY = 0;
    this.lookX = 0; this.lookY = 0;

    // Edges received since the last step but not yet latched (real-input path).
    this.pendingPress = 0;
    this.pendingRelease = 0;
    this.deferredRelease = 0;   // press+release inside one step: release lands next step

    // Scripted timeline.
    this.script = [];
    this.scriptIdx = 0;
    this.scriptBase = 0;

    // The single-slot action buffer.
    this.bufferedAction = 0;
    this.bufferedAtFrame = -1;

    this.droppedInputs = 0;
    this.catchupSteps = 1;
    this.edges = [];            // A-JRN7 / RI-CMB11: {button, edge, recv_step, attributed_step}
    this.dispatchLag = 0;
    this._names = [];
    this._names2 = [];
  }

  reset(frame = 0) {
    this.held = this.pressed = this.released = 0;
    this.moveX = this.moveY = this.lookX = this.lookY = 0;
    this.pendingPress = this.pendingRelease = this.deferredRelease = 0;
    this.script.length = 0; this.scriptIdx = 0; this.scriptBase = frame;
    this.bufferedAction = 0; this.bufferedAtFrame = -1;
    this.droppedInputs = 0; this.catchupSteps = 1;
    this.edges.length = 0; this.dispatchLag = 0;
  }

  // ---- scripted path (harness mode) -------------------------------------------------

  /**
   * @param {Array<{f:number,press?:string[],release?:string[],move?:number[],look?:number[]}>} script
   * @param {number} frame the frame at which the call is made; script frames are relative to it
   * @returns {number} number of events accepted
   */
  queueInputs(script, frame) {
    if (!Array.isArray(script)) throw new Error('queueInputs: expected an array of input events');
    for (const e of script) {
      if (!e || typeof e !== 'object') throw new Error('queueInputs: each event must be an object');
      if (!Number.isInteger(e.f) || e.f < 0) throw new Error(`queueInputs: event frame must be a non-negative integer (got ${JSON.stringify(e.f)})`);
      for (const b of e.press || []) bitOf(b);      // throws on an unknown button
      for (const b of e.release || []) bitOf(b);
      if (e.move && (!Array.isArray(e.move) || e.move.length !== 2)) throw new Error('queueInputs: move must be [x,y]');
      if (e.look && (!Array.isArray(e.look) || e.look.length !== 2)) throw new Error('queueInputs: look must be [x,y]');
    }
    this.script = script.slice().sort((a, b) => a.f - b.f);
    this.scriptIdx = 0;
    this.scriptBase = frame;
    return this.script.length;
  }

  clearInputs(frame) {
    this.script.length = 0; this.scriptIdx = 0; this.scriptBase = frame;
    this.releaseAll();
    this.moveX = this.moveY = this.lookX = this.lookY = 0;
    this.bufferedAction = 0; this.bufferedAtFrame = -1;
    return true;
  }

  // ---- real path (play / play-instrumented) -----------------------------------------

  /** An edge from the real DOM path, or from the gamepad shim. Latched, not applied. */
  edgeDown(name) {
    const b = bitOf(name);
    if (this.pendingPress & b) return;             // auto-repeat: KB2, ignored
    this.pendingPress |= b;
  }

  edgeUp(name) {
    const b = bitOf(name);
    if ((this.pendingPress & b) && !(this.held & b)) this.deferredRelease |= b;  // RI-CMB11 §3
    else this.pendingRelease |= b;
  }

  setMove(x, y) { this.moveX = x; this.moveY = y; }
  /** Accumulated pointer delta, consumed by the next fixed step (RI-JRN03 PL6). */
  addLook(dx, dy) { this.lookX += dx; this.lookY += dy; }
  setLook(x, y) { this.lookX = x; this.lookY = y; }

  /** RI-JRN03 KB7/KB9/PL4: every held action released, this frame. */
  releaseAll() {
    this.pendingRelease |= this.held | this.pendingPress;
    this.pendingPress = 0;
    this.moveX = 0; this.moveY = 0;
    return true;
  }

  // ---- per-step latch ----------------------------------------------------------------

  /**
   * Called once, at the top of each fixed simulation step. Applies scripted events due on
   * this frame, then the real-path edges received since the last step.
   * @param {number} frame the frame index about to be simulated
   */
  latchForStep(frame) {
    this.pressed = 0;
    this.released = 0;
    if (this.edges.length > 64) this.edges.length = 0;

    // 1. scripted events for this frame (relative to the queueInputs call).
    while (this.scriptIdx < this.script.length && this.script[this.scriptIdx].f + this.scriptBase === frame) {
      const e = this.script[this.scriptIdx++];
      if (e.move) { this.moveX = e.move[0]; this.moveY = e.move[1]; }
      if (e.look) { this.lookX = e.look[0]; this.lookY = e.look[1]; }
      if (e.press) for (let i = 0; i < e.press.length; i++) this.pendingPress |= BIT[e.press[i]];
      if (e.release) for (let i = 0; i < e.release.length; i++) this.pendingRelease |= BIT[e.release[i]];
    }
    // Any scripted event whose frame has already gone past is a dropped input, loudly counted.
    while (this.scriptIdx < this.script.length && this.script[this.scriptIdx].f + this.scriptBase < frame) {
      this.scriptIdx++;
      this.droppedInputs++;
    }

    // 2. real-path edges.
    const newPress = this.pendingPress & ~this.held;
    this.pressed = newPress;
    this.held |= this.pendingPress;
    this.released = this.pendingRelease & this.held;
    this.held &= ~this.pendingRelease;
    this.pendingPress = 0;
    this.pendingRelease = this.deferredRelease;
    this.deferredRelease = 0;

    if (this.pressed) {
      for (let i = 0; i < ACTIONS.length; i++) {
        if (this.pressed & (1 << i)) this.edges.push({ button: ACTIONS[i], edge: 'down', recv_step: frame, attributed_step: frame });
      }
    }
    return this.pressed;
  }

  // ---- the single-slot buffer --------------------------------------------------------

  /**
   * @param {number} frame current frame
   * @param {number} framesLeft frames until the character is actionable again
   * @returns {boolean} whether the press was latched
   */
  tryBuffer(actionBit, frame, framesLeft) {
    if (framesLeft > BUFFER_FRAMES) { this.droppedInputs++; return false; }  // dropped, not queued
    this.bufferedAction = actionBit;   // a later press overwrites: exactly one action buffers
    this.bufferedAtFrame = frame;
    return true;
  }

  takeBuffered() {
    const a = this.bufferedAction;
    this.bufferedAction = 0;
    this.bufferedAtFrame = -1;
    return a;
  }

  // ---- observation (A-JRN6) -----------------------------------------------------------

  heldNames() { return maskToNames(this.held, this._names); }
  pressedNames() { return maskToNames(this.pressed, this._names2); }
}
