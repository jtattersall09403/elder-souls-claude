#!/usr/bin/env node
// SWEEP docs/shots/ FOR FIGURES DRAWN WITH THE SHEARED CHART FONT — by reading the PIXELS.
//
// WHY THIS EXISTS. W1-CHARTFONT's damage list was assembled from each chart tool's own `--out`
// paths plus the shot names its owner's status file recorded, and it said so plainly under
// "What was not searched": a figure drawn by one of those tools under an `--out` nobody wrote down
// would be missed, and none of the 155 images was actually looked at. That is a provenance list,
// not a sweep. This is the sweep: it decodes every PNG in docs/shots/ and asks the picture itself
// which glyph table drew it.
//
// HOW. The chart tools render 5x5 glyphs as solid ink rectangles at integer scale on a flat
// background, so a drawn glyph is a 5x5 block of exactly two colours whose ink mask equals one of
// the table's 25-bit strings. Both tables are searched — the SOUND one from tools/lib/chart-font.mjs
// and the archived SHEARED one — and only glyphs on which the two tables DISAGREE are counted as
// evidence, because a glyph they render identically ('L', 'T', ...) says nothing about which drew it.
//
// IT CAN FAIL, and that is checked rather than asserted: `--self-test` renders a known string
// through each table into a scratch bitmap and requires the classifier to name the right one, and
// requires a flat image to be classified as neither.
//
//   node tools/analysis/w1-chartfont-shot-sweep.mjs                 # sweep docs/shots/
//   node tools/analysis/w1-chartfont-shot-sweep.mjs --dir <path>
//   node tools/analysis/w1-chartfont-shot-sweep.mjs --file <png>    # one image, verbose
//   node tools/analysis/w1-chartfont-shot-sweep.mjs --self-test     # prove the classifier can fail
//   node tools/analysis/w1-chartfont-shot-sweep.mjs --json <path>   # write the full result
//
// Exit 3 if any image in the swept directory is classified SHEARED — a published figure whose
// numbers may read as different numbers.

import { readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FONT, SHEARED_FONT, GLYPH_W, GLYPH_H } from '../lib/chart-font.mjs';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..');
const argv = process.argv.slice(2);
const argOf = (f, d = null) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : d; };
const has = (f) => argv.includes(f);

// ---- PNG decode: 8-bit, colour type 2 (RGB) or 6 (RGBA), all five filters, non-interlaced -------
export function decodePng(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error('not a PNG');
  let off = 8, W = 0, H = 0, depth = 0, colour = 0, interlace = 0;
  const idat = [];
  while (off + 8 <= buf.length) {
    const len = buf.readUInt32BE(off);
    const type = buf.toString('ascii', off + 4, off + 8);
    const data = buf.subarray(off + 8, off + 8 + len);
    if (type === 'IHDR') {
      W = data.readUInt32BE(0); H = data.readUInt32BE(4);
      depth = data[8]; colour = data[9]; interlace = data[12];
    } else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    off += 12 + len;
  }
  if (depth !== 8 || interlace !== 0 || (colour !== 2 && colour !== 6)) {
    return { unsupported: `depth=${depth} colour=${colour} interlace=${interlace}` };
  }
  const bpp = colour === 2 ? 3 : 4;
  const stride = W * bpp;
  const raw = inflateSync(Buffer.concat(idat));
  const out = Buffer.alloc(H * stride);
  let prev = Buffer.alloc(stride);
  for (let y = 0; y < H; y++) {
    const f = raw[y * (stride + 1)];
    const line = raw.subarray(y * (stride + 1) + 1, y * (stride + 1) + 1 + stride);
    const cur = out.subarray(y * stride, (y + 1) * stride);
    for (let i = 0; i < stride; i++) {
      const a = i >= bpp ? cur[i - bpp] : 0, b = prev[i], c = i >= bpp ? prev[i - bpp] : 0;
      let v = line[i];
      if (f === 1) v += a;
      else if (f === 2) v += b;
      else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) {
        const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      cur[i] = v & 0xFF;
    }
    prev = cur;
  }
  return { W, H, bpp, px: out };
}

// ---- the two tables, reduced to the glyphs that actually DISTINGUISH them -----------------------
// EVIDENCE IS ALPHANUMERIC ONLY. Punctuation glyphs ('-', '=', '_', ':', '.') are a handful of
// aligned pixels, and a chart is full of axis rules, tick marks and bar edges that reproduce them
// by accident — that is where the false positives live. Letters and digits are where the evidence
// is, and they are also the thing a reader misreads. Punctuation still keeps a RUN alive (a word
// may contain a hyphen); it just never counts as evidence for either table.
const isEvidence = (ch) => /^[A-Z0-9]$/.test(String(ch).toUpperCase());

const soundByPattern = new Map();
const shearedByPattern = new Map();
for (const [ch, bits] of Object.entries(FONT)) {
  if (bits.length !== GLYPH_W * GLYPH_H) continue;
  if (/^0+$/.test(bits)) continue;                       // a blank block is not evidence
  soundByPattern.set(bits, ch);
}
for (const [ch, bits] of Object.entries(SHEARED_FONT)) {
  // The sheared strings are 23 characters; what a 5x5 window can actually SEE of one is the first
  // 25 characters of the string as the renderer indexed it — the last two indices read undefined
  // and drew nothing, i.e. paper.
  const seen = (bits + '00').slice(0, GLYPH_W * GLYPH_H);
  if (/^0+$/.test(seen)) continue;
  shearedByPattern.set(seen, ch);
}
// A pattern present in both tables tells you nothing about which drew it.
const AMBIGUOUS = new Set([...soundByPattern.keys()].filter((p) => shearedByPattern.has(p)));
const SOUND_ONLY = new Map([...soundByPattern].filter(([p, ch]) => !AMBIGUOUS.has(p) && isEvidence(ch)));
const SHEARED_ONLY = new Map([...shearedByPattern].filter(([p, ch]) => !AMBIGUOUS.has(p) && isEvidence(ch)));

// ---- the classifier -----------------------------------------------------------------------------
//
// A FIRST VERSION OF THIS COUNTED EVERY 5x5 TWO-COLOUR BLOCK THAT MATCHED A GLYPH, AND IT WAS
// WORTHLESS. It passed its own self-test and then classified all four known-sheared figures as
// "sound", because a chart is full of flat rectangles and axis rules, and a 5x5 window slid over
// those produces tens of thousands of accidental matches for '-', '=', '(' and friends — 46,539 on
// one figure, swamping the ~700 real glyphs. The fixture had no plot on it, so the fixture could
// not see the problem. (Rule 4: this is what calibrating against known-label real data is for.)
//
// So a hit only counts inside a RUN: three or more glyph cells at the same baseline, on the same
// 6*scale advance the renderer uses, sharing ONE ink colour and ONE paper colour. That is a word.
// Axis furniture does not produce words.
const ADVANCE_MULT = 6;

export function classify(img, scales = [1, 2, 3]) {
  const { W, H, bpp, px } = img;
  const at = (x, y) => { const i = (y * W + x) * bpp; return (px[i] << 16) | (px[i + 1] << 8) | px[i + 2]; };
  const sound = new Map(), sheared = new Map();
  let runs = 0, cellsSeen = 0;

  for (const s of scales) {
    const adv = ADVANCE_MULT * s;
    const maxX = W - GLYPH_W * s, maxY = H - GLYPH_H * s;
    // consumed[y] holds the x past which this baseline has already been attributed to a run
    const consumed = new Int32Array(H).fill(-1);

    // Read one cell as an ink mask given a fixed (ink, paper) pair. null if it uses any other colour.
    const cellMask = (x, y, ink, paper) => {
      let m = '';
      for (let j = 0; j < GLYPH_H; j++) {
        for (let i = 0; i < GLYPH_W; i++) {
          const c = at(x + i * s, y + j * s);
          if (c === ink) m += '1';
          else if (c === paper) m += '0';
          else return null;
        }
      }
      return m;
    };

    for (let y = 0; y <= maxY; y++) {
      for (let x = 0; x <= maxX; x++) {
        if (x <= consumed[y]) continue;
        // Seed: this cell must be two colours and a known glyph under one of the two assignments.
        let cA = -1, cB = -1, bad = false;
        const raw = new Array(GLYPH_W * GLYPH_H);
        for (let j = 0; j < GLYPH_H && !bad; j++) {
          for (let i = 0; i < GLYPH_W; i++) {
            const c = at(x + i * s, y + j * s);
            if (cA < 0 || c === cA) { cA = c; raw[j * GLYPH_W + i] = 0; continue; }
            if (cB < 0 || c === cB) { cB = c; raw[j * GLYPH_W + i] = 1; continue; }
            bad = true; break;
          }
        }
        if (bad || cB < 0) continue;

        // Try both ink/paper assignments; take whichever yields the longer run.
        let best = null;
        for (const [ink, paper] of [[cB, cA], [cA, cB]]) {
          const seed = cellMask(x, y, ink, paper);
          if (seed === null) continue;
          if (!soundByPattern.has(seed) && !shearedByPattern.has(seed)) continue;
          const cells = [seed];
          for (let k = 1; ; k++) {
            const nx = x + k * adv;
            if (nx > maxX) break;
            const m = cellMask(nx, y, ink, paper);
            // a blank cell is a legal space and keeps the run going; anything unknown ends it
            if (m === null) break;
            if (!/^0+$/.test(m) && !soundByPattern.has(m) && !shearedByPattern.has(m)) break;
            cells.push(m);
          }
          const inked = cells.filter((m) => !/^0+$/.test(m));
          if (inked.length >= 3 && (!best || inked.length > best.inked.length)) best = { cells, inked };
        }
        if (!best) continue;

        runs++;
        consumed[y] = x + (best.cells.length - 1) * adv + GLYPH_W * s;
        for (const m of best.inked) {
          cellsSeen++;
          const so = SOUND_ONLY.get(m); if (so !== undefined) sound.set(so, (sound.get(so) || 0) + 1);
          const sh = SHEARED_ONLY.get(m); if (sh !== undefined) sheared.set(sh, (sheared.get(sh) || 0) + 1);
        }
      }
    }
  }

  const nS = [...sound.values()].reduce((a, b) => a + b, 0);
  const nX = [...sheared.values()].reduce((a, b) => a + b, 0);

  // DECIDE ON THE RATIO, NOT THE COUNTS, and the reason is the defect itself: a sheared glyph's
  // bitmap frequently EQUALS some other sound glyph (a sheared `2` is a sound `8`), so a genuinely
  // sheared figure still scores plenty of sound-only hits. What separates them cleanly is how often
  // a sheared-only pattern appears at all. Calibrated against the four archived pre-fix figures and
  // their regenerated counterparts, with known labels:
  //     sheared figures   0.22 .. 0.87        fixed figures   0.003 .. 0.007
  // Two orders of magnitude apart, so the cut sits at 0.05 with room either side.
  const total = nS + nX;
  const ratio = total ? nX / total : 0;
  let verdict = 'not-a-chart-font-figure';
  if (total >= 20) verdict = ratio >= 0.05 ? 'SHEARED' : 'sound';
  else if (total >= 6) verdict = 'ambiguous';
  return {
    verdict,
    sound_hits: nS,
    sheared_hits: nX,
    sheared_ratio: Number(ratio.toFixed(4)),
    runs,
    glyph_cells: cellsSeen,
    sound_glyphs: [...sound.keys()].sort().join(''),
    sheared_glyphs: [...sheared.keys()].sort().join(''),
  };
}

// ---- self-test: the classifier must be able to be wrong -----------------------------------------
function renderToImage(str, font, scale = 2, pad = 4) {
  const W = pad * 2 + str.length * 6 * scale, H = pad * 2 + GLYPH_H * scale;
  const px = Buffer.alloc(W * H * 3, 0x12);
  const set = (x, y) => { const i = (y * W + x) * 3; px[i] = 0xEE; px[i + 1] = 0xEE; px[i + 2] = 0xE4; };
  let cx = pad;
  for (const ch of str.toUpperCase()) {
    const bits = font[ch];
    if (bits) for (let j = 0; j < GLYPH_H; j++) for (let i = 0; i < GLYPH_W; i++) {
      if (bits[j * GLYPH_W + i] === '1') for (let dy = 0; dy < scale; dy++) for (let dx = 0; dx < scale; dx++) set(cx + i * scale + dx, pad + j * scale + dy);
    }
    cx += 6 * scale;
  }
  return { W, H, bpp: 3, px };
}

if (has('--self-test')) {
  const S = '28 OF 32 BOOK 3456789 ABDGNPQRX';
  const a = classify(renderToImage(S, FONT));
  const b = classify(renderToImage(S, SHEARED_FONT));
  const flat = classify({ W: 400, H: 200, bpp: 3, px: Buffer.alloc(400 * 200 * 3, 0x12) });
  console.log('\nw1-chartfont-shot-sweep --self-test\n');
  console.log(`  [${a.verdict === 'sound' ? 'PASS' : 'FAIL'}] a bitmap drawn with the FIXED table classifies "sound"     (sound ${a.sound_hits} / sheared ${a.sheared_hits})`);
  console.log(`  [${b.verdict === 'SHEARED' ? 'PASS' : 'FAIL'}] a bitmap drawn with the PRE-FIX table classifies "SHEARED"  (sound ${b.sound_hits} / sheared ${b.sheared_hits})`);
  console.log(`  [${flat.verdict === 'not-a-chart-font-figure' ? 'PASS' : 'FAIL'}] a flat image with no text classifies as neither             (sound ${flat.sound_hits} / sheared ${flat.sheared_hits})`);
  console.log(`\n  ${SOUND_ONLY.size} distinguishing sound patterns, ${SHEARED_ONLY.size} distinguishing sheared patterns, ${AMBIGUOUS.size} identical in both (not evidence).`);
  const ok = a.verdict === 'sound' && b.verdict === 'SHEARED' && flat.verdict === 'not-a-chart-font-figure';
  console.log(`\n  self-test ${ok ? 'PASS' : 'FAIL'}\n`);
  process.exit(ok ? 0 : 1);
}

// ---- sweep ---------------------------------------------------------------------------------------
const one = argOf('--file');
const dir = argOf('--dir', join(ROOT, 'docs/shots'));
const files = one ? [one] : readdirSync(dir).filter((f) => f.toLowerCase().endsWith('.png')).sort().map((f) => join(dir, f));

const rows = [];
for (const f of files) {
  let r;
  try {
    const img = decodePng(readFileSync(f));
    if (img.unsupported) r = { verdict: 'undecodable', note: img.unsupported };
    else r = { ...classify(img), w: img.W, h: img.H };
  } catch (e) { r = { verdict: 'undecodable', note: String(e.message || e) }; }
  rows.push({ file: basename(f), ...r });
  if (one) console.log(JSON.stringify(rows[0], null, 2));
}

if (!one) {
  const bad = rows.filter((r) => r.verdict === 'SHEARED');
  const good = rows.filter((r) => r.verdict === 'sound');
  const amb = rows.filter((r) => r.verdict === 'ambiguous');
  const und = rows.filter((r) => r.verdict === 'undecodable');
  console.log(`\n  swept ${rows.length} PNG(s) in ${dir.replace(ROOT + '/', '')}`);
  console.log(`  ${good.length} drawn with the FIXED chart font, ${bad.length} with the SHEARED one,`);
  console.log(`  ${amb.length} ambiguous, ${und.length} undecodable, ${rows.length - good.length - bad.length - amb.length - und.length} not chart-font figures at all.\n`);
  if (bad.length) {
    console.log('  SHEARED — published figures whose numbers may read as different numbers:');
    for (const r of bad) console.log(`    ${r.file}\n      ${r.sheared_hits} sheared vs ${r.sound_hits} sound glyph hits; sheared glyphs seen: ${r.sheared_glyphs}`);
    console.log();
  }
  if (good.length) {
    console.log('  drawn with the fixed font:');
    for (const r of good) console.log(`    ${r.file}   (${r.sound_hits} hits)`);
    console.log();
  }
  if (amb.length) { console.log('  ambiguous:'); for (const r of amb) console.log(`    ${r.file}  sound ${r.sound_hits} / sheared ${r.sheared_hits}`); console.log(); }
  if (und.length) { console.log(`  undecodable (${und.length}): ${und.slice(0, 4).map((r) => r.file).join(', ')}${und.length > 4 ? ' …' : ''}\n`); }

  const jsonPath = argOf('--json');
  if (jsonPath) { mkdirSync(dirname(jsonPath), { recursive: true }); writeFileSync(jsonPath, JSON.stringify({ dir, swept: rows.length, rows }, null, 2)); console.log(`  -> ${jsonPath}\n`); }
  if (bad.length) process.exitCode = 3;
}
