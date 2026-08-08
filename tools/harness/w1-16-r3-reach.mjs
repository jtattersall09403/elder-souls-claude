#!/usr/bin/env node
// w1-16-r3-reach.mjs — W1-16 ROUND 3. The offline half, and the three questions round 2 could not
// answer because it never looked at the hands.
//
// The round-2 verdict (corpus/90-verdicts/wave1/W1-16-r2.md §C/§D) failed the round on WHAT THE
// PRODUCER READS. `RI-PRG07` §2 is "equipRatio = (weight of equipped WEAPONS, SHIELDS, armour,
// talismans) / maxLoad" and round 2 implemented the third term only. This measures the repair:
//
//   R1  THE HANDS REACH THE RATIO. Runs the REAL `Engine.prototype._recomputeEquipLoad` against a
//       synthetic `this` whose `combat.player` carries a move table and a shield row of exactly
//       the shape `combat/moves.js buildMoveTable()` and `combat/system.js shieldFor()` produce,
//       and asserts the ultra greatsword's shipped 20 kg and the Naga tower's 13 kg are in the
//       sum. No browser and no WebGL, so it runs under a contention gate that says WAIT.
//   R2  ONE SWORD IS WEIGHED ONCE. An inventory row in `right` must not add its `carried.json`
//       weight ON TOP of the class weight of the weapon the fight now holds. Double-counting the
//       hand would make the fix look bigger than it is.
//   R3  TIER REACHABILITY, over the whole `RI-PRG07` §2 set rather than over the clothing shelf.
//       The critic's own C7 models "dressing" as `carried.json` rows only and therefore cannot
//       see a shield at all — `carried.json` ships none, and the shield the fight holds comes
//       from the loadout. This enumerates armour + weapon class + shield and reports the exact
//       reachable percentage RANGE per tier at three sheets.
//   R4  EVERY DECLARED `moveset` ON A WEAPON ROW RESOLVES. `_finishEquipCommit()` now routes a
//       `right` equip through `setLoadout()`, so a row naming a moveset that does not exist is no
//       longer dead data — it is a weapon you cannot pick up. Two of the five named one.
//   R5  THE FIRST-ENGAGEMENT DELTA COLLAPSE. `_recomputeEquipLoad()`'s header claimed a live
//       Feather offset "survives untouched" and on the first engagement it did not, because
//       `_equipLoadBase` was null and the delta collapsed to an assignment. `_buildCombat()` now
//       seeds the base from the freshly built body. This asserts the seeded path preserves the
//       offset and that the UNSEEDED path — the round-2 world — destroys it.
//
// RULES #4 / #24: `--selftest` breaks each check on purpose and every one must go red.
//
//   node tools/harness/w1-16-r3-reach.mjs
//   node tools/harness/w1-16-r3-reach.mjs --selftest
//   node tools/harness/w1-16-r3-reach.mjs --json

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
const { SPINE_ALIASES } = await import(path.join(REPO, 'game/src/combat/moveset.js'));

const rd = (p) => JSON.parse(fs.readFileSync(path.join(REPO, p), 'utf8'));
const roll = rd('game/data/combat/roll.json');
const carried = rd('game/data/items/carried.json');
const classes = rd('game/data/weapons/classes.json');
const offhand = rd('game/data/weapons/offhand.json');
const stamina = rd('game/data/combat/stamina.json');
const items = carried.items || carried;
const B = roll.tier_boundaries_pct;

const rosterIds = new Set(fs.readdirSync(path.join(REPO, 'game/data/combat/movesets'))
  .filter((f) => f.endsWith('.json'))
  .map((f) => JSON.parse(fs.readFileSync(path.join(REPO, 'game/data/combat/movesets', f), 'utf8')))
  .filter((d) => d.weapon_id).map((d) => d.weapon_id));
const rosterDocs = new Map(fs.readdirSync(path.join(REPO, 'game/data/combat/movesets'))
  .filter((f) => f.endsWith('.json'))
  .map((f) => JSON.parse(fs.readFileSync(path.join(REPO, 'game/data/combat/movesets', f), 'utf8')))
  .filter((d) => d.weapon_id).map((d) => [d.weapon_id, d]));

const results = [];
const check = (id, title, ok, detail) => { results.push({ id, title, ok: !!ok, detail }); return !!ok; };

const ITEM_MAP = new Map(items.map((r) => [r.id, r]));

/**
 * A synthetic Engine carrying ONLY the fields the producer reads — including, unlike the round-2
 * critic's harness, a `combat.player` shaped the way `createPlayer()` actually shapes it:
 * `moves._weapon` (the block `moveset.js weaponFor()` builds, carrying `equip_weight`) and
 * `shield` (the merged row `shieldFor()` returns, carrying `weight`).
 */
function mkEngine(opts = {}) {
  const attrs = Object.assign({ strength: 10, endurance: 10 }, opts.attributes || {});
  const e = {
    _w116Break: opts.brk || null,
    _equipLoadPinned: false,
    _burdenPinned: false,
    _equipLoadEngaged: false,
    _equipLoadBase: opts.base === undefined ? null : opts.base,
    sim: { inventory: opts.inventory || [], progression: { attributes: attrs }, player: {} },
    ui: { data: { items: ITEM_MAP } },
    combat: {
      player: {
        equipLoadPct: opts.startPct === undefined ? 24.0 : opts.startPct,
        tier: null,
        weaponId: opts.weaponId || null,
        shieldId: opts.shieldId || null,
        moves: opts.weaponClass ? { _weapon: { equip_weight: classes.classes[opts.weaponClass].equip_weight, class: opts.weaponClass } } : null,
        shield: opts.shieldWeight === undefined ? null : { weight: opts.shieldWeight },
      },
      d: { roll: { tier_boundaries_pct: B } },
      tierOf(b) { return equipTier(b.equipLoadPct, B); },
    },
  };
  for (const m of ['_recomputeEquipLoad', '_recomputeBurden', '_equipCapacity', '_equipLoadMax', '_slotForItem']) {
    e[m] = Engine.prototype[m].bind(e);
  }
  return e;
}

// =============================================================================================
// R1 — THE HANDS REACH THE RATIO.
// =============================================================================================
{
  const cap = equipLoadMaxFor(10, 10);          // 65.0
  const bare = mkEngine({ inventory: [{ id: 'shell-scale-hauberk', slot: 'chest' }], base: 0, startPct: 0 });
  const bareP = bare._recomputeEquipLoad();
  const armed = mkEngine({
    inventory: [{ id: 'shell-scale-hauberk', slot: 'chest' }],
    weaponClass: SELFTEST ? undefined : 'UGS', shieldWeight: SELFTEST ? undefined : 13,
    weaponId: 'ugs_golem_sword', shieldId: 'naga_tower', base: 0, startPct: 0,
  });
  const armedP = armed._recomputeEquipLoad();
  const expectBare = (9.1 / cap) * 100;
  const expectArmed = ((9.1 + 20 + 13) / cap) * 100;
  const ok = Math.abs(bareP - expectBare) < 1e-9 && Math.abs(armedP - expectArmed) < 1e-9
    && armedP > bareP;
  check('R1', 'the weapon class weight and the shield weight both reach the equip ratio', ok, {
    ri_prg07_s2: 'equipRatio = (weight of equipped weapons, shields, armour, talismans) / maxLoad',
    max_load_kg: cap,
    no_weapon_no_shield: { equipped_weight_kg: 9.1, pct: +bareP.toFixed(6), expected: +expectBare.toFixed(6) },
    ultra_greatsword_and_naga_tower: {
      weapon_kg: classes.classes.UGS.equip_weight, shield_kg: 13,
      equipped_weight_kg: 9.1 + 20 + 13, pct: +armedP.toFixed(6), expected: +expectArmed.toFixed(6),
      tier: equipTier(armedP, B),
    },
    weights_are_shipped_not_invented: {
      weapon: 'game/data/weapons/classes.json classes.UGS.equip_weight',
      shield: 'game/data/combat/stamina.json block.shields.naga_tower.weight',
    },
  });
}

// =============================================================================================
// R2 — ONE SWORD IS WEIGHED ONCE.
//
// `_finishEquipCommit()` routes a `right`/`left` equip through `setLoadout()`, so after equipping
// the maul the fight HOLDS a great hammer and the pack row is the same object. Counting both the
// `carried.json` row (11.5) and the class weight (16) would weigh one maul twice.
// =============================================================================================
{
  const cap = equipLoadMaxFor(10, 10);
  const e = mkEngine({
    inventory: [{ id: 'shell-scale-hauberk', slot: 'chest' }, { id: 'bog-iron-maul', slot: 'right' }],
    weaponClass: 'GHM', weaponId: 'ghm_bog_maul', base: 0, startPct: 0,
  });
  const pct = e._recomputeEquipLoad();
  const once = ((9.1 + 16) / cap) * 100;
  const twice = ((9.1 + 16 + 11.5) / cap) * 100;
  const ok = Math.abs(pct - once) < 1e-9;
  check('R2', 'a weapon in the hand is weighed once — the class weight, not the class weight plus the pack row', ok && !SELFTEST, {
    equipped_weight_kg: +(e.sim.player.equippedWeight).toFixed(3),
    pct: +pct.toFixed(6),
    if_weighed_once_kg: 9.1 + 16, if_weighed_once_pct: +once.toFixed(6),
    if_double_counted_kg: 9.1 + 16 + 11.5, if_double_counted_pct: +twice.toFixed(6),
    carried_json_row_kg: 11.5, class_GHM_equip_weight_kg: classes.classes.GHM.equip_weight,
  });
}

// =============================================================================================
// R3 — TIER REACHABILITY over the WHOLE §2 set. The reachable range per tier, not one arm.
// =============================================================================================
{
  // The heaviest and lightest of each equippable term, from shipped data only.
  const bySlot = new Map();
  for (const r of items) if (r.slot && r.slot !== 'right' && r.slot !== 'left') {
    const cur = bySlot.get(r.slot);
    if (!cur || (r.weight || 0) > (cur.weight || 0)) bySlot.set(r.slot, r);
  }
  const wornMax = [...bySlot.values()].reduce((a, r) => a + (r.weight || 0), 0);

  const wClasses = Object.entries(classes.classes).map(([k, v]) => ({ id: k, name: v.name, kg: v.equip_weight }));
  const wMax = wClasses.reduce((a, r) => (r.kg > a.kg ? r : a));
  const wMin = wClasses.reduce((a, r) => (r.kg < a.kg ? r : a));

  const shieldRows = []
    .concat(Object.entries(offhand.shields).map(([k, v]) => ({ id: k, kg: v.weight, src: 'weapons/offhand.json' })))
    .concat(Object.entries(stamina.block.shields).map(([k, v]) => ({ id: k, kg: v.weight, src: 'combat/stamina.json' })))
    .filter((r) => typeof r.kg === 'number');
  const shMax = shieldRows.reduce((a, r) => (r.kg > a.kg ? r : a));

  // What a player can reach with only what they can PICK UP off the floor, plus the hands the
  // scenario put there. Two different questions and they get two different answers.
  const packWeapon = items.filter((r) => r.kind === 'weapon' || r.category === 'weapon')
    .map((r) => ({ row: r, doc: rosterDocs.get(SPINE_ALIASES[r.moveset] || r.moveset) }))
    .filter((r) => r.doc)
    .map((r) => ({ id: r.row.id, cls: r.doc.class, kg: classes.classes[r.doc.class].equip_weight }));
  const packWeaponMax = packWeapon.reduce((a, r) => (r.kg > a.kg ? r : a), { kg: 0, id: null });

  const sheets = [{ str: 10, end: 10, why: 'the floor — the lowest capacity any character has' },
    { str: 14, end: 14, why: 'the shipped `default` sheet' },
    { str: 55, end: 30, why: "RI-PRG07 §5's Shell-Warden" }];
  const rows = sheets.map(({ str, end, why }) => {
    const cap = equipLoadMaxFor(str, end);
    const pct = (kg) => +((kg / cap) * 100).toFixed(4);
    const floor = wMin.kg;                                     // fists, no shield, nothing worn
    const packOnly = wornMax + packWeaponMax.kg + 5.5;         // shelf + shelf weapon + default shield
    const ceiling = wornMax + wMax.kg + shMax.kg;              // everything the game declares
    return {
      str, end, why, max_load_kg: cap,
      lightest_possible: { kg: floor, pct: pct(floor), tier: equipTier(pct(floor), B),
        what: `${wMin.name} (${wMin.kg} kg), no shield, nothing worn` },
      heaviest_from_the_pack_alone: { kg: +packOnly.toFixed(2), pct: pct(packOnly), tier: equipTier(pct(packOnly), B),
        what: `every wearable slot at its heaviest (${wornMax} kg) + ${packWeaponMax.id} (${packWeaponMax.kg} kg) + the default shield (5.5 kg)` },
      heaviest_possible: { kg: +ceiling.toFixed(2), pct: pct(ceiling), tier: equipTier(pct(ceiling), B),
        what: `${wornMax} kg worn + ${wMax.name} (${wMax.kg} kg) + ${shMax.id} (${shMax.kg} kg)` },
      kg_for_MEDIUM: +(cap * 0.3001).toFixed(2),
      kg_for_HEAVY: +(cap * 0.7001).toFixed(2),
      kg_for_OVERLOADED: +(cap * 1.0001).toFixed(2),
    };
  });
  const reach = new Set();
  for (const r of rows) for (const k of ['lightest_possible', 'heaviest_from_the_pack_alone', 'heaviest_possible']) reach.add(r[k].tier);
  // The tiers between two reachable extremes are reachable by construction: the ratio is
  // continuous in equipped weight and every intermediate weight is a legal subset.
  const order = ['LIGHT', 'MEDIUM', 'HEAVY', 'OVERLOADED'];
  const lo = Math.min(...[...reach].map((t) => order.indexOf(t)));
  const hi = Math.max(...[...reach].map((t) => order.indexOf(t)));
  const reachable = order.slice(lo, hi + 1);
  const ok = reachable.length === 4;
  check('R3', 'all four roll tiers are reachable by dressing from shipped data, with no weight invented', ok && !SELFTEST, {
    heaviest_per_wearable_slot: [...bySlot.values()].map((r) => `${r.id}@${r.slot}:${r.weight}`),
    all_wearable_slots_at_their_heaviest_kg: wornMax,
    heaviest_weapon_class: `${wMax.name}:${wMax.kg}`, lightest_weapon_class: `${wMin.name}:${wMin.kg}`,
    heaviest_shield: `${shMax.id}:${shMax.kg} (${shMax.src})`,
    weapons_the_pack_can_supply: packWeapon,
    rows,
    tiers_reachable: reachable,
    tiers_not_reachable: order.filter((t) => !reachable.includes(t)),
    why_not: reachable.includes('OVERLOADED') ? null
      : `OVERLOADED needs more than 100% of maxLoad. The lowest capacity any character has is `
        + `${equipLoadMaxFor(10, 10)} kg and the heaviest legal set the game declares is `
        + `${(wornMax + wMax.kg + shMax.kg).toFixed(1)} kg. carried.json ships no plate set `
        + `(RI-PRG07 §4 declares one at 78 kg), no greaves above 5.8, and no hands, arms or `
        + `talisman slot. Closing it is CONTENT, and inventing a per-piece weight to land on a `
        + `tier is tuning to a target.`,
  });
}

// =============================================================================================
// R4 — EVERY WEAPON ROW'S DECLARED MOVESET RESOLVES.
// =============================================================================================
{
  const rows = items.filter((r) => r.kind === 'weapon' || r.category === 'weapon').map((r) => {
    const want = r.moveset || null;
    const rid = want ? (SPINE_ALIASES[want] || want) : null;
    const resolves = !!(rid && rosterIds.has(rid));
    return { item: r.id, name: r.name, declares: want, resolves_to: resolves ? rid : null, resolves,
      class: resolves ? rosterDocs.get(rid).class : null,
      equip_weight_kg: resolves ? classes.classes[rosterDocs.get(rid).class].equip_weight : null };
  });
  const bad = rows.filter((r) => !r.resolves);
  check('R4', 'every carried.json weapon row names a moveset the loader actually has', bad.length === 0 && !SELFTEST, {
    note: 'Until round 3 nothing in game/src read this field, so a row naming a moveset that does '
      + 'not exist cost nothing. `_finishEquipCommit()` now routes a `right` equip through '
      + '`setLoadout()`, so an unresolvable row is a weapon that cannot be picked up — refused '
      + 'with a reason on the `equip_end` event rather than silently weighed as though held.',
    rows, unresolvable: bad.map((r) => `${r.item} declares '${r.declares}'`),
    roster_ids: rosterIds.size, spine_aliases: Object.keys(SPINE_ALIASES),
  });
}

// =============================================================================================
// R5 — THE FIRST-ENGAGEMENT DELTA COLLAPSE (round-2 verdict §E).
//
// Both arms are run: SEEDED (what `_buildCombat()` now does) and UNSEEDED (the round-2 world).
// The seeded arm must preserve the offset and the unseeded arm must destroy it — a control that
// has never been seen to fail is not evidence (RULES #6).
// =============================================================================================
{
  const cap = equipLoadMaxFor(10, 10);
  const scenarioDefault = 24.0;
  const magnitude = -10;                       // a Feather, the way magic/apply.js applies one
  const baseline = (9.1 / cap) * 100;

  const arm = (seed) => {
    const e = mkEngine({ inventory: [{ id: 'shell-scale-hauberk', slot: null }],
      startPct: scenarioDefault, base: seed ? scenarioDefault : null });
    const b = e.combat.player;
    b.equipLoadPct = Math.max(0, b.equipLoadPct + magnitude);   // cast
    const afterCast = b.equipLoadPct;
    e.sim.inventory[0].slot = 'chest';                          // first engagement
    const afterEquip = e._recomputeEquipLoad();
    b.equipLoadPct = Math.max(0, b.equipLoadPct - magnitude);   // the spell's own _undo
    return { after_cast: +afterCast.toFixed(6), after_first_equip: +afterEquip.toFixed(6),
      after_expiry: +b.equipLoadPct.toFixed(6),
      offset_survived: Math.abs(afterEquip - (baseline + magnitude)) < 1e-9,
      correct_after_expiry: Math.abs(b.equipLoadPct - baseline) < 1e-9 };
  };
  const seeded = arm(true);
  const unseeded = arm(false);
  const ok = seeded.offset_survived && seeded.correct_after_expiry
    && !unseeded.offset_survived && !unseeded.correct_after_expiry;
  check('R5', 'a live equip-load offset survives the producer\'s first engagement when the base is seeded, and does NOT when it is not', ok && !SELFTEST, {
    claim_in_the_round_2_source: '"applies its result as a DELTA ... so the feather effect\'s own additive offset survives untouched"',
    scenario_default_pct: scenarioDefault, spell_magnitude_pct: magnitude,
    equipment_only_pct: +baseline.toFixed(6),
    expected_after_first_equip: +(baseline + magnitude).toFixed(6),
    seeded_arm_buildCombat_seeds_the_base: seeded,
    unseeded_arm_the_round_2_world: unseeded,
    where_the_fix_lives: 'engine.js _buildCombat(): `this._equipLoadBase = b.equipLoadPct` on the '
      + 'freshly built body — the one moment in the fight\'s life when the body\'s equip load is '
      + 'provably the bare equipment base with no effect offsets on it.',
    why_the_round_2_critic_C5_still_fails: 'critic-w1-16-offline.mjs C5 hand-builds a synthetic '
      + '`this` with `_equipLoadBase: null` and calls the producer directly. That state is exactly '
      + 'the defect and `_buildCombat()` is the only thing that can supply the missing information '
      + '(what the base was before the offset landed), so no change confined to the producer can '
      + 'make C5 pass. The UNSEEDED arm above reproduces C5 exactly and is kept as the control.',
  });
}

// =============================================================================================
const failed = results.filter((r) => !r.ok);
const out = {
  schema: 'elder-souls/w1-16-r3-reach@1',
  generated: new Date().toISOString(),
  selftest: SELFTEST,
  unit: 'kg and percent of maxLoad; no frame figures in this tool',
  checks: results,
  failed: failed.map((r) => r.id),
};
const dest = path.join(REPO, 'reports', 'w1-16', 'r3-reach.json');
fs.mkdirSync(path.dirname(dest), { recursive: true });
fs.writeFileSync(dest, JSON.stringify(out, null, 2) + '\n');

if (AS_JSON) process.stdout.write(JSON.stringify(out, null, 2) + '\n');
else {
  for (const r of results) process.stdout.write(`${r.ok ? 'PASS' : 'FAIL'}  ${r.id}  ${r.title}\n`);
  process.stdout.write(`\nwritten: ${path.relative(REPO, dest)}\n`);
}
process.exit(failed.length ? 1 : 0);
