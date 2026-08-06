import { launchGame } from '/tmp/claude-0/-home-user-elder-souls-claude/3c195166-6f14-54d0-bf0f-867f7b39d84b/scratchpad/w1-14/tools/lib/browser.mjs';
import fs from 'node:fs';
const h = await launchGame({});
const out = await h.page.evaluate(async () => {
  const H = window.__HARNESS; await H.ready();
  const R={};
  H.setSeed(1337); H.loadState('arena_flat'); H.setRenderRate(0);
  H.setWillpower(99); H.setCatalyst('rod'); H.setMagicSkills({sorcery:100,root_speech:100,warding:100,veiling:100});
  H.setGold(200000); H.hearthRest();
  const D=H.getMagicData(); for (const sp of D.spells.spells) H.learnSpell(sp.id);
  // S15 firewall: souls untouched by trapping/enchanting
  const s0=H.getPlayerStats().souls, g0=H.getGold();
  const t1=H.trapSoul('nm_1','greater',false);
  const s1=H.getPlayerStats().souls;
  const t2=H.trapSoul('nm_1','greater',false); // respawn downgrade
  const t3=H.trapSoul('npc_1','grand',true);   // speaker: must do nothing
  R.souls={s0,s1,s2:H.getPlayerStats().souls, t1,t2,t3, xul:H.getMagicState().xul_hesh, gems:H.getMagicState().gems};
  // xul_hesh consequences
  for (let i=0;i<15;i++) H.trapSoul('nm_'+i,'common',false);
  R.xul=H.getXulHesh();
  R.disp_after = H.getQuestState().dispositions;
  // enchanting
  const eq=(o)=>{try{return H.enchantQuote(o);}catch(e){return 'ERR:'+e.message;}};
  R.ench_ring_t2 = eq({itemClass:'ring', kind:'on_use', range:'target', enchanter:'self', soulGrade:'common', effects:[{effect:'open_lock',magnitude:20,duration_s:0,area_r_m:0}]});
  R.ench_over = eq({itemClass:'ring', kind:'on_use', range:'target', enchanter:'self', soulGrade:'common', effects:[{effect:'open_lock',magnitude:60,duration_s:0,area_r_m:0}]});
  R.ench_constant_petty = eq({itemClass:'medium_armour', kind:'constant', range:'self', enchanter:'self', soulGrade:'petty', effects:[{effect:'resist_element',magnitude:30,duration_s:0,area_r_m:0}]});
  // gate determinism: skill threshold
  const probe=(skill)=>{ H.setMagicSkills({warding:skill}); return H.quoteSpell({effects:[{effect:'levitate',magnitude:1,duration_s:60,area_r_m:0}],range:'self',class:'LIGHT'}); };
  R.gate={at44:probe(44), at45:probe(45), at64:probe(64), at65:probe(65)};
  H.setMagicSkills({warding:100});
  // gold-only: is any price denominated in souls/charge?
  R.gold_after = H.getGold();
  return R;
});
fs.writeFileSync('/tmp/claude-0/-home-user-elder-souls-claude/3c195166-6f14-54d0-bf0f-867f7b39d84b/scratchpad/critic/mag03.json', JSON.stringify(out,null,1));
console.log(JSON.stringify(out,null,1).slice(0,5000));
await h.close();
