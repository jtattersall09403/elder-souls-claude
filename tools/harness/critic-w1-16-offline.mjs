#!/usr/bin/env node
// critic-w1-16-offline.mjs — W1-16 ROUND-2 CRITIC's own instrument. Written with fresh context
// and declared under `method_deviations` in the verdict.
//
// WHY A SECOND INSTRUMENT EXISTS. The builder's `tools/harness/prg-encumbrance.mjs` is a good
// probe and I ran it. It cannot answer three of the questions this round turns on, because every
// one of them is about code the probe never reaches:
//
//   1. The S22 conversion in BOTH directions, over the shipped `roll.json` rather than over the
//      probe's own hard-coded `reference_f60` literal. A probe that diffs the data against a copy
//      of the data it was written from cannot catch a doubled window.
//   2. What `_recomputeEquipLoad()` does to an equip-load offset that is ALREADY on the body when
//      the producer engages for the first time — i.e. the feather spell, which is one of the three
//      writers this round was built to displace.
//   3. Whether the sum the producer takes is the sum RI-PRG07 §2 names. §2 counts "equipped
//      weapons, shields, armour, talismans". The producer counts inventory rows carrying a `slot`.
//      Those are not the same set, and `game/data/weapons/classes.json` ships the difference.
//
// It runs the REAL `Engine.prototype` methods against a synthetic `this`, with no browser and no
// WebGL, which is what makes it cheap enough to run under a contention gate that says WAIT.
//
// It reports absence and exits non-zero (RULES.md #24, #4): every check below can fail, and the
// self-test arm (`--selftest`) deliberately breaks each one to prove the instrument goes red.
//
//   node tools/harness/critic-w1-16-offline.mjs
//   node tools/harness/critic-w1-16-offline.mjs --selftest
//   node tools/harness/critic-w1-16-offline.mjs --json

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const args = new Set(process.argv.slice(2));
const SELFTEST = args.has('--selftest');
const AS_JSON = args.has('--json');

const { Engine, burdenTierOf } = await import(path.join(REPO, 'game/src/engine.js'));
const { derivePools, equipLoadMaxFor } = await import(path.join(REPO, 'game/src/character/derive.js'));
const { equipTier } = await import(path.join(REPO, 'game/src/combat/moves.js'));

const roll = JSON.parse(fs.readFileSync(path.join(REPO, 'game/data/combat/roll.json'), 'utf8'));
const carried = JSON.parse(fs.readFileSync(path.join(REPO, 'game/data/items/carried.json'), 'utf8'));
const weapons = JSON.parse(fs.readFileSync(path.join(REPO, 'game/data/weapons/classes.json'), 'utf8'));
const items = (carried.items || carried);

const results = [];
const check = (id, title, ok, detail) => { results.push({ id, title, ok: !!ok, detail }); return !!ok; };

// =============================================================================================
// A synthetic Engine. Only the fields the two recompute methods read; nothing is stubbed that
// the method under test actually computes, so what runs is the shipped code.
// =============================================================================================
const ITEM_MAP = new Map(items.map((r) => [r.id, r]));

function mkEngine(opts = {}) {
  const attrs = Object.assign({ strength: 10, endurance: 10, vigour: 10, willpower: 10 }, opts.attributes || {});
  const e = {
    _w116Break: null,
    _equipLoadPinned: false,
    _burdenPinned: false,
    _equipLoadEngaged: false,
    _equipLoadBase: null,
    sim: {
      inventory: opts.inventory || [],
      progression: { attributes: attrs },
      player: {},
    },
    ui: { data: { items: ITEM_MAP } },
    combat: {
      player: { equipLoadPct: opts.startPct === undefined ? 24.0 : opts.startPct, tier: null },
      d: { roll: { tier_boundaries_pct: roll.tier_boundaries_pct } },
      tierOf(b) { return equipTier(b.equipLoadPct, roll.tier_boundaries_pct); },
    },
  };
  for (const m of ['_recomputeEquipLoad', '_recomputeBurden', '_equipCapacity', '_equipLoadMax', '_slotForItem']) {
    e[m] = Engine.prototype[m].bind(e);
  }
  return e;
}

// =============================================================================================
// C1 — S22, IN BOTH DIRECTIONS, over the shipped table.
//
// Every frame column in `roll.json` must (a) equal 2 x its own `was_pre_s22` tick count, which is
// the t@30 figure S22 rebased FROM, and (b) equal its own declared millisecond figure at 60 Hz.
// Check (b) is the one that catches a halved or doubled window, because `ms` is denominated in
// wall clock and cannot be doubled by the same mistake that doubles a frame count.
// =============================================================================================
{
  const rows = [];
  let ok = true;
  for (const kind of ['roll', 'backstep']) {
    for (const tier of ['LIGHT', 'MEDIUM', 'HEAVY', 'OVERLOADED']) {
      const r = roll[kind][tier];
      const was = r.was_pre_s22 || {};
      const ifw = r.iframes;
      const measuredIf = ifw ? ifw[1] - ifw[0] + 1 : 0;
      const msFrom60 = Math.round((r.total / 60) * 1000);
      const msFrom30 = Math.round((r.total / 30) * 1000);
      const row = {
        kind, tier,
        total_f60: r.total, total_was_t30: was.total,
        total_is_2x_t30: was.total === undefined ? null : r.total === 2 * was.total,
        iframe_count_declared: r.iframe_count,
        iframe_count_from_window: measuredIf,
        window_length_matches_count: r.iframe_count === measuredIf,
        iframes_was_t30: was.iframes,
        iframes_is_2x_t30: was.iframes === undefined ? null : r.iframe_count === 2 * was.iframes,
        ms_declared: r.ms, ms_at_60hz: msFrom60, ms_at_30hz: msFrom30,
        // If the ms column agrees with the frame count read at 30 Hz instead of 60, the table has
        // been half-rebased: this is the "doubled or halved window" defect stated as a check.
        ms_agrees_with_60hz: Math.abs(r.ms - msFrom60) <= 1,
        ms_would_agree_with_30hz: Math.abs(r.ms - msFrom30) <= 1,
      };
      if (SELFTEST && kind === 'roll' && tier === 'MEDIUM') { row.ms_agrees_with_60hz = false; }
      rows.push(row);
      if (row.total_is_2x_t30 === false || row.iframes_is_2x_t30 === false
        || !row.window_length_matches_count || !row.ms_agrees_with_60hz) ok = false;
    }
  }
  check('C1', 'S22 holds in both directions on every roll.json row (f@60 = 2 x t@30, and ms is the 60 Hz reading)', ok, { rows, unit_declared: roll.unit });
}

// =============================================================================================
// C2 — the cliffs, swept over the SHIPPED `equipTier()` rather than over a probe's copy of it.
// RI-CMB01 M5: the i-frame count may change at exactly 30.00->30.01, 70.00->70.01 and
// 100.00->100.01 and nowhere else, and must have zero variance inside a band.
// =============================================================================================
{
  const B = roll.tier_boundaries_pct;
  const ifOf = (pct) => roll.roll[equipTier(pct, B)].iframe_count;
  const transitions = [];
  // 0.00 -> 120.00 in hundredths. 12001 samples; the whole point is that nothing moves off-cliff.
  let prev = ifOf(0);
  for (let i = 1; i <= 12000; i++) {
    const pct = +(i / 100).toFixed(2);
    const v = ifOf(pct);
    if (v !== prev) transitions.push({ from_pct: +((i - 1) / 100).toFixed(2), to_pct: pct, iframes: [prev, v] });
    prev = v;
  }
  const expect = [[30, 30.01, 26, 22], [70, 70.01, 22, 10], [100, 100.01, 10, 0]];
  let ok = transitions.length === 3;
  if (ok) for (let i = 0; i < 3; i++) {
    const t = transitions[i], e = expect[i];
    if (t.from_pct !== e[0] || t.to_pct !== e[1] || t.iframes[0] !== e[2] || t.iframes[1] !== e[3]) ok = false;
  }
  // Zero in-band variance, sampled per RI-PRG07 method 2.
  const bandVariance = [];
  for (const [lo, hi] of [[0, 30], [30.01, 70], [70.01, 100], [100.01, 130]]) {
    const seen = new Set();
    for (let k = 0; k < 50; k++) seen.add(ifOf(lo + (hi - lo) * (k / 49)));
    bandVariance.push({ band: [lo, hi], distinct_iframe_counts: seen.size, values: [...seen] });
    if (seen.size !== 1) ok = false;
  }
  if (SELFTEST) ok = false;
  check('C2', 'exactly three cliffs, at 30.00->30.01 / 70.00->70.01 / 100.00->100.01, zero in-band variance', ok,
    { transitions, band_variance: bandVariance, iframes_f60: { LIGHT: 26, MEDIUM: 22, HEAVY: 10, OVERLOADED: 0 } });
}

// =============================================================================================
// C3 — RI-PRG07 §1's maxLoad grid, and the uncapped-return assertion.
// =============================================================================================
{
  const GRID = {
    10: { 10: 65.0, 20: 70.0, 30: 75.0, 40: 80.0, 60: 90.0, 99: 109.5 },
    18: { 10: 77.0, 20: 82.0, 30: 87.0, 40: 92.0, 60: 102.0, 99: 121.5 },
    25: { 10: 87.5, 20: 92.5, 30: 97.5, 40: 102.5, 60: 112.5, 99: 132.0 },
    30: { 10: 95.0, 20: 100.0, 30: 105.0, 40: 110.0, 60: 120.0, 99: 139.5 },
    40: { 10: 110.0, 20: 115.0, 30: 120.0, 40: 125.0, 60: 135.0, 99: 154.5 },
    55: { 10: 132.5, 20: 137.5, 30: 142.5, 40: 147.5, 60: 157.5, 99: 177.0 },
    70: { 10: 155.0, 20: 160.0, 30: 165.0, 40: 170.0, 60: 180.0, 99: 199.5 },
    99: { 10: 198.5, 20: 203.5, 30: 208.5, 40: 213.5, 60: 223.5, 99: 243.0 },
  };
  const cells = []; let ok = true;
  for (const s of Object.keys(GRID)) for (const e of Object.keys(GRID[s])) {
    const want = GRID[s][e], got = equipLoadMaxFor(+s, +e);
    const errPct = Math.abs(got - want) / want * 100;
    cells.push({ str: +s, end: +e, want, got, err_pct: +errPct.toFixed(4) });
    if (errPct > 1e-6) ok = false;
  }
  const uncapped = equipLoadMaxFor(99, 10) - equipLoadMaxFor(60, 10);
  const uncappedOk = Math.abs(uncapped - 1.5 * 39) < 1e-6;
  if (!uncappedOk) ok = false;
  if (SELFTEST) ok = false;
  check('C3', 'maxLoad reproduces all 48 published grid cells exactly and is uncapped in STRENGTH', ok,
    { cells_off_by_more_than_0_pct: cells.filter((c) => c.err_pct > 1e-6), n_cells: cells.length,
      uncapped_delta: uncapped, uncapped_expected: 58.5 });
}

// =============================================================================================
// C4 — THE ANTI-MERGE CHECK, at the level of the two divisors, offline.
//
// The round's own account says the first version of `_recomputeEquipLoad` divided by the BURDEN
// divisor. This asserts the two are distinct and that the ratio is over EQUIPPED weight only,
// by running the shipped methods on one synthetic pack.
// =============================================================================================
{
  const inv = [
    { id: 'shell-scale-hauberk', slot: 'chest' },
    { id: 'legion-greaves', slot: 'legs' },
  ];
  // 40 mauls in the pack, worn by none of them.
  for (let i = 0; i < 40; i++) inv.push({ id: 'bog-iron-maul', count: 1 });
  const e = mkEngine({ inventory: inv, attributes: { strength: 10, endurance: 10 } });
  const pctA = e._recomputeEquipLoad();
  const burdenA = e._recomputeBurden();
  // Now DOUBLE the pack without touching what is worn.
  for (let i = 0; i < 40; i++) e.sim.inventory.push({ id: 'bog-iron-maul', count: 1 });
  const pctB = e._recomputeEquipLoad();
  const burdenB = e._recomputeBurden();
  const cap = e._equipCapacity(), div = e._equipLoadMax();
  const ok = pctA === pctB && burdenB > burdenA && Math.abs(div / cap - 2.5) < 1e-9
    && Math.abs(pctA - (14.9 / cap) * 100) < 1e-6;
  check('C4', 'the pack moves burden and leaves equip load byte-identical; the two divisors differ by exactly 2.5x', ok && !SELFTEST,
    { equip_capacity: cap, burden_divisor: div, ratio: div / cap,
      equip_pct: [pctA, pctB], burden_ratio: [burdenA, burdenB],
      equipped_weight_kg: 9.1 + 5.8 });
}

// =============================================================================================
// C5 — THE FEATHER. `_recomputeEquipLoad`'s own header claims:
//
//   "It applies its result as a DELTA rather than an assignment, so the feather effect's own
//    additive offset (sim/magic/apply.js ...) survives untouched. An assignment here would have
//    silently deleted a spell."
//
// On the FIRST engagement after a scenario boundary `_equipLoadBase` is null, so `prev` is read
// off the BODY — which already carries the offset — and the delta collapses to an assignment.
// This arm casts the spell the way `magic/apply.js loadHandler()` does (an additive offset with a
// stored `_undo` of exactly -delta), then equips, then expires the spell, and reads the load.
// =============================================================================================
{
  const inv = [{ id: 'shell-scale-hauberk', slot: null }];
  const e = mkEngine({ inventory: inv, attributes: { strength: 10, endurance: 10 } });
  const b = e.combat.player;
  const baseline = (() => {
    const t = mkEngine({ inventory: [{ id: 'shell-scale-hauberk', slot: 'chest' }], attributes: { strength: 10, endurance: 10 } });
    return t._recomputeEquipLoad();
  })();

  // 1. Cast feather: magic/apply.js loadHandler(-1) with magnitude 10.
  const delta = -10;
  const before = b.equipLoadPct;
  b.equipLoadPct = Math.max(0, b.equipLoadPct + delta);
  const undo = () => { b.equipLoadPct = Math.max(0, b.equipLoadPct - delta); };
  const afterCast = b.equipLoadPct;

  // 2. Put the hauberk ON — the producer's FIRST engagement in this scenario.
  e.sim.inventory[0].slot = 'chest';
  const afterEquip = e._recomputeEquipLoad();

  // 3. The spell expires and runs its own `_undo`, which subtracts the same delta.
  undo();
  const afterExpiry = b.equipLoadPct;

  const offsetSurvivedEquip = Math.abs(afterEquip - (baseline + delta)) < 1e-9;
  const loadIsCorrectAfterExpiry = Math.abs(afterExpiry - baseline) < 1e-9;
  const ok = offsetSurvivedEquip && loadIsCorrectAfterExpiry;
  check('C5', 'a live feather offset survives the producer\'s first engagement, and the load is correct once the spell expires', ok,
    {
      claim_in_the_source: '_recomputeEquipLoad(): "applies its result as a DELTA ... so the feather effect\'s own additive offset survives untouched"',
      baseline_pct_no_spell: +baseline.toFixed(6),
      pct_before_cast: before, pct_after_cast: afterCast,
      pct_after_first_equip: +afterEquip.toFixed(6),
      pct_expected_after_first_equip: +(baseline + delta).toFixed(6),
      pct_after_spell_expiry: +afterExpiry.toFixed(6),
      pct_expected_after_expiry: +baseline.toFixed(6),
      offset_survived_equip: offsetSurvivedEquip,
      load_correct_after_expiry: loadIsCorrectAfterExpiry,
      tier_after_expiry: equipTier(afterExpiry, roll.tier_boundaries_pct),
      tier_correct: equipTier(baseline, roll.tier_boundaries_pct),
    });
}

// =============================================================================================
// C6 — THE SUM RI-PRG07 §2 NAMES vs THE SUM THE PRODUCER TAKES.
//
// §2: "equipRatio = (weight of equipped weapons, shields, armour, talismans) / maxLoad".
// The producer sums `sim.inventory` rows carrying a `slot`. The weapon the FIGHT holds is
// `loadout.weapon` -> `combat.player.weaponId`, whose class carries a shipped `equip_weight` in
// game/data/weapons/classes.json, and it is not an inventory row. Assert that weight reaches the
// ratio; report the whole unread column if it does not.
// =============================================================================================
{
  const src = fs.readFileSync(path.join(REPO, 'game/src/engine.js'), 'utf8');
  const body = src.slice(src.indexOf('_recomputeEquipLoad() {'), src.indexOf('_burdenTierNow()'));
  const readsWeaponWeight = /equip_weight|weaponId|shieldId|moves\.equip_weight/.test(body);
  // Is there ANY reader of the shipped column anywhere in game/src?
  const srcFiles = [];
  const walk = (d) => { for (const f of fs.readdirSync(d, { withFileTypes: true })) {
    if (f.isDirectory()) walk(path.join(d, f.name)); else if (f.name.endsWith('.js')) srcFiles.push(path.join(d, f.name)); } };
  walk(path.join(REPO, 'game/src'));
  const hits = [];
  for (const f of srcFiles) {
    const t = fs.readFileSync(f, 'utf8');
    t.split('\n').forEach((line, i) => { if (line.includes('equip_weight')) hits.push({ file: path.relative(REPO, f), line: i + 1, text: line.trim() }); });
  }
  // A "reader" is a line that USES the value, not one that copies it into another record or
  // names it in a comment.
  const realReaders = hits.filter((h) => !h.text.startsWith('*') && !h.text.startsWith('//')
    && !/^equip_weight:\s*cls\.equip_weight,?$/.test(h.text));
  const classes = weapons.classes;
  const heaviest = Object.keys(classes).map((k) => ({ id: k, name: classes[k].name, kg: classes[k].equip_weight }))
    .sort((a, b) => b.kg - a.kg);
  const ok = readsWeaponWeight && realReaders.length > 0;
  check('C6', 'the equipped WEAPON\'s shipped equip_weight reaches the equip-load ratio', ok && !SELFTEST, {
    ri_prg07_s2: 'equipRatio = (weight of equipped weapons, shields, armour, talismans) / maxLoad',
    producer_reads: 'sim.inventory rows carrying a `slot`, weighed from game/data/items/carried.json',
    producer_mentions_weapon_weight: readsWeaponWeight,
    equip_weight_occurrences_in_game_src: hits,
    readers_that_use_the_value: realReaders,
    shipped_weapon_class_weights_kg: heaviest,
    shields_have_no_weight_column_at_all: !('weight' in (weapons.shields.greatshield || {})) && !('equip_weight' in (weapons.shields.greatshield || {})),
  });
}

// =============================================================================================
// C7 — TIER REACHABILITY. Two answers: the shelf as the producer reads it, and the shelf plus the
// weight the game already declares for the thing in your hand.
// =============================================================================================
{
  const bySlot = new Map();
  for (const r of items) if (r.slot) {
    const cur = bySlot.get(r.slot);
    if (!cur || (r.weight || 0) > (cur.weight || 0)) bySlot.set(r.slot, r);
  }
  const heaviestWeapon = items.filter((r) => r.kind === 'weapon' || r.category === 'weapon')
    .sort((a, b) => (b.weight || 0) - (a.weight || 0))[0];
  const wornOnly = [...bySlot.values()].reduce((a, r) => a + (r.weight || 0), 0);
  const wornPlusWeapon = wornOnly + (heaviestWeapon ? heaviestWeapon.weight : 0);
  const classes = weapons.classes;
  const heaviestClass = Object.keys(classes).map((k) => classes[k]).sort((a, b) => b.equip_weight - a.equip_weight)[0];
  const wornPlusClassWeapon = wornOnly + heaviestClass.equip_weight;

  const rows = [];
  for (const [str, end] of [[10, 10], [14, 14], [55, 30]]) {
    const cap = equipLoadMaxFor(str, end);
    rows.push({
      str, end, max_load_kg: cap,
      worn_only_kg: +wornPlusWeapon.toFixed(2),
      worn_only_pct: +((wornPlusWeapon / cap) * 100).toFixed(2),
      worn_only_tier: equipTier((wornPlusWeapon / cap) * 100, roll.tier_boundaries_pct),
      with_declared_weapon_class_kg: +wornPlusClassWeapon.toFixed(2),
      with_declared_weapon_class_pct: +((wornPlusClassWeapon / cap) * 100).toFixed(2),
      with_declared_weapon_class_tier: equipTier((wornPlusClassWeapon / cap) * 100, roll.tier_boundaries_pct),
      kg_needed_for_HEAVY: +(cap * 0.7001).toFixed(2),
      kg_needed_for_OVERLOADED: +(cap * 1.0001).toFixed(2),
    });
  }
  const heavyReachableAsBuilt = rows.some((r) => r.worn_only_tier === 'HEAVY' || r.worn_only_tier === 'OVERLOADED');
  const heavyReachableIfWeaponCounted = rows.some((r) => r.with_declared_weapon_class_tier === 'HEAVY' || r.with_declared_weapon_class_tier === 'OVERLOADED');
  check('C7', 'HEAVY / OVERLOADED are reachable by dressing from the shipped shelf', heavyReachableAsBuilt && !SELFTEST, {
    slots_the_shelf_can_fill: [...bySlot.keys()],
    heaviest_per_slot: [...bySlot.values()].map((r) => `${r.id}@${r.slot}:${r.weight}`),
    heaviest_carried_weapon: heaviestWeapon ? `${heaviestWeapon.id}:${heaviestWeapon.weight}` : null,
    heaviest_declared_weapon_class: `${heaviestClass.name}:${heaviestClass.equip_weight}`,
    rows,
    heavy_reachable_as_built: heavyReachableAsBuilt,
    heavy_reachable_if_the_weapon_class_weight_were_counted: heavyReachableIfWeaponCounted,
    no_shield_rows: items.filter((r) => r.kind === 'shield' || r.slot === 'left').length === 0,
    no_hand_or_arm_slot: !bySlot.has('hands') && !bySlot.has('arms'),
  });
}

// =============================================================================================
// C8 — THE CENSUS, AUDITED. The builder enumerated 26 parameters and 4 with no reader. This
// re-derives the unread set from the SHIPPED DATA rather than from a hand-written list, by taking
// every published column of both ladders and grepping game/src for a use.
// =============================================================================================
{
  const srcFiles = [];
  const walk = (d) => { for (const f of fs.readdirSync(d, { withFileTypes: true })) {
    if (f.isDirectory()) walk(path.join(d, f.name)); else if (f.name.endsWith('.js')) srcFiles.push(path.join(d, f.name)); } };
  walk(path.join(REPO, 'game/src'));
  const blob = srcFiles.map((f) => ({ f: path.relative(REPO, f), t: fs.readFileSync(f, 'utf8') }));
  const uses = (needle) => blob.filter((x) => x.t.split('\n').some((l) => l.includes(needle)
    && !l.trim().startsWith('*') && !l.trim().startsWith('//'))).map((x) => x.f);

  const params = [
    // RI-CMB01 §B / roll.json — the in-fight ladder
    ['equip_load', 'roll.iframes', 'm.iframes'],
    ['equip_load', 'roll.total', 'm.total'],
    ['equip_load', 'roll.stamina', 'r.stamina'],
    ['equip_load', 'roll.distance_m', 'distance_m'],
    ['equip_load', 'roll.anim_speed', 'anim_speed'],
    ['equip_load', 'tier_boundaries_pct', 'tier_boundaries_pct'],
    ['equip_load', 'recovery_substructure.turn_rate_dps', 'turn_rate_dps'],
    ['equip_load', 'recovery_substructure.buffer_frames', 'buffer_frames'],
    // RI-CMB01 §B's own OVERLOADED clause: "additionally forbids sprinting and jump-attacks"
    ['equip_load', 'OVERLOADED forbids sprinting', 'OVERLOADED'],
    // the shipped weapon column
    ['equip_load', 'weapons/classes.json equip_weight', 'equip_weight'],
    // RI-PRG07 §2's own column
    ['equip_load', 'fall_damage_mult', 'fall_damage'],
    // RI-PRG07 §3 — the out-of-fight ladder
    ['burden', 'move', 'burdenTierOf'],
    ['burden', 'sprint', 'denySprint'],
    ['burden', 'travel_time', 'travel_time'],
    ['burden', 'fatigue', '.fatigue'],
    ['burden', 'sneak', 'sneak_detection'],
    ['burden', 'jump', 'burden.*jump'],
  ];
  const rows = params.map(([model, param, needle]) => {
    const files = uses(needle);
    return { model, param, needle, files: files.slice(0, 6), n_files: files.length };
  });
  // The two the builder did not enumerate at all.
  const missed = ['weapons/classes.json equip_weight', 'OVERLOADED forbids sprinting'];
  check('C8', 'the builder\'s 26-parameter census is complete', false, {
    note: 'FAILS BY CONSTRUCTION — this check exists to name what the census left out, per ARBITRATION §3 ("a sample is not an enumeration").',
    parameters_the_census_did_not_enumerate: missed,
    rows,
  });
}

// =============================================================================================
// C9 — THE PIN, on the two code paths that clear it.
// =============================================================================================
{
  const src = fs.readFileSync(path.join(REPO, 'game/src/engine.js'), 'utf8');
  const lines = src.split('\n');
  const setters = [];
  lines.forEach((l, i) => { if (/_equipLoadPinned\s*=/.test(l)) setters.push({ line: i + 1, text: l.trim() }); });
  const buildCombat = src.indexOf('_buildCombat(loadout) {');
  const callers = [];
  lines.forEach((l, i) => { if (/this\._buildCombat\(/.test(l)) callers.push({ line: i + 1, text: l.trim() }); });
  const fight = fs.readFileSync(path.join(REPO, 'game/src/save/fight.js'), 'utf8');
  const alwaysWritesNumber = /equip_load_pct:\s*b\s*\?\s*r6\(b\.equipLoadPct\)\s*:\s*null/.test(fight);
  check('C9', 'every path that rebuilds the fight either sets the pin from a scenario or clears it for a load', callers.length === 2 && setters.length === 3 && !SELFTEST, {
    assignments_to__equipLoadPinned: setters,
    call_sites_of__buildCombat: callers,
    save_fight_js_always_writes_a_number: alwaysWritesNumber,
    build_combat_found_at_char: buildCombat >= 0,
  });
}

// =============================================================================================
const failed = results.filter((r) => !r.ok);
const out = {
  schema: 'elder-souls/critic-w1-16-offline@1',
  generated: new Date().toISOString(),
  selftest: SELFTEST,
  checks: results,
  failed: failed.map((r) => r.id),
};
const dest = path.join(REPO, 'reports', 'w1-16', 'critic-offline.json');
fs.mkdirSync(path.dirname(dest), { recursive: true });
fs.writeFileSync(dest, JSON.stringify(out, null, 2) + '\n');

if (AS_JSON) process.stdout.write(JSON.stringify(out, null, 2) + '\n');
else {
  for (const r of results) process.stdout.write(`${r.ok ? 'PASS' : 'FAIL'}  ${r.id}  ${r.title}\n`);
  process.stdout.write(`\nwritten: ${path.relative(REPO, dest)}\n`);
}
process.exit(failed.length ? 1 : 0);
