#!/usr/bin/env node
// critic-w1-20-ledgers.mjs — the W1-20 round-1 critic's SECOND instrument. Declared under
// `method_deviations`. Everything here is a question the first one raised and could not close.
//
//  L1  THE DOUBLE LEDGER.   Join the Xul-Aneekh through play and then read BOTH standing rows.
//      `faction-refusals.json` tells a player *"It is the same people and the same door"* about
//      `deep_kin`. One body means one ledger.
//
//  L2  THE DROWNED COURT'S SECOND RANK.  The round says plainly that the Court *"still cannot
//      reach Q-SOUL-02 by play"* because rank 2 wants 22 reputation and *"a quest may grant 10"*.
//      Measured, one joining quest pays TWENTY — the quest-level and the resolution-level
//      `faction_reputation` are summed by `mergeConsequences()`. So the arithmetic behind that
//      sentence is wrong by a factor of two, and there is at least one ungated side quest that
//      also pays the Court. Play both and see whether the gate the round says is unreachable
//      opens.
//
//  L3  THE THIRTY-FIVE SENTENCES.  Seven factions x five terms are authored in
//      `faction-refusals.json`. The round's headline measures ONE of them per faction — the
//      reputation line at rank 1. Which of the other twenty-eight can a player ever hear?
//
//  L4  THE RANK NOBODY WRITES.  `syncFactionStandings()` reads the DERIVED rank, so the crime
//      seam moves from play. `sim/dialogue/disposition.js factionTerm()` reads `m.rank` — the
//      STORED field on the standing row — and nothing in the build writes it. So compare the
//      disposition after a real play-join against the disposition after a poke.
//
//  L5  EXCLUSIVITY.  `faction-gates.json` puts `the_drowned_court` and `the_imperial_assize` in a
//      hard group: *"You cannot swear to a drowned crown and to the Assize that would hang it."*
//      This piece made the Court joinable. Join it, then try to join the Assize.
//
//  L6  THE WALK, SECOND ATTEMPT.  Three of four recruiters aborted `stuck` in
//      `critic-w1-20-play.mjs`. Before that is called a world defect, give the walker every
//      chance: four approach bearings per recruiter, a longer budget, and a check for whether the
//      body is behind an interior door rather than behind a wall.
//
// RUN: node tools/quests/critic-w1-20-ledgers.mjs [--out <file>] [--shots]
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { launchGame } from '../lib/browser.mjs';
import { parseArgs, wantsHelp, usage, writeJson } from '../lib/cli.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const USAGE = `critic-w1-20-ledgers.mjs — the second critic instrument for W1-20.\n  --out <file>\n  --shots  write docs/shots/ pictures\n`;
const args = parseArgs(process.argv.slice(2));
if (wantsHelp(args)) { usage(USAGE); process.exit(0); }
const OUT = args.out ? String(args.out) : path.join(ROOT, 'reports', 'critic-w1-20', 'ledgers.json');

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
const RECRUITERS = [
  ['Q-ROOT-00', 'rootkeeper-jeen', 'town-helstrom'],
  ['Q-VAKH-00', 'cutter-neeth', 'town-helstrom'],
  ['Q-CORT-00', 'undertaker-vaskh', 'town-soulrest'],
  ['Q-DOCK-00', 'npc-porter-eeja', 'town-gideon'],
];

const game = await launchGame(args, { usage: USAGE });
const { page } = game;

const R = await page.evaluate(async ({ USE_FOR, RECRUITERS }) => {
  const H = window.__HARNESS;
  if (H.ready) { try { await H.ready(); } catch { /* older harness */ } }
  const clone = (x) => JSON.parse(JSON.stringify(x === undefined ? null : x));
  const out = {};
  const SIG = { race: 'saxhleel', upbringing: 'lukiul', class: 'ledger-hand', birthsign: 'kaal-kaal' };

  function cold() { H.reset({ state: 'default' }); H.setRenderRate(0); H.setCharacter(SIG); }
  function raise(skill, target) {
    const row = USE_FOR[skill]; if (!row) return false;
    let g = 0;
    while ((H.getSkills()[skill] || 0) < target && g++ < 4000) {
      const r = H.grantSkillUse(row[0], row[1]); if (r && r.rest_clamped) H.hearthRest();
    }
    return (H.getSkills()[skill] || 0) >= target;
  }
  function topics(q) {
    const ob = (H.questDef(q) || {}).opens_by || {};
    for (const t of [ob.topic, ...(ob.prerequisite_topics || [])].filter(Boolean)) H.learnTopic(t);
  }
  // Play one quest to completion the way the world does: topic, giver, open, pay for a
  // resolution by USE, resolve. Returns what the world said at each step.
  function play(questId, prefer) {
    topics(questId);
    let travelled = null; try { travelled = H.travelToGiver(questId); } catch (e) { travelled = { present: false, why: String(e).slice(0, 120) }; }
    const opened = H.questOpen(questId);
    if (!opened.ok) return { quest: questId, travelled: !!(travelled && travelled.present), opened: false, reason: opened.reason || null };
    const cands = (H.questResolutions(questId) || []).map((r) => r.id);
    const order = prefer ? [prefer, ...cands.filter((c) => c !== prefer)] : cands;
    for (const rid of order) {
      const req = H.questResolutionRequirements(questId, rid) || {};
      const need = Object.entries(req.skills || {});
      if (need.length && !need.every(([s]) => USE_FOR[s])) continue;
      let ok = true; for (const [s, v] of need) ok = raise(s, v) && ok;
      if (!ok) continue;
      let d = null; try { d = H.questResolve(questId, rid); } catch (e) { d = { ok: false, threw: String(e).slice(0, 160) }; }
      if (d && d.ok) return { quest: questId, travelled: !!(travelled && travelled.present), opened: true, resolved: rid };
    }
    return { quest: questId, travelled: !!(travelled && travelled.present), opened: true, resolved: null, reason: 'no payable resolution' };
  }
  const derived = (id) => (H.factionGates().factions.find((f) => f.id === id) || {}).derived_rank ?? null;

  // ---- L1: the double ledger ------------------------------------------------------------------
  cold();
  const l1play = play('Q-XULA-00');
  const st1 = H.getFactionStanding();
  out.L1 = {
    played: l1play,
    the_xul_aneekh: clone(st1.the_xul_aneekh || null),
    deep_kin: clone(st1.deep_kin || null),
    derived_the_xul_aneekh: derived('the_xul_aneekh'),
    derived_deep_kin: derived('deep_kin'),
    what_the_world_says_about_deep_kin: (H.factionRefusal('deep_kin', 1) || {}).said || null,
  };
  // And the same after a SECOND Xul-Aneekh quest, which is where the deep_kin payments live.
  const l1b = play('Q-XULA-01');
  const st2 = H.getFactionStanding();
  out.L1.after_a_second_xul_quest = {
    played: l1b,
    the_xul_aneekh: clone(st2.the_xul_aneekh || null),
    deep_kin: clone(st2.deep_kin || null),
    derived_the_xul_aneekh: derived('the_xul_aneekh'),
    derived_deep_kin: derived('deep_kin'),
  };

  // ---- L2: the Drowned Court's second rank ----------------------------------------------------
  cold();
  const steps = [];
  const readCourt = (label) => {
    const s = H.getFactionStanding().the_drowned_court || {};
    const o = H.questOpen('Q-SOUL-02');
    return { label, reputation: s.reputation || 0, member: !!s.member, stored_rank: s.rank ?? null, derived_rank: derived('the_drowned_court'), q_soul_02_open: !!o.ok, q_soul_02_reason: o.reason || null };
  };
  topics('Q-SOUL-02'); H.travelToGiver('Q-SOUL-02');
  steps.push(readCourt('cold'));
  const cort = play('Q-CORT-00');
  steps.push({ ...readCourt('after Q-CORT-00'), played: cort });
  const blak = play('Q-BLAK-01');
  steps.push({ ...readCourt('after Q-BLAK-01'), played: blak });
  out.L2 = {
    steps,
    reputation_from_one_joining_quest: (steps[1] || {}).reputation || 0,
    reached_rank_2: steps.some((s) => (s.derived_rank || 0) >= 2),
    q_soul_02_ever_opened: steps.some((s) => s.q_soul_02_open),
  };

  // ---- L3: the thirty-five sentences ----------------------------------------------------------
  // Reachability of every authored term template, asked of the ENGINE rather than of the file:
  // drive the character into a state where each term is the FIRST unmet one and see what comes
  // back. Reputation is set directly (it is a standing, not a skill), skills are left where a
  // fresh sheet leaves them, and the rank asked for is walked 1..7.
  cold();
  const census = [];
  for (const fid of H.factionGates().factions.map((f) => f.id)) {
    const kinds = new Set(); const rows = [];
    for (const rank of [1, 2, 3, 4, 5, 6, 7]) {
      for (const rep of [0, 500]) {
        H.setFactionStanding(fid, { member: rep > 0, rank: 0, reputation: rep });
        H.syncFactionStandings();
        const r = H.factionRefusal(fid, rank);
        if (r && r.kind) kinds.add(r.kind);
        rows.push({ rank, reputation: rep, kind: r && r.kind, said: r && r.said ? String(r.said).slice(0, 60) : null });
      }
    }
    H.setFactionStanding(fid, { member: false, rank: 0, reputation: 0 });
    census.push({ faction: fid, kinds_heard: [...kinds].sort(), rows });
  }
  out.L3 = { census, note: 'kinds are the term the recruiter names; a template whose kind never appears is a sentence no player can hear' };

  // ---- L4: the rank nobody writes -------------------------------------------------------------
  cold();
  const playJoin = play('Q-ROOT-00');
  const afterPlay = { standing: clone(H.getFactionStanding().the_rootkeepers || null), derived: derived('the_rootkeepers'), explain: clone(H.explainDisposition('rootkeeper-jeen')) };
  // Now the same world with the STORED rank poked to what the ladder derived.
  H.setFactionStanding('the_rootkeepers', { rank: afterPlay.derived });
  H.syncFactionStandings();
  const afterPoke = { standing: clone(H.getFactionStanding().the_rootkeepers || null), derived: derived('the_rootkeepers'), explain: clone(H.explainDisposition('rootkeeper-jeen')) };
  const term = (e) => ((e && e.movable) || []).find((m) => m[0] === 'faction');
  out.L4 = {
    after_play: afterPlay, after_poking_the_stored_rank: afterPoke,
    faction_term_from_play: term(afterPlay.explain) || null,
    faction_term_from_poke: term(afterPoke.explain) || null,
    stored_rank_written_by_play: (afterPlay.standing || {}).rank,
    disposition_from_play: (afterPlay.explain || {}).value,
    disposition_from_poke: (afterPoke.explain || {}).value,
  };

  // ---- L5: exclusivity ------------------------------------------------------------------------
  cold();
  const c1 = play('Q-CORT-00');
  const closes = (H.factionGates().factions.find((f) => f.id === 'the_drowned_court') || {}).closes;
  const locked = H.factionGates().rivalry_locked_now;
  const a1 = play('Q-ASSZ-00');
  const st5 = H.getFactionStanding();
  out.L5 = {
    joined_the_court: c1, court_closes: closes, rivalry_locked_after_joining_the_court: locked,
    then_joined_the_assize: a1,
    both_memberships_held: !!(st5.the_drowned_court && st5.the_drowned_court.member) && !!(st5.the_imperial_assize && st5.the_imperial_assize.member),
    derived_court: derived('the_drowned_court'), derived_assize: derived('the_imperial_assize'),
    rivalry_locked_at_the_end: H.factionGates().rivalry_locked_now,
    // X1 also demands the lock be SPOKEN at join time.
    anything_said_at_join: (H.getUIState() || {}).toast || null,
  };

  // ---- L6: the walk, second attempt -----------------------------------------------------------
  out.L6 = [];
  for (const [questId, who, state] of RECRUITERS) {
    const leg = { quest: questId, who, state, attempts: [] };
    H.setSeed(7); H.loadState(state); H.stepFrames(4); H.loadState(state);
    H.setRenderRate(0); H.stepFrames(30);
    const row = (H.listNPCs() || []).find((n) => n.eid === who || n.id === who);
    if (!row) { leg.found = false; out.L6.push(leg); continue; }
    leg.found = true; leg.pos = row.pos;
    leg.interiors_in_this_state = (H.listInteriors ? (H.listInteriors() || []) : []).map((i) => i.id || i).slice(0, 20);
    const P = H.getPlayerStats().pos.slice();
    // Four approach bearings: walk to a staging point 12 m out on each compass side of the body,
    // then in. A body behind one wall is reachable from the other side; a body inside a sealed
    // volume is not reachable from any.
    for (const [dx, dz, name] of [[0, -12, 'from north'], [12, 0, 'from east'], [0, 12, 'from south'], [-12, 0, 'from west']]) {
      H.setSeed(7); H.loadState(state); H.stepFrames(4); H.loadState(state);
      H.setRenderRate(0); H.stepFrames(30);
      const a = H.getPlayerStats().pos.slice();
      let w1 = null, w2 = null;
      try { w1 = H.walkPath([[a[0], a[2]], [row.pos[0] + dx, row.pos[2] + dz]], { speed: 'walk', arrive_m: 2.0 }); } catch (e) { w1 = { error: String(e).slice(0, 120) }; }
      const m = H.getPlayerStats().pos.slice();
      try { w2 = H.walkPath([[m[0], m[2]], [row.pos[0], row.pos[2]]], { speed: 'walk', arrive_m: 1.6 }); } catch (e) { w2 = { error: String(e).slice(0, 120) }; }
      const b = H.getPlayerStats().pos.slice();
      leg.attempts.push({
        approach: name,
        staging_reached: !!(w1 && w1.arrived), staging_abort: (w1 && w1.aborted) || null,
        arrived: !!(w2 && w2.arrived), abort: (w2 && w2.aborted) || null,
        stopped_short_m: Math.round(Math.hypot(b[0] - row.pos[0], b[2] - row.pos[2]) * 100) / 100,
        total_frames: ((w1 && w1.frames) || 0) + ((w2 && w2.frames) || 0),
      });
    }
    leg.best_stopped_short_m = Math.min(...leg.attempts.map((a) => a.stopped_short_m));
    leg.reachable_on_foot = leg.attempts.some((a) => a.arrived);
    // Is the body standing inside a solid? `solidAt` answers for the point itself.
    try { leg.solid_at_the_body = H.solidAt(row.pos[0], row.pos[1], row.pos[2]); } catch { leg.solid_at_the_body = null; }
    try { leg.building_at_the_body = H.buildingAt ? H.buildingAt(row.pos[0], row.pos[2]) : null; } catch { leg.building_at_the_body = null; }
    void P;
    out.L6.push(leg);
  }

  return out;
}, { USE_FOR, RECRUITERS });

await game.close();

const findings = [];
const l1 = R.L1 || {};
if ((l1.derived_the_xul_aneekh || 0) >= 1 && JSON.stringify(l1.the_xul_aneekh) !== JSON.stringify(l1.deep_kin)) {
  findings.push('L1: joining the Xul-Aneekh produced two different standing rows for one body (deep_kin != the_xul_aneekh)');
}
if (R.L2 && R.L2.reputation_from_one_joining_quest > 10) {
  findings.push(`L2: one joining quest paid ${R.L2.reputation_from_one_joining_quest} reputation, not the 10 the report states (RI-QST03 §B caps a quest at +10)`);
}
if (R.L2 && R.L2.q_soul_02_ever_opened) findings.push('L2: Q-SOUL-02 DID open by play — the round\'s stated limitation is too pessimistic');
for (const c of (R.L3 && R.L3.census) || []) {
  if (c.kinds_heard.length <= 1 && c.faction !== 'deep_kin') findings.push(`L3 ${c.faction}: only ${c.kinds_heard.join(',') || 'nothing'} can be heard of five authored terms`);
}
if (R.L4 && R.L4.stored_rank_written_by_play === 0 && JSON.stringify(R.L4.faction_term_from_play) !== JSON.stringify(R.L4.faction_term_from_poke)) {
  findings.push('L4: play leaves the STORED rank at 0, and disposition\'s faction term reads that field — so the term the consumption section demonstrates by poking never moves by playing');
}
if (R.L5 && R.L5.both_memberships_held) findings.push('L5: the player holds BOTH the Drowned Court and the Imperial Assize, which faction-gates.json declares a hard-exclusive pair');
for (const leg of R.L6 || []) {
  if (leg.found && !leg.reachable_on_foot) findings.push(`L6 ${leg.who}: unreachable on foot from all four approaches — best ${leg.best_stopped_short_m} m short`);
}
R.findings = findings;
writeJson(OUT, R);
fs.mkdirSync(path.dirname(OUT), { recursive: true });
console.log(`critic-w1-20-ledgers: ${findings.length} finding(s); wrote ${OUT}`);
for (const f of findings) console.log(`  FINDING: ${f}`);
process.exit(findings.length ? 1 : 0);
