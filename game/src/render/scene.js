// The renderable world.
//
// This is deliberately a *small* world and an *honest* one: wave-1 piece W1-00 owns the
// harness, not the province. What it must be is REAL — a scene the twelve canonical
// viewpoints can actually be pointed at, with terrain relief, standing water, canopy,
// built structures, an interior with a single warm source, a character silhouette and a
// material junction. A placeholder cube would make every fidelity metric measure nothing,
// and "we could not shoot the viewpoints" is a fail-closed 0 for the whole visual area
// (HARNESS.md §6).
//
// Determinism: the scene is generated from a value-noise hash of integer coordinates. It
// uses NEITHER Math.random NOR the simulation PRNG — consuming sim draws while building
// the scene would make the trace depend on whether the renderer had run yet, which is
// RI-MTH02 "How we lose" #5 wearing a different hat.
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
export function terrainHeight(x, z, seed) {
  let h = 0, amp = 1, freq = 1 / 90, sum = 0;
  for (let o = 0; o < 4; o++) {
    h += noise2(x * freq, z * freq, seed + o) * amp;
    sum += amp; amp *= 0.48; freq *= 2.07;
  }
  h = h / sum;
  // A marsh floor: mostly low, with ridges. Water sits at y = 0.
  return (h - 0.44) * 26.0;
}

const TERRAIN_SIZE = 420;
const TERRAIN_SEGS = 160;      // 51,200 triangles — one draw call

export function buildScene(seed) {
  const scene = new THREE.Scene();
  const anchors = {};
  const groups = { exterior: new THREE.Group(), interior: new THREE.Group(), arena: new THREE.Group() };
  scene.add(groups.exterior, groups.interior, groups.arena);

  // ---- terrain -----------------------------------------------------------------------
  const geo = new THREE.PlaneGeometry(TERRAIN_SIZE, TERRAIN_SIZE, TERRAIN_SEGS, TERRAIN_SEGS);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const colours = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    const y = terrainHeight(x, z, seed);
    pos.setY(i, y);
    // Vertex colour: silt at the waterline, moss above it, stone on the ridges.
    const wet = Math.max(0, Math.min(1, (0.9 - y) / 2.4));
    const high = Math.max(0, Math.min(1, (y - 5.5) / 5.0));
    const mottle = noise2(x * 0.22, z * 0.22, seed + 21) * 0.18;
    colours[i * 3 + 0] = lerp(lerp(0.20, 0.34, wet), 0.44, high) + mottle * 0.5;
    colours[i * 3 + 1] = lerp(lerp(0.27, 0.30, wet), 0.43, high) + mottle;
    colours[i * 3 + 2] = lerp(lerp(0.14, 0.24, wet), 0.40, high) + mottle * 0.4;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colours, 3));
  geo.computeVertexNormals();
  const terrain = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
    vertexColors: true, roughness: 0.94, metalness: 0.0,
  }));
  terrain.receiveShadow = true;
  terrain.name = 'terrain';
  groups.exterior.add(terrain);

  // ---- standing water ------------------------------------------------------------------
  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(TERRAIN_SIZE, TERRAIN_SIZE, 1, 1).rotateX(-Math.PI / 2),
    new THREE.MeshStandardMaterial({
      color: 0x24312c, roughness: 0.12, metalness: 0.35, transparent: true, opacity: 0.82,
    }));
  water.position.y = 0;
  water.name = 'water';
  water.receiveShadow = false;
  groups.exterior.add(water);

  // ---- canopy: trunks + canopies, two instanced meshes ---------------------------------
  const TREES = 260;
  const trunkGeo = new THREE.CylinderGeometry(0.22, 0.42, 7.5, 6, 1);
  trunkGeo.translate(0, 3.75, 0);
  const trunks = new THREE.InstancedMesh(trunkGeo, new THREE.MeshStandardMaterial({ color: 0x453728, roughness: 0.95 }), TREES);
  const canopyGeo = new THREE.IcosahedronGeometry(3.4, 1);
  const canopies = new THREE.InstancedMesh(canopyGeo, new THREE.MeshStandardMaterial({ color: 0x37502c, roughness: 0.86, flatShading: false }), TREES);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), s = new THREE.Vector3();
  let placed = 0;
  for (let i = 0; placed < TREES && i < TREES * 12; i++) {
    const x = (hash2(i, 7, seed) - 0.5) * TERRAIN_SIZE * 0.92;
    const z = (hash2(i, 11, seed) - 0.5) * TERRAIN_SIZE * 0.92;
    const y = terrainHeight(x, z, seed);
    if (y < 0.3 || y > 9.0) continue;
    const sc = 0.7 + hash2(i, 13, seed) * 0.9;
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), hash2(i, 17, seed) * Math.PI * 2);
    v.set(x, y, z); s.set(sc, sc * (0.85 + hash2(i, 19, seed) * 0.5), sc);
    m.compose(v, q, s);
    trunks.setMatrixAt(placed, m);
    v.set(x, y + 6.6 * s.y, z); s.setScalar(sc);
    m.compose(v, q, s);
    canopies.setMatrixAt(placed, m);
    placed++;
  }
  trunks.count = canopies.count = placed;
  trunks.castShadow = canopies.castShadow = true;
  canopies.receiveShadow = true;
  trunks.name = 'trunks'; canopies.name = 'canopies';
  groups.exterior.add(trunks, canopies);

  // ---- reeds at the waterline ----------------------------------------------------------
  const REEDS = 900;
  const reedGeo = new THREE.PlaneGeometry(0.9, 1.8);
  reedGeo.translate(0, 0.9, 0);
  const reeds = new THREE.InstancedMesh(reedGeo, new THREE.MeshStandardMaterial({
    color: 0x6c7a3c, roughness: 0.9, side: THREE.DoubleSide,
  }), REEDS);
  let rp = 0;
  for (let i = 0; rp < REEDS && i < REEDS * 10; i++) {
    const x = (hash2(i, 23, seed) - 0.5) * TERRAIN_SIZE * 0.9;
    const z = (hash2(i, 29, seed) - 0.5) * TERRAIN_SIZE * 0.9;
    const y = terrainHeight(x, z, seed);
    if (y < -0.9 || y > 0.9) continue;
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), hash2(i, 31, seed) * Math.PI);
    v.set(x, y, z); s.setScalar(0.7 + hash2(i, 37, seed) * 0.8);
    m.compose(v, q, s);
    reeds.setMatrixAt(rp++, m);
  }
  reeds.count = rp;
  reeds.name = 'reeds';
  groups.exterior.add(reeds);

  // ---- a settlement: stilt houses on a boardwalk ----------------------------------------
  const settlement = new THREE.Group();
  settlement.name = 'settlement';
  const wallMat = new THREE.MeshStandardMaterial({ color: 0x6b5a44, roughness: 0.88 });
  const roofMat = new THREE.MeshStandardMaterial({ color: 0x3d3428, roughness: 0.95 });
  const plankMat = new THREE.MeshStandardMaterial({ color: 0x554634, roughness: 0.92 });
  const streetCentre = new THREE.Vector3(24, 0, -34);
  const boardwalk = new THREE.Mesh(new THREE.BoxGeometry(6, 0.25, 64), plankMat);
  boardwalk.position.copy(streetCentre).setY(1.15);
  boardwalk.receiveShadow = true;
  settlement.add(boardwalk);
  for (let i = 0; i < 14; i++) {
    const side = i % 2 ? 1 : -1;
    const zz = streetCentre.z - 26 + i * 4.2;
    const bx = streetCentre.x + side * (5.6 + hash2(i, 41, seed) * 1.4);
    const w = 3.2 + hash2(i, 43, seed) * 1.8, h = 2.8 + hash2(i, 47, seed) * 2.2, d = 3.4 + hash2(i, 53, seed) * 1.6;
    const house = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wallMat);
    house.position.set(bx, 1.2 + h / 2, zz);
    house.castShadow = true; house.receiveShadow = true;
    const roof = new THREE.Mesh(new THREE.ConeGeometry(Math.max(w, d) * 0.78, 1.7, 4), roofMat);
    roof.position.set(bx, 1.2 + h + 0.85, zz);
    roof.rotation.y = Math.PI / 4;
    roof.castShadow = true;
    // stilts
    for (let k = 0; k < 4; k++) {
      const st = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 2.6, 5), plankMat);
      st.position.set(bx + (k % 2 ? 1 : -1) * w * 0.4, 0.0, zz + (k < 2 ? 1 : -1) * d * 0.4);
      st.castShadow = true;
      settlement.add(st);
    }
    settlement.add(house, roof);
  }
  groups.exterior.add(settlement);

  // ---- a ruin, for the material close-up and a silhouette on the vista ------------------
  const stoneMat = new THREE.MeshStandardMaterial({ color: 0x7a7a70, roughness: 0.72, metalness: 0.04 });
  const ruin = new THREE.Group();
  for (let i = 0; i < 9; i++) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.0 + hash2(i, 59, seed) * 2.6, 2.4), stoneMat);
    const a = (i / 9) * Math.PI * 2;
    b.position.set(-46 + Math.cos(a) * 7.5, terrainHeight(-46 + Math.cos(a) * 7.5, -18 + Math.sin(a) * 7.5, seed) + 1.0, -18 + Math.sin(a) * 7.5);
    b.rotation.y = hash2(i, 61, seed) * 0.7;
    b.castShadow = true; b.receiveShadow = true;
    ruin.add(b);
  }
  ruin.name = 'ruin';
  groups.exterior.add(ruin);

  // ---- interior: a hall lit by one hearth -------------------------------------------------
  const interior = groups.interior;
  interior.position.set(0, -400, 0);      // parked far below the exterior; teleported to on entry
  const room = new THREE.Group();
  const floor = new THREE.Mesh(new THREE.BoxGeometry(12, 0.3, 16), plankMat);
  floor.position.y = -0.15; floor.receiveShadow = true;
  room.add(floor);
  for (const [w2, h2, d2, px, py, pz] of [[12, 4.2, 0.3, 0, 2.1, -8], [12, 4.2, 0.3, 0, 2.1, 8], [0.3, 4.2, 16, -6, 2.1, 0], [0.3, 4.2, 16, 6, 2.1, 0]]) {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(w2, h2, d2), wallMat);
    wall.position.set(px, py, pz); wall.receiveShadow = true; wall.castShadow = true;
    room.add(wall);
  }
  const ceiling = new THREE.Mesh(new THREE.BoxGeometry(12, 0.3, 16), roofMat);
  ceiling.position.y = 4.2; room.add(ceiling);
  const hearthStone = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.05, 0.5, 10), stoneMat);
  hearthStone.position.set(0, 0.25, 3.0); hearthStone.receiveShadow = true;
  room.add(hearthStone);
  const fire = new THREE.Mesh(new THREE.IcosahedronGeometry(0.42, 1), new THREE.MeshBasicMaterial({ color: 0xffb066 }));
  fire.position.set(0, 0.7, 3.0);
  room.add(fire);
  const hearthLight = new THREE.PointLight(0xffa050, 14, 22, 2);
  hearthLight.position.set(0, 1.0, 3.0);
  hearthLight.castShadow = true;
  hearthLight.shadow.mapSize.set(512, 512);
  room.add(hearthLight);
  for (let i = 0; i < 5; i++) {
    const t = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.75, 2.6), wallMat);
    t.position.set(-3.6 + i * 1.8, 0.38, -4.0 + (i % 2) * 1.2);
    t.castShadow = true; t.receiveShadow = true;
    room.add(t);
  }
  interior.add(room);

  // ---- arena: flat ground, for the combat scenarios ----------------------------------------
  const arena = groups.arena;
  arena.position.set(0, 400, 0);
  const arenaFloor = new THREE.Mesh(new THREE.CircleGeometry(28, 48).rotateX(-Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: 0x494236, roughness: 0.95 }));
  arenaFloor.receiveShadow = true;
  arena.add(arenaFloor);
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    const pil = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.6, 5.2, 8), stoneMat);
    pil.position.set(Math.cos(a) * 26, 2.6, Math.sin(a) * 26);
    pil.castShadow = true;
    arena.add(pil);
  }

  // ---- actors ---------------------------------------------------------------------------
  const actorMat = new THREE.MeshStandardMaterial({ color: 0xb9ad8e, roughness: 0.66 });
  const clothMat = new THREE.MeshStandardMaterial({ color: 0x54341f, roughness: 0.9 });
  const player = makeActor(actorMat, clothMat, 0x8f9aa6);
  player.name = 'player';
  scene.add(player);

  // ---- anchors — every id referenced by tools/harness/viewpoints.json ---------------------
  anchors.vista_primary = new THREE.Vector3(120, 22, -80);
  anchors.swamp_canopy = new THREE.Vector3(8, terrainHeight(8, 12, seed) + 1.7, 12);
  anchors.settlement_primary_street = new THREE.Vector3(streetCentre.x, 3.0, streetCentre.z - 30);
  anchors.interior_firelit = new THREE.Vector3(0, -400 + 1.6, -3);
  anchors.water_shallows = new THREE.Vector3(-6, 1.4, -2);
  anchors.npc_showcase = new THREE.Vector3(0, 1.65, 1.6);
  anchors.material_showcase = new THREE.Vector3(-46, terrainHeight(-46, -18, seed) + 0.9, -9.5);
  anchors.dungeon_primary = new THREE.Vector3(0, -400 + 1.6, -4);
  anchors.arena_flat = new THREE.Vector3(0, 400 + 2.2, -5);

  return { scene, groups, anchors, terrain, water, player, actorMat, clothMat, hearthLight, streetCentre };
}

/** A silhouette that reads as a person: the thing the Souls camera is bolted to. */
export function makeActor(skinMat, clothMat, tintHex) {
  const g = new THREE.Group();
  const cloth = clothMat.clone();
  if (tintHex !== undefined) cloth.color.setHex(tintHex);
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.26, 0.52, 4, 10), cloth);
  torso.position.y = 1.12; torso.castShadow = true;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.155, 14, 10), skinMat);
  head.position.y = 1.62; head.castShadow = true;
  const hips = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 0.18, 4, 8), cloth);
  hips.position.y = 0.74; hips.castShadow = true;
  for (const sx of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.105, 0.52, 4, 8), cloth);
    leg.position.set(sx * 0.12, 0.36, 0); leg.castShadow = true; g.add(leg);
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.082, 0.46, 4, 8), skinMat);
    arm.position.set(sx * 0.34, 1.10, 0); arm.castShadow = true; g.add(arm);
  }
  const blade = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.95, 0.012),
    new THREE.MeshStandardMaterial({ color: 0xa8adb4, roughness: 0.32, metalness: 0.75 }));
  blade.position.set(0.40, 1.28, 0.10);
  blade.castShadow = true;
  g.add(torso, head, hips, blade);
  return g;
}

function lerp(a, b, t) { return a + (b - a) * t; }
