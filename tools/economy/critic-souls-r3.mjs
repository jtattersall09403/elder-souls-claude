#!/usr/bin/env node
// critic-souls-r3.mjs — THE W1-SOULS ROUND-3 CRITIC'S OWN INSTRUMENT.
//
// Written with fresh context, shares no code with `tools/progression/souls-consumption.mjs` or
// `tools/progression/souls-ledger-oracle.mjs`, and declared under `method_deviations`.
//
// It answers two questions the builder's own suite cannot answer about itself:
//
//   D — CONSUMPTION (RI-MTH07, mandatory under ARBITRATION.md §3). For every value the soul
//       economy DECLARES, name the world-side consumer and prove it by PERTURBING THE MODEL and
//       watching an entity change behaviour. Four values are declared: the per-statblock `souls`
//       field, the night multiplier x1.35, the `souls_to_next` level curve, and the S15 line that
//       says a kill pays no gold and a level costs no gold. Each arm perturbs and each arm has a
//       control that must go the OTHER WAY.
//
//   X — DELETE-THE-FIX, AS A 2x2 (RULES 6). Round 3 shipped TWO fixes for one class:
//         identity  `sim/souls.js` keys `_alive` on the entity OBJECT (`rec.ref !== e`)
//         boundary  `engine.js _sessionObservers()` calls `sim.souls.reset()` at BOTH boundaries
//       The builder's own note says the identity key is "hygiene and not the mechanism" on one
//       side and "defence in depth today, not the mechanism" on the other. Neither claim can be
//       checked by removing one fix, because the OTHER one keeps the number green — which is
//       exactly how an inert fix passes. So this tool runs the SAME fixture under all four
//       states of {identity intact|ablated} x {boundary intact|ablated} and reports the number
//       each one pays. If the number only moves when BOTH are gone, neither is load-bearing
//       alone and the project is carrying two guards where it measured one.
//
// The ablations are SOURCE deletions applied by the caller (see the runner block in the verdict),
// not by this file: this tool never edits `game/`. It takes `--label` and records what it was
// told it is running under, so a mislabelled run is visible in the report rather than silent.
//
// SELF-BREAK: `--self-break` sets `sim.souls.enabled = false` and requires every paying arm to go
// to zero. A PASS under `--self-break` FAILS the tool (exit 3). A probe that cannot fail is worse
// than no probe (RULES 4).
//
// Run:  node tools/economy/critic-souls-r3.mjs --label INTACT
//       node tools/economy/critic-souls-r3.mjs --self-break
'use strict';

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : d; };
const has = (k) => argv.includes(`--${k}`);
const LABEL = arg('label', 'INTACT');
const SELF_BREAK = has('self-break');
const OUT = arg('out', `reports/critic-souls-r3-${SELF_BREAK ? 'SELFBREAK' : LABEL}.json`);
const say = (s) => console.log(s);

async function main() {
  say(`critic-souls-r3: label=${LABEL}${SELF_BREAK ? '  --self-break (a PASS here FAILS the tool)' : ''}`);
  const { launchGame } = await import('../lib/browser.mjs');
  const handle = await launchGame({ width: 320, height: 240 });
  const page = handle.page;
  const pageErrors = [];
  page.on('pageerror', (e) => pageErrors.push(e.message));
  let R;
  try {
    await page.waitForFunction(() => !!window.__HARNESS && !!window.__ENGINE, null, { timeout: 90000 });
    await page.evaluate(() => window.__HARNESS.setRenderRate(0));
    R = await page.evaluate(async ({ SELF_BREAK }) => {
      const H = window.__HARNESS, E = window.__ENGINE;
      const out = {};
      const souls = () => E.sim.progression.soulsHeld;
      const gold = () => E.sim.progression.gold;
      const arm = (id, fn) => { try { out[id] = fn(); } catch (e) { out[id] = { error: String(e && e.message || e) }; } };
      // A CHARACTER, ALWAYS. `arena_flat` ships without one, and `getDerivedStats()` answers
      // `{created:false}` when `sim.character` is null — so an arm that read the sheet without
      // writing a character down first would observe an EMPTY sheet and charge every attribute
      // whose effect lands on it. This cost me a run; the census of what the snapshot actually
      // saw is published in D3b (`derived_sheet_keys`) so the next reader does not have to trust
      // that I fixed it.
      const CH = { race: 'breton', upbringing: 'interior', class: 'sap-reader',
        birthsign: 'raj-xul', given_name: 'Unwritten', sex: 'unrecorded' };
      const fresh = (hour = 14) => {
        H.loadState('arena_flat'); H.setRenderRate(0); H.setTimeOfDay(hour);
        try { H.setCharacter(CH); } catch { /* already written down */ }
        if (E.population) E.population.enabled = true;
        E.sim.souls.enabled = !SELF_BREAK;
        E.sim.progression.soulsHeld = 0;
        H.stepFrames(2);
      };
      // One untagged six-body fight. NO unique tag: the tag is what hid HF-1 in round 2.
      const fight = (tag) => {
        const r = tag ? H.spawnEncounter('dres-raid-party', 0, 12, { tag })
          : H.spawnEncounter('dres-raid-party', 0, 12);
        H.stepFrames(2);                       // the scan is lazily seeded: step while they stand
        const before = souls();
        for (const eid of r.eids) { try { H.killEntity(eid); } catch { /* npc */ } }
        H.stepFrames(4);
        return { eids: r.eids, n: r.eids.length, paid: souls() - before,
          refused: E.sim.souls.refusedRearms, rebuilds: E.sim.souls.rebuilds };
      };

      // =========================================================================================
      // D — CONSUMPTION
      // =========================================================================================

      // D1  the per-statblock `souls` field. Consumer: sim/souls.js step() -> awardFor(stat).
      //     Perturb the MODEL (the number on the statblock the engine holds) and watch the purse.
      arm('D1_statblock_value', () => {
        fresh();
        const base = E.data.enemies.inf_trash.souls;
        const a = fight();                                       // at the shipped value
        fresh();
        E.data.enemies.inf_trash.souls = 999;                    // PERTURB
        const b = fight();
        fresh();
        E.data.enemies.inf_trash.souls = base;                   // CONTROL: restore
        const c = fight();
        return { shipped_value: base, at_shipped: a.paid, at_999: b.paid, restored: c.paid,
          bodies: a.n,
          consumer: 'game/src/sim/souls.js SoulsSystem.step() -> awardFor(stat, awardHour) -> sim.progression.soulsHeld',
          pass: a.paid === base * a.n && b.paid === 999 * b.n && c.paid === a.paid };
      });

      // D2  the night multiplier x1.35 (RI-PRG06 §4 / RI-PRG04 §2). Consumer: awardFor().
      //     THE ORACLE NEVER EXERCISES THIS — every one of its 463 routes sets 12:00 — so it is
      //     checked here or nowhere.
      arm('D2_night_multiplier', () => {
        fresh(14); const day = fight();
        fresh(23); const night = fight();
        fresh(4);  const small_hours = fight();
        const base = E.data.enemies.inf_trash.souls;
        const want_night = Math.round(base * 1.35) * night.n;
        return { day_1400: day.paid, night_2300: night.paid, night_0400: small_hours.paid,
          base, bodies: day.n, want_day: base * day.n, want_night,
          ratio: day.paid ? +(night.paid / day.paid).toFixed(4) : null,
          consumer: 'game/src/sim/souls.js isNight(env.awardTimeOfDay) -> awardFor()',
          pass: day.paid === base * day.n && night.paid === want_night && small_hours.paid === want_night };
      });

      // D3  the level curve. Consumer chain: soulsHeld -> Engine._spendSouls() -> prog.level,
      //     prog.attributes -> sim._poolsDirty -> the DERIVED STATS an entity fights with.
      //     RI-MTH07 wants an ENTITY to change behaviour, so this arm reads the player's derived
      //     pools before and after, not just the counter.
      arm('D3_level_curve_changes_the_player', () => {
        // A flat scalar census of everything the player IS, so "did an entity change behaviour"
        // is answered over the whole surface rather than over one field I guessed at.
        const snapshot = () => {
          const flat = {};
          const walk = (o, p) => {
            if (o === null || o === undefined) return;
            if (typeof o === 'number') { flat[p] = o; return; }
            if (typeof o !== 'object') return;
            for (const k of Object.keys(o)) walk(o[k], p ? `${p}.${k}` : k);
          };
          walk(H.getDerivedStats(), 'derived');
          const b = E.combat && E.combat.player;
          if (b) walk({ hp: b.hp, hpMax: b.hpMax, stamina: b.stamina, staminaMax: b.staminaMax,
            poise: b.poise, attack: b.attackRating, armour: b.armourRating }, 'body');
          walk(E.sim.progression.attributes, 'attr');
          return flat;
        };
        fresh();
        const declared = E.attributeIds ? E.attributeIds() : [];
        const lvl0 = E.sim.progression.level;
        const cost = E.soulsToNextLevel();
        // THE FIRST LEVEL IS PAID FOR BY KILLING, NOT BY ASSIGNMENT. My first version of this
        // arm wrote `soulsHeld = cost` and it PASSED under `--self-break`, which is the arm
        // proving the spend side while proving nothing about the source. The self-break gate
        // caught it. Two six-body fights at 42 = 504 >= the 418 the first level costs.
        // The second fight is TAGGED — not to hide anything, but because `spawnEncounter()` is
        // not atomic and throws on a duplicate eid when the first fight's corpses are still in
        // the world (the non-atomicity round 3 found and made `_materialise` idempotent around).
        const earn1 = fight(); const earn2 = fight('earn2');
        const earned = earn1.paid + earn2.paid;
        // CONTROL FIRST: one soul short must refuse, and must not debit.
        E.sim.progression.soulsHeld = Math.min(earned, cost - 1);
        const refused = E._spendSouls(declared[0]);
        const held_after_refusal = souls();
        // CONTROL 2: an attribute the sheet does not declare must be refused too.
        const bogus = E._spendSouls('__not_an_attribute__');
        // Then buy ONE LEVEL PER DECLARED ATTRIBUTE and record what each one reached.
        const perAttr = [];
        for (const a of declared) {
          const before = snapshot();
          E.sim.progression.soulsHeld = E.soulsToNextLevel();
          const spentCost = E.soulsToNextLevel();
          const ok = E._spendSouls(a);
          H.stepFrames(4);
          const after = snapshot();
          const moved = [];
          for (const k of Object.keys(after)) {
            if (before[k] !== undefined && after[k] !== before[k] && !k.startsWith('attr.')) {
              moved.push({ stat: k, before: before[k], after: after[k] });
            }
          }
          perAttr.push({ attribute: a, cost: spentCost, spent: ok === true,
            attribute_value: E.sim.progression.attributes[a],
            derived_moved: moved.length, moved: moved.slice(0, 6) });
        }
        const inert = perAttr.filter((p) => p.spent && p.derived_moved === 0).map((p) => p.attribute);
        return { cost_of_first_level: cost, declared_attributes: declared,
          souls_earned_by_killing: earned, funded_by_kills: earned >= cost,
          level_before: lvl0, level_after: E.sim.progression.level,
          refused_when_one_short: refused === false, held_after_refusal,
          refused_undeclared_attribute: bogus === false,
          per_attribute: perAttr,
          attributes_that_buy_a_level_and_move_nothing: inert,
          levels_bought: perAttr.filter((p) => p.spent).length,
          levels_that_moved_a_derived_number: perAttr.filter((p) => p.derived_moved > 0).length,
          consumer: 'game/src/engine.js _spendSouls() -> prog.level/attributes -> sim._poolsDirty -> applyDerivedPools() -> the combat body',
          pass: earned >= cost && refused === false && held_after_refusal === cost - 1 && bogus === false
            && E.sim.progression.level === lvl0 + declared.length
            // THE SOUL ECONOMY'S OBLIGATION, AND ONLY IT: souls bought a level and the level
            // reached the body. WHICH attributes reach what is RI-PRG02 / W1-21's axis and is
            // reported in D3b rather than charged here.
            && perAttr.some((p) => p.derived_moved > 0) };
      });

      // D3b  IS IT THE PATH OR THE ATTRIBUTE? D3 buys ONE point per attribute, so an attribute
      //      whose effect is quantised coarser than +1 would read as inert when it is not. This
      //      arm sets each attribute directly to +15 — no souls, no level-up — and asks the same
      //      question. An attribute that moves nothing at +15 reaches nothing at all; one that
      //      moves only here is a level-up propagation defect. The distinction decides who owns it.
      arm('D3b_attribute_reach_at_plus_15', () => {
        const flat = () => {
          const f = {};
          const walk = (o, p) => {
            if (o === null || o === undefined) return;
            if (typeof o === 'number') { f[p] = o; return; }
            if (typeof o !== 'object') return;
            for (const k of Object.keys(o)) walk(o[k], p ? `${p}.${k}` : k);
          };
          walk(H.getDerivedStats(), 'derived');
          const b = E.combat && E.combat.player;
          if (b) walk({ hp: b.hp, hpMax: b.hpMax, stamina: b.stamina, staminaMax: b.staminaMax,
            poise: b.poise, attack: b.attackRating, armour: b.armourRating }, 'body');
          return f;
        };
        const declared = E.attributeIds ? E.attributeIds() : [];
        const rows = [];
        for (const a of declared) {
          fresh();
          const before = flat();
          const base = E.sim.progression.attributes[a];
          E.sim.progression.attributes[a] = base + 15;
          E.sim._poolsDirty = true;
          H.stepFrames(4);
          const after = flat();
          const moved = [];
          for (const k of Object.keys(after)) if (before[k] !== undefined && after[k] !== before[k]) moved.push(k);
          rows.push({ attribute: a, from: base, to: base + 15, derived_moved: moved.length, moved: moved.slice(0, 8) });
        }
        const dead = rows.filter((r) => r.derived_moved === 0).map((r) => r.attribute);
        // THE INSTRUMENT'S OWN COVERAGE, PUBLISHED. `getDerivedStats()` returns
        // `{created:false}` when `sim.character` is null, and an arm that silently observed only
        // the combat body would charge every attribute whose effect lands on the sheet. So the
        // key census goes in the report and the arm refuses to convict on a thin snapshot.
        fresh();
        const keys = Object.keys(flat());
        const derivedKeys = keys.filter((k) => k.startsWith('derived.'));
        const sheet = H.getDerivedStats();
        return { rows, attributes_that_reach_nothing_even_at_plus_15: dead,
          snapshot_keys: keys.length, derived_sheet_keys: derivedKeys.length,
          character_created: !(sheet && sheet.created === false),
          derived_sheet_why: sheet && sheet._why || null,
          sample_derived_keys: derivedKeys.slice(0, 25),
          coverage_ok: derivedKeys.length > 5,
          // REPORTED, NOT ASSERTED, AND THE REACH IS DECLARED. This snapshot is the derived
          // sheet plus the combat body. It does NOT cover movement speed, disposition, loot or
          // the skill-use curve, which is where agility/speed/personality/luck would land if
          // they land anywhere. So `dead` means "reaches nothing THIS ARM CAN SEE", not
          // "reaches nothing". It is RI-PRG02 / W1-21's axis; it is here because the soul
          // economy's only sink is a level and somebody should know what a level buys.
          reported_not_asserted: true,
          reach: 'getDerivedStats() + the combat body. NOT movement, disposition, loot or skills.',
          pass: derivedKeys.length > 5 };
      });

      // D4  S15 / the project rule. Souls are levelling only; gold is the currency.
      //     Two directions, both perturbed:
      //       (a) a kill must move NO gold, and the event must say so.
      //       (b) a purse full of gold must NOT buy a level.
      arm('D4_doctrine_souls_never_buy_gold_never_levels', () => {
        fresh();
        E.setGold ? E.setGold(0) : (E.sim.progression.gold = 0);
        const g0 = gold();
        H.traceStart ? null : null;
        const f = fight();
        const g1 = gold();
        // (b) PERTURB: 100,000 gold, zero souls, ask for a level.
        fresh();
        if (E.setGold) E.setGold(100000); else E.sim.progression.gold = 100000;
        E.sim.progression.soulsHeld = 0;
        const lvl = E.sim.progression.level;
        const bought = E._spendSouls('strength');
        return { gold_before_kill: g0, gold_after_kill: g1, souls_from_kill: f.paid,
          gold_moved_by_a_kill: g1 - g0,
          gold_held: gold(), level_before: lvl, level_after: E.sim.progression.level,
          gold_bought_a_level: bought === true, gold_after_attempt: gold(),
          refusal: E._lastSpendRefusal || null,
          pass: (g1 - g0) === 0 && f.paid > 0 && bought === false
            && E.sim.progression.level === lvl && gold() === 100000 };
      });

      // D5  the ablation switch itself, and the prop floor. A prop at `souls: 0` must be
      //     unfarmable; the scan must still SETTLE it (so it cannot be re-sold later).
      arm('D5_props_and_the_switch', () => {
        fresh();
        const decl = E.data.enemies.dummy_passive.souls;
        const r = H.spawn('dummy_passive', 0, 6);
        const eid = typeof r === 'string' ? r : (r && (r.eid || r.id));
        H.stepFrames(2);
        const b0 = souls();
        H.killEntity(eid);
        H.stepFrames(4);
        return { declared_souls: decl, eid, paid: souls() - b0,
          pass: decl === 0 && souls() - b0 === 0 };
      });

      // =========================================================================================
      // X — THE BOUNDARY FIXTURE. The number this whole 2x2 turns on.
      // =========================================================================================
      //
      // Round 2 measured this exact shape at +384 then +0 (its own encounter). Round 3 measures
      // +252 then +252. The fight is UNTAGGED, so both passes mint the SAME eids; whether the
      // second pass is paid is decided by the identity key, the boundary reset, or neither.
      arm('X_boundary_same_eids_twice', () => {
        fresh();
        const pass1 = fight();
        H.loadState('arena_flat'); H.setTimeOfDay(14);
        E.sim.souls.enabled = !SELF_BREAK;
        const entities_after = (H.listEntities() || []).length;
        const pass2 = fight();
        return { pass1_paid: pass1.paid, pass2_paid: pass2.paid,
          same_eids: JSON.stringify(pass1.eids) === JSON.stringify(pass2.eids),
          entities_after_boundary: entities_after, hearth_rests: 0,
          refused_rearms: pass2.refused, rebuilds: pass2.rebuilds,
          observer_census: E.getSessionObserverCensus ? E.getSessionObserverCensus().map((o) =>
            ({ id: o.id, named: o.clears_on_named_state, save: o.clears_on_save_load, dirt: o.dirt })) : null,
          pass: pass1.paid > 0 && pass2.paid === pass1.paid };
      });

      // X2 — the same question at the OTHER boundary: save + load, same eids.
      arm('X_save_load_same_eids', () => {
        fresh();
        const pass1 = fight();
        H.saveState ? H.saveState('critic-r3') : null;
        H.loadState('arena_flat'); H.setTimeOfDay(14);
        E.sim.souls.enabled = !SELF_BREAK;
        const pass2 = fight();
        return { pass1_paid: pass1.paid, pass2_paid: pass2.paid,
          same_eids: JSON.stringify(pass1.eids) === JSON.stringify(pass2.eids),
          pass: pass1.paid > 0 && pass2.paid === pass1.paid };
      });

      // X3 — a body REVIVED IN PLACE by the S5 rest path is the one case the epoch gate still
      //      governs, and it must NOT be paid twice without a rest. This is the arm that goes the
      //      other way from X: it must be +N, then +0, then +N after ONE rest.
      arm('X_rest_epoch_still_gates_a_revived_body', () => {
        fresh();
        const a = fight();
        const before = souls();
        H.stepFrames(4);
        const b = souls() - before;                      // no rest: nothing more
        let rested = null, after_rest = null;
        try {
          const eids = a.eids;
          H.setAtHearth ? H.setAtHearth(true) : null;
          rested = H.hearthRest ? H.hearthRest() : null;
          H.stepFrames(6);
          const c0 = souls();
          for (const eid of eids) { try { H.killEntity(eid); } catch { /* gone */ } }
          H.stepFrames(4);
          after_rest = souls() - c0;
        } catch (e) { rested = { error: String(e && e.message || e) }; }
        return { first_pay: a.paid, without_rest: b, after_one_rest: after_rest,
          refused_rearms: E.sim.souls.refusedRearms, rested,
          pass: a.paid > 0 && b === 0 };
      });

      return out;
    }, { SELF_BREAK });
  } finally {
    await handle.close();
  }

  // ---- verdicts --------------------------------------------------------------------------------
  const paying = ['D1_statblock_value', 'D2_night_multiplier', 'D3_level_curve_changes_the_player',
    'D4_doctrine_souls_never_buy_gold_never_levels', 'X_boundary_same_eids_twice',
    'X_save_load_same_eids', 'X_rest_epoch_still_gates_a_revived_body'];
  const rows = [];
  for (const k of Object.keys(R)) rows.push({ arm: k, pass: R[k] && R[k].pass === true, error: R[k] && R[k].error || null });
  const passed = rows.filter((r) => r.pass).length;

  const out = { tool: 'critic-souls-r3', label: LABEL, self_break: SELF_BREAK,
    at: new Date().toISOString(), page_errors: pageErrors, arms: R, rows, passed, of: rows.length };

  fs.mkdirSync(path.join(ROOT, path.dirname(OUT)), { recursive: true });
  fs.writeFileSync(path.join(ROOT, OUT), JSON.stringify(out, null, 1));
  for (const r of rows) say(`  ${r.pass ? 'PASS' : 'FAIL'}  ${r.arm}${r.error ? '  ERROR ' + r.error : ''}`);
  say(`critic-souls-r3 [${LABEL}]: ${passed}/${rows.length} -> ${OUT}`);

  if (SELF_BREAK) {
    // Under the ablation every PAYING arm must have gone red. A pass here fails the tool.
    const stillPaying = paying.filter((k) => R[k] && R[k].pass === true);
    if (stillPaying.length) {
      console.error(`SELF-BREAK FAILED: ${stillPaying.length} paying arm(s) still PASS with `
        + `sim.souls.enabled = false: ${stillPaying.join(', ')}. The instrument is measuring `
        + 'something other than this module.');
      process.exit(3);
    }
    say('self-break: every paying arm went red. The instrument can fail.');
    process.exit(0);
  }
  process.exit(passed === rows.length ? 0 : 1);
}

main().catch((e) => { console.error('critic-souls-r3 threw:', e && e.stack || e); process.exit(2); });
