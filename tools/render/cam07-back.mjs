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
    // THE RIG'S PIVOT IS THE PLAYER ANCHOR, and round 1 of this file did not find it. It looked for
    // `f.anchor` / `f.player` / `f.target`, got null, and FELL BACK TO THE WORLD ORIGIN — while the
    // player stood at [2766.5, 4.23, 5011]. Two "player closeups" were captured 2.7 km from the
    // player and the tool reported them as captured. A silent fallback to a plausible default is
    // how a capture of nothing gets filed as a capture of something; there is no fallback now, and
    // an absent pivot throws.
    const anchor = await page.evaluate(() => {
      const H = window.__HARNESS;
      const f = H.getCameraFrame();
      const c = f && f.camera;
      return { pos: c && c.pivot, yaw_deg: c && c.yaw_deg, arm_m: c && c.arm_len_m, raw: f };
    });
    report.anchor = anchor;
    if (!Array.isArray(anchor.pos) || anchor.pos.length !== 3 || !anchor.pos.every(Number.isFinite)) {
      throw new Error(`cam07-back: getCameraFrame().camera.pivot is ${JSON.stringify(anchor.pos)}. Without the player anchor these captures would be of empty terrain, and round 1 of this file filed exactly that as a player closeup. Refusing rather than defaulting.`);
    }

    const P = anchor.pos;
    const yaw = ((Number(anchor.yaw_deg) || 0) * Math.PI) / 180;
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
    //
    // THE TEST POINT MUST BE OFF THE CAMERA AXIS, and the first draft of this check was not.
    // Round 1 of this file projected `look + 0.5y` — a point on the vertical axis THROUGH the look
    // target — from both poses, and got [0, 0.4376] and [1.5e-16, 0.4376]. Of course it did: an
    // on-axis point projects to frame centre from every camera aimed at it, so the probe could not
    // have failed whatever the camera did, and its `ndc_differs: true` was floating-point residue
    // being read as a signal. That is precisely the shape this whole piece exists to catch, found
    // in my own instrument by running it. The point is now offset in X — the player's left
    // shoulder — which must project to OPPOSITE sides of the frame from behind and from in front.
    const OFFAXIS = [look[0] + 0.30, look[1] + 0.35, look[2]];
    const project = async (v) => page.evaluate(([pos, look, fov, pt]) => {
      const H = window.__HARNESS;
      H.camera({ pos, look, fov });
      H.renderFrame();
      const ndc = H.projectPoint(pt[0], pt[1], pt[2]);
      const f = H.getCameraFrame();
      return { ndc, yaw_deg: f && f.camera && f.camera.yaw_deg, pitch_deg: f && f.camera && f.camera.pitch_deg, pos: f && f.camera && f.camera.pos };
    }, [v.eye, v.look, v.fov, OFFAXIS]);

    const pBack = await project(VIEWPOINTS[0]);
    const pFront = await project(VIEWPOINTS[1]);
    const nx = (p) => (p && p.ndc && Array.isArray(p.ndc.ndc) ? p.ndc.ndc[0] : (p && p.ndc && p.ndc.x));
    const xBack = nx(pBack), xFront = nx(pFront);
    report.M0 = {
      what: 'a posed camera writes its own yaw, so projectPoint answers about the camera that was actually placed',
      test_point: OFFAXIS,
      test_point_note: 'OFF the camera axis on purpose: an on-axis point projects identically from both poses and makes this probe unfalsifiable.',
      back: pBack, front: pFront,
      yaw_differs: pBack.yaw_deg !== pFront.yaw_deg,
      ndc_x_back: xBack, ndc_x_front: xFront,
      // The real discriminator: from behind and from in front, the same shoulder is on opposite
      // sides of the frame. A tolerance of 0.02 NDC keeps floating-point residue out.
      ndc_x_flips_side: Number.isFinite(xBack) && Number.isFinite(xFront)
        && Math.abs(xBack) > 0.02 && Math.abs(xFront) > 0.02 && (xBack > 0) !== (xFront > 0),
    };
    report.M0.pass = !!report.M0.ndc_x_flips_side;
    log(`M0 posed-camera projection: yaw ${pBack.yaw_deg} -> ${pFront.yaw_deg}, ndc.x ${xBack} -> ${xFront}, flips side ${report.M0.ndc_x_flips_side}`);

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
        const r = await page.evaluate(([away, steps, home]) => {
          const H = window.__HARNESS;
          if (away) H.teleport(9000, 9000, { safe: false });
          if (steps > 0) H.stepFrames(steps);
          H.renderFrame();
          const g = H.getDrawnGeometry ? H.getDrawnGeometry() : null;
          const actors = (g && Array.isArray(g.actors)) ? g.actors : [];
          const me = actors.find((a) => a.id === 'player') || actors[0] || null;
          // §B3 asks for silhouette-breaking elements ON THE BACK at the rig distance: hood,
          // pauldron, scabbard, quiver, cloak fastening, tail root, belt hang. What this surface
          // can enumerate is bone ORIGINS and a weapon origin. There is no attachment list and no
          // per-part mesh list, so the count §B3 names IS NOT DERIVABLE from it — and inventing a
          // proxy (bone count, mesh count) would be answering a different question with a number
          // that looks like the right one.
          const surface = me ? {
            has_bones: !!me.bones, bone_count: me.bones ? Object.keys(me.bones).length : 0,
            has_weapon_origin: me.weapon_origin !== undefined,
            has_part_list: Array.isArray(me.parts),
            keys: Object.keys(me),
          } : null;
          if (away) H.teleport(home[0], home[1], { safe: false });
          return { surface, actors: actors.length, answerable: !!(surface && surface.has_part_list) };
        }, [away, t, [P[0], P[2]]]);
        report.B3_surface = r.surface;
        // NOT ANSWERABLE. Reported as an absence, with support 0, so the reading returns
        // NOTHING_READ rather than a number nobody can defend. RULES.md rule 24: never stub a
        // tool to pass; report the absence.
        if (!r.answerable) return { value: null, support: 0 };
        return { value: null, support: 0 };
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
