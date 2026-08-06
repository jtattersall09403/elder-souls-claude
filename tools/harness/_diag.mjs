#!/usr/bin/env node
import { parseArgs } from '../lib/cli.mjs';
import { launchGame } from '../lib/browser.mjs';
const args = parseArgs();
const handle = await launchGame(args);
await handle.hOpt('setRenderRate', 0);
const r = await handle.page.evaluate(`(function(){
  const H=window.__HARNESS; const cs=()=>H.getCombatState(); const R=[];
  for (const d of [1.0,1.2,1.4,1.6,1.8,2.0,2.2,2.4,2.6]) {
    H.setSeed(0); H.loadState('arena_champion'); H.lockOn('E1');
    H.teleport(0, 4.6-d, {yaw:0}); H.stepFrames(6);
    const d0 = cs().enemies[0].dist_m;
    H.queueInputs([{f:1,press:['light']},{f:3,release:['light']}]);
    let hp0=null,hpN=null,dmin=99;
    for(let i=1;i<=120;i++){ H.stepFrames(1); const c=cs(); const e=c.enemies[0];
      if(hp0===null)hp0=e.hp; hpN=e.hp; dmin=Math.min(dmin,e.dist_m); }
    R.push({want:d, actual_d0:+d0.toFixed(2), dmg:+(hp0-hpN).toFixed(1), min_dist:+dmin.toFixed(2)});
  }
  return R;
})()`);
console.log(JSON.stringify(r));
await handle.close();
