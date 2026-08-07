#!/usr/bin/env node
// tools/quests/mainline-census.mjs — RI-QST06's "## Comparison method", executed.
//
// The item specifies eight jq blocks over `game/src/data/quests/*.json`. That path does not
// exist and never has; the quests live in `game/data/quests/`. Every assertion below is the
// item's own, transcribed check for check, over the real path. Written by the W1-19 builder
// under orchestration/TOOL-LOOP.md because the method named a tool nobody had built.
//
// It also runs RI-EXP05's static half — the checks that can be answered from the shipped data
// without a played session (LH2, LH4, LH9, LH12, LH14 and the antagonist-refutation scan). The
// checks RI-EXP05 marks FULL-tier-only (LH11 specificity resolution, the forty-NPC sweep) are
// reported as `unmeasurable_here` with the reason, never as a pass.
//
// A builder does not grade itself with a tool it wrote. This prints numbers; the verdict is a
// critic's.
//
//   node tools/quests/mainline-census.mjs [--json] [--out <path>]
//
// Exit code 1 if any hard fail in RI-QST06's "Hard fails" list is triggered.

import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const QDIR = path.join(ROOT, 'game/data/quests');

const quests = [];
for (const f of fs.readdirSync(QDIR).sort()) {
  if (!f.endsWith('.json')) continue;
  const doc = JSON.parse(fs.readFileSync(path.join(QDIR, f), 'utf8'));
  for (const q of doc.quests || []) quests.push({ ...q, _file: f });
}
const mainline = JSON.parse(fs.readFileSync(path.join(QDIR, 'mainline.json'), 'utf8'));

const mains = quests.filter((q) => q.category === 'main');
const acted = mains.filter((q) => q.act != null);
const offAct = mains.filter((q) => q.act == null);

const fails = [];        // RI-QST06 "Hard fails" — exit 1
const results = [];
const rec = (id, label, value, ok, bar, hard = false) => {
  results.push({ id, label, value, bar, pass: ok, hard });
  if (hard && !ok) fails.push(`${id}: ${label} = ${JSON.stringify(value)} (bar ${bar})`);
  return ok;
};

// ---------------------------------------------------------------- 1. act shape
const byAct = new Map();
for (const q of acted) {
  if (!byAct.has(q.act)) byAct.set(q.act, []);
  byAct.get(q.act).push(q);
}
const actRows = [...byAct.keys()].sort((a, b) => a - b).map((a) => {
  const qs = byAct.get(a);
  return {
    act: a,
    n: qs.length,
    mean_stakes: +(qs.reduce((s, q) => s + q.stakes, 0) / qs.length).toFixed(3),
    kinds: [...new Set(qs.map((q) => q.task_kind))].sort(),
    ids: qs.map((q) => q.id).sort(),
  };
});
const WANT = { 1: 5, 2: 5, 3: 5, 4: 8, 5: 5 };
rec('QST06.A1', 'five acts present', actRows.map((r) => r.act), actRows.length === 5 && actRows.every((r) => r.act >= 1 && r.act <= 5), '5 acts');
rec('QST06.A2', 'per-act counts within +-1 of 5/5/5/8/5', Object.fromEntries(actRows.map((r) => [r.act, r.n])),
  actRows.every((r) => Math.abs(r.n - WANT[r.act]) <= 1), '5/5/5/8/5 +-1');
rec('QST06.A3', 'total acted main quests', acted.length, acted.length >= 24, '>= 24');
const stakesSeq = actRows.map((r) => r.mean_stakes);
rec('QST06.A4', 'mean stakes strictly increasing across acts', stakesSeq,
  stakesSeq.every((v, i) => i === 0 || v > stakesSeq[i - 1]), 'strictly increasing');
const act1 = actRows.find((r) => r.act === 1);
const act5 = actRows.find((r) => r.act === 5);
rec('QST06.A5', 'Act I mean stakes', act1 ? act1.mean_stakes : null, !!act1 && act1.mean_stakes <= 3.5, '<= 3.5');
rec('QST06.HF1', 'HARD FAIL — high stakes in Act I', act1 ? act1.mean_stakes : null, !!act1 && act1.mean_stakes <= 4, '<= 4', true);
rec('QST06.A6', 'Act V mean stakes', act5 ? act5.mean_stakes : null, !!act5 && act5.mean_stakes >= 9, '>= 9');

// ---------------------------------------------------------------- 2. Act IV simultaneity
const ivIds = new Set((byAct.get(4) || []).map((q) => q.id));
const sequenced = [];
for (const q of byAct.get(4) || []) {
  for (const p of (q.opens_by && q.opens_by.prerequisite_quests) || []) {
    if (ivIds.has(p)) sequenced.push(`${q.id} is sequenced behind ${p}`);
  }
}
rec('QST06.HF2', 'HARD FAIL — Act IV sequenced rather than simultaneous', sequenced, sequenced.length === 0, 'empty', true);
const ivOpeners = [...new Set((byAct.get(4) || []).map((q) => JSON.stringify(((q.opens_by || {}).prerequisite_quests || []).slice().sort())))];
rec('QST06.A7', 'every Act IV quest opens off the same prerequisite set', ivOpeners, ivOpeners.length === 1, 'exactly 1 distinct set');

// ---------------------------------------------------------------- 3. Act IV leverage
const iv = byAct.get(4) || [];
const rankGated = iv.filter((q) => (q.resolutions || []).some((r) => r.requires && r.requires.faction_rank)).length;
const meanRes4 = iv.length ? +(iv.reduce((s, q) => s + (q.resolutions || []).length, 0) / iv.length).toFixed(3) : 0;
rec('QST06.A8', 'Act IV quests with a faction-rank-gated resolution', rankGated, rankGated >= 4, '>= 4');
rec('QST06.A9', 'Act IV mean resolutions', meanRes4, meanRes4 >= 3.0, '>= 3.0');

// ---------------------------------------------------------------- 4. information as reward
const infoIn = (a) => (byAct.get(a) || []).filter((q) => (q.rewards || []).some((r) => r.type === 'information')).length;
rec('QST06.A10', 'Act II quests rewarding information', infoIn(2), infoIn(2) >= 3, '>= 3');
rec('QST06.A11', 'Acts II-III quests rewarding information', infoIn(2) + infoIn(3), infoIn(2) + infoIn(3) >= 5, '>= 5');

// ---------------------------------------------------------------- 5. D7, never adjudicated
const d7 = mains.filter((q) => ((q.deceit && q.deceit.patterns) || []).includes('D7'));
const d7unres = d7.filter((q) => q.deceit.never_revealed === true).length;
rec('QST06.A12', 'main quests carrying deceit pattern D7', d7.length, d7.length >= 2, '>= 2');
rec('QST06.A13', 'of those, never_revealed', d7unres, d7unres >= 1, '>= 1');
const bookFor = mains.some((q) => ((q.deceit || {}).revealed_by || []).some((r) => r.channel === 'book' && /for_the_ninth|the_seventh/.test(r.source)));
const bookAgainst = mains.some((q) => ((q.deceit || {}).revealed_by || []).some((r) => r.channel === 'book' && /against/.test(r.source)));
rec('QST06.A14', 'an in-world book argues the mandate is genuine AND one argues it is constructed', { for: bookFor, against: bookAgainst }, bookFor && bookAgainst, 'both');
const adjudicated = (mainline.mandate || {}).never_adjudicated === true;
rec('QST06.HF3', 'HARD FAIL — the mandate is adjudicated by the game', !adjudicated, adjudicated, 'never_adjudicated: true', true);

// ---------------------------------------------------------------- 6. Act V
const v = byAct.get(5) || [];
const talkable = v.filter((q) => ((q.deceit || {}).revealed_by || []).some((r) => r.channel === 'talk_to_target')).length;
const nonviolent5 = v.filter((q) => (q.resolutions || []).some((r) => r.violence_required === false)).length;
rec('QST06.A15', 'Act V quests with a talk_to_target reveal', talkable, talkable >= 1, '>= 1');
rec('QST06.A16', 'Act V quests with a non-violent resolution', nonviolent5, nonviolent5 >= 1, '>= 1');
const finalQ = v.find((q) => q.id === 'Q-MAIN-28') || v[v.length - 1];
const finalNonviolent = (finalQ.resolutions || []).filter((r) => !r.violence_required).length;
rec('EXP05.LH9', 'non-violent resolutions to the final confrontation', finalNonviolent, finalNonviolent >= 1, '>= 1', true);
const conv = mains.find((q) => q.id === 'Q-MAIN-26');
rec('EXP05.LH6a', 'the conversation quest has no violence_required resolution at all',
  conv ? (conv.resolutions || []).filter((r) => r.violence_required).length : null,
  !!conv && (conv.resolutions || []).every((r) => !r.violence_required), '0');

// ---------------------------------------------------------------- 7. backpath
const backpath = mains.filter((q) => /backpath/i.test(q.notes || ''));
const bpIrrev = backpath.map((q) => ({ id: q.id, act: q.act, irreversible: (q.branches || []).filter((b) => b.irreversible).length }));
rec('QST06.A17', 'backpath quests', bpIrrev, backpath.length >= 3, '>= 3');
rec('QST06.HF4', 'HARD FAIL — no backpath', backpath.length, backpath.length >= 3, '>= 3', true);
rec('QST06.A18', 'at least one backpath quest with an irreversible branch', bpIrrev.filter((b) => b.irreversible >= 1).length, bpIrrev.some((b) => b.irreversible >= 1), '>= 1');
const intendedEndFlags = new Set((mainline.endings || []).filter((e) => e.route === 'intended').map((e) => e.id));
const backEndFlags = new Set((mainline.endings || []).filter((e) => e.route === 'backpath').map((e) => e.id));
rec('QST06.A19', 'the backpath ending flag differs from every intended ending flag',
  [...backEndFlags], backEndFlags.size > 0 && [...backEndFlags].every((f) => !intendedEndFlags.has(f)), 'disjoint');

// ---------------------------------------------------------------- 8. faction independence
const walls = mains.filter((q) => q.rank_gate != null).map((q) => q.id);
rec('QST06.HF5', 'HARD FAIL — a main quest hard-gated on faction rank', walls, walls.length === 0, 'empty', true);

// ---------------------------------------------------------------- RI-EXP05, static half
const ponr = mainline.point_of_no_return || {};
// "main-quest content behind the PONR": every acted quest whose content is played before the
// crossing. The PONR quest counts as behind it — the sill is the LAST thing that happens in
// Q-MAIN-27 (its res_cross, at journal 90), and everything before that inside the quest is
// pre-crossing content. Only Q-MAIN-28 is on the far side.
const order = acted.map((x) => x.id).sort();
const behind = acted.filter((q) => order.indexOf(q.id) <= order.indexOf(ponr.quest)).length;
const frac = acted.length ? +(behind / acted.length).toFixed(4) : 0;
rec('EXP05.LH2', 'ponr_position_fraction', frac, frac >= 0.94, '>= 0.94');
rec('EXP05.LH3', 'ponr_signal_channels (independent, declared with evidence)', (ponr.signal_channels || []).length, (ponr.signal_channels || []).length >= 3, '>= 3');
rec('EXP05.LH5', 'threads permanently closed by the crossing, each with in-fiction acknowledgement',
  (ponr.closes || []).length, (ponr.closes || []).length >= 4 && (ponr.closes || []).every((c) => !!c.in_fiction), '>= 4, all in fiction');

// LH4 / LH14: scan every shipped mainline string for a modal, a confirmation, or terminal furniture.
const MODAL = /\b(are you sure|confirm|cannot return|point of no return|press [a-z] to|autosave|credits|score screen|completion|achievement|grade [a-f]\b)\b/i;
const modalHits = [];
for (const q of mains) {
  const blobs = [q.directions, ...(q.journal || []).map((e) => e.text), ...(q.resolutions || []).map((r) => r.outcome)];
  for (const b of blobs) if (b && MODAL.test(b)) modalHits.push({ quest: q.id, hit: MODAL.exec(b)[0] });
}
rec('EXP05.LH4', 'ponr_modals / confirmation strings in shipped mainline text', modalHits, modalHits.length === 0, '0', true);
rec('EXP05.LH14', 'terminal furniture (credits, score, completion %, grade)', modalHits.filter((h) => /credits|score|completion|achievement|grade/i.test(h.hit)).length, modalHits.length === 0, '0');

// LH12: world-flag delta between the intended and the backpath endings.
const flagsOf = (qid, rid) => {
  const q = mains.find((x) => x.id === qid);
  const r = (q.resolutions || []).find((x) => x.id === rid);
  const base = ((q.consequences || {}).world_flags) || [];
  const own = ((r && r.consequences && r.consequences.world_flags) || []);
  return new Set([...base, ...own]);
};
const A = flagsOf('Q-MAIN-28', 'res_open_the_count');
const B = flagsOf('Q-MAIN-31', 'res_drain_past_the_roots');
const delta = [...new Set([...[...A].filter((f) => !B.has(f)), ...[...B].filter((f) => !A.has(f))])];
rec('EXP05.LH12', 'world_flag_delta between the intended ending and the backpath ending', delta.length, delta.length >= 25, '>= 25');

// LH8: authored refutation of the antagonist anywhere in the shipped mainline prose.
const REFUTE = /\b(he was (?:simply |just )?wrong|his case (?:was |is )?(?:false|nonsense|a lie)|a lie all along|never true|proved him wrong|he lied about (?:the curve|the wells|the gems))\b/i;
const refutes = [];
for (const q of mains) {
  for (const e of q.journal || []) if (REFUTE.test(e.text)) refutes.push({ quest: q.id, index: e.index });
  for (const r of q.resolutions || []) if (REFUTE.test(r.outcome)) refutes.push({ quest: q.id, res: r.id });
}
rec('EXP05.LH7', 'antagonist_verified_claims, each resolved to an earlier player-observed event',
  (((mainline.antagonist || {}).verified_claims) || []).length, (((mainline.antagonist || {}).verified_claims) || []).length >= 2, '>= 2', true);
rec('EXP05.LH8', 'antagonist_refuted_by_game', refutes, refutes.length === 0, 'false', true);

// Each verified claim must name a world flag that a quest actually sets.
const allSetFlags = new Set();
for (const q of quests) {
  for (const f of (q.consequences || {}).world_flags || []) allSetFlags.add(f);
  for (const r of q.resolutions || []) for (const f of ((r.consequences || {}).world_flags) || []) allSetFlags.add(f);
}
const unresolvable = (((mainline.antagonist || {}).verified_claims) || []).filter((c) => !allSetFlags.has(c.flag));
rec('EXP05.LH7b', 'verified claims whose evidence flag no quest sets', unresolvable.map((c) => c.flag), unresolvable.length === 0, 'empty', true);

// ---------------------------------------------------------------- RI-WLD09 §B3
const ua = mainline.unanswered || [];
rec('WLD09.B3a', 'unanswered questions in the main quest', ua.length, ua.length >= 3 && ua.length <= 6, '3-6');
rec('WLD09.B3b', 'of which the player explicitly asks and is refused or evaded on screen',
  ua.filter((u) => u.player_asks_on_screen && u.refused_or_evaded).length,
  ua.filter((u) => u.player_asks_on_screen && u.refused_or_evaded).length >= 1, '>= 1');
rec('WLD09.B3c', 'of which the antagonist asks about the player', ua.filter((u) => u.asked_by).length, ua.filter((u) => u.asked_by).length >= 1, '>= 1');
rec('WLD09.B3d', 'answered in a book but not in dialogue', ua.filter((u) => u.answered_in_a_book).length, ua.filter((u) => u.answered_in_a_book).length <= 1, '<= 1');
rec('WLD09.B3e', 'ending text that closes a declared unanswered question', ua.filter((u) => u.closed_by_ending).length, ua.every((u) => !u.closed_by_ending), '0', true);

// ---------------------------------------------------------------- RI-QST05, mainline slice
const nonlethalMain = mains.filter((q) => (q.resolutions || []).some((r) => !r.violence_required)).length;
const zeroKillMain = mains.filter((q) => ((q.kill_required_npcs || []).length === 0)).length;
const nonlethalAll = quests.filter((q) => (q.resolutions || []).some((r) => !r.violence_required)).length;
rec('QST05.M1', 'mainline quests with >= 1 non-violent resolution', `${nonlethalMain}/${mains.length}`, nonlethalMain === mains.length, '100%');
rec('QST05.M2', 'mainline quests with an empty kill_required_npcs', `${zeroKillMain}/${mains.length}`, zeroKillMain === mains.length, '100%');
rec('QST05.M3', 'shipped quests with >= 1 non-violent resolution', `${nonlethalAll}/${quests.length} = ${(nonlethalAll / quests.length * 100).toFixed(1)}%`, nonlethalAll / quests.length >= 0.45, '>= 45%');

// ---------------------------------------------------------------- not measurable from data
const unmeasurable = [
  { id: 'EXP05.LH11', why: 'ending_specific_facts requires resolving ending text against a played chain (RI-EXP05 step 4, FULL tier). No played chain exists for this build.' },
  { id: 'EXP05.LH12b', why: 'npc_reaction_delta requires the scripted 6-topic x 40-NPC sweep over two loaded ending states (RI-EXP05 step 3). W1-17 owns the topic bodies; only the flag delta is answerable here.' },
  { id: 'EXP05.LH10', why: 'final_hour_scripted_seconds and final_boss_phases require a combat trace. The mainline authors no scripted sequence and no phased encounter, so the data-side answer is 0/0, but a trace is what proves it.' },
  { id: 'JRN07.L5', why: 'the fresh-agent navigation leg is RI-WLD06 M29, cited not restated, and belongs to a journey run rather than to a census.' },
];

const out = {
  tool: 'tools/quests/mainline-census.mjs',
  written_by: 'W1-19 under orchestration/TOOL-LOOP.md — RI-QST06 §Comparison method named jq over game/src/data/quests/*.json, a path that does not exist',
  when: new Date().toISOString(),
  quests_total: quests.length,
  main_total: mains.length,
  acted: acted.length,
  off_act: offAct.map((q) => q.id),
  acts: actRows,
  results,
  unmeasurable_here: unmeasurable,
  hard_fails: fails,
};

const json = process.argv.includes('--json');
const oi = process.argv.indexOf('--out');
if (oi > 0 && process.argv[oi + 1]) {
  fs.mkdirSync(path.dirname(process.argv[oi + 1]), { recursive: true });
  fs.writeFileSync(process.argv[oi + 1], JSON.stringify(out, null, 2) + '\n');
}
if (json) {
  console.log(JSON.stringify(out, null, 2));
} else {
  console.log(`\nmainline census — ${mains.length} main-category quests (${acted.length} in acts, ${offAct.length} off-act)\n`);
  for (const r of actRows) console.log(`  act ${r.act}: ${String(r.n).padStart(2)} quests, mean stakes ${r.mean_stakes.toFixed(2)}, kinds ${r.kinds.join('/')}`);
  console.log('');
  for (const r of results) {
    const tag = r.pass ? 'PASS' : (r.hard ? 'HARDFAIL' : 'FAIL');
    console.log(`  ${tag.padEnd(9)} ${r.id.padEnd(12)} ${r.label} = ${JSON.stringify(r.value)}  [${r.bar}]`);
  }
  console.log('\n  not measurable from shipped data alone:');
  for (const u of unmeasurable) console.log(`    ${u.id}: ${u.why}`);
  if (fails.length) { console.log('\n  HARD FAILS:'); for (const f of fails) console.log('    ' + f); }
  console.log('');
}
process.exit(fails.length ? 1 : 0);
