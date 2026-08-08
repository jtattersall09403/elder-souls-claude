#!/usr/bin/env node
// w1-14-r4-touch.mjs — HOW MANY TIMES DOES ONE CAST LAND?
//
// THE DEFECT (W1-14 round-3 verdict §7). `MagicSystem._spawnContact` sets `ticksEveryF: 1` and an
// active window of the cast class's own `active` frames, and the volume loop applied the effect to
// every body inside the sphere on every tick with no per-target dedupe. So the number of times a
// `touch` spell landed was the class's active-frame count: `damage_health` at magnitude 20 —
// declared output 40 — measured 4 applications / 176 damage at CANTRIP, 5 / 220 at LIGHT and
// 7 / 308 at HEAVY, against 1 / 44 at `target` and `projectile`. A HEAVY touch spell delivered
// 7.7x its own declared output at the CHEAPEST range multiplier in the table (`focusBase()`
// charges 0.85 for touch against 1.00 for target).
//
// AND IT CONTAMINATED THE MEASUREMENTS. `rangeFor`'s order in both the census and the dial probe
// is `['self', 'touch', 'target', 'projectile', 'area_at_range']` for every non-area effect, so a
// large part of the catalogue has been measured through a four-to-seven-times applicator for
// three rounds. That is why this tool re-runs the RANGE COMPARISON rather than only counting
// applications: the acceptance is `applied == 1` for every class at touch AND `touch` damage
// equal to `target` damage for the same magnitude.
//
// THE ARM STRUCTURE. Three ranges x three classes x two arms (fix present, `H.__breakTouchDedupe`),
// one body, one magnitude, nothing else varying. `applied` is counted off `effect_apply` events
// rather than inferred from the damage, so a change in the damage FORMULA could not be mistaken
// for a change in the number of applications.
//
// USAGE  node tools/harness/w1-14-r4-touch.mjs [--out <dir>] [--magnitude 20]
import path from 'node:path';
import { parseArgs, wantsHelp, usage, log, writeJson, ensureDir, EXIT, gitInfo } from '../lib/cli.mjs';
import { launchGame } from '../lib/browser.mjs';

const USAGE = `w1-14-r4-touch.mjs — a touch spell must land once (RI-MAG02, round-3 gap 2)

  --out <dir>       report directory (default reports/w1-14-r4)
  --magnitude <m>   damage_health magnitude (default 20; declared output 40)

Exit 0 only if, with the fix present, EVERY class at touch applies exactly once and does the same
damage as the same spell at target — and the BROKEN arm does not, which is what makes it a control.
`;
const args = parseArgs();
if (wantsHelp(args)) usage(USAGE);
const outDir = args.out ? path.resolve(String(args.out)) : path.resolve('reports/w1-14-r4');
ensureDir(outDir);
const MAG = Number(args.magnitude ?? 20);

const ARM = async (page, broken, MAG) => page.evaluate(async ({ BROKEN, MAG }) => {
  const H = window.__HARNESS;
  await H.ready();
  if (BROKEN) {
    if (!H.__breakTouchDedupe) return { fatal: 'H.__breakTouchDedupe is absent — the sabotage did NOT happen' };
    H.__breakTouchDedupe(true);
  }
  const arena = () => {
    H.setSeed(4242);
    H.loadState('arena_flat');
    H.setRenderRate(0);
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
    for (const s of H.getMagicData().spells.spells) H.learnSpell(s.id);
    // ONE STATIONARY BODY at 1.4 m — inside `touch`'s 1.6 m reach and squarely in front of a
    // bolt. Un-aggroed on purpose: a body that walks changes the geometry between arms, and this
    // measurement is about the applicator and not about the aim.
    const e = H.spawn('inf_trash', 0, 1.4);
    const eid = e && e.eid ? e.eid : e;
    H.lockOn(eid);
    H.magicEventsDrain();
    return eid;
  };
  if (BROKEN) H.__breakTouchDedupe(true);

  const rows = [];
  for (const cls of ['CANTRIP', 'LIGHT', 'HEAVY']) {
    for (const range of ['touch', 'target', 'projectile']) {
      const eid = arena();
      if (BROKEN) H.__breakTouchDedupe(true);
      const before = H.getCombatState().enemies.find((x) => x.id === eid);
      const mk = H.makeSpell({ class: cls, range, effects: [{ effect: 'damage_health', magnitude: MAG, duration_s: 0, area_r_m: 0 }] }, `t_${cls}_${range}`);
      if (mk.refused) { rows.push({ class: cls, range, refused: mk.reason || mk.gate }); continue; }
      H.setAttuned([mk.spell.id]);
      H.queueInputs([{ f: 2, press: ['light'] }, { f: 4, release: ['light'] }]);
      H.stepFrames(180);
      const after = H.getCombatState().enemies.find((x) => x.id === eid);
      const ev = H.magicEventsDrain();
      const applied = ev.filter((x) => x.kind === 'effect_apply' && x.effect === 'damage_health');
      rows.push({
        class: cls, range,
        applied: applied.length,
        damage: Math.round(((before ? before.hp : 0) - (after ? after.hp : 0)) * 100) / 100,
        hp: [before ? before.hp : null, after ? after.hp : null],
        active_f: (H.getMagicData().castClasses && H.getMagicData().castClasses.classes && H.getMagicData().castClasses.classes[cls])
          ? H.getMagicData().castClasses.classes[cls].active : null,
      });
    }
  }
  return { broken: !!BROKEN, magnitude: MAG, rows };
}, { BROKEN: broken, MAG });

const handle = await launchGame(args);
let fixed, brokenArm;
try {
  fixed = await ARM(handle.page, false, MAG);
  const p2 = await handle.page.context().newPage();
  await p2.goto(handle.page.url(), { waitUntil: 'load' });
  await p2.waitForFunction(() => !!window.__HARNESS, null, { timeout: 30000 });
  brokenArm = await ARM(p2, true, MAG);
  await p2.close();
} finally {
  await handle.close();
}

const fails = [];
const at = (arm, cls, range) => arm.rows.find((r) => r.class === cls && r.range === range) || {};
if (fixed.fatal) fails.push(`FIXED: ${fixed.fatal}`);
if (brokenArm.fatal) fails.push(`BROKEN: ${brokenArm.fatal}`);
if (!fixed.fatal && !brokenArm.fatal) {
  for (const cls of ['CANTRIP', 'LIGHT', 'HEAVY']) {
    const t = at(fixed, cls, 'touch');
    const g = at(fixed, cls, 'target');
    if (t.applied !== 1) fails.push(`FIXED ${cls} touch applied ${t.applied} times; the acceptance is 1`);
    if (g.applied !== 1) fails.push(`FIXED ${cls} target applied ${g.applied} times; the acceptance is 1`);
    if (Math.abs((t.damage || 0) - (g.damage || 0)) > 1) fails.push(`FIXED ${cls}: touch ${t.damage} vs target ${g.damage} — the cheapest range is still not the same spell`);
  }
  // THE CONTROL MUST GO RED, on the row the defect was reported on.
  const bh = at(brokenArm, 'HEAVY', 'touch');
  if (!(bh.applied > 1)) fails.push(`INERT CONTROL: the BROKEN arm applied HEAVY touch ${bh.applied} time(s). The teardown did not reach the applicator.`);
  const bg = at(brokenArm, 'HEAVY', 'target');
  if (bg.applied !== 1) fails.push(`the BROKEN arm changed 'target' too (${bg.applied}) — the teardown is wider than the fix and the arms are not comparable`);
}

const report = {
  schema: 'elder-souls/w1-14-r4-touch@1',
  commit: gitInfo().commit,
  magnitude: MAG,
  arms: { fixed, broken: brokenArm },
  pass: fails.length === 0,
  failures: fails,
};
writeJson(path.join(outDir, 'touch-applies-once.json'), report);
const table = (arm) => (arm.rows || []).map((r) => `${r.class}/${r.range}: applied ${r.applied}, damage ${r.damage}`).join('  |  ');
log(`FIXED   ${table(fixed)}`);
log(`BROKEN  ${table(brokenArm)}`);
for (const f of fails) log(`FAIL: ${f}`);
log(`report: ${path.join(outDir, 'touch-applies-once.json')}`);
process.exit(fails.length ? EXIT.MEASUREMENT_FAIL : 0);
