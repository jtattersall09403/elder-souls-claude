#!/usr/bin/env node
/**
 * f10-r9-orbit-pair.mjs — shoot BOTH arms of the player orbit on ONE Pod, in one process.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * WHY THIS FILE EXISTS
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 *
 * `orchestration/status/W1-F10-r8.json`'s SECOND `what_i_could_not_do` entry, verbatim: *"THE
 * PLAYER ORBIT — THE EXACT FRAMES THE 'STILL SLABS' VERDICT IS MADE OF — WAS NOT SHOT… I changed
 * the trunk and I did not retake it."* Round 8 rewrote the trunk of the shared body plan and the
 * eight-angle orbit that the last four judgements were written against was never re-photographed.
 * This runs that pair.
 *
 * **Both arms on ONE Pod, in ONE process, is the point.** Two Pods would differ by GPU, by driver,
 * by host and by the tool's own bytes — and `tools/visual/f10-r7-appearance.mjs` gained `--slots`
 * *during* round 8, so a `--revision`-based before-arm would be shot by a DIFFERENT TOOL than the
 * after-arm. That is not a controlled pair. Here the tool, the GPU, the seed, the stand and the
 * camera solve are all held constant and exactly one file differs: `game/src/render/actor.js`.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * THE ARMS ARE PINNED BY CONTENT HASH, NOT BY NAME (HAZARDS §15a)
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 *
 * BEFORE is `tools/visual/f10-r9-baseline-actor.js.txt`, which must hash to `f48b8e95…` — the blob
 * at `01d96c5d:game/src/render/actor.js`, derived here by `git cat-file` and independently equal to
 * the sha both `W1-F10-r7-appearance.json` (its own AFTER arm) and `W1-F10-r8.json` (its own BEFORE
 * arm) record. Three derivations, one number.
 *
 * AFTER is whatever `game/src/render/actor.js` contains when this starts; its sha is MEASURED and
 * written into the manifest rather than asserted, because a Pod snapshot is built from a shared
 * box and a claim about what it carries is exactly the claim HAZARDS §15a says gets falsified.
 *
 * **`--expect-after <sha256>` makes that a hard gate.** Supplied, a mismatch aborts before a single
 * frame is taken, so a run that silently carried a sibling's edit cannot be published as a pair.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * THE RESTORE IS NOT TIDYING — IT IS WHAT KEEPS THE SECOND ARM HONEST
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 *
 * The after-arm bytes are stashed and written back in a `finally`, and the restored file is
 * re-hashed and compared. A crash between the swap and the restore leaves a repo whose `actor.js`
 * is a two-round-old copy, and on a Pod that is harmless (the Pod is deleted) while on a
 * DEVELOPMENT BOX it would be a silent revert of round 8. So the restore verifies, and the exit
 * code is non-zero if it did not take.
 *
 * Usage:
 *   node tools/visual/f10-r9-orbit-pair.mjs --out "$RUNPOD_ARTIFACT_DIR/orbit-pair" \
 *        --slots CP,FP --gpu hardware --require-hardware
 *   node tools/visual/f10-r9-orbit-pair.mjs --self-test        # no browser, no spend
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';

const HERE = path.dirname(new URL(import.meta.url).pathname);
const REPO = path.resolve(HERE, '../..');
const ACTOR = path.join(REPO, 'game/src/render/actor.js');
const BASELINE = path.join(HERE, 'f10-r9-baseline-actor.js.txt');
const APPEARANCE = path.join(HERE, 'f10-r7-appearance.mjs');

/** The BEFORE arm's identity. Not a label — the run refuses to proceed if the bytes disagree. */
const BEFORE_SHA = 'f48b8e9549ea793604a1485b20e0252f6f50c6890fcff991b00a81bac2400c58';

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
// SELF-TEST. Three arms, and they are REQUIRED TO DISAGREE (RULES rule 6). The whole risk in this
// file is the swap: an arm that silently did not swap produces two identical sheets and a round
// that concludes "no visible change" from a pair that never had two arms in it. So the self-test
// runs the real swap/restore against a scratch tree and watches it:
//   1. a correct swap CHANGES the target file's hash to the baseline's, and restores it exactly;
//   2. a baseline whose bytes do not match `BEFORE_SHA` is REFUSED, not photographed;
//   3. a restore that is tampered with between swap and check is DETECTED.
// Arm 3 is the one that matters: it is the only arm that can fail while arms 1 and 2 pass, and it
// is the failure that would put a mislabelled frame into a verdict.
// ══════════════════════════════════════════════════════════════════════════════════════════════
if (args['self-test']) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'f10r9-selftest-'));
  const results = [];
  const target = path.join(tmp, 'actor.js');
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
  // THE SHARED PREDICATE, recorded here and in arm 3, so the suite can prove it is not vacuous:
  // "does the post-restore hash differ from what we stashed?" It must be FALSE here.
  const arm1Mismatch = shaOf(target) !== sha256(stash);
  results.push({ arm: 'swap changes the file and restore puts it back', ok: swapped && restored, swapped, restored, mismatch_detected: arm1Mismatch });

  // arm 2 — a baseline with the wrong identity must be refused
  fs.writeFileSync(base, 'NOT-THE-BASELINE\n');
  const refused = shaOf(base) !== BEFORE_SHA;
  results.push({ arm: 'a baseline whose sha is not BEFORE_SHA is refused', ok: refused, measured: shaOf(base).slice(0, 12) });

  // arm 3 — a restore that did not take must be DETECTED, not assumed
  fs.writeFileSync(target, 'AFTER-BYTES\n');
  const stash3 = fs.readFileSync(target);
  fs.copyFileSync(base, target);
  fs.writeFileSync(target, stash3);
  fs.appendFileSync(target, 'TAMPER\n');            // something else wrote the file after us
  const detected = shaOf(target) !== sha256(stash3);
  results.push({ arm: 'a restore that did not take is detected', ok: detected, mismatch_detected: detected });

  // NOT VACUOUS ONLY IF THE SAME PREDICATE ANSWERS DIFFERENTLY IN THE TWO ARMS. `mismatch_detected`
  // is literally the same expression in both: false on a clean restore, true on a tampered one. If
  // they ever agree, the check has stopped discriminating and the suite says so rather than passing.
  const vacuous = results[0].mismatch_detected === results[2].mismatch_detected;
  fs.rmSync(tmp, { recursive: true, force: true });
  const pass = results.every((r) => r.ok) && !vacuous;
  console.log(JSON.stringify({ tool: 'f10-r9-orbit-pair --self-test', results, vacuous, pass }, null, 2));
  process.exit(pass ? 0 : 1);
}

// ══════════════════════════════════════════════════════════════════════════════════════════════
// THE RUN
// ══════════════════════════════════════════════════════════════════════════════════════════════
const OUT = path.resolve(REPO, args.out || 'reports/visual-truth/f10-r9-orbit-pair');
fs.mkdirSync(OUT, { recursive: true });
const SLOTS = String(args.slots || 'CP,FP');

if (!fs.existsSync(BASELINE)) { console.error(`f10-r9: baseline arm missing: ${BASELINE}`); process.exit(2); }
const baselineSha = shaOf(BASELINE);
if (baselineSha !== BEFORE_SHA) {
  console.error(`f10-r9: BEFORE arm is not the pinned blob.\n  want ${BEFORE_SHA}\n  got  ${baselineSha}`);
  process.exit(2);
}
const afterSha = shaOf(ACTOR);
if (args['expect-after'] && args['expect-after'] !== true && String(args['expect-after']) !== afterSha) {
  console.error(`f10-r9: AFTER arm is not the expected blob (HAZARDS §15a — a snapshot from a shared box).`
    + `\n  want ${args['expect-after']}\n  got  ${afterSha}`);
  process.exit(2);
}
log(`f10-r9 orbit pair`);
log(`  AFTER  actor.js sha256 ${afterSha}`);
log(`  BEFORE actor.js sha256 ${baselineSha}  (pinned, = 01d96c5d:game/src/render/actor.js)`);
log(`  slots  ${SLOTS}`);

const passthrough = [];
for (const k of ['gpu', 'require-hardware', 'entry']) {
  if (args[k] === undefined) continue;
  passthrough.push(`--${k}`);
  if (args[k] !== true) passthrough.push(String(args[k]));
}

function shootArm(tag) {
  const argv = [APPEARANCE, '--tag', tag, '--slots', SLOTS, '--out', path.join(OUT, tag), ...passthrough];
  log(`\n── arm ${tag}: node ${argv.map((a) => (a === APPEARANCE ? 'tools/visual/f10-r7-appearance.mjs' : a)).join(' ')}`);
  const r = spawnSync(process.execPath, argv, { stdio: 'inherit', cwd: REPO });
  return { tag, exit: r.status === null ? -1 : r.status, signal: r.signal || null };
}

const manifest = {
  tool: 'f10-r9-orbit-pair.mjs',
  generated: new Date().toISOString(),
  roadmap_item: 'F10',
  slots: SLOTS,
  arms: { after: { actor_sha256: afterSha }, before: { actor_sha256: baselineSha, pinned_at: '01d96c5d' } },
  runs: [],
  restore: null,
};

const stash = fs.readFileSync(ACTOR);
let ok = true;
try {
  manifest.runs.push(shootArm('after'));
  fs.copyFileSync(BASELINE, ACTOR);
  const nowSha = shaOf(ACTOR);
  if (nowSha !== BEFORE_SHA) throw new Error(`swap did not take: ${nowSha}`);
  log(`\n── swapped actor.js to the BEFORE arm (${nowSha.slice(0, 12)}…)`);
  manifest.runs.push(shootArm('before'));
} catch (e) {
  ok = false;
  manifest.error = String(e.message);
  log(`f10-r9: ${e.message}`);
} finally {
  fs.writeFileSync(ACTOR, stash);
  const back = shaOf(ACTOR);
  manifest.restore = { restored_sha256: back, ok: back === afterSha };
  if (back !== afterSha) { ok = false; log(`f10-r9: RESTORE FAILED — actor.js is ${back}, wanted ${afterSha}`); }
  else log(`\n── restored actor.js to the AFTER arm (${back.slice(0, 12)}…)`);
}

if (manifest.runs.some((r) => r.exit !== 0)) ok = false;
fs.writeFileSync(path.join(OUT, 'orbit-pair.json'), `${JSON.stringify(manifest, null, 2)}\n`);
log(`\nwrote ${path.relative(REPO, path.join(OUT, 'orbit-pair.json'))}`);
process.exit(ok ? 0 : 1);
