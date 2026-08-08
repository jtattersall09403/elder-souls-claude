#!/usr/bin/env node
// critic-attr-scale-chart.mjs — the picture for the W1-ATTR-SCALE verdict.
//
// One claim, two measurements of it. W1-ATTR-SCALE's trial C reported `souls 0 -> 0 over 5
// kill(s)` and concluded the bought attribute stream was unfundable — the premise under every
// ceiling the piece rescaled 42 quest demands to fit. Its own shipped artifact records five
// `killEntity('undefined'): no such body` exceptions, because `listEntities()` rows carry `eid`
// and it read `id`. Re-run with the right key, ten kills award 378 souls.
//
// Left panel: what the shipped probe did. Right panel: what happens when you kill something.
//
// Run: node tools/quests/critic-attr-scale-chart.mjs [--in <souls-award.json>] [--out <png>]
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeText } from '../lib/chart-font.mjs';

const argv = process.argv.slice(2);
const argOf = (n) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : null; };
const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..');
const IN = argOf('--in') || join(ROOT, 'corpus/90-verdicts/wave1/artifacts/W1-ATTR-SCALE/souls-award.json');
const BUILDER = argOf('--builder') || join(ROOT, 'reports/attr-scale-consumption-after.json');
const OUT = argOf('--out') || join(ROOT, 'docs/shots/2026-08-08-w1-attr-scale-the-five-kills-that-never-happened.png');

const mine = JSON.parse(readFileSync(IN, 'utf8'));
const theirs = JSON.parse(readFileSync(BUILDER, 'utf8'));
const trialC = (theirs.trials || []).find((t) => t.name && t.name.includes('bought attribute stream')) || { kills: [] };
const theirThrows = (trialC.kills || []).filter((k) => k.error).length;
const theirKills = (trialC.kills || []).length;

const arms = mine.arms || {};
const paid = [];
for (const key of ['arm1_kill_immediately', 'arm2_stepped_first']) {
  for (const k of (arms[key] || {}).kills || []) if (!k.error) paid.push(k);
}
const red = ((arms.arm3_red_control || {}).kills || []).filter((k) => !k.error);
const totalAwarded = paid.length ? paid[paid.length - 1].souls_after - paid[0].souls_before : 0;

const W = 1280, H = 790;
const px = new Uint8Array(W * H * 3).fill(0x12);
const set = (x, y, r, g, b) => { if (x < 0 || y < 0 || x >= W || y >= H) return; const i = (y * W + x) * 3; px[i] = r; px[i + 1] = g; px[i + 2] = b; };
const rect = (x, y, w, h, r, g, b) => { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) set(x + i, y + j, r, g, b); };
const box = (x, y, w, h, r, g, b) => { rect(x, y, w, 2, r, g, b); rect(x, y + h, w, 2, r, g, b); rect(x, y, 2, h, r, g, b); rect(x + w, y, 2, h + 2, r, g, b); };
const text = makeText(rect);
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

const FG = [0xEE, 0xEE, 0xE4], DIM = [0x8A, 0x8A, 0x84], RED = [0xC0, 0x3A, 0x3A], GRN = [0x2E, 0x9A, 0x54], AMB = [0xC8, 0x92, 0x2A];
text('THE FIVE KILLS THAT NEVER HAPPENED', 40, 34, ...FG, 4);
text('W1-ATTR-SCALE RESCALED 42 QUEST DEMANDS ON ONE PREMISE - THAT NOTHING IN THE GAME AWARDS SOULS', 40, 78, ...DIM, 2);

// ---- left: the shipped probe ----------------------------------------------------------------
box(40, 120, 560, 540, ...RED);
text('WHAT THE SHIPPED PROBE DID', 64, 146, ...RED, 3);
text('TOOLS/QUESTS/ATTR-SCALE-CONSUMPTION.MJS TRIAL C', 64, 178, ...DIM, 2);
text('IT REPORTED', 64, 220, ...DIM, 2);
text('SOULS 0 - 0 OVER 5 KILLS', 64, 244, ...FG, 3);
text('OF 42 ENTITIES', 64, 268, ...FG, 3);
text('WHAT ITS OWN JSON RECORDS', 64, 306, ...DIM, 2);
let y = 336;
for (let i = 0; i < theirKills; i++) {
  rect(64, y, 18, 18, ...RED);
  text('KILLENTITY UNDEFINED - NO SUCH BODY', 94, y + 4, ...RED, 2);
  y += 30;
}
text(`${theirThrows} OF ${theirKills} CALLS THREW`, 64, y + 20, ...RED, 3);
text('NOTHING DIED', 64, y + 46, ...RED, 3);
text('LISTENTITIES ROWS CARRY EID. IT READ ID.', 64, y + 84, ...DIM, 2);
text('PASS PREDICATE IS  K.ERROR OR SOULS EQUAL', 64, y + 108, ...DIM, 2);
text('SO A THROWN KILL SCORES AS A PASS.', 64, y + 132, ...AMB, 2);

// ---- right: the re-measurement ---------------------------------------------------------------
box(680, 120, 560, 540, ...GRN);
text('WITH THE RIGHT KEY', 704, 146, ...GRN, 3);
text('TOOLS/QUESTS/CRITIC-ATTR-SCALE-SOULS.MJS', 704, 178, ...DIM, 2);
text('SOULS HELD, ONE BAR PER KILL', 704, 220, ...DIM, 2);
const maxS = Math.max(1, ...paid.map((k) => k.souls_after));
y = 250;
for (const k of paid) {
  const w = Math.round((k.souls_after / maxS) * 400);
  rect(704, y, Math.max(2, w), 16, ...GRN);
  text(String(k.souls_after), 704 + Math.max(2, w) + 10, y + 3, ...FG, 2);
  y += 24;
}
text(`${paid.length} REAL KILLS`, 704, y + 18, ...GRN, 3);
text(`AWARDED ${totalAwarded} SOULS`, 704, y + 44, ...GRN, 3);
text('SOULS.JS PAYS THE ALIVE-DEAD TRANSITION', 704, y + 82, ...DIM, 2);
text(`RED CONTROL - LEDGER OFF, ${red.length} KILLS, 0 SOULS`, 704, y + 106, ...AMB, 2);
text('BOUGHT STREAM HAS A SOURCE', 704, y + 140, ...FG, 3);

text('THE CEILING EVERY RESCALED DEMAND WAS FITTED TO IS NOT THE CEILING.', 40, 696, ...AMB, 2);
text('THE FIX MAY BE RIGHT. THE REASON GIVEN FOR IT IS NOT.', 40, 718, ...AMB, 2);
text(`MEASURED ${(mine.at || '').slice(0, 10)} ON HEAD`, 40, 740, ...DIM, 2);

png(OUT);
console.log(`wrote ${OUT}`);
console.log(`  shipped probe: ${theirThrows}/${theirKills} killEntity calls threw`);
console.log(`  re-measured:   ${paid.length} real kills, ${totalAwarded} souls, red control ${red.length} kills / 0 souls`);
if (theirThrows !== theirKills) { console.error('the builder artifact no longer shows all-throws — re-check the finding'); process.exit(1); }
if (totalAwarded <= 0) { console.error('no souls were awarded in the re-measurement — the chart would be a lie'); process.exit(1); }
