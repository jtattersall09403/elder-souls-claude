// window.__HARNESS — the single seam between this game and every critic in the project.
// Contract: corpus/80-methods/HARNESS.md §3, scored by RI-MTH01.
//
// Two rules govern everything in this file:
//
//  1. **Errors are loud** (HARNESS.md R7). Every method either does the thing or throws.
//     Nothing here swallows an error and returns a plausible-looking object.
//
//  2. **A method that cannot do its job says so, in its return value, by name.** Where a
//     capability belongs to a wave-1 piece that is not this one, the method is present with
//     its documented signature and contract, does whatever part of the job is genuinely
//     available, and marks the rest with `_declared_incomplete`. Returning a plausible
//     value without doing the thing scores −2 under RI-MTH01 and is treated as measurement
//     fraud under RI-MTH04; a declared gap is neither.
'use strict';

import { Engine, BUILD } from '../engine.js';
import { FIXED_HZ } from '../core/loop.js';
import { violations } from '../core/guards.js';
import { ACTIONS } from '../input/actions.js';
import { DEFAULT_BINDINGS, RESERVED_CONTROLS, auditBindings } from '../input/bindings.js';
import { canonicalise, stateDiff, leafPaths } from '../core/canonical.js';
import { VOLATILE_PATHS } from '../save/state.js';
import { installWeaponsHarness } from './weapons.js';
// W1-14 round 2: the RI-MAG06 registry, so `getEffectConsumerMap()` reports the build's own
// declaration rather than a second list that could drift from it.
import { HANDLERS as MAGIC_HANDLERS, DAMAGE_EFFECTS as MAGIC_DAMAGE_EFFECTS } from '../sim/magic/apply.js';
import { mitigate } from '../combat/resolve.js';
import { mirror as mirrorView } from '../sim/combat-bridge.js';

// W1-14: RI-MAG01's harness amendments are ADDITIONS, so the contract moves 1 -> 2 exactly as
// that item's provenance note requires. Everything `@1` emitted is still emitted, unchanged.
export const HARNESS_VERSION = 2;

export function installHarness(engine, bootPromise) {
  const H = {
    version: HARNESS_VERSION,

    // ---- lifecycle -----------------------------------------------------------------
    async ready() { await bootPromise; return true; },

    getBuildInfo() {
      return {
        name: BUILD.name,
        version: BUILD.version,
        commit: (typeof window !== 'undefined' && window.__ES_COMMIT) || null,
        builtAt: (typeof window !== 'undefined' && window.__ES_BUILT_AT) || null,
        harnessVersion: HARNESS_VERSION,
        fixedStepHz: FIXED_HZ,
        dataRoot: BUILD.dataRoot,
        piece: BUILD.piece,
        threeVersion: (typeof window !== 'undefined' && window.__ES_THREE) || null,
        dataFiles: engine.data ? engine.data.index.file_count : null,
      };
    },

    setMode(mode) { return engine.setMode(mode); },

    reset(opts = {}) {
      if (opts && opts.seed !== undefined) H.setSeed(opts.seed);
      const r = engine.applyNamedState((opts && opts.state) || engine.sim.stateName || 'default');
      engine.input.reset(engine.sim.frame);
      return { ok: true, frame: engine.sim.frame, seed: H.getSeed() };
    },

    loadState(state) {
      const r = engine.loadState(state);
      engine.input.reset(engine.sim.frame);
      return { ok: true, frame: engine.sim.frame, seed: H.getSeed(), ...r };
    },

    saveState() { return engine.saveState(); },

    // ---- determinism -----------------------------------------------------------------
    // D6 "seed before load": setSeed reseeds the global PRNG and is honoured by the NEXT
    // loadState/reset. It does not itself rebuild the world, so `setSeed → loadState` is
    // the documented authoritative order (RI-MTH02 R6) and the one tools/lib/run.mjs uses.
    setSeed(n) {
      const v = Number(n);
      if (!Number.isFinite(v) || !Number.isInteger(v) || v < 0) throw new Error(`setSeed(${JSON.stringify(n)}): expected a non-negative integer`);
      return engine.setSeed(v >>> 0);
    },
    getSeed() { return engine.sim.seed; },

    // ---- time -------------------------------------------------------------------------
    stepFrames(n) { return engine.stepFrames(n); },
    getFrame() { return engine.sim.frame; },

    // ---- input ------------------------------------------------------------------------
    queueInputs(script) { return engine.input.queueInputs(script, engine.sim.frame); },
    clearInputs() { return engine.input.clearInputs(engine.sim.frame); },

    // ---- observation --------------------------------------------------------------------
    snapshot(opts) { return engine.snapshot(opts); },
    // Scenario contract (RI-MTH02 R5, AM-W1-00-02): re-anchor free-running per-entity
    // clocks at the frame the scripted window opens. Called after warm-up, before
    // queueInputs(). Returns exactly what it changed, for the run report.
    reanchorFreeRunning() { return engine.reanchorFreeRunning(); },
    traceStart(opts) { return engine.traceStart(opts); },

    // ================= W1-09 combat core =================================================
    // RI-CMB07's es-combat-trace/1, emitted as a SECOND STREAM from the same run — the
    // arrangement §A already specifies for the RI-AI01 enemy stream. elder-souls/trace@1
    // stays exactly as W1-00 shipped it.
    combatTraceStart(opts) { return engine.combatTraceStart(opts || {}); },
    combatTraceDrain() { return engine.combatTraceDrain(); },
    combatTraceMeta() { return engine.combatTraceMeta(); },
    combatTraceStop() { return engine.combatTraceStop(); },

    /**
     * RI-CMB04's mandatory debug channel. The item is explicit: "If that channel does not
     * exist, this item scores 0 — the geometry is unauditable and therefore not a bar." It
     * dumps every hurtbox capsule, every bone origin and both the current and previous weapon
     * socket pair, in world space, so a critic can recompute the analytic sweep offline and
     * diff it against what the simulation decided.
     */
    getHitGeometry() { return engine.getHitGeometry(); },

    /** Seam S23's crossing: RI-PRG07 sets the number, RI-CMB01 decides what it does in a fight. */
    setEquipLoad(pct) { return engine.setEquipLoad(pct); },

    /** Re-equip and rebuild the move table in place. The 14-row frame census needs it. */
    setLoadout(patch) { return engine.setLoadout(patch || {}); },

    /** RI-CMB07 M1 Mode-A: the enemy executes scripted actions on the exact frames given. */
    queueEnemyScript(eid, script) { return engine.queueEnemyScript(eid, script); },

    /** AR-3: the out-of-fight state the in-fight parley reads. */
    setWorldKnowledge(patch) { return engine.setWorldKnowledge(patch || {}); },
    getCombatState() { return engine.getCombatState(); },
    traceDrain() { return engine.traceDrain(); },
    traceStop() { return engine.traceStop(); },

    // ---- world manipulation ---------------------------------------------------------------
    teleport(x, z, opts) { return engine.teleport(x, z, opts || {}); },
    spawn(id, x, z, opts) { return engine.spawn(id, x, z, opts || {}); },
    despawn(eid) { return engine.despawn(eid); },
    aggro(eid) { return engine.aggro(eid); },
    lockOn(eid) { return engine.lockOn(eid === undefined ? null : eid); },
    setTimeOfDay(h) { return engine.setTimeOfDay(h); },
    setWeather(id) { return engine.setWeather(id); },
    camera(pose) { return engine.camera(pose === undefined ? null : pose); },
    listAnchors() { return engine.renderer.listAnchors(); },

    // ---- camera (W1-06) — the surface RI-CAM01..07's methods name -----------------------
    // RI-CAM05 §F: `listPerspectiveModes()` must return exactly ["third"], and
    // `camera({mode:'first'})` must THROW. Both are wired to the same closed vocabulary in
    // sim/camera.js, so they cannot disagree.
    listPerspectiveModes() { return engine.listPerspectiveModes(); },
    listCameraModes() { return engine.listCameraModes(); },
    getCameraRig() { return engine.getCameraRig(); },
    setCameraCell(id) { return engine.setCameraCell(id === undefined ? null : id); },
    uiOpen(id, opts) { return engine.uiOpen(id, opts || {}); },
    uiClose() { return engine.uiClose(); },
    fogGate(eid) { return engine.fogGate(eid === undefined ? null : eid); },
    deathCamera() { return engine.deathCamera(); },
    projectPoint(x, y, z) { return engine.projectPoint(x, y, z); },
    castCameraArm(len) { return engine.castCameraArm(len); },
    solidAt(x, y, z) { return engine.solidAt(x, y, z); },
    setCameraObstacle(id, x, y, z) { return engine.setCameraObstacle(id, x, y, z); },
    // RI-CAM01 M2 / RI-CAM05 M4/M5's scripted navmesh-spine traversal. Without it neither
    // method can be run at all, and both are weighted 25.
    cameraRoute(opts) { return engine.cameraRoute(opts || {}); },
    cameraRouteEnd() { return engine.cameraRouteEnd(); },
    cameraRouteState() { return engine.cameraRouteState(); },
    // RI-CAM03 M3's scripted adversarial target, and RI-CAM06 M7's shake fixture.
    getCameraFrame() { return engine.getCameraFrame(); },
    setEntityPos(eid, x, z, opts) { return engine.setEntityPos(eid, x, z, opts || {}); },
    triggerCameraShake(hpFraction) { return engine.triggerCameraShake(hpFraction); },
    setUIVisible(v) { return engine.renderer.setUIVisible(v); },

    // ---- weapons (W1-10) ---------------------------------------------------------------
    // The extensions RI-WPN01 §Comparison-method, RI-WPN03 M2, RI-WPN04 M2 and RI-WPN05 M5
    // ask for, supplied as pure functions of game/data/weapons/**. See game/src/harness/weapons.js
    // for what is still missing and why scoring it 0 fail-closed is correct.
    get weapons() {
      if (!this._weapons) { engine.data._engine = engine; this._weapons = installWeaponsHarness(engine.data); }
      return this._weapons;
    },

    // ---- queries ----------------------------------------------------------------------------
    listEntities() { return engine.listEntities(); },
    getPlayerStats() {
      const st = engine.getPlayerStats();
      // RI-MAG01 harness amendment 5: extend getPlayerStats() with effects_active.
      if (engine.magic) {
        const m = engine.magic.report(engine.sim.frame);
        st.focus = m.focus; st.focus_max = m.focus_max; st.focus_locked = m.focus_locked;
        st.attuned = m.attuned; st.effects_active = m.effects_active;
        st.levitating = m.levitating; st.airborne = m.airborne; st.altitude_m = m.altitude_m;
      }
      return st;
    },
    getWorldStats() { return engine.getWorldStats(); },
    getQuestState() { return engine.getQuestState(); },

    // ---- the province (W1-01) ---------------------------------------------------------
    // Added by wave-1 piece W1-01 and documented in game/README.md. RI-WLD10 §12 formally
    // requested getWaterAt() and setTide(); the rest is what RI-WLD01 M1-M5, RI-WLD04 M18 and
    // RI-WLD07 M36 need in order to be measurements rather than assertions.
    getWaterAt(x, z) { return engine.getWaterAt(x, z); },
    getTerrainAt(x, z) { return engine.getTerrainAt(x, z); },
    getRegionAt(x, z) { return engine.getRegionAt(x, z); },
    // RI-WLD04 M19. `signatureAudit()` re-derives each instance's region from the region raster,
    // so it reports where the thing actually is and not what it was labelled.
    getSignatures(filter) { return engine.getSignatures(filter); },
    signatureAudit() { return engine.signatureAudit(); },
    // RI-WLD07 max walkable slope + the fall; RI-WLD10 bands, stamina, breath, mire; S25 denial.
    getTraversalReport() { return engine.getTraversalReport(); },
    // RI-WLD11: the hazards live at the player's position, their telegraph state and their cost.
    getHazardReport() { return engine.getHazardReport(); },
    getRegionSignature(x, z) { return engine.getRegionSignature(x, z); },
    setTide(stateOrPhase) { return engine.setTide(stateOrPhase); },
    getTide() { return engine.getTide(); },
    getRoutes() { return engine.getRoutes(); },

    // ---- RI-TRV01 / AR-2 B13 — the transport network -----------------------------------------
    // B13's fail condition is ABSENCE: `Object.keys(__HARNESS)` used to contain no travel, board,
    // station, fare, strider, boat or barge verb, so zero modalities boarded from zero settlements.
    getTravelNetwork() { return engine.getTravelNetwork(); },
    getTravelState() { return engine.getTravelState(); },
    travelQuote(serviceId) { return engine.travelQuote(String(serviceId)); },
    travelFare(metres, mode) { return engine.travelFare(metres, mode); },
    boardTravel(serviceId, opts) { return engine.boardTravel(String(serviceId), opts || {}); },
    travelRide(frames) { return engine.travelRide(frames); },
    listStations() { return engine.getTravelNetwork().stations || []; },

    // ---- RI-PRG07 §3 — burden, the out-of-fight half of carrying things -----------------------
    setBurden(arg) { return engine.setBurden(arg); },
    getBurden() { return engine.getBurden(); },
    getProvinceStats() { return engine.getProvinceStats(); },
    walkRoute(opts) { return engine.walkRoute(opts); },
    walkPath(points, opts) { return engine.walkPath(points, opts || {}); },
    streamAround(x, z, budget) {
      if (!engine.renderer.province) throw new Error('streamAround: no province is loaded');
      const queued = engine.renderer.province.request(Number(x), Number(z));
      const built = budget === undefined ? engine.renderer.province.drain() : engine.renderer.province.pump(Number(budget));
      return { queued, built, ...engine.renderer.province.stats() };
    },

    // ---- rendering ---------------------------------------------------------------------------
    renderFrame() { engine.loop.renderNow(); return true; },
    async screenshot() { engine.loop.renderNow(); return engine.renderer.screenshotDataURL(); },

    // ================= amendments requested by the journey and platform items =================
    // JOURNEY-CRITIC-FLEET.md §7. Each item that needs one says "until it lands this is
    // unmeasurable and scores 0, fail-closed". They are implemented here so the items this
    // piece is judged by are measurable at all.

    // A-JRN3 — save instrumentation.
    getStateHash() { return engine.getStateHash(); },
    getSaveManifest() {
      const manifest = engine.getSaveManifest();
      const blob = engine.saveState();
      const dynamic = new Set(manifest.rules.dynamic_containers);
      const declared = new Set();
      for (const g of manifest.groups) for (const p of g.paths) declared.add(p);
      const actual = new Set(pathsOf(blob, dynamic));
      return {
        ...manifest,
        computed: {
          declared_paths: [...declared].sort(),
          actual_paths: [...actual].sort(),
          in_save_not_on_manifest: [...actual].filter((p) => !declared.has(p)).sort(),
          on_manifest_not_in_save: [...declared].filter((p) => !actual.has(p)).sort(),
        },
      };
    },
    /**
     * Which LIVE simulation fields do not survive a save and a load. Destructive: it loads
     * the state it saves. This is the instrument that would have caught
     * GAP-W1-platform-save-drops-entity-prev-state — see Engine.getDurableFieldCensus().
     */
    getDurableFieldCensus() { return engine.getDurableFieldCensus(); },
    exportSave() { return engine.exportSave(); },
    importSave(bytes) { return engine.importSave(bytes); },
    getStorageInfo() { return engine.getStorageInfo(); },
    simulateStorageFailure(kind, slot) { return engine.store.simulateStorageFailure(kind, slot); },
    writeSave(slot) { return engine.writeSave(String(slot || 'slot-a')); },
    readSave(slot) { return engine.readSave(String(slot || 'slot-a')); },
    listSaveSlots() { return engine.store.listSlots(); },
    deleteSaveSlot(slot) { return engine.store.deleteSlot(String(slot)); },

    /** The round trip, run in-page so a critic gets the hashes and the diff in one call. */
    saveRoundTrip() {
      const h0 = engine.getStateHash();
      const before = engine.saveState();
      const blob = JSON.parse(JSON.stringify(before));
      engine.loadState(blob);
      const after = engine.saveState();
      const h1 = engine.getStateHash();
      return {
        hash_before: h0,
        hash_after: h1,
        equal: h0 === h1,
        volatile_excluded: VOLATILE_PATHS,
        diff: stateDiff(before, after, VOLATILE_PATHS),
        canonical_bytes: canonicalise(before).length,
      };
    },

    // A-JRN5 — per-frame perf stats.
    getPerfStats() { return engine.getPerfStats(); },

    // A-JRN6 — input observability.
    getInputState() { return engine.getInputState(); },
    getActionSet() {
      return {
        actions: ACTIONS.slice(),
        bindings: DEFAULT_BINDINGS,
        reserved: RESERVED_CONTROLS,
        audit: auditBindings(),
        bufferFrames: engine.data.input.buffer_frames,
        bufferSlots: engine.data.input.buffer_slots,
        catchupCap: engine.data.input.catchup_cap_steps,
      };
    },

    // A-JRN10 — in-world clock advance that does NOT perturb the fixed step or the hash.
    advanceWallClock(ms) { return engine.advanceWallClock(ms); },

    // A-JRN11 — render decoupling and stalls.
    setRenderRate(hz) { return engine.loop.setRenderRate(hz); },
    getRenderRate() { return engine.loop.renderRateHz; },
    stallMainThread(ms) { return engine.loop.stallMainThread(ms); },

    // A-JRN15 — load state.
    getLoadState() { return engine.getLoadState(); },

    // Determinism self-report: how many guard violations have fired this session.
    getDeterminismReport() {
      return {
        violations: violations.length,
        detail: violations.slice(0, 8).map((v) => ({ what: v.what, stack: String(v.stack).split('\n').slice(0, 4).join(' | ') })),
        guards: ['Math.random', 'Date.now', 'performance.now', 'new Date()'],
        armedDuring: 'exactly one fixed simulation step',
        rngSeed: engine.sim.seed,
        rngDraws: engine.sim.frame >= 0 ? undefined : undefined,
        note: 'The guards throw rather than count, so a non-zero violation count means a step already failed loudly. HARNESS.md §8 D1-D3.',
      };
    },

    // ================= W1-07 — character creation ==============================================
    // RI-CHR01 method 1 / RI-JRN01 M5-M8 drive the scene through these; RI-CHR02 methods 3, 7,
    // 8 and 9 drive the matrix, the prices, the encounter and the guards.

    /** The composed sheet, or {created:false} before the Writ House. */
    getCharacter() { return engine.getCharacter(); },
    /** Compose directly. The PLAYER's route is the scene; this is the scenario's route. */
    setCharacter(spec) { return engine.setCharacter(spec); },

    /** Open the census scene. Returns the first node: a speaker, a place, and a line. */
    censusBegin(opts) { return engine.censusBegin(opts || {}); },
    /** The player reached the Writ House. RI-JRN01 O6 puts >= 60 s of play before this. */
    censusEnter() { return engine.censusEnter(); },
    /** Answer the node in front of you. Throws on an illegal answer. */
    censusAnswer(value) { return engine.censusAnswer(value); },
    /** What a renderer draws and what a critic screenshots. `full_screen_panels` is 0. */
    getCensusState() { return engine.getCensusState(); },

    // ---- W1-07 round 2: the scene, measured rather than declared ----------------------
    /**
     * The drawn surface, read back out of the layout that drew it. Round 1's
     * `full_screen_panels: 0` / `world_visible: true` were JSON fields with no rendered
     * counterpart; `rendered_text` here is the exact string array that went through
     * `fillText` into the WebGL canvas the screenshot reads.
     */
    getUIState() { return engine.getUIState(); },

    /** Every person standing in the world, with the record they were instantiated from. */
    listNPCs() { return engine.listNPCs(); },

    /** What this person thinks of you, derived live from the RI-CHR02 matrix. */
    npcDisposition(eid) { return engine.npcDisposition(eid); },

    /** Put a person in the world (a state file's `npcs` array uses the same path). */
    spawnNPC(spec) { return engine.spawnNPC(spec || {}); },

    /** Pick up a world object. RI-JRN01 O6/M10's takeables. */
    takeProp(eid) { return engine.takeProp(eid); },

    /**
     * RI-PRG02 §3 and RI-CHR03 §2, read: the pools the attributes and the birthsign produce,
     * the live values in the fight, and the curve anchors the item's method 3 samples.
     */
    getDerivedStats() { return engine.getDerivedStats(); },

    /** Every skill, its banked progress and what the next point costs (RI-PRG03 §2). */
    getSkillSheet() { return engine.getSkillSheet(); },

    /**
     * RI-PRG03 §3's out-of-fight use events. `ctx.cost` is what the event CONSUMED; a call
     * with cost 0 is refused by §4's Cost Gate and the refusal is in the return value.
     */
    grantSkillUse(kind, ctx) { return engine.grantSkillUse(kind, ctx || {}); },

    // ---- A-JRN2: the gamepad shim ------------------------------------------------------
    /**
     * Push a synthetic standard-mapping pad state and poll it. `buttons` is an array of
     * booleans indexed by the W3C standard mapping; `axes` is [lx, ly, rx, ry].
     *
     * This is the SAME code path a real pad takes — `RealInput.pollGamepad()` — so a
     * gamepad-only run of the opening is a real gamepad-only run and not a keyboard run
     * wearing a different label. Requires mode 'play' or 'play-instrumented', because
     * HARNESS.md R4 forbids the real input path in 'harness'.
     */
    gamepad(state) {
      if (!engine.real) throw new Error('gamepad(): no real input path on this engine');
      if (engine.mode === 'harness') {
        throw new Error("gamepad(): the real input path is detached in mode 'harness' (HARNESS.md R4). " +
          "Call setMode('play-instrumented') first, then drive frames with stepFrames().");
      }
      return engine.real.pushGamepadState(state === undefined ? null : state);
    },

    /** AR-3: was the player captured, and what did it cost? */
    getCaptureState() { return engine.getCaptureState(); },

    /** Poll whatever pad is actually attached. Returns null when there is none. */
    gamepadPoll() {
      if (!engine.real) throw new Error('gamepadPoll(): no real input path on this engine');
      return engine.real.pollGamepad();
    },
    /** The object you carry out of the room (RI-JRN01 O10). */
    readWrit() { return engine.readWrit(); },

    /** Disposition with the race and upbringing terms in front of it (RI-CHR02 §4a). */
    getReaction(q) { return engine.getReaction(q || {}); },
    /** The standing surcharge and a quoted price (RI-CHR02 §4b). */
    getPriceQuote(q) { return engine.getPriceQuote(q || {}); },
    /** lawFactor, arrest and attack thresholds, suspicion (RI-CHR02 §5). */
    getGuardTerms(race) { return engine.getGuardTerms(race); },

    /** AR-3. Spawn a named encounter; every race gets the same statblocks. */
    spawnEncounter(id, x, z, opts) { return engine.spawnEncounter(id, Number(x), Number(z), opts || {}); },
    /** AR-3. What this encounter is doing, and what it would do to a different race. */
    getEncounterState(id) { return engine.getEncounterState(id); },

    /** The whole creation data set, for a critic who wants to recompute rather than trust. */
    getCreationData() {
      const d = engine.chData;
      return {
        attributes: d.attributes, skills: d.skills, races: d.races, classes: d.classes,
        birthsigns: d.birthsigns, reactions: d.reactions, creation: d.creation,
        questions: d.creationQuestions, encounters: d.encounters,
      };
    },

    // ================= W1-14 magic (seam S19) ==================================================
    // The extensions RI-MAG01 §Provenance → "Harness amendments requested" asks for, verbatim.
    // Without them M1-M4 and M7 score 0, fail-closed (HARNESS §5).

    /** Pin a loadout without walking to a HEARTH. Returns what was actually attuned. */
    setAttuned(spellIds) { return engine.magic.setAttuned(spellIds); },
    /** Equip a catalyst in the right hand. Casting requires one; `null` unequips. */
    setCatalyst(id) { return engine.magic.setCatalyst(id === undefined ? null : id); },
    /** WILLPOWER drives the Focus pool and the attuned-slot count (RI-MAG01 §A). */
    setWillpower(n) { return engine.magic.setWillpower(Number(n)); },
    setMagicSkills(patch) { Object.assign(engine.magic.skills, patch || {}); return { ...engine.magic.skills }; },

    /** Everything a critic needs about the reservoir, the loadout and every live effect. */
    getMagicState() { return engine.magic.report(engine.sim.frame); },
    /** Drain the magic event stream: cast_start, cast_release, cast_interrupt, focus_spend, effect_apply, effect_expire. */
    magicEventsDrain() { return engine.magic.drainEvents(); },

    /** The two — and only two — things in this project that raise Focus. */
    // W1-14 defined `hearthRest()` as the MAGIC reservoir refill; W1-07 needs the same verb to
    // also reset RI-PRG03 §4's per-rest skill clamp and to honour RI-CHR03's Dry Well, which
    // decides whether the refill happens at all. Two properties with one name in an object
    // literal means the later one silently wins — which it did, and the clamp never reset. One
    // verb now, doing both, with both items' return fields on it.
    /**
     * A HEARTH rest. One verb, two owners: RI-MAG01 §A refills the Focus reservoir here and
     * nowhere else, RI-PRG03 §4 resets the +3-levels-per-rest skill clamp here, and RI-CHR03's
     * Dry Well decides whether the refill happens at all.
     */
    hearthRest() { return engine.hearthRest(); },

    /** The catalogue, the shipped shelf and the cast class table, for offline recomputation. */
    getMagicData() {
      return {
        effects: engine.data.magic.effects,
        spells: engine.data.magic.spells,
        cast_classes: engine.data.magic['cast-classes'],
        cast_clips: engine.data.magic['cast-clips'],
        enchanting: engine.data.magic.enchanting,
        vfx: engine.data.magic.vfx,
        spell_movesets: engine.data.spellMovesets,
      };
    },

    /** The Focus this spell would actually deduct RIGHT NOW, at this caster's skill and catalyst. */
    spellCost(id) { return engine.magic.costOf(engine.magic.spellOf(String(id))); },

    /** Gold is the only currency (S15); spellmaking and enchanting spend it and nothing else. */
    setGold(n) { engine.sim.progression.gold = Number(n); engine.magic.gold = Number(n); return engine.magic.gold; },
    getGold() { return engine.magic.gold; },

    /** Price an ARBITRARY coordinate in the parameter space. There is no whitelist to consult. */
    quoteSpell(spec) { return engine.magic.quoteSpell(spec); },
    /** Commission it. RI-MAG03 M1's headline test drives this 20 times with unauthored tuples. */
    makeSpell(spec, name) { return engine.magic.makeSpell(spec, name); },
    /** Buying a spell teaches you its effects — the spellmaking knowledge gate. */
    learnSpell(id) { return engine.magic.learnSpell(id); },
    /** Enchanting arithmetic: points, capacity, soul-grade gate, gold, charge. */
    enchantQuote(spec) {
      const e = engine.data.magic.enchanting.enchanters.find((x) => x.id === (spec && spec.enchanter));
      if (e && e.quest_gated && !engine.sim.quest.flags[e.quest_gated]) {
        return { ok: false, problems: [`${e.name} will not see you: ${e.quest_gated} has not happened`], gated_by: e.quest_gated };
      }
      return engine.magic.enchantQuote(spec);
    },
    /** SG-5's anti-farm downgrade and SG-6's xul_hesh counter, both observable. */
    trapSoul(instanceId, grade, isSpeaker) { return engine.magic.trapSoul(engine.sim.frame, String(instanceId), String(grade), !!isSpeaker); },
    getXulHesh() { return engine.magic.xulHeshConsequences(); },
    /** `recall`'s magnitude is COMPUTED at cast time, never authored (RI-MAG02 §G). */
    recallQuote(markX, markZ) {
      const b = engine.combat.player;
      return engine.magic.recallCost([b.pos[0], b.pos[1], b.pos[2]], [Number(markX), 0, Number(markZ)]);
    },
    /** Levitation: begin, and read the metered ascent. No fence exists to report. */
    setLevitating(on) {
      if (on) engine.magic._beginLevitation(engine.sim.frame, 3600);
      else engine.magic._endLevitation(engine.sim.frame, 'harness');
      return engine.magic.report(engine.sim.frame);
    },

    // ---- RI-MAG06: the consuming systems, readable in one call each ------------------------
    //
    // RI-MAG06 §B says an effect is judged by reading "the game system the effect claims to
    // move". These are those systems. Each returns REAL state — the same objects the handlers
    // in game/src/sim/magic/apply.js write into — and none of them is a magic-side mirror a
    // spell could satisfy by talking to itself.

    /**
     * Cast a spell on the caster with no geometry, for measuring what an effect DOES rather
     * than whether it connects. Resources are spent exactly as a real cast spends them, and
     * S29's travel fence is enforced here too, so this cannot be used to walk round a rule.
     */
    castNow(spellId) { return engine.magic.castNow(engine.sim.frame, String(spellId)); },
    /**
     * Press the cast button for real and step. The whole input path — `_tryStart`, the drop
     * table, the move, the resource charge — so a refusal measured here is the refusal a
     * player gets. Returns the drops and any `travel_refused` the press produced.
     */
    pressCast(frames) {
      // RI-MAG01 §C: casting is the `light` button with a catalyst in the right hand. There is
      // no `cast` action and there must not be one — the whole point of the mapping is that it
      // needs no new verb.
      engine.input.queueInputs([{ f: 2, press: ['light'] }, { f: 4, release: ['light'] }], engine.sim.frame);
      const drops = [], refused = [];
      const n = Math.max(1, Number(frames) || 60);
      for (let i = 0; i < n; i++) {
        engine.loop.stepOnce(); engine._afterStep();
        for (let j = 0; j < engine.bus.count; j++) {
          const e = engine.bus.pool[j];
          if (e.type === 'INPUT_DROPPED' && e.button === 'cast') drops.push({ reason: e.reason, spell: e.spell, fence: e.fence, text: e.text });
          if (e.type === 'travel_refused') refused.push({ spell: e.spell, fence: e.fence, text: e.text, ruling: e.ruling });
        }
      }
      return { frame: engine.sim.frame, drops, travel_refused: refused };
    },
    /** Every live S11 buildup meter and proc, per body. The short name the census reads. */
    getStatus() { return engine.magic.statusReport(); },
    /**
     * Put buildup on the S11 meter directly. RI-MAG06 §B judges a proc by what it does to an
     * entity, and reaching a 100-point threshold by casting takes a spell shelf the arena may
     * not have — so the METER is fed here and the PROC is left to the game. Nothing about the
     * proc's consequence is short-circuited: it still has to cross the threshold.
     */
    addStatusBuildup(eid, kind, amount) {
      const b = engine.combat.bodyOf(String(eid)) || engine.combat.player;
      return engine.magic.addBuildupTo(engine.sim.frame, b, String(kind), Number(amount));
    },

    /**
     * RI-MAG06 §D self-test. Collapse the seven ward channels back into wave 1's single
     * kind-blind multiplier, so the ward x kind matrix can be watched going red.
     */
    __breakKindBlindWards() {
      for (const b of engine.combat.bodies) {
        const w = b.wards || {};
        const m = Math.min(...Object.values(w));
        for (const k of Object.keys(w)) w[k] = m;
        if (b.shieldFlat) { for (const k of Object.keys(w)) w[k] = w[k] * 0.31; b.shieldFlat = 0; }
      }
      return true;
    },
    /** RI-LOR05 §4a: read the taint register; and clear it, for a probe that needs to count from 0. */
    getSapTaint() { const t = engine.sim.progression.sapTaint; return t ? { ...t } : null; },
    resetSapTaint() { engine.sim.progression.sapTaint = null; return engine.hearthRest ? true : true; },

    /** S29 self-test: open the travel fence, so the refusal can be watched not happening. */
    __breakTravelFence() { engine.magic._fenceDisabled = true; return true; },

    /** Locks, traps, breakables, item condition, keys, shrines, conjured walls, summons, markers. */
    getMagicWorld() { return engine.magic.worldCensus(); },
    /** Every live S11 buildup meter, proc, mitigation multiplier and armour rating, per body. */
    getStatusState() { return engine.magic.statusReport(); },
    /** Re-seed the lock/trap/breakable/item registers to their authored state. */
    resetMagicWorld() { return engine.magic.loadWorldData(engine.data.magic.wards); },
    /**
     * The RI-MAG06 census, computed by the build itself: for every catalogue effect, the
     * consuming system its handler names and whether a handler exists at all. This is NOT a
     * measurement — it is the DECLARATION the critic's own paired read is checked against, and
     * it is here so that a declared-vs-observed disagreement is visible in one diff.
     */
    getEffectConsumerMap() {
      const out = [];
      for (const e of engine.data.magic.effects.effects) {
        out.push({
          effect: e.id, school: e.school,
          has_handler: typeof MAGIC_HANDLERS[e.id] === 'function',
          is_damage_effect: MAGIC_DAMAGE_EFFECTS.has(e.id),
          changes_traversal: !!e.changes_traversal,
          changes_quest_resolution: !!e.changes_quest_resolution,
        });
      }
      return {
        effects: out.length,
        handlers: out.filter((r) => r.has_handler).length,
        damage_effects: [...MAGIC_DAMAGE_EFFECTS].sort(),
        rows: out,
      };
    },
    /** Fall state: what `slowfall` moves, and the peak `leap` reaches. */
    getFallState() {
      const b = engine.combat.player;
      return {
        pos_y_m: +b.pos[1].toFixed(4),
        airborne: engine.magic.airborne,
        levitating: engine.magic.levitating,
        vel_mps: +engine.magic.fall.velMps.toFixed(3),
        terminal_mps: engine.magic.fall.terminalMps,
        fall_damage_enabled: engine.magic.fall.damageEnabled,
        peak_y_m: +engine.magic.peakY.toFixed(4),
        jump_apex_mult: +engine.magic.jumpApexMult.toFixed(4),
      };
    },
    /** Drop the player from a height, so `slowfall`'s paired read is a real fall. */
    dropFrom(height) {
      const b = engine.combat.player;
      const h = Number(height);
      if (!Number.isFinite(h) || h < 0) throw new Error(`dropFrom(${JSON.stringify(height)}): expected a non-negative height in metres`);
      engine.magic.groundY = 0;
      b.pos[1] = h;
      engine.sim.player.pos[1] = h;
      engine.magic.airborne = true;
      engine.magic.fall.velMps = 0;
      engine.magic.peakY = Math.max(engine.magic.peakY, h);
      return { pos_y_m: h, terminal_mps: engine.magic.fall.terminalMps, fall_damage_enabled: engine.magic.fall.damageEnabled };
    },
    /** The invisibility break rule, driven from the five events RI-MAG06 §B names. */
    breakInvisibility(cause) { return engine.magic.breakInvisibility(engine.sim.frame, String(cause || 'attack')); },

    // ---- the quest runtime (W1-2x owns the content; this is the machine) --------------------
    questOffers() { return engine.questEngine ? engine.questEngine.offers() : { _declared_incomplete: 'no quest runtime' }; },
    questOpen(id) { return engine.questEngine.open(String(id)); },
    questNote(id, index) { return engine.questEngine.note(String(id), Number(index)); },
    questResolutions(id) { return engine.questEngine.resolutionsFor(String(id)); },
    questResolve(id, resolutionId) { return engine.questEngine.resolve(String(id), String(resolutionId)); },
    questFail(id, failureId) { return engine.questEngine.fail(String(id), String(failureId)); },
    questSetFlag(flag, v) { return engine.questEngine.setFlag(String(flag), v === undefined ? true : v); },
    questBook() { return engine.questEngine ? engine.questEngine.book.ids.slice() : []; },
    questEventsDrain() { return engine.questEngine ? engine.questEngine.drainEvents() : []; },
    /** What a named resolution actually requires, so a probe can satisfy it rather than guess. */
    questResolutionRequirements(questId, resolutionId) {
      const q = engine.questEngine.book.get(String(questId));
      const r = (q.resolutions || []).find((x) => x.id === String(resolutionId));
      if (!r) throw new Error(`questResolutionRequirements: ${questId} has no resolution '${resolutionId}'`);
      return { ...(r.requires || {}), requires_knowing: r.requires_knowing || [], method: r.method, journal_index: r.journal_index, violence_required: !!r.violence_required };
    },
    /** Seed a dialogue topic. The topic gate on `opens_by` is what makes a quest offerable. */
    learnTopic(topic) {
      const t = String(topic);
      if (!engine.sim.quest.topicsKnown.includes(t)) engine.sim.quest.topicsKnown.push(t);
      engine.sim.quest.topicsKnown.sort();
      return engine.sim.quest.topicsKnown.slice();
    },
    /**
     * READ the one skill register. `sim.progression.skills` is what a quest resolution's
     * `requires.skills` reads, what `character/skilluse.js` writes when you play, what
     * `save/state.js` persists, and — since W1-14 round 3 — the register `MagicSystem.skills`
     * is a view of. There is no second one; `setMagicSkills` writes this.
     *
     * A critic auditing RI-MAG06 §E should read the number here and never set it.
     */
    getSkills() {
      const S = engine.sim.progression.skills || {};
      const out = {};
      for (const k of Object.keys(S).sort()) out[k] = S[k] && S[k].value !== undefined ? S[k].value : Number(S[k]) || 0;
      return out;
    },
    /** The same register with its progress fractions, for RI-PRG03's curve checks. */
    getSkillProgress() {
      const S = engine.sim.progression.skills || {};
      const out = {};
      for (const k of Object.keys(S).sort()) {
        const r = S[k];
        out[k] = r && typeof r === 'object'
          ? { value: r.value, use_progress: Math.round((r.useProgress || 0) * 1e6) / 1e6, levels_since_rest: r.levelsSinceRest || 0, rest_clamped: !!r.restClamped }
          : { value: Number(r) || 0, use_progress: 0, levels_since_rest: 0, rest_clamped: false };
      }
      return out;
    },
    /** Restore a blob produced by `saveState()`. The other half of a round-trip test. */
    restoreState(blob) { const r = engine.loadState(blob); engine.input.reset(engine.sim.frame); return { ok: true, frame: engine.sim.frame, ...r }; },

    /**
     * RI-MAG06 §E, the arena audit, made runnable against ITSELF: re-freeze the magic skill
     * register into the private literal wave 1 shipped, so a probe that claims to measure the
     * unfreezing can be watched going red. Nothing in the game calls this; it exists so the
     * instrument can be broken on purpose (AGENT-PROTOCOL, failure mode 2).
     */
    __breakSkillRegister() { return engine.magic.__refreezeSkillsForProbeSelfTest(); },
    /** The other half of the same self-test: stop crediting casts, so advancement must read 0. */
    __breakCastCredit() { engine.magic._creditDisabled = true; return true; },

    /** Set progression skills directly — the numbers a resolution's `requires.skills` reads. */
    setSkills(patch) {
      const S = engine.sim.progression.skills;
      for (const k of Object.keys(patch || {})) S[k] = { value: Number(patch[k]), useProgress: 0 };
      return Object.fromEntries(Object.entries(S).map(([k, v]) => [k, v && v.value != null ? v.value : v]));
    },
    /**
     * RI-MAG05 PART 2's F-M1 checklist and §B2 budget, as the build's own DECLARATION. The
     * critic measures both independently (draw calls from `getWorldStats()`, the features from
     * screenshots); this is here so a declared-vs-observed mismatch is one diff rather than an
     * argument, which is HARNESS §7 rule 4's whole point.
     */
    getSpellVFXReport() {
      const v = engine.renderer && engine.renderer.vfx;
      if (!v) return { _declared_incomplete: { owner: 'W1-14', missing: 'the VFX system has not been constructed yet — render at least one frame first' } };
      return {
        features: v.featureReport(),
        live: { ...v.stats },
        budget: {
          particles_per_spell_max: 900, particles_per_spell_max_GREAT: 1600, particles_frame_max: 4000,
          particle_draw_calls_per_spell_max: 6, particle_draw_calls_frame_max: 24,
          distinct_systems_per_spell_min: 3, residue_decals_per_spell_min: 1, residue_decals_live_max: 60,
        },
        palette: engine.data.magic.vfx.palette,
        design_language: engine.data.magic.vfx.design_language.map((l) => l.id),
        intensity_by_phase: engine.data.magic.vfx.intensity_by_phase,
      };
    },
    /** Learn a truth the quest declares. The ONLY way a `requires_knowing` gate is satisfied. */
    questReveal(questId, revealId) { return engine.questEngine.reveal(String(questId), String(revealId)); },
    /**
     * Is this enchanter's counter open? RI-MAG04 §E X5's chain runs through a quest-gated
     * enchanter, so whether that gate is shut has to be readable rather than implied.
     */
    enchanterOpen(id) {
      const e = engine.data.magic.enchanting.enchanters.find((x) => x.id === String(id));
      if (!e) throw new Error(`enchanterOpen('${id}'): unknown enchanter`);
      const gate = e.quest_gated || null;
      return { id: e.id, gate, open: !gate || !!engine.sim.quest.flags[gate], max_points: e.max_points === undefined ? null : e.max_points, gold_multiplier: e.gold_multiplier };
    },
    /** Which effects the player has actually CAST — what the resolution gate now reads. */
    getCastEffects() { return [...engine.magic.castEffects].sort(); },
    /**
     * Plant an affliction, so the three cure effects have something to cure. Seam S11's
     * Morrowind half (RI-PRG09) owns where afflictions COME FROM; this is the instrument that
     * lets RI-MAG06 §B's `cure_*` rows be a paired read rather than an assertion.
     */
    addAffliction(id, kind, opts) {
      const o = opts || {};
      const rec = {
        id: String(id), kind: String(kind),
        incubation_in_frames: o.incubation_f === undefined ? 0 : Number(o.incubation_f),
        duration_in_frames: o.duration_f === undefined ? 36000 : Number(o.duration_f),
      };
      engine.sim.quest.afflictions.push(rec);
      engine.sim.quest.afflictions.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
      return engine.sim.quest.afflictions.map((a) => ({ id: a.id, kind: a.kind }));
    },
    /**
     * Set base attributes directly. RI-MAG06 §B's `restore_attribute` row reads
     * `getPlayerStats().attributes` and asserts it "rises, clamped at max" — which needs a
     * DRAINED attribute to rise from, and nothing in wave 1 drains one.
     */
    setAttributes(patch) {
      const A = engine.sim.progression.attributes;
      for (const k of Object.keys(patch || {})) {
        if (!(k in A)) throw new Error(`setAttributes: unknown attribute ${JSON.stringify(k)}; known: ${Object.keys(A).join(', ')}`);
        A[k] = Number(patch[k]);
      }
      return { ...A };
    },
    /** Kill an entity outright, so a death-triggered consumer (`soul_trap`) has a death to read. */
    killEntity(eid) {
      const b = engine.combat.bodyOf(String(eid));
      if (!b) throw new Error(`killEntity('${eid}'): no such body`);
      b.hp = 0; b.dead = true; b.state = 'DEAD'; b.move = null; b.hitboxActive = false;
      const e = engine.sim.findEntity(String(eid));
      if (e) { e.hp = 0; e.state = 'DEAD'; }
      return { eid: String(eid), dead: true };
    },
    /**
     * Apply damage to the player. `opts.stagger` routes it through the SAME reaction machinery
     * a real hit uses (`CombatBody.queueReaction`), so an interrupted cast is interrupted by
     * the state machine rather than by this method — which is the only way RI-MAG01 §D's
     * interrupt table is measuring the game rather than measuring the probe.
     */
    damagePlayer(n, opts) {
      const b = engine.combat.player;
      const raw = Number(n);
      // RI-MAG06 §B judges every mitigation effect by "the damage taken from an identical
      // scripted hit". A scripted hit that bypassed `shield` and the two resists would make
      // that read structurally impossible, so it goes through the SAME mitigate() the weapon
      // resolver uses. Both numbers are returned: `raw` is what was asked for, `applied` is
      // what the body took, and the difference is the effect.
      //
      // W1-14 round 3: the hit now has a KIND (`opts.kind`, default `physical`), because
      // "the damage taken from an identical scripted hit" was the exact read that could not
      // tell `resist_disease` from `shield` — both moved it, so both passed. A ward is only
      // demonstrated when a hit it names is blunted AND a hit it does not name is not.
      const kind = (opts && opts.kind) || 'physical';
      const applied = mitigate(b, raw, kind);
      b.hp = Math.max(0, b.hp - applied);
      if (b.hp <= 0) b.dead = true;
      if (!opts || opts.stagger !== false) {
        const sm = b.moves._stagger && (b.moves._stagger.medium || b.moves._stagger[Object.keys(b.moves._stagger)[0]]);
        if (sm) b.queueReaction(sm, engine.sim.frame);
      }
      engine.magic.onDamaged(engine.sim.frame);
      // The view is refreshed here rather than on the next step, so a probe that reads
      // getPlayerStats() immediately after this call sees the hit it just scripted.
      mirrorView(engine.sim, engine.combat);
      return {
        hp: b.hp, raw, kind, applied: Math.round(applied * 1000) / 1000,
        wards: Object.fromEntries(Object.entries(b.wards || {}).map(([k, v]) => [k, Math.round(v * 1e4) / 1e4])),
        shield_flat: Math.round((b.shieldFlat || 0) * 100) / 100,
        armour_rating: Math.round((b.armourRating || 0) * 100) / 100,
        magic: engine.magic.report(engine.sim.frame),
      };
    },

    // ================= W1-15 — stealth, theft, crime and justice ==============================
    // The extensions RI-STL01, RI-STL02, RI-CRM01 and RI-CRM02 name in their Comparison
    // methods. Each item says in as many words that without them its checks are unmeasurable
    // and score 0 fail-closed, so they are present with the documented signatures.

    /** RI-STL01: getLightAt(x,y,z) -> L. The instrument that makes DARK-COVERAGE checkable. */
    getLightAt(x, y, z, zone) { return engine.sim.stealth.light.sample(Number(x), Number(y), Number(z), zone); },
    /** The whole per-frame stealth state, including the terms of V rather than just V. */
    getStealthState() { return engine.getStealthState(); },
    /** Set the stealth-side character terms a scenario needs (sneak, load, race, surface, cover). */
    setStealthState(patch) { return engine.setStealthState(patch || {}); },
    /** RI-STL01 §2/§4: the pure functions, so method 1's 100k sweep can be run against the
     *  SHIPPING code rather than a copy of it. These do not read or write world state. */
    visibilityAt(q) { return engine.visibilityAt(q || {}); },
    soundRadiusFor(q) { return engine.soundRadiusFor(q || {}); },
    /** RI-STL01 §6: what you are DOING, not where you are. Closed vocabulary; unknown throws. */
    setCrimeContext(name) { return engine.sim.stealth.setContext(String(name)); },
    /** Place a civilian with the CALM/WATCHING/CHALLENGE/ALARM machine — never an enemy. */
    spawnCivilian(spec) { return engine.spawnCivilian(spec || {}); },
    listCivilians() { return engine.sim.stealth.civTraceBlock(); },
    /** RI-STL01 §3: light sources, and the 60%+ that can be put out. */
    addLightSource(spec) { return engine.sim.stealth.light.addSource(spec); },
    setZoneAmbient(zone, keyOrValue) { engine.sim.stealth.light.setZoneAmbient(String(zone), keyOrValue); return engine.sim.stealth.light.ambientByZone.get(String(zone)); },
    snuffLight(id, seconds) { return engine.sim.stealth.light.snuff(String(id), engine.sim.frame, Math.round((seconds === undefined ? 120 : seconds) * 60)); },
    darkCoverage(bounds, zone, threshold) { return engine.sim.stealth.light.darkCoverage(bounds, zone, threshold === undefined ? 0.10 : threshold); },
    /** RI-STL01 §8: the seam. Returns a BOOLEAN and nothing else. */
    isStealthOpener(q) { return engine.isStealthOpener(q || {}); },
    /** RI-STL01 §4: the four discrete sound events, including the distraction throw. */
    emitStealthSound(id, at) { return engine.sim.stealth.emitSound(engine.sim, engine.sim.frame, String(id), engine.bus, at || null); },

    // ---- W1-15 round 2: the surfaces RI-MTH07's coupling test needs ------------------------
    // Every one of these PERTURBS THE WORLD. None of them reports a model's own return value,
    // and none of them lets a probe tell the engine what it should have observed.

    /**
     * Put a wall in the world. An axis-aligned box added to the stealth occluder cell, which
     * line of sight casts against alongside `sim.cell` — the same static collision set the
     * camera's spring arm and the player's body use. This exists so `RI-MTH07`'s LOS pair can
     * be measured in an otherwise empty arena without mutating a shared camera fixture.
     */
    addOccluder(spec) { return engine.addOccluder(spec || {}); },
    listOccluders() { return engine.sim.stealth.occluders.shapes.map((s) => ({ id: s.id, k: s.k })); },
    /** Is the segment from a to b clear? The predicate itself, for a critic's independent check. */
    losBetween(a, b) { return engine.losBetween(a, b); },
    /** RI-STL01 §2's `A` term as the world computes it, at an arbitrary point. */
    coverAt(x, y, z) { return engine.coverAt(Number(x), Number(y), Number(z)); },
    /** S-1's nav-mesh cover volumes. The searcher's plausible set is drawn from these. */
    addCoverVolume(spec) { return engine.addCoverVolume(spec || {}); },
    listCoverVolumes() { return engine.sim.stealth.coverVolumes.map((v) => ({ ...v })); },
    /** RI-STL01 §7: every live search, with its plan, its band and its visited set. */
    getSearchState() {
      return engine.sim.stealth.searches.map((s) => ({
        eid: s.eid, lkp: s.lkp, zone: s.zone, start_f: s.startFrame, end_f: s.endFrame,
        radius_m: s.radiusAt(engine.sim.frame), plan: s.plan.map((v) => v.id), visited: s.visited.slice(),
        acquired: s.acquired, over: !!s.over,
      }));
    },
    /**
     * Force the motion band. `RI-STL01` §4's sound model is a function of the movement mode, and
     * an input-driven sprint in an arena with no ground is not a reliable way to hold one for
     * ten seconds. This sets the band the way `setZoneAmbient` sets the light — a world fact,
     * not an assertion. `null` returns the band to the controller's actual speed.
     */
    setPlayerMotion(m) { return engine.setPlayerMotion(m === undefined || m === null ? null : String(m)); },
    /** A guard, as a person: a witness with `guard_V_min`, a report target, and a jurisdiction. */
    spawnGuard(spec) { return engine.spawnGuard(spec || {}); },
    /** RI-CRM01 §3b's four responses to a fleeing witness, driven at the pending report. */
    listPendingReports() { return engine.listPendingReports(); },
    bribeWitness(i, gold) { return engine.bribeWitness(Number(i), (gold === undefined || gold === null) ? null : Number(gold)); },
    talkDownWitness(i, ok) { return engine.talkDownWitness(Number(i), !!ok); },
    /** RI-AI01 §B's instant channels, so a critic can raise a meter without moving the player. */
    raiseEnemyAlert(eid, amount, channel) { return engine.sim.stealth.raiseAlert(engine.sim, String(eid), Number(amount), String(channel || 'shout')); },
    /** RI-STL02 §6: launder a registered stolen item through a fence, for real. */
    fenceSell(fenceId, instance) { return engine.fenceSell(String(fenceId), String(instance)); },
    /** RI-QST05: the verb census over the shipped quest tree. */
    questVerbCensus() { return engine.questVerbCensus(); },
    /**
     * The stealth/crime event log since the last drain — `crime`, `witness`, `report`,
     * `report_route`, `search_start`, `search_end`, `civ_state`, `sound`, `guard_band`,
     * `stolen_registered`, `aggro`. The same events go to the trace bus; this is the path for a
     * probe that is not tracing.
     */
    drainStealthEvents() { return engine.sim.stealth.drain().concat(engine.sim.stealth.crime.drain()); },
    /**
     * The perception state of every entity, and nothing else.
     *
     * `snapshot()` builds a whole `elder-souls/trace@1` frame record — every hitbox, every
     * event, the character sheet — and a per-frame detection curve over 3,600 frames calls it
     * 3,600 times for four numbers. This is the same numbers off the same fields, so a probe
     * that wants a frame-exact alert curve can afford one.
     */
    perceptionState() {
      return engine.sim.entities.map((e) => ({
        eid: e.eid, alert: +e.alert.toFixed(4), alert_state: e.alertState,
        alert_channel: e.alertChannel === undefined ? null : e.alertChannel,
        los: e.percept_los === undefined ? null : !!e.percept_los,
        dist_m: e.percept_dist === undefined ? null : +e.percept_dist.toFixed(3),
        pos: [+e.pos[0].toFixed(3), +e.pos[1].toFixed(3), +e.pos[2].toFixed(3)],
        speed_mps: +(e.speed || 0).toFixed(3),
        search_target: e.searchTarget ? e.searchTarget.map((n) => +n.toFixed(2)) : null,
        search_radius_m: e.searchRadius || 0,
        alert_hop: e.alertHop || 0,
        lkp: e.lkp ? e.lkp.map((n) => +n.toFixed(2)) : null,
      }));
    },

    /** RI-STL02: listOwnedObjects(interiorId) -> [{instance, owner, owner_scope, value_g}] */
    listOwnedObjects(zoneId) { return engine.listOwnedObjects(String(zoneId)); },
    listPropertyZones(settlement) { return engine.listPropertyZones(settlement); },
    takeObject(instance, opts) { return engine.takeObject(String(instance), opts || {}); },
    /** RI-STL02 §3: the ward-collar. `interact` is the press; there is no new button. */
    lockBegin(lockId) { return engine.lockBegin(String(lockId)); },
    lockState() { return engine.sim.stealth.p.lockAttempt ? engine.sim.stealth.p.lockAttempt.block() : null; },
    lockPress() { return engine.lockPress(); },
    lockGate(tier) { return engine.lockGateFor(Number(tier)); },
    lockTolerance(tier, security) { return engine.lockToleranceFor(Number(tier), Number(security)); },
    /** RI-STL02 §5 / seam S21: the geometry is deterministic; the notice check is the die. */
    pickpocketBegin(q) { return engine.pickpocketBegin(q || {}); },
    pickpocketState() { const a = engine.sim.stealth.p.pickpocket; return a ? { held_f: a.heldFrames, need_f: a.needFrames, complete: a.complete } : null; },
    /** RI-STL02 §4: trespass is not a crime and generates no bounty. */
    trespassCheck(zoneId, opts) { return engine.trespassCheck(String(zoneId), opts || {}); },
    /** RI-STL02 §6: the fence economy, and the refusal that names the owner. */
    fenceQuote(fenceId, item) { return engine.fenceQuote(String(fenceId), item || {}); },

    /** RI-CRM01: the whole crime ledger. */
    getCrimeState() { return engine.getCrimeState(); },
    setBounty(jurisdiction, n, settlement) { return engine.sim.stealth.crime.setBounty(String(jurisdiction), Number(n), settlement); },
    /** A crime does NOT create a bounty here. It creates a crime record and its witnesses. */
    commitCrime(crimeKey, opts) { return engine.commitCrime(String(crimeKey), opts || {}); },
    addWitness(crimeRef, spec) { return engine.sim.stealth.crime.witness(Number(crimeRef), { frame: engine.sim.frame, ...spec }); },
    reportRoute(q) { return engine.reportRoute(q || {}); },
    landReport(witnessIndex, kind) { return engine.landReport(Number(witnessIndex), kind); },
    killWitness(witnessIndex, opts) { return engine.killWitness(Number(witnessIndex), opts || {}); },
    discoverCorpse(eid) { return engine.sim.stealth.crime.discoverCorpse(String(eid), engine.sim.frame); },
    /** RI-CRM01 §4/§5/§6: the ladder, the three answers, the ledger. */
    getGuardBand(opts) { return engine.getGuardBand(opts || {}); },
    arrestTopics(opts) { return engine.arrestTopics(opts || {}); },
    answerArrest(answer, opts) { return engine.answerArrest(String(answer), opts || {}); },
    jailLedger(bounty, skills) { return engine.jailLedger(Number(bounty), skills); },
    /** RI-CRM01 §9: S6. Bounty is world state and death does not launder it. */
    playerDeath(opts) { return engine.stealthPlayerDeath(opts || {}); },

    /** RI-CRM02: writs, jurisdictional legality, interception, and the AR-3 numbers. */
    getSanctionState() { return engine.getSanctionState(); },
    setFactionStandings(patch) { Object.assign(engine.sim.stealth.p.standings, patch || {}); return { ...engine.sim.stealth.p.standings }; },
    resolveKilling(q) { return engine.resolveKilling(q || {}); },
    canJoinFaction(factionId, rank) { return engine.canJoinFaction(String(factionId), Number(rank)); },
    warbroodShift() { return engine.warbroodShift(); },

    // ---- honest gaps ------------------------------------------------------------------------
    /**
     * Every capability a critic might reach for that this piece does NOT implement, with
     * the piece that owns it. Read this before concluding a number is missing by accident.
     */
    getCapabilityReport() {
      return {
        piece: BUILD.piece,
        implemented: [
          'fixed 60 Hz simulation decoupled from render (HARNESS.md R2/R3)',
          'seeded PRNG with a runtime guard that throws on Math.random/Date.now/performance.now/new Date inside a step',
          'the elder-souls/trace@1 record, including the camera channel RI-CAM02/RI-CAM06 need',
          'the 15-button closed action set (14 from W1-00 + `crouch` from W1-15/AM-W1-15-01), the scripted path, the real desktop path, the 8 f@60 single-slot buffer',
          'IndexedDB save with the RI-JRN05 §A write protocol, digest, A/B generations, export/import, hostility simulation',
          'deterministic sky, sun and named weather; the nine viewpoint anchors',
          'the game/data/** layout of HARNESS.md §5 with a generated index.json',
          'W1-07: character creation as a scene — 10 attributes, 19 skills, 10 races, 9 birthsigns, 14 classes plus the custom route, the 12-question route, the 12x10 reaction matrix, the price surcharge, the guard law-factor table and the race-conditioned encounter opening',
          'W1-09: swept-capsule hit resolution over bone-attached hurtboxes, 4 substeps, no distance check and no dice (RI-CMB04)',
          'W1-09: the RI-CMB01 §B roll ladder at all four equip-load tiers, i-frames as a frame window',
          'W1-09: RI-CMB02 §A/§B frame data for all 7 classes x R1/R2 with the §D commitment rule',
          'W1-09: RI-CMB03 stamina, block, guard break and RI-CMB09 exhaustion, symmetric for enemies',
          'W1-09: RI-CMB05 poise, stagger, hyperarmour, backstab, parry and riposte',
          'W1-09: RI-CMB06 lock-on with target-relative directional roll and soft-lock steering',
          'W1-09: RI-CMB08 healing with animation commitment and finite charges',
          'W1-09: es-combat-trace/1 (RI-CMB07 §A) as a second stream, and the S13 parley',
        ],
        not_implemented: [
          { what: 'enemy DECISION-MAKING (approach, circle, commit, attack token, punish reads, leash)', owner: 'RI-AI01..07 / wave-1 piece W1-12', surfaced_as: "enemy statblocks declare ai='scripted'; actions come from the scenario file on declared frames, which is the RI-CMB07 M1 Mode-A instrument. spawn() throws for any archetype declaring behaviour this build cannot run. RI-CMB07 M2 (Mode-B free play against real AI) is therefore NOT measurable in this piece and scores 0, fail-closed." },
          { what: 'mid-animation combat state across a save/load', owner: 'W1-09, declared limitation', surfaced_as: 'sim/combat-bridge.js header. The combat bodies are the authority and sim.player is a view; a save taken on frame 12 of a roll restores a standing character at the roll position. Correct under seam S6 (you save by resting) and true of both source games, but stated rather than discovered.' },
          { what: 'weapon movesets beyond the 7-class spine, and attack ratings', owner: 'RI-WPN01..06 / wave-1 piece W1-10', surfaced_as: 'movesets/*.json weapon.attack_rating_provenance marks all seven AR values PROVISIONAL; only the straight sword is pinned (to the RI-CMB07 exemplar HIT of 118 at motion value 1.00).' },
          { what: 'hitstop, mass and impact feel', owner: 'RI-WPN05 / RI-AUD01 / wave-1 piece W1-11', surfaced_as: 'hitstop_frames is read from the moveset and applied, but the camera, audio and animation consequences are W1-11.' },
          { what: 'a quest runtime', owner: 'wave-1 pieces W1-14..W1-16', surfaced_as: 'getQuestState()._declared_incomplete; quest STATE is real and round-trips, quest PROGRESSION does not exist' },
          { what: 'dialogue, topics, journal writing at runtime', owner: 'wave-1 pieces W1-11..W1-13', surfaced_as: 'data files exist and are analysable; getDialogueState() (A-JRN13) is absent' },
          { what: 'the province: 13 regions, 8 settlements, 250 interiors, roads', owner: 'wave-1 pieces W1-01..W1-05', surfaced_as: 'getWorldStats()._declared_incomplete — counts come from game/data/**, which is the corpus transcription plus one worked settlement' },
          { what: 'audio', owner: 'RI-AUD01..03 / wave-1 piece W1-25', surfaced_as: 'audioMB: 0. RI-AUD02 is unmeasurable in this piece and scores 0, fail-closed' },
          { what: 'a gamepad shim (A-JRN2), viewport control (A-JRN4), heap/GC access (A-JRN9), keyboard-layout emulation (A-JRN12), dialogue state (A-JRN13), resource registry (A-JRN14)', owner: 'runner-side or later pieces', surfaced_as: 'the methods are absent rather than present-and-lying' },
          { what: 'Tier-H performance numbers (fps, frame time, TTFP wall clock, hitch durations)', owner: 'attested real hardware', surfaced_as: 'getPerfStats()._unmeasurable / getLoadState()._unmeasurable. RI-PLT01 rule T1 forbids emitting these from a SwiftShader run at all' },
        ],
        harness_amendments_implemented: ['A-JRN1 (partial: play-instrumented mode, no UI-text stream)', 'A-JRN3', 'A-JRN5 (partial: Tier-S fields only)', 'A-JRN6', 'A-JRN7', 'A-JRN8', 'A-JRN10', 'A-JRN11', 'A-JRN15 (partial)'],
        harness_amendments_absent: ['A-JRN2', 'A-JRN4', 'A-JRN9', 'A-JRN12', 'A-JRN13', 'A-JRN14'],
      };
    },
  };

  if (typeof window !== 'undefined') window.__HARNESS = H;
  return H;
}

/** Leaf paths, stopping at declared-dynamic containers so a map's keys are not "fields". */
function pathsOf(obj, dynamic, prefix = '', acc = []) {
  for (const k of Object.keys(obj).sort()) {
    const p = prefix ? `${prefix}.${k}` : k;
    const v = obj[k];
    if (dynamic.has(p) || v === null || typeof v !== 'object' || Array.isArray(v)) acc.push(p);
    else pathsOf(v, dynamic, p, acc);
  }
  return acc;
}
