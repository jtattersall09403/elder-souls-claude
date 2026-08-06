// The engine: the one object that owns the simulation, the loop, the renderer, the input
// pipeline and the save store, and the only thing window.__HARNESS talks to.
'use strict';

import { rng } from './core/rng.js';
import { installGuards, wallNow, violations } from './core/guards.js';
import { FixedLoop, FIXED_HZ, STEP_MS } from './core/loop.js';
import { SimState, quantiseColdState, PLAYER_CONST } from './sim/state.js';
import { EventBus } from './sim/events.js';
import { stepOnce } from './sim/step.js';
import { CombatSystem } from './combat/system.js';
import { combatMeta, combatFrame } from './combat/trace.js';
import { mirror } from './sim/combat-bridge.js';
import { makeRecord } from './sim/record.js';
import { buildCells, EMPTY_CELL } from './sim/collision.js';
import {
  CAMERA_CONST, CAMERA_MODES, PERSPECTIVE_MODES, NEAR_CORNER_R, CAMERA_ALPHAS,
  openUI as cameraOpenUI, closeUI as cameraCloseUI, beginFogGate, beginDeathCamera,
  pitchArmScale, projectNDC, cameraBasis,
} from './sim/camera.js';
import { PLAYER_RADIUS_M } from './sim/world-collision.js';
import { makeEntity, reanchorFreeRunning } from './sim/entities.js';
import { InputPipeline } from './input/pipeline.js';
import { RealInput } from './input/real.js';
import { Renderer } from './render/renderer.js';
import { WEATHER } from './render/sky.js';
import { WorldField } from './world/field.js';
import { SaveStore } from './save/store.js';
import { buildSave, applySave, stateHash, VOLATILE_PATHS, SAVE_SCHEMA_VERSION } from './save/state.js';
import { exportSave, importSave } from './save/exchange.js';
import { canonicalise } from './core/canonical.js';

/** Pre-allocated depth of the sim-time ring in `Engine.perf`. */
const PERF_SAMPLES = 20000;

/** `ES-WATER/1` walk multipliers, RI-WLD10 §2. Mirrored in game/data/world/water.json. */
const WATER_SPEED_MULT = { W0: 1.00, W1: 0.97, W2: 0.85, W3: 0.65, W4: 0.43, W5: 0.55 };

export const BUILD = {
  name: 'elder-souls',
  version: '0.2.0-w1-09',
  harnessVersion: 1,
  fixedStepHz: FIXED_HZ,
  dataRoot: 'game/data',
  piece: 'W1-09 — combat core (on W1-00’s harness)',
};

export class Engine {
  constructor(canvas) {
    this.canvas = canvas;
    this.mode = 'harness';
    this.sim = new SimState();
    this.input = new InputPipeline();
    this.bus = new EventBus();
    this.sim.input = this.input;
    this.data = null;
    this.combat = null;
    this.combatTrace = null;
    this.renderer = null;
    this.real = null;
    this.store = new SaveStore();
    this.trace = null;
    this.tracePerf = false;
    this.readyPromise = null;
    this.readyResolved = false;
    // Pre-allocated ring, for the same reason as FixedLoop's: a growing [] is a per-call
    // allocation and getPerfStats() must not be the thing that makes the loop allocate.
    this.perf = {
      simMsRing: new Float64Array(PERF_SAMPLES), simMsCount: 0, simMsHead: 0,
      lastSimMs: 0, saveWrites: 0, lastSaveMs: 0,
      pushSimMs(v) {
        this.simMsRing[this.simMsHead] = v;
        this.simMsHead = (this.simMsHead + 1) % PERF_SAMPLES;
        if (this.simMsCount < PERF_SAMPLES) this.simMsCount++;
      },
      simMsWindow() {
        const out = new Array(this.simMsCount);
        for (let i = 0; i < this.simMsCount; i++) {
          out[i] = this.simMsRing[(this.simMsHead - this.simMsCount + i + PERF_SAMPLES * 2) % PERF_SAMPLES];
        }
        return out;
      },
    };
    this.loadState_ = { phase: 'boot', bytesFetched: 0, requestsInFlight: 0, regionsResident: [], prefetchQueue: [] };
    this.boundaries = [];
    this.firstControlAt = null;
    this.navigationStart = wallNow();

    this.loop = new FixedLoop(() => this._step(), () => this._render());
    // rAF-driven stepping ('play') needs the same post-step observation stepFrames() does,
    // and it must land OUTSIDE FixedLoop.stepOnce(), not inside it.
    this.loop.afterStep = () => this._afterStep();
  }

  // ---- boot ---------------------------------------------------------------------------

  async boot(opts = {}) {
    if (this.readyPromise) return this.readyPromise;
    this.readyPromise = this._boot(opts);
    return this.readyPromise;
  }

  async _boot(opts) {
    this._boundaryBegin('initial');
    this.loadState_.phase = 'fetching-data';
    this.data = await loadData((n) => { this.loadState_.bytesFetched += n; });
    this.loadState_.phase = 'building-scene';

    // Guards are installed BEFORE the scene is built, so a Math.random() in the scene
    // builder becomes a seeded draw rather than a source of run-to-run variation.
    installGuards({ replaceMathRandom: true, cosmeticSeed: 0x5eed1337 });

    this.renderer = new Renderer(this.canvas, 1337);
    // The province (W1-01). One field answers every spatial question — ground height for
    // collision, region for identity, water depth for the band, tide, substrate — and the
    // renderer builds its meshes from the same field, so the surface you collide with and the
    // surface you see are the same surface by construction.
    this.field = new WorldField(this.data.terrain, this.data.regions, this.data.water);
    this.renderer.setWorld(this.field, this.data.roads);
    // The camera's collision set. Built once from game/data/camera/cells.json and then
    // selected per named state; the sim step only ever reads it.
    this.cells = buildCells(this.data.cameraCells);
    this.sim.cameraTargets = this.data.cameraTargets.heights_m;
    this.sim.cameraTargets._default = this.data.cameraTargets._default;
    this.real = new RealInput(this.input, this.canvas);

    this.loadState_.phase = 'opening-store';
    await this.store.open();
    await this.store.requestPersistence();

    this.applyNamedState(opts.state || 'default');
    this.loadState_.phase = 'ready';
    this.loadState_.regionsResident = [this.sim.env.region];
    this._boundaryEnd('initial');

    this.setMode(opts.mode || 'harness');
    this.loop.start();
    this.renderer.render(this.sim);
    this.readyResolved = true;
    return true;
  }

  // ---- mode ----------------------------------------------------------------------------

  setMode(mode) {
    this.loop.setMode(mode);
    this.mode = mode;
    if (mode === 'harness') {
      if (this.real && this.real.attached) this.real.detach();
    } else if (this.real && !this.real.attached) {
      this.real.attach();
    }
    return mode;
  }

  // ---- determinism ------------------------------------------------------------------

  /** Reseeds the global PRNG. Honoured by the next loadState/reset (HARNESS.md D6). */
  setSeed(n) {
    this.sim.seed = n >>> 0;
    rng.reseed(this.sim.seed);
    return this.sim.seed;
  }

  // ---- data --------------------------------------------------------------------------

  get moves() { return this.combat ? this.combat.player.moves : null; }

  /** Every game/data/combat/*.json, plus locomotion constants, in the shape CombatSystem wants. */
  _combatData() {
    const d = this.data;
    return {
      frames: d.combat.frames,
      roll: d.combat.roll,
      stamina: d.combat.stamina,
      poise: d.combat.poise,
      hitgeometry: d.combat.hitgeometry,
      lockon: d.combat.lockon,
      flask: d.combat.flask,
      parley: d.combat.parley,
      skeleton: d.combat.skeleton,
      clips: d.combat.clips,
      movesets: d.movesets,
      locomotion: {
        walk_mps: PLAYER_CONST.walk_mps,
        jog_mps: PLAYER_CONST.jog_mps,
        sprint_mps: PLAYER_CONST.sprint_mps,
        turn_rate_dps: PLAYER_CONST.turn_rate_dps,
        // W1-06 / RI-CAM02 §C: the bounded-turn law has TWO ceilings and a clip, not one
        // rate. 720 °/s while moving (a visible arc), 480 °/s while stationary under 100° of
        // error, and an 18-frame root-motion `turn_in_place` clip beyond it. The single
        // 480 °/s constant this build shipped made a running 180° reversal take 22 frames
        // instead of 15 and had no turn-in-place at all, which RI-CAM02 M4 fails on both rows.
        turn_rate_moving_dps: 720,
        turn_rate_stationary_dps: 480,
        turn_in_place_threshold_deg: 100,
        turn_in_place_frames: 18,
        move_deadzone: 0.15,
        walk_run_threshold: 0.55,
      },
    };
  }

  statFor(id, eid, x, z, frame) {
    const stat = this.data.enemies[id];
    if (!stat) {
      throw new Error(
        `spawn('${id}'): no such archetype. Known: ${Object.keys(this.data.enemies).sort().join(', ')}. ` +
        'Archetypes are declared in game/data/combat/enemies/*.json; a phantom eid would be a ' +
        'fabricated measurement (RI-MTH01 M6).');
    }
    return makeEntity(stat, eid, x, z, frame);
  }

  /**
   * The world-generation seed for the cell this state names, DRAWN from the simulation PRNG.
   *
   * Two properties, both deliberate:
   *
   *  * it is a real draw, so `rng.draws` moves for a world with no entity in it — the case
   *    where W1-00's round-2 critic measured 0 of 1,800 frames differing between two seeds
   *    (verdict §9.1), because the only seeded quantity in the build belonged to entities;
   *  * it is drawn ONLY for a procedurally generated cell. The arena, the interiors and the
   *    dungeon are authored geometry: there is nothing in them for a seed to select, so
   *    nothing is drawn, `rng.draws` stays 0 there, and `RI-MTH02` R4 still correctly refuses
   *    to certify seed sensitivity on `mth-warmup-noenemy` with reason `prng_never_drawn`.
   *    That discriminator is the one the round-2 critic proved was not a rubber stamp, and it
   *    is not weakened here — it is left with a scenario that still exercises it.
   */
  _drawWorldSeed() {
    if (this.cellFor(this.sim.env) !== 'exterior') return null;
    return rng.int(0x7fffffff);
  }

  applyNamedState(name) {
    const patch = this.data.states[name];
    if (!patch) {
      throw new Error(`loadState('${name}'): no such named state. Known: ${Object.keys(this.data.states).sort().join(', ')}`);
    }
    const sim = this.sim;
    sim.reset(rng.seed, name);
    if (patch.env) Object.assign(sim.env, {
      timeOfDay: patch.env.timeOfDay ?? sim.env.timeOfDay,
      weather: patch.env.weather ?? sim.env.weather,
      region: patch.env.region ?? sim.env.region,
      interior: patch.env.interior === undefined ? sim.env.interior : patch.env.interior,
    });
    if (patch.player) {
      const p = sim.player;
      if (patch.player.pos) { p.pos[0] = patch.player.pos[0]; p.pos[1] = patch.player.pos[1]; p.pos[2] = patch.player.pos[2]; }
      if (patch.player.yaw !== undefined) p.yaw = patch.player.yaw;
      if (patch.player.hp !== undefined) p.hp = patch.player.hp;
      if (patch.player.stamina !== undefined) p.stamina = patch.player.stamina;
    }
    if (patch.camera) {
      if (patch.camera.yaw !== undefined) sim.camera.yaw = patch.camera.yaw;
      if (patch.camera.pitch !== undefined) sim.camera.pitch = patch.camera.pitch;
      if (patch.camera.mode) sim.camera.mode = patch.camera.mode;
    }
    if (patch.inventory) sim.inventory = JSON.parse(JSON.stringify(patch.inventory));
    if (patch.progression) Object.assign(sim.progression, JSON.parse(JSON.stringify(patch.progression)));
    if (patch.quest) deepAssign(sim.quest, JSON.parse(JSON.stringify(patch.quest)));
    if (patch.world) deepAssign(sim.world, JSON.parse(JSON.stringify(patch.world)));
    // Drawn AFTER the env patch (the cell is not known before it) and BEFORE _applyCell(),
    // groundAt() and the spawns, all of which read the generated terrain.
    sim.worldSeed = this._drawWorldSeed();
    this._applyCell();
    // W1-09: the fight is rebuilt from the named state's loadout. The combat bodies are the
    // authority and sim.player is a view (sim/combat-bridge.js); rebuilding here rather than
    // patching a live system is what makes loadState() reproducible.
    this._loadout = Object.assign({}, patch.loadout || {});
    this._buildCombat(this._loadout);
    for (const s of patch.spawn || []) this.spawn(s.id, s.x, s.z, { as: s.as });
    // Put the player on the ground of whatever cell the state names.
    sim.player.pos[1] = this.groundAt(sim.player.pos[0], sim.player.pos[2]);
    // The camera's collision cell. A named state may declare `camera_cell`; without one the
    // cell is empty and the spring arm has nothing to collide with, which is the honest
    // state of the procedural exterior until W1-01 publishes collision for it.
    this.setCameraCell(patch.camera_cell || null);
    this._settleCamera();
    quantiseColdState(sim);
    return { ok: true, frame: sim.frame, seed: rng.seed };
  }

  /**
   * Build the fight from a loadout. Called by applyNamedState so a named state fully
   * determines the combat system, which is what makes a scenario reproducible.
   */
  _buildCombat(loadout) {
    this.combat = new CombatSystem(this._combatData());
    const b = this.combat.createPlayer(loadout);
    const p = this.sim.player;
    b.pos[0] = p.pos[0]; b.pos[1] = p.pos[1]; b.pos[2] = p.pos[2];
    b.yaw = p.yaw;
    if (loadout.stamina !== undefined) b.stamina = loadout.stamina;
    if (loadout.hp !== undefined) b.hp = loadout.hp;
    // The parley reads OUT-OF-FIGHT state. This is the AR-3 crossing and it is wired here:
    // gold, dispositions, faction ranks and known dialogue topics all come from the same
    // sim.quest / sim.inventory the Morrowind half of the game writes.
    this.combat.world = {
      gold: this.sim.progression.gold || loadout.gold || 0,
      dispositions: this.sim.quest.dispositions,
      factions: this.sim.quest.factions,
      topicsKnown: this.sim.quest.topicsKnown,
    };
    b.evaluateRig(0);
    mirror(this.sim, this.combat);
    return b;
  }

  /** The equip load the fight reads. Seam S23: RI-CMB01 owns what the tier DOES in a fight;
   *  RI-PRG07 owns encumbrance outside it and may keep finer granularity with no in-fight
   *  effect. This setter is the seam, and it is deliberately the only way across it. */
  /**
   * Re-equip and rebuild the fight in place. The loadout is merged over the current one, so
   * `setLoadout({weapon:'axe'})` keeps the build's endurance, armour and shield. Position,
   * facing, equip load and the enemies are preserved; a fresh weapon means a fresh move table,
   * which is what makes RI-CMB02 M1's 14-row census a census rather than seven separate runs.
   */
  setLoadout(patch) {
    const c = this.combat;
    const prev = c.player;
    this._loadout = Object.assign({}, this._loadout || {}, patch || {});
    const others = c.bodies.filter((b) => b !== prev).map((b) => ({ b, ctl: c.enemies.get(b.id) }));
    const b = c.createPlayer(this._loadout);
    b.pos[0] = prev.pos[0]; b.pos[1] = prev.pos[1]; b.pos[2] = prev.pos[2];
    b.yaw = prev.yaw;
    b.equipLoadPct = prev.equipLoadPct;
    b.tier = c.tierOf(b);
    for (const { b: eb, ctl } of others) { c.bodies.push(eb); if (ctl) c.enemies.set(eb.id, ctl); }
    c.bodies.sort((x, y) => (x.id < y.id ? -1 : x.id > y.id ? 1 : 0));
    b.evaluateRig(0);
    mirror(this.sim, this.combat);
    return { weapon: b.moves._movesetId, weapon_class: b.moves._classKey, shield: b.shieldId, stamina_max: b.staminaMax, tier: b.tier };
  }

  setEquipLoad(pct) {
    const v = Number(pct);
    if (!Number.isFinite(v) || v < 0) throw new Error(`setEquipLoad(${JSON.stringify(pct)}): expected a non-negative percentage`);
    this.combat.player.equipLoadPct = v;
    this.combat.player.tier = this.combat.tierOf(this.combat.player);
    this.sim.player.equipLoadPct = v;
    this.sim.player.rollClass = this.combat.player.tier;
    return { equip_load_pct: v, tier: this.combat.player.tier };
  }

  /** Load a scripted enemy action list — RI-CMB07 M1 Mode-A's instrument. */
  queueEnemyScript(eid, script) {
    const ec = this.combat.enemies.get(eid);
    if (!ec) throw new Error(`queueEnemyScript('${eid}'): no such enemy`);
    return ec.loadScript(script, this.sim.frame);
  }

  /** Out-of-fight state the parley reads. AR-3: this is the world reaching into the fight. */
  setWorldKnowledge(patch) {
    const w = this.combat.world;
    if (patch.gold !== undefined) w.gold = Number(patch.gold);
    if (patch.topicsKnown) { w.topicsKnown = patch.topicsKnown.slice(); this.sim.quest.topicsKnown = w.topicsKnown; }
    if (patch.dispositions) Object.assign(w.dispositions, patch.dispositions);
    if (patch.factions) Object.assign(w.factions, patch.factions);
    return { gold: w.gold, topicsKnown: w.topicsKnown.slice(), dispositions: { ...w.dispositions }, factions: JSON.parse(JSON.stringify(w.factions)) };
  }

  // ---- es-combat-trace/1 (RI-CMB07) --------------------------------------------------------

  combatTraceStart(opts = {}) {
    this.combatTrace = { records: [], meta: combatMeta(this.combat, opts.scenario || this.sim.stateName, this.sim.seed) };
    return this.combatTrace.meta.schema;
  }

  combatTraceDrain() {
    if (!this.combatTrace) return [];
    const r = this.combatTrace.records;
    this.combatTrace.records = [];
    return r;
  }

  combatTraceMeta() { return this.combatTrace ? this.combatTrace.meta : null; }

  combatTraceStop() {
    const r = this.combatTrace ? this.combatTrace.records : [];
    this.combatTrace = null;
    return r;
  }

  /** RI-CMB04's mandatory debug channel: every hitbox and hurtbox, world space, this frame. */
  getHitGeometry() {
    const out = { frame: this.sim.frame, substeps: this.combat.d.hitgeometry.sweep.substeps, actors: [] };
    const tmp = [];
    for (const b of this.combat.bodies) {
      const rec = {
        id: b.id,
        pos: [r4c(b.pos[0]), r4c(b.pos[1]), r4c(b.pos[2])],
        yaw_deg: r4c(b.yaw),
        state: b.state,
        anim: b.anim,
        anim_frame: b.animFrame,
        invuln: b.iframe ? 1 : 0,
        hitbox_active: b.hitboxActive ? 1 : 0,
        hurtboxes: b.rig.dumpHurtboxes(tmp).map((h) => ({ ...h })),
        bones: b.rig.dumpBones([]).map((x) => ({ ...x })),
        weapon: {
          socket_a: b.moves._weapon.socket_a, socket_b: b.moves._weapon.socket_b,
          r: b.move ? b.move.hitbox_radius_m : b.moves._weapon.radius_m,
          now: [r4c(b.socketA[0]), r4c(b.socketA[1]), r4c(b.socketA[2]), r4c(b.socketB[0]), r4c(b.socketB[1]), r4c(b.socketB[2])],
          prev: [r4c(b.prevA[0]), r4c(b.prevA[1]), r4c(b.prevA[2]), r4c(b.prevB[0]), r4c(b.prevB[1]), r4c(b.prevB[2])],
        },
      };
      out.actors.push(rec);
    }
    return out;
  }

  /** Which renderable cell the current environment corresponds to. */
  cellFor(env) {
    if (env.region === 'arena') return 'arena';
    if (env.interior === 'dungeon-primary') return 'dungeon';
    if (env.interior) return 'interior';
    // `showcase` is W1-00's 420 m origin neighbourhood, kept as the capture rig for the twelve
    // canonical viewpoints (HARNESS.md §6 poses are absolute and near the origin). Everything
    // else is the province.
    if (env.showcase) return 'exterior';
    return 'province';
  }

  groundAt(x, z) {
    if (!this.renderer) return 0;
    return this.renderer.groundAt(x, z, undefined, this.cellFor(this.sim.env));
  }

  _applyCell() {
    if (!this.renderer) return;
    // The generated world comes first: setCell() only chooses which cell is visible, while
    // setWorldSeed() decides what the exterior one IS, and groundAt() must agree with it.
    if (this.sim.worldSeed !== null && this.sim.worldSeed !== undefined) this.renderer.setWorldSeed(this.sim.worldSeed);
    const cell = this.cellFor(this.sim.env);
    this.renderer.setCell(cell);
    if (cell === 'province' && this.renderer.province) {
      this._boundaryBegin('region');
      this.renderer.province.request(this.sim.player.pos[0], this.sim.player.pos[2]);
      this.renderer.province.drain();
      this.loadState_.regionsResident = [this.field.regionAt(this.sim.player.pos[0], this.sim.player.pos[2]).id];
      this._boundaryEnd('region');
    }
    this.renderer.setProp('npcShowcase', this.sim.stateName === 'npc_showcase');
    this.renderer.setProp('materialShowcase', this.sim.stateName === 'material_showcase');
  }

  /**
   * Put the rig in the pose it would settle into, with no input, before the first step.
   * The vertical pivot spring is SNAPPED rather than eased here — RI-CAM01 §B lists `load`
   * and `teleport` among the four events that snap it, and an eased pivot after a teleport
   * is the camera dragging itself across the map over a quarter of a second.
   */
  _settleCamera() {
    const c = this.sim.camera;
    const p = this.sim.player;
    c.pivot[0] = p.pos[0];
    c.pivot[1] = p.pos[1] + CAMERA_CONST.pivot_height_m;
    c.pivot[2] = p.pos[2];
    c.pivotSnap = true;
    const locked = p.lockOn !== null && p.lockOn !== undefined;
    const sr = locked ? CAMERA_CONST.shoulder_right_locked_m : CAMERA_CONST.shoulder_right_free_m;
    const su = locked ? CAMERA_CONST.shoulder_up_locked_m : CAMERA_CONST.shoulder_up_free_m;
    c.shoulderR = sr; c.shoulderU = su;
    const want = (locked ? CAMERA_CONST.arm_locked_near_m : CAMERA_CONST.arm_free_m) * pitchArmScale(c.pitch);
    c.armDesired = want; c.armEased = want; c.armLen = want; c.armCast = want;
    c.dist = want; c.distTarget = want; c.clearFrames = 0;
    c.containArm = 0; c.containPitch = 0; c.armHit = false; c.armGuard = false;
    c.lookBufX = 0; c.lookBufY = 0; c.recentreFrames = 0; c.recentreActive = false;
    c.deathFrame = -1; c.fogUntil = 0; c.fogTarget = null; c.uiMode = null;
    c.dialogueFrames = 0; c.dialogueArm = 0; c.dialogueYawStep = 0; c.dialogueArmStep = 0;
    c.fov = CAMERA_CONST.fov_deg;
    c.mode = locked ? 'locked' : 'free';
    const yaw = c.yaw * Math.PI / 180, pitch = c.pitch * Math.PI / 180, cp = Math.cos(pitch);
    const fwd = [Math.sin(yaw) * cp, Math.sin(pitch), Math.cos(yaw) * cp];
    const right = [Math.cos(yaw), 0, -Math.sin(yaw)];
    const up = [
      right[1] * fwd[2] - right[2] * fwd[1],
      right[2] * fwd[0] - right[0] * fwd[2],
      right[0] * fwd[1] - right[1] * fwd[0],
    ];
    for (let i = 0; i < 3; i++) c.pos[i] = c.pivot[i] - fwd[i] * want + right[i] * sr + up[i] * su;
  }

  /** Select the static collision cell the spring arm casts against. */
  setCameraCell(id) {
    if (id === null || id === undefined) { this.sim.cell = EMPTY_CELL; this.sim.cellId = null; return null; }
    const cell = this.cells.get(String(id));
    if (!cell) {
      throw new Error(`setCameraCell('${id}'): no such cell. Known: ${[...this.cells.keys()].sort().join(', ')}`);
    }
    this.sim.cell = cell;
    this.sim.cellId = cell.id;
    return cell.id;
  }

  // ---- stepping -------------------------------------------------------------------------

  /**
   * ONE fixed simulation step and nothing else.
   *
   * The trace record is deliberately NOT built here. It used to be, and although it sat
   * outside `armSim()`, it sat *inside* `FixedLoop.stepOnce()` — so a CDP sampling heap
   * profile showed `makeRecord <- _step <- stepOnce <- stepFrames` and the sim step
   * allocated 2,220 B/step whenever tracing was on. `RI-PLT01` §C.3 says the record "is
   * built OUTSIDE the sim step"; it now is, in `_afterStep()`, called by the two things that
   * advance the sim (`stepFrames` and the rAF accumulator) AFTER `stepOnce()` has returned
   * and after its timing window has closed.
   */
  _step() {
    stepOnce(this.sim, this.input, this.combat, this.bus);
  }

  /**
   * Everything that observes a step, run strictly after the step has finished: the trace
   * record, and the first-control stamp. Never on the sim-step stack, never inside
   * `stepOnce`'s timing window, so `perf.lastSimMs` and every allocation profile taken over
   * `stepFrames` describe the simulation and not the instrument.
   */
  _afterStep() {
    this._settleWorld();
    if (this.firstControlAt === null && this.sim.frame > 0) this.firstControlAt = wallNow();
    if (this.trace) {
      this.trace.records.push(makeRecord(this.sim, this.input, this.bus, this.trace.opts, this.tracePerf ? this._perfBlock() : null));
    }
    if (this.combatTrace) {
      const ev = this.bus.snapshotInto([]).slice();
      this.combatTrace.records.push(combatFrame(this.combat, this.sim.frame - 1, this.input, ev, this.sim.camera));
    }
  }

  /**
   * The province's claim on the player, applied strictly after the step and strictly before the
   * frame record: stand on the ground, and pay the water's price for crossing it.
   *
   * Two things happen here and nothing else. (1) The player's Y is the field's ground height, so
   * the capsule follows the terrain instead of floating at the elevation it was loaded at.
   * (2) `ES-WATER/1` band locomotion (RI-WLD10 §2) is applied as a RETRACTION of the horizontal
   * displacement the step just produced — walking into hip-deep water costs 0.65 of your speed.
   * It is done this way, rather than by editing the locomotion constants, for one reason that is
   * also the seam ruling: **S25 says water may never change a frame number.** A retraction cannot
   * reach a frame count, a startup, an i-frame window or a stamina cost; it can only change where
   * you ended up. Denial (no sprint and no roll above W2), the stamina drain, the breath clock and
   * MIRED are `world.water.marsh`, which is W1-03's path, and are declared missing rather than
   * faked here — see getCapabilityReport().
   *
   * No wall clock, no PRNG draw, no allocation: this runs 207,000 times during a crossing.
   */
  _settleWorld() {
    if (!this.field || this.cellFor(this.sim.env) !== 'province') return;
    const p = this.sim.player;
    const x = p.pos[0], z = p.pos[2];
    const px = this._prevX === undefined ? x : this._prevX;
    const pz = this._prevZ === undefined ? z : this._prevZ;
    const dx = x - px, dz = z - pz;
    if (dx !== 0 || dz !== 0) {
      const depth = this.field.depthAt(px + dx * 0.5, pz + dz * 0.5);
      const mult = WATER_SPEED_MULT[this.field.bandOf(depth)];
      if (mult < 1) { p.pos[0] = px + dx * mult; p.pos[2] = pz + dz * mult; }
    }
    p.pos[1] = this.field.heightAt(p.pos[0], p.pos[2]);
    this._prevX = p.pos[0]; this._prevZ = p.pos[2];
  }

  _render() {
    if (this.renderer) this.renderer.render(this.sim);
  }

  /** HARNESS.md §3: advance exactly n fixed steps; render ONCE at the end. */
  stepFrames(n) {
    const k = Number(n);
    if (!Number.isFinite(k) || !Number.isInteger(k) || k < 0) {
      throw new Error(`stepFrames(${JSON.stringify(n)}): n must be a non-negative integer`);
    }
    // Sim time is accumulated by FixedLoop.stepOnce() around the step ALONE, so the trace
    // record built in _afterStep() is outside both the step and its timing window and
    // cannot inflate simMs (RI-PLT01 M3's "measure the simulation, not the instrument").
    const t0 = this.loop.stepMsTotal;
    for (let i = 0; i < k; i++) { this.loop.stepOnce(); this._afterStep(); }
    this.perf.lastSimMs = k ? (this.loop.stepMsTotal - t0) / k : 0;
    if (k) this.perf.pushSimMs(this.perf.lastSimMs);
    if (this.loop.renderRateHz !== 0) this.loop.renderNow();
    return { frame: this.sim.frame, t_ms: +(this.sim.frame * STEP_MS).toFixed(3) };
  }

  // ---- world manipulation ----------------------------------------------------------------

  spawn(id, x, z, opts = {}) {
    const eid = opts.as || `e${this.sim.nextEid}`;
    if (this.sim.findEntity(eid)) throw new Error(`spawn: eid '${eid}' is already in use`);
    const e = this.statFor(id, eid, Number(x), Number(z), this.sim.frame);
    e.pos[1] = this.groundAt(e.pos[0], e.pos[2]);
    e.anchor[1] = e.pos[1];
    this.sim.addEntity(e);
    const body = this.combat.spawnEnemy(eid, this.data.enemies[id], e.pos[0], e.pos[2], e.yaw);
    body.pos[1] = e.pos[1];
    body.evaluateRig(0);
    quantiseColdState(this.sim);
    this.sim.nextEid++;
    return eid;
  }

  despawn(eid) {
    const i = this.sim.entities.findIndex((e) => e.eid === eid);
    if (i < 0) throw new Error(`despawn('${eid}'): no such entity`);
    this.sim.entities.splice(i, 1);
    this.combat.despawn(eid);
    return true;
  }

  aggro(eid) {
    const e = this.sim.findEntity(eid);
    if (!e) throw new Error(`aggro('${eid}'): no such entity`);
    e.alert = 100;
    e.alertState = 'AGGRO';
    const ec = this.combat.enemies.get(eid);
    if (ec) { ec.alert = 100; ec.alertState = 'AGGRO'; ec.b.aggro = true; }
    return true;
  }

  lockOn(eid) {
    if (eid !== null && !this.sim.findEntity(eid)) throw new Error(`lockOn('${eid}'): no such entity`);
    this.combat.setLock(eid);
    this.sim.player.lockOn = eid;
    this.sim.camera.mode = eid ? 'locked' : 'free';
    return true;
  }

  teleport(x, z, opts = {}) {
    const p = this.sim.player;
    p.pos[0] = Number(x);
    p.pos[2] = Number(z);
    this._prevX = p.pos[0]; this._prevZ = p.pos[2];
    if (this.renderer && this.renderer.province && this.cellFor(this.sim.env) === 'province') {
      this._boundaryBegin('region');
      this.renderer.province.request(p.pos[0], p.pos[2]);
      this.renderer.province.drain();
      this.loadState_.regionsResident = [this.field.regionAt(p.pos[0], p.pos[2]).id];
      this._boundaryEnd('region');
    }
    p.pos[1] = opts.y !== undefined ? Number(opts.y) : this.groundAt(p.pos[0], p.pos[2]);
    if (opts.yaw !== undefined) p.yaw = Number(opts.yaw);
    if (this.combat && this.combat.player) {
      const b = this.combat.player;
      b.pos[0] = p.pos[0]; b.pos[1] = p.pos[1]; b.pos[2] = p.pos[2];
      if (opts.yaw !== undefined) b.yaw = p.yaw;
      b.hasPrev = false;
      b.evaluateRig(0);
    }
    this._settleCamera();
    quantiseColdState(this.sim);
    return true;
  }

  setTimeOfDay(h) {
    const v = Number(h);
    if (!Number.isFinite(v) || v < 0 || v > 24) throw new Error(`setTimeOfDay(${JSON.stringify(h)}): hours must be 0..24`);
    this.sim.env.timeOfDay = v;
    return v;
  }

  setWeather(id) {
    if (!WEATHER[id]) throw new Error(`setWeather('${id}'): unknown state. Named states: ${Object.keys(WEATHER).join(', ')}`);
    this.sim.env.weather = String(id);
    return this.sim.env.weather;
  }

  camera(pose) {
    const c = this.sim.camera;
    if (pose === null) { c.override = null; return this.cameraState(); }
    if (!pose || typeof pose !== 'object') throw new Error('camera(pose): pose must be an object, or null to release the override');
    if (pose.mode === 'gameplay') {
      c.override = null;
      if (pose.lockOn !== undefined && pose.lockOn !== true) this.lockOn(pose.lockOn);
      return this.cameraState();
    }
    const cur = c.override || { pos: [c.pos[0], c.pos[1], c.pos[2]], look: [c.pivot[0], c.pivot[1], c.pivot[2]], fov: c.fov };
    c.override = {
      pos: pose.pos ? [Number(pose.pos[0]), Number(pose.pos[1]), Number(pose.pos[2])] : cur.pos,
      look: pose.look ? [Number(pose.look[0]), Number(pose.look[1]), Number(pose.look[2])] : cur.look,
      fov: pose.fov !== undefined ? Number(pose.fov) : cur.fov,
    };
    // RI-CAM05 §F/M7: `camera({mode:'first'})` must THROW, not silently accept. The check is
    // against the closed vocabulary rather than a blocklist, so a future mode name cannot
    // sneak a first-person view in under a synonym.
    if (pose.mode !== undefined) {
      const m = String(pose.mode);
      if (!CAMERA_MODES.includes(m)) {
        throw new Error(
          `camera({mode:'${m}'}): '${m}' is not a camera mode. Seam S18 makes this game ` +
          `third-person at all times and RI-CAM05 §F fixes the vocabulary to ` +
          `[${CAMERA_MODES.join(', ')}]. There is no first-person mode, on a key, on the ` +
          'wheel, in the options, or through this API.');
      }
      c.mode = m;
    }
    // Apply immediately so a read-back before the next step is truthful.
    const o = c.override;
    c.pos[0] = o.pos[0]; c.pos[1] = o.pos[1]; c.pos[2] = o.pos[2];
    c.pivot[0] = o.look[0]; c.pivot[1] = o.look[1]; c.pivot[2] = o.look[2];
    c.fov = o.fov;
    return this.cameraState();
  }

  // ---- camera (W1-06) ---------------------------------------------------------------
  //
  // RI-CAM05 §F's detector is a SWEEP, not a promise: `listPerspectiveModes()` is what a
  // critic reads, `camera({mode:'first'})` is what a critic calls, and both have to be
  // wrong-proof rather than merely correct today.

  listPerspectiveModes() { return PERSPECTIVE_MODES.slice(); }

  listCameraModes() { return CAMERA_MODES.slice(); }

  /** The rig's DECLARED constants, for the "declared vs observed" pair HARNESS §7 rule 4
   *  wants. The trace is the observation; this is the declaration; they come from the same
   *  module, so a critic diffing them is checking the DATA FILE against both. */
  getCameraRig() {
    return {
      const: { ...CAMERA_CONST },
      alphas: { ...CAMERA_ALPHAS },
      near_corner_radius_m: NEAR_CORNER_R,
      player_collision_radius_m: PLAYER_RADIUS_M,
      modes: CAMERA_MODES.slice(),
      perspective_modes: PERSPECTIVE_MODES.slice(),
      declared_file: 'game/data/camera/rig.json',
      cells: [...this.cells.keys()].sort(),
      cell: this.sim.cellId || null,
    };
  }

  /** Scripted UI entry — RI-CAM05 M2/M3 need `uiOpen("dialogue")` / `uiClose()`. */
  uiOpen(id, opts) {
    const kind = String(id);
    if (kind !== 'dialogue' && kind !== 'menu' && kind !== 'rest') {
      throw new Error(`uiOpen('${kind}'): expected 'dialogue', 'menu' or 'rest'`);
    }
    return { ok: true, mode: cameraOpenUI(this.sim, kind, opts && opts.npcHeadNdcX) };
  }

  uiClose() { return { ok: true, closed: cameraCloseUI(this.sim) }; }

  /** RI-CAM06 §I. The fog gate is the SAME RIG driven to a different target for 90 frames. */
  fogGate(eid) {
    if (eid !== null && eid !== undefined && !this.sim.findEntity(eid)) throw new Error(`fogGate('${eid}'): no such entity`);
    return { ok: true, until: beginFogGate(this.sim, eid === undefined ? null : eid) };
  }

  /** RI-CAM06 §H. */
  deathCamera() { beginDeathCamera(this.sim); return { ok: true, frame: this.sim.frame }; }

  /** Project a world point through the live camera. RI-CAM03's anchors are defined in NDC
   *  precisely so they are aspect- and FOV-independent, and a critic must be able to
   *  recompute them rather than trust `camera.onscreen`. */
  projectPoint(x, y, z) {
    const out = [0, 0, 0];
    const ok = projectNDC(this.sim.camera, [Number(x), Number(y), Number(z)], out);
    return { ndc: [out[0], out[1]], z: out[2], in_front: ok, on_screen: ok && Math.abs(out[0]) <= 1 && Math.abs(out[1]) <= 1 };
  }

  /** Cast the camera's own sphere against the live collision cell. Lets a critic re-derive
   *  the arm length from the pivot and the two angles, which is RI-CAM01's whole bar. */
  castCameraArm(len) {
    const c = this.sim.camera;
    const cell = this.sim.cell || EMPTY_CELL;
    const fwd = [0, 0, 0], right = [0, 0, 0], up = [0, 0, 0];
    cameraBasis(c, fwd, right, up);
    const L = len === undefined ? c.armDesired : Number(len);
    const k = Math.min(1, L / CAMERA_CONST.arm_free_m);
    const to = [
      c.pivot[0] - fwd[0] * L + (right[0] * c.shoulderR + up[0] * c.shoulderU) * k,
      c.pivot[1] - fwd[1] * L + (right[1] * c.shoulderR + up[1] * c.shoulderU) * k,
      c.pivot[2] - fwd[2] * L + (right[2] * c.shoulderR + up[2] * c.shoulderU) * k,
    ];
    const t = cell.sphereCast(c.pivot, to, CAMERA_CONST.cast_radius_m);
    return { t, hit: t < 1, desired_len_m: L, cast_len_m: L * t, cell: this.sim.cellId || null };
  }

  /** Point containment against the same collision set the cast uses (RI-CAM01 §D). */
  solidAt(x, y, z) {
    const cell = this.sim.cell || EMPTY_CELL;
    return { solid: cell.contains(Number(x), Number(y), Number(z)), distance_m: cell.distance(Number(x), Number(y), Number(z)) };
  }

  /** Drive `cam-collision-rig`'s wall along its rail. RI-CAM01 M4's fixture. */
  setCameraObstacle(id, x, y, z) {
    const cell = this.sim.cell || EMPTY_CELL;
    for (const sh of cell.shapes) {
      if (sh.id === String(id)) {
        if (x !== undefined && x !== null) sh.c[0] = Number(x);
        if (y !== undefined && y !== null) sh.c[1] = Number(y);
        if (z !== undefined && z !== null) sh.c[2] = Number(z);
        return { ok: true, id: sh.id, c: [sh.c[0], sh.c[1], sh.c[2]] };
      }
    }
    throw new Error(`setCameraObstacle('${id}'): no such shape in cell '${this.sim.cellId}'`);
  }

  cameraState() {
    const c = this.sim.camera;
    return {
      pos: [c.pos[0], c.pos[1], c.pos[2]],
      look: [c.pivot[0], c.pivot[1], c.pivot[2]],
      fov: c.fov, mode: c.mode, lockOn: this.sim.player.lockOn,
      yaw_deg: c.yaw, pitch_deg: c.pitch, roll_deg: 0,
      overridden: !!c.override,
    };
  }

  /**
   * Scenario contract: open a scripted window on a warm-up-independent world.
   *
   * A harness caller invokes this once, after warm-up and before `queueInputs()`. It
   * re-anchors free-running per-entity clocks (seeded idle phase, pre-window state-entry
   * frame) to the window origin, and RETURNS what it changed so the run report can print it.
   *
   * `RI-MTH02` R5 asks that a 30-frame and a 90-frame warm-up produce identical scripted
   * windows. Without this, they cannot: a 48-frame idle loop is at a different phase after
   * 60 more frames of idling. The two ways out that `AM-W1-00-01` offered were "delete the
   * idle loop" and "lie about the phase in the trace"; this is the third the W1-00 critic
   * named and the amendment did not rebut. It changes the fixture, not the record.
   */
  reanchorFreeRunning() {
    return { frame: this.sim.frame, seed: rng.seed, entities: reanchorFreeRunning(this.sim) };
  }

  // ---- trace ------------------------------------------------------------------------------

  traceStart(opts = {}) {
    this.trace = { records: [], opts: Object.assign({ enemies: true, hitboxes: true, events: true }, opts || {}), startedAtFrame: this.sim.frame };
    this.tracePerf = !!(opts && opts.perf);
    return `trace-${this.sim.frame}`;
  }

  traceDrain() {
    if (!this.trace) return [];
    const r = this.trace.records;
    this.trace.records = [];
    return r;
  }

  traceStop() {
    const r = this.trace ? this.trace.records : [];
    this.trace = null;
    this.tracePerf = false;
    return r;
  }

  /**
   * The current frame as a §5 record. The SAME function builds the trace lines, and the
   * shapes must not drift: RI-MTH01 "How we lose" #5. `perf` is therefore opt-in here
   * exactly as it is opt-in on traceStart({perf:true}) — otherwise snapshot() would carry
   * a block the trace does not and trace-stats.mjs would read two schemas.
   */
  snapshot(opts) {
    const wantPerf = (opts && opts.perf) || this.tracePerf;
    return makeRecord(this.sim, this.input, this.bus, { enemies: true, hitboxes: true, events: true }, wantPerf ? this._perfBlock() : null);
  }

  // ---- perf (A-JRN5) -----------------------------------------------------------------------

  _perfBlock() {
    const s = this.renderer ? this.renderer.lastStats : { drawCalls: 0, triangles: 0 };
    const heap = (performance && performance.memory) ? performance.memory.usedJSHeapSize : 0;
    return {
      simMs: +this.perf.lastSimMs.toFixed(5),
      renderCpuMs: 0,
      drawCalls: s.drawCalls,
      triangles: s.triangles,
      heapUsed: heap,
    };
  }

  getPerfStats() {
    const census = this.renderer ? this.renderer.sceneCensus() : {};
    const s = this.renderer ? this.renderer.lastStats : {};
    const heap = (typeof performance !== 'undefined' && performance.memory) ? performance.memory.usedJSHeapSize : 0;
    return {
      simMs: +this.perf.lastSimMs.toFixed(5),
      renderCpuMs: 0,
      drawCalls: s.drawCalls || 0,
      triangles: s.triangles || 0,
      programsBound: census.programs || 0,
      materials: census.materials || 0,
      stateChanges: s.drawCalls || 0,
      skinnedMeshes: census.skinnedMeshes || 0,
      shadowLights: census.shadowLights || 0,
      textureMB: census.textureMB || 0,
      geometryMB: census.geometryMB || 0,
      heapUsed: heap,
      allocBytesThisStep: null,     // measured externally by tools/platform/alloc-probe.mjs
      simStepsTotal: this.loop.stats.simStepsTotal,
      rendersTotal: this.loop.stats.rendersTotal,
      catchupClamps: this.loop.stats.catchupClamps,
      _unmeasurable: {
        renderCpuMs: 'Tier-H. This container is SwiftShader; a wall-clock render time here is a fact about the software rasteriser, not the game (RI-PLT01 §A/T1).',
        allocBytesThisStep: 'requires --js-flags=--expose-gc and CDP Runtime.getHeapUsage; measured by the runner (A-JRN9), not self-reported.',
      },
    };
  }

  // ---- save (A-JRN3) -------------------------------------------------------------------------

  saveState() { return buildSave(this.sim, BUILD); }

  getStateHash() { return stateHash(this.saveState()); }

  loadState(arg) {
    if (typeof arg === 'string') return this.applyNamedState(arg);
    if (arg && typeof arg === 'object' && arg.meta && arg.meta.schema === 'elder-souls/save@1') {
      const r = applySave(this.sim, arg, this.moves, (id, eid, x, z, f) => this.statFor(id, eid, x, z, f));
      this._applyCell();
      // The camera rig recomputes pivot and pos INSIDE the step (sim/camera.js), so between
      // a load and the first step they still held makeCamera()'s defaults: a snapshot() taken
      // straight after a load reported a camera at the world origin. One settle costs nothing
      // and makes the loaded pose true at frame 0 as well as at frame 1.
      this._settleCamera();
      quantiseColdState(this.sim);
      return r;
    }
    if (arg && typeof arg === 'object' && typeof arg.state === 'string') return this.applyNamedState(arg.state);
    throw new Error('loadState: expected a named state (string) or an elder-souls/save@1 blob');
  }

  async writeSave(slot) {
    const t0 = wallNow();
    const blob = this.saveState();
    blob.volatile.written_at = new Date().toISOString();
    const header = {
      name: this.sim.identity.name, level: this.sim.progression.level,
      region: this.sim.env.region, journal_entries: this.sim.quest.journal.length,
    };
    const rec = await this.store.save(slot, blob, header);
    this.perf.saveWrites++;
    this.perf.lastSaveMs = wallNow() - t0;
    const e = this.bus.emit(this.sim.frame, 'save_write');
    e.slot = slot; e.gen = rec.gen; e.bytes = rec.bytes;
    return { ok: true, slot, gen: rec.gen, bytes: rec.bytes, digest: rec.digest, wallMs: this.perf.lastSaveMs };
  }

  async readSave(slot) {
    const r = await this.store.load(slot);
    if (!r.ok) return r;
    this.loadState(r.state);
    return { ok: true, gen: r.gen, degraded: r.degraded };
  }

  getSaveManifest() { return this.data.saveManifest; }

  /**
   * DURABLE FIELD CENSUS — the instrument that would have caught
   * `GAP-W1-platform-save-drops-entity-prev-state` on the day it was written.
   *
   * `RI-JRN05` M4 is a set difference between the manifest and the SAVE. That check is
   * blind to exactly the defect that hard-failed this piece, twice over:
   *   * `world.entities` is one manifest path (an array leaf), so no path-level check can
   *     see that an entity FIELD is missing;
   *   * and both sides of M4 are the save, so a field that exists in the live simulation
   *     and in the frame record but in NEITHER is invisible to it.
   * `prev_state` was that field. It was in `sim/record.js`, in `makeEntity()`, and in no
   * save; the round trip restored it as `null`; and 219 of 600 post-load frames differed.
   *
   * This runs the differential instead: deep-copy the live simulation, save, load the save
   * back, deep-copy again, and report every live field whose value did not survive. It
   * needs no declaration to be right — a field nobody remembered to declare still shows up.
   *
   * Absolute frame indices are re-based (loadState resets the frame to 0 by RI-MTH01 A07),
   * and the re-based set is DECLARED below rather than skipped silently. Anything else that
   * differs is reported in `unaccounted`, and `ok` is false.
   *
   * It is destructive by construction: it loads the state it just saved. Callers run it on
   * a scratch session (tools/harness/save-audit.mjs does).
   */
  getDurableFieldCensus() {
    // Absolute frame indices, re-based against the frame each copy was taken at. Every entry
    // is a live-object path, and every one of them IS carried in the save as a *_in_frames /
    // *_ago_frames offset — this list is the re-basing rule, not an exclusion list. The two
    // rules differ and the difference is the save's own arithmetic: a `rel()` timer is
    // stored CLAMPED at zero (an expired timer is expired, and reloading it as "expired 120
    // frames ago" would be inventing history), while `state_entered_ago_frames` is a plain
    // difference and re-bases plainly.
    const FRAME_ABSOLUTE_CLAMPED = ['hitstopUntil', 'player.regenBlockUntil', 'player.actionableAt', 'camera.shakeUntil', 'entities[].staggerUntil'];
    const FRAME_ABSOLUTE_PLAIN = ['entities[].stateEnteredF'];
    // The manifest declares 6 dp (rules.float_precision_dp). The projection is therefore
    // lossy by construction below that, and the census compares AT the declared precision
    // rather than pretending the loss is not there: what it reports instead is the largest
    // absolute delta it saw, so a critic can see how big "lossy" is (it is ~1e-7 m).
    const DP = (this.data.saveManifest.rules && this.data.saveManifest.rules.float_precision_dp) || 6;
    const Q = Math.pow(10, DP);
    // Live state that is deliberately NOT durable, each with the reason. A critic can read
    // this list and disagree with it; what it cannot do is not see it.
    const HARNESS_SCOPED = {
      'camera.override': '__HARNESS.camera(pose) poses the camera for a shot. It is a measurement instrument, not player state; a save that carried it would restore a debug camera into a player session. loadState() clears it, as it clears the input pipeline.',
      'env.wallClockOffsetMs': 'A-JRN10 advanceWallClock(). Never read by the simulation and never hashed; it exists so a critic can move an in-world clock without perturbing the fixed step.',
      'input': 'The input pipeline is a per-session device, not saved state. __HARNESS.loadState() calls input.reset(frame) explicitly so a load cannot inherit a half-buffered press from the session that wrote the save.',
      'nextEid': 'Re-derived from the restored eids by applySave(), so a load cannot mint a colliding eid. Carried as a derivation rather than as a field.',
    };

    const clone = (o) => JSON.parse(JSON.stringify(o));
    const shot = (sim) => ({
      frame: sim.frame, seed: sim.seed, stateName: sim.stateName, hitstopUntil: sim.hitstopUntil,
      worldSeed: sim.worldSeed,
      player: clone(sim.player), camera: clone(sim.camera), env: clone(sim.env),
      world: clone(sim.world), progression: clone(sim.progression), quest: clone(sim.quest),
      inventory: clone(sim.inventory), identity: clone(sim.identity),
      entities: sim.entities.map((e) => clone(e)),
    });
    const rebase = (s) => {
      const f = s.frame;
      const clamped = (v) => (typeof v !== 'number' ? v : Math.max(0, v - f));
      const plain = (v) => (typeof v !== 'number' ? v : v - f);
      const o = clone(s);
      o.frame = 0;
      o.hitstopUntil = clamped(o.hitstopUntil);
      o.player.regenBlockUntil = clamped(o.player.regenBlockUntil);
      o.player.actionableAt = clamped(o.player.actionableAt);
      o.camera.shakeUntil = clamped(o.camera.shakeUntil);
      for (const e of o.entities) { e.stateEnteredF = plain(e.stateEnteredF); e.staggerUntil = clamped(e.staggerUntil); }
      delete o.camera.override;
      delete o.env.wallClockOffsetMs;
      return o;
    };

    const frameAtSave = this.sim.frame;
    const before = shot(this.sim);
    const blob = this.saveState();
    this.loadState(clone(blob));
    const after = shot(this.sim);

    const unaccounted = [];
    const lossy = [];
    let maxDelta = 0;
    const walk = (a, b, p) => {
      if (a && b && typeof a === 'object' && typeof b === 'object' && !Array.isArray(a) && !Array.isArray(b)) {
        for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) walk(a[k], b[k], p ? `${p}.${k}` : k);
        return;
      }
      if (Array.isArray(a) && Array.isArray(b) && a.length === b.length) {
        for (let i = 0; i < a.length; i++) walk(a[i], b[i], `${p}[]`);
        return;
      }
      if (typeof a === 'number' && typeof b === 'number' && a !== b) {
        const d = Math.abs(a - b);
        if (Math.round(a * Q) === Math.round(b * Q)) return;          // identical, exactly
        if (d <= 1 / Q) { maxDelta = Math.max(maxDelta, d); lossy.push({ path: p, before: a, after: b, delta: d }); return; }
        unaccounted.push({ path: p, before: a, after: b });
        return;
      }
      if (JSON.stringify(a) !== JSON.stringify(b)) unaccounted.push({ path: p, before: a === undefined ? null : a, after: b === undefined ? null : b });
    };
    walk(rebase(before), rebase(after), '');

    // The entity record's three key sets, compared in both directions. A live entity is used
    // when one exists; otherwise a template is built from a real archetype, so the census is
    // just as sharp on a scenario that spawned nothing.
    const world = (this.data.saveManifest.groups || []).find((g) => g.group === 'World') || {};
    const declared = world.entity_record_fields || [];
    const liveToSave = world.entity_field_live_to_save || {};
    const derived = world.entity_fields_derived_from_the_archetype || [];
    const absent = Object.keys(world.entity_fields_declared_absent || {});
    const archetypes = Object.keys(this.data.enemies).sort();
    const sample = this.sim.entities[0] || makeEntity(this.data.enemies[archetypes[0]], '_census', 0, 0, 0);
    const liveKeys = Object.keys(sample).sort();
    const savedKeys = (blob.world.entities[0] ? Object.keys(blob.world.entities[0]) : declared).slice().sort();
    const accounted = new Set([...Object.keys(liveToSave), ...derived, ...absent]);
    const liveNotDeclared = liveKeys.filter((k) => !accounted.has(k));
    const declaredNotInSave = blob.world.entities[0] ? declared.filter((k) => !savedKeys.includes(k)) : [];
    const inSaveNotDeclared = savedKeys.filter((k) => !declared.includes(k) && blob.world.entities[0]);
    // Third direction: the live->save NAME MAP and the save-side field list must agree, so
    // neither can drift without the other. The map is what makes the live key set checkable
    // at all — the live object is camelCase and the save is snake_case, and `prev_state` hid
    // in exactly that gap.
    const mapValues = Object.values(liveToSave).slice().sort();
    const mapDisagrees = JSON.stringify(mapValues) !== JSON.stringify(declared.slice().sort());
    const nonEmptyDeclaredAbsent = [];
    for (const e of this.sim.entities) {
      for (const k of absent) {
        const v = e[k];
        if (Array.isArray(v) ? v.length : v !== null && v !== undefined && v !== false && v !== 0 && v !== '') {
          nonEmptyDeclaredAbsent.push({ eid: e.eid, field: k, value: clone(v) });
        }
      }
    }

    const ok = unaccounted.length === 0 && liveNotDeclared.length === 0
      && declaredNotInSave.length === 0 && inSaveNotDeclared.length === 0
      && nonEmptyDeclaredAbsent.length === 0 && !mapDisagrees;
    return {
      schema: 'elder-souls/durable-census@1',
      ok,
      frame_at_save: frameAtSave,
      entities_live: this.sim.entities.length,
      entity_sample_is_template: this.sim.entities.length === 0,
      unaccounted,
      entity_keys: {
        live: liveKeys,
        saved: savedKeys,
        declared_durable: declared,
        declared_derived_from_archetype: derived,
        declared_absent: absent,
        live_not_declared_anywhere: liveNotDeclared,
        declared_durable_not_in_save: declaredNotInSave,
        in_save_not_declared: inSaveNotDeclared,
        declared_absent_but_non_empty: nonEmptyDeclaredAbsent,
        live_to_save_map_disagrees_with_field_list: mapDisagrees,
      },
      lossy_at_declared_precision: lossy,
      lossy_max_abs_delta: maxDelta,
      float_precision_dp: DP,
      frame_absolute_fields_rebased: { clamped_at_zero: FRAME_ABSOLUTE_CLAMPED, plain_difference: FRAME_ABSOLUTE_PLAIN },
      declared_not_durable: HARNESS_SCOPED,
      method: 'deep-copy the live sim, saveState(), loadState() it back, deep-copy again, diff every field. Destructive: the session is left holding the reloaded state.',
    };
  }

  getStorageInfo() {
    return this.store.estimate().then((est) => ({
      backend: this.store.backend,
      bytesUsed: est.usage,
      quotaBytes: est.quota,
      writes: this.store.writes,
      lastWriteMs: +this.perf.lastSaveMs.toFixed(3),
      persisted: this.store.persisted,
      notices: this.store.notices.slice(),
      localStorage: this.store.localStorageAudit(),
      volatilePaths: VOLATILE_PATHS,
      schemaVersion: SAVE_SCHEMA_VERSION,
    }));
  }

  exportSave() { return exportSave(this.saveState()); }

  importSave(bytes) {
    const blob = importSave(bytes);
    return this.loadState(blob);
  }

  // ---- load boundaries (A-JRN7, RI-PLT03 §B) ---------------------------------------------------

  _boundaryBegin(kind) {
    const rec = { kind, beganAt: wallNow(), endedAt: null, simFramesLost: 0 };
    this.boundaries.push(rec);
    if (this.bus) { const e = this.bus.emit(this.sim.frame, 'load_boundary_begin'); e.kind = kind; }
    return rec;
  }

  _boundaryEnd(kind) {
    for (let i = this.boundaries.length - 1; i >= 0; i--) {
      if (this.boundaries[i].kind === kind && this.boundaries[i].endedAt === null) {
        this.boundaries[i].endedAt = wallNow();
        break;
      }
    }
    if (this.bus) { const e = this.bus.emit(this.sim.frame, 'load_boundary_end'); e.kind = kind; }
  }

  getLoadState() {
    return {
      phase: this.loadState_.phase,
      bytesFetched: this.loadState_.bytesFetched,
      requestsInFlight: this.loadState_.requestsInFlight,
      regionsResident: this.loadState_.regionsResident.slice(),
      prefetchQueue: this.loadState_.prefetchQueue.slice(),
      boundaries: this.boundaries.map((b) => ({ kind: b.kind, ms: b.endedAt === null ? null : +(b.endedAt - b.beganAt).toFixed(2) })),
      navigationToReadyMs: this.readyResolved ? +(this.firstControlAt !== null ? this.firstControlAt - this.navigationStart : 0).toFixed(2) : null,
      _unmeasurable: {
        TTFP: 'Tier-H (RI-PLT03 §A). navigationStart→first-controllable wall clock on SwiftShader measures the rasteriser. Report TTFP_model instead, with the GPU constant stated.',
      },
    };
  }

  // ---- the province (W1-01) -------------------------------------------------------------

  /** `RI-WLD10` M47/M48: the water field at a point, without moving the player. */
  getWaterAt(x, z) {
    if (!this.field) throw new Error('getWaterAt: no province is loaded');
    return this.field.waterAt(Number(x), Number(z));
  }

  /** The ground at a point: height, slope, region, substrate, land/sea, distance to the coast. */
  getTerrainAt(x, z) {
    if (!this.field) throw new Error('getTerrainAt: no province is loaded');
    const f = this.field, px = Number(x), pz = Number(z);
    const r = f.regionAt(px, pz);
    return {
      x: px, z: pz,
      y: +f.heightAt(px, pz).toFixed(3),
      base_y: +f.baseAt(px, pz).toFixed(3),
      slope_deg: +f.slopeAt(px, pz).toFixed(2),
      region: r.id, region_name: r.name, region_index: f.regionIndexAt(px, pz),
      danger_tier: r.danger_tier,
      land: f.isLandAt(px, pz), ocean: f.isOceanAt(px, pz),
      coast_dist_m: +f.coastDistAt(px, pz).toFixed(1),
      substrate: f.substrateAt(px, pz),
      sea: f.seaAt(px, pz) === 2 ? 'padomaic' : 'topal',
    };
  }

  getRegionAt(x, z) { return this.getTerrainAt(x, z).region; }

  /**
   * Pin the tide. `RI-WLD10` §7's cycle is 12 real minutes with four states; the phase is the
   * only state the simulation keeps, and it is a number, so a critic can hold it still.
   */
  setTide(stateOrPhase) {
    if (!this.field) throw new Error('setTide: no province is loaded');
    const names = { LOW: 0.0, RISING: 0.25, HIGH: 0.5, FALLING: 0.75 };
    let phase;
    if (typeof stateOrPhase === 'string') {
      if (!(stateOrPhase in names)) throw new Error(`setTide('${stateOrPhase}'): states are ${Object.keys(names).join(', ')}`);
      phase = names[stateOrPhase];
    } else {
      const v = Number(stateOrPhase);
      if (!Number.isFinite(v)) throw new Error('setTide(phase): phase must be 0..1 or a named state');
      phase = ((v % 1) + 1) % 1;
    }
    this.field.tidePhase = phase;
    this.sim.env.tidePhase = phase;
    return this.getTide();
  }

  getTide() {
    const f = this.field;
    return {
      phase: +f.tidePhase.toFixed(4),
      state: f.tideState(),
      height_m: { topal: +f.tideHeight(1).toFixed(3), padomaic: +f.tideHeight(2).toFixed(3) },
      cycle_real_min: this.data.water.tide.cycle_real_min,
      mean_range_m: { topal: +f.tideRange[1].toFixed(3), padomaic: +f.tideRange[2].toFixed(3) },
    };
  }

  /** The road network, its named routes, and their lengths as BUILT. */
  getRoutes() {
    const r = this.data.roads;
    return {
      named_routes: r.named_routes,
      total_trunk_m: r.total_trunk_m,
      legs: r.legs.map((l) => ({
        id: l.id, from: l.from, to: l.to, class: l.class, tide_gated: l.tide_gated,
        declared_path_m: l.declared_path_m, built_path_m: l.built_path_m,
        built_walk_min: l.built_walk_min, sinuosity_built: l.sinuosity_built,
        max_grade: l.max_grade, waypoints: l.waypoints, points: l.points.length,
      })),
    };
  }

  getProvinceStats() {
    const t = this.data.terrain;
    return {
      world_bounds_m: t.world_bounds_m,
      cell_m: t.cell_m, cols: t.cols, rows: t.rows,
      elevation_range_m: t.elevation_range_m,
      land_km2: t.land_km2, land_above_sea_km2: t.land_above_sea_km2,
      frac_land_below_5m: t.frac_land_below_5m, frac_land_above_100m: t.frac_land_above_100m,
      regions: t.regions, sites: t.sites.length,
      streaming: this.renderer && this.renderer.province ? this.renderer.province.stats() : null,
    };
  }

  /**
   * Walk a named route on foot, through the ordinary locomotion path, and report what happened.
   *
   * This is `RI-WLD01` M2 and M3's instrument and it is deliberately not a shortcut: every frame
   * it computes the bearing to the next point on the BUILT road spline, converts it to the
   * camera-relative stick vector the player would hold, pushes it through `queueInputs()`, and
   * advances the simulation by exactly one fixed step. The capsule is moved by
   * `combat/player.js`, not by this method — which is the point, because M3 exists to catch an
   * hour manufactured out of friction rather than distance, and a method that teleported the
   * capsule along the spline would be unable to show either.
   *
   * Speed is set by the magnitude of the stick, exactly as a player's would be: 0.55 is the walk
   * band's ceiling, which is `walk_mps` = 2.0 m/s, and 1.0 is the jog.
   *
   * Resumable: pass `chunkFrames` and call again until `done` — 57.6 minutes is 207,360 fixed
   * steps and a single call would sit past a browser automation timeout.
   */
  walkRoute(opts = {}) {
    const o = Object.assign({ route: 'crossing', speed: 'walk', chunkFrames: 40000, sampleEvery: 6, lookahead_m: 4.5, stream: false, restart: false }, opts);
    if (!this.field) throw new Error('walkRoute: no province is loaded');
    const R = this.data.roads;
    if (o.restart || !this._walk || this._walk.route !== o.route || this._walk.speed !== o.speed) {
      const named = R.named_routes[o.route];
      if (!named) throw new Error(`walkRoute: unknown route '${o.route}'. Known: ${Object.keys(R.named_routes).join(', ')}`);
      const pts = [];
      for (let i = 0; i + 1 < named.settlements.length; i++) {
        const a = named.settlements[i], b = named.settlements[i + 1];
        const leg = R.legs.find((l) => (l.from === a && l.to === b) || (l.from === b && l.to === a));
        if (!leg) throw new Error(`walkRoute: no built leg for ${a}-${b}`);
        const p = leg.from === a ? leg.points : leg.points.slice().reverse();
        for (let k = (pts.length ? 1 : 0); k < p.length; k++) pts.push([p[k][0], p[k][1], leg.id]);
      }
      this._walk = {
        route: o.route, speed: o.speed, pts, idx: 1, frames: 0, dist: 0,
        samples: [], legFrames: new Map(), regions: [], lastRegion: null,
        startedFrame: this.sim.frame, done: false,
      };
      this.teleport(pts[0][0], pts[0][1]);
      this.sim.player.pos[1] = this.field.heightAt(pts[0][0], pts[0][1]);
    }
    const w = this._walk;
    // The walk band's ceiling is `mag > 0.55 ? jog : walk * (mag / 0.55)` in combat/player.js, and
    // `mag` is compared AFTER a hypot that can land one ulp above 0.55. One ulp of stick is 12% of
    // the crossing at the jog, so the walk request sits a nanometre under the boundary and the
    // measured ground speed is 2.000 m/s rather than a mixture.
    const mag = o.speed === 'jog' ? 1.0 : o.speed === 'walk' ? 0.55 - 1e-9 : Math.max(0, Math.min(1, Number(o.speed)));
    const p = this.sim.player;
    let n = 0;
    while (n < o.chunkFrames && !w.done) {
      // advance the target along the spline
      while (w.idx < w.pts.length - 1 && Math.hypot(p.pos[0] - w.pts[w.idx][0], p.pos[2] - w.pts[w.idx][1]) < o.lookahead_m) w.idx++;
      const t = w.pts[w.idx];
      const dx = t[0] - p.pos[0], dz = t[1] - p.pos[2];
      const d = Math.hypot(dx, dz);
      if (w.idx >= w.pts.length - 1 && d < 1.5) { w.done = true; break; }
      const b = Math.atan2(dx, dz);
      const cy = this.sim.camera.yaw * Math.PI / 180;
      this.input.reset(this.sim.frame);
      this.input.queueInputs([{ f: 0, move: [Math.sin(b - cy) * mag, Math.cos(b - cy) * mag] }], this.sim.frame);
      const x0 = p.pos[0], z0 = p.pos[2];
      this.loop.stepOnce();
      this._afterStep();
      const step = Math.hypot(p.pos[0] - x0, p.pos[2] - z0);
      w.dist += step;
      w.frames++; n++;
      w.legFrames.set(t[2], (w.legFrames.get(t[2]) || 0) + 1);
      if (w.frames % o.sampleEvery === 0) w.samples.push(+(step * 60).toFixed(4));
      const reg = this.field.regionAt(p.pos[0], p.pos[2]).id;
      if (reg !== w.lastRegion) { w.regions.push({ region: reg, frame: w.frames, m: +w.dist.toFixed(1) }); w.lastRegion = reg; }
      if (o.stream && w.frames % 90 === 0) { this.renderer.province.request(p.pos[0], p.pos[2]); this.renderer.province.pump(1); }
    }
    const s = w.samples;
    const below = s.filter((v) => v < 1.6).length;
    return {
      route: w.route, speed: o.speed, done: w.done,
      frames: w.frames, seconds: +(w.frames / 60).toFixed(2), minutes: +(w.frames / 3600).toFixed(3),
      path_m: +w.dist.toFixed(1),
      declared_route_m: R.named_routes[w.route].metres,
      mean_speed_mps: s.length ? +(s.reduce((a, v) => a + v, 0) / s.length).toFixed(4) : 0,
      min_speed_mps: s.length ? +Math.min(...s).toFixed(4) : 0,
      max_speed_mps: s.length ? +Math.max(...s).toFixed(4) : 0,
      speed_samples: s.length,
      speed_histogram: histogram(s),
      frac_samples_below_1_6: s.length ? +(below / s.length).toFixed(5) : 0,
      leg_minutes: Object.fromEntries([...w.legFrames].map(([k, v]) => [k, +(v / 3600).toFixed(3)])),
      region_sequence: w.regions,
      remaining_points: w.pts.length - w.idx,
    };
  }

  // ---- world / quest queries ----------------------------------------------------------------

  getWorldStats() {
    const d = this.data;
    const census = this.renderer ? this.renderer.sceneCensus() : {};
    const s = this.renderer ? this.renderer.lastStats : {};
    const prov = this.renderer && this.renderer.province ? this.renderer.province.stats() : null;
    return {
      regions: d.regions.regions.length,
      settlements: d.pois.pois.filter((p) => p.kind === 'settlement').length,
      pois: d.pois.pois.length,
      interiors: Object.keys(d.interiors).length,
      npcs: Object.values(d.npcs).reduce((n, g) => n + g.npcs.length, 0),
      areaKm2: d.terrain.land_km2,
      worldBoundsM: d.terrain.world_bounds_m,
      elevationRangeM: d.terrain.elevation_range_m,
      roadNetworkM: d.roads.total_trunk_m,
      crossingM: d.roads.named_routes.crossing.metres,
      crossingWalkMin: d.roads.named_routes.crossing.walk_min,
      streaming: prov,
      drawCalls: s.drawCalls || 0,
      triangles: s.triangles || 0,
      textureMB: census.textureMB || 0,
      // A-JRN8 extensions
      programs: census.programs || 0,
      materials: census.materials || 0,
      stateChanges: s.drawCalls || 0,
      skinnedMeshes: census.skinnedMeshes || 0,
      shadowLights: census.shadowLights || 0,
      geometryMB: census.geometryMB || 0,
      audioMB: 0,
      atlasCount: 0,
      entitiesLive: this.sim.entities.length,
      region: this.sim.env.region,
      interior: this.sim.env.interior,
      _declared_incomplete: {
        owner: 'wave-1 pieces W1-01..W1-05 (world, regions, settlements, interiors, roads)',
        note: 'regions/settlements/pois/interiors/npcs are counted from game/data/**, which is the corpus transcription plus one worked settlement. They are real counts of real data files, not the shipped province, and they change with loadState because the data they count does. audioMB is 0 because there is no audio (RI-AUD02 is unmeasurable in this piece and scores 0, fail-closed).',
      },
    };
  }

  getQuestState() {
    const q = this.sim.quest;
    const active = [];
    const completed = q.completed.slice().sort();
    for (const id of Object.keys(q.quests).sort()) {
      const rec = q.quests[id];
      if (!completed.includes(id)) active.push({ id, stage: rec.stage, branch: rec.branch, failed: !!rec.failed, flags: rec.flags });
    }
    return {
      active,
      completed,
      journal: q.journal.map((e) => ({ n: e.n, date: e.date, quest: e.quest, text: e.text })),
      flags: { ...q.flags },
      topicsKnown: q.topicsKnown.slice().sort(),
      dispositions: { ...q.dispositions },
      factions: JSON.parse(JSON.stringify(q.factions)),
      crime: JSON.parse(JSON.stringify(q.crime)),
      _declared_incomplete: {
        owner: 'wave-1 pieces W1-14..W1-16 (quests) and W1-11..W1-13 (dialogue)',
        implemented: ['quest STATE is real, saved, round-tripped and reported here', 'named states in game/data/states/ set it'],
        missing: ['a quest runtime: no quest in this build can be started, advanced or completed by playing'],
        note: 'This is state, not simulation. Reporting a fabricated active quest would be measurement fraud (RI-MTH04); reporting the real, empty-by-default state is not.',
      },
    };
  }

  listEntities() {
    return this.sim.entities.map((e) => ({ eid: e.eid, archetype: e.archetype, pos: [e.pos[0], e.pos[1], e.pos[2]], hp: e.hp }));
  }

  /** Everything W1-09 owns, in one call, for a critic that does not want to expand a trace. */
  getCombatState() {
    const c = this.combat;
    const p = c.player;
    return {
      schema: 'elder-souls/combat-state@1',
      unit: 'f@60',
      frame: this.sim.frame,
      player: {
        state: p.state, anim: p.anim, anim_frame: p.animFrame,
        move: p.move ? { id: p.move.id, startup: p.move.startup, active: p.move.active, recovery: p.move.recovery, total: p.move.total, iframes: p.move.iframes } : null,
        actionable_at: p.actionableAt,
        hp: p.hp, hp_max: p.hpMax,
        stamina: p.stamina, stamina_max: p.staminaMax,
        regen_blocked_until: p.regenBlockUntil,
        exhausted: p.exhausted,
        poise_health: p.poiseHealth, poise_health_max: p.poiseHealthMax,
        invuln: p.iframe, guard: p.guardRaised, shield: p.shieldId,
        equip_load_pct: p.equipLoadPct, tier: c.tierOf(p),
        estus: c.playerCtl.estus, flask_level: c.playerCtl.flaskLevel,
        stamina_drops: p.staminaDrops || 0,
        weapon: p.moves._movesetId, weapon_class: p.moves._classKey,
        pos: [p.pos[0], p.pos[1], p.pos[2]], yaw_deg: p.yaw,
      },
      lock: { target: c.lock.target, score: c.lock.score, both_framed: c.lock.bothFramed },
      world_knowledge: { gold: c.world.gold, topicsKnown: c.world.topicsKnown, dispositions: c.world.dispositions, factions: c.world.factions },
      enemies: c.bodies.filter((b) => b !== p).map((b) => ({
        id: b.id, statblock: b.statId, state: b.state, anim: b.anim, anim_frame: b.animFrame,
        move: b.move ? b.move.id : null, hp: b.hp, hp_max: b.hpMax,
        poise_health: b.poiseHealth, poise_health_max: b.poiseHealthMax,
        stamina: b.stamina, stamina_max: b.staminaMax,
        guard: b.guardRaised, dead: b.dead, yielded: b.yielded,
        parley: b.parley ? { grounds: b.parley.grounds, faction: b.parley.faction, rank_required: b.parley.rank_required, gold_price: b.parley.gold_price, true_name_topic: b.parley.true_name_topic } : null,
        dist_m: c.distTo(b), bearing_deg: c.bearingFromPlayer(b),
      })),
      state_enums: CombatSystem.stateEnums(),
    };
  }

  getPlayerStats() {
    const p = this.sim.player;
    return {
      pos: p.pos.slice(), yaw_deg: p.yaw, state: p.state, anim: p.anim, anim_frame: p.animFrame,
      hp: p.hp, hp_max: p.hpMax, stamina: p.stamina, stamina_max: p.staminaMax,
      poise_cur: p.poise, poise_max: p.poiseMax, estus: p.estus, locked_on: p.lockOn,
      level: this.sim.progression.level, souls: this.sim.progression.soulsHeld,
      attributes: { ...this.sim.progression.attributes },
      equip_load_pct: p.equipLoadPct, roll_class: p.rollClass,
    };
  }

  getInputState() {
    const base = this.real ? this.real.getInputState() : {
      pointerLocked: false, hasFocus: true, activeDevice: 'scripted', deviceClass: 'harness',
      held: this.input.heldNames().slice(), bindings: null, droppedInputs: this.input.droppedInputs,
    };
    base.mode = this.mode;
    base.bufferFrames = this.data ? this.data.input.buffer_frames : null;
    base.buffered = this.input.bufferedAction || null;
    base.violations = violations.length;
    return base;
  }

  advanceWallClock(ms) {
    // A-JRN10. Deliberately does NOT touch the fixed sim clock or the trace hash: it moves
    // in-world time only, which is what "eleven days later" actually means.
    const v = Number(ms);
    if (!Number.isFinite(v) || v < 0) throw new Error('advanceWallClock(ms): ms must be a non-negative number');
    const hours = v / 3600000;
    const total = this.sim.env.timeOfDay + hours;
    this.sim.env.dayCount += Math.floor(total / 24);
    this.sim.env.timeOfDay = ((total % 24) + 24) % 24;
    for (const a of this.sim.quest.afflictions) {
      a.incubation_in_frames = Math.max(0, a.incubation_in_frames - Math.round(v / 1000 * 60));
    }
    return { timeOfDay: this.sim.env.timeOfDay, dayCount: this.sim.env.dayCount };
  }
}

/** Ground-speed distribution, so M3's tail is visible rather than summarised away. */
function histogram(s) {
  const edges = [0, 0.5, 1.0, 1.6, 1.9, 1.99, 2.01, 2.5, 3.0, 3.3, 99];
  const bins = new Array(edges.length - 1).fill(0);
  for (const v of s) { for (let i = 0; i < bins.length; i++) if (v >= edges[i] && v < edges[i + 1]) { bins[i]++; break; } }
  const out = {};
  for (let i = 0; i < bins.length; i++) out[`${edges[i]}-${edges[i + 1]}`] = bins[i];
  return out;
}

function deepAssign(target, src) {
  for (const k of Object.keys(src)) {
    if (src[k] && typeof src[k] === 'object' && !Array.isArray(src[k]) && target[k] && typeof target[k] === 'object' && !Array.isArray(target[k])) {
      deepAssign(target[k], src[k]);
    } else target[k] = src[k];
  }
}

// ---- data loading -------------------------------------------------------------------------

async function loadData(onBytes) {
  const root = new URL('../data/', import.meta.url);
  const fetchJson = async (rel) => {
    const res = await fetch(new URL(rel, root));
    if (!res.ok) throw new Error(`data file missing: ${rel} (${res.status})`);
    const text = await res.text();
    onBytes(text.length);
    return JSON.parse(text);
  };
  const index = await fetchJson('index.json');
  const out = { index, enemies: {}, npcs: {}, interiors: {}, settlements: {}, states: {}, topics: {}, quests: {}, books: {}, items: {}, combat: {}, movesets: {} };
  const bucketFor = (path) => {
    if (path.startsWith('combat/enemies/')) return 'enemies';
    if (path.startsWith('npcs/')) return 'npcs';
    if (path.startsWith('world/interiors/')) return 'interiors';
    if (path.startsWith('world/settlements/')) return 'settlements';
    if (path.startsWith('states/')) return 'states';
    if (path.startsWith('dialogue/topics/')) return 'topics';
    if (path.startsWith('quests/')) return 'quests';
    if (path.startsWith('books/')) return 'books';
    if (path.startsWith('items/')) return 'items';
    return null;
  };
  for (const entry of index.files) {
    const doc = await fetchJson(entry.path);
    const b = bucketFor(entry.path);
    if (b) out[b][doc.id || entry.path.split('/').pop().replace(/\.json$/, '')] = doc;
    else if (entry.path === 'world/regions.json') out.regions = doc;
    else if (entry.path === 'world/pois.json') out.pois = doc;
    else if (entry.path === 'world/terrain.json') out.terrain = doc;
    else if (entry.path === 'world/water.json') out.water = doc;
    else if (entry.path === 'world/roads.json') out.roads = doc;
    else if (entry.path === 'world/hazards.json') out.hazards = doc;
    else if (entry.path === 'world/landmask.json') out.landmask = doc;
    else if (entry.path === 'camera/cells.json') out.cameraCells = doc;
    else if (entry.path === 'camera/rig.json') out.cameraRig = doc;
    else if (entry.path === 'camera/targets.json') out.cameraTargets = doc;
    else if (entry.path === 'save-manifest.json') out.saveManifest = doc;
    else if (entry.path === 'combat/input.json') out.input = doc;
    else if (entry.path.startsWith('combat/movesets/')) out.movesets[doc.id] = doc;
    else if (entry.path.startsWith('combat/')) out.combat[entry.path.slice('combat/'.length).replace(/\.json$/, '')] = doc;
    else if (entry.path === 'dialogue/greetings.json') out.greetings = doc;
    else if (entry.path === 'dialogue/rumours.json') out.rumours = doc;
    else if (entry.path === 'dialogue/creation-questions.json') out.creationQuestions = doc;
    else if (entry.path === 'world/encounters.json') out.encounters = doc;
    else if (entry.path.startsWith('progression/')) {
      out.progression = out.progression || {};
      out.progression[doc.schema] = doc;
      // W1-07: also key by id, because a consumer wants `progression.races`, not
      // `progression['elder-souls/races@1']`, and the schema key must stay for W1-00's readers.
      if (doc.id) out.progression[doc.id] = doc;
    }
  }
  // W1-07 — the character-creation view of the data, assembled once at boot so that
  // game/src/character/** and tools/analysis/creation-audit.mjs consume the identical object.
  out.character = {
    attributes: out.progression['attributes'],
    skills: out.progression['skills'],
    races: out.progression['races'],
    classes: out.progression['classes'],
    birthsigns: out.progression['birthsigns'],
    reactions: out.progression['race-reactions'],
    creation: out.progression['creation'],
    creationQuestions: out.creationQuestions,
    encounters: out.encounters,
    writHouse: out.topics['writ-house'],
    writItems: out.items['writ'],
    npcs: out.npcs['writ-house'],
  };
  for (const k of Object.keys(out.character)) {
    if (!out.character[k]) throw new Error(`character data missing: ${k} (W1-07 expects it in game/data/**)`);
  }
  return out;
}

function r4c(v) { return Math.round(v * 1e4) / 1e4; }
