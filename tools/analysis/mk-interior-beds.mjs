#!/usr/bin/env node
// Author the interior and settlement ambience beds. W1-22 round 2, RI-AUD03 R4 + RI-WLD08 §6.
//
// WHY THIS IS A GENERATOR AND NOT SEVEN HAND-WRITTEN FILES. The seven beds share a schema, a
// provenance string and a set of invariants (four layers declared, `null` permitted, one unique
// L1 each, event intervals inside §A's bands, a `bed_lufs_target` that is not on a band edge).
// Hand-writing them is how one of the seven quietly ends up with an L3 interval of 45 s or a
// target of −24.0 on the fence, which is exactly the B5 miss round 1 shipped. The synth
// parameters below are the content; this file is the jig that stops them drifting apart.
//
// It writes `game/data/audio/ambience/interiors/*.json` and is re-runnable. It does NOT write
// `event_gain_db` — that is measured, by `ambience-onsets.mjs --calibrate`, and a guessed value
// in this file would be a number nobody had listened to.
//
//   node tools/analysis/mk-interior-beds.mjs

import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..');
const DIR = join(ROOT, 'game/data/audio/ambience/interiors');

const PROV = 'W1-22 round 2. RI-AUD03 R4 ("Interiors get their own bed, not the exterior bed at '
  + '-12 dB") and RI-WLD08 §6 (">=13 (one per region) + >=8 settlement beds + >=4 interior beds"). '
  + 'Round 1 read R4 as permitting silence and shipped `suppressed` for every interior in the '
  + 'build; the round-1 critic ruled that R4 mandates a bed, and this round agrees on the item\'s '
  + 'own "How we lose" wording — the named failure is that a low-passed exterior "is not wrong, it '
  + 'is just nothing", and silence is that failure at its limit rather than an escape from it. '
  + 'Cells are `Engine.cellFor()`\'s names. This build has no audio assets, so a synth spec IS the '
  + 'asset; parameters constructed here.';

/** RI-AUD03 §A: L3 one per 8–40 s, L4 one per 45–180 s. Kept in one place so no bed drifts out. */
const L3_IV = (a, b) => { if (a < 8 || b > 40 || a >= b) throw new Error(`L3 interval ${a}..${b}`); return [a, b]; };
const L4_IV = (a, b) => { if (a < 45 || b > 180 || a >= b) throw new Error(`L4 interval ${a}..${b}`); return [a, b]; };

const beds = [
  // ---- interiors (RI-WLD08 §6 wants >=4 of these) --------------------------------------------
  {
    id: 'barge_hold', kind: 'interior', region_name: 'A moored barge hold (W1-07)',
    brief: 'the inside of a hull: water working against timber from the far side of a plank, '
      + 'rope under load, and no wind at all',
    key: { wet_dry: 'wet', open_enclosed: 'enclosed', living_dead: 'living' },
    target: -26,
    denies: [{ class: 'wind', why: 'You are inside a hull below the waterline. R4\'s whole point is '
      + 'that an interior is not the outside quieter — if the barge\'s wind got in, this would be '
      + 'the exterior bed with a lowpass on it, which is the failure R4 names.' }],
    L1: { id: 'l1_hull_below_waterline', text: 'the pressure of water on the other side of a plank',
          level_db: 0, classes: ['pressure'],
          synth: { kind: 'noise', colour: 'brown', filter: { type: 'lowpass', hz: 120, q: 0.7 },
                   gain_db: -4, width: 0.2, mod: { target: 'filter_hz', lfo_hz: 0.047, depth: 0.22 } } },
    L2: { id: 'l2_bilge_and_sway', text: 'bilge water moving with the swell; the hull answering it',
          level_db: -4, sublayers: [
            { when: {}, classes: ['water'],
              synth: { kind: 'noise', colour: 'pink', filter: { type: 'bandpass', hz: 240, q: 1.4 },
                       gain_db: -9, width: 0.45, mod: { target: 'gain', lfo_hz: 0.11, depth: 0.5 } } },
            { when: { tod: 'night' }, classes: ['timber'],
              synth: { kind: 'drone', partials_hz: [58, 87], partial_gains_db: [-10, -16],
                       waveform: 'sine', detune_cents: 9, gain_db: -13,
                       filter: { type: 'lowpass', hz: 300, q: 0.8 } } }] },
    L3: { id: 'l3_timber_and_rope', text: 'a plank taking weight; rope creaking against a cleat',
          interval_s: L3_IV(9, 26), level_db: -2, events: [
            { id: 'plank_take', classes: ['timber'], weight: 3, pan: [-0.7, 0.7],
              synth: { kind: 'grain', source: 'noise', colour: 'brown',
                       filter: { type: 'bandpass', hz: 190, q: 4.5 },
                       env: { attack_s: 0.02, decay_s: 0.5 }, gain_db: -7 } },
            { id: 'cleat_creak', classes: ['rope'], weight: 2, pan: [-0.85, 0.85],
              synth: { kind: 'grain', source: 'osc', waveform: 'sawtooth', freq_hz: 320,
                       glide_hz: [320, 197], filter: { type: 'lowpass', hz: 900, q: 2 },
                       env: { attack_s: 0.05, decay_s: 0.42 }, gain_db: -12 } }] },
    L4: { id: 'l4_something_in_the_bilge', text: 'something in the bilge that is not the bilge',
          interval_s: L4_IV(55, 165), level_db: 0, events: [
            { id: 'bilge_shift', classes: ['creature'], weight: 1, pan: [-0.5, 0.5],
              synth: { kind: 'grain', source: 'noise', colour: 'brown',
                       filter: { type: 'lowpass', hz: 340, q: 1.2 },
                       env: { attack_s: 0.06, decay_s: 0.8 }, gain_db: -8,
                       repeats: { n: 2, gap_s: 0.7, gap_jitter_s: 0.2 } } }] },
  },
  {
    id: 'writ_house', kind: 'interior', region_name: 'The writ house (W1-07)',
    brief: 'a dry administrative room: paper, a nib, a ledger turning, and the particular '
      + 'deadness of a room lined with documents',
    key: { wet_dry: 'dry', open_enclosed: 'enclosed', living_dead: 'living' },
    target: -27,
    denies: [{ class: 'water', why: 'The one room in the province with no water in it. The absence '
      + 'is the identity (§A R1): a drip here would make it a cellar.' }],
    L1: { id: 'l1_paper_deadness', text: 'a room lined with paper absorbs its own reverb — the '
      + 'quietest floor in the game and deliberately almost featureless',
          level_db: 0, classes: ['pressure'],
          synth: { kind: 'noise', colour: 'pink', filter: { type: 'lowpass', hz: 420, q: 0.5 },
                   gain_db: -11, width: 0.08 } },
    L2: { id: 'l2_lamp_and_draught', text: 'a lamp guttering; a draught under a door',
          level_db: -5, sublayers: [
            { when: {}, classes: ['fire'],
              synth: { kind: 'noise', colour: 'white', filter: { type: 'bandpass', hz: 1900, q: 0.9 },
                       gain_db: -19, width: 0.25, mod: { target: 'gain', lfo_hz: 0.37, depth: 0.55 } } },
            { when: { tod: 'night' }, classes: ['fire'],
              synth: { kind: 'noise', colour: 'white', filter: { type: 'bandpass', hz: 2600, q: 1.3 },
                       gain_db: -17, width: 0.3, mod: { target: 'gain', lfo_hz: 0.63, depth: 0.7 } } }] },
    L3: { id: 'l3_nib_and_ledger', text: 'a nib; a page turning; a stamp going down',
          interval_s: L3_IV(8, 21), level_db: -1, events: [
            { id: 'nib_scratch', classes: ['labour'], weight: 4, pan: [-0.35, 0.35],
              synth: { kind: 'grain', source: 'noise', colour: 'white',
                       filter: { type: 'bandpass', hz: 3400, q: 2.2 },
                       env: { attack_s: 0.004, decay_s: 0.16 }, gain_db: -10,
                       repeats: { n: 3, gap_s: 0.22, gap_jitter_s: 0.07 } } },
            { id: 'page_turn', classes: ['paper'], weight: 3, pan: [-0.5, 0.5],
              synth: { kind: 'grain', source: 'noise', colour: 'pink',
                       filter: { type: 'highpass', hz: 1800, q: 0.8 },
                       env: { attack_s: 0.02, decay_s: 0.3 }, gain_db: -8 } },
            { id: 'stamp_down', classes: ['labour'], weight: 1, pan: [-0.2, 0.2],
              synth: { kind: 'grain', source: 'noise', colour: 'brown',
                       filter: { type: 'bandpass', hz: 260, q: 3 },
                       env: { attack_s: 0.001, decay_s: 0.2 }, gain_db: -5 } }] },
    // R1: `null` is a design statement. Nothing lives in the writ house. That is the joke and it
    // is also the identity — it is the only interior in the build with no L4 at all.
    L4: null,
    L4_null_reason: 'Nothing lives in the writ house, and that is its identity rather than an '
      + 'omission (§A R1). It is a dry room lined with paper in which the only living thing is '
      + 'the clerk you came to see; a rat or a bird here would make it a granary.',
  },
  {
    id: 'well', kind: 'interior', region_name: 'The rootlands well (W1-07)',
    brief: 'a stone shaft: drips arriving from a long way up, and a resonance that answers them',
    key: { wet_dry: 'wet', open_enclosed: 'enclosed', living_dead: 'dead' },
    target: -26.5,
    denies: [{ class: 'wind', why: 'A shaft below ground. Wind here would be the exterior leaking '
      + 'in, which is R4\'s named failure.' }],
    L1: { id: 'l1_shaft_resonance', text: 'the column of air in a stone shaft, which has a note',
          level_db: 0, classes: ['pressure'],
          synth: { kind: 'drone', partials_hz: [43.65, 87.31, 131, 174.61],
                   partial_gains_db: [-6, -13, -19, -25], waveform: 'sine', detune_cents: 3,
                   gain_db: -8, filter: { type: 'lowpass', hz: 500, q: 1.1 },
                   mod: { target: 'gain', lfo_hz: 0.07, depth: 0.2 } } },
    L2: { id: 'l2_seep', text: 'water finding its way down the stone',
          level_db: -6, sublayers: [
            { when: {}, classes: ['water'],
              synth: { kind: 'noise', colour: 'pink', filter: { type: 'highpass', hz: 2200, q: 0.7 },
                       gain_db: -20, width: 0.55 } }] },
    L3: { id: 'l3_drip_arrival', text: 'a drip that has fallen a long way, and the shaft answering',
          interval_s: L3_IV(8, 19), level_db: 0, events: [
            { id: 'shaft_drip', classes: ['water'], weight: 5, pan: [-0.6, 0.6],
              synth: { kind: 'grain', source: 'osc', waveform: 'sine', freq_hz: 1750,
                       glide_hz: [1750, 430], env: { attack_s: 0.001, decay_s: 0.14 }, gain_db: -6 } },
            { id: 'stone_shift', classes: ['stone'], weight: 1, pan: [-0.4, 0.4],
              synth: { kind: 'grain', source: 'noise', colour: 'brown',
                       filter: { type: 'bandpass', hz: 150, q: 5 },
                       env: { attack_s: 0.008, decay_s: 0.7 }, gain_db: -6 } }] },
    L4: { id: 'l4_down_there', text: 'something at the bottom that the shaft carries up',
          interval_s: L4_IV(70, 180), level_db: 1, events: [
            { id: 'well_breath', classes: ['creature'], weight: 1, pan: [-0.25, 0.25],
              synth: { kind: 'grain', source: 'noise', colour: 'brown',
                       filter: { type: 'lowpass', hz: 200, q: 1.5 },
                       env: { attack_s: 0.35, decay_s: 1.4 }, gain_db: -7 } }] },
  },
  {
    id: 'dungeon', kind: 'interior', region_name: 'Dungeon interiors (dungeon-primary)',
    brief: 'worked stone under a great deal of earth: pressure, far water, and the occasional '
      + 'reminder that the place was built rather than dug',
    key: { wet_dry: 'wet', open_enclosed: 'enclosed', living_dead: 'dead' },
    target: -27.5,
    denies: [{ class: 'birdsong', why: 'RI-AUD03 §A R1 — absence is a layer. Nothing that needs '
      + 'daylight is audible here, and that is the whole of what "underground" sounds like.' }],
    L1: { id: 'l1_earth_load', text: 'the weight of everything above, which has a spectrum',
          level_db: 0, classes: ['pressure'],
          synth: { kind: 'noise', colour: 'brown', filter: { type: 'lowpass', hz: 95, q: 0.55 },
                   gain_db: -5, width: 0.12, mod: { target: 'filter_hz', lfo_hz: 0.019, depth: 0.2 } } },
    L2: { id: 'l2_far_water_and_air', text: 'water somewhere off the passage; air moving between rooms',
          level_db: -5, sublayers: [
            { when: {}, classes: ['water'],
              synth: { kind: 'noise', colour: 'pink', filter: { type: 'bandpass', hz: 700, q: 1.1 },
                       gain_db: -17, width: 0.5, mod: { target: 'gain', lfo_hz: 0.08, depth: 0.4 } } },
            { when: { tod: 'night' }, classes: ['air'],
              synth: { kind: 'noise', colour: 'brown', filter: { type: 'bandpass', hz: 165, q: 2.2 },
                       gain_db: -14, width: 0.35, mod: { target: 'filter_hz', lfo_hz: 0.05, depth: 0.3 } } }] },
    L3: { id: 'l3_stone_and_grit', text: 'grit falling; a stone settling against another stone',
          interval_s: L3_IV(10, 32), level_db: -1, events: [
            { id: 'grit_fall', classes: ['stone'], weight: 3, pan: [-0.8, 0.8],
              synth: { kind: 'grain', source: 'noise', colour: 'white',
                       filter: { type: 'highpass', hz: 2600, q: 0.7 },
                       env: { attack_s: 0.002, decay_s: 0.28 }, gain_db: -9 } },
            { id: 'block_settle', classes: ['stone'], weight: 2, pan: [-0.5, 0.5],
              synth: { kind: 'grain', source: 'noise', colour: 'brown',
                       filter: { type: 'bandpass', hz: 120, q: 4 },
                       env: { attack_s: 0.012, decay_s: 0.9 }, gain_db: -5 } }] },
    L4: { id: 'l4_further_in', text: 'something further in, which does not come closer',
          interval_s: L4_IV(60, 175), level_db: 1, events: [
            { id: 'far_call', classes: ['creature'], weight: 2, pan: [-0.9, 0.9],
              synth: { kind: 'grain', source: 'osc', waveform: 'triangle',
                       partials_hz: [96, 144.5], glide_hz: [96, 71],
                       filter: { type: 'lowpass', hz: 420, q: 1.8 },
                       env: { attack_s: 0.2, decay_s: 1.1 }, gain_db: -6 } },
            { id: 'chain_move', classes: ['metal'], weight: 1, pan: [-0.6, 0.6],
              synth: { kind: 'grain', source: 'noise', colour: 'white',
                       filter: { type: 'bandpass', hz: 4200, q: 3.5 },
                       env: { attack_s: 0.004, decay_s: 0.35 }, gain_db: -11,
                       repeats: { n: 4, gap_s: 0.16, gap_jitter_s: 0.06 } } }] },
  },
  {
    id: 'interior', kind: 'interior', region_name: 'Interiors, generic',
    brief: 'the fallback room: a built space with a roof on it, for every interior that has not '
      + 'been given its own bed yet',
    key: { wet_dry: 'dry', open_enclosed: 'enclosed', living_dead: 'living' },
    target: -27,
    // This one is honest debt made audible rather than a designed place, and it says so in its
    // own body. A generic room is still an interior bed and still satisfies R4 — what it does not
    // do is give a named interior its own identity, and `getUnimplemented` carries that.
    declared_incomplete: true,
    denies: [],
    L1: { id: 'l1_generic_room_tone', text: 'a room with a roof: bounded, small, no weather',
          level_db: 0, classes: ['pressure'],
          synth: { kind: 'noise', colour: 'brown', filter: { type: 'lowpass', hz: 210, q: 0.6 },
                   gain_db: -8, width: 0.18, mod: { target: 'filter_hz', lfo_hz: 0.026, depth: 0.15 } } },
    L2: { id: 'l2_structure', text: 'the building holding itself up',
          level_db: -5, sublayers: [
            { when: {}, classes: ['timber'],
              synth: { kind: 'drone', partials_hz: [71, 106.5], partial_gains_db: [-11, -18],
                       waveform: 'sine', detune_cents: 7, gain_db: -15,
                       filter: { type: 'lowpass', hz: 340, q: 0.9 },
                       mod: { target: 'gain', lfo_hz: 0.043, depth: 0.3 } } }] },
    L3: { id: 'l3_settling', text: 'a joint settling; something small falling over',
          interval_s: L3_IV(11, 34), level_db: -2, events: [
            { id: 'joint_settle', classes: ['timber'], weight: 3, pan: [-0.6, 0.6],
              synth: { kind: 'grain', source: 'noise', colour: 'brown',
                       filter: { type: 'bandpass', hz: 230, q: 3.5 },
                       env: { attack_s: 0.015, decay_s: 0.4 }, gain_db: -8 } }] },
    L4: null,
    L4_null_reason: 'The generic fallback room stands for interiors that have not been given '
      + 'their own bed, and it must not invent a creature for a place nobody has designed yet. '
      + 'A named interior that needs an L4 gets its own bed rather than borrowing this one\'s.',
  },
  // ---- settlements (RI-WLD08 §6 wants >=8; this build has two settlement cells) ---------------
  {
    id: 'market', kind: 'settlement', region_name: 'Helstrom market (W1-07)',
    brief: 'a covered market: many people not talking to you, trade, and the acoustics of a '
      + 'crowd under a roof',
    key: { wet_dry: 'dry', open_enclosed: 'enclosed', living_dead: 'living' },
    target: -25,
    denies: [{ class: 'wilderness', why: 'The loudest interior in the build and the only one where '
      + 'the identity is other people. Nothing from the marsh gets a voice in here.' }],
    L1: { id: 'l1_crowd_body', text: 'the body of a crowd — not words, the sound a hundred people '
      + 'make by existing in a bounded space',
          level_db: 0, classes: ['crowd'],
          synth: { kind: 'noise', colour: 'pink', filter: { type: 'bandpass', hz: 480, q: 0.55 },
                   gain_db: -5, width: 0.75, mod: { target: 'filter_hz', lfo_hz: 0.09, depth: 0.25 } } },
    L2: { id: 'l2_trade', text: 'the market working: cloth, coin, crates, and a roof over it',
          level_db: -3, sublayers: [
            { when: { tod: 'day' }, classes: ['crowd'],
              synth: { kind: 'noise', colour: 'pink', filter: { type: 'bandpass', hz: 1250, q: 0.8 },
                       gain_db: -11, width: 0.8, mod: { target: 'gain', lfo_hz: 0.21, depth: 0.35 } } },
            // R5 — night is a different SELECTION, not the same crowd quieter. After dark the
            // market is a roof over an empty floor and what you hear is the building.
            { when: { tod: 'night' }, classes: ['structure'],
              synth: { kind: 'drone', partials_hz: [64, 96, 128], partial_gains_db: [-9, -15, -21],
                       waveform: 'sine', detune_cents: 11, gain_db: -13,
                       filter: { type: 'lowpass', hz: 380, q: 1 } } }] },
    L3: { id: 'l3_market_business', text: 'a crate down; coin counted; a shutter',
          interval_s: L3_IV(8, 18), level_db: 0, events: [
            { id: 'crate_down', classes: ['labour'], weight: 3, pan: [-0.9, 0.9],
              synth: { kind: 'grain', source: 'noise', colour: 'brown',
                       filter: { type: 'bandpass', hz: 210, q: 3 },
                       env: { attack_s: 0.002, decay_s: 0.33 }, gain_db: -5 } },
            { id: 'coin_count', classes: ['trade'], weight: 2, pan: [-0.5, 0.5],
              synth: { kind: 'grain', source: 'noise', colour: 'white',
                       filter: { type: 'bandpass', hz: 5200, q: 4 },
                       env: { attack_s: 0.001, decay_s: 0.12 }, gain_db: -9,
                       repeats: { n: 5, gap_s: 0.13, gap_jitter_s: 0.05 } } },
            { id: 'shutter', classes: ['timber'], weight: 1, pan: [-0.8, 0.8], when: { tod: 'night' },
              synth: { kind: 'grain', source: 'noise', colour: 'brown',
                       filter: { type: 'bandpass', hz: 330, q: 2.4 },
                       env: { attack_s: 0.004, decay_s: 0.5 }, gain_db: -6 } }] },
    L4: { id: 'l4_market_animals', text: 'the animals people bring to a market',
          interval_s: L4_IV(45, 120), level_db: 2, events: [
            { id: 'guar_complaint', classes: ['creature'], weight: 3, pan: [-0.85, 0.85],
              when: { tod: 'day' },
              synth: { kind: 'grain', source: 'osc', waveform: 'sawtooth',
                       partials_hz: [138, 207], glide_hz: [138, 104],
                       filter: { type: 'lowpass', hz: 950, q: 1.6 },
                       env: { attack_s: 0.04, decay_s: 0.75 }, gain_db: -6 } },
            { id: 'roof_rat', classes: ['creature'], weight: 2, pan: [-0.7, 0.7],
              when: { tod: 'night' },
              synth: { kind: 'grain', source: 'noise', colour: 'white',
                       filter: { type: 'highpass', hz: 4800, q: 1.2 },
                       env: { attack_s: 0.002, decay_s: 0.1 }, gain_db: -10,
                       repeats: { n: 6, gap_s: 0.09, gap_jitter_s: 0.04 } } }] },
  },
  {
    id: 'street', kind: 'settlement', region_name: 'Stormhold street (W1-07)',
    brief: 'a street between stone buildings: weather arriving off the roofs, boots on stone, '
      + 'and the town at whatever hour it is',
    key: { wet_dry: 'wet', open_enclosed: 'enclosed', living_dead: 'living' },
    target: -25.5,
    denies: [],
    L1: { id: 'l1_street_canyon', text: 'the air between two stone walls, which is a resonator',
          level_db: 0, classes: ['pressure'],
          synth: { kind: 'noise', colour: 'brown', filter: { type: 'bandpass', hz: 175, q: 0.85 },
                   gain_db: -6, width: 0.6, mod: { target: 'filter_hz', lfo_hz: 0.034, depth: 0.28 } } },
    L2: { id: 'l2_gutters_and_town', text: 'water off the roofs; the town behind the shutters',
          level_db: -4, sublayers: [
            { when: {}, classes: ['water'],
              synth: { kind: 'noise', colour: 'pink', filter: { type: 'highpass', hz: 1600, q: 0.6 },
                       gain_db: -15, width: 0.7, mod: { target: 'gain', lfo_hz: 0.13, depth: 0.4 } } },
            { when: { tod: 'day' }, classes: ['crowd'],
              synth: { kind: 'noise', colour: 'pink', filter: { type: 'bandpass', hz: 620, q: 0.9 },
                       gain_db: -14, width: 0.85, mod: { target: 'gain', lfo_hz: 0.17, depth: 0.3 } } }] },
    L3: { id: 'l3_street_traffic', text: 'boots on wet stone; a door; a gutter letting go',
          interval_s: L3_IV(8, 22), level_db: 0, events: [
            { id: 'boots_stone', classes: ['labour'], weight: 3, pan: [-0.95, 0.95],
              synth: { kind: 'grain', source: 'noise', colour: 'white',
                       filter: { type: 'bandpass', hz: 1500, q: 2.6 },
                       env: { attack_s: 0.001, decay_s: 0.09 }, gain_db: -9,
                       repeats: { n: 5, gap_s: 0.34, gap_jitter_s: 0.05 } } },
            { id: 'door_close', classes: ['timber'], weight: 2, pan: [-0.75, 0.75],
              synth: { kind: 'grain', source: 'noise', colour: 'brown',
                       filter: { type: 'bandpass', hz: 145, q: 2.8 },
                       env: { attack_s: 0.002, decay_s: 0.45 }, gain_db: -5 } },
            { id: 'gutter_release', classes: ['water'], weight: 2, pan: [-0.9, 0.9],
              synth: { kind: 'grain', source: 'noise', colour: 'pink',
                       filter: { type: 'bandpass', hz: 2400, q: 1.4 },
                       env: { attack_s: 0.01, decay_s: 0.55 }, gain_db: -8 } }] },
    L4: { id: 'l4_street_life', text: 'what is out at this hour',
          interval_s: L4_IV(50, 150), level_db: 1, events: [
            { id: 'street_dog', classes: ['creature'], weight: 2, pan: [-0.9, 0.9],
              when: { tod: 'night' },
              synth: { kind: 'grain', source: 'osc', waveform: 'sawtooth',
                       partials_hz: [420, 630], glide_hz: [420, 290],
                       filter: { type: 'bandpass', hz: 1100, q: 1.5 },
                       env: { attack_s: 0.008, decay_s: 0.3 }, gain_db: -7,
                       repeats: { n: 3, gap_s: 0.4, gap_jitter_s: 0.12 } } },
            { id: 'roof_hackwing', classes: ['creature'], weight: 2, pan: [-1, 1],
              when: { tod: 'day' },
              synth: { kind: 'grain', source: 'osc', waveform: 'sawtooth', freq_hz: 2050,
                       glide_hz: [2050, 1180], filter: { type: 'highpass', hz: 900, q: 1.2 },
                       env: { attack_s: 0.005, decay_s: 0.4 }, gain_db: -8 } }] },
  },
];

// ---- invariants, asserted here so a bad bed cannot reach the disk ----------------------------
const l1ids = new Set();
for (const b of beds) {
  // R2, extended to the interiors: no two beds share a base drone. The census enforces it across
  // the whole set; this catches a copy-paste before the file is written.
  if (l1ids.has(b.L1.id)) throw new Error(`duplicate L1 id ${b.L1.id}`);
  l1ids.add(b.L1.id);
  // §A: the bed sits at −28 to −24 LUFS. A target ON the fence is what cost round 1 its B5 —
  // marauders-coast measured −23.991 against a target of −24 and missed by 0.009 LU.
  if (b.target > -24.5 || b.target < -27.5) throw new Error(`${b.id} target ${b.target} on or over the fence`);
}

mkdirSync(DIR, { recursive: true });
let n = 0;
for (const b of beds) {
  const doc = {
    schema: 'elder-souls/ambience-bed@1',
    id: b.id,
    cell: b.id,
    bed_kind: b.kind,
    region_name: b.region_name,
    brief: b.brief,
    key: b.key,
    bed_lufs_target: b.target,
    crossfade_s: 4,
    max_voices: 8,
    denies: b.denies,
    layers: { L1: b.L1, L2: b.L2, L3: b.L3, L4: b.L4 },
    emitters: [],
    provenance: PROV,
  };
  // R1 / census C2: a null layer that does not say why is the omission R1 exists to distinguish
  // from a design statement.
  for (const L of ['L1', 'L2', 'L3', 'L4']) {
    if (doc.layers[L] === null && b[`${L}_null_reason`]) doc[`${L}_null_reason`] = b[`${L}_null_reason`];
  }
  if (b.declared_incomplete) doc.declared_incomplete = true;
  writeFileSync(join(DIR, `${b.id}.json`), JSON.stringify(doc, null, 2) + '\n');
  n++;
}
console.log(`mk-interior-beds: wrote ${n} beds to game/data/audio/ambience/interiors/`);
console.log(`  interiors:   ${beds.filter((b) => b.kind === 'interior').map((b) => b.id).join(', ')}`);
console.log(`  settlements: ${beds.filter((b) => b.kind === 'settlement').map((b) => b.id).join(', ')}`);
