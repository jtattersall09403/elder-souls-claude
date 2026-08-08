#!/usr/bin/env node
/**
 * critic-w1-04-r2-compose — glue the two frames of §6.6 into one picture with a caption strip.
 *
 * Helstrom's smithy and Helstrom's scriptorium are described by two files that are identical in
 * every field `render/interior.js` reads: same `bounds_m`, same `props[]`, same light count, same
 * `interior_kind`, same settlement, same containers. The scene-graph signature the builder's
 * §10c hashes therefore counts them as ONE room. The pictures are not identical, because
 * `buildInterior()` jitters slot choice, stride and per-prop rotation by `hashStr(rec.id)` — so
 * what distinguishes a forge from a copying-room in this build is where the same eighteen objects
 * happen to have been put.
 *
 * No browser. Reads the two PNGs `critic-w1-04-r2-shot.mjs` fetched from the capture daemon.
 */
import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';
import { parseArgs, log, REPO_ROOT } from '../lib/cli.mjs';

const args = parseArgs(process.argv.slice(2));
const src = JSON.parse(fs.readFileSync(args.in || path.join(REPO_ROOT, 'reports/critic-w1-04-r2-shot.json'), 'utf8'));
if (!src.shots || src.shots.length !== 2) { log('need exactly two shots'); process.exit(1); }

const imgs = src.shots.map((s) => PNG.sync.read(fs.readFileSync(s.path)));
const [a, b] = imgs;
if (a.width !== b.width || a.height !== b.height) { log('frames differ in size'); process.exit(1); }

const GAP = 8, BAR = 26;
const W = a.width * 2 + GAP, H = a.height + BAR;
const out = new PNG({ width: W, height: H });
// Ground the whole canvas in the same near-black the frames sit on, so the strip reads as one image.
for (let i = 0; i < out.data.length; i += 4) { out.data[i] = 18; out.data[i + 1] = 18; out.data[i + 2] = 20; out.data[i + 3] = 255; }
const blit = (img, dx, dy) => {
  for (let y = 0; y < img.height; y++) {
    for (let x = 0; x < img.width; x++) {
      const s = (img.width * y + x) << 2, d = (W * (y + dy) + (x + dx)) << 2;
      out.data[d] = img.data[s]; out.data[d + 1] = img.data[s + 1]; out.data[d + 2] = img.data[s + 2]; out.data[d + 3] = 255;
    }
  }
};
blit(a, 0, BAR);
blit(b, a.width + GAP, BAR);

// A 5x7 bitmap caption, so the picture says what it is without a caption file next to it.
const FONT = {
  A: ['01110', '10001', '10001', '11111', '10001', '10001', '10001'], B: ['11110', '10001', '10001', '11110', '10001', '10001', '11110'],
  C: ['01111', '10000', '10000', '10000', '10000', '10000', '01111'], D: ['11110', '10001', '10001', '10001', '10001', '10001', '11110'],
  E: ['11111', '10000', '10000', '11110', '10000', '10000', '11111'], F: ['11111', '10000', '10000', '11110', '10000', '10000', '10000'],
  G: ['01111', '10000', '10000', '10011', '10001', '10001', '01111'], H: ['10001', '10001', '10001', '11111', '10001', '10001', '10001'],
  I: ['11111', '00100', '00100', '00100', '00100', '00100', '11111'], K: ['10001', '10010', '10100', '11000', '10100', '10010', '10001'],
  L: ['10000', '10000', '10000', '10000', '10000', '10000', '11111'], M: ['10001', '11011', '10101', '10101', '10001', '10001', '10001'],
  N: ['10001', '11001', '10101', '10011', '10001', '10001', '10001'], O: ['01110', '10001', '10001', '10001', '10001', '10001', '01110'],
  P: ['11110', '10001', '10001', '11110', '10000', '10000', '10000'], R: ['11110', '10001', '10001', '11110', '10100', '10010', '10001'],
  S: ['01111', '10000', '10000', '01110', '00001', '00001', '11110'], T: ['11111', '00100', '00100', '00100', '00100', '00100', '00100'],
  U: ['10001', '10001', '10001', '10001', '10001', '10001', '01110'], V: ['10001', '10001', '10001', '10001', '10001', '01010', '00100'],
  W: ['10001', '10001', '10001', '10101', '10101', '11011', '10001'], Y: ['10001', '01010', '00100', '00100', '00100', '00100', '00100'],
  ' ': ['00000', '00000', '00000', '00000', '00000', '00000', '00000'], '-': ['00000', '00000', '00000', '11111', '00000', '00000', '00000'],
  ':': ['00000', '00100', '00000', '00000', '00000', '00100', '00000'], '.': ['00000', '00000', '00000', '00000', '00000', '00000', '00100'],
};
const put = (x, y, r, g, bl) => { if (x < 0 || y < 0 || x >= W || y >= H) return; const d = (W * y + x) << 2; out.data[d] = r; out.data[d + 1] = g; out.data[d + 2] = bl; out.data[d + 3] = 255; };
const text = (s, x0, y0, sc, r, g, bl) => {
  let x = x0;
  for (const ch of s.toUpperCase()) {
    const gl = FONT[ch] || FONT[' '];
    for (let ry = 0; ry < 7; ry++) for (let rx = 0; rx < 5; rx++) if (gl[ry][rx] === '1') for (let j = 0; j < sc; j++) for (let i = 0; i < sc; i++) put(x + rx * sc + i, y0 + ry * sc + j, r, g, bl);
    x += 6 * sc;
  }
};
text('HELSTROM SMITHY', 8, 8, 2, 226, 214, 190);
text('HELSTROM SCRIPTORIUM', a.width + GAP + 8, 8, 2, 226, 214, 190);

const dest = args.out || path.join(REPO_ROOT, 'docs/shots/2026-08-08-w1-04-r2-critic-two-files-one-room.png');
fs.mkdirSync(path.dirname(dest), { recursive: true });
fs.writeFileSync(dest, PNG.sync.write(out));
log(`wrote ${dest} (${W}x${H})`);
