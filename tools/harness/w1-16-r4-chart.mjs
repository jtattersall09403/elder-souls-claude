// THE PICTURE FOR W1-16 ROUND 4: quit during a boss fight, resume, and your dodge came back shorter.
//
// Top: the round-3 verdict's blocking gap and its counterfactual, both measured this round in the
// running game. `arena_duel` and `arena_flat` DECLARE their equip load — the two arenas every
// combat number in this project is calibrated in — and one save and one reload used to move them
// across the 30% cliff and take four frames of invulnerability with them. The CUT bars are the
// same code with `__breakW116('savepin')` set, which is round 3's world exactly.
//
// Bottom: the Feather, stepped past its own expiry, which is where a spell that makes you lighter
// used to leave you a roll tier heavier and keep it that way.
//
// No browser and no engine here: this reads the report JSONs the probes wrote. The PNG writer and
// the 5x7 font are the ones this project's chart code already uses.
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import { makeText } from '../lib/chart-font.mjs';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..');
const rd = (p) => JSON.parse(readFileSync(join(ROOT, p), 'utf8'));
const P = rd('reports/w1-16/r4-live.json').probes;
const commit = (() => { try { return execSync('git rev-parse --short HEAD', { cwd: ROOT }).toString().trim(); } catch { return 'unknown'; } })();
const dirty = (() => { try { return execSync('git status --porcelain', { cwd: ROOT }).toString().trim().length > 0; } catch { return true; } })();

const PF = P.pinfight, FE = P.feather;
const ROWS = [
  { label: 'ARENA_DUEL, HAUBERK + GREAVES', r: PF.arena_duel_FIX, arm: 'FIX' },
  { label: 'ARENA_FLAT, HAUBERK + GREAVES', r: PF.arena_flat_FIX, arm: 'FIX' },
  { label: 'ARENA_DUEL, THE SAME, FIX DELETED', r: PF.arena_duel_CUT_savepin, arm: 'CUT' },
  { label: 'ARENA_FLAT, THE SAME, FIX DELETED', r: PF.arena_flat_CUT_savepin, arm: 'CUT' },
  { label: 'ARENA_DUEL, FIX AND HANDS BOTH DELETED', r: PF.arena_duel_CUT_savepin_and_hands, arm: 'CUT' },
];

const W = 1400, H = 860;
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
const TIER_COL = { LIGHT: [0x6f, 0xc2, 0x8a], MEDIUM: [0xe0, 0xc0, 0x58], HEAVY: [0xe0, 0x84, 0x48], OVERLOADED: [0xd0, 0x50, 0x50] };

text('W1-16 R4   A SAVE AND A RELOAD NO LONGER CHANGE HOW WELL YOU DODGE', 34, 26, 0xf0, 0xe6, 0xc8, 2);
text(`EQUIP LOAD BEFORE AND AFTER ONE SAVEROUNDTRIP, WITH THE ROLL ACTUALLY ROLLED. I-FRAMES AND TOTAL ARE F(AT)60.   COMMIT ${commit}   DIRTY=${dirty}`,
  34, 52, 0x8a, 0x92, 0x9c, 1);

const X0 = 620, XW = 640, Y0 = 104, RH = 118;
const px2 = (p) => X0 + (Math.min(p, 100) / 100) * XW;
for (const [c, lab] of [[30, 'MEDIUM 30'], [70, 'HEAVY 70']]) {
  for (let y = Y0 - 8; y < Y0 + ROWS.length * RH - 20; y += 3) rect(px2(c), y, 1, 2, 0x4a, 0x52, 0x5e);
  text(lab, px2(c) - 4, Y0 - 24, 0x6a, 0x74, 0x82, 1);
}

ROWS.forEach((row, i) => {
  const y = Y0 + i * RH;
  const on = row.arm === 'FIX';
  text(row.label, 34, y + 6, on ? 0xd8 : 0x9a, on ? 0xd2 : 0x8a, on ? 0xc4 : 0x8a, 1);
  text(on ? 'FIX IN' : 'FIX DELETED', 34, y + 28, on ? 0x6f : 0xd0, on ? 0xc2 : 0x70, on ? 0x8a : 0x70, 1);
  const bar = (s, yy, label) => {
    const c = TIER_COL[s.tier] || [0x88, 0x88, 0x88];
    const end = Math.max(2, px2(s.pct) - X0);
    rect(X0, yy, end, 20, c[0], c[1], c[2]);
    // The caption goes INSIDE the bar in dark ink only while the bar is long enough to hold it;
    // otherwise it runs on past the end in light ink. The first version put 46 characters of dark
    // ink over a 154-pixel bar and the tail was unreadable against the background.
    const cap = `${s.pct.toFixed(6)}%  ${s.tier}   ${s.iframes_f60} I-FRAMES / ${s.total_f60} F`;
    if (end > cap.length * 6 + 12) text(cap, X0 + 6, yy + 5, 0x14, 0x16, 0x1a, 1);
    else text(cap, X0 + end + 8, yy + 5, c[0], c[1], c[2], 1);
    text(label, 400, yy + 5, 0x6a, 0x74, 0x82, 1);
  };
  bar(row.r.before, y + 24, 'BEFORE THE SAVE');
  bar(row.r.after, y + 52, 'AFTER THE RELOAD');
  if (row.r.iframes_lost) text(`${row.r.iframes_lost} I-FRAMES GONE`, 400, y + 80, 0xd0, 0x70, 0x70, 1);
  else text('UNCHANGED', 400, y + 80, 0x6f, 0xc2, 0x8a, 1);
});

// ---- the Feather strip -----------------------------------------------------------------------
const SY = Y0 + ROWS.length * RH + 6;
text('THE FEATHER, STEPPED PAST ITS OWN EXPIRY. A SPELL WHOSE WHOLE PURPOSE IS TO MAKE YOU LIGHTER USED TO LEAVE YOU A ROLL TIER HEAVIER, FOR GOOD.',
  34, SY, 0xf0, 0xe6, 0xc8, 1);
const stages = ['before', 'after_cast', 'after_expiry'];
const LABELS = ['BEFORE THE CAST', 'WHILE IT IS UP', 'AFTER IT EXPIRES'];
[['FIX IN', FE.fix, 0], ['FIX DELETED', FE.cut, 1]].forEach(([lab, arm, k]) => {
  const y = SY + 26 + k * 56;
  text(lab, 34, y + 6, k ? 0xd0 : 0x6f, k ? 0x70 : 0xc2, k ? 0x70 : 0x8a, 1);
  stages.forEach((s, i) => {
    const st = arm[s]; if (!st) return;
    const x = 260 + i * 380;
    const c = TIER_COL[st.tier] || [0x88, 0x88, 0x88];
    const end = Math.max(2, (Math.min(st.pct, 50) / 50) * 300);
    rect(x, y, end, 18, c[0], c[1], c[2]);
    const cap = `${st.pct.toFixed(6)}%  ${st.tier}  ${st.iframes_f60} I-FR`;
    if (end > cap.length * 6 + 12) text(cap, x + 6, y + 4, 0x14, 0x16, 0x1a, 1);
    else text(cap, x + end + 8, y + 4, c[0], c[1], c[2], 1);
    if (k === 0) text(LABELS[i], x, SY + 16, 0x6a, 0x74, 0x82, 1);
  });
});

text('THE CUT ROWS ARE THE SAME BUILD WITH THE CHANGE SWITCHED OFF, NOT A DIFFERENT BUILD. THE LAST ROW SHOWS WHY NOBODY SAW THIS UNTIL NOW: WITH THE HANDS ALSO BLIND THE SUM STAYS INSIDE LIGHT AND THE CLIFF IS NEVER CROSSED.',
  34, H - 34, 0x8a, 0x92, 0x9c, 1);

const out = join(ROOT, 'docs/shots/2026-08-08-w1-16-r4-quit-in-a-boss-fight-resume-and-your-dodge-was-shorter.png');
png(out);
process.stdout.write(`written: ${out.slice(ROOT.length + 1)}\n`);
