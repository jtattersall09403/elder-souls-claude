#!/usr/bin/env node
/**
 * w1-thorn-quay-consumption.mjs — CONSUMPTION (RULES rule 5 / RI-MTH07) for Thorn's Tidewrack quay.
 *
 * "For every model you ship, name the world-side consumer and demonstrate it by perturbing the
 * model and watching an entity change behaviour. Sixteen subsystems have shipped a correct,
 * instrumented model that nothing in the running world reads."
 *
 * The six quay parts added by W1-THORN-PLATES chunk 2 have a chain of three consumers, and this
 * exercises all three plus a perturbation of each:
 *
 *   1. `thorn.json architecture_kit.meshes`  — the settlement must DECLARE a mesh id, or
 *      `structureKitFor()` refuses it. Perturbation: drop the id from the declared kit and the
 *      structure resolves to null.
 *   2. `STRUCTURE_KIT` in exterior.js       — binds the structure's record id to that mesh id.
 *      Perturbation: the committed `semantic=false` arm, which is the OLD production rule (a hash
 *      over the declared kit), and must pick something different.
 *   3. `kitMesh()` / `EXT_KIT`              — must actually construct geometry. Perturbation: ask
 *      for a mesh id that does not exist and confirm it returns null rather than a placeholder.
 *
 * `buildNamedStructure()` THROWS if the mesh cannot be built, so a green run here is also the
 * proof that adding these six records cannot break Thorn's exterior build.
 *
 * USAGE
 *   node tools/render/w1-thorn-quay-consumption.mjs [--json <path>]
 *
 * EXIT
 *   0  every new part is declared, bound, buildable, placed — and every perturbation moved it
 *   1  a part is inert, or a perturbation did NOT move it (an inert control is not evidence)
 *   2  could not load the renderer or the world data
 */
import fs from 'node:fs';
import path from 'node:path';

const REPO = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const argv = process.argv.slice(2);
const JSON_OUT = (() => { const i = argv.indexOf('--json'); return i >= 0 && argv[i + 1] ? argv[i + 1] : null; })();

let planSettlement, structureKitFor, kitBuildable, thornQuayReuse;
try {
  ({ planSettlement, structureKitFor, kitBuildable, thornQuayReuse } = await import(path.join(REPO, 'game/src/render/exterior.js')));
} catch (e) { console.error('could not load the renderer:', e && e.message); process.exit(2); }

const rec = JSON.parse(fs.readFileSync(path.join(REPO, 'game/data/world/settlements/thorn.json'), 'utf8'));
const INTERIORS = (() => {
  const dir = path.join(REPO, 'game/data/world/interiors');
  const out = {};
  for (const f of fs.readdirSync(dir)) { if (!f.endsWith('.json')) continue; try { const r = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')); if (r && r.id) out[r.id] = r; } catch { /* not this tool's business */ } }
  return out;
})();

const NEW = ['thorn-struct-the-tide-courses', 'thorn-struct-the-tidewrack-piles', 'thorn-struct-the-landing-stage',
  'thorn-struct-the-moored-barge', 'thorn-struct-the-boom-chain', 'thorn-struct-the-writ-quay'];

const declared = rec.architecture_kit.meshes;
const plan = planSettlement(rec, INTERIORS);
const byId = new Map(plan.buildings.map((b) => [b.id, b]));

const out = { generated: new Date().toISOString(), reuse: thornQuayReuse(), parts: [], failures: [] };
let bad = 0;

console.log('reuse published for the other seven towns:');
for (const [id, src] of Object.entries(thornQuayReuse())) console.log('  ', id.padEnd(20), '<-', src);
console.log(`  ${'tho_moored_barge'.padEnd(20)} <- (new part — REF-A19's own subject)`);

console.log('\npart'.padEnd(36), 'mesh'.padEnd(20), 'declared buildable placed   world x,z');
for (const id of NEW) {
  const b = byId.get(id);
  const mesh = b ? b.structure_kit : structureKitFor(id, declared);
  const isDeclared = !!mesh && declared.includes(mesh);
  const buildable = mesh ? kitBuildable(mesh, 'thorn') : false;
  const placed = !!b && Number.isFinite(b.x) && Number.isFinite(b.z);
  const row = { id, mesh, declared: isDeclared, buildable, placed, x: b ? +b.x.toFixed(1) : null, z: b ? +b.z.toFixed(1) : null };
  out.parts.push(row);
  if (!isDeclared || !buildable || !placed) { bad++; out.failures.push(row); }
  console.log(id.padEnd(36), String(mesh).padEnd(20), String(isDeclared).padEnd(9), String(buildable).padEnd(9), String(placed).padEnd(8),
    b ? `${b.x.toFixed(1)}, ${b.z.toFixed(1)}` : '—');
}

// ---- PERTURBATION 1: undeclare the mesh. The structure must go dark. -----------------------------
console.log('\nperturbation 1 — remove the mesh id from thorn.json\'s declared kit (in memory):');
let p1moved = 0;
for (const id of NEW) {
  const mesh = structureKitFor(id, declared);
  const without = declared.filter((m) => m !== mesh);
  const after = structureKitFor(id, without);
  if (after !== mesh) p1moved++;
  console.log('  ', id.padEnd(36), `${mesh} -> ${after}`);
}
out.perturbation_undeclare_moved = p1moved;
if (p1moved !== NEW.length) { console.error('  CONTROL DID NOT GO RED: undeclaring a mesh left the structure bound.'); bad++; }

// ---- PERTURBATION 2: the committed semantic=false arm (the old production rule) ------------------
console.log('\nperturbation 2 — the committed `semantic=false` delete-control (the old hash rule):');
let p2moved = 0;
for (const id of NEW) {
  const semantic = structureKitFor(id, declared, true);
  const hashed = structureKitFor(id, declared, false);
  if (hashed !== semantic) p2moved++;
  console.log('  ', id.padEnd(36), `${semantic} -> ${hashed}`);
}
out.perturbation_semantic_off_moved = p2moved;
if (p2moved === 0) { console.error('  CONTROL DID NOT GO RED: the semantic binding is indistinguishable from the hash rule.'); bad++; }

// ---- PERTURBATION 3: a mesh id that does not exist must not build --------------------------------
const ghost = kitBuildable('tho_a_part_that_does_not_exist', 'thorn');
out.perturbation_ghost_mesh_buildable = ghost;
console.log(`\nperturbation 3 — kitBuildable('tho_a_part_that_does_not_exist') = ${ghost} (must be false)`);
if (ghost) { console.error('  CONTROL DID NOT GO RED: an imaginary mesh reported buildable.'); bad++; }

out.ok = bad === 0;
if (JSON_OUT) { fs.mkdirSync(path.dirname(JSON_OUT), { recursive: true }); fs.writeFileSync(JSON_OUT, JSON.stringify(out, null, 2)); console.log('\nwrote', JSON_OUT); }
console.log(bad === 0 ? '\nCONSUMPTION OK — every part is declared, bound, buildable and placed, and every control went red.'
  : `\nFAILED — ${bad} problem(s) above.`);
process.exit(bad === 0 ? 0 : 1);
