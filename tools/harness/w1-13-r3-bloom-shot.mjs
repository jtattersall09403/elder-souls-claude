/**
 * w1-13-r3-bloom-shot.mjs — the bloom from a bearing it could not be seen from, with and
 * without the round-3 renderer change, in one image.
 *
 * `path_to_ten` item 1 of `corpus/90-verdicts/wave1/W1-13-r2.md` is "draw the bloom": M-D14
 * measured it visible from **1 of 8 bearings in daylight at 12 m** and 3 of 8 in the dark at
 * 6 m, and in every failing view the frame containing the bloom was PIXEL-IDENTICAL to the
 * control shot 180 degrees away — 195 px in both.
 *
 * This file stands at one of those failing bearings and shoots the same frame twice:
 *
 *   LEFT  — the world as it now is.
 *   RIGHT — the same frame with the round-3 change DELETED in the page: the three sap-light
 *           planes removed from the marker group and the bloom put back on the COLLISION
 *           ground (`_drawnGroundY` stubbed to its fallback), which is where
 *           `DeathSystem.placeStain()` leaves it and roughly a third of a metre below the
 *           tussock relief `groundskin.js` draws and does not collide.
 *
 * If the two frames come out the same, the change is inert and must not be claimed. The
 * amber-band pixel count of each is printed and written into the sidecar next to the image, so
 * the picture is evidence rather than illustration.
 *
 * Usage: node tools/harness/w1-13-r3-bloom-shot.mjs [--bearing 180] [--dist 12] [--hour 12]
 *                                                   [--out docs/shots/<name>.png]
 */
'use strict';

import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';
import { launchGame } from '../lib/browser.mjs';
import { parseArgs, wantsHelp, usage, log } from '../lib/cli.mjs';

const args = parseArgs(process.argv.slice(2));
if (wantsHelp(args)) { usage('w1-13-r3-bloom-shot.mjs [--bearing deg] [--dist m] [--hour h] [--out file.png]'); process.exit(0); }

const BEARING = Number(args.bearing === undefined ? 180 : args.bearing);
const DIST = Number(args.dist === undefined ? 12 : args.dist);
const HOUR = Number(args.hour === undefined ? 12 : args.hour);
const OUT = String(args.out || 'docs/shots/2026-08-07-w1-13-r3-bloom-drawn-vs-buried.png');

/** The same amber/ochre band `jrn06-death.mjs`'s `bloomPixels()` counts. One detector, not two. */
function bloomPixels(png) {
  let n = 0;
  for (let i = 0; i < png.data.length; i += 4) {
    const r = png.data[i], g = png.data[i + 1], b = png.data[i + 2];
    if (r > 120 && r > b + 40 && g > b + 12 && g < r) n++;
  }
  return n;
}

async function shoot(h) {
  const dataUrl = await h.h('screenshot');
  return PNG.sync.read(Buffer.from(String(dataUrl).replace(/^data:image\/png;base64,/, ''), 'base64'));
}

let handle;
const meta = { bearing_deg: BEARING, distance_m: DIST, hour: HOUR };
try {
  handle = await launchGame({ width: 640, height: 400 });
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
  await h.h('stepFrames', 220);

  const st = (await h.h('getDeathState')).bloodstain;
  if (!st) throw new Error('no bloodstain was placed — nothing to photograph');
  meta.stain = st;
  await h.h('setTimeOfDay', HOUR);

  const th = (BEARING / 360) * Math.PI * 2;
  const x = st.pos[0] + Math.cos(th) * DIST, z = st.pos[2] + Math.sin(th) * DIST;

  const view = async () => {
    await h.h('teleport', x, z);
    await h.h('stepFrames', 2);
    await h.h('camera', { pos: [x, st.pos[1] + 1.6, z], look: [st.pos[0], st.pos[1] + 0.3, st.pos[2]] });
    await h.h('renderFrame');
    return shoot(h);
  };

  const after = await view();
  meta.px_with_the_change = bloomPixels(after);

  // ---- DELETE THE FIX, in the page -----------------------------------------------------------
  await handle.page.evaluate(() => {
    const eng = window.__ENGINE || (window.__HARNESS && window.__HARNESS._engine);
    const r = eng.renderer;
    // 1. the hum: the three cross-planes of sap-light added in round 3.
    const g = r._marks && r._marks.stain;
    if (g) {
      for (const child of g.children.slice()) {
        if (child.geometry && child.geometry.type === 'PlaneGeometry') g.remove(child);
      }
    }
    // 2. the lift: put the bloom back on the COLLISION ground, which is where round 2 drew it.
    r._drawnGroundY = function (px, pz, fallbackY) { return fallbackY; };
    const stain = eng.sim.quest.death.bloodstain;
    if (g && stain) g.position.set(stain.pos[0], stain.pos[1], stain.pos[2]);
  });
  const before = await view();
  meta.px_with_the_change_deleted = bloomPixels(before);

  // ---- the control: the same pose, turned 180 degrees away ------------------------------------
  await h.h('camera', { pos: [x, st.pos[1] + 1.6, z], look: [x + (x - st.pos[0]), st.pos[1] + 0.3, z + (z - st.pos[2])] });
  await h.h('renderFrame');
  meta.px_control_turned_away = bloomPixels(await shoot(h));
  await h.h('camera', null);

  // ---- compose: after | before, side by side --------------------------------------------------
  const W = after.width, H = after.height, GAP = 6;
  const sheet = new PNG({ width: W * 2 + GAP, height: H });
  for (let i = 0; i < sheet.data.length; i += 4) {
    sheet.data[i] = 20; sheet.data[i + 1] = 20; sheet.data[i + 2] = 22; sheet.data[i + 3] = 255;
  }
  PNG.bitblt(after, sheet, 0, 0, W, H, 0, 0);
  PNG.bitblt(before, sheet, 0, 0, W, H, W + GAP, 0);
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, PNG.sync.write(sheet));

  meta.image = OUT;
  meta.left = 'the world as it is (round 3): the bloom lifted onto the DRAWN ground and given its hum';
  meta.right = 'the same frame with the round-3 change deleted in the page: no hum planes, bloom on the collision ground';
  meta.detector = 'the amber/ochre band jrn06-death.mjs bloomPixels() counts — one detector, not two';
  fs.writeFileSync(OUT.replace(/\.png$/, '.json'), JSON.stringify(meta, null, 2) + '\n');

  log(`bearing ${BEARING}deg @ ${DIST} m, hour ${HOUR}`);
  log(`  with the change      : ${meta.px_with_the_change} px`);
  log(`  change DELETED       : ${meta.px_with_the_change_deleted} px`);
  log(`  control (turned away): ${meta.px_control_turned_away} px`);
  log(`  -> ${OUT}`);
} finally {
  if (handle) await handle.close().catch(() => {});
}
