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
import { stepNPCs } from './npc.js';
import { stepSettlement } from './settlement.js';
import { stepSkillUse } from '../character/skilluse.js';

/**
 * S29 / seam S19. The frame the world last did violence. Read off the event bus so it cannot
 * drift from what the trace says happened, and stamped for BOTH sides — being shot at counts.
 */
const HOSTILE_EVENTS = new Set([
  'HIT', 'CRIT_HIT', 'BLOCK', 'PARRY', 'RIPOSTE', 'STAGGER', 'GUARD_BREAK', 'DEATH',
  'IFRAME_NEGATE', 'ACTION_START', 'spell_hit', 'hazard_damage',
]);

function stampHostileAction(sim, bus) {
  const n = bus.count;
  for (let i = 0; i < n; i++) {
    const e = bus.pool[i];
    if (!HOSTILE_EVENTS.has(e.type)) continue;
    // `ACTION_START` covers walking, guard-raising and casting too; only a swing is a hostile
    // action. A CAST is deliberately NOT one — otherwise casting Recall out of combat would
    // stamp the clock and then refuse the next Recall for 300 frames, which is the fence eating
    // its own tail. A cast that CONNECTS emits `spell_hit`, which is on the list.
    if (e.type === 'ACTION_START' && e.tag !== 'attack') continue;
    sim.lastHostileFrame = sim.frame;
    return;
  }
}

/**
 * What a Dres net takes away. Movement is zeroed by `consumeUI` itself; these are the actions
 * a person in a net cannot perform. Attacking is deliberately NOT on the list: you can still
 * swing at whoever is holding the rope, which is what makes the net a fight rather than a
 * cutscene.
 */
const NETTED_DENIED = ['roll', 'sprint', 'jump'];

export function stepOnce(sim, input, combat, bus) {
  armSim();
  try {
    bus.clear();
    // RI-JRN03 §B / RI-JRN04 §C: the hold gates (`G` held 12 f for two_hand, `Mouse1` held
    // 12 f for lock_on, the pad's B tap/hold roll-sprint, the touch button's) are counted in
    // FIXED SIM FRAMES, so they are promoted here — before the latch that consumes them —
    // and not on a render tick whose rate is decoupled from the sim (HARNESS.md R2).
    if (sim.realInput) sim.realInput.tick(sim.frame);
    input.latchForStep(sim.frame);
    sim.input = input;
    // W1-07: the dialogue surface consumes the latched input BEFORE the fight sees it. It is
    // inside the step because a census answer is a simulation event — it emits
    // `creation_field` into the trace and writes the character — and because RI-JRN01 O17's
    // gamepad path has to arrive through exactly the same latch a swing does. While the
    // surface is open it eats `move`, `interact` and `block`, so walking a birthsign list
    // does not also walk the body across the room.
    if (sim.censusDriver) sim.censusDriver(input);
    // W1-21: the HUD's screens take their navigation from the SAME latch, inside the step, for
    // the same two reasons the census surface does — a menu press is a simulation event that
    // has to land on an exact frame, and the gamepad path has to arrive the way a swing does.
    // While a screen is open it eats `menu`, `interact` and the movement axes so that walking
    // an inventory list does not also walk the body across the room. It does NOT eat `roll`,
    // `block` or `light` while a fight is live: RI-UIX03 P6 is explicit that a menu which
    // swallows your dodge is a trap rather than a consequence.
    if (sim.uiDriver) sim.uiDriver(input);
    // W1-07 AR-3: a net that holds you. The restraint is applied to the LATCH, before the
    // fight reads it, so `speed_mps` in the trace really is 0 and the roll really is denied
    // — rather than a `net_behaviour: "capture"` string in an event nobody acts on.
    if (sim.nettedUntil > sim.frame) input.consumeUI(NETTED_DENIED);
    // W1-09 owns steps 1-9 of RI-CMB04 §A's per-frame order; the bridge mirrors the result
    // into the W1-00 state the save, the renderer and elder-souls/trace@1 read.
    stepCombat(sim, input, combat, bus);
    // S29's clock. "Travel is refused ... for 300 frames after the last hostile action", so
    // there has to be a frame stamp on the last hostile action, and it has to be read off what
    // the fight actually emitted rather than off a flag someone remembered to set. Any of these
    // event types on the bus means somebody is still fighting somebody.
    stampHostileAction(sim, bus);
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
    // W1-07 / RI-PRG03: skills improve by use. An OBSERVER over the events the fight just
    // emitted — it cannot reach the hit test, which is seam S1, and it cannot credit an
    // event the fight did not produce.
    // W1-14 round 3: gated on the REGISTER, not on `sim.character`. A state file with no
    // `character` block still has a skill sheet (`Engine._ensureSkillRegister`), and gating on
    // the character object meant skills-by-use was simply switched off in every arena state —
    // which is the state every probe for RI-PRG03 and RI-MAG01 runs in.
    if (sim.encounterData && sim.progression && sim.progression.skills
        && Object.keys(sim.progression.skills).length) stepSkillUse(sim, combat, bus, sim.encounterData);
    // W1-04: the town and its doors. BEFORE the people, because `stepNPCs` decides who is in
    // the room with you by comparing each person's scheduled cell against `sim.env.interior`,
    // and a door taken this frame has to have moved the player before that comparison is made
    // — otherwise everyone is one frame late through every doorway. It reads the same latch a
    // swing does, so `interact` at a door is a simulation event on an exact frame.
    if (sim.settlements) stepSettlement(sim, input, bus);
    // W1-07: the people. After physics so a person turns to face the position the trace
    // reports this frame, before the camera so a dialogue-facing turn is not one frame late.
    if (sim.npcs.length) stepNPCs(sim, bus);
    // W1-15: stealth and crime. AFTER the fight and after physics, so V, the sound radius and
    // every civilian's suspicion are computed from the same positions the trace reports on this
    // frame; BEFORE the camera, so a CHALLENGE latched on frame N appears in frame N's record.
    //
    // It is NOT gated on combat state, and that is the whole of ARBITRATION §1 as amended:
    // "crime, witnesses, bounty and faction standing all keep accruing mid-fight. The world does
    // not pause because you drew a weapon." A `if (!inCombat)` here would be the single
    // optimisation RI-CRM01 names as an automatic 0 on its mid-fight-accrual axis.
    if (sim.stealth) { sim.stealth._frame = sim.frame; sim.stealth.step(sim, input, bus); }
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
