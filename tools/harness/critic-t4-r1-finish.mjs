#!/usr/bin/env node
// critic-t4-r1-finish.mjs — T4 critic, round 1, the measurements the two earlier live runs
// lost to a renderer crash and a 90 s step timeout: the dialogue window's LOOK (RI-UIX08 §A/§E1),
// the bearing dial's withdrawal across the fight boundary (RI-UIX07 E-T2/E-T3), and the
// populated-density numbers RI-UIX09 §A asks for (D1 declared, D2 fill fraction).
//
// Every step is its own page.evaluate with its own timeout, and the sub-steps inside the
// dialogue step are separated so a hang names itself instead of costing the whole run.
import fs from 'node:fs';
import path from 'node:path';
import { launchGame } from '../lib/browser.mjs';
import { REPO_ROOT, parseArgs } from '../lib/cli.mjs';

const args = parseArgs();
const OUT = path.join(REPO_ROOT, 'corpus/90-verdicts/wave1/artifacts/T4-r1');
fs.mkdirSync(path.join(OUT, 'screens'), { recursive: true });
fs.mkdirSync(path.join(OUT, 'uistate'), { recursive: true });
const h = await launchGame({ width: 1920, height: 1080, state: args.state || 'ui-journal' });
const out = {}, shots = {};
const save = () => {
  for (const [k, v] of Object.entries(shots)) {
    if (!v) continue;
    fs.writeFileSync(path.join(OUT, 'screens', `${k}.png`), Buffer.from(String(v).split(',')[1], 'base64'));
  }
  fs.writeFileSync(path.join(OUT, 'uistate/finish.json'), JSON.stringify(out, null, 2));
};
const step = async (name, fn, ms = 120000) => {
  const t0 = Date.now();
  try {
    const r = await Promise.race([h.page.evaluate(fn),
      new Promise((_, rj) => setTimeout(() => rj(new Error(`step timeout ${ms / 1000}s`)), ms))]);
    if (r && r.__shots) { Object.assign(shots, r.__shots); delete r.__shots; }
    out[name] = r; console.log(`[${name}] ok ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  } catch (e) { out[name] = { __err: String((e && e.message) || e) }; console.log(`[${name}] FAIL ${out[name].__err}`); }
  save();
};

try {
  await step('boot', async () => {
    const H = window.__HARNESS; await H.ready();
    if (H.setUIVisible) await H.setUIVisible(true);
    await H.closeMenu(); await H.stepFrames(4);
    const st = H.getUIState();
    return { frame: H.getFrame(), mode: st.mode, fields: Object.keys(st).sort(),
      elementKinds: [...new Set((st.elements || []).map((e) => e.kind))].sort() };
  });

  // --- RI-UIX09 D1/D2 on the populated inventory -------------------------------------------
  await step('density_inventory', async () => {
    const H = window.__HARNESS;
    await H.closeMenu(); await H.openMenu('inventory', {}); await H.stepFrames(2);
    const st = H.getUIState();
    const els = st.elements || [];
    const panels = els.filter((e) => e.kind === 'panel');
    const panel = panels.sort((a, b) => (b.rect[2] * b.rect[3]) - (a.rect[2] * a.rect[3]))[0] || null;
    const inside = panel ? els.filter((e) => e.rect[0] >= panel.rect[0] - 1 && e.rect[1] >= panel.rect[1] - 1
      && e.rect[0] + e.rect[2] <= panel.rect[0] + panel.rect[2] + 1
      && e.rect[1] + e.rect[3] <= panel.rect[1] + panel.rect[3] + 1) : [];
    const PICTORIAL = ['icon', 'item_icon', 'doll', 'portrait', 'map_terrain', 'glyph_object', 'paperdoll', 'depiction'];
    return {
      panel_rect: panel && panel.rect,
      n_elements_in_panel: inside.length,
      kinds_in_panel: inside.reduce((a, e) => (a[e.kind] = (a[e.kind] || 0) + 1, a), {}),
      pictorial_vocabulary_counted: PICTORIAL,
      D1_declared: inside.filter((e) => PICTORIAL.includes(e.kind)).length,
      item_rows: inside.filter((e) => /item_row|inventory_row|list_row/.test(e.kind)).length,
      detail_panel_kinds: inside.filter((e) => /detail|tooltip/.test(e.kind)).map((e) => e.kind),
      __shots: { 'density-inventory__1920x1080': await H.screenshot() },
    };
  });

  // --- RI-UIX07 E-T2/E-T3: the bearing dial across the boundary -----------------------------
  await step('withdrawal', async () => {
    const H = window.__HARNESS;
    await H.closeMenu(); await H.stepFrames(2);
    const frames = [];
    const rec = (phase) => {
      const st = H.getUIState();
      const d = (st.elements || []).find((e) => e.kind === 'bearing_dial') || null;
      frames.push({ frame: st.frame != null ? st.frame : H.getFrame(), phase, n: (st.elements || []).length,
        dial: d ? { visible: d.visible, opacity: d.opacity, rect: d.rect } : null,
        withheld: st.bearing_withheld_because != null ? st.bearing_withheld_because : undefined,
        cov: st.coveragePct });
    };
    for (let i = 0; i < 4; i++) { await H.stepFrames(1); rec('pre'); }
    const es = (H.listEnemies ? H.listEnemies() : []) || [];
    let aggro = null;
    try { aggro = H.aggro((es[0] || {}).eid || (es[0] || {}).id); } catch (e) { aggro = 'ERR ' + e.message; }
    let shot = null;
    for (let i = 0; i < 10; i++) { await H.stepFrames(1); rec('post'); if (i === 2) shot = await H.screenshot(); }
    return { n_enemies: es.length, aggro, frames, __shots: { 'withdrawal-combat-hud__1920x1080': shot } };
  }, 150000);

  // --- RI-UIX08 look: the dialogue window ---------------------------------------------------
  await step('dialogue_list', async () => {
    const H = window.__HARNESS;
    try { H.conversationClose(); } catch {}
    await H.closeMenu(); await H.stepFrames(2);
    const npcs = (H.listNPCs ? H.listNPCs() : []) || [];
    return { n: npcs.length, sample: npcs.slice(0, 8).map((n) => ({ eid: n.eid || n.id, name: n.name, topics: (n.topics || []).length })) };
  }, 90000);

  await step('dialogue_open', async () => {
    const H = window.__HARNESS;
    const npcs = (H.listNPCs ? H.listNPCs() : []) || [];
    const n0 = npcs.slice().sort((a, b) => (b.topics || []).length - (a.topics || []).length)[0];
    if (!n0) return { none: true };
    const eid = n0.eid || n0.id;
    let talk = null; try { talk = await H.talkTo(eid); } catch (e) { talk = 'ERR ' + e.message; }
    await H.stepFrames(2);
    const st = H.getUIState();
    return { npc: { eid, name: n0.name, topics: n0.topics }, talk, mode: st.mode,
      dialogue_window: st.dialogue_window, surfaces: st.surfaces,
      screen_alpha: st.screen_alpha, world_rendered_behind: st.world_rendered_behind,
      elements: st.elements,
      __shots: { 'dialogue-window__1920x1080': await H.screenshot() } };
  }, 150000);

  await step('dialogue_say', async () => {
    const H = window.__HARNESS;
    const conv = H.getConversationState ? H.getConversationState() : null;
    const topics = (conv && (conv.topics || conv.topicsHeld)) || [];
    let say = null;
    const t0 = Array.isArray(topics) ? (typeof topics[0] === 'string' ? topics[0] : (topics[0] && topics[0].id)) : null;
    try { say = t0 ? H.conversationSay(t0) : { skipped: 'no topic' }; } catch (e) { say = 'ERR ' + e.message; }
    await H.stepFrames(2);
    const st = H.getUIState();
    return { conv, said: t0, say, dialogue_window: st.dialogue_window, elements: st.elements,
      __shots: { 'dialogue-window-after-topic__1920x1080': await H.screenshot() } };
  }, 120000);

  // --- RI-UIX03 P5: the same inventory screen, opened during a fight ------------------------
  await step('inventory_in_combat', async () => {
    const H = window.__HARNESS;
    try { H.conversationClose(); } catch {}
    await H.closeMenu(); await H.stepFrames(2);
    const f0 = H.getFrame();
    await H.openMenu('inventory', {}); await H.stepFrames(120);
    const p1 = H.getFrame() - f0;
    await H.closeMenu();
    const es = (H.listEnemies ? H.listEnemies() : []) || [];
    let aggro = null; try { aggro = H.aggro((es[0] || {}).eid || (es[0] || {}).id); } catch (e) { aggro = 'ERR ' + e.message; }
    await H.stepFrames(4);
    const f2 = H.getFrame();
    await H.openMenu('inventory', {}); await H.stepFrames(120);
    const p2 = H.getFrame() - f2;
    const st = H.getUIState();
    let roll = null;
    try { H.clearInputs && H.clearInputs(); H.queueInputs([{ f: 0, tap: 'roll', hold: 3 }]); await H.stepFrames(20);
      roll = H.getCombatState ? H.getCombatState() : null; } catch (e) { roll = 'ERR ' + e.message; }
    return { P1_delta_out_of_combat: p1, P2_delta_in_combat: p2, P4_mode: st.mode,
      P5: { coveragePct: st.coveragePct, screen_alpha: st.screen_alpha,
        world_rendered_behind: st.world_rendered_behind, non_world_area_frac: st.non_world_area_frac,
        full_screen_panels: st.full_screen_panels },
      P6_roll: roll,
      __shots: { 'inventory-in-combat__1920x1080': await H.screenshot() } };
  }, 180000);
} finally { save(); await h.close(); console.log('done'); }
