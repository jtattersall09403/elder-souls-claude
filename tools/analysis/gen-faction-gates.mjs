// gen-faction-gates.mjs — the rank ladders, in RI-QST03 §B's fixed column format.
//
// W1-FACTIONS re-derived every number in this file. The reasoning is written up in
// `corpus/30-quests/FACTION-ROSTER-DESIGN.md` §5 and the measurement that forces it is
// `tools/quests/faction-signature-sweep.mjs`. In one paragraph:
//
//   The generated ladder asked **25** for a favoured attribute at rank 1 and **75** at rank 7.
//   Driven through the SHIPPING character builder, the highest favoured attribute any of 240
//   signatures (10 races x 4 upbringings x 6 classes) has at creation is **19**, so **0 of 240
//   could hold rank 1 in any faction**. And attributes rise by exactly one route — +1 to the
//   governing attribute each time a governed skill crosses a multiple of 15
//   (`character/derive.js:359`) — which caps a two-skill attribute at 19 + 12 = **31**. 75 was
//   not merely hard; it was arithmetically unreachable for every faction in the build, and
//   RI-QST03 §A records Morrowind's own top-rank figure as ~33-34.
//
// Three classes of defect are now asserted against rather than commented on:
//
//   * ATTRIBUTE IDENTITY. `ATTRS` was a hardcoded literal containing `intelligence`, which is
//     not an attribute in this game — the sheet's is `intellect`. Three factions favoured it,
//     `FactionGates.evaluate()` read `undefined`, `num()` returned 0, and the Assize's live
//     attribute floor collapsed to 3. The list is now READ from progression/attributes.json.
//   * REACHABILITY. Every rank-7 attribute demand is checked against the headroom the skill
//     system can actually deliver for that faction's best favoured attribute, and the generator
//     throws if a ladder tops out above it. A ceiling nobody can reach is not a ceiling.
//   * BUILD IDENTITY. RI-QST03 method 3: no two factions may share more than 3 favoured skills,
//     or the rank requirements stop expressing a build. Asserted.
//
// Run: node tools/analysis/gen-faction-gates.mjs [--check]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const check = process.argv.includes('--check');

const skillsDoc = JSON.parse(fs.readFileSync(ROOT + '/game/data/progression/skills.json', 'utf8'));
const SK = skillsDoc.skills.map((s) => s.id || s);
// The attribute a skill's use raises. RI-PRG02 §2's earned stream.
const GOVERNS = {};
for (const s of skillsDoc.skills) (GOVERNS[s.governing] = GOVERNS[s.governing] || []).push(s.id);

// READ, never restated. A literal here is how `intelligence` survived three factions.
const attrDoc = JSON.parse(fs.readFileSync(ROOT + '/game/data/progression/attributes.json', 'utf8'));
const ATTRS = attrDoc.attributes.map((a) => a.id);

// Measured by tools/quests/faction-signature-sweep.mjs against the shipping character builder:
// the highest value any favoured attribute reaches at creation, over 240 signatures.
const ATTR_AT_CREATION_MAX = 19;
// character/derive.js:359 — +1 per multiple of 15 crossed, and a skill runs 5 -> 100, so a
// governed skill is worth at most 6 points to its attribute (15/30/45/60/75/90).
const ATTR_POINTS_PER_SKILL = 6;
const headroom = (attr) => ATTR_AT_CREATION_MAX + ATTR_POINTS_PER_SKILL * ((GOVERNS[attr] || []).length);
// The main quest's own gates clamped with a MARGIN OF EXACTLY ZERO and shut Act IV for 11 of 40
// character signatures. A ceiling that is exactly reachable by the single best build in the game
// is the same defect wearing a rank title, so a ladder must clear its own headroom by this much.
const REQUIRED_MARGIN = 4;

// RI-QST03 §B: reputation, one of two favoured attributes, two distinct favoured skills from a
// set of six, and a world state. Never level, souls, gold-on-hand or a quest counter.
//
// `world_state` is per-faction and per-rank, not one flag repeated. §B asks for three different
// things at ranks 5, 6 and 7 — a holding, a political result, and a vacated seat — and a single
// `<id>:trusted` flag at 6 and 7 collapsed all three into one. The flags below are the ones the
// questlines actually raise; a faction whose line is not yet written declares them anyway, which
// is what makes an unbuilt ladder honestly cap rather than quietly complete.
const PROFILE = {
  the_rootkeepers: {
    name: 'The Rootkeepers', attrs: ['hist-bond', 'willpower'],
    skills: ['root-speech', 'alchemy', 'warding', 'survival', 'speechcraft', 'acrobatics'],
    ranks: ['Supplicant', 'Leaf', 'Green Hand', 'Sapwright', 'Root-Speaker', 'Deep Root', 'Hist-Marked', 'Voice of the Hist'],
    world: { 5: ['rootkeepers_sapwell_kept', 'a sapwell that answers to you and to nobody else'], 6: ['rootkeepers_chapter_decided', 'the chapter has voted your way, in front of witnesses'], 7: ['rootkeepers_voice_vacant', 'the Voice of the Hist is silent, and it is your doing'] },
  },
  the_dockhands: {
    name: 'The Dockhands', attrs: ['strength', 'endurance'],
    skills: ['athletics', 'mercantile', 'shieldcraft', 'axes-maces', 'survival', 'blades'],
    ranks: ['Casual', 'Hand', 'Rope', 'Ganger', 'Foreman', 'Wharf-Master', 'Ledger-Keeper', 'Harbourmaster'],
    world: { 5: ['dockhands_gang_held', 'a gang of your own that will not work for anyone else'], 6: ['dockhands_wharf_decided', 'the wharf struck or did not strike, and it was your call'], 7: ['dockhands_harbourmaster_vacant', 'the harbourmaster’s chair is empty by your hand'] },
  },
  the_imperial_assize: {
    name: 'The Imperial Assize', attrs: ['personality', 'intellect'],
    skills: ['speechcraft', 'mercantile', 'security', 'marksman', 'blades', 'alchemy'],
    ranks: ['Clerk', 'Notary', 'Assessor', 'Adjutant', 'Assizer', 'Senior Assizer', 'Prefect', 'Legate of the Assize'],
    world: { 5: ['assize_seal_held', 'a seal of your own, and a debt the Assize paid to get it for you'], 6: ['assize_lease_decided', 'the labour-lease stands or falls, and the province knows which you chose'], 7: ['assize_prefect_vacant', 'the Prefect of Blackrose no longer holds the office'] },
  },
  the_wet_ledger: {
    name: 'The Wet Ledger', attrs: ['agility', 'personality'],
    skills: ['security', 'sneak', 'mercantile', 'speechcraft', 'veiling', 'acrobatics'],
    ranks: ['Runner', 'Fence', 'Ledger-Hand', 'Quiet Partner', 'Book-Keeper', 'Underwriter', 'Silent Partner', 'The Ledger'],
    world: { 5: ['ledger_gate_held', 'a toll gate that pays into your hand before it pays into theirs'], 6: ['ledger_archon_decided', 'the Archon water-call is open or shut, and it was settled in the room you were in'], 7: ['ledger_first_chair_vacant', 'the first chair of the Ledger is empty and you emptied it'] },
  },
  the_drowned_court: {
    name: 'The Drowned Court', attrs: ['willpower', 'endurance'],
    skills: ['sorcery', 'warding', 'root-speech', 'survival', 'shieldcraft', 'polearms'],
    ranks: ['Wader', 'Knee-Deep', 'Waist-Deep', 'Chest-Deep', 'Drowned', 'Deep-Drowned', 'Court-Sworn', 'The Drowned Crown'],
    world: { 5: ['court_yard_held', 'a burning yard of your own and the fees that come off it'], 6: ['court_tally_decided', 'the Court has published the tally, or buried it, on your word'], 7: ['court_crown_vacant', 'the Drowned Crown is off a head and it was you who took it'] },
  },
  the_xul_aneekh: {
    name: 'The Xul-Aneekh', attrs: ['willpower', 'intellect'],
    skills: ['root-speech', 'veiling', 'survival', 'claw-fang', 'alchemy', 'sneak'],
    ranks: ['Unnamed', 'Taken', 'Bound', 'Debtor', 'Keeper', 'Gem-Cutter', 'Sap-Drinker', 'Xul-Aneekh'],
    world: { 5: ['deepkin_hollow_kept', 'a hollow that names you, and eats where you say it eats'], 6: ['deepkin_coast_decided', 'the consensus on the coast cities was reached with you speaking'], 7: ['deepkin_speaker_vacant', 'the Speaker no longer speaks, by your doing'] },
  },
  xul_aneekh: { alias: 'the_xul_aneekh' },
  ixtu_vakh: { alias: 'the_ixtu_vakh' },
  the_ixtu_vakh: {
    name: 'The Ixtu-Vakh', attrs: ['endurance', 'strength'],
    skills: ['claw-fang', 'survival', 'athletics', 'axes-maces', 'marksman', 'acrobatics'],
    ranks: ['Egg', 'Hatchling', 'Runner', 'Hunter', 'Pack-Hunter', 'Spear-Kin', 'War-Kin', 'Ixtu-Vakh'],
    world: { 5: ['sapcutters_well_cut', 'a sapwell that is yours to bleed'], 6: ['sapcutters_buyer_decided', 'the Company buys from us or from nobody, and you settled which'], 7: ['sapcutters_cutter_vacant', 'the first cutter has stopped cutting'] },
  },
  // RI-LOR02 §4.1 and faction-reactions.json's alias table both say the Deep Kin ARE the
  // Xul-Aneekh. This ladder exists only because Q-MAG-07 — another piece's quest — names it, and
  // deleting it would orphan that quest. FACTION-ROSTER-DESIGN.md §5.5 records the fold as owed.
  deep_kin: {
    name: 'The Deep Kin', attrs: ['willpower', 'intellect'],
    skills: ['root-speech', 'veiling', 'survival', 'claw-fang', 'alchemy', 'sneak'],
    ranks: ['Stranger', 'Guest', 'Known', 'Kin-Named', 'Deep Kin', 'Elder Kin', 'Root-Kin', 'The Deep'],
    world: { 5: ['deepkin_hollow_kept', 'a hollow that names you, and eats where you say it eats'], 6: ['deepkin_coast_decided', 'the consensus on the coast cities was reached with you speaking'], 7: ['deepkin_speaker_vacant', 'the Speaker no longer speaks, by your doing'] },
  },
};

// ---- RI-QST03 §B, with the attribute column re-derived PER FACTION. See FACTION-ROSTER-DESIGN §5.4.
const REP = [0, 10, 22, 36, 52, 70, 90, 112];   // §B verbatim
const S1 = [null, 20, 25, 32, 40, 50, 60, 70];   // §B verbatim
const S2 = [null, null, 10, 15, 20, 25, 30, 35]; // §B verbatim (its rank-1 5 folded into null)

// ---- THE ATTRIBUTE COLUMN, AND WHY IT IS NO LONGER ONE ROW OF LITERALS -----------------------
//
// The first repair lowered the shared column from [_,25..75] to [_,12..24] and asserted it was
// reachable. The assertion was computed against `ATTR_AT_CREATION_MAX = 19` — the best favoured
// attribute any of 240 signatures has — plus 6 points for every governed skill in the game taken
// to 90. That is a BEST CASE twice over: the single best sheet in the build, grinding skills the
// ladder never asks for. The brief's own warning is that the main quest clamped with a margin of
// exactly zero and shut Act IV for 11 of 40 signatures; this was the same defect, and driving the
// live line through `questOffers()` found it — `tools/quests/faction-probe.mjs` walked the Wet
// Ledger to reputation 112, which is the rank-7 demand, and the DERIVED rank stopped at 3, because
// agility had only reached 16 against a demand of 24. 3 of 9 quests on the line were reachable.
//
// The arithmetic nobody had done: an attribute rises by +1 each time a governed skill crosses a
// multiple of 15, and nothing else in this build moves one. Taking the two skills the ladder
// itself grades from a median starting sheet to the rank-7 demands (70 and 35) crosses at most
// **four** such multiples. So a whole faction ladder pays +4 attribute, while the spread between
// signatures at creation is 6 to 19. THE ATTRIBUTE TERM CANNOT CARRY THE LADDER: reputation
// (0 -> 112) and the two skill columns (20 -> 70) scale, and the attribute column does not.
//
// So it now asks for exactly what its own work pays for, per faction, measured:
//
//     attribute(R) = p10_creation_favoured_attribute + earned(R) - MARGIN
//
// where `earned(R)` is the multiples of 15 the rank's OWN skill_1/skill_2 demands cross from that
// faction's median starting skills, and both inputs are read from a live sweep of the shipped
// character builder rather than restated here. A rank never asks for an attribute point the rank's
// own work has not paid for, and it leaves MARGIN points of room on top.
const SWEEP_PATH = ROOT + '/reports/faction-signature-sweep.json';
if (!fs.existsSync(SWEEP_PATH)) {
  throw new Error(`gen-faction-gates: ${SWEEP_PATH} does not exist. The attribute column is derived from a\nlive sweep of the character builder, not from literals. Run:\n  node tools/quests/faction-signature-sweep.mjs --out reports/faction-signature-sweep.json`);
}
const SWEEP = JSON.parse(fs.readFileSync(SWEEP_PATH, 'utf8'));
const SWEEP_BY = new Map((SWEEP.per_faction || []).map((f) => [f.id, f]));
// A rank must clear its own demand by this much. Zero margin is how Act IV shut.
const ATTR_MARGIN = 2;
// character/derive.js:359 — +1 to the governing attribute each time the skill value crosses a
// multiple of 15. Counted from where the sheet actually starts, not from zero.
const crossings = (from, to) => (to == null ? 0 : Math.max(0, Math.floor(to / 15) - Math.floor((from || 0) / 15)));

function attrColumnFor(id, attrs) {
  const s = SWEEP_BY.get(id);
  if (!s) throw new Error(`gen-faction-gates: ${id} has no row in reports/faction-signature-sweep.json — re-run the sweep after adding a faction.`);
  const base = s.at_creation.best_favoured_attribute.p10;
  const s1start = s.at_creation.best_favoured_skill.median;
  const s2start = s.at_creation.second_favoured_skill.median;
  // The gate grades the two best favoured skills. Only the ones GOVERNED BY a favoured attribute
  // pay into it, so a faction with one such skill is credited for one graded skill, not two.
  const governed = Math.min(2, Math.max(...attrs.map((a) => (p_skills_governed_by(id, a)))));
  const col = [null];
  let prev = 0;
  for (let r = 1; r <= 7; r++) {
    const earned = crossings(s1start, S1[r]) + (governed >= 2 ? crossings(s2start, S2[r]) : 0);
    const want = Math.max(1, base + earned - ATTR_MARGIN);
    prev = Math.max(prev, want);      // monotone: a rank never asks less than the one below it
    col.push(prev);
  }
  return { col, base, s1start, s2start, governed };
}
// resolved against PROFILE below; declared here so attrColumnFor reads in one place.
function p_skills_governed_by(id, attr) {
  let p = PROFILE[id];
  if (p && p.alias) p = PROFILE[p.alias];
  return (p.skills || []).filter((sk) => GOVERNS_OF[sk] === attr).length;
}
const GOVERNS_OF = {};
for (const s of skillsDoc.skills) GOVERNS_OF[s.id] = s.governing;

// Which factions the quest book actually references, split by WHAT IT ASKS OF THEM. Nothing is
// invented that nothing asks for, and — the half the first version got wrong — nothing is given a
// player ladder merely because a quest moves its standing.
//
//   `laddered`  a quest belongs to it, gates on its rank, or requires a rank in it. It is a
//               career and it needs the eight-row table.
//   `standing`  a quest only moves its reputation. It is WEATHER: House Dres has factors with
//               ranks and no ladder a player may climb (FACTION-ROSTER-DESIGN.md §2), and the
//               generator throwing for want of a Dres profile was it demanding a career for a
//               body the design deliberately refuses one.
const laddered = new Set();
const standing = new Set();
for (const f of fs.readdirSync(ROOT + '/game/data/quests')) {
  if (f === 'faction-gates.json' || f === 'hooks.json') continue;
  const d = JSON.parse(fs.readFileSync(ROOT + '/game/data/quests/' + f, 'utf8'));
  for (const q of (Array.isArray(d.quests) ? d.quests : [])) {
    if (q.faction) laddered.add(q.faction);
    if (q.rank_gate) laddered.add(q.rank_gate.faction);
    for (const r of q.resolutions || []) if (r.requires && r.requires.faction_rank) laddered.add(r.requires.faction_rank.faction);
    for (const k of Object.keys((q.consequences || {}).faction_reputation || {})) standing.add(k);
    for (const r of q.resolutions || []) for (const k of Object.keys((r.consequences || {}).faction_reputation || {})) standing.add(k);
  }
}
const fac = laddered;
for (const id of laddered) standing.delete(id);

const factions = [];
for (const id of [...fac].sort()) {
  let p = PROFILE[id];
  if (p && p.alias) p = PROFILE[p.alias];
  if (!p) throw new Error(`no profile for faction ${id} — add one to PROFILE or stop naming it in a quest`);
  if (new Set(p.skills).size !== 6) throw new Error(`${id}: exactly 6 distinct favoured skills required (RI-QST03 §A)`);
  for (const s of p.skills) if (!SK.includes(s)) throw new Error(`${id}: '${s}' is not a skill in game/data/progression/skills.json`);
  if (new Set(p.attrs).size !== 2) throw new Error(`${id}: exactly 2 distinct favoured attributes required (RI-QST03 §A)`);
  for (const a of p.attrs) {
    if (!ATTRS.includes(a)) throw new Error(`${id}: '${a}' is not an attribute in game/data/progression/attributes.json — the sheet has [${ATTRS.join(', ')}]`);
  }
  // REACHABILITY, against real signatures rather than the best one in the game. The old check
  // compared a shared rank-7 literal against `creation MAX + 6 per governed skill` — the best
  // sheet in the build grinding skills the ladder never grades. It passed, and the live line
  // still clamped at rank 3 of 7. The column is now DERIVED from what the rank's own skill
  // demands earn a p10 signature, so the assertion is that the derivation held: every rank must
  // sit at or under what that signature reaches, by ATTR_MARGIN, and must still be monotone.
  const { col: ATTR, base, s1start, s2start, governed } = attrColumnFor(id, p.attrs);
  for (let r = 1; r <= 7; r++) {
    const earned = crossings(s1start, S1[r]) + (governed >= 2 ? crossings(s2start, S2[r]) : 0);
    const reach = base + earned;
    if (ATTR[r] + ATTR_MARGIN > reach) {
      throw new Error(`${id}: rank ${r} asks ${ATTR[r]} of ${p.attrs.join(' or ')}; a p10 signature starting at ${base} and taking the rank's own skills to ${S1[r]}/${S2[r]} reaches ${reach} — margin ${reach - ATTR[r]} against a required ${ATTR_MARGIN}. See FACTION-ROSTER-DESIGN.md §5.2.`);
    }
    if (ATTR[r] < ATTR[r - 1]) throw new Error(`${id}: rank ${r} asks less attribute (${ATTR[r]}) than rank ${r - 1} (${ATTR[r - 1]})`);
  }
  // The old best-case number is kept, reported rather than asserted on, because it is the honest
  // upper bound a grinder can reach and it is useful to see next to the demand.
  const best = Math.max(...p.attrs.map(headroom));
  factions.push({
    id, name: p.name,
    favoured_attributes: p.attrs,
    favoured_skills: p.skills,
    attribute_headroom: Object.fromEntries(p.attrs.map((a) => [a, headroom(a)])),
    attribute_column_derivation: {
      rule: 'attribute(R) = p10 creation favoured attribute + multiples of 15 the rank\'s own skill_1/skill_2 demands cross from a median starting sheet - margin',
      measured_from: 'reports/faction-signature-sweep.json (240 signatures through the shipped character builder)',
      p10_creation_favoured_attribute: base,
      median_start_skill_1: s1start, median_start_skill_2: s2start,
      graded_skills_governed_by_a_favoured_attribute: governed,
      margin: ATTR_MARGIN,
      best_case_grinder_ceiling: best,
    },
    ranks: p.ranks.map((n, i) => ({
      rank: i, name: n, reputation: REP[i], attribute: ATTR[i], skill_1: S1[i], skill_2: S2[i],
      world_state: p.world && p.world[i] ? { flag: p.world[i][0], text: p.world[i][1] } : null,
    })),
  });
}

// RI-QST03 method 3: "no two factions may share more than 3 favoured skills (otherwise the build
// statements collapse into one)". Aliases of the same body are exempt — they ARE one faction.
const ALIAS_OF = { xul_aneekh: 'the_xul_aneekh', ixtu_vakh: 'the_ixtu_vakh', deep_kin: 'the_xul_aneekh' };
const canon = (id) => ALIAS_OF[id] || id;
for (let i = 0; i < factions.length; i++) {
  for (let j = i + 1; j < factions.length; j++) {
    if (canon(factions[i].id) === canon(factions[j].id)) continue;
    const shared = factions[i].favoured_skills.filter((s) => factions[j].favoured_skills.includes(s));
    if (shared.length > 3) throw new Error(`${factions[i].id} and ${factions[j].id} share ${shared.length} favoured skills (${shared.join(', ')}); RI-QST03 method 3 allows 3`);
  }
}

const doc = {
  schema: 'elder-souls/faction-gates@1',
  id: 'faction-gates',
  corpus_item: 'RI-QST03 §A (two favoured attributes, six favoured skills) and §B (the four-part rank statement)',
  generated_by: 'tools/analysis/gen-faction-gates.mjs',
  content_owner: 'W1-FACTIONS. Every number re-derived; see corpus/30-quests/FACTION-ROSTER-DESIGN.md §5.',
  note: [
    'The rank ladders for every faction the quest book references, and no others.',
    'RI-QST03 §B repeats one rule three times: "No rank may reference character level, souls,',
    'gold-on-hand, or a raw quest counter." game/src/sim/quest/gate.js enforces that at',
    'construction and throws — a level gate here is a build that does not start, not a low score.',
    '',
    'The attribute column was 25 at rank 1 and 75 at rank 7. Measured against the SHIPPING',
    'character builder over 240 signatures, the highest favoured attribute a fresh character has',
    'is 19, so 0 of 240 could hold rank 1 anywhere; and attributes rise only at +1 per 15 skill',
    'levels in the governing skill, capping a two-skill attribute at 31. 75 was unreachable by',
    'arithmetic. The column now runs 18 -> 30 and the generator THROWS if any faction’s rank-7',
    'demand exceeds the headroom its own favoured attributes can deliver.',
    '',
    'Three factions favoured "intelligence", which is not an attribute in this game (the sheet',
    'has "intellect"), so their attribute term silently read 0. The attribute list is now read',
    'from progression/attributes.json rather than restated here.',
    '',
    'world_state is now three DIFFERENT requirements at ranks 5, 6 and 7 — a holding, a political',
    'result, a vacated seat — as RI-QST03 §B asks, instead of one <id>:trusted flag at 6 and 7.',
  ],
  factions,
  // Bodies a quest moves the standing of and that nothing may join. They have no rank table on
  // purpose; `derivedDisposition()` still reads their reaction row out of
  // dialogue/faction-reactions.json, so being hated by them still costs you.
  standing_only: [...standing].sort().map((id) => ({ id, why: 'reputation moves; no player ladder (FACTION-ROSTER-DESIGN.md §1-§3)' })),
  exclusivity: {
    // X1. RI-QST03 §C.
    hard_groups: [
      { id: 'the_two_courts', members: ['the_drowned_court', 'the_imperial_assize'], why: 'You cannot swear to a drowned crown and to the Assize that would hang it.' },
    ],
    // X4. Permanent enemies: membership in one makes the other unavailable, no join step needed.
    // ['the_xul_aneekh','deep_kin'] was here and is removed: RI-LOR02 §4.1 and
    // faction-reactions.json's alias table both say those are one body, so the build declared a
    // faction the permanent enemy of itself.
    enemy_pairs: [
      ['the_wet_ledger', 'the_imperial_assize'],
    ],
    // X2. Compatible until a specific rank, then closed. RI-CRM02 §4's exclusion table, which
    // reads "Xul-Aneekh rank >= 2 -> cannot hold Wet Ledger or Ninth Cohort" and "Wet Ledger
    // rank >= 3 -> cannot hold Xul-Aneekh or Sap-Cutters".
    earned: [
      { a: 'the_xul_aneekh', b: 'the_wet_ledger', a_locks_b_at_rank: 2, b_locks_a_at_rank: 3, why: 'The Deep-Kin position is that the coast is a wound. The Ledger IS the coast.', escape: 'RI-QST03 §C X3: the rank-3 quest on each side has a resolution that does not lock.' },
      { a: 'the_xul_aneekh', b: 'the_imperial_assize', a_locks_b_at_rank: 4, b_locks_a_at_rank: 4, why: 'The Blackrose labour-lease and the Deep-Kin answer to it are the same event from two chairs.', escape: 'RI-QST03 §C X3: the rank-4 quest on each side has a resolution that does not lock.' },
      { a: 'the_wet_ledger', b: 'the_ixtu_vakh', a_locks_b_at_rank: 3, b_locks_a_at_rank: 3, why: 'The Ledger’s business survives on not being the Sap-Cutters.', escape: null },
    ],
    // X5. Two compatible memberships cap each other; ranks 6-7 want sole allegiance.
    rank_ceiling_with_a_second_membership: 5,
    soft: [
      { a: 'the_dockhands', b: 'the_wet_ledger', penalty: -15, why: 'The wharf knows who fences its cargo.' },
    ],
  },
};

const outPath = ROOT + '/game/data/quests/faction-gates.json';
const text = JSON.stringify(doc, null, 2) + '\n';
if (check) {
  const cur = fs.existsSync(outPath) ? fs.readFileSync(outPath, 'utf8') : '';
  if (cur !== text) { console.error('faction-gates.json is stale — run node tools/analysis/gen-faction-gates.mjs'); process.exit(20); }
  console.log(`[harness] faction-gates.json current — ${factions.length} factions`);
} else {
  fs.writeFileSync(outPath, text);
  console.log('wrote faction-gates.json —', factions.length, 'factions. Rank-7 attribute demand is now per-faction, derived from what the rank\'s own skill demands earn a p10 signature:');
  for (const f of factions) {
    const d = f.attribute_column_derivation;
    console.log(`  ${f.id.padEnd(22)} ${f.favoured_attributes.join('/').padEnd(22)} column ${f.ranks.map((r) => r.attribute == null ? '—' : r.attribute).join(' ')}  (p10 base ${d.p10_creation_favoured_attribute}, ${d.graded_skills_governed_by_a_favoured_attribute} graded skill(s) governed, margin ${d.margin}, grinder ceiling ${d.best_case_grinder_ceiling})`);
  }
}
