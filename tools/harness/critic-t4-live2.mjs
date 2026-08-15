#!/usr/bin/env node
// critic-t4-live2.mjs — T4 critic, the three live measurements the first fixture run lost:
// the dialogue window (RI-UIX08 look), the pause rule (RI-UIX03 §A) and the compass
// withdrawal at the fight boundary (RI-UIX07 §E).
import fs from 'node:fs';
import path from 'node:path';
import { launchGame } from '../lib/browser.mjs';
import { REPO_ROOT, parseArgs } from '../lib/cli.mjs';
const args = parseArgs();
const OUT = path.join(REPO_ROOT, 'corpus/90-verdicts/wave1/artifacts/T4-r1');
const h = await launchGame({ width: 1920, height: 1080, state: args.state || 'ui-journal' });
const out = {}, shots = {};
const save = () => {
  for (const [k, v] of Object.entries(shots)) { if (!v) continue;
    fs.writeFileSync(path.join(OUT, 'screens', `${k}.png`), Buffer.from(String(v).split(',')[1], 'base64')); }
  fs.writeFileSync(path.join(OUT, 'uistate/live2.json'), JSON.stringify(out, null, 2));
};
const step = async (name, fn, ms = 120000) => {
  const t0 = Date.now();
  try {
    const r = await Promise.race([h.page.evaluate(fn),
      new Promise((_, rj) => setTimeout(() => rj(new Error('step timeout')), ms))]);
    if (r && r.__shots) { Object.assign(shots, r.__shots); delete r.__shots; }
    out[name] = r; console.log(`[${name}] ok ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  } catch (e) { out[name] = { __err: String(e && e.message || e) }; console.log(`[${name}] FAIL ${out[name].__err}`); }
  save();
};
try {
  await step('boot', async () => { const H = window.__HARNESS; await H.ready();
    if (H.setUIVisible) await H.setUIVisible(true); await H.closeMenu(); await H.stepFrames(4);
    return { frame: H.getFrame(), npcs: (H.listNPCs() || []).length, enemies: (H.listEnemies ? H.listEnemies() : []).length }; });

  await step('dialogue_open', async () => {
    const H = window.__HARNESS;
    const npcs = H.listNPCs() || [];
    const n0 = npcs.find((n) => (n.topics || []).length >= 2) || npcs[0];
    if (!n0) return { none: true };
    const eid = n0.eid || n0.id;
    const talk = await H.talkTo(eid);
    await H.stepFrames(2);
    const st = H.getUIState();
    return { npc: { eid, name: n0.name, topics: n0.topics, disp: n0.base_disposition }, talk,
      dialogue_window: st.dialogue_window, dialogue_surface: st.dialogue_surface,
      elements: st.elements, world_rendered_behind: st.world_rendered_behind,
      screen_alpha: st.screen_alpha, surfaces: st.surfaces, mode: st.mode,
      __shots: { 'fixture-dialogue__1920x1080': await H.screenshot() } };
  }, 150000);

  await step('dialogue_topic', async () => {
    const H = window.__HARNESS;
    const c = H.getConversationState ? H.getConversationState() : null;
    const t = (c && (c.topics || c.topicsOffered || c.available) || [])[0];
    let say = null; try { say = H.conversationSay(t); } catch (e) { say = { err: String(e.message) }; }
    await H.stepFrames(2);
    const st = H.getUIState();
    return { picked: t, say, conv: H.getConversationState ? H.getConversationState() : null,
      dialogue_window: st.dialogue_window, elements: st.elements,
      __shots: { 'fixture-dialogue-topic__1920x1080': await H.screenshot() } };
  }, 150000);

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
    r.enemies = es.slice(0, 4).map((e) => e.eid || e.id || e);
    for (const t of r.enemies) { try { r.aggro = H.aggro(t); r.aggro_target = t; break; } catch (e) { r.aggro_err = String(e.message); } }
    await H.stepFrames(6);
    try { r.combat = H.getCombatState ? H.getCombatState() : null; } catch (e) { r.combat_err = String(e.message); }
    const f2 = H.getFrame();
    await H.openMenu('inventory', {}); await H.stepFrames(120);
    r.P2_delta_in_combat = H.getFrame() - f2;
    const st = H.getUIState();
    r.P4_mode_after = st.mode;
    r.P5 = { coveragePct: st.coveragePct, screen_alpha: st.screen_alpha,
      world_rendered_behind: st.world_rendered_behind, non_world_area_frac: st.non_world_area_frac,
      full_screen_panels: st.full_screen_panels };
    r.__shots = { 'fixture-inventory-in-combat__1920x1080': await H.screenshot() };
    try { H.queueInputs([{ f: 0, press: ['roll'] }, { f: 1, release: ['roll'] }]); await H.stepFrames(20);
      r.P6_input = H.getInputState ? H.getInputState() : null; } catch (e) { r.P6_err = String(e.message); }
    r.pauseReport = H.getUIPauseReport ? H.getUIPauseReport() : null;
    await H.closeMenu();
    return r;
  }, 180000);

  await step('withdrawal', async () => {
    const H = window.__HARNESS;
    await H.closeMenu();
    const frames = [];
    const rec = (phase) => { const st = H.getUIState();
      const d = (st.elements || []).find((e) => e.kind === 'bearing_dial') || null;
      frames.push({ f: st.frame, phase, n: (st.elements || []).length,
        dial: d ? { v: d.visible, o: d.opacity, rect: d.rect } : null, cov: st.coveragePct }); };
    for (let i = 0; i < 5; i++) { await H.stepFrames(1); rec('pre'); }
    const es = (H.listEnemies ? H.listEnemies() : []) || [];
    let aggro = null;
    for (const e of es) { try { aggro = H.aggro(e.eid || e.id); break; } catch (x) { aggro = String(x.message); } }
    let shot = null;
    for (let i = 0; i < 15; i++) { await H.stepFrames(1); rec('post'); if (i === 3) shot = await H.screenshot(); }
    return { aggro, frames, __shots: { 'fixture-combat-hud__1920x1080': shot } };
  }, 180000);
} finally { save(); await h.close(); console.log('done'); }
