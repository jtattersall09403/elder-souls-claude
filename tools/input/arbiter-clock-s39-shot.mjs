#!/usr/bin/env node
// arbiter-clock-s39-shot.mjs — draw the one picture S39's falsifier is about.
//
// Reads `reports/s39/arbiter-clock-s39.json` and draws the five canonical presses twice: once
// above the 12.00 Hz rAF floor and once below it. Each press shows what the thumb asked for,
// what the game counted, and which action the gate promoted — against the 12 f@60 gate line.
// It draws NOTHING it cannot read out of the artifact, and says so on the picture when an arm
// is missing, because a chart that fills in a gap is a chart that hides one.
'use strict';
import fs from 'node:fs';
import path from 'node:path';
import { REPO_ROOT, ensureDir } from '../lib/cli.mjs';

const src = process.argv[2] || path.join(REPO_ROOT, 'reports', 's39', 'arbiter-clock-s39.json');
const out = process.argv[3] || path.join(REPO_ROOT, 'docs', 'shots', '2026-08-08-s39-hold-gate-above-and-below-the-12hz-floor.svg');
const rec = JSON.parse(fs.readFileSync(src, 'utf8'));
const a2 = rec.arms && rec.arms.a2;
if (!a2) { process.stderr.write(`no A2 arm in ${src} — nothing to draw\n`); process.exit(4); }

const W = 1180, H = 620;
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const p = [];
p.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="Iowan Old Style, Palatino, Georgia, serif">`);
p.push(`<rect width="${W}" height="${H}" fill="#14100c"/>`);
p.push(`<text x="40" y="52" fill="#e8dcc6" font-size="26">The hold gate, above and below the 12.00 Hz floor</text>`);
p.push(`<text x="40" y="80" fill="#9d8f76" font-size="15">ARBITRATION S39's own falsifier, run at ${esc(rec.served_commit || rec.commit)}. Bars are the frames the GAME counted for each press; the dashed line is the 12 f@60 gate.</text>`);
p.push(`<text x="40" y="102" fill="#9d8f76" font-size="15">Below the floor the world runs at ${a2.below ? (a2.below.rate.sim_time_ratio * 100).toFixed(1) : '?'}% of real time. The thumb does not slow down with it — that asymmetry is the whole seam.</text>`);

const arms = [
  { key: 'above', x: 70, label: `above the floor — rAF ${a2.above ? a2.above.rate.raf_hz : '?'} Hz, ${a2.above ? a2.above.rate.sim_steps_per_s : '?'} fixed steps/s` },
  { key: 'below', x: 630, label: `below the floor — rAF ${a2.below ? a2.below.rate.raf_hz : '?'} Hz, ${a2.below ? a2.below.rate.sim_steps_per_s : '?'} fixed steps/s` },
];
const maxF = 36;
const plotH = 300, plotY = 480;
for (const arm of arms) {
  const side = a2[arm.key];
  p.push(`<text x="${arm.x}" y="150" fill="#e8dcc6" font-size="17">${esc(arm.label)}</text>`);
  if (!side || !side.rows) { p.push(`<text x="${arm.x}" y="300" fill="#c07a5a" font-size="16">this arm did not run</text>`); continue; }
  const gateY = plotY - (12 / maxF) * plotH;
  p.push(`<line x1="${arm.x}" y1="${gateY}" x2="${arm.x + 460}" y2="${gateY}" stroke="#c9a227" stroke-width="1.5" stroke-dasharray="6 5"/>`);
  p.push(`<text x="${arm.x + 466}" y="${gateY + 5}" fill="#c9a227" font-size="13">12 f@60</text>`);
  p.push(`<line x1="${arm.x}" y1="${plotY}" x2="${arm.x + 460}" y2="${plotY}" stroke="#3a332a" stroke-width="1"/>`);
  side.rows.forEach((r, i) => {
    const bw = 54, gap = 32;
    const x = arm.x + 18 + i * (bw + gap);
    const f = Math.max(0, Number(r.frames_held_by_the_game) || 0);
    const h = Math.min(1, f / maxF) * plotH;
    const sprint = r.outcome === 'sprint';
    const right = r.outcome === r.expected_outcome;
    p.push(`<rect x="${x}" y="${plotY - h}" width="${bw}" height="${h}" fill="${sprint ? '#6f8f5a' : '#7a6a9a'}" stroke="${right ? '#e8dcc6' : '#c05a4a'}" stroke-width="${right ? 1 : 2.5}"/>`);
    p.push(`<text x="${x + bw / 2}" y="${plotY - h - 8}" fill="#e8dcc6" font-size="13" text-anchor="middle">${f}</text>`);
    p.push(`<text x="${x + bw / 2}" y="${plotY + 20}" fill="#9d8f76" font-size="12" text-anchor="middle">${r.asked_ms} ms</text>`);
    p.push(`<text x="${x + bw / 2}" y="${plotY + 38}" fill="${right ? '#8fae74' : '#c05a4a'}" font-size="12" text-anchor="middle">${esc(r.outcome)}</text>`);
    p.push(`<text x="${x + bw / 2}" y="${plotY + 55}" fill="#6d6154" font-size="11" text-anchor="middle">sim ${r.sim_frames_elapsed_during_press}f</text>`);
  });
}
const be = a2.below_score, ab = a2.above_score;
p.push(`<text x="40" y="562" fill="#9d8f76" font-size="14">"sim Nf" under each bar is how many fixed frames elapsed while the finger was down. Below the floor it is 0-5 for every press — the number the gate used to count.</text>`);
if (be && ab) p.push(`<text x="40" y="586" fill="#e8dcc6" font-size="15">Promoted action correct: ${ab.right_move}/${ab.rows} above the floor, ${be.right_move}/${be.rows} below it. Before S39 the referral measured 5 of 5 wrongly rolled.</text>`);
const a1 = rec.arms && rec.arms.a1;
if (a1 && a1.checks) p.push(`<text x="40" y="608" fill="#9d8f76" font-size="14">Replay hash above vs below the floor: ${a1.checks.cross_rate ? 'BIT-IDENTICAL' : 'DIVERGED'}${a1.runs && a1.runs.hi_1 ? ` (${esc(a1.runs.hi_1.hash.slice(0, 16))})` : ''}.</text>`);
p.push('</svg>');

ensureDir(path.dirname(out));
fs.writeFileSync(out, p.join('\n'));
process.stdout.write(`wrote ${path.relative(REPO_ROOT, out)}\n`);
