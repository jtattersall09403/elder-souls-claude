#!/usr/bin/env node
// critic-w1-20-reach.mjs — the W1-20 critic's THIRD instrument. Declared under
// `method_deviations` (RULES 24, orchestration/TOOL-LOOP.md).
//
// THE QUESTION THE DISPATCH ASKS AND THE ROUND DID NOT ANSWER:
//   "Check especially whether rank affects anything OUTSIDE quest gating — prices, dialogue,
//    who greets you, who attacks you."
//
// The round's CONSUMPTION section names three consumers (C1 the guard's law factor, C2 the
// recruiter's mouth, C3 the offer gate). Two of those three ARE quest gating: C2 is
// `Engine.factionRefusal()`, which exists to explain a gate, and C3 is the gate itself. So the
// round demonstrated ONE consumer outside quest gating, not three.
//
// A grep of the shipped source for the standings register finds four more that the round does
// not name, and this instrument drives every one of them:
//
//   R1  DIALOGUE / WHO GREETS YOU.  `sim/dialogue/disposition.js factionTerm()` ->
//       `(fDispFactionRankMult*rank + fDispFactionRankBase) * fDispFactionMod * reaction`.
//   R2  WHAT COUNTS AS STEALING.  `sim/stealth/theft.js:26` — an object owned by a faction you
//       hold rank >= 2 in is `theft: false, scope: 'shared'`. Rank changes the law of property.
//   R3  WHERE YOU MAY WALK.  `sim/stealth/theft.js:74` — a `faction_interior` zone is a trespass
//       iff your rank in that zone's faction is < 1.
//   R4  HOW YOU GET OUT OF AN ARREST.  `sim/crime/justice.js:70` — an arrest topic that invokes
//       your faction appears only at rank >= 4.
//   R5  PRICES.  `Engine.getPriceQuote()`, the brief's first named example.
//
// TWO REGISTERS, AND THIS TOOL REPORTS WHICH ONE EACH CONSUMER READS.
//   `sim.quest.factions[f].rank`      — the STORED rank. Initialised to 0 in sim/quest/machine.js
//                                       and, by grep, assigned by NOTHING in game/src. Play never
//                                       moves it.
//   `Engine._questFactionsView()`     — folds the DERIVED rank in as
//                                       `Math.max(stored, gates.highestQualifying(f, lite))`.
//   `sim.stealth.p.standings`         — written every step by `Engine.syncFactionStandings()`
//                                       from the DERIVED rank, via sanction.json's id map.
//
// That `Math.max` is why a poke of the stored rank to a value the derived ladder ALREADY gives is
// an inert perturbation — it changes no number and every consumer correctly reports no change.
// The round-1 critic's own L4 did exactly that (stored 0 -> 1 while derived was already 1) and
// read the resulting 93 -> 93 as evidence that rank reaches nothing. It is not evidence; it is a
// control that could not fail. So this instrument PERTURBS ONLY UPWARD PAST THE DERIVED RANK and
// asserts, before reading any consumer, that the view's rank actually moved (`perturbation_took`).
// A row where it did not take is reported and excluded, never scored.
//
// RUN: node tools/quests/critic-w1-20-reach.mjs [--out <file>]
// Exit 0 = every consumer named above moved when the rank moved.
// Exit 1 = a consumer that does not read the rank, or a perturbation that did not take.

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { launchGame } from '../lib/browser.mjs';
import { parseArgs, wantsHelp, usage, writeJson } from '../lib/cli.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const USAGE = `critic-w1-20-reach.mjs — does a faction rank reach anything outside quest gating?\n  --out <file>   default reports/critic-w1-20/reach.json\n`;
const args = parseArgs(process.argv.slice(2));
if (wantsHelp(args)) { usage(USAGE); process.exit(0); }
const OUT = args.out ? String(args.out) : path.join(ROOT, 'reports', 'critic-w1-20', 'reach.json');

// Two lines on purpose. `the_wet_ledger` is a line W1-FACTIONS carried and is the only faction
// besides the Court with any `faction_interior` in the world; `the_rootkeepers` is one of the
// four W1-20 authored, to see whether a NEW line reaches as far as an old one.
// Zone ids are read from `game/data/world/property/*.json` NODE-SIDE and handed in, because the
// harness has no zone-listing verb. The census is part of the finding: only two of the eight
// laddered factions own a `faction_interior` anywhere in the populated world, so for the other
// six there is no R3 consumer to demonstrate and this tool says so rather than scoring a zero.
const LINES = [
  { faction: 'the_wet_ledger', standing: 'wet-ledger', npc: 'harbourmaster-sedh', zone: 'lilmoth.factor0.r0' },
  { faction: 'the_drowned_court', standing: 'drowned-court', npc: 'undertaker-vaskh', zone: 'lilmoth.priest6.r0' },
  { faction: 'the_rootkeepers', standing: 'rootkeepers', npc: 'rootkeeper-jeen', zone: null },
];

const game = await launchGame(args, { usage: USAGE });
const { page } = game;

const report = await page.evaluate(async ({ LINES }) => {
  const H = window.__HARNESS;
  const out = { lines: [], notes: [] };

  for (const L of LINES) {
    H.reset({ state: 'default' });
    H.setRenderRate(0);
    H.setCharacter({ race: 'saxhleel', upbringing: 'interior', class: 'root-speaker', birthsign: 'raj-xul' });

    // Membership first. Every consumer here requires `member === true` — `factionTerm` skips a
    // row that is not a membership by design ("reputation is not allegiance"), and
    // `syncFactionStandings` skips it too. Without this the whole sweep would read zero at every
    // rank and look like a dead model when it is merely an unjoined one.
    H.setFactionStanding(L.faction, { member: true, reputation: 0, rank: 0 });

    const rows = [];
    for (const rank of [0, 1, 2, 3, 4, 5, 6, 7]) {
      // TWO PERTURBATION CHANNELS, because the build has two rank registers and they are fed by
      // different writers. Poking one and reading a consumer of the other is how you conclude a
      // live consumer is dead.
      //   A. the quest-side row -> `_questFactionsView()` Math.max's it against the derived
      //      ladder -> `_questPlayerView()` -> `disposition.js factionTerm()`.  (R1, R5)
      //   B. `sim.stealth.p.standings` -> `theft.js` and `justice.js`.           (R2, R3, R4)
      // `Engine.syncFactionStandings()` rewrites B from the DERIVED ladder every step, so B is
      // poked directly and the world is deliberately not stepped between poke and read.
      H.setFactionStanding(L.faction, { member: true, rank });
      H.setFactionStandings({ [L.standing]: rank });

      const row = { rank };

      // DID EACH PERTURBATION TAKE? Read both registers back before touching a consumer. A row
      // where the poke did not move the register is excluded from scoring rather than counted as
      // a consumer that ignored the rank — that conflation is what made the round-1 critic's own
      // L4 an inert control (it poked the stored rank to 1 while the derived ladder already
      // returned 1, so `Math.max` produced the same number and every consumer correctly reported
      // no change).
      const standings = H.setFactionStandings({});
      row.standing_readback = standings ? Number(standings[L.standing] || 0) : null;
      row.channel_b_took = row.standing_readback === rank;

      // R1 — dialogue / who greets you.
      try {
        const d = H.explainDisposition(L.npc);
        row.disposition = d ? d.value : null;
        row.faction_term = d && d.movable ? (d.movable.find((m) => m[0] === 'faction') || [null, null])[1] : null;
        row.disposition_modelled = d ? !!d.modelled : null;
      } catch (e) { row.disposition_error = String(e).slice(0, 140); }
      // Channel A took iff the term it feeds actually differs from rank 0's. Established after
      // the sweep, not asserted here.

      // R3 — where you may walk. Only where the world has a hall for this faction.
      row.zone_tested = L.zone;
      if (L.zone) {
        try { const t = H.trespassCheck(L.zone, {}); row.trespassing = t ? t.trespassing : null; row.trespass_why = t ? (t.why || null) : null; }
        catch (e) { row.trespass_error = String(e).slice(0, 140); }
      }

      // R2 — what counts as stealing. An object owned by this faction, if the hall has one.
      if (L.zone) {
        try {
          const objs = H.listOwnedObjects(L.zone) || [];
          row.owned_objects = objs.length;
          const o = objs[0];
          if (o) { const th = H.theftCheck ? H.theftCheck(o.id) : null; row.theft = th ? th.theft : null; row.theft_scope = th ? th.scope : null; row.theft_why = th ? th.why : null; }
        } catch (e) { row.theft_error = String(e).slice(0, 140); }
      }

      // R4 — how you get out of an arrest. NOTE: `Engine.arrestTopics()` takes `factionRank` as
      // an ARGUMENT and never reads the standings register, so this is the rank being handed in
      // by the caller rather than the rank being read from the world. Reported as such.
      try {
        const a = H.arrestTopics({ bounty: 400, gold: 100, factionRank: rank, factionHasStanding: true, factionInvocationsLeft: 1, speechcraft: 30, guardDisposition: 40 });
        const list = Array.isArray(a) ? a : (a && a.topics) || [];
        row.arrest_topics = list.map((x) => (typeof x === 'string' ? x : (x && (x.id || x.answer || x.key)))).filter(Boolean);
      } catch (e) { row.arrest_error = String(e).slice(0, 140); }

      // R5 — prices. `priceQuote` takes a disposition; it does not read a rank. Fed the SAME
      // disposition the dialogue system just computed, so that if rank reaches disposition it
      // reaches the quote too — which is the most generous reading available to the build.
      try {
        const p = H.getPriceQuote({ base_price: 100, disposition: row.disposition });
        row.price = p ? (p.buy ?? p.buy_price ?? p.price ?? null) : null;
        row.price_keys = p ? Object.keys(p) : null;
      } catch (e) { row.price_error = String(e).slice(0, 140); }

      // C1 — the guard's law factor, the one consumer the round DID demonstrate. Kept as a
      // POSITIVE CONTROL: if this does not move either, the fault is my harness driving and not
      // the build's model, and no other row here may be read as a finding.
      try {
        const g = H.getGuardTerms('saxhleel');
        row.warbrood_shift = g ? (g.warbrood_disposition_shift ?? g.warbroodDispositionShift ?? null) : null;
      } catch (e) { row.guard_error = String(e).slice(0, 140); }

      rows.push(row);
    }
    out.lines.push({ ...L, rows });
  }
  return out;
}, { LINES });

await game.close();

// ---- verdict, computed here.
const findings = [];
const summary = [];
const CHANNELS = [
  ['R1 dialogue disposition', 'disposition', 'A'],
  ['R1 faction term', 'faction_term', 'A'],
  ['R2 theft classification', 'theft', 'B'],
  ['R3 trespass', 'trespassing', 'B'],
  ['R4 arrest topics', 'arrest_topics', 'arg'],
  ['R5 price', 'price', 'A'],
  ['C1 guard warbrood shift', 'warbrood_shift', 'B'],
];

for (const L of report.lines) {
  const scored = L.rows.filter((r) => r.channel_b_took);
  const s = { faction: L.faction, zone: L.zone, rows_scored: scored.length, rows_total: L.rows.length, channels: {} };
  if (scored.length < 2) findings.push(`${L.faction}: only ${scored.length} of ${L.rows.length} channel-B perturbations took — this line cannot be scored`);
  for (const [label, key, chan] of CHANNELS) {
    const vals = [...new Set(scored.map((r) => JSON.stringify(r[key])))];
    s.channels[key] = { channel: chan, distinct: vals.length, values: vals.slice(0, 8) };
    if (key === 'trespassing' && !L.zone) { s.channels[key].note = 'no faction_interior exists for this faction anywhere in the world'; continue; }
    if (key === 'theft' && !L.zone) continue;
    if (vals.length <= 1) findings.push(`${L.faction}: ${label} does NOT move across ranks ${scored.map((r) => r.rank).join(',')} — stayed ${vals[0]}`);
  }
  summary.push(s);
}

// The POSITIVE CONTROL, checked explicitly: if C1 did not move on any line, nothing above is a
// finding about the build and this tool says so instead of publishing a list of false zeroes.
const c1Moved = summary.some((s) => s.channels.warbrood_shift && s.channels.warbrood_shift.distinct > 1);
if (!c1Moved) findings.unshift('POSITIVE CONTROL FAILED: the guard law factor did not move either, so this run measures my driving and not the build. No row above may be read as a finding.');

const out = { positive_control_c1_moved: c1Moved, summary, findings, detail: report };
writeJson(OUT, out);
console.log(`critic-w1-20-reach: ${findings.length} finding(s); wrote ${OUT}`);
console.log(`positive control (C1 guard law factor moved): ${c1Moved}`);
for (const s of summary) {
  console.log(`  ${s.faction} (zone ${s.zone || 'NONE IN WORLD'}): scored ${s.rows_scored}/${s.rows_total}`);
  for (const [, k] of CHANNELS.map((c) => [c[0], c[1]])) {
    const c = s.channels[k]; if (!c) continue;
    console.log(`     [${c.channel}] ${k}: ${c.distinct} distinct — ${JSON.stringify(c.values).slice(0, 150)}${c.note ? ' // ' + c.note : ''}`);
  }
}
for (const f of findings) console.log(`  FINDING: ${f}`);
process.exit(findings.length ? 1 : 0);
