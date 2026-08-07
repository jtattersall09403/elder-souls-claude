#!/usr/bin/env node
// critic-faction-r2.mjs — the round-2 critic's own instrument for W1-FACTIONS.
// Written mid-critique per TOOL-LOOP.md rule 1; declared under method_deviations.
//
// It exists to check four claims the builder made about ITSELF, using measurements that do not
// route through the builder's own bookkeeping:
//
//   C1  "the walk writes no reputation at all"
//       faction-probe measures this with `repWrites`, a list its OWN `grantRep()` wrapper
//       appends to. That is a true statement about one wrapper, not about the world. Here every
//       reputation-writing harness method is MONKEY-PATCHED at the boundary, so a write through
//       any other route is counted too — and the final standing is reconciled against the sum of
//       the resolutions' own declared `faction_reputation` deltas. If those two agree, the
//       reputation was earned; if they do not, something else paid.
//
//   C2  the REFUSER'S ROUTE end-to-end. The builder proved it by construction and by three
//       probe sections and said plainly it had not walked it. This walks it: take the REFUSE
//       ending of the rank-6 quest on purpose, then try to reach rank 7 anyway.
//
//   C3  ONE SIGNATURE. The walk uses saxhleel/lukiul/ledger-hand/raj-xul and no multi-signature
//       sweep was run. Round 1's ladder clamped at 3 of 7 because it was checked against a best
//       case. This re-walks the line across a spread of signatures and reports the worst.
//
//   C4  factionLawFactor. The model's only writer used to be a harness poke. Perturb it BY PLAY
//       — join through a quest, never through setFactionStandings — and read the arrest
//       threshold back off the shipped guard. Then measure the spread actually REACHABLE.
//
// Every section carries a control that must go the other way.
//
// Run: node tools/quests/critic-faction-r2.mjs [--line the_wet_ledger] [--out report.json]

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { launchGame } from '../lib/browser.mjs';
import { parseArgs, wantsHelp, usage, writeJson } from '../lib/cli.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const GOVERNS = {};
for (const s of JSON.parse(fs.readFileSync(ROOT + '/game/data/progression/skills.json', 'utf8')).skills) {
  (GOVERNS[s.governing] = GOVERNS[s.governing] || []).push(s.id);
}

const USAGE = `
critic-faction-r2.mjs — independent checks on the W1-FACTIONS round-2 claims.
  node tools/quests/critic-faction-r2.mjs [--line <faction_id>] [--out <file>]
Exit 0 = every claim reproduced. Non-zero = at least one did not.
`;
const args = parseArgs(process.argv.slice(2));
if (wantsHelp(args)) { usage(USAGE); process.exit(0); }
const LINE = String(args.line || 'the_wet_ledger');
const say = (s) => process.stdout.write(s + '\n');

const out = { tool: 'critic-faction-r2', at: new Date().toISOString(), line: LINE, checks: [], failures: [], sections: {} };
const check = (id, ok, measured) => {
  out.checks.push({ id, ok: !!ok, measured });
  if (!ok) out.failures.push(`${id}: ${measured}`);
  say(`  ${ok ? 'pass' : 'FAIL'}  ${id} — ${measured}`);
};

let handle;
try {
  handle = await launchGame({ ...args, width: 320, height: 240 });
  const page = handle.page;
  const perr = []; page.on('pageerror', (e) => perr.push(String(e).slice(0, 200)));
  await page.waitForFunction(() => !!window.__HARNESS, null, { timeout: 60000 });

  const r = await page.evaluate(({ LINE, GOVERNS }) => {
    const H = window.__HARNESS;
    H.setRenderRate(0);
    const R = {};

    // ================= THE BOUNDARY INSTRUMENT ==========================================
    // Count every call to every harness method that can move a faction reputation or a
    // standing, whoever makes it. This is the difference between "my wrapper was not used"
    // and "no reputation was written".
    const WRITES = [];
    for (const m of ['setFactionStanding', 'setFactionStandings', 'setSkills', 'setDisposition', 'questSetFlag', 'questReveal', 'learnTopic']) {
      if (typeof H[m] !== 'function') continue;
      const orig = H[m].bind(H);
      H[m] = (...a) => { WRITES.push({ m, args: JSON.parse(JSON.stringify(a)).slice(0, 2) }); return orig(...a); };
    }
    const writesOf = (m, from) => WRITES.slice(from).filter((w) => w.m === m);

    // ================= PLAY MACHINERY (same paths a player has) =========================
    const USE_FOR = {
      security: ['lock_picked', { cost: 1 }], sneak: ['stealth_opener', { cost: 1 }],
      speechcraft: ['persuade_success', { cost: 1 }], mercantile: ['barter_turnover', { cost: 1, gold: 2500 }],
      acrobatics: ['drop_landed', { cost: 1 }], athletics: ['sprint_interval', { cost: 1 }],
      survival: ['flora_gathered', { cost: 1 }], alchemy: ['potion_brewed', { cost: 1 }],
      shieldcraft: ['parry', { cost: 1 }], sorcery: ['cast_effective', { cost: 1, spell_skill: 'sorcery' }],
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
    function raise(skill, target) {
      const row = USE_FOR[skill]; if (!row) return;
      let guard = 0;
      while ((H.getSkills()[skill] || 0) < target && guard++ < 4000) {
        const g = H.grantSkillUse(row[0], row[1]);
        if (g && g.rest_clamped) H.hearthRest();
      }
    }
    function raiseAttribute(attr, want) {
      const owned = (GOVERNS[attr] || []).filter((s) => USE_FOR[s]); if (!owned.length) return;
      let guard = 0; const stuck = new Set();
      while ((H.getPlayerStats().attributes[attr] || 0) < want && guard++ < 40) {
        const cur = H.getSkills();
        const live = owned.filter((s) => !stuck.has(s) && (Math.floor((cur[s] || 0) / 15) + 1) * 15 <= 100);
        if (!live.length) break;
        const pick = live.slice().sort((a, b) => ((15 - ((cur[a] || 0) % 15)) - (15 - ((cur[b] || 0) % 15))))[0];
        const next = (Math.floor((cur[pick] || 0) / 15) + 1) * 15;
        raise(pick, next);
        if ((H.getSkills()[pick] || 0) < next) stuck.add(pick);
      }
    }

    // ================= C0 — IS THERE ANYBODY TO ASK? ====================================
    // machine.js:472, shipped at HEAD: `open()` refuses a quest whose giver is not in the world.
    // The round-2 reports on disk were taken before that gate went live. Census it directly.
    const allDefs = {}; for (const id of H.questBook()) allDefs[id] = H.questDef(id);
    const FACS = ['the_wet_ledger', 'the_imperial_assize', 'the_xul_aneekh'];
    const c0 = { by_line: {}, present: [], absent: [] };
    for (const f of FACS) {
      const ids = H.questBook().filter((id) => allDefs[id] && allDefs[id].rank_gate && allDefs[id].rank_gate.faction === f);
      const rows = ids.map((id) => ({ quest: id, giver: (allDefs[id].giver || {}).npc_id || null }));
      const seen = {};
      for (const row of rows) {
        if (!row.giver) continue;
        if (seen[row.giver] === undefined) { H.questPresenceGate('on'); const o = H.questOpen(row.quest); seen[row.giver] = !(o && o.gate === 'giver_presence'); }
        (seen[row.giver] ? c0.present : c0.absent).push(`${row.quest}/${row.giver}`);
      }
      c0.by_line[f] = { quests: rows.length, givers: Object.keys(seen).length, givers_in_world: Object.values(seen).filter(Boolean).length };
    }
    R.c0_givers = c0;
    // For everything below, SUSPEND the presence gate. That separates the faction round's own
    // work (the ladder, the gate, the refuser's route) from a defect it did not introduce.
    R.presence_gate_suspended_for_the_rest = H.questPresenceGate('report');

    const defs = allDefs;
    const inLine = (id) => defs[id] && defs[id].rank_gate && defs[id].rank_gate.faction === LINE;
    const lineDefs = () => H.questBook().filter(inLine).map((id) => defs[id])
      .sort((a, b) => (a.rank_gate.min_rank - b.rank_gate.min_rank) || String(a.id).localeCompare(String(b.id)));

    const need = (q, r) => { try { return H.questResolutionRequirements(q, r) || {}; } catch (e) { return {}; } };
    const gives = (q, r) => { try { return H.questResolutionConsequences(q, r) || {}; } catch (e) { return {}; } };

    // Pay for a resolution the only ways play pays: skill use and gold. Never setSkills, never
    // a written attribute, never a written reputation.
    function payFor(qid, rid) {
      const nd = need(qid, rid);
      for (const [sk, lvl] of Object.entries(nd.skills || {})) if ((H.getSkills()[sk] || 0) < lvl) raise(sk, lvl);
      for (const [at, lvl] of Object.entries(nd.attributes || {})) if ((H.getPlayerStats().attributes[at] || 0) < lvl) raiseAttribute(at, lvl);
      if (nd.gold) { try { H.setGold(nd.gold + 100); } catch (e) {} }
      for (const rev of nd.requires_knowing || []) { try { H.questReveal(qid, rev); } catch (e) {} }
    }

    // Walk the line. `prefer` picks the ending; it is the ONLY thing that differs between the
    // career walk and the refuser's walk, so the two are otherwise the same measurement.
    function walkLine(prefer) {
      const taken = [];
      for (const d of lineDefs()) {
        for (const t of [d.opens_by && d.opens_by.topic, ...((d.opens_by && d.opens_by.prerequisite_topics) || [])]) {
          if (t) { try { H.learnTopic(t); } catch (e) {} }
        }
        const rows = H.questResolutions(d.id) || [];
        const pickId = prefer(d, rows);
        if (!pickId) continue;
        payFor(d.id, pickId);
        const op = H.questOpen(d.id);
        if (!op || !op.ok) { taken.push({ quest: d.id, open_refused: (op || {}).reason }); continue; }
        const rs = H.questResolve(d.id, pickId);
        taken.push({ quest: d.id, resolution: pickId, ok: !!(rs && rs.ok), reason: (rs || {}).reason,
          rep: (gives(d.id, pickId) || {}).faction_reputation || {} });
      }
      return taken;
    }
    const rankNow = () => ((H.factionGates().factions || []).find((f) => f.id === LINE) || {}).derived_rank;
    const repNow = () => (H.getFactionStanding()[LINE] || {}).reputation || 0;

    // ================= C1 — WAS THE REPUTATION EARNED? ==================================
    H.setCharacter({ race: 'saxhleel', upbringing: 'lukiul', class: 'ledger-hand', birthsign: 'raj-xul' });
    const mark0 = WRITES.length;
    // Career chooser: never violence, prefer an ending that raises a ladder flag not yet up.
    const LADDER = new Set();
    for (const row of (((H.factionGates().factions || []).find((f) => f.id === LINE) || {}).ranks || [])) {
      if (row && row.world_state && row.world_state.flag) LADDER.add(row.world_state.flag);
    }
    const EXPELS = new Set();
    for (const row of (H.factionDiscipline().declared || [])) {
      if (row.faction === LINE) for (const f of row.expelled_by || []) EXPELS.add(f);
    }
    const career = (d, rows) => {
      const up = new Set(H.questWorldFlags());
      const score = (row) => {
        const g = gives(d.id, row.id) || {};
        const wf = g.world_flags || [];
        return (row.violence_required ? 100000 : 0)
          + (wf.some((f) => EXPELS.has(f)) ? 50000 : 0)
          + (wf.some((f) => LADDER.has(f) && !up.has(f)) ? 0 : 20000)
          + (row.available ? 0 : 1000);
      };
      const o = rows.slice().sort((a, b) => score(a) - score(b));
      return o.length ? o[0].id : null;
    };
    const careerTaken = walkLine(career);
    const c1 = {
      rank: rankNow(), reputation: repNow(),
      // every reputation-writing call made during the walk, by ANY route
      direct_standing_writes: writesOf('setFactionStanding', mark0).length,
      direct_standings_writes: writesOf('setFactionStandings', mark0).length,
      setSkills_writes: writesOf('setSkills', mark0).length,
      flag_pokes: writesOf('questSetFlag', mark0).map((w) => w.args[0]),
      // the reconciliation: what did the resolutions themselves declare they would pay?
      declared_sum: careerTaken.filter((t) => t.ok).reduce((a, t) => a + (t.rep[LINE] || 0), 0),
      resolved: careerTaken.filter((t) => t.ok).length,
      attempted: careerTaken.length,
      taken: careerTaken,
    };
    R.c1_earned = c1;

    // ================= C4 — factionLawFactor, PERTURBED BY PLAY =========================
    // The walk above joined the line through a quest. Nothing here writes a standing.
    const band = (b) => H.getGuardBand({ bounty: b || 500 });
    R.c4 = {
      standings_after_play: H.syncFactionStandings(),
      band_after_play: band(500),
      sanction_state: H.getSanctionState ? (H.getSanctionState().standings || null) : null,
    };
    R.c4.writes_to_standings_during_walk = writesOf('setFactionStandings', mark0).length;

    // ================= C2 — THE REFUSER'S ROUTE, END TO END =============================
    // Fresh character; same machinery; the ONLY change is that at the rank-6 quest we take the
    // refuse ending on purpose, which is the ending round 1 proved caps the ladder at 6.
    H.setCharacter({ race: 'saxhleel', upbringing: 'lukiul', class: 'ledger-hand', birthsign: 'raj-xul' });
    const mark2 = WRITES.length;
    let refusedAt = null;
    const refuser = (d, rows) => {
      if (d.rank_gate.min_rank === 6 && !refusedAt) {
        const ref = rows.find((x) => x.method === 'refuse');
        if (ref) { refusedAt = d.id; return ref.id; }
      }
      return career(d, rows);
    };
    const refTaken = walkLine(refuser);
    R.c2_refuser = {
      refused_at: refusedAt,
      refuse_resolution: (refTaken.find((t) => t.quest === refusedAt) || {}).resolution,
      rank: rankNow(), reputation: repNow(),
      direct_standing_writes: writesOf('setFactionStanding', mark2).length,
      flag_pokes: writesOf('questSetFlag', mark2).map((w) => w.args[0]),
      topics_known_has_second_route: H.questTopicsKnown().filter((t) => /second-refusal|removal-that-is-not-one|fourth-silence/.test(t)),
      taken: refTaken,
      violent: refTaken.filter((t) => t.ok).filter((t) => {
        const rows = H.questResolutions(t.quest) || [];
        const row = rows.find((x) => x.id === t.resolution);
        return row && row.violence_required;
      }).map((t) => t.quest + '.' + t.resolution),
    };

    // ================= C3 — MANY SIGNATURES =============================================
    // Round 1's ladder clamped at 3 of 7 against a best case. Re-walk the line for a spread of
    // signatures and report the worst, not the best.
    const SIGS = [
      { race: 'saxhleel', upbringing: 'lukiul', class: 'ledger-hand', birthsign: 'raj-xul' },
      { race: 'nord', upbringing: 'foreign-born', class: 'salt-blade', birthsign: 'raj-xul' },
      { race: 'khajiit', upbringing: 'foreign-born', class: 'wet-foot', birthsign: 'raj-xul' },
      { race: 'orsimer', upbringing: 'blackrose', class: 'salt-blade', birthsign: 'raj-xul' },
      { race: 'bosmer', upbringing: 'interior', class: 'reed-walker', birthsign: 'raj-xul' },
      { race: 'imperial', upbringing: 'foreign-born', class: 'root-speaker', birthsign: 'raj-xul' },
      { race: 'redguard', upbringing: 'blackrose', class: 'sap-reader', birthsign: 'raj-xul' },
      { race: 'naga', upbringing: 'interior', class: 'salt-blade', birthsign: 'raj-xul' },
    ];
    R.c3_signatures = [];
    for (const sig of SIGS) {
      try {
        H.setCharacter(sig);
        const m = WRITES.length;
        const t = walkLine(career);
        R.c3_signatures.push({ sig: `${sig.race}/${sig.upbringing}/${sig.class}`,
          rank: rankNow(), reputation: repNow(),
          resolved: t.filter((x) => x.ok).length, attempted: t.length,
          direct_standing_writes: writesOf('setFactionStanding', m).length,
          first_refusal: (t.find((x) => x.open_refused) || {}).open_refused || null });
      } catch (e) {
        R.c3_signatures.push({ sig: `${sig.race}/${sig.upbringing}/${sig.class}`, error: String(e).slice(0, 200) });
      }
    }

    // ================= C4b — THE REACHABLE SPREAD =======================================
    // Every standing key the shipped table indexes, and whether a PLAYER can ever be in it:
    // syncFactionStandings() only writes a key for a faction that is (a) in standing_ids and
    // (b) a membership the quest book can actually grant.
    R.c4b = { bands: {} };
    for (const [label, patch] of [
      ['none', {}],
      ['wet-ledger:1-2', { 'wet-ledger': 2 }], ['wet-ledger:3+', { 'wet-ledger': 5 }],
      ['xul-aneekh:1-3', { 'xul-aneekh': 2 }], ['xul-aneekh:4+', { 'xul-aneekh': 5 }],
      ['ninth-cohort:1-3', { 'ninth-cohort': 2 }], ['ninth-cohort:4+', { 'ninth-cohort': 5 }],
    ]) {
      // this IS the harness poke, used deliberately, to price rows the world may never reach
      H.setFactionStandings({});
      for (const k of Object.keys(H.getSanctionState().standings || {})) delete H.getSanctionState().standings[k];
      H.setFactionStandings(patch);
      R.c4b.bands[label] = H.getGuardBand({ bounty: 500 });
    }
    return R;
  }, { LINE, GOVERNS });

  out.sections = r;
  out.page_errors = perr;

  // ---- C0 — the world-side consumer of `giver` --------------------------------------------
  const c0 = r.c0_givers || { by_line: {}, absent: [] };
  const tot = Object.values(c0.by_line).reduce((a, b) => a + b.givers, 0);
  const inw = Object.values(c0.by_line).reduce((a, b) => a + b.givers_in_world, 0);
  check('C0_the_quest_givers_exist_in_the_world', c0.absent.length === 0,
    `${inw}/${tot} distinct faction quest givers are in the world; ${c0.absent.length} of ${c0.absent.length + c0.present.length} quests are given by nobody. ` +
    Object.entries(c0.by_line).map(([f, v]) => `${f} ${v.givers_in_world}/${v.givers}`).join(', '));

  // ---- C1 ---------------------------------------------------------------------------------
  const c1 = r.c1_earned;
  check('C1a_career_walk_reached_rank_7', c1.rank === 7, `derived rank ${c1.rank} at reputation ${c1.reputation}, ${c1.resolved}/${c1.attempted} resolutions applied`);
  check('C1b_no_reputation_was_WRITTEN_by_any_route', c1.direct_standing_writes === 0 && c1.direct_standings_writes === 0,
    `setFactionStanding x${c1.direct_standing_writes}, setFactionStandings x${c1.direct_standings_writes} during the walk (counted at the harness boundary, not in the probe's own list)`);
  check('C1c_no_skill_register_was_written', c1.setSkills_writes === 0, `setSkills x${c1.setSkills_writes}`);
  check('C1d_no_world_flag_was_poked', c1.flag_pokes.length === 0, `${c1.flag_pokes.length} questSetFlag calls${c1.flag_pokes.length ? ': ' + c1.flag_pokes.join(', ') : ''}`);
  check('C1e_reputation_reconciles_with_the_resolutions_own_deltas', c1.declared_sum === c1.reputation,
    `live standing ${c1.reputation} vs the sum of the taken resolutions' declared faction_reputation ${c1.declared_sum}${c1.declared_sum === c1.reputation ? '' : ' — DIFFERENCE ' + (c1.reputation - c1.declared_sum) + ' came from somewhere else'}`);

  // ---- C2 ---------------------------------------------------------------------------------
  const c2 = r.c2_refuser;
  check('C2a_the_walk_actually_refused_at_rank_6', !!c2.refused_at, `${c2.refused_at || 'NO rank-6 refuse ending was taken'} via ${c2.refuse_resolution}`);
  check('C2b_the_world_seeded_the_second_route_topic', (c2.topics_known_has_second_route || []).length > 0,
    `topicsKnown contains ${JSON.stringify(c2.topics_known_has_second_route)}`);
  check('C2c_a_refuser_still_reaches_rank_7', c2.rank === 7, `derived rank ${c2.rank} at reputation ${c2.reputation} after refusing`);
  check('C2d_the_refusers_route_is_non_violent', (c2.violent || []).length === 0, `${(c2.violent || []).length} violent resolutions taken`);
  check('C2e_the_refusers_route_wrote_no_reputation', c2.direct_standing_writes === 0, `setFactionStanding x${c2.direct_standing_writes}`);

  // ---- C3 ---------------------------------------------------------------------------------
  const sigs = r.c3_signatures || [];
  const at7 = sigs.filter((s) => s.rank === 7).length;
  const worst = sigs.slice().sort((a, b) => (a.rank || 0) - (b.rank || 0))[0] || {};
  check('C3a_every_signature_reaches_rank_7', at7 === sigs.length,
    `${at7}/${sigs.length} signatures reached rank 7; worst = ${worst.sig} at rank ${worst.rank} (rep ${worst.reputation})`);
  check('C3b_no_signature_needed_a_written_reputation', sigs.every((s) => (s.direct_standing_writes || 0) === 0),
    sigs.map((s) => `${s.sig}:${s.direct_standing_writes}`).join(' '));

  // ---- C4 ---------------------------------------------------------------------------------
  const c4 = r.c4 || {};
  const st = c4.standings_after_play || {};
  check('C4a_playing_the_line_wrote_a_standing_the_guard_reads', Object.keys(st).length > 0,
    `sim.stealth.p.standings after the walk = ${JSON.stringify(st)} (${c4.writes_to_standings_during_walk} harness pokes during the walk)`);
  const bands = (r.c4b || {}).bands || {};
  const arr = (k) => (bands[k] && bands[k].thresholds && bands[k].thresholds.arrest_at != null) ? bands[k].thresholds.arrest_at : null;
  const reachable = ['none', 'wet-ledger:1-2', 'wet-ledger:3+', 'xul-aneekh:1-3', 'xul-aneekh:4+'].map(arr).filter((x) => x != null);
  const all = Object.keys(bands).map(arr).filter((x) => x != null);
  const sp = (a) => (a.length ? Math.max(...a) / Math.min(...a) : 0);
  check('C4b_the_reachable_spread_is_reported_honestly', reachable.length > 0,
    `arrest_at by standing: ${Object.keys(bands).map((k) => `${k}=${arr(k)}`).join(' ')} | spread over ROWS A PLAYER CAN REACH = ${sp(reachable).toFixed(2)}x | spread over ALL rows incl. unjoinable = ${sp(all).toFixed(2)}x`);
  check('C4c_page_errors_zero', perr.length === 0, `${perr.length}${perr.length ? ': ' + perr.join(' | ') : ''}`);
} catch (e) {
  out.failures.push(`threw: ${String(e && e.stack || e).slice(0, 600)}`);
  say(`THREW: ${String(e && e.message || e).slice(0, 400)}`);
} finally {
  if (handle && handle.close) await handle.close();
}

const dest = args.out || 'reports/critic-faction-r2.json';
writeJson(dest, out);
say(`\n${out.checks.filter((c) => c.ok).length}/${out.checks.length} pass — wrote ${dest}`);
process.exit(out.failures.length ? 1 : 0);
