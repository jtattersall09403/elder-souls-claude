#!/usr/bin/env node
/**
 * f10-r9c-stance-pair.mjs — the CRITIC's two-arm runner for round 9's STANCE change.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * WHY THIS FILE EXISTS, AND WHY IT IS NOT `f10-r9-orbit-pair.mjs`
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 *
 * `orchestration/status/W1-F10-r9.json`'s FIRST `what_i_could_not_do` entry, verbatim: *"THE STANCE
 * FIX IS NOT PHOTOGRAPHED ON HARDWARE… the eight-angle orbit now on the branch is a photograph of
 * the build as r8 left it, not of the build I am shipping."* The paid run r9 landed swaps
 * `game/src/render/actor.js` — r8's trunk change. Round 9's own change is entirely in
 * `game/data/combat/clips.json` (`idle_ready` + `idle_loop`), so that pair CANNOT show it: both of
 * its arms carry the contrapposto.
 *
 * This runner is the same design with the swapped file changed. BEFORE is the clips blob at
 * `f3d20968^`, vendored here as `f10-r9c-baseline-clips.json.txt` and pinned by content hash;
 * AFTER is whatever `game/data/combat/clips.json` contains when this starts.
 *
 * **One Pod, one process, one tool, one GPU.** The builder's reasoning for that is reproduced and,
 * for this pair, is *stronger* than it was for its own: `tools/visual/f10-r7-appearance.mjs` gained
 * `--slots` during round 8, so a `--revision`-based BEFORE arm would be shot by a different
 * instrument AND would drag r8's `actor.js` along with r9's `clips.json` — two variables, not one.
 * Here exactly one file differs between the arms and its sha is checked at the swap and again at
 * the restore.
 *
 * Usage:
 *   node tools/visual/f10-r9c-stance-pair.mjs --out "$RUNPOD_ARTIFACT_DIR/stance-pair" \
 *        --slots CP,FP --gpu hardware --require-hardware
 *   node tools/visual/f10-r9c-stance-pair.mjs --self-test        # no browser, no spend
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';

const HERE = path.dirname(new URL(import.meta.url).pathname);
const REPO = path.resolve(HERE, '../..');
const CLIPS = path.join(REPO, 'game/data/combat/clips.json');
const BASELINE = path.join(HERE, 'f10-r9c-baseline-clips.json.txt');
const APPEARANCE = path.join(HERE, 'f10-r7-appearance.mjs');

/** The BEFORE arm's identity: `git show f3d20968^:game/data/combat/clips.json`, derived by me. */
const BEFORE_SHA = '1e85c5cec8440156cb140d061a0667f0ff5beec21b153bc80f67aa74c394c90a';

const sha256 = (buf) => crypto.createHash('sha256').update(buf).digest('hex');
const shaOf = (p) => sha256(fs.readFileSync(p));

const args = {};
for (let i = 2; i < process.argv.length; i++) {
  if (!process.argv[i].startsWith('--')) continue;
  const k = process.argv[i].slice(2);
  args[k] = (process.argv[i + 1] && !process.argv[i + 1].startsWith('--')) ? process.argv[++i] : true;
}
const log = (s) => process.stdout.write(`${s}\n`);

// ══════════════════════════════════════════════════════════════════════════════════════════════
// SELF-TEST — four arms, REQUIRED TO DISAGREE (RULES rule 6, HAZARDS §0).
// Arms 1-3 are the swap/refuse/detect trio the builder's runner carries and they are kept because
// the risk is identical. Arm 4 is MINE and it is the one this pair specifically needs: the two
// blobs must actually DIFFER IN THE STANCE. A baseline accidentally equal to the shipped file
// would produce two identical sheets and a critic concluding "the stance change is invisible" from
// a pair that never had two arms in it — which is exactly the failure the builder recorded in its
// own hazards list (`git checkout` of an already-banked file is a no-op).
// ══════════════════════════════════════════════════════════════════════════════════════════════
if (args['self-test']) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'f10r9c-selftest-'));
  const results = [];
  const target = path.join(tmp, 'clips.json');
  const base = path.join(tmp, 'baseline.txt');

  // arm 1 — a correct swap and restore
  fs.writeFileSync(target, 'AFTER-BYTES\n');
  fs.writeFileSync(base, 'BEFORE-BYTES\n');
  const afterSha = shaOf(target); const baseSha = shaOf(base);
  const stash = fs.readFileSync(target);
  fs.copyFileSync(base, target);
  const swapped = shaOf(target) === baseSha && shaOf(target) !== afterSha;
  fs.writeFileSync(target, stash);
  const restored = shaOf(target) === afterSha;
  const arm1Mismatch = shaOf(target) !== sha256(stash);
  results.push({ arm: 'swap changes the file and restore puts it back', ok: swapped && restored, swapped, restored, mismatch_detected: arm1Mismatch });

  // arm 2 — a baseline with the wrong identity must be refused
  fs.writeFileSync(base, 'NOT-THE-BASELINE\n');
  const refused = shaOf(base) !== BEFORE_SHA;
  results.push({ arm: 'a baseline whose sha is not BEFORE_SHA is refused', ok: refused, measured: shaOf(base).slice(0, 12) });

  // arm 3 — a restore that did not take must be DETECTED
  fs.writeFileSync(target, 'AFTER-BYTES\n');
  const stash3 = fs.readFileSync(target);
  fs.copyFileSync(base, target);
  fs.writeFileSync(target, stash3);
  fs.appendFileSync(target, 'TAMPER\n');
  const detected = shaOf(target) !== sha256(stash3);
  results.push({ arm: 'a restore that did not take is detected', ok: detected, mismatch_detected: detected });

  // arm 4 — THE PAIR MUST HAVE TWO ARMS IN THE THING UNDER TEST. Not "the files differ" — the
  // `idle_ready` stance channels this round added must differ. A pair whose stance is identical is
  // vacuous no matter how many bytes disagree elsewhere.
  let stanceArm = { arm: 'the two blobs carry DIFFERENT idle_ready stances', ok: false };
  try {
    const before = JSON.parse(fs.readFileSync(BASELINE, 'utf8')).archetypes.idle_ready;
    const after = JSON.parse(fs.readFileSync(CLIPS, 'utf8')).archetypes.idle_ready;
    const chan = (o) => JSON.stringify(o.tracks);
    const differ = chan(before) !== chan(after);
    // and specifically: the ROLL (`rz`) channels, which are the ones C3's hip and shoulder lines read
    const roll = (o) => {
      const out = {};
      for (const [k, v] of Object.entries(o.tracks || {})) if (v && v.rz !== undefined) out[k] = v.rz[0][1];
      return out;
    };
    const rb = roll(before); const ra = roll(after);
    const rollDiffer = JSON.stringify(rb) !== JSON.stringify(ra);
    stanceArm = { arm: 'the two blobs carry DIFFERENT idle_ready stances', ok: differ && rollDiffer, differ, roll_differ: rollDiffer, before_rz: rb, after_rz: ra };
  } catch (e) { stanceArm.error = String(e.message); }
  results.push(stanceArm);

  const vacuous = results[0].mismatch_detected === results[2].mismatch_detected;
  fs.rmSync(tmp, { recursive: true, force: true });
  const pass = results.every((r) => r.ok) && !vacuous;
  console.log(JSON.stringify({ tool: 'f10-r9c-stance-pair --self-test', results, vacuous, pass }, null, 2));
  process.exit(pass ? 0 : 1);
}

// ══════════════════════════════════════════════════════════════════════════════════════════════
// THE RUN
// ══════════════════════════════════════════════════════════════════════════════════════════════
const OUT = path.resolve(REPO, args.out || 'reports/visual-truth/f10-r9c-stance-pair');
fs.mkdirSync(OUT, { recursive: true });
const SLOTS = String(args.slots || 'CP,FP');

if (!fs.existsSync(BASELINE)) { console.error(`f10-r9c: baseline arm missing: ${BASELINE}`); process.exit(2); }
const baselineSha = shaOf(BASELINE);
if (baselineSha !== BEFORE_SHA) {
  console.error(`f10-r9c: BEFORE arm is not the pinned blob.\n  want ${BEFORE_SHA}\n  got  ${baselineSha}`);
  process.exit(2);
}
const afterSha = shaOf(CLIPS);
if (args['expect-after'] && args['expect-after'] !== true && String(args['expect-after']) !== afterSha) {
  console.error(`f10-r9c: AFTER arm is not the expected blob (HAZARDS §15a).`
    + `\n  want ${args['expect-after']}\n  got  ${afterSha}`);
  process.exit(2);
}
if (afterSha === baselineSha) { console.error('f10-r9c: the arms are the same bytes — this pair is vacuous.'); process.exit(2); }
log(`f10-r9c stance pair`);
log(`  AFTER  clips.json sha256 ${afterSha}`);
log(`  BEFORE clips.json sha256 ${baselineSha}  (pinned, = f3d20968^:game/data/combat/clips.json)`);
log(`  slots  ${SLOTS}`);

const passthrough = [];
for (const k of ['gpu', 'require-hardware', 'entry']) {
  if (args[k] === undefined) continue;
  passthrough.push(`--${k}`);
  if (args[k] !== true) passthrough.push(String(args[k]));
}

function shootArm(tag) {
  const argv = [APPEARANCE, '--tag', tag, '--slots', SLOTS, '--out', path.join(OUT, tag), ...passthrough];
  log(`\n── arm ${tag}: node tools/visual/f10-r7-appearance.mjs --tag ${tag} --slots ${SLOTS} …`);
  const r = spawnSync(process.execPath, argv, { stdio: 'inherit', cwd: REPO });
  return { tag, exit: r.status === null ? -1 : r.status, signal: r.signal || null };
}

const manifest = {
  tool: 'f10-r9c-stance-pair.mjs',
  generated: new Date().toISOString(),
  roadmap_item: 'F10',
  role: 'critic round 9 — the STANCE arm the builder could not shoot',
  slots: SLOTS,
  swapped_file: 'game/data/combat/clips.json',
  arms: { after: { clips_sha256: afterSha }, before: { clips_sha256: baselineSha, pinned_at: 'f3d20968^' } },
  runs: [],
  restore: null,
};

const stash = fs.readFileSync(CLIPS);
let ok = true;
try {
  manifest.runs.push(shootArm('after'));
  fs.copyFileSync(BASELINE, CLIPS);
  const nowSha = shaOf(CLIPS);
  if (nowSha !== BEFORE_SHA) throw new Error(`swap did not take: ${nowSha}`);
  log(`\n── swapped clips.json to the BEFORE arm (${nowSha.slice(0, 12)}…)`);
  manifest.runs.push(shootArm('before'));
} catch (e) {
  ok = false;
  manifest.error = String(e.message);
  log(`f10-r9c: ${e.message}`);
} finally {
  fs.writeFileSync(CLIPS, stash);
  const back = shaOf(CLIPS);
  manifest.restore = { restored_sha256: back, ok: back === afterSha };
  if (back !== afterSha) { ok = false; log(`f10-r9c: RESTORE FAILED — clips.json is ${back}, wanted ${afterSha}`); }
  else log(`\n── restored clips.json to the AFTER arm (${back.slice(0, 12)}…)`);
}

if (manifest.runs.some((r) => r.exit !== 0)) ok = false;
fs.writeFileSync(path.join(OUT, 'stance-pair.json'), `${JSON.stringify(manifest, null, 2)}\n`);
log(`\nwrote ${path.relative(REPO, path.join(OUT, 'stance-pair.json'))}`);
process.exit(ok ? 0 : 1);
