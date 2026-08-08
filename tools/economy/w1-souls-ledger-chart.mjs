// THE PICTURE FOR W1-SOULS-LEDGER: two ledgers for one number, and the day they spent 53% apart.
//
// The world published one soul total and the statblocks paid another, and nothing in the tree
// ever compared them. This draws both, per danger tier, plus the headline and the crossing the
// player actually walks — before the reconciliation and after it.
//
// No browser and no engine: it reads `reports/w1-souls-ledger/reconciliation.json`, which
// `tools/check-souls-world.mjs` and the regeneration produced. Every number is a soul count or a
// level; no wall-clock figure appears anywhere (RULES 26).
//
// The PNG writer and the 5x7 font are lifted from `tools/economy/critic-souls-r3-chart.mjs`,
// which is where this project's other hand-rolled charts live.
//
//   node tools/economy/w1-souls-ledger-chart.mjs [out.png]

import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeText } from '../lib/chart-font.mjs';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..');
const REC = JSON.parse(readFileSync(join(ROOT, 'reports/w1-souls-ledger/reconciliation.json'), 'utf8'));
const OUT = process.argv[2] || join(ROOT, 'docs/shots/2026-08-08-w1-souls-ledger-two-ledgers-one-number.png');

const row = (name) => REC.corrected_rows.find((r) => r.row === name);

const W = 1240, H = 620;
const px = new Uint8Array(W * H * 3).fill(0x12);
const set = (x, y, r, g, b) => {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const i = (y * W + x) * 3; px[i] = r; px[i + 1] = g; px[i + 2] = b;
};
const rect = (x, y, w, h, r, g, b) => {
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) set(Math.round(x + i), Math.round(y + j), r, g, b);
};
function png(path) {
  const raw = Buffer.alloc((W * 3 + 1) * H);
  for (let y = 0; y < H; y++) {
    raw[y * (W * 3 + 1)] = 0;
    Buffer.from(px.buffer, y * W * 3, W * 3).copy(raw, y * (W * 3 + 1) + 1);
  }
  const crcT = (() => { const t = new Int32Array(256);
    for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c; }
    return t; })();
  const crc = (b) => { let c = -1; for (const x of b) c = crcT[(c ^ x) & 0xFF] ^ (c >>> 8); return (c ^ -1) >>> 0; };
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
    const cc = Buffer.alloc(4); cc.writeUInt32BE(crc(td));
    return Buffer.concat([len, td, cc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]),
    chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0)),
  ]));
}
// The 5x5 chart font now comes from tools/lib/chart-font.mjs. It used to be a copy-pasted table
// of 23-character strings indexed as bits[j * 5 + i] — two characters short of the 25 the stride
// demands, so every row below each missing character was sheared one pixel left and both digits
// and letters rendered wrong. Do not paste a font back in here; see W1-CHARTFONT.
const text = makeText(rect);
const CACHE = [0xd9, 0x5c, 0x3f];   // what the world file published
const PAID = [0x4e, 0xa3, 0x72];    // what the statblocks pay

// ---- header ------------------------------------------------------------------------------------
text('TWO SOUL LEDGERS FOR ONE NUMBER, AND NOTHING IN THE TREE EVER READ BOTH', 30, 26, 0xf0, 0xe6, 0xc8, 2);
text('RED   WHAT GAME/DATA/WORLD/POPULATION-POSTS.JSON PUBLISHED     -   A CACHE, GENERATED ONCE AND LEFT BEHIND', 30, 58, CACHE[0], CACHE[1], CACHE[2], 1);
text('GREEN WHAT GAME/DATA/COMBAT/ENEMIES/*.JSON ACTUALLY PAY        -   THE LEDGER SIM/SOULS.JS AWARDFOR() READS ON EVERY KILL', 30, 74, PAID[0], PAID[1], PAID[2], 1);
text(`MEASURED AT COMMIT ${String(REC.commit_at).toUpperCase()}.  SAME 144 POSTS, SAME 267 BODIES, NO POST MOVED - ONLY THE PRICE OF A BODY CHANGED.`, 30, 96, 0x8a, 0x92, 0x9c, 1);

// ---- the headline --------------------------------------------------------------------------------
const head = row('report.souls');
const X0 = 300, BARW = 700, MAXV = head.was * 1.02;
const wOf = (v) => Math.max(2, (v / MAXV) * BARW);
let y = 130;
text('THE WHOLE PLACED WORLD', 30, y + 16, 0xc9, 0xb0, 0x72, 1);
text('267 BODIES ON THE ROADS', 30, y + 32, 0x6d, 0x74, 0x7e, 1);
rect(X0, y, wOf(head.was), 22, ...CACHE);
text(`CACHE SAID ${head.was}`, X0 + 8, y + 7, 0x14, 0x0f, 0x0f, 1);
rect(X0, y + 28, wOf(head.now), 22, ...PAID);
text(`STATBLOCKS PAY ${head.now}`, X0 + 8, y + 35, 0x0f, 0x14, 0x11, 1);
text(`CACHE WAS +${head.cache_was_over_by_pct}%`, X0 + wOf(head.was) + 14, y + 7, CACHE[0], CACHE[1], CACHE[2], 1);
y += 72;

// ---- by danger tier ------------------------------------------------------------------------------
text('EVERY DERIVED ROW WAS WRONG THE SAME WAY   -   BY DANGER TIER', 30, y, 0x8a, 0x92, 0x9c, 1);
y += 20;
const tiers = REC.corrected_rows.filter((r) => r.row.startsWith('report.by_tier.'));
const TMAX = Math.max(...tiers.map((t) => t.was)) * 1.02;
for (const t of tiers) {
  const n = t.row.split('.')[2];
  text(`DANGER TIER ${n}`, 30, y + 4, 0xc9, 0xb0, 0x72, 1);
  rect(X0, y, Math.max(2, (t.was / TMAX) * BARW), 12, ...CACHE);
  rect(X0, y + 14, Math.max(2, (t.now / TMAX) * BARW), 12, ...PAID);
  text(`${t.was}`, X0 + Math.max(2, (t.was / TMAX) * BARW) + 8, y + 3, CACHE[0], CACHE[1], CACHE[2], 1);
  text(`${t.now}`, X0 + Math.max(2, (t.now / TMAX) * BARW) + 8, y + 17, PAID[0], PAID[1], PAID[2], 1);
  y += 32;
}

// ---- the crossing: the one a player feels ---------------------------------------------------------
y += 10;
rect(30, y, W - 60, 2, 0x2c, 0x31, 0x38);
y += 16;
const cs = row('report.crossing.souls');
const cl = row('report.crossing.level_if_fully_cleared');
text('AND THE ONE A PLAYER FEELS: CLEAR THE WHOLE STORMHOLD TO LILMOTH ROAD, 38 BODIES OVER 6825 METRES', 30, y, 0xf0, 0xe6, 0xc8, 1);
y += 22;
text(`THE WORLD FILE PROMISED  ${cs.was} SOULS  =  LEVEL ${cl.was}`, 40, y, CACHE[0], CACHE[1], CACHE[2], 2);
y += 26;
text(`THE GAME ACTUALLY PAYS   ${cs.now} SOULS  =  LEVEL ${cl.now}`, 40, y, PAID[0], PAID[1], PAID[2], 2);
y += 32;
text('THE CACHE IS NOW REGENERATED FROM THE STATBLOCKS, AND TOOLS/CHECK-SOULS-WORLD.MJS FAILS THE BUILD IF THEY EVER DRIFT AGAIN.', 40, y, 0x8a, 0x92, 0x9c, 1);
y += 16;
text('IT IS WIRED INTO TOOLS/CHECK-DATA.MJS, WHICH THE PRE-COMMIT HOOK RUNS ON EVERY COMMIT THAT TOUCHES GAME/DATA.  NOBODY HAS TO REMEMBER IT.', 40, y, 0x8a, 0x92, 0x9c, 1);

png(OUT);
console.log(`wrote ${OUT}`);
