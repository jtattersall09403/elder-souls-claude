#!/usr/bin/env node
/**
 * collect-run.mjs — lift the committable evidence out of a GPU run's artifact directory.
 *
 * `reports/runpod-gpu/runs/` is gitignored (it holds gigabytes of raw frames), so a hardware run
 * that is never collected leaves nothing behind in the tree. W1-30-EVIDENCE §5 says what belongs
 * in git and what does not:
 *
 *   committed      manifests (which carry the per-frame hashes), contact sheets, the text verdict
 *   not committed  raw PNG sequences, orbit frame dumps, transient moving derivatives
 *
 * So this copies the manifests and the contact sheets into reports/visual-truth/, prints what it
 * found, and leaves the frames where they are.
 *
 *   node tools/visual/collect-run.mjs --run reports/runpod-gpu/runs/deck-hw-full --tag hw-full
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const args = {};
for (let i = 2; i < process.argv.length; i++) {
  if (!process.argv[i].startsWith('--')) continue;
  const k = process.argv[i].slice(2);
  args[k] = (process.argv[i + 1] && !process.argv[i + 1].startsWith('--')) ? process.argv[++i] : true;
}
const RUN = path.resolve(REPO, String(args.run || 'reports/runpod-gpu/runs/deck-hw-full'));
const TAG = String(args.tag || 'hw-full');
const ART = path.join(RUN, 'artifacts');
if (!fs.existsSync(ART)) {
  console.error(`no artifacts directory at ${ART} — was the run retrieved?`);
  process.exit(2);
}

const copy = (from, to) => {
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.copyFileSync(from, to);
  return fs.statSync(to).size;
};

let copied = 0;
let bytes = 0;

const deckManifest = path.join(ART, 'deck', TAG, 'manifest.json');
if (fs.existsSync(deckManifest)) {
  bytes += copy(deckManifest, path.join(REPO, `reports/visual-truth/deck/${TAG}/manifest.json`));
  copied++;
  const m = JSON.parse(fs.readFileSync(deckManifest, 'utf8'));
  console.log(`stills   ${m.counts.ok} ok / ${m.counts.red} red — ${m.evidence_class.split('—')[0].trim()} (${m.renderer_string})`);
}

const motionManifest = path.join(ART, 'motion', TAG, 'manifest.json');
if (fs.existsSync(motionManifest)) {
  bytes += copy(motionManifest, path.join(REPO, `reports/visual-truth/deck-motion/${TAG}/manifest.json`));
  copied++;
  const m = JSON.parse(fs.readFileSync(motionManifest, 'utf8'));
  console.log(`motion   ${m.counts.ok} ok / ${m.counts.red} red, ${m.counts.frames} frames — ${m.evidence_class.split('—')[0].trim()}`);
  for (const row of m.rows) {
    console.log(`         ${row.status === 'ok' ? 'ok ' : 'RED'} ${row.sequence.padEnd(14)} ${String(row.frames_captured).padStart(3)} frames, ${row.distinct_frames} distinct${row.status === 'ok' ? '' : ` — ${row.reason}`}`);
  }
}

const sheetDir = path.join(ART, 'motion', TAG, 'contact');
if (fs.existsSync(sheetDir)) {
  for (const file of fs.readdirSync(sheetDir).filter((f) => f.endsWith('.png'))) {
    bytes += copy(path.join(sheetDir, file), path.join(REPO, `reports/visual-truth/deck-motion/${TAG}/contact/${file}`));
    copied++;
  }
}

console.log(`\ncollected ${copied} file(s), ${(bytes / 1048576).toFixed(1)} MiB, into reports/visual-truth/`);
console.log('raw frames were deliberately left in the run directory (W1-30-EVIDENCE §5).');
