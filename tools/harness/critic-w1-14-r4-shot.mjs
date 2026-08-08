#!/usr/bin/env node
// critic-w1-14-r4-shot.mjs — the critic's own picture: the counter, on screen, at Gideon.
//
// The round argues its spellmaking door is not a new UI mode because it borrows the
// conversation's own topic list. The test of that claim is the DRAW CALL, and this is the
// photograph of it: the spellwright's name, his town, the sentence he says when you raise the
// subject, and the counter's rows underneath it — all of it read back out of
// `getRenderedText()`, which hooks `fillText`, so nothing here is a state object being
// described as a screen.
//
// Steps the simulation and walks a body, so it launches its own browser (rule 20).
import path from 'node:path';
import { parseArgs, wantsHelp, usage, log, ensureDir } from '../lib/cli.mjs';
import { launchGame } from '../lib/browser.mjs';

const USAGE = 'critic-w1-14-r4-shot.mjs — the commission counter, drawn';
const args = parseArgs();
if (wantsHelp(args)) usage(USAGE);
const out = args.out ? String(args.out)
  : 'docs/shots/2026-08-08-critic-w1-14-r4-the-counter-where-you-invent-a-spell.png';
ensureDir(path.dirname(path.resolve(out)));

const handle = await launchGame(args);
let info;
try {
  info = await handle.page.evaluate(async () => {
    const H = window.__HARNESS;
    await H.ready();
    H.setSeed(77);
    // Gideon: the one spellwright's town that is not under a deck or a canopy, so a photograph
    // taken at 11:00 in `high_clear` is a picture of a person rather than of a black rectangle.
    H.loadState('town-gideon'); H.stepFrames(4); H.loadState('town-gideon');
    H.setTimeOfDay(11);
    H.setGold(400000);
    for (let i = 0; i < 700; i++) {
      for (const sk of ['sorcery', 'root-speech', 'warding', 'veiling']) H.grantSkillUse('cast_effective', { cost: 40, spell_skill: sk });
      H.hearthRest();
    }
    H.setWillpower(99); H.setCatalyst('great_staff'); H.hearthRest();
    for (const s of H.getMagicData().spells.spells) H.learnSpell(s.id);
    H.stepFrames(30);

    const who = H.listNPCs().find((n) => JSON.stringify(n).includes('spellwright-gideon'));
    const npos = who.pos || (who.record && who.record.post && who.record.post.pos);
    const p0 = H.whereAmI().pos;
    const walk = H.walkPath([[p0[0], p0[2]], [npos[0], npos[2]]], { arrive_m: 2.0, stuckAbort: 400, maxFrames: 4000 });
    const p1 = H.whereAmI().pos;
    const gap = Math.round(Math.hypot(p1[0] - npos[0], p1[2] - npos[2]) * 100) / 100;
    H.talkTo(who.eid || who.id);
    H.conversationSay('spellmaking');
    // One step into the counter, so the picture shows the book of what you know how to ask for
    // rather than the two-row root — that is the screen a player spends their time on.
    H.conversationSay('commission.effect.add');
    H.stepFrames(2);
    H.renderFrame();
    const t = H.getRenderedText();
    return {
      walk_arrived: !!(walk && walk.arrived), gap_m: gap, walked_frames: walk ? walk.frames : null,
      drawn: (t.distinct || []).slice(0, 30),
      counter: H.commissionState() ? H.commissionState().options.map((o) => o.text) : null,
    };
  });
  await handle.page.screenshot({ path: path.resolve(out) });
} finally {
  await handle.close();
}
log(`walked to ${info.gap_m} m (arrived=${info.walk_arrived}, ${info.walked_frames} f@60)`);
log(`counter rows: ${JSON.stringify(info.counter)}`);
log(`drawn: ${JSON.stringify(info.drawn)}`);
log(`wrote ${out}`);
