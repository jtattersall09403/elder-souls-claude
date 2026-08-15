#!/usr/bin/env node
/**
 * f10-r6-appearance-compare.mjs — read the two HARDWARE arms round 6 never photographed.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * WHY THIS EXISTS
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 *
 * `orchestration/status/W1-F10-r6.json` opens its `what_i_could_not_do` with, verbatim:
 * *"I TOOK NO HARDWARE FRAMES AND RENTED NO POD. Every image and every number in this piece
 * comes from an OFFLINE rasteriser I wrote."* Round 6's whole evidence base is an offline
 * z-buffer over the same geometry and the same `poseFromRig` — no shadows, no AO, no textures,
 * no post, and a two-term light the builder chose. So the claim on the table is *"the geometry
 * the camera can see has changed"*, and the claim the owner's character directive actually asks
 * for — *"builders and critics both look at our actual game, in motion"* — was not made.
 *
 * `f10-r5-appearance.mjs` takes the frames. This file READS them: nothing here captures, so it
 * cannot inherit a capture defect, and it consumes only what came home from the Pod.
 *
 * WHAT IT MEASURES, AND WHAT EACH NUMBER IS GUARDING AGAINST
 *
 *  1. **Liveness on every frame, per frame and not per run** (HAZARDS §15). A frame that is not
 *     a picture, or that does not contain the subject, is excluded from every number below and
 *     named in the report. Round 5 lost 10 of 15 NPC foot close-ups to dark interiors gated
 *     `NO_SUBJECT`; that must be visible, not silent.
 *
 *  2. **Per-frame before/after difference, inside the subject box.** `changed_frac` is the
 *     fraction of box pixels whose max channel delta exceeds 8/255 — above sensor-free PNG noise,
 *     below a shading change. Round 5's foot frames were BYTE-IDENTICAL between arms because both
 *     arms had the feet underground; a byte-identical pair here means the same thing and is
 *     reported as such rather than averaged away.
 *
 *  3. **The border-ring change rate across the walk** (HAZARDS §16). `setInput` is not a harness
 *     verb and `call()` swallows the failure, so four rounds of "motion" capture were taken with
 *     the stick at zero. The measured contrast is not subtle: a stationary sequence moves 0.2% of
 *     the border ring, a real walk moves 71.35%. This is computed per arm, from the returned
 *     frames, independently of what the capture manifest claims about `travelled_m`.
 *
 * Usage:
 *   node tools/visual/f10-r6-appearance-compare.mjs --run <run-artifact-dir> --out <dir>
 *   node tools/visual/f10-r6-appearance-compare.mjs --self-test
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';
import { gateBuffer } from './frame-liveness.mjs';

/**
 * MAIN-MODULE GUARD, added 2026-08-15 by `W1-F10-r7-appearance`. Without it, `import { diffFrac }
 * from './f10-r6-appearance-compare.mjs'` runs this file's ENTIRE comparison in the importer's
 * process and then `process.exit()`s out of it — so the importer's own code never executes and its
 * output is silently this file's. That is HAZARDS §16's third defect verbatim (*"importing
 * `f10-r3-materials.mjs` runs its entire capture and exits"*), which cost a paid Pod and produced a
 * manifest naming the wrong tool. It was reproduced here before being fixed: `--self-test` on the
 * importer printed THIS file's self-test banner and exited.
 *
 * The CLI behaviour is unchanged: run directly, `IS_CLI` is true and everything below runs as before.
 */
const IS_CLI = Boolean(process.argv[1]) && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

const args = {};
for (let i = 2; i < process.argv.length; i++) {
  if (!process.argv[i].startsWith('--')) continue;
  const k = process.argv[i].slice(2);
  args[k] = (process.argv[i + 1] && !process.argv[i + 1].startsWith('--')) ? process.argv[++i] : true;
}

const DELTA = 8;          // per-channel threshold, 0-255
const RING_FRAC = 0.06;   // outer 6% of the frame — the same ring frame-liveness models

const readPng = (f) => PNG.sync.read(fs.readFileSync(f));
const sha = (f) => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex').slice(0, 16);

/** Fraction of pixels inside `box` (or the whole frame) whose max channel delta exceeds DELTA. */
export function diffFrac(a, b, box) {
  if (a.width !== b.width || a.height !== b.height) return { error: 'size mismatch', changed_frac: null };
  const x0 = box ? Math.max(0, box.x0) : 0, x1 = box ? Math.min(a.width - 1, box.x1) : a.width - 1;
  const y0 = box ? Math.max(0, box.y0) : 0, y1 = box ? Math.min(a.height - 1, box.y1) : a.height - 1;
  let changed = 0, total = 0, sum = 0, maxd = 0;
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const i = (y * a.width + x) * 4;
      const d = Math.max(Math.abs(a.data[i] - b.data[i]), Math.abs(a.data[i + 1] - b.data[i + 1]),
        Math.abs(a.data[i + 2] - b.data[i + 2]));
      total++; sum += d; if (d > maxd) maxd = d;
      if (d > DELTA) changed++;
    }
  }
  return { changed_frac: total ? +(changed / total).toFixed(5) : null, mean_delta: total ? +(sum / total).toFixed(3) : null, max_delta: maxd, box_px: total };
}

/**
 * Fraction of BORDER-RING pixels that changed between two frames.
 *
 * The ring is the background: `f10-r5-appearance.mjs` re-aims the camera at the player's own
 * world position every motion frame, so the body stays put in frame and the WORLD slides past.
 * If the player is walking, the ring is where that shows. If the stick was at zero, the ring is
 * nearly still — 0.2% is the number a stationary "walk" returned (HAZARDS §16).
 */
export function ringChangeFrac(a, b) {
  if (a.width !== b.width || a.height !== b.height) return null;
  const mx = Math.round(a.width * RING_FRAC), my = Math.round(a.height * RING_FRAC);
  let changed = 0, total = 0;
  for (let y = 0; y < a.height; y++) {
    for (let x = 0; x < a.width; x++) {
      const inRing = x < mx || x >= a.width - mx || y < my || y >= a.height - my;
      if (!inRing) continue;
      const i = (y * a.width + x) * 4;
      const d = Math.max(Math.abs(a.data[i] - b.data[i]), Math.abs(a.data[i + 1] - b.data[i + 1]),
        Math.abs(a.data[i + 2] - b.data[i + 2]));
      total++; if (d > DELTA) changed++;
    }
  }
  return total ? +(changed / total).toFixed(5) : null;
}

// ══════════════════════════════════════════════════════════════════════════════════════════════
// SELF-TEST. The arms must DISAGREE — a self-test whose arms agree about a false premise is
// HAZARDS §0's fifth failure shape, and this file's two statistics are exactly the kind that
// return a plausible small number when they are measuring nothing.
// ══════════════════════════════════════════════════════════════════════════════════════════════
if (IS_CLI && args['self-test']) {
  const mk = (fn) => { const p = new PNG({ width: 64, height: 64 });
    for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) { const i = (y * 64 + x) * 4; const c = fn(x, y); p.data[i] = c[0]; p.data[i + 1] = c[1]; p.data[i + 2] = c[2]; p.data[i + 3] = 255; } return p; };
  const flat = mk(() => [40, 60, 40]);
  const same = mk(() => [40, 60, 40]);
  const shifted = mk((x) => [40 + ((x + 7) % 2) * 90, 60, 40]);   // ring content moves
  const striped = mk((x) => [40 + (x % 2) * 90, 60, 40]);
  const fails = [];
  const t1 = diffFrac(flat, same, null).changed_frac;
  if (t1 !== 0) fails.push(`identical frames must diff 0, got ${t1}`);
  const t2 = diffFrac(flat, striped, null).changed_frac;
  if (!(t2 > 0.4)) fails.push(`a striped frame against a flat one must diff heavily, got ${t2}`);
  const t3 = ringChangeFrac(flat, same);
  if (t3 !== 0) fails.push(`a still ring must return 0, got ${t3}`);
  const t4 = ringChangeFrac(striped, shifted);
  if (!(t4 > 0.4)) fails.push(`a ring whose content moved must return high, got ${t4}`);
  // The one that matters: a CENTRE-ONLY change must NOT register on the ring. Without this, the
  // ring statistic would pass a stationary player whose idle animation twitches.
  const centreOnly = mk((x, y) => (x > 20 && x < 44 && y > 20 && y < 44 ? [200, 30, 30] : [40, 60, 40]));
  const t5 = ringChangeFrac(flat, centreOnly);
  if (t5 !== 0) fails.push(`a centre-only change must not move the ring, got ${t5}`);
  console.log(fails.length ? `SELF-TEST FAILED\n  ${fails.join('\n  ')}` : 'SELF-TEST PASSED — 5 checks, arms required to disagree');
  process.exit(fails.length ? 1 : 0);
}

// ══════════════════════════════════════════════════════════════════════════════════════════════
// Everything below is the CLI. Guarded so that an importer gets the two exported statistics and
// nothing else — see the note on IS_CLI at the top of this file.
const RUN = IS_CLI ? path.resolve(args.run || '') : null;
const OUT = IS_CLI ? path.resolve(args.out || path.join(RUN, 'compare')) : null;
if (IS_CLI && !fs.existsSync(RUN)) { console.error(`no such run dir: ${RUN}`); process.exit(2); }
if (IS_CLI) fs.mkdirSync(OUT, { recursive: true });
if (IS_CLI) {

const arms = {};
for (const arm of ['before', 'after']) {
  const dir = path.join(RUN, arm);
  const mf = path.join(dir, 'manifest.json');
  arms[arm] = {
    dir, frames: path.join(dir, 'frames'),
    manifest: fs.existsSync(mf) ? JSON.parse(fs.readFileSync(mf, 'utf8')) : null,
  };
  if (!arms[arm].manifest) { console.error(`arm ${arm}: no manifest at ${mf}`); process.exit(2); }
}

// ── 1. liveness, every frame, both arms ───────────────────────────────────────────────────────
const boxOf = (m, file) => { const r = (m.frames || []).find((x) => x.file === file); return r && r.subject_box ? r.subject_box : null; };
const rowOf = (m, file) => (m.frames || []).find((x) => x.file === file) || null;

const liveness = { before: {}, after: {} };
const deadFrames = [];
for (const arm of ['before', 'after']) {
  const files = fs.readdirSync(arms[arm].frames).filter((f) => f.endsWith('.png')).sort();
  for (const f of files) {
    const buf = fs.readFileSync(path.join(arms[arm].frames, f));
    const box = boxOf(arms[arm].manifest, f);
    const g = gateBuffer(buf, { box, subject: true, label: `${arm}/${f}`, throwOnDegenerate: false });
    liveness[arm][f] = g.verdict;
    if (g.verdict !== 'LIVE') deadFrames.push({ arm, file: f, verdict: g.verdict, why: (g.why || []).slice(0, 2) });
  }
  arms[arm].files = files;
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
  const row = rowOf(arms.after.manifest, f) || {};
  const box = boxOf(arms.after.manifest, f);
  const d = ha === hb ? { changed_frac: 0, mean_delta: 0, max_delta: 0, box_px: null } : diffFrac(readPng(pa), readPng(pb), box);
  pairs.push({
    file: f, slot: row.slot || f.split('__')[0], part: row.part || null, subject: row.subject || null,
    race: row.race || null, family: row.family || null,
    identical: ha === hb, sha_after: ha, sha_before: hb,
    live_both: liveness.after[f] === 'LIVE' && liveness.before[f] === 'LIVE',
    verdict_after: liveness.after[f], verdict_before: liveness.before[f],
    ...d,
  });
}

const bySlot = {};
for (const p of pairs) {
  const usable = p.live_both;
  const k = p.slot;
  bySlot[k] = bySlot[k] || { slot: k, n: 0, n_live_both: 0, identical: 0, identical_live: 0, changed_frac_mean: 0, files_identical: [] };
  const s = bySlot[k];
  s.n++; if (usable) s.n_live_both++;
  if (p.identical) { s.identical++; s.files_identical.push(p.file); if (usable) s.identical_live++; }
  if (usable && p.changed_frac !== null) s.changed_frac_mean += p.changed_frac;
}
for (const s of Object.values(bySlot)) s.changed_frac_mean = s.n_live_both ? +(s.changed_frac_mean / s.n_live_both).toFixed(5) : null;

// ── 3. the walk actually moved ────────────────────────────────────────────────────────────────
const motion = {};
for (const arm of ['before', 'after']) {
  const ms = arms[arm].files.filter((f) => f.startsWith('M__walk__')).sort();
  const ring = [], firstLast = {};
  for (let i = 1; i < ms.length; i++) {
    const a = readPng(path.join(arms[arm].frames, ms[i - 1]));
    const b = readPng(path.join(arms[arm].frames, ms[i]));
    ring.push({ from: ms[i - 1], to: ms[i], ring_changed_frac: ringChangeFrac(a, b) });
  }
  if (ms.length > 1) {
    const a = readPng(path.join(arms[arm].frames, ms[0]));
    const b = readPng(path.join(arms[arm].frames, ms[ms.length - 1]));
    firstLast.ring_changed_frac = ringChangeFrac(a, b);
    firstLast.pair = [ms[0], ms[ms.length - 1]];
  }
  const vals = ring.map((r) => r.ring_changed_frac).filter((v) => v !== null).sort((x, y) => x - y);
  motion[arm] = {
    frames: ms.length,
    consecutive_ring_change: ring,
    median_consecutive: vals.length ? vals[Math.floor(vals.length / 2)] : null,
    min_consecutive: vals[0] ?? null, max_consecutive: vals[vals.length - 1] ?? null,
    first_to_last: firstLast,
    manifest_motion: arms[arm].manifest.motion || null,
    verdict: null,
  };
  const med = motion[arm].median_consecutive;
  motion[arm].verdict = med === null ? 'NO MOTION FRAMES'
    : med < 0.02 ? `STATIONARY — median consecutive ring change ${(med * 100).toFixed(2)}%, i.e. the HAZARDS §16 failure (0.2%)`
      : `MOVED — median consecutive ring change ${(med * 100).toFixed(2)}%`;
}

const report = {
  tool: 'f10-r6-appearance-compare', generated: new Date().toISOString(),
  run_dir: RUN,
  delta_threshold_255: DELTA, ring_frac: RING_FRAC,
  arms: {
    before: { renderer: arms.before.manifest.renderer || null, frames: arms.before.files.length, subjects: (arms.before.manifest.subjects || []).map((s) => `${s.label}(${s.race})`) },
    after: { renderer: arms.after.manifest.renderer || null, frames: arms.after.files.length, subjects: (arms.after.manifest.subjects || []).map((s) => `${s.label}(${s.race})`) },
  },
  liveness_verdicts: verdictCounts,
  dead_frames: deadFrames,
  paired_frames: paired.length,
  by_slot: Object.values(bySlot).sort((a, b) => a.slot.localeCompare(b.slot)),
  motion,
  pairs,
};
fs.writeFileSync(path.join(OUT, 'compare.json'), `${JSON.stringify(report, null, 2)}\n`);

// ── console summary ───────────────────────────────────────────────────────────────────────────
console.log(`arms: before ${arms.before.files.length} frames, after ${arms.after.files.length} frames, ${paired.length} paired`);
console.log(`renderer after: ${JSON.stringify(arms.after.manifest.renderer_class || arms.after.manifest.renderer || 'unrecorded')}`);
console.log(`liveness: ${JSON.stringify(verdictCounts)}`);
console.log('\nslot                n  live  identical  identical(live)  mean changed_frac');
for (const s of report.by_slot) {
  console.log(`${s.slot.padEnd(6)} ${String(s.n).padStart(10)} ${String(s.n_live_both).padStart(5)} ${String(s.identical).padStart(10)} ${String(s.identical_live).padStart(16)} ${String(s.changed_frac_mean).padStart(18)}`);
}
console.log('\nmotion:');
for (const arm of ['before', 'after']) console.log(`  ${arm}: ${motion[arm].verdict}  (first->last ring ${motion[arm].first_to_last.ring_changed_frac}); manifest says ${motion[arm].manifest_motion && motion[arm].manifest_motion.note}`);
console.log(`\nwrote ${path.join(OUT, 'compare.json')}`);
}
