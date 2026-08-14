#!/usr/bin/env node
// critic-t4-shots.mjs — T4 critic. Photograph every Morrowind screen at 1920x1080 DPR1,
// plus the world HUD and the dialogue window, and dump getUIState beside each frame.
// The point of this file is that no UI item in this corpus has ever been compared to the
// 33 interface plates we hold, so the first deliverable is PICTURES.
import fs from 'node:fs';
import path from 'node:path';
import { launchGame } from '../lib/browser.mjs';
import { REPO_ROOT, parseArgs } from '../lib/cli.mjs';

const args = parseArgs();
const OUT = path.join(REPO_ROOT, 'corpus/90-verdicts/wave1/artifacts/T4-r1');
const W = Number(args.width || 1920), H = Number(args.height || 1080);
const tag = String(args.tag || `${W}x${H}`);
fs.mkdirSync(path.join(OUT, 'screens'), { recursive: true });
fs.mkdirSync(path.join(OUT, 'uistate'), { recursive: true });

const h = await launchGame({ width: W, height: H });
const png = (name, b64) => {
  const p = path.join(OUT, 'screens', `${name}.png`);
  fs.writeFileSync(p, Buffer.from(String(b64).split(',')[1], 'base64'));
  return p;
};

try {
  const res = await h.page.evaluate(async () => {
    const H = window.__HARNESS;
    await H.ready();
    if (H.setUIVisible) await H.setUIVisible(true);
    const shots = {}, states = {}, notes = {};

    const grab = async (name) => { shots[name] = await H.screenshot(); states[name] = H.getUIState(); };

    // 1. world HUD, out of combat
    await H.closeMenu();
    await H.stepFrames(10);
    await grab('world-hud');

    // 2. each openable screen
    for (const n of ['inventory', 'journal', 'sheet', 'spells', 'map', 'wait']) {
      try { await H.closeMenu(); await H.openMenu(n, {}); await H.stepFrames(2); await grab(n); }
      catch (e) { notes[n] = String(e && e.message || e); }
    }

    // 3. container
    try {
      await H.closeMenu();
      const c = await H.openContainer ? await H.openContainer() : null;
      await H.stepFrames(2); await grab('container'); notes.container_open = c;
    } catch (e) { notes.container = String(e && e.message || e); }

    // 4. book
    try {
      await H.closeMenu();
      const qb = H.questBook ? H.questBook() : null;
      notes.questBook = qb;
    } catch (e) { notes.questBook_err = String(e && e.message || e); }

    // 5. dialogue
    try {
      await H.closeMenu();
      const npcs = H.listNPCs ? H.listNPCs() : [];
      notes.npcs = (npcs || []).slice(0, 12);
      const first = (npcs || [])[0];
      if (first) {
        const id = first.id || first;
        const r = await H.talkTo(id);
        notes.talkTo = r;
        await H.stepFrames(2);
        await grab('dialogue');
      }
    } catch (e) { notes.dialogue = String(e && e.message || e); }

    // 6. level-up at a hearth
    try {
      await H.closeMenu();
      const hs = H.listHearths ? H.listHearths() : [];
      notes.hearths = (hs || []).slice(0, 5);
      if (H.setAtHearth) await H.setAtHearth(true);
      await H.openMenu('levelup', {});
      await H.stepFrames(2);
      await grab('levelup');
    } catch (e) { notes.levelup = String(e && e.message || e); }

    return { shots, states, notes };
  });

  for (const [k, v] of Object.entries(res.shots)) console.log('wrote', png(`${k}__${tag}`, v));
  fs.writeFileSync(path.join(OUT, `uistate/screens__${tag}.json`), JSON.stringify(res.states, null, 2));
  fs.writeFileSync(path.join(OUT, `uistate/notes__${tag}.json`), JSON.stringify(res.notes, null, 2));
  console.log('notes:', JSON.stringify(res.notes).slice(0, 3000));
} finally { await h.close(); }
