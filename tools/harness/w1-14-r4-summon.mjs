#!/usr/bin/env node
// w1-14-r4-summon.mjs — SIX IDENTICAL CASTS, AND WHAT THEY LEAVE BEHIND.
//
// THE DEFECT THIS MEASURES (W1-14 round-3 verdict §5).
//
// `bindHandler` scales four fields on a bound body, and one of them was not the body's.
// `combat/enemy.js` built an enemy's move table with `_weapon: weapon`, where `weapon` is
// `stat.weapon` — the object `loadData()` parsed ONCE out of
// `game/data/combat/enemies/drowned_lesser.json` — so the scaling wrote through to the
// STATBLOCK. Six identical casts of one commissioned `bind_lesser` at magnitude 40 (`power`
// 2.22 every time) measured 191, 424, 941, 2089, 4638, 10296: the declared 86 multiplied by
// 2.22 six times. `hp_max` was CONSTANT at 577 throughout, because `hpMax` is rebuilt from
// `stat.hp` on every spawn — and `hp_max` was the only field round 3's AR-1 arm could see, which
// is why twenty identical casts had looked identical for three rounds.
//
// FOUR THINGS THIS TOOL DOES THAT THE ROUND-3 ARM DID NOT.
//
//  1. IT READS `attack_rating`. Round 4 puts it on `getCombatState().enemies[]` (engine.js), for
//     the reason the round-3 critic gave: without it the second half of the acceptance is
//     unmeasurable from outside the build. The tool ASSERTS the field is present and exits
//     non-zero if it is not, rather than reporting six nulls as six identical values.
//  2. IT MEASURES THE LEAK, which the critic could only infer from source. After the six casts
//     it spawns a PLAIN `drowned_lesser` — nothing to do with any spell — and reads its attack
//     rating. If the statblock has been edited, an ordinary enemy the world puts in front of you
//     is carrying the enchantment.
//  3. IT MEASURES WHAT THE LEAK COSTS A PLAYER. That plain body is aggroed and swung, and the
//     damage the player takes is recorded. This is the CONSUMPTION arm and it is deliberately
//     NOT the round-3 arm's "aggro your own summon and report damage to the caster": the body
//     that hits you here is an ordinary hostile that has never been summoned by anybody. (See
//     `NEXT-DISPATCH.md` §Q4 — `engine.spawn` drops `opts.side`, so a summon has no side to
//     fight on and measuring its usefulness by hitting its caster measures the wrong thing.)
//  4. DELETE-THE-FIX IN ITS OWN PAGE. `H.__breakSummonAlias()` restores the aliasing. It has to
//     run in a FRESH BROWSER PAGE, because under the break the arm permanently edits the loaded
//     statblock and a second arm in the same page would start from a poisoned 10296 rather than
//     from 86. Two pages, one browser (rule 21).
//
// USAGE  node tools/harness/w1-14-r4-summon.mjs [--out <dir>] [--casts 6] [--magnitude 40]
import path from 'node:path';
import { parseArgs, wantsHelp, usage, log, writeJson, ensureDir, EXIT, gitInfo } from '../lib/cli.mjs';
import { launchGame } from '../lib/browser.mjs';

const USAGE = `w1-14-r4-summon.mjs — does casting the same summon twice produce the same summon?

  --out <dir>       report directory (default reports/w1-14-r4)
  --casts <n>       identical casts per arm (default 6)
  --magnitude <m>   bind_lesser magnitude (default 40, which is power 2.22)

Exit 0 only if EVERY assertion holds: one distinct attack_rating across the casts of the FIXED
arm, the statblock intact afterwards, and the BROKEN arm genuinely different from it. A control
arm that comes back identical to the treatment arm is reported as an INERT CONTROL and fails.
`;
const args = parseArgs();
if (wantsHelp(args)) usage(USAGE);
const outDir = args.out ? path.resolve(String(args.out)) : path.resolve('reports/w1-14-r4');
ensureDir(outDir);
const CASTS = Number(args.casts ?? 6);
const MAG = Number(args.magnitude ?? 40);

/** One arm, in its own page. `broken` arms the aliasing before anything is cast. */
const ARM = async (page, { broken, CASTS, MAG }) => page.evaluate(async ({ BROKEN, CASTS, MAG }) => {
  const H = window.__HARNESS;
  await H.ready();
  const notes = [];
  if (BROKEN) {
    if (!H.__breakSummonAlias) return { fatal: 'H.__breakSummonAlias is absent — the sabotage did NOT happen' };
    H.__breakSummonAlias(true);
  }
  if (H.__weaponAliasingArmed) notes.push(`aliasing armed: ${H.__weaponAliasingArmed()}`);

  // The arena. One flat room, a caster who can afford anything, and NOTHING aggroed: a body that
  // walks is noise in a measurement whose whole content is a number on a weapon.
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

  // ONE commissioned spell, cast CASTS times. Not CASTS spells: the question is whether the same
  // button twice gives the same result, so the spell record must be the same record.
  const spec = { class: 'LIGHT', range: 'self', effects: [{ effect: 'bind_lesser', magnitude: MAG, duration_s: 20, area_r_m: 0 }] };
  const mk = H.makeSpell(spec, 'w1_14_r4_six');
  if (mk.refused) return { fatal: `the arena could not commission the spell: ${mk.reason || mk.gate}` };
  const sid = mk.spell.id;
  H.setAttuned([sid]);

  const casts = [];
  for (let i = 0; i < CASTS; i++) {
    // Focus topped up between casts so no cast can be refused for the reservoir, which would
    // make an arm's later rows measure a refusal rather than a summon.
    H.hearthRest();
    H.setAttuned([sid]);
    const before = new Set(H.getCombatState().enemies.map((e) => e.id));
    H.queueInputs([{ f: 2, press: ['light'] }, { f: 4, release: ['light'] }]);
    H.stepFrames(90);
    const after = H.getCombatState().enemies;
    const born = after.filter((e) => !before.has(e.id));
    const s = born[0] || null;
    casts.push({
      n: i + 1,
      eid: s ? s.id : null,
      statblock: s ? s.statblock : null,
      attack_rating: s ? (s.attack_rating === undefined ? '__ABSENT__' : s.attack_rating) : null,
      hp_max: s ? s.hp_max : null,
      summons: H.getMagicWorld().summons ? H.getMagicWorld().summons.length : null,
    });
    // Take it off the floor so the next cast's `born` set is unambiguous and so the room does
    // not fill with six bodies whose collision would move each other.
    if (s) { try { H.despawn(s.id); } catch (err) { /* already gone */ } }
  }

  // ---- THE LEAK. A plain body, from the world's own spawner, that no spell has touched. ------
  const plain = H.spawn('drowned_lesser', 0, 2.0);
  const plainId = plain && plain.eid ? plain.eid : plain;
  H.stepFrames(2);
  const prow = H.getCombatState().enemies.find((e) => e.id === plainId) || null;

  // ---- WHAT IT COSTS. That ordinary hostile swings; the player's hp is the observable. -------
  //
  // SAMPLED, NOT DIFFERENCED, and the reason is a wrong number this tool published on its first
  // run: under the break the body hits for ~10,000 against a 300 hp player, the player DIES, the
  // death system respawns them at full health, and `hp_before - hp_after` came back **0** — the
  // most damaging arm in the experiment reporting the least damage. The minimum hp seen and the
  // death count are what the arm is actually about.
  H.hearthRest();
  const hp0 = H.getPlayerStats().hp;
  if (plainId) H.aggro(plainId);
  let hpMin = hp0;
  let deaths = 0;
  let wasDead = false;
  for (let t = 0; t < 20; t++) {
    H.stepFrames(30);
    const ps = H.getPlayerStats();
    if (ps.hp < hpMin) hpMin = ps.hp;
    const dead = ps.hp <= 0 || (H.getDeathState && H.getDeathState().dead);
    if (dead && !wasDead) deaths++;
    wasDead = !!dead;
  }
  const hp1 = H.getPlayerStats().hp;

  return {
    broken: !!BROKEN, notes, spell: sid, magnitude: MAG,
    declared_statblock_attack_rating: 86,
    casts,
    distinct_attack_ratings: [...new Set(casts.map((c) => c.attack_rating))],
    distinct_hp_max: [...new Set(casts.map((c) => c.hp_max))],
    plain_after: prow ? { id: prow.id, statblock: prow.statblock, attack_rating: prow.attack_rating, hp_max: prow.hp_max } : null,
    player_worst_wound_from_plain_body: Math.round((hp0 - hpMin) * 100) / 100,
    player_deaths_to_plain_body: deaths,
    player_hp: [hp0, hpMin, hp1],
  };
}, { BROKEN: broken, CASTS, MAG });

const handle = await launchGame(args);
let fixed, brokenArm;
try {
  fixed = await ARM(handle.page, { broken: false, CASTS, MAG });
  // A SECOND PAGE for the broken arm. Under the break the arm edits the loaded statblock, and a
  // second arm sharing the page would begin at whatever the first left behind.
  const p2 = await handle.page.context().newPage();
  await p2.goto(handle.page.url(), { waitUntil: 'load' });
  await p2.waitForFunction(() => !!window.__HARNESS, null, { timeout: 30000 });
  brokenArm = await ARM(p2, { broken: true, CASTS, MAG });
  await p2.close();
} finally {
  await handle.close();
}

const fails = [];
const check = (ok, why) => { if (!ok) fails.push(why); return ok; };
if (fixed.fatal) fails.push(`FIXED arm: ${fixed.fatal}`);
if (brokenArm.fatal) fails.push(`BROKEN arm: ${brokenArm.fatal}`);
if (!fixed.fatal && !brokenArm.fatal) {
  check(!fixed.casts.some((c) => c.attack_rating === '__ABSENT__'),
    'getCombatState().enemies[] does not carry attack_rating — the acceptance is unmeasurable from outside the build');
  check(fixed.distinct_attack_ratings.length === 1,
    `FIXED arm produced ${fixed.distinct_attack_ratings.length} distinct attack ratings (${fixed.distinct_attack_ratings.join(', ')}); the acceptance is ONE`);
  check(fixed.distinct_hp_max.length === 1,
    `FIXED arm produced ${fixed.distinct_hp_max.length} distinct hp_max — round 3's own invariant regressed`);
  check(fixed.plain_after && fixed.plain_after.attack_rating === fixed.declared_statblock_attack_rating,
    `FIXED arm: a plain drowned_lesser after ${CASTS} casts reads ${fixed.plain_after && fixed.plain_after.attack_rating} and the statblock declares ${fixed.declared_statblock_attack_rating}`);
  // THE CONTROL MUST GO RED. Two arms that agree are one experiment run twice (RULES.md #6).
  check(brokenArm.distinct_attack_ratings.length > 1,
    `INERT CONTROL: the BROKEN arm also produced one distinct attack rating (${brokenArm.distinct_attack_ratings.join(', ')}). The teardown did not reach the thing under test.`);
  check(brokenArm.plain_after && brokenArm.plain_after.attack_rating !== brokenArm.declared_statblock_attack_rating,
    'INERT CONTROL: the BROKEN arm left the statblock at its declared value, so the leak this fix removes was not present to remove');
}

const report = {
  schema: 'elder-souls/w1-14-r4-summon@1',
  commit: gitInfo().commit,
  casts: CASTS, magnitude: MAG,
  arms: { fixed, broken: brokenArm },
  control_is_live: !fails.some((f) => f.startsWith('INERT CONTROL')),
  pass: fails.length === 0,
  failures: fails,
};
writeJson(path.join(outDir, 'summon-alias.json'), report);
log(`FIXED   attack ratings: ${JSON.stringify(fixed.casts ? fixed.casts.map((c) => c.attack_rating) : fixed)}`);
log(`FIXED   hp_max:         ${JSON.stringify(fixed.casts ? fixed.casts.map((c) => c.hp_max) : '-')}`);
log(`FIXED   plain body after: ${JSON.stringify(fixed.plain_after)}   worst wound ${fixed.player_worst_wound_from_plain_body}, deaths ${fixed.player_deaths_to_plain_body}`);
log(`BROKEN  attack ratings: ${JSON.stringify(brokenArm.casts ? brokenArm.casts.map((c) => c.attack_rating) : brokenArm)}`);
log(`BROKEN  plain body after: ${JSON.stringify(brokenArm.plain_after)}   worst wound ${brokenArm.player_worst_wound_from_plain_body}, deaths ${brokenArm.player_deaths_to_plain_body}`);
for (const f of fails) log(`FAIL: ${f}`);
log(`report: ${path.join(outDir, 'summon-alias.json')}`);
process.exit(fails.length ? EXIT.MEASUREMENT_FAIL : 0);
