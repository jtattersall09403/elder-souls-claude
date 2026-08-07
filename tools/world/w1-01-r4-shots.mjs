// Round-4 eye-height comparison shots: one frame per region at a fixed, seeded ground point, so
// the ground skin and the near-field prop disc can be looked at rather than argued about.
//
// Routed through the shared capture daemon (ARBITRATION.md S34): these are PLACED captures of
// APPEARANCE — what the ground and the near-field props look like — which is exactly what S34(a)
// permits to be teleported to, posed and cached. Every frame carries a settle proof and
// `arrival: "placed"` in index.json. `--direct` restores the original private-browser path.
import { launchGame } from '../lib/browser.mjs';
import { CaptureSession, CaptureError } from '../capture/client.mjs';
import fs from 'node:fs';
const OUT = process.argv.includes('--out') ? process.argv[process.argv.indexOf('--out') + 1] : 'reports/r4-shots/';
const ONLY = process.argv.includes('--only') ? process.argv[process.argv.indexOf('--only') + 1].split(',') : null;
const DIRECT = process.argv.includes('--direct');
fs.mkdirSync(OUT, { recursive: true });
const regions = JSON.parse(fs.readFileSync('game/data/world/regions.json', 'utf8')).regions;

let st = 20260807;
const rnd = () => { st ^= st << 13; st >>>= 0; st ^= st >> 17; st ^= st << 5; st >>>= 0; return st / 4294967296; };
const rec = [];
let unsettled = 0;

// Both backends answer the same two questions: where is the ground, and take this picture.
let h = null, session = null;
const BACKEND = DIRECT ? await (async () => {
  h = await launchGame({ width: 1280, height: 720 });
  await h.h('setSeed', 1337); await h.h('loadState', 'default');
  if (await h.page.evaluate(() => typeof window.__HARNESS.setUIVisible === 'function')) await h.h('setUIVisible', false);
  return {
    kind: 'direct',
    terrain: (x, z) => h.h('getTerrainAt', x, z),
    water: (x, z) => h.h('getWaterAt', x, z),
    async shoot(p, yaw, file) {
      await h.h('teleport', p.x, p.z);
      await h.h('streamAround', p.x, p.z);
      await h.h('setTimeOfDay', 11.0);
      await h.h('setWeather', 'clear');
      await h.h('camera', { pos: [p.x, p.y + 1.7, p.z], look: [p.x + Math.sin(yaw) * 40, p.y + 1.7 - 3.0, p.z + Math.cos(yaw) * 40], fov: 70 });
      await h.h('stepFrames', 24);
      await h.h('renderFrame');
      await h.page.screenshot({ path: file, type: 'png', animations: 'disabled', timeout: 180000 });
      const s2 = await h.page.evaluate(() => window.__HARNESS.getWorldStats && window.__HARNESS.getWorldStats());
      return { stats: s2 && s2.province, settle: null, cached: false, arrival: 'placed' };
    },
    close: () => h.close(),
  };
})() : await (async () => {
  session = new CaptureSession();
  await session.connect();
  const one = async (m, ...a) => (await session.query([[m, ...a]])).results[0].value;
  return {
    kind: 'service',
    terrain: (x, z) => one('getTerrainAt', x, z),
    water: (x, z) => one('getWaterAt', x, z),
    async shoot(p, yaw, file) {
      const res = await session.capture({
        evidence_of: 'appearance',
        claim: 'W1-01 round 4 — ground skin and near-field prop disc at eye height',
        place: { x: p.x, z: p.z },
        camera: { pos: [p.x, p.y + 1.7, p.z], look: [p.x + Math.sin(yaw) * 40, p.y + 1.7 - 3.0, p.z + Math.cos(yaw) * 40], fov: 70 },
        time: 11.0, weather: 'clear', width: 1280, height: 720, settle_frames: 24,
      });
      fs.copyFileSync(res.path, file);
      const s2 = await one('getWorldStats');
      return { stats: s2 && s2.province, settle: res.settle, cached: res.cached, arrival: res.provenance.arrival, build_key: res.provenance.build_key };
    },
    close: () => session.close(),
  };
})();
console.log('capture backend:', BACKEND.kind);

try {
  for (const r of regions) {
    if (ONLY && !ONLY.includes(r.id)) continue;
    const bb = r.bounds_m;
    let p = null;
    for (let t = 0; t < 4000 && !p; t++) {
      const x = bb.x[0] + rnd() * (bb.x[1] - bb.x[0]), z = bb.z[0] + rnd() * (bb.z[1] - bb.z[0]);
      const g = await BACKEND.terrain(x, z);
      if (g.region !== r.id || !g.land || g.slope_deg > 30) continue;
      const w = await BACKEND.water(x, z);
      if (w.depth_m > 0.3) continue;
      p = { x, z, y: g.y };
    }
    if (!p) { console.log('no point in', r.id); continue; }
    const yaw = rnd() * Math.PI * 2;
    try {
      const out = await BACKEND.shoot(p, yaw, `${OUT}/${r.id}.png`);
      rec.push({
        region: r.id, x: +p.x.toFixed(1), z: +p.z.toFixed(1), stats: out.stats,
        arrival: out.arrival, served_from_cache: out.cached,
        settled: out.settle ? out.settle.settled : null,
        settle_excess: out.settle ? out.settle.gates.G3_stability.excess : null,
        build_key: out.build_key || null,
      });
      console.log(r.id, JSON.stringify(rec[rec.length - 1].stats || {}), out.cached ? '(cache)' : '');
    } catch (e) {
      // S34: an unsettled frame is an error, never a quiet pass.
      if (e instanceof CaptureError) { unsettled++; console.log(r.id, 'REFUSED', e.code, e.message.split('\n')[0]); rec.push({ region: r.id, error: e.code, error_detail: e.message }); continue; }
      throw e;
    }
  }
} finally { await BACKEND.close(); }
fs.writeFileSync(`${OUT}/index.json`, JSON.stringify({
  capture_backend: BACKEND.kind,
  s34: { arrival: 'placed', unsettled_frames: unsettled,
    ruling: 'ARBITRATION.md S34(a) — PLACED captures of APPEARANCE. Citing one for an ARRIVAL claim voids the verdict.' },
  shots: rec,
}, null, 2));
process.exit(unsettled ? 20 : 0);
