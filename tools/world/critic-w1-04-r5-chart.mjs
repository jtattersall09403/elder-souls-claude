// THE PICTURE FOR THE W1-04 ROUND-5 VERDICT: the frame the round chose, and the two frames after it.
//
// Every number drawn here is read out of `reports/critic-w1-04-r5/live.json`, which is my own
// 115-door sweep in the running game — not the builder's artifact and not a number I typed.
//
// LEFT   how many of 115 bodies stand inside a drawn building 1, 30, 120 and 600 fixed steps after
//        walking out of a door. The round measures the first bar and reports 0. It is 0. The other
//        three bars are the same doors half a second and ten seconds later.
// RIGHT  what happens when you press `interact` on the doorstep you were just put on: back into the
//        room you left, into a DIFFERENT building, or into nothing at all — with the round-4
//        behaviour (the doorstep derivation cut) beside it, because re-entry got worse.
//
// No browser and no engine: this reads two JSON files. The PNG writer is the one every chart in
// this repo uses; the font is the shared `tools/lib/chart-font.mjs`.
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import { makeText } from '../lib/chart-font.mjs';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..');
const LIVE = JSON.parse(readFileSync(join(ROOT, 'reports/critic-w1-04-r5/live.json'), 'utf8'));
const OFF = JSON.parse(readFileSync(join(ROOT, 'reports/critic-w1-04-r5/offline.json'), 'utf8'));
const commit = (() => { try { return execSync('git rev-parse --short HEAD', { cwd: ROOT }).toString().trim(); } catch { return 'unknown'; } })();

const W = 1280, H = 620;
const px = new Uint8Array(W * H * 3);
const rect = (x, y, w, h, r, g, b) => {
  for (let j = Math.max(0, y | 0); j < Math.min(H, (y + h) | 0); j++) {
    for (let i = Math.max(0, x | 0); i < Math.min(W, (x + w) | 0); i++) {
      const o = (j * W + i) * 3; px[o] = r; px[o + 1] = g; px[o + 2] = b;
    }
  }
};
const text = makeText(rect);

rect(0, 0, W, H, 18, 18, 22);

const S = LIVE.sections.L1_L2, R = LIVE.sections.L3_reentry;
const bars = [
  ['1 FRAME', S.inside_a_building_at_1_frame],
  ['30', S.inside_a_building_at_30_frames],
  ['120', S.inside_a_building_at_120_frames],
  ['600', S.inside_a_building_at_600_frames],
];

text('WALKING OUT OF A BUILDING LEAVES YOU OUTSIDE IT - FOR ONE FRAME', 34, 28, 235, 235, 240, 2);
text(`W1-04 ROUND-5 CRITIC   115 DOORS, LIVE   COMMIT ${commit}`, 34, 58, 130, 132, 145, 1);

// ---- LEFT PANEL ------------------------------------------------------------------------------
const LX = 60, LY = 130, LW = 520, LH = 340;
text('BODIES INSIDE A DRAWN BUILDING', LX, LY - 42, 200, 202, 212, 2);
text('FIXED STEPS AFTER exitInterior()', LX, LY - 18, 130, 132, 145, 1);
rect(LX, LY + LH, LW, 2, 70, 72, 84);
const maxV = 12;
for (let i = 0; i < bars.length; i++) {
  const [label, v] = bars[i];
  const bw = 88, gap = 40;
  const x = LX + 30 + i * (bw + gap);
  const h = Math.round((v / maxV) * LH);
  const good = v === 0;
  const [r, g, b] = good ? [86, 170, 120] : [206, 96, 84];
  if (h > 0) rect(x, LY + LH - h, bw, h, r, g, b);
  else rect(x, LY + LH - 3, bw, 3, r, g, b);
  text(String(v), x + bw / 2 - 8, LY + LH - h - 26, 235, 235, 240, 2);
  text(label, x, LY + LH + 14, 150, 152, 165, 1);
}
text('THE ROUND MEASURES THIS BAR ONLY', LX + 12, LY + LH + 44, 206, 96, 84, 1);

// ---- RIGHT PANEL -----------------------------------------------------------------------------
const RX = 700, RY = 130, RW = 520, RH = 340;
text('PRESS interact ON THE DOORSTEP', RX, RY - 42, 200, 202, 212, 2);
text('WHERE DOES THE DOOR PUT YOU BACK', RX, RY - 18, 130, 132, 145, 1);
rect(RX, RY + RH, RW, 2, 70, 72, 84);

const armS = [R.back_in_the_room_you_left, R.LANDED_IN_A_DIFFERENT_ROOM, R.could_not_get_in_at_all];
const cutR = OFF.sections.ARM_doorstep_cut.R;
const armC = [cutR.re_enters_the_room_you_left, cutR.re_enters_A_DIFFERENT_ROOM, cutR.no_door_in_reach];
const names = ['THE ROOM', 'ANOTHER', 'NOTHING'];
const cols = [[86, 170, 120], [206, 96, 84], [190, 150, 70]];
for (let i = 0; i < 3; i++) {
  const bw = 62, gap = 26, grp = 150;
  const x = RX + 24 + i * grp;
  const hS = Math.round((armS[i] / 115) * RH);
  const hC = Math.round((armC[i] / 115) * RH);
  const [r, g, b] = cols[i];
  if (hS > 0) rect(x, RY + RH - hS, bw, hS, r, g, b); else rect(x, RY + RH - 3, bw, 3, r, g, b);
  if (hC > 0) rect(x + bw + gap, RY + RH - hC, bw, hC, Math.round(r * 0.45), Math.round(g * 0.45), Math.round(b * 0.45));
  else rect(x + bw + gap, RY + RH - 3, bw, 3, 90, 90, 96);
  text(String(armS[i]), x + 12, RY + RH - hS - 24, 235, 235, 240, 2);
  text(String(armC[i]), x + bw + gap + 12, RY + RH - hC - 24, 150, 152, 165, 2);
  text(names[i], x + 6, RY + RH + 14, 150, 152, 165, 1);
}
rect(RX + 24, RY + RH + 46, 16, 12, 86, 170, 120);
text('SHIPPED (ROUND 5)', RX + 48, RY + RH + 47, 180, 182, 195, 1);
rect(RX + 250, RY + RH + 46, 16, 12, 40, 76, 54);
text('DOORSTEP DERIVATION CUT', RX + 274, RY + RH + 47, 150, 152, 165, 1);

// ---- FOOT ------------------------------------------------------------------------------------
text('0 OF 115 BODIES ARE INDOORS ONE FRAME AFTER THE DOOR. THAT CLAIM IS TRUE.', 34, H - 92, 86, 170, 120, 1);
text('10 OF THEM ARE INDOORS BY FRAME 120, AND 19 OF 115 DOORSTEPS CANNOT PUT YOU BACK', 34, H - 68, 206, 96, 84, 1);
text('IN THE ROOM YOU LEFT - 96 CORRECT, AGAINST 108 BEFORE THIS ROUND MOVED THE DOORS.', 34, H - 44, 206, 96, 84, 1);
text('reports/critic-w1-04-r5/{live,offline}.json   tools/world/critic-w1-04-r5-{live,offline}.mjs', 34, H - 20, 100, 102, 115, 1);

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

const dest = join(ROOT, 'docs/shots/2026-08-08-w1-04-r5-critic-the-frame-the-round-chose.png');
png(dest);
console.log(`wrote ${dest}`);
console.log(`  inside a building at 1/30/120/600: ${bars.map((b) => b[1]).join('/')}`);
console.log(`  re-entry shipped ${armS.join('/')}  cut ${armC.join('/')}`);
