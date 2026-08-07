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
import { CaptureSession, CaptureError } from '../capture/client.mjs';
import { PNG } from '../node_modules/pngjs/lib/png.js';

function meanLuma(file) {
  const p = PNG.sync.read(fs.readFileSync(file));
  let L = 0;
  for (let i = 0; i < p.data.length; i += 4) L += 0.299 * p.data[i] + 0.587 * p.data[i + 1] + 0.114 * p.data[i + 2];
  return L / (p.data.length / 4);
}

const USAGE = `province-shots.mjs — RI-WLD04 M17 unlabelled region frames.
  --out <dir>       output directory (required)
  --seed <n>        sampling seed (default 1337)
  --per <n>         frames per region (default 3)
  --passes <list>   day,night,worst (default day,night,worst — M17 step 6 requires all three)
  --shuffle-seed <n>  the permutation seed recorded in ANSWERS.json (default 20260806)
  --night           shorthand for --passes night
  --worst           shorthand for --passes worst
  --resume          keep any capture-NNN.png already on disk that clears its pass's luma floor
  --width/--height  default 1280 x 720
  --direct          boot a private browser instead of using the shared capture daemon
  --no-pin          let the daemon follow game/ changes mid-pack (default: pin the build, so all
                    117 frames are drawn by one game rather than by however many land mid-run)

BY DEFAULT THIS ROUTES THROUGH THE SHARED CAPTURE DAEMON (tools/capture/server.mjs), per
ARBITRATION.md S34. These are PLACED captures of APPEARANCE — M17 asks what a region looks like,
which is S34(a) territory — so they are legitimately teleported to, posed, and served from a
build-keyed cache. Every frame carries a settle proof and arrival: "placed" in ANSWERS.json.
The reason it matters: this pack is 117 frames, and the round-4 run of it managed three frames in
twelve minutes because forty agents were each running their own browser. --direct restores the
old private-browser path unchanged, for when the daemon cannot be reached.`;

const args = parseArgs();
if (wantsHelp(args) || !args.out) usage(USAGE);
const outDir = path.resolve(String(args.out));
ensureDir(outDir);
const W = Number(args.width || 1280), H = Number(args.height || 720);
const PER = Number(args.per || 3);
const SEED = Number(args.seed || 1337);
const PASSES = args.passes ? String(args.passes).split(',').map((x) => x.trim()).filter(Boolean)
  : args.night ? ['night'] : args.worst ? ['worst'] : ['day', 'night', 'worst'];
const SHUFFLE_SEED = Number(args['shuffle-seed'] ?? 20260806);
const RESUME = !!args.resume;
for (const p of PASSES) if (!['day', 'night', 'worst'].includes(p)) usage(USAGE);

// A tiny deterministic PRNG for the SAMPLING (not the game): the game's own seed is set below.
let st = SEED >>> 0;
const rnd = () => { st ^= st << 13; st >>>= 0; st ^= st >> 17; st ^= st << 5; st >>>= 0; return st / 4294967296; };

const regions = readJson(path.join(ROOT, 'game/data/world/regions.json')).regions;
const scale = readJson(path.join(ROOT, 'corpus/50-world/world-scale.json'));
const settlements = Object.values(scale.settlements).map((s) => [s.x, s.z]);

// ---------------------------------------------------------------------------------------------
// CAPTURE BACKEND — the shared daemon by default, a private browser under --direct.
//
// Both backends answer the same three questions, so the sampling, the shuffle and the
// anti-ordering assertion below are byte-for-byte the same code either way.
// ---------------------------------------------------------------------------------------------
const DIRECT = !!args.direct;
let handle = null, session = null;
const pageErrors = () => (handle ? handle.errors : []);

// PRNG state control. The batched sampler below draws candidates in chunks and REWINDS to the
// state the serial loop would have been in, so `--direct` and the daemon path draw the identical
// 117 points from the identical seed. Without the rewind, batching would silently re-sample the
// pack and no two runs would be comparable.
const getState = () => st;
const setState = (v) => { st = v >>> 0; };

const CAP = DIRECT ? await (async () => {
  handle = await launchGame({ ...args, width: W, height: H });
  await handle.h('setSeed', 1337);
  await handle.h('loadState', 'default');
  if (await handle.page.evaluate(() => typeof window.__HARNESS.setUIVisible === 'function')) await handle.h('setUIVisible', false);
  return {
    kind: 'direct',
    async sample(pts) {
      const out = [];
      for (const p of pts) out.push({ t: await handle.h('getTerrainAt', p.x, p.z), w: await handle.h('getWaterAt', p.x, p.z) });
      return out;
    },
    async terrainAt(x, z) { return handle.h('getTerrainAt', x, z); },
    async shoot({ x, z, y, yaw, weather, hours, file }) {
      await handle.h('teleport', x, z);
      await handle.h('streamAround', x, z);
      await handle.h('setTimeOfDay', hours);
      await handle.h('setWeather', weather);
      await handle.h('camera', { pos: [x, y + 1.7, z], look: [x + Math.sin(yaw) * 40, y + 1.7 - 3.0, z + Math.cos(yaw) * 40], fov: 70 });
      await handle.h('stepFrames', 24);
      await handle.h('renderFrame');
      await handle.page.screenshot({ path: file, type: 'png', animations: 'disabled', caret: 'hide', timeout: 240000 });
      return { settle: null, cached: false, provenance: { arrival: 'placed', note: 'direct browser; no settle proof taken' } };
    },
    async close() { await handle.close(); },
  };
})() : await (async () => {
  // A 117-frame pack must be drawn by ONE build or it is a mixture of games, so the daemon
  // is asked to pin unless told otherwise. If a daemon is already up it keeps whatever mode it
  // has; the status read below records which, so ANSWERS.json never guesses.
  session = new CaptureSession({ pinBuild: !args['no-pin'] });
  await session.connect();
  const dstat = await session.status();
  return {
    kind: 'service',
    async sample(pts) {
      // One socket round trip for the whole chunk. The serial version cost two CDP calls per
      // candidate and this pack rejects thousands of candidates before it takes a frame.
      const calls = [];
      for (const p of pts) { calls.push(['getTerrainAt', p.x, p.z]); calls.push(['getWaterAt', p.x, p.z]); }
      const r = await session.query(calls, { width: W, height: H });
      return pts.map((_, i) => ({ t: r.results[i * 2].value, w: r.results[i * 2 + 1].value }));
    },
    async terrainAt(x, z) { return (await session.query([['getTerrainAt', x, z]])).results[0].value; },
    async shoot({ x, z, y, yaw, weather, hours, file }) {
      const res = await session.capture({
        evidence_of: 'appearance',
        claim: 'RI-WLD04 M17 unlabelled region frames',
        place: { x, z },
        camera: { pos: [x, y + 1.7, z], look: [x + Math.sin(yaw) * 40, y + 1.7 - 3.0, z + Math.cos(yaw) * 40], fov: 70 },
        time: hours, weather, width: W, height: H, settle_frames: 24,
      });
      fs.copyFileSync(res.path, file);
      return { settle: res.settle, cached: res.cached, provenance: res.provenance };
    },
    daemon: { pid: dstat.pid, build: dstat.build, settle: dstat.settle },
    async close() { session.close(); },
  };
})();
log(`capture backend: ${CAP.kind}`);

const shots = [];
let unsettled = 0;
try {
  for (const PASS of PASSES) {
  const NIGHT = PASS === 'night';
  const WORST = PASS === 'worst';
  const FLOOR = NIGHT ? 3.0 : 18.0;
  for (const r of regions) {
    const bb = r.bounds_m;
    const picked = [];
    let tries = 0;
    const CHUNK = 256;
    outer:
    while (picked.length < PER && tries < 20000) {
      const cand = [], states = [];
      while (cand.length < CHUNK && tries + cand.length < 20000) {
        const x = bb.x[0] + rnd() * (bb.x[1] - bb.x[0]);
        const z = bb.z[0] + rnd() * (bb.z[1] - bb.z[0]);
        cand.push({ x, z }); states.push(getState());
      }
      if (!cand.length) break;
      const probed = await CAP.sample(cand);
      for (let i = 0; i < cand.length; i++) {
        tries++;
        const { x, z } = cand[i];
        if (settlements.some(([sx, sz]) => Math.hypot(x - sx, z - sz) < 120)) continue;
        const t = probed[i].t;
        if (!t || t.region !== r.id || !t.land || t.slope_deg > 34) continue;
        const w = probed[i].w;
        if (!w || w.depth_m > 0.5) continue;               // stand on ground, not in the channel
        if (picked.some((p) => Math.hypot(p.x - x, p.z - z) < 180)) continue;
        picked.push({ x, z, y: t.y, tier: t.danger_tier });
        if (picked.length >= PER) { setState(states[i]); break outer; }
      }
    }
    for (let i = 0; i < picked.length; i++) {
      const p = picked[i];
      const yaw = rnd() * Math.PI * 2;
      const weather = WORST ? worstOf(r) : r.weather[Math.floor(rnd() * r.weather.length)];
      const hours = NIGHT ? 1.0 : 9.5 + rnd() * 6.0;
      const id = `${String(shots.length + 1).padStart(3, '0')}`;
      const file = path.join(outDir, `capture-${id}.png`);
      // RESUME. A 117-frame pack is an hour of software rasterising and this environment kills
      // agents mid-run; a capture that cannot be picked up costs the whole hour twice. If the
      // frame is already on disk and bright enough for its pass, keep it. The sampling PRNG has
      // already been drawn either way, so the point, yaw, weather and hour recorded are the ones
      // this run chose — a resumed frame is marked as such rather than claimed as fresh.
      let resumed = false, prov = null, settle = null, cached = false;
      if (RESUME && fs.existsSync(file) && meanLuma(file) >= FLOOR) { resumed = true; }
      else {
        try {
          const out = await CAP.shoot({ ...p, yaw, weather, hours, file });
          prov = out.provenance; settle = out.settle; cached = out.cached;
        } catch (e) {
          // S34: an unsettled frame is an ERROR, never a quiet pass. Record it, keep going, and
          // fail the run at the end rather than shipping a pack with a hole nobody can see.
          if (e instanceof CaptureError) {
            unsettled++;
            log(`  UNSETTLED ${PASS} ${r.id} #${id}: ${e.code} ${e.message.split('\n')[0]}`);
            shots.push({ capture: `capture-${id}.png`, pass: PASS, region: r.id, region_name: r.name,
              x: +p.x.toFixed(1), z: +p.z.toFixed(1), y: +p.y.toFixed(2),
              yaw_deg: +(yaw * 180 / Math.PI).toFixed(1), weather, hours: +hours.toFixed(2),
              error: e.code, error_detail: e.message, settle: e.detail && e.detail.settle || null });
            continue;
          }
          throw e;
        }
      }
      // A frame whose eye landed inside a trunk is not a sample of the region, it is a sample of
      // one tree. Re-yaw and re-shoot rather than ship a black rectangle a judge cannot classify.
      let lum = meanLuma(file), spins = 0;
      if (resumed) spins = -1;
      let ex = p.x, ez = p.z, ey = p.y;
      // THE DARK-FRAME FLOOR IS PER PASS, and that is a defect fix rather than a preference.
      // A fixed floor of 18 exists to catch an eye that landed inside a trunk. At 01:00 the whole
      // frame is legitimately below it, so every night frame span the re-yaw loop to its limit —
      // eight extra full renders each. Measured on this build: 25 s for a day frame and 260 s for
      // a night one, which turns a 40-minute night pass into a three-hour one and silently makes
      // the recorded `yaw_deg` of every night frame the FIRST draw rather than the eighth. The
      // floor is now the pass's own: a night frame is rejected only if it is far darker than a
      // night frame should be.
      let y2 = yaw;
      while (lum < FLOOR && spins++ < 8) {
        // First re-yaw; if the eye is genuinely inside a trunk, step a few metres and try again.
        y2 = rnd() * Math.PI * 2;
        if (spins > 2) {
          const th = rnd() * Math.PI * 2, rr = 6 + rnd() * 14;
          ex = p.x + Math.cos(th) * rr; ez = p.z + Math.sin(th) * rr;
          ey = (await CAP.terrainAt(ex, ez)).y;
        }
        try {
          const out = await CAP.shoot({ x: ex, z: ez, y: ey, yaw: y2, weather, hours, file });
          prov = out.provenance; settle = out.settle; cached = out.cached;
        } catch (e) { if (e instanceof CaptureError) { unsettled++; break; } throw e; }
        lum = meanLuma(file);
      }
      shots.push({
        capture: `capture-${id}.png`, pass: PASS, region: r.id, region_name: r.name,
        x: +p.x.toFixed(1), z: +p.z.toFixed(1), y: +p.y.toFixed(2),
        yaw_deg: +((spins > 0 ? y2 : yaw) * 180 / Math.PI).toFixed(1), weather, hours: +hours.toFixed(2),
        mean_luma: +lum.toFixed(1), reshot: Math.max(0, spins), resumed,
        sha256: sha256(fs.readFileSync(file)),
        // S34 provenance, carried into ANSWERS.json so a verdict citing this pack can see what
        // it is admissible for without opening a second file.
        arrival: prov ? prov.arrival : 'placed',
        served_from_cache: cached,
        settled: settle ? settle.settled : null,
        settle_excess: settle ? settle.gates.G3_stability.excess : null,
        build_key: prov ? prov.build_key || null : null,
      });
      log(`  ${PASS} ${r.id} ${shots.length}/${regions.length * PER * PASSES.length}${cached ? ' (cache)' : ''}`);
    }
    if (picked.length < PER) log(`  WARNING: only ${picked.length}/${PER} points found in ${r.id}`);
  }
  }
} finally { await CAP.close(); }

function worstOf(r) {
  const rank = { salt_storm: 9, fever_fog: 9, sea_squall: 8, storm: 8, heavy_rain: 7, ashfall: 7, sea_fog: 6, dust_devil: 6, cold_rain: 5, warm_rain: 5, rain: 5, dawn_mist: 4, fog: 4, overcast: 3, dry_thunder: 3, heat_shimmer: 2, still: 1, clear: 0 };
  return r.weather.slice().sort((a, b) => (rank[b] || 0) - (rank[a] || 0))[0];
}

// ---- step 3: SHUFFLE THE IMAGES ---------------------------------------------------------------
// The pack this replaces was captured region by region and numbered in capture order, so frames
// 1-3 were region 1, 4-6 region 2, and so on down `REGIONS.txt`'s own alphabetical list. Verdict
// W1-01 §4a: "A judge who notices the ordering scores 39/39 without looking at a pixel. M17 as
// shipped is not a measurement of region legibility." The permutation below is seeded, recorded,
// and ASSERTED — a pack that fails the assertion is not written.
let sh = (SHUFFLE_SEED >>> 0) || 1;
const srnd = () => { sh ^= sh << 13; sh >>>= 0; sh ^= sh >> 17; sh ^= sh << 5; sh >>>= 0; return sh / 4294967296; };
const perm = shots.map((_, i) => i);
for (let i = perm.length - 1; i > 0; i--) { const j = Math.floor(srnd() * (i + 1)); [perm[i], perm[j]] = [perm[j], perm[i]]; }
// perm[k] = which capture becomes frame k+1.
const pad = String(shots.length).length;
const ordered = perm.map((src, k) => {
  const s0 = shots[src];
  const frame = `frame-${String(k + 1).padStart(pad, '0')}.png`;
  fs.renameSync(path.join(outDir, s0.capture), path.join(outDir, frame + '.tmp'));
  return { ...s0, frame, capture_index: src + 1 };
});
for (const s0 of ordered) fs.renameSync(path.join(outDir, s0.frame + '.tmp'), path.join(outDir, s0.frame));

// ---- the anti-ordering assertion ---------------------------------------------------------------
// Two ways a pack can leak its answers through its file order, both checked:
//  1. monotone blocks — Spearman rank correlation between frame index and the region's position in
//     the alphabetical list `REGIONS.txt` hands the judge;
//  2. runs — adjacent frames sharing a region far more often than chance.
const regionOrder = regions.map((r) => r.id);
const rank = ordered.map((s0) => regionOrder.indexOf(s0.region));
const n = rank.length;
const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
const idx = rank.map((_, i) => i);
const mx = mean(idx), my = mean(rank);
const cov = idx.reduce((a, v, i) => a + (v - mx) * (rank[i] - my), 0);
const sx = Math.sqrt(idx.reduce((a, v) => a + (v - mx) ** 2, 0));
const sy = Math.sqrt(rank.reduce((a, v) => a + (v - my) ** 2, 0));
const spearman = sy === 0 ? 0 : cov / (sx * sy);
let runs = 0;
for (let i = 1; i < n; i++) if (ordered[i].region === ordered[i - 1].region) runs++;
const expectedRuns = (n - 1) * (PER * PASSES.length - 1) / (n - 1);
const antiOrdering = {
  shuffle_seed: SHUFFLE_SEED,
  spearman_frameindex_vs_regionrank: +spearman.toFixed(4),
  spearman_bar: 0.25,
  adjacent_same_region_runs: runs,
  adjacent_runs_expected_by_chance: +expectedRuns.toFixed(2),
  adjacent_runs_bar: Math.ceil(expectedRuns * 3 + 3),
  monotone_block_structure: false,
  pass: Math.abs(spearman) < 0.25 && runs <= Math.ceil(expectedRuns * 3 + 3),
};
if (!antiOrdering.pass) {
  log(`ANTI-ORDERING ASSERTION FAILED: ${JSON.stringify(antiOrdering)}`);
  process.exit(EXIT.HARNESS_ERROR);
}

fs.writeFileSync(path.join(outDir, 'ANSWERS.json'), JSON.stringify({
  schema: 'elder-souls/region-shots@2',
  method: 'RI-WLD04 M17',
  capture_backend: CAP.kind,
  s34: {
    ruling: 'ARBITRATION.md S34(a) — these are PLACED captures of APPEARANCE and are admissible as such. ' +
      'A verdict citing this pack for an ARRIVAL claim (reachability, traversal, the crossing, RI-JRN*) is VOID.',
    arrival: 'placed',
    unsettled_frames: unsettled,
    daemon: CAP.daemon || null,
    build_keys_in_this_pack: [...new Set(shots.map((s0) => s0.build_key).filter(Boolean))],
  },
  seed: SEED, shuffle_seed: SHUFFLE_SEED, per_region: PER, passes: PASSES,
  night: PASSES.includes('night'), worst_weather: PASSES.includes('worst'),
  frames_total: ordered.length, frames_per_pass: Object.fromEntries(PASSES.map((p) => [p, ordered.filter((s0) => s0.pass === p).length])),
  width: W, height: H, fov: 70, eye_height_m: 1.7,
  anti_ordering: antiOrdering,
  note: 'Held separately from the frames so the directory of PNGs can be handed to a blind judge. '
      + 'The frames are shuffled by the recorded seed: `capture_index` is the capture order and '
      + '`frame` is the shipped order, and the two are uncorrelated by the assertion above.',
  permutation: perm,
  shots: ordered,
}, null, 2) + '\n');
fs.writeFileSync(path.join(outDir, 'REGIONS.txt'),
  regions.map((r) => `${r.name}\t${r.ground.name}\t${r.flora.join(', ') || '(none)'}\t${r.architecture.join(', ')}\t${r.climate}`).join('\n') + '\n');
fs.writeFileSync(path.join(outDir, 'README-JUDGE.txt'),
  `RI-WLD04 M17 blind region-identification pack.\n\n`
  + `${ordered.length} frames, ${regions.length} regions, ${PER} points per region per pass, `
  + `passes: ${PASSES.join(', ')}.\n`
  + `The frames are SHUFFLED (seed ${SHUFFLE_SEED}); file order carries no information about region.\n`
  + `Spearman(frame index, region rank) = ${antiOrdering.spearman_frameindex_vs_regionrank}.\n\n`
  + `Candidate regions are in REGIONS.txt, one per line, with ground, flora, architecture and climate.\n`
  + `Assign exactly one region to each frame. Write your answers BEFORE opening ANSWERS.json.\n`);
log(`${ordered.length} frames -> ${outDir}  (shuffle seed ${SHUFFLE_SEED}, spearman ${antiOrdering.spearman_frameindex_vs_regionrank})`);
if (unsettled) log(`${unsettled} frame(s) FAILED THEIR SETTLE PROOF — this pack has holes in it (S34: an unsettled frame is an error, never a quiet pass)`);
process.exit(unsettled ? EXIT.MEASUREMENT_FAIL : (pageErrors().length ? EXIT.HARNESS_ERROR : EXIT.OK));
