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
const AUTHORED_FAMILY=Object.freeze({mud:'brown_mud',wet_mud:'brown_mud',bark:'bark_brown_01',root:'bark_brown_01',timber:'bark_brown_01',thorn:'bark_brown_01',stone:'plastered_stone_wall',clay:'plastered_stone_wall',salt:'plastered_stone_wall'});
const GENERATED_FAMILY=Object.freeze({leaf:'leaf',reed:'reed',cloth:'cloth',chitin:'chitin',wet_chitin:'chitin',resin:'resin',bone:'bone',metal:'metal',shell:'bone'});
const authoredCache=new Map();
const animatedWaterMaterials=new Set();
let waterReflectionTexture=null,waterReflectionResolution=new THREE.Vector2(1,1),waterReflectionStrength=0,waterReflectionMatrix=new THREE.Matrix4();
function authoredMaps(family){
  const slug=AUTHORED_FAMILY[family], generated=GENERATED_FAMILY[family];if((!slug&&!generated)||typeof document==='undefined')return null;
  const key=slug?`cc0:${slug}`:`generated:${generated}`;if(authoredCache.has(key))return authoredCache.get(key);
  const loader=new THREE.TextureLoader(),setup=(t,role,repeat=2)=>{t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(repeat,repeat);t.anisotropy=4;t.name=`w1-30-authored:${key}:${role}`;return t;};
  let maps;
  if(slug){const load=(role,colourSpace)=>{const t=setup(loader.load(new URL(`../../assets/w1-30/materials/${slug}/${slug}_${role}_1k.jpg`,import.meta.url).href),role);t.colorSpace=colourSpace;return t;};maps={albedo:load('detail',THREE.SRGBColorSpace),rough:load('rough',THREE.NoColorSpace),normal:load('nor_gl',THREE.NoColorSpace),source:key};}
  else {const albedo=setup(loader.load(new URL(`../../assets/w1-30/materials/generated/${generated}_detail_256.jpg`,import.meta.url).href),'neutral-detail-256',1);albedo.colorSpace=THREE.SRGBColorSpace;maps={albedo,rough:null,normal:null,source:key};}
  authoredCache.set(key,maps);return maps;
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

export function worldMaterial(family, options={}) {
  const spec=FAMILY[family];
  if (!spec) throw new Error(`W1-30 unknown visual material family '${family}'`);
  const procedural=detailMaps(family), authored=options.authored===false?null:authoredMaps(family);
  const Material=family==='water'||family==='wet_chitin'||family==='resin'?THREE.MeshPhysicalMaterial:THREE.MeshStandardMaterial;
  const foliage=/^(leaf|reed)$/.test(family), woody=/^(bark|root|thorn)$/.test(family),baseColour=options.color ?? 0xffffff;
  const materialOptions={
    color: baseColour, roughness: options.roughness ?? spec.roughness,
    // A governed consumer may supply an admitted authored map (the foliage atlas is the first).
    // Previously every truthy `options.map` was silently ignored and replaced by the family
    // detail map, making manifest-routed alpha cards impossible while appearing configured.
    metalness: options.metalness ?? spec.metalness,
    map: options.map === false ? null : (options.map?.isTexture ? options.map : (authored?.albedo||procedural.albedo)),
    normalMap:authored?.normal||null,normalScale:new THREE.Vector2(spec.bump*.72,spec.bump*.72),
    bumpMap: authored?.normal?null:procedural.height, roughnessMap: authored?.rough||procedural.rough, aoMap: procedural.height,
    aoMapIntensity: options.aoMapIntensity ?? .42,
    bumpScale: options.bumpScale ?? spec.bump, vertexColors: !!options.vertexColors,
    transparent: !!options.transparent, opacity: options.opacity ?? 1,
    alphaTest: options.alphaTest ?? 0, side: options.side ?? THREE.FrontSide,
    emissive: options.emissive ?? (family==='water'?baseColour:(foliage||woody?baseColour:0x000000)),
    emissiveIntensity: options.emissiveIntensity ?? (family==='water'?.28:foliage?.24:woody?.035:1),
    envMapIntensity: options.envMapIntensity ?? (family==='metal'||family==='water'||family==='wet_chitin'?1.25:.72),
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
  mat.userData.w1_30={ shadow:true, ao:'cavity-map', ibl:true, uvScale:authored?(authored.source.startsWith('cc0:')?[2,2]:[1,1]):[4,4], detail:authored?.source||'96px-albedo-height-roughness',
    wetness:Number(options.wetness||0), boundedException:options.boundedException||null,
    lod:options.lod ?? 'shared' };
  if(family==='water'){
    // A deterministic, presentation-only ripple field. Static texture maps made the surface
    // read as lacquer and made RI-VIS03 M12 TemporalVar correctly report static water. The
    // displacement is centimetres, leaves collision/tides authoritative, and is evaluated from
    // simulation frame rather than wall time so capture hashes remain reproducible.
    const u={uWaterPhase:{value:0},uWaterReflection:{value:waterReflectionTexture},uWaterReflectionResolution:{value:waterReflectionResolution.clone()},uWaterReflectionStrength:{value:waterReflectionStrength},uWaterReflectionMatrix:{value:waterReflectionMatrix.clone()}};mat.userData.waterUniforms=u;
    mat.onBeforeCompile=(shader)=>{shader.uniforms.uWaterPhase=u.uWaterPhase;shader.uniforms.uWaterReflection=u.uWaterReflection;shader.uniforms.uWaterReflectionResolution=u.uWaterReflectionResolution;shader.uniforms.uWaterReflectionStrength=u.uWaterReflectionStrength;shader.uniforms.uWaterReflectionMatrix=u.uWaterReflectionMatrix;
      shader.vertexShader='uniform float uWaterPhase;\nuniform mat4 uWaterReflectionMatrix;\nattribute float waterShore;\nvarying float vEsWaterWave;\nvarying float vEsWaterShore;\nvarying vec2 vEsWaterXZ;\nvarying vec3 vEsWaterWorld;\nvarying vec4 vEsWaterReflectionCoord;\n'+shader.vertexShader
        .replace('#include <begin_vertex>',`#include <begin_vertex>
          // Crossed, incommensurate waves avoid the axis-aligned 20 m light/dark lanes produced
          // by the former independent X and Z sines. Displacement remains centimetre-scale.
          float esA=position.x*.23+position.z*.17+uWaterPhase*1.37;
          float esB=-position.x*.19+position.z*.31-uWaterPhase*.91;
          float esC=position.x*.73-position.z*.61+uWaterPhase*1.83;
          vEsWaterWave=sin(esA)*.48+sin(esB)*.36+sin(esC)*.16;
          vEsWaterShore=waterShore;
          vEsWaterXZ=position.xz;
          transformed.y += vEsWaterWave*.018;`)
        .replace('#include <worldpos_vertex>',`#include <worldpos_vertex>
          vEsWaterWorld=(modelMatrix*vec4(transformed,1.0)).xyz;
          vEsWaterReflectionCoord=uWaterReflectionMatrix*vec4(vEsWaterWorld,1.0);`);
      shader.fragmentShader='uniform float uWaterPhase;\nuniform sampler2D uWaterReflection;\nuniform vec2 uWaterReflectionResolution;\nuniform float uWaterReflectionStrength;\nvarying float vEsWaterWave;\nvarying float vEsWaterShore;\nvarying vec2 vEsWaterXZ;\nvarying vec3 vEsWaterWorld;\nvarying vec4 vEsWaterReflectionCoord;\n'+shader.fragmentShader
        .replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
          float esA=vEsWaterXZ.x*.23+vEsWaterXZ.y*.17+uWaterPhase*1.37;
          float esB=-vEsWaterXZ.x*.19+vEsWaterXZ.y*.31-uWaterPhase*.91;
          float esC=vEsWaterXZ.x*.73-vEsWaterXZ.y*.61+uWaterPhase*1.83;
          float esD=vEsWaterXZ.x*2.7+vEsWaterXZ.y*1.9-uWaterPhase*2.4;
          vec2 esSlope=vec2(cos(esA)*.030-cos(esB)*.019+cos(esC)*.012+cos(esD)*.010,
                            cos(esA)*.022+cos(esB)*.031-cos(esC)*.010+cos(esD)*.007);
          normal=normalize(normal+vec3(esSlope.x,0.0,esSlope.y));`)
        .replace('#include <color_fragment>',`#include <color_fragment>
          diffuseColor.rgb*=1.015+vEsWaterWave*.008;`)
        // Reflection is radiance arriving from the environment. Applying it to diffuseColor
        // before Three's lighting multiplied it back toward black under the canopy. More
        // importantly, `normal` is declared by normal_fragment_begin AFTER color_fragment, so
        // the old injection referenced it before declaration and the water draw never linked.
        .replace('#include <opaque_fragment>',`
          float esFresnel=pow(1.0-clamp(abs(dot(normalize(normal),normalize(vViewPosition))),0.0,1.0),2.2);
          vec3 esSky=vec3(0.20,0.37,0.44);
          vec2 esReflUV=clamp(vEsWaterReflectionCoord.xy/max(.0001,vEsWaterReflectionCoord.w)*.5+.5,vec2(.001),vec2(.999));
          esReflUV+=esSlope*.0015;
          vec3 esReflection=texture2D(uWaterReflection,esReflUV).rgb;
          // Screen-aligned reflection retains the mirrored bank/sky relationship required at
          // grazing angles; the projected lookup above supplies local parallax and ripple warp.
          vec2 esScreenUV=gl_FragCoord.xy/max(uWaterReflectionResolution,vec2(1.0));
          vec3 esScreenReflection=texture2D(uWaterReflection,esScreenUV+esSlope*.0025).rgb;
          esReflection=mix(esReflection,esScreenReflection,.62);
          float esCaustic=pow(.5+.5*sin(vEsWaterWorld.x*.72+uWaterPhase*2.3)*sin(vEsWaterWorld.z*.61-uWaterPhase*1.7),3.0);
          float esShimmer=.5+.5*sin(uWaterPhase*5.1+vEsWaterWorld.x*.08-vEsWaterWorld.z*.05);
          float esPulse=sin(uWaterPhase*5.1)*.5+.5;
          // Distance raises the grazing response across a broad marsh vista while the actual
          // view/normal term preserves it on close oblique water. Reflected radiance is colour
          // graded back into the regional water rather than copied as a white mirror.
          float esGrazing=max(esFresnel,smoothstep(10.0,52.0,length(vViewPosition))*.72);
          float esReflLuma=dot(esReflection,vec3(.2126,.7152,.0722));
          esReflection=mix(esReflection,vec3(esReflLuma*.70,esReflLuma*.83,esReflLuma*.88),.48);
          vec3 esDepth=vec3(.038,.105,.118)+diffuseColor.rgb*.21;
          vec3 esSurface=mix(esDepth,esReflection,(.25+esGrazing*.50)*uWaterReflectionStrength);
          outgoingLight=mix(outgoingLight,esSurface,.68);
          float esRipples=.5+.5*sin(vEsWaterWorld.x*4.7+uWaterPhase*2.1)*sin(vEsWaterWorld.z*4.1-uWaterPhase*1.7);
          float esCapillary=.5+.5*sin(vEsWaterWorld.x*13.7+vEsWaterWorld.z*9.3-uWaterPhase*3.4);
          float esMicro=.5+.5*sin(vEsWaterWorld.x*26.3-vEsWaterWorld.z*21.7+uWaterPhase*4.7);
          // Fine terms break the normal/specular lobe; they must not become visible wallpaper.
          outgoingLight+=vec3(.006,.010,.011)*esCaustic+vec3(.003,.005,.006)*esShimmer+vec3(.006,.010,.012)*esPulse+vec3(.007,.010,.011)*(esRipples-.5)+vec3(.005,.007,.008)*(esCapillary-.5)+vec3(.004,.006,.007)*(esMicro-.5);
          float esShore=smoothstep(.04,.92,vEsWaterShore);
          float esFoam=esShore*smoothstep(.40,.78,.5+.5*sin(vEsWaterWorld.x*2.3-vEsWaterWorld.z*2.7+uWaterPhase*1.8));
          outgoingLight=mix(outgoingLight,vec3(.055,.064,.048)+outgoingLight*.34,esShore*.76);
          outgoingLight+=vec3(.095,.105,.082)*esFoam;
          #include <opaque_fragment>`);
    };mat.customProgramCacheKey=()=>`w1-30-water-ripple-reflection-v14`;animatedWaterMaterials.add(mat);
  }
  return mat;
}

/** Drive all live water shaders from the fixed simulation frame. */
export function updateVisualFoundationFrame(frame=0){
  const phase=(Number(frame)||0)/60;
  for(const mat of animatedWaterMaterials)if(mat.userData?.waterUniforms)mat.userData.waterUniforms.uWaterPhase.value=phase;
}

/** Bind the renderer's true mirrored scene pass to every live regional water material. */
export function bindWaterReflection(texture,width=1,height=1,strength=1,matrix=null){
  waterReflectionTexture=texture||null;waterReflectionResolution.set(Math.max(1,width),Math.max(1,height));waterReflectionStrength=texture?Math.max(0,Math.min(1,strength)):0;
  if(matrix)waterReflectionMatrix.copy(matrix);
  for(const mat of animatedWaterMaterials){const u=mat.userData?.waterUniforms;if(!u)continue;u.uWaterReflection.value=waterReflectionTexture;u.uWaterReflectionResolution.value.copy(waterReflectionResolution);u.uWaterReflectionStrength.value=waterReflectionStrength;u.uWaterReflectionMatrix.value.copy(waterReflectionMatrix);}
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
