/**
 * critic-w1-13-r3-shot.mjs — the 2x2 the round left unrun, as a picture.
 *
 * W1-13 round 3 overturned round 2's named gap by changing the camera M-D14 shoots from, and
 * said plainly that it did not know WHICH half of the change mattered: the eye moved ~0.25 m and
 * the aim point moved 0.8 m, together, in one step. This renders all four corners of that 2x2 at
 * the one bearing where the old camera goes blind and the new one reads, in one browser, on one
 * bloom, with the amber count under each panel.
 *
 * Usage: node tools/harness/critic-w1-13-r3-shot.mjs [--out docs/shots/<name>.png] [--bearing 0]
 */
'use strict';

import { writeFileSync } from 'node:fs';
import { PNG } from 'pngjs';
import { launchGame } from '../lib/browser.mjs';
import { parseArgs, wantsHelp, usage, log, gitInfo } from '../lib/cli.mjs';

const args = parseArgs(process.argv.slice(2));
if (wantsHelp(args)) { usage('critic-w1-13-r3-shot.mjs [--out <png>] [--bearing <deg>]'); process.exit(0); }
const BEARING = Number(args.bearing ?? 0);
const OUT = args.out || 'docs/shots/2026-08-07-w1-13-r3-critic-which-half-of-the-camera.png';

function amberPixels(png) {
  let n = 0;
  for (let i = 0; i < png.data.length; i += 4) {
    const r = png.data[i], g = png.data[i + 1], b = png.data[i + 2];
    if (r > 120 && r > b + 40 && g > b + 12 && g < r) n++;
  }
  return n;
}

let handle;
try {
  handle = await launchGame({ width: 480, height: 360 });
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
  await h.h('setTimeOfDay', 12);

  const st = (await h.h('getDeathState')).bloodstain;
  const th = (BEARING / 360) * Math.PI * 2;
  const x = st.pos[0] + Math.cos(th) * 12, z = st.pos[2] + Math.sin(th) * 12;
  await h.h('teleport', x, z);
  await h.h('stepFrames', 3);
  await h.h('renderFrame');
  const snap = await h.hOpt('snapshot');
  const groundY = snap.player.pos[1];
  const drawn = await h.hOpt('getDrawnMarkers');
  const target = drawn.stain.pos;

  const OLD_EYE = [x, st.pos[1] + 1.6, z];
  const NEW_EYE = [x, groundY + 1.6, z];
  const OLD_LOOK = [st.pos[0], st.pos[1] + 0.3, st.pos[2]];
  const NEW_LOOK = [target[0], target[1] + 0.9, target[2]];

  const CELLS = [
    { label: 'OLD eye + OLD aim  (rounds 1-3)', eye: OLD_EYE, look: OLD_LOOK },
    { label: 'OLD eye + NEW aim  (aim only)', eye: OLD_EYE, look: NEW_LOOK },
    { label: 'NEW eye + OLD aim  (eye only)', eye: NEW_EYE, look: OLD_LOOK },
    { label: 'NEW eye + NEW aim  (round 3)', eye: NEW_EYE, look: NEW_LOOK },
  ];
  const shots = [];
  for (const c of CELLS) {
    await h.h('camera', { pos: c.eye, look: c.look });
    await h.h('renderFrame');
    const url = String(await h.h('screenshot'));
    const png = PNG.sync.read(Buffer.from(url.replace(/^data:image\/png;base64,/, ''), 'base64'));
    // the 180-away control at the same pose, so the caption is a MARGIN and not a raw count
    await h.h('camera', { pos: c.eye, look: [c.eye[0] + (c.eye[0] - c.look[0]), c.look[1], c.eye[2] + (c.eye[2] - c.look[2])] });
    await h.h('renderFrame');
    const cur = String(await h.h('screenshot'));
    const cpng = PNG.sync.read(Buffer.from(cur.replace(/^data:image\/png;base64,/, ''), 'base64'));
    const px = amberPixels(png), ctrl = amberPixels(cpng);
    shots.push({ ...c, url, px, ctrl, margin: px - ctrl, visible: px > ctrl + 40 });
    log(`${c.label.padEnd(36)} ${px} px, control ${ctrl}, margin ${px - ctrl} -> ${px > ctrl + 40 ? 'READS' : 'BLIND'}`);
  }
  await h.h('camera', null);

  const dataUrl = await h.page.evaluate(async ({ cells, bearing, eyeInfo }) => {
    const W = 480, H = 360, PAD = 12, HEAD = 74, CAP = 34;
    const cv = document.createElement('canvas');
    cv.width = W * 2 + PAD * 3;
    cv.height = HEAD + (H + CAP) * 2 + PAD * 3;
    const c = cv.getContext('2d');
    c.fillStyle = '#14110d'; c.fillRect(0, 0, cv.width, cv.height);
    c.fillStyle = '#e8ddc4'; c.font = 'bold 22px sans-serif';
    c.fillText('W1-13 r3, critic: which half of the M-D14 camera loses the bloom?', PAD, 30);
    c.font = '15px sans-serif'; c.fillStyle = '#b8ab8e';
    c.fillText(`one bloom, one browser, bearing ${bearing}° at 12 m, hour 12. ${eyeInfo}`, PAD, 54);
    for (let i = 0; i < cells.length; i++) {
      const img = new Image();
      await new Promise((res) => { img.onload = res; img.src = cells[i].url; });
      const cx = PAD + (i % 2) * (W + PAD);
      const cy = HEAD + Math.floor(i / 2) * (H + CAP + PAD);
      c.drawImage(img, cx, cy, W, H);
      c.strokeStyle = cells[i].visible ? '#d8b25a' : '#5a4a3a';
      c.lineWidth = 2; c.strokeRect(cx - 1, cy - 1, W + 2, H + 2);
      c.font = 'bold 15px sans-serif';
      c.fillStyle = cells[i].visible ? '#d8b25a' : '#9a8f7a';
      c.fillText(cells[i].label, cx, cy + H + 18);
      c.font = '13px sans-serif'; c.fillStyle = '#b8ab8e';
      c.fillText(`${cells[i].margin} px over the 180°-away control  —  ${cells[i].visible ? 'READS' : 'BLIND'}`, cx, cy + H + 33);
    }
    return cv.toDataURL('image/png');
  }, {
    cells: shots.map((s) => ({ url: s.url, label: s.label, margin: s.margin, visible: s.visible })),
    bearing: BEARING,
    eyeInfo: `old eye y=${OLD_EYE[1].toFixed(3)}, new eye y=${NEW_EYE[1].toFixed(3)}, `
      + `old aim y=${OLD_LOOK[1].toFixed(3)}, new aim y=${NEW_LOOK[1].toFixed(3)}`,
  });

  writeFileSync(OUT, Buffer.from(dataUrl.replace(/^data:image\/png;base64,/, ''), 'base64'));
  log(`wrote ${OUT} (${gitInfo().commit.slice(0, 7)})`);
} catch (err) {
  log(`ERROR ${String(err && err.stack ? err.stack : err)}`);
  process.exitCode = 1;
} finally {
  if (handle) await handle.close();
}
