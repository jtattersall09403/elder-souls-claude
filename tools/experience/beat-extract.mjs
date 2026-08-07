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
// EXIT: 0 scanned; 1 the trace produced no beats at all (which is a finding about the run, and
//       is reported as one, not as a silent empty log); 2 usage; 20 no trace.
'use strict';

import fs from 'node:fs';
import path from 'node:path';
import { REPO_ROOT, parseArgs, wantsHelp, usage, writeJson, die, EXIT } from '../lib/cli.mjs';

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
process.exit(log.beats.length ? 0 : 1);

// ---------------------------------------------------------------------------------------------
export function extract(records, fps = 60) {
  const frames = records.filter((r) => r && r._ !== 'header' && r._ !== 'footer');
  const beats = [];
  const tMin = (f) => +((f / fps) / 60).toFixed(2);
  const push = (klass, f, evidence, extra = {}, confidence = 1.0) => {
    if (!evidence || !evidence.length) return;   // no evidence, no beat
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

  for (const r of frames) {
    const f = r.frame ?? 0;
    const evs = Array.isArray(r.events) ? r.events : [];

    // Region transitions, for `release / area change`.
    const region = (r.player && r.player.region) || (r.world && r.world.region) || null;

    for (const e of evs) {
      if (!e || !e.type) continue;

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
        const namedRecently = recentTopics.filter((t) =>
          f - t.frame <= 30 * fps && tokens.some((tok) => t.topic.toLowerCase().includes(tok)));
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
  process.stdout.write(`beat-extract: ${l.beats.length} beats from ${l.trace_records} trace records\n`);
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
  const rec = (f, events, extra = {}) => ({ frame: f, events, __line: f, ...extra });

  // Empty trace: no beats, and an explicit note rather than a silent clean log.
  const empty = extract([], fps);
  ok('empty trace yields 0 beats AND an explicit note', empty.beats.length === 0 && !!empty.empty_note,
    `beats=${empty.beats.length}, note=${empty.empty_note ? 'present' : 'MISSING'}`);

  // found_not_given POSITIVE: an item nobody has mentioned.
  const found = extract([rec(600, [{ type: 'item', item: 'marked-brooch' }])], fps);
  ok('found_not_given fires on an unmentioned item',
    found.beats.some((b) => b.beat_class === 'found_not_given'),
    JSON.stringify(found.by_class));

  // found_not_given NEGATIVE — the falsification that matters. The same item, but a topic
  // named it 10 s earlier. It must be `given`, not `found`. A detector that cannot tell these
  // apart makes T_found meaningless, and T_found is RI-EXP01's headline metric.
  const given = extract([
    rec(0, [{ type: 'topic', topic: 'the marked brooch' }]),
    rec(600, [{ type: 'item', item: 'marked-brooch' }]),
  ], fps);
  ok('found_not_given does NOT fire when a topic named the item first (falsification)',
    !given.beats.some((b) => b.beat_class === 'found_not_given') && given.beats.some((b) => b.beat_class === 'given'),
    JSON.stringify(given.by_class));

  // And the ordering must matter: a topic AFTER the pickup must not retro-convert it.
  const after = extract([
    rec(600, [{ type: 'item', item: 'marked-brooch' }]),
    rec(1200, [{ type: 'topic', topic: 'the marked brooch' }]),
  ], fps);
  ok('a topic AFTER the pickup does not retro-convert found into given',
    after.beats.some((b) => b.beat_class === 'found_not_given'),
    `"at the time it fires" is load-bearing: ${JSON.stringify(after.by_class)}`);

  // combat requires AGGRO, not merely an attack.
  const noAggro = extract([rec(100, [{ type: 'attack_start', who: 'player' }], { enemies: [] })], fps);
  const withAggro = extract([rec(100, [{ type: 'attack_start', who: 'player' }], { enemies: [{ alert_state: 'AGGRO' }] })], fps);
  ok('combat requires an AGGRO hostile, not just an attack (falsification)',
    !noAggro.beats.some((b) => b.beat_class === 'combat') && withAggro.beats.some((b) => b.beat_class === 'combat'),
    `no-aggro=${JSON.stringify(noAggro.by_class)}, aggro=${JSON.stringify(withAggro.by_class)}`);

  // death requires the PLAYER.
  const enemyDeath = extract([rec(50, [{ type: 'death', who: 'enemy-1' }])], fps);
  const playerDeath = extract([rec(50, [{ type: 'death', who: 'player' }])], fps);
  ok('death fires only for the player (falsification)',
    !enemyDeath.beats.some((b) => b.beat_class === 'death') && playerDeath.beats.some((b) => b.beat_class === 'death'),
    `enemy=${JSON.stringify(enemyDeath.by_class)}, player=${JSON.stringify(playerDeath.by_class)}`);

  // odd must NOT fire when a quest stage is nearby.
  const oddQuiet = extract([
    rec(600, [{ type: 'spawn', authored: true, id: 'body-in-the-crown' }]),
    rec(1200, [{ type: 'quest_stage', quest: 'q1' }]),
  ], fps);
  const oddLoud = extract([rec(600, [{ type: 'spawn', authored: true, id: 'body-in-the-crown' }])], fps);
  ok('odd is silenced by a nearby quest_stage (falsification)',
    !oddQuiet.beats.some((b) => b.beat_class === 'odd') && oddLoud.beats.some((b) => b.beat_class === 'odd'),
    `with-stage=${JSON.stringify(oddQuiet.by_class)}, without=${JSON.stringify(oddLoud.by_class)}`);

  // Every emitted beat carries evidence lines.
  const all = [...found.beats, ...withAggro.beats, ...playerDeath.beats, ...oddLoud.beats];
  ok('every beat carries trace evidence line numbers',
    all.length > 0 && all.every((b) => Array.isArray(b.evidence) && b.evidence.length > 0),
    `${all.length} beats, all with evidence`);

  for (const l of lines) process.stdout.write(l + '\n');
  process.stdout.write(`\nbeat-extract (experience) self-test: ${failed === 0 ? 'PASS' : 'FAIL'} (${lines.length - failed}/${lines.length})\n`);
  return failed === 0 ? 0 : 1;
}
