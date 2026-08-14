#!/usr/bin/env node
// critic-t4-shots2.mjs — T4 critic, pass 2: the screens the first pass could not reach
// (dialogue, level-up, book, a journal with something in it) plus the pause-rule and
// withdrawal measurements that need a fight.
import fs from 'node:fs';
import path from 'node:path';
import { launchGame } from '../lib/browser.mjs';
import { REPO_ROOT, parseArgs } from '../lib/cli.mjs';

const args = parseArgs();
const OUT = path.join(REPO_ROOT, 'corpus/90-verdicts/wave1/artifacts/T4-r1');
const W = 1920, H = 1080;
fs.mkdirSync(path.join(OUT, 'screens'), { recursive: true });
fs.mkdirSync(path.join(OUT, 'motion'), { recursive: true });

const h = await launchGame({ width: W, height: H });
const png = (dir, name, b64) => {
  const p = path.join(OUT, dir, `${name}.png`);
  fs.writeFileSync(p, Buffer.from(String(b64).split(',')[1], 'base64'));
  return p;
};

try {
  const res = await h.page.evaluate(async () => {
    const H = window.__HARNESS;
    await H.ready();
    if (H.setUIVisible) await H.setUIVisible(true);
    const shots = {}, states = {}, notes = {}, seq = [];
    const grab = async (n) => { shots[n] = await H.screenshot(); states[n] = H.getUIState(); };

    // ---------- A. journal with a real week in it -------------------------------------------
    // RI-UIX04 method 2 wants >=4 quests started on overlapping dates and >=12 entries.
    try {
      await H.closeMenu();
      const ids = H.questBook();
      const picked = [];
      for (const id of ids) {
        try { const r = H.questOpen(id); if (r) picked.push(id); } catch (e) { /* not offerable */ }
        if (picked.length >= 5) break;
      }
      notes.quests_opened = picked;
      // add several notes per quest so the chronology has something to interleave
      const noted = [];
      for (const id of picked) {
        for (let i = 1; i <= 4; i++) {
          try { noted.push([id, i, !!H.questNote(id, i)]); } catch (e) { noted.push([id, i, String(e.message).slice(0, 80)]); }
          await H.stepFrames(30);
        }
      }
      notes.notes_written = noted;
      notes.questState = H.getQuestState ? { journal_len: (H.getQuestState().journal || []).length } : null;
      await H.openMenu('journal', {});
      await H.stepFrames(2);
      await grab('journal-populated');
      notes.journal_uistate = H.getUIState().journal;
      // JU7 search
      try { notes.search = H.uiSearch ? H.uiSearch('the') : null; } catch (e) { notes.search = String(e.message); }
      notes.navigable_from_journal = H.getUIState().navigable;
    } catch (e) { notes.journal = String(e && e.message || e); }

    // ---------- B. dialogue window -----------------------------------------------------------
    try {
      await H.closeMenu();
      const npcs = H.listNPCs();
      const eid = (npcs[0] && (npcs[0].eid || npcs[0].id)) || null;
      notes.talk_eid = eid;
      const r = await H.talkTo(eid);
      notes.talkTo = r;
      await H.stepFrames(2);
      await grab('dialogue');
      notes.conversation = H.getConversationState ? H.getConversationState() : null;
      notes.dialogue_window = H.getUIState().dialogue_window;
      // say a topic so the history pane has more than a greeting
      try {
        const topics = (npcs[0].topics || []);
        if (topics[0]) { notes.say = H.conversationSay(topics[0]); await H.stepFrames(2); await grab('dialogue-after-topic'); }
      } catch (e) { notes.say_err = String(e.message); }
      try { H.conversationClose(); } catch {}
    } catch (e) { notes.dialogue = String(e && e.message || e); }

    // ---------- C. level-up at a hearth ------------------------------------------------------
    try {
      await H.closeMenu();
      const hs = H.listHearths();
      notes.hearths_shape = Array.isArray(hs) ? hs.length : Object.keys(hs);
      if (H.setAtHearth) H.setAtHearth(true);
      await H.openMenu('levelup', {});
      await H.stepFrames(2);
      await grab('levelup');
    } catch (e) { notes.levelup = String(e && e.message || e); }

    // ---------- D. a book --------------------------------------------------------------------
    try {
      await H.closeMenu();
      if (H.setAtHearth) H.setAtHearth(false);
      const books = H.listBooks ? H.listBooks() : null;
      notes.books = books ? (Array.isArray(books) ? books.slice(0, 5) : books) : 'no listBooks';
      let bid = null;
      if (Array.isArray(books) && books.length) bid = books[0].id || books[0];
      if (bid) { await H.openMenu('book', { id: bid }); await H.stepFrames(2); await grab('book'); notes.book_id = bid; }
    } catch (e) { notes.book = String(e && e.message || e); }

    // ---------- E. the pause rule (RI-UIX03 §A P1/P2/P4) --------------------------------------
    const pause = {};
    try {
      await H.closeMenu();
      await H.stepFrames(5);
      // P1 — out of combat, menu open, the world must NOT advance
      const f0 = H.getFrame();
      await H.openMenu('inventory', {});
      await H.stepFrames(120);
      const f1 = H.getFrame();
      pause.P1_delta_out_of_combat = f1 - f0;
      await H.closeMenu();
      // P4/P2 — start a fight, then open the menu; the world MUST advance
      const npcs = H.listNPCs();
      let target = null;
      try { const sp = H.spawnNPC ? H.spawnNPC({ kind: 'hostile' }) : null; target = sp && (sp.eid || sp.id); } catch (e) { pause.spawn_err = String(e.message); }
      if (!target) { const e0 = H.listEnemies ? H.listEnemies() : []; target = e0[0] && (e0[0].eid || e0[0].id); }
      pause.aggro_target = target;
      try { pause.aggro = H.aggro(target || undefined); } catch (e) { pause.aggro_err = String(e.message); }
      await H.stepFrames(3);
      pause.encounter_after_aggro = H.getEncounterState ? H.getEncounterState() : null;
      const f2 = H.getFrame();
      await H.openMenu('inventory', {});
      await H.stepFrames(120);
      const f3 = H.getFrame();
      pause.P2_delta_in_combat = f3 - f2;
      states['inventory-in-combat'] = H.getUIState();
      shots['inventory-in-combat'] = await H.screenshot();
      pause.P5_uistate = { coveragePct: H.getUIState().coveragePct, screen_alpha: H.getUIState().screen_alpha,
        world_rendered_behind: H.getUIState().world_rendered_behind, non_world_area_frac: H.getUIState().non_world_area_frac };
      // P6 input liveness in combat with the menu open
      try {
        H.queueInputs([{ f: 0, press: ['roll'] }, { f: 1, release: ['roll'] }]);
        await H.stepFrames(20);
        pause.P6_inputState = H.getInputState ? H.getInputState() : null;
      } catch (e) { pause.P6_err = String(e.message); }
      await H.closeMenu();
      pause.pauseReport = H.getUIPauseReport ? H.getUIPauseReport() : null;
    } catch (e) { pause.err = String(e && e.message || e); }
    notes.pause = pause;

    // ---------- F. the withdrawal, frame by frame (RI-UIX07 E-T2/E-T3) ------------------------
    const withdraw = { frames: [] };
    try {
      await H.closeMenu();
      await H.reset ? null : null;
    } catch {}
    try {
      // walk the boundary: capture the bearing dial's declaration each frame across aggro
      for (let i = 0; i < 10; i++) {
        await H.stepFrames(1);
        const st = H.getUIState();
        const b = (st.elements || []).find((e) => e.kind === 'bearing_dial');
        withdraw.frames.push({ frame: st.frame, phase: 'pre', dial: b ? { visible: b.visible, opacity: b.opacity, rect: b.rect } : null });
      }
      const t = withdraw.target = notes.pause && notes.pause.aggro_target;
      try { H.aggro(t || undefined); } catch (e) { withdraw.aggro_err = String(e.message); }
      for (let i = 0; i < 20; i++) {
        await H.stepFrames(1);
        const st = H.getUIState();
        const b = (st.elements || []).find((e) => e.kind === 'bearing_dial');
        withdraw.frames.push({ frame: st.frame, phase: 'post', dial: b ? { visible: b.visible, opacity: b.opacity, rect: b.rect } : null });
        if (i === 3) { shots['combat-hud'] = await H.screenshot(); states['combat-hud'] = H.getUIState(); }
      }
    } catch (e) { withdraw.err = String(e && e.message || e); }
    notes.withdraw = withdraw;

    return { shots, states, notes };
  });

  for (const [k, v] of Object.entries(res.shots)) console.log('wrote', png('screens', `${k}__1920x1080`, v));
  fs.writeFileSync(path.join(OUT, 'uistate/screens2__1920x1080.json'), JSON.stringify(res.states, null, 2));
  fs.writeFileSync(path.join(OUT, 'uistate/notes2__1920x1080.json'), JSON.stringify(res.notes, null, 2));
  console.log('PAUSE:', JSON.stringify(res.notes.pause).slice(0, 900));
  console.log('QUESTS:', JSON.stringify(res.notes.quests_opened));
  console.log('DIALOGUE:', JSON.stringify(res.notes.dialogue_window || res.notes.dialogue).slice(0, 600));
  console.log('LEVELUP:', JSON.stringify(res.notes.levelup || 'ok'));
  console.log('BOOK:', JSON.stringify(res.notes.books).slice(0, 200), res.notes.book || '');
} finally { await h.close(); }
