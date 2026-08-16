#!/usr/bin/env node
/**
 * f10-r13-body-census.mjs — is the crowd a POPULATION, or fourteen people with more names?
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * WHY THIS EXISTS, AND WHY IT IS NOT `f10-r9c-crowd-census.mjs` A SECOND TIME
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 *
 * `W1-F10-r12-CRITIC`'s gap is *"the crowd breathes and there are still fourteen people in it"* —
 * 14 distinct rendered bodies for 408 records, 93 identical pairs within 15 m, 3 build bands of 5.
 * The obvious way to close it is to make the census read a bigger number, and the critic named
 * that trap in the same paragraph: *"fourteen bodies becoming forty by permuting a scale factor
 * would satisfy a naive census and produce forty people who still read as the same person."*
 *
 * **So the count is the least interesting thing in this file.** Three arms exist to try to prove
 * the count worthless, and each one CAN come back red:
 *
 *   STRUCTURAL   `rigVariantKey` hashes the morph NUMBERS. Two bodies with one key are one body
 *                under two names. If the name count exceeds the key count, the extra names are
 *                free and the arm says so.
 *   SILHOUETTE   pairwise IoU over binary masks at RI-VIS10 C2's own 120 px figure height, front
 *                and 90°, with the POSE HELD IDENTICAL across every body so the number is about
 *                shape and cannot be bought with a stance. Masks are height-normalised, which is
 *                exactly why a uniform scale cannot move this number — and why nothing in round
 *                13 varies by scale.
 *   NULL CONTROL the whole roster rebuilt with the cut layer COLLAPSED (every actor forced onto
 *                its archetype) and race scoping disabled. The body count must fall and the worst
 *                IoU must go to 1.0000. **If the control does not collapse, the round changed
 *                nothing and this file must say so.** Every arm here is required to be able to
 *                return a non-zero answer; `HAZARDS §30` is what that sentence is for.
 *
 * A SECOND ROUTE, NOT A SECOND COPY. E1/E3/E4 are re-derived here from the same shipped modules
 * by different code than `f10-r9c-crowd-census.mjs` uses, and both numbers are published. Where
 * they disagree, one of them is wrong and neither may be quoted.
 *
 * Usage:
 *   node tools/visual/f10-r13-body-census.mjs --json=out.json [--res=768] [--pairs-max=400]
 *   node tools/visual/f10-r13-body-census.mjs --self-test
 */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { collectTriangles, rasterise } from './actor-orbit-holes.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../..');
const args = {};
for (const a of process.argv.slice(2)) { const [k, v] = a.replace(/^--/, '').split('='); args[k] = v === undefined ? true : v; }
const RES = Number(args.res || 640);
const MASK = Number(args.mask || 120);

// ── the roster, enumerated by command over the shipped files ────────────────────────────────
const files = readdirSync(join(ROOT, 'game/data/npcs')).filter((f) => f.endsWith('.json')).sort();
const npcs = [];
for (const f of files) {
  const doc = JSON.parse(readFileSync(join(ROOT, 'game/data/npcs', f), 'utf8'));
  const list = Array.isArray(doc) ? doc : (doc.npcs || doc.records || doc.entries || []);
  for (const r of (Array.isArray(list) ? list : [])) {
    if (!r || typeof r !== 'object' || !r.id) continue;
    npcs.push(r);
  }
}
const N = npcs.length;

const THREE = await import(pathToFileURL(join(ROOT, 'game/vendor/three/three.module.js')).href);
const actorMod = await import(pathToFileURL(join(ROOT, 'game/src/render/actor.js')).href);
const { artFamilyForRace } = await import(pathToFileURL(join(ROOT, 'game/src/render/lib/race-art.js')).href);
const { Rig } = await import(pathToFileURL(join(ROOT, 'game/src/combat/skeleton.js')).href);
const { addPose } = await import(pathToFileURL(join(ROOT, 'game/src/combat/clips.js')).href);
const skel = JSON.parse(readFileSync(join(ROOT, 'game/data/combat/skeleton.json'), 'utf8'));
const hitgeo = JSON.parse(readFileSync(join(ROOT, 'game/data/combat/hitgeometry.json'), 'utf8'));
const clips = JSON.parse(readFileSync(join(ROOT, 'game/data/combat/clips.json'), 'utf8'));

const mats = {};
for (const f of ['ground', 'water', 'bark', 'leaf', 'reed', 'wall', 'roof', 'plank', 'stone', 'darkStone',
  'skin', 'cloth', 'metal', 'moss', 'chitin', 'wet_chitin', 'bone', 'ember', 'resin']) {
  const m = new THREE.MeshStandardMaterial({ color: 0x808080 }); m.userData = { visualFamily: f }; mats[f] = m;
}

/** ONE pose, shared by every body in this file. `RI-VIS10` C2 asks whether two ARCHETYPES are the
 *  same figure; a per-person stance would make the answer partly about the stance, and round 11
 *  already gave the crowd 392 of those. Holding it fixed is what makes the IoU a body number. */
function idleBody() {
  const rig = new Rig(skel, hitgeo);
  rig.rx.fill(0); rig.ry.fill(0); rig.rz.fill(0);
  addPose(rig, clips.archetypes.idle_ready || Object.values(clips.archetypes)[0], 0, 1);
  rig.evaluate([0, 0, 0], 0, 0, 0.1, 1.0);
  return { rig, pos: [0, 0, 0], state: 'IDLE', animFrame: 0, equipLoadPct: 20, move: null,
    hitboxActive: false, airborne: false, shield: null, twoHanded: false, offhandKind: null, moves: { _weapon: null } };
}
const BODY = idleBody();
const boneIds = skel.bones.map((b) => b.id);

/**
 * Build one record exactly as `renderer.js:syncNPCs` does and read back what was STAMPED.
 * `scopeRace` false is the null control's arm: it drops the fifth argument, which is the whole of
 * round 13's race scoping, so the control genuinely runs the previous selection rule.
 */
function build(rec, { scopeRace = true, forceCut = null } = {}) {
  const family = artFamilyForRace(rec.race);
  const g = actorMod.makeRiggedActor(mats, 0x8f9aa6, 0x8d9a72, family, scopeRace ? rec.race : null);
  g.name = `npc:${rec.id}`;
  if (forceCut) {
    // Collapse the cut layer: name the archetype the shipped rule would have chosen, with no cut.
    const probe = actorMod.makeRiggedActor(mats, 0x8f9aa6, 0x8d9a72, family, scopeRace ? rec.race : null);
    probe.name = g.name;
    actorMod.poseFromRig(probe, BODY);
    g.userData.actor.characterId = probe.userData.actor.characterArchetype;
  }
  actorMod.poseFromRig(g, BODY);
  const A = g.userData.actor;
  let variantKey = null;
  g.traverse((o) => { if (o.isMesh && o.userData && o.userData.rigVariantKey) variantKey = o.userData.rigVariantKey; });
  return { group: g, family, id: A.characterId, archetype: A.characterArchetype, cut: A.characterCut,
    variantKey, morph: (A.character && A.character.morph) || {} };
}

/** A binary silhouette mask at `MASK` px figure height, plus the pixel numbers RI-VIS10 C1 wants. */
function silhouette(group, yawDeg) {
  const { tris, parts } = collectTriangles(THREE, group, boneIds);
  if (!tris.length) return null;
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
  const yaw = yawDeg * Math.PI / 180;
  const eye = new THREE.Vector3(centre.x + Math.sin(yaw) * 50, centre.y, centre.z + Math.cos(yaw) * 50);
  const view = new THREE.Matrix4().lookAt(eye, centre, new THREE.Vector3(0, 1, 0));
  view.setPosition(eye);
  const inv = new THREE.Matrix4().copy(view).invert();
  const halfH = worldH * 0.55;
  const proj = new THREE.Matrix4().makeOrthographic(-halfH, halfH, halfH, -halfH, 0.1, 200, THREE.WebGLCoordinateSystem);
  const m = new THREE.Matrix4().multiplyMatrices(proj, inv).elements;
  const { cov, owner } = rasterise(tris, parts, { m, half: RES / 2 }, RES);
  let top = Infinity, bot = -Infinity, left = Infinity, right = -Infinity, area = 0;
  let headTop = Infinity, headBot = -Infinity, headPx = 0;
  for (let y = 0; y < RES; y++) for (let x = 0; x < RES; x++) {
    const i = y * RES + x;
    if (!cov[i]) continue;
    const label = parts[owner[i]] || '';
    if (!/actor-body|actor-equipment/.test(label)) continue;
    area++;
    if (y < top) top = y; if (y > bot) bot = y;
    if (x < left) left = x; if (x > right) right = x;
    if (/\/head$|\/jaw$|\/crest|\/horn|\/snout/.test(label)) {
      headPx++; if (y < headTop) headTop = y; if (y > headBot) headBot = y;
    }
  }
  const H = bot - top + 1;
  const h = headPx ? (headBot - headTop + 1) : null;
  const S = MASK;
  const mask = new Uint8Array(S * S);
  const sc = H > 0 ? (S * 0.92) / H : 1;
  for (let y = 0; y < RES; y++) for (let x = 0; x < RES; x++) {
    const i = y * RES + x;
    if (!cov[i]) continue;
    const label = parts[owner[i]] || '';
    if (!/actor-body|actor-equipment/.test(label)) continue;
    const my = Math.round((y - top) * sc + S * 0.04);
    const mx = Math.round((x - (left + right) / 2) * sc + S / 2);
    if (my >= 0 && my < S && mx >= 0 && mx < S) mask[my * S + mx] = 1;
  }
  return { mask, figure_height_px: H, head_height_px: h, R: h ? +(H / h).toFixed(3) : null,
    silhouette_area_px: area, world_height_m: +worldH.toFixed(4) };
}

const iou = (a, b) => { let inter = 0, uni = 0; for (let i = 0; i < a.length; i++) { const x = a[i], y = b[i]; if (x || y) uni++; if (x && y) inter++; } return uni ? inter / uni : 0; };
const sha = (buf) => createHash('sha256').update(buf).digest('hex').slice(0, 16);

/** The vertex hash of a built body — the strongest "is this literally the same geometry" test. */
function bodyHash(group) {
  const h = createHash('sha256');
  group.traverse((o) => {
    if (!o.isMesh || !o.geometry || !o.geometry.attributes.position) return;
    const p = o.geometry.attributes.position.array;
    h.update(o.name || '');
    h.update(Buffer.from(Float32Array.from(p).buffer));
  });
  return h.digest('hex').slice(0, 16);
}

// ═══════════════════════════════════════════════════════════════════════════════════════════
// SELF-TEST — every arm required to be able to fail, and one that is required to DISAGREE
// ═══════════════════════════════════════════════════════════════════════════════════════════
if (args['self-test']) {
  const results = [];
  const sax = npcs.filter((n) => artFamilyForRace(n.race) === 'saxhleel');
  const hum = npcs.filter((n) => artFamilyForRace(n.race) === 'humanoid');

  // 1 — the pool table names no row that does not exist (fail-closed, per RULES.md 13/14).
  const pool = actorMod.characterPoolCensus();
  results.push({ arm: '1 RACE_POOL names only rows that exist', ok: pool.unknown_ids.length === 0, unknown: pool.unknown_ids });

  // 2 — the same person, built five times, is the same body to the vertex.
  const rec = sax[7];
  const hs = new Set(); const ids = new Set();
  for (let i = 0; i < 5; i++) { const b = build(rec); hs.add(bodyHash(b.group)); ids.add(b.id); }
  results.push({ arm: '2 one eid built five times is bit-identical', ok: hs.size === 1 && ids.size === 1, distinct_vertex_hashes: hs.size, id: [...ids][0] });

  // 3 — REQUIRED TO DISAGREE. Two different eids in the same family must NOT all be one body.
  const bodies = new Set(sax.slice(0, 80).map((n) => build(n).id));
  results.push({ arm: '3 eighty saxhleel records do not all build one body', ok: bodies.size > 8, distinct: bodies.size });

  // 4 — the cut layer does something. Same archetype, three cuts, three different vertex hashes.
  const arch = 'sax.marsh-lean';
  const cutHashes = {};
  for (const cut of ['wiry', 'asbuilt', 'thickset']) {
    const g = actorMod.makeRiggedActor(mats, 0x8f9aa6, 0x8d9a72, 'saxhleel', 'saxhleel');
    g.name = 'npc:probe'; g.userData.actor.characterId = cut === 'asbuilt' ? arch : `${arch}~${cut}`;
    actorMod.poseFromRig(g, BODY);
    cutHashes[cut] = bodyHash(g);
  }
  results.push({ arm: '4 three cuts of one archetype are three different geometries',
    ok: new Set(Object.values(cutHashes)).size === 3, hashes: cutHashes });

  // 6 — REQUIRED TO DISAGREE. Race scoping actually changes which pool a record draws from: a
  //     `naga` record must land on a naga row and an `imperial` one must not reach a naga row.
  const nagaRec = npcs.find((n) => String(n.race).toLowerCase() === 'naga');
  const nagaId = nagaRec ? build(nagaRec).id : null;
  const nagaUnscoped = nagaRec ? build(nagaRec, { scopeRace: false }).id : null;
  const impIds = new Set(npcs.filter((n) => n.race === 'imperial').slice(0, 40).map((n) => build(n).archetype));
  results.push({ arm: '6 race scoping reaches the pool', ok: !!nagaId && /naga/.test(nagaId) && ![...impIds].some((i) => /naga/.test(i)),
    naga_scoped: nagaId, naga_unscoped: nagaUnscoped, imperial_archetypes: [...impIds] });

  // 5 — THE STOOP HAS TWO CONSUMERS, and this arm is required to fail if either half is deleted.
  //     (a) geometry: a stooped row's vertices differ from the same row with stoop removed.
  //     (b) posture: `addCharacterPosture` writes non-zero rotations for stoop>0 and ZERO for 0.
  //     A TRUE ABLATION, not two different rows compared: one probe row is registered twice,
  //     identical in every morph axis except `stoop`, and driven through the shipped selection
  //     path by `characterId`. If `buildSkeleton` stopped reading `M.stoop` the two hashes would
  //     become equal and this arm goes red — which two hand-picked archetypes could never do.
  const { registerCharacter } = await import(pathToFileURL(join(ROOT, 'game/src/render/lib/rigs.js')).href);
  const baseMorph = { build: 0.94, shoulders: 0.86, belly: 1.20, neck: 0.80, hand: 1.02, head: 1.02, crest: 0.20, snout: 1.06 };
  registerCharacter('probe.stoop0', { base: 'base.saxhleel', morph: { ...baseMorph, stoop: 0 }, material: { skin: 0x9d9e83, cloth: 0x59543f, palette: 'eastern-rootlands', wear: 0.95 }, clips: 'clipset.civilian' });
  registerCharacter('probe.stoop1', { base: 'base.saxhleel', morph: { ...baseMorph, stoop: 1.25 }, material: { skin: 0x9d9e83, cloth: 0x59543f, palette: 'eastern-rootlands', wear: 0.95 }, clips: 'clipset.civilian' });
  const probe = (id) => {
    const g = actorMod.makeRiggedActor(mats, 0x8f9aa6, 0x8d9a72, 'saxhleel', 'saxhleel');
    g.name = 'npc:sp'; g.userData.actor.characterId = id;
    actorMod.poseFromRig(g, BODY);
    return g;
  };
  const gStoop = probe('probe.stoop1');
  const gFlat = probe('probe.stoop0');
  const geomDiffers = bodyHash(gStoop) !== bodyHash(gFlat);
  const stoopSil = silhouette(gStoop, 90), flatSil = silhouette(gFlat, 90);
  const stoopIoU = +iou(stoopSil.mask, flatSil.mask).toFixed(4);
  const index = new Map(boneIds.map((id, i) => [id, i]));
  const bufOn = { rx: new Float64Array(boneIds.length), ry: new Float64Array(boneIds.length), rz: new Float64Array(boneIds.length) };
  const bufOff = { rx: new Float64Array(boneIds.length), ry: new Float64Array(boneIds.length), rz: new Float64Array(boneIds.length) };
  actorMod.addCharacterPosture(bufOn, index, { stoop: 1.25 });
  actorMod.addCharacterPosture(bufOff, index, { stoop: 0 });
  const sumOn = bufOn.rx.reduce((a, b) => a + Math.abs(b), 0);
  const sumOff = bufOff.rx.reduce((a, b) => a + Math.abs(b), 0);
  results.push({ arm: '5 the age axis has BOTH consumers (geometry and posture)',
    ok: geomDiffers && sumOn > 1 && sumOff === 0,
    geometry_differs: geomDiffers, geometry_only_side_iou_stoop1_vs_stoop0: stoopIoU,
    posture_deg_sum_stoop_1p25: +sumOn.toFixed(3), posture_deg_sum_stoop_0: sumOff });

  // 7 — the roster is what the files say it is.
  results.push({ arm: '7 roster enumerated from the shipped files', ok: N === 408 && files.length === 18, records: N, files: files.length });

  // 8 — REQUIRED TO DISAGREE. The silhouette instrument must separate two bodies that a viewer
  //     would separate, and must return 1.0000 for a body against itself. A discriminator that
  //     cannot return 1.0000 on an identity is not measuring overlap.
  const a = build(sax[3]); const b = build(hum[3]);
  const sa = silhouette(a.group, 0); const sb = silhouette(b.group, 0);
  const selfIoU = +iou(sa.mask, sa.mask).toFixed(4);
  const crossIoU = +iou(sa.mask, sb.mask).toFixed(4);
  results.push({ arm: '8 IoU reads 1.0000 on an identity and < 1 across families', ok: selfIoU === 1 && crossIoU < 0.98,
    self: selfIoU, cross: crossIoU, note: 'the identity arm is NOT the control — it is the calibration; the control is the collapsed-cut roster in the main run' });

  const pass = results.every((r) => r.ok);
  console.log(JSON.stringify({ tool: 'f10-r13-body-census --self-test', results, pass }, null, 2));
  process.exit(pass ? 0 : 1);
}

// ═══════════════════════════════════════════════════════════════════════════════════════════
// THE MAIN RUN
// ═══════════════════════════════════════════════════════════════════════════════════════════
function rosterCensus(opts) {
  const rows = npcs.map((n, i) => {
    const b = build(n, opts);
    return { i, id: n.id, race: n.race || 'none', settlement: n.settlement || (n.post && n.post.settlement) || 'none',
      pos: (n.post && Array.isArray(n.post.pos)) ? n.post.pos : null,
      body: b.id, archetype: b.archetype, cut: b.cut, key: b.variantKey, morph: b.morph };
  });
  const byBody = new Map(); const byKey = new Map();
  for (const r of rows) {
    byBody.set(r.body, (byBody.get(r.body) || 0) + 1);
    byKey.set(r.key, (byKey.get(r.key) || 0) + 1);
  }
  const largest = [...byBody.entries()].sort((a, b) => b[1] - a[1])[0];
  // E4 — identical (body, race) pairs within 15 m in one settlement.
  const bySet = new Map();
  for (const r of rows) { if (!r.pos) continue; if (!bySet.has(r.settlement)) bySet.set(r.settlement, []); bySet.get(r.settlement).push(r); }
  let pairs = 0; const perSet = [];
  for (const [s, list] of bySet) {
    let p = 0;
    for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
      const d = Math.hypot(list[i].pos[0] - list[j].pos[0], list[i].pos[2] - list[j].pos[2]);
      if (d <= 15 && list[i].body === list[j].body && list[i].race === list[j].race) p++;
    }
    pairs += p; perSet.push({ settlement: s, placed: list.length, identical_pairs_within_15m: p });
  }
  // E3 — build bands, over the body as BUILT.
  const bands = new Set();
  for (const r of rows) {
    const b = r.morph.build === undefined ? 1 : Number(r.morph.build);
    if (b < 0.70) bands.add('child'); else if (b < 0.92) bands.add('slight');
    else if (b <= 1.08) bands.add('average'); else bands.add('heavy');
    if (Number(r.morph.stoop || 0) > 0.01) bands.add('stooped-old');
  }
  return {
    records: rows.length,
    distinct_bodies: byBody.size,
    distinct_structural_keys: byKey.size,
    names_beyond_keys: byBody.size - byKey.size,
    npcs_per_body: +(rows.length / byBody.size).toFixed(3),
    required_at_this_n: Math.ceil(rows.length / 12),
    largest_bucket: { body: largest[0], n: largest[1], pct: +(100 * largest[1] / rows.length).toFixed(2) },
    ceiling_at_this_n: Math.floor(rows.length * 0.10),
    E1_rendered_arm: (byBody.size >= Math.ceil(rows.length / 12) && largest[1] <= Math.floor(rows.length * 0.10)) ? 'pass' : 'fail',
    E3_bands: [...bands].sort(), E3: bands.size >= 4 ? 'pass' : 'fail',
    E4_identical_pairs_within_15m: pairs, E4: pairs === 0 ? 'pass' : 'fail',
    E4_per_settlement: perSet.sort((a, b) => b.identical_pairs_within_15m - a.identical_pairs_within_15m),
    body_census: [...byBody.entries()].sort((a, b) => b[1] - a[1]).map(([b, n]) => ({ body: b, n })),
    _rows: rows,
  };
}

const shipped = rosterCensus({});
// THE NULL CONTROL. Cuts collapsed, race scoping off — the pre-round-13 selection rule, run
// through the SAME code. It must produce fewer bodies and a worse silhouette spread, or round 13
// changed nothing that this instrument can see.
const control = rosterCensus({ scopeRace: false, forceCut: true });

// ── the silhouette discriminator, over the DISTINCT bodies actually drawn ────────────────────
const distinct = [...new Map(shipped._rows.map((r) => [r.body, r])).values()];
const distinctControl = [...new Map(control._rows.map((r) => [r.body, r])).values()];

function measureSet(rows, opts) {
  const out = [];
  for (const r of rows) {
    // THE RECORD BY INDEX, NOT BY ID — and this line is a finding, not a style choice.
    // `npcs.find((n) => n.id === r.id)` was here first, and it silently built the WRONG body for
    // 16 of the 408 records, because **16 ids are duplicated across the shipped files**: every
    // record in `game/data/npcs/quest-witnesses.json` repeats a person who already exists in
    // `mainline.json`, usually with a different race and a different settlement. The lookup
    // returned the first record with that id, so the mask stored under one body's name was
    // another body's mask — which is how a pair of genuinely different figures came back at
    // **IoU 1.0000** in this tool's own first run. The bodies were never the same; the
    // instrument was. `HAZARDS §30`'s family, and it was caught by the discriminator returning
    // an answer that could not be true rather than by reading the code.
    const rec = npcs[r.i];
    const b = build(rec, opts);
    const s0 = silhouette(b.group, 0), s90 = silhouette(b.group, 90);
    if (!s0 || !s90) continue;
    out.push({ body: r.body, race: r.race, R_front: s0.R, R_side: s90.R,
      figure_height_px: s0.figure_height_px, head_height_px: s0.head_height_px,
      world_height_m: s0.world_height_m, mask0: s0.mask, mask90: s90.mask });
  }
  return out;
}
function pairwise(set) {
  const all = [];
  for (const angle of ['mask0', 'mask90']) {
    for (let i = 0; i < set.length; i++) for (let j = i + 1; j < set.length; j++) {
      all.push({ angle: angle === 'mask0' ? 0 : 90, a: set[i].body, b: set[j].body, iou: +iou(set[i][angle], set[j][angle]).toFixed(4) });
    }
  }
  all.sort((x, y) => y.iou - x.iou);
  const v = all.map((p) => p.iou).sort((a, b) => a - b);
  return { pairs_n: all.length, median_iou: v.length ? v[Math.floor(v.length / 2)] : null,
    max_iou: all.length ? all[0].iou : null, pairs_at_or_above_0_93: all.filter((p) => p.iou >= 0.93).length,
    worst: all.slice(0, 15) };
}

const setShipped = measureSet(distinct, {});
const setControl = measureSet(distinctControl, { scopeRace: false, forceCut: true });
const c2Shipped = pairwise(setShipped);
const c2Control = pairwise(setControl);

// ── C1, the preservation clause: R = H/h on EVERY body drawn, not on a sample ────────────────
const Rs = setShipped.map((s) => s.R_front).filter((x) => x != null).sort((a, b) => a - b);
const C1 = {
  bodies_measured: Rs.length,
  R_min: Rs[0], R_median: Rs[Math.floor(Rs.length / 2)], R_max: Rs[Rs.length - 1],
  band: '7.0-8.0 (man/mer default) — hard fail outside 6.0-8.5',
  in_band_7_8: Rs.filter((r) => r >= 7.0 && r <= 8.0).length,
  in_hard_band_6_8_5: Rs.filter((r) => r >= 6.0 && r <= 8.5).length,
  pixel_numbers_published: setShipped.slice(0, 200).map((s) => ({ body: s.body, H_px: s.figure_height_px, h_px: s.head_height_px, R: s.R_front })),
};
C1.verdict = (C1.in_band_7_8 === Rs.length) ? 'PASS' : (C1.in_hard_band_6_8_5 === Rs.length ? 'PASS-outside-default-band' : 'FAIL');

const strip = (o) => { const { _rows, ...rest } = o; return rest; };
const out = {
  tool: 'f10-r13-body-census.mjs', role: 'builder, W1-F10-r13', generated: new Date().toISOString(),
  item: 'RI-VIS10 E1/E3/E4 + C1/C2 preservation',
  enumeration: { command: 'readdirSync(game/data/npcs).filter(.json), walk every record with an `id`', files: files.length, records: N },
  pool_census: actorMod.characterPoolCensus(),
  shipped: strip(shipped),
  null_control_cuts_collapsed_race_scoping_off: strip(control),
  control_is_required_to_disagree: {
    bodies_shipped: shipped.distinct_bodies, bodies_control: control.distinct_bodies,
    pairs_shipped: shipped.E4_identical_pairs_within_15m, pairs_control: control.E4_identical_pairs_within_15m,
    max_iou_shipped: c2Shipped.max_iou, max_iou_control: c2Control.max_iou,
    ok: control.distinct_bodies < shipped.distinct_bodies && control.E4_identical_pairs_within_15m > shipped.E4_identical_pairs_within_15m,
    what_would_turn_this_red: 'a cut layer that composes to the archetype, or race scoping that reaches no pool — either would make the control equal the shipped arm',
  },
  C1_preservation: C1,
  C2_silhouette_discriminator: { note: 'pose held IDENTICAL across every body; masks height-normalised to ' + MASK + ' px, so a uniform scale cannot move this number', shipped: c2Shipped, control: c2Control },
};
if (args.json && args.json !== true) writeFileSync(resolve(ROOT, args.json), `${JSON.stringify(out, null, 2)}\n`);
console.log(JSON.stringify({ ...out, C1_preservation: { ...C1, pixel_numbers_published: `${C1.pixel_numbers_published.length} rows in the JSON` },
  C2_silhouette_discriminator: { shipped: { ...c2Shipped, worst: c2Shipped.worst.slice(0, 6) }, control: { ...c2Control, worst: c2Control.worst.slice(0, 4) } },
  shipped: { ...strip(shipped), body_census: `${shipped.distinct_bodies} rows in the JSON`, E4_per_settlement: shipped.E4_per_settlement },
  null_control_cuts_collapsed_race_scoping_off: { ...strip(control), body_census: `${control.distinct_bodies} rows in the JSON`, E4_per_settlement: undefined } }, null, 2));
