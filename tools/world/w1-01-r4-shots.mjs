// Round-4 eye-height comparison shots: one frame per region at a fixed, seeded ground point, so
// the ground skin and the near-field prop disc can be looked at rather than argued about.
import { launchGame } from '../lib/browser.mjs';
import fs from 'node:fs';
const OUT = process.argv.includes('--out') ? process.argv[process.argv.indexOf('--out') + 1] : 'reports/r4-shots/';
const ONLY = process.argv.includes('--only') ? process.argv[process.argv.indexOf('--only') + 1].split(',') : null;
fs.mkdirSync(OUT, { recursive: true });
const regions = JSON.parse(fs.readFileSync('game/data/world/regions.json', 'utf8')).regions;
const h = await launchGame({ width: 1280, height: 720 });
const rec = [];
try {
  await h.h('setSeed', 1337); await h.h('loadState', 'default');
  if (await h.page.evaluate(() => typeof window.__HARNESS.setUIVisible === 'function')) await h.h('setUIVisible', false);
  let st = 20260807;
  const rnd = () => { st ^= st << 13; st >>>= 0; st ^= st >> 17; st ^= st << 5; st >>>= 0; return st / 4294967296; };
  for (const r of regions) {
    if (ONLY && !ONLY.includes(r.id)) continue;
    const bb = r.bounds_m;
    let p = null;
    for (let t = 0; t < 4000 && !p; t++) {
      const x = bb.x[0] + rnd() * (bb.x[1] - bb.x[0]), z = bb.z[0] + rnd() * (bb.z[1] - bb.z[0]);
      const g = await h.h('getTerrainAt', x, z);
      if (g.region !== r.id || !g.land || g.slope_deg > 30) continue;
      const w = await h.h('getWaterAt', x, z);
      if (w.depth_m > 0.3) continue;
      p = { x, z, y: g.y };
    }
    if (!p) { console.log('no point in', r.id); continue; }
    await h.h('teleport', p.x, p.z);
    await h.h('streamAround', p.x, p.z);
    await h.h('setTimeOfDay', 11.0);
    await h.h('setWeather', 'clear');
    const yaw = rnd() * Math.PI * 2;
    await h.h('camera', { pos: [p.x, p.y + 1.7, p.z], look: [p.x + Math.sin(yaw) * 40, p.y + 1.7 - 3.0, p.z + Math.cos(yaw) * 40], fov: 70 });
    await h.h('stepFrames', 24);
    await h.h('renderFrame');
    await h.page.screenshot({ path: `${OUT}/${r.id}.png`, type: 'png', animations: 'disabled', timeout: 180000 });
    const st2 = await h.page.evaluate(() => window.__HARNESS.getWorldStats && window.__HARNESS.getWorldStats());
    rec.push({ region: r.id, x: +p.x.toFixed(1), z: +p.z.toFixed(1), stats: st2 && st2.province });
    console.log(r.id, JSON.stringify(rec[rec.length - 1].stats || {}));
  }
} finally { await h.close(); }
fs.writeFileSync(`${OUT}/index.json`, JSON.stringify(rec, null, 2));
