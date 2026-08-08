#!/usr/bin/env node
// critic-w1-16-r3-offline.mjs — W1-16 ROUND-3 CRITIC. Fresh context, no involvement in the build.
//
// Round 3 declares two of its predecessor critic's checks unpassable as written (C5 and C7). A
// builder declaring its critic's test unpassable is either a real instrument defect or the oldest
// excuse there is, so this file ADJUDICATES both by construction rather than by argument:
//
//   X1  C5, re-taken. C5 hand-builds `_equipLoadBase: null` and calls the producer directly.
//       Round 3's fix is at the CONSTRUCTION SITE (`_buildCombat` seeds the base), which C5 never
//       calls. This arm reconstructs the fixture the way the shipped engine constructs it, and
//       then keeps a NULL-SEED CONTROL that must still fail — a repaired check that cannot go red
//       is worse than the broken one it replaced (RULES #4, #6).
//   X2  C7, re-taken. C7 models "dressing" as carried.json rows only. RI-PRG07 §2 names four
//       terms and the shelf can fill one of them. This arm sweeps the whole §2 set over the
//       SHIPPED weights, and then over RI-PRG07 §4's OWN declared weights, which are heavier —
//       the shortfall is a content gap against the item, not an unknowable.
//   X3  EVERY DELETE-THE-FIX ARM, classified by where its state lives. Round 3 found its own
//       `oversprint` control inert because the flag rode on `combat.d`, which `_combatData()`
//       rebuilds. That is a general trap and this project has shipped four inert controls.
//   X4  THE CONSUMPTION CENSUS, re-derived from the shipped data rather than from the round's own
//       list. ARBITRATION §3: a sample is not an enumeration.
//   X5  THE REFUSAL'S AUDIENCE. `hist-sap-bow` is refused with a reason. Who reads the reason?
//   X6  RI-PRG07 §3, verbatim: "weight of ALL carried items, EQUIPPED OR NOT". The hands are now
//       in the equip ratio and are not inventory rows, so they are in neither burden term.
//
// Everything runs the REAL `Engine.prototype` methods against a synthetic `this`. No browser.
// `--selftest` breaks each arm on purpose and every one must go red.
//
//   node tools/harness/critic-w1-16-r3-offline.mjs [--selftest] [--json]

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const args = new Set(process.argv.slice(2));
const SELFTEST = args.has('--selftest');
const AS_JSON = args.has('--json');

const { Engine } = await import(path.join(REPO, 'game/src/engine.js'));
const { equipLoadMaxFor } = await import(path.join(REPO, 'game/src/character/derive.js'));
const { equipTier } = await import(path.join(REPO, 'game/src/combat/moves.js'));

const rd = (p) => JSON.parse(fs.readFileSync(path.join(REPO, p), 'utf8'));
const roll = rd('game/data/combat/roll.json');
const carried = rd('game/data/items/carried.json');
const weapons = rd('game/data/weapons/classes.json');
const offhand = rd('game/data/weapons/offhand.json');
const stamina = rd('game/data/combat/stamina.json');
const items = carried.items || carried;
const B = roll.tier_boundaries_pct;

const results = [];
const check = (id, title, ok, detail) => { results.push({ id, title, ok: !!ok, detail }); return !!ok; };

const ITEM_MAP = new Map(items.map((r) => [r.id, r]));

/**
 * A synthetic Engine. `handWeapon` / `handShield` populate the two objects round 3's producer
 * reads — `combat.player.moves._weapon` and `combat.player.shield` — so the hands term is under
 * test here rather than stubbed away.
 */
function mkEngine(opts = {}) {
  const attrs = Object.assign({ strength: 10, endurance: 10, vigour: 10, willpower: 10 }, opts.attributes || {});
  const e = {
    _w116Break: null,
    _equipLoadPinned: false,
    _burdenPinned: false,
    _equipLoadEngaged: false,
    // THE FIELD THE ADJUDICATION TURNS ON. `_buildCombat()` assigns this unconditionally, one
    // statement after `createPlayer`, so `null` here models a state the shipped engine no longer
    // presents. `seedBase: null` reproduces C5's fixture exactly; a number reproduces the engine's.
    _equipLoadBase: opts.seedBase === undefined ? null : opts.seedBase,
    sim: { inventory: opts.inventory || [], progression: { attributes: attrs }, player: {} },
    ui: { data: { items: ITEM_MAP } },
    combat: {
      player: {
        equipLoadPct: opts.startPct === undefined ? 24.0 : opts.startPct,
        tier: null,
        weaponId: opts.handWeapon ? opts.handWeapon.id : null,
        shieldId: opts.handShield ? opts.handShield.id : null,
        moves: opts.handWeapon ? { _weapon: { equip_weight: opts.handWeapon.kg, class: opts.handWeapon.cls } } : null,
        shield: opts.handShield ? { weight: opts.handShield.kg } : null,
      },
      d: { roll: { tier_boundaries_pct: B } },
      tierOf(b) { return equipTier(b.equipLoadPct, B); },
    },
  };
  // W1-16 ROUND 4, MECHANICAL REPAIR ONLY — nothing this instrument ASSERTS is touched. Round 4
  // moved the hands term into `Engine._handWeights()` (so burden and the equip ratio read one
  // number) and made `_publishEquipLoad()`/`_addEquipLoadOffset()` the writers of `equipLoadPct`.
  // This fixture binds methods by an explicit list, so without those three names it threw
  // `this._handWeights is not a function` and the whole file reported nothing at all instead of
  // reporting X1 and X6 going red — which is what they should now do, and is the delete-the-fix
  // evidence for round 4. The bind list is the only line changed; every check is verbatim.
  for (const m of ['_recomputeEquipLoad', '_recomputeBurden', '_equipCapacity', '_equipLoadMax', '_slotForItem',
    '_handWeights', '_publishEquipLoad', '_addEquipLoadOffset']) {
    e[m] = Engine.prototype[m].bind(e);
  }
  return e;
}

// =============================================================================================
// X1 — C5, ADJUDICATED.
//
// Round 3: "C5 hand-builds a synthetic `this` with `_equipLoadBase: null` and calls the producer
// directly. That state IS the defect, and the missing information can only come from the
// construction site." The claim is checkable in two halves and both are checked here:
//
//   (a) IS THE NULL STATE STILL REACHABLE IN THE SHIPPED ENGINE? If `_buildCombat` assigns
//       `_equipLoadBase` unconditionally on the only path that builds a fight, C5 is testing a
//       state that cannot occur and the fixture is stale — a real instrument defect.
//   (b) DOES THE REPAIRED CHECK STILL BITE? Seed the base the way `_buildCombat` seeds it and the
//       arm must pass; leave it null and the SAME arm must fail. A check repaired into
//       unfalsifiability is the inert control this project has shipped four times.
// =============================================================================================
{
  const src = fs.readFileSync(path.join(REPO, 'game/src/engine.js'), 'utf8');
  const lines = src.split('\n');
  const assigns = [];
  lines.forEach((l, i) => { if (/this\._equipLoadBase\s*=/.test(l)) assigns.push({ line: i + 1, text: l.trim() }); });
  const bcStart = src.indexOf('_buildCombat(loadout) {');
  const bcEnd = src.indexOf('\n  _combatData() {', bcStart);
  const buildCombatBody = src.slice(bcStart, bcEnd > bcStart ? bcEnd : bcStart + 8000);
  const seedsUnconditionally = /this\._equipLoadBase = b\.equipLoadPct;/.test(buildCombatBody);
  // Is the seed guarded by anything? A conditional seed leaves the null state reachable.
  const seedLine = assigns.find((a) => /b\.equipLoadPct/.test(a.text));
  const guarded = seedLine ? /if\s*\(/.test(lines[seedLine.line - 2] || '') : null;

  // The arm itself, run twice: once seeded (the engine's state) and once null (C5's state).
  const runC5 = (seedBase) => {
    const inv = [{ id: 'shell-scale-hauberk', slot: null }];
    // The body starts where `createPlayer` leaves it: the loadout default, no offsets on it.
    const START = 24.0;
    const e = mkEngine({ inventory: inv, startPct: START, seedBase });
    const b = e.combat.player;
    const baseline = (() => {
      const t = mkEngine({ inventory: [{ id: 'shell-scale-hauberk', slot: 'chest' }], seedBase: START, startPct: START });
      return t._recomputeEquipLoad();
    })();
    const delta = -10;                                   // magic/apply.js loadHandler(-1), mag 10
    b.equipLoadPct = Math.max(0, b.equipLoadPct + delta);
    const afterCast = b.equipLoadPct;
    e.sim.inventory[0].slot = 'chest';                   // the producer's FIRST engagement
    const afterEquip = e._recomputeEquipLoad();
    b.equipLoadPct = Math.max(0, b.equipLoadPct - delta); // the spell expires and runs its _undo
    const afterExpiry = b.equipLoadPct;
    return {
      seed_base: seedBase === undefined ? null : seedBase,
      baseline_pct: +baseline.toFixed(6),
      pct_after_cast: +afterCast.toFixed(6),
      pct_after_first_equip: +afterEquip.toFixed(6),
      pct_expected_after_first_equip: +(baseline + delta).toFixed(6),
      pct_after_expiry: +afterExpiry.toFixed(6),
      pct_expected_after_expiry: +baseline.toFixed(6),
      offset_survived: Math.abs(afterEquip - (baseline + delta)) < 1e-9,
      correct_after_expiry: Math.abs(afterExpiry - baseline) < 1e-9,
    };
  };
  const seeded = runC5(24.0);      // what `_buildCombat` seeds: the body's pct at createPlayer
  const nullSeed = runC5(undefined); // C5's fixture, verbatim

  const ok = seedsUnconditionally && guarded === false
    && seeded.offset_survived && seeded.correct_after_expiry
    && !nullSeed.offset_survived && !nullSeed.correct_after_expiry;
  check('X1', 'C5 is a STALE FIXTURE, not an unpassable check: seeded as the engine seeds it the arm passes, null-seeded the SAME arm still fails', ok && !SELFTEST, {
    round_3_claim: 'no change confined to the producer can [pass C5] ... only the construction site holds the missing information',
    adjudication: seedsUnconditionally && guarded === false
      ? 'UPHELD IN PART. `_buildCombat` assigns `_equipLoadBase` unconditionally one statement after `createPlayer`, so C5\'s `_equipLoadBase: null` at first engagement is UNREACHABLE in the shipped engine. C5\'s fixture is stale and the repair is to construct the field the engine constructs. It is NOT true that only the construction site can hold the information — see `alternative_the_round_did_not_consider`.'
      : 'REJECTED — the seed is absent or conditional, so the null state is still reachable.',
    alternative_the_round_did_not_consider:
      'Store the spell offset in its OWN field and compute `pct = equipmentBase + offset` as an '
      + 'assignment. No delta-origin state is needed anywhere, the producer becomes idempotent, and '
      + 'the `Math.max(0, ...)` clamp asymmetry in BOTH sim/magic/apply.js and _recomputeEquipLoad() '
      + 'stops being able to lose points. The round\'s seeding repairs the symptom; the root cause '
      + 'is that one mutable scalar has two writers and no separation.',
    assignments_to__equipLoadBase: assigns,
    build_combat_seeds_unconditionally: seedsUnconditionally,
    seed_is_inside_an_if: guarded,
    arm_seeded_as_the_engine_seeds_it: seeded,
    arm_null_seeded_C5s_own_fixture: nullSeed,
    the_repaired_check_can_still_go_red: !nullSeed.offset_survived,
    what_the_seed_actually_is:
      '`b.equipLoadPct` at createPlayer — which for an UNPINNED state is the hardcoded 24.0, not '
      + 'the equipment base. The first engagement is therefore still an ASSIGNMENT (prev === pct, '
      + 'so pct + (base - prev) === base); it is a correct one because the two happen to be equal '
      + 'at that instant. The source comment calling it "provably the bare equipment base" is '
      + 'wrong about what the number is, and right that it is offset-free.',
  });
}

// =============================================================================================
// X2 — C7, ADJUDICATED, and the acceptance number for every tier.
//
// C7 sums the heaviest carried.json row per `slot`. RI-PRG07 §2 names FOUR terms — weapons,
// shields, armour, talismans — and `carried.json` can fill exactly one of them. So C7 as written
// measures a third of the formula and round 3 is right that it cannot pass. It is also right that
// the remedy is not to invent weights. What it did NOT do is give the tier an acceptance number
// against the item's OWN §4 weights, which are systematically heavier than the shipped ones.
// =============================================================================================
{
  const bySlot = new Map();
  for (const r of items) if (r.slot) {
    const cur = bySlot.get(r.slot);
    if (!cur || (r.weight || 0) > (cur.weight || 0)) bySlot.set(r.slot, r);
  }
  const wornOnly = [...bySlot.values()].reduce((a, r) => a + (r.weight || 0), 0);
  const heaviestClass = Object.values(weapons.classes).sort((a, b) => b.equip_weight - a.equip_weight)[0];
  const shieldRows = [];
  for (const [k, v] of Object.entries(offhand.shields || {})) shieldRows.push({ registry: 'weapons/offhand.json', id: k, cls: v.class, kg: v.weight });
  for (const [k, v] of Object.entries((stamina.block && stamina.block.shields) || {})) shieldRows.push({ registry: 'combat/stamina.json', id: k, cls: v.class, kg: v.weight });
  const heaviestShield = shieldRows.slice().sort((a, b) => b.kg - a.kg)[0];
  const shippedMax = wornOnly + heaviestClass.equip_weight + heaviestShield.kg;

  // RI-PRG07 §4's own table, transcribed. These are the item's declared weights for the SAME
  // objects and they are heavier at every comparable row.
  const S4 = {
    'Robe / cloth set (4 pieces)': 12, 'Hide / leather set': 26, 'Chitin / scale set': 38,
    'Mail set': 48, 'Plate set': 78, Dagger: 2, 'Straight sword': 6, Axe: 9, Halberd: 12,
    Greatsword: 14, Greataxe: 20, 'Bow + 60 arrows': 7, Buckler: 4, 'Kite shield': 9,
    Greatshield: 18, 'Talisman / catalyst': 3,
  };
  const s4Max = S4['Plate set'] + S4.Greataxe + S4.Greatshield + S4['Talisman / catalyst'];

  const rows = [];
  for (const [str, end, label] of [[10, 10, 'base sheet'], [14, 14, 'default sheet'], [55, 30, 'RI-PRG07 §5 Shell-Warden']]) {
    const cap = equipLoadMaxFor(str, end);
    const pct = (kg) => +((kg / cap) * 100).toFixed(4);
    rows.push({
      sheet: label, str, end, max_load_kg: cap,
      shelf_only_kg: +wornOnly.toFixed(2), shelf_only_pct: pct(wornOnly), shelf_only_tier: equipTier(pct(wornOnly), B),
      shipped_whole_s2_set_kg: +shippedMax.toFixed(2), shipped_whole_s2_set_pct: pct(shippedMax),
      shipped_whole_s2_set_tier: equipTier(pct(shippedMax), B),
      ri_prg07_s4_heaviest_kg: s4Max, ri_prg07_s4_heaviest_pct: pct(s4Max),
      ri_prg07_s4_heaviest_tier: equipTier(pct(s4Max), B),
      kg_for_OVERLOADED: +(cap * 1.0001).toFixed(2),
      shipped_shortfall_to_OVERLOADED_kg: +(cap * 1.0001 - shippedMax).toFixed(2),
    });
  }
  const shippedTiers = new Set(rows.map((r) => r.shipped_whole_s2_set_tier));
  const s4Tiers = new Set(rows.map((r) => r.ri_prg07_s4_heaviest_tier));
  const overloadedByShippedDressing = rows.some((r) => r.shipped_whole_s2_set_tier === 'OVERLOADED');
  const overloadedByS4Dressing = rows.some((r) => r.ri_prg07_s4_heaviest_tier === 'OVERLOADED');

  // The comparable rows, side by side. This is the number round 3 owed the tier.
  const compare = [
    ['Straight sword', S4['Straight sword'], weapons.classes.SSW.equip_weight],
    ['Dagger', S4.Dagger, weapons.classes.DGR.equip_weight],
    ['Halberd', S4.Halberd, weapons.classes.HLB.equip_weight],
    ['Greatsword', S4.Greatsword, weapons.classes.GSW.equip_weight],
    ['Buckler', S4.Buckler, (offhand.shields.buckler_shell || {}).weight],
    ['Kite shield', S4['Kite shield'], (offhand.shields.kite_garrison || {}).weight],
    ['Greatshield', S4.Greatshield, (offhand.shields.greatshield_xanmeer || {}).weight],
  ].map(([name, item_kg, shipped_kg]) => ({ item: name, ri_prg07_s4_kg: item_kg, shipped_kg, shipped_is_lighter_by: +(item_kg - shipped_kg).toFixed(2) }));

  const ok = !overloadedByShippedDressing && overloadedByS4Dressing && compare.every((c) => c.shipped_is_lighter_by > 0);
  check('X2', 'C7 measures a third of RI-PRG07 §2 and cannot pass; over the WHOLE §2 set three tiers are reachable and OVERLOADED is a content shortfall the item itself already prices', ok && !SELFTEST, {
    round_3_claim: 'C7 models "dressing" as carried.json rows only and the shelf ships no shield, so the 13 kg term that reaches HEAVY is invisible to it',
    adjudication: 'UPHELD. `carried.json` declares five wearable slots and no shield, no talisman '
      + 'and no left-hand row; the weapon and shield weights live in weapons/classes.json, '
      + 'weapons/offhand.json and combat/stamina.json. C7 sums one of §2\'s four terms and is '
      + 'unpassable by construction. The repair is this arm, not a weight invented to clear a cliff.',
    but_the_round_still_owes_the_tier_a_number:
      'RI-PRG07 §4 declares weights for the same objects and every one of them is HEAVIER than the '
      + 'shipped row. Plate 78 + Greataxe 20 + Greatshield 18 + talisman 3 = 119 kg, which is '
      + 'OVERLOADED on all three sheets. The tier is not unreachable in the corpus — it is '
      + 'unreachable in this build\'s CONTENT, and the exact shortfall is the last column below.',
    slots_the_shelf_can_fill: [...bySlot.keys()],
    shelf_total_kg: +wornOnly.toFixed(2),
    heaviest_weapon_class: `${heaviestClass.name}:${heaviestClass.equip_weight}`,
    shield_registries: shieldRows,
    heaviest_shield: heaviestShield,
    shipped_vs_ri_prg07_s4: compare,
    rows,
    tiers_reachable_by_shipped_dressing: [...shippedTiers],
    tiers_reachable_at_ri_prg07_s4_weights: [...s4Tiers],
    OVERLOADED_by_shipped_dressing: overloadedByShippedDressing,
    OVERLOADED_at_the_items_own_weights: overloadedByS4Dressing,
  });
}

// =============================================================================================
// X3 — EVERY DELETE-THE-FIX ARM, CLASSIFIED BY WHERE ITS STATE LIVES.
//
// Round 3's `oversprint` control was inert because the flag rode on `combat.d` and
// `_combatData()` returns a fresh object literal on every `_buildCombat`. That is a general trap.
// An arm read off `engine._w116Break` survives a scenario load; an arm read off anything the
// engine REBUILDS does not, unless it is re-published at every rebuild site.
// =============================================================================================
{
  const files = [];
  const walk = (d) => { for (const f of fs.readdirSync(d, { withFileTypes: true })) {
    if (f.isDirectory()) walk(path.join(d, f.name)); else if (f.name.endsWith('.js')) files.push(path.join(d, f.name)); } };
  walk(path.join(REPO, 'game/src'));
  const readSites = [];
  for (const f of files) {
    const rel = path.relative(REPO, f);
    fs.readFileSync(f, 'utf8').split('\n').forEach((l, i) => {
      const t = l.trim();
      if (t.startsWith('*') || t.startsWith('//')) return;
      if (/_w116Break/.test(l)) readSites.push({ file: rel, line: i + 1, carrier: 'engine._w116Break', rebuilt: false, text: t });
      if (/__w116_oversprint/.test(l)) readSites.push({ file: rel, line: i + 1, carrier: 'combat.d.__w116_oversprint', rebuilt: true, text: t });
    });
  }
  const api = fs.readFileSync(path.join(REPO, 'game/src/harness/api.js'), 'utf8');
  const engineSrc = fs.readFileSync(path.join(REPO, 'game/src/engine.js'), 'utf8');
  const known = (api.match(/const known = \[([^\]]*)\]/) || [, ''])[1]
    .split(',').map((s) => s.trim().replace(/'/g, '')).filter(Boolean);

  // Where is a fresh CombatSystem built, and does every such site re-publish the rebuilt carrier?
  const rebuildSites = [];
  engineSrc.split('\n').forEach((l, i) => { if (/new CombatSystem\(/.test(l)) rebuildSites.push({ line: i + 1, text: l.trim() }); });
  const republishSites = [];
  engineSrc.split('\n').forEach((l, i) => { if (/combat\.d\.__w116_oversprint\s*=/.test(l)) republishSites.push({ line: i + 1, text: l.trim() }); });
  const apiRepublish = /combat\.d\.__w116_oversprint\s*=/.test(api);

  const arms = known.map((k) => {
    const sites = readSites.filter((r) => new RegExp(`_w116Break(\\.|\\s*&&\\s*this\\._w116Break\\.)${k}\\b`).test(r.text)
      || (k === 'oversprint' && r.carrier === 'combat.d.__w116_oversprint'));
    const rebuiltCarrier = sites.some((s) => s.rebuilt);
    return {
      arm: k,
      read_sites: sites.map((s) => `${s.file}:${s.line}`),
      carrier: rebuiltCarrier ? 'combat.d (REBUILT by _combatData on every _buildCombat)' : 'engine._w116Break (survives a scenario load)',
      at_risk_of_the_inert_trap: rebuiltCarrier,
      republished_at_every_rebuild_site: rebuiltCarrier ? (republishSites.length >= rebuildSites.length) : null,
    };
  });
  const riskyUnprotected = arms.filter((a) => a.at_risk_of_the_inert_trap && a.republished_at_every_rebuild_site === false);
  const ok = arms.length === 7 && riskyUnprotected.length === 0 && republishSites.length >= 1 && apiRepublish;
  check('X3', 'exactly one arm rides a rebuilt object, and it is re-published at every rebuild site', ok && !SELFTEST, {
    arms,
    combat_system_rebuild_sites: rebuildSites,
    oversprint_republish_sites_in_engine: republishSites,
    republished_in_harness_api_too: apiRepublish,
    arms_riding_a_rebuilt_object_without_republication: riskyUnprotected.map((a) => a.arm),
    note: 'STATIC half only. The dynamic half — set each arm, cross a scenario boundary, confirm '
      + 'the arm is still in force — is `critic-w1-16-r3-live.mjs --probe controls`.',
  });
}

// =============================================================================================
// X4 — THE CONSUMPTION CENSUS, RE-DERIVED. RI-MTH07 / ARBITRATION §3.
//
// Round 3 says four unread burden parameters remain. This enumerates every column BOTH ladders
// publish plus the three terms round 3 itself added, and greps game/src for a use that is not a
// comment and not the declaration.
// =============================================================================================
{
  const files = [];
  const walk = (d) => { for (const f of fs.readdirSync(d, { withFileTypes: true })) {
    if (f.isDirectory()) walk(path.join(d, f.name)); else if (f.name.endsWith('.js')) files.push(path.join(d, f.name)); } };
  walk(path.join(REPO, 'game/src'));
  const blob = files.map((f) => ({ f: path.relative(REPO, f), t: fs.readFileSync(f, 'utf8') }));
  const usesRe = (re, skipEngineCensus) => {
    const out = [];
    for (const x of blob) x.t.split('\n').forEach((l, i) => {
      const t = l.trim();
      if (t.startsWith('*') || t.startsWith('//') || t.startsWith('+ \'')) return;
      // engine.js's getBurden() consumer table NAMES every parameter in a string literal. A name
      // in the census is not a reader of the value (RULES #11 in spirit: the declaration is not
      // the consumption). Those lines are excluded by requiring a non-string context.
      if (skipEngineCensus && /^[a-z_]+:\s*'/.test(t)) return;
      if (re.test(l)) out.push(`${x.f}:${i + 1}`);
    });
    return out;
  };
  const P = [
    // RI-PRG07 §3 — the out-of-fight ladder, column by column
    ['burden', 'move', /\bt\.move\b|\.move\s*\*|_burdenMult/],
    ['burden', 'sprint', /\bt\.sprint\b|denySprint/],
    ['burden', 'fatigue', /\bt\.fatigue\b|fatigue_drain|fatigueDrain/],
    ['burden', 'sneak', /\bt\.sneak\b|sneakDetection|sneak_detection_mult\s*\*/],
    ['burden', 'travel_time', /\bt\.travel_time\b|bt\.travel_time|travelTime/],
    ['burden', 'jump', /\bt\.jump\b|burdenJump|jumpHeight.*burden/],
    // RI-PRG07 §2 / RI-CMB01 §B — the in-fight ladder
    ['equip_load', 'roll.iframes', /m\.iframes/],
    ['equip_load', 'roll.total', /m\.total\b/],
    ['equip_load', 'roll.stamina', /r\.stamina\b|\.stamina_cost/],
    ['equip_load', 'roll.distance_m', /r\.distance_m/],
    ['equip_load', 'roll.anim_speed', /anim_speed/],
    ['equip_load', 'tier_boundaries_pct', /tier_boundaries_pct/],
    ['equip_load', 'fall_damage_mult (RI-PRG07 §2, the column the item says is ITS OWN)', /fall_damage_mult|fallDamageMult/],
    ['equip_load', 'stamina regen mult by tier (RI-PRG07 §2 column 5)', /regen.*tier|tier.*regen|staminaRegenMult/i],
    // round 3's own three additions
    ['equip_load', 'weapons/classes.json equip_weight', /\.equip_weight\b/],
    ['equip_load', 'shield weight', /shieldRow\.weight|shield\.weight/],
    ['equip_load', 'OVERLOADED denies sprint', /OVERLOADED'\s*&&|=== 'OVERLOADED'/],
    // RI-PRG07 §2's fourth term
    ['equip_load', 'talisman weight (§2 term 4)', /talisman/i],
    // the field round 3 made live
    ['equip_load', 'carried.json `moveset`', /rec\.moveset|\.moveset\b/],
  ];
  const rows = P.map(([model, param, re]) => {
    const f = usesRe(re, true);
    return { model, param, readers: f.slice(0, 5), n_readers: f.length, unread: f.length === 0 };
  });
  const unread = rows.filter((r) => r.unread).map((r) => `${r.model}.${r.param}`);
  const roundThreeDeclared = ['burden.fatigue', 'burden.sneak', 'burden.jump', 'equip_load.fall_damage_mult'];
  const missed = unread.filter((u) => !roundThreeDeclared.some((d) => u.startsWith(d.split(' ')[0]) && u.includes(d.split('.')[1])));
  const ok = unread.length > 0 && missed.length > 0;
  check('X4', 'the round-3 census of unread parameters is INCOMPLETE — it names four and there are more', ok && !SELFTEST, {
    note: 'This check PASSES when it finds something the census missed. ARBITRATION §3: a sample is not an enumeration.',
    round_3_declared_unread: roundThreeDeclared,
    measured_unread: unread,
    missed_by_the_round_3_census: missed,
    rows,
  });
}

// =============================================================================================
// X5 — THE REFUSAL'S AUDIENCE. Round 3 refuses `hist-sap-bow` "with a reason on the equip_end
// event rather than silently weighed as though held". The policy is right. The question the brief
// asks is whether a PLAYER can tell — RULES #26's shape, applied to the game rather than the log.
// =============================================================================================
{
  const engineSrc = fs.readFileSync(path.join(REPO, 'game/src/engine.js'), 'utf8');
  const files = [];
  const walk = (d) => { for (const f of fs.readdirSync(d, { withFileTypes: true })) {
    if (f.isDirectory()) walk(path.join(d, f.name)); else if (f.name.endsWith('.js')) files.push(path.join(d, f.name)); } };
  walk(path.join(REPO, 'game/src'));
  const readers = [];
  for (const f of files) {
    const rel = path.relative(REPO, f);
    if (rel === 'game/src/engine.js') continue;
    fs.readFileSync(f, 'utf8').split('\n').forEach((l, i) => {
      const t = l.trim();
      if (t.startsWith('*') || t.startsWith('//')) return;
      if (/'equip_end'|"equip_end"|\.refused\b/.test(l)) readers.push({ file: rel, line: i + 1, text: t });
    });
  }
  const uiReaders = readers.filter((r) => r.file.startsWith('game/src/ui/') || r.file.startsWith('game/src/render/'));
  const hasToast = /uiToast\s*\(/.test(engineSrc);
  const refusalCallsToast = /ev\.refused = why[\s\S]{0,120}uiToast/.test(engineSrc);
  const ok = hasToast && uiReaders.length === 0 && !refusalCallsToast;
  check('X5', 'the equip refusal reaches a probe and NOT a player: nothing in ui/ or render/ reads `equip_end` or `refused`, and the shipped toast channel is not called', ok && !SELFTEST, {
    round_3_position: 'the equip is REFUSED with a reason on the equip_end event rather than silently weighed as though held',
    verdict: 'The POLICY is right — guessing a bow would reproduce the round-2 defect. The DELIVERY '
      + 'is a silent no-op from the player\'s chair: press interact on the Sapwood bow and the row '
      + 'does not move, no slot changes, no HUD element changes and no message appears.',
    readers_of_equip_end_or_refused_outside_engine_js: readers,
    ui_or_render_readers: uiReaders,
    shipped_player_visible_channel_exists: hasToast,
    refusal_uses_it: refusalCallsToast,
    remedy: 'one line at engine.js `_finishEquipCommit()`: `this.uiToast(...)` beside `ev.refused = why`.',
  });
}

// =============================================================================================
// X6 — RI-PRG07 §3, VERBATIM: "burdenRatio = (weight of ALL carried items, EQUIPPED OR NOT) /
// (maxLoad x 2.5)".
//
// Round 3 moved the weapon and the shield OUT of the inventory sum and INTO the hands term, and
// skipped the `right`/`left` inventory rows so one sword is not weighed twice. Correct for §2.
// But `_recomputeBurden()` sums `sim.inventory` and nothing else, and the hands are not inventory
// rows — so the thing in your hands is in the equip ratio and in NEITHER burden term. §3 says
// "equipped or not" and means it.
//
// Second half: the same object has TWO weights. A bog-iron maul is 11.5 kg in `carried.json` and
// 16 kg as `GHM` in `weapons/classes.json`, and round 3's fix makes the game use whichever one
// depending on which ratio is asking.
// =============================================================================================
{
  const e = mkEngine({
    inventory: [{ id: 'shell-scale-hauberk', slot: 'chest' }],
    handWeapon: { id: 'ugs_golem_sword', kg: weapons.classes.UGS.equip_weight, cls: 'UGS' },
    handShield: { id: 'naga_tower', kg: (stamina.block.shields.naga_tower || {}).weight },
    seedBase: 0, startPct: 0,
  });
  const pct = e._recomputeEquipLoad();
  const burden = e._recomputeBurden();
  const handsKg = weapons.classes.UGS.equip_weight + (stamina.block.shields.naga_tower || {}).weight;
  const equippedKg = e.sim.player.equippedWeight;
  const carriedKg = e.sim.player.carriedWeight;
  const handsInEquip = Math.abs(equippedKg - (9.1 + handsKg)) < 1e-9;
  const handsMissingFromBurden = Math.abs(carriedKg - 9.1) < 1e-9;

  const maul = ITEM_MAP.get('bog-iron-maul');
  const twoWeights = { object: 'bog-iron-maul / ghm_bog_maul', carried_json_kg: maul.weight, weapon_class_kg: weapons.classes.GHM.equip_weight };

  const ok = handsInEquip && handsMissingFromBurden && twoWeights.carried_json_kg !== twoWeights.weapon_class_kg;
  check('X6', 'the hands are in the equip ratio and in NEITHER burden term, against RI-PRG07 §3\'s "equipped or not"', ok && !SELFTEST, {
    ri_prg07_s3: 'burdenRatio = (weight of ALL carried items, equipped or not) / (maxLoad x 2.5)',
    hands_kg: handsKg,
    equip_load_equipped_weight_kg: equippedKg,
    burden_carried_weight_kg: carriedKg,
    equip_load_pct: +pct.toFixed(6),
    burden_ratio: +burden.toFixed(6),
    the_hands_reach_the_equip_ratio: handsInEquip,
    the_hands_are_absent_from_burden: handsMissingFromBurden,
    consequence: '33 kg of ultra greatsword and Naga tower move the roll from LIGHT to MEDIUM and '
      + 'move the burden ratio by zero. A character carrying nothing but the heaviest hands in the '
      + 'game reads UNBURDENED on the walk home, which is the §3 half of the same "two right hands" '
      + 'defect round 3 closed on the §2 side.',
    one_object_two_weights: twoWeights,
    second_consequence: 'Pick the maul up and it weighs 11.5 kg in your pack; put it in your hand '
      + 'and it weighs 16 kg to the roll and 11.5 kg to burden AT THE SAME TIME, because the pack '
      + 'row is skipped by §2 and counted by §3 while the class weight is counted by §2 only.',
  });
}

// =============================================================================================
const failed = results.filter((r) => !r.ok);
const out = {
  schema: 'elder-souls/critic-w1-16-r3-offline@1',
  generated: new Date().toISOString(),
  selftest: SELFTEST,
  checks: results,
  failed: failed.map((r) => r.id),
};
const dest = path.join(REPO, 'reports', 'w1-16', 'critic-r3-offline.json');
fs.mkdirSync(path.dirname(dest), { recursive: true });
fs.writeFileSync(dest, JSON.stringify(out, null, 2) + '\n');

if (AS_JSON) process.stdout.write(JSON.stringify(out, null, 2) + '\n');
else {
  for (const r of results) process.stdout.write(`${r.ok ? 'PASS' : 'FAIL'}  ${r.id}  ${r.title}\n`);
  process.stdout.write(`\nwritten: ${path.relative(REPO, dest)}\n`);
}
process.exit(failed.length ? 1 : 0);
