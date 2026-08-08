#!/usr/bin/env node
// critic-w1-20-wraptest.mjs — the W1-20 critic's FOURTH instrument: is the toast wrap repair real?
//
// RUN: node tools/quests/critic-w1-20-wraptest.mjs [--entry <tree>/game/index.html] [--label X] [--out F]
// Exit 0 = every refusal fits the parchment and both yardsticks agree. Exit 1 = an overflow, a
// disagreement between the two yardsticks, or a FAIL-OPEN (meta.widest_px absent).
//
// The round reported that its own on-glass check was an INERT CONTROL: the fit was computed in
// ui/hud.js against the same `maxW` the wrapper uses, so breaking the wrapper moved the yardstick
// and the check stayed green on a line running 823 px across a 400 px panel. It says the fit is
// now derived in ui/system.js from the element RECT instead.
//
// I do not take that on the round's word. This tool is written from scratch, does not import the
// round's probe, and its ONLY claim is: here is the toast fit report, and here is whether an
// independent re-measurement of the drawn rows agrees with it.
//
// THE INDEPENDENT YARDSTICK. `fits` as shipped compares `meta.widest_px` (computed in hud.js)
// against `rect[2]`. Both of those still come out of the build I am testing. So this tool ALSO
// re-measures every drawn row with the canvas's own measureText, through the text register's
// record of the actual draw calls, and compares that against the parchment rectangle that
// `panel()` was called with. Two numbers from two places; if they disagree the shipped `fits` is
// not measuring what it says.
//
// Usage: node wraptest-critic-w1-20.mjs --entry <worktree>/game/index.html --out <file> [--label X]
// Exit 0 = every line fits and both yardsticks agree. Exit 1 = a line overflows, or they disagree.

import path from 'node:path';
import { launchGame } from '../lib/browser.mjs';
import { parseArgs, writeJson } from '../lib/cli.mjs';

const args = parseArgs(process.argv.slice(2));
const LABEL = args.label ? String(args.label) : 'unlabelled';
const OUT = args.out ? String(args.out) : null;

const FACTIONS = ['the_rootkeepers', 'the_drowned_court', 'the_dockhands', 'the_ixtu_vakh',
  'the_wet_ledger', 'the_imperial_assize', 'the_xul_aneekh'];

const game = await launchGame(args, { usage: 'wraptest' });
const { page } = game;

const report = await page.evaluate(async ({ FACTIONS }) => {
  const H = window.__HARNESS;
  H.reset({ state: 'default' });
  H.setRenderRate(0);
  H.setCharacter({ race: 'saxhleel', upbringing: 'interior', class: 'root-speaker', birthsign: 'raj-xul' });

  const norm = (t) => String(t).replace(/\s+/g, ' ').replace(/…/g, '').trim();

  // THE INDEPENDENT YARDSTICK.
  //
  // render/text-register.js records, for every string handed to a 2D context, the x it was drawn
  // at and the advance width `w` the RENDERER measured at the moment of the call — not a number
  // hud.js chose to publish. So the drawn extent of a row is [x, x + w], and the parchment is
  // [rect[0], rect[0] + rect[2]]. Containment of the former in the latter is a geometric fact
  // about the frame that was painted. Nothing in the wrapper can move it: setting `maxW` to
  // 99999 makes the row genuinely wider and the register records it genuinely wider.
  //
  // This is the test the round's second instrument could not do, because it compared a number
  // hud.js computed against a budget hud.js also computed.

  const lines = [];
  for (const f of FACTIONS) {
    H.uiToast(null);
    H.renderedTextClear();
    const r = H.factionRefusal(f, 1);
    H.renderFrame();
    const reg = H.getRenderedText();
    const entries = (reg && reg.entries) || (Array.isArray(reg) ? reg : []);
    const ui = H.getUIState() || {};
    const t = ui.toast || null;
    const said = (r && r.said) || null;

    // Which recorded draw calls are parts of this sentence.
    const mine = entries.filter((e) => e && e.text && String(e.text).length > 3 && norm(said || '').includes(norm(e.text)));
    const joined = norm(mine.map((e) => e.text).join(' '));

    // Geometry from the register: the painted extent of every row of this sentence.
    // hud.js draws each row CENTRED on the panel (`r[0] + r[2]/2 - measure(row)/2`), so a row is
    // inside the parchment iff its advance width is <= the parchment width. The advance width
    // here is the register's, recorded by the renderer at the draw call.
    let independentWidest = 0, worstLeft = null, worstRight = null;
    const rows = mine.map((e) => {
      independentWidest = Math.max(independentWidest, e.w || 0);
      const x0 = e.x, x1 = e.x + (e.w || 0);
      if (worstLeft === null || x0 < worstLeft) worstLeft = x0;
      if (worstRight === null || x1 > worstRight) worstRight = x1;
      return { text: e.text, x: e.x, w: e.w, x0, x1, px: e.px, clipped: e.clipped, surface: e.surface };
    });

    lines.push({
      faction: f,
      said,
      said_len: said ? said.length : 0,
      drawn_rows: mine.map((e) => e.text),
      drawn_row_count: mine.length,
      joined_equals_said: !!said && joined === norm(said),
      shipped_fit: t,
      register_rows: rows,
      independent_widest_px: +independentWidest.toFixed(1),
      painted_extent: worstLeft === null ? null : [+worstLeft.toFixed(1), +worstRight.toFixed(1)],
    });
  }

  // A second, harsher case: a string far longer than any refusal, pushed straight down the same
  // channel. If the wrap is real this must come back truncated with an ellipsis and still fit.
  H.uiToast(null); H.renderedTextClear();
  const LONG = 'The tally has you at nought and the ledger wants ten and the bay keeps sending them in on the tide whether or not anybody has paid the fee for the burning of them, which is the same for all of you and always has been.';
  H.uiToast(LONG);
  H.renderFrame();
  const longUi = (H.getUIState() || {}).toast || null;

  return { lines, long_case: { text: LONG, len: LONG.length, toast: longUi } };
}, { FACTIONS });

await game.close();

// ---- verdict, computed HERE and not in the page.
const problems = [];
for (const l of report.lines) {
  const fit = l.shipped_fit;
  if (!fit) { problems.push(`${l.faction}: no toast element at all — the refusal was never drawn`); continue; }
  if (!l.joined_equals_said) problems.push(`${l.faction}: the drawn rows do not join back to the sentence`);
  if (fit.fits !== true) problems.push(`${l.faction}: OVERFLOW — widest ${fit.widest_px}px across a ${fit.panel_w}px panel (${fit.overflow_px}px off the paper)`);
  if (fit.truncated === true) problems.push(`${l.faction}: truncated with an ellipsis — words missing from the glass`);
  // THE DISAGREEMENT TEST. Does the shipped widest_px match an independent re-measure?
  if (fit.widest_px == null) {
    problems.push(`${l.faction}: FAIL-OPEN — meta.widest_px is absent, so \`fits\` was computed as 0 <= panel_w and is meaningless`);
  } else if (Math.abs(fit.widest_px - l.independent_widest_px) > 2) {
    problems.push(`${l.faction}: YARDSTICKS DISAGREE — hud.js says ${fit.widest_px}px, an independent canvas re-measure of the same drawn rows says ${l.independent_widest_px}px`);
  }
  if (l.independent_widest_px > (fit.panel_w || 0) + 0.5) {
    problems.push(`${l.faction}: INDEPENDENT OVERFLOW — re-measured ${l.independent_widest_px}px across a ${fit.panel_w}px panel`);
  }
}
const lt = report.long_case.toast;
if (!lt) problems.push('long case: no toast element');
else {
  if (lt.fits !== true) problems.push(`long case: OVERFLOW — ${lt.widest_px}px across ${lt.panel_w}px`);
  if (lt.truncated !== true) problems.push(`long case: a ${report.long_case.len}-char string was NOT truncated — the 3-line ceiling did not engage`);
}

const out = {
  label: LABEL,
  entry: args.entry || 'default',
  lines_checked: report.lines.length,
  lines_that_fit: report.lines.filter((l) => l.shipped_fit && l.shipped_fit.fits === true).length,
  problems,
  verdict: problems.length === 0 ? 'GREEN' : 'RED',
  detail: report,
};
if (OUT) writeJson(OUT, out);
console.log(`[${LABEL}] ${out.verdict} — ${out.lines_that_fit}/${out.lines_checked} fit`);
for (const p of problems) console.log(`   ! ${p}`);
if (lt) console.log(`   long case: rows=${lt.row_count} widest=${lt.widest_px} panel=${lt.panel_w} truncated=${lt.truncated} fits=${lt.fits}`);
for (const l of report.lines) {
  const f = l.shipped_fit || {};
  console.log(`   ${l.faction}: rows=${f.row_count} widest=${f.widest_px} indep=${l.independent_widest_px} panel=${f.panel_w} fits=${f.fits}`);
}
process.exit(problems.length ? 1 : 0);
