#!/usr/bin/env node
// dialogue-window-probe.mjs — RI-UIX08's dialogue window, in the running game. ONE browser.
//
// Owner: W1-UIX08. Rule 21: one browser, kept for the whole run.
//
// EVERY CHECK HAS A NULL CONTROL, AND THE CONTROL IS THE PLAUSIBLE WRONG ANSWER RATHER THAN THE
// TRIVIAL ONE. HAZARDS §0b: "a guard that only detects deviation in the direction you expected
// fails on half the number line." The trivial control here is "no window at all"; the plausible
// one — the arm this probe actually runs — is **a correct-looking window whose topic links are
// plain text**. It passes every layout check, every colour check and every element census in this
// file, and it deletes the discovery mechanism the item exists for. It is reachable at runtime as
// `__ENGINE.ui.dialogueArm.links = false`, and it is also RI-UIX08 §G's required ablated arm.
//
// The second arm is the delete-the-fix (RULES rule 6): `DIALOGUE_WINDOW = false` in `engine.js`
// restores the old bottom-anchored reply menu. That one is run by `--delete-the-fix`, which
// asserts the window DISAPPEARS — a teardown that changes nothing is a second copy of the
// experiment, not a control.
//
// WHAT IT CHECKS, mapped to the item:
//   A  §A   the six elements, present, and NO SEVENTH
//   B  §B1  the column is a fixed count of layout units, right-anchored; the prose absorbs 100%
//           of the extra width. Measured across two viewports of the SAME HEIGHT and different
//           widths, which is the only comparison in which "fixed" and "percentage" differ.
//   C  §C   colour, sampled from OUR OWN RENDERED FRAME, as ΔE against the openmw.cfg constants
//   D  §D1  following a link appends the answer AND puts the word in the column — the mechanism,
//           in the running world, with the topic state read back out of the simulation
//   E  §E1  translucency: the same scene with and without the panel, confirming a BLEND not a FILL
//   F  §D2  two sections, actions above a rule
//   G  §A5  disposition is a number out of 100 and never a word
//   H  directive §2: hardware-shaped capture at desktop AND phone, with the two frames PROVEN
//      different rather than assumed — a recent agent's "phone" pass was byte-for-byte its
//      desktop canvas and it caught that by looking at the artefact, not by a check going red.
//
// EXIT 0 = every check passed · 1 = a check failed · 2 = could not run.
'use strict';

import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';
import { launchGame } from '../lib/browser.mjs';
import { parseArgs, wantsHelp, usage, log, REPO_ROOT, ensureDir, writeJson } from '../lib/cli.mjs';

const USAGE = `
dialogue-window-probe.mjs — the RI-UIX08 dialogue window in the running game.

  --state <id>        world state to load (default: helstrom-market)
  --delete-the-fix    assert the window is GONE (run against a tree with DIALOGUE_WINDOW=false)
  --no-shots          skip the screenshot pack
  --out <dir>         report directory (default reports/uix08)

EXIT 0 = every check passes · 1 = a check failed · 2 = could not run.
`;

const args = parseArgs();
if (wantsHelp(args)) usage(USAGE);
const OUT = path.join(REPO_ROOT, String(args.out || 'reports/uix08'));
const SHOTS = path.join(REPO_ROOT, 'docs/shots');
ensureDir(OUT); ensureDir(SHOTS);
const STATE = String(args.state || 'helstrom-market');
const DELETE_THE_FIX = !!args['delete-the-fix'];
const WANT_SHOTS = !args['no-shots'];

const checks = [];
const push = (id, pass, detail) => { checks.push({ id, pass, detail }); log(`  ${pass ? 'ok  ' : 'FAIL'} ${id}  ${detail}`); };

// ---- §C, the five families, quoted from REF-A12/config/openmw.cfg lines 71–115 ---------------
const TARGET = {
  prose: [202, 165, 96],        // FontColor_color_normal
  heading: [223, 201, 159],     // FontColor_color_header
  link: [112, 126, 207],        // FontColor_color_link
  column: [202, 165, 96],       // the column is `normal` bronze — NOT the owner capture's green
  disposition: [53, 69, 159],   // FontColor_color_magic
};

/** CIE76 ΔE over sRGB→Lab. Enough for "is this the right family", which is what §C asks. */
function deltaE(a, b) {
  const L = (c) => {
    const f = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
    const [r, g, bl] = [f(c[0]), f(c[1]), f(c[2])];
    let X = (r * 0.4124 + g * 0.3576 + bl * 0.1805) / 0.95047;
    let Y = (r * 0.2126 + g * 0.7152 + bl * 0.0722);
    let Z = (r * 0.0193 + g * 0.1192 + bl * 0.9505) / 1.08883;
    const k = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
    [X, Y, Z] = [k(X), k(Y), k(Z)];
    return [116 * Y - 16, 500 * (X - Y), 200 * (Y - Z)];
  };
  const [l1, a1, b1] = L(a), [l2, a2, b2] = L(b);
  return Math.sqrt((l1 - l2) ** 2 + (a1 - a2) ** 2 + (b1 - b2) ** 2);
}

/**
 * The GLYPH CORE colour of a rect: the brightest-chroma pixels, not the mean.
 *
 * A mean over a text rect is mostly background and would report every family as "near black",
 * which is how a colour check passes on a build that draws in the wrong ink. `RI-UIX08` §C's own
 * measured figures are glyph-core figures for exactly this reason. Sampling the top decile by
 * distance from the panel ground gives the ink rather than the paper.
 */
function glyphCore(png, rect) {
  const [x, y, w, h] = rect.map((v) => Math.round(v));
  const px = [];
  for (let j = Math.max(0, y); j < Math.min(png.height, y + h); j++) {
    for (let i = Math.max(0, x); i < Math.min(png.width, x + w); i++) {
      const o = (j * png.width + i) * 4;
      if (png.data[o + 3] < 8) continue;
      const c = [png.data[o], png.data[o + 1], png.data[o + 2]];
      px.push({ c, lum: 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2] });
    }
  }
  if (!px.length) return null;
  px.sort((a, b) => b.lum - a.lum);
  const take = px.slice(0, Math.max(1, Math.floor(px.length * 0.10)));
  const m = [0, 0, 0];
  for (const p of take) { m[0] += p.c[0]; m[1] += p.c[1]; m[2] += p.c[2]; }
  return m.map((v) => Math.round(v / take.length));
}

function readPNG(buf) { return PNG.sync.read(buf); }

const report = {
  schema: 'elder-souls/uix08-window-probe@1',
  at: new Date().toISOString(),
  commit: (process.env.GIT_COMMIT || '').slice(0, 12) || null,
  state: STATE, arm: DELETE_THE_FIX ? 'delete-the-fix' : 'ours',
  data: {}, checks: [],
};

const h = await launchGame({ width: 1920, height: 1080, timeout: 300000 });
const shots = [];

/**
 * Resize, and DO NOT ASSUME THE DRAWING BUFFER FOLLOWED.
 *
 * `page.setViewportSize()` moves the CSS viewport; the canvas follows only when the page's own
 * resize path runs. A recent agent's "phone" pass was byte-for-byte its desktop canvas for
 * exactly this reason and it was caught by looking at the artefact rather than by a check going
 * red. This waits for the buffer to actually change and returns what it became, so a caller can
 * assert on it instead of hoping.
 */
async function setViewport(w, hh, dpr) {
  await h.page.setViewportSize({ width: w, height: hh });
  await h.h('setDevicePixelRatio', dpr || 1);
  await h.page.evaluate(() => window.dispatchEvent(new Event('resize')));
  await h.page.waitForTimeout(120);
  await h.h('stepFrames', 3);
  await h.page.evaluate(() => { if (window.__ENGINE.renderer.uiBuild) window.__ENGINE.renderer.uiBuild(true); });
  return h.page.evaluate(() => {
    const c = window.__ENGINE.renderer.menus;
    return [c.canvas.width, c.canvas.height];
  });
}

/** Read the window's own published layout plus the declared element list. */
async function readWindow() {
  return h.page.evaluate(() => {
    const s = window.__HARNESS.getUIState();
    const els = (s.elements || []).filter((e) => e.visible && e.id.startsWith('dialogue.'));
    return {
      window: s.dialogue_window || null,
      elements: els.map((e) => ({ id: e.id, kind: e.kind, rect: e.rect.slice(), text: e.text, focused: e.focused, meta: e.meta || null })),
      legacy_open: !!s.open,
      legacy_options: s.option_count === undefined ? null : s.option_count,
      topics_known: window.__HARNESS.questTopicsKnown ? window.__HARNESS.questTopicsKnown().length : null,
    };
  });
}

/** Open a conversation with the first person in the room who has something to say. */
async function openConversation() {
  return h.page.evaluate(() => {
    const A = window.__HARNESS;
    try { A.closeMenu(); } catch { /* */ }
    const people = A.listNPCs();
    let best = null;
    for (const n of people) {
      const st = A.talkTo(n.eid);
      if (st && st.topics && st.topics.length > (best ? best.topics : -1)) best = { eid: n.eid, topics: st.topics.length };
    }
    if (best) A.talkTo(best.eid);
    return best;
  });
}

let exit = 0;
try {
  await h.h('setRenderRate', 60);
  await h.h('setDevicePixelRatio', 1);
  await h.h('loadState', STATE);
  await h.h('stepFrames', 4);

  const who = await openConversation();
  if (!who) {
    log(`no NPC in '${STATE}' has anything to say — nothing to measure, and that is not a pass`);
    process.exit(2);
  }
  await h.h('stepFrames', 2);
  report.data.speaker = who;

  let W = await readWindow();

  // ---- the delete-the-fix arm ---------------------------------------------------------------
  if (DELETE_THE_FIX) {
    push('X1 window absent', W.window === null && W.elements.length === 0,
      `dialogue_window=${W.window === null ? 'null' : 'present'} elements=${W.elements.length}`);
    push('X2 old reply menu is back', W.legacy_open && W.legacy_options > 0,
      `legacy open=${W.legacy_open} options=${W.legacy_options}`);
    report.checks = checks;
    writeJson(path.join(OUT, 'window-probe-deletethefix.json'), report);
    process.exit(checks.every((c) => c.pass) ? 0 : 1);
  }

  if (!W.window) {
    log('the dialogue window did not draw. Nothing below can be measured.');
    process.exit(2);
  }

  // ---- A. §A the six elements, and no seventh ------------------------------------------------
  //
  // Each declared element carries `meta.element` — which of §A's six it belongs to — so a
  // seventh cannot hide by being unmapped: an element with no `element` number FAILS the check.
  const byElement = new Map();
  const unmapped = [];
  for (const e of W.elements) {
    const n = e.meta && e.meta.element;
    if (!n) { unmapped.push(e.id); continue; }
    byElement.set(n, (byElement.get(n) || 0) + 1);
  }
  const missing = [1, 2, 3, 4, 5, 6].filter((n) => !byElement.get(n));
  push('A1 six elements present', missing.length === 0, `present=${[...byElement.keys()].sort().join(',')} missing=${missing.join(',') || 'none'}`);
  push('A2 no seventh element', unmapped.length === 0, unmapped.length ? `unmapped: ${unmapped.join(', ')}` : '0 unmapped elements');
  const title = W.elements.find((e) => e.kind === 'panel_header');
  push('A3 speaker name centred in the title strip', !!(title && title.text && title.meta && title.meta.centred),
    title ? `"${title.text}"` : 'no title element');
  const bye = W.elements.find((e) => e.kind === 'dialogue_exit');
  const col = W.elements.filter((e) => e.kind === 'list_row');
  push('A4 Goodbye is the full width of the column',
    !!(bye && col.length && Math.abs(bye.rect[2] - col[0].rect[2]) < 1.5),
    bye ? `goodbye w=${bye.rect[2].toFixed(1)} column w=${col.length ? col[0].rect[2].toFixed(1) : 'n/a'}` : 'absent');
  push('A5 panel floats over the world, not fullscreen',
    W.window.panel_width_frac < 0.96 && W.window.panel_height_frac < 0.92,
    `${(W.window.panel_width_frac * 100).toFixed(1)}% × ${(W.window.panel_height_frac * 100).toFixed(1)}% of frame`);

  // ---- G. §A5/§D4 disposition is a NUMBER out of 100 -----------------------------------------
  const dispo = W.elements.find((e) => e.kind === 'disposition_meter');
  push('G1 disposition reads N/100 and is never a word',
    !!(dispo && /^\d{1,3}\/100$/.test(String(dispo.text))),
    dispo ? `"${dispo.text}"` : 'absent');

  // ---- F. §D2 two sections, actions above a rule ---------------------------------------------
  const rule = W.elements.find((e) => e.kind === 'divider' && e.meta && e.meta.separates);
  const actionRows = W.elements.filter((e) => e.meta && e.meta.section === 'actions');
  const topicRows = W.elements.filter((e) => e.meta && e.meta.section === 'topics');
  const actionsAbove = actionRows.length && topicRows.length && rule
    && Math.max(...actionRows.map((e) => e.rect[1])) < rule.rect[1]
    && Math.min(...topicRows.map((e) => e.rect[1])) > rule.rect[1];
  push('F1 actions above a rule, topics below', !!actionsAbove,
    `${actionRows.length} action(s), rule at y=${rule ? rule.rect[1].toFixed(0) : 'none'}, ${topicRows.length} topic(s)`);
  // Alphabetical below the rule (§D2). A build that mixed the two would fail F1; one that
  // shuffled the topics would pass F1 and fail here.
  const labels = topicRows.sort((a, b) => a.rect[1] - b.rect[1]).map((e) => String(e.text).toLowerCase());
  push('F2 topics alphabetical below the rule',
    labels.every((v, i) => i === 0 || labels[i - 1] <= v), `${labels.length} rows`);

  // ---- B. §B1 THE ANCHOR RULE, and it is the reason an owner screenshot was worth acquiring ---
  //
  // Two viewports of the SAME HEIGHT and different widths. A fixed, right-anchored column does not
  // move one pixel; a column specified as a percentage grows with the panel. The check is the
  // FRACTION OF THE EXTRA WIDTH THAT REACHED THE PROSE, which is 1.0 for a fixed column and
  // roughly (1 - column_fraction) for a percentage one — so it separates the two builds on a
  // number rather than on an assertion about the source.
  const anchor = [];
  for (const w of [1920, 2560]) {
    const canvas = await setViewport(w, 1080, 1);
    const r = await readWindow();
    anchor.push({ viewport: [w, 1080], canvas, column_px: r.window.column_px, prose_px: r.window.prose_px, panel_px: r.window.panel_px[0], column_frac: r.window.column_frac_of_panel });
  }
  push('B0 the drawing buffer followed the viewport',
    anchor[0].canvas[0] !== anchor[1].canvas[0],
    `canvas ${anchor[0].canvas.join('x')} -> ${anchor[1].canvas.join('x')}`);
  const dPanel = anchor[1].panel_px - anchor[0].panel_px;
  const dProse = anchor[1].prose_px - anchor[0].prose_px;
  const dCol = Math.abs(anchor[1].column_px - anchor[0].column_px);
  const absorbed = dPanel > 1 ? dProse / dPanel : null;
  report.data.anchor = { ...{ arms: anchor }, panel_delta_px: +dPanel.toFixed(2), prose_delta_px: +dProse.toFixed(2), column_delta_px: +dCol.toFixed(2), prose_absorbed_frac: absorbed == null ? null : +absorbed.toFixed(4) };
  push('B1 column fixed in layout units', dCol < 0.51, `column moved ${dCol.toFixed(2)} px across a ${dPanel.toFixed(0)} px panel widening`);
  push('B2 the prose absorbs the extra width', absorbed !== null && absorbed > 0.97,
    absorbed === null ? 'panel did not widen' : `${(absorbed * 100).toFixed(1)}% of the extra width went to the prose`);
  // The null control, computed rather than asserted: what this check WOULD have read on a
  // percentage-column build. If that number is not comfortably below the bar the check is not
  // discriminating and the pass above means nothing.
  const pctArm = 1 - anchor[0].column_frac;
  push('B3 the check separates fixed from percentage', pctArm < 0.90,
    `a percentage column of the same nominal width would absorb only ${(pctArm * 100).toFixed(1)}%`);
  await setViewport(1920, 1080, 1);

  // ---- D. §D1 THE MECHANISM, IN THE RUNNING WORLD --------------------------------------------
  //
  // A GREETING IS NOT A PAGE OF PROSE. The first run of this probe reported "0 links drawn in 1
  // line" and was right: the transcript at that moment held one short greeting, and a matcher
  // cannot light a word that nobody has said yet. So ask something first — through the COLUMN,
  // which is the route a player has before any word is lit — and then look for links in what
  // comes back. Asking through the column is also the honest order: the column is how a
  // conversation starts, and the inline links are how it continues.
  await h.page.evaluate(() => {
    const A = window.__HARNESS, eng = window.__ENGINE;
    const m = A.getUIState().dialogue_window;
    if (!m) return null;
    // Ask up to six column topics, stopping as soon as an answer lights a link.
    for (const t of m.topics.slice(0, 6)) {
      eng._convPending = t;
      A.stepFrames(2);
      const now = A.getUIState().dialogue_window;
      if (now && now.links_drawn > 0) break;
    }
    return null;
  });
  await h.h('stepFrames', 2);
  //
  // Follow an inline link and require three things at once: the answer is APPENDED (the pane is
  // not cleared), the word is IN THE COLUMN afterwards, and the simulation actually learned the
  // topic. The third is the CONSUMPTION half (RULES rule 5): a window that lights a word and
  // changes nothing in the world is a picture of a mechanism.
  W = await readWindow();
  const before = {
    links: W.window.links_drawn,
    topics: W.window.topics.slice(),
    lines: W.window.lines_total,
    known: W.topics_known,
  };
  const followed = await h.page.evaluate(() => {
    const A = window.__HARNESS, eng = window.__ENGINE;
    const m = A.getUIState().dialogue_window;
    if (!m || !m.link_topics.length) return null;
    // Walk the caret to the first link and confirm it, through the UI's own step — not by
    // calling `conversationSay` behind the window's back, which would prove the ENGINE works and
    // say nothing about the window.
    eng.ui.dialogueFocus.pane = 'prose';
    eng.ui.dialogueFocus.linkIdx = 0;
    const topic = m.link_topics[0];
    eng._convPending = topic;
    A.stepFrames(2);
    return topic;
  });
  if (!followed) {
    push('D1 an inline link exists to follow', false, `0 links drawn in ${before.lines} lines of prose`);
  } else {
    await h.h('stepFrames', 2);
    const after = await readWindow();
    push('D1 an inline link exists to follow', before.links > 0, `${before.links} link element(s) drawn`);
    push('D2 following a link APPENDS (the pane is not cleared)',
      after.window.lines_total > before.lines,
      `${before.lines} -> ${after.window.lines_total} lines`);
    push('D3 the followed word is now in the column',
      after.window.topics.includes(followed) || before.topics.includes(followed),
      `topic '${followed}' ${after.window.topics.includes(followed) ? 'present' : 'ABSENT'} in a column of ${after.window.topics.length}`);
    push('D4 CONSUMPTION: the simulation learned the topic',
      after.topics_known !== null && before.known !== null && after.topics_known >= before.known,
      `quest.topicsKnown ${before.known} -> ${after.topics_known}`);
    report.data.followed = { topic: followed, before, after: { lines: after.window.lines_total, topics: after.window.topics.length, known: after.topics_known } };
  }

  // ---- THE PLAUSIBLE NULL CONTROL: the same window with links as plain text -------------------
  //
  // Every check above except D still passes on this arm. That is the point of it.
  await h.page.evaluate(() => { window.__ENGINE.ui.dialogueArm.links = false; window.__ENGINE.ui.builtFrame = -1; });
  await h.h('stepFrames', 2);
  const ablated = await readWindow();
  await h.page.evaluate(() => { window.__ENGINE.ui.dialogueArm.links = true; window.__ENGINE.ui.builtFrame = -1; });
  await h.h('stepFrames', 2);
  const restored = await readWindow();
  push('N1 the ablated arm draws the same window',
    !!ablated.window && ablated.window.column_px === restored.window.column_px && ablated.window.panel_px[0] === restored.window.panel_px[0],
    `panel ${ablated.window ? ablated.window.panel_px.join('×') : 'absent'}, column ${ablated.window ? ablated.window.column_px : '-'} px — identical geometry`);
  push('N2 the ablated arm has NO inline links',
    !!ablated.window && ablated.window.links_drawn === 0 && ablated.elements.every((e) => e.kind !== 'topic_link'),
    `${ablated.window ? ablated.window.links_drawn : '?'} links drawn (ours: ${restored.window.links_drawn})`);
  push('N3 the ablated arm puts those topics in the column instead',
    !!ablated.window && ablated.window.topics.length >= restored.window.topics.length,
    `column ${restored.window.topics.length} -> ${ablated.window ? ablated.window.topics.length : '?'} rows`);
  report.data.ablated = ablated.window
    ? { links_drawn: ablated.window.links_drawn, topics: ablated.window.topics.length, panel_px: ablated.window.panel_px }
    : null;

  // ---- E. §E1 TRANSLUCENCY: a blend, not a fill -----------------------------------------------
  //
  // The same scene with and without the panel. If the interior is a fill, the two frames differ
  // by exactly the panel colour everywhere inside it and the region's variance collapses to zero;
  // if it is a blend, the world's own structure survives through it and the two frames CORRELATE
  // inside the panel. Correlation is the discriminating statistic and a mean is not.
  // `__HARNESS.screenshot()` is `canvas.toDataURL()` — the composited frame, world and interface
  // in one image, and the SAME instrument every visual verdict in this project uses.
  // `page.screenshot()` waits on font loading and times out against this page.
  const shotOpen = Buffer.from(String(await h.h('screenshot')).split(',')[1], 'base64');
  await h.page.evaluate(() => window.__HARNESS.conversationClose());
  await h.h('stepFrames', 3);
  const shotShut = Buffer.from(String(await h.h('screenshot')).split(',')[1], 'base64');
  await h.page.evaluate((eid) => window.__HARNESS.talkTo(eid), who.eid);
  await h.h('stepFrames', 3);
  // THE OPAQUE ARM, RENDERED. Same window, same world, interior alpha 1 — the frame a build that
  // filled its panel would produce. The identical statistic runs on it below, so "an opaque fill
  // scores ~0" is a measurement rather than an assertion about arithmetic.
  await h.page.evaluate(() => { window.__ENGINE.ui.dialogueArm.opaque = true; window.__ENGINE.ui.builtFrame = -1; });
  await h.h('stepFrames', 2);
  const shotOpaque = Buffer.from(String(await h.h('screenshot')).split(',')[1], 'base64');
  await h.page.evaluate(() => { window.__ENGINE.ui.dialogueArm.opaque = false; window.__ENGINE.ui.builtFrame = -1; });
  await h.h('stepFrames', 2);
  {
    const A = readPNG(shotOpen), B = readPNG(shotShut), O = readPNG(shotOpaque);
    const win = restored.window;
    const r = [
      Math.round((A.width - win.panel_px[0]) / 2 + win.panel_px[0] * 0.10),
      Math.round((A.height - win.panel_px[1]) / 2 + win.panel_px[1] * 0.35),
      Math.round(win.panel_px[0] * 0.35), Math.round(win.panel_px[1] * 0.30),
    ];
    // GLYPHS ARE DRAWN AT FULL ALPHA AND THEY ARE NOT THE PANEL. The first run of this check read
    // a correlation of 0.215 over a rect that was a third ink: the text is opaque by design
    // (§C's ink families are solid), so including it measures the type, not the translucency.
    // Bronze and blue ink are both far brighter than the near-black ground, so excluding the
    // bright pixels of the OPEN frame leaves the panel's own interior — which is the surface the
    // item's claim is about.
    const xs = [], ys = [];
    let inked = 0;
    for (let j2 = r[1]; j2 < r[1] + r[3]; j2 += 2) {
      for (let i2 = r[0]; i2 < r[0] + r[2]; i2 += 2) {
        const o = (j2 * A.width + i2) * 4;
        const lx = 0.2126 * A.data[o] + 0.7152 * A.data[o + 1] + 0.0722 * A.data[o + 2];
        if (lx > 55) { inked++; continue; }                       // a glyph, not the ground
        xs.push(lx);
        ys.push(0.2126 * B.data[o] + 0.7152 * B.data[o + 1] + 0.0722 * B.data[o + 2]);
      }
    }
    const mean = (a) => a.reduce((s2, v) => s2 + v, 0) / a.length;
    const mx = mean(xs), my = mean(ys);
    let sxy = 0, sxx = 0, syy = 0;
    for (let i2 = 0; i2 < xs.length; i2++) { sxy += (xs[i2] - mx) * (ys[i2] - my); sxx += (xs[i2] - mx) ** 2; syy += (ys[i2] - my) ** 2; }
    const rho = sxx > 0 && syy > 0 ? sxy / Math.sqrt(sxx * syy) : 0;
    const sd = Math.sqrt(sxx / xs.length);
    // THE COMPUTED NULL CONTROL, and it is what makes the number above mean anything. Replace the
    // interior with its own mean — the frame an OPAQUE panel would have produced over the same
    // world — and re-run the identical statistic. If that arm does not collapse, the check
    // cannot tell a blend from a fill and its pass is worth nothing (RULES rule 6's inert
    // control, HAZARDS §0b's half of the number line).
    const os = [], oys = [];
    let k = 0;
    for (let j2 = r[1]; j2 < r[1] + r[3]; j2 += 2) {
      for (let i2 = r[0]; i2 < r[0] + r[2]; i2 += 2) {
        const o = (j2 * A.width + i2) * 4;
        const lx = 0.2126 * A.data[o] + 0.7152 * A.data[o + 1] + 0.0722 * A.data[o + 2];
        if (lx > 55) continue;
        os.push(0.2126 * O.data[o] + 0.7152 * O.data[o + 1] + 0.0722 * O.data[o + 2]);
        oys.push(ys[k]); k++;
      }
    }
    const mo = mean(os);
    let oxy = 0, oxx = 0, oyy = 0;
    for (let i2 = 0; i2 < os.length; i2++) { oxy += (os[i2] - mo) * (oys[i2] - my); oxx += (os[i2] - mo) ** 2; oyy += (oys[i2] - my) ** 2; }
    const rhoOpaque = oxx > 0 && oyy > 0 ? oxy / Math.sqrt(oxx * oyy) : 0;
    const sdOpaque = Math.sqrt(oxx / Math.max(1, os.length));
    report.data.translucency = { rect: r, corr_with_world: +rho.toFixed(4), corr_opaque_control: +rhoOpaque.toFixed(4), sd_opaque_control: +sdOpaque.toFixed(3), panel_sd: +sd.toFixed(3), glyph_pixels_excluded: inked, declared_alpha: win.interior_alpha, samples: xs.length };
    push('E1 the panel interior is a BLEND, not a fill', rho > 0.35 && sd > 1.0,
      `correlation with the world behind it ${rho.toFixed(3)}, interior sd ${sd.toFixed(2)}, ${inked} glyph px excluded`);
    push('E1b the RENDERED opaque control collapses', Math.abs(rhoOpaque) < 0.35 && sdOpaque < sd,
      `the same window drawn opaque over the same world scores rho ${rhoOpaque.toFixed(3)}, sd ${sdOpaque.toFixed(2)} (ours: ${rho.toFixed(3)}, ${sd.toFixed(2)})`);
    push('E2 the declared alpha is OpenMW\'s documented default', Math.abs(win.interior_alpha - 0.84) < 0.05,
      `interior_alpha=${win.interior_alpha} against 0.84 ± 0.05`);
  }

  // ---- C. §C colour, sampled from OUR OWN RENDERED FRAME ---------------------------------------
  //
  // Sampled from the frame, never from the source constants: "a source constant that is correct
  // and a render that is not is the defect RI-UIX06 F17–F19 exist to catch."
  {
    const A = readPNG(shotOpen);
    const el = (pred) => restored.elements.find(pred);
    const linkEl = el((e) => e.kind === 'topic_link');
    const rowEl = el((e) => e.meta && e.meta.section === 'topics');
    const dispEl = el((e) => e.kind === 'disposition_meter');
    const histEl = el((e) => e.kind === 'book_page');
    const samples = {
      link: linkEl ? glyphCore(A, linkEl.rect) : null,
      column: rowEl ? glyphCore(A, rowEl.rect) : null,
      // The disposition FILL, not its numeral: sample the left third of the bar, which is filled
      // at any disposition above ~35 and carries no glyph.
      disposition: dispEl ? meanOf(A, [dispEl.rect[0] + 2, dispEl.rect[1] + 2, dispEl.rect[2] * 0.18, dispEl.rect[3] - 4]) : null,
      // The prose body and its headings both live inside the history element; the heading is the
      // brightest ink on the page and the body is the modal one, so they are separated by taking
      // the top and the median of the same distribution rather than by two rects we chose.
      ...proseAndHeading(A, histEl ? histEl.rect : null),
    };
    const dE = {};
    for (const k of Object.keys(TARGET)) dE[k] = samples[k] ? +deltaE(samples[k], TARGET[k]).toFixed(2) : null;
    report.data.colour = { samples, target: TARGET, deltaE: dE };
    const worst = Math.max(...Object.values(dE).filter((v) => v != null));
    const gaps = Object.entries(dE).filter(([, v]) => v == null).map(([k]) => k);
    push('C1 every colour family sampled', gaps.length === 0, gaps.length ? `not sampled: ${gaps.join(', ')}` : '5 of 5');
    push('C2 colour ΔE against openmw.cfg', worst <= 8, Object.entries(dE).map(([k, v]) => `${k} ${v}`).join('  '));
    // The column is BRONZE, and this is the check that would have caught us copying the owner
    // capture's green. It fails in the direction nobody expected to have to guard.
    const green = samples.column && samples.column[1] > samples.column[0] + 20 && samples.column[1] > samples.column[2] + 20;
    push('C3 the column is not the owner capture\'s green', !green,
      samples.column ? `column rgb(${samples.column.join(',')})` : 'not sampled');
  }

  // ---- H. directive §2: capture desktop AND phone, and PROVE they differ ------------------------
  if (WANT_SHOTS) {
    const VIEWPORTS = [
      { tag: 'desktop-1920x1080', w: 1920, h: 1080, dpr: 1 },
      { tag: 'desktop-2560x1080', w: 2560, h: 1080, dpr: 1 },
      { tag: 'laptop-1280x720', w: 1280, h: 720, dpr: 1 },
      { tag: 'phone-landscape-844x390', w: 844, h: 390, dpr: 2 },
      { tag: 'phone-portrait-390x844', w: 390, h: 844, dpr: 2 },
    ];
    const seen = new Map();
    const geo = [];
    for (const v of VIEWPORTS) {
      await setViewport(v.w, v.h, v.dpr);
      for (const arm of ['links', 'plain']) {
        await h.page.evaluate((on) => { window.__ENGINE.ui.dialogueArm.links = on; window.__ENGINE.ui.builtFrame = -1; }, arm === 'links');
        await h.h('stepFrames', 2);
        const r = await readWindow();
        const buf = Buffer.from(String(await h.h('screenshot')).split(',')[1], 'base64');
        const name = `2026-08-14-uix08-dialogue-${v.tag}-${arm}.png`;
        fs.writeFileSync(path.join(SHOTS, name), buf);
        shots.push(name);
        const key = buf.length + ':' + buf.subarray(0, 4096).toString('base64');
        const dup = seen.get(key);
        if (dup) log(`  !! ${name} is byte-identical to ${dup}`);
        seen.set(key, name);
        if (arm === 'links' && r.window) {
          geo.push({
            viewport: [v.w, v.h], dpr: v.dpr, canvas: r.window.frame_px,
            panel_px: r.window.panel_px, column_px: r.window.column_px, prose_px: r.window.prose_px,
            body_px: r.window.body_px, chars_per_line: r.window.chars_per_line,
            links_drawn: r.window.links_drawn, column_frac: r.window.column_frac_of_panel,
          });
        }
      }
    }
    await h.page.evaluate(() => { window.__ENGINE.ui.dialogueArm.links = true; });
    report.data.viewports = geo;
    report.data.shots = shots;
    // THE CHECK THAT A RECENT AGENT'S PHONE PASS NEEDED AND DID NOT HAVE. `setViewportSize`
    // without `setDevicePixelRatio` reaching the canvas leaves the drawing buffer at the desktop
    // size, and the "phone" capture is then byte-for-byte the desktop one. Assert the CANVAS
    // moved, not the CSS viewport.
    const canvases = new Set(geo.map((g) => g.canvas.join('x')));
    push('H1 the viewports actually differ', canvases.size === geo.length,
      `${canvases.size} distinct drawing buffers over ${geo.length} viewports: ${[...canvases].join(', ')}`);
    push('H2 no two captures are byte-identical', seen.size === shots.length,
      `${seen.size} distinct images over ${shots.length} captures`);
    // F2 in the item is reversible on exactly this evidence: does the fixed column starve the
    // prose on the narrowest supported viewport? Reported as a number rather than an opinion.
    const worstMeasure = Math.min(...geo.map((g) => g.chars_per_line));
    push('H3 the prose measure holds on every viewport', worstMeasure >= 45,
      `narrowest measure ${worstMeasure} chars/line (RI-UIX05 band 45–75)`);
  }

  report.checks = checks;
  report.data.window = (await readWindow()).window;
  writeJson(path.join(OUT, 'window-probe.json'), report);
  exit = checks.every((c) => c.pass) ? 0 : 1;
  log(`\n${checks.filter((c) => c.pass).length}/${checks.length} checks passed · ${shots.length} screenshot(s)`);
} finally {
  await h.close();
}
process.exit(exit);

/** Mean colour of a rect — used only where there are no glyphs (the disposition fill). */
function meanOf(png, rect) {
  const [x, y, w, hh] = rect.map((v) => Math.round(v));
  let n = 0; const m = [0, 0, 0];
  for (let j = Math.max(0, y); j < Math.min(png.height, y + hh); j++) {
    for (let i = Math.max(0, x); i < Math.min(png.width, x + w); i++) {
      const o = (j * png.width + i) * 4;
      m[0] += png.data[o]; m[1] += png.data[o + 1]; m[2] += png.data[o + 2]; n++;
    }
  }
  return n ? m.map((v) => Math.round(v / n)) : null;
}

/**
 * Separate the body ink from the heading ink inside the history pane without choosing two rects.
 * Both are bronze; the heading is the lighter of the two families (#DFC99F vs #CAA560), so the
 * brightest 2% of ink pixels is the heading and the 60th percentile is the body.
 */
function proseAndHeading(png, rect) {
  if (!rect) return { prose: null, heading: null };
  const [x, y, w, hh] = rect.map((v) => Math.round(v));
  const px = [];
  for (let j = Math.max(0, y); j < Math.min(png.height, y + hh); j++) {
    for (let i = Math.max(0, x); i < Math.min(png.width, x + w); i++) {
      const o = (j * png.width + i) * 4;
      const c = [png.data[o], png.data[o + 1], png.data[o + 2]];
      const lum = 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
      // ink only: the ground is near-black and the links are blue (B > R)
      if (lum < 60 || c[2] > c[0]) continue;
      px.push({ c, lum });
    }
  }
  if (px.length < 40) return { prose: null, heading: null };
  px.sort((a, b) => b.lum - a.lum);
  const avg = (arr) => { const m = [0, 0, 0]; for (const p of arr) { m[0] += p.c[0]; m[1] += p.c[1]; m[2] += p.c[2]; } return m.map((v) => Math.round(v / arr.length)); };
  const top = px.slice(0, Math.max(4, Math.floor(px.length * 0.02)));
  const mid = px.slice(Math.floor(px.length * 0.10), Math.floor(px.length * 0.25));
  return { heading: avg(top), prose: avg(mid.length ? mid : top) };
}
