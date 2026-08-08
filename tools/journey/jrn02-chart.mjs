#!/usr/bin/env node
// jrn02-chart.mjs — W1-28's picture: the sixteen buttons the game has, and the one the trace
// can see; and the five arms of the competence 2x2 beside it.
//
// The 5x5 chart font comes from tools/lib/chart-font.mjs. Do not paste a font table back in
// here — see W1-CHARTFONT for the shear that cost a round.
'use strict';

import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from '../lib/cli.mjs';
import { makeText } from '../lib/chart-font.mjs';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..');
const args = parseArgs(process.argv.slice(2));
const cov = JSON.parse(readFileSync(args.coverage || join(ROOT, 'reports/w1-28/verbcov/verb-coverage.json'), 'utf8'));
const comp = JSON.parse(readFileSync(args.competence || join(ROOT, 'reports/w1-28/competence/competence.json'), 'utf8'));

const W = 1220, H = 700;
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
const text = makeText(rect);

const GOLD = [0xc9, 0xb0, 0x72], PALE = [0x8a, 0x92, 0x9c];
const RED = [0xd9, 0x5c, 0x3f], GREEN = [0x4e, 0xa3, 0x72], CREAM = [0xf0, 0xe6, 0xc8];

text('W1-28  THE FIRST HOUR AS INTERACTION: WHAT THE INSTRUMENT CAN SEE, AND WHAT CAN BE LEARNED',
  28, 24, CREAM[0], CREAM[1], CREAM[2], 2);
text(`RI-JRN02   COMMIT ${String(cov.commit).slice(0, 7)}   MEASURED IN A RUNNING BROWSER`,
  28, 50, PALE[0], PALE[1], PALE[2], 1);

// ---- LEFT: the verb ledger's blind spot ---------------------------------------------------
text('THE VERB LEDGER (M-I1) READS `INPUT_ACTION`. THESE ARE THE BUTTONS THAT EMIT ONE:',
  28, 86, GOLD[0], GOLD[1], GOLD[2], 1);

const actions = Object.keys(cov.actions);
const landedSilent = new Set(cov.landed_but_silent || []);
let y = 112;
for (const a of actions) {
  const rec = cov.actions[a];
  const emits = rec.visible_to_M_I1;
  const executed = landedSilent.has(a);
  const col = emits ? GREEN : (executed ? RED : PALE);
  // the button name
  text(a.toUpperCase().replace(/_/g, ' '), 40, y, col[0], col[1], col[2], 1);
  // a bar: full if it emits, a stub if it does not
  rect(200, y - 1, emits ? 240 : 8, 7, col[0], col[1], col[2]);
  if (executed) text('EXECUTED, EMITTED NOTHING', 216, y, RED[0], RED[1], RED[2], 1);
  else if (!emits) text('NO CONSEQUENCE OBSERVED HERE', 216, y, 0x50, 0x56, 0x5e, 1);
  y += 17;
}
y += 6;
text(`0 OF ${actions.length} BUTTONS EMIT IT.  ${(cov.landed_but_silent || []).length} OF THEM DEMONSTRABLY FIRED ANYWAY.`,
  40, y, RED[0], RED[1], RED[2], 1); y += 18;
text('POSITIVE CONTROL: PRESSING `INTERACT` AT A SIGNPOST *DOES* PUT INPUT_ACTION IN THE TRACE,',
  40, y, PALE[0], PALE[1], PALE[2], 1); y += 15;
text('SO THE SILENCE IS THE ENGINE, NOT THE DRAIN. THE ONLY EMITTER IS DEAD CODE.',
  40, y, PALE[0], PALE[1], PALE[2], 1);

// ---- RIGHT: the competence arms -----------------------------------------------------------
const X = 640;
text('CAN THE FIGHT BE LEARNED?  SAME CODE, SAME GEAR, SAME ENEMY TIER.', X, 86, GOLD[0], GOLD[1], GOLD[2], 1);
text('ONLY WHAT THE AGENT KNOWS ABOUT THE ENEMY CHANGES.', X, 102, PALE[0], PALE[1], PALE[2], 1);

const arms = Object.values(comp.arms);
const BARW = 420;
let ay = 136;
for (const a of arms) {
  const first = a.E_first.roll_efficiency, late = a.E_late.roll_efficiency;
  const improved = late - first >= 0.15;
  const isControl = /MUST BE FLAT|teardown|RANDOMISED/i.test(a.name);
  const col = improved ? GREEN : (isControl ? PALE : RED);
  text(a.name.split('—')[0].trim() + '  ' + a.name.split('—').slice(1).join('—').trim().slice(0, 46).toUpperCase(),
    X, ay, col[0], col[1], col[2], 1);
  ay += 15;
  // first bar (dim) then late bar (bright), same origin
  rect(X, ay, Math.max(2, Math.round(first * BARW)), 6, Math.round(col[0] * 0.45), Math.round(col[1] * 0.45), Math.round(col[2] * 0.45));
  rect(X, ay + 8, Math.max(2, Math.round(late * BARW)), 6, col[0], col[1], col[2]);
  text(`E_FIRST ${first}`, X + BARW + 10, ay - 1, PALE[0], PALE[1], PALE[2], 1);
  text(`E_LATE ${late}`, X + BARW + 10, ay + 7, col[0], col[1], col[2], 1);
  ay += 26;
}
ay += 8;
const v = comp.verdict;
for (const [k, r] of Object.entries(v)) {
  const c = r.holds ? GREEN : RED;
  text(`[${r.holds ? 'OK' : 'FAIL'}] ${k.replace(/_/g, ' ').toUpperCase()}`, X, ay, c[0], c[1], c[2], 1);
  ay += 15;
}
ay += 8;
const wd = comp.the_finding_about_the_fight;
if (wd) {
  text(`THE ENEMY DECLARES STARTUPS ${wd.windups_declared.join(' / ')} F  —  SPREAD ${wd.spread_f} F`,
    X, ay, GOLD[0], GOLD[1], GOLD[2], 1); ay += 15;
  text(`AGAINST AN ${wd.iframe_window_f}-FRAME I-FRAME WINDOW. YOU LEARN THE MOVES, NOT THE MEAN:`,
    X, ay, PALE[0], PALE[1], PALE[2], 1); ay += 15;
  text(`ONE REPEATED ATTACK +${wd.single_repeated_attack_delta}   THE WHOLE MOVESET +${wd.full_moveset_delta}`,
    X, ay, CREAM[0], CREAM[1], CREAM[2], 1);
}

const out = args.out || join(ROOT, 'docs/shots/2026-08-08-w1-28-the-verb-ledger-cannot-see-the-buttons.png');
png(out);
process.stdout.write(`jrn02-chart -> ${out}\n`);
