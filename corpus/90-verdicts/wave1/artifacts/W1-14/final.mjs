import { launchGame } from '/tmp/claude-0/-home-user-elder-souls-claude/3c195166-6f14-54d0-bf0f-867f7b39d84b/scratchpad/w1-14/tools/lib/browser.mjs';
import fs from 'node:fs';
const h = await launchGame({});
const out = await h.page.evaluate(async () => {
  const H = window.__HARNESS; await H.ready();
  const R={};
  const setup=(sp)=>{H.setSeed(1337);H.loadState('arena_flat');H.setRenderRate(0);H.setWillpower(30);H.setCatalyst('rod');
    H.setMagicSkills({sorcery:20,root_speech:20,warding:20,veiling:20});H.hearthRest();H.magicEventsDrain();if(sp)H.setAttuned([sp]);};
  // Focus monotonic over 5400 frames with rest/consumables/time
  setup('spark_dart');
  let prev=H.getMagicState().focus, rises=0, casts=0;
  for (let i=0;i<5400;i++){
    if (i%200===50){ H.queueInputs([{f:1,press:['light']},{f:3,release:['light']}]); casts++; }
    if (i%900===0){ H.setTimeOfDay((i/900)%24); }
    if (i%600===0){ try{H.queueInputs([{f:1,press:['use_item']},{f:3,release:['use_item']}]);}catch(e){} }
    H.stepFrames(1);
    const f=H.getMagicState().focus;
    if (f>prev+1e-9) rises++;
    prev=f;
  }
  R.focus_monotonic={rises, casts, final:prev};
  const afterRest = (H.hearthRest(), H.getMagicState().focus);
  R.hearth_refill=afterRest;
  // skill by use: does casting raise the school skill?
  setup('spark_dart');
  const sk0 = H.getMagicState().skills || null;
  for (let i=0;i<40;i++){ H.queueInputs([{f:1,press:['light']},{f:3,release:['light']}]); H.stepFrames(45); if(i%8===0) H.hearthRest(); }
  R.skill_by_use={before:sk0, after:H.getMagicState().skills||null};
  // spell_cycle button existence
  R.spell_cycle = (()=>{ try { H.queueInputs([{f:1,press:['spell_cycle']}]); return 'accepted'; } catch(e){ return 'REJECTED: '+String(e.message).slice(0,140);} })();
  // A10: topic list during combat while casting
  R.dialogue_keys = Object.keys(H).filter(k=>/topic|dialog|talk|parley/i.test(k));
  return R;
});
fs.writeFileSync('/tmp/claude-0/-home-user-elder-souls-claude/3c195166-6f14-54d0-bf0f-867f7b39d84b/scratchpad/critic/final.json', JSON.stringify(out,null,1));
console.log(JSON.stringify(out,null,1));
await h.close();
