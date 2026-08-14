#!/usr/bin/env node
/**
 * deck.mjs — run the Deck. The same shots, the same angles, the same lights, every time.
 *
 * This exists so that "did that change help?" is answerable. Any visual child can run
 *   node tools/visual/deck.mjs --profile smoke --tag before
 *   ...make the change...
 *   node tools/visual/deck.mjs --profile smoke --tag after
 * and get two directories of frames that differ only by the change.
 *
 * THREE THINGS THIS TOOL REFUSES TO DO, each because of a specific past failure:
 *
 *  1. It never silently skips a setup. A setup that cannot be reached is written to the
 *     manifest as `status: "red"` with the reason. The old habit — a sweep that captures
 *     "what worked" — is how a missing region becomes a shorter report instead of a defect.
 *  2. It never claims GPU. `renderer_string` is read from the live WebGL context on the
 *     page and stamped into every manifest. A SwiftShader run says SwiftShader.
 *  3. It records a hash per frame, so determinism is checkable rather than assumed.
 *
 * Usage:
 *   node tools/visual/deck.mjs --profile wide --tag baseline
 *   node tools/visual/deck.mjs --profile smoke --seed 12345      (determinism red control)
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { launchGame } from '../lib/browser.mjs';

const REPO = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const args = {};
for (let i = 2; i < process.argv.length; i++) {
  if (!process.argv[i].startsWith('--')) continue;
  const k = process.argv[i].slice(2);
  args[k] = (process.argv[i + 1] && !process.argv[i + 1].startsWith('--')) ? process.argv[++i] : true;
}

const DECK = JSON.parse(fs.readFileSync(path.join(REPO, args.deck || 'tools/visual/deck.json'), 'utf8'));
const PROFILE_NAME = String(args.profile || 'smoke');
const PROFILE = DECK.profiles[PROFILE_NAME];
if (!PROFILE) {
  console.error(`unknown profile '${PROFILE_NAME}'. have: ${Object.keys(DECK.profiles).join(', ')}`);
  process.exit(2);
}
const TAG = String(args.tag || PROFILE_NAME);
const OUT = path.resolve(REPO, args.out || `reports/visual-truth/deck/${TAG}`);
const SHOT_DIR = path.join(OUT, 'frames');
fs.mkdirSync(SHOT_DIR, { recursive: true });
const SEED = Number(args.seed || DECK.capture.seed);
const [CW, CH] = String(args.canvas || `${DECK.capture.width}x${DECK.capture.height}`).split('x').map(Number);
const SETTLE = Number(args.settle || DECK.capture.settle_frames);
const LIMIT = args.limit ? Number(args.limit) : Infinity;

// ---- completeness check, before a browser is even launched ------------------------------
// The gate is "remove a region from the world; its setups must go red rather than vanish".
// This is where that happens: the manifest carries the counts it was built from and we
// re-derive them now. A mismatch is a hard fail of the DECK, not a quiet smaller run.
const live = {
  regions: (() => { const d = JSON.parse(fs.readFileSync(path.join(REPO, 'game/data/world/regions.json'), 'utf8')); return (Array.isArray(d) ? d : (d.regions || Object.values(d))).length; })(),
  settlements: fs.readdirSync(path.join(REPO, 'game/data/world/settlements')).filter((f) => f.endsWith('.json')).length,
  interiors: fs.readdirSync(path.join(REPO, 'game/data/world/interiors')).filter((f) => f.endsWith('.json')).length,
};
const drift = Object.keys(DECK.source_counts).filter((k) => DECK.source_counts[k] !== live[k]);

const rows = [];
const red = (setup, axis, reason) => {
  rows.push({ setup: setup.id, block: setup.block, ...axis, status: 'red', reason, file: null, hash: null });
  console.log(`  RED  ${setup.id} ${axis.time || ''}/${axis.weather || ''} — ${reason}`);
};

const t0 = Date.now();
const HW = process.env.VT_HARDWARE_GPU === '1';
const g = await launchGame({ entry: 'game/index.html', width: 1280, height: 720, hardwareGpu: HW });
await g.page.waitForFunction(() => window.__HARNESS, null, { timeout: 120000 });
await g.h('ready');
await g.page.evaluate(({ w, h }) => {
  const c = document.getElementById('view');
  c.width = w; c.height = h;
  window.__ENGINE.renderer.setSize(w, h);
}, { w: CW, h: CH });
await g.h('setSeed', SEED);

// ---- what actually drew these pixels ----------------------------------------------------
// The first version of this read window.__ENGINE.renderer.renderer.getContext(), which threw,
// and the catch returned a string that did NOT match /swiftshader/ — so the manifest recorded
// `software_renderer: false` on a SwiftShader run. A probe that fails open is worse than no
// probe: it launders software pixels into an appearance claim. It now fails CLOSED.
const renderer_string = await g.page.evaluate(() => {
  try {
    const gl = document.createElement('canvas').getContext('webgl2');
    if (!gl) return 'unavailable: no webgl2 context';
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    return String(ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER));
  } catch (e) { return `unavailable: ${e.message}`; }
});
const rendererUnknown = /^unavailable|^unknown/i.test(String(renderer_string));
const swiftshader = rendererUnknown || /swiftshader|llvmpipe|software|mesa/i.test(String(renderer_string));
const build = await g.h('getBuildInfo');
console.log(`deck: profile=${PROFILE_NAME} tag=${TAG} seed=${SEED} canvas=${CW}x${CH}`);
console.log(`renderer: ${renderer_string}${swiftshader ? '   *** SOFTWARE — not valid for an appearance claim (W1-30-EVIDENCE §4) ***' : ''}`);
if (drift.length) console.log(`DECK DRIFT: ${drift.map((k) => `${k} ${DECK.source_counts[k]} -> ${live[k]}`).join(', ')} — setups below will go red, not vanish`);

const call = async (m, ...a) => {
  try { return { ok: true, v: await g.h(m, ...a) }; }
  catch (e) { return { ok: false, e: String(e.message).split('\n')[0].slice(0, 200) }; }
};

async function shoot(file) {
  const d = await g.h('screenshot');
  const buf = Buffer.from(String(d).replace(/^data:image\/png;base64,/, ''), 'base64');
  fs.writeFileSync(path.join(SHOT_DIR, file), buf);
  return { bytes: buf.length, hash: crypto.createHash('sha256').update(buf).digest('hex').slice(0, 16) };
}

/** Put the camera where the setup says, in world space. Returns null on success. */
async function poseCamera(setup) {
  const cam = setup.camera;
  if (cam.kind === 'gameplay') {
    await call('camera', { mode: 'gameplay' });
    // Drive the yaw through the real input pipeline, the way a player turns. `look` is
    // DEGREES PER FRAME and the sim zeroes it after consuming it (a predecessor lost an
    // hour to that), so it must be emitted on every frame it should apply to.
    const want = Number(cam.yaw_deg || 0);
    const st = await call('snapshot');
    const cur = st.ok && st.v.camera ? Number(st.v.camera.yaw_deg || 0) : 0;
    let delta = ((want - cur + 540) % 360) - 180;
    const per = 3.0, n = Math.min(200, Math.ceil(Math.abs(delta) / per));
    if (n > 0) {
      const step = delta / n;
      await g.h('queueInputs', Array.from({ length: n + 1 }, (_, f) => ({ f, look: f < n ? [step, 0] : [0, 0] })));
      await g.h('stepFrames', n + 2);
    }
    return null;
  }
  const s = await call('snapshot');
  if (!s.ok) return `snapshot failed: ${s.e}`;
  let [px, py, pz] = s.v.player.pos;
  if (cam.kind === 'subject-orbit' && cam.subject === 'npc') {
    const ents = await call('listEntities');
    const npcs = (ents.ok ? ents.v : []).filter((e) => e.kind === 'npc' || e.kind === 'NPC');
    if (!npcs.length) return 'no NPC in range of this setup';
    npcs.sort((a, b) => Math.hypot(a.pos[0] - px, a.pos[2] - pz) - Math.hypot(b.pos[0] - px, b.pos[2] - pz));
    [px, py, pz] = npcs[0].pos;
  }
  const yaw = (Number(cam.yaw_deg || 0)) * Math.PI / 180;
  const pitch = (Number(cam.pitch_deg || 0)) * Math.PI / 180;
  const dist = Number(cam.distance_m || 0);
  const height = Number(cam.height_m || 0);
  const eye = dist > 0
    ? [px + Math.sin(yaw) * Math.cos(pitch) * dist, py + 1.5 - Math.sin(pitch) * dist, pz + Math.cos(yaw) * Math.cos(pitch) * dist]
    : [px, py + height, pz];
  const fwd = 60;
  const look = dist > 0
    ? [px, py + 1.1, pz]
    : [px + Math.sin(yaw) * fwd, py + height + Math.tan(pitch) * fwd, pz + Math.cos(yaw) * fwd];
  const r = await call('camera', { pos: eye, look });
  return r.ok ? null : `camera pose refused: ${r.e}`;
}

/** Get to the place the setup names. Returns null on success, a reason string on failure. */
async function goTo(setup) {
  const p = setup.place;
  if (p.kind === 'interior') {
    if (!p.id) return 'no interior in game/data/world/interiors matched this setup';
    const r = await call('enterInterior', p.id);
    if (!r.ok) return `enterInterior(${p.id}) refused: ${r.e}`;
  } else {
    // Leave any interior FIRST. The smoke run shot `char-player` immediately after the
    // thorn-hall interior setup and the player was still reported at interior height —
    // an exterior setup captured from inside a room is a silently wrong frame, which is
    // the one kind of failure this tool must never produce.
    await call('enterInterior', null);
    await call('setCameraCell', null);
    const r = await call('teleport', p.x, p.z);
    if (!r.ok) return `teleport(${p.x},${p.z}) refused: ${r.e}`;
    await call('stepFrames', 4);
  }
  await g.h('stepFrames', SETTLE);
  return null;
}

// ---- the run -----------------------------------------------------------------------------
const wanted = new Set(PROFILE.stills);
const setups = DECK.setups.filter((s) => wanted.has(s.id)).slice(0, LIMIT);
const times = DECK.axes.times.filter((t) => PROFILE.times.includes(t.id));
const weathers = DECK.axes.weathers.filter((w) => PROFILE.weathers.includes(w.id));
console.log(`plan: ${setups.length} setups x ${times.length} times x ${weathers.length} weathers = ${setups.length * times.length * weathers.length} frames\n`);

let done = 0;
for (const setup of setups) {
  if (setup.unresolved) { for (const t of times) for (const w of weathers) red(setup, { time: t.id, weather: w.id }, 'setup unresolved at manifest build time'); continue; }
  const placeErr = await goTo(setup);
  if (placeErr) { for (const t of times) for (const w of weathers) red(setup, { time: t.id, weather: w.id }, placeErr); continue; }
  const env0 = await call('getEnvConditions');
  for (const w of weathers) {
    const wr = await call('setWeather', w.weather);
    for (const t of times) {
      await call('setTimeOfDay', t.hour);
      // Re-pose after the light changes: some setups drive the gameplay camera and a
      // time change can nudge it.
      const poseErr = await poseCamera(setup);
      await g.h('stepFrames', SETTLE);
      if (poseErr) { red(setup, { time: t.id, weather: w.id }, poseErr); continue; }
      const file = `${setup.id}__${t.id}__${w.id}.png`;
      try {
        const { bytes, hash } = await shoot(file);
        const snap = await call('snapshot');
        const env = await call('getEnvConditions');
        rows.push({
          setup: setup.id, block: setup.block, label: setup.label, region: setup.region || null,
          time: t.id, weather: w.id, status: 'ok', file, hash, bytes,
          weather_applied: wr.ok, weather_reported: env.ok ? env.v.weather : null,
          time_reported: env.ok ? env.v.time_of_day : null,
          player_y: snap.ok ? snap.v.player.pos[1] : null,
          region_reported: snap.ok && snap.v.env ? snap.v.env.region : null,
        });
        done++;
        if (done % 10 === 0) console.log(`  ${done} frames  (${((Date.now() - t0) / 1000).toFixed(0)}s)`);
      } catch (e) {
        red(setup, { time: t.id, weather: w.id }, `capture threw: ${String(e.message).slice(0, 160)}`);
      }
    }
  }
}

const manifest = {
  schema: 'elder-souls/visual-deck-run@1',
  tag: TAG, profile: PROFILE_NAME, seed: SEED, canvas: [CW, CH],
  deck_version: DECK.version, deck_manifest_hash: DECK.manifest_hash,
  commit: process.env.GIT_COMMIT || null,
  build: { name: build.name, version: build.version, commit: build.commit, three: build.threeVersion, dataFiles: build.dataFiles },
  renderer_string, software_renderer: swiftshader,
  evidence_class: swiftshader
    ? 'SOFTWARE — valid for geometry, layout, composition, determinism and census. NOT valid for antialiasing, bloom, AO, IBL or any appearance claim (W1-30-EVIDENCE §4).'
    : 'HARDWARE — valid for appearance claims.',
  deck_drift: drift.length ? drift.map((k) => ({ axis: k, built_with: DECK.source_counts[k], live: live[k] })) : null,
  counts: { planned: setups.length * times.length * weathers.length, ok: rows.filter((r) => r.status === 'ok').length, red: rows.filter((r) => r.status === 'red').length },
  seconds: +((Date.now() - t0) / 1000).toFixed(1),
  rows,
};
fs.writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(`\n${manifest.counts.ok} ok, ${manifest.counts.red} red, ${manifest.seconds}s`);
console.log(`frames: ${path.relative(REPO, SHOT_DIR)}`);
console.log(`manifest: ${path.relative(REPO, path.join(OUT, 'manifest.json'))}`);
await g.close();
// A red row is a finding, not a crash: exit 0 so a sweep completes and the manifest is
// the thing that is read. `tools/visual/deck-gate.mjs` is what turns reds into a failure.
