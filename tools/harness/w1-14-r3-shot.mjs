#!/usr/bin/env node
// w1-14-r3-shot.mjs — one picture of the thing this round fixed.
//
// Two beasts, one spell each, one frame. The left one was hit with Stillness (`calm_beast`) and
// stands where it was; the right one was hit with Cold Water (`demoralise`) and is running. Until
// this round both effects set `yielded` and nothing else, so the two bodies stood in the same
// pose at the same distance and the picture would have shown one outcome twice.
//
// Steps the simulation, so it launches its own browser (rule 20).
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs, wantsHelp, usage, log, ensureDir } from '../lib/cli.mjs';
import { launchGame } from '../lib/browser.mjs';

const USAGE = 'w1-14-r3-shot.mjs — the calmed beast and the routed one, in one frame';
const args = parseArgs();
if (wantsHelp(args)) usage(USAGE);
const out = args.out ? String(args.out) : 'docs/shots/2026-08-08-w1-14-r3-stillness-stands-cold-water-runs.png';
ensureDir(path.dirname(path.resolve(out)));

const handle = await launchGame(args);
let result;
try {
  result = await handle.page.evaluate(async () => {
    const H = window.__HARNESS;
    await H.ready();
    const D = H.getMagicData();
    H.setSeed(4242);
    H.loadState('arena_flat');
    H.resetMagicWorld();
    H.setCharacter({ race: 'breton', upbringing: 'interior', class: 'sap-reader', birthsign: 'raj-xul', given_name: 'Unwritten', sex: 'unrecorded' });
    for (let i = 0; i < 700; i++) {
      for (const sk of ['sorcery', 'root-speech', 'warding', 'veiling']) H.grantSkillUse('cast_effective', { cost: 40, spell_skill: sk });
      H.hearthRest();
    }
    H.setWillpower(99);
    H.setCatalyst('great_staff');
    H.setGold(2000000);
    H.hearthRest();
    for (const s of D.spells.spells) H.learnSpell(s.id);

    const calmed = H.spawn('beast_slitherfang', -3.0, 7.0);
    const routed = H.spawn('beast_slitherfang', 3.0, 7.0);
    H.aggro(calmed); H.aggro(routed);
    H.stepFrames(20);

    const cast = (effect, magnitude, eid) => {
      const mk = H.makeSpell({ class: 'LIGHT', range: 'target', effects: [{ effect, magnitude, duration_s: 30, area_r_m: 0 }] }, `shot_${effect}`);
      H.setAttuned([mk.spell.id]);
      H.lockOn(eid);
      H.queueInputs([{ f: 2, press: ['light'] }, { f: 4, release: ['light'] }]);
      H.stepFrames(90);
      return H.magicEventsDrain().some((x) => x.kind === 'effect_apply' && x.effect === effect);
    };
    const okCalm = cast('calm_beast', 30, calmed);
    const okRout = cast('demoralise', 34, routed);
    H.lockOn(null);
    H.stepFrames(150);

    const cs = H.getCombatState().enemies;
    const pick = (id) => { const b = cs.find((e) => e.id === id); return b ? { dist_m: b.dist_m, state: b.state, anim: b.anim } : null; };
    const shot = await H.screenshot();
    return { applied: { calm_beast: okCalm, demoralise: okRout },
             calmed: pick(calmed), routed: pick(routed), png: shot };
  });
} finally {
  await handle.close();
}

const png = result.png;
fs.writeFileSync(path.resolve(out), Buffer.from(String(png).replace(/^data:image\/png;base64,/, ''), 'base64'));
log(`applied ${JSON.stringify(result.applied)}`);
log(`calmed  ${JSON.stringify(result.calmed)}`);
log(`routed  ${JSON.stringify(result.routed)}`);
console.log(path.resolve(out));
