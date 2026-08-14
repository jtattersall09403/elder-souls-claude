#!/usr/bin/env node
/**
 * vt-play.mjs — play the game for a few minutes down the shipping path and photograph it.
 *
 * Every input goes through the real input pipeline (`queueInputs` -> ACTIONS -> the same
 * bindings a keyboard drives). Nothing here poses a camera except where a shot is explicitly
 * labelled `orbit`. Sequences, never single stills.
 */
import fs from 'node:fs';
import path from 'node:path';
import { launchGame } from '../lib/browser.mjs';

const args = {};
for (let i = 2; i < process.argv.length; i++) {
  if (!process.argv[i].startsWith('--')) continue;
  const k = process.argv[i].slice(2);
  args[k] = (process.argv[i+1] && !process.argv[i+1].startsWith('--')) ? process.argv[++i] : true;
}
const OUT = path.resolve(args.out || 'docs/shots/2026-08-14-visual-truth/play');
fs.mkdirSync(OUT, { recursive: true });
const log = [];
const note = (o) => { log.push(o); console.log(JSON.stringify(o)); };

const HW = process.env.VT_HARDWARE_GPU === '1';
const g = await launchGame({ entry: 'game/index.html', width: 1280, height: 720, hardwareGpu: HW });
g.page.on('pageerror', e => note({ pageerror: String(e.message).split('\n')[0] }));
await g.page.waitForFunction(() => window.__HARNESS, null, { timeout: 90000 });
await g.h('ready');
const [CW, CH] = String(args.canvas || '960x540').split('x').map(Number);
await setCanvas(g, CW, CH);


let shotN = 0;
async function shot(label) {
  const d = await g.h('screenshot');
  const f = `${String(shotN++).padStart(3,'0')}-${label}.png`;
  fs.writeFileSync(path.join(OUT, f), Buffer.from(String(d).replace(/^data:image\/png;base64,/,''),'base64'));
  return f;
}
async function play(script, frames, label, every = 0) {
  await g.h('queueInputs', script);
  if (!every) { await g.h('stepFrames', frames); return [await shot(label)]; }
  const files = [];
  for (let done = 0; done < frames; done += every) {
    await g.h('stepFrames', Math.min(every, frames - done));
    files.push(await shot(`${label}-f${String(done+every).padStart(4,'0')}`));
  }
  return files;
}

const t0 = await g.h('snapshot');
note({ step: 'boot', pos: t0.player.pos, hp: t0.player.hp, stamina: t0.player.stamina, state: t0.player.state });
await shot('boot');

// ---- 1. WALK ------------------------------------------------------------------------
await play([{ f: 0, move: [0, 1] }], 300, 'walk', 60);
let s = await g.h('snapshot');
note({ step: 'walk-300f', pos: s.player.pos, speed_mps: s.player.speed_mps, state: s.player.state, anim: s.player.anim });

// ---- 2. SPRINT ----------------------------------------------------------------------
await play([{ f: 0, move: [0, 1], press: ['sprint'] }], 300, 'sprint', 60);
s = await g.h('snapshot');
note({ step: 'sprint-300f', pos: s.player.pos, speed_mps: s.player.speed_mps, stamina: s.player.stamina, state: s.player.state, anim: s.player.anim });

// ---- 3. TURN ON THE SPOT (the player's own camera control) --------------------------
await g.h('clearInputs');
await play([{ f: 0, look: [1, 0] }], 120, 'turn', 15);
s = await g.h('snapshot');
note({ step: 'turn-120f', cam_yaw: s.camera.yaw_deg, player_yaw: s.player.yaw_deg });

// ---- 4. ROLL ------------------------------------------------------------------------
await g.h('clearInputs');
await play([{ f: 0, move: [0, 1] }, { f: 4, press: ['roll'] }, { f: 7, release: ['roll'] }], 90, 'roll', 6);
s = await g.h('snapshot');
note({ step: 'roll', state: s.player.state, anim: s.player.anim, stamina: s.player.stamina, iframe: s.player.iframe });

// ---- 5. ATTACK, unprovoked, in the open ---------------------------------------------
await g.h('clearInputs');
await play([{ f: 0, press: ['light'] }, { f: 3, release: ['light'] }], 72, 'attack-light', 6);
s = await g.h('snapshot');
note({ step: 'attack-light', state: s.player.state, anim: s.player.anim, phase: s.player.phase, stamina: s.player.stamina });

// ---- 6. FIGHT something --------------------------------------------------------------
await g.h('clearInputs');
try {
  const ents = await g.h('listEntities');
  note({ step: 'entities-nearby', n: Array.isArray(ents) ? ents.length : typeof ents,
         sample: Array.isArray(ents) ? ents.slice(0, 6) : ents });
} catch (e) { note({ step: 'listEntities', err: String(e.message).slice(0, 200) }); }
try {
  s = await g.h('snapshot');
  const [px, , pz] = s.player.pos;
  const sp = await g.h('spawn', 'pop-0027-infantry', px, pz + 5);
  note({ step: 'spawn', result: sp });
  await g.h('stepFrames', 20);
  await shot('enemy-spawned');
  const s2 = await g.h('snapshot');
  const eid = s2.enemies[0] && s2.enemies[0].eid;
  if (eid) {
    await g.h('aggro', eid);
    await g.h('lockOn', eid);
    await play([{ f: 0, press: ['light'] }, { f: 3, release: ['light'] },
                { f: 40, press: ['light'] }, { f: 43, release: ['light'] },
                { f: 90, press: ['heavy'] }, { f: 110, release: ['heavy'] }], 240, 'fight', 20);
    const s3 = await g.h('snapshot');
    note({ step: 'fight', player_hp: s3.player.hp, player_stam: s3.player.stamina,
           enemies: s3.enemies.map(e => ({ eid: e.eid, hp: e.hp, state: e.state, anim: e.anim, dist: e.dist_m })) });
  } else note({ step: 'fight', err: 'no enemy in snapshot after spawn' });
} catch (e) { note({ step: 'fight', err: String(e.message).slice(0, 300) }); }

// ---- 7. MENUS ------------------------------------------------------------------------
await g.h('clearInputs');
for (const m of ['inventory', 'journal', 'map', 'sheet', 'spells', 'wait']) {
  try {
    await g.h('openMenu', m);
    await g.h('stepFrames', 12);
    await shot(`menu-${m}`);
    const st = await g.h('uiState').catch(() => null);
    note({ step: `menu:${m}`, ok: true, ui: st && st.open });
    await g.h('closeMenu');
    await g.h('stepFrames', 6);
  } catch (e) { note({ step: `menu:${m}`, err: String(e.message).slice(0, 220) }); }
}

// ---- 8. TALK -------------------------------------------------------------------------
try {
  const npcs = await g.page.evaluate(() => {
    const sc = window.__ENGINE.renderer.scene; const out = [];
    sc.traverse(o => { if (/^npc:/.test(o.name || '')) out.push(o.name); });
    return out.slice(0, 40);
  });
  note({ step: 'npcs-in-scene', n: npcs.length, sample: npcs.slice(0, 8) });
  for (const id of npcs.slice(0, 3)) {
    try {
      const r = await g.h('talkTo', id.replace(/^npc:/, ''));
      await g.h('stepFrames', 12);
      await shot(`talk-${id.replace(/[^a-z0-9]+/gi,'-')}`);
      note({ step: 'talkTo', id, greeting: r && (r.greeting || r.text || JSON.stringify(r).slice(0,300)) });
      break;
    } catch (e) { note({ step: 'talkTo', id, err: String(e.message).slice(0, 220) }); }
  }
} catch (e) { note({ step: 'talk', err: String(e.message).slice(0, 220) }); }

fs.writeFileSync(path.join(OUT, 'play-log.json'), JSON.stringify(log, null, 2));
console.log('shots:', shotN);
await g.close();

// Shrink the capture backing store. In harness mode main.js never resizes the canvas, so it
// stays at the 1920x1080 in the HTML and every screenshot() pays a 2 Mpx readPixels. For a
// defect sweep 960x540 is plenty and it is ~4x cheaper, which is the difference between a
// sequence and a still.
async function setCanvas(g, w, h) {
  await g.page.evaluate(({ w, h }) => {
    const c = document.getElementById('view');
    c.width = w; c.height = h;
    const R = window.__ENGINE.renderer;
    if (R.setSize) R.setSize(w, h);
    else if (R.three && R.three.setSize) { R.three.setSize(w, h, false); if (R.camera) { R.camera.aspect = w / h; R.camera.updateProjectionMatrix(); } }
  }, { w, h });
}
