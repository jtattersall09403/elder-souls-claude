// THE DELETION TEST. Dispatch instruction, W1-10 round 3, quoted:
//
//   > "Before you call anything done, delete your own fix from a copy of the data and check the
//   >  old number does not return — three W1-09 rounds each moved a defect rather than closing
//   >  it, and that is how the critic caught them."
//
// A fix that coincides with an improvement is not the same thing as a fix that CAUSED it. This
// tool removes each of round 3's three structural fixes, one at a time, and re-measures the exact
// defect that fix was for. Two things have to be true of each:
//
//   WITH the fix     the defect is absent
//   WITHOUT the fix  the ORIGINAL round-2 number comes back, to the digit
//
// The second is the load-bearing half. If deleting a fix does NOT restore the old defect, the
// defect was closed by something else and the fix is decoration; if deleting it restores a
// DIFFERENT number, the defect was moved rather than closed.
//
// Each edit is applied to the real source file and restored in a `finally`, exactly as the
// round-2 critic's consumption probe does with the data files.
//
//   node tools/weapons/fix-ablation.mjs [out.json]
'use strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const MOVESET = `${ROOT}/game/src/combat/moveset.js`;
const RESOLVE = `${ROOT}/game/src/combat/resolve.js`;

function patch(file, from, to) {
  const orig = fs.readFileSync(file, 'utf8');
  if (!orig.includes(from)) throw new Error(`fix-ablation: anchor not found in ${path.basename(file)}:\n${from.slice(0, 90)}`);
  fs.writeFileSync(file, orig.replace(from, to));
  return () => fs.writeFileSync(file, orig);
}

/**
 * One measurement, in a CHILD PROCESS.
 *
 * A `?v=` cache-buster on `tools/lib/combat-node.mjs` does not work here: Node's ESM registry keys
 * by resolved URL, and combat-node imports `game/src/combat/*.js` without a query, so the patched
 * file is never re-read. The first version of this tool did exactly that and reported all three
 * ablations as identical to the unablated build — a probe that cannot see its own perturbation.
 * One process per measurement is the only version that cannot silently lie.
 */
function measure(which) {
  const raw = execFileSync(process.execPath, [`${ROOT}/tools/weapons/_ablation/measure.mjs`, which],
    { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  return JSON.parse(raw.trim().split('\n').pop());
}
const deadBands = () => measure('deadbands');
const arcConformance = () => measure('arc');
const materialSpread = () => measure('material');

const report = { generated: new Date().toISOString(), fixes: {} };

// --- fix 1: the grip-anchored hit capsule -------------------------------------------------------
report.fixes.s26_grip_anchored_capsule = { with_fix: await deadBands() };
{
  const restore = patch(MOVESET,
    `    return {
      a: GRIP_OFFSET_M,`,
    `    return {
      a: Math.max(GRIP_OFFSET_M, Math.round((b - span) * 1000) / 1000),   // ABLATED: wave-1 behaviour`);
  try { report.fixes.s26_grip_anchored_capsule.without_fix = await deadBands(); } finally { restore(); }
}

// --- fix 2: the solved yaw gain ------------------------------------------------------------------
report.fixes.arc_calibration = { with_fix: await arcConformance() };
{
  const restore = patch(MOVESET,
    '    const gk = this._yawGain(weaponId, slotId, reg, slot);',
    '    const gk = 1;   // ABLATED: the uncalibrated, declared-arc-as-cause behaviour');
  try { report.fixes.arc_calibration.without_fix = await arcConformance(); } finally { restore(); }
}

// --- fix 3: material read at hit time -------------------------------------------------------------
report.fixes.material_consumed_at_hit_time = { with_fix: await materialSpread() };
{
  const restore = patch(RESOLVE,
    "      const material = blocking ? 'shield' : materialAt(B, bestHb.id);",
    "      const material = blocking ? 'shield' : 'flesh';   // ABLATED: the wave-1 .flesh-only lookup");
  try { report.fixes.material_consumed_at_hit_time.without_fix = await materialSpread(); } finally { restore(); }
}

fs.writeFileSync(process.argv[2] || `${ROOT}/reports/W1-10-fix-ablation.json`, JSON.stringify(report, null, 1));

const F = report.fixes;
console.log('\n=== DELETION TEST — does removing the fix bring the round-2 defect back? ===\n');
console.log('FIX 1  S26: hit capsule anchored at the grip');
for (const w of Object.keys(F.s26_grip_anchored_capsule.with_fix)) {
  const a = F.s26_grip_anchored_capsule.with_fix[w], b = F.s26_grip_anchored_capsule.without_fix[w];
  console.log(`  ${w.padEnd(22)} with fix: reach ${a.min}..${a.max} gaps ${JSON.stringify(a.interior_gaps_m)}`);
  console.log(`  ${''.padEnd(22)} ABLATED : reach ${b.min}..${b.max} gaps ${JSON.stringify(b.interior_gaps_m)}`);
}
console.log('\nFIX 2  arc solved against the rig');
console.log(`  with fix: ${F.arc_calibration.with_fix.nonconforming}/${F.arc_calibration.with_fix.of} nonconforming`);
console.log(`  ABLATED : ${F.arc_calibration.without_fix.nonconforming}/${F.arc_calibration.without_fix.of} nonconforming`);
console.log('\nFIX 3  material read at hit time');
const m1 = F.material_consumed_at_hit_time.with_fix, m0 = F.material_consumed_at_hit_time.without_fix;
console.log(`  with fix: ${m1.distinct_damage} distinct damages, ${m1.distinct_hitstop} distinct hitstops over ${m1.of} materials`);
console.log(`  ABLATED : ${m0.distinct_damage} distinct damages, ${m0.distinct_hitstop} distinct hitstops over ${m0.of} materials`);
console.log('\n  with fix :', JSON.stringify(m1.rows));
console.log('  ABLATED  :', JSON.stringify(m0.rows));
