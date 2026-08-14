#!/usr/bin/env node
/**
 * opening-capture.mjs — THE FIRST THIRTY SECONDS, PHOTOGRAPHED WHERE THEY ACTUALLY HAPPEN.
 *
 * Owner directive 2026-08-14 §2, in the owner's words: *"if you just load the game rotate the
 * camera around the player it's immediately obvious that it hasn't [been fixed]"* — a single
 * still from one angle is how the player-transparency defect got declared fixed while it was
 * still broken. So this tool takes MANY ANGLES and MOTION, at two viewports, and it takes them
 * at THORN, through the title screen and the census, because that is where a player who clicks
 * `New` comes out (`reports/spawn-truth/2026-08-14-spawn-truth.md`).
 *
 * WHAT IT CAPTURES, in order:
 *
 *   1. `title`                  the title screen
 *   2. `barge-hold`             the moment creation begins
 *   3. `writ-house-done`        the moment the writ is stamped and control comes back
 *   4. `exit-orbit-<yaw>`       the first frame outside, ORBITED — eight camera yaws 45° apart
 *                               around the standing body, which is the "rotate the camera around
 *                               the player" the directive names. The BODY's facing is untouched;
 *                               only the camera moves, so what these show is what is around the
 *                               place the door puts you.
 *   5. `walk-tNNs`              hold forward and photograph one frame per second for 30 s, which
 *                               is the sequence, not a still.
 *
 * All of it at a desktop viewport and again at a phone viewport.
 *
 * THE PLAYER'S OWN FACING IS RECORDED BESIDE EVERY FRAME (`facing_yaw_deg` in the manifest), and
 * so is `clearance_m` — how far you can see along it before a wall, marched against the same
 * collision set the body is solved against. That is the number the door-exit-yaw fix moves, and a
 * picture without it is a picture somebody can argue about.
 *
 * RENDERER. SwiftShader unless `--gpu hardware`. Recorded in the manifest, failing closed: an
 * unknown renderer string is treated as software, because the opposite mistake has been made here
 * before and put "hardware" on a software run.
 *
 * USAGE
 *   node tools/harness/opening-capture.mjs [--tag <name>] [--start shipping|debug]
 *                                          [--seconds 30] [--gpu hardware] [--out <dir>]
 */
'use strict';

import fs from 'node:fs';
import path from 'node:path';
import { launchGame } from '../lib/browser.mjs';
import { startOpening, OPENING, DEBUG_SPAWN } from '../lib/opening.mjs';

const REPO = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const args = {};
for (let i = 2; i < process.argv.length; i++) {
  if (!process.argv[i].startsWith('--')) continue;
  const k = process.argv[i].slice(2);
  args[k] = (process.argv[i + 1] && !process.argv[i + 1].startsWith('--')) ? process.argv[++i] : true;
}
const TAG = String(args.tag || 'opening');
const START = String(args.start || 'shipping');
const SECONDS = Number(args.seconds || 30);
const HARDWARE = String(args.gpu || '') === 'hardware';
const OUT = path.resolve(REPO, args.out || `reports/spawn-yaw/capture/${TAG}`);
fs.mkdirSync(path.join(OUT, 'frames'), { recursive: true });

// Two viewports, because a phone crops the frame and a composition that only works at 16:9 is a
// composition that does not work.
const VIEWPORTS = [
  { id: 'desktop', w: 1280, h: 720 },
  { id: 'phone', w: 390, h: 844 },
];
const ORBIT_YAWS = [0, 45, 90, 135, 180, 225, 270, 315];

const manifest = {
  tool: 'tools/harness/opening-capture.mjs',
  tag: TAG, when: new Date().toISOString(), start: START, seconds: SECONDS,
  measures: START === 'shipping'
    ? `title -> New -> ${OPENING.interiors.join(' -> ')} -> out of the door into ${OPENING.settlement}`
    : `the DEBUG spawn (${DEBUG_SPAWN.file}, ${DEBUG_SPAWN.settlement}) — NOT what a new player sees`,
  hardware_requested: HARDWARE,
  renderer_string: null, software_renderer: null,
  viewports: [],
};

const main = async () => {
  for (const vp of VIEWPORTS) {
    const g = await launchGame({ entry: 'game/index.html', width: vp.w, height: vp.h, gpu: HARDWARE ? 'hardware' : undefined });
    await g.h('ready');
    // THE CANVAS BACKING STORE IS WHAT A SCREENSHOT IS, and `launchGame`'s width/height only set
    // the browser VIEWPORT. Without this the "phone" pass returned frames byte-identical to the
    // desktop pass — caught because the two sets of PNGs had identical file sizes, not because
    // anything went red. A phone capture that is secretly a desktop capture is worse than no
    // phone capture, because somebody will believe it.
    await g.page.evaluate(({ w, h }) => {
      const c = document.getElementById('view');
      c.width = w; c.height = h;
      window.__ENGINE.renderer.setSize(w, h);
    }, { w: vp.w, h: vp.h });
    await g.h('stepFrames', 2);
    let n = 0;
    const frames = [];
    const shot = async (label, extra = {}) => {
      const d = await g.h('screenshot');
      const f = `${TAG}-${vp.id}-${String(n++).padStart(3, '0')}-${label}.png`;
      fs.writeFileSync(path.join(OUT, 'frames', f), Buffer.from(String(d).replace(/^data:image\/png;base64,/, ''), 'base64'));
      const where = await g.page.evaluate((reach) => {
        const E = window.__ENGINE, s = E.sim, p = s.player.pos;
        const yaw = s.player.yaw, r = yaw * Math.PI / 180;
        const fx = Math.sin(r), fz = Math.cos(r);
        let clear = reach;
        for (let d2 = 0.25; d2 <= reach + 1e-9; d2 += 0.25) {
          const q = E.solidAt(p[0] + fx * d2, p[1] + 1.6, p[2] + fz * d2);
          if (q && q.solid) { clear = +(d2 - 0.25).toFixed(2); break; }
        }
        return {
          settlement: s.env.settlement, interior: s.env.interior,
          pos: p.map((v) => +v.toFixed(2)),
          facing_yaw_deg: +yaw.toFixed(1),
          camera_yaw_deg: +(s.camera ? s.camera.yaw : 0).toFixed(1),
          clearance_m: clear,
          // IS THE PLAYER IN THIS FRAME? Not a judgement — `sim/camera.js#fadeOpacity()` fades the
          // character out as the spring arm shortens and reaches ZERO at `fade_zero_m` = 0.90 m,
          // and the renderer consumes `camera.charOpacity` without deciding anything. So a frame
          // carrying `char_opacity: 0` is the build's own statement that the body is not drawn,
          // which is exactly the open item this capture exists to photograph. `arm_m` is the
          // length that produced it and `arm_guard` says the penetration guard fired.
          arm_m: +(s.camera ? s.camera.armLen : 0).toFixed(3),
          char_opacity: +(s.camera ? s.camera.charOpacity : 1).toFixed(3),
          arm_guard: !!(s.camera && s.camera.armGuard),
        };
      }, 12);
      frames.push({ file: f, label, ...where, ...extra });
      return f;
    };

    const rendererString = await g.page.evaluate(() => {
      try {
        const gl = document.createElement('canvas').getContext('webgl2');
        if (!gl) return 'unavailable: no webgl2 context';
        const ext = gl.getExtension('WEBGL_debug_renderer_info');
        return String(ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER));
      } catch (e) { return `unavailable: ${e.message}`; }
    });
    // Fail closed: unknown means software.
    const software = /^unavailable|^unknown/i.test(rendererString)
      || /swiftshader|llvmpipe|software|mesa/i.test(rendererString);
    manifest.renderer_string = rendererString;
    manifest.software_renderer = manifest.software_renderer === null ? software : (manifest.software_renderer || software);

    // A camera orbit around the standing body, at a fixed radius. The directive's own words:
    // *"if you just load the game rotate the camera around the player it's immediately obvious"*.
    // The BODY is never touched — only the eye moves — so what an orbit shows is what is around
    // the place the player is standing, and it is the check a single still cannot be.
    const orbit = async (label, dist, height, extra = {}) => {
      const p0 = await g.page.evaluate(() => window.__ENGINE.sim.player.pos.slice());
      const pose = await g.page.evaluate(() => ({
        yaw: window.__ENGINE.sim.player.yaw,
        cam_yaw: window.__ENGINE.sim.camera ? window.__ENGINE.sim.camera.yaw : null,
        cam_pitch: window.__ENGINE.sim.camera ? window.__ENGINE.sim.camera.pitch : null,
      }));
      for (const yaw of ORBIT_YAWS) {
        const r = yaw * Math.PI / 180;
        await g.h('camera', {
          pos: [p0[0] - Math.sin(r) * dist, p0[1] + height, p0[2] - Math.cos(r) * dist],
          look: [p0[0], p0[1] + 1.1, p0[2]],
        });
        await g.h('stepFrames', 2);
        await shot(`${label}-${String(yaw).padStart(3, '0')}`, { orbit_yaw_deg: yaw, ...extra });
      }
      await g.h('camera', { mode: 'gameplay' });
      // Put the pose back the way the SCENE left it, not the way the last orbit left it.
      // Measured on the first hardware run: `camera({mode:'gameplay'})` releases the position
      // override and leaves `sim.camera.yaw` on the last orbit angle, and `move: [0, 1]` is
      // forward RELATIVE TO THE CAMERA — so thirty seconds of "walking out of the door" set off
      // at 315 deg instead of the door's 70. `facing_yaw_deg` in the manifest is how it was caught.
      await g.page.evaluate((q) => {
        const s = window.__ENGINE.sim;
        s.player.yaw = q.yaw;
        if (s.camera && q.cam_yaw !== null) { s.camera.yaw = q.cam_yaw; s.camera.pitch = q.cam_pitch; }
        const b = window.__ENGINE.combat && window.__ENGINE.combat.player;
        if (b) b.yaw = q.yaw;
      }, pose);
      await g.h('stepFrames', 8);
      return pose;
    };

    // ---- 1-3. the opening, played -----------------------------------------------------------
    // `handback` is the frame the CENSUS leaves you on, before any door is used, and it is the
    // opening shot of the game. It gets the same orbit treatment as the doorstep, at a shorter
    // radius because it is a 9 x 12 m room.
    const opening = await startOpening(g, {
      start: START,
      label: `opening-capture ${vp.id}`,
      onStage: async (name) => {
        await shot(name, { stage: name });
        if (name === 'writ-house-done' && START === 'shipping') {
          await orbit('handback-orbit', 4.2, 1.9, { stage: 'writ-house-done' });
          await shot('handback-gameplay-camera', { stage: 'writ-house-done' });
        }
      },
    });

    // ---- 4. the orbit -----------------------------------------------------------------------
    // `camera({pos, look})` poses the eye through the ENGINE's own override, which is what the
    // harness re-renders through on `screenshot`; a Three camera moved behind the engine's back
    // is overwritten before the pixels are read (first-ten.mjs learned this the expensive way).
    await orbit('exit-orbit', 5.5, 2.4);
    await shot('exit-gameplay-camera');

    // ---- 5. thirty seconds of walking -------------------------------------------------------
    // The real input pipeline. A queued `move` persists until it changes, so this is a thumb held
    // forward, not a nudge repeated.
    await g.h('queueInputs', [{ f: 0, move: [0, 1] }]);
    for (let t = 1; t <= SECONDS; t++) {
      await g.h('stepFrames', 60);
      await shot(`walk-t${String(t).padStart(2, '0')}s`, { t_s: t });
    }

    manifest.viewports.push({ ...vp, opening, frames });
    await g.close();
  }
  fs.writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 1));
  const all = manifest.viewports.flatMap((v) => v.frames);
  const outdoors = all.filter((f) => !f.interior && f.clearance_m !== undefined);
  const worst = outdoors.length ? outdoors.reduce((a, b) => (b.clearance_m < a.clearance_m ? b : a)) : null;
  console.log(JSON.stringify({
    wrote: path.relative(REPO, OUT), frames: all.length,
    renderer: manifest.renderer_string, software: manifest.software_renderer,
    worst_outdoor_clearance: worst ? { file: worst.file, clearance_m: worst.clearance_m, facing_yaw_deg: worst.facing_yaw_deg } : null,
  }, null, 1));
};

main().catch((e) => { console.error(e); process.exit(1); });
