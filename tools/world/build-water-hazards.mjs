#!/usr/bin/env node
/**
 * build-water-hazards.mjs — emit game/data/world/water.json and game/data/world/hazards.json.
 *
 * water.json is RI-WLD10 §11's schema `elder-souls/water@1` verbatim, with the thirteen regional
 * profiles taken from `game/data/world/regions.json` (which took them from RI-WLD10 §8) and the
 * SOLVED table offsets from `game/data/world/terrain.json`, so the census, the data file and the
 * built ground are three views of one thing.
 *
 * hazards.json is RI-WLD11 §5's `elder-souls/hazards@1`. Thirteen signature hazards, one per
 * region, plus six that appear in more than one — the second set is not decoration: M63's static
 * half fails any two regions that share an identical hazard SHAPE, and thirteen signatures over
 * six classes collide by the pigeonhole principle.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(join(HERE, '..', '..'));
const rd = (p) => JSON.parse(readFileSync(join(ROOT, p), 'utf8'));
const regionsDoc = rd('game/data/world/regions.json');
const terrain = rd('game/data/world/terrain.json');
const corpus = rd('corpus/50-world/regions.json');

const CORPUS_NAME = {};
for (const n of Object.keys(corpus.regions)) CORPUS_NAME[n.toLowerCase().replace(/[^a-z]/g, '')] = n;
const nameOf = (r) => CORPUS_NAME[r.name.toLowerCase().replace(/[^a-z]/g, '')] || r.name;
const solved = new Map(terrain.regions.map((r) => [r.id, r]));

// ---- water.json ------------------------------------------------------------------------------
const water = {
  schema: 'elder-souls/water@1',
  provenance: 'RI-WLD10 §11. Band table, locomotion multipliers, stamina, breath, substrate, '
            + 'detection, combat rules and tide are transcribed from the reference item; the per-region '
            + '`table_offset_m` and `channel_wet` are SOLVED by tools/world/build-terrain.mjs so that the '
            + 'built terrain reproduces the declared coverage index (RI-WLD10 M48).',
  reference_body_height_m: 1.80,
  bands: [
    { id: 'W0', name: 'DRY', min_m: 0.00, max_m: 0.00 },
    { id: 'W1', name: 'FILM', min_m: 0.01, max_m: 0.20 },
    { id: 'W2', name: 'SHIN', min_m: 0.21, max_m: 0.50 },
    { id: 'W3', name: 'WADE', min_m: 0.51, max_m: 0.95 },
    { id: 'W4', name: 'DEEP', min_m: 0.96, max_m: 1.40 },
    { id: 'W5', name: 'SWIM', min_m: 1.41, max_m: null },
  ],
  band_hysteresis_m: 0.03,
  locomotion: {
    W0: { walk: 1.00, jog: 1.00, sprint: 1.00, roll: 'full' },
    W1: { walk: 0.97, jog: 0.95, sprint: 0.92, roll: 'full' },
    W2: { walk: 0.85, jog: 0.78, sprint: 0.72, roll: 'full', roll_distance: 0.85 },
    W3: { walk: 0.65, jog: 0.55, sprint: 'denied', roll: 'wade_lunge' },
    W4: { walk: 0.43, jog: 0.43, sprint: 'denied', roll: 'wade_lunge' },
    W5: { swim_mps: 1.10, burst_mps: 1.70, attacks: 'denied', block: 'denied' },
  },
  wade_lunge: { startup_f: 6, iframes: 0, total_f: 22, distance_m: 1.30, stamina: 26 },
  stamina_drain_per_s: {
    W3: { moving: 2.0, still: 0.0 },
    W4: { moving: 5.0, still: 1.2 },
    W5: { moving: 4.0, still: 0.6, burst: 12.0 },
  },
  regen: { W4: 'delay_rearmed_while_moving', W5: 'suppressed' },
  equip_load: {
    LIGHT: { swim_stam: 0.80, swim_speed: 1.00 },
    MEDIUM: { swim_stam: 1.00, swim_speed: 1.00 },
    HEAVY: { swim_stam: 1.60, swim_speed: 0.80 },
    OVERLOADED: { can_swim: false, walks_bottom: true },
  },
  breath: {
    base_s: 40, per_endurance_over_10_s: 2.0, cap_s: 100,
    refill_rate_multiple: 3.0, drown_hp_pct_per_s: 2.0,
    amphibious_races: ['saxhleel', 'naga'],
  },
  substrate: {
    FIRM: { speed: 1.00 },
    SILT: { speed: 0.92, print_persist_s: 120 },
    SUCK: {
      speed: 0.70, mire_per_step: 1, mire_threshold: 6, mire_decay_frames: 45,
      mired: { escape_cost_stam: 25, escape_every_f: 30, escapes_needed: 3, break_recovery_f: 20 },
    },
  },
  detection: {
    W1_sprint_noise: 1.60, W1_walk_noise: 1.15,
    W3_still_visual: 0.55, submerged_visual: 0.15,
    wake_visible_m: 25, wake_persist_s: 6,
  },
  combat: {
    frame_invariance: true, arena_max_band: 'W2',
    loop_dungeons_with_W3_traversal_max: 2,
    loop_dungeons_with_W3_arena_max: 0,
    min_water_native_archetypes: 4,
  },
  tide: {
    cycle_real_min: 12, states: ['LOW', 'RISING', 'HIGH', 'FALLING'],
    mean_range_m: 1.20, spring_mult: 1.35, neap_mult: 0.65,
    inland_damping_m: 400,
    seas: { padomaic: { range_mult: 1.00, k: 0.35 }, topal: { range_mult: 0.55, k: 1.4 } },
  },
  regions: regionsDoc.regions.map((r) => {
    const s = solved.get(r.id);
    return {
      region: nameOf(r), region_id: r.id,
      wci: r.water.wci, class: r.water.class, deepest_band: r.water.deepest_band,
      tidal: r.water.tidal, sea: r.water.sea, k: r.water.k, substrates: r.water.substrates,
      table_offset_m: s.water_offset_m, channel_wet: s.channel_wet, dry: !!s.dry,
      wci_built: s.wci_built,
    };
  }),
};
writeFileSync(join(ROOT, 'game/data/world/water.json'), JSON.stringify(water, null, 2) + '\n');

// ---- hazards.json -----------------------------------------------------------------------------
const NM = (id) => nameOf(regionsDoc.regions.find((r) => r.id === id));
const tell = (channels, lead_s, range_m) => ({ channels, lead_s, range_m });
const H = [
  { id: 'press-gang-water', name: 'Press-gang water', class: 'STRANDING', sig: 'western-rootlands', regions: ['western-rootlands'],
    tell: tell(['visual', 'audio'], 9.0, 200), damage: { kind: 'none' },
    counters: ['knowledge:travel-by-day', 'route:root-arch-road', 'faction:wet-ledger-standing'] },
  { id: 'the-flats-flood', name: 'The flats flood', class: 'STRANDING', sig: 'marauders-coast', regions: ['marauders-coast'],
    tell: tell(['visual', 'audio'], 40.0, 300), damage: { kind: 'none' },
    counters: ['knowledge:read-the-tide-pole', 'route:bone-scaffold-high-road', 'item:punt'] },
  { id: 'spore-bloom', name: 'Spore bloom', class: 'VECTOR', sig: 'blackwood', regions: ['blackwood'],
    tell: tell(['visual', 'audio'], 2.4, 16), damage: { kind: 'none' }, affliction: 'droops',
    counters: ['route:walk-wide-of-the-shelves', 'item:torch', 'spell:resist-common-disease'] },
  { id: 'comb-collapse', name: 'Comb collapse', class: 'TRAP', sig: 'hive', regions: ['hive'],
    tell: tell(['visual', 'audio'], 2.2, 18), damage: { kind: 'pct_max_hp', value: 16 },
    counters: ['knowledge:read-the-comb-translucency', 'route:walk-the-ribs', 'skill:acrobatics'] },
  { id: 'cut-off-by-the-tide', name: 'Cut off by the tide', class: 'GATE', sig: 'eastern-rootlands', regions: ['eastern-rootlands'],
    tell: tell(['visual', 'audio'], 45.0, 250), damage: { kind: 'none' },
    counters: ['knowledge:tide-timing', 'route:barge-bg-lil-arc', 'race:amphibious'] },
  { id: 'pair-lightning', name: 'Pair-lightning', class: 'TRAP', sig: 'stone-forest', regions: ['stone-forest'],
    tell: tell(['visual', 'audio'], 2.2, 26), damage: { kind: 'pct_max_hp', value: 18 },
    counters: ['knowledge:break-the-line-between-them', 'route:never-stand-between-two', 'spell:resist-shock'] },
  { id: 'ridge-exposure', name: 'Ridge exposure', class: 'ATTRITION', sig: 'salt-hills', regions: ['salt-hills'],
    tell: tell(['visual'], 6.0, 40), damage: { kind: 'pct_max_hp_per_s', value: 0.8 },
    counters: ['route:watchtower-shelter', 'knowledge:move-by-day', 'item:warm-clothing'] },
  { id: 'the-thicket', name: 'The thicket', class: 'ATTRITION', sig: 'thornmarsh', regions: ['thornmarsh'],
    tell: tell(['visual'], 3.0, 20), damage: { kind: 'pct_max_hp_per_s', value: 0.6 },
    counters: ['knowledge:read-the-knife-marks', 'route:stay-on-the-cut-path', 'item:blade'] },
  { id: 'the-fall', name: 'The fall', class: 'TRAP', sig: 'valus-ridge', regions: ['valus-ridge'],
    tell: tell(['visual', 'audio'], 4.0, 400), damage: { kind: 'pct_max_hp', value: 18 },
    counters: ['route:the-inland-path', 'knowledge:lock-on-to-the-hackwing', 'spell:slowfall'] },
  { id: 'kiln-ground', name: 'Kiln ground', class: 'ATTRITION', sig: 'clay-moor', regions: ['clay-moor'],
    tell: tell(['visual'], 3.5, 45), damage: { kind: 'pct_max_hp_per_s', value: 1.0 },
    counters: ['knowledge:read-the-hot-clay', 'route:the-fired-cold-routes', 'item:footwear'] },
  { id: 'dye-fume', name: 'Dye-fume', class: 'VECTOR', sig: 'crimson-coast', regions: ['crimson-coast'],
    tell: tell(['visual', 'audio'], 5.0, 60), damage: { kind: 'none' }, affliction: 'vat-lung',
    counters: ['route:upwind-approach', 'knowledge:time-the-sea-squall', 'item:mask'] },
  { id: 'salt-storm', name: 'Salt-storm', class: 'ATTRITION', sig: 'stone-wastes', regions: ['stone-wastes'],
    tell: tell(['visual', 'audio'], 40.0, 300), damage: { kind: 'pct_max_hp_per_s', value: 1.2 },
    counters: ['route:crater-shelter', 'knowledge:storm-cadence', 'item:cloak'] },
  { id: 'voriplasm', name: 'Voriplasm', class: 'KILL', sig: 'deep-marshes', regions: ['deep-marshes'],
    tell: tell(['visual', 'audio'], 6.0, 30), damage: { kind: 'fatal' },
    counters: ['route:high-ground', 'knowledge:corpse-reading', 'item:fire', 'spell:levitate'] },

  // Non-signature hazards. Each is confined to <= 3 regions (H5) and exists so that no two
  // regions present the same hazard SHAPE — the hazard-space form of "one swamp, thirteen fogs".
  { id: 'high-tide-gate', name: 'The causeway at high water', class: 'GATE', regions: ['marauders-coast', 'crimson-coast'],
    tell: tell(['visual'], 45.0, 200), damage: { kind: 'none' },
    counters: ['knowledge:tide-timing', 'route:the-long-way-round'] },
  { id: 'strangler-snare', name: 'Strangler snare', class: 'TRAP', regions: ['blackwood', 'deep-marshes'],
    tell: tell(['visual'], 2.0, 15), damage: { kind: 'pct_max_hp', value: 9 },
    counters: ['knowledge:read-the-vine-tension', 'item:blade'] },
  { id: 'rockfall', name: 'Rockfall', class: 'TRAP', regions: ['valus-ridge', 'salt-hills'],
    tell: tell(['audio', 'visual'], 2.6, 55), damage: { kind: 'pct_max_hp', value: 14 },
    counters: ['knowledge:read-the-scree-line', 'route:the-lower-traverse'] },
  { id: 'thirst', name: 'Thirst', class: 'ATTRITION', regions: ['clay-moor'],
    tell: tell(['visual', 'audio'], 60.0, 999), damage: { kind: 'pct_max_hp_per_s', value: 0.35 },
    counters: ['item:carried-water', 'knowledge:the-naga-wells'] },
  { id: 'ash-lung', name: 'Ash-lung', class: 'VECTOR', regions: ['thornmarsh'],
    tell: tell(['visual'], 4.0, 30), damage: { kind: 'none' }, affliction: 'ash-lung',
    counters: ['route:the-cut-paths-are-swept', 'item:mask'] },
  { id: 'hist-sap-fume', name: 'Hist-sap fume', class: 'VECTOR', regions: ['stone-forest'],
    tell: tell(['visual', 'audio'], 3.0, 25), damage: { kind: 'none' }, affliction: 'sap-dream',
    counters: ['knowledge:the-tenders-warn-you', 'route:upwind-of-the-bole'] },
];
const hazards = {
  schema: 'elder-souls/hazards@1',
  provenance: 'RI-WLD11 §2 and §5. The thirteen signature hazards are the reference item verbatim; '
            + 'the six shared ones are W1-01, and are what make each region\'s hazard shape unique '
            + '(RI-WLD11 M63 static half).',
  hazards: H.map((h) => ({
    id: h.id, name: h.name, class: h.class,
    regions: h.regions.map(NM),
    ...(h.sig ? { signature_of: NM(h.sig) } : {}),
    tell: h.tell,
    damage: h.damage,
    ...(h.affliction ? { affliction: h.affliction } : {}),
    counters: h.counters,
    applies_to_npcs: true,
    scales_with_level: false,
  })),
};
writeFileSync(join(ROOT, 'game/data/world/hazards.json'), JSON.stringify(hazards, null, 2) + '\n');
process.stdout.write(`water.json (${water.regions.length} regions) and hazards.json (${hazards.hazards.length} hazards) written\n`);
