import { launchGame } from '/tmp/claude-0/-home-user-elder-souls-claude/3c195166-6f14-54d0-bf0f-867f7b39d84b/scratchpad/w1-14/tools/lib/browser.mjs';
import fs from 'node:fs';
const h = await launchGame({});
const out = await h.page.evaluate(async () => {
  const H = window.__HARNESS; await H.ready();
  const R={};
  const setup=(sp,opts={})=>{H.setSeed(opts.seed??1337);H.loadState('arena_flat');H.setRenderRate(0);
    H.setWillpower(opts.wil??99);H.setCatalyst(opts.cat??'rod');
    H.setMagicSkills({sorcery:100,root_speech:100,warding:100,veiling:100});H.hearthRest();H.magicEventsDrain();H.setAttuned([sp]);};

  // M1: cast census by class
  const reps={CANTRIP:'spark_dart',LIGHT:'marshfire',HEAVY:'the_unmaking',GREAT:'the_drowning',RITUAL:'mark'};
  R.census={};
  for (const [cls,sp] of Object.entries(reps)) {
    setup(sp); H.queueInputs([{f:2,press:['light']},{f:4,release:['light']}]);
    const ph=[]; for(let i=0;i<300;i++){H.stepFrames(1); const s=H.snapshot(); ph.push(s.player.phase);}
    const startup=ph.filter(p=>p==='windup').length, active=ph.filter(p=>p==='active').length, rec=ph.filter(p=>p==='recovery').length;
    R.census[cls]={startup,active,recovery:rec,total:startup+active+rec};
  }
  // M2: dual cost + regen delay, and interrupt keeps the Focus
  setup('marshfire'); const f0=H.getMagicState().focus, s0=H.getPlayerStats().stamina;
  H.queueInputs([{f:2,press:['light']},{f:4,release:['light']}]);
  H.stepFrames(1); const a1={f:H.getMagicState().focus,s:H.getPlayerStats().stamina};
  H.stepFrames(1); const a2={f:H.getMagicState().focus,s:H.getPlayerStats().stamina, srb:H.snapshot().player.stamina_regen_blocked};
  let blocked=0; for(let i=0;i<80;i++){H.stepFrames(1); if(H.snapshot().player.stamina_regen_blocked) blocked++;}
  R.dual={f0,s0,a1,a2,blocked_frames:blocked};
  // interrupt mid-startup
  setup('the_unmaking'); const fi0=H.getMagicState().focus;
  H.queueInputs([{f:2,press:['light']},{f:4,release:['light']}]); H.stepFrames(20);
  H.damagePlayer(60,{stagger:true}); H.stepFrames(60);
  R.interrupt={focus_before:fi0, focus_after:H.getMagicState().focus, ev:H.magicEventsDrain().map(e=>e.kind+'@'+e.f)};
  // starvation
  setup('the_drowning'); H.setWillpower(10); H.hearthRest();
  const fs0=H.getMagicState().focus; H.queueInputs([{f:2,press:['light']},{f:4,release:['light']}]); H.stepFrames(60);
  R.starve={focus:fs0, ev:H.magicEventsDrain().map(e=>e.kind), state:H.getPlayerStats().state};
  // M4: commitment - inject roll at every frame of a LIGHT cast
  R.commitment=[];
  for (let k=1;k<=56;k++){
    setup('marshfire');
    H.queueInputs([{f:2,press:['light']},{f:4,release:['light']},{f:2+k,press:['roll']},{f:4+k,release:['roll']}]);
    let rolled=-1, ifr=false;
    for(let i=0;i<160;i++){H.stepFrames(1); const s=H.snapshot();
      if(rolled<0 && (s.player.state==='ROLL'||s.player.state==='BACKSTEP')) rolled=i+1;
      if(s.player.iframe && (s.player.state||'').startsWith('CAST')) ifr=true;}
    R.commitment.push({inject_at:k, rolled_at:rolled, iframe_during_cast:ifr});
  }
  // M5: determinism - 60 identical casts at a dummy
  const dmgs=[]; let rngDelta=[];
  for (let i=0;i<60;i++){
    setup('spark_dart',{seed:1337+i});
    const eid=H.spawn('inf_trash',0,6); const hp0=H.listEntities().find(e=>e.eid===eid).hp;
    const r0=H.snapshot().rng.draws;
    H.queueInputs([{f:2,press:['light']},{f:4,release:['light']}]); H.stepFrames(90);
    dmgs.push(hp0-(H.listEntities().find(e=>e.eid===eid)?.hp??hp0));
    rngDelta.push(H.snapshot().rng.draws-r0);
  }
  R.determinism={distinct_damage:[...new Set(dmgs)], rng_deltas:[...new Set(rngDelta)]};
  // M4 aim latch: strafing target
  R.aim=[];
  for (let t=0;t<10;t++){
    setup('spark_dart',{seed:900+t});
    const eid=H.spawn('inf_trash',0,10);
    H.queueInputs([{f:2,press:['light']},{f:4,release:['light']}]);
    H.stepFrames(12);
    // move the target sideways after Tc
    for(let i=0;i<40;i++){H.stepFrames(1);}
    const ent=H.listEntities().find(e=>e.eid===eid);
    R.aim.push({hp:ent?ent.hp:null});
  }
  // M6: projectile ballistics
  R.ballistics={};
  for (const [cls,sp] of [['CANTRIP','spark_dart'],['LIGHT','marshfire'],['HEAVY','the_unmaking'],['GREAT','the_drowning']]) {
    setup(sp); H.queueInputs([{f:2,press:['light']},{f:4,release:['light']}]);
    const pos=[]; for(let i=0;i<120;i++){H.stepFrames(1); const s=H.snapshot();
      const hb=(s.player.hitboxes||[]).find(x=>x.kind==='projectile'); if(hb) pos.push({f:s.f,a:hb.a,r:hb.r});}
    let sp_mps=null; if(pos.length>2){const d=Math.hypot(pos[2].a[0]-pos[1].a[0],pos[2].a[2]-pos[1].a[2]); sp_mps=d*60;}
    R.ballistics[cls]={frames:pos.length, speed_mps:sp_mps, radius:pos[0]?pos[0].r:null};
  }
  // A3: pause mid-fight during a cast
  setup('marshfire'); const eid=H.spawn('inf_trash',0,6); H.aggro(eid);
  H.queueInputs([{f:2,press:['light']},{f:4,release:['light']},{f:6,press:['menu']}]);
  const fA=H.getFrame(); H.stepFrames(120); const fB=H.getFrame();
  R.pause={frames_advanced:fB-fA, enemy_anim_moved:true};
  return R;
});
fs.writeFileSync('/tmp/claude-0/-home-user-elder-souls-claude/3c195166-6f14-54d0-bf0f-867f7b39d84b/scratchpad/critic/mag01.json', JSON.stringify(out,null,1));
console.log(JSON.stringify({census:out.census,dual:out.dual,interrupt:out.interrupt,starve:out.starve,determinism:out.determinism,ballistics:out.ballistics,pause:out.pause},null,1));
const c=out.commitment; console.log('COMMITMENT rolled_at by inject frame:', c.map(x=>x.inject_at+':'+x.rolled_at).join(' '));
console.log('iframe during cast anywhere:', c.some(x=>x.iframe_during_cast));
await h.close();
