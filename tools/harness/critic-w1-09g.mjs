#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs, REPO_ROOT } from '../lib/cli.mjs';
import { launchGame } from '../lib/browser.mjs';
const args = parseArgs();
const OUTDIR = path.join(REPO_ROOT, 'corpus/90-verdicts/wave1/artifacts/W1-09');
const handle = await launchGame(args);
await handle.hOpt('setRenderRate', 0);
const PROBES = {
poise() {
  const H = window.__HARNESS; const cs = () => H.getCombatState();
  const R = { player_stagger: [], enemy_pool: [], stunlock: null, regen: null };
  // enemy poise pool: hit inf_trash (poise 99999? no, inf_trash) with each class, count hits to stagger
  for (const w of ['dagger','straight-sword','axe','greatsword','ultra-greatsword']) {
    H.setSeed(3); H.loadState('arena_flat'); H.setLoadout({ weapon: w });
    H.spawn('inf_trash', 0, 1.3, { as:'E' }); H.stepFrames(4);
    const q=[]; for(let i=0;i<12;i++) q.push({f:1+i*260, press:['light']},{f:3+i*260, release:['light']});
    H.queueInputs(q);
    const ev=[]; let prevSt=null, prevP=null;
    for(let i=1;i<=2600;i++){ H.stepFrames(1); const c=cs(); const e=c.enemies.find(x=>x.id==='E');
      if(!e) break;
      if(prevSt!==e.state) ev.push({f:i, st:e.state, poise:e.poise_health!==undefined?e.poise_health:null});
      prevSt=e.state; }
    const stg=[]; for(let i=0;i<ev.length;i++) if(ev[i].st==='STAGGER'){ const nx=ev.slice(i+1).find(x=>x.st!=='STAGGER'); stg.push({at:ev[i].f, len: nx?nx.f-ev[i].f:null}); }
    R.enemy_pool.push({ weapon: w, staggers: stg.slice(0,4), state_events: ev.slice(0,14) });
  }
  // player stagger from enemy chop (poise dmg 32 -> medium -> 44 f)
  H.setSeed(3); H.loadState('arena_flat'); H.spawn('inf_trash', 0, 1.4, {as:'E'}); H.stepFrames(4);
  H.queueEnemyScript('E',[{f:5,move:'chop'},{f:300,move:'chop'}]);
  const pev=[]; let ps=null;
  for(let i=1;i<=600;i++){ H.stepFrames(1); const c=cs(); if(ps!==c.player.state) pev.push({f:i, st:c.player.state, poise:c.player.poise_health, hp:c.player.hp}); ps=c.player.state; }
  R.player_stagger = pev.slice(0, 20);
  // stunlock: two chops close together while staggered
  H.setSeed(3); H.loadState('arena_flat'); H.spawn('inf_trash',0,1.4,{as:'E'}); H.stepFrames(4);
  H.queueEnemyScript('E',[{f:5,move:'chop'},{f:160,move:'chop'}]);
  const s2=[]; let p2=null;
  for(let i=1;i<=500;i++){ H.stepFrames(1); const c=cs(); if(p2!==c.player.state) s2.push({f:i,st:c.player.state}); p2=c.player.state; }
  R.stunlock = s2.slice(0,20);
  return R;
},
};
for (const name of Object.keys(PROBES)) {
  let res; try { res = await handle.page.evaluate(`(function ${PROBES[name].toString()})()`); } catch(e){ res={error:String(e.message||e)}; }
  fs.writeFileSync(path.join(OUTDIR, `critic-${name}.json`), JSON.stringify(res,null,1));
  process.stderr.write(`[criticG] ${name} done\n`);
}
await handle.close();
