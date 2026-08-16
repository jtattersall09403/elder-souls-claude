#!/usr/bin/env node
/* CRITIC control: M12 with the water mask PINNED to one arm.
 * f7-r3-sweep derives a fresh mask per arm (frame vs water-hidden, |dRGB|>6). An arm that
 * changes the water's alpha changes which pixels clear that threshold, so FresnelDelta and
 * ShoreDelta are computed over DIFFERENT pixel sets on the two arms. This recomputes both
 * arms over the SAME mask (the prefix arm's), so any surviving change is the shader's. */
import fs from 'node:fs';
import path from 'node:path';
const REPO = '/home/user/elder-souls-claude';
const { PNG } = await import(path.join(REPO, 'tools/node_modules/pngjs/lib/png.js'));
const V = await import(path.join(REPO, 'tools/metrics/lib/vis03.mjs'));
const DIR = process.argv[2];
const rd = (p) => PNG.sync.read(fs.readFileSync(p));
const mk = (png, hid) => { const N = png.width * png.height, m = new Uint8Array(N); let n = 0;
  for (let i = 0, p = 0; i < N; i++, p += 4) { const d = Math.abs(png.data[p] - hid.data[p]) + Math.abs(png.data[p + 1] - hid.data[p + 1]) + Math.abs(png.data[p + 2] - hid.data[p + 2]); if (d > 6) { m[i] = 1; n++; } }
  return { m, n }; };
console.log('pose'.padEnd(13), 'arm'.padEnd(7), 'ownMask  ownFD      ownSD    | pinMask  pinFD      pinSD');
for (const pose of process.argv.slice(3)) {
  const hid = rd(path.join(DIR, 'frames', `water-hidden-${pose}.png`));
  const pre = rd(path.join(DIR, 'frames', `${pose}-prefix-o0.png`));
  const pin = mk(pre, hid);
  for (const [arm, o] of [['prefix', 0], ['fixed', 1]]) {
    const f = path.join(DIR, 'frames', `${pose}-${arm}-o${o}.png`);
    if (!fs.existsSync(f)) continue;
    const png = rd(f);
    const own = mk(png, hid);
    const a = V.M12(V.prepare(png), own.m, { sequence: [] });
    const b = V.M12(V.prepare(png), pin.m, { sequence: [] });
    const f5 = (x) => (typeof x === 'number' ? x.toFixed(5) : String(x));
    console.log(pose.padEnd(13), arm.padEnd(7), String(own.n).padStart(7), f5(a.FresnelDelta).padStart(9), f5(a.ShoreDelta).padStart(9), '|',
      String(pin.n).padStart(7), f5(b.FresnelDelta).padStart(9), f5(b.ShoreDelta).padStart(9));
  }
}
