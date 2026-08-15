#!/usr/bin/env node
// dialogue-gate-g-repro.mjs — the two live defects Gate G's blind judges hit, reproduced through
// the shipped input path, and re-run after the fix (`--after`) for the delete-the-fix pair.
//
// Owner: P1 (dialogue window live defects). Binding: `corpus/00-doctrine/CRITIC-DOCTRINE.md` §1.2b
// and `orchestration/status/GATE-G-RESULT-AND-WHAT-IT-OWES.json`'s `owed_3`.
//
// WHY A NEW FILE RATHER THAN A NEW MODE INSIDE `dialogue-drive-probe.mjs`. That probe always talks
// to "whoever has the most topics" — it cannot target Neekhu or Sigurd by name, and both defects
// are specific to what THOSE two people say. This file reuses its proven shape instead: the same
// `launchGame`, the same real `KeyboardEvent`/`MouseEvent` dispatch (nothing here calls a function
// the UI also calls, nothing sets UI state directly), and the same I0 instrument check before
// trusting anything else — copied rather than imported because the original exports nothing, but
// verbatim in mechanism.
//
// EXIT 0 = both reproductions behaved as expected for this arm (defect present pre-fix, absent
// post-fix with `--after`) · 1 = a check failed · 2 = could not run.
'use strict';

import path from 'node:path';
import { launchGame } from '../lib/browser.mjs';
import { parseArgs, wantsHelp, usage, log, REPO_ROOT, ensureDir, writeJson } from '../lib/cli.mjs';

const USAGE = `
dialogue-gate-g-repro.mjs — Neekhu's dead "the carriers" link and Sigurd's duplicate "the curfew".

  --state <id>     world state to load (default: helstrom-market)
  --out <dir>      report + screenshot directory (default reports/uix08/gate-g-repro)
  --after          label the run as POST-FIX (changes only the report's own labelling)
  --revision <sha> recorded in the report for provenance; not enforced here

EXIT 0 = ran and checks match the expected arm · 1 = a check failed · 2 = could not run.
`;

const args = parseArgs();
if (wantsHelp(args)) usage(USAGE);
const OUT = path.join(REPO_ROOT, String(args.out || 'reports/uix08/gate-g-repro'));
ensureDir(OUT);
const STATE = String(args.state || 'helstrom-market');
const AFTER = !!args.after;
const TAG = AFTER ? 'after' : 'before';

const checks = [];
const push = (id, pass, detail) => {
  checks.push({ id, pass, detail });
  log(`  ${pass ? 'ok  ' : 'FAIL'} ${id}  ${detail}`);
};

const report = {
  schema: 'elder-souls/gate-g-dialogue-repro@1',
  at: new Date().toISOString(),
  commit: (process.env.GIT_COMMIT || '').slice(0, 12) || null,
  revision: args.revision ? String(args.revision) : null,
  tag: TAG, state: STATE,
  checks: [], data: {},
};

const h = await launchGame({ width: 1920, height: 1080, timeout: 300000 });
let exit = 0;

/** Real key press through the DOM — identical mechanism to `dialogue-drive-probe.mjs`'s `key()`. */
async function key(code, holdFrames = 2) {
  await h.page.evaluate((c) => {
    window.dispatchEvent(new KeyboardEvent('keydown', { code: c, key: c, bubbles: true, cancelable: true }));
  }, code);
  await h.h('stepFrames', holdFrames);
  await h.page.evaluate((c) => {
    window.dispatchEvent(new KeyboardEvent('keyup', { code: c, key: c, bubbles: true }));
  }, code);
  await h.h('stepFrames', 2);
}

/** Everything the window publishes, the same shape `dialogue-drive-probe.mjs` reads. */
async function read() {
  return h.page.evaluate(() => {
    const A = window.__HARNESS, eng = window.__ENGINE;
    const s = A.getUIState();
    const w = s.dialogue_window || null;
    return {
      open: !!(w && w.open),
      speaker: w ? w.speaker : null,
      lines: w ? w.lines_total : null,
      topics: w ? w.topics.slice() : [],
      actions: w ? w.actions.slice() : [],
      link_topics: w ? w.link_topics.slice() : [],
      links_total: w ? w.links_total : null,
      focus: w ? w.focus : null,
      blocks: w ? w.blocks.map((b) => ({ topic: b.topic, heading: b.heading, chars: b.chars })) : [],
      tail: w && w.blocks.length ? w.blocks[w.blocks.length - 1] : null,
      topics_known: A.questTopicsKnown ? A.questTopicsKnown().length : null,
      say_seq: eng._dlgSaySeq || 0,
      scrolled_to_bottom: (() => {
        const el = (s.elements || []).find((e) => e.id === 'dialogue.history');
        return el && el.meta ? el.meta.scrolled_to_bottom : null;
      })(),
    };
  });
}

/** The block's actual rendered text, read off the drawn `text[]` register rather than assumed. */
async function historyText() {
  return h.page.evaluate(() => {
    const s = window.__HARNESS.getUIState();
    const w = s.dialogue_window;
    return w ? w.text.slice() : [];
  });
}

async function shot(name) {
  await h.h('setRenderRate', 1);
  await h.h('stepFrames', 4);
  const file = path.join(OUT, `${TAG}-${name}`);
  await h.page.screenshot({ path: file });
  await h.h('setRenderRate', 0);
  return path.basename(file);
}

/** Walk the column caret to the row carrying `topicId` (present in `.topics`/`.actions`). */
async function walkColumnTo(topicId) {
  let s = await read();
  if (!s.focus || s.focus.pane !== 'column') { await key('ArrowRight'); s = await read(); }
  const idx = s.actions.includes(topicId) ? s.actions.indexOf(topicId)
    : s.actions.length + s.topics.indexOf(topicId);
  if (idx < 0) throw new Error(`'${topicId}' is not in the column: actions=${JSON.stringify(s.actions)} topics=${JSON.stringify(s.topics)}`);
  let cur = s.focus.rowIdx;
  let guard = 0;
  while (cur !== idx && guard++ < 60) {
    await key(cur < idx ? 'ArrowDown' : 'ArrowUp', 1);
    s = await read();
    cur = s.focus.rowIdx;
  }
  if (cur !== idx) throw new Error(`could not walk the column caret to '${topicId}' (stuck at row ${cur}, wanted ${idx})`);
  return s;
}

/** Walk the prose caret to the link carrying `topicId` (present in `.link_topics`). */
async function walkLinkTo(topicId) {
  let s = await read();
  if (!s.focus || s.focus.pane !== 'prose') { await key('ArrowLeft'); s = await read(); }
  const idx = s.link_topics.indexOf(topicId);
  if (idx < 0) throw new Error(`'${topicId}' is not an inline link right now: link_topics=${JSON.stringify(s.link_topics)}`);
  let cur = s.focus.linkIdx;
  let guard = 0;
  while (cur !== idx && guard++ < 60) {
    await key(cur < idx ? 'ArrowDown' : 'ArrowUp', 1);
    s = await read();
    cur = s.focus.linkIdx;
  }
  if (cur !== idx) throw new Error(`could not walk the prose caret to link '${topicId}' (stuck at ${cur}, wanted ${idx})`);
  return s;
}

try {
  await h.h('setMode', 'play-instrumented');
  await h.h('setRenderRate', 0);
  await h.h('setDevicePixelRatio', 1);
  await h.h('loadState', STATE);
  await h.h('setMode', 'play-instrumented');
  await h.h('stepFrames', 4);

  // I0, verbatim from `dialogue-drive-probe.mjs`: prove the real input path is live before
  // believing anything below it.
  const wired = await h.page.evaluate(() => {
    const eng = window.__ENGINE;
    const attached = !!(eng.real && eng.real.attached);
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowRight', key: 'ArrowRight', bubbles: true, cancelable: true }));
    const moveX = eng.input.moveX;
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'ArrowRight', key: 'ArrowRight', bubbles: true }));
    return { attached, moveX };
  });
  await h.h('stepFrames', 2);
  report.data.instrument = wired;
  push('I0 INSTRUMENT: a real DOM key reaches the input pipeline',
    wired.attached && Math.abs(wired.moveX) > 0.5,
    `real.attached=${wired.attached}, ArrowRight -> pipeline.moveX=${wired.moveX}`);
  if (!wired.attached) throw new Error('the real input listeners are not attached — nothing below this could be measured');

  // =============================================================================================
  // DEFECT 1 — Neekhu's "The carriers": a highlighted phrase that does nothing when pressed.
  // Reproduces `scratchpad/gate-g/work/quillon/shots5` (player 1, Gate G): cross to the column,
  // walk down to "latest rumors" (the rumour that names "the carriers" and fires its AddTopic
  // edge), follow it, cross back to the prose, walk to the new "the carriers" link, and follow it
  // three times exactly as the judge did.
  // =============================================================================================
  await h.page.evaluate(() => { window.__HARNESS.closeMenu(); });
  await h.page.evaluate(() => { window.__HARNESS.talkTo('agaceph-neekhu'); });
  await h.h('stepFrames', 4);
  let n0 = await read();
  report.data.defect1_opened = { speaker: n0.speaker, topics: n0.topics, actions: n0.actions };
  push('D1-0 talking to Neekhu', n0.open && n0.speaker === 'Neekhu', `speaker='${n0.speaker}', ${n0.topics.length} topic(s): ${JSON.stringify(n0.topics)}`);
  if (!n0.open) throw new Error('could not open a conversation with Neekhu');

  // The row's id is whatever `topic-supply.js#rumourFor` names it — "latest-rumors" for the root
  // topic, or the rumour's own id ("latest rumors" with a space has been observed) when a settled
  // rumour REPLACES the root row (`Conversation.sync()`'s extras-replace-root rule). Matched by
  // folded text so this does not depend on which of the two happens to be live today.
  const fold = (s) => String(s).toLowerCase().replace(/[\s-]+/g, ' ').trim();
  const rumourId = n0.topics.find((t) => fold(t) === 'latest rumors');
  if (!rumourId) {
    push('D1-1 "latest rumors" is in Neekhu\'s column', false, `topics: ${JSON.stringify(n0.topics)}`);
  } else {
    await walkColumnTo(rumourId);
    await key('KeyE');
    await h.h('stepFrames', 3);
    let n1 = await read();
    report.data.defect1_after_rumour = { topics: n1.topics, blocks: n1.blocks.length, tail: n1.tail };
    const gotCarriers = n1.topics.includes('the-carriers');
    push('D1-1 asking "latest rumors" names Neekhu\'s rumour',
      n1.blocks.length > n0.blocks.length,
      `blocks ${n0.blocks.length} -> ${n1.blocks.length}; topics now include 'the-carriers': ${gotCarriers} (${JSON.stringify(n1.topics)})`);

    if (!AFTER) {
      // PRE-FIX: the diagnosis. "the-carriers" is drawn (column AND inline link) even though
      // Neekhu (`agaceph-weir`) cannot answer it — only `mudborn`/`sapcutter` can
      // (`game/data/dialogue/topics/20-tier-a.json`). Confirm it three times and record that
      // nothing changes, matching the captured frames byte-for-byte.
      if (gotCarriers && n1.link_topics.includes('the-carriers')) {
        await walkLinkTo('the-carriers');
        const before = await read();
        const beforeText = await historyText();
        report.data.defect1_before_press = { blocks: before.blocks.length, lines: before.lines, focus: before.focus, tail: before.tail };
        const shots = [await shot('defect1-000-before-any-press.png')];
        const presses = [];
        for (let i = 1; i <= 3; i++) {
          await key('KeyE');
          await h.h('stepFrames', 3);
          const after = await read();
          const afterText = await historyText();
          shots.push(await shot(`defect1-${String(i).padStart(3, '0')}-after-press-${i}.png`));
          presses.push({
            press: i, blocks: after.blocks.length, lines: after.lines, tail: after.tail,
            topics_known: after.topics_known,
            text_changed: JSON.stringify(afterText) !== JSON.stringify(beforeText),
          });
        }
        report.data.defect1_presses = presses;
        report.data.defect1_shots = shots;
        const anyVisibleChange = presses.some((p) => p.blocks !== before.blocks.length || p.lines !== before.lines || p.text_changed);
        push('D1-2 (pre-fix) three presses on "the carriers" produce THREE IDENTICAL FRAMES — the reported defect',
          !anyVisibleChange,
          `blocks stayed at ${before.blocks.length} and lines at ${before.lines} across all 3 presses: ` +
          presses.map((p) => `#${p.press} blocks=${p.blocks} lines=${p.lines} text_changed=${p.text_changed}`).join(', '));
      } else {
        push('D1-2 (pre-fix) "the carriers" is a followable-but-dead inline link after the rumour', false,
          `topics=${JSON.stringify(n1.topics)}, link_topics=${JSON.stringify(n1.link_topics)}`);
      }
    } else {
      // POST-FIX: the correct outcome is that Neekhu never draws "the-carriers" as clickable AT
      // ALL — not a link, not a column row — because she structurally cannot answer it. The word
      // must still enter the PERMANENT index (§D1's promise), which fires on the rumour itself,
      // not on this speaker's column, so it is checked independently via `questTopicsKnown()`.
      const stillGlobal = await h.page.evaluate(() => window.__HARNESS.questTopicsKnown().includes('the-carriers'));
      report.data.defect1_after_fix = { topics: n1.topics, link_topics: n1.link_topics, still_globally_known: stillGlobal };
      push('D1-2 (post-fix) Neekhu no longer draws "the-carriers" as a column row or a link — the promise she cannot keep is not made',
        !gotCarriers && !n1.link_topics.includes('the-carriers'),
        `topics=${JSON.stringify(n1.topics)}, link_topics=${JSON.stringify(n1.link_topics)}`);
      push('D1-3 (post-fix) "the-carriers" is still in the player\'s PERMANENT vocabulary (learned off the rumour itself, not off this speaker\'s column)',
        stillGlobal, `questTopicsKnown() includes 'the-carriers': ${stillGlobal}`);
      await shot('defect1-000-fixed-neekhu-has-no-dead-link.png');
    }
  }

  // =============================================================================================
  // DEFECT 2 — pressing the same phrase twice prints the paragraph twice.
  // Reproduces `scratchpad/gate-g/work/quillon/shots4` (player 1, Gate G): talk to Sigurd, walk
  // the inline links in reading order (the Ninth Cohort -> the old imperial forts -> the curfew),
  // then confirm "the curfew" a second time — the exact sequence at shots4 steps 020/024.
  // =============================================================================================
  await h.page.evaluate(() => { window.__HARNESS.closeMenu(); });
  await h.page.evaluate(() => { window.__HARNESS.talkTo('helstrom-warder-0'); });
  await h.h('stepFrames', 4);
  let s0 = await read();
  report.data.defect2_opened = { speaker: s0.speaker, link_topics: s0.link_topics };
  push('D2-0 talking to Sigurd', s0.open && s0.speaker === 'Sigurd', `speaker='${s0.speaker}'`);
  if (!s0.open) throw new Error('could not open a conversation with Sigurd');

  // The greeting itself carries no link (`the Ninth Cohort` only exists once "background" has
  // been ANSWERED). Same as the captured session (shots4 steps 004-006): cross to the column and
  // confirm "background" there first, exactly as a player reading the greeting and picking the
  // first topic would.
  if (s0.topics.includes('background')) {
    await walkColumnTo('background');
    await key('KeyE');
    await h.h('stepFrames', 3);
  }

  // Walk every link currently offered, in reading order, exactly once each — this is what
  // produces "the ninth cohort" -> "the old imperial forts" -> "the curfew" from the greeting's
  // own background line, same as the captured session.
  const seenTopics = [];
  let guard = 0;
  while (guard++ < 12) {
    const s = await read();
    const remaining = s.link_topics.filter((t) => !seenTopics.includes(t));
    if (!remaining.length) break;
    await walkLinkTo(remaining[0]);
    await key('KeyE');
    await h.h('stepFrames', 3);
    seenTopics.push(remaining[0]);
  }
  report.data.defect2_topics_walked = seenTopics;
  const walked = await read();
  push('D2-1 walked every inline link once (background -> the ninth cohort -> its own links)',
    seenTopics.length >= 2, `followed, in order: ${JSON.stringify(seenTopics)}; blocks now ${walked.blocks.length}`);

  const lastTopic = seenTopics[seenTopics.length - 1];
  if (!lastTopic) {
    push('D2-2 the same phrase, confirmed twice, does not duplicate the paragraph', false, 'no link was ever followed');
  } else {
    // shots4 step 022: "down" while already on the LAST link — a no-op the player could not see.
    await key('ArrowDown', 1);
    const beforeSecond = await read();
    const beforeSecondText = await historyText();
    report.data.defect2_before_repeat = {
      blocks: beforeSecond.blocks.length, lines: beforeSecond.lines, focus: beforeSecond.focus, tail: beforeSecond.tail,
      caret_still_on_last_link: beforeSecond.focus && beforeSecond.focus.pane === 'prose'
        && beforeSecond.link_topics[beforeSecond.focus.linkIdx] === lastTopic,
    };
    await shot('defect2-000-before-second-press.png');
    // shots4 step 024: "follow" — the second, non-adjacent confirm of the SAME topic.
    await key('KeyE');
    await h.h('stepFrames', 3);
    const afterSecond = await read();
    const afterSecondText = await historyText();
    await shot('defect2-001-after-second-press.png');
    const matchingBlocks = afterSecond.blocks.filter((b) => b.topic === lastTopic);
    const duplicated = matchingBlocks.length >= 2
      && JSON.stringify(afterSecondText).split(JSON.stringify(afterSecondText.find((t) => matchingBlocks[0] && t))).length > 1;
    // The doctrine-relevant fact, stated plainly and independent of the fragile string match
    // above: how many blocks now carry `lastTopic`, and are their character counts identical.
    const dupCount = matchingBlocks.length;
    const dupIdentical = dupCount >= 2 && matchingBlocks[0].chars === matchingBlocks[1].chars && matchingBlocks[0].heading === matchingBlocks[1].heading;
    report.data.defect2_after_repeat = {
      blocks: afterSecond.blocks.length, lines: afterSecond.lines, tail: afterSecond.tail,
      matching_blocks_for_last_topic: matchingBlocks, dup_count: dupCount, dup_identical: dupIdentical,
    };
    if (!AFTER) {
      push(`D2-2 (pre-fix) confirming '${lastTopic}' a second (non-adjacent) time appends a BYTE-IDENTICAL duplicate paragraph — the reported defect`,
        dupCount >= 2 && dupIdentical,
        `'${lastTopic}' now has ${dupCount} block(s) in history; identical heading+length: ${dupIdentical} ` +
        `(${JSON.stringify(matchingBlocks)})`);
    } else {
      push(`D2-2 (post-fix) confirming '${lastTopic}' a second time no longer appends a byte-identical duplicate`,
        !(dupCount >= 2 && dupIdentical),
        `'${lastTopic}' now has ${dupCount} block(s) in history; identical heading+length: ${dupIdentical}`);
      // KNOWN, ACCEPTED RESIDUAL: a re-ask of the topic that is ALREADY the current last block,
      // in a conversation short enough to need no scrolling, is a genuine no-op on every published
      // field — the answer was already at the bottom of the pane before the second press, so there
      // is nothing for the fix to visibly change. Recorded plainly rather than hidden.
      const noopOnScreen = afterSecond.lines === beforeSecond.lines && afterSecond.blocks.length === beforeSecond.blocks.length
        && JSON.stringify(afterSecondText) === JSON.stringify(beforeSecondText);
      report.data.defect2_residual_short_conversation_noop = noopOnScreen;
      log(`  note D2-2b: on this short conversation the second confirm is a no-op on screen (${noopOnScreen}) — see D2-3 for the scrolled-away case`);

      // D2-3 — the case where the fix's scroll-reset actually matters: the player scrolled AWAY
      // from the bottom to re-read earlier answers, then re-asks the topic that is still the
      // current last block. §D3 promises the history is "scrolled to the bottom"; confirm the
      // SAME real input (`KeyE` on the still-focused link) now visibly returns the player to it,
      // rather than leaving them stranded mid-scroll with no sign their press did anything.
      //
      // At 1920x1080 this conversation is short enough that `maxScroll` is 0 and there is
      // nothing to scroll away FROM (`dialogueScroll` clamps back to 0 regardless of what it is
      // set to) — that was tried first and could not build the precondition. A short, sharply
      // shorter viewport forces real overflow without changing which topics get asked or how.
      const hs = await launchGame({ width: 900, height: 320, timeout: 300000 });
      try {
        await hs.h('setMode', 'play-instrumented');
        await hs.h('setRenderRate', 0);
        await hs.h('setDevicePixelRatio', 1);
        await hs.h('loadState', STATE);
        await hs.h('setMode', 'play-instrumented');
        await hs.h('stepFrames', 4);
        const readS = () => hs.page.evaluate(() => {
          const s = window.__HARNESS.getUIState();
          const w = s.dialogue_window || null;
          const el = (s.elements || []).find((e) => e.id === 'dialogue.history');
          return {
            open: !!(w && w.open), focus: w ? w.focus : null,
            topics: w ? w.topics.slice() : [], actions: w ? w.actions.slice() : [],
            link_topics: w ? w.link_topics.slice() : [], blocks: w ? w.blocks.length : 0,
            scrolled_to_bottom: el && el.meta ? el.meta.scrolled_to_bottom : null,
          };
        });
        const keyS = async (code, holdFrames = 2) => {
          await hs.page.evaluate((c) => window.dispatchEvent(new KeyboardEvent('keydown', { code: c, key: c, bubbles: true, cancelable: true })), code);
          await hs.h('stepFrames', holdFrames);
          await hs.page.evaluate((c) => window.dispatchEvent(new KeyboardEvent('keyup', { code: c, key: c, bubbles: true })), code);
          await hs.h('stepFrames', 2);
        };
        await hs.page.evaluate(() => { window.__HARNESS.talkTo('helstrom-warder-0'); });
        await hs.h('stepFrames', 4);
        // Same as the main D2 flow: the greeting carries no link, so "background" has to be
        // confirmed from the column first before any inline link exists to walk. Navigated by
        // topic id, not by a blind row-index guess — row 0 is the "Persuasion" ACTION, not the
        // first topic.
        let s = await readS();
        if (s.topics.includes('background')) {
          await keyS('ArrowRight');
          let cur = (await readS()).focus.rowIdx;
          const target = s.actions.length + s.topics.indexOf('background');
          while (cur !== target) { await keyS(cur < target ? 'ArrowDown' : 'ArrowUp', 1); cur = (await readS()).focus.rowIdx; }
          await keyS('KeyE');
          await keyS('ArrowLeft');
        }
        s = await readS();
        const walkedS = [];
        let guardS = 0;
        while (guardS++ < 8) {
          s = await readS();
          const remaining = s.link_topics.filter((t) => !walkedS.includes(t));
          if (!remaining.length) break;
          const target = s.link_topics.indexOf(remaining[0]);
          let cur = s.focus ? s.focus.linkIdx : 0;
          while (cur !== target) { await keyS(cur < target ? 'ArrowDown' : 'ArrowUp', 1); s = await readS(); cur = s.focus.linkIdx; }
          await keyS('KeyE');
          walkedS.push(remaining[0]);
        }
        const beforeScroll = await readS();
        // Precondition ONLY: a player who scrolled up. The confirm under test, and the check,
        // are both the real `KeyE` press below — same pattern `A.talkTo()` already uses to reach
        // a conversation without that itself being under test.
        await hs.page.evaluate(() => { window.__ENGINE.ui.dialogueScroll = 999; window.__ENGINE.ui.builtFrame = -1; });
        await hs.h('stepFrames', 2);
        const scrolledAway = await readS();
        await keyS('KeyE');
        const afterScrolledReask = await readS();
        report.data.defect2_scroll_reset = {
          topics_walked: walkedS, before_scroll: beforeScroll.scrolled_to_bottom,
          scrolled_away: scrolledAway.scrolled_to_bottom, after_reask: afterScrolledReask.scrolled_to_bottom,
        };
        push('D2-3 (post-fix) re-asking the last-block topic WHILE SCROLLED AWAY snaps back to the bottom — a real, visible effect from the same confirm',
          scrolledAway.scrolled_to_bottom === false && afterScrolledReask.scrolled_to_bottom === true,
          `topics walked: ${JSON.stringify(walkedS)}; scrolled_to_bottom: ${scrolledAway.scrolled_to_bottom} ` +
          `(after manual scroll-up, maxScroll was reachable) -> ${afterScrolledReask.scrolled_to_bottom} (after real KeyE)`);
      } finally {
        await hs.close();
      }
    }
  }

  report.checks = checks;
  report.data.errors = h.errors ? h.errors.slice(0, 10) : [];
  writeJson(path.join(OUT, `${TAG}.json`), report);
  exit = checks.every((c) => c.pass) ? 0 : 1;
  log(`\n${checks.filter((c) => c.pass).length}/${checks.length} checks passed (${TAG})`);
} catch (e) {
  log(`could not run: ${e && e.message || e}`);
  report.error = String(e && e.stack || e);
  report.checks = checks;
  writeJson(path.join(OUT, `${TAG}.json`), report);
  exit = 2;
} finally {
  await h.close();
}
process.exit(exit);
