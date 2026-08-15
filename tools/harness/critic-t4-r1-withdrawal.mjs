#!/usr/bin/env node
// critic-t4-r1-withdrawal.mjs — the ONE check that decides AR-2 on this piece, and nothing else.
//
// RI-UIX07 V7 (E-T2/E-T5) and RI-UIX01 U4/X6 are the same question asked from two sides:
// **is the bearing dial declared on a combat frame?** If it is, X6 (compass strip) is a
// declared forbidden element on a combat frame and AR-2 fires; if it is not, the world set
// withdraws as S54 requires.
//
// getUIState() carries NO `combat_phase` field on this build (verified by enumerating its keys
// at run time — RI-UIX07 R4), so the phase is taken by proxy from __HARNESS.aggro() plus the
// engine's own inCombat flag as reported in getUIState().hud, and the deviation is recorded.
//
// NO SCREENSHOTS. Three earlier live runs on this piece lost every step after boot to
// `H.screenshot()` timing out on a loaded box; this probe takes element state only so that the
// measurement survives the contention that killed the pictures.
import fs from 'node:fs';
import path from 'node:path';
import { launchGame } from '../lib/browser.mjs';
import { REPO_ROOT, parseArgs } from '../lib/cli.mjs';

const args = parseArgs();
const OUT = path.join(REPO_ROOT, 'corpus/90-verdicts/wave1/artifacts/T4-r1/uistate');
fs.mkdirSync(OUT, { recursive: true });
const h = await launchGame({ width: 1280, height: 720, state: args.state || 'ui-journal' });
const out = {};
const save = () => fs.writeFileSync(path.join(OUT, 'withdrawal.json'), JSON.stringify(out, null, 2));
const step = async (name, fn, ms = 60000) => {
  const t0 = Date.now();
  try {
    out[name] = await Promise.race([h.page.evaluate(fn),
      new Promise((_, rj) => setTimeout(() => rj(new Error(`timeout ${ms / 1000}s`)), ms))]);
    console.log(`[${name}] ok ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  } catch (e) { out[name] = { __err: String((e && e.message) || e) }; console.log(`[${name}] FAIL ${out[name].__err}`); }
  save();
};

try {
  await step('probe', async () => {
    const H = window.__HARNESS; await H.ready();
    if (H.setUIVisible) await H.setUIVisible(true);
    await H.closeMenu();
    const WORLD_SET = ['bearing_dial', 'effect_strip', 'sneak_state', 'place_name', 'breath_meter'];
    const snap = (phase) => {
      const st = H.getUIState();
      const els = st.elements || [];
      return {
        phase, frame: H.getFrame(),
        inCombat: st.hud ? st.hud.inCombat : (st.menu ? st.menu.inCombat : null),
        kinds: els.map((e) => e.kind),
        world_set_present: WORLD_SET.filter((k) => els.some((e) => e.kind === k && e.visible !== false)),
        dial: (() => { const d = els.find((e) => e.kind === 'bearing_dial');
          return d ? { visible: d.visible, opacity: d.opacity, rect: d.rect } : null; })(),
        withheld: st.bearing_withheld_because,
        coveragePct: st.coveragePct,
      };
    };
    const frames = [];
    for (let i = 0; i < 3; i++) { await H.stepFrames(1); frames.push(snap('pre')); }
    // The ui-journal fixture ships with no hostiles, so the fight has to be made rather than found.
    // Same move ui-pause.mjs uses to reach M-P2: spawn one `inf_trash` at 4.6 m and aggro it.
    let es = (H.listEnemies ? H.listEnemies() : []) || [];
    let eid = (es[0] || {}).eid || (es[0] || {}).id;
    let spawned = null;
    if (!eid) {
      try { spawned = await H.spawn('inf_trash', 0, 4.6, { as: 'p9' }); eid = (spawned && spawned.eid) || 'p9'; }
      catch (e) { spawned = 'ERR ' + e.message; }
    }
    let aggro = null; try { aggro = H.aggro(eid); } catch (e) { aggro = 'ERR ' + e.message; }
    for (let i = 0; i < 8; i++) { await H.stepFrames(1); frames.push(snap('post')); }
    return { n_enemies: es.length, eid: eid || null, spawned, aggro, frames,
      encounter: (() => { try { return H.getEncounterState(); } catch (e) { return 'ERR ' + e.message; } })(),
      uistate_has_combat_phase: Object.prototype.hasOwnProperty.call(H.getUIState(), 'combat_phase') };
  }, 240000);
} finally { save(); await h.close(); console.log('done'); }
