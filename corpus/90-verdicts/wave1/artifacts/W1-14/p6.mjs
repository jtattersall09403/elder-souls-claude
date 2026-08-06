import { launchGame } from '/tmp/claude-0/-home-user-elder-souls-claude/3c195166-6f14-54d0-bf0f-867f7b39d84b/scratchpad/w1-14/tools/lib/browser.mjs';
import fs from 'node:fs';
const h = await launchGame({});
const out = await h.page.evaluate(async () => {
  const H = window.__HARNESS; await H.ready();
  const R={};
  const setup=(sp)=>{H.setSeed(1337);H.loadState('arena_flat');H.setRenderRate(0);H.setWillpower(99);H.setCatalyst('rod');
    H.setMagicSkills({sorcery:100,root_speech:100,warding:100,veiling:100});H.hearthRest();H.magicEventsDrain();if(sp)H.setAttuned([sp]);};
  const cast=(n=130)=>{H.queueInputs([{f:2,press:['light']},{f:4,release:['light']}]);H.stepFrames(n);};
  const q={motion:'walk', equip:'light', light:0.5, distance_m:10, cover:0, surface:'stone', race:'argonian'};
  const probe=()=>({vis:H.visibilityAt(q), snd:H.soundRadiusFor({motion:'walk'}), st:H.getStealthState()});
  setup(null); H.stepFrames(5); R.base=probe();
  for (const [k,sp] of [['chameleon','the_deep_chameleon'],['invisibility','the_water_film'],['muffle','muffle'],['night_eye','night_eye'],['false_face','false_face']]) {
    setup(sp); cast(); R[k]=probe();
  }
  return R;
});
fs.writeFileSync('/tmp/claude-0/-home-user-elder-souls-claude/3c195166-6f14-54d0-bf0f-867f7b39d84b/scratchpad/critic/stealth-coupling.json', JSON.stringify(out,null,1));
for (const [k,v] of Object.entries(out)) console.log(k, 'vis=', JSON.stringify(v.vis), 'snd=', JSON.stringify(v.snd));
await h.close();
