#!/usr/bin/env node
/**
 * f10-r12c-frametime.mjs — THE BUDGET CLAUSE, AT A SAMPLE SIZE THAT FITS THIS BOX.
 *
 * S59's budget clause on the r11 remedy: *"publish the frame time at the Lilmoth stand before and
 * after, and it must not rise by more than 5%."* `W1-F10-r12` built the pair against a control clone
 * at `caa8b01b` and ran it twice; neither arm finished, at 30 warm + 240 timed frames per arm.
 *
 * TWO CHANGES, AND THE SECOND MATTERS MORE THAN THE FIRST.
 *
 * 1. **Sample size is a parameter**, so a smaller run with a stated confidence beats an unmeasured
 *    claim.
 * 2. **The BEFORE arm is not `caa8b01b`.** `git diff --stat caa8b01b..HEAD -- game/` shows
 *    `sky.js` (98 lines) and `lighting-recipes.js` (8) changed too — a sibling's F4 work — so a pair
 *    against that base measures F10's stance advance AND F4's sky together and attributes the sum to
 *    F10. The isolating control is THIS tree with ONE branch disabled: `poseStatic`'s re-solve
 *    `else if`, which is the entire per-frame cost this round added. Everything else — sky, lighting,
 *    geometry, the first solve, the terrain conform — is bit-identical between the arms.
 *
 * HAZARDS §22: each arm runs THE COPY OF THIS TOOL THAT LIVES IN ITS OWN TREE, against that tree's
 * own `game/`. Neither clone has a `.git`, so `commit` reads `unknown` in both and cannot separate
 * them — so this tool publishes the **sha256 of the `game/src/render/actor.js` it actually loaded**,
 * which can. An arm whose hash matches the other arm's is not a pair and the report says so.
 *
 * Usage:
 *   node tools/visual/f10-r12c-frametime.mjs --arm after  --frames 60 --out DIR
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const args = {};
for (let i = 2; i < process.argv.length; i++) {
  if (!process.argv[i].startsWith('--')) continue;
  const body = process.argv[i].slice(2);
  const eq = body.indexOf('=');
  if (eq >= 0) { args[body.slice(0, eq)] = body.slice(eq + 1); continue; }
  args[body] = (process.argv[i + 1] && !process.argv[i + 1].startsWith('--')) ? process.argv[++i] : true;
}
const log = (...m) => process.stdout.write(`${m.join(' ')}\n`);
const HERE = path.dirname(new URL(import.meta.url).pathname);
const REPO = path.resolve(HERE, '../..');
const OUT = path.resolve(String(args.out || REPO));
fs.mkdirSync(OUT, { recursive: true });
const ARM = String(args.arm || 'unlabelled');
const WARM = Number(args.warm ?? 20);
const N = Number(args.frames ?? 60);

const actorSrc = fs.readFileSync(path.join(REPO, 'game/src/render/actor.js'));
const actorSha = crypto.createHash('sha256').update(actorSrc).digest('hex');

const { launchForCapture, resolveGpuMode } = await import(`${REPO}/tools/visual/lib/gpu-launch.mjs`);
const { rendererBanner } = await import(`${REPO}/tools/visual/lib/renderer-class.mjs`);
const { g, attestation } = await launchForCapture({
  mode: resolveGpuMode(args), requireHardware: false,
  entry: 'game/index.html', width: Number(args.w || 1280), height: Number(args.h || 720), log,
});
await g.page.waitForFunction(() => window.__HARNESS, null, { timeout: 180000 });
await g.h('ready');
log(rendererBanner(attestation));

const call = async (m, ...a) => g.page.evaluate(async ({ method, callArgs }) => {
  const H = window.__HARNESS;
  if (!H || typeof H[method] !== 'function') return { __err: `${method} unavailable` };
  try { return { __ok: await H[method](...callArgs) }; } catch (e) { return { __err: String(e && e.message || e) }; }
}, { method: m, callArgs: a });

const STAND = { x: Number(args.x ?? 2785.6), z: Number(args.z ?? 5047.0) };
await call('teleport', STAND.x, STAND.z);
await call('stepFrames', 20);

const npc = await g.page.evaluate(() => {
  let n = 0, v = 0; window.__ENGINE.renderer.scene.traverse((o) => { if (o && o.name && String(o.name).startsWith('npc:')) { n++; if (o.visible) v++; } }); return { meshes: n, visible: v };
});

const timeIt = async (frames) => g.page.evaluate(async (f) => {
  const E = window.__ENGINE;
  const s = [];
  for (let i = 0; i < f; i++) {
    const t0 = performance.now();
    E.stepFrames(1); E.loop.renderNow();
    s.push(performance.now() - t0);
  }
  const sorted = s.slice().sort((a, b) => a - b);
  const mean = s.reduce((a, b) => a + b, 0) / s.length;
  const sd = Math.sqrt(s.reduce((a, b) => a + (b - mean) * (b - mean), 0) / (s.length - 1));
  return {
    n: s.length, mean, sd, sem: sd / Math.sqrt(s.length),
    median: sorted[Math.floor(sorted.length / 2)], p90: sorted[Math.floor(sorted.length * 0.9)],
    min: sorted[0], max: sorted[sorted.length - 1], samples_ms: s.map((x) => +x.toFixed(3)),
  };
}, frames);

await timeIt(WARM);
const r = await timeIt(N);
await g.close();

const out = {
  tool: 'tools/visual/f10-r12c-frametime.mjs', arm: ARM,
  tree_root: REPO, actor_js_sha256: actorSha,
  generated: new Date().toISOString(), renderer: rendererBanner(attestation),
  stand: STAND, npc, warm_frames: WARM, timed_frames: N, frame_time_ms: r,
};
fs.writeFileSync(path.join(OUT, `frame-time-${ARM}.json`), JSON.stringify(out, null, 1));
const brief = JSON.parse(JSON.stringify(out)); delete brief.frame_time_ms.samples_ms;
process.stdout.write(JSON.stringify(brief, null, 2) + '\n');
