#!/usr/bin/env node
/**
 * critic-road-join-consume.mjs — CONSUMPTION for the road/settlement join, with the CRITIC'S
 * perturbations rather than the builder's.
 *
 * `RI-MTH07` / `RULES.md` rule 5. The builder's own probe (`road-join-consumption.mjs`) perturbs
 * `stormhold` four ways and is a good probe. It has two blind spots this tool exists to cover:
 *
 *   1. **Every one of its perturbations is a DATA edit.** The join's real input is not the data,
 *      it is `planSettlement()` — a function. A change to the GENERATOR moves every wall in the
 *      province without touching a byte of settlement data, and the shipped tree has already had
 *      one (the per-axis shrink, banked in `0dc0703`, 24 minutes after the join was cut).
 *   2. **Every one of its perturbations is in Stormhold.** The town the join actually fails in is
 *      Blackrose, whose plan is authored 1.0 m apart and terraces rather than shrinking.
 *
 * ARMS
 *   R-REMEDY    the tree AS IT STANDS, roads rebuilt by the joined generator. Does re-running the
 *               build close the 3-of-10 the shipped `roads.json` currently has? This is the
 *               question the next builder needs answered and nobody has asked it.
 *   R-DETERM    rebuild twice from the same input; the two `roads.json` must be byte-identical, or
 *               "the road moved" is not a measurement of anything.
 *   TEARDOWN    rebuild with `--no-join`. The control must go RED, or both arms are the positive
 *               arm (rule 6, the inert control).
 *   P-BLACKROSE move a BLACKROSE building onto `blackrose-lilmoth`. BITES unrebuilt, FOLLOWS
 *               rebuilt, and the road must move.
 *   NULL-NOREAD edit a field `planSettlement()` does not read (`buildings[].name`). The rebuilt
 *               `roads.json` must be BYTE-IDENTICAL. A null that only has to move less than 2 m is
 *               weaker than one that has to not move at all.
 *   NULL-REVERSED  a perturbation the model is ENTITLED TO UNDO — grow a non-enterable building's
 *               declared footprint past the point where the shrink pass takes it all back. This
 *               arm is expected to be INERT, and it is here so that inertness is REPORTED rather
 *               than mistaken for a decoupled join. See `RULES.md` rule 6 and the builder's own
 *               P3 note.
 *
 * Every arm runs on a scratch copy. Nothing under `game/` in the real tree is written.
 *
 * Usage: node tools/world/critic-road-join-consume.mjs [--out reports/critic-road-join/consume.json]
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync, execSync } from 'node:child_process';
import { planSettlement, insideBuilding } from '../../game/src/render/exterior.js';

const ROOT = path.resolve(new URL('../..', import.meta.url).pathname);
const argv = process.argv.slice(2);
const argOf = (f, d) => (argv.includes(f) ? argv[argv.indexOf(f) + 1] : d);
const OUT = path.join(ROOT, argOf('--out', 'reports/critic-road-join/consume.json'));
const SCRATCH = path.resolve(argOf('--scratch',
  '/tmp/claude-0/-home-user-elder-souls-claude/3c195166-6f14-54d0-bf0f-867f7b39d84b/scratchpad/critic-consume'));
const log = (s) => process.stdout.write(s + '\n');
const rd = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
const sha = (p) => execSync(`sha256sum ${JSON.stringify(p)}`).toString().slice(0, 16);

function makeScratch() {
  fs.rmSync(SCRATCH, { recursive: true, force: true });
  fs.mkdirSync(path.join(SCRATCH, 'corpus/50-world'), { recursive: true });
  fs.mkdirSync(path.join(SCRATCH, 'reports'), { recursive: true });
  fs.cpSync(path.join(ROOT, 'game'), path.join(SCRATCH, 'game'), { recursive: true });
  fs.cpSync(path.join(ROOT, 'tools'), path.join(SCRATCH, 'tools'), { recursive: true });
  fs.copyFileSync(path.join(ROOT, 'corpus/50-world/world-scale.json'), path.join(SCRATCH, 'corpus/50-world/world-scale.json'));
}
function run(args, cwd) {
  const t0 = Date.now();
  try { return { code: 0, ms: Date.now() - t0, out: execFileSync('node', args, { cwd, encoding: 'utf8', maxBuffer: 64 << 20 }) }; }
  catch (e) { return { code: e.status ?? -1, ms: Date.now() - t0, out: (e.stdout || '') + (e.stderr || '') }; }
}

const TOWNS = ['stormhold', 'thorn', 'gideon', 'helstrom', 'archon', 'blackrose', 'soulrest', 'lilmoth'];
function interiorsOf(dir) {
  const out = {};
  const idir = path.join(dir, 'game/data/world/interiors');
  for (const f of fs.readdirSync(idir)) { if (!f.endsWith('.json')) continue; const d = rd(path.join(idir, f)); if (d && d.id) out[d.id] = d; }
  return out;
}
/**
 * THE GAME'S VIEW: `planSettlement` with all 115 interiors — what `province.js setSettlements()`
 * builds the body's walls from — over whatever `roads.json` the scratch tree currently holds.
 */
function blocked(dir, roadsDoc) {
  const ints = interiorsOf(dir);
  const plans = TOWNS.map((id) => planSettlement(rd(path.join(dir, `game/data/world/settlements/${id}.json`)), ints));
  const legs = [];
  let samples = 0;
  for (const leg of roadsDoc.legs) {
    const hits = new Set();
    for (let k = 0; k + 1 < leg.points.length; k++) {
      const [ax, az] = leg.points[k], [bx, bz] = leg.points[k + 1];
      const L = Math.hypot(bx - ax, bz - az);
      for (let d = 0; d < L; d += 1) {
        const u = d / L, x = ax + u * (bx - ax), z = az + u * (bz - az);
        for (const pl of plans) { const b = insideBuilding(pl, x, z, 0); if (b) { hits.add(`${pl.id}/${b}`); samples++; break; } }
      }
    }
    if (hits.size) legs.push({ leg: leg.id, buildings: [...hits].sort() });
  }
  return { legs: legs.length, detail: legs, samples };
}
function nearest(pts, x, z) { let b = Infinity, at = null; for (const q of pts) { const d = Math.hypot(q[0] - x, q[1] - z); if (d < b) { b = d; at = q; } } return { d: b, at }; }
function legShift(a, b, x, z, within) {
  let worst = 0;
  for (const q of a.points) { if (Math.hypot(q[0] - x, q[1] - z) > within) continue; const n = nearest(b.points, q[0], q[1]); if (n.d > worst) worst = n.d; }
  return +worst.toFixed(2);
}
const legById = (doc, id) => doc.legs.find((l) => l.id === id);

const PRISTINE = rd(path.join(ROOT, 'game/data/world/roads.json'));
const results = [];
const push = (r) => { results.push(r); fs.mkdirSync(path.dirname(OUT), { recursive: true }); fs.writeFileSync(OUT, JSON.stringify({ schema: 'critic-road-join/consume@1', measured_at: new Date().toISOString(), git: execSync('git rev-parse HEAD', { cwd: ROOT }).toString().trim(), arms: results }, null, 1) + '\n'); };

// ============================ arm 0: where the shipped tree stands ==============================
const shipped = blocked(ROOT, PRISTINE);
log(`SHIPPED roads.json, HEAD's planSettlement: ${shipped.legs} of 10 legs blocked (${shipped.samples} samples)`);
for (const l of shipped.detail) log(`    ${l.leg}: ${l.buildings.join(', ')}`);
push({ id: 'SHIPPED', legs_blocked: shipped.legs, samples: shipped.samples, detail: shipped.detail });

// ============================ arm R-REMEDY + R-DETERM ===========================================
makeScratch();
const b1 = run(['tools/world/build-roads.mjs'], SCRATCH);
const roads1 = rd(path.join(SCRATCH, 'game/data/world/roads.json'));
const h1 = sha(path.join(SCRATCH, 'game/data/world/roads.json'));
const rem = blocked(SCRATCH, roads1);
log(`\nR-REMEDY   rebuild at HEAD (${(b1.ms / 1000).toFixed(0)} s, exit ${b1.code}) -> ${rem.legs} of 10 legs blocked (${rem.samples} samples)`);
for (const l of rem.detail) log(`    ${l.leg}: ${l.buildings.join(', ')}`);
const b2 = run(['tools/world/build-roads.mjs'], SCRATCH);
const h2 = sha(path.join(SCRATCH, 'game/data/world/roads.json'));
log(`R-DETERM   rebuild twice -> ${h1 === h2 ? 'byte-identical (deterministic)' : 'DIFFERENT (' + h1 + ' vs ' + h2 + ') — NON-DETERMINISTIC'}`);
push({ id: 'R-REMEDY', build_exit: b1.code, build_s: +(b1.ms / 1000).toFixed(1), legs_blocked: rem.legs, samples: rem.samples, detail: rem.detail,
  pass: rem.legs === 0, note: 'does re-running the joined generator on the CURRENT planSettlement close the staleness?' });
push({ id: 'R-DETERM', hash_a: h1, hash_b: h2, pass: h1 === h2 });

// ============================ arm TEARDOWN (rule 6: the control must go red) ====================
makeScratch();
const bNo = run(['tools/world/build-roads.mjs', '--no-join'], SCRATCH);
const roadsNo = rd(path.join(SCRATCH, 'game/data/world/roads.json'));
const hNo = sha(path.join(SCRATCH, 'game/data/world/roads.json'));
const tear = blocked(SCRATCH, roadsNo);
log(`\nTEARDOWN   --no-join (exit ${bNo.code}) -> ${tear.legs} of 10 legs blocked (${tear.samples} samples), hash ${hNo}`);
push({ id: 'TEARDOWN', build_exit: bNo.code, legs_blocked: tear.legs, samples: tear.samples, hash: hNo,
  distinct_from_join: hNo !== h1, pass: tear.legs > rem.legs && hNo !== h1,
  note: 'the control arm must go RED and must produce a DIFFERENT file, or both arms are the positive arm' });

// ============================ arm P-BLACKROSE ===================================================
const LEG = 'blackrose-lilmoth';
const ints = interiorsOf(ROOT);
const brRec = rd(path.join(ROOT, 'game/data/world/settlements/blackrose.json'));
const brPlan = planSettlement(brRec, ints);
const brLeg = legById(PRISTINE, LEG);
const cands = brPlan.buildings.map((b) => ({ id: b.id, x: b.x, z: b.z, ...nearest(brLeg.points, b.x, b.z) }))
  .filter((b) => b.d > 12 && b.d < 90).sort((p, q) => p.d - q.d);
if (!cands.length) { log('no blackrose building 12-90 m from the leg — retarget'); process.exit(2); }
const SUB = cands[0];
makeScratch();
{
  const p = path.join(SCRATCH, 'game/data/world/settlements/blackrose.json');
  const doc = rd(p);
  const b = doc.buildings.find((q) => q.id === SUB.id);
  const off = b.offset_m || [0, 0, 0];
  b.offset_m = [off[0] + (SUB.at[0] - SUB.x), off[1] || 0, off[2] + (SUB.at[1] - SUB.z)];
  fs.writeFileSync(p, JSON.stringify(doc, null, 1) + '\n');
}
const brBites = blocked(SCRATCH, PRISTINE);
const bBr = run(['tools/world/build-roads.mjs'], SCRATCH);
const brRoads = rd(path.join(SCRATCH, 'game/data/world/roads.json'));
const brFollows = blocked(SCRATCH, brRoads);
const brShift = legShift(legById(PRISTINE, LEG), legById(brRoads, LEG), SUB.at[0], SUB.at[1], 120);
log(`\nP-BLACKROSE move ${SUB.id} ${SUB.d.toFixed(1)} m onto ${LEG}`);
log(`  BITES   (roads unrebuilt) -> ${brBites.legs} of 10 legs blocked, ${brBites.samples} samples`);
log(`  FOLLOWS (roads rebuilt)   -> ${brFollows.legs} of 10 legs blocked, ${brFollows.samples} samples; road moved ${brShift} m near the subject`);
push({ id: 'P-BLACKROSE', subject: SUB.id, moved_m: +SUB.d.toFixed(1), leg: LEG,
  bites_legs: brBites.legs, bites_samples: brBites.samples,
  follows_legs: brFollows.legs, follows_samples: brFollows.samples, road_shift_m: brShift,
  bites_pass: brBites.samples > shipped.samples, coupled_pass: brShift >= 2.0,
  follows_pass: brFollows.legs === 0,
  note: 'BITES compares SAMPLES not legs, because the shipped tree is already red in Blackrose and a leg count cannot see a worsening' });

// ============================ arm NULL-NOREAD ===================================================
makeScratch();
{
  const p = path.join(SCRATCH, 'game/data/world/settlements/blackrose.json');
  const doc = rd(p);
  for (const b of doc.buildings) b.name = (b.name || b.id) + ' (critic null arm)';
  fs.writeFileSync(p, JSON.stringify(doc, null, 1) + '\n');
}
const bNull = run(['tools/world/build-roads.mjs'], SCRATCH);
const hNull = sha(path.join(SCRATCH, 'game/data/world/roads.json'));
log(`\nNULL-NOREAD rename every Blackrose building (a field planSettlement does not read) -> hash ${hNull} ${hNull === h1 ? '= the unperturbed rebuild (correct)' : 'DIFFERS — the join reads something it should not'}`);
push({ id: 'NULL-NOREAD', hash: hNull, unperturbed_hash: h1, pass: hNull === h1,
  note: 'a byte-identical null is a stronger control than a "moved less than 2 m" one' });

// ============================ arm NULL-REVERSED =================================================
// A perturbation the model is ENTITLED to undo. Blackrose's plan is packed; grow one non-enterable
// building's declared footprint and let the shrink pass take it straight back.
const revSub = brPlan.buildings.find((b) => !b.enterable && b.interior && ints[b.interior]
  && ints[b.interior].continuity && Array.isArray(ints[b.interior].continuity.exterior_footprint_m))
  || brPlan.buildings.find((b) => b.interior && ints[b.interior] && ints[b.interior].continuity
  && Array.isArray(ints[b.interior].continuity.exterior_footprint_m));
let revArm = { id: 'NULL-REVERSED', skipped: 'no blackrose building declares an exterior_footprint_m' };
if (revSub) {
  const base = ints[revSub.interior].continuity.exterior_footprint_m;
  const want = [+(base[0] * 6).toFixed(2), +(base[1] * 6).toFixed(2)];
  const perturbed = { ...ints, [revSub.interior]: { ...ints[revSub.interior], continuity: { ...ints[revSub.interior].continuity, exterior_footprint_m: want } } };
  const after = planSettlement(brRec, perturbed).buildings.find((q) => q.id === revSub.id);
  const before = brPlan.buildings.find((q) => q.id === revSub.id);
  const undone = JSON.stringify(after.drawn_footprint_m) === JSON.stringify(before.drawn_footprint_m);
  log(`\nNULL-REVERSED ${revSub.id}: declared ${JSON.stringify(base)} -> ${JSON.stringify(want)} (x6)`);
  log(`  effective drawn footprint ${JSON.stringify(before.drawn_footprint_m)} -> ${JSON.stringify(after.drawn_footprint_m)}  ${undone ? 'THE SHRINK PASS UNDID IT ENTIRELY — this arm is inert BY CONSTRUCTION and is reported as such' : 'the edit survived'}`);
  revArm = { id: 'NULL-REVERSED', subject: revSub.id, declared_from: base, declared_to: want,
    effective_before: before.drawn_footprint_m, effective_after: after.drawn_footprint_m,
    reversed_by_model: undone,
    note: undone
      ? 'INERT BY CONSTRUCTION: planSettlement legally undid the edit, so nothing downstream could ever see it. Reported, not counted as evidence either way. This is the exact shape the builder hit in its own P3 and it is not a coupling failure.'
      : 'the edit survived the shrink pass, so this arm is a real perturbation' };
}
push(revArm);

// ============================ summary ===========================================================
const verdict = {
  shipped_is_red: shipped.legs > 0,
  rebuild_fixes_it: rem.legs === 0,
  deterministic: h1 === h2,
  teardown_goes_red: tear.legs > rem.legs && hNo !== h1,
  blackrose_coupled: brShift >= 2.0 && brFollows.legs === 0,
  null_byte_identical: hNull === h1,
};
log('\n---- summary ----');
for (const [k, v] of Object.entries(verdict)) log(`  ${k.padEnd(24)} ${v}`);
push({ id: 'SUMMARY', ...verdict });
log(`\n  ${path.relative(ROOT, OUT)}`);
process.exit(verdict.rebuild_fixes_it && verdict.deterministic && verdict.teardown_goes_red && verdict.null_byte_identical ? 0 : 1);
