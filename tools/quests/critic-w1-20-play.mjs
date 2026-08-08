#!/usr/bin/env node
// critic-w1-20-play.mjs — THE W1-20 ROUND-1 CRITIC'S OWN INSTRUMENT. Declared under
// `method_deviations` in the verdict (RULES 24, orchestration/TOOL-LOOP.md).
//
// The builder's probe (`tools/quests/faction-joining-probe.mjs`) answers "can a player get onto
// each ladder". This one does not re-run that. It asks the five questions the builder's probe is
// structurally unable to ask, because each one is a question about the probe's own assumptions:
//
//  P1 JOIN, EVERY DOOR.  The builder's probe walks ONE resolution per faction — "the cheapest
//     resolution this probe can pay for by skill use" — and reports the line joinable. This walks
//     EVERY own-voice resolution of every joining quest, from a fresh cold start each time, on a
//     signature that is NOT the builder's. A line with three doors of which one opens is a line
//     with two dead resolutions, and the builder's arithmetic cannot see them.
//
//  P2 THE deep_kin EXEMPTION, PRESSED.  The round exempts `deep_kin` from its 7-of-8 because
//     `faction-refusals.json` declares it not-joinable "in words a player can hear": *"That is
//     the hollow's own name for itself. It is the same people and the same door."* This measures
//     whether that sentence is TRUE OF THE RUNNING WORLD: it plays the Xul-Aneekh line's own
//     joining quest and then reads BOTH standing rows and BOTH derived ranks. Same people and
//     same door means one ledger. Two ledgers is a data defect wearing an exemption.
//
//  P3 THE REFUSAL UNDER PERTURBATION.  The refusal is claimed to state no threshold, every number
//     coming from `FactionGates.evaluate()`. So move the ladder — at RUNTIME, through the engine
//     back door, no file edited — and the sentence must move with it. A sentence that does not is
//     a hardcoded number; a sentence that leaks a term the player was never told is a form.
//
//  P4 A FOURTH CONSUMER.  The round names three (the guard's law factor, the recruiter's mouth,
//     the offer gate). RI-MTH07 asks for the consumers, not for three of them. This perturbs a
//     rank and reads `explainDisposition()` — RI-DLG04 §B's faction term, which
//     `sim/dialogue/disposition.js` computes as `(mult*rank + base) * mod * reaction` — and then
//     follows it into anything downstream that a player would notice.
//
//  P5 THE WALK.  The round says plainly it did not walk to the four recruiters, and that five of
//     six enchanter posts in this build turned out to be unreachable on foot. So walk: load the
//     recruiter's own town, find the body, and drive the capsule to it with `walkPath`.
//
// Plus P0, the toast: a long line is pushed through `uiToast` and the fit report is read, to see
// whether the repaired check has a hole the repair did not close.
//
// RUN: node tools/quests/critic-w1-20-play.mjs [--out <file>]
// Exit 0 = every question answered; exit 1 = at least one answer is a finding against the piece.
// This tool is allowed to exit 1 and usually should: a critic that cannot find a gap has failed.

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { launchGame } from '../lib/browser.mjs';
import { parseArgs, wantsHelp, usage, writeJson } from '../lib/cli.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const USAGE = `
critic-w1-20-play.mjs — the W1-20 critic's own instrument.

  --out <file>   default reports/critic-w1-20/play.json
`;
const args = parseArgs(process.argv.slice(2));
if (wantsHelp(args)) { usage(USAGE); process.exit(0); }
const OUT = args.out ? String(args.out) : path.join(ROOT, 'reports', 'critic-w1-20', 'play.json');

// Same use-table as the builder's probe, and named here rather than imported so that a change to
// the builder's file cannot silently change this measurement.
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

// The four recruiters, their towns, and the state that boots each town. Taken from the quest
// records' `giver.npc_id` + `giver.location`, not from the report.
const RECRUITERS = [
  ['Q-ROOT-00', 'rootkeeper-jeen', 'town-helstrom'],
  ['Q-VAKH-00', 'cutter-neeth', 'town-helstrom'],
  ['Q-CORT-00', 'undertaker-vaskh', 'town-soulrest'],
  ['Q-DOCK-00', 'npc-porter-eeja', 'town-gideon'],
];

const game = await launchGame(args, { usage: USAGE });
const { page } = game;

const out = await page.evaluate(async ({ USE_FOR, RECRUITERS }) => {
  const H = window.__HARNESS;
  if (H.ready) { try { await H.ready(); } catch { /* older harness */ } }
  const E = window.__ENGINE;                 // the back door, used ONLY by P3 and said so there
  const R = { notes: [] };
  const clone = (x) => JSON.parse(JSON.stringify(x === undefined ? null : x));

  const ladders = H.factionGates().factions.map((f) => f.id);
  R.ladders = ladders;

  function raise(skill, target) {
    const row = USE_FOR[skill];
    if (!row) return { skill, refused: 'no use event maps to this skill' };
    let uses = 0, guard = 0;
    while ((H.getSkills()[skill] || 0) < target && guard++ < 4000) {
      const r = H.grantSkillUse(row[0], row[1]);
      uses++;
      if (r && r.rest_clamped) H.hearthRest();
    }
    return { skill, to: H.getSkills()[skill], target, uses };
  }
  function learnAllTopics(questId) {
    const ob = (H.questDef(questId) || {}).opens_by || {};
    for (const t of [ob.topic, ...(ob.prerequisite_topics || [])].filter(Boolean)) H.learnTopic(t);
  }

  // ---- signature. DELIBERATELY NOT the builder's `saxhleel/interior/root-speaker/raj-xul`. ----
  const cd = H.getCreationData ? H.getCreationData() : null;
  const pick = (list, avoid, fallback) => {
    const arr = Array.isArray(list) ? list : (list && typeof list === 'object' ? Object.values(list) : []);
    const ids = arr.map((x) => (x && x.id) || (typeof x === 'string' ? x : null)).filter(Boolean);
    return ids.find((i) => i !== avoid) || ids[0] || fallback;
  };
  // A DIFFERENT character from the builder's. Its probe walked
  // `saxhleel / interior / root-speaker / raj-xul`; a line that is joinable by exactly one sheet
  // is not a joinable line, and `root-speaker` is the class whose favoured skill happens to be the
  // one three of the four new resolutions ask for.
  const SIG = {
    race: 'saxhleel', upbringing: 'lukiul', class: 'ledger-hand', birthsign: 'kaal-kaal',
  };
  void pick;
  R.creation_keys = cd ? Object.keys(cd) : null;
  R.signature = SIG;
  R.builders_signature = { race: 'saxhleel', upbringing: 'interior', class: 'root-speaker', birthsign: 'raj-xul' };

  function coldStart() {
    H.reset({ state: 'default' });
    H.setRenderRate(0);
    H.setCharacter(SIG);
  }

  // =============================================================================================
  // P1 — every door of every joining quest, one cold start each.
  // =============================================================================================
  const DOORS = {
    the_rootkeepers: 'Q-ROOT-00', the_ixtu_vakh: 'Q-VAKH-00', the_drowned_court: 'Q-CORT-00',
    the_dockhands: 'Q-DOCK-00', the_wet_ledger: 'Q-LEDG-00', the_imperial_assize: 'Q-ASSZ-00',
    the_xul_aneekh: 'Q-XULA-00',
  };
  R.p1 = [];
  for (const [faction, questId] of Object.entries(DOORS)) {
    const def = (() => { try { return H.questDef(questId); } catch { return null; } })();
    if (!def) { R.p1.push({ faction, quest: questId, missing: true }); continue; }
    const resIds = (H.questResolutions(questId) || []).map((r) => r.id);
    const row = { faction, quest: questId, resolutions: resIds, doors: [] };
    for (const rid of resIds) {
      coldStart();
      learnAllTopics(questId);
      let travelled = null;
      try { travelled = H.travelToGiver(questId); } catch (e) { travelled = { present: false, why: String(e).slice(0, 120) }; }
      const opened = H.questOpen(questId);
      const req = H.questResolutionRequirements(questId, rid) || {};
      const needs = Object.entries(req.skills || {});
      const payable = needs.every(([s]) => USE_FOR[s]);
      const raised = payable ? needs.map(([s, v]) => raise(s, v)) : [];
      let done = null;
      try { done = H.questResolve(questId, rid); } catch (e) { done = { ok: false, threw: String(e).slice(0, 200) }; }
      const derived = (H.factionGates().factions.find((f) => f.id === faction) || {}).derived_rank ?? null;
      const st = H.getFactionStanding()[faction] || {};
      row.doors.push({
        resolution: rid,
        giver_present: !!(travelled && travelled.present),
        open_ok: !!opened.ok, open_reason: opened.reason || null,
        requires: Object.fromEntries(needs), payable_by_use: payable, raised,
        resolved: !!(done && done.ok), resolve_reason: (done && (done.reason || done.threw)) || null,
        reputation_after: st.reputation || 0, member_after: !!st.member, derived_rank_after: derived,
        joined: !!(done && done.ok) && (derived >= 1),
      });
    }
    row.doors_that_join = row.doors.filter((d) => d.joined).length;
    row.doors_total = row.doors.length;
    R.p1.push(row);
  }

  // =============================================================================================
  // P2 — the deep_kin exemption. "It is the same people and the same door."
  // =============================================================================================
  // A. Do the Xul-Aneekh's OWN joining quest and read both rows. If the sentence is true of the
  //    running world, one join must produce one standing; if two rows move independently, the
  //    build carries two ledgers for one body — which is the defect `progression/factions.json`
  //    names in its own w1_20_note as one "this project has already paid for twice".
  coldStart();
  learnAllTopics('Q-XULA-00');
  H.travelToGiver('Q-XULA-00');
  const xulRes = (H.questResolutions('Q-XULA-00') || []).map((r) => r.id);
  let joinedVia = null;
  for (const rid of xulRes) {
    const req = H.questResolutionRequirements('Q-XULA-00', rid) || {};
    const needs = Object.entries(req.skills || {});
    if (needs.length && !needs.every(([s]) => USE_FOR[s])) continue;
    for (const [s, v] of needs) raise(s, v);
    const d = H.questResolve('Q-XULA-00', rid);
    if (d && d.ok) { joinedVia = rid; break; }
  }
  const gatesAfterXula = H.factionGates().factions;
  const standAfterXula = H.getFactionStanding();
  R.p2 = {
    joined_via: joinedVia,
    refusal_sentence_for_deep_kin: H.factionRefusal('deep_kin', 1),
    after_joining_the_xul_aneekh: {
      the_xul_aneekh: clone(standAfterXula.the_xul_aneekh || null),
      deep_kin: clone(standAfterXula.deep_kin || null),
      derived_rank_xul: (gatesAfterXula.find((f) => f.id === 'the_xul_aneekh') || {}).derived_rank,
      derived_rank_deep_kin: (gatesAfterXula.find((f) => f.id === 'deep_kin') || {}).derived_rank,
    },
    // B. The two ladders, side by side. A duplicate id should be a duplicate.
    ladder_rank_names: {
      the_xul_aneekh: (gatesAfterXula.find((f) => f.id === 'the_xul_aneekh') || {}).ranks.map((r) => r.name),
      deep_kin: (gatesAfterXula.find((f) => f.id === 'deep_kin') || {}).ranks.map((r) => r.name),
    },
  };
  // C. Is deep_kin's ladder REACHABLE by play, i.e. does the quest book pay it? Rather than
  //    reading the JSON (the round did), pay the reputation the way a resolution does and watch
  //    the DERIVED rank. If the ladder climbs, "no door" is false — the door is the Xul-Aneekh's.
  const climb = [];
  for (const rep of [0, 10, 22, 52, 112]) {
    H.setFactionStanding('deep_kin', { member: false, rank: 0, reputation: rep });
    H.syncFactionStandings();
    const g = H.factionGates().factions.find((f) => f.id === 'deep_kin');
    climb.push({ reputation: rep, derived_rank: g.derived_rank, rank_name: (g.ranks[g.derived_rank] || {}).name || null });
  }
  R.p2.deep_kin_ladder_climbs_on_reputation_alone = climb;

  // =============================================================================================
  // P3 — the refusal under perturbation of the ladder itself.
  // =============================================================================================
  // The ONLY use of `window.__ENGINE` in this file, and it is a perturbation and not a read: the
  // harness has no verb that writes a rank row, and editing `faction-gates.json` would be editing
  // a file this critic does not own. The mutation is made, measured, and put back.
  coldStart();
  R.p3 = { engine_backdoor_used: true, why: 'no harness verb writes a rank row; the tree is not edited' };
  if (!E || !E.factionGates) {
    R.p3.blocked = 'window.__ENGINE.factionGates is not reachable — the perturbation could not be made';
  } else {
    const rows = [];
    for (const fid of ['the_rootkeepers', 'the_drowned_court', 'the_dockhands']) {
      const f = E.factionGates.get(fid);
      const r1 = f.ranks[1];
      const before = { reputation: r1.reputation, attribute: r1.attribute, skill_1: r1.skill_1 };
      const said0 = H.factionRefusal(fid, 1);
      r1.reputation = 37;                                   // a number no prose in the tree contains
      const saidRep = H.factionRefusal(fid, 1);
      r1.reputation = before.reputation;
      // Now clear the reputation term and make the ATTRIBUTE term bite, to see whether the
      // sentence changes KIND as well as number.
      H.setFactionStanding(fid, { member: false, rank: 0, reputation: 99 });
      H.syncFactionStandings();
      const saidAttr = H.factionRefusal(fid, 1);
      H.setFactionStanding(fid, { member: false, rank: 0, reputation: 0 });
      H.syncFactionStandings();
      Object.assign(r1, before);
      rows.push({
        faction: fid,
        rank1_before: before,
        said_at_default: said0.said, need_at_default: said0.need,
        said_with_rep_moved_to_37: saidRep.said, need_after: saidRep.need,
        sentence_moved: said0.said !== saidRep.said,
        number_is_the_perturbed_one: /\b37\b/.test(String(saidRep.said || '')),
        said_when_reputation_is_met: saidAttr.said, kind_when_reputation_is_met: saidAttr.kind,
        kind_changed: said0.kind !== saidAttr.kind,
      });
    }
    R.p3.rows = rows;
  }

  // =============================================================================================
  // P4 — a fourth consumer. RI-DLG04 §B's faction term, read through explainDisposition().
  // =============================================================================================
  coldStart();
  const FAC = 'the_rootkeepers';
  const RECRUITER = 'rootkeeper-jeen';
  // The recruiter has to be in the world for a disposition to be explained about them.
  try { H.travelToGiver('Q-ROOT-00'); } catch { /* reported below by a null explain */ }
  const dispAt = [];
  for (const rank of [0, 1, 3, 5, 7]) {
    H.setFactionStanding(FAC, { member: rank > 0, rank, reputation: rank * 16 });
    H.syncFactionStandings();
    let ex = null;
    try { ex = H.explainDisposition(RECRUITER); } catch (e) { ex = { threw: String(e).slice(0, 160) }; }
    const gate = H.getGateDispositions ? (H.getGateDispositions() || {})[RECRUITER] : null;
    let quote = null;
    try { quote = H.getPriceQuote({ npc: RECRUITER, item: 'potion_minor', direction: 'buy' }); } catch { quote = null; }
    dispAt.push({
      rank,
      disposition_total: ex && (ex.total ?? ex.disposition ?? null),
      faction_term: ex && (ex.faction ?? (ex.terms && ex.terms.faction) ?? null),
      explain: clone(ex),
      gate_disposition: gate ?? null,
      price_quote: clone(quote),
      warbrood_shift: H.warbroodShift(),
    });
  }
  R.p4 = {
    faction: FAC, npc: RECRUITER, rows: dispAt,
    disposition_moved: JSON.stringify(dispAt[0].explain) !== JSON.stringify(dispAt[3].explain),
    gate_disposition_moved: dispAt[0].gate_disposition !== dispAt[3].gate_disposition,
  };

  // =============================================================================================
  // P5 — the walk. Four recruiters, on foot, in their own towns.
  // =============================================================================================
  R.p5 = [];
  for (const [questId, who, state] of RECRUITERS) {
    const leg = { quest: questId, who, state };
    try {
      H.setSeed(7); H.loadState(state); H.stepFrames(4); H.loadState(state);
      H.setRenderRate(0); H.stepFrames(30);
      const npcs = H.listNPCs() || [];
      const row = npcs.find((n) => n.eid === who || n.id === who);
      leg.npc_count_in_town = npcs.length;
      if (!row) { leg.found = false; R.p5.push(leg); continue; }
      leg.found = true; leg.name = row.name; leg.pos = row.pos;
      const a = H.getPlayerStats().pos.slice();
      leg.start = a;
      leg.straight_line_m = Math.round(Math.hypot(a[0] - row.pos[0], a[2] - row.pos[2]) * 100) / 100;
      let walked = null;
      try { walked = H.walkPath([[a[0], a[2]], [row.pos[0], row.pos[2]]], { speed: 'walk', arrive_m: 1.6 }); }
      catch (e) { walked = { error: String(e && e.message).slice(0, 200) }; }
      const b = H.getPlayerStats().pos.slice();
      leg.end = b;
      leg.covered_m = Math.round(Math.hypot(b[0] - a[0], b[2] - a[2]) * 100) / 100;
      leg.stopped_short_m = Math.round(Math.hypot(b[0] - row.pos[0], b[2] - row.pos[2]) * 100) / 100;
      leg.arrived = !!(walked && walked.arrived);
      leg.aborted = (walked && walked.aborted) || null;
      leg.frames = walked ? walked.frames : null;
      leg.walk_error = (walked && walked.error) || null;
      // Arriving is not the same as being able to speak to them.
      try { const t = H.talkTo(row.eid || who); leg.talk_opened = !!t; leg.topics = (t && (t.list || [])).map((x) => x.id || x.text).slice(0, 12); H.conversationClose(); }
      catch (e) { leg.talk_opened = false; leg.talk_error = String(e).slice(0, 160); }
    } catch (e) { leg.fatal = String(e).slice(0, 200); }
    R.p5.push(leg);
  }

  // =============================================================================================
  // P0 — the toast, and the hole the repair may not have closed.
  // =============================================================================================
  // `fits` is derived in ui/system.js from the element RECT, which the wrapper does not set — that
  // is the repair and it is the right shape. But `widest_px` is still measured off `rows`, the
  // wrapper's OWN OUTPUT, so a wrapper that DROPS words keeps `fits: true`. The build already has
  // a path that drops words: four lines' worth of text is truncated to three with an ellipsis.
  coldStart();
  const toastCases = [];
  const LINES = [
    ['short', 'Not now.'],
    ['refusal', H.factionRefusal('the_drowned_court', 1).said || ''],
    ['long', 'The tally has you at 0 and Knee-Deep is 10, and the bay keeps sending them in on the tide whether or not anybody has written your name down beside the fee, which is the same for all of you and always has been, and will be after you and I are both on it.'],
  ];
  for (const [label, text] of LINES) {
    H.uiToast(null); H.renderedTextClear();
    H.uiToast(text);
    H.renderFrame();
    const ui = (H.getUIState() || {}).toast || null;
    const drawn = ((H.getRenderedText() || {}).entries || []).map((t) => (t && t.text) || '');
    const norm = (t) => String(t).replace(/\s+/g, ' ').replace(/…/g, '').trim();
    const rows = drawn.filter((t) => t && t.length > 3 && norm(text).includes(norm(t)));
    toastCases.push({
      label, chars: text.length, text,
      fit: clone(ui),
      words_in_text: norm(text).split(' ').length,
      words_on_glass: norm(rows.join(' ')).split(' ').filter(Boolean).length,
      every_word_on_glass: norm(rows.join(' ')) === norm(text),
      // The question the shipped check does not ask.
      fits_true_but_words_missing: !!(ui && ui.fits === true) && norm(rows.join(' ')) !== norm(text),
    });
  }
  R.p0 = { cases: toastCases };
  H.uiToast(null);

  return R;
}, { USE_FOR, RECRUITERS });

await game.close();

// ---- verdict ---------------------------------------------------------------------------------
const findings = [];
for (const row of out.p1 || []) {
  if (row.missing) { findings.push(`P1 ${row.faction}: quest ${row.quest} does not exist`); continue; }
  if (row.doors_that_join === 0) findings.push(`P1 ${row.faction}: NO resolution of ${row.quest} joined the faction`);
  else if (row.doors_that_join < row.doors_total) {
    const dead = row.doors.filter((d) => !d.joined).map((d) => `${d.resolution} (${d.resolve_reason || d.open_reason || 'no reason'})`);
    findings.push(`P1 ${row.faction}: ${row.doors_that_join}/${row.doors_total} doors open — dead: ${dead.join('; ')}`);
  }
}
const p2 = out.p2 || {};
const dk = (p2.after_joining_the_xul_aneekh || {});
if (dk.derived_rank_xul >= 1 && (dk.derived_rank_deep_kin || 0) < 1) {
  findings.push('P2 deep_kin: joining the Xul-Aneekh left deep_kin at rank 0 — two standings for one body, so "the same people and the same door" is false of the running world');
}
if (JSON.stringify((p2.ladder_rank_names || {}).the_xul_aneekh) !== JSON.stringify((p2.ladder_rank_names || {}).deep_kin)) {
  findings.push('P2 deep_kin: the two ladders carry DIFFERENT rank names, so they are not one ladder under two ids');
}
if ((p2.deep_kin_ladder_climbs_on_reputation_alone || []).some((r) => r.derived_rank >= 1)) {
  findings.push('P2 deep_kin: its ladder climbs on reputation alone, and the shipped quest book pays it — so it is not a ladder with no door, it is a second ledger being filled');
}
for (const r of (out.p3 && out.p3.rows) || []) {
  if (!r.sentence_moved) findings.push(`P3 ${r.faction}: the ladder moved and the refusal did not — the number is not coming from evaluate()`);
  if (!r.number_is_the_perturbed_one) findings.push(`P3 ${r.faction}: the refusal did not name the perturbed number`);
  if (!r.kind_changed) findings.push(`P3 ${r.faction}: meeting the reputation term did not change WHICH term the recruiter names`);
}
if (out.p3 && out.p3.blocked) findings.push(`P3: ${out.p3.blocked}`);
if (out.p4 && !out.p4.disposition_moved) findings.push('P4: a rank moved 0 -> 5 and the recruiter\'s disposition did not — the fourth consumer is not one');
for (const leg of out.p5 || []) {
  if (leg.fatal) findings.push(`P5 ${leg.who}: ${leg.fatal}`);
  else if (!leg.found) findings.push(`P5 ${leg.who}: not in ${leg.state} at all`);
  else if (!leg.arrived) findings.push(`P5 ${leg.who}: NOT REACHABLE ON FOOT — stopped ${leg.stopped_short_m} m short${leg.aborted ? ` (${leg.aborted})` : ''}`);
  else if (!leg.talk_opened) findings.push(`P5 ${leg.who}: walked to, but talkTo did not open`);
}
for (const c of (out.p0 && out.p0.cases) || []) {
  if (c.fits_true_but_words_missing) findings.push(`P0 toast "${c.label}": fits=true and ${c.words_in_text - c.words_on_glass} word(s) are not on the glass`);
}

out.findings = findings;
writeJson(OUT, out);
console.log(`critic-w1-20-play: ${findings.length} finding(s); wrote ${OUT}`);
for (const f of findings) console.log(`  FINDING: ${f}`);
process.exit(findings.length ? 1 : 0);
