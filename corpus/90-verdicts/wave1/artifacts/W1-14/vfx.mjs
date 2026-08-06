import { launchGame } from '/tmp/claude-0/-home-user-elder-souls-claude/3c195166-6f14-54d0-bf0f-867f7b39d84b/scratchpad/w1-14/tools/lib/browser.mjs';
import fs from 'node:fs';
const h = await launchGame({});
const dir='/tmp/claude-0/-home-user-elder-souls-claude/3c195166-6f14-54d0-bf0f-867f7b39d84b/scratchpad/art';
const stats = await h.page.evaluate(async () => {
  const H = window.__HARNESS; await H.ready();
  H.setSeed(1337); H.loadState('arena_flat'); H.setRenderRate(1); H.setTimeOfDay(12); H.setWeather('clear');
  H.setWillpower(99); H.setCatalyst('rod'); H.setMagicSkills({sorcery:100,root_speech:100,warding:100,veiling:100});
  H.hearthRest(); H.setAttuned(['marshfire']);
  H.setUIVisible(false);
  H.camera({pos:[4,2,-4], look:[0,1.2,2], fov:50});
  H.stepFrames(5); H.renderFrame();
  return { pre: H.getWorldStats() };
});
await h.page.screenshot({path: dir+'/idle.png'});
const s2 = await h.page.evaluate(async () => {
  const H = window.__HARNESS;
  H.queueInputs([{f:2,press:['light']},{f:4,release:['light']}]);
  H.stepFrames(28); H.renderFrame();   // release frame region
  return H.getWorldStats();
});
await h.page.screenshot({path: dir+'/release.png'});
const s3 = await h.page.evaluate(async () => { const H=window.__HARNESS; H.stepFrames(20); H.renderFrame(); return H.getWorldStats(); });
await h.page.screenshot({path: dir+'/inflight.png'});
const s4 = await h.page.evaluate(async () => { const H=window.__HARNESS; H.stepFrames(1200); H.renderFrame(); return H.getWorldStats(); });
await h.page.screenshot({path: dir+'/residue20s.png'});
fs.writeFileSync(dir+'/worldstats.json', JSON.stringify({idle:stats.pre, release:s2, inflight:s3, residue:s4},null,1));
console.log(JSON.stringify({idle:stats.pre, release:s2, inflight:s3, residue:s4},null,1));
await h.close();
