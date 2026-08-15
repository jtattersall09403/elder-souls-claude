#!/usr/bin/env node
/**
 * f10-r6-visible-surface.mjs — of the geometry we built, WHICH PART DOES A CAMERA ACTUALLY SEE.
 *
 * WHY THIS EXISTS. `orchestration/status/W1-F10-r5-appearance.json` is a hardware A/B of the whole
 * character across two arms on one GPU. Its cleanest number is a NEGATIVE one: on the player's foot
 * close-ups, **not one pixel differs** between an arm built at `b175da8e` and an arm built at HEAD —
 * 3 of 3 static foot frames and 7 of 8 walking foot frames byte-identical — even though round 4
 * replaced the foot geometry outright (a 6.2 cm tube running 15.5 cm forward became a flat sole, a
 * heel, a ball and three clawed toes). Two versions of a mesh that differ cannot render identically
 * unless the camera never sees either of them.
 *
 * `character-digit-read.mjs` says the foot is FINE — `--part=foot` returns lobes 3 and a separated
 * fraction of 0.24-0.29 against its 0.18 gate on 8 of 8 subjects, run this turn. Both statements are
 * true, and the gap between them is this instrument's whole reason to exist: **that tool selects
 * triangles by dominant skin weight**, so it measures the foot bone's own triangles in isolation and
 * cannot see the calf that sits on top of them. It answers "is a foot shaped like a foot". It cannot
 * answer "can you see a foot", and only the second question is the one the player asks.
 *
 * WHAT IT MEASURES. The whole actor — every body surface, every equipment piece, every family form —
 * rasterised orthographically with a z-buffer from arbitrary bearings, and **every frontmost pixel
 * labelled with the part that owns it**. Skinned triangles are labelled `<surface>@<dominant bone>`;
 * rigid pieces carry their own mesh name (`actor-family-form:humanoid:eye-l@head`). So the output is
 * a census: of the pixels in a foot close-up, how many are `skin@foot_l` and how many are
 * `cloth@calf_l`. Zero of the former is the defect, stated as a number.
 *
 * IT ALSO REPORTS DEPTH RELIEF, because a face can be visible and still not read. The landmarks in
 * the humanoid head are all merged into one skinned surface, so a name census cannot separate a brow
 * from a skull. What can is the depth map: `relief_mm` is the peak-to-trough range of the visible
 * depth inside the crop, and `relief_p90_mm` the 90th percentile of the per-pixel depth gradient. A
 * sphere scores near zero on the second; a face does not.
 *
 * REST POSE, DELIBERATELY. The skinned surfaces are authored in world space and bound with an
 * identity bind matrix (see `actor.js`'s header), so `geometry.attributes.position` IS the rest-pose
 * world position and needs no skinning transform. Rigid pieces are composed as `restWorld[bi] *
 * item.local`, which is exactly what the render path does. This measures the built character, not a
 * pose, which is the right frame for "is it buried".
 *
 * MAKE IT FAIL ON PURPOSE (RULES.md 4):
 *   node tools/visual/f10-r6-visible-surface.mjs --self-test
 * builds a small sphere inside a big one, asserts the small one is worth ZERO visible pixels, then
 * moves it out past the big one's surface and asserts it is worth thousands. The two arms are
 * required to disagree; if they do not, this instrument cannot see burial and says so.
 *
 * OWNERSHIP. `node tools/ownership.mjs --for tools/visual/f10-r6-visible-surface.mjs` returns one
 * live piece, W1-30V, holding a CLAIMED hold on `tools/visual/` as a directory. This is a NEW file;
 * no file W1-30V has touched is edited by this piece, which is the precedent rounds 3, 4 and 5 all
 * followed.
 *
 * Usage:
 *   node tools/visual/f10-r6-visible-surface.mjs --part=foot --family=saxhleel
 *   node tools/visual/f10-r6-visible-surface.mjs --part=face --family=humanoid --json=out.json
 *   node tools/visual/f10-r6-visible-surface.mjs --part=face --family=saxhleel --equipped
 *   node tools/visual/f10-r6-visible-surface.mjs --self-test
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const R = resolve(HERE, '../..');
const THREE = await import(pathToFileURL(join(R, 'game/vendor/three/three.module.js')).href);

const opts = { part: 'foot', family: 'saxhleel', equipped: false, json: null, selfTest: false,
  res: 384, bearings: [0, 45, 90, 135, 180, 225, 270, 315], elev: 12, posed: false, ground: null, png: null, half: null, target: null, subject: null, character: null, shade: false, clip: 'idle_loop', phase: 0 };
for (const a of process.argv.slice(2)) {
  const [k, v] = a.replace(/^--/, '').split('=');
  if (k === 'posed') opts.posed = true;
  else if (k === 'ground') { opts.posed = true; opts.ground = Number(v); }
  else if (k === 'part') opts.part = v;
  else if (k === 'family') opts.family = v;
  else if (k === 'equipped') opts.equipped = true;
  else if (k === 'json') opts.json = resolve(v);
  else if (k === 'self-test') opts.selfTest = true;
  else if (k === 'res') opts.res = Number(v);
  else if (k === 'elev') opts.elev = Number(v);
  else if (k === 'bearings') opts.bearings = v.split(',').map(Number);
  else if (k === 'png') opts.png = resolve(v);
  else if (k === 'half') opts.half = Number(v);
  else if (k === 'subject') opts.subject = v;
  else if (k === 'character') opts.character = v;
  else if (k === 'shade') opts.shade = true;
  else if (k === 'clip') opts.clip = v;
  else if (k === 'phase') opts.phase = Number(v);
  else if (k === 'target') opts.target = v.split(',').map(Number);
}

// ---------------------------------------------------------------------------------------
// The rasteriser. Input: tagged world-space triangles + a camera. Output: an owner id and a
// depth per pixel. Nothing in here knows about actors, so the self-test drives it directly.
// ---------------------------------------------------------------------------------------

/**
 * @param tris   [{owner:string, v:[x,y,z, x,y,z, x,y,z]}]
 * @param cam    {target:[x,y,z], az:deg, elev:deg, half:metres, res:px}
 */
function rasterise(tris, cam) {
  const N = cam.res;
  const az = (cam.az * Math.PI) / 180, el = (cam.elev * Math.PI) / 180;
  // Camera direction: az 0 looks from +Z toward -Z (the character's front, since +Z is the
  // character's front per actor.js's garment pass), increasing az swings anticlockwise about +Y.
  const dir = new THREE.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el));
  const fwd = dir.clone().negate();                      // view direction, camera -> subject
  const upW = new THREE.Vector3(0, 1, 0);
  const right = new THREE.Vector3().crossVectors(upW, fwd).normalize();
  if (!Number.isFinite(right.x)) right.set(1, 0, 0);
  const up = new THREE.Vector3().crossVectors(fwd, right).normalize();
  const T = new THREE.Vector3(...cam.target);

  const depth = new Float64Array(N * N).fill(Infinity);
  const owner = new Int32Array(N * N).fill(-1);
  const tri = new Int32Array(N * N).fill(-1);
  // Interpolated SMOOTH normal per pixel. Flat per-triangle normals were the first version and
  // they made every 7-segment landmark tube read as a hard-edged cable, because a cylinder's
  // facets are exactly what smooth normals exist to hide. The game ships smooth normals, so a
  // preview shaded flat systematically over-reports how lumpy a face is — and it was about to make
  // this round tune a set of landmarks against a defect in its own instrument.
  const nrmBuf = new Float32Array(N * N * 3);
  const names = [];
  const nameIx = new Map();
  const idOf = (s) => { let i = nameIx.get(s); if (i === undefined) { i = names.length; names.push(s); nameIx.set(s, i); } return i; };

  const p = new THREE.Vector3();
  const proj = (x, y, z) => {
    p.set(x - T.x, y - T.y, z - T.z);
    return [(p.dot(right) / cam.half) * 0.5 * N + N / 2,
      N / 2 - (p.dot(up) / cam.half) * 0.5 * N,
      p.dot(fwd)];
  };

  for (let ti = 0; ti < tris.length; ti++) {
    const t = tris[ti];
    const oid = idOf(t.owner);
    const a = proj(t.v[0], t.v[1], t.v[2]);
    const b = proj(t.v[3], t.v[4], t.v[5]);
    const c = proj(t.v[6], t.v[7], t.v[8]);
    const minX = Math.max(0, Math.floor(Math.min(a[0], b[0], c[0])));
    const maxX = Math.min(N - 1, Math.ceil(Math.max(a[0], b[0], c[0])));
    const minY = Math.max(0, Math.floor(Math.min(a[1], b[1], c[1])));
    const maxY = Math.min(N - 1, Math.ceil(Math.max(a[1], b[1], c[1])));
    if (minX > maxX || minY > maxY) continue;
    const d = (b[0] - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (b[1] - a[1]);
    if (Math.abs(d) < 1e-12) continue;
    for (let py = minY; py <= maxY; py++) {
      for (let px = minX; px <= maxX; px++) {
        const x = px + 0.5, y = py + 0.5;
        const w0 = ((b[0] - a[0]) * (y - a[1]) - (x - a[0]) * (b[1] - a[1])) / d;
        const w1 = ((x - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (y - a[1])) / d;
        if (w0 < 0 || w1 < 0 || w0 + w1 > 1) continue;
        const z = a[2] + w1 * (b[2] - a[2]) + w0 * (c[2] - a[2]);
        const k = py * N + px;
        if (z < depth[k]) {
          depth[k] = z; owner[k] = oid; tri[k] = ti;
          if (t.n) {
            const w2 = 1 - w0 - w1;
            for (let c = 0; c < 3; c++) nrmBuf[k * 3 + c] = t.n[c] * w2 + t.n[3 + c] * w1 + t.n[6 + c] * w0;
          } else nrmBuf[k * 3] = nrmBuf[k * 3 + 1] = nrmBuf[k * 3 + 2] = 0;
        }
      }
    }
  }
  return { depth, owner, tri, nrmBuf, names, N, view: { right, up, fwd } };
}

/** Per-owner visible pixel census + depth relief, over the whole raster. */
function census(r) {
  const counts = new Map();
  let covered = 0;
  let dMin = Infinity, dMax = -Infinity;
  for (let k = 0; k < r.owner.length; k++) {
    if (r.owner[k] < 0) continue;
    covered++;
    const n = r.names[r.owner[k]];
    counts.set(n, (counts.get(n) || 0) + 1);
    if (r.depth[k] < dMin) dMin = r.depth[k];
    if (r.depth[k] > dMax) dMax = r.depth[k];
  }
  // Local depth gradient, in mm per pixel, over covered pixels with a covered right/down neighbour.
  const grads = [];
  for (let y = 0; y + 1 < r.N; y++) {
    for (let x = 0; x + 1 < r.N; x++) {
      const k = y * r.N + x;
      if (r.owner[k] < 0 || r.owner[k + 1] < 0 || r.owner[k + r.N] < 0) continue;
      const gx = r.depth[k + 1] - r.depth[k], gy = r.depth[k + r.N] - r.depth[k];
      grads.push(Math.hypot(gx, gy) * 1000);
    }
  }
  grads.sort((a, b) => a - b);
  const q = (f) => (grads.length ? grads[Math.min(grads.length - 1, Math.floor(f * grads.length))] : 0);
  return {
    covered_px: covered,
    relief_mm: covered ? Number(((dMax - dMin) * 1000).toFixed(2)) : 0,
    relief_p90_mm_per_px: Number(q(0.9).toFixed(4)),
    relief_p99_mm_per_px: Number(q(0.99).toFixed(4)),
    owners: [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([name, px]) => ({ name, px })),
  };
}

// ---------------------------------------------------------------------------------------
// SELF-TEST — the arms are required to disagree.
// ---------------------------------------------------------------------------------------
function sphereTris(owner, cx, cy, cz, rad, seg = 24) {
  const g = new THREE.SphereGeometry(rad, seg, seg / 2);
  const pos = g.attributes.position, idx = g.index, out = [];
  for (let i = 0; i < idx.count; i += 3) {
    const v = [];
    for (const j of [0, 1, 2]) {
      const ii = idx.getX(i + j);
      v.push(pos.getX(ii) + cx, pos.getY(ii) + cy, pos.getZ(ii) + cz);
    }
    out.push({ owner, v });
  }
  return out;
}
if (opts.selfTest) {
  const cam = { target: [0, 0, 0], az: 0, elev: 0, half: 0.2, res: 256 };
  const skull = sphereTris('skull', 0, 0, 0, 0.10);
  // The skull surface directly in front of the eye sits at z = 0.098 (0.10 * sqrt(1 - (0.02/0.10)^2)).
  // The first fixture put the eye's front at exactly 0.100 and the instrument correctly reported 122
  // visible pixels — the fixture, not the tool, was wrong, and it is kept as a comment because it is
  // the same 2 mm margin the shipped humanoid pupil lives on.
  const buriedEye = sphereTris('eye', 0, 0.02, 0.070, 0.015);   // front at 0.085, wholly inside
  const freeEye = sphereTris('eye', 0, 0.02, 0.100, 0.015);     // front at 0.115, breaks the surface
  const A = census(rasterise([...skull, ...buriedEye], cam));
  const B = census(rasterise([...skull, ...freeEye], cam));
  const pxA = (A.owners.find((o) => o.name === 'eye') || { px: 0 }).px;
  const pxB = (B.owners.find((o) => o.name === 'eye') || { px: 0 }).px;
  console.log(`self-test  eye 15 mm inside a 100 mm skull : visible eye pixels = ${pxA}  (relief ${A.relief_mm} mm)`);
  console.log(`self-test  same eye moved 23 mm outward     : visible eye pixels = ${pxB}  (relief ${B.relief_mm} mm)`);
  const ok = pxA === 0 && pxB > 150;
  console.log(`self-test  the buried arm ${ok ? 'GOES RED (0 px) while the free arm does not — burial is detectable' : 'DOES NOT BEHAVE AS REQUIRED'}`);
  if (!ok) { console.error('self-test FAILED: this instrument cannot tell a buried part from a visible one.'); process.exit(1); }
  console.log('self-test passed.');
  process.exit(0);
}

// ---------------------------------------------------------------------------------------
// The actor.
// ---------------------------------------------------------------------------------------
const fam = ['ground', 'water', 'bark', 'leaf', 'reed', 'wall', 'roof', 'plank', 'stone',
  'darkStone', 'skin', 'cloth', 'metal', 'moss', 'chitin', 'wet_chitin', 'bone', 'ember', 'resin'];
const mats = {};
for (const f of fam) { const m = new THREE.MeshStandardMaterial({ color: 0x808080 }); m.userData = { visualFamily: f }; mats[f] = m; }

const actorMod = await import(pathToFileURL(join(R, 'game/src/render/actor.js')).href);
const { Rig } = await import(pathToFileURL(join(R, 'game/src/combat/skeleton.js')).href);
const { addPose } = await import(pathToFileURL(join(R, 'game/src/combat/clips.js')).href);
const skel = JSON.parse(readFileSync(join(R, 'game/data/combat/skeleton.json'), 'utf8'));
const hitgeo = JSON.parse(readFileSync(join(R, 'game/data/combat/hitgeometry.json'), 'utf8'));
const clips = JSON.parse(readFileSync(join(R, 'game/data/combat/clips.json'), 'utf8'));

const group = actorMod.makeRiggedActor(mats, 0x8f9aa6, 0x8d9a72, opts.family);
// THE VARIANT IS RESOLVED FROM `group.name` AND NOTHING ELSE. `characterFor()` (actor.js:1867)
// hashes the group name into the family's character pool, with `player` special-cased to
// `player.saxhleel`. A tool that leaves the group anonymous measures `character('anon' % pool)` —
// a real shipped variant, but not the one it thinks it has, and its morph (snout, crest, build,
// head) is a different character's. This cost an hour: an anonymous saxhleel's snout is long
// enough to swallow its own eye, and the instrument correctly reported 0 visible eye pixels for a
// figure nobody ships.
group.name = opts.subject || (opts.family === 'saxhleel' ? 'player' : 'anon');
if (opts.character) group.userData.actor.characterId = opts.character;
const rig = new Rig(skel, hitgeo);
rig.rx.fill(0); rig.ry.fill(0); rig.rz.fill(0);
// MOTION, NOT STILLS. The owner's standing directive is that a character claim needs the body in
// motion, and HAZARDS 16 is what happens when a capture only thinks it is moving. This one has no
// harness verb to get wrong: `--clip=locomotion_cycle --phase=<0..1>` drives the SAME `addPose`
// the game drives, and the phase is a number this file passes, so a sequence that does not move
// is visible as a sequence of identical frames rather than as a silent success.
addPose(rig, clips.archetypes[opts.clip] || clips.archetypes.idle_loop || Object.values(clips.archetypes)[0], opts.phase, 1);
rig.evaluate([0, 0, 0], 0, 0, 0.1, 1.0);
// `water` is the third argument and it is what switches the PRESENTATION IK on: `poseFromRig`
// conforms the two terminal foot bones to `water.groundAt(x, z)` whenever the actor is not
// airborne (actor.js:2020). Passing it is the difference between measuring the character as built
// and measuring the character as the game draws it standing on ground, and the r5 capture was of
// the second. `--ground=<y>` supplies a flat stand at that height.
const waterArg = opts.ground === null ? undefined
  : { y: -9999, wetness: 0, groundAt: () => opts.ground };
actorMod.poseFromRig(group, { rig, pos: [0, opts.ground === null ? 0 : opts.ground, 0], state: 'IDLE',
  animFrame: 0, equipLoadPct: 20, move: null, hitboxActive: false, airborne: false, shield: null,
  twoHanded: false, offhandKind: null, moves: { _weapon: null } }, waterArg);

const built = group.userData?.actor?.built;
if (!built) { console.error('actor did not build'); process.exit(1); }
for (const p of built.equipment) p.mesh.visible = opts.equipped && p.set === 'reed';

const restWorld = built.restWorld, index = built.index;
const boneName = new Map();
for (const [k, v] of index.entries()) boneName.set(v, k);
const originOf = (id) => {
  const bi = index.get(id);
  if (bi === undefined) return null;
  return new THREE.Vector3().setFromMatrixPosition(opts.posed ? built.bones[bi].matrixWorld : restWorld[bi]);
};

// Gather every triangle the renderer would draw, tagged with its owner.
const rigidLocal = new Map();
for (const p of [...(built.equipment || []), ...(built.presentation || [])]) {
  if (p.mesh.visible !== false) rigidLocal.set(p.mesh, { local: p.local, bi: p.bi });
}
const tris = [];
const v = new THREE.Vector3();
group.traverse((o) => {
  if (!o.isMesh || !o.geometry || o.visible === false) return;
  if (/actor-contact-shadow|actor-action-silhouette|actor-weapon|actor-shield/.test(o.name || '')) return;
  const g = o.geometry, pos = g.attributes.position, idx = g.index;
  const si = g.attributes.skinIndex, sw = g.attributes.skinWeight;
  const skinned = !!(si && sw);
  const rigid = rigidLocal.get(o);
  if (!skinned && !rigid) return;
  const surface = (o.name || '').replace(/^actor-body:[^:]+:/, '');
  const dominant = (ii) => {
    let best = -1, bw = -1;
    for (const ch of ['X', 'Y', 'Z', 'W']) {
      const w = sw[`get${ch}`](ii); if (w > bw) { bw = w; best = si[`get${ch}`](ii); }
    }
    return best;
  };
  // Rigid pieces: the render path composes `boneWorld * item.local`. In rest that is
  // `restWorld[bi]`; posed it is the live `bones[bi].matrixWorld` the pose just wrote.
  const boneFrame = (bi) => (opts.posed ? built.bones[bi].matrixWorld : restWorld[bi]);
  const M = rigid ? boneFrame(rigid.bi).clone().multiply(rigid.local) : null;
  // Skinning, longhand and only when asked for. The bind matrix is identity and the skeleton is
  // written in WORLD space, so the shader resolves to `boneWorld * restInv` per influence — which
  // is exactly `bones[j].matrixWorld * skeleton.boneInverses[j]`.
  const skinMats = [];
  if (opts.posed && skinned) {
    for (let j = 0; j < built.bones.length; j++) {
      skinMats.push(built.bones[j].matrixWorld.clone().multiply(built.skeleton.boneInverses[j]));
    }
  }
  const tmp = new THREE.Vector3(), acc = new THREE.Vector3(), nv = new THREE.Vector3();
  const nrmAttr = g.attributes.normal || null;
  const NM = M ? new THREE.Matrix3().getNormalMatrix(M) : null;
  const skinVertex = (ii) => {
    acc.set(0, 0, 0);
    let tot = 0;
    for (const ch of ['X', 'Y', 'Z', 'W']) {
      const w = sw[`get${ch}`](ii); if (w <= 0) continue;
      const j = si[`get${ch}`](ii); const m = skinMats[j]; if (!m) continue;
      tmp.fromBufferAttribute(pos, ii).applyMatrix4(m);
      acc.addScaledVector(tmp, w); tot += w;
    }
    if (tot > 0) acc.multiplyScalar(1 / tot); else acc.fromBufferAttribute(pos, ii);
    return acc;
  };
  const n = idx ? idx.count : pos.count;
  for (let i = 0; i < n; i += 3) {
    const ia = idx ? idx.getX(i) : i, ib = idx ? idx.getX(i + 1) : i + 1, ic = idx ? idx.getX(i + 2) : i + 2;
    let owner;
    if (skinned) {
      const d = dominant(ia);
      owner = `${surface}@${boneName.get(d) || d}`;
    } else owner = o.name;
    const vv = [], nn = [];
    for (const ii of [ia, ib, ic]) {
      if (skinned && opts.posed) { const s = skinVertex(ii); vv.push(s.x, s.y, s.z); }
      else { v.fromBufferAttribute(pos, ii); if (M) v.applyMatrix4(M); vv.push(v.x, v.y, v.z); }
      if (nrmAttr) { nv.fromBufferAttribute(nrmAttr, ii); if (NM) nv.applyMatrix3(NM); nn.push(nv.x, nv.y, nv.z); }
    }
    tris.push({ owner, v: vv, n: nrmAttr ? nn : null });
  }
});

// A ground plane, so "below the terrain" is measurable rather than inferred. It is a real
// occluder in the raster and it is what the r5 close-ups had in frame.
if (opts.ground !== null) {
  const G = opts.ground, E = 4;
  for (const q of [[[-E, G, -E], [E, G, -E], [E, G, E]], [[-E, G, -E], [E, G, E], [-E, G, E]]]) {
    tris.push({ owner: 'GROUND', v: [...q[0], ...q[1], ...q[2]] });
  }
}

// The crop: the same close-ups the r5 capture used, expressed as a target and a half-width.
const ankle = originOf('foot_l'), head = originOf('head');
const CROPS = {
  foot: { target: [ankle.x, ankle.y - 0.01, ankle.z + 0.04], half: 0.18,
    want: /^skin@foot_l$/, want_label: 'skin@foot_l (the sole, heel, ball and toes)' },
  face: { target: [head.x, head.y + 0.075, head.z + 0.05], half: 0.16,
    want: /eye-|pupil-|mouth-line/, want_label: 'eye, pupil and mouth family forms' },
  leg: { target: [ankle.x, ankle.y + 0.20, ankle.z], half: 0.35, want: /^skin@foot_l$/, want_label: 'skin@foot_l' },
};
const crop = { ...(CROPS[opts.part] || CROPS.foot) };
if (opts.half !== null) crop.half = opts.half;
if (opts.target !== null) crop.target = opts.target;

const rows = [];
for (const az of opts.bearings) {
  const r = rasterise(tris, { target: crop.target, az, elev: opts.elev, half: crop.half, res: opts.res });
  const c = census(r);
  const wanted = c.owners.filter((o) => crop.want.test(o.name)).reduce((s, o) => s + o.px, 0);
  rows.push({ bearing_deg: az, ...c, wanted_px: wanted,
    wanted_pct_of_covered: c.covered_px ? Number(((wanted / c.covered_px) * 100).toFixed(3)) : 0 });
}

console.log(`part=${opts.part}  family=${opts.family}  equipped=${opts.equipped}  res=${opts.res}  elev=${opts.elev}`);
console.log(`crop target=[${crop.target.map((n) => n.toFixed(3)).join(', ')}]  half-width=${crop.half} m  (${((crop.half * 2 * 1000) / opts.res).toFixed(2)} mm/px)`);
console.log(`LOOKING FOR: ${crop.want_label}\n`);
console.log('bearing  covered_px  wanted_px   %of covered  relief_mm  grad_p90  top three owners');
for (const r of rows) {
  const top = r.owners.slice(0, 3).map((o) => `${o.name}:${o.px}`).join('  ');
  console.log(`${String(r.bearing_deg).padStart(7)}  ${String(r.covered_px).padStart(10)}  ${String(r.wanted_px).padStart(9)}  ${String(r.wanted_pct_of_covered).padStart(11)}  ${String(r.relief_mm).padStart(9)}  ${String(r.relief_p90_mm_per_px).padStart(8)}  ${top}`);
}
// A picture of the owner map, because a census is a statistic and the standing directive is to
// LOOK. Each owner gets a stable colour from a hash of its name; the wanted owner is forced to
// magenta so it cannot be confused with anything.
if (opts.png) {
  const zlib = await import('node:zlib');
  const az = opts.bearings[0];
  const r = rasterise(tris, { target: crop.target, az, elev: opts.elev, half: crop.half, res: opts.res });
  const N = r.N, rgb = Buffer.alloc(N * N * 3);
  const colour = (name) => {
    if (crop.want.test(name)) return [255, 0, 200];
    let h = 0; for (const c of name) h = (h * 31 + c.charCodeAt(0)) >>> 0;
    return [80 + (h & 127), 80 + ((h >> 7) & 127), 80 + ((h >> 14) & 127)];
  };
  // SHADED MODE EXISTS BECAUSE A CENSUS CANNOT TELL YOU WHETHER A FACE READS. The owner map proves
  // a landmark reaches the frontmost surface; only a shaded image says whether a viewer would see
  // it. Flat per-triangle N.L under one key plus a fill — deliberately harsher than the game's
  // lighting, so a landmark that survives here is not surviving on a generous light.
  const albedo = (name) => name === 'GROUND' ? [90, 105, 70]
    : /pupil|mouth-line/.test(name) ? [26, 20, 16]
      : /eye-/.test(name) ? [167, 159, 140]   // the SHIPPED hEyeMat 0xa79f8c, not a guess — a preview
                                            // that paints the sclera brighter than the material
                                            // makes an eye look like a bulging ping-pong ball and
                                            // this one did, for two tuning passes.
        : /:cloth@|equipment|tunic|hair-cap/.test(name) ? [126, 132, 150]
          : /:bone@|claw/.test(name) ? [206, 196, 168] : [162, 150, 118];
  const L = [0.42, 0.78, 0.46]; const ln = Math.hypot(...L);
  const nrm = new THREE.Vector3(), e1 = new THREE.Vector3(), e2 = new THREE.Vector3();
  for (let k = 0; k < N * N; k++) {
    if (r.owner[k] < 0) { rgb[k * 3] = 16; rgb[k * 3 + 1] = 16; rgb[k * 3 + 2] = 20; continue; }
    const name = r.names[r.owner[k]];
    if (!opts.shade) { const c = colour(name); rgb[k * 3] = c[0]; rgb[k * 3 + 1] = c[1]; rgb[k * 3 + 2] = c[2]; continue; }
    const T3 = tris[r.tri[k]];
    if (T3.n && (r.nrmBuf[k*3] || r.nrmBuf[k*3+1] || r.nrmBuf[k*3+2])) {
      nrm.set(r.nrmBuf[k*3], r.nrmBuf[k*3+1], r.nrmBuf[k*3+2]).normalize();
    } else {
      const t = T3.v;
      e1.set(t[3] - t[0], t[4] - t[1], t[5] - t[2]);
      e2.set(t[6] - t[0], t[7] - t[1], t[8] - t[2]);
      nrm.crossVectors(e1, e2).normalize();
    }
    let nl = (nrm.x * L[0] + nrm.y * L[1] + nrm.z * L[2]) / ln;
    if (nrm.dot(r.view.fwd) > 0) nl = -nl;                    // face the camera; winding is not trusted
    const lit = 0.22 + 0.78 * Math.max(0, nl);
    const a = albedo(name);
    for (let c = 0; c < 3; c++) rgb[k * 3 + c] = Math.min(255, Math.round(a[c] * lit));
  }
  const stride = N * 3, raw = Buffer.alloc(N * (stride + 1));
  for (let y = 0; y < N; y++) rgb.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  const T2 = []; for (let n2 = 0; n2 < 256; n2++) { let c = n2; for (let k2 = 0; k2 < 8; k2++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; T2[n2] = c >>> 0; }
  const crc = (buf) => { let c = 0xFFFFFFFF; for (const b of buf) c = T2[(c ^ b) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
  const chunk = (type, data) => { const c = Buffer.alloc(8 + data.length + 4); c.writeUInt32BE(data.length, 0); c.write(type, 4, 'ascii'); data.copy(c, 8); c.writeInt32BE(crc(Buffer.concat([Buffer.from(type, 'ascii'), data])) | 0, 8 + data.length); return c; };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(N, 0); ihdr.writeUInt32BE(N, 4); ihdr[8] = 8; ihdr[9] = 2;
  writeFileSync(opts.png, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]));
  console.log(`wrote ${opts.png} (bearing ${az}; magenta = ${crop.want_label})`);
}

const totalWanted = rows.reduce((s, r) => s + r.wanted_px, 0);
const bearingsWithNone = rows.filter((r) => r.wanted_px === 0).length;
console.log(`\n${totalWanted} visible pixels of ${crop.want_label} across ${rows.length} bearings; ${bearingsWithNone} bearings show NONE of it.`);

if (opts.json) {
  writeFileSync(opts.json, JSON.stringify({ part: opts.part, family: opts.family, equipped: opts.equipped,
    res: opts.res, elev: opts.elev, crop: { target: crop.target, half: crop.half, want: String(crop.want) },
    total_wanted_px: totalWanted, bearings_with_none: bearingsWithNone, rows }, null, 2));
  console.log(`wrote ${opts.json}`);
}
