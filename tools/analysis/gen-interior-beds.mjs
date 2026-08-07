#!/usr/bin/env node
// gen-interior-beds.mjs — the R4 interior beds and RI-WLD08 §6's settlement beds.
//
// W1-22 round 2. `audio.ambience.region`. Spec: RI-AUD03 R4, RI-WLD08 §6.
//
// WHY THESE EXIST NOW, AND WHY ROUND 1's ANSWER WAS NOT PERMITTED.
//
// Round 1 shipped interiors SILENT and declared the absence: `getAmbienceState().suppressed`
// named the cell, `getUnimplemented()` carried the entry, and the handoff called it "deliberately
// absent". That is an honest absence and it is a better failure than papering over. It is still
// not what the item says. R4 reads, in full:
//
//     "R4 — Interiors get their own bed, not the exterior bed at −12 dB. A muffled version of
//      outside is the sound of a hole in the design."
//
// The main clause is positive and imperative: interiors GET a bed. The subordinate clause forbids
// one particular wrong bed — the low-passed exterior — which round 1 correctly avoided. Silence
// is a third option and R4 does not sanction it. Nor does R1's `null` permission cover it: R1 is
// scoped to LAYERS inside a declared bed ("Every region declares all four layers, and a layer may
// be declared `null`"), and the wave-0 ARBITRATION amendment that makes silence a design
// statement is scoped to a REGION ("silence in a dry region is a design statement") and cites R1,
// i.e. layers, not whole cells. RI-WLD08 §6 then settles it from outside with a count no silence
// can satisfy: "Distinct ambient beds ≥13 (one per region) + ≥8 settlement beds + ≥4 interior
// beds". The round-1 critic read R4 as mandating a bed; having read R4 myself, so do I.
//
// The measured scale of the absence, from the round-1 verdict: ALL SIX reachable named cells
// suppressed, including `helstrom-market` and `stormhold-street`, which are settlement exteriors.
// Walking into any town in Black Marsh dropped the world to absolute silence.
//
// WHAT IS AUTHORED HERE AND WHAT IS GENERATED. The SPEC tables below are the authoring: every
// L1 is a different instrument, every brief is written for that place, and the denials are
// per-kind design statements. The generator only expands them into the `elder-souls/ambience-bed@1`
// shape the region beds already use, so that ONE loader, ONE driver, ONE census and ONE renderer
// serve all three families. A second bed format would be a second implementation to measure.
//
// GRANULARITY. There are 115 interiors in `game/data/world/interiors/` and thirteen kinds of
// place among them. A bed per interior would be 115 beds nobody could keep distinct — the "one
// swamp loop" failure with more files. A bed per `interior_kind` is the granularity at which the
// places actually differ: a tavern is not a shrine, and two shrines are the same room twice.
//
//   node tools/analysis/gen-interior-beds.mjs [--check]
//
// --check re-generates in memory and exits non-zero if any file on disk differs, so a stale
// hand-edit cannot drift from this spec unnoticed.

import { writeFileSync, readFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..');
const OUT_I = join(ROOT, 'game', 'data', 'audio', 'ambience', 'interiors');
const OUT_S = join(ROOT, 'game', 'data', 'audio', 'ambience', 'settlements');
const CHECK = process.argv.includes('--check');

const noise = (colour, hz, q, gain_db, width, mod, type = 'bandpass') => ({
  kind: 'noise', colour, filter: { type, hz, q }, gain_db, width, ...(mod ? { mod } : {}),
});
const drone = (partials_hz, partial_gains_db, detune_cents, gain_db, filter, mod, waveform = 'sine') => ({
  kind: 'drone', waveform, partials_hz, partial_gains_db, detune_cents, gain_db,
  ...(filter ? { filter } : {}), ...(mod ? { mod } : {}),
});
const gnoise = (colour, hz, q, attack_s, decay_s, gain_db, repeats, type = 'bandpass') => ({
  kind: 'grain', source: 'noise', colour, filter: { type, hz, q },
  env: { attack_s, decay_s }, gain_db, ...(repeats ? { repeats } : {}),
});
const gosc = (freq_hz, extra = {}) => ({
  kind: 'grain', source: 'osc', waveform: 'sine', freq_hz,
  env: { attack_s: 0.01, decay_s: 0.3 }, gain_db: -12, ...extra,
});

// ── INTERIORS ──────────────────────────────────────────────────────────────────────────────────
//
// `applies_to` is the `interior_kind` field of `game/data/world/interiors/*.json`, plus the named
// W1-07 cells that are not in that tree at all (`rootlands-well`, `dungeon-primary`). The counts
// in each brief are the real counts from that directory.
const INTERIORS = [
  {
    id: 'shop', kinds: ['shop'], covers: 30, target: -26,
    brief: 'a counter, a shelf and a closed door: the room is small enough to have no distance in it, and everything you hear is something being weighed, wrapped or written down.',
    key: ['dry', 'enclosed', 'living'],
    denies: [{ class: 'wind', why: 'a shuttered shop has no air movement; the L1 is the room itself, and any wind here would be the exterior bed leaking in, which is exactly what R4 forbids.' }],
    L1: { id: 'i1_shop_room_tone', text: 'the small dry room: shelved goods deaden it, so the tone is narrow and close', level_db: 0, classes: ['pressure'], synth: noise('brown', 190, 3.6, -9, 0.06, { target: 'gain', lfo_hz: 0.031, depth: 0.09 }) },
    L2: { id: 'i2_shop_counter', text: 'the trade going on at the counter, never resolving into words', level_db: -6, subs: [
      { when: {}, classes: ['people'], synth: noise('pink', 420, 1.5, -19, 0.25, { target: 'gain', lfo_hz: 0.42, depth: 0.55 }) },
      { when: { tod: 'night' }, classes: ['pressure'], synth: noise('brown', 120, 2.2, -22, 0.05) },
    ] },
    L3: { id: 'i3_shop_handling', text: 'scale-pan, a stopper, a coin set down', interval_s: [9, 26], level_db: -3, events: [
      { id: 'scale_pan', classes: ['industry'], weight: 3, pan: [-0.4, 0.4], synth: gosc(2100, { partials_hz: [2100, 3150, 4300], env: { attack_s: 0.001, decay_s: 0.9 }, gain_db: -17 }) },
      { id: 'stopper', classes: ['industry'], weight: 2, pan: [-0.3, 0.3], synth: gnoise('white', 1500, 5, 0.001, 0.05, -14) },
      { id: 'coin_set_down', classes: ['people'], weight: 2, pan: [-0.2, 0.2], synth: gosc(3400, { partials_hz: [3400, 5100], env: { attack_s: 0.001, decay_s: 0.35 }, gain_db: -19 }) },
    ] },
    L4: { id: 'i4_shop_door_bell', text: 'somebody else comes in, rarely', interval_s: [70, 175], level_db: -5, events: [
      { id: 'door_bell', classes: ['people'], weight: 1, pan: [-0.6, -0.2], synth: gosc(1760, { partials_hz: [1760, 2640, 3520], env: { attack_s: 0.002, decay_s: 1.4 }, gain_db: -16, repeats: { n: 2, gap_s: 0.22, gap_jitter_s: 0.03 } }) },
    ] },
  },
  {
    id: 'dwelling', kinds: ['dwelling'], covers: 31, target: -27,
    brief: 'somebody lives here: a hearth that has been going for hours, a floor that answers to weight, and the small settling noises of a room with a person asleep or working in it.',
    key: ['dry', 'enclosed', 'living'],
    denies: [{ class: 'crowd', why: 'a dwelling is one household. Massed voices belong to the tavern and to the settlement exterior; putting them here would make every home in the province sound like an inn.' }],
    L1: { id: 'i1_hearth_breath', text: 'the hearth breathing — the floor of a lived-in room', level_db: 0, classes: ['fire'], synth: noise('brown', 145, 1.9, -8, 0.12, { target: 'gain', lfo_hz: 0.17, depth: 0.34 }) },
    L2: { id: 'i2_dwelling_settle', text: 'timber and thatch settling; at night the fire is banked and the room goes colder and quieter', level_db: -5, subs: [
      { when: { tod: 'day' }, classes: ['structure'], synth: noise('pink', 700, 1.2, -20, 0.3) },
      { when: { tod: 'night' }, classes: ['structure'], synth: noise('brown', 240, 2.6, -23, 0.15, { target: 'gain', lfo_hz: 0.06, depth: 0.4 }) },
    ] },
    L3: { id: 'i3_dwelling_small', text: 'a pot on the hook, a floorboard, a log giving way', interval_s: [11, 34], level_db: -4, events: [
      { id: 'pot_hook', classes: ['industry'], weight: 2, pan: [-0.35, 0.1], synth: gosc(880, { partials_hz: [880, 1320, 2200], env: { attack_s: 0.002, decay_s: 1.1 }, gain_db: -18 }) },
      { id: 'floorboard', classes: ['structure'], weight: 3, pan: [-0.6, 0.6], synth: gnoise('brown', 260, 3.2, 0.03, 0.28, -13, null, 'lowpass') },
      { id: 'log_collapse', classes: ['fire'], weight: 2, pan: [-0.15, 0.15], synth: gnoise('white', 900, 1.4, 0.004, 0.4, -15, { n: 3, gap_s: 0.09, gap_jitter_s: 0.05 }) },
    ] },
    L4: { id: 'i4_dwelling_sleeper', text: 'the person whose room this is, turning over', interval_s: [80, 180], level_db: -7, events: [
      { id: 'sleeper_turn', classes: ['people'], weight: 1, pan: [-0.4, 0.4], synth: gnoise('brown', 330, 1.1, 0.08, 0.7, -17, null, 'lowpass') },
    ] },
  },
  {
    id: 'tavern', kinds: ['tavern'], covers: 11, target: -24.5,
    brief: 'the loudest room in the province: a wall of low-passed voices with nothing sayable in it, cups, benches and a fire that nobody is tending.',
    key: ['dry', 'enclosed', 'living'],
    denies: [{ class: 'silence_cue', why: 'the tavern is the one interior that must never read as danger. AR-3 seam #3 makes quiet a lethality cue in this build, so a quiet tavern would be a false warning in the one place the player is safest.' }],
    L1: { id: 'i1_tavern_crowd_wall', text: 'massed voices at conversational pitch, low-passed until no word survives — the room tone of people', level_db: 0, classes: ['people'], synth: noise('pink', 520, 0.9, -6, 0.55, { target: 'gain', lfo_hz: 0.31, depth: 0.28 }, 'lowpass') },
    L2: { id: 'i2_tavern_fire_and_night', text: 'by day the trade-hour murmur runs over the fire; after dark the fire is the loud thing and the room thins out', level_db: -4, subs: [
      { when: { tod: 'day' }, classes: ['people'], synth: noise('pink', 1400, 1.1, -17, 0.6, { target: 'gain', lfo_hz: 0.77, depth: 0.5 }) },
      { when: {}, classes: ['fire'], synth: noise('brown', 210, 1.6, -14, 0.2, { target: 'gain', lfo_hz: 0.23, depth: 0.44 }) },
      { when: { tod: 'night' }, classes: ['people'], synth: noise('pink', 340, 1.3, -20, 0.4, { target: 'gain', lfo_hz: 0.12, depth: 0.6 }) },
    ] },
    L3: { id: 'i3_tavern_service', text: 'cups down, a bench dragged, a laugh that gets away from somebody', interval_s: [8, 19], level_db: -2, events: [
      { id: 'cup_down', classes: ['people'], weight: 4, pan: [-0.75, 0.75], synth: gnoise('white', 1100, 4.5, 0.001, 0.11, -12) },
      { id: 'bench_drag', classes: ['structure'], weight: 2, pan: [-0.8, 0.8], synth: gnoise('brown', 380, 1.8, 0.02, 0.55, -13) },
      { id: 'laugh', classes: ['people'], weight: 3, pan: [-0.7, 0.7], synth: gosc(240, { waveform: 'sawtooth', partials_hz: [240, 300, 420], filter: { type: 'lowpass', hz: 900, q: 1.1 }, env: { attack_s: 0.03, decay_s: 0.5 }, gain_db: -15, repeats: { n: 4, gap_s: 0.16, gap_jitter_s: 0.05 } }) },
    ] },
    L4: { id: 'i4_tavern_argument', text: 'an argument two tables away that stops as suddenly as it started', interval_s: [55, 150], level_db: -3, events: [
      { id: 'argument', classes: ['people'], weight: 1, pan: [-0.9, 0.9], synth: gosc(180, { waveform: 'sawtooth', partials_hz: [180, 260, 340], filter: { type: 'lowpass', hz: 700, q: 1.4 }, env: { attack_s: 0.05, decay_s: 1.6 }, gain_db: -12 }) },
    ] },
  },
  {
    id: 'guild', kinds: ['guild'], covers: 14, target: -27,
    brief: 'a working hall with a ledger open on it: a low murmur that is all business, quills, and a strongbox lid that everyone in the room hears.',
    key: ['dry', 'enclosed', 'living'],
    denies: [{ class: 'fauna', why: 'a guild hall keeps its stores sealed. The vermin layer that would be free to add here is the reason regions.json distinguishes a guild from a hold.' }],
    L1: { id: 'i1_guild_hall_tone', text: 'a taller room than a shop and a harder one: plastered stone with a long low tail', level_db: 0, classes: ['pressure'], synth: noise('brown', 118, 5.5, -9, 0.18, { target: 'gain', lfo_hz: 0.019, depth: 0.07 }) },
    L2: { id: 'i2_guild_business', text: 'the murmur of people who are working rather than drinking', level_db: -7, subs: [
      { when: { tod: 'day' }, classes: ['people'], synth: noise('pink', 610, 1.2, -19, 0.35, { target: 'gain', lfo_hz: 0.29, depth: 0.4 }) },
      { when: { tod: 'night' }, classes: ['structure'], synth: noise('brown', 95, 3.1, -24, 0.1) },
    ] },
    L3: { id: 'i3_guild_paper', text: 'quill, page turned, a seal pressed', interval_s: [10, 30], level_db: -5, events: [
      { id: 'quill', classes: ['industry'], weight: 4, pan: [-0.5, 0.5], synth: gnoise('white', 4200, 2.4, 0.004, 0.16, -18, { n: 5, gap_s: 0.11, gap_jitter_s: 0.05 }) },
      { id: 'page_turn', classes: ['industry'], weight: 3, pan: [-0.4, 0.4], synth: gnoise('white', 2600, 1.6, 0.006, 0.22, -19) },
      { id: 'seal_press', classes: ['industry'], weight: 1, pan: [-0.2, 0.2], synth: gnoise('brown', 480, 2.1, 0.002, 0.14, -13) },
    ] },
    L4: { id: 'i4_guild_strongbox', text: 'the strongbox, and everyone in the room hears it', interval_s: [90, 180], level_db: -2, events: [
      { id: 'strongbox_lid', classes: ['industry'], weight: 1, pan: [-0.25, 0.25], synth: gnoise('brown', 165, 2.8, 0.004, 1.2, -10, null, 'lowpass') },
    ] },
  },
  {
    id: 'travel', kinds: ['travel'], covers: 8, target: -26,
    brief: 'a way-post at the edge of somewhere: half of what you hear is outside and getting in past a bad shutter, and the other half is an animal that would rather be moving.',
    key: ['dry', 'enclosed', 'living'],
    denies: [{ class: 'crowd', why: 'a travel post is two or three people at most; its emptiness is why it reads as an edge rather than a place.' }],
    L1: { id: 'i1_waypost_shutter', text: 'the shutter that does not quite close, and the draught behind it', level_db: 0, classes: ['wind'], synth: noise('pink', 340, 1.1, -10, 0.35, { target: 'filter_hz', lfo_hz: 0.077, depth: 0.5 }) },
    L2: { id: 'i2_waypost_stock', text: 'the animals in the back, shifting; at night they lie down and the draught is all there is', level_db: -6, subs: [
      { when: { tod: 'day' }, classes: ['fauna'], synth: noise('brown', 175, 2.4, -19, 0.2, { target: 'gain', lfo_hz: 0.14, depth: 0.55 }) },
      { when: { tod: 'night' }, classes: ['wind'], synth: noise('pink', 900, 0.8, -23, 0.5, { target: 'gain', lfo_hz: 0.05, depth: 0.35 }) },
    ] },
    L3: { id: 'i3_waypost_harness', text: 'harness, a hoof on board, a strap pulled through', interval_s: [12, 36], level_db: -4, events: [
      { id: 'harness', classes: ['industry'], weight: 3, pan: [-0.55, 0.55], synth: gosc(2600, { partials_hz: [2600, 3900, 5200], env: { attack_s: 0.001, decay_s: 0.5 }, gain_db: -19, repeats: { n: 4, gap_s: 0.08, gap_jitter_s: 0.04 } }) },
      { id: 'hoof_board', classes: ['fauna'], weight: 3, pan: [-0.6, 0.6], synth: gnoise('brown', 210, 2.6, 0.002, 0.2, -12, null, 'lowpass') },
      { id: 'strap', classes: ['industry'], weight: 2, pan: [-0.3, 0.3], synth: gnoise('white', 1900, 1.2, 0.02, 0.3, -18) },
    ] },
    L4: { id: 'i4_waypost_guar', text: 'the guar, complaining about the hour', interval_s: [60, 165], level_db: -3, events: [
      { id: 'guar_low', classes: ['fauna'], weight: 1, pan: [-0.5, 0.5], synth: gosc(105, { waveform: 'sawtooth', partials_hz: [105, 157, 210], glide_hz: [105, 88], filter: { type: 'lowpass', hz: 620, q: 1.5 }, env: { attack_s: 0.06, decay_s: 1.1 }, gain_db: -12 }) },
    ] },
  },
  {
    id: 'shrine', kinds: ['shrine'], covers: 8, target: -28,
    brief: 'a stone box with water in it and nobody in it: one drip with a tail longer than the room should be able to give it, and no other sound at all.',
    key: ['wet', 'enclosed', 'dead'],
    denies: [
      { class: 'people', why: 'a shrine with somebody in it is a temple. The whole identity of the small shrine is that you are the only thing here that is breathing.' },
      { class: 'fauna', why: 'nothing lives in a sealed stone box, and R1 makes that absence a declared layer rather than an omission.' },
    ],
    L1: { id: 'i1_shrine_stone_box', text: 'sealed stone: a narrow standing tone with almost no air in it', level_db: 0, classes: ['pressure'], synth: drone([58, 87, 116], [-6, -16, -22], 3, -13, { type: 'lowpass', hz: 300, q: 1.2 }, { target: 'gain', lfo_hz: 0.013, depth: 0.1 }) },
    L2: null, L2_null_reason: 'RI-AUD03 R1 — a shrine has no moving texture. There is no wind, no water running and nobody in it; the only thing that moves is the drip, which is an L3 one-shot. An L2 here would be the "moving texture because every bed has one" reflex the item names, and it would take the room\'s stillness away.',
    L3: { id: 'i3_shrine_drip', text: 'one drip, and a tail the room should not be able to give it', interval_s: [9, 22], level_db: 0, events: [
      { id: 'drip_long_tail', classes: ['water'], weight: 1, pan: [-0.12, 0.12], synth: gosc(1250, { partials_hz: [1250, 1875, 2500, 3750], env: { attack_s: 0.001, decay_s: 2.6 }, gain_db: -14 }) },
    ] },
    L4: null, L4_null_reason: 'RI-AUD03 R1 — there are no animals in a shrine, and the absence is the point. Deep Marshes L4 is "there are no birds"; this is the built version of the same statement, and the census reads it as content rather than as unfinished work.',
  },
  {
    id: 'temple', kinds: ['temple'], covers: 6, target: -26,
    brief: 'a volume of stone with a Hist root through the floor of it: the same choral chord the Stone Forest is built on, heard from inside a building.',
    key: ['dry', 'enclosed', 'living'],
    lore_note: 'R6 CROSS-REFERENCE, THIRD OF ITS KIND. RI-AUD03 R6 names two: Stone Wastes\' dying Hist is Stone Forest\'s hum degraded, and the Deep Marshes\' breathing is in no bestiary. This is a third and it is deliberate — the temple\'s L1 is Stone Forest\'s chord [110, 164.81, 220, 329.63] at the healthy detune, indoors. It says in sound that an Argonian temple is a Hist and a roof, which no book in the build states.',
    key_seam: ['stone-forest', 'stone-wastes'],
    denies: [{ class: 'wind', why: 'a temple is sealed; the chord has to stand in still air or the beating that carries R6\'s cross-reference is smeared away.' }],
    L1: { id: 'i1_temple_hist_chord', text: 'the Hist through the floor — Stone Forest\'s choral hum, indoors', level_db: 0, classes: ['hist'], synth: drone([110, 164.81, 220, 329.63], [-7, -12, -15, -21], 4, -12, { type: 'lowpass', hz: 1400, q: 0.9 }, { target: 'gain', lfo_hz: 0.041, depth: 0.16 }) },
    L2: { id: 'i2_temple_air', text: 'the volume of the room itself, and at night a colder, higher one', level_db: -7, subs: [
      { when: { tod: 'day' }, classes: ['pressure'], synth: noise('brown', 145, 2.2, -19, 0.4) },
      { when: { tod: 'night' }, classes: ['pressure'], synth: noise('pink', 1900, 0.9, -23, 0.5, { target: 'gain', lfo_hz: 0.033, depth: 0.3 }) },
    ] },
    L3: { id: 'i3_temple_offering', text: 'a bowl set down; a footfall crossing stone', interval_s: [14, 38], level_db: -5, events: [
      { id: 'bowl_stone', classes: ['people'], weight: 2, pan: [-0.35, 0.35], synth: gosc(760, { partials_hz: [760, 1140, 1520], env: { attack_s: 0.002, decay_s: 1.9 }, gain_db: -17 }) },
      { id: 'stone_footfall', classes: ['people'], weight: 3, pan: [-0.7, 0.7], synth: gnoise('brown', 300, 1.6, 0.003, 0.5, -15, null, 'lowpass') },
    ] },
    L4: { id: 'i4_temple_bell', text: 'the slow bell, which is not on any hour anyone outside the temple keeps', interval_s: [95, 180], level_db: -2, events: [
      { id: 'temple_bell', classes: ['people'], weight: 1, pan: [-0.2, 0.2], synth: gosc(196, { partials_hz: [196, 466, 588, 784], env: { attack_s: 0.004, decay_s: 5.5 }, gain_db: -11 }) },
    ] },
  },
  {
    id: 'hold', kinds: ['hold'], covers: 1, target: -25, cells: ['barge-hold'],
    brief: 'below the waterline of something that is still moving: the hull working against itself, bilge water finding the low side, and rope taking load it does not want.',
    key: ['wet', 'enclosed', 'living'],
    denies: [{ class: 'birdsong', why: 'you are under the deck. Anything with a bird in it here is the exterior bed leaking through the hatch, which is R4\'s named failure.' }],
    L1: { id: 'i1_hull_working', text: 'the hull working — a slow structural groan with the sea under it', level_db: 0, classes: ['structure'], synth: drone([41, 62, 83], [-5, -13, -19], 9, -10, { type: 'lowpass', hz: 420, q: 1.1 }, { target: 'pitch', lfo_hz: 0.071, depth: 0.02 }) },
    L2: { id: 'i2_bilge', text: 'bilge water finding the low side as the barge rolls', level_db: -5, subs: [
      { when: {}, classes: ['water'], synth: noise('pink', 780, 1.1, -15, 0.45, { target: 'gain', lfo_hz: 0.13, depth: 0.62 }) },
      { when: { tod: 'night' }, classes: ['water'], synth: noise('brown', 260, 1.9, -20, 0.2, { target: 'gain', lfo_hz: 0.09, depth: 0.5 }) },
    ] },
    L3: { id: 'i3_hold_rope', text: 'rope under load; a crate shifting; a hatch above', interval_s: [10, 28], level_db: -3, events: [
      { id: 'rope_load', classes: ['structure'], weight: 4, pan: [-0.6, 0.6], synth: gnoise('brown', 330, 5.5, 0.05, 0.75, -12) },
      { id: 'crate_shift', classes: ['structure'], weight: 2, pan: [-0.7, 0.7], synth: gnoise('brown', 180, 2.2, 0.006, 0.42, -11, null, 'lowpass') },
      { id: 'hatch_above', classes: ['structure'], weight: 1, pan: [-0.15, 0.15], synth: gnoise('white', 620, 1.4, 0.002, 0.3, -16) },
    ] },
    L4: { id: 'i4_hold_vermin', text: 'something in the cargo that is not cargo', interval_s: [70, 175], level_db: -8, events: [
      { id: 'cargo_vermin', classes: ['fauna'], weight: 1, pan: [-0.85, 0.85], synth: gnoise('white', 5200, 3.2, 0.001, 0.09, -20, { n: 6, gap_s: 0.06, gap_jitter_s: 0.04 }) },
    ] },
  },
  {
    id: 'prison', kinds: ['prison'], covers: 2, target: -28,
    brief: 'wet stone with a door at the far end of it. Everything you can hear is a long way off and none of it is coming for you.',
    key: ['wet', 'enclosed', 'dead'],
    denies: [
      { class: 'fauna', why: 'nothing lives down here, and a rat layer would make the cell feel inhabited. The point of the room is that you are the only warm thing in it.' },
      { class: 'people', why: 'there are other prisoners and they are NOT IN THIS CELL. Their voices would come to you as a distant door and nothing else, which is what the L4 is; anything closer is the room lying about how alone you are.' },
    ],
    L1: { id: 'i1_prison_wet_stone', text: 'wet stone, and the low pressure of a lot of it overhead', level_db: 0, classes: ['pressure'], synth: noise('brown', 74, 2.8, -8, 0.08, { target: 'gain', lfo_hz: 0.011, depth: 0.13 }) },
    L2: { id: 'i2_prison_seep', text: 'water moving through the wall rather than down it', level_db: -8, subs: [
      { when: {}, classes: ['water'], synth: noise('pink', 1600, 1.4, -22, 0.15, { target: 'gain', lfo_hz: 0.037, depth: 0.45 }) },
    ] },
    L3: { id: 'i3_prison_drip_chain', text: 'a drip into standing water; a chain taking up slack', interval_s: [8, 26], level_db: -4, events: [
      { id: 'drip_standing', classes: ['water'], weight: 5, pan: [-0.5, 0.5], synth: gosc(880, { partials_hz: [880, 1320], env: { attack_s: 0.001, decay_s: 0.85 }, gain_db: -16 }) },
      { id: 'chain_slack', classes: ['industry'], weight: 2, pan: [-0.7, 0.7], synth: gnoise('white', 3300, 4.5, 0.001, 0.22, -17, { n: 3, gap_s: 0.13, gap_jitter_s: 0.06 }) },
    ] },
    L4: { id: 'i4_prison_far_door', text: 'a door somewhere it takes a long time to reach', interval_s: [110, 180], level_db: -5, events: [
      { id: 'far_door', classes: ['structure'], weight: 1, pan: [-0.9, -0.5], synth: gnoise('brown', 130, 2.4, 0.01, 1.8, -12, null, 'lowpass') },
    ] },
  },
  {
    id: 'hall', kinds: ['hall', 'gate'], covers: 4, target: -26, cells: ['writ-house'],
    brief: 'a public room built to be spoken in: a wooden volume with a long tail, banners moving in the draught from the door, and boots on the boards above.',
    key: ['dry', 'enclosed', 'living'],
    denies: [{ class: 'water', why: 'a moot hall is the driest interior in the province and that is why a voice carries in it. Any water here belongs to the hold or the prison.' }],
    L1: { id: 'i1_hall_timber_volume', text: 'a large timber volume — the tail is the identity', level_db: 0, classes: ['structure'], synth: drone([87, 130.8, 174.6], [-6, -14, -20], 6, -12, { type: 'lowpass', hz: 700, q: 0.8 }, { target: 'gain', lfo_hz: 0.027, depth: 0.14 }) },
    L2: { id: 'i2_hall_banners', text: 'banners and the draught from a door that is always being used; after dark the hall is empty and only the draught is left', level_db: -6, subs: [
      { when: { tod: 'day' }, classes: ['structure'], synth: noise('pink', 1100, 1.0, -18, 0.5, { target: 'gain', lfo_hz: 0.24, depth: 0.5 }) },
      { when: { tod: 'night' }, classes: ['wind'], synth: noise('pink', 480, 0.9, -23, 0.55, { target: 'gain', lfo_hz: 0.045, depth: 0.4 }) },
    ] },
    L3: { id: 'i3_hall_boots', text: 'boots on the boards above; a bench; a door on its latch', interval_s: [10, 32], level_db: -4, events: [
      { id: 'boots_above', classes: ['people'], weight: 4, pan: [-0.5, 0.5], elevation: 'above', synth: gnoise('brown', 240, 2.0, 0.003, 0.3, -13, { n: 4, gap_s: 0.28, gap_jitter_s: 0.06 }, 'lowpass') },
      { id: 'latch', classes: ['structure'], weight: 2, pan: [-0.65, 0.65], synth: gnoise('white', 2200, 5.5, 0.001, 0.1, -15) },
    ] },
    L4: { id: 'i4_hall_proclamation', text: 'somebody reading something out, one room away', interval_s: [80, 180], level_db: -6, events: [
      { id: 'proclamation', classes: ['people'], weight: 1, pan: [-0.3, 0.3], synth: gosc(210, { waveform: 'sawtooth', partials_hz: [210, 315, 420], filter: { type: 'lowpass', hz: 800, q: 1.2 }, env: { attack_s: 0.1, decay_s: 2.4 }, gain_db: -15 }) },
    ] },
  },
  {
    id: 'well', kinds: [], covers: 1, target: -27, cells: ['rootlands-well'],
    brief: 'a stone shaft with water a long way down it: the tone of the shaft itself, rope on the windlass, and everything you drop taking too long to arrive.',
    key: ['wet', 'enclosed', 'dead'],
    denies: [{ class: 'people', why: 'a well is a place you are alone in even in the middle of a village; the voices are all above the rim and they do not come down.' }],
    L1: { id: 'i1_well_shaft', text: 'the shaft: a narrow column of air with a strong resonance and water under it', level_db: 0, classes: ['pressure'], synth: drone([97, 194, 291], [-6, -13, -19], 2, -13, { type: 'bandpass', hz: 200, q: 3.6 }, { target: 'filter_hz', lfo_hz: 0.021, depth: 0.12 }) },
    L2: { id: 'i2_well_water_far', text: 'water moving far below, heard through the shaft rather than directly', level_db: -9, subs: [
      { when: {}, classes: ['water'], synth: noise('pink', 260, 2.4, -21, 0.1, { target: 'gain', lfo_hz: 0.058, depth: 0.5 }) },
    ] },
    L3: { id: 'i3_well_rope', text: 'the windlass; a stone knocked in; the arrival, much later', interval_s: [13, 38], level_db: -3, events: [
      { id: 'windlass', classes: ['industry'], weight: 3, pan: [-0.3, 0.3], synth: gnoise('brown', 420, 4.8, 0.04, 0.65, -13) },
      { id: 'stone_falls', classes: ['structure'], weight: 2, pan: [-0.1, 0.1], synth: gosc(620, { partials_hz: [620, 930], glide_hz: [620, 210], env: { attack_s: 0.001, decay_s: 1.5 }, gain_db: -17 }) },
    ] },
    L4: null, L4_null_reason: 'RI-AUD03 R1 — nothing lives in the shaft. A well with a creature layer is a well with a monster in it, which is a dungeon; the emptiness is what makes the drop frightening.',
  },
  {
    id: 'dungeon', kinds: [], covers: 1, target: -28, cells: ['dungeon-primary'],
    brief: 'the deep places: a pressure you feel rather than hear, and, very rarely, a lot of stone moving somewhere you cannot see.',
    key: ['dry', 'enclosed', 'dead'],
    ar2_note: 'AR-2 WATCH. RI-AUD03\'s ARBITRATION header names "near-total silence outside boss arenas, so that the world reads as a mausoleum" as Souls leakage and a FAIL. This bed is the quietest thing in the build and it is deliberately NOT silent: it has a floor you can hear, a moving texture, an event layer and a creature layer. The Deep Marshes are quiet the same way and for the same reason — under AR-3 seam #3 quiet is a lethality cue in this world, and a cue only works if it is a sound.',
    denies: [{ class: 'wind', why: 'there is no way out for air down here. The absence of wind is how a player tells a dungeon from a cave mouth without looking.' }],
    L1: { id: 'i1_dungeon_pressure', text: 'the weight of everything above you, as a tone', level_db: 0, classes: ['pressure'], synth: drone([33, 49.5, 66], [-4, -17, -24], 11, -9, { type: 'lowpass', hz: 190, q: 1.0 }, { target: 'gain', lfo_hz: 0.009, depth: 0.22 }) },
    L2: { id: 'i2_dungeon_air', text: 'air that has been in here a long time, moving very slightly', level_db: -10, subs: [
      { when: {}, classes: ['pressure'], synth: noise('brown', 88, 1.7, -24, 0.08, { target: 'gain', lfo_hz: 0.023, depth: 0.55 }) },
    ] },
    L3: { id: 'i3_dungeon_settle', text: 'grit falling; something settling that was already settled', interval_s: [16, 40], level_db: -6, events: [
      { id: 'grit_fall', classes: ['structure'], weight: 4, pan: [-0.8, 0.8], synth: gnoise('white', 3800, 2.1, 0.001, 0.14, -19, { n: 5, gap_s: 0.07, gap_jitter_s: 0.05 }) },
      { id: 'stone_settle', classes: ['structure'], weight: 1, pan: [-0.4, 0.4], synth: gnoise('brown', 105, 2.6, 0.008, 1.1, -13, null, 'lowpass') },
    ] },
    L4: { id: 'i4_dungeon_far_movement', text: 'a lot of stone moving, a long way off, and then not again for a long time', interval_s: [120, 180], level_db: -4, events: [
      { id: 'far_stone_movement', classes: ['structure'], weight: 1, pan: [-0.95, 0.95], synth: gosc(52, { waveform: 'sawtooth', partials_hz: [52, 78, 104], glide_hz: [52, 38], filter: { type: 'lowpass', hz: 200, q: 1.8 }, env: { attack_s: 0.4, decay_s: 3.2 }, gain_db: -10 }) },
    ] },
  },
];

// ── SETTLEMENTS ────────────────────────────────────────────────────────────────────────────────
//
// One per settlement in `game/data/world/settlements/`, plus `tidewrack`, which owns two interiors
// (`barge-hold`, `writ-house`) but has no settlement file of its own. A settlement bed REPLACES
// the region bed inside the town's radius: R4's principle applied outwards. A town that is the
// marsh with people in it is the same "hole in the design" as a cellar that is the marsh muffled.
const SETTLEMENTS = [
  { id: 'helstrom', region: 'blackwood', target: -24.5, cells: ['helstrom-market'],
    brief: 'the tree-city: canopy pressure overhead, rope walkways under load, and a market that is louder than the forest it is built into.',
    key: ['wet', 'open', 'living'],
    l1: drone([73.4, 110, 146.8], [-5, -14, -20], 7, -11, { type: 'lowpass', hz: 500, q: 0.9 }, { target: 'gain', lfo_hz: 0.037, depth: 0.2 }),
    l1id: 's1_helstrom_canopy_city', l1text: 'the mass of the canopy over a city built inside it',
    l2: [['day', noise('pink', 780, 1.1, -14, 0.6, { target: 'gain', lfo_hz: 0.44, depth: 0.5 }), 'people', 'the market, all of it at once'],
         ['night', noise('pink', 3100, 1.6, -18, 0.7, { target: 'gain', lfo_hz: 1.9, depth: 0.45 }), 'insects', 'after dark the market goes and the insect wall comes back']],
    l3: [['rope_walkway', 'structure', gnoise('brown', 300, 5.0, 0.04, 0.7, -12)],
         ['market_call', 'people', gosc(330, { waveform: 'sawtooth', partials_hz: [330, 495], filter: { type: 'lowpass', hz: 1200, q: 1.1 }, env: { attack_s: 0.05, decay_s: 0.9 }, gain_db: -15 })]],
    l4: ['chitin_hound_in_town', 'fauna', gosc(1400, { partials_hz: [1400, 2100], env: { attack_s: 0.001, decay_s: 0.09 }, gain_db: -15, repeats: { n: 2, gap_s: 0.12, gap_jitter_s: 0.01 } })] },
  { id: 'stormhold', region: 'salt-hills', target: -25, cells: ['stormhold-street'],
    brief: 'stone streets on high ground: the wind that the Salt Hills have, funnelled between buildings, and a forge that never goes out.',
    key: ['dry', 'open', 'living'],
    l1: noise('pink', 620, 0.7, -7, 0.75, { target: 'filter_hz', lfo_hz: 0.052, depth: 0.4 }, 'lowpass'),
    l1id: 's1_stormhold_street_wind', l1text: 'hill wind funnelled between stone walls — narrower and harder than the open hill',
    l2: [['day', noise('brown', 165, 2.2, -15, 0.25, { target: 'gain', lfo_hz: 0.19, depth: 0.5 }), 'industry', 'the forge, which is the town\'s heartbeat'],
         ['night', noise('pink', 1500, 0.8, -20, 0.6, { target: 'gain', lfo_hz: 0.08, depth: 0.4 }), 'wind', 'at night the forge is banked and the street is only wind']],
    l3: [['forge_strike', 'industry', gnoise('white', 2400, 6.5, 0.001, 0.55, -11, { n: 3, gap_s: 0.35, gap_jitter_s: 0.03 })],
         ['cart_stone', 'people', gnoise('brown', 190, 1.8, 0.02, 0.8, -13, null, 'lowpass')]],
    l4: ['guar_bells_in_street', 'fauna', gosc(1980, { partials_hz: [1980, 2970, 3960], env: { attack_s: 0.001, decay_s: 0.7 }, gain_db: -17, repeats: { n: 5, gap_s: 0.19, gap_jitter_s: 0.07 } })] },
  { id: 'lilmoth', region: 'eastern-rootlands', target: -25.5,
    brief: 'a port rotting where it stands: planks over low tide, jelly-hum under the stilts, and everything creaking in a different key.',
    key: ['wet', 'open', 'living'],
    l1: drone([61.7, 92.5, 123.5, 185], [-6, -12, -17, -23], 14, -12, { type: 'lowpass', hz: 620, q: 1.0 }, { target: 'pitch', lfo_hz: 0.033, depth: 0.03 }),
    l1id: 's1_lilmoth_rot_hum', l1text: 'the jelly-hum of the Eastern Rootlands with a town rotting on top of it',
    l2: [['', noise('pink', 430, 1.3, -14, 0.5, { target: 'gain', lfo_hz: 0.16, depth: 0.6 }), 'water', 'low tide sucking at the pilings'],
         ['night', noise('brown', 200, 2.0, -19, 0.3, { target: 'gain', lfo_hz: 0.07, depth: 0.5 }), 'structure', 'the boards taking the night cold']],
    l3: [['plank_creak', 'structure', gnoise('brown', 270, 4.4, 0.03, 0.9, -12)],
         ['bladder_pop', 'fauna', gosc(540, { partials_hz: [540, 810], glide_hz: [540, 300], env: { attack_s: 0.001, decay_s: 0.28 }, gain_db: -15 })]],
    l4: ['wamasu_low_in_port', 'fauna', gosc(78, { waveform: 'sawtooth', partials_hz: [78, 117, 156], filter: { type: 'lowpass', hz: 400, q: 1.6 }, env: { attack_s: 0.2, decay_s: 2.2 }, gain_db: -11 })] },
  { id: 'soulrest', region: 'marauders-coast', target: -25,
    brief: 'quays, tar and tide: the sea the Marauder\'s Coast has, heard from behind a harbour wall, with bells that are working bells and not landmarks.',
    key: ['wet', 'open', 'living'],
    l1: noise('brown', 300, 0.6, -7, 0.9, { target: 'gain', lfo_hz: 0.083, depth: 0.4 }, 'lowpass'),
    l1id: 's1_soulrest_harbour_floor', l1text: 'the sea with a harbour wall in front of it — the same water, one obstacle nearer',
    l2: [['day', noise('pink', 1700, 0.9, -15, 0.7, { target: 'gain', lfo_hz: 0.28, depth: 0.45 }), 'people', 'the quay working'],
         ['night', noise('pink', 900, 1.1, -19, 0.65, { target: 'gain', lfo_hz: 0.11, depth: 0.55 }), 'water', 'after dark the quay is water and rope and nothing else']],
    l3: [['tar_barrel', 'industry', gnoise('brown', 220, 2.6, 0.006, 0.5, -13, null, 'lowpass')],
         ['quay_bell', 'people', gosc(740, { partials_hz: [740, 1110, 1480], env: { attack_s: 0.002, decay_s: 1.7 }, gain_db: -16 })]],
    l4: ['gull_over_quay', 'fauna', gosc(1550, { waveform: 'sawtooth', partials_hz: [1550, 2325], glide_hz: [1550, 1150], filter: { type: 'bandpass', hz: 1900, q: 2.2 }, env: { attack_s: 0.01, decay_s: 0.45 }, gain_db: -14, repeats: { n: 3, gap_s: 0.25, gap_jitter_s: 0.08 } })] },
  { id: 'gideon', region: 'blackwood', target: -25.5,
    brief: 'an Imperial river port pretending it is not in a swamp: cut stone, cranes, iron-rimmed wheels, and the forest waiting just past the wall.',
    key: ['wet', 'open', 'living'],
    l1: noise('brown', 130, 1.4, -8, 0.4, { target: 'gain', lfo_hz: 0.024, depth: 0.15 }, 'lowpass'),
    l1id: 's1_gideon_river_stone', l1text: 'a wide slow river against cut stone',
    l2: [['day', noise('pink', 560, 1.0, -14, 0.55, { target: 'gain', lfo_hz: 0.36, depth: 0.5 }), 'people', 'the port working, Imperial hours'],
         ['night', noise('pink', 2600, 1.5, -19, 0.7, { target: 'gain', lfo_hz: 1.4, depth: 0.5 }), 'insects', 'the insect wall comes over the wall at night; Gideon is in Blackwood whatever it says']],
    l3: [['crane_pawl', 'industry', gnoise('white', 1300, 5.5, 0.001, 0.3, -12, { n: 4, gap_s: 0.4, gap_jitter_s: 0.02 })],
         ['iron_wheel', 'people', gnoise('brown', 150, 1.5, 0.05, 1.2, -13, null, 'lowpass')]],
    l4: ['axe_beyond_wall', 'people', gnoise('brown', 420, 3.0, 0.002, 0.9, -14)] },
  { id: 'archon', region: 'crimson-coast', target: -25,
    brief: 'a dye-town: vats going over on their treadles, the smell of it in the sound somehow, and the surf underneath everything.',
    key: ['wet', 'open', 'living'],
    l1: noise('pink', 240, 1.8, -9, 0.5, { target: 'gain', lfo_hz: 0.061, depth: 0.5 }),
    l1id: 's1_archon_vat_town', l1text: 'vat-bubble and damped surf — the Crimson Coast with an industry on it',
    l2: [['day', noise('brown', 175, 2.8, -13, 0.2, { target: 'gain', lfo_hz: 0.21, depth: 0.6 }), 'industry', 'the treadles'],
         ['night', noise('pink', 640, 0.9, -19, 0.7, { target: 'gain', lfo_hz: 0.09, depth: 0.4 }), 'water', 'the vats stop and the surf is left']],
    l3: [['treadle', 'industry', gnoise('brown', 340, 3.4, 0.008, 0.32, -13, { n: 6, gap_s: 0.42, gap_jitter_s: 0.03 })],
         ['vat_slop', 'water', gnoise('pink', 700, 1.2, 0.01, 0.45, -15)]],
    l4: ['dye_worm', 'fauna', gosc(430, { partials_hz: [430, 645], glide_hz: [430, 620], env: { attack_s: 0.03, decay_s: 0.6 }, gain_db: -16 })] },
  { id: 'blackrose', region: 'blackwood', target: -26,
    brief: 'a legion fortress town: everything on a count, iron on stone, and a silence between the counts that no Argonian settlement has.',
    key: ['dry', 'open', 'living'],
    l1: noise('brown', 105, 2.0, -9, 0.3, { target: 'gain', lfo_hz: 0.017, depth: 0.1 }, 'lowpass'),
    l1id: 's1_blackrose_fort_ground', l1text: 'packed ground inside a curtain wall — a drier, deader floor than the forest outside it',
    l2: [['day', noise('pink', 900, 1.0, -16, 0.4, { target: 'gain', lfo_hz: 0.15, depth: 0.35 }), 'people', 'the yard, on a schedule'],
         ['night', noise('pink', 380, 0.8, -21, 0.5, { target: 'gain', lfo_hz: 0.04, depth: 0.3 }), 'wind', 'the night watch, and wind on the wall']],
    l3: [['drill_count', 'people', gosc(160, { waveform: 'sawtooth', partials_hz: [160, 240, 320], filter: { type: 'lowpass', hz: 750, q: 1.3 }, env: { attack_s: 0.02, decay_s: 0.35 }, gain_db: -14, repeats: { n: 4, gap_s: 0.62, gap_jitter_s: 0.01 } })],
         ['iron_on_stone', 'industry', gnoise('white', 1800, 6.0, 0.001, 0.22, -13)]],
    l4: ['legion_muster', 'people', gosc(131, { waveform: 'sawtooth', partials_hz: [131, 196, 262], filter: { type: 'lowpass', hz: 800, q: 1.1 }, env: { attack_s: 0.15, decay_s: 2.0 }, gain_db: -12 })] },
  { id: 'thorn', region: 'thornmarsh', target: -26.5,
    brief: 'a town inside the thicket: the same dead air the Thornmarsh has, with low voices in it and thorn moving against the walls.',
    key: ['dry', 'enclosed', 'living'],
    l1: noise('brown', 215, 3.9, -9, 0.07, { target: 'gain', lfo_hz: 0.021, depth: 0.11 }),
    l1id: 's1_thorn_dead_air_town', l1text: 'Thornmarsh dead air with a settlement breathing inside it',
    l2: [['day', noise('pink', 480, 1.2, -17, 0.3, { target: 'gain', lfo_hz: 0.26, depth: 0.5 }), 'people', 'low voices; nobody in Thorn raises their voice'],
         ['', noise('white', 2800, 3.2, -16, 0.45, { target: 'gain', lfo_hz: 2.2, depth: 0.55 }), 'flora', 'thorn against the walls, day and night']],
    l3: [['thorn_on_wall', 'flora', gnoise('white', 3000, 5.8, 0.001, 0.06, -12, { n: 6, gap_s: 0.08, gap_jitter_s: 0.04 })],
         ['low_voice', 'people', gosc(190, { waveform: 'sawtooth', partials_hz: [190, 285], filter: { type: 'lowpass', hz: 620, q: 1.4 }, env: { attack_s: 0.06, decay_s: 0.8 }, gain_db: -17 })]],
    l4: ['hackwing_over_thorn', 'fauna', gosc(980, { waveform: 'sawtooth', partials_hz: [980, 1470], glide_hz: [980, 700], filter: { type: 'lowpass', hz: 1100, q: 1.6 }, env: { attack_s: 0.02, decay_s: 0.35 }, gain_db: -15 })] },
  { id: 'tidewrack', region: 'marauders-coast', target: -26, no_settlement_file: true,
    brief: 'not a town: a wreck somebody moved into. Two rooms, a hull that is still working, and the coast getting in everywhere.',
    key: ['wet', 'open', 'living'],
    l1: drone([46, 69, 92], [-6, -15, -21], 12, -11, { type: 'lowpass', hz: 380, q: 1.2 }, { target: 'pitch', lfo_hz: 0.048, depth: 0.025 }),
    l1id: 's1_tidewrack_wreck', l1text: 'a hull that has stopped travelling and has not stopped moving',
    l2: [['', noise('pink', 1200, 0.8, -14, 0.8, { target: 'gain', lfo_hz: 0.12, depth: 0.55 }), 'water', 'surf through a hole in the side'],
         ['night', noise('brown', 190, 2.2, -20, 0.2, { target: 'gain', lfo_hz: 0.06, depth: 0.5 }), 'structure', 'the wreck settling with the tide out']],
    l3: [['plate_flex', 'structure', gnoise('brown', 380, 4.0, 0.02, 0.85, -12)],
         ['shingle', 'water', gnoise('white', 2100, 1.1, 0.005, 0.4, -15)]],
    l4: ['drowned_thing', 'fauna', gosc(64, { waveform: 'sawtooth', partials_hz: [64, 96, 128], glide_hz: [64, 51], filter: { type: 'lowpass', hz: 300, q: 2.0 }, env: { attack_s: 0.35, decay_s: 2.8 }, gain_db: -11 })] },
];

// ── expansion ──────────────────────────────────────────────────────────────────────────────────

const PROV = 'Authored by W1-22 round 2 from RI-AUD03 R4 ("Interiors get their own bed, not the exterior bed at −12 dB") and RI-WLD08 §6 ("≥13 (one per region) + ≥8 settlement beds + ≥4 interior beds"). Generated into the region beds\' own schema by tools/analysis/gen-interior-beds.mjs so that one loader, one driver, one census and one renderer serve all three bed families. There are no audio assets in this build; the synth spec IS the asset.';

function interiorBed(s) {
  const layers = {};
  const put = (k, v) => {
    if (v === null) { layers[k] = null; layers[`${k}_null_reason`] = s[`${k}_null_reason`]; return; }
    layers[k] = v;
  };
  put('L1', s.L1 === null ? null : { id: s.L1.id, text: s.L1.text, level_db: s.L1.level_db, voices: 1, classes: s.L1.classes, synth: s.L1.synth });
  put('L2', s.L2 === null ? null : { id: s.L2.id, text: s.L2.text, level_db: s.L2.level_db, voices: Math.min(2, s.L2.subs.length),
    sublayers: s.L2.subs.map((x) => ({ when: x.when, classes: x.classes, synth: x.synth })) });
  put('L3', s.L3 === null ? null : { id: s.L3.id, text: s.L3.text, interval_s: s.L3.interval_s, level_db: s.L3.level_db,
    events: s.L3.events.map((e) => ({ id: e.id, classes: [e.classes].flat(), weight: e.weight, pan: e.pan, ...(e.elevation ? { elevation: e.elevation } : {}), synth: e.synth })) });
  put('L4', s.L4 === null ? null : { id: s.L4.id, text: s.L4.text, interval_s: s.L4.interval_s, level_db: s.L4.level_db,
    events: s.L4.events.map((e) => ({ id: e.id, classes: [e.classes].flat(), weight: e.weight, pan: e.pan, synth: e.synth })) });
  return {
    schema: 'elder-souls/ambience-bed@1',
    family: 'interior',
    id: `interior-${s.id}`,
    interior_kinds: s.kinds,
    cells: s.cells || [],
    covers_interiors: s.covers,
    brief: s.brief,
    key: { wet_dry: s.key[0], open_enclosed: s.key[1], living_dead: s.key[2] },
    ...(s.lore_note ? { lore_note: s.lore_note, lore_carrier: true, derived_from: { region: s.key_seam[0] } } : {}),
    ...(s.ar2_note ? { ar2_note: s.ar2_note } : {}),
    bed_lufs_target: s.target,
    crossfade_s: 4,
    max_voices: 8,
    denies: s.denies,
    layers,
    emitters: [],
    provenance: PROV,
  };
}

function settlementBed(s) {
  const [l4id, l4cls, l4synth] = s.l4;
  return {
    schema: 'elder-souls/ambience-bed@1',
    family: 'settlement',
    id: `settlement-${s.id}`,
    settlement: s.id,
    region: s.region,
    cells: s.cells || [],
    ...(s.no_settlement_file ? { note_no_settlement_file: 'tidewrack owns two interiors (barge-hold, writ-house) and has no file in game/data/world/settlements/. The bed exists so the two cells behind those doors resolve to somewhere rather than to the region bed of open coast.' } : {}),
    brief: s.brief,
    key: { wet_dry: s.key[0], open_enclosed: s.key[1], living_dead: s.key[2] },
    bed_lufs_target: s.target,
    crossfade_s: 4,
    max_voices: 8,
    denies: [],
    layers: {
      L1: { id: s.l1id, text: s.l1text, level_db: 0, voices: 1, classes: ['settlement'], synth: s.l1 },
      L2: { id: `s2_${s.id}`, text: s.l2.map((x) => x[3]).join('; '), level_db: -5, voices: 2,
        sublayers: s.l2.map(([tod, synth, cls]) => ({ when: tod ? { tod } : {}, classes: [cls], synth })) },
      L3: { id: `s3_${s.id}`, text: s.l3.map((x) => x[0]).join(', '), interval_s: [9, 30], level_db: -4,
        events: s.l3.map(([id, cls, synth], i) => ({ id, classes: [cls], weight: i === 0 ? 3 : 2, pan: [-0.7, 0.7], synth })) },
      L4: { id: `s4_${s.id}`, text: l4id.replace(/_/g, ' '), interval_s: [60, 170], level_db: -4,
        events: [{ id: l4id, classes: [l4cls], weight: 1, pan: [-0.8, 0.8], synth: l4synth }] },
    },
    emitters: [],
    provenance: PROV,
  };
}

const files = [];
for (const s of INTERIORS) files.push([join(OUT_I, `${s.id}.json`), interiorBed(s)]);
for (const s of SETTLEMENTS) files.push([join(OUT_S, `${s.id}.json`), settlementBed(s)]);

// L1 uniqueness across ALL THREE families, checked here so a generator run cannot introduce the
// "one swamp loop" failure into the two families the region census does not cover.
const seen = new Map();
const regionDir = join(ROOT, 'game', 'data', 'audio', 'ambience');
for (const f of readdirSync(regionDir).filter((x) => x.endsWith('.json'))) {
  const d = JSON.parse(readFileSync(join(regionDir, f), 'utf8'));
  if (d.layers && d.layers.L1) seen.set(d.layers.L1.id, d.id);
}
let dupes = 0;
for (const [, bed] of files) {
  const l1 = bed.layers.L1 && bed.layers.L1.id;
  if (!l1) continue;
  if (seen.has(l1)) { console.error(`DUPLICATE L1 "${l1}": ${bed.id} and ${seen.get(l1)}`); dupes++; }
  seen.set(l1, bed.id);
}
if (dupes) process.exit(1);

if (CHECK) {
  let bad = 0;
  for (const [p, bed] of files) {
    const want = JSON.stringify(bed, null, 2) + '\n';
    if (!existsSync(p) || readFileSync(p, 'utf8') !== want) { console.error(`STALE: ${p}`); bad++; }
  }
  console.log(bad ? `gen-interior-beds --check: ${bad} file(s) differ from the spec.` : `gen-interior-beds --check: ${files.length} files match the spec.`);
  process.exit(bad ? 1 : 0);
}

mkdirSync(OUT_I, { recursive: true });
mkdirSync(OUT_S, { recursive: true });
for (const [p, bed] of files) writeFileSync(p, JSON.stringify(bed, null, 2) + '\n');
console.log(`gen-interior-beds: wrote ${INTERIORS.length} interior beds and ${SETTLEMENTS.length} settlement beds ` +
            `(${files.length} files, ${seen.size} unique L1s across all three bed families).`);
