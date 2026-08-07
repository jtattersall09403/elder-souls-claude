#!/usr/bin/env node
// souls-ledger-oracle.mjs — THE INVARIANT, NOT THE INSTANCES.
//
// =================================================================================================
// WHY THIS TOOL EXISTS AND WHY IT DOES NOT NAME A ROUTE
// =================================================================================================
//
// `GAP-W1-souls-alive-keyed-on-eid` has been found three times, by three different people, on
// three different routes, and each time it was fixed where it was found:
//
//   1. `Engine.applyNamedState()` did not clear the souls ledger, so the same fight across a
//      scenario boundary paid `+384` and then `+0`.                        (W1-SOULS-r2 HF-1)
//   2. A post the player only PARTLY cleared was released and re-materialised under its stable
//      post-id tag, so five corpses' eids came back on five live full-HP hostiles worth nothing.
//                                                                          (W1-SOULS-r2 HF-2)
//   3. A save and a load reset the ledger AND the population table while `ordinaryRespawnEpoch`
//      stood still, so killing a post, saving, loading and killing it again paid in full,
//      without bound.                       (W1-POPULATION-r1 §2, found by that piece's critic)
//
// Round 2 fixed instance 1's *symptom* in its own instrument, by tagging its fights, and the
// verdict's summary of it is exact: it fixed the instance and not the class. Round 3 is not
// entitled to a fourth round of that. **A test that re-tests those three routes cannot find the
// fourth one**, and there will be a fourth one: every piece that learns to rebuild a body — a
// dungeon reset, a quest that re-stages an ambush, a fast-travel that streams a region out and
// back — opens a new one.
//
// So this tool asserts INVARIANTS over ARBITRARY EVENT SEQUENCES. It enumerates every route of
// length 3 over the world-event alphabet below, plus a seeded sample of longer ones, and after
// every single event it checks three properties that must hold on *any* route. It does not know
// what the three known instances are and it would find them if they had never been named.
//
// -------------------------------------------------------------------------------------------
// THE THREE INVARIANTS
// -------------------------------------------------------------------------------------------
//
//   I1  NO DOUBLE PAY          a body-life is paid for at most once.
//   I2  NO FREE KILL           a body-life that dies is paid for exactly once, at its statblock
//                              value x the night multiplier. Nothing dies for nothing.
//   I3  NO FREE RESURRECTION   an eid last observed DEAD is never observed ALIVE again unless
//                              `death.ordinaryRespawnEpoch` moved in between. This is ARBITRATION
//                              S5 and `RI-PRG06` §4 stated as a property of the world, and it is
//                              the WORLD's to keep, not the reward's.
//
// I1 and I2 are `game/src/sim/souls.js`'s. **I3 is not**, and separating them is the point of
// this tool. Round 2's epoch gate was the souls ledger trying to enforce I3 by refusing to pay —
// which is why it broke in the opposite direction the first time somebody tried a route it had
// not anticipated. A reward system cannot price a respawn it did not authorise. Once I3 is
// checked where it belongs, I1 and I2 become simple and route-independent, and the next instance
// of this class fails a named invariant in the open instead of being absorbed.
//
// -------------------------------------------------------------------------------------------
// WHY THE ORACLE IS INDEPENDENT OF THE THING IT MEASURES
// -------------------------------------------------------------------------------------------
//
// The oracle's notion of "a body's life" is derived from THE ROUTE IT DROVE, never from any
// engine field:
//
//   * `named_load`, `save`+`load` — `sim.reset()` empties `sim.entities`, so every body present
//     afterwards is, by construction, a new life. The oracle knows this because it issued the
//     event, not because the engine told it.
//   * `release` then `materialise` — the eid left the entity array and came back. New life.
//   * `rest` — `death.js respawnOrdinary()` revives bodies IN PLACE. Same life.
//
// So the oracle would still be correct if `sim/souls.js` were replaced wholesale, and it cannot
// pass by agreeing with the implementation. Its own falsifiability is checked by `--self-break`,
// which runs the identical routes with `SoulsSystem.enabled = false` and requires the run to go
// red; a pass there fails the tool.
//
// Run:  node tools/progression/souls-ledger-oracle.mjs
//       node tools/progression/souls-ledger-oracle.mjs --self-break
//       node tools/progression/souls-ledger-oracle.mjs --len 3 --samples 100 --out reports/x.json
'use strict';

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : d; };
const has = (k) => argv.includes(`--${k}`);
const say = (s) => console.log(s);

const LEN = Number(arg('len', 3));
const SAMPLES = Number(arg('samples', 120));
const LONG = Number(arg('long', 5));
const OUT = arg('out', 'reports/souls-ledger-oracle.json');
const SELF_BREAK = has('self-break');

// The world-event alphabet. Every one of these is something the SHIPPED world does to a body;
// none of them is a souls verb.
const ALPHABET = ['kill_some', 'kill_all', 'release', 'materialise', 'named_load', 'save_load', 'rest'];

function routesOfLength(n, alpha) {
  if (n === 0) return [[]];
  const shorter = routesOfLength(n - 1, alpha);
  const out = [];
  for (const s of shorter) for (const a of alpha) out.push([...s, a]);
  return out;
}

/** A tiny deterministic PRNG so the sampled long routes are reproducible and quotable. */
function mulberry(seed) {
  let a = seed >>> 0;
  return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

async function main() {
  const routes = routesOfLength(LEN, ALPHABET);
  const rnd = mulberry(20260807);
  const long = [];
  for (let i = 0; i < SAMPLES; i++) {
    const r = [];
    for (let j = 0; j < LONG; j++) r.push(ALPHABET[Math.floor(rnd() * ALPHABET.length)]);
    long.push(r);
  }
  const all = [...routes, ...long];
  say(`souls-ledger-oracle: ${routes.length} exhaustive routes of length ${LEN} over ${ALPHABET.length} world events`);
  say(`                     + ${long.length} seeded routes of length ${LONG}  =  ${all.length} routes`);
  if (SELF_BREAK) say('                     --self-break: SoulsSystem.enabled = false; a PASS here FAILS the tool');

  const { launchGame } = await import('../lib/browser.mjs');
  const handle = await launchGame({ width: 320, height: 240 });
  const page = handle.page;
  const pageErrors = [];
  page.on('pageerror', (e) => pageErrors.push(e.message));
  let R;
  try {
    await page.waitForFunction(() => !!window.__HARNESS && !!window.__ENGINE, null, { timeout: 90000 });
    await page.evaluate(() => window.__HARNESS.setRenderRate(0));
    R = await page.evaluate(async ({ all, SELF_BREAK }) => {
      const H = window.__HARNESS, E = window.__ENGINE;
      const TAG = 'oracle-post';
      const ENC = 'dres-raid-party';
      const souls = () => E.sim.progression.soulsHeld;
      const epoch = () => (E.death ? E.death.ordinaryRespawnEpoch : 0);
      const ents = () => E.sim.entities.filter((e) => e.eid.startsWith(TAG))
        .map((e) => ({ eid: e.eid, id: e.id, hp: e.hp, dead: e.hp <= 0 || e.state === 'DEAD' }));

      // The soul value the world says this archetype is worth, read from the engine's own data
      // rather than from the file, so the oracle checks the number the SIMULATION uses.
      const valueOf = (id) => {
        const st = E.data.enemies[id];
        const base = st && Number.isFinite(st.souls) ? st.souls : 0;
        const h = Number(E.sim.env && E.sim.env.timeOfDay);
        const night = Number.isFinite(h) && (h >= 21 || h < 5);
        return night ? Math.round(base * 1.35) : base;
      };

      const results = [];
      for (const route of all) {
        // ---- a clean world for every route ---------------------------------------------------
        H.loadState('arena_flat');
        // W1-POPULATION-r1 §7: `PopulationSystem.reset()` restores six fields and MISSES
        // `enabled`, so a suite that ablated the population earlier in the same page measures an
        // empty province and scores it a pass. This oracle never ablates it, and it says so out
        // loud rather than relying on the boundary: set it explicitly, every route.
        if (E.population) E.population.enabled = true;
        if (SELF_BREAK) E.sim.souls.enabled = false; else E.sim.souls.enabled = true;
        H.setTimeOfDay(12);                       // out of the night window: value == base
        H.spawnEncounter(ENC, 0, 12, { tag: TAG });
        // The scan is LAZILY SEEDED — a body already dead the first time it is looked at is
        // recorded as settled and never paid. Step once while everything is standing, or the
        // oracle measures the seeding rule instead of the ledger. (This cost the round-2 critic
        // a whole run; the note is kept here for the next person.)
        H.stepFrames(2);

        // ---- the oracle's OWN bookkeeping, derived from the route, never from the engine ------
        // lifeId: a monotonic counter per (eid). It advances when THE ROUTE destroyed the body.
        const life = new Map();      // eid -> { life, everDead, paidLives:Set, lastSeenDead }
        const touch = (eid) => { if (!life.has(eid)) life.set(eid, { life: 0, paidLives: new Set(), lastSeenDead: false }); return life.get(eid); };
        for (const e of ents()) { const r = touch(e.eid); r.lastSeenDead = e.dead; }
        const newLives = () => { for (const [, r] of life) r.life++; };

        const violations = [];
        const paidThisRoute = [];
        let restsSoFar = epoch();

        const observe = (label) => {
          const before = new Map([...life].map(([k, v]) => [k, { ...v, paidLives: new Set(v.paidLives) }]));
          const now = ents();
          for (const e of now) {
            const r = touch(e.eid);
            const prev = before.get(e.eid);
            // I3 — NO FREE RESURRECTION. An eid last seen dead is upright again. Legal only if
            // the S5 rest counter moved; that is the entire content of ARBITRATION S5 and of
            // RI-PRG06 §4's "Respawned enemy" row, and it is the WORLD's invariant.
            if (prev && prev.lastSeenDead && !e.dead && epoch() === restsSoFar) {
              violations.push({ inv: 'I3', eid: e.eid, after: label,
                note: 'an eid last observed dead is alive again with the rest epoch unmoved' });
            }
            r.lastSeenDead = e.dead;
          }
          restsSoFar = epoch();
        };

        // ---- drive the route ----------------------------------------------------------------
        let broke = null;
        for (const ev of route) {
          const before = souls();
          const standing = ents().filter((e) => !e.dead);
          try {
            if (ev === 'kill_some') {
              const victims = standing.slice(0, Math.max(1, standing.length - 1));
              for (const v of victims) H.killEntity(v.eid);
              H.stepFrames(4);
              const paid = souls() - before;
              const want = victims.reduce((a, v) => a + valueOf(v.id), 0);
              for (const v of victims) {
                const r = touch(v.eid);
                const key = r.life;
                // I1 — NO DOUBLE PAY.
                if (r.paidLives.has(key)) violations.push({ inv: 'I1', eid: v.eid, after: ev, note: 'this body-life was paid for twice' });
                r.paidLives.add(key);
              }
              // I2 — NO FREE KILL. Asserted in BOTH modes: `--self-break` disables the producer,
              // so `paid` is 0 against a non-zero `want` and this is exactly the line that must
              // go red. An oracle that exempts itself from its own break is not an oracle.
              if (paid !== want) {
                violations.push({ inv: 'I2', after: ev, paid, want,
                  eids: victims.map((v) => v.eid), note: 'live bodies died for the wrong number of souls' });
              }
              paidThisRoute.push({ ev, paid, want, n: victims.length });
            } else if (ev === 'kill_all') {
              for (const v of standing) H.killEntity(v.eid);
              H.stepFrames(4);
              const paid = souls() - before;
              const want = standing.reduce((a, v) => a + valueOf(v.id), 0);
              for (const v of standing) {
                const r = touch(v.eid); const key = r.life;
                if (r.paidLives.has(key)) violations.push({ inv: 'I1', eid: v.eid, after: ev, note: 'this body-life was paid for twice' });
                r.paidLives.add(key);
              }
              if (paid !== want) violations.push({ inv: 'I2', after: ev, paid, want, eids: standing.map((v) => v.eid), note: 'live bodies died for the wrong number of souls' });
              paidThisRoute.push({ ev, paid, want, n: standing.length });
            } else if (ev === 'release') {
              // What `PopulationSystem` step (3) does when the player walks past the release
              // radius: every body of the post leaves the entity array.
              for (const e of ents()) { try { H.despawn(e.eid); } catch { /* gone */ } }
              H.stepFrames(1);
            } else if (ev === 'materialise') {
              // What step (4) does: the SAME post id as the tag, which is what recycles the eids.
              try { H.spawnEncounter(ENC, 0, 12, { tag: TAG }); } catch { /* still resident */ }
              H.stepFrames(2);
              newLives();                       // the route rebuilt them: new bodies, by construction
            } else if (ev === 'named_load') {
              H.loadState('arena_flat');
              if (E.population) E.population.enabled = true;
              H.setTimeOfDay(12);
              try { H.spawnEncounter(ENC, 0, 12, { tag: TAG }); } catch { /* n/a */ }
              H.stepFrames(2);
              newLives();                       // sim.reset() emptied sim.entities
            } else if (ev === 'save_load') {
              const blob = H.saveState();
              H.loadState(blob);
              if (E.population) E.population.enabled = true;
              H.stepFrames(2);
              newLives();                       // applySave rebuilt every record through statFor
            } else if (ev === 'rest') {
              // The S5 event itself, called directly so the route does not depend on a hearth
              // being placed in an arena. `respawnOrdinary()` revives bodies IN PLACE — same
              // objects — which is the one case where a life does NOT advance.
              E.death.respawnOrdinary(E.sim, E.combat, E.bus, 'oracle_rest');
              E.death.ordinaryRespawnEpoch++;
              H.stepFrames(2);
            }
          } catch (err) { broke = `${ev}: ${String(err && err.message || err)}`; break; }
          observe(ev);
        }

        results.push({ route: route.join(' > '), violations, broke, paid: paidThisRoute,
          bodies: [...life.keys()].length });
      }
      return { results, states: Object.keys(E.data.states).length };
    }, { all, SELF_BREAK });
  } finally {
    await handle.close();
  }

  // ---- report --------------------------------------------------------------------------------
  const byInv = { I1: [], I2: [], I3: [] };
  let clean = 0, broke = 0;
  for (const r of R.results) {
    if (r.broke) { broke++; continue; }
    if (!r.violations.length) { clean++; continue; }
    for (const v of r.violations) (byInv[v.inv] = byInv[v.inv] || []).push({ route: r.route, ...v });
  }
  say('');
  say(`  routes driven          ${R.results.length}`);
  say(`  routes clean           ${clean}`);
  say(`  routes that threw      ${broke}`);
  for (const inv of ['I1', 'I2', 'I3']) {
    const n = byInv[inv].length;
    const uniq = [...new Set(byInv[inv].map((v) => v.route))];
    say(`  ${inv} violations         ${n}${n ? `  on ${uniq.length} distinct routes, e.g. "${uniq[0]}"` : ''}`);
  }

  const rep = {
    tool: 'souls-ledger-oracle', at: new Date().toISOString(), self_break: SELF_BREAK,
    alphabet: ALPHABET, exhaustive_length: LEN, sampled_length: LONG, sampled: SAMPLES,
    routes: R.results.length, clean, threw: broke,
    invariants: {
      I1: { statement: 'a body-life is paid for at most once', owner: 'game/src/sim/souls.js', violations: byInv.I1.length, examples: byInv.I1.slice(0, 8) },
      I2: { statement: 'a body-life that dies is paid exactly its statblock value x night', owner: 'game/src/sim/souls.js', violations: byInv.I2.length, examples: byInv.I2.slice(0, 8) },
      I3: { statement: 'an eid last observed dead is never observed alive again without the rest epoch moving', owner: 'game/src/world/population.js + engine.js loadState', violations: byInv.I3.length, examples: byInv.I3.slice(0, 8) },
    },
    page_errors: pageErrors.slice(0, 10),
    results: R.results,
  };
  fs.mkdirSync(path.dirname(path.join(ROOT, OUT)), { recursive: true });
  fs.writeFileSync(path.join(ROOT, OUT), JSON.stringify(rep, null, 2));
  say(`\n  wrote ${OUT}`);

  const anyRed = byInv.I1.length + byInv.I2.length + byInv.I3.length > 0 || broke > 0;
  if (SELF_BREAK) {
    // With the producer disabled, I2 CANNOT hold: bodies die and nothing is banked. A green run
    // here would mean the oracle is agreeing with itself, and that is a tool failure, not a pass.
    const red = byInv.I1.length + byInv.I2.length > 0;
    say(red
      ? '\n  --self-break: the oracle went RED with the producer disabled. It can fail.'
      : '\n  --self-break: the oracle stayed GREEN with the producer disabled. THE ORACLE IS BROKEN.');
    process.exit(red ? 0 : 1);
  }
  say(anyRed ? '\n  souls-ledger-oracle: VIOLATIONS ABOVE.' : '\n  souls-ledger-oracle: all three invariants hold on every route driven.');
  process.exit(anyRed ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(2); });
