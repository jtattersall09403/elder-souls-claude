import { launchGame } from '/tmp/claude-0/-home-user-elder-souls-claude/3c195166-6f14-54d0-bf0f-867f7b39d84b/scratchpad/w1-14/tools/lib/browser.mjs';
import fs from 'node:fs';
const h = await launchGame({});
const out = await h.page.evaluate(async () => {
  const H = window.__HARNESS; await H.ready();
  const R={made:[], errors:[]};
  H.setSeed(1337); H.loadState('arena_flat'); H.setRenderRate(0);
  H.setWillpower(99); H.setCatalyst('rod');
  H.setMagicSkills({sorcery:100,root_speech:100,warding:100,veiling:100});
  H.setGold(500000); H.hearthRest();
  // learn every shipped spell so the effect-knowledge gate is satisfied
  const D=H.getMagicData();
  for (const sp of D.spells.spells) { try { H.learnSpell(sp.id); } catch(e){ R.errors.push('learn '+sp.id+': '+e.message); } }
  const tuples = [
    {name:'Critic Three-Fold', spec:{effects:[{effect:'fire_damage',magnitude:41,duration_s:7,area_r_m:3},{effect:'chameleon',magnitude:13,duration_s:44,area_r_m:0},{effect:'feather',magnitude:29,duration_s:61,area_r_m:0}],range:'target',class:'LIGHT'}},
    {name:'Critic Max Mag', spec:{effects:[{effect:'fire_damage',magnitude:200,duration_s:1,area_r_m:0}],range:'projectile',class:'LIGHT'}},
    {name:'Critic Max Dur', spec:{effects:[{effect:'chameleon',magnitude:5,duration_s:300,area_r_m:0}],range:'self',class:'CANTRIP'}},
    {name:'Critic Over Pool', spec:{effects:[{effect:'frost_damage',magnitude:180,duration_s:25,area_r_m:6}],range:'area_at_range',class:'GREAT'}},
    {name:'Critic Nonsense', spec:{effects:[{effect:'invisibility',magnitude:10,duration_s:30,area_r_m:0},{effect:'fire_damage',magnitude:22,duration_s:4,area_r_m:5}],range:'area_at_range',class:'HEAVY'}},
    {name:'Critic Tiny', spec:{effects:[{effect:'night_eye',magnitude:3,duration_s:11,area_r_m:0}],range:'self',class:'CANTRIP'}},
  ];
  for (const t of tuples) {
    try {
      const q = H.quoteSpell(t.spec);
      const m = H.makeSpell(t.spec, t.name);
      R.made.push({name:t.name, quote:q, made:m});
    } catch(e) { R.made.push({name:t.name, error:String(e.message||e)}); }
  }
  // can we attune and cast one?
  const first = R.made.find(m=>m.made && m.made.id);
  if (first) {
    const id = first.made.id;
    const att = H.setAttuned([id]);
    H.magicEventsDrain();
    const eid=H.spawn('inf_trash',0,6);
    H.queueInputs([{f:2,press:['light']},{f:4,release:['light']}]);
    H.stepFrames(200);
    R.cast_custom = {id, attuned:att, events:H.magicEventsDrain(), enemy:H.listEntities().find(e=>e.eid===eid), magicState:H.getMagicState()};
  }
  // does it survive saveState?
  try { const sv=H.saveState(); R.save_has_custom = JSON.stringify(sv).includes(R.made.find(m=>m.made)?.made?.id || '@@'); } catch(e){ R.save_err=String(e.message); }
  R.custom_count = H.getMagicState().custom_spells;
  return R;
});
fs.writeFileSync('/tmp/claude-0/-home-user-elder-souls-claude/3c195166-6f14-54d0-bf0f-867f7b39d84b/scratchpad/critic/spellmaking.json', JSON.stringify(out,null,1));
console.log(JSON.stringify(out,null,1).slice(0,6000));
await h.close();
