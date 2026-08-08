#!/usr/bin/env node
// w1-14-r5-shot.mjs — one picture of the thing this round fixed.
//
// A body walking sideways at 14 m, and the bolt that used to go behind it. Round 4's verdict
// measured 0 damage from all five damage effects against exactly this target, deterministically,
// while the same body standing still took 48 and the same body retreating ten metres took 48.
// The frame chosen is the one where the bolt and the body are about to arrive at the same place,
// which is the frame the old build never had.
//
// Steps the simulation, so it launches its own browser (RULES.md #20).
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs, wantsHelp, usage, log, ensureDir } from '../lib/cli.mjs';
import { launchGame } from '../lib/browser.mjs';

const USAGE = 'w1-14-r5-shot.mjs — a bolt that leads a walking body';
const args = parseArgs();
if (wantsHelp(args)) usage(USAGE);
const out = args.out ? String(args.out)
  : 'docs/shots/2026-08-08-w1-14-r5-the-bolt-goes-where-the-body-is-going.png';
ensureDir(path.dirname(path.resolve(out)));

const handle = await launchGame(args);
let result;
try {
  result = await handle.page.evaluate(async () => {
    const H = window.__HARNESS;
    await H.ready();
    H.setSeed(31);
    H.loadState('cam_flat_plain');
    H.stepFrames(4);
    H.loadState('cam_flat_plain');
    H.setRenderRate(1);
    for (let i = 0; i < 700; i++) {
      for (const sk of ['sorcery', 'root-speech', 'warding', 'veiling']) H.grantSkillUse('cast_effective', { cost: 40, spell_skill: sk });
      H.hearthRest();
    }
    H.setWillpower(99); H.setCatalyst('great_staff'); H.setGold(400000); H.hearthRest();
    for (const s of H.getMagicData().spells.spells) H.learnSpell(s.id);
    const mk = H.makeSpell({ class: 'LIGHT', range: 'projectile', effects: [{ effect: 'fire_damage', magnitude: 40, duration_s: 0, area_r_m: 0 }] }, 'the one that leads');
    H.setAttuned([mk.spell.id]);
    const sp = H.spawn('drowned_lesser', 0, 14);
    const eid = sp && sp.eid ? sp.eid : sp;
    H.lockOn(eid);
    H.stepFrames(20);
    const hp0 = (H.getCombatState().enemies.find((e) => e.id === eid) || {}).hp;
    H.queueInputs([{ f: 30, press: ['light'] }, { f: 33, release: ['light'] }]);
    let x = 0;
    let shotAt = null;
    const trace = [];
    for (let f = 0; f < 120; f++) {
      H.stepFrames(1);
      x += 1.5 / 60;
      H.setEntityPos(eid, x, 14);
      const hb = (H.magicHitboxes() || []).filter((b) => b.kind === 'projectile');
      if (hb.length) {
        const p = hb[0];
        trace.push({ f, closest: p.closest_m, aim: p.aim_at, tgt: p.target_at, turn: p.turn_rate_dps });
        // The frame the bolt is about to arrive: the last frame at which the closest approach is
        // still shrinking and is inside two metres. That is the moment the round-4 build never
        // reached, because its bolt was already past.
        if (p.closest_m !== null && p.closest_m < 1.2 && shotAt === null) shotAt = f;
      }
      if (shotAt !== null && f === shotAt) break;
    }
    // THE HARNESS'S OWN CAPTURE, not `page.screenshot()`. The latter waits on the page's font
    // loading and times out in this container; every other shot tool in the tree uses this one.
    const png = await H.screenshot();
    H.stepFrames(40);
    const hp1 = (H.getCombatState().enemies.find((e) => e.id === eid) || {}).hp;
    return { hp0, hp1, shotAt, trace: trace.slice(-8), spell: mk.spell.id, moved_m: Math.round(x * 100) / 100, png };
  });
  fs.writeFileSync(path.resolve(out), Buffer.from(String(result.png).replace(/^data:image\/png;base64,/, ''), 'base64'));
} finally { await handle.close(); }

log(`shot: ${out}`);
log(`frame ${result.shotAt}; the body has walked ${result.moved_m} m across the bolt's line; hp ${result.hp0} -> ${result.hp1}`);
for (const t of result.trace) log(`  f=${t.f} closest ${t.closest} m  aim ${JSON.stringify(t.aim)}  body ${JSON.stringify(t.tgt)}  turning ${t.turn} deg/s`);
