#!/usr/bin/env node
/**
 * w1-30b-probe.mjs — the live instrument for W1-30B's shadow, atmosphere, IBL and rain rows.
 *
 * One browser, many measurements. It consumes W1-30V's Deck manifest (`tools/visual/deck.json`)
 * for its camera stops rather than inventing a shot list — rule 10, and the Deck is the thing that
 * makes "did that change help?" answerable across rounds.
 *
 * WHAT IT MEASURES, AND WHY EACH ONE HAS A CONTROL THAT IS THE PLAUSIBLE WRONG ANSWER
 *
 *  shadow      the fraction of pixels that change when the directional shadow is switched off.
 *              The control is not "no scene" — it is the shipped build's own player-centred 120 m
 *              box (`sky.setFeature('shadowFit', false)`), which is a shadow system that WORKS and
 *              simply does not reach. A control that removed shadows entirely would be red against
 *              a build that had never drawn one, which is the mistake that reported 71% coverage of
 *              a world containing none of the thing being measured.
 *  fog         the fraction that changes when the atmosphere is switched off, plus the same figure
 *              with the height term flattened, which is the "atmosphere has height" control.
 *  probe       the environment texture's real size, type and bake count, read from the renderer.
 *  rain        the mean alpha of precipitation near the camera against far from it — the "rain has
 *              depth" row — read off the live buffer, not off a screenshot.
 *
 * Usage:
 *   node tools/visual/w1-30b-probe.mjs --tag before --sites spawn,vista-blackwood --hardware
 *   node tools/visual/w1-30b-probe.mjs --tag after  --times 8,13,19.5 --weathers clear,rain
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

const DECK = JSON.parse(fs.readFileSync(path.join(REPO, 'tools/visual/deck.json'), 'utf8'));
const TAG = String(args.tag || 'w1-30b');
const OUT = path.resolve(REPO, args.out || `reports/visual-truth/w1-30b/${TAG}`);
fs.mkdirSync(path.join(OUT, 'frames'), { recursive: true });
const [CW, CH] = String(args.canvas || '1280x720').split('x').map(Number);
const SEED = Number(args.seed || DECK.capture.seed);
const HW = args.hardware === true || process.env.VT_HARDWARE_GPU === '1';
const TIMES = String(args.times || '8,13,19.5').split(',').map(Number);
const WEATHERS = String(args.weathers || 'clear,rain').split(',');
const SITES = String(args.sites || 'spawn,street-lilmoth,approach-lilmoth,vista-blackwood,eye-blackwood,vista-salt-hills,vista-deep-marshes,street-gideon,approach-stormhold').split(',');

const { PNG } = await import(path.join(REPO, 'tools/node_modules/pngjs/lib/png.js'));

const g = await launchGame({ entry: 'game/index.html', width: CW, height: CH, hardwareGpu: HW });
await g.h('ready');
await g.page.evaluate(({ w, h }) => {
  const c = document.getElementById('view'); c.width = w; c.height = h;
  window.__ENGINE.renderer.setSize(w, h);
}, { w: CW, h: CH });
await g.h('setSeed', SEED);

const renderer_string = await g.page.evaluate(() => {
  try {
    const gl = document.createElement('canvas').getContext('webgl2');
    if (!gl) return 'unavailable: no webgl2 context';
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    return String(ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER));
  } catch (e) { return `unavailable: ${e.message}`; }
});
const software = /swiftshader|llvmpipe|software|mesa/i.test(renderer_string) || /^unavailable/i.test(renderer_string);
console.log(`renderer: ${renderer_string}${software ? '   *** SOFTWARE — not valid for an appearance claim (W1-30-EVIDENCE §4) ***' : ''}`);

async function shot(file) {
  const d = await g.h('screenshot');
  const buf = Buffer.from(String(d).replace(/^data:image\/png;base64,/, ''), 'base64');
  if (file) fs.writeFileSync(path.join(OUT, 'frames', file), buf);
  return buf;
}
function diff(a, b) {
  const A = PNG.sync.read(a), B = PNG.sync.read(b);
  let n = 0, sum = 0; const tot = A.data.length / 4;
  for (let i = 0; i < A.data.length; i += 4) {
    const d = Math.abs(A.data[i] - B.data[i]) + Math.abs(A.data[i + 1] - B.data[i + 1]) + Math.abs(A.data[i + 2] - B.data[i + 2]);
    if (d > 6) n++; sum += d;
  }
  return { pct: +(n / tot * 100).toFixed(3), mean: +(sum / tot).toFixed(3) };
}
/** Mean luminance of the lower / middle / upper thirds — the "atmosphere has height" instrument. */
function thirds(buf) {
  const A = PNG.sync.read(buf); const h = A.height, wpx = A.width;
  const band = [0, 0, 0], count = [0, 0, 0];
  for (let y = 0; y < h; y++) {
    const b = y < h / 3 ? 2 : (y < 2 * h / 3 ? 1 : 0); // 0 = lower third of the IMAGE
    for (let x = 0; x < wpx; x++) {
      const i = (y * wpx + x) * 4;
      band[b] += 0.2126 * A.data[i] + 0.7152 * A.data[i + 1] + 0.0722 * A.data[i + 2];
      count[b]++;
    }
  }
  return { lower: +(band[0] / count[0]).toFixed(2), middle: +(band[1] / count[1]).toFixed(2), upper: +(band[2] / count[2]).toFixed(2) };
}

const setFeature = (name, on) => g.page.evaluate(({ n, o }) => window.__ENGINE.renderer.sky.setFeature(n, o), { n: name, o: on });
const step = (n) => g.h('stepFrames', n);

async function goTo(site) {
  if (site === 'spawn') { await step(30); return null; }
  const s = DECK.setups.find((x) => x.id === site);
  if (!s) return `no Deck setup '${site}'`;
  const where = await g.h('whereAmI').catch(() => null);
  if (where && where.interior) await g.h('exitInterior').catch(() => {});
  if (s.place.kind === 'interior') { await g.h('enterInterior', s.place.id); await step(20); return null; }
  await g.h('teleport', s.place.x, s.place.z);
  await step(30);
  const snap = await g.h('snapshot');
  const [px, py, pz] = snap.player.pos;
  const c = s.camera;
  const yaw = (c.yaw_deg || 0) * Math.PI / 180, pitch = (c.pitch_deg || 0) * Math.PI / 180;
  const dist = c.distance_m || 0, height = c.height_m || 0, fwd = 60;
  const eye = dist > 0
    ? [px + Math.sin(yaw) * Math.cos(pitch) * dist, py + 1.5 - Math.sin(pitch) * dist, pz + Math.cos(yaw) * Math.cos(pitch) * dist]
    : [px, py + height, pz];
  const look = dist > 0 ? [px, py + 1.1, pz]
    : [px + Math.sin(yaw) * fwd, py + height + Math.tan(pitch) * fwd, pz + Math.cos(yaw) * fwd];
  await g.h('camera', { pos: eye, look });
  await step(2);
  return null;
}

const out = {
  tag: TAG, renderer_string, software, seed: SEED, canvas: [CW, CH],
  build: g.buildInfo || null, pageErrors: [], rows: [],
};

for (const site of SITES) {
  const err = await goTo(site);
  if (err) { out.rows.push({ site, error: err }); console.log(`  RED  ${site} — ${err}`); continue; }
  for (const weather of WEATHERS) {
    await g.h('setWeather', weather);
    for (const t of TIMES) {
      await g.h('setTimeOfDay', t);
      await step(10);
      const stem = `${site}-${weather}-t${String(t).replace('.', '')}`;
      const base = await shot(`${stem}.png`);
      const row = { site, weather, time: t, frame: `${stem}.png`, hash: crypto.createHash('sha256').update(base).digest('hex').slice(0, 16) };
      row.thirds = thirds(base);
      row.state = await g.page.evaluate(() => {
        const R = window.__ENGINE.renderer, sky = R.sky, sc = R.scene;
        return {
          cell: R.cell,
          shadow: sky.shadowReport(),
          env: sky.environmentReport(),
          fog: { sigma0: +sc.fog.sigma0.toFixed(6), heightFalloff: +sc.fog.heightFalloff.toFixed(1), colour: sc.fog.color.getHexString() },
          recipe: R.lightingFrame ? R.lightingFrame.recipeId : null,
          // What is actually lighting the frame, in the renderer's own units. The plan's note
          // that "ambient is doing IBL's job" is only checkable against these four numbers.
          lights: { sun: +sky.sun.intensity.toFixed(3), moon: +sky.moon.intensity.toFixed(3),
            hemi: +sky.hemi.intensity.toFixed(3), fill: +sky.fill.intensity.toFixed(3),
            envIntensity: sc.environmentIntensity },
          rain: (() => {
            const r = sky.rain; if (!r.visible) return null;
            const pos = r.geometry.attributes.position.array, col = r.geometry.attributes.color.array;
            const n = r.geometry.drawRange.count / 2;
            let nearA = 0, nearN = 0, farA = 0, farN = 0;
            for (let i = 0; i < n; i++) {
              const d = Math.hypot(pos[i * 6], pos[i * 6 + 1], pos[i * 6 + 2]);
              const a = col[i * 8 + 3];
              if (d <= 8) { nearA += a; nearN++; } else if (d >= 40) { farA += a; farN++; }
            }
            return { streaks: n, near_alpha: nearN ? +(nearA / nearN).toFixed(4) : null, far_alpha: farN ? +(farA / farN).toFixed(4) : null,
              ratio: (nearN && farN && nearA > 0) ? +((farA / farN) / (nearA / nearN)).toFixed(3) : null };
          })(),
        };
      });
      // ---- the sabotage arms, each its own control -----------------------------------------
      const arms = {};
      for (const [name, feature] of [['shadow', 'shadows'], ['atmosphere', 'atmosphere'], ['height', 'heightFog'], ['probe', 'probe'], ['rainDepth', 'rainDepth']]) {
        if (name === 'rainDepth' && !row.state.rain) continue;
        await setFeature(feature, false); await step(3);
        const b = await shot(null);
        arms[name] = diff(base, b);
        await setFeature(feature, true); await step(3);
      }
      // The shadow control that is the plausible wrong answer rather than the trivial one: the
      // pre-W1-30B player-centred 120 m box, a shadow system that draws and does not reach.
      const keepArms = weather === WEATHERS[0] && t === TIMES[Math.min(1, TIMES.length - 1)];

      // ---- the atmosphere null control, executed exactly rather than approximated -----------
      // Not "fog off" — that is the trivial control. This puts three's stock `FogExp2` chunks
      // back, forces every material to recompile against them, and installs a real `FogExp2`
      // carrying the density the shipped build computed: `extinction * (1 + fogDensity/0.0026 *
      // 0.22) + 1.978 / sightline_m`. Same hardware, same camera, same frame, the model somebody
      // actually shipped. It is restored immediately afterwards.
      if (args.stockArm) {
        await g.page.evaluate(async () => {
          const THREE = await import('/game/vendor/three/three.module.js');
          const sky = await import('/game/src/render/sky.js');
          const R = window.__ENGINE.renderer, sc = R.scene;
          window.__W1B_FOG = sc.fog;
          const w = sky.WEATHER[window.__ENGINE.sim.env.weather];
          const ext = R.sky._lastRegionExtinction || 0.0058;
          const sight = window.__ENGINE.sim.env.sightlineM || 0;
          const base = ext * (1 + w.fogDensity / 0.0026 * 0.22);
          const density = sight > 0 ? base + 1.978 / sight : base;
          sky.restoreStockAtmosphere();
          const f = new THREE.FogExp2(sc.fog.color.getHex(), density);
          sc.fog = f;
          sc.traverse((o) => { if (o.material) for (const m of [].concat(o.material)) m.needsUpdate = true; });
        });
        await step(4);
        const stockFrame = await shot(`${stem}-stockfog.png`);
        arms.stockAtmosphere = diff(base, stockFrame);
        await g.page.evaluate(async () => {
          const sky = await import('/game/src/render/sky.js');
          const R = window.__ENGINE.renderer, sc = R.scene;
          sky.installAtmosphereModel();
          sc.fog = window.__W1B_FOG;
          sc.traverse((o) => { if (o.material) for (const m of [].concat(o.material)) m.needsUpdate = true; });
        });
        await step(4);
      }
      await setFeature('shadowFit', false); await step(3);
      const oldBox = await shot(keepArms ? `${stem}-oldbox.png` : null);
      arms.shadowReach = diff(base, oldBox);
      await setFeature('shadowFit', true); await step(3);

      // ---- THE DIAGNOSTIC ARM, and it is the one that matters on a vista -------------------
      // A shadow volume that reaches 150 m still draws nothing if the geometry inside it is
      // flagged not to cast. `game/src/world/province.js` sets `castShadow = false` on the
      // streamed vegetation instances (lines 766, 857, 1204, 2249) and never sets it at all on
      // the terrain tiles (`ground` at 1333, `ground-skin` at 995, `province-far` at 564, which
      // additionally has `receiveShadow = false`). So a region vista contains no shadow caster
      // and no far-terrain receiver, whatever the light does.
      //
      // This arm turns those flags on IN THE PAGE, for one frame, purely to measure the size of
      // the effect. Nothing is shipped by it: `province.js` is not W1-30B's file and the flags are
      // restored immediately. It exists so the report can say how much of the vista defect is
      // W1-30B's (the volume) and how much belongs to whoever owns the world meshes, with a
      // number rather than an assertion.
      await g.page.evaluate(() => {
        const R = window.__ENGINE.renderer;
        window.__W1B_FLAGS = [];
        R.scene.traverse((o) => {
          if (!(o.isMesh || o.isInstancedMesh)) return;
          if (o.castShadow && o.receiveShadow) return;
          window.__W1B_FLAGS.push([o, o.castShadow, o.receiveShadow]);
          o.castShadow = true; o.receiveShadow = true;
        });
      });
      await step(3);
      const allCast = await shot(keepArms ? `${stem}-allcast.png` : null);
      arms.worldCastersOn = diff(base, allCast);
      await g.page.evaluate(() => {
        for (const [o, c, r] of (window.__W1B_FLAGS || [])) { o.castShadow = c; o.receiveShadow = r; }
        window.__W1B_FLAGS = [];
      });
      await step(3);
      row.arms = arms;
      out.rows.push(row);
      console.log(`  ${stem}  shadow ${arms.shadow.pct}%  fog ${arms.atmosphere.pct}%  height ${arms.height.pct}%  probe ${arms.probe.pct}%  reach ${arms.shadowReach.pct}%  worldCasters ${arms.worldCastersOn.pct}%  σ=${row.state.fog.sigma0} H=${row.state.fog.heightFalloff} ${row.state.recipe} L=${row.thirds.lower}/${row.thirds.middle}/${row.thirds.upper}`);
    }
  }
}

// ---- motion ---------------------------------------------------------------------------------
// `orchestration/OWNER-DIRECTIVES-2026-08-14.md` §2: many stills AND motion sequences. A still
// cannot show whether the shadow volume crawls as the camera moves, whether the cascade-free fit
// has a seam a walk passes through, or whether the day-night probe transitions or steps. Two
// sequences, both deterministic, both reviewed as contact sheets (`tools/visual/contact-sheet.mjs`,
// W1-30V's tool — consumed, not reimplemented).
if (args.motion) {
  const site = String(args.motion === true ? 'street-lilmoth' : args.motion);
  const err = await goTo(site);
  if (err) console.log(`  motion RED — ${err}`);
  else {
    const seqDir = path.join(OUT, 'motion');
    fs.mkdirSync(seqDir, { recursive: true });
    await g.h('setWeather', 'clear');
    // day -> night, 48 frames over 24 h. The probe rebuilds on a bucket change, so this is also
    // the sequence that shows whether an IBL rebake is a visible step.
    const lapse = [];
    for (let i = 0; i < 48; i++) {
      const hour = i / 48 * 24;
      await g.h('setTimeOfDay', hour);
      await step(2);
      const d = await g.h('screenshot');
      const buf = Buffer.from(String(d).replace(/^data:image\/png;base64,/, ''), 'base64');
      fs.writeFileSync(path.join(seqDir, `daynight-${String(i).padStart(3, '0')}.png`), buf);
      lapse.push({ i, hour: +hour.toFixed(2), bytes: buf.length, hash: crypto.createHash('sha256').update(buf).digest('hex').slice(0, 16) });
    }
    // walk forward 180 frames at noon, capturing every third: the sequence a shadow-volume seam
    // or a swimming shadow edge would show up in and a still never could.
    await g.h('setTimeOfDay', 13); await step(4);
    await g.h('camera', { mode: 'gameplay' }).catch(() => {});
    const walk = [];
    for (let i = 0; i < 60; i++) {
      await g.h('queueInputs', Array.from({ length: 3 }, (_, f) => ({ f, move: [0, 1] })));
      await step(3);
      const d = await g.h('screenshot');
      const buf = Buffer.from(String(d).replace(/^data:image\/png;base64,/, ''), 'base64');
      fs.writeFileSync(path.join(seqDir, `walk-${String(i).padStart(3, '0')}.png`), buf);
      walk.push({ i, frame: i * 3, hash: crypto.createHash('sha256').update(buf).digest('hex').slice(0, 16) });
    }
    out.motion = { site, daynight: lapse, walk };
    console.log(`  motion: ${lapse.length} day-night frames + ${walk.length} walk frames at ${site}`);
  }
}

out.pageErrors = g.errors.slice(0, 20);
out.consoleErrors = g.console.filter((c) => c.type === 'error').slice(0, 20);
fs.writeFileSync(path.join(OUT, 'probe.json'), JSON.stringify(out, null, 2));
console.log(`\nwrote ${path.join(OUT, 'probe.json')} — ${out.rows.length} rows, ${out.pageErrors.length} page errors`);
await g.close();
