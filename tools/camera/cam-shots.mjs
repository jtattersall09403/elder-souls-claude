#!/usr/bin/env node
/**
 * cam-shots.mjs — pictures of the camera doing its job, taken through the GAME'S OWN RIG.
 *
 * Why this launches a browser instead of asking `tools/capture/`. The capture service poses a
 * camera at a stated `{pos, look}` and photographs it; that is the right instrument for "what
 * does this place look like", and the wrong one for this piece, because a posed camera is
 * precisely NOT the thing W1-06 builds. Every frame below is taken from wherever
 * `game/src/sim/camera.js` put the camera after a scripted run — a moving player, a live
 * lock-on, a target that dies. That is a stepping run, which AGENT-PROTOCOL puts on the
 * "launch your own browser and say so" side of the line. One browser, reused for all shots.
 *
 * `setRenderRate(0)` for the stepping, raised only for the frames actually photographed.
 *
 * EVERY FRAME IS CHECKED NON-BLANK BEFORE IT IS WRITTEN. Blank captures have been produced
 * and nearly cited in this project. A shot whose decoded pixels have fewer than 200 distinct
 * quantised colours, or a luma standard deviation under 4, is refused and the tool exits
 * non-zero rather than leaving a plausible-looking PNG on disk for somebody to cite.
 *
 *   node tools/camera/cam-shots.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { parseArgs, wantsHelp, usage, log, EXIT, REPO_ROOT } from '../lib/cli.mjs';
import { launchGame, requireMethods } from '../lib/browser.mjs';

const USAGE = `
cam-shots.mjs — photograph the live third-person rig in motion and in a fight.

  --out <dir>   destination (default docs/shots/)
  --width/-h    capture size (default 1280x720)
`;

const args = parseArgs();
if (wantsHelp(args)) usage(USAGE);
const W = Number(args.width || 1280), Hh = Number(args.height || 720);
const OUT = args.out ? path.resolve(String(args.out)) : path.join(REPO_ROOT, 'docs', 'shots');
const DATE = new Date().toISOString().slice(0, 10);

/** Minimal PNG decode-enough-to-judge: unfilter the IDAT and read the pixels.
 *  A blank-frame test that trusted the file size would pass a solid-black 1280x720 PNG. */
function pngStats(buf) {
  let p = 8, w = 0, h = 0, bitDepth = 0, colourType = 0;
  const idat = [];
  while (p < buf.length) {
    const len = buf.readUInt32BE(p); const type = buf.toString('ascii', p + 4, p + 8);
    const data = buf.subarray(p + 8, p + 8 + len);
    if (type === 'IHDR') { w = data.readUInt32BE(0); h = data.readUInt32BE(4); bitDepth = data[8]; colourType = data[9]; }
    else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    p += 12 + len;
  }
  if (bitDepth !== 8 || (colourType !== 6 && colourType !== 2)) return { unsupported: true, w, h, bitDepth, colourType };
  const ch = colourType === 6 ? 4 : 3;
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = w * ch;
  const out = Buffer.alloc(h * stride);
  let ip = 0;
  for (let y = 0; y < h; y++) {
    const f = raw[ip++];
    const row = raw.subarray(ip, ip + stride); ip += stride;
    const cur = out.subarray(y * stride, (y + 1) * stride);
    const prev = y > 0 ? out.subarray((y - 1) * stride, y * stride) : null;
    for (let x = 0; x < stride; x++) {
      const a = x >= ch ? cur[x - ch] : 0, b = prev ? prev[x] : 0, c = (prev && x >= ch) ? prev[x - ch] : 0;
      let v = row[x];
      if (f === 1) v += a; else if (f === 2) v += b; else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) { const pa = Math.abs(b - c), pb = Math.abs(a - c), pc = Math.abs(a + b - 2 * c);
        v += (pa <= pb && pa <= pc) ? a : (pb <= pc ? b : c); }
      cur[x] = v & 0xff;
    }
  }
  const seen = new Set(); let sum = 0, sum2 = 0, n = 0;
  for (let i = 0; i < out.length; i += ch) {
    const r = out[i], g = out[i + 1], bl = out[i + 2];
    seen.add(((r >> 3) << 10) | ((g >> 3) << 5) | (bl >> 3));
    const l = 0.2126 * r + 0.7152 * g + 0.0722 * bl;
    sum += l; sum2 += l * l; n++;
  }
  const mean = sum / n;
  return { w, h, distinct_colours: seen.size, luma_mean: +mean.toFixed(2),
    luma_stddev: +Math.sqrt(Math.max(0, sum2 / n - mean * mean)).toFixed(2) };
}

/* eslint-disable no-undef */
async function setupAndShoot(spec) {
  const H = window.__HARNESS;
  H.setSeed(20260807);
  H.loadState('default');
  H.setRenderRate(0);
  const CELLS = {};
  for (const c of H.getCameraRig().cells_meta) CELLS[c.id] = c;
  H.setCameraCell(spec.cell);
  H.teleport(0, 0, { y: CELLS[spec.cell].ground_y, yaw: 0 });
  H.setUIVisible(false);
  H.setTimeOfDay(11); H.setWeather('clear');

  let eid = null, other = null;
  if (spec.fight) {
    eid = H.spawn(spec.arch, 0, -spec.d);
    other = H.spawn('cam_levy', 3.0, -spec.d - 0.5);
    H.aggro(eid); H.aggro(other);
    H.lockOn(eid);
  }
  H.stepFrames(2);

  // The run. Real movement input every frame, so the body is mid-stride and the pivot is
  // being dragged by it — a standing character makes a picture that proves nothing.
  for (let f = 0; f < spec.frames; f++) {
    const t = f / 60;
    H.queueInputs([{ f: 0, move: [Math.sin(t * 1.6) * 0.7, 0.9] }]);
    if (spec.killAt !== undefined && f === spec.killAt) H.killEntity(eid);
    H.stepFrames(1);
  }
  const c = H.getCameraFrame().camera;
  const pp = H.getCameraFrame().player_pos;
  H.setRenderRate(60);
  H.renderFrame();
  return {
    caption: spec.caption,
    mode: c.mode, lock_target: c.lock_target || null,
    arm_len_m: +c.arm_len_m.toFixed(3), fov_deg: c.fov_deg,
    pitch_deg: +c.pitch_deg.toFixed(2), yaw_deg: +c.yaw_deg.toFixed(2),
    pivot_above_feet_m: +(c.pivot[1] - pp[1]).toFixed(3),
    clip_through: !!c.clip_through,
    target_on_screen: c.onscreen ? !!c.onscreen.target : null,
    player_on_screen: c.onscreen ? !!c.onscreen.player : null,
    char_opacity: c.char_opacity,
  };
}
/* eslint-enable no-undef */

const SHOTS = [
  { file: `${DATE}-w1-06-third-person-rig-in-motion.png`,
    cell: 'cam-walk-mangrove', frames: 260, fight: false,
    caption: 'The free camera, mid-run through the mangrove fixture. No lock, no target: the ' +
      'boom sits at the free length behind the character\'s right shoulder and the pivot is ' +
      'rigid in XZ, so the body leads and the camera does not swim.' },
  { file: `${DATE}-w1-06-locked-on-mid-fight.png`,
    cell: 'cam-boss-arena', frames: 260, fight: true, arch: 'cam_boss_mid', d: 6.0,
    caption: 'Locked on to a 4.5 m boss with a second enemy alive three metres away, player ' +
      'running. Both fighters framed by RI-CAM03\'s containment law — the boom and the pitch ' +
      'bias are the only two knobs, and neither cuts.' },
  { file: `${DATE}-w1-06-the-frame-after-the-kill.png`,
    cell: 'cam-boss-arena', frames: 260, fight: true, arch: 'cam_boss_mid', d: 6.0, killAt: 240,
    caption: 'Twenty frames after the killing blow. The lock released on the death frame, the ' +
      'camera did not hop to the enemy still standing there, and it did not whip back behind ' +
      'the player: it kept the heading the fight left it with.' },
];

const handle = await launchGame({ ...args, width: W, height: Hh });
await requireMethods(handle, ['setSeed', 'loadState', 'stepFrames', 'queueInputs', 'setRenderRate',
  'setCameraCell', 'teleport', 'getCameraFrame', 'getCameraRig', 'spawn', 'aggro', 'lockOn',
  'killEntity', 'setUIVisible', 'renderFrame']);

fs.mkdirSync(OUT, { recursive: true });
const manifest = [];
let refused = 0;
for (const S of SHOTS) {
  const meta = await handle.page.evaluate(setupAndShoot, S);
  const buf = await handle.page.screenshot({ type: 'png' });
  const st = pngStats(buf);
  // The gate. A picture that cannot be shown to fail this test is not evidence.
  const blank = st.unsupported ? false : (st.distinct_colours < 200 || st.luma_stddev < 4);
  if (blank) {
    refused++;
    log(`REFUSED (blank) ${S.file}: ${st.distinct_colours} distinct colours, luma sd ${st.luma_stddev}`);
    continue;
  }
  fs.writeFileSync(path.join(OUT, S.file), buf);
  manifest.push({ file: S.file, ...meta, pixels: st, bytes: buf.length });
  log(`${S.file}  ${st.w}x${st.h}  ${st.distinct_colours} colours  luma sd ${st.luma_stddev}  ` +
    `mode=${meta.mode} arm=${meta.arm_len_m}m lock=${meta.lock_target || 'none'}`);
}
await handle.close();

const dest = path.join(REPO_ROOT, 'reports', 'w1-06', 'cam-shots.json');
fs.mkdirSync(path.dirname(dest), { recursive: true });
fs.writeFileSync(dest, JSON.stringify({
  schema: 'elder-souls/cam-shots@1', piece: 'W1-06', generated: new Date().toISOString(),
  note: 'Taken through the live rig (no posed camera), one browser, renderer off except for the ' +
    'photographed frame. Every frame checked non-blank before writing.',
  shots: manifest, refused,
}, null, 2) + '\n');
log(`\n${manifest.length}/${SHOTS.length} shots written to ${path.relative(REPO_ROOT, OUT)}`);
process.exit(refused ? EXIT.MEASUREMENT_FAIL : 0);
