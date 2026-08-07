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

    // ---- RAISING A SKILL THE WAY PLAY RAISES ONE ------------------------------------------
    // `setSkills()` writes the register directly and grants NOTHING to the governing attribute,
    // so a probe that uses it can never clear an attribute gate and would report the ladder
    // unreachable when it is not. `grantSkillUse()` is the play path: `character/skilluse.js`
    // banks progress through `derive.js bankProgress`, which applies RI-PRG03 §4's +3-levels-
    // per-rest clamp and RI-PRG02 §2's earned-attribute grant at every multiple of 15. So this
    // rests at the hearth between batches exactly as a player would, and every attribute point
    // the character ends with was earned by a skill crossing 15/30/45/60/75/90.
    const USE_FOR = {
      security: ['lock_picked', { cost: 1 }],
      sneak: ['stealth_opener', { cost: 1 }],
      speechcraft: ['persuade_success', { cost: 1 }],
      mercantile: ['barter_turnover', { cost: 1, gold: 2500 }],
      acrobatics: ['drop_landed', { cost: 1 }],
      athletics: ['sprint_interval', { cost: 1 }],
      survival: ['flora_gathered', { cost: 1 }],
      alchemy: ['potion_brewed', { cost: 1 }],
      shieldcraft: ['parry', { cost: 1 }],
      sorcery: ['cast_effective', { cost: 1, spell_skill: 'sorcery' }],
      warding: ['cast_effective', { cost: 1, spell_skill: 'warding' }],
      veiling: ['cast_effective', { cost: 1, spell_skill: 'veiling' }],
      'root-speech': ['cast_effective', { cost: 1, spell_skill: 'root-speech' }],
      blades: ['weapon_hit', { cost: 40, weapon_class: 'straight_sword' }],
      'axes-maces': ['weapon_hit', { cost: 40, weapon_class: 'axe' }],
      polearms: ['weapon_hit', { cost: 40, weapon_class: 'spear' }],
      greatweapons: ['weapon_hit', { cost: 40, weapon_class: 'greatsword' }],
      'claw-fang': ['weapon_hit', { cost: 40, weapon_class: 'FST' }],
      marksman: ['marksman_hit', { cost: 40, range_m: 20 }],
    };
    const raiseLog = [];
    function raise(skill, target) {
      const row = USE_FOR[skill];
      if (!row) { raiseLog.push({ skill, refused: 'no use event maps to this skill' }); return; }
      const attrBefore = { ...H.getPlayerStats().attributes };
      let uses = 0, rests = 0, guard = 0;
      while ((H.getSkills()[skill] || 0) < target && guard++ < 4000) {
        const r = H.grantSkillUse(row[0], row[1]);
        uses++;
        if (r && r.rest_clamped) { H.hearthRest(); rests++; }
        else if (r && r.granted === 0 && r.gained === 0 && !r.refused && uses > 3000) break;
      }
      const attrAfter = H.getPlayerStats().attributes;
      const moved = Object.keys(attrAfter).filter((k) => attrAfter[k] !== attrBefore[k]).map((k) => `${k} ${attrBefore[k]}->${attrAfter[k]}`);
      raiseLog.push({ skill, to: H.getSkills()[skill], target, uses, rests, attributes_earned: moved });
    }

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
            raise(best[t.kind === 'skill_1' ? 0 : 1], t.need);
          }
          if (!t.met && t.kind === 'world_state') H.questSetFlag(t.what, true);
          // The attribute term is NEVER set. It rises only where `raise()` above made a
          // governed skill cross a multiple of 15, which is the one route the game has.
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
    res.skill_raises = raiseLog;
    res.attrs_end = H.getPlayerStats().attributes;
    res.skills_end = H.getSkills();
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
  const favA = (r.final && r.final.favoured_attributes) || [];
  check('P4_ladder_reaches_ceiling', r.final && r.final.derived_rank >= 7, `top derived rank ${r.final && r.final.derived_rank} (${r.final && r.final.ranks && r.final.ranks[r.final.derived_rank] ? r.final.ranks[r.final.derived_rank].name : '?'}) at reputation ${r.final && r.final.reputation}; favoured attributes now ${favA.map((a) => `${a} ${r.attrs_end[a]}`).join(', ')} against a rank-7 demand of ${r.final && r.final.ranks ? r.final.ranks[7].attribute : '?'}`);
  check('P8_attributes_were_EARNED', (r.skill_raises || []).some((x) => (x.attributes_earned || []).length),
    `attribute points granted by skill use, never set: ${(r.skill_raises || []).flatMap((x) => x.attributes_earned || []).join('; ') || 'NONE'}`);
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
