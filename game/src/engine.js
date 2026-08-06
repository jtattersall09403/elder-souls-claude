// The engine: the one object that owns the simulation, the loop, the renderer, the input
// pipeline and the save store, and the only thing window.__HARNESS talks to.
'use strict';

import { rng } from './core/rng.js';
import { installGuards, wallNow, violations } from './core/guards.js';
import { FixedLoop, FIXED_HZ, STEP_MS } from './core/loop.js';
import { SimState } from './sim/state.js';
import { EventBus } from './sim/events.js';
import { stepOnce } from './sim/step.js';
import { makeRecord } from './sim/record.js';
import { makeEntity, reanchorFreeRunning } from './sim/entities.js';
import { InputPipeline } from './input/pipeline.js';
import { RealInput } from './input/real.js';
import { Renderer } from './render/renderer.js';
import { WEATHER } from './render/sky.js';
import { SaveStore } from './save/store.js';
import { buildSave, applySave, stateHash, VOLATILE_PATHS, SAVE_SCHEMA_VERSION } from './save/state.js';
import { exportSave, importSave } from './save/exchange.js';
import { canonicalise } from './core/canonical.js';

/** Pre-allocated depth of the sim-time ring in `Engine.perf`. */
const PERF_SAMPLES = 20000;

export const BUILD = {
  name: 'elder-souls',
  version: '0.1.0-w1-00',
  harnessVersion: 1,
  fixedStepHz: FIXED_HZ,
  dataRoot: 'game/data',
  piece: 'W1-00 — harness, determinism and persistence',
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

  get moves() { return this.data.moveset.moves; }

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
    this._applyCell();
    for (const s of patch.spawn || []) this.spawn(s.id, s.x, s.z, { as: s.as });
    // Put the player on the ground of whatever cell the state names.
    sim.player.pos[1] = this.groundAt(sim.player.pos[0], sim.player.pos[2]);
    this._settleCamera();
    return { ok: true, frame: sim.frame, seed: rng.seed };
  }

  /** Which renderable cell the current environment corresponds to. */
  cellFor(env) {
    if (env.region === 'arena') return 'arena';
    if (env.interior === 'dungeon-primary') return 'dungeon';
    if (env.interior) return 'interior';
    return 'exterior';
  }

  groundAt(x, z) {
    if (!this.renderer) return 0;
    return this.renderer.groundAt(x, z, undefined, this.cellFor(this.sim.env));
  }

  _applyCell() {
    if (!this.renderer) return;
    this.renderer.setCell(this.cellFor(this.sim.env));
    this.renderer.setProp('npcShowcase', this.sim.stateName === 'npc_showcase');
    this.renderer.setProp('materialShowcase', this.sim.stateName === 'material_showcase');
  }

  _settleCamera() {
    // One camera update with no input, so the pose is correct before the first step.
    const c = this.sim.camera;
    c.pivot[0] = this.sim.player.pos[0];
    c.pivot[1] = this.sim.player.pos[1] + 1.55;
    c.pivot[2] = this.sim.player.pos[2];
    const yaw = c.yaw * Math.PI / 180, pitch = c.pitch * Math.PI / 180, cp = Math.cos(pitch);
    c.pos[0] = c.pivot[0] - Math.sin(yaw) * cp * c.dist;
    c.pos[1] = c.pivot[1] - Math.sin(pitch) * c.dist;
    c.pos[2] = c.pivot[2] - Math.cos(yaw) * cp * c.dist;
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
    stepOnce(this.sim, this.input, this.moves, this.bus);
  }

  /**
   * Everything that observes a step, run strictly after the step has finished: the trace
   * record, and the first-control stamp. Never on the sim-step stack, never inside
   * `stepOnce`'s timing window, so `perf.lastSimMs` and every allocation profile taken over
   * `stepFrames` describe the simulation and not the instrument.
   */
  _afterStep() {
    if (this.firstControlAt === null && this.sim.frame > 0) this.firstControlAt = wallNow();
    if (this.trace) {
      this.trace.records.push(makeRecord(this.sim, this.input, this.bus, this.trace.opts, this.tracePerf ? this._perfBlock() : null));
    }
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
    this.sim.nextEid++;
    return eid;
  }

  despawn(eid) {
    const i = this.sim.entities.findIndex((e) => e.eid === eid);
    if (i < 0) throw new Error(`despawn('${eid}'): no such entity`);
    this.sim.entities.splice(i, 1);
    return true;
  }

  aggro(eid) {
    const e = this.sim.findEntity(eid);
    if (!e) throw new Error(`aggro('${eid}'): no such entity`);
    e.alert = 100;
    e.alertState = 'AGGRO';
    return true;
  }

  lockOn(eid) {
    if (eid !== null && !this.sim.findEntity(eid)) throw new Error(`lockOn('${eid}'): no such entity`);
    this.sim.player.lockOn = eid;
    this.sim.camera.mode = eid ? 'locked' : 'free';
    return true;
  }

  teleport(x, z, opts = {}) {
    const p = this.sim.player;
    p.pos[0] = Number(x);
    p.pos[2] = Number(z);
    p.pos[1] = opts.y !== undefined ? Number(opts.y) : this.groundAt(p.pos[0], p.pos[2]);
    if (opts.yaw !== undefined) p.yaw = Number(opts.yaw);
    this._settleCamera();
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
    if (pose.mode) c.mode = String(pose.mode);
    // Apply immediately so a read-back before the next step is truthful.
    const o = c.override;
    c.pos[0] = o.pos[0]; c.pos[1] = o.pos[1]; c.pos[2] = o.pos[2];
    c.pivot[0] = o.look[0]; c.pivot[1] = o.look[1]; c.pivot[2] = o.look[2];
    c.fov = o.fov;
    return this.cameraState();
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

  // ---- world / quest queries ----------------------------------------------------------------

  getWorldStats() {
    const d = this.data;
    const census = this.renderer ? this.renderer.sceneCensus() : {};
    const s = this.renderer ? this.renderer.lastStats : {};
    return {
      regions: d.regions.regions.length,
      settlements: d.pois.pois.filter((p) => p.kind === 'settlement').length,
      pois: d.pois.pois.length,
      interiors: Object.keys(d.interiors).length,
      npcs: Object.values(d.npcs).reduce((n, g) => n + g.npcs.length, 0),
      areaKm2: d.regions.total_land_km2,
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
  const out = { index, enemies: {}, npcs: {}, interiors: {}, settlements: {}, states: {}, topics: {}, quests: {}, books: {}, items: {} };
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
    else if (entry.path === 'save-manifest.json') out.saveManifest = doc;
    else if (entry.path === 'combat/input.json') out.input = doc;
    else if (entry.path.startsWith('combat/movesets/')) out.moveset = doc;
    else if (entry.path === 'dialogue/greetings.json') out.greetings = doc;
    else if (entry.path === 'dialogue/rumours.json') out.rumours = doc;
    else if (entry.path.startsWith('progression/')) (out.progression = out.progression || {})[doc.schema] = doc;
  }
  return out;
}
