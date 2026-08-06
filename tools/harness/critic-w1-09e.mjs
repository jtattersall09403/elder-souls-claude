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

// guard break: drain with dagger R1s (12 each, 42 f), then block a 96-dmg chop.
guardbreak2() {
  const H = window.__HARNESS; const cs = () => H.getCombatState();
  const R = { runs: [] };
  for (const n of [0, 4, 8, 9]) {
    H.setSeed(9); H.loadState('arena_flat');
    H.setLoadout({ weapon: 'dagger', shield: 'marsh_oak_medium' });
    H.spawn('inf_trash', 0, 1.5, { as: 'E' }); H.stepFrames(4);
    const q = [];
    for (let i = 0; i < n; i++) q.push({ f: 1 + i*43, press:['light'] }, { f: 3 + i*43, release:['light'] });
    const blockAt = 1 + n*43 + 2;
    q.push({ f: blockAt, press:['block'] }, { f: 1200, release:['block'] });
    H.queueInputs(q);
    H.queueEnemyScript('E', [{ f: blockAt + 5, move: 'chop' }]);
    const tr = []; let prevSt = null, prevS = null, prevHp = null;
    for (let i = 1; i <= 400; i++) {
      H.stepFrames(1); const c = cs();
      if (prevSt !== c.player.state) tr.push({ f: i, st: c.player.state, stam: +c.player.stamina.toFixed(2), hp: c.player.hp });
      if (prevS !== null && (Math.abs(c.player.stamina - prevS) > 0.4 || c.player.hp !== prevHp))
        tr.push({ f: i, delta_stam: +(prevS - c.player.stamina).toFixed(2), delta_hp: prevHp - c.player.hp, st: c.player.state, stam_after: +c.player.stamina.toFixed(2) });
      prevSt = c.player.state; prevS = c.player.stamina; prevHp = c.player.hp;
    }
    const gbIdx = tr.findIndex(x => x.st === 'GUARD_BREAK');
    const gbEnd = gbIdx < 0 ? -1 : tr.slice(gbIdx+1).findIndex(x => x.st && x.st !== 'GUARD_BREAK');
    R.runs.push({ pre_attacks: n, guard_break: gbIdx >= 0,
      guard_break_at_f: gbIdx>=0 ? tr[gbIdx].f : null,
      guard_break_stam: gbIdx>=0 ? tr[gbIdx].stam : null,
      guard_break_end_f: (gbIdx>=0 && gbEnd>=0) ? tr[gbIdx+1+gbEnd].f : null,
      transitions: tr.slice(0, 60) });
  }
  return R;
},

// exact-zero stamina gate
zerogate2() {
  const H = window.__HARNESS; const cs = () => H.getCombatState();
  const R = { probe: [] };
  // dagger R1 costs 12, total 42 f; chain-press every 43 f loses 12 - 0.75 = 11.25 per cycle after the first
  // ten cycles -> aim near zero; then hold and read the exact bar
  const drainAndTry = (cycles, act) => {
    H.setSeed(9); H.loadState('arena_flat'); H.setLoadout({ weapon: 'ultra-greatsword' });
    H.stepFrames(4);
    const q = [];
    for (let i = 0; i < cycles; i++) q.push({ f: 1 + i*167, press:['light'] }, { f: 3 + i*167, release:['light'] });
    const pressAt = 1 + cycles*167;
    if (act) q.push({ f: pressAt, press:[act] }, { f: pressAt + 2, release:[act] });
    H.queueInputs(q);
    let stamAtPress = null; const st = []; let minS = 999;
    for (let i = 1; i <= cycles*167 + 300; i++) {
      H.stepFrames(1); const c = cs(); minS = Math.min(minS, c.player.stamina);
      if (i === pressAt) stamAtPress = +c.player.stamina.toFixed(3);
      if (i >= pressAt) st.push(c.player.state);
    }
    return { cycles, action: act, stamina_at_press: stamAtPress, min_stamina: minS,
             states_after: [...new Set(st)], drops: cs().player.stamina_drops };
  };
  for (const c of [1,2,3]) R.probe.push(drainAndTry(c, null));
  for (const a of ['light','heavy','roll','sprint','parry','block','use_item','interact'])
    R.probe.push(drainAndTry(3, a));
  return R;
},

// the parley gate ladder — every ground, pass and fail
parleygates() {
  const H = window.__HARNESS; const cs = () => H.getCombatState();
  const R = { cases: [] };
  const CASES = [
    { name:'NAME pass',            k:{ topicsKnown:['the-drowned-ford'], gold:0, dispositions:{E:0} } },
    { name:'NAME absent',          k:{ topicsKnown:['some-other-topic'], gold:0, dispositions:{E:0} } },
    { name:'GOLD pass',            k:{ topicsKnown:[], gold:500, dispositions:{E:35} } },
    { name:'GOLD short',           k:{ topicsKnown:[], gold:100, dispositions:{E:35} } },
    { name:'GOLD low disposition', k:{ topicsKnown:[], gold:500, dispositions:{E:10} } },
    { name:'FACTION rank ok',      k:{ topicsKnown:[], gold:0, dispositions:{E:0}, factions:{'marsh-wardens':{rank:3}} } },
    { name:'FACTION rank low',     k:{ topicsKnown:[], gold:0, dispositions:{E:0}, factions:{'marsh-wardens':{rank:1}} } },
    { name:'FACTION expelled',     k:{ topicsKnown:[], gold:0, dispositions:{E:0}, factions:{'marsh-wardens':{rank:3, expelled:true}} } },
    { name:'FACTION rival rank',   k:{ topicsKnown:[], gold:0, dispositions:{E:0}, factions:{'marsh-wardens':{rank:3},'reed-court':{rank:2}} } },
    { name:'nothing at all',       k:{ topicsKnown:[], gold:0, dispositions:{E:0} } },
  ];
  for (const c of CASES) {
    H.setSeed(21); H.loadState('arena_flat');
    H.spawn('inf_trash', 0, 2.0, { as: 'E' });
    H.setWorldKnowledge(c.k);
    H.stepFrames(4); try { H.aggro('E'); } catch(e){}
    H.stepFrames(4);
    const goldBefore = cs().world_knowledge.gold;
    H.queueInputs([{ f:1, press:['interact'] }, { f:100, release:['interact'] }]);
    const ps = []; const es = [];
    for (let i=1;i<=200;i++){ H.stepFrames(1); const s=cs(); ps.push(s.player.state);
      const e=s.enemies.find(x=>x.id==='E'); es.push(e?e.state:null); }
    R.cases.push({ case: c.name, parley_ran: ps.some(s=>s.startsWith('PARLEY')),
      parley_len: ps.filter(s=>s.startsWith('PARLEY')).length,
      yielded: es.includes('YIELDED'),
      gold_before: goldBefore, gold_after: cs().world_knowledge.gold,
      enemy_final: es[es.length-1] });
  }
  // beast: the input must be DROPPED (no frames spent)
  H.setSeed(21); H.loadState('arena_flat'); H.spawn('beast_slitherfang', 0, 2.0, { as:'B' });
  H.setWorldKnowledge({ gold:5000, topicsKnown:['the-drowned-ford'] });
  H.stepFrames(4); try{H.aggro('B');}catch(e){} H.stepFrames(4);
  H.queueInputs([{f:1, press:['interact']}, {f:100, release:['interact']}]);
  const bs=[]; for(let i=1;i<=120;i++){ H.stepFrames(1); bs.push(cs().player.state); }
  R.beast = { states: [...new Set(bs)], frames_spent: bs.filter(s=>s.startsWith('PARLEY')).length };
  return R;
},

};
const which = String(args.probe || 'all');
const list = which === 'all' ? Object.keys(PROBES) : which.split(',');
for (const name of list) {
  const t0=Date.now(); process.stderr.write(`[criticE] ${name} ...\n`);
  let res; try { res = await handle.page.evaluate(`(function ${PROBES[name].toString()})()`); }
  catch(e){ res = { error: String(e.message||e) }; }
  fs.writeFileSync(path.join(OUTDIR, `critic-${name}.json`), JSON.stringify(res, null, 1));
  process.stderr.write(`[criticE] ${name} ${(Date.now()-t0)/1000}s\n`);
}
await handle.close();
