import { launchGame } from '/tmp/claude-0/-home-user-elder-souls-claude/3c195166-6f14-54d0-bf0f-867f7b39d84b/scratchpad/w1-14/tools/lib/browser.mjs';
import fs from 'node:fs';
const h = await launchGame({});
const out = await h.page.evaluate(async () => {
  const H = window.__HARNESS; await H.ready();
  const R = {};
  const setup = (spell) => {
    H.setSeed(1337); H.loadState('arena_flat'); H.setRenderRate(0);
    H.setWillpower(99); H.setCatalyst('rod');
    H.setMagicSkills({sorcery:100, root_speech:100, warding:100, veiling:100});
    H.hearthRest(); H.magicEventsDrain(); H.setAttuned([spell]);
  };
  const cast = (spell, frames=120) => { setup(spell); H.queueInputs([{f:2,press:['light']},{f:4,release:['light']}]); H.stepFrames(frames); };

  // 1. feather -> equip load / roll class
  { const before = (()=>{setup('feather'); return H.getPlayerStats();})();
    H.queueInputs([{f:2,press:['light']},{f:4,release:['light']}]); H.stepFrames(120);
    const after = H.getPlayerStats();
    R.feather = { before:{eq:before.equip_load_pct, roll:before.roll_class, burden:before.burden_ratio, tier:before.burden_tier}, after:{eq:after.equip_load_pct, roll:after.roll_class, burden:after.burden_ratio, tier:after.burden_tier}, effects: H.getMagicState().effects_active };
  }
  // 2. restore_health on a damaged player
  { setup('the_greater_mending'); H.damagePlayer(200,{}); const hp0=H.getPlayerStats().hp;
    H.queueInputs([{f:2,press:['light']},{f:4,release:['light']}]); H.stepFrames(150);
    R.restore_health = { hp0, hp1: H.getPlayerStats().hp, ev: H.magicEventsDrain().filter(e=>e.kind==='effect_apply') }; }
  // 3. resist_element: damage taken with and without
  { setup('thick_skin'); H.stepFrames(5); const hpA0=H.getPlayerStats().hp; H.damagePlayer(100,{}); const hpA1=H.getPlayerStats().hp;
    setup('thick_skin'); H.queueInputs([{f:2,press:['light']},{f:4,release:['light']}]); H.stepFrames(120);
    const hpB0=H.getPlayerStats().hp; H.damagePlayer(100,{}); const hpB1=H.getPlayerStats().hp;
    R.resist_element = { no_buff: hpA0-hpA1, with_buff: hpB0-hpB1, active: H.getMagicState().effects_active }; }
  // 4. shield
  { setup('stone_skin'); H.stepFrames(5); const a0=H.getPlayerStats().hp; H.damagePlayer(100,{}); const a1=H.getPlayerStats().hp;
    setup('stone_skin'); H.queueInputs([{f:2,press:['light']},{f:4,release:['light']}]); H.stepFrames(120);
    const b0=H.getPlayerStats().hp; H.damagePlayer(100,{}); const b1=H.getPlayerStats().hp;
    R.shield = { no_buff: a0-a1, with_buff: b0-b1, active: H.getMagicState().effects_active }; }
  // 5. levitate: altitude + drift + focus per metre
  { setup('levitate'); H.queueInputs([{f:2,press:['light']},{f:4,release:['light']}]); H.stepFrames(80);
    const s0=H.getMagicState(); const p0=H.getPlayerStats();
    H.queueInputs([{f:1, move:[0,1]}]);
    const samples=[];
    for(let i=0;i<300;i++){ H.stepFrames(1); if(i%50===0){const s=H.getMagicState(); const p=H.getPlayerStats(); samples.push({f:H.getFrame(), alt:s.altitude_m, focus:s.focus, pos:p.pos, state:p.state});} }
    R.levitate = { s0:{alt:s0.altitude_m, focus:s0.focus, lev:s0.levitating, air:s0.airborne}, p0:p0.pos, samples }; }
  // 6. chameleon clamp + stealth coupling
  { setup('the_deep_chameleon'); H.queueInputs([{f:2,press:['light']},{f:4,release:['light']}]); H.stepFrames(140);
    R.chameleon = { active: H.getMagicState().effects_active, vis: null }; }
  // 7. night_eye / detect_life / hist_sight journal
  { setup('warm_smudges'); H.queueInputs([{f:2,press:['light']},{f:4,release:['light']}]); H.stepFrames(140);
    R.detect_life = { active: H.getMagicState().effects_active, quest: (H.getQuestState? Object.keys(H.getQuestState()):null) }; }
  // 8. invisibility break
  { setup('the_water_film'); H.queueInputs([{f:2,press:['light']},{f:4,release:['light']}]); H.stepFrames(120);
    const before = H.getMagicState().effects_active.map(e=>e.effect);
    H.setAttuned(['spark_dart']); H.queueInputs([{f:2,press:['light']},{f:4,release:['light']}]); H.stepFrames(60);
    R.invisibility = { before, after: H.getMagicState().effects_active.map(e=>e.effect) }; }
  // 9. fortify_skill gate
  { setup('sure_hand'); H.queueInputs([{f:2,press:['light']},{f:4,release:['light']}]); H.stepFrames(120);
    R.fortify_skill = { active: H.getMagicState().effects_active, skills: H.getMagicState().skills || null, playerSkills: (H.getPlayerStats().attributes||null) }; }
  // 10. effects_active shape
  { setup('feather'); H.queueInputs([{f:2,press:['light']},{f:4,release:['light']}]); H.stepFrames(60);
    R.effect_shape = H.getMagicState().effects_active; }
  return R;
});
fs.writeFileSync('/tmp/claude-0/-home-user-elder-souls-claude/3c195166-6f14-54d0-bf0f-867f7b39d84b/scratchpad/critic/self-effects.json', JSON.stringify(out,null,1));
console.log(JSON.stringify(out,null,1));
await h.close();
