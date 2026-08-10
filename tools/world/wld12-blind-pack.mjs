#!/usr/bin/env node
// RI-WLD12 M68 — "is this one place or two?" — the blind pack. W1-02.
//
// The item's second-heaviest check (weight 16) and the one no tool can answer: capture the
// crossover point of every border, unlabeled, and ask a fresh judge whether they are looking at
// one place or two, and what told them.
//
//   PASS: >= 80% answered "two" AND >= 70% name an OBJECT or a LANDFORM, not a colour.
//   FAIL: >= 25% answer "one", or the most common named cue across the set is fog or colour —
//         "that means the province's borders are a grade, and RI-WLD04's blind region test is
//         passing on a post-process."
//
// TWO RULES THIS TOOL EXISTS TO ENFORCE, both of which have already cost this project a round:
//
//   1. THE PACK IS SHUFFLED, AND THE KEY IS WRITTEN SEPARATELY. A previous round shipped a blind
//      pack in declaration order, and 39 of 39 answers came straight off the file index — the
//      comparison was void and had to be thrown away. Frame filenames here are opaque
//      (`f00.png`...), the order is a deterministic shuffle seeded off the build, and the answer
//      key goes in `KEY.json` which the judge is not given.
//   2. THE BUILDER DOES NOT JUDGE ITS OWN PACK. `RI-MTH03` and this piece's brief are explicit,
//      and self-judging has voided two comparisons already. This tool BUILDS the pack and writes
//      the question sheet. It deliberately contains no scoring code at all.
//
// Captures go through `tools/capture/` — one warm browser for the box, never our own.
'use strict';

import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { CaptureSession } from '../capture/client.mjs';
import { BorderField } from '../../game/src/world/borders.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const R = (p) => JSON.parse(readFileSync(resolve(ROOT, p), 'utf8'));
const bordersDoc = R('game/data/world/borders.json');
const regionsDoc = R('game/data/world/regions.json');
const terrain = R('game/data/world/terrain.json');

const arg = (k, d) => { const a = process.argv.find((s) => s.startsWith(`--${k}=`)); return a ? a.split('=')[1] : d; };
const OUT = arg('out', 'reports/wld12-blind');
const W = Number(arg('width', 1920)), H = Number(arg('height', 1080));
const LIMIT = Number(arg('limit', 0));

const COLS = terrain.cols, CELL = terrain.cell_m;
const rb = Buffer.from(terrain.channels.region, 'base64');
const regionU = new Uint8Array(rb.buffer, rb.byteOffset, rb.byteLength);
const regionIndexAt = (x, z) => regionU[Math.max(0, Math.floor(z / CELL)) * COLS + Math.max(0, Math.floor(x / CELL))];
const bf = new BorderField(bordersDoc, regionsDoc.regions);

/** The same deterministic mix the rest of W1-02 uses. Seeded, so the shuffle is reproducible. */
function hash2(a, b) {
  let h = (a | 0) * 0x27d4eb2d ^ (b | 0) * 0x165667b1;
  h ^= h >>> 15; h = Math.imul(h, 0x2545f491); h ^= h >>> 13;
  h = Math.imul(h, 0x27d4eb2d); h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

// ---------------------------------------------------------------------------------------------
// Build the shot list. M68: "at the crossover point of every border, eye height 1.7 m, HUD off,
// facing ALONG the border and ACROSS it (2 shots each), mixed time of day."
// ---------------------------------------------------------------------------------------------
const shots = [];
for (const b of bf.borders) {
  let t;
  try { t = bf.traverse(b.id, regionIndexAt, 400, 2); } catch { continue; }
  const cs = Object.values(t.crossovers_m).filter((v) => v !== null);
  if (cs.length < 2) continue;
  // The crossover POINT: the middle of where the nine axes hand over. Standing here, some axes
  // are the near region's and some the far one's, which is the whole thing the judge is looking at.
  const mid = (Math.min(...cs) + Math.max(...cs)) / 2;
  const x = t.at.x + t.direction[0] * mid, z = t.at.z + t.direction[1] * mid;
  const acrossYaw = (Math.atan2(t.direction[0], t.direction[1]) * 180 / Math.PI + 360) % 360;
  const alongYaw = (acrossYaw + 90) % 360;
  // Mixed time of day, deterministic per border rather than per shot so the pair matches.
  const hour = [8, 11, 14, 17][Math.floor(hash2(b.index, 41) * 4) % 4];
  shots.push({ border: b.id, kind: b.kind, facing: 'across', x, z, yaw: acrossYaw, hour });
  shots.push({ border: b.id, kind: b.kind, facing: 'along', x, z, yaw: alongYaw, hour });
}
if (LIMIT) shots.length = Math.min(shots.length, LIMIT);

const SHUFFLE_SEED = 0xb11d;
// ---- THE SHUFFLE. Deterministic Fisher-Yates on a fixed seed, so the pack is reproducible and
// nobody has to trust that it was shuffled — they can re-derive it. Order carries no information
// about the border, the kind, or the facing.
for (let i = shots.length - 1; i > 0; i--) {
  const j = Math.floor(hash2(i, SHUFFLE_SEED) * (i + 1));
  const tmp = shots[i]; shots[i] = shots[j]; shots[j] = tmp;
}

const dir = resolve(ROOT, OUT);
const revealDir = resolve(ROOT, `${OUT}.reveal`);
mkdirSync(dir, { recursive: true });
mkdirSync(revealDir, { recursive: true });

const session = new CaptureSession();
const key = [];
const failures = [];
try {
  for (let i = 0; i < shots.length; i++) {
    const s = shots[i];
    const name = `f${String(i).padStart(2, '0')}.png`;
    let shot;
    try { shot = await session.capture({
      evidence_of: 'appearance',
      claim: `RI-WLD12 M68: the crossover point of a region border, for a blind "one place or two?" judgement`,
      place: { x: +s.x.toFixed(1), z: +s.z.toFixed(1) },
      pose: { yaw_deg: +s.yaw.toFixed(1), pitch_deg: -2, eye_m: 1.7, fov: 70 },
      time: s.hour,
      width: W, height: H,
      // The default 24/12 settle budget refused these frames outright: the province streams in
      // around a teleport, so |A-C| accumulates across both intervals and G3c fires. That refusal
      // is correct and is the reason blank and half-built frames have nearly been cited in this
      // project before. The answer is to give the streamer time, not to lower the gate.
      settle_frames: 180, settle_gap: 60,
    }); } catch (error) {
      failures.push({ frame: name, code: error.code || 'ERROR', message: error.message });
      process.stderr.write(`  REJECT ${name}: ${error.code || error.message}\n`);
      continue;
    }
    // The daemon writes into its own build-keyed cache and hands back a path; it does not take an
    // output name, and it must not — a caller-chosen filename is how a cache gets poisoned. So the
    // frame is COPIED under its opaque pack name and the real one is recorded in the key.
    copyFileSync(shot.path, resolve(dir, name));
    key.push({
      frame: name, border: s.border, kind: s.kind, facing: s.facing,
      x: +s.x.toFixed(1), z: +s.z.toFixed(1), yaw: +s.yaw.toFixed(1), hour: s.hour,
      source_png: shot.path, settle: shot.settle, cached: shot.cached,
    });
    process.stderr.write(`  ${name}  ${s.border} ${s.facing}${shot.cached ? ' (cached)' : ''}\n`);
  }
} finally {
  if (session.close) await session.close();
}

writeFileSync(resolve(revealDir, 'KEY.json'), JSON.stringify({
  item: 'RI-WLD12 M68 — one place or two',
  built_by: 'W1-02 builder',
  do_not_show_to_the_judge: true,
  shuffle: 'deterministic opaque shuffle; recipe quarantined with this reveal',
  frames: key.length,
  rejected_candidates: failures,
  key,
}, null, 1) + '\n');

writeFileSync(resolve(dir, 'QUESTION.md'), `# Blind judgement — RI-WLD12 M68

**You are being shown ${key.length} unlabeled screenshots.** The answer key is quarantined in a
sibling reveal directory; opening it voids the comparison.

For each frame, answer two questions:

1. **Is this one place, or two?**
2. **If two — what told you?** Name the single thing. An object, a landform, a plant, a building,
   a creature, the colour, the fog, the light.

Write your answers as \`reports/wld12-blind/ANSWERS.json\`:

\`\`\`json
{ "judge": "<who you are>", "answers": [ { "frame": "f00.png", "verdict": "two", "cue": "a cairn" } ] }
\`\`\`

**The builder of this pack may not score it.** \`RI-MTH03\` and this piece's brief are explicit,
and self-judging has voided two comparisons in this project already.
`);

console.log(`\nwld12-blind: ${key.length} frames in ${OUT}/; ${failures.length} rejected; reveal quarantined in ${OUT}.reveal/`);
console.log('The builder does not judge this pack. Hand it to a critic.');
if (key.length !== shots.length) process.exitCode = 1;
