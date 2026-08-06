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

export const HARNESS_VERSION = 1;

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
    snapshot() { return engine.snapshot(); },
    traceStart(opts) { return engine.traceStart(opts); },
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
    setUIVisible(v) { return engine.renderer.setUIVisible(v); },

    // ---- queries ----------------------------------------------------------------------------
    listEntities() { return engine.listEntities(); },
    getPlayerStats() { return engine.getPlayerStats(); },
    getWorldStats() { return engine.getWorldStats(); },
    getQuestState() { return engine.getQuestState(); },

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
          'the 14-button closed action set, the scripted path, the real desktop path, the 8 f@60 single-slot buffer',
          'IndexedDB save with the RI-JRN05 §A write protocol, digest, A/B generations, export/import, hostility simulation',
          'deterministic sky, sun and named weather; the nine viewpoint anchors',
          'the game/data/** layout of HARNESS.md §5 with a generated index.json',
        ],
        not_implemented: [
          { what: 'enemy AI (approach, circle, commit, punish windows, leash)', owner: 'RI-AI01..07 / wave-1 piece W1-06', surfaced_as: "enemy statblocks declare ai='hold_ground'; spawn() throws for any archetype declaring behaviour this build cannot run" },
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
