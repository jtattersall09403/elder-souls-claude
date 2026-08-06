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
    ground: { id: 'gnd_ash_over_peat', albedo: '#4A4438', roughness: 0.97, name: 'ash-dusted peat' },
    fog: { colour: '#8B8577', extinction_per_m: 0.0090, height_falloff_m: 90 },
    sky: { zenith: '#54524B', horizon: '#9A9484' },
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
    ground: { id: 'gnd_cliff_limestone', albedo: '#B9B2A0', roughness: 0.78, name: 'wind-holed limestone and scree' },
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
    fog: { colour: '#C9A druck', extinction_per_m: 0.0018, height_falloff_m: 150 },
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
    terrain: { base_m: 12, amp_m: 18, wavelength_m: 560, relief_m: 3.6, ridge: 0.48, terrace: 0.08, style: 'littoral-rock' },
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
    ground: { id: 'gnd_leaf_mulch', albedo: '#1F2E1C', roughness: 0.96, name: 'black leaf mulch and root buttress' },
    fog: { colour: '#25361F', extinction_per_m: 0.0140, height_falloff_m: 60 },
    sky: { zenith: '#243A2C', horizon: '#3E5238' },
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
    ground: { id: 'gnd_black_silt', albedo: '#16191A', roughness: 0.99, name: 'black silt and voriplasm margin' },
    fog: { colour: '#3B5A3A', extinction_per_m: 0.0230, height_falloff_m: 30 },
    sky: { zenith: '#2B3A33', horizon: '#4A5A46' },
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
    terrain: { base_m: 0.55, amp_m: 2.1, wavelength_m: 500, relief_m: 0.95, ridge: 0.0, terrace: 0.05, style: 'tidal-flat' },
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
    terrain: { base_m: 2.4, amp_m: 3.1, wavelength_m: 560, relief_m: 1.15, ridge: 0.0, terrace: 0.30, style: 'paddy' },
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
  thornmarsh:          { canopy: { shape: 'spire',  h: 6.2,  r: 1.1, colour: '#241E1C', trunk: '#2A241F', per100m2: 1.10 },
                         under: { shape: 'blade',  h: 0.9,  colour: '#46583F', per100m2: 2.2 },
                         rock:  { colour: '#8B8577', per100m2: 0.06, scale: 0.9 } },
  'valus-ridge':       { canopy: { shape: 'spire',  h: 9.0,  r: 1.3, colour: '#4E6B3C', trunk: '#6E6A5A', per100m2: 0.10 },
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
  blackwood:           { canopy: { shape: 'sphere', h: 16.0, r: 5.0, colour: '#1F2E1C', trunk: '#4A3423', per100m2: 1.55 },
                         under: { shape: 'frond',  h: 1.2,  colour: '#2A4023', per100m2: 4.0 },
                         rock:  { colour: '#C9A54B', per100m2: 0.10, scale: 0.9 } },
  hive:                { canopy: { shape: 'dome',   h: 7.0,  r: 3.6, colour: '#D6C77A', trunk: '#9A6B2F', per100m2: 0.55 },
                         under: { shape: 'comb',   h: 0.3,  colour: '#E6E2D0', per100m2: 2.4 },
                         rock:  { colour: '#9A6B2F', per100m2: 0.14, scale: 1.1 } },
  'deep-marshes':      { canopy: { shape: 'spire',  h: 11.0, r: 0.7, colour: '#16191A', trunk: '#16191A', per100m2: 0.85 },
                         under: { shape: 'blade',  h: 1.5,  colour: '#3B5A3A', per100m2: 3.0 },
                         rock:  { colour: '#4A3A55', per100m2: 0.10, scale: 1.4 } },
  'marauders-coast':   { canopy: { shape: 'arch',   h: 3.4,  r: 2.2, colour: '#2C3A2E', trunk: '#5E4A3A', per100m2: 0.34 },
                         under: { shape: 'blade',  h: 0.7,  colour: '#8E8A7E', per100m2: 2.0 },
                         rock:  { colour: '#5E7C88', per100m2: 0.45, scale: 1.3 } },
  'western-rootlands': { canopy: { shape: 'arch',   h: 8.0,  r: 4.5, colour: '#6B5638', trunk: '#6B5638', per100m2: 0.42 },
                         under: { shape: 'blade',  h: 1.1,  colour: '#6E8A4E', per100m2: 4.6 },
                         rock:  { colour: '#A8B7A6', per100m2: 0.05, scale: 0.8 } },
  'eastern-rootlands': { canopy: { shape: 'sphere', h: 5.0,  r: 2.6, colour: '#4F7A5E', trunk: '#2A211A', per100m2: 0.36 },
                         under: { shape: 'frond',  h: 0.8,  colour: '#5E8A6E', per100m2: 3.6 },
                         rock:  { colour: '#B7C4C0', per100m2: 0.05, scale: 0.8 } },
  'stone-wastes':      { canopy: { shape: 'spire',  h: 2.6,  r: 0.5, colour: '#8C5A3A', trunk: '#8C5A3A', per100m2: 0.16 },
                         under: { shape: 'crust',  h: 0.2,  colour: '#EDEDE6', per100m2: 1.0 },
                         rock:  { colour: '#DCD2B8', per100m2: 0.90, scale: 2.2 } },
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
    terrain: a.terrain,
    props: PROPS[id],
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
