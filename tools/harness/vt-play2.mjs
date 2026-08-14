#!/usr/bin/env node
/** vt-play2.mjs — the part of the driven session vt-play.mjs did not reach: a real fight,
 *  every menu screen, and a conversation with a live NPC. Sequences, not stills. */
import fs from 'node:fs';
import path from 'node:path';
import { launchGame } from '../lib/browser.mjs';

const args = {};
for (let i = 2; i < process.argv.length; i++) {
  if (!process.argv[i].startsWith('--')) continue;
  const k = process.argv[i].slice(2);
  args[k] = (process.argv[i+1] && !process.argv[i+1].startsWith('--')) ? process.argv[++i] : true;
}
const OUT = path.resolve(args.out || 'docs/shots/2026-08-14-visual-truth/play2');
fs.mkdirSync(OUT, { recursive: true });
const log = []; const note = (o) => { log.push(o); console.log(JSON.stringify(o)); };

const g = await launchGame({ entry: 'game/index.html', width: 1280, height: 720 });
await g.page.waitForFunction(() => window.__HARNESS, null, { timeout: 90000 });
await g.h('ready');
const [CW, CH] = String(args.canvas || '960x540').split('x').map(Number);
await g.page.evaluate(({ w, h }) => { const c = document.getElementById('view'); c.width = w; c.height = h; window.__ENGINE.renderer.setSize(w, h); }, { w: CW, h: CH });

let n = 0;
async function shot(label) {
  const d = await g.h('screenshot');
  const f = `${String(n++).padStart(3,'0')}-${label}.png`;
  fs.writeFileSync(path.join(OUT, f), Buffer.from(String(d).replace(/^data:image\/png;base64,/,''),'base64'));
  return f;
}
const call = async (m, ...a) => { try { return { ok: true, v: await g.h(m, ...a) }; } catch (e) { return { ok: false, e: String(e.message).split('\n')[0].slice(0, 240) }; } };

// ---- MENUS: every screen the pause menu can open ------------------------------------
for (const m of ['inventory', 'journal', 'map', 'sheet', 'spells', 'wait']) {
  const r = await call('openMenu', m);
  if (r.ok) { await g.h('stepFrames', 12); await shot(`menu-${m}`); await call('closeMenu'); await g.h('stepFrames', 6); }
  note({ step: `menu:${m}`, ok: r.ok, err: r.e });
}

// ---- TALK: a live NPC, through the same verb the world uses --------------------------
const ents = (await call('listEntities')).v || [];
const npcs = ents.filter(e => e.kind === 'npc');
note({ step: 'npc-census', total: ents.length, npcs: npcs.length,
       at_world_origin: npcs.filter(e => Math.abs(e.pos[0]) < 50 && Math.abs(e.pos[2]) < 50).length });
for (const npc of npcs.slice(0, 4)) {
  const r = await call('talkTo', npc.eid);
  if (r.ok) {
    await g.h('stepFrames', 12); await shot(`talk-${npc.eid}`);
    note({ step: 'talkTo', eid: npc.eid, name: npc.name, race: npc.race, reply: JSON.stringify(r.v).slice(0, 600) });
    for (const topic of ['background', 'lilmoth', 'rumours', 'little advice']) {
      const s = await call('conversationSay', topic);
      note({ step: 'say', topic, ok: s.ok, reply: s.ok ? JSON.stringify(s.v).slice(0, 400) : s.e });
      if (s.ok) { await g.h('stepFrames', 8); await shot(`say-${topic.replace(/\W+/g,'-')}`); }
    }
    break;
  }
  note({ step: 'talkTo', eid: npc.eid, ok: false, err: r.e });
}

// ---- FIGHT: a real archetype, aggroed, lock-on, a light-light-heavy chain -------------
await call('closeMenu');
const s0 = (await call('snapshot')).v;
const [px, , pz] = s0.player.pos;
const sp = await call('spawn', 'inf_trash', px + 3, pz + 4);
note({ step: 'spawn', ok: sp.ok, v: sp.ok ? JSON.stringify(sp.v).slice(0, 200) : sp.e });
if (sp.ok) {
  await g.h('stepFrames', 20);
  const s1 = (await call('snapshot')).v;
  const eid = s1.enemies[0] && s1.enemies[0].eid;
  note({ step: 'enemy', eid, enemies: s1.enemies.length });
  if (eid) {
    await call('aggro', eid); await call('lockOn', eid);
    await g.h('queueInputs', [
      { f: 0, press: ['light'] }, { f: 3, release: ['light'] },
      { f: 45, press: ['light'] }, { f: 48, release: ['light'] },
      { f: 100, press: ['heavy'] }, { f: 125, release: ['heavy'] },
      { f: 180, press: ['roll'] }, { f: 183, release: ['roll'] },
    ]);
    for (let f = 0; f < 240; f += 15) {
      await g.h('stepFrames', 15);
      await shot(`fight-f${String(f + 15).padStart(4,'0')}`);
      const s = (await call('snapshot')).v;
      if (f % 60 === 0) note({ step: 'fight', f: f + 15, p_state: s.player.state, p_anim: s.player.anim,
        p_stam: s.player.stamina, p_hp: s.player.hp,
        enemies: s.enemies.map(e => ({ hp: e.hp, state: e.state, anim: e.anim, dist: e.dist_m })) });
    }
  }
}
fs.writeFileSync(path.join(OUT, 'play2-log.json'), JSON.stringify(log, null, 2));
console.log('shots:', n);
await g.close();
