#!/usr/bin/env node
// cam-occluder-id.mjs — WHAT, EXACTLY, IS BETWEEN THE CAMERA AND THE PLAYER?
//
// WHY THIS FILE EXISTS. `orchestration/status/W1-G1-CAMERA-OCCLUSION.json` measured a closed run of
// 26 `player_occluded` frames at Lilmoth and named the occluder as "a RAISED DECK ON POSTS" — an
// INFERENCE from a 160x90 evidence frame, and labelled as one. An inference is not good enough to
// aim a fix at: the whole G1 finding is that three instruments agreed nothing was wrong because
// they all read the same empty set, and a fourth guess read off a thumbnail is the same defect.
//
// So this asks the scene graph instead. On each sampled frame it casts a ray from the live camera
// position toward the player's torso and reports every drawn mesh the segment actually passes
// through, with the named ancestor group that identifies it, PLUS whether the camera point itself
// is inside any `settlementSolids()` box. It renders nothing and reads back no pixels, so it costs
// milliseconds per frame rather than the ~25 s/frame/arm `cam-occlusion-walk.mjs` costs.
//
// Usage: node tools/camera/cam-occluder-id.mjs [--from 275] [--to 315] [--every 1] [--tag t]
import fs from 'node:fs';
import path from 'node:path';
import { launchGame } from '../lib/browser.mjs';
import { startOpening } from '../lib/opening.mjs';

const REPO = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const args = {};
for (let i = 2; i < process.argv.length; i++) {
  if (!process.argv[i].startsWith('--')) continue;
  const k = process.argv[i].slice(2);
  args[k] = (process.argv[i + 1] && !process.argv[i + 1].startsWith('--')) ? process.argv[++i] : true;
}
const FROM = Number(args.from || 275);
const TO = Number(args.to || 315);
const EVERY = Number(args.every || 1);
const TAG = String(args.tag || 'occluder-id');
const OUT = path.resolve(REPO, args.out || `reports/cam-occluder-id/${TAG}`);
fs.mkdirSync(OUT, { recursive: true });

const g = await launchGame({ entry: 'game/index.html', width: 640, height: 360 });
await g.page.waitForFunction(() => window.__HARNESS, null, { timeout: 90000 });
await g.h('ready');
const opening = await startOpening(g, { start: 'debug', label: 'cam-occluder-id' });
await g.h('queueInputs', [{ f: 0, move: [0, 1] }]);
await g.h('stepFrames', FROM);

const probe = () => g.page.evaluate(async () => {
  // `game/index.html` declares the import map entry "three" -> ./vendor/three/three.module.js, so
  // this resolves to the SAME module instance the renderer is built from. Importing by absolute
  // path instead returns a second copy of three.js and the raycast then walks foreign classes.
  const THREE = window.__THREE || (window.__THREE = await import('three'));
  const E = window.__ENGINE, R = E.renderer, sim = E.sim, c = sim.camera;
  E.loop.renderNow();
  const cam = new THREE.Vector3(c.pos[0], c.pos[1], c.pos[2]);
  // Aim at the player's CHEST NODE (RI-CAM01 §A: 1.38 m on a 1.80 m reference figure), not the
  // feet: the pixel measure counts the whole body, and the chest is the point whose occlusion
  // corresponds to "the character is hidden".
  const tgt = new THREE.Vector3(sim.player.pos[0], sim.player.pos[1] + 1.38, sim.player.pos[2]);
  const dir = tgt.clone().sub(cam);
  const dist = dir.length();
  dir.normalize();
  const rc = new THREE.Raycaster(cam, dir, 0.01, dist);
  // The player's own root must not report itself as its own occluder.
  const player = R.playerMesh;
  const isPlayer = (o) => { for (let p = o; p; p = p.parent) if (p === player) return true; return false; };
  // A RAYCAST HAS NO NOTION OF DEPTH WRITES, AND THE SKY IS A UNIT SPHERE AROUND THE CAMERA.
  // `render/sky.js:558` builds `SphereGeometry(1)` with `side: BackSide, depthWrite: false,
  // renderOrder: -1000` and pins it to the eye, so EVERY ray leaves through it at 0.99 m and it
  // showed up as the nearest "occluder" on every frame of the first two runs. It occludes nothing:
  // it writes no depth and draws before everything. Anything that writes no depth is reported
  // separately rather than silently dropped, so a successor can see what was excluded and why.
  const raw = rc.intersectObject(R.scene, true).filter((h) => !isPlayer(h.object));
  const nonOccluding = raw.filter((h) => h.object.material && h.object.material.depthWrite === false);
  const hits = raw.filter((h) => !(h.object.material && h.object.material.depthWrite === false));
  const ident = (o) => {
    let named = o.name || '';
    for (let p = o.parent; p && !named; p = p.parent) named = p.name || '';
    return named || '(unnamed)';
  };
  const chain = (o) => { const c = []; for (let p = o; p; p = p.parent) c.push(`${p.name || p.type}`); return c.slice(0, 6).join(' < '); };
  // `compressSettlementMeshes()` collapses the town into `BatchedMesh`es and leaves the logical
  // piece's NAME behind as an empty marker Group at the same transform. So a batch hit is anonymous
  // by construction, and the only way back to "which awning" is the nearest surviving marker.
  const markers = [];
  R.scene.traverse((o) => { if (o.name && /^(world-art-street|world-art-exterior|building|kit-elevations|roof|signature):/.test(o.name)) markers.push(o); });
  const nearestMarker = (pt) => {
    let best = null, bd = Infinity;
    const v = new THREE.Vector3();
    for (const m of markers) {
      m.getWorldPosition(v);
      const d = v.distanceTo(pt);
      if (d < bd) { bd = d; best = m.name; }
    }
    return best ? { marker: best, m: +bd.toFixed(2) } : null;
  };
  const seen = new Map();
  for (const h of hits) {
    const key = ident(h.object);
    if (!seen.has(key)) {
      seen.set(key, {
        id: key, at_m: +h.distance.toFixed(2), point: h.point.toArray().map((n) => +n.toFixed(2)),
        type: h.object.type, geom: h.object.geometry && h.object.geometry.type,
        material: h.object.material && (h.object.material.name || h.object.material.type),
        chain: chain(h.object), batchId: h.batchId ?? null,
        nearest_marker: nearestMarker(h.point), n: 0,
      });
    }
    seen.get(key).n++;
  }
  // Is the camera itself standing inside a town collision box, and what is the nearest one?
  // `settlementSolidsReport()` returns a COUNT in `.shapes`, not the boxes. The boxes are the ones
  // the body is actually resolved against, so read them off the live cell rather than rebuilding
  // them from the plan — a rebuild is a second derivation and could disagree with what is installed.
  let solids = null;
  try { solids = E.settlementSolidsReport(); } catch { solids = null; }
  const shapes = (sim.cell && Array.isArray(sim.cell.shapes)) ? sim.cell.shapes : [];
  const inside = [];
  {
    for (const s of shapes) {
      const yaw = (s.yaw_deg || 0) * Math.PI / 180, cy = Math.cos(yaw), sy = Math.sin(yaw);
      const rx = c.pos[0] - s.c[0], rz = c.pos[2] - s.c[2];
      const lx = rx * cy - rz * sy, lz = rx * sy + rz * cy;
      if (Math.abs(lx) <= s.h[0] && Math.abs(lz) <= s.h[2] && Math.abs(c.pos[1] - s.c[1]) <= s.h[1]) inside.push(s.id);
    }
  }
  return {
    frame: sim.frame,
    player: sim.player.pos.map((n) => +n.toFixed(2)),
    camera: c.pos.map((n) => +n.toFixed(2)),
    armLen: +c.armLen.toFixed(3), armHit: c.armHit, clipThrough: c.clipThrough,
    ray_dist_m: +dist.toFixed(2),
    occluders: [...seen.values()].sort((a, b) => a.at_m - b.at_m),
    excluded_no_depth_write: nonOccluding.map((h) => ({ id: ident(h.object), at_m: +h.distance.toFixed(2), geom: h.object.geometry && h.object.geometry.type })),
    cell_id: sim.cell ? sim.cell.id : null,
    collision_shapes: shapes.length,
    settlement: solids ? solids.settlement : null,
    camera_inside_solids: inside,
  };
});

const rows = [];
const JSONL = path.join(OUT, 'rows.jsonl');
fs.writeFileSync(JSONL, '');
for (let f = FROM; f <= TO; f += EVERY) {
  const r = await probe();
  rows.push(r);
  fs.appendFileSync(JSONL, JSON.stringify(r) + '\n');
  console.log(JSON.stringify(r));
  if (f + EVERY <= TO) await g.h('stepFrames', EVERY);
}
const tally = {};
for (const r of rows) for (const o of r.occluders) tally[o.id] = (tally[o.id] || 0) + 1;
fs.writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify({
  schema: 'elder-souls/cam-occluder-id@1', tag: TAG, when: new Date().toISOString(), opening,
  window: [FROM, TO], every: EVERY, frames: rows.length,
  occluder_frequency: Object.fromEntries(Object.entries(tally).sort((a, b) => b[1] - a[1])),
  frames_with_any_occluder: rows.filter((r) => r.occluders.length).length,
  frames_camera_inside_a_solid: rows.filter((r) => r.camera_inside_solids.length).length,
}, null, 1));
console.log(JSON.stringify({ tally }, null, 1));
await g.close();
