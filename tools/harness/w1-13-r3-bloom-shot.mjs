/**
 * w1-13-r3-bloom-shot.mjs — one picture of the round-3 finding.
 *
 * Two panels, one browser, one bloom, one bearing, two frames apart in nothing but where the
 * camera was put.
 *
 *   LEFT   the camera rounds 1-3 measured M-D14 from: eye at `[x, stain.pos[1] + 1.6, z]` —
 *          the STAIN's COLLISION ground, sampled at the stain and used twelve metres away at the
 *          observer's coordinates — aimed at `stain.pos[1] + 0.3`.
 *   RIGHT  the eye at the OBSERVER's own ground + 1.6 m, aimed at where the bloom is actually
 *          DRAWN. Where a player standing on that spot has their head.
 *
 * The verdict called this "the whole piece is a run back to a thing that is not drawn". The thing
 * is drawn. The camera was under the ground.
 *
 * THIS SCRIPT LAUNCHES ITS OWN BROWSER and steps the simulation, because the bloom does not exist
 * until somebody dies (RULES.md 20: say which you did).
 *
 * Usage:
 *   node tools/harness/w1-13-r3-bloom-shot.mjs [--bearing 180] [--dist 12] [--hour 12] [--out <png>]
 */
'use strict';

import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';
import { launchGame } from '../lib/browser.mjs';
import { parseArgs, wantsHelp, usage, log } from '../lib/cli.mjs';

const args = parseArgs(process.argv.slice(2));
if (wantsHelp(args)) { usage('w1-13-r3-bloom-shot.mjs [--bearing <deg>] [--dist <m>] [--hour <h>] [--out <png>]'); process.exit(0); }

const BEARING = Number(args.bearing ?? 180);
const DIST = Number(args.dist ?? 12);
const HOUR = Number(args.hour ?? 12);
const OUT = args.out || 'docs/shots/2026-08-07-w1-13-r3-the-bloom-was-drawn-the-camera-was-underground.png';

async function shoot(h) {
  const d = await h.h('screenshot');
  return PNG.sync.read(Buffer.from(String(d).replace(/^data:image\/png;base64,/, ''), 'base64'));
}
function bloomPixels(png) {
  let n = 0;
  for (let i = 0; i < png.data.length; i += 4) {
    const r = png.data[i], g = png.data[i + 1], b = png.data[i + 2];
    if (r > 120 && r > b + 40 && g > b + 12 && g < r) n++;
  }
  return n;
}

let handle;
try {
  handle = await launchGame({ width: 640, height: 480 });
  const h = handle;
  await h.h('loadState', 'default');
  await h.h('setRenderRate', 60);
  const list = await h.h('listHearths');
  const hearth = list.hearths.find((x) => x.kind === 'settlement') || list.hearths[0];
  await h.h('teleport', hearth.pos[0], hearth.pos[2]);
  await h.h('stepFrames', 2);
  await h.h('restAt', hearth.id);
  const blob = await h.h('saveState');
  blob.character.souls_held = 4200;
  await h.h('restoreState', blob);
  await h.h('teleport', hearth.pos[0] + 50, hearth.pos[2] + 18);
  await h.h('stepFrames', 4);
  await h.h('damagePlayer', 100000, { stagger: false });
  await h.h('stepFrames', 1);
  await h.h('stepFrames', 260);

  const st = (await h.h('getDeathState')).bloodstain;
  if (!st) throw new Error('no bloodstain was placed');
  await h.h('setTimeOfDay', HOUR);

  const th = (BEARING / 360) * Math.PI * 2;
  const x = st.pos[0] + Math.cos(th) * DIST;
  const z = st.pos[2] + Math.sin(th) * DIST;
  await h.h('teleport', x, z);
  await h.h('stepFrames', 3);
  await h.h('renderFrame');
  const snap = await h.hOpt('snapshot');
  const groundY = snap && snap.player && snap.player.pos ? snap.player.pos[1] : st.pos[1];
  const drawn = await h.hOpt('getDrawnMarkers');
  const target = (drawn && drawn.stain && drawn.stain.pos) ? drawn.stain.pos : st.pos;

  // LEFT: the camera rounds 1-3 used.
  await h.h('camera', { pos: [x, st.pos[1] + 1.6, z], look: [st.pos[0], st.pos[1] + 0.3, st.pos[2]] });
  await h.h('renderFrame');
  const left = await shoot(h);

  // RIGHT: the observer's own eye, aimed at the drawn bloom.
  await h.h('camera', { pos: [x, groundY + 1.6, z], look: [target[0], target[1] + 0.9, target[2]] });
  await h.h('renderFrame');
  const right = await shoot(h);
  await h.h('camera', null);

  const GAP = 8;
  const out = new PNG({ width: left.width + GAP + right.width, height: Math.max(left.height, right.height) });
  for (let y = 0; y < out.height; y++) {
    for (let px = 0; px < out.width; px++) {
      const o = (out.width * y + px) << 2;
      let src = null, sx = 0;
      if (px < left.width) { src = left; sx = px; }
      else if (px >= left.width + GAP) { src = right; sx = px - left.width - GAP; }
      if (src && y < src.height) {
        const s = (src.width * y + sx) << 2;
        out.data[o] = src.data[s]; out.data[o + 1] = src.data[s + 1];
        out.data[o + 2] = src.data[s + 2]; out.data[o + 3] = 255;
      } else { out.data[o] = 20; out.data[o + 1] = 20; out.data[o + 2] = 22; out.data[o + 3] = 255; }
    }
  }
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, PNG.sync.write(out));

  log(`bearing ${BEARING} deg at ${DIST} m, hour ${HOUR}`);
  log(`stain model y ${st.pos[1].toFixed(3)}   observer ground y ${groundY.toFixed(3)}   drawn bloom y ${target[1].toFixed(3)}`);
  log(`LEFT  (rounds 1-3 camera, eye ${(st.pos[1] + 1.6).toFixed(3)}, ${(st.pos[1] + 1.6 - groundY).toFixed(3)} m over the observer's own ground): ${bloomPixels(left)} amber px`);
  log(`RIGHT (the observer's eye,  eye ${(groundY + 1.6).toFixed(3)}): ${bloomPixels(right)} amber px`);
  log(`wrote ${OUT}`);
} catch (err) {
  log(`ERROR ${err && err.stack ? err.stack : err}`);
  process.exitCode = 1;
} finally {
  if (handle) await handle.close();
}
