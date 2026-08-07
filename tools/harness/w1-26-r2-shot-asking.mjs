#!/usr/bin/env node
// w1-26-r2-shot-asking.mjs — one frame: the last thing said in the opening.
//
// `writ.stamp`. The Warden-Scribe reads your writ back at you, hands it over, points at the
// door — and then tells you the verb: *"Past it, no one tells you a thing you have not asked
// for. So ask them what they do, and what is being said here."* Nine words are put in your
// hands on the same beat (`Engine._censusFinish()` -> `learnTopics`), and from that moment the
// people in the room have something to say when you use them.
//
// S34 NOTE. This is an APPEARANCE claim — what the frame says — and the scene is DRIVEN from
// its start rather than posed, so it is not a placed capture standing in for an arrival claim.
// Every measured claim in this round comes off the harness and the draw-call register, not off
// this picture.
'use strict';
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs, wantsHelp, usage, REPO_ROOT } from '../lib/cli.mjs';
import { launchGame } from '../lib/browser.mjs';

const USAGE = 'w1-26-r2-shot-asking.mjs — the stamp, and the sentence that teaches the verb.';
const args = parseArgs();
if (wantsHelp(args)) usage(USAGE);
const say = (s) => process.stdout.write(s + '\n');
const outDir = path.join(REPO_ROOT, 'docs', 'shots');
fs.mkdirSync(outDir, { recursive: true });

const h = await launchGame({ ...args, width: 1280, height: 720 });
try {
  const r = await h.page.evaluate(async () => {
    const H = window.__HARNESS;
    await H.setSeed(1337);
    await H.setRenderRate(0);
    await H.loadState('barge-hold');
    await H.censusBegin({ race: 'saxhleel' });
    let st = H.getCensusState(); let g = 0, qi = 0;
    while (st && !st.done && g++ < 120 && st.node !== 'writ.stamp') {
      if (st.paused) { st = await H.censusEnter(st.resume_by); continue; }
      const inp = st.input;
      if (!inp) { st = await H.censusAnswer(null); continue; }
      let v;
      if (inp.kind === 'text') v = st.node === 'hold.hatch-name' ? 'Silence-Under-Salt' : 'Keeps-The-Tally';
      else if (inp.kind === 'pick') v = (inp.options || []).slice(0, inp.count || 2).map((x) => x.id);
      else if (inp.kind === 'questionnaire') { const os = inp.options || []; v = os[qi % os.length].id; qi++; }
      else if (st.node === 'writ.class-routes') v = 'questionnaire';
      else v = ((inp.options || [])[0] || {}).id;
      st = await H.censusAnswer(v);
    }
    await H.setRenderRate(60);
    H.stepFrames(2); H.renderFrame();
    return { png: await H.screenshot(), node: st.node, line: st.line };
  });
  say(`node=${r.node}`);
  say(`"${String(r.line)}"`);
  const p = path.join(outDir, '2026-08-07-w1-26-she-tells-you-to-ask.png');
  fs.writeFileSync(p, Buffer.from(String(r.png).split(',')[1], 'base64'));
  say('wrote ' + p);
} finally {
  await h.close();
}
