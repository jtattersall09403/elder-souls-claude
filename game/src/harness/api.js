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
      if (!this._weapons) this._weapons = installWeaponsHarness(engine.data);
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
    hearthRest() { return { focus: engine.magic.hearthRest(), note: 'RI-MAG01 §A: the reservoir refills here and nowhere else.' }; },

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

    /** Price an ARBITRARY coordinate in the parameter space. There is no whitelist to consult. */
    quoteSpell(spec) { return engine.magic.quoteSpell(spec); },
    /** Commission it. RI-MAG03 M1's headline test drives this 20 times with unauthored tuples. */
    makeSpell(spec, name) { return engine.magic.makeSpell(spec, name); },
    /** Buying a spell teaches you its effects — the spellmaking knowledge gate. */
    learnSpell(id) { return engine.magic.learnSpell(id); },
    /** Enchanting arithmetic: points, capacity, soul-grade gate, gold, charge. */
    enchantQuote(spec) { return engine.magic.enchantQuote(spec); },
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
    /**
     * Apply damage to the player. `opts.stagger` routes it through the SAME reaction machinery
     * a real hit uses (`CombatBody.queueReaction`), so an interrupted cast is interrupted by
     * the state machine rather than by this method — which is the only way RI-MAG01 §D's
     * interrupt table is measuring the game rather than measuring the probe.
     */
    damagePlayer(n, opts) {
      const b = engine.combat.player;
      b.hp = Math.max(0, b.hp - Number(n));
      if (b.hp <= 0) b.dead = true;
      if (!opts || opts.stagger !== false) {
        const sm = b.moves._stagger && (b.moves._stagger.medium || b.moves._stagger[Object.keys(b.moves._stagger)[0]]);
        if (sm) b.queueReaction(sm, engine.sim.frame);
      }
      engine.magic.onDamaged(engine.sim.frame);
      return { hp: b.hp, magic: engine.magic.report(engine.sim.frame) };
    },

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
