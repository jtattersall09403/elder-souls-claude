#!/usr/bin/env node
// critic-t4-run.mjs — T4 critic, the whole live pass in one browser session.
// Journal fixture + dialogue + level-up + book + pause rule + withdrawal + combat HUD.
import fs from 'node:fs';
import path from 'node:path';
import { launchGame } from '../lib/browser.mjs';
import { REPO_ROOT } from '../lib/cli.mjs';

const OUT = path.join(REPO_ROOT, 'corpus/90-verdicts/wave1/artifacts/T4-r1');
fs.mkdirSync(path.join(OUT, 'screens'), { recursive: true });

const IDX = {};
{
  const dir = path.join(REPO_ROOT, 'game/data/quests');
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith('.json')) continue;
    let d; try { d = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')); } catch { continue; }
    for (const q of d.quests || []) IDX[q.id] = (q.journal || []).map((j) => [j.index, j.state]);
  }
}

const h = await launchGame({ width: 1920, height: 1080 });
const shots = {}, out = {};
const save = () => {
  for (const [k, v] of Object.entries(shots)) {
    if (!v) continue;
    fs.writeFileSync(path.join(OUT, 'screens', `${k}__1920x1080.png`), Buffer.from(String(v).split(',')[1], 'base64'));
  }
  fs.writeFileSync(path.join(OUT, 'uistate/live-run.json'), JSON.stringify(out, null, 2));
};
const step = async (name, fn, arg) => {
  try {
    const r = await h.page.evaluate(fn, arg);
    if (r && r.__shot) { shots[name] = r.__shot; delete r.__shot; }
    if (r && r.__shots) { Object.assign(shots, r.__shots); delete r.__shots; }
    out[name] = r;
    console.log(`[${name}] ok`);
  } catch (e) { out[name] = { __err: String(e && e.message || e) }; console.log(`[${name}] FAILED: ${out[name].__err}`); }
  save();
};

try {
  await step('boot', async () => {
    const H = window.__HARNESS;
    await H.ready();
    if (H.setUIVisible) await H.setUIVisible(true);
    await H.closeMenu();
    return { build: H.getBuildInfo ? H.getBuildInfo() : null, frame: H.getFrame() };
  });

  // ---- 1. journal fixture --------------------------------------------------------------------
  await step('journal_fixture', async (IDX) => {
    const H = window.__HARNESS;
    H.questPresenceGate('off');
    const opened = [];
    for (const id of H.questBook()) {
      try { H.questPrepareOffer(id); } catch {}
      let r = null; try { r = H.questOpen(id); } catch {}
      if (r && r.ok) opened.push(id);
      if (opened.length >= 4) break;
    }
    const noted = [];
    const active = {};
    for (const id of opened) active[id] = (IDX[id] || []).filter((e) => e[1] === 'active').map((e) => e[0]);
    const rounds = Math.max(...opened.map((id) => active[id].length), 0);
    for (let k = 0; k < rounds; k++) {
      for (const id of opened) {
        const i = active[id][k];
        if (i === undefined) continue;
        let r = null; try { r = H.questNote(id, i); } catch (e) { r = { threw: String(e.message).slice(0, 60) }; }
        noted.push([id, i, r && r.ok ? 'ok' : JSON.stringify(r).slice(0, 60)]);
        await H.stepFrames(4);
      }
    }
    const qs = H.getQuestState();
    return { opened, noted, journal_len: (qs.journal || []).length, journal: (qs.journal || []).slice(0, 40) };
  }, IDX);

  await step('journal_screen', async () => {
    const H = window.__HARNESS;
    await H.closeMenu();
    await H.openMenu('journal', {});
    await H.stepFrames(2);
    const st = H.getUIState();
    const __shot = await H.screenshot();
    let search = null;
    try { search = H.uiSearch ? H.uiSearch('the') : 'absent'; } catch (e) { search = String(e.message); }
    return { __shot, mode: st.mode, journal: st.journal, navigable: st.navigable,
      elements: st.elements, rendered_text: st.rendered_text || null, toast: st.toast, search,
      map_exists: st.map_exists, map: st.map };
  });

  // append-only: write more entries, re-capture, and diff
  await step('journal_append_only', async (IDX) => {
    const H = window.__HARNESS;
    const before = H.getUIState();
    await H.closeMenu();
    const opened = Object.keys(IDX);
    const qs = H.getQuestState();
    const openIds = (qs.open || qs.active || []).map((q) => q.id || q);
    const added = [];
    for (const id of openIds) {
      for (const [i, state] of (IDX[id] || [])) {
        if (state !== 'active') continue;
        try { const r = H.questNote(id, i); if (r && r.ok) { added.push([id, i]); await H.stepFrames(3); } } catch {}
      }
    }
    await H.openMenu('journal', {});
    await H.stepFrames(2);
    const after = H.getUIState();
    return { openIds, added, before_texts: (before.elements || []).map((e) => e.text),
      after_texts: (after.elements || []).map((e) => e.text), after_journal: after.journal };
  }, IDX);

  // ---- 2. dialogue ---------------------------------------------------------------------------
  await step('dialogue', async () => {
    const H = window.__HARNESS;
    await H.closeMenu();
    const npcs = H.listNPCs();
    const n0 = npcs[0];
    const eid = n0 && (n0.eid || n0.id);
    const r = await H.talkTo(eid);
    await H.stepFrames(2);
    const shot_greeting = await H.screenshot();
    const st1 = H.getUIState();
    let say = null, shot_topic = null, st2 = null;
    const topics = (n0.topics || []);
    if (topics[0]) {
      try { say = H.conversationSay(topics[0]); } catch (e) { say = String(e.message); }
      await H.stepFrames(2);
      shot_topic = await H.screenshot();
      st2 = H.getUIState();
    }
    const conv = H.getConversationState ? H.getConversationState() : null;
    try { H.conversationClose(); } catch {}
    return { __shots: { 'dialogue-greeting': shot_greeting, 'dialogue-topic': shot_topic },
      npc: { eid, name: n0.name, topics, disposition: n0.base_disposition },
      talkTo: r, say, conversation: conv,
      elements1: st1.elements, dialogue_window1: st1.dialogue_window,
      elements2: st2 ? st2.elements : null, dialogue_window2: st2 ? st2.dialogue_window : null,
      surfaces: st1.surfaces, dialogue_surface: st1.dialogue_surface,
      world_rendered_behind: st1.world_rendered_behind, screen_alpha: st1.screen_alpha };
  });

  // ---- 3. level-up + book --------------------------------------------------------------------
  await step('levelup', async () => {
    const H = window.__HARNESS;
    await H.closeMenu();
    H.setAtHearth(true);
    let err = null, st = null, __shot = null;
    try { await H.openMenu('levelup', {}); await H.stepFrames(2); st = H.getUIState(); __shot = await H.screenshot(); }
    catch (e) { err = String(e.message); }
    return { __shot, err, mode: st && st.mode, elements: st && st.elements };
  });

  await step('book', async () => {
    const H = window.__HARNESS;
    await H.closeMenu(); H.setAtHearth(false);
    const ids = H.listReadables ? H.listReadables() : (H.listBooks ? H.listBooks() : null);
    let bid = null, err = null, st = null, __shot = null;
    if (Array.isArray(ids) && ids.length) bid = ids[0].id || ids[0];
    try { await H.openMenu('book', { id: bid }); await H.stepFrames(2); st = H.getUIState(); __shot = await H.screenshot(); }
    catch (e) { err = String(e.message); }
    return { __shot, bid, ids: Array.isArray(ids) ? ids.slice(0, 5) : ids, err, book: st && st.book, elements: st && st.elements };
  });

  // ---- 4. the pause rule ---------------------------------------------------------------------
  await step('pause_rule', async () => {
    const H = window.__HARNESS;
    await H.closeMenu(); await H.stepFrames(5);
    const r = {};
    const f0 = H.getFrame();
    await H.openMenu('inventory', {});
    await H.stepFrames(120);
    r.P1_delta_out_of_combat = H.getFrame() - f0;
    await H.closeMenu();
    // find something to fight
    const es = H.listEnemies ? H.listEnemies() : [];
    r.enemies = (es || []).slice(0, 3);
    let target = es && es[0] && (es[0].eid || es[0].id);
    try { r.aggro = H.aggro(target); } catch (e) { r.aggro_err = String(e.message); }
    await H.stepFrames(4);
    r.encounter = H.getEncounterState ? H.getEncounterState() : null;
    r.combat = H.getCombatState ? H.getCombatState() : null;
    const f2 = H.getFrame();
    await H.openMenu('inventory', {});
    await H.stepFrames(120);
    r.P2_delta_in_combat = H.getFrame() - f2;
    const st = H.getUIState();
    r.P5 = { coveragePct: st.coveragePct, screen_alpha: st.screen_alpha,
      world_rendered_behind: st.world_rendered_behind, non_world_area_frac: st.non_world_area_frac,
      full_screen_panels: st.full_screen_panels };
    const __shot = await H.screenshot();
    // P4: does the menu stay open and the world run
    r.P4_mode_still = st.mode;
    try { H.queueInputs([{ f: 0, press: ['roll'] }, { f: 1, release: ['roll'] }]); await H.stepFrames(20);
      r.P6_input = H.getInputState ? H.getInputState() : null; } catch (e) { r.P6_err = String(e.message); }
    r.pauseReport = H.getUIPauseReport ? H.getUIPauseReport() : null;
    await H.closeMenu();
    return { ...r, __shot };
  });

  // ---- 5. the withdrawal, frame by frame ------------------------------------------------------
  await step('withdrawal', async () => {
    const H = window.__HARNESS;
    await H.closeMenu();
    const frames = [];
    const rec = (phase) => {
      const st = H.getUIState();
      const dial = (st.elements || []).find((e) => e.kind === 'bearing_dial') || null;
      frames.push({ frame: st.frame, phase, n_elements: (st.elements || []).length,
        dial: dial ? { visible: dial.visible, opacity: dial.opacity, rect: dial.rect } : null,
        coveragePct: st.coveragePct });
    };
    for (let i = 0; i < 6; i++) { await H.stepFrames(1); rec('pre'); }
    const es = H.listEnemies ? H.listEnemies() : [];
    const target = es && es[0] && (es[0].eid || es[0].id);
    let aggro = null; try { aggro = H.aggro(target); } catch (e) { aggro = String(e.message); }
    let __shot = null;
    for (let i = 0; i < 20; i++) { await H.stepFrames(1); rec('post'); if (i === 4) __shot = await H.screenshot(); }
    return { __shot, aggro, target, frames, encounter: H.getEncounterState ? H.getEncounterState() : null };
  });

  await step('shot_combat_hud', async () => {
    const H = window.__HARNESS;
    const st = H.getUIState();
    const __shot = await H.screenshot();
    return { __shot, elements: st.elements, coveragePct: st.coveragePct, hud: st.hud };
  });
} finally {
  save();
  await h.close();
  console.log('done');
}
