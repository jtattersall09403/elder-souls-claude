// THE PICTURE FOR W1-13 ROUND 4: what one ordinary enemy is worth, when you died and when you did not.
//
// Draws `reports/runs/W1-13-R4/clock-consequences.json` §B. Two boundaries of the night window,
// two arms each (the same number of frames spent DYING and spent ALIVE), on the shipped tree and
// with round 4's award clock deleted. Where a pair of bars is uneven, DEATH CHANGED THE PRICE —
// which at the 04:30 boundary means dying paid 35% more, and `AR-1` forbids that.
//
// No browser, no engine: this reads the artifact the probe wrote and plots it. The PNG writer and
// the 5x7 font are lifted from `tools/analysis/ambience-onsets-chart.mjs`, which is where this
// project's other hand-rolled chart lives.

import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from '../lib/cli.mjs';
import { makeText } from '../lib/chart-font.mjs';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..');
const args = parseArgs(process.argv.slice(2));
const src = JSON.parse(readFileSync(args.in || join(ROOT, 'reports/runs/W1-13-R4/clock-consequences.json'), 'utf8'));
const B = src.checks.b_ar1_death_pays_nothing;
const A = src.checks.a_method_8;

const W = 1180, H = 660;
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

// ---- header ------------------------------------------------------------------------------------
text('W1-13 R4  WHAT ONE ORDINARY ENEMY IS WORTH, AFTER YOU DIED AND AFTER YOU DID NOT', 30, 26, 0xf0, 0xe6, 0xc8, 2);
text(`40 DEATHS VS THE SAME 6,040 FRAMES ALIVE   COMMIT ${String(src.git.commit).slice(0, 7)}   DIRTY=${src.git.dirty}`,
  30, 52, 0x8a, 0x92, 0x9c, 1);

// ---- the four groups ---------------------------------------------------------------------------
const groups = [];
for (const [key, label] of [['out_of_the_night_window', 'LEAVING THE NIGHT WINDOW  (CLOCK 04:30, NIGHT ENDS 05:00)'],
  ['into_the_night_window', 'ENTERING THE NIGHT WINDOW  (CLOCK 20:58, NIGHT OPENS 21:00)']]) {
  const b = B.boundaries[key];
  groups.push({ label, arm: 'SHIPPED  (ROUND 4 AWARD CLOCK)', dying: b.shipped.dying_paid, alive: b.shipped.alive_paid, good: b.shipped.equal });
  groups.push({ label: null, arm: 'AWARD CLOCK DELETED  (THE ROUND-3 TREE)', dying: b.award_clock_deleted.dying_paid, alive: b.award_clock_deleted.alive_paid, good: b.award_clock_deleted.equal });
}

const X0 = 470, MAXV = 64;
const xOf = (v) => X0 + (v / MAXV) * (W - 130 - X0);
let y = 96;
for (const g of groups) {
  if (g.label) { text(g.label, 30, y, 0xc9, 0xb0, 0x72, 1); y += 22; }
  const good = g.good;
  const col = good ? [0x4e, 0xa3, 0x72] : [0xd9, 0x5c, 0x3f];
  const armCol = good ? [0x9f, 0xb8, 0xa6] : [0xe0, 0x9a, 0x88];
  text(g.arm, 46, y + 24, armCol[0], armCol[1], armCol[2], 1);
  // the two bars
  for (const [name, v, shade] of [['DYING', g.dying, 1], ['ALIVE', g.alive, 0.55]]) {
    const yy = y + (name === 'DYING' ? 8 : 32);
    text(name, 390, yy + 2, 0xb8, 0xbe, 0xc6, 1);
    const w = Math.max(2, xOf(v) - X0);
    rect(X0, yy, w, 16, Math.round(col[0] * shade), Math.round(col[1] * shade), Math.round(col[2] * shade));
    text(String(v), X0 + w + 8, yy + 4, 0xf0, 0xe6, 0xc8, 1);
  }
  // the verdict flag, under the arm label rather than beside the bars: at 57 souls the bar runs
  // most of the way across and the two strings overlapped.
  text(good ? 'EQUAL - DEATH CHANGED NOTHING' : 'UNEQUAL - DEATH CHANGED THE PRICE',
    46, y + 40, col[0], col[1], col[2], 1);
  rect(30, y + 58, W - 60, 1, 0x2a, 0x2f, 0x36);
  y += 74;
}

// ---- footer: method 8 ---------------------------------------------------------------------------
const cl = A.clauses;
rect(30, y + 6, W - 60, 2, 0x3a, 0x42, 0x4c);
text('RI-PRG04 METHOD 8, RUN FOR THE FIRST TIME: REST AT 17:00', 30, y + 22, 0xf0, 0xe6, 0xc8, 2);
const rows = [
  [`CLOCK ${A.rested.before.hour.toFixed(3)} TO ${A.rested.after.hour.toFixed(3)}  (EVERY REST EXACTLY 6 H)`, cl.c1_clock_reads_23_00.pass],
  [`MERCHANTS SHUT ${cl.c3_merchants_closed.shops_closed} OF ${cl.c3_merchants_closed.of}   NO-REST CONTROL SHUT ${cl.c3_merchants_closed.control_shops_closed}`, cl.c3_merchants_closed.pass],
  [`PEOPLE WHO MOVED ${cl.c2_night_roster_active.npcs_moved}   NO-REST CONTROL ${cl.c2_night_roster_active.control_npcs_moved}`, cl.c2_night_roster_active.pass],
  [`ONE ORDINARY KILL ${cl.c7_souls_rate_1_35x_after_the_rest.souls_before_rest} SOULS AT 17:00, ${cl.c7_souls_rate_1_35x_after_the_rest.souls_after_rest} AT 23:00  (x${cl.c7_souls_rate_1_35x_after_the_rest.ratio})`, cl.c7_souls_rate_1_35x_after_the_rest.pass],
  [`FOUR RESTS = ${cl.c5_four_rests_advance_24h.hours} H, DAY +${cl.c5_four_rests_advance_24h.days}, SAME SHOPS AND SAME ROSTER`, cl.c5_four_rests_advance_24h.pass && cl.c6_same_shop_state_after_the_round_trip.pass],
  ['TIMED QUEST: NONE EXISTS AND ONDAY() HAS NO CALLER - REPORTED, NOT PASSED', null],
];
let fy = y + 48;
for (const [t, ok] of rows) {
  const c = ok === null ? [0xc9, 0xb0, 0x72] : ok ? [0x4e, 0xa3, 0x72] : [0xd9, 0x5c, 0x3f];
  rect(30, fy + 1, 8, 8, c[0], c[1], c[2]);
  text(t, 48, fy, 0xd8, 0xdc, 0xe2, 1);
  fy += 18;
}

const outPath = args.out || join(ROOT, 'docs/shots/2026-08-07-w1-13-r4-dying-must-not-change-the-price.png');
png(outPath);
console.log(`[chart] ${outPath}`);
