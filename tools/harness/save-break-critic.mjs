#!/usr/bin/env node
/**
 * save-break-critic.mjs — breaks the wave-1 save/load repair that its OWN falsifier does not.
 *
 * Written by the W1-SAVE round-1 critic; declared under `method_deviations`.
 * `tools/harness/save-break.mjs` deletes eight repairs. This deletes four it does not, and it
 * asks a different question about each: not only "does the failure come back", but
 *
 *      WHICH OF THE BUILD'S OWN SHIPPED INSTRUMENTS NOTICES?
 *
 * because a repair that no shipped instrument can see the deletion of is a repair nobody can
 * regress-test, and a manifest row whose deletion changes nothing is accommodation rather than
 * agreement (`RI-JRN05` "How we lose" #7 and #8).
 *
 * For every break it re-runs, on the same save point:
 *   M1/M2  `__HARNESS.saveRoundTrip()`      — the blob fixed point
 *   M4     `__HARNESS.getSaveManifest()`    — the set difference, both ways
 *   census `__HARNESS.getDurableFieldCensus()` — the live-object differential
 *   world   a direct read of the live subsystem through a public getter
 *
 * Exit 0 only if every break is detected by at least one SHIPPED instrument.
 */
import path from 'node:path';
import { parseArgs, wantsHelp, usage, log, EXIT, writeJson, RUNS_DIR, ensureDir } from '../lib/cli.mjs';
import { launchGame } from '../lib/browser.mjs';

const USAGE = `
save-break-critic.mjs — four breaks the builder's own falsifier does not contain.

USAGE
  node tools/harness/save-break-critic.mjs [--seed 4711] [--out DIR] [--json]
`;
const args = parseArgs();
if (wantsHelp(args)) usage(USAGE);
const SEED = Number(args.seed || 4711);
const outDir = args.out ? path.resolve(String(args.out)) : path.join(RUNS_DIR, 'W1-SAVE-BREAK-CRITIC');
ensureDir(outDir);

const PAGE = /* js */`
(async (o) => {
  const H = window.__HARNESS, E = window.__ENGINE;
  H.setRenderRate(0);
  const cp = (x) => JSON.parse(JSON.stringify(x === undefined ? null : x));

  // ---- SAVE POINTS. Each break is measured where the field it deletes is NON-TRIVIAL. -----
  const POINTS = {
    drowning: () => {
      H.setSeed(o.seed); H.loadState('default'); H.clearInputs(); H.stepFrames(2);
      let best = null;
      for (let x = -900; x <= 900 && !best; x += 60) for (let z = -900; z <= 900; z += 60) {
        const w = H.getWaterAt(x, z); const d = w && (w.depth_m !== undefined ? w.depth_m : w.depth);
        if (d && d > 4.5) { best = [x, z]; break; }
      }
      if (best) { H.teleport(best[0], best[1]); H.stepFrames(1); }
      H.clearInputs(); H.queueInputs([{ f: 0, move: [0, 1] }]); H.stepFrames(1500);
      return { where: best };
    },
    raid: () => {
      H.setSeed(o.seed); H.loadState('wld-dres-raid-road'); H.clearInputs(); H.stepFrames(90);
      return { where: 'wld-dres-raid-road' };
    },
    purse: () => {
      H.setSeed(o.seed); H.loadState('stormhold-street'); H.clearInputs(); H.stepFrames(8);
      return { where: 'stormhold-street' };
    },
  };

  const liveRead = {
    drowning: () => { const t = H.getTraversalReport(); const l = t.observed || t.live || t;
      return { band: l.band, breath_s: l.breath_s, submerged: l.submerged, mire: l.mire, denies: l.denies,
               depth_m: l.depth_m, vertical_mps: l.vertical_mps }; },
    raid: () => cp((E.sim.entities || []).map((e) => ({ eid: e.eid, encounterId: e.encounterId,
      encounterRole: e.encounterRole, encLeader: e.encLeader, encAggroed: e.encAggroed,
      encHailed: e.encHailed, lkp: e.lkp, lastSeenF: e.lastSeenF }))),
    purse: () => ({ gold_getGold: H.getGold(), gold_travel: (() => { try { return H.getTravelState().gold; } catch (e) { return null; } })(),
                    gold_world: (() => { try { return H.getWorldKnowledge ? H.getWorldKnowledge().gold : (H.getCombatState().world_knowledge || {}).gold; } catch (e) { return null; } })() }),
  };

  // Measure the round trip WITH whatever break is installed on E.saveState.
  const measure = (point) => {
    POINTS[point]();
    const before = cp(liveRead[point]());
    const rt = H.saveRoundTrip();                       // this SAVES and LOADS
    const after = cp(liveRead[point]());
    POINTS[point]();
    const man = H.getSaveManifest().computed;
    POINTS[point]();
    const census = H.getDurableFieldCensus();
    return {
      m1_equal: rt.equal, m2_diff: rt.diff.map((d) => d.path),
      m4_extra: man.in_save_not_on_manifest, m4_missing: man.on_manifest_not_in_save,
      census_ok: census.ok, census_unaccounted: (census.unaccounted || []).map((u) => u.path).slice(0, 30),
      world_before: before, world_after: after,
      world_changed: JSON.stringify(before) !== JSON.stringify(after),
    };
  };

  const BREAKS = {
    // BX1. The Traversal group is the repair's biggest single manifest addition (20 paths).
    // Delete its RESTORE and ask which shipped instrument notices. Nothing in the census walks
    // sim._traversal, so the only candidate is M1 via the re-serialised blob.
    'no-traversal-restore': () => {
      const orig = E.saveState.bind(E);
      E.saveState = function () { const b = orig(); b.traversal = null; return b; };
      return { undo: () => { E.saveState = orig; }, applied: E.saveState !== orig, point: 'drowning' };
    },
    // BX2. The one-shot encounter latch the repair says it added because "a restored encounter
    // hailed you twice".
    'no-encounter-latches': () => {
      const orig = E.saveState.bind(E);
      E.saveState = function () { const b = orig();
        for (const e of (b.world.entities || [])) { e.encounter_hailed = false; e.encounter_aggroed = false; e.encounter_leader = false; }
        return b; };
      return { undo: () => { E.saveState = orig; }, applied: E.saveState !== orig, point: 'raid' };
    },
    // BX3. The purse. progression.gold was added to the manifest by this repair.
    'no-gold': () => {
      const orig = E.saveState.bind(E);
      E.saveState = function () { const b = orig(); b.progression.gold = 0;
        if (b.fight && b.fight.loadout) b.fight.loadout.gold = 0; return b; };
      return { undo: () => { E.saveState = orig; }, applied: E.saveState !== orig, point: 'purse' };
    },
    // BX4. Entity last-known-position — the field the whole search behaviour is driven from.
    'no-lkp': () => {
      const orig = E.saveState.bind(E);
      E.saveState = function () { const b = orig();
        for (const e of (b.world.entities || [])) { e.lkp = null; e.last_seen_ago_frames = -1; }
        return b; };
      return { undo: () => { E.saveState = orig; }, applied: E.saveState !== orig, point: 'raid' };
    },
  };

  const out = { baseline: {}, breaks: [] };
  for (const p of Object.keys(POINTS)) out.baseline[p] = measure(p);

  for (const id of Object.keys(BREAKS)) {
    const b = BREAKS[id]();
    let broken = null, err = null;
    try { broken = measure(b.point); } catch (e) { err = String(e.message).slice(0, 300); }
    b.undo();
    let restored = null;
    try { restored = measure(b.point); } catch (e) { err = (err || '') + ' | undo:' + String(e.message).slice(0, 200); }
    const base = out.baseline[b.point];
    const detected = {
      m1: broken && base ? (base.m1_equal === true && broken.m1_equal === false) : null,
      m4: broken && base ? (JSON.stringify(base.m4_extra) !== JSON.stringify(broken.m4_extra)
        || JSON.stringify(base.m4_missing) !== JSON.stringify(broken.m4_missing)) : null,
      census: broken && base ? (base.census_ok === true && broken.census_ok === false) : null,
      live_world: broken ? broken.world_changed === true : null,
    };
    out.breaks.push({ id, point: b.point, applied: b.applied, err,
      baseline: base, broken, restored, detected,
      detected_by_any_shipped_instrument: !!(detected.m1 || detected.m4 || detected.census),
      undo_restored_baseline: restored && base ? JSON.stringify(restored) === JSON.stringify(base) : null });
  }
  return out;
})
`;

const handle = await launchGame({ ...args, width: 320, height: 240 });
const report = { schema: 'elder-souls/save-break-critic@1', seed: SEED,
  written_by: 'W1-SAVE round-1 critic (method_deviations)' };
try {
  await handle.page.waitForFunction(() => !!(window.__HARNESS && window.__HARNESS.version));
  await handle.page.evaluate(() => window.__HARNESS.ready());
  Object.assign(report, await handle.page.evaluate(`(${PAGE})(${JSON.stringify({ seed: SEED })})`));
} finally {
  report.page_errors = handle.errors;
  await handle.close();
}
for (const b of report.breaks || []) {
  log(`${b.detected_by_any_shipped_instrument ? 'SEEN' : 'BLIND'} ${b.id} @${b.point} — applied ${b.applied}, M1 ${b.detected.m1}, M4 ${b.detected.m4}, census ${b.detected.census}, live world changed ${b.detected.live_world}`);
}
writeJson(path.join(outDir, 'save-break-critic.json'), report);
process.stdout.write(path.join(outDir, 'save-break-critic.json') + '\n');
process.exit((report.breaks || []).every((b) => b.detected_by_any_shipped_instrument) ? EXIT.OK : EXIT.MEASUREMENT_FAIL);
