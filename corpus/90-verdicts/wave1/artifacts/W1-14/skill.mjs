import { launchGame } from '/tmp/claude-0/-home-user-elder-souls-claude/3c195166-6f14-54d0-bf0f-867f7b39d84b/scratchpad/w1-14/tools/lib/browser.mjs';
const h = await launchGame({});
const r = await h.page.evaluate(async () => {
  const H = window.__HARNESS; await H.ready();
  H.setSeed(1337);H.loadState('arena_flat');H.setRenderRate(0);H.setWillpower(50);H.setCatalyst('rod');
  const before=H.setMagicSkills({sorcery:20,root_speech:20,warding:20,veiling:20});
  H.hearthRest(); H.setAttuned(['spark_dart']);
  for (let i=0;i<60;i++){ H.queueInputs([{f:1,press:['light']},{f:3,release:['light']}]); H.stepFrames(45); if(i%10===0) H.hearthRest(); }
  const after=H.setMagicSkills({});
  return {before, after, keys:Object.keys(H).filter(k=>/skill|prog|level/i.test(k))};
});
console.log(JSON.stringify(r,null,1));
await h.close();
