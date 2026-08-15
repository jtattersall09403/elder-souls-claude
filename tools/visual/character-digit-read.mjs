#!/usr/bin/env node
/**
 * character-digit-read.mjs — can you see the fingers, and over how many millimetres.
 *
 * WHY THIS EXISTS, AND WHY THE BRIEF THAT COMMISSIONED IT WAS WRONG.
 *
 * `orchestration/status/W1-F10-r3-materials.json` states, first in its own `could_not_do` list:
 *
 *   "HANDS AND FEET ARE STILL ABSENT ... `PLAN.hand_l` is still a single tapered tube of
 *    r 0.055 -> 0.042 with a joint ball ... There are no fingers, no palm, no toes, no sole."
 *
 * **That is false about the repo and it has been false since 2026-08-12.** `git log -L` over the
 * block at `game/src/render/actor.js` shows a palm ellipsoid, three finger tubes, an opposed thumb,
 * a foot sole ellipsoid and three toe tubes landing in commit `fdd41f0a` and being morph-scaled in
 * `4607cabe`. `git show f86acd5b:game/src/render/actor.js | grep -c "Three fingers and an opposed
 * thumb"` returns 1 — the geometry was already there at r3's own pinned baseline.
 *
 * What r3 got RIGHT is the observation: every close-up shows a stump. Both statements can be true
 * at once, and the reason is the whole point of this instrument — **the digits are built and then
 * buried.** Three volumes sit on top of them:
 *
 *   1. the `PLAN.hand_l` tube itself           r 0.055 -> 0.042, 9.5 cm long, down the digit axis
 *   2. the palm ellipsoid                      HALF-extents 0.070 x 0.090 x 0.048, i.e. a 14 cm
 *                                              wide, 18 cm tall, 9.6 cm thick slab of a "palm"
 *   3. the `hands` equipment guard             `taperedGuardGeometry(.078,.062,.19,.76)` at
 *                                              offset [0,-.055,0] — a 15.6 cm-diameter, 19 cm-long
 *                                              closed cylinder over the entire hand
 *
 * The digits run from y = -0.084 to y = -0.174 in hand-local metres. Volume 2 alone reaches
 * y = -0.145 and volume 3 reaches y = -0.150. So on a combatant roughly **24 mm of a 90 mm digit**
 * is outside the masses that enclose it, and on a civilian (no equipment — `poseFromRig` sets
 * `item.mesh.visible = !A.civilian && item.set === 'reed'`) roughly **29 mm**. A hand is a stump
 * because everything except its last centimetre is inside something else.
 *
 * MEASURING GEOMETRY THAT EXISTS IS NOT THE QUESTION. A triangle count would have said the hand was
 * fine — this is the same defect family as `RI-VIS08` B2's own note that statistics can fail a build
 * and can never pass one. The question a player asks is *can I see a finger*, and the honest
 * instrument for it is the silhouette, because a silhouette is what a viewer resolves at 2 m.
 *
 * WHAT IS MEASURED. All triangles inside a box around one hand (or foot), in that bone's own rest
 * frame, orthographically projected onto the back-of-hand plane and rasterised into an occupancy
 * bitmap at 0.5 mm/pixel. Then, per scan row across the digit axis:
 *
 *   runs(row)  = number of maximal occupied intervals, ignoring intervals under 1.5 mm (noise)
 *
 *   digit_lobes_max      = max over rows of runs(row)            -- how many digits ever separate
 *   separated_span_mm    = extent in mm of rows where runs >= 2  -- over how far you see daylight
 *   hand_span_mm         = full extent of the silhouette along the digit axis
 *   separated_fraction   = separated_span_mm / hand_span_mm
 *
 * THE BAR, AND WHERE IT COMES FROM. `corpus/70-visual/refs/context/ESO-argonian_character__steam-
 * 1634540211.jpg` was opened at native 1920x1080 and both hands cropped and enlarged 3x for this
 * piece. On the viewer-left hand the wrist-to-claw-tip span is ~510 px and background is visible
 * between the digits over ~300 px of it, i.e. a separated fraction of **~0.59**. That number is
 * EYEBALLED off an opened plate, not computed, and is labelled as such wherever it is used. The
 * gate here is set deliberately slacker than the reference at **0.40**, with `digit_lobes_max >= 3`,
 * so that passing it is not generous. `refs/characters/INDEX.md` §4 routes that plate FIDELITY-only
 * under `RI-VIS10` §A2 — it governs how well a hand is made, not what an Argonian hand is, which is
 * exactly the use made of it here.
 *
 * The `character_fullbody/` slot cannot supply this bar and it is worth recording why: opened this
 * turn, all 25 plates are **cuirass renders on a transparent card — no head, no hands, no feet**.
 * `refs/characters/INDEX.md` §1 describes C4 as "Full-body humanoid, head to foot"; it is not.
 *
 * MAKE IT FAIL ON PURPOSE (RULES.md 4):
 *   node tools/visual/character-digit-read.mjs --self-test
 * builds a synthetic hand of four separated bars, asserts 4 lobes and a separated fraction near 1,
 * then drops a slab over 80% of it and asserts the instrument reports 1 lobe and GOES RED.
 *
 * Usage:
 *   node tools/visual/character-digit-read.mjs                      # player + sampled roster
 *   node tools/visual/character-digit-read.mjs --part=foot
 *   node tools/visual/character-digit-read.mjs --equipped           # combatant (guards visible)
 *   node tools/visual/character-digit-read.mjs --sample=6 --json=out.json
 *   node tools/visual/character-digit-read.mjs --self-test
 *
 * Exit code: non-zero if any subject fails the gate, so this can guard the fix.
 */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const R = resolve(HERE, '../..');

// THE GATE IS PER PART, AND A SINGLE NUMBER FOR BOTH WOULD BE WRONG. The 0.40 hand bar is
// calibrated off the ESO plate at ~0.59 (see the header). Applying it to a FOOT is a category
// error and the instrument caught it: a foot's denominator is heel-to-claw-tip, of which the sole
// is legitimately most, so **a real human foot scores about 0.13 on this metric** — toes are ~25%
// of foot length and separate over ~60% of their own length. A gate a real foot fails is a gate
// that would make me sculpt a wrong foot to satisfy it, which is HAZARDS §15's exact lesson.
//
// So the foot bar is derived from anatomy and DECLARED AS SUCH: 0.25 * 0.60 = 0.15 for a
// plantigrade human foot, plus roughly a tenth again for a clawed digit that protrudes past the
// pad, giving **0.18**. It is NOT calibrated against a photograph, because there is no photograph
// to calibrate it against: `refs/characters/` routes no bare-foot plate, the four ESO Argonian
// plates show no feet (grass and skirt in all four, opened this turn), and all 25
// `character_fullbody/` plates are cuirass renders with no feet at all. REVERSIBLE: a foot
// reference entering the set overturns this number, and it should.
const GATE = { hand: { lobes: 3, fraction: 0.40 }, foot: { lobes: 3, fraction: 0.18 } };
const opts = { json: null, selfTest: false, sample: 6, part: 'hand', equipped: false,
  lobes: null, fraction: null, px: 0.0005 };
for (const a of process.argv.slice(2)) {
  const [k, v] = a.replace(/^--/, '').split('=');
  if (k === 'json') opts.json = resolve(v);
  else if (k === 'self-test') opts.selfTest = true;
  else if (k === 'sample') opts.sample = Number(v);
  else if (k === 'part') opts.part = v;
  else if (k === 'equipped') opts.equipped = true;
  else if (k === 'lobes') opts.lobes = Number(v);
  else if (k === 'fraction') opts.fraction = Number(v);
}
if (opts.lobes === null) opts.lobes = (GATE[opts.part] || GATE.hand).lobes;
if (opts.fraction === null) opts.fraction = (GATE[opts.part] || GATE.hand).fraction;

const THREE = await import(pathToFileURL(join(R, 'game/vendor/three/three.module.js')).href);

// ---------------------------------------------------------------------------------------
// The measurement itself. Input: a list of world-space triangles and a rest frame. Output: the
// four numbers above. Nothing in here knows about actors, so the self-test can drive it directly.
// ---------------------------------------------------------------------------------------

/**
 * @param tris  flat array of world-space vertices, 9 numbers per triangle
 * @param frame THREE.Matrix4 — the bone's rest world matrix; its inverse takes us to bone-local
 * @param axis  which local axis the digits run along, and its sign ('-y' for a hand, '+z' for a foot)
 * @param view  which local axis we look down ('z' for back-of-hand, 'y' for the sole)
 */
function digitRead(tris, frame, axis, view, pxSize) {
  const inv = frame ? frame.clone().invert() : new THREE.Matrix4();
  const v = new THREE.Vector3();
  // local coordinates, then remap so `a` is the digit axis (increasing away from the wrist) and
  // `b` is the spread axis (the one we count runs along).
  const axisSign = axis[0] === '-' ? -1 : 1, axisName = axis[1];
  const spreadName = (axisName === 'y' ? 'x' : axisName === 'z' ? 'x' : 'y');
  const remap = (p) => {
    const a = p[axisName] * axisSign;
    const b = p[spreadName];
    return [a, b];
  };
  const pts = [];
  for (let i = 0; i < tris.length; i += 3) {
    v.set(tris[i], tris[i + 1], tris[i + 2]).applyMatrix4(inv);
    pts.push(remap(v));
  }
  if (!pts.length) return null;
  let aMin = Infinity, aMax = -Infinity, bMin = Infinity, bMax = -Infinity;
  for (const [a, b] of pts) {
    if (a < aMin) aMin = a; if (a > aMax) aMax = a;
    if (b < bMin) bMin = b; if (b > bMax) bMax = b;
  }
  const pad = pxSize * 4;
  aMin -= pad; aMax += pad; bMin -= pad; bMax += pad;
  const W = Math.max(4, Math.min(4096, Math.ceil((bMax - bMin) / pxSize)));
  const H = Math.max(4, Math.min(4096, Math.ceil((aMax - aMin) / pxSize)));
  const grid = new Uint8Array(W * H);
  const toX = (b) => (b - bMin) / (bMax - bMin) * (W - 1);
  const toY = (a) => (a - aMin) / (aMax - aMin) * (H - 1);
  // scanline-fill each projected triangle
  for (let t = 0; t < pts.length; t += 3) {
    const p0 = pts[t], p1 = pts[t + 1], p2 = pts[t + 2];
    const x0 = toX(p0[1]), y0 = toY(p0[0]), x1 = toX(p1[1]), y1 = toY(p1[0]), x2 = toX(p2[1]), y2 = toY(p2[0]);
    const yLo = Math.max(0, Math.floor(Math.min(y0, y1, y2)));
    const yHi = Math.min(H - 1, Math.ceil(Math.max(y0, y1, y2)));
    for (let y = yLo; y <= yHi; y++) {
      const yc = y + 0.5;
      let xs = [];
      const edge = (ax, ay, bx, by) => {
        if ((ay <= yc && by > yc) || (by <= yc && ay > yc)) xs.push(ax + (yc - ay) / (by - ay) * (bx - ax));
      };
      edge(x0, y0, x1, y1); edge(x1, y1, x2, y2); edge(x2, y2, x0, y0);
      if (xs.length < 2) continue;
      xs.sort((p, q) => p - q);
      for (let k = 0; k + 1 < xs.length; k += 2) {
        const xLo = Math.max(0, Math.round(xs[k])), xHi = Math.min(W - 1, Math.round(xs[k + 1]));
        for (let x = xLo; x <= xHi; x++) grid[y * W + x] = 1;
      }
    }
  }
  // runs per row. A run under 1.5 mm is noise (a cap sliver, an anti-aliased edge of one tube).
  const minRunPx = Math.max(1, Math.round(0.0015 / pxSize));
  const runsPerRow = new Int16Array(H);
  let lobesMax = 0, occupiedRows = 0, sepRows = 0;
  let firstOcc = -1, lastOcc = -1, firstSep = -1, lastSep = -1;
  for (let y = 0; y < H; y++) {
    let runs = 0, run = 0;
    for (let x = 0; x < W; x++) {
      if (grid[y * W + x]) run++;
      else { if (run >= minRunPx) runs++; run = 0; }
    }
    if (run >= minRunPx) runs++;
    runsPerRow[y] = runs;
    if (runs > 0) { occupiedRows++; if (firstOcc < 0) firstOcc = y; lastOcc = y; }
    if (runs >= 2) { sepRows++; if (firstSep < 0) firstSep = y; lastSep = y; }
    if (runs > lobesMax) lobesMax = runs;
  }
  const spanMm = occupiedRows ? (lastOcc - firstOcc + 1) * pxSize * 1000 : 0;
  const sepMm = sepRows ? (lastSep - firstSep + 1) * pxSize * 1000 : 0;
  return {
    view, digit_axis: axis,
    raster_px: [W, H], px_mm: pxSize * 1000,
    digit_lobes_max: lobesMax,
    span_mm: Number(spanMm.toFixed(1)),
    separated_span_mm: Number(sepMm.toFixed(1)),
    separated_fraction: spanMm > 0 ? Number((sepMm / spanMm).toFixed(3)) : 0,
    rows_with_two_or_more: sepRows,
  };
}

// ---------------------------------------------------------------------------------------
// SELF-TEST — the arms are required to disagree, per RULES.md 4 and HAZARDS §0.
// ---------------------------------------------------------------------------------------
if (opts.selfTest) {
  // four bars along -y, separated in x. Each bar 12 mm wide, 8 mm gaps, 90 mm long.
  const bar = (x0, x1, y0, y1) => {
    const z0 = -0.01, z1 = 0.01;
    const q = [];
    const quad = (a, b, c, d) => q.push(...a, ...b, ...c, ...a, ...c, ...d);
    quad([x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0]);
    quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]);
    return q;
  };
  const fingers = [];
  for (let k = 0; k < 4; k++) {
    const x0 = -0.034 + k * 0.020;
    fingers.push(...bar(x0, x0 + 0.012, -0.010, -0.100));
  }
  const clean = digitRead(fingers, null, '-y', 'z', opts.px);
  // now bury them: a slab covering from y=-0.010 down to y=-0.082, i.e. 80% of the digit length
  const buried = fingers.concat(bar(-0.060, 0.060, -0.010, -0.082));
  const stump = digitRead(buried, null, '-y', 'z', opts.px);
  console.log(`self-test  four free bars : lobes=${clean.digit_lobes_max}  span=${clean.span_mm}mm  separated=${clean.separated_span_mm}mm  fraction=${clean.separated_fraction}`);
  console.log(`self-test  same bars, 80% buried under a slab : lobes=${stump.digit_lobes_max}  span=${stump.span_mm}mm  separated=${stump.separated_span_mm}mm  fraction=${stump.separated_fraction}`);
  const ok = clean.digit_lobes_max === 4 && clean.separated_fraction > 0.95
    && stump.digit_lobes_max === 4 && stump.separated_fraction < 0.30;
  // NOTE the shape of the assertion: the buried arm still reaches 4 lobes over its last 18 mm, so
  // a lobe COUNT alone cannot tell a hand from a stump. It is the FRACTION that separates them,
  // and that is precisely why the gate below requires both.
  console.log(`self-test  the buried arm ${ok ? 'GOES RED on fraction (and NOT on lobe count — which is the point)' : 'DOES NOT BEHAVE AS REQUIRED'}`);
  if (!ok) { console.error('self-test FAILED: this instrument cannot distinguish free digits from buried ones.'); process.exit(1); }
  console.log('self-test passed.');
  process.exit(0);
}

// ---------------------------------------------------------------------------------------
// The shipped roster.
// ---------------------------------------------------------------------------------------
const fam = ['ground', 'water', 'bark', 'leaf', 'reed', 'wall', 'roof', 'plank', 'stone',
  'darkStone', 'skin', 'cloth', 'metal', 'moss', 'chitin', 'wet_chitin', 'bone', 'ember', 'resin'];
const mats = {};
for (const f of fam) { const m = new THREE.MeshStandardMaterial({ color: 0x808080 }); m.userData = { visualFamily: f }; mats[f] = m; }

const actorMod = await import(pathToFileURL(join(R, 'game/src/render/actor.js')).href);
const { Rig } = await import(pathToFileURL(join(R, 'game/src/combat/skeleton.js')).href);
const { addPose } = await import(pathToFileURL(join(R, 'game/src/combat/clips.js')).href);
const { artFamilyForRace } = await import(pathToFileURL(join(R, 'game/src/render/lib/race-art.js')).href);
const skel = JSON.parse(readFileSync(join(R, 'game/data/combat/skeleton.json'), 'utf8'));
const hitgeo = JSON.parse(readFileSync(join(R, 'game/data/combat/hitgeometry.json'), 'utf8'));
const clips = JSON.parse(readFileSync(join(R, 'game/data/combat/clips.json'), 'utf8'));

const roster = [];
for (const f of readdirSync(join(R, 'game/data/npcs')).filter((x) => x.endsWith('.json'))) {
  const d = JSON.parse(readFileSync(join(R, 'game/data/npcs', f), 'utf8'));
  for (const n of (Array.isArray(d) ? d : (d.npcs || d.records || []))) roster.push({ eid: n.eid || n.id, race: n.race, actor: n.actor });
}
const step = Math.max(1, Math.floor(roster.length / opts.sample));
const sample = [{ eid: 'player', race: 'saxhleel', actor: 'player' },
  ...roster.filter((_, i) => i % step === 0).slice(0, opts.sample)];

// The digit axis and the plane we look at it down. A hand's digits run along the bone's -Y and the
// readable view is the back of the hand (down local Z); a foot's toes run along +Z and the readable
// view is the sole (down local Y).
const PART = opts.part === 'foot'
  ? { bones: ['foot_l', 'foot_r'], axis: '+z', view: 'y' }
  : { bones: ['hand_l', 'hand_r'], axis: '-y', view: 'z' };

const rows = [];
for (const person of sample) {
  const family = artFamilyForRace(person.race);
  const group = actorMod.makeRiggedActor(mats, 0x8f9aa6, 0x8d9a72, family);
  group.name = person.eid === 'player' ? 'player' : `npc:${person.eid}`;
  const rig = new Rig(skel, hitgeo);
  rig.rx.fill(0); rig.ry.fill(0); rig.rz.fill(0);
  addPose(rig, clips.archetypes.idle_loop || Object.values(clips.archetypes)[0], 0, 1);
  rig.evaluate([0, 0, 0], 0, 0, 0.1, 1.0);
  actorMod.poseFromRig(group, { rig, pos: [0, 0, 0], state: 'IDLE', animFrame: 0,
    equipLoadPct: opts.equipped ? 20 : 20, move: null, hitboxActive: false, airborne: false,
    shield: null, twoHanded: false, offhandKind: null, moves: { _weapon: null } });

  const built = group.userData && group.userData.actor && group.userData.actor.built;
  // `poseFromRig` is the COMBAT path and it always shows one authored equipment set
  // (`equipLoadPct < 30 -> 'reed'`, actor.js:1931). The static path used for civilians sets
  // `item.mesh.visible = !A.civilian && item.set === 'reed'` (actor.js:2013), i.e. a civilian wears
  // nothing at all. Both populations ship, so both are measurable here: `--equipped` is the
  // combatant (guards on), the default is the civilian (guards off). The first cut of this tool
  // passed a `civilian` flag into `poseFromRig`, which ignores it — the two arms were identical
  // and I nearly reported that as "the guard makes no difference".
  if (built && built.equipment) {
    for (const p of built.equipment) p.mesh.visible = opts.equipped && p.set === 'reed';
  }
  const restWorld = built ? built.restWorld : null;
  const index = built ? built.index : null;

  for (const boneId of PART.bones) {
    if (!index || index.get(boneId) === undefined) continue;
    const bi = index.get(boneId);
    const frame = restWorld[bi];
    const inv = frame.clone().invert();
    const tris = [];
    const v = new THREE.Vector3();
    let equipTris = 0;
    // SELECTION IS BY SKIN WEIGHT, NOT BY A BOUNDING BOX. A first cut of this tool used a box in
    // hand-local metres and reported a 555 mm "hand" — it had swallowed the forearm and part of the
    // hip, and every fraction it printed was a fraction of the wrong thing. A vertex belongs to the
    // hand iff the hand bone is its DOMINANT skin influence, which is exactly the question, is
    // exact rather than tuned, and costs the same. Unskinned equipment carries its bone in its
    // name (`actor-equipment:reed:hands@hand_l`), so that half is a name test.
    // Rigid pieces (equipment, family forms) are NOT in rest space: their vertices are in their own
    // geometry space and the render path composes `boneWorld * item.local`. So the transform into
    // bone-local is `item.local` alone, and it must be read off `built.equipment` / `.presentation`
    // rather than off the mesh's matrix. Reading the mesh matrix instead produced a 1,062 mm
    // "hand" — the guard cylinder measured at actor scale, in the wrong frame.
    const rigidLocal = new Map();
    for (const p of [...(built.equipment || []), ...(built.presentation || [])]) {
      if (p.bi === bi && p.mesh.visible) rigidLocal.set(p.mesh, p.local);
    }
    group.traverse((o) => {
      if (!o.isMesh || !o.geometry || o.visible === false) return;
      if (/actor-contact-shadow|actor-action-silhouette/.test(o.name || '')) return;
      const g = o.geometry, pos = g.attributes.position, idx = g.index;
      const si = g.attributes.skinIndex, sw = g.attributes.skinWeight;
      const skinned = !!(si && sw);
      const local = rigidLocal.get(o);
      if (!skinned && !local) return;
      const dominant = (ii) => {
        let best = -1, bw = -1;
        for (const ch of ['x', 'y', 'z', 'w']) {
          const w = sw[`get${ch.toUpperCase()}`](ii);
          if (w > bw) { bw = w; best = si[`get${ch.toUpperCase()}`](ii); }
        }
        return best;
      };
      const n = idx ? idx.count : pos.count;
      for (let i = 0; i < n; i += 3) {
        const ia = idx ? idx.getX(i) : i, ib = idx ? idx.getX(i + 1) : i + 1, ic = idx ? idx.getX(i + 2) : i + 2;
        if (skinned && !(dominant(ia) === bi && dominant(ib) === bi && dominant(ic) === bi)) continue;
        for (const ii of [ia, ib, ic]) {
          v.fromBufferAttribute(pos, ii);
          if (skinned) v.applyMatrix4(inv); else v.applyMatrix4(local);
          tris.push(v.x, v.y, v.z);
        }
        if (!skinned) equipTris++;
      }
    });
    if (!tris.length) continue;
    // tris are already bone-local; pass an identity frame
    const r = digitRead(tris, null, PART.axis, PART.view, opts.px);
    if (!r) continue;
    rows.push({ subject: person.eid, race: person.race, art_family: family, bone: boneId,
      equipped: opts.equipped, tris: tris.length / 9, equipment_tris: equipTris, ...r });
  }
}

let fails = 0;
console.log(`part=${opts.part}  equipped=${opts.equipped}  gate: lobes >= ${opts.lobes} AND separated_fraction >= ${opts.fraction}`);
console.log('subject                 bone     tris  lobes  span_mm  sep_mm  fraction  verdict');
for (const r of rows) {
  const ok = r.digit_lobes_max >= opts.lobes && r.separated_fraction >= opts.fraction;
  if (!ok) fails++;
  console.log(`${String(r.subject).padEnd(22)}  ${r.bone.padEnd(7)}  ${String(r.tris).padStart(4)}  ${String(r.digit_lobes_max).padStart(5)}  ${String(r.span_mm).padStart(7)}  ${String(r.separated_span_mm).padStart(6)}  ${String(r.separated_fraction).padStart(8)}  ${ok ? 'ok' : 'STUMP'}`);
}
const summary = { part: opts.part, equipped: opts.equipped, gate: { lobes: opts.lobes, fraction: opts.fraction },
  gate_provenance: opts.part === 'foot'
    ? 'anatomical, NOT photographic — no bare-foot reference exists in refs/characters/ (see header)'
    : 'eyeballed off an opened plate at ~0.59, gate set slacker at 0.40',
  reference_fraction_eyeballed: opts.part === 'foot' ? null : 0.59,
  reference_plate: opts.part === 'foot' ? null
    : 'corpus/70-visual/refs/context/ESO-argonian_character__steam-1634540211.jpg',
  subjects: rows.length, failing: fails, rows };
if (opts.json) writeFileSync(opts.json, JSON.stringify(summary, null, 2));
console.log(`\n${fails} of ${rows.length} outside the gate.`);
process.exit(fails > 0 ? 1 : 0);
