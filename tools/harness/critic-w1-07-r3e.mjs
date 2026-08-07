#!/usr/bin/env node
// critic-w1-07-r3e.mjs — is the rendered-text accessor M9/M15 are now gated on ACTUALLY
// enumerating the frame's text?
//
// `RI-JRN01` §0.1(a) as amended refuses to score M9 and M15 at all unless the build names an
// accessor and demonstrates it non-empty. `render/text-register.js` is that accessor and it is
// honestly built — fed by `fillText`, clip-aware, not by a model. But `render/renderer.js`
// owns THREE 2D text surfaces and registers TWO:
//
//     this.ui    = new UILayer(...)      -> instrumented as 'dialogue'
//     this.title = new TitleLayer(...)   -> instrumented as 'title'
//     this.menus = new UISurface(...)    -> the HUD and every menu screen. NOT INSTRUMENTED.
//
// The comment directly above those two calls reads "Every 2D surface this renderer owns is
// registered against the one rendered-text register". M9 greps *"every string rendered OUTSIDE
// a dialogue/journal/book surface"* — which is precisely `menus`. So the grep M9 requires is
// run over a set that excludes the only surface it is aimed at.
//
// THE CONTROL. Claiming that is not measuring it. This probe instruments the third surface at
// runtime, through the register's own public `instrument()`, renders the same frames again, and
// reports the strings that appear only in the second reading. If the set is empty the accessor
// is complete and this finding is withdrawn. If it is not, every string in it is text that the
// player can read and that M9's grep has never seen.
import fs from 'node:fs';
import path from 'node:path';
import { launchGame } from '../lib/browser.mjs';
import { parseArgs } from '../lib/cli.mjs';

const args = parseArgs();
const OUT = path.resolve('corpus/90-verdicts/wave1/artifacts/W1-07-r3');
const say = (s) => process.stdout.write(s + '\n');
const rec = { generated_by: 'tools/harness/critic-w1-07-r3e.mjs', surfaces: null, before: null, after: null, only_after: [], m9_hits_after: [] };

const h = await launchGame({ ...args, width: Number(args.width || 640), height: Number(args.height || 360) });
try {
  await h.h('setSeed', 1337);
  rec.surfaces = await h.page.evaluate(() => {
    const r = window.__ENGINE.renderer;
    const has2d = (o) => !!(o && o.ctx && typeof o.ctx.fillText === 'function');
    return {
      renderer_2d_surfaces: ['ui', 'title', 'menus'].filter((k) => has2d(r[k])),
      instrumented: window.__HARNESS.getRenderedText({}).surfaces_instrumented,
    };
  });
  say(`2D text surfaces the renderer owns : ${rec.surfaces.renderer_2d_surfaces.join(', ')}`);
  say(`surfaces the register instruments  : ${rec.surfaces.instrumented.join(', ')}`);

  // ---- BEFORE: what the shipped accessor reports over the opening -------------------------
  await h.h('loadState', 'barge-hold');
  await h.h('censusBegin', { race: 'saxhleel' });
  await h.h('renderedTextClear');
  await h.h('renderFrame');
  const before = await h.h('getRenderedText', {});
  const beforeND = await h.h('getRenderedText', { notSurface: ['dialogue'] });
  rec.before = { all: before.distinct, non_dialogue: beforeND.distinct };
  say(`\nBEFORE — accessor reports ${before.distinct.length} distinct strings on this frame, ` +
      `${beforeND.distinct.length} of them outside the dialogue surface (M9's domain):`);
  for (const s of beforeND.distinct) say(`   "${s}"`);

  // ---- THE CONTROL: register the third surface and re-read the same frame -----------------
  const ok = await h.page.evaluate(() => {
    const r = window.__ENGINE.renderer;
    if (!r.menus || !r.menus.ctx) return { ok: false, why: 'no menus surface' };
    r.textRegister.instrument(r.menus.ctx, 'menus');
    return { ok: true };
  });
  say(`\ninstrumented renderer.menus as surface 'menus': ${JSON.stringify(ok)}`);
  await h.h('renderedTextClear');
  // Force the HUD to redraw: the menus surface is repainted every frame the HUD is up.
  await h.h('stepFrames', 2);
  await h.h('renderFrame');
  const after = await h.h('getRenderedText', {});
  const afterND = await h.h('getRenderedText', { notSurface: ['dialogue'] });
  rec.after = { all: after.distinct, non_dialogue: afterND.distinct };
  const beforeSet = new Set(before.distinct);
  rec.only_after = after.distinct.filter((s) => !beforeSet.has(s));
  say(`\nAFTER — accessor reports ${after.distinct.length} distinct strings on the same scene.`);
  say(`STRINGS VISIBLE ONLY ONCE THE THIRD SURFACE IS REGISTERED (${rec.only_after.length}):`);
  for (const s of rec.only_after) say(`   "${s}"`);
  const entries = (after.entries || []).filter((e) => e.surface === 'menus');
  rec.menus_entries = entries.map((e) => ({ text: e.text, clipped: !!e.clipped }));
  say(`\nentries tagged surface='menus': ${entries.length}`);

  const BAD = ['Press ', 'Tap ', 'Click ', 'Tutorial', 'Objective', 'Quest added', 'New quest', 'Tip:'];
  rec.m9_hits_after = afterND.distinct.filter((s) => BAD.some((b) => s.includes(b)));
  say(`M9 grep over the WIDER non-dialogue set (${afterND.distinct.length} strings): ${rec.m9_hits_after.length} hits ${JSON.stringify(rec.m9_hits_after)}`);

  // ---- and the same question for the menu SCREENS, which is where instruction text lives ---
  const screens = [];
  for (const id of ['inventory', 'progress', 'journal', 'map', 'book']) {
    try {
      await h.h('uiOpen', id);
      await h.h('renderedTextClear');
      await h.h('renderFrame');
      const g = await h.h('getRenderedText', {});
      const menus = (g.entries || []).filter((e) => e.surface === 'menus').map((e) => e.text);
      screens.push({ screen: id, distinct_total: g.distinct.length, on_menus_surface: menus.length, sample: [...new Set(menus)].slice(0, 25) });
      say(`  uiOpen('${id}') -> ${menus.length} strings on the menus surface; sample ${JSON.stringify([...new Set(menus)].slice(0, 8))}`);
      await h.h('uiClose');
    } catch (e) { screens.push({ screen: id, error: String(e).slice(0, 120) }); }
  }
  rec.screens = screens;
} finally {
  fs.writeFileSync(path.join(OUT, 'accessor-coverage-critic.json'), JSON.stringify(rec, null, 2));
  await h.close();
}
