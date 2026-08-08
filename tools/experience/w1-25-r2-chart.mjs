#!/usr/bin/env node
// w1-25-r2-chart.mjs — THE PICTURE FOR W1-25 ROUND 2: the verdict cascade, before and after.
//
// The r1 verdict's one-line finding was that the facility built to catch inert controls had one:
// its own control against the project's most common failure was delegated to an OPTIONAL integer
// that the caller chose and nothing validated, and the default answer to a control that declared
// nothing was `OK`.
//
// This draws the cascade both ways, with the four cases the critic built running down it. Every
// verdict on the right-hand column is READ FROM THE ARTIFACT the self-test just wrote — nothing
// on this chart is typed in.
//
//   node tools/experience/w1-25-r2-chart.mjs --out docs/shots/<name>.png
'use strict';

import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import { makeText, textWidth } from '../lib/chart-font.mjs';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..');
const W = 1400, H = 840;
const buf = Buffer.alloc(W * H * 3);

const px = (x, y, c) => { x = Math.round(x); y = Math.round(y); if (x < 0 || y < 0 || x >= W || y >= H) return; const i = (y * W + x) * 3; buf[i] = c[0]; buf[i + 1] = c[1]; buf[i + 2] = c[2]; };
const rect = (x, y, w, h, c) => { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) px(x + i, y + j, c); };
const _t = makeText((x, y, w, h, r, g, b) => rect(x, y, w, h, [r, g, b]));
const text = (s, x, y, c, sc = 2) => _t(s, x, y, c[0], c[1], c[2], sc);

const BG = [16, 18, 22], FG = [232, 232, 228], DIM = [124, 128, 136];
const RED = [214, 92, 78], GRN = [110, 176, 122], AMB = [206, 166, 84], BLU = [104, 148, 200];
rect(0, 0, W, H, BG);

// ---- the numbers, off disk -------------------------------------------------------------------
const read = (rel) => { const p = join(ROOT, rel); return existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : null; };
const st = read('reports/experience/w1-25-r2/self-test.json');
const claims = read('reports/composition/w1/claims.json');
const fixture = read('reports/experience/w1-25-r2/fixture.json');
const results = (st && st.self_test && st.self_test.results) || [];
const verdictOf = (id) => { const r = results.find((x) => x.id === id); return r ? r.verdict : '?'; };
const breaks = (st && st.self_test && st.self_test.breaks) || [];
const covered = (st && st.self_test && st.self_test.separability && st.self_test.separability.covered) || [];

const commit = (() => { try { return execSync('git rev-parse --short HEAD', { cwd: ROOT }).toString().trim(); } catch { return 'unknown'; } })();

text('THE CONTROL FACILITY HAD AN OPTIONAL CONTROL', 40, 30, FG, 4);
text('W1-25 ROUND 2 - THE VERDICT CASCADE, BEFORE AND AFTER - ' + commit, 40, 66, DIM, 2);

// ---- the two cascades -------------------------------------------------------------------------
const CASCADE_BEFORE = ['ERROR (AN ARM THREW)', 'VACUOUS', 'INERT', 'WRONG DIRECTION', 'UNDERPOWERED', 'MASKED', 'OK'];
const CASCADE_AFTER = ['ERROR (AN ARM THREW)', 'NO MEASUREMENT', 'ERROR (NO SUPPORT)', 'VACUOUS', 'SHORT CIRCUIT',
  'INERT', 'MASKED', 'WRONG DIRECTION', 'UNDERPOWERED', 'ERROR (NO UNIT)', 'OK'];
const NEW = new Set(['NO MEASUREMENT', 'ERROR (NO SUPPORT)', 'SHORT CIRCUIT', 'ERROR (NO UNIT)']);

const col = (x, title, rows, sub) => {
  text(title, x, 112, FG, 2);
  text(sub, x, 138, DIM, 1);
  let y = 176;
  for (const r of rows) {
    const moved = r === 'MASKED' && rows === CASCADE_AFTER;
    const c = NEW.has(r) ? GRN : moved ? AMB : DIM;
    rect(x, y + 3, 8, 8, c);
    text(r, x + 18, y, NEW.has(r) || moved ? FG : DIM, 2);
    if (NEW.has(r)) text('NEW', x + 440, y, GRN, 2);
    if (moved) text('HOISTED', x + 440, y, AMB, 2);
    y += 30;
  }
};
col(40, 'ROUND 1 - 7 VERDICTS', CASCADE_BEFORE,
  'MASKED LAST, SHADOWED BY ANY UNMET MARGIN. NO NAME FOR A SHORT CIRCUIT.');
col(680, 'ROUND 2 - 9 VERDICTS', CASCADE_AFTER,
  'SUPPORT MANDATORY. UNDEFINED IS NOT AGREEMENT.');

// ---- the four collisions, with the verdicts the artifact carries -------------------------------
let y = 520;
text('THE CASES THE CRITIC BUILT, RUN AGAIN', 40, y, FG, 2); y += 34;
const CASES = [
  ['DECLARES NO SUPPORT AT ALL', 'OK', verdictOf('synthetic.support-undeclared')],
  ['BOTH ARMS MEASURED UNDEFINED', 'INERT', verdictOf('synthetic.no-measurement')],
  ['TEARDOWN EXITS BEFORE COMPARATOR', 'OK', verdictOf('synthetic.short-circuit')],
  ['TWO GUARDS, 5 PCT, 50 PCT MARGIN', 'UNDERPOWERED', verdictOf('collide.masked-under-margin')],
  ['A LIVE FACTOR ITS PARTNER CANCELS', 'INERT', verdictOf('collide.cancellation')],
  ['THE W1-13 CASE, ESCAPE HATCH SET', 'OK', verdictOf('collide.support-note-omitted')],
];
for (const [what, was, now] of CASES) {
  text(what, 40, y, DIM, 2);
  text(was, 480, y, RED, 2);
  text('>', 700, y, DIM, 2);
  text(now, 740, y, GRN, 2);
  y += 28;
}

// ---- the footer numbers ------------------------------------------------------------------------
const caught = breaks.filter((b) => b.caught).length;
const lines = [
  `SELF-TEST ${results.length} CASES, ${covered.length} DISTINCT VERDICTS, ${caught} OF ${breaks.length} INJECTED DEFECTS CAUGHT`,
  claims ? `SEAM CROSSINGS WITH DATA ${claims.claimed_crossing_cells} OF ${claims.declared_crossing_cells} - ROUND 1 PUBLISHED 4, LOOKING ONLY AT THE SOURCE END` : '',
  fixture && fixture.active ? `A WALK RECORDS ${fixture.still.events} EVENTS IN ${fixture.still.frames} FRAMES. A SESSION THAT FIGHTS AND DIES RECORDS ${fixture.active.events} OVER ${fixture.active.kinds} KINDS` : '',
].filter(Boolean);
rect(40, H - 116, W - 80, 2, [40, 44, 50]);
let fy = H - 98;
for (const l of lines) { text(l, 40, fy, l.startsWith('SELF-TEST') ? GRN : BLU, 2); fy += 26; }

// ---- PNG ---------------------------------------------------------------------------------------
const raw = Buffer.alloc((W * 3 + 1) * H);
for (let yy = 0; yy < H; yy++) { raw[yy * (W * 3 + 1)] = 0; buf.copy(raw, yy * (W * 3 + 1) + 1, yy * W * 3, (yy + 1) * W * 3); }
const chunk = (type, data) => {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crcTable = chunk.t || (chunk.t = (() => { const t = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })());
  let crc = 0xffffffff; for (const b of td) crc = crcTable[(crc ^ b) & 0xff] ^ (crc >>> 8);
  const cb = Buffer.alloc(4); cb.writeUInt32BE((crc ^ 0xffffffff) >>> 0);
  return Buffer.concat([len, td, cb]);
};
const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4); ihdr[8] = 8; ihdr[9] = 2;
const png = Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);

const argv = process.argv.slice(2);
const i = argv.findIndex((a) => a.startsWith('--out'));
const out = i < 0 ? 'docs/shots/2026-08-08-w1-25-r2-the-control-facility-had-an-optional-control.png'
  : (argv[i].includes('=') ? argv[i].split('=')[1] : argv[i + 1]);
mkdirSync(join(ROOT, dirname(out)), { recursive: true });
writeFileSync(join(ROOT, out), png);
process.stdout.write(`wrote ${out}  (${(png.length / 1024).toFixed(0)} KB)\n`);
