import { launchGame } from '/home/user/elder-souls-claude/tools/lib/browser.mjs';
import fs from 'node:fs';
const h = await launchGame({});
const out = await h.page.evaluate(async () => {
  const H = window.__HARNESS; await H.ready();
  const R={};
  const setup=(sp,seed)=>{H.setSeed(seed||1337);H.loadState('arena_flat');H.setRenderRate(0);H.setWillpower(99);H.setCatalyst('rod');
    H.setMagicSkills({sorcery:100,root_speech:100,warding:100,veiling:100});H.hearthRest();H.magicEventsDrain();H.setAttuned([sp]);};
  // rng draws across a cast with NO spawn
  setup('spark_dart'); H.stepFrames(30);
  const r0=H.snapshot().rng.draws;
  H.queueInputs([{f:2,press:['light']},{f:4,release:['light']}]); H.stepFrames(120);
  R.rng_no_spawn={before:r0, after:H.snapshot().rng.draws};
  // aim latch: projectile turn rate + residual aim error against a strafing target
  const trials=[];
  for (let t=0;t<12;t++){
    setup('marshfire', 500+t);
    const eid=H.spawn('inf_trash',0,12); H.lockOn(eid);
    H.queueInputs([{f:2,press:['light']},{f:4,release:['light']}]);
    H.stepFrames(18);                      // past Tc (=16 for LIGHT)
    // now yank the target sideways every frame
    const path=[]; let bearing=null;
    for(let i=0;i<80;i++){
      const p=H.getPlayerStats().pos; const e=H.listEntities().find(x=>x.eid===eid);
      if(e) H.teleport?.(0,0); // no-op guard
      H.stepFrames(1);
      const s=H.snapshot();
      const hb=(s.player.hitboxes||[]).find(x=>x.kind==='projectile');
      if(hb) path.push(hb.a.slice());
    }
    // heading change across the flight = homing test
    let maxTurn=0;
    for(let i=2;i<path.length;i++){
      const a=Math.atan2(path[i-1][0]-path[i-2][0], path[i-1][2]-path[i-2][2]);
      const b=Math.atan2(path[i][0]-path[i-1][0], path[i][2]-path[i-1][2]);
      let d=Math.abs((b-a)*180/Math.PI); if(d>180)d=360-d;
      maxTurn=Math.max(maxTurn, d*60);
    }
    trials.push({frames:path.length, max_turn_dps:Number(maxTurn.toFixed(3))});
  }
  R.projectile_turn=trials;
  // souls firewall with a non-zero souls balance
  H.setSeed(1337); H.loadState('arena_flat'); H.setRenderRate(0);
  const before=H.getPlayerStats().souls;
  let set=null; try { set=H.addSouls? H.addSouls(5000): null; } catch(e){}
  const s0=H.getPlayerStats().souls;
  H.trapSoul('nm_x','grand',false); H.trapSoul('nm_y','greater',false);
  R.souls_firewall={before, set, s0, after:H.getPlayerStats().souls, gems:H.getMagicState().gems, keys:Object.keys(H).filter(k=>/soul|level/i.test(k))};
  return R;
});
fs.writeFileSync('/tmp/claude-0/-home-user-elder-souls-claude/3c195166-6f14-54d0-bf0f-867f7b39d84b/scratchpad/critic/aim.json', JSON.stringify(out,null,1));
console.log(JSON.stringify(out,null,1).slice(0,2500));
await h.close();
