// The whole mutable simulation state, in one place.
//
// Everything that is not in here is either derived (the render scene) or is not simulation
// (perf counters, storage). That property is what makes the save manifest checkable: the
// save is a projection of this object and RI-JRN05 M4 is a set difference against it.
//
// Allocation discipline (RI-PLT01 P4): every object and array below is created once, at
// reset(), and mutated in place for the rest of the run. The simulation step allocates
// nothing; the trace record — which does allocate — is built outside the step by
// sim/record.js and is excluded from P4 by name.
'use strict';

import { rng } from '../core/rng.js';
import { STEP_MS } from '../core/loop.js';

export const PLAYER_CONST = {
  // Locomotion — RI-WLD01 §, seam S17. Metres per second; per-frame values are derived
  // from these by dividing by 60, never by a deltaTime.
  walk_mps: 2.0,
  jog_mps: 3.2,
  sprint_mps: 5.0,
  // Stamina — RI-CMB03 §A. Endurance 20 build.
  stamina_max: 120,
  stamina_regen_per_frame: 0.75,        // 45.0/s
  stamina_regen_delay_frames: 42,       // 0.700 s
  stamina_regen_guard_mult: 0.20,
  sprint_cost_per_frame: 0.15,          // 9.0/s
  hp_max: 500,
  poise_max: 30,
  estus_max: 5,
  turn_rate_dps: 480,
};

/** Player animation/action states. Closed set; an unknown value is fail-closed. */
export const PLAYER_STATES = [
  'IDLE', 'WALK', 'RUN', 'SPRINT', 'ATTACK', 'ROLL', 'BACKSTEP', 'BLOCK',
  'PARRY', 'HEAL', 'STAGGER', 'DEATH',
];

/** HARNESS.md §5: phase ∈ none|windup|active|recovery|turn|hitstun */
export const PHASES = ['none', 'windup', 'active', 'recovery', 'turn', 'hitstun'];

export function makePlayer() {
  return {
    pos: [0, 0, 0],
    vel: [0, 0, 0],
    yaw: 0,
    state: 'IDLE',
    anim: 'idle',
    animFrame: 0,
    animLen: 1,
    phase: 'none',
    move: null,                 // the id of the move currently executing
    moveData: null,
    hp: PLAYER_CONST.hp_max,
    hpMax: PLAYER_CONST.hp_max,
    stamina: PLAYER_CONST.stamina_max,
    staminaMax: PLAYER_CONST.stamina_max,
    regenBlockUntil: 0,
    poise: PLAYER_CONST.poise_max,
    poiseMax: PLAYER_CONST.poise_max,
    iframe: false,
    iframeKind: null,
    grounded: true,
    estus: PLAYER_CONST.estus_max,
    lockOn: null,
    hitboxes: [],
    moveDirDeg: 0,              // RI-CAM02: requested field, the world-space travel bearing
    speedMps: 0,
    equipLoadPct: 24.0,
    rollClass: 'LIGHT',
    actionableAt: 0,            // frame at which the current animation releases control
    // Identifies the current swing so one hitbox hits one entity once. It was the absolute
    // frame the swing started on, which does not survive a save: loadState() resets the
    // frame to 0, so the stamp came back negative, `anim_stamp_ago_frames` re-serialised as
    // its own "never swung" sentinel (-1), and the round-trip hash differed — RI-JRN05 M1,
    // invisible to every instrument that round-tripped an idle world. A monotonic counter
    // has no frame arithmetic in it and therefore no sentinel to collide with.
    swingSeq: 0,
  };
}

export function makeCamera() {
  return {
    mode: 'free',               // free | locked | fog_gate | death | dialogue
    pivot: [0, 1.55, 0],
    pos: [0, 1.55, -3.6],
    yaw: 0,
    pitch: -8,
    fov: 60,
    dist: 3.6,
    distTarget: 3.6,
    shakeYaw: 0,
    shakePitch: 0,
    shakeUntil: 0,
    shakeAmp: 0,
    hitstop: false,
    clipThrough: false,
    override: null,             // set by __HARNESS.camera(); suspends the rig (see sim/camera.js)
  };
}

export function makeEnvironment() {
  return {
    timeOfDay: 12.0,
    weather: 'clear',
    dayCount: 0,
    region: 'thornmarsh',
    interior: null,
    wallClockOffsetMs: 0,       // A-JRN10 advanceWallClock; never read by the sim
  };
}

/** World mutation — RI-JRN05 §B "World". Present in wave 1 as real, saved, empty-by-default sets. */
export function makeWorldMutation() {
  return {
    containersEmptied: [],      // stable ids, sorted
    doorsUnlocked: [],
    shortcutsOpened: [],
    itemsTaken: [],
    droppedItems: [],           // [{id, pos:[x,y,z]}]
    npcsDead: [],
    enemiesDeadUntilRest: [],
    fogGatesPassed: [],
  };
}

export function makeProgression() {
  return {
    level: 1,
    soulsHeld: 0,
    soulsSpent: 0,
    attributes: { vigour: 10, endurance: 20, strength: 12, dexterity: 12, intelligence: 10, faith: 10 },
    skills: {},                 // id -> {value, useProgress}
    hearthsDiscovered: [],
    hearthLastRested: null,
    upgrades: {},
  };
}

export function makeQuestState() {
  return {
    quests: {},                 // id -> {stage, flags{}, branch, failed}
    completed: [],
    journal: [],                // append-only, ordered: [{n, date, quest, text}]
    flags: {},
    topicsKnown: [],
    dispositions: {},
    factions: {},
    crime: { bounty: {}, witnesses: [], stolen: [], hunting: [] },
    afflictions: [],
    travel: { nodesVisited: [], mark: null },
    death: { bloodstain: null },
  };
}

/**
 * THE SAVE GRID — RI-JRN05 §C rule 3, made an invariant of the simulation rather than a
 * property of the serialiser.
 *
 * The item is explicit: floats are "rounded to 6 decimal places AT SERIALISATION and
 * compared at that precision", because a diff that fires on the 15th decimal is a bad
 * instrument. Taken alone that makes the save a LOSSY projection — and the same item's HF1
 * forbids ANY post-load trace divergence. Both rules can hold at once only if the simulation
 * never holds a float the save cannot represent, so it doesn't: every per-step float the
 * save carries is snapped to the 1 µm grid at the bottom of the step.
 *
 * This was not a theoretical problem. Before it, `state-diff.mjs` on `sv1-midquest` had the
 * state round-trip exactly at 6 dp and the 600-frame trace still diverge on
 * `enemies[].dist_m` (2 frames) and `camera.pos` (1 frame): a 1e-7 m difference at the save
 * point, carried 600 frames, crossing a 4-dp rounding boundary in the record. That is
 * RI-JRN05 "how we lose" #6 — float drift — arriving by the back door the rounding rule
 * itself opened.
 *
 * Allocation-free by construction (RI-PLT01 P4): fixed field list, indexed loops, no
 * Object.keys, no closures. The containers the fixed step never mutates — inventory, skills,
 * the bloodstain, dropped items — are snapped by `quantiseColdState()` at state-set time,
 * where allocating is free.
 */
const GRID = 1e6;
function q6(v) { return Math.round(v * GRID) / GRID; }

export function quantiseSaveGrid(sim) {
  const p = sim.player, c = sim.camera;
  p.pos[0] = q6(p.pos[0]); p.pos[1] = q6(p.pos[1]); p.pos[2] = q6(p.pos[2]);
  p.yaw = q6(p.yaw); p.moveDirDeg = q6(p.moveDirDeg); p.speedMps = q6(p.speedMps);
  p.hp = q6(p.hp); p.stamina = q6(p.stamina); p.poise = q6(p.poise);
  p.equipLoadPct = q6(p.equipLoadPct);
  c.yaw = q6(c.yaw); c.pitch = q6(c.pitch); c.dist = q6(c.dist); c.shakeAmp = q6(c.shakeAmp);
  sim.env.timeOfDay = q6(sim.env.timeOfDay);
  for (let i = 0; i < sim.entities.length; i++) {
    const e = sim.entities[i];
    e.pos[0] = q6(e.pos[0]); e.pos[1] = q6(e.pos[1]); e.pos[2] = q6(e.pos[2]);
    e.anchor[0] = q6(e.anchor[0]); e.anchor[1] = q6(e.anchor[1]); e.anchor[2] = q6(e.anchor[2]);
    e.yaw = q6(e.yaw); e.yawRate = q6(e.yawRate); e.speed = q6(e.speed);
    e.hp = q6(e.hp); e.poise = q6(e.poise);
  }
}

/** The rest of the grid, for the containers no fixed step touches. May allocate. */
export function quantiseColdState(sim) {
  quantiseSaveGrid(sim);
  for (const i of sim.inventory) { i.condition = q6(i.condition); i.charge = q6(i.charge); }
  for (const k of Object.keys(sim.progression.skills)) {
    sim.progression.skills[k].useProgress = q6(sim.progression.skills[k].useProgress);
  }
  const b = sim.quest.death.bloodstain;
  if (b) { b.pos[0] = q6(b.pos[0]); b.pos[1] = q6(b.pos[1]); b.pos[2] = q6(b.pos[2]); }
  for (const d of sim.world.droppedItems) { d.pos[0] = q6(d.pos[0]); d.pos[1] = q6(d.pos[1]); d.pos[2] = q6(d.pos[2]); }
  if (sim.quest.travel.mark) {
    const m = sim.quest.travel.mark;
    m[0] = q6(m[0]); m[1] = q6(m[1]); m[2] = q6(m[2]);
  }
  // Incidental arrays are DECLARED id-sorted in game/data/save-manifest.json, so the save
  // sorts them. A state patch that supplies them unsorted therefore left the live object in
  // an order the round trip changed — the census caught `quest.topicsKnown` doing exactly
  // that on sv1-midquest. Canonicalise the live copy instead of relaxing the check.
  sim.quest.topicsKnown.sort();
  sim.quest.completed.sort();
  sim.quest.crime.witnesses.sort();
  sim.quest.crime.stolen.sort();
  sim.quest.crime.hunting.sort();
  sim.progression.hearthsDiscovered.sort();
  sim.quest.travel.nodesVisited.sort();
  sim.world.containersEmptied.sort();
  sim.world.doorsUnlocked.sort();
  sim.world.shortcutsOpened.sort();
  sim.world.itemsTaken.sort();
  sim.world.npcsDead.sort();
  sim.world.enemiesDeadUntilRest.sort();
  sim.world.fogGatesPassed.sort();
  sim.world.droppedItems.sort((a, b2) => (a.id < b2.id ? -1 : a.id > b2.id ? 1 : 0));
  sim.inventory.sort((a, b2) => (a.id < b2.id ? -1 : a.id > b2.id ? 1 : 0));
  sim.quest.afflictions.sort((a, b2) => (a.id < b2.id ? -1 : a.id > b2.id ? 1 : 0));
}

export class SimState {
  constructor() { this.reset(1337, 'default'); }

  reset(seed = this.seed, stateName = 'default') {
    this.frame = 0;
    this.seed = seed >>> 0;
    rng.reseed(this.seed);
    this.stateName = stateName;
    this.player = makePlayer();
    this.camera = makeCamera();
    this.env = makeEnvironment();
    this.world = makeWorldMutation();
    this.progression = makeProgression();
    this.quest = makeQuestState();
    // The world-generation seed this world was built from — durable (save `world.gen_seed`),
    // null for an authored cell that generates nothing. Drawn by Engine._drawWorldSeed().
    this.worldSeed = null;
    this.entities = [];         // kept sorted by eid — HARNESS.md D7
    this.nextEid = 0;
    this.events = [];           // cleared each step; pooled by sim/events.js
    this.hitstopUntil = 0;
    this.inventory = [];
    // `document` is written by the save and read back by it; without it here the live
    // object gained a key across a round trip (undefined -> ''), which the durable-field
    // census reports as a field that does not survive.
    this.identity = { name: 'Nameless', race: 'argonian', sign: 'the-shadow', profession: 'outlander', document: '' };
    return { ok: true, frame: 0, seed: this.seed };
  }

  /** Sim time, derived from the integer frame. NEVER accumulated (RI-MTH02 "How we lose" #6). */
  get tMs() { return +(this.frame * STEP_MS).toFixed(3); }

  /** Deterministic insert: the array stays sorted by eid, so iteration order is stable. */
  addEntity(e) {
    let i = 0;
    while (i < this.entities.length && this.entities[i].eid < e.eid) i++;
    this.entities.splice(i, 0, e);
    return e;
  }

  findEntity(eid) {
    for (let i = 0; i < this.entities.length; i++) if (this.entities[i].eid === eid) return this.entities[i];
    return null;
  }
}
