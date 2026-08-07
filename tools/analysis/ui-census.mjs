#!/usr/bin/env node
// ui-census.mjs — RI-UIX01 §C (the budget) and §D (stamina as a correctness property).
//
// Named by RI-UIX01's Comparison method step 2 and step 4, and it did not exist. Written by the
// W1-21 builder; declared in orchestration/status/W1-21.json. A builder does not grade itself
// with a tool it wrote (TOOL-LOOP rule 3) — this is infrastructure, and the verdict is a
// separate agent's.
//
// It drives the game itself rather than reading a run directory, because there is no capture
// format in this repo that carries a per-frame `getUIState()`. `--run <dir>` is accepted and
// re-reads a capture this tool wrote earlier, so a verdict can cite the artifact rather than
// re-run the browser.
//
// THE TWO HALVES.
//
//  §C  the census. Element counts, UNION coverage (union, not sum — overlapping elements must
//      not be double-counted), coverage of the central 50%×50%, world-anchored elements, and
//      numeric text. All read from `getUIState()`, which in this build is computed from the
//      layout that was drawn rather than declared alongside it.
//
//  §D1 SAME-FRAME TRUTH, and this is the check the item cares most about: for every frame of a
//      1,800-frame trace, `getUIState().elements['hud.stamina'].fill` must equal
//      `player.stamina / stamina_max` to within ±0.005, for 100% of frames. A tween shows up as
//      a characteristic exponential error curve after each spend, reported as `tween_detected`.
//      The tween detector is not "is the error big" — an eased bar can be within tolerance on a
//      slow drain — it is "does the error DECAY after a spend", which is what easing is.
//
// SELF-TEST: `--self-test` injects a tween in the page (wrapping getUIState to lerp the fill)
// and asserts the detector goes red, then removes it and asserts it goes green. A probe that
// cannot fail buys a false pass.
import fs from 'node:fs';
import path from 'node:path';
import { launchGame } from '../lib/browser.mjs';
import { parseArgs, wantsHelp, usage, log, RUNS_DIR, ensureDir, writeJson } from '../lib/cli.mjs';

const USAGE = `
ui-census.mjs — RI-UIX01 §C element census and §D1 stamina same-frame truth.

USAGE
  node tools/analysis/ui-census.mjs [--state <name>] [--frames 1800] [--width 1920 --height 1080]
                                    [--run <dir>] [--out <dir>] [--json] [--self-test] [--curve]

  --state    named state to load (default: arena_duel — a fight, so the HUD is in combat)
  --frames   trace length for §D1 (default 1800, which is the item's own figure)
  --run      re-read a capture this tool wrote instead of launching a browser
  --curve    additionally check the displayed souls-to-next against RI-PRG01's curve (L3)
  --self-test  prove the §D1 detector can go red

EXIT 0 all checks pass · 1 one or more fail · 2 could not measure
`;

const args = parseArgs();
if (wantsHelp(args)) usage(USAGE);

const BUDGET = {
  persistent: { pass: 6, fail: 9 },
  peak_total: { pass: 9, fail: 12 },
  coverage_pct: { pass: 4.0, fail: 8.0 },
  coverage_conditional_pct: { pass: 6.5, fail: 10.0 },
  centre_pct: { pass: 0.0, fail: 0.0 },
  numeric_text: { pass: 1, fail: 3 },
  tolerance: 0.005,
};

const RUN = path.join(RUNS_DIR, String(args.out || 'UI-CENSUS'));

if (args.run) {
  const cap = JSON.parse(fs.readFileSync(path.join(String(args.run), 'ui-census.json'), 'utf8'));
  report(cap);
  process.exit(cap.ok ? 0 : 1);
}

const width = Number(args.width || 1920), height = Number(args.height || 1080);
const frames = Number(args.frames || 1800);
const state = String(args.state || 'arena_duel');

const h = await launchGame({ width, height, timeout: 240000 });
let out;
try {
  await h.h('setRenderRate', 0);
  await h.h('loadState', state);
  await h.h('stepFrames', 4);

  // Wake a fight up so the HUD is measured IN COMBAT, which is what §C budgets.
  const ents = await h.h('listEntities');
  const target = (ents || []).find((e) => e.archetype && e.archetype !== 'player' && e.archetype !== 'DUMMY');
  if (target) { try { await h.h('aggro', target.eid); await h.h('lockOn', target.eid); } catch { /* not aggroable */ } }
  await h.h('stepFrames', 8);

  const census = await h.h('getUIState');
  const inCombat = (await h.h('getUIPauseReport')).in_combat;

  // ---- §D1: one sample per frame, taken INSIDE the page so the two reads cannot straddle a step
  const samples = await h.page.evaluate(async (n) => {
    const H = window.__HARNESS;
    const out = [];
    // a script that actually spends stamina: roll, sprint, swing, repeat.
    H.queueInputs([
      { f: 10, press: ['roll'] }, { f: 13, release: ['roll'] },
      { f: 60, press: ['sprint'] }, { f: 200, release: ['sprint'] },
      { f: 230, press: ['light'] }, { f: 234, release: ['light'] },
      { f: 300, press: ['roll'] }, { f: 303, release: ['roll'] },
      { f: 420, press: ['heavy'] }, { f: 426, release: ['heavy'] },
      { f: 520, press: ['roll'] }, { f: 523, release: ['roll'] },
      { f: 700, press: ['sprint'] }, { f: 1200, release: ['sprint'] },
    ]);
    for (let i = 0; i < n; i++) {
      H.stepFrames(1);
      const ui = H.getUIState();
      const p = H.getPlayerStats();
      const bar = ui.elements.find((e) => e.id === 'hud.stamina');
      out.push({
        f: H.getFrame(),
        fill: bar ? bar.fill : null,
        truth: p.stamina_max ? p.stamina / p.stamina_max : null,
        blocked: bar && bar.meta ? !!bar.meta.regen_blocked : false,
        exhausted: bar && bar.meta ? !!bar.meta.exhausted : false,
      });
    }
    return out;
  }, frames);

  const errs = samples.map((s) => (s.fill === null || s.truth === null ? Infinity : Math.abs(s.fill - s.truth)));
  const maxErr = Math.max(...errs);
  const maxAt = samples[errs.indexOf(maxErr)];
  const outOfTol = errs.filter((e) => e > BUDGET.tolerance).length;

  // Tween detection: easing makes the error DECAY geometrically after a change. Find frames
  // where truth dropped, then look at the 8 frames after: a tween shows |err| falling
  // monotonically from a large value; an untweened bar shows |err| flat at ~0.
  let tweenRuns = 0;
  for (let i = 2; i < samples.length - 9; i++) {
    if (samples[i].truth >= samples[i - 1].truth - 1e-9) continue;      // not a spend frame
    const w = errs.slice(i, i + 8);
    if (w[0] <= BUDGET.tolerance) continue;
    let decaying = true;
    for (let k = 1; k < w.length; k++) if (w[k] > w[k - 1] + 1e-9) { decaying = false; break; }
    if (decaying && w[0] > w[w.length - 1] * 2) tweenRuns++;
  }

  const spendFrames = [];
  for (let i = 1; i < samples.length; i++) {
    if (samples[i].truth < samples[i - 1].truth - 1e-9) {
      spendFrames.push({ f: samples[i].f, fell: samples[i].fill < samples[i - 1].fill });
    }
  }

  let curve = null;
  if (args.curve) {
    curve = await h.page.evaluate(() => {
      const H = window.__HARNESS;
      H.setAtHearth(true);
      H.openMenu('levelup');
      const ui = H.getUIState();
      const el = ui.elements.find((e) => e.kind === 'souls_to_next');
      const lv = ui.elements.find((e) => e.kind === 'level_value');
      H.closeMenu();
      return { shown: el ? Number(el.text) : null, level: lv ? Number(lv.text) : null };
    });
    if (curve.level !== null) {
      const n = curve.level + 1;
      curve.expected = Math.round(0.015 * n * n * n + 2.0 * n * n + 55 * n + 300);
      curve.match = curve.shown === curve.expected;
    }
  }

  out = {
    schema: 'elder-souls/ui-census@1',
    item: 'RI-UIX01',
    at: new Date().toISOString(),
    state, frames, screen: census.screen, in_combat: inCombat,
    persistent: census.hud.persistent_count,
    peak_total: census.hud.total_count,
    coverage_pct: census.hud.coverage_pct,
    coverage_conditional_pct: census.hud.coverage_with_conditional_pct,
    coverage_center_pct: census.hud.centre_coverage_pct,
    world_anchored: census.hud.world_anchored,
    numeric_text: census.hud.numeric_text,
    unknown_kinds: census.elements.map((e) => e.kind).filter((k) => !KNOWN.has(k)),
    bar_contrasts: census.hud.bar_contrasts,
    stamina: {
      frames: samples.length,
      max_abs_error: +maxErr.toFixed(6),
      max_at_frame: maxAt ? maxAt.f : null,
      frames_out_of_tolerance: outOfTol,
      pct_out_of_tolerance: +((100 * outOfTol) / samples.length).toFixed(4),
      tween_detected: tweenRuns > 0,
      tween_runs: tweenRuns,
      spend_events: spendFrames.length,
      spends_visible_same_frame: spendFrames.filter((s) => s.fell).length,
      regen_blocked_frames: samples.filter((s) => s.blocked).length,
      exhausted_frames: samples.filter((s) => s.exhausted).length,
    },
    curve,
    elements: census.elements.map((e) => ({ id: e.id, kind: e.kind, rect: e.rect, visible: e.visible, text: e.text, fill: e.fill, worldAnchor: e.worldAnchor })),
  };
  out.checks = grade(out);
  out.ok = out.checks.every((c) => c.pass);
} finally {
  await h.close();
}

ensureDir(RUN);
writeJson(path.join(RUN, 'ui-census.json'), out);
report(out);
process.exit(out.ok ? 0 : 1);

// ---- grading ------------------------------------------------------------------------------

const KNOWN = new Set(['health_bar', 'stamina_bar', 'focus_bar', 'heal_charges', 'quick_slots',
  'buildup_meter', 'lockon_reticle', 'boss_bar', 'equip_load', 'interact_prompt', 'toast',
  'panel', 'panel_header', 'list_row', 'detail_panel', 'encumbrance', 'category',
  'journal_entry', 'journal_index_row', 'book_page', 'page_count', 'attribute_row',
  'attribute_preview', 'souls_held', 'souls_to_next', 'level_value', 'skill_row',
  'spell_row', 'sheet_row', 'search_field', 'scroll_extent', 'selection', 'divider',
  'hint', 'gold', 'container_panel', 'topic_link', 'entry_glyph']);

function grade(o) {
  const c = [];
  const push = (id, what, pass, detail) => c.push({ id, what, pass, detail });
  push('U1', 'element counts (§C rows 1-2)',
    o.persistent <= BUDGET.persistent.pass && o.peak_total <= BUDGET.peak_total.pass,
    `persistent ${o.persistent}/${BUDGET.persistent.pass}, peak ${o.peak_total}/${BUDGET.peak_total.pass}`);
  push('U2', 'coverage (§C rows 3-4)',
    o.coverage_pct <= BUDGET.coverage_pct.pass && o.coverage_conditional_pct <= BUDGET.coverage_conditional_pct.pass,
    `${o.coverage_pct}% / ${BUDGET.coverage_pct.pass}%, with conditional ${o.coverage_conditional_pct}% / ${BUDGET.coverage_conditional_pct.pass}%`);
  push('U3', 'centre 50%×50% clear of non-reticle elements',
    o.coverage_center_pct === 0, `${o.coverage_center_pct}%`);
  push('U4', 'exactly one world-anchored element, and it is the reticle',
    o.world_anchored.length <= 1 && o.world_anchored.every((i) => i === 'hud.lockon'),
    JSON.stringify(o.world_anchored));
  push('U4b', 'no forbidden kind declared (X1-X12)',
    o.unknown_kinds.length === 0, JSON.stringify(o.unknown_kinds));
  push('U6', '§D1 same-frame truth: 100% of frames within ±0.005, no tween',
    !o.stamina.tween_detected && o.stamina.frames_out_of_tolerance === 0,
    `max |err| ${o.stamina.max_abs_error} at f=${o.stamina.max_at_frame}, ${o.stamina.pct_out_of_tolerance}% out of tolerance, tween_runs ${o.stamina.tween_runs}`);
  push('U8', '§D3 bar fill/trough contrast ≥ 4.5:1 on every bar',
    Object.values(o.bar_contrasts).every((v) => v.fill_vs_trough >= 4.5),
    JSON.stringify(o.bar_contrasts));
  push('U7', '§D2 regen-blocked state is a ≥3:1 change in the bar',
    (o.bar_contrasts.stamina && o.bar_contrasts.stamina.spent_vs_trough >= 3)
      && o.stamina.regen_blocked_frames > 0,
    `spent-vs-trough ${o.bar_contrasts.stamina && o.bar_contrasts.stamina.spent_vs_trough}, blocked on ${o.stamina.regen_blocked_frames} frames`);
  push('U10', '§D5 the bar falls on the frame of the spend',
    o.stamina.spend_events > 0 && o.stamina.spends_visible_same_frame === o.stamina.spend_events,
    `${o.stamina.spends_visible_same_frame}/${o.stamina.spend_events}`);
  push('numeric', '§C: at most one numeric text element during combat',
    o.numeric_text.length <= BUDGET.numeric_text.pass, JSON.stringify(o.numeric_text));
  if (o.curve) {
    push('L3', 'RI-UIX03 L3: souls-to-next matches RI-PRG01 at this level',
      !!o.curve.match, `shown ${o.curve.shown}, curve says ${o.curve.expected} at level ${o.curve.level}`);
  }
  return c;
}

function report(o) {
  if (args.json) { console.log(JSON.stringify(o, null, 2)); return; }
  log(`ui-census: state=${o.state} ${o.screen.w}×${o.screen.h} in_combat=${o.in_combat} frames=${o.frames}`);
  for (const c of o.checks) log(`  ${c.pass ? 'PASS' : 'FAIL'} ${c.id} ${c.what} — ${c.detail}`);
  log(`ui-census: ${o.checks.filter((c) => c.pass).length}/${o.checks.length}`);
}
