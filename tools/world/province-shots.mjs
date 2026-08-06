#!/usr/bin/env node
/**
 * province-shots.mjs — RI-WLD04 M17's capture step.
 *
 * "For each of the 13 regions, sample 3 random walkable points >= 120 m from any settlement. At
 * each point render a 1280 x 720 screenshot, eye height 1.7 m, FOV 70, random yaw, weather sampled
 * from that region's profile, daytime. Strip HUD, labels, compass, region name — everything."
 *
 * Sampling is seeded (`--seed`), so the same 39 frames come back on a re-run and a critic can
 * reproduce the exact set a verdict cites. `--night` and `--worst` capture the two other passes
 * M17 requires. The images carry no region name and the index is written to a SEPARATE file so a
 * blind judge can be handed the directory without the answers.
 *
 * Usage:
 *   node tools/world/province-shots.mjs --out reports/region-shots [--seed 1337] [--per 3]
 *   node tools/world/province-shots.mjs --out reports/region-shots-night --night
 */
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs, wantsHelp, usage, log, EXIT, REPO_ROOT as ROOT, ensureDir, sha256, readJson } from '../lib/cli.mjs';
import { launchGame } from '../lib/browser.mjs';
import { PNG } from '../node_modules/pngjs/lib/png.js';

function meanLuma(file) {
  const p = PNG.sync.read(fs.readFileSync(file));
  let L = 0;
  for (let i = 0; i < p.data.length; i += 4) L += 0.299 * p.data[i] + 0.587 * p.data[i + 1] + 0.114 * p.data[i + 2];
  return L / (p.data.length / 4);
}

const USAGE = `province-shots.mjs — RI-WLD04 M17 unlabelled region frames.
  --out <dir>   output directory (required)
  --seed <n>    sampling seed (default 1337)
  --per <n>     frames per region (default 3)
  --night       capture at 01:00 instead of daytime
  --worst       capture in each region's worst declared weather
  --width/--height  default 1280 x 720`;

const args = parseArgs();
if (wantsHelp(args) || !args.out) usage(USAGE);
const outDir = path.resolve(String(args.out));
ensureDir(outDir);
const W = Number(args.width || 1280), H = Number(args.height || 720);
const PER = Number(args.per || 3);
const SEED = Number(args.seed || 1337);
const NIGHT = !!args.night;
const WORST = !!args.worst;

// A tiny deterministic PRNG for the SAMPLING (not the game): the game's own seed is set below.
let st = SEED >>> 0;
const rnd = () => { st ^= st << 13; st >>>= 0; st ^= st >> 17; st ^= st << 5; st >>>= 0; return st / 4294967296; };

const regions = readJson(path.join(ROOT, 'game/data/world/regions.json')).regions;
const scale = readJson(path.join(ROOT, 'corpus/50-world/world-scale.json'));
const settlements = Object.values(scale.settlements).map((s) => [s.x, s.z]);

const handle = await launchGame({ ...args, width: W, height: H });
const shots = [];
try {
  await handle.h('setSeed', 1337);
  await handle.h('loadState', 'default');
  if (await handle.page.evaluate(() => typeof window.__HARNESS.setUIVisible === 'function')) await handle.h('setUIVisible', false);

  for (const r of regions) {
    const bb = r.bounds_m;
    const picked = [];
    let tries = 0;
    while (picked.length < PER && tries < 20000) {
      tries++;
      const x = bb.x[0] + rnd() * (bb.x[1] - bb.x[0]);
      const z = bb.z[0] + rnd() * (bb.z[1] - bb.z[0]);
      if (settlements.some(([sx, sz]) => Math.hypot(x - sx, z - sz) < 120)) continue;
      const t = await handle.h('getTerrainAt', x, z);
      if (t.region !== r.id || !t.land || t.slope_deg > 34) continue;
      const w = await handle.h('getWaterAt', x, z);
      if (w.depth_m > 0.5) continue;                     // stand on ground, not in the channel
      if (picked.some((p) => Math.hypot(p.x - x, p.z - z) < 180)) continue;
      picked.push({ x, z, y: t.y, tier: t.danger_tier });
    }
    for (let i = 0; i < picked.length; i++) {
      const p = picked[i];
      const yaw = rnd() * Math.PI * 2;
      const weather = WORST ? worstOf(r) : r.weather[Math.floor(rnd() * r.weather.length)];
      const hours = NIGHT ? 1.0 : 9.5 + rnd() * 6.0;
      await handle.h('teleport', p.x, p.z);
      await handle.h('streamAround', p.x, p.z);
      await handle.h('setTimeOfDay', hours);
      await handle.h('setWeather', weather);
      const eye = [p.x, p.y + 1.7, p.z];
      const look = [p.x + Math.sin(yaw) * 40, p.y + 1.7 - 3.0, p.z + Math.cos(yaw) * 40];
      await handle.h('camera', { pos: eye, look, fov: 70 });
      await handle.h('stepFrames', 24);
      await handle.h('renderFrame');
      const id = `${String(shots.length + 1).padStart(2, '0')}`;
      const file = path.join(outDir, `frame-${id}.png`);
      await handle.page.screenshot({ path: file, type: 'png', animations: 'disabled', caret: 'hide' });
      // A frame whose eye landed inside a trunk is not a sample of the region, it is a sample of
      // one tree. Re-yaw and re-shoot rather than ship a black rectangle a judge cannot classify.
      let lum = meanLuma(file), spins = 0;
      let ex = p.x, ez = p.z, ey = p.y;
      while (lum < 18 && spins++ < 8) {
        // First re-yaw; if the eye is genuinely inside a trunk, step a few metres and try again.
        const y2 = rnd() * Math.PI * 2;
        if (spins > 2) {
          const th = rnd() * Math.PI * 2, rr = 6 + rnd() * 14;
          ex = p.x + Math.cos(th) * rr; ez = p.z + Math.sin(th) * rr;
          const t2 = await handle.h('getTerrainAt', ex, ez);
          ey = t2.y;
          await handle.h('teleport', ex, ez);
        }
        await handle.h('camera', { pos: [ex, ey + 1.7, ez], look: [ex + Math.sin(y2) * 40, ey + 1.7 - 3.0, ez + Math.cos(y2) * 40], fov: 70 });
        await handle.h('renderFrame');
        await handle.page.screenshot({ path: file, type: 'png', animations: 'disabled', caret: 'hide' });
        lum = meanLuma(file);
      }
      shots.push({
        frame: `frame-${id}.png`, region: r.id, region_name: r.name,
        x: +p.x.toFixed(1), z: +p.z.toFixed(1), y: +p.y.toFixed(2),
        yaw_deg: +(yaw * 180 / Math.PI).toFixed(1), weather, hours: +hours.toFixed(2),
        mean_luma: +lum.toFixed(1), reshot: spins,
        sha256: sha256(fs.readFileSync(file)),
      });
      log(`  ${r.id} ${shots.length}/${regions.length * PER}`);
    }
    if (picked.length < PER) log(`  WARNING: only ${picked.length}/${PER} points found in ${r.id}`);
  }
} finally { await handle.close(); }

function worstOf(r) {
  const rank = { salt_storm: 9, fever_fog: 9, sea_squall: 8, storm: 8, heavy_rain: 7, ashfall: 7, sea_fog: 6, dust_devil: 6, cold_rain: 5, warm_rain: 5, rain: 5, dawn_mist: 4, fog: 4, overcast: 3, dry_thunder: 3, heat_shimmer: 2, still: 1, clear: 0 };
  return r.weather.slice().sort((a, b) => (rank[b] || 0) - (rank[a] || 0))[0];
}

fs.writeFileSync(path.join(outDir, 'ANSWERS.json'), JSON.stringify({
  schema: 'elder-souls/region-shots@1',
  method: 'RI-WLD04 M17', seed: SEED, per_region: PER, night: NIGHT, worst_weather: WORST,
  width: W, height: H, fov: 70, eye_height_m: 1.7,
  note: 'Held separately from the frames so the directory of PNGs can be handed to a blind judge.',
  shots,
}, null, 2) + '\n');
fs.writeFileSync(path.join(outDir, 'REGIONS.txt'),
  regions.map((r) => `${r.name}\t${r.ground.name}\t${r.flora.join(', ') || '(none)'}\t${r.architecture.join(', ')}\t${r.climate}`).join('\n') + '\n');
log(`${shots.length} frames -> ${outDir}`);
process.exit(handle.errors.length ? EXIT.HARNESS_ERROR : EXIT.OK);
