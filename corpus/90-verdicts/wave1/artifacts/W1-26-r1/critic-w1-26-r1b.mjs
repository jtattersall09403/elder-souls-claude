#!/usr/bin/env node
// critic-w1-26-r1b.mjs — is the W1-26 rendered-text accessor structurally blind to a third
// text surface? The W1-07 round-3 critic found the equivalent hole; this re-tests it at HEAD.
//
// Written by the W1-26 round-1 critic. Declared under `method_deviations`.
//
// THE CLAIM UNDER TEST. `render/renderer.js` line ~90 carries the comment "Every 2D surface
// this renderer owns is registered against the one rendered-text register", and
// `reports/journeys/w1-26-opening.json` records
//   m9.surfaces_searched: "title (the only non-dialogue drawn surface in the build)".
// The renderer constructs THREE 2D surfaces: `this.ui` (UILayer, 'dialogue'), `this.menus`
// (UISurface, W1-21's HUD and menus) and `this.title` (TitleLayer, 'title'). Two are
// instrumented.
//
// FOUR TESTS, in increasing severity:
//   A  Which contexts carry the register's INSTRUMENTED marker.
//   B  Instrument `this.menus.ctx` at runtime through the register's own public `instrument()`
//      and see whether ANY string appears. If the hole were only "nobody called instrument()",
//      this closes it.
//   C  A direct falsification: draw a known string into the freshly instrumented menus context
//      through the SAME path the UI uses (`ui/glyphs.js drawText`), and through `fillText`, and
//      compare. This separates "not instrumented" from "cannot be instrumented".
//   D  Enumerate what the menus surface actually draws during the opening, from
//      `UISurface.elements[].text` — i.e. the strings M9 is a grep over and cannot see.
//
// USAGE  node tools/harness/critic-w1-26-r1b.mjs [--json <path>]
import { parseArgs, wantsHelp, usage, writeJson } from '../lib/cli.mjs';
import { launchGame } from '../lib/browser.mjs';

const USAGE = `critic-w1-26-r1b.mjs — the rendered-text accessor's blind spot, tested four ways.`;
const args = parseArgs();
if (wantsHelp(args)) usage(USAGE);
const say = (s) => process.stdout.write(s + '\n');

const h = await launchGame(args);
const out = { probe: 'critic-w1-26-r1b' };
try {
  await h.h('setSeed', 1337);
  await h.h('loadState', 'barge-hold');
  await h.h('censusBegin', { race: 'saxhleel' });
  await h.h('renderFrame');

  const r = await h.page.evaluate(async () => {
    const H = window.__HARNESS;
    const eng = window.__ENGINE || null;
    const res = {};
    // Reach the renderer. The harness does not expose it directly, so go through the module
    // graph the same way the renderer does.
    const mod = await import('/game/src/render/text-register.js');
    const reg = mod.textRegister;
    const glyphs = await import('/game/src/ui/glyphs.js');
    const renderer = eng && eng.renderer;
    res.renderer_reachable = !!renderer;

    // --- A: which contexts are instrumented?
    const marker = Object.getOwnPropertySymbols(Object.create(null));
    const isInstr = (ctx) => !!(ctx && ctx.__esTextState);
    const surfaces = renderer ? {
      dialogue: isInstr(renderer.ui && renderer.ui.ctx),
      menus: isInstr(renderer.menus && renderer.menus.ctx),
      title: isInstr(renderer.title && renderer.title.ctx),
    } : null;
    res.instrumented = surfaces;
    res.surfaces_owned = renderer ? ['ui(dialogue)', 'menus', 'title'] : null;

    // --- D (first, before we perturb anything): what does the menus surface draw?
    const els = (renderer && renderer.menus && renderer.menus.elements) || [];
    res.menus_elements_total = els.length;
    res.menus_strings = [...new Set(els.map((e) => e && e.text).filter((t) => t && String(t).trim()))];

    // --- B: instrument the menus context through the register's own public entry point.
    if (renderer && renderer.menus) {
      reg.instrument(renderer.menus.ctx, 'menus');
      reg.clear();
      // Force a full UI rebuild + paint of the menus surface.
      if (renderer.uiBuild) renderer.uiBuild(true);
      H.renderFrame();
      const after = reg.all({ surface: 'menus' });
      res.menus_register_entries_after_instrumenting = after.length;
      res.menus_register_distinct = [...new Set(after.map((e) => e.text))];
    }

    // --- C: the falsification. Draw a known string two ways into the instrumented context.
    if (renderer && renderer.menus) {
      const ctx = renderer.menus.ctx;
      reg.clear();
      const SENTINEL_GLYPH = 'CRITIC-SENTINEL-GLYPHS';
      const SENTINEL_FILL = 'CRITIC-SENTINEL-FILLTEXT';
      glyphs.drawText(ctx, SENTINEL_GLYPH, 20, 40, glyphs.faceOf('ink'), 14, '#fff', {});
      const afterGlyph = reg.all({ surface: 'menus' }).map((e) => e.text);
      ctx.save(); ctx.fillStyle = '#fff'; ctx.font = '14px sans-serif';
      ctx.fillText(SENTINEL_FILL, 20, 60); ctx.restore();
      const afterFill = reg.all({ surface: 'menus' }).map((e) => e.text);
      res.falsification = {
        drawn_via_glyphs_drawText: SENTINEL_GLYPH,
        register_saw_glyphs: afterGlyph.indexOf(SENTINEL_GLYPH) >= 0,
        register_rows_after_glyphs: afterGlyph.length,
        drawn_via_fillText: SENTINEL_FILL,
        register_saw_filltext: afterFill.indexOf(SENTINEL_FILL) >= 0,
        register_rows_after_filltext: afterFill.length,
      };
    }

    // --- the harness's own advertised surface list, for the record.
    res.harness_report = H.getRenderedText({});
    res.dom_inner_text_len = (document.body.innerText || '').length;
    return res;
  });
  Object.assign(out, r);

  say('== A: 2D surfaces the renderer owns vs instrumented ==');
  say('  ' + JSON.stringify(out.instrumented));
  say('  harness advertises surfaces_instrumented = ' + JSON.stringify(out.harness_report && out.harness_report.surfaces_instrumented));
  say('\n== B: menus surface instrumented at runtime through the register\'s own instrument() ==');
  say(`  register entries on the menus surface after instrumenting + a forced repaint: ${out.menus_register_entries_after_instrumenting}`);
  say('\n== C: falsification — the same context, two draw paths ==');
  say('  ' + JSON.stringify(out.falsification, null, 2));
  say('\n== D: strings the menus surface actually draws in the opening (UISurface.elements[].text) ==');
  say(`  ${out.menus_elements_total} elements, ${(out.menus_strings || []).length} distinct strings:`);
  for (const s of (out.menus_strings || [])) say(`    "${s}"`);
} finally {
  if (args.json) writeJson(String(args.json), out);
  await h.close();
}
