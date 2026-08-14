#!/usr/bin/env node
/**
 * w1-30e-street-enclosure.mjs — is the street stand actually standing in a street?
 *
 *   node tools/render/w1-30e-street-enclosure.mjs             # all eight settlements
 *   node tools/render/w1-30e-street-enclosure.mjs soulrest    # one
 *
 * WHY IT EXISTS, and it is a warning about the instrument it replaces.
 *
 * `reports/w1-30de-remediation/README.md` §4 diagnosed Soulrest's failed street shot by listing
 * *"meshes whose XZ bounding box contains the Soulrest stand"* and finding
 * `roof.shell 43.7 x 3.5 x 42.7 m`. **An axis-aligned bounding box on a rotated building is not the
 * building.** A 17 m plan turned 45 degrees has a 24 m AABB and a 31 m one has 43 m, so a building
 * can "contain" a point it is nowhere near. The `roof.shell` defect that diagnosis found is real
 * and is fixed (`reports/w1-30e-kit-defects/README.md`); the attribution of *Soulrest* to it is not.
 *
 * So this asks the question directly, with rays instead of boxes:
 *
 *   * 16 horizontal rays at eye height from the **stand** — how enclosed is the player;
 *   * one ray straight up from the stand — is there a roof over the player out of doors;
 *   * the same two from the **camera's own point**, 4.9 m behind along −forward
 *     (`sim/camera.js rest_arm_m`) — because it is the camera that takes the picture, and
 *     `build-deck.mjs` gates the stand on that point's footprint clearance while nothing has ever
 *     gated on what is ABOVE it.
 *
 * Buildings are placed on the REAL terrain (`WorldField.heightAt`), not on a flat plane, because a
 * neighbour two metres downhill is a different amount of enclosure.
 *
 * WHAT IT CANNOT DO, said plainly because this tool's own result is a negative one: it builds
 * `buildSettlementExterior()` and nothing else. If a settlement's street shot comes back enclosed
 * while this reports open sky — which is exactly what Soulrest does, in the shipped tree AND in the
 * delete-the-fix clone — then the thing enclosing it is not in this output, and the next instrument
 * is a ray cast in the frame that was actually rendered, not another offline probe.
 */
'use strict';

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as THREE from '../../game/vendor/three/three.module.js';
import { planSettlement, buildSettlementExterior } from '../../game/src/render/exterior.js';
import { WorldField } from '../../game/src/world/field.js';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const rd = (p) => JSON.parse(fs.readFileSync(path.join(REPO, p), 'utf8'));

const deck = rd('tools/visual/deck.json');
const field = new WorldField(rd('game/data/world/terrain.json'), rd('game/data/world/regions.json'), rd('game/data/world/water.json'));
const groundY = (x, z) => field.heightAt(x, z);

/** `sim/camera.js` rest_arm_m — how far behind the player the third-person camera sits. */
const REST_ARM_M = 4.9;

const wanted = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const towns = wanted.length ? wanted
  : [...new Set(deck.setups.filter((s) => s.block === 'settlement-street').map((s) => s.settlement))].sort();

const rows = [];
for (const town of towns) {
  const setup = deck.setups.find((s) => s.block === 'settlement-street' && s.settlement === town);
  if (!setup) { console.log(`${town}: no street setup in deck.json`); continue; }
  const rec = rd(`game/data/world/settlements/${town}.json`);
  const interiors = {};
  for (const b of rec.buildings) if (b.interior) {
    const p = `game/data/world/interiors/${b.interior}.json`;
    if (fs.existsSync(path.join(REPO, p))) interiors[b.interior] = rd(p);
  }
  const root = new THREE.Group();
  buildSettlementExterior(root, planSettlement(rec, interiors, {}), groundY, { settlementBatch: false, buildingBatch: false });
  root.updateMatrixWorld(true);

  const rc = new THREE.Raycaster();
  rc.far = 200;
  const from = (x, y, z, dir) => { rc.set(new THREE.Vector3(x, y, z), dir); return rc.intersectObject(root, true); };
  const label = (h) => (h.length ? (h[0].object.userData.kitId || h[0].object.name || '(untagged)') : null);

  const px = setup.place.x, pz = setup.place.z, py = groundY(px, pz);
  const ring = (x, y, z) => {
    const ds = [];
    let nearest = Infinity, nearestName = '-';
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      const h = from(x, y, z, new THREE.Vector3(Math.sin(a), 0, Math.cos(a)));
      const d = h.length ? h[0].distance : Infinity;
      ds.push(d);
      if (d < nearest) { nearest = d; nearestName = label(h) || '-'; }
    }
    ds.sort((a, b) => a - b);
    return { nearest, nearestName, median: ds[8], blocked: ds.filter((d) => d < 3).length, open: ds.filter((d) => !Number.isFinite(d)).length };
  };

  const yaw = ((setup.camera && setup.camera.yaw_deg) || 0) * Math.PI / 180;
  const cx = px - Math.sin(yaw) * REST_ARM_M, cz = pz - Math.cos(yaw) * REST_ARM_M;

  const p = ring(px, py + 1.6, pz);
  const c = ring(cx, py + 2.2, cz);
  const upP = from(px, py + 1.6, pz, new THREE.Vector3(0, 1, 0));
  const upC = from(cx, py + 2.2, cz, new THREE.Vector3(0, 1, 0));

  rows.push({
    town, ground_y: +py.toFixed(1),
    player: { nearest: +p.nearest.toFixed(2), nearest_part: p.nearestName, median: Number.isFinite(p.median) ? +p.median.toFixed(2) : null, rays_under_3m: p.blocked, rays_fully_open: p.open },
    camera: { nearest: +c.nearest.toFixed(2), nearest_part: c.nearestName, rays_under_3m: c.blocked },
    over_player: upP.length ? { d: +upP[0].distance.toFixed(2), part: label(upP) } : null,
    over_camera: upC.length ? { d: +upC[0].distance.toFixed(2), part: label(upC) } : null,
  });
}

if (process.argv.includes('--json')) {
  console.log(JSON.stringify({ schema: 'elder-souls/w1-30e-street-enclosure@1', rows }, null, 2));
} else {
  for (const r of rows) {
    const op = r.over_player ? `${r.over_player.d}m [${r.over_player.part}]` : 'open sky';
    const oc = r.over_camera ? `${r.over_camera.d}m [${r.over_camera.part}]` : 'open sky';
    console.log(`${r.town.padEnd(11)} ground y${String(r.ground_y).padStart(6)}  player: nearest ${String(r.player.nearest).padStart(6)}m [${r.player.nearest_part}], ${r.player.rays_under_3m}/16 under 3 m, ${r.player.rays_fully_open}/16 open`);
    console.log(`${''.padEnd(11)}                camera: nearest ${String(r.camera.nearest).padStart(6)}m [${r.camera.nearest_part}]   OVER PLAYER ${op}   OVER CAMERA ${oc}`);
  }
}
