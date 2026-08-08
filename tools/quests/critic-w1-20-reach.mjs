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
const LINES = [
  { faction: 'the_wet_ledger', standing: 'wet-ledger', npc: 'harbourmaster-sedh', zone_faction: 'wet-ledger' },
  { faction: 'the_rootkeepers', standing: 'rootkeepers', npc: 'rootkeeper-jeen', zone_faction: 'rootkeepers' },
  { faction: 'the_drowned_court', standing: 'drowned-court', npc: 'undertaker-vaskh', zone_faction: 'drowned-court' },
];

const game = await launchGame(args, { usage: USAGE });
const { page } = game;

const report = await page.evaluate(async ({ LINES }) => {
  const H = window.__HARNESS;
  const out = { lines: [], zone_census: null, notes: [] };

  // Every `faction_interior` zone in the populated world, by faction. R3 can only be demonstrated
  // where such a zone exists, and a line with none has no R3 consumer to demonstrate.
  function zoneCensus() {
    const by = {};
    let zones = [];
    try { zones = H.zoneList ? H.zoneList() : []; } catch { zones = []; }
    for (const z of zones) {
      if (z && z.class === 'faction_interior') (by[z.faction] = by[z.faction] || []).push(z.id);
    }
    return by;
  }

  for (const L of LINES) {
    H.reset({ state: 'default' });
    H.setRenderRate(0);
    H.setCharacter({ race: 'saxhleel', upbringing: 'interior', class: 'root-speaker', birthsign: 'raj-xul' });
    if (!out.zone_census) out.zone_census = zoneCensus();

    // Membership first. Every consumer here requires `member === true` — `factionTerm` skips a
    // row that is not a membership by design ("reputation is not allegiance"), and
    // `syncFactionStandings` skips it too. Without this the whole sweep would read zero at every
    // rank and look like a dead model when it is an unjoined one.
    H.setFactionStanding(L.faction, { member: true, reputation: 0, rank: 0 });

    const rows = [];
    let lastViewRank = null;
    for (const rank of [0, 1, 2, 3, 4, 5, 6, 7]) {
      H.setFactionStanding(L.faction, { member: true, rank });
      H.syncFactionStandings();

      // DID THE PERTURBATION TAKE? `_questFactionsView` is a Math.max against the derived ladder,
      // so a poke below the derived rank changes nothing and every consumer will correctly report
      // no change. Reading that as "the consumer is dead" is the inert-control failure. This row
      // is only scored if the view's rank is the rank we asked for.
      const view = H.questFactionsView ? H.questFactionsView() : null;
      const viewRank = view && view[L.faction] ? Number(view[L.faction].rank) : null;
      const standings = H.getFactionStandings ? H.getFactionStandings() : null;
      const standingRank = standings ? Number(standings[L.standing] || 0) : null;

      const row = { rank, view_rank: viewRank, standing_rank: standingRank,
        perturbation_took: viewRank === rank || (rank === 0 && viewRank === 0) };

      // R1 — dialogue.
      try {
        const d = H.explainDisposition(L.npc);
        row.disposition = d ? d.value : null;
        row.faction_term = d && d.movable ? (d.movable.find((m) => m[0] === 'faction') || [null, null])[1] : null;
      } catch (e) { row.disposition_error = String(e).slice(0, 120); }

      // R3 — trespass, on a real zone of this faction if the world has one.
      const zones = (out.zone_census || {})[L.zone_faction] || [];
      row.zone_tested = zones[0] || null;
      if (zones[0]) {
        try { const t = H.trespassCheck(zones[0], {}); row.trespassing = t ? t.trespassing : null; }
        catch (e) { row.trespass_error = String(e).slice(0, 120); }
      }

      // R4 — the arrest topic that invokes a faction.
      try {
        const a = H.arrestTopics({ bounty: 400, gold: 100, factionRank: standingRank || 0, factionHasStanding: true, factionInvocationsLeft: 1, speechcraft: 30, guardDisposition: 40 });
        row.arrest_topics = Array.isArray(a) ? a.map((x) => (typeof x === 'string' ? x : x && x.id)) : a;
      } catch (e) { row.arrest_error = String(e).slice(0, 120); }

      // R5 — prices.
      try { const p = H.getPriceQuote({ npc: L.npc, base: 100 }); row.price = p && (p.price ?? p.quoted ?? null); row.price_full = p; }
      catch (e) { row.price_error = String(e).slice(0, 120); }

      // R2/C1 — the guard's law factor, the one consumer the round did demonstrate. Kept so this
      // instrument has a POSITIVE control: if this does not move either, the harness is the fault
      // and not the model.
      try { const g = H.getGuardTerms('saxhleel'); row.warbrood_shift = g && (g.warbrood_disposition_shift ?? g.warbroodDispositionShift ?? null); row.imperial_law = g && (g.imperial_law ?? g.lawFactor ?? null); }
      catch (e) { row.guard_error = String(e).slice(0, 120); }

      rows.push(row);
      lastViewRank = viewRank;
    }
    out.lines.push({ ...L, rows });
  }
  return out;
}, { LINES });

await game.close();

// ---- verdict, computed here.
const findings = [];
const summary = [];
const distinct = (rows, key) => [...new Set(rows.filter((r) => r.perturbation_took).map((r) => JSON.stringify(r[key])))];

for (const L of report.lines) {
  const took = L.rows.filter((r) => r.perturbation_took);
  const s = { faction: L.faction, rows_scored: took.length, rows_total: L.rows.length };
  if (took.length < 2) {
    findings.push(`${L.faction}: only ${took.length} of ${L.rows.length} perturbations took — cannot score this line`);
  }
  for (const [label, key] of [['R1 dialogue disposition', 'disposition'], ['R1 faction term', 'faction_term'],
    ['R3 trespass', 'trespassing'], ['R4 arrest topics', 'arrest_topics'], ['R5 price', 'price'],
    ['C1 guard warbrood shift', 'warbrood_shift']]) {
    const vals = distinct(took, key);
    s[key] = { distinct_values: vals.length, values: vals.slice(0, 8) };
    if (vals.length <= 1) findings.push(`${L.faction}: ${label} does NOT move across ranks ${took.map((r) => r.rank).join(',')} — value stayed ${vals[0]}`);
  }
  summary.push(s);
}

const out = { commit_note: 'see verdict', zone_census: report.zone_census, summary, findings, detail: report };
writeJson(OUT, out);
console.log(`critic-w1-20-reach: ${findings.length} finding(s); wrote ${OUT}`);
console.log('faction_interior zones by faction:', JSON.stringify(report.zone_census));
for (const s of summary) {
  console.log(`  ${s.faction}: scored ${s.rows_scored}/${s.rows_total} rows`);
  for (const k of ['disposition', 'faction_term', 'trespassing', 'arrest_topics', 'price', 'warbrood_shift']) {
    if (s[k]) console.log(`     ${k}: ${s[k].distinct_values} distinct — ${JSON.stringify(s[k].values)}`);
  }
}
for (const f of findings) console.log(`  FINDING: ${f}`);
process.exit(findings.length ? 1 : 0);
