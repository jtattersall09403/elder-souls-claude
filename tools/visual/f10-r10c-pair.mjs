#!/usr/bin/env node
/**
 * f10-r10c-pair.mjs — the F10 ROUND 10 CRITIC's two-arm hardware runner.
 *
 * ═════════════════════════════════════════════════════════════════════════════════════════════
 * WHY IT EXISTS
 * ═════════════════════════════════════════════════════════════════════════════════════════════
 * `orchestration/status/W1-F10-r10.json`, `what_i_could_not_do` #2, verbatim: *"I DID NOT
 * PHOTOGRAPH ANY OF THIS ON HARDWARE, AND THAT IS THE SAME HOLE r9 AND r8 LEFT."* Every number in
 * round 10 comes from the built rig and an offline rasteriser. Three claims are unphotographed:
 * the feet back on the ground, the eye's pupil, and that neither broke the stance.
 *
 * `f10-r9c-stance-pair.mjs` cannot shoot this pair. It swaps ONE file (`clips.json`) against a
 * baseline pinned to `f3d20968^` — round 9's own before. Round 10's change is spread over FOUR
 * files and its before is `15a6841c`:
 *
 *   game/src/combat/clips.js    — gains `stanceRootOffsetY()`, the term that makes root_offset live
 *   game/src/combat/actor.js    — calls it (one line)
 *   game/data/combat/clips.json — the -0.00796 endpoints, block_hold -0.03 -> 0
 *   game/src/render/actor.js    — the saxhleel eye moved +6 mm out, +12/13 mm forward
 *
 * Swapping only `clips.json` would put round 10's DATA under round 9's CODE — a `root_offset` that
 * nothing consumes — and the pair would show nothing while looking like it had two arms. So all
 * four move together, each pinned by sha256 at the swap and again at the restore.
 *
 * BEFORE = `15a6841c` (the r10 builder's own declared base_commit).
 * AFTER  = whatever is on disk when this starts, gated by `--expect-after-clips`.
 *
 * Usage:
 *   node tools/visual/f10-r10c-pair.mjs --self-test          # no browser, no spend
 *   node tools/visual/f10-r10c-pair.mjs --out "$RUNPOD_ARTIFACT_DIR/pair" \
 *        --slots CP,FP --canvas 1920x1080 --gpu hardware --require-hardware
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';

const HERE = path.dirname(new URL(import.meta.url).pathname);
const REPO = path.resolve(HERE, '../..');
const APPEARANCE = path.join(HERE, 'f10-r7-appearance.mjs');
const BEFORE_DIR = path.join(HERE, 'f10-r10c-before');

/**
 * The four arms of the swap. `before_sha256` is `git show 15a6841c:<repo_path> | sha256sum`,
 * derived in this turn, and the vendored copy is refused if it does not match.
 */
const FILES = [
  { repo: 'game/src/combat/clips.js', vendored: 'clips.js.txt', before_sha256: 'c0f934571e97c084b4861b7d69711330106a2bb0b7ccbd0dbbc86633c8b69e54' },
  { repo: 'game/src/combat/actor.js', vendored: 'combat-actor.js.txt', before_sha256: '4246cefbdb2905979745c60b73bb6ddc4b4937fe0159ca7915a9c1a999a7348a' },
  { repo: 'game/data/combat/clips.json', vendored: 'clips.json.txt', before_sha256: 'f5220b8925853dc004334974a88b3798f2d7cf36c7b09457ac1526749d54545f' },
  { repo: 'game/src/render/actor.js', vendored: 'render-actor.js.txt', before_sha256: 'f02d90947673585c84aa3ea388037814f6cca1994d5c97b4e6d63b0951e1d708' },
];

const sha256 = (buf) => crypto.createHash('sha256').update(buf).digest('hex');
const shaOf = (p) => sha256(fs.readFileSync(p));

const args = {};
for (let i = 2; i < process.argv.length; i++) {
  if (!process.argv[i].startsWith('--')) continue;
  const k = process.argv[i].slice(2);
  args[k] = (process.argv[i + 1] && !process.argv[i + 1].startsWith('--')) ? process.argv[++i] : true;
}
const log = (s) => process.stdout.write(`${s}\n`);

// ═════════════════════════════════════════════════════════════════════════════════════════════
// SELF-TEST — five arms, REQUIRED TO DISAGREE (RULES rule 6, HAZARDS §0).
// Arms 1-3 are the swap/refuse/detect trio, kept from `f10-r9c-stance-pair.mjs` because the risk
// is identical. Arms 4 and 5 are the ones THIS pair needs: a pair is vacuous unless the two arms
// differ in THE TWO THINGS UNDER TEST — the stance root term and the eye's seating. A four-file
// swap that happened to leave one of them equal would produce a sheet that looks like evidence.
// ═════════════════════════════════════════════════════════════════════════════════════════════
if (args['self-test']) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'f10r10c-'));
  const results = [];
  const target = path.join(tmp, 'x.js');
  const base = path.join(tmp, 'base.txt');

  // arm 1 — a correct swap and restore
  fs.writeFileSync(target, 'AFTER-BYTES\n');
  fs.writeFileSync(base, 'BEFORE-BYTES\n');
  const afterSha = shaOf(target); const baseSha = shaOf(base);
  const stash = fs.readFileSync(target);
  fs.copyFileSync(base, target);
  const swapped = shaOf(target) === baseSha && shaOf(target) !== afterSha;
  fs.writeFileSync(target, stash);
  const restored = shaOf(target) === afterSha;
  results.push({ arm: 'swap changes the file and restore puts it back', ok: swapped && restored, mismatch_detected: shaOf(target) !== sha256(stash) });

  // arm 2 — every vendored blob must carry its pinned identity, or the BEFORE arm is not 15a6841c
  const idents = FILES.map((f) => {
    const p = path.join(BEFORE_DIR, f.vendored);
    const got = fs.existsSync(p) ? shaOf(p) : 'MISSING';
    return { file: f.repo, ok: got === f.before_sha256, got: got.slice(0, 12) };
  });
  results.push({ arm: 'all four vendored BEFORE blobs match their pinned sha256', ok: idents.every((i) => i.ok), idents });

  // arm 3 — a restore that did not take must be DETECTED
  fs.writeFileSync(target, 'AFTER-BYTES\n');
  const stash3 = fs.readFileSync(target);
  fs.copyFileSync(base, target);
  fs.writeFileSync(target, stash3);
  fs.appendFileSync(target, 'TAMPER\n');
  const detected = shaOf(target) !== sha256(stash3);
  results.push({ arm: 'a restore that did not take is detected', ok: detected, mismatch_detected: detected });

  // arm 4 — THE STANCE TERM MUST BE THE VARIABLE. `stanceRootOffsetY` is round 10's whole job-1
  // mechanism; if both arms have it (or neither) the feet claim has no pair behind it.
  let a4 = { arm: 'only the AFTER arm consumes root_offset (`stanceRootOffsetY`)', ok: false };
  try {
    const beforeSrc = fs.readFileSync(path.join(BEFORE_DIR, 'clips.js.txt'), 'utf8');
    const afterSrc = fs.readFileSync(path.join(REPO, 'game/src/combat/clips.js'), 'utf8');
    const bHas = /stanceRootOffsetY/.test(beforeSrc); const aHas = /stanceRootOffsetY/.test(afterSrc);
    const bCall = /stanceRootOffsetY/.test(fs.readFileSync(path.join(BEFORE_DIR, 'combat-actor.js.txt'), 'utf8'));
    const aCall = /stanceRootOffsetY/.test(fs.readFileSync(path.join(REPO, 'game/src/combat/actor.js'), 'utf8'));
    a4 = { arm: 'only the AFTER arm consumes root_offset (`stanceRootOffsetY`)', ok: !bHas && aHas && !bCall && aCall, before_defines: bHas, after_defines: aHas, before_calls: bCall, after_calls: aCall };
  } catch (e) { a4.error = String(e.message); }
  results.push(a4);

  // arm 5 — THE EYE'S SEATING MUST BE THE OTHER VARIABLE, and `idle_ready.root_offset.y` must
  // differ in the DATA too. Source text alone would pass on a comment.
  let a5 = { arm: 'the eye seating and idle_ready.root_offset.y both differ between the arms', ok: false };
  try {
    const bJ = JSON.parse(fs.readFileSync(path.join(BEFORE_DIR, 'clips.json.txt'), 'utf8'));
    const aJ = JSON.parse(fs.readFileSync(path.join(REPO, 'game/data/combat/clips.json'), 'utf8'));
    const ro = (j, k) => JSON.stringify(((j.archetypes[k] || {}).root_offset || {}).y || null);
    const idleDiff = ro(bJ, 'idle_ready') !== ro(aJ, 'idle_ready');
    const blockDiff = ro(bJ, 'block_hold') !== ro(aJ, 'block_hold');
    const bR = fs.readFileSync(path.join(BEFORE_DIR, 'render-actor.js.txt'), 'utf8');
    const aR = fs.readFileSync(path.join(REPO, 'game/src/render/actor.js'), 'utf8');
    const eyeDiff = bR !== aR;
    a5 = {
      arm: 'the eye seating and idle_ready.root_offset.y both differ between the arms',
      ok: idleDiff && blockDiff && eyeDiff,
      idle_ready_root_offset_y: { before: ro(bJ, 'idle_ready'), after: ro(aJ, 'idle_ready') },
      block_hold_root_offset_y: { before: ro(bJ, 'block_hold'), after: ro(aJ, 'block_hold') },
      render_actor_differs: eyeDiff,
    };
  } catch (e) { a5.error = String(e.message); }
  results.push(a5);

  const vacuous = results[0].mismatch_detected === results[2].mismatch_detected;
  fs.rmSync(tmp, { recursive: true, force: true });
  const pass = results.every((r) => r.ok) && !vacuous;
  console.log(JSON.stringify({ tool: 'f10-r10c-pair --self-test', results, vacuous, pass }, null, 2));
  process.exit(pass ? 0 : 1);
}

// ═════════════════════════════════════════════════════════════════════════════════════════════
// THE RUN
// ═════════════════════════════════════════════════════════════════════════════════════════════
const OUT = path.resolve(REPO, args.out || 'reports/visual-truth/f10-r10c-pair');
fs.mkdirSync(OUT, { recursive: true });
const SLOTS = String(args.slots || 'CP,FP');

for (const f of FILES) {
  const p = path.join(BEFORE_DIR, f.vendored);
  if (!fs.existsSync(p)) { console.error(`f10-r10c: BEFORE arm missing: ${p}`); process.exit(2); }
  const got = shaOf(p);
  if (got !== f.before_sha256) {
    console.error(`f10-r10c: BEFORE arm for ${f.repo} is not the pinned blob.\n  want ${f.before_sha256}\n  got  ${got}`);
    process.exit(2);
  }
  f.after_sha256 = shaOf(path.join(REPO, f.repo));
  if (f.after_sha256 === f.before_sha256) { console.error(`f10-r10c: ${f.repo} is identical in both arms — this pair is vacuous.`); process.exit(2); }
}
const clips = FILES.find((f) => f.repo === 'game/data/combat/clips.json');
if (args['expect-after-clips'] && args['expect-after-clips'] !== true && String(args['expect-after-clips']) !== clips.after_sha256) {
  console.error(`f10-r10c: AFTER clips.json is not the expected blob (HAZARDS §15a).\n  want ${args['expect-after-clips']}\n  got  ${clips.after_sha256}`);
  process.exit(2);
}

log('f10-r10c pair — BEFORE 15a6841c, AFTER this tree, four files swapped together');
for (const f of FILES) log(`  ${f.repo.padEnd(30)} before ${f.before_sha256.slice(0, 12)}…  after ${f.after_sha256.slice(0, 12)}…`);
log(`  slots ${SLOTS}`);

const passthrough = [];
for (const k of ['gpu', 'require-hardware', 'entry', 'canvas']) {
  if (args[k] === undefined) continue;
  passthrough.push(`--${k}`);
  if (args[k] !== true) passthrough.push(String(args[k]));
}

function shootArm(tag) {
  const argv = [APPEARANCE, '--tag', tag, '--slots', SLOTS, '--out', path.join(OUT, tag), ...passthrough];
  log(`\n── arm ${tag}: node tools/visual/f10-r7-appearance.mjs --tag ${tag} --slots ${SLOTS} ${passthrough.join(' ')}`);
  const r = spawnSync(process.execPath, argv, { stdio: 'inherit', cwd: REPO });
  return { tag, exit: r.status === null ? -1 : r.status, signal: r.signal || null };
}

const manifest = {
  tool: 'f10-r10c-pair.mjs',
  generated: new Date().toISOString(),
  roadmap_item: 'F10',
  role: 'critic round 10 — the three claims round 10 could not photograph',
  slots: SLOTS,
  canvas: args.canvas || '960x540 (tool default)',
  swapped_files: FILES.map((f) => ({ file: f.repo, before_sha256: f.before_sha256, after_sha256: f.after_sha256 })),
  arms: { before: { pinned_at: '15a6841c' }, after: { pinned_at: 'this tree' } },
  runs: [],
  restore: null,
};

const stash = FILES.map((f) => ({ f, bytes: fs.readFileSync(path.join(REPO, f.repo)) }));
let ok = true;
try {
  manifest.runs.push(shootArm('after'));
  for (const f of FILES) {
    fs.copyFileSync(path.join(BEFORE_DIR, f.vendored), path.join(REPO, f.repo));
    const now = shaOf(path.join(REPO, f.repo));
    if (now !== f.before_sha256) throw new Error(`swap did not take on ${f.repo}: ${now}`);
  }
  log('\n── swapped all four files to the BEFORE arm (15a6841c)');
  manifest.runs.push(shootArm('before'));
} catch (e) {
  ok = false;
  manifest.error = String(e.message);
  log(`f10-r10c: ${e.message}`);
} finally {
  const restore = [];
  for (const { f, bytes } of stash) {
    fs.writeFileSync(path.join(REPO, f.repo), bytes);
    const back = shaOf(path.join(REPO, f.repo));
    const good = back === f.after_sha256;
    if (!good) ok = false;
    restore.push({ file: f.repo, restored_sha256: back, ok: good });
  }
  manifest.restore = restore;
  if (restore.every((r) => r.ok)) log('\n── restored all four files to the AFTER arm');
  else log(`\nf10-r10c: RESTORE FAILED — ${JSON.stringify(restore.filter((r) => !r.ok))}`);
}

if (manifest.runs.some((r) => r.exit !== 0)) ok = false;
fs.writeFileSync(path.join(OUT, 'pair.json'), `${JSON.stringify(manifest, null, 2)}\n`);
log(`\nwrote ${path.join(OUT, 'pair.json')}`);
process.exit(ok ? 0 : 1);
