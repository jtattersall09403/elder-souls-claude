#!/usr/bin/env node
/**
 * f10-r2-pair-sheet.mjs — BEFORE beside AFTER, in one image the owner can open on a phone.
 *
 * WHY A PAIR SHEET AND NOT TWO CONTACT SHEETS. `contact-sheet.mjs` tiles one directory, which
 * answers "what did this run capture". The question here is different and it is comparative:
 * *does it look better?* Two galleries in two files make the reader hold one image in their head
 * while looking at the other, and that is exactly the comparison people get wrong. So every tile
 * here is a PAIR — the same subject, the same camera bearing, the same world seed, rendered by
 * the same GPU, differing only in the four files under `game/src/render/` — with the baseline on
 * the left and today's tree on the right.
 *
 * IT ALSO CARRIES THE FRAME-SANITY NUMBERS, per frame, because of HAZARDS §15: a capture path can
 * return a frame that is not a picture of anything (one distinct shadow level, zero local
 * contrast) and every gate in this project stayed green while it did. Each frame's luma p10/p90,
 * distinct shadow levels and median local contrast are computed here and written next to the
 * sheet as JSON, so a reader can see that these are images before reading anything into them.
 * The numbers are NOT a subject-presence gate: the last one written for F10 false-REDed on 16 of
 * 16 real captures, and the honest procedure is to open the frames and look, which is what the
 * agent producing this sheet did.
 *
 * Usage:
 *   node tools/visual/f10-r2-pair-sheet.mjs --before <dir> --after <dir> --out sheet.png \
 *        --match ORBIT__player --cols 2 --scale 0.5 --title "PLAYER, EIGHT ANGLES"
 */
import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';

const args = {};
for (let i = 2; i < process.argv.length; i++) {
  if (!process.argv[i].startsWith('--')) continue;
  const k = process.argv[i].slice(2);
  args[k] = (process.argv[i + 1] && !process.argv[i + 1].startsWith('--')) ? process.argv[++i] : true;
}
const BEFORE = path.resolve(args.before);
const AFTER = path.resolve(args.after);
const OUT = path.resolve(args.out || 'pair-sheet.png');
const COLS = Number(args.cols || 2);
const SCALE = Number(args.scale || 0.5);
const EVERY = Number(args.every || 1);
const TITLE = String(args.title || 'BEFORE  VS  AFTER');
const PAD = 6;

// ---- 5x7 bitmap font, same shapes as tools/visual/contact-sheet.mjs ------------------------
const GLYPHS = {
  A: '01100100101111010011001100110', B: '11110100101111010010100111110', C: '01110100011000010000100001110',
  D: '11110100101001010010100111110', E: '11111100001111010000100011111', F: '11111100001111010000100010000',
  G: '01110100001011110010100101110', H: '10010100101111010010100110010', I: '11100010000100001000010011100',
  J: '00111000100001000010100101100', K: '10010101001100010100100101001', L: '10000100001000010000100011111',
  M: '10001110111010110001100011000', N: '10010110101101010011100110010', O: '01100100101001010010100101100',
  P: '11110100101111010000100010000', Q: '01100100101001010110100101101', R: '11110100101111010100100101001',
  S: '01111100000111000001000011110', T: '11111001000010000100001000010', U: '10010100101001010010100101100',
  V: '10001100011000101010010100100', W: '10001100011000110101101010001', X: '10001010100010001010100010001',
  Y: '10001010100010000100001000010', Z: '11111000100010001000100011111',
  0: '01100100101011010010100101100', 1: '00100011000010000100001001110', 2: '01100100100010001000100011110',
  3: '11110000100110000001100101100', 4: '00010001100101010010111110001', 5: '11111100001111000001100101100',
  6: '00110010001111010010100101100', 7: '11111000010001000100010000100', 8: '01100100100110010010100101100',
  9: '01100100101001001110000100110',
  '-': '00000000000111100000000000000', '_': '00000000000000000000000011111', '.': '00000000000000000000000000100',
  ' ': '00000000000000000000000000000', ':': '00000001000000000000010000000',
};
function drawText(png, text, ox, oy, scale = 1, rgb = [255, 240, 200]) {
  const s = String(text).toUpperCase();
  for (let ci = 0; ci < s.length; ci++) {
    const bits = GLYPHS[s[ci]] || GLYPHS[' '];
    for (let r = 0; r < 7; r++) for (let c = 0; c < 5; c++) {
      if (bits[r * 5 + c] !== '1') continue;
      for (let dy = 0; dy < scale; dy++) for (let dx = 0; dx < scale; dx++) {
        const x = ox + (ci * 6 + c) * scale + dx, y = oy + r * scale + dy;
        if (x < 0 || y < 0 || x >= png.width || y >= png.height) continue;
        const i = (png.width * y + x) << 2;
        png.data[i] = rgb[0]; png.data[i + 1] = rgb[1]; png.data[i + 2] = rgb[2]; png.data[i + 3] = 255;
      }
    }
  }
}

function shrink(png, scale) {
  const w = Math.max(1, Math.round(png.width * scale));
  const h = Math.max(1, Math.round(png.height * scale));
  const out = new PNG({ width: w, height: h });
  const sx = png.width / w, sy = png.height / h;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let r = 0, g = 0, b = 0, n = 0;
    const x0 = Math.floor(x * sx), x1 = Math.max(x0 + 1, Math.floor((x + 1) * sx));
    const y0 = Math.floor(y * sy), y1 = Math.max(y0 + 1, Math.floor((y + 1) * sy));
    for (let yy = y0; yy < y1 && yy < png.height; yy++) for (let xx = x0; xx < x1 && xx < png.width; xx++) {
      const i = (png.width * yy + xx) << 2;
      r += png.data[i]; g += png.data[i + 1]; b += png.data[i + 2]; n++;
    }
    const o = (w * y + x) << 2;
    out.data[o] = r / n; out.data[o + 1] = g / n; out.data[o + 2] = b / n; out.data[o + 3] = 255;
  }
  return out;
}

/** HAZARDS §15: is this a picture at all? Luma spread, distinct shadow levels, local contrast. */
export function frameStats(png) {
  const luma = new Float64Array(png.width * png.height);
  for (let i = 0, p = 0; i < png.data.length; i += 4, p++) {
    luma[p] = 0.2126 * png.data[i] + 0.7152 * png.data[i + 1] + 0.0722 * png.data[i + 2];
  }
  const sorted = Float64Array.from(luma).sort();
  const q = (f) => sorted[Math.min(sorted.length - 1, Math.max(0, Math.floor(f * sorted.length)))];
  // "Shadow levels": distinct quantised luma buckets in the darkest quarter of the range.
  const shadowMax = q(0.25);
  const buckets = new Set();
  for (let p = 0; p < luma.length; p++) if (luma[p] <= shadowMax) buckets.add(Math.round(luma[p]));
  // Local contrast: |centre - 4-neighbour mean|, median over a sparse grid.
  const lc = [];
  for (let y = 1; y < png.height - 1; y += 3) for (let x = 1; x < png.width - 1; x += 3) {
    const c = luma[y * png.width + x];
    const m = (luma[(y - 1) * png.width + x] + luma[(y + 1) * png.width + x]
      + luma[y * png.width + x - 1] + luma[y * png.width + x + 1]) / 4;
    lc.push(Math.abs(c - m));
  }
  lc.sort((a, b) => a - b);
  return {
    p10: +q(0.10).toFixed(3),
    p50: +q(0.50).toFixed(3),
    p90: +q(0.90).toFixed(3),
    span: +(q(0.99) - q(0.01)).toFixed(3),
    shadow_levels: buckets.size,
    local_contrast_med: +(lc[Math.floor(lc.length / 2)] || 0).toFixed(3),
  };
}

function main() {
  let names = fs.readdirSync(AFTER).filter((f) => f.endsWith('.png')).sort();
  if (args.match) {
    const pats = String(args.match).split(',');
    names = names.filter((f) => pats.some((p) => f.includes(p)));
  }
  names = names.filter((_, i) => i % EVERY === 0);
  const pairs = names.filter((f) => fs.existsSync(path.join(BEFORE, f)));
  const unpaired = names.filter((f) => !fs.existsSync(path.join(BEFORE, f)));
  if (!pairs.length) { console.error(`no paired frames for match '${args.match || '*'}'`); process.exit(2); }

  const stats = [];
  const cells = pairs.map((name) => {
    const b = PNG.sync.read(fs.readFileSync(path.join(BEFORE, name)));
    const a = PNG.sync.read(fs.readFileSync(path.join(AFTER, name)));
    stats.push({ file: name, before: frameStats(b), after: frameStats(a) });
    return { name, b: shrink(b, SCALE), a: shrink(a, SCALE) };
  });

  const IW = Math.max(...cells.map((c) => Math.max(c.b.width, c.a.width)));
  const IH = Math.max(...cells.map((c) => Math.max(c.b.height, c.a.height)));
  const GAP = 3;
  const LABEL_H = 12;
  const CELL_W = IW * 2 + GAP;
  const CELL_H = IH + LABEL_H;
  const HEAD_H = 34;
  const rowsN = Math.ceil(cells.length / COLS);
  const sheet = new PNG({ width: COLS * (CELL_W + PAD) + PAD, height: HEAD_H + rowsN * (CELL_H + PAD) + PAD });
  for (let i = 0; i < sheet.data.length; i += 4) {
    sheet.data[i] = 16; sheet.data[i + 1] = 18; sheet.data[i + 2] = 20; sheet.data[i + 3] = 255;
  }
  drawText(sheet, TITLE.slice(0, Math.floor(sheet.width / 12)), PAD, 5, 2, [255, 245, 215]);
  drawText(sheet, 'LEFT: BEFORE   RIGHT: AFTER', PAD, 22, 1, [170, 200, 255]);

  const blit = (src, ox, oy, tint) => {
    for (let y = 0; y < src.height; y++) for (let x = 0; x < src.width; x++) {
      const si = (src.width * y + x) << 2;
      const di = (sheet.width * (oy + y) + ox + x) << 2;
      if (di < 0 || di >= sheet.data.length) continue;
      sheet.data[di] = src.data[si]; sheet.data[di + 1] = src.data[si + 1];
      sheet.data[di + 2] = src.data[si + 2]; sheet.data[di + 3] = 255;
    }
    // A one-pixel edge in the arm's colour, so a reader glancing at a phone cannot mix them up.
    for (let x = 0; x < src.width; x++) for (const y of [0, src.height - 1]) {
      const di = (sheet.width * (oy + y) + ox + x) << 2;
      sheet.data[di] = tint[0]; sheet.data[di + 1] = tint[1]; sheet.data[di + 2] = tint[2];
    }
  };

  cells.forEach((c, i) => {
    const cx = PAD + (i % COLS) * (CELL_W + PAD);
    const cy = HEAD_H + PAD + Math.floor(i / COLS) * (CELL_H + PAD);
    blit(c.b, cx, cy, [220, 90, 70]);
    blit(c.a, cx + IW + GAP, cy, [90, 210, 130]);
    drawText(sheet, c.name.replace(/\.png$/, '').slice(-Math.floor(CELL_W / 6)), cx + 1, cy + IH + 3, 1);
  });

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, PNG.sync.write(sheet));
  const statsPath = OUT.replace(/\.png$/, '.stats.json');
  fs.writeFileSync(statsPath, `${JSON.stringify({
    sheet: path.basename(OUT), title: TITLE, before_dir: BEFORE, after_dir: AFTER,
    pairs: pairs.length, unpaired_after_only: unpaired, frames: stats,
  }, null, 2)}\n`);
  console.log(`${OUT}  ${sheet.width}x${sheet.height}  ${pairs.length} pair(s)${unpaired.length ? `, ${unpaired.length} unpaired` : ''}`);
  const worst = stats.slice().sort((x, y) => x.after.shadow_levels - y.after.shadow_levels)[0];
  console.log(`sanity (worst after-frame): ${worst.file} shadow_levels=${worst.after.shadow_levels} local_contrast_med=${worst.after.local_contrast_med} p10=${worst.after.p10} p90=${worst.after.p90}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) main();
