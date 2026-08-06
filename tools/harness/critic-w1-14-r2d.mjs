#!/usr/bin/env node
// critic-w1-14-r2d.mjs — W1-14 round 2: skills-by-use from casting (RI-PRG03 magic slice),
// in a state that HAS a character sheet, plus the VFX blind-pair frames (RI-MAG05 A-M5/A-M6/F-M6).
import path from 'node:path';
import fs from 'node:fs';
import { parseArgs, log, writeJson, ensureDir } from '../lib/cli.mjs';
import { launchGame } from '../lib/browser.mjs';
const args = parseArgs();
const outDir = args.out ? path.resolve(String(args.out)) : path.resolve('corpus/90-verdicts/wave1/artifacts/W1-14-r2');
ensureDir(outDir);
const shotDir = path.join(outDir, 'frames'); ensureDir(shotDir);
const handle = await launchGame(args);
let R;
try {
  const page = handle.page;
  R = await page.evaluate(async () => {
    const H = window.__HARNESS; await H.ready();
    const D = H.getMagicData();
    const out = {};
    const sheet = () => {
      const s = H.getSkillSheet();
      const rows = Array.isArray(s) ? s : (s.skills || s.rows || []);
      const m = {};
      for (const r of rows) m[r.id || r.skill] = (r.value !== undefined ? r.value : r);
      return Object.keys(m).length ? m : s;
    };
    const cast = (sid, frames) => { H.setAttuned([sid]); H.queueInputs([{ f: 2, press: ['light'] }, { f: 4, release: ['light'] }]); H.stepFrames(frames || 140); };

    for (const state of ['default', 'arena_flat', 'dungeon_primary']) {
      H.setSeed(11); H.loadState(state); H.setRenderRate(0);
      H.setWillpower(99); H.setCatalyst('great_staff'); H.setGold(2000000); H.hearthRest();
      for (const s of D.spells.spells) H.learnSpell(s.id);
      const before = sheet();
      const eid = H.spawn('inf_trash', 0, 1.4);
      const fire = D.spells.spells.find((s) => s.effects.some((t) => t.effect === 'fire_damage') && s.class !== 'RITUAL');
      const ward = D.spells.spells.find((s) => s.school === 'warding' && s.class !== 'RITUAL');
      let sorceryCasts = 0, wardCasts = 0;
      for (let i = 0; i < 25; i++) { cast(fire.id, 110); H.hearthRest(); sorceryCasts++; if (H.getCombatState().enemies.every((e) => e.dead)) H.spawn('inf_trash', 0, 1.4); }
      const mid = sheet();
      for (let i = 0; i < 25; i++) { cast(ward.id, 110); H.hearthRest(); wardCasts++; }
      out[`skills_${state}`] = { before, after_sorcery: mid, after_warding: sheet(), sorceryCasts, wardCasts, ward_spell: ward.id, fire_spell: fire.id, has_character: !!H.getCharacter };
    }
    return out;
  });

  // ---- the RI-MAG05 blind-pair frames: ours, at four named sample points -------------------
  const shots = await page.evaluate(async () => {
    const H = window.__HARNESS; await H.ready();
    const D = H.getMagicData();
    H.setSeed(5); H.loadState('arena_flat'); H.setRenderRate(1);
    H.setWillpower(99); H.setCatalyst('great_staff'); H.setGold(2000000); H.hearthRest();
    for (const s of D.spells.spells) H.learnSpell(s.id);
    H.spawn('inf_trash', 0, 9);
    H.setTimeOfDay(13);
    const proj = D.spells.spells.find((s) => s.geometry && s.geometry.kind === 'projectile' && s.school === 'sorcery');
    H.setAttuned([proj.id]);
    H.queueInputs([{ f: 2, press: ['light'] }, { f: 4, release: ['light'] }]);
    return { spell: proj.id };
  });
  const cap = async (label, stepFrames) => {
    await page.evaluate((n) => { window.__HARNESS.stepFrames(n); window.__HARNESS.renderFrame(); }, stepFrames);
    const buf = await page.screenshot({ type: 'png' });
    fs.writeFileSync(path.join(shotDir, `${label}.png`), buf);
    const st = await page.evaluate(() => window.__HARNESS.getWorldStats());
    return { label, drawCalls: st.drawCalls, triangles: st.triangles, vfx: st.vfx || null };
  };
  R.frames = [];
  R.frames.push(await cap('01-windup', 20));
  R.frames.push(await cap('02-release', 8));
  R.frames.push(await cap('03-inflight', 12));
  R.frames.push(await cap('04-impact', 20));
  R.frames.push(await cap('05-residue-5s', 300));
  // night, to show VFX-LIT
  await page.evaluate(() => { const H = window.__HARNESS; H.setTimeOfDay(0); H.queueInputs([{ f: 2, press: ['light'] }, { f: 4, release: ['light'] }]); });
  R.frames.push(await cap('06-night-release', 30));
  R.spellShot = shots;
} finally { await handle.close(); }
writeJson(path.join(outDir, 'critic-skills-vfx.json'), R);
for (const k of Object.keys(R)) if (k.startsWith('skills_')) log(k, JSON.stringify(R[k].before), '->', JSON.stringify(R[k].after_warding));
log('frames:', JSON.stringify(R.frames));
console.log(path.join(outDir, 'critic-skills-vfx.json'));
