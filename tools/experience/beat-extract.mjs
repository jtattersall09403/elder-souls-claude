#!/usr/bin/env node
// beat-extract.mjs — RI-EXP01 step 2: scan a session trace for the beat signatures.
//
// Named by: RI-EXP01 step 2, verbatim:
//   tools/experience/beat-extract.mjs --in reports/sessions/<id>
//   "scans `trace.jsonl` for the beat signatures below and emits `beat-log.json`, one record per
//    detected beat with {beat_id, f, t_min, evidence:[trace line numbers], confidence}."
//
// NOT THE SAME TOOL as tools/journey/beat-extract.mjs. That one produces a blind PACK from a
// journey run (RI-MTH06 §C). This one produces a beat LOG from a session trace, against
// RI-EXP01 §D's signature table. Both are named by the corpus, separately, and both exist.
//
// THE SIGNATURE TABLE IS THE SPEC. RI-EXP01 step 2 gives eleven beat classes and the trace
// signature for each. They are implemented below one function per class, each carrying the
// item's own wording in a comment, so a critic can check the implementation against the item
// without reading the whole file.
//
// EVIDENCE IS MANDATORY. Every detection carries the trace LINE NUMBERS that produced it, so a
// reader can go and look. A beat asserted with no evidence line is not a detection, and this
// tool will not emit one.
//
// ===============================================================================================
// ROUND 4 REBUILD. TOOL-COVERAGE-R3 §2: "Accepted 8/8 by R1 and again by R2. It has never worked
// on a real trace."
//
// The defect was one character. Line 111 read `const f = r.frame ?? 0`, and every record in
// every shipped trace is keyed `f` (game/src/sim/record.js:51). So on every real session:
//
//   * every beat was stamped f:0, t_min:0 — and beat-diff.mjs compares beat logs BY TIME;
//   * `f - t.frame <= 30 * fps` became `0 - 0 <= 1800`, PERMANENTLY TRUE, so the hedged
//     confidence-0.7 "previously mentioned" verdict was promoted to a confidence-1.0 `given`
//     that CITED THE TOPIC LINE AS CORROBORATION. The tool manufactured evidence for a window
//     it never checked;
//   * `Math.abs(qf - a.frame) <= 60 * fps` was likewise always true, so `nearStage` was always
//     true and the `odd` detector COULD NEVER FIRE — in a tool whose --self-test advertises
//     "prove each detector fires on a synthetic positive AND stays silent on a synthetic
//     negative". It stayed silent on everything.
//
// And the self-test could not see any of it, because its fixture `rec()` emitted `{frame: f}` —
// the fixture was written by the same hand that wrote the reader, in a dialect the engine does
// not speak. A self-test that supplies its own dialect tests the tool against itself.
//
// THE THREE REPAIRS, and the third is the one that generalises:
//
//   1. Frames are read through `tools/lib/trace-schema.mjs` — ONE documented reader for
//      `elder-souls/trace@1`, whose `frameOf()` returns **null**, never 0, when no frame key is
//      present. Zero is a legal frame; null is not comparable and forces a decision.
//   2. `requireFrames()` gates the whole extraction. A trace carrying no frame key is
//      `unmeasurable` and exits non-zero — it is NOT scanned with invented zeros.
//   3. The self-test runs EVERY case in BOTH dialects and asserts the two agree, and it
//      contains an explicit R3 regression guard reproducing the confidence-upgrade bug. A
//      fixture in one dialect can never again certify a reader in another.
//
// Also removed: `r.player.region` and `r.world.region` (line 115). NO ARTIFACT WRITES EITHER —
// confirmed by census over every reports/**/*.jsonl. The region lives at `env.region`, and the
// `release / area change` signature could not fire without it.
// ===============================================================================================
//
// EXIT: 0 scanned; 1 the trace produced no beats at all (which is a finding about the run, and
//       is reported as one, not as a silent empty log); 2 usage; 20 no trace, or a trace whose
//       records carry no frame key at all (unmeasurable, never scanned as zeros).
'use strict';

import fs from 'node:fs';
import path from 'node:path';
import { REPO_ROOT, parseArgs, wantsHelp, usage, writeJson, die, EXIT } from '../lib/cli.mjs';
import { frameOf, eventFrameOf, regionOf, requireFrames, TRACE_SCHEMA } from '../lib/trace-schema.mjs';

const USAGE = `
beat-extract.mjs — RI-EXP01 step 2: detect beat signatures in a session trace.

USAGE
  node tools/experience/beat-extract.mjs --in reports/sessions/<id>
  node tools/experience/beat-extract.mjs --in <dir> --out beat-log.json
  node tools/experience/beat-extract.mjs --self-test

OPTIONS
  --in DIR      a session-run.mjs (or journey-run.mjs) directory containing trace.jsonl
  --out PATH    default <in>/beat-log.json
  --fps N       default 60
  --self-test   prove each detector fires on a synthetic positive AND stays silent on a
                synthetic negative. A detector that fires on everything is worse than none.

BEAT CLASSES (RI-EXP01 step 2's table)
  release            events[].type == "load" with a region transition in player.pos
  creation           getQuestState().flags gains the origin flag; topicsKnown[] first non-empty
  found_not_given    an item event whose id is ABSENT from every journal entry and every
                     topicsKnown topic AT THE TIME IT FIRES
  given              an item event within 30 s of a topic event naming the same item
  combat             first attack_start with enemies[].alert_state == "AGGRO"
  death              events[].type == "death" with owner == "player"
  refusal            a topic event whose response record is flagged refused
  lie                a topic asserting a proposition contradicted by a world flag at that frame
                     (resolved in VERIFICATION against game/data/**, never during play)
  odd                an authored event with no quest_stage within +/-60 s and no journal entry
  hub_exits          >=3 distinct navmesh exits with no blocking volume
  tutorial_text      UI string events; characters counted
`;

const args = parseArgs();
if (wantsHelp(args)) usage(USAGE);
if (args['self-test']) process.exit(selfTest());

const inDir = args.in ? path.resolve(String(args.in)) : null;
if (!inDir) die(EXIT.USAGE, '--in <session directory> is required');
const tracePath = path.join(inDir, 'trace.jsonl');
if (!fs.existsSync(tracePath)) {
  die(EXIT.MEASUREMENT_FAIL,
    `${path.relative(REPO_ROOT, tracePath)} does not exist. Produce a session with:\n` +
    `  node tools/experience/session-run.mjs --session <id> --profile first-hour --minutes 60`);
}

const lines = fs.readFileSync(tracePath, 'utf8').split('\n');
const records = [];
for (let i = 0; i < lines.length; i++) {
  const l = lines[i].trim();
  if (!l) continue;
  try { records.push({ ...JSON.parse(l), __line: i + 1 }); } catch { /* header/footer tolerance */ }
}

const log = extract(records, Number(args.fps || 60));
writeJson(args.out ? String(args.out) : path.join(inDir, 'beat-log.json'), log);
report(log);
// An unmeasurable trace is exit 20, not exit 1. "No beats" and "could not look for beats" are
// different findings and a consumer must be able to tell them apart from the exit code alone.
if (log.unmeasurable) process.exit(EXIT.MEASUREMENT_FAIL);
process.exit(log.beats.length ? 0 : 1);

// ---------------------------------------------------------------------------------------------
export function extract(records, fps = 60) {
  const frames = records.filter((r) => r && r._ !== 'header' && r._ !== 'footer');

  // ---- THE GATE. R3 §2's defect could only exist because a missing frame silently became 0. --
  // A trace with no readable frame key is UNMEASURABLE. It is not scanned, because every
  // signature below is a frame-window test and a window test over invented zeros is always true.
  const gate = requireFrames(records);
  if (!gate.ok) {
    return {
      schema: 'elder-souls/beat-log@1', tool: 'tools/experience/beat-extract.mjs',
      item: 'RI-EXP01 step 2', fps, trace_records: frames.length,
      unmeasurable: true, frame_key: null, beats: [], by_class: {}, tutorial_text_chars: 0,
      deferred: [],
      unmeasurable_why:
        `CANNOT SCAN: ${gate.why} Every beat signature in RI-EXP01 step 2 is a frame-window test ` +
        `("within 30 s of", "within +/-60 s of"). Scanning with a default frame of 0 makes every ` +
        `window permanently true, which is exactly how the round-3 tool promoted a hedged ` +
        `confidence-0.7 verdict to a confident 1.0 and cited evidence the trace did not support ` +
        `(TOOL-COVERAGE-R3 §2). Reporting the absence instead.`,
      // An EMPTY trace and a trace in an unreadable dialect are both unmeasurable, but they are
      // different findings with different owners — one is about the run, the other about the
      // artifact's schema — so each keeps its own note rather than being collapsed into one.
      empty_note: frames.length === 0
        ? 'NO TRACE RECORDS AT ALL. This is a statement about the RUN, not about the build: an ' +
          'undriven session produces an empty trace. Check session.json\'s `undriven` flag ' +
          'before reading this as a build defect.'
        : null,
    };
  }

  const beats = [];
  const tMin = (f) => +((f / fps) / 60).toFixed(2);
  const push = (klass, f, evidence, extra = {}, confidence = 1.0) => {
    if (!evidence || !evidence.length) return;   // no evidence, no beat
    if (!Number.isFinite(f)) return;             // no frame, no beat — never stamp an invented 0
    beats.push({ beat_class: klass, f, t_min: tMin(f), evidence, confidence, ...extra });
  };

  // Running state the signatures are defined AGAINST — "at the time it fires" is load-bearing
  // in the found-not-given signature, so these must be accumulated in frame order and never
  // computed from the end state.
  const topicsKnown = new Set();
  const journalMentions = new Set();
  const recentTopics = [];          // {frame, item-ish tokens}
  let sawCreationFlag = false, sawFirstCombat = false;
  let lastRegion = null;
  let tutorialChars = 0;
  const questStageFrames = [];
  const journalFrames = [];
  const authoredEvents = [];

  let skippedNoFrame = 0;
  for (const r of frames) {
    // `frameOf` is trace-schema's ONE reader: `f` (the engine's dialect) then `frame` (legacy),
    // and NULL — never 0 — when neither is present. See the header block.
    const rf = frameOf(r);
    if (rf === null) { skippedNoFrame++; continue; }
    const evs = Array.isArray(r.events) ? r.events : [];

    // Region transitions, for `release / area change`.
    // R3 §2: this used to read `r.player.region || r.world.region`. NEITHER PATH IS WRITTEN BY
    // ANY ARTIFACT — census over every reports/**/*.jsonl, 0 records for both — so the release
    // signature could not fire. The region is at `env.region` (sim/record.js:186).
    const region = regionOf(r);

    for (const e of evs) {
      if (!e || !e.type) continue;
      // Events carry their OWN frame (sim/events.js:169, `{f, type}`); fall back to the record's.
      const f = eventFrameOf(e, r);
      if (!Number.isFinite(f)) continue;

      // release / area change: "events[].type == 'load' with a region transition in player.pos"
      if (e.type === 'load' || e.type === 'region_stream_in') {
        if (region && lastRegion && region !== lastRegion) {
          push('release', f, [r.__line], { from: lastRegion, to: region });
        }
      }

      // creation: "getQuestState().flags gains the origin flag; topicsKnown[] non-empty first time"
      if (e.type === 'creation_field' && !sawCreationFlag) {
        sawCreationFlag = true;
        push('creation', f, [r.__line], { field: e.field || null });
      }
      if (e.type === 'topic' || e.type === 'topic_select') {
        const t = String(e.topic || e.id || '');
        if (t) {
          if (topicsKnown.size === 0 && !sawCreationFlag) push('creation', f, [r.__line], { via: 'first topic known' }, 0.6);
          topicsKnown.add(t);
          recentTopics.push({ frame: f, topic: t, line: r.__line });
        }
        // refusal: "a topic event whose response record is flagged refused"
        if (e.refused || (e.response && e.response.refused)) {
          push('refusal', f, [r.__line], { topic: t, reason: e.reason || (e.response && e.response.reason) || null });
        }
      }
      if (e.type === 'journal' || e.type === 'journal_write') {
        journalFrames.push(f);
        for (const w of String(e.text || e.entry || '').toLowerCase().match(/[a-z][a-z-]{3,}/g) || []) journalMentions.add(w);
      }
      if (e.type === 'quest_stage') questStageFrames.push(f);

      // item: given vs found-not-given. The discriminator is whether the item was SPOKEN OF
      // before it was picked up. RI-EXP01: "given" = an item event within 30 s of a topic event
      // naming the same item; "found-not-given" = the id is absent from every journal entry and
      // every known topic AT THE TIME IT FIRES.
      if (e.type === 'item' || e.type === 'theft' || e.type === 'takeObject') {
        const id = String(e.item || e.id || e.object || '');
        const tokens = id.toLowerCase().split(/[^a-z]+/).filter((x) => x.length > 3);
        // THE WINDOW R3 §2 DEFEATED. With `r.frame ?? 0` this read `0 - 0 <= 1800` on every
        // real trace — always true — so a topic mentioned 27 minutes earlier counted as "within
        // 30 s" and the hedged 0.7 branch below was never reached. `>= 0` is now explicit as
        // well: "AT THE TIME IT FIRES" is load-bearing in RI-EXP01 and a same-record event
        // ordering must not be allowed to look backwards.
        // (`t.frame` is this tool's OWN constructed object, not a trace record — see recentTopics.)
        const namedRecently = recentTopics.filter((t) =>
          f - t.frame >= 0 && f - t.frame <= 30 * fps &&
          tokens.some((tok) => t.topic.toLowerCase().includes(tok)));
        const inJournal = tokens.some((tok) => journalMentions.has(tok));
        const inTopics = [...topicsKnown].some((t) => tokens.some((tok) => t.toLowerCase().includes(tok)));
        if (namedRecently.length) {
          push('given', f, [r.__line, ...namedRecently.map((t) => t.line)], { item: id });
        } else if (!inJournal && !inTopics) {
          push('found_not_given', f, [r.__line], { item: id });
        } else {
          push('given', f, [r.__line], { item: id, via: 'previously mentioned' }, 0.7);
        }
      }

      // combat: "first attack_start with enemies[].alert_state == AGGRO"
      if (e.type === 'attack_start' && !sawFirstCombat) {
        const aggro = Array.isArray(r.enemies) && r.enemies.some((x) => x && (x.alert_state === 'AGGRO' || x.alertState === 'AGGRO'));
        if (aggro) { sawFirstCombat = true; push('combat', f, [r.__line], { attacker: e.who || null }); }
      }

      // death: "events[].type == 'death' with owner == 'player'"
      if (e.type === 'death' && (e.owner === 'player' || e.who === 'player')) {
        push('death', f, [r.__line], { by: e.by || null });
      }

      // odd: "an authored event with no quest_stage within +/-60 s and no journal entry ever"
      if (e.type === 'spawn' && e.authored) authoredEvents.push({ frame: f, line: r.__line, id: e.id || null });

      // tutorial_text: "UI string events; the driver captures setUIVisible overlays and counts characters"
      if (e.type === 'ui_text' || e.type === 'surface_enter') {
        const s = String(e.text || '');
        if (s) tutorialChars += s.length;
      }
    }
    if (region) lastRegion = region;
  }

  // `odd` needs the whole timeline, so it is resolved after the pass.
  for (const a of authoredEvents) {
    const nearStage = questStageFrames.some((qf) => Math.abs(qf - a.frame) <= 60 * fps);
    const everJournal = journalFrames.length > 0;
    if (!nearStage && !everJournal) push('odd', a.frame, [a.line], { authored: a.id });
  }

  // The classes this tool CANNOT resolve from a trace alone, said plainly rather than reported
  // as zero. RI-EXP01 is explicit that `lie` is resolved in a verification stage against
  // game/data/**, never during play; `hub_exits` needs a route probe, not a trace.
  const deferred = [
    { beat_class: 'lie', why: 'RI-EXP01 step 2: resolved in the VERIFICATION stage against game/data/**, never during play. beat-diff.mjs --verify-lies performs it; a trace alone cannot.' },
    { beat_class: 'hub_exits', why: 'needs getWorldStats() plus a route probe (>=3 navmesh exits with no blocking volume), which is a live-world measurement and not a trace signature.' },
  ];

  const byClass = {};
  for (const b of beats) byClass[b.beat_class] = (byClass[b.beat_class] || 0) + 1;

  return {
    schema: 'elder-souls/beat-log@1',
    tool: 'tools/experience/beat-extract.mjs',
    item: 'RI-EXP01 step 2',
    fps,
    trace_records: frames.length,
    unmeasurable: false,
    // Which dialect this trace spoke, and how many records were skipped for having no frame at
    // all. Both stated on the artifact so a reader never has to guess what was scanned.
    trace_schema: TRACE_SCHEMA,
    frame_key: gate.key,
    records_with_a_frame: gate.n_with_frame,
    records_skipped_no_frame: skippedNoFrame,
    beats,
    by_class: byClass,
    tutorial_text_chars: tutorialChars,
    deferred,
    // Said out loud so an empty log is never mistaken for a clean hour.
    empty_note: beats.length === 0
      ? `NO BEAT SIGNATURE FIRED in ${frames.length} trace records. This is a statement about the ` +
        `RUN, not about the build: an undriven session produces an empty beat log, and so does a ` +
        `build that emits none of the eleven signatures. beat-diff.mjs will show every beat ` +
        `missing; check session.json's \`undriven\` flag before reading that as a build defect.`
      : null,
  };
}

function report(l) {
  if (l.unmeasurable) {
    process.stdout.write(`beat-extract: UNMEASURABLE over ${l.trace_records} trace records\n`);
    process.stdout.write(`  ${l.unmeasurable_why}\n`);
    return;
  }
  process.stdout.write(
    `beat-extract: ${l.beats.length} beats from ${l.trace_records} trace records ` +
    `(frames keyed '${l.frame_key}'` +
    `${l.records_skipped_no_frame ? `, ${l.records_skipped_no_frame} records skipped with no frame` : ''})\n`);
  for (const [k, v] of Object.entries(l.by_class)) process.stdout.write(`  ${k.padEnd(18)} ${v}\n`);
  for (const d of l.deferred) process.stdout.write(`  DEFERRED ${d.beat_class}: ${d.why}\n`);
  if (l.empty_note) process.stdout.write(`  ${l.empty_note}\n`);
}

// ---------------------------------------------------------------------------------------------
function selfTest() {
  const lines = [];
  let failed = 0;
  const ok = (n, pass, d) => { lines.push(`${pass ? 'PASS' : 'FAIL'} ${n} — ${d}`); if (!pass) failed++; };
  const fps = 60;

  // ---- THE FIXTURE. R3 §2's finding was that this line wrote `{ frame: f }` while the engine
  // writes `{ f }` — "the fixture was written by the same hand that reads it, in a dialect the
  // engine does not speak."
  //
  // The repair is not to swap one dialect for the other. It is to run EVERY case in BOTH and
  // assert they agree, so no future reader can be certified by a fixture that agrees with it and
  // with nothing else. `recEngine` is the shape sim/record.js actually emits, events included.
  const recEngine = (f, events, extra = {}) =>
    ({ f, events: (events || []).map((e) => ({ f, ...e })), __line: f, ...extra });
  const recLegacy = (f, events, extra = {}) =>
    ({ frame: f, events: (events || []).map((e) => ({ frame: f, ...e })), __line: f, ...extra });

  /**
   * Run a case in the engine dialect AND the legacy dialect, assert the two agree, and return
   * the engine-dialect result. Any check written with this is automatically a dialect check.
   */
  let dialectMismatches = 0;
  const both = (build) => {
    const a = extract(build(recEngine), fps);
    const b = extract(build(recLegacy), fps);
    const key = (l) => JSON.stringify(l.beats.map((x) => [x.beat_class, x.f, x.confidence, x.via || null, (x.evidence || []).length]));
    if (key(a) !== key(b)) dialectMismatches++;
    return a;
  };

  // `rec` remains the engine dialect for the handful of one-off checks below.
  const rec = recEngine;

  // Empty trace: no beats, and an explicit note rather than a silent clean log.
  const empty = extract([], fps);
  ok('empty trace yields 0 beats AND an explicit note',
    empty.beats.length === 0 && !!empty.empty_note && empty.unmeasurable === true,
    `beats=${empty.beats.length}, note=${empty.empty_note ? 'present' : 'MISSING'}, ` +
    `unmeasurable=${empty.unmeasurable} (round 4: an empty trace is unmeasurable, not "clean")`);

  // found_not_given POSITIVE: an item nobody has mentioned.
  const found = both((R) => [R(600, [{ type: 'item', item: 'marked-brooch' }])]);
  ok('found_not_given fires on an unmentioned item',
    found.beats.some((b) => b.beat_class === 'found_not_given'),
    JSON.stringify(found.by_class));

  // found_not_given NEGATIVE — the falsification that matters. The same item, but a topic
  // named it 10 s earlier. It must be `given`, not `found`. A detector that cannot tell these
  // apart makes T_found meaningless, and T_found is RI-EXP01's headline metric.
  const given = both((R) => [
    R(0, [{ type: 'topic', topic: 'the marked brooch' }]),
    R(600, [{ type: 'item', item: 'marked-brooch' }]),
  ]);
  ok('found_not_given does NOT fire when a topic named the item first (falsification)',
    !given.beats.some((b) => b.beat_class === 'found_not_given') && given.beats.some((b) => b.beat_class === 'given'),
    JSON.stringify(given.by_class));

  // And the ordering must matter: a topic AFTER the pickup must not retro-convert it.
  const after = both((R) => [
    R(600, [{ type: 'item', item: 'marked-brooch' }]),
    R(1200, [{ type: 'topic', topic: 'the marked brooch' }]),
  ]);
  ok('a topic AFTER the pickup does not retro-convert found into given',
    after.beats.some((b) => b.beat_class === 'found_not_given'),
    `"at the time it fires" is load-bearing: ${JSON.stringify(after.by_class)}`);

  // combat requires AGGRO, not merely an attack.
  const noAggro = both((R) => [R(100, [{ type: 'attack_start', who: 'player' }], { enemies: [] })]);
  const withAggro = both((R) => [R(100, [{ type: 'attack_start', who: 'player' }], { enemies: [{ alert_state: 'AGGRO' }] })]);
  ok('combat requires an AGGRO hostile, not just an attack (falsification)',
    !noAggro.beats.some((b) => b.beat_class === 'combat') && withAggro.beats.some((b) => b.beat_class === 'combat'),
    `no-aggro=${JSON.stringify(noAggro.by_class)}, aggro=${JSON.stringify(withAggro.by_class)}`);

  // death requires the PLAYER.
  const enemyDeath = both((R) => [R(50, [{ type: 'death', who: 'enemy-1' }])]);
  const playerDeath = both((R) => [R(50, [{ type: 'death', who: 'player' }])]);
  ok('death fires only for the player (falsification)',
    !enemyDeath.beats.some((b) => b.beat_class === 'death') && playerDeath.beats.some((b) => b.beat_class === 'death'),
    `enemy=${JSON.stringify(enemyDeath.by_class)}, player=${JSON.stringify(playerDeath.by_class)}`);

  // odd must NOT fire when a quest stage is nearby.
  const oddQuiet = both((R) => [
    R(600, [{ type: 'spawn', authored: true, id: 'body-in-the-crown' }]),
    R(1200, [{ type: 'quest_stage', quest: 'q1' }]),
  ]);
  const oddLoud = both((R) => [R(600, [{ type: 'spawn', authored: true, id: 'body-in-the-crown' }])]);
  ok('odd is silenced by a nearby quest_stage (falsification)',
    !oddQuiet.beats.some((b) => b.beat_class === 'odd') && oddLoud.beats.some((b) => b.beat_class === 'odd'),
    `with-stage=${JSON.stringify(oddQuiet.by_class)}, without=${JSON.stringify(oddLoud.by_class)}`);

  // Every emitted beat carries evidence lines.
  const all = [...found.beats, ...withAggro.beats, ...playerDeath.beats, ...oddLoud.beats];
  ok('every beat carries trace evidence line numbers',
    all.length > 0 && all.every((b) => Array.isArray(b.evidence) && b.evidence.length > 0),
    `${all.length} beats, all with evidence`);

  // =============================================================================================
  // ROUND 4 — the R3 §2 regression guards. Every one of these is a check the round-3 tool failed
  // while reporting 8/8.
  // =============================================================================================

  // R4-1. THE DIALECT. Asserted over every case above, not as an isolated unit test.
  ok('R4: every case above produces IDENTICAL beats in the engine dialect and the legacy dialect',
    dialectMismatches === 0,
    `${dialectMismatches} mismatch(es). R3 §2: the fixture wrote {frame:f} while the engine ` +
    'writes {f} — "a dialect the engine does not speak". Now both are run and compared.');

  // R4-2. THE CONFIDENCE UPGRADE — R3 §2's headline. A topic at frame 0, the item at 100 000
  // (27.8 minutes later, far outside RI-EXP01's 30-second window). The honest verdict is a
  // HEDGED confidence-0.7 `given` "via previously mentioned", citing ONE evidence line. The
  // round-3 tool returned confidence 1.0 with TWO evidence lines, fabricating corroboration for
  // a window it never checked.
  {
    const far = extract([
      rec(0, [{ type: 'topic', topic: 'the marked brooch' }]),
      rec(100000, [{ type: 'item', item: 'marked-brooch' }]),
    ], fps);
    const g = far.beats.find((b) => b.beat_class === 'given');
    ok('R4: a topic 27.8 MINUTES before the pickup is NOT "within 30 s" — verdict stays hedged',
      !!g && g.confidence === 0.7 && g.via === 'previously mentioned' && g.evidence.length === 1,
      g ? `f=${g.f}, t_min=${g.t_min}, confidence=${g.confidence}, via=${JSON.stringify(g.via)}, ` +
          `evidence=${JSON.stringify(g.evidence)}. R3 produced f=0, t_min=0, confidence=1.0, ` +
          'no via, evidence=[2,1].'
        : 'no `given` beat at all');
    ok('R4: and the beat is stamped at the frame it happened, not at minute zero',
      !!g && g.f === 100000 && g.t_min > 27 && g.t_min < 28,
      g ? `f=${g.f}, t_min=${g.t_min} (beat-diff.mjs compares beat logs BY TIME)` : 'n/a');

    // Null control: the SAME structure inside the window must still be the confident verdict.
    const near = extract([
      rec(0, [{ type: 'topic', topic: 'the marked brooch' }]),
      rec(600, [{ type: 'item', item: 'marked-brooch' }]),
    ], fps);
    const gn = near.beats.find((b) => b.beat_class === 'given');
    ok('R4: null control — a topic 10 s before the pickup IS within 30 s and IS corroborated',
      !!gn && gn.confidence === 1.0 && gn.evidence.length === 2,
      gn ? `confidence=${gn.confidence}, evidence=${JSON.stringify(gn.evidence)} — the repair ` +
           'narrows the window, it does not disable it' : 'no `given` beat');
  }

  // R4-3. THE DEAD DETECTOR. `Math.abs(qf - a.frame) <= 60*fps` was `0 - 0 <= 3600` on every real
  // trace, so `nearStage` was ALWAYS true and `odd` could never fire — in a tool advertising
  // "prove each detector fires on a synthetic positive AND stays silent on a synthetic negative".
  {
    const farStage = extract([
      rec(600, [{ type: 'spawn', authored: true, id: 'body-in-the-crown' }]),
      rec(600000, [{ type: 'quest_stage', quest: 'q1' }]),   // 2.7 hours later — not "nearby"
    ], fps);
    ok('R4: `odd` FIRES when the only quest_stage is 2.7 hours away (the detector R3 found dead)',
      farStage.beats.some((b) => b.beat_class === 'odd'),
      `by_class=${JSON.stringify(farStage.by_class)} — under r.frame??0 both frames read 0 and ` +
      'this could never fire');
  }

  // R4-4. THE REGION PATH. `player.region`/`world.region` are written by NO artifact; the region
  // is `env.region`. Without this the `release / area change` signature could not fire at all.
  {
    const rel = extract([
      { ...rec(0, [{ type: 'load' }]), env: { region: 'bitter-coast' } },
      { ...rec(300, [{ type: 'load' }]), env: { region: 'ashlands' } },
    ], fps);
    const dead = extract([
      { ...rec(0, [{ type: 'load' }]), player: { region: 'bitter-coast' } },
      { ...rec(300, [{ type: 'load' }]), player: { region: 'ashlands' } },
    ], fps);
    ok('R4: `release` fires on an env.region transition (the path the engine writes)',
      rel.beats.some((b) => b.beat_class === 'release'), JSON.stringify(rel.by_class));
    ok('R4: and does NOT fire on the invented player.region path (falsification)',
      !dead.beats.some((b) => b.beat_class === 'release'),
      'no artifact in reports/** writes player.region or world.region — census confirmed');
  }

  // R4-5. THE GATE. A trace with no frame key must be UNMEASURABLE, not scanned as zeros. This
  // is the structural repair: the failure mode becomes loud instead of confidently wrong.
  {
    const noFrames = extract([
      { events: [{ type: 'topic', topic: 'the marked brooch' }], __line: 1 },
      { events: [{ type: 'item', item: 'marked-brooch' }], __line: 2 },
    ], fps);
    ok('R4: a trace carrying NO frame key is UNMEASURABLE, never scanned with invented zeros',
      noFrames.unmeasurable === true && noFrames.beats.length === 0 && !!noFrames.unmeasurable_why,
      `unmeasurable=${noFrames.unmeasurable}, beats=${noFrames.beats.length}. The round-3 tool ` +
      'would have emitted a confidence-1.0 `given` here.');
  }

  // R4-6. THE REAL CORPUS. The final proof that the reader speaks the engine's dialect: run over
  // an actual shipped trace and assert the frames are not all zero.
  {
    const dirs = [];
    const rroot = path.join(REPO_ROOT, 'reports');
    const walk = (d) => {
      let e; try { e = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
      for (const x of e) {
        const q = path.join(d, x.name);
        if (x.isDirectory()) walk(q);
        else if (x.name === 'trace.jsonl') dirs.push(q);
      }
    };
    walk(rroot);
    if (dirs.length) {
      const raw = fs.readFileSync(dirs[0], 'utf8').split('\n');
      const recs = [];
      for (let i = 0; i < raw.length; i++) {
        const l = raw[i].trim(); if (!l) continue;
        try { recs.push({ ...JSON.parse(l), __line: i + 1 }); } catch { /* tolerate */ }
      }
      const real = extract(recs, fps);
      const maxF = Math.max(0, ...recs.map((r) => frameOf(r) ?? 0));
      ok('R4: on a REAL shipped trace the reader finds the engine\'s frame key and real frames',
        real.unmeasurable === false && real.frame_key === 'f' && maxF > 0 &&
        real.records_with_a_frame === recs.filter((r) => r._ !== 'header' && r._ !== 'footer').length,
        `${path.relative(REPO_ROOT, dirs[0])}: key='${real.frame_key}', ` +
        `${real.records_with_a_frame} records with a frame, max frame ${maxF}. ` +
        'Under r.frame??0 every one of these read 0.');
    } else {
      ok('R4: a real shipped trace was available to check against', false,
        'no trace.jsonl under reports/ — the dialect claim could not be checked against the corpus');
    }
  }

  for (const l of lines) process.stdout.write(l + '\n');
  process.stdout.write(`\nbeat-extract (experience) self-test: ${failed === 0 ? 'PASS' : 'FAIL'} (${lines.length - failed}/${lines.length})\n`);
  return failed === 0 ? 0 : 1;
}
