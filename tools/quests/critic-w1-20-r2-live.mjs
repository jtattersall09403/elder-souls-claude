#!/usr/bin/env node
// critic-w1-20-r2-live.mjs — the round-2 critic's LIVE arm. Boots the shipping build and asks
// the six questions the dispatch names, through play, on entities.
//
// WHY IT EXISTS. The round-1 verdict (2026-08-08) judged a tree that no longer exists. The W1-20
// CONTINUATION landed 08-10 (9ed28905) and a merge sixteen minutes later deleted three of its
// files; three came back on 08-14, but the ENGINE half did not, because the recovery worked
// file-by-file and `game/src/engine.js` is a file that still exists. So the recovered instrument
// `tools/quests/w1-20-builder.mjs` cannot run at HEAD — `engine.factionAccess is not a function`.
// This tool measures what IS there.
//
// THE NULL CONTROL, and it is the plausible wrong answer rather than the trivial one.
// `--arm null-control` expects to be pointed at a tree whose `faction-gates.json` has had every
// requirement flattened to zero — EVERY FACTION ACCEPTS EVERYONE AND REFUSES NOBODY, with all
// eight ladders, every rank name, every favoured skill and every line of refusal prose intact.
// That build passes a structural census of the faction system completely. Every check below
// marked `discriminating: true` MUST flip in that arm; a check that does not flip is reported as
// INERT and is not allowed to contribute to a score.
//
// RUN
//   node tools/quests/critic-w1-20-r2-live.mjs --out <file>
//   node tools/quests/critic-w1-20-r2-live.mjs --arm null-control --out <file>   (run from the clone)

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { launchGame } from '../lib/browser.mjs';
import { parseArgs, wantsHelp, usage } from '../lib/cli.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const USAGE = `critic-w1-20-r2-live.mjs — the faction system, through play\n  --arm shipping|null-control   default shipping\n  --out <file>                  default reports/w1-20/r2-live.json\n`;
const args = parseArgs(process.argv.slice(2));
if (wantsHelp(args)) { usage(USAGE); process.exit(0); }
const ARM = String(args.arm || 'shipping');
const OUT = args.out ? String(args.out) : path.join(ROOT, 'reports/w1-20/r2-live.json');

// The eight ladders, their representative (registry.json), the seat zone, and a rival.
// `settlement` is read off the NPC records node-side and handed in, because a person only enters
// `sim.npcs` when `populateSettlement()` has run for the town they live in — a probe that calls
// `talkTo()` without doing that measures its own starting position, not the build.
const LINES = [
  { id: 'the_wet_ledger', rep: 'harbourmistress-tesh', zone: 'lilmoth.factor0.r0' },
  { id: 'the_imperial_assize', rep: 'assizer-corvo', zone: null },
  { id: 'the_xul_aneekh', rep: 'ee-vashum', zone: null },
  { id: 'deep_kin', rep: 'ee-vashum', zone: null },
  { id: 'the_dockhands', rep: 'npc-porter-eeja', zone: null },
  { id: 'the_drowned_court', rep: 'undertaker-vaskh', zone: 'lilmoth.priest6.r0' },
  { id: 'the_ixtu_vakh', rep: 'cutter-neeth', zone: null },
  { id: 'the_rootkeepers', rep: 'rootkeeper-jeen', zone: null },
];
{
  const nDir = path.join(ROOT, 'game/data/npcs');
  const where = new Map();
  for (const f of fs.readdirSync(nDir).filter((x) => x.endsWith('.json'))) {
    try {
      const d = JSON.parse(fs.readFileSync(path.join(nDir, f), 'utf8'));
      for (const n of d.npcs || []) if (!where.has(n.eid || n.id)) where.set(n.eid || n.id, n.settlement || null);
    } catch { /* */ }
  }
  for (const L of LINES) L.settlement = where.get(L.rep) || null;
  LINES.dissenterSettlements = where;
}

const game = await launchGame(args, { usage: USAGE });
const { page } = game;

// The four people a faction quest's `deceit.revealed_by` points at whose AUTHORED record lives in
// `game/data/npcs/quest-witnesses.json` — the file that is on disk and absent from
// `game/data/index.json`. The engine therefore serves the duplicate record of the same id from
// `mainline.json` instead. This asks what the player actually hears.
const DISSENTERS = [
  ['npc-ineve-corrano', LINES.dissenterSettlements.get('npc-ineve-corrano')],
  ['npc-sorel-ithan', LINES.dissenterSettlements.get('npc-sorel-ithan')],
  ['npc-eleen', LINES.dissenterSettlements.get('npc-eleen')],
  ['npc-skara-hull-chalk', LINES.dissenterSettlements.get('npc-skara-hull-chalk')],
];

const report = await page.evaluate(async ({ LINES, DISSENTERS }) => {
  const H = window.__HARNESS;
  const out = { checks: [], lines: [], notes: [] };
  const say = (id, detail) => out.checks.push({ id, ...detail });

  const fresh = (settlement) => {
    H.reset({ state: 'default' });
    H.setRenderRate(0);
    H.setCharacter({ race: 'saxhleel', upbringing: 'interior', class: 'root-speaker', birthsign: 'raj-xul' });
    // Put the people in the world. Without this `sim.npcs` is empty and every `talkTo` throws
    // "nobody by that name is in the world" — which is the probe's location, not a defect.
    if (settlement) { try { H.populateSettlement(settlement); } catch (e) { out.notes.push(`populateSettlement(${settlement}): ${String(e).slice(0, 120)}`); } }
  };

  // ---------------------------------------------------------------- A. THE REFUSAL
  // A stranger asks for rank 1 on all eight ladders. Every one must refuse, in words, and the
  // words must carry the specific unmet terms with this character's own numbers in them.
  fresh();
  const refusals = [];
  for (const L of LINES) {
    let r = null, err = null;
    try { r = H.factionRefusal(L.id, 1); } catch (e) { err = String(e).slice(0, 160); }
    const said = r && (r.said || r.line || r.text) || null;
    const nums = said ? (String(said).match(/\d+/g) || []) : [];
    refusals.push({
      faction: L.id, error: err, said,
      states_a_number: nums.length > 0, numbers: nums,
      unmet: r && r.evaluation ? (r.evaluation.unmet || r.evaluation.why || null) : (r && (r.unmet || r.why) || null),
      // `factionRefusal` returns `{kind}`: 'welcome' when the gate is satisfied, a refusal kind
      // otherwise. There is no `ok` field — reading one gives `false` for both outcomes, which is
      // how the first pass of this tool reported "8/8 refusing" in BOTH arms and called an inert
      // check discriminating. The kind is the truth.
      kind: r && (r.kind || (r.voice && r.voice.kind)) || null,
      refused: !!(r && (r.kind || (r.voice && r.voice.kind)) && (r.kind || r.voice.kind) !== 'welcome'),
      ok: !!(r && r.ok),
      drawn: !!(r && r.toast),
    });
  }
  say('A1.stranger_is_refused_by_every_line', {
    discriminating: true,
    lines_refusing: refusals.filter((x) => x.refused).length,
    lines_spoken_a_welcome: refusals.filter((x) => x.kind === 'welcome').length,
    of: LINES.length, rows: refusals,
  });
  say('A2.refusal_states_the_threshold', {
    discriminating: false,
    spoken: refusals.filter((x) => x.said).length,
    stating_a_number: refusals.filter((x) => x.states_a_number).length,
    of: LINES.length,
  });

  // A3. Does the ladder gate on SKILLS AND ATTRIBUTES as well as reputation? Buy the reputation
  // and nothing else; the refusal must still land, and must name a skill or an attribute.
  fresh();
  const skillGated = [];
  for (const L of LINES) {
    H.setFactionStanding(L.id, { member: true, reputation: 120, rank: 0 });
    let r = null; try { r = H.factionRefusal(L.id, 7); } catch { /* no ladder */ }
    const g = H.factionGates();
    const row = (g.factions || []).find((f) => f.id === L.id);
    skillGated.push({
      faction: L.id,
      derived_rank_with_120_reputation: row ? row.derived_rank : null,
      still_refused_at_7: !!(r && (r.kind || (r.voice && r.voice.kind)) && (r.kind || r.voice.kind) !== 'welcome'),
      said: r && (r.said || null),
      unmet_terms: row && row.next_rank_terms ? (row.next_rank_terms.unmet || row.next_rank_terms.why || null) : null,
    });
  }
  say('A3.reputation_alone_does_not_buy_the_ladder', {
    discriminating: true,
    lines_still_refusing_rank_7_on_reputation_alone: skillGated.filter((x) => x.still_refused_at_7).length,
    of: LINES.length, rows: skillGated,
  });

  // A4. Raise the favoured skills and attributes to the top of the ladder and the same character
  // must now be ADMITTED. A gate that never opens is as broken as one that never closes.
  fresh();
  const admitted = [];
  for (const L of LINES) {
    const g0 = H.factionGates();
    const f0 = (g0.factions || []).find((f) => f.id === L.id);
    const sk = {}; for (const s of (f0 ? f0.favoured_skills : [])) sk[s] = 100;
    const at = {}; for (const a of (f0 ? f0.favoured_attributes : [])) at[a] = 100;
    try { H.setSkills(sk); } catch (e) { out.notes.push('setSkills: ' + String(e).slice(0, 120)); }
    try { H.setAttributes(at); } catch (e) { out.notes.push('setAttributes: ' + String(e).slice(0, 120)); }
    H.setFactionStanding(L.id, { member: true, reputation: 400, rank: 0 });
    const g = H.factionGates();
    const row = (g.factions || []).find((f) => f.id === L.id);
    admitted.push({
      faction: L.id, derived_rank: row ? row.derived_rank : null,
      world_state_blocks: row && row.next_rank_terms ? (row.next_rank_terms.unmet || null) : null,
    });
  }
  say('A4.a_qualified_character_climbs', {
    discriminating: false,
    lines_reaching_rank_ge_5: admitted.filter((x) => (x.derived_rank || 0) >= 5).length,
    of: LINES.length, rows: admitted,
  });

  // ---------------------------------------------------------------- B. FACTIONS DISLIKE EACH OTHER
  // Join one and see a door close at another, measured on an NPC rather than in a table.
  const rivalry = [];
  {
    const g = H.factionGates();
    const decl = g.declared_exclusivity || {};
    for (const L of LINES) {
      fresh();
      const before = H.factionGates();
      const beforeLocked = (before.rivalry_locked_now || []).slice();
      H.setFactionStanding(L.id, { member: true, reputation: 60, rank: 3 });
      const after = H.factionGates();
      rivalry.push({
        joined: L.id,
        rivalry_locked_before: beforeLocked,
        rivalry_locked_after: (after.rivalry_locked_now || []).slice(),
        quests_locked: (after.quests_locked_by_rivalry || []).length,
        closes_declared: (before.factions.find((f) => f.id === L.id) || {}).closes || [],
      });
    }
    out.declared_exclusivity = decl;
  }
  say('B1.joining_closes_a_door', {
    discriminating: true,
    lines_whose_join_locks_something: rivalry.filter((r) => r.rivalry_locked_after.length > r.rivalry_locked_before.length).length,
    of: LINES.length,
    lines_whose_join_locks_quests: rivalry.filter((r) => r.quests_locked > 0).length,
    rows: rivalry,
  });

  // B2. The rival REFUSES IN ITS OWN VOICE and names the reason.
  const rivalVoice = [];
  for (const r of rivalry) {
    if (!r.rivalry_locked_after.length) continue;
    fresh();
    H.setFactionStanding(r.joined, { member: true, reputation: 60, rank: 3 });
    for (const other of r.rivalry_locked_after) {
      let sp = null; try { sp = H.factionRefusal(other, 1); } catch { /* */ }
      rivalVoice.push({ joined: r.joined, refused_by: other, said: sp && sp.said || null,
        names_the_rival: !!(sp && sp.said && String(sp.said).toLowerCase().includes(String(r.joined).replace(/^the_/, '').replace(/_/g, ' ').split(' ')[0])) });
    }
  }
  say('B2.the_rival_refuses_in_its_own_voice', { discriminating: true, rows: rivalVoice,
    note: 'This is the RANK-GATE voice (Engine.factionRefusal). The exclusivity voice is on the quest-open path and is measured by B3.' });

  // B3. The other half, and the one a player actually meets: open a quest the rivalry has locked
  // and see whether the world explains the lock. `QuestEngine.open()` is the shipping path.
  const locked = [];
  for (const r of rivalry) {
    if (!r.quests_locked) continue;
    fresh();
    H.setFactionStanding(r.joined, { member: true, reputation: 60, rank: 3 });
    const g = H.factionGates();
    const first = (g.quests_locked_by_rivalry || [])[0];
    if (!first) continue;
    const row = { joined: r.joined, quest: first.quest, declared_why: first.why };
    try { H.questPrepareOffer(first.quest); } catch (e) { row.prepare_error = String(e).slice(0, 120); }
    try { row.open_result = H.questOpen(first.quest); } catch (e) { row.open_error = String(e).slice(0, 200); }
    // TWO different strings, and the whole finding is that they disagree. `reason` is what the
    // engine records; `said` is what the player HEARS. A substring test over faction names is not
    // a check — the first version of this line matched the word "court" inside a WELCOME line and
    // scored it as a lock explanation. So both are recorded, and the comparison is of `kind`.
    row.open_refused = !!(row.open_result && row.open_result.ok === false);
    row.reason = row.open_result && row.open_result.reason || null;
    row.reason_names_the_lock = !!(row.reason && /will not deal with you/i.test(row.reason));
    const said = row.open_result && row.open_result.said;
    row.said = typeof said === 'string' ? said : null;
    row.voice_kind = row.open_result && row.open_result.voice && row.open_result.voice.kind || null;
    row.the_player_is_told_they_are_refused = row.voice_kind !== 'welcome';
    locked.push(row);
  }
  say('B3.the_world_explains_the_lock_when_you_try_the_door', {
    discriminating: true,
    lines_tested: locked.length,
    lines_where_open_refuses: locked.filter((l) => l.open_refused).length,
    lines_where_the_RECORDED_reason_names_the_lock: locked.filter((l) => l.reason_names_the_lock).length,
    lines_where_the_SPOKEN_line_tells_the_player_they_are_refused: locked.filter((l) => l.the_player_is_told_they_are_refused).length,
    rows: locked,
  });

  // ---------------------------------------------------------------- C. RANK OUTSIDE QUEST GATING
  // The entity-side observable: what the representative SAYS when you walk up to them.
  // `Engine.talkTo()` is the shipping path — it calls `npcDisposition()` and `topicsFor()`.
  for (const L of LINES) {
    fresh(L.settlement);
    H.setFactionStanding(L.id, { member: true, reputation: 0, rank: 0 });
    const rows = [];
    for (const rank of [0, 2, 4, 7]) {
      H.setFactionStanding(L.id, { member: true, rank });
      const row = { rank };
      try {
        const t = H.talkTo(L.rep);
        row.greeting = t && (t.greeting || t.line || null);
        row.greeting_cell = t && t.greeting_cell;
        row.band = t && (t.band !== undefined ? t.band : null);
        row.disposition = t && (t.disposition !== undefined ? t.disposition : null);
        row.topics_offered = t && t.topics_offered;
      } catch (e) { row.talk_error = String(e).slice(0, 160); }
      try { const d = H.explainDisposition(L.rep); row.explained = d ? d.value : null; } catch { /* */ }
      if (L.zone) {
        try { const tr = H.trespassCheck(L.zone, {}); row.trespassing = tr ? tr.trespassing : null; } catch { /* */ }
      }
      rows.push(row);
    }
    out.lines.push({ faction: L.id, representative: L.rep, zone: L.zone, by_rank: rows });
  }
  // `talkTo` does not publish `band`/`disposition` on its return value in every build, so the
  // number that must drive this summary is `explained` (Engine.npcDisposition via
  // questEngine.explainDisposition) and the greeting CELL, which is the band the player hears.
  const movers = out.lines.filter((l) => new Set(l.by_rank.map((r) => r.explained).filter((x) => x != null)).size > 1);
  const bandMovers = out.lines.filter((l) => new Set(l.by_rank.map((r) => r.greeting_cell).filter((x) => x != null)).size > 1);
  const talkFails = out.lines.filter((l) => l.by_rank.some((r) => r.talk_error));
  say('C1.rank_changes_what_the_representative_says', {
    discriminating: false,
    lines_where_disposition_moves: movers.length,
    lines_where_disposition_is_FLAT: out.lines.filter((l) => new Set(l.by_rank.map((r) => r.explained)).size === 1).map((l) => l.faction),
    lines_where_the_GREETING_CELL_moves: bandMovers.length,
    lines_where_talkTo_throws: talkFails.map((l) => ({ faction: l.faction, rep: l.representative, error: l.by_rank.find((r) => r.talk_error).talk_error })),
    of: LINES.length,
  });

  // ---------------------------------------------------------------- D. EXPULSION AND READMISSION
  const disc = H.factionDiscipline();
  const expulsions = [];
  for (const d of (disc.declared || [])) {
    fresh();
    const flag = (d.expelled_by || [])[0];
    if (!flag) { expulsions.push({ faction: d.faction, no_trigger: true }); continue; }
    H.setFactionStanding(d.faction, { member: true, reputation: 60, rank: 3 });
    const before = H.factionDiscipline().expelled.map((e) => e.faction);
    H.questSetFlag(flag, true);
    const after = H.factionDiscipline().expelled.map((e) => e.faction);
    const row = { faction: d.faction, trigger_flag: flag, expelled_before: before.includes(d.faction), expelled_after: after.includes(d.faction) };
    // What does the world say about it, and can the player buy their way back?
    try { const sp = H.factionRefusal(d.faction, 4); row.refusal_while_expelled = sp && sp.said || null; } catch { /* */ }
    try { H.setGold(0); row.readmit_broke = H.factionReadmit(d.faction); } catch (e) { row.readmit_broke_error = String(e).slice(0, 140); }
    try { H.setGold(99999); row.readmit_rich = H.factionReadmit(d.faction); } catch (e) { row.readmit_rich_error = String(e).slice(0, 140); }
    const post = H.factionDiscipline().expelled.map((e) => e.faction);
    row.expelled_after_readmission = post.includes(d.faction);
    expulsions.push(row);
  }
  say('D1.expulsion_bites_and_readmission_is_priced', {
    discriminating: false,
    lines_that_expel: expulsions.filter((e) => e.expelled_after && !e.expelled_before).length,
    lines_where_a_broke_player_is_refused: expulsions.filter((e) => e.readmit_broke && e.readmit_broke.ok === false).length,
    lines_where_gold_buys_the_way_back: expulsions.filter((e) => e.readmit_rich && e.readmit_rich.ok === true).length,
    of: (disc.declared || []).length, rows: expulsions,
  });

  // ---------------------------------------------------------------- E. THE ORPHANS
  const orphan = {};
  try { orphan.factionAccess = H.factionAccess('the_wet_ledger'); } catch (e) { orphan.factionAccess_error = String(e).slice(0, 160); }
  say('E1.registry_services_model', {
    discriminating: false,
    factionAccess_runs: !orphan.factionAccess_error,
    detail: orphan,
    note: 'The delivery report names Engine.factionAccess() as the RI-MTH07 consumer for the registry.',
  });

  // E2. The dissenter. RI-QST01 requires the corruption reveal to be a PERSON who names the rot.
  // Walk up to four of the people the faction quests' `deceit.revealed_by` points at and record
  // what they actually say in the shipping build.
  const heard = [];
  for (const [eid, settlement] of DISSENTERS) {
    fresh(settlement);
    try { const t = H.talkTo(eid); heard.push({ eid, settlement, greeting: t && (t.greeting || t.line || null), topics_offered: t && t.topics_offered, band: t && t.band }); }
    catch (e) { heard.push({ eid, settlement, error: String(e).slice(0, 160) }); }
  }
  say('E2.the_dissenter_says_something_specific', { discriminating: false, rows: heard });

  return out;
}, { LINES: LINES.map((L) => ({ ...L })), DISSENTERS });

await game.close();

report.arm = ARM;
report.schema = 'elder-souls/critic-w1-20-r2-live@1';
report.generated_at = new Date().toISOString();
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(report, null, 2) + '\n');

console.log(`critic-w1-20-r2-live [${ARM}]`);
for (const c of report.checks) {
  const { id, rows, detail, ...rest } = c;
  console.log(`  ${id}`);
  console.log(`    ${JSON.stringify(rest)}`);
}
for (const n of report.notes) console.log(`  note: ${n}`);
console.log(`wrote ${OUT}`);
