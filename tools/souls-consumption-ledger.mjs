#!/usr/bin/env node
// WHICH LEDGER DOES A KILL CONSULT? — CONSUMPTION (RI-MTH07 §B, mandatory under ARBITRATION.md §3)
// for the two soul ledgers reconciled by W1-SOULS-LEDGER.
//
// The piece ships one reconciliation across two models, so RI-MTH07 wants a named world-side
// consumer for EACH of them and an entity whose behaviour changes when each is perturbed:
//
//   L1  THE STATBLOCK LEDGER — `game/data/combat/enemies/*.json` `souls`
//       consumer: `game/src/sim/souls.js` SoulsSystem.step() -> `awardFor(this.d[e.id], awardHour)`
//                 -> `sim.progression.soulsHeld += a.souls`, on the alive->dead transition.
//                 `this.d` IS `Engine.data.enemies` (engine.js:498). This is the only producer of
//                 souls in the build.
//
//   L2  THE CACHED ROLL-UP — `game/data/world/population-posts.json` `post.souls`
//       consumer: `game/src/world/population.js` Population.report() ->
//                 `souls_total = sum(p.souls)`, published by `__HARNESS.populationReport()`.
//                 That is its ONE runtime reader. `grep -rn "\.souls" game/src` finds no other.
//
// The whole defect this piece exists to close is that those two paths never meet. So the arms
// below are deliberately arranged as a 2x2, and the two OFF-DIAGONAL arms are the finding:
//
//                      | perturb L1 (statblock)      | perturb L2 (cached post.souls)
//   ------------------ | --------------------------- | ------------------------------
//   a real kill pays   | MOVES     (arm A)           | does NOT move  (arm D)  <- the defect
//   populationReport() | does NOT move  (arm C)      | MOVES     (arm B)       <- the defect
//
// Arm A and arm B are the two CONSUMPTION demonstrations RI-MTH07 asks for. Arms C and D are what
// makes them mean something: each ledger is deaf to the other, which is exactly why they could
// drift 53% apart for a day with every probe in the project passing honestly.
//
// Arm E is the one the brief names: **which one does an actual kill consult?** It materialises a
// REAL population post through the shipping streamer (not a bare `spawnEncounter`), lies to that
// post's cached `souls` field, kills its bodies, and reads what the player was paid. The cache
// says one thing, the statblocks say another, and the money follows the statblocks.
//
// Arm F is the falsifiability gate (RULES 4): with `sim.souls.enabled = false` every paying arm
// must go to zero. If a paying arm survives the ablation it was not measuring `sim/souls.js` and
// this tool FAILS ITSELF rather than reporting a pass.
//
//   node tools/souls-consumption-ledger.mjs [--out reports/w1-souls-ledger/consumption.json]
//
// Exit 0 every arm as specified, 1 an arm failed, 2 the instrument could not run.
'use strict';

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { launchGame } from './lib/browser.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : d; };
const OUT = arg('out', 'reports/w1-souls-ledger/consumption.json');

const say = (s) => console.log(s);
const out = { tool: 'tools/souls-consumption-ledger.mjs', at: new Date().toISOString(), arms: {}, verdicts: [] };

const handle = await launchGame({ width: 320, height: 240 });
const page = handle.page;
page.on('pageerror', (e) => say(`  [pageerror] ${e.message}`));

try {
  await page.waitForFunction(() => !!window.__HARNESS && !!window.__ENGINE, null, { timeout: 90000 });
  await page.evaluate(() => window.__HARNESS.setRenderRate && window.__HARNESS.setRenderRate(0));

  const R = await page.evaluate(async () => {
    const H = window.__HARNESS, E = window.__ENGINE;
    const r = { notes: [] };

    H.setCharacter({ race: 'saxhleel', upbringing: 'lukiul', class: 'ledger-hand', birthsign: 'raj-xul' });
    H.stepFrames(2);
    // Day, so no arm is accidentally reading the night x1.35 term. That term belongs to the souls
    // piece and this one is not re-tuning anything.
    H.setTimeOfDay(12);

    const held = () => E.sim.progression.soulsHeld;
    const popSouls = () => { const rep = H.populationReport(); return rep ? rep.souls_total : null; };

    /** Spawn a named encounter well away from anything, kill every body, return what it paid. */
    let tagN = 0;
    const fightEncounter = (id, x, z) => {
      const before = held();
      const res = E.spawnEncounter(id, x, z, { tag: `probe-${++tagN}` });
      H.stepFrames(2);
      for (const eid of res.eids) { try { H.killEntity(eid); } catch { /* already gone */ } }
      H.stepFrames(3);
      const paid = held() - before;
      for (const eid of res.eids) { try { H.despawn(eid); } catch { /* fine */ } }
      H.stepFrames(1);
      return { paid, bodies: res.eids.length };
    };

    // ---- what the two ledgers say, before anything is touched --------------------------------
    const ENC = 'dres-raid-party';                       // 6 x inf_trash
    const sbBase = E.data.enemies.inf_trash.souls;
    r.baseline = {
      statblock_inf_trash_souls: sbBase,
      population_report_souls_total: popSouls(),
      population_posts: (E.population && E.population.posts.length) || 0,
    };

    // ================= ARM A — L1's consumer: a kill reads the statblock ledger ================
    const a0 = fightEncounter(ENC, 3000, 3000);
    const popBeforeA = popSouls();
    E.data.enemies.inf_trash.souls = 999;
    const a1 = fightEncounter(ENC, 3040, 3000);
    const popAfterA = popSouls();
    E.data.enemies.inf_trash.souls = sbBase;
    const a2 = fightEncounter(ENC, 3080, 3000);
    r.armA = {
      consumer: 'game/src/sim/souls.js SoulsSystem.step() -> awardFor(Engine.data.enemies[e.id]) -> sim.progression.soulsHeld',
      bodies: a0.bodies,
      paid_at_42: a0.paid, paid_at_999: a1.paid, paid_restored: a2.paid,
      expect_at_42: 6 * sbBase, expect_at_999: 6 * 999,
      pass: a0.paid === 6 * sbBase && a1.paid === 6 * 999 && a2.paid === 6 * sbBase,
    };

    // ================= ARM C — the cache is DEAF to the statblock perturbation =================
    r.armC = {
      consumer_probed: 'game/src/world/population.js report() -> souls_total',
      souls_total_before_statblock_perturbation: popBeforeA,
      souls_total_after_statblock_perturbation: popAfterA,
      pass: popBeforeA === popAfterA && popBeforeA !== null,
      why: 'The cached roll-up did not notice that every inf_trash in the province had become worth 999. THIS is the defect: the cache cannot learn from the ledger that pays.',
    };

    // ================= ARM B — L2's consumer: populationReport() reads the cache ===============
    if (E.population && E.population.posts.length) {
      const p0 = E.population.posts[0];
      const cachedBefore = p0.souls;
      const totalBefore = popSouls();
      p0.souls = cachedBefore + 1000;
      const totalAfter = popSouls();
      // control: does a real kill notice? (arm D)
      const dPaid = fightEncounter(ENC, 3120, 3000).paid;
      p0.souls = cachedBefore;
      const totalRestored = popSouls();
      r.armB = {
        consumer: 'game/src/world/population.js Population.report() -> souls_total, via __HARNESS.populationReport()',
        post: p0.id, cached_souls_before: cachedBefore, cached_souls_perturbed: cachedBefore + 1000,
        souls_total_before: totalBefore, souls_total_after: totalAfter, souls_total_restored: totalRestored,
        pass: totalAfter === totalBefore + 1000 && totalRestored === totalBefore,
      };
      r.armD = {
        paid_by_a_real_kill_while_the_cache_lied: dPaid,
        expect: 6 * sbBase,
        pass: dPaid === 6 * sbBase,
        why: 'A post in the cache was told it was worth 1000 more. The player was paid exactly the statblock figure. A kill does not consult the cache.',
      };
    } else {
      r.armB = { pass: false, why: 'no population posts loaded — cannot probe the cache consumer' };
      r.armD = { pass: false, why: 'ditto' };
    }

    // ============ ARM E — a REAL population post, materialised by the shipping streamer ========
    // The decisive arm the brief asks for: which ledger does an actual kill consult?
    r.armE = { pass: false, why: 'not reached' };
    if (E.population && E.population.posts.length) {
      // Find a post whose template is entirely made of statblocks we can price, and stand on it.
      const post = E.population.posts.find((p) => p.bodies > 0 && p.souls > 0);
      if (post) {
        H.teleport(post.x, post.z);
        // The streamer materialises at most one post per fixed step; give it room.
        for (let i = 0; i < 60 && !(E.population.live.has(post.id)); i++) H.stepFrames(4);
        const eids = E.population.live.get(post.id) || [];
        if (eids.length) {
          // What the two ledgers each claim this post is worth, right now.
          const cachedClaim = post.souls;
          const statblockClaim = eids.reduce((a, eid) => {
            const e = E.sim.findEntity(eid);
            const st = e && E.data.enemies[e.id];
            return a + (st && Number.isFinite(st.souls) ? st.souls : 0);
          }, 0);
          // Now LIE to the cache — the exact shape of the stale file, made worse on purpose.
          post.souls = cachedClaim * 3 + 7;
          const before = held();
          for (const eid of eids) { try { H.killEntity(eid); } catch { /* gone */ } }
          H.stepFrames(4);
          const paid = held() - before;
          post.souls = cachedClaim;
          r.armE = {
            post: post.id, encounter: post.encounter, bodies: eids.length,
            cache_claimed: cachedClaim * 3 + 7,
            statblocks_claimed: statblockClaim,
            actually_paid: paid,
            pass: paid === statblockClaim && paid !== cachedClaim * 3 + 7,
            why: 'A post the shipping streamer put in the world, killed by the shipping kill path. The cache was lying by 3x and the player was paid the statblock sum to the soul.',
          };
        } else {
          r.armE = { pass: false, why: `post ${post.id} never materialised after 240 frames` };
        }
      }
    }

    // ================= ARM F — falsifiability. Every paying arm must go red. ===================
    E.sim.souls.enabled = false;
    const fPaid = fightEncounter(ENC, 3160, 3000).paid;
    E.sim.souls.enabled = true;
    const fPaidBack = fightEncounter(ENC, 3200, 3000).paid;
    r.armF = {
      paid_with_souls_disabled: fPaid, paid_with_souls_reenabled: fPaidBack,
      expect: [0, 6 * sbBase],
      pass: fPaid === 0 && fPaidBack === 6 * sbBase,
      why: 'If a paying arm survives sim.souls.enabled=false it was never reading sim/souls.js and every arm above is void.',
    };

    r.final = {
      statblock_inf_trash_souls: E.data.enemies.inf_trash.souls,
      population_report_souls_total: popSouls(),
    };
    return r;
  });

  out.arms = R;
  const arms = ['armA', 'armB', 'armC', 'armD', 'armE', 'armF'];
  const labels = {
    armA: 'A  L1 consumed: a kill reads the statblock ledger (42 -> 999 -> 42)',
    armB: 'B  L2 consumed: populationReport().souls_total reads the cached roll-up',
    armC: 'C  cross-control: the cache is deaf to a statblock change',
    armD: 'D  cross-control: a kill is deaf to a cache change',
    armE: 'E  a real streamed post, killed: the money follows the statblocks',
    armF: 'F  falsifiability: souls disabled -> every paying arm goes to zero',
  };

  say('');
  say(`baseline: inf_trash.souls = ${R.baseline.statblock_inf_trash_souls}; populationReport().souls_total = ${R.baseline.population_report_souls_total} over ${R.baseline.population_posts} posts`);
  say('');
  let failed = 0;
  for (const k of arms) {
    const a = R[k] || { pass: false, why: 'arm missing' };
    if (!a.pass) failed++;
    say(`  ${a.pass ? 'PASS' : 'FAIL'}  ${labels[k]}`);
    for (const [kk, vv] of Object.entries(a)) {
      if (kk === 'pass' || kk === 'why' || kk === 'consumer' || kk === 'consumer_probed') continue;
      say(`          ${kk}: ${JSON.stringify(vv)}`);
    }
    if (a.consumer) say(`          consumer: ${a.consumer}`);
    if (a.why) say(`          ${a.why}`);
    out.verdicts.push({ arm: k, label: labels[k], pass: !!a.pass });
  }
  say('');

  const dest = path.join(ROOT, OUT);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, JSON.stringify(out, null, 1) + '\n');
  say(`wrote ${OUT}`);

  if (failed) { say(`souls-consumption-ledger: ${failed} arm(s) FAILED.`); process.exit(1); }
  say('souls-consumption-ledger: every arm as specified. Both ledgers have a named, demonstrated world-side consumer — and neither can see the other.');
} catch (e) {
  console.error('souls-consumption-ledger: instrument could not run —', e && e.message);
  console.error(e && e.stack);
  process.exit(2);
} finally {
  await handle.close();
}
