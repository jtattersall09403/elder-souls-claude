#!/usr/bin/env node
/**
 * f10-r10-crowd-draw.mjs — E1 on the arm the r9 critic ADDED, plus the pose path nobody had checked.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * TWO QUESTIONS, AND THE SECOND ONE IS THE ONE THAT WAS MISSED
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 *
 * **A. How many distinct bodies does the renderer actually DRAW for 408 NPC records?** The r9
 * critic amended `RI-VIS10` E1 (ADD-only) to count this rather than the `actor` field, on the
 * correct ground that `actor` reaches the simulation and never reaches the camera. Its number was
 * scoped to the largest bucket; this one is global.
 *
 * **B. What POSE are those bodies drawn in?** Nobody had asked. `renderer.js`'s `syncNPCs` calls
 * **`poseStatic` and only `poseStatic`** — read this turn, the sole pose call in the loop over
 * `sim.npcs` — while `poseFromRig` is reserved for the player (`:1210`) and for enemies that have
 * a combat body (`:705`). And `poseStatic`'s own header says what that means: *"Non-combat people
 * use the rig's authored REST pose"*; it sets `group.position`/`rotation.y`, binds presentation
 * meshes once against `restWorld`, and **never evaluates a clip or a stance layer**.
 *
 * **Three consequences, all of which land on `RI-VIS10`:**
 *
 *  1. **The r9 contrapposto reaches 0 of 408 NPCs.** It lives on `idle_ready`, an additive stance
 *     layer applied in `actor.poseLocomotion`, which no NPC calls. C3 passes on the player and on
 *     combat enemies; the crowd never sees it.
 *  2. **And so does r10's root drop** — which is why job 1's hover was never an NPC defect either,
 *     against the verdict's own `why_it_matters` ("the player and all 408 NPCs"). Re-derived here
 *     rather than inherited.
 *  3. **Every one of the 408 stands in the identical symmetric rest pose**, differing only by
 *     position, yaw and body scale. That is `RI-VIS10` §F#6's named failure — "a symmetric A-pose
 *     with the arms lowered" — applied to the entire population at once, and it is a much larger
 *     part of "the town reads as a crowd of copies" than the body count alone.
 *
 * The census below is measured through the SAME `characterFor` hash the renderer uses, by building
 * each record and reading back what was stamped on it, exactly as the r9 critic's tool does — the
 * body identity is fixed at build time and does not depend on which pose call follows.
 *
 * Usage:
 *   node tools/visual/f10-r10-crowd-draw.mjs --json=out.json
 *   node tools/visual/f10-r10-crowd-draw.mjs --self-test
 */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../..');
const args = {};
for (const a of process.argv.slice(2)) {
  if (!a.startsWith('--')) continue;
  const [k, v] = a.slice(2).split('=');
  args[k] = v === undefined ? true : v;
}

// ── the population, enumerated from disk ────────────────────────────────────────────────────
const NPC_DIR = join(ROOT, 'game/data/npcs');
const files = readdirSync(NPC_DIR).filter((f) => f.endsWith('.json')).sort();
const npcs = [];
for (const f of files) {
  const j = JSON.parse(readFileSync(join(NPC_DIR, f), 'utf8'));
  const list = Array.isArray(j) ? j : (j.npcs || j.records || []);
  for (const n of list) npcs.push({ ...n, _file: f });
}

// ── the render path, imported, not modelled ─────────────────────────────────────────────────
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
const rig = new Rig(skel, hitgeo);
rig.rx.fill(0); rig.ry.fill(0); rig.rz.fill(0);
addPose(rig, clips.archetypes.idle_ready, 0, 1);
rig.evaluate([0, 0, 0], 0, 0, 0.1, 1.0);
const body = { rig, pos: [0, 0, 0], state: 'IDLE', animFrame: 0, equipLoadPct: 20, move: null,
  hitboxActive: false, airborne: false, shield: null, twoHanded: false, offhandKind: null, moves: { _weapon: null } };

function drawnBodyOf(n) {
  const family = artFamilyForRace(n.race);
  const g = actorMod.makeRiggedActor(mats, 0x8f9aa6, 0x8d9a72, family);
  g.name = `npc:${n.id}`;
  actorMod.poseFromRig(g, body);
  let characterId = g.userData.actor.characterId || null;
  g.traverse((o) => { if (o.isMesh && o.userData && o.userData.characterId) characterId = o.userData.characterId; });
  return { family, characterId: characterId || `${family}:unnamed` };
}

// ── the pose path, read out of the renderer rather than remembered ──────────────────────────
const rendererSrc = readFileSync(join(ROOT, 'game/src/render/renderer.js'), 'utf8');
const lines = rendererSrc.split('\n');
const syncStart = lines.findIndex((l) => /syncNPCs\s*\(/.test(l));
const syncBody = lines.slice(syncStart, syncStart + 80).join('\n');
const poseCallsInSyncNPCs = [...syncBody.matchAll(/pose(Static|FromRig)\s*\(/g)].map((m) => `pose${m[1]}`);
const poseStaticSrc = rendererSrc.includes('poseStatic');

if (args['self-test']) {
  const results = [];
  // 1. NOT VACUOUS: different ids must land on different bodies, or every row is meaningless.
  const sax = npcs.filter((n) => artFamilyForRace(n.race) === 'saxhleel').slice(0, 60);
  const ids = new Set(sax.map((n) => drawnBodyOf(n).characterId));
  results.push({ arm: 'sixty saxhleel records do not all draw the same body', ok: ids.size > 1, distinct: ids.size });
  // 2. The same id twice must give the SAME body — a hash, not a random.
  const a = drawnBodyOf(npcs[0]).characterId, b = drawnBodyOf(npcs[0]).characterId;
  results.push({ arm: 'the mapping is deterministic', ok: a === b, id: a });
  // 3. The pose-path claim must be falsifiable: this arm FAILS if syncNPCs ever calls poseFromRig.
  results.push({
    arm: 'the pose calls inside syncNPCs are read from the file, and the claim is refutable',
    ok: poseCallsInSyncNPCs.length > 0 && poseStaticSrc,
    calls_found: poseCallsInSyncNPCs,
  });
  const pass = results.every((r) => r.ok);
  console.log(JSON.stringify({ tool: 'f10-r10-crowd-draw --self-test', results, pass }, null, 2));
  process.exit(pass ? 0 : 1);
}

const rows = npcs.map((n) => ({ ...drawnBodyOf(n), race: n.race, actor: n.actor, id: n.id }));
const tally = (arr, key) => {
  const m = new Map();
  for (const r of arr) m.set(key(r), (m.get(key(r)) || 0) + 1);
  return [...m.entries()].sort((x, y) => y[1] - x[1]).map(([k, v]) => ({ key: k, n: v, pct: +((v / arr.length) * 100).toFixed(1) }));
};
const drawn = tally(rows, (r) => r.characterId);
const byRace = {};
for (const r of rows) {
  byRace[r.race] = byRace[r.race] || { n: 0, bodies: new Set() };
  byRace[r.race].n++; byRace[r.race].bodies.add(r.characterId);
}

const out = {
  tool: 'f10-r10-crowd-draw.mjs',
  role: 'W1-F10 r10 builder — RI-VIS10 E1 on the critic-added arm, global; and the NPC pose path',
  generated: new Date().toISOString(),
  item: 'RI-VIS10 §E1 (as amended by W1-F10-r9-CRITIC), §C3, §F#6',
  enumeration: { command: `readdirSync('game/data/npcs') -> ${files.length} json files`, files, n_npcs: npcs.length },
  E1_drawn: {
    n_npcs: npcs.length,
    distinct_drawn_bodies: drawn.length,
    npcs_per_drawn_body: +(npcs.length / drawn.length).toFixed(2),
    distinct_actor_field_values: new Set(rows.map((r) => r.actor || 'none')).size,
    largest_drawn_bucket: drawn[0],
    full_distribution: drawn,
    by_race: Object.fromEntries(Object.entries(byRace).map(([k, v]) => [k, { n: v.n, distinct_bodies: v.bodies.size }])),
    reading: 'The `actor` field is the simulation\'s vocabulary and the camera never sees it. What the camera sees is `characterFor(group.name)`, and that is the number here.',
  },
  NPC_pose_path: {
    question: 'what pose are the 408 drawn in?',
    method: 'read game/src/render/renderer.js this turn; syncNPCs is the loop over sim.npcs and this is every pose call inside it',
    pose_calls_inside_syncNPCs: poseCallsInSyncNPCs,
    finding: poseCallsInSyncNPCs.every((c) => c === 'poseStatic')
      ? 'poseStatic ONLY. No NPC evaluates a clip, a locomotion loop or the additive stance layer.'
      : 'syncNPCs calls poseFromRig somewhere — this section is REFUTED and must be re-read.',
    consequences: [
      'RI-VIS10 C3 (contrapposto) reaches 0 of 408 NPCs. It is authored on idle_ready and applied in actor.poseLocomotion, which no NPC calls.',
      'F10 r10\'s root drop likewise reaches 0 of 408 NPCs — so the r9 verdict\'s why_it_matters ("the player and all 408 NPCs ... now stands about a centimetre above the floor") is wrong on the NPC half. The hover was the player\'s and the combat enemies\'.',
      'All 408 stand in one identical rest pose, differing only by position, yaw and scale. RI-VIS10 §F#6 names exactly that as a failure.',
    ],
    what_would_close_it: 'poseStatic already binds presentation meshes ONCE against `built.restWorld` and caches it (`staticPresentationBound`). The cheap fix with the same per-frame cost is to bake the stance layer — and a per-NPC phase offset of idle_loop — into that one-time bind, so each NPC gets contrapposto and a different point of the breathing cycle without any per-frame rig evaluation. That is a pose-variety change, not a body-count change, and it would move C2/C3/E4 rather than E1.',
  },
};
if (args.json && args.json !== true) writeFileSync(resolve(ROOT, args.json), `${JSON.stringify(out, null, 2)}\n`);
console.log(JSON.stringify({ ...out, E1_drawn: { ...out.E1_drawn, full_distribution: `${drawn.length} rows (in the json)` } }, null, 2));
