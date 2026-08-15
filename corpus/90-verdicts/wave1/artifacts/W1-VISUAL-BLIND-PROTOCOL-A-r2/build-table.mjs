#!/usr/bin/env node
// Derive the r2 pairing table from r1's, changing exactly one thing: which capture our side comes
// from. Reference plates, reference crop boxes, our crop boxes, jpeg_q and crop size are carried
// over byte-for-byte so that r2 asks r1's question of a newer build, not a different question.
import fs from 'node:fs';

const R1 = 'corpus/90-verdicts/wave1/artifacts/W1-VISUAL-BLIND-PROTOCOL-A-r1/key/pairing.json';
const OLD_RUN = 'reports/runpod-gpu/runs/protocol-a-chars-r3/artifacts/deck/frames/';
const NEW_RUN = process.argv[2];
if (!NEW_RUN) { console.error('usage: build-table.mjs <new-frames-dir-with-trailing-slash> <out.json>'); process.exit(1); }
const OUT = process.argv[3];

const t = JSON.parse(fs.readFileSync(R1, 'utf8'));
let moved = 0;
for (const p of t.pairs) {
  if (!p.ours.file.startsWith(OLD_RUN)) { console.error(`unexpected ours path: ${p.ours.file}`); process.exit(1); }
  p.ours.file = NEW_RUN + p.ours.file.slice(OLD_RUN.length);
  moved++;
}
// --- E1: a HUD element that did not exist in r1 now sits inside two of r1's windows ---
// The current build draws a region name-plate ("western-rootlands") into the canvas at
// x 42..~180, y 962..983 (measured on both affected frames; strict bright-pixel bbox
// 42,962..164,976, loose bbox to x~180 including the underline). r1's own pairing table
// enumerated three HUD elements — status bars, compass, hotbar — and its windows cleared all
// three. This one is new: r1's shipped pair04/B.png contains no text at the same crop.
// Both r1 windows at x=150 catch the last glyphs, which is RI-VIS06 §D's "HUD, watermark,
// subtitle" row and would be a literal label on our arm. The x origin moves 150 -> 200,
// a 50 px translation on the same frame at the same scale and the same y.
const HUD_FIX = { from: '150,480,512,512', to: '200,480,512,512' };
let hudFixed = 0;
for (const p of t.pairs) {
  if (p.ours.crop === HUD_FIX.from) {
    p.ours.crop = HUD_FIX.to;
    p.mismatch = (p.mismatch ? p.mismatch + ' ' : '') +
      'E1 (r2): our window moved from 150,480 to 200,480 because the current build draws a region name-plate at x 42..180, y 962..983 that r1 did not have, and r1\'s window caught its last two glyphs. Verified by opening the crop, before and after.';
    hudFixed++;
  }
}
if (hudFixed !== 2) { console.error(`expected 2 windows to need the HUD fix, found ${hudFixed}`); process.exit(1); }

t.wave = 'w1-r2';
t.built_by = 'I3 Protocol A re-run — pack builder (stage 1 of 2)';
t.derived_from = R1;
t.what_changed_from_r1 = 'ONE thing: our side is captured from the current build instead of the 2026-08-14 build. Every reference plate, every reference crop box and every one of our crop boxes is carried over unchanged from r1, because the question this run exists to answer is whether F1/F2/F3 moved a blind judgement — and that question is only answerable if the instrument is the same one.';
t.r1_owed_remedies_deliberately_NOT_applied = 'r1 recorded D3 (pair02/pair03 reference windows sit in background bokeh) and D4 (pair05 subject scale differs) with owed remedies that swap plates. Those remedies are NOT applied here, on purpose: swapping a plate changes what the judge is comparing, and a changed pair cannot be read against r1. They remain owed for the first Protocol A run whose purpose is not comparison with r1. D5 (two reference windows moved after looking, in r1) is inherited as-is — the windows are r1’s, not re-chosen here, so no new post-hoc degree of freedom is added.';
fs.writeFileSync(OUT, JSON.stringify(t, null, 2) + '\n');
console.log(`${moved} pairs repointed to ${NEW_RUN}; wrote ${OUT}`);
