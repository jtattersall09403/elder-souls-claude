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
      await setFeature('shadowFit', false); await step(3);
      const oldBox = await shot(`${stem}-oldbox.png`);
      arms.shadowReach = diff(base, oldBox);
      await setFeature('shadowFit', true); await step(3);
      row.arms = arms;
      out.rows.push(row);
      console.log(`  ${stem}  shadow ${arms.shadow.pct}%  fog ${arms.atmosphere.pct}%  height ${arms.height.pct}%  probe ${arms.probe.pct}%  reach ${arms.shadowReach.pct}%  σ=${row.state.fog.sigma0} H=${row.state.fog.heightFalloff} ${row.state.recipe}`);
    }
  }
}

out.pageErrors = g.errors.slice(0, 20);
out.consoleErrors = g.console.filter((c) => c.type === 'error').slice(0, 20);
fs.writeFileSync(path.join(OUT, 'probe.json'), JSON.stringify(out, null, 2));
console.log(`\nwrote ${path.join(OUT, 'probe.json')} — ${out.rows.length} rows, ${out.pageErrors.length} page errors`);
await g.close();
