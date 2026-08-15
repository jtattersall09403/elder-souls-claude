#!/usr/bin/env node
// critic-t4-palette.mjs — RI-UIX06 A4/AD4, run by hand because the item's named invocation
// (`palette-conformance.mjs --in <dir> --palette regions.json`) is not the CLI that tool has:
// it takes one graded world PNG and a --region, and has no UI mode. METHOD DEVIATION, recorded.
//
// What it does instead: over the UI panel area of each captured screen (the largest rectangle
// the panel occupies, passed in), quantise to the 24 most frequent colours by population, and
// for each compute the minimum CIEDE2000 distance to the union of every `palette_hex` in
// game/data/world/regions.json. A4 wants every UI hue within dE <= 10 of a world colour.
import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';
import { REPO_ROOT, parseArgs } from '../lib/cli.mjs';

const args = parseArgs();
const regions = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'game/data/world/regions.json'), 'utf8'));
const list = regions.regions || regions;
const PAL = [];
for (const r of list) for (const hx of (r.palette_hex || [])) PAL.push({ region: r.id, hex: hx });

const hex2rgb = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
function rgb2lab([r, g, b]) {
  const f = (v) => { v /= 255; return v > 0.04045 ? ((v + 0.055) / 1.055) ** 2.4 : v / 12.92; };
  const [R, G, B] = [f(r), f(g), f(b)];
  let X = (R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047;
  let Y = (R * 0.2126 + G * 0.7152 + B * 0.0722) / 1.0;
  let Z = (R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883;
  const g2 = (t) => t > 0.008856 ? Math.cbrt(t) : (7.787 * t + 16 / 116);
  [X, Y, Z] = [g2(X), g2(Y), g2(Z)];
  return [116 * Y - 16, 500 * (X - Y), 200 * (Y - Z)];
}
// CIEDE2000
function dE00(l1, l2) {
  const [L1, a1, b1] = l1, [L2, a2, b2] = l2;
  const C1 = Math.hypot(a1, b1), C2 = Math.hypot(a2, b2), Cb = (C1 + C2) / 2;
  const G = 0.5 * (1 - Math.sqrt(Cb ** 7 / (Cb ** 7 + 25 ** 7)));
  const ap1 = (1 + G) * a1, ap2 = (1 + G) * a2;
  const Cp1 = Math.hypot(ap1, b1), Cp2 = Math.hypot(ap2, b2);
  const hp = (b, a) => { if (b === 0 && a === 0) return 0; const d = Math.atan2(b, a) * 180 / Math.PI; return d < 0 ? d + 360 : d; };
  const hp1 = hp(b1, ap1), hp2 = hp(b2, ap2);
  const dLp = L2 - L1, dCp = Cp2 - Cp1;
  let dhp = 0;
  if (Cp1 * Cp2 !== 0) { dhp = hp2 - hp1; if (dhp > 180) dhp -= 360; else if (dhp < -180) dhp += 360; }
  const dHp = 2 * Math.sqrt(Cp1 * Cp2) * Math.sin(dhp * Math.PI / 360);
  const Lbp = (L1 + L2) / 2, Cbp = (Cp1 + Cp2) / 2;
  let hbp = hp1 + hp2;
  if (Cp1 * Cp2 !== 0) { if (Math.abs(hp1 - hp2) > 180) hbp += (hbp < 360 ? 360 : -360); hbp /= 2; } else hbp = hp1 + hp2;
  const T = 1 - 0.17 * Math.cos((hbp - 30) * Math.PI / 180) + 0.24 * Math.cos(2 * hbp * Math.PI / 180)
    + 0.32 * Math.cos((3 * hbp + 6) * Math.PI / 180) - 0.20 * Math.cos((4 * hbp - 63) * Math.PI / 180);
  const dTh = 30 * Math.exp(-(((hbp - 275) / 25) ** 2));
  const Rc = 2 * Math.sqrt(Cbp ** 7 / (Cbp ** 7 + 25 ** 7));
  const Sl = 1 + (0.015 * (Lbp - 50) ** 2) / Math.sqrt(20 + (Lbp - 50) ** 2);
  const Sc = 1 + 0.045 * Cbp, Sh = 1 + 0.015 * Cbp * T;
  const Rt = -Math.sin(2 * dTh * Math.PI / 180) * Rc;
  return Math.sqrt((dLp / Sl) ** 2 + (dCp / Sc) ** 2 + (dHp / Sh) ** 2 + Rt * (dCp / Sc) * (dHp / Sh));
}
const PALLAB = PAL.map((p) => ({ ...p, lab: rgb2lab(hex2rgb(p.hex)) }));

const files = (args._ || []).length ? args._ : fs.readdirSync(path.join(REPO_ROOT, 'corpus/90-verdicts/wave1/artifacts/T4-r1/screens'))
  .filter((f) => f.endsWith('.png')).map((f) => path.join(REPO_ROOT, 'corpus/90-verdicts/wave1/artifacts/T4-r1/screens', f));

const report = {};
for (const f of files) {
  const png = PNG.sync.read(fs.readFileSync(f));
  // sample the panel band: the middle 60% of the frame, which is where every menu panel sits
  const x0 = Math.round(png.width * 0.16), x1 = Math.round(png.width * 0.84);
  const y0 = Math.round(png.height * 0.18), y1 = Math.round(png.height * 0.85);
  const hist = new Map();
  for (let y = y0; y < y1; y += 3) for (let x = x0; x < x1; x += 3) {
    const i = (png.width * y + x) << 2;
    // quantise to 5 bits/channel so near-identical AA pixels collapse
    const k = ((png.data[i] >> 3) << 10) | ((png.data[i + 1] >> 3) << 5) | (png.data[i + 2] >> 3);
    hist.set(k, (hist.get(k) || 0) + 1);
  }
  const total = [...hist.values()].reduce((a, b) => a + b, 0);
  const top = [...hist.entries()].sort((a, b) => b[1] - a[1]).slice(0, 24).map(([k, n]) => {
    const rgb = [((k >> 10) & 31) << 3, ((k >> 5) & 31) << 3, (k & 31) << 3];
    const lab = rgb2lab(rgb);
    let best = { dE: Infinity };
    for (const p of PALLAB) { const d = dE00(lab, p.lab); if (d < best.dE) best = { dE: +d.toFixed(2), region: p.region, hex: p.hex }; }
    return { rgb, share: +(n / total * 100).toFixed(2), nearest: best };
  });
  const off = top.filter((t) => t.nearest.dE > 10);
  report[path.basename(f)] = { top, n_off_palette: off.length,
    off_palette_share_pct: +off.reduce((a, b) => a + b.share, 0).toFixed(2),
    worst: top.reduce((a, b) => (b.nearest.dE > a.nearest.dE ? b : a), top[0]) };
  console.log(`${path.basename(f).padEnd(44)} off-palette hues ${String(off.length).padStart(2)}/24  share ${report[path.basename(f)].off_palette_share_pct}%  worst dE ${report[path.basename(f)].worst.nearest.dE}`);
}
const outp = path.join(REPO_ROOT, 'corpus/90-verdicts/wave1/artifacts/T4-r1/reports/palette-conformance.json');
fs.writeFileSync(outp, JSON.stringify({ palette_entries: PAL.length, threshold_dE: 10, report }, null, 2));
console.log('wrote', outp);
