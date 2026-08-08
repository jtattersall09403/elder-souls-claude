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
import { OPENABLE as OPENABLE_MENUS } from '../ui/system.js';
import { DEFAULT_BINDINGS, MOVE_BINDINGS, RESERVED_CONTROLS, auditBindings, rolloverAudit, setProfiles } from '../input/bindings.js';
import { canonicalise, stateDiff, leafPaths } from '../core/canonical.js';
import { VOLATILE_PATHS } from '../save/state.js';
import { installWeaponsHarness } from './weapons.js';
// The two text draw paths, imported so `drawSentinels()` can exercise BOTH of them — the
// falsification that keeps the rendered-text register honest. See that method.
import { drawText as drawGlyphText, faceOf } from '../ui/glyphs.js';
// W1-14 round 2: the RI-MAG06 registry, so `getEffectConsumerMap()` reports the build's own
// declaration rather than a second list that could drift from it.
import { HANDLERS as MAGIC_HANDLERS, DAMAGE_EFFECTS as MAGIC_DAMAGE_EFFECTS } from '../sim/magic/apply.js';
import { mitigate } from '../combat/resolve.js';
// W1-14 round 4: the delete-the-fix switch for the shared-statblock weapon copy. See
// `__breakSummonAlias` below and `combat/enemy.js` §buildEnemyMoves.
import { __setWeaponAliasing, __weaponAliasing } from '../combat/enemy.js';
import { mirror as mirrorView } from '../sim/combat-bridge.js';
import { mergeConsequences } from '../sim/quest/machine.js';

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

    /**
     * getEnvConditions() — READ BACK the conditions the world is actually in.
     *
     * `setTimeOfDay` and `setWeather` write `sim.env` and nothing puts them back, so they are
     * STICKY across captures. The CAPTURE-SERVICE-R1 critic used that to break the cache's central
     * promise: `place(A)` with no time and no weather rendered one picture, and the byte-identical
     * spec rendered a different one after an intervening `time: 1, weather: storm` capture, because
     * the place-to-place fast path never reloads. There was no way to ask the engine what
     * conditions a frame was actually taken in, so the manifest recorded `time: null` and the cache
     * banked a night storm under it.
     *
     * This is that verb. It reads and returns; it sets nothing.
     */
    getEnvConditions() {
      const e = engine.sim.env || {};
      let tide = null;
      try { tide = engine.getTide(); } catch (err) { tide = null; }
      return {
        time_of_day: e.timeOfDay === undefined ? null : e.timeOfDay,
        weather: e.weather === undefined ? null : e.weather,
        tide,
      };
    },
    /**
     * W1-02. The world clock and the regional weather machine, read off the LIVE simulation.
     *
     * `getEnvConditions()` above answers "what did the capture pin"; this answers "what is the
     * world doing" — the integer frame the clock is on, the day, the phase, the machine installed
     * for the region the body is standing in, the state it rolled, how far through the front it
     * is, and the sightline that front currently produces. RI-MTH07: every field is derived from
     * `sim.env` after the fixed step wrote it, never read back out of `weather.json`.
     */
    getEnvironment() { return engine.getEnvironment(); },
    /** W1-02 / RI-WLD12 M65. The staggered crossover, walked on the live field. */
    getBorderCrossover(id, opts) { return engine.getBorderCrossover(id, opts || {}); },
    /** Every declared border: kind, width, threshold object, tier jump, announcement. */
    listBorders() { return engine.listBorders(); },
    /** Which border the body is in, how far through it, and the nine axes' answers there. */
    getBorderAt(x, z) { return engine.getBorderAt(x, z); },
    /** W1-02 r2 / RI-WLD12 M64+M68. Every border marker as instanced: type, owner, size, solidity. */
    listBorderMarkers(opts) { return engine.listBorderMarkers(opts || {}); },
    /** Hold the sun still for a comparable screenshot (HARNESS.md §6). Returns the new state. */
    pauseClock(on) { return engine.pauseClock(on === undefined ? true : on); },
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
    // W1-21 / RI-UIX03: deterministic menu navigation. Scripted input can open a menu but
    // cannot reliably navigate to a specific screen, so without these none of RI-UIX03 §A is
    // measurable.
    //
    // W1-MAP: `openMenu('map')` now OPENS (ARBITRATION S35 overruled S30). What still throws is
    // `openMenu('minimap')`, `openMenu('worldmap')`, and — this is the one a critic should try —
    // `openMenu('map', {anything})`. See game/src/ui/system.js.
    openMenu(name, opts) { return engine.openMenu(name, opts || {}); },
    /**
     * W1-MAP / ARBITRATION S35. **THE LIVE WORLD'S map state, not the save blob's.**
     *
     * This exists because of the protocol's own finding that a round trip which re-serialises
     * cannot see a field nobody reads back: the discovery raster is 7 KB of base64 that
     * round-trips byte-perfect whether or not `applySave` ever loads it into the running
     * `Discovery` object. Every number below is read off the object the screen draws from, so
     * an audit that saves, loads and calls this is auditing the world and not the serialiser.
     *
     * `dropped_on_load` is what `Discovery.restore()` REFUSED: a place named in a save whose own
     * cell the same save's raster does not corroborate. Standing in a place necessarily reveals
     * the cell you stood in, so a blob that claims otherwise was not written by `observe()`.
     */
    mapState() {
      const d = engine.sim.discovery;
      if (!d) return { present: false };
      return {
        present: true,
        revealed_cells: d.revealedCells,
        total_cells: d.cols * d.rows,
        revealed_frac: +d.revealedFrac.toFixed(6),
        observations: d.observations,
        places: d.places(),
        place_count: d.placeCount,
        suspended: d.suspended,
        dropped_on_load: engine.sim._discoveryDropped || [],
        // The structural guarantee, read off the running object. AMENDMENT-W1-MAP-01 §3b asks a
        // critic to assert every mutator has arity 0; here is the arity.
        mutators: Object.getOwnPropertyNames(Object.getPrototypeOf(d))
          .filter((k) => k !== 'constructor' && typeof d[k] === 'function')
          .map((k) => ({ name: k, arity: d[k].length })),
        frozen: Object.isFrozen(d),
      };
    },
    /**
     * The hostile probe's door: try to make the map show something. Every one of these SHOULD
     * fail, and the point is that they fail for structural reasons rather than because nobody
     * happened to call them. Returns what each attempt did, so `map-probe.mjs` can print it.
     */
    tryPlaceMapMarker(placeId) {
      const d = engine.sim.discovery;
      const id = String(placeId);
      const out = [];
      const attempt = (what, fn) => {
        try { const r = fn(); out.push({ attempt: what, threw: false, result: r === undefined ? null : String(r) }); }
        catch (e) { out.push({ attempt: what, threw: true, error: `${e.constructor.name}: ${e.message}` }); }
      };
      attempt(`discovery.discover('${id}')`, () => d.discover(id));
      attempt(`discovery.reveal('${id}')`, () => d.reveal(id));
      attempt(`discovery.mark('${id}')`, () => d.mark(id));
      attempt(`discovery.setPlace('${id}')`, () => d.setPlace(id));
      attempt("discovery.places().push(id)", () => { d.places().push(id); return 'pushed'; });
      attempt('discovery.placeSet.add(id)', () => { d.placeSet.add(id); return 'added'; });
      attempt('discovery.reveal = fn', () => { d.reveal = () => {}; return 'installed'; });
      attempt('Object.defineProperty(discovery, ...)', () => {
        Object.defineProperty(d, 'reveal', { value: () => {} }); return 'defined';
      });
      attempt(`openMenu('map', {place: '${id}'})`, () => engine.openMenu('map', { place: id }));
      attempt(`openMenu('map', {marker: {...}})`, () => engine.openMenu('map', { marker: { x: 0, z: 0 } }));
      attempt("openMenu('minimap')", () => engine.openMenu('minimap', {}));
      attempt("questEngine writes sim.discovery = forged", () => {
        // The only remaining route: replace the whole object. It is not defended against and
        // must not be reported as if it were — anything holding `sim` can do this, and the
        // honest claim is narrower: no CALL exists, so a quest FILE cannot express it and a
        // quest HOOK has no verb for it. This attempt is recorded so the claim stays narrow.
        return 'not defended — see map-probe.mjs D6 for what is and is not claimed';
      });
      // The one attempt that does NOT throw, and must not be reported as if it did: JavaScript
      // ignores surplus arguments, so `observe(x, z)` is a legal call. The guarantee is not that
      // it is refused — it is that it has NO EFFECT, because `observe()` never reads `arguments`
      // and closes over the player instead. Measured rather than asserted: the extra arguments
      // name a far corner of the province, and the raster there must be unchanged.
      const far = [4600, 5200];
      const seenBefore = d.seenAt(far[0], far[1]);
      const cellsBefore = d.revealedCells;
      d.observe(far[0], far[1]);
      out.push({
        attempt: `discovery.observe(${far[0]}, ${far[1]}) — surplus arguments`,
        threw: false,
        result: 'accepted (JS ignores surplus arguments) — and had no effect',
        no_effect: d.seenAt(far[0], far[1]) === seenBefore && d.revealedCells === cellsBefore,
        detail: `seenAt(${far}) ${seenBefore} -> ${d.seenAt(far[0], far[1])}, revealed ${cellsBefore} -> ${d.revealedCells}`,
      });
      return { place: id, attempts: out, discovered_after: d.hasPlace(id) };
    },
    closeMenu() { return engine.closeMenu(); },
    openContainer(name, contents) { return engine.openContainer(name, contents || []); },
    /**
     * Raise (or clear) RI-UIX01 E11's toast through the shipped HUD path.
     *
     * This is the POSITIVE CONTROL for RI-JRN03 M-K20 / RI-JRN04 M-P24, and it is the reason
     * those two checks can now fail. Both are greps over the rendered-text stream for
     * instruction tokens, and a grep is only worth its threshold if somebody has demonstrated
     * that a violation would be caught: `--self-test` draws "Press E to open" here, on a
     * non-settings surface, through `ui/hud.js`'s ordinary element, and asserts both checks go
     * red. `uiToast(null)` clears it.
     */
    uiToast(text, frames) { return engine.uiToast(text === undefined ? null : text, frames); },
    uiFocus(patch) { return engine.uiFocus(patch || {}); },
    uiSearch(q) { return engine.uiSearch(q); },
    setAtHearth(v) { return engine.setAtHearth(v); },
    setDevicePixelRatio(n) { return engine.setDevicePixelRatio(n); },
    getDevicePixelRatio() { return engine._dpr || 1; },
    getUIPauseReport() { return engine.getUIPauseReport(); },
    listMenus() { return OPENABLE_MENUS.slice(); },
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
    /** W1-16 r2: put a row on, through `UISystem`'s own equip queue. See Engine.equipItem(). */
    equipItem(id) { return engine.equipItem(id); },
    getProvinceStats() { return engine.getProvinceStats(); },
    walkRoute(opts) { return engine.walkRoute(opts); },
    walkPath(points, opts) { return engine.walkPath(points, opts || {}); },
    streamAround(x, z, budget) {
      if (!engine.renderer.province) throw new Error('streamAround: no province is loaded');
      const queued = engine.renderer.province.request(Number(x), Number(z));
      const built = budget === undefined ? engine.renderer.province.drain() : engine.renderer.province.pump(Number(budget));
      return { queued, built, ...engine.renderer.province.stats() };
    },

    /**
     * provinceResidency(x, z) — HOW MUCH OF WHAT A CAMERA AT (x, z) NEEDS DOES NOT EXIST YET,
     * WITHOUT TOUCHING THE SCENE.
     *
     * Added for the capture service's G1 gate (ARBITRATION.md S34 anti-loophole). That gate used
     * `streamAround(x, z, 0)`, documented as "a pure read, because a budget of 0 builds nothing".
     * IT IS NOT A PURE READ, and the CAPTURE-SERVICE-R1 critic measured what it costs: at a camera
     * 3 km from the last teleport the probe took `tilesResident` from 25 to 0 and meshes from 247
     * to 5, BETWEEN the two frames the settle proof compares. `request()` (world/province.js)
     * re-focuses the streamer, rebuilds the ground skin, the near-prop disc and the cover disc,
     * and RELEASES every resident tile outside the new want-set. A budget of 0 only stops `pump()`
     * from building; everything destructive has already happened.
     *
     * This computes the same want-set — the same RADIUS x RADIUS ring of TILE_M tiles, clipped to
     * the field, from `stats()`'s own declared geometry so it cannot drift from the streamer's —
     * and reports the shortfall by reading `province.tiles` and `province.queue`. It sets no focus,
     * builds nothing, releases nothing, and rebuilds no disc. A measurement must not demolish the
     * thing it measures.
     *
     * @returns {{missing:number, want:number, resident_in_want:number, resident_total:number,
     *            queued_total:number, queued_in_want:number, tile_size_m:number,
     *            radius_tiles:number, read_only:true}}
     */
    provinceResidency(x, z) {
      const p = engine.renderer && engine.renderer.province;
      if (!p) throw new Error('provinceResidency: no province is loaded');
      const st = p.stats();
      const T = st.tileSizeM, R = st.residentRadiusTiles;
      const f = p.field;
      const tx0 = Math.floor(Number(x) / T), tz0 = Math.floor(Number(z) / T);
      const want = [];
      for (let dz = -R; dz <= R; dz++) {
        for (let dx = -R; dx <= R; dx++) {
          const tx = tx0 + dx, tz = tz0 + dz;
          if (tx < 0 || tz < 0 || tx * T >= f.sizeX || tz * T >= f.sizeZ) continue;
          want.push(`${tx},${tz}`);
        }
      }
      let resident = 0, queuedInWant = 0;
      const missingKeys = [];
      for (const k of want) {
        if (p.tiles.has(k)) resident++;
        else {
          missingKeys.push(k);
          if (p.queue.some((q) => q.k === k)) queuedInWant++;
        }
      }
      return {
        missing: want.length - resident,
        missing_keys: missingKeys,
        want: want.length,
        resident_in_want: resident,
        resident_total: st.tilesResident,
        queued_total: st.tilesQueued,
        queued_in_want: queuedInWant,
        tile_size_m: T,
        radius_tiles: R,
        meshes: st.meshes,
        instances: st.instances,
        read_only: true,
      };
    },

    // ---- rendering ---------------------------------------------------------------------------

    /**
     * W1-RENDER's debug channel, and the reason the piece is auditable at all.
     *
     * RI-CMB04's comparison method already demands that hit geometry be dumpable in world
     * space, "otherwise the geometry is unauditable and therefore not a bar". The DRAWN
     * geometry needs the same treatment for the same reason, and it needs it independently:
     * a renderer that reported the socket it was handed would agree with the fight no matter
     * what it actually put on the screen.
     *
     * So every number here is read back OUT of the live THREE scene graph — the weapon's own
     * `matrixWorld` and the skinned mesh's bone matrices — never from the CombatBody. The tip
     * is the weapon mesh's authored tip vertex pushed through the matrix the GPU will use.
     * `tip_vs_socket_b_mm` is therefore a real comparison of two independently-derived
     * points, and it is the "what you see is what hits you" bar in one number.
     */
    getDrawnGeometry() {
      const r = engine.renderer;
      const out = { actors: [] };
      const read = (id, group, body) => {
        const A = group && group.userData && group.userData.actor;
        if (!A) return;
        const rec = { id, built: !!A.built, rigged: !!A.rigged, visible: !!group.visible, weapon_key: A.weaponKey || null };
        if (A.built) {
          // Bone origins straight out of the skeleton three will skin with.
          rec.bones = {};
          for (let i = 0; i < A.built.bones.length; i++) {
            const e = A.built.bones[i].matrixWorld.elements;
            rec.bones[body && body.rig ? body.rig.def.bones[i].id : String(i)] = [e[12], e[13], e[14]];
          }
        }
        if (A.weapon && A.weapon.visible) {
          const m = A.weapon.matrixWorld.elements;
          rec.weapon_origin = [m[12], m[13], m[14]];
          // The authored tip: local (0, -socket_b_dist_m, 0), the blade axis skeleton.json
          // declares. Pushed through the drawn matrix, with no reference to the socket.
          const w = body && body.moves && body.moves._weapon;
          const move = body && body.move;
          const L = (move && move.socket_b_dist_m !== undefined) ? move.socket_b_dist_m : (w ? w.socket_b_dist_m : 0);
          const A0 = (move && move.socket_a_dist_m !== undefined) ? move.socket_a_dist_m : (w ? w.socket_a_dist_m : 0);
          const at = (d) => [m[0] * 0 + m[4] * -d + m[8] * 0 + m[12],
            m[1] * 0 + m[5] * -d + m[9] * 0 + m[13],
            m[2] * 0 + m[6] * -d + m[10] * 0 + m[14]];
          rec.drawn_tip = at(L);
          rec.drawn_guard = at(A0);
          rec.drawn_length_m = L;
          if (body) {
            const s = body.socketB, sa = body.socketA;
            rec.socket_b = [s[0], s[1], s[2]];
            rec.tip_vs_socket_b_mm = Math.hypot(rec.drawn_tip[0] - s[0], rec.drawn_tip[1] - s[1], rec.drawn_tip[2] - s[2]) * 1000;
            rec.guard_vs_socket_a_mm = Math.hypot(rec.drawn_guard[0] - sa[0], rec.drawn_guard[1] - sa[1], rec.drawn_guard[2] - sa[2]) * 1000;
          }
          // Triangle count of the drawn weapon, so "the mesh actually changed" is checkable.
          let tris = 0;
          for (const ch of A.weapon.children) if (ch.geometry && ch.geometry.index) tris += ch.geometry.index.count / 3;
          rec.weapon_tris = tris;
        }
        out.actors.push(rec);
      };
      const C = engine.sim && engine.sim._combat;
      read('player', r.playerMesh, C && C.player);
      for (const [eid, mesh] of r.enemyMeshes || []) read('enemy:' + eid, mesh, C && C.bodyOf ? C.bodyOf(eid) : null);
      // NPCs have no combat body, so they are posed by the group transform at the rest pose
      // (render/actor.js `poseStatic`). They are enumerated anyway: "the villagers are still
      // boxes" is exactly the kind of half-finished conversion this channel should be able to
      // catch, and it cannot catch it if it only looks at the two actors that were converted
      // first. `rigged` is expected to be FALSE here — that is the static path, not a fault.
      for (const [eid, mesh] of r.npcMeshes || []) read('npc:' + eid, mesh, null);
      return out;
    },

    /**
     * Where the bloodstain and the sapwell basins are ACTUALLY DRAWN, off the scene graph.
     *
     * W1-13 round 3. `GAP-W1-bloodstain-invisible-from-most-bearings` was diagnosed twice from
     * pixel counts alone and misdiagnosed both times, because a pixel count cannot separate
     * "the bloom is not drawn" from "the bloom is drawn somewhere the camera is not looking".
     * `getDeathState().bloodstain.pos` is the MODEL's position — `field.heightAt`, the collision
     * surface. What the player sees is `renderer._drawnGroundY`, which is two layers above it.
     * This returns the second number, read off `matrixWorld` rather than recomputed, so a probe
     * can aim at the thing instead of at where the model thinks it is.
     *
     * A pure read: it touches nothing and returns null when the marker group has not been built.
     */
    getDrawnMarkers() {
      const r = engine.renderer;
      const M = r && r._marks;
      // Nothing here may throw. A probe that aims its camera at this reading falls back to the
      // MODEL's position when it is absent, which is the very camera that produced
      // `GAP-W1-bloodstain-invisible-from-most-bearings` — so a thrown error would quietly
      // reinstate the defect instead of reporting itself.
      if (!M) return { present: false, stain: null, wells: [], why: 'the marker group has not been built' };
      const worldPos = (o) => {
        if (!o) return null;
        // `updateWorldMatrix` keeps this honest between draws; if this build's three predates it,
        // `matrixWorld` from the last draw is still the DRAWN position and is the right answer.
        try { if (typeof o.updateWorldMatrix === 'function') o.updateWorldMatrix(true, false); } catch (err) { /* last draw's matrix */ }
        const e = o.matrixWorld.elements;
        return [e[12], e[13], e[14]];
      };
      const describe = (g) => {
        if (!g) return null;
        const parts = [];
        g.traverse((o) => { if (o.isMesh) parts.push({ name: o.name || o.type, y: +(o.position.y).toFixed(4), visible: !!o.visible }); });
        return { pos: worldPos(g), visible: !!g.visible, in_scene: !!g.parent, parts, part_count: parts.length };
      };
      try {
        const wells = [];
        for (const [id, g] of (M.wells || new Map())) wells.push({ id, ...describe(g) });
        return { present: true, stain: describe(M.stain), wells };
      } catch (err) {
        return { present: true, stain: null, wells: [], error: String(err && err.message ? err.message : err) };
      }
    },

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
        moveBindings: MOVE_BINDINGS,
        padProfiles: engine.data.inputProfiles.pad_profiles,
        padQuirks: engine.data.padQuirks,
        analog: engine.data.inputProfiles.analog,
        touchLayout: engine.data.inputProfiles.touch,
        reserved: RESERVED_CONTROLS,
        audit: auditBindings(),
        rollover: rolloverAudit(),
        bufferFrames: engine.data.input.buffer_frames,
        bufferSlots: engine.data.input.buffer_slots,
        catchupCap: engine.data.input.catchup_cap_steps,
      };
    },

    // ---- A-JRN4: viewport / orientation / safe-area control (RI-JRN04 §F) ---------------
    //
    // Declared ABSENT by this file's own capability report for the whole of wave 1, which made
    // M-P16..M-P19 `unmeasurable` and therefore 0 fail-closed. It overrides the four things a
    // headless Chromium cannot be asked for: logical size, orientation, pointer coarseness and
    // the safe-area insets. Everything downstream — the touch layout, the HUD, the rotate
    // state, the device class — reads the SAME Viewport object the real media queries feed, so
    // this drives the shipped path and not a parallel one.
    setViewport(o) {
      if (!engine.real) throw new Error('setViewport(): no real input path on this engine');
      return engine.real.viewport.setOverride(o);
    },
    getViewport() {
      if (!engine.real) throw new Error('getViewport(): no real input path on this engine');
      return engine.real.viewport.state();
    },

    /** The latched movement vector the sim consumed this step — the stick's world-side output. */
    getMoveVector() { return [engine.input.moveX, engine.input.moveY]; },
    /** The A-JRN7 edge log: {button, edge, recv_step, attributed_step}. An OBSERVER, not a consumer. */
    getInputEdges() { return engine.input.edges.slice(); },
    /** Select a pad profile by name (RI-JRN04 §C). Normally chosen by device class (H2). */
    setPadProfile(name) { return engine.real && engine.real.pad ? engine.real.pad.setProfile(name) : null; },
    /**
     * Push a WHOLE `navigator.getGamepads()` array, so the two-pad case (L6) and a descriptor
     * with a non-standard button count can both be driven. `null` restores the real navigator.
     */
    setSyntheticPads(list) {
      if (!engine.real) return null;
      engine.real.syntheticPads = list === undefined || list === null ? null : list;
      return engine.real.pollGamepad();
    },
    /**
     * RI-MTH07 §B — perturb the INPUT MODEL and watch the world. `path` is dotted into
     * `game/data/input/profiles.json` as the running game holds it; the change takes effect on
     * the next poll because every consumer reads the document rather than a copy taken at boot.
     * This is the call that proves the data file is a model and not paperwork.
     */
    perturbInput(spec) {
      if (!engine.real) throw new Error('perturbInput(): no real input path');
      if (!engine._inputProfilesPristine) engine._inputProfilesPristine = JSON.parse(JSON.stringify(engine.data.inputProfiles));
      const parts = String(spec.path).split('.');
      let o = engine.data.inputProfiles;
      for (let i = 0; i < parts.length - 1; i++) o = o[parts[i]];
      const last = parts[parts.length - 1];
      const before = o[last];
      o[last] = spec.value;
      // The desktop table is compiled into a control map, so a desktop edit must recompile.
      if (parts[0] === 'desktop') { setProfiles(engine.data.inputProfiles); engine.real.rebinder.restoreDefaults('keyboard'); }
      if (parts[0] === 'touch') engine.real.touch.cfg = engine.data.inputProfiles.touch;
      return { path: spec.path, before, after: o[last] };
    },
    perturbInputReset() {
      if (!engine.real || !engine._inputProfilesPristine) return false;
      const fresh = JSON.parse(JSON.stringify(engine._inputProfilesPristine));
      for (const k of Object.keys(engine.data.inputProfiles)) delete engine.data.inputProfiles[k];
      Object.assign(engine.data.inputProfiles, fresh);
      setProfiles(engine.data.inputProfiles);
      engine.real.rebinder.profiles = engine.data.inputProfiles;
      engine.real.rebinder.restoreDefaults('keyboard');
      engine.real.touch.cfg = engine.data.inputProfiles.touch;
      engine.real.pad.profiles = engine.data.inputProfiles;
      engine.real.pad.analog = engine.data.inputProfiles.analog;
      engine.real.pad.setProfile(engine.data.inputProfiles.default_pad_profile);
      engine.real._rebuildKeyboard();
      return true;
    },

    // ---- RI-JRN03 §E / RI-JRN04 M-P23: the rebinding surface ----------------------------
    openRebinding(device) { return engine.real ? engine.real.openRebinding(device) : null; },
    closeRebinding() { return engine.real ? engine.real.closeRebinding() : null; },
    rebindView() { return engine.real ? engine.real.rebinder.view(engine.real.layoutMap) : null; },
    rebindStep() { return engine.real ? engine.real.rebinder.step(engine.input) : null; },
    rebindOffer(control) { return engine.real ? engine.real.rebinder.offer(control) : null; },
    rebindCommit(take) { return engine.real ? engine.real.rebinder.commit(take !== false) : null; },
    rebindBegin(action, slot) { return engine.real ? engine.real.rebinder.beginCapture(action, slot | 0) : null; },
    rebindUnbind(action, slot) { return engine.real ? engine.real.rebinder.unbind(action, slot | 0) : null; },
    rebindSerialise() { return engine.real ? engine.real.rebinder.serialise() : null; },
    rebindRestore(doc) { return engine.real ? engine.real.rebinder.restore(doc) : null; },

    // ---- RI-JRN04 §G: the touch fallback ------------------------------------------------
    //
    // Injected as POINTER EVENTS at the same seam the browser delivers them, so the whole
    // hit-testing, floating-stick and multi-touch path runs. `touchState()` reports what the
    // build believes; `touchLayout()` reports what it would draw, which is what M-P17 measures
    // against the insets.
    touchDown(id, x, y) { return engine.real ? engine.real.touch.down(id, x, y) : null; },
    touchMove(id, x, y) { return engine.real ? engine.real.touch.move(id, x, y) : null; },
    touchUp(id) { return engine.real ? engine.real.touch.up(id) : null; },
    touchLayout() { return engine.real ? engine.real.touch.layout() : null; },
    touchState() { return engine.real ? engine.real.touch.state() : null; },
    setTouchEnabled(on) {
      if (!engine.real) return null;
      engine.real.touch.enabled = !!on;
      if (on) engine.real.touch.attach(); else engine.real.touch.detach();
      return engine.real.touch.enabled;
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
    /**
     * Resume a paused census node. `by` is the act the node is waiting for — `getCensusState()`
     * publishes it as `resume_by` ('talk' in the hold, 'walk' at the companionway) — and the
     * census REFUSES a resume that names the wrong act, so a probe cannot skip the walk by
     * asserting it talked. Omit it to accept whatever the node is asking for.
     */
    censusEnter(by) { return engine.censusEnter(by); },
    /** Answer the node in front of you. Throws on an illegal answer. */
    censusAnswer(value) { return engine.censusAnswer(value); },
    /** What a renderer draws and what a critic screenshots. `full_screen_panels` is 0. */
    getCensusState() { return engine.getCensusState(); },

    // ================= W1-26 — the opening, as a played scene ==================================
    // `RI-JRN01` M20/HF9 (the title surface) and §0.1(a) M9/M15 (the rendered-text accessor
    // condition), plus `RI-JRN09` M1's `DTR`.

    /**
     * The title surface. `present` is true in every mode; `shown` says whether it is up.
     * `option_ids` is the set M20 checks against O3 — always the same five at the root page,
     * with `enabled` telling the truth about each rather than the row being hidden.
     */
    getTitleState() { return engine.getTitleState(); },
    /** Raise it in any mode. Refreshes the save list, so `Continue` is never a stale claim. */
    titleShow() { return engine.titleShow(); },
    titleDismiss(by) { return engine.titleDismiss(by); },
    /**
     * Commit to a row through the same entry point a player's `interact` reaches. Returns a
     * promise for `continue` / `slot:*` because IndexedDB is async. M20's "and `Continue`
     * loads that save" is this call plus a `getPlayerStats()`.
     */
    titleActivate(id) { return engine.titleActivate(id); },

    /**
     * **THE RENDERED-TEXT ACCESSOR.** `RI-JRN01` §0.1(a) refuses to score M9 and M15 at all
     * against a build that cannot enumerate what its frame says — this game draws every
     * string into the WebGL canvas, so `document.body.innerText` is `""`, the accessibility
     * tree is a childless `WebArea`, and a grep over either returns zero hits and reads as a
     * clean pass. `RI-MTH06` §B names that failure in advance.
     *
     * This register is fed by the **draw call**: `render/text-register.js` wraps every 2D
     * context the renderer owns and hooks the vector glyph path as well, so nothing can appear
     * here that was not handed to a drawing primitive, and nothing handed to one can fail to
     * appear. It also shadows the clip state, so a string painted outside its surface's clip
     * region comes back `clipped: true` and is excluded from `entries` — orphan text one layer
     * below the round-2 defect.
     *
     * W1-26 ROUND 2 — WHY THIS RETURN VALUE NOW CARRIES `complete` AND `blind_surfaces`.
     * This method used to publish a HARDCODED `surfaces_instrumented: ['dialogue','title']`.
     * The build owned three 2D surfaces; the third, `menus`, is exactly M9's domain ("every
     * string rendered outside a dialogue/journal/book surface") and was not wrapped — and could
     * not have been helped by wrapping alone, because the HUD paints through `ui/glyphs.js`,
     * which strokes vector paths and never calls `fillText`. So M9 searched **0 strings and
     * recorded a pass**; over its real domain it was 5 strings and 1 hit. That is `RI-JRN01`
     * How-we-lose #15 — "the instrument is blind and the grep comes back clean" — reproduced by
     * the fix written to close it, and strictly worse than the empty accessibility tree it
     * replaced, because an empty tree announced its own emptiness and this returned twelve
     * confident strings and a summary block.
     *
     * Two changes, and the second matters more than the first. The literal is gone: what is
     * published is derived from the contexts the register actually wrapped. And the roster is
     * published beside it, so **an empty result and a clean result are no longer the same
     * value**: a query whose scope includes a surface the register cannot see comes back
     * `complete: false` with that surface named, and every check computed over this stream is
     * required to report `unmeasurable` — never `pass` — when it is false.
     * `tools/harness/w1-26-opening.mjs` exits non-zero on it; a probe that cannot go red is
     * worse than no probe.
     *
     * @param {object} [opts]
     *   `since` (entry index), `sinceFrame`, `surface` / `notSurface`
     *   ('dialogue' | 'title' | 'menus'), `includeClipped` (default false).
     */
    getRenderedText(opts) {
      const o = opts || {};
      const reg = engine.renderer.textRegister;
      const entries = o.includeClipped ? reg.all(o) : reg.drawn(o);
      const distinct = [];
      const seen = new Set();
      for (const e of entries) if (!seen.has(e.text)) { seen.add(e.text); distinct.push(e.text); }
      // Scoped to the SAME surface filter the entries were taken under, so a caller who greps
      // `{notSurface:['dialogue']}` is told whether *that* domain is fully covered rather than
      // whether the build as a whole is.
      const cov = reg.coverage(o);
      return {
        accessor: 'window.__HARNESS.getRenderedText()',
        source: 'the draw call — CanvasRenderingContext2D.fillText/strokeText, and ui/glyphs.js drawText() '
          + 'through the register\'s per-context hook (game/src/render/text-register.js)',
        // Derived from the register's roster. Never a literal — see the note above.
        surfaces_declared: cov.declared,
        surfaces_instrumented: cov.instrumented,
        surfaces_in_scope: cov.in_scope,
        blind_surfaces: cov.blind,
        draw_paths: cov.paths,
        surface_notes: cov.why,
        /**
         * FAIL-CLOSED. False means this result is IGNORANCE, not absence: some surface inside
         * the query's scope draws text the register cannot see. `measurable` is the same field
         * under the name a second critique reached for; both are published so neither spelling
         * silently returns `undefined` and reads as falsy-but-fine.
         */
        complete: cov.complete,
        measurable: cov.complete,
        next_index: reg.seq,
        entries,
        distinct,
        distinct_count: distinct.length,
        clipped_excluded: !o.includeClipped,
        summary: reg.summary(),
      };
    },
    /** Reset the register — a probe measuring one node clears, steps, then reads. */
    renderedTextClear() { return engine.renderer.textRegister.clear(); },

    /** The roster on its own, for a critic who wants coverage without pulling every entry. */
    registerSurfaces(opts) { return engine.renderer.textRegister.coverage(opts || {}); },

    /**
     * **THE FALSIFICATION.** Draw one sentinel through each of the build's two text draw paths,
     * onto the surface M9 is aimed at, and report what the register saw.
     *
     * `AGENT-PROTOCOL`: "before trusting your own instrument, break the thing it measures on
     * purpose and confirm the instrument goes red." This is the positive half of that — the
     * round-1 critic falsified the old register exactly this way and found the vector sentinel
     * invisible and the `fillText` one visible. Anyone can now re-run it in one call, and a
     * regression that re-blinds the glyph path shows up as `vector.seen: false` rather than as
     * a quietly smaller number somewhere downstream.
     */
    /**
     * Draw one exact string onto the HUD/menus surface through the VECTOR glyph path — the path
     * the whole interface really uses — and report what the register saw.
     *
     * For a delete-the-fix: put a string a repair removed back on the frame, through the real
     * draw path, and check that the grep it was supposed to trip actually trips. A probe that
     * asserts a bad string is gone without ever showing that its check would have caught the
     * string is asserting its own diligence.
     */
    drawOnMenus(text) {
      const s = String(text);
      const reg = engine.renderer.textRegister;
      const ctx = engine.renderer.menus.ctx;
      const mark = reg.seq;
      ctx.save();
      drawGlyphText(ctx, s, 20, 120, faceOf('bone'), 16, '#fff');
      ctx.restore();
      const rows = reg.all({ since: mark });
      return { text: s, seen: rows.some((e) => e.text === s), surface: 'menus', entries: rows.length };
    },

    drawSentinels(tag) {
      const t = String(tag || 'ES-SENTINEL');
      const reg = engine.renderer.textRegister;
      const surf = engine.renderer.menus;
      const ctx = surf.ctx;
      const mark = reg.seq;
      const vecText = t + '-VECTOR', fillText = t + '-FILLTEXT';
      // Drawn straight onto the surface's context, outside `el()`, deliberately: this is a test
      // of the REGISTER's reach, not of the element vocabulary.
      ctx.save();
      drawGlyphText(ctx, vecText, 20, 40, faceOf('bone'), 16, '#fff');
      ctx.font = '16px sans-serif';
      ctx.fillStyle = '#fff';
      ctx.fillText(fillText, 20, 80);
      ctx.restore();
      const rows = reg.all({ since: mark }).map((e) => ({ surface: e.surface, kind: e.kind, text: e.text }));
      const saw = (s) => rows.find((r) => r.text === s) || null;
      return {
        surface: 'menus',
        vector: { path: 'ui/glyphs.js drawText() — stroked quadratic paths', text: vecText, seen: !!saw(vecText), entry: saw(vecText) },
        fill: { path: 'CanvasRenderingContext2D.fillText', text: fillText, seen: !!saw(fillText), entry: saw(fillText) },
        rows,
        both_seen: !!saw(vecText) && !!saw(fillText),
      };
    },

    /**
     * `first_input`, `first_control` and the first field-writing node, as frames.
     *
     * `RI-JRN01` M4 clause 1 is the interval between the second and the third, in available
     * play seconds, and `BAR-CRITIQUE-W1-07-R1` §R1 blocked it on the ground that **neither
     * event existed** — both types have been in the closed A-JRN7 vocabulary since it was
     * written and were emitted by nothing. They are emitted now (`Engine._journeyStamps`),
     * so O6 — the item's own best idea, and the only bar in this corpus that measures
     * Morrowind's "you get a body before you get a character" — is measurable.
     */
    getJourneyStamps() { return engine.getJourneyStamps(); },

    /**
     * The MODEL the surface was built from — RI-JRN09 M1's "the distinct authored strings the
     * model computes for that node", as distinct from `getCensusState()`, which is the raw
     * census state one layer earlier. The two differ in exactly the place that matters:
     * `buildCensusModel()` demotes the scribe's stock framing to `preamble` and puts the
     * QUESTION in `line`, while the raw state keeps the stock line at all ten questionnaire
     * nodes. A DTR computed against the raw state measures a scene the build does not draw.
     */
    getCensusModel() { return engine.renderer ? engine.renderer.ui.model : null; },

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

    // ---- W1-07 round 3: the world-side reader for greetings and race-gated topics ------
    /**
     * Talk to somebody. Returns the greeting they gave you, WHICH CELL of
     * `dialogue/greetings.json` it came out of, and the topics they will discuss with the
     * character currently in the world after `requires.race` / `forbids.race`.
     */
    talkTo(eid) { return engine.talkTo(eid); },
    /** Say a topic. Returns the info, or `{refused:'no_info'}` — never a silent nothing. */
    conversationSay(topic) { return engine.conversationSay(topic); },
    conversationClose() { return engine.conversationClose(); },
    /**
     * RI-DLG04 §C's four verbs against the person you are talking to. The world-side caller of
     * `sim/dialogue/disposition.js persuade()`, which had none until W1-19 round 2 — and which
     * is the only thing in the build that can move a standing UP, and therefore the only reason
     * a race handicap on a quest gate is a price rather than a wall. Gold is spent either way
     * (seam S15) and the roll comes off the seeded PRNG, so a replay says the same thing.
     */
    conversationPersuade(verb) { return engine.conversationPersuade(String(verb)); },
    getConversationState() { return engine.getConversationState(); },
    /**
     * W1-14 round 4. READ-ONLY view of the spellmaking counter, or null when nobody has one
     * open. This is an OBSERVABLE, not a door: it cannot open a counter, cannot edit a draft and
     * cannot buy anything. The only way in is `talkTo` a spellwright and `conversationSay` the
     * subject, which is the only way a player has either.
     */
    commissionState() { return engine.commissionState(); },

    /**
     * RI-WLD09 §B1's opacity register, as the running world sees it: which of the twenty-four
     * mysteries the character has met, by which route, and how many times somebody has declined
     * to discuss one. It reports NO answers and there is no call that could — the sealed half
     * lives in the corpus, is never shipped, and is not reachable from this process.
     *
     * M-OP2's discovery diff is not computable without this. `getQuestState().booksRead` is the
     * same evidence set seen from the other side.
     */
    getOpacityState() { return engine.getOpacityState(); },
    // W1-23. RI-LOR06's texture from the running world: which registered disputes this
    // playthrough has heard argued and from how many sides. Carries no rulings and cannot —
    // `authorially_true` is replaced by a sha256 before the file is shipped.
    getCanonState() { return engine.getCanonState(); },

    /** Put a person in the world (a state file's `npcs` array uses the same path). */
    spawnNPC(spec) { return engine.spawnNPC(spec || {}); },

    /** Pick up a world object. RI-JRN01 O6/M10's takeables. */
    takeProp(eid) { return engine.takeProp(eid); },
    /**
     * Put a takeable object in the world. RI-MAG06 §B judges `telekinesis` by "an object outside
     * melee reach becomes takeable", and until this line there was NO WAY to put an object into a
     * probe's arena at all — `sim.props` is populated only by `loadState`, and `arena_flat` ships
     * none. So the one effect whose whole verb is *reach* was measured in a world with nothing to
     * reach for, and read as moving nothing.
     *
     * This is an ARENA-CONSTRUCTION call of the same class as `spawn()` — it places a subject.
     * RI-MAG06 §E / M8 audits arena calls that hand the caster a **gate** (a skill, a rank, a
     * standing, a knowledge flag); a barrel on the floor is not a gate, and the effect still has
     * to reach it on its own.
     */
    spawnProp(spec) { return engine.spawnProp(spec); },
    clearProps() { return engine.clearProps(); },
    /**
     * The durable world-mutation register — `sim.world`, RI-JRN05 §B "World", the one
     * `save/state.js` persists. This is the WORLD SIDE of the lock, breakable and item verbs:
     * `open_lock` writes `doorsUnlocked`, `shatter` writes `shortcutsOpened`, taking a prop
     * writes `itemsTaken`. Exposed because RI-MAG06 M7 forbids computing a signature from the
     * magic module's own bookkeeping, and `getMagicWorld()` IS the magic module's own
     * bookkeeping — a census that reads only that cannot tell a verb that changed the world from
     * a verb that changed magic's private notes about the world.
     */
    getWorldRegisters() {
      const w = engine.sim.world;
      return {
        containers_emptied: [...w.containersEmptied].sort(),
        doors_unlocked: [...w.doorsUnlocked].sort(),
        shortcuts_opened: [...w.shortcutsOpened].sort(),
        items_taken: [...w.itemsTaken].sort(),
        npcs_dead: [...w.npcsDead].sort(),
        enemies_dead_until_rest: [...w.enemiesDeadUntilRest].sort(),
        fog_gates_passed: [...w.fogGatesPassed].sort(),
      };
    },
    /**
     * Seed the Recall destination. A PRECONDITION, in the same class as `damagePlayer()` and
     * `addAffliction()`: without a wound `restore_health` is unobservable for want of a wound
     * rather than for want of a handler, and without a mark `recall` is unobservable for want of
     * a destination. It is not a gate — §E/M8's audit is of skills, ranks, standings and
     * knowledge flags, and `mark`'s own row still has to overwrite whatever this wrote.
     */
    setTravelMark(pos) {
      engine.sim.quest.travel.mark = pos ? [Number(pos[0]), Number(pos[1] || 0), Number(pos[2])] : null;
      return engine.sim.quest.travel.mark;
    },

    /**
     * WOUND A BODY. The same class of precondition as `damagePlayer()` and `setTravelMark()`,
     * and it exists for the same reason: `restore_health` cast as an AREA can only reach bodies
     * (`MagicSystem.step` walks `side === 'E'`, never the caster), so in an arena where every
     * body is at full health an area heal is unobservable for want of a wound rather than for
     * want of a radius — and the round-3 dial census read it as blind on all three dials for
     * exactly that reason. Writes hp directly rather than routing a hit, so it cannot stagger,
     * aggro, proc a status or spend a ward charge and become the difference between two arms.
     */
    damageEnemy(eid, amount) {
      const b = engine.combat.bodyOf(String(eid));
      if (!b) throw new Error(`damageEnemy('${eid}'): no such body`);
      b.hp = Math.max(1, b.hp - Number(amount));
      const e = engine.sim.findEntity(String(eid));
      if (e) e.hp = b.hp;
      return { eid: String(eid), hp: b.hp, hp_max: b.hpMax };
    },

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

    /**
     * OPEN the carried writ and draw it. RI-JRN01 M8 (amended wave 1) hard-fails an O10 object
     * that is "present only as an API return value" — which `readWrit()` alone is — and
     * requires the rendered-text set at the open node to be non-empty and to contain the
     * player's answers. In play the same thing happens on `use_item`; this is the harness seam.
     */
    openWrit() { return engine.openWrit(); },
    closeWrit() { return engine.closeWrit(); },
    getWritReaderState() { return engine.getWritReaderState(); },

    /**
     * W1-05 / RI-WLD06 L2. READ the signpost you are standing at, through the same reach the
     * player's `interact` press uses, and draw it. Note that this is the harness *seam*, not
     * the harness *proof*: RI-MTH07 §B1 rules a harness return value an observer and not a
     * consumer, so a probe that only calls `signRead()` has measured `signRead()`. The
     * observable that counts is the drawn panel (`getUIState().rendered_text`) and the drawn
     * post in the scene graph (`sceneCensus()` names them `signpost:<id>`).
     */
    signRead() { return engine.signRead(); },
    signClose() { return engine.signClose(); },
    getSignReaderState() { return engine.getSignReaderState(); },
    /**
     * Every post in the build, with the arm bearings, so a critic can run RI-WLD06 M28 without
     * re-reading the data file — and so the M28.3 bearing check is asked of what the engine
     * loaded rather than of what is on disk.
     */
    listSignposts() {
      const f = engine.field;
      if (!f || !f.signs) return { present: false, signposts: [] };
      return {
        present: true, count: f.signs.length,
        signposts: f.signs.map((s) => ({
          id: s.id, kind: s.kind, style: s.style, legible: s.legible, road_class: s.road_class,
          x: s.x, z: s.z, region: s.region, lines: s.lines,
          arms: s.arms.map((a) => ({ name: a.name, to: a.to, compass: a.compass, bearing_deg: a.bearing_deg, along_deg: a.along_deg, path_m: a.path_m })),
        })),
      };
    },

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

    /**
     * W1-POPULATION. What the hostile population is doing right now: how many posts exist, how
     * many are resident, how many the player has cleared, and which bodies belong to which post.
     * READ ONLY — it never spawns, releases or re-focuses anything, so a probe that calls it
     * every frame is measuring the world rather than driving it.
     */
    populationReport() { return engine.population ? engine.population.report(engine.sim) : null; },

    /**
     * The ablation switch, and the reason it exists in the API rather than in a probe's own
     * monkey-patch: RI-MTH07 wants the consumption arm to be a thing the WORLD can be told to
     * stop doing, so that a control run differs from the live one by one boolean and not by a
     * different code path. `setPopulation({enabled:false})` and the province is empty again.
     */
    setPopulation(opts) {
      if (!engine.population) return null;
      const o = opts || {};
      if (o.enabled !== undefined) engine.population.enabled = !!o.enabled;
      for (const k of ['spawn_radius_m', 'release_radius_m', 'max_resident_posts', 'refocus_m', 'spawn_per_step']) {
        if (o[k] !== undefined) engine.population.d[k] = Number(o[k]);
      }
      if (o.reset) engine.population.reset();
      return engine.population.report(engine.sim);
    },

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
    hearthRest(opts) { return engine.hearthRest(opts || {}); },

    // ---- W1-13 — death, the bloom and the run back (RI-JRN06, RI-PRG04 §6) ----------------
    // A-JRN7's `bloodstain_create` / `bloodstain_recover` were in the event vocabulary from
    // wave 1 and emitted by nothing; A-JRN3's `getStateHash()` already exists. These are the
    // verbs the item's five scenarios need on top of them.

    /** The 29 sapwells, their two boss fog gates, and the measured spacing they were placed by. */
    listHearths() { return engine.listHearths(); },

    /** The boss arenas as VOLUMES: where they are, who is behind each, and which have been crossed. */
    getFogGates() { return engine.getFogGates(); },

    /**
     * Rest. Everything RI-PRG04 §1 says a HEARTH does, and it is the ONLY thing in this build
     * that sets a respawn point. `{at: '<hearth-id>'}` names a well explicitly for a scenario
     * whose cell has none in it; without it the well the body is standing at is used, and the
     * return value says which of the two happened.
     */
    restAt(id) { return engine.hearthRest(id ? { at: String(id) } : {}); },

    /**
     * Everything the death loop knows: the surface, the bloom, the souls, the respawn point,
     * the per-death log, and — for seam S5 — the respawn CLASSIFICATION of every live entity
     * with the reason it is in or out of scope.
     */
    getDeathState() { return engine.getDeathState(); },

    /**
     * Take the player to 0 HP. The death itself is NOT fired here: it fires from `_afterStep`
     * on the next `stepFrames(1)`, through exactly the code path a real killing blow takes.
     * A probe that killed AND respawned in one synchronous call would be measuring itself.
     */
    killPlayer(cause) { return engine.killPlayer(cause); },

    /**
     * Touch the bloom. Recovery is by proximity in the fixed loop (RI-PRG04 §6: "walk into
     * it"), so this is the same call the loop makes and exists only so a probe can assert the
     * refusal at range as well as the credit inside it.
     */
    recoverBloodstain() { return engine.recoverBloodstain(); },

    /** Skip the death surface (RI-JRN06 D5). Any real input does this; so does this. */
    skipDeathSurface() {
      return engine.death ? engine.death.requestSkip(engine.sim.frame) : false;
    },

    /**
     * Mark an entity as a named actor, quest actor or merchant — the S5 exemption, applied to
     * a body that is already in the world. `spawn(id, x, z, {named: true})` does it at spawn
     * time; this does it after, which is what a quest that recruits a mob needs.
     */
    setEntityNamed(eid, flags) {
      const e = engine.sim.findEntity(String(eid));
      if (!e) throw new Error(`setEntityNamed('${eid}'): no such entity`);
      const f = flags === undefined || flags === true ? { named: true } : flags;
      for (const k of Object.keys(f)) e[k] = !!f[k];
      return { eid: e.eid, flags: f, respawns: engine.death.respawns(e, null) };
    },

    /**
     * The S5 classification table itself, and the ONE knob a CONSUMPTION probe perturbs:
     * `game/data/world/respawn.json`'s rules, live. Change `respawning_tiers` and an entity
     * that came back stops coming back — which is the observation `RI-MTH07` §B asks for.
     */
    getRespawnRules() { return JSON.parse(JSON.stringify(engine.death.d)); },
    setRespawnRules(patch) {
      Object.assign(engine.death.d.rules, patch || {});
      return JSON.parse(JSON.stringify(engine.death.d.rules));
    },

    /**
     * REPLACE THE PLACEMENT TABLE. `game/data/world/hearths.json` is the model
     * `RI-MTH07` asks to be perturbed for the respawn position, and until now the only way to
     * make the respawn point unresolvable was to null `hearthLastRested` — which, since W1-13
     * round 2 gave `respawnHearth()` a nearest-well FLOOR, is no longer the same thing as "the
     * table is empty". Emptying the table is: with no wells anywhere, there is nowhere to wake
     * up and the body stays where it fell. That is the null control the model needs, and it
     * perturbs the DATA rather than a private field.
     *
     * Pass an array of hearth records to install, or `null` to restore the shipped table.
     */
    setHearths(list) {
      const hs = engine.hearths;
      if (!hs) throw new Error('setHearths: no hearth registry');
      if (!hs._shipped) hs._shipped = hs.d.hearths;
      hs.d.hearths = list === null || list === undefined ? hs._shipped : list.map((x) => ({ ...x, pos: [...x.pos] }));
      hs.byId = new Map();
      for (const x of hs.d.hearths) hs.byId.set(x.id, x);
      return { count: hs.count(), ids: hs.d.hearths.map((x) => x.id) };
    },

    /**
     * THE WORLD MAP'S KNOB, and the reason `RI-JRN06` M-D5 is no longer an orphan predicate.
     *
     * `never_respawn_entity_flags` decides whether a body ever stands back up, and in round 1
     * the ONLY thing that could set one of those flags was `setEntityNamed()` above — a harness
     * verb. That is `RI-MTH07` §A's orphan: a rule that decides something, that nothing in the
     * world supplies, that only a critic hand-feeds. The verdict scored it 0.
     *
     * `game/data/world/hearths.json`'s fog gates each name their `boss` statblock, and
     * `engine._classifyOnSpawn()` now flags anything spawned from a statblock the map calls a
     * boss. This verb repoints a gate at a DIFFERENT statblock, so a CONSUMPTION probe can
     * perturb the WORLD MAP and watch an ordinary mob stop standing back up — no harness flag
     * anywhere in the path, and the observable is a silhouette.
     */
    setFogGateBoss(gateId, statblockId) {
      const g = (engine.hearths ? engine.hearths.gates : []).find((x) => x.id === String(gateId));
      if (!g) {
        throw new Error(`setFogGateBoss('${gateId}'): no such fog gate. Known: `
          + (engine.hearths ? engine.hearths.gates.map((x) => x.id).join(', ') : '(no hearth registry)'));
      }
      const was = g.boss;
      g.boss = statblockId === null || statblockId === undefined ? null : String(statblockId);
      return { gate: g.id, was, now: g.boss };
    },

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

    /**
     * Gold is the only currency (S15); spellmaking and enchanting spend it and nothing else.
     * Routed through `Engine._setGold`/`_gold` (W1-16) so this agrees with what fencing pays,
     * what a travel fare spends, what the save round-trips, and what the inventory screen draws
     * — one purse, not four.
     */
    setGold(n) { return engine._setGold(n); },
    getGold() { return engine._gold(); },

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
    /**
     * READ-ONLY: what a hit of `amount` and kind `kind` WOULD cost this body, through the same
     * `mitigate()` the weapon resolver uses. Nothing is applied and nothing is spent.
     *
     * `damagePlayer()` remains the honest instrument for a single measurement — RI-MAG06 §B
     * says a ward is judged by the damage taken from a real scripted hit. But a CENSUS reads
     * every channel on every body twice per run, and seven real 100-damage hits taken twice
     * kill the caster before it can cast anything, which is a snapshot perturbing the thing it
     * is snapshotting. This is the same arithmetic without the corpse.
     */
    probeWard(amount, kind, eid) {
      const b = eid ? engine.combat.bodyOf(String(eid)) : engine.combat.player;
      if (!b) return null;
      const raw = Number(amount);
      const k = kind || 'physical';
      const saved = b.wardCharges;
      const applied = mitigate(b, raw, k);
      b.wardCharges = saved;
      return Math.round(applied * 1000) / 1000;
    },
    /**
     * The inventory with its condition — `mend_item` raises it, `corrode` lowers it.
     *
     * W1-16 round 2 added `slot`. Equipped weight is what RI-PRG07 §2 divides by maxLoad to get
     * the in-fight roll tier, and until this line the harness could not see which rows were worn
     * at all — so "did equipping the hauberk change the roll" was answerable only through the
     * `__ENGINE` back door, which is not a measurement of the shipping surface.
     */
    getInventory() {
      return (engine.sim.inventory || []).map((i) => ({
        id: i.id, count: i.count, condition: Math.round((i.condition === undefined ? 1 : i.condition) * 1e4) / 1e4,
        slot: i.slot || null,
      }));
    },
    /** RI-LOR05 §4a: read the taint register; and clear it, for a probe that needs to count from 0. */
    getSapTaint() { const t = engine.sim.progression.sapTaint; return t ? { ...t } : null; },
    resetSapTaint() { engine.sim.progression.sapTaint = null; return engine.hearthRest ? true : true; },

    /**
     * The dial census's self-test (`w1-14-r3-dials.mjs --break=bindblind`). Restores the
     * magnitude-blind summon handler round 3 shipped: `bind_lesser`/`bind_greater` read the
     * magnitude dial and discard it, so a 1-point call and a 90-point call put the identical
     * body on the floor. The two rows must go COUPLED -> MAGNITUDE_BLIND under this.
     */
    __breakBindMagnitude() { engine.magic._bindMagnitudeBlind = true; return true; },

    /**
     * The other half of the same self-test. Switches off the flee loop in `MagicSystem.step`,
     * restoring round 3's `demoralise`: `fleeingUntil` written, never read, the routed body
     * standing exactly where it was and indistinguishable from `calm_beast`.
     */
    __breakFleeMotion() { engine.magic._fleeDisabled = true; return true; },

    /**
     * W1-14 round 4 DELETE-THE-FIX #1 — the shared statblock.
     *
     * Restores `combat/enemy.js`'s pre-round-4 aliasing: `moves._weapon` becomes the statblock's
     * OWN object again, so `bindHandler`'s `attack_rating` scaling compounds across casts and
     * leaks into every later body of that kind. Six identical `bind_lesser` casts must go from
     * one distinct attack rating to six (191, 424, 941, 2089, 4638, 10296 at magnitude 40).
     *
     * A body already on the floor keeps the table it was built with, so this must be armed
     * before the first summon of the arm — and, because the statblock object itself is what gets
     * scaled under the break, the arm has to run in its own page. `w1-14-r4-summon.mjs` does
     * both and says so.
     */
    __breakSummonAlias(on) { return __setWeaponAliasing(on === undefined ? true : !!on); },
    /** Read-only: is the aliasing sabotage armed? So a report cannot mislabel its own arms. */
    __weaponAliasingArmed() { return __weaponAliasing(); },

    /**
     * W1-14 round 4 DELETE-THE-FIX #2 — the touch applicator.
     *
     * Restores the pre-round-4 volume loop, which had no per-target dedupe, so a `touch` spell
     * applies once per active frame of its cast class (4 at CANTRIP, 5 at LIGHT, 7 at HEAVY)
     * instead of once. `damage_health` at magnitude 20 must go from 44 damage back to 176/220/308.
     */
    __breakTouchDedupe(on) { engine.magic._volumeDedupeDisabled = on === undefined ? true : !!on; return engine.magic._volumeDedupeDisabled; },

    /**
     * W1-14 round 4 DELETE-THE-FIX #3 — the door into spellmaking.
     *
     * Shuts the commission counter without removing the seven spellwrights, the topic or the
     * screen, so the control arm is "the player walks to the right person, in the right town,
     * raises the right subject, and cannot commission anything" rather than "the NPC is not
     * there". Those are different world-states and only the first one tests the door.
     */
    __breakCommissionCounter(on) { engine._commissionDisabled = on === undefined ? true : !!on; return !!engine._commissionDisabled; },

    /**
     * W1-16 round 2 DELETE-THE-FIX, as a first-class control arm rather than a `git stash`.
     *
     * RULES.md #6 wants the fix removed and the OLD number back, and #17 warns that doing that
     * with a stash on a tree twenty-nine agents are writing to is how a neighbour's `git add -A`
     * stages your temporary deletion. So each of this round's four couplings has a switch that
     * restores the exact pre-round-2 behaviour, and the probe runs both arms in one browser:
     *
     *   producer — `_recomputeEquipLoad()` never runs, so `equipLoadPct` has no writer but
     *              `setEquipLoad()`, the hardcoded 24.0 and the feather spell. The world's
     *              equipment cannot reach the roll.
     *   slots    — `_finishEquipCommit()` can only fill 'right', so armour goes in the sword hand.
     *   travel   — `travel_time` is computed, reported and read by nothing.
     *   sprint   — burden never reaches `denySprint`, so an Overladen player sprints home.
     *
     * `__breakW116(null)` clears them. A probe that cannot produce the failure it is looking for
     * has not looked.
     */
    __breakW116(what) {
      if (what === null || what === undefined || what === false) {
        engine._w116Break = null;
        if (engine.combat && engine.combat.d) engine.combat.d.__w116_oversprint = false;
        return { broken: [] };
      }
      const list = Array.isArray(what) ? what : String(what).split(',').map((x) => x.trim()).filter(Boolean);
      // W1-16 round 3 adds three arms, one per claim the round makes:
      //   hands      — the equip ratio goes blind to the weapon and the shield again (§C).
      //   onehand    — `_finishEquipCommit` stops routing a `right`/`left` equip through
      //                `setLoadout()`, so the hand that is weighed and the hand that fights come
      //                apart again. This is the RULES #10 arm.
      //   oversprint — `OVERLOADED` stops forbidding sprint (RI-CMB01 §B).
      const known = ['producer', 'slots', 'travel', 'sprint', 'hands', 'onehand', 'oversprint'];
      for (const k of list) if (!known.includes(k)) throw new Error(`__breakW116('${k}'): unknown arm. Known: ${known.join(', ')}`);
      engine._w116Break = Object.fromEntries(list.map((k) => [k, true]));
      // The `oversprint` arm has to reach `combat/player.js`, which holds the combat DATA object
      // and the body and no reference to the engine. The data object is the one handle that
      // survives a `setLoadout()` body rebuild, which the `onehand` arm's own probe performs.
      if (engine.combat && engine.combat.d) engine.combat.d.__w116_oversprint = !!engine._w116Break.oversprint;
      return { broken: list };
    },

    /** S29 self-test: open the travel fence, so the refusal can be watched not happening. */
    __breakTravelFence() { engine.magic._fenceDisabled = true; return true; },
    /**
     * AP-M3's self-test. Removes the tracking cutoff so every projectile keeps steering for its
     * whole life — the homing orb the anti-pattern names. A probe that cannot produce the
     * failure it is looking for has not looked.
     */
    __breakTrackingCutoff() { engine.magic._cutoffDisabled = true; return true; },

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
    /**
     * GAP-W1-quest-givers-not-in-the-world. Read or set the presence term on `open()`:
     * 'on' (shipped) refuses a quest whose giver is not in the world, 'report' counts the misses
     * without refusing, 'off' does not evaluate it. Returns the mode and the misses seen so far,
     * so a probe can say WHICH quest was refused for want of a person.
     *
     * This is the perturbation handle for RI-MTH07 on this model: flip it to 'off', re-run, and
     * a build whose givers are absent starts reporting `ok` again. A term that cannot be turned
     * off cannot be shown to be doing anything.
     */
    questPresenceGate(mode) {
      const q = engine.questEngine;
      if (mode !== undefined) {
        const m = String(mode);
        if (!['on', 'report', 'off'].includes(m)) throw new Error(`questPresenceGate: '${m}' is not on|report|off`);
        q.presenceMode = m;
        q.presenceMisses = 0;
        q.presenceMissed = [];
      }
      return { mode: q.presenceMode, misses: q.presenceMisses || 0, missed: (q.presenceMissed || []).slice(0, 200) };
    },
    questNote(id, index) { return engine.questEngine.note(String(id), Number(index)); },
    questResolutions(id) { return engine.questEngine.resolutionsFor(String(id)); },
    questResolve(id, resolutionId) { return engine.questEngine.resolve(String(id), String(resolutionId)); },
    questFail(id, failureId) { return engine.questEngine.fail(String(id), String(failureId)); },
    questSetFlag(flag, v) { return engine.questEngine.setFlag(String(flag), v === undefined ? true : v); },
    /**
     * The world flags a quest's consequences actually raised, read back off the live sim rather
     * than off the quest file. There was a WRITER for these (`questSetFlag`, and every
     * `consequences.world_flags` the machine applies) and no READER anywhere in the harness, so
     * "the quest changes the world" was a claim nothing could check: a resolution whose
     * `world_flags` never reached `sim.quest.flags` would have looked identical from outside.
     * `only` filters to a prefix, because the register carries every quest in the book.
     */
    questWorldFlags(only) {
      const all = (engine.sim && engine.sim.quest && engine.sim.quest.flags) || {};
      const set = Object.keys(all).filter((k) => all[k]).sort();
      return only ? set.filter((k) => k.startsWith(String(only))) : set;
    },
    questBook() { return engine.questEngine ? engine.questEngine.book.ids.slice() : []; },
    /**
     * What a quest DECLARES about how it opens and who gives it. Read-only. A probe that has to
     * re-read `game/data/quests/**` off disk to learn a quest's `opens_by.topic` is measuring
     * the paperwork, not the build (`RI-MTH07`).
     */
    questDef(id) {
      const q = engine.questEngine.book.get(String(id));
      return {
        id: q.id, title: q.title, category: q.category,
        giver: q.giver ? { ...q.giver } : null,
        opens_by: q.opens_by ? JSON.parse(JSON.stringify(q.opens_by)) : null,
        // W1-19 round 2. The authored way there, so a probe can assert that the sentence an NPC
        // speaks IS this string rather than merely that some sentence came back. Round 1 scored
        // `q.directions` an orphan on 32/32 quests — "identical to a string that was never
        // written" — and the only way to show it is no longer one is to compare the spoken line
        // against the authored one from inside the running build.
        directions: q.directions == null ? null : String(q.directions),
        rank_gate: q.rank_gate ? { ...q.rank_gate } : null,
        mutually_exclusive_with: (q.mutually_exclusive_with || []).slice(),
      };
    },
    questEventsDrain() { return engine.questEngine ? engine.questEngine.drainEvents() : []; },
    /** What a named resolution actually requires, so a probe can satisfy it rather than guess. */
    questResolutionRequirements(questId, resolutionId) {
      const q = engine.questEngine.book.get(String(questId));
      const r = (q.resolutions || []).find((x) => x.id === String(resolutionId));
      if (!r) throw new Error(`questResolutionRequirements: ${questId} has no resolution '${resolutionId}'`);
      return { ...(r.requires || {}), requires_knowing: r.requires_knowing || [], method: r.method, journal_index: r.journal_index, violence_required: !!r.violence_required };
    },
    /**
     * W1-FACTIONS round 2, `path_to_ten` #3. WHAT AN ENDING CHANGES.
     *
     * `questDef()` carried neither `resolutions` nor `consequences`, so a probe inside the
     * running build could see which endings were *available* and nothing about what any of them
     * *did*. The round-1 walk therefore chose the cheapest ending at every rank — always the
     * refusal, because a refusal asks for nothing — and then poked the rank-7 world flag in by
     * hand to get past the gate it had just declined to open. "Rank 7 reached" and "walked
     * without killing" were each true and had never been true together.
     *
     * With this a chooser can ask the question the player asks — *which of these ends with the
     * first chair empty?* — from inside the engine, off the shipped data, with no disk read.
     * Quest-level consequences are merged in exactly as `QuestMachine.resolve()` merges them
     * (`mergeConsequences`), so what is reported here is what would actually be applied.
     */
    questResolutionConsequences(questId, resolutionId) {
      const q = engine.questEngine.book.get(String(questId));
      const base = q.consequences || {};
      if (resolutionId == null) return JSON.parse(JSON.stringify(base));
      const r = (q.resolutions || []).find((x) => x.id === String(resolutionId));
      if (!r) throw new Error(`questResolutionConsequences: ${questId} has no resolution '${resolutionId}'`);
      const merged = mergeConsequences({
        faction_reputation: { ...(base.faction_reputation || {}) },
        npc_disposition: { ...(base.npc_disposition || {}) },
        unlocks: [...(base.unlocks || [])], locks: [...(base.locks || [])],
        world_flags: [...(base.world_flags || [])], kills_npc: [...(base.kills_npc || [])],
        joins_faction: [...(base.joins_faction || [])],
      }, r.consequences || null);
      return { resolution: r.id, method: r.method, violence_required: !!r.violence_required, ...merged };
    },
    /** Every ending of a quest with both halves — what it costs and what it changes. */
    questEndings(questId) {
      const q = engine.questEngine.book.get(String(questId));
      return (q.resolutions || []).map((r) => ({
        ...H.questResolutionRequirements(q.id, r.id),
        ...H.questResolutionConsequences(q.id, r.id),
        id: r.id, exclusive_with: (r.exclusive_with || []).slice(),
      }));
    },
    /**
     * W1-19. READ and WRITE the disposition register the quest gates read.
     *
     * `sim.quest.dispositions` is now seeded at boot and on every reset from the `disposition`
     * field on every NPC record in `game/data/npcs/**` (`Engine.seedDispositions()`), which is
     * what makes `giver.disposition_min` reachable at all. This pair exists so that a critic can
     * (a) see the seeded table and (b) break it on purpose — a probe that cannot make the gate
     * go red is not measuring the gate.
     */
    getDispositions() { return { ...engine.sim.quest.dispositions }; },
    /**
     * W1-07 round 4. The register is what is WRITTEN DOWN; this is what the gate actually
     * reads — the register with the RI-CHR02 race and upbringing terms and RI-DLG04 §B's
     * movable terms on it. `getDispositions()` and this method returning different numbers for
     * the same person is the whole of the fix, and a probe should be able to see both.
     */
    getGateDispositions() { return engine.questEngine ? engine.questEngine.dispositionView() : {}; },
    /** The same number with every term named, so a critic never has to infer one. */
    explainDisposition(npcId) {
      if (!engine.questEngine) return { _declared_incomplete: 'no quest runtime' };
      return engine.questEngine.explainDisposition(String(npcId));
    },
    setDisposition(npcId, v) {
      engine.sim.quest.dispositions[String(npcId)] = Math.max(0, Math.min(100, Number(v)));
      return engine.sim.quest.dispositions[String(npcId)];
    },

    /**
     * READ and WRITE faction standing. The write half exists for the same reason
     * `setDisposition` does: `race-reactions.json` §repair_paths names the RI-DLG04 §B faction
     * term as the ONE thing that pays off a -40 race row, and a probe that cannot move it
     * cannot show that the race handicap has a route through it rather than being a wall.
     * Reputation is what the quest consequences write; rank is DERIVED from it by
     * `FactionGates.highestQualifying()` in `QuestEngine.context()`, so setting reputation here
     * drives the same ladder play drives.
     */
    getFactionStanding() { return JSON.parse(JSON.stringify(engine.sim.quest.factions)); },
    /**
     * W1-FACTIONS. The rank ladders, the DECLARED exclusivity, and the exclusions that are
     * biting RIGHT NOW — the derived rank the ladder gives this character in every faction, and
     * which factions that closes.
     *
     * It exists because `FactionGates.closedBy()` had no caller anywhere in `game/src/` and
     * `rivalry_locked` was initialised on every standing row and never written: the whole
     * mutual-exclusion model was unreadable from the running world, which is `RI-MTH07` /
     * ARBITRATION §3's "a correct, instrumented model that nothing in the running world reads".
     * `QuestEngine.context()` is now that reader; this is how a probe sees what it decided.
     */
    factionGates() {
      if (!engine.factionGates) return { _declared_incomplete: 'no faction gates' };
      const g = engine.factionGates;
      const ctx = engine.questEngine ? engine.questEngine.context() : null;
      return {
        factions: g.ids().map((id) => {
          const f = g.get(id);
          return {
            id, name: f.name,
            favoured_attributes: f.favoured_attributes.slice(),
            favoured_skills: f.favoured_skills.slice(),
            ranks: f.ranks.map((r) => ({ ...r })),
            closes: g.closedBy(id),
            derived_rank: ctx ? (ctx.ranks[id] || 0) : null,
            reputation: ctx ? (ctx.reputation[id] || 0) : 0,
            // The whole four-part statement for the NEXT rank, with this character's own
            // numbers in it, so a UI never has to invent a requirement or a shortfall.
            next_rank_terms: ctx ? g.evaluate(id, Math.min(7, (ctx.ranks[id] || 0) + 1), ctx) : null,
          };
        }),
        declared_exclusivity: JSON.parse(JSON.stringify(g.exclusivity)),
        rivalry_locked_now: ctx ? [...(ctx.rivalry_locked || [])].sort() : [],
        quests_locked_by_rivalry: ctx ? [...ctx.lockedReason.entries()].map(([quest, why]) => ({ quest, why })) : [],
      };
    },
    setFactionStanding(id, patch) {
      const f = String(id);
      const q = engine.sim.quest;
      if (!q.factions[f]) q.factions[f] = { member: false, rank: 0, reputation: 0, expelled: false, rivalry_locked: [] };
      Object.assign(q.factions[f], patch || {});
      return JSON.parse(JSON.stringify(q.factions[f]));
    },

    /**
     * READ what the character has been told. `learnTopic` below is a poke; this is the only way to
     * see what the WORLD has seeded — a `hooks.json` `adds_topics` edge firing off a world flag is
     * how a `discovery: "consequence"` quest becomes reachable, and with no reader a probe could
     * not tell that edge from its own poke.
     */
    questTopicsKnown() { return engine.sim.quest.topicsKnown.slice(); },
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

    // ================= W1-22 — the audio bed ==================================================
    // `audio.ambience.region`, RI-AUD03. Before this piece there was no audio code in the build
    // at all and `audioMB: 0` (see the note in `getUnimplemented()` below) was literally true —
    // thirteen regions each declared three audio strings in `regions.json` and nothing read one.
    //
    // These four surfaces exist so that ambience can be measured the way it is heard rather than
    // the way it is declared. `ambienceCapture()` is the important one: it renders the bed into
    // real PCM through the SAME graph builder the live driver uses, so a critic never has to
    // take this engine's word for whether a region makes a sound.

    /** What the world is playing right now: region, layers, denied classes, voices, emitters. */
    getAmbienceState() { return engine.getAmbienceState(); },
    /** RI-AUD02 §E audioLog rows for the ambience bus: bus, region, layer, id, pan, level_db. */
    ambienceLog(limit) { return engine.ambienceLog(limit === undefined ? undefined : Number(limit)); },
    /**
     * RI-AUD03 method step 1. Render `seconds` of a region's bed offline and hand back the
     * samples. `{region, seconds, sampleRate, tod, weather, seed, listener:[x,z,yawRad]}`.
     * Returns `{ok, samples, L, R, fired}` — L and R are plain arrays so the result survives
     * `page.evaluate()` serialisation.
     */
    ambienceCapture(opts) { return engine.ambienceCapture(opts || {}); },
    /** RI-AUD03 B6. The R7 positional emitters as seen from (x, z) facing yawDeg. Pure. */
    ambienceEmitters(x, z, yawDeg, region) {
      return engine.ambienceEmitters(Number(x), Number(z), Number(yawDeg || 0), region || null);
    },

    // ================= W1-11 — combat impact audio ============================================
    // `audio.combat.impact`, RI-AUD01 (design) and RI-AUD02 (platform). These are the exact
    // three surfaces those two items request by name in their Provenance notes, and RI-AUD01
    // is explicit about the consequence of their absence: "If `window.__HARNESS.audioLog` is
    // absent ... this item scores 0 on every check ... A build with no audio does not get a
    // pass on the grounds that audio was out of scope this wave."
    //
    // `audioCapture` is the load-bearing one, for a reason specific to this machine: it has no
    // audio device, so without an offline render there is no waveform and M2, M3 and M8 are
    // permanently unmeasurable no matter how good the design is.

    /**
     * RI-AUD01 §Provenance. The DECISION stream: one row per voice the fight asked for, each
     * carrying the SIM frame the game decided on — not a timestamp, not a render frame.
     * `{sinceFrame?, limit?}`.
     */
    audioLog(opts) { return engine.impactAudioLog(opts || {}); },

    /** RI-AUD02 §Provenance `audioStats()` — the platform contract, §A/§B/§C/§D/§E. */
    audioStats() { return engine.getImpactAudioState(); },

    /**
     * RI-AUD01 §Provenance `audioCapture`. Renders one class variant offline into real PCM.
     * `{class, sample_id?, pan?, seconds?, sampleRate?, raw?}` -> `{ok, L, R, peak_dbfs, ...}`.
     * `raw: true` bypasses the §C level, which is what the calibration solves against.
     */
    audioCapture(opts) { return engine.impactAudioCapture(opts || {}); },

    /**
     * The SABOTAGE switch, and it is in the shipped harness on purpose.
     *
     * RI-AUD01 §B names one specific way impact audio breaks — firing off the animation event
     * track instead of off hit resolution — and M7 (`fired_on_anim_start == 0`) is the detector.
     * A detector that has never been seen going red is not evidence. `setAudioTriggerSource
     * ('anim')` puts the driver into exactly the defect §B describes; `audioStats()
     * .trigger_source` reports which mode is live, so a build cannot run the defect quietly.
     * AGENT-PROTOCOL: "a probe that cannot fail is worse than no probe."
     */
    setAudioTriggerSource(mode) {
      if (mode !== 'resolution' && mode !== 'anim') {
        return { ok: false, why: `trigger_source must be 'resolution' or 'anim', got ${JSON.stringify(mode)}` };
      }
      if (!engine.impactAudio) return { ok: false, why: 'no impact audio driver' };
      engine.impactAudio.triggerSource = mode;
      return { ok: true, trigger_source: mode };
    },

    /**
     * The SECOND sabotage switch — M6's, and it exists for the same reason as the first.
     *
     * `'impact'` (shipped) positions a voice at the body the weapon met. `'attacker'` restores
     * the rule this build actually had until W1-11 measured it: a blow the player lands was
     * placed at the PLAYER'S OWN FEET, so `distance_m` was 0 and the "pan" was driven by the
     * player's own facing and by nothing else. Against a target parked dead ahead that yields
     * pan 0 and looks perfectly correct, which is how it survived — so M6's before-picture has
     * to be MEASURED, in the same run, against a target that moves.
     */
    setAudioPanSource(mode) {
      if (mode !== 'impact' && mode !== 'attacker') {
        return { ok: false, why: `pan_source must be 'impact' or 'attacker', got ${JSON.stringify(mode)}` };
      }
      if (!engine.impactAudio) return { ok: false, why: 'no impact audio driver' };
      engine.impactAudio.panSource = mode;
      return { ok: true, pan_source: mode };
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

    // ---- W1-04: towns, doors, and everybody's day -------------------------------------------
    // These delegate to the SAME engine methods that delegate to `sim/settlement.js`, which is
    // the module `sim/step.js` drives every frame. There is no second implementation. They are
    // exposed here because the engine had them and the harness did not, so a critic could not
    // reach the settlement layer at all without reading private state off `engine.sim` — and an
    // API a probe cannot reach is an API nobody can falsify.
    /** RI-WLD03: every town, its plan, its counts and how many of its buildings you can enter. */
    listSettlements() { return engine.listSettlements(); },
    /** RI-CAM05 / RI-WLD03: every named cell, with its hours and who is standing in it now. */
    listInteriors(settlement) { return engine.listInteriors(settlement); },
    /** Where the body is, in the world's own words — town, cell, hour and the door in reach. */
    whereAmI() { return engine.whereAmI(); },
    /** RI-WLD13: go through a door by name. The same call the `interact` latch makes. */
    enterInterior(id) { return engine.enterInterior(String(id)); },
    /** RI-WLD13: back out onto the doorstep you came in by. */
    exitInterior() { return engine.exitInterior(); },
    /**
     * WHAT IS ACTUALLY ON THE SCREEN, as opposed to where the world thinks you are.
     *
     * The round-1 verdict on W1-04 turned on the gap between those two, and the reason the
     * builder's own probe could not see it is that there was no harness surface that read the
     * renderer at all: every check went `HARNESS -> Engine -> sim/settlement.js` and back, and
     * all thirteen would still have passed on a build where no door had ever shown anyone a
     * room. This is that surface. `drawn_cell` is the cell the renderer has visible; `env_cell`
     * is what `cellFor(env)` says it should be; `agrees` is the whole finding in one boolean.
     * `interior` reports which record built the room and how much of it reached the scene graph.
     */
    getDrawnInterior() {
      const r = engine.renderer;
      if (!r) return { drawn_cell: null, env_cell: engine.cellFor(engine.sim.env), agrees: false, reason: 'no renderer' };
      const visible = Object.keys(r.cells).filter((k) => r.cells[k].visible);
      const env = engine.cellFor(engine.sim.env);
      return {
        drawn_cell: r.cell,
        visible_cells: visible,
        env_cell: env,
        env_interior: engine.sim.env.interior,
        agrees: r.cell === env && visible.length === 1 && visible[0] === env,
        // Which named interior the generic cell currently IS, and the record fields that reached it.
        interior_id: r.interiorId || null,
        interior: r.interiorSummary || null,
      };
    },
    /**
     * W1-04 r4 — THE SIGNATURE OF WHAT IS ACTUALLY ON THE SCREEN.
     *
     * TWO THINGS IN THIS PIECE HAVE BEEN MEASURED WITH INSTRUMENTS THAT COULD NOT SEE THE ROOM,
     * and this verb exists to replace both of them.
     *
     *  1. `getDrawnInterior().interior.meshes` is a BUILD RECORD. It is whatever
     *     `buildInterior()` returned when the room was last built; the round-3 critic emptied the
     *     room's group behind the world's back and the verb went on reporting 127 meshes of a
     *     room that was no longer there. Round 2's headline "92 distinct scene-graph signatures"
     *     was computed by hashing that block, so it is a hash of build records wearing the words
     *     "scene graph".
     *  2. Both pixel-hash acceptance criteria in this piece return the same number in the live
     *     arm and in the arm with the subject deleted — the round-3 critic measured 8 of 8
     *     distinct images in ONE UNCHANGED ROOM after two fixed steps, and 8 of 8 in an 8-town
     *     control that drew zero buildings. A pixel hash over this renderer counts the frame.
     *
     * So this walks the `Object3D` tree of the cells that are VISIBLE right now and folds a
     * sorted hash over every mesh in it: geometry type, geometry parameters, material colour and
     * the transform RELATIVE TO THE CELL ROOT. Nothing in that advances on its own — no clock,
     * no frame counter, no particle seed, no traversal order — so the same room read twice
     * returns the same string, and an emptied group returns the hash of nothing. A probe that
     * wants to know whether two rooms differ can ask this; a probe that pins its camera and
     * hashes pixels is asking the clock.
     *
     * The identical algorithm is implemented offline in `tools/world/w1-04-r4-join.mjs`, and the
     * two are compared id by id, which is how we know the room built in Node is the room the
     * player is standing in.
     */
    getDrawnSignature() {
      const r = engine.renderer;
      if (!r || !r.cells) return { cell: null, hash: null, meshes: 0, error: 'no renderer' };
      const visible = Object.keys(r.cells).filter((k) => r.cells[k].visible);
      const out = { cell: r.cell, visible_cells: visible, interior_id: r.interiorId || null, per_cell: {}, meshes: 0, triangles: 0, hash: null };
      const fold = (s) => { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h.toString(16).padStart(8, '0'); };
      const all = [];
      for (const name of visible) {
        const root = r.cells[name];
        root.updateMatrixWorld(true);
        const inv = root.matrixWorld.clone().invert();
        const keys = [];
        let tris = 0;
        root.traverse((m) => {
          if (!m.isMesh || !m.geometry) return;
          const g = m.geometry, p = g.parameters || {};
          const par = Object.keys(p).sort().map((k) => `${k}=${typeof p[k] === 'number' ? p[k].toFixed(3) : p[k]}`).join(',');
          const col = m.material && m.material.color ? m.material.color.getHexString() : '-';
          const rel = inv.clone().multiply(m.matrixWorld);
          const mx = Array.from(rel.elements).map((n) => n.toFixed(3)).join(',');
          keys.push(`${g.type || '?'}|${par}|${col}|${mx}|${(m.name || '').replace(/[0-9]+$/, '')}`);
          const gg = m.geometry;
          tris += gg.index ? gg.index.count / 3 : (gg.attributes && gg.attributes.position ? gg.attributes.position.count / 3 : 0);
        });
        keys.sort();
        out.per_cell[name] = { hash: fold(keys.join('\n')), meshes: keys.length, triangles: Math.round(tris) };
        out.meshes += keys.length;
        out.triangles += Math.round(tris);
        all.push(...keys);
      }
      all.sort();
      out.hash = fold(all.join('\n'));
      return out;
    },
    /**
     * W1-04 r3 / RI-WLD03 R5 — THE TOWN FROM THE STREET, READ OFF THE RENDERER.
     *
     * Deliberately a scene-graph TRAVERSAL and not a sum over `settlement.buildings`: the whole
     * round-1 finding is that the data was correct and nothing drew it, so a report computed
     * from the data would have passed on the build that had no buildings in it. Everything here
     * is counted by walking `renderer.province.group`.
     */
    getDrawnSettlements() {
      const pv = engine.renderer && engine.renderer.province;
      if (!pv) return { present: false, buildings: 0, settlements: [] };
      return { present: true, ...pv.drawnBuildings(), stats: pv.stats() };
    },
    /**
     * The control arm: take the town away and re-request. RULES.md #6.
     *
     * WHAT THIS USED TO BE, AND WHY IT CHANGED. Until round 4 this cut the DRAW CALL only. The
     * round-3 critic ran it and measured the consequence: doors drawing the right cell 20/20 ->
     * 0/20, buildings in the scene graph 15 -> 0, and live collision shapes **67 in both arms**.
     * `settlementSolidsNear()` builds the wall set from `settlementPlans` and not from the scene
     * graph, so cutting the draw call leaves 67 invisible solid slabs standing in the street —
     * and any measurement that reached for this switch meaning "no buildings here" was wrong
     * about half the town. The two derivations from one plan are good design; a control arm that
     * silently cuts one of them is not.
     *
     * So the default now cuts BOTH: nothing drawn and nothing solid. `{ visual_only: true }`
     * keeps the old behaviour for the arm it is actually right for — photographing a street with
     * the buildings removed — and the return value now carries `collision_shapes` in both cases,
     * so a caller can see which world it is standing in rather than assume.
     */
    __w1_04_drawBuildings(on, opts) {
      const pv = engine.renderer && engine.renderer.province;
      if (!pv) return null;
      const visualOnly = !!(opts && opts.visual_only);
      pv.drawBuildings = !!on;
      for (const [k, t] of [...pv.tiles]) pv._release(k, t);
      pv.queue.length = 0;
      pv.buildingsDrawn = 0;
      const p = engine.sim.player.pos;
      pv.request(p[0], p[2]); pv.drain();
      if (!visualOnly) {
        engine._townSolidsOff = !on;
        engine._townSolids = null;
        engine._settleSettlementSolids();
      }
      const solids = engine.settlementSolidsReport();
      return { ...pv.stats(), visual_only: visualOnly, collision_shapes: solids ? solids.shapes : null, cell_id: solids ? solids.cell_id : null };
    },
    /** Replace a settlement's plan at runtime — the RI-MTH07 perturbation handle. */
    __w1_04_perturbSettlement(doc, interiors) {
      const pv = engine.renderer && engine.renderer.province;
      if (!pv) return null;
      const docs = Object.values(engine.data.settlements || {}).map((d) => (d.id === doc.id ? doc : d));
      pv.setSettlements(docs, interiors || engine.data.interiors || {});
      const p = engine.sim.player.pos;
      pv.request(p[0], p[2]); pv.drain();
      // THE TWO LINES THAT USED TO BE HERE WERE THE ONES THAT VOIDED A 15-WALK MEASUREMENT.
      // `engine._townSolids = null; engine._townCell = null;` is the exact pattern that made
      // `__w1_04_townSolids`'s control arm inert in round 3: `_settleSettlementSolids()`'s
      // off-branch is `if (this._townCell && this.sim.cell === this._townCell)`, so a nulled
      // handle leaves the old wall set installed in `sim.cell` and both arms run the walls-on
      // arm. Here it happened not to bite, because the `{x: NaN}` sentinel forced a rebuild on
      // the next step — luck, in the same file, one verb below the fix. The method clears and
      // rebuilds its own handle; call it instead of reaching past it.
      engine._townSolids = null;
      engine._settleSettlementSolids();
      return pv.stats();
    },
    /** The plan as READ (not as drawn), so a probe can diff the two. */
    __w1_04_plan(sid) {
      const pv = engine.renderer && engine.renderer.province;
      if (!pv) return null;
      return pv.settlementPlans.find((p) => p.id === String(sid)) || null;
    },
    /** RI-WLD03 R1: what the town collision set holds, and whether you are inside a wall. */
    getSettlementSolids() { return engine.settlementSolidsReport(); },
    /**
     * The collision control arm: take the walls out and walk the same walk again.
     *
     * DO NOT null `engine._townCell` here. `_settleSettlementSolids()`'s off-branch is
     * `if (this._townCell && this.sim.cell === this._townCell) this.sim.cell = EMPTY_CELL` —
     * it needs the handle to recognise the cell it is being asked to remove. Nulling it first
     * made that branch dead code, so `sim.cell` kept the wall set and the walls were never
     * removed: the round-3 collision run returned byte-identical results on both arms and its
     * control was inert (RULES.md #6). The method clears and rebuilds the handle itself.
     */
    __w1_04_townSolids(on) {
      engine._townSolidsOff = !on;
      engine._townSolids = null;
      engine._settleSettlementSolids();
      return engine.settlementSolidsReport();
    },
    /** Which building's footprint a world point is inside, or null. */
    buildingAt(x, z, inset) {
      const pv = engine.renderer && engine.renderer.province;
      return pv ? pv.buildingAt(Number(x), Number(z), inset === undefined ? 0 : Number(inset)) : null;
    },
    /** RI-STL02 §4: is the cell this zone is a room of open at the current hour? */
    isOpenNow(zoneOrInterior) { return engine.isOpenNow(String(zoneOrInterior)); },
    /** RI-WLD08: everybody's day, off the LIVE npc list — `at`, `present`, and the slot count. */
    whereIsEveryone() { return engine.whereIsEveryone(); },
    /** RI-STL02 §1: which owners of this zone are standing in it right now. */
    residentsPresent(zoneId) { return engine.settlements.residentsPresent(engine.sim, String(zoneId)); },
    /** Spawn everyone whose record belongs to this town. Idempotent. */
    populateSettlement(sid) { return engine.populateSettlement(String(sid)); },
    /** Spawn everyone posted at a named site that is not a town (the hollow above the sap-line). */
    populateSite(id) { return engine.populateSite(String(id)); },
    /**
     * GAP-W1-quest-givers-not-in-the-world. Go to where this quest's giver lives — the same call
     * walking across the town boundary makes, and the honest replacement for
     * `mainline-chain-floor.mjs`'s `H.spawnNPC({ from_record: giver, pos: [0,0,2] })`, which
     * conjured the person out of nothing so that a gate with no presence term could be satisfied.
     *
     * It goes RED where the old call could not: a giver whose record names no town and no site
     * is not spawned, `present` comes back false, and the run stops instead of quietly
     * continuing against a body the probe made up.
     */
    travelToGiver(questId) {
      const def = engine.questBook.get(String(questId));
      const giver = (def && def.giver && def.giver.npc_id) || null;
      if (!giver) return { quest: String(questId), giver: null, present: false, why: 'quest names no giver' };
      const rec = engine._anyNpcRecord(giver);
      if (!rec) return { quest: String(questId), giver, present: false, why: 'no NPC record' };
      const where = rec.settlement || (rec.post && rec.post.site) || null;
      if (rec.settlement) engine.populateSettlement(rec.settlement);
      else if (rec.post && rec.post.site) engine.populateSite(rec.post.site);
      const present = !!engine.sim.findNPC(giver);
      return { quest: String(questId), giver, went_to: where, present, why: present ? null : `${giver} has no place in the world (settlement=${rec.settlement ?? 'null'}, site=${(rec.post && rec.post.site) ?? 'null'})` };
    },

    // ---- W1-04 PERTURBATION HANDLES ----------------------------------------------------------
    // RI-MTH07 / ARBITRATION §3 requires a model's consumer to be demonstrated by PERTURBING the
    // model and watching the world change. That is impossible through a read-only API: every
    // verb above returns a copy, and mutating a copy proves nothing. These return the LIVE
    // objects the fixed step reads, so `tools/world/w1-04-consumption.mjs` can move one field
    // and watch an entity disagree with itself on the next frame.
    //
    // They are named `__` because they are instrument surface, not game surface — nothing in the
    // game calls them and no reference item is scored through them. They are the reason the
    // consumption check cannot pass against a reimplementation.
    __w1_04_system() { return engine.settlements; },
    __w1_04_sim() { return engine.sim; },
    __w1_04_settlement(id) { return engine.settlements.get(String(id)); },
    __w1_04_interior(id) { return engine.settlements.interior(String(id)); },
    __w1_04_doors(sid) { return engine.settlements.doors.get(String(sid)) || []; },
    __w1_04_npc(eid) { return engine.sim.npcs.find((n) => n.eid === String(eid)) || null; },
    __w1_04_zone(id) { return engine._zoneById(String(id)); },
    __w1_04_content(instance) {
      for (const k of Object.keys(engine.data.property || {})) {
        for (const z of engine.data.property[k].zones) {
          const c = z.contents.find((x) => x.instance === String(instance));
          if (c) return c;
        }
      }
      return null;
    },

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
    /**
     * W1-FACTIONS r2. Run the WORLD's writer for `sim.stealth.p.standings` — the one that derives
     * the guard ladder's faction term from the quest system's own ranks — so a probe can show that
     * playing a questline moves an arrest threshold. `setFactionStandings()` above is a poke and
     * always was; this is the thing a player does. `_afterStep()` calls the same method, so a
     * probe that steps a frame gets it for free; this exists so a probe that steps NO frames can
     * still ask for it explicitly rather than inferring it.
     */
    syncFactionStandings() { return engine.syncFactionStandings(); },
    /**
     * RI-QST03 §D. Who has thrown you out, why, and what the way back costs — read out of the
     * live gate rather than out of the file, so a probe sees what `canOffer()` sees.
     */
    factionDiscipline() {
      const qe = engine.questEngine;
      if (!qe) return { expelled: [], declared: [] };
      qe.context();
      return {
        expelled: [...(qe.expelled || new Map()).entries()].map(([faction, e]) => ({ faction, ...e })),
        declared: ((qe.discipline && qe.discipline.factions) || []).map((r) => ({
          faction: r.faction,
          expelled_by: (r.expelled_by || []).map((c) => c.flag),
          readmission: r.readmission || null,
        })),
      };
    },
    /** Pay the way back in. Spends real gold through the same purse everything else spends. */
    factionReadmit(factionId) {
      const qe = engine.questEngine;
      if (!qe) return { ok: false, reason: 'no quest runtime' };
      return qe.readmit(String(factionId), {
        gold: engine.sim.progression.gold,
        // The purse is mirrored on the magic system (see setGold above); a readmission that
        // debited only one of the two would leave the player richer on one screen than the other.
        spend: (g) => { engine.sim.progression.gold -= g; engine.magic.gold = engine.sim.progression.gold; },
      });
    },
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
          // W1-22 narrowed this. Regional ambience (RI-AUD03, `audio.ambience.region`) is now
          // built and driven from `Engine._afterStep()`; see `getAmbienceState()` and
          // `ambienceCapture()`. What remains genuinely unimplemented is listed below, and the
          // list is deliberately specific — "audio" as one undifferentiated absence is how the
          // one part of it that now exists would go on being scored 0 for another three rounds.
          // W1-11 narrowed this. Combat impact audio (RI-AUD01 §A's twelve resolution classes,
          // RI-AUD02's scheduling and voice budget) is now built, driven from the fight's own
          // `emit` funnel, and renderable to PCM — see `audioLog()`, `audioStats()` and
          // `audioCapture()` above. What remains genuinely absent is listed here, and it is
          // deliberately specific, because "audio" as one undifferentiated absence is how the
          // build previously reported having none while having some.
          { what: 'combat FOLEY (footsteps, cloth, armour rattle)', owner: 'RI-AUD01 §D / no wave-1 owner', surfaced_as: 'the §D sparseness budget counts non-combat voices and there are none, so the exploration mix is silence rather than a bed at -26..-22 LUFS-S. §D is a budget approached only from below and RI-AUD01 says so' },
          { what: 'music (audio.music.policy)', owner: 'RI-AUD04 / no wave-1 owner', surfaced_as: 'no music bus, no music. RI-AUD04 unmeasurable, 0 fail-closed' },
          { what: 'voice (audio.voice.policy)', owner: 'RI-AUD05 / no wave-1 owner', surfaced_as: 'no voice bus. RI-AUD05 unmeasurable, 0 fail-closed' },
          // ROUND 2 — this entry used to read "interior ambience beds (RI-AUD03 R4): outstanding,
          // interiors are SILENT". They are not silent any more: seven beds exist in
          // `game/data/audio/ambience/interiors/` and `Engine._stepAmbience()` looks one up by
          // cell. What is left is a count, and it is a WORLD gap rather than an audio one.
          { what: 'settlement ambience beds (RI-WLD08 §6 wants >=8)', owner: 'W1-22 / W1-01..W1-05', surfaced_as: 'two settlement beds exist (market, street) because Engine.cellFor() returns exactly two settlement cells in this build. Eight would mean authoring beds for six settlements the world does not have; ambience-census C14 warns rather than fails, so the gap is charged where it lives' },
          { what: 'positional ambient emitters per km2 (RI-WLD08 §6 wants >=25)', owner: 'W1-22, outstanding', surfaced_as: 'four R7 emitters in the province (bell buoy, hide-drum, legion horn, kiln). They now SOUND — round 1 computed their pan and gain every frame and scheduled no audio at all — but four is not twenty-five per km2, and the shortfall is data authoring rather than a missing mechanism' },
          { what: 'boss-arena ambience (cell `arena`)', owner: 'W1-22 / RI-AUD01', surfaced_as: 'getAmbienceState().suppressed names the cell. Deliberate: an arena\'s sound belongs to the combat mix, and RI-AUD03 is a REGIONAL identity item. Reported rather than filled with a bed nobody specified' },
          { what: 'heap/GC access (A-JRN9), dialogue state (A-JRN13), resource registry (A-JRN14). A-JRN2 (gamepad) and A-JRN4 (viewport/orientation/safe-area) landed with W1-08/W1-29; A-JRN12 (keyboard layout) is driven runner-side through CDP by tools/journey/journey-run.mjs', owner: 'runner-side or later pieces', surfaced_as: 'the methods are absent rather than present-and-lying' },
          { what: 'Tier-H performance numbers (fps, frame time, TTFP wall clock, hitch durations)', owner: 'attested real hardware', surfaced_as: 'getPerfStats()._unmeasurable / getLoadState()._unmeasurable. RI-PLT01 rule T1 forbids emitting these from a SwiftShader run at all' },
        ],
        harness_amendments_implemented: ['A-JRN1 (partial: play-instrumented mode, no UI-text stream)', 'A-JRN3', 'A-JRN5 (partial: Tier-S fields only)', 'A-JRN6', 'A-JRN7', 'A-JRN8', 'A-JRN10', 'A-JRN11', 'A-JRN15 (partial)', 'A-JRN2 (gamepad, W1-29)', 'A-JRN4 (viewport/orientation/safe-area, W1-29)', 'A-JRN12 (runner-side via CDP Input.dispatchKeyEvent, W1-08)'],
        harness_amendments_absent: ['A-JRN9', 'A-JRN13', 'A-JRN14'],
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
