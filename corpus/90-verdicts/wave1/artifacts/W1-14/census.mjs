import { launchGame } from '/tmp/claude-0/-home-user-elder-souls-claude/3c195166-6f14-54d0-bf0f-867f7b39d84b/scratchpad/w1-14/tools/lib/browser.mjs';
import fs from 'node:fs';
const h = await launchGame({});
const out = await h.page.evaluate(async () => {
  const H = window.__HARNESS; await H.ready();
  const D = H.getMagicData();
  const spells = D.spells.spells;
  const res = [];
  for (const sp of spells) {
    H.setSeed(1337); H.loadState('arena_flat'); H.setRenderRate(0);
    H.setWillpower(99); H.setCatalyst('rod');
    H.setMagicSkills({sorcery:100, root_speech:100, warding:100, veiling:100});
    H.hearthRest(); H.magicEventsDrain();
    const att = H.setAttuned([sp.id]);
    const dummy = H.spawn('inf_trash', 0, 6);
    const st0 = H.getMagicState();
    const p0 = H.getPlayerStats();
    const e0 = H.listEntities();
    H.queueInputs([{f:2, press:['light']},{f:4, release:['light']}]);
    const total = (sp.frames?.total || 60) + 180;
    const effSeen = new Set(); let maxProj=0, maxVol=0, maxRes=0;
    let enemyHpMin = e0.find(e=>e.eid===dummy)?.hp ?? null;
    for (let i=0;i<total;i++){
      H.stepFrames(1);
      const ms = H.getMagicState();
      for (const e of (ms.effects_active||[])) effSeen.add(e.effect||e.id||JSON.stringify(e));
      maxProj=Math.max(maxProj, ms.projectiles||0); maxVol=Math.max(maxVol, ms.volumes||0); maxRes=Math.max(maxRes, ms.residues||0);
      const ent = H.listEntities().find(e=>e.eid===dummy);
      if (ent && enemyHpMin!==null) enemyHpMin = Math.min(enemyHpMin, ent.hp);
    }
    const ev = H.magicEventsDrain();
    const st1 = H.getMagicState();
    const p1 = H.getPlayerStats();
    res.push({
      spell: sp.id, cls: sp.class, effects: sp.effects.map(e=>e.effect), attuned: att,
      events: ev.map(e=>({f:e.f, kind:e.kind, effect:e.effect||null, spell:e.spell||null, detail: Object.keys(e).filter(k=>!['f','kind','effect','spell'].includes(k)).reduce((a,k)=>(a[k]=e[k],a),{})})),
      effects_active_seen: [...effSeen],
      maxProj, maxVol, maxRes,
      enemy_hp0: e0.find(e=>e.eid===dummy)?.hp ?? null, enemy_hp_min: enemyHpMin,
      focus0: st0.focus, focus1: st1.focus,
      hp0: p0.hp, hp1: p1.hp,
      levitating: st1.levitating, airborne: st1.airborne, altitude: st1.altitude_m,
      pos0: p0.pos, pos1: p1.pos,
    });
  }
  return res;
});
fs.writeFileSync('/tmp/claude-0/-home-user-elder-souls-claude/3c195166-6f14-54d0-bf0f-867f7b39d84b/scratchpad/critic/census.json', JSON.stringify(out,null,1));
console.log('spells measured', out.length);
await h.close();
