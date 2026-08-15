#!/usr/bin/env node
/**
 * f10-r9-crack-frames.mjs — PHOTOGRAPH the pixels `actor-orbit-holes.mjs` calls cracks.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * WHY THIS EXISTS: FOUR ROUNDS HAVE ARGUED ABOUT THIS NUMBER AND NOBODY HAS SEEN IT
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 *
 * `actor-orbit-holes.mjs` writes a JSON summary and **no image** (`grep -n "IDAT" ` over it
 * returns nothing). So `5,725 -> 6,405 -> 6,628 crack px` has been reasoned about entirely
 * through a scalar and a list of bordering part names. `orchestration/status/W1-F10-r8.json`
 * swept the garment hem twice trying to move it and recorded that **both of its predictions were
 * wrong** — which is what happens when you tune a number you cannot see.
 *
 * The round-9 brief's instruction is the right one and it is what this file serves: *"a ruling is
 * an acceptable outcome, but it must be evidenced by opening the frames the pixels are in, not
 * argued from the shape of the number."*
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * WHAT IT DRAWS, AND WHY IT IS NOT A PRETTY PICTURE
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 *
 * It reuses `actor-orbit-holes.mjs`'s OWN exported `collectTriangles`, `rasterise`, `findHoles`
 * and `viewProj` — the same rasteriser whose output the metric is computed from — so what you see
 * is what the metric saw, not a second renderer's opinion of it. Reimplementing the rasteriser
 * here would produce a picture of a different thing, which is the whole failure this is fixing.
 *
 *   dark grey   body coverage, shaded by depth (near = lighter)
 *   RED         an enclosed background pocket: background you cannot reach from the frame border
 *   cyan cross  the frame's own reported crack centroid, from the JSON
 *
 * Enclosed-vs-border-reachable is exactly `findHoles`' flood fill from the four edges. The
 * crack/through-gap split is `classifyPockets`, which is NOT exported; this tool therefore draws
 * **every** enclosed pocket and lets the reader see which are which, rather than re-implementing
 * a classifier and then quietly disagreeing with the metric.
 *
 * Usage:
 *   node tools/visual/f10-r9-crack-frames.mjs --pose=idle_ready@0 --angle=345 --dist=1.5 \
 *        --out=reports/f10-r9-cracks
 *   node tools/visual/f10-r9-crack-frames.mjs --self-test
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { deflateSync } from 'node:zlib';
import { collectTriangles, rasterise, findHoles, viewProj } from './actor-orbit-holes.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../..');

const args = {};
for (const a of process.argv.slice(2)) {
  if (!a.startsWith('--')) continue;
  const [k, v] = a.slice(2).split('=');
  args[k] = v === undefined ? true : v;
}

// ── a minimal PNG writer, same shape as tools/combat/w1-12-r2-chart.mjs ───────────────────
function crc32(buf) {
  let c, crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = c ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td), 0);
  return Buffer.concat([len, td, crc]);
}
function writePng(path, W, H, rgb) {
  const raw = Buffer.alloc(H * (W * 3 + 1));
  for (let y = 0; y < H; y++) {
    raw[y * (W * 3 + 1)] = 0;
    rgb.copy(raw, y * (W * 3 + 1) + 1, y * W * 3, (y + 1) * W * 3);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0)),
  ]));
}

// ══════════════════════════════════════════════════════════════════════════════════════════════
// SELF-TEST — the arms are required to disagree. A picture of a hole must differ from a picture
// of no hole, at the pixel level, or this tool is a decoration. `findHoles` is the thing under
// test here: a synthetic coverage mask with an enclosed pocket must paint red where the pocket is
// and a solid mask must paint no red at all.
// ══════════════════════════════════════════════════════════════════════════════════════════════
if (args['self-test']) {
  const res = 32;
  const solid = new Uint8Array(res * res).fill(0);
  for (let y = 8; y < 24; y++) for (let x = 8; x < 24; x++) solid[y * res + x] = 1;
  const holed = Uint8Array.from(solid);
  for (let y = 14; y < 18; y++) for (let x = 14; x < 18; x++) holed[y * res + x] = 0;

  const hSolid = findHoles(solid, res);
  const hHoled = findHoles(holed, res);
  const results = [
    { arm: 'a solid blob has no enclosed pocket', ok: hSolid.holePx === 0, read: hSolid.holePx },
    { arm: 'a blob with a 4x4 punched hole reports 16 enclosed px', ok: hHoled.holePx === 16, read: hHoled.holePx },
    { arm: 'both report the same body area, so the hole is not just "less blob"',
      ok: hSolid.bodyPx === hHoled.bodyPx + 16, read: [hSolid.bodyPx, hHoled.bodyPx] },
  ];
  const vacuous = hSolid.holePx === hHoled.holePx;
  const pass = results.every((r) => r.ok) && !vacuous;
  console.log(JSON.stringify({ tool: 'f10-r9-crack-frames --self-test', results, vacuous, pass }, null, 2));
  process.exit(pass ? 0 : 1);
}

// ══════════════════════════════════════════════════════════════════════════════════════════════
const THREE = await import(pathToFileURL(join(ROOT, 'game/vendor/three/three.module.js')).href);
const actorMod = await import(pathToFileURL(join(ROOT, 'game/src/render/actor.js')).href);
const { Rig } = await import(pathToFileURL(join(ROOT, 'game/src/combat/skeleton.js')).href);
const { addPose } = await import(pathToFileURL(join(ROOT, 'game/src/combat/clips.js')).href);
const skel = JSON.parse(readFileSync(join(ROOT, 'game/data/combat/skeleton.json'), 'utf8'));
const hitgeo = JSON.parse(readFileSync(join(ROOT, 'game/data/combat/hitgeometry.json'), 'utf8'));
const clips = JSON.parse(readFileSync(join(ROOT, 'game/data/combat/clips.json'), 'utf8'));

const RES = Number(args.res || 512);
const FAMILY = String(args.family || 'saxhleel');
const OUT = resolve(ROOT, args.out || 'reports/f10-r9-cracks');
const [poseId, phaseRaw] = String(args.pose || 'idle_ready@0').split('@');
const PHASE = Number(phaseRaw ?? 0);
const ANGLE = Number(args.angle ?? 0);
const DIST = Number(args.dist ?? 1.5);

const fam = ['ground', 'water', 'bark', 'leaf', 'reed', 'wall', 'roof', 'plank', 'stone',
  'darkStone', 'skin', 'cloth', 'metal', 'moss', 'chitin', 'wet_chitin', 'bone', 'ember', 'resin'];
const mats = {};
for (const f of fam) { const m = new THREE.MeshStandardMaterial({ color: 0x808080 }); m.userData = { visualFamily: f }; mats[f] = m; }

const rig = new Rig(skel, hitgeo);
rig.rx.fill(0); rig.ry.fill(0); rig.rz.fill(0);
addPose(rig, clips.archetypes[poseId], PHASE, 1);
rig.evaluate([0, 0, 0], 0, 0, 0.1, 1.0);
const group = actorMod.makeRiggedActor(mats, 0x8f9aa6, 0x8d9a72, FAMILY);
actorMod.poseFromRig(group, {
  rig, pos: [0, 0, 0], state: 'IDLE', animFrame: Math.round(PHASE * 60), equipLoadPct: 20,
  move: null, hitboxActive: false, airborne: false, shield: null, twoHanded: false, offhandKind: null,
  moves: { _weapon: { weapon_id: 'test_gsw', class: 'GSW', length_m: 1.45, hitbox_span_m: 1.0, radius_m: 0.05, socket_a: 'wpn_guard', socket_b: 'wpn_tip' } },
});
const { tris, parts } = collectTriangles(THREE, group, skel.bones.map((b) => b.id));

let minx = Infinity, miny = Infinity, minz = Infinity, maxx = -Infinity, maxy = -Infinity, maxz = -Infinity;
for (let i = 0; i < tris.length; i += 3) {
  if (tris[i] < minx) minx = tris[i]; if (tris[i] > maxx) maxx = tris[i];
  if (tris[i + 1] < miny) miny = tris[i + 1]; if (tris[i + 1] > maxy) maxy = tris[i + 1];
  if (tris[i + 2] < minz) minz = tris[i + 2]; if (tris[i + 2] > maxz) maxz = tris[i + 2];
}
const target = new THREE.Vector3((minx + maxx) / 2, (miny + maxy) / 2, (minz + maxz) / 2);

// EXACTLY the camera actor-orbit-holes builds for this (angle, distance). Copied from its own
// frame loop rather than re-derived, because a camera that differs by a degree looks at a
// different pocket and the whole point is to look at the metric's own pixels.
const th = (ANGLE / 360) * Math.PI * 2;
const eye = new THREE.Vector3(target.x + Math.sin(th) * DIST * 0.985, target.y + DIST * 0.17, target.z + Math.cos(th) * DIST * 0.985);
const m = viewProj(THREE, eye, target, 45, 1, Math.max(0.05, DIST * 0.05), DIST * 6).elements;
const { cov, owner, zbuf } = rasterise(tris, parts, { m, half: RES / 2 }, RES);
const holes = findHoles(cov, RES);

// enclosed mask: background not reachable from the border
const enclosed = new Uint8Array(RES * RES);
for (const c of holes.comps) {
  for (let y = Math.max(0, c.cy - c.h); y <= Math.min(RES - 1, c.cy + c.h); y++) {
    for (let x = Math.max(0, c.cx - c.w); x <= Math.min(RES - 1, c.cx + c.w); x++) {
      const o = y * RES + x;
      if (!cov[o] && !holes.borderReachable?.[o]) enclosed[o] = 1;
    }
  }
}
// `findHoles` may not expose the reachable mask; recompute it the same way it does, from the edges.
{
  const seen = new Uint8Array(RES * RES); const q = new Int32Array(RES * RES); let head = 0, tail = 0;
  const push = (o) => { if (!cov[o] && !seen[o]) { seen[o] = 1; q[tail++] = o; } };
  for (let x = 0; x < RES; x++) { push(x); push((RES - 1) * RES + x); }
  for (let y = 0; y < RES; y++) { push(y * RES); push(y * RES + RES - 1); }
  while (head < tail) {
    const o = q[head++], x = o % RES, y = (o - x) / RES;
    if (x > 0) push(o - 1); if (x < RES - 1) push(o + 1);
    if (y > 0) push(o - RES); if (y < RES - 1) push(o + RES);
  }
  for (let o = 0; o < cov.length; o++) enclosed[o] = (!cov[o] && !seen[o]) ? 1 : 0;
}

let zlo = Infinity, zhi = -Infinity;
for (let o = 0; o < cov.length; o++) if (cov[o] && zbuf[o] < Infinity) { if (zbuf[o] < zlo) zlo = zbuf[o]; if (zbuf[o] > zhi) zhi = zbuf[o]; }
const rgb = Buffer.alloc(RES * RES * 3);
let enclosedPx = 0;
for (let o = 0; o < cov.length; o++) {
  let r = 12, g = 14, b = 20;                                   // background
  if (cov[o]) { const t = zhi > zlo ? 1 - (zbuf[o] - zlo) / (zhi - zlo) : 0.5; const v = 55 + Math.round(150 * t); r = v; g = v; b = Math.round(v * 1.05); }
  if (enclosed[o]) { r = 255; g = 40; b = 40; enclosedPx++; }
  rgb[o * 3] = r; rgb[o * 3 + 1] = g; rgb[o * 3 + 2] = b;
}
const name = `${poseId}@${PHASE}__a${ANGLE}__d${DIST}`.replace(/[^A-Za-z0-9@._-]/g, '_');
writePng(join(OUT, `${name}.png`), RES, RES, rgb);
console.log(JSON.stringify({
  tool: 'f10-r9-crack-frames.mjs', pose: `${poseId}@${PHASE}`, angle: ANGLE, dist: DIST, res: RES, family: FAMILY,
  bodyPx: holes.bodyPx, enclosedPx, pockets: holes.comps.length,
  png: join(OUT, `${name}.png`).replace(`${ROOT}/`, ''),
}, null, 2));
