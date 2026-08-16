#!/usr/bin/env node
/**
 * f10-r13-body-stability.mjs — does the same person keep the same BODY, in the running game?
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * THE ONE PROPERTY THIS ROUND CANNOT INFER AND MUST MEASURE
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 *
 * The brief's own trap, verbatim: *"Variety must be per-individual and stable per-individual — the
 * same person must not change body between frames, saves, or settlements."* Round 12 held its
 * STANCE to that standard and proved it live across REBUILD, TRAVEL and SAVE/RELOAD. Round 13
 * changes what body a person is BUILT from, and `f10-r12-crowd-motion.mjs`'s stability arms read
 * bone rotations — from which a stable body can be *inferred* and must not be. A person could be
 * dealt a different body and stand in an identical pose; the bones would match and the crowd would
 * still be shuffling faces between saves.
 *
 * So this reads the identity the actor module stamps on the drawn meshes —
 * `userData.characterId` and `userData.rigVariantKey` — off the objects the renderer actually
 * drew, at the same three attacks, at a pinned clock.
 *
 * THE CONTROL, AND IT IS REQUIRED TO DISAGREE. An arm that reports "every body is the same after a
 * rebuild" would read green if `characterFor` returned one constant. So one live actor is renamed
 * (`npc:<eid>` → `npc:<eid>#perturbed`) and rebuilt: its body MUST change. If it does not, the
 * selection is not a function of the name and every stability number above is worthless.
 *
 * Usage:
 *   node tools/visual/f10-r13-body-stability.mjs --out <dir> [--x 2785.6 --z 5047]
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../..');
const args = {};
for (let i = 2; i < process.argv.length; i++) {
  if (!process.argv[i].startsWith('--')) continue;
  const k = process.argv[i].replace(/^--/, '').split('=')[0];
  const inline = process.argv[i].includes('=') ? process.argv[i].split('=').slice(1).join('=') : null;
  args[k] = inline !== null ? inline : ((process.argv[i + 1] && !process.argv[i + 1].startsWith('--')) ? process.argv[++i] : true);
}

const OUT = resolve(ROOT, String(args.out || 'reports/visual-truth/f10-r13-body-stability'));
mkdirSync(OUT, { recursive: true });
const log = (...m) => process.stdout.write(`${m.join(' ')}\n`);
const { launchForCapture, resolveGpuMode } = await import(pathToFileURL(join(ROOT, 'tools/visual/lib/gpu-launch.mjs')).href);
const { rendererBanner } = await import(pathToFileURL(join(ROOT, 'tools/visual/lib/renderer-class.mjs')).href);
const { g, attestation } = await launchForCapture({
  mode: resolveGpuMode(args), requireHardware: args['require-hardware'] === true,
  entry: 'game/index.html', width: 960, height: 540, log,
});
await g.page.waitForFunction(() => window.__HARNESS, null, { timeout: 180000 });
await g.h('ready');
log(rendererBanner(attestation));
const call = async (m, ...a) => g.page.evaluate(async ({ method, callArgs }) => {
  const H = window.__HARNESS;
  if (!H || typeof H[method] !== 'function') return { __err: `${method} unavailable` };
  try { return { __ok: await H[method](...callArgs) }; } catch (e) { return { __err: String((e && e.message) || e) }; }
}, { method: m, callArgs: a });

const STAND = { x: Number(args.x ?? 2785.6), z: Number(args.z ?? 5047) };
const AWAY = { x: Number(args.ax ?? 1590), z: Number(args.az ?? 3120) };
const where = await call('whereAmI');
if (where && where.__ok && where.__ok.interior) await call('exitInterior');
await call('teleport', STAND.x, STAND.z);
await call('stepFrames', 24);

/** Every drawn NPC's stamped body identity, read off the scene objects. */
const READ = (sx, sz) => g.page.evaluate(([standX, standZ]) => {
  const R = window.__ENGINE && window.__ENGINE.renderer;
  if (!R) return { error: 'no renderer' };
  R.scene.updateMatrixWorld(true);
  const out = {};
  R.scene.traverse((o) => {
    if (!o || !o.name || !String(o.name).startsWith('npc:')) return;
    const A = o.userData && o.userData.actor;
    const S = A && A.built;
    if (!S || !S.bones) return;
    const idx = {}; if (S.index && S.index.forEach) S.index.forEach((v, k) => { idx[k] = v; });
    const w = (id) => { const i = idx[id]; if (i === undefined || !S.bones[i]) return null; const e = S.bones[i].matrixWorld.elements; return [e[12], e[13], e[14]]; };
    const root = w('pelvis') || w('root');
    let vkey = null;
    o.traverse((m) => { if (m.isMesh && m.userData && m.userData.rigVariantKey) vkey = m.userData.rigVariantKey; });
    out[String(o.name).slice(4)] = {
      characterId: A.characterId || null,
      archetype: A.characterArchetype || null,
      cut: A.characterCut || null,
      rigVariantKey: vkey,
      race: A.race || null,
      visible: !!o.visible,
      dist_to_stand_m: root ? +Math.hypot(root[0] - standX, root[2] - standZ).toFixed(2) : null,
    };
  });
  return { frame: window.__ENGINE.sim ? window.__ENGINE.sim.frame : null, npcs: out };
}, [sx, sz]);

const cmp = (a, b, field) => {
  const keys = Object.keys(a.npcs).filter((k) => k in b.npcs);
  const drawn = keys.filter((k) => a.npcs[k].visible && (a.npcs[k].dist_to_stand_m ?? 1e9) < 200);
  const same = (k) => a.npcs[k][field] === b.npcs[k][field];
  return {
    compared: keys.length, identical: keys.filter(same).length,
    DRAWN: { compared: drawn.length, identical: drawn.filter(same).length },
  };
};

const base = await READ(STAND.x, STAND.z);
const drawnBase = Object.entries(base.npcs).filter(([, v]) => v.visible && (v.dist_to_stand_m ?? 1e9) < 200);
const report = {
  tool: 'f10-r13-body-stability.mjs', generated: new Date().toISOString(),
  renderer: rendererBanner(attestation), stand: STAND, arms: [],
  baseline: {
    npc_meshes: Object.keys(base.npcs).length,
    drawn: drawnBase.length,
    distinct_bodies_drawn: new Set(drawnBase.map(([, v]) => v.characterId)).size,
    distinct_structural_keys_drawn: new Set(drawnBase.map(([, v]) => v.rigVariantKey)).size,
    bodies_drawn: [...new Set(drawnBase.map(([, v]) => v.characterId))].sort(),
    cut_census_drawn: drawnBase.reduce((o, [, v]) => { o[v.cut || 'null'] = (o[v.cut || 'null'] || 0) + 1; return o; }, {}),
  },
};
const flush = () => writeFileSync(join(OUT, 'body-stability.partial.json'), JSON.stringify(report, null, 1));
const push = (a) => { report.arms.push(a); flush(); log(`  arm landed: ${a.arm}`); };
flush();

await g.page.evaluate(() => { const R = window.__ENGINE.renderer; for (const [, m] of R.npcMeshes) R.scene.remove(m); R.npcMeshes.clear(); });
await call('stepFrames', 8);
const afterRebuild = await READ(STAND.x, STAND.z);
push({ arm: 'B1 REBUILD — every NPC mesh destroyed and rebuilt by syncNPCs',
  characterId: cmp(base, afterRebuild, 'characterId'), rigVariantKey: cmp(base, afterRebuild, 'rigVariantKey') });

await call('teleport', AWAY.x, AWAY.z); await call('stepFrames', 30);
await call('teleport', STAND.x, STAND.z); await call('stepFrames', 8);
const afterTravel = await READ(STAND.x, STAND.z);
push({ arm: 'B2 TRAVEL — 2.4 km away to another settlement and back',
  characterId: cmp(base, afterTravel, 'characterId'), rigVariantKey: cmp(base, afterTravel, 'rigVariantKey') });

const blob = await call('saveState');
if (blob && blob.__ok) {
  await call('loadState', blob.__ok);
  await call('teleport', STAND.x, STAND.z); await call('stepFrames', 8);
  const afterLoad = await READ(STAND.x, STAND.z);
  push({ arm: 'B3 SAVE/RELOAD — saveState() then loadState(), then back to the same stand', load_ok: true,
    characterId: cmp(base, afterLoad, 'characterId'), rigVariantKey: cmp(base, afterLoad, 'rigVariantKey') });
} else {
  push({ arm: 'B3 SAVE/RELOAD', load_ok: false, note: 'saveState unavailable in this session' });
}

// ── B4. THE CONTROL, REQUIRED TO DISAGREE ───────────────────────────────────────────────────
// Rename one drawn actor and rebuild only that one. If the body is a function of the name, it
// must change. If this arm comes back "unchanged", B1-B3 above are measuring a constant.
const victim = drawnBase.length ? drawnBase[0][0] : null;
const perturb = victim ? await g.page.evaluate((eid) => {
  const R = window.__ENGINE.renderer;
  const mesh = R.npcMeshes.get(eid);
  if (!mesh) return { error: 'no mesh for ' + eid };
  const before = mesh.userData.actor.characterId;
  R.scene.remove(mesh); R.npcMeshes.delete(eid);
  // Rebuild by hand through the same call `syncNPCs` uses, with ONE character changed: the name.
  const n = (window.__ENGINE.sim.npcs || []).find((x) => x.eid === eid);
  if (!n) return { error: 'no sim record' };
  const saved = n.eid;
  n.eid = `${eid}#perturbed`;
  R.syncNPCs(window.__ENGINE.sim);
  const m2 = R.npcMeshes.get(n.eid);
  const after = m2 ? m2.userData.actor.characterId : null;
  // Put the world back exactly as it was.
  if (m2) { R.scene.remove(m2); R.npcMeshes.delete(n.eid); }
  n.eid = saved;
  R.syncNPCs(window.__ENGINE.sim);
  return { eid, before, after };
}, victim) : { error: 'no drawn actor' };
push({ arm: 'B4 CONTROL, REQUIRED TO DISAGREE — one actor renamed must be dealt a different body',
  ...perturb, ok: !!(perturb && perturb.before && perturb.after && perturb.before !== perturb.after),
  what_this_catches: 'a selection rule that is not a function of the name — a constant, an array index, a build order. B1-B3 would all read green under any of those.' });

report.pass = report.arms.every((a) => (a.arm.startsWith('B4') ? a.ok
  : (a.characterId ? a.characterId.DRAWN.compared > 0 && a.characterId.DRAWN.identical === a.characterId.DRAWN.compared : true)));
writeFileSync(join(OUT, 'body-stability.json'), JSON.stringify(report, null, 1));
console.log(JSON.stringify(report, null, 1));
await g.close();
process.exit(report.pass ? 0 : 1);
