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

// drain with SPRINT (0.15/frame, re-arms the delay every frame) — the only way to sit at 0.
sprintdrain() {
  const H = window.__HARNESS; const cs = () => H.getCombatState();
  const R = { gate: [], guard_break: [] };
  const drain = (frames, then) => {
    H.setSeed(9); H.loadState('arena_flat'); H.setLoadout({ weapon:'straight-sword', shield:'marsh_oak_medium' });
    H.stepFrames(4);
    const q = [{ f:0, move:[0,1] }, { f:1, press:['sprint'] }, { f:frames, release:['sprint'] }];
    if (then) q.push(...then(frames));
    H.queueInputs(q);
    return q;
  };
  // 1. gate at (near) zero: sprint 800 f, then at 802 press each action while still empty
  for (const act of ['light','heavy','roll','sprint','parry','use_item','block','interact','jump']) {
    H.setSeed(9); H.loadState('arena_flat'); H.setLoadout({ weapon:'straight-sword', shield:'marsh_oak_medium' });
    H.stepFrames(4);
    H.queueInputs([{f:0, move:[0,1]}, {f:1, press:['sprint']}, {f:801, release:['sprint']},
                   {f:802, press:[act]}, {f:806, release:[act]}]);
    let stamAt=null; const st=[]; let minS=999; const before=cs().player.stamina_drops;
    for (let i=1;i<=1100;i++){ H.stepFrames(1); const c=cs(); minS=Math.min(minS,c.player.stamina);
      if(i===802) stamAt=+c.player.stamina.toFixed(3);
      if(i>=802 && i<=900) st.push(c.player.state); }
    R.gate.push({ action: act, stamina_at_press: stamAt, min_stamina: minS,
      states_after: [...new Set(st)], drops_delta: cs().player.stamina_drops - before,
      pos: cs().player.pos.map(v=>+v.toFixed(2)) });
  }
  // 2. guard break: sprint down to ~20, raise guard, eat a 96-dmg chop (cost 36.48)
  for (const sprintF of [600, 660, 665, 670, 700]) {
    H.setSeed(9); H.loadState('arena_flat'); H.setLoadout({ weapon:'straight-sword', shield:'marsh_oak_medium' });
    H.spawn('inf_trash', 0, 1.5, { as:'E' }); H.stepFrames(4);
    H.queueInputs([{f:0, move:[0,1]}, {f:1, press:['sprint']}, {f:sprintF, release:['sprint']},
                   {f:sprintF, move:[0,0]}, {f:sprintF+1, press:['block']}, {f:1500, release:['block']}]);
    H.queueEnemyScript('E', [{ f: sprintF + 6, move: 'chop' }]);
    const tr=[]; let prevSt=null, prevS=null, prevHp=null;
    let riposte=null;
    for (let i=1;i<=sprintF+400;i++){
      H.stepFrames(1); const c=cs();
      if (prevSt !== c.player.state) tr.push({ f:i, st:c.player.state, stam:+c.player.stamina.toFixed(2), hp:c.player.hp });
      if (prevS!==null && Math.abs(prevS-c.player.stamina)>0.4) tr.push({ f:i, dS:+(prevS-c.player.stamina).toFixed(2), dHP:prevHp-c.player.hp, st:c.player.state, stam_after:+c.player.stamina.toFixed(2) });
      prevSt=c.player.state; prevS=c.player.stamina; prevHp=c.player.hp;
    }
    const gb = tr.filter(x=>x.st==='GUARD_BREAK');
    const idx = tr.findIndex(x=>x.st==='GUARD_BREAK');
    const nxt = idx>=0 ? tr.slice(idx+1).find(x=>x.st && x.st!=='GUARD_BREAK') : null;
    R.guard_break.push({ sprint_frames: sprintF, broke: gb.length>0,
      at_f: gb.length?gb[0].f:null, stam_at_break: gb.length?gb[0].stam:null,
      end_f: nxt?nxt.f:null, duration_f: (gb.length&&nxt)?nxt.f-gb[0].f:null,
      impact: tr.filter(x=>x.dS!==undefined).slice(0,4),
      states: [...new Set(tr.filter(x=>x.st).map(x=>x.st))] });
  }
  return R;
},

parleygates2() {
  const H = window.__HARNESS; const cs = () => H.getCombatState();
  const R = { cases: [] };
  const CASES = [
    ['GOLD, disposition 10 (npc key)',   { topicsKnown:[], gold:500, dispositions:{ sentry_ghelis: 10 } }],
    ['GOLD, disposition 35 (base)',      { topicsKnown:[], gold:500 }],
    ['YIELD, disposition 45, full hp',   { topicsKnown:[], gold:0, dispositions:{ sentry_ghelis: 45 } }],
    ['NAME only, disposition 0',         { topicsKnown:['the-drowned-ford'], gold:0, dispositions:{ sentry_ghelis: 0 } }],
    ['FACTION rank 3, disposition 0',    { topicsKnown:[], gold:0, dispositions:{ sentry_ghelis: 0 }, factions:{'marsh-wardens':{rank:3}} }],
    ['FACTION rank 1',                   { topicsKnown:[], gold:0, dispositions:{ sentry_ghelis: 0 }, factions:{'marsh-wardens':{rank:1}} }],
    ['nothing',                          { topicsKnown:[], gold:0, dispositions:{ sentry_ghelis: 0 } }],
  ];
  for (const [name, k] of CASES) {
    H.setSeed(21); H.loadState('arena_flat'); H.spawn('inf_trash', 0, 2.0, { as:'E' });
    const w = H.setWorldKnowledge(k);
    H.stepFrames(4); try{H.aggro('E');}catch(e){} H.stepFrames(4);
    const g0 = cs().world_knowledge.gold;
    H.queueInputs([{f:1, press:['interact']}, {f:100, release:['interact']}]);
    const ps=[], es=[];
    for(let i=1;i<=200;i++){ H.stepFrames(1); const s=cs(); ps.push(s.player.state);
      const e=s.enemies.find(x=>x.id==='E'); es.push(e?e.state:null); }
    R.cases.push({ case:name, world: w, yielded: es.includes('YIELDED'),
      gold: g0+'->'+cs().world_knowledge.gold, enemy_final: es[es.length-1] });
  }
  return R;
},


guardbreak3() {
  const H = window.__HARNESS; const cs = () => H.getCombatState();
  const R = { runs: [] };
  for (const sprintF of [500, 600, 640, 645, 650, 700]) {
    H.setSeed(9); H.loadState('arena_flat'); H.setLoadout({ weapon:'straight-sword', shield:'marsh_oak_medium' });
    H.stepFrames(4);
    H.queueInputs([{f:0, move:[0,1]}, {f:1, press:['sprint']}, {f:sprintF, release:['sprint']}, {f:sprintF, move:[0,0]}]);
    let stam=null;
    for (let i=1;i<=sprintF+1;i++){ H.stepFrames(1); stam=cs().player.stamina; }
    // teleport back to the origin and put an enemy in front of us
    H.teleport(0, 0, { yaw: 0 });
    const eid = H.spawn('inf_trash', 0, 1.5, { as:'E' });
    H.queueInputs([{f:1, press:['block']}, {f:600, release:['block']}]);
    H.queueEnemyScript('E', [{ f: 8, move: 'chop' }]);
    const tr=[]; let prevSt=null, prevS=null, prevHp=null;
    for (let i=1;i<=320;i++){
      H.stepFrames(1); const c=cs();
      if (prevSt!==c.player.state) tr.push({f:i, st:c.player.state, stam:+c.player.stamina.toFixed(2), hp:c.player.hp});
      if (prevS!==null && (Math.abs(prevS-c.player.stamina)>0.4 || prevHp!==c.player.hp))
        tr.push({f:i, dS:+(prevS-c.player.stamina).toFixed(2), dHP:prevHp-c.player.hp, st:c.player.state, stam_after:+c.player.stamina.toFixed(2)});
      prevSt=c.player.state; prevS=c.player.stamina; prevHp=c.player.hp;
    }
    const idx = tr.findIndex(x=>x.st==='GUARD_BREAK');
    const nxt = idx>=0 ? tr.slice(idx+1).find(x=>x.st && x.st!=='GUARD_BREAK') : null;
    // shield input ignored during the break? regen during it?
    R.runs.push({ sprint_frames: sprintF, stamina_before_block: +stam.toFixed(2),
      broke: idx>=0, at_f: idx>=0?tr[idx].f:null, stam_at_break: idx>=0?tr[idx].stam:null,
      end_f: nxt?nxt.f:null, duration_f: (idx>=0&&nxt)?nxt.f-tr[idx].f:null,
      impacts: tr.filter(x=>x.dS!==undefined).slice(0,4),
      transitions: tr.filter(x=>x.st).slice(0,14) });
  }
  return R;
},
};
const which = String(args.probe || 'all');
for (const name of (which==='all'?Object.keys(PROBES):which.split(','))) {
  const t0=Date.now(); process.stderr.write(`[criticF] ${name} ...\n`);
  let res; try { res = await handle.page.evaluate(`(function ${PROBES[name].toString()})()`); }
  catch(e){ res = { error: String(e.message||e) }; }
  fs.writeFileSync(path.join(OUTDIR, `critic-${name}.json`), JSON.stringify(res, null, 1));
  process.stderr.write(`[criticF] ${name} ${(Date.now()-t0)/1000}s\n`);
}
await handle.close();
