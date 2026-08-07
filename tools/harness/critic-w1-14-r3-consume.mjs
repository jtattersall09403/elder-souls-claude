#!/usr/bin/env node
// critic-w1-14-r3-consume.mjs — W1-14 round-3 CRITIC.
//
// ARBITRATION §3 CONSUMPTION, applied to the nine effects the builder diagnosed as "arena holes,
// not handler holes", and to the registers round 3 says it rehomed. The bar is not "a register
// moved" — §3 requires the model be PERTURBED and an ENTITY be watched changing behaviour. A
// durable world register that no system in the world reads is the round-2 orphan with a longer
// name.
//
// Each block below is a pair: perturb, then ask a system that is not the magic module what it
// now does. Where the answer is "nothing", the register is named and the grep that proves it is
// in the verdict.
import path from 'node:path';
import { parseArgs, wantsHelp, usage, log, writeJson, ensureDir } from '../lib/cli.mjs';
import { launchGame } from '../lib/browser.mjs';

const USAGE = 'critic-w1-14-r3-consume.mjs — do the nine "arena hole" effects change anything in a populated world?';
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
    const out = { blocks: {} };
    const CH = { race: 'breton', upbringing: 'interior', class: 'sap-reader', birthsign: 'raj-xul', given_name: 'U', sex: 'unrecorded' };

    /** A caster who can cast anything, in a named shipped state. Skill is granted here ON PURPOSE
     *  and declared: this block is about the CONSUMER, not about the gate, and the ladder probe
     *  measures the gate separately. */
    const mage = (state) => {
      H.setSeed(77); H.loadState(state); H.setRenderRate(0);
      H.resetMagicWorld(); H.resetSapTaint();
      H.setCharacter(CH);
      for (let i = 0; i < 700; i++) { for (const sk of ['sorcery', 'root-speech', 'warding', 'veiling']) H.grantSkillUse('cast_effective', { cost: 40, spell_skill: sk }); H.hearthRest(); }
      H.setWillpower(99); H.setCatalyst('great_staff'); H.setGold(5000000);
      for (const s of D.spells.spells) H.learnSpell(s.id);
      H.hearthRest(); H.magicEventsDrain();
    };
    const cast = (effect, magnitude, range, dur, frames) => {
      const spec = { class: 'LIGHT', range, effects: [{ effect, magnitude, duration_s: dur || 0, area_r_m: 0 }] };
      const mk = H.makeSpell(spec, 'c_' + effect);
      if (mk.refused) return { refused: mk.gate || mk.reason };
      const att = H.setAttuned([mk.spell.id]);
      if (!att.length) return { refused: 'attune' };
      H.magicEventsDrain();
      H.queueInputs([{ f: 2, press: ['light'] }, { f: 4, release: ['light'] }]);
      H.stepFrames(frames || 120);
      const ev = H.magicEventsDrain();
      return { applied: ev.filter((x) => x.kind === 'effect_apply').length, kinds: [...new Set(ev.map((x) => x.kind))] };
    };

    // =====================================================================================
    // 1. TELEKINESIS — the verb is REACH. Perturb it and ask the INTERACTION, not the register.
    // =====================================================================================
    {
      mage('arena_flat');
      H.clearProps();
      H.spawnProp({ eid: 'tk_far', name: 'brass censer', pos: [0, 0, 5.0], reach_m: 2.2 });
      H.stepFrames(4);
      const before = (() => { try { return H.takeProp('tk_far'); } catch (e) { return { threw: String(e.message).slice(0, 90) }; } })();
      const takenBefore = H.listEntities().filter((e) => e.eid === 'tk_far').map((e) => ({ taken: e.taken, reach_m: e.reach_m }))[0];
      // re-place it if the first take succeeded, so the second read is honest
      mage('arena_flat'); H.clearProps();
      H.spawnProp({ eid: 'tk_far', name: 'brass censer', pos: [0, 0, 5.0], reach_m: 2.2 });
      H.stepFrames(4);
      const c = cast('telekinesis', 25, 'self', 20, 120);
      const propAfterCast = H.listEntities().filter((e) => e.eid === 'tk_far').map((e) => ({ taken: e.taken, reach_m: e.reach_m }))[0];
      const after = (() => { try { return H.takeProp('tk_far'); } catch (e) { return { threw: String(e.message).slice(0, 90) }; } })();
      const takenAfter = H.listEntities().filter((e) => e.eid === 'tk_far').map((e) => ({ taken: e.taken }))[0];
      out.blocks.telekinesis = { cast: c, prop_before: takenBefore, prop_after_cast: propAfterCast,
        take_without_spell: before, taken_without_spell: takenBefore,
        take_with_spell: after, taken_with_spell: takenAfter,
        world_items_taken: H.getWorldRegisters().items_taken };
    }

    // =====================================================================================
    // 2. OPEN_LOCK / SHATTER — they write sim.world.doors_unlocked / shortcuts_opened.
    //    Ask a system that is not magic what those registers now permit.
    // =====================================================================================
    {
      mage('arena_flat');
      const wBefore = H.getWorldRegisters();
      const qBefore = H.getQuestState();
      const offersBefore = H.questOffers();
      const c1 = cast('open_lock', 100, 'touch', 0, 140);
      mage('arena_flat'); H.stepFrames(4);
      const c2 = cast('shatter', 120, 'touch', 0, 140);
      const wAfter = H.getWorldRegisters();
      const qAfter = H.getQuestState();
      // Does anything the player can DO change? Walk the quest machine for a resolution that
      // becomes reachable, and probe solidAt where the shortcut is.
      let resolutionDelta = [];
      try {
        for (const q of H.questBook().ids || []) {
          const rs = H.questResolutions(q) || [];
          for (const r of rs) {
            const req = H.questResolutionRequirements(q, r.id || r);
            const s = JSON.stringify(req);
            if (/door|shortcut|lock/i.test(s)) resolutionDelta.push({ quest: q, res: r.id || r, req });
          }
        }
      } catch (e) { resolutionDelta = [{ error: String(e.message).slice(0, 120) }]; }
      out.blocks.open_lock_shatter = {
        open_lock: c1, shatter: c2,
        doors_unlocked_before: wBefore.doors_unlocked, doors_unlocked_after: wAfter.doors_unlocked,
        shortcuts_before: wBefore.shortcuts_opened, shortcuts_after: wAfter.shortcuts_opened,
        quest_flags_before: Object.keys(qBefore.flags || {}).filter((k) => qBefore.flags[k]),
        quest_flags_after: Object.keys(qAfter.flags || {}).filter((k) => qAfter.flags[k]),
        quest_offers_before: (offersBefore || []).length, quest_offers_after: (H.questOffers() || []).length,
        resolutions_naming_a_door_or_shortcut: resolutionDelta.slice(0, 12),
        solid_at_breakable: { before: null, after: H.solidAt(-2.4, 1, 6.4) },
      };
    }

    // =====================================================================================
    // 3. DETECT_LIFE / DETECT_KEY — RI-MAG06 §B: positions appear AND the HUD count stays 0.
    //    Ask whether anything outside magic can see the marker.
    // =====================================================================================
    {
      mage('arena_flat');
      H.spawn('inf_trash', 6, 12);
      H.stepFrames(4);
      const uiBefore = H.getUIState();
      const c = cast('detect_life', 60, 'self', 20, 120);
      const uiAfter = H.getUIState();
      out.blocks.detect_life = {
        cast: c,
        markers_in_magic_register: (H.getMagicWorld().markers || []).length,
        ui_markers_before: uiBefore.markers === undefined ? (uiBefore.hud && uiBefore.hud.markers) : uiBefore.markers,
        ui_markers_after: uiAfter.markers === undefined ? (uiAfter.hud && uiAfter.hud.markers) : uiAfter.markers,
        ui_state_diff: JSON.stringify(uiBefore) === JSON.stringify(uiAfter) ? 'IDENTICAL' : 'differs',
        world_registers_diff: 'see census',
      };
    }

    // =====================================================================================
    // 4. FRENZY — "it fights the nearest OTHER body instead of you". Watch the bodies.
    // =====================================================================================
    {
      mage('arena_flat');
      const a = H.spawn('inf_trash', 0, 2.0, { as: 'fa' });
      const b = H.spawn('inf_trash', 1.6, 2.4, { as: 'fb' });
      H.aggro(a); H.aggro(b);
      H.stepFrames(30);
      const hp0 = H.getCombatState().enemies.map((e) => ({ id: e.id, hp: e.hp, state: e.state }));
      const c = cast('frenzy', 34, 'touch', 30, 60);
      const st1 = H.getStatusState().map((x) => ({ id: x.id, frenzy_target: x.frenzy_target }));
      H.stepFrames(900);
      const hp1 = H.getCombatState().enemies.map((e) => ({ id: e.id, hp: e.hp, state: e.state }));
      // CONTROL: the same 900 frames with no frenzy cast
      mage('arena_flat');
      const a2 = H.spawn('inf_trash', 0, 2.0, { as: 'fa' });
      const b2 = H.spawn('inf_trash', 1.6, 2.4, { as: 'fb' });
      H.aggro(a2); H.aggro(b2);
      H.stepFrames(30 + 60 + 900);
      const hpC = H.getCombatState().enemies.map((e) => ({ id: e.id, hp: e.hp, state: e.state }));
      out.blocks.frenzy = { cast: c, before: hp0, status_after_cast: st1,
        after_900f_treatment: hp1, after_900f_control: hpC,
        enemy_hp_changed_vs_control: JSON.stringify(hp1.map((x) => x.hp)) !== JSON.stringify(hpC.map((x) => x.hp)) };
    }

    // =====================================================================================
    // 5. CALM_BEAST vs DEMORALISE — both set `yielded`. Does the fight end? Does either MOVE?
    // =====================================================================================
    {
      const run = (eff) => {
        mage('arena_flat');
        const e = H.spawn('beast_slitherfang', 0, 3.0, { as: 'cb' });
        H.aggro(e); H.stepFrames(60);
        const p0 = H.getCombatState().enemies.map((x) => ({ id: x.id, pos: x.pos, state: x.state, hp: x.hp }));
        const hpP0 = H.getPlayerStats().hp;
        const c = eff ? cast(eff, 30, 'touch', 30, 90) : (H.stepFrames(90), { control: true });
        H.stepFrames(600);
        const p1 = H.getCombatState().enemies.map((x) => ({ id: x.id, pos: x.pos, state: x.state, hp: x.hp }));
        const s = H.getStatusState().filter((x) => x.id !== 'player').map((x) => ({ id: x.id, yielded: x.yielded }));
        const g0 = p0[0] && p0[0].pos, g1 = p1[0] && p1[0].pos;
        const moved = g0 && g1 ? +Math.hypot(g1[0] - g0[0], g1[2] - g0[2]).toFixed(2) : null;
        const dist_from_player = g1 ? +Math.hypot(g1[0], g1[2]).toFixed(2) : null;
        return { effect: eff || 'control', cast: c, moved_m: moved, dist_from_player_m: dist_from_player, n_enemies_before: p0.length, n_enemies_after: p1.length,
          status: s, enemy_state: p1[0] && p1[0].state, player_hp_lost: +(hpP0 - H.getPlayerStats().hp).toFixed(1),
          in_combat: H.getPlayerStats().in_combat, deaths: 0 };
      };
      out.blocks.calm_vs_demoralise = { control: run(null), calm_beast: run('calm_beast'), demoralise: run('demoralise') };
    }

    // =====================================================================================
    // 6. SAP_WARD -> taint band -> DISPOSITION. In a POPULATED state, with real NPCs.
    // =====================================================================================
    {
      const readDisp = () => (H.listNPCs() || []).map((n) => ({ eid: n.eid || n.id, disp: (() => { try { return H.npcDisposition(n.eid || n.id); } catch (e) { return null; } })() }));
      mage('helstrom-market');
      const npcs = H.listNPCs() || [];
      const d0 = readDisp();
      const t0 = H.getSapTaint();
      for (let i = 0; i < 16; i++) H.hearthRest();          // climb the band by playing
      const t1 = H.getSapTaint();
      const d1 = readDisp();
      const c = cast('sap_ward', 1, 'self', 0, 90);
      const t2 = H.getSapTaint();
      const d2 = readDisp();
      out.blocks.sap_ward_disposition = { npcs: npcs.length,
        taint_start: t0, taint_after_16_rests: t1, taint_after_ward: t2,
        disposition_start: d0, disposition_at_band: d1, disposition_after_ward: d2,
        disposition_moved_with_band: JSON.stringify(d0) !== JSON.stringify(d1),
        disposition_moved_with_ward: JSON.stringify(d1) !== JSON.stringify(d2), cast: c };
    }

    // =====================================================================================
    // 7. RECALL / INTERVENTION in a populated state, and S29 re-tested from the outside.
    // =====================================================================================
    {
      mage('helstrom-market');
      H.setTravelMark([37, 0, -24]);
      H.stepFrames(330);
      const p0 = H.getPlayerStats().pos.map((v) => +v.toFixed(2));
      const c = cast('recall', 45, 'self', 0, 260);
      const p1 = H.getPlayerStats().pos.map((v) => +v.toFixed(2));
      // and mid-fight
      mage('helstrom-market'); H.setTravelMark([37, 0, -24]);
      const e = H.spawn('inf_trash', 2, 3); H.aggro(e); H.stepFrames(60);
      const q0 = H.getPlayerStats().pos.map((v) => +v.toFixed(2));
      const c2 = cast('recall', 45, 'self', 0, 260);
      const q1 = H.getPlayerStats().pos.map((v) => +v.toFixed(2));
      out.blocks.travel_populated = {
        quiet: { from: p0, to: p1, moved_m: +Math.hypot(p1[0] - p0[0], p1[2] - p0[2]).toFixed(3), cast: c },
        in_fight: { from: q0, to: q1, moved_m: +Math.hypot(q1[0] - q0[0], q1[2] - q0[2]).toFixed(3), cast: c2 },
      };
    }

    // =====================================================================================
    // 8. CHARM -> disposition (RI-MAG04 §E X6, the declared seam crossing)
    // =====================================================================================
    {
      mage('helstrom-market');
      const npcs = H.listNPCs() || [];
      const target = npcs[0];
      const before = target ? (() => { try { return H.npcDisposition(target.eid || target.id); } catch (e) { return null; } })() : null;
      const e = H.spawn('inf_trash', 0, 1.4); H.aggro(e); H.stepFrames(20);
      const c = cast('charm', 40, 'touch', 30, 120);
      const qs = H.getQuestState();
      const after = target ? (() => { try { return H.npcDisposition(target.eid || target.id); } catch (er) { return null; } })() : null;
      out.blocks.charm = { npc: target ? (target.eid || target.id) : null, disposition_before: before, disposition_after: after,
        quest_dispositions: qs.dispositions, cast: c };
    }
    return out;
  });
} finally { await handle.close(); }

writeJson(path.join(outDir, 'consume.json'), report);
for (const [k, v] of Object.entries(report.blocks)) log(`== ${k}\n${JSON.stringify(v, null, 1).slice(0, 2200)}`);
console.log(path.join(outDir, 'consume.json'));
