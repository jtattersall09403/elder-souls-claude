#!/usr/bin/env node
/**
 * f10-r12c-motion-truth.mjs — THE F10 r12 CRITIC'S OWN CAPTURE, and it exists for one reason.
 *
 * `W1-F10-r12`'s pixel evidence rests on a "required-to-disagree control of the frame compared with
 * ITSELF at exactly 0 changed pixels ... which is what says the capture is deterministic". Read the
 * instrument: `f10-r12-motion-pixels.mjs:104` computes `diff(imgs[0].img, imgs[0].img)` — the SAME
 * decoded buffer against itself. That is an identity, not a control. It reads 0 by arithmetic, it
 * cannot fail, and it says nothing whatever about whether the renderer produces the same pixels
 * twice. This project's whole method rests on arms that are able to go red (HAZARDS §0).
 *
 * So this tool shoots the control the claim needs:
 *
 *   • **motion-t000.png** and **motion-t000r.png** — the SAME SIM FRAME, rendered twice and captured
 *     twice, `stepFrames(0)` between them (`engine.js:stepFrames` accepts 0 and still calls
 *     `loop.renderNow()`). Two independent trips through the rasteriser and two independent PNG
 *     encodes. If THAT reads 0 changed pixels, the capture is deterministic and the motion deltas
 *     are the scene. If it does not, every changed-pixel number in the round is noise.
 *   • **motion-t024/048/072.png** — the same camera, 24 sim frames apart, as the round shot them.
 *   • **ATTRIBUTION**, which the round does not do at all: every drawn NPC's screen-space box is
 *     computed from its bone world positions through the live camera matrices at each shot, so the
 *     changed pixels can be asked the only question that matters — are they ON THE PEOPLE, or are
 *     they the water, the sky, or a shimmer in the foliage? A 2% frame change proves motion of
 *     SOMETHING; it is not evidence about a crowd until it is located.
 *   • Orbit bearings for the character directive, which binds a critic exactly as it binds a builder.
 *
 * SwiftShader unless a Pod is rented: geometry, composition, determinism and census only
 * (`W1-30-EVIDENCE` §4). No appearance claim is made here.
 *
 * Usage: node tools/visual/f10-r12c-motion-truth.mjs --out <dir> [--x 2785.6 --z 5047] [--bearings 0,90,180]
 */
import fs from 'node:fs';
import path from 'node:path';

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
const OUT = path.resolve(REPO, String(args.out || 'reports/visual-truth/f10-r12c-motion-truth'));
fs.mkdirSync(OUT, { recursive: true });

const { launchForCapture, resolveGpuMode } = await import(`${REPO}/tools/visual/lib/gpu-launch.mjs`);
const { rendererBanner } = await import(`${REPO}/tools/visual/lib/renderer-class.mjs`);
const { g, attestation } = await launchForCapture({
  mode: resolveGpuMode(args), requireHardware: args['require-hardware'] === true,
  entry: 'game/index.html', width: Number(args.w || 1280), height: Number(args.h || 720), log,
});
await g.page.waitForFunction(() => window.__HARNESS, null, { timeout: 180000 });
await g.h('ready');
log(rendererBanner(attestation));

const call = async (m, ...a) => {
  const res = await g.page.evaluate(async ({ method, callArgs }) => {
    const H = window.__HARNESS;
    if (!H || typeof H[method] !== 'function') return { __err: `${method} unavailable` };
    try { return { __ok: await H[method](...callArgs) }; } catch (e) { return { __err: String(e && e.message || e) }; }
  }, { method: m, callArgs: a });
  if (res && res.__err) return { ok: false, e: res.__err };
  return { ok: true, v: res ? res.__ok : undefined };
};

const STAND = { x: Number(args.x ?? 2785.6), z: Number(args.z ?? 5047.0) };
const where = await call('whereAmI');
if (where.ok && where.v && where.v.interior) await call('exitInterior');
await call('teleport', STAND.x, STAND.z);
await call('stepFrames', 20);

/** Every drawn NPC's screen box, computed from its BONE world positions through the LIVE camera
 *  matrices (HAZARDS §27 — read a bone, not the group). Plain matrix maths so no THREE import is
 *  needed inside the page. */
const readBoxes = () => g.page.evaluate(() => {
  const E = window.__ENGINE; const R = E && E.renderer;
  if (!R) return { error: 'no renderer' };
  R.scene.updateMatrixWorld(true);
  R.camera.updateMatrixWorld(true);
  const V = R.camera.matrixWorldInverse.elements, P = R.camera.projectionMatrix.elements;
  const W = R.domElement ? R.domElement.width : (R.renderer && R.renderer.domElement ? R.renderer.domElement.width : 0);
  const H = R.domElement ? R.domElement.height : (R.renderer && R.renderer.domElement ? R.renderer.domElement.height : 0);
  const mul = (m, v) => [
    m[0] * v[0] + m[4] * v[1] + m[8] * v[2] + m[12] * v[3],
    m[1] * v[0] + m[5] * v[1] + m[9] * v[2] + m[13] * v[3],
    m[2] * v[0] + m[6] * v[1] + m[10] * v[2] + m[14] * v[3],
    m[3] * v[0] + m[7] * v[1] + m[11] * v[2] + m[15] * v[3],
  ];
  const rows = [];
  R.scene.traverse((o) => {
    if (!o || !o.name || !String(o.name).startsWith('npc:')) return;
    const A = o.userData && o.userData.actor; const S = A && A.built;
    if (!S || !S.bones) return;
    let minx = 1e9, maxx = -1e9, miny = 1e9, maxy = -1e9, any = false;
    for (const b of S.bones) {
      if (!b) continue;
      const e = b.matrixWorld.elements;
      const c = mul(P, mul(V, [e[12], e[13], e[14], 1]));
      if (c[3] <= 0) continue;
      const sx = (c[0] / c[3] * 0.5 + 0.5), sy = (1 - (c[1] / c[3] * 0.5 + 0.5));
      any = true;
      if (sx < minx) minx = sx; if (sx > maxx) maxx = sx;
      if (sy < miny) miny = sy; if (sy > maxy) maxy = sy;
    }
    if (!any) return;
    rows.push({
      eid: String(o.name).slice(4), visible: !!o.visible,
      world_xz: [+o.position.x.toFixed(2), +o.position.z.toFixed(2)],
      // normalised 0..1 screen box, so it is resolution-independent
      box: [+minx.toFixed(5), +miny.toFixed(5), +maxx.toFixed(5), +maxy.toFixed(5)],
    });
  });
  return { rows, canvas: [W, H], sim_frame: E.sim.frame };
});

await call('setUIVisible', false);
const shots = [];
const shoot = async (file, meta) => {
  const shot = await call('screenshot');
  let bytes = null;
  if (shot.ok && shot.v) {
    const buf = Buffer.from(String(shot.v).replace(/^data:image\/png;base64,/, ''), 'base64');
    fs.writeFileSync(path.join(OUT, file), buf); bytes = buf.length;
  }
  const boxes = await readBoxes();
  shots.push({ file, bytes, ...meta, sim_frame: boxes.sim_frame, canvas: boxes.canvas, boxes: (boxes.rows || []).filter((r) => r.visible) });
  fs.writeFileSync(path.join(OUT, 'shots.partial.json'), JSON.stringify({ INCOMPLETE: true, shots }, null, 1));
  log(`  shot ${file} bytes=${bytes} frame=${boxes.sim_frame}`);
};

// the densest knot of the genuinely drawn settlement crowd, same definition the r11 critic used
const crowd = await g.page.evaluate((stand) => {
  const E = window.__ENGINE; const R = E.renderer;
  R.scene.updateMatrixWorld(true);
  const pts = [];
  R.scene.traverse((o) => {
    if (!o || !o.name || !String(o.name).startsWith('npc:')) return;
    if (!o.visible) return;
    if (Math.hypot(o.position.x - stand.x, o.position.z - stand.z) > 200) return;
    pts.push([o.position.x, o.position.y, o.position.z]);
  });
  return pts;
}, STAND);
let best = null, bestN = -1;
for (const p of crowd) {
  const n = crowd.filter((q) => Math.hypot(q[0] - p[0], q[2] - p[2]) <= 8).length;
  if (n > bestN) { bestN = n; best = p; }
}
const near = crowd.filter((q) => Math.hypot(q[0] - best[0], q[2] - best[2]) <= 8);
const knot = {
  cx: near.reduce((s, q) => s + q[0], 0) / near.length,
  cz: near.reduce((s, q) => s + q[2], 0) / near.length,
  n: near.length,
};
const cy = crowd.reduce((s, q) => s + q[1], 0) / crowd.length;
log(`knot ${knot.cx.toFixed(3)},${knot.cz.toFixed(3)} n=${knot.n} drawn_local=${crowd.length}`);

const D = Number(args.dist ?? 9), EY = Number(args.eye ?? 2.4), FOV = Number(args.fov ?? 55);
const orbitPos = (b) => [knot.cx + Math.sin(b * Math.PI / 180) * D, cy + EY, knot.cz + Math.cos(b * Math.PI / 180) * D];
const LOOK = [knot.cx, cy + 1.1, knot.cz];

// ── MOTION, with the control the round owed itself ──────────────────────────────────────────
const MB = Number(args.mbearing ?? 45);
await call('camera', { pos: orbitPos(MB), look: LOOK, fov: FOV });
await call('stepFrames', 2);
await shoot('motion-t000.png', { kind: 'motion', frame_offset: 0, camera_pos: orbitPos(MB).map((v) => +v.toFixed(3)), look: LOOK.map((v) => +v.toFixed(3)), fov: FOV });
await call('stepFrames', 0);            // SAME sim frame, rendered again
await shoot('motion-t000r.png', { kind: 'DETERMINISM CONTROL — same sim frame, re-rendered and re-captured', frame_offset: 0, camera_pos: orbitPos(MB).map((v) => +v.toFixed(3)), look: LOOK.map((v) => +v.toFixed(3)), fov: FOV });
for (const t of [24, 48, 72]) {
  await call('stepFrames', 24);
  await shoot(`motion-t${String(t).padStart(3, '0')}.png`, { kind: 'motion', frame_offset: t, camera_pos: orbitPos(MB).map((v) => +v.toFixed(3)), look: LOOK.map((v) => +v.toFixed(3)), fov: FOV });
}

// ── ORBIT, for the character directive: a critic must look at the thing, from several angles ──
for (const b of String(args.bearings ?? '0,90,180').split(',').map(Number)) {
  await call('camera', { pos: orbitPos(b), look: LOOK, fov: FOV });
  await call('stepFrames', 2);
  await shoot(`orbit-b${String(b).padStart(3, '0')}.png`, { kind: 'orbit', bearing: b, dist_m: D, eye_m: EY, camera_pos: orbitPos(b).map((v) => +v.toFixed(3)), look: LOOK.map((v) => +v.toFixed(3)), fov: FOV });
}

await call('camera', { mode: 'gameplay' });
await call('setUIVisible', true);
await g.close();

fs.writeFileSync(path.join(OUT, 'shots.json'), JSON.stringify({
  tool: 'tools/visual/f10-r12c-motion-truth.mjs',
  generated: new Date().toISOString(),
  renderer: rendererBanner(attestation),
  stand: STAND, knot, cy: +cy.toFixed(3), drawn_local: crowd.length,
  shots,
}, null, 1));
log(`wrote ${path.join(OUT, 'shots.json')}`);
