#!/usr/bin/env node
/**
 * base-frame-ab.mjs — the F1 critic's recomputation, over the BUILDER's own committed frames.
 *
 * Run it:  node corpus/90-verdicts/wave1/artifacts/W1-ORPHANED-SURFACE-SHADERS-CRITIC/base-frame-ab.mjs
 *
 * WHY. W1-ORPHANED-SURFACE-SHADERS reports its result as a PERTURBATION statistic: drive a
 * material's uniforms to an extreme and count moved pixels. That measures whether the shader is
 * wired up. It does not measure what the game LOOKS like, because the extreme it drives to
 * (uWear=1, uWetness=1, uWorldWetness=1, uDetailStrength=2.5) is a configuration the shipped
 * build never produces — nothing in `game/src` calls `setWorldWetness()` at all.
 *
 * But the same run also saved, in both arms, the UNPERTURBED `*-base.png` frame at every camera.
 * Those pairs are the shipped-configuration before/after: same camera, same scene, same Pod, same
 * GPU, arms differing only by the two reverted files. The pack contains them and never compared
 * them. This does, using the identical `movedFraction` maths as the builder's own tool
 * (tools/visual/w1-30-surface-consumption.mjs) so the numbers are commensurable.
 *
 * It reads only committed bytes under corpus/90-verdicts/wave1/artifacts/, so it reproduces from
 * a fresh clone with no browser, no Pod and no network.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const REPO = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../../../..');
const { PNG } = createRequire(path.join(REPO, 'tools/package.json'))('pngjs');
const R = path.join(REPO, 'corpus/90-verdicts/wave1/artifacts/W1-ORPHANED-SURFACE-SHADERS/hardware-ab');

function moved(aP, bP, thr = 3) {
  const A = PNG.sync.read(fs.readFileSync(aP)), B = PNG.sync.read(fs.readFileSync(bP));
  if (A.width !== B.width || A.height !== B.height) return { frac: 1, note: 'size mismatch' };
  const total = A.width * A.height; let n = 0, maxd = 0, sum = 0;
  for (let i = 0; i < total; i++) {
    const o = i * 4;
    const la = 0.2126 * A.data[o] + 0.7152 * A.data[o + 1] + 0.0722 * A.data[o + 2];
    const lb = 0.2126 * B.data[o] + 0.7152 * B.data[o + 1] + 0.0722 * B.data[o + 2];
    const d = Math.abs(la - lb); if (d > thr) n++; if (d > maxd) maxd = d; sum += d;
  }
  return { frac: n / total, maxDelta: +maxd.toFixed(2), meanDelta: +(sum / total).toFixed(4) };
}

const out = { consumption_base_frames: [], deck_scenes: [], motion: null };
console.log('=== SHIPPED-CONFIG before-vs-after (unperturbed `-base` frames, identical cameras) ===');
for (const f of fs.readdirSync(path.join(R, 'consumption-before', 'frames')).sort()) {
  if (!f.endsWith('-base.png')) continue;
  const b = path.join(R, 'consumption-after', 'frames', f);
  if (!fs.existsSync(b)) { console.log('MISSING in after arm:', f); continue; }
  const m = moved(path.join(R, 'consumption-before', 'frames', f), b);
  out.consumption_base_frames.push({ frame: f, ...m });
  console.log(`${f.padEnd(34)} moved ${(m.frac * 100).toFixed(3).padStart(7)}%  maxDelta ${String(m.maxDelta).padStart(7)}  meanDelta ${m.meanDelta}`);
}
console.log('\n=== DECK scenes, same setups both arms ===');
for (const f of fs.readdirSync(path.join(R, 'deck-before')).sort()) {
  const b = path.join(R, 'deck-after', f);
  if (!fs.existsSync(b)) continue;
  const m = moved(path.join(R, 'deck-before', f), b);
  out.deck_scenes.push({ scene: f, ...m });
  console.log(`${f.padEnd(46)} moved ${(m.frac * 100).toFixed(3).padStart(7)}%  maxDelta ${String(m.maxDelta).padStart(7)}  meanDelta ${m.meanDelta}`);
}
{
  const m = moved(path.join(R, 'motion-before', 'contact', 'walk.png'), path.join(R, 'motion-after', 'contact', 'walk.png'));
  out.motion = { sheet: 'walk.png (180-frame walk, every 6th)', ...m };
  console.log(`\n=== MOTION contact sheet ===\nwalk.png  moved ${(m.frac * 100).toFixed(3)}%  maxDelta ${m.maxDelta}  meanDelta ${m.meanDelta}`);
}
// The two pure-nature Deck scenes are the specificity control: the builder's own falsifiable
// prediction (README section 6) is that terrain and canopy "should not change at all".
const nature = out.deck_scenes.filter((d) => /deep-marshes/.test(d.scene));
console.log('\n=== the builder\'s own falsifiable prediction, checked ===');
for (const d of nature) console.log(`  ${d.scene}: ${(d.frac * 100).toFixed(3)}% — prediction was "no change"`);
fs.writeFileSync(path.join(path.dirname(new URL(import.meta.url).pathname), 'base-frame-ab.json'), JSON.stringify(out, null, 2));
console.log('\nwritten base-frame-ab.json');
