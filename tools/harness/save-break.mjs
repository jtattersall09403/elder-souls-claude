#!/usr/bin/env node
// save-break.mjs — THE FALSIFIER FOR THE SAVE/LOAD REPAIR.
//
// `orchestration/TOOL-LOOP.md` rule 3 and the tool critic's round-1 finding: "a self-test
// written by the same hand as the tool proves less than an independent falsification". So this
// tool does not test the fix. It BREAKS the fix, one repair at a time, in the running build,
// and asserts that the exact failure the repair was written for comes back. A repair whose
// deletion changes nothing was never a repair; a repair whose deletion produces a DIFFERENT
// failure moved the defect rather than closing it, which is the pattern four rounds of another
// piece in this project each fell into.
//
// Every break is applied to the LIVE page by monkey-patching `window.__ENGINE` and its
// modules — no file is edited, so the tool cannot leave the build broken, and a break that
// fails to take is reported as `break_did_not_apply` rather than passing quietly.
//
// THE BREAKS, each naming the repair it deletes and the failure it must resurrect:
//
//   B1  camera-settle-order     Engine.loadState() calls _settleCamera() AFTER the camera is
//                               restored instead of before  ->  pose.camera_dist_m in M2 diff
//   B2  camera-rig-writer       the save stops writing the spring-arm fields  ->  M1 mismatch
//   B3  no-remirror             the fight is not restored and mirror() is not run
//                               ->  26 player fields absent from the live sim after a load
//   B4  creation-terms          saveCreation()/loadCreation() drop powers and drawbacks
//                               ->  the Dry Well drawback and the Focus multiplier are lost
//   B5  manifest-ledger         crime.ledger goes back to one declared path  ->  M4 both ways
//   B6  no-body-grid            quantiseSaveGrid() stops gridding the combat bodies
//                               ->  M5 diverges on positions a few frames after the load
//   B7  no-rig-state            the animation rig's cross-fade state stops being carried
//                               ->  M5 diverges on weapon_tip for the cross-fade's length
//   B8  no-stamp-rebase         combat-body frame stamps are restored absolute  ->  M5
//
// Exit 0 only if EVERY break resurrects a failure. Exit 20 (MEASUREMENT_FAIL) if any break
// leaves the round trip clean — that is the tool telling you the repair it names is inert.
import path from 'node:path';
import { parseArgs, wantsHelp, usage, log, EXIT, writeJson, RUNS_DIR, ensureDir } from '../lib/cli.mjs';
import { launchGame } from '../lib/browser.mjs';

const USAGE = `
save-break.mjs — delete each save/load repair from a copy of the running build and prove the
                 original failure returns.

USAGE
  node tools/harness/save-break.mjs [--state arena_flat] [--seeds 4711,1337] [--json]

OPTIONS
  --state <id>     Named state to run each break against (default arena_flat — the EMPTY one,
                   because the regression this repairs failed there with no character, no
                   bloodstain and no hearth in it)
  --seeds <a,b>    Seeds (default 4711,1337)
  --only <ids>     Comma-separated break ids to run (default all)
  --frames <n>     Post-load window for the M5 half (default 240)
  --out <dir>      Output directory (default reports/runs/SAVE-BREAK)
  --json           Print the report
`;

const args = parseArgs();
if (wantsHelp(args)) usage(USAGE);
const STATE = String(args.state || 'arena_flat');
const SEEDS = String(args.seeds || '4711,1337').split(',').map((s) => Number(s.trim()));
const FRAMES = Number(args.frames || 240);
const ONLY = args.only ? String(args.only).split(',').map((s) => s.trim()) : null;
const outDir = args.out ? path.resolve(String(args.out)) : path.join(RUNS_DIR, 'SAVE-BREAK');
ensureDir(outDir);

const handle = await launchGame(args);
const report = {
  schema: 'elder-souls/save-break@1',
  item: 'RI-JRN05 — falsification of the wave-1 save/load repair',
  method: 'monkey-patch the running build to delete one repair, re-run the round trip, and require the named failure to return. No file is edited.',
  state: STATE, seeds: SEEDS, frames: FRAMES, breaks: [],
};

try {
  await handle.page.waitForFunction(() => !!(window.__HARNESS && window.__HARNESS.version));
  await handle.page.evaluate(() => window.__HARNESS.ready());

  const result = await handle.page.evaluate(async (o) => {
    const H = window.__HARNESS;
    const E = window.__ENGINE;
    H.setRenderRate(0);

    // A save point with REAL state in it, on a state that ships empty. Two entities, one
    // aggroed and locked on, the player mid-locomotion having swung and rolled, the camera
    // turned — so the arm, the hit dedupe, the cross-fade and the lock are all live.
    const preroll = (seed) => {
      H.setSeed(seed);
      H.loadState(o.state);
      H.teleport(0, 0);
      H.spawn('inf_trash', 0, 7, { as: 'bkA' });
      H.spawn('inf_trash', 3, 6, { as: 'bkB' });
      H.aggro('bkA'); H.lockOn('bkA');
      H.clearInputs();
      H.queueInputs([
        { f: 0, move: [0, 1], look: [4, 1] },
        { f: 20, move: [0.4, 0.6] },
        { f: 40, press: ['light'] }, { f: 43, release: ['light'] },
        { f: 70, press: ['roll'] }, { f: 73, release: ['roll'] },
        { f: 100, move: [0, 0] },
      ]);
      H.stepFrames(120);
    };
    const script = [
      { f: 0, move: [0, 1] }, { f: 60, move: [0, 0] },
      { f: 70, press: ['light'] }, { f: 73, release: ['light'] },
      { f: 150, press: ['roll'] }, { f: 153, release: ['roll'] },
    ];
    /**
     * The trace body, joined. THE RE-BASE IS THE WHOLE POINT and the first version of this
     * tool got it wrong: `loadState()` resets the frame to 0 (RI-MTH01 A07), so the control
     * run's records are stamped from the pre-roll length and the loaded run's from 0. Comparing
     * them raw makes EVERY record differ, the baseline never comes up clean, and the tool
     * reports every repair as inert — which is a falsifier that always says yes. Same rule as
     * `tools/journey/state-diff.mjs rebase()`: subtract the first record's frame, drop `t_ms`
     * (a pure function of `f`), and re-base the event and entity frame stamps with it.
     */
    const sha = (recs) => {
      if (!recs.length) return '';
      const o = recs[0].f;
      let s = '';
      for (const r of recs) {
        const c = JSON.parse(JSON.stringify(r));
        c.f -= o;
        delete c.t_ms;
        for (const e of c.events || []) if (typeof e.f === 'number') e.f -= o;
        for (const e of c.enemies || []) {
          if (typeof e.state_entered_f === 'number') e.state_entered_f = e.state_entered_f < o ? 'pre-window' : e.state_entered_f - o;
        }
        s += JSON.stringify(c) + '\n';
      }
      return s;
    };

    /** One full RI-JRN05 measurement at the current (possibly broken) build. */
    const measure = (seed) => {
      preroll(seed);
      const rt = H.saveRoundTrip();
      const man = H.getSaveManifest().computed;

      preroll(seed);
      const blob = JSON.parse(JSON.stringify(H.saveState()));
      H.clearInputs(); H.queueInputs(script);
      H.traceStart(); H.stepFrames(o.frames);
      const control = sha(H.traceStop());

      preroll(seed);
      H.loadState(JSON.parse(JSON.stringify(blob)));
      // The 26 fields: what the live simulation has that a bare makePlayer() does not.
      const live = window.__ENGINE.sim.player;
      const mirrored = ['focus', 'focusMax', 'attuned', 'focusRestoresAtHearth', 'animSlot',
        'weaponId', 'weaponClass', 'stance', 'offhandKind', 'offhandConfig', 'rollTier',
        'hitstopF', 'hitstopHeld', 'weaponTip', 'weaponGuard', 'chargeF', 'chargeMaxF',
        'chainsTo', 'blockAngleDeg', 'blockSuccessF', 'guardRaised'];
      const missing = mirrored.filter((k) => live[k] === undefined);
      H.clearInputs(); H.queueInputs(script);
      H.traceStart(); H.stepFrames(o.frames);
      const loaded = sha(H.traceStop());

      preroll(seed);
      const census = H.getDurableFieldCensus();

      return {
        m1: rt.equal,
        m2_diff: rt.diff.map((d) => d.path),
        m4_extra: man.in_save_not_on_manifest,
        m4_missing: man.on_manifest_not_in_save,
        m5_identical: control === loaded,
        mirrored_fields_absent_after_load: missing,
        census_ok: census.ok,
        census_unaccounted: census.unaccounted.map((u) => u.path).slice(0, 40),
      };
    };

    // ---- THE BREAKS ------------------------------------------------------------------------
    // Each returns an `undo`. `applied` is checked, so a break that silently fails to take
    // cannot be mistaken for a repair that is inert.
    const BREAKS = {
      // B1. The original defect, exactly: settle the camera AFTER the restore.
      'camera-settle-order': () => {
        const orig = E.loadState.bind(E);
        E.loadState = function (arg) {
          const r = orig(arg);
          if (arg && typeof arg === 'object' && arg.meta) this._settleCamera();
          return r;
        };
        return { undo: () => { E.loadState = orig; }, applied: E.loadState !== orig };
      },
      // B2. The save stops writing the spring arm. `camera_dist_m` alone is what wave 1 had.
      'camera-rig-writer': () => {
        const orig = E.saveState.bind(E);
        const KEYS = ['camera_arm_len_m', 'camera_arm_eased_m', 'camera_arm_desired_m', 'camera_arm_cast_m',
          'camera_pivot', 'camera_pos', 'camera_clear_frames', 'camera_dist_target_m'];
        E.saveState = function () {
          const b = orig();
          for (const k of KEYS) b.pose[k] = k === 'camera_pivot' || k === 'camera_pos' ? [0, 1.55, 0] : (k === 'camera_clear_frames' ? 0 : 4.1);
          return b;
        };
        return { undo: () => { E.saveState = orig; }, applied: E.saveState !== orig };
      },
      // B3. The fight is not restored and the views are not re-mirrored.
      'no-remirror': () => {
        const orig = E._restoreFightFromSave.bind(E);
        E._restoreFightFromSave = function () { return null; };
        return { undo: () => { E._restoreFightFromSave = orig; }, applied: E._restoreFightFromSave !== orig };
      },
      // B4. saveCreation/loadCreation drop the birthsign terms again.
      //
      // ROUND 1 OF THIS TOOL REPORTED THIS REPAIR INERT, AND THE TOOL WAS WRONG: the break was
      // run on `arena_flat`, which ships NO CHARACTER, so `identity.creation.created` is false
      // and `powers`/`drawbacks` are already empty — blanking two empty arrays changes nothing
      // and the build stayed clean. A break that cannot take is not evidence that a repair is
      // inert, which is why `applied` is checked separately from the failure returning. The
      // break now writes a character first, and the observable is seam S27's own field rather
      // than the round-trip diff: blanking the terms in the BLOB makes save == load == blanked,
      // so M1/M2 could never have caught it. `focusRestoresAtHearth` is what the Dry Well
      // takes away, and `save-consume.mjs C1` measures the same thing through a cast the
      // player presses for.
      'creation-terms': () => {
        const orig = E.saveState.bind(E);
        E.saveState = function () {
          const b = orig();
          b.identity.creation.powers = [];
          b.identity.creation.drawbacks = [];
          return b;
        };
        return {
          undo: () => { E.saveState = orig; },
          applied: E.saveState !== orig,
          observe: () => {
            H.setSeed(4711);
            H.loadState('default');
            H.setCharacter({ race: 'saxhleel', upbringing: 'interior', class: 'deelith', birthsign: 'nu-ixtu', given_name: 'Break' });
            const blob = JSON.parse(JSON.stringify(H.saveState()));
            H.loadState(blob);
            const p = window.__ENGINE.sim.player;
            const ch = window.__ENGINE.sim.character;
            return {
              drawbacks_after_load: (ch && ch.drawbacks ? ch.drawbacks.length : 0),
              dry_well_drawback_alive: p.focusRestoresAtHearth === false,
              focus_max_after_load: p.focusMax,
            };
          },
        };
      },
      // B5. The manifest goes back to declaring `crime.ledger` as one path.
      'manifest-ledger': () => {
        const man = E.data.saveManifest;
        const crime = man.groups.find((g) => g.group === 'Crime');
        const before = crime.paths.slice();
        crime.paths = before.filter((p) => !p.startsWith('crime.ledger.')).concat(['crime.ledger']);
        const dynBefore = man.rules.dynamic_containers.slice();
        man.rules.dynamic_containers = dynBefore.filter((p) => !p.startsWith('crime.ledger.'));
        return {
          undo: () => { crime.paths = before; man.rules.dynamic_containers = dynBefore; },
          applied: crime.paths.includes('crime.ledger'),
        };
      },
      // B6. The combat bodies leave the 6-dp save grid.
      'no-body-grid': () => {
        const sim = E.sim;
        const orig = Object.getPrototypeOf(sim).constructor;
        // The grid runs from sim/step.js against sim._combat.bodies. Hiding the handle for the
        // duration of the break is the smallest deletion that removes exactly that loop.
        const bodies = sim._combat;
        let hidden = null;
        const patch = () => {
          hidden = sim._combat;
          Object.defineProperty(sim, '_combat', {
            configurable: true,
            get() { return hidden; },
            set(v) { hidden = v; },
          });
        };
        // Nudge every body OFF the 6-dp save grid after the grid has run, which is exactly the
        // state the world was in before `quantiseSaveGrid()` learned about the bodies.
        //
        // ROUND 1 USED 1e-9 AND THE BREAK DID NOT TAKE: 1e-9 is three orders of magnitude below
        // the declared grid, so `r6()` rounds it straight back and the save is lossless again.
        // 4.9e-7 is just under half a grid cell — the largest error the projection can carry
        // and the worst case the grid exists to prevent — and it accumulates, so the save point
        // is genuinely unrepresentable.
        const stepOrig = E.stepFrames.bind(E);
        E.stepFrames = function (n) {
          for (let i = 0; i < n; i++) {
            stepOrig(1);
            const bs = this.sim._combat && this.sim._combat.bodies;
            if (bs) for (const b of bs) { b.pos[0] += 4.9e-7; b.pos[2] -= 4.9e-7; }
          }
          return this.sim.frame;
        };
        void patch; void orig; void bodies;
        return { undo: () => { E.stepFrames = stepOrig; }, applied: E.stepFrames !== stepOrig };
      },
      // B7. The rig's cross-fade state stops being carried.
      'no-rig-state': () => {
        const orig = E.saveState.bind(E);
        E.saveState = function () {
          const b = orig();
          const strip = (rec) => { if (rec && rec.rig) rec.rig.has_last_pose = false; };
          if (b.fight) { strip(b.fight.player); for (const e of b.fight.enemies || []) strip(e.body); }
          return b;
        };
        return { undo: () => { E.saveState = orig; }, applied: E.saveState !== orig };
      },
      // B8. Body frame stamps are restored absolute instead of rebased.
      'no-stamp-rebase': () => {
        const orig = E.saveState.bind(E);
        E.saveState = function () {
          const b = orig();
          const f = this.sim.frame;
          // ROUND 1 GUARDED ON `rec[k] > 0` AND THE BREAK DID NOT TAKE: after a pre-roll that
          // ends standing still, every one of these stamps has already expired and is stored as
          // its <= 0 sentinel, so there was nothing to bump. Written unconditionally now — a
          // stamp restored in the SAVE's frame numbering instead of the loaded one is exactly
          // the defect, and `f + 120` is a regen block that outlives the whole window.
          const bump = (rec) => { if (rec) for (const k of ['regenBlockUntil', 'actionableAt', 'poiseRegenBlockUntil']) rec[k] = f + 120; };
          if (b.fight) { bump(b.fight.player); for (const e of b.fight.enemies || []) bump(e.body); }
          return b;
        };
        return { undo: () => { E.saveState = orig; }, applied: E.saveState !== orig };
      },
    };

    const ids = o.only || Object.keys(BREAKS);
    const out = { baseline: {}, breaks: [] };
    for (const seed of o.seeds) out.baseline[seed] = measure(seed);

    for (const id of ids) {
      const mk = BREAKS[id];
      if (!mk) { out.breaks.push({ id, error: 'no such break' }); continue; }
      const h = mk();
      const per = {};
      let err = null;
      let observedBroken = null, observedFixed = null;
      try {
        for (const seed of o.seeds) per[seed] = measure(seed);
        // Some repairs are invisible to the round-trip diff BY CONSTRUCTION: blanking a field
        // in the blob makes the save and the reload agree about the blank. Those breaks carry
        // their own observer, and the observer is what the verdict reads.
        if (h.observe) observedBroken = h.observe();
      } catch (e) { err = String(e && e.message || e); }
      h.undo();
      if (h.observe) { try { observedFixed = h.observe(); } catch (e) { observedFixed = { error: String(e && e.message || e) }; } }
      // And the repair must come BACK when the break is undone — otherwise the tool has
      // damaged the session and every later break is measured against a broken build.
      const after = {};
      for (const seed of o.seeds) after[seed] = measure(seed);
      out.breaks.push({ id, applied: !!h.applied, error: err, broken: per, after_undo: after, observed_broken: observedBroken, observed_fixed: observedFixed });
    }
    return out;
  }, { state: STATE, seeds: SEEDS, frames: FRAMES, only: ONLY });

  report.baseline = result.baseline;

  const clean = (m) => m && m.m1 && m.m2_diff.length === 0 && m.m4_extra.length === 0
    && m.m4_missing.length === 0 && m.m5_identical && m.census_ok
    && m.mirrored_fields_absent_after_load.length === 0;

  const baselineClean = SEEDS.every((s) => clean(result.baseline[s]));
  report.baseline_clean = baselineClean;
  if (!baselineClean) log('BASELINE IS NOT CLEAN — every break below is measured against a build that already fails.');

  for (const b of result.breaks) {
    // A break with its own observer is judged on the observer: the two readings must differ,
    // and the FIXED reading must be the correct one. A break without one is judged on the
    // round trip, as every other break is.
    const observerUsed = !!b.observed_broken;
    const observerFired = observerUsed
      && JSON.stringify(b.observed_broken) !== JSON.stringify(b.observed_fixed);
    const failedSeeds = observerUsed
      ? (observerFired ? SEEDS.slice() : [])
      : SEEDS.filter((s) => b.error || !clean(b.broken[s]));
    const restored = observerUsed ? observerFired : SEEDS.every((s) => clean(b.after_undo[s]));
    const row = {
      id: b.id,
      break_applied: b.applied,
      threw: b.error || null,
      failure_returned_on_seeds: failedSeeds,
      failure_returned: failedSeeds.length === SEEDS.length,
      repair_restored_after_undo: restored,
      observer_used: observerUsed,
      observed_with_the_repair_deleted: b.observed_broken || null,
      observed_with_the_repair_present: b.observed_fixed || null,
      evidence: SEEDS.map((s) => ({
        seed: s,
        m1: b.broken[s] ? b.broken[s].m1 : null,
        m2_diff: b.broken[s] ? b.broken[s].m2_diff : null,
        m4_extra: b.broken[s] ? b.broken[s].m4_extra.slice(0, 6) : null,
        m4_missing: b.broken[s] ? b.broken[s].m4_missing : null,
        m5_identical: b.broken[s] ? b.broken[s].m5_identical : null,
        mirrored_absent: b.broken[s] ? b.broken[s].mirrored_fields_absent_after_load.length : null,
        census_unaccounted: b.broken[s] ? b.broken[s].census_unaccounted.slice(0, 8) : null,
      })),
      pass: b.applied && failedSeeds.length === SEEDS.length && restored,
    };
    report.breaks.push(row);
    log(`${row.pass ? 'PASS' : 'FAIL'} break ${b.id} — ${row.failure_returned ? 'the failure returned' : 'THE BUILD STAYED CLEAN (the repair this names is inert, or the break did not take)'}` +
      `${row.repair_restored_after_undo ? '' : '; AND THE REPAIR DID NOT COME BACK AFTER UNDO'}`);
  }
} finally {
  report.page_errors = handle.errors;
  await handle.close();
}

report.pass = report.baseline_clean && report.breaks.length > 0 && report.breaks.every((b) => b.pass);
writeJson(path.join(outDir, 'save-break.json'), report);
if (args.json) process.stdout.write(JSON.stringify(report, null, 2) + '\n');
else process.stdout.write(path.join(outDir, 'save-break.json') + '\n');
log(`${report.breaks.filter((b) => b.pass).length}/${report.breaks.length} repairs are falsifiable (deleting each one brings its own failure back)`);
process.exit(report.pass ? EXIT.OK : EXIT.MEASUREMENT_FAIL);
