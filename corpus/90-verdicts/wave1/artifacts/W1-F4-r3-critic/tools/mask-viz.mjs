/**
 * MASK VIZ — paint M6's own masks back onto the frame they were computed from.
 * The owner's directive is that a claim about the picture is checked by LOOKING at the picture.
 * A mask is part of the picture: if `LIT_MASK` is holding sky, or `SHADOW_MASK` is holding lit
 * ground, that is visible in one glance and invisible in the number.
 *
 * Output: a 2x2 montage — base | SHADOW_MASK (red) | LIT_MASK (blue) | cast-shadow tau8 (green).
 * usage: node mask-viz.mjs <base.png> <shadows_off.png|-> <out.png> [x,y,w,h]
 */
import { execFileSync } from 'node:child_process';

function decode(png) {
  const meta = JSON.parse(execFileSync('ffprobe', ['-v', 'quiet', '-print_format', 'json',
    '-show_streams', '-select_streams', 'v:0', png]).toString());
  const W = meta.streams[0].width, H = meta.streams[0].height;
  const buf = execFileSync('ffmpeg', ['-loglevel', 'error', '-i', png, '-f', 'rawvideo',
    '-pix_fmt', 'rgb24', '-'], { maxBuffer: 1 << 28 });
  return { W, H, buf };
}
function cropOf({ W, H, buf }, c) {
  if (!c) return { W, H, buf };
  const [x0, y0, cw, ch] = c;
  const out = Buffer.alloc(cw * ch * 3);
  for (let y = 0; y < ch; y++) buf.copy(out, y * cw * 3, ((y0 + y) * W + x0) * 3, ((y0 + y) * W + x0 + cw) * 3);
  return { W: cw, H: ch, buf: out };
}
const luma = (b, i) => (0.2126 * b[3 * i] + 0.7152 * b[3 * i + 1] + 0.0722 * b[3 * i + 2]) / 255;
function sobel(Y, W, H) {
  const G = new Float64Array(W * H);
  const at = (x, y) => Y[Math.min(H - 1, Math.max(0, y)) * W + Math.min(W - 1, Math.max(0, x))];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const gx = -at(x - 1, y - 1) - 2 * at(x - 1, y) - at(x - 1, y + 1) + at(x + 1, y - 1) + 2 * at(x + 1, y) + at(x + 1, y + 1);
    const gy = -at(x - 1, y - 1) - 2 * at(x, y - 1) - at(x + 1, y - 1) + at(x - 1, y + 1) + 2 * at(x, y + 1) + at(x + 1, y + 1);
    G[y * W + x] = Math.hypot(gx, gy);
  }
  return G;
}
function pct(a, idx, p) { const v = Float64Array.from(idx, (i) => a[i]); v.sort(); return v.length ? v[Math.min(v.length - 1, Math.round(p / 100 * (v.length - 1)))] : 0; }
function skyMask(Y, G, W, H) {
  const all = []; for (let i = 0; i < W * H; i++) all.push(i);
  const p60 = pct(Y, all, 60), rl = Math.floor(H * 0.45);
  const cand = new Uint8Array(W * H);
  for (let y = 0; y < rl; y++) for (let x = 0; x < W; x++) { const i = y * W + x; if (G[i] < 0.02 && Y[i] > p60) cand[i] = 1; }
  const lab = new Int32Array(W * H).fill(-1); let best = -1, bn = 0, c = 0;
  for (let s = 0; s < W * H; s++) {
    if (!cand[s] || lab[s] >= 0) continue;
    const st = [s]; lab[s] = c; let n = 0, t0 = false;
    while (st.length) { const i = st.pop(); n++; const x = i % W, y = (i / W) | 0; if (y === 0) t0 = true;
      const nb = []; if (x > 0) nb.push(i - 1); if (x < W - 1) nb.push(i + 1); if (y > 0) nb.push(i - W); if (y < H - 1) nb.push(i + W);
      for (const j of nb) if (cand[j] && lab[j] < 0) { lab[j] = c; st.push(j); } }
    if (t0 && n > bn) { bn = n; best = c; } c++;
  }
  const sky = new Uint8Array(W * H); if (best >= 0) for (let i = 0; i < W * H; i++) if (lab[i] === best) sky[i] = 1;
  return sky;
}
const [basePng, shadowPng, outPng, cropArg] = process.argv.slice(2);
const crop = cropArg ? cropArg.split(',').map(Number) : null;
const B = cropOf(decode(basePng), crop);
const { W, H } = B;
const Y = new Float64Array(W * H); for (let i = 0; i < W * H; i++) Y[i] = luma(B.buf, i);
const sky = skyMask(Y, sobel(Y, W, H), W, H);
const fg = []; for (let i = 0; i < W * H; i++) if (!sky[i]) fg.push(i);
const p25 = pct(Y, fg, 25), p75 = pct(Y, fg, 75);
let SO = null;
if (shadowPng && shadowPng !== '-') { const S = cropOf(decode(shadowPng), crop); SO = new Float64Array(W * H); for (let i = 0; i < W * H; i++) SO[i] = luma(S.buf, i); }
const panes = [];
for (const kind of ['base', 'shadowq', 'litq', 'cast']) {
  const o = Buffer.from(B.buf);
  for (let i = 0; i < W * H; i++) {
    let hit = false, col = null;
    if (kind === 'shadowq') { hit = !sky[i] && Y[i] < p25; col = [255, 40, 40]; }
    if (kind === 'litq') { hit = !sky[i] && Y[i] > p75; col = [60, 120, 255]; }
    if (kind === 'cast') { hit = SO && !sky[i] && (SO[i] - Y[i]) * 255 > 8; col = [40, 255, 80]; }
    if (hit) for (let k = 0; k < 3; k++) o[3 * i + k] = Math.round(0.45 * o[3 * i + k] + 0.55 * col[k]);
  }
  panes.push(o);
}
// 2x2 montage
const MW = W * 2, MH = H * 2, out = Buffer.alloc(MW * MH * 3);
for (let p = 0; p < 4; p++) {
  const ox = (p % 2) * W, oy = ((p / 2) | 0) * H;
  for (let y = 0; y < H; y++) panes[p].copy(out, ((oy + y) * MW + ox) * 3, y * W * 3, (y + 1) * W * 3);
}
execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24',
  '-s', `${MW}x${MH}`, '-i', 'pipe:0', outPng], { input: out });
console.log(JSON.stringify({ out: outPng, panes: 'TL=base TR=SHADOW_MASK(red) BL=LIT_MASK(blue) BR=cast-shadow tau8(green)', W: MW, H: MH,
  sky_frac: +(sky.reduce((s, v) => s + v, 0) / (W * H)).toFixed(4) }));
