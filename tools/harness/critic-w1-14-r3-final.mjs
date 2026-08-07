#!/usr/bin/env node
// critic-w1-14-r3-final.mjs — W1-14 round-3 CRITIC, four things that must not be guessed.
//
//  A. LEVITATION ALTITUDE. The regression pass read `pos[1]` gain 0.000 m for 36 Focus spent.
//     Round 2 measured 5.5867 m at 1.5 Focus/m and passed the item on it. One of the two is
//     wrong, so this reads altitude from three surfaces at once, every 30 frames.
//  B. S29's 300-FRAME HOSTILE COOLDOWN. The regression pass teleported 84.9 m 110 frames after
//     a hostile hit. S29 requires refusal for 300 frames after the last hostile action.
//  C. RI-MAG04 M6 — a magic quest resolution played through. `hooks.json` maps `lock:*:open`,
//     `shatter:*`, `trap:*:disarmed` and `fight_ended:*` onto a quest journal index; that is the
//     consumer, and `questResolutionRequirements()` was the wrong place to look for it.
//  D. ENEMY CASTERS (RI-MAG01 §F). Every shipped archetype, 900 frames aggroed, counting casts.
import path from 'node:path';
import { parseArgs, wantsHelp, usage, log, writeJson, ensureDir } from '../lib/cli.mjs';
import { launchGame } from '../lib/browser.mjs';

const USAGE = 'critic-w1-14-r3-final.mjs — levitation, the S29 cooldown, a played-through magic quest, enemy casters';
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
    const mage = (state) => {
      H.setSeed(4242); H.loadState(state || 'arena_flat'); H.setRenderRate(0);
      H.resetMagicWorld(); H.resetSapTaint(); H.setCharacter(CH);
      for (let i = 0; i < 700; i++) { for (const sk of ['sorcery', 'root-speech', 'warding', 'veiling']) H.grantSkillUse('cast_effective', { cost: 40, spell_skill: sk }); H.hearthRest(); }
      H.setWillpower(99); H.setCatalyst('great_staff'); H.setGold(5000000);
      for (const s of D.spells.spells) H.learnSpell(s.id);
      H.hearthRest(); H.magicEventsDrain();
    };
    const make = (spec, n) => { const m = H.makeSpell(spec, n); if (m.refused) return null; if (!H.setAttuned([m.spell.id]).length) return null; return m.spell; };

    // ---- A. LEVITATION -------------------------------------------------------------------
    {
      const run = (how) => {
        mage(); H.teleport(0, 0); H.stepFrames(4);
        let sid = null;
        if (how === 'spell') {
          const s = make({ class: 'LIGHT', range: 'self', effects: [{ effect: 'levitate', magnitude: 30, duration_s: 40, area_r_m: 0 }] }, 'lev');
          if (!s) return { how, refused: true };
          H.queueInputs([{ f: 2, press: ['light'] }, { f: 4, release: ['light'] }]);
          H.stepFrames(60);
        } else H.setLevitating(true);
        const series = [];
        for (let i = 0; i < 10; i++) {
          H.queueInputs([{ f: 1, press: ['jump'] }]);
          H.stepFrames(30);
          const ps = H.getPlayerStats(); const fs = H.getFallState(); const ms = H.getMagicState();
          series.push({ f: (i + 1) * 30, player_pos_y: +ps.pos[1].toFixed(3), fall_pos_y: fs.pos_y_m,
            levitating: fs.levitating, altitude: ms.altitude_m === undefined ? ms.altitude : ms.altitude_m,
            focus: ms.focus });
        }
        return { how, series, y_gain_m: +(series[series.length - 1].player_pos_y - series[0].player_pos_y).toFixed(3),
          focus_spent: +(series[0].focus - series[series.length - 1].focus).toFixed(2) };
      };
      out.levitation = [run('harness'), run('spell')];
    }

    // ---- B. S29's 300-frame hostile cooldown ----------------------------------------------
    {
      const trial = (waitFrames) => {
        mage(); H.setTravelMark([60, 0, 60]); H.teleport(0, 0);
        const s = make({ class: 'LIGHT', range: 'self', effects: [{ effect: 'recall', magnitude: 40, duration_s: 0, area_r_m: 0 }] }, 'c' + waitFrames);
        if (!s) return { waitFrames, refused: 'commission' };
        H.stepFrames(400);                       // settle: no hostile action for a long while
        H.damagePlayer(10, { stagger: false });  // THE hostile action
        const hitAt = H.getFrame();
        H.stepFrames(waitFrames);
        const p0 = H.getPlayerStats().pos.slice();
        const pr = H.pressCast(220);
        const p1 = H.getPlayerStats().pos.slice();
        return { frames_since_hostile_action_at_press: waitFrames,
          moved_m: +Math.hypot(p1[0] - p0[0], p1[2] - p0[2]).toFixed(2),
          refused: pr.travel_refused.length > 0, drops: pr.drops.map((d) => d.reason) };
      };
      out.s29_cooldown = [0, 30, 60, 120, 240, 299, 360, 600].map(trial);
    }

    // ---- C. RI-MAG04 M6 — a magic quest played through ------------------------------------
    {
      mage(); H.teleport(0, 6); H.stepFrames(4);
      const offers = (H.questOffers() || []).map((q) => q.id || q);
      const target = 'Q-MAG-01';
      let opened = null;
      try { opened = H.questOpen(target); } catch (e) { opened = { err: String(e.message).slice(0, 120) }; }
      const before = H.questBook && H.getQuestState();
      const j0 = (before.journal || []).length;
      const st0 = (() => { try { return H.questResolutions(target); } catch (e) { return null; } })();
      const mk = H.makeSpell({ class: 'LIGHT', range: 'touch', effects: [{ effect: 'open_lock', magnitude: 100, duration_s: 0, area_r_m: 0 }] }, 'q_open');
      let cast = null;
      if (!mk.refused && H.setAttuned([mk.spell.id]).length) {
        H.questEventsDrain();
        H.queueInputs([{ f: 2, press: ['light'] }, { f: 4, release: ['light'] }]);
        H.stepFrames(180);
        cast = { magic: [...new Set(H.magicEventsDrain().map((x) => x.kind))], quest: H.questEventsDrain() };
      }
      const after = H.getQuestState();
      out.mag04_m6 = { offers_count: offers.length, offers_sample: offers.slice(0, 8), target, opened,
        journal_before: j0, journal_after: (after.journal || []).length,
        journal_tail: (after.journal || []).slice(-3),
        flags_after: Object.keys(after.flags || {}).filter((k) => after.flags[k]).slice(0, 12),
        resolutions_before: st0, cast };
    }

    // ---- D. ENEMY CASTERS (RI-MAG01 §F) ---------------------------------------------------
    {
      const ARCH = ['cst_sap_speaker', 'champion_hist_marked', 'drowned_greater', 'drowned_lesser',
        'guard_legion', 'beast_slitherfang', 'cam_boss_great', 'cam_boss_mid', 'cam_elite', 'inf_trash'];
      out.enemy_casters = [];
      for (const a of ARCH) {
        mage(); H.teleport(0, 0);
        let e = null;
        try { e = H.spawn(a, 0, 9, { as: 'x' }); } catch (err) { out.enemy_casters.push({ archetype: a, err: String(err.message).slice(0, 60) }); continue; }
        H.aggro(e);
        H.magicEventsDrain();
        const states = new Set(); const hp0 = H.getPlayerStats().hp;
        for (let f = 0; f < 900; f++) { H.stepFrames(1);
          const en = H.getCombatState().enemies.find((x) => x.id === 'x');
          if (en) states.add(en.state); }
        const ev = H.magicEventsDrain();
        out.enemy_casters.push({ archetype: a, states: [...states],
          magic_events: [...new Set(ev.map((x) => x.kind))],
          casts: ev.filter((x) => x.kind === 'cast_start').length,
          player_hp_lost: +(hp0 - H.getPlayerStats().hp).toFixed(1) });
      }
    }
    return out;
  });
} finally { await handle.close(); }

writeJson(path.join(outDir, 'final.json'), report);
log('levitation: ' + JSON.stringify(report.levitation, null, 1).slice(0, 2500));
log('s29 cooldown: ' + JSON.stringify(report.s29_cooldown));
log('RI-MAG04 M6: ' + JSON.stringify(report.mag04_m6, null, 1).slice(0, 2000));
log('enemy casters: ' + JSON.stringify(report.enemy_casters, null, 1).slice(0, 2000));
console.log(path.join(outDir, 'final.json'));
