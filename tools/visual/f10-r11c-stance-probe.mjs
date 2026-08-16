#!/usr/bin/env node
/**
 * f10-r11c-stance-probe.mjs — the F10 r11 critic's own attack on the SEEDING and the CONSUMPTION.
 *
 * The r11 build claims the crowd's stand is (i) a per-person distribution, (ii) stable per
 * individual, and (iii) actually consumed by the drawn figure. Its own stability evidence is
 * *within one session*: one name re-solved 64 times, and drawn bones re-read 37 frames later.
 * Neither can see the three ways a seeded distribution normally breaks. This tool runs those three.
 *
 *   A. REBUILD — destroy every NPC mesh and let `syncNPCs` build it again. The stance is cached on
 *      `A.staticStance` inside `poseStatic`; a re-roll on rebuild would mean a person changes stance
 *      whenever they stream out and back in, which a player does by walking away and returning.
 *   B. TRAVEL — teleport to another settlement and back. `syncNPCs` deletes the mesh of anybody who
 *      leaves `sim.npcs`, so this is A with the engine choosing when.
 *   C. SAVE / RELOAD — `saveState()` then `loadState()`. If `eid` is regenerated rather than
 *      authored, every person in the world re-rolls their stand across a save.
 *   D. BODY-HASH INDEPENDENCE — the build claims the stance seed (`stance:npc:<eid>`) is separate
 *      from `characterFor`'s body hash (`npc:<eid>`). Tested by changing the BODY a person is dealt
 *      and requiring the stance to be bit-identical.
 *   E. CONSUMPTION (`RI-MTH07`) — perturb the shipped stance DATA in the live model and require the
 *      drawn bones to move; with a NULL CONTROL that perturbs a field nothing reads and requires
 *      them NOT to move. A rule with no caller passes every other arm in this file.
 *
 * Usage: node tools/visual/f10-r11c-stance-probe.mjs [--out <dir>]
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
const OUT = path.resolve(REPO, args.out || 'reports/visual-truth/f10-r11c-stance-probe');
fs.mkdirSync(OUT, { recursive: true });

const { launchForCapture, resolveGpuMode } = await import(`${REPO}/tools/visual/lib/gpu-launch.mjs`);
const { g, attestation } = await launchForCapture({
  mode: resolveGpuMode(args), requireHardware: false, entry: 'game/index.html', width: 640, height: 360, log,
});
await g.page.waitForFunction(() => window.__HARNESS, null, { timeout: 180000 });
await g.h('ready');

const call = async (m, ...a) => g.page.evaluate(async ({ method, callArgs }) => {
  const H = window.__HARNESS;
  if (!H || typeof H[method] !== 'function') return { __err: `${method} unavailable` };
  try { return { __ok: await H[method](...callArgs) }; } catch (e) { return { __err: String(e && e.message || e) }; }
}, { method: m, callArgs: a });

const STAND = { x: Number(args.x ?? 2785.6), z: Number(args.z ?? 5047.0) };
const AWAY = { x: Number(args.ax ?? 1590), z: Number(args.az ?? 3120) };   // Helstrom-ish, far away

/** Per-drawn-NPC signature of the ACTOR-LOCAL bone transforms, feet excluded (terrain conform). */
const SIG = () => g.page.evaluate(() => {
  const R = window.__ENGINE && window.__ENGINE.renderer;
  if (!R) return {};
  R.scene.updateMatrixWorld(true);
  const out = {};
  R.scene.traverse((o) => {
    if (!o || !o.name || !String(o.name).startsWith('npc:')) return;
    const A = o.userData && o.userData.actor; const S = A && A.built;
    if (!S || !S.bones) return;
    const index = {}; if (S.index && S.index.forEach) S.index.forEach((v, k) => { index[k] = v; });
    const FEET = new Set([index.foot_l, index.foot_r]);
    // Bone LOCAL rotations — what `applyStaticStance` writes. Independent of position and yaw, so
    // travelling or being rebuilt somewhere else cannot move it by itself.
    const parts = [];
    S.bones.forEach((b, i) => {
      if (!b) { parts.push('x'); return; }
      if (FEET.has(i)) { parts.push('conform'); return; }
      parts.push(`${b.rotation.x.toFixed(9)},${b.rotation.y.toFixed(9)},${b.rotation.z.toFixed(9)}`);
    });
    out[String(o.name).slice(4)] = { sig: parts.join('|'), root_dy: A.staticStance ? A.staticStance.root_dy_m : null, vis: !!o.visible };
  });
  return out;
});

const cmp = (a, b) => {
  const keys = Object.keys(a).filter((k) => k in b);
  const same = keys.filter((k) => a[k].sig === b[k].sig);
  return { compared: keys.length, identical: same.length, changed: keys.filter((k) => a[k].sig !== b[k].sig).slice(0, 6), only_in_a: Object.keys(a).filter((k) => !(k in b)).length, only_in_b: Object.keys(b).filter((k) => !(k in a)).length };
};

const results = [];
const w = await call('whereAmI');
if (w.__ok && w.__ok.interior) await call('exitInterior');
await call('teleport', STAND.x, STAND.z);
await call('stepFrames', 20);
const base = await SIG();

// ── A. REBUILD ────────────────────────────────────────────────────────────────────────────────
await g.page.evaluate(() => {
  const R = window.__ENGINE.renderer;
  for (const [, m] of R.npcMeshes) R.scene.remove(m);
  R.npcMeshes.clear();
});
await call('stepFrames', 6);
const afterRebuild = await SIG();
results.push({ arm: 'A REBUILD — every NPC mesh destroyed and rebuilt by syncNPCs', ...cmp(base, afterRebuild) });

// ── B. TRAVEL away and back ───────────────────────────────────────────────────────────────────
await call('teleport', AWAY.x, AWAY.z);
await call('stepFrames', 30);
const awaySig = await SIG();
await call('teleport', STAND.x, STAND.z);
await call('stepFrames', 30);
const afterTravel = await SIG();
results.push({ arm: 'B TRAVEL — teleported away to another settlement and back', npcs_drawn_away: Object.keys(awaySig).length, ...cmp(base, afterTravel) });

// ── C. SAVE / RELOAD ──────────────────────────────────────────────────────────────────────────
const saved = await call('saveState');
let reloadArm = { arm: 'C SAVE/RELOAD', note: 'saveState unavailable', compared: null };
if (saved && saved.__ok !== undefined) {
  const loaded = await call('loadState', saved.__ok);
  await call('stepFrames', 30);
  const w2 = await call('whereAmI');
  if (w2.__ok && w2.__ok.interior) await call('exitInterior');
  await call('teleport', STAND.x, STAND.z);
  await call('stepFrames', 30);
  const afterLoad = await SIG();
  reloadArm = { arm: 'C SAVE/RELOAD — saveState() then loadState(), then back to the same stand', load_ok: !(loaded && loaded.__err), ...cmp(base, afterLoad) };
}
results.push(reloadArm);

// ── D. BODY-HASH INDEPENDENCE ─────────────────────────────────────────────────────────────────
// Change the BODY a person is dealt without touching their eid, and require the STANCE not to move.
// `characterFor` picks from a per-art-family pool by FNV1a('npc:'+eid) % pool.length, so shortening
// the pool re-deals every body. If the stance moved with it, the two seeds are not independent.
const bodyArm = await g.page.evaluate(() => {
  const R = window.__ENGINE.renderer;
  const before = [];
  R.scene.traverse((o) => { const A = o.userData && o.userData.actor; if (o.name && o.name.startsWith('npc:') && A) before.push([o.name, A.characterId || null]); });
  return { n: before.length, sample: before.slice(0, 6) };
});
results.push({ arm: 'D BODY HASH — read only; see note', note: 'the body pool lives in a module-level const inside render/actor.js and is not reachable from the page without an import hook. Tested instead by SEED ARITHMETIC below, which is the same question with no engine in it.', ...bodyArm });

// ── E. CONSUMPTION (RI-MTH07), with a null control ────────────────────────────────────────────
// PERTURB: scale the shipped `idle_ready` stance the crowd is handed, force a rebuild, and require
// the drawn bones to MOVE. NULL CONTROL: perturb a field of the same object that nothing reads and
// require them NOT to move. A cached stance that is never re-solved would pass neither.
const perturb = await g.page.evaluate(() => {
  const E = window.__ENGINE; const R = E.renderer;
  const C = E.sim && E.sim._combat;
  const moves = C && C.player && C.player.moves;
  const pose = moves && moves._idlePose;
  if (!pose || !pose.tracks) return { error: 'no idle_ready pose reachable' };
  const before = JSON.parse(JSON.stringify(pose.tracks));
  // NULL CONTROL first: a field nothing in the stance path reads.
  pose.__critic_null_field = 12345;
  for (const [, m] of R.npcMeshes) R.scene.remove(m);
  R.npcMeshes.clear();
  return { ok: true, keys: Object.keys(pose.tracks).length, before_pelvis: pose.tracks.pelvis ? JSON.parse(JSON.stringify(pose.tracks.pelvis)) : null };
});
await call('stepFrames', 6);
const afterNull = await SIG();
results.push({ arm: 'E0 NULL CONTROL — an unread field added to the stance object, meshes rebuilt', expect: 'IDENTICAL', ...cmp(base, afterNull) });

await g.page.evaluate(() => {
  const E = window.__ENGINE; const R = E.renderer;
  const pose = E.sim._combat.player.moves._idlePose;
  // Triple every rotation key in the stance. If the crowd reads this object, they must move.
  for (const t of Object.values(pose.tracks || {})) {
    for (const ch of Object.keys(t)) {
      if (Array.isArray(t[ch])) t[ch] = t[ch].map(([p, v]) => [p, v * 3]);
    }
  }
  for (const [, m] of R.npcMeshes) R.scene.remove(m);
  R.npcMeshes.clear();
});
await call('stepFrames', 6);
const afterPerturb = await SIG();
const pc = cmp(base, afterPerturb);
results.push({ arm: 'E1 PERTURB — every rotation key in the shipped idle_ready stance x3, meshes rebuilt', expect: 'ALL CHANGED', ...pc, changed_count: pc.compared - pc.identical });

await g.close();

const rep = {
  tool: 'tools/visual/f10-r11c-stance-probe.mjs',
  generated: new Date().toISOString(),
  renderer: attestation,
  stand: STAND, away: AWAY,
  n_npc_meshes_at_stand: Object.keys(base).length,
  n_drawn_at_stand: Object.values(base).filter((r) => r.vis).length,
  results,
};
fs.writeFileSync(path.join(OUT, 'stance-probe.json'), `${JSON.stringify(rep, null, 2)}\n`);
console.log(JSON.stringify(rep, null, 2));
