import { launchGame } from '/tmp/claude-0/-home-user-elder-souls-claude/3c195166-6f14-54d0-bf0f-867f7b39d84b/scratchpad/w1-14/tools/lib/browser.mjs';
import fs from 'node:fs';
const h = await launchGame({});
const out = await h.page.evaluate(async () => {
  const H = window.__HARNESS; await H.ready();
  const R={};
  const setup=(sp)=>{H.setSeed(1337);H.loadState('arena_flat');H.setRenderRate(0);H.setWillpower(99);H.setCatalyst('rod');
    H.setMagicSkills({sorcery:100,root_speech:100,warding:100,veiling:100});H.hearthRest();H.magicEventsDrain();H.setAttuned([sp]);};
  // A: ascent with jump held
  setup('the_long_flight');
  H.queueInputs([{f:2,press:['light']},{f:4,release:['light']}]); H.stepFrames(100);
  const s0=H.getMagicState();
  H.queueInputs([{f:1,press:['jump']}]);
  const asc=[]; for(let i=0;i<600;i++){H.stepFrames(1); if(i%100===0||i===599){const s=H.getMagicState();const p=H.getPlayerStats();asc.push({f:H.getFrame(),alt:s.altitude_m,focus:s.focus,y:p.pos[1],state:p.state});}}
  R.ascent={s0:{alt:s0.altitude_m,focus:s0.focus,lev:s0.levitating},asc};
  // B: horizontal drift while levitating (jump released, move forward + sprint)
  setup('the_long_flight');
  H.queueInputs([{f:2,press:['light']},{f:4,release:['light']}]); H.stepFrames(100);
  H.queueInputs([{f:1,move:[0,1]},{f:1,press:['sprint']}]);
  const p1=H.getPlayerStats().pos.slice(); H.stepFrames(120); const p2=H.getPlayerStats().pos.slice();
  R.drift={from:p1,to:p2,mps:Math.hypot(p2[0]-p1[0],p2[2]-p1[2])/2, lev:H.getMagicState().levitating, state:H.getPlayerStats().state};
  // C: walk speed baseline, no levitate
  setup('feather'); H.queueInputs([{f:1,move:[0,1]}]); const q1=H.getPlayerStats().pos.slice(); H.stepFrames(120); const q2=H.getPlayerStats().pos.slice();
  R.walk={mps:Math.hypot(q2[0]-q1[0],q2[2]-q1[2])/2, state:H.getPlayerStats().state};
  // D: actions denied while AIRBORNE?
  setup('the_long_flight');
  H.queueInputs([{f:2,press:['light']},{f:4,release:['light']}]); H.stepFrames(100);
  const acts={};
  for (const b of ['light','heavy','roll','block','parry']) {
    H.queueInputs([{f:1,press:[b]},{f:3,release:[b]}]);
    const st=[]; for(let i=0;i<40;i++){H.stepFrames(1);st.push(H.getPlayerStats().state);}
    acts[b]=[...new Set(st)];
  }
  R.airborne_actions={acts, lev_after:H.getMagicState().levitating};
  // E: damage ends levitation
  setup('the_long_flight');
  H.queueInputs([{f:2,press:['light']},{f:4,release:['light']}]); H.stepFrames(100);
  const levBefore=H.getMagicState().levitating; H.damagePlayer(10,{}); H.stepFrames(10);
  R.damage_ends={levBefore, levAfter:H.getMagicState().levitating};
  // F: iframes while levitating
  setup('the_long_flight'); H.queueInputs([{f:2,press:['light']},{f:4,release:['light']}]); H.stepFrames(100);
  H.queueInputs([{f:1,press:['roll']},{f:3,release:['roll']}]);
  let anyIframe=false; for(let i=0;i<40;i++){H.stepFrames(1); if(H.snapshot().player.iframe) anyIframe=true;}
  R.iframe_while_levitating=anyIframe;
  return R;
});
fs.writeFileSync('/tmp/claude-0/-home-user-elder-souls-claude/3c195166-6f14-54d0-bf0f-867f7b39d84b/scratchpad/critic/levitation.json', JSON.stringify(out,null,1));
console.log(JSON.stringify(out,null,1));
await h.close();
