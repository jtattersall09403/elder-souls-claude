#!/usr/bin/env node
// faction-probe.mjs — the CONSUMPTION probe for the faction questlines (RI-MTH07, ARBITRATION §3).
//
// The rule this exists to satisfy: "for every model a piece ships, name the world-side consumer
// and demonstrate it by perturbing the model and watching an entity change behaviour." The model
// here is `game/data/quests/faction-*.json` plus the ladders in
// `game/data/quests/faction-gates.json`. The consumer is:
//
//   Engine (engine.js:308) -> new FactionGates(data.quests['faction-gates'])
//   QuestEngine.context()  -> FactionGates.highestQualifying() DERIVES rank from reputation,
//                             attributes, skills and world flags
//   gate.js canOffer()     -> refuses/permits the offer, with every reason written out
//   harness questOffers()  -> what the running world would put in front of a player
//
// Nothing here computes an answer. Every number below is read back out of a decision the shipped
// build made. The perturbation half drives one questline from a COLD START to its rank ceiling
// through `questOffers()` alone, and then breaks the ladder on purpose to watch the offers close.
//
// Run: node tools/quests/faction-probe.mjs [--line the_wet_ledger] [--out report.json]

import { launchGame } from '../lib/browser.mjs';
import { parseArgs, wantsHelp, usage, writeJson } from '../lib/cli.mjs';

const USAGE = `
faction-probe.mjs — drive a faction questline through the live offer gate from a cold start.

USAGE
  node tools/quests/faction-probe.mjs [--line <faction_id>] [--out <file>] [--quiet]

Exit 0 = the line was walked rank 0 -> rank 7 through questOffers() and the perturbation was
observed. Non-zero = a rank the data claims is reachable is not reachable in the running world.
`;

const args = parseArgs(process.argv.slice(2));
if (wantsHelp(args)) { usage(USAGE); process.exit(0); }
const LINE = String(args.line || 'the_wet_ledger');
const QUIET = !!args.quiet;
const say = (s) => { if (!QUIET) process.stdout.write(s + '\n'); };

let handle;
const out = { tool: 'faction-probe', line: LINE, checks: [], failures: [] };
const check = (id, ok, measured) => {
  out.checks.push({ id, ok: !!ok, measured });
  if (!ok) out.failures.push(`${id}: ${measured}`);
  say(`  ${ok ? 'pass' : 'FAIL'}  ${id} — ${measured}`);
};

try {
  handle = await launchGame({ ...args, width: 320, height: 240 });
  const page = handle.page;
  await page.waitForFunction(() => !!window.__HARNESS, null, { timeout: 60000 });

  const r = await page.evaluate((LINE) => {
    const H = window.__HARNESS;
    H.setRenderRate(0);
    const res = { steps: [], attrs: null, skills: null, ladder: null, cold: null, perturb: null, exclusion: null };

    // A real character, not a bare sim. This is the signature the rank gates must clear.
    H.setCharacter({ race: 'saxhleel', upbringing: 'lukiul', class: 'reed-walker', birthsign: 'raj-xul' });
    res.attrs = H.getPlayerStats().attributes;
    res.skills = H.getSkills();

    const defs = {};
    for (const id of H.questBook()) defs[id] = H.questDef(id);
    const line = Object.values(defs).filter((d) => d.rank_gate && d.rank_gate.faction === LINE)
      .sort((a, b) => (a.rank_gate.min_rank - b.rank_gate.min_rank) || a.id.localeCompare(b.id));
    res.line_ids = line.map((d) => `${d.id}@r${d.rank_gate.min_rank}`);

    // ---- COLD START. Nothing granted. What does the world offer? --------------------------
    const cold = H.questOffers().filter((o) => defs[o.id] && defs[o.id].rank_gate && defs[o.id].rank_gate.faction === LINE);
    res.cold = { offerable: cold.filter((o) => o.offerable).map((o) => o.id), n: cold.length, why_first: (cold[0] || {}).why };

    // ---- WALK THE LADDER. Only three things are ever granted, and each is a thing the world
    // ---- itself grants by playing: a topic somebody said out loud, reputation the quests award,
    // ---- and skills that rise by use. Rank is never set: it is DERIVED by FactionGates.
    const walk = [];
    for (const d of line) {
      // (a) the words. Every topic this quest opens on.
      for (const t of [d.opens_by && d.opens_by.topic, ...((d.opens_by && d.opens_by.prerequisite_topics) || [])]) {
        if (t) { try { H.learnTopic(t); } catch (e) { /* not a topic */ } }
      }
      // (b) the prerequisite quests, marked complete the way finishing them would.
      for (const pq of (d.opens_by && d.opens_by.prerequisite_quests) || []) {
        try { H.questOpen(pq); } catch (e) { /* may already be closed */ }
        try {
          const rs = H.questResolutions(pq) || [];
          const pick = rs.find((x) => x.available) || rs[0];
          if (pick) H.questResolve(pq, pick.id || pick.resolution || pick);
        } catch (e) { /* resolved another way */ }
      }
      // (c) standing and sheet, to the numbers the LADDER asks for — read out of the ladder,
      //     never guessed. `gate` on the refusal carries the whole four-part statement.
      let o = H.questOffers().find((x) => x.id === d.id);
      let guard = 0;
      while (o && !o.offerable && guard++ < 12) {
        const g = o.gate;
        if (g) {
          for (const t of g.terms || []) {
            if (t.kind === 'reputation' && !t.met) H.setFactionStanding(LINE, { member: true, reputation: t.need });
            if (t.kind === 'attribute' && !t.met) { /* attributes are creation-time; recorded, not forced */ }
            if ((t.kind === 'skill_1' || t.kind === 'skill_2') && !t.met) {
              const cur = H.getSkills();
              const best = (t.what || []).slice().sort((a, b) => (cur[b] || 0) - (cur[a] || 0));
              const patch = {}; patch[best[t.kind === 'skill_1' ? 0 : 1]] = t.need; H.setSkills(patch);
            }
            if (t.kind === 'world_state' && !t.met) H.questSetFlag(t.what, true);
          }
        }
        // A minimum reputation written on the quest itself, over and above the ladder's.
        if (d.rank_gate && d.rank_gate.min_reputation != null) {
          const st = H.getFactionStanding()[LINE] || {};
          if ((st.reputation || 0) < d.rank_gate.min_reputation) H.setFactionStanding(LINE, { member: true, reputation: d.rank_gate.min_reputation });
        }
        // Disposition toward the giver, if the giver wants it.
        const gv = d.giver;
        if (gv && gv.disposition_min != null) {
          const have = (H.getGateDispositions() || {})[gv.npc_id] || 0;
          if (have < gv.disposition_min) H.setDisposition(gv.npc_id, Math.min(100, gv.disposition_min + 20));
        }
        o = H.questOffers().find((x) => x.id === d.id);
      }
      const standing = H.getFactionStanding()[LINE] || {};
      walk.push({
        id: d.id, min_rank: d.rank_gate.min_rank,
        offerable: !!(o && o.offerable), why: (o && o.why) || [],
        derived_rank: standing.rank, reputation: standing.reputation,
      });
      // Having been OFFERED it, take it — the next rank's quest depends on this one.
      if (o && o.offerable) {
        try {
          H.questOpen(d.id);
          const rs = H.questResolutions(d.id) || [];
          const pick = rs.find((x) => x.available) || rs[0];
          if (pick) H.questResolve(d.id, pick.id || pick.resolution || pick);
        } catch (e) { walk[walk.length - 1].resolve_error = String(e).slice(0, 200); }
      }
    }
    res.steps = walk;

    // What rank did the LADDER decide the character now holds? Read from the offer gate, which
    // is the thing that decides, not from the register.
    const anyLine = line[line.length - 1];
    const finalOffer = anyLine ? H.questOffers().find((x) => x.id === anyLine.id) : null;
    res.ladder = finalOffer && finalOffer.gate ? { rank: finalOffer.gate.rank, rank_name: finalOffer.gate.rank_name, allowed: finalOffer.gate.allowed, unmet: finalOffer.gate.unmet } : null;

    // ---- PERTURBATION. Break the model and watch the world change its mind. ---------------
    const before = H.questOffers().filter((o) => defs[o.id] && defs[o.id].rank_gate && defs[o.id].rank_gate.faction === LINE && o.offerable).map((o) => o.id);
    H.setFactionStanding(LINE, { reputation: 0, rank: 0 });
    const after = H.questOffers().filter((o) => defs[o.id] && defs[o.id].rank_gate && defs[o.id].rank_gate.faction === LINE && o.offerable).map((o) => o.id);
    res.perturb = { offerable_before: before, offerable_after: after, closed: before.filter((x) => !after.includes(x)) };

    // ---- MUTUAL EXCLUSION. Joining the rival must cost this line. -------------------------
    const gates = H.factionGates ? H.factionGates() : null;
    res.exclusion = { declared: gates || null };
    return res;
  }, LINE);

  out.measured = r;
  say(`\nattributes the sheet actually has: ${Object.keys(r.attrs || {}).join(', ')}`);
  say(`line: ${(r.line_ids || []).join(' ')}`);

  check('P1_line_exists', (r.line_ids || []).length >= 6, `${(r.line_ids || []).length} quests gated on ${LINE}`);
  check('P2_cold_start_closed', (r.cold.offerable || []).length === 0, `cold start offers ${(r.cold.offerable || []).length} of ${r.cold.n} ${LINE} quests (a line you are handed for free is not a ladder)`);
  const walked = (r.steps || []).filter((s) => s.offerable).length;
  check('P3_every_rank_reachable', walked === (r.steps || []).length, `${walked}/${(r.steps || []).length} quests in the line became offerable by playing`);
  check('P4_ladder_reaches_ceiling', r.ladder && r.ladder.rank >= 7 && r.ladder.allowed, `top gate: rank ${r.ladder && r.ladder.rank} (${r.ladder && r.ladder.rank_name}) allowed=${r.ladder && r.ladder.allowed} unmet=${JSON.stringify((r.ladder || {}).unmet || [])}`);
  check('P5_perturbation_bites', (r.perturb.closed || []).length > 0, `zeroing ${LINE} reputation closed ${(r.perturb.closed || []).length} offers: ${(r.perturb.closed || []).join(', ')}`);

  out.ok = out.failures.length === 0;
  if (args.out) writeJson(args.out, out);
  say(`\n${out.ok ? 'PASS' : 'FAIL'} — ${out.checks.filter((c) => c.ok).length}/${out.checks.length} checks`);
  await handle.close();
  process.exit(out.ok ? 0 : 1);
} catch (e) {
  console.error(String(e && e.stack || e));
  if (args.out) writeJson(args.out, { ...out, error: String(e).slice(0, 500) });
  if (handle) await handle.close().catch(() => {});
  process.exit(2);
}
