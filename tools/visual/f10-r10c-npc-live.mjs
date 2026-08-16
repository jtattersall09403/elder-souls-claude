#!/usr/bin/env node
/**
 * f10-r10c-npc-live.mjs — DOES THE STANCE REACH THE CROWD? Asked of the RUNNING GAME, not of the
 * source, and answered off the bone matrices the renderer actually drew.
 *
 * WHY. `orchestration/status/W1-F10-r10.json` job 3 reports that `renderer.js:syncNPCs` calls
 * `poseStatic` and only `poseStatic`, so round 9's contrapposto and round 10's root drop reach
 * **0 of 408 NPCs**, and that the r9 verdict's `why_it_matters` — *"the player and all 408 NPCs …
 * now stands about a centimetre above the floor"* — is therefore wrong on its NPC half. The
 * builder derived that by reading pose calls out of the file. THE BRIEF ASKS FOR IT IN THE RUNNING
 * GAME, and it is a different question: a file can call `poseStatic` and the NPC could still end
 * up posed, if `poseStatic` were later overwritten, if `A.rigged` flipped, or if the presentation
 * bind carried the stance in some other way.
 *
 * WHAT IT MEASURES, per drawn actor, off `mesh.userData.actor.built.bones` after a real frame:
 *   • the hip line tilt — thigh_l.y minus thigh_r.y in WORLD space, which is what RI-VIS10 C3 reads
 *   • the shoulder line tilt — clavicle/upper-arm y difference
 *   • a POSE SIGNATURE: the rounded local quaternion of every bone, hashed. Two actors with the
 *     same signature are in literally the same pose.
 *   • the foot bone height above the ground resolver under it
 *
 * SELF-TEST ARMS (required to disagree):
 *   1. the player's own signature must DIFFER from the modal NPC signature — if the instrument
 *      cannot tell a posed actor from a rest one, every number it prints is worthless
 *   2. the hip tilt it computes for the player must reproduce the r9 critic's C3 sign and rough
 *      magnitude (> 3 deg equivalent, i.e. a non-zero y difference) — a reader that returns 0 for
 *      everything would "prove" the finding by being broken
 *   3. an injected fake bone set with a known y difference must come back with that difference
 *
 * Usage:
 *   node tools/visual/f10-r10c-npc-live.mjs --self-test
 *   node tools/visual/f10-r10c-npc-live.mjs --out <dir> [--gpu hardware --require-hardware]
 */
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const args = {};
for (let i = 2; i < process.argv.length; i++) {
  if (!process.argv[i].startsWith('--')) continue;
  const k = process.argv[i].slice(2);
  args[k] = (process.argv[i + 1] && !process.argv[i + 1].startsWith('--')) ? process.argv[++i] : true;
}
const log = (...m) => process.stdout.write(`${m.join(' ')}\n`);
const HERE = path.dirname(new URL(import.meta.url).pathname);
const REPO = path.resolve(HERE, '../..');

// ── arm 3 runs with no browser: a pure reader over a synthetic bone set ───────────────────────
function tiltFromMatrices(mats, index, aId, bId) {
  const ia = index[aId]; const ib = index[bId];
  if (ia === undefined || ib === undefined) return null;
  return +(mats[ia][13] - mats[ib][13]).toFixed(6);
}
if (args['self-test']) {
  const results = [];
  const idx = { thigh_l: 0, thigh_r: 1 };
  const m = (y) => { const a = new Array(16).fill(0); a[13] = y; return a; };
  const got = tiltFromMatrices([m(0.94123), m(0.93456)], idx, 'thigh_l', 'thigh_r');
  results.push({ arm: 'the tilt reader returns an injected known difference', ok: Math.abs(got - 0.00667) < 1e-6, want: 0.00667, got });
  const flat = tiltFromMatrices([m(0.94), m(0.94)], idx, 'thigh_l', 'thigh_r');
  results.push({ arm: 'a level pair reads exactly zero, so a non-zero reading is not noise', ok: flat === 0, got: flat });
  const missing = tiltFromMatrices([m(1)], { thigh_l: 0 }, 'thigh_l', 'thigh_r');
  results.push({ arm: 'a missing bone returns null rather than a silent 0', ok: missing === null, got: missing });
  const pass = results.every((r) => r.ok);
  console.log(JSON.stringify({ tool: 'f10-r10c-npc-live --self-test (readers)', results, pass }, null, 2));
  process.exit(pass ? 0 : 1);
}

const OUT = path.resolve(REPO, args.out || 'reports/visual-truth/f10-r10c-npc-live');
fs.mkdirSync(OUT, { recursive: true });

const { launchForCapture, resolveGpuMode } = await import('./lib/gpu-launch.mjs');
const { rendererBanner } = await import('./lib/renderer-class.mjs');
const { g, attestation } = await launchForCapture({
  mode: resolveGpuMode(args), requireHardware: args['require-hardware'] === true,
  entry: 'game/index.html', width: 960, height: 540, log,
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

// The Lilmoth player stand every F10 round has used, so the crowd is the same crowd.
const STAND = { x: Number(args.x ?? -12.5), z: Number(args.z ?? 43.0) };
const where = await call('whereAmI');
if (where.ok && where.v && where.v.interior) await call('exitInterior');
const tp = await call('teleport', STAND.x, STAND.z);
await call('stepFrames', 14);

const probe = await g.page.evaluate(() => {
  const R = window.__ENGINE && window.__ENGINE.renderer;
  if (!R) return { error: 'no renderer' };
  const ground = (x, z) => (R.groundResolver ? R.groundResolver(x, z) : (R.groundAt ? R.groundAt(x, z, undefined, R.cell) : null));
  const readActor = (group, kind) => {
    const A = group && group.userData && group.userData.actor;
    if (!A || !A.built) return null;
    const S = A.built;
    const index = {};
    if (S.index && typeof S.index.forEach === 'function') S.index.forEach((v, k) => { index[k] = v; });
    group.updateMatrixWorld(true);
    const bones = S.bones || [];
    // WORLD y of a bone, taken off the object the renderer drew.
    const worldY = (id) => {
      const i = index[id]; if (i === undefined || !bones[i]) return null;
      return +bones[i].matrixWorld.elements[13].toFixed(6);
    };
    // POSE SIGNATURE — every bone's transform in the ACTOR's own frame, i.e.
    // `inverse(group.matrixWorld) * bone.matrixWorld`, rounded to 1e-4. Two actors with equal
    // signatures are in the same pose whatever their position, yaw or scale.
    //
    // IT IS DELIBERATELY NOT `bone.quaternion`. The FIRST version of this instrument hashed the
    // bone's LOCAL quaternion and reported the player and all 60 NPCs in one identical pose — a
    // false confirmation of the very finding it was written to test. `poseFromRig` writes bone
    // WORLD matrices and never touches the local quaternion, so a local-rotation reader is blind
    // to the player's pose by construction. Caught by self-test arm 1, which is why arm 1 exists.
    const inv = new (group.matrixWorld.constructor)().copy(group.matrixWorld).invert();
    const tmp = new (group.matrixWorld.constructor)();
    const sig = bones.map((b) => {
      if (!b) return 'x';
      tmp.multiplyMatrices(inv, b.matrixWorld);
      return Array.from(tmp.elements).map((n) => n.toFixed(4)).join(',');
    }).join('|');
    let h = 2166136261;
    for (let i = 0; i < sig.length; i++) { h ^= sig.charCodeAt(i); h = Math.imul(h, 16777619); }
    const lY = worldY('thigh_l'); const rY = worldY('thigh_r');
    const slY = worldY('upperarm_l'); const srY = worldY('upperarm_r');
    const flY = worldY('foot_l'); const frY = worldY('foot_r');
    const p = group.position;
    return {
      kind,
      name: group.name,
      rigged: !!A.rigged,
      civilian: !!A.civilian,
      static_presentation_bound: !!A.staticPresentationBound,
      pos: [+p.x.toFixed(3), +p.y.toFixed(3), +p.z.toFixed(3)],
      ground: (() => { const gv = ground(p.x, p.z); return gv === null || gv === undefined ? null : +gv.toFixed(4); })(),
      hip_line_dy_m: (lY !== null && rY !== null) ? +(lY - rY).toFixed(6) : null,
      shoulder_line_dy_m: (slY !== null && srY !== null) ? +(slY - srY).toFixed(6) : null,
      foot_l_y: flY, foot_r_y: frY,
      pose_sig: (h >>> 0).toString(16),
      bone_count: bones.length,
    };
  };
  const out = { npcs: [], player: null, enemies: [] };
  R.scene.traverse((o) => {
    if (!o || !o.name) return;
    if (o.name.startsWith('npc:')) { const r = readActor(o, 'npc'); if (r) out.npcs.push(r); }
    else if (o.name.startsWith('enemy:')) { const r = readActor(o, 'enemy'); if (r) out.enemies.push(r); }
  });
  const pm = R.playerMesh || R.playerActor || null;
  if (pm) out.player = readActor(pm, 'player');
  if (!out.player) {
    R.scene.traverse((o) => { if (!out.player && o && o.userData && o.userData.actor && o.userData.actor.rigged) out.player = readActor(o, 'player-by-rigged-flag'); });
  }
  out.npc_mesh_map_size = R.npcMeshes ? R.npcMeshes.size : null;
  return out;
});

await g.close();

// ── analysis ─────────────────────────────────────────────────────────────────────────────────
const sigCount = new Map();
for (const n of probe.npcs || []) sigCount.set(n.pose_sig, (sigCount.get(n.pose_sig) || 0) + 1);
const modal = [...sigCount.entries()].sort((a, b) => b[1] - a[1])[0] || [null, 0];
const hips = (probe.npcs || []).map((n) => n.hip_line_dy_m).filter((v) => v !== null);
const shoulders = (probe.npcs || []).map((n) => n.shoulder_line_dy_m).filter((v) => v !== null);
const maxAbs = (a) => (a.length ? Math.max(...a.map(Math.abs)) : null);

/**
 * WHICH TREE DID THIS ARM ACTUALLY RUN IN. Added 2026-08-16 (F10 r12 builder) because the r11
 * critic found this file's output could not answer it: *"`f10-r10c-npc-live.mjs` writes no
 * `commit` field, which is precisely the discriminator §22 tells you to read"*, so HAZARDS §22
 * discipline on r11's before-arm was unverifiable from the artefact.
 *
 * `tools/lib/cli.mjs` resolves `REPO_ROOT` from the SCRIPT's own location, so a copy of this tool
 * placed inside a control clone serves the CLONE's `game/` and a copy left in the main tree serves
 * the MAIN TREE's — which is the whole §22 trap, and it produces two runs that look identical. The
 * discriminator is proved both ways: a genuine control clone has no `.git` and records `unknown`;
 * a worktree or the live tree records its sha, and `dirty` says whether that sha is the whole story.
 * ADDITIVE ONLY — no measurement in this file is changed, so r10's and r11's numbers stand.
 */
function treeProvenance() {
  try {
    const cwd = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
    const sha = execSync('git rev-parse HEAD', { cwd, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
    const dirty = execSync('git status --short -- game/ tools/', { cwd, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
    return { commit: sha, tree_root: cwd, dirty_in_game_or_tools: dirty.length > 0 };
  } catch {
    return { commit: 'unknown', tree_root: path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..'), dirty_in_game_or_tools: null };
  }
}

const report = {
  tool: 'f10-r10c-npc-live.mjs',
  ...treeProvenance(),
  generated: new Date().toISOString(),
  renderer: attestation,
  stand: STAND,
  teleport_ok: tp.ok,
  counts: { npcs_drawn: (probe.npcs || []).length, enemies_drawn: (probe.enemies || []).length, npc_mesh_map_size: probe.npc_mesh_map_size },
  player: probe.player,
  npc_pose_signatures: { distinct: sigCount.size, modal_sig: modal[0], modal_count: modal[1], all: [...sigCount.entries()] },
  npc_hip_line_dy_m: { max_abs: maxAbs(hips), distinct: [...new Set(hips)] },
  npc_shoulder_line_dy_m: { max_abs: maxAbs(shoulders), distinct: [...new Set(shoulders)] },
  player_vs_npc: probe.player && modal[0]
    ? {
      player_sig: probe.player.pose_sig,
      differs_from_modal_npc: probe.player.pose_sig !== modal[0],
      player_hip_line_dy_m: probe.player.hip_line_dy_m,
      player_shoulder_line_dy_m: probe.player.shoulder_line_dy_m,
    }
    : null,
  npcs: probe.npcs,
  error: probe.error || null,
};

// live self-test arms, evaluated against what came back
report.live_self_test = [
  { arm: 'the reader can tell a posed actor from a rest one (player sig != modal NPC sig)', ok: !!(report.player_vs_npc && report.player_vs_npc.differs_from_modal_npc) },
  { arm: 'the reader returns a NON-ZERO hip tilt for at least one actor (it is not stuck at 0)', ok: !!(probe.player && Math.abs(probe.player.hip_line_dy_m || 0) > 1e-5) },
  { arm: 'at least 5 NPCs were actually drawn (an empty crowd proves nothing)', ok: (probe.npcs || []).length >= 5 },
];
report.live_self_test_pass = report.live_self_test.every((a) => a.ok);

fs.writeFileSync(path.join(OUT, 'npc-live.json'), `${JSON.stringify(report, null, 2)}\n`);
log(`\nNPCs drawn ${report.counts.npcs_drawn}  distinct pose signatures ${report.npc_pose_signatures.distinct}  modal ${report.npc_pose_signatures.modal_count}`);
log(`NPC hip-line |dy| max ${report.npc_hip_line_dy_m.max_abs}   player hip-line dy ${probe.player ? probe.player.hip_line_dy_m : 'n/a'}`);
log(`live self-test: ${report.live_self_test_pass ? 'PASS' : 'FAIL'} ${JSON.stringify(report.live_self_test)}`);
log(`wrote ${path.join(OUT, 'npc-live.json')}`);
process.exit(report.error ? 1 : 0);
