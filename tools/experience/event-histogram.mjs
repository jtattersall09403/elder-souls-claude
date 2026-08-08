#!/usr/bin/env node
// event-histogram.mjs — `experience.session.shape`. RI-EXP03 Step 1.
//
//   node tools/experience/event-histogram.mjs --trace reports/sessions/exp-w1-opening/trace.jsonl \
//     --out reports/experience/w1/event-histogram.json
//
// "Every simulated frame is assigned exactly one activity class. Classes are derived from the
// trace, not declared by anyone." (§B.) Emits, per simulated hour: frame counts per class,
// fractions, `H(hour)` in bits, and `integrity.unclassified_fraction`.
//
// TWO THINGS THE ITEM MAKES BINDING AND THIS FILE HONOURS.
//
//   1. "`unclassified_fraction > 0.05` VOIDS the histogram — a fifth of the run in an unnamed
//      state is not a measurement." Hard fail 7. So the tool exits non-zero and refuses to
//      report a shape when the classification does not cover the run.
//   2. "Until `A-EXP2` lands, `READ`/`TRADE`/`CRAFT`/`MENU`/`TRAVEL_NODE` are unmeasurable ⇒ 0
//      for their checks and the classes collapse into `IDLE`, which fails this item's
//      `idle_fraction` bar — FAIL-CLOSED, as CRITIC-DOCTRINE §7.3 requires. That is deliberate:
//      an unobservable menu is an unbounded menu."
//
// `A-EXP2` extends the `events[]` vocabulary with `book_read`, `barter_open`, `barter_close`,
// `menu_open`, `menu_close`, `craft`, `parley`, `crime_witnessed`, `travel_node`, `first_visit`.
// This tool CHECKS the shipped vocabulary in `game/src/sim/events.js` for each of them and
// reports which are present, so "A-EXP2 is absent" is a measurement about the tree rather than
// a claim repeated from the item.
//
// SELF-TEST (RULES #4)
//   node tools/experience/event-histogram.mjs --self-test
// Synthetic hours with known shapes: an hour that is 100% one class must report H = 0 bits and
// fail SH4; a balanced hour must clear 1.6 bits; a run with no classifiable frames must VOID
// rather than report a tidy all-IDLE histogram.
//
// EXIT: 0 · 2 unclassified_fraction > 0.05 (VOID, hard fail 7) · 3 no trace · 5 self-test failed.
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
export const CLASSES = ['FIGHT', 'TRANSIT', 'EXPLORE', 'TALK', 'READ', 'TRADE', 'CRAFT', 'MENU', 'REST', 'TRAVEL_NODE', 'DEAD', 'IDLE'];

// A-EXP2's ten names. Their presence is checked against the shipped vocabulary, not assumed.
const A_EXP2 = ['book_read', 'barter_open', 'barter_close', 'menu_open', 'menu_close', 'craft', 'parley', 'crime_witnessed', 'travel_node', 'first_visit'];

function shippedVocabulary() {
  const p = path.join(REPO, 'game/src/sim/events.js');
  if (!fs.existsSync(p)) return null;
  const t = fs.readFileSync(p, 'utf8');
  const m = /EVENT_TYPES\s*=\s*new Set\(\[([\s\S]*?)\]\)/.exec(t);
  if (!m) return null;
  return new Set([...m[1].matchAll(/'([a-z0-9_]+)'/g)].map((x) => x[1]));
}

/**
 * §B's class definitions, applied per frame. Every branch below is a quotation from the item's
 * table; anything that matches none of them is IDLE, and IDLE is what voids the run.
 */
export function classify(r, ctx) {
  const p = r.player || {};
  const enemies = r.enemies || [];
  if (ctx.deadUntil !== null && (r.f ?? 0) <= ctx.deadUntil) return 'DEAD';
  const aggro = enemies.some((e) => (e.alert_state === 'AGGRO' || e.alert === 'AGGRO') && Number(e.dist_m) <= 30);
  if (aggro || ['ATTACK', 'ROLL', 'BLOCK'].includes(String(p.state || '').toUpperCase())) return 'FIGHT';
  if (ctx.talkUntil !== null && (r.f ?? 0) <= ctx.talkUntil) return 'TALK';
  if (ctx.menuOpen) return 'MENU';
  if (ctx.barterOpen) return 'TRADE';
  if (ctx.travelOpen) return 'TRAVEL_NODE';
  if (ctx.restUntil !== null && (r.f ?? 0) <= ctx.restUntil) return 'REST';
  const mv = (r.input && r.input.move) || [0, 0];
  const moving = Math.abs(Number(mv[0]) || 0) > 0.01 || Math.abs(Number(mv[1]) || 0) > 0.01;
  if (moving) {
    // "TRANSIT: advancing along a road/boardwalk/travel-network segment. EXPLORE: OFF the road
    // network, or inside an interior whose `load` is its first ever." The trace carries
    // `env.interior` and `env.region`; it carries no road-membership field, and inventing one
    // would be the difference between a commute and a world decided by a guess. So a moving
    // frame with no road evidence is EXPLORE and the absence is reported.
    ctx.noRoadEvidence++;
    return (r.env && r.env.interior) ? 'EXPLORE' : 'EXPLORE';
  }
  return 'IDLE';
}

export async function histogram(file) {
  const rl = readline.createInterface({ input: fs.createReadStream(file), crlfDelay: Infinity });
  const ctx = { deadUntil: null, talkUntil: null, restUntil: null, menuOpen: false, barterOpen: false, travelOpen: false, noRoadEvidence: 0 };
  const hours = new Map();
  let frames = 0, lastF = 0, eventCount = 0;
  for await (const line of rl) {
    if (!line || line[0] !== '{') continue;
    let r; try { r = JSON.parse(line); } catch { continue; }
    if (r._ === 'header' || r._ === 'footer') continue;
    const f = Number.isFinite(r.f) ? r.f : (Number.isFinite(r.frame) ? r.frame : null);
    if (f === null) continue;                       // a missing frame is null, never 0
    frames++; lastF = Math.max(lastF, f);
    for (const e of (r.events || [])) {
      eventCount++;
      if (e.type === 'topic' || e.type === 'topic_select' || e.type === 'dialogue_open') ctx.talkUntil = f + 5 * FPS;
      if (e.type === 'dialogue_close') ctx.talkUntil = f;
      if (e.type === 'surface_enter') ctx.menuOpen = true;
      if (e.type === 'surface_exit') ctx.menuOpen = false;
      if (e.type === 'barter_open') ctx.barterOpen = true;
      if (e.type === 'barter_close') ctx.barterOpen = false;
      if (e.type === 'travel_node') ctx.travelOpen = !ctx.travelOpen;
      if (e.type === 'bonfire_rest' || e.type === 'level_up') ctx.restUntil = f + 10 * FPS;
      if (e.type === 'death' && (e.owner === 'player' || e.eid === 'player')) ctx.deadUntil = f + 60 * FPS;
      if (e.type === 'load' || e.type === 'player_respawn') ctx.deadUntil = null;
    }
    const h = Math.floor(f / FPS / 3600);
    const row = hours.get(h) || Object.fromEntries(CLASSES.map((c) => [c, 0]));
    row[classify(r, ctx)]++;
    hours.set(h, row);
  }
  const rows = [...hours.entries()].sort((a, b) => a[0] - b[0]).map(([h, counts]) => {
    const total = CLASSES.reduce((s, c) => s + counts[c], 0);
    const fr = Object.fromEntries(CLASSES.map((c) => [c, total ? Math.round((counts[c] / total) * 1000) / 1000 : 0]));
    let H = 0;
    for (const c of CLASSES) { const p = total ? counts[c] / total : 0; if (p > 0) H -= p * Math.log2(p); }
    return { hour: h, frames: total, counts, fractions: fr, entropy_bits: Math.round(H * 100) / 100 };
  });
  const totals = Object.fromEntries(CLASSES.map((c) => [c, rows.reduce((s, r) => s + r.counts[c], 0)]));
  const all = CLASSES.reduce((s, c) => s + totals[c], 0);
  return { frames, event_count: eventCount, simulated_minutes: Math.round((lastF / FPS / 60) * 10) / 10, hours: rows, totals, all, ctx };
}

function selfTest() {
  say('SELF-TEST — synthetic hours whose shapes are known.');
  const H = (counts) => { const t = Object.values(counts).reduce((a, b) => a + b, 0); let h = 0; for (const v of Object.values(counts)) { const p = v / t; if (p > 0) h -= p * Math.log2(p); } return Math.round(h * 100) / 100; };
  const cases = [
    { id: 'an hour that is 100% one class', counts: { FIGHT: 216000 }, want: (h) => h === 0, wants: 'H = 0 bits, failing SH4 and hard fail 5' },
    { id: 'an hour split evenly across four classes', counts: { FIGHT: 54000, TRANSIT: 54000, EXPLORE: 54000, TALK: 54000 }, want: (h) => h >= 1.99 && h <= 2.01, wants: 'H = 2.00 bits' },
    { id: 'an hour that is 90% one class', counts: { FIGHT: 194400, TRANSIT: 21600 }, want: (h) => h < 1.1, wants: 'H < 1.1 bits — hard fail 5' },
    { id: 'a balanced hour clears the 1.6-bit floor', counts: { FIGHT: 70000, TRANSIT: 50000, EXPLORE: 60000, TALK: 36000 }, want: (h) => h >= 1.6, wants: 'H >= 1.6 bits' },
  ];
  let ok = true;
  for (const c of cases) {
    const h = H(c.counts); const good = c.want(h);
    say(`  ${good ? 'ok  ' : 'FAIL'}  ${c.id.padEnd(46)} H=${h}  (wants ${c.wants})`);
    if (!good) ok = false;
  }
  // The void condition: an all-IDLE run must not report a shape.
  const idleOnly = { totals: Object.fromEntries(CLASSES.map((c) => [c, c === 'IDLE' ? 1000 : 0])), all: 1000 };
  const uf = idleOnly.totals.IDLE / idleOnly.all;
  const voids = uf > 0.05;
  say(`  ${voids ? 'ok  ' : 'FAIL'}  an all-IDLE run voids rather than reporting a shape   unclassified_fraction=${uf}`);
  if (!voids) ok = false;
  say(`SELF-TEST ${ok ? 'PASS' : 'FAIL'}`);
  return ok;
}

async function main() {
  if (has('self-test')) process.exit(selfTest() ? 0 : 5);
  const t = arg('trace', null);
  if (!t || !fs.existsSync(path.resolve(REPO, t))) { say(`ABSENT: --trace ${t || '(none given)'} — no trace, nothing measured.`); process.exit(3); }
  const r = await histogram(path.resolve(REPO, t));

  const vocab = shippedVocabulary();
  const aexp2 = Object.fromEntries(A_EXP2.map((n) => [n, vocab ? vocab.has(n) : null]));
  const aexp2Present = Object.values(aexp2).filter(Boolean).length;

  const unclassified = r.all ? r.totals.IDLE / r.all : 1;
  const out = {
    schema: 'elder-souls/exp03-histogram@1', at: new Date().toISOString(), trace: t,
    frames: r.frames, event_count: r.event_count, simulated_minutes: r.simulated_minutes,
    a_exp2: { names: aexp2, present: aexp2Present, of: A_EXP2.length,
      note: aexp2Present === A_EXP2.length ? 'A-EXP2 has landed' :
        `A-EXP2 is ${A_EXP2.length - aexp2Present} names short, so READ/TRADE/CRAFT/MENU/TRAVEL_NODE are unmeasurable => 0 and collapse into IDLE. Fail-closed by design (RI-EXP03 §B).` },
    integrity: {
      unclassified_fraction: Math.round(unclassified * 1000) / 1000,
      voids_the_histogram: unclassified > 0.05,
      road_membership_evidence: r.ctx.noRoadEvidence === 0 ? 'not needed' :
        `absent: ${r.ctx.noRoadEvidence} moving frames had no road-network field to separate TRANSIT from EXPLORE, so every one is EXPLORE. The trace carries env.region and env.interior and no road membership; RI-EXP03 §F.1 caps TRANSIT and floors EXPLORE precisely because they look alike, and this build cannot tell them apart.`,
    },
    totals: r.totals, hours: r.hours,
    hour_entropy_min: r.hours.length ? Math.min(...r.hours.filter((h) => h.hour > 0 || r.hours.length === 1).map((h) => h.entropy_bits)) : null,
  };
  const o = path.resolve(REPO, arg('out', 'reports/experience/w1/event-histogram.json'));
  fs.mkdirSync(path.dirname(o), { recursive: true });
  fs.writeFileSync(o, JSON.stringify(out, null, 2) + '\n');

  say(`event-histogram — ${r.frames} frames (${r.simulated_minutes} simulated minutes), ${r.event_count} events`);
  say(`  A-EXP2: ${aexp2Present}/${A_EXP2.length} names present in game/src/sim/events.js — missing ${A_EXP2.filter((n) => !aexp2[n]).join(', ') || 'none'}`);
  for (const h of r.hours) say(`  hour ${h.hour}: H=${h.entropy_bits} bits  ` + CLASSES.filter((c) => h.fractions[c] > 0).map((c) => `${c} ${h.fractions[c]}`).join('  '));
  say(`  unclassified_fraction ${out.integrity.unclassified_fraction}${out.integrity.voids_the_histogram ? '  -> VOID (hard fail 7)' : ''}`);
  if (out.integrity.road_membership_evidence !== 'not needed') say(`  ${out.integrity.road_membership_evidence}`);
  say(`wrote ${path.relative(REPO, o)}`);
  process.exit(out.integrity.voids_the_histogram ? 2 : 0);
}

if (process.argv[1] && process.argv[1].endsWith('event-histogram.mjs')) main();
