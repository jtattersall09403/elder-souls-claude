// THE PICTURE FOR W1-27: what a chest in this world is made of, and which parts of the game
// know about each other.
//
// Left: every takeable object placed in the province, one pixel-block per object, ordered by
// settlement. Grey is a palette pick — a name drawn out of a ten-entry table by a hash of the
// shelf it sits on. Gold is hand-placed and one of a kind. There are 1,827 grey and 83 gold.
// The point of drawing it rather than stating it is that the ratio is the thing you feel: a
// chest means something when opening it might give you the gold, and this world is 4% gold.
//
// Right: the ten coherence checks, red or green, with the number each one turns on.
//
// No browser and no engine: this reads the report JSON the checks wrote. The PNG writer and the
// 5x5 font are the ones this project's chart code already uses.
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import { makeText } from '../lib/chart-font.mjs';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..');
const rd = (p) => JSON.parse(readFileSync(join(ROOT, p), 'utf8'));
const REP = rd('reports/w1-27/coherence.json');
const commit = (() => { try { return execSync('git rev-parse --short HEAD', { cwd: ROOT }).toString().trim(); } catch { return 'unknown'; } })();

// Rebuild the per-object stream in placement order, so the picture is the world and not a bar.
import { readdirSync } from 'node:fs';
const PALETTE = (() => {
  const src = readFileSync(join(ROOT, 'tools/world/build-property.mjs'), 'utf8');
  const m = src.match(/const PALETTE = \{[\s\S]*?\n\};/);
  const s = new Set();
  if (m) for (const x of m[0].matchAll(/\['([^']+)',\s*[\d.]+,\s*[\d.]+\]/g)) s.add(x[1]);
  return s;
})();
const STREAM = [];
for (const f of readdirSync(join(ROOT, 'game/data/world/property')).filter((x) => x.endsWith('.json')).sort()) {
  const d = JSON.parse(readFileSync(join(ROOT, 'game/data/world/property', f), 'utf8'));
  for (const z of d.zones || []) for (const c of z.contents || []) {
    STREAM.push(PALETTE.has(c.name) && /\.\d+$/.test(String(c.instance)) && !c.unique ? 0 : 1);
  }
}

const W = 1400, H = 760;
const px = new Uint8Array(W * H * 3).fill(0x12);
const set = (x, y, r, g, b) => { if (x < 0 || y < 0 || x >= W || y >= H) return; const i = ((y | 0) * W + (x | 0)) * 3; px[i] = r; px[i + 1] = g; px[i + 2] = b; };
const rect = (x, y, w, h, r, g, b) => { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) set(Math.round(x + i), Math.round(y + j), r, g, b); };
function png(path) {
  const raw = Buffer.alloc((W * 3 + 1) * H);
  for (let y = 0; y < H; y++) { raw[y * (W * 3 + 1)] = 0; Buffer.from(px.buffer, y * W * 3, W * 3).copy(raw, y * (W * 3 + 1) + 1); }
  const crcT = (() => { const t = new Int32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c; } return t; })();
  const crc = (b) => { let c = -1; for (const x of b) c = crcT[(c ^ x) & 0xFF] ^ (c >>> 8); return (c ^ -1) >>> 0; };
  const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type, 'ascii'), data]); const cc = Buffer.alloc(4); cc.writeUInt32BE(crc(td)); return Buffer.concat([len, td, cc]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4); ihdr[8] = 8; ihdr[9] = 2;
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, Buffer.concat([Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]));
}
const text = makeText(rect);

text('W1-27   EVERY TAKEABLE THING IN THE PROVINCE, ONE BLOCK EACH', 34, 26, 0xf0, 0xe6, 0xc8, 2);
text(`GREY = DRAWN FROM A TEN-ENTRY PALETTE BY A HASH OF THE SHELF.  GOLD = HAND-PLACED AND ONE OF A KIND.   COMMIT ${commit}`,
  34, 54, 0x8a, 0x92, 0x9c, 1);

// ---- the object field
const CX = 34, CY = 96, CELL = 9, COLS = 74;
STREAM.forEach((kind, i) => {
  const x = CX + (i % COLS) * CELL, y = CY + Math.floor(i / COLS) * CELL;
  if (kind) rect(x, y, CELL - 2, CELL - 2, 0xe8, 0xbe, 0x54);
  else rect(x, y, CELL - 2, CELL - 2, 0x3c, 0x42, 0x4c);
});
const rows = Math.ceil(STREAM.length / COLS);
const fieldBottom = CY + rows * CELL + 14;
const proc = STREAM.filter((k) => !k).length;
text(`${proc} FROM THE PALETTE      ${STREAM.length - proc} HAND-PLACED      ${(100 * proc / STREAM.length).toFixed(1)}% OF WHAT YOU CAN PICK UP IS ASSEMBLY`,
  CX, fieldBottom, 0xd8, 0xd2, 0xc4, 1);
text('THE WORLD READS THEM: TAKING ONE MOVES THE INVENTORY, THE STOLEN REGISTRY AND THE SAVE. EMPTYING THE ZONES ON THE RUNNING ENGINE TAKES ALL FOUR AWAY.',
  CX, fieldBottom + 20, 0x8a, 0x92, 0x9c, 1);

// ---- the ten checks
const PX = 720, PY = 96, PH = 62;
text('THE TEN COHERENCE CHECKS', PX, PY - 26, 0xf0, 0xe6, 0xc8, 1);
REP.results.forEach((r, i) => {
  const y = PY + i * PH;
  const c = r.red ? [0xd0, 0x50, 0x50] : [0x6f, 0xc2, 0x8a];
  rect(PX, y, 10, 10, c[0], c[1], c[2]);
  text(`${r.id}  ${r.path.toUpperCase()}`, PX + 20, y + 1, c[0], c[1], c[2], 1);
  const words = String(r.headline).toUpperCase().replace(/[^A-Z0-9 .%+—-]/g, ' ').split(/\s+/);
  let line = '', ly = y + 18;
  for (const w of words) {
    if ((line + ' ' + w).length > 74) { text(line, PX + 20, ly, 0x9a, 0xa2, 0xac, 1); line = w; ly += 14; if (ly > y + PH - 8) break; }
    else line = line ? line + ' ' + w : w;
  }
  if (ly <= y + PH - 8) text(line, PX + 20, ly, 0x9a, 0xa2, 0xac, 1);
});

const OUT = `docs/shots/${new Date().toISOString().slice(0, 10)}-w1-27-ninety-four-percent-of-what-you-can-pick-up-came-out-of-a-table.png`;
png(join(ROOT, OUT));
process.stdout.write(`${OUT}\n`);
