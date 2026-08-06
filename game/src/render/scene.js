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
  return Math.abs(x - STREET.x) < STREET.halfWidth && z > STREET.z0 - 3 && z < STREET.z1 + 3;
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

  const mats = {
    ground: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.94, metalness: 0.0 }),
    water: new THREE.MeshStandardMaterial({ color: 0x1e2b26, roughness: 0.10, metalness: 0.40, transparent: true, opacity: 0.80 }),
    bark: new THREE.MeshStandardMaterial({ color: 0x453728, roughness: 0.95 }),
    leaf: new THREE.MeshStandardMaterial({ color: 0x33492a, roughness: 0.84 }),
    reed: new THREE.MeshStandardMaterial({ color: 0x6c7a3c, roughness: 0.90, side: THREE.DoubleSide }),
    wall: new THREE.MeshStandardMaterial({ color: 0x6b5a44, roughness: 0.88 }),
    roof: new THREE.MeshStandardMaterial({ color: 0x3d3428, roughness: 0.95 }),
    plank: new THREE.MeshStandardMaterial({ color: 0x554634, roughness: 0.92 }),
    stone: new THREE.MeshStandardMaterial({ color: 0x7a7a70, roughness: 0.72, metalness: 0.04 }),
    darkStone: new THREE.MeshStandardMaterial({ color: 0x39383a, roughness: 0.88 }),
    skin: new THREE.MeshStandardMaterial({ color: 0xb9ad8e, roughness: 0.66 }),
    cloth: new THREE.MeshStandardMaterial({ color: 0x54341f, roughness: 0.90 }),
    metal: new THREE.MeshStandardMaterial({ color: 0xa8adb4, roughness: 0.32, metalness: 0.75 }),
    moss: new THREE.MeshStandardMaterial({ color: 0x4c5c36, roughness: 0.98 }),
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
    const mottle = noise2(x * 0.28, z * 0.28, seed + 21) * 0.16;
    colours[i * 3 + 0] = lerp(lerp(0.19, 0.30, wet), 0.46, high) + mottle * 0.5;
    colours[i * 3 + 1] = lerp(lerp(0.26, 0.27, wet), 0.45, high) + mottle;
    colours[i * 3 + 2] = lerp(lerp(0.13, 0.22, wet), 0.42, high) + mottle * 0.4;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colours, 3));
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
  const canopyGeo = new THREE.IcosahedronGeometry(3.6, 1);
  const trunks = new THREE.InstancedMesh(trunkGeo, mats.bark, TREES);
  const canopies = new THREE.InstancedMesh(canopyGeo, mats.leaf, TREES);
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
    v.set(x, y + 7.0 * s.y, z); s.setScalar(sc * (0.9 + hash2(i, 23, seed) * 0.5));
    m.compose(v, q, s); canopies.setMatrixAt(placed, m);
    placed++;
  }
  trunks.count = canopies.count = placed;
  trunks.castShadow = canopies.castShadow = true;
  canopies.receiveShadow = true;
  trunks.name = 'trunks'; canopies.name = 'canopies';
  cells.exterior.add(trunks, canopies);

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
    if (y < -0.65 || y > 0.45) continue;
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
    const base = Math.max(walkY, terrainHeight(bx, zz, seed));
    const house = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mats.wall);
    house.position.set(bx, base + h / 2 + 0.4, zz);
    house.castShadow = true; house.receiveShadow = true;
    const roof = new THREE.Mesh(new THREE.ConeGeometry(Math.max(w, d) * 0.80, 1.8, 4), mats.roof);
    roof.position.set(bx, base + h + 1.3, zz);
    roof.rotation.y = Math.PI / 4;
    roof.castShadow = true;
    settlement.add(house, roof);
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

  // ---- arena: flat ground for the combat scenarios (VP12) ---------------------------------------
  const arenaFloor = new THREE.Mesh(new THREE.CircleGeometry(30, 56).rotateX(-Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: 0x494236, roughness: 0.95 }));
  arenaFloor.receiveShadow = true;
  cells.arena.add(arenaFloor);
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * Math.PI * 2;
    const pil = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.65, 5.6, 8), mats.stone);
    pil.position.set(Math.cos(a) * 28, 2.8, Math.sin(a) * 28);
    pil.castShadow = true;
    cells.arena.add(pil);
  }

  // ---- showcase props ------------------------------------------------------------------------
  const showcaseNpc = makeActor(mats, 0x6d5a3a);
  showcaseNpc.position.set(0, 0.15, 0);
  showcaseNpc.rotation.y = Math.PI;
  props.npcShowcase.add(showcaseNpc);

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
  const player = makeActor(mats, 0x8f9aa6);
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

  return { scene, cells, props, anchors, terrain, water, player, mats };
}

function buildHall(root, mats) {
  const floor = new THREE.Mesh(new THREE.BoxGeometry(12, 0.3, 18), mats.plank);
  floor.position.y = -0.15; floor.receiveShadow = true; root.add(floor);
  for (const [w, h, d, px, py, pz] of [[12, 4.4, 0.35, 0, 2.2, -9], [12, 4.4, 0.35, 0, 2.2, 9], [0.35, 4.4, 18, -6, 2.2, 0], [0.35, 4.4, 18, 6, 2.2, 0]]) {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mats.wall);
    wall.position.set(px, py, pz); wall.castShadow = true; wall.receiveShadow = true; root.add(wall);
  }
  const ceiling = new THREE.Mesh(new THREE.BoxGeometry(12, 0.3, 18), mats.roof);
  ceiling.position.y = 4.4; root.add(ceiling);
  for (let i = 0; i < 5; i++) {
    const beam = new THREE.Mesh(new THREE.BoxGeometry(12, 0.34, 0.34), mats.bark);
    beam.position.set(0, 4.05, -7 + i * 3.5); beam.castShadow = true; root.add(beam);
  }
  const hearth = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.15, 0.5, 12), mats.stone);
  hearth.position.set(0, 0.25, 3.0); hearth.receiveShadow = true; root.add(hearth);
  const fire = new THREE.Mesh(new THREE.IcosahedronGeometry(0.45, 1), new THREE.MeshBasicMaterial({ color: 0xffb066 }));
  fire.position.set(0, 0.72, 3.0); root.add(fire);
  const light = new THREE.PointLight(0xffa050, 26, 26, 2);
  light.position.set(0, 1.0, 3.0);
  light.castShadow = true; light.shadow.mapSize.set(512, 512); light.shadow.bias = -0.004;
  root.add(light);
  for (let i = 0; i < 6; i++) {
    const t = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.8, 2.8), mats.wall);
    t.position.set(-3.4 + (i % 3) * 3.4, 0.4, -5.5 + Math.floor(i / 3) * 2.4);
    t.castShadow = true; t.receiveShadow = true; root.add(t);
  }
  const throne = new THREE.Mesh(new THREE.BoxGeometry(1.4, 2.2, 1.2), mats.bark);
  throne.position.set(0, 1.1, 7.4); throne.castShadow = true; root.add(throne);
  root.visible = false;
}

function buildDungeon(root, mats) {
  const floor = new THREE.Mesh(new THREE.BoxGeometry(6, 0.3, 46), mats.darkStone);
  floor.position.set(0, -0.15, 12); floor.receiveShadow = true; root.add(floor);
  const ceil = new THREE.Mesh(new THREE.BoxGeometry(6, 0.3, 46), mats.darkStone);
  ceil.position.set(0, 3.6, 12); root.add(ceil);
  for (const sx of [-1, 1]) {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(0.35, 3.6, 46), mats.darkStone);
    wall.position.set(sx * 3, 1.8, 12); wall.castShadow = true; wall.receiveShadow = true; root.add(wall);
  }
  const endWall = new THREE.Mesh(new THREE.BoxGeometry(6, 3.6, 0.35), mats.darkStone);
  endWall.position.set(0, 1.8, 34); root.add(endWall);
  const backWall = new THREE.Mesh(new THREE.BoxGeometry(6, 3.6, 0.35), mats.darkStone);
  backWall.position.set(0, 1.8, -10); root.add(backWall);
  for (let i = 0; i < 7; i++) {
    const arch = new THREE.Mesh(new THREE.BoxGeometry(6.4, 0.5, 0.55), mats.stone);
    arch.position.set(0, 3.2, -6 + i * 6); arch.castShadow = true; root.add(arch);
    const rubble = new THREE.Mesh(new THREE.IcosahedronGeometry(0.5 + (i % 3) * 0.2, 0), mats.stone);
    rubble.position.set((i % 2 ? 1 : -1) * 1.9, 0.3, -4 + i * 5.6); rubble.castShadow = true; root.add(rubble);
  }
  // One torch. A dark dungeon is measured by how little light it has, so there is one.
  const torch = new THREE.Mesh(new THREE.IcosahedronGeometry(0.16, 0), new THREE.MeshBasicMaterial({ color: 0xffc080 }));
  torch.position.set(2.5, 2.2, 9); root.add(torch);
  const tl = new THREE.PointLight(0xff9a4a, 10, 16, 2);
  tl.position.set(2.4, 2.2, 9); tl.castShadow = true; tl.shadow.mapSize.set(512, 512); tl.shadow.bias = -0.004;
  root.add(tl);
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
