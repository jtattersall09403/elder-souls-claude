import { launchGame } from '/home/user/elder-souls-claude/tools/lib/browser.mjs';
import fs from 'node:fs';
const h = await launchGame({});
const out = await h.page.evaluate(async () => {
  const H = window.__HARNESS; await H.ready();
  const runs = {};
  for (const spell of ['demoralise','still_the_beast','the_grey_fuzz','burden','silence','frenzy','root_theft','open','spark_dart']) {
    H.setSeed(1337); H.loadState('arena_flat'); H.setRenderRate(0);
    H.setWillpower(99); H.setCatalyst('rod');
    H.setMagicSkills({sorcery:100, root_speech:100, warding:100, veiling:100});
    H.hearthRest(); H.magicEventsDrain(); H.setAttuned([spell]);
    const eid = H.spawn('inf_trash', 0, 6);
    H.aggro(eid);
    H.queueInputs([{f:2, press:['light']},{f:4, release:['light']}]);
    const rows=[];
    for (let i=0;i<200;i++){ H.stepFrames(1); const s=H.snapshot();
      const e=(s.enemies||[])[0]||{};
      rows.push({f:s.f, st:e.state, alert:e.alert_state, hp:e.hp, poise:e.poise_cur, stagger:e.stagger, dist:e.dist_m, sp:e.speed_mps, extra:Object.keys(e).filter(k=>/status|buildup|calm|fear|paral|silen|burden|effect/i.test(k)).map(k=>k+'='+JSON.stringify(e[k])).join(' ')});
    }
    const first=rows[0], last=rows[rows.length-1];
    runs[spell]={first,last, states:[...new Set(rows.map(r=>r.st))], alerts:[...new Set(rows.map(r=>r.alert))], hpTrack:[rows[0].hp, rows[rows.length-1].hp], enemyKeys:Object.keys(H.snapshot().enemies[0]||{}), events:H.magicEventsDrain().filter(e=>e.kind==='effect_apply')};
  }
  return runs;
});
fs.writeFileSync('/tmp/claude-0/-home-user-elder-souls-claude/3c195166-6f14-54d0-bf0f-867f7b39d84b/scratchpad/critic/enemy-effects-HEAD.json', JSON.stringify(out,null,1));
for (const [k,v] of Object.entries(out)) console.log(k, 'states', v.states.join(','), 'alerts', v.alerts.join(','), 'hp', v.hpTrack.join('->'), 'apply', JSON.stringify(v.events));
console.log('ENEMY KEYS', out.demoralise.enemyKeys.join(' '));
await h.close();
