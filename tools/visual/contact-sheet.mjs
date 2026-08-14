#!/usr/bin/env node
/**
 * contact-sheet.mjs — tile a directory of frames into one image.
 *
 * Why this tool exists, stated bluntly: a reviewer who is handed a single still can
 * certify a broken thing as fixed, and in this project one did. A contact sheet makes
 * that physically impossible — the artefact IS the sequence, so "I looked at the frame"
 * and "I looked at the sequence" stop being distinguishable.
 *
 * It writes PNG using only pngjs, which the repo already has. No canvas, no native deps.
 *
 * Usage:
 *   node tools/visual/contact-sheet.mjs --in <dir> --out <file.png> [--cols 6] [--every 6]
 *        [--scale 0.25] [--match <substring>] [--label]
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
const IN = path.resolve(args.in || '.');
const OUT = path.resolve(args.out || 'contact-sheet.png');
const COLS = Number(args.cols || 6);
const EVERY = Number(args.every || 1);
const SCALE = Number(args.scale || 0.25);
const PAD = 4;

let files = fs.readdirSync(IN).filter((f) => f.endsWith('.png')).sort();
if (args.match) {
  const pats = String(args.match).split(',');
  files = files.filter((f) => pats.some((p) => f.includes(p)));
}
files = files.filter((_, i) => i % EVERY === 0);
if (!files.length) { console.error(`no frames in ${IN}${args.match ? ` matching '${args.match}'` : ''}`); process.exit(2); }

/** Nearest-neighbour box downscale. Deterministic and dependency-free — the sheet is for
 *  reading composition and change, not for judging filtering quality. */
function shrink(png, scale) {
  const w = Math.max(1, Math.round(png.width * scale));
  const h = Math.max(1, Math.round(png.height * scale));
  const out = new PNG({ width: w, height: h });
  const sx = png.width / w, sy = png.height / h;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      // Average the source box so downscaled foliage does not turn into aliased confetti,
      // which would be a defect the SHEET invented rather than one the game has.
      let r = 0, g = 0, b = 0, n = 0;
      const x0 = Math.floor(x * sx), x1 = Math.max(x0 + 1, Math.floor((x + 1) * sx));
      const y0 = Math.floor(y * sy), y1 = Math.max(y0 + 1, Math.floor((y + 1) * sy));
      for (let yy = y0; yy < y1 && yy < png.height; yy++) {
        for (let xx = x0; xx < x1 && xx < png.width; xx++) {
          const i = (png.width * yy + xx) << 2;
          r += png.data[i]; g += png.data[i + 1]; b += png.data[i + 2]; n++;
        }
      }
      const o = (w * y + x) << 2;
      out.data[o] = r / n; out.data[o + 1] = g / n; out.data[o + 2] = b / n; out.data[o + 3] = 255;
    }
  }
  return out;
}

// ---- a 5x7 bitmap font, so every tile can carry its own filename -------------------------
// Without labels a contact sheet is pretty and unusable: you cannot say WHICH frame is wrong.
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
function drawText(png, text, ox, oy, scale = 1) {
  const s = String(text).toUpperCase();
  for (let ci = 0; ci < s.length; ci++) {
    const bits = GLYPHS[s[ci]] || GLYPHS[' '];
    for (let r = 0; r < 7; r++) {
      for (let c = 0; c < 5; c++) {
        if (bits[r * 5 + c] !== '1') continue;
        for (let dy = 0; dy < scale; dy++) for (let dx = 0; dx < scale; dx++) {
          const x = ox + (ci * 6 + c) * scale + dx, y = oy + r * scale + dy;
          if (x < 0 || y < 0 || x >= png.width || y >= png.height) continue;
          const i = (png.width * y + x) << 2;
          png.data[i] = 255; png.data[i + 1] = 240; png.data[i + 2] = 200; png.data[i + 3] = 255;
        }
      }
    }
  }
}

const tiles = files.map((f) => ({ name: f, png: shrink(PNG.sync.read(fs.readFileSync(path.join(IN, f))), SCALE) }));
const TW = Math.max(...tiles.map((t) => t.png.width));
const LABEL_H = args.label === false ? 0 : 11;
const TH = Math.max(...tiles.map((t) => t.png.height)) + LABEL_H;
const rows = Math.ceil(tiles.length / COLS);
const sheet = new PNG({ width: COLS * (TW + PAD) + PAD, height: rows * (TH + PAD) + PAD });
for (let i = 0; i < sheet.data.length; i += 4) { sheet.data[i] = 18; sheet.data[i + 1] = 20; sheet.data[i + 2] = 22; sheet.data[i + 3] = 255; }

tiles.forEach((t, i) => {
  const cx = PAD + (i % COLS) * (TW + PAD);
  const cy = PAD + Math.floor(i / COLS) * (TH + PAD);
  for (let y = 0; y < t.png.height; y++) {
    for (let x = 0; x < t.png.width; x++) {
      const si = (t.png.width * y + x) << 2;
      const di = (sheet.width * (cy + y) + cx + x) << 2;
      sheet.data[di] = t.png.data[si]; sheet.data[di + 1] = t.png.data[si + 1];
      sheet.data[di + 2] = t.png.data[si + 2]; sheet.data[di + 3] = 255;
    }
  }
  if (LABEL_H) drawText(sheet, t.name.replace(/\.png$/, '').slice(-34), cx + 1, cy + t.png.height + 2, 1);
});

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, PNG.sync.write(sheet));
console.log(`${OUT}  ${sheet.width}x${sheet.height}  ${tiles.length} tiles (of ${fs.readdirSync(IN).filter((f) => f.endsWith('.png')).length} frames, every ${EVERY})`);
