#!/usr/bin/env node
// anecdote-trace.mjs — `experience.memory.anecdote`. WHAT DOES A SESSION LEAVE A PLAYER ABLE TO
// TELL SOMEONE ABOUT AFTERWARDS?
//
//   node tools/experience/anecdote-trace.mjs --trace reports/sessions/exp-w1-opening/trace.jsonl \
//     --out reports/experience/w1/anecdote-trace.json
//
// RI-EXP02 §A defines an anecdote as one recalled item satisfying all five of: narrative shape
// (an action by the player AND a consequence), ≥1 proper noun, specific rather than generic,
// locatable in the trace within ±2 minutes, and told rather than transcribed. A5 belongs to the
// recall protocol and cannot be measured from a trace. **A1, A2 and A4 can**, and that is what
// this tool does: it enumerates, from the trace itself, the moments in the session that HAVE
// the shape of something you could tell someone about.
//
// WHY THAT IS A DIFFERENT NUMBER FROM THE ITEM'S, AND SAID SO PLAINLY (RULES #26).
// `verified_anecdotes_per_hour` is `(verified − unverified) / hours` over what an isolated agent
// RECALLED. This tool does not recall anything; it counts the session's CAPACITY to be recalled.
// A session with no tellable moments cannot produce anecdotes and the census is dead before the
// agent is invoked; a session full of them may still produce nothing, because remembering is a
// separate step. So this is the upper bound, it is labelled `tellable_moments`, and it must
// never be reported as `verified_anecdotes_per_hour`. The item's own asymmetry, restated: the
// absence of shape proves deadness; the presence of shape proves nothing.
//
// THE MEASURE IS WHETHER SPECIFIC STRANGE THINGS HAPPENED, NOT WHETHER THE SESSION WAS LONG.
// So the headline is not the count. It is `distinct_shapes` — how many DIFFERENT kinds of thing
// happened — and `named_fraction`, the share of moments that carry a proper noun the world can
// resolve. A thousand `hit` events are one story. One `parley_accept` next to a `journal` and a
// `topic` naming the same person is another, and it is the whole item.
//
// SELF-TEST (RULES #4)
//   node tools/experience/anecdote-trace.mjs --self-test
// Synthetic traces with known answers, and the load-bearing one is the FLAT trace: 4,000 frames
// of combat with no consequence event anywhere must yield ZERO tellable moments. An extractor
// that scores a flat trace is measuring frames, not stories.
//
// EXIT: 0 · 2 no trace could be read · 3 the trace carries no frame numbers (unmeasurable,
//       fail-closed, per tools/lib/trace-schema.mjs) · 5 self-test failed.
'use strict';

import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const REPO = path.resolve(HERE, '..', '..');
const argv = process.argv.slice(2);
const has = (k) => argv.includes(`--${k}`);
const arg = (k, d) => { const i = argv.findIndex((a) => a === `--${k}` || a.startsWith(`--${k}=`)); if (i < 0) return d; const a = argv[i]; return a.includes('=') ? a.slice(a.indexOf('=') + 1) : argv[i + 1]; };
const say = (s) => process.stdout.write(s + '\n');

const FPS = 60;

// ---------------------------------------------------------------------------------------------
// A1, operationalised. An anecdote is "I did X, then Y". So: a PLAYER ACTION, followed inside a
// window by a CONSEQUENCE that is not simply the next frame of the same action.
//
// The two lists are drawn from the closed vocabulary in `game/src/sim/events.js`. A type that is
// in neither list is neither — `hit`, `stamina_spend`, `roll_start` and their kind are the
// texture of a session, not its events, and counting them is how a flat trace scores.

const ACTIONS = new Set([
  'attack_start', 'backstab', 'riposte', 'parry', 'block_success', 'charge_release',
  'roll_start', 'topic_select', 'item', 'bonfire_rest', 'save_write', 'input_action',
  'dialogue_open', 'first_control', 'bloodstain_recover', 'world_mire_struggle',
]);

const CONSEQUENCES = new Map([
  // type                  class hint (RI-EXP02 §B) — the JUDGING agent assigns the primary
  //                       class; this is a candidate hint and is labelled as one.
  ['quest_stage', 'T1'], ['journal', 'T5'], ['topic', 'T5'],
  ['death', 'T3'], ['world_fall_death', 'T3'], ['world_drowned', 'T3'],
  ['parley_accept', 'T4'], ['parley_refuse', 'T1'], ['parley_exempt', 'T1'],
  ['guard_break', 'T3'], ['stagger', 'T3'], ['level_up', 'T3'],
  ['bloodstain_create', 'T3'], ['bloodstain_recover', 'T3'],
  ['player_respawn', 'T3'], ['enemy_respawn', 'T3'],
  ['spawn', 'T2'], ['load', 'T2'], ['region_stream_in', 'T2'],
  ['world_mire_break', 'T4'], ['world_drowning', 'T3'], ['hazard_fired', 'T4'],
  ['world_fall_damage', 'T4'], ['action_denied_by_water', 'T4'],
  ['journal_write', 'T5'], ['save_read', 'T2'],
]);

// A2: which fields in an event payload can carry a proper noun.
const NOUN_FIELDS = ['quest', 'quest_id', 'topic', 'topic_id', 'npc', 'npc_id', 'eid', 'entity',
  'item', 'item_id', 'book', 'book_id', 'poi', 'poi_id', 'faction', 'faction_id', 'region',
  'settlement', 'interior', 'name', 'id', 'target', 'owner', 'scenario', 'state'];

const WINDOW_FRAMES = 120 * FPS; // RI-EXP02 A4's ±2 minutes, as frames.

function nounsOf(e) {
  const out = [];
  for (const f of NOUN_FIELDS) {
    const v = e[f];
    if (typeof v === 'string' && v && !/^(player|none|null|true|false)$/i.test(v) && v.length > 2) out.push({ field: f, value: v });
  }
  return out;
}

/**
 * Stream a trace and pull the events out. The 82 MB opening trace does not fit in memory as
 * parsed objects, so this reads line by line and keeps only the events.
 */
export async function readEvents(file) {
  const rl = readline.createInterface({ input: fs.createReadStream(file), crlfDelay: Infinity });
  const events = [];
  let frames = 0, withFrame = 0, lastF = null;
  for await (const line of rl) {
    if (!line || line[0] !== '{') continue;
    let r; try { r = JSON.parse(line); } catch { continue; }
    if (r._ === 'header' || r._ === 'footer') continue;
    frames++;
    const f = Number.isFinite(r.f) ? r.f : (Number.isFinite(r.frame) ? r.frame : null);
    if (f !== null) { withFrame++; lastF = f; }
    for (const e of (r.events || [])) {
      events.push({ ...e, f: Number.isFinite(e.f) ? e.f : f });
    }
  }
  return { events, frames, withFrame, lastFrame: lastF };
}

export function extract({ events, frames, lastFrame }) {
  // `requireFrames` in spirit: a missing frame is null, never 0.
  const usable = events.filter((e) => Number.isFinite(e.f));
  const actions = usable.filter((e) => ACTIONS.has(e.type));
  const moments = [];
  for (const e of usable) {
    const hint = CONSEQUENCES.get(e.type);
    if (!hint) continue;
    // A1: the nearest preceding PLAYER ACTION inside the window. With none, the consequence
    // happened TO the player rather than because of them, and is not "I did X, then Y".
    let act = null;
    for (let i = actions.length - 1; i >= 0; i--) {
      if (actions[i].f <= e.f && e.f - actions[i].f <= WINDOW_FRAMES) { act = actions[i]; break; }
      if (actions[i].f < e.f - WINDOW_FRAMES) break;
    }
    const nouns = nounsOf(e).concat(act ? nounsOf(act) : []);
    moments.push({
      frames: [act ? act.f : e.f, e.f],
      minutes: Math.round(((act ? act.f : e.f) / FPS / 60) * 10) / 10,
      action: act ? act.type : null,
      consequence: e.type,
      class_hint: hint,
      has_narrative_shape: !!act,                                   // A1
      proper_nouns: nouns.map((n) => n.value).filter((v, i, a) => a.indexOf(v) === i).slice(0, 6), // A2
      locatable: true,                                              // A4 — it came from the trace
    });
  }
  const tellable = moments.filter((m) => m.has_narrative_shape && m.proper_nouns.length > 0);
  const shapes = new Set(tellable.map((m) => `${m.action}->${m.consequence}`));
  const nouns = new Set(tellable.flatMap((m) => m.proper_nouns));
  const perClass = {};
  for (const m of tellable) perClass[m.class_hint] = (perClass[m.class_hint] || 0) + 1;
  const minutes = (lastFrame || frames) / FPS / 60;
  return {
    frames, event_count: events.length, simulated_minutes: Math.round(minutes * 10) / 10,
    candidate_moments: moments.length,
    tellable_moments: tellable.length,
    tellable_per_hour: minutes > 0 ? Math.round((tellable.length / (minutes / 60)) * 100) / 100 : null,
    // THE HEADLINE. Not the count.
    distinct_shapes: shapes.size,
    distinct_proper_nouns: nouns.size,
    named_fraction: moments.length ? Math.round((tellable.length / moments.length) * 100) / 100 : 0,
    class_hint_histogram: perClass,
    shapes: [...shapes].sort(),
    moments: tellable.slice(0, 200),
    event_type_histogram: usable.reduce((h, e) => { h[e.type] = (h[e.type] || 0) + 1; return h; }, {}),
  };
}

// ---------------------------------------------------------------------------------------------

function synthetic(kind) {
  const ev = [];
  if (kind === 'flat') {
    // 4,000 frames of combat and nothing else. MUST yield zero.
    for (let f = 1; f <= 4000; f++) { ev.push({ f, type: 'hit' }); if (f % 30 === 0) ev.push({ f, type: 'attack_start' }); }
    return { events: ev, frames: 4000, lastFrame: 4000 };
  }
  if (kind === 'rich') {
    for (let f = 1; f <= 4000; f++) {
      if (f % 400 === 0) ev.push({ f, type: 'topic_select', topic: `the-drowned-tally-${f}` });
      if (f % 400 === 20) ev.push({ f, type: 'quest_stage', quest: `Q-MAIN-0${(f / 400) % 6}` });
      if (f % 700 === 0) ev.push({ f, type: 'attack_start' });
      if (f % 700 === 40) ev.push({ f, type: 'death', eid: `champion_hist_marked` });
      ev.push({ f, type: 'hit' });
    }
    return { events: ev, frames: 4000, lastFrame: 4000 };
  }
  if (kind === 'unnamed') {
    // Consequences with an action but NO proper noun anywhere: A2 fails, so nothing is tellable.
    for (let f = 1; f <= 4000; f++) {
      if (f % 400 === 0) ev.push({ f, type: 'attack_start' });
      if (f % 400 === 20) ev.push({ f, type: 'stagger' });
    }
    return { events: ev, frames: 4000, lastFrame: 4000 };
  }
  if (kind === 'no_action') {
    // Consequences with no preceding player action: things happened TO the player. A1 fails.
    for (let f = 1; f <= 4000; f++) if (f % 400 === 0) ev.push({ f, type: 'spawn', eid: 'guard_legion' });
    return { events: ev, frames: 4000, lastFrame: 4000 };
  }
  return { events: [], frames: 0, lastFrame: 0 };
}

function selfTest() {
  say('SELF-TEST — synthetic traces with known answers.');
  const cases = [
    { id: 'flat: 4000 frames of combat, no consequence', kind: 'flat', want: (r) => r.tellable_moments === 0, wants: '0 tellable moments' },
    { id: 'unnamed: consequences with no proper noun (A2)', kind: 'unnamed', want: (r) => r.tellable_moments === 0, wants: '0 — A2 fails' },
    { id: 'no_action: consequences with no player action (A1)', kind: 'no_action', want: (r) => r.tellable_moments === 0, wants: '0 — A1 fails' },
    { id: 'rich: named quest stages and deaths after actions', kind: 'rich', want: (r) => r.tellable_moments > 0 && r.distinct_shapes >= 2, wants: '>0 moments and >=2 distinct shapes' },
    { id: 'empty trace', kind: 'empty', want: (r) => r.tellable_moments === 0 && r.frames === 0, wants: '0, and no division by zero' },
  ];
  let ok = true;
  for (const c of cases) {
    const r = extract(synthetic(c.kind));
    const good = c.want(r);
    say(`  ${good ? 'ok  ' : 'FAIL'}  ${c.id.padEnd(50)} tellable=${r.tellable_moments} shapes=${r.distinct_shapes} nouns=${r.distinct_proper_nouns}   (wants ${c.wants})`);
    if (!good) ok = false;
  }
  say(`SELF-TEST ${ok ? 'PASS' : 'FAIL'} — an extractor that scores a flat trace is measuring frames, not stories.`);
  return ok;
}

async function main() {
  if (has('self-test')) process.exit(selfTest() ? 0 : 5);
  const traces = argv.filter((a, i) => argv[i - 1] === '--trace' || (a.startsWith('--trace=') && false)).concat(
    argv.filter((a) => a.startsWith('--trace=')).map((a) => a.slice(8)));
  const list = traces.length ? traces : (arg('trace', null) ? [arg('trace')] : []);
  if (!list.length) { say('usage: --trace <file.jsonl> [--trace <file.jsonl> ...] [--out <file>]'); process.exit(2); }
  const all = { events: [], frames: 0, withFrame: 0, lastFrame: 0 };
  for (const t of list) {
    const p = path.resolve(REPO, t);
    if (!fs.existsSync(p)) { say(`ABSENT: ${t} — no trace, so nothing is measured. RI-EXP02 scores this unmeasurable.`); process.exit(2); }
    const r = await readEvents(p);
    all.events.push(...r.events); all.frames += r.frames; all.withFrame += r.withFrame;
    all.lastFrame = Math.max(all.lastFrame, r.lastFrame || 0);
    say(`  read ${t}: ${r.frames} frames, ${r.events.length} events`);
  }
  if (all.frames && all.withFrame / all.frames < 0.9) {
    say(`the trace carries a frame number on only ${all.withFrame}/${all.frames} records. A missing frame is null, ` +
      'never 0, so A4 (locatable within ±2 min) is unmeasurable and this run reports nothing.');
    process.exit(3);
  }
  const r = extract(all);
  r.traces = list;
  r.what_this_is_not = 'This is NOT `verified_anecdotes_per_hour`. It is the session\'s CAPACITY to be ' +
    'recalled: moments with narrative shape (A1) and a proper noun (A2), locatable in the trace (A4). ' +
    'A5 — that it survived the recall bottleneck — is the recall protocol\'s and is not measured here.';
  const o = path.resolve(REPO, arg('out', 'reports/experience/w1/anecdote-trace.json'));
  fs.mkdirSync(path.dirname(o), { recursive: true });
  fs.writeFileSync(o, JSON.stringify(r, null, 2) + '\n');
  say('');
  say(`  ${r.frames} frames (${r.simulated_minutes} simulated minutes) · ${r.event_count} events`);
  say(`  candidate moments      ${r.candidate_moments}`);
  say(`  TELLABLE moments       ${r.tellable_moments}   (${r.tellable_per_hour}/h — capacity, not recall)`);
  say(`  distinct shapes        ${r.distinct_shapes}   ${r.shapes.slice(0, 8).join(', ')}`);
  say(`  distinct proper nouns  ${r.distinct_proper_nouns}`);
  say(`  class hints            ${JSON.stringify(r.class_hint_histogram)}`);
  say(`wrote ${path.relative(REPO, o)}`);
  process.exit(0);
}

if (process.argv[1] && process.argv[1].endsWith('anecdote-trace.mjs')) main();
export { ACTIONS, CONSEQUENCES };
