#!/usr/bin/env node
// w1-26-r2-shot.mjs — two frames of the opening, for the blog and for a reader who would rather
// look than read a table.
//
//   1. `hold-no-question.png`  — the hold at boot. A body, a woman at the crates, two takeable
//      things, and NO form. Round 1's frame 10 had the hatch-name question on it.
//   2. `she-names-you.png`     — `writ.class-verdict`: the functionary saying what you are.
//
// S34 NOTE. Both are APPEARANCE claims — what the frame says — and both are reached by driving
// the scene from its start rather than by posing the camera, so nothing here is a placed capture
// standing in for an arrival claim. The arrival claims in this round are measured by
// `w1-26-r2-scene.mjs` off the harness, not off a picture.
'use strict';
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs, wantsHelp, usage, REPO_ROOT } from '../lib/cli.mjs';
import { launchGame } from '../lib/browser.mjs';

const USAGE = 'w1-26-r2-shot.mjs — the hold with no question on it, and the line that names you.';
const args = parseArgs();
if (wantsHelp(args)) usage(USAGE);
const say = (s) => process.stdout.write(s + '\n');
const outDir = path.join(REPO_ROOT, 'docs', 'shots');
fs.mkdirSync(outDir, { recursive: true });

const h = await launchGame({ ...args, width: 1280, height: 720 });
const write = async (name, dataUrl) => {
  const p = path.join(outDir, name);
  fs.writeFileSync(p, Buffer.from(String(dataUrl).split(',')[1], 'base64'));
  say('wrote ' + p);
  return p;
};
try {
  const shots = await h.page.evaluate(async () => {
    const H = window.__HARNESS;
    const r = {};
    await H.setSeed(1337);
    await H.setRenderRate(60);
    await H.loadState('barge-hold');
    const st0 = await H.censusBegin({ race: 'saxhleel' });
    // Look around a little, so the frame is a played one rather than the load pose.
    const s1 = []; for (let i = 0; i < 90; i++) s1.push({ f: i, move: [0.15, 0.5], look: [0.25, 0] });
    H.queueInputs(s1); H.stepFrames(90);
    H.renderFrame();
    r.hold = { png: H.screenshot(), node: st0.node, paused: !!st0.paused, question: !!st0.input };

    // Walk to her, talk, and play the scene through to the verdict.
    for (let a = 0; a < 40 && H.getCensusState().paused; a++) {
      const ps = H.getPlayerStats(); const p = ps.pos || ps.position;
      const st = H.getCensusState();
      const t = (st.speaker_entity && st.speaker_entity.pos) || [-2.0, 0, 2.6];
      const yaw = (ps.yaw || 0) * Math.PI / 180;
      const dx = t[0] - p[0], dz = t[2] - p[2];
      const fx = Math.sin(yaw), fz = Math.cos(yaw);
      const fwd = dx * fx + dz * fz, str = dx * fz - dz * fx;
      const n = Math.max(1e-6, Math.hypot(fwd, str));
      const step = []; for (let i = 0; i < 24; i++) step.push({ f: i, move: [str / n, fwd / n] });
      step.push({ f: 25, press: ['interact'] }, { f: 26, release: ['interact'] });
      H.queueInputs(step); H.stepFrames(30);
    }
    let st = H.getCensusState(); let g = 0, qi = 0;
    while (st && !st.done && g++ < 90 && st.node !== 'writ.class-verdict') {
      if (!st.input) { if (st.paused) { st = await H.censusEnter(st.resume_by); continue; } break; }
      let v; const inp = st.input;
      if (inp.kind === 'text') v = st.node === 'hold.hatch-name' ? 'Silence-Under-Salt' : 'Keeps-The-Tally';
      else if (inp.kind === 'questionnaire') { const os = inp.options || []; v = os[qi % os.length].id; qi++; }
      else if (st.node === 'writ.class-routes') v = 'questionnaire';
      else v = ((inp.options || [])[0] || {}).id;
      if (v == null) break;
      st = await H.censusAnswer(v);
    }
    H.stepFrames(2); H.renderFrame();
    r.named = { png: H.screenshot(), node: st.node, line: st.line };

    // And the node the round-1 verdict measured at 0.33: her reply and the question together.
    while (st && !st.done && g++ < 90 && st.node !== 'writ.birthsign') {
      if (!st.input) break;
      const inp = st.input;
      const v = ((inp.options || [])[0] || {}).id;
      if (v == null) break;
      st = await H.censusAnswer(v);
    }
    H.stepFrames(2); H.renderFrame();
    r.birthsign = { png: H.screenshot(), node: st.node, spoken: (st.spoken || []).map((x) => x.line) };
    return r;
  });
  say(`hold: node=${shots.hold.node} paused=${shots.hold.paused} question_on_frame=${shots.hold.question}`);
  say(`named: node=${shots.named.node}`);
  say(`  "${String(shots.named.line).slice(0, 140)}"`);
  await write('2026-08-07-w1-26-hold-no-question.png', shots.hold.png);
  await write('2026-08-07-w1-26-she-names-you.png', shots.named.png);
  await write('2026-08-07-w1-26-birthsign-reply-and-question.png', shots.birthsign.png);
} finally {
  await h.close();
}
