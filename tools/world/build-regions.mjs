#!/usr/bin/env node
/**
 * build-regions.mjs — compose game/data/world/regions.json.
 *
 * Merges three sources so no number is retyped:
 *   corpus/50-world/regions.json     names, AABBs, areas, tiers, palettes, prose (S24 binding)
 *   corpus/50-world/world-scale.json region centroids in world metres (RI-WLD01 binding)
 *   this file                        the MEASURABLE axes RI-WLD04 M18 scores, the terrain
 *                                    parameters RI-WLD07 §4 is measured against, and the
 *                                    per-region water profile RI-WLD10 §8 censuses.
 *
 * RI-WLD04's differentiation contract is the reason the axis fields are sets of ids rather than
 * prose: "for any two regions at least 6 of these 9 axes must differ measurably" cannot be
 * computed from a sentence. tools/world/region-axes.mjs computes all 78 pairs from this file.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(join(HERE, '..', '..'));
const corpusRegions = JSON.parse(readFileSync(join(ROOT, 'corpus/50-world/regions.json'), 'utf8'));
const scale = JSON.parse(readFileSync(join(ROOT, 'corpus/50-world/world-scale.json'), 'utf8'));

/**
 * Per-region authored data.
 *
 * `terrain` is the landform, and it is the axis the corpus warns hardest about: S24's failure
 * mode is thirteen tints of one swamp, so five of these regions are not wet and three are not
 * flat. `base_m`/`amp_m` are the large-scale form (wavelength ~760 m); `relief_m` with
 * `ridge`/`terrace` weights is the local form (wavelength ~40 m and ~13 m) and is what the
 * slope histogram in M18 axis 2 actually reads.
 *
 * `water.wci` is RI-WLD10 §8 verbatim. The terrain builder SOLVES each region's water-table
 * offset so the built world reproduces it (M48: declared vs observed within 0.04), which is why
 * the offset is not authored here.
 */
const R = {
  'salt-hills': {
    terrain: { base_m: 132, amp_m: 168, wavelength_m: 1240, relief_m: 4.2, ridge: 0.34, terrace: 0.02, style: 'upland' },
    ground: { id: 'gnd_hill_turf', albedo: '#7D8B5C', roughness: 0.93, name: 'thin hill turf over limestone' },
    fog: { colour: '#B9C6CE', extinction_per_m: 0.0021, height_falloff_m: 340 },
    sky: { zenith: '#3E6F9E', horizon: '#C6D2DA' },
    flora: ['hill_grass', 'salt_cedar', 'gorse', 'ridge_thistle'],
    fauna: ['guar_herd', 'hill_wamasu', 'dres_slaver', 'crag_hackwing'],
    architecture: ['imperial_milestone', 'legion_watchtower', 'legion_fort', 'cut_stone_wall'],
    audio: ['amb_wind_open_dry', 'sfx_legion_horn_hour', 'sfx_guar_bells'],
    weather: ['clear', 'cold_rain', 'overcast'],
    hazard: { id: 'ridge-exposure', class: 'ATTRITION' },
    only_here: { id: 'imperial_milestone', instances: 22 },
    flora_density: 0.30, canopy: 0.0, sightline_m: 900,
  },
  thornmarsh: {
    terrain: { base_m: 10, amp_m: 11, wavelength_m: 700, relief_m: 2.8, ridge: 0.10, terrace: 0.0, style: 'thicket' },
    ground: { id: 'gnd_ash_over_peat', albedo: '#A98C72', roughness: 0.97, name: 'ash-dusted peat, pale as a cold hearth' },
    fog: { colour: '#BFA286', extinction_per_m: 0.0075, height_falloff_m: 110 },
    sky: { zenith: '#5E5248', horizon: '#B49A82' },
    flora: ['needle_thorn', 'ash_bracken', 'thorn_creeper'],
    fauna: ['thorn_hackwing', 'feral_guar', 'thorn_spider'],
    architecture: ['thorn_thatch_hall', 'cut_path_marker', 'rotted_greathall'],
    audio: ['amb_thorn_clatter', 'amb_no_birdsong', 'sfx_ash_fall'],
    weather: ['ashfall', 'overcast', 'cold_rain'],
    hazard: { id: 'the-thicket', class: 'ATTRITION' },
    only_here: { id: 'knife_mark_stem', instances: 60 },
    flora_density: 2.60, canopy: 0.55, sightline_m: 30,
  },
  'valus-ridge': {
    terrain: { base_m: 268, amp_m: 286, wavelength_m: 1560, relief_m: 8.0, ridge: 0.86, terrace: 0.03, style: 'mountain' },
    ground: { id: 'gnd_cliff_limestone', albedo: '#C6BCA2', roughness: 0.78, name: 'wind-holed limestone and scree' },
    fog: { colour: '#8FA6B4', extinction_per_m: 0.0033, height_falloff_m: 260 },
    sky: { zenith: '#2F5A8C', horizon: '#A8BDC8' },
    flora: ['thorn_pine', 'moss_curtain', 'cliff_lichen'],
    fauna: ['hackwing_eyrie', 'mountain_wamasu', 'chitin_hound_mountain'],
    architecture: ['ayleid_watchtower', 'imperial_cairn', 'rock_flute_spire'],
    audio: ['amb_rock_flute_chord', 'sfx_rockfall', 'sfx_hackwing_scream'],
    weather: ['cold_rain', 'clear', 'storm'],
    hazard: { id: 'the-fall', class: 'TRAP' },
    only_here: { id: 'rock_flute_spire', instances: 14 },
    flora_density: 0.45, canopy: 0.10, sightline_m: 2200,
  },
  'stone-forest': {
    terrain: { base_m: 31, amp_m: 26, wavelength_m: 940, relief_m: 4.2, ridge: 0.14, terrace: 0.36, style: 'plateau' },
    ground: { id: 'gnd_petrified_flag', albedo: '#7C8794', roughness: 0.60, name: 'petrified root-flags' },
    fog: { colour: '#9FA9A2', extinction_per_m: 0.0026, height_falloff_m: 200 },
    sky: { zenith: '#37699C', horizon: '#C3C7BA' },
    flora: ['petrified_bole', 'living_hist_bole', 'stone_bark_sapling', 'rockpool_weed'],
    fauna: ['wamasu_herd', 'stone_beetle', 'hist_tender'],
    architecture: ['xanmeer_ziggurat', 'hist_grown_hall', 'root_stair'],
    audio: ['amb_stone_tick', 'amb_hist_choral_hum', 'sfx_dry_thunder'],
    weather: ['clear', 'dry_thunder', 'overcast'],
    hazard: { id: 'pair-lightning', class: 'TRAP' },
    only_here: { id: 'petrified_bole', instances: 400 },
    flora_density: 1.10, canopy: 0.35, sightline_m: 260,
  },
  'clay-moor': {
    terrain: { base_m: 31, amp_m: 15, wavelength_m: 700, relief_m: 2.4, ridge: 0.0, terrace: 0.48, style: 'fired-flat' },
    ground: { id: 'gnd_fired_clay', albedo: '#9C5B3C', roughness: 0.52, name: 'fired red clay pan' },
    fog: { colour: '#C9A46A', extinction_per_m: 0.0018, height_falloff_m: 150 },
    sky: { zenith: '#4C74A0', horizon: '#DCC49A' },
    flora: ['clay_scrub', 'kiln_thistle'],
    fauna: ['naga_patrol', 'clay_crawler', 'kiln_drake'],
    architecture: ['naga_kiln_dome', 'lit_kiln_flue', 'naga_sentry_post'],
    audio: ['amb_kiln_roar', 'sfx_naga_speech', 'amb_wind_open_dry'],
    weather: ['dust_devil', 'clear', 'heat_shimmer'],
    hazard: { id: 'kiln-ground', class: 'ATTRITION' },
    only_here: { id: 'naga_kiln_dome', instances: 26 },
    flora_density: 0.18, canopy: 0.0, sightline_m: 1100,
  },
  'crimson-coast': {
    terrain: { base_m: 10, amp_m: 16, wavelength_m: 560, relief_m: 3.6, ridge: 0.48, terrace: 0.08, style: 'littoral-rock' },
    ground: { id: 'gnd_tide_lichen', albedo: '#8E2B33', roughness: 0.40, name: 'living crimson tide-lichen on black rock' },
    fog: { colour: '#6C7A80', extinction_per_m: 0.0048, height_falloff_m: 120 },
    sky: { zenith: '#2A4A6E', horizon: '#8E7A74' },
    flora: ['tide_lichen', 'dye_kelp'],
    fauna: ['dye_worm', 'red_cormorant', 'lichen_blind_beggar'],
    architecture: ['archon_clay_dome', 'open_dye_vat', 'lichen_stair'],
    audio: ['amb_lichen_scream', 'amb_padomaic_surf', 'sfx_vat_bubble'],
    weather: ['sea_squall', 'overcast', 'clear'],
    hazard: { id: 'dye-fume', class: 'VECTOR' },
    only_here: { id: 'open_dye_vat', instances: 18 },
    flora_density: 0.55, canopy: 0.0, sightline_m: 700,
  },
  blackwood: {
    terrain: { base_m: 1.5, amp_m: 3.6, wavelength_m: 700, relief_m: 2.7, ridge: 0.0, terrace: 0.0, style: 'flooded-forest' },
    ground: { id: 'gnd_leaf_mulch', albedo: '#14231A', roughness: 0.96, name: 'black leaf mulch over standing root-water' },
    fog: { colour: '#1B3A3E', extinction_per_m: 0.0180, height_falloff_m: 55 },
    sky: { zenith: '#182A26', horizon: '#2E4A46' },
    flora: ['buttress_hardwood', 'strangler_vine', 'fungus_shelf', 'green_dark_fern'],
    fauna: ['chitin_hound', 'tusk_lurker', 'blackwood_bandit'],
    architecture: ['ayleid_drowned_stone', 'imperial_logging_camp', 'welkynd_pillar'],
    audio: ['amb_insect_wall', 'amb_canopy_drip', 'sfx_distant_axe'],
    weather: ['heavy_rain', 'overcast', 'dawn_mist'],
    hazard: { id: 'spore-bloom', class: 'VECTOR' },
    only_here: { id: 'welkynd_pillar', instances: 34 },
    flora_density: 3.40, canopy: 0.92, sightline_m: 18,
  },
  hive: {
    terrain: { base_m: 21, amp_m: 17, wavelength_m: 420, relief_m: 5.4, ridge: 0.08, terrace: 0.66, style: 'comb' },
    ground: { id: 'gnd_wax_comb', albedo: '#D6C77A', roughness: 0.30, name: 'load-bearing wax comb' },
    fog: { colour: '#E6E2D0', extinction_per_m: 0.0064, height_falloff_m: 45 },
    sky: { zenith: '#7A7048', horizon: '#E6E2D0' },
    flora: [],
    fauna: ['hive_drone', 'hive_queen', 'comb_mite'],
    architecture: ['waxen_tower', 'comb_cliff', 'sphincter_door'],
    audio: ['amb_hive_chord'],
    weather: ['still'],
    hazard: { id: 'comb-collapse', class: 'TRAP' },
    only_here: { id: 'comb_cliff', instances: 30 },
    flora_density: 0.0, canopy: 0.0, sightline_m: 55,
  },
  'deep-marshes': {
    terrain: { base_m: 0.9, amp_m: 2.2, wavelength_m: 620, relief_m: 1.9, ridge: 0.0, terrace: 0.0, style: 'drowned' },
    ground: { id: 'gnd_black_silt', albedo: '#121424', roughness: 0.99, name: 'violet-black silt and voriplasm margin' },
    fog: { colour: '#3E4A6B', extinction_per_m: 0.0260, height_falloff_m: 26 },
    sky: { zenith: '#232A40', horizon: '#3E4A63' },
    flora: ['corpse_lily', 'drowned_tree', 'black_reed'],
    fauna: ['voriplasm', 'naga_raider', 'the_unnamed'],
    architecture: ['drowned_xanmeer_tooth'],
    audio: ['amb_intestinal_gurgle', 'amb_breathing_not_yours', 'amb_no_birds'],
    weather: ['fever_fog', 'heavy_rain', 'still'],
    hazard: { id: 'voriplasm', class: 'KILL' },
    only_here: { id: 'voriplasm', instances: 40 },
    flora_density: 1.60, canopy: 0.30, sightline_m: 22,
  },
  'marauders-coast': {
    terrain: { base_m: 0.55, amp_m: 2.1, wavelength_m: 500, relief_m: 3.4, ridge: 0.52, terrace: 0.30, style: 'tidal-flat' },
    ground: { id: 'gnd_barnacle_flat', albedo: '#8E8A7E', roughness: 0.88, name: 'barnacle shelf over sucking mudflat' },
    fog: { colour: '#9AA6AC', extinction_per_m: 0.0125, height_falloff_m: 55 },
    sky: { zenith: '#4E7391', horizon: '#B7BFC0' },
    flora: ['mangrove', 'salt_grass', 'barnacle_shelf'],
    fauna: ['mire_crab_cart', 'gull', 'drowned_thing'],
    architecture: ['bone_scaffold_tower', 'beached_hull_house', 'tide_pole'],
    audio: ['amb_topal_surf', 'sfx_bell_buoy_600m', 'sfx_rope_creak'],
    weather: ['sea_fog', 'overcast', 'clear'],
    hazard: { id: 'the-flats-flood', class: 'STRANDING' },
    only_here: { id: 'beached_hull_house', instances: 12 },
    flora_density: 0.85, canopy: 0.08, sightline_m: 420,
  },
  'western-rootlands': {
    terrain: { base_m: 2.0, amp_m: 2.8, wavelength_m: 560, relief_m: 1.15, ridge: 0.0, terrace: 0.30, style: 'paddy' },
    ground: { id: 'gnd_paddy_bund', albedo: '#6E8A4E', roughness: 0.90, name: 'paddy bund and root-wood road' },
    fog: { colour: '#A8B7A6', extinction_per_m: 0.0058, height_falloff_m: 70 },
    sky: { zenith: '#3E77A8', horizon: '#C4CFB8' },
    flora: ['paddy_fern', 'reed', 'root_arch', 'egg_lily'],
    fauna: ['mudcrab', 'egg_tender_herd', 'hackwing'],
    architecture: ['root_arch_village', 'nest_mound', 'stilt_slum', 'blackrose_wall'],
    audio: ['amb_frog_chorus', 'amb_reed_rustle', 'sfx_hide_drum_90s'],
    weather: ['warm_rain', 'dawn_mist', 'clear'],
    hazard: { id: 'press-gang-water', class: 'STRANDING' },
    only_here: { id: 'root_arch', instances: 120 },
    flora_density: 2.10, canopy: 0.40, sightline_m: 120,
  },
  'eastern-rootlands': {
    terrain: { base_m: 1.3, amp_m: 2.6, wavelength_m: 540, relief_m: 1.05, ridge: 0.0, terrace: 0.0, style: 'delta' },
    ground: { id: 'gnd_tannin_channel', albedo: '#4F7A5E', roughness: 0.86, name: 'floating meadow over tannin-black channel' },
    fog: { colour: '#B7C4C0', extinction_per_m: 0.0075, height_falloff_m: 50 },
    sky: { zenith: '#356E93', horizon: '#BFC9C2' },
    flora: ['floating_meadow', 'air_plant', 'channel_sedge'],
    fauna: ['swamp_jelly', 'wamasu', 'tide_fisher'],
    architecture: ['stilt_row_platform', 'tide_hydraulic', 'tideway_marker'],
    audio: ['amb_water_slap_stilts', 'amb_jelly_hum', 'sfx_oars'],
    weather: ['warm_rain', 'sea_fog', 'clear'],
    hazard: { id: 'cut-off-by-the-tide', class: 'GATE' },
    only_here: { id: 'swamp_jelly_canopy', instances: 48 },
    flora_density: 1.70, canopy: 0.22, sightline_m: 300,
  },
  'stone-wastes': {
    terrain: { base_m: 9, amp_m: 10, wavelength_m: 600, relief_m: 2.1, ridge: 0.06, terrace: 0.52, style: 'crater-salt' },
    ground: { id: 'gnd_salt_crust', albedo: '#DCD2B8', roughness: 0.66, name: 'glassed salt crust' },
    fog: { colour: '#EDEDE6', extinction_per_m: 0.0038, height_falloff_m: 190 },
    sky: { zenith: '#5C86AE', horizon: '#EDEDE6' },
    flora: ['glass_thorn', 'salt_crust_bloom'],
    fauna: ['salt_worm', 'bone_picker', 'dying_hist'],
    architecture: ['whale_bone_frame', 'salt_block_wall', 'crater_rim'],
    audio: ['amb_near_silence_tick', 'sfx_salt_storm_roar'],
    weather: ['salt_storm', 'clear', 'overcast'],
    hazard: { id: 'salt-storm', class: 'ATTRITION' },
    only_here: { id: 'glassed_crater', instances: 16 },
    flora_density: 0.12, canopy: 0.0, sightline_m: 1400,
  },
};
R['clay-moor'].fog.colour = '#C9A87C';


/**
 * What the region is made of, as geometry the renderer instances. This is RI-WLD04's "palette
 * without material" warning answered in data: the ground albedo, the silhouette of the dominant
 * plant, its height and its density are per-region and separately measurable, so two regions
 * cannot be distinguished only by a fog colour.
 *   canopy  the dominant tall silhouette: cone | sphere | spire | dome | column | arch | none
 *   under   the ground layer: blade | frond | shelf | crust | comb | none
 */
const PROPS = {
  'salt-hills':        { canopy: { shape: 'cone',   h: 5.5,  r: 1.5, colour: '#4E5C33', trunk: '#54503E', per100m2: 0.06 },
                         under: { shape: 'blade',  h: 0.6,  colour: '#8B9660', per100m2: 3.4 },
                         rock:  { colour: '#9A968C', per100m2: 0.30, scale: 1.6 } },
  thornmarsh:          { canopy: { shape: 'cone',   h: 4.2,  r: 0.8, colour: '#2A211C', trunk: '#3A3028', per100m2: 5.40 },
                         under: { shape: 'blade',  h: 0.9,  colour: '#6E6A52', per100m2: 1.4 },
                         rock:  { colour: '#C3BBA8', per100m2: 0.26, scale: 1.0 } },
  'valus-ridge':       { canopy: { shape: 'spire',  h: 9.0,  r: 1.3, colour: '#4E6B3C', trunk: '#6E6A5A', per100m2: 0.62 },
                         under: { shape: 'frond',  h: 0.5,  colour: '#7C8A6A', per100m2: 1.2 },
                         rock:  { colour: '#B9B2A0', per100m2: 1.40, scale: 3.4 } },
  'stone-forest':      { canopy: { shape: 'column', h: 12.0, r: 1.7, colour: '#7C8794', trunk: '#78828E', per100m2: 0.55 },
                         under: { shape: 'shelf',  h: 0.5,  colour: '#3D5A3A', per100m2: 1.1 },
                         rock:  { colour: '#8E96A0', per100m2: 0.55, scale: 2.0 } },
  'clay-moor':         { canopy: { shape: 'dome',   h: 4.0,  r: 3.2, colour: '#9C5B3C', trunk: '#7C4630', per100m2: 0.05 },
                         under: { shape: 'blade',  h: 0.4,  colour: '#C39A5C', per100m2: 0.7 },
                         rock:  { colour: '#C8BFA8', per100m2: 0.22, scale: 1.2 } },
  'crimson-coast':     { canopy: { shape: 'none',   h: 0,    r: 0,   colour: '#8E2B33', trunk: '#232021', per100m2: 0 },
                         under: { shape: 'crust',  h: 0.25, colour: '#8E2B33', per100m2: 5.5 },
                         rock:  { colour: '#232021', per100m2: 1.10, scale: 2.4 } },
  // Blackwood and Thornmarsh were confused four times on the objective analogue of M17 (verdict
  // W1-01 §4c) — one pair, twice as close as the next. They are separated here on the four things
  // the brief names, not on fog: LANDFORM (root-buttress relief vs ash hummock, in `terrain`),
  // GROUND MATERIAL (near-black wet mulch vs pale ash), FLORA SILHOUETTE (a 19 m closed sphere
  // canopy on pale buttress trunks vs a 4 m thorn spike thicket at twice the density) and WATER
  // REGIME (a flooded forest at wci 0.41 vs a seasonal marsh at 0.09).
  blackwood:           { canopy: { shape: 'sphere', h: 19.0, r: 6.4, colour: '#16301F', trunk: '#7A6244', per100m2: 2.60 },
                         under: { shape: 'frond',  h: 2.2,  colour: '#2F5A2A', per100m2: 7.0 },
                         rock:  { colour: '#63C8E8', per100m2: 0.34, scale: 1.7 } },
  hive:                { canopy: { shape: 'dome',   h: 7.0,  r: 3.6, colour: '#D6C77A', trunk: '#9A6B2F', per100m2: 0.55 },
                         under: { shape: 'comb',   h: 0.3,  colour: '#E6E2D0', per100m2: 2.4 },
                         rock:  { colour: '#9A6B2F', per100m2: 0.14, scale: 1.1 } },
  'deep-marshes':      { canopy: { shape: 'spire',  h: 13.0, r: 0.5, colour: '#0C0E16', trunk: '#0C0E16', per100m2: 0.42 },
                         under: { shape: 'blade',  h: 2.8,  colour: '#243F4A', per100m2: 6.2 },
                         rock:  { colour: '#5A4670', per100m2: 0.12, scale: 1.5 } },
  'marauders-coast':   { canopy: { shape: 'arch',   h: 3.4,  r: 2.2, colour: '#2C3A2E', trunk: '#5E4A3A', per100m2: 1.30 },
                         under: { shape: 'blade',  h: 0.7,  colour: '#8E8A7E', per100m2: 2.0 },
                         rock:  { colour: '#5E7C88', per100m2: 0.45, scale: 1.3 } },
  'western-rootlands': { canopy: { shape: 'arch',   h: 8.0,  r: 4.5, colour: '#6B5638', trunk: '#6B5638', per100m2: 0.42 },
                         under: { shape: 'blade',  h: 1.1,  colour: '#6E8A4E', per100m2: 4.6 },
                         rock:  { colour: '#A8B7A6', per100m2: 0.05, scale: 0.8 } },
  'eastern-rootlands': { canopy: { shape: 'sphere', h: 5.0,  r: 2.6, colour: '#4F7A5E', trunk: '#2A211A', per100m2: 0.36 },
                         under: { shape: 'frond',  h: 0.8,  colour: '#5E8A6E', per100m2: 3.6 },
                         rock:  { colour: '#B7C4C0', per100m2: 0.05, scale: 0.8 } },
  'stone-wastes':      { canopy: { shape: 'spire',  h: 2.6,  r: 0.5, colour: '#8C5A3A', trunk: '#8C5A3A', per100m2: 0.03 },
                         under: { shape: 'crust',  h: 0.2,  colour: '#EDEDE6', per100m2: 1.0 },
                         rock:  { colour: '#DCD2B8', per100m2: 0.90, scale: 2.2 } },
};

/**
 * GROUND MICRO-RELIEF — the shape of the ordinary ground, per region.
 *
 * Verdict W1-01 round 2 stripped colour and exposure out of the region frames and separability
 * fell 74.4% -> 30.8%: "two-thirds of our regional distinctness is tint". Round 3 placed the
 * thirteen ONLY-HERE landmarks and the colour-stripped number did not move, because 840 instances
 * over 14.31 km2 is 59 per km2 and a random frame does not contain one. What every frame IS made
 * of is the ordinary ground — and until this table existed, the ordinary ground of all thirteen
 * regions was one function with three scalars.
 *
 * `amp_m` is a STANDARD DEVIATION in metres; `weights` is a convex mixture over
 * `game/src/world/microrelief.js MICRO_KINDS`. Both are read by `MicroField`, which is evaluated
 * inside `field.heightAt()` — the one surface collision, the terrain mesh, the slope histogram,
 * the water census and every audit share. Changing a number here changes the ground you stand on.
 *
 * Each mixture is the region's own prose, as landform:
 *   blackwood          buttressed hardwood over standing root-water  -> root mats above wet hollows
 *   clay-moor          fired red clay pan                            -> desiccation polygons, nothing else
 *   crimson-coast      tide-lichen on black rock                     -> wave-cut benches and broken rock
 *   deep-marshes       violet-black silt, the ground is an animal     -> tussocks over drowned hollows
 *   eastern-rootlands  floating meadow over tannin-black channel      -> braided drainage, tidal runnels
 *   hive               load-bearing wax comb                          -> comb TREADS: stepped, and cell-jointed
 *   marauders-coast    barnacle shelf over sucking mudflat            -> a runnel field the tide combs
 *   salt-hills         thin hill turf over limestone                  -> sheep-track terracettes, loose stone
 *   stone-forest       petrified root-flags                           -> jointed pavement that has shattered
 *   stone-wastes       glassed salt crust                             -> wind drift over polygonal crust
 *   thornmarsh         ash-dusted peat                                -> peat hummocks braided with thorn root
 *   valus-ridge        wind-holed limestone and scree                 -> talus, benched by the bedding
 *   western-rootlands  paddy bund and root-wood road                  -> the one rectilinear landform here
 */
const MICRO = {
  blackwood:           { amp_m: 0.50, weights: { rootmat: 0.60, hummock: 0.40 } },
  'clay-moor':         { amp_m: 0.48, weights: { crack: 1.00 } },
  'crimson-coast':     { amp_m: 0.45, weights: { terracette: 0.50, rubble: 0.50 } },
  'deep-marshes':      { amp_m: 0.56, weights: { hummock: 0.75, rill: 0.25 } },
  'eastern-rootlands': { amp_m: 0.50, weights: { rill: 0.60, ripple: 0.40 } },
  hive:                { amp_m: 0.62, weights: { terracette: 0.70, crack: 0.30 } },
  'marauders-coast':   { amp_m: 0.44, weights: { ripple: 0.70, rill: 0.30 } },
  'salt-hills':        { amp_m: 0.55, weights: { terracette: 0.75, rubble: 0.25 } },
  'stone-forest':      { amp_m: 0.44, weights: { crack: 0.55, rubble: 0.45 } },
  'stone-wastes':      { amp_m: 0.52, weights: { dune: 0.55, crack: 0.45 } },
  thornmarsh:          { amp_m: 0.52, weights: { hummock: 0.50, rootmat: 0.50 } },
  'valus-ridge':       { amp_m: 0.55, weights: { rubble: 0.70, terracette: 0.30 } },
  'western-rootlands': { amp_m: 0.58, weights: { bund: 0.80, ripple: 0.20 } },
};

/**
 * PROP ARRANGEMENT, GROUND COVER AND VERTICAL STRUCTURE.
 *
 * The second half of the same finding. Thirteen regions shared one jittered lattice: the same
 * point set, the same spacing statistics, the same relationship to the ground, differing only in
 * which of seven canopy shapes and five under shapes was instanced at it. Spacing statistics
 * carry more identity than model count — a mangrove fringe in tide-parallel lines, a gorse clump
 * with open turf between, and a glass thorn standing alone in a salt pan are three landscapes
 * built out of one cone.
 *
 * `arrangement.mode` is read by `province._scatter` and is a DENSITY FIELD, not a decoration:
 *   scatter      the old behaviour, kept for the two regions whose plants really are uniform
 *   clumped      thickets/copses with open ground between, at `gap_m`
 *   rows         lineated on a bearing at `spacing_m` — a coast combed by the tide, a dyked field
 *   drainage     gathered into the low ground and the gully lines
 *   high-ground  only on ground the micro-relief has raised out of the water
 *   isolated     one plant per cell of a coarse lattice: even, wide, and nothing between
 *   fringe       banked against the waterline
 *   maze         dense everywhere except along sinuous cut corridors
 *
 * `cover` is the ordinary underfoot material — the thing most of every frame is actually made of,
 * and the layer that was missing entirely. `per100m2` is INSTANCES per 100 m2 and `patch_m` is the
 * scale at which it drifts into patches, so scree at 30/100 m2 in 4 m patches and a salt crust at
 * 6/100 m2 in 20 m patches are different ground even before the shape is chosen. It is built on
 * its own fine lattice inside a 70 m disc around the camera rather than on the 6.5 m prop lattice,
 * because ground cover at 300 m is invisible and ground cover at 3 m is most of the frame.
 *
 * `canopy.h_var` / `canopy.lean_deg` / `canopy.emergent` are the vertical structure axis: whether
 * a region's skyline is a flat ceiling, a ragged one, or a few giants over a low roof.
 */
const ARRANGE = {
  blackwood:           { mode: 'high-ground', strength: 0.85, gap_m: 46 },
  'clay-moor':         { mode: 'isolated',    strength: 1.00, gap_m: 45 },
  'crimson-coast':     { mode: 'fringe',      strength: 0.55, gap_m: 34 },
  'deep-marshes':      { mode: 'high-ground', strength: 0.95, gap_m: 26 },
  'eastern-rootlands': { mode: 'drainage',    strength: 0.85, gap_m: 40 },
  hive:                { mode: 'clumped',     strength: 0.90, gap_m: 54 },
  'marauders-coast':   { mode: 'rows',        strength: 0.85, spacing_m: 38, bearing_deg: 24 },
  'salt-hills':        { mode: 'clumped',     strength: 0.75, gap_m: 78 },
  'stone-forest':      { mode: 'scatter',     strength: 0.00 },
  'stone-wastes':      { mode: 'isolated',    strength: 1.00, gap_m: 58 },
  thornmarsh:          { mode: 'maze',        strength: 0.95, gap_m: 58 },
  'valus-ridge':       { mode: 'drainage',    strength: 0.70, gap_m: 52 },
  'western-rootlands': { mode: 'rows',        strength: 0.90, spacing_m: 34, bearing_deg: 0, rectilinear: true },
};

const COVER = {
  blackwood:           { shape: 'litter',  h: 0.10, colour: '#243522', per100m2: 22, patch_m: 7 },
  'clay-moor':         { shape: 'plate',   h: 0.09, colour: '#AC6440', per100m2: 9,  patch_m: 12 },
  'crimson-coast':     { shape: 'cobble',  h: 0.22, colour: '#2C2629', per100m2: 16, patch_m: 5 },
  'deep-marshes':      { shape: 'tussock', h: 0.45, colour: '#1F3138', per100m2: 14, patch_m: 9 },
  'eastern-rootlands': { shape: 'reed',    h: 0.55, colour: '#4E7A5A', per100m2: 20, patch_m: 4 },
  hive:                { shape: 'wax',     h: 0.16, colour: '#D8CC96', per100m2: 13, patch_m: 14 },
  'marauders-coast':   { shape: 'shell',   h: 0.10, colour: '#9AA0A0', per100m2: 24, patch_m: 6 },
  'salt-hills':        { shape: 'tuft',    h: 0.28, colour: '#7E8B58', per100m2: 26, patch_m: 3 },
  'stone-forest':      { shape: 'flag',    h: 0.12, colour: '#6E7987', per100m2: 8,  patch_m: 16 },
  'stone-wastes':      { shape: 'flake',   h: 0.20, colour: '#E4E2D6', per100m2: 6,  patch_m: 20 },
  thornmarsh:          { shape: 'tussock', h: 0.30, colour: '#9A8570', per100m2: 17, patch_m: 5 },
  'valus-ridge':       { shape: 'gravel',  h: 0.15, colour: '#B2AA96', per100m2: 30, patch_m: 4 },
  'western-rootlands': { shape: 'stubble', h: 0.35, colour: '#7E9052', per100m2: 21, patch_m: 3 },
};

/**
 * THE GROUND SKIN — the ordinary underfoot surface, at the scale a standing player reads it.
 *
 * `MICRO` above is landform at 11-46 m and lives in `field.heightAt()`. This is the other half,
 * at 0.6-3.2 m, and it exists because the first half did not show up in a frame. Measured over
 * the 39 day frames of round 4's own capture, Sobel edge density in the BOTTOM QUARTER of the
 * image — the ground 2 to 8 m from the eye, which is most of every frame — carried a
 * between-region to within-region ratio of 0.91. All thirteen near grounds were the same
 * untextured plane, and stripping colour stripped the whole of the difference.
 *
 * `amp_m` is the PEAK rise of the surface above the graded ground; `len_m` its characteristic
 * length; `bearing_deg` the direction of the three surfaces that have one (a storm beach, a tide
 * comb and a ploughed field are all lineated, and none of them are lineated at random).
 * `tone` scales the albedo response: crests drain pale, hollows hold water dark, an open joint
 * is a shadow line whether or not the sun is in it.
 *
 * Read by `game/src/world/groundskin.js`, which explains at length why this layer is drawn and
 * not collided (0.42 m of tussock at 1.15 m spacing is a 51-degree local gradient against a
 * 40-degree walkable gate: in the collision surface it would fence the province).
 */
const SKIN = {
  blackwood:           { kind: 'rootnet',    amp_m: 0.32, len_m: 2.60, tone: 0.95 },
  'clay-moor':         { kind: 'polygon',    amp_m: 0.16, len_m: 1.70, tone: 1.00 },
  'crimson-coast':     { kind: 'berm',       amp_m: 0.24, len_m: 1.40, tone: 0.85, bearing_deg: 118 },
  'deep-marshes':      { kind: 'tussock',    amp_m: 0.42, len_m: 1.15, tone: 1.00 },
  'eastern-rootlands': { kind: 'rillnet',    amp_m: 0.20, len_m: 2.90, tone: 0.85 },
  hive:                { kind: 'hexcell',    amp_m: 0.22, len_m: 1.50, tone: 0.80 },
  'marauders-coast':   { kind: 'sandripple', amp_m: 0.09, len_m: 0.80, tone: 0.75, bearing_deg: 24 },
  'salt-hills':        { kind: 'crustpuff',  amp_m: 0.18, len_m: 1.30, tone: 0.80 },
  'stone-forest':      { kind: 'slab',       amp_m: 0.26, len_m: 2.40, tone: 0.90 },
  'stone-wastes':      { kind: 'crackfield', amp_m: 0.12, len_m: 3.20, tone: 0.70, bearing_deg: 36 },
  thornmarsh:          { kind: 'hummock',    amp_m: 0.36, len_m: 2.00, tone: 0.85 },
  'valus-ridge':       { kind: 'blockstep',  amp_m: 0.28, len_m: 0.95, tone: 0.95 },
  'western-rootlands': { kind: 'furrow',     amp_m: 0.14, len_m: 0.62, tone: 0.80, bearing_deg: 0 },
};

/** Vertical structure: how ragged the skyline is, and what breaks it. */
const VERTICAL = {
  blackwood:           { h_var: 0.30, lean_deg: 3,  emergent: { h_mult: 1.75, share: 0.06 } },
  'clay-moor':         { h_var: 0.22, lean_deg: 6,  emergent: null },
  'crimson-coast':     { h_var: 0.00, lean_deg: 0,  emergent: null },
  'deep-marshes':      { h_var: 0.45, lean_deg: 11, emergent: null },
  'eastern-rootlands': { h_var: 0.20, lean_deg: 4,  emergent: { h_mult: 2.10, share: 0.04 } },
  hive:                { h_var: 0.35, lean_deg: 0,  emergent: null },
  'marauders-coast':   { h_var: 0.18, lean_deg: 8,  emergent: null },
  'salt-hills':        { h_var: 0.26, lean_deg: 5,  emergent: null },
  'stone-forest':      { h_var: 0.55, lean_deg: 2,  emergent: { h_mult: 1.90, share: 0.05 } },
  'stone-wastes':      { h_var: 0.30, lean_deg: 9,  emergent: null },
  thornmarsh:          { h_var: 0.14, lean_deg: 2,  emergent: null },
  'valus-ridge':       { h_var: 0.40, lean_deg: 14, emergent: null },
  'western-rootlands': { h_var: 0.16, lean_deg: 0,  emergent: null },
};

/** RI-WLD10 §8 verbatim — the table the S24 census scores. */
const WATER = {
  'clay-moor':         { wci: 0.00, class: 'arid',             deepest_band: 'W0', tidal: false, sea: null,       k: null, substrates: ['FIRM'] },
  hive:                { wci: 0.00, class: 'arid',             deepest_band: 'W0', tidal: false, sea: null,       k: null, substrates: ['FIRM'] },
  'valus-ridge':       { wci: 0.01, class: 'dry-upland',       deepest_band: 'W3', tidal: false, sea: null,       k: 0.9,  substrates: ['FIRM'] },
  'salt-hills':        { wci: 0.02, class: 'dry-upland',       deepest_band: 'W2', tidal: false, sea: null,       k: 0.8,  substrates: ['FIRM', 'SILT'] },
  'stone-wastes':      { wci: 0.03, class: 'arid-salt-fringe', deepest_band: 'W3', tidal: true,  sea: 'topal',    k: 1.4,  substrates: ['FIRM', 'SILT'] },
  'stone-forest':      { wci: 0.06, class: 'damp',             deepest_band: 'W2', tidal: false, sea: null,       k: 1.1,  substrates: ['FIRM'] },
  thornmarsh:          { wci: 0.09, class: 'seasonal',         deepest_band: 'W2', tidal: false, sea: null,       k: 2.0,  substrates: ['FIRM', 'SILT'] },
  'crimson-coast':     { wci: 0.34, class: 'tidal-littoral',   deepest_band: 'W5', tidal: true,  sea: 'padomaic', k: 0.35, substrates: ['FIRM', 'SILT'] },
  blackwood:           { wci: 0.41, class: 'flooded-forest',   deepest_band: 'W5', tidal: false, sea: null,       k: 2.6,  substrates: ['SILT', 'SUCK'] },
  'western-rootlands': { wci: 0.47, class: 'paddy-channel',    deepest_band: 'W4', tidal: true,  sea: 'topal',    k: 1.9,  substrates: ['FIRM', 'SILT'] },
  'marauders-coast':   { wci: 0.58, class: 'tidal-flat',       deepest_band: 'W5', tidal: true,  sea: 'topal',    k: 1.4,  substrates: ['SUCK', 'SILT'] },
  'eastern-rootlands': { wci: 0.71, class: 'tidal-delta',      deepest_band: 'W5', tidal: true,  sea: 'padomaic', k: 3.2,  substrates: ['SILT', 'SUCK'] },
  'deep-marshes':      { wci: 0.86, class: 'drowned',          deepest_band: 'W5', tidal: false, sea: null,       k: 4.5,  substrates: ['SUCK', 'SILT'] },
};

const NAME_TO_ID = {
  'The Salt Hills': 'salt-hills', Thornmarsh: 'thornmarsh', 'Valus Ridge': 'valus-ridge',
  'The Stone Forest': 'stone-forest', 'The Clay Moor': 'clay-moor', 'Crimson Coast': 'crimson-coast',
  Blackwood: 'blackwood', 'The Hive': 'hive', 'The Deep Marshes': 'deep-marshes',
  "Marauder's Coast": 'marauders-coast', 'Western Rootlands': 'western-rootlands',
  'Eastern Rootlands': 'eastern-rootlands', 'Stone Wastes': 'stone-wastes',
};

const out = [];
let idx = 0;
for (const [name, c] of Object.entries(corpusRegions.regions)) {
  const id = NAME_TO_ID[name];
  if (!id) throw new Error(`no id for corpus region "${name}"`);
  const a = R[id];
  if (!a) throw new Error(`no authored axes for "${id}"`);
  const cen = scale.regions_centroid[name];
  if (!cen) throw new Error(`no centroid for "${name}"`);
  out.push({
    index: idx++,
    id, name,
    centroid_m: [cen.x, cen.z],
    bounds_m: c.aabb_m,
    area_km2: c.area_km2,
    danger_tier: c.difficulty_tier,
    palette_hex: c.palette_hex,
    ground: a.ground,
    fog: a.fog,
    sky: a.sky,
    terrain: { ...a.terrain, micro: MICRO[id], skin: SKIN[id] },
    props: {
      ...PROPS[id],
      canopy: { ...PROPS[id].canopy, ...VERTICAL[id] },
      arrangement: ARRANGE[id],
      cover: COVER[id],
    },
    water: WATER[id],
    flora: a.flora,
    fauna: a.fauna,
    architecture: a.architecture,
    audio: a.audio,
    weather: a.weather,
    hazard: a.hazard,
    only_here: { id: a.only_here.id, instances: a.only_here.instances, text: c.only_here },
    flora_density_per_100m2: a.flora_density,
    canopy_closure: a.canopy,
    sightline_m: a.sightline_m,
    climate: c.weather,
    flora_text: c.flora,
    fauna_text: c.fauna,
    architecture_text: c.architecture,
    ambient_text: c.ambient_audio,
    hazard_text: c.hazard,
    settlements: c.settlements ? String(c.settlements).split(',').map((s) => s.trim()) : [],
    provenance: 'corpus/50-world/regions.json + corpus/50-world/world-scale.json (S24: the map is authoritative); measurable axes and terrain parameters are W1-01',
  });
}
out.sort((p, q) => p.id.localeCompare(q.id));
out.forEach((r, i) => { r.index = i; });

const doc = {
  schema: 'elder-souls/regions@2',
  generator: 'tools/world/build-regions.mjs',
  note: 'Thirteen regions, each a different place (ARBITRATION S24). `flora`/`fauna`/`architecture`/'
      + '`audio`/`weather`/`hazard`/`ground`/`fog`/`terrain` are the nine axes RI-WLD04 M18 scores '
      + 'pairwise; `water` is the RI-WLD10 §8 profile the S24 census reads. `index` is the value '
      + 'stored per cell in game/data/world/terrain.json\'s region raster.',
  metres_per_source_pixel: 3.5,
  total_land_km2: corpusRegions.total_land_km2,
  world_bounds_m: scale.scale.world_bounds_m,
  regions: out,
};
writeFileSync(join(ROOT, 'game/data/world/regions.json'), JSON.stringify(doc, null, 2) + '\n');
process.stdout.write(`regions.json — ${out.length} regions, ${out.map((r) => r.id).join(', ')}\n`);
