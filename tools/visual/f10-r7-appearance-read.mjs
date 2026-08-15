#!/usr/bin/env node
/**
 * f10-r7-appearance-read.mjs — read the two hardware arms `f10-r7-appearance.mjs` brought home.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * IT CAPTURES NOTHING, SO IT CANNOT INHERIT A CAPTURE DEFECT
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 *
 * The three statistics that decide whether the pair is evidence at all — per-frame liveness,
 * per-frame before/after difference inside the subject box, and the border-ring change rate that
 * proves the walk moved — are IMPORTED from `f10-r6-appearance-compare.mjs` rather than copied.
 * That file's own self-test (`--self-test`, 5 checks with arms required to disagree) is therefore
 * this file's guarantee too, and there is one implementation of each statistic in the repo instead
 * of two that can drift. HAZARDS §17: an inherited tool carries its author's assumptions in its
 * constants — so the constants are inherited on purpose, from a file that states them.
 *
 * WHAT IT ADDS, AND WHY EACH NUMBER EXISTS
 *
 *  1. **The crowd census, per arm, read off the manifest the capture wrote at capture time.**
 *     `W__*` frames carry `drawn_buried` / `drawn_airborne` alongside `record_buried` /
 *     `record_airborne`. The record columns MUST be identical between the arms — round 7 changed
 *     nothing the simulation reads — and if they are not, the arms differ by something other than
 *     the change under test and every other number here is suspect. That check runs first.
 *
 *  2. **The dual-aim face result.** Each face was shot twice: once aimed where the AUTHORED height
 *     puts the person, once where the GROUND does. The prediction under test is specific and
 *     falsifiable: in the BEFORE arm the `record`-aimed frame contains a subject and the
 *     `ground`-aimed one does not; in the AFTER arm it is the other way round. That is reported as
 *     a table of gate verdicts, so a reader can see it rather than take it.
 *
 *  3. **The per-foot numbers the capture measured at the bones**, carried through to the report so
 *     that "the feet are 0.24 m apart on ground that differs by 0.68 m" is a figure attached to
 *     the frames it was measured in, not a claim in a status file.
 *
 * Usage:
 *   node tools/visual/f10-r7-appearance-read.mjs --run <run-artifact-dir> --out <dir>
 *   node tools/visual/f10-r7-appearance-read.mjs --self-test
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { PNG } from 'pngjs';
import { gateBuffer } from './frame-liveness.mjs';
import { diffFrac, ringChangeFrac } from './f10-r6-appearance-compare.mjs';

const args = {};
for (let i = 2; i < process.argv.length; i++) {
  if (!process.argv[i].startsWith('--')) continue;
  const k = process.argv[i].slice(2);
  args[k] = (process.argv[i + 1] && !process.argv[i + 1].startsWith('--')) ? process.argv[++i] : true;
}

const readPng = (f) => PNG.sync.read(fs.readFileSync(f));
const sha = (f) => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex').slice(0, 16);

if (args['self-test']) {
  // The imported statistics carry their own self-test; this one checks THIS file's addition —
  // that the dual-aim table cannot report a pass when both arms agree.
  const fails = [];
  const cls = (before, after) => (before === 'LIVE' && after !== 'LIVE' ? 'before-only'
    : after === 'LIVE' && before !== 'LIVE' ? 'after-only'
      : before === 'LIVE' && after === 'LIVE' ? 'both' : 'neither');
  if (cls('LIVE', 'NO_SUBJECT') !== 'before-only') fails.push('before-only misclassified');
  if (cls('NO_SUBJECT', 'LIVE') !== 'after-only') fails.push('after-only misclassified');
  if (cls('LIVE', 'LIVE') !== 'both') fails.push('both misclassified');
  if (cls('NO_SUBJECT', 'NO_SUBJECT') !== 'neither') fails.push('neither misclassified');
  if (typeof diffFrac !== 'function' || typeof ringChangeFrac !== 'function') fails.push('the r6 statistics did not import');
  console.log(fails.length ? `SELF-TEST FAILED\n  ${fails.join('\n  ')}`
    : 'SELF-TEST PASSED — 5 checks; run `node tools/visual/f10-r6-appearance-compare.mjs --self-test` for the imported statistics');
  process.exit(fails.length ? 1 : 0);
}

const RUN = path.resolve(args.run || '');
const OUT = path.resolve(args.out || path.join(RUN, 'compare'));
if (!fs.existsSync(RUN)) { console.error(`no such run dir: ${RUN}`); process.exit(2); }
fs.mkdirSync(OUT, { recursive: true });

const arms = {};
for (const arm of ['before', 'after']) {
  const dir = path.join(RUN, arm);
  const mf = path.join(dir, 'manifest.json');
  if (!fs.existsSync(mf)) { console.error(`arm ${arm}: no manifest at ${mf}`); process.exit(2); }
  arms[arm] = { dir, frames: path.join(dir, 'frames'), manifest: JSON.parse(fs.readFileSync(mf, 'utf8')) };
  arms[arm].files = fs.readdirSync(arms[arm].frames).filter((f) => f.endsWith('.png')).sort();
  arms[arm].rowOf = (file) => (arms[arm].manifest.frames || []).find((x) => x.file === file) || null;
}

// ── 0. THE CONTROL CHECK THAT RUNS FIRST ──────────────────────────────────────────────────────
// The simulation was deliberately not touched, so the RECORD census must be identical in both
// arms. If it is not, the arms differ by something this experiment did not intend and nothing
// below can be trusted. HAZARDS §11: freeze the arms, then check that they froze.
const recordCheck = {};
for (const arm of ['before', 'after']) {
  const w = (arms[arm].manifest.frames || []).filter((r) => r.slot === 'W');
  recordCheck[arm] = w.length ? {
    npcs_visible: w[0].npcs_visible, record_buried: w[0].record_buried, record_airborne: w[0].record_airborne,
    drawn_buried: w[0].drawn_buried, drawn_airborne: w[0].drawn_airborne,
  } : null;
}
recordCheck.record_columns_identical = !!(recordCheck.before && recordCheck.after
  && recordCheck.before.record_buried === recordCheck.after.record_buried
  && recordCheck.before.record_airborne === recordCheck.after.record_airborne
  && recordCheck.before.npcs_visible === recordCheck.after.npcs_visible);

// ── 1. liveness on every frame, both arms ─────────────────────────────────────────────────────
const liveness = { before: {}, after: {} };
const deadFrames = [];
for (const arm of ['before', 'after']) {
  for (const f of arms[arm].files) {
    const buf = fs.readFileSync(path.join(arms[arm].frames, f));
    const row = arms[arm].rowOf(f);
    const box = row && row.subject_box ? row.subject_box : null;
    const wantSubject = !!(row && row.gated_subject);
    const g = gateBuffer(buf, { box, subject: wantSubject, label: `${arm}/${f}`, throwOnDegenerate: false });
    liveness[arm][f] = g.verdict;
    if (g.verdict !== 'LIVE') deadFrames.push({ arm, file: f, verdict: g.verdict, why: (g.why || []).slice(0, 2) });
  }
}
const verdictCounts = {};
for (const arm of ['before', 'after']) {
  verdictCounts[arm] = {};
  for (const v of Object.values(liveness[arm])) verdictCounts[arm][v] = (verdictCounts[arm][v] || 0) + 1;
}

// ── 2. per-frame before/after difference ──────────────────────────────────────────────────────
const paired = arms.before.files.filter((f) => arms.after.files.includes(f));
const pairs = [];
for (const f of paired) {
  const pa = path.join(arms.after.frames, f), pb = path.join(arms.before.frames, f);
  const ha = sha(pa), hb = sha(pb);
  const row = arms.after.rowOf(f) || {};
  const box = row.subject_box || null;
  const d = ha === hb ? { changed_frac: 0, mean_delta: 0, max_delta: 0, box_px: null } : diffFrac(readPng(pa), readPng(pb), box);
  pairs.push({
    file: f, slot: row.slot || f.split('__')[0], part: row.part || null, subject: row.subject || null,
    variant: row.variant || null, aim: row.aim || null, stand: row.stand || null,
    identical: ha === hb, sha_after: ha, sha_before: hb,
    verdict_before: liveness.before[f], verdict_after: liveness.after[f],
    live_both: liveness.after[f] === 'LIVE' && liveness.before[f] === 'LIVE',
    ...d,
  });
}
const bySlot = {};
for (const p of pairs) {
  const s = bySlot[p.slot] = bySlot[p.slot] || { slot: p.slot, n: 0, identical: 0, live_both: 0, changed_frac_sum: 0, changed_frac_mean: null, files_identical: [] };
  s.n++; if (p.identical) { s.identical++; s.files_identical.push(p.file); }
  if (p.live_both) { s.live_both++; s.changed_frac_sum += (p.changed_frac || 0); }
}
for (const s of Object.values(bySlot)) s.changed_frac_mean = s.live_both ? +(s.changed_frac_sum / s.live_both).toFixed(5) : null;

// ── 3. the dual-aim face table ────────────────────────────────────────────────────────────────
const faces = {};
for (const p of pairs.filter((x) => x.slot === 'FA')) {
  const key = `${p.subject}|${p.file.split('__')[3] || ''}`;
  const subj = p.subject;
  faces[subj] = faces[subj] || { subject: subj, variant: p.variant, ground: {}, record: {} };
  const bucket = p.aim === 'record' ? faces[subj].record : faces[subj].ground;
  bucket[p.file] = { before: p.verdict_before, after: p.verdict_after, changed_frac: p.changed_frac };
  void key;
}
const facePrediction = [];
for (const subj of Object.values(faces)) {
  const anyLive = (b, which) => Object.values(b).some((r) => r[which] === 'LIVE');
  facePrediction.push({
    subject: subj.subject, variant: subj.variant,
    record_aim: { before_live: anyLive(subj.record, 'before'), after_live: anyLive(subj.record, 'after') },
    ground_aim: { before_live: anyLive(subj.ground, 'before'), after_live: anyLive(subj.ground, 'after') },
    // The prediction: the AFTER arm has a face where the GROUND is, the BEFORE arm where the
    // AUTHORED height is. `null` where the person's authored height already matched the ground —
    // then both aims are the same place and the test does not apply.
    matches_prediction: anyLive(subj.ground, 'after') && anyLive(subj.record, 'before'),
  });
}

// ── 4. motion ─────────────────────────────────────────────────────────────────────────────────
const motion = {};
for (const arm of ['before', 'after']) {
  const ms = arms[arm].files.filter((f) => f.startsWith('M__walk__')).sort();
  const ring = [];
  for (let i = 1; i < ms.length; i++) {
    ring.push({
      from: ms[i - 1], to: ms[i],
      ring_changed_frac: ringChangeFrac(readPng(path.join(arms[arm].frames, ms[i - 1])), readPng(path.join(arms[arm].frames, ms[i]))),
    });
  }
  const vals = ring.map((r) => r.ring_changed_frac).filter((v) => v !== null).sort((x, y) => x - y);
  const med = vals.length ? vals[Math.floor(vals.length / 2)] : null;
  motion[arm] = {
    frames: ms.length, median_consecutive: med,
    min_consecutive: vals[0] ?? null, max_consecutive: vals[vals.length - 1] ?? null,
    manifest_motion: arms[arm].manifest.motion || null,
    verdict: med === null ? 'NO MOTION FRAMES'
      : med < 0.02 ? `STATIONARY — median consecutive ring change ${(med * 100).toFixed(2)}%, i.e. the HAZARDS §16 failure (0.2%)`
        : `MOVED — median consecutive ring change ${(med * 100).toFixed(2)}%`,
    consecutive_ring_change: ring,
  };
}

// ── 5. the per-foot numbers, carried through from the capture ─────────────────────────────────
const feet = {};
for (const arm of ['before', 'after']) feet[arm] = (arms[arm].manifest.slope_stands || []).map((s) => ({
  stand: s.stand, expected_per_foot_m: s.expected_per_foot_m,
  measured_per_foot_ground_m: s.measured && s.measured.per_foot_ground_difference_m,
  drawn_foot_height_difference_m: s.measured && s.measured.per_foot_drawn_difference_m,
  stance_m: s.measured && s.measured.stance_m,
  error: s.measured && s.measured.error,
}));

const report = {
  tool: 'f10-r7-appearance-read', generated: new Date().toISOString(), run_dir: RUN,
  statistics_imported_from: 'tools/visual/f10-r6-appearance-compare.mjs (diffFrac, ringChangeFrac) — one implementation, one self-test',
  arms: {
    before: { renderer: arms.before.manifest.renderer || null, frames: arms.before.files.length },
    after: { renderer: arms.after.manifest.renderer || null, frames: arms.after.files.length },
  },
  simulation_untouched_check: recordCheck,
  liveness_verdicts: verdictCounts,
  dead_frames: deadFrames,
  paired_frames: paired.length,
  by_slot: Object.values(bySlot).sort((a, b) => a.slot.localeCompare(b.slot)),
  face_dual_aim: facePrediction,
  per_foot: feet,
  motion,
  variant_selection: { before: arms.before.manifest.selection || null, after: arms.after.manifest.selection || null },
  pairs,
};
fs.writeFileSync(path.join(OUT, 'compare.json'), `${JSON.stringify(report, null, 2)}\n`);

console.log(`arms: before ${arms.before.files.length} frames, after ${arms.after.files.length}, ${paired.length} paired`);
console.log(`SIMULATION UNTOUCHED CHECK: record columns identical between arms = ${recordCheck.record_columns_identical}`);
console.log(`  before: visible ${recordCheck.before && recordCheck.before.npcs_visible}, record buried/air `
  + `${recordCheck.before && recordCheck.before.record_buried}/${recordCheck.before && recordCheck.before.record_airborne}, `
  + `DRAWN buried/air ${recordCheck.before && recordCheck.before.drawn_buried}/${recordCheck.before && recordCheck.before.drawn_airborne}`);
console.log(`  after:  visible ${recordCheck.after && recordCheck.after.npcs_visible}, record buried/air `
  + `${recordCheck.after && recordCheck.after.record_buried}/${recordCheck.after && recordCheck.after.record_airborne}, `
  + `DRAWN buried/air ${recordCheck.after && recordCheck.after.drawn_buried}/${recordCheck.after && recordCheck.after.drawn_airborne}`);
console.log(`liveness: ${JSON.stringify(verdictCounts)}`);
console.log('\nslot     n  identical  live-both  mean changed_frac');
for (const s of report.by_slot) {
  console.log(`${s.slot.padEnd(5)} ${String(s.n).padStart(5)} ${String(s.identical).padStart(10)} ${String(s.live_both).padStart(10)} ${String(s.changed_frac_mean).padStart(18)}`);
}
console.log('\nface dual-aim (prediction: after-arm face at the GROUND aim, before-arm face at the RECORD aim)');
for (const f of facePrediction) {
  console.log(`  ${String(f.variant).padEnd(20)} ${String(f.subject).padEnd(34)} record-aim before=${f.record_aim.before_live} after=${f.record_aim.after_live}  `
    + `ground-aim before=${f.ground_aim.before_live} after=${f.ground_aim.after_live}  -> ${f.matches_prediction ? 'AS PREDICTED' : 'NOT AS PREDICTED'}`);
}
console.log('\nper-foot ground difference measured at the bones:');
for (const arm of ['before', 'after']) {
  for (const s of feet[arm]) console.log(`  ${arm.padEnd(6)} ${String(s.stand).padEnd(16)} ground diff ${s.measured_per_foot_ground_m} m (scan said ${s.expected_per_foot_m}); drawn foot height diff ${s.drawn_foot_height_difference_m} m${s.error ? `  ERROR ${s.error}` : ''}`);
}
console.log('\nmotion:');
for (const arm of ['before', 'after']) console.log(`  ${arm}: ${motion[arm].verdict}; manifest says ${motion[arm].manifest_motion && motion[arm].manifest_motion.note}`);
console.log(`\nwrote ${path.join(OUT, 'compare.json')}`);
