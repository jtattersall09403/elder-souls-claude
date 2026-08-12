// W1-30 shared visual foundation.  World builders request semantic families here instead of
// inventing isolated flat materials.  The procedural maps are deterministic, tiny, reusable and
// remain non-colour data; authored colour continues to come from the region/settlement records.
'use strict';

import * as THREE from '../../vendor/three/three.module.js';

export const VISUAL_FEATURES = Object.freeze({
  lighting: 'sun-moon-practicals', shadows: 'texel-snapped-pcf', materials: 'semantic-pbr',
  atmosphere: 'region-weather-depth', vegetation: 'instanced-shadowed-motion-ready',
  animation: 'simulation-rig-cross-state', postprocess: 'aces-srgb', streaming: 'hysteretic-chunks',
  ao: 'material-cavity', ibl: 'sky-hemisphere-environment', sky: 'coupled-sun-weather',
  vfx: 'depth-lit-residue', palette: 'black-marsh-styleboards', silhouette: 'asymmetric-kits',
  architecture: 'settlement-grammars', creature: 'saxhleel-and-region-forms',
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

/** Apply a styleboard to pixels, not metadata. The semantic board controls the material's
 * dominant/contrast colour, wet/cavity response and shader identity. `amount=0` is the live
 * sabotage arm used by the W1-30 visual-consumption check. */
export function consumeStyleboard(mat, board, role='dominant', amount=1) {
  if (!mat || !board) throw new Error('consumeStyleboard requires a rendered material and board');
  const family = role === 'contrast' ? board.contrast_material : board.dominant_materials[role === 'secondary' ? 1 : 0];
  const target = new THREE.Color(FAMILY_COLOUR[family] ?? 0xff00ff);
  if (!mat.userData.preStyleColour) mat.userData.preStyleColour = mat.color?.getHex();
  if (mat.color) mat.color.set(mat.userData.preStyleColour).lerp(target, Math.max(0,Math.min(1,amount)) * .62);
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
function hash(x, y, seed) {
  let h = Math.imul(x + seed, 374761393) ^ Math.imul(y - seed, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}
function detailMap(family) {
  if (mapCache.has(family)) return mapCache.get(family);
  const N = 32, bytes = new Uint8Array(N * N * 4), seed = [...family].reduce((a,c)=>a+c.charCodeAt(0), 0);
  for (let y=0;y<N;y++) for (let x=0;x<N;x++) {
    const grain = hash(x, y, seed), broad = hash(x>>2, y>>2, seed+17);
    const v = Math.round(92 + grain * 54 + broad * 74), i=(y*N+x)*4;
    bytes[i]=bytes[i+1]=bytes[i+2]=v; bytes[i+3]=255;
  }
  const t = new THREE.DataTexture(bytes, N, N, THREE.RGBAFormat);
  t.wrapS=t.wrapT=THREE.RepeatWrapping; t.repeat.set(4,4); t.colorSpace=THREE.NoColorSpace;
  t.needsUpdate=true; t.name=`w1-30-detail:${family}`; mapCache.set(family,t); return t;
}

export function worldMaterial(family, options={}) {
  const spec=FAMILY[family];
  if (!spec) throw new Error(`W1-30 unknown visual material family '${family}'`);
  const map=detailMap(family);
  const mat=new THREE.MeshStandardMaterial({
    color: options.color ?? 0xffffff, roughness: options.roughness ?? spec.roughness,
    metalness: options.metalness ?? spec.metalness, bumpMap: map, aoMap: map,
    aoMapIntensity: options.aoMapIntensity ?? .42,
    bumpScale: options.bumpScale ?? spec.bump, vertexColors: !!options.vertexColors,
    transparent: !!options.transparent, opacity: options.opacity ?? 1,
    alphaTest: options.alphaTest ?? 0, side: options.side ?? THREE.FrontSide,
    emissive: options.emissive ?? 0x000000, emissiveIntensity: options.emissiveIntensity ?? 1,
    envMapIntensity: options.envMapIntensity ?? (family==='metal'||family==='water'||family==='wet_chitin'?1.25:.72),
  });
  mat.name=`visual-family:${family}`; mat.userData.visualFamily=family;
  mat.userData.w1_30={ shadow:true, ao:'cavity-map', ibl:true, uvScale:[4,4],
    wetness:Number(options.wetness||0), boundedException:options.boundedException||null,
    lod:options.lod ?? 'shared' };
  return mat;
}

export function visualFoundationCensus(root) {
  const families=new Set(), bypass=[];
  root.traverse(o=>{ if (!(o.isMesh||o.isInstancedMesh) || !o.material) return;
    for (const m of (Array.isArray(o.material)?o.material:[o.material])) {
      if (m.userData?.visualFamily) families.add(m.userData.visualFamily);
      else if (m.isMeshStandardMaterial || m.isMeshPhysicalMaterial) bypass.push(o.name||o.type);
    }
  });
  return { features:{...VISUAL_FEATURES}, families:[...families].sort(), legacyStandardSurfaces:[...new Set(bypass)].sort() };
}
