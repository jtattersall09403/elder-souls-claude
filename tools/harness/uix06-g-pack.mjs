#!/usr/bin/env node
// uix06-g-pack.mjs — the STIMULUS CAPTURE for RI-UIX06 §G ("could this be Bootstrap?").
//
// This tool does not judge and must never judge. It captures the six screens §G names
// — HUD-in-combat, inventory, journal, book, dialogue, level-up — at 1920x1080, DPR 1,
// WITH THE GAME WORLD BLACKED, and it captures a CONTROL frame per screen with the UI
// turned off so that "the world is blacked" is a measured claim rather than a promise.
//
// WHY THE WORLD IS BLACKED IN THE RENDERER RATHER THAN CROPPED IN POST.
// §G: "Cropping the world is essential — a beautiful marsh behind a bootstrap panel
// rescues the panel." Cropping cannot do that job here, because this interface is
// TRANSLUCENT: the world shows THROUGH the panels (render/ui.js: "translucent over the
// LIVE view"). A crop removes the marsh beside the panel and leaves the marsh inside it.
// So the world is switched off at the source:
//
//   scene.visible = false      three.js projectObject() returns immediately on a root
//                              whose `visible` is false, so nothing in the world is
//                              submitted at all.
//   scene.background = null    the background is drawn BEFORE projectObject, so hiding
//   setClearColor(0x000000,1)  the graph alone would leave the sky.
//   quality.postprocess/ao/    the composite pass grades and dithers the world target;
//   antialias/grade/dither     with the world black those passes can only tint black to
//                              not-quite-black. They touch the world pass only — the UI
//                              surfaces composite AFTER it, straight to the canvas
//                              (render/renderer.js ~line 1442), so UI pixels are
//                              unaffected by any of this. The control frame proves it.
//
// `--blank-world` and the `ui-screens` viewpoint set that RI-UIX06's method line asks for
// do NOT exist on tools/harness/shoot.mjs — verified this run:
//   grep -n "ui-screens\|blank-world\|blankWorld" tools/harness/shoot.mjs  ->  0 hits
// That is the item's own "owed and non-existent" table, still true for those two rows.
// This file is the stand-in and says so; it is not a substitute for landing them.
'use strict';

import fs from 'node:fs';
import path from 'node:path';
import { launchGame } from '../lib/browser.mjs';
import { REPO_ROOT, parseArgs } from '../lib/cli.mjs';

const args = parseArgs();
const OUT = String(args.out || '');
if (!OUT) { console.error('need --out <dir>'); process.exit(2); }
fs.mkdirSync(OUT, { recursive: true });

const W = 1920, H = 1080;

const h = await launchGame({ width: W, height: H });
const writePng = (name, b64) => {
  const p = path.join(OUT, `${name}.png`);
  fs.writeFileSync(p, Buffer.from(String(b64).split(',')[1], 'base64'));
  return p;
};

try {
  const res = await h.page.evaluate(async (cfg) => {
    window.__UIX06_BOOK_ID = cfg.bookId;
    window.__UIX06_ENEMY_IDS = cfg.enemyIds;
    const H = window.__HARNESS;
    await H.ready();
    if (H.setUIVisible) await H.setUIVisible(true);

    const shots = {}, controls = {}, states = {}, text = {}, notes = {};
    // `--only a,b` reruns one leg without re-capturing the five that already landed. Every
    // leg is gated on it, so a rerun cannot silently overwrite a screen it was not asked for.
    const want = (n) => !cfg.only || cfg.only.includes(n);

    // ---- the blackout, applied fresh before every capture ---------------------------
    //
    // FIRST ATTEMPT, RECORDED BECAUSE IT FAILED AND THE FAILURE IS INSTRUCTIVE: setting
    // `scene.visible = false`, `scene.background = null` and `scene.fog = null` threw
    // "Cannot read properties of null (reading 'color')" on all six screens — render/sky.js
    // reads `this.scene.fog.color` every lighting frame (sky.js:994,1001,1044,1095). Nulling
    // engine state to hide it breaks the engine. So nothing in the scene is touched at all
    // now: the WORLD DRAW CALL is intercepted and replaced with a flat black clear.
    //
    // Why this is exact rather than approximate. Renderer.render() makes at most two calls
    // that draw the world — `three.render(this.scene, this.camera)` and, when postprocess is
    // on, `three.render(this.compositeScene, this.compositeCamera)` — and the three UI
    // surfaces (ui, menus, title) each render their OWN scene afterwards with
    // `autoClear = false` (surface.js:322, render/ui.js:217, render/title.js:276). So
    // swallowing exactly those two scenes and clearing to black leaves the UI compositing
    // over black, untouched, in the same frame the player would have got.
    const blackWorld = () => {
      const R = window.__ENGINE && window.__ENGINE.renderer;
      if (!R) return { ok: false, why: 'no window.__ENGINE.renderer' };
      if (!R.__uix06BlackPatched) {
        const three = R.three;
        const real = three.render.bind(three);
        three.render = function (scene, camera) {
          if (R.__uix06Blackout && (scene === R.scene || scene === R.compositeScene)) {
            const prev = three.autoClear;
            three.autoClear = true;
            three.setClearColor(0x000000, 1);
            three.clear(true, true, true);
            three.autoClear = prev;
            return;
          }
          return real(scene, camera);
        };
        R.__uix06BlackPatched = true;
      }
      R.__uix06Blackout = true;
      return { ok: true, patched: true };
    };

    // A capture is: black the world, screenshot WITH the UI, screenshot WITHOUT it.
    // The second is the control — it must be pure black or the blackout did not hold.
    const grab = async (name) => {
      notes[`blackout_${name}`] = blackWorld();
      shots[name] = await H.screenshot();
      states[name] = H.getUIState ? H.getUIState() : null;
      try { text[name] = H.getRenderedText ? H.getRenderedText() : null; } catch (e) { text[name] = String(e.message); }
      await H.setUIVisible(false);
      blackWorld();
      controls[name] = await H.screenshot();
      await H.setUIVisible(true);
      blackWorld();
    };

    // ---------- 1. inventory ---------------------------------------------------------
    if (want('inventory')) try {
      await H.closeMenu();
      await H.openMenu('inventory', {});
      await H.stepFrames(2);
      await grab('inventory');
    } catch (e) { notes.inventory = String(e && e.message || e); }

    // ---------- 2. journal, with a real week in it -----------------------------------
    if (want('journal')) try {
      await H.closeMenu();
      // ROUND 1 OF THIS CAPTURE PRODUCED A BLANK JOURNAL and it is worth saying why, because
      // the T4 shots tool has the same code and would have produced the same blank page.
      // `questOpen(id)` returns a truthy object even when the quest is not offerable, so
      // `if (H.questOpen(id)) picked.push(id)` counted five opens and wrote zero journal
      // entries — `getUIState().journal.entries` came back 0 and the page rendered empty.
      // `questPrepareOffer(id)` is the documented door ("the quest equivalent of placing an
      // enemy in an arena"), so it goes first, and the entry count is ASSERTED afterwards
      // rather than assumed.
      const ids = H.questBook();
      const picked = [];
      for (const id of ids) {
        try { H.questPrepareOffer(id); } catch (e) { notes[`prep_${id}`] = String(e.message).slice(0, 120); }
        try { H.questOpen(id); picked.push(id); } catch (e) { notes[`open_${id}`] = String(e.message).slice(0, 120); }
        if (picked.length >= 5) break;
      }
      notes.quests_opened = picked;
      for (const id of picked) {
        for (let i = 1; i <= 4; i++) {
          try { H.questNote(id, i); } catch (e) { notes[`note_${id}_${i}`] = String(e.message).slice(0, 120); }
          await H.stepFrames(20);
        }
      }
      try { notes.journal_entries_before_open = (H.getQuestState().journal || []).length; } catch (e) { notes.qs_err = String(e.message); }
      await H.openMenu('journal', {});
      await H.stepFrames(2);
      await grab('journal');
      notes.journal_uistate = states.journal && states.journal.journal;
    } catch (e) { notes.journal = String(e && e.message || e); }

    // ---------- 3. a book ------------------------------------------------------------
    // There is no `listBooks()` on the harness — checked, it is absent, which is why the
    // T4 shots tool's `H.listBooks ? ... : null` branch always took the null side. The ids
    // come from game/data/books/manifest.json, which is what `openMenu('book',{id})`
    // resolves against (ui/system.js:242).
    if (want('book')) try {
      await H.closeMenu();
      // ROUND 1 DREW THE LITERAL STRING "undefined" AS THE BOOK'S BODY, and the cause is a
      // build defect rather than a capture mistake. `_buildUI()` (engine.js:4567) folds EVERY
      // doc under `data.books` into one Map keyed by book id — including
      // `game/data/books/manifest.json`, whose 162 entries carry `{id, title}` and NO `text`
      // (checked: `manifest.books.filter(x => x.text).length` is 0). `index.json` loads
      // manifest.json FIFTH of twenty-six, so its stubs overwrite the full records of the
      // four files loaded before it and are overwritten by the twenty-one loaded after.
      // `screens/text.js:240` then does `wrap(m.book.text, ...)` on `undefined`.
      // So the capture probes several ids and records, per id, whether a body arrived.
      const probes = [];
      let bid = null;
      for (const cand of window.__UIX06_BOOK_ID.split('|')) {
        try {
          await H.openMenu('book', { id: cand });
          await H.stepFrames(2);
          const st = H.getUIState();
          const pageEl = (st.elements || []).find((e) => e.kind === 'book_page');
          const body = pageEl ? String(pageEl.text || '') : '';
          const ok = body.length > 0 && !/^undefined/.test(body.trim());
          probes.push({ id: cand, first_page_starts: body.slice(0, 60), body_ok: ok });
          if (ok && !bid) bid = cand;
          await H.closeMenu();
        } catch (e) { probes.push({ id: cand, err: String(e.message).slice(0, 120) }); }
      }
      notes.book_probes = probes;
      notes.book_id = bid;
      if (!bid) throw new Error('no book in this build renders a body; see notes.book_probes');
      await H.openMenu('book', { id: bid });
      await H.stepFrames(2);
      await grab('book');
    } catch (e) { notes.book = String(e && e.message || e); }

    // ---------- 4. dialogue ----------------------------------------------------------
    if (want('dialogue')) try {
      await H.closeMenu();
      const npcs = H.listNPCs();
      const eid = (npcs[0] && (npcs[0].eid || npcs[0].id)) || null;
      notes.talk_eid = eid;
      await H.talkTo(eid);
      await H.stepFrames(2);
      try {
        const topics = (npcs[0] && npcs[0].topics) || [];
        if (topics[0]) { H.conversationSay(topics[0]); await H.stepFrames(2); notes.topic = topics[0]; }
      } catch (e) { notes.say_err = String(e.message); }
      await grab('dialogue');
      try { H.conversationClose(); } catch (e) { /* already closed */ }
    } catch (e) { notes.dialogue = String(e && e.message || e); }

    // ---------- 5. level-up at a hearth ----------------------------------------------
    if (want('levelup')) try {
      await H.closeMenu();
      if (H.setAtHearth) H.setAtHearth(true);
      await H.openMenu('levelup', {});
      await H.stepFrames(2);
      await grab('levelup');
      await H.closeMenu();
      if (H.setAtHearth) H.setAtHearth(false);
    } catch (e) { notes.levelup = String(e && e.message || e); }

    // ---------- 6. HUD in combat -----------------------------------------------------
    if (want('hud-combat')) try {
      await H.closeMenu();
      // `spawnNPC({kind:'hostile'})` throws — it needs a record id from game/data/npcs/*.
      // The combat spawn door is `spawn(id, x, z)` against game/data/combat/enemies/*.
      // ROUND 1 SPAWNED THE ENEMY AT THE WORLD ORIGIN. `listEntities()[0]` is an NPC record
      // with no x/z on it, so `px, pz` fell through to 0,0 while the player stood at
      // [2766.5, 2.68, 5011] — the enemy landed ~5.7 km away, `lockOn()` returned true and
      // `getCombatState().lock.target` stayed null, and the frame was the exploration HUD
      // wearing a combat label. The player's position has an authority and it is the combat
      // state, so it is read from there.
      const cs0 = H.getCombatState ? H.getCombatState() : null;
      const pos = cs0 && cs0.player && cs0.player.pos;
      notes.player_pos = pos || null;
      const px = pos ? pos[0] : 0;
      const pz = pos ? pos[2] : 0;
      let target = null;
      for (const id of window.__UIX06_ENEMY_IDS) {
        try { const sp = H.spawn(id, px + 3, pz + 3, {}); target = (sp && (sp.eid || sp.id)) || sp; notes.spawned = id; break; }
        catch (e) { notes[`spawn_err_${id}`] = String(e.message).slice(0, 200); }
      }
      notes.combat_target = target;
      try { notes.aggro = H.aggro(target || undefined); } catch (e) { notes.aggro_err = String(e.message); }
      // The lock-on reticle is one of RI-UIX01's permitted HUD elements and it only appears
      // with a target held, so ask for it explicitly rather than hope the fight produces it.
      await H.stepFrames(6);
      try { notes.lockon = H.lockOn(target); } catch (e) { notes.lockon_err = String(e.message).slice(0, 200); }
      await H.stepFrames(12);
      // Assert the fight is real rather than assume it. `lock.target` is the one field that
      // says the reticle has something to point at.
      try { const cs = H.getCombatState(); notes.lock_target_after = cs && cs.lock && cs.lock.target; } catch (e) { notes.lock_err = String(e.message); }
      // getEncounterState() takes an encounter id and throws on undefined — it is a note, not
      // a requirement, so it must not be able to kill the capture.
      try { notes.encounter = H.getEncounterState ? H.getEncounterState() : null; } catch (e) { notes.encounter_err = String(e.message).slice(0, 120); }
      try { notes.combat = H.getCombatState ? H.getCombatState() : null; } catch (e) { notes.combat_err = String(e.message).slice(0, 120); }
      await grab('hud-combat');
    } catch (e) { notes.hud = String(e && e.message || e); }

    return { shots, controls, states, text, notes };
  }, {
    bookId: String(args.book || 'the-sap-and-the-ledger|the-boy-who-counted-the-tide|the-grange-book|the-marker-at-the-second-bend'),
    enemyIds: String(args.enemies || 'drowned_lesser,beast_slitherfang,cam_levy,cam_rat').split(','),
    only: args.only ? String(args.only).split(',') : null,
  });

  const manifest = { at: new Date().toISOString(), width: W, height: H, files: {} };
  for (const [k, v] of Object.entries(res.shots)) manifest.files[k] = { stimulus: writePng(`${k}__stimulus`, v) };
  for (const [k, v] of Object.entries(res.controls)) {
    manifest.files[k] = manifest.files[k] || {};
    manifest.files[k].control_ui_off = writePng(`${k}__control-ui-off`, v);
  }
  fs.writeFileSync(path.join(OUT, 'uistate.json'), JSON.stringify(res.states, null, 2));
  fs.writeFileSync(path.join(OUT, 'renderedtext.json'), JSON.stringify(res.text, null, 2));
  fs.writeFileSync(path.join(OUT, 'notes.json'), JSON.stringify(res.notes, null, 2));
  fs.writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 2));
  console.log('screens captured:', Object.keys(res.shots).join(', '));
  console.log('notes:', JSON.stringify(res.notes).slice(0, 1200));
} finally { await h.close(); }
