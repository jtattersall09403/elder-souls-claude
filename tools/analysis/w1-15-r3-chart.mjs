// THE PICTURE FOR W1-15 ROUND 3: the light in one room, before and after it was told about the lamps.
//
// Two panels of the same floor — `archon-apothecary`, 13.6 x 15.6 m, ten authored lamps, eight of
// them distinct — sampled at chest height on a 0.25 m grid by the SAME arithmetic the simulation
// runs (`sim/stealth/light.js::sample`, inverse-square with a 0.35 m core over the sources
// `syncInteriorLights()` builds from the interior record). Left is what every build before this
// round computed indoors: `skyAmbient(env)`, one number for the whole room. Right is the lamps.
//
// The lamp positions are read from `game/data/world/interiors/archon-apothecary.json` — the same
// file `render/interior.js` draws the fittings from — so the two panels are a picture of one data
// file being read and not being read.
//
// No browser, no engine. The PNG writer and the 5x7 font are lifted from
// tools/analysis/w1-13-r4-chart.mjs, which is where this project's chart code lives.
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..');
const REC = JSON.parse(readFileSync(join(ROOT, 'game/data/world/interiors/archon-apothecary.json'), 'utf8'));
const DET = JSON.parse(readFileSync(join(ROOT, 'game/data/stealth/detection.json'), 'utf8'));
const CFG = DET.interior_lamps;
const CORE = 0.35;
const commit = (() => { try { return execSync('git rev-parse --short HEAD', { cwd: ROOT }).toString().trim(); } catch { return 'unknown'; } })();
const dirty = (() => { try { return execSync('git status --porcelain', { cwd: ROOT }).toString().trim().length > 0; } catch { return true; } })();

// The sources, deduped exactly as render/interior.js and syncInteriorLights() dedupe them.
const seen = new Set(); const SRC = [];
for (const L of REC.lights || []) {
  const p = L.pos || [0, 1.4, 0];
  const k = `${Math.round(p[0] * 10)},${Math.round(p[1] * 10)},${Math.round(p[2] * 10)}`;
  if (seen.has(k)) continue;
  seen.add(k);
  const hearth = L.kind === 'hearth';
  SRC.push({ p, i: Number(L.intensity ?? 0.55) * CFG.authored_intensity_to_L_scale, reach2: (hearth ? CFG.reach_m.hearth : CFG.reach_m.flame) ** 2, hearth, snuffable: !!L.snuffable });
}
const sample = (x, z) => {
  let L = CFG.interior_ambient_L;
  for (const s of SRC) {
    const dx = x - s.p[0], dy = 1.35 - s.p[1], dz = z - s.p[2];
    const d2 = dx * dx + dy * dy + dz * dz;
    if (d2 > s.reach2) continue;
    L += s.i / (CORE + d2);
  }
  return Math.min(1, L);
};
// The pre-round number, from sim/stealth/system.js::skyAmbient — overcast day, which is what the
// default state ships, and what the delete-the-fix arm measured flat across the whole room.
const OLD_L = 0.75;
const GAMMA = DET.visibility.light_exponent;
// V for a walking, medium-load, Sneak 5 character — RI-STL01 §2's second worked row, so the two
// panels can be read as "how visible are you standing here".
const vis = DET.visibility;
const Vof = (L) => Math.min(vis.clamp[1], Math.max(vis.clamp[0], Math.pow(L, GAMMA) * vis.motion_M.walk * Math.max(vis.sneak_S.floor, 1 - 0.006 * 5) * vis.equip_E.medium * vis.cover_A.default));

const W = 1200, H = 700;
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
const FONT = {
  A: '01100100101111010011001', B: '11100100111100100111110', C: '01110100011000010000111', D: '11100100101001010011110',
  E: '11111100001111010000111', F: '11111100001111010000100', G: '01110100001011010011011', H: '10001100011111110001100',
  I: '11111001000010000101111', J: '00111000100001010010110', K: '10001100101110010011000', L: '10000100001000010000111',
  M: '10001110111011100011000', N: '10001110101101100111000', O: '01110100011000110001011', P: '11110100101111010000100',
  Q: '01110100011000110101001', R: '11110100101111010011000', S: '01111100000111000011111', T: '11111001000010000100001',
  U: '10001100011000110001011', V: '10001100011000101010001', W: '10001100011010111011000', X: '10001010100100010100011',
  Y: '10001010100010000100001', Z: '11111000100010001000111',
  0: '01110100111010111001011', 1: '00100011000010000100111', 2: '01110100010010010001111', 3: '11110000101110000111110',
  4: '00110010110010111110001', 5: '11111100001111000011110', 6: '01110100001111010011011', 7: '11111000100010001000010',
  8: '01110100011011010011011', 9: '01110100011011100011011',
  '-': '00000000001111000000000', '.': '00000000000000000100000', ' ': '00000000000000000000000', '+': '00000001000111000100000',
  ':': '00000001000000000100000', '/': '00001000100010001000000', '(': '00010001000010000100001', ')': '01000001000010000100010',
  ',': '00000000000000000100010', '=': '00000111100000111100000', '?': '01110100010010001000010', '!': '00100001000010000000100',
  '%': '10001000100100010001000', 'x': '00000101010001010100000', '>': '01000001000010001000100', '<': '00010001000100000100010',
};
function text(s, x, y, r, g, b, scale = 1) {
  let cx = x;
  for (const ch of String(s).toUpperCase()) {
    const bits = FONT[ch] || FONT[ch.toLowerCase()];
    if (bits) for (let j = 0; j < 7; j++) for (let i = 0; i < 5; i++) if (bits[j * 5 + i] === '1') rect(cx + i * scale, y + j * scale, scale, scale, r, g, b);
    cx += 6 * scale;
  }
  return cx;
}
// A warm ramp: black floor -> ember -> lamplight.
const ramp = (t) => {
  const u = Math.max(0, Math.min(1, t));
  return [Math.round(18 + 237 * Math.pow(u, 0.75)), Math.round(16 + 210 * Math.pow(u, 1.25)), Math.round(24 + 140 * Math.pow(u, 2.1))];
};

text('W1-15 R3   THE LAMPS ARE DRAWN. NOW THE DETECTION MODEL HAS BEEN TOLD.', 34, 26, 0xf0, 0xe6, 0xc8, 2);
text(`ARCHON-APOTHECARY, ${REC.bounds_m.x[1] - REC.bounds_m.x[0]} X ${REC.bounds_m.z[1] - REC.bounds_m.z[0]} M FLOOR AT CHEST HEIGHT, NOON   ${(REC.lights || []).length} LAMPS AUTHORED, ${SRC.length} DISTINCT   COMMIT ${commit}   DIRTY=${dirty}`, 34, 52, 0x8a, 0x92, 0x9c, 1);

const PW = 470, PH = 440, PY = 110;
const panels = [
  { x: 60, title: 'BEFORE   L = SKYAMBIENT(ENV), ONE NUMBER FOR THE WHOLE ROOM', f: () => OLD_L },
  { x: 640, title: 'AFTER   L = THE ROOM\'S OWN LAMPS, SAMPLED WHERE YOU STAND', f: sample },
];
for (const p of panels) {
  text(p.title, p.x, PY - 24, 0xf0, 0xe6, 0xc8, 1);
  text('CONTOURS AT L = 0.10 0.25 0.40 0.60 0.80 0.95', p.x, PY - 12, 0x6a, 0x72, 0x7c, 1);
  const b = REC.bounds_m;
  for (let j = 0; j < PH; j++) {
    for (let i = 0; i < PW; i++) {
      const x = b.x[0] + (i / PW) * (b.x[1] - b.x[0]);
      const z = b.z[0] + (j / PH) * (b.z[1] - b.z[0]);
      const L = p.f(x, z);
      const [r, g, bl] = ramp(L);
      set(p.x + i, PY + j, r, g, bl);
      // ISO-CONTOURS at the light table's own interior rows. Inside the bright half of the room
      // the ramp saturates and the eye reads it as flat; these are the lines that show it is not.
      // Drawn where the sample crosses a threshold between this pixel and the one to its left.
      const xPrev = b.x[0] + ((i - 1) / PW) * (b.x[1] - b.x[0]);
      const Lp = i > 0 ? p.f(xPrev, z) : L;
      for (const t of [0.10, 0.25, 0.40, 0.60, 0.80, 0.95]) if ((L - t) * (Lp - t) < 0) set(p.x + i, PY + j, 0x1a, 0x14, 0x10);
    }
  }
  rect(p.x - 1, PY - 1, PW + 2, 1, 0x44, 0x48, 0x50); rect(p.x - 1, PY + PH, PW + 2, 1, 0x44, 0x48, 0x50);
  rect(p.x - 1, PY - 1, 1, PH + 2, 0x44, 0x48, 0x50); rect(p.x + PW, PY - 1, 1, PH + 2, 0x44, 0x48, 0x50);
}
// The lamps themselves, on the right panel only, so "there is a fitting here" and "it is brighter
// here" are visibly the same fact.
const b = REC.bounds_m;
for (const s of SRC) {
  const i = ((s.p[0] - b.x[0]) / (b.x[1] - b.x[0])) * PW, j = ((s.p[2] - b.z[0]) / (b.z[1] - b.z[0])) * PH;
  const R = s.hearth ? 5 : 3;
  for (let a = 0; a < 360; a += 6) set(640 + i + Math.cos(a * Math.PI / 180) * R, PY + j + Math.sin(a * Math.PI / 180) * R, 0x20, 0x18, 0x10);
  for (let a = 0; a < 360; a += 6) set(640 + i + Math.cos(a * Math.PI / 180) * (R - 1), PY + j + Math.sin(a * Math.PI / 180) * (R - 1), 0xff, 0xff, 0xff);
}

// ---- the numbers underneath ---------------------------------------------------------------------
const vals = [];
for (let x = b.x[0] + 0.25; x <= b.x[1] - 0.25; x += 0.25) for (let z = b.z[0] + 0.25; z <= b.z[1] - 0.25; z += 0.25) vals.push(sample(x, z));
const lo = Math.min(...vals), hi = Math.max(...vals);
let y = PY + PH + 34;
text('BEFORE', 60, y, 0x8a, 0x92, 0x9c, 2);
text(`L ${OLD_L.toFixed(4)} EVERYWHERE   SPREAD 0.0000   V ${Vof(OLD_L).toFixed(4)} EVERYWHERE`, 60, y + 26, 0xd8, 0xcc, 0xa8, 1);
text('AND AT 03:00 IT IS 0.0900 EVERYWHERE, BECAUSE INDOOR LIGHT WAS THE SKY', 60, y + 44, 0x8a, 0x92, 0x9c, 1);
text('AFTER', 640, y, 0xf0, 0xa0, 0x50, 2);
text(`L ${lo.toFixed(4)} TO ${hi.toFixed(4)}   SPREAD ${(hi - lo).toFixed(4)}   V ${Vof(lo).toFixed(4)} TO ${Vof(hi).toFixed(4)}`, 640, y + 26, 0xd8, 0xcc, 0xa8, 1);
text(`AND AT 03:00 IT IS THE SAME, BECAUSE A LAMP DOES NOT CARE WHAT TIME IT IS`, 640, y + 44, 0x8a, 0x92, 0x9c, 1);
text('MEASURED LIVE: SNUFFING ONE LAMP TOOK L 1.0000 > 0.5360, V 1.3000 > 0.6023, AND AN ENEMY 6 M AWAY FROM 40 FRAMES TO REACH ALERT 70 TO 80.', 60, y + 74, 0xf0, 0xe6, 0xc8, 1);
text('THE SAME THEFT UNDER THE LAMP AND IN THE DARK CORNER OF THE SAME ROOM: BOUNTY 294 G AGAINST 118 G, IDENTIFIED AGAINST NOT.', 60, y + 92, 0xf0, 0xe6, 0xc8, 1);

const out = join(ROOT, 'docs/shots/2026-08-08-w1-15-r3-the-lamps-reach-the-detection-model.png');
png(out);
process.stdout.write(`wrote ${out}\n  sources ${SRC.length} of ${(REC.lights || []).length} declared, ${SRC.filter((s) => s.snuffable).length} snuffable\n  L ${lo.toFixed(4)}..${hi.toFixed(4)} (before: flat ${OLD_L})\n`);
