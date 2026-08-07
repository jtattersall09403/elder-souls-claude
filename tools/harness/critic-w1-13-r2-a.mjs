#!/usr/bin/env node
/**
 * critic-w1-13-r2-a.mjs — W1-13 round-2 CRITIC probe A. One browser, four attacks.
 *
 * Round 2's headline is that the level-up screen now opens at a sapwell and takes your souls.
 * This probe does not re-check that it opens. It checks WHAT IS BEHIND IT, and what the money
 * does once it is in the world. Every observable is read off the LIVE world after the fact
 * (RI-MTH04 / AGENT-PROTOCOL "audit the running world after the load, not the bytes").
 *
 *   A1. THE ATTRIBUTE VOCABULARY. Enumerate the rows the level-up screen actually offers
 *       (`getUIState().model.attributes` — the drawn list) and the character's live attribute
 *       map, and diff them. Then spend on each of three rows through the REAL input path and
 *       read back the derived pools. A row that raises nothing the character carries is souls
 *       with no sink, which is the same shape as souls with no sink at all.
 *       CONTROL: `endurance` must move `stamina_max`. If it does not, the instrument is broken
 *       and nothing else in A1 is admissible.
 *
 *   A2. THE PURSE THE PLAYER SEES. Read the inventory screen's own gold row, then fence a
 *       stolen object through the shipping verb, then read it again. Also read every other
 *       purse the build carries, so the answer is "which of the N is the one on the screen".
 *
 *   A3. RESPAWN DRIFT, both ways. Round 1 measured 5-22 m; round 2 measured 0.00 m at 6/6 and
 *       attributed round 1 to the probe's own held thumb. Measure with the axis RELEASED (round
 *       2's condition) and with it HELD (round 1's), at the same wells, in the same run.
 *
 *   A4. CONSUMPTION re-derivation, by my own perturbation, of the model the round-1 verdict
 *       rejected at coupling 0: hearths.json fog_gates[].boss -> respawn.json
 *       never_respawn_entity_flags. Point a fog gate at an ordinary trash statblock and the
 *       trash must stop standing back up after a player death. Null: point it at nobody.
 */
import { launchGame } from '../lib/browser.mjs';
import { parseArgs, wantsHelp, usage, log, writeJson } from '../lib/cli.mjs';

const args = parseArgs(process.argv.slice(2));
if (wantsHelp(args)) { usage('critic-w1-13-r2-a.mjs [--out <file>] [--only a1,a2,a3,a4]'); process.exit(0); }
const only = new Set(String(args.only || 'a1,a2,a3,a4').split(',').map((s) => s.trim()));

const out = { schema: 'critic/w1-13-r2-a@1', taken_at: new Date().toISOString(), page_errors: [] };
let handle;

const ev = (h, fn, ...a) => h.page.evaluate(fn, ...a);

try {
  handle = await launchGame({ ...args, width: 320, height: 240 });
  const h = handle;
  await h.h('setRenderRate', 0);

  // ---------------------------------------------------------------------------------------
  // A1 — the attribute vocabulary behind the newly-opened door
  // ---------------------------------------------------------------------------------------
  if (only.has('a1')) {
    await h.h('loadState', 'arena_flat');
    await h.h('setRenderRate', 0);
    const rec = { spends: [] };

    // Put the body on a basin the honest way the round-2 probe does, then open the screen.
    await h.h('loadState', 'default');
    await h.h('setRenderRate', 0);
    const wells = await h.h('listHearths');
    const well = (wells.hearths || []).find((w) => w.id === 'hearth-archon') || (wells.hearths || [])[0];
    rec.well = well ? well.id : null;
    {
      const b0 = await h.h('saveState');
      b0.character.souls_held = 400000;          // enough for many levels; the purse is not under test
      await h.h('restoreState', b0);
      await h.h('stepFrames', 1);
    }
    if (well) {
      await h.h('teleport', well.pos[0], well.pos[2]);
      await h.h('stepFrames', 10);
      await h.h('restAt', well.id);
      await h.h('stepFrames', 2);
    }

    // The DRAWN row list, off the UI model — not the data file.
    const opened = await ev(h, async () => {
      try { await window.__HARNESS.openMenu('levelup'); } catch (e) { return { ok: false, threw: String(e.message || e) }; }
      const s = window.__HARNESS.getUIState();
      // Read the DRAWN ELEMENTS, not a model object: `levelup.attr.<id>` is emitted once per
      // row by game/src/ui/screens/progress.js and carries the row's own meta.
      const rows = (s.elements || []).filter((e) => e.kind === 'attribute_row')
        .map((e) => ({ id: e.meta && e.meta.attribute, text: e.text, value: e.meta && e.meta.value, focused: !!e.focused }));
      const prev = (s.elements || []).find((e) => e.kind === 'attribute_preview');
      return { ok: true, mode: s.mode, rows, preview: prev ? prev.meta : null, preview_text: prev ? prev.text : null };
    });
    rec.open = { ok: opened.ok, mode: opened.mode, threw: opened.threw || null };
    const rows = opened.rows || [];
    rec.rows_on_the_screen = rows;
    rec.preview_of_focused_row = opened.preview;

    const stats0 = await h.h('getPlayerStats');
    rec.character_attributes = stats0.attributes || null;
    const live = Object.keys(rec.character_attributes || {});
    const shown = rows.map((r) => r.id);
    rec.on_screen_but_not_on_the_character = shown.filter((k) => !live.includes(k));
    rec.on_the_character_but_not_on_screen = live.filter((k) => !shown.includes(k));

    // Spend on three rows through the real input path: the CONTROL, and two suspects.
    const spendOn = async (attrId) => {
      await ev(h, () => { try { window.__HARNESS.closeMenu(); } catch {} });
      await h.h('stepFrames', 2);
      const before = await h.h('getPlayerStats');
      const set = await ev(h, async (id) => {
        await window.__HARNESS.openMenu('levelup');
        const s = window.__HARNESS.getUIState();
        const list = (s.elements || []).filter((e) => e.kind === 'attribute_row');
        const i = list.findIndex((r) => r.meta && r.meta.attribute === id);
        if (i < 0) return { ok: false, why: `no row '${id}' on the screen`, rows: list.map((r) => r.meta && r.meta.attribute) };
        const cur = Math.max(0, list.findIndex((r) => r.focused));
        return { ok: true, from: cur, to: i, rows: list.length };
      }, attrId);
      if (!set.ok) return { attribute: attrId, refused: set.why };
      // Move the cursor with real input, one row at a time.
      let steps = set.to - set.from;
      const dir = steps >= 0 ? -1 : 1;   // list walks: stick DOWN goes to the later row
      for (let k = 0; k < Math.abs(steps); k++) {
        await h.h('queueInputs', [{ f: 0, move: [0, dir] }]);
        await h.h('stepFrames', 1);
        await h.h('queueInputs', [{ f: 0, move: [0, 0] }]);
        await h.h('stepFrames', 1);
      }
      const at = await ev(h, () => {
        const s = window.__HARNESS.getUIState();
        const list = (s.elements || []).filter((e) => e.kind === 'attribute_row');
        const f = list.find((r) => r.focused);
        const prev = (s.elements || []).find((e) => e.kind === 'attribute_preview');
        return { id: f && f.meta && f.meta.attribute, preview: prev ? prev.meta : null, preview_text: prev ? prev.text : null };
      });
      // arm, then confirm
      for (const p of ['press', 'release', 'press', 'release']) {
        await h.h('queueInputs', [{ f: 0, [p]: ['interact'] }]);
        await h.h('stepFrames', 1);
      }
      const after = await h.h('getPlayerStats');
      return {
        attribute: attrId,
        cursor_landed_on: at.id,
        preview_the_screen_showed: at.preview,
        preview_text: at.preview_text,
        level: [before.level, after.level],
        souls: [before.souls, after.souls],
        attributes_before: before.attributes, attributes_after: after.attributes,
        minted_a_new_key: Object.keys(after.attributes || {}).filter((k) => !(k in (before.attributes || {}))),
        pools_before: { hp_max: before.hp_max, stamina_max: before.stamina_max, focus_max: before.focus_max, equip_load_max: before.equip_load_max },
        pools_after: { hp_max: after.hp_max, stamina_max: after.stamina_max, focus_max: after.focus_max, equip_load_max: after.equip_load_max },
      };
    };
    for (const a of ['endurance', 'speed', 'agility']) rec.spends.push(await spendOn(a));
    // The full pool readout so a reader can see which of the ten move anything at all.
    rec.pool_response_per_row = await ev(h, (ids) => {
      const eng = window.__ENGINE || (window.__HARNESS && window.__HARNESS._engine);
      const base = eng.sim.progression.attributes;
      const snap = () => JSON.stringify(eng.attributePreview ? null : null);
      void snap;
      const res = {};
      for (const id of ids) {
        try { res[id] = (eng.attributePreview(id) || []).map((r) => (r && (r.what || r.label || r.field)) || JSON.stringify(r)); }
        catch (e) { res[id] = ['THREW: ' + String(e.message || e)]; }
      }
      void base;
      return res;
    }, rows.map((r) => r.id));
    out.a1_attribute_vocabulary = rec;
    log(`A1 done: ${rec.rows_on_the_screen.length} rows on screen, character carries ${Object.keys(rec.character_attributes || {}).length}`);
  }

  // ---------------------------------------------------------------------------------------
  // A2 — which purse is on the screen
  // ---------------------------------------------------------------------------------------
  if (only.has('a2')) {
    const rec = {};
    await h.h('loadState', 'arena_flat');
    await h.h('setRenderRate', 0);
    const purses = () => ev(h, () => {
      const eng = window.__ENGINE || (window.__HARNESS && window.__HARNESS._engine);
      const s = eng.sim;
      let screen = null;
      try {
        window.__HARNESS.openMenu('inventory');
        const st = window.__HARNESS.getUIState();
        screen = (st.model && st.model.gold);
        const txt = (st.text || []).filter((t) => /gold/i.test(String(t)));
        window.__HARNESS.closeMenu();
        return {
          screen_model_gold: screen,
          screen_text_rows_mentioning_gold: txt,
          progression_gold: s.progression && s.progression.gold,
          stealth_p_gold: s.stealth && s.stealth.p && s.stealth.p.gold,
          magic_gold: eng.magic && eng.magic.gold,
          combat_world_gold: eng.combat && eng.combat.world && eng.combat.world.gold,
          sim_loadout: s.loadout === undefined ? 'undefined' : JSON.stringify(s.loadout),
          sim_gold: s.gold === undefined ? 'undefined' : s.gold,
        };
      } catch (e) { return { threw: String(e.message || e) }; }
    });
    rec.before_any_money = await purses();

    // Put money in every purse we can reach through a shipping/harness route, then look again.
    await h.h('setGold', 500).catch(() => {});
    rec.after_setGold_500 = await purses();

    // Now a REAL fence sale through the shipping verb, in a settlement that has one.
    rec.fence = await ev(h, async () => {
      const eng = window.__ENGINE || (window.__HARNESS && window.__HARNESS._engine);
      const H = window.__HARNESS;
      try {
        H.loadState('settlement_primary_street');
        H.setRenderRate(0);
        H.stepFrames(5);
      } catch (e) { return { threw_load: String(e.message || e) }; }
      // find something stealable and a fence
      const props = eng.data.property || {};
      let target = null;
      for (const k of Object.keys(props)) {
        for (const z of props[k].zones || []) {
          for (const c of z.contents || []) { if (!target && c.instance) target = { zone: z.id, key: k, ...c }; }
        }
      }
      if (!target) return { why: 'no property instance in the shipped data' };
      let took = null, sold = null, err = null;
      try { took = H.takeObject ? H.takeObject(target.instance) : eng.takeObject(target.instance); } catch (e) { err = 'take: ' + String(e.message || e); }
      const fences = (eng.data.fences && (eng.data.fences.fences || eng.data.fences)) || [];
      const fid = Array.isArray(fences) && fences.length ? (fences[0].id || fences[0]) : 'fence-lilmoth';
      try { sold = eng.fenceSell(fid, target.instance); } catch (e) { err = (err ? err + ' | ' : '') + 'sell: ' + String(e.message || e); }
      const s = eng.sim;
      return {
        target: target.instance, fence: fid, took: took ? true : false, sold: sold || null, err,
        progression_gold: s.progression.gold,
        stealth_p_gold: s.stealth && s.stealth.p && s.stealth.p.gold,
        magic_gold: eng.magic && eng.magic.gold,
      };
    });
    rec.after_fence = await purses();

    // The live-world audit across a save/load: is the fence money there when you come back?
    rec.round_trip = await ev(h, async () => {
      const eng = window.__ENGINE || (window.__HARNESS && window.__HARNESS._engine);
      const H = window.__HARNESS;
      const blob = H.saveState();
      const inBlob = {
        progression_gold: blob.progression && blob.progression.gold,
        any_stealth_gold: JSON.stringify(blob).match(/"gold"\s*:\s*\d+/g) || [],
      };
      H.loadState(blob);
      H.stepFrames(5);
      const s = eng.sim;
      return {
        in_blob: inBlob,
        live_after_load: {
          progression_gold: s.progression.gold,
          stealth_p_gold: s.stealth && s.stealth.p && s.stealth.p.gold,
          magic_gold: eng.magic && eng.magic.gold,
        },
      };
    });
    out.a2_purses = rec;
    log('A2 done');
  }

  // ---------------------------------------------------------------------------------------
  // A3 — respawn drift, thumb released and thumb held
  // ---------------------------------------------------------------------------------------
  if (only.has('a3')) {
    const rows = [];
    const wells = String(args.wells || 'hearth-archon,hearth-stormhold,hearth-gideon').split(',');
    for (const wid of wells) {
      for (const mode of ['released', 'held']) {
        const r = await ev(h, async ({ w, m }) => {
          const eng = window.__ENGINE || (window.__HARNESS && window.__HARNESS._engine);
          const H = window.__HARNESS;
          H.loadState('default'); H.setRenderRate(0);
          const list = H.listHearths();
          const well = (list.hearths || []).find((x) => x.id === w);
          if (!well) return { well: w, mode: m, why: 'no such well' };
          H.teleport(well.pos[0] + 40, well.pos[2] + 40);
          H.stepFrames(20);
          H.restAt(w);
          H.stepFrames(2);
          // walk away so the death is not on the basin
          H.teleport(well.pos[0] + 120, well.pos[2] + 120);
          H.stepFrames(20);
          if (m === 'held') H.queueInputs([{ f: 0, move: [0, 1] }]);
          H.stepFrames(10);
          H.killPlayer('combat');
          H.stepFrames(1);
          H.stepFrames(200);
          const p0 = eng.sim.player.pos.slice();
          const d0 = Math.hypot(p0[0] - well.pos[0], p0[2] - well.pos[2]);
          H.stepFrames(220);
          const p1 = eng.sim.player.pos.slice();
          const d1 = Math.hypot(p1[0] - well.pos[0], p1[2] - well.pos[2]);
          return {
            well: w, mode: m,
            at_respawn_m: Math.round(d0 * 100) / 100,
            after_220f_m: Math.round(d1 * 100) / 100,
            drift_m: Math.round(Math.hypot(p1[0] - p0[0], p1[2] - p0[2]) * 100) / 100,
          };
        }, { w: wid, m: mode });
        rows.push(r);
      }
    }
    out.a3_respawn_drift = rows;
    log('A3 done');
  }

  // ---------------------------------------------------------------------------------------
  // A4 — my own re-derivation of CONSUMPTION model 2b
  // ---------------------------------------------------------------------------------------
  if (only.has('a4')) {
    const run = async (gateBoss) => ev(h, async (bossId) => {
      const eng = window.__ENGINE || (window.__HARNESS && window.__HARNESS._engine);
      const H = window.__HARNESS;
      H.loadState('arena_flat'); H.setRenderRate(0);
      // Repoint the WORLD MAP's fog gate. No harness verb, no code change, no entity flag set
      // by hand: the only thing touched is the data the map publishes.
      const gates = (eng.hearths && eng.hearths.gates) || [];
      const before = gates.map((g) => ({ id: g.id, boss: g.boss }));
      for (const g of gates) g.boss = bossId;
      H.spawn('inf_trash', 5, 5, { as: 'probe-trash' });
      const e0 = H.listEntities().find((e) => e.eid === 'probe-trash');
      const flags = { named: !!e0.named, boss: !!e0.boss, unique: !!e0.unique, bossOfGate: e0.bossOfGate || null };
      H.killEntity('probe-trash');
      H.stepFrames(2);
      const downBefore = H.listEntities().find((e) => e.eid === 'probe-trash');
      H.killPlayer('combat');
      H.stepFrames(1);
      H.stepFrames(220);
      const after = H.listEntities().find((e) => e.eid === 'probe-trash');
      for (let i = 0; i < gates.length; i++) gates[i].boss = before[i].boss;
      return {
        gate_boss_set_to: bossId,
        gates_repointed: before.length,
        entity_flags_after_spawn: flags,
        hp_after_kill: downBefore ? downBefore.hp : null,
        hp_after_player_death: after ? after.hp : null,
        stood_back_up: !!(after && after.hp > 0),
      };
    }, gateBoss);
    out.a4_consumption_2b = {
      shipped: await run(null),                 // the map names nobody: trash is ordinary
      perturbed: await run('inf_trash'),        // the map calls trash a boss: it must stay down
    };
    out.a4_consumption_2b.coupled = out.a4_consumption_2b.shipped.stood_back_up === true
      && out.a4_consumption_2b.perturbed.stood_back_up === false;
    log(`A4 done: coupled=${out.a4_consumption_2b.coupled}`);
  }

  out.page_errors = handle.pageErrors ? handle.pageErrors.slice() : [];
} catch (e) {
  out.fatal = String((e && e.stack) || e);
  log('FATAL ' + out.fatal);
} finally {
  if (handle && handle.close) await handle.close();
}
writeJson(String(args.out || 'reports/runs/critic-W1-13-R2/probe-a.json'), out);
log('written');
