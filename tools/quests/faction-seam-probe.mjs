#!/usr/bin/env node
// faction-seam-probe.mjs — W1-FACTIONS round 2. RI-MTH07 CONSUMPTION for the two models the
// round-1 verdict scored 0:
//
//   MODEL                                   WORLD-SIDE CONSUMER
//   RI-CRM02 §5 factionLawFactor            Engine.syncFactionStandings() -> sim.stealth.p.standings
//                                           -> sim/crime/sanction.js standingKey()
//                                           -> sim/crime/justice.js thresholds() -> guardBand()
//   RI-QST03 §D expulsion / readmission     QuestEngine.context() -> ctx.locked + lockedReason
//                                           -> sim/quest/gate.js canOffer() -> the offer goes away
//                                           with a sentence a giver would say
//
// Round 1 scored the first "0 — orphan, not shipped" and the second "0 — absent". The first was
// half wrong in an interesting way: `factionLawFactor` WAS implemented in sim/crime/justice.js
// and read `sim.stealth.p.standings`, which had exactly one writer in the whole build and that
// writer was the harness. So the arrest threshold moved for a probe and never for a player. This
// probe drives it the way a player does — join, earn rank, watch the guard.
//
// Every check has a control that must go the other way, because a probe that cannot fail is
// worse than no probe.

import { launchGame } from '../lib/browser.mjs';
import { parseArgs, wantsHelp, usage, writeJson } from '../lib/cli.mjs';

const USAGE = `
faction-seam-probe.mjs — does a faction rank reach a guard, and can a faction throw you out?

USAGE
  node tools/quests/faction-seam-probe.mjs [--out <file>] [--quiet]

Exit 0 = both models have a live world-side consumer and both perturbations bite.
`;
const args = parseArgs(process.argv.slice(2));
if (wantsHelp(args)) { usage(USAGE); process.exit(0); }
const QUIET = !!args.quiet;
const say = (s) => { if (!QUIET) process.stdout.write(s + '\n'); };
const out = { tool: 'faction-seam-probe', at: new Date().toISOString(), checks: [], failures: [], sections: {} };
const check = (id, ok, m) => { out.checks.push({ id, ok: !!ok, measured: m }); if (!ok) out.failures.push(`${id}: ${m}`); say(`  ${ok ? 'pass' : 'FAIL'}  ${id} — ${m}`); };

let handle;
try {
  handle = await launchGame({ ...args, width: 320, height: 240 });
  const page = handle.page;
  const perr = []; page.on('pageerror', (e) => perr.push(String(e).slice(0, 200)));
  await page.waitForFunction(() => !!window.__HARNESS, null, { timeout: 60000 });

  const r = await page.evaluate(() => {
    const H = window.__HARNESS; H.setRenderRate(0); const R = {};
    H.setCharacter({ race: 'saxhleel', upbringing: 'lukiul', class: 'ledger-hand', birthsign: 'raj-xul' });

    // ---- A. THE GUARD LADDER ---------------------------------------------------------------
    // Bounty held constant at 500 throughout. Only the standing moves.
    const band = () => H.getGuardBand({ bounty: 500 });
    R.a_nobody = band();

    // The register the guard reads, BEFORE anything is joined. If this is already populated the
    // rest of the section is measuring a leftover.
    R.a_standings_at_start = H.getSanctionState ? (H.getSanctionState().standings || null) : null;

    // Join the Wet Ledger the way a quest does — membership plus reputation — and then ask the
    // WORLD to derive the standing, rather than writing the standing ourselves.
    H.setFactionStanding('the_wet_ledger', { member: true, reputation: 40 });   // -> derived rank 3+
    R.a_synced_rank3 = H.syncFactionStandings();
    R.a_ledger_rank3 = band();

    H.setFactionStanding('the_wet_ledger', { member: true, reputation: 0 });
    H.setFactionStanding('the_xul_aneekh', { member: true, reputation: 60 });   // -> derived rank 4+
    R.a_synced_xula = H.syncFactionStandings();
    R.a_xula_rank4 = band();

    // CONTROL: reputation with NO membership. `heldRank()` requires an authored join, so the
    // standing must NOT move — a favour paid sideways is not a career.
    H.setFactionStanding('the_xul_aneekh', { member: false, reputation: 300 });
    H.setFactionStanding('the_wet_ledger', { member: false, reputation: 300 });
    R.a_synced_unjoined = H.syncFactionStandings();
    R.a_unjoined = band();

    // ---- B. EXPULSION ----------------------------------------------------------------------
    H.setFactionStanding('the_wet_ledger', { member: true, reputation: 300 });
    H.setFactionStanding('the_xul_aneekh', { member: false, reputation: 0 });
    // The baseline has to be non-zero or the section measures nothing: a line that was already
    // closed cannot be observed closing. Every Wet Ledger quest's own `opens_by` topics are
    // learned first, and the gate is then left to refuse or permit on its own terms.
    const ledgerIds = H.questBook().filter((id) => { try { const d = H.questDef(id); return d.rank_gate && d.rank_gate.faction === 'the_wet_ledger'; } catch (e) { return false; } });
    for (const id of ledgerIds) {
      const d = H.questDef(id);
      for (const t of [d.opens_by && d.opens_by.topic, ...((d.opens_by && d.opens_by.prerequisite_topics) || [])]) {
        if (t) { try { H.learnTopic(t); } catch (e) { /* not a topic this build knows */ } }
      }
    }
    const ledgerOffers = () => H.questOffers().filter((o) => /^Q-LEDG-/.test(o.id));
    R.b_declared = H.factionDiscipline().declared;
    R.b_offerable_before = ledgerOffers().filter((o) => o.offerable).map((o) => o.id);
    R.b_expelled_before = H.factionDiscipline().expelled;

    // The act: carry the Ledger's paired letters to the Assize. This is a flag a RESOLUTION
    // raises (Q-LEDG-11 res_to_the_assize); the probe raises it directly so the section is about
    // the discipline model and not about the walk.
    H.questSetFlag('assize_has_the_paired_letters', true);
    R.b_expelled_after = H.factionDiscipline().expelled;
    const after = ledgerOffers();
    R.b_offerable_after = after.filter((o) => o.offerable).map((o) => o.id);
    R.b_spoken_reason = (after.find((o) => !o.offerable && (o.why || []).some((w) => /will not deal with you/.test(w))) || {}).why;

    // CONTROL: a refusal must NOT expel. RI-QST02 D4.
    H.questSetFlag('assize_has_the_paired_letters', false);
    H.questSetFlag('ledger_first_chair_refused', true);
    H.questSetFlag('ledger_filed_a_refusal_against_the_player', true);
    R.b_control_refusal_expels = H.factionDiscipline().expelled.map((e) => e.faction);
    R.b_control_offerable = ledgerOffers().filter((o) => o.offerable).length;

    // ---- C. READMISSION ---------------------------------------------------------------------
    H.questSetFlag('assize_has_the_paired_letters', true);
    H.setGold(0);
    R.c_refused_no_gold = H.factionReadmit('the_wet_ledger');
    H.setGold(5000);
    const goldBefore = H.getGold();
    R.c_paid = H.factionReadmit('the_wet_ledger');
    R.c_gold_spent = goldBefore - H.getGold();
    R.c_expelled_after_paying = H.factionDiscipline().expelled.map((e) => e.faction);
    R.c_offerable_after_paying = ledgerOffers().filter((o) => o.offerable).map((o) => o.id);
    // CONTROL: a faction that never expelled you cannot be readmitted to.
    R.c_control_not_expelled = H.factionReadmit('the_imperial_assize');
    return R;
  });

  out.sections = r; out.page_errors = perr;
  const arrest = (b) => b && b.thresholds && b.thresholds.arrest_at;
  say(`\nbounty held at 500 throughout; only the standing moves`);
  say(`  no faction        standing=${JSON.stringify((r.a_nobody || {}).standing)} arrest_at=${arrest(r.a_nobody)} band=${(r.a_nobody || {}).band}`);
  say(`  Wet Ledger 3+     standing=${JSON.stringify((r.a_ledger_rank3 || {}).standing)} arrest_at=${arrest(r.a_ledger_rank3)} band=${(r.a_ledger_rank3 || {}).band}`);
  say(`  Xul-Aneekh 4+     standing=${JSON.stringify((r.a_xula_rank4 || {}).standing)} arrest_at=${arrest(r.a_xula_rank4)} band=${(r.a_xula_rank4 || {}).band}`);
  say(`  rep 300, no join  standing=${JSON.stringify((r.a_unjoined || {}).standing)} arrest_at=${arrest(r.a_unjoined)} band=${(r.a_unjoined || {}).band}`);

  check('S1_standing_starts_empty', !r.a_standings_at_start || Object.keys(r.a_standings_at_start).length === 0,
    `sim.stealth.p.standings before any join: ${JSON.stringify(r.a_standings_at_start)}`);
  check('S2_the_world_writes_the_standing', ((r.a_synced_rank3 || {})['wet-ledger'] || 0) >= 1 && ((r.a_synced_xula || {})['xul-aneekh'] || 0) >= 1,
    `joining and asking the WORLD to derive standings gave ${JSON.stringify(r.a_synced_rank3)} then ${JSON.stringify(r.a_synced_xula)} — no probe wrote this register, and before the fix nothing in gameplay ever did`);
  check('S3_the_guard_ladder_moves_with_rank', arrest(r.a_ledger_rank3) > arrest(r.a_nobody) && arrest(r.a_xula_rank4) < arrest(r.a_nobody),
    `arrest threshold at bounty 500: none ${arrest(r.a_nobody)} -> Wet Ledger 3+ ${arrest(r.a_ledger_rank3)} -> Xul-Aneekh 4+ ${arrest(r.a_xula_rank4)}; spread ${(arrest(r.a_ledger_rank3) / arrest(r.a_xula_rank4)).toFixed(2)}x`);
  check('S4_the_guard_BEHAVIOUR_changes', (r.a_ledger_rank3 || {}).band !== (r.a_xula_rank4 || {}).band,
    `same bounty, same race, same guard: band ${(r.a_ledger_rank3 || {}).band} (${(r.a_ledger_rank3 || {}).behaviour}) as a Ledger officer, band ${(r.a_xula_rank4 || {}).band} (${(r.a_xula_rank4 || {}).behaviour}) as Xul-Aneekh`);
  check('S5_CONTROL_reputation_without_joining_moves_nothing', JSON.stringify(r.a_synced_unjoined) === '{}' && arrest(r.a_unjoined) === arrest(r.a_nobody),
    `reputation 300 in two factions with member:false -> standings ${JSON.stringify(r.a_synced_unjoined)}, arrest_at ${arrest(r.a_unjoined)} against the no-faction ${arrest(r.a_nobody)}`);

  check('S6_expulsion_closes_the_line', (r.b_offerable_after || []).length < (r.b_offerable_before || []).length && (r.b_expelled_after || []).length === 1,
    `carrying the Ledger's paired letters to the Assize expelled ${JSON.stringify((r.b_expelled_after || []).map((e) => e.faction))} and took Wet Ledger offers ${(r.b_offerable_before || []).length} -> ${(r.b_offerable_after || []).length}`);
  check('S7_expulsion_is_legible', !!r.b_spoken_reason,
    `the sentence a giver speaks: ${JSON.stringify(r.b_spoken_reason)}`);
  check('S8_CONTROL_a_refusal_does_not_expel', (r.b_control_refusal_expels || []).length === 0 && r.b_control_offerable > 0,
    `with both refusal flags up and the betrayal flag down: expelled ${JSON.stringify(r.b_control_refusal_expels)}, ${r.b_control_offerable} Wet Ledger quests still offerable — RI-QST02 D4 holds`);
  check('S9_readmission_has_a_price_and_names_it', r.c_refused_no_gold && r.c_refused_no_gold.ok === false && r.c_refused_no_gold.shortfall_g > 0,
    `at 0 gold: ${JSON.stringify(r.c_refused_no_gold)}`);
  check('S10_paying_it_lets_you_back_in', r.c_paid && r.c_paid.ok === true && (r.c_expelled_after_paying || []).length === 0 && (r.c_offerable_after_paying || []).length > 0,
    `paid ${r.c_gold_spent} gold, reputation ${r.c_paid && r.c_paid.reputation_after}, expelled now ${JSON.stringify(r.c_expelled_after_paying)}, ${(r.c_offerable_after_paying || []).length} Wet Ledger quests offerable again`);
  check('S11_CONTROL_cannot_be_readmitted_where_you_were_never_expelled', r.c_control_not_expelled && r.c_control_not_expelled.ok === false,
    `factionReadmit on a faction that never threw you out -> ${JSON.stringify(r.c_control_not_expelled)}`);
  check('S12_page_errors_zero', perr.length === 0, `${perr.length} page errors${perr.length ? `: ${perr.join(' | ')}` : ''}`);

  out.ok = out.failures.length === 0;
  if (args.out) writeJson(args.out, out);
  say(`\n${out.ok ? 'PASS' : 'FAIL'} — ${out.checks.filter((c) => c.ok).length}/${out.checks.length} checks`);
  await handle.close();
  process.exit(out.ok ? 0 : 1);
} catch (e) {
  console.error(String((e && e.stack) || e));
  if (args.out) writeJson(args.out, { ...out, error: String(e).slice(0, 500) });
  if (handle) await handle.close().catch(() => {});
  process.exit(2);
}
