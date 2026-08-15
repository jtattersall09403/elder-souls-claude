#!/usr/bin/env node
/**
 * f10-r9c-idle-motion.mjs — OUR IDLE, IN MOTION, as a contact sheet.
 *
 * `CLAUDE.md`'s character directive, verbatim: *"critics must [look at motion captures] as well…
 * **stills are not enough**"*. Round 9's whole change is a STANCE, and a stance is a motion
 * property: `RI-VIS10` C3's second arm is *"and the two frames differ"*. Everything the round
 * published about it — and everything the paid hardware pair could show — is a still.
 *
 * So this walks the 96-frame idle the game actually plays and rasterises the silhouette at even
 * intervals, both arms, side by side, so the loop can be READ rather than described. It applies the
 * SAME two layers `game/src/combat/actor.js:366-374` applies (`LoopClip(idle_loop,96).applyPose`
 * then `addPose(idle_ready,0,1)`), through the real `makeRiggedActor` -> `poseFromRig` path.
 *
 * IT IS A SHAPE INSTRUMENT AND NOTHING ELSE. `W1-30-EVIDENCE` §4 bars an offline rasteriser from
 * every APPEARANCE claim, and none is made here: no colour, no material, no light. The output is a
 * binary silhouette. Appearance for this round lives in the paid RTX A5000 frames.
 *
 * Usage: node tools/visual/f10-r9c-idle-motion.mjs --out <dir> [--res 384] [--angle 0] [--frames 8]
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { collectTriangles, rasterise, viewProj } from './actor-orbit-holes.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../..');
const args = {};
for (const a of process.argv.slice(2)) { const [k, v] = a.replace(/^--/, '').split('='); args[k] = v === undefined ? true : v; }
const RES = Number(args.res || 384);
const NF = Number(args.frames || 8);
const ANGLE = Number(args.angle ?? 0);
const OUT = resolve(ROOT, args.out || 'reports/f10-r9c-idle-motion');
mkdirSync(OUT, { recursive: true });

const THREE = await import(pathToFileURL(join(ROOT, 'game/vendor/three/three.module.js')).href);
const actorMod = await import(pathToFileURL(join(ROOT, 'game/src/render/actor.js')).href);
const { Rig } = await import(pathToFileURL(join(ROOT, 'game/src/combat/skeleton.js')).href);
const { addPose, LoopClip } = await import(pathToFileURL(join(ROOT, 'game/src/combat/clips.js')).href);
const skel = JSON.parse(readFileSync(join(ROOT, 'game/data/combat/skeleton.json'), 'utf8'));
const hitgeo = JSON.parse(readFileSync(join(ROOT, 'game/data/combat/hitgeometry.json'), 'utf8'));
const CLIPS = {
  after: JSON.parse(readFileSync(join(ROOT, 'game/data/combat/clips.json'), 'utf8')),
  before: JSON.parse(readFileSync(join(ROOT, 'tools/visual/f10-r9c-baseline-clips.json.txt'), 'utf8')),
};
const mats = {};
for (const f of ['ground', 'water', 'bark', 'leaf', 'reed', 'wall', 'roof', 'plank', 'stone', 'darkStone',
  'skin', 'cloth', 'metal', 'moss', 'chitin', 'wet_chitin', 'bone', 'ember', 'resin']) {
  const m = new THREE.MeshStandardMaterial({ color: 0x808080 }); m.userData = { visualFamily: f }; mats[f] = m;
}

function shoot(clips, frame) {
  const rig = new Rig(skel, hitgeo);
  const loop = new LoopClip('idle', clips.archetypes.idle_loop, 96);
  loop.applyPose(rig, frame);
  addPose(rig, clips.archetypes.idle_ready, 0, 1.0);
  rig.evaluate([0, 0, 0], 0, loop.rootOffsetYAt(frame), 0.1, 1.0);
  const g = actorMod.makeRiggedActor(mats, 0x8f9aa6, 0x8d9a72, 'saxhleel');
  g.name = 'player';
  actorMod.poseFromRig(g, { rig, pos: [0, 0, 0], state: 'IDLE', animFrame: frame, equipLoadPct: 20, move: null, hitboxActive: false, airborne: false, shield: null, twoHanded: false, offhandKind: null, moves: { _weapon: null } });
  const { tris, parts } = collectTriangles(THREE, g, skel.bones.map((b) => b.id));
  // The camera convention is copied from `actor-orbit-holes.mjs`'s own frame loop (via
  // `f10-r9-crack-frames.mjs:161-165`) rather than re-derived: `viewProj` returns a Matrix4 and
  // `rasterise` wants `{ m: elements, half }`, and a camera that differs by a degree is a
  // different silhouette.
  const th = (ANGLE / 360) * Math.PI * 2;
  const d = 2.6;
  const target = new THREE.Vector3(0, 0.95, 0);
  const eye = new THREE.Vector3(target.x + Math.sin(th) * d * 0.985, target.y + d * 0.17, target.z + Math.cos(th) * d * 0.985);
  const m = viewProj(THREE, eye, target, 45, 1, Math.max(0.05, d * 0.05), d * 6).elements;
  const { cov } = rasterise(tris, parts, { m, half: RES / 2 }, RES);
  return cov;
}

// Two silhouettes, one row per sampled frame, BEFORE above AFTER — a strip a reader scans.
const rows = [];
const px = [];
for (let i = 0; i < NF; i++) {
  const frame = Math.round(i * 96 / NF);
  const b = shoot(CLIPS.before, frame);
  const a = shoot(CLIPS.after, frame);
  let bn = 0, an = 0, diff = 0;
  for (let k = 0; k < b.length; k++) { if (b[k]) bn++; if (a[k]) an++; if (!!a[k] !== !!b[k]) diff++; }
  const inter = (() => { let n = 0; for (let k = 0; k < b.length; k++) if (b[k] && a[k]) n++; return n; })();
  const union = bn + an - inter;
  rows.push({ frame, before_px: bn, after_px: an, changed_px: diff, iou: +(inter / union).toFixed(4) });
  px.push({ frame, b, a });
}

// PPM -> PNG via the same trick the repo's other rasterisers use: write a raw RGB PPM and let the
// reader convert. Here it is written straight as a PNG through a minimal encoder-free path: a
// grayscale PGM is universally readable and needs no dependency.
const W = RES * NF, H = RES * 2;
const buf = Buffer.alloc(W * H, 0);
for (let i = 0; i < px.length; i++) {
  for (let y = 0; y < RES; y++) for (let x = 0; x < RES; x++) {
    buf[y * W + i * RES + x] = px[i].b[y * RES + x] ? 235 : 25;
    buf[(RES + y) * W + i * RES + x] = px[i].a[y * RES + x] ? 235 : 25;
  }
}
writeFileSync(join(OUT, `idle-motion-strip-a${ANGLE}.pgm`), Buffer.concat([Buffer.from(`P5\n${W} ${H}\n255\n`), buf]));
const out = {
  tool: 'f10-r9c-idle-motion.mjs', generated: new Date().toISOString(),
  what: 'the 96-frame idle the game plays, sampled at even intervals, BEFORE (top row) vs AFTER (bottom row)',
  claim_class: 'SHAPE ONLY — offline rasteriser, no appearance claim (W1-30-EVIDENCE §4)',
  angle_deg: ANGLE, res: RES, samples: NF,
  per_frame: rows,
  loop_range: {
    before_silhouette_iou_across_the_loop: null, note: 'per-frame IoU below is BEFORE-vs-AFTER at the same frame',
  },
};
// How much does OUR OWN silhouette change ACROSS the loop? That is the "is the stand alive"
// question, and it is answered separately per arm against that arm's own frame 0.
for (const arm of ['b', 'a']) {
  const base = px[0][arm];
  const ious = px.map((p) => { let inter = 0, uni = 0; for (let k = 0; k < base.length; k++) { const x = !!base[k], y = !!p[arm][k]; if (x && y) inter++; if (x || y) uni++; } return +(inter / uni).toFixed(4); });
  out.loop_range[arm === 'b' ? 'before_self_iou_vs_frame0' : 'after_self_iou_vs_frame0'] = ious;
  out.loop_range[arm === 'b' ? 'before_min_self_iou' : 'after_min_self_iou'] = Math.min(...ious);
}
writeFileSync(join(OUT, `idle-motion-a${ANGLE}.json`), `${JSON.stringify(out, null, 2)}\n`);
console.log(JSON.stringify(out, null, 2));
