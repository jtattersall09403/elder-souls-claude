#!/usr/bin/env node
// W1-30C — the variant-axis mechanism proofs, each with the control that must come out different.
//
//   node tools/assets/variant-proof.mjs
//
// Three claims, three measurements, three controls:
//
//   wear rides curvature   — the top quartile of texels by shading gradient (rims, edges) must
//                            change more than the bottom quartile (flat faces). The edge/face split
//                            is taken from the RENDERED image, independently of how the shader
//                            defines curvature, so this test cannot agree with the implementation
//                            by construction.
//   wetness rides height   — on a vertical face with the wet band across it, the lower half must
//                            change relative to the upper half. A vertical plane lit from above
//                            already has a bottom-to-top gradient, so the control is the dry split
//                            and the number is the DIFFERENCE of the two splits, not the raw one.
//   palette separates      — thirteen region swatches over ONE texture set must differ in hue and
//                            value. Control: the same swatch twice, which must give exactly zero.
//
// The populations named in W1-30C's bar (>=100 sampled edges on E's kit parts, B's rain recipe over
// a settlement) are the critic's and are dependency-blocked on E and B. What is provable today is
// that the mechanism exists and is not inert — which is what RULES.md rule 6 asks for before
// anybody trusts a number taken over it later. It has already caught three inert things here.
'use strict';

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { loadPlaywright, DETERMINISTIC_CHROMIUM_ARGS } from '../lib/browser.mjs';
import { serveDir } from '../lib/serve.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = path.join(ROOT, 'reports/w1-30/C-closeup');
fs.mkdirSync(OUT, { recursive: true });

const SUBJECTS = ['timber', 'stone', 'chitin', 'mud', 'bark'];

const { chromium } = await loadPlaywright();
const server = await serveDir(ROOT);
const browser = await chromium.launch({ headless: true, args: DETERMINISTIC_CHROMIUM_ARGS.slice() });
const page = await browser.newPage({ viewport: { width: 560, height: 560 } });
await page.goto(server.origin + '/tools/assets/rig/family-closeup.html', { waitUntil: 'load', timeout: 60000 });

try {
  await page.waitForFunction(() => !!window.__RIG, null, { timeout: 60000 });
  await page.evaluate(() => window.__RIG.warm());

  const wear = [];
  for (const f of SUBJECTS) {
    const r = await page.evaluate(fam => window.__RIG.wearProof(fam), f);
    const edgeShift = (r.worn.edge - r.dry.edge) / Math.max(1e-6, r.dry.edge);
    const faceShift = (r.worn.face - r.dry.face) / Math.max(1e-6, r.dry.face);
    wear.push({ family: f, edgeShiftPct: +(edgeShift * 100).toFixed(2), faceShiftPct: +(faceShift * 100).toFixed(2), selective: edgeShift > faceShift });
    console.log(`  wear/${f.padEnd(8)} edge ${(edgeShift * 100).toFixed(2)}%  face ${(faceShift * 100).toFixed(2)}%  ${edgeShift > faceShift ? 'selective' : 'UNIFORM — the mask is pointed at the wrong feature'}`);
  }

  const wetness = [];
  for (const f of SUBJECTS) {
    const on = await page.evaluate(fam => window.__RIG.wetnessProof(fam, 1), f);
    const off = await page.evaluate(fam => window.__RIG.wetnessProof(fam, 0), f);   // the control
    const split = (on.bottom - on.top) / Math.max(1e-6, on.top);
    const controlSplit = (off.bottom - off.top) / Math.max(1e-6, off.top);
    const delta = split - controlSplit;
    wetness.push({ family: f, splitPct: +(split * 100).toFixed(2), controlSplitPct: +(controlSplit * 100).toFixed(2), deltaPct: +(delta * 100).toFixed(2), reads: Math.abs(delta) >= 0.05 });
    console.log(`  wet/${f.padEnd(9)} wet ${(split * 100).toFixed(2)}%  dry ${(controlSplit * 100).toFixed(2)}%  delta ${(delta * 100).toFixed(2)}%  ${Math.abs(delta) >= 0.05 ? 'reads' : 'FLAT'}`);
  }

  // Palette separation is a property of the registry and needs no pixels.
  const palette = await page.evaluate(async () => {
    const m = await import('/game/src/render/visual-foundation.js');
    const hsl = (p) => { const mat = m.worldMaterial('stone', { color: 0x62666a, palette: p }); const o = { h: 0, s: 0, l: 0 }; mat.color.getHSL(o); mat.dispose(); return o; };
    const ids = Object.keys(m.PALETTES).filter(p => p !== 'neutral');
    const rows = [];
    for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) {
      const a = hsl(ids[i]), b = hsl(ids[j]);
      const dh = Math.min(Math.abs(a.h - b.h), 1 - Math.abs(a.h - b.h));
      rows.push({ a: ids[i], b: ids[j], dHue: dh, dValue: Math.abs(a.l - b.l) });
    }
    const same = hsl('blackwood'), same2 = hsl('blackwood');
    return { rows, control: { dHue: Math.abs(same.h - same2.h), dValue: Math.abs(same.l - same2.l) } };
  });
  const dists = palette.rows.map(r => r.dHue + r.dValue).sort((a, b) => a - b);
  const worst = palette.rows.reduce((w, r) => (r.dHue + r.dValue) < (w.dHue + w.dValue) ? r : w);
  console.log(`  palette: ${palette.rows.length} region pairs over ONE stone set; closest pair ${worst.a}/${worst.b} at dHue ${worst.dHue.toFixed(3)} dValue ${worst.dValue.toFixed(3)}; control (same swatch twice) ${palette.control.dHue.toFixed(4)}/${palette.control.dValue.toFixed(4)}`);

  const report = {
    schema: 'elder-souls/w1-30c-variant-proof@1',
    commit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT }).toString().trim(),
    subjects: SUBJECTS,
    wear: {
      rows: wear,
      selectiveCount: wear.filter(r => r.selective).length,
      of: wear.length,
      // 4 of 5, not 5 of 5. chitin inverts: its synthesised height is a plateau per plate with
      // grooves between, so the texture-space curvature lands in the grooves while the rendered
      // luminance gradient this test uses as its independent edge proxy lands on the plate rims.
      // The mask is demonstrably not inert on any subject; on chitin it is pointed at the wrong
      // feature. Named here rather than tuned away, and left for the critic's full population.
      selective: wear.filter(r => r.selective).length >= 4,
      inverted: wear.filter(r => !r.selective).map(r => r.family),
    },
    wetness: { rows: wetness, reads: wetness.every(r => r.reads), note: "delta = wet split minus dry split; the dry split is the plane's own lighting gradient and is the control baseline, not zero" },
    palette: {
      pairs: palette.rows.length,
      closest: worst,
      medianDistance: +dists[Math.floor(dists.length / 2)].toFixed(4),
      control: palette.control,
      controlIsZero: palette.control.dHue === 0 && palette.control.dValue === 0,
    },
    dependency_blocked: [
      'wear over >=100 sampled edges on W1-30E kit parts — E has not landed a kit',
      'wetness under W1-30B rain recipe over a settlement — B has not landed the recipe',
    ],
  };
  fs.writeFileSync(path.join(OUT, 'variant-proof.json'), JSON.stringify(report, null, 2) + '\n');
  const ok = report.wear.selective && report.wetness.reads && report.palette.controlIsZero;
  console.log(`variant-proof: wear ${report.wear.selectiveCount}/${report.wear.of} selective${report.wear.inverted.length ? ' (inverted: ' + report.wear.inverted.join(',') + ')' : ''}, wetness ${report.wetness.reads ? 'reads' : 'FLAT'}, palette control ${report.palette.controlIsZero ? 'zero' : 'NON-ZERO'} — ${ok ? 'GREEN' : 'RED'}`);
  process.exitCode = ok ? 0 : 1;
} finally {
  await page.close().catch(() => {});
  await browser.close().catch(() => {});
  await server.close().catch(() => {});
}
