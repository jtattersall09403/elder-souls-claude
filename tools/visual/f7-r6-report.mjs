#!/usr/bin/env node
/**
 * f7-r6-report.mjs — one table over every round-6 run, so a critic reads one file.
 *
 * Every row carries the two admissible measures and the drift band of each, at a named threshold:
 *   presence_pct                    — share of the unchanged arm's visible water that survives
 *   shore_contrast_retained_pct     — share of the water's OWN near-shore/open-water contrast that
 *                                     survives, differenced against the water-hidden control
 * and, marked inadmissible, the width `ARBITRATION` S67 retired. The width is printed on purpose:
 * on this round's own arms it reads 32 px for the arm that makes the water look like mud and 1 px
 * for the arm that looks most like water, which is the retirement demonstrated on new data.
 *
 * `node tools/visual/f7-r6-report.mjs [--threshold 16] [--root <artifact dir>]`
 */
import fs from 'node:fs';
import path from 'node:path';

const REPO = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const args = {};
for (let i = 2; i < process.argv.length; i++) {
  if (!process.argv[i].startsWith('--')) continue;
  const k = process.argv[i].slice(2);
  args[k] = (process.argv[i + 1] && !process.argv[i + 1].startsWith('--')) ? process.argv[++i] : true;
}
const T = String(args.threshold || 16);
const ROOT = path.resolve(REPO, args.root || 'corpus/90-verdicts/wave1/artifacts/W1-F7-WATER-r6');
const OUT = args.out ? path.resolve(REPO, args.out) : null;

const out = { tool: 'tools/visual/f7-r6-report.mjs', threshold: Number(T), generated: new Date().toISOString(), runs: [] };
const lines = [];
for (const d of fs.readdirSync(ROOT).sort()) {
  const f = path.join(ROOT, d, 'sweep.json');
  if (!fs.existsSync(f)) continue;
  const j = JSON.parse(fs.readFileSync(f, 'utf8'));
  for (const [pose, p] of Object.entries(j.poses || {})) {
    const caps = p.baseline_captures || [];
    const bc = caps.map((c) => c.by_threshold?.[T]?.contrast?.span_water_minus_hidden).filter((v) => typeof v === 'number');
    if (!bc.length) continue;
    const bMean = bc.reduce((a, b) => a + b, 0) / bc.length;
    const bRange = Math.max(...bc) - Math.min(...bc);
    const drift = p.baseline_drift?.[T] || null;
    const row = {
      run: d, site: j.site, pose, commit: (j.commit || '').slice(0, 8),
      shader_gate_measured: j.head_expression_asserted?.shore_gate_line_in_source || null,
      shader_alpha_measured: j.head_expression_asserted?.alpha_line_in_source || null,
      baseline_captures: caps.length,
      baseline_water_contrast: +bMean.toFixed(3),
      DRIFT_contrast_retained_pp: +(100 * bRange / bMean).toFixed(2),
      DRIFT_presence_pp: drift?.presence_pct_if_scored_as_an_arm?.range ?? null,
      arms: {},
    };
    for (const [k, a] of Object.entries(p.arms || {})) {
      const b = a.by_threshold?.[T]; if (!b) continue;
      row.arms[k] = {
        presence_pct: b.presence_pct,
        shore_contrast_retained_pct: +(100 * b.contrast.span_water_minus_hidden / bMean).toFixed(2),
        m12_FresnelDelta: b.m12.FresnelDelta, m12_ShoreDelta: b.m12.ShoreDelta,
        m12_NormalEnergy: b.m12.NormalEnergy, m12_ReflCorr: b.m12.ReflCorr === null ? 'unmeasurable — S64 inapplicable' : b.m12.ReflCorr,
        width_px_RETIRED_S67: b.contrast.width_px_INADMISSIBLE_S67,
        VACUOUS: a.VACUOUS || null,
      };
      lines.push(`${d.padEnd(14)} ${pose.padEnd(10)} ${k.padEnd(14)} pres=${String(b.presence_pct).padStart(6)} retained=${String(row.arms[k].shore_contrast_retained_pct).padStart(7)}% ShoreDelta=${String(b.m12.ShoreDelta).padStart(8)} [retired width ${String(b.contrast.width_px_INADMISSIBLE_S67).padStart(3)}]`);
    }
    out.runs.push(row);
  }
}
console.error(`threshold ${T} — drift bands are per run, in the row above each block\n` + lines.join('\n'));
const text = JSON.stringify(out, null, 1);
if (OUT) { fs.mkdirSync(path.dirname(OUT), { recursive: true }); fs.writeFileSync(OUT, text); console.error(`\nwrote ${path.relative(REPO, OUT)}`); }
else console.log(text);
