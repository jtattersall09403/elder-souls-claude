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
    animStamp: -1,              // identifies the current swing, so one hitbox hits once
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
    this.entities = [];         // kept sorted by eid — HARNESS.md D7
    this.nextEid = 0;
    this.events = [];           // cleared each step; pooled by sim/events.js
    this.hitstopUntil = 0;
    this.inventory = [];
    this.identity = { name: 'Nameless', race: 'argonian', sign: 'the-shadow', profession: 'outlander' };
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
