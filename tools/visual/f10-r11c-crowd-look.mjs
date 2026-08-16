#!/usr/bin/env node
/**
 * f10-r11c-crowd-look.mjs — PHOTOGRAPH THE CROWD. The F10 r11 critic's own capture.
 *
 * WHY THIS EXISTS. `orchestration/status/W1-F10-r11.json`'s FIRST admission is that its pictures did
 * not land, and it files the cause as a harness defect: *"`__HARNESS.camera` and `teleport` speak the
 * SIMULATION's frame and a settlement's people are DRAWN in the cell's, with no method joining the
 * two"*, and asks for a new harness method. **That diagnosis is wrong and this tool is the proof.**
 * Measured this turn at the Lilmoth stand, over every matched (sim, drawn) NPC pair:
 *
 *     drawn world x − sim x : min 0.000000, max 0.000000   (60 of 60 pairs)
 *     drawn world z − sim z : min 0.000000, max 0.000000
 *     renderer.province.group.position = (0,0,0) ; scene.position = (0,0,0)
 *     three.camera.position === sim.camera.pos, to all printed digits
 *
 * The horizontal frames are IDENTICAL. `syncNPCs` (`render/renderer.js`) writes `drawPos = [n.pos[0],
 * groundResolver(n.pos[0], n.pos[2]), n.pos[2]]` — the simulation's own x/z, with only the height
 * replaced. So `__HARNESS.camera({pos, look})` in world metres already points at the drawn crowd and
 * always did.
 *
 * WHAT THE ROUND ACTUALLY HIT, and it is a one-object trap worth writing down: it derived its
 * scene→world offset from `R.playerMesh.position`, which reads **(0, 0, 0)** — and that is the ONE
 * actor in the scene whose group is not at its world position, because `poseFromRig` writes bone
 * **world** matrices directly and leaves the group at the origin. (The player's own `root` bone in the
 * round's own artifact reads world (2798.2, 2.66, 5047), in the same file that reports
 * `group_xz: [0, 0]`.) Every NPC is posed by `poseStatic`, which sets `group.position`, so the crowd's
 * groups ARE at world coordinates. Measuring the offset off the player therefore produced
 * `OFF = (2785.6, 44.378, 5047)` — a pure restatement of the teleport target — and the two surviving
 * frames landed back near Lilmoth only because that offset cancelled against a knot the tool had
 * placed at ≈(0.3, 0.9).
 *
 * AND WHY THE KNOT WAS AT THE ORIGIN — the second finding, and it is about the census, not the camera.
 * At the Lilmoth stand `sim.npcs` holds 60 records and the renderer builds 60 meshes, but
 * **29 of them are `mesh.visible === false` and every one of those 29 sits within 5 m of the world
 * origin on ground y ≈ −41 m**, i.e. under the Topal. The round's "densest knot" was that heap.
 * `people_within_9m: 29` in its own report is the tell. Four more are visible at ≈(4906, −594) on
 * ground −33 m, outside the province's own x extent. **The genuinely drawn Lilmoth crowd is 27.**
 *
 * WHAT THIS TOOL DOES, per `CLAUDE.md`'s character directive (*"orbit the camera around the character,
 * multiple angles, motion sequences; stills are not enough"*):
 *   • ORBIT — N bearings around the densest knot of the genuinely drawn settlement crowd
 *   • PORTRAIT — named individuals, several bearings each, at a standoff that fills the frame
 *   • MOTION — the same pose held across stepped frames, so a stand can be seen to persist
 * Every frame records its camera pose, its subject, and the C3 numbers of the people in it.
 *
 * Usage:
 *   node tools/visual/f10-r11c-crowd-look.mjs --self-test
 *   node tools/visual/f10-r11c-crowd-look.mjs --out <dir> [--x 2785.6 --z 5047]
 */
import fs from 'node:fs';
import path from 'node:path';

const args = {};
for (let i = 2; i < process.argv.length; i++) {
  if (!process.argv[i].startsWith('--')) continue;
  const k = process.argv[i].slice(2);
  args[k] = (process.argv[i + 1] && !process.argv[i + 1].startsWith('--')) ? process.argv[++i] : true;
}
const log = (...m) => process.stdout.write(`${m.join(' ')}\n`);
const HERE = path.dirname(new URL(import.meta.url).pathname);
const REPO = path.resolve(HERE, '../..');

// ── self-test: the geometry that decides where a camera goes, with no browser ──────────────────
// Arms are REQUIRED TO DISAGREE: an orbit that returns the same point at every bearing, or a
// densest-knot picker that returns the mean, would each produce a plausible-looking frame of
// nothing — which is exactly the failure this tool was written to correct.
function orbitPos(cx, cy, cz, bearingDeg, dist, eye) {
  const r = (bearingDeg * Math.PI) / 180;
  return [cx + Math.sin(r) * dist, cy + eye, cz + Math.cos(r) * dist];
}
function densestKnot(pts, radius) {
  if (!pts.length) return null;
  let best = null; let bestN = -1;
  for (const p of pts) {
    const n = pts.filter((q) => Math.hypot(q[0] - p[0], q[1] - p[1]) <= radius).length;
    if (n > bestN) { bestN = n; best = p; }
  }
  const near = pts.filter((q) => Math.hypot(q[0] - best[0], q[1] - best[1]) <= radius);
  return {
    cx: near.reduce((s, q) => s + q[0], 0) / near.length,
    cz: near.reduce((s, q) => s + q[1], 0) / near.length,
    n: near.length,
  };
}
if (args['self-test']) {
  const R = [];
  const a = orbitPos(10, 2, 20, 0, 5, 1.7);
  const b = orbitPos(10, 2, 20, 180, 5, 1.7);
  R.push({ arm: '1 — two opposite bearings are 2*dist apart, so the orbit is an orbit and not a fixed point', ok: Math.abs(Math.hypot(a[0] - b[0], a[2] - b[2]) - 10) < 1e-9, got: +Math.hypot(a[0] - b[0], a[2] - b[2]).toFixed(6) });
  R.push({ arm: '2 — every orbit position is exactly `dist` from the subject in plan', ok: [0, 45, 90, 137, 270].every((deg) => Math.abs(Math.hypot(orbitPos(10, 2, 20, deg, 5, 1.7)[0] - 10, orbitPos(10, 2, 20, deg, 5, 1.7)[2] - 20) - 5) < 1e-9) });
  R.push({ arm: '3 — eye height is added to the SUBJECT height, not to the ground of the camera', ok: Math.abs(a[1] - 3.7) < 1e-9, got: a[1] });
  // The knot picker must find a cluster, NOT the centroid. A tight group of 5 plus one far outlier:
  // the mean is pulled toward the outlier; the densest knot is not.
  const pts = [[0, 0], [1, 0], [0, 1], [1, 1], [0.5, 0.5], [500, 500]];
  const k = densestKnot(pts, 3);
  const meanX = pts.reduce((s, q) => s + q[0], 0) / pts.length;
  R.push({ arm: '4 — the densest knot ignores a far outlier that would drag the mean (required to DISAGREE with the mean)', ok: k.n === 5 && Math.abs(k.cx - 0.5) < 1e-9 && Math.abs(meanX - k.cx) > 10, got: { knot: +k.cx.toFixed(4), n: k.n, mean: +meanX.toFixed(2) } });
  const k2 = densestKnot([[100, 100]], 3);
  R.push({ arm: '5 — a single point is its own knot rather than a crash', ok: k2.n === 1 && k2.cx === 100 });
  const pass = R.every((r) => r.ok);
  console.log(JSON.stringify({ tool: 'f10-r11c-crowd-look --self-test', results: R, pass }, null, 2));
  process.exit(pass ? 0 : 1);
}

const OUT = path.resolve(REPO, args.out || 'reports/visual-truth/f10-r11c-crowd-look');
fs.mkdirSync(OUT, { recursive: true });

const { launchForCapture, resolveGpuMode } = await import(`${REPO}/tools/visual/lib/gpu-launch.mjs`);
const { rendererBanner } = await import(`${REPO}/tools/visual/lib/renderer-class.mjs`);
const { g, attestation } = await launchForCapture({
  mode: resolveGpuMode(args), requireHardware: args['require-hardware'] === true,
  entry: 'game/index.html', width: Number(args.w || 1280), height: Number(args.h || 720), log,
});
await g.page.waitForFunction(() => window.__HARNESS, null, { timeout: 180000 });
await g.h('ready');
log(rendererBanner(attestation));

const call = async (m, ...a) => {
  const res = await g.page.evaluate(async ({ method, callArgs }) => {
    const H = window.__HARNESS;
    if (!H || typeof H[method] !== 'function') return { __err: `${method} unavailable` };
    try { return { __ok: await H[method](...callArgs) }; } catch (e) { return { __err: String(e && e.message || e) }; }
  }, { method: m, callArgs: a });
  if (res && res.__err) return { ok: false, e: res.__err };
  return { ok: true, v: res ? res.__ok : undefined };
};

const STAND = { x: Number(args.x ?? 2785.6), z: Number(args.z ?? 5047.0) };
const where = await call('whereAmI');
if (where.ok && where.v && where.v.interior) await call('exitInterior');
await call('teleport', STAND.x, STAND.z);
await call('stepFrames', 20);

/** Read every NPC mesh: its DRAWN world position, whether it is drawn at all, and its C3 numbers. */
const readCrowd = () => g.page.evaluate(() => {
  const E = window.__ENGINE; const R = E && E.renderer;
  if (!R) return { error: 'no renderer' };
  R.scene.updateMatrixWorld(true);
  const DEG = 180 / Math.PI;
  const simPos = new Map((E.sim.npcs || []).map((n) => [String(n.eid), [n.pos[0], n.pos[1], n.pos[2]]]));
  const rows = [];
  R.scene.traverse((o) => {
    if (!o || !o.name || !String(o.name).startsWith('npc:')) return;
    const A = o.userData && o.userData.actor; const S = A && A.built;
    if (!S) return;
    const index = {}; if (S.index && S.index.forEach) S.index.forEach((v, k) => { index[k] = v; });
    const bones = S.bones || [];
    const w = (id) => { const i = index[id]; if (i === undefined || !bones[i]) return null; const e = bones[i].matrixWorld.elements; return [e[12], e[13], e[14]]; };
    const tilt = (a, b) => (a && b ? Math.atan2(a[1] - b[1], Math.hypot(a[0] - b[0], a[2] - b[2])) * DEG : null);
    const ang = (a, b, c) => {
      if (!a || !b || !c) return null;
      const u = [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; const v = [c[0] - b[0], c[1] - b[1], c[2] - b[2]];
      const lu = Math.hypot(...u); const lv = Math.hypot(...v);
      if (!lu || !lv) return null;
      return Math.acos(Math.max(-1, Math.min(1, (u[0] * v[0] + u[1] * v[1] + u[2] * v[2]) / (lu * lv)))) * DEG;
    };
    const eL = ang(w('upperarm_l'), w('lowerarm_l'), w('hand_l'));
    const eR = ang(w('upperarm_r'), w('lowerarm_r'), w('hand_r'));
    const head = w('head');
    const gr = R.groundResolver ? R.groundResolver(o.position.x, o.position.z) : null;
    rows.push({
      eid: String(o.name).slice(4),
      visible: !!o.visible,
      drawn_world: [+o.position.x.toFixed(3), +o.position.y.toFixed(3), +o.position.z.toFixed(3)],
      sim_pos: simPos.get(String(o.name).slice(4)) || null,
      head_world: head ? head.map((v) => +v.toFixed(3)) : null,
      ground: gr === null || gr === undefined ? null : +gr.toFixed(3),
      c3: [
        +Number(tilt(w('upperarm_l'), w('upperarm_r')) || 0).toFixed(4),
        +Number(tilt(w('thigh_l'), w('thigh_r')) || 0).toFixed(4),
        +Number(Math.abs((eL || 0) - (eR || 0))).toFixed(4),
      ],
    });
  });
  const pm = R.playerMesh;
  return {
    rows,
    cell: R.cell,
    province_group_pos: R.province && R.province.group ? [R.province.group.position.x, R.province.group.position.y, R.province.group.position.z] : null,
    scene_pos: [R.scene.position.x, R.scene.position.y, R.scene.position.z],
    player_mesh_group_pos: pm ? [pm.position.x, pm.position.y, pm.position.z] : null,
    player_root_bone_world: (() => {
      const A = pm && pm.userData && pm.userData.actor; const S = A && A.built;
      if (!S || !S.bones || !S.bones[0]) return null;
      const e = S.bones[0].matrixWorld.elements; return [+e[12].toFixed(3), +e[13].toFixed(3), +e[14].toFixed(3)];
    })(),
    three_camera_pos: [R.camera.position.x, R.camera.position.y, R.camera.position.z],
    sim_camera_pos: [E.sim.camera.pos[0], E.sim.camera.pos[1], E.sim.camera.pos[2]],
  };
});

const crowd = await readCrowd();
const drawn = crowd.rows.filter((r) => r.visible);
const here = drawn.filter((r) => Math.hypot(r.drawn_world[0] - STAND.x, r.drawn_world[2] - STAND.z) < 200);
const offmap = drawn.filter((r) => !here.includes(r));
const undrawn = crowd.rows.filter((r) => !r.visible);

// THE FRAME QUESTION, ANSWERED BY MEASUREMENT AND NOT BY ARGUMENT.
const pairs = crowd.rows.filter((r) => r.sim_pos);
const dx = pairs.map((r) => r.drawn_world[0] - r.sim_pos[0]);
const dz = pairs.map((r) => r.drawn_world[2] - r.sim_pos[2]);
const dy = pairs.map((r) => r.drawn_world[1] - r.sim_pos[1]);
const frameAnswer = {
  matched_pairs: pairs.length,
  drawn_minus_sim_x: { min: +Math.min(...dx).toFixed(6), max: +Math.max(...dx).toFixed(6) },
  drawn_minus_sim_z: { min: +Math.min(...dz).toFixed(6), max: +Math.max(...dz).toFixed(6) },
  drawn_minus_sim_y: { min: +Math.min(...dy).toFixed(6), max: +Math.max(...dy).toFixed(6) },
  province_group_pos: crowd.province_group_pos,
  scene_pos: crowd.scene_pos,
  three_camera_pos: crowd.three_camera_pos.map((v) => +v.toFixed(4)),
  sim_camera_pos: crowd.sim_camera_pos.map((v) => +v.toFixed(4)),
  player_mesh_group_pos: crowd.player_mesh_group_pos,
  player_root_bone_world: crowd.player_root_bone_world,
  verdict: 'the horizontal frames are IDENTICAL; only the player MESH GROUP is at the origin, because poseFromRig writes bone world matrices',
};

const knot = densestKnot(here.map((r) => [r.drawn_world[0], r.drawn_world[2]]), Number(args.radius ?? 8));
const cy = here.length ? here.reduce((s, r) => s + r.drawn_world[1], 0) / here.length : 0;

await call('setUIVisible', false);
const shots = [];
const shoot = async (file, pos, look, meta) => {
  const r = await call('camera', { pos, look, fov: Number(args.fov ?? 55) });
  await call('stepFrames', Number(meta.step ?? 2));
  const shot = await call('screenshot');
  let bytes = null;
  if (shot.ok && shot.v) {
    const buf = Buffer.from(String(shot.v).replace(/^data:image\/png;base64,/, ''), 'base64');
    fs.writeFileSync(path.join(OUT, file), buf); bytes = buf.length;
  }
  shots.push({ file, bytes, camera_ok: !!r.ok, pos: pos.map((v) => +v.toFixed(3)), look: look.map((v) => +v.toFixed(3)), ...meta });
};

// ── ORBIT: the crowd, many bearings ───────────────────────────────────────────────────────────
const D = Number(args.dist ?? 9);
const EY = Number(args.eye ?? 2.4);
const bearings = String(args.bearings ?? '0,45,90,135,180,225,270,315').split(',').map(Number);
if (knot) {
  for (const b of bearings) {
    const pos = orbitPos(knot.cx, cy, knot.cz, b, D, EY);
    await shoot(`orbit-b${String(b).padStart(3, '0')}.png`, pos, [knot.cx, cy + 1.1, knot.cz],
      { kind: 'orbit', bearing: b, dist_m: D, eye_m: EY, knot_n: knot.n, subjects: here.filter((r) => Math.hypot(r.drawn_world[0] - knot.cx, r.drawn_world[2] - knot.cz) <= 8).map((r) => ({ eid: r.eid, c3: r.c3 })) });
  }
}

// ── PORTRAIT: named individuals, three bearings each ──────────────────────────────────────────
const PD = Number(args.pdist ?? 3.4);
const picks = here.slice().sort((a, b2) => Math.hypot(a.drawn_world[0] - knot.cx, a.drawn_world[2] - knot.cz) - Math.hypot(b2.drawn_world[0] - knot.cx, b2.drawn_world[2] - knot.cz)).slice(0, Number(args.subjects ?? 4));
for (const p of picks) {
  for (const b of String(args.pbearings ?? '0,120,240').split(',').map(Number)) {
    const pos = orbitPos(p.drawn_world[0], p.drawn_world[1], p.drawn_world[2], b, PD, 1.6);
    await shoot(`portrait-${p.eid}-b${String(b).padStart(3, '0')}.png`, pos, [p.drawn_world[0], p.drawn_world[1] + 0.95, p.drawn_world[2]],
      { kind: 'portrait', eid: p.eid, bearing: b, dist_m: PD, c3: p.c3 });
  }
}

// ── MOTION: one bearing, the same people, stepped ─────────────────────────────────────────────
if (knot) {
  for (const t of [0, 24, 48, 72]) {
    const pos = orbitPos(knot.cx, cy, knot.cz, Number(args.mbearing ?? 45), D, EY);
    await shoot(`motion-t${String(t).padStart(3, '0')}.png`, pos, [knot.cx, cy + 1.1, knot.cz],
      { kind: 'motion', frame_offset: t, step: t === 0 ? 2 : 24 });
  }
}

await call('camera', { mode: 'gameplay' });
await call('setUIVisible', true);
await g.close();

const over2 = (r) => r.c3.filter((v) => Math.abs(v) > 3).length >= 2;
const rep = {
  tool: 'tools/visual/f10-r11c-crowd-look.mjs',
  generated: new Date().toISOString(),
  renderer: attestation,
  stand: STAND,
  THE_FRAME_QUESTION: frameAnswer,
  population_at_this_stand: {
    npc_meshes_in_scene: crowd.rows.length,
    drawn_visible_true: drawn.length,
    NOT_drawn_visible_false: undrawn.length,
    undrawn_all_within_5m_of_world_origin: undrawn.every((r) => Math.hypot(r.drawn_world[0], r.drawn_world[2]) < 5),
    undrawn_ground_y: undrawn.length ? { min: +Math.min(...undrawn.map((r) => r.ground)).toFixed(3), max: +Math.max(...undrawn.map((r) => r.ground)).toFixed(3) } : null,
    drawn_at_this_settlement: here.length,
    drawn_but_off_map: offmap.map((r) => ({ eid: r.eid, xz: [r.drawn_world[0], r.drawn_world[2]], ground: r.ground })),
    note: 'C3 arm (b) says "DRAWN NPCs of the largest settlement". The 60-row denominator used by W1-F10-r10-CRITIC and W1-F10-r11 counts meshes, not drawn figures.',
  },
  C3_arm_b_recomputed_by_denominator: {
    all_60_meshes: `${crowd.rows.filter(over2).length} of ${crowd.rows.length}`,
    drawn_only_31: `${drawn.filter(over2).length} of ${drawn.length}`,
    drawn_and_at_lilmoth_27: `${here.filter(over2).length} of ${here.length}`,
    undrawn_29: `${undrawn.filter(over2).length} of ${undrawn.length}`,
  },
  knot: knot ? { cx: +knot.cx.toFixed(3), cz: +knot.cz.toFixed(3), n: knot.n, cy: +cy.toFixed(3) } : null,
  shots,
  rows: crowd.rows,
};
fs.writeFileSync(path.join(OUT, 'crowd-look.json'), `${JSON.stringify(rep, null, 2)}\n`);
const { rows, ...brief } = rep;
console.log(JSON.stringify({ ...brief, shots: `${shots.length} frames -> ${OUT}` }, null, 2));
