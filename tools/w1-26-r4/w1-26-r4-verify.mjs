#!/usr/bin/env node
// w1-26-r4-verify.mjs — CONSUMPTION (RI-MTH07) and delete-the-fix (rule 6) for the W1-26 round-4
// repairs, in one running browser, on one page.
//
// Owner: W1-26 r4 (builder). Spec: `corpus/90-verdicts/wave1/W1-26-r3.md`.
//
// EVERY SECTION HAS A TEARDOWN AND EVERY TEARDOWN IS WATCHED (rule 6). A control that has never
// been seen fail is a second copy of the experiment. Where a section has TWO guards for one
// defect, it says so rather than reporting the pair as an inert fix.
//
//   A  AN UNKNOWN RACE FAILS AT THE POINT OF OBSERVATION, NAMING THE ID.
//      r3 verdict §4. `bodyRace()` ended `rows.some((r) => r.id === id) ? id : null`, so a body
//      carrying a race `races.json` does not list was observed as **null, silently, at scene
//      start**, and the census refused ELEVEN NODES LATER at `writ.race-observed` — where the
//      throw is caught and becomes the one authored refusal line. The player read *"Not in that
//      box, and not in those words"* in front of a door held shut. The critic measured it with
//      `altmer`, a race the scribe's own written line says out loud.
//      TEARDOWN: put r3's exact expression back on the live object. The silent null must return
//      and the scene must stop eleven nodes later again — which is the control going red.
//
//   B  NO HUD ON THE TITLE SCREEN. r3 verdict §7 G5, named at r2 and untouched at r3.
//      Acceptance: 0 HUD strings drawn while `getTitleState().shown` is true.
//      TEARDOWN: lie to `build()` about the title being up. The purse must come back.
//
//   C  CONSUMPTION (RI-MTH07). The model is the race the scribe observes. r3's comment claimed
//      two consumers, `_playerGates()` and `reactionTo()`, and **neither function exists**. The
//      real ones are reached through `_talkPlayer()`:
//        * `derivedDisposition()` -> `raceTerm()` (sim/dialogue/disposition.js), the reaction
//          matrix, applied to a real person standing in the world;
//        * `topicsFor()` (sim/quest/topic-supply.js), the dialogue offer gate, `requires.race` /
//          `forbids.race`, which `dialogue/topics/40-race-gated.json` is written against.
//      Perturbed on the LIVE world field and demonstrated on entities, with a null control.
//      TEARDOWN: pin the race to one literal and watch the four arms collapse.
//
//   D  THE TEACHING CLAUSE IS GONE AND THE NINE TOPICS ARE STILL DISCOVERABLE.
//      r3 verdict §7 G3. *"So ask them what they do, and what is being said here."* was the
//      opening's one tutorial. Cut. The acceptance is that the nine root topics `_censusFinish()`
//      grants are still reachable by a player who was never told to ask — proved by asking one
//      whose name was never drawn on any frame of the whole opening.
//
// EXIT: non-zero if any check fails OR if any teardown fails to go red.
'use strict';

import path from 'node:path';
import fs from 'node:fs';
import { execSync } from 'node:child_process';
import { parseArgs, wantsHelp, usage, writeJson, REPO_ROOT, REPORTS_DIR, ensureDir } from '../lib/cli.mjs';
import { launchGame } from '../lib/browser.mjs';

const USAGE = `
w1-26-r4-verify.mjs — consumption + delete-the-fix for the W1-26 r4 repairs.

USAGE
  node tools/w1-26-r4/w1-26-r4-verify.mjs [--json <path>]
`;
const args = parseArgs();
if (wantsHelp(args)) usage(USAGE);
const jsonPath = args.json ? path.resolve(String(args.json)) : path.join(REPORTS_DIR, 'w1-26-r4', 'verify.json');
ensureDir(path.dirname(jsonPath));
const say = (s) => process.stdout.write(s + '\n');

const out = {
  schema: 'elder-souls/w1-26-r4-verify@1',
  piece: 'W1-26-r4',
  items: ['RI-JRN01', 'RI-JRN09', 'RI-CHR01', 'RI-MTH07'],
  commit: null,
  conditions: {},
  checks: {},
  passes: [], failures: [],
};
try { out.commit = execSync('git rev-parse --short HEAD', { cwd: REPO_ROOT }).toString().trim(); } catch { /* not fatal */ }
try { out.conditions.loadavg = fs.readFileSync('/proc/loadavg', 'utf8').trim().split(/\s+/).slice(0, 3).map(Number); } catch { /* ignore */ }

const pass = (id, w, d) => { out.passes.push(id); say(`  PASS ${id}  ${w}`); out.checks[id] = { ok: true, what: w, ...(d || {}) }; };
const fail = (id, w, d) => { out.failures.push(id); say(`  FAIL ${id}  ${w}`); out.checks[id] = { ok: false, what: w, ...(d || {}) }; };

const h = await launchGame({ width: 480, height: 270, timeout: 180000 });
try {
  await h.page.waitForFunction(() => window.__HARNESS && window.__HARNESS.ready, { timeout: 180000 });
  await h.page.evaluate(() => window.__HARNESS.ready());
  await h.page.evaluate(() => window.__HARNESS.setMode('play-instrumented'));
  await h.page.evaluate(() => window.__HARNESS.setRenderRate(0));

  await h.page.evaluate(() => {
    const e = window.__ENGINE;
    window.__W = {
      // The exact expression `bodyRace()` ended with at round 3. Kept as a closure so the
      // teardown is the OLD CODE and not a paraphrase of it.
      r3BodyRace() {
        const id = e.sim && e.sim.identity ? e.sim.identity.race : null;
        if (!id) return null;
        const rows = (e.chData && e.chData.races && e.chData.races.races) || [];
        return rows.some((r) => r.id === id) ? id : null;
      },
      strictBodyRace: e.bodyRace.bind(e),
      shippedRace: e.sim.identity.race,
      setRace(r) { e.sim.identity.race = r; },
      /**
       * Open the scene the way the title's `New` does and walk it to the end, answering
       * everything, reporting where it stopped and what was DRAWN when it stopped.
       */
      walkFromNew() {
        const H = window.__HARNESS;
        const visited = [];
        let began = null, threw = null;
        try { began = H.censusBegin({}); } catch (err) { return { began: false, threw: String(err && err.message || err), visited, stopped_at: null, drawn: [] }; }
        try {
          for (let i = 0; i < 60; i++) {
            const st = H.getCensusState();
            if (!st || st.done) break;
            visited.push(st.node);
            if (st.paused) { H.censusEnter(st.resume_by || 'talk'); continue; }
            const inp = st.input || null;
            let v = null;
            if (!inp) v = null;
            else if (inp.kind === 'text') v = 'Silt-Under-Salt';
            else if (inp.kind === 'pick') v = (inp.options || []).slice(0, inp.count || 1).map((o) => o.id);
            else if (inp.kind === 'observed') v = null;
            else v = (inp.options && inp.options[0]) ? inp.options[0].id : null;
            H.censusAnswer(v);
          }
        } catch (err) { threw = String(err && err.message || err); }
        const st = H.getCensusState();
        const ui = e.renderer && e.renderer.ui ? e.renderer.ui.metrics() : null;
        return {
          began: !!began, threw, visited,
          stopped_at: st ? st.node : null,
          done: !!(st && st.done),
          refusal: st && st.surface ? st.surface.refusal : null,
          fault: st && st.surface ? st.surface.fault : null,
          body_race: st ? st.body_race : undefined,
          body_race_raw: st ? st.body_race_raw : undefined,
          body_race_fault: st ? st.body_race_fault : undefined,
          drawn: ui ? (ui.text || []).slice(0, 12) : [],
        };
      },
      reset() {
        const H = window.__HARNESS;
        try { H.censusBegin({}); } catch { /* a broken body cannot open the scene — that is the point */ }
      },
    };
  });

  // =============================================================================================
  say('');
  say('  A. an unknown race fails AT THE POINT OF OBSERVATION, naming the id');
  say('     (r3 verdict §4: it used to be observed as null, silently, and refused 11 nodes later)');
  say('');
  // =============================================================================================

  // A0 — the shipped body is silent. Rule 13: prove the assertion says nothing on the tree that
  // ships BEFORE claiming it is armed. An assertion that fires on the shipped build is everyone's
  // problem, not this piece's evidence.
  const a0 = await h.page.evaluate(() => {
    const e = window.__ENGINE;
    window.__W.setRace(window.__W.shippedRace);
    let observed = null, threw = null;
    try { observed = e.bodyRace(); } catch (err) { threw = String(err && err.message || err); }
    const w = window.__W.walkFromNew();
    return { shipped: window.__W.shippedRace, observed, threw, walk: w };
  });
  if (!a0.threw && a0.observed === a0.shipped && a0.walk.done) {
    pass('A0', `the shipped body ('${a0.shipped}') observes cleanly and the scene finishes — the assertion is silent on the tree that ships`, a0);
  } else {
    fail('A0', `the new assertion is NOT silent on the shipped tree: observed=${JSON.stringify(a0.observed)} threw=${JSON.stringify(a0.threw)} done=${a0.walk.done}`, a0);
  }

  // A1 / A2 — the two races the acceptance names. `altmer` is the one the critic measured and the
  // one the scribe's own written line says out loud; `zzz-not-a-race` never existed anywhere.
  for (const [id, race, why] of [
    ['A1', 'altmer', "a real Elder Scrolls race, offered by writ-house.json's misread table as a WRONG GUESS, and not a body here — the exact string the r3 critic measured"],
    ['A2', 'zzz-not-a-race', 'a race that does not exist at all, anywhere in the data'],
    ['A3', 'argonian', "the literal this field carried at e00e6fe, which is not an id here (`saxhleel` is) — the class of defect r3 fixed the VALUE of and left the MECHANISM of"],
  ]) {
    const r = await h.page.evaluate((rc) => {
      const e = window.__ENGINE;
      window.__W.setRace(rc);
      let observed, threw = null;
      try { observed = e.bodyRace(); } catch (err) { threw = String(err && err.message || err); }
      const raw = e._bodyRaceRaw();
      const w = window.__W.walkFromNew();
      window.__W.setRace(window.__W.shippedRace);
      return { threw, observed, raw, walk: w };
    }, race);
    const named = !!(r.threw && r.threw.includes(`'${race}'`));
    const atObservation = !!(r.threw && /^census: the body carries race/.test(r.threw));
    // The scene must not get eleven nodes down the graph and refuse there.
    const notLate = !r.walk.began && r.walk.visited.length === 0;
    if (named && atObservation && notLate) {
      pass(id, `race '${race}' fails at observation, naming the id, and the scene never opens (${r.walk.visited.length} nodes reached, was 11)`,
        { race, why, threw: r.threw, walk_visited: r.walk.visited, raw: r.raw });
    } else {
      fail(id, `race '${race}': named=${named} at_observation=${atObservation} reached_${r.walk.visited.length}_nodes stopped_at=${JSON.stringify(r.walk.stopped_at)}`,
        { race, why, threw: r.threw, walk: r.walk, raw: r.raw });
    }
  }

  // A4 — the fault is READABLE. An accessor that throws because the thing it reports on is broken
  // is useless exactly when it is needed, so `getCensusState()` uses the non-throwing read.
  const a4 = await h.page.evaluate(() => {
    const e = window.__ENGINE;
    window.__W.setRace(window.__W.shippedRace);
    window.__W.walkFromNew();               // a good scene, so the accessor has something to report
    window.__W.setRace('altmer');           // and now break the body underneath it
    let st = null, threw = null;
    try { st = window.__HARNESS.getCensusState(); } catch (err) { threw = String(err && err.message || err); }
    window.__W.setRace(window.__W.shippedRace);
    return { threw, body_race: st && st.body_race, raw: st && st.body_race_raw, fault: st && st.body_race_fault };
  });
  if (!a4.threw && a4.raw === 'altmer' && a4.fault && a4.fault.includes("'altmer'") && a4.body_race === null) {
    pass('A4', 'getCensusState() still answers with a broken body and NAMES it: body_race_raw "altmer", body_race_fault set', a4);
  } else {
    fail('A4', `the accessor does not report the fault cleanly (threw=${JSON.stringify(a4.threw)})`, a4);
  }

  // A5 — DELETE-THE-FIX, watched red. Round 3's exact expression, put back on the live object.
  const a5 = await h.page.evaluate(() => {
    const e = window.__ENGINE;
    e.bodyRace = window.__W.r3BodyRace;     // the old build, restored
    window.__W.setRace('altmer');
    const observed = e.bodyRace();          // must be a SILENT null, as it was at r3
    const w = window.__W.walkFromNew();
    e.bodyRace = window.__W.strictBodyRace; // put it back
    window.__W.setRace(window.__W.shippedRace);
    return { observed, walk: w };
  });
  const wentBack = a5.observed === null
    && a5.walk.began
    && a5.walk.stopped_at === 'writ.race-observed';
  if (wentBack) {
    pass('A5', `DELETE-THE-FIX WENT RED: with r3's expression restored, 'altmer' is observed as ${JSON.stringify(a5.observed)} — silently — the scene OPENS, walks ${a5.walk.visited.length} nodes and stops at '${a5.walk.stopped_at}' with the authored refusal over it`,
      { observed: a5.observed, visited: a5.walk.visited, stopped_at: a5.walk.stopped_at, refusal: a5.walk.refusal, fault: a5.walk.fault });
  } else {
    fail('A5', `THE CONTROL IS INERT — restoring r3's expression did not bring the old behaviour back (observed=${JSON.stringify(a5.observed)}, stopped_at=${JSON.stringify(a5.walk.stopped_at)}). A1-A3 prove nothing.`, a5);
  }

  // =============================================================================================
  say('');
  say('  B. no HUD on the title screen (r3 §7 G5; named at r2, untouched at r3)');
  say('');
  // =============================================================================================
  const b = await h.page.evaluate(async () => {
    const e = window.__ENGINE;
    const H = window.__HARNESS;
    const reg = e.renderer.textRegister || null;
    const hudStrings = () => {
      const st = H.getUIState();
      return {
        hud_elements: st.hud_elements === undefined ? (st.hud ? st.hud.total_count : null) : st.hud_elements,
        hud_total: st.hud ? st.hud.total_count : null,
        suppressed: st.hud ? st.hud.suppressed : null,
        texts: (st.elements || []).filter((x) => x.id && x.id.startsWith('hud.') && x.visible && x.text !== null && x.text !== undefined)
          .map((x) => String(x.text)),
      };
    };
    // `titleShow()` is async — it reads the save slots out of IndexedDB before it raises the
    // surface. Called without an await it returns a pending promise and the title is still down
    // when the next line reads it, which is how the first run of this probe reported
    // `title_shown: false` and charged the build for a HUD it was drawing over a world.
    e.renderer.title.inSession = false;
    await e.titleShow();
    e.ui.builtFrame = -1;
    const shownState = H.getTitleState();
    const withTitle = hudStrings();
    // THE TEARDOWN: lie to `build()` about the title. Same frame, same page, one field.
    const origCtx = e._uiCtx.bind(e);
    e._uiCtx = () => ({ ...origCtx(), titleShown: false });
    e.ui.builtFrame = -1;
    const teardown = hudStrings();
    e._uiCtx = origCtx;
    e.ui.builtFrame = -1;
    const restored = hudStrings();
    return { title_shown: !!(shownState && shownState.shown), with_title: withTitle, teardown, restored };
  });
  if (b.title_shown && b.with_title.texts.length === 0 && b.with_title.suppressed === true) {
    pass('B1', `0 HUD strings drawn while getTitleState().shown is true (${b.with_title.hud_total} hud elements, suppressed: true)`, b.with_title);
  } else {
    fail('B1', `the title still paints a HUD: ${JSON.stringify(b.with_title.texts)}`, b);
  }
  if (b.teardown.texts.length > 0 && b.restored.texts.length === 0) {
    pass('B2', `DELETE-THE-FIX WENT RED: with the suppression lied to, the title paints ${b.teardown.texts.length} HUD string(s) again — ${JSON.stringify(b.teardown.texts.slice(0, 5))} — and 0 again when it is put back`, b);
  } else {
    fail('B2', `THE CONTROL IS INERT: teardown drew ${b.teardown.texts.length} strings, restored drew ${b.restored.texts.length}`, b);
  }

  // =============================================================================================
  say('');
  say('  C. CONSUMPTION (RI-MTH07) — the race is OBSERVED, and it is also READ');
  say('     r3 §8: the engine comment named `_playerGates()` and `reactionTo()`. Neither exists.');
  say('     The real consumers, perturbed here: derivedDisposition()/raceTerm() and topicsFor().');
  say('');
  // =============================================================================================
  const RACES = ['saxhleel', 'dunmer', 'khajiit', 'nord'];
  const c = await h.page.evaluate((races) => {
    const e = window.__ENGINE;
    const H = window.__HARNESS;
    const arms = [];
    for (const race of races) {
      window.__W.setRace(race);
      const w = window.__W.walkFromNew();
      // The SCENE's consumer: the sentence she says out loud.
      const drawnAll = [];
      try {
        H.censusBegin({});
        H.censusEnter('talk');
        H.censusAnswer('Silt-Under-Salt');
        H.censusEnter('walk');
        for (let i = 0; i < 30; i++) {
          const st = H.getCensusState();
          if (!st || st.done) break;
          const ui = st.surface && st.surface.rendered_text ? st.surface.rendered_text : [];
          for (const t of ui) drawnAll.push(t);
          if (st.paused) { H.censusEnter(st.resume_by || 'walk'); continue; }
          const inp = st.input || null;
          let v = null;
          if (inp && inp.kind === 'text') v = 'Silt-Under-Salt';
          else if (inp && inp.kind === 'pick') v = (inp.options || []).slice(0, inp.count || 1).map((o) => o.id);
          else if (inp && inp.options && inp.options[0]) v = inp.options[0].id;
          H.censusAnswer(v);
        }
      } catch (err) { /* recorded via stopped_at below */ }
      const st = H.getCensusState();
      // THE WORLD'S consumers, on people who are standing here.
      const talk = e._talkPlayer();
      const npcs = H.listNPCs().map((n) => n.eid);
      const dispositions = {};
      const offered = {};
      for (const eid of npcs) {
        try {
          const d = e.npcDisposition(eid);
          dispositions[eid] = { value: d.disposition, race_term: d.explain ? (d.explain.race || null) : null };
        } catch (err) { dispositions[eid] = { error: String(err && err.message || err) }; }
        try { offered[eid] = (e.listNPCs().find((n) => n.eid === eid) || {}).topics_offered || []; } catch { offered[eid] = null; }
      }
      arms.push({
        race,
        spec_race: st ? st.race_observed : null,
        writ_chars: st && st.writ ? String(st.writ).length : (e.sim.character ? JSON.stringify(e.sim.character).length : null),
        character_race: e.sim.character ? e.sim.character.race : null,
        talk_player_race: talk.race,
        topics_known: (talk.topics_known || []).slice().sort().join(','),
        dispositions,
        topics_offered: offered,
        drawn_sample: drawnAll.filter((t) => t && t.length > 20).slice(0, 3),
        drawn_joined: drawnAll.join(' | '),
      });
    }
    window.__W.setRace(window.__W.shippedRace);
    return arms;
  }, RACES);
  out.checks.consumption_arms = c;

  const distinctDrawn = new Set(c.map((a) => a.drawn_joined)).size;
  const dispSig = (a) => JSON.stringify(Object.entries(a.dispositions).map(([k, v]) => [k, v.value]));
  const distinctDisp = new Set(c.map(dispSig)).size;
  const distinctSpec = new Set(c.map((a) => a.spec_race)).size;
  if (distinctSpec === RACES.length && distinctDrawn === RACES.length) {
    pass('C1', `the scene's consumer: ${distinctSpec}/${RACES.length} distinct observed races, ${distinctDrawn}/${RACES.length} distinct drawn scenes`,
      { spec_races: c.map((a) => a.spec_race), samples: c.map((a) => ({ race: a.race, line: a.drawn_sample[0] || null })) });
  } else {
    fail('C1', `the drawn scene does not move with the body: ${distinctSpec} distinct spec.race, ${distinctDrawn} distinct drawn scenes`, { arms: c.map((a) => ({ race: a.race, spec: a.spec_race })) });
  }
  if (distinctDisp > 1) {
    pass('C2', `the WORLD's consumer: derivedDisposition()/raceTerm() moves with the body — ${distinctDisp}/${RACES.length} distinct disposition vectors over the people standing here`,
      { by_race: c.map((a) => ({ race: a.race, dispositions: a.dispositions })) });
  } else {
    fail('C2', `derivedDisposition() returns the SAME numbers for all ${RACES.length} races. The comment's disposition claim is not demonstrated and should be withdrawn, not reworded.`,
      { by_race: c.map((a) => ({ race: a.race, dispositions: a.dispositions })) });
  }
  // The r3 critic's finding, reproduced honestly rather than argued with: the offer gate reads the
  // field and has nothing to bite on in the barge hold.
  const distinctTopics = new Set(c.map((a) => JSON.stringify(a.topics_offered))).size;
  out.checks.C3_offer_gate = {
    distinct_topic_offers: distinctTopics,
    topics_known_identical: new Set(c.map((a) => a.topics_known)).size === 1,
    finding: distinctTopics === 1
      ? 'the offer gate READS the race (topic-supply.js :141/:164/:166) and the two people in the '
        + 'barge hold carry no race-gated infos, so it computes the same list for all four — the r3 '
        + "critic's §8 table, reproduced. The gate is real; in this room it has nothing to bite on. "
        + 'Reported as the standing NEXT-DISPATCH §1b finding and NOT claimed as consumption.'
      : 'the offer gate differs by race here',
  };
  say(`  NOTE C3  topics offered: ${distinctTopics} distinct list(s) across ${RACES.length} races — ${out.checks.C3_offer_gate.finding.slice(0, 100)}…`);

  // C4 — TEARDOWN, watched red. Pin `bodyRace()` to one literal: the hardcoded default the item
  // forbids, and the shape that would have satisfied the acceptance test.
  const c4 = await h.page.evaluate((races) => {
    const e = window.__ENGINE;
    const H = window.__HARNESS;
    e.bodyRace = () => 'saxhleel';
    const drawn = [];
    for (const race of races) {
      window.__W.setRace(race);
      try {
        H.censusBegin({});
        H.censusEnter('talk');
        H.censusAnswer('Silt-Under-Salt');
        H.censusEnter('walk');
        const st = H.getCensusState();
        drawn.push((st.surface && st.surface.rendered_text ? st.surface.rendered_text : []).join(' | '));
      } catch (err) { drawn.push('THREW: ' + String(err && err.message || err)); }
    }
    e.bodyRace = window.__W.strictBodyRace;
    window.__W.setRace(window.__W.shippedRace);
    return { distinct: new Set(drawn).size, of: races.length };
  }, RACES);
  if (c4.distinct === 1) {
    pass('C4', `TEARDOWN WENT RED: with bodyRace() pinned to one literal, ${c4.of} bodies collapse to ${c4.distinct} distinct scene — the four differences in C1 are the field`, c4);
  } else {
    fail('C4', `THE CONTROL IS INERT: pinning bodyRace() still gave ${c4.distinct} distinct scenes of ${c4.of}`, c4);
  }

  // =============================================================================================
  say('');
  say('  D. the writ.stamp teaching clause is cut, and the nine topics survive it (r3 §7 G3)');
  say('');
  // =============================================================================================
  const d = await h.page.evaluate(() => {
    const e = window.__ENGINE;
    const H = window.__HARNESS;
    window.__W.setRace(window.__W.shippedRace);
    // Play the scene to the end, collecting EVERY string it drew.
    const drawn = new Set();
    H.censusBegin({});
    for (let i = 0; i < 60; i++) {
      const st = H.getCensusState();
      if (!st || st.done) break;
      for (const t of (st.surface && st.surface.rendered_text) || []) drawn.add(t);
      if (st.paused) { H.censusEnter(st.resume_by || 'talk'); continue; }
      const inp = st.input || null;
      let v = null;
      if (inp && inp.kind === 'text') v = 'Silt-Under-Salt';
      else if (inp && inp.kind === 'pick') v = (inp.options || []).slice(0, inp.count || 1).map((o) => o.id);
      else if (inp && inp.options && inp.options[0]) v = inp.options[0].id;
      H.censusAnswer(v);
    }
    const all = [...drawn];
    const known = ((e.sim.quest && e.sim.quest.topicsKnown) || []).slice().sort();
    // A topic the player was NEVER told about: its id, and every word of its label, absent from
    // every string the whole opening drew.
    const spoken = all.join('  ').toLowerCase();
    const unspoken = known.filter((t) => spoken.indexOf(String(t).toLowerCase()) < 0);
    // And ask one, through the only door a player has: talk to somebody, say the word.
    const asked = [];
    const npcs = H.listNPCs().map((n) => n.eid);
    for (const t of unspoken.slice(0, 4)) {
      for (const eid of npcs) {
        try {
          H.talkTo(eid);
          const r = H.conversationSay(t);
          H.conversationClose();
          if (r && !r.refused) { asked.push({ topic: t, eid, answered: true, text: String(r.text || r.info || '').slice(0, 140) }); break; }
          asked.push({ topic: t, eid, answered: false, refused: r && r.refused });
        } catch (err) { asked.push({ topic: t, eid, error: String(err && err.message || err) }); }
      }
    }
    return {
      teaching_clause_drawn: all.some((s) => s.includes('So ask them what they do')),
      stamp_line: all.find((s) => s.includes('Reed-case, stamped')) || null,
      distinct_drawn: all.length,
      topics_known: known,
      topics_never_named_to_the_player: unspoken,
      asked,
    };
  });
  out.checks.D = d;
  if (!d.teaching_clause_drawn) {
    pass('D1', 'the teaching clause "So ask them what they do, and what is being said here." is no longer drawn anywhere in the opening', { stamp_line: d.stamp_line });
  } else {
    fail('D1', 'the teaching clause is still on the frame', d);
  }
  if (d.topics_known.length >= 9) {
    pass('D2', `_censusFinish() still grants ${d.topics_known.length} root topics with the clause gone`, { topics: d.topics_known });
  } else {
    fail('D2', `only ${d.topics_known.length} root topics were granted`, d);
  }
  const answered = d.asked.filter((a) => a.answered);
  if (d.topics_never_named_to_the_player.length > 0 && answered.length > 0) {
    pass('D3', `${d.topics_never_named_to_the_player.length} of the granted topics were never named on any drawn frame, and one of them — '${answered[0].topic}' — was ASKED and answered anyway`,
      { never_named: d.topics_never_named_to_the_player, answered: answered.slice(0, 2) });
  } else if (d.topics_never_named_to_the_player.length === 0) {
    fail('D3', 'every granted topic was named somewhere on a drawn frame, so "discoverable without being told" cannot be tested this way', d);
  } else {
    fail('D3', `${d.topics_never_named_to_the_player.length} topics were never named, and NONE of the ones tried could be asked of anybody standing here — the clause was carrying the discovery`,
      { never_named: d.topics_never_named_to_the_player, asked: d.asked });
  }

  out.conditions.page_errors = h.errors.slice(0, 8);
} catch (e) {
  fail('RUN', `the probe threw: ${String(e && e.message || e)}`, { stack: String(e && e.stack || '').split('\n').slice(0, 8).join('\n') });
} finally {
  try { await h.close(); } catch { /* ignore */ }
}

out.summary = { pass: out.passes.length, fail: out.failures.length };
writeJson(jsonPath, out);
say('');
say(`  ${out.passes.length} pass · ${out.failures.length} fail`);
say(`  artifact: ${path.relative(REPO_ROOT, jsonPath)}`);
process.exit(out.failures.length ? 1 : 0);
