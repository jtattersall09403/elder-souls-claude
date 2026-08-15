#!/usr/bin/env node
/**
 * f10-silhouette.mjs — the pixel numbers behind RI-VIS10 §C1/§C2 and RI-VIS08 §B1.
 *
 * WHY OFFLINE AND NOT FROM THE GAME FRAME. RI-VIS10 C1 says "Publish both pixel numbers, so a
 * second critic reproduces R rather than re-eyeballing it", and C2 wants pairwise IoU of binary
 * masks. Both need the character segmented from its background. An in-game frame has a whole
 * world behind the figure and no ID buffer is exposed, so segmenting one is a guess. This tool
 * rasterises the SHIPPED actor and NOTHING ELSE, through the same `collectTriangles` /
 * `rasterise` pair `actor-orbit-holes.mjs` uses — and, because that rasteriser records which
 * triangle owns each pixel, the HEAD's pixels can be separated from the body's by the part
 * label the actor module itself writes (`actor-body:<family>:skin/head`).
 *
 * WHAT IT DOES NOT LICENCE. Nothing about colour, material, light or texture. Those are
 * appearance claims and must come from a hardware frame (W1-30-EVIDENCE §4). This tool reads
 * vertices; every number it prints is a shape number.
 *
 * WHICH INPUT DOES EVERY ARM FABRICATE? (HAZARDS §0.)
 *   1. THE POSE. Not fabricated: `clips.json`'s own `idle` archetype at phase 0, through the
 *      same `addPose` the game uses. If the shipped idle is a mannequin, that is what is drawn.
 *   2. THE MATERIALS. Plain stand-ins, as in actor-orbit-holes.mjs, and no material claim is
 *      made from this tool.
 *   3. THE CAMERA. Orthographic-equivalent framing at a fixed figure height, so `R = H/h` is
 *      free of perspective foreshortening — a perspective camera would make R depend on the
 *      distance the critic happened to choose, which is exactly the kind of number that cannot
 *      be reproduced.
 *
 * Usage:
 *   node tools/visual/f10-silhouette.mjs --res=1024 --json=out.json
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { collectTriangles, rasterise } from './actor-orbit-holes.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const R = resolve(HERE, '../..');
const opts = { res: 1024, json: null, mask: 120, pose: 'idle', phase: 0 };
for (const a of process.argv.slice(2)) {
  const [k, v] = a.replace(/^--/, '').split('=');
  if (k === 'res') opts.res = Number(v);
  else if (k === 'json') opts.json = resolve(v);
  else if (k === 'mask') opts.mask = Number(v);
  else if (k === 'pose') opts.pose = v;
  else if (k === 'phase') opts.phase = Number(v);
}

const THREE = await import(pathToFileURL(join(R, 'game/vendor/three/three.module.js')).href);
const actorMod = await import(pathToFileURL(join(R, 'game/src/render/actor.js')).href);
const { Rig } = await import(pathToFileURL(join(R, 'game/src/combat/skeleton.js')).href);
const { addPose } = await import(pathToFileURL(join(R, 'game/src/combat/clips.js')).href);
const skel = JSON.parse(readFileSync(join(R, 'game/data/combat/skeleton.json'), 'utf8'));
const hitgeo = JSON.parse(readFileSync(join(R, 'game/data/combat/hitgeometry.json'), 'utf8'));
const clips = JSON.parse(readFileSync(join(R, 'game/data/combat/clips.json'), 'utf8'));

const fam = ['ground', 'water', 'bark', 'leaf', 'reed', 'wall', 'roof', 'plank', 'stone',
  'darkStone', 'skin', 'cloth', 'metal', 'moss', 'chitin', 'wet_chitin', 'bone', 'ember', 'resin'];
const mats = {};
for (const f of fam) { const m = new THREE.MeshStandardMaterial({ color: 0x808080 }); m.userData = { visualFamily: f }; mats[f] = m; }

/** Orthographic view-projection looking along -Z after a yaw, framing a given world box. */
function orthoVP(centre, halfW, halfH, yawDeg) {
  const yaw = yawDeg * Math.PI / 180;
  const eye = new THREE.Vector3(centre.x + Math.sin(yaw) * 50, centre.y, centre.z + Math.cos(yaw) * 50);
  const view = new THREE.Matrix4().lookAt(eye, centre, new THREE.Vector3(0, 1, 0));
  view.setPosition(eye);
  const inv = new THREE.Matrix4().copy(view).invert();
  const proj = new THREE.Matrix4().makeOrthographic(-halfW, halfW, halfH, -halfH, 0.1, 200, THREE.WebGLCoordinateSystem);
  return new THREE.Matrix4().multiplyMatrices(proj, inv);
}

/**
 * THE ROSTER IS THE SHIPPED ROSTER, not a registry listing. `actor.js` selects a character
 * variant by hashing `group.name`, which `renderer.js` writes as `npc:<eid>`, and it picks the
 * art family from the NPC's `race`. Both are reproduced here from the shipped data files, so
 * what this tool rasterises is the set of bodies the game actually puts in the world — a
 * registry walk would measure what COULD be built, which is the distinction that lets a
 * variant registry read green while every townsman on screen is the same man.
 */
const npcFiles = (await import('node:fs')).readdirSync(join(R, 'game/data/npcs')).filter((f) => f.endsWith('.json'));
const roster = [];
for (const f of npcFiles) {
  const d = JSON.parse(readFileSync(join(R, 'game/data/npcs', f), 'utf8'));
  const items = Array.isArray(d) ? d : (d.npcs || d.records || []);
  for (const n of items) roster.push({ eid: n.eid || n.id, race: n.race, actor: n.actor, name: n.name });
}
// THE PREDICATE IS IMPORTED, NOT MIRRORED. This line used to be a hand-copy of renderer.js:693
// annotated "verbatim" — a mirror that no check could keep honest, and precisely the shape of
// defect this project keeps paying for. `renderer.js` and this tool now call the same function, so
// a future edit to the routing cannot leave the instrument measuring the old world.
const { artFamilyForRace } = await import(pathToFileURL(join(R, 'game/src/render/lib/race-art.js')).href);
const familyOf = (race) => artFamilyForRace(race);
const SAMPLE = Number(process.env.F10_SAMPLE || 40);
const step = Math.max(1, Math.floor(roster.length / SAMPLE));
const sample = [{ eid: 'player', race: 'saxhleel', actor: 'player', name: 'player' },
  ...roster.filter((_, i) => i % step === 0).slice(0, SAMPLE)];

const results = [];
const masks = new Map();

{
  for (const person of sample) {
    const family = familyOf(person.race);
    const characterId = `${person.race}/${person.actor}`;
    const group = actorMod.makeRiggedActor(mats, 0x8f9aa6, 0x8d9a72, family);
    group.name = person.eid === 'player' ? 'player' : `npc:${person.eid}`;
    const rig = new Rig(skel, hitgeo);
    rig.rx.fill(0); rig.ry.fill(0); rig.rz.fill(0);
    const arch = clips.archetypes[opts.pose] || Object.values(clips.archetypes)[0];
    addPose(rig, arch, opts.phase, 1);
    rig.evaluate([0, 0, 0], 0, 0, 0.1, 1.0);
    const body = {
      rig, pos: [0, 0, 0], state: 'IDLE', animFrame: 0, equipLoadPct: 20, move: null,
      hitboxActive: false, airborne: false, shield: null, twoHanded: false, offhandKind: null,
      moves: { _weapon: null },
    };
    actorMod.poseFromRig(group, body);
    const { tris, parts } = collectTriangles(THREE, group, skel.bones.map((b) => b.id));
    if (!tris.length) { results.push({ family, characterId, error: 'no triangles' }); continue; }

    // World bounds of the BODY only — weapons and props are excluded from the canon of
    // proportion, because a sword held overhead is not part of the figure's height.
    let minY = Infinity, maxY = -Infinity, minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (let t = 0, tri = 0; t < tris.length; t += 9, tri++) {
      if (!/actor-body|actor-equipment/.test(parts[tri])) continue;
      for (let k = 0; k < 9; k += 3) {
        if (tris[t + k] < minX) minX = tris[t + k]; if (tris[t + k] > maxX) maxX = tris[t + k];
        if (tris[t + k + 1] < minY) minY = tris[t + k + 1]; if (tris[t + k + 1] > maxY) maxY = tris[t + k + 1];
        if (tris[t + k + 2] < minZ) minZ = tris[t + k + 2]; if (tris[t + k + 2] > maxZ) maxZ = tris[t + k + 2];
      }
    }
    const worldH = maxY - minY;
    const centre = new THREE.Vector3((minX + maxX) / 2, (minY + maxY) / 2, (minZ + maxZ) / 2);

    const perAngle = {};
    for (const yawDeg of [0, 90]) {
      const halfH = worldH * 0.55;
      const halfW = halfH;                       // square frame, so IoU is over comparable masks
      const m = orthoVP(centre, halfW, halfH, yawDeg).elements;
      const { cov, owner } = rasterise(tris, parts, { m, half: opts.res / 2 }, opts.res);

      // Figure extent and HEAD extent, in pixels, from the part labels the actor module writes.
      let top = Infinity, bot = -Infinity, left = Infinity, right = -Infinity, area = 0;
      let headTop = Infinity, headBot = -Infinity, headPx = 0;
      for (let y = 0; y < opts.res; y++) {
        for (let x = 0; x < opts.res; x++) {
          const i = y * opts.res + x;
          if (!cov[i]) continue;
          const label = parts[owner[i]] || '';
          if (!/actor-body|actor-equipment/.test(label)) continue;
          area++;
          if (y < top) top = y; if (y > bot) bot = y;
          if (x < left) left = x; if (x > right) right = x;
          if (/\/head$|\/jaw$|\/crest|\/horn|\/snout/.test(label)) {
            headPx++;
            if (y < headTop) headTop = y; if (y > headBot) headBot = y;
          }
        }
      }
      const H = bot - top + 1;
      const h = headPx ? (headBot - headTop + 1) : null;
      perAngle[yawDeg] = {
        figure_height_px: H, figure_width_px: right - left + 1, silhouette_area_px: area,
        head_height_px: h, head_px: headPx,
        R_head_counts: h ? +(H / h).toFixed(2) : null,
        shoulder_to_hip_width_ratio: null,
      };

      // A downsampled binary mask at the item's stated 120 px figure height, for pairwise IoU.
      if (yawDeg === 0 || yawDeg === 90) {
        const S = opts.mask;
        const mask = new Uint8Array(S * S);
        const scale = H > 0 ? (S * 0.92) / H : 1;
        for (let y = 0; y < opts.res; y++) {
          for (let x = 0; x < opts.res; x++) {
            const i = y * opts.res + x;
            if (!cov[i]) continue;
            const label = parts[owner[i]] || '';
            if (!/actor-body|actor-equipment/.test(label)) continue;
            const my = Math.round((y - top) * scale + S * 0.04);
            const mx = Math.round((x - (left + right) / 2) * scale + S / 2);
            if (my >= 0 && my < S && mx >= 0 && mx < S) mask[my * S + mx] = 1;
          }
        }
        masks.set(`${family}|${characterId}|${yawDeg}`, mask);
      }
    }
    results.push({ family, characterId, world_height_m: +worldH.toFixed(3), angles: perAngle });
  }
}

// Pairwise IoU across the roster, per angle, per RI-VIS10 C2.
function iou(a, b) {
  let inter = 0, uni = 0;
  for (let i = 0; i < a.length; i++) { const x = a[i], y = b[i]; if (x || y) uni++; if (x && y) inter++; }
  return uni ? inter / uni : 0;
}
const pairs = [];
for (const yawDeg of [0, 90]) {
  const keys = [...masks.keys()].filter((k) => k.endsWith(`|${yawDeg}`));
  for (let i = 0; i < keys.length; i++) {
    for (let j = i + 1; j < keys.length; j++) {
      pairs.push({ yaw: yawDeg, a: keys[i].split('|').slice(0, 2).join('/'), b: keys[j].split('|').slice(0, 2).join('/'), iou: +iou(masks.get(keys[i]), masks.get(keys[j])).toFixed(4) });
    }
  }
}
pairs.sort((x, y) => y.iou - x.iou);
const ious = pairs.map((p) => p.iou).sort((a, b) => a - b);
const median = ious.length ? ious[Math.floor(ious.length / 2)] : null;

const out = {
  tool: 'f10-silhouette', res: opts.res, mask_px: opts.mask, pose: `${opts.pose}@${opts.phase}`,
  note: 'shape numbers only — no colour, material or light claim may be made from this tool',
  roster: results,
  c2: { pairs_n: pairs.length, median_iou: median, max_iou: pairs.length ? pairs[0].iou : null, worst_pairs: pairs.slice(0, 12) },
};
if (opts.json) writeFileSync(opts.json, `${JSON.stringify(out, null, 2)}\n`);
for (const r of results) {
  if (r.error) { console.log(`${r.family}/${r.characterId}: ${r.error}`); continue; }
  const f = r.angles[0];
  console.log(`${String(r.characterId || r.family).padEnd(26)} H=${String(f.figure_height_px).padStart(4)}px  head=${String(f.head_height_px).padStart(4)}px  R=${f.R_head_counts}  worldH=${r.world_height_m}m`);
}
console.log(`\nC2 pairwise IoU over ${pairs.length} pairs: median ${median}, max ${pairs.length ? pairs[0].iou : 'n/a'}`);
if (pairs.length) for (const p of pairs.slice(0, 5)) console.log(`   ${p.iou}  ${p.a}  vs  ${p.b}  (yaw ${p.yaw})`);
