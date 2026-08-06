import { launchGame } from '/tmp/claude-0/-home-user-elder-souls-claude/3c195166-6f14-54d0-bf0f-867f7b39d84b/scratchpad/w1-14/tools/lib/browser.mjs';
import fs from 'node:fs';
const h = await launchGame({});
const out = await h.page.evaluate(async () => {
  const H = window.__HARNESS; await H.ready();
  const R={};
  const setup=(sp)=>{H.setSeed(1337);H.loadState('arena_flat');H.setRenderRate(0);H.setWillpower(99);H.setCatalyst('rod');
    H.setMagicSkills({sorcery:100,root_speech:100,warding:100,veiling:100});H.hearthRest();H.magicEventsDrain();H.setAttuned([sp]);};
  for (const sp of ['leech','sap_thief','verdigris','rime_touch','wamasu_arc','charm','make_it_whole','seal','loosen_the_joint','spring_the_trap','long_hand']) {
    setup(sp);
    const eid=H.spawn('inf_trash',0,1.4);
    const hp0=H.listEntities().find(e=>e.eid===eid).hp;
    const php0=H.getPlayerStats().hp;
    H.queueInputs([{f:2,press:['light']},{f:4,release:['light']}]);
    H.stepFrames(200);
    const ent=H.listEntities().find(e=>e.eid===eid);
    R[sp]={hp0, hp1:ent?ent.hp:null, php0, php1:H.getPlayerStats().hp, ev:H.magicEventsDrain().map(e=>e.kind+(e.effect?':'+e.effect:'')+'@'+e.f), active:H.getMagicState().effects_active.map(e=>e.effect)};
  }
  // soul_trap on a kill
  setup('root_theft'); const e2=H.spawn('inf_trash',0,4); H.aggro(e2);
  const g0=H.getMagicState().gems;
  for (let i=0;i<12;i++){ H.queueInputs([{f:2,press:['light']},{f:4,release:['light']}]); H.stepFrames(90); }
  const alive=H.listEntities().find(e=>e.eid===e2);
  R.soul_trap_kill={gems0:g0, gems1:H.getMagicState().gems, xul:H.getMagicState().xul_hesh, enemy_hp:alive?alive.hp:'gone'};
  return R;
});
fs.writeFileSync('/tmp/claude-0/-home-user-elder-souls-claude/3c195166-6f14-54d0-bf0f-867f7b39d84b/scratchpad/critic/touch.json', JSON.stringify(out,null,1));
for (const [k,v] of Object.entries(out)) console.log(k, JSON.stringify(v));
await h.close();
