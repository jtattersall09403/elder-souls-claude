#!/usr/bin/env node
// wpn-render-look.mjs — LOOK at the swing. A side-on capture of one weapon's arc, with the
// drawn tip's screen position printed per frame so "I cannot see the weapon" is a measurement
// rather than an impression.
//
// The tip is projected through `__HARNESS.projectPoint()`, which is the camera the frame was
// rendered with — so if the tip is off-screen, behind the camera, or inside the character,
// the numbers say which.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { parseArgs, wantsHelp, usage, ensureDir } from '../lib/cli.mjs';
import { launchGame } from '../lib/browser.mjs';

const args = parseArgs();
if (wantsHelp(args)) usage('wpn-render-look.mjs — side-on capture of one swing');
const outDir = path.resolve(String(args.out || 'reports/render/look'));
ensureDir(outDir);

const weapon = String(args.weapon || 'cgs_drowned_reaper');
const frames = String(args.frames || '4,10,16,22,28,34').split(',').map(Number);
// Broadside to the swing: the character stands at the origin facing +z, the weapon is in the
// right hand, so the camera sits off the right shoulder and slightly forward.
const POSE = {
  pos: args.campos ? JSON.parse(args.campos) : [3.1, 1.75, 1.6],
  look: args.camlook ? JSON.parse(args.camlook) : [0, 1.15, 0.35],
  fov: Number(args.fov || 50),
};

const handle = await launchGame({ ...args, width: 960, height: 540 });
let out;
try {
  out = await handle.page.evaluate(async (o) => {
    const H = window.__HARNESS;
    await H.ready();
    H.setSeed(1337);
    H.loadState('arena_flat');
    H.setLoadout({ weapon: o.weapon });
    H.setRenderRate(0);
    H.stepFrames(4);
    H.camera({ pos: o.pose.pos, look: o.pose.look, fov: o.pose.fov });
    H.queueInputs([{ f: 2, press: ['light'] }, { f: 4, release: ['light'] }]);
    const rows = [], imgs = [];
    const want = new Set(o.frames);
    for (let i = 0; i < 40; i++) {
      H.stepFrames(1);
      H.renderFrame();
      const g = H.getDrawnGeometry();
      const P = g.actors.find((a) => a.id === 'player');
      const hg = H.getHitGeometry();
      const me = hg.actors.find((a) => a.id === 'player') || hg.actors[0];
      const row = { f: i, active: me ? !!me.hitbox_active : null };
      if (P && P.drawn_tip) {
        row.tip = P.drawn_tip.map((v) => +v.toFixed(3));
        row.tip_screen = H.projectPoint(P.drawn_tip[0], P.drawn_tip[1], P.drawn_tip[2]);
        row.err_mm = +Number(P.tip_vs_socket_b_mm).toFixed(4);
        if (P.bones) {
          row.hand_r = P.bones.hand_r.map((v) => +v.toFixed(3));
          row.head = P.bones.head.map((v) => +v.toFixed(3));
        }
        // inclination of the drawn blade against the horizontal
        const a = P.drawn_guard, b = P.drawn_tip;
        row.incl_deg = +(Math.atan2(b[1] - a[1], Math.hypot(b[0] - a[0], b[2] - a[2])) * 180 / Math.PI).toFixed(1);
      }
      rows.push(row);
      if (want.has(i)) imgs.push({ f: i, png: await H.screenshot() });
    }
    return { rows, imgs };
  }, { weapon, pose: POSE, frames });
} finally {
  await handle.close();
}

for (const im of out.imgs) {
  const buf = Buffer.from(String(im.png).replace(/^data:image\/png;base64,/, ''), 'base64');
  fs.writeFileSync(path.join(outDir, `${weapon}-f${String(im.f).padStart(2, '0')}.png`), buf);
}
console.log(`weapon=${weapon} camera=${JSON.stringify(POSE)}`);
console.log('  f  act  tip(x,y,z)                 incl  screen(x,y,vis)            err_mm  head_y');
for (const r of out.rows) {
  if (!r.tip) { console.log(`  ${String(r.f).padStart(2)}  -`); continue; }
  const s = r.tip_screen || {};
  console.log(`  ${String(r.f).padStart(2)}  ${r.active ? 'ACT' : '   '}  ` +
    `${r.tip.map((v) => String(v).padStart(7)).join(',')}  ${String(r.incl_deg).padStart(6)}  ` +
    `${JSON.stringify(s).padEnd(42)}  ${r.err_mm}  ${r.head ? r.head[1] : '-'}`);
}
fs.writeFileSync(path.join(outDir, `${weapon}-track.json`), JSON.stringify(out.rows, null, 1));
console.log('wrote', outDir);
