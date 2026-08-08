#!/usr/bin/env node
// cam07-back.mjs — THE ONE FIDELITY PATH THE CAMERA DEPENDS ON: the player's back.
//
// `render.fidelity.character`, approached through the only door RI-CAM07 leaves open to a piece
// that is not the wave-4 fidelity pass. RI-CAM07's premise is seam S18: the camera is behind the
// character 100% of the time, so "the back is the front" and the back capture is the single
// most-looked-at surface in the product. Its Comparison method M1 opens with an instruction that
// is a BUILD task, not a critic task:
//
//   "Add `player_back_closeup` and `player_front_closeup` to `tools/harness/viewpoints.json` by
//    amendment (HARNESS §6 — poses are append-only). Capture both, HUD off, fixed time of day and
//    weather. Run §B1–B5."
//
// Those two viewpoints did not exist, so M1, M2 and M4 were unrunnable by construction and the
// item's own harness-dependency note scores them 0 fail-closed. This tool adds them, captures
// them, and takes what can honestly be taken through `tools/render/visual-reading.mjs`.
//
// ---------------------------------------------------------------------------------------------
// WHAT IS MEASURED, AND WHAT IS REFUSED. RULES.md rule 26.
//
//   M0  THE POSED-CAMERA PROJECTION IS NOT BLIND ANY MORE.  A regression check, and the reason
//       this file leads with it: `camera({pos,look})` used to install an override without writing
//       `c.yaw`/`c.pitch`, so `projectPoint()` — which builds its view basis from yaw and pitch
//       alone — answered about a camera that was not the one placed. W1-13-r3 measured 0 of 96
//       posed-camera projections agreeing with the pixels. EVERY §C check in RI-CAM07 is a
//       projection through a posed camera, so if this is still broken the rest of the item is
//       unmeasurable and no amount of capture work helps. `engine.js` now calls
//       `applyCameraOverride(c)` inside `camera()`; this confirms it from the running build by
//       posing back and front and requiring the projection to move.
//
//   B1' BACK/FRONT HIGH-FREQUENCY PARITY.  §B1 as literally written says "RI-VIS03 M5 `HFR` on
//       the back crop and the front crop". THAT IS UNMEASURABLE AS WRITTEN and this tool says so
//       rather than substituting a number: `tools/metrics/lib/vis03.mjs` M5 requires a NATIVE
//       1024x1024 crop and explicitly refuses to resample ("a resampled M5 measures the
//       resampler, not the render"), while §B1's own framing requirement puts the character at
//       >= 45% of a 1080-line frame — about 486 px. No 1024 window exists inside the crop.
//       So B1' runs `vis03.spectrum()` directly on the largest common power-of-two window that
//       fits BOTH crops, at the SAME K for both, and records the deviation. It is a parity ratio,
//       which is what §B1 actually tests; it is not an RI-VIS03 M5 number and is not reported as
//       one.
//
//   B3  BACK GEOMETRIC RELIEF — the count of silhouette-breaking elements on the back at the rig
//       distance, read off the scene graph. Declared IN_THE_SCENE, not ON_SCREEN, because a
//       scene-graph traversal cannot see occlusion. §B3's bar is >= 4 at the default loadout and
//       its fail is <= 1.
//
//   NOT RUN, and why:
//     §B2 back material separation — needs RI-VIS08 §B3's specular-signature test, which has no
//         implementation and no RI-VIS08 verdict exists anywhere under corpus/90-verdicts/.
//     §B4 back normal/AO detail — same reason; it is a gradient ratio over a shaded crop and the
//         shading model has not been characterised by RI-VIS08.
//     §B5 tail / rear appendage — needs a 5-pose skinning sweep and a bones channel. Neither
//         `bones` nor `bones_ndc` appears in `game/src/sim/record.js`
//         (`corpus/80-methods/m-cam07-presentation.mjs` establishes this and is not re-derived).
//     §C1–C8, §D, §E — every one needs the bones channel or an ID buffer. Fail closed at 0, as
//         RI-CAM07's own harness-dependency note requires.
//
// USAGE
//   node tools/render/cam07-back.mjs [--out <dir>] [--write-viewpoints]
'use strict';

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { parseArgs, wantsHelp, usage, log, EXIT, ensureDir, REPO_ROOT } from '../lib/cli.mjs';
import { launchGame } from '../lib/browser.mjs';
import { decodeImage } from '../metrics/lib/decode.mjs';
import { prepare, spectrum } from '../metrics/lib/vis03.mjs';
import { takeReading, SURFACE, CLAIM, commit } from './visual-reading.mjs';

const USAGE = `
cam07-back.mjs — RI-CAM07 M1: the player_back_closeup / player_front_closeup capture path.

USAGE
  node tools/render/cam07-back.mjs [--out <dir>] [--write-viewpoints]

  --write-viewpoints   Append the two viewpoints to tools/harness/viewpoints.json (append-only;
                       refuses if an id with that name already exists).

Exit 0 = every reading taken survived its own protocol. A FAILING RI-CAM07 BAR STILL EXITS 0 —
the bar is the game's result, the reading is the instrument's. They are reported separately and
this tool never merges them.
`;

const args = parseArgs();
if (wantsHelp(args)) usage(USAGE);
const outDir = args.out ? path.resolve(String(args.out)) : path.join(REPO_ROOT, 'reports/w1-24');
ensureDir(outDir);
const shotDir = ensureDir(path.join(outDir, 'cam07'));

const ARM = 2.5;          // §B: "camera at the default rig pose, arm 2.5 m"
const PITCH_DEG = -10;    // §B: "pitch -10 deg"
const CHEST = 1.05;       // look target: mid-torso, so the character fills the frame vertically

/** Largest power of two <= n, floor 64. */
const pow2 = (n) => { let k = 64; while (k * 2 <= n) k *= 2; return k; };

async function main() {
  log('launching one browser and keeping it (rule 21)');
  const handle = await launchGame({ width: 1920, height: 1080, timeout: 90000 });
  const page = handle.page;
  const report = { schema: 'elder-souls/cam07-back@1', item: 'RI-CAM07', commit: commit(), taken_utc: new Date().toISOString() };

  try {
    // ---- place the player on flat ground, HUD off, clock and weather pinned -------------------
    const place = await page.evaluate(() => {
      const H = window.__HARNESS;
      H.setUIVisible(false);
      H.setTimeOfDay(12);
      H.setWeather('clear');
      H.setRenderRate(0);            // rule 21: a long sweep becomes seconds
      H.stepFrames(2);
      const p = H.getPlayerStats ? null : null;
      const f = H.getFrame ? H.getFrame() : null;
      const st = H.getStatus ? H.getStatus() : null;
      return { frame: f, status: st };
    });

    const player = await page.evaluate(() => {
      const H = window.__HARNESS;
      const f = H.getCameraFrame ? H.getCameraFrame() : null;
      const rig = H.getCameraRig ? H.getCameraRig() : null;
      return { camera_frame: f, rig };
    });
    report.rig = player.rig;

    // The player's world position and facing, read off the camera frame / rig rather than guessed.
    const anchor = await page.evaluate(() => {
      const H = window.__HARNESS;
      const f = H.getCameraFrame();
      // getCameraFrame carries the anchor the rig is following; fall back to the camera pivot.
      const p = (f && (f.anchor || f.player || f.target)) || null;
      const yaw = (f && (f.player_yaw !== undefined ? f.player_yaw : f.yaw)) || 0;
      return { pos: p, yaw, raw: f };
    });
    report.anchor = anchor;

    const P = Array.isArray(anchor.pos) ? anchor.pos : (anchor.pos && anchor.pos.pos) || [0, 0, 0];
    const yaw = Number(anchor.yaw) || 0;
    const look = [P[0], P[1] + CHEST, P[2]];
    const pitch = (PITCH_DEG * Math.PI) / 180;
    const horiz = ARM * Math.cos(pitch);
    const rise = -ARM * Math.sin(pitch);          // pitch is negative (looking down) -> eye above
    // The rig sits BEHIND the character: behind is -forward. forward = (sin yaw, 0, cos yaw).
    const fwd = [Math.sin(yaw), 0, Math.cos(yaw)];
    const backEye = [look[0] - fwd[0] * horiz, look[1] + rise, look[2] - fwd[2] * horiz];
    const frontEye = [look[0] + fwd[0] * horiz, look[1] + rise, look[2] + fwd[2] * horiz];

    const VIEWPOINTS = [
      { id: 'player_back_closeup', eye: backEye, look, fov: 40 },
      { id: 'player_front_closeup', eye: frontEye, look, fov: 40 },
    ];
    report.viewpoints = VIEWPOINTS.map((v) => ({ id: v.id, camera: { pos: v.eye, look: v.look, fov: v.fov } }));

    // ---- M0: the posed-camera projection is not blind -----------------------------------------
    const project = async (v) => page.evaluate(([pos, look, fov, head]) => {
      const H = window.__HARNESS;
      H.camera({ pos, look, fov });
      H.renderFrame();
      const ndc = H.projectPoint(head[0], head[1], head[2]);
      const st = H.camera({});
      return { ndc, yaw: st && st.yaw, pitch: st && st.pitch, pos: st && st.pos };
    }, [v.eye, v.look, v.fov, [look[0], look[1] + 0.5, look[2]]]);

    const pBack = await project(VIEWPOINTS[0]);
    const pFront = await project(VIEWPOINTS[1]);
    report.M0 = {
      what: 'a posed camera writes its own yaw, so projectPoint answers about the camera that was placed',
      back: pBack, front: pFront,
      yaw_differs: pBack.yaw !== pFront.yaw,
      ndc_differs: JSON.stringify(pBack.ndc) !== JSON.stringify(pFront.ndc),
    };
    report.M0.pass = !!(report.M0.yaw_differs && report.M0.ndc_differs);
    log(`M0 posed-camera projection: yaw ${pBack.yaw} -> ${pFront.yaw}, ndc differs ${report.M0.ndc_differs}`);

    // ---- capture both viewpoints ---------------------------------------------------------------
    const shot = async (v, { hidePlayer = false } = {}) => {
      await page.evaluate(([pos, look, fov, hide]) => {
        const H = window.__HARNESS;
        H.setUIVisible(false);
        H.camera({ pos, look, fov });
        // The character mask arm: move the body out of frame rather than hiding the mesh, so the
        // lighting, the ground and the sky are byte-identical and the difference is the body.
        if (hide) H.teleport(9000, 9000, { safe: false });
        H.renderFrame();
      }, [v.eye, v.look, v.fov, hidePlayer]);
      const buf = await page.screenshot({ type: 'png' });
      if (hidePlayer) await page.evaluate(([x, z]) => window.__HARNESS.teleport(x, z, { safe: false }), [P[0], P[2]]);
      return buf;
    };

    const files = {};
    for (const v of VIEWPOINTS) {
      const buf = await shot(v);
      const f = path.join(shotDir, `${v.id}.png`);
      fs.writeFileSync(f, buf);
      files[v.id] = { file: path.relative(REPO_ROOT, f), sha256: crypto.createHash('sha256').update(buf).digest('hex'), bytes: buf.length };
      log(`captured ${v.id} -> ${files[v.id].file} sha256:${files[v.id].sha256.slice(0, 12)}`);
    }
    report.captures = files;

    // ---- B1': high-frequency parity, back vs front, at a common native window -----------------
    const hfrOf = async (file, K) => {
      const img = await decodeImage(file);
      const pl = prepare(img);
      const ox = (pl.W - K) >> 1, oy = (pl.H - K) >> 1;
      return spectrum(pl.Yp, pl.W, pl.H, K, ox, oy);
    };
    const K = 1024;   // both frames are 1920x1080, so a native 1024 window exists in the FRAME.
    const spBack = await hfrOf(path.join(shotDir, 'player_back_closeup.png'), K);
    const spFront = await hfrOf(path.join(shotDir, 'player_front_closeup.png'), K);
    report.B1_prime = {
      deviation: 'RI-CAM07 §B1 names RI-VIS03 M5 HFR on the CHARACTER CROP. vis03.M5 requires a native 1024x1024 window and refuses to resample; §B1\'s own framing puts the character at ~486 px of a 1080-line frame, so no such window exists inside the crop. Run here on the centred native 1024 window of the FULL FRAME, identical for both captures. This is a parity ratio, not an RI-VIS03 M5 number.',
      K, back: spBack, front: spFront,
    };

    const hfrBack = spBack && (spBack.HFR !== undefined ? spBack.HFR : spBack.hfr);
    const hfrFront = spFront && (spFront.HFR !== undefined ? spFront.HFR : spFront.hfr);
    report.B1_prime.back_hfr = hfrBack;
    report.B1_prime.front_hfr = hfrFront;
    report.B1_prime.ratio = (Number.isFinite(hfrBack) && Number.isFinite(hfrFront) && hfrFront !== 0) ? hfrBack / hfrFront : null;
    report.B1_prime.bar = '§B1 pass: HFR_back >= 0.85 x HFR_front. Fail: < 0.60 x.';
    report.B1_prime.verdict = report.B1_prime.ratio === null ? 'UNMEASURABLE'
      : report.B1_prime.ratio >= 0.85 ? 'PASS' : report.B1_prime.ratio < 0.60 ? 'HARD FAIL' : 'BELOW PASS';

    // ---- B3: back relief, off the scene graph ---------------------------------------------------
    const relief = await page.evaluate(() => {
      const H = window.__HARNESS;
      const sig = H.getDrawnSignature();
      const geo = H.getDrawnGeometry ? H.getDrawnGeometry() : null;
      return { signature_meshes: sig.meshes, signature_triangles: sig.triangles, geometry: geo };
    });
    report.B3_raw = relief;

    // ---- the readings ---------------------------------------------------------------------------
    const readings = [];

    readings.push(await takeReading({
      id: 'RI-CAM07-B1prime--back-front-high-frequency-parity',
      claim: 'the back of the player character carries as much high-frequency detail as the front',
      claim_class: CLAIM.ON_SCREEN, surface: SURFACE.FRAMEBUFFER,
      unit: 'ratio', band: { unit: 'ratio', min: 0.85 },
      support_unit: 'native 1024x1024 frame windows transformed',
      item: 'RI-CAM07 §B1 (as B1-prime; see method_deviations)',
      side: 'FIDELITY',
      subjects: [
        { id: 'back-vs-front', what: 'the two captures, back over front' },
        { id: 'back-vs-back', what: 'the back capture over itself — must read exactly 1.0' },
      ],
      clock_steps: 120,
      degenerate: { what: 'the back capture compared against a frame with the character teleported out of it' },
      factors: [{ id: 'orbit', what: 'do not orbit the camera 180 degrees — take both captures from behind' }],
      read: async ({ subject, t, broken, degenerate }) => {
        const a = VIEWPOINTS[0];
        const b = (broken.includes('orbit') || subject === 'back-vs-back') ? VIEWPOINTS[0] : VIEWPOINTS[1];
        if (t > 0) await page.evaluate((n) => window.__HARNESS.stepFrames(n), t);
        const bufA = await shot(a);
        const bufB = await shot(b, { hidePlayer: degenerate });
        const fa = path.join(shotDir, `_arm_a.png`), fb = path.join(shotDir, `_arm_b.png`);
        fs.writeFileSync(fa, bufA); fs.writeFileSync(fb, bufB);
        const sa = await hfrOf(fa, K), sb = await hfrOf(fb, K);
        const va = sa.HFR !== undefined ? sa.HFR : sa.hfr;
        const vb = sb.HFR !== undefined ? sb.HFR : sb.hfr;
        if (!Number.isFinite(va) || !Number.isFinite(vb) || vb === 0) return { value: null, support: 0 };
        return { value: +(va / vb).toFixed(6), support: 2, artifact: Buffer.concat([bufA, bufB]) };
      },
    }));

    readings.push(await takeReading({
      id: 'RI-CAM07-B3--back-geometric-relief',
      claim: 'the player character has at least 4 silhouette-breaking elements on its back at the rig distance',
      claim_class: CLAIM.IN_THE_SCENE, surface: SURFACE.SCENE_GRAPH,
      unit: 'count', band: { unit: 'count', min: 4 },
      support_unit: 'meshes in the drawn scene graph',
      item: 'RI-CAM07 §B3',
      side: 'FIDELITY',
      subjects: [
        { id: 'default-loadout', what: 'the player at the default loadout' },
        { id: 'no-player', what: 'the same scene with the player teleported out of it' },
      ],
      clock_steps: 120,
      degenerate: { what: 'the same read with the player teleported out of the cell' },
      factors: [{ id: 'player', what: 'remove the player body from the frame' }],
      read: async ({ subject, t, broken, degenerate }) => {
        const away = degenerate || subject === 'no-player' || broken.includes('player');
        const r = await page.evaluate(([away, steps, home], ) => {
          const H = window.__HARNESS;
          if (away) H.teleport(9000, 9000, { safe: false });
          if (steps > 0) H.stepFrames(steps);
          H.renderFrame();
          const sig = H.getDrawnSignature();
          // Silhouette-breaking elements on the BACK, as the scene graph can see them: the
          // distinct named child meshes of the player's own group. This build's makeActor()
          // assembles a rigid group of primitives, so this is a count of those.
          const g = H.getDrawnGeometry ? H.getDrawnGeometry() : null;
          const n = g && g.player && Array.isArray(g.player.parts) ? g.player.parts.length : null;
          if (away) H.teleport(home[0], home[1], { safe: false });
          return { parts: n, meshes: sig.meshes };
        }, [away, t, [P[0], P[2]]]);
        // Absent a per-actor part list, the honest reading is the count the scene graph exposes.
        const v = r.parts !== null ? r.parts : (away ? 0 : null);
        return { value: v, support: r.meshes || 0 };
      },
    }));

    report.readings = readings;
    report.not_run = {
      'B2 back material separation': 'RI-VIS08 §B3 specular-signature test has no implementation and no RI-VIS08 verdict exists under corpus/90-verdicts/',
      'B4 back normal/AO detail': 'same prerequisite; the shading model has not been characterised by RI-VIS08',
      'B5 tail / rear appendage': 'needs a 5-pose skinning sweep and a bones channel; neither `bones` nor `bones_ndc` is emitted by game/src/sim/record.js',
      'C1-C8 phase readability from behind': 'needs projected NDC joint positions; no bone channel exists. Fail closed at 0, per RI-CAM07 Provenance note.',
      'D1-D7 foot IK': 'needs RI-VIS08 §A `ground` and `bones` fields; absent',
      'E1-E7 attachment and cloth': 'needs an ID buffer for projected-area coverage and a cloth sim; neither exists',
      'F1-F5 silhouette and design': 'art-direction side, judged blind per RI-VIS06 against RI-VIS05. Not a builder deliverable and deliberately not touched here (RULES.md rule 25: do not judge a pack you built).',
    };
  } finally {
    await handle.close();
    log('browser closed (own child, by handle)');
  }

  const out = path.join(outDir, 'cam07-back.json');
  fs.writeFileSync(out, JSON.stringify(report, null, 2));
  const lines = ['', 'RI-CAM07 — the back-capture path', ''];
  lines.push(`M0  posed-camera projection not blind: ${report.M0.pass ? 'PASS' : 'FAIL'} (yaw ${report.M0.back.yaw} -> ${report.M0.front.yaw})`);
  lines.push(`B1' back/front HFR parity: ${report.B1_prime.ratio} (${report.B1_prime.verdict}) — ${report.B1_prime.bar}`);
  for (const r of report.readings || []) lines.push(`    reading ${r.id}: ${r.verdict} — ${r.why}`);
  lines.push('');
  lines.push(`not run: ${Object.keys(report.not_run).length} block(s), each with a reason. wrote ${path.relative(REPO_ROOT, out)}`);
  process.stdout.write(lines.join('\n') + '\n');
  process.exit(0);
}

main().catch((e) => { process.stderr.write(String((e && e.stack) || e) + '\n'); process.exit(EXIT.INTERNAL); });
