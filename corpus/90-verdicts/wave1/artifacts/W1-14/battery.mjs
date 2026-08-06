import { launchGame } from '/tmp/claude-0/-home-user-elder-souls-claude/3c195166-6f14-54d0-bf0f-867f7b39d84b/scratchpad/w1-14/tools/lib/browser.mjs';
import fs from 'node:fs';
const h = await launchGame({});
const out = await h.page.evaluate(async () => {
  const H = window.__HARNESS; await H.ready();
  const R={};
  const setup=(sp)=>{H.setSeed(1337);H.loadState('arena_flat');H.setRenderRate(0);H.setWillpower(99);H.setCatalyst('rod');
    H.setMagicSkills({sorcery:100,root_speech:100,warding:100,veiling:100});H.hearthRest();H.magicEventsDrain();if(sp)H.setAttuned([sp]);};
  const castNow=(n=120)=>{H.queueInputs([{f:2,press:['light']},{f:4,release:['light']}]);H.stepFrames(n);};
  const hurt=(n)=>{const a=H.getPlayerStats().hp;H.damagePlayer(n,{});H.stepFrames(6);const b=H.getPlayerStats().hp;return a-b;};

  // 1. damage mitigation: shield / resist_element
  setup('stone_skin'); H.stepFrames(10); R.base_damage = hurt(100);
  setup('stone_skin'); castNow(); R.shield_damage = hurt(100);
  setup('thick_skin'); castNow(); R.resist_damage = hurt(100);
  // 2. restore_health
  setup('the_greater_mending'); H.damagePlayer(200,{}); H.stepFrames(10);
  const hp0=H.getPlayerStats().hp; castNow(150); R.restore={hp0, hp1:H.getPlayerStats().hp, max:H.getPlayerStats().hp_max};
  // 3. feather under heavy load
  setup('feather');
  let loadout=null; try{ loadout=H.setLoadout({armour:'heavy'}); }catch(e){ loadout='ERR '+e.message; }
  const pre=H.getPlayerStats(); castNow();
  const post=H.getPlayerStats();
  R.feather={loadout, pre:{eq:pre.equip_load_pct, roll:pre.roll_class}, post:{eq:post.equip_load_pct, roll:post.roll_class}};
  // 4. paralyse buildup on enemy
  setup('the_grey_fuzz'); const e1=H.spawn('inf_trash',0,6); H.aggro(e1);
  castNow(200);
  const snap=H.snapshot(); R.paralyse={enemy_state:snap.enemies[0].state, keys_with_status:Object.keys(snap.enemies[0]).filter(k=>/status|buildup|paral/i.test(k)), stagger:snap.enemies[0].stagger};
  // 5. calm_beast on an aggroed beast
  setup('still_the_beast'); const e2=H.spawn('beast_slitherfang',0,6); H.aggro(e2);
  castNow(240);
  const s2=H.snapshot(); R.calm={alert:s2.enemies[0].alert_state, state:s2.enemies[0].state, in_combat:H.getPlayerStats().in_combat, hp:s2.enemies[0].hp};
  // 6. silence: does it stop the sap-speaker casting?
  setup('silence'); const e3=H.spawn('cst_sap_speaker',0,8); H.aggro(e3);
  const states=[]; for(let i=0;i<400;i++){H.stepFrames(1); const s=H.snapshot(); if(s.enemies[0]) states.push(s.enemies[0].state);}
  R.sap_speaker_states=[...new Set(states)];
  // 7. mark + recall position
  setup('mark'); const posA=H.getPlayerStats().pos.slice();
  H.queueInputs([{f:2,press:['light']},{f:4,release:['light']}]); H.stepFrames(260);
  const markEv=H.magicEventsDrain();
  H.teleport(60, 60); H.setAttuned(['recall']); H.magicEventsDrain();
  const posB=H.getPlayerStats().pos.slice();
  H.queueInputs([{f:2,press:['light']},{f:4,release:['light']}]); H.stepFrames(260);
  R.teleport={posA, posB, posC:H.getPlayerStats().pos.slice(), markEv:markEv.map(e=>e.kind+'@'+e.f), recallEv:H.magicEventsDrain().map(e=>e.kind+'@'+e.f)};
  // 8. hist_sight journal
  setup('hist_sight'); const j0=(H.getQuestState().journal||[]).length;
  H.queueInputs([{f:2,press:['light']},{f:4,release:['light']}]); H.stepFrames(260);
  R.hist_sight={j0, j1:(H.getQuestState().journal||[]).length, ev:H.magicEventsDrain().map(e=>e.kind+'@'+e.f)};
  // 9. soul_trap -> gem
  setup('root_theft'); const g0=H.getMagicState().gems;
  const e4=H.spawn('inf_trash',0,5); H.aggro(e4);
  castNow(200);
  R.soul_trap={gems0:g0, gems1:H.getMagicState().gems, xul:H.getMagicState().xul_hesh};
  // 10. open_lock on a real lock
  setup('open');
  let lockInfo=null;
  try { lockInfo = H.listLocks ? H.listLocks() : null; } catch(e){ lockInfo='ERR '+e.message; }
  R.locks = lockInfo;
  return R;
});
fs.writeFileSync('/tmp/claude-0/-home-user-elder-souls-claude/3c195166-6f14-54d0-bf0f-867f7b39d84b/scratchpad/critic/battery.json', JSON.stringify(out,null,1));
console.log(JSON.stringify(out,null,1));
await h.close();
