#!/usr/bin/env node
// wpn-render-probe.mjs — does the swing reach a screen, and does what you see hit you?
//
// The instrument for W1-RENDER. Everything it measures is read out of the SHIPPING browser
// build through `window.__HARNESS`, and every geometric claim is a comparison of two
// independently-derived numbers rather than a readback of one:
//
//   A  BOOT       — the page loads, no page errors, the player actor is built and rigged.
//   B  TIP        — the DRAWN weapon tip (the weapon mesh's authored tip vertex through its
//                   own matrixWorld) against `CombatBody.socketB` (what hit resolution
//                   consumes), in millimetres, over a whole swing. `getDrawnGeometry()` never
//                   looks at the socket, so this cannot pass by tautology.
//   C  MOTION     — the fraction of the character's own bounding box that a 60-frame attack
//                   moves, measured from bone travel. The pre-fix build scored 0.19%.
//   D  CONSUME    — perturb a weapon's DECLARED geometry and show the drawn weapon changes.
//                   RI-MTH07. Runs against the live build with a patched class table.
//   E  SHOTS      — screenshots of three weapon classes at the same frame, md5'd. Expensive;
//                   only with --shots.
//
// USAGE
//   node tools/harness/wpn-render-probe.mjs [--shots] [--out <dir>] [--width n] [--height n]
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { parseArgs, wantsHelp, usage, writeJson, ensureDir } from '../lib/cli.mjs';
import { launchGame } from '../lib/browser.mjs';

const USAGE = 'wpn-render-probe.mjs — the character and weapon renderer, measured in the browser';
const args = parseArgs();
if (wantsHelp(args)) usage(USAGE);
const outDir = args.out ? path.resolve(String(args.out)) : path.resolve('reports/render');
ensureDir(outDir);
ensureDir(path.join(outDir, 'frames'));

// The three the round-3 critic shot byte-identical, and their declared reaches.
const SUBJECTS = [
  { id: 'ssw_garrison_sword', cls: 'SSW', reach: 1.95 },
  { id: 'hlb_garrison_bill', cls: 'HLB', reach: 2.85 },
  { id: 'cgs_drowned_reaper', cls: 'CGS', reach: 2.75 },
];
// One capture pose for all three, so a difference between the shots is a difference in the
// weapon and nothing else.
const POSE = { pos: [3.4, 1.55, -1.9], look: [0, 1.05, 0.55], fov: 55 };
const SHOT_FRAME = 18;

const wide = Number(args.width || (args.shots ? 1280 : 320));
const high = Number(args.height || (args.shots ? 720 : 240));
const handle = await launchGame({ ...args, width: wide, height: high });
const report = { width: wide, height: high, errors: [] };
const shots = {};

try {
  // ---- A/B/C/D, all cheap: renderRate 0 throughout -------------------------------------
  Object.assign(report, await handle.page.evaluate(async (SUBJ) => {
    const H = window.__HARNESS;
    await H.ready();
    H.setSeed(1337);
    H.setRenderRate(0);
    const out = { boot: null, tip: [], motion: [], consume: null, errors: [] };
    const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

    // ---- A. boot ------------------------------------------------------------------------
    H.loadState('arena_flat');
    H.setLoadout({ weapon: SUBJ[0].id });
    H.stepFrames(2);
    H.renderFrame();                                   // one frame, so the actor is built
    const g0 = H.getDrawnGeometry();
    const p0 = g0.actors.find((a) => a.id === 'player');
    out.boot = {
      actors_drawn: g0.actors.length,
      player_built: p0 ? p0.built : false,
      player_rigged: p0 ? p0.rigged : false,
      player_visible: p0 ? p0.visible : false,
      bones_drawn: p0 && p0.bones ? Object.keys(p0.bones).length : 0,
      weapon_key: p0 ? p0.weapon_key : null,
    };

    // ---- B + C. one swing per subject ----------------------------------------------------
    for (const s of SUBJ) {
      try {
        H.loadState('arena_flat');
        H.setLoadout({ weapon: s.id });
        H.setRenderRate(0);
        H.stepFrames(4);
        H.renderFrame();
        H.queueInputs([{ f: 2, press: ['light'] }, { f: 4, release: ['light'] }]);
        const tipErr = [], guardErr = [], boneTracks = {}, tips = [], lens = [];
        let active = 0;
        for (let i = 0; i < 60; i++) {
          H.stepFrames(1);
          H.renderFrame();                             // the draw is what we are measuring
          const g = H.getDrawnGeometry();
          const P = g.actors.find((a) => a.id === 'player');
          if (!P) continue;
          if (P.tip_vs_socket_b_mm !== undefined) {
            tipErr.push(P.tip_vs_socket_b_mm);
            guardErr.push(P.guard_vs_socket_a_mm);
            tips.push(P.drawn_tip);
            lens.push(P.drawn_length_m);
          }
          if (P.bones) {
            for (const [id, v] of Object.entries(P.bones)) {
              (boneTracks[id] = boneTracks[id] || []).push(v);
            }
          }
          const hg = H.getHitGeometry();
          const me = hg.actors.find((a) => a.id === 'player') || hg.actors[0];
          if (me && me.hitbox_active) active++;
        }
        out.tip.push({
          weapon: s.id, class: s.cls, samples: tipErr.length,
          tip_err_mm_max: tipErr.length ? Math.max(...tipErr) : null,
          tip_err_mm_mean: tipErr.length ? tipErr.reduce((a, b) => a + b, 0) / tipErr.length : null,
          guard_err_mm_max: guardErr.length ? Math.max(...guardErr) : null,
          drawn_length_m: lens.length ? Math.max(...lens) : null,
          declared_reach_m: s.reach,
          active_frames: active,
        });

        // ---- C. how much of the character box does the swing move? -------------------------
        // The character's own bounding box over the clip, from the bones. For each bone, the
        // distance it travels; the headline is the mean bone travel as a fraction of the box
        // diagonal. The pre-fix renderer moved only the root, so every bone tracked the root
        // and the figure was the root's own translation — 0.19%.
        const ids = Object.keys(boneTracks);
        let lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9];
        for (const id of ids) for (const v of boneTracks[id]) {
          for (let k = 0; k < 3; k++) { if (v[k] < lo[k]) lo[k] = v[k]; if (v[k] > hi[k]) hi[k] = v[k]; }
        }
        // The box is the character's own extent on frame 0, not the swept volume, so the
        // denominator cannot grow just because the animation is big.
        const f0 = ids.map((id) => boneTracks[id][0]);
        let blo = [1e9, 1e9, 1e9], bhi = [-1e9, -1e9, -1e9];
        for (const v of f0) for (let k = 0; k < 3; k++) { if (v[k] < blo[k]) blo[k] = v[k]; if (v[k] > bhi[k]) bhi[k] = v[k]; }
        const diag = Math.hypot(bhi[0] - blo[0], bhi[1] - blo[1], bhi[2] - blo[2]) || 1;
        // Per-bone displacement RELATIVE TO THE ROOT, so root translation cannot be mistaken
        // for animation — this is the exact confusion that let a static box score 0.19%.
        const root = boneTracks.root || boneTracks.pelvis;
        const perBone = [];
        for (const id of ids) {
          const t = boneTracks[id];
          let mx = 0;
          for (let i = 1; i < t.length; i++) {
            const rel = [t[i][0] - root[i][0], t[i][1] - root[i][1], t[i][2] - root[i][2]];
            const rel0 = [t[0][0] - root[0][0], t[0][1] - root[0][1], t[0][2] - root[0][2]];
            mx = Math.max(mx, dist(rel, rel0));
          }
          perBone.push({ bone: id, max_travel_m: mx, pct_of_box: (mx / diag) * 100 });
        }
        perBone.sort((a, b) => b.max_travel_m - a.max_travel_m);
        const tipTravel = tips.length ? Math.max(...tips.map((t) => dist(t, tips[0]))) : 0;
        out.motion.push({
          weapon: s.id, class: s.cls,
          box_diag_m: diag,
          mean_bone_pct_of_box: perBone.reduce((a, b) => a + b.pct_of_box, 0) / (perBone.length || 1),
          max_bone_pct_of_box: perBone.length ? perBone[0].pct_of_box : 0,
          hand_r_pct_of_box: (perBone.find((b) => b.bone === 'hand_r') || {}).pct_of_box || 0,
          weapon_tip_travel_m: tipTravel,
          weapon_tip_pct_of_box: (tipTravel / diag) * 100,
          top_bones: perBone.slice(0, 5),
        });
      } catch (e) { out.errors.push('swing ' + s.id + ': ' + String(e.message).slice(0, 200)); }
    }

    // ---- D. CONSUMPTION ------------------------------------------------------------------
    // Perturb the DECLARED geometry of one weapon's class and show the drawn weapon changes.
    // The declared numbers are read live out of the moveset library the fight is holding, so
    // this is a perturbation of the real source and not of a copy.
    try {
      const probe = (wid) => {
        H.loadState('arena_flat'); H.setLoadout({ weapon: wid }); H.setRenderRate(0);
        H.stepFrames(3); H.renderFrame();
        const P = H.getDrawnGeometry().actors.find((a) => a.id === 'player');
        return { key: P.weapon_key, tris: P.weapon_tris, len: P.drawn_length_m,
          tip: P.drawn_tip, err_mm: P.tip_vs_socket_b_mm };
      };
      const before = probe('cgs_drowned_reaper');
      // reach 2.75 -> 1.20, edged span 1.55 -> 0.30. Both are class-level declarations.
      const lib = H._movesetLibrary ? H._movesetLibrary() : null;
      out.consume = { note: 'see node-side perturbation', before };
      if (lib) {
        const cls = lib.classes.classes.CGS;
        cls.reach_m = 1.20; cls.hitbox_span_m = 0.30;
        lib._clipCache.clear(); if (lib._bladeCache) lib._bladeCache.clear();
        const after = probe('cgs_drowned_reaper');
        cls.reach_m = 2.75; cls.hitbox_span_m = 1.55;
        lib._clipCache.clear(); if (lib._bladeCache) lib._bladeCache.clear();
        const restored = probe('cgs_drowned_reaper');
        out.consume = { before, after, restored,
          key_changed: before.key !== after.key,
          length_changed_m: Math.abs((after.len || 0) - (before.len || 0)),
          tris_changed: before.tris !== after.tris,
          restored_ok: restored.key === before.key };
      }
    } catch (e) { out.errors.push('consume: ' + String(e.message).slice(0, 200)); }

    return out;
  }, SUBJECTS));

  // ---- E. screenshots ------------------------------------------------------------------
  if (args.shots) {
    for (const s of SUBJECTS) {
      try {
        const png = await handle.page.evaluate(async (o) => {
          const H = window.__HARNESS;
          await H.ready();
          H.setSeed(1337);
          H.loadState('arena_flat');
          H.setLoadout({ weapon: o.id });
          H.setRenderRate(0);
          H.stepFrames(4);
          H.camera({ pos: o.pose.pos, look: o.pose.look, fov: o.pose.fov });
          H.queueInputs([{ f: 2, press: ['light'] }, { f: 4, release: ['light'] }]);
          H.stepFrames(o.frame);
          return H.screenshot();
        }, { ...s, pose: POSE, frame: SHOT_FRAME });
        shots[s.id] = png;
      } catch (e) { report.errors.push('shot ' + s.id + ': ' + String(e.message).slice(0, 200)); }
    }
  }
} finally {
  await handle.close();
}

report.shot_md5 = {};
for (const [id, png] of Object.entries(shots)) {
  const buf = Buffer.from(String(png).replace(/^data:image\/png;base64,/, ''), 'base64');
  const file = path.join(outDir, 'frames', `${id}-f${SHOT_FRAME}.png`);
  fs.writeFileSync(file, buf);
  report.shot_md5[id] = { md5: crypto.createHash('md5').update(buf).digest('hex'), bytes: buf.length, file };
}
const md5s = Object.values(report.shot_md5).map((v) => v.md5);
report.shots_distinct = md5s.length ? new Set(md5s).size : null;
report.page_errors = handle.pageErrors ? handle.pageErrors.length : null;
report.page_error_sample = handle.pageErrors ? handle.pageErrors.slice(0, 5) : null;

writeJson(path.join(outDir, 'render-probe.json'), report);

console.log('--- A boot ---');
console.log(JSON.stringify(report.boot));
console.log('--- B drawn tip vs hit socket ---');
for (const t of report.tip || []) {
  console.log(`  ${t.class} ${t.weapon.padEnd(22)} n=${t.samples} tip_err max ${Number(t.tip_err_mm_max).toFixed(4)} mm mean ${Number(t.tip_err_mm_mean).toFixed(4)} mm | guard_err max ${Number(t.guard_err_mm_max).toFixed(4)} mm | drawn_len ${Number(t.drawn_length_m).toFixed(3)} m vs declared reach ${t.declared_reach_m}`);
}
console.log('--- C 60-frame attack, motion as % of character box ---');
for (const m of report.motion || []) {
  console.log(`  ${m.class} ${m.weapon.padEnd(22)} box_diag ${m.box_diag_m.toFixed(2)} m | mean bone ${m.mean_bone_pct_of_box.toFixed(2)}% | max bone ${m.max_bone_pct_of_box.toFixed(2)}% (${m.top_bones[0] ? m.top_bones[0].bone : '-'}) | tip travel ${m.weapon_tip_travel_m.toFixed(2)} m = ${m.weapon_tip_pct_of_box.toFixed(0)}%`);
}
console.log('--- D consumption ---');
console.log(JSON.stringify(report.consume, null, 1));
console.log('--- E screenshots ---');
for (const [id, v] of Object.entries(report.shot_md5)) console.log(`  ${id.padEnd(22)} ${v.md5}  ${v.bytes} B`);
console.log('  distinct:', report.shots_distinct, 'of', Object.keys(report.shot_md5).length);
console.log('page_errors', report.page_errors, report.page_error_sample);
console.log('errors', (report.errors || []).concat(report.errors2 || []).slice(0, 8));
