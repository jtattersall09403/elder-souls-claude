// One fixed simulation step. Takes no time argument, by construction.
//
// Order matters and is fixed:
//   1. clear the event pool for this frame
//   2. latch input for this frame (scripted events due now, plus real-path edges)
//   3. player
//   4. entities, in eid order (HARNESS.md D7)
//   5. camera — inside the step, per RI-CAM06 §A
//   6. frame++
//
// The determinism guard is armed for exactly the duration of steps 2–5, so a Math.random(),
// Date.now(), performance.now() or `new Date()` anywhere beneath here throws immediately
// instead of quietly desynchronising a trace three thousand frames later.
'use strict';

import { armSim, disarmSim } from '../core/guards.js';
import { quantiseSaveGrid } from './state.js';
import { stepPlayer } from './player.js';
import { stepEntities } from './entities.js';
import { stepCamera } from './camera.js';

export function stepOnce(sim, input, moves, bus) {
  armSim();
  try {
    bus.clear();
    input.latchForStep(sim.frame);
    sim.input = input;
    stepPlayer(sim, input, moves, bus);
    stepEntities(sim, bus);
    stepCamera(sim);
    // The state the frame ends in must be a state the save can hold exactly (RI-JRN05 §C
    // rule 3 vs HF1 — see sim/state.js quantiseSaveGrid). Allocation-free.
    quantiseSaveGrid(sim);
    sim.frame++;
  } finally {
    disarmSim();
  }
}
