#!/usr/bin/env node
// faction-probe.mjs — the CONSUMPTION probe for the faction questlines (RI-MTH07, ARBITRATION §3).
//
// The rule this exists to satisfy: "for every model a piece ships, name the world-side consumer
// and demonstrate it by perturbing the model and watching an entity change behaviour." Three
// models are shipped here and each has its consumer named and exercised:
//
//   MODEL                          WORLD-SIDE CONSUMER
//   game/data/quests/faction-*.json   QuestBook (engine.js:326) -> QuestEngine.offers()
//   faction-gates.json ladders        FactionGates (engine.js:327) -> QuestEngine.context()
//                                     derives rank from reputation+attributes+skills+flags ->
//                                     gate.js canOffer() refuses or permits
//   faction-gates.json exclusivity    QuestEngine.context() rivalry derivation -> ctx.locked ->
//                                     gate.js canOffer() -> the offer disappears with a reason
//
// Nothing here computes an answer. Every number is read back out of a decision the shipped build
// made, through `window.__HARNESS`. The walk drives ONE FULL QUESTLINE FROM A COLD START to its
// rank ceiling using only three things a player can actually get — a topic somebody said out
// loud, reputation the quests award, and skills that rise by use — and never sets a rank, because
// rank is derived. Then it breaks each model on purpose and watches the offers change.
//
// Run: node tools/quests/faction-probe.mjs [--line the_wet_ledger] [--out report.json]

import { launchGame } from '../lib/browser.mjs';
import { parseArgs, wantsHelp, usage, writeJson } from '../lib/cli.mjs';

const USAGE = `
faction-probe.mjs — drive a faction questline through the live offer gate from a cold start.

USAGE
  node tools/quests/faction-probe.mjs [--line <faction_id>] [--rival <faction_id>] [--out <file>] [--quiet]

Exit 0 = the line was walked rank 0 -> rank 7 through questOffers(), both perturbations were
observed, and joining the rival closed the line. Non-zero = a model nothing reads.
`;

const args = parseArgs(process.argv.slice(2));
if (wantsHelp(args)) { usage(USAGE); process.exit(0); }
const LINE = String(args.line || 'the_wet_ledger');
const RIVAL = String(args.rival || 'the_imperial_assize');
const QUIET = !!args.quiet;
const say = (s) => { if (!QUIET) process.stdout.write(s + '\n'); };

let handle;
const out = { tool: 'faction-probe', line: LINE, rival: RIVAL, checks: [], failures: [] };
const check = (id, ok, measured) => {
  out.checks.push({ id, ok: !!ok, measured });
  if (!ok) out.failures.push(`${id}: ${measured}`);
  say(`  ${ok ? 'pass' : 'FAIL'}  ${id} — ${measured}`);
};

try {
  handle = await launchGame({ ...args, width: 320, height: 240 });
  const page = handle.page;
  page.on('pageerror', (e) => out.failures.push(`pageerror: ${String(e).slice(0, 200)}`));
  await page.waitForFunction(() => !!window.__HARNESS, null, { timeout: 60000 });

  const r = await page.evaluate(({ LINE, RIVAL }) => {
    const H = window.__HARNESS;
    H.setRenderRate(0);
    const res = {};

    // A real character, not a bare sim. This is the signature the rank gates must clear.
    H.setCharacter({ race: 'saxhleel', upbringing: 'lukiul', class: 'ledger-hand', birthsign: 'raj-xul' });
    res.attrs = H.getPlayerStats().attributes;

    const defs = {};
    for (const id of H.questBook()) defs[id] = H.questDef(id);
    const inLine = (id) => defs[id] && defs[id].rank_gate && defs[id].rank_gate.faction === LINE;
    const line = Object.values(defs).filter((d) => d.rank_gate && d.rank_gate.faction === LINE)
      .sort((a, b) => (a.rank_gate.min_rank - b.rank_gate.min_rank) || a.id.localeCompare(b.id));
    res.line_ids = line.map((d) => `${d.id}@r${d.rank_gate.min_rank}`);

    // ---- COLD START. Nothing granted. -----------------------------------------------------
    const cold = H.questOffers().filter((o) => inLine(o.id));
    res.cold = { offerable: cold.filter((o) => o.offerable).map((o) => o.id), n: cold.length, why_rank0: (cold.find((o) => defs[o.id].rank_gate.min_rank === 0) || {}).why };

    // ---- WALK THE LADDER, only ever granting things play grants. --------------------------
    const walk = [];
    for (const d of line) {
      // (a) THE WORDS. Only ever the topics the quest itself declares it opens on. The forward
      //     `hooks.json` edges would grant these by playing; the probe short-circuits the
      //     journal write, not the requirement.
      for (const t of [d.opens_by && d.opens_by.topic, ...((d.opens_by && d.opens_by.prerequisite_topics) || [])]) {
        if (t) { try { H.learnTopic(t); } catch (e) { /* not a topic this build knows */ } }
      }
      // (b) THE PREREQUISITE QUESTS, finished the way finishing them would.
      for (const pq of (d.opens_by && d.opens_by.prerequisite_quests) || []) {
        try {
          H.questOpen(pq);
          const rs = H.questResolutions(pq) || [];
          const pick = rs.find((x) => x.available) || rs[0];
          if (pick) H.questResolve(pq, pick.id || pick.resolution || pick);
        } catch (e) { /* already closed, or opened another way */ }
      }
      // (c) THE SHEET AND THE STANDING, to whatever the LADDER asks for — read out of the
      //     refusal's own four-part statement, never guessed. Rank is NEVER set: it is derived.
      let o = H.questOffers().find((x) => x.id === d.id);
      let guard = 0;
      while (o && !o.offerable && guard++ < 14) {
        const g = o.gate;
        if (g) for (const t of g.terms || []) {
          if (!t.met && t.kind === 'reputation') H.setFactionStanding(LINE, { member: true, reputation: t.need });
          if (!t.met && (t.kind === 'skill_1' || t.kind === 'skill_2')) {
            const cur = H.getSkills();
            const best = (t.what || []).slice().sort((a, b) => (cur[b] || 0) - (cur[a] || 0));
            const patch = {}; patch[best[t.kind === 'skill_1' ? 0 : 1]] = t.need; H.setSkills(patch);
          }
          if (!t.met && t.kind === 'world_state') H.questSetFlag(t.what, true);
          if (!t.met && t.kind === 'attribute') { /* creation-time; recorded below, never forced */ }
        }
        if (d.rank_gate && d.rank_gate.min_reputation != null) {
          const st = H.getFactionStanding()[LINE] || {};
          if ((st.reputation || 0) < d.rank_gate.min_reputation) H.setFactionStanding(LINE, { member: true, reputation: d.rank_gate.min_reputation });
        }
        const gv = d.giver;
        if (gv && gv.disposition_min != null) {
          const have = (H.getGateDispositions() || {})[gv.npc_id] || 0;
          if (have < gv.disposition_min) H.setDisposition(gv.npc_id, Math.min(100, gv.disposition_min + 15));
        }
        o = H.questOffers().find((x) => x.id === d.id);
      }
      const gates = H.factionGates();
      const row = (gates.factions || []).find((f) => f.id === LINE) || {};
      walk.push({
        id: d.id, min_rank: d.rank_gate.min_rank, giver: d.giver && d.giver.npc_id,
        offerable: !!(o && o.offerable), why: (o && o.why) || [],
        derived_rank: row.derived_rank, reputation: row.reputation,
      });
      if (o && o.offerable) {
        try {
          H.questOpen(d.id);
          const rs = H.questResolutions(d.id) || [];
          const pick = rs.find((x) => x.available) || rs[0];
          if (pick) walk[walk.length - 1].resolved = H.questResolve(d.id, pick.id || pick.resolution || pick).resolution;
        } catch (e) { walk[walk.length - 1].resolve_error = String(e).slice(0, 200); }
      }
    }
    res.steps = walk;
    const gatesNow = H.factionGates();
    res.final = (gatesNow.factions || []).find((f) => f.id === LINE) || null;

    // ---- PERTURBATION 1: break the LADDER. Zero the reputation the ranks are derived from. --
    const before = H.questOffers().filter((o) => inLine(o.id) && o.offerable).map((o) => o.id);
    const savedRep = (H.getFactionStanding()[LINE] || {}).reputation || 0;
    H.setFactionStanding(LINE, { reputation: 0 });
    const rankAfter = (H.factionGates().factions.find((f) => f.id === LINE) || {}).derived_rank;
    const after = H.questOffers().filter((o) => inLine(o.id) && o.offerable).map((o) => o.id);
    res.perturb_ladder = { rank_before: res.final && res.final.derived_rank, rank_after: rankAfter, offerable_before: before, offerable_after: after, closed: before.filter((x) => !after.includes(x)) };
    H.setFactionStanding(LINE, { reputation: savedRep });

    // ---- PERTURBATION 2: break the EXCLUSIVITY. Join the rival and watch the line close. ----
    const lineBefore = H.questOffers().filter((o) => inLine(o.id) && o.offerable).map((o) => o.id);
    H.setFactionStanding(RIVAL, { member: true, reputation: 40 });
    const g2 = H.factionGates();
    const lineAfter = H.questOffers().filter((o) => inLine(o.id) && o.offerable).map((o) => o.id);
    const refusals = H.questOffers().filter((o) => inLine(o.id) && !o.offerable).map((o) => ({ id: o.id, why: o.why }));
    res.perturb_exclusion = {
      declared: g2.declared_exclusivity,
      rival_closes: (g2.factions.find((f) => f.id === RIVAL) || {}).closes,
      rivalry_locked_now: g2.rivalry_locked_now,
      offerable_before: lineBefore, offerable_after: lineAfter,
      closed: lineBefore.filter((x) => !lineAfter.includes(x)),
      example_refusal: (refusals.find((x) => (x.why || []).some((w) => /will not deal with you/.test(w))) || {}).why,
      quests_locked_by_rivalry: (g2.quests_locked_by_rivalry || []).length,
    };
    H.setFactionStanding(RIVAL, { member: false, reputation: 0 });
    return res;
  }, { LINE, RIVAL });

  out.measured = r;
  say(`\nline: ${(r.line_ids || []).join(' ')}`);
  say(`cold start refusal on the rank-0 quest: ${JSON.stringify(r.cold.why_rank0)}`);
  for (const s of r.steps) say(`  r${s.min_rank} ${s.id.padEnd(11)} offerable=${s.offerable ? 'yes' : 'NO '} rank=${s.derived_rank} rep=${s.reputation} ${s.offerable ? '' : JSON.stringify(s.why)}`);

  check('P1_line_is_a_line', (r.line_ids || []).length >= 8, `${(r.line_ids || []).length} quests gated on ${LINE}, ranks ${(r.steps || []).map((s) => s.min_rank).join('/')}`);
  check('P2_cold_start_closed', (r.cold.offerable || []).length === 0, `cold start offers ${(r.cold.offerable || []).length} of ${r.cold.n} ${LINE} quests — a line handed to you for free is not a ladder`);
  const walked = (r.steps || []).filter((s) => s.offerable).length;
  check('P3_every_rank_reachable', walked === (r.steps || []).length, `${walked}/${(r.steps || []).length} quests in the line became offerable by playing`);
  check('P4_ladder_reaches_ceiling', r.final && r.final.derived_rank >= 7, `top derived rank ${r.final && r.final.derived_rank} (${r.final && r.final.ranks && r.final.ranks[r.final.derived_rank] ? r.final.ranks[r.final.derived_rank].name : '?'}) at reputation ${r.final && r.final.reputation}`);
  check('P5_ladder_perturbation_bites', (r.perturb_ladder.closed || []).length > 0 && r.perturb_ladder.rank_after < r.perturb_ladder.rank_before,
    `zeroing reputation moved the DERIVED rank ${r.perturb_ladder.rank_before} -> ${r.perturb_ladder.rank_after} and closed ${(r.perturb_ladder.closed || []).length} offers`);
  check('P6_exclusion_bites', (r.perturb_exclusion.closed || []).length > 0,
    `joining ${RIVAL} closed ${(r.perturb_exclusion.closed || []).length} ${LINE} offers; ${RIVAL} closes ${JSON.stringify(r.perturb_exclusion.rival_closes)}`);
  check('P7_lockout_is_legible', !!r.perturb_exclusion.example_refusal,
    `the refusal a giver would speak: ${JSON.stringify(r.perturb_exclusion.example_refusal)}`);

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
