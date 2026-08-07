#!/usr/bin/env node
/**
 * critic-w1-13-r2-d.mjs — W1-13 round-2 CRITIC probe D.
 *
 *   D1. THE PURSE ON THE SCREEN. The round-2 builder filed, without fixing, that
 *       `fenceSell()` pays into `sim.stealth.p.gold` while the save writes
 *       `sim.progression.gold`. This drives the sale through the shipping verb and then reads
 *       the number the PLAYER SEES — the `inventory.gold` element the inventory screen draws —
 *       rather than any field. A purse nobody can see is a purse that does not exist.
 *       CONTROL: `setGold(N)` is the one route that is supposed to move the player's money.
 *
 *   D2. RESPAWN DRIFT, thumb released and thumb held, at three wells. Round 1 measured
 *       5.09-22.27 m at 3 of 6 wells; round 2 measured 0.00 m at 6 of 6 and attributed round 1
 *       to the probe's own held input. Both conditions, same run, same wells.
 *       PERTURBATION: `traversal.reset()` — the line round 1 said was missing and round 2 added
 *       in `_afterRespawnPlacement()` — is stubbed out, and the drift must come back. If it does
 *       not, the 0.00 m is the measurement and not the fix.
 *
 *   D3. CONSUMPTION model 2b, re-derived by my own perturbation of the world map.
 */
import { launchGame } from '../lib/browser.mjs';
import { parseArgs, wantsHelp, usage, log, writeJson } from '../lib/cli.mjs';

const args = parseArgs(process.argv.slice(2));
if (wantsHelp(args)) { usage('critic-w1-13-r2-d.mjs [--out <file>] [--only d1,d2,d3]'); process.exit(0); }
const only = new Set(String(args.only || 'd1,d2,d3').split(',').map((s) => s.trim()));
const out = { schema: 'critic/w1-13-r2-d@1', taken_at: new Date().toISOString() };
let handle;

try {
  handle = await launchGame({ ...args, width: 320, height: 240 });
  const h = handle;
  await h.h('setRenderRate', 0);

  // ---- D1 -------------------------------------------------------------------------------
  if (only.has('d1')) {
    out.d1_purse_on_the_screen = await h.page.evaluate(() => {
      const eng = window.__ENGINE || (window.__HARNESS && window.__HARNESS._engine);
      const H = window.__HARNESS;
      // What the inventory screen DRAWS, off the element census.
      const drawn = () => {
        H.openMenu('inventory');
        const s = H.getUIState();
        const el = (s.elements || []).find((e) => e.kind === 'gold' || e.id === 'inventory.gold');
        H.closeMenu();
        return el ? { id: el.id, text: el.text } : null;
      };
      const fields = () => ({
        progression_gold: eng.sim.progression.gold,
        stealth_p_gold: eng.sim.stealth && eng.sim.stealth.p ? eng.sim.stealth.p.gold : null,
        magic_gold: eng.magic ? eng.magic.gold : null,
        combat_world_gold: eng.combat && eng.combat.world ? eng.combat.world.gold : null,
        sim_loadout_gold: eng.sim.loadout ? eng.sim.loadout.gold : 'sim.loadout is undefined',
        sim_gold: eng.sim.gold === undefined ? 'sim.gold is undefined' : eng.sim.gold,
      });

      H.loadState('settlement_primary_street'); H.setRenderRate(0); H.stepFrames(5);
      const start = { drawn: drawn(), fields: fields() };

      // CONTROL: the one verb that is supposed to give the player money.
      H.setGold(777);
      const afterSetGold = { drawn: drawn(), fields: fields() };

      // A real theft and a real fence sale, through the shipping verbs.
      const props = eng.data.property || {};
      const targets = [];
      for (const k of Object.keys(props)) {
        for (const z of props[k].zones || []) for (const c of z.contents || []) if (c.instance) targets.push(c.instance);
      }
      const fences = (eng.data.crime.fences.fences || []).map((f) => f.id);
      const sales = [];
      for (const inst of targets.slice(0, 40)) {
        let took = null, sold = null, err = null;
        try { took = eng.takeObject(inst); } catch (e) { err = 'take: ' + String(e.message || e); }
        if (took) {
          for (const fid of fences) {
            try { const r = eng.fenceSell(fid, inst); if (r && r.sold) { sold = { fence: fid, price: r.price_g, purse_after: r.gold }; break; } }
            catch (e) { err = 'sell: ' + String(e.message || e); }
          }
        }
        if (sold) sales.push({ instance: inst, ...sold });
        if (sales.length >= 4) break;
      }
      const afterFence = { drawn: drawn(), fields: fields() };

      // And across a save/load, audited on the LIVE world.
      const blob = H.saveState();
      H.loadState(blob); H.stepFrames(5);
      const afterRoundTrip = { drawn: drawn(), fields: fields() };

      return {
        start, after_setGold_777: afterSetGold, sales,
        after_fence: afterFence, after_save_load: afterRoundTrip,
        purses_that_exist: 4,
        _what_the_player_sees: 'the `inventory.gold` element text',
      };
    });
    log('D1 ' + JSON.stringify(out.d1_purse_on_the_screen.after_fence));
  }

  // ---- D2 -------------------------------------------------------------------------------
  if (only.has('d2')) {
    const rows = [];
    for (const wid of String(args.wells || 'hearth-archon,hearth-stormhold,hearth-gideon').split(',')) {
      for (const mode of ['released', 'held', 'released-no-traversal-reset', 'held-no-traversal-reset']) {
        const r = await h.page.evaluate(async ({ w, m }) => {
          const eng = window.__ENGINE || (window.__HARNESS && window.__HARNESS._engine);
          const H = window.__HARNESS;
          let restored = null;
          try {
            H.loadState('default'); H.setRenderRate(0);
            if (m.endsWith('-no-traversal-reset')) {
              // THE PERTURBATION: take away the line round 2 added. If the 0.00 m is the fix
              // and not the measurement, the drift must come back.
              const t = eng.traversal;
              restored = t.reset;
              t.reset = () => {};
            }
            const list = H.listHearths();
            const well = (list.hearths || []).find((x) => x.id === w);
            if (!well) return { well: w, mode: m, why: 'no such well' };
            H.teleport(well.pos[0] + 40, well.pos[2] + 40); H.stepFrames(20);
            H.restAt(w); H.stepFrames(2);
            H.teleport(well.pos[0] + 120, well.pos[2] + 120); H.stepFrames(20);
            if (m.startsWith('held')) H.queueInputs([{ f: 0, move: [0, 1] }]);
            H.stepFrames(10);
            H.killPlayer('combat');
            H.stepFrames(1); H.stepFrames(200);
            const p0 = eng.sim.player.pos.slice();
            H.stepFrames(220);
            const p1 = eng.sim.player.pos.slice();
            return {
              well: w, mode: m,
              at_respawn_m: +Math.hypot(p0[0] - well.pos[0], p0[2] - well.pos[2]).toFixed(2),
              after_220f_m: +Math.hypot(p1[0] - well.pos[0], p1[2] - well.pos[2]).toFixed(2),
              drift_m: +Math.hypot(p1[0] - p0[0], p1[2] - p0[2]).toFixed(2),
            };
          } catch (e) {
            return { well: w, mode: m, threw: String(e.message || e) };
          } finally {
            if (restored) eng.traversal.reset = restored;
          }
        }, { w: wid, m: mode });
        rows.push(r);
      }
    }
    out.d2_respawn_drift = rows;
    log('D2 done');
  }

  // ---- D3 -------------------------------------------------------------------------------
  if (only.has('d3')) {
    const run = async (bossId) => h.page.evaluate(async ({ b }) => {
      const eng = window.__ENGINE || (window.__HARNESS && window.__HARNESS._engine);
      const H = window.__HARNESS;
      H.loadState('arena_flat'); H.setRenderRate(0);
      const gates = (eng.hearths && eng.hearths.gates) || [];
      const before = gates.map((g) => g.boss);
      for (const g of gates) g.boss = b;
      H.spawn('inf_trash', 5, 5, { as: 'probe-trash' });
      const e0 = H.listEntities().find((e) => e.eid === 'probe-trash');
      const flags = { named: !!e0.named, boss: !!e0.boss, unique: !!e0.unique, bossOfGate: e0.bossOfGate || null, classifiedBy: e0.classifiedBy || null };
      H.killEntity('probe-trash'); H.stepFrames(2);
      const downHp = (H.listEntities().find((e) => e.eid === 'probe-trash') || {}).hp;
      H.killPlayer('combat'); H.stepFrames(1); H.stepFrames(220);
      const after = H.listEntities().find((e) => e.eid === 'probe-trash');
      for (let i = 0; i < gates.length; i++) gates[i].boss = before[i];
      return {
        gate_boss_set_to: b, gates_repointed: gates.length,
        entity_flags_after_spawn: flags,
        hp_after_kill: downHp,
        hp_after_player_death: after ? after.hp : null,
        stood_back_up: !!(after && after.hp > 0),
      };
    }, { b: bossId });
    const shipped = await run(null);
    const perturbed = await run('inf_trash');
    out.d3_consumption_2b = {
      shipped, perturbed,
      coupled: shipped.stood_back_up === true && perturbed.stood_back_up === false,
    };
    log('D3 coupled=' + out.d3_consumption_2b.coupled);
  }

  out.page_errors = handle.pageErrors ? handle.pageErrors.slice() : [];
} catch (e) {
  out.fatal = String((e && e.stack) || e);
  log('FATAL ' + out.fatal);
} finally {
  if (handle && handle.close) await handle.close();
}
writeJson(String(args.out || 'reports/runs/critic-W1-13-R2/probe-d.json'), out);
log('written');
