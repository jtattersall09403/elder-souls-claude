// Five rooms the corpus names and the build did not have.
//
// Owner: W1-07. The round-1 verdict's finding was blunt: "`writ-house` — the piece's own
// interior — instantiates 0 entities", and "the three states the methods name by id do not
// exist: `helstrom-market` (prices), `stormhold-street` (guards), `rootlands-well-graph`
// (The Spilled's respawn)". Those are four of the five here; the fifth is the barge hold,
// which RI-JRN01 O6 requires the player to be controllable in *before* anybody asks them a
// question.
//
// Every cell is built at the world origin and switched by visibility, exactly as
// render/scene.js's four are, because HARNESS.md §6 pins camera poses to absolute
// coordinates near the origin.
//
// These are blocked-out rooms, not art. What they must deliver is what the measurements
// need: enclosure the camera arm can collide with, a light budget that is not the sky, a
// desk the Warden-Scribe stands behind, stalls with goods on them, a street with a guard
// post at the end of it, and a well with water in it. Materials come from the shared
// `mats` table so the whole build stays one visual system.
'use strict';

import * as THREE from '../../vendor/three/three.module.js';
import { placeArt } from './world-art.js';

/** Warm interior lamplight. One point light per room; interiors are dark by default. */
function lamp(root, x, y, z, colour, intensity, dist) {
  const l = new THREE.PointLight(colour, intensity, dist, 2);
  l.position.set(x, y, z);
  l.castShadow = true;
  l.shadow.mapSize.set(512, 512);
  l.shadow.bias = -0.004;
  root.add(l);
  const bulb = new THREE.Mesh(new THREE.IcosahedronGeometry(0.12, 0), new THREE.MeshBasicMaterial({ color: colour }));
  bulb.position.set(x, y, z);
  root.add(bulb);
  return l;
}

/**
 * Outdoor fill. The market, the street and the well graph are open-air cells and the sky's
 * own sun is aimed at the exterior patch, so without this they render as a lit ground plane
 * under unlit props — which is what the first capture of `helstrom-market` looked like.
 */
function outdoorFill(root, skyHex, groundHex, intensity) {
  const hemi = new THREE.HemisphereLight(skyHex, groundHex, intensity);
  hemi.position.set(0, 30, 0);
  root.add(hemi);
  const key = new THREE.DirectionalLight(0xfff0d8, 1.35);
  key.position.set(24, 42, -18);
  key.target.position.set(0, 0, 0);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.left = -40; key.shadow.camera.right = 40;
  key.shadow.camera.top = 40; key.shadow.camera.bottom = -40;
  key.shadow.bias = -0.0012;
  root.add(key, key.target);
  return root;
}

function box(root, mat, w, h, d, x, y, z, ry) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  if (ry) m.rotation.y = ry;
  m.castShadow = true; m.receiveShadow = true;
  root.add(m);
  return m;
}

/**
 * The hold of the prison barge. RI-JRN01 O6: the player wakes here, walks around, meets
 * Jeeh-Ei, and can pick something up, all before the first character-defining question.
 * Small, low, wooden, and lit by one lamp somebody hung off a beam.
 */
export function buildBargeHold(root, mats) {
  const floor = box(root, mats.plank, 7.0, 0.3, 12.0, 0, -0.15, 0);
  floor.castShadow = false;
  box(root, mats.plank, 7.0, 3.0, 0.3, 0, 1.5, -6.0);       // bulkhead aft
  box(root, mats.plank, 7.0, 3.0, 0.3, 0, 1.5, 6.0);        // bulkhead fore
  box(root, mats.plank, 0.3, 3.0, 12.0, -3.5, 1.5, 0);      // hull, port
  box(root, mats.plank, 0.3, 3.0, 12.0, 3.5, 1.5, 0);       // hull, starboard
  const deck = box(root, mats.plank, 7.0, 0.3, 12.0, 0, 3.0, 0);
  deck.castShadow = false;
  for (let i = 0; i < 5; i++) box(root, mats.bark, 7.2, 0.26, 0.26, 0, 2.78, -4.8 + i * 2.4);
  // The companionway out. A gap in the deck with a ladder under it: the way up and off.
  box(root, mats.bark, 0.14, 2.6, 0.14, -0.5, 1.3, 5.2);
  box(root, mats.bark, 0.14, 2.6, 0.14, 0.5, 1.3, 5.2);
  for (let i = 0; i < 6; i++) box(root, mats.bark, 1.2, 0.09, 0.09, 0, 0.4 + i * 0.42, 5.2);
  // Cargo. RI-JRN01 O6 wants at least one object that can be picked up in this window; the
  // takeable is an entity, but it has to be sitting on something.
  for (let i = 0; i < 7; i++) {
    const w = 0.7 + (i % 3) * 0.25;
    box(root, mats.wall, w, 0.8, 0.7, (i % 2 ? 1 : -1) * (2.2 + (i % 3) * 0.2), 0.4, -4.4 + i * 1.3, (i * 0.31) % 1.2);
  }
  // Two bunks. One of them is the one you woke up on.
  box(root, mats.plank, 2.0, 0.16, 0.9, -2.3, 0.55, 2.4, 0);
  box(root, mats.cloth, 1.7, 0.14, 0.7, -2.3, 0.70, 2.4, 0);
  box(root, mats.plank, 2.0, 0.16, 0.9, 2.3, 0.55, 1.2, 0);
  // Same authored sources as interior-lighting.js consumes for stealth. These positions and
  // weights are deliberately not a third lighting policy for the opening room.
  lamp(root, 0, 2.2, 5, 0xffc07a, 1.1 * 9, 11);
  lamp(root, -1.8, 1.7, -1.2, 0xffa860, 0.45 * 9, 11);
  lamp(root, 1.9, 1.7, -4.4, 0xffa860, 0.45 * 9, 11);
  root.visible = false;
  return root;
}

/**
 * The Writ House at Tidewrack. A desk, a ledger, a stamp, a wall of reed-cases, one high
 * window with grey coast light in it, and a bench for the people waiting.
 *
 * The desk is at z = +2.6 and the player enters from z = -4, so the Warden-Scribe is
 * across the desk and the room is behind her head — which is the geometry RI-JRN01 M5 is
 * about. The camera never has to leave the room for the answer to be given.
 */
export function buildWritHouse(root, mats) {
  const floor = box(root, mats.stone, 11.0, 0.3, 13.0, 0, -0.15, 0);
  floor.castShadow = false;
  box(root, mats.wall, 11.0, 4.0, 0.35, 0, 2.0, -6.5);
  // ---- THE WAY OUT, and it was not drawn ------------------------------------------------------
  //
  // This wall was one unbroken 11 m slab and the room therefore had NO DOOR IN IT AT ALL — four
  // solid walls and a ceiling. The record says otherwise and so does the physics:
  // `writ-house.json`'s `continuity.entry_side` is `"south"`, `render/exterior.js#entrySideLocal()`
  // maps south to **+z** (`wz = 1`, which is the opposite of the intuition and is why it is
  // written down), the exterior door stands on the building's +z face at world
  // `[3806.25, 0, 908.5]`, and `render/interior.js#interiorShellPlan()` — the plan the shipped
  // CollisionCell is built from — cuts a 1.40 x 2.10 m doorway at the centre of exactly this wall.
  // So the collision shell has an opening here, the world has a door here, and until now the
  // pixels had a wall.
  //
  // That is the other half of the opening-shot defect. The census hands the body back facing the
  // way out (`Engine._censusHandBack()`), and the way out has to be something a player can SEE.
  // The opening at 1.40 x 2.10 and centred at x = 0 is not a taste call: it is
  // `INTERIOR_DOOR_W`/`INTERIOR_DOOR_H` and the shell plan's own placement, so the drawn opening
  // and the collided opening are the same opening rather than two that drift apart.
  {
    const DW = 1.40, DH = 2.10;                       // interior.js INTERIOR_DOOR_W / _DOOR_H
    const seg = (11.0 - DW) / 2;                      // the wall either side of it
    for (const sign of [-1, 1]) box(root, mats.wall, seg, 4.0, 0.35, sign * (DW / 2 + seg / 2), 2.0, 6.5);
    box(root, mats.wall, DW, 4.0 - DH, 0.35, 0, DH + (4.0 - DH) / 2, 6.5);   // the lintel over it
    // The leaf. Shut, and a different material from the wall, because a doorway drawn as a hole
    // in a dark room reads as a hole and not as a door — RI-JRN01 M5's frame has to say "there is
    // a way out of here" without a prompt saying so.
    box(root, mats.bark, DW - 0.10, DH - 0.08, 0.10, 0, (DH - 0.08) / 2, 6.42);
  }
  box(root, mats.wall, 0.35, 4.0, 13.0, -5.5, 2.0, 0);
  box(root, mats.wall, 0.35, 4.0, 13.0, 5.5, 2.0, 0);
  const ceil = box(root, mats.roof, 11.0, 0.3, 13.0, 0, 4.0, 0);
  ceil.castShadow = false;
  for (let i = 0; i < 4; i++) box(root, mats.bark, 11.2, 0.3, 0.3, 0, 3.7, -4.5 + i * 3.0);

  // The desk. Everything that happens in this piece happens across it.
  box(root, mats.plank, 3.6, 0.18, 1.3, 0, 1.02, 2.6);
  box(root, mats.plank, 0.22, 1.0, 1.1, -1.6, 0.5, 2.6);
  box(root, mats.plank, 0.22, 1.0, 1.1, 1.6, 0.5, 2.6);
  box(root, mats.plank, 3.4, 0.9, 0.14, 0, 0.55, 2.05);
  // The ledger, open, and the stamp block beside it.
  box(root, mats.cloth, 0.62, 0.055, 0.44, -0.35, 1.14, 2.55, 0.06);
  box(root, mats.darkStone, 0.16, 0.16, 0.16, 0.55, 1.19, 2.5);
  box(root, mats.bark, 0.05, 0.30, 0.05, 0.55, 1.42, 2.5);
  // A tray of reed-cases waiting to be stamped.
  for (let i = 0; i < 5; i++) {
    const t = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.42, 6), mats.reed);
    t.position.set(1.05 + (i % 2) * 0.10, 1.13, 2.30 + i * 0.10);
    t.rotation.z = Math.PI / 2; t.rotation.y = 0.2 + i * 0.06;
    t.castShadow = true; root.add(t);
  }
  // The wall of cases behind her: eleven years of other people. In TWO RUNS, with the doorway
  // between them.
  //
  // They were one 8.2 m run of shelving standing 0.6 m in front of the door wall, four rows high,
  // dead centre — so even once the doorway above is cut, the exit is behind a shelf. That is
  // literally the frame the owner saw: `hw-desktop-002-writ-house-done.png` is this shelving,
  // corner to corner, because the camera was pointed at the wall the door is in and the shelving
  // was in front of it. The fiction is unchanged (it is still eleven years of other people's
  // reed-cases, still behind her, still the same 52 cases per row's worth of room-width); what
  // changes is that the room's own exit is not stored in front of.
  {
    const GAP = 2.10;                                  // 1.40 m doorway + 0.35 m of frame each side
    const run = (8.2 - GAP) / 2;                       // 3.05 m of shelving each side of it
    for (let r = 0; r < 4; r++) {
      for (const sign of [-1, 1]) box(root, mats.bark, run, 0.10, 0.44, sign * (GAP / 2 + run / 2), 1.0 + r * 0.78, 5.9);
      for (let i = 0; i < 26; i++) {
        const x = -3.9 + i * 0.31;
        if (Math.abs(x) < GAP / 2) continue;
        const t = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.038, 0.40, 6), r % 2 ? mats.reed : mats.bark);
        t.position.set(x, 1.27 + r * 0.78, 5.9);
        t.castShadow = true; root.add(t);
      }
    }
  }
  // The waiting bench, along the wall you came in past.
  box(root, mats.plank, 4.4, 0.14, 0.5, -3.0, 0.5, -3.4, 0);
  box(root, mats.plank, 0.16, 0.5, 0.5, -4.9, 0.25, -3.4);
  box(root, mats.plank, 0.16, 0.5, 0.5, -1.1, 0.25, -3.4);
  // The clerk's side table, where the amendment costs two hundred and fifty.
  box(root, mats.plank, 1.6, 0.16, 0.9, -3.7, 0.94, 2.2, 0.35);
  box(root, mats.plank, 0.18, 0.9, 0.8, -3.7, 0.47, 2.2, 0.35);

  // One high window, north-facing, coast light. It is the only daylight in the room.
  const win = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.0), new THREE.MeshBasicMaterial({ color: 0xb9c8cf }));
  win.position.set(0, 2.9, 6.30); win.rotation.y = Math.PI;
  root.add(win);
  // The record currently has no authored lamp, so litLights() supplies one explicit fail-open
  // hearth at this position. Match that shared policy rather than inventing two private lamps.
  lamp(root, 0, 1.2, -4, 0xffa050, 0.9 * 22, 22);
  root.visible = false;
  return root;
}

/**
 * `helstrom-market` — the state RI-CHR02's price method names and the build did not have.
 * Six stalls under awnings around an open square, with a merchant's counter on each.
 */
export function buildMarket(root, mats) {
  const ground = new THREE.Mesh(new THREE.CircleGeometry(26, 40).rotateX(-Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: 0x4b4433, roughness: 0.96 }));
  ground.receiveShadow = true; root.add(ground);
  const STALLS = 6;
  for (let i = 0; i < STALLS; i++) {
    const a = (i / STALLS) * Math.PI * 2 + 0.35;
    const x = Math.cos(a) * 9.5, z = Math.sin(a) * 9.5, ry = -a + Math.PI / 2;
    box(root, mats.plank, 3.0, 0.16, 1.0, x, 0.95, z, ry);          // counter
    box(root, mats.plank, 0.18, 0.95, 0.9, x - Math.cos(ry) * 1.4, 0.47, z + Math.sin(ry) * 1.4, ry);
    box(root, mats.plank, 0.18, 0.95, 0.9, x + Math.cos(ry) * 1.4, 0.47, z - Math.sin(ry) * 1.4, ry);
    for (const sx of [-1, 1]) {
      box(root, mats.bark, 0.13, 2.6, 0.13, x + Math.cos(ry) * sx * 1.5, 1.3, z - Math.sin(ry) * sx * 1.5, ry);
    }
    const awn = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.08, 2.2), i % 2 ? mats.cloth : mats.reed);
    awn.position.set(x, 2.62, z); awn.rotation.y = ry; awn.rotation.x = 0.10;
    awn.castShadow = true; root.add(awn);
    // Goods on the counter, so a price is a thing on a table and not a number in an API.
    for (let k = 0; k < 4; k++) {
      const g = new THREE.Mesh(
        k % 2 ? new THREE.CylinderGeometry(0.10, 0.12, 0.24, 7) : new THREE.BoxGeometry(0.22, 0.16, 0.22),
        k % 3 === 0 ? mats.metal : k % 3 === 1 ? mats.reed : mats.moss);
      g.position.set(x + Math.cos(ry) * (k - 1.5) * 0.6, 1.14, z - Math.sin(ry) * (k - 1.5) * 0.6);
      g.castShadow = true; root.add(g);
    }
  }
  // A stack of crates in the middle, and the well-head the square grew around.
  for (let i = 0; i < 5; i++) box(root, mats.wall, 0.9, 0.9, 0.9, (i % 2 ? 1.1 : -0.9), 0.45 + Math.floor(i / 2) * 0.9, 0.4 + (i % 3) * 0.5, i * 0.3);
  outdoorFill(root, 0x9fc4e8, 0x554b38, 1.05);
  root.visible = false;
  return root;
}

/**
 * `stormhold-street` — where RI-CHR02's guard law-factor table becomes two guards standing
 * at a post, and a Naga loiters 2.5× as long as an Imperial before anyone says anything.
 */
export function buildStormholdStreet(root, mats) {
  const road = box(root, mats.stone, 9.0, 0.24, 60.0, 0, -0.12, 12.0);
  road.castShadow = false;
  for (let i = 0; i < 14; i++) {
    const side = i % 2 ? 1 : -1;
    const z = -12 + i * 3.6;
    const w = 4.0 + (i % 3) * 1.2, h = 3.4 + (i % 4) * 1.3, d = 4.0 + (i % 2) * 1.0;
    box(root, mats.wall, w, h, d, side * (6.4 + (i % 3) * 0.5), h / 2, z);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(Math.max(w, d) * 0.78, 1.7, 4), mats.roof);
    roof.position.set(side * (6.4 + (i % 3) * 0.5), h + 0.85, z);
    roof.rotation.y = Math.PI / 4; roof.castShadow = true; root.add(roof);
  }
  // The guard post at the top of the street: a gate, a brazier, a board with the law on it.
  for (const sx of [-1, 1]) box(root, mats.darkStone, 1.1, 5.4, 1.1, sx * 4.2, 2.7, 34.0);
  box(root, mats.darkStone, 9.6, 0.9, 1.1, 0, 5.7, 34.0);
  box(root, mats.plank, 1.5, 2.0, 0.12, 2.9, 1.6, 32.6, -0.25);
  const brazier = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.36, 0.7, 10), mats.metal);
  brazier.position.set(-2.9, 0.9, 32.6); brazier.castShadow = true; root.add(brazier);
  lamp(root, -2.9, 1.5, 32.6, 0xff8a3a, 22, 24);
  outdoorFill(root, 0x8ea8bd, 0x4a4638, 0.95);
  root.visible = false;
  return root;
}

/**
 * `rootlands-well-graph` — three sapwells in a line with the rest-graph edges between them
 * drawn as the root itself. RI-CHR03's The Spilled respawns at the SECOND-nearest of these,
 * which is only a drawback if you can see where the nearest one was.
 */
export function buildRootlandsWells(root, mats) {
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(160, 160, 1, 1).rotateX(-Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: 0x2c3a24, roughness: 0.97 }));
  ground.receiveShadow = true; root.add(ground);
  const WELLS = [[0, 0], [26, -14], [-22, 20]];
  for (let i = 0; i < WELLS.length; i++) {
    const [x, z] = WELLS[i];
    const ring = new THREE.Mesh(new THREE.CylinderGeometry(1.8, 2.0, 0.9, 14), mats.stone);
    ring.position.set(x, 0.45, z); ring.castShadow = true; ring.receiveShadow = true; root.add(ring);
    const water = new THREE.Mesh(new THREE.CircleGeometry(1.6, 20).rotateX(-Math.PI / 2), mats.water);
    water.position.set(x, 0.82, z); root.add(water);
    // The root that holds it, arching out of the ground and back in.
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * Math.PI * 2;
      const arc = new THREE.Mesh(new THREE.TorusGeometry(2.6, 0.20, 6, 12, Math.PI), mats.bark);
      arc.position.set(x + Math.cos(a) * 0.6, 0.1, z + Math.sin(a) * 0.6);
      arc.rotation.y = a; arc.castShadow = true; root.add(arc);
    }
    lamp(root, x, 1.6, z, i === 0 ? 0x9fe0c0 : 0x7fbfa6, 14, 22);
  }
  outdoorFill(root, 0x87b490, 0x33402a, 0.85);
  // The graph edges: a root running between each pair of wells, half-buried.
  for (let i = 0; i < WELLS.length; i++) {
    for (let j = i + 1; j < WELLS.length; j++) {
      const [ax, az] = WELLS[i], [bx, bz] = WELLS[j];
      const len = Math.hypot(bx - ax, bz - az);
      const e = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, len, 6), mats.bark);
      e.position.set((ax + bx) / 2, 0.12, (az + bz) / 2);
      e.rotation.z = Math.PI / 2;
      e.rotation.y = -Math.atan2(bz - az, bx - ax);
      e.receiveShadow = true; root.add(e);
    }
  }
  for (let i = 0; i < 60; i++) {
    const a = i * 2.399, r = 6 + (i % 9) * 5.5;
    const t = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.42, 7.0, 6), mats.bark);
    t.position.set(Math.cos(a) * r, 3.5, Math.sin(a) * r);
    t.castShadow = true; root.add(t);
    const c = new THREE.Mesh(new THREE.IcosahedronGeometry(2.9, 1), mats.leaf);
    c.position.set(Math.cos(a) * r, 7.6, Math.sin(a) * r);
    c.castShadow = true; root.add(c);
  }
  root.visible = false;
  return root;
}

/** Every cell this module owns, keyed by the id `cellFor()` resolves to. */
export function buildPlaces(mats) {
  const cells = {
    barge_hold: new THREE.Group(),
    writ_house: new THREE.Group(),
    market: new THREE.Group(),
    street: new THREE.Group(),
    well: new THREE.Group(),
  };
  buildBargeHold(cells.barge_hold, mats);
  buildWritHouse(cells.writ_house, mats);
  buildMarket(cells.market, mats);
  buildStormholdStreet(cells.street, mats);
  buildRootlandsWells(cells.well, mats);
  for (const [id,root] of Object.entries(cells)) {
    const grammar=placeArt(id);
    // A governed identity has an actual visual checksum at the cell entrance.  Its grammar token
    // selects primitive, proportions, material and asymmetric prop cadence, so token perturbation
    // necessarily changes rendered geometry (and cannot be satisfied by names/userData alone).
    const h=[...grammar].reduce((n,c)=>(n*33+c.charCodeAt(0))>>>0,5381);
    const identity=new THREE.Group(); identity.name=`world-art-place-identity:${id}`;
    const mat=[mats.bark,mats.stone,mats.metal,mats.reed][h%4];
    const core=h%3===0?new THREE.CylinderGeometry(.22+(h%5)*.05,.42,2.2+(h%4)*.35,5+h%5)
      :h%3===1?new THREE.ConeGeometry(.5+(h%4)*.08,2.3+(h%3)*.4,4+h%5)
      :new THREE.TorusGeometry(.62+(h%3)*.12,.12,5,8+h%6,Math.PI*1.55);
    const monument=new THREE.Mesh(core,mat); monument.position.y=1.15; monument.rotation.z=h%3===2?Math.PI/2:((h%7)-3)*.035;monument.castShadow=true;identity.add(monument);
    for(let i=0;i<2+(h%4);i++) box(identity,i%2?mats.bark:mat,.11, .5+i*.16,.11,(i-(1+h%4)/2)*.28,.25+i*.08,.35,0);
    identity.position.set(-2.8,0,-2.6); root.add(identity);
    root.userData.worldArt={id,grammar,governed:true,visibleConsumer:identity.name};
    root.traverse(o=>{ if(o.isMesh && !o.name) o.name=`world-art-place:${id}`; });
  }
  return cells;
}

/** Anchors these rooms publish, for viewpoint files and for `teleport`. */
export const PLACE_ANCHORS = {
  barge_hold: [0, 0, 0],
  writ_house: [0, 0, -1.4],
  market: [0, 0, 0],
  street: [0, 0, 0],
  well: [0, 0, 0],
};
