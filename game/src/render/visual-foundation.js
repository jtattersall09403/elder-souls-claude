// W1-30 shared visual foundation.  World builders request semantic families here instead of
// inventing isolated flat materials.  The procedural maps are deterministic, tiny, reusable and
// remain non-colour data; authored colour continues to come from the region/settlement records.
'use strict';

import * as THREE from '../../vendor/three/three.module.js';
import { REGION_ART } from './world-art.js';
// W1-30S seam: the water surface shader lives in render/water.js (future owner: W1-30H).
// worldMaterial() below still decides that the 'water' family gets it; only the shader body
// and its live phase/reflection state moved.
import { installWaterShader } from './water.js';

export const VISUAL_FEATURES = Object.freeze({
  lighting: 'sun-moon-practicals', shadows: 'texel-snapped-pcf', materials: 'semantic-pbr',
  atmosphere: 'region-weather-depth', vegetation: 'instanced-shadowed-motion-ready',
  animation: 'simulation-rig-cross-state', postprocess: 'aces-srgb', streaming: 'hysteretic-chunks',
  ao: 'material-cavity', ibl: 'sky-hemisphere-environment', sky: 'coupled-sun-weather',
  vfx: 'depth-lit-residue', palette: 'black-marsh-styleboards', silhouette: 'asymmetric-kits',
  architecture: 'settlement-grammars', creature: 'saxhleel-and-region-forms',
  interiorDressing: 'room-kind-bays-coffers-and-focal-zones',
  composition: 'landmark-depth-layers', weirdness: 'inexplicable-hybrids', mood: 'weather-material-response',
  flora: 'region-canopy-understory', artMaterials: 'wet-chitin-resin-bone-root-clay-salt',
});

// A declaration cannot earn coverage.  Each row names the shipping module and the observable
// that a cheap gate and the live census can independently find.  Keep this table beside the
// factory so adding a feature without a consumer fails closed.
export const FEATURE_CONSUMERS = Object.freeze({
  lighting: ['render/sky.js', 'sun.intensity'], shadows: ['render/sky.js', 'shadow.camera'],
  materials: ['render/visual-foundation.js', 'visualFamily'], atmosphere: ['render/sky.js', 'scene.fog.density'],
  vegetation: ['world/province.js', 'regionMats'], animation: ['render/actor.js', 'poseFromRig'],
  postprocess: ['render/renderer.js', 'ACESFilmicToneMapping'], streaming: ['world/province.js', 'radiusTiles'],
  ao: ['render/visual-foundation.js', 'aoMap'], ibl: ['render/sky.js', 'HemisphereLight'],
  sky: ['render/sky.js', 'uSunDir'], vfx: ['render/spell-vfx.js', 'residue'],
  palette: ['render/renderer.js', 'setVisualStyleboards'], silhouette: ['render/exterior.js', 'silhouette'],
  architecture: ['render/exterior.js', 'architecture_kit'], creature: ['render/renderer.js', 'RACE_TINT'],
  interiorDressing: ['render/interior.js', 'interior-focal-zone'],
  composition: ['world/province.js', 'SIGNATURE_KINDS'], weirdness: ['world/province.js', 'inexplicable_element'],
  mood: ['render/visual-foundation.js', 'board.atmosphere_response'], flora: ['world/province.js', 'props.cover.shape'],
  artMaterials: ['world/province.js', 'dominant_materials'],
});

const FAMILY = Object.freeze({
  mud: { roughness: .91, metalness: 0, bump: .32 }, wet_mud: { roughness: .48, metalness: .05, bump: .24 },
  bark: { roughness: .88, metalness: 0, bump: .48 }, leaf: { roughness: .72, metalness: 0, bump: .28 },
  reed: { roughness: .82, metalness: 0, bump: .22 }, root: { roughness: .86, metalness: 0, bump: .46 },
  timber: { roughness: .84, metalness: 0, bump: .38 }, clay: { roughness: .78, metalness: 0, bump: .30 },
  stone: { roughness: .72, metalness: .02, bump: .42 }, salt: { roughness: .58, metalness: .02, bump: .34 },
  bone: { roughness: .63, metalness: 0, bump: .20 }, chitin: { roughness: .46, metalness: .12, bump: .32 },
  resin: { roughness: .34, metalness: .04, bump: .18 }, cloth: { roughness: .89, metalness: 0, bump: .16 },
  skin: { roughness: .57, metalness: 0, bump: .14 }, metal: { roughness: .31, metalness: .78, bump: .12 },
  water: { roughness: .12, metalness: .38, bump: .08 },
  shell: { roughness: .55, metalness: .03, bump: .38 }, thorn: { roughness: .82, metalness: 0, bump: .45 },
  wet_chitin: { roughness: .26, metalness: .14, bump: .28 },
});

const FAMILY_COLOUR = Object.freeze({
  mud:0x443b31, wet_mud:0x253b37, bark:0x453326, leaf:0x3f6549, reed:0x71805b,
  root:0x4c3028, timber:0x694936, clay:0x98523f, stone:0x62666a, salt:0xc5c4aa,
  bone:0xd2c39c, chitin:0x654858, resin:0x5b9a78, cloth:0x725f55, skin:0x75875f,
  metal:0x75828b, water:0x244e58, shell:0xa39172, thorn:0x50372e, wet_chitin:0x3e4d4d,
});

// ---------------------------------------------------------------------------
// THE PUBLISHED REGISTRY SURFACE — frozen contract, see render/MATERIAL_API.md.
//
// W1-30D (characters), W1-30E (architecture), W1-30F (terrain/vegetation) and
// W1-30G (interiors) code against this and nothing else.  Options may be ADDED
// here; an option may never be removed or repurposed.  Every identifier below
// is fail-closed: an unknown family, palette, trim slot or option key throws at
// construction rather than silently producing a plausible-looking wrong result,
// because a silently-wrong material is exactly the defect this piece exists to
// remove (a 96px hash-noise field wearing twenty hats for a year).
// ---------------------------------------------------------------------------

/** The twenty semantic families.  Frozen: adding one is a plan edit, not a builder's call. */
export const MATERIAL_FAMILIES = Object.freeze(Object.keys(FAMILY));

/** The six declared material classes.  A naive judge shown unlabelled close-ups must be able to
 * group the twenty families into these six; that is W1-30C's `families are distinguishable` gate.
 * The cuts are by how a surface responds to light, not by what it is made of in fiction: `metal`
 * sits with the minerals because it is hard, non-translucent and roughness-driven; `water` sits
 * with the pliant surfaces because it is the third family whose surface deforms continuously. */
export const MATERIAL_CLASSES = Object.freeze({
  soil: Object.freeze(['mud', 'wet_mud', 'clay']),
  wood: Object.freeze(['bark', 'root', 'timber', 'thorn']),
  foliage: Object.freeze(['leaf', 'reed']),
  mineral: Object.freeze(['stone', 'salt', 'metal']),
  carapace: Object.freeze(['chitin', 'wet_chitin', 'shell', 'bone', 'resin']),
  pliant: Object.freeze(['cloth', 'skin', 'water']),
});
const FAMILY_CLASS = Object.freeze(Object.fromEntries(
  Object.entries(MATERIAL_CLASSES).flatMap(([cls, fams]) => fams.map(f => [f, cls]))));
export function materialClass(family) {
  const c = FAMILY_CLASS[family];
  if (!c) throw new Error(`W1-30C unknown visual material family '${family}'`);
  return c;
}

/** One shared detail-normal tile per class of surface, blended at DETAIL_NORMAL_TILING x the base
 * rate.  Four tiles carry all six classes and all twenty families: this is how a 1k base texture
 * survives a 0.5 m close-up without a 4k base texture per family. */
const CLASS_DETAIL_TILE = Object.freeze({
  soil: 'mineral', mineral: 'mineral', wood: 'organic',
  foliage: 'organic', carapace: 'hard', pliant: 'fabric',
});
export const DETAIL_NORMAL_TILES = Object.freeze(['organic', 'mineral', 'fabric', 'hard']);
export const DETAIL_NORMAL_TILING = 8;

/** Metres of world surface covered by one tile of a family's base texture.
 *
 * This is the seam that keeps texel density stable across the game.  C publishes the target here;
 * D, E and F lay out their UVs so that one UV unit equals this many metres, and then every surface
 * in a frame resolves at a comparable number of texels per metre.  The plan's hard fail is a >4x
 * density change between adjacent surfaces in one shot, and the widest adjacency this table
 * permits (leaf 0.6 m against timber 2.2 m) is 3.7x.  Read it with `materialTiling(family, opts)`
 * rather than inlining the numbers. */
export const TEXEL_METRES = Object.freeze({
  mud: 4.0, wet_mud: 4.0, clay: 2.5, bark: 1.6, root: 1.8, timber: 2.2, thorn: 1.2,
  leaf: 0.6, reed: 0.8, stone: 2.4, salt: 3.0, metal: 0.9, chitin: 0.7, wet_chitin: 0.7,
  shell: 0.9, bone: 0.8, resin: 0.7, cloth: 1.1, skin: 1.4, water: 8.0,
});

/** Region palette swatches — the `palette` variant axis.
 *
 * `world-art.js` is read-only to every W1-30 child and carries no colour, so the swatches live
 * here, keyed by the same thirteen region ids so the two files cannot drift apart without the
 * assertion below firing at import time.  A palette is a tint plus a strength, applied to base
 * colour and to the trim tint, so one stone texture set reads as Blackwood stone or Salt Hills
 * stone without a second texture set on disk.  `neutral` is the identity. */
export const PALETTES = Object.freeze({
  neutral: Object.freeze({ tint: 0x808080, strength: 0, satMul: 1.0, valMul: 1.0 }),
  blackwood: Object.freeze({ tint: 0x2f3a2c, strength: .34, satMul: 1.08, valMul: .90 }),
  'clay-moor': Object.freeze({ tint: 0x8a6a3f, strength: .32, satMul: 1.14, valMul: 1.08 }),
  'crimson-coast': Object.freeze({ tint: 0x7a3730, strength: .36, satMul: 1.22, valMul: .98 }),
  'deep-marshes': Object.freeze({ tint: 0x2b3d35, strength: .38, satMul: 1.04, valMul: .86 }),
  'eastern-rootlands': Object.freeze({ tint: 0x5d6b3a, strength: .30, satMul: 1.12, valMul: 1.04 }),
  hive: Object.freeze({ tint: 0x8a7239, strength: .35, satMul: 1.18, valMul: 1.06 }),
  'marauders-coast': Object.freeze({ tint: 0x5a6470, strength: .33, satMul: .88, valMul: 1.02 }),
  'salt-hills': Object.freeze({ tint: 0xb7b49a, strength: .37, satMul: .72, valMul: 1.18 }),
  'stone-forest': Object.freeze({ tint: 0x3f4247, strength: .34, satMul: .78, valMul: .92 }),
  'stone-wastes': Object.freeze({ tint: 0x7d7c72, strength: .32, satMul: .74, valMul: 1.10 }),
  thornmarsh: Object.freeze({ tint: 0x3d2f33, strength: .36, satMul: 1.06, valMul: .88 }),
  'valus-ridge': Object.freeze({ tint: 0x4e5a52, strength: .31, satMul: .92, valMul: 1.00 }),
  'western-rootlands': Object.freeze({ tint: 0x4a5738, strength: .30, satMul: 1.10, valMul: .98 }),
});
for (const id of Object.keys(REGION_ART)) {
  // Fail at import, not at the one frame where a region without a swatch is on screen.
  if (!PALETTES[id]) throw new Error(`W1-30C region '${id}' has no palette swatch in visual-foundation.js`);
}
export function paletteSwatch(id) {
  const p = PALETTES[id];
  if (!p) throw new Error(`W1-30C unknown palette swatch '${id}' (known: ${Object.keys(PALETTES).join(', ')})`);
  return p;
}

/** Trim atlas slots — the `trim` variant axis, consumed by W1-30E's kit parts and W1-30D's
 * equipment.  A trim sheet is why authored architecture reads as *made* rather than extruded.
 * Each slot is one horizontal band of the shared 2048x1536 atlas, twelve bands of 128 px. */
export const TRIM_SLOTS = Object.freeze({
  edge: 0, moulding: 1, plank: 2, lashing: 3, bolt: 4, 'shell-ring': 5,
  'bone-binding': 6, 'resin-seam': 7, 'dye-band': 8, 'metal-course': 9,
  'chitin-bar': 10, 'bleached-timber': 11,
});
export const TRIM_ATLAS = Object.freeze({ width: 2048, height: 1536, bands: 12, bandHeight: 128 });
export function trimSlot(id) {
  const band = TRIM_SLOTS[id];
  if (band === undefined) throw new Error(`W1-30C unknown trim slot '${id}' (known: ${Object.keys(TRIM_SLOTS).join(', ')})`);
  // v runs bottom-up in three.js UV space; return the band's [v0, v1] and its pixel row.
  const v0 = 1 - (band + 1) / TRIM_ATLAS.bands, v1 = 1 - band / TRIM_ATLAS.bands;
  return { id, band, v0, v1, row: band * TRIM_ATLAS.bandHeight };
}

/** Every option key `worldMaterial` accepts.  Frozen in the sense that entries may be added and
 * never removed; the census reads this array to detect a variant spec using an undeclared axis. */
export const MATERIAL_OPTION_KEYS = Object.freeze([
  // three.js pass-through, unchanged semantics
  'color', 'roughness', 'metalness', 'map', 'normalMap', 'alphaTest', 'transparent', 'opacity',
  'side', 'emissive', 'emissiveIntensity', 'envMapIntensity', 'vertexColors', 'depthWrite',
  // declared variant axes
  'lod', 'wetness', 'wear', 'tilingScale', 'trim', 'palette', 'boundedException',
  // retained from the pre-freeze surface; live call sites depend on these
  'aoMapIntensity', 'bumpScale', 'authored',
]);
const OPTION_KEY_SET = new Set(MATERIAL_OPTION_KEYS);
export const LOD_LEVELS = Object.freeze(['shared', 'near', 'far', 'impostor']);

const unit = (name, v) => {
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0 || n > 1) throw new Error(`W1-30C option '${name}' must be 0..1, got ${JSON.stringify(v)}`);
  return n;
};

/** Validate a variant spec against the declared axes and return it normalised.  Exported so that
 * W1-30V's census and any consumer can check a spec without constructing a material. */
export function validateMaterialOptions(family, options = {}) {
  if (!FAMILY[family]) throw new Error(`W1-30 unknown visual material family '${family}'`);
  if (options === null || typeof options !== 'object') throw new Error('W1-30C material options must be an object');
  for (const k of Object.keys(options)) {
    if (!OPTION_KEY_SET.has(k)) {
      throw new Error(`W1-30C unknown material option '${k}' for family '${family}'. `
        + `Declared axes: ${MATERIAL_OPTION_KEYS.join(', ')}. Adding one is a plan edit (see render/MATERIAL_API.md).`);
    }
  }
  const wear = options.wear === undefined ? 0 : unit('wear', options.wear);
  const wetness = options.wetness === undefined ? 0 : unit('wetness', options.wetness);
  let tilingScale = options.tilingScale === undefined ? 1 : Number(options.tilingScale);
  if (!Number.isFinite(tilingScale) || tilingScale <= 0 || tilingScale > 64) {
    throw new Error(`W1-30C option 'tilingScale' must be a positive number <= 64, got ${JSON.stringify(options.tilingScale)}`);
  }
  const palette = options.palette === undefined || options.palette === null ? 'neutral' : String(options.palette);
  paletteSwatch(palette);
  const trim = options.trim === undefined || options.trim === null ? null : String(options.trim);
  if (trim !== null) trimSlot(trim);
  const lod = options.lod === undefined ? 'shared' : String(options.lod);
  if (!LOD_LEVELS.includes(lod)) throw new Error(`W1-30C unknown lod '${lod}' (known: ${LOD_LEVELS.join(', ')})`);
  return { family, wear, wetness, tilingScale, palette, trim, lod, class: materialClass(family) };
}

/** The tiling a consumer should lay its UVs out for: metres of world surface per UV unit, and the
 * texture repeat that follows from it.  D/E/F call this rather than guessing a repeat. */
export function materialTiling(family, options = {}) {
  const v = validateMaterialOptions(family, options);
  const metres = TEXEL_METRES[family] * v.tilingScale;
  return { metresPerTile: metres, texelsPerMetre: 1024 / metres, repeat: 1 / metres, detailRepeat: DETAIL_NORMAL_TILING / metres };
}

/** A stable string identity for a (family, variant) pair.  W1-30V's `duplicate` check hashes this
 * so that a second definition of an existing material is visible as a copy rather than a variant. */
export function materialVariantKey(family, options = {}) {
  const v = validateMaterialOptions(family, options);
  return `${family}|p=${v.palette}|w=${v.wear.toFixed(2)}|wet=${v.wetness.toFixed(2)}`
    + `|t=${v.tilingScale.toFixed(2)}|trim=${v.trim ?? '-'}|lod=${v.lod}`;
}

/** Apply a styleboard to pixels, not metadata. The semantic board controls the material's
 * dominant/contrast colour, wet/cavity response and shader identity. `amount=0` is the live
 * sabotage arm used by the W1-30 visual-consumption check. */
export function consumeStyleboard(mat, board, role='dominant', amount=1) {
  if (!mat || !board) throw new Error('consumeStyleboard requires a rendered material and board');
  const family = role === 'contrast' ? board.contrast_material : board.dominant_materials[role === 'secondary' ? 1 : 0];
  const target = new THREE.Color(FAMILY_COLOUR[family] ?? 0xff00ff);
  if (!mat.userData.preStyleColour) mat.userData.preStyleColour = mat.color?.getHex();
  if (mat.color) {
    mat.color.set(mat.userData.preStyleColour).lerp(target, Math.max(0,Math.min(1,amount)) * .62);
    // Several Blackwood boards intentionally specify near-black wet materials.  Applied to an
    // already dark semantic base those values multiplied down until a clear noon frame had no
    // facade information left at all. Preserve the hue/saturation distinction while enforcing a
    // physically plausible diffuse floor: charcoal timber is dark, but it still reflects light.
    // Contrast parts sit a little higher so openings, edges and structural rhythm remain legible.
    const hsl={h:0,s:0,l:0};mat.color.getHSL(hsl);
    // The first hardware capture proved that the former .16/.18/.22 range collapsed whole
    // facades and bodies into charcoal after ACES, texture modulation and fog. These are diffuse
    // reflectance floors, not an exposure trick: dark timber remains dark while retaining grain,
    // seams and form under the shared key/fill rig.
    const floor=role==='contrast'?.31:role==='secondary'?.27:.235;
    if(hsl.l<floor)mat.color.setHSL(hsl.h,Math.min(hsl.s,.72),floor);
  }
  const wet = /rain|wet|beaded|gloss/i.test(board.atmosphere_response);
  if (Number.isFinite(mat.roughness)) mat.roughness = Math.max(.18, mat.roughness * (wet ? .62 : .9));
  if (Number.isFinite(mat.aoMapIntensity)) mat.aoMapIntensity = wet ? .78 : .58;
  mat.userData.styleboard = { id:board.id, family, role, silhouette_motif:board.silhouette_motif,
    inexplicable_element:board.inexplicable_element, atmosphere_response:board.atmosphere_response,
    visibleMix:+amount };
  mat.name += `:style-${board.id}-${family}`;
  mat.needsUpdate = true;
  return mat;
}

const mapCache = new Map();

/** Every family's authored texture set. All twenty are covered; sixteen are CC0 photogrammetry
 * from Poly Haven and three (chitin, resin, water) are synthesised by `tools/assets/`, recorded as
 * substitutions under this piece's stop condition. `wet_chitin` deliberately shares `chitin`'s set
 * and differs by the declared wetness axis — a second set for the same surface is a census
 * duplicate, not a variant.
 *
 * This table is the shipped truth; `tools/assets/material-library.json` is the build-side spec, and
 * `tools/assets/check-material-coverage.mjs` fails if the two disagree. It is a check rather than a
 * constructor assertion on purpose (RULES.md rule 14). */
const FAMILY_SET=Object.freeze({
  mud:'brown_mud', wet_mud:'mud_forest', bark:'bark_brown_01', leaf:'forest_leaves_02',
  reed:'reed_roof_04', root:'roots', timber:'dark_wooden_planks', clay:'clay_plaster',
  stone:'plastered_stone_wall', salt:'white_plaster_rough_01', bone:'marble_01',
  chitin:'chitin_plates', resin:'resin_flow', cloth:'rough_linen', skin:'brown_leather',
  metal:'rusty_metal_04', water:'water_ripple', shell:'shell_floor_01', thorn:'bark_willow',
  wet_chitin:'chitin_plates',
});
const SYNTH_SETS=Object.freeze(['chitin_plates','resin_flow','water_ripple']);
const authoredCache=new Map();
const assetUrl=(rel)=>new URL(`../../assets/w1-30/materials/${rel}`,import.meta.url).href;

function authoredMaps(family){
  const slug=FAMILY_SET[family];if(!slug||typeof document==='undefined')return null;
  const key=`${SYNTH_SETS.includes(slug)?'synth':'cc0'}:${slug}`;
  if(authoredCache.has(key))return authoredCache.get(key);
  const loader=new THREE.TextureLoader();
  // Base repeat stays at 2, the value shipping today: this commit changes what the texture IS,
  // not how often it tiles. Consumers moving to world-space UVs read materialTiling() instead.
  const setup=(t,role)=>{t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(2,2);t.anisotropy=8;t.generateMipmaps=true;t.minFilter=THREE.LinearMipmapLinearFilter;t.magFilter=THREE.LinearFilter;t.name=`w1-30-authored:${key}:${role}`;return t;};
  // Every family sharing this texture set goes to the visible fallback if any of its maps 404s.
  // This is the mechanism behind the coverage gate's null control: delete a normal map on a copy
  // and the frame turns magenta rather than quietly reverting to something plausible.
  const onError=(role,url)=>()=>{for(const f of MATERIAL_FAMILIES) if(FAMILY_SET[f]===slug) markFamilyAssetFailure(f,`(${role} @ ${url})`);};
  const load=(file,role,colourSpace)=>{const url=assetUrl(`${slug}/${file}`);const t=setup(loader.load(url,undefined,undefined,onError(role,url)),role);t.colorSpace=colourSpace;return t;};
  const maps={
    albedo:load(`${slug}_albedo_1k.jpg`,'albedo',THREE.SRGBColorSpace),
    normal:load(`${slug}_normal_1k.jpg`,'normal',THREE.NoColorSpace),
    rough:load(`${slug}_rough_512.jpg`,'rough',THREE.NoColorSpace),
    source:key,
  };
  authoredCache.set(key,maps);return maps;
}

/** The four shared detail-normal tiles, blended at DETAIL_NORMAL_TILING x the base rate. Four
 * textures carry every family's close-up: this is why a 1k base survives 0.5 m without a 4k base. */
const detailNormalCache=new Map();
function detailNormalTile(tile){
  if(typeof document==='undefined')return null;
  if(detailNormalCache.has(tile))return detailNormalCache.get(tile);
  const url=assetUrl(`detail/detail_normal_${tile}_512.jpg`);
  const t=new THREE.TextureLoader().load(url,undefined,undefined,()=>console.error(`W1-30C detail normal '${tile}' failed to load @ ${url}`));
  t.wrapS=t.wrapT=THREE.RepeatWrapping;t.colorSpace=THREE.NoColorSpace;t.anisotropy=4;t.name=`w1-30-detail-normal:${tile}`;
  detailNormalCache.set(tile,t);return t;
}

/** The shared trim atlas. E's kit parts and D's equipment map a face onto a band of this rather
 * than authoring per-settlement trim, which is why eight settlements cost one texture. */
let trimAtlasCache=null;
export function trimAtlasTextures(){
  if(typeof document==='undefined')return null;
  if(trimAtlasCache)return trimAtlasCache;
  const loader=new THREE.TextureLoader();
  const one=(file,role,cs)=>{const url=assetUrl(`trim/${file}`);const t=loader.load(url,undefined,undefined,()=>console.error(`W1-30C trim atlas '${role}' failed to load @ ${url}`));
    t.wrapS=THREE.RepeatWrapping;t.wrapT=THREE.ClampToEdgeWrapping;t.colorSpace=cs;t.anisotropy=8;t.name=`w1-30-trim:${role}`;return t;};
  trimAtlasCache={albedo:one('trim_atlas_albedo_2k.jpg','albedo',THREE.SRGBColorSpace),
    normal:one('trim_atlas_normal_2k.jpg','normal',THREE.NoColorSpace),
    rough:one('trim_atlas_rough_2k.jpg','rough',THREE.NoColorSpace)};
  return trimAtlasCache;
}
function hash(x, y, seed) {
  let h = Math.imul(x + seed, 374761393) ^ Math.imul(y - seed, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}
function detailMaps(family) {
  if (mapCache.has(family)) return mapCache.get(family);
  // 32px white noise read as video-game static at character distance and dissolved into a
  // uniform grey at vista distance.  A small 96px multi-scale field is still shared by every
  // consumer of a family, but carries broad material structure as well as pores/grain.
  const N = 96, height = new Uint8Array(N * N * 4), albedo = new Uint8Array(N * N * 4);
  const rough = new Uint8Array(N * N * 4), seed = [...family].reduce((a,c)=>a+c.charCodeAt(0), 0);
  for (let y=0;y<N;y++) for (let x=0;x<N;x++) {
    const grain = hash(x, y, seed), medium = hash(x>>2, y>>2, seed+17);
    const broad = hash(x>>4, y>>4, seed+37);
    const directional = /bark|root|timber|reed|cloth/.test(family)
      ? Math.sin((x + hash(y>>3, 0, seed) * 12) * .38) * 13 : 0;
    const cellular = /stone|clay|mud|salt/.test(family)
      ? Math.abs(hash(x>>3,y>>3,seed+61)-.5)*24 : 0;
    const v = Math.max(12,Math.min(244,Math.round(58 + grain * 28 + medium * 56 + broad * 92 + directional + cellular)));
    // Keep multiplicative pigment detail near white. Height and roughness carry the stronger
    // structure; a mid-grey sRGB map would decode dark and crush the marsh palette to black.
    const a = Math.max(226,Math.min(255,Math.round(241 + (broad-.5)*18 + (medium-.5)*9 + directional*.08)));
    const q = Math.max(70,Math.min(248,Math.round(170 + (1-medium)*42 + cellular*.8 - directional*.25)));
    const i=(y*N+x)*4;
    height[i]=height[i+1]=height[i+2]=v; height[i+3]=255;
    albedo[i]=albedo[i+1]=albedo[i+2]=a; albedo[i+3]=255;
    rough[i]=rough[i+1]=rough[i+2]=q; rough[i+3]=255;
  }
  const texture=(bytes,role,colourSpace)=>{const t=new THREE.DataTexture(bytes,N,N,THREE.RGBAFormat);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(4,4);t.colorSpace=colourSpace;t.anisotropy=4;t.needsUpdate=true;t.name=`w1-30-${role}:${family}:96px-multiscale`;return t;};
  const maps={height:texture(height,'height',THREE.NoColorSpace),albedo:texture(albedo,'albedo',THREE.SRGBColorSpace),rough:texture(rough,'roughness',THREE.NoColorSpace)};
  mapCache.set(family,maps); return maps;
}

// A texture's `repeat` is per-texture state, so a variant that retiles cannot share the cached
// instance.  Clone per quantised scale: `Texture.clone()` shares `source`, so the second instance
// costs a sampler and its parameters, not a second image upload, and the cache is bounded by the
// two decimal places rather than by the number of call sites.
const tiledCache = new Map();
function tiled(texture, scale) {
  if (!texture || !(scale > 0) || Math.abs(scale - 1) < 1e-6) return texture;
  const q = Math.round(scale * 100) / 100;
  const key = `${texture.uuid}@${q}`;
  let t = tiledCache.get(key);
  if (!t) {
    t = texture.clone();
    t.repeat.set(texture.repeat.x / q, texture.repeat.y / q);
    t.name = `${texture.name}:tile${q}`;
    t.needsUpdate = true;
    tiledCache.set(key, t);
  }
  return t;
}

/** Palette and wear act on base colour.  Palette pulls the family toward its region swatch and
 * then re-grades saturation and value, so Blackwood stone and Salt Hills stone are the same texture
 * set and different surfaces.  Wear is pigment loss toward the substrate: less saturated, slightly
 * lighter, and (above, in `materialOptions`) rougher. */
function applyVariantColour(mat, variant) {
  if (!mat.color) return;
  const hsl = { h: 0, s: 0, l: 0 };
  if (variant.palette !== 'neutral') {
    const sw = paletteSwatch(variant.palette);
    mat.color.lerp(new THREE.Color(sw.tint), sw.strength);
    mat.color.getHSL(hsl);
    mat.color.setHSL(hsl.h, Math.min(1, hsl.s * sw.satMul), Math.max(0, Math.min(1, hsl.l * sw.valMul)));
  }
  if (variant.wear > 0) {
    mat.color.getHSL(hsl);
    mat.color.setHSL(hsl.h, hsl.s * (1 - .45 * variant.wear), Math.min(1, hsl.l + .10 * variant.wear));
  }
}

// The declared fallback.  A family whose authored maps fail to load must be *obviously* wrong, not
// plausibly wrong: a plausible fallback is how a 96px noise field textured a province for weeks
// without anyone seeing it.  Materials are registered by family so that an asynchronous texture
// load error can reach back and stain every material already built from that set.
const liveFamilyMaterials = new Map();
const failedFamilies = new Set();
export const FALLBACK_COLOUR = 0xff00d4;
function registerFamilyMaterial(family, mat) {
  let set = liveFamilyMaterials.get(family);
  if (!set) liveFamilyMaterials.set(family, set = new Set());
  set.add(mat);
  if (failedFamilies.has(family)) stainFallback(mat, family);
}
function stainFallback(mat, family) {
  mat.color?.set(FALLBACK_COLOUR);
  mat.emissive?.set(0x220018);
  mat.name = `visual-family:${family}:ASSET-LOAD-FAILED`;
  mat.userData.w1_30 = { ...(mat.userData.w1_30 || {}), fallback: 'authored-asset-load-failed' };
  mat.needsUpdate = true;
}
/** Called by the texture loader's error path, and by the null control that deletes an asset. */
export function markFamilyAssetFailure(family, detail = '') {
  if (failedFamilies.has(family)) return;
  failedFamilies.add(family);
  console.error(`W1-30C authored asset failed for family '${family}' ${detail} — falling back to the visible magenta material`);
  for (const mat of liveFamilyMaterials.get(family) || []) stainFallback(mat, family);
}
/** Which families are currently on the visible fallback.  The coverage gate reads this. */
export function materialFallbackReport() {
  return { fallbackColour: FALLBACK_COLOUR, families: [...failedFamilies].sort() };
}

// ---------------------------------------------------------------------------
// The surface shader: detail normals, the wear mask and the wetness mask.
//
// Three things a scalar cannot do and a mask can.  A `wear` of 0.7 as a scalar makes the whole
// plank rougher; as a mask it wears the *arris* of the plank and leaves the face, which is what
// "used" actually looks like.  A `wetness` of 0.6 as a scalar makes a whole wall wet; as a mask it
// wets the bottom of the wall and the hollow it stands in, which is what rain actually does.
//
// The curvature proxy is the base normal map's own slope: a texel whose normal leans hard away
// from flat is on an edge or a rim.  That is a real signal already present in every authored set,
// it costs one length() and it needs no extra vertex data from D, E or F.
// ---------------------------------------------------------------------------
let worldWetness={ amount:0, topY:0.9, bottomY:-0.4 };
const shadedMaterials=new Set();

/** B's weather drives this.  `amount` scales every material's wetness mask; `topY`/`bottomY` are
 * the world heights between which a surface goes from dry to fully wet, so hollows wet first. */
export function setWorldWetness({ amount=0, topY, bottomY }={}) {
  worldWetness={ amount:Math.max(0,Math.min(1,Number(amount)||0)),
    topY:Number.isFinite(topY)?topY:worldWetness.topY, bottomY:Number.isFinite(bottomY)?bottomY:worldWetness.bottomY };
  for(const mat of shadedMaterials){const u=mat.userData?.surfaceUniforms;if(!u)continue;
    u.uWorldWetness.value=worldWetness.amount;u.uWetTop.value=worldWetness.topY;u.uWetBottom.value=worldWetness.bottomY;}
  return { ...worldWetness };
}
export function worldWetnessState(){ return { ...worldWetness }; }

const NORMAL_MAPS_CHUNK='#include <normal_fragment_maps>';
function installSurfaceShader(mat, { tile, tiling, wear, wetness }) {
  const detail=detailNormalTile(tile);
  const u={
    uDetailNormal:{value:detail}, uDetailTiling:{value:tiling}, uDetailStrength:{value:detail?.62:0},
    uWear:{value:wear}, uWearCurvature:{value:2.4},
    uWetness:{value:wetness}, uWorldWetness:{value:worldWetness.amount},
    uWetTop:{value:worldWetness.topY}, uWetBottom:{value:worldWetness.bottomY},
  };
  mat.userData.surfaceUniforms=u;
  const prior=mat.onBeforeCompile;
  mat.onBeforeCompile=(shader,renderer)=>{
    if(prior) prior(shader,renderer);
    for(const k of Object.keys(u)) shader.uniforms[k]=u[k];
    shader.vertexShader='varying float vEsSurfaceWorldY;\n'+shader.vertexShader.replace('#include <begin_vertex>',
      '#include <begin_vertex>\n  vEsSurfaceWorldY=(modelMatrix*vec4(transformed,1.0)).y;');
    shader.fragmentShader='uniform sampler2D uDetailNormal;\nuniform float uDetailTiling;\nuniform float uDetailStrength;\n'
      +'uniform float uWear;\nuniform float uWearCurvature;\nuniform float uWetness;\nuniform float uWorldWetness;\n'
      +'uniform float uWetTop;\nuniform float uWetBottom;\nvarying float vEsSurfaceWorldY;\nfloat vEsSurfaceCurv;\n'
      +shader.fragmentShader
      // Replace the stock chunk rather than patch around it: the detail normal has to be combined
      // in tangent space *before* `tbn *` or it does not survive at grazing angles.
      .replace(NORMAL_MAPS_CHUNK,`
        vEsSurfaceCurv=0.0;
        #ifdef USE_NORMALMAP_OBJECTSPACE
          normal = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;
          #ifdef FLIP_SIDED
            normal = - normal;
          #endif
          #ifdef DOUBLE_SIDED
            normal = normal * faceDirection;
          #endif
          normal = normalize( normalMatrix * normal );
        #elif defined( USE_NORMALMAP_TANGENTSPACE )
          vec3 mapN = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;
          mapN.xy *= normalScale;
          vec3 esDetailN = texture2D( uDetailNormal, vNormalMapUv * uDetailTiling ).xyz * 2.0 - 1.0;
          // UDN blend: keep the base map's z, add the detail slope. Cheap, stable, and it does not
          // wash the base map out the way a whiteout blend does.
          mapN = normalize( vec3( mapN.xy + esDetailN.xy * uDetailStrength, mapN.z ) );
          vEsSurfaceCurv = clamp( length( mapN.xy ) * uWearCurvature, 0.0, 1.0 );
          normal = normalize( tbn * mapN );
        #elif defined( USE_BUMPMAP )
          normal = perturbNormalArb( - vViewPosition, normal, dHdxy_fwd(), faceDirection );
        #endif`)
      .replace('#include <lights_physical_fragment>',`#include <lights_physical_fragment>
        // Wear lives on the arris: pigment is gone, the substrate shows through lighter, and the
        // surface is rougher where a hand or a boot has been.
        float esWear = uWear * vEsSurfaceCurv;
        material.diffuseColor.rgb = mix( material.diffuseColor.rgb, material.diffuseColor.rgb * 1.42 + vec3( 0.035 ), esWear );
        material.roughness = clamp( material.roughness + esWear * 0.34, 0.03, 1.0 );
        // Wetness pools downhill: the material's own wetness, plus the world's, gated by height.
        float esHeightWet = smoothstep( uWetTop, uWetBottom, vEsSurfaceWorldY );
        float esWet = clamp( max( uWetness, uWorldWetness * esHeightWet ), 0.0, 1.0 );
        material.roughness = clamp( material.roughness * ( 1.0 - 0.62 * esWet ), 0.03, 1.0 );
        material.diffuseColor.rgb *= ( 1.0 - 0.34 * esWet );`);
  };
  const priorKey=mat.customProgramCacheKey;
  mat.customProgramCacheKey=()=>`w1-30c-surface-v1:${tile}:${detail?1:0}:${priorKey?priorKey():''}`;
  shadedMaterials.add(mat);
  mat.needsUpdate=true;
}

export function worldMaterial(family, options={}) {
  const spec=FAMILY[family];
  if (!spec) throw new Error(`W1-30 unknown visual material family '${family}'`);
  // Fail-closed on the variant spec before a single texture is touched.  An undeclared axis is a
  // census `unknown` and must not reach a frame looking approximately right.
  const variant=validateMaterialOptions(family, options);
  const ts=variant.tilingScale;
  const procedural=detailMaps(family), authored=options.authored===false?null:authoredMaps(family);
  const Material=family==='water'||family==='wet_chitin'||family==='resin'?THREE.MeshPhysicalMaterial:THREE.MeshStandardMaterial;
  const foliage=/^(leaf|reed)$/.test(family), woody=/^(bark|root|thorn)$/.test(family),baseColour=options.color ?? 0xffffff;
  // Wetness and wear are physical, not decorative.  A wet surface is smoother, darker in diffuse
  // and brighter in specular; a worn surface is rougher and has lost pigment toward its substrate.
  // These scalars set the whole-material response; `installSurfaceShader` below multiplies the same
  // two numbers by the shared curvature and world-height masks, so edges wear and hollows wet.
  const wet=variant.wetness, wear=variant.wear;
  const materialOptions={
    color: baseColour,
    roughness: Math.max(.04, Math.min(1, (options.roughness ?? spec.roughness)*(1-.55*wet)*(1+.22*wear))),
    // A governed consumer may supply an admitted authored map (the foliage atlas is the first).
    // Previously every truthy `options.map` was silently ignored and replaced by the family
    // detail map, making manifest-routed alpha cards impossible while appearing configured.
    metalness: options.metalness ?? spec.metalness,
    map: options.map === false ? null : (options.map?.isTexture ? options.map : tiled(authored?.albedo||procedural.albedo, ts)),
    // `options.normalMap` was declared by the API and silently ignored by the implementation: the
    // family's own normal always won.  A consumer supplying an authored normal (D's character
    // sheets, E's kit parts) now gets it, and only falls back to the family map when it does not.
    normalMap: options.normalMap === false ? null : (options.normalMap?.isTexture ? options.normalMap : tiled(authored?.normal||null, ts)),
    normalScale:new THREE.Vector2(spec.bump*.72,spec.bump*.72),
    bumpMap: (options.normalMap?.isTexture||authored?.normal)?null:tiled(procedural.height, ts),
    roughnessMap: tiled(authored?.rough||procedural.rough, ts),
    // The 96px noise field was bound as aoMap for the whole world.  Contact occlusion is a screen
    // -space job (W1-30A's GTAO stack); binding noise to it darkened everything a little and
    // grounded nothing.  It survives only on the procedural fallback path, where there is no
    // authored cavity information at all.
    aoMap: authored?null:tiled(procedural.height, ts),
    aoMapIntensity: options.aoMapIntensity ?? .42,
    bumpScale: options.bumpScale ?? spec.bump, vertexColors: !!options.vertexColors,
    transparent: !!options.transparent, opacity: options.opacity ?? 1,
    alphaTest: options.alphaTest ?? 0, side: options.side ?? THREE.FrontSide,
    emissive: options.emissive ?? (family==='water'?baseColour:(foliage||woody?baseColour:0x000000)),
    emissiveIntensity: options.emissiveIntensity ?? (family==='water'?.28:foliage?.24:woody?.035:1),
    // A wet surface returns more of the environment; this is the term B's rain has to land on.
    envMapIntensity: (options.envMapIntensity ?? (family==='metal'||family==='water'||family==='wet_chitin'?1.25:.72))*(1+.62*wet),
    depthWrite: options.depthWrite ?? family!=='water',
  };
  // `clearcoat`, `clearcoatRoughness` and `ior` belong to MeshPhysicalMaterial. Passing them to
  // every Standard material emitted three warnings per material while building a town and made
  // browser/Pod logs enormous. More importantly, it disguised which families really pay for the
  // physical shader. Keep that cost and response on the three admitted physical families only.
  if(Material===THREE.MeshPhysicalMaterial){
    materialOptions.clearcoat=family==='water'?.72:.38;
    materialOptions.clearcoatRoughness=family==='water'?.16:.34;
    materialOptions.ior=family==='water'?1.333:1.48;
  }
  const mat=new Material(materialOptions);
  mat.name=`visual-family:${family}`; mat.userData.visualFamily=family;
  applyVariantColour(mat, variant);
  const baseRepeat=authored?2:4;
  mat.userData.w1_30={ shadow:true, ao:'cavity-map', ibl:true,
    uvScale:[baseRepeat/ts, baseRepeat/ts], detail:authored?.source||'96px-albedo-height-roughness',
    class:variant.class, wetness:variant.wetness, wear:variant.wear, palette:variant.palette,
    tilingScale:variant.tilingScale, trim:variant.trim,
    metresPerTile:TEXEL_METRES[family]*ts, detailNormalTile:CLASS_DETAIL_TILE[variant.class],
    variantKey:materialVariantKey(family, options),
    boundedException:options.boundedException||null, lod:variant.lod };
  registerFamilyMaterial(family, mat);
  // W1-30S seam: the animated ripple/reflection shader lives in render/water.js now (future
  // owner: W1-30H). worldMaterial() still decides that 'water' gets it.
  if(family==='water') installWaterShader(mat);
  // The detail-normal/wear/wetness pass needs a tangent-space normal map to work against, so it
  // installs only where one exists — which, after this piece, is every family.
  if(materialOptions.normalMap){
    installSurfaceShader(mat, { tile:CLASS_DETAIL_TILE[variant.class],
      tiling:DETAIL_NORMAL_TILING/ts, wear, wetness:wet });
  }
  return mat;
}

export function visualFoundationCensus(root) {
  const families=new Set(), bypass=[], variants=new Set(), palettes=new Set(), noiseFallback=new Set();
  const densities=new Map();
  root.traverse(o=>{ if (!(o.isMesh||o.isInstancedMesh) || !o.material) return;
    for (const m of (Array.isArray(o.material)?o.material:[o.material])) {
      const f=m.userData?.visualFamily;
      if (f) {
        families.add(f);
        const w=m.userData.w1_30;
        if (w) {
          if (w.variantKey) variants.add(w.variantKey);
          if (w.palette) palettes.add(w.palette);
          if (typeof w.detail==='string' && w.detail.startsWith('96px')) noiseFallback.add(f);
          if (w.metresPerTile) densities.set(f, w.metresPerTile);
        }
      }
      else if (m.isMeshStandardMaterial || m.isMeshPhysicalMaterial) bypass.push(o.name||o.type);
    }
  });
  return { features:{...VISUAL_FEATURES}, families:[...families].sort(),
    legacyStandardSurfaces:[...new Set(bypass)].sort(),
    classes:Object.fromEntries(Object.keys(MATERIAL_CLASSES).map(c=>[c,[...families].filter(f=>FAMILY_CLASS[f]===c).sort()])),
    variants:[...variants].sort(), palettes:[...palettes].sort(),
    // A shipped frame using the noise fallback is a hard fail; this is the field that shows it.
    noiseFallbackFamilies:[...noiseFallback].sort(),
    assetFailureFamilies:materialFallbackReport().families,
    metresPerTile:Object.fromEntries([...densities].sort()) };
}
