#!/usr/bin/env node
// w1-14-r5-diag.mjs — ONE BOLT, FRAME BY FRAME. A diagnostic, not an acceptance.
//
// Dumps the projectile record every frame of one flight: heading, applied turn rate, the point
// it is steering at, the course this system measured for the body, and the closest approach so
// far. Exists because "the bolt missed by 1.13 m" is not a diagnosis, and the round-4 remedy's
// first point is that the number which matters is the closest approach.
//
// USAGE  node tools/harness/w1-14-r5-diag.mjs [--range 14] [--vx 3] [--class LIGHT] [--break nolead]
import path from 'node:path';
import { parseArgs, wantsHelp, usage, log, writeJson, ensureDir, EXIT, gitInfo } from '../lib/cli.mjs';
import { launchGame } from '../lib/browser.mjs';

const USAGE = 'w1-14-r5-diag.mjs --range 14 --vx 3 --class LIGHT [--break nolead]\n';
const args = parseArgs();
if (wantsHelp(args)) usage(USAGE);
const RANGE = Number(args.range || 14);
const VX = Number(args.vx === undefined ? 1.5 : args.vx);
const CLS = String(args.class || 'LIGHT');
const BREAK = args.break ? String(args.break) : null;
const outDir = path.resolve(String(args.out || 'reports/w1-14-r5'));
ensureDir(outDir);

const RUN = (page, o) => page.evaluate(async (q) => {
  const H = window.__HARNESS;
  await H.ready();
  H.setSeed(31); H.loadState('arena_flat'); H.setRenderRate(0); H.resetMagicWorld();
  for (let i = 0; i < 700; i++) {
    for (const sk of ['sorcery', 'root-speech', 'warding', 'veiling']) H.grantSkillUse('cast_effective', { cost: 40, spell_skill: sk });
    H.hearthRest();
  }
  H.setWillpower(99); H.setCatalyst('great_staff'); H.setGold(4000000); H.hearthRest();
  for (const s of H.getMagicData().spells.spells) H.learnSpell(s.id);
  if (q.brk === 'nolead') H.__breakLead(true); else if (H.__breakLead) H.__breakLead(false);
  const mk = H.makeSpell({ class: q.cls, range: 'projectile', effects: [{ effect: 'damage_health', magnitude: 20, duration_s: 0, area_r_m: 0 }] }, 'r5 diag');
  H.setAttuned([mk.spell.id]);
  const sp = H.spawn('drowned_lesser', 0, q.range);
  const eid = sp && sp.eid ? sp.eid : sp;
  H.stepFrames(4);
  H.queueInputs([{ f: 2, press: ['light'] }, { f: 5, release: ['light'] }]);
  const rows = [];
  let x = 0, z = q.range;
  const hp0 = (H.getCombatState().enemies.find((e) => e.id === eid) || {}).hp;
  for (let f = 0; f < 200; f++) {
    H.stepFrames(1);
    if (q.vx) { x += q.vx / 60; H.setEntityPos(eid, x, z); }
    const hb = (H.magicHitboxes ? H.magicHitboxes() : []).filter((b) => b.kind === 'projectile');
    if (hb.length) rows.push({ f, ...hb[0] });
  }
  const after = (H.getCombatState().enemies.find((e) => e.id === eid) || {});
  return { hp0, hp1: after.hp, damage: hp0 - after.hp, rows };
}, o);

(async () => {
  const git = gitInfo();
  const { page, close } = await launchGame();
  let d;
  try { d = await RUN(page, { range: RANGE, vx: VX, cls: CLS, brk: BREAK }); } finally { await close(); }
  writeJson(path.join(outDir, `diag-${CLS}-${RANGE}m-vx${VX}${BREAK ? `-${BREAK}` : ''}.json`), { commit: git.commit, range_m: RANGE, vx_mps: VX, cls: CLS, arm: BREAK || 'fix', ...d });
  log(`damage=${d.damage}  frames=${d.rows.length}`);
  for (const r of d.rows) {
    if (r.f % 4 && r.f > 4) continue;
    log(`f=${String(r.f).padStart(3)} pos=[${(r.pos || []).map((v) => v.toFixed ? v.toFixed(2) : v).join(',')}] head=${r.heading_deg} turn=${r.turn_rate_dps} cut=${r.tracking_cutoff_f} live=${r.tracking_live} aim=${JSON.stringify(r.aim_at)} tgt=${JSON.stringify(r.target_at)} vel=${JSON.stringify(r.target_vel_mps)} closest=${r.closest_m}`);
  }
  process.exit(EXIT.OK);
})();
