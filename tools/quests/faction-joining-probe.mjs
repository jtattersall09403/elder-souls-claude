#!/usr/bin/env node
// faction-joining-probe.mjs — W1-20. Can a player JOIN, and does a rank change what the world does?
//
// The piece's brief is width: "no questline may be missing in wave 1". So this probe asks the
// width question about every faction the build declares a ladder for, and it asks it THROUGH PLAY
// rather than over the data — a `joins_faction` key in a JSON file is not a way in.
//
// For each faction with an eight-rank ladder in game/data/quests/faction-gates.json:
//
//   J1  is there a joining quest at all — a quest whose resolutions carry `joins_faction`?
//   J2  is its giver STANDING IN THE WORLD? `travelToGiver` populates the settlement the NPC
//       record names and then asks `sim.findNPC`. It goes red for a giver with no place, which
//       `spawnNPC` cannot do because it conjures a body out of nothing.
//   J3  does the shipped offer gate ACCEPT it from a cold start — `questOpen`, presence term
//       armed, no rank poked, the topic learned the way the world supplies topics?
//   J4  is the player REFUSED first, for a reason, and is the reason SPOKEN? A fresh character
//       cannot satisfy any resolution; the recruiter must say so in words with the numbers in
//       them, and the words must reach the HUD.
//   J5  can the reason be MET and the quest finished — skills raised the way play raises them,
//       through `grantSkillUse` and a rest, never `setSkills`?
//   J6  did the rank actually move 0 -> 1 through the DERIVED ladder, not through a poke?
//
// Then CONSUMPTION (RI-MTH07, mandatory under ARBITRATION §3). A rank is perturbed and three
// separate things in the running world are watched for a change. None of them is the quest data:
//
//   C1  the guard. `Engine.syncFactionStandings()` -> `sanction.js standingKey()` ->
//       `faction_law_factor` -> the arrest threshold and `warbroodDispositionShift()`. Same
//       enemies, same statblocks; a number the law reads.
//   C2  the recruiter's mouth. `Engine.factionRefusal()` -> the line changes as the rank does,
//       and at the top of the ladder it becomes a welcome.
//   C3  the offer gate. `questOffers()` — a quest that was not on the list is on it.
//
// And the DELETE-THE-FIX, with the control checked for inertness rather than assumed:
//   D1  `__breakFactionRefusalVoice()` mutes the voice and NOTHING ELSE. Both arms must still
//       refuse, still compute every term, and differ only in whether a person hears anything.
//       If the control arm still speaks, it is inert and this probe says so and exits non-zero.
//
// Run: node tools/quests/faction-joining-probe.mjs [--out reports/w1-20/joining.json]

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { launchGame } from '../lib/browser.mjs';
import { parseArgs, wantsHelp, usage, writeJson } from '../lib/cli.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

const USAGE = `
faction-joining-probe.mjs — every faction ladder, asked whether a player can get onto it.

USAGE
  node tools/quests/faction-joining-probe.mjs [--out <file>] [--quiet]

Exit 0 = every laddered faction that the roster calls joinable was entered from a cold start
         through the shipped offer gate, the refusal was spoken before it was met, all three
         consumption seams moved when a rank moved, and the delete-the-fix control went red.
Exit 1 = a ladder with no way onto it, a giver who is nowhere, a silent refusal, a seam that did
         not move, or a control that could not fail.
`;

const args = parseArgs(process.argv.slice(2));
if (wantsHelp(args)) { usage(USAGE); process.exit(0); }
const QUIET = !!args.quiet;
const OUT = args.out ? String(args.out) : path.join(ROOT, 'reports', 'w1-20', 'joining.json');

// The roster's own answer to "which of these is a career". Read from the design note's data
// consequence rather than restated: a faction is joinable iff some resolution in the shipped
// quest book joins it. That is also exactly what `check-data.mjs` asserts against sanction.json,
// so the two cannot drift.
// The quest book this probe reads its route census from. It follows `--entry` when one is given,
// so a DELETE-THE-FIX arm run against a throwaway worktree scans that worktree's data and not the
// live tree's. A census taken from the wrong copy is how an inert teardown looks like a pass.
const DATA_ROOT = args.entry ? path.resolve(path.dirname(String(args.entry)), 'data')
  : path.join(ROOT, 'game', 'data');
const QDIR = path.join(DATA_ROOT, 'quests');
const JOIN_ROUTES = {};
for (const f of fs.readdirSync(QDIR).filter((x) => x.endsWith('.json') && x !== 'hooks.json')) {
  let doc; try { doc = JSON.parse(fs.readFileSync(path.join(QDIR, f), 'utf8')); } catch { continue; }
  for (const q of doc.quests || []) {
    for (const r of q.resolutions || []) {
      for (const fac of ((r.consequences || {}).joins_faction) || []) {
        (JOIN_ROUTES[fac] = JOIN_ROUTES[fac] || []).push({ quest: q.id, resolution: r.id, file: f, category: q.category, faction_of_quest: q.faction || null });
      }
    }
  }
}

// How a skill is raised by USE. Same table the round-3 faction probe uses, and for the same
// reason: `setSkills` writes the register and grants nothing to the governing attribute, so a
// probe that uses it can never clear an attribute gate and will report a ladder unreachable when
// it is not.
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

const SIGNATURE = { race: 'saxhleel', upbringing: 'interior', class: 'root-speaker', birthsign: 'raj-xul' };

const game = await launchGame(args, { usage: USAGE });
const { page } = game;

const report = await page.evaluate(async ({ JOIN_ROUTES, USE_FOR, SIGNATURE }) => {
  const H = window.__HARNESS;
  const out = { lines: [], consumption: null, deletefix: null, notes: [] };

  const ladders = H.factionGates().factions.map((f) => f.id);
  out.ladders = ladders;
  out.refusal_census = H.factionRefusalCensus();

  // The player-visible surface, taken at the DRAW CALL rather than off a state field.
  // `getUIState()` has no `toast` key at all — the first version of this probe asked for one and
  // got `undefined` on all seven lines, which would have read as a silent refusal. The register
  // in render/text-register.js hooks fillText/strokeText and ui/glyphs.js drawText, so a string
  // that comes back from it is a string a person can read off the screen.
  function drawnText() {
    const x = H.getRenderedText();
    const a = (x && x.entries) || (Array.isArray(x) ? x : []);
    return a.map((t) => (t && t.text) || '');
  }
  // WHOLE, not merely present. The first version of this asked whether SOME drawn run was a
  // substring of the line, and it returned true for a sentence with its first four words and its
  // last five missing: the HUD toast drew one unwrapped centred run on a 400-unit panel, so a
  // 676 px refusal ran off both ends of the paper, and `getRenderedText()` reported it
  // `clipped: false` because nothing had clipped it. The photograph caught what the probe did
  // not. So the test is now equality against the JOINED rows — every word must be on the glass.
  const norm = (t) => String(t).replace(/\s+/g, ' ').replace(/\u2026/g, '').trim();
  function sayAndLook(fn) {
    H.uiToast(null);
    H.renderedTextClear();
    const r = fn();
    H.renderFrame();
    const drawn = drawnText();
    let whole = false, joined = null, fit = null;
    if (r && r.said) {
      // Two independent readings, and BOTH must agree, because each is blind to what the other
      // sees. (1) the text register — did the draw call happen with these words in it.
      // (2) the HUD element's own fit report — did those words land INSIDE the parchment.
      // Reading (1) alone passed a sentence with its first four words and its last five off the
      // paper; reading (2) alone would pass a toast that was never drawn at all.
      const rows = drawn.filter((t) => t && t.length > 3 && norm(r.said).includes(norm(t)));
      joined = norm(rows.join(' '));
      fit = (H.getUIState() || {}).toast || null;
      whole = joined === norm(r.said) && !!fit && fit.fits === true && fit.truncated === false;
    }
    return { r, drawn, joined, fit, on_screen: whole };
  }

  function learnAllTopics(questId) {
    const ob = (H.questDef(questId) || {}).opens_by || {};
    const all = [ob.topic, ...(ob.prerequisite_topics || [])].filter(Boolean);
    for (const t of all) H.learnTopic(t);
    return all;
  }

  function raise(skill, target) {
    const row = USE_FOR[skill];
    if (!row) return { skill, refused: 'no use event maps to this skill' };
    let uses = 0, rests = 0, guard = 0;
    while ((H.getSkills()[skill] || 0) < target && guard++ < 4000) {
      const r = H.grantSkillUse(row[0], row[1]);
      uses++;
      if (r && r.rest_clamped) { H.hearthRest(); rests++; }
    }
    return { skill, to: H.getSkills()[skill], target, uses, rests };
  }

  // ---- J1..J6, one line at a time -----------------------------------------------------------
  for (const faction of ladders) {
    const routes = JOIN_ROUTES[faction] || [];
    const line = { faction, joining_routes: routes.length, routes: routes.map((r) => `${r.quest}.${r.resolution}`) };

    if (!routes.length) {
      line.joinable_end_to_end = false;
      line.why = 'no resolution anywhere in the quest book joins this faction — an eight-rank ladder with no door';
      out.lines.push(line);
      continue;
    }

    // The quest that is the faction's OWN way in: category faction, and the quest's own faction
    // is the one being joined. A main-quest resolution that hands out a rank is recorded, but it
    // is not a joining route in the faction's voice and is reported separately.
    const own = routes.filter((r) => r.category === 'faction' && r.faction_of_quest === faction);
    const foreign = routes.filter((r) => !(r.category === 'faction' && r.faction_of_quest === faction));
    line.own_voice_routes = own.map((r) => `${r.quest}.${r.resolution}`);
    line.foreign_routes = foreign.map((r) => `${r.quest}.${r.resolution} (${r.file}, category=${r.category})`);

    const questId = (own[0] || routes[0]).quest;
    line.walked = questId;

    H.reset({ state: 'default' });
    H.setRenderRate(0);
    H.setCharacter(SIGNATURE);
    line.presence_gate = H.questPresenceGate();
    line.rank_before = (H.getFactionStanding()[faction] || {}).rank || 0;

    // J2 — the giver must be somewhere a body can stand.
    let t; try { t = H.travelToGiver(questId); } catch (e) { t = { present: false, why: String(e).slice(0, 160) }; }
    line.giver = t;

    const def = H.questDef(questId);
    // The topic, learned the way a quest becomes findable. `questTopicsKnown` is read after, so
    // the report shows what was seeded rather than assuming the poke took.
    line.topics_learned = learnAllTopics(questId);
    line.topic = (def && def.opens_by && def.opens_by.topic) || null;

    // J3 — the shipped gate, from a cold start, presence armed.
    const opened = H.questOpen(questId);
    line.open = { ok: !!opened.ok, reason: opened.reason || null, stage: opened.stage ?? null };

    // J4 — the refusal, BEFORE the reason is met. A fresh sheet cannot satisfy any resolution,
    // so ask the recruiter for the next rank and see whether words come back and reach the HUD.
    const cold = sayAndLook(() => H.factionRefusal(faction, 1));
    const refusalCold = cold.r;
    line.refusal_cold = {
      said: refusalCold.said, kind: refusalCold.kind, need: refusalCold.need, have: refusalCold.have,
      on_screen: cold.on_screen,
      drawn_on_glass: cold.joined,
      panel_fit: cold.fit,
      is_a_sentence: !!(refusalCold.said && /[.!?]\s*$/.test(refusalCold.said) && refusalCold.said.split(/\s+/).length >= 6),
      names_a_number: !!(refusalCold.said && /\d/.test(refusalCold.said)),
    };

    // J5 — meet the reason. Take the cheapest resolution and pay for it by USE.
    let chosen = null, raised = [];
    const cands = H.questResolutions(questId) || [];
    line.resolution_ids = cands.map((r) => r.id);
    for (const r of cands) {
      const req = H.questResolutionRequirements(questId, r.id) || {};
      const need = Object.entries(req.skills || {});
      if (need.length && !need.every(([s]) => USE_FOR[s])) continue;
      chosen = { id: r.id, skills: Object.fromEntries(need) };
      for (const [s, v] of need) raised.push(raise(s, v));
      break;
    }
    line.resolution_chosen = chosen;
    line.raised = raised;

    // J6 — resolve, and read the rank back off the DERIVED ladder.
    let done = null;
    if (chosen) { try { done = H.questResolve(questId, chosen.id); } catch (e) { done = { ok: false, threw: String(e).slice(0, 200) }; } }
    line.resolve = done ? { ok: !!done.ok, reason: done.reason || done.threw || null } : null;
    // J4b — the refusal must have CHANGED now the reason has been met. The reputation term is
    // first and is the only one a quest moves, so this is the beat the brief asks for: refused
    // for a reason, met the reason, the person says something different.
    const refusalWarm = H.factionRefusal(faction, 1);
    line.refusal_warm = { said: refusalWarm.said, kind: refusalWarm.kind, need: refusalWarm.need, have: refusalWarm.have };
    line.refusal_moved = refusalCold.said !== refusalWarm.said;

    const st = H.getFactionStanding()[faction] || {};
    line.rank_after = st.rank || 0;
    line.reputation_after = st.reputation || 0;
    line.member_after = !!st.member;
    line.derived_rank_after = (H.factionGates().factions.find((f) => f.id === faction) || {}).derived_rank ?? null;
    line.joinable_end_to_end = !!(t && t.present) && !!opened.ok && !!(done && done.ok) && (line.derived_rank_after >= 1);
    line.why = line.joinable_end_to_end ? null
      : [!t || !t.present ? 'giver not in the world' : null,
         !opened.ok ? `open refused: ${opened.reason}` : null,
         !chosen ? 'no resolution this probe can pay for by skill use' : null,
         done && !done.ok ? `resolve refused: ${done.reason || done.threw}` : null,
         (line.derived_rank_after || 0) < 1 ? `derived rank stayed at ${line.derived_rank_after}` : null].filter(Boolean).join('; ');
    out.lines.push(line);
  }

  // ---- CONSUMPTION: perturb a rank, watch three separate things in the world ------------------
  // The faction is one this piece opened and that had NO crime-system crossing before it, so the
  // seam being watched is the one the piece built.
  const C_FACTION = 'the_rootkeepers';
  const C_STAND = 'rootkeepers';
  H.reset({ state: 'default' });
  H.setRenderRate(0);
  H.setCharacter(SIGNATURE);

  function offerIds() {
    const o = H.questOffers();
    const list = Array.isArray(o) ? o : (o.offerable || o.offers || o.open || []);
    return (Array.isArray(list) ? list : []).map((x) => (x && x.id) || x).sort();
  }

  function worldAt(rank) {
    H.setFactionStanding(C_FACTION, { member: rank > 0, rank, reputation: rank * 12 });
    H.syncFactionStandings();
    H.uiToast(null);
    const refusal = H.factionRefusal(C_FACTION);
    return {
      rank,
      standings: JSON.parse(JSON.stringify(H.getCrimeState().standings || {})),
      warbrood_shift: H.warbroodShift(),
      guard_terms: H.getGuardTerms('saxhleel'),
      recruiter_says: refusal.said,
      refusal_kind: refusal.kind,
      offers: offerIds().length,
    };
  }

  const at0 = worldAt(0);
  const at1 = worldAt(1);
  const at5 = worldAt(5);

  // C3 — the OFFER GATE, on a quest whose rank_gate this piece brought to life. Q-SOUL-02 has
  // carried `rank_gate: the_drowned_court >= 2` since it was written and no player could ever
  // have satisfied it. The giver is travelled to first so the refusal being read is the RANK
  // gate and not the presence term.
  H.travelToGiver('Q-SOUL-02');
  // Every topic the quest's own `opens_by` names — `topic` AND `prerequisite_topics`, which is
  // where the residual term was hiding — so the only thing still moving is the rank.
  learnAllTopics('Q-SOUL-02');
  const gateAt = {};
  for (const rank of [0, 1, 2, 3]) {
    H.setFactionStanding('the_drowned_court', { member: rank > 0, rank, reputation: rank * 12 });
    H.syncFactionStandings();
    const o = H.questOpen('Q-SOUL-02');
    gateAt[rank] = { ok: !!o.ok, reason: o.reason || null, said: o.said || null };
  }
  out.consumption = {
    faction: C_FACTION,
    standing_key_id: C_STAND,
    at0, at1, at5,
    C1_guard_moved: at0.warbrood_shift !== at1.warbrood_shift || JSON.stringify(at0.standings) !== JSON.stringify(at1.standings),
    C1_guard_moved_again_at_5: at1.warbrood_shift !== at5.warbrood_shift,
    C2_recruiter_changed: at0.recruiter_says !== at1.recruiter_says && at1.recruiter_says !== at5.recruiter_says,
    C3_offer_gate: gateAt,
    C3_gate_moved: gateAt[0].ok !== gateAt[2].ok,
    C3_rank_terms_cleared: /rank 0\/2/.test(gateAt[0].reason || '') && !/rank \d+\/2/.test(gateAt[2].reason || ''),
    C3_gate_spoke_before_it_opened: !!gateAt[0].said,
  };

  // ---- DELETE-THE-FIX, with the control checked for inertness ---------------------------------
  H.reset({ state: 'default' });
  H.setRenderRate(0);
  H.setCharacter(SIGNATURE);
  H.setFactionStanding('the_drowned_court', { member: false, rank: 0, reputation: 0 });
  H.travelToGiver('Q-SOUL-02');
  learnAllTopics('Q-SOUL-02');

  H.__breakFactionRefusalVoice(false);       // ARM: the piece's world
  const armedLook = sayAndLook(() => H.factionRefusal('the_drowned_court', 2));
  const armed = armedLook.r;
  const armedOpen = H.questOpen('Q-SOUL-02');

  H.__breakFactionRefusalVoice(true);        // CONTROL: the world before this piece
  const mutedLook = sayAndLook(() => H.factionRefusal('the_drowned_court', 2));
  const muted = mutedLook.r;
  const mutedOpen = H.questOpen('Q-SOUL-02');
  H.__breakFactionRefusalVoice(false);

  out.deletefix = {
    quest: 'Q-SOUL-02',
    armed: { said: armed.said, on_screen: armedLook.on_screen, open_ok: !!armedOpen.ok, open_reason: armedOpen.reason || null, open_said: armedOpen.said || null, terms_still_computed: (armed.need != null) },
    control: { said: muted.said, on_screen: mutedLook.on_screen, open_ok: !!mutedOpen.ok, open_reason: mutedOpen.reason || null, open_said: mutedOpen.said || null },
    // The two arms must differ ONLY in speech. If the control still speaks, it is inert.
    control_went_red: !!(armed.said) && !muted.said && !mutedLook.on_screen,
    gate_unchanged_by_the_control: armedOpen.ok === mutedOpen.ok && armedOpen.reason === mutedOpen.reason,
    arms_genuinely_differ: (armed.said || null) !== (muted.said || null),
  };

  return out;
}, { JOIN_ROUTES, USE_FOR, SIGNATURE });

await game.close();

// ---- verdict ------------------------------------------------------------------------------
const laddered = report.ladders;
const withRoute = report.lines.filter((l) => l.joining_routes > 0);
const ownVoice = report.lines.filter((l) => (l.own_voice_routes || []).length > 0);
const joinable = report.lines.filter((l) => l.joinable_end_to_end);
const spokenRefusals = report.lines.filter((l) => l.refusal_cold && l.refusal_cold.said && l.refusal_cold.on_screen);

// A ladder id the roster declares NOT a career is not a hole. The exemption is read out of
// `game/data/dialogue/faction-refusals.json`'s `not_joinable` block — which is also the file that
// gives a player a sentence when they ask — so an id cannot be quietly exempted here without the
// world also being able to say why.
const DECLARED_NOT_JOINABLE = new Set((report.refusal_census && report.refusal_census.not_joinable) || []);
const problems = [];
for (const l of report.lines) {
  if (DECLARED_NOT_JOINABLE.has(l.faction)) { l.exempt = 'declared not joinable in faction-refusals.json'; continue; }
  if (!l.joining_routes) problems.push(`${l.faction}: ${l.why}`);
  else if (!l.joinable_end_to_end) problems.push(`${l.faction}: not joinable end to end — ${l.why}`);
  else if (!l.refusal_cold || !l.refusal_cold.said) problems.push(`${l.faction}: joinable but the refusal is silent`);
  else if (!l.refusal_cold.on_screen) problems.push(`${l.faction}: the refusal was composed but never drawn — a refusal a player cannot read`);
  else if (!l.refusal_moved) problems.push(`${l.faction}: the recruiter said the same thing before and after the reason was met`);
}
const c = report.consumption;
if (!c.C1_guard_moved) problems.push('CONSUMPTION C1: a rank moved and the crime system did not.');
if (!c.C2_recruiter_changed) problems.push('CONSUMPTION C2: a rank moved and the recruiter said the same thing.');
if (!c.C3_gate_moved) problems.push('CONSUMPTION C3: a rank moved and the offer gate on Q-SOUL-02 gave the same answer.');
const d = report.deletefix;
if (!d.control_went_red) problems.push('DELETE-THE-FIX: the control arm still speaks — the teardown is INERT and proves nothing.');
if (!d.arms_genuinely_differ) problems.push('DELETE-THE-FIX: the two arms are byte-identical — both are the positive arm.');
if (!d.gate_unchanged_by_the_control) problems.push('DELETE-THE-FIX: the control changed the GATE as well as the voice, so it is not a control for the voice.');

report.summary = {
  laddered_factions: laddered.length,
  with_any_joining_route: withRoute.length,
  with_a_route_in_the_factions_own_voice: ownVoice.length,
  joinable_end_to_end_through_play: joinable.length,
  refusals_spoken_and_drawn_on_screen: spokenRefusals.length,
  declared_not_joinable: [...DECLARED_NOT_JOINABLE],
  problems,
};
writeJson(OUT, report);

if (!QUIET) {
  console.log(`faction-joining-probe: ${laddered.length} laddered factions`);
  for (const l of report.lines) {
    const mark = l.joinable_end_to_end ? 'JOINABLE' : 'NO';
    console.log(`  ${mark.padEnd(9)} ${l.faction.padEnd(20)} routes=${l.joining_routes} own_voice=${(l.own_voice_routes || []).length} rank ${l.rank_before ?? 0}->${l.derived_rank_after ?? '?'}  ${l.why || ''}`);
    if (l.refusal_cold && l.refusal_cold.said) console.log(`             refused: "${l.refusal_cold.said}"`);
  }
  console.log(`  CONSUMPTION guard=${c.C1_guard_moved} (warbrood shift ${c.at0.warbrood_shift}->${c.at1.warbrood_shift}->${c.at5.warbrood_shift}) recruiter=${c.C2_recruiter_changed} offer_gate=${c.C3_gate_moved}`);
  console.log(`  DELETE-THE-FIX control_red=${d.control_went_red} arms_differ=${d.arms_genuinely_differ} gate_untouched=${d.gate_unchanged_by_the_control}`);
  console.log(`  wrote ${OUT}`);
  for (const p of problems) console.log(`  PROBLEM: ${p}`);
}
process.exit(problems.length ? 1 : 0);
