#!/usr/bin/env node
// critic-w1-14-r3-s29.mjs — W1-14 round-3 CRITIC. S29's SECOND HALF, tested properly.
//
// `travelFence()` has two clauses: `inCombat()` (any living non-player body within 30 m) and
// `sim.lastHostileFrame` + 300 f. Only the first was ever demonstrated. `sim.lastHostileFrame`
// is stamped in `sim/step.js:stampHostileAction` from BUS events (HIT, PARRY, STAGGER, a swing's
// ACTION_START, spell_hit, hazard_damage) — and `H.damagePlayer()` emits none of them, so a probe
// that arms the fence with `damagePlayer()` is testing `inCombat` and calling it the cooldown.
// That is what the builder's probe did and it is what my own regression pass did.
//
// This arms the clock with a REAL swing, then removes the body so `inCombat()` is false, and casts
// Recall at 0/60/150/299/301/600 frames after the stamp.
import path from 'node:path';
import { parseArgs, wantsHelp, usage, log, writeJson, ensureDir } from '../lib/cli.mjs';
import { launchGame } from '../lib/browser.mjs';

const args = parseArgs();
if (wantsHelp(args)) usage('critic-w1-14-r3-s29.mjs — does S29\'s 300-frame hostile cooldown exist?');
const outDir = args.out ? path.resolve(String(args.out)) : path.resolve('corpus/90-verdicts/wave1/artifacts/W1-14-r3');
ensureDir(outDir);

const handle = await launchGame(args);
let report;
try {
  report = await handle.page.evaluate(async () => {
    const H = window.__HARNESS; await H.ready(); H.setRenderRate(0);
    const D = H.getMagicData();
    const CH = { race: 'breton', upbringing: 'interior', class: 'sap-reader', birthsign: 'raj-xul', given_name: 'U', sex: 'unrecorded' };
    const mage = () => {
      H.setSeed(4242); H.loadState('arena_flat'); H.setRenderRate(0);
      H.resetMagicWorld(); H.resetSapTaint(); H.setCharacter(CH);
      for (let i = 0; i < 700; i++) { for (const sk of ['sorcery', 'root-speech', 'warding', 'veiling']) H.grantSkillUse('cast_effective', { cost: 40, spell_skill: sk }); H.hearthRest(); }
      H.setWillpower(99); H.setCatalyst('great_staff'); H.setGold(5000000);
      for (const s of D.spells.spells) H.learnSpell(s.id);
      H.hearthRest(); H.magicEventsDrain();
    };
    const out = { note: 'damagePlayer() does NOT stamp sim.lastHostileFrame; only bus HOSTILE_EVENTS do.' };

    const trial = (wait, how) => {
      mage(); H.setTravelMark([60, 0, 60]); H.teleport(0, 0);
      const mk = H.makeSpell({ class: 'LIGHT', range: 'self', effects: [{ effect: 'recall', magnitude: 40, duration_s: 0, area_r_m: 0 }] }, 'r' + wait + how);
      if (mk.refused) return { wait, how, refused: 'commission' };
      H.setAttuned([mk.spell.id]);
      let stamped = null;
      if (how === 'swing') {
        // a real fight: an enemy that actually lands hits, then removed so inCombat() is false
        const e = H.spawn('inf_trash', 0, 1.6, { as: 'h' });
        H.aggro(e);
        H.traceStart({});
        H.stepFrames(400);
        H.traceStop();
        stamped = true;
        H.despawn('h');
        H.stepFrames(2);
      } else {
        H.damagePlayer(20, { stagger: true });
        stamped = 'damagePlayer';
      }
      H.stepFrames(wait);
      const p0 = H.getPlayerStats().pos.slice();
      const pr = H.pressCast(240);
      const p1 = H.getPlayerStats().pos.slice();
      return { wait, how, stamped,
        in_combat: H.getPlayerStats().in_combat,
        moved_m: +Math.hypot(p1[0] - p0[0], p1[2] - p0[2]).toFixed(2),
        refused: pr.travel_refused.map((r) => r.fence), drops: pr.drops.map((d) => d.reason + ':' + (d.fence || '')) };
    };
    out.after_a_real_swing = [0, 60, 150, 299, 301, 600].map((w) => trial(w, 'swing'));
    out.after_damagePlayer = [0, 299].map((w) => trial(w, 'damagePlayer'));
    return out;
  });
} finally { await handle.close(); }

writeJson(path.join(outDir, 's29.json'), report);
log(JSON.stringify(report, null, 1));
console.log(path.join(outDir, 's29.json'));
