// The renderable province: 4,825 x 5,540 m of Argonia, streamed.
//
// Three layers, and the split is what makes a 27 km2 world drawable at all on a software
// rasteriser: a single coarse mesh of the WHOLE province so the Valus Ridge is on the horizon
// from Helstrom; a ring of detailed tiles around the player, built on a budget so a region
// border is not a hitch (RI-PLT03); and per-tile instanced flora whose species, silhouette,
// height, colour and density come from `regions.json` (RI-WLD04's nine axes, three of which are
// here and not in a fog colour).
'use strict';

import * as THREE from '../../vendor/three/three.module.js';
import { worldMaterial, consumeStyleboard } from '../render/visual-foundation.js';
import { noise2, fbm, ridged, hash2, clamp, smoothstep, lerp } from './noise.js';
import { arrangeAt } from './arrangement.js';
import { SIGNATURE_KINDS } from './signature.js';
import { signatureGeometry, signatureMaterials, mergeAll } from './signature-geo.js';
import { thresholdGeometry, thresholdMaterials, remainsGeometry, remainsMaterial } from './threshold-geo.js';
import { planSettlement, buildSettlementExterior, settlementSolids, insideBuilding, applyInteriorBounds } from '../render/exterior.js';
import { regionArt } from '../render/world-art.js';

const TILE_M = 300;
// 5.36 m per quad. Raised from 40 (7.5 m) in round 4 for one reason, and it is a Nyquist reason
// rather than a taste one: `microrelief.js` puts each region's own ground shape into
// `field.heightAt()` at characteristic lengths of 11-46 m, and a 7.5 m quad grid cannot resolve
// an 11 m hummock field — the ground would have differed per region in the collision surface and
// in every audit, and looked identical in the frame. A change that moves a number and not a
// picture is the failure mode this whole piece is being re-dispatched for.
const TILE_SEG = 56;
const WATER_SEG = 24;
const RADIUS = 2;                 // 5 x 5 tiles resident => 1.5 km of detailed ground
const FAR_SEG_X = 96, FAR_SEG_Z = 110;
const MAX_INSTANCES = { canopy: 700, under: 2600, rock: 420 };
const STYLE_MATERIAL_CACHE=new WeakMap();
// The region's own lamps at night (RI-WLD04 M17 step 6). TWO, not six, and the number is a
// measurement rather than a taste: on the software rasteriser the M17 night pass ran at 11 s per
// frame with none and 3.75 MINUTES per frame with six, because every extra dynamic light multiplies
// the per-fragment cost of every instanced mesh in the tile. Two lamps plus the emissive materials
// plus the region-tinted night ambient in render/sky.js carry the same signal at a twentieth of it.
// The ground-cover disc: radius, lattice spacing and how far the camera must move before it is
// rebuilt. 70 m and 1.7 m give two to five thousand instances depending on the region's declared
// density, which the software rasteriser draws; the same density over the 2.25 km2 of resident
// tiles would be a quarter of a million and it would not.
const COVER_RADIUS_M = 70;
const COVER_LATTICE_M = 1.7;
const COVER_REBUILD_M = 14;
const MAX_COVER = 6000;
// The ground skin: a fine surface mesh that follows the camera. 15,625 vertices in ONE draw call
// — cheaper on the software rasteriser than the 2-5k separate-instance ground cover already is,
// and it is the only way to get sub-metre relief into the picture at all: the tile mesh is 5.36 m
// per quad and cannot carry a 1.3 m tussock field. See game/src/world/groundskin.js for what it
// carries and why it is not in the collision surface.
//
// 34 m at 0.55 m, not 55 m at 1.0 m, and the trade is free: at eye height 1.7 m with the camera
// pitched 4.3 degrees down and a 70-degree horizontal field of view, ground at 34 m subtends
// 2.86 degrees below the horizontal and ground at 55 m subtends 1.77 — the top of the patch sits
// at 43% of the frame height either way, because the horizon compresses. So the shorter radius
// costs one per cent of frame coverage and buys FOUR TIMES the resolution, and resolution is
// what decides whether a 1.3 m tussock field is a tussock field or a smooth tilt.
const SKIN_RADIUS_M = 34;
const SKIN_CELL_M = 0.55;
const SKIN_REBUILD_M = 11;
const SKIN_FADE_M = 9;
// The near-field prop disc. `MAX_INSTANCES` is a per-TILE budget, and applying it as a thinning
// factor (which round 4 correctly changed it to) clamps every region whose declared density
// exceeds the budget to the SAME realised density: 700 canopy over a 300 m tile is 0.78 per
// 100 m2, so Blackwood's declared 2.60 and Thornmarsh's 5.40 both rendered as 0.78 and their
// declared canopy closures of 0.92 and 0.49 both rendered as 0.63 and 0.02. Six of thirteen
// regions were clamped on the understorey layer and four on the rock layer, in each case exactly
// the regions that are supposed to be the dense ones. This disc puts the DEFICIT back inside
// 90 m — full declared density where the frame is made, the tile budget beyond it. It is level
// of detail, and it is the reason canopy closure is a real axis rather than a JSON field.
const NEAR_RADIUS_M = 90;
const NEAR_REBUILD_M = 22;
const MAX_NEAR = { canopy: 2600, under: 2400, rock: 700 };
const MAX_SIG_LIGHTS = 2;
const SIG_LIGHT_RANGE = 160;

const c3 = (hex) => new THREE.Color(hex);

const COVER_CARD = Object.freeze({ litter:12, tussock:14, reed:3, tuft:8, stubble:8 });

// Curved ribbon leaves authored in geometry, not billboard art.  The shared fan is deliberately
// modest (30-90 triangles) because thousands of copies are instanced, but each blade still has a
// tapered outline, a lifted midrib and a different radial pitch.  That gives fern, reed and grass
// populations real parallax at walking distance instead of the former row of intersecting planes.
function bladeLeaf(length, width, bend, azimuth, phase = 0) {
  const segments = 6, positions = [], indices = [];
  const dx = Math.sin(azimuth), dz = Math.cos(azimuth), tx = Math.cos(azimuth), tz = -Math.sin(azimuth);
  for (let i = 0; i <= segments; i++) {
    const t = i / segments, radial = length * (0.08 * t + 0.52 * t * t);
    const lift = length * (t - bend * t * t * .56);
    const ripple = Math.sin((t * 2.4 + phase) * Math.PI) * width * .07;
    const half = width * Math.sin(Math.PI * Math.pow(t, .78)) * .5;
    const cx = dx * radial, cz = dz * radial;
    positions.push(cx - tx * half, lift + ripple, cz - tz * half, cx + tx * half, lift - ripple, cz + tz * half);
    if (i < segments) { const a=i*2; indices.push(a,a+2,a+1,a+1,a+2,a+3); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setIndex(indices);g.computeVertexNormals();
  return g;
}

function proceduralFan(shape, width, height, cover = false) {
  const profile = {
    frond:[9,.92,.54], blade:[6,.76,.30], comb:[10,.88,.38], shelf:[7,1.08,.82], crust:[5,1.20,.94],
    reed:[5,.36,.14], tuft:[7,.58,.30], tussock:[9,.72,.35], stubble:[4,.28,.08], litter:[5,.82,.96],
  }[shape] || [cover?5:7,.70,.34];
  const [count, spread, bend] = profile, parts=[];
  for(let i=0;i<count;i++){
    const a=(i/count)*Math.PI*2+(i%2)*.19, variance=.76+((i*37)%11)/28;
    // `width` is the whole plant's declared footprint; one blade occupies only a fraction of it.
    parts.push(bladeLeaf(height*variance,width*spread*.22*(.76+(i%3)*.12),bend,a,i*.17));
  }
  if(!cover && height>.7){
    const stem=new THREE.CylinderGeometry(Math.min(.035,width*.035),Math.min(.055,width*.05),height*.48,5);
    stem.translate(0,height*.24,0);parts.push(stem);
  }
  return mergeAll(parts);
}

function taperedLimb(a,b,r0,r1,sides=7){
  const d=new THREE.Vector3().subVectors(b,a),g=new THREE.CylinderGeometry(r1,r0,d.length(),sides,1);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),d.clone().normalize()));
  g.translate((a.x+b.x)*.5,(a.y+b.y)*.5,(a.z+b.z)*.5);return g;
}

function branchedTrunk(height,radius,crownRadius){
  const parts=[taperedLimb(new THREE.Vector3(0,0,0),new THREE.Vector3(0,height*.72,0),radius,radius*.48,8)];
  // Flared, asymmetrical roots visually seat the bole in wet ground and stop equipment-scale
  // cylinders reading as utility poles. Branch phases are fixed per species geometry; instance
  // rotation and lean provide population variation without allocating unique meshes.
  for(let i=0;i<5;i++){
    const a=i*Math.PI*2/5+.22*(i%2),end=new THREE.Vector3(Math.cos(a)*radius*2.5,.02,Math.sin(a)*radius*2.5);
    parts.push(taperedLimb(new THREE.Vector3(0,height*.10,0),end,radius*.48,radius*.10,6));
  }
  for(let i=0;i<4;i++){
    const a=i*Math.PI*.5+.38, y=height*(.47+i*.055), reach=Math.min(crownRadius*.62,height*.20)*(1-(i%2)*.12);
    const elbow=new THREE.Vector3(Math.cos(a)*reach*.42,y+height*.10,Math.sin(a)*reach*.42);
    const end=new THREE.Vector3(Math.cos(a)*reach,y+height*(.16+(i%2)*.035),Math.sin(a)*reach);
    parts.push(taperedLimb(new THREE.Vector3(0,y,0),elbow,radius*.34,radius*.21,7));
    parts.push(taperedLimb(elbow,end,radius*.21,radius*.055,6));
  }
  return mergeAll(parts);
}

// Fully geometric crown: layered whorls of curved, tapered leaf ribbons around the branch
// endpoints. Unlike crossed alpha cards these remain permeable and three-dimensional when the
// gameplay camera walks underneath them, which the all-region capture explicitly exercises.
function organicCrown(shape,radius,height){
  const parts=[],spire=shape==='spire'||shape==='cone',column=shape==='column',arch=shape==='arch';
  const layers=arch?2:column?5:spire?5:4,perLayer=arch?7:10;
  for(let layer=0;layer<layers;layer++)for(let i=0;i<perLayer;i++){
    const a=i/perLayer*Math.PI*2+layer*.47,t=layers===1?0:layer/(layers-1);
    const spread=arch?.72:spire?(1-t*.62):(column?.68:1-t*.18);
    const len=radius*(.62+.20*((i*7+layer*3)%5)/4)*spread,width=Math.max(.10,radius*(spire?.105:.14));
    const leaf=bladeLeaf(len,width,.44+(i%3)*.08,a,layer*.23+i*.07);
    const ringR=arch?radius*.34:radius*(.15+.18*t),y=arch?(-.08+layer*.18)*height:height*(-.22+t*.38);
    leaf.translate(Math.sin(a)*ringR,y,Math.cos(a)*ringR);leaf.rotateZ((i%2?1:-1)*(spire?.34:.18));parts.push(leaf);
  }
  if(arch)for(const s of [-1,1]){const leaf=bladeLeaf(radius*.95,radius*.16,.58,s<0?-1.15:1.15,s);leaf.translate(s*radius*.26,-height*.10,0);leaf.rotateZ(s*.72);parts.push(leaf);}
  return mergeAll(parts);
}

export class Province {
  /** @param {import('./field.js').WorldField} field */
  constructor(field) {
    this.field = field;
    this.group = new THREE.Group();
    this.group.name = 'province';
    this.tiles = new Map();
    this.queue = [];
    this.built = 0;
    this.focus = [0, 0];
    this.nightFactor = 0;
    this.sigLights = null;

    // W1-04 round 3 — THE TOWNS. `setSettlements()` fills these; until it is called the province
    // is exactly what it was, which is what makes the control arm below a one-line cut.
    this.settlementPlans = [];
    /**
     * THE CONTROL ARM, and it is not a debug flag.
     *
     * RULES.md #6 and the round-1 verdict's acceptance both require the identical run with the
     * draw call cut to come back at zero. Setting this to `false` and re-requesting the tiles is
     * that cut: the plans are still read, the collision set is still derived, and NOTHING is
     * added to the scene graph. A probe that cannot produce the before-picture on demand is
     * measuring its own optimism.
     */
    this.drawBuildings = true;
    this.buildingsDrawn = 0;
    this.buildingSummary = null;

    // THE STREAMING SETTINGS, AS FIELDS AND NOT AS MODULE CONSTANTS.
    //
    // Two reasons, and neither is style. (1) `Engine._streamProvince()` reads `tileM` once per
    // fixed step to decide whether the ground under the player exists yet, and the only other way
    // to get it out of here was `stats()`, which traverses the whole scene graph and allocates.
    // (2) RI-MTH07 consumption: a claim that the streamer is what builds the world underneath a
    // walking player is only a claim until you can PERTURB the streamer and watch the built world
    // change. A module-level `const` cannot be perturbed from outside, so the consumption check
    // could not be written at all — and an instrument that cannot be made to go red is the failure
    // mode AGENT-PROTOCOL names twice.
    this.tileM = TILE_M;
    this.radiusTiles = RADIUS;
    this.skinRadiusM = SKIN_RADIUS_M;
    this.lodBands = Object.freeze({ nearM: NEAR_RADIUS_M, detailedTileM: TILE_M * (RADIUS + 0.5), farM: 6400, hysteresisTiles: 1 });

    this.mats = {
      ground: worldMaterial('mud',{ vertexColors:true }),
      far: worldMaterial('mud',{ vertexColors:true,roughness:.97,bumpScale:.08,lod:'far' }),
      farWater: worldMaterial('water',{ color:0x33454a,transparent:true,opacity:.92,lod:'far' }),
    };
    this.regionMats = field.regions.map((r) => ({
      water: worldMaterial('water',{
        // Keep regional hue, but never let a near-black land swatch turn the water into an
        // unreflective hole. Sky/fog intrusion is the physical ambient source at this scale.
        color: c3(r.palette_hex[0]).lerp(c3(r.fog.colour), 0.66),
        roughness: clamp(0.06 + (r.water.k || 1) * 0.03, 0.05, 0.28),
        metalness: 0.42, transparent: true,
        opacity: clamp(0.62 + (r.water.k || 1) * 0.08, 0.6, 0.96),
      }),
      trunk: worldMaterial('bark',{ color: c3(r.props.canopy.trunk), roughness: 0.95 }),
      crown: worldMaterial('leaf',{ color:c3(r.props.canopy.colour),roughness:.78,
        side:THREE.DoubleSide,emissive:c3(r.props.canopy.colour).multiplyScalar(.12),emissiveIntensity:.18 }),
      under: worldMaterial('reed',{ color: c3(r.props.under.colour), roughness: 0.86,
        side: THREE.DoubleSide }),
      rock: worldMaterial('stone',{ color: c3(r.props.rock.colour), roughness: 0.80 }),
      cover: worldMaterial(r.props.cover.shape === 'wax' ? 'resin' : 'leaf',{
        color: c3(r.props.cover.colour),
        roughness: r.props.cover.shape === 'flake' || r.props.cover.shape === 'wax' ? 0.55 : 0.95,
        side: r.props.cover.shape === 'reed' || r.props.cover.shape === 'litter' ? THREE.DoubleSide : THREE.FrontSide,
      }),
    }));
    this.geoCache = new Map();

    this._buildFar();
  }

  /**
   * Bind art-direction boards to the actual regional material sets.  This deliberately annotates
   * render resources rather than copying colours: regions.json remains spatial authority while
   * the board supplies material/silhouette/weirdness intent for census and live perturbation.
   */
  setVisualStyleboards(boards) {
    this.visualStyleboards = boards;
    const used = new Set();
    for (let i = 0; i < this.field.regions.length; i++) {
      const region = this.field.regions[i], board = boards.regions.get(region.id);
      if (!board) throw new Error(`W1-30 styleboard has no production region '${region.id}'`);
      used.add(region.id);
      const M=this.regionMats[i];
      consumeStyleboard(M.water,board,'dominant'); consumeStyleboard(M.trunk,board,'secondary');
      consumeStyleboard(M.crown,board,'contrast'); consumeStyleboard(M.under,board,'secondary');
      consumeStyleboard(M.rock,board,'contrast'); consumeStyleboard(M.cover,board,'dominant');
    }
    this._buildStyleboardLandmarks();
    this.group.userData.visualStyleboards = { regions: [...used].sort(), settlements: [...boards.settlements.keys()].sort() };
    return this.group.userData.visualStyleboards;
  }

  /** One unmistakable authored silhouette per region, readable in the far mesh and made only
   * from pooled procedural geometry. Its branching, lean, crown and material are board-driven. */
  _buildStyleboardLandmarks() {
    if (this.styleboardLandmarks) this.group.remove(this.styleboardLandmarks);
    const root=new THREE.Group(); root.name='w1-30-styleboard-landmarks';
    for (let i=0;i<this.field.regions.length;i++) {
      const r=this.field.regions[i], b=this.visualStyleboards.regions.get(r.id);
      const [cx,cz]=r.centroid_m, seed=[...b.silhouette_motif].reduce((a,c)=>a+c.charCodeAt(0),0);
      // Canonical region cameras sit on the centroid. Place the hero in their middle distance,
      // never around the lens (the first live capture correctly exposed that concrete defect).
      const a=(seed%360)*Math.PI/180, x=cx+Math.cos(a)*72, z=cz+Math.sin(a)*72, y=this.field.heightAt(x,z);
      const g=new THREE.Group(); g.name=`style-landmark:${r.id}:${b.silhouette_motif}`;
      const main=worldMaterial(b.dominant_materials[1],{color:0xffffff});
      const accent=worldMaterial(b.contrast_material,{color:0xffffff,emissive:seed%3===0?0x183f32:0x000000,emissiveIntensity:.55});
      consumeStyleboard(main,b,'secondary'); consumeStyleboard(accent,b,'contrast');
      const height=16+(seed%13), arms=3+(seed%4);
      for(let n=0;n<arms;n++) {
        const h=height*(.58+n/arms*.42), stem=new THREE.Mesh(new THREE.CylinderGeometry(.28+.08*n,1.25-n*.09,h,6),main);
        stem.position.set((n-arms/2)*1.15,h/2,Math.sin(seed+n)*1.5); stem.rotation.z=(n-arms/2)*.075; stem.castShadow=stem.receiveShadow=true; g.add(stem);
        const crown=new THREE.Mesh(new THREE.IcosahedronGeometry(1.5+n*.22,1),accent);
        crown.scale.set(1.8,.38+((seed+n)%4)*.13,1); crown.position.set(stem.position.x,h,stem.position.z); crown.castShadow=true; g.add(crown);
      }
      g.position.set(x,y,z); g.userData.styleboard={id:b.id,inexplicable_element:b.inexplicable_element,visible:true}; root.add(g);
    }
    this.styleboardLandmarks=root; this.group.add(root);
  }

  _settlementStyleboard(g, plan) {
    const b=this.visualStyleboards?.settlements.get(plan.id); if(!b) return;
    let index=0; g.traverse(o=>{ if(!o.isMesh||!o.material)return;const role=index++%5===0?'contrast':index%2?'dominant':'secondary';let rows=STYLE_MATERIAL_CACHE.get(o.material);if(!rows){rows=new Map();STYLE_MATERIAL_CACHE.set(o.material,rows);}const key=`${b.id}:${role}`;if(!rows.has(key)){const styled=o.material.clone();consumeStyleboard(styled,b,role,.72);rows.set(key,styled);}o.material=rows.get(key); });
    const mat=worldMaterial(b.contrast_material,{emissive:0x24180f,emissiveIntensity:.45}); consumeStyleboard(mat,b,'contrast');
    const main=worldMaterial(b.dominant_materials[1],{color:0xffffff});consumeStyleboard(main,b,'secondary');
    const weird=new THREE.Group(); weird.name=`inexplicable:${plan.id}:${b.inexplicable_element}`;
    const seed=[...b.inexplicable_element].reduce((a,c)=>a+c.charCodeAt(0),0), H=6+seed%5;
    // A landmark needs mass, attachment and a silhouette. Five floating toruses were metadata
    // visualised as debug geometry. This rooted reliquary keeps the deterministic board-derived
    // identity, but reads as an object built by the settlement.
    const plinth=new THREE.Mesh(new THREE.CylinderGeometry(1.15,1.55,.7,10),main);plinth.position.y=.35;plinth.castShadow=plinth.receiveShadow=true;weird.add(plinth);
    for(let i=0;i<3;i++){
      const stem=new THREE.Mesh(new THREE.CylinderGeometry(.16+i*.035,.42-i*.045,H*(.74+i*.10),8),main);
      stem.position.set((i-1)*.42,H*(.37+i*.05),Math.sin(seed+i)*.28);stem.rotation.z=(i-1)*-.07;stem.castShadow=true;weird.add(stem);
    }
    for(let i=0;i<3;i++){
      const y=1.5+i*H*.23,w=.72+i*.28,curve=new THREE.CubicBezierCurve3(new THREE.Vector3(-w,y,0),new THREE.Vector3(-w*.52,y+1.15+i*.12,.25*(i-1)),new THREE.Vector3(w*.38,y+1.35,-.18*(i-1)),new THREE.Vector3(w,y+.12,0));
      const rib=new THREE.Mesh(new THREE.TubeGeometry(curve,14,.075+i*.015,7,false),mat);rib.rotation.y=(seed%7)*.06+i*.22;rib.castShadow=true;weird.add(rib);
    }
    const crown=new THREE.Mesh(new THREE.DodecahedronGeometry(.65,1),mat);crown.position.set(0,H+.25,0);crown.scale.set(.72,1.35,.72);crown.castShadow=true;weird.add(crown);
    const [x,,z]=plan.pos; weird.position.set(x,this._meshY(x,z),z); weird.userData.styleboard={id:b.id,visible:true}; g.add(weird);
  }

  // ---- the whole province, coarse ------------------------------------------------------------
  _buildFar() {
    const f = this.field;
    const geo = new THREE.PlaneGeometry(f.sizeX, f.sizeZ, FAR_SEG_X, FAR_SEG_Z);
    geo.rotateX(-Math.PI / 2);
    geo.translate(f.sizeX / 2, 0, f.sizeZ / 2);
    const pos = geo.attributes.position;
    const col = new Float32Array(pos.count * 3);
    const tmp = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const x = clamp(pos.getX(i), 0, f.sizeX - 0.01), z = clamp(pos.getZ(i), 0, f.sizeZ - 0.01);
      const h = f.baseAt(x, z);
      pos.setY(i, h - 0.6);
      this._groundColour(x, z, h, tmp);
      col[i * 3] = tmp.r; col[i * 3 + 1] = tmp.g; col[i * 3 + 2] = tmp.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    // World-space texel density keeps the 96px material frequency continuous across 300 m
    // tiles. Default 0..1 plane UVs magnified broad cells into giant contour bands.
    const uv=geo.attributes.uv;
    for(let i=0;i<pos.count;i++) uv.setXY(i,pos.getX(i)/3,pos.getZ(i)/3);
    uv.needsUpdate=true;
    geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, this.mats.far);
    mesh.name = 'province-far';
    mesh.receiveShadow = false;
    this.group.add(mesh);

    const sea = new THREE.Mesh(new THREE.PlaneGeometry(f.sizeX + 2400, f.sizeZ + 2400, 1, 1).rotateX(-Math.PI / 2), this.mats.farWater);
    sea.position.set(f.sizeX / 2, 0, f.sizeZ / 2);
    sea.name = 'province-sea';
    this.group.add(sea);
    this.farMesh = mesh;
    this.seaMesh = sea;
  }

  /**
   * Ground albedo at a point. Region material first, then the two things that must modulate it or
   * the terrain reads as a painted LUT: wetness under standing water, and rock exposed by slope.
   */
  _groundColour(x, z, h, out) {
    const f = this.field;
    // W1-02 / RI-WLD12 §2. The PALETTE axis, not the raster. Ground and flora cross first — "they
    // are the terrain" — so inside a border band the ground has already become the far region
    // while its trees, its buildings and its ONLY-HERE element are still the near one's. This one
    // substitution is half of what makes a border a transition rather than a line: the material
    // under your feet changes tens of metres before anything standing on it does.
    const ri = f.axisRegionIndexAt(x, z, 'palette');
    const r = f.regions[ri];
    const art = regionArt(r.id);
    out.set(r.ground.albedo);
    // Each REGION_ART terrain/depth row drives a different two-scale surface frequency and
    // material response.  This is visible on every terrain vertex, including flora-free views;
    // replacing a terrain/depth token changes the rendered colour buffer rather than userData.
    const terrainKey=[...art.terrain].reduce((n,c)=>(n*33+c.charCodeAt(0))>>>0,5381);
    const depthKey=[...art.depth].reduce((n,c)=>(n*31+c.charCodeAt(0))>>>0,7);
    const coarse=10+(terrainKey%29), fine=2.8+(depthKey%47)/10;
    const mottle = (noise2(x / coarse, z / coarse, 4111+(terrainKey%997)) - 0.5) * (0.12+(terrainKey%7)*.012)
      + (noise2(x / fine, z / fine, 4127+(depthKey%991)) - 0.5) * (0.055+(depthKey%5)*.012);
    out.offsetHSL(0, 0, mottle);
    out.offsetHSL(((terrainKey%13)-6)*.0025,((depthKey%9)-4)*.012,0);
    // MATERIAL FOLLOWS LANDFORM. A crest drains and a hollow holds water, so the ground is paler
    // on the one and darker on the other — in every real landscape, and now in this one. Without
    // this the micro-relief is only a normal, and a 0.8 m bank over 5 m changes Lambert shading by
    // a couple of per cent: the paddy bunds were in the collision surface and invisible in the
    // frame. Driven by the SAME field `heightAt` uses, scaled by the region's own amplitude, so it
    // is a response to shape and not a second tint.
    const amp = (r.terrain.micro && r.terrain.micro.amp_m) || 0;
    if (amp > 0) {
      const t = clamp(f.micro.at(x, z) / (amp * 1.7), -1, 1);
      // Relief already changes normals and shadows. A 31%-wide albedo swing turned valid paddy
      // bunds into fluorescent contour stripes; retain drained/wet material response at a scale
      // found in soil rather than exposing the scalar field as false colour.
      out.offsetHSL(0, -0.045 * t, 0.065 * t);
    }
    // Slope strips the cover off and shows what is underneath. The comment this replaces promised
    // "rock exposed by slope" and nothing did it.
    const sl = f.slopeAt(x, z, 4);
    if (sl > 20) out.lerp(c3(r.props.rock.colour), clamp((sl - 20) / 34, 0, 0.62));
    const d = f.depthAt(x, z);
    if (d > 0) out.lerp(c3(r.palette_hex[0]).multiplyScalar(0.42), clamp(0.30 + d * 0.55, 0, 0.88));
    // Region hue remains authoritative, but production soil is not an emissive false-colour map.
    // Bound saturation/value after all semantic blends so daylight retains material information.
    const hsl={h:0,s:0,l:0};out.getHSL(hsl);out.setHSL(hsl.h,Math.min(.34,hsl.s*.66),Math.min(.38,hsl.l*.88));
    return out;
  }

  // ---- streaming ------------------------------------------------------------------------------
  key(tx, tz) { return `${tx},${tz}`; }

  /** Ask for the tiles around (x, z); returns the number still queued. */
  request(x, z) {
    this.focus = [x, z];
    this.updateSkin(x, z);
    this.updateNear(x, z);
    this.updateCover(x, z);
    if (this.nightFactor > 0) this.updateSignatureLights(x, z);
    const tx0 = Math.floor(x / TILE_M), tz0 = Math.floor(z / TILE_M);
    const RADIUS = this.radiusTiles;
    const want = new Set();
    for (let dz = -RADIUS; dz <= RADIUS; dz++) {
      for (let dx = -RADIUS; dx <= RADIUS; dx++) {
        const tx = tx0 + dx, tz = tz0 + dz;
        if (tx < 0 || tz < 0 || tx * TILE_M >= this.field.sizeX || tz * TILE_M >= this.field.sizeZ) continue;
        want.add(this.key(tx, tz));
        if (!this.tiles.has(this.key(tx, tz)) && !this.queue.some((q) => q.k === this.key(tx, tz))) {
          this.queue.push({ k: this.key(tx, tz), tx, tz, d: dx * dx + dz * dz });
        }
      }
    }
    this.queue.sort((a, b) => a.d - b.d);
    // RELEASE ON A WIDER RING THAN YOU BUILD ON. Releasing the moment a tile leaves `want` was
    // harmless while `request()` only ran on a teleport, and is a thrash the moment it runs from
    // the fixed step: a body standing on a tile EDGE — a road that runs along one, a fight, a
    // shoreline, anywhere the position oscillates by a couple of metres — flips `tx0` back and
    // forth, and each flip released a five-tile row and rebuilt it. Measured before this existed:
    // 30 tile builds for 26.9 m of movement, 92 steps over one 60 Hz frame in 30,000. One tile of
    // hysteresis costs at most 49 resident tiles instead of 25 and makes the churn impossible,
    // because a tile has to be pushed a full 300 m past the build ring before it is dropped.
    const KEEP = RADIUS + 1;
    for (const [k, t] of this.tiles) {
      if (Math.abs(t.tx - tx0) > KEEP || Math.abs(t.tz - tz0) > KEEP) this._release(k, t);
    }
    this.queue = this.queue.filter((q) => want.has(q.k));
    return this.queue.length;
  }



  /**
   * The height of the DRAWN ground at a point: `heightAt` sampled on the terrain mesh's own grid
   * and bilinearly interpolated, exactly as the rasteriser interpolates the tile's triangles.
   *
   * Props must stand on this and not on `heightAt`, and the reason is measured. A petrified bole
   * is a 3.4 m column and a comb cliff is a stepped terrace; the tile mesh samples the ground
   * every 5.36 m and cannot resolve either, so `heightAt` and the surface actually shown disagree
   * by up to 6.80 m in the Stone Forest and 2.61 m in the Hive. Placing a prop at `heightAt` in
   * that neighbourhood leaves it hanging in the air — which is what a rock and a dozen wax cell
   * rims were doing above the Hive skyline before this existed. Collision still uses `heightAt`;
   * what changes is only where a decoration is drawn, and it is drawn on the ground you see.
   */
  _meshY(x, z) {
    const G = TILE_M / TILE_SEG;
    const f = this.field;
    const cache = this._meshCache || (this._meshCache = new Map());
    const at = (i, j) => {
      const k = i * 1000003 + j;
      let v = cache.get(k);
      if (v === undefined) {
        const px = i * G, pz = j * G;
        v = f.onDeckAt(px, pz) ? f.bareHeightAt(px, pz) : f.heightAt(px, pz);
        if (cache.size > 200000) cache.clear();
        cache.set(k, v);
      }
      return v;
    };
    const i = Math.floor(x / G), j = Math.floor(z / G);
    const tx = x / G - i, tz = z / G - j;
    const a = at(i, j) + (at(i + 1, j) - at(i, j)) * tx;
    const b = at(i, j + 1) + (at(i + 1, j + 1) - at(i, j + 1)) * tx;
    return a + (b - a) * tz;
  }

  /**
   * GROUND COVER — the ordinary underfoot material, in a disc around the camera.
   *
   * This is the layer the province did not have, and it is the one that decides what most of a
   * frame is made of: black leaf mulch in drifts, curled clay plates on a fired pan, barnacle
   * shell hash, wax cell rims, limestone scree, paddy stubble in rows. Verdict W1-01 round 2
   * scored the blind test 4/8 and wrote of the Deep Marshes frame that it was "a bright green
   * lawn with ball-canopy trees and small green cones" — a lawn is exactly what a world with no
   * ground cover renders as.
   *
   * It follows the CAMERA, not the tile grid, and that is a measurement rather than a preference.
   * A carpet dense enough to read (one object per three to sixteen square metres) over the 2.25
   * km2 of resident tiles is a quarter of a million instances and the software rasteriser will
   * not draw it. Over a 70 m disc it is two to five thousand, it is drawn, and beyond 70 m the
   * ground cover of a real landscape is not resolvable either — it is a tone, which is what the
   * ground mesh's own vertex colour already is.
   *
   * Density (`per100m2`) and patchiness (`patch_m`) are per region and differ five- and seven-fold
   * across the thirteen, so the spacing statistics differ before the shape is even chosen.
   */
  updateCover(x, z) {
    if (this.coverAt && Math.hypot(x - this.coverAt[0], z - this.coverAt[1]) < COVER_REBUILD_M) return 0;
    this.coverAt = [x, z];
    if (this.coverGroup) {
      this.group.remove(this.coverGroup);
      // Nothing to dispose: the cover geometry is one cached object per region, shared with every
      // future rebuild. Disposing it here re-uploaded it on the next frame, every fourteen metres.
    }
    const f = this.field;
    const g = new THREE.Group();
    g.name = 'ground-cover';
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), s = new THREE.Vector3();
    const up = new THREE.Vector3(0, 1, 0);
    const buckets = new Map();
    const step = COVER_LATTICE_M;
    const cellArea = step * step;
    const n = Math.ceil(COVER_RADIUS_M / step);
    const gx0 = Math.floor((x - COVER_RADIUS_M) / step), gz0 = Math.floor((z - COVER_RADIUS_M) / step);
    let considered = 0;
    for (let iz = 0; iz <= n * 2; iz++) {
      for (let ix = 0; ix <= n * 2; ix++) {
        const cx = gx0 + ix, cz = gz0 + iz;
        const px = (cx + hash2(cx, cz, 6301)) * step;
        const pz = (cz + hash2(cx, cz, 6307)) * step;
        const d = Math.hypot(px - x, pz - z);
        if (d > COVER_RADIUS_M) continue;
        if (px < 0 || pz < 0 || px >= f.sizeX || pz >= f.sizeZ) continue;
        if (!f.isLandAt(px, pz)) continue;
        // Streets, yards and threshold approaches need negative space.  Previously the regional
        // carpet was stamped through the complete settlement plan, so doors and roads vanished
        // under the same wilderness density as the surrounding marsh.
        if (this.settlementAt(px,pz,8)) continue;
        considered++;
        const ri = f.regionIndexAt(px, pz);
        const r = f.regions[ri];
        const cv = r.props.cover;
        if (!cv) continue;
        // Patchiness: cover drifts, it does not carpet uniformly. `patch_m` is the drift scale.
        const patch = 0.30 + 1.70 * smoothstep(0.40, 0.62, fbm(px / cv.patch_m, pz / cv.patch_m, 6311, 3));
        // Thin out over the last 15 m so the disc has no visible edge.
        const fade = 1 - smoothstep(COVER_RADIUS_M - 15, COVER_RADIUS_M, d);
        const a = arrangeAt(f, px, pz, r.props.arrangement, 0.45);
        const t = cv.per100m2 * patch * a * fade * cellArea / 100;
        if (hash2(cx, cz, 6313) >= t) continue;
        // Same rule as the props: shell hash does not lie under 40 cm of water, but a 0.55 m
        // reed stands in it.
        if (f.depthAt(px, pz) > Math.max(0.12, cv.h * 0.75)) continue;
        let b = buckets.get(ri);
        if (!b) { b = { ri, geo: this._geo('cover', r), mat: this.regionMats[ri].cover, xf: [] }; buckets.set(ri, b); }
        if (b.xf.length >= MAX_COVER) continue;
        q.setFromAxisAngle(up, hash2(cx, cz, 6317) * Math.PI * 2);
        v.set(px, this._meshY(px, pz) - 0.03 + this._skinLift(px, pz), pz);
        s.setScalar(0.62 + hash2(cx, cz, 6319) * 0.86);
        m.compose(v, q, s);
        b.xf.push(m.clone());
      }
    }
    let total = 0;
    for (const b of buckets.values()) {
      if (!b.xf.length) continue;
      const im = new THREE.InstancedMesh(b.geo, b.mat, b.xf.length);
      for (let i = 0; i < b.xf.length; i++) im.setMatrixAt(i, b.xf[i]);
      im.instanceMatrix.needsUpdate = true;
      im.castShadow = false; im.receiveShadow = true;
      im.name = `cover:${f.regions[b.ri].id}`;
      g.add(im);
      total += b.xf.length;
    }
    this.group.add(g);
    this.coverGroup = g;
    this.coverCount = total;
    this.coverConsidered = considered;
    return total;
  }

  /**
   * THE GROUND SKIN — the ordinary underfoot surface, as geometry, in a patch around the camera.
   *
   * This is the layer that decides what the bottom half of every frame is made of, and until it
   * existed the bottom half of every frame was a smooth untextured plane in all thirteen regions.
   * Measured over round 4's own 39 day frames, Sobel edge density in the bottom quarter of the
   * image carried a between-region to within-region ratio of 0.91 — no regional signal at all,
   * in the part of the picture there is most of.
   *
   * Why here and not in the tile mesh: the tile mesh is 5.36 m per quad and a fen's tussocks are
   * 1.15 m apart. Why here and not in `heightAt`: `groundskin.js` gives the arithmetic — as
   * collision it would put 51-degree gradients through a 40-degree walkable gate and fence the
   * province. Why a mesh and not more instances: 12,100 quads in one draw call is cheaper on the
   * software rasteriser than the two to five thousand separate ground-cover instances already
   * are, and a continuous surface is what a ground surface is.
   *
   * The patch is anchored to a world lattice, not to the camera, so it does not swim when it is
   * rebuilt; the amplitude and the tone both taper to zero over the last 14 m so there is no
   * visible rim; and the whole thing sits at `meshY + 0.012 + rise`, where `rise >= 0` by
   * construction, so it can never z-fight the tile ground it lies on.
   */
  updateSkin(x, z) {
    const f = this.field;
    if (!f.skin || !f.skin.any) return 0;
    if (this.skinAtPos && Math.hypot(x - this.skinAtPos[0], z - this.skinAtPos[1]) < SKIN_REBUILD_M) return 0;
    this.skinAtPos = [x, z];
    if (this.skinMesh) {
      this.group.remove(this.skinMesh);
      this.skinMesh.geometry.dispose();
      this.skinMesh = null;
    }
    const C = SKIN_CELL_M, R = this.skinRadiusM;
    const x0 = Math.floor((x - R) / C) * C, z0 = Math.floor((z - R) / C) * C;
    const N = Math.ceil((2 * R) / C);                    // quads per side
    const V = N + 1;                                     // vertices per side
    // Base ground colour and water depth are sampled on a COARSE sub-lattice and interpolated:
    // `_groundColour` calls `slopeAt` (four height queries) and `depthAt`, and running that at
    // every one of 12,544 vertices is a tenth of a second on its own. Every third vertex is
    // 1.0 m -> 3.0 m, which is finer than the 5.36 m the tile ground itself is coloured at.
    const S = 3;
    const CV = Math.ceil(N / S) + 1;
    const cc = new Float32Array(CV * CV * 4);
    const tmp = new THREE.Color();
    for (let j = 0; j < CV; j++) {
      for (let i = 0; i < CV; i++) {
        const px = clamp(x0 + i * S * C, 0, f.sizeX - 0.01), pz = clamp(z0 + j * S * C, 0, f.sizeZ - 0.01);
        this._groundColour(px, pz, this._meshY(px, pz), tmp);
        const k = (j * CV + i) * 4;
        cc[k] = tmp.r; cc[k + 1] = tmp.g; cc[k + 2] = tmp.b; cc[k + 3] = f.depthAt(px, pz);
      }
    }
    const coarse = (px, pz, out) => {
      const u = (px - x0) / (S * C), v = (pz - z0) / (S * C);
      const i = Math.min(CV - 2, Math.max(0, Math.floor(u))), j = Math.min(CV - 2, Math.max(0, Math.floor(v)));
      const tu = Math.min(1, Math.max(0, u - i)), tv = Math.min(1, Math.max(0, v - j));
      let depth = 0;
      for (let c = 0; c < 4; c++) {
        const a = cc[(j * CV + i) * 4 + c] + (cc[(j * CV + i + 1) * 4 + c] - cc[(j * CV + i) * 4 + c]) * tu;
        const b = cc[((j + 1) * CV + i) * 4 + c] + (cc[((j + 1) * CV + i + 1) * 4 + c] - cc[((j + 1) * CV + i) * 4 + c]) * tu;
        const val = a + (b - a) * tv;
        if (c === 3) depth = val; else out[c] = val;
      }
      return depth;
    };

    const skinAmp = (px, pz) => {
      const sk = f.regions[f.regionIndexAt(px, pz)].terrain.skin;
      return (sk && sk.amp_m) || 0.2;
    };
    const pos = new Float32Array(V * V * 3);
    const col = new Float32Array(V * V * 3);
    const skinUv = new Float32Array(V * V * 2);
    const rgb = [0, 0, 0];
    const cH = new THREE.Color();
    let live = 0;
    for (let j = 0; j < V; j++) {
      for (let i = 0; i < V; i++) {
        const px = x0 + i * C, pz = z0 + j * C;
        const k = (j * V + i) * 3;
        const cx = clamp(px, 0, f.sizeX - 0.01), cz = clamp(pz, 0, f.sizeZ - 0.01);
        const d = Math.hypot(px - x, pz - z);
        // Taper at the rim, and lie flat under water: a tussock under 40 cm of black water is a
        // shape the water mesh hides, and pushing the skin up through it makes an island.
        const depth = coarse(cx, cz, rgb);
        // Water: a tussock STANDS OUT of the fen it grows in — that is what a tussock is — so the
        // surface is not suppressed until the water is deeper than the surface is tall. Fading it
        // at a fixed 0.05 m (which is what this did first) deleted the Deep Marshes' whole ground
        // character, because the Deep Marshes are under water.
        const amp = skinAmp(cx, cz);
        const fade = (1 - smoothstep(R - SKIN_FADE_M, R, d)) * (1 - smoothstep(amp * 0.9, amp * 2.8 + 0.2, depth));
        let rise = 0, tone = 0;
        if (fade > 0.002) {
          const [hh, tt] = f.skin.at(cx, cz);
          rise = hh * fade; tone = tt * fade;
          if (rise > 0.004) live++;
        }
        pos[k] = px; pos[k + 1] = this._meshY(cx, cz) + 0.012 + rise; pos[k + 2] = pz;
        skinUv[(j*V+i)*2]=px/3;skinUv[(j*V+i)*2+1]=pz/3;
        cH.setRGB(rgb[0], rgb[1], rgb[2]);
        // The material's own response to its own shape. A normal alone is not enough: 0.2 m over
        // 1 m under an overcast sky moves Lambert shading by a couple of per cent, which is how
        // the micro-relief came to be in the collision surface and invisible in the frame.
        if (tone !== 0) cH.offsetHSL(0, -0.025 * tone, 0.065 * tone);
        col[k] = cH.r; col[k + 1] = cH.g; col[k + 2] = cH.b;
      }
    }
    if (!live) return 0;
    const idx = new Uint32Array(N * N * 6);
    let n = 0;
    for (let j = 0; j < N; j++) {
      for (let i = 0; i < N; i++) {
        const a = j * V + i, b = a + 1, c = a + V, dd = c + 1;
        idx[n++] = a; idx[n++] = c; idx[n++] = b;
        idx[n++] = b; idx[n++] = c; idx[n++] = dd;
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.setAttribute('uv',new THREE.BufferAttribute(skinUv,2));
    geo.setIndex(new THREE.BufferAttribute(idx, 1));
    geo.computeVertexNormals();
    this.skinMats = this.skinMats || worldMaterial('mud',{vertexColors:true,roughness:.95,bumpScale:.06});
    this.skinMats.polygonOffset=true;this.skinMats.polygonOffsetFactor=-1;this.skinMats.polygonOffsetUnits=-1;
    const mesh = new THREE.Mesh(geo, this.skinMats);
    mesh.name = 'ground-skin';
    mesh.receiveShadow = true;
    mesh.castShadow = false;
    this.group.add(mesh);
    this.skinMesh = mesh;
    this.skinVerts = V * V;
    // The ground cover stands ON this surface, so it has to be rebuilt with it or a shell hash
    // sits 0.3 m inside a berm. Cheaper than making the two discs share a lattice, and exact.
    this.coverAt = null;
    return V * V;
  }

  /**
   * The lift the ground-skin mesh applied at a point — zero outside the patch, tapered at its rim.
   *
   * Anything that stands on the ground has to stand on the ground that is DRAWN, and inside the
   * skin patch that is no longer `_meshY`. Same taper, same water rule, so a cobble on a berm
   * crest is on the crest and a cobble ten metres past the rim is on the plain.
   */
  _skinLift(px, pz) {
    const f = this.field;
    if (!this.skinMesh || !f.skin || !f.skin.any) return 0;
    const d = Math.hypot(px - this.skinAtPos[0], pz - this.skinAtPos[1]);
    // Read the SAME radius `updateSkin` built with (`this.skinRadiusM`, not the module constant),
    // or perturbing the skin radius would move the drawn patch and leave every prop lifted onto
    // the old one — a consumption knob that half-applies is worse than none.
    if (d >= this.skinRadiusM) return 0;
    const sk = f.regions[f.regionIndexAt(px, pz)].terrain.skin;
    const amp = (sk && sk.amp_m) || 0.2;
    const fade = (1 - smoothstep(this.skinRadiusM - SKIN_FADE_M, this.skinRadiusM, d))
      * (1 - smoothstep(amp * 0.9, amp * 2.8 + 0.2, f.depthAt(px, pz)));
    if (fade <= 0.002) return 0;
    return f.skin.at(px, pz)[0] * fade + 0.012;
  }

  /**
   * Place the three prop layers at ONE site, at the given already-arranged densities.
   *
   * Shared by the tile scatter and the near-field disc, so a Blackwood hardwood is the same
   * hardwood whichever layer drew it — same height variance, same lean, same emergent rule.
   * `dens` is per 100 m2 AFTER the arrangement field and any thinning; `rolls` are four uniform
   * draws in [0,1); `cellArea` the square metres this site stands for.
   */
  _placeSite(buckets, tag, ri, x, z, y, cellArea, dens, rolls, cap) {
    const f = this.field;
    const r = f.regions[ri];
    const p = r.props;
    const art = regionArt(r.id);
    const depth = f.depthAt(x, z);
    const m = this._m || (this._m = new THREE.Matrix4());
    const q = this._q || (this._q = new THREE.Quaternion());
    const qt = this._qt || (this._qt = new THREE.Quaternion());
    const v = this._v || (this._v = new THREE.Vector3());
    const s = this._s || (this._s = new THREE.Vector3());
    const side = this._side || (this._side = new THREE.Vector3());
    const up = this._up || (this._up = new THREE.Vector3(0, 1, 0));
    const push = (kind, geoKind, mat, scale, yOff, tilt, rotSeed) => {
      const key = `${tag}:${kind}:${geoKind}:${ri}`;
      let b = buckets.get(key);
      if (!b) { b = { kind, ri, mat, geo: this._geo(geoKind, r), xf: [] }; buckets.set(key, b); }
      if (b.xf.length >= cap[kind]) return false;
      q.setFromAxisAngle(up, noise2(x, z, rotSeed) * Math.PI * 2);
      if (tilt) { side.set(Math.cos(tilt.a), 0, Math.sin(tilt.a)); qt.setFromAxisAngle(side, tilt.t); q.multiply(qt); }
      const layer = kind === 'canopy' ? art.flora[0] : kind === 'under' ? art.flora[1] : art.flora[2];
      v.set(x, y + yOff, z); s.set(scale * layer, scale * (0.82 + layer * .18), scale / Math.sqrt(layer));
      m.compose(v, q, s);
      b.xf.push(m.clone());
      b.geo.userData.worldArt={region:r.id,terrain:art.terrain,depth:art.depth,layer};
      return true;
    };
    // EMERGENT VEGETATION. The depth a plant will stand in is a property of the plant, not a
    // constant: a 13 m drowned spire roots in two metres of water and a 0.25 m lichen crust roots
    // in none. Round 4 gated both at a flat 0.9 m and 0.6 m, which is why the Deep Marshes — 86%
    // wet, the region whose whole identity is a reed bed over black water — rendered as an empty
    // sheet of water with the reeds standing on whatever dry ground it could find.
    // Keep the arrival/camera footprint legible when a tile is first streamed. The capture audit
    // found a valid walkable sample completely enclosed by a trunk; vegetation may frame a path,
    // but production composition cannot put opaque canopy geometry on the active arrival point.
    const arrivalClear=Math.hypot(x-this.focus[0],z-this.focus[1])>=2.4;
    const settlementClear=!this.settlementAt(x,z,8);
    if (settlementClear && arrivalClear && p.canopy.shape !== 'none' && depth < Math.max(0.9, p.canopy.h * 0.16) && rolls[0] < dens.canopy * cellArea / 100) {
      // Height variance and the occasional emergent: the vertical-structure axis, in data.
      const hv = p.canopy.h_var || 0;
      let sc = 0.72 + noise2(x * 3.1, z * 3.1, 7793) * 0.66;
      sc *= 1 + hv * (noise2(x * 1.7, z * 1.7, 7799) - 0.5) * 2;
      const em = p.canopy.emergent;
      if (em && rolls[3] < em.share) sc *= em.h_mult;
      const lean = (p.canopy.lean_deg || 0) * art.lean * Math.PI / 180;
      const tilt = lean > 0
        ? { a: noise2(x * 0.9, z * 0.9, 7803) * Math.PI * 2, t: lean * (noise2(x * 1.3, z * 1.3, 7807) - 0.5) * 2 }
        : null;
      if (push('canopy', 'trunk', this.regionMats[ri].trunk, sc, 0, tilt, 7789)) {
        // WHERE THE CROWN SITS. A crown parked at 0.86 of the plant's height is right for a tree
        // and wrong for a bush: the Clay Moor declares a 4 m dome of 3.2 m radius — wider than it
        // is tall, which is what clay scrub IS — and lifting it to 3.4 m over a stem sized off the
        // trunk rule drew a mushroom. Two regions then shared one silhouette, because the Stone
        // Forest's 12 m petrified column with a 2.2 m cap is also a dark cap on a thin stem, and
        // under a colour-stripped test a mushroom is a mushroom. A canopy broader than it is tall
        // sits ON the ground and its stem is inside it.
        // A `dome` is authored as the UPPER hemisphere with its flat face at y = 0, so a bush
        // built from one sits on the ground at offset 0; a `sphere` is centred, so it sits at
        // three quarters of its radius with the bottom quarter buried, which is what a shrub
        // does. Lifting either to 0.86 of the plant's height — the tree rule — put a 3.2 m cap
        // on a 0.15 m stem and drew a mushroom.
        const bushy = p.canopy.r * 2 > p.canopy.h && p.canopy.shape !== 'arch';
        const crownY = bushy
          ? Math.max(p.canopy.r*.65,p.canopy.h*.16)*sc
          : p.canopy.h * sc * (p.canopy.shape === 'arch' ? 0.5 : 0.86);
        push('canopy', 'crown', this.regionMats[ri].crown, sc, crownY, tilt, 7797);
      }
    }
    if (settlementClear && arrivalClear && rolls[1] < dens.under * cellArea / 100 && depth < Math.max(0.25, p.under.h * 0.80)) {
      // Tall marsh blades are accents, not walls. Clamp instance variation for declared 2–3 m
      // aquatic plants and preserve a clear gameplay bubble just as canopy trunks do.
      const tall=p.under.h>1.8,base=tall?.52:.68,variation=tall?.38:.62;
      push('under', 'under', this.regionMats[ri].under, base + noise2(x * 5, z * 5, 7801) * variation, 0, null, 7789);
    }
    if (settlementClear && rolls[2] < dens.rock * cellArea / 100) {
      push('rock', 'rock', this.regionMats[ri].rock, p.rock.scale * (0.5 + noise2(x * 7, z * 7, 7817)), 0.1, null, 7789);
    }
  }

  /**
   * THE NEAR-FIELD PROP DISC — the declared density, where the frame is actually made.
   *
   * `MAX_INSTANCES` is a per-tile budget of 700 canopy over a 300 m tile, which is 0.78 per
   * 100 m2. Every region declaring more than that rendered at exactly 0.78: Blackwood's 2.60 and
   * Thornmarsh's 5.40 came out identical, and so did their skylines. Six of thirteen regions were
   * clamped on the understorey and four on rock — in each case the regions whose whole character
   * is that they are dense. Canopy closure spanned 0.00 to 0.92 in `regions.json` and 0% to 63%
   * in the picture, most of it bunched under 20%.
   *
   * So: the DEFICIT between declared and budgeted density, placed on its own lattice inside 90 m,
   * rebuilt when the camera has moved 22 m. Beyond 90 m the tile budget stands, which is ordinary
   * level of detail — a tree at 200 m in a region whose fog e-folds at 55 m is not in the picture.
   * The lattice spacing is chosen per region from the deficit itself so the roll threshold stays
   * near a half: a 6.5 m lattice cannot express 4.6 trees per 100 m2 however hard it is asked.
   */
  updateNear(x, z) {
    const f = this.field;
    if (this.nearAtPos && Math.hypot(x - this.nearAtPos[0], z - this.nearAtPos[1]) < NEAR_REBUILD_M) return 0;
    this.nearAtPos = [x, z];
    // The near disc instances the tile scatter's own cached geometry, so removing the group is
    // the whole of the teardown; disposing here would pull the vertex buffers out from under
    // every tree in every resident tile.
    if (this.nearGroup) this.group.remove(this.nearGroup);
    const R = NEAR_RADIUS_M;
    const budget = TILE_M * TILE_M / 100;
    // The deficit each region owes, and the lattice fine enough to place it.
    const deficits = f.regions.map((r) => {
      const p = r.props;
      const d = {
        canopy: Math.max(0, (p.canopy.shape === 'none' ? 0 : p.canopy.per100m2) - MAX_INSTANCES.canopy / budget),
        under: Math.max(0, p.under.per100m2 - MAX_INSTANCES.under / budget),
        rock: Math.max(0, p.rock.per100m2 - MAX_INSTANCES.rock / budget),
      };
      d.max = Math.max(d.canopy, d.under, d.rock);
      return d;
    });
    const here = deficits[f.regionIndexAt(x, z)];
    const g = new THREE.Group();
    g.name = 'near-props';
    const buckets = new Map();
    if (here.max > 0.001) {
      // Spacing such that the busiest layer rolls at about one site in two.
      const step = clamp(Math.sqrt(100 / (2 * here.max)), 1.9, 6.5);
      const cellArea = step * step;
      const n = Math.ceil(R / step);
      const gx0 = Math.floor((x - R) / step), gz0 = Math.floor((z - R) / step);
      for (let iz = 0; iz <= n * 2; iz++) {
        for (let ix = 0; ix <= n * 2; ix++) {
          const cx = gx0 + ix, cz = gz0 + iz;
          const px = (cx + hash2(cx, cz, 8101)) * step;
          const pz = (cz + hash2(cx, cz, 8103)) * step;
          if (Math.hypot(px - x, pz - z) > R) continue;
          if (px < 0 || pz < 0 || px >= f.sizeX || pz >= f.sizeZ) continue;
          if (!f.isLandAt(px, pz)) continue;
          const ri = f.regionIndexAt(px, pz);
          const d = deficits[ri];
          if (d.max <= 0.001) continue;
          const r = f.regions[ri];
          const aTall = arrangeAt(f, px, pz, r.props.arrangement, 1.0);
          const aLow = arrangeAt(f, px, pz, r.props.arrangement, 0.45);
          this._placeSite(buckets, 'near', ri, px, pz, this._meshY(px, pz), cellArea,
            { canopy: d.canopy * aTall, under: d.under * aLow, rock: d.rock * aTall },
            [hash2(cx, cz, 8111), hash2(cx, cz, 8117), hash2(cx, cz, 8123), hash2(cx, cz, 8129)],
            MAX_NEAR);
        }
      }
    }
    let total = 0;
    for (const b of buckets.values()) {
      if (!b.xf.length) continue;
      const im = new THREE.InstancedMesh(b.geo, b.mat, b.xf.length);
      for (let i = 0; i < b.xf.length; i++) im.setMatrixAt(i, b.xf[i]);
      im.instanceMatrix.needsUpdate = true;
      im.castShadow = b.kind !== 'under';
      im.receiveShadow = true;
      im.name = `near-${b.kind}:${f.regions[b.ri].id}`;
      g.add(im);
      total += b.xf.length;
    }
    this.group.add(g);
    this.nearGroup = g;
    this.nearCount = total;
    return total;
  }

  /** Build at most `budget` queued tiles. Returns how many were built. */
  pump(budget = 2) {
    let n = 0;
    while (n < budget && this.queue.length) {
      const q = this.queue.shift();
      if (this.tiles.has(q.k)) continue;
      this.tiles.set(q.k, this._buildTile(q.tx, q.tz));
      this.built++; n++;
    }
    return n;
  }

  /** Build every queued tile — used by the harness so a screenshot is never of a half-built world. */
  drain(limit = 400) { let n = 0; while (this.queue.length && n < limit) n += this.pump(4); return n; }

  update(x, z, budget = 2) {
    this.request(x, z);
    const built = this.pump(budget);
    this._updateWaterMeshes();
    return built;
  }

  /** Keep streamed water on the same live field phase used by bodies, without rebuilding tiles. */
  _updateWaterMeshes() {
    const phase = this.field.tidePhase;
    if (phase === this._waterPhase) return;
    this._waterPhase = phase;
    for (const tile of this.tiles.values()) tile.group.traverse((mesh) => {
      if (!mesh.userData.waterSamples) return;
      const pos = mesh.geometry.attributes.position;
      const samples = mesh.userData.waterSamples;
      for (let i = 0; i < samples.length; i++) {
        const { x, z } = samples[i];
        pos.setY(i, this.field.waterSurfaceAt(x, z, phase) ?? this.field.heightAt(x, z));
      }
      pos.needsUpdate = true;
      mesh.geometry.computeVertexNormals();
    });
  }

  /**
   * Drop a tile, disposing ONLY the geometry that tile owns.
   *
   * Every prop, ground-cover and signature geometry comes out of `geoCache` and is instanced by
   * every resident tile and by both camera-following discs. Disposing on release — which is what
   * this did — threw away the vertex buffers of every tree in the province each time a single
   * 300 m tile left the ring, and the renderer re-uploaded them on the next frame. What a tile
   * actually owns is its ground mesh, its per-region water meshes and its deck/pier merges.
   */
  _release(k, t) {
    this.group.remove(t.group);
    t.group.traverse((o) => { if (o.geometry && !o.geometry.userData.shared) o.geometry.dispose(); });
    this.tiles.delete(k);
  }

  _buildTile(tx, tz) {
    const f = this.field;
    const g = new THREE.Group();
    g.name = `tile:${tx},${tz}`;
    const ox = tx * TILE_M, oz = tz * TILE_M;

    // ---- ground ------------------------------------------------------------------------------
    const geo = new THREE.PlaneGeometry(TILE_M, TILE_M, TILE_SEG, TILE_SEG);
    geo.rotateX(-Math.PI / 2);
    geo.translate(ox + TILE_M / 2, 0, oz + TILE_M / 2);
    const pos = geo.attributes.position;
    const col = new Float32Array(pos.count * 3);
    const tmp = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i);
      // A deck span is a STRUCTURE and is drawn by `_spans` as a slab on piers. The terrain must
      // not also try to draw it: a 6 m carriageway sampled on a 7.5 m grid becomes a row of spikes
      // through the bridge. The ground under a viaduct is the ground.
      const h = f.onDeckAt(x, z) ? f.bareHeightAt(x, z) : f.heightAt(x, z);
      pos.setY(i, h);
      this._groundColour(x, z, h, tmp);
      col[i * 3] = tmp.r; col[i * 3 + 1] = tmp.g; col[i * 3 + 2] = tmp.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const tileUv=geo.attributes.uv;
    for(let i=0;i<pos.count;i++) tileUv.setXY(i,pos.getX(i)/3,pos.getZ(i)/3);
    tileUv.needsUpdate=true;
    geo.computeVertexNormals();
    const ground = new THREE.Mesh(geo, this.mats.ground);
    ground.receiveShadow = true;
    ground.name = 'ground';
    g.add(ground);

    // ---- water -------------------------------------------------------------------------------
    // One water mesh per region present in the tile, because Topal and the Padomaic and a
    // tannin-black channel are not one material with three names (RI-WLD10 §9/§10).
    const byRegion = new Map();
    const step = TILE_M / WATER_SEG;
    for (let iz = 0; iz < WATER_SEG; iz++) {
      for (let ix = 0; ix < WATER_SEG; ix++) {
        const x0 = ox + ix * step, z0 = oz + iz * step;
        const corners = [[x0, z0], [x0 + step, z0], [x0 + step, z0 + step], [x0, z0 + step]];
        // Include a shore cell when any corner is wet at either tide extreme. Dry vertices clamp
        // to their local bank, so narrow channels meet terrain instead of disappearing merely
        // because the 12.5 m sampling lattice straddles a shoreline.
        const low = corners.map(([cx, cz]) => f.waterSurfaceAt(cx, cz, 0.75));
        const high = corners.map(([cx, cz]) => f.waterSurfaceAt(cx, cz, 0.25));
        if (![...low, ...high].some((s) => s !== null)) continue;
        const surf = corners.map(([cx, cz]) => f.waterSurfaceAt(cx, cz) ?? f.heightAt(cx, cz));
        const ri = f.regionIndexAt(x0 + step / 2, z0 + step / 2);
        if (!byRegion.has(ri)) byRegion.set(ri, { v: [], i: [], n: 0 });
        const b = byRegion.get(ri);
        for (let k = 0; k < 4; k++) b.v.push(corners[k][0], surf[k], corners[k][1]);
        b.i.push(b.n, b.n + 2, b.n + 1, b.n, b.n + 3, b.n + 2);
        b.n += 4;
      }
    }
    for (const [ri, b] of byRegion) {
      const wg = new THREE.BufferGeometry();
      wg.setAttribute('position', new THREE.Float32BufferAttribute(b.v, 3));
      wg.setIndex(b.i);
      wg.computeVertexNormals();
      const wm = new THREE.Mesh(wg, this.regionMats[ri].water);
      wm.name = `water:${f.regions[ri].id}`;
      wm.userData.waterSamples = [];
      for (let i = 0; i < b.v.length; i += 3) wm.userData.waterSamples.push({ x: b.v[i], z: b.v[i + 2] });
      g.add(wm);
      // Shoreline response must exist in the pixels, not only in depth data. Build a thin,
      // terrain-following wet edge from wet/dry cell boundaries; it gives tidal flats and
      // channels scale without an expensive screen-space foam pass.
      const shoreMat=this.regionMats[ri].water.clone();shoreMat.color.lerp(new THREE.Color(0xb6b9a2),.42);shoreMat.opacity=.48;shoreMat.roughness=.36;shoreMat.metalness=.08;shoreMat.depthWrite=false;
      // Merge every band in this tile/region into one indexed geometry. The first version used
      // one PlaneGeometry/Mesh per 25 m edge and made a marsh capture exceed 2,400 draws; these
      // four-vertex quads preserve the exact same wet-edge pixels at one draw per region.
      const sv=[],si=[];
      const band=(ax,az,bx,bz)=>{const dx=bx-ax,dz=bz-az,len=Math.hypot(dx,dz)||1,nx=-dz/len*.17,nz=dx/len*.17;
        const ay=(f.waterSurfaceAt(ax,az)??f.heightAt(ax,az))+.018,by=(f.waterSurfaceAt(bx,bz)??f.heightAt(bx,bz))+.018,n=sv.length/3;
        sv.push(ax+nx,ay,az+nz, ax-nx,ay,az-nz, bx-nx,by,bz-nz, bx+nx,by,bz+nz);si.push(n,n+2,n+1,n,n+3,n+2);};
      for(let iz=0;iz<WATER_SEG;iz+=2)for(let ix=0;ix<WATER_SEG;ix+=2){const x=ox+ix*step,z=oz+iz*step,c=f.waterSurfaceAt(x+step*.5,z+step*.5)!==null;
        if(ix+2<WATER_SEG&&(f.waterSurfaceAt(x+step*2.5,z+step*.5)!==null)!==c)band(x+step*2,z,x+step*2,z+step*2);
        if(iz+2<WATER_SEG&&(f.waterSurfaceAt(x+step*.5,z+step*2.5)!==null)!==c)band(x,z+step*2,x+step*2,z+step*2);
      }
      if(sv.length){const sg=new THREE.BufferGeometry();sg.setAttribute('position',new THREE.Float32BufferAttribute(sv,3));sg.setIndex(si);sg.computeVertexNormals();const shore=new THREE.Mesh(sg,shoreMat);shore.name=`shoreline:${f.regions[ri].id}`;shore.renderOrder=3;g.add(shore);}
    }

    // ---- flora and rock ----------------------------------------------------------------------
    this._scatter(g, ox, oz);
    // ---- the region's ONLY-HERE element ------------------------------------------------------
    this._signatures(g, ox, oz);
    // ---- the border's markers, RI-WLD12 M64 / M66 --------------------------------------------
    this._thresholds(g, ox, oz);
    // ---- the road's declared deck spans, as structures ---------------------------------------
    this._spans(g, ox, oz);
    // ---- the signposts, W1-05 / RI-WLD06 L2 --------------------------------------------------
    this._signposts(g, ox, oz);
    // ---- the town, W1-04 r3 / RI-WLD03 R5 ----------------------------------------------------
    this._settlementBuildings(g, ox, oz);

    this.group.add(g);
    return { group: g, tx, tz };
  }

  /**
   * THE TOWNS, ATTACHED. `RI-WLD03` R5, and the second half of the round-1 verdict's blocking gap.
   *
   * Called once by `Engine._boot()`, before the renderer builds any tile, for exactly the reason
   * `field.setSignposts()` is called there: a tile built before the plans exist is a stretch of
   * ground with a town's worth of doors on it and nothing standing up.
   *
   * The plan is computed ONCE per settlement and cached, because `planSettlement()` is pure and
   * because the shrink pass is O(n^2) over 40 buildings and has no business running per tile.
   * Re-calling this REPLACES the plans and drops every built tile, which is what makes the
   * consumption perturbation ("change a settlement's building list and watch the screen") a
   * thing a probe can do at runtime rather than a thing you rebuild the game to see.
   *
   * @param {object[]} docs  `game/data/world/settlements/*.json` documents
   * @param {object} interiors  `{ [interiorId]: interiorRecord }`
   */
  setSettlements(docs, interiors) {
    this.settlementPlans = (docs || []).map((d) => planSettlement(d, interiors || {}));
    // ---- THE JOIN — W1-04 round 4, RI-WLD13 N1 ------------------------------------------------
    //
    // Round 3 shrank the drawn exteriors to keep buildings out of one another and left every
    // interior at its declared footprint, and the round-3 verdict measured what that meant:
    // *"41 of 112 enterable buildings now draw an exterior smaller than their own interior.
    // blackrose-inn is a 3.4 m shed over a 13.6 m hall — 6.3% of the area."* N1 went from
    // vacuous to false, and this line is where it is put right.
    //
    // This is the only place in the build where the plan and the interior records meet, which is
    // why the reconciliation belongs here and not in either renderer. `interiors` is
    // `Engine.data.interiors` BY REFERENCE — the same objects `renderer.setInteriorRecord()`
    // builds rooms from, `sim/npc.js` places people inside and `settlement.js` spawns the player
    // in — so a room that shrank shrank for the simulation too, and not only for the picture.
    // The report is published on the province because the acceptance number ("how many rooms did
    // the plan have to take space from, and how much") must be readable from a probe.
    // ROUND 5 passes `docs` as well, and that argument is load-bearing rather than tidy. The join
    // now also moves `buildings[].door` off the building's CENTRE and onto its entry wall, and
    // `sim/settlement.js SettlementSystem` built its door-reach table in its own constructor —
    // before this ever runs — from these exact document objects. Without them the doorstep would
    // land 1.5 m outside a wall whose door the sim still believes is 6 m away in the middle of
    // the house, and you would step out of a building you could not step back into.
    this.interiorJoin = applyInteriorBounds(this.settlementPlans, interiors || {}, docs || []);
    this._solidCache = null;
    // Anything already built was built without these; drop it so the next request rebuilds.
    for (const [k, t] of [...this.tiles]) this._release(k, t);
    this.queue.length = 0;
    return this.settlementPlans.length;
  }

  /**
   * Draw every settlement whose centre falls in this tile.
   *
   * WHY ON THE CENTRE TILE AND NOT PER BUILDING. The widest plan (Helstrom) reaches 66 m from its
   * centre and a tile is 300 m, so a town is at most two tiles wide and its centre tile is always
   * resident before the player is within sight of it — the ring is 5x5. Splitting a town across
   * tile groups would mean a building disappearing when the tile it happens to sit in is released
   * while the player stands in the same street, which is a worse artefact than building 40
   * buildings one tile early.
   */
  _settlementBuildings(group, ox, oz) {
    if (!this.drawBuildings) return 0;
    if (!this.settlementPlans.length) return 0;
    let n = 0;
    for (const plan of this.settlementPlans) {
      const [px, , pz] = plan.pos;
      if (!(px >= ox && px < ox + TILE_M && pz >= oz && pz < oz + TILE_M)) continue;
      const g = new THREE.Group();
      g.name = `settlement:${plan.id}`;
      const summary = buildSettlementExterior(g, plan, (x, z) => this._meshY(x, z));
      this._settlementStyleboard(g,plan);
      // The plan's own inconsistencies, carried on the summary rather than swallowed: a town
      // whose offsets place buildings closer together than the shrink floor allows still
      // interpenetrates, and a probe should be able to see how often.
      summary.deep_overlaps = this._deepOverlaps(plan);
      g.userData.exterior = summary;
      group.add(g);
      this.buildingsDrawn += summary.buildings;
      n += summary.buildings;
    }
    return n;
  }

  /** How many pairs in this plan still cover more than 45% of the smaller building. */
  _deepOverlaps(plan) {
    let n = 0;
    const B = plan.buildings;
    for (let i = 0; i < B.length; i++) {
      for (let j = i + 1; j < B.length; j++) {
        const a = B[i], c = B[j];
        const aw = a.drawn_footprint_m[0], ad = a.drawn_footprint_m[1];
        const cw = c.drawn_footprint_m[0], cd = c.drawn_footprint_m[1];
        const ox2 = (aw + cw) / 2 - Math.abs(a.x - c.x), oz2 = (ad + cd) / 2 - Math.abs(a.z - c.z);
        if (ox2 > Math.min(aw, cw) * 0.45 + 1e-6 && oz2 > Math.min(ad, cd) * 0.45 + 1e-6) n++;
      }
    }
    return n;
  }

  /** The settlement whose radius contains (x, z), or null. */
  settlementAt(x, z, slack = 25) {
    for (const p of this.settlementPlans) {
      const dx = p.pos[0] - x, dz = p.pos[2] - z;
      const r = p.radius_m + slack;
      if (dx * dx + dz * dz <= r * r) return p;
    }
    return null;
  }

  /**
   * The collision shapes for the buildings near (x, z) — the SOLIDS half of the same plan the
   * meshes are built from, so the wall you cannot walk through is the wall you can see.
   *
   * Only what is within `radius`, because `CollisionCell.distance()` is a linear scan and the
   * camera's spring arm evaluates it up to 96 times a frame; 40 buildings at five slabs each
   * would put 200 primitives in that loop for the sake of geometry 60 m behind the player.
   */
  settlementSolidsNear(x, z, radius = 45) {
    const p = this.settlementAt(x, z);
    if (!p) return null;
    return { id: p.id, shapes: settlementSolids(p, x, z, radius, (bx, bz) => this._meshY(bx, bz)) };
  }

  /** Which building's footprint this world point is inside, across every town. Audit only. */
  buildingAt(x, z, inset = 0) {
    for (const p of this.settlementPlans) {
      const hit = insideBuilding(p, x, z, inset);
      if (hit) return { settlement: p.id, building: hit };
    }
    return null;
  }

  /**
   * WHAT IS ACTUALLY IN THE SCENE GRAPH, read back off it rather than off the plans.
   *
   * This is the measurement the round-1 verdict's acceptance asks for and the reason it is a
   * traversal and not a `this.settlementPlans` sum: a plan that is read and never added to a
   * group would report identically, and that is precisely the failure this piece exists to fix.
   */
  drawnBuildings() {
    const out = { settlements: [], buildings: 0, meshes: 0, triangles: 0, kit_meshes: 0, kit_ids: [] };
    const kit = new Set();
    this.group.traverse((o) => {
      if (!o.name || !o.name.startsWith('settlement:')) return;
      const s = o.userData.exterior;
      let meshes = 0, tris = 0, kitN = 0;
      o.traverse((m) => {
        if (m.name && m.name.startsWith('kit:')) { kitN++; kit.add(m.name.slice(4)); }
        if (!m.isMesh || !m.geometry) return;
        meshes++;
        const g = m.geometry;
        tris += g.index ? g.index.count / 3 : (g.attributes.position ? g.attributes.position.count / 3 : 0);
      });
      const groups = o.children.filter((c) => c.name && c.name.startsWith('building:'));
      out.settlements.push({
        id: o.name.slice(11), building_groups: groups.length,
        meshes, triangles: Math.round(tris), kit_meshes: kitN,
        declared_footprints: s ? s.declared_footprints : null,
        derived_footprints: s ? s.derived_footprints : null,
        shrunk: s ? s.shrunk : null,
        deep_overlaps: s ? s.deep_overlaps : null,
        doorways: s ? s.doorways : null,
        drawn: s ? s.drawn : [],
      });
      out.buildings += groups.length;
      out.meshes += meshes;
      out.triangles += Math.round(tris);
      out.kit_meshes += kitN;
    });
    out.kit_ids = [...kit].sort();
    out.settlements.sort((a, b) => (a.id < b.id ? -1 : 1));
    return out;
  }

  /**
   * The road signage, built. `RI-WLD06` L2, and the positive half of seam S35.
   *
   * S35 permits a map and defines it as a record of ground you have already walked — no marker,
   * no route line, no distance readout, and nothing at all drawn for a place you have not stood
   * in. Which means the map cannot answer the only question that matters the first time: at a
   * junction, which way is Gideon? Something in the world has to, and this is that something.
   * Before W1-05 nothing in `game/src` drew a post of any kind, and
   * `roads.json`'s nine waystations were read by three offline tools and by nothing the player
   * could ever see — the orphan-data shape `RI-MTH07` §A names.
   *
   * A post is built from `game/data/world/signposts.json`, whose arms carry the real bearings.
   * The ARM POINTS ALONG `along_deg`, which is where the road actually goes over the next 180 m,
   * not at the straight line to the destination — that is `bearing_deg`, and it is what the
   * WORD on the board says. On a causeway with sinuosity 1.60 those differ by up to 79 degrees
   * and an arm built off the wrong one sends people into the water.
   *
   * The style is information: a Legion milestone is squared masonry, a marsh trail is a scarred
   * root, a tideway is a painted pole. You can tell who maintains a road by what they signed it
   * with from further away than you can read it, which is the whole point of L2 existing at all.
   */
  _signposts(group, ox, oz) {
    const f = this.field;
    if (!f.signs || !f.signs.length) return;
    const here = f.signs.filter((s) => s.x >= ox && s.x < ox + TILE_M && s.z >= oz && s.z < oz + TILE_M);
    if (!here.length) return;
    const g = new THREE.Group();
    g.name = 'signposts';
    for (const s of here) {
      const y = this._meshY(s.x, s.z);
      const post = new THREE.Group();
      post.name = `signpost:${s.id}`;
      post.position.set(s.x, y, s.z);
      const mat = this._signMat(s.style);
      if (s.style === 'milestone') {
        // Squared masonry, waist high, and a cap. The Legion does not build a stick.
        const body = new THREE.Mesh(new THREE.BoxGeometry(0.62, 1.35, 0.62), mat.post);
        body.position.y = 0.67; post.add(body);
        const cap = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.16, 0.78), mat.post);
        cap.position.y = 1.42; post.add(cap);
      } else if (s.style === 'tide-pole') {
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.14, 3.4, 7), mat.post);
        pole.position.y = 1.70; post.add(pole);
        // The bands ARE the information: which one is wet is what the pole tells you.
        for (let b = 0; b < 5; b++) {
          const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.135, 0.135, 0.16, 8), b % 2 ? mat.board : mat.arm);
          ring.position.y = 0.45 + b * 0.55; post.add(ring);
        }
      } else if (s.style === 'knife-marks') {
        // Not a post at all: a standing root, cut. Leaning, because roots do.
        const root = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.30, 2.1, 6), mat.post);
        root.position.set(0, 1.02, 0); root.rotation.z = 0.13; post.add(root);
        const scar = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.44, 0.06), mat.board);
        scar.position.set(0.10, 1.35, 0.22); post.add(scar);
      } else {
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 2.7, 7), mat.post);
        pole.position.y = 1.35; post.add(pole);
      }
      // One arm per destination, at the height the sign's own style hangs them, pointing where
      // the road goes. `yawFor` inverts `sim/player.js`'s forward = (sin y, _, cos y).
      const armY = s.style === 'milestone' ? 1.05 : s.style === 'knife-marks' ? 1.55 : 2.25;
      s.arms.forEach((a, i) => {
        const yaw = (180 - a.along_deg) * Math.PI / 180;
        const arm = new THREE.Group();
        arm.position.y = armY - i * 0.34;
        arm.rotation.y = yaw;
        const blade = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.20, 0.92), mat.arm);
        blade.position.z = 0.52; arm.add(blade);
        const board = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.24, 0.74), mat.board);
        board.position.z = 0.62; arm.add(board);
        post.add(arm);
      });
      post.traverse((o) => { o.castShadow = true; o.receiveShadow = true; });
      // The waylamp. Only junction and waystation posts carry one — see the long note in
      // `tools/world/build-signposts.mjs` — and its colour is the region's own signature colour,
      // so a lit post says WHERE as well as WHICH WAY. The emissive makes the object glow; what
      // makes it light the ground around it is `updateSignatureLights`, which pools these with
      // the region's own instances so the light budget stays at MAX_SIG_LIGHTS.
      if (s.lamp) {
        const lm = new THREE.Mesh(
          new THREE.SphereGeometry(0.13, 8, 6),
          new THREE.MeshStandardMaterial({
            color: s.lamp.hex, emissive: s.lamp.hex, emissiveIntensity: 1.5, roughness: 0.4,
          }),
        );
        lm.position.set(0, s.lamp.height_m, 0.16);
        lm.castShadow = false; lm.receiveShadow = false;
        lm.name = `waylamp:${s.id}`;
        post.add(lm);
      }
      g.add(post);
    }
    group.add(g);
  }

  /** Materials per post style, cached. The style is meant to read before the text does. */
  _signMat(style) {
    this._signMats = this._signMats || {};
    if (this._signMats[style]) return this._signMats[style];
    const P = {
      milestone: { post: 0xB9B2A0, arm: 0x4A4238, board: 0x8E8877 },      // dressed pale stone, iron arms
      'painted-board': { post: 0x6B5A44, arm: 0x53452F, board: 0xC8B487 }, // weathered timber, chalky paint
      'knife-marks': { post: 0x4C3B2A, arm: 0x3E3020, board: 0x7A6242 },   // living root, pale cut wood
      'tide-pole': { post: 0x7A6E58, arm: 0x9E3B2A, board: 0xE4E0D2 },     // driftwood, red and white bands
    }[style] || { post: 0x6B5A44, arm: 0x53452F, board: 0xC8B487 };
    this._signMats[style] = {
      post: new THREE.MeshStandardMaterial({ color: P.post, roughness: style === 'milestone' ? 0.82 : 0.93 }),
      arm: new THREE.MeshStandardMaterial({ color: P.arm, roughness: 0.78, metalness: style === 'milestone' ? 0.35 : 0.0 }),
      board: new THREE.MeshStandardMaterial({ color: P.board, roughness: 0.90 }),
    };
    return this._signMats[style];
  }

  /**
   * The thirteen ONLY-HERE elements, in this tile. `RI-WLD04` M19.
   *
   * The landform half of seven of them is already in the ground mesh above, because
   * `field.heightAt()` evaluates `signature.profile()` — the crater is a hole in the terrain, not
   * a decal on it. What is added here is everything that is not ground, plus the night emission
   * six of them carry, which is M17 step 6's "a region that is only identifiable in clear daylight
   * is half-built" answered with light sources the region owns rather than with exposure.
   */
  _signatures(group, ox, oz) {
    const sig = this.field.sig;
    if (!sig) return;
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), s = new THREE.Vector3();
    const up = new THREE.Vector3(0, 1, 0);
    const buckets = new Map();
    // Cover the tile plus the largest footprint, so a crater rim that reaches into this tile is
    // drawn with it rather than popping when the neighbouring tile streams in.
    const pad = 40;
    for (const it of sig.items) {
      if (it.x < ox - pad || it.x >= ox + TILE_M + pad || it.z < oz - pad || it.z >= oz + TILE_M + pad) continue;
      // One instance belongs to exactly one tile — the one containing its centre — so a feature
      // straddling a tile edge is not drawn twice.
      if (it.x < ox || it.x >= ox + TILE_M || it.z < oz || it.z >= oz + TILE_M) continue;
      const K = SIGNATURE_KINDS[it.kind];
      let b = buckets.get(it.kind);
      if (!b) { b = { kind: it.kind, xf: [] }; buckets.set(it.kind, b); }
      // The body stands on the ground the profile already raised, except the jelly, which floats.
      const gy = it.kind === 'swamp_jelly_canopy'
        ? (this.field.waterSurfaceAt(it.x, it.z) ?? this.field.heightAt(it.x, it.z)) + it.hover
        : this._meshY(it.x, it.z);
      q.setFromAxisAngle(up, it.rot);
      v.set(it.x, gy, it.z);
      // Unit geometry is authored at height 1 and radius ~1, so one scale carries both.
      const sc = K.landform && it.kind !== 'root_arch' ? it.h : (K.r_base * it.s * 0.5);
      s.set(it.kind === 'petrified_bole' || it.kind === 'glassed_crater' ? K.r_base * it.s * 0.5 : sc,
        it.kind === 'petrified_bole' || it.kind === 'glassed_crater' ? K.r_base * it.s * 0.5 : it.h,
        it.kind === 'petrified_bole' || it.kind === 'glassed_crater' ? K.r_base * it.s * 0.5 : sc);
      if (it.kind === 'rock_flute_spire') s.set(K.r_base * it.s * 0.9, it.h, K.r_base * it.s * 0.9);
      if (it.kind === 'root_arch') s.setScalar(K.r_base * it.s * 0.62);
      if (it.kind === 'beached_hull_house') s.set(K.r_base * it.s, it.h, K.r_base * it.s);
      if (it.kind === 'comb_cliff') s.set(K.r_base * it.s, it.h, K.r_base * it.s);
      if (it.kind === 'naga_kiln_dome') s.set(K.r_base * it.s, it.h, K.r_base * it.s);
      m.compose(v, q, s);
      b.xf.push(m.clone());
    }
    for (const b of buckets.values()) {
      if (!b.xf.length) continue;
      const ri = this.field.regionIndexAt(b.xf[0].elements[12], b.xf[0].elements[14]);
      const geo = this._sigGeo(b.kind);
      const mat = this._sigMat(b.kind, ri);
      const im = new THREE.InstancedMesh(geo.body, mat.body, b.xf.length);
      for (let i = 0; i < b.xf.length; i++) im.setMatrixAt(i, b.xf[i]);
      im.instanceMatrix.needsUpdate = true;
      im.castShadow = true; im.receiveShadow = true;
      im.name = `signature:${b.kind}`;
      group.add(im);
      if (geo.glow && mat.glow) {
        const gm = new THREE.InstancedMesh(geo.glow, mat.glow, b.xf.length);
        for (let i = 0; i < b.xf.length; i++) gm.setMatrixAt(i, b.xf[i]);
        gm.instanceMatrix.needsUpdate = true;
        gm.name = `signature-glow:${b.kind}`;
        group.add(gm);
      }
    }
  }

  /**
   * The border's markers, in this tile. `RI-WLD12` M64 (something built or grown at the frontier)
   * and M66 (a tier jump announced on a second channel before you are in it).
   *
   * WHY THIS IS NOT DECORATION. Seam S35 settled what the map may be: only ground the player has
   * already walked, a square per place they have personally stood, and their own position. No
   * markers, no routes, nothing a quest can put on it. So there is no interface that can tell a
   * player they are about to leave Blackwood; the only thing that can is the ground and what is
   * standing on it. Round 1 gave the border nine staggered axes and 210 objects, and drew none of
   * the objects — a frontier whose whole announcement lived in a JSON file.
   *
   * Eight owners, eight silhouettes: an Imperial cairn shedding its top block, a root gate grown
   * rather than built, a villagers' tide pole notched at every tide worth remembering, a
   * path-cutters' lashed and blazed tripod, naga kiln slag still warm at night, a line of upright
   * ribs, a fulgurite nobody placed, and the Dres gibbet with somebody in it. Plus, on the seven
   * borders where the danger tier jumps by two or more, the remains that are the second channel.
   */
  _thresholds(group, ox, oz) {
    const bf = this.field.borders;
    if (!bf || !bf.markersIn) return;
    const here = bf.markersIn(ox, oz, ox + TILE_M, oz + TILE_M);
    if (!here.length) return;
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), s = new THREE.Vector3();
    const up = new THREE.Vector3(0, 1, 0);
    const buckets = new Map();
    for (const it of here) {
      let b = buckets.get(it.type);
      if (!b) { b = { type: it.type, remains: it.remains, xf: [] }; buckets.set(it.type, b); }
      q.setFromAxisAngle(up, it.rot);
      // Authored at height 1 with y = 0 on the ground, so one number carries the instance; the
      // horizontal scale is the type's own half-extent rather than the height, or a bone line
      // would be as wide as it is tall.
      v.set(it.x, this._meshY(it.x, it.z), it.z);
      s.setScalar(it.h);
      m.compose(v, q, s);
      b.xf.push(m.clone());
    }
    for (const b of buckets.values()) {
      const geo = this._thrGeo(b.type, b.remains);
      const mat = this._thrMat(b.type, b.remains);
      if (!geo || !mat) continue;
      const body = b.remains ? geo : geo.body;
      const bodyMat = b.remains ? mat : mat.body;
      const im = new THREE.InstancedMesh(body, bodyMat, b.xf.length);
      for (let i = 0; i < b.xf.length; i++) im.setMatrixAt(i, b.xf[i]);
      im.instanceMatrix.needsUpdate = true;
      im.castShadow = true; im.receiveShadow = true;
      im.name = b.remains ? `remains:${b.type}` : `threshold:${b.type}`;
      group.add(im);
      if (!b.remains && geo.glow && mat.glow) {
        const gm = new THREE.InstancedMesh(geo.glow, mat.glow, b.xf.length);
        for (let i = 0; i < b.xf.length; i++) gm.setMatrixAt(i, b.xf[i]);
        gm.instanceMatrix.needsUpdate = true;
        gm.name = `threshold-glow:${b.type}`;
        group.add(gm);
      }
    }
  }

  /**
   * One geometry per marker type, built once and instanced by every tile.
   *
   * `userData.shared = true` IS NOT OPTIONAL and leaving it off is a live bug rather than an
   * inefficiency: `_release()` disposes every geometry in a departing tile that is not flagged
   * shared, so the first time the player walked far enough for a border tile to leave the ring,
   * the vertex buffers behind all 217 markers would have been freed while other resident tiles
   * were still instancing them. The same note is on `_sigGeo` for the same reason.
   */
  _thrGeo(type, remains) {
    this._thrGeoCache = this._thrGeoCache || new Map();
    const k = (remains ? 'r:' : 't:') + type;
    if (!this._thrGeoCache.has(k)) {
      const g = remains ? remainsGeometry(type) : thresholdGeometry(type);
      if (g && g.attributes) g.userData.shared = true;                 // remains: a bare geometry
      if (g && g.body) g.body.userData.shared = true;                  // threshold: { body, glow }
      if (g && g.glow) g.glow.userData.shared = true;
      this._thrGeoCache.set(k, g);
    }
    return this._thrGeoCache.get(k);
  }

  _thrMat(type, remains) {
    this._thrMatCache = this._thrMatCache || new Map();
    const k = (remains ? 'r:' : 't:') + type;
    if (!this._thrMatCache.has(k)) {
      this._thrMatCache.set(k, remains ? remainsMaterial(type) : thresholdMaterials(type));
    }
    return this._thrMatCache.get(k);
  }

  /**
   * The declared `deck_spans`, built.
   *
   * Verdict W1-01 round 2: "The 21 declared `deck_spans` — including 11 'viaducts' up to 16 m —
   * are read nowhere in `game/src`. They are JSON labels on an earth berm. Either build them as
   * structures the player walks across, or delete the declaration."
   *
   * `field.setRoads` already made the deck a hard surface and stopped raising the ground under it.
   * This is the rest of the sentence: a slab, two parapets and a pier every 18 m down to whatever
   * the ground actually is. There is now air under the viaduct, water running under the causeway,
   * and a drop off the side that `sim/traversal.js` charges for.
   */
  _spans(group, ox, oz) {
    const f = this.field;
    if (!f.roads || !f.roadSegs) return;
    const deckParts = [], pierParts = [];
    const push = (arr, geo) => arr.push(geo);
    for (const s of f.roadSegs) {
      if (!s.span) continue;
      const mx = (s.ax + s.bx) / 2, mz = (s.az + s.bz) / 2;
      if (mx < ox || mx >= ox + TILE_M || mz < oz || mz >= oz + TILE_M) continue;
      const dx = s.bx - s.ax, dz = s.bz - s.az;
      const L = Math.hypot(dx, dz) || 1;
      const my = (s.ay + s.by) / 2;
      const yaw = Math.atan2(dx, dz);
      const w = s.hw * 2 + 1.0;
      // The slab, pitched along the deck's own gradient so a stair's bridge is not level.
      const pitch = Math.atan2(s.by - s.ay, L);
      const slab = new THREE.BoxGeometry(w, 0.55, Math.hypot(L, s.by - s.ay));
      slab.rotateX(-pitch);
      slab.rotateY(yaw);
      slab.translate(mx, my - 0.28, mz);
      push(deckParts, slab);
      // Parapets: the thing that tells you, at eye height, that you are on a bridge.
      for (const side of [-1, 1]) {
        const par = new THREE.BoxGeometry(0.30, 0.85, Math.hypot(L, s.by - s.ay));
        par.rotateX(-pitch);
        par.rotateY(yaw);
        par.translate(mx + Math.cos(yaw) * side * (w / 2 - 0.15), my + 0.42, mz - Math.sin(yaw) * side * (w / 2 - 0.15));
        push(deckParts, par);
      }
      // A pier under the midpoint, if there is enough air for one to be visible.
      const gy = f.bareHeightAt(mx, mz);
      const clear = my - gy;
      if (clear > 1.6 && (this._pierPhase = ((this._pierPhase || 0) + 1) % 2) === 0) {
        const pier = new THREE.CylinderGeometry(0.9, 1.35, clear, 7);
        pier.translate(mx, gy + clear / 2, mz);
        push(pierParts, pier);
        // A springing arch from the pier to the deck, so it reads as masonry and not as a stilt.
        const arch = new THREE.TorusGeometry(Math.min(9, L * 1.4), 0.42, 5, 9, Math.PI);
        arch.rotateY(yaw + Math.PI / 2);
        arch.translate(mx, my - 0.9, mz);
        push(pierParts, arch);
      }
    }
    if (deckParts.length) {
      this.spanMats = this.spanMats || {
        deck: new THREE.MeshStandardMaterial({ color: 0x8E8878, roughness: 0.86 }),
        pier: new THREE.MeshStandardMaterial({ color: 0x6E6A5E, roughness: 0.92 }),
      };
      const mk = (parts, mat, name) => {
        const merged = mergeAll(parts);
        const m = new THREE.Mesh(merged, mat);
        m.name = name; m.castShadow = true; m.receiveShadow = true;
        group.add(m);
      };
      mk(deckParts, this.spanMats.deck, 'road-deck');
      if (pierParts.length) mk(pierParts, this.spanMats.pier, 'road-piers');
    }
  }

  /**
   * Night light from the region's own signature elements.
   *
   * `RI-WLD04` M17 step 6 requires the regions to be identifiable at night, and the round-2
   * measurement was `ours_night` LOO 33.3% against a 70% bar — "half of the world had never been
   * measured; it was measured, and it failed by a factor of two." An emissive material makes the
   * OBJECT glow; it does not light anything around it, so a welkynd pillar in Blackwood at 01:00
   * was a blue dot in a black frame. These are the lamps: six of the thirteen regions own a light
   * source of their own colour — welkynd blue, kiln ember, comb amber, jelly green, voriplasm
   * violet, hull-fire orange — and what they light is that region's own ground and its own props.
   *
   * Bounded at MAX_SIG_LIGHTS and re-pointed at the nearest instances as the player moves, so the
   * cost is a constant regardless of how many instances a region declares.
   */
  updateSignatureLights(x, z) {
    const sig = this.field.sig;
    // NOT `if (!sig) return 0` any more. The waylamps live in the same pool as the region
    // signatures but they are not made of them, and a bare-signature world would otherwise have
    // had lit posts in the data and none in the frame — the orphan shape this piece exists to
    // stop, arriving through an early return.
    if (!sig && !(this.field.signs || []).some((s) => s.lamp)) return 0;
    if (!this.sigLights) {
      this.sigLights = [];
      for (let i = 0; i < MAX_SIG_LIGHTS; i++) {
        const l = new THREE.PointLight(0xffffff, 0, 1);
        l.name = `signature-light-${i}`;
        l.visible = false;
        this.group.add(l);
        this.sigLights.push(l);
      }
    }
    const near = [];
    for (const it of (sig ? sig.items : [])) {
      const K = SIGNATURE_KINDS[it.kind];
      if (!K.glow) continue;
      const d = Math.hypot(it.x - x, it.z - z);
      if (d > SIG_LIGHT_RANGE) continue;
      near.push({ it, K, d });
    }
    // The waylamps join the SAME pool rather than adding lights of their own, so the cost stays
    // the measured two and the road does not buy its legibility at 3.75 minutes a frame. W1-05:
    // before this, neither named route passed within the 160 m lamp range of ANY glowing thing
    // over 6.8 km and 12.4 km respectively — the road was the darkest line in the province,
    // because the one signature kind placed roadside is the one that does not glow.
    for (const s of (this.field.signs || [])) {
      if (!s.lamp) continue;
      const d = Math.hypot(s.x - x, s.z - z);
      if (d > SIG_LIGHT_RANGE) continue;
      near.push({ lamp: s, d, K: { glow: s.lamp.glow, glow_hex: s.lamp.hex } });
    }
    near.sort((a, b) => a.d - b.d);
    for (let i = 0; i < this.sigLights.length; i++) {
      const l = this.sigLights[i];
      const n = near[i];
      if (!n) { l.visible = false; l.intensity = 0; continue; }
      if (n.lamp) {
        l.position.set(n.lamp.x, this.field.heightAt(n.lamp.x, n.lamp.z) + n.lamp.lamp.height_m, n.lamp.z);
        l.color.set(n.lamp.lamp.hex);
        l.distance = SIG_LIGHT_RANGE * 0.55;
        l.decay = 1.6;
        l.intensity = n.lamp.lamp.glow * this.nightFactor * 420;
        l.visible = l.intensity > 0.01;
        continue;
      }
      const gy = n.it.kind === 'swamp_jelly_canopy'
        ? (this.field.waterSurfaceAt(n.it.x, n.it.z) ?? this.field.heightAt(n.it.x, n.it.z)) + n.it.hover
        : this.field.heightAt(n.it.x, n.it.z) + n.it.h * 0.8;
      l.position.set(n.it.x, gy, n.it.z);
      l.color.set(n.K.glow_hex || '#FFFFFF');
      l.distance = SIG_LIGHT_RANGE * 0.55;
      l.decay = 1.6;
      l.intensity = n.K.glow * this.nightFactor * 420;
      l.visible = l.intensity > 0.01;
    }
    return near.length;
  }

  /** 0 by day, 1 at night. The renderer sets it from the same sun elevation the sky uses. */
  setNightFactor(v) {
    const n = Math.max(0, Math.min(1, v));
    if (n === this.nightFactor) return n;
    this.nightFactor = n;
    if (this.sigLights) this.updateSignatureLights(this.focus[0], this.focus[1]);
    return n;
  }

  _sigGeo(kind) {
    const k = `sig:${kind}`;
    if (!this.geoCache.has(k)) {
      const g = signatureGeometry(kind);
      if (g.body) g.body.userData.shared = true;
      if (g.glow) g.glow.userData.shared = true;
      this.geoCache.set(k, g);
    }
    return this.geoCache.get(k);
  }

  _sigMat(kind, ri) {
    this.sigMats = this.sigMats || new Map();
    if (!this.sigMats.has(kind)) this.sigMats.set(kind, signatureMaterials(kind, this.field.regions[ri]));
    return this.sigMats.get(kind);
  }

  _geo(kind, r) {
    const key = `${kind}:${r.id}`;
    if (this.geoCache.has(key)) return this.geoCache.get(key);
    const p = r.props;
    let geo;
    switch (kind) {
      case 'trunk': {
        const h = p.canopy.h;
        if (p.canopy.shape === 'arch') {
          // Organic root arch: an asymmetric Bezier tube rather than a repeated perfect torus.
          const rr=p.canopy.r, tube=Math.min(.17,rr*.043);
          const curve=new THREE.QuadraticBezierCurve3(new THREE.Vector3(0,0,-rr),new THREE.Vector3(rr*.24,rr*1.18,rr*.08),new THREE.Vector3(0,0,rr));
          const fork=new THREE.QuadraticBezierCurve3(new THREE.Vector3(0,0,-rr*.25),new THREE.Vector3(-rr*.72,rr*.58,0),new THREE.Vector3(-rr*.48,rr*.95,rr*.12));
          geo=mergeAll([new THREE.TubeGeometry(curve,12,tube,7,false),new THREE.TubeGeometry(fork,7,tube*.58,6,false)]);
        }
        else {
          // A TRUNK IS SIZED BY THE TREE'S HEIGHT, NOT BY ITS CROWN. Deriving it from the crown
          // radius — which is what this did — gave Blackwood a 4.4 m thick bole every six metres,
          // because a 19 m hardwood declares a 6.4 m crown and 0.34 of that is 2.18 m. Thirty-nine
          // per cent of the region's ground was inside a trunk and a random eye-height frame was a
          // photograph of bark. Real closed forest is 0.6-1.3 m at breast height; the flare at the
          // base of a buttressed hardwood is the 1.8x taper below, not a doubling of the radius.
          const rt = clamp(0.038 * h, 0.10, Math.min(0.95, p.canopy.r * 0.34));
          geo = branchedTrunk(h,rt,p.canopy.r);
        }
        break;
      }
      case 'crown': {
        const h = p.canopy.h, rr = p.canopy.r;
        geo=organicCrown(p.canopy.shape,rr,h);
        break;
      }
      case 'under': {
        const h = p.under.h;
        const width = p.under.shape === 'crust' ? 1.45 : p.under.shape === 'comb' ? 1.25 : Math.max(.48, h * .44);
        geo = proceduralFan(p.under.shape,width,Math.max(.28,h),false);
        break;
      }
      // The ordinary underfoot material. Unit geometry, authored at its declared height, kept
      // under a dozen triangles because there are up to 2,400 of them in a tile and the target
      // is a software rasteriser.
      case 'cover': {
        const h = p.cover.h;
        if (COVER_CARD[p.cover.shape] !== undefined) {
          const width = p.cover.shape === 'reed' ? Math.max(.22, h * .42) : Math.max(.36, h * .82);
          geo = proceduralFan(p.cover.shape,width,Math.max(.14,h),true);
          break;
        }
        switch (p.cover.shape) {
          case 'litter':  geo = new THREE.CircleGeometry(0.62, 5).rotateX(-Math.PI / 2).rotateZ(0.14); geo.translate(0, h, 0); break;
          case 'plate':   geo = new THREE.CylinderGeometry(0.60, 0.52, h, 6); geo.translate(0, h / 2, 0); break;
          case 'flag':    geo = new THREE.BoxGeometry(1.15, h, 0.82); geo.translate(0, h / 2, 0); break;
          case 'cobble':  geo = new THREE.SphereGeometry(0.38, 6, 3, 0, Math.PI * 2, 0, Math.PI / 2); geo.scale(1, h / 0.38, 1); break;
          case 'shell':   geo = new THREE.SphereGeometry(0.26, 5, 2, 0, Math.PI * 2, 0, Math.PI / 2); geo.scale(1.5, h / 0.26, 1); break;
          case 'tussock': geo = new THREE.ConeGeometry(0.46, h, 5); geo.translate(0, h / 2, 0); break;
          case 'tuft':    geo = new THREE.ConeGeometry(0.24, h, 4); geo.translate(0, h / 2, 0); break;
          case 'flake':   geo = new THREE.ConeGeometry(0.15, h, 3); geo.translate(0, h / 2, 0); break;
          case 'gravel':  geo = new THREE.IcosahedronGeometry(0.21, 0); geo.scale(1, h / 0.21, 1); break;
          case 'stubble': geo = new THREE.CylinderGeometry(0.05, 0.07, h, 4); geo.translate(0, h / 2, 0); break;
          case 'wax':     geo = new THREE.CylinderGeometry(0.52, 0.52, h, 6, 1, true); geo.translate(0, h / 2, 0); break;
          case 'reed':    geo = new THREE.PlaneGeometry(0.13, h); geo.translate(0, h / 2, 0); break;
          default:        geo = new THREE.CircleGeometry(0.5, 5).rotateX(-Math.PI / 2); geo.translate(0, h, 0);
        }
        break;
      }
      default: geo = new THREE.IcosahedronGeometry(1, 0);
    }
    // Shared: every tile, the near disc and the cover disc instance the SAME geometry object.
    // `_release` and the disc rebuilds must not dispose it — see the note there.
    geo.userData.shared = true;
    this.geoCache.set(key, geo);
    return geo;
  }

  /**
   * Flora, rock and ground cover on one shared lattice, arranged by the region's own rule.
   *
   * Four layers now, not three. The fourth — `cover` — is the ordinary underfoot material, and
   * it exists because that is what most of every frame is made of: leaf mulch, curled clay
   * plates, barnacle shell hash, wax cell rims, scree. It is instanced in CLUMPS around each
   * lattice site so a 6.5 m lattice can carry sub-metre ground texture at one ground-height
   * query per site.
   *
   * Vertical structure is per region too: `h_var` is how ragged the canopy height is, `lean_deg`
   * how far it leans, `emergent` whether a few giants break through the roof. A flat ceiling of
   * identical 4 m cones and a broken one with 20 m emergents are different skylines built from
   * the same primitive.
   */
  _scatter(group, ox, oz) {
    const f = this.field;
    const area = TILE_M * TILE_M / 100;      // in units of 100 m2
    const buckets = new Map();
    // One Poisson-ish jittered lattice per tile, sampled at the LOCAL region's density: the same
    // point set feeds every layer, so density is a per-region measurable and not a per-mesh mood.
    const N = 46;
    for (let iz = 0; iz < N; iz++) {
      for (let ix = 0; ix < N; ix++) {
        const jx = noise2(ix * 1.7 + ox, iz * 2.3 + oz, 7717);
        const jz = noise2(ix * 2.9 + ox, iz * 1.3 + oz, 7723);
        const x = ox + (ix + jx) * (TILE_M / N), z = oz + (iz + jz) * (TILE_M / N);
        if (!f.isLandAt(x, z)) continue;
        // W1-02 / RI-WLD12 §2. The FLORA axis. It crosses just after the palette and well before
        // the architecture, so the far region's plants appear over a band rather than at a line —
        // "the comberry thins before the ash arrives". The site is placed with the axis's region,
        // which means density, arrangement, shape and colour all come from it together and a
        // half-crossed border is not a chimera of two prop sets on one lattice.
        const ri = f.axisRegionIndexAt(x, z, 'flora');
        const p = f.regions[ri].props;
        const y = this._meshY(x, z);
        const cellArea = area / (N * N) * 100;      // m2 per lattice cell
        // UNIFORM rolls, hashed on the lattice cell. These used to be `noise2` of the position,
        // which is smoothstep-interpolated value noise concentrated around 0.5 — so P(roll < t)
        // was not t, and every region realised roughly half its declared per-100 m2 density with
        // the error depending nonlinearly on the threshold. `regions.json` declares a density and
        // RI-WLD04 M18 scores it; it should be the density that appears.
        const roll = hash2(ix + ox, iz + oz, 7741);
        const roll2 = hash2(ix + ox, iz + oz, 7757);
        const roll3 = hash2(ix + ox, iz + oz, 7761);
        const roll4 = hash2(ix + ox, iz + oz, 7767);
        // The region's arrangement rule, once per site. Tall things obey it fully; the ground
        // layers obey a softened version so the gaps between clumps are bare and not empty.
        const aTall = arrangeAt(f, x, z, p.arrangement, 1.0);
        const aLow = arrangeAt(f, x, z, p.arrangement, 0.45);
        // The per-tile instance cap, applied as a UNIFORM THINNING rather than as truncation.
        // Taking the first N instances in scan order — which is what the cap used to do — puts a
        // region whose declared density exceeds the budget entirely in the low-z half of its own
        // tile, and leaves the rest of it bald. Thornmarsh declares 5.4 canopy per 100 m2, which
        // is 4,860 in a 300 m tile against a budget of 700, so this was visible.
        const cap = (kind, per100) => Math.min(1, MAX_INSTANCES[kind] / Math.max(1e-6, per100 * TILE_M * TILE_M / 100));
        this._placeSite(buckets, 'tile', ri, x, z, y, cellArea, {
          canopy: p.canopy.per100m2 * cap('canopy', p.canopy.per100m2) * aTall,
          under: p.under.per100m2 * cap('under', p.under.per100m2) * aLow,
          rock: p.rock.per100m2 * cap('rock', p.rock.per100m2) * aTall,
        }, [roll, roll2, roll3, roll4], MAX_INSTANCES);
      }
    }
    for (const b of buckets.values()) {
      if (!b.xf.length) continue;
      const im = new THREE.InstancedMesh(b.geo, b.mat, b.xf.length);
      for (let i = 0; i < b.xf.length; i++) im.setMatrixAt(i, b.xf[i]);
      im.instanceMatrix.needsUpdate = true;
      im.castShadow = b.kind !== 'under' && b.kind !== 'cover';
      im.receiveShadow = true;
      im.name = `${b.kind}:${this.field.regions[b.ri].id}`;
      im.frustumCulled = true;
      group.add(im);
    }
  }

  stats() {
    let instances = 0, meshes = 0;
    this.group.traverse((o) => { if (o.isInstancedMesh) { instances += o.count; meshes++; } else if (o.isMesh) meshes++; });
    return {
      tilesResident: this.tiles.size, tilesQueued: this.queue.length, tilesBuiltTotal: this.built,
      tileSizeM: this.tileM, residentRadiusTiles: this.radiusTiles, meshes, instances,
      groundCoverInstances: this.coverCount || 0, groundCoverRadiusM: COVER_RADIUS_M,
      lodBands: this.lodBands,
      lodTransition: 'near/far geometry and PBR material overlap; one-tile release hysteresis',
      sharedGeometryPool: this.geoCache.size,
      // W1-04 r3. `settlementsPlanned` is what was READ; `buildingGroups` is what is in the
      // scene graph right now. They differ whenever a town's tile is not resident, and they
      // differ by everything when `drawBuildings` is cut.
      settlementsPlanned: this.settlementPlans.length,
      settlementsDrawn: this.group.children.reduce((n, t) => n + t.children.filter((c) => c.name && c.name.startsWith('settlement:')).length, 0),
      buildingGroups: this.group.children.reduce((n, t) => {
        for (const c of t.children) if (c.name && c.name.startsWith('settlement:')) n += c.children.filter((b) => b.name && b.name.startsWith('building:')).length;
        return n;
      }, 0),
      drawBuildings: !!this.drawBuildings,
    };
  }

  /** Final-reference teardown. Shared geometry/materials are released exactly once here, never
   * while a resident tile or camera-following detail disc may still reference them. */
  dispose() {
    for (const [k, t] of [...this.tiles]) this._release(k, t);
    for (const g of this.geoCache.values()) g.dispose();
    this.geoCache.clear();
    const materials = new Set([...Object.values(this.mats), ...this.regionMats.flatMap((r) => Object.values(r))]);
    for (const m of materials) if (m && typeof m.dispose === 'function') m.dispose();
    this.group.removeFromParent();
  }
}
