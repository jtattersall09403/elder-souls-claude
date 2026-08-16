/**
 * F4 ROUND-3 CRITIC — MOTION AND MANY ANGLES, ON THE TREE THAT ACTUALLY SHIPPED.
 *
 * TWO REASONS THIS EXISTS AND NEITHER IS CEREMONIAL.
 *
 * 1. THE OWNER'S DIRECTIVE. "Builders and critics both look at our actual game, in motion. Orbit
 *    the camera around the character, multiple angles, motion sequences. STILLS ARE NOT ENOUGH."
 *    Round 3 captured 50 stills and zero moving frames; its `orbit` and `walk` modes are written
 *    and were never fired. So the critic drives them, as the round-2 critic did before it.
 *
 * 2. THE SHIPPED TREE HAS NEVER BEEN PHOTOGRAPHED AT A JUDGED WINDOW. Every one of round 3's eight
 *    window runs served `sky.js 7172bb96019002d6`; the tree that is in `HEAD` and in the working
 *    copy is `8cfc715a2fcd9c7f`. The round's claim that the shipped build is behaviourally identical
 *    to round 2's is an argument about comments, and an argument is not a capture. `--mode window`
 *    below re-photographs pair01 on the tree that is actually there and records the served sha
 *    (HAZARDS s22), so the claim becomes a measurement or stops being one.
 *
 * Every arm flushes its manifest immediately (round 3 lost three runs to the 600 s foreground
 * ceiling and kept their partial rows only because of this). Displacement is measured per frame
 * (HAZARDS s16) so a dead input path shows up as data rather than as a still picture of a walk.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { launchForCapture, resolveGpuMode } from '../../../../../../tools/visual/lib/gpu-launch.mjs';
import { gateBuffer } from '../../../../../../tools/visual/frame-liveness.mjs';

const REPO = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../../../../..');
const args = {};
for (let i = 2; i < process.argv.length; i++) {
  if (!process.argv[i].startsWith('--')) continue;
  const k = process.argv[i].slice(2);
  args[k] = (process.argv[i + 1] && !process.argv[i + 1].startsWith('--')) ? process.argv[++i] : true;
}
const MODE = String(args.mode || 'orbit');
const ENTRY = 'game/index.html';
const TAG = String(args.tag || MODE);
const OUT = path.resolve(REPO, `reports/f4r3c/${TAG}`);
fs.mkdirSync(OUT, { recursive: true });
const DECK = JSON.parse(fs.readFileSync(path.join(REPO, 'tools/blind/deck-protocol-a.json'), 'utf8'));
const SEED = Number(DECK.capture.seed), SETTLE = Number(DECK.capture.settle_frames);
const [CW, CH] = String(args.res || '1920x1080').split('x').map(Number);

function servedSources() {
  const gameDir = path.join(REPO, 'game');
  const out = {};
  for (const rel of ['src/render/lib/lighting-recipes.js', 'src/render/sky.js']) {
    const p = path.join(gameDir, rel);
    out[rel] = fs.existsSync(p) ? crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex').slice(0, 16) : null;
  }
  return out;
}

const { g, attestation } = await launchForCapture({
  mode: resolveGpuMode(args), requireHardware: false, entry: ENTRY, width: 1280, height: 720,
});
await g.page.waitForFunction(() => window.__HARNESS, null, { timeout: 180000 });
await g.h('ready');
await g.page.evaluate(({ w, h }) => {
  const c = document.getElementById('view');
  c.width = w; c.height = h; window.__ENGINE.renderer.setSize(w, h);
}, { w: CW, h: CH });
await g.h('setSeed', SEED);
await g.page.evaluate(() => {
  const R = window.__ENGINE.renderer;
  window.__sky = R.sky || null;
  window.__sunLight = null;
  R.scene.traverse((o) => { if (o.isDirectionalLight && o.castShadow && o.shadow && o.shadow.mapSize.x >= 2048) window.__sunLight = o; });
  window.__readback = () => {
    const sun = window.__sunLight, sky = window.__sky;
    return {
      sunIntensity: sun ? +sun.intensity.toFixed(5) : null,
      sunColour: sun ? sun.color.toArray().map((v) => +v.toFixed(4)) : null,
      uSunColour: sky ? sky.uniforms.uSunColour.value.toArray().map((v) => +v.toFixed(4)) : null,
      uHorizon: sky ? sky.uniforms.uHorizon.value.toArray().map((v) => +v.toFixed(4)) : null,
      recipeId: sky && sky.lastFrame ? (sky.lastFrame.recipeId ?? sky.lastFrame.recipe_id ?? null) : null,
      moonCastShadow: sky && sky.moon ? !!sky.moon.castShadow : null,
      shadowMapSize: sun && sun.shadow ? sun.shadow.mapSize.x : null,
      shadowCameraFar: sun && sun.shadow && sun.shadow.camera ? sun.shadow.camera.far : null,
      environmentIntensity: +Number(R.scene.environmentIntensity).toFixed(5),
    };
  };
});
const call = async (m, ...a) => {
  const res = await g.page.evaluate(async ({ method, callArgs }) => {
    const H = window.__HARNESS;
    if (typeof H[method] !== 'function') return { __err: `${method} IS NOT A HARNESS VERB` };
    try { return { __ok: await H[method](...callArgs) }; } catch (e) { return { __err: `${method}() threw: ${(e && e.message) || e}` }; }
  }, { method: m, callArgs: a });
  if (res && res.__err) { if (/IS NOT A HARNESS VERB/.test(res.__err)) throw new Error(res.__err); return { ok: false, e: String(res.__err).slice(0, 200) }; }
  return { ok: true, v: res ? res.__ok : undefined };
};
async function poseAt([px, py, pz], { yaw_deg, pitch_deg, distance_m, lookHeight = 1.1 }) {
  const yaw = (yaw_deg || 0) * Math.PI / 180, pitch = (pitch_deg || 0) * Math.PI / 180, d = distance_m || 0;
  const eye = [px + Math.sin(yaw) * Math.cos(pitch) * d, py + 1.5 - Math.sin(pitch) * d, pz + Math.cos(yaw) * Math.cos(pitch) * d];
  const r = await call('camera', { pos: eye, look: [px, py + lookHeight, pz] });
  if (!r.ok) throw new Error(`camera pose refused: ${r.e}`);
}
async function shoot(file) {
  const t0 = Date.now();
  const readback = await g.page.evaluate(() => window.__readback());
  const shot = await call('screenshot');
  if (!shot.ok) return { error: shot.e, readback };
  const buf = Buffer.from(String(shot.v).replace(/^data:image\/png;base64,/, ''), 'base64');
  fs.writeFileSync(file, buf);
  return { file: path.relative(REPO, file), readback,
    liveness: gateBuffer(buf, { label: path.basename(file), subject: false, throwOnDegenerate: false }).verdict,
    capture_ms: Date.now() - t0 };
}
const manifest = { at: new Date().toISOString(), mode: MODE, tag: TAG, served: servedSources(),
  renderer: attestation, resolution: [CW, CH], seed: SEED,
  evidence_class: attestation && attestation.class === 'HARDWARE' ? 'HARDWARE' : 'SOFTWARE — differential only (HAZARDS §15)',
  rows: [], aborted: null };
const reportPath = path.join(OUT, `${TAG}.json`);
const flush = () => { if (manifest.rows.length) fs.writeFileSync(reportPath, JSON.stringify(manifest, null, 2)); };
async function place(setupId) {
  const st = DECK.setups.find((x) => x.id === setupId);
  const where = await call('whereAmI');
  if (where.ok && where.v && where.v.interior) await call('exitInterior');
  await call('teleport', st.place.x, st.place.z);
  await call('stepFrames', 4);
  await call('setWeather', 'clear');
  return st;
}
console.log(`served sky.js=${manifest.served['src/render/sky.js']} recipes=${manifest.served['src/render/lib/lighting-recipes.js']} renderer=${attestation.class}`);
try {
  if (MODE === 'orbit') {
    await place('char-player');
    const hour = Number(args.hour || 8);
    await call('setTimeOfDay', hour);
    await call('stepFrames', 4);
    const s = await call('snapshot');
    for (const yaw of String(args.yaws || '0,90,180,270').split(',').map(Number)) {
      await poseAt(s.v.player.pos, { yaw_deg: yaw, pitch_deg: -8, distance_m: 7, lookHeight: 1.1 });
      await call('stepFrames', SETTLE);
      const r = await shoot(path.join(OUT, `orbit-t${hour}-y${String(yaw).padStart(3, '0')}.png`));
      manifest.rows.push({ mode: MODE, hour, yaw, ...r }); flush();
      console.log(`  orbit t=${hour} yaw=${yaw} ${r.liveness} ${r.capture_ms}ms recipe=${r.readback.recipeId} sunCol=${JSON.stringify(r.readback.sunColour)} moonCastShadow=${r.readback.moonCastShadow} shadowMap=${r.readback.shadowMapSize} far=${r.readback.shadowCameraFar}`);
    }
  }
  if (MODE === 'walk') {
    await place('char-player');
    const hour = Number(args.hour || 13);
    await call('setTimeOfDay', hour);
    await call('stepFrames', SETTLE);
    const s0 = await call('snapshot');
    const start = [...s0.v.player.pos];
    await poseAt(start, { yaw_deg: 180, pitch_deg: -10, distance_m: 5.0, lookHeight: 1.2 });
    for (let k = 0; k < Number(args.frames || 5); k++) {
      const script = []; for (let f = 0; f < 10; f++) script.push({ f, move: [0, 1] });
      const q = await call('queueInputs', script);
      if (!q.ok) { manifest.rows.push({ mode: 'walk', hour, k, error: q.e }); flush(); break; }
      await call('stepFrames', 10);
      const s1 = await call('snapshot');
      const p = s1.ok ? s1.v.player.pos : null;
      if (p) await poseAt(p, { yaw_deg: 180, pitch_deg: -10, distance_m: 5.0, lookHeight: 1.2 });
      const r = await shoot(path.join(OUT, `walk-t${hour}-f${String(k).padStart(2, '0')}.png`));
      const moved = p ? +Math.hypot(p[0] - start[0], p[2] - start[2]).toFixed(3) : null;
      manifest.rows.push({ mode: 'walk', hour, k, moved_m_from_start: moved, pos: p, ...r }); flush();
      console.log(`  walk t=${hour} k=${k} moved=${moved}m ${r.liveness} ${r.capture_ms}ms`);
    }
  }
  if (MODE === 'window') {
    // pair01 on the tree that is actually in HEAD — the capture the round owes its own claim.
    const st = await place('char-player');
    await call('setTimeOfDay', 8);
    const s = await call('snapshot');
    await poseAt(s.v.player.pos, st.camera);
    await call('stepFrames', SETTLE);
    for (const k of ['shipped-tree-base', 'shipped-tree-base-recheck']) {
      const r = await shoot(path.join(OUT, `pair01__${k}.png`));
      manifest.rows.push({ mode: MODE, pair: 'pair01', hour: 8, crop: [300, 150, 512, 512], arm: k, ...r }); flush();
      console.log(`  ${k} ${r.liveness} ${r.capture_ms}ms sunCol=${JSON.stringify(r.readback.sunColour)} sunI=${r.readback.sunIntensity} recipe=${r.readback.recipeId}`);
    }
  }
} catch (e) {
  manifest.aborted = String((e && e.stack) || e);
  console.error('ABORTED:', manifest.aborted);
} finally {
  if (!manifest.rows.length && fs.existsSync(reportPath)) {
    console.error(`REFUSED to overwrite ${reportPath} with a zero-row run (HAZARDS §18)`);
    process.exitCode = 4;
  } else { fs.writeFileSync(reportPath, JSON.stringify(manifest, null, 2)); console.log(`wrote ${path.relative(REPO, reportPath)} — ${manifest.rows.length} row(s)`); }
  await g.close().catch(() => {});
}
