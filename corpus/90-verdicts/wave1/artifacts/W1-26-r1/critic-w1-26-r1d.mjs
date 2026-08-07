#!/usr/bin/env node
// critic-w1-26-r1d.mjs — AR-2, RI-JRN01 M11 (marker sweep) and M9's instruction budget run over
// the surface the build's own accessor cannot see.
//
// Written by the W1-26 round-1 critic. Declared under `method_deviations`.
//
// M9's domain is "every string rendered OUTSIDE a dialogue/journal/book surface". The build's
// accessor (`__HARNESS.getRenderedText()`) covers `dialogue` and `title` and is structurally
// blind to `menus` — W1-21's HUD, which draws through `ui/glyphs.js drawText()` as stroked
// vector paths and never calls fillText. That is exactly M9's domain. This probe enumerates the
// menus surface directly, through `UISurface.elements[].text`, at four moments of the opening,
// and applies M9's own grep list plus RI-UIX04's FORBIDDEN_KINDS for M11/AR-2.
//
// USAGE  node tools/harness/critic-w1-26-r1d.mjs [--json <path>]
import { parseArgs, wantsHelp, usage, writeJson } from '../lib/cli.mjs';
import { launchGame } from '../lib/browser.mjs';

const USAGE = `critic-w1-26-r1d.mjs — AR-2 / M11 / M9 over the un-instrumented HUD surface.`;
const args = parseArgs();
if (wantsHelp(args)) usage(USAGE);
const say = (s) => process.stdout.write(s + '\n');

const h = await launchGame(args);
const out = { probe: 'critic-w1-26-r1d', frames: [] };
try {
  const r = await h.page.evaluate(async () => {
    const H = window.__HARNESS;
    const eng = window.__ENGINE;
    const rend = eng.renderer;
    const snap = (label) => {
      const els = (rend.menus && rend.menus.elements) || [];
      return {
        label,
        menus_elements: els.length,
        menus_strings: [...new Set(els.map((e) => e && e.text).filter((t) => t && String(t).trim()))],
        menus_kinds: [...new Set(els.map((e) => e && e.kind).filter(Boolean))],
        accessor_non_dialogue: H.getRenderedText({ notSurface: ['dialogue'] }).distinct,
      };
    };
    const frames = [];
    await H.setRenderRate(0);
    await H.setSeed(1337);
    await H.loadState('barge-hold');
    H.renderFrame();
    frames.push(snap('barge-hold, no census'));
    await H.censusBegin({ race: 'saxhleel' });
    H.renderFrame();
    frames.push(snap('census open (hold.hatch-name)'));
    // Leave the hold: answer the name, get control back at hold.out, then walk.
    await H.censusAnswer('Silence-Under-Salt');
    H.renderFrame();
    frames.push(snap('after the hatch-name is given (hold.out)'));
    for (let i = 0; i < 120; i++) H.queueInputs([{ f: i, move: [0, 1] }]);
    H.stepFrames(120);
    H.renderFrame();
    frames.push(snap('120 frames of walking in the hold'));
    // And with the world's interact prompt in range, if one exists at all.
    for (let i = 0; i < 240; i++) H.queueInputs([{ f: i, move: [0, -1] }]);
    H.stepFrames(240);
    H.renderFrame();
    frames.push(snap('240 more frames, walking back'));
    return { frames, forbidden_kinds: [...((await import('/game/src/ui/surface.js')).FORBIDDEN_KINDS || [])] };
  });
  out.frames = r.frames;
  out.forbidden_kinds = r.forbidden_kinds;

  // ---- M9's own grep list, applied to the union of every string the HUD surface drew.
  const all = [...new Set(out.frames.flatMap((f) => f.menus_strings))];
  const accessorSaw = [...new Set(out.frames.flatMap((f) => f.accessor_non_dialogue))];
  const SUBSTR = ['Press ', 'Tap ', 'Click ', 'Tutorial', 'Objective', 'Quest added', 'New quest', 'Tip:'];
  const IMPERATIVE = /^(take|press|tap|click|use|open|hold|push|pull|go|move|walk|run|equip|drop|read|talk|attack|dodge|roll|block|jump|look|find|kill|collect|search|enter|exit|wait|rest|sleep|loot|pick)\b/i;
  const hits = all.filter((s) => SUBSTR.some((k) => s.indexOf(k) >= 0) || IMPERATIVE.test(s.trim()));
  const markerKinds = [...new Set(out.frames.flatMap((f) => f.menus_kinds))].filter((k) => (out.forbidden_kinds || []).indexOf(k) >= 0);
  out.m9 = {
    domain: 'every string rendered outside a dialogue/journal/book surface (RI-JRN01 M9)',
    instrument: 'UISurface.elements[].text, enumerated directly — the build accessor cannot see this surface',
    strings_searched: all.length,
    strings: all,
    hits,
    strings_the_build_accessor_saw_in_the_same_domain: accessorSaw,
  };
  out.m11 = { forbidden_kinds_present: markerKinds, kinds_seen: [...new Set(out.frames.flatMap((f) => f.menus_kinds))] };

  for (const f of out.frames) {
    say(`\n-- ${f.label}`);
    say(`   HUD elements ${f.menus_elements}; strings: ${JSON.stringify(f.menus_strings)}`);
    say(`   kinds: ${JSON.stringify(f.menus_kinds)}`);
    say(`   build accessor, same domain (notSurface dialogue): ${JSON.stringify(f.accessor_non_dialogue)}`);
  }
  say(`\n== M9 over the real domain: ${out.m9.strings_searched} strings searched, ${hits.length} hit(s) ==`);
  for (const s of hits) say(`   HIT "${s}"`);
  say(`== M9 as the build ran it: ${accessorSaw.length} strings searched ==`);
  say(`== M11/AR-2 forbidden kinds present: ${JSON.stringify(markerKinds)} ==`);
} finally {
  if (args.json) writeJson(String(args.json), out);
  await h.close();
}
