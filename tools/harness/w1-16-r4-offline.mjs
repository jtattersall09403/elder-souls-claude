#!/usr/bin/env node
// w1-16-r4-offline.mjs — W1-16 ROUND 4, the half that needs no browser.
//
// Six checks against the REAL `Engine.prototype` methods bound to a synthetic `this`, plus the
// real `saveLoadout()` out of `game/src/save/fight.js` and the shipped data. One per thing the
// round-3 verdict adjudicated against the round. `--selftest` sets the matching `__breakW116` arm
// and EVERY ONE MUST GO RED — a check that cannot fail is not evidence (RULES #4, #6).
//
//   R1  RI-PRG07 §3, verbatim: "weight of ALL carried items, EQUIPPED OR NOT". The hands and the
//       talisman are carried items, so they must move burden — and one object must have ONE
//       weight, the same number in both ratios.                       arm: `burdenhands`
//   R2  RI-PRG07 §2's FOURTH TERM. A talisman has a slot, a weight and a reader, and it reaches
//       BOTH ratios.                                                  arm: `talisman`
//   R3  THE FEATHER CLAMP, AT BOTH ENDS. Apply and undo are exact inverses at every magnitude,
//       including magnitudes larger than the load — which is the case that used to leave the
//       caster a roll tier HEAVIER, permanently.                      arm: `feather`
//   R4  THE PRODUCER IS IDEMPOTENT AND THE OFFSET IS SEPARATE. `pct = max(0, base + offset)`, so
//       recomputing twice moves nothing and a live spell survives a re-equip with no delta-origin
//       state anywhere. This is the root-cause repair the round-3 verdict §C prescribed in place
//       of round 3's construction-site seeding.                       arm: `feather`
//   R5  THE PIN IS A FIELD THE SAVE CARRIES. `_publishEquipLoad()` is the sole writer of
//       `sim.player.equipLoadPinned` and the REAL `saveLoadout()` reads it back. The running-world
//       half — RULES #7, audit after a load — is `w1-16-r4-live.mjs --probe pinfight` and is not
//       claimed here.                                                 arm: `savepin`
//   R6  THE REFUSAL HAS AN AUDIENCE. Pressing equip on something that cannot be equipped puts a
//       line a person can read on the shipped player-visible channel, and does NOT pipe the raw
//       diagnostic (87 internal weapon ids) onto the HUD.             arm: `toast`
//
//   node tools/harness/w1-16-r4-offline.mjs [--selftest] [--json]

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const args = new Set(process.argv.slice(2));
const SELFTEST = args.has('--selftest');
const AS_JSON = args.has('--json');

const { Engine } = await import(path.join(REPO, 'game/src/engine.js'));
const { equipTier } = await import(path.join(REPO, 'game/src/combat/moves.js'));
const { saveLoadout } = await import(path.join(REPO, 'game/src/save/fight.js'));

const rd = (p) => JSON.parse(fs.readFileSync(path.join(REPO, p), 'utf8'));
const roll = rd('game/data/combat/roll.json');
const carried = rd('game/data/items/carried.json');
const weapons = rd('game/data/weapons/classes.json');
const stamina = rd('game/data/combat/stamina.json');
const castClasses = rd('game/data/magic/cast-classes.json');
const items = carried.items || carried;
const B = roll.tier_boundaries_pct;
const ITEM_MAP = new Map(items.map((r) => [r.id, r]));

const results = [];
const check = (id, title, ok, detail) => { results.push({ id, title, ok: !!ok, detail }); return !!ok; };
const r6 = (v) => +Number(v).toFixed(6);

/** The arm `--selftest` sets for a given check. Named per check so each teardown is watched. */
const ARM = { R1: 'burdenhands', R2: 'talisman', R3: 'feather', R4: 'feather', R5: 'savepin', R6: 'toast' };
const brk = (id) => (SELFTEST ? { [ARM[id]]: true } : null);

const UGS = weapons.classes.UGS.equip_weight;
const NAGA = (stamina.block.shields.naga_tower || {}).weight;

/**
 * A synthetic Engine carrying every field the methods under test read. `handWeapon`/`handShield`
 * populate the two objects the producer reads on the body (`moves._weapon`, `shield`), and
 * `catalyst` populates the one the fourth term reads on the MagicSystem — so all four of
 * RI-PRG07 §2's terms are under test here rather than stubbed away.
 */
function mkEngine(opts = {}) {
  const attrs = Object.assign({ strength: 10, endurance: 10, vigour: 10, willpower: 10 }, opts.attributes || {});
  const e = {
    _w116Break: opts.brk || null,
    _equipLoadPinned: !!opts.pinned,
    _equipLoadPinValue: opts.pinned === undefined ? null : opts.pinned,
    _equipLoadOffset: 0,
    _burdenPinned: false,
    _equipLoadEngaged: false,
    _equipLoadBase: opts.seedBase === undefined ? null : opts.seedBase,
    toasts: [],
    data: { magic: { 'cast-classes': castClasses } },
    magic: { catalyst: opts.catalyst || 'none' },
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
  // The player-visible channel, recorded rather than drawn. `uiToast()` itself calls `ui.build()`,
  // which needs the whole interface; what R6 is asking is whether the engine reaches for it at
  // all, so the stub records the call and the ASSERTION is about the text that arrives.
  e.uiToast = (text, frames) => { e.toasts.push({ text: text === null ? null : String(text), frames }); return { text, frames }; };
  for (const m of ['_recomputeEquipLoad', '_recomputeBurden', '_equipCapacity', '_equipLoadMax',
    '_slotForItem', '_handWeights', '_publishEquipLoad', '_addEquipLoadOffset', '_slotLabel', '_sayEquip']) {
    e[m] = Engine.prototype[m].bind(e);
  }
  return e;
}

// =============================================================================================
// R1 — RI-PRG07 §3: "weight of ALL carried items, EQUIPPED OR NOT".
//
// Round 3 moved the weapon and the shield out of the inventory sum and into a hands term. Right
// for §2, and it left the hands in the equip ratio and in NEITHER burden term: 33 kg of ultra
// greatsword and Naga tower moved the roll a whole tier and moved `carried_weight` by zero.
// Second half of the same defect: one object with two weights, because the pack row is skipped by
// §2 and counted by §3 while the class weight is counted by §2 only.
// =============================================================================================
{
  const mk = (inv) => mkEngine({
    inventory: inv,
    handWeapon: { id: 'ugs_golem_sword', kg: UGS, cls: 'UGS' },
    handShield: { id: 'naga_tower', kg: NAGA },
    seedBase: 0, startPct: 0, brk: brk('R1'),
  });
  // Bare hands-only character: nothing in the pack at all, the heaviest hands in the game.
  const bare = mk([]);
  const barePct = bare._recomputeEquipLoad();
  const bareBurden = bare._recomputeBurden();
  const handsKg = UGS + NAGA;

  // The maul, the object the round-3 verdict named: 11.5 kg in carried.json, 16 kg as GHM.
  const maul = ITEM_MAP.get('bog-iron-maul');
  const inPack = mkEngine({ inventory: [{ id: 'bog-iron-maul', slot: null }], seedBase: 0, startPct: 0, brk: brk('R1') });
  inPack._recomputeEquipLoad(); const packCarried = inPack._recomputeBurden() * inPack._equipLoadMax();
  const inHand = mkEngine({
    inventory: [{ id: 'bog-iron-maul', slot: 'right' }],
    handWeapon: { id: 'ghm_bog_maul', kg: weapons.classes.GHM.equip_weight, cls: 'GHM' },
    seedBase: 0, startPct: 0, brk: brk('R1'),
  });
  inHand._recomputeEquipLoad(); const handCarried = inHand._recomputeBurden() * inHand._equipLoadMax();

  const handsMoveBurden = Math.abs(bare.sim.player.carriedWeight - handsKg) < 1e-9;
  const oneObjectOneWeight = Math.abs(handCarried - inHand.sim.player.equippedWeight) < 1e-9
    && Math.abs(handCarried - weapons.classes.GHM.equip_weight) < 1e-9;

  check('R1', 'RI-PRG07 §3 "equipped or not": worn and held weight moves burden, and one object has ONE weight in both ratios',
    handsMoveBurden && oneObjectOneWeight, {
      ri_prg07_s3: 'burdenRatio = (weight of ALL carried items, equipped or not) / (maxLoad x 2.5)',
      hands_kg: handsKg,
      bare_equip_load_pct: r6(barePct),
      bare_burden_ratio: r6(bareBurden),
      bare_carried_weight_kg: r6(bare.sim.player.carriedWeight),
      the_hands_now_move_burden: handsMoveBurden,
      round_3_answer_for_the_same_fixture: '0.0 kg carried, 0.000000 burden, UNBURDENED',
      one_object_two_weights_was: { carried_json_kg: maul.weight, weapon_class_kg: weapons.classes.GHM.equip_weight },
      maul_in_the_pack_kg: r6(packCarried),
      maul_in_the_hand_kg_to_burden: r6(handCarried),
      maul_in_the_hand_kg_to_the_roll: r6(inHand.sim.player.equippedWeight),
      one_object_one_weight: oneObjectOneWeight,
      how: 'a `right`/`left` inventory row is skipped by BOTH ratios and the hands are priced once, '
        + 'in `_handWeights()`, from the fight\'s own loadout. Adding the pack row back would have '
        + 'been the other half of the same defect.',
      residual_not_fixed_here: 'carried.json prices the maul at 11.5 kg and weapons/classes.json at '
        + '16 kg. Both ratios now read 16 kg (the fight\'s own number), so they cannot disagree with '
        + 'each other, but the two REGISTRIES still disagree and nobody has ruled which is '
        + 'authoritative. That is a corpus round, not a builder\'s guess (round-3 verdict §C).',
    });
}

// =============================================================================================
// R2 — RI-PRG07 §2's FOURTH TERM. "equipRatio = (weight of equipped weapons, shields, armour,
// TALISMANS) / maxLoad". Before this round the token appeared in `game/src` only inside two
// comments quoting §2: no slot, no weight column, no reader, and not even a declared `null` in
// the consumption table — so the census could not count it as missing.
// =============================================================================================
{
  const talismanRows = items.filter((r) => r.slot === 'talisman' || r.kind === 'talisman');
  const cats = castClasses.catalysts;
  const weighted = cats.filter((c) => typeof c.equip_weight === 'number');

  const off = mkEngine({ inventory: [], catalyst: 'none', seedBase: 0, startPct: 0, brk: brk('R2') });
  const offPct = off._recomputeEquipLoad(); const offBurden = off._recomputeBurden();
  const on = mkEngine({ inventory: [], catalyst: 'rod', seedBase: 0, startPct: 0, brk: brk('R2') });
  const onPct = on._recomputeEquipLoad(); const onBurden = on._recomputeBurden();

  // The SLOT, through the real `_slotForItem` on the real shipped row.
  const slot = talismanRows.length ? off._slotForItem(ITEM_MAP.get(talismanRows[0].id)) : null;
  const rodKg = (cats.find((c) => c.id === 'rod') || {}).equip_weight;
  // `enchanted_weapon` is the equipped weapon and must NOT be weighed a second time.
  const dbl = mkEngine({
    catalyst: 'enchanted_weapon', handWeapon: { id: 'ugs_golem_sword', kg: UGS, cls: 'UGS' },
    seedBase: 0, startPct: 0, brk: brk('R2'),
  });
  dbl._recomputeEquipLoad();

  const ok = talismanRows.length > 0 && slot === 'talisman' && weighted.length === cats.length
    && Math.abs(on.sim.player.equippedWeight - offBurden * 0 - rodKg) < 1e-9
    && onPct > offPct && onBurden > offBurden
    && Math.abs(dbl.sim.player.equippedWeight - UGS) < 1e-9;

  check('R2', 'RI-PRG07 §2 term 4: a talisman has a SLOT, a WEIGHT and a READER, and it reaches BOTH ratios', ok, {
    slot_rows_in_carried_json: talismanRows.map((r) => ({ id: r.id, slot: r.slot, weight: r.weight, catalyst: r.catalyst })),
    slot_resolved_by__slotForItem: slot,
    catalyst_weights: cats.map((c) => ({ id: c.id, equip_weight: c.equip_weight })),
    weight_provenance: 'RI-PRG07 §4 "Talisman / catalyst": 3. Read from the corpus, not chosen.',
    no_catalyst: { equip_load_pct: r6(offPct), burden_ratio: r6(offBurden), equipped_kg: r6(off.sim.player.equippedWeight) },
    rod_equipped: { equip_load_pct: r6(onPct), burden_ratio: r6(onBurden), equipped_kg: r6(on.sim.player.equippedWeight) },
    reaches_both_ratios: onPct > offPct && onBurden > offBurden,
    enchanted_weapon_is_not_weighed_twice: Math.abs(dbl.sim.player.equippedWeight - UGS) < 1e-9,
    round_3_state: 'the token `talisman` appeared in game/src only inside two comments quoting §2',
  });
}

// =============================================================================================
// R3 — THE FEATHER CLAMP, AT BOTH ENDS.
//
// `sim/magic/apply.js loadHandler()` clamped the RUNNING TOTAL on both halves — max(0, pct+delta)
// on apply and max(0, pct-delta) on undo — which are not inverses. Round-3 verdict §E measured
// the consequence: 13.013699% LIGHT / 26 i-frames -> 0.000000% -> 42.833333% MEDIUM / 22, and it
// never comes back. Clamping the SUM instead makes them inverses at every magnitude.
// =============================================================================================
{
  const rows = [];
  // Magnitudes either side of the load, so the case that used to break is in the sweep.
  for (const mag of [5, 10, 13, 13.013699, 20, 30, 40, 90]) {
    const e = mkEngine({
      inventory: [{ id: 'shell-scale-hauberk', slot: 'chest' }],
      handWeapon: { id: 'ssw_garrison_sword', kg: weapons.classes.SSW.equip_weight, cls: 'SSW' },
      seedBase: 0, startPct: 0, brk: brk('R3'),
    });
    const before = e._recomputeEquipLoad();
    e._addEquipLoadOffset(-mag);                 // Feather: loadHandler(-1)
    const cast = e.combat.player.equipLoadPct;
    e._addEquipLoadOffset(+mag);                 // the spell expires and runs its _undo
    const expired = e.combat.player.equipLoadPct;
    rows.push({
      magnitude: mag, before: r6(before), after_cast: r6(cast), after_expiry: r6(expired),
      tier_before: equipTier(before, B), tier_after_expiry: equipTier(expired, B),
      returned_to_where_it_started: Math.abs(expired - before) < 1e-9,
      heavier_than_it_started: expired > before + 1e-9,
    });
  }
  const ok = rows.every((r) => r.returned_to_where_it_started);
  check('R3', 'the Feather clamp is fixed at BOTH ends: apply and undo are exact inverses at every magnitude, including magnitudes larger than the load', ok, {
    rows,
    the_case_that_used_to_break: 'magnitude 30 on a 13.013699% load: the apply lost 16.99 points to '
      + 'the floor and the undo added the full 30 back, so the caster ended at 42.833333% MEDIUM.',
    fix: 'the offset lives in `engine._equipLoadOffset` and `_publishEquipLoad()` clamps the SUM, '
      + 'so the offset is never the term that was clamped.',
    any_row_left_the_caster_heavier: rows.filter((r) => r.heavier_than_it_started).map((r) => r.magnitude),
  });
}

// =============================================================================================
// R4 — THE PRODUCER IS AN ASSIGNMENT AND THE OFFSET IS ITS OWN FIELD.
//
// Round 3 wrote `pct += (base - _equipLoadBase)` and had to seed the delta's origin at the
// construction site to stop the first engagement collapsing into an assignment. The round-3
// verdict §C adjudicated that as a symptom repair: "one mutable scalar with two writers and no
// separation between them". `pct = max(0, base + offset)` needs no delta origin, is idempotent,
// and lets a live spell survive an arbitrary number of re-equips.
// =============================================================================================
{
  const e = mkEngine({
    inventory: [{ id: 'shell-scale-hauberk', slot: null }, { id: 'legion-greaves', slot: null }],
    handWeapon: { id: 'ssw_garrison_sword', kg: weapons.classes.SSW.equip_weight, cls: 'SSW' },
    seedBase: undefined, startPct: 24.0, brk: brk('R4'),   // C5's own null-seed fixture
  });
  const first = e._recomputeEquipLoad();
  const again = e._recomputeEquipLoad();
  const idempotent = Math.abs(first - again) < 1e-12;
  e._addEquipLoadOffset(-10);
  const afterCast = e.combat.player.equipLoadPct;
  e.sim.inventory[0].slot = 'chest';                        // the producer's FIRST engagement
  const afterEquip1 = e._recomputeEquipLoad();
  e.sim.inventory[1].slot = 'legs';                         // and a second one
  const afterEquip2 = e._recomputeEquipLoad();
  const base2 = e._equipLoadBase;
  e._addEquipLoadOffset(+10);                               // expiry
  const afterExpiry = e.combat.player.equipLoadPct;

  const ok = idempotent
    && Math.abs(afterCast - Math.max(0, first - 10)) < 1e-9
    && Math.abs(afterEquip2 - Math.max(0, base2 - 10)) < 1e-9
    && Math.abs(afterExpiry - base2) < 1e-9;
  check('R4', 'the producer is idempotent and needs no delta origin: `pct = max(0, base + offset)` survives two re-equips with a live spell on it', ok, {
    fixture: 'C5\'s own null-seeded `_equipLoadBase`, which round 3 declared unpassable without a '
      + 'construction site. It passes here because the field it needed no longer exists.',
    first_recompute_pct: r6(first),
    second_recompute_pct: r6(again),
    idempotent,
    after_cast_pct: r6(afterCast),
    after_first_equip_pct: r6(afterEquip1),
    after_second_equip_pct: r6(afterEquip2),
    equipment_base_pct: r6(base2),
    spell_offset_pct: r6(e._equipLoadOffset),
    after_expiry_pct: r6(afterExpiry),
    expected_after_expiry_pct: r6(base2),
    the_spell_survived_both_equips: Math.abs(afterEquip2 - Math.max(0, base2 - 10)) < 1e-9,
  });
}

// =============================================================================================
// R5 — THE PIN IS A FIELD THE SAVE CARRIES, AND `_publishEquipLoad()` IS ITS SOLE WRITER.
//
// `equip_load_pct` alone cannot tell a DECLARED load from a DERIVED one, which is why
// `_restoreFightFromSave()` cleared the pin on every load (RULES #7, correctly) and why a pinned
// scenario lost its load across a save. This runs the REAL `saveLoadout()` from save/fight.js.
// The running-world half is `w1-16-r4-live.mjs --probe pinfight`; it is NOT claimed here.
// =============================================================================================
{
  const mk = (pinned) => {
    const e = mkEngine({
      inventory: [{ id: 'shell-scale-hauberk', slot: 'chest' }, { id: 'legion-greaves', slot: 'legs' }],
      handWeapon: { id: 'ssw_garrison_sword', kg: weapons.classes.SSW.equip_weight, cls: 'SSW' },
      pinned: pinned === false ? undefined : pinned, seedBase: 24.0, startPct: 24.0, brk: brk('R5'),
    });
    e._equipLoadPinned = pinned !== false;
    e._equipLoadPinValue = pinned === false ? null : pinned;
    if (pinned === false) e._recomputeEquipLoad(); else e._publishEquipLoad();
    // What `save/state.js` actually calls, with the real combat/magic/sim shapes it passes.
    const combat = { _playerLoadout: {}, player: e.combat.player, playerCtl: { flaskLevel: 0 } };
    const rec = saveLoadout(combat, { wil: 10 }, e.sim);
    return { pct: r6(e.combat.player.equipLoadPct), tier: e.combat.tierOf(e.combat.player), rec };
  };
  const pinnedRow = mk(24.0);          // `arena_duel` — declares its equip load
  const derivedRow = mk(false);        // a state that does not

  const ok = pinnedRow.rec.equip_load_pinned === true
    && derivedRow.rec.equip_load_pinned === false
    && pinnedRow.rec.equip_load_pct === 24
    && Math.abs(derivedRow.rec.equip_load_pct - derivedRow.pct) < 1e-9;
  check('R5', 'the save carries the PIN, not only its value: saveLoadout() writes equip_load_pinned true for a declared load and false for a derived one', ok, {
    what_the_save_records_for_a_pinned_fight: pinnedRow.rec,
    what_it_records_for_a_derived_one: derivedRow.rec,
    pinned_pct: pinnedRow.pct, pinned_tier: pinnedRow.tier,
    derived_pct: derivedRow.pct, derived_tier: derivedRow.tier,
    the_gap_this_closes: 'arena_duel + hauberk + greaves: 24.000000% LIGHT / 26 i-frames / 52 f@60 '
      + '-> 33.424658% MEDIUM / 22 i-frames / 60 f@60 across one saveRoundTrip() (round-3 verdict §G).',
    rules_7: 'the field is not trusted because it round-trips. `w1-16-r4-live.mjs --probe pinfight` '
      + 'saves and reloads every shipped state and reads the TIER back out of the running world.',
    sole_writer: 'Engine._publishEquipLoad(); mirror() does not touch it (sim/combat-bridge.js).',
  });
}

// =============================================================================================
// R6 — THE REFUSAL HAS AN AUDIENCE.
//
// Round-3 verdict §I: `anything_the_player_could_see_changed: false`. The reason was written onto
// the `equip_end` event and nothing under `game/src/ui/` or `game/src/render/` reads `equip_end`
// or `.refused`. The remedy is a line on the shipped channel — and NOT the raw reason, which
// names 87 internal weapon ids.
// =============================================================================================
{
  const e = mkEngine({ inventory: [], brk: brk('R6') });
  const bow = ITEM_MAP.get('hist-sap-bow');
  const potion = items.find((r) => r.kind === 'potion');
  const cases = [];
  const say = (rec, what) => {
    e.toasts.length = 0;
    const ev = { item: rec ? rec.id : null };
    e._sayEquip(ev, rec, what);
    return { item: rec ? rec.id : null, what, said: ev.said || null, toast: e.toasts.length ? e.toasts[0].text : null };
  };
  cases.push(say(bow, 'refused'));
  cases.push(say(potion, 'unwearable'));
  cases.push(say(ITEM_MAP.get('shell-scale-hauberk'), 'on'));
  cases.push(say(ITEM_MAP.get('shell-scale-hauberk'), 'off'));

  const leaks = /createPlayer|moveset|roster|alias|ssw_|axe_|_bow|Known:/;
  const everyoneSpeaks = cases.every((c) => c.toast && c.toast.length > 0);
  const nothingLeaks = cases.every((c) => !leaks.test(c.toast || ''));
  const readsLikeProse = cases.every((c) => /^[A-Z].*\.$/.test(c.toast || ''));
  const ok = everyoneSpeaks && nothingLeaks && readsLikeProse;

  check('R6', 'the equip refusal is delivered on the shipped player-visible channel, in prose, without the raw diagnostic', ok, {
    cases,
    channel: 'Engine.uiToast() -> ui/hud.js E11, which W1-21 built and which sat unreachable',
    the_diagnostic_that_must_NOT_be_piped:
      "createPlayer: no moveset 'bow'. Known: 87 roster weapons (axe_bog_cleaver, ...) plus the aliases ...",
    it_still_reaches_a_probe: 'on `equip_end`, as `ev.refused`; the prose is `ev.said`',
    every_case_says_something: everyoneSpeaks,
    nothing_internal_leaks: nothingLeaks,
    round_3_state: 'anything_the_player_could_see_changed: false',
  });
}

// =============================================================================================
const failed = results.filter((r) => !r.ok);
const out = {
  schema: 'elder-souls/w1-16-r4-offline@1',
  generated: new Date().toISOString(),
  selftest: SELFTEST,
  selftest_arms: ARM,
  checks: results,
  failed: failed.map((r) => r.id),
};
const dest = path.join(REPO, 'reports', 'w1-16', SELFTEST ? 'r4-offline-selftest.json' : 'r4-offline.json');
fs.mkdirSync(path.dirname(dest), { recursive: true });
fs.writeFileSync(dest, JSON.stringify(out, null, 2) + '\n');

if (AS_JSON) process.stdout.write(JSON.stringify(out, null, 2) + '\n');
else {
  for (const r of results) process.stdout.write(`${r.ok ? 'PASS' : 'FAIL'}  ${r.id}  ${r.title}\n`);
  process.stdout.write(`\nwritten: ${path.relative(REPO, dest)}\n`);
}
// Under `--selftest` the arms are set on purpose and EVERY check must be red. A selftest run in
// which anything still passes is an inert control and exits non-zero for that reason.
if (SELFTEST) {
  const stillGreen = results.filter((r) => r.ok).map((r) => r.id);
  if (stillGreen.length) {
    process.stdout.write(`\nSELFTEST FAILURE — these arms are INERT (still green with the fix removed): ${stillGreen.join(', ')}\n`);
    process.exit(1);
  }
  process.stdout.write(`\nselftest: all ${results.length} checks went red with their arm set. The teardowns bite.\n`);
  process.exit(0);
}
process.exit(failed.length ? 1 : 0);
