// The renderable world.
//
// SCOPE. Wave-1 piece W1-00 owns the harness, not the province — W1-01..W1-05 build the
// 14.5 km² of Argonia whose coordinates are in `game/data/world/`. What this file must
// deliver is the thing without which *nothing visual in the corpus can be scored at all*:
// a real scene that the twelve canonical viewpoints in `tools/harness/viewpoints.json`
// resolve against. Those viewpoints carry absolute camera poses near the origin, so the
// playable patch is a **420 m neighbourhood at the world origin**, and every cell —
// exterior, interior, dungeon, arena — is built at the origin and switched by visibility
// rather than by position. A shot at an unlisted pose is not admissible evidence
// (HARNESS.md §6), so the poses are the spec and the layout answers to them:
//
//   VP01/02/09/10  (120, 22, -80) → (0, 6, 0)    long vista, sky, night, storm
//   VP03           (8, 1.7, 12)   → (24, 3, 20)  canopy interior, looking east into trees
//   VP04           (4, 1.7, -6)   → (4, 1.6, 18) settlement street, looking north up it
//   VP05           (0, 1.6, -3)   → (0, 1.4, 3)  interior, hearth at z = +3
//   VP06           (-6, 1.4, -2)  → (10, 0.6, 10) water at a grazing angle across the basin
//   VP07           (0, 1.65, 1.6) → (0, 1.6, 0)  character close-up, actor at the origin
//   VP08           (0, 0.9, 0.6)  → (0, 0.5, 0)  material junction at the origin
//   VP11           (0, 1.6, -4)   → (0, 1.5, 6)  dark dungeon corridor along +z
//   VP12           gameplay framing in the arena
//
// Determinism: the scene is generated from a value-noise hash of integer coordinates. It
// uses NEITHER Math.random NOR the simulation PRNG — consuming sim draws while building the
// scene would make the trace depend on whether the renderer had run, which is RI-MTH02
// "How we lose" #5 wearing a different hat.
'use strict';

import * as THREE from '../../vendor/three/three.module.js';
import { buildPlaces } from './places.js';
import { makeRiggedActor } from './actor.js';
import { worldMaterial } from './visual-foundation.js';

// ---- deterministic value noise (integer hash; no PRNG state, no draws) ----------------
function hash2(x, y, s) {
  let h = (x * 374761393 + y * 668265263 + s * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function noise2(x, y, s) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi, s), b = hash2(xi + 1, yi, s);
  const c = hash2(xi, yi + 1, s), d = hash2(xi + 1, yi + 1, s);
  return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v;
}
function fbm(x, z, s) {
  let h = 0, amp = 1, freq = 1 / 95, sum = 0;
  for (let o = 0; o < 4; o++) { h += noise2(x * freq, z * freq, s + o) * amp; sum += amp; amp *= 0.47; freq *= 2.09; }
  return h / sum;
}

export const WATER_LEVEL = 0.0;
export const BASIN = { x: -4, z: 2, r: 9.5, depth: 1.8 };
export const STREET = { x: 4, z0: -12, z1: 20, halfWidth: 5.0 };
// Trees are cleared well beyond the houses, not just the walkway: a settlement under a
// closed canopy is in permanent shade and VP04 comes back black.
const STREET_CLEARING = 13.0;

/** Ground height at a point in the patch. Pure, deterministic, and shared by the sim. */
export function terrainHeight(x, z, seed) {
  const r = Math.hypot(x, z);
  // The near field is a flat marsh at ~0.15 m; the far field rises into ridges so the
  // vista has silhouette layering to measure.
  const w = clamp01((r - 48) / 78);
  const flat = 0.15 + (noise2(x * 0.09, z * 0.09, seed + 5) - 0.5) * 0.34;
  const hills = (fbm(x, z, seed) - 0.40) * 34.0;
  let h = flat * (1 - w) + hills * w + (w > 0 ? 0 : 0);
  // The basin: dug below the waterline so there is standing water with a real shoreline.
  const d = Math.hypot(x - BASIN.x, z - BASIN.z);
  if (d < BASIN.r) h -= Math.pow(1 - d / BASIN.r, 1.4) * BASIN.depth;
  return h;
}

/** True inside the settlement corridor, where the canopy is cleared. */
function inStreetCorridor(x, z) {
  return Math.abs(x - STREET.x) < STREET_CLEARING && z > STREET.z0 - 8 && z < STREET.z1 + 8;
}

const TERRAIN_SIZE = 420;
const TERRAIN_SEGS = 200;      // 80,000 triangles in one draw call

export function buildScene(seed) {
  const scene = new THREE.Scene();
  const anchors = {};
  const cells = {
    exterior: new THREE.Group(),
    interior: new THREE.Group(),
    dungeon: new THREE.Group(),
    arena: new THREE.Group(),
  };
  const props = { npcShowcase: new THREE.Group(), materialShowcase: new THREE.Group() };
  for (const g of Object.values(cells)) scene.add(g);
  for (const g of Object.values(props)) { scene.add(g); g.visible = false; }

  const M=(family,color,extra={})=>worldMaterial(family,{color,...extra});
  const mats = {
    ground:M('mud',0xffffff,{vertexColors:true}), water:M('water',0x24352c,{transparent:true,opacity:.86}),
    bark:M('bark',0x453728), leaf:M('leaf',0x33492a), reed:M('reed',0x6c7a3c,{side:THREE.DoubleSide}),
    wall:M('clay',0x6b5a44), roof:M('root',0x3d3428), plank:M('timber',0x554634),
    stone:M('stone',0x7a7a70), darkStone:M('stone',0x39383a,{roughness:.88}),
    skin:M('skin',0xb9ad8e), cloth:M('cloth',0x54341f), metal:M('metal',0xa8adb4), moss:M('leaf',0x4c5c36),
    chitin:M('chitin',0x684c36), wet_chitin:M('wet_chitin',0x354945), bone:M('bone',0xc5b98e),
    ember:M('resin',0xff7a2e,{emissive:0xff4a12,emissiveIntensity:3.2,roughness:.28}),
  };

  // ---- terrain -------------------------------------------------------------------------
  const geo = new THREE.PlaneGeometry(TERRAIN_SIZE, TERRAIN_SIZE, TERRAIN_SEGS, TERRAIN_SEGS);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const colours = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    const y = terrainHeight(x, z, seed);
    pos.setY(i, y);
    const wet = clamp01((0.6 - y) / 1.8);
    const high = clamp01((y - 6.0) / 6.0);
    // Two octaves of mottle, so the ground is not a flat wash of one albedo: the edge
    // density and flat-shading metrics both read a single-colour terrain as absent detail.
    const mottle = noise2(x * 0.31, z * 0.31, seed + 21) * 0.10 + noise2(x * 1.7, z * 1.7, seed + 33) * 0.05;
    colours[i * 3 + 0] = lerp(lerp(0.115, 0.170, wet), 0.255, high) + mottle * 0.55;
    colours[i * 3 + 1] = lerp(lerp(0.150, 0.155, wet), 0.250, high) + mottle;
    colours[i * 3 + 2] = lerp(lerp(0.075, 0.125, wet), 0.235, high) + mottle * 0.42;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colours, 3));
  const terrainUV=geo.attributes.uv;
  for(let i=0;i<pos.count;i++) terrainUV.setXY(i,pos.getX(i)/3,pos.getZ(i)/3);
  terrainUV.needsUpdate=true;
  geo.computeVertexNormals();
  const terrain = new THREE.Mesh(geo, mats.ground);
  terrain.receiveShadow = true;
  terrain.name = 'terrain';
  cells.exterior.add(terrain);

  // ---- standing water ---------------------------------------------------------------------
  const water = new THREE.Mesh(new THREE.PlaneGeometry(TERRAIN_SIZE, TERRAIN_SIZE, 1, 1).rotateX(-Math.PI / 2), mats.water);
  water.position.y = WATER_LEVEL;
  water.name = 'water';
  cells.exterior.add(water);

  // ---- canopy ---------------------------------------------------------------------------
  const TREES = 320;
  const trunkGeo = new THREE.CylinderGeometry(0.24, 0.46, 8.0, 6, 1); trunkGeo.translate(0, 4.0, 0);
  const canopyGeo = new THREE.DodecahedronGeometry(2.65, 1);
  const trunks = new THREE.InstancedMesh(trunkGeo, mats.bark, TREES);
  const canopies = [0,1,2].map(i=>{const im=new THREE.InstancedMesh(canopyGeo,mats.leaf,TREES);im.name=`canopy-lobe:${i}`;return im;});
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), s = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  let placed = 0;
  for (let i = 0; placed < TREES && i < TREES * 30; i++) {
    // Bias hard toward the near field so VP03's canopy shot is actually dense.
    const near = (i % 3) !== 0;
    const span = near ? 70 : TERRAIN_SIZE * 0.9;
    const x = (hash2(i, 7, seed) - 0.5) * span + (near ? 16 : 0);
    const z = (hash2(i, 11, seed) - 0.5) * span + (near ? 22 : 0);
    const y = terrainHeight(x, z, seed);
    if (y < 0.12 || y > 11.0) continue;
    if (inStreetCorridor(x, z)) continue;
    if (Math.hypot(x, z) < 3.2) continue;             // keep the origin clear for VP07/VP08
    const sc = 0.75 + hash2(i, 13, seed) * 1.0;
    q.setFromAxisAngle(up, hash2(i, 17, seed) * Math.PI * 2);
    v.set(x, y, z); s.set(sc, sc * (0.85 + hash2(i, 19, seed) * 0.55), sc);
    m.compose(v, q, s); trunks.setMatrixAt(placed, m);
    const crownY=y+7.0*s.y, crownSc=sc*(0.9+hash2(i,23,seed)*0.5);
    for(let l=0;l<canopies.length;l++){
      const a=hash2(i,l+71,seed)*Math.PI*2,rad=l===0?0:crownSc*(1.25+l*.22);
      v.set(x+Math.cos(a)*rad,crownY-(l===0?0:crownSc*.35),z+Math.sin(a)*rad);
      s.set(crownSc*(l===0?1.15:.72),crownSc*(l===0?.84:.68),crownSc*(l===0?1.05:.78));m.compose(v,q,s);canopies[l].setMatrixAt(placed,m);
    }
    placed++;
  }
  trunks.count=placed;trunks.castShadow=true;trunks.name='trunks';
  for(const c of canopies){c.count=placed;c.castShadow=true;c.receiveShadow=true;}
  cells.exterior.add(trunks,...canopies);

  // ---- reeds at the shoreline ---------------------------------------------------------------
  const REEDS = 1100;
  const reedGeo = new THREE.PlaneGeometry(0.85, 1.7); reedGeo.translate(0, 0.85, 0);
  const reeds = new THREE.InstancedMesh(reedGeo, mats.reed, REEDS);
  let rp = 0;
  for (let i = 0; rp < REEDS && i < REEDS * 24; i++) {
    const near = (i % 2) === 0;
    const span = near ? 46 : TERRAIN_SIZE * 0.85;
    const x = (hash2(i, 29, seed) - 0.5) * span + (near ? BASIN.x : 0);
    const z = (hash2(i, 31, seed) - 0.5) * span + (near ? BASIN.z : 0);
    const y = terrainHeight(x, z, seed);
    // Reeds belong at the waterline, not everywhere the marsh happens to be flat: a
    // 1.7 m reed bed spread across the whole near field puts the eye-height viewpoints
    // inside a wall of foliage.
    if (y < -0.70 || y > 0.02) continue;
    if (inStreetCorridor(x, z)) continue;
    q.setFromAxisAngle(up, hash2(i, 37, seed) * Math.PI);
    v.set(x, y, z); s.setScalar(0.7 + hash2(i, 41, seed) * 0.9);
    m.compose(v, q, s);
    reeds.setMatrixAt(rp++, m);
  }
  reeds.count = rp;
  reeds.name = 'reeds';
  cells.exterior.add(reeds);

  // ---- the settlement street (VP04) ----------------------------------------------------------
  const settlement = new THREE.Group();
  settlement.name = 'settlement';
  const walkY = 0.55;
  const walk = new THREE.Mesh(new THREE.BoxGeometry(5.0, 0.22, STREET.z1 - STREET.z0), mats.plank);
  walk.position.set(STREET.x, walkY, (STREET.z0 + STREET.z1) / 2);
  walk.receiveShadow = true;
  settlement.add(walk);
  for (let i = 0; i < 16; i++) {
    const side = i % 2 ? 1 : -1;
    const zz = STREET.z0 + 1.5 + i * ((STREET.z1 - STREET.z0 - 3) / 15);
    const bx = STREET.x + side * (4.4 + hash2(i, 43, seed) * 1.6);
    const w = 3.0 + hash2(i, 47, seed) * 2.0, h = 2.9 + hash2(i, 53, seed) * 2.4, d = 3.2 + hash2(i, 59, seed) * 1.8;
    // The origin is the framing point for VP07 and VP08 and must stay clear of buildings.
    if (Math.hypot(bx, zz) < 6.5) continue;
    const base = Math.max(walkY, terrainHeight(bx, zz, seed));
    const house = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mats.wall);
    house.position.set(bx, base + h / 2 + 0.4, zz);house.castShadow=true;house.receiveShadow=true;
    const roof = new THREE.Mesh(new THREE.ConeGeometry(Math.max(w, d) * 0.80, 1.8, 4), mats.roof);
    roof.position.set(bx, base + h + 1.3, zz);
    roof.rotation.y = Math.PI / 4;
    roof.castShadow = true;
    settlement.add(house, roof);
    // Layered public facade: foundation, corner posts, recessed door and framed windows. The
    // original single box/cone pair read as a blockout even at street distance.
    const front=zz-side*d*.52;
    const foundation=new THREE.Mesh(new THREE.BoxGeometry(w+.34,.42,d+.34),mats.stone);foundation.position.set(bx,base+.20,zz);foundation.receiveShadow=true;settlement.add(foundation);
    for(const sx of [-1,1]){const post=new THREE.Mesh(new THREE.CylinderGeometry(.10,.17,h*.9,7),mats.bark);post.position.set(bx+sx*w*.43,base+h*.49,front);post.rotation.z=sx*.035;post.castShadow=true;settlement.add(post);}
    const door=new THREE.Mesh(new THREE.BoxGeometry(.86,1.72,.10),mats.plank);door.position.set(bx,base+1.27,front);door.rotation.y=side<0?0:Math.PI;door.castShadow=true;settlement.add(door);
    for(const sx of [-1,1]){const pane=new THREE.Mesh(new THREE.BoxGeometry(.54,.60,.07),mats.resin||mats.chitin);pane.position.set(bx+sx*w*.27,base+h*.58,front);settlement.add(pane);const sill=new THREE.Mesh(new THREE.BoxGeometry(.70,.09,.13),mats.bone);sill.position.set(pane.position.x,pane.position.y-.35,front);settlement.add(sill);}
    for (let k = 0; k < 4; k++) {
      const st = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 2.2, 5), mats.plank);
      st.position.set(bx + (k % 2 ? 1 : -1) * w * 0.4, base - 0.5, zz + (k < 2 ? 1 : -1) * d * 0.4);
      st.castShadow = true;
      settlement.add(st);
    }
  }
  // A gate frame at the far end, so the street has a terminus to read against.
  for (const sx of [-1, 1]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.5, 5.5, 0.5), mats.bark);
    post.position.set(STREET.x + sx * 2.6, walkY + 2.75, STREET.z1 - 1);
    post.castShadow = true; settlement.add(post);
  }
  const lintel = new THREE.Mesh(new THREE.BoxGeometry(6.2, 0.6, 0.6), mats.bark);
  lintel.position.set(STREET.x, walkY + 5.6, STREET.z1 - 1);
  lintel.castShadow = true; settlement.add(lintel);
  cells.exterior.add(settlement);

  // ---- a ruin on the ridge, for the vista silhouette ---------------------------------------
  const ruin = new THREE.Group();
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const rx = -52 + Math.cos(a) * 9.0, rz = -30 + Math.sin(a) * 9.0;
    const b = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.4 + hash2(i, 61, seed) * 3.4, 2.6), mats.stone);
    b.position.set(rx, terrainHeight(rx, rz, seed) + 1.2, rz);
    b.rotation.y = hash2(i, 67, seed) * 0.8;
    b.castShadow = true; b.receiveShadow = true;
    ruin.add(b);
  }
  ruin.name = 'ruin';
  cells.exterior.add(ruin);

  // ---- interior: a hall lit by one hearth (VP05) ---------------------------------------------
  buildHall(cells.interior, mats);

  // ---- dungeon: a dark stone corridor along +z (VP11) ------------------------------------------
  buildDungeon(cells.dungeon, mats);

  // ---- W1-07's five rooms: the barge hold, the Writ House, and the three states the
  // reference items name by id (helstrom-market, stormhold-street, rootlands-well-graph).
  for (const [id, group] of Object.entries(buildPlaces(mats))) {
    cells[id] = group;
    scene.add(group);
  }

  // ---- arena: an authored, layered combat bowl (VP12) -------------------------------------------
  const arenaFloor = new THREE.Mesh(new THREE.CircleGeometry(30, 72).rotateX(-Math.PI / 2),
    M('wet_mud',0x625b4e,{roughness:.66}));
  arenaFloor.receiveShadow = true;
  arenaFloor.name='arena-wet-stone-floor';
  cells.arena.add(arenaFloor);
  const arenaFill=new THREE.HemisphereLight(0xdce6e5,0x756250,2.05);
  arenaFill.name='arena-bounded-readable-fill';cells.arena.add(arenaFill);
  const arenaAmbient=new THREE.AmbientLight(0xa3aca7,.62);arenaAmbient.name='arena-bounded-charcoal-fill';cells.arena.add(arenaAmbient);
  const arenaKey=new THREE.DirectionalLight(0xffe0b2,2.2);arenaKey.position.set(-9,14,-7);
  arenaKey.name='arena-warm-raking-key';arenaKey.castShadow=true;arenaKey.shadow.mapSize.set(1024,1024);cells.arena.add(arenaKey);
  // Radial courses, irregular in value and material, carry scale through combat-camera motion.
  // These lie under actors and retain the original flat collision surface.
  const courseMats=[
    M('stone',0x77766c,{roughness:.82}),M('wet_mud',0x514c41,{roughness:.72}),
    M('stone',0x656b67,{roughness:.76}),M('wet_mud',0x6c5a47,{roughness:.69})
  ];
  for(let band=0;band<4;band++){
    const inner=2.2+band*5.15,outer=inner+4.55;
    for(let sector=0;sector<16;sector++){
      if((sector+band*3)%11===0)continue;
      const a0=sector*Math.PI/8+.018,a1=(sector+1)*Math.PI/8-.024;
      const patch=new THREE.Mesh(new THREE.RingGeometry(inner,outer,7,1,a0,a1-a0).rotateX(-Math.PI/2),courseMats[(sector+band)%courseMats.length]);
      patch.position.y=.022+band*.002;patch.rotation.y=(hash2(sector,band+700,seed)-.5)*.018;
      patch.receiveShadow=true;patch.name='arena-radial-weathered-course';cells.arena.add(patch);
    }
  }
  // Broken inlay rings give movement scale and keep the player from floating on an empty disc.
  for(const [radius,tube,colour] of [[7.2,.12,0x877353],[13.5,.18,0x554c3c],[21,.24,0x45443d]]){
    const ring=new THREE.Mesh(new THREE.TorusGeometry(radius,tube,6,96),M('stone',colour,{roughness:.74}));
    ring.rotation.x=Math.PI/2;ring.position.y=.035;ring.receiveShadow=true;ring.name='arena-weathered-inlay';cells.arena.add(ring);
  }
  const rockGeo=[new THREE.DodecahedronGeometry(1,1),new THREE.IcosahedronGeometry(1,1)];
  const arenaRock=[M('stone',0x717b78,{roughness:.78,emissive:0x171c1d,emissiveIntensity:.22}),M('stone',0x898376,{roughness:.84,emissive:0x1c1a16,emissiveIntensity:.18}),M('stone',0x606b6d,{roughness:.72,emissive:0x121719,emissiveIntensity:.24})];
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * Math.PI * 2;
    const radius=25.5+hash2(i,301,seed)*4;
    const cliff=new THREE.Group();cliff.position.set(Math.cos(a)*radius,0,Math.sin(a)*radius);cliff.rotation.y=-a;
    // Six modest, overlapping strata form a broken bowl.  The former four oversized boulders
    // per sector read as identical blobs and erased the combat silhouette against black.
    for(let k=0;k<6;k++){
      const r=new THREE.Mesh(rockGeo[(i+k)&1],arenaRock[(i+k)%arenaRock.length]);
      const sc=.52+hash2(i*7+k,307,seed)*.82;
      r.scale.set(sc*(.82+hash2(i,k,seed)*.45),sc*(1.05+hash2(i,k+3,seed)*1.05),sc*(.72+hash2(i,k+5,seed)*.46));
      r.position.set((k-2.5)*.67,Math.max(.28,r.scale.y*.70),hash2(i,k+11,seed)*1.65-.82);r.rotation.set(hash2(i,k+19,seed)*.42,hash2(i,k+23,seed)*Math.PI,.08*(k-2.5));r.castShadow=r.receiveShadow=true;cliff.add(r);
    }
    // Only some uprights survive: repetition becomes history rather than a fence of cylinders.
    if(i%3===0){const pil=new THREE.Mesh(new THREE.CylinderGeometry(.45,.7,3.2+(i%4),10),mats.stone);pil.position.set(0,1.6+(i%4)*.5,0);pil.rotation.z=(hash2(i,331,seed)-.5)*.18;pil.castShadow=true;cliff.add(pil);}
    cells.arena.add(cliff);
  }
  // Broken root screens, puddles and debris provide parallax and surface contacts without
  // changing the collision ring. They share materials/geometries and stay outside combat space.
  const rootGeo=new THREE.CylinderGeometry(.10,.20,2.6,7);rootGeo.translate(0,1.3,0);
  const shardGeo=new THREE.DodecahedronGeometry(.18,0);
  for(let i=0;i<32;i++){
    const a=i*.91,r=15.5+(i%5)*1.45,x=Math.cos(a)*r,z=Math.sin(a)*r;
    const root=new THREE.Mesh(rootGeo,mats.bark);root.position.set(x,0,z);root.rotation.set((hash2(i,401,seed)-.5)*.35,a,(hash2(i,409,seed)-.5)*.48);root.scale.y=.65+hash2(i,411,seed)*.8;root.castShadow=true;cells.arena.add(root);
    const shard=new THREE.Mesh(shardGeo,arenaRock[i%3]);shard.position.set(x+Math.sin(a)*.8,.14,z-Math.cos(a)*.8);shard.scale.set(.7+hash2(i,419,seed),.35+hash2(i,421,seed)*.65,.8);shard.rotation.y=a*.7;shard.castShadow=true;cells.arena.add(shard);
  }
  // Root-and-stone portals make the enclosing bowl read as an authored place instead of a ring
  // of repeated rocks. Their openings remain outside the combat collision radius.
  for(const a of [-2.32,-.34,1.63]){
    const portal=new THREE.Group();const px=Math.cos(a)*24.6,pz=Math.sin(a)*24.6;
    portal.position.set(px,0,pz);portal.rotation.y=-a+Math.PI/2;
    for(const sx of [-1,1]){
      const pier=new THREE.Mesh(new THREE.CylinderGeometry(.48,.78,5.8,9),arenaRock[sx>0?1:0]);
      pier.position.set(sx*2.05,2.8,0);pier.rotation.z=-sx*.10;pier.castShadow=true;portal.add(pier);
      const root=new THREE.Mesh(new THREE.CylinderGeometry(.16,.34,5.3,7),mats.bark);
      root.position.set(sx*1.55,4.15,0);root.rotation.z=sx*.68;root.castShadow=true;portal.add(root);
    }
    const lintel=new THREE.Mesh(new THREE.BoxGeometry(4.9,.72,.92),arenaRock[2]);lintel.position.y=5.35;lintel.rotation.z=.035;lintel.castShadow=true;portal.add(lintel);
    const sigil=new THREE.Mesh(new THREE.TorusGeometry(.68,.11,7,18),mats.bone);sigil.position.set(0,4.1,-.52);sigil.castShadow=true;portal.add(sigil);
    cells.arena.add(portal);
  }
  for(const [x,z,s] of [[-5,4,2.2],[7,-4,1.7],[-11,-2,1.3]]){const puddle=new THREE.Mesh(new THREE.CircleGeometry(s,28).rotateX(-Math.PI/2),M('water',0x263f43,{transparent:true,opacity:.72,roughness:.22}));puddle.position.set(x,.045,z);puddle.name='arena-depth-integrated-puddle';cells.arena.add(puddle);}
  // Warm practicals against the cool sky reproduce the reference composition without a global
  // orange grade.  The point lights are bounded and do not affect simulation or hit readability.
  for(const [x,z] of [[-8,-9],[9,7]]){
    const brazier=new THREE.Group();brazier.position.set(x,0,z);
    const bowl=new THREE.Mesh(new THREE.CylinderGeometry(.42,.27,.34,10),mats.metal);bowl.position.y=.58;bowl.castShadow=true;
    const coal=new THREE.Mesh(new THREE.DodecahedronGeometry(.25,1),mats.ember);coal.position.y=.86;
    const light=new THREE.PointLight(0xff7b38,7.5,12,2);light.position.y=1.05;brazier.add(bowl,coal,light);cells.arena.add(brazier);
  }

  // ---- showcase props ------------------------------------------------------------------------
  // VP07 is the CHARACTER CLOSE-UP viewpoint — the pose every blind visual comparison of a
  // person is shot from — so it gets the rigged actor too, and is posed each frame by the
  // renderer once a rig exists to borrow a bone list from.
  const showcaseNpc = makeRiggedActor(mats, 0x6d5a3a, 0x9aa06e);
  showcaseNpc.position.set(0, 0.15, 0);
  showcaseNpc.rotation.y = 0;          // faces +z, which is where VP07's camera is
  props.npcShowcase.add(showcaseNpc);
  props.showcaseActor = showcaseNpc;

  // VP08: half a metre from a wall/ground junction. Three materials meeting, so the metric
  // has tiling, a normal break and a roughness contrast to read.
  const junctionWall = new THREE.Mesh(new THREE.BoxGeometry(3.0, 1.6, 0.35), mats.stone);
  junctionWall.position.set(0, 0.75, -0.35);
  junctionWall.castShadow = true; junctionWall.receiveShadow = true;
  const junctionPlinth = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.22, 1.1), mats.darkStone);
  junctionPlinth.position.set(0, 0.11, -0.05);
  junctionPlinth.receiveShadow = true;
  const junctionMoss = new THREE.Mesh(new THREE.BoxGeometry(3.0, 0.06, 0.7), mats.moss);
  junctionMoss.position.set(0, 0.24, 0.28);
  const junctionPlank = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.10, 0.55), mats.plank);
  junctionPlank.position.set(0, 0.20, 0.62);
  props.materialShowcase.add(junctionWall, junctionPlinth, junctionMoss, junctionPlank);

  // ---- the player ------------------------------------------------------------------------------
  // A RIGGED actor, not a welded silhouette: it grows its skinned body the first frame a live
  // `Rig` is handed to it (render/actor.js) and is driven bone-by-bone from the same pose the
  // hit resolution reads. Until W1-RENDER this was `makeActor()`, whose blade was a 0.95 m box
  // at a fixed offset for all 87 weapons.
  const player = makeRiggedActor(mats, 0x8f9aa6, 0x8d9a72);
  player.name = 'player';
  scene.add(player);

  // ---- anchors — every id referenced by tools/harness/viewpoints.json --------------------------
  anchors.vista_primary = new THREE.Vector3(0, terrainHeight(0, 0, seed), 0);
  anchors.swamp_canopy = new THREE.Vector3(8, terrainHeight(8, 12, seed), 12);
  anchors.settlement_primary_street = new THREE.Vector3(STREET.x, walkY, STREET.z0 + 2);
  anchors.interior_firelit = new THREE.Vector3(0, 0, -2);
  anchors.water_shallows = new THREE.Vector3(BASIN.x, WATER_LEVEL, BASIN.z);
  anchors.npc_showcase = new THREE.Vector3(0, 0.15, 0);
  anchors.material_showcase = new THREE.Vector3(0, 0.15, 1.2);
  anchors.dungeon_primary = new THREE.Vector3(0, 0, -2);
  anchors.arena_flat = new THREE.Vector3(0, 0, -5);
  anchors.barge_hold = new THREE.Vector3(0, 0, 0);
  anchors.writ_house = new THREE.Vector3(0, 0, -1.4);
  anchors.helstrom_market = new THREE.Vector3(0, 0, 0);
  anchors.stormhold_street = new THREE.Vector3(0, 0, 0);
  anchors.rootlands_well = new THREE.Vector3(0, 0, 0);

  return { scene, cells, props, anchors, terrain, water, player, mats };
}

function buildHall(root, mats) {
  const floor = new THREE.Mesh(new THREE.BoxGeometry(12, 0.3, 18), mats.plank);
  floor.position.y = -0.15; floor.receiveShadow = true; root.add(floor);
  for (const [w, h, d, px, py, pz] of [[12, 5.7, 0.35, 0, 2.85, -9], [12, 5.7, 0.35, 0, 2.85, 9], [0.35, 5.7, 18, -6, 2.85, 0], [0.35, 5.7, 18, 6, 2.85, 0]]) {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mats.wall);
    wall.position.set(px, py, pz); wall.castShadow = true; wall.receiveShadow = true; root.add(wall);
  }
  const ceiling = new THREE.Mesh(new THREE.BoxGeometry(12, 0.3, 18), mats.roof);
  ceiling.position.y = 5.65; root.add(ceiling);
  // Stone ribs, timber cross-members and wall pilasters turn the test box into a readable hall.
  for (let i = 0; i < 6; i++) {
    const z=-8+i*3.2;
    const rib = new THREE.Mesh(new THREE.TorusGeometry(5.72,.16,8,40,Math.PI), mats.stone);
    rib.position.set(0,.10,z);rib.castShadow=true;root.add(rib);
    const beam = new THREE.Mesh(new THREE.BoxGeometry(11.1, 0.20, 0.24), mats.bark);
    beam.position.set(0, 4.65, z); beam.castShadow = true; root.add(beam);
    for(const sx of [-1,1]){
      const pier=new THREE.Mesh(new THREE.CylinderGeometry(.24,.34,4.2,8),mats.stone);
      pier.position.set(sx*5.55,2.1,z);pier.castShadow=true;root.add(pier);
    }
  }
  // An inset processional path and side runners establish depth toward the throne.
  const runner=new THREE.Mesh(new THREE.BoxGeometry(2.35,.035,15.6),mats.cloth);runner.position.set(0,.025,0);runner.receiveShadow=true;root.add(runner);
  for(const sx of [-1,1]){const trim=new THREE.Mesh(new THREE.BoxGeometry(.12,.08,16.4),mats.metal);trim.position.set(sx*1.22,.07,0);root.add(trim);}
  const hearth = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.15, 0.5, 12), mats.stone);
  hearth.position.set(0, 0.25, 3.0); hearth.receiveShadow = true; root.add(hearth);
  const fire = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.48, 8, 2), mats.ember);
  fire.position.set(0, 0.60, 3.0); root.add(fire);
  for(let i=0;i<12;i++){
    const coal=new THREE.Mesh(new THREE.DodecahedronGeometry(.11+(i%3)*.025,0),mats.ember);
    coal.position.set(Math.cos(i*2.4)*(.25+(i%4)*.055),.54,3+Math.sin(i*2.4)*(.22+(i%3)*.05));root.add(coal);
  }
  const light = new THREE.PointLight(0xffa050, 18, 22, 2);
  light.position.set(0, 1.0, 3.0);
  light.castShadow = true; light.shadow.mapSize.set(512, 512); light.shadow.bias = -0.004;
  root.add(light);
  for (let i = 0; i < 8; i++) {
    const side=i%2?1:-1, z=-6.8+Math.floor(i/2)*3.1;
    const bench = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.18, .58), mats.plank);
    bench.position.set(side*3.55,.62,z);bench.rotation.z=side*.025;bench.castShadow=true;bench.receiveShadow=true;root.add(bench);
    for(const dx of [-.95,.95]){const leg=new THREE.Mesh(new THREE.CylinderGeometry(.08,.11,.62,7),mats.bark);leg.position.set(side*3.55+dx,.31,z);leg.castShadow=true;root.add(leg);}
  }
  const throne = new THREE.Group();throne.position.set(0,0,7.35);
  const seat=new THREE.Mesh(new THREE.BoxGeometry(1.35,.28,1.15),mats.bark);seat.position.y=.78;
  const back=new THREE.Mesh(new THREE.CapsuleGeometry(.68,1.05,6,12),mats.chitin);back.position.set(0,1.52,.36);back.scale.z=.34;
  const crest=new THREE.Mesh(new THREE.TorusGeometry(.72,.09,7,24,Math.PI),mats.bone);crest.position.set(0,2.05,.28);crest.rotation.x=.08;
  for(const sx of [-1,1]){const arm=new THREE.Mesh(new THREE.CylinderGeometry(.1,.14,1.15,8),mats.bark);arm.position.set(sx*.72,.72,0);arm.rotation.x=Math.PI/2;throne.add(arm);}
  throne.add(seat,back,crest);throne.traverse(o=>{if(o.isMesh)o.castShadow=true;});root.add(throne);
  root.visible = false;
}

function buildDungeon(root, mats) {
  const dungeonStone=mats.darkStone.clone();dungeonStone.color.setHex(0x505352);dungeonStone.roughness=.82;
  const floor = new THREE.Mesh(new THREE.BoxGeometry(6, 0.3, 46), dungeonStone);
  floor.position.set(0, -0.15, 12); floor.receiveShadow = true; root.add(floor);
  const ceil = new THREE.Mesh(new THREE.BoxGeometry(6, 0.3, 46), dungeonStone);
  ceil.position.set(0, 3.6, 12); root.add(ceil);
  for (const sx of [-1, 1]) {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(0.35, 3.6, 46), dungeonStone);
    wall.position.set(sx * 3, 1.8, 12); wall.castShadow = true; wall.receiveShadow = true; root.add(wall);
  }
  const endWall = new THREE.Mesh(new THREE.BoxGeometry(6, 3.6, 0.35), dungeonStone);
  endWall.position.set(0, 1.8, 34); root.add(endWall);
  const backWall = new THREE.Mesh(new THREE.BoxGeometry(6, 3.6, 0.35), dungeonStone);
  backWall.position.set(0, 1.8, -10); root.add(backWall);
  for (let i = 0; i < 7; i++) {
    const arch = new THREE.Mesh(new THREE.BoxGeometry(6.4, 0.5, 0.55), mats.stone);
    arch.position.set(0, 3.2, -6 + i * 6); arch.castShadow = true; root.add(arch);
    const rubble = new THREE.Mesh(new THREE.IcosahedronGeometry(0.5 + (i % 3) * 0.2, 0), mats.stone);
    rubble.position.set((i % 2 ? 1 : -1) * 1.9, 0.3, -4 + i * 5.6); rubble.castShadow = true; root.add(rubble);
  }
  // Broken floor courses prevent the corridor becoming one enormous black plane at native size.
  const slabMats=[mats.stone,dungeonStone,mats.moss];
  for(let iz=0;iz<18;iz++)for(let ix=0;ix<3;ix++){
    if((ix+iz*2)%13===0)continue;
    const slab=new THREE.Mesh(new THREE.BoxGeometry(1.72,.075,2.08),slabMats[(ix+iz)%slabMats.length]);
    slab.position.set(-1.82+ix*1.82,.02,-7.7+iz*2.32);slab.rotation.y=(hash2(ix,iz+820,3030)-.5)*.08;slab.receiveShadow=true;root.add(slab);
  }
  // Root buttresses and glowing fungus identify this as an Argonian rootway rather than a test box.
  for(let i=0;i<11;i++)for(const sx of [-1,1]){
    const z=-7+i*4.0;
    const rootRib=new THREE.Mesh(new THREE.CylinderGeometry(.08,.20,3.7,7),mats.bark);
    rootRib.position.set(sx*2.68,1.78,z);rootRib.rotation.z=-sx*.21;rootRib.castShadow=true;root.add(rootRib);
    if((i+(sx>0?1:0))%3===0){
      const cap=new THREE.Mesh(new THREE.SphereGeometry(.18,10,7),new THREE.MeshBasicMaterial({color:i%2?0x66d9b8:0x91c7ff}));
      cap.scale.set(1.5,.42,1.15);cap.position.set(sx*2.52,.62,z+.35);root.add(cap);
    }
  }
  const dungeonFill=new THREE.HemisphereLight(0x8098a0,0x22201d,.48);dungeonFill.name='rootway-bounded-fill';root.add(dungeonFill);
  // Three spaced practical pools preserve darkness while keeping player, wall relief and the far
  // destination readable during a walk. Only the nearest casts a shadow to bound GPU cost.
  for(const [i,z] of [[0,-2],[1,9],[2,22]]){
    const torch = new THREE.Mesh(new THREE.IcosahedronGeometry(0.16, 0), new THREE.MeshBasicMaterial({ color: i===1?0x79d5bf:0xffb060 }));
    torch.position.set(i%2?2.45:-2.45,2.15,z);root.add(torch);
    const tl = new THREE.PointLight(i===1?0x69cbb7:0xff9848,i===1?8:13,14,2);
    tl.position.copy(torch.position);tl.castShadow=i===0;if(tl.castShadow){tl.shadow.mapSize.set(512,512);tl.shadow.bias=-0.004;}root.add(tl);
  }
  root.visible = false;
}

/** A silhouette that reads as a person: the thing the Souls camera is bolted to. */
export function makeActor(mats, tintHex) {
  const g = new THREE.Group();
  const cloth = mats.cloth.clone();
  if (tintHex !== undefined) cloth.color.setHex(tintHex);
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.26, 0.52, 5, 12), cloth);
  torso.position.y = 1.12; torso.castShadow = true;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.155, 18, 12), mats.skin);
  head.position.y = 1.62; head.castShadow = true;
  const snout = new THREE.Mesh(new THREE.ConeGeometry(0.10, 0.26, 8), mats.skin);
  snout.position.set(0, 1.60, 0.16); snout.rotation.x = Math.PI / 2; snout.castShadow = true;
  const hips = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 0.18, 4, 10), cloth);
  hips.position.y = 0.74; hips.castShadow = true;
  g.add(torso, head, snout, hips);
  for (const sx of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.105, 0.52, 4, 10), cloth);
    leg.position.set(sx * 0.12, 0.36, 0); leg.castShadow = true; g.add(leg);
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.082, 0.46, 4, 10), mats.skin);
    arm.position.set(sx * 0.34, 1.10, 0); arm.castShadow = true; g.add(arm);
  }
  const blade = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.95, 0.014), mats.metal);
  blade.position.set(0.40, 1.28, 0.10); blade.castShadow = true;
  const guard = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.05, 0.05), mats.metal);
  guard.position.set(0.40, 0.82, 0.10); guard.castShadow = true;
  g.add(blade, guard);
  return g;
}

function lerp(a, b, t) { return a + (b - a) * t; }
function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
