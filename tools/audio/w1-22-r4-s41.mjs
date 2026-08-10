#!/usr/bin/env node
// W1-22 completion-builder capture preparation. This writes measurements and hashes, never audio.
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import { launchGame } from '../lib/browser.mjs';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..');
const OUT = join(ROOT, 'reports/w1-22-r4/builder-completion.json');
const regions = JSON.parse(readFileSync(join(ROOT, 'game/data/world/regions.json'))).regions;
const idir = join(ROOT, 'game/data/audio/ambience/interiors');
const counted = readdirSync(idir).filter(f => f.endsWith('.json'))
  .map(f => JSON.parse(readFileSync(join(idir, f)))).map(b => b.id).sort();
const hash = s => createHash('sha256').update(s).digest('hex');
const pcmHash = c => hash(Buffer.from(c.pcm16_interleaved_b64, 'base64'));
const pcmStats = c => {
  const b = Buffer.from(c.pcm16_interleaved_b64, 'base64'); let peak = 0, sum = 0;
  for (let i = 0; i < b.length; i += 2) { const v = b.readInt16LE(i) / 32768; peak = Math.max(peak, Math.abs(v)); sum += v * v; }
  return { peak: +peak.toFixed(6), rms_dbfs: +(20 * Math.log10(Math.sqrt(sum / (b.length / 2)) || 1e-12)).toFixed(3) };
};
const bedsDigest = () => {
  const dir = join(ROOT, 'game/data/audio/ambience'); const h = createHash('sha256');
  const names = [];
  const walk = d => readdirSync(d, { withFileTypes: true }).sort((a,b) => a.name.localeCompare(b.name)).forEach(e => {
    const p = join(d, e.name); if (e.isDirectory()) walk(p); else if (e.name.endsWith('.json')) names.push(p);
  }); walk(dir); names.forEach(p => h.update(p.slice(dir.length + 1)).update(readFileSync(p)));
  return { sha256: h.digest('hex'), files: names.length };
};

const report = {
  task: 'W1-22', method: 'S41 completion-builder capture preparation', taken_at: new Date().toISOString(),
  git: { commit: execSync('git rev-parse HEAD', { cwd: ROOT, encoding: 'utf8' }).trim(), dirty: true },
  generation_command: 'node tools/audio/w1-22-r4-s41.mjs',
  binary_policy: 'PCM was generated transiently in Chromium and discarded; no WAV or capture binary is committed.',
  canonical: { seed: 1337, weather: 'clear', time: '13:00', settle: '240 frames at 60 Hz', capture_frames: [240, 1440], seconds: 20, sample_rate_hz: 16000,
    graph: 'pre-normalisation live ambience graph: L1-L4 plus every R7 emitter audible at the authoritative centroid',
    b1_b2_derivative: '-23 LUFS-I; prepare independently from these canonical recordings', alternate_arms: 'diagnostic only' },
  beds_digest: bedsDigest(), centroids: Object.fromEntries(regions.map(r => [r.id, r.centroid_m])),
  canonical_captures: {}, counted_bed_determinism: {}, consumer: {}, independent: { B1: 'NOT_RUN', B2: 'NOT_RUN', B3: 'NOT_RUN', R6: 'NOT_RUN', M20: 'NOT_RUN' },
};

let handle; let failed = false;
try {
  handle = await launchGame({ width: 320, height: 240 }); const page = handle.page;
  await page.waitForFunction(() => !!window.__HARNESS, null, { timeout: 60000 });
  await page.evaluate(() => window.__HARNESS.setRenderRate(0));
  for (const r of regions) {
    await page.evaluate(({x,z}) => { const H=window.__HARNESS; H.setTimeOfDay(13); H.teleport(x,z,{}); H.stepFrames(240); }, {x:r.centroid_m[0],z:r.centroid_m[1]});
    const opts = { region:r.id, seconds:20, sampleRate:16000, tod:'day', weather:'clear', seed:1337, listener:[r.centroid_m[0],r.centroid_m[1],0] };
    const [a,b,different] = await page.evaluate(async o => { const H=window.__HARNESS; return Promise.all([H.ambienceCapture(o),H.ambienceCapture(o),H.ambienceCapture({...o,seed:1338})]); }, opts);
    const ha=pcmHash(a), hb=pcmHash(b), hd=pcmHash(different);
    report.canonical_captures[r.id] = { listener:opts.listener, graph_events:a.fired, sha256:ha, repeat_sha256:hb, seed_1338_sha256:hd, fixed_seed_identical:ha===hb, changed_seed_changes_pcm:ha!==hd, ...pcmStats(a) };
    if (ha !== hb || ha === hd) failed = true;
  }
  // Every bed counted toward the settlement/interior mass is rendered twice: exhaustive, not sampled.
  for (const id of counted) {
    const o={region:id,seconds:2,sampleRate:8000,tod:'day',weather:'clear',seed:1337,listener:null};
    const [a,b]=await page.evaluate(async x=>Promise.all([window.__HARNESS.ambienceCapture(x),window.__HARNESS.ambienceCapture(x)]),o);
    const ha=pcmHash(a), hb=pcmHash(b); report.counted_bed_determinism[id]={sha256:ha,repeat_sha256:hb,identical:ha===hb,...pcmStats(a)}; if(ha!==hb) failed=true;
  }
  // Shipping consumer: cross into a real settlement so W1-04 derives env.settlement, then leave.
  report.consumer = await page.evaluate(() => {
    const H=window.__HARNESS;
    H.teleport(3785,3823.5,{}); H.stepFrames(2); const settlement=H.getAmbienceState();
    H.teleport(1118,3487.5,{}); H.stepFrames(2); const fallback=H.getAmbienceState();
    return { perturbation:'world-derived settlement crossing: Archon centre -> Blackwood centroid', settlement_bed:settlement.region, fallback_bed:fallback.region, changed:settlement.region!==fallback.region };
  });
  if (report.consumer.settlement_bed !== 'settlement-archon' || !report.consumer.changed) failed=true;
} finally { if (handle) await handle.close(); }
report.result = failed ? 'FAIL' : 'PASS';
mkdirSync(dirname(OUT), {recursive:true}); writeFileSync(OUT, JSON.stringify(report,null,2)+'\n');
console.log(`${report.result} ${OUT.slice(ROOT.length+1)} — 13 canonical and ${counted.length} counted-bed determinism rows; independent judgement NOT_RUN`);
process.exitCode = failed ? 1 : 0;
