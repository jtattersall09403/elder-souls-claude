#!/usr/bin/env node
// w1-26-opening.mjs — the opening as a played scene, measured on the live build.
//
// Owner: W1-26. This probe covers the four things `RI-JRN01` asks about that
// `tools/journey/journey-run.mjs` (A-JRN1, the journey driver) does not:
//
//   T   M20 / HF9   A title surface exists at all, from a FRESH BROWSER PROFILE WITH AN
//                   EXISTING SAVE IN INDEXEDDB; it offers the exact O3 set; `Continue` is
//                   focused by default when a save exists; and `Continue` LOADS THAT SAVE.
//                   HF9 caps the whole item at 2 and fired on both prior rounds with nothing
//                   in the item able to notice.
//   A   §0.1(a)     The rendered-text ACCESSOR is named and DEMONSTRATED NON-EMPTY on a frame
//                   known to carry text, which is the precondition `RI-JRN01` sets before M9
//                   and M15 may be scored at all. Then the two greps are run through it.
//                   Without this the checks are `unmeasurable ⇒ 0`, never pass — a canvas-only
//                   build otherwise passes M9 by being unreadable.
//   R   O17 / M13   The title is completable on keyboard only, gamepad only, touch only and
//                   mouse+keyboard. Round 2 completed two of four legs and HF5 fired.
//   C   O6 / M4-1   `first_input`, `first_control` and the first field-writing node, now that
//                   the engine emits the first two. The interval nobody has ever measured.
//
// And the CONSUMPTION check `ARBITRATION` §3 / `RI-MTH07` requires of everything this piece
// ships, by perturbation with a frame-side observable and a null control:
//
//   K1  the save store -> the title. Two well-separated values (a save present / no save) with
//       everything else held fixed, observed as WHAT THE PLAYER CAN SEE — the drawn slot line
//       and the enabled state of `Continue` — plus the null control (perturb nothing, observe
//       nothing). A `getTitleState()` return value would be the trace, and `RI-MTH07` §B1
//       rules the trace an observer; so the observable here is the register's DRAWN STRINGS.
//   K2  the register itself, broken on purpose. `AGENT-PROTOCOL`: "before trusting your own
//       instrument, break the thing it measures and confirm the instrument goes red." The
//       surface is hidden and the register must report the strings gone.
//
// This probe is a builder's copy of a check a critic will re-run. It is written to FAIL when
// the build is wrong. Every threshold it applies is quoted from the item beside it.
//
// USAGE
//   node tools/harness/w1-26-opening.mjs [--json <path>] [--out <dir>]
'use strict';

import path from 'node:path';
import { parseArgs, wantsHelp, usage, writeJson, log, REPO_ROOT, REPORTS_DIR, ensureDir } from '../lib/cli.mjs';
import { launchGame } from '../lib/browser.mjs';

const USAGE = `
w1-26-opening.mjs — RI-JRN01 M20/HF9, the rendered-text accessor demonstration, O17 parity
and O6's first_control interval, against the running build.

USAGE
  node tools/harness/w1-26-opening.mjs [--json <path>] [--out <dir>]
`;

const args = parseArgs();
if (wantsHelp(args)) usage(USAGE);

const outDir = args.out ? path.resolve(String(args.out)) : path.join(REPORTS_DIR, 'journeys');
ensureDir(outDir);
const jsonPath = args.json ? path.resolve(String(args.json)) : path.join(outDir, 'w1-26-opening.json');

const say = (s) => process.stdout.write(s + '\n');
const out = {
  schema: 'elder-souls/w1-26-opening@1',
  item: 'RI-JRN01',
  piece: 'W1-26',
  checks: {},
  hard_fails: [],
  failures: [],
  passes: [],
};
// RED TEAM, hoisted to module scope. It was declared `const` INSIDE the try block and read
// again at the bottom of the file, so every red-team run this round died on
// `ReferenceError: redTeam is not defined` AFTER printing its results and BEFORE inverting its
// exit code — which means the facility written to prove the instrument can go red had never
// once completed. Found by running it. That is the whole lesson of this piece twice over.
const redTeam = args['red-team'] ? String(args['red-team']) : null;

// WHICH failure each mode must produce. A red-team run that goes red for an unrelated reason
// proves nothing at all: `--red-team=empty` sabotages the M9 domain, so if the run "went red"
// only because O6's interval is short or K1's coupling is zero, the sabotage was never
// detected and the inversion is vacuous. Each mode therefore names a SIGNATURE, and the mode
// passes only when a failure matching it is present. This is the same rule the piece applies
// to the build — a control that cannot exhibit the failure is not a control.
// Where a mode plants a string, the SIGNATURE IS THAT STRING, so a match cannot be a
// coincidence — the failure message has to be quoting the sabotage back. `blind` was caught by
// the §0.1(a) clause rather than by M9's own domain check on the first run of this facility,
// and a signature written from the code I expected to fire instead of the code that did would
// have scored a correct detection as a miss. Take the fingerprint, not the guess.
const RED_TEAM_PLANT_SURFACE = 'a-surface-nobody-wrapped';
const RED_TEAM_PLANT_STRING = 'Press E to speak to Jeeh-Ei';
const RED_TEAM_SIGNATURE = {
  empty: { needle: 'M9 searched ZERO strings', what: 'the M9 grep must notice its domain is empty and refuse to score it' },
  blind: { needle: RED_TEAM_PLANT_SURFACE, what: 'a failure must NAME the declared-but-uninstrumented surface' },
  plant: { needle: RED_TEAM_PLANT_STRING, what: 'HF3 must fire and quote the planted HUD instruction back' },
};

const fail = (m) => { out.failures.push(m); say(`  FAIL  ${m}`); };
const pass = (m) => { out.passes.push(m); say(`  pass  ${m}`); };
const hard = (id, m) => { out.hard_fails.push({ id, why: m }); say(`  HARD FAIL ${id}  ${m}`); };

// `RI-JRN01` O3, verbatim, in the item's own words. The build must publish exactly this set.
const O3 = ['continue', 'new', 'load', 'settings', 'quit-to-menu'];

// `RI-JRN01` M9's substring list, verbatim, plus the imperative-second-person test.
const M9_SUBSTRINGS = ['Press ', 'Tap ', 'Click ', 'Tutorial', 'Objective', 'Quest added', 'New quest', 'Tip:'];
// O14 / M15. `RI-LOR01` registers no explicit list, so this is O14's own wording expanded:
// chosen, prophesied, special, the last of anything, the only one who can.
const M15_WORDS = ['chosen', 'prophes', 'prophec', 'the chosen', 'destined', 'foretold',
  'the last of', 'the only one who', 'nerevarine', 'you alone can'];

const handle = await launchGame({ ...args, width: 1920, height: 1080 });

try {
  // ======================================================================================
  // T — M20 / HF9. A title surface, from a fresh profile WITH a save already in IndexedDB.
  // ======================================================================================
  // `RI-JRN01` How-we-lose #13: "everything works on the second run and nobody tested the
  // first. The critic must always measure with a fresh browser profile — recorded in the
  // artifact or the measurement is void." `launchGame` mints a fresh context per run, so this
  // page load has an empty IndexedDB; the save is written and the page is RELOADED, which is
  // the returning player's actual situation and the only one M20 is about.
  say('T — M20/HF9: the title surface');
  const cold = await handle.page.evaluate(async () => {
    const H = window.__HARNESS;
    await H.ready();
    const t0 = H.getTitleState();
    // Write a save so the reload is a RETURNING player's boot.
    await H.titleShow();
    await H.titleActivate('new');
    H.stepFrames(30);
    await H.writeSave('slot-a');
    const slots = await H.listSaveSlots();
    return { title_before_save: t0, slots_written: slots.map((s) => s.slot) };
  });
  out.checks.fresh_profile = { fresh_browser_context: true, storage_seeded_by: 'writeSave("slot-a") then page.reload()', slots: cold.slots_written };
  if (!cold.slots_written.length) fail('T0 could not write a save, so M20\'s "a save exists" precondition cannot be established');

  // The reload is the point of M20: the save is now in IndexedDB and this page load is a
  // RETURNING player's. `domcontentloaded` rather than `load` because the software renderer's
  // first frame can outlast a 30 s `load` on this container, and `__HARNESS.ready()` below is
  // the readiness gate that actually matters.
  await handle.page.reload({ waitUntil: 'domcontentloaded', timeout: 120000 });
  const t = await handle.page.evaluate(async () => {
    const H = window.__HARNESS;
    await H.ready();
    H.setMode('play-instrumented');       // real listeners, harness-driven clock
    H.setRenderRate(0);
    const st0 = H.getTitleState();
    // The title is constructed in every mode and raised in play; raise it explicitly so this
    // measurement does not depend on the mode flag, and say so.
    if (!st0.shown) await H.titleShow();
    const st = H.getTitleState();
    H.renderFrame();                       // the title draws only when a frame is presented
    const drawn = H.getRenderedText({ surface: 'title' });
    return { state_at_boot: st0, state: st, title_drawn: drawn.distinct, title_entries: drawn.entries.length };
  });
  out.checks.m20 = {
    present: t.state.present,
    shown_at_boot_in_harness_mode: t.state_at_boot.shown,
    raised_by: t.state_at_boot.shown ? 'boot' : 'titleShow()',
    option_ids: t.state.option_ids,
    o3_expected: O3,
    selected_id: t.state.selected_id,
    save_count: t.state.save_count,
    continue_available: t.state.continue_available,
    unskippable_ms: t.state.unskippable_ms,
    world_behind: t.state.world_behind,
    drawn_strings: t.title_drawn,
  };
  if (!t.state.present) hard('HF9', 'no title surface exists at all');
  else pass('a title surface exists');
  const setOk = JSON.stringify(t.state.option_ids) === JSON.stringify(O3);
  if (!setOk) fail(`M20: option set is [${t.state.option_ids.join(', ')}], O3 wants [${O3.join(', ')}]`);
  else pass('M20: the option set is exactly O3\'s five');
  if (t.state.save_count < 1) hard('HF9', 'a save exists in IndexedDB and the title reports none — no route to it before control');
  else if (t.state.selected_id !== 'continue') fail(`M20/O3: a save exists and the focused row is '${t.state.selected_id}', not 'continue'`);
  else pass('M20/O3: `Continue` is focused by default when a save exists');
  if (!t.title_drawn.length) fail('M20: the title surface draws no text — nothing reached the frame');
  else pass(`M20: the title drew ${t.title_drawn.length} distinct strings`);

  // `Continue` LOADS THAT SAVE — through the same entry point the player's `interact` reaches.
  const cont = await handle.page.evaluate(async () => {
    const H = window.__HARNESS;
    const before = H.getStateHash();
    const r = await H.titleActivate('continue');
    return { result: r, hash_before: before, hash_after: H.getStateHash(), title: H.getTitleState(), player: H.getPlayerStats() };
  });
  out.checks.m20_continue = { result: cont.result, hash_before: cont.hash_before, hash_after: cont.hash_after, title_shown_after: cont.title.shown };
  if (cont.result && cont.result.loaded) pass('M20: `Continue` loaded the save');
  else hard('HF9', `\`Continue\` did not load the save: ${JSON.stringify(cont.result)}`);
  if (cont.title.shown) fail('M20: the title is still up after `Continue`');
  else pass('M20: the title yields to the world on `Continue`');

  // ======================================================================================
  // A — §0.1(a). The accessor, NAMED and DEMONSTRATED, before either grep is reported.
  // ======================================================================================
  say('A — the rendered-text accessor (RI-JRN01 §0.1(a))');
  // RED TEAM. The round-1 verdict's headline was that a scored check was a grep over zero
  // strings recorded as a pass, and its remedy was "make the probe exit non-zero when its M9
  // grep searches zero strings". A remedy nobody has watched fail is a claim. `--red-team=<mode>`
  // sabotages the instrument in the page, in the one way each mode names, so that the probe's
  // RED-ness is a thing you can run rather than a thing I assert:
  //   empty  — getRenderedText() returns an empty non-dialogue domain. Must trip "searched ZERO".
  //   blind  — a surface is declared and never instrumented. Must trip the §0.1(a) blind clause.
  //   plant  — an imperative HUD string is drawn through the real vector path. Must fire HF3.
  // A red-team run that PASSES is itself a failure, and is reported as one.
  if (redTeam) {
    say(`RED TEAM: '${redTeam}' — the probe is expected to FAIL. A pass here means the instrument cannot go red.`);
    await handle.page.evaluate(({ mode, SURF, STR }) => {
      const H = window.__HARNESS;
      if (mode === 'empty') {
        const real = H.getRenderedText;
        H.getRenderedText = (o) => {
          const r = real.call(H, o);
          const notDialogue = o && (o.notSurface || (o.surface && o.surface.indexOf('dialogue') < 0));
          return notDialogue ? { ...r, distinct: [], rows: [], summary: { ...(r.summary || {}), distinct: 0 } } : r;
        };
      } else if (mode === 'blind') {
        window.__ENGINE.renderer.textRegister.declare(SURF, 'red-team: declared, never instrumented');
      } else if (mode === 'plant') {
        H.__redTeamPlant = () => H.drawOnMenus(STR);
      }
    }, { mode: redTeam, SURF: RED_TEAM_PLANT_SURFACE, STR: RED_TEAM_PLANT_STRING });
  }
  const acc = await handle.page.evaluate(async () => {
    const H = window.__HARNESS;
    // The two obvious instruments, measured so the report can say why they are not used.
    const domText = (document.body.innerText || '').trim();
    const axChildCount = (() => { try { return document.body.children.length; } catch { return -1; } })();

    H.renderedTextClear();
    // A frame KNOWN to carry text: the census's first node, whose authored line is in the
    // graph. If the accessor comes back empty HERE, it is blind and every grep below is void.
    await H.titleShow();
    await H.titleActivate('new');
    H.stepFrames(2);
    H.renderFrame();
    const proof = H.getRenderedText();
    return {
      dom_inner_text_len: domText.length,
      dom_child_count: axChildCount,
      accessor: proof.accessor,
      source: proof.source,
      surfaces: proof.surfaces_instrumented,
      // W1-26 round 2. `surfaces` used to be all this recorded, and it was a HARDCODED literal
      // in the harness that named two of the build's three 2D surfaces. The roster and the
      // sentinels are recorded here so the claim "the accessor sees the frame" is checkable
      // from the artifact rather than taken on the harness's word.
      declared: proof.surfaces_declared,
      blind: proof.blind_surfaces,
      complete: proof.complete,
      draw_paths: proof.draw_paths,
      sentinels: H.drawSentinels('W1-26-OPENING'),
      distinct: proof.distinct,
      summary: proof.summary,
    };
  });
  out.checks.accessor = acc;
  // §0.1(a) has TWO clauses now and the second is the one round 1 failed: the accessor must be
  // non-empty AND it must be able to see the surfaces the greps are aimed at. An accessor that
  // is demonstrated non-empty on the dialogue surface and blind to the HUD buys a false pass on
  // exactly the domain M9 is defined over, which is what happened.
  const live = acc.distinct.length > 0 && acc.complete === true && acc.sentinels.both_seen === true;
  if (!acc.complete) {
    fail(`§0.1(a): the register declares ${JSON.stringify(acc.blind)} and cannot see ${acc.blind.length === 1 ? 'it' : 'them'}. M9 and M15 are \`unmeasurable ⇒ 0\`, never pass.`);
  } else if (!acc.sentinels.both_seen) {
    fail(`§0.1(a): a draw path is invisible to the register — vector sentinel seen=${acc.sentinels.vector.seen}, fillText sentinel seen=${acc.sentinels.fill.seen}. M9 and M15 are \`unmeasurable ⇒ 0\`.`);
  } else if (!acc.distinct.length) {
    fail('§0.1(a): the rendered-text accessor returned EMPTY on a frame known to carry text. M9 and M15 are `unmeasurable ⇒ 0`, never pass.');
  } else {
    pass(`§0.1(a): accessor \`${acc.accessor}\` demonstrated non-empty — ${acc.distinct.length} distinct strings on a frame known to carry text`);
    say(`        (for contrast, document.body.innerText is ${acc.dom_inner_text_len} chars — the instrument RI-MTH06 §B warns about)`);
  }

  // ======================================================================================
  // A2 — M9 and M15, through that accessor, over the whole opening.
  // ======================================================================================
  const greps = await handle.page.evaluate(async ({ subs, words }) => {
    const H = window.__HARNESS;
    H.renderedTextClear();
    // Walk the whole creation scene with the surface drawing every node, so the register holds
    // the opening's real text stream rather than one frame of it.
    const seen = [];
    for (let i = 0; i < 60; i++) {
      const st = H.getCensusState();
      if (!st || st.done) break;
      H.renderFrame();
      const node = st.node;
      // The scene has TWO nodes that hand control back to the player and wait (`hold.come-to`,
      // resumed by talking; `hold.out`, resumed by walking up the companionway). A walker that
      // does not hand it back stops on the first one and reports the whole opening as undrawn —
      // which is exactly what this loop did, and why M1 read DTR_scene = 0 on a scene that
      // draws everything.
      if (st.paused) { H.censusEnter(st.resume_by); continue; }
      const inp = st.input;
      if (!inp) { H.stepFrames(4); if (H.getCensusState().node === node) break; continue; }
      let value = null;
      if (inp.kind === 'text') value = (inp.options && inp.options[0] && inp.options[0].id) || 'Ei';
      else if (inp.kind === 'observed') value = 'correct';
      else if (inp.kind === 'pick') {
        const need = { 'writ.class-custom-primary': 3 }[node] || 2;
        value = (inp.options || []).slice(0, need).map((o) => o.id);
      } else value = (inp.options && inp.options[0] && inp.options[0].id) || null;
      seen.push(node);
      try { H.censusAnswer(value); } catch (e) { seen.push(`THREW at ${node}: ${e.message}`); break; }
      H.stepFrames(2);
    }
    H.renderFrame();
    // `--red-team=plant` puts an imperative HUD string on the surface through the real vector
    // draw path, after the walk and before the read, exactly where a regression would put one.
    if (typeof H.__redTeamPlant === 'function') H.__redTeamPlant();
    const all = H.getRenderedText();
    // M9 greps strings rendered OUTSIDE a dialogue/journal/book surface.
    const nonDialogue = H.getRenderedText({ notSurface: ['dialogue'] });
    const hit = (list, needles, ci) => {
      const found = [];
      for (const s of list) for (const n of needles) {
        const a = ci ? s.toLowerCase() : s, b = ci ? n.toLowerCase() : n;
        if (a.indexOf(b) >= 0) found.push({ text: s, needle: n });
      }
      return found;
    };
    // M9's second clause: "imperative second-person instruction". A bare imperative verb at the
    // head of a drawn string is the shape, and it is the clause that fired in round 1 on
    // `"Take A tithe-gourd, empty"` — which none of the substrings above would have caught.
    const IMPERATIVE = ['take', 'press', 'hold', 'speak', 'click', 'tap', 'push', 'pull', 'use',
      'open', 'go', 'walk', 'run', 'jump', 'attack', 'defeat', 'find', 'collect', 'equip', 'talk'];
    return {
      nodes_walked: seen,
      all_distinct: all.distinct.length,
      all_complete: all.complete,
      m9_surfaces: nonDialogue.surfaces_instrumented,
      m9_blind: nonDialogue.blind_surfaces,
      m9_complete: nonDialogue.complete,
      non_dialogue_distinct: nonDialogue.distinct,
      m9_hits: hit(nonDialogue.distinct, subs, false),
      m9_imperative: nonDialogue.distinct.filter((s) => IMPERATIVE.indexOf(String(s).toLowerCase().split(/[^a-z]+/)[0]) >= 0),
      m15_hits: hit(all.distinct, words, true),
      summary: all.summary,
      // The clip-aware half: strings handed to fillText that the player could not read.
      clipped: H.getRenderedText({ includeClipped: true }).entries.filter((e) => e.clipped).map((e) => ({ surface: e.surface, text: e.text })),
    };
  }, { subs: M9_SUBSTRINGS, words: M15_WORDS });
  // `surfaces_searched` used to be the string "title (the only non-dialogue drawn surface in
  // the build)". It was false — there were two, and the other one was the HUD, which is where
  // M9's only hit was — and it was hand-written into the report rather than read off the
  // instrument. It is now whatever the register says it covered, and the `complete` flag beside
  // it is what a reader should branch on.
  out.checks.m9 = {
    instrument: '__HARNESS.getRenderedText({notSurface:["dialogue"]})',
    surfaces_searched: greps.m9_surfaces, surfaces_blind: greps.m9_blind, domain_complete: greps.m9_complete,
    distinct_searched: greps.non_dialogue_distinct.length,
    strings_searched: greps.non_dialogue_distinct,
    hits: greps.m9_hits, imperative_hits: greps.m9_imperative,
  };
  out.checks.m15 = { instrument: '__HARNESS.getRenderedText()', domain_complete: greps.all_complete, distinct_searched: greps.all_distinct, hits: greps.m15_hits };
  out.checks.orphan_text = { clipped_entries: greps.clipped };
  out.checks.scene_walk = { nodes: greps.nodes_walked };
  if (!live) say('  (M9/M15 not reported: the accessor is blind)');
  else if (!greps.m9_complete) {
    fail(`M9's domain is INCOMPLETE — the register cannot see ${JSON.stringify(greps.m9_blind)}. unmeasurable ⇒ 0, not a pass.`);
  } else if (!greps.non_dialogue_distinct.length) {
    // THE ROUND-1 DEFECT, AS AN ASSERTION. The build's own report recorded M9 as a pass with
    // `distinct_searched: 0`. Zero strings searched is ignorance about a domain, not evidence
    // of absence, and a probe that cannot go red on it is worse than no probe at all.
    fail('M9 searched ZERO strings. A grep over an empty set is not a pass — unmeasurable ⇒ 0.');
  } else {
    if (greps.m9_hits.length) hard('HF3', `M9: ${greps.m9_hits.length} instruction hit(s) outside a dialogue surface: ${JSON.stringify(greps.m9_hits.slice(0, 4))}`);
    else if (greps.m9_imperative.length) hard('HF3', `M9: imperative second-person instruction drawn outside a dialogue surface: ${JSON.stringify(greps.m9_imperative)}`);
    else pass(`M9: 0 hits over ${greps.non_dialogue_distinct.length} distinct non-dialogue strings on ${JSON.stringify(greps.m9_surfaces)}, through a demonstrated accessor`);
    if (greps.m15_hits.length) fail(`M15: ${greps.m15_hits.length} prophecy-vocabulary hit(s): ${JSON.stringify(greps.m15_hits.slice(0, 4))}`);
    else pass(`M15: 0 hits over ${greps.all_distinct} distinct strings`);
  }
  if (greps.clipped.length) {
    fail(`ORPHAN TEXT: ${greps.clipped.length} string(s) were handed to fillText and fell outside their surface's clip — computed, laid out, painted nowhere. ${JSON.stringify(greps.clipped.slice(0, 3))}`);
  } else pass('no orphan text: every string handed to a draw call landed inside its clip');

  // ======================================================================================
  // D — `RI-JRN09` M1 `DTR`, computed THROUGH THE DRAW CALL rather than through the layout.
  // ======================================================================================
  // `RI-JRN09` M1 says the drawn set is read "through the build's rendered-text accessor (the
  // same accessor `RI-JRN01` M9 requires the critic to name and demonstrate non-empty)". There
  // are two candidates in this build and they are not equivalent:
  //
  //   * `getUIState().text` / `getCensusState().surface.rendered_text` — the LAYOUT's array,
  //     built from the line lists it just placed. It is honest about what the layout meant to
  //     draw, and it CANNOT see a line that was placed and then clipped off the vellum. The
  //     dialogue panel is height-capped and clips, so the two differ exactly where it matters.
  //   * `getRenderedText()` — the REGISTER, fed by `fillText` and shadowing the clip stack.
  //
  // This block computes `DTR` the strong way and reports both, because a `DTR` of 1.00 taken
  // from the layout while a question was clipped off the panel is the round-2 defect one layer
  // down, and `RI-JRN09` exists to make exactly that class of thing scoreable.
  say('D — RI-JRN09 M1: DTR through the draw call');
  const dtr = await handle.page.evaluate(async () => {
    const H = window.__HARNESS;
    const norm = (s) => String(s == null ? '' : s).replace(/\s+/g, ' ').trim().toLowerCase();
    // Restart the scene so the walk is a whole scene rather than the tail of the last one.
    await H.titleShow();
    await H.titleActivate('new');
    const nodes = [];
    for (let i = 0; i < 60; i++) {
      const st = H.getCensusState();
      if (!st || st.done) break;
      // Same hand-back as the grep walker above: a paused node draws no question because there
      // is no question yet, and it is resumed by the act the graph names, not by answering it.
      if (st.paused) { H.censusEnter(st.resume_by); continue; }
      H.renderedTextClear();
      H.renderFrame();
      const model0 = H.getCensusModel() || {};
      // "Reached the frame AT THAT NODE", not "in one frame of that node". The answer list
      // scrolls when it is longer than the option window, so the strings a player can read
      // at this node are the ones the surface paints while they move the caret through it.
      // The caret is moved with the SAME closed action set a player has, and the register
      // still only counts a string that `fillText` actually painted inside its clip — this
      // widens what counts as "at this node" and relaxes nothing about what counts as drawn.
      // NOT `st.input.options`: at a `text` node (the two name nodes) that is null, and the
      // ledger of hatch-names lives on the SURFACE. The model is what the panel draws from,
      // so the model is what says how long the list is.
      const optCount = ((model0 && model0.options) || []).length;
      if (optCount > 1) {
        for (let k = 0; k < optCount + 1; k++) {
          H.queueInputs([{ f: 0, move: [0, -1] }, { f: 1, move: [0, 0] }]);
          H.stepFrames(2);
          H.renderFrame();
        }
      }
      const model = H.getCensusModel() || model0;
      const reg = H.getRenderedText({ surface: 'dialogue' });
      const layout = (H.getUIState().text || []);
      // The authored strings THE MODEL computes for this node, with their role.
      const authored = [];
      const add = (role, s) => { if (s && String(s).trim()) authored.push({ role, text: String(s) }); };
      add('line', model.line);
      add('preamble', model.preamble);
      for (const s of (model.spoken || [])) add('spoken', typeof s === 'string' ? s : (s && s.line));
      add('aside', model.aside);
      if (model.record && Array.isArray(model.record.lines)) for (const l of model.record.lines) add('record', l);
      for (const o of (model.options || [])) add('option', o.text);
      // Distinct, never character counts — the item is explicit that a length check is blind
      // to the failure it exists to catch.
      const seen = new Set(); const distinctAuthored = [];
      for (const a of authored) { const k = norm(a.text); if (!k || seen.has(k)) continue; seen.add(k); distinctAuthored.push(a); }
      const blobReg = reg.distinct.map(norm).join('  ');
      const blobLay = layout.map(norm).join('  ');
      const inBlob = (b, s) => b.indexOf(norm(s)) >= 0;
      const undrawn = distinctAuthored.filter((a) => !inBlob(blobReg, a.text));
      const undrawnLayout = distinctAuthored.filter((a) => !inBlob(blobLay, a.text));
      nodes.push({
        node: st.node,
        kind: st.input ? st.input.kind : null,
        authored: distinctAuthored.length,
        drawn_register: distinctAuthored.length - undrawn.length,
        drawn_layout: distinctAuthored.length - undrawnLayout.length,
        dtr_register: distinctAuthored.length ? +((distinctAuthored.length - undrawn.length) / distinctAuthored.length).toFixed(4) : 1,
        dtr_layout: distinctAuthored.length ? +((distinctAuthored.length - undrawnLayout.length) / distinctAuthored.length).toFixed(4) : 1,
        undrawn: undrawn.map((a) => ({ role: a.role, text: a.text.slice(0, 90) })),
        clipped_here: reg.summary.surfaces.dialogue ? reg.summary.surfaces.dialogue.clipped : 0,
      });
      // Answer and move on.
      const inp = st.input;
      if (!inp) {
        // A paused node hands control back and the way onward is a WALK — `hold.out` is the
        // companionway out of the barge. Drive it with forward input rather than declaring
        // the scene over, which is what round 1 of this probe did and why it measured DTR
        // over two nodes and called it a scene.
        let moved = false;
        for (let w = 0; w < 40 && !moved; w++) {
          H.queueInputs([{ f: 0, move: [0, 1] }]);
          H.stepFrames(10);
          if (H.getCensusState().node !== st.node) moved = true;
        }
        if (!moved) { nodes.push({ node: st.node, stuck: 'forward input for 400 frames did not leave this node' }); break; }
        continue;
      }
      let value;
      if (inp.kind === 'text') value = (inp.options && inp.options[0] && inp.options[0].id) || 'Ei';
      else if (inp.kind === 'observed') value = 'correct';
      else if (inp.kind === 'pick') {
        const need = st.node === 'writ.class-custom-primary' ? 3 : 2;
        value = (inp.options || []).slice(0, need).map((o) => o.id);
      } else value = (inp.options && inp.options[0] && inp.options[0].id) || null;
      try { H.censusAnswer(value); } catch (e) { nodes.push({ node: st.node, threw: e.message }); break; }
      H.stepFrames(2);
    }
    return nodes;
  });
  const qNodes = dtr.filter((n) => /question/i.test(n.node || '') || /class-questions/.test(n.node || ''));
  const wAuth = dtr.reduce((a, n) => a + (n.authored || 0), 0);
  const wDrawn = dtr.reduce((a, n) => a + (n.drawn_register || 0), 0);
  const dtrScene = wAuth ? +(wDrawn / wAuth).toFixed(4) : 0;
  const worst = dtr.filter((n) => n.authored).sort((a, b) => a.dtr_register - b.dtr_register)[0] || null;
  out.checks.dtr = {
    accessor_used: '__HARNESS.getRenderedText() — the register, fed by fillText and clip-aware',
    accessor_compared_against: '__HARNESS.getUIState().text — the layout\'s own array, which cannot see a clipped line',
    dtr_scene_register: dtrScene,
    dtr_scene_layout: wAuth ? +(dtr.reduce((a, n) => a + (n.drawn_layout || 0), 0) / wAuth).toFixed(4) : 0,
    questionnaire_nodes: qNodes.map((n) => ({ node: n.node, dtr: n.dtr_register })),
    worst_node: worst,
    nodes: dtr,
  };
  if (dtrScene >= 0.90) pass(`M1: DTR_scene = ${dtrScene} through the draw call (RI-JRN09 wants >= 0.90)`);
  else fail(`M1: DTR_scene = ${dtrScene} through the draw call (RI-JRN09 wants >= 0.90)`);
  if (worst && worst.dtr_register < 0.50) hard('HF1', `M1: DTR = ${worst.dtr_register} at '${worst.node}' — the scene computed more than twice what it showed there`);
  else if (worst) pass(`M1: worst node is '${worst.node}' at DTR ${worst.dtr_register} (HF1 fires below 0.50)`);
  const layoutOverclaim = dtr.filter((n) => n.drawn_layout > n.drawn_register);
  out.checks.dtr.layout_overclaims_at = layoutOverclaim.map((n) => n.node);
  if (layoutOverclaim.length) {
    fail(`M1: the LAYOUT's accessor claims more delivered than the DRAW CALL does, at ${layoutOverclaim.length} node(s): ${layoutOverclaim.map((n) => n.node).join(', ')}. A DTR taken from getUIState().text would have scored those nodes higher than the player's eyes would.`);
  } else pass('M1: the layout accessor and the draw-call accessor agree — no node claims a string it clipped away');

  // ======================================================================================
  // C — O6 / M4 clause 1. The interval nobody has ever measured.
  // ======================================================================================
  say('C — O6 / M4 clause 1: control before definition');
  const stamps = await handle.page.evaluate(async () => {
    const H = window.__HARNESS;
    // Start the opening the way a player does and then TRY TO WALK, with real forward input,
    // for a full second of play. Whether the body moves is the whole of O6: if the scene has
    // already put a character-defining question up and taken the buttons, it cannot, and
    // `first_control` never fires — which is the measurement, not a probe failure.
    await H.titleShow();
    await H.titleActivate('new');
    const E = window.__ENGINE;
    const before = H.getPlayerStats();
    const node_at_start = (H.getCensusState() || {}).node;
    // ONE call with the whole timeline. `InputPipeline.queueInputs()` REPLACES the script and
    // re-bases it on the calling frame, so the six-calls-of-one-frame shape this used to have
    // delivered SIX frames of input and called it sixty. Round 1's "0.0000 m" was that artefact
    // sitting on top of a real defect; both are gone and the number must be taken honestly.
    const s60 = []; for (let i = 0; i < 60; i++) s60.push({ f: i, move: [0, 1] });
    H.queueInputs(s60); H.stepFrames(60);
    const after = H.getPlayerStats();
    // O6 ASKS WHAT IS AVAILABLE, NOT WHAT THIS PROBE HAD THE PATIENCE FOR.
    //
    // The previous shape of this section walked forward for one second and then went straight
    // over and asked her to start, so the interval it reported was a property of the probe's
    // impatience. On a scene that WAITS, that is not the measurement: "available play before
    // the first character-defining question" is how long the player may be a body if they
    // choose to be, and the scene only asks when asked.
    //
    // So: wander for the item's own threshold, in real input, and watch two things every
    // second — that the body is still moving, and that no field-writing node has arrived. The
    // check can still go red, and goes red exactly where round 1 did: if the scene puts a
    // question up on its own, `census_takes_input` is true within the window, the body stops
    // moving because the surface has the buttons, and `first_field_frame` lands inside it.
    const WANDER_S = 60;
    const wander = { samples: [], asked_during_window_at: null, frozen_at: null, distance_m: 0 };
    let prev = after.pos.slice();
    for (let sec = 0; sec < WANDER_S; sec++) {
      // Turn as well as walk. A still target hides every steering defect, and a body that only
      // ever walks in one line can be a body that is being slid rather than driven.
      const step = [];
      for (let i = 0; i < 60; i++) step.push({ f: i, move: [Math.sin(sec * 0.7), Math.cos(sec * 0.7)], look: [sec % 2 ? 3 : -3, 0] });
      H.queueInputs(step); H.stepFrames(60);
      const now = H.getPlayerStats();
      const d = Math.hypot(now.pos[0] - prev[0], now.pos[2] - prev[2]);
      wander.distance_m += d;
      prev = now.pos.slice();
      const cst = H.getCensusState() || {};
      const takes = !!(cst.surface && cst.surface.takes_input);
      if (takes && wander.asked_during_window_at == null) wander.asked_during_window_at = sec + 1;
      if (d < 1e-3 && wander.frozen_at == null) wander.frozen_at = sec + 1;
      if (sec % 10 === 9) wander.samples.push({ at_s: sec + 1, moved_m: +d.toFixed(3), node: cst.node || null, paused: !!cst.paused, takes_input: takes });
    }
    wander.distance_m = +wander.distance_m.toFixed(2);
    wander.survived_s = wander.asked_during_window_at == null ? WANDER_S : wander.asked_during_window_at;
    wander.threshold_s = WANDER_S;
    // O6's RIGHT end. The scene no longer puts a question up on its own — it waits, which is the
    // whole repair — so a probe that only walks forward will never reach a field node and will
    // report the interval as undefined forever. Being a body is the first half of the check; the
    // second half is going and talking to her, which is the act that starts the questions.
    const walkAndTalk = () => {
      for (let a = 0; a < 40 && (H.getCensusState() || {}).paused; a++) {
        const st = H.getCensusState();
        if (st.resume_by !== 'talk') { H.censusEnter(st.resume_by); continue; }
        const p = E.sim.player.pos;
        const who = E.sim.findNPC(st.speaker);
        const tgt = who ? who.pos : [-2, 0, 2.6];
        const yaw = (H.getPlayerStats().yaw || 0) * Math.PI / 180;
        const dx = tgt[0] - p[0], dz = tgt[2] - p[2];
        const fx = Math.sin(yaw), fz = Math.cos(yaw);
        const fwd = dx * fx + dz * fz, str = dx * fz - dz * fx;
        const n = Math.max(1e-6, Math.hypot(fwd, str));
        const step = [];
        for (let i = 0; i < 30; i++) step.push({ f: i, move: [str / n, fwd / n] });
        step.push({ f: 31, press: ['interact'] }, { f: 32, release: ['interact'] });
        H.queueInputs(step); H.stepFrames(40);
      }
    };
    walkAndTalk();
    const s = H.getJourneyStamps();
    const cs = H.getCensusState();
    return {
      ...s,
      wander,
      moved_m: +Math.hypot(after.pos[0] - before.pos[0], after.pos[2] - before.pos[2]).toFixed(3),
      census_node_at_start: node_at_start,
      census_node_after_talking: cs ? cs.node : null,
      census_takes_input_at_start: !!(cs && cs.surface && cs.surface.takes_input),
      opened_paused: node_at_start === 'hold.come-to',
      forward_input_frames: 60,
    };
  });
  out.checks.m4_clause1 = stamps;
  if (stamps.first_input_frame != null) pass(`M4: \`first_input\` fired at frame ${stamps.first_input_frame} — the A-JRN7 event that had never been emitted`);
  else fail('M4: `first_input` did not fire even though real input was dispatched');
  if (stamps.first_control_frame == null && stamps.moved_m === 0) {
    fail(`M4 clause 1 / O6 = 0 s: sixty frames of forward input moved the body ${stamps.moved_m} m, because '${stamps.census_node_at_start}' — a character-defining node — already had the buttons. The item's own How-we-lose #5: "control arrives after definition". This is now MEASURED rather than blocked.`);
  }
  if (stamps.first_control_frame == null) {
    fail('M4 clause 1: `first_control` was never emitted in this run — the left end of O6\'s interval does not exist');
  } else if (stamps.available_play_s_before_first_field == null) {
    fail('M4 clause 1: no field-writing node was reached, so the interval has no right end');
  } else {
    const s = stamps.available_play_s_before_first_field;
    out.checks.m4_clause1.threshold_s = 60;
    if (s >= 60) pass(`M4 clause 1: ${s} s of available play before the first character-defining question (O6 wants >= 60)`);
    else fail(`M4 clause 1: ${s} s of available play before the first character-defining question at '${stamps.first_field_node}'. O6 wants >= 60 — "you get a body before you get a character" is the item's own best idea and this build asks first.`);
  }
  // O6 AS AVAILABILITY, which is what the item actually asks and what the stamp interval above
  // cannot express on a scene that waits: the stamp measures when THIS PROBE chose to ask.
  const w = stamps.wander || {};
  if (w.asked_during_window_at != null) {
    fail(`O6: the scene put a character-defining question up on its own after ${w.asked_during_window_at} s of wandering. O6 wants >= ${w.threshold_s} s of being a body first.`);
  } else if (w.frozen_at != null) {
    fail(`O6: the body stopped responding to input at ${w.frozen_at} s — a surface has the buttons. Sixty seconds of "available play" in which the player cannot move is not available play.`);
  } else {
    pass(`O6: ${w.threshold_s} s of real wandering (${w.distance_m} m walked and turned) and the scene never asked — it waits to be asked`);
  }

  // ======================================================================================
  // R — O17 / M13's reachability legs, on the TITLE. Four devices, four completions.
  // ======================================================================================
  say('R — O17: the title on four input devices');
  const parity = {};
  for (const leg of ['keyboard', 'mouse+keyboard', 'gamepad', 'touch']) {
    parity[leg] = await handle.page.evaluate(async (which) => {
      const H = window.__HARNESS;
      await H.titleShow();
      const before = H.getTitleState();
      const canvas = document.getElementById('view');
      const key = (type, code) => window.dispatchEvent(new KeyboardEvent(type, { code, key: code, bubbles: true, cancelable: true }));
      let inputs = 0;
      const step = (n) => H.stepFrames(n);
      // Every leg does the same thing: move the caret off `continue` onto `new`, then commit.
      // Two inputs. O18/M14's budget is 5 to first control on a second run.
      if (which === 'keyboard' || which === 'mouse+keyboard') {
        key('keydown', 'KeyS'); step(2); key('keyup', 'KeyS'); step(2); inputs++;
        if (which === 'mouse+keyboard') {
          // The mouse leg must not need a cursor: O17's hard fail is "any surface that
          // requires a mouse cursor". The mouse is used for LOOK and the keyboard commits,
          // which is what a desktop player actually does.
          canvas.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, movementX: 12, movementY: 0 }));
        }
        key('keydown', 'KeyE'); step(2); key('keyup', 'KeyE'); step(2); inputs++;
      } else if (which === 'gamepad') {
        // `__HARNESS.gamepad()` routes into the same `pollGamepad()` a physical pad drives.
        H.gamepad({ axes: [0, 1, 0, 0], buttons: [] }); H.gamepadPoll(); step(2);
        H.gamepad({ axes: [0, 0, 0, 0], buttons: [] }); H.gamepadPoll(); step(2); inputs++;
        H.gamepad({ axes: [0, 0, 0, 0], buttons: [0] }); H.gamepadPoll(); step(2);
        H.gamepad({ axes: [0, 0, 0, 0], buttons: [] }); H.gamepadPoll(); step(2); inputs++;
      } else {
        // Touch, through the build's OWN touch layer (`RI-JRN04` §G's `touchDown/Move/Up`,
        // which inject at the same pointer seam the browser delivers to). The control
        // geometry is READ FROM THE LAYER rather than guessed: a probe that pokes coordinates
        // it invented and reports a hard fail has measured its own arithmetic.
        if (typeof H.touchLayout !== 'function' || typeof H.touchDown !== 'function') {
          return { unmeasurable: 'the build exposes no touch layout accessor', before_selected: before.selected_id, after_selected: before.selected_id, shown_after: before.shown, inputs: 0 };
        }
        if (typeof H.setTouchEnabled === 'function') H.setTouchEnabled(true);
        const lay = H.touchLayout();
        if (!lay || !Array.isArray(lay.buttons) || !lay.buttons.length) {
          return { unmeasurable: 'touchLayout() returned no buttons', layout: lay, before_selected: before.selected_id, after_selected: before.selected_id, shown_after: before.shown, inputs: 0 };
        }
        const stick = lay.stick || { cx: (lay.stick_cx || 0), cy: (lay.stick_cy || 0), r: 80 };
        const btn = lay.buttons.find((b) => b.action === 'interact');
        // Drag the stick DOWN to move the caret, then tap `interact`.
        H.touchDown(1, stick.cx, stick.cy); step(2);
        H.touchMove(1, stick.cx, stick.cy + (stick.r || 80)); step(6);
        H.touchUp(1); step(2); inputs++;
        if (btn) { H.touchDown(2, btn.cx, btn.cy); step(2); H.touchUp(2); step(2); inputs++; }
        const after0 = H.getTitleState();
        return { before_selected: before.selected_id, after_selected: after0.selected_id, shown_after: after0.shown, inputs, inputs_taken: after0.inputs_taken, layout_stick: stick, layout_interact: btn || null };
      }
      const after = H.getTitleState();
      return { before_selected: before.selected_id, after_selected: after.selected_id, shown_after: after.shown, inputs, inputs_taken: after.inputs_taken };
    }, leg);
    const r = parity[leg];
    // "Completed" means the surface acted: either the caret moved or the surface closed.
    const acted = r.shown_after === false || r.after_selected !== r.before_selected;
    if (r.unmeasurable) {
      fail(`O17 ${leg}: unmeasurable — ${r.unmeasurable}. RI-JRN01 M13 is a hard fail on a leg that cannot COMPLETE; a leg that cannot be DRIVEN by a probe is a tooling gap and is reported as one, not as HF5.`);
    } else if (acted) pass(`O17 ${leg}: the title responded (${r.before_selected} -> ${r.after_selected}, shown=${r.shown_after})`);
    else { fail(`O17 ${leg}: the title did not respond to any input on this device`); hard('HF5', `the opening's first surface cannot be driven on ${leg}`); }
  }
  out.checks.o17_parity = parity;

  // ======================================================================================
  // K1 — CONSUMPTION. The save store -> the title, observed as drawn strings.
  // ======================================================================================
  say('K1 — CONSUMPTION: the save store reaches the frame (RI-MTH07 §B)');
  const k1 = await handle.page.evaluate(async () => {
    const H = window.__HARNESS;
    const read = async () => {
      await H.titleShow();
      H.renderedTextClear();
      H.renderFrame();
      const d = H.getRenderedText({ surface: 'title' });
      const st = H.getTitleState();
      return { drawn: d.distinct, continue_enabled: (st.options.find((o) => o.id === 'continue') || {}).enabled };
    };
    // Value 1: a save exists.
    const withSave = await read();
    // Null control: perturb NOTHING, observe again. A difference here would mean the
    // observable is unstable and every reading below is worthless.
    const nullControl = await read();
    // Value 2: no save. Well separated, everything else held fixed.
    for (const s of await H.listSaveSlots()) await H.deleteSaveSlot(s.slot);
    const withoutSave = await read();
    // Restore.
    await H.writeSave('slot-a');
    const restored = await read();
    return { withSave, nullControl, withoutSave, restored };
  });
  const same = (a, b) => JSON.stringify(a.drawn) === JSON.stringify(b.drawn);
  out.checks.consumption_k1 = {
    model: 'the save store (game/src/save/store.js, IndexedDB) — the one model the title surface reads',
    observable: 'the strings the title DREW, read through the rendered-text register (frame-side, not a getTitleState() return value)',
    with_save: k1.withSave, null_control_stable: same(k1.withSave, k1.nullControl),
    without_save: k1.withoutSave, restored: k1.restored,
    coupling: same(k1.withSave, k1.withoutSave) ? 0 : 1,
  };
  if (!same(k1.withSave, k1.nullControl)) fail('K1 null control: the observable changed with no perturbation — the reading is unstable and the coupling number below means nothing');
  else pass('K1 null control: perturb nothing, observe nothing');
  if (same(k1.withSave, k1.withoutSave)) fail('K1 CONSUMPTION: coupling == 0 — the title draws the same frame whether a save exists or not. The save store is an orphan model to this surface.');
  else pass('K1 CONSUMPTION: the save store changes what the player can see and what they can activate');
  if (!same(k1.withSave, k1.restored)) fail('K1 delete-the-fix: restoring the save did not restore the frame');
  else pass('K1 delete-the-fix: removing the save removes the row, restoring it brings it back');

  // ======================================================================================
  // K2 — the instrument, broken on purpose. A probe that cannot fail is worse than no probe.
  // ======================================================================================
  say('K2 — the register, broken on purpose');
  const k2 = await handle.page.evaluate(async () => {
    const H = window.__HARNESS;
    await H.titleShow();
    H.renderedTextClear(); H.renderFrame();
    const before = H.getRenderedText({ surface: 'title' }).distinct.length;
    H.titleDismiss('k2');                       // the surface is gone; nothing may be recorded
    H.renderedTextClear(); H.renderFrame();
    const after = H.getRenderedText({ surface: 'title' }).distinct.length;
    await H.titleShow();
    H.renderedTextClear(); H.renderFrame();
    const restored = H.getRenderedText({ surface: 'title' }).distinct.length;
    return { before, after, restored };
  });
  out.checks.instrument_falsification = k2;
  if (k2.before > 0 && k2.after === 0 && k2.restored === k2.before) {
    pass(`K2: the register goes red when the surface stops drawing (${k2.before} -> ${k2.after} -> ${k2.restored})`);
  } else {
    fail(`K2: the register did not falsify — before ${k2.before}, surface hidden ${k2.after}, restored ${k2.restored}. An instrument that cannot go red is not evidence.`);
  }
} finally {
  out.page_errors = handle.errors.slice(0, 6);
  await handle.close();
}

out.verdict = out.hard_fails.length ? 'HARD FAIL' : out.failures.length ? 'FAIL' : 'PASS';
say('');
say(`w1-26-opening: ${out.passes.length} pass, ${out.failures.length} fail, ${out.hard_fails.length} hard fail -> ${out.verdict}`);
const red = out.hard_fails.length || out.failures.length;
// Under `--red-team` the expected outcome is INVERTED: the sabotage must produce a failure. A
// green run means the instrument cannot see the thing it is scored on, which is the round-1
// defect itself, so it exits non-zero and says which mode slipped past.
if (redTeam) {
  const sig = RED_TEAM_SIGNATURE[redTeam] || null;
  const all = [...out.failures, ...out.hard_fails.map((h) => `${h.id} ${h.why}`)];
  const matched = sig ? all.filter((m) => m.indexOf(sig.needle) >= 0) : [];
  const ok = !!sig && matched.length > 0;
  out.red_team = {
    mode: redTeam,
    signature: sig ? sig.needle : null,
    expected: sig ? sig.what : 'UNKNOWN MODE — no signature registered',
    went_red: !!red,
    signature_matched: matched,
    unrelated_failures: all.filter((m) => !sig || m.indexOf(sig.needle) < 0),
    verdict: ok
      ? 'INSTRUMENT WENT RED ON THE SABOTAGED CHECK (good)'
      : red
        ? 'RED, BUT NOT ON THE SABOTAGED CHECK — the sabotage went undetected and the other failures are the build (bad)'
        : 'INSTRUMENT STAYED GREEN UNDER SABOTAGE (bad)',
  };
  say(`RED TEAM '${redTeam}': ${out.red_team.verdict}`);
  if (out.red_team.unrelated_failures.length) {
    say(`  (${out.red_team.unrelated_failures.length} failure(s) unrelated to this sabotage — they are the BUILD, not the red team, and are listed in the artifact)`);
  }
  writeJson(jsonPath, out);
  process.exit(ok ? 0 : 1);
}
writeJson(jsonPath, out);
log(`wrote ${path.relative(REPO_ROOT, jsonPath)}`);
process.exit(red ? 1 : 0);
