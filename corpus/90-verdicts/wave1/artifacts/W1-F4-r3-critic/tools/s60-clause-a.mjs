/**
 * S60 CLAUSE (a), RE-DERIVED BY THE F4 ROUND-3 CRITIC.
 *
 * S60: "`key_off >= 2x env_off` measured ON THE LIT SUBSET (pixels the shadow map reports
 * unoccluded), in all five windows", because "a pixel in shadow does not change when the key is
 * switched off, so the measure is computed over a domain that shrinks precisely as the fix succeeds".
 *
 * The lit subset here is derived the way `RI-VIS04` s3-D2 derives cast shadow: a pixel is OCCLUDED
 * when the `shadows_off` frame is brighter than the base by more than tau in display luma. LIT =
 * foreground AND NOT occluded. Reported as a curve over tau, never at one chosen tau.
 *
 * Deltas are mean |d rgb| over the lit subset, matching the round-1/round-2 form.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';

function dec(p) {
  const m = JSON.parse(execFileSync('ffprobe', ['-v', 'quiet', '-print_format', 'json', '-show_streams', '-select_streams', 'v:0', p]).toString());
  return { W: m.streams[0].width, H: m.streams[0].height,
    b: execFileSync('ffmpeg', ['-loglevel', 'error', '-i', p, '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], { maxBuffer: 1 << 28 }) };
}
function crop(img, c) {
  if (!c) return img;
  const [x0, y0, cw, ch] = c, out = Buffer.alloc(cw * ch * 3);
  for (let y = 0; y < ch; y++) img.b.copy(out, y * cw * 3, ((y0 + y) * img.W + x0) * 3, ((y0 + y) * img.W + x0 + cw) * 3);
  return { W: cw, H: ch, b: out };
}
const Y = (b, i) => (0.2126 * b[3 * i] + 0.7152 * b[3 * i + 1] + 0.0722 * b[3 * i + 2]);
const dRGB = (a, b, i) => (Math.abs(a[3 * i] - b[3 * i]) + Math.abs(a[3 * i + 1] - b[3 * i + 1]) + Math.abs(a[3 * i + 2] - b[3 * i + 2])) / 3;

export function clauseA({ base, shadows_off, key_off, env_off, cropRect }) {
  const B = crop(dec(base), cropRect), S = crop(dec(shadows_off), cropRect);
  const K = key_off ? crop(dec(key_off), cropRect) : null;
  const E = env_off ? crop(dec(env_off), cropRect) : null;
  const N = B.W * B.H, out = {};
  for (const tau of [1, 2, 4, 8, 16]) {
    let nLit = 0, sK = 0, sE = 0;
    for (let i = 0; i < N; i++) {
      if (Y(S.b, i) - Y(B.b, i) > tau) continue;      // occluded -> not in the lit subset
      nLit++;
      if (K) sK += dRGB(B.b, K.b, i);
      if (E) sE += dRGB(B.b, E.b, i);
    }
    const kd = K ? sK / Math.max(1, nLit) : null, ed = E ? sE / Math.max(1, nLit) : null;
    out[`tau${tau}`] = {
      lit_frac: +(nLit / N).toFixed(4),
      key_off_delta: kd == null ? null : +kd.toFixed(4),
      env_off_delta: ed == null ? null : +ed.toFixed(4),
      lit_ratio: (kd == null || ed == null) ? null : +(kd / Math.max(1e-9, ed)).toFixed(4),
    };
  }
  return out;
}

const W = {
  'pair01-BEFORE': { d: 'reports/f4r3/before-pair01', p: 'pair01', c: [300, 150, 512, 512] },
  'pair01-AFTER': { d: 'reports/f4r3/after-pair01', p: 'pair01', c: [300, 150, 512, 512] },
  'pair02-BEFORE': { d: 'reports/f4r3/before-pair02', p: 'pair02', c: [200, 480, 512, 512] },
  'pair02-AFTER': { d: 'reports/f4r3/after-pair02', p: 'pair02', c: [200, 480, 512, 512] },
  'pair03-BEFORE': { d: 'reports/f4r3/before-pair03', p: 'pair03', c: [1100, 150, 512, 512] },
  'pair03-AFTER': { d: 'reports/f4r3/after-pair03', p: 'pair03', c: [1100, 150, 512, 512] },
  'pair04-BEFORE': { d: 'reports/f4r3/before-pair04', p: 'pair04', c: [200, 480, 512, 512] },
  'pair04-AFTER': { d: 'reports/f4r3/after-pair04', p: 'pair04', c: [200, 480, 512, 512] },
  'overcast-1300': { d: 'reports/f4r3/weather', p: 'weather-overcast', c: [300, 150, 512, 512] },
};
const res = { at: new Date().toISOString(), bar: 2.0, rows: [] };
for (const [label, w] of Object.entries(W)) {
  const f = (a) => `${w.d}/${w.p}__${a}.png`;
  if (!fs.existsSync(f('base')) || !fs.existsSync(f('shadows_off'))) { res.rows.push({ label, error: 'missing base or shadows_off' }); continue; }
  for (const dom of ['crop', 'frame']) {
    res.rows.push({ label, domain: dom, ...(() => {
      const a = { base: f('base'), shadows_off: f('shadows_off'), cropRect: dom === 'crop' ? w.c : null };
      if (fs.existsSync(f('key_off'))) a.key_off = f('key_off');
      if (fs.existsSync(f('env_off'))) a.env_off = f('env_off');
      return { arms_present: ['key_off', 'env_off'].filter((x) => fs.existsSync(f(x))), tau: clauseA(a) };
    })() });
  }
}
console.log(JSON.stringify(res, null, 1));
