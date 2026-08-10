#!/usr/bin/env node
// RI-WPN03 D.3 — measured standing-chain grammar over every melee weapon.
'use strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadCombatData } from '../lib/combat-node.mjs';
import { MovesetLibrary } from '../../game/src/combat/moveset.js';
import { Rig } from '../../game/src/combat/skeleton.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const D = loadCombatData();
const classes = JSON.parse(fs.readFileSync(path.join(ROOT, 'game/data/weapons/classes.json')));
const registry = JSON.parse(fs.readFileSync(path.join(ROOT, 'game/data/weapons/clip-registry.json')));
const lib = new MovesetLibrary(registry, classes, D.weaponMovesets, D.skeleton, D.hitgeometry);
const SHAPES = ['thrust', 'shoot', 'spin', 'sweep', 'slash_h', 'smash', 'slash_v', 'slash_d', 'lash', 'grab'];
const ids = Object.keys(D.weaponMovesets).filter((id) => D.weaponMovesets[id].class !== 'BOW').sort();
const rig = new Rig(D.skeleton, D.hitgeometry);

function observed(id, slotId) {
  const slot = D.weaponMovesets[id].slots[slotId];
  const clip = lib.clipFor(id, slotId), sock = lib.socketsFor(id, slotId);
  const firstActive = slot.startup_f + (slot.charge_max_f || 0) + 1;
  const lastActive = firstActive + slot.active_f - 1;
  let first = null, last = null, prev = null, arc = 0;
  const pos = [0, 0, 0];
  for (let f = firstActive; f <= lastActive; f++) {
    pos[2] = clip.rootForwardAt(f); clip.applyPose(rig, f);
    rig.evaluate(pos, 0, clip.rootOffsetYAt(f), sock.a, sock.b);
    const p = [rig.socketB[0] - pos[0], rig.socketB[1], rig.socketB[2] - pos[2]];
    first ||= p; last = p;
    const r = Math.hypot(p[0], p[2]);
    if (r < 0.2) { prev = null; continue; }
    const b = Math.atan2(p[0], p[2]);
    if (prev !== null) { let q = b - prev; while (q > Math.PI) q -= 2 * Math.PI; while (q < -Math.PI) q += 2 * Math.PI; arc += Math.abs(q); }
    prev = b;
  }
  const dx = last[0] - first[0], dy = last[1] - first[1], dz = last[2] - first[2];
  return [arc * 180 / Math.PI, slot.root_dz_m || 0, slot.shape, Math.abs(Math.atan2(dy, Math.hypot(dx, dz))) * 180 / Math.PI];
}

const chains = new Map(); let max = 0;
for (const id of ids) {
  const ms = D.weaponMovesets[id], rows = []; let sid = 'r1.1'; const seen = new Set();
  while (sid && ms.slots[sid] && !seen.has(sid)) { seen.add(sid); rows.push(observed(id, sid)); sid = ms.slots[sid].chains_to; }
  max = Math.max(max, rows.length); chains.set(id, rows);
}
const raw = ids.map((id) => {
  const rows = chains.get(id), padded = rows.concat(Array.from({ length: max - rows.length }, () => rows.at(-1)));
  return padded.flatMap(([arc, root, shape, plane]) => [arc, root, ...SHAPES.map((s) => +(s === shape)), plane]);
});
const z = raw.map((r) => r.slice());
for (let k = 0; k < raw[0].length; k++) {
  const mean = raw.reduce((n, r) => n + r[k], 0) / raw.length;
  const sd = Math.sqrt(raw.reduce((n, r) => n + (r[k] - mean) ** 2, 0) / raw.length) || 1;
  for (let i = 0; i < raw.length; i++) z[i][k] = (raw[i][k] - mean) / sd;
}
const distances = [];
for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) {
  if (D.weaponMovesets[ids[i]].class !== D.weaponMovesets[ids[j]].class) continue;
  // A chain is the unit: average the Euclidean contribution over the five link positions so
  // padding does not make a longer corpus vector five times less "subtle" by construction.
  distances.push({ a: ids[i], b: ids[j], d: Math.hypot(...z[i].map((v, k) => v - z[j][k])) / max });
}
distances.sort((a, b) => a.d - b.d);
const median = distances[distances.length >> 1].d, minimum = distances[0].d;
const out = { population: `${ids.length} melee weapons`, max_chain: max, pairs: distances.length, Chg_min: +minimum.toFixed(4), Chg_med: +median.toFixed(4), minimum_pair: [distances[0].a, distances[0].b], below_minimum: distances.filter((p) => p.d < 0.15).map((p) => ({ ...p, d: +p.d.toFixed(4) })) };
console.log(JSON.stringify(out, null, 2));
if (process.argv.includes('--gate') && (minimum < 0.15 || median < 0.30 || median > 1.10)) process.exitCode = 1;
