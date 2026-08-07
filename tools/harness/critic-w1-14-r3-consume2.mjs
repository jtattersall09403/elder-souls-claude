#!/usr/bin/env node
// critic-w1-14-r3-consume2.mjs — W1-14 round-3 CRITIC, second pass.
//
// The first consumption pass failed to make CONTACT for five of the verbs, and a probe that
// cannot deliver the effect measures its own arena — which is the whole charge against round 3's
// first census, so it is not a mistake this critic gets to keep. This pass fixes the arena and
// re-asks, with a delivery assertion on every row: no row is reported unless `effect_apply` fired.
//
//  * telekinesis is now tested through the REAL interact press (engine.js:1500 gates on the
//    prop's own `reach_m`), not through `takeProp()`, which does not check reach at all.
//  * the lock/trap/breakable verbs are cast from inside WORLD_REACH_M (8/8/10 m) of the objects
//    game/data/magic/wards.json places, instead of from arena_flat's spawn point 10.4 m away.
//  * the control verbs are cast at a body pinned inside the 1.6 m touch reach.
//  * sap-taint is measured on BOTH its declared consumers: the NPC disposition formula and the
//    quest machine's own `_dispositionToward`.
import path from 'node:path';
import { parseArgs, wantsHelp, usage, log, writeJson, ensureDir } from '../lib/cli.mjs';
import { launchGame } from '../lib/browser.mjs';

const USAGE = 'critic-w1-14-r3-consume2.mjs — consumption, second pass, with delivery asserted';
const args = parseArgs();
if (wantsHelp(args)) usage(USAGE);
const outDir = args.out ? path.resolve(String(args.out)) : path.resolve('corpus/90-verdicts/wave1/artifacts/W1-14-r3');
ensureDir(outDir);

const handle = await launchGame(args);
let report;
try {
  report = await handle.page.evaluate(async () => {
    const H = window.__HARNESS; await H.ready(); H.setRenderRate(0);
    const D = H.getMagicData();
    const out = {};
    const CH = { race: 'breton', upbringing: 'interior', class: 'sap-reader', birthsign: 'raj-xul', given_name: 'U', sex: 'unrecorded' };
    const mage = (state, noRests) => {
      H.setSeed(4242); H.loadState(state || 'arena_flat'); H.setRenderRate(0);
      H.resetMagicWorld(); H.resetSapTaint(); H.setCharacter(CH);
      for (let i = 0; i < 700; i++) { for (const sk of ['sorcery', 'root-speech', 'warding', 'veiling']) H.grantSkillUse('cast_effective', { cost: 40, spell_skill: sk }); if (!noRests) H.hearthRest(); }
      H.setWillpower(99); H.setCatalyst('great_staff'); H.setGold(5000000);
      for (const s of D.spells.spells) H.learnSpell(s.id);
      H.hearthRest(); H.resetSapTaint(); H.magicEventsDrain();
    };
    const cast = (effect, magnitude, range, dur, frames) => {
      const mk = H.makeSpell({ class: 'LIGHT', range, effects: [{ effect, magnitude, duration_s: dur || 0, area_r_m: 0 }] }, 'c2_' + effect);
      if (mk.refused) return { refused: mk.gate || mk.reason };
      if (!H.setAttuned([mk.spell.id]).length) return { refused: 'attune' };
      H.magicEventsDrain();
      H.queueInputs([{ f: 2, press: ['light'] }, { f: 4, release: ['light'] }]);
      H.stepFrames(frames || 140);
      const ev = H.magicEventsDrain();
      return { delivered: ev.some((x) => x.kind === 'effect_apply' && (x.effect === undefined || x.effect === effect)),
        kinds: [...new Set(ev.map((x) => x.kind))],
        refusals: ev.filter((x) => /refus/i.test(String(x.kind))).map((x) => ({ k: x.kind, r: x.reason || x.needs_magnitude })) };
    };

    // ---- 1. TELEKINESIS through the REAL interact press ---------------------------------
    {
      const trial = (withSpell) => {
        mage('arena_flat'); H.teleport(0, 0);
        H.clearProps();
        H.spawnProp({ eid: 'tk', name: 'brass censer', pos: [0, 0, 5.0], reach_m: 2.2, takeable: true, item: 'brass_censer' });
        H.stepFrames(4);
        let c = null;
        if (withSpell) { c = cast('telekinesis', 25, 'self', 20, 100); }
        const prompt = (() => { try { return H.getUIState().interact_prompt || H.getUIState().prompt || null; } catch (e) { return null; } })();
        const reach = H.listEntities().find((e) => e.eid === 'tk');
        H.queueInputs([{ f: 2, press: ['interact'] }, { f: 4, release: ['interact'] }]);
        H.stepFrames(30);
        const after = H.listEntities().find((e) => e.eid === 'tk');
        return { with_spell: withSpell, cast: c, prop_reach_m: reach && reach.reach_m, prompt,
          taken_by_interact: after ? !!after.taken : null, inventory: H.getInventory().length };
      };
      out.telekinesis_via_interact = { without: trial(false), with: trial(true) };
    }

    // ---- 2. LOCK / TRAP / BREAKABLE / KEY, cast from inside WORLD_REACH -------------------
    {
      const W = H.getMagicWorld();
      out.ward_world_shape = JSON.stringify(W).slice(0, 600);
      const trial = (eff, mag, at) => {
        mage('arena_flat'); H.teleport(at[0], at[1]);
        H.stepFrames(4);
        const w0 = H.getWorldRegisters(); const q0 = Object.keys(H.getQuestState().flags || {}).filter((k) => H.getQuestState().flags[k]);
        const c = cast(eff, mag, 'touch', 0, 140);
        const w1 = H.getWorldRegisters(); const qs = H.getQuestState();
        return { effect: eff, cast_from: at, cast: c,
          doors_unlocked: w1.doors_unlocked, shortcuts_opened: w1.shortcuts_opened,
          quest_flags_added: Object.keys(qs.flags || {}).filter((k) => qs.flags[k] && !q0.includes(k)),
          magic_world: (() => { const m = H.getMagicWorld();
            return { locks_unlocked: (m.locks && m.locks.unlocked) || [], traps_disarmed: (m.traps && m.traps.disarmed) || [],
                     breakables_broken: (m.breakables && m.breakables.broken) || [], markers: (m.markers || []).length }; })() };
      };
      out.world_verbs = [
        trial('open_lock', 100, [0, 6]),
        trial('lock_lock', 100, [0, 6]),
        trial('ward_trap', 100, [0, 6]),
        trial('shatter', 120, [-2, 5]),
        trial('detect_key', 60, [0, 0]),
      ];
      // does anything OUTSIDE magic read doors_unlocked / shortcuts_opened?
      out.register_consumers_note = 'grep game/src: doorsUnlocked and shortcutsOpened are written only by sim/magic/apply.js and read only by harness/api.js and save/state.js';
    }

    // ---- 3. CONTROL VERBS with a body pinned inside touch reach ---------------------------
    {
      const trial = (eff) => {
        mage('arena_flat'); H.teleport(0, 0);
        const e = H.spawn('beast_slitherfang', 0, 1.2, { as: 'cb' });
        H.aggro(e); H.stepFrames(20);
        H.setEntityPos('cb', 0, 1.2);
        const b0 = H.getCombatState().enemies.find((x) => x.id === 'cb');
        const p0 = b0 && b0.pos ? b0.pos.slice() : null;
        const c = eff ? cast(eff, 30, 'touch', 30, 120) : (H.stepFrames(120), { control: true, delivered: null });
        const seq = [];
        for (let i = 0; i < 12; i++) { H.stepFrames(50);
          const b = H.getCombatState().enemies.find((x) => x.id === 'cb');
          const s = H.getStatusState().find((x) => x.id === 'cb');
          seq.push({ f: (i + 1) * 50, state: b && b.state, pos: b && b.pos ? b.pos.map((v) => +v.toFixed(2)) : null, yielded: s && s.yielded }); }
        const b1 = H.getCombatState().enemies.find((x) => x.id === 'cb');
        const p1 = b1 && b1.pos ? b1.pos.slice() : null;
        return { effect: eff || 'control', cast: c,
          moved_m: p0 && p1 ? +Math.hypot(p1[0] - p0[0], p1[2] - p0[2]).toFixed(2) : null,
          final_dist_from_player_m: p1 ? +Math.hypot(p1[0], p1[2]).toFixed(2) : null,
          in_combat: H.getPlayerStats().in_combat, seq: seq.slice(-4),
          yielded: (H.getStatusState().find((x) => x.id === 'cb') || {}).yielded };
      };
      out.control_verbs = [trial(null), trial('calm_beast'), trial('demoralise'), trial('frenzy'), trial('charm'), trial('paralyse')];
    }

    // ---- 4. SAP TAINT, both declared consumers -------------------------------------------
    {
      const readAll = () => {
        const npcs = H.listNPCs() || [];
        return npcs.map((n) => { const id = n.eid || n.id;
          let d = null; try { d = H.npcDisposition(id); } catch (e) { d = { err: String(e.message).slice(0, 60) }; }
          return { id, disposition: d && d.disposition, terms: d && d.term }; });
      };
      mage('helstrom-market');
      H.resetSapTaint();
      const band0 = H.getSapTaint(); const d0 = readAll();
      for (let i = 0; i < 20; i++) H.hearthRest();
      const band1 = H.getSapTaint(); const d1 = readAll();
      // the quest machine's own disposition path
      const qOffers = H.questOffers() || [];
      const gates = [];
      for (const q of qOffers.slice(0, 12)) {
        const id = q.id || q;
        try { for (const r of (H.questResolutions(id) || [])) {
          const req = H.questResolutionRequirements(id, r.id || r);
          if (req && JSON.stringify(req).match(/disposition/i)) gates.push({ quest: id, res: r.id || r, req });
        } } catch (e) { /* not offered */ }
      }
      out.sap_taint = { band_after_reset: band0, band_after_20_rests: band1,
        disposition_at_band_0: d0, disposition_at_band_n: d1,
        npc_disposition_moved: JSON.stringify(d0) !== JSON.stringify(d1),
        quest_resolution_disposition_gates_found: gates.slice(0, 6),
        note: 'dialogue/disposition.js reads player.sapTaintBand; grep shows nothing in game/src writes that field.' };
    }
    return out;
  });
} finally { await handle.close(); }

writeJson(path.join(outDir, 'consume2.json'), report);
for (const k of Object.keys(report)) log(`== ${k}\n${JSON.stringify(report[k], null, 1).slice(0, 3000)}`);
console.log(path.join(outDir, 'consume2.json'));
