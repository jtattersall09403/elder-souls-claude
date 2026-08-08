#!/usr/bin/env node
// critic-w1-14-r4-touch.mjs — DOES THE TOUCH FIX APPLY ONCE, AND IS ITS TEARDOWN THE SAME WIDTH?
//
// W1-14 round 4 added one line to `MagicSystem.step`'s volume loop —
// `if (v.hits.includes(t.id)) continue` — and claims:
//   (a) all nine class x range rows now read `applied 1, damage 44`;
//   (b) the broken arm reproduces `touch` 4/176, 5/220, 7/308 with `target` and `projectile`
//       unchanged, "so the teardown is exactly as wide as the fix";
//   (c) NO area spell changes, because every volume in the build is
//       `active_f 6 / ticks_every_f 12` and therefore ticks once already.
//
// (b) is the claim this tool exists to test, and it is the one that matters: a teardown that
// breaks MORE than its fix repairs makes an inert fix look live, because the red comes from the
// extra breakage. So the width is measured rather than asserted — every row of the 3x3 census
// PLUS a commissioned AREA spell with the widest legal radius PLUS a survey of the volume
// geometry of every shipped spell, in both arms, and the difference set is reported.
//
// It also asks the question (c) invites and the round did not: if no volume in the build ever
// ticks twice, what does DURATION buy on an area spell? That is reported, not graded here.
//
// USAGE  node tools/harness/critic-w1-14-r4-touch.mjs [--out <dir>]
import path from 'node:path';
import { parseArgs, wantsHelp, usage, log, writeJson, ensureDir, EXIT, gitInfo } from '../lib/cli.mjs';
import { launchGame } from '../lib/browser.mjs';

const USAGE = `critic-w1-14-r4-touch.mjs — one application per cast, and a teardown of the right width.

  --out <dir>   report directory (default reports/critic-w1-14-r4)

Exit 0 only if every FIXED row applies once, the BROKEN arm differs on 'touch' and ONLY on
'touch', and the area arm is byte-identical between the two.
`;
const args = parseArgs();
if (wantsHelp(args)) usage(USAGE);
const outDir = args.out ? path.resolve(String(args.out)) : path.resolve('reports/critic-w1-14-r4');
ensureDir(outDir);

const ARM = (page, broken) => page.evaluate(async (BROKEN) => {
  const H = window.__HARNESS;
  await H.ready();
  if (BROKEN) {
    if (!H.__breakTouchDedupe) return { fatal: 'H.__breakTouchDedupe is absent — the sabotage did NOT happen' };
    H.__breakTouchDedupe(true);
  }
  const setup = () => {
    H.setSeed(909);
    H.loadState('arena_flat');
    H.setRenderRate(0);
    H.resetMagicWorld();
    for (let i = 0; i < 700; i++) {
      for (const sk of ['sorcery', 'root-speech', 'warding', 'veiling']) H.grantSkillUse('cast_effective', { cost: 40, spell_skill: sk });
      H.hearthRest();
    }
    H.setWillpower(99); H.setCatalyst('great_staff'); H.setGold(2000000); H.hearthRest();
    for (const s of H.getMagicData().spells.spells) H.learnSpell(s.id);
  };

  // ---- the 3x3 census: damage_health magnitude 20, declared output 40 ------------------------
  const rows = [];
  for (const cls of ['CANTRIP', 'LIGHT', 'HEAVY']) {
    for (const range of ['touch', 'target', 'projectile']) {
      setup();
      if (BROKEN) H.__breakTouchDedupe(true);
      const spec = { class: cls, range, effects: [{ effect: 'damage_health', magnitude: 20, duration_s: 0, area_r_m: 0 }] };
      const mk = H.makeSpell(spec, `critic_${cls}_${range}`);
      if (mk.refused) { rows.push({ cls, range, refused: mk.reason || mk.gate }); continue; }
      H.setAttuned([mk.spell.id]);
      // ONE stationary body, dead ahead, inside touch reach (1.6 m) and inside projectile flight.
      const sp = H.spawn('drowned_lesser', 0, 1.2);
      const eid = sp && sp.eid ? sp.eid : sp;
      H.stepFrames(2);
      const before = (H.getCombatState().enemies.find((e) => e.id === eid) || {}).hp;
      H.magicEventsDrain();
      H.pressCast(180);
      const evs = H.magicEventsDrain();
      const after = (H.getCombatState().enemies.find((e) => e.id === eid) || {}).hp;
      rows.push({
        cls, range,
        applied: evs.filter((e) => e.kind === 'effect_apply').length,
        event_kinds: [...new Set(evs.map((e) => e.kind))],
        hp_before: before, hp_after: after,
        damage: before !== undefined && after !== undefined ? Math.round((before - after) * 100) / 100 : null,
      });
      try { H.despawn(eid); } catch (e) { /* gone */ }
    }
  }

  // ---- THE WIDTH ARM. An AREA spell, four bodies, the widest legal radius. -------------------
  setup();
  if (BROKEN) H.__breakTouchDedupe(true);
  const eff = H.getMagicData().effects.effects.find((e) => e.id === 'fire_damage');
  const maxR = eff && eff.area && eff.area.max_r_m ? eff.area.max_r_m : 8;
  const areaSpec = { class: 'HEAVY', range: 'area_at_range', effects: [{ effect: 'fire_damage', magnitude: 40, duration_s: 0, area_r_m: maxR }] };
  const amk = H.makeSpell(areaSpec, 'critic_area_width');
  let area = { refused: amk.refused ? (amk.reason || amk.gate) : null };
  if (!amk.refused) {
    H.setAttuned([amk.spell.id]);
    // The volume lands a flat 9.0 m in front of the caster (`_spawnVolume`), so the bodies
    // stand around that point rather than around the caster — the round-3 critic's own note.
    const ids = [];
    for (const [dx, dz] of [[0, 9.0], [1.5, 9.0], [-2.5, 9.0], [0, 12.0]]) {
      const sp = H.spawn('drowned_lesser', dx, dz);
      ids.push(sp && sp.eid ? sp.eid : sp);
    }
    H.stepFrames(2);
    const hp0 = ids.map((i) => (H.getCombatState().enemies.find((e) => e.id === i) || {}).hp);
    H.magicEventsDrain();
    H.pressCast(240);
    const evs = H.magicEventsDrain();
    const hp1 = ids.map((i) => (H.getCombatState().enemies.find((e) => e.id === i) || {}).hp);
    area = {
      radius_m: maxR, geometry: amk.spell.geometry,
      applied: evs.filter((e) => e.kind === 'effect_apply').length,
      hp_before: hp0, hp_after: hp1,
      damage: hp0.map((v, i) => (v === undefined || hp1[i] === undefined ? null : Math.round((v - hp1[i]) * 100) / 100)),
    };
  }

  // ---- the geometry survey the round asserts: does ANY shipped spell tick a volume twice? ----
  setup();
  const geoms = {};
  for (const s of H.getMagicData().spells.spells) {
    const g = s.geometry;
    if (!g || g.kind !== 'volume') continue;
    const key = `active_f=${g.active_f} ticks_every_f=${g.ticks_every_f}`;
    geoms[key] = (geoms[key] || 0) + 1;
  }
  return { broken: !!BROKEN, rows, area, volume_geometries: geoms };
}, broken);

const handle = await launchGame(args);
let fixed, brokenArm;
try {
  fixed = await ARM(handle.page, false);
  const p2 = await handle.page.context().newPage();
  await p2.goto(handle.page.url(), { waitUntil: 'load' });
  await p2.waitForFunction(() => !!window.__HARNESS, null, { timeout: 60000 });
  brokenArm = await ARM(p2, true);
  await p2.close();
} finally {
  await handle.close();
}

const fails = [];
if (fixed.fatal) fails.push(`FIXED: ${fixed.fatal}`);
if (brokenArm.fatal) fails.push(`BROKEN: ${brokenArm.fatal}`);
const moved = [], same = [];
if (!fixed.fatal && !brokenArm.fatal) {
  for (const f of fixed.rows) {
    const b = brokenArm.rows.find((r) => r.cls === f.cls && r.range === f.range) || {};
    const key = `${f.cls}/${f.range}`;
    if (f.applied !== 1 || f.damage === null) fails.push(`FIXED ${key}: applied ${f.applied}, damage ${f.damage} — the acceptance is 1 application`);
    if (b.applied !== f.applied || b.damage !== f.damage) moved.push({ key, fixed: [f.applied, f.damage], broken: [b.applied, b.damage] });
    else same.push(key);
  }
  const movedTouch = moved.filter((m) => m.key.endsWith('/touch'));
  const movedOther = moved.filter((m) => !m.key.endsWith('/touch'));
  if (movedTouch.length !== 3) fails.push(`INERT CONTROL: the teardown moved ${movedTouch.length} of 3 touch rows`);
  if (movedOther.length) fails.push(`TEARDOWN TOO WIDE: it also moved ${movedOther.map((m) => m.key).join(', ')} — a control that breaks more than the fix repairs makes an inert fix look live`);
  const fa = JSON.stringify(fixed.area.damage), ba = JSON.stringify(brokenArm.area.damage);
  if (fa !== ba) fails.push(`TEARDOWN TOO WIDE (area): fixed ${fa} vs broken ${ba}`);
}

const report = {
  schema: 'elder-souls/critic-w1-14-r4-touch@1',
  commit: gitInfo().commit,
  arms: { fixed, broken: brokenArm },
  rows_moved_by_teardown: moved, rows_unmoved: same,
  control_is_live: !fails.some((f) => f.startsWith('INERT CONTROL')),
  pass: fails.length === 0, failures: fails,
};
writeJson(path.join(outDir, 'touch-once.json'), report);
if (!fixed.fatal) for (const f of fixed.rows) {
  const b = (brokenArm.rows || []).find((r) => r.cls === f.cls && r.range === f.range) || {};
  log(`  ${f.cls.padEnd(8)} ${f.range.padEnd(11)} FIXED applied=${f.applied} dmg=${f.damage}   BROKEN applied=${b.applied} dmg=${b.damage}`);
}
if (!fixed.fatal) log(`AREA r=${fixed.area.radius_m}: FIXED damage ${JSON.stringify(fixed.area.damage)} / BROKEN ${JSON.stringify((brokenArm.area || {}).damage)}`);
if (!fixed.fatal) log(`volume geometries across shipped spells: ${JSON.stringify(fixed.volume_geometries)}`);
for (const f of fails) log(`FAIL: ${f}`);
log(`report: ${path.join(outDir, 'touch-once.json')}`);
process.exit(fails.length ? EXIT.MEASUREMENT_FAIL : 0);
