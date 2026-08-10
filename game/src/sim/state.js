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
  // W1-01 round 3. Verdict round 2: "60 s in 8.28 m of water costs no breath, no stamina and no
  // state change", and "there is no fall". A state the world can put you in is the legible half
  // of a rule; the other half is what it costs. Both are `sim/traversal.js`.
  'SWIM', 'SUBMERGED', 'FALL', 'SLIDE', 'MIRED',
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
    // W1-13 r2. WHAT KILLED YOU, written by whatever landed the killing blow and consumed by
    // `DeathSystem.die()` on the same frame. It exists because `_inferCause()` read
    // `player.state === 'FALL'` and traversal sets the state to DEATH on the landing frame, so
    // a 90 m drop recorded `cause: 'combat'` and `placeStain()`'s fall and drown branches were
    // both unreachable. Null except for the one frame between the blow and the death tick.
    lethalCause: null,
    estus: PLAYER_CONST.estus_max,
    estusMax: PLAYER_CONST.estus_max,
    // Baseline used by idempotent birthsign pool derivation. Declare it at construction so
    // a default/named state and the same state after a blob load have the same durable shape.
    _birthsignBaseEstus: PLAYER_CONST.estus_max,
    lockOn: null,
    hitboxes: [],
    // Seam S19 view fields, refreshed from MagicSystem by sim/combat-bridge.js `mirror()`.
    // They are a VIEW: MagicSystem is the authority, exactly as CombatBody is for the fight.
    focus: 0, focusMax: 0, focusLocked: true, attuned: [], cast: null,
    effectsActive: [], levitating: false, airborne: false, altitudeM: 0,
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
    // RI-PRG07 §3 encumbrance. Written by Engine.setBurden() and read by getBurden(),
    // burdenMove() and the frame record; declared HERE at their identity values because a
    // field that springs into existence when a verb is first called makes the live object's
    // key set depend on the session's history, and the durable-field census then reports the
    // field as lost by a save that never had it. Carried by save/state.js `character`.
    carriedWeight: 0,
    burdenRatio: 0,
    // RI-PRG07 §2's OTHER sum, and it is deliberately not the same one: burden divides ALL
    // carried weight by maxLoad x 2.5, equip load divides only what is WORN by maxLoad. Both
    // are declared here, both are saved, for the reason the comment above gives.
    equippedWeight: 0,
    // ---- the traversal VIEW (RI-WLD10 / S25) ---------------------------------------------
    // `Engine.stepOnce()` copies all seven off `this.traversal` every step so the frame record
    // and the input gate can read them. None was declared here, so they came into existence on
    // the first step of a state with a heightfield under it and did not exist at all in an
    // authored interior — a live object whose key set depends on which cell it is in. The
    // AUTHORITY is `sim._traversal`, which the save now carries; these are the view.
    frameNow: 0,
    waterBand: 'W0',
    denySprint: false,
    denyRoll: false,
    breathS: 0,
    mired: false,
    mireStruggle: false,
  };
}

export function makeCamera() {
  return {
    // RI-CAM05 §F's CLOSED vocabulary. A value outside it appearing in a trace is a fail,
    // so nothing in the build may write this field except sim/camera.js's resolveMode().
    mode: 'free',               // free | locked | dialogue | menu | rest | death | fog_gate
    pivot: [0, 1.55, 0],
    pos: [0, 1.55, -4.1],
    yaw: 0,
    pitch: -8,
    fov: 50,                    // RI-CAM01 §A — 50.0°, constant, in every state, forever
    dist: 4.1,
    distTarget: 4.1,
    // ---- spring arm (RI-CAM01 §C) ----------------------------------------------------
    armLen: 4.1,                // the solved length, after rate limiting and the guard
    armDesired: 4.1,            // f(mode, target_dist, pitch), before collision
    armEased: 4.1,              // the eased target under lock (RI-CAM03 §C step 8)
    armCast: 4.1,               // the raw sphere-cast length, before clamps and rate limits
    armHit: false,
    armGuard: false,            // §C step 7 fired on this frame — the flag M4 reads
    clearFrames: 0,             // consecutive unobstructed frames, for the 6-frame dwell
    shoulderR: 0.42,
    shoulderU: 0.10,
    charOpacity: 1,             // RI-CAM01 §C fade; the renderer consumes, never decides
    pivotSnap: true,            // snap the vertical spring on teleport/load/rest/respawn
    // ---- look / recentre (RI-CAM02) ---------------------------------------------------
    lookBufX: 0, lookBufY: 0,   // hitstop buffer — RI-CAM06 §F: buffered, never dropped
    lookActive: false,
    recentreFrames: 0,
    recentreActive: false,
    // ---- lock framing (RI-CAM03) ------------------------------------------------------
    lockDist: 0,
    lockHeight: 1.9,
    containArm: 0,
    containPitch: 0,
    yawRate: 0,
    onscreen: {
      p: false, t: false, th: false, pSafe: false, tSafe: false, both: false,
      tBand: false, tBandY: -1,
      pNdc: [0, 0], tNdc: [0, 0], thNdc: [0, 0],
    },
    // ---- outside the fight (RI-CAM05) -------------------------------------------------
    uiMode: null,               // null | dialogue | menu | rest
    dialogueFrames: 0,
    dialogueYawStep: 0,
    dialogueArmStep: 0,
    dialogueArm: 0,
    dialogueYawTotal: 0,
    // ---- scripted states (RI-CAM06 §H/§I) ---------------------------------------------
    deathFrame: -1,
    fogUntil: 0,
    fogTarget: null,
    // ---- shake (RI-CAM06 §G) ----------------------------------------------------------
    shakeYaw: 0,
    shakePitch: 0,
    shakeUntil: 0,
    shakeAmp: 0,
    shakeAge: 0,
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
    // Which town you are standing in, when you are standing in one. Read by the rumour book
    // (`sim/quest/topic-supply.js`), which is keyed by settlement because RI-DLG02 requires
    // rumours to differ per town.
    settlement: null,
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

/**
 * The identity attribute register: **the ten ids `game/data/progression/attributes.json`
 * declares**, at the declared `base_value` of 10, except for the three the shipped fight was
 * calibrated against (VIGOUR 10 / ENDURANCE 20 / STRENGTH 12 — RI-CMB07's exemplar build).
 *
 * W1-13 round 3, `GAP-W1-levelup-screen-and-character-speak-different-languages`. This object
 * used to read
 *
 *   `{ vigour: 10, endurance: 20, strength: 12, dexterity: 12, intelligence: 10, faith: 10 }`
 *
 * — **six** ids, three of which (`dexterity`, `intelligence`, `faith`) are Dark Souls' names and
 * appear nowhere in this game's declared world. The level-up screen draws its rows from the data
 * file's **ten** (`ui/system.js _attributes()`), so the screen and the character were two
 * different vocabularies: seven rows the character did not carry (each drawn at a constant 10 and
 * **minted at 11** by the first confirm, because `_spendSouls` had no validation), and three the
 * character did carry that could not be raised at all.
 *
 * It also cost the build a second, unrelated defect that is written up at
 * `Engine._recomposeBirthsignTerms`: the register **did not carry WILLPOWER**, so
 * `derivePools()` read 0 for it and a load clamped a restored 94-Focus reservoir to nothing.
 *
 * `Engine._ensureAttributeRegister()` is the authority — it reconciles this object against the
 * data file on every `loadState()`, exactly as `_ensureSkillRegister()` does for skills. This
 * literal exists so that a bare `makeSim()` with no engine and no data behind it already has the
 * right key set, because a register whose keys depend on who has booted cannot be diffed.
 */
export const IDENTITY_ATTRIBUTES = Object.freeze({
  strength: 12, endurance: 20, agility: 10, speed: 10, vigour: 10,
  willpower: 10, intellect: 10, 'hist-bond': 10, personality: 10, luck: 10,
});

/**
 * Old six-id registers, mapped onto the declared ten so a save written before round 3 does not
 * silently lose the points it recorded. Read by `Engine._ensureAttributeRegister()`.
 */
export const LEGACY_ATTRIBUTE_ALIASES = Object.freeze({
  dexterity: 'agility', intelligence: 'intellect', faith: 'hist-bond',
});

export function makeProgression() {
  return {
    level: 1,
    soulsHeld: 0,
    soulsSpent: 0,
    attributes: { ...IDENTITY_ATTRIBUTES },
    skills: {},                 // id -> {value, useProgress}
    hearthsDiscovered: [],
    hearthLastRested: null,
    upgrades: {},
    // Money. Read by Engine._buildCombat() into `combat.world.gold` (the parley's price) and
    // by MagicSystem; it had no field in makeProgression and no field in the save, so gold
    // was undefined until something assigned it and zero after every load.
    gold: 0,
    // RI-LOR05 §4a. Assigned by applySave and read by the sap ward; declared here so the
    // live object's key set does not change the first time a save is loaded into it.
    sapTaint: null,
  };
}

export function makeQuestState() {
  return {
    quests: {},                 // id -> {stage, flags{}, branch, failed}
    completed: [],
    journal: [],                // append-only, ordered: [{n, date, quest, text}]
    flags: {},
    topicsKnown: [],
    // W1-LIBRARY round 2. The book ids this character has OPENED, and the reason it lives in
    // `sim.quest` rather than on the Engine is that `Engine._booksRead` was a Set on the engine
    // object: it survived `sim.reset()` (so a state load carried the previous run's reading) and
    // it was in no save blob at all (so a load closed every door the reading had opened). The
    // round-1 verdict's ARBITRATION §3 finding turns on this array — `QuestEngine.context()`
    // unions each read book's `knowledge_key` into `ctx.knowledge`, which is what makes the
    // three non-violent `lore_knowledge` resolutions reachable. Serialised as
    // `dialogue.books_read` (game/data/save-manifest.json, Dialogue group, id-sorted).
    booksRead: [],
    // W1-LIBRARY round 2 — RI-UIX05 T5, and the same bug one layer up. The page you were on
    // lived in `UISystem.bookPages`, a plain object on the UI system, and the round-2 probe
    // measured what that costs: after turning to spread 29 of `a-progress-iii`, calling
    // `reset()` and reopening, the book STILL OPENED AT 29 — one character's reading position
    // carried into the next run — and `saveState()` contained no book page anywhere, so a real
    // reload lost it entirely. T5's wording is "returns to the page you were on, per book,
    // PERSISTED IN THE SAVE", and the last three words were the half nobody had tested.
    // Book id -> zero-based SPREAD index. Serialised as `dialogue.book_pages`.
    bookPages: {},
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
  // The spring arm's state carries across a save the same way the angles do: `armLen` is a
  // rate-limited integrator, so a value the save cannot represent exactly reappears as a
  // post-load trace divergence (RI-JRN05 HF1), which is the defect the grid exists to stop.
  c.armLen = q6(c.armLen); c.armEased = q6(c.armEased); c.armDesired = q6(c.armDesired);
  c.pivot[0] = q6(c.pivot[0]); c.pivot[1] = q6(c.pivot[1]); c.pivot[2] = q6(c.pivot[2]);
  c.containArm = q6(c.containArm); c.containPitch = q6(c.containPitch);
  c.shakeYaw = q6(c.shakeYaw); c.shakePitch = q6(c.shakePitch);
  c.dialogueArm = q6(c.dialogueArm);
  // W1-repair. Everything else the save now carries off the rig, for the reason the arm note
  // above already gives. `c.pos` and `c.onscreen.*` are the load-bearing pair: RI-CAM03's lock
  // spring measures its yaw target FROM THE CAMERA'S CURRENT POSITION and takes its catch-up
  // weight from LAST frame's projected NDC, so a 1e-7 m camera position the save could not
  // represent came back as a 1e-4 deg pitch difference 36 frames later — measured on
  // `wpn-loadout-o3_twohand`, the one state left failing RI-JRN05 M5 after everything else
  // was clean. Allocation-free: fixed field list, no loops over keys.
  c.pos[0] = q6(c.pos[0]); c.pos[1] = q6(c.pos[1]); c.pos[2] = q6(c.pos[2]);
  c.armCast = q6(c.armCast); c.distTarget = q6(c.distTarget);
  c.lockDist = q6(c.lockDist); c.lockHeight = q6(c.lockHeight);
  c.yawRate = q6(c.yawRate); c.charOpacity = q6(c.charOpacity);
  c.shoulderR = q6(c.shoulderR); c.shoulderU = q6(c.shoulderU);
  c.lookBufX = q6(c.lookBufX); c.lookBufY = q6(c.lookBufY);
  c.dialogueYawStep = q6(c.dialogueYawStep); c.dialogueArmStep = q6(c.dialogueArmStep);
  c.dialogueYawTotal = q6(c.dialogueYawTotal);
  const os = c.onscreen;
  os.tBandY = q6(os.tBandY);
  os.pNdc[0] = q6(os.pNdc[0]); os.pNdc[1] = q6(os.pNdc[1]);
  os.tNdc[0] = q6(os.tNdc[0]); os.tNdc[1] = q6(os.tNdc[1]);
  os.thNdc[0] = q6(os.thNdc[0]); os.thNdc[1] = q6(os.thNdc[1]);
  sim.env.timeOfDay = q6(sim.env.timeOfDay);
  for (let i = 0; i < sim.entities.length; i++) {
    const e = sim.entities[i];
    e.pos[0] = q6(e.pos[0]); e.pos[1] = q6(e.pos[1]); e.pos[2] = q6(e.pos[2]);
    e.anchor[0] = q6(e.anchor[0]); e.anchor[1] = q6(e.anchor[1]); e.anchor[2] = q6(e.anchor[2]);
    e.yaw = q6(e.yaw); e.yawRate = q6(e.yawRate); e.speed = q6(e.speed);
    e.hp = q6(e.hp); e.poise = q6(e.poise);
    // W1-15's last-known-position. Carried by the save at 6 dp and read back by
    // `searchStart()` into the `search_start` event and the search plan, so an ungridded value
    // is a post-load trace divergence — measured as `events[].lkp[]` differing on 36 of 300
    // frames on cam_boardwalk and cam_mangrove.
    if (e.lkp) { e.lkp[0] = q6(e.lkp[0]); e.lkp[1] = q6(e.lkp[1]); e.lkp[2] = q6(e.lkp[2]); }
    if (e.percept_dist !== null && e.percept_dist !== undefined) e.percept_dist = q6(e.percept_dist);
  }
  for (let i = 0; i < sim.npcs.length; i++) {
    const n = sim.npcs[i];
    n.pos[0] = q6(n.pos[0]); n.pos[1] = q6(n.pos[1]); n.pos[2] = q6(n.pos[2]);
    n.yaw = q6(n.yaw);
  }
  for (let i = 0; i < sim.props.length; i++) {
    const o = sim.props[i];
    o.pos[0] = q6(o.pos[0]); o.pos[1] = q6(o.pos[1]); o.pos[2] = q6(o.pos[2]);
  }
  // ---- THE COMBAT BODIES ------------------------------------------------------------------
  // W1-repair, and it is the same argument the spring arm gets above. `sim.player` and
  // `sim.entities` are VIEWS; the bodies are the authority (sim/combat-bridge.js), and now
  // that the save carries them, a body position the save cannot represent exactly is a
  // post-load trace divergence exactly as an un-gridded `armLen` was. Measured before this
  // line existed: with everything else clean, RI-JRN05 M5 still reported `player.pos`,
  // `camera.pivot`, `camera.yaw_deg`, `camera.pos`, `enemies[].dist_m` and
  // `player.weapon_tip` differing on 1-5 of 120 frames — a 1e-7 m difference at the save
  // point crossing a 4-dp rounding boundary in the record. RI-JRN05 "how we lose" #6.
  // Allocation-free: fixed field list, indexed loop, no Object.keys, no closures.
  const bodies = sim._combat && sim._combat.bodies;
  if (bodies) {
    for (let i = 0; i < bodies.length; i++) {
      const b = bodies[i];
      b.pos[0] = q6(b.pos[0]); b.pos[1] = q6(b.pos[1]); b.pos[2] = q6(b.pos[2]);
      b.yaw = q6(b.yaw); b.speedMps = q6(b.speedMps); b.moveDirDeg = q6(b.moveDirDeg);
      b.hp = q6(b.hp); b.stamina = q6(b.stamina); b.poiseHealth = q6(b.poiseHealth);
      b.equipLoadPct = q6(b.equipLoadPct);
      b.socketA[0] = q6(b.socketA[0]); b.socketA[1] = q6(b.socketA[1]); b.socketA[2] = q6(b.socketA[2]);
      b.socketB[0] = q6(b.socketB[0]); b.socketB[1] = q6(b.socketB[1]); b.socketB[2] = q6(b.socketB[2]);
      b.prevA[0] = q6(b.prevA[0]); b.prevA[1] = q6(b.prevA[1]); b.prevA[2] = q6(b.prevA[2]);
      b.prevB[0] = q6(b.prevB[0]); b.prevB[1] = q6(b.prevB[1]); b.prevB[2] = q6(b.prevB[2]);
      b.rollDirDeg = q6(b.rollDirDeg); b.lastRootDelta = q6(b.lastRootDelta);
      if (typeof b._lastRootDy === 'number') b._lastRootDy = q6(b._lastRootDy);
    }
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
  sim.quest.booksRead.sort();
  // A person's topic and service lists are DECLARED id-sorted by the save (world.npcs[].topics)
  // and arrive from npcs/*.json in authored order, so the round trip reordered them and the
  // durable-field census reported `npcs[].topics[]` swapping places on every settlement state.
  // Canonicalise the live copy rather than relax the check — the same ruling topicsKnown got.
  for (let i = 0; i < sim.npcs.length; i++) {
    if (sim.npcs[i].topics) sim.npcs[i].topics.sort();
    if (sim.npcs[i].services) sim.npcs[i].services.sort();
  }
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
    this.lastHostileFrame = 0;      // S29: a new scenario is not still in the last one's fight
    this.player = makePlayer();
    this.camera = makeCamera();
    this.env = makeEnvironment();
    this.world = makeWorldMutation();
    this.progression = makeProgression();
    this.quest = makeQuestState();
    // The world-generation seed this world was built from — durable (save `world.gen_seed`),
    // null for an authored cell that generates nothing. Drawn by Engine._drawWorldSeed().
    this.worldSeed = null;
    // S29: the frame the world last did violence, stamped off the event bus in sim/step.js.
    // Travel spells are refused for 300 f@60 after it. Session state, not save state — a save
    // taken mid-fight and loaded later starts you unfenced, which is correct: the fight is over.
    this.lastHostileFrame = 0;
    this.entities = [];         // kept sorted by eid — HARNESS.md D7
    // W1-07. People, as opposed to combat entities: a name, a race, an upbringing, a
    // disposition and a list of topics, with no statblock and no hitbox (sim/npc.js).
    // Kept sorted by eid for the same reason `entities` is.
    this.npcs = [];
    // W1-07 / RI-JRN01 O6: "at least one object that can be picked up" has to be an object
    // in the world, not an inventory row. Small, world-placed, takeable things.
    this.props = [];
    this.nextEid = 0;
    this.events = [];           // cleared each step; pooled by sim/events.js
    this.hitstopUntil = 0;
    this.inventory = [];
    // `document` is written by the save and read back by it; without it here the live
    // object gained a key across a round trip (undefined -> ''), which the durable-field
    // census reports as a field that does not survive.
    // `race` here is THE RACE OF THE BODY THE PLAYER IS IN, not a field of a character sheet:
    // the sheet does not exist yet (see `character`, below) and O6 requires the player to be a
    // body before they are a character. It read `'argonian'` until W1-26 r3, which is not an id
    // in `game/data/progression/races.json` at all — `argonian` is a boolean TAG on a race row
    // (`saxhleel` and `naga` carry `argonian: true`). So every reader of this field either
    // string-compared it against a literal or resolved it to nothing, and the Warden-Scribe,
    // who observes the body rather than asking it (RI-CHR01 §1 row 2), had nothing valid to
    // observe. It is now a real race id. Whatever chooses the starting body — W1-07's job —
    // writes it here, and `Engine.censusBegin()` observes what it finds.
    this.identity = { name: 'Nameless', race: 'saxhleel', sign: 'the-shadow', profession: 'outlander', document: '' };
    // W1-07 — the composed character sheet, or null before the Writ House. `null` is a real
    // and reachable state: RI-JRN01 O6 requires the player to be controllable, in a body,
    // with a walkable space and another person in it, BEFORE anything defines them.
    this.character = null;
    // W1-07 AR-3's capture outcome, and the request that produces it. Neither was cleared by
    // reset() and neither was in the save, so (a) a scenario that ran after a capture started
    // still captured — the same contamination W1-15 found in the stealth subsystem and W1-13
    // in the death runtime — and (b) a save taken in the Archon Hold reloaded as a free
    // citizen. `captured` is durable and is carried as `world.capture`; `captureRequest` is a
    // single-step intent resolved by the next step and is deliberately NOT.
    this.captured = null;
    this.captureRequest = null;
    // A UI surface, not simulation state. Declared here so the live object's key set does not
    // depend on whether anyone has pressed the menu button, and cleared by every load for the
    // same reason the input pipeline is: a load does not land you inside an open menu.
    this.menuOpen = false;
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

  addNPC(n) {
    let i = 0;
    while (i < this.npcs.length && this.npcs[i].eid < n.eid) i++;
    this.npcs.splice(i, 0, n);
    return n;
  }

  findNPC(eid) {
    for (let i = 0; i < this.npcs.length; i++) if (this.npcs[i].eid === eid) return this.npcs[i];
    return null;
  }
}
