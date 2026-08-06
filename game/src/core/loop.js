// The fixed-step loop — HARNESS.md R2/R3, RI-PLT01 §C.4.
//
// The simulation advances in integer steps of exactly 1/60 s. There is no deltaTime
// anywhere downstream of here: `step()` takes no arguments. Simulation time is derived
// from the integer frame (`frame * 1000/60`), never accumulated, so batch size cannot
// change it (RI-MTH02 "How we lose" #6).
//
// Two modes:
//   'play'              — requestAnimationFrame drives the sim through a bounded
//                         accumulator: at most MAX_CATCHUP steps per rAF, then the
//                         remaining time is DROPPED. Never a larger step. (R3)
//   'harness'           — requestAnimationFrame renders and nothing else. The sim advances
//                         only inside __HARNESS.stepFrames(). (R3 of HARNESS.md §2)
//   'play-instrumented' — real DOM input is connected, but the clock is still harness-driven
//                         (A-JRN1). Behaves like 'harness' for stepping purposes.
'use strict';

import { wallNow } from './guards.js';

export const FIXED_HZ = 60;
export const STEP_MS = 1000 / FIXED_HZ;
export const MAX_CATCHUP = 5;

export class FixedLoop {
  /**
   * @param {() => void} step   one fixed simulation step. Takes no time argument, by design.
   * @param {() => void} render draws the current sim state. May be called at any rate.
   */
  constructor(step, render) {
    this.step = step;
    this.render = render;
    this.mode = 'harness';
    this.accumulatorMs = 0;
    this.lastWallMs = 0;
    this.renderRateHz = 60;      // A-JRN11: 0 disables rendering entirely
    this.lastRenderMs = -1e9;
    this.rafHandle = 0;
    this.running = false;
    this.stats = {
      simStepsTotal: 0,
      rafTicks: 0,
      rendersTotal: 0,
      catchupDroppedMs: 0,
      catchupClamps: 0,
      lastStepMs: 0,
      stepMsSamples: [],          // ring, bounded; see recordStepMs
    };
    this._tick = this._tick.bind(this);
  }

  setMode(mode) {
    if (mode !== 'play' && mode !== 'harness' && mode !== 'play-instrumented') {
      throw new Error(`setMode: unknown mode '${mode}'. Legal: play | harness | play-instrumented`);
    }
    this.mode = mode;
    this.accumulatorMs = 0;
    this.lastWallMs = wallNow();
    return mode;
  }

  /** True when requestAnimationFrame is allowed to advance the simulation. */
  get rafDrivesSim() { return this.mode === 'play'; }

  setRenderRate(hz) {
    const v = Number(hz);
    if (!Number.isFinite(v) || v < 0) throw new Error(`setRenderRate: hz must be a finite number >= 0 (got ${hz})`);
    this.renderRateHz = v;
    return v;
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.lastWallMs = wallNow();
    this.rafHandle = requestAnimationFrame(this._tick);
  }

  stop() {
    this.running = false;
    if (this.rafHandle) cancelAnimationFrame(this.rafHandle);
    this.rafHandle = 0;
  }

  _tick() {
    if (!this.running) return;
    this.rafHandle = requestAnimationFrame(this._tick);
    this.stats.rafTicks++;
    const now = wallNow();

    if (this.rafDrivesSim) {
      let dt = now - this.lastWallMs;
      if (dt < 0) dt = 0;
      if (dt > 1000) dt = 1000;             // tab was backgrounded; do not try to catch up an hour
      this.lastWallMs = now;
      this.accumulatorMs += dt;
      let n = 0;
      while (this.accumulatorMs >= STEP_MS && n < MAX_CATCHUP) {
        this.accumulatorMs -= STEP_MS;
        this.stepOnce();
        n++;
      }
      if (this.accumulatorMs >= STEP_MS) {
        // R3: bounded catch-up. Drop the surplus rather than take a bigger step.
        this.stats.catchupDroppedMs += this.accumulatorMs;
        this.stats.catchupClamps++;
        this.accumulatorMs = 0;
      }
    } else {
      this.lastWallMs = now;
    }

    this.maybeRender(now);
  }

  maybeRender(now = wallNow()) {
    if (this.renderRateHz === 0) return false;
    const minGap = 1000 / this.renderRateHz;
    if (now - this.lastRenderMs < minGap - 0.5) return false;
    this.lastRenderMs = now;
    this.renderNow();
    return true;
  }

  renderNow() {
    this.stats.rendersTotal++;
    this.render();
  }

  /** One fixed step, timed. The timing read happens OUTSIDE the guarded window. */
  stepOnce() {
    const t0 = wallNow();
    this.step();
    const t1 = wallNow();
    this.stats.simStepsTotal++;
    this.stats.lastStepMs = t1 - t0;
    const s = this.stats.stepMsSamples;
    if (s.length >= 8192) s.length = 0;
    s.push(this.stats.lastStepMs);
  }

  /** A-JRN11: block the main thread, to exercise the catch-up bound (RI-PLT01 M8). */
  stallMainThread(ms) {
    const until = wallNow() + Number(ms);
    // Deliberate busy-wait: a timer would not block the thread, which is the point.
    while (wallNow() < until) { /* spin */ }
    return true;
  }
}
