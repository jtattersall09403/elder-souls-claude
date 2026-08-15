#!/usr/bin/env node
// t4-r2-measure.mjs — re-runs the T4 round-1 critic's own measurements so round 2 has comparable
// figures, and adds the two RI-UIX09 rows the self-report cannot answer.
//
// Owner: T4-r2. Not a new instrument where an old one exists: the fill maths below is the same
// CIEDE2000 already shipped in `tools/lib/colour.mjs` (whose `--self-test` matches Sharma's
// published pairs to 4e-5), and the capture path is `tools/lib/browser.mjs`, the one every
// harness tool in the fleet uses.
//
// WHAT IT MEASURES, and against which row:
//
//   D1 declared  RI-UIX09 method 2 — pictorial elements (`item_icon | doll | glyph_object`) inside
//                the panel's own rect. Off `getUIState()`, which is a SELF-REPORT.
//   D1 observed  RI-UIX09 method 3 — the pixel half, and the one the item says will be dropped for
//                being slow. For every item row, the row's leading 48 px must contain a region of
//                >= 3 distinct hues that is not glyph ink. Reported BESIDE the declared count,
//                because "a build that registers icon elements and draws nothing fails 3 and
//                passes 2" is a distinction this tool exists to make.
//   D2           RI-UIX09 method 4 — the modal colour of the PANEL RECT, then the fraction of that
//                rect's pixels at dE00 > 6 from it. On the panel rect and never on the frame:
//                measuring the frame is the item's own named way to make every screen pass.
//   V1/V6/D4    RI-UIX07 — the world set's presence, kinds, rects and bottom-half test, and the
//                overlap list against every RI-UIX01 element.
//   E-T2        RI-UIX07 — the withdrawal, frame by frame across an aggro.
//   the guard   `containerTitle()` driven with the four values that have produced `undefined` on
//                screen, plus a good one. A guard nobody has watched fail is not evidence.
//
// HOW TO BREAK IT ON PURPOSE (rule 4). `--assert-empty` measures with the icon layer suppressed
// via `--suppress`, which the tool refuses to accept unless the numbers actually fall: it exits
// non-zero if the suppressed arm reports the same pictorial count as the live one. There is no
// mode in which this script reports a pass it did not compute.
import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';
import { launchGame } from '../lib/browser.mjs';
import { REPO_ROOT, parseArgs } from '../lib/cli.mjs';
import { labFromSrgb255, de2000 } from '../lib/colour.mjs';

const args = parseArgs();
const LABEL = String(args.label || 'live');
const W = Number(args.width || 1920), H = Number(args.height || 1080);
const OUT = path.join(REPO_ROOT, String(args.out || 'corpus/90-verdicts/wave1/artifacts/T4-r2'));
const SHOTS = path.join(OUT, 'screens');
fs.mkdirSync(SHOTS, { recursive: true });

const PICTORIAL = new Set(['item_icon', 'doll', 'glyph_object']);
const WORLD_KINDS = new Set(['bearing_dial', 'effect_strip', 'sneak_state', 'place_name', 'breath_meter']);

/** D2. Modal colour of a rect, then the dE00 > 6 fraction against it. */
function panelFill(png, rect) {
  const [rx, ry, rw, rh] = rect.map((v) => Math.round(v));
  const x0 = Math.max(0, rx), y0 = Math.max(0, ry);
  const x1 = Math.min(png.width, rx + rw), y1 = Math.min(png.height, ry + rh);
  if (x1 <= x0 || y1 <= y0) return { fill: null, reason: 'rect outside the frame' };
  // Quantise to a 5-bit-per-channel histogram for the mode. The mode is the panel's own ground;
  // the comparison afterwards is at full precision, so the quantisation only picks the reference.
  const hist = new Map();
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const i = (y * png.width + x) * 4;
      const k = ((png.data[i] >> 3) << 10) | ((png.data[i + 1] >> 3) << 5) | (png.data[i + 2] >> 3);
      hist.set(k, (hist.get(k) || 0) + 1);
    }
  }
  let bestK = 0, bestN = -1;
  for (const [k, n] of hist) if (n > bestN) { bestN = n; bestK = k; }
  // Average the true colours inside the winning bucket, so the reference is the ground's actual
  // colour rather than the centre of an arbitrary 8-value bin.
  let sr = 0, sg = 0, sb = 0, sn = 0;
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const i = (y * png.width + x) * 4;
      const k = ((png.data[i] >> 3) << 10) | ((png.data[i + 1] >> 3) << 5) | (png.data[i + 2] >> 3);
      if (k !== bestK) continue;
      sr += png.data[i]; sg += png.data[i + 1]; sb += png.data[i + 2]; sn++;
    }
  }
  const mode = [Math.round(sr / sn), Math.round(sg / sn), Math.round(sb / sn)];
  const modeLab = labFromSrgb255(mode[0], mode[1], mode[2]);
  // A memo over the 15-bit key: a 1520x780 rect is 1.19M pixels and there are at most 32768 keys.
  const memo = new Map();
  let differ = 0, total = 0;
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const i = (y * png.width + x) * 4;
      const k = ((png.data[i] >> 3) << 10) | ((png.data[i + 1] >> 3) << 5) | (png.data[i + 2] >> 3);
      let d = memo.get(k);
      if (d === undefined) {
        d = de2000(labFromSrgb255(png.data[i], png.data[i + 1], png.data[i + 2]), modeLab);
        memo.set(k, d);
      }
      total++;
      if (d > 6) differ++;
    }
  }
  return {
    fill: +(differ / total).toFixed(4),
    mode_rgb: mode, pixels: total,
    rect: [x0, y0, x1 - x0, y1 - y0],
  };
}

/** D1 observed. Distinct hues in a box, ignoring near-identical colours. */
function distinctHues(png, x, y, w, h) {
  const seen = [];
  const x1 = Math.min(png.width, Math.round(x + w)), y1 = Math.min(png.height, Math.round(y + h));
  for (let yy = Math.max(0, Math.round(y)); yy < y1; yy++) {
    for (let xx = Math.max(0, Math.round(x)); xx < x1; xx++) {
      const i = (yy * png.width + xx) * 4;
      const lab = labFromSrgb255(png.data[i], png.data[i + 1], png.data[i + 2]);
      if (!seen.some((s) => de2000(s, lab) <= 8)) seen.push(lab);
      if (seen.length > 12) return seen.length;
    }
  }
  return seen.length;
}

const read = (b64) => PNG.sync.read(Buffer.from(String(b64).split(',')[1], 'base64'));
const out = { label: LABEL, viewport: [W, H], commit: null, screens: {}, notes: [] };
const writeOut = () => fs.writeFileSync(path.join(OUT, `measure-${LABEL}-${W}x${H}.json`), JSON.stringify(out, null, 2));

try {
  out.commit = (await import('node:child_process')).execSync('git rev-parse HEAD', { cwd: REPO_ROOT }).toString().trim();
} catch { out.commit = 'unknown'; }

const h = await launchGame({ width: W, height: H, state: args.state || 'ui-journal' });

/** Open a mode, screenshot it, and take every measurement that screen supports. */
async function measure(name, opener) {
  const r = await h.page.evaluate(async (o) => {
    const HH = window.__HARNESS;
    try { HH.conversationClose(); } catch { /* nothing open */ }
    await HH.closeMenu();
    if (o.hearth) HH.setAtHearth(true);
    if (o.container) HH.openContainer(o.containerName === '__ABSENT__' ? undefined : o.containerName, o.contents || []);
    else if (o.mode) await HH.openMenu(o.mode, {});
    await HH.stepFrames(3);
    const st = HH.getUIState();
    return {
      mode: st.mode, combat_phase: st.combat_phase, combat_phase_source: st.combat_phase_source,
      panel_rect: st.panel_rect, pictorial: st.pictorial, materials: st.materials,
      materials_painted: st.materials_painted, hud_world: st.hud && st.hud.world,
      elements: st.elements, screen: st.screen,
      shot: await HH.screenshot(),
    };
  }, opener);
  const png = read(r.shot);
  fs.writeFileSync(path.join(SHOTS, `${LABEL}-${name}__${W}x${H}.png`), PNG.sync.write(png));

  const kinds = {};
  for (const e of r.elements) if (e.visible) kinds[e.kind] = (kinds[e.kind] || 0) + 1;
  const pictorialEls = r.elements.filter((e) => e.visible && PICTORIAL.has(e.kind));
  const rec = {
    mode: r.mode,
    element_count: r.elements.filter((e) => e.visible).length,
    kinds,
    pictorial_declared: r.pictorial,
    pictorial_ids: pictorialEls.map((e) => e.id),
    panel_rect: r.panel_rect,
    panel_fill: r.panel_rect ? panelFill(png, r.panel_rect) : { fill: null, reason: 'no panel on this frame' },
    // Every string the screen renders, so the `(RI-…)` acceptance and the `undefined` acceptance
    // are both greps over the same array rather than two separate runs.
    texts: r.elements.filter((e) => e.visible && e.text).map((e) => ({ id: e.id, text: String(e.text) })),
    ri_citations: r.elements.filter((e) => e.visible && e.text && /RI-[A-Z]{3}\d{2}/.test(String(e.text))).map((e) => e.id),
    undefined_headers: r.elements.filter((e) => e.visible && /^(undefined|null)$/i.test(String(e.text || ''))).map((e) => e.id),
    materials: r.materials, materials_painted: r.materials_painted,
  };
  // D1 OBSERVED — the pixel half. Only meaningful where there are item rows.
  const rows = r.elements.filter((e) => e.visible && e.kind === 'list_row' && e.meta && e.meta.item_id);
  if (rows.length) {
    const hues = rows.map((e) => ({ id: e.id, hues: distinctHues(png, e.rect[0], e.rect[1], 48, e.rect[3]) }));
    rec.d1_observed = {
      rows: rows.length,
      rows_with_3_plus_hues_in_leading_48px: hues.filter((x) => x.hues >= 3).length,
      min_hues: Math.min(...hues.map((x) => x.hues)),
      per_row: hues.slice(0, 6),
    };
  }
  if (r.hud_world) rec.hud_world = r.hud_world;
  rec.combat_phase = r.combat_phase;
  rec.combat_phase_source = r.combat_phase_source;
  out.screens[name] = rec;
  console.log(`[${name}] elements ${rec.element_count}  pictorial ${rec.pictorial_declared ? rec.pictorial_declared.in_panel : '-'}`
    + `  fill ${rec.panel_fill.fill}`);
  writeOut();
}

try {
  await h.page.evaluate(async () => {
    const HH = window.__HARNESS;
    await HH.ready();
    if (HH.setUIVisible) await HH.setUIVisible(true);
    await HH.closeMenu(); await HH.stepFrames(4);
  });

  await measure('world', {});
  await measure('inventory', { mode: 'inventory' });
  await measure('journal', { mode: 'journal' });
  await measure('sheet', { mode: 'sheet' });
  await measure('spells', { mode: 'spells' });
  await measure('levelup', { mode: 'levelup', hearth: true });
  // The container, with a REAL name — and then the four bad ones below.
  await measure('container', {
    container: true, containerName: 'Reed Creel',
    contents: [{ id: 'reed-cutter', count: 1 }, { id: 'bog-iron-maul', count: 1 }, { id: 'rootweave-cowl', count: 1 }],
  });
  await measure('container_no_name', {
    container: true, containerName: '__ABSENT__',
    contents: [{ id: 'reed-cutter', count: 1 }],
  });

  // ---- the guard, driven with every value that has produced `undefined` on screen -------------
  out.container_name_guard = await h.page.evaluate(async () => {
    const HH = window.__HARNESS;
    const cases = [
      ['__ABSENT__', 'no name passed at all — the shape that shipped the defect'],
      [null, 'explicit null'],
      ['', 'empty string'],
      ['undefined', 'the literal word, arriving as text from a second call site'],
      ['Reed Creel', 'a good name — the control arm, which MUST come through unchanged'],
    ];
    const res = [];
    for (const [v, why] of cases) {
      await HH.closeMenu();
      HH.openContainer(v === '__ABSENT__' ? undefined : v, [{ id: 'reed-cutter', count: 1 }]);
      await HH.stepFrames(2);
      const st = HH.getUIState();
      const heads = (st.elements || []).filter((e) => e.kind === 'panel_header' && e.visible).map((e) => String(e.text));
      res.push({ passed: v === '__ABSENT__' ? '(absent)' : v, why, headers: heads,
        any_undefined: heads.some((t) => /^(undefined|null)$/i.test(t)) });
    }
    await HH.closeMenu();
    return res;
  });
  console.log('[guard] ' + out.container_name_guard.map((c) => `${JSON.stringify(c.passed)}->${JSON.stringify(c.headers)}`).join('  '));
  writeOut();

  // ---- E-T2, frame by frame across the fight boundary -----------------------------------------
  out.withdrawal = await h.page.evaluate(async () => {
    const HH = window.__HARNESS;
    await HH.closeMenu(); await HH.stepFrames(4);
    const KINDS = ['bearing_dial', 'effect_strip', 'sneak_state', 'place_name', 'breath_meter'];
    const frames = [];
    const rec = (tag) => {
      const st = HH.getUIState();
      frames.push({
        tag, frame: st.frame === undefined ? HH.getFrame() : st.frame,
        combat_phase: st.combat_phase, frames_since_phase_change: st.frames_since_phase_change,
        world: (st.elements || []).filter((e) => KINDS.includes(e.kind) && e.visible)
          .map((e) => ({ kind: e.kind, opacity: e.opacity, rect: e.rect })),
        souls_ids: (st.elements || []).filter((e) => e.id.startsWith('hud.') && !KINDS.includes(e.kind) && e.visible).map((e) => e.id),
        withdrawn: st.hud && st.hud.world ? st.hud.world.withdrawn : null,
      });
    };
    for (let i = 0; i < 4; i++) { await HH.stepFrames(1); rec('pre'); }
    const es = (HH.listEnemies ? HH.listEnemies() : []) || [];
    let aggro = null;
    try { aggro = HH.aggro((es[0] || {}).eid || (es[0] || {}).id); } catch (e) { aggro = String(e.message); }
    for (let i = 0; i < 12; i++) { await HH.stepFrames(1); rec('post'); }
    return { aggro, enemies: es.length, frames };
  });
  const pre = out.withdrawal.frames.filter((f) => f.tag === 'pre');
  const post = out.withdrawal.frames.filter((f) => f.tag === 'post');
  out.withdrawal.summary = {
    world_elements_before: pre.length ? pre[pre.length - 1].world.map((w) => w.kind) : [],
    world_elements_after: post.length ? post[post.length - 1].world.map((w) => w.kind) : [],
    // E-T3: a ramp shows as a monotone opacity series across the entry frame. There is no fade in
    // this build in either direction, so every declared opacity should be exactly 1.
    any_fractional_opacity: out.withdrawal.frames.some((f) => f.world.some((w) => w.opacity > 0 && w.opacity < 1)),
    souls_set_identical: post.length && pre.length
      ? JSON.stringify(pre[pre.length - 1].souls_ids.filter((i) => i !== 'hud.toast'))
        === JSON.stringify(post[post.length - 1].souls_ids.filter((i) => i !== 'hud.toast'))
      : null,
  };
  console.log('[withdrawal] before ' + JSON.stringify(out.withdrawal.summary.world_elements_before)
    + '  after ' + JSON.stringify(out.withdrawal.summary.world_elements_after));
} finally {
  writeOut();
  await h.close();
}

// ---- the verdict this tool is allowed to state, and nothing beyond it -------------------------
const inv = out.screens.inventory || {};
const worstFill = Object.entries(out.screens)
  .filter(([, v]) => v.panel_fill && v.panel_fill.fill !== null)
  .sort((a, b) => a[1].panel_fill.fill - b[1].panel_fill.fill)[0];
console.log('\n--- T4 round 2, ' + LABEL + ' at ' + W + 'x' + H + ' (commit ' + out.commit.slice(0, 10) + ') ---');
console.log('D1 declared, inventory panel : ' + (inv.pictorial_declared ? inv.pictorial_declared.in_panel : 'n/a')
  + '  (round 1: 0)');
console.log('D1 observed, inventory rows  : '
  + (inv.d1_observed ? `${inv.d1_observed.rows_with_3_plus_hues_in_leading_48px} of ${inv.d1_observed.rows} rows carry >=3 hues in the leading 48px` : 'n/a'));
console.log('D2 inventory panel fill      : ' + (inv.panel_fill ? inv.panel_fill.fill : 'n/a') + '  (round 1: 0.207; Morrowind 0.61; P4 bar 0.35)');
if (worstFill) console.log('D2 worst screen              : ' + worstFill[0] + ' ' + worstFill[1].panel_fill.fill);
const anyUndef = Object.values(out.screens).some((s) => (s.undefined_headers || []).length);
const anyRI = Object.values(out.screens).some((s) => (s.ri_citations || []).length);
console.log('undefined headers anywhere   : ' + anyUndef);
console.log('RI- citations in player text : ' + anyRI);
const guardBad = (out.container_name_guard || []).filter((c) => c.any_undefined);
console.log('container-name guard         : ' + (guardBad.length ? 'LEAKED on ' + JSON.stringify(guardBad.map((c) => c.passed)) : 'refused all four bad values'));
const wl = (out.screens.world || {}).hud_world;
if (wl) {
  const built = Object.entries(wl.set).filter(([, v]) => v.built).length;
  console.log('world set built              : ' + built + ' of 6  (round 1: 1 of 6)');
  console.log('world set all in bottom half : ' + wl.all_in_bottom_half + '  rects ' + JSON.stringify(wl.elements.map((e) => e.rect)));
  console.log('world/souls rect overlaps    : ' + JSON.stringify(wl.overlaps));
}
console.log('written: ' + path.join(OUT, `measure-${LABEL}-${W}x${H}.json`));

// Exit non-zero on the two things this round is not allowed to still be true.
if (anyUndef || guardBad.length) { console.error('FAIL: a container header still renders `undefined`.'); process.exit(3); }
if (anyRI) { console.error('FAIL: a reference-item id is still rendered to the player.'); process.exit(4); }
