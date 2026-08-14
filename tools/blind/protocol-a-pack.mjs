#!/usr/bin/env node
/**
 * protocol-a-pack.mjs — assemble the RI-VIS06 Protocol A pack from a pairing table.
 *
 * WHAT THIS ADDS TO THE TWO TOOLS IT CALLS, AND WHY IT IS NOT EITHER OF THEM
 * -------------------------------------------------------------------------
 *   make-image-pair.mjs  normalises ONE crop (native 1:1 window, shared JPEG quantiser, one PNG
 *                        writer). It knows nothing about pairs.
 *   make-pair.mjs        does the coin flip, the A/B naming and the sealed key, and it is the
 *                        audited tool for exactly that. It copies whatever bytes it is given.
 *
 * Neither knows the two things that decide whether this pack is admissible:
 *
 * 1. RI-VIS06 §A: the judge is given "the two images, the prompt below, and NOTHING ELSE".
 *    make-pair.mjs writes `PROMPT.md` and `pack.json` INTO the pack directory. `pack.json` names
 *    the governing corpus item and `PROMPT.md` asks make-pair's own generic question, which is
 *    not Protocol A's verbatim prompt — shipping it would be prompt drift, which §"how we lose"
 *    lists as a way the instrument dies. So this tool RELOCATES both into the reveal directory
 *    (it does not delete them — they are the audit trail) and then asserts that each pack
 *    directory contains exactly A.png and B.png and nothing else.
 *
 * 2. RULING S51: a blind pack whose counterpart arm is derivable from the item's own tables is
 *    void. The pairing table this tool reads names, per pair, our frame and the reference plate.
 *    That table is a KEY, not a manifest, and it is written to the reveal side. Nothing that
 *    travels with the images says what either arm depicts, which time of day it is, which
 *    profile it matched, or how many pairs share a source.
 *
 * PIXEL-DENSITY PARITY IS ENFORCED, NOT HOPED FOR. A 512x512 native crop out of a 3840x2160
 * plate covers half the angular field of the same crop out of a 1920x1080 frame, so surfaces
 * arrive magnified on one arm — an appearance change landing on exactly one side, which is the
 * leak RI-VIS06 "how we lose" describes as teaching you nothing about fidelity. This tool
 * REFUSES a pair whose two sources differ in dimensions unless --allow-density-mismatch is
 * passed, and records the mismatch in the reveal when it is.
 *
 * USAGE
 *   node tools/blind/protocol-a-pack.mjs --table <pairing.json> --out <dir> [--seed <n>] [--force]
 *
 * OUTPUT
 *   <out>/packs/<pair>/A.png, B.png     <- the ONLY thing a judge ever receives
 *   <out>/reveal/<pair>.reveal/         <- mapping.json (the sealed key), plus the relocated
 *                                          PROMPT.md and pack.json and the crop record
 *   <out>/reveal/PAIRING-KEY.json       <- the whole table, resolved. SEALED.
 *
 * EXIT  0 built and self-asserted; 2 a pair was refused; 1 usage/IO.
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');

const argv = process.argv.slice(2);
const args = {};
for (let i = 0; i < argv.length; i++) {
  if (!argv[i].startsWith('--')) continue;
  const k = argv[i].slice(2);
  args[k] = (argv[i + 1] && !argv[i + 1].startsWith('--')) ? argv[++i] : true;
}
if (!args.table || !args.out) {
  console.error('usage: node tools/blind/protocol-a-pack.mjs --table <pairing.json> --out <dir> [--seed <n>] [--force]');
  process.exit(1);
}

const table = JSON.parse(fs.readFileSync(path.resolve(String(args.table)), 'utf8'));
const outRoot = path.resolve(String(args.out));
const packsDir = path.join(outRoot, 'packs');
const revealRoot = path.join(outRoot, 'reveal');
const workDir = path.join(revealRoot, 'crops');
if (fs.existsSync(packsDir) && fs.readdirSync(packsDir).length && !args.force) {
  console.error(`${packsDir} already exists and is not empty (use --force)`);
  process.exit(1);
}
fs.rmSync(packsDir, { recursive: true, force: true });
fs.rmSync(revealRoot, { recursive: true, force: true });
for (const d of [packsDir, revealRoot, workDir]) fs.mkdirSync(d, { recursive: true });

const dims = (p) => JSON.parse(execFileSync('python3', ['-c',
  'import sys,json\nfrom PIL import Image\nim=Image.open(sys.argv[1])\nprint(json.dumps({"w":im.size[0],"h":im.size[1],"format":im.format}))', p], { encoding: 'utf8' }));

function normalise(src, crop, dst, jpegQ) {
  const out = execFileSync(process.execPath, [
    path.join(HERE, 'make-image-pair.mjs'), '--in', src, '--crop', crop, '--out', dst, '--jpeg-q', String(jpegQ),
  ], { encoding: 'utf8' });
  return JSON.parse(out);
}

const seedBase = args.seed !== undefined ? Number(args.seed) : 20260814;
const jpegQ = table.jpeg_q ?? 95;
const built = [];
let refused = 0;

for (const [i, pair] of table.pairs.entries()) {
  const name = pair.id;
  const oursSrc = path.resolve(ROOT, pair.ours.file);
  const refSrc = path.resolve(ROOT, pair.ref.file);
  for (const [label, p] of [['ours', oursSrc], ['ref', refSrc]]) {
    if (!fs.existsSync(p)) { console.error(`REFUSED ${name}: ${label} source missing: ${p}`); refused++; continue; }
  }
  if (!fs.existsSync(oursSrc) || !fs.existsSync(refSrc)) continue;

  const dOurs = dims(oursSrc); const dRef = dims(refSrc);
  if ((dOurs.w !== dRef.w || dOurs.h !== dRef.h) && !args['allow-density-mismatch']) {
    console.error(`REFUSED ${name}: source dimensions differ (${dOurs.w}x${dOurs.h} vs ${dRef.w}x${dRef.h}). A native crop out of the larger frame arrives magnified — that is an appearance change on one arm only. Pass --allow-density-mismatch to accept and record it.`);
    refused++;
    continue;
  }

  const oursPng = path.join(workDir, `${name}__ours.png`);
  const refPng = path.join(workDir, `${name}__ref.png`);
  const rOurs = normalise(oursSrc, pair.ours.crop, oursPng, jpegQ);
  const rRef = normalise(refSrc, pair.ref.crop, refPng, jpegQ);
  if (rOurs.error || rRef.error) { console.error(`REFUSED ${name}: ${rOurs.error || rRef.error}`); refused++; continue; }

  const packDir = path.join(packsDir, name);
  const revealDir = path.join(revealRoot, `${name}.reveal`);
  execFileSync(process.execPath, [
    path.join(HERE, 'make-pair.mjs'),
    '--ours', oursPng, '--ref', refPng,
    '--out', packDir, '--reveal', revealDir,
    '--seed', String(seedBase + i), '--kind', 'image',
    '--item', 'RI-VIS06', '--force',
    // This question is never shown to the judge — PROMPT.md is relocated below. It is recorded
    // so the reveal says what pack machinery was used.
    '--question', 'RI-VIS06 Protocol A — the verbatim prompt is PROMPT-A-verbatim.txt, not this file.',
  ], { encoding: 'utf8', stdio: 'pipe' });

  // RI-VIS06 §A "nothing else": relocate, do not delete — these are the audit trail.
  for (const f of ['PROMPT.md', 'pack.json']) {
    const from = path.join(packDir, f);
    if (fs.existsSync(from)) fs.renameSync(from, path.join(revealDir, `make-pair.${f}`));
  }
  fs.writeFileSync(path.join(revealDir, 'crop-record.json'), JSON.stringify({
    pair: name,
    ours: { source: pair.ours.file, crop: pair.ours.crop, source_size: rOurs.source_size, note: rOurs.note },
    ref: { source: pair.ref.file, crop: pair.ref.crop, source_size: rRef.source_size, note: rRef.note },
    density_parity: dOurs.w === dRef.w && dOurs.h === dRef.h,
    lighting_match: pair.match || null,
    mismatch_recorded: pair.mismatch || null,
  }, null, 2) + '\n');

  // ASSERT the pack is exactly two images. A pack that quietly grew a file is a pack that leaks.
  const contents = fs.readdirSync(packDir).sort();
  if (contents.length !== 2 || contents[0] !== 'A.png' || contents[1] !== 'B.png') {
    console.error(`REFUSED ${name}: pack directory holds ${JSON.stringify(contents)}, not exactly [A.png, B.png]`);
    refused++;
    continue;
  }
  built.push({ name, ours: pair.ours, ref: pair.ref, density_parity: dOurs.w === dRef.w && dOurs.h === dRef.h });
  console.log(`built ${name}: ours ${path.basename(pair.ours.file)} @${pair.ours.crop}  ref ${path.basename(pair.ref.file)} @${pair.ref.crop}`);
}

fs.writeFileSync(path.join(revealRoot, 'PAIRING-KEY.json'), JSON.stringify({
  schema: 'elder-souls/protocol-a-pairing-key@1',
  warning: 'SEALED. This file names which frame is on which arm. Ruling S51: it must not travel with the pack.',
  seed_base: seedBase, jpeg_q: jpegQ, built, refused,
  table_source: String(args.table),
}, null, 2) + '\n');

console.log(`\n${built.length} pair(s) built, ${refused} refused. Packs: ${packsDir}. SEALED key: ${revealRoot}`);
process.exit(refused ? 2 : 0);
