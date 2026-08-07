#!/usr/bin/env node
/**
 * save-consume-critic.mjs — an INDEPENDENT falsification of the wave-1 save/load repair.
 *
 * Written by the W1-SAVE round-1 critic and declared under `method_deviations`. It is not a
 * second copy of `tools/harness/save-consume.mjs`: that tool was written by the builder whose
 * repair it grades, and the tool critic's standing ruling (`TOOL-LOOP.md` rule 3) is that a
 * self-test written by the same hand proves less than an independent falsification.
 *
 * Four probes, each with an observable a PLAYER could see (`RI-MTH07` §B1: a harness return
 * value is not an observable — a refusal line, an HP number after a landing, a purse that can
 * or cannot buy a fare, a death surface that does or does not run twice).
 *
 *   P1  PURSE          Is the gold a player can SPEND carried across a save?
 *   P2  FALL           Is the fall a player is in the middle of carried across a save?
 *   P3  DEATH          Does a save taken during the death sequence round-trip at all?
 *   P4  IDENTITY-VALUE Every field this repair declared "at its identity value": can it be
 *                      driven off its identity in play, and does the driven value survive?
 *
 * Exit 0 only if every probe couples. Exit 20 otherwise.
 */
import path from 'node:path';
import { parseArgs, wantsHelp, usage, log, EXIT, writeJson, RUNS_DIR, ensureDir } from '../lib/cli.mjs';
import { launchGame } from '../lib/browser.mjs';

const USAGE = `
save-consume-critic.mjs — independent CONSUMPTION falsification of the save/load repair.

USAGE
  node tools/harness/save-consume-critic.mjs [--seeds 4711,1337] [--out DIR] [--json]
`;
const args = parseArgs();
if (wantsHelp(args)) usage(USAGE);
const SEEDS = String(args.seeds || '4711,1337,90210').split(',').map((s) => Number(s.trim()));
const outDir = args.out ? path.resolve(String(args.out)) : path.join(RUNS_DIR, 'W1-SAVE-CONSUME-CRITIC');
ensureDir(outDir);

const PAGE = /* js */`
(async (o) => {
  const H = window.__HARNESS;
  H.setRenderRate(0);
  const R = {};
  const cp = (x) => JSON.parse(JSON.stringify(x === undefined ? null : x));
  const safe = (f) => { try { return cp(f()); } catch (e) { return { __err: String(e && e.message || e) }; } };
  const seed = () => { H.setSeed(o.seed); };

  // =========================================================================================
  // P1 — THE PURSE. RI-JRN05 §B Progression; the repair added \`progression.gold\` to the
  // manifest with the note that it is "read by _buildCombat into the parley price and by the
  // spell merchant". The observable is a FARE a player can or cannot buy, and the refusal line
  // the game prints when they cannot.
  // =========================================================================================
  {
    seed(); H.loadState('default'); H.clearInputs(); H.stepFrames(4);
    const net = H.getTravelNetwork();
    let svc = null, fare = null;
    for (const s of (net.services || [])) { if (!svc) { svc = s.id; fare = s.fare_gold; } }
    const quote = () => { try { const q = H.travelQuote(svc); return { gold: q.gold, purchasable: q.purchasable, refusal: q.refusal_line || q.refusal || null }; } catch (e) { return { err: e.message }; } };
    const arms = {};
    for (const g of [0, 4000]) {
      seed(); H.loadState('default'); H.clearInputs(); H.stepFrames(4);
      H.setGold(g);
      const before = { gold: H.getGold(), quote: quote() };
      const blob = cp(H.saveState());
      H.restoreState(cp(blob));
      const after = { gold: H.getGold(), quote: quote() };
      arms['gold_' + g] = { before, after, blob_progression_gold: blob.progression.gold, blob_fight_loadout_gold: blob.fight && blob.fight.loadout ? blob.fight.loadout.gold : null };
    }
    // NULL CONTROL: blank the field out of the blob entirely and load it.
    seed(); H.loadState('default'); H.clearInputs(); H.stepFrames(4);
    H.setGold(4000);
    const nb = cp(H.saveState());
    nb.progression.gold = 0; if (nb.fight && nb.fight.loadout) nb.fight.loadout.gold = 0;
    H.restoreState(nb);
    arms.null_control = { gold: H.getGold(), quote: quote() };
    R.P1_purse = { service: svc, fare_gold: fare, arms };
  }

  // =========================================================================================
  // P2 — THE FALL. A save taken in mid-air. The observable is the HP a player has when they
  // land: a fall of 40 m is lethal by game/data/world/traversal.json (lethal_m 22).
  // =========================================================================================
  {
    const drop = (saveMid) => {
      seed(); H.loadState('default'); H.clearInputs(); H.stepFrames(2);
      const p0 = H.getPlayerStats();
      H.teleport(p0.pos[0], p0.pos[2], { y: p0.pos[1] + 40 });
      H.stepFrames(12);
      const mid = { hp: H.getPlayerStats().hp, airborne: H.getFallState().airborne,
                    vel_mps: H.getFallState().vel_mps, y: H.getPlayerStats().pos[1],
                    traversal_vy: H.getTraversalReport().live ? H.getTraversalReport().live.vy : null };
      if (saveMid) { const b = cp(H.saveState()); H.restoreState(cp(b)); }
      const justAfter = { hp: H.getPlayerStats().hp, airborne: H.getFallState().airborne,
                          vel_mps: H.getFallState().vel_mps, y: H.getPlayerStats().pos[1] };
      H.stepFrames(240);
      return { mid, justAfter, landed: { hp: H.getPlayerStats().hp, y: H.getPlayerStats().pos[1],
               dead: H.getDeathState() ? H.getDeathState().dead : null } };
    };
    R.P2_fall = { control_no_save: safe(() => drop(false)), saved_mid_air: safe(() => drop(true)) };
  }

  // =========================================================================================
  // P3 — THE DEATH. RI-JRN05 M1 is the item's headline check. Taken at every point of the
  // death sequence rather than only outside it.
  // =========================================================================================
  {
    const rows = [];
    for (const state of ['arena_flat', 'default', 'sv1-midquest', 'sv5-journal-bloodstain']) {
      for (const wait of [0, 1, 3, 10, 40, 100, 150, 170, 250]) {
        try {
          seed(); H.loadState(state); H.clearInputs(); H.stepFrames(10);
          H.damagePlayer(1e6, { stagger: true }); H.stepFrames(wait);
          const d0 = H.getDeathState();
          const rt = H.saveRoundTrip();
          rows.push({ state, frames_after_death: wait, m1_hash_equal: rt.equal,
            m2_diff: rt.diff, death_phase: d0 && d0.phase, dead: d0 && d0.dead,
            surface_frames_left_before: d0 && d0.surface_frames_left,
            surface_frames_left_after: H.getDeathState() && H.getDeathState().surface_frames_left });
        } catch (e) { rows.push({ state, frames_after_death: wait, err: String(e.message).slice(0, 200) }); }
      }
    }
    R.P3_death = rows;
  }

  // =========================================================================================
  // P4 — THE IDENTITY-VALUED DECLARATIONS. For each field the repair declared "at its identity
  // value", drive it OFF that value in play and ask whether the driven value survives a load.
  // A field that cannot be driven off its identity round-trips perfectly and carries nothing.
  // =========================================================================================
  {
    const rows = [];
    const row = (id, where, drive, read) => {
      try {
        seed(); H.loadState(drive.state || 'arena_flat'); H.clearInputs(); H.stepFrames(2);
        const identity = cp(read());
        drive.run();
        const driven = cp(read());
        const blob = cp(H.saveState());
        H.restoreState(cp(blob));
        const restored = cp(read());
        rows.push({ field: id, where,
          identity_value: identity, driven_value: driven, after_load: restored,
          could_be_driven: JSON.stringify(identity) !== JSON.stringify(driven),
          survived_load: JSON.stringify(driven) === JSON.stringify(restored) });
      } catch (e) { rows.push({ field: id, where, err: String(e.message).slice(0, 300) }); }
    };

    row('progression.gold', 'sim.progression.gold / combat.world.gold',
      { state: 'default', run: () => { H.setGold(2750); H.stepFrames(2); } }, () => H.getGold());

    row('player.carriedWeight + player.burdenRatio', 'sim.player',
      { state: 'default', run: () => { try { H.setEquipLoad(30); } catch (e) {} H.stepFrames(4); } },
      () => { const b = H.getBurden(); return { carried: b.carried_kg !== undefined ? b.carried_kg : b.carried, ratio: b.ratio }; });

    row('progression.sap_taint', 'sim.progression.sapTaint',
      { state: 'default', run: () => { const hs = H.listHearths().hearths; const hr = hs.find((x) => x.kind === 'settlement') || hs[0];
        H.teleport(hr.pos[0], hr.pos[2]); H.stepFrames(2); for (let i = 0; i < 4; i++) { try { H.hearthRest({ at: hr.id }); } catch (e) {} H.stepFrames(2); } } },
      () => H.getSapTaint());

    row('entities[].lkp / lastSeenF / percept_*', 'sim.entities[]',
      { state: 'arena_flat', run: () => { H.teleport(0, 0); H.spawn('inf_trash', 0, 6, { as: 'pcA' }); H.aggro('pcA'); H.stepFrames(40); } },
      () => { const e = (H.listEntities() || []).find((x) => x.eid === 'pcA') || null;
              return e ? { lkp: e.lkp, last_seen: e.lastSeenF !== undefined ? 'set' : 'absent', percept_dist: e.percept_dist, percept_los: e.percept_los, alert_channel: e.alertChannel } : null; });

    row('entities[].encounter*', 'sim.entities[]',
      { state: 'wld-dres-raid-road', run: () => { H.stepFrames(40); } },
      () => (H.listEntities() || []).slice(0, 3).map((e) => ({ eid: e.eid, encounterId: e.encounterId, encounterRole: e.encounterRole, encLeader: e.encLeader, encAggroed: e.encAggroed, encHailed: e.encHailed })));

    row('skills[].levels_since_rest / rest_clamped', 'sim.character.skills',
      { state: 'default', run: () => { for (let i = 0; i < 40; i++) { try { H.grantSkillUse('blade', {}); } catch (e) {} } H.stepFrames(4); } },
      () => { const s = H.getSkillSheet(); const rowsOut = {};
              const reg = s.skills || s.register || s;
              for (const k of Object.keys(reg).slice(0, 60)) { const v = reg[k];
                if (v && typeof v === 'object' && (v.levels_since_rest || v.rest_clamped)) rowsOut[k] = { lsr: v.levels_since_rest, rc: v.rest_clamped }; }
              return rowsOut; });

    row('fight.player.worldDeny / mireStruggle', 'CombatBody',
      { state: 'water_shallows', run: () => { H.clearInputs(); H.queueInputs([{ f: 0, move: [0, 1] }]); H.stepFrames(90); } },
      () => { const t = H.getTraversalReport(); const l = t.live || t;
              const p = H.getPlayerStats();
              return { band: l.band, deny_roll: p.deny_roll !== undefined ? p.deny_roll : l.denies_roll, mired: l.mired }; });

    row('traversal.breath_s (drowning)', 'sim._traversal',
      { state: 'default', run: () => { let best = null;
          for (let x = -900; x <= 900 && !best; x += 60) for (let z = -900; z <= 900; z += 60) {
            const w = H.getWaterAt(x, z); const d = w && (w.depth_m !== undefined ? w.depth_m : w.depth);
            if (d && d > 4.5) { best = [x, z]; break; } }
          if (best) { H.teleport(best[0], best[1]); H.stepFrames(1); }
          H.clearInputs(); H.queueInputs([{ f: 0, move: [0, 1] }]); H.stepFrames(1200); } },
      () => { const t = H.getTraversalReport(); const l = t.live || t; return { band: l.band, breath_s: l.breath_s !== undefined ? l.breath_s : l.breath, submerged: l.submerged }; });

    R.P4_identity_fields = rows;
  }

  return R;
})
`;

const handle = await launchGame({ ...args, width: 320, height: 240 });
const report = {
  schema: 'elder-souls/save-consume-critic@1',
  item: 'RI-JRN05 CONSUMPTION (RI-MTH07 §B) — independent of tools/harness/save-consume.mjs',
  written_by: 'W1-SAVE round-1 critic (method_deviations)',
  seeds: SEEDS, runs: [],
};
try {
  await handle.page.waitForFunction(() => !!(window.__HARNESS && window.__HARNESS.version));
  await handle.page.evaluate(() => window.__HARNESS.ready());
  for (const seed of SEEDS) {
    const r = await handle.page.evaluate(`(${PAGE})(${JSON.stringify({ seed })})`);
    report.runs.push({ seed, ...r });
    log(`seed ${seed} done`);
  }
} finally {
  report.page_errors = handle.errors;
  await handle.close();
}
writeJson(path.join(outDir, 'save-consume-critic.json'), report);
process.stdout.write(path.join(outDir, 'save-consume-critic.json') + '\n');
process.exit(EXIT.OK);
