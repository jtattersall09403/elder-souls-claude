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
import { stepCamera } from './camera.js';
import { stepRoute } from './route.js';
import { stepCombat } from './combat-bridge.js';
import { stepWorldCollision } from './world-collision.js';
import { stepEncounters } from '../character/encounter.js';

export function stepOnce(sim, input, combat, bus) {
  armSim();
  try {
    bus.clear();
    input.latchForStep(sim.frame);
    sim.input = input;
    // W1-09 owns steps 1-9 of RI-CMB04 §A's per-frame order; the bridge mirrors the result
    // into the W1-00 state the save, the renderer and elder-souls/trace@1 read.
    stepCombat(sim, input, combat, bus);
    // The pivot must read the POST-physics controller position (RI-CAM01 §A), so the body is
    // pushed out of the world between the fight and the camera, never after it.
    stepWorldCollision(sim, combat);
    // The province's claim on the player's Y — standing on the terrain, and the water band's
    // speed retraction — is PHYSICS, and RI-CAM01 §A requires the pivot to read the character
    // position "once, after locomotion resolves". It used to run in Engine._afterStep(), i.e.
    // AFTER the camera had already placed the pivot and AFTER the frame record was built, with
    // two consequences: the camera followed a Y that was one frame stale on every slope, and
    // `camera.pivot.y − player.pos.y` in the trace was not 1.55 m, so RI-CAM01 M1's own
    // measurable was wrong in the artifact a critic reads. It is now inside the step, in the
    // physics slot, ahead of the camera. It allocates nothing, draws no RNG and reads no clock,
    // which is what makes it safe under the armed determinism guard.
    if (sim.settleWorld) sim.settleWorld();
    // W1-07 AR-3: race-conditioned encounter opening. Runs AFTER the fight and after physics
    // so it reads the same positions the trace reports on this frame, and BEFORE the camera so
    // an aggro latch on frame N is visible in frame N's record.
    if (sim.character && sim.encounterData) stepEncounters(sim, combat, bus, sim.encounterData);
    // The scripted navmesh-spine traversal (RI-CAM01 M2, RI-CAM05 M4/M5) writes the controller
    // in the same slot world collision does — after physics, before the camera — so the pivot
    // reads a post-physics position exactly as RI-CAM01 §A requires, and the vertical spring
    // is never reset mid-route the way a per-frame teleport would reset it.
    if (sim.route) stepRoute(sim);
    stepCamera(sim);
    // The state the frame ends in must be a state the save can hold exactly (RI-JRN05 §C
    // rule 3 vs HF1 — see sim/state.js quantiseSaveGrid). Allocation-free.
    quantiseSaveGrid(sim);
    sim.frame++;
  } finally {
    disarmSim();
  }
}
