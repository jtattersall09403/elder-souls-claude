#!/usr/bin/env node
// w1-23-r4-chart.mjs — THE PICTURE FOR W1-23 ROUND 4.
//
// Two numbers, side by side, both taken from the tools rather than typed: how many of the
// province's nineteen registered arguments a player can read BOTH sides of, and what proportion
// of its Argonians are named like Argonians.
//
// The bars are read out of `tools/lore/critic-w1-23-r3-reach.mjs --json` (the round-3 critic's own
// instrument, for the AFTER) and out of the round-3 verdict's published figures (the BEFORE), and
// the naming pair is `tools/lore/lor04-validate.mjs --at <rev>` against the same tool run on the
// working tree. Nothing on this picture is a number this file knows on its own.
//
// Run: node tools/lore/w1-23-r4-chart.mjs [--out docs/shots/<name>.png]
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';
import { makeText } from '../lib/chart-font.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = (() => {
  const i = process.argv.indexOf('--out');
  return i >= 0 ? path.resolve(ROOT, process.argv[i + 1])
    : path.join(ROOT, 'docs/shots/2026-08-08-w1-23-r4-both-sides-of-the-argument.png');
})();
const BASELINE = (() => { const i = process.argv.indexOf('--baseline'); return i >= 0 ? process.argv[i + 1] : '97bb918'; })();

const run = (cmd, args) => {
  try { return execFileSync(cmd, args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 128 * 1024 * 1024 }); }
  catch (e) { if (e.stdout) return e.stdout.toString(); throw e; }
};

// ---- the numbers, from the tools ---------------------------------------------------------------
const reach = JSON.parse(run('node', ['tools/lore/critic-w1-23-r3-reach.mjs', '--json']));
const afterBoth = reach.A.both, pairs = reach.A.mutual;
const afterReachable = reach.books - (reach.books - Object.keys(reach).length >= 0 ? 0 : 0);
const nameAfter = JSON.parse(run('node', ['tools/lore/lor04-validate.mjs', '--json']));
const nameBefore = JSON.parse(run('node', ['tools/lore/lor04-validate.mjs', '--json', '--at', BASELINE]));

const genAfter = nameAfter.by_provenance.find((r) => r.which === 'generated');
const genBefore = nameBefore.by_provenance.find((r) => r.which === 'generated');

// The BEFORE for pair reach is the round-3 verdict's published figure, and it is quoted as such.
const beforeBoth = 3;

// ---- draw ---------------------------------------------------------------------------------------
const W = 1000, H = 520;
const png = new PNG({ width: W, height: H });
const BG = [0x14, 0x16, 0x18], INK = [0xEE, 0xEE, 0xE4], DIM = [0x7A, 0x82, 0x88];
const RED = [0xC4, 0x5A, 0x4A], GREEN = [0x6E, 0xA8, 0x72];

function px(x, y, c) {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const i = (W * y + x) << 2;
  png.data[i] = c[0]; png.data[i + 1] = c[1]; png.data[i + 2] = c[2]; png.data[i + 3] = 255;
}
function rect(x, y, w, h, r, g, b) {
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) px(x + i, y + j, [r, g, b]);
}
rect(0, 0, W, H, ...BG);
const text = makeText(rect);
const say = (s, x, y, c, sc = 2) => text(String(s).toUpperCase(), x, y, c[0], c[1], c[2], sc);

say('W1-23 ROUND 4', 40, 34, DIM, 2);
say('BOTH SIDES OF THE ARGUMENT', 40, 60, INK, 4);
say(`COMMIT ${String(reach.commit).slice(0, 7)}`, 40, 108, DIM, 2);

// --- panel 1: pair reach
say('REGISTERED CONTRADICTION PAIRS A PLAYER CAN READ BOTH SIDES OF', 40, 160, DIM, 2);
const barX = 40, barW = 900, barH = 46;
function pairBar(y, n, label, colour) {
  rect(barX, y, barW, barH, 0x22, 0x26, 0x2A);
  const w = Math.round(barW * (n / pairs));
  rect(barX, y, w, barH, ...colour);
  say(label, barX + 10, y + 15, [0x14, 0x16, 0x18], 2);
  say(`${n} OF ${pairs}`, barX + barW - 120, y + 15, INK, 2);
}
pairBar(186, beforeBoth, 'BEFORE', RED);
pairBar(244, afterBoth, 'AFTER', GREEN);
say('BEFORE IS THE ROUND-3 VERDICT. AFTER IS ITS OWN INSTRUMENT, RE-RUN.', 40, 302, DIM, 2);

// --- panel 2: naming
say('GENERATED ARGONIAN ROSTERS: SHARE CARRYING A HYPHENATED-ENGLISH NAME', 40, 356, DIM, 2);
const nb = genBefore.descriptive_share, na = genAfter.descriptive_share, target = 0.11;
function nameBar(y, share, label, colour) {
  rect(barX, y, barW, barH, 0x22, 0x26, 0x2A);
  rect(barX, y, Math.round(barW * share), barH, ...colour);
  // the attested 11% line
  const t = barX + Math.round(barW * target);
  for (let j = -6; j < barH + 6; j++) px(t, y + j, INK);
  say(label, barX + 10, y + 15, [0x14, 0x16, 0x18], 2);
  say(`${(100 * share).toFixed(1)} PCT`, barX + barW - 120, y + 15, INK, 2);
}
nameBar(382, nb, 'BEFORE', RED);
nameBar(440, na, 'AFTER', GREEN);
say('THE WHITE LINE IS RI-LOR04 S4 ATTESTED SHARE, 11 PCT', barX + Math.round(barW * target) + 8, 500, DIM, 2);

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, PNG.sync.write(png));
console.log(`pair reach   ${beforeBoth} -> ${afterBoth} of ${pairs}`);
console.log(`naming       ${(100 * nb).toFixed(1)}% -> ${(100 * na).toFixed(1)}% (attested 11%)`);
console.log(`wrote ${path.relative(ROOT, OUT)}`);
void afterReachable;
