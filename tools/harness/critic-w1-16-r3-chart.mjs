// THE PICTURE FOR THE W1-16 ROUND-3 VERDICT: saving and reloading a fight changes your dodge.
//
// Round 3's whole safety argument is that 24 of the 49 named states DECLARE their equip load, so
// the calibration W1-09/10/11 pinned is "untouched, byte for byte". That is true at load.
// `_restoreFightFromSave` clears the pin, so after a save and a reload the producer engages and
// answers a different number — and with round 3's new hands term in the sum, the different number
// is on the other side of the 30% cliff.
//
// Every figure here is measured, in the running game, by tools/harness/critic-w1-16-r3-live.mjs:
// the roll is rolled and the invulnerable run is counted off the body frame by frame, before the
// save and again after the reload. The third bar is round 3's OWN delete-the-fix switch
// (`__breakW116('hands')`) as the counterfactual: with the hands term cut, the same save and the
// same reload do not cross the cliff.
//
// No browser and no engine here: this reads the report JSON the probe wrote. The PNG writer and
// the 5x5 font come from tools/lib/chart-font.mjs, where this project's chart code lives.
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import { makeText } from '../lib/chart-font.mjs';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..');
const rd = (p) => JSON.parse(readFileSync(join(ROOT, p), 'utf8'));
const P = rd('reports/w1-16/critic-r3-live-2.json').probes;
const PF = P.pinfight.rows;
const OL = P.overloaded;
const commit = (() => { try { return execSync('git rev-parse --short HEAD', { cwd: ROOT }).toString().trim(); } catch { return 'unknown'; } })();
const dirty = (() => { try { return execSync('git status --porcelain', { cwd: ROOT }).toString().trim().length > 0; } catch { return true; } })();

const ROWS = [
  { label: 'ARENA_DUEL, HAUBERK AND GREAVES ON', r: PF[1], note: 'FOUR I-FRAMES GONE' },
  { label: 'ARENA_FLAT, HAUBERK AND GREAVES ON', r: PF[3], note: 'FOUR I-FRAMES GONE' },
  { label: 'THE SAME SAVE, WITH ROUND 3 CUT (__BREAKW116 HANDS)', r: PF[2], note: 'NO CLIFF CROSSED' },
  { label: 'ARENA_DUEL, NOTHING WORN', r: PF[0], note: 'SAME TIER, DIFFERENT NUMBER' },
];

const W = 1400, H = 800;
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

text('W1-16 R3 CRITIC   SAVE THE FIGHT, RELOAD IT, AND YOUR DODGE IS FOUR FRAMES SHORTER', 34, 26, 0xf0, 0xe6, 0xc8, 2);
text(`EQUIP LOAD AS A PERCENTAGE OF MAXLOAD, AND THE I-FRAMES ACTUALLY ROLLED, BEFORE A SAVEROUNDTRIP AND AFTER IT.   ALL FRAME FIGURES F(AT)60.   COMMIT ${commit}   DIRTY=${dirty}`,
  34, 52, 0x8a, 0x92, 0x9c, 1);

const X0 = 520, XW = 560, Y0 = 108, RH = 106;
const px2 = (p) => X0 + (Math.min(p, 100) / 100) * XW;
for (const [c, lab] of [[30, 'MEDIUM 30'], [70, 'HEAVY 70'], [100, 'OVERLOADED 100']]) {
  for (let y = Y0 - 8; y < Y0 + ROWS.length * RH + 6; y += 3) rect(px2(c), y, 1, 2, 0x4a, 0x52, 0x5e);
  text(lab, px2(c) - (c === 100 ? 6 * lab.length : 4), Y0 - 24, 0x6a, 0x74, 0x82, 1);
}
const TIER_COL = { LIGHT: [0x6f, 0xc2, 0x8a], MEDIUM: [0xe0, 0xc0, 0x58], HEAVY: [0xe0, 0x84, 0x48], OVERLOADED: [0xd0, 0x50, 0x50] };
ROWS.forEach((row, i) => {
  const y = Y0 + i * RH;
  const b = row.r.before, a = row.r.after;
  text(row.label, 34, y + 4, 0xd8, 0xd2, 0xc4, 1);
  text(row.note, 34, y + 74, row.r.ROLL_TIER_CHANGED_ACROSS_THE_SAVE ? 0xd0 : 0x6a, row.r.ROLL_TIER_CHANGED_ACROSS_THE_SAVE ? 0x50 : 0x74, row.r.ROLL_TIER_CHANGED_ACROSS_THE_SAVE ? 0x50 : 0x82, 1);
  const bc = TIER_COL[b.tier];
  rect(X0, y + 24, Math.max(2, px2(b.pct) - X0), 20, bc[0], bc[1], bc[2]);
  text(`${b.pct.toFixed(6)}%  ${b.tier}  ${b.iframes_f60} I-FRAMES  TOTAL ${b.total_f60} F60`, px2(b.pct) + 10, y + 28, 0xd8, 0xd2, 0xc4, 1);
  text('BEFORE THE SAVE', 34, y + 28, 0x6a, 0x74, 0x82, 1);
  const ac = TIER_COL[a.tier];
  rect(X0, y + 50, Math.max(2, px2(a.pct) - X0), 20, ac[0], ac[1], ac[2]);
  text(`${a.pct.toFixed(6)}%  ${a.tier}  ${a.iframes_f60} I-FRAMES  TOTAL ${a.total_f60} F60`, px2(a.pct) + 10, y + 54, 0xd8, 0xd2, 0xc4, 1);
  text('AFTER THE RELOAD', 34, y + 54, 0xc8, 0xc2, 0xb4, 1);
});

const SY = Y0 + ROWS.length * RH + 34;
text('AND THE TIER NOBODY COULD ENTER WITHOUT A PIN: DRESS IN EVERYTHING THE GAME DECLARES, THEN CAST THE BURDEN THE GAME SHIPS.',
  34, SY, 0xf0, 0xe6, 0xc8, 1);
const steps = [
  [`DRESSED, 49.8 KG OF 73`, OL.dressed_on_shipped_weights_alone.pct, OL.dressed_on_shipped_weights_alone.tier],
  [`PLUS BURDEN (WARDING, SHIPPED)`, OL.spell.pct_after_cast, OL.spell.tier_after_cast],
];
steps.forEach(([lab, p, t], i) => {
  const y = SY + 24 + i * 26;
  const c = TIER_COL[t];
  text(lab, 34, y + 4, 0x9a, 0xa2, 0xac, 1);
  rect(X0, y, Math.max(2, px2(p) - X0), 18, c[0], c[1], c[2]);
  text(`${p.toFixed(6)}%  ${t}`, Math.min(px2(p) + 10, W - 240), y + 4, 0xd8, 0xd2, 0xc4, 1);
});
text(`SPRINT HELD AT THAT REAL OVERLOADED: ${OL.sprint_at_a_REAL_OVERLOADED.held.metres_over_120_f60} M FOR ${OL.sprint_at_a_REAL_OVERLOADED.held.stamina_spent} STAMINA OVER 120 F(AT)60. AT MEDIUM ON THE SAME FIXTURE: ${OL.sprint_dressed_only.held.metres_over_120_f60} M FOR ${OL.sprint_dressed_only.held.stamina_spent}.`,
  34, H - 34, 0x8a, 0x92, 0x9c, 1);

const out = join(ROOT, 'docs/shots/2026-08-08-critic-w1-16-r3-save-the-fight-and-your-dodge-gets-shorter.png');
png(out);
process.stdout.write(`written: ${out.slice(ROOT.length + 1)}\n`);
