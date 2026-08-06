import { launchGame } from '/home/user/elder-souls-claude/tools/lib/browser.mjs';
import fs from 'node:fs';
const h = await launchGame({});
const r = await h.page.evaluate(async () => {
  const H = window.__HARNESS; await H.ready();
  H.setSeed(1337);H.loadState('arena_flat');H.setRenderRate(0);H.setWillpower(50);H.setCatalyst('rod');
  const before=H.setMagicSkills({sorcery:20,root_speech:20,warding:20,veiling:20});
  H.hearthRest(); H.setAttuned(['spark_dart']); H.magicEventsDrain();
  let casts=0;
  for (let i=0;i<60;i++){ H.queueInputs([{f:1,press:['light']},{f:3,release:['light']}]); H.stepFrames(45); if(i%10===0) H.hearthRest(); }
  const ev=H.magicEventsDrain(); casts=ev.filter(e=>e.kind==='cast_release').length;
  return { before, after:H.setMagicSkills({}), cast_release_events:casts,
           skill_surface_in_harness: Object.keys(H).filter(k=>/skill/i.test(k)),
           note:'RI-PRG03 §3/§4: casting must be a use event. 60 casts, school skill unchanged.' };
});
fs.writeFileSync('/home/user/elder-souls-claude/corpus/90-verdicts/wave1/artifacts/W1-14/skill-by-use-absence.json', JSON.stringify(r,null,1));
console.log(JSON.stringify(r));
await h.close();
