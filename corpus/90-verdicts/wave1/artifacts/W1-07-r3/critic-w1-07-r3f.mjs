#!/usr/bin/env node
// critic-w1-07-r3f.mjs — how big is the hole in the rendered-text accessor?
//
// r3e established two facts:
//   * `render/renderer.js` owns three 2D text surfaces (`ui`, `title`, `menus`) and the
//     register instruments two (`dialogue`, `title`);
//   * instrumenting `menus` as well yields ZERO strings — because `game/src/ui/glyphs.js`
//     `drawText()` renders every glyph as a STROKED PATH (`moveTo`/`lineTo`/`quadraticCurveTo`/
//     `stroke`) and never calls `fillText`. The register wraps `fillText`/`strokeText`, so it is
//     structurally incapable of seeing W1-21's entire UI system, instrumented or not.
//
// This probe measures what that hole contains. `UISurface.el()` declares every element with its
// `text`, so `renderer.menus.elements` IS an enumerable set of the strings on that surface — the
// build has the data and `getRenderedText()` does not read it. Everything below comes out of
// that array, on the same frames the census is drawn on.
import fs from 'node:fs';
import path from 'node:path';
import { launchGame } from '../lib/browser.mjs';
import { parseArgs } from '../lib/cli.mjs';

const args = parseArgs();
const OUT = path.resolve('corpus/90-verdicts/wave1/artifacts/W1-07-r3');
const say = (s) => process.stdout.write(s + '\n');
const rec = { generated_by: 'tools/harness/critic-w1-07-r3f.mjs', frames: [], m9_hits: [], m15_hits: [] };

const BAD = ['Press ', 'Tap ', 'Click ', 'Tutorial', 'Objective', 'Quest added', 'New quest', 'Tip:'];
// RI-LOR01's prophecy vocabulary, the M15 grep.
const PROPHECY = ['prophecy', 'prophesied', 'chosen', 'destined', 'destiny', 'foretold', 'the one',
  'nerevarine', 'incarnate', 'saviour', 'savior', 'fate of the world'];

const h = await launchGame({ ...args, width: Number(args.width || 640), height: Number(args.height || 360) });
try {
  await h.h('setSeed', 1337);
  const readMenus = () => h.page.evaluate(() => {
    const r = window.__ENGINE.renderer;
    return {
      ui_visible: r.uiVisible,
      drawn: !!(r.menus && r.menus.drawn),
      elements: (r.menus ? r.menus.elements : []).map((e) => ({ id: e.id, kind: e.kind, text: e.text == null ? null : String(e.text) })),
    };
  });

  const grab = async (label) => {
    await h.h('renderFrame');
    const m = await readMenus();
    const texts = m.elements.map((e) => e.text).filter((t) => t && t.trim());
    const acc = await h.h('getRenderedText', { notSurface: ['dialogue'] });
    rec.frames.push({ label, ui_visible: m.ui_visible, menus_drawn: m.drawn, menus_elements: m.elements.length,
      menus_strings: [...new Set(texts)], accessor_non_dialogue: acc.distinct });
    say(`${label.padEnd(26)} uiVisible=${m.ui_visible} menus_elements=${m.elements.length} ` +
        `menus_strings=${new Set(texts).size}  accessor_non_dialogue=${acc.distinct.length}`);
    for (const t of [...new Set(texts)].slice(0, 40)) say(`      menus: "${t}"`);
    return texts;
  };

  await h.h('loadState', 'barge-hold');
  const t1 = await grab('barge-hold, no census');
  await h.h('censusBegin', { race: 'saxhleel' });
  const t2 = await grab('census open (hold.wake)');
  await h.h('stepFrames', 60);
  const t3 = await grab('after 60 frames');
  await h.h('loadState', 'writ-house');
  await h.h('stepFrames', 30);
  const t4 = await grab('writ-house');

  const all = [...new Set([...t1, ...t2, ...t3, ...t4])];
  rec.all_menus_strings = all;
  rec.m9_hits = all.filter((s) => BAD.some((b) => s.includes(b)));
  rec.m15_hits = all.filter((s) => PROPHECY.some((p) => s.toLowerCase().includes(p)));
  const accAll = new Set(rec.frames.flatMap((f) => f.accessor_non_dialogue));
  rec.invisible_to_accessor = all.filter((s) => !accAll.has(s));

  say(`\n== SUMMARY ==`);
  say(`  distinct strings on the menus surface over the opening : ${all.length}`);
  say(`  of those, reported by getRenderedText()                : ${all.length - rec.invisible_to_accessor.length}`);
  say(`  INVISIBLE to the accessor M9/M15 are gated on          : ${rec.invisible_to_accessor.length}`);
  for (const s of rec.invisible_to_accessor) say(`      "${s}"`);
  say(`  M9  grep over the invisible set: ${rec.m9_hits.length} hits ${JSON.stringify(rec.m9_hits)}`);
  say(`  M15 grep over the invisible set: ${rec.m15_hits.length} hits ${JSON.stringify(rec.m15_hits)}`);
} finally {
  fs.writeFileSync(path.join(OUT, 'accessor-hole-critic.json'), JSON.stringify(rec, null, 2));
  await h.close();
}
