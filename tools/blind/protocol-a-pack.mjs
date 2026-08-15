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
 * COUNTERBALANCED SIDE ASSIGNMENT (--sides), ADDED FOR r2
 * ------------------------------------------------------
 * `W1-VISUAL-BLIND-PROTOCOL-A-r1` §1 ruled, reversibly, that a free coin flip per pair is a weak
 * design: r1's flips put ours on B in four of five pairs, so exactly ONE trial could distinguish
 * "the judge answers the letter A" from "the judge answers the reference", and a 5:0 flip would
 * have left the positional-bias check with no power at all. The ruling: with n pairs, ours sits on
 * A for exactly ceil(n/2) of them, **assignment fixed before any image is looked at**.
 *
 * This is NOT the runner choosing a side after seeing an answer. `--sides A,B,A,B,A` is a plan
 * declared on the command line; the tool then searches upward from `seedBase + i` for the first
 * seed whose mulberry32 first draw lands ours on the planned side, and records both the planned
 * side and the number of seeds skipped in the reveal. make-pair.mjs is not modified and still does
 * the assignment itself — the seed is the only thing chosen here, and a seed carries no
 * information a judge can see (a judge receives two files named A.png and B.png).
 *
 * BYTE-LENGTH EQUALISATION (--equalise-bytes), ADDED FOR r2
 * ---------------------------------------------------------
 * `bytes` is one of image-leakcheck's HELD-OUT provenance channels: if file length sorts the arms
 * on every pair, the pack is decidable without decoding a pixel and the gate goes RED. r1 escaped
 * it by luck — our arm was the larger file on 4 of 5 pairs, one short of a sweep. r2 swept 5/5,
 * and the reason is the work under test: a render with real material detail and an occlusion term
 * carries more high-frequency content than one without, and PNG pays for that in bytes while the
 * reference arms (JPEG-sourced, DCT-smoothed) do not move at all. **The improvement is what tripped
 * the guard.**
 *
 * The fix must not touch a pixel, so it operates on the container: each arm is padded with a
 * zero-filled private ancillary PNG chunk (`esPd`, ancillary + private + safe-to-copy) until both
 * files are EXACTLY the same length. image-leakcheck excludes ties from the denominator by design
 * — the same reason `w` and `h` do not read as channels — so an equalised `bytes` reports
 * `0/0 (5 tied)` and carries no information in either direction, which is a stronger claim than
 * "did not happen to sweep". The chunk is identical in type on both arms, contains only zeros, and
 * is not one of the metadata chunks the structural gate reads (`tEXt`/`iTXt`/`zTXt`/`eXIf`/`tIME`/
 * `pHYs`/`iCCP`/`sRGB`/`gAMA`), so it adds no readable payload.
 *
 * This is an ACTIVE EQUALISATION and it is recorded as one: a `bytes` tie in an equalised pack is
 * true by construction and is NOT evidence of blindness, exactly as image-leakcheck's `matched`
 * column says of width and height.
 *
 * USAGE
 *   node tools/blind/protocol-a-pack.mjs --table <pairing.json> --out <dir> [--seed <n>] [--force]
 *                                        [--sides A,B,A,B,A] [--equalise-bytes]
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
// The sealed key defaults to a sibling of the pack root, NOT a child of it. A judge handed the
// pack directory must not be able to walk into the key by opening the parent — RI-VIS06 §D's
// "key read before judging" row, made structural instead of procedural.
const packsDir = path.join(outRoot, 'packs');
const revealRoot = args['reveal-root'] ? path.resolve(String(args['reveal-root'])) : path.join(outRoot, 'reveal');
if (revealRoot === packsDir || revealRoot.startsWith(packsDir + path.sep)) {
  console.error('the sealed key must not live inside the pack tree');
  process.exit(1);
}
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

// --- counterbalanced side assignment (see header). Mirrors make-pair.mjs exactly. ---
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const oursIsAFor = (seed) => mulberry32(seed)() < 0.5;

let plannedSides = null;
if (args.sides) {
  plannedSides = String(args.sides).split(',').map((s) => s.trim().toUpperCase());
  if (plannedSides.length !== table.pairs.length || plannedSides.some((s) => s !== 'A' && s !== 'B')) {
    console.error(`--sides must be ${table.pairs.length} comma-separated A/B entries, one per pair, naming the side OURS sits on`);
    process.exit(1);
  }
  const onA = plannedSides.filter((s) => s === 'A').length;
  const want = Math.ceil(plannedSides.length / 2);
  if (onA !== want) {
    console.error(`--sides puts ours on A for ${onA} of ${plannedSides.length} pairs; the r1 ruling requires exactly ceil(n/2) = ${want}`);
    process.exit(1);
  }
}
const sideSearch = [];
const byteEqualisation = [];

/**
 * Pad a PNG to exactly `target` bytes by inserting one zero-filled private ancillary chunk
 * immediately before IEND. Pixels are untouched; the decoded image is bit-identical.
 */
function padPngTo(file, target) {
  const buf = fs.readFileSync(file);
  const need = target - buf.length - 12; // 12 = length(4) + type(4) + crc(4)
  if (need < 0) throw new Error(`${file} is already ${buf.length} bytes, past target ${target}`);
  const iend = buf.length - 12; // IEND is always the final 12 bytes of a valid PNG
  if (buf.subarray(iend + 4, iend + 8).toString('latin1') !== 'IEND') throw new Error(`${file}: no IEND where one must be`);
  const type = Buffer.from('esPd', 'latin1');
  const data = Buffer.alloc(need, 0);
  const len = Buffer.alloc(4); len.writeUInt32BE(need, 0);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([type, data])), 0);
  fs.writeFileSync(file, Buffer.concat([buf.subarray(0, iend), len, type, data, crc, buf.subarray(iend)]));
}
const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1); t[n] = c; }
  return t;
})();
function crc32(b) { let c = 0xFFFFFFFF; for (let i = 0; i < b.length; i++) c = CRC_TABLE[(c ^ b[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }

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

  let pairSeed = seedBase + i;
  if (plannedSides) {
    const wantA = plannedSides[i] === 'A';
    let skipped = 0;
    while (oursIsAFor(pairSeed) !== wantA) { pairSeed++; skipped++; }
    sideSearch.push({ pair: name, planned_ours_side: plannedSides[i], seed_start: seedBase + i, seed_used: pairSeed, seeds_skipped: skipped });
  }

  execFileSync(process.execPath, [
    path.join(HERE, 'make-pair.mjs'),
    '--ours', oursPng, '--ref', refPng,
    '--out', packDir, '--reveal', revealDir,
    '--seed', String(pairSeed), '--kind', 'image',
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

  if (args['equalise-bytes']) {
    const A = path.join(packDir, 'A.png'); const B = path.join(packDir, 'B.png');
    const target = Math.max(fs.statSync(A).size, fs.statSync(B).size) + 12 + 16;
    for (const f of [A, B]) padPngTo(f, target);
    const sa = fs.statSync(A).size; const sb = fs.statSync(B).size;
    if (sa !== sb || sa !== target) { console.error(`REFUSED ${name}: byte equalisation failed (${sa} vs ${sb}, target ${target})`); refused++; continue; }
    byteEqualisation.push({ pair: name, target_bytes: target });
  }

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
  counterbalanced: plannedSides ? {
    ruling: 'W1-VISUAL-BLIND-PROTOCOL-A-r1 §1 — ours on A for exactly ceil(n/2) pairs, planned before any image was looked at',
    planned_ours_side: plannedSides,
    seed_search: sideSearch,
  } : null,
  byte_equalisation: byteEqualisation.length ? {
    what: 'both arms padded to an identical file length with a zero-filled private ancillary PNG chunk (esPd) before IEND; pixels untouched',
    why: 'image-leakcheck `bytes` is a held-out provenance channel and it swept 5/5 on the un-equalised r2 pack — a render with real material detail costs more PNG bytes than a JPEG-sourced reference crop, so the improvement under test was itself the leak',
    status: 'ACTIVE EQUALISATION — a `bytes` tie in this pack is true by construction and is NOT evidence of blindness',
    pairs: byteEqualisation,
  } : null,
}, null, 2) + '\n');

console.log(`\n${built.length} pair(s) built, ${refused} refused. Packs: ${packsDir}. SEALED key: ${revealRoot}`);
process.exit(refused ? 2 : 0);
