#!/usr/bin/env node
/**
 * mine-quests.mjs — build corpus/30-quests/data/morrowind-quest-census.json
 *
 * Spine: the 489 pages in the extract that carry a {{Quest Header}} infobox
 * (Morrowind 396, Tribunal 38, Bloodmoon 54, Stormhold 1 — Stormhold dropped).
 *
 * What is community-data (UESP editors' transcription):
 *   title, questline, giver, reward text, disposition/reputation deltas, quest ID,
 *   prev/next chaining, required rank, suggested level, journal stage indices,
 *   and the walkthrough prose we classify over.
 *
 * What is DERIVED (ours, and must never be cited as measured):
 *   the kill-requirement classification and every fraction computed from it.
 *   The classifier is a lexical rule over UESP's own walkthrough prose, and UESP's
 *   walkthroughs are editorial summaries, not the game's script. A hand audit of a
 *   30-quest sample is recorded in the output so the error rate is visible.
 *
 * Run: node tools/uesp/mine-quests.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadExtract, findTemplate, findTemplates, sections, stripWiki, links } from './uesp-infobox.mjs';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const OUT = path.join(REPO, 'corpus', '30-quests', 'data', 'morrowind-quest-census.json');

/* ---------------- lexicons ---------------- */

// Kill demanded as a step. Deliberately excludes "defeat" alone (can mean a
// non-lethal duel) and "attack" (can be survived), and excludes "destroy" when
// its object is an object rather than a creature — handled below.
const KILL_RE = /\b(kill|kills|killing|slay|slaying|assassinate|assassinating|murder|exterminate|eliminate|dispatch|execute the writ|put (?:him|her|them|it) down|take (?:him|her|them|it|the \w+) down|take down the|deal with .{0,25}(?:permanently|for good))\b/i;
const KILL_STRICT_RE = /\b(kill|slay|assassinate|murder|exterminate)\b/i;

// UESP's own language for "you do not have to fight this"
const PACIFIST_RE = new RegExp([
  'without killing', 'without having to kill', 'without fighting', 'without combat',
  'do(?:es)? not (?:have to|need to) kill', "don't (?:have to|need to) kill",
  'need not kill', 'no need to kill', 'avoid killing', 'try (?:and |to )?(?:not|avoid)',
  'without bloodshed', 'peacefully', 'non-?violent',
  'you can (?:also )?(?:just )?(?:pickpocket|steal|persuade|bribe|sneak|talk)',
  'can be (?:pickpocketed|stolen|persuaded|bribed|talked)',
  'raise (?:his|her|their|the)? ?disposition',
  'disposition (?:above|over|of at least|to) ?\\d',
  'admit(?:ted)? (?:you|the player)? ?(?:in|without)',
  'if you (?:are|have) .{0,40}(?:you (?:will )?not (?:have to|need to) (?:fight|kill))',
  'alternatively,? you (?:can|may)',
  'is not required to (?:kill|fight)',
  'it is possible to (?:complete|finish|do) .{0,40}without',
].join('|'), 'i');

// The single most important pattern the first pass missed. UESP writes optional
// violence as a disjunction *inside the required-step list*:
//   "Convince him that he is not the Incarnate, or kill him."
//   "Find Anel in the shrine and kill him or rob him."
//   "Either: * Kill the slave-hunters. * Convince them to leave town."
//   "Evil Path is to keep the items or kill him."
// A hand audit of 30 base-game quests found 4–5 such quests mis-classed as
// kill_required by the first pass; this lexicon is the fix.
const ALT_IN_QUICK_RE = new RegExp([
  '\\bor (?:just )?(?:kill|slay|murder)\\b',
  '\\b(?:kill|slay|murder)[^.\\n]{0,60}\\bor\\b[^.\\n]{0,40}\\b(?:rob|steal|persuade|convince|talk|bribe|pickpocket|sneak|take|leave|spare|let|get|obtain|collect|pay|hand)\\b',
  '\\b(?:convince|persuade|talk|bribe|pay|steal|rob|pickpocket|sneak|cure|heal)[^.\\n]{0,60}\\bor\\b[^.\\n]{0,30}\\b(?:kill|slay|murder)\\b',
  '\\beither\\b[^.\\n]{0,20}:',
  '\\beither\\b[^.\\n]{0,30}\\b(?:kill|slay|murder)\\b',
  '\\bevil path\\b',
  '\\(optional\\)[^.\\n]{0,30}\\b(?:kill|slay|murder)\\b(?!ing|ed)',
  '\\bif you (?:choose|want|prefer) to (?:kill|fight)',
].join('|'), 'i');

// Steps that are inherently non-combat
const SOFT_VERBS = /\b(talk to|speak (?:to|with)|report to|ask|deliver|bring|give|return to|escort|find|retrieve|collect|fetch|buy|sell|pay|persuade|bribe|convince|steal|pickpocket|read|listen|travel to|go to|meet|inform|tell)\b/i;

// Places whose contents are hostile by construction
const HOSTILE_PLACE_RE = /\b(daedric (?:ruin|shrine)|dwemer ruin|dwarven ruin|ancestral tomb|\bcrypt\b|\bcave\b|\bgrotto\b|\bmine\b|stronghold|sixth house|bandit|smuggler|necromancer|vampire|dungeon|\bdaedra\b|skeleton|centurion|corprus|ash (?:zombie|ghoul|slave)|will attack|turn hostile|hostile)\b/i;

/* ---------------- questline resolution ---------------- */

const ID_PREFIX_LINE = {
  MS: 'Main Quest', MV: 'Main Quest', A1: 'Main Quest', A2: 'Main Quest', C0: 'Main Quest',
  C1: 'Main Quest', C2: 'Main Quest', C3: 'Main Quest',
  FG: 'Fighters Guild', MG: 'Mages Guild', TG: 'Thieves Guild', TT: 'Tribunal Temple',
  MT: 'Morag Tong', IC: 'Imperial Cult', IL: 'Imperial Legion',
  HH: 'House Hlaalu', HR: 'House Redoran', HT: 'House Telvanni',
  DA: 'Daedric', VA: 'Vampire', BM: 'Bloodmoon', TR: 'Tribunal',
};

function questline(page, header) {
  const trail = findTemplate(page.text, 'Trail');
  if (trail && trail.positional.length > 1) {
    const seg = trail.positional[1].replace(/\|.*/, '').trim();
    if (seg && seg !== 'Quests') return seg;
  }
  const id = header.params.ID || '';
  const pre = id.slice(0, 2).toUpperCase();
  if (ID_PREFIX_LINE[pre]) return ID_PREFIX_LINE[pre];
  if (trail && trail.positional.length === 1 && trail.positional[0] === 'Quests') return 'Miscellaneous';
  if (page.ns === 'Tribunal') return 'Tribunal (expansion)';
  if (page.ns === 'Bloodmoon') return 'Bloodmoon (expansion)';
  return 'Miscellaneous';
}

/* ---------------- stages ---------------- */

function stageIndices(text) {
  const out = new Set();
  for (const t of findTemplates(text, 'Journal Entries')) {
    const re = /\|\s*(\d{1,3})\s*\|\s*(?:yes|no)?\s*\|/g;
    let m;
    while ((m = re.exec(t.raw))) out.add(Number(m[1]));
  }
  return [...out].sort((a, b) => a - b);
}

/* ---------------- rewards ---------------- */

function parseReward(raw) {
  if (!raw) return { text: null, gold: null, items: [], reputation: null };
  const text = stripWiki(raw).replace(/\s*\n\s*/g, '; ').trim();
  const goldM = /(\d[\d,]*)\s*(?:gold|drakes|septims)/i.exec(text);
  const items = links(raw)
    .map((l) => l.display)
    .filter((d) => d && !/^(Morrowind|Tribunal|Bloodmoon|Lore):/.test(d))
    .filter((d) => !/^\d+ (gold|drakes)$/i.test(d));
  return {
    text: text || null,
    gold: goldM ? Number(goldM[1].replace(/,/g, '')) : null,
    items: [...new Set(items)],
    reputation: null,
  };
}

function parseRep(raw) {
  if (!raw) return [];
  const out = [];
  const re = /([+-]\d+)\s*\(([^)]*)\)/g;
  let m;
  while ((m = re.exec(stripWiki(raw)))) out.push({ delta: Number(m[1]), faction: m[2].trim() });
  return out;
}

/* ---------------- classification ---------------- */

function classify(page) {
  const secs = sections(page.text);
  const quick = stripWiki(secs['Quick Walkthrough'] || '');
  const detailed = stripWiki(secs['Detailed Walkthrough'] || '');
  const notes = stripWiki(secs['Notes'] || '');
  const whole = stripWiki(page.text);

  const evidence = [];
  const killInQuick = KILL_RE.test(quick);
  const killStrictQuick = KILL_STRICT_RE.test(quick);
  const killAnywhere = KILL_RE.test(whole);
  const pacifistM = PACIFIST_RE.exec(detailed + '\n' + notes);
  const altQuickM = ALT_IN_QUICK_RE.exec(quick);
  const hostilePlace = HOSTILE_PLACE_RE.test(quick + '\n' + detailed);

  if (killStrictQuick) evidence.push(`kill verb in Quick Walkthrough: "${firstMatch(KILL_RE, quick)}"`);
  else if (killInQuick) evidence.push(`kill-ish verb in Quick Walkthrough: "${firstMatch(KILL_RE, quick)}"`);
  if (altQuickM) evidence.push(`the kill is offered as one branch of a disjunction in the required steps: "${altQuickM[0]}"`);
  if (pacifistM) evidence.push(`non-combat alternative stated: "${pacifistM[0]}"`);
  if (!killInQuick && killAnywhere) evidence.push('kill verb appears only outside the Quick Walkthrough (optional/contextual)');
  if (hostilePlace) evidence.push(`route passes hostile-by-construction location: "${firstMatch(HOSTILE_PLACE_RE, quick + '\n' + detailed)}"`);

  let kill_class;
  if (killInQuick && (pacifistM || altQuickM)) kill_class = 'kill_avoidable';
  else if (killInQuick) kill_class = 'kill_required';
  else if (killAnywhere && !SOFT_VERBS.test(quick)) kill_class = 'unclear';
  else kill_class = 'no_kill_step';

  if (!quick && !detailed) kill_class = 'unclear';

  return {
    kill_class,
    combat_likely_en_route: hostilePlace,
    evidence,
    quick_walkthrough_steps: (secs['Quick Walkthrough'] || '')
      .split('\n').filter((l) => /^#/.test(l.trim())).length,
  };
}

function firstMatch(re, s) {
  const m = new RegExp(re.source, re.flags.replace('g', '')).exec(s);
  return m ? m[0] : null;
}

/* ---------------- build ---------------- */

const pages = loadExtract();
const quests = [];

for (const p of pages) {
  const h = findTemplate(p.text, 'Quest Header');
  if (!h) continue;
  if (p.ns === 'Stormhold') continue; // different game
  const line = questline(p, h);
  const stages = stageIndices(p.text);
  const cls = classify(p);
  quests.push({
    title: p.title.replace(/^[A-Za-z]+:/, ''),
    page: p.title,
    game: p.ns === 'Morrowind' ? 'Morrowind (base)' : p.ns === 'Tribunal' ? 'Tribunal' : 'Bloodmoon',
    questline: line,
    faction_line: line.split('/')[0],
    quest_id: h.params.ID || null,
    giver: h.params.Giver ? stripWiki(h.params.Giver) : null,
    location: h.params.Loc ? stripWiki(h.params.Loc) : null,
    description: h.params.description ? stripWiki(h.params.description) : null,
    prerequisites: {
      previous_quest: h.params.Prev ? stripWiki(h.params.Prev) : null,
      required_rank: h.params.ReqRank ? stripWiki(h.params.ReqRank) : null,
      required_item: h.params.ReqItem ? stripWiki(h.params.ReqItem) : null,
      required_level: h.params.ReqLevel ? stripWiki(h.params.ReqLevel) : null,
      suggested_level: h.params.SuggLevel ? stripWiki(h.params.SuggLevel) : null,
    },
    next_quest: h.params.Next ? stripWiki(h.params.Next) : null,
    stages: { count: stages.length, indices: stages },
    reward: parseReward(h.params.Reward || h.params.reward),
    disposition: h.params.Disp ? stripWiki(h.params.Disp) : null,
    reputation: parseRep(h.params.Rep),
    difficulty: h.params.Difficulty ? stripWiki(h.params.Difficulty) : null,
    classification: cls,
  });
}

/* ---------------- aggregates ---------------- */

function frac(n, d) { return d ? Number((n / d).toFixed(4)) : null; }

function summarise(set, label) {
  const n = set.length;
  const c = (k) => set.filter((q) => q.classification.kill_class === k).length;
  const noKill = c('no_kill_step'), avoid = c('kill_avoidable'), req = c('kill_required'), unc = c('unclear');
  const pacifistUpper = noKill + avoid;
  const strictNoCombat = set.filter((q) =>
    (q.classification.kill_class === 'no_kill_step' || q.classification.kill_class === 'kill_avoidable')
    && !q.classification.combat_likely_en_route).length;
  return {
    scope: label,
    quests: n,
    no_kill_step: noKill,
    kill_avoidable: avoid,
    kill_required: req,
    unclear: unc,
    upper_bound_completable_without_a_required_kill: pacifistUpper,
    upper_bound_fraction: frac(pacifistUpper, n),
    lower_bound_also_excluding_hostile_route: strictNoCombat,
    lower_bound_fraction: frac(strictNoCombat, n),
  };
}

const mw = quests.filter((q) => q.game === 'Morrowind (base)');
const byLine = {};
for (const q of quests) (byLine[q.faction_line] ||= []).push(q);

const rewardsWithGold = quests.filter((q) => q.reward.gold != null);
const rewardsWithItems = quests.filter((q) => q.reward.items.length);
const goldValues = rewardsWithGold.map((q) => q.reward.gold).sort((a, b) => a - b);

const out = {
  $schema_note: 'Generated by tools/uesp/mine-quests.mjs from the UESP extract. Do not hand-edit; re-run the miner.',
  generated: new Date().toISOString().slice(0, 10),
  source: {
    dataset: 'corpus/uesp_morrowind_blackmarsh_extract.jsonl.xz',
    upstream: 'uespwiki-2019-11-07-current_xml.bz2 (UESP full wiki dump)',
    provenance: 'community-data',
    note: 'UESP editors\' transcription of Bethesda\'s shipped content. Fields copied from {{Quest Header}} and {{Journal Entries}} are community-data; every classification and fraction below is derived (ours).',
  },
  coverage: {
    quest_pages_with_infobox: quests.length,
    by_game: quests.reduce((m, q) => (m[q.game] = (m[q.game] || 0) + 1, m), {}),
    caveat: 'This is a census of UESP quest PAGES, not of the game\'s quest scripts. UESP merges some multi-stage quests onto one page and splits others; community tallies of the base game cite ~427 quests against our 396 base-game pages, so page count under-counts scripted quests by roughly 7%.',
  },
  kill_requirement: {
    method: 'Lexical classification over UESP walkthrough prose. kill_required = a kill/slay/assassinate/murder/exterminate verb appears in the Quick Walkthrough (UESP\'s list of required steps) with no stated alternative. kill_avoidable = such a verb appears AND the Detailed Walkthrough or Notes state a non-combat route. no_kill_step = no kill verb in the required steps. unclear = kill language present but no soft-verb steps and no stated alternative, or no walkthrough at all.',
    provenance: 'derived',
    confidence: 'medium-low',
    known_failure_modes: [
      'UESP walkthroughs are editorial; a quest may be pacifist-completable by a route no editor wrote down (under-counts pacifism).',
      'A quest with no kill verb may still route through a hostile dungeon (over-counts pacifism) — the lower bound below subtracts these.',
      '"Taunt them into attacking you, then kill them without a bounty" is a kill and is classified as such, but the alternative-phrase lexicon can mis-fire on it.',
      'Quests whose only violence is optional flavour are classed no_kill_step, which is correct for the question asked but generous.',
    ],
    hand_audit: {
      note: 'Two deterministic samples of base-game quests were read by hand against their UESP Quick Walkthroughs and the classifier corrected between rounds. This is the honest error bar on the fractions above.',
      round_1: {
        sample: 30,
        stride: 'every 13th base-game quest',
        errors_found: 5,
        error_kind: 'false kill_required — UESP states the kill as one branch of a disjunction inside the required-step list ("or kill him", "Either: kill / convince", "Evil Path is to ... or kill him")',
        fix: 'added ALT_IN_QUICK_RE; all 5 reclassified to kill_avoidable',
        examples: ['Ienas Sarandas', 'The Twin Lamps', 'Ring of Sanguine Sublime Wisdom', 'False Incarnate', 'Find Brother Nads'],
      },
      round_2: {
        sample: 22,
        stride: 'every 19th base-game quest, offset 7',
        errors_found: 3,
        error_kinds: [
          'false kill_required: "Either kill the farmers, take Corky, or get the gold" (Rent and Taxes) — disjunction lexicon too narrow',
          'false no_kill_step: "Take him down" / "take down the remaining three agents" (Telvanni Agents) — euphemism not in the kill lexicon',
          'spurious evidence string on The Death of Ralen Hlaalo (right-ish class, wrong reason)',
        ],
        fix: 'widened the disjunction targets, added "take X down" to the kill lexicon, tightened the (optional) pattern',
      },
      residual_error_estimate: {
        value: '~5-10% of quests mis-classified after both fixes',
        direction: 'errors now run in both directions rather than systematically against pacifism',
        implication: 'quote the base-game upper-bound fraction as "about two thirds", not as a precise percentage',
        untuned_failure_still_present: '"Take care of the guard", "Deal with the kagouti" and similar euphemisms remain classed as non-kill; deliberately not tuned further, to avoid fitting the classifier to the audit sample.',
      },
    },
    all_quests: summarise(quests, 'Morrowind + Tribunal + Bloodmoon quest pages'),
    base_game_only: summarise(mw, 'Morrowind base game quest pages'),
    by_questline: Object.fromEntries(
      Object.entries(byLine).sort((a, b) => b[1].length - a[1].length).map(([k, v]) => [k, summarise(v, k)]),
    ),
  },
  rewards: {
    provenance: 'community-data for the Reward field; derived for the aggregates',
    quests_with_reward_field: quests.filter((q) => q.reward.text).length,
    quests_with_gold_reward: rewardsWithGold.length,
    quests_with_named_item_reward: rewardsWithItems.length,
    gold_reward: goldValues.length ? {
      min: goldValues[0],
      median: goldValues[Math.floor(goldValues.length / 2)],
      mean: Math.round(goldValues.reduce((a, b) => a + b, 0) / goldValues.length),
      max: goldValues[goldValues.length - 1],
    } : null,
    fraction_of_rewarding_quests_with_a_named_item: frac(rewardsWithItems.length, quests.filter((q) => q.reward.text).length),
  },
  gating: {
    quests_with_required_rank: quests.filter((q) => q.prerequisites.required_rank).length,
    quests_with_previous_quest: quests.filter((q) => q.prerequisites.previous_quest).length,
    quests_with_reputation_change: quests.filter((q) => q.reputation.length).length,
    quests_with_disposition_change: quests.filter((q) => q.disposition).length,
  },
  stages: (() => {
    const s = quests.map((q) => q.stages.count).filter((n) => n > 0).sort((a, b) => a - b);
    return {
      quests_with_journal_entries: s.length,
      min: s[0], median: s[Math.floor(s.length / 2)],
      mean: Number((s.reduce((a, b) => a + b, 0) / s.length).toFixed(2)),
      max: s[s.length - 1],
    };
  })(),
  quests: quests.sort((a, b) => (a.questline + a.title).localeCompare(b.questline + b.title)),
};

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(out, null, 2) + '\n');
console.error(`wrote ${OUT} — ${quests.length} quests`);
console.log(JSON.stringify({
  all: out.kill_requirement.all_quests,
  base: out.kill_requirement.base_game_only,
  rewards: out.rewards,
  gating: out.gating,
  stages: out.stages,
}, null, 2));
