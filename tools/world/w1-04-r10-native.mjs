#!/usr/bin/env node
/** Exact S42 browser populations for RI-WLD13 M73, M75 and M76. Binary frames are transient. */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { launchGame } from '../lib/browser.mjs';

const ROOT = path.resolve(import.meta.dirname, '../..');
const OUT = path.join(ROOT, 'reports/w1-04-r10');
fs.mkdirSync(OUT, { recursive: true });
const commit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim();
const report = { tool: 'tools/world/w1-04-r10-native.mjs', commit, when: new Date().toISOString(), populations: {}, failures: [], page_errors: [] };
const save = () => fs.writeFileSync(path.join(OUT, 'native-populations.json'), JSON.stringify(report, null, 2) + '\n');
save();

const B = await launchGame({ width: 256, height: 160, timeout: 120000 });
B.page.on('pageerror', e => report.page_errors.push(String(e)));
await B.page.evaluate(() => window.__HARNESS.setRenderRate(0));
try {
  const manifest = await B.page.evaluate(() => window.__HARNESS.listInteriors().map(x => x.id).sort());
  if (manifest.length !== 115) report.failures.push(`manifest ${manifest.length}, required 115`);
  const eligible = await B.page.evaluate(ids => ids.filter(id => {
    const r = window.__ENGINE.data.interiors[id];
    return r && !['prison', 'hold'].includes(r.interior_kind);
  }), manifest);
  // Stable, population-wide stride rather than a convenient prefix.
  const sample = Array.from({ length: 24 }, (_, i) => eligible[Math.floor(i * eligible.length / 24)]);
  if (new Set(sample).size !== 24) report.failures.push('M73 sample is not 24 unique interiors');
  const m73 = [];
  for (const id of sample) {
    for (const weather of ['clear', 'storm']) for (const hour of [6, 12, 18, 1]) {
      const obs = await B.page.evaluate(({ id, weather, hour }) => {
        const H = window.__HARNESS;
        if (H.whereAmI().interior) H.exitInterior();
        H.setTimeOfDay(14); H.setWeather('clear'); H.stepFrames(2);
        const entered = H.enterInterior(id); H.stepFrames(2);
        H.setTimeOfDay(hour); H.setWeather(weather);
        window.__ENGINE.sim.env.weatherLight = weather === 'storm' ? 'dark' : 'clear';
        window.__ENGINE.renderer.sky.apply(hour, weather, window.__ENGINE.renderer._focus, null, window.__ENGINE.sim.env);
        const interior = H.getInteriorContinuity();
        H.exitInterior(); H.stepFrames(1);
        const exterior = H.getInteriorContinuity();
        return { entered: !!entered.entered, exterior, interior };
      }, { id, weather, hour });
      const frame = JSON.stringify(obs);
      m73.push({ id, weather, hour, ...obs, frame_probe_sha256: crypto.createHash('sha256').update(frame).digest('hex'), frame_probe_bytes: frame.length });
      report.populations.M73 = { required: 24 * 4 * 2, completed: m73.length, sample, partial: true, rows: m73 }; save();
    }
  }
  const byId = {}; for (const r of m73) (byId[r.id] ||= []).push(r);
  for (const [id, rows] of Object.entries(byId)) {
    if (rows.some(r => !r.entered)) report.failures.push(`M73 ${id}: entry refused`);
    const lum = new Set(rows.map(r => Number(r.interior.aperture_luminance).toFixed(5)));
    if (lum.size < 2) report.failures.push(`M73 ${id}: aperture luminance invariant`);
    for (const hour of [6, 12, 18, 1]) {
      const a = rows.find(r => r.hour === hour && r.weather === 'clear');
      const b = rows.find(r => r.hour === hour && r.weather === 'storm');
      if (a && b && a.interior.aperture_luminance === b.interior.aperture_luminance) report.failures.push(`M73 ${id}@${hour}: storm no change`);
    }
    if (rows.some(r => r.interior.sun_bearing_deg == null)) report.failures.push(`M73 ${id}: sun bearing absent`);
  }
  report.populations.M73.partial = false;

  const m75 = [];
  for (const id of manifest) {
    const row = await B.page.evaluate(id => {
      const H = window.__HARNESS;
      if (H.whereAmI().interior) { H.exitInterior(); H.stepFrames(1); }
      H.setTimeOfDay(14); H.setWeather('clear'); H.stepFrames(2);
      const before = H.getDrawnSignature().hash;
      const entered = H.enterInterior(id); H.stepFrames(1);
      const c = H.getInteriorContinuity();
      const inside = H.getDrawnSignature().hash;
      return { id, entered: !!entered.entered, ...c, scene_changed: before !== inside };
    }, id);
    m75.push(row);
  }
  const seamless = m75.filter(r => r.seamless);
  if (m75.length !== 115 || m75.some(r => !r.entered || !r.scene_changed)) report.failures.push('M75: not every 115 traversal entered and changed the scene');
  if (seamless.length < Math.ceil(115 * .20)) report.failures.push(`M75: ${seamless.length}/115 seamless, require 23`);
  if (seamless.some(r => r.transition_frames !== 0 || !r.exterior_visible_from_doorway)) report.failures.push('M75: seamless transition/doorway visibility breach');
  if (m75.some(r => r.transition_frames > 30 || r.fade_frames > 12)) report.failures.push('M75: transition or fade budget breach');
  report.populations.M75 = { required: 115, completed: m75.length, seamless: seamless.length, threshold: 23, rows: m75 };

  const m76 = m75.map(r => ({ id: r.id, see_into: r.see_into, impostor: r.impostor }));
  const visible = m76.filter(r => r.see_into);
  if (visible.length < Math.ceil(115 * .50)) report.failures.push(`M76: ${visible.length}/115 see-into, require 58`);
  if (visible.some(r => !r.impostor || r.impostor.palette_distance > .20)) report.failures.push('M76: unmatched impostor palette');
  report.populations.M76 = { required: 115, completed: m76.length, see_into: visible.length, threshold: 58, rows: m76 };

  report.controls = await B.page.evaluate(id => {
    const H = window.__HARNESS, r = window.__ENGINE.data.interiors[id];
    const old = [r.seamless, r.see_into];
    r.seamless = false; r.see_into = false; H.exitInterior(); H.stepFrames(1); H.enterInterior(id); H.stepFrames(1);
    const cut = H.getInteriorContinuity();
    [r.seamless, r.see_into] = old; H.exitInterior(); H.stepFrames(1); H.enterInterior(id); H.stepFrames(1);
    const restored = H.getInteriorContinuity();
    return { id, cut, restored, red: !cut.seamless && !cut.see_into && restored.seamless && restored.see_into };
  }, m75.find(r => r.seamless && r.see_into)?.id);
  if (!report.controls.red) report.failures.push('M75/M76 control did not turn red and restore');
} finally {
  report.pass = report.failures.length === 0 && report.page_errors.length === 0;
  save(); await B.close();
}
console.log(JSON.stringify({ commit, pass: report.pass, failures: report.failures, populations: Object.fromEntries(Object.entries(report.populations).map(([k,v]) => [k, { required:v.required, completed:v.completed, seamless:v.seamless, see_into:v.see_into }])) }, null, 2));
process.exit(report.pass ? 0 : 1);
