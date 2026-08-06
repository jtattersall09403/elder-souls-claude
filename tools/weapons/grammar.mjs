// The slot grammar: which pose family every slot of every class uses, and how its frame data is
// derived. Shared by the moveset generator and by the measurement tools so neither can drift.
//
// W1-10. Everything here is derived from game/data/weapons/classes.json (which transcribes
// RI-WPN02 §B and RI-WPN04 §A) and game/data/weapons/pose-library.json. No frame number is
// invented in this file; the multipliers are read from classes.json.
'use strict';

/** round-half-up, applied ONCE to a product. RI-CMB02's stated rounding rule. */
export const rhu = (x) => Math.floor(x + 0.5);

/**
 * The per-class slot grammar. `fam` is the pose family; `chain` is the chain successor.
 *
 * The grammar is what RI-WPN02 §D's `Dg` (grammar-only distance) measures: chain length, arc,
 * root displacement, hyperarmour availability and recovery ratio. Two classes with identical
 * grammar and different mass are "one weapon on a weight slider" and hard-fail Dg_min < 0.5, so
 * this table is where class identity actually lives.
 */
export const CLASS_GRAMMAR = {
  DGR: {
    r1: ['cut_diagonal', 'cut_horizontal_rev', 'thrust_high', 'cut_diagonal_rise'],
    r2: 'thrust_low', charged: 'charge_hold_thrust', follow: 'cut_vertical',
    run1: 'run_pass', run2: 'run_lunge', roll1: 'roll_rise', roll2: null,
    back: 'backstep_step', jump1: 'jump_fall', jump2: null, plunge: 'plunge_dive',
    gc: 'guard_counter_shove', gb: 'guardbreak_kick', art: ['art_lunge', 'art_guard'],
    h2_exclusive: ['2h.r2.follow', '2h.art.2'],
    h2_chain: 3, h1_chain: 4, ha_2h_r1: false, ha_run2: false, ha_extra: [],
  },
  FST: {
    r1: ['punch_alternate', 'punch_hook', 'punch_alternate', 'punch_hook', 'smash_side'],
    r2: 'smash_side', charged: 'charge_hold', follow: 'punch_hook',
    run1: 'run_pass', run2: 'run_barge', roll1: 'roll_rise', roll2: null,
    back: 'backstep_step', jump1: 'jump_stomp', jump2: null, plunge: 'plunge_dive',
    gc: 'guard_counter_shove', gb: 'guardbreak_kick', art: ['art_whirl', 'art_stomp'],
    // NOT '2h.r1.4'. Every declared 2h exclusive deletes its one-handed twin (RI-WPN06 §B), and
    // FST is the one class whose one-handed chain reaches r1.4 — RI-WPN02 §B publishes it at
    // **5**, the longest in the game and the whole point of the class. Declaring 2h.r1.4
    // exclusive therefore deleted r1.4 out of the middle of a five-link chain, leaving
    // r1.3 → r1.4 dangling and r1.5 orphaned on all four fist weapons: the published five-link
    // chain did not exist even on paper. FST has no one-handed roll heavy (roll2 is null), so
    // 2h.roll.r2 is exclusive by construction and costs the class nothing it owns.
    h2_exclusive: ['2h.roll.r2', '2h.art.2'],
    // FST carries hyperarmour on the three verbs that ARRIVE — the running light, the running
    // heavy and the rolling attack — and on nothing else. RI-WPN02 §B asks the class "can you
    // live at zero range?" and gives it 0.90 m, the shortest in the game: it has no spacing tool,
    // so the whole class problem is getting there, and this is what it buys instead of the reach
    // it does not have. It is also the split from DGR, its nearest neighbour on §D's fingerprint
    // distance: the dagger's answer to the same 12 f@60 speed is "never be hit", the fist's is
    // "be hit on the way in". Both classes previously sat at the 2-slot floor (the charged pair
    // only) and D11 contributed exactly zero to the pair the whole matrix is measured on.
    h2_chain: 3, h1_chain: 5, ha_2h_r1: false, ha_run2: true,
    ha_extra: ['run.r1', '2h.run.r1', 'roll.r1', '2h.roll.r1'],
  },
  CSW: {
    r1: ['cut_horizontal', 'cut_horizontal_rev', 'spin_full', 'cut_diagonal_rise'],
    r2: 'spin_double', charged: 'charge_hold', follow: 'sweep_wide',
    run1: 'run_pass', run2: 'run_barge', roll1: 'roll_rise', roll2: 'roll_sweep',
    back: 'backstep_cut', jump1: 'jump_fall', jump2: null, plunge: 'plunge_dive',
    gc: 'guard_counter_shove', gb: 'guardbreak_kick', art: ['art_whirl', 'art_lunge'],
    h2_exclusive: ['2h.roll.r2', '2h.art.2'],
    h2_chain: 3, h1_chain: 4, ha_2h_r1: false, ha_run2: false, ha_extra: [],
  },
  TSW: {
    r1: ['thrust_straight', 'thrust_high', 'thrust_low'],
    r2: 'thrust_high', charged: 'charge_hold_thrust', follow: 'cut_horizontal',
    run1: 'run_lunge', run2: 'run_leap', roll1: 'roll_rise', roll2: null,
    back: 'backstep_step', jump1: 'jump_fall', jump2: null, plunge: 'plunge_dive',
    gc: 'guard_counter_shove', gb: 'thrust_low', art: ['art_lunge', 'art_guard'],
    h2_exclusive: ['2h.r1.4', '2h.r2.follow'],
    h2_chain: 4, h1_chain: 3, ha_2h_r1: false, ha_run2: false, ha_extra: [],
  },
  SSW: {
    r1: ['cut_horizontal', 'cut_horizontal_rev', 'cut_diagonal'],
    r2: 'cut_diagonal', charged: 'charge_hold', follow: 'thrust_straight',
    run1: 'run_pass', run2: 'run_lunge', roll1: 'roll_rise', roll2: null,
    back: 'backstep_step', jump1: 'jump_fall', jump2: null, plunge: 'plunge_dive',
    gc: 'guard_counter_shove', gb: 'guardbreak_kick', art: ['art_lunge', 'art_guard'],
    h2_exclusive: ['2h.r2.follow', '2h.art.2'],
    // The control class carries hyperarmour on exactly one verb: the guard counter. Sword and
    // shield is the loadout the straight sword is FOR, and the guard counter is the one attack it
    // will stand in front of something to throw. It is also the grammar split from MCE, which is
    // otherwise its nearest neighbour on RI-WPN02 §D's Dg distance.
    h2_chain: 3, h1_chain: 3, ha_2h_r1: false, ha_run2: false, ha_extra: ['guard.counter', '2h.guard.counter'],
  },
  SPR: {
    r1: ['thrust_straight', 'thrust_low', 'thrust_high'],
    r2: 'thrust_high', charged: 'charge_hold_thrust', follow: 'sweep_low',
    run1: 'run_lunge', run2: 'run_leap', roll1: 'roll_rise', roll2: null,
    back: 'backstep_step', jump1: 'jump_fall', jump2: null, plunge: 'plunge_dive',
    gc: 'guard_counter_shove', gb: 'thrust_low', art: ['art_guard', 'art_lunge'],
    h2_exclusive: ['2h.r2.follow', '2h.art.2'],
    // The spear's guard counter carries hyperarmour: RI-WPN02 §C makes SPR the one melee class
    // that attacks THROUGH a raised offhand shield, and the guard counter is that verb. It is
    // also the grammar split from TSW, its nearest neighbour on RI-WPN02 §D's Dg distance.
    h2_chain: 3, h1_chain: 3, ha_2h_r1: false, ha_run2: false, ha_extra: ['guard.counter', '2h.guard.counter'],
  },
  AXE: {
    r1: ['cut_diagonal', 'cut_horizontal_rev', 'cut_vertical'],
    r2: 'cut_vertical', charged: 'charge_hold', follow: 'smash_side',
    run1: 'run_pass', run2: 'run_barge', roll1: 'roll_rise', roll2: 'roll_sweep',
    back: 'backstep_cut', jump1: 'jump_fall', jump2: 'jump_stomp', plunge: 'plunge_dive',
    gc: 'guard_counter_shove', gb: 'guardbreak_kick', art: ['art_whirl', 'art_stomp'],
    h2_exclusive: ['2h.roll.r2', '2h.jump.r2'],
    h2_chain: 3, h1_chain: 3, ha_2h_r1: false, ha_run2: true, ha_extra: ['guard.counter', '2h.guard.counter', 'jump.r1', '2h.jump.r1'],
  },
  MCE: {
    r1: ['smash_over', 'smash_side', 'smash_over'],
    r2: 'smash_over', charged: 'charge_hold', follow: 'smash_side',
    run1: 'run_barge', run2: 'run_leap', roll1: 'roll_rise', roll2: null,
    back: 'backstep_cut', jump1: 'jump_stomp', jump2: 'jump_stomp', plunge: 'plunge_dive',
    gc: 'guard_counter_shove', gb: 'guardbreak_shoulder', art: ['art_stomp', 'art_guard'],
    h2_exclusive: ['2h.jump.r2', '2h.art.2'],
    // MCE carries the MINIMUM hyperarmour RI-WPN02 §B allows it (its 1h R2 row is non-null, so
    // r2 / r2.charged and their two-handed twins, and nothing else). The mace is the BREAK class,
    // not the trade class, and D11 is the one fingerprint dimension §B leaves to the builder — so
    // this is where it is separated from AXE, the pair RI-WPN02 'How we lose' 9 predicts.
    h2_chain: 3, h1_chain: 3, ha_2h_r1: false, ha_run2: false, ha_extra: [],
  },
  HLB: {
    r1: ['sweep_low', 'sweep_wide', 'thrust_low'],
    r2: 'sweep_wide', charged: 'charge_hold_thrust', follow: 'thrust_straight',
    run1: 'run_lunge', run2: 'run_barge', roll1: 'roll_rise', roll2: 'roll_sweep',
    back: 'backstep_cut', jump1: 'jump_fall', jump2: 'jump_stomp', plunge: 'plunge_dive',
    gc: 'guard_counter_shove', gb: 'thrust_low', art: ['art_whirl', 'art_guard'],
    h2_exclusive: ['2h.roll.r2', '2h.jump.r2'],
    // HLB has NO running-heavy hyperarmour — a lane-control class holds space, it does not barge
    // through — but it DOES carry it on the two verbs that hold ground under pressure: the guard
    // counter and the two-handed rolling attack. That puts HLB between AXE (trade) and MCE (break)
    // on fingerprint dimension D11, which is what separates all three in RI-WPN02 §D's Dg.
    h2_chain: 3, h1_chain: 3, ha_2h_r1: false, ha_run2: false, ha_extra: ['guard.counter', '2h.guard.counter', '2h.roll.r1'],
  },
  WHP: {
    r1: ['lash_circle', 'lash_snap', 'lash_circle'],
    r2: 'lash_snap', charged: 'charge_hold', follow: 'lash_circle',
    run1: 'run_pass', run2: 'run_leap', roll1: 'roll_rise', roll2: 'roll_sweep',
    back: 'backstep_cut', jump1: 'jump_fall', jump2: null, plunge: 'plunge_dive',
    gc: 'guard_counter_shove', gb: 'guardbreak_kick', art: ['art_whirl', 'art_guard'],
    h2_exclusive: ['2h.roll.r2', '2h.art.2'],
    h2_chain: 3, h1_chain: 3, ha_2h_r1: false, ha_run2: false, ha_extra: [],
  },
  GSW: {
    r1: ['cut_diagonal', 'cut_horizontal_rev', 'cut_vertical'],
    r2: 'cut_vertical', charged: 'charge_hold', follow: 'sweep_wide',
    run1: 'run_pass', run2: 'run_barge', roll1: 'roll_rise', roll2: 'roll_sweep',
    back: 'backstep_cut', jump1: 'jump_fall', jump2: 'jump_stomp', plunge: 'plunge_dive',
    gc: 'guard_counter_shove', gb: 'guardbreak_shoulder', art: ['art_whirl', 'art_stomp'],
    h2_exclusive: ['2h.roll.r2', '2h.art.2'],
    h2_chain: 3, h1_chain: 3, ha_2h_r1: true, ha_run2: true, ha_extra: [],
  },
  CGS: {
    r1: ['spin_full', 'spin_double', 'sweep_wide'],
    r2: 'spin_double', charged: 'charge_hold', follow: 'spin_full',
    run1: 'run_pass', run2: 'run_barge', roll1: 'roll_sweep', roll2: 'roll_sweep',
    back: 'backstep_cut', jump1: 'jump_fall', jump2: 'jump_stomp', plunge: 'plunge_dive',
    gc: 'guard_counter_shove', gb: 'guardbreak_shoulder', art: ['art_whirl', 'art_lunge'],
    h2_exclusive: ['2h.r1.4', '2h.roll.r2'],
    // RI-WPN02 §B publishes CGS `max_chain` **2** and §C says so again in words ("`max_chain 2`;
    // the second hit is a full 360°"). h1_chain was 3, which is how twelve of fifteen classes
    // collapsed onto the same value and D4 stopped being a fingerprint dimension. r1.3 is still
    // DECLARED (RI-WPN01 §A makes it mandatory on every melee weapon) and is still reachable —
    // see build-movesets.mjs `rewire`, which routes roll.r1 / backstep.r1 into r1.3 on a
    // chain-2 class, so the mandatory slot is neither missing nor an orphan.
    h2_chain: 4, h1_chain: 2, ha_2h_r1: true, ha_run2: true, ha_extra: ['2h.roll.r1'],
  },
  GHM: {
    r1: ['smash_over', 'smash_side', 'smash_pile'],
    r2: 'smash_pile', charged: 'charge_hold', follow: 'smash_side',
    run1: 'run_barge', run2: 'run_leap', roll1: 'roll_rise', roll2: null,
    back: 'backstep_cut', jump1: 'jump_stomp', jump2: 'jump_stomp', plunge: 'plunge_dive',
    gc: 'guard_counter_shove', gb: 'guardbreak_shoulder', art: ['art_stomp', 'art_whirl'],
    h2_exclusive: ['2h.jump.r2', '2h.art.2'],
    // RI-WPN02 §B publishes GHM `max_chain` **2**. Same reconciliation as CGS above.
    h2_chain: 3, h1_chain: 2, ha_2h_r1: true, ha_run2: true, ha_extra: ['jump.r1', '2h.jump.r1'],
  },
  UGS: {
    r1: ['cut_vertical', 'sweep_wide', 'cut_diagonal'],
    r2: 'cut_vertical', charged: 'charge_hold', follow: 'sweep_wide',
    run1: 'run_barge', run2: 'run_lunge', roll1: 'roll_sweep', roll2: 'roll_sweep',
    back: 'backstep_cut', jump1: 'jump_fall', jump2: 'jump_stomp', plunge: 'plunge_dive',
    gc: 'guard_counter_shove', gb: 'guardbreak_shoulder', art: ['art_stomp', 'art_whirl'],
    h2_exclusive: ['2h.r2.follow', '2h.roll.r2'],
    h2_chain: 3, h1_chain: 3, ha_2h_r1: true, ha_run2: true, ha_extra: ['jump.r1', '2h.jump.r1', 'guard.counter', '2h.guard.counter'],
  },
  BOW: {
    r1: ['shoot_level'], r2: 'shoot_level', charged: 'shoot_level', follow: null,
    run1: null, run2: null, roll1: 'shoot_hip', roll2: null,
    back: null, jump1: null, jump2: null, plunge: 'plunge_dive',
    gc: null, gb: 'guardbreak_kick', art: ['art_guard', null],
    h2_exclusive: [], h2_chain: 0, h1_chain: 1, ha_2h_r1: false, ha_run2: false, ha_extra: [],
  },
};

/** The mandatory 25 (RI-WPN01 §A), enumerated so a counter can be written against it. */
export const MANDATORY_25 = [
  'r1.1', 'r1.2', 'r1.3', 'r2', 'r2.charged', 'run.r1', 'run.r2', 'roll.r1', 'backstep.r1',
  'jump.r1', 'plunge', 'guard.counter', 'guardbreak', 'art.1',
  '2h.r1.1', '2h.r1.2', '2h.r1.3', '2h.r2', '2h.r2.charged', '2h.run.r1', '2h.run.r2',
  '2h.roll.r1', '2h.backstep.r1', '2h.jump.r1', '2h.guard.counter',
];

/** BOW's reduced mandatory table (RI-WPN01 §A). */
export const MANDATORY_BOW = ['bow.draw', 'bow.quick', 'bow.aimed', 'bow.roll', 'plunge', 'guardbreak', 'art.1'];

/** The identity list — the five slots a player spends the game inside (RI-WPN03 §C). */
export const IDENTITY_SLOTS = ['r1.1', 'r1.3', 'r2', 'art.1', '2h.r2'];

/** The ten contextual slots, plus their two-handed mirrors (RI-WPN04 §D). */
export const CONTEXTUAL_SLOTS = [
  'roll.r1', 'roll.r2', 'run.r1', 'run.r2', 'backstep.r1', 'jump.r1', 'jump.r2',
  'plunge', 'guard.counter', 'guardbreak',
  '2h.roll.r1', '2h.roll.r2', '2h.run.r1', '2h.run.r2', '2h.backstep.r1',
  '2h.jump.r1', '2h.jump.r2',
];

/** The twelve slots that exist in both stances, for RI-WPN06 §B's TDV. */
export const TDV_SLOTS = [
  'r1.1', 'r1.2', 'r1.3', 'r2', 'r2.charged', 'run.r1', 'run.r2',
  'roll.r1', 'backstep.r1', 'jump.r1', 'guard.counter', 'art.1',
];

export const CHARGE_MAX_F = { light: 30, medium: 40, heavy: 50, ultra: 60, ranged: 90 };
