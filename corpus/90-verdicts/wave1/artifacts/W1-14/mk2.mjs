import { launchGame } from '/tmp/claude-0/-home-user-elder-souls-claude/3c195166-6f14-54d0-bf0f-867f7b39d84b/scratchpad/w1-14/tools/lib/browser.mjs';
import fs from 'node:fs';
const h = await launchGame({});
const out = await h.page.evaluate(async () => {
  const H = window.__HARNESS; await H.ready();
  const R={};
  H.setSeed(1337); H.loadState('arena_flat'); H.setRenderRate(0);
  H.setWillpower(99); H.setCatalyst('rod');
  H.setMagicSkills({sorcery:100,root_speech:100,warding:100,veiling:100});
  H.setGold(500000); H.hearthRest();
  const D=H.getMagicData(); for (const sp of D.spells.spells) H.learnSpell(sp.id);
  // nonsense at a legal shared range
  R.nonsense = H.makeSpell({effects:[{effect:'invisibility',magnitude:10,duration_s:30,area_r_m:0},{effect:'fire_damage',magnitude:22,duration_s:4,area_r_m:0}],range:'target',class:'HEAVY'},'Critic Nonsense B');
  // a simple castable custom
  const mk = H.makeSpell({effects:[{effect:'night_eye',magnitude:3,duration_s:11,area_r_m:0}],range:'self',class:'CANTRIP'},'Critic Tiny');
  const id = mk.spell.id;
  const att = H.setAttuned([id]); H.magicEventsDrain();
  H.queueInputs([{f:2,press:['light']},{f:4,release:['light']}]); H.stepFrames(120);
  R.cast_custom={id, attuned:att, events:H.magicEventsDrain(), active:H.getMagicState().effects_active};
  // 3-effect custom, cast at an enemy
  const mk2 = H.makeSpell({effects:[{effect:'fire_damage',magnitude:41,duration_s:7,area_r_m:0},{effect:'burden',magnitude:13,duration_s:44,area_r_m:0},{effect:'silence',magnitude:9,duration_s:20,area_r_m:0}],range:'target',class:'LIGHT'},'Critic Trio');
  H.setAttuned([mk2.spell.id]); H.magicEventsDrain();
  const eid=H.spawn('inf_trash',0,6); const hp0=H.listEntities().find(e=>e.eid===eid).hp;
  H.queueInputs([{f:2,press:['light']},{f:4,release:['light']}]); H.stepFrames(200);
  R.cast_trio={id:mk2.spell.id, fb:mk2.spell.focus_base, events:H.magicEventsDrain(), hp0, hp1:H.listEntities().find(e=>e.eid===eid)?.hp};
  // saveState round trip
  const sv=H.saveState(); const j=JSON.stringify(sv);
  R.save={has_custom_id:j.includes(id), keys:Object.keys(sv), magic_key: sv.magic? Object.keys(sv.magic):null, len:j.length};
  return R;
});
fs.writeFileSync('/tmp/claude-0/-home-user-elder-souls-claude/3c195166-6f14-54d0-bf0f-867f7b39d84b/scratchpad/critic/spellmaking2.json', JSON.stringify(out,null,1));
console.log(JSON.stringify(out,null,1).slice(0,5000));
await h.close();
