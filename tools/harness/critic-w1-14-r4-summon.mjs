#!/usr/bin/env node
// critic-w1-14-r4-summon.mjs — THE ALIAS FIX, MEASURED WITHOUT TRUSTING THE FIELD THAT REPORTS IT.
//
// W1-14 round 4 fixed `combat/enemy.js`'s `_weapon: weapon` (the shared statblock object) to
// `_weapon: { ...weapon }`, and in the same round ADDED `attack_rating` to
// `getCombatState().enemies[]` so the acceptance could be read from outside the build. A critic
// that grades the fix by reading the field the same round introduced is grading one commit
// against itself. So this tool reads the number TWICE, by two routes that share nothing:
//
//   ROUTE 1 — the reported field, `getCombatState().enemies[].attack_rating`.
//   ROUTE 2 — the DAMAGE an ordinary hostile actually does to the player. `resolve.js` computes
//             `computeDamage(motion_value, A.moves._weapon.attack_rating, …)`, so if the
//             statblock has been edited the wound is bigger. This route existed before round 4
//             and cannot have been faked by it.
//
// It also asks two questions the builder's arm did not:
//   * Is the statblock intact BEFORE anything is cast? A leak measured only after six casts
//     cannot distinguish "the casts did it" from "the fixture was already poisoned".
//   * Does the leak reach a DIFFERENT archetype? `bind_greater` spawns `drowned_greater`;
//     if the fix were partial, one of the two would still write through.
//
// USAGE  node tools/harness/critic-w1-14-r4-summon.mjs [--out <dir>] [--casts 6]
import path from 'node:path';
import { parseArgs, wantsHelp, usage, log, writeJson, ensureDir, EXIT, gitInfo } from '../lib/cli.mjs';
import { launchGame } from '../lib/browser.mjs';

const USAGE = `critic-w1-14-r4-summon.mjs — six identical casts, two independent readouts.

  --out <dir>    report directory (default reports/critic-w1-14-r4)
  --casts <n>    identical casts per arm (default 6)

Exit 0 only if the FIXED arm holds one attack rating across the casts, leaves the statblock at
its declared value on BOTH archetypes, and the BROKEN arm genuinely differs on both routes.
`;
const args = parseArgs();
if (wantsHelp(args)) usage(USAGE);
const outDir = args.out ? path.resolve(String(args.out)) : path.resolve('reports/critic-w1-14-r4');
ensureDir(outDir);
const CASTS = Number(args.casts ?? 6);

const ARM = (page, broken, casts) => page.evaluate(async ({ BROKEN, CASTS }) => {
  const H = window.__HARNESS;
  await H.ready();
  if (BROKEN) {
    if (!H.__breakSummonAlias) return { fatal: 'H.__breakSummonAlias is absent — the sabotage did NOT happen' };
    H.__breakSummonAlias(true);
  }
  H.setSeed(4242);
  H.loadState('arena_flat');
  H.setRenderRate(0);
  H.resetMagicWorld();
  for (let i = 0; i < 700; i++) {
    for (const sk of ['sorcery', 'root-speech', 'warding', 'veiling']) H.grantSkillUse('cast_effective', { cost: 40, spell_skill: sk });
    H.hearthRest();
  }
  H.setWillpower(99); H.setCatalyst('great_staff'); H.setGold(2000000); H.hearthRest();
  for (const s of H.getMagicData().spells.spells) H.learnSpell(s.id);

  const declared = {};
  const rowOf = (id) => H.getCombatState().enemies.find((e) => e.id === id) || null;

  // ---- BASELINE. What a plain body reads BEFORE anything is cast at all. --------------------
  const baseline = {};
  for (const arche of ['drowned_lesser', 'drowned_greater']) {
    const sp = H.spawn(arche, 6 + Object.keys(baseline).length * 3, 6);
    const id = sp && sp.eid ? sp.eid : sp;
    H.stepFrames(2);
    const r = rowOf(id);
    baseline[arche] = r ? r.attack_rating : null;
    declared[arche] = r ? r.attack_rating : null;
    try { H.despawn(id); } catch (e) { /* gone */ }
  }

  // ---- SIX IDENTICAL CASTS of one commissioned bind, per archetype --------------------------
  const perEffect = {};
  for (const [effect, arche] of [['bind_lesser', 'drowned_lesser'], ['bind_greater', 'drowned_greater']]) {
    const spec = { class: 'LIGHT', range: 'self', effects: [{ effect, magnitude: 40, duration_s: 20, area_r_m: 0 }] };
    const mk = H.makeSpell(spec, `critic_r4_${effect}`);
    if (mk.refused) { perEffect[effect] = { fatal: `could not commission: ${mk.reason || mk.gate}` }; continue; }
    const sid = mk.spell.id;
    const ratings = [];
    for (let i = 0; i < CASTS; i++) {
      H.hearthRest(); H.setAttuned([sid]);
      const before = new Set(H.getCombatState().enemies.map((e) => e.id));
      H.pressCast(90);
      const born = H.getCombatState().enemies.filter((e) => !before.has(e.id));
      const s = born[0] || null;
      ratings.push(s ? (s.attack_rating === undefined ? '__ABSENT__' : s.attack_rating) : null);
      if (s) { try { H.despawn(s.id); } catch (e) { /* gone */ } }
    }
    // The statblock, read through a body no spell has touched.
    const sp = H.spawn(arche, 8, 8);
    const pid = sp && sp.eid ? sp.eid : sp;
    H.stepFrames(2);
    const pr = rowOf(pid);
    perEffect[effect] = {
      archetype: arche, spell: sid, ratings,
      distinct: [...new Set(ratings)],
      plain_after: pr ? pr.attack_rating : null,
      baseline: baseline[arche],
    };
    if (pid) { try { H.despawn(pid); } catch (e) { /* gone */ } }
  }

  // ---- ROUTE 2. What the leak costs, in hit points, from a body no spell has touched. -------
  // Not the reported field: `resolve.js` reads `moves._weapon.attack_rating` to compute damage,
  // so the player's wound is an independent readout of the same number.
  H.hearthRest();
  const sp = H.spawn('drowned_lesser', 0, 2.0);
  const plainId = sp && sp.eid ? sp.eid : sp;
  H.stepFrames(2);
  const hp0 = H.getPlayerStats().hp;
  if (plainId) H.aggro(plainId);
  let hpMin = hp0, deaths = 0, wasDead = false;
  for (let t = 0; t < 20; t++) {
    H.stepFrames(30);
    const ps = H.getPlayerStats();
    if (ps.hp < hpMin) hpMin = ps.hp;
    const dead = ps.hp <= 0 || (H.getDeathState && H.getDeathState().dead);
    if (dead && !wasDead) deaths++;
    wasDead = !!dead;
  }
  return {
    broken: !!BROKEN, baseline, per_effect: perEffect,
    player_hp0: hp0, player_hp_min: Math.round(hpMin * 100) / 100,
    worst_wound: Math.round((hp0 - hpMin) * 100) / 100,
    deaths,
  };
}, { BROKEN: broken, CASTS: casts });

const handle = await launchGame(args);
let fixed, brokenArm;
try {
  fixed = await ARM(handle.page, false, CASTS);
  const p2 = await handle.page.context().newPage();
  await p2.goto(handle.page.url(), { waitUntil: 'load' });
  await p2.waitForFunction(() => !!window.__HARNESS, null, { timeout: 60000 });
  brokenArm = await ARM(p2, true, CASTS);
  await p2.close();
} finally {
  await handle.close();
}

const fails = [];
const check = (ok, why) => { if (!ok) fails.push(why); };
if (fixed.fatal) fails.push(`FIXED: ${fixed.fatal}`);
if (brokenArm.fatal) fails.push(`BROKEN: ${brokenArm.fatal}`);
if (!fixed.fatal && !brokenArm.fatal) {
  for (const eff of Object.keys(fixed.per_effect)) {
    const f = fixed.per_effect[eff], b = brokenArm.per_effect[eff];
    if (f.fatal) { fails.push(`FIXED ${eff}: ${f.fatal}`); continue; }
    check(!f.ratings.includes('__ABSENT__'), `${eff}: getCombatState().enemies[] has no attack_rating`);
    check(f.distinct.length === 1, `FIXED ${eff}: ${f.distinct.length} distinct attack ratings (${f.distinct.join(', ')}) — the acceptance is ONE`);
    check(f.plain_after === f.baseline, `FIXED ${eff}: a plain ${f.archetype} reads ${f.plain_after} after ${CASTS} casts; before them it read ${f.baseline}`);
    if (b && !b.fatal) {
      check(b.distinct.length > 1, `INERT CONTROL (${eff}): the BROKEN arm also gave one distinct rating (${b.distinct.join(', ')})`);
      check(b.plain_after !== b.baseline, `INERT CONTROL (${eff}): the BROKEN arm left the statblock at its declared ${b.baseline}`);
    }
  }
  check(brokenArm.worst_wound > fixed.worst_wound,
    `INERT CONTROL (route 2): the BROKEN arm wounded the player ${brokenArm.worst_wound} against the FIXED arm's ${fixed.worst_wound} — the damage route did not move`);
}

const report = {
  schema: 'elder-souls/critic-w1-14-r4-summon@1',
  commit: gitInfo().commit, casts: CASTS,
  arms: { fixed, broken: brokenArm },
  control_is_live: !fails.some((f) => f.startsWith('INERT CONTROL')),
  pass: fails.length === 0, failures: fails,
};
writeJson(path.join(outDir, 'summon-alias.json'), report);
for (const arm of ['fixed', 'broken']) {
  const a = report.arms[arm];
  if (!a || a.fatal) continue;
  log(`${arm.toUpperCase()} baseline=${JSON.stringify(a.baseline)}`);
  for (const [eff, r] of Object.entries(a.per_effect)) {
    log(`  ${arm} ${eff.padEnd(13)} ratings=${JSON.stringify(r.ratings)} plain_after=${r.plain_after} (declared ${r.baseline})`);
  }
  log(`  ${arm} route 2: worst wound ${a.worst_wound} of ${a.player_hp0} hp, deaths ${a.deaths}`);
}
for (const f of fails) log(`FAIL: ${f}`);
log(`report: ${path.join(outDir, 'summon-alias.json')}`);
process.exit(fails.length ? EXIT.MEASUREMENT_FAIL : 0);
