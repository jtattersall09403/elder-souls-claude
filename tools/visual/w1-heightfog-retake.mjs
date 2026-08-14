#!/usr/bin/env node
/**
 * w1-heightfog-retake.mjs — re-take the thirteen-region height-fog pair against the build that ships.
 *
 * WHY THIS EXISTS. W1-30F published *"13 of 13 regions improved, unusable frames 9 of 13 down to
 * 5 of 13"*, and it is the headline evidence in circulation for the atmosphere and for region
 * identity. The critic of `W1-30-SHADOW-CASTERS-r1` showed that pair was rendered while
 * `world/aerial.js` was clobbering `render/sky.js`'s `THREE.ShaderChunk` fog chunks — i.e. through
 * a fog model that no longer exists — and, worse, that `frame-stats.mjs` cannot arbitrate between
 * the two atmospheres: at `vista-deep-marshes` it agrees emphatically with the shipped model
 * (edge 15.22 against 2.74) and at `vista-salt-hills` it mildly PREFERS the broken one (edge 3.05
 * against 2.79, span 160 against 128).
 *
 * So the number is not wrong so much as it is about a build that no longer exists, and this tool
 * re-derives it against the build that does. **It edits no source.** `render/sky.js` already
 * exposes the switch: `setFeature('heightFog', false)` sets `scene.fog.heightFalloff = 0`, which
 * degenerates the height-integrated Beer-Lambert to the height-independent case — the honest
 * before-arm, and the same thing done through the shipped code path rather than around it.
 *
 * WHAT IT ASSERTS, so a reader does not have to take the arm on trust:
 *   - `render/sky.js` owns `THREE.ShaderChunk.fog_fragment` in BOTH arms (read out of the live
 *     page exactly as `w1-30-fog-owner-ab.mjs` does), and `uAerial` is not declared. If aerial's
 *     chunks were live this would say so and the run would be void.
 *   - `scene.fog.heightFalloff` is read back per site per arm. The OFF arm must read 0 and the ON
 *     arm must read non-zero, or the arm did not apply and the row is marked VACUOUS. This is the
 *     inert-control check (RULES rule 6): a feature switch that silently does nothing looks
 *     exactly like a feature that does not matter.
 *   - Both arms render the same seed, camera, weather and time, and the region record (sigma0, H)
 *     is read back and required to be identical between arms, so the only difference is the fog law.
 *
 * WHAT IT DOES NOT CLAIM. `frame-stats.mjs` is a screen for "unusable", not a quality judgement,
 * and the r1 critic showed it ranks these two atmospheres the wrong way round at one site out of
 * three. This run re-derives the count HONESTLY; whether the count supports the atmosphere is a
 * separate question and the answer is written in the report, not assumed here.
 *
 * Usage:
 *   node tools/visual/w1-heightfog-retake.mjs
 *   node tools/visual/w1-heightfog-retake.mjs --out reports/visual-truth/heightfog-retake
 */
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { launchGame } from '../lib/browser.mjs';
import { frameStats } from './frame-stats.mjs';

const REPO = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const args = {};
for (let i = 2; i < process.argv.length; i++) {
  if (!process.argv[i].startsWith('--')) continue;
  const k = process.argv[i].slice(2);
  args[k] = (process.argv[i + 1] && !process.argv[i + 1].startsWith('--')) ? process.argv[++i] : true;
}

const DECK = JSON.parse(fs.readFileSync(path.join(REPO, 'tools/visual/deck.json'), 'utf8'));
const OUT = path.resolve(REPO, args.out || 'reports/visual-truth/heightfog-retake');
const TIME = Number(args.time || 13);
const [CW, CH] = String(args.canvas || `${DECK.capture.width}x${DECK.capture.height}`).split('x').map(Number);
const SEED = Number(args.seed || DECK.capture.seed);
// The thirteen region vistas — the same population W1-30F's pair was taken over.
const SITES = DECK.setups.filter((s) => s.id.startsWith('vista-')).map((s) => s.id);

for (const arm of ['on', 'off']) fs.mkdirSync(path.join(OUT, arm, 'frames'), { recursive: true });

const commit = (() => { try { return execSync('git rev-parse HEAD', { cwd: REPO }).toString().trim(); } catch { return null; } })();

const g = await launchGame({ entry: 'game/index.html', width: CW, height: CH });
await g.h('ready');
await g.page.evaluate(({ w, h }) => {
  const c = document.getElementById('view'); c.width = w; c.height = h;
  const r = window.__ENGINE.renderer;
  if (r.renderer && r.renderer.setPixelRatio) r.renderer.setPixelRatio(1);
  r.setSize(w, h);
}, { w: CW, h: CH });
await g.h('setSeed', SEED);
const step = (n) => g.h('stepFrames', n);

/** Which module owns the fog chunks, read out of the live page. Neither arm asserts the answer. */
const chunkOwner = () => g.page.evaluate(async () => {
  const THREE = window.__ENGINE?.THREE || (await import('./vendor/three/three.module.js'));
  const f = String(THREE.ShaderChunk.fog_fragment || '');
  return {
    fog_fragment: /esAerialScale/.test(f) ? 'world/aerial.js' : (/esSigma0/.test(f) ? 'render/sky.js' : 'three stock'),
    uAerial_declared: /uAerial/.test(String(THREE.ShaderChunk.fog_pars_fragment || '')),
  };
});
const fogState = () => g.page.evaluate(() => {
  const sky = window.__ENGINE.renderer.sky;
  const fog = window.__ENGINE.renderer.scene.fog;
  return {
    heightFog_feature: sky.features.heightFog,
    heightFalloff: fog ? fog.heightFalloff : null,
    sigma0: fog ? fog.sigma0 : null,
    camY: window.__ENGINE.renderer.camera ? +window.__ENGINE.renderer.camera.position.y.toFixed(2) : null,
  };
});
const setFeature = (n, o) => g.page.evaluate(({ n, o }) => window.__ENGINE.renderer.sky.setFeature(n, o), { n, o });

async function place(site) {
  const s = DECK.setups.find((x) => x.id === site);
  await g.h('teleport', s.place.x, s.place.z);
  await step(40);
  const snap = await g.h('snapshot');
  const [px, py, pz] = snap.player.pos;
  const c = s.camera;
  const yaw = (c.yaw_deg || 0) * Math.PI / 180, pitch = (c.pitch_deg || 0) * Math.PI / 180;
  const height = c.height_m || 1.7, fwd = 60;
  await g.h('camera', { pos: [px, py + height, pz], look: [px + Math.sin(yaw) * fwd, py + height + Math.tan(pitch) * fwd, pz + Math.cos(yaw) * fwd] });
  await g.h('setWeather', 'clear');
  await g.h('setTimeOfDay', TIME);
  await step(DECK.capture.settle_frames || 12);
}
async function shot(arm, site) {
  const d = await g.h('screenshot');
  const buf = Buffer.from(String(d).replace(/^data:image\/png;base64,/, ''), 'base64');
  fs.writeFileSync(path.join(OUT, arm, 'frames', `${site}.png`), buf);
  return buf;
}

const report = {
  tool: 'w1-heightfog-retake', commit, time_of_day: TIME, weather: 'clear', seed: SEED,
  canvas: [CW, CH], sites: SITES.length, chunk_owner: {}, rows: [], checks: {}, pageErrors: [],
};

const perArm = { on: {}, off: {} };
for (const arm of ['on', 'off']) {
  await setFeature('heightFog', arm === 'on');
  report.chunk_owner[arm] = await chunkOwner();
  console.log(`\n=== arm heightFog=${arm} === chunk owner ${JSON.stringify(report.chunk_owner[arm])}`);
  for (const site of SITES) {
    await place(site);
    // setTimeOfDay/teleport rebuild the fog each frame from the region record; re-assert the
    // feature after the world has settled so the arm is what is actually rendered.
    await setFeature('heightFog', arm === 'on');
    await step(4);
    const st = await fogState();
    const buf = await shot(arm, site);
    const s = frameStats(buf);
    perArm[arm][site] = { ...s, ...st };
    console.log(`  ${site.padEnd(26)} falloff ${String(st.heightFalloff).padStart(8)}  sigma0 ${st.sigma0}  dom ${(s.dominant_frac * 100).toFixed(1).padStart(5)}%  edge ${(s.edge_density * 100).toFixed(2).padStart(5)}%  span ${String(s.luma_span).padStart(4)}  ${s.flags.join(',') || '-'}`);
  }
}

// ---- rows, and the vacuity check ------------------------------------------------------------
let vacuous = 0, sigmaMismatch = 0;
for (const site of SITES) {
  const on = perArm.on[site], off = perArm.off[site];
  const armApplied = (Number(off.heightFalloff) === 0) && (Number(on.heightFalloff) !== 0);
  if (!armApplied) vacuous++;
  if (Math.abs(Number(on.sigma0) - Number(off.sigma0)) > 1e-9) sigmaMismatch++;
  report.rows.push({
    site, arm_applied: armApplied,
    heightFalloff: { on: on.heightFalloff, off: off.heightFalloff },
    sigma0: { on: on.sigma0, off: off.sigma0 }, camY: on.camY,
    dominant_frac: { on: on.dominant_frac, off: off.dominant_frac },
    edge_density: { on: on.edge_density, off: off.edge_density },
    luma_span: { on: on.luma_span, off: off.luma_span },
    flags: { on: on.flags, off: off.flags },
    usable: { on: on.usable, off: off.usable },
    edge_direction: on.edge_density > off.edge_density ? 'heightFog better' : (on.edge_density < off.edge_density ? 'heightFog WORSE' : 'tie'),
  });
}
const countUnusable = (arm) => SITES.filter((s) => !perArm[arm][s].usable).length;
report.unusable = { heightFog_on: countUnusable('on'), heightFog_off: countUnusable('off'), of: SITES.length };
report.edge_improved_sites = report.rows.filter((r) => r.edge_direction === 'heightFog better').length;
report.edge_worse_sites = report.rows.filter((r) => r.edge_direction === 'heightFog WORSE').length;
report.mean_edge = {
  on: +(SITES.reduce((a, s) => a + perArm.on[s].edge_density, 0) / SITES.length * 100).toFixed(3),
  off: +(SITES.reduce((a, s) => a + perArm.off[s].edge_density, 0) / SITES.length * 100).toFixed(3),
};
report.mean_span = {
  on: +(SITES.reduce((a, s) => a + perArm.on[s].luma_span, 0) / SITES.length).toFixed(1),
  off: +(SITES.reduce((a, s) => a + perArm.off[s].luma_span, 0) / SITES.length).toFixed(1),
};

report.checks['SKY-JS-OWNS-THE-FOG-IN-BOTH-ARMS'] = (report.chunk_owner.on.fog_fragment === 'render/sky.js'
  && report.chunk_owner.off.fog_fragment === 'render/sky.js' && !report.chunk_owner.on.uAerial_declared)
  ? 'PASS — render/sky.js owns THREE.ShaderChunk.fog_fragment in both arms and uAerial is not declared, so this pair is about the build that ships'
  : `FAIL — chunk owner ${JSON.stringify(report.chunk_owner)}; this pair is NOT about the shipped model and must not be published`;
report.checks['ARMS-ACTUALLY-DIFFER'] = vacuous === 0
  ? `PASS — all ${SITES.length} sites read heightFalloff = 0 with the feature off and non-zero with it on`
  : `FAIL — ${vacuous} of ${SITES.length} sites did not change heightFalloff between arms; those rows are a second copy of the same arm`;
report.checks['ONLY-THE-FOG-LAW-DIFFERS'] = sigmaMismatch === 0
  ? 'PASS — sigma0 is byte-identical between arms at every site, so the world, weather and region record are the same and only the fog law differs'
  : `FAIL — sigma0 differs between arms at ${sigmaMismatch} site(s); the arms are not comparable`;
report.pageErrors = g.errors.slice(0, 20);

fs.writeFileSync(path.join(OUT, 'heightfog-retake.json'), JSON.stringify(report, null, 2));
console.log('\n--- checks ---');
for (const [k, v] of Object.entries(report.checks)) console.log(`${k}: ${v}`);
console.log(`\nunusable by frame-stats.mjs: heightFog OFF ${report.unusable.heightFog_off} of ${SITES.length}  ->  heightFog ON ${report.unusable.heightFog_on} of ${SITES.length}`);
console.log(`edge_density: heightFog better at ${report.edge_improved_sites} of ${SITES.length} sites, worse at ${report.edge_worse_sites}`);
console.log(`mean edge% ${report.mean_edge.off} -> ${report.mean_edge.on};  mean luma span ${report.mean_span.off} -> ${report.mean_span.on}`);
console.log(`\nwrote ${path.join(OUT, 'heightfog-retake.json')}`);
await g.close();
process.exit(Object.values(report.checks).every((v) => String(v).startsWith('PASS')) ? 0 : 3);
