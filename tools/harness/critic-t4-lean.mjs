#!/usr/bin/env node
// critic-t4-lean.mjs — T4 critic. The measurements, on the corpus's own `ui-journal` fixture
// (5 quests, 19 interleaved entries, a full carried inventory) rather than one built by hand.
// Every step is its own page.evaluate so one slow step cannot cost the rest.
import fs from 'node:fs';
import path from 'node:path';
import { launchGame } from '../lib/browser.mjs';
import { REPO_ROOT, parseArgs } from '../lib/cli.mjs';

const args = parseArgs();
const OUT = path.join(REPO_ROOT, 'corpus/90-verdicts/wave1/artifacts/T4-r1');
fs.mkdirSync(path.join(OUT, 'screens'), { recursive: true });
const h = await launchGame({ width: 1920, height: 1080, state: args.state || 'ui-journal' });
const out = {}, shots = {};
const save = () => {
  for (const [k, v] of Object.entries(shots)) { if (!v) continue;
    fs.writeFileSync(path.join(OUT, 'screens', `${k}.png`), Buffer.from(String(v).split(',')[1], 'base64')); }
  fs.writeFileSync(path.join(OUT, `uistate/lean${args.state ? '-' + args.state : ''}.json`), JSON.stringify(out, null, 2));
};
const step = async (name, fn, arg) => {
  const t0 = Date.now();
  try {
    const r = await Promise.race([h.page.evaluate(fn, arg),
      new Promise((_, rj) => setTimeout(() => rj(new Error('step timeout 90s')), 90000))]);
    if (r && r.__shots) { Object.assign(shots, r.__shots); delete r.__shots; }
    out[name] = r; console.log(`[${name}] ok ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  } catch (e) { out[name] = { __err: String(e && e.message || e) }; console.log(`[${name}] FAIL ${out[name].__err}`); }
  save();
};

try {
  await step('boot', async () => {
    const H = window.__HARNESS; await H.ready();
    if (H.setUIVisible) await H.setUIVisible(true);
    await H.closeMenu(); await H.stepFrames(4);
    const st = H.getUIState();
    return { frame: H.getFrame(), mode: st.mode, quest: H.getQuestState ? { journal_len: (H.getQuestState().journal || []).length } : null,
      hud_elements: st.elements, coveragePct: st.coveragePct, fonts: st.fonts,
      textRenderPath: st.textRenderPath, text_raster_scale: st.text_raster_scale,
      text_glyph_source: st.text_glyph_source, materials: st.materials, overdraw: st.overdraw,
      markers: st.markers, marker_census: st.marker_census, __shots: { 'fixture-world-hud__1920x1080': await H.screenshot() } };
  });

  await step('journal', async () => {
    const H = window.__HARNESS;
    await H.closeMenu(); await H.openMenu('journal', {}); await H.stepFrames(2);
    const st = H.getUIState();
    return { journal: st.journal, navigable: st.navigable, mode: st.mode,
      elements: st.elements, toast: st.toast, map_exists: st.map_exists,
      coveragePct: st.coveragePct, screen_alpha: st.screen_alpha, world_rendered_behind: st.world_rendered_behind,
      __shots: { 'fixture-journal__1920x1080': await H.screenshot() } };
  });

  await step('journal_search', async () => {
    const H = window.__HARNESS;
    let r = null; try { r = H.uiSearch('the'); } catch (e) { r = { err: String(e.message) }; }
    const st = H.getUIState();
    return { search: r, journal: st.journal, elements: st.elements,
      __shots: { 'fixture-journal-search__1920x1080': await H.screenshot() } };
  });

  await step('inventory', async () => {
    const H = window.__HARNESS;
    await H.closeMenu(); await H.openMenu('inventory', {}); await H.stepFrames(2);
    const st = H.getUIState();
    return { mode: st.mode, elements: st.elements, coveragePct: st.coveragePct,
      screen_alpha: st.screen_alpha, world_rendered_behind: st.world_rendered_behind,
      full_screen_panels: st.full_screen_panels, non_world_area_frac: st.non_world_area_frac,
      __shots: { 'fixture-inventory__1920x1080': await H.screenshot() } };
  });

  await step('levelup', async () => {
    const H = window.__HARNESS;
    await H.closeMenu(); H.setAtHearth(true);
    let err = null, st = null, shot = null;
    try { await H.openMenu('levelup', {}); await H.stepFrames(2); st = H.getUIState(); shot = await H.screenshot(); }
    catch (e) { err = String(e.message); }
    return { err, mode: st && st.mode, elements: st && st.elements, __shots: { 'fixture-levelup__1920x1080': shot } };
  });

  await step('dialogue', async () => {
    const H = window.__HARNESS;
    await H.closeMenu(); H.setAtHearth(false);
    const npcs = H.listNPCs() || [];
    const n0 = npcs.find((n) => (n.topics || []).length >= 2) || npcs[0];
    if (!n0) return { none: true, n: npcs.length };
    const eid = n0.eid || n0.id;
    const talk = await H.talkTo(eid); await H.stepFrames(2);
    const st1 = H.getUIState(); const shot1 = await H.screenshot();
    let say = null, st2 = null, shot2 = null;
    try { say = H.conversationSay((n0.topics || [])[0]); await H.stepFrames(2); st2 = H.getUIState(); shot2 = await H.screenshot(); }
    catch (e) { say = { err: String(e.message) }; }
    const conv = H.getConversationState ? H.getConversationState() : null;
    return { npc: { eid, name: n0.name, topics: n0.topics, disposition: n0.base_disposition },
      talk, say, conv, dialogue_window: st1.dialogue_window, elements1: st1.elements,
      elements2: st2 && st2.elements, dialogue_surface: st1.dialogue_surface,
      surfaces: st1.surfaces, world_rendered_behind: st1.world_rendered_behind, screen_alpha: st1.screen_alpha,
      __shots: { 'fixture-dialogue__1920x1080': shot1, 'fixture-dialogue-topic__1920x1080': shot2 } };
  });

  await step('pause', async () => {
    const H = window.__HARNESS;
    try { H.conversationClose(); } catch {}
    await H.closeMenu(); await H.stepFrames(4);
    const r = {};
    const f0 = H.getFrame();
    await H.openMenu('inventory', {}); await H.stepFrames(120);
    r.P1_delta_out_of_combat = H.getFrame() - f0;
    await H.closeMenu();
    const es = (H.listEnemies ? H.listEnemies() : []) || [];
    r.enemies = es.slice(0, 3).map((e) => e.eid || e.id || e);
    try { r.aggro = H.aggro(r.enemies[0]); } catch (e) { r.aggro_err = String(e.message); }
    await H.stepFrames(4);
    r.encounter = H.getEncounterState ? H.getEncounterState() : null;
    const f2 = H.getFrame();
    await H.openMenu('inventory', {}); await H.stepFrames(120);
    r.P2_delta_in_combat = H.getFrame() - f2;
    const st = H.getUIState();
    r.P4_mode = st.mode;
    r.P5 = { coveragePct: st.coveragePct, screen_alpha: st.screen_alpha,
      world_rendered_behind: st.world_rendered_behind, non_world_area_frac: st.non_world_area_frac };
    r.pauseReport = H.getUIPauseReport ? H.getUIPauseReport() : null;
    r.__shots = { 'fixture-inventory-in-combat__1920x1080': await H.screenshot() };
    await H.closeMenu();
    return r;
  });

  await step('withdrawal', async () => {
    const H = window.__HARNESS;
    await H.closeMenu();
    const frames = [];
    const rec = (phase) => { const st = H.getUIState();
      const d = (st.elements || []).find((e) => e.kind === 'bearing_dial') || null;
      frames.push({ frame: st.frame, phase, n: (st.elements || []).length,
        dial: d ? { visible: d.visible, opacity: d.opacity, rect: d.rect } : null, cov: st.coveragePct }); };
    for (let i = 0; i < 5; i++) { await H.stepFrames(1); rec('pre'); }
    const es = (H.listEnemies ? H.listEnemies() : []) || [];
    let aggro = null; try { aggro = H.aggro((es[0] || {}).eid || (es[0] || {}).id); } catch (e) { aggro = String(e.message); }
    let shot = null;
    for (let i = 0; i < 15; i++) { await H.stepFrames(1); rec('post'); if (i === 3) shot = await H.screenshot(); }
    return { aggro, frames, encounter: H.getEncounterState ? H.getEncounterState() : null,
      __shots: { 'fixture-combat-hud__1920x1080': shot } };
  });
} finally { save(); await h.close(); console.log('done'); }
