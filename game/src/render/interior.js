// The room behind the door, built from the record that describes it.
//
// Owner: wave-1 piece W1-04, round 2. Binding: RI-WLD03 (settlement anatomy, R2 the service
// rule, R5 the architecture kit), RI-WLD07 (verticality and interiors), RI-WLD13 (interior /
// exterior continuity, N1 footprint, N4 windows, N5 storeys).
//
// WHY THIS FILE EXISTS, and it is the same sentence as `sim/settlement.js`'s, one layer up.
//
// `Engine.cellFor()` maps five interiors to hand-built rooms and returns the generic `interior`
// cell for everything else. Over the shipped list that is **113 of 115**, and the generic cell
// was `scene.js buildHall()` — 249 triangles, one light, one hearth, six benches. So the Crimson
// Apothecary, a dye-town alchemist's shop in Archon, and Thorn Hall, a rotted Argonian
// great-hall in a village four kilometres away, were the same room; the only difference between
// two captures of them was which people were standing in it.
//
// Meanwhile `interior.props`, `interior.lights`, `interior.containers` and `interior.unique_item`
// had **zero** consumers anywhere in `game/src`, and `bounds_m` was read at exactly one site — to
// derive an NPC's hash offset. `archon-apothecary` declares 18 props, 10 lights and a unique item
// and drew one light and none of the props. That is `RI-MTH07` §A orphan data at the scale of
// 2,000-odd props and 115 rooms, and ARBITRATION §3 is explicit that from the player's chair it
// is identical to a model that was never written.
//
// This module is the consumer. Nothing here invents a room: every dimension, every lamp, every
// piece of furniture and every partition is read off the interior record.
//
//   * the SHELL is `bounds_m` — floor, four walls, ceiling, and a doorway cut in the wall
//     `continuity.entry_side` names, so the door you came in by is on the side the file says.
//   * the LIGHTS are `lights[]` — every declared lamp is a visible lamp; the first few are real
//     point lights (a shadow-casting hearth), the rest are emissive fittings, because 591
//     shadow-casting oil lamps is a slideshow and an unlit lamp mesh is still a lamp you can see.
//   * the FURNITURE is `props[]`, through `PROPS` below. 148 distinct prop ids ship in the tree.
//   * the KIT is `props[]` too: `tho_*`, `hel_*`, `lil_*`, `sto_*`, `arc_*`, `bla_*`, `gid_*`,
//     `sou_*` are the eight settlements' architecture kits (RI-WLD03 R5's silhouette elements),
//     and they are built as structure rather than as furniture.
//   * CONTAINERS and `unique_item` get bodies, so the thirty unique items RI-QST08 counts are
//     things in a room rather than rows in a file.
//   * `interior_kind` and the settlement choose the PALETTE, so a gaol in Stormhold and a shrine
//     in Helstrom are not the same browns.
//
// WHAT IS DERIVED RATHER THAN READ, stated plainly so nobody has to reverse-engineer it: the
// ARRANGEMENT. Which wall a given counter stands against is a hash of the interior's id, because
// the records declare a prop LIST and not a floor plan. Two records with byte-identical bounds
// and byte-identical prop lists therefore lay out differently — an apothecary in Archon and one
// in Gideon are different rooms — and that is procedural variation seeded by identity, not
// content. The record-derived half is counted separately wherever this is measured.
//
// Determinism: an integer hash of the interior id and nothing else. No `Math.random`, no
// simulation draw, no clock. The same record builds the same room every time, which is what
// makes a pixel-hash sweep over 115 rooms a measurement rather than a mood.
'use strict';

import * as THREE from '../../vendor/three/three.module.js';
import { worldMaterial } from './visual-foundation.js';
import { settlementArt } from './world-art.js';
// W1-15 round 4. The lit set and the window aperture are POLICY, and policy that two files
// implement is policy that drifts — RULES.md rule 10, and it cost 1,659 disagreeing floor cells.
// Both this file and `sim/stealth/system.js` read the answer from here and neither invents one.
import { litLights, windowPlan, wallSlots, floorSlots, PANE_W_M, PANE_H_M } from '../world/interior-lighting.js';

/** The same string hash the Engine uses for NPC offsets, so the two agree on their arithmetic. */
function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

/* ================================================================================================
 * PALETTE
 * ==============================================================================================*/

/** What kind of room this is. Base albedos for shell and furniture. */
const KIND_PALETTE = {
  dwelling: { wall: 0x6d5c45, floor: 0x584734, roof: 0x3c3327, wood: 0x5a4a35, cloth: 0x6a4a2c, accent: 0x7d8a52 },
  shop:     { wall: 0x6a5b48, floor: 0x4e4132, roof: 0x39312a, wood: 0x4d3d2a, cloth: 0x7a5230, accent: 0xa9873f },
  tavern:   { wall: 0x6f5238, floor: 0x503c28, roof: 0x3a2c20, wood: 0x452f1e, cloth: 0x7d3626, accent: 0xc08a3a },
  guild:    { wall: 0x5d5850, floor: 0x413c36, roof: 0x33302c, wood: 0x3f3830, cloth: 0x3f4a6b, accent: 0x9aa0a8 },
  temple:   { wall: 0x7e7c6e, floor: 0x63604f, roof: 0x4a483d, wood: 0x5d5442, cloth: 0x4d6a4a, accent: 0xc9c08a },
  shrine:   { wall: 0x5b6a4c, floor: 0x46503a, roof: 0x38412f, wood: 0x4a4130, cloth: 0x59713f, accent: 0x9fc06a },
  travel:   { wall: 0x6b5a3c, floor: 0x54462e, roof: 0x3d3324, wood: 0x574529, cloth: 0x8a6a30, accent: 0xd0a44a },
  prison:   { wall: 0x3f4044, floor: 0x36373a, roof: 0x2c2d30, wood: 0x38312a, cloth: 0x4a4640, accent: 0x8d939a },
  hold:     { wall: 0x4a3c2c, floor: 0x3d3123, roof: 0x2f261c, wood: 0x453728, cloth: 0x5c4a30, accent: 0x8a7448 },
  hall:     { wall: 0x5f4e3a, floor: 0x4b3d2c, roof: 0x362c21, wood: 0x453728, cloth: 0x6b3c28, accent: 0xb08040 },
  gate:     { wall: 0x585a52, floor: 0x46473f, roof: 0x35362f, wood: 0x453d2e, cloth: 0x5a5b4a, accent: 0x9a9c86 },
};
const DEFAULT_PALETTE = KIND_PALETTE.dwelling;

/**
 * The eight architecture kits, from `settlement.architecture_kit`. Each town's rule pulls the
 * whole room a fixed distance towards its own material, which is why the same shop in two towns
 * is not the same shop. RI-WLD03 R5's `silhouette` — "the one element no other settlement uses"
 * — is the mesh family in `KIT`, below.
 */
const TOWN_TINT = {
  archon:    { tint: 0x8e3a5a, mix: 0.30 },   // dye vats; everything is stained
  blackrose: { tint: 0x4a4038, mix: 0.34 },   // fortress stone, furred with damp
  gideon:    { tint: 0xa9713e, mix: 0.24 },   // imperial timber frame and tile
  helstrom:  { tint: 0x4d6b32, mix: 0.34 },   // grown, not built: living bole
  lilmoth:   { tint: 0x38574f, mix: 0.34 },   // sunk, drowned, green water light
  soulrest:  { tint: 0xbdb49a, mix: 0.30 },   // bone and salt bleach
  stormhold: { tint: 0x6b6f78, mix: 0.30 },   // legion block, grid barrack
  thorn:     { tint: 0x2e2a24, mix: 0.36 },   // black needle-wood thatch
};

function mixHex(a, b, t) {
  const ar = (a >> 16) & 255, ag = (a >> 8) & 255, ab = a & 255;
  const br = (b >> 16) & 255, bg = (b >> 8) & 255, bb = b & 255;
  const r = Math.round(ar + (br - ar) * t), g = Math.round(ag + (bg - ag) * t), bl = Math.round(ab + (bb - ab) * t);
  return (r << 16) | (g << 8) | bl;
}

/**
 * THE PALETTE IS CACHED, AND THE REASON IS A HITCH ON EVERY DOOR.
 *
 * A `MeshStandardMaterial` is a shader program the first time it is drawn, and building a fresh
 * set per room means every doorway in the game pays a program compile. Measured while writing
 * this: a sweep of all 115 rooms went from seconds to minutes, and what a probe feels as a slow
 * sweep the player feels as a stall on the threshold — the same class of defect as W1-01's
 * 133.8 ms ground-skin frame, arriving at the exact moment the player presses a button.
 *
 * A palette is a pure function of `(interior_kind, settlement)`, so there are at most eleven
 * kinds times eight towns of them and in practice about forty. They are cached for the life of
 * the renderer and NOT disposed with the room; `clearInterior()` frees geometry only.
 */
const PALETTE_CACHE = new Map();

function paletteFor(rec) {
  const key = `${rec.interior_kind || '?'}|${rec.settlement || '?'}`;
  const hit = PALETTE_CACHE.get(key);
  if (hit) return hit;
  const made = makePalette(rec);
  PALETTE_CACHE.set(key, made);
  return made;
}

function makePalette(rec) {
  const base = KIND_PALETTE[rec.interior_kind] || DEFAULT_PALETTE;
  const town = TOWN_TINT[rec.settlement] || { tint: 0x000000, mix: 0 };
  const c = (k) => mixHex(base[k], town.tint, town.mix);
  const std = (col, rough, metal, family='clay') => worldMaterial(family, { color: col, roughness: rough, metalness: metal || 0 });
  return {
    wall: std(c('wall'), 0.90),
    floor: std(c('floor'), 0.93, 0, 'mud'),
    roof: std(c('roof'), 0.95, 0, 'root'),
    wood: std(c('wood'), 0.90, 0, 'timber'),
    cloth: std(c('cloth'), 0.94, 0, 'cloth'),
    accent: std(c('accent'), 0.55, 0.35, 'resin'),
    stone: std(mixHex(0x7a7a70, town.tint, town.mix * 0.7), 0.78, 0.03, 'stone'),
    metal: std(0x9aa0a6, 0.35, 0.72, 'metal'),
    // Anything that is meant to be SEEN as a light rather than lit by one.
    // Display-referred basic orange clipped into flat white/orange blobs under ACES. Emissive
    // physical materials keep a coloured core while still accepting fog and tone mapping.
    flame: new THREE.MeshStandardMaterial({ color:0x7a2607, emissive:0xf06b12, emissiveIntensity:1.14, roughness:.58, toneMapped:true }),
    flameCore: new THREE.MeshStandardMaterial({ color:0xffb13b, emissive:0xffb11e, emissiveIntensity:1.42, roughness:.48, toneMapped:true }),
    ember: new THREE.MeshStandardMaterial({ color:0x391208, emissive:0xa93208, emissiveIntensity:.68, roughness:.78, toneMapped:true }),
    glass: new THREE.MeshBasicMaterial({ color: 0xbcd6e0 }),
  };
}

/* ================================================================================================
 * SHAPES — the small vocabulary every prop is assembled from.
 * ==============================================================================================*/

const box = (w, h, d, m) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
const cyl = (rt, rb, h, seg, m) => new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), m);
const ico = (r, d, m) => new THREE.Mesh(new THREE.IcosahedronGeometry(r, d || 0), m);
const craftedBox=(w,h,d,m,bevel=Math.min(w,h,d)*.08)=>{const s=new THREE.Shape();s.moveTo(-w/2,-h/2);s.lineTo(w/2,-h/2);s.lineTo(w/2,h/2);s.lineTo(-w/2,h/2);s.closePath();const g=new THREE.ExtrudeGeometry(s,{depth:d,steps:1,bevelEnabled:true,bevelSegments:1,bevelSize:bevel,bevelThickness:bevel});g.translate(0,0,-d/2);return new THREE.Mesh(g,m);};

// A closed, asymmetrical flame blade with a broad hot root and a bent, tapered crown. It is
// intentionally authored geometry rather than a cone: even without simulation the overlapping
// silhouettes read as tongues of flame from a moving camera, not red traffic markers.
function flameBlade(width=.12,height=.42,bend=.06,material){
  const radial=7,rings=[
    [0,width*.66,0],
    [height*.18,width, bend*.05],
    [height*.48,width*.72,bend*.28],
    [height*.76,width*.43,bend*.68],
    [height,width*.045,bend],
  ],pos=[],idx=[];
  for(const [y,r,zOff] of rings)for(let i=0;i<radial;i++){
    const a=i/radial*Math.PI*2;
    pos.push(Math.cos(a)*r,y,zOff+Math.sin(a)*r*.50);
  }
  for(let r=0;r<rings.length-1;r++)for(let i=0;i<radial;i++){
    const q=(i+1)%radial,A=r*radial+i,B=r*radial+q,C=(r+1)*radial+i,D=(r+1)*radial+q;
    idx.push(A,C,B,B,C,D);
  }
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));geo.setIndex(idx);geo.computeVertexNormals();
  const mesh=new THREE.Mesh(geo,material);mesh.castShadow=false;mesh.receiveShadow=false;return mesh;
}

function part(g, mesh, x, y, z, ry) {
  mesh.position.set(x, y, z);
  if (ry) mesh.rotation.y = ry;
  mesh.castShadow = true; mesh.receiveShadow = true;
  g.add(mesh);
  return mesh;
}

/* ================================================================================================
 * THE PROP TABLE — 148 declared ids, and what each of them looks like.
 *
 * `place` says where in the room the thing belongs, which is the difference between a room and a
 * heap: a counter goes against a wall, a hearth goes in the middle, a hanging lamp goes on the
 * ceiling, a basket goes on the floor wherever there is space.
 * ==============================================================================================*/

/** Shorthand builders, so the table stays readable at 148 rows. */
const B = {
  counter: (P) => { const g = new THREE.Group(); part(g, craftedBox(2.6, 0.12, 0.7, P.wood), 0, 1.0, 0); for (const sx of [-1.1, 1.1]) part(g, craftedBox(0.14, 1.0, 0.6, P.wood), sx, 0.5, 0); part(g, craftedBox(2.5, 0.5, 0.1, P.wood), 0, 0.55, -0.28); return g; },
  shelves: (P, n = 4, w = 2.0) => { const g = new THREE.Group(); for (let i = 0; i < n; i++) part(g, box(w, 0.07, 0.34, P.wood), 0, 0.5 + i * 0.55, 0); for (const sx of [-w / 2 + 0.06, w / 2 - 0.06]) part(g, box(0.1, 0.5 + n * 0.55, 0.34, P.wood), sx, (0.5 + n * 0.55) / 2, 0); return g; },
  table: (P, w = 1.6, d = 1.0, h = 0.78) => { const g = new THREE.Group(); part(g, craftedBox(w, 0.1, d, P.wood), 0, h, 0); for (const sx of [-1, 1]) for (const sz of [-1, 1]) part(g, craftedBox(0.1, h, 0.1, P.wood), sx * (w / 2 - 0.14), h / 2, sz * (d / 2 - 0.14)); return g; },
  bench: (P, w = 1.8) => { const g = new THREE.Group(); part(g, craftedBox(w, 0.09, 0.42, P.wood), 0, 0.45, 0); for (const sx of [-1, 1]) part(g, craftedBox(0.1, 0.45, 0.38, P.wood), sx * (w / 2 - 0.15), 0.22, 0); return g; },
  stool: (P, h = 0.46) => { const g = new THREE.Group(); part(g, cyl(0.19, 0.19, 0.07, 8, P.wood), 0, h, 0); for (let i = 0; i < 3; i++) { const a = i * 2.094; part(g, cyl(0.03, 0.03, h, 5, P.wood), Math.cos(a) * 0.12, h / 2, Math.sin(a) * 0.12); } return g; },
  chest: (P, w = 0.9, h = 0.55, m) => { const g = new THREE.Group(); part(g, craftedBox(w, h, 0.5, m || P.wood), 0, h / 2, 0); const lid=cyl(.27,.27,w,10,m||P.wood);lid.rotation.z=Math.PI/2;part(g,lid,0,h+.02,0);for(const sx of [-1,1])part(g,box(.045,h*.92,.54,P.metal),sx*w*.34,h*.52,0);part(g, box(0.1, 0.12, 0.06, P.metal), 0, h * 0.6, 0.26); return g; },
  barrel: (P, r = 0.32, h = 0.86) => { const g = new THREE.Group(); part(g, cyl(r * 0.9, r, h, 10, P.wood), 0, h / 2, 0); part(g, cyl(r * 1.02, r * 1.02, 0.06, 10, P.metal), 0, h * 0.75, 0); part(g, cyl(r * 1.02, r * 1.02, 0.06, 10, P.metal), 0, h * 0.25, 0); return g; },
  sack: (P) => { const g = new THREE.Group(); for (let i = 0; i < 3; i++) { const s = ico(0.24 + (i % 2) * 0.05, 0, P.cloth); s.scale.set(1, 1.35, 1); part(g, s, (i - 1) * 0.42, 0.3, (i % 2) * 0.16); } return g; },
  basket: (P) => { const g = new THREE.Group(); part(g, cyl(0.24, 0.18, 0.34, 9, P.cloth), 0, 0.17, 0); return g; },
  pot: (P) => { const g = new THREE.Group(); const b = ico(0.26, 1, P.stone); b.scale.set(1, 0.8, 1); part(g, b, 0, 0.22, 0); part(g, cyl(0.13, 0.16, 0.08, 9, P.stone), 0, 0.42, 0); return g; },
  bed: (P, w = 1.0, l = 2.0) => { const g = new THREE.Group(); part(g, box(w, 0.24, l, P.wood), 0, 0.3, 0); const m = box(w * 0.92, 0.16, l * 0.92, P.cloth); part(g, m, 0, 0.5, 0); part(g, box(w * 0.6, 0.12, 0.34, P.cloth), 0, 0.6, -l / 2 + 0.3); return g; },
  mat: (P) => { const g = new THREE.Group(); const m = box(0.9, 0.04, 1.7, P.cloth); part(g, m, 0, 0.02, 0); return g; },
  rack: (P, h = 1.7) => { const g = new THREE.Group(); for (const sx of [-0.5, 0.5]) part(g, cyl(0.045, 0.045, h, 6, P.wood), sx, h / 2, 0); for (let i = 0; i < 3; i++) part(g, box(1.1, 0.05, 0.05, P.wood), 0, 0.5 + i * 0.55, 0); return g; },
  post: (P, h = 2.2, r = 0.14) => { const g = new THREE.Group(); part(g, cyl(r, r * 1.15, h, 8, P.wood), 0, h / 2, 0); return g; },
  board: (P, w = 1.2, h = 0.9) => { const g = new THREE.Group(); part(g, box(w, h, 0.06, P.wood), 0, 1.35, 0); for (let i = 0; i < 3; i++) part(g, box(w * 0.28, h * 0.24, 0.02, P.cloth), (i - 1) * w * 0.3, 1.35 + ((i % 2) - 0.5) * 0.2, 0.04); return g; },
  hearth: (P) => { const g = new THREE.Group(); part(g, cyl(0.95, 1.1, 0.34, 12, P.stone), 0, 0.17, 0); for(let i=0;i<6;i++){const a=i*Math.PI/3,h=.30+(i%3)*.105,f=flameBlade(.075+(i%2)*.018,h,(i%2?-.05:.06),i%3===0?P.flameCore:(i%2?P.ember:P.flame));f.rotation.y=a;f.rotation.z=(i-2.5)*.055;part(g,f,Math.cos(a)*.12,.34,Math.sin(a)*.12);} const core=flameBlade(.10,.52,-.035,P.flameCore);part(g,core,0,.34,0,.65); for (let i = 0; i < 5; i++) { const a = i * 1.257; const log=cyl(0.05,0.06,0.5,7,P.wood);log.rotation.z=Math.PI/2;log.rotation.y=a;part(g,log,Math.cos(a)*0.2,0.38,Math.sin(a)*0.2); } return g; },
  brazier: (P) => { const g = new THREE.Group(); part(g, cyl(0.05, 0.05, 0.85, 6, P.metal), 0, 0.42, 0); part(g, cyl(0.3, 0.16, 0.22, 9, P.metal), 0, 0.95, 0); part(g, ico(0.16, 0, P.ember), 0, 1.04, 0); return g; },
  lampHung: (P) => { const g = new THREE.Group(); part(g, cyl(0.012, 0.012, 0.7, 4, P.metal), 0, -0.35, 0); part(g, cyl(0.13, 0.09, 0.2, 8, P.metal), 0, -0.78, 0); part(g, flameBlade(.055,.18,.025,P.flameCore), 0, -0.78, 0); return g; },
  lampStand: (P) => { const g = new THREE.Group(); part(g, cyl(0.11, 0.13, 0.04, 8, P.metal), 0, 0.02, 0); part(g, cyl(0.03, 0.03, 0.5, 6, P.metal), 0, 0.27, 0); const bowl=cyl(.14,.085,.075,9,P.metal);part(g,bowl,0,.53,0);const f=flameBlade(.043,.18,.025,P.flameCore);f.rotation.z=.05;part(g,f,0,.57,0); return g; },
  altar: (P) => { const g = new THREE.Group(); part(g, box(1.5, 0.85, 0.7, P.stone), 0, 0.42, 0); part(g, box(1.7, 0.1, 0.85, P.stone), 0, 0.9, 0); part(g, box(0.5, 0.12, 0.3, P.accent), 0, 1.01, 0); return g; },
  root: (P, h = 2.6) => { const g = new THREE.Group(); for (let i = 0; i < 3; i++) { const a = i * 2.094; const s = cyl(0.1, 0.24, h, 6, P.wood); s.rotation.z = Math.cos(a) * 0.16; s.rotation.x = Math.sin(a) * 0.16; part(g, s, Math.cos(a) * 0.22, h / 2, Math.sin(a) * 0.22); } return g; },
  grate: (P) => { const g = new THREE.Group(); part(g, box(1.5, 0.1, 0.1, P.metal), 0, 2.1, 0); for (let i = 0; i < 7; i++) part(g, cyl(0.035, 0.035, 2.1, 5, P.metal), -0.6 + i * 0.2, 1.05, 0); return g; },
  bunk: (P) => { const g = new THREE.Group(); for (const y of [0.4, 1.35]) { part(g, box(0.85, 0.12, 1.9, P.wood), 0, y, 0); part(g, box(0.8, 0.1, 1.8, P.cloth), 0, y + 0.11, 0); } for (const sx of [-0.4, 0.4]) part(g, cyl(0.05, 0.05, 1.8, 5, P.wood), sx, 0.9, -0.9); return g; },
  line: (P, w = 2.4) => { const g = new THREE.Group(); part(g, cyl(0.012, 0.012, w, 4, P.cloth), 0, 0, 0).rotation.z = Math.PI / 2; for (let i = 0; i < 4; i++) { const c = box(0.3, 0.42, 0.02, P.cloth); part(g, c, -w / 2 + 0.4 + i * (w / 5), -0.24, 0); } return g; },
  small: (P, m) => { const g = new THREE.Group(); part(g, box(0.22, 0.14, 0.16, m || P.accent), 0, 0.07, 0); return g; },
  tiny: (P, m) => { const g = new THREE.Group(); part(g, ico(0.1, 0, m || P.accent), 0, 0.1, 0); return g; },
};

/**
 * The table. `[placement, builder]`. Placement is one of:
 *   wall    — flush against a wall, facing into the room
 *   centre  — on the room's spine
 *   floor   — loose on the floor, anywhere clear
 *   ceiling — hung
 *   surface — small; goes ON a wall prop if one has been placed, otherwise against a wall
 *   arch    — settlement architecture kit: structure, built large and against the shell
 */
const PROPS = {
  // ---- trade ---------------------------------------------------------------------------------
  counter_long: ['wall', (P) => B.counter(P)],
  shelf_stack: ['wall', (P) => B.shelves(P, 4, 2.0)],
  shelf_deed: ['wall', (P) => B.shelves(P, 5, 1.5)],
  scale_brass: ['surface', (P) => { const g = new THREE.Group(); part(g, cyl(0.03, 0.03, 0.34, 5, P.accent), 0, 0.17, 0); part(g, box(0.44, 0.02, 0.03, P.accent), 0, 0.34, 0); for (const sx of [-0.2, 0.2]) part(g, cyl(0.07, 0.07, 0.02, 8, P.accent), sx, 0.28, 0); return g; }],
  coin_tray: ['surface', (P) => { const g = new THREE.Group(); part(g, box(0.32, 0.05, 0.22, P.wood), 0, 0.03, 0); part(g, cyl(0.05, 0.05, 0.03, 8, P.accent), 0, 0.06, 0); return g; }],
  ledger_stand: ['wall', (P) => { const g = new THREE.Group(); part(g, cyl(0.06, 0.09, 1.05, 6, P.wood), 0, 0.52, 0); const t = box(0.5, 0.04, 0.36, P.wood); t.rotation.x = -0.35; part(g, t, 0, 1.06, 0); part(g, box(0.3, 0.05, 0.24, P.cloth), 0, 1.11, 0); return g; }],
  strongbox: ['wall', (P) => B.chest(P, 0.62, 0.46, P.metal)],
  chest_small: ['wall', (P) => B.chest(P, 0.7, 0.44)],
  chest_iron: ['wall', (P) => B.chest(P, 0.8, 0.5, P.metal)],
  chest_large: ['wall', (P) => B.chest(P, 1.3, 0.7)],
  crate_sealed: ['floor', (P) => { const g = new THREE.Group(); part(g, box(0.7, 0.6, 0.7, P.wood), 0, 0.3, 0); part(g, box(0.74, 0.05, 0.74, P.wood), 0, 0.6, 0); return g; }],
  sack_row: ['floor', (P) => B.sack(P)],
  floor_basket: ['floor', (P) => B.basket(P)],
  barrel_row: ['wall', (P) => { const g = new THREE.Group(); for (let i = 0; i < 3; i++) { const bl = B.barrel(P); bl.position.set((i - 1) * 0.72, 0, (i % 2) * 0.1); g.add(bl); }; return g; }],
  hook_rail: ['wall', (P) => { const g = new THREE.Group(); part(g, box(1.6, 0.08, 0.08, P.wood), 0, 1.75, 0); for (let i = 0; i < 5; i++) part(g, cyl(0.02, 0.02, 0.16, 4, P.metal), -0.64 + i * 0.32, 1.65, 0); return g; }],
  key_rail: ['wall', (P) => { const g = new THREE.Group(); part(g, box(0.9, 0.07, 0.05, P.wood), 0, 1.6, 0); for (let i = 0; i < 6; i++) part(g, box(0.03, 0.12, 0.02, P.metal), -0.36 + i * 0.145, 1.5, 0.03); return g; }],
  stool_high: ['floor', (P) => B.stool(P, 0.72)],
  stool_low: ['floor', (P) => B.stool(P, 0.42)],
  sample_board: ['wall', (P) => B.board(P, 1.1, 0.8)],
  measure_jug: ['surface', (P) => { const g = new THREE.Group(); part(g, cyl(0.1, 0.13, 0.28, 9, P.stone), 0, 0.14, 0); part(g, box(0.03, 0.14, 0.03, P.stone), 0.13, 0.16, 0); return g; }],
  sweep_broom: ['wall', (P) => { const g = new THREE.Group(); const s = cyl(0.025, 0.025, 1.5, 5, P.wood); s.rotation.z = 0.16; part(g, s, 0, 0.75, 0); part(g, box(0.26, 0.3, 0.1, P.cloth), -0.12, 0.16, 0); return g; }],
  tally_brass: ['wall', (P) => B.board(P, 0.8, 0.6)],
  tally_board: ['wall', (P) => B.board(P, 1.0, 0.7)],
  tally_scratch: ['wall', (P) => B.board(P, 0.7, 0.5)],
  notice_board: ['wall', (P) => B.board(P, 1.5, 1.05)],
  muster_board: ['wall', (P) => B.board(P, 1.4, 1.0)],
  fare_board: ['wall', (P) => B.board(P, 1.3, 0.95)],
  charter_frame: ['wall', (P) => { const g = new THREE.Group(); part(g, box(0.9, 1.2, 0.05, P.accent), 0, 1.6, 0); part(g, box(0.78, 1.06, 0.02, P.cloth), 0, 1.6, 0.04); return g; }],
  banner_wall: ['wall', (P) => { const g = new THREE.Group(); part(g, box(0.9, 2.0, 0.03, P.cloth), 0, 1.6, 0); part(g, box(1.0, 0.06, 0.06, P.wood), 0, 2.6, 0); return g; }],
  cloth_hanging: ['wall', (P) => { const g = new THREE.Group(); part(g, box(1.2, 1.6, 0.03, P.cloth), 0, 1.5, 0); return g; }],
  shield_wall: ['wall', (P) => { const g = new THREE.Group(); for (let i = 0; i < 3; i++) { const s = cyl(0.3, 0.3, 0.07, 8, P.metal); s.rotation.x = Math.PI / 2; part(g, s, (i - 1) * 0.75, 1.7, 0); } return g; }],
  weapon_rack: ['wall', (P) => { const g = new THREE.Group(); part(g, B.rack(P, 1.9), 0, 0, 0); for (let i = 0; i < 4; i++) part(g, box(0.05, 1.3, 0.05, P.metal), -0.42 + i * 0.28, 0.75, 0.06); return g; }],
  spear_rack: ['wall', (P) => { const g = new THREE.Group(); part(g, box(1.3, 0.08, 0.14, P.wood), 0, 0.9, 0); for (let i = 0; i < 5; i++) part(g, cyl(0.03, 0.03, 2.1, 5, P.wood), -0.5 + i * 0.25, 1.05, 0); return g; }],
  irons_set: ['wall', (P) => { const g = new THREE.Group(); for (let i = 0; i < 2; i++) { const r = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.02, 4, 9), P.metal); part(g, r, (i - 0.5) * 0.3, 1.2, 0); } return g; }],
  chain_ring: ['wall', (P) => { const g = new THREE.Group(); const r = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.03, 4, 10), P.metal); part(g, r, 0, 1.4, 0); return g; }],
  // ---- home ----------------------------------------------------------------------------------
  clay_hearth: ['centre', (P) => B.hearth(P)],
  hearth_open: ['centre', (P) => B.hearth(P)],
  cook_pot: ['centre', (P) => { const g = new THREE.Group(); part(g, cyl(0.24, 0.2, 0.26, 10, P.metal), 0, 0.6, 0); for (const sx of [-1, 1]) { const l = cyl(0.03, 0.03, 0.9, 4, P.metal); l.rotation.z = sx * 0.2; part(g, l, sx * 0.16, 0.45, 0); } return g; }],
  stew_pot: ['centre', (P) => B.pot(P)],
  water_butt: ['wall', (P) => B.barrel(P, 0.38, 1.0)],
  reed_mat: ['floor', (P) => B.mat(P)],
  floor_rush: ['floor', (P) => B.mat(P)],
  sleeping_shelf: ['wall', (P) => B.bed(P, 0.95, 1.9)],
  bed_rentable: ['wall', (P) => B.bed(P, 1.0, 2.0)],
  bunk_plank: ['wall', (P) => B.bunk(P)],
  wall_peg: ['wall', (P) => { const g = new THREE.Group(); for (let i = 0; i < 3; i++) part(g, cyl(0.025, 0.025, 0.18, 4, P.wood), (i - 1) * 0.3, 1.7, 0).rotation.x = Math.PI / 2; return g; }],
  cloak_hook: ['wall', (P) => { const g = new THREE.Group(); part(g, box(0.5, 0.08, 0.06, P.wood), 0, 1.75, 0); part(g, box(0.34, 0.7, 0.12, P.cloth), 0, 1.4, 0.06); return g; }],
  hanging_bundle: ['ceiling', (P) => { const g = new THREE.Group(); for (let i = 0; i < 3; i++) { part(g, cyl(0.01, 0.01, 0.3, 4, P.cloth), (i - 1) * 0.14, -0.15, 0); const b = ico(0.09, 0, P.accent); b.scale.set(1, 1.5, 1); part(g, b, (i - 1) * 0.14, -0.36, 0); } return g; }],
  washing_line: ['ceiling', (P) => B.line(P, 2.4)],
  child_toy: ['floor', (P) => B.tiny(P, P.cloth)],
  bone_comb: ['surface', (P) => B.small(P, P.stone)],
  slop_bucket: ['floor', (P) => { const g = new THREE.Group(); part(g, cyl(0.16, 0.13, 0.3, 8, P.wood), 0, 0.15, 0); return g; }],
  lime_bucket: ['floor', (P) => { const g = new THREE.Group(); part(g, cyl(0.16, 0.13, 0.3, 8, P.stone), 0, 0.15, 0); return g; }],
  rope_coil: ['floor', (P) => { const g = new THREE.Group(); const r = new THREE.Mesh(new THREE.TorusGeometry(0.26, 0.05, 4, 10), P.cloth); r.rotation.x = Math.PI / 2; part(g, r, 0, 0.06, 0); return g; }],
  // ---- tavern --------------------------------------------------------------------------------
  bar_long: ['wall', (P) => { const g = new THREE.Group(); part(g, box(3.4, 0.14, 0.8, P.wood), 0, 1.05, 0); part(g, box(3.3, 1.0, 0.6, P.wood), 0, 0.5, -0.05); return g; }],
  bench_pair: ['centre', (P) => { const g = new THREE.Group(); for (const sz of [-0.75, 0.75]) { const bn = B.bench(P, 1.7); bn.position.set(0, 0, sz); g.add(bn); }; return g; }],
  bench_row: ['wall', (P) => B.bench(P, 2.2)],
  bench_wait: ['wall', (P) => B.bench(P, 1.9)],
  bench_stone: ['wall', (P) => { const g = new THREE.Group(); part(g, box(1.8, 0.44, 0.44, P.stone), 0, 0.22, 0); return g; }],
  table_round: ['centre', (P) => { const g = new THREE.Group(); part(g, cyl(0.62, 0.62, 0.1, 12, P.wood), 0, 0.76, 0); part(g, cyl(0.12, 0.18, 0.76, 8, P.wood), 0, 0.38, 0); return g; }],
  long_table: ['centre', (P) => B.table(P, 3.0, 1.0, 0.78)],
  map_table: ['centre', (P) => { const g = new THREE.Group(); g.add(B.table(P, 1.9, 1.2, 0.86)); part(g, box(1.5, 0.02, 0.9, P.cloth), 0, 0.92, 0); return g; }],
  desk_writing: ['wall', (P) => { const g = new THREE.Group(); g.add(B.table(P, 1.5, 0.8, 0.75)); part(g, box(1.4, 0.35, 0.1, P.wood), 0, 0.94, -0.32); return g; }],
  guard_desk: ['wall', (P) => B.table(P, 1.4, 0.8, 0.78)],
  warden_desk: ['wall', (P) => B.table(P, 1.6, 0.9, 0.78)],
  chair_formal: ['floor', (P) => { const g = new THREE.Group(); part(g, box(0.46, 0.08, 0.46, P.wood), 0, 0.46, 0); part(g, box(0.46, 0.9, 0.08, P.wood), 0, 0.9, -0.19); for (const sx of [-1, 1]) for (const sz of [-1, 1]) part(g, box(0.06, 0.46, 0.06, P.wood), sx * 0.19, 0.23, sz * 0.19); return g; }],
  high_seat: ['wall', (P) => { const g = new THREE.Group(); part(g, box(1.0, 0.14, 0.9, P.wood), 0, 0.62, 0); part(g, box(1.0, 1.8, 0.14, P.wood), 0, 1.4, -0.38); part(g, box(0.8, 0.5, 0.03, P.cloth), 0, 1.5, -0.28); return g; }],
  tankard_shelf: ['wall', (P) => { const g = new THREE.Group(); g.add(B.shelves(P, 3, 1.6)); for (let i = 0; i < 5; i++) part(g, cyl(0.06, 0.055, 0.14, 7, P.accent), -0.6 + i * 0.3, 0.62, 0); return g; }],
  keg_tap: ['wall', (P) => { const g = new THREE.Group(); const k = B.barrel(P, 0.34, 0.72); k.rotation.z = Math.PI / 2; part(g, k, 0, 0.5, 0); part(g, box(0.6, 0.16, 0.5, P.wood), 0, 0.08, 0); part(g, cyl(0.03, 0.03, 0.14, 4, P.metal), 0.36, 0.5, 0).rotation.z = Math.PI / 2; return g; }],
  dice_cup: ['surface', (P) => B.small(P, P.wood)],
  drinking_horn: ['surface', (P) => { const g = new THREE.Group(); const h = cyl(0.03, 0.07, 0.3, 6, P.accent); h.rotation.z = 1.2; part(g, h, 0, 0.06, 0); return g; }],
  // ---- writing, law, record ------------------------------------------------------------------
  record_press: ['wall', (P) => { const g = new THREE.Group(); part(g, box(0.8, 1.5, 0.5, P.wood), 0, 0.75, 0); part(g, cyl(0.05, 0.05, 0.7, 6, P.metal), 0, 1.8, 0); part(g, box(0.5, 0.1, 0.4, P.metal), 0, 1.55, 0); return g; }],
  seal_press: ['surface', (P) => { const g = new THREE.Group(); part(g, cyl(0.09, 0.11, 0.14, 8, P.metal), 0, 0.07, 0); part(g, cyl(0.02, 0.02, 0.16, 4, P.metal), 0, 0.2, 0); return g; }],
  inkstand: ['surface', (P) => { const g = new THREE.Group(); part(g, box(0.2, 0.04, 0.14, P.wood), 0, 0.02, 0); part(g, cyl(0.04, 0.05, 0.08, 7, P.metal), -0.04, 0.08, 0); part(g, cyl(0.006, 0.006, 0.22, 4, P.cloth), 0.05, 0.13, 0).rotation.z = 0.4; return g; }],
  gaol_book: ['surface', (P) => B.small(P, P.cloth)],
  name_book: ['surface', (P) => B.small(P, P.cloth)],
  // ---- shrine and temple ---------------------------------------------------------------------
  altar_low: ['centre', (P) => B.altar(P)],
  kneel_step: ['centre', (P) => { const g = new THREE.Group(); part(g, box(1.4, 0.16, 0.5, P.stone), 0, 0.08, 0); return g; }],
  kneel_root: ['centre', (P) => { const g = new THREE.Group(); part(g, cyl(0.2, 0.3, 0.3, 7, P.wood), 0, 0.15, 0); part(g, box(1.1, 0.14, 0.44, P.wood), 0, 0.32, 0); return g; }],
  censer_stand: ['floor', (P) => { const g = new THREE.Group(); part(g, cyl(0.04, 0.04, 1.1, 6, P.metal), 0, 0.55, 0); part(g, ico(0.14, 0, P.metal), 0, 1.18, 0); return g; }],
  offering_bowl: ['surface', (P) => { const g = new THREE.Group(); const b = ico(0.16, 1, P.accent); b.scale.set(1, 0.5, 1); part(g, b, 0, 0.08, 0); return g; }],
  offering_shelf: ['wall', (P) => B.shelves(P, 2, 1.3)],
  candle_rack: ['wall', (P) => { const g = new THREE.Group(); part(g, box(0.9, 0.06, 0.3, P.metal), 0, 0.9, 0); for (let i = 0; i < 6; i++) { part(g, cyl(0.02, 0.02, 0.16, 4, P.cloth), -0.36 + i * 0.145, 1.0, (i % 2) * 0.08); part(g, ico(0.03, 0, P.flame), -0.36 + i * 0.145, 1.1, (i % 2) * 0.08); } return g; }],
  lamp_votive: ['wall', (P) => B.lampStand(P)],
  votive_rag: ['ceiling', (P) => B.line(P, 1.8)],
  water_stoup: ['wall', (P) => { const g = new THREE.Group(); part(g, cyl(0.16, 0.22, 0.9, 9, P.stone), 0, 0.45, 0); const b = ico(0.22, 1, P.stone); b.scale.set(1, 0.45, 1); part(g, b, 0, 0.95, 0); return g; }],
  reliquary_case: ['wall', (P) => { const g = new THREE.Group(); part(g, box(0.7, 1.1, 0.4, P.wood), 0, 0.55, 0); part(g, box(0.5, 0.5, 0.03, P.glass), 0, 0.85, 0.21); return g; }],
  wall_niche: ['wall', (P) => { const g = new THREE.Group(); part(g, box(0.5, 0.8, 0.14, P.stone), 0, 1.5, 0); part(g, ico(0.1, 0, P.accent), 0, 1.4, 0.06); return g; }],
  sermon_lectern: ['centre', (P) => { const g = new THREE.Group(); part(g, cyl(0.16, 0.24, 1.1, 8, P.wood), 0, 0.55, 0); const t = box(0.6, 0.05, 0.44, P.wood); t.rotation.x = -0.32; part(g, t, 0, 1.14, 0); return g; }],
  bell_small: ['ceiling', (P) => { const g = new THREE.Group(); part(g, cyl(0.06, 0.16, 0.24, 8, P.metal), 0, -0.3, 0); return g; }],
  ash_tray: ['surface', (P) => B.small(P, P.stone)],
  stone_marker: ['floor', (P) => { const g = new THREE.Group(); const s = box(0.34, 0.9, 0.2, P.stone); s.rotation.z = 0.06; part(g, s, 0, 0.45, 0); return g; }],
  wind_chime: ['ceiling', (P) => { const g = new THREE.Group(); for (let i = 0; i < 4; i++) part(g, cyl(0.012, 0.012, 0.3 + i * 0.06, 4, P.metal), (i - 1.5) * 0.09, -0.3, 0); return g; }],
  sapling_pot: ['floor', (P) => { const g = new THREE.Group(); part(g, cyl(0.16, 0.12, 0.26, 8, P.stone), 0, 0.13, 0); part(g, cyl(0.02, 0.03, 0.6, 5, P.wood), 0, 0.55, 0); part(g, ico(0.16, 0, P.accent), 0, 0.86, 0); return g; }],
  bark_strip: ['wall', (P) => { const g = new THREE.Group(); for (let i = 0; i < 3; i++) part(g, box(0.14, 0.9, 0.05, P.wood), (i - 1) * 0.22, 1.3, 0); return g; }],
  // ---- travel post, sapwell ------------------------------------------------------------------
  root_socket: ['centre', (P) => B.root(P, 2.4)],
  sap_tap: ['wall', (P) => { const g = new THREE.Group(); part(g, cyl(0.24, 0.3, 1.3, 9, P.wood), 0, 0.65, 0); part(g, cyl(0.04, 0.04, 0.3, 5, P.metal), 0, 1.1, 0.2).rotation.x = Math.PI / 2; part(g, cyl(0.14, 0.11, 0.24, 8, P.metal), 0, 0.14, 0.34); return g; }],
  root_kerb: ['wall', (P) => { const g = new THREE.Group(); part(g, box(2.2, 0.32, 0.4, P.wood), 0, 0.16, 0); return g; }],
  baggage_rail: ['wall', (P) => { const g = new THREE.Group(); part(g, box(2.0, 0.1, 0.1, P.wood), 0, 0.9, 0); for (let i = 0; i < 3; i++) part(g, box(0.4, 0.34, 0.3, P.cloth), -0.6 + i * 0.6, 0.3, 0); return g; }],
  lantern_signal: ['ceiling', (P) => B.lampHung(P)],
  toll_bar: ['centre', (P) => { const g = new THREE.Group(); const b = cyl(0.07, 0.07, 3.0, 6, P.wood); b.rotation.z = Math.PI / 2; part(g, b, 0, 1.1, 0); part(g, cyl(0.1, 0.13, 1.2, 6, P.wood), -1.4, 0.6, 0); return g; }],
  gate_winch: ['wall', (P) => { const g = new THREE.Group(); const d = cyl(0.3, 0.3, 0.5, 10, P.wood); d.rotation.z = Math.PI / 2; part(g, d, 0, 1.1, 0); part(g, cyl(0.04, 0.04, 0.8, 5, P.metal), 0.4, 1.1, 0).rotation.z = Math.PI / 2; return g; }],
  watch_stool: ['floor', (P) => B.stool(P, 0.5)],
  // A WALL PROP RISES INTO THE ROOM, NOT THROUGH THE WALL. `wallSlots()` puts a wall prop 0.55 m
  // in front of its wall and rotates it so that LOCAL +z points into the room; both of these ran
  // their treads along local -z, so eight treads at 0.3 m took the stair 2.4 m backwards through
  // the masonry — 39 meshes across 13 inns and halls, every one of the props the round-5 census
  // found more than 0.6 m outside its own room. Measured, not reasoned: `w1-04-r5-census.mjs` P.
  stair_narrow: ['wall', (P) => { const g = new THREE.Group(); for (let i = 0; i < 8; i++) part(g, box(0.9, 0.16, 0.3, P.wood), 0, 0.08 + i * 0.3, i * 0.3); return g; }],
  ladder_steep: ['wall', (P) => { const g = new THREE.Group(); for (const sx of [-0.2, 0.2]) { const r = cyl(0.04, 0.04, 2.6, 5, P.wood); r.rotation.x = -0.22; part(g, r, sx, 1.3, 0); } for (let i = 0; i < 7; i++) part(g, cyl(0.03, 0.03, 0.4, 4, P.wood), 0, 0.3 + i * 0.34, 0.07 + i * 0.075).rotation.z = Math.PI / 2; return g; }],
  deck_hatch: ['floor', (P) => { const g = new THREE.Group(); part(g, box(1.0, 0.1, 1.0, P.wood), 0, 0.05, 0); part(g, cyl(0.05, 0.05, 0.1, 6, P.metal), 0, 0.12, 0); return g; }],
  bilge_plank: ['floor', (P) => { const g = new THREE.Group(); for (let i = 0; i < 3; i++) part(g, box(0.3, 0.06, 2.2, P.wood), (i - 1) * 0.34, 0.04, 0); return g; }],
  hull_rib: ['wall', (P) => { const g = new THREE.Group(); const r = cyl(0.1, 0.14, 3.0, 6, P.wood); r.rotation.z = 0.24; part(g, r, 0, 1.5, 0); return g; }],
  egg_crate: ['floor', (P) => { const g = new THREE.Group(); part(g, box(0.8, 0.4, 0.6, P.wood), 0, 0.2, 0); for (let i = 0; i < 3; i++) { const e = ico(0.12, 1, P.cloth); e.scale.set(1, 1.3, 1); part(g, e, (i - 1) * 0.22, 0.5, 0); } return g; }],
  cell_grate: ['wall', (P) => B.grate(P)],
  door_iron: ['wall', (P) => { const g = new THREE.Group(); part(g, box(1.0, 2.1, 0.1, P.metal), 0, 1.05, 0); part(g, box(0.3, 0.16, 0.12, P.metal), 0, 1.5, 0.06); return g; }],
  lamp_caged: ['wall', (P) => { const g = new THREE.Group(); part(g, cyl(0.12, 0.12, 0.26, 6, P.metal), 0, 1.8, 0); part(g, ico(0.07, 0, P.flame), 0, 1.8, 0); return g; }],
  lamp_hanging: ['ceiling', (P) => B.lampHung(P)],
  lamp_desk: ['surface', (P) => B.lampStand(P)],
  oil_lamp: ['surface', (P) => B.lampStand(P)],
  brazier_iron: ['floor', (P) => B.brazier(P)],
};

/**
 * THE ARCHITECTURE KIT — RI-WLD03 R5. Each settlement's `architecture_kit.meshes` names eight
 * bespoke elements and its `silhouette` names the one no other town uses. The interiors carry
 * four of each town's eight in their prop lists, and these are the first implementation any of
 * them has had. Built as STRUCTURE: large, against the shell, load-bearing to look at.
 */
const KIT = {
  // Thorn: black needle-wood thatch over a rotted great-hall. Nothing free-standing.
  tho_rotted_hall: ['arch', (P) => { const g = new THREE.Group(); for (let i = 0; i < 4; i++) { const r = cyl(0.18, 0.3, 4.2, 6, P.wood); r.rotation.z = 0.3 - (i % 2) * 0.6; part(g, r, (i - 1.5) * 0.9, 2.0, 0); } return g; }],
  tho_thorn_thatch: ['arch', (P) => { const g = new THREE.Group(); for (let i = 0; i < 14; i++) { const n = cyl(0.012, 0.03, 0.7, 4, P.roof); n.rotation.z = 0.5; n.rotation.x = (i % 3) * 0.12; part(g, n, -1.3 + i * 0.2, 0.3, 0); } return g; }],
  tho_lean_to: ['arch', (P) => { const g = new THREE.Group(); const s = box(2.4, 0.14, 2.6, P.roof); s.rotation.x = 0.42; part(g, s, 0, 1.7, 0); part(g, cyl(0.1, 0.12, 1.6, 5, P.wood), -1.1, 0.8, 1.0); part(g, cyl(0.1, 0.12, 1.6, 5, P.wood), 1.1, 0.8, 1.0); return g; }],
  tho_stilt_house: ['arch', (P) => { const g = new THREE.Group(); for (const sx of [-0.7, 0.7]) for (const sz of [-0.7, 0.7]) part(g, cyl(0.09, 0.11, 1.5, 5, P.wood), sx, 0.75, sz); part(g, box(1.9, 0.14, 1.9, P.wood), 0, 1.55, 0); return g; }],
  // Helstrom: grown, not built. A living bole with a shell roof.
  hel_bole_arch: ['arch', (P) => { const g = new THREE.Group(); for (const sx of [-1, 1]) { const l = cyl(0.24, 0.4, 3.4, 7, P.wood); l.rotation.z = sx * 0.24; part(g, l, sx * 1.0, 1.7, 0); } const t = new THREE.Mesh(new THREE.TorusGeometry(1.1, 0.22, 5, 10, Math.PI), P.wood); part(g, t, 0, 3.2, 0); return g; }],
  hel_grown_wall_a: ['arch', (P) => { const g = new THREE.Group(); for (let i = 0; i < 5; i++) { const f = cyl(0.14, 0.2, 2.8 - (i % 2) * 0.4, 6, P.wood); part(g, f, (i - 2) * 0.44, 1.3, 0); } return g; }],
  hel_grown_wall_b: ['arch', (P) => { const g = new THREE.Group(); for (let i = 0; i < 4; i++) { const b = ico(0.4, 1, P.accent); b.scale.set(1, 1.6, 0.5); part(g, b, (i - 1.5) * 0.6, 1.1 + (i % 2) * 0.3, 0); } return g; }],
  hel_shell_roof: ['arch', (P) => { const g = new THREE.Group(); const s = ico(1.5, 1, P.roof); s.scale.set(1, 0.34, 1); part(g, s, 0, 2.9, 0); return g; }],
  // Lilmoth: half-sunk. Facades under the waterline, stilts and reed shacks above it.
  lil_sunk_facade: ['arch', (P) => { const g = new THREE.Group(); const w = box(3.0, 2.4, 0.3, P.stone); w.rotation.z = 0.07; part(g, w, 0, 1.1, 0); part(g, box(0.8, 1.2, 0.34, P.roof), -0.8, 1.3, 0); return g; }],
  lil_drowned_window: ['arch', (P) => { const g = new THREE.Group(); part(g, box(0.9, 1.2, 0.12, P.stone), 0, 1.5, 0); part(g, box(0.66, 0.96, 0.05, P.glass), 0, 1.5, 0.08); return g; }],
  lil_stilt_platform: ['arch', (P) => { const g = new THREE.Group(); for (let i = 0; i < 4; i++) part(g, cyl(0.1, 0.13, 1.2, 5, P.wood), (i - 1.5) * 0.7, 0.6, 0); part(g, box(3.0, 0.12, 1.2, P.wood), 0, 1.25, 0); return g; }],
  lil_reed_shack: ['arch', (P) => { const g = new THREE.Group(); for (let i = 0; i < 9; i++) part(g, cyl(0.02, 0.03, 2.0, 4, P.cloth), -0.8 + i * 0.2, 1.0, 0); const r = box(2.0, 0.1, 1.4, P.roof); r.rotation.x = 0.3; part(g, r, 0, 2.1, 0); return g; }],
  // Stormhold: legion block on a bloom course. A grid, and it shows.
  sto_legion_block: ['arch', (P) => { const g = new THREE.Group(); for (let r = 0; r < 4; r++) for (let c = 0; c < 3; c++) part(g, box(0.86, 0.42, 0.5, P.stone), (c - 1) * 0.92 + (r % 2) * 0.2, 0.24 + r * 0.46, 0); return g; }],
  sto_bloom_course: ['arch', (P) => { const g = new THREE.Group(); for (let i = 0; i < 7; i++) part(g, box(0.4, 0.22, 0.34, P.accent), (i - 3) * 0.44, 1.9, 0); return g; }],
  sto_grid_barrack: ['arch', (P) => { const g = new THREE.Group(); for (let i = 0; i < 3; i++) { part(g, box(0.16, 2.8, 0.16, P.stone), (i - 1) * 1.1, 1.4, 0); } part(g, box(2.6, 0.2, 0.24, P.stone), 0, 2.8, 0); return g; }],
  sto_wall_lean: ['arch', (P) => { const g = new THREE.Group(); const w = box(2.6, 2.6, 0.28, P.stone); w.rotation.z = -0.08; part(g, w, 0, 1.3, 0); return g; }],
  // Archon: dye town. Vats, drying racks and a stain line the water left on every wall.
  arc_clay_dome: ['arch', (P) => { const g = new THREE.Group(); const d = ico(1.2, 1, P.roof); d.scale.set(1, 0.6, 1); part(g, d, 0, 2.3, 0); part(g, cyl(1.2, 1.3, 0.4, 10, P.wall), 0, 1.9, 0); return g; }],
  arc_stain_line: ['arch', (P) => { const g = new THREE.Group(); part(g, box(3.2, 0.16, 0.06, P.accent), 0, 1.2, 0); part(g, box(3.2, 0.08, 0.05, P.cloth), 0, 1.05, 0); return g; }],
  arc_dye_vat: ['arch', (P) => { const g = new THREE.Group(); part(g, cyl(0.7, 0.78, 1.1, 12, P.stone), 0, 0.55, 0); const s = cyl(0.66, 0.66, 0.04, 12, P.accent); part(g, s, 0, 1.06, 0); return g; }],
  arc_drying_rack: ['arch', (P) => { const g = new THREE.Group(); for (const sx of [-1.2, 1.2]) part(g, cyl(0.07, 0.07, 2.4, 5, P.wood), sx, 1.2, 0); for (let i = 0; i < 4; i++) part(g, box(0.5, 1.3, 0.03, P.cloth), -0.9 + i * 0.6, 1.5, 0); return g; }],
  // Blackrose: a fortress the marsh has furred over.
  bla_fortress_wall: ['arch', (P) => { const g = new THREE.Group(); for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) part(g, box(1.0, 0.62, 0.6, P.stone), (c - 1) * 1.05 + (r % 2) * 0.3, 0.34 + r * 0.66, 0); return g; }],
  bla_furred_parapet: ['arch', (P) => { const g = new THREE.Group(); for (let i = 0; i < 5; i++) { part(g, box(0.42, 0.5, 0.4, P.stone), (i - 2) * 0.62, 2.3, 0); const m = ico(0.2, 0, P.accent); m.scale.set(1, 0.4, 1); part(g, m, (i - 2) * 0.62, 2.56, 0); } return g; }],
  bla_corridor_gate: ['arch', (P) => { const g = new THREE.Group(); for (const sx of [-0.9, 0.9]) part(g, box(0.36, 2.8, 0.5, P.stone), sx, 1.4, 0); part(g, box(2.2, 0.4, 0.5, P.stone), 0, 2.9, 0); for (let i = 0; i < 5; i++) part(g, cyl(0.04, 0.04, 1.0, 4, P.metal), -0.6 + i * 0.3, 2.3, 0); return g; }],
  bla_prison_block: ['arch', (P) => { const g = new THREE.Group(); part(g, box(2.2, 2.6, 0.4, P.stone), 0, 1.3, 0); { const gr = B.grate(P); gr.position.set(0, 0, 0.2); g.add(gr); }; return g; }],
  // Gideon: Imperial timber frame, tile roof, a market cross and an arcaded square.
  gid_timber_frame: ['arch', (P) => { const g = new THREE.Group(); part(g, box(2.8, 2.6, 0.14, P.wall), 0, 1.3, 0); for (const sx of [-1.3, 0, 1.3]) part(g, box(0.16, 2.6, 0.2, P.wood), sx, 1.3, 0.06); part(g, box(2.8, 0.16, 0.2, P.wood), 0, 1.3, 0.06); const d = box(2.9, 0.16, 0.2, P.wood); d.rotation.z = 0.72; part(g, d, -0.65, 1.9, 0.06); return g; }],
  gid_tile_roof: ['arch', (P) => { const g = new THREE.Group(); for (let r = 0; r < 4; r++) for (let c = 0; c < 6; c++) { const t = box(0.44, 0.06, 0.3, P.roof); t.rotation.x = 0.34; part(g, t, (c - 2.5) * 0.46, 2.5 + r * 0.16, r * 0.28); } return g; }],
  gid_market_cross: ['arch', (P) => { const g = new THREE.Group(); part(g, cyl(0.9, 1.0, 0.3, 8, P.stone), 0, 0.15, 0); part(g, cyl(0.16, 0.2, 2.6, 8, P.stone), 0, 1.5, 0); part(g, box(0.9, 0.18, 0.18, P.stone), 0, 2.5, 0); return g; }],
  gid_square_arcade: ['arch', (P) => { const g = new THREE.Group(); for (let i = 0; i < 3; i++) { part(g, cyl(0.16, 0.18, 2.4, 8, P.stone), (i - 1) * 1.3, 1.2, 0); const a = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.13, 4, 8, Math.PI), P.stone); part(g, a, (i - 0.5) * 1.3, 2.4, 0); } return g; }],
  // Soulrest: bone and salt. Ribs for frames, bleached walls.
  sou_rib_frame: ['arch', (P) => { const g = new THREE.Group(); for (const sx of [-1, 1]) { const r = new THREE.Mesh(new THREE.TorusGeometry(1.3, 0.14, 4, 9, Math.PI * 0.6), P.stone); r.rotation.z = sx * 0.5; part(g, r, sx * 0.5, 1.4, 0); } return g; }],
  sou_salt_block: ['arch', (P) => { const g = new THREE.Group(); for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) { const b = box(0.8, 0.6, 0.6, P.stone); part(g, b, (c - 1) * 0.86, 0.34 + r * 0.64, (r % 2) * 0.08); } return g; }],
  sou_bleached_wall: ['arch', (P) => { const g = new THREE.Group(); part(g, box(3.0, 2.6, 0.24, P.stone), 0, 1.3, 0); for (let i = 0; i < 4; i++) part(g, box(0.1, 2.4, 0.06, P.accent), (i - 1.5) * 0.7, 1.3, 0.14); return g; }],
  sou_bone_stack: ['arch', (P) => { const g = new THREE.Group(); for (let i = 0; i < 9; i++) { const b = cyl(0.07, 0.09, 0.9, 5, P.stone); b.rotation.z = Math.PI / 2; part(g, b, 0, 0.1 + Math.floor(i / 3) * 0.22, (i % 3) * 0.22 - 0.22); } return g; }],
};

Object.assign(PROPS, KIT);

/** Anything the record names that this table has no body for still gets a body. */
function fallbackProp(P, id) {
  const g = new THREE.Group();
  const h = hashStr(id);
  const w = 0.4 + ((h >>> 3) % 60) / 100, hh = 0.3 + ((h >>> 9) % 90) / 100;
  part(g, box(w, hh, w * 0.7, P.wood), 0, hh / 2, 0);
  part(g, box(w * 1.05, 0.05, w * 0.75, P.accent), 0, hh, 0);
  return g;
}

/* ================================================================================================
 * THE ROOM
 * ==============================================================================================*/

/** The four walls, as slot rings a prop can be stood against. */
// W1-15 round 4: MOVED to `world/interior-lighting.js` and imported above, unchanged. The stealth
// system derives S-1's cover volumes from this same grid — a searcher that checks behind the
// counter has to agree with the file that drew the counter, and two copies of a placement grid is
// the same rule-10 defect the lit set had.

/**
 * Build the room this record describes into `root`.
 *
 * Returns a summary of WHAT WAS READ — every number in it is a count of record fields that
 * reached the scene graph, which is what a consumption probe needs and what an unconsumed model
 * cannot produce.
 */
export function buildInterior(root, rec, opts) {
  // ROUND 6: `opts.propInset === false` disables the per-prop inset added below, so RULES rule 6
  // can delete that leg on a copy without editing this file. Optional third argument; every
  // existing caller passes two and gets the shipped behaviour.
  const PROP_INSET = !(opts && opts.propInset === false);
  const summary = {
    id: rec && rec.id ? rec.id : null, name: (rec && rec.name) || null,
    kind: (rec && rec.interior_kind) || null, settlement: (rec && rec.settlement) || null,
    bounds: null, props_declared: 0, props_built: 0, props_fallback: 0,
    kit_meshes: 0, lights_declared: 0, lights_lit: 0, lamps_built: 0,
    containers: 0, unique_item: false, readable: false,
    windows: 0, storeys: 1, back_room: false, meshes: 0, triangles: 0,
    // WHERE THE TAKEABLE THINGS ARE. Published so `Engine._furnishInterior()` can put a real
    // prop entity at the exact spot the pedestal and the book were drawn — RI-QST08's "thirty
    // unique items declared, none reachable through a door" needs a body AND a position, and a
    // body the world cannot reach is the same orphan wearing a mesh.
    // `readables` is the plural W1-READABLES needed and `readable` is kept as the first of them,
    // because a room may hold more than one document and the Drowned Court's archive holds two.
    placements: { unique: null, readable: null, readables: [] },
  };
  if (!rec) { summary.error = 'no record'; return summary; }

  const P = paletteFor(rec);
  const art = rec.settlement ? settlementArt(rec.settlement) : null;
  const bounds = rec.bounds_m || { x: [-6, 6], y: [0, 3.2], z: [-9, 9] };
  const bx = bounds.x, by = bounds.y, bz = bounds.z;
  const W = bx[1] - bx[0], H = by[1] - by[0], D = bz[1] - bz[0];
  summary.bounds = { w: +W.toFixed(2), h: +H.toFixed(2), d: +D.toFixed(2) };
  const h = hashStr(rec.id || 'interior');

  // ---- the shell ----------------------------------------------------------------------------
  // RI-WLD13 N1: `bounds_m` IS the room, rather than a number a check divides by itself.
  // Floor, ceiling and the four walls are named `roomshell` and nothing else in the room is.
  // That name is how `tools/world/w1-04-r4-join.mjs` asks "how big is the room" without a shelf
  // that overhangs its wall answering for it — RI-WLD13 N1 is a question about the shell.
  const floor = box(W, 0.3, D, P.floor);
  floor.name = 'roomshell';
  floor.position.set((bx[0] + bx[1]) / 2, by[0] - 0.15, (bz[0] + bz[1]) / 2);
  floor.receiveShadow = true; root.add(floor);
  // Floor construction at player scale: long irregular boards or stone flags provide a depth
  // and direction read that a single textured plane cannot. Kept low and deterministic so all
  // 115 rooms share the repair without covering interactable placements.
  const floorOrdered=rec.settlement&&['gideon','stormhold','blackrose'].includes(rec.settlement);
  const floorCourses=Math.max(4,Math.min(18,Math.ceil(D/(floorOrdered?1.8:.85))));
  for(let i=0;i<floorCourses;i++){
    const z=bz[0]+(i+.5)*D/floorCourses,strip=box(W-.35,.025,Math.max(.18,D/floorCourses-.055),floorOrdered?P.stone:(i%3===0?P.wood:P.floor));
    strip.position.set((bx[0]+bx[1])/2,by[0]+.018,z);strip.rotation.y=floorOrdered?0:(((h+i*13)%7)-3)*.003;strip.receiveShadow=true;strip.name='interior-floor-course';root.add(strip);
  }
  const ceil = box(W, 0.3, D, P.roof);
  ceil.name = 'roomshell';
  ceil.position.set((bx[0] + bx[1]) / 2, by[1] + 0.15, (bz[0] + bz[1]) / 2);
  ceil.receiveShadow = true; root.add(ceil);

  // The doorway goes in the wall `continuity.entry_side` names, which is the same field
  // `interior_spawn` is derived from — so the door you came in by is the door you can see.
  const entry = (rec.continuity && rec.continuity.entry_side) || 'south';
  const DOOR_W = 1.4;
  const shell = (m) => { m.name = 'roomshell'; return m; };
  const addWall = (cx, cz, w, d, side) => {
    if (side !== entry) { part(root, shell(box(w, H, d, P.wall)), cx, by[0] + H / 2, cz); return; }
    // Split, and put a lintel over the gap.
    const along = w > d;
    const span = along ? w : d;
    const seg = (span - DOOR_W) / 2;
    for (const s of [-1, 1]) {
      const off = s * (DOOR_W / 2 + seg / 2);
      part(root, shell(box(along ? seg : w, H, along ? d : seg, P.wall)), cx + (along ? off : 0), by[0] + H / 2, cz + (along ? 0 : off));
    }
    part(root, shell(box(along ? DOOR_W : w, H - 2.1, along ? d : DOOR_W, P.wall)), cx, by[0] + 2.1 + (H - 2.1) / 2, cz);
    const frame = P.wood;
    part(root, box(along ? DOOR_W + 0.3 : d + 0.1, 0.18, along ? d + 0.1 : DOOR_W + 0.3, frame), cx, by[0] + 2.1, cz);
  };
  addWall((bx[0] + bx[1]) / 2, bz[0], W, 0.3, 'north');
  addWall((bx[0] + bx[1]) / 2, bz[1], W, 0.3, 'south');
  addWall(bx[0], (bz[0] + bz[1]) / 2, 0.3, D, 'west');
  addWall(bx[1], (bz[0] + bz[1]) / 2, 0.3, D, 'east');

  // Continuous base and cornice courses give every room a readable wall/floor/ceiling junction;
  // settlement palettes make these masonry in ordered towns and lashed timber elsewhere.
  for(const y of [by[0]+.12,by[1]-.16]){
    part(root,box(W-.34,.18,.16,y<by[0]+1?P.stone:P.wood),(bx[0]+bx[1])/2,y,bz[0]+.19);
    part(root,box(W-.34,.18,.16,y<by[0]+1?P.stone:P.wood),(bx[0]+bx[1])/2,y,bz[1]-.19);
    part(root,box(.16,.18,D-.34,y<by[0]+1?P.stone:P.wood),bx[0]+.19,y,(bz[0]+bz[1])/2);
    part(root,box(.16,.18,D-.34,y<by[0]+1?P.stone:P.wood),bx[1]-.19,y,(bz[0]+bz[1])/2);
  }

  // Beams. Count follows the room's depth, so a long hall reads as a long hall.
  const beams = Math.max(2, Math.min(9, Math.round(D / 3)));
  for (let i = 0; i < beams; i++) {
    part(root, box(W, 0.28, 0.28, P.wood), (bx[0] + bx[1]) / 2, by[1] - 0.32, bz[0] + (i + 0.5) * (D / beams));
  }
  // Settlement grammar remains visible after the door closes: asymmetric braces at the shell
  // junction use the town's own structural material and cadence rather than generic decoration.
  if (art) {
    const ordered = art.imperial;
    const braceN = ordered ? 4 : 3 + (h % 3);
    for (let i=0;i<braceN;i++) {
      const x=bx[0]+(i+1)*W/(braceN+1);
      const brace=box(.14,H*.78,.18,ordered?P.stone:P.wood);
      brace.position.set(x,by[0]+H*.39,bz[0]+.18);
      brace.rotation.z=ordered?0:(((h>>i)&1)?-.16:.16);
      brace.name=`world-art:${rec.settlement}:${art.support}`;
      brace.castShadow=true; root.add(brace);
    }
    // Continue the same grammar around material junctions and across the ceiling. Imperial rooms
    // keep an exact course; marsh rooms alternate lashings, sag and missing/damaged segments.
    const junctionN=ordered?Math.max(4,Math.round(D/2.5)):Math.max(3,Math.round(D/3.4));
    for(let i=0;i<junctionN;i++) {
      if(!ordered && ((h>>(i%16))&3)===3) continue;
      const z=bz[0]+(i+.5)*D/junctionN;
      const tie=box(W*(ordered?.96:.82),ordered?.11:.08,ordered?.12:.16,ordered?P.stone:(i%2?P.wood:P.accent));
      tie.position.set((bx[0]+bx[1])/2,by[1]-(ordered?.18:.28+(i%2)*.09),z);
      tie.rotation.z=ordered?0:((i%2?1:-1)*.025);
      tie.name=`world-art-interior:${rec.settlement}:${art.trim}`;tie.castShadow=true;root.add(tie);
    }
    for(const sx of [-1,1]) {
      const sill=box(.13,.18,D*.88,ordered?P.stone:P.wood);
      sill.position.set(sx*(W/2-.24)+(bx[0]+bx[1])/2,by[0]+.09,(bz[0]+bz[1])/2);
      sill.name=`world-art-interior:${rec.settlement}:material-junction`;sill.receiveShadow=true;root.add(sill);
    }
    root.userData.worldArt={settlement:rec.settlement,grammar:art.grammar,support:art.support,trim:art.trim};
    summary.world_art=root.userData.worldArt;
  }

  // ---- windows — RI-WLD13 N4, which had no field and now has a rule --------------------------
  // A gaol, a barge hold and an undertemple do not have them; everything else does, and how many
  // follows the wall it is in.
  //
  // W1-15 ROUND 4: the rule itself now lives in `world/interior-lighting.js#windowPlan()`, because
  // the SIMULATION needs to read this aperture and a window rule written only here is a window
  // rule the stealth model cannot see. Round 3 dropped indoor ambient to 0.04 — the `unlit
  // interior / xanmeer depth` row — and justified it with "a windowless cellar", while 112 of the
  // 115 interiors below draw up to eight windows each. Nothing in the build read one. The panes
  // drawn here and the daylight the detection model lets in are now the same list.
  const wplan = windowPlan(rec);
  for (const pane of wplan.panes) {
    part(root, box(PANE_W_M, PANE_H_M, 0.06, P.glass), pane.x, pane.y, pane.z);
    part(root, box(PANE_W_M + 0.16, 0.12, 0.12, P.wood), pane.x, pane.y + 0.45, pane.z);
    part(root, box(.07,PANE_H_M+.12,.10,P.wood),pane.x,pane.y,pane.z+.015);
    part(root, box(PANE_W_M+.12,.07,.10,P.wood),pane.x,pane.y,pane.z+.015);
    summary.windows++;
  }
  summary.glazed_area_m2 = +wplan.glazed_area_m2.toFixed(3);
  summary.aperture_ratio = +wplan.aperture_ratio.toFixed(5);

  // ---- the props ------------------------------------------------------------------------------
  const declared = (rec.props || []).slice();
  summary.props_declared = declared.length;
  const wSlots = wallSlots(bx, bz, 2.2);
  const fSlots = floorSlots(bx, bz, 2.4);
  let wi = h % Math.max(1, wSlots.length);
  let fi = (h >>> 7) % Math.max(1, fSlots.length);
  let ci = 0;
  let lastWall = null;
  const spine = (i) => ({ x: (bx[0] + bx[1]) / 2 + ((i % 2) ? 1.4 : -1.4), z: bz[0] + 1.8 + (i * 2.6) % Math.max(1.0, D - 3.6), yaw: 0 });
  let centreN = 0;

  for (let i = 0; i < declared.length; i++) {
    const id = declared[i];
    const entryDef = PROPS[id];
    const cls = entryDef ? entryDef[0] : 'floor';
    let obj;
    // A BUILDER THAT THREW USED TO BE COUNTED AS BUILT. The catch below has always substituted a
    // crate, but `props_fallback` was incremented only in the `!entryDef` arm — so 34 instances
    // across 22 rooms drew a generic crate while the summary called them their declared mesh, and
    // no build record could see it (round-3 verdict §5(b)). A prop that threw is a fallback and
    // is now counted as one, by name, so the next one to break is visible the day it breaks.
    let threw = null;
    try { obj = entryDef ? entryDef[1](P) : fallbackProp(P, id); } catch (e) { obj = fallbackProp(P, id); threw = String((e && e.message) || e); }
    if (!entryDef || threw) summary.props_fallback++;
    if (threw) (summary.props_threw || (summary.props_threw = [])).push({ id, error: threw });
    if (KIT[id]) summary.kit_meshes++;
    obj.name = `prop:${id}`;
    if (cls === 'wall' || cls === 'arch') {
      const s = wSlots[wi % wSlots.length]; wi += 1 + (h % 3);
      obj.position.set(s.x, by[0], s.z); obj.rotation.y = s.yaw;
      lastWall = { x: s.x, z: s.z, yaw: s.yaw };
    } else if (cls === 'centre') {
      const s = spine(centreN++);
      obj.position.set(s.x, by[0], s.z);
      obj.rotation.y = ((h >>> (i % 12)) % 8) * 0.785;
    } else if (cls === 'ceiling') {
      const s = spine(centreN);
      obj.position.set(s.x, by[1] - 0.35, s.z + 1.2);
    } else if (cls === 'surface' && lastWall) {
      // Small things go ON the last thing that had a top, which is the difference between a
      // shop and a warehouse: the scales stand on the counter.
      obj.position.set(lastWall.x + Math.cos(lastWall.yaw) * 0.3, by[0] + 1.06, lastWall.z + Math.sin(lastWall.yaw) * 0.3);
      obj.rotation.y = lastWall.yaw;
    } else {
      const s = fSlots[fi % fSlots.length]; fi += 1 + ((h >>> 4) % 3);
      obj.position.set(s.x, by[0], s.z);
      obj.rotation.y = ((h >>> (i % 10)) % 12) * 0.523;
    }
    obj.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
    // ---- W1-04 ROUND 6: A PROP IS NOT WIDER THAN THE ROOM IT IS IN ----------------------------
    //
    // `wallSlots()` insets a wall slot by a FIXED 0.55 m, which is right for a shelf and wrong for
    // an architectural kit mesh. `hel_shell_roof` is a 1.5 m radius shell; placed at 0.55 m from
    // the wall it reaches 0.95 m past the room — which is 0.29 m past the OUTSIDE face of the
    // building's own wall, because the room is the footprint less `ROOM_INSET_M`. Measured at
    // HEAD: 61 meshes in 49 rooms more than 0.6 m outside their room, four kit meshes between
    // them (`arc_clay_dome` 24, `hel_shell_roof` 26, `tho_lean_to` 8, `gid_square_arcade` 3), worst
    // 0.95 m — and 0.95 = 1.5 − 0.55 exactly, which is what made it a diagnosis rather than a
    // guess. The round-5 census reported 0 for the same rooms because its code measured CLEARANCE
    // (is the whole box outside the room) while its prose described OVERHANG (does the box reach
    // outside the room); the round-5 verdict settled that the disagreement is the predicate and not
    // the tolerance.
    //
    // The inset is now the prop's OWN half-extent rather than a constant. Measured after
    // placement and rotation, because a 2.4 m lean-to turned 90° is a different width.
    {
      if (PROP_INSET) {
      obj.updateWorldMatrix(true, true);
      const bb = new THREE.Box3().setFromObject(obj);
      if (Number.isFinite(bb.min.x) && Number.isFinite(bb.max.x)) {
        const dx = Math.max(bx[0] - bb.min.x, 0) - Math.max(bb.max.x - bx[1], 0);
        const dz = Math.max(bz[0] - bb.min.z, 0) - Math.max(bb.max.z - bz[1], 0);
        // Only pull INWARD: a prop wider than the room cannot be made to fit and pushing it back
        // and forth between two walls would move it every frame the room was rebuilt. It is
        // centred instead, and the census still reports it.
        if (bb.max.x - bb.min.x <= bx[1] - bx[0]) obj.position.x += dx;
        else obj.position.x = (bx[0] + bx[1]) / 2 - (bb.min.x + bb.max.x) / 2 + obj.position.x;
        if (bb.max.z - bb.min.z <= bz[1] - bz[0]) obj.position.z += dz;
        else obj.position.z = (bz[0] + bz[1]) / 2 - (bb.min.z + bb.max.z) / 2 + obj.position.z;
      }
      }
    }
    root.add(obj);
    summary.props_built++;
    ci++;
  }

  // ---- verticality — RI-WLD07 and RI-WLD13 N5 -------------------------------------------------
  // A record that declares a stair HAS an upper floor. Thirteen do; before this they had a stair
  // that led to the ceiling.
  if (declared.includes('stair_narrow') || declared.includes('ladder_steep')) {
    const my0 = by[0] + Math.min(2.3, H - 0.9);
    const deck = box(W * 0.42, 0.16, D * 0.34, P.wood);
    part(root, deck, bx[1] - W * 0.21, my0, bz[1] - D * 0.17);
    for (let i = 0; i < 5; i++) part(root, cyl(0.07, 0.07, my0 - by[0], 5, P.wood), bx[1] - 0.4 - i * (W * 0.4 / 5), by[0] + (my0 - by[0]) / 2, bz[1] - D * 0.34);
    part(root, box(W * 0.42, 0.5, 0.1, P.wood), bx[1] - W * 0.21, my0 + 0.33, bz[1] - D * 0.34);
    summary.storeys = 2;
  }

  // ---- the back room — RI-WLD03 R2 -------------------------------------------------------------
  // "A shop that is one room with a counter is half a shop." A trading floor with a service and
  // the depth to spare gets a partition and a door through it.
  const SERVICED = new Set(['shop', 'guild', 'tavern', 'travel']);
  if (SERVICED.has(rec.interior_kind) && D >= 11 && rec.service) {
    const pz = bz[0] + D * 0.28;
    const seg = (W - 1.2) / 2;
    for (const s of [-1, 1]) part(root, box(seg, H, 0.22, P.wall), (bx[0] + bx[1]) / 2 + s * (0.6 + seg / 2), by[0] + H / 2, pz);
    part(root, box(1.2, H - 2.1, 0.22, P.wall), (bx[0] + bx[1]) / 2, by[0] + 2.1 + (H - 2.1) / 2, pz);
    part(root, box(1.5, 0.16, 0.3, P.wood), (bx[0] + bx[1]) / 2, by[0] + 2.1, pz);
    summary.back_room = true;
  }

  // ---- the lights ------------------------------------------------------------------------------
  //
  // W1-15 ROUND 4 — THIS FILE NO LONGER DECIDES WHAT IS LIT.
  //
  // It used to. `lights[]` is authored per PROPERTY ZONE, so a three-zone interior declares three
  // hearths at the same spot; this file deduped them, lit the first `LIT_CAP = 5` and drew the
  // rest as unlit fittings, and invented a hearth for a room declaring none. `sim/stealth/system.js`
  // deduped identically and then did NEITHER — it lit all of them and rescued none. One list, read
  // twice, two policies. Measured over 22,751 indoor floor cells: **1,659 disagreed (7.29%)** about
  // whether a player standing there is in shadow, and **1,584 of those were drawn lit and simulated
  // pitch black** — the eleven rooms with no `lights[]`, pinned at the `unlit` row 0.0400 at every
  // hour while this file drew them a fire, two readable windows and the people standing in them.
  //
  // `litLights(rec)` is now the single answer, and it is the same object on both sides. The cap is
  // gone (see that module's header: one interior is built at a time and the worst room declares 14
  // lamps, so the "591 shadow-casting lamps" budget was never the thing it was protecting); the
  // SHADOW cap that was ever real is still here, as `L.shadow`, and it is still exactly one light
  // per room. The fail-open moved there too, so a room with no declared lamp is lit identically by
  // both readers instead of only by this one.
  summary.lights_declared = (rec.lights || []).length;
  const lamps = litLights(rec);
  for (const L of lamps) {
    const fitting = L.hearth ? B.hearth(P) : B.lampStand(P);
    fitting.position.set(L.fitting_pos[0], L.fitting_pos[1], L.fitting_pos[2]);
    fitting.name = `light:${L.id}`;
    fitting.traverse((m) => { if (m.isMesh && m.material !== P.flame) { m.castShadow = true; m.receiveShadow = true; } });
    root.add(fitting);
    summary.lamps_built++;
    const colour = L.hearth ? 0xffa050 : 0xffc890;
    const pl = new THREE.PointLight(colour, L.intensity * (L.hearth ? 16 : 6.2), L.hearth ? 18 : 8, 2);
    pl.position.set(L.emit_pos[0], L.emit_pos[1], L.emit_pos[2]);
    if (L.shadow) { pl.castShadow = true; pl.shadow.mapSize.set(512, 512); pl.shadow.bias = -0.004; }
    root.add(pl);
  }
  summary.lights_lit = lamps.length;
  summary.lights_synthesized = lamps.filter((L) => L.synthesized).length;

  // Practical lamps provide direction, but their inverse-square falloff left most characters
  // and material junctions as black cut-outs in the shipping third-person camera.  A bounded
  // indirect term stands in for light bounced by the room's own walls and for diffuse daylight
  // arriving through the aperture plan above.  It is intentionally an actual scene light (not
  // exposure or a full-screen lift), so normals, roughness and occlusion continue to describe
  // the room. Windowless holds stay substantially darker than glazed shops and halls.
  const apertureFill=Math.min(.55,summary.aperture_ratio*14);
  const indirect=new THREE.HemisphereLight(
    summary.windows ? 0x9eacc0 : 0x665c58,
    rec.settlement==='lilmoth'||rec.settlement==='helstrom' ? 0x24372d : 0x32251d,
    .95+apertureFill,
  );
  indirect.position.set((bx[0]+bx[1])/2,by[1]-.25,(bz[0]+bz[1])/2);
  indirect.name=`interior-bounced-fill:${rec.id}`;
  root.add(indirect);
  summary.indirect_fill={intensity:+(.95+apertureFill).toFixed(3),source:summary.windows?'aperture-and-practicals':'practicals-only'};

  // ---- containers and the unique item -----------------------------------------------------------
  // RI-QST08: thirty unique items declared, none of them reachable through a door. They are in
  // the room now, on something, lit, and distinguishable from the furniture.
  const containers = (rec.containers || []).slice();
  summary.containers = containers.length;
  for (let i = 0; i < containers.length; i++) {
    const s = wSlots[(wi + i * 2) % wSlots.length];
    const c = B.chest(P, 0.72, 0.46);
    c.name = `container:${containers[i]}`;
    c.position.set(s.x, by[0], s.z); c.rotation.y = s.yaw;
    c.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
    root.add(c);
  }
  if (rec.unique_item) {
    const g = new THREE.Group();
    g.name = `unique:${rec.unique_item.id || 'unique'}`;
    part(g, cyl(0.26, 0.32, 0.86, 8, P.stone), 0, 0.43, 0);
    part(g, box(0.5, 0.06, 0.5, P.stone), 0, 0.89, 0);
    const it = ico(0.13, 1, P.accent);
    part(g, it, 0, 1.02, 0);
    part(g, ico(0.05, 0, P.glass), 0, 1.02, 0);
    const s = spine(centreN + 1);
    g.position.set(s.x, by[0], s.z);
    root.add(g);
    summary.unique_item = true;
    summary.placements.unique = {
      id: rec.unique_item.id || `${rec.id}-unique`,
      name: rec.unique_item.name || 'something nobody has named',
      owner: rec.unique_item.owner || null,
      // On top of the pedestal, which is 0.89 m of plinth plus the cap.
      pos: [s.x, by[0] + 1.02, s.z],
    };
  }
  // W1-READABLES: `readable` may be one record or a list of them. 83 of the 115 interiors carry
  // one, drawn as a book-shaped box on a shelf, and until now not one of them had anything
  // written in it — the record was an id and a title and no text anywhere. A record may now name
  // a `book` in `game/data/books/**`, which is what makes the drawn object a thing you can read;
  // a record without one is the shelf dressing it always was and is drawn exactly as before.
  const readables = Array.isArray(rec.readable) ? rec.readable : (rec.readable ? [rec.readable] : []);
  // NOT ON THE SHELF BESIDE THE DOOR. `sim/settlement.js` takes `interact` for the way out within
  // `DOOR_REACH_M` = 2.6 m of `continuity.interior_spawn`, and it takes it BEFORE the engine's
  // prop reach — so a document drawn within that radius is a document that can never be read:
  // press the button at it and you walk out of the room instead. Measured, not reasoned:
  // `tools/quests/document-route-world.mjs` refused to run the Archon leg and named the distance.
  // The slots are filtered rather than the reach changed, because 2.6 m is the door's number and
  // this is the shelf's problem.
  const spawnPt = (rec.continuity && rec.continuity.interior_spawn) || null;
  const readSlots = spawnPt
    ? wSlots.filter((s) => Math.hypot(s.x - spawnPt[0], s.z - spawnPt[2]) > 3.8)
    : wSlots;
  const rSlots = readSlots.length ? readSlots : wSlots;
  // TWO BOOKS MUST NOT BE THE SAME PLACE TO STAND. W1-READABLES round 2, and this is a defect the
  // browser found rather than a tidiness: the stride `(wi + 3 + ri * 2) % rSlots.length` WRAPS,
  // so a room with more documents than half its wall ring puts two of them within a metre of each
  // other — and `Engine._reachPrompt` and the interact reach both take the NEAREST prop. Standing
  // a metre from the tenth volume of the Tally in the Court archive and pressing the button
  // opened the Blackrose lease stubs instead, because the archive went from twelve documents to
  // fifteen when this round placed the shortfall series and the chapter room's Recension in it.
  //
  // So the slots are CHOSEN rather than indexed: walk the ring in the same stride, take a slot
  // only if it is at least `MIN_SEP_M` from every slot already taken, and if the ring runs out,
  // fall back to clear floor at the same separation. A room that still cannot fit them all keeps
  // the old wrapping behaviour for the remainder, which is a crowded shelf and not a crash.
  const MIN_SEP_M = 2.6;
  const taken = [];
  const farEnough = (s) => taken.every((t) => Math.hypot(t.x - s.x, t.z - s.z) >= MIN_SEP_M);
  const spare = (spawnPt
    ? floorSlots(bx, bz, 2.6).filter((s) => Math.hypot(s.x - spawnPt[0], s.z - spawnPt[2]) > 3.8)
    : floorSlots(bx, bz, 2.6));
  const slotFor = (ri) => {
    for (let k = 0; k < rSlots.length; k++) {
      const s = rSlots[(wi + 3 + ri * 2 + k) % rSlots.length];
      if (farEnough(s)) { taken.push(s); return s; }
    }
    for (const s of spare) if (farEnough(s)) { taken.push(s); return s; }
    return rSlots[(wi + 3 + ri * 2) % rSlots.length];
  };
  for (let ri = 0; ri < readables.length; ri++) {
    const r = readables[ri];
    if (!r) continue;
    const g = new THREE.Group();
    g.name = `readable:${r.id || 'readable'}`;
    const bk = box(0.3, 0.07, 0.22, P.cloth);
    part(g, bk, 0, 0.04, 0);
    // Successive documents take successive wall slots, so two books in one room are two places
    // to stand rather than one mesh inside another.
    const s = slotFor(ri);
    const px = s.x + Math.cos(s.yaw) * 0.25, pz = s.z + Math.sin(s.yaw) * 0.25;
    g.position.set(px, by[0] + 1.06, pz);
    root.add(g);
    summary.readable = true;
    const placed = {
      id: r.id || `${rec.id}-readable`,
      title: r.title || 'a page somebody left',
      book: r.book || null,
      pos: [px, by[0] + 1.1, pz],
    };
    summary.placements.readables.push(placed);
    if (!summary.placements.readable) summary.placements.readable = placed;
  }

  // ---- what got built --------------------------------------------------------------------------
  let meshes = 0, tris = 0;
  root.traverse((m) => {
    if (!m.isMesh || !m.geometry) return;
    meshes++;
    const g = m.geometry;
    tris += g.index ? g.index.count / 3 : (g.attributes.position ? g.attributes.position.count / 3 : 0);
  });
  summary.meshes = meshes;
  summary.triangles = Math.round(tris);
  return summary;
}

/**
 * THE GENERIC HALL, kept on purpose.
 *
 * `scene.js buildHall()` is what every one of the 113 unnamed interiors used to be, and this is
 * a copy of it. It is still needed, because `sim.env.interior` has writers other than the door:
 * `game/data/states/cam_cistern.json` sets it to `"cistern"` and `cam_stair.json` to
 * `"stairwell"`, and neither is an id the settlement table has ever heard of — they are W1-06's
 * camera fixtures. Without this, loading one of those states after visiting a real interior
 * would photograph the last room the player was in, which is the same class of defect as the
 * one this round exists to remove, only pointing the other way.
 *
 * So an unknown id gets the hall back, deterministically, rather than whatever was there.
 */
export function buildGenericHall(root) {
  const P = paletteFor({ interior_kind: 'hall', settlement: null, id: 'generic' });
  const floor = box(12, 0.3, 18, P.floor); floor.position.y = -0.15; floor.receiveShadow = true; root.add(floor);
  for (const [w, h, d, px, py, pz] of [[12, 4.4, 0.35, 0, 2.2, -9], [12, 4.4, 0.35, 0, 2.2, 9], [0.35, 4.4, 18, -6, 2.2, 0], [0.35, 4.4, 18, 6, 2.2, 0]]) {
    part(root, box(w, h, d, P.wall), px, py, pz);
  }
  const ceiling = box(12, 0.3, 18, P.roof); ceiling.position.y = 4.4; root.add(ceiling);
  for (let i = 0; i < 5; i++) part(root, box(12, 0.34, 0.34, P.wood), 0, 4.05, -7 + i * 3.5);
  const hearth = cyl(1.0, 1.15, 0.5, 12, P.stone); hearth.position.set(0, 0.25, 3.0); hearth.receiveShadow = true; root.add(hearth);
  const fire = new THREE.Mesh(new THREE.ConeGeometry(.13,.48,8,2),P.flame); fire.position.set(0, 0.60, 3.0); root.add(fire);
  const light = new THREE.PointLight(0xffa050, 18, 22, 2);
  light.position.set(0, 1.0, 3.0);
  light.castShadow = true; light.shadow.mapSize.set(512, 512); light.shadow.bias = -0.004;
  root.add(light);
  for (let i = 0; i < 6; i++) part(root, box(1.2, 0.8, 2.8, P.wall), -3.4 + (i % 3) * 3.4, 0.4, -5.5 + Math.floor(i / 3) * 2.4);
  part(root, box(1.4, 2.2, 1.2, P.wood), 0, 1.1, 7.4);
  return { id: null, generic: true, note: 'scene.js buildHall(), for a cell id no interior record claims' };
}

/**
 * Free everything a previous room allocated. Called before the next one is built.
 *
 * GEOMETRY ONLY. The materials belong to `PALETTE_CACHE` and are shared by every room of the
 * same kind in the same town — disposing them here would free a program that the next room is
 * about to need and put the compile back that the cache exists to remove. Forty-odd materials
 * held for the life of the renderer is the whole cost.
 */
export function clearInterior(root) {
  const dead = [];
  root.traverse((o) => { if (o !== root) dead.push(o); });
  for (const o of dead) if (o.geometry) o.geometry.dispose();
  root.clear();
}

/* ================================================================================================
 * THE SHARED VOCABULARY — added by W1-04 round 3, additively and with no behaviour change.
 *
 * The exterior half (`render/exterior.js`) has to be built out of THE SAME kit definitions, the
 * same palette rule and the same primitive helpers as the interior, for one reason: a building's
 * outside and its inside must be recognisably the same building. Two divergent sets of kits is
 * how the Crimson Apothecary ends up a clay dome from the street and a timber shed once you are
 * through the door, and the check that would have caught it — "does the exterior kit match the
 * interior kit for this record" — would be comparing two tables rather than one.
 *
 * Nothing above this line moved. These are the existing objects, exported.
 * ==============================================================================================*/

/** The four-per-town architecture-kit builders `props[]` already instantiates indoors. */
export const KIT_MESHES = KIT;
/** `(interior_kind, settlement) -> materials`, cached. The exterior asks for the same key. */
export { paletteFor };
/** The furniture vocabulary, so an exterior can stand a real barrel outside a real door. */
export const SHAPES = B;
/** box / cyl / ico / part — the four primitives every mesh in this file is assembled from. */
export const PRIMS = { box, cyl, ico, part, hashStr };
/**
 * The whole prop table, id -> [class, builder]. Exported for ONE reason: `buildInterior` catches
 * a throwing builder and silently substitutes a crate, so no build record can tell you which
 * builders throw. A probe that can call them one at a time can (round 3's verdict §5(b): 34
 * instances across 22 rooms were drawing a crate and being counted as built).
 */
export const PROPS_TABLE = PROPS;
