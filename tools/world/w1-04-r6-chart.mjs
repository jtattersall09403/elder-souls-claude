// THE PICTURE FOR W1-04 ROUND 6: what happens after you walk out of the door and keep standing there.
//
// Round 5 read the body's position ONE fixed frame after the door and found 0 of 115 bodies under a
// roof. The round-5 critic read the same 115 doors at 30, 120 and 600 and found 8, 10 and 10: the
// collision solver slides a body out of a wall slab, and between two close buildings it slides it
// into the neighbour, where it rests. In the critic's words, "the round measured the one frame at
// which its number is zero."
//
// So the left panel is a clock, not a bar chart: the same measurement taken at four step counts,
// for three arms. The right panel is the other half of the same object — press `interact` on the
// doorstep and see which room you end up in.
//
// EVERY NUMBER IS READ FROM AN ARTIFACT, not typed here:
//   reports/w1-04-r6/live.json       the live sweep, one browser, the real input latch
//   reports/w1-04-r6/deletefix.json  the offline arms, cut through applyInteriorBounds()'s switches
// The tool exits non-zero if either file is missing, so this cannot draw a picture of nothing.
//
// No browser. The PNG writer is the one every chart in this project uses; the font is the shared
// tools/lib/chart-font.mjs.
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import { makeText } from '../lib/chart-font.mjs';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..');
const commit = (() => { try { return execSync('git rev-parse --short HEAD', { cwd: ROOT }).toString().trim(); } catch { return 'unknown'; } })();

const live = JSON.parse(readFileSync(join(ROOT, 'reports/w1-04-r6/live.json'), 'utf8'));
const del = JSON.parse(readFileSync(join(ROOT, 'reports/w1-04-r6/deletefix.json'), 'utf8'));
const L1 = live.sections.L1_settle;
const L2 = live.sections.L2_reentry;
const L3 = live.sections.L3_consumption;
if (!L1 || !L2) { console.error('w1-04-r6-chart: reports/w1-04-r6/live.json has no L1/L2 sections — run the live sweep first'); process.exit(1); }

const settle = (s) => [s.inside_a_building_at_1_frame, s.inside_a_building_at_30_frames, s.inside_a_building_at_120_frames, s.inside_a_building_at_600_frames];
// Three arms of the same measurement. The round-5 numbers are the round-5 CRITIC's published live
// sweep, which is why they are labelled as its and not as this round's — this round did not run
// round 5's code in a browser.
const series = [
  { label: 'ROUND 5 AS SHIPPED  (critic, r5 verdict)', v: [0, 8, 10, 10], rgb: [214, 96, 84], measured: 'r5 verdict' },
  { label: 'THIS ROUND, DERIVATION CUT  (live)', v: L3 && L3.cut_arm ? settle(L3.cut_arm) : null, rgb: [186, 148, 62], measured: 'live' },
  { label: 'THIS ROUND  (live)', v: settle(L1), rgb: [96, 186, 132], measured: 'live' },
].filter((s) => s.v);

const W = 1200, H = 660;
const px = new Uint8Array(W * H * 3).fill(0x12);
const set = (x, y, r, g, b) => { if (x < 0 || y < 0 || x >= W || y >= H) return; const i = ((y | 0) * W + (x | 0)) * 3; px[i] = r; px[i + 1] = g; px[i + 2] = b; };
const rect = (x, y, w, h, r, g, b) => { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) set(Math.round(x + i), Math.round(y + j), r, g, b); };
const line = (x0, y0, x1, y1, r, g, b, t = 2) => {
  const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0));
  for (let i = 0; i <= n; i++) { const u = i / n; rect(x0 + (x1 - x0) * u - t / 2, y0 + (y1 - y0) * u - t / 2, t, t, r, g, b); }
};
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

/* ---- titles ---------------------------------------------------------------------------------- */
text('W1-04 R6  YOU WALK OUT OF THE DOOR AND KEEP STANDING THERE', 40, 30, 3, [236, 232, 224]);
text(`115 DOORS  ONE BROWSER  COMMIT ${commit.toUpperCase()}`, 40, 62, 2, [140, 148, 156]);

/* ---- LEFT: bodies indoors, against fixed steps after the door -------------------------------- */
const PX = 70, PY = 130, PW = 590, PH = 380;
rect(PX, PY, PW, PH, 0x1a, 0x1c, 0x22);
text('BODIES STANDING INSIDE A DRAWN BUILDING', PX, PY - 34, 2, [236, 232, 224]);
text('AFTER N FIXED STEPS', PX, PY - 14, 2, [140, 148, 156]);
const steps = [1, 30, 120, 600];
const maxY = 120;
const xOf = (i) => PX + 60 + i * ((PW - 100) / 3);
const yOf = (v) => PY + PH - 46 - (v / maxY) * (PH - 80);
// gridlines and the axis
for (const g of [0, 25, 50, 75, 100]) {
  const y = yOf(g);
  rect(PX + 10, y, PW - 20, 1, 0x2a, 0x2e, 0x36);
  text(String(g), PX + 14, y - 10, 2, [110, 118, 126]);
}
for (let i = 0; i < 4; i++) text(String(steps[i]), xOf(i) - 8, PY + PH - 30, 2, [170, 178, 186]);
text('FIXED STEPS AFTER THE DOOR', PX + 170, PY + PH - 8, 2, [110, 118, 126]);
let ly = PY + 150;   // clear of the 113-line at the top and the 0-line at the bottom
for (const s of series) {
  for (let i = 0; i < 3; i++) line(xOf(i), yOf(s.v[i]), xOf(i + 1), yOf(s.v[i + 1]), s.rgb[0], s.rgb[1], s.rgb[2], 3);
  for (let i = 0; i < 4; i++) {
    rect(xOf(i) - 5, yOf(s.v[i]) - 5, 10, 10, s.rgb[0], s.rgb[1], s.rgb[2]);
    text(String(s.v[i]), xOf(i) + 10, yOf(s.v[i]) - 16, 2, s.rgb);
  }
  rect(PX + 90, ly, 14, 10, s.rgb[0], s.rgb[1], s.rgb[2]);
  text(s.label, PX + 112, ly, 2, s.rgb);
  ly += 22;
}
text('A DOORSTEP IS WHERE YOU STAND, NOT WHERE YOU ARE FOR 16 MS', PX + 10, PY + PH + 14, 2, [140, 148, 156]);

/* ---- RIGHT: press interact on the doorstep ---------------------------------------------------- */
const QX = 700, QY = 130, QW = 460, QH = 380;
rect(QX, QY, QW, QH, 0x1a, 0x1c, 0x22);
text('PRESS INTERACT ON THE DOORSTEP', QX, QY - 34, 2, [236, 232, 224]);
text('WHICH ROOM DO YOU END UP IN, OF 115', QX, QY - 14, 2, [140, 148, 156]);
const B = del.rows.find((r) => r.flags.join() === '--r5-doorstep');
const C = del.rows.find((r) => r.flags.join() === '--no-doorstep');
const bars = [
  { label: 'ROUND 5 AS SHIPPED', v: [B.reentry_own, B.reentry_other, B.reentry_none], how: 'offline, r6 census' },
  { label: 'DERIVATION CUT', v: [C.reentry_own, C.reentry_other, C.reentry_none], how: 'offline, r6 census' },
  { label: 'THIS ROUND', v: [L2.back_in_the_room_you_left, L2.LANDED_IN_A_DIFFERENT_ROOM, L2.could_not_get_in_at_all], how: 'LIVE, real latch' },
];
const cols = [[96, 186, 132], [214, 96, 84], [120, 124, 132]];
let by = QY + 46;
for (const b of bars) {
  text(b.label, QX + 16, by - 22, 2, [236, 232, 224]);
  let x = QX + 16;
  const scale = (QW - 40) / 115;
  for (let i = 0; i < 3; i++) {
    const w = Math.max(b.v[i] ? 3 : 0, b.v[i] * scale);
    rect(x, by, w, 28, cols[i][0], cols[i][1], cols[i][2]);
    x += w + 1;
  }
  text(`${b.v[0]} BACK IN   ${b.v[1]} WRONG ROOM   ${b.v[2]} NOTHING`, QX + 16, by + 34, 2, [170, 178, 186]);
  text(b.how.toUpperCase(), QX + 16, by + 52, 2, [110, 118, 126]);
  by += 104;
}
text('GREEN IS THE ROOM YOU LEFT. RED IS SOMEBODY ELSE\'S HOUSE.', QX + 10, QY + QH + 14, 2, [140, 148, 156]);

/* ---- footer ---------------------------------------------------------------------------------- */
text('DRAWN FROM REPORTS/W1-04-R6/LIVE.JSON AND DELETEFIX.JSON. NOTHING IN THIS PICTURE WAS TYPED BY HAND.', 40, H - 46, 2, [110, 118, 126]);
text('ROUND-5 LINE IS THE ROUND-5 CRITIC\'S OWN LIVE SWEEP, QUOTED FROM ITS VERDICT.', 40, H - 26, 2, [110, 118, 126]);

const outPath = join(ROOT, 'docs/shots/2026-08-08-w1-04-r6-the-doorstep-holds-at-600-frames.png');
png(outPath);
console.log(`wrote ${outPath}`);
console.log(`  settle series: ${series.map((s) => `${s.label} ${s.v.join('/')}`).join('  |  ')}`);
console.log(`  re-entry live: ${bars[2].v.join(' / ')}`);
