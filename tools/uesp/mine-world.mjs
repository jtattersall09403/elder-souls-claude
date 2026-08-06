#!/usr/bin/env node
/**
 * mine-world.mjs — build corpus/50-world/data/morrowind-world-census.json
 *
 * Spine: the 40 pages carrying {{Morrowind Town Table}} — every settlement UESP
 * treats as a settlement across Morrowind, Tribunal and Bloodmoon.
 *
 * For each settlement we resolve, from the extract itself:
 *   services      — from the Town Table's own service list (community-data)
 *   travel        — silt strider / guild guide / boat / Almsivi / Divine destinations
 *   named NPCs    — every page with an {{NPC Summary}} whose city=/town=/loc= resolves here
 *   NPC services  — merchants / trainers / repairers / enchanters / spellmakers / innkeepers,
 *                   read off the NPC Summary flags, so "how many shops" is counted not guessed
 *   interiors     — pages with a {{Place Summary}} that belong to the settlement, plus every
 *                   Place-Summary page linked from the settlement page itself
 *   quest hooks   — quests from the quest census whose Loc or Giver names this settlement
 *
 * community-data: every field copied from an infobox.
 * derived: all counts, ratios, tier assignment and the RI-WLD03 comparison block.
 *
 * Run: node tools/uesp/mine-world.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadExtract, findTemplate, links, stripWiki } from './uesp-infobox.mjs';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const OUT = path.join(REPO, 'corpus', '50-world', 'data', 'morrowind-world-census.json');
const QUEST_CENSUS = path.join(REPO, 'corpus', '30-quests', 'data', 'morrowind-quest-census.json');

const pages = loadExtract();
const byTitle = new Map(pages.map((p) => [p.title, p]));

/** first wiki-link target in a field, normalised to a page title */
function firstTarget(v) {
  if (!v) return null;
  const l = links(v)[0];
  if (l) return l.target.replace(/_/g, ' ').trim();
  const t = stripWiki(v).split(',')[0].trim();
  return t || null;
}

function bulletList(v) {
  if (!v) return [];
  return String(v).split('\n')
    .filter((l) => /^\s*\*/.test(l))
    .map((l) => stripWiki(l.replace(/^\s*\*+\s*/, '')).trim())
    .filter(Boolean);
}

/* ---------------- settlements ---------------- */

const settlements = [];
for (const p of pages) {
  const t = findTemplate(p.text, 'Morrowind Town Table');
  if (!t) continue;
  settlements.push({ page: p, tt: t });
}
const settlementTitles = new Set(settlements.map((s) => s.page.title));

/* ---------------- NPCs indexed by settlement ---------------- */

const npcsBySettlement = new Map();
let npcPages = 0;
for (const p of pages) {
  const n = findTemplate(p.text, 'NPC Summary');
  if (!n) continue;
  npcPages++;
  const home = firstTarget(n.params.city) || firstTarget(n.params.town) || firstTarget(n.params.loc);
  if (!home || !settlementTitles.has(home)) continue;
  const rec = {
    name: p.title.replace(/^[A-Za-z]+:/, ''),
    page: p.title,
    race: n.params.race ? stripWiki(n.params.race) : null,
    npc_class: n.params.class ? stripWiki(n.params.class) : null,
    level: n.params.level ? Number(stripWiki(n.params.level)) || null : null,
    faction: n.params.faction ? stripWiki(n.params.faction).split('\n')[0] : null,
    services: [
      n.params.merc !== undefined && 'merchant',
      n.params.train !== undefined && 'trainer',
      n.params.repair !== undefined && 'repair',
      n.params.enchanter !== undefined && 'enchanter',
      n.params.spellmaker !== undefined && 'spellmaker',
      n.params.spell !== undefined && 'spell vendor',
      n.params.rent !== undefined && 'innkeeper (rentable bed)',
      n.params.transport !== undefined && 'transport',
    ].filter(Boolean),
    store: n.params.store ? stripWiki(n.params.store) : null,
    merchant_gold: n.params.gold ? Number(stripWiki(n.params.gold)) || null : null,
    trains: n.params.train ? stripWiki(n.params.train).replace(/\n/g, ', ') : null,
  };
  if (!npcsBySettlement.has(home)) npcsBySettlement.set(home, []);
  npcsBySettlement.get(home).push(rec);
}

/* ---------------- interiors indexed by settlement ---------------- */

const placePages = new Map(); // title -> Place Summary template
for (const p of pages) {
  const ps = findTemplate(p.text, 'Place Summary');
  if (ps) placePages.set(p.title, ps);
}

const interiorsBySettlement = new Map();
// (a) place pages that declare a city=
for (const [title, ps] of placePages) {
  const city = firstTarget(ps.params.city);
  if (city && settlementTitles.has(city)) {
    if (!interiorsBySettlement.has(city)) interiorsBySettlement.set(city, new Map());
    interiorsBySettlement.get(city).set(title, { type: stripWiki(ps.params.type || ''), scope: 'in_settlement' });
  }
}
// (b) any Place-Summary page linked from the settlement page (UESP lists a town's
//     shops/houses/guildhalls inline rather than tagging each with city=)
for (const s of settlements) {
  const title = s.page.title;
  if (!interiorsBySettlement.has(title)) interiorsBySettlement.set(title, new Map());
  const m = interiorsBySettlement.get(title);
  for (const l of links(s.page.text)) {
    const tgt = l.target.replace(/_/g, ' ').split('#')[0].trim();
    if (tgt === title) continue;
    if (settlementTitles.has(tgt)) continue;
    const ps = placePages.get(tgt);
    if (ps && !m.has(tgt)) m.set(tgt, { type: stripWiki(ps.params.type || ''), scope: 'linked_from_settlement_page' });
  }
}

/* ---------------- quests indexed by settlement ---------------- */

let quests = [];
try {
  quests = JSON.parse(fs.readFileSync(QUEST_CENSUS, 'utf8')).quests;
} catch { /* census not built yet */ }

function questsFor(title) {
  const bare = title.replace(/^[A-Za-z]+:/, '').replace(/\s*\(city\)$/, '');
  const re = new RegExp(`\\b${bare.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
  return quests.filter((q) => re.test(q.location || '') || re.test(q.giver || ''));
}

/* ---------------- assemble ---------------- */

const TIER_BY_SIZE = (npcs) => (npcs >= 80 ? 'capital-scale' : npcs >= 40 ? 'city' : npcs >= 18 ? 'town' : npcs >= 7 ? 'village' : 'minor');

const rows = settlements.map(({ page, tt }) => {
  const npcs = npcsBySettlement.get(page.title) || [];
  const interiors = [...(interiorsBySettlement.get(page.title) || new Map())].map(([t, v]) => ({ page: t, type: v.type || null, scope: v.scope }));
  const qs = questsFor(page.title);
  const svcCount = (name) => npcs.filter((n) => n.services.includes(name)).length;
  const services = bulletList(tt.params.services);
  return {
    name: page.title.replace(/^[A-Za-z]+:/, ''),
    page: page.title,
    game: page.ns,
    region: tt.params.region ? stripWiki(tt.params.region) : null,
    alignment: tt.params.alignment ? stripWiki(tt.params.alignment) : null,
    description: tt.params.description ? stripWiki(tt.params.description) : null,
    services_listed_by_uesp: services,
    travel: {
      silt_strider: bulletList(tt.params.siltstrider),
      guild_guide: bulletList(tt.params.guildguide),
      boat: bulletList(tt.params.boat),
      almsivi_intervention: bulletList(tt.params.almsivi),
      divine_intervention: bulletList(tt.params.divine),
      propylon: bulletList(tt.params.propylon),
    },
    counts: {
      named_npc_pages: npcs.length,
      interiors_with_place_pages: interiors.length,
      interiors_tagged_to_this_settlement: interiors.filter((i) => i.scope === 'in_settlement').length,
      merchants: svcCount('merchant'),
      trainers: svcCount('trainer'),
      repairers: svcCount('repair'),
      enchanters: svcCount('enchanter'),
      spellmakers: svcCount('spellmaker'),
      innkeepers_with_rentable_bed: svcCount('innkeeper (rentable bed)'),
      transport_operators: svcCount('transport'),
      services_listed: services.length,
      quests_referencing_settlement: qs.length,
      distinct_quest_givers: new Set(qs.map((q) => (q.giver || '').split(' in ')[0].trim()).filter(Boolean)).size,
    },
    derived_tier: TIER_BY_SIZE(npcs.length),
    interiors,
    named_npcs: npcs.sort((a, b) => a.name.localeCompare(b.name)),
  };
});

rows.sort((a, b) => b.counts.named_npc_pages - a.counts.named_npc_pages);

const num = (f) => rows.map(f).filter((n) => Number.isFinite(n)).sort((a, b) => a - b);
const stat = (arr) => arr.length ? {
  min: arr[0], median: arr[Math.floor(arr.length / 2)],
  mean: Number((arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(1)),
  max: arr[arr.length - 1], total: arr.reduce((a, b) => a + b, 0),
} : null;

const vvardenfellOnly = rows.filter((r) => r.game === 'Morrowind');

const out = {
  $schema_note: 'Generated by tools/uesp/mine-world.mjs from the UESP extract. Do not hand-edit; re-run the miner.',
  generated: new Date().toISOString().slice(0, 10),
  source: {
    dataset: 'corpus/uesp_morrowind_blackmarsh_extract.jsonl.xz',
    upstream: 'uespwiki-2019-11-07-current_xml.bz2',
    provenance: 'community-data for every infobox field; derived for every count, ratio and tier below',
  },
  method_and_limits: [
    'A settlement is a page carrying {{Morrowind Town Table}} — 40 of them, which includes 4 Ashlander camps, 3 forts, 3 player strongholds and Wolverine Hall, none of which are towns in the ordinary sense. Filter on derived_tier before comparing to a design target.',
    'named_npc_pages counts UESP NPC PAGES resolved to the settlement, not game NPC records. UESP gives most named NPCs a page and many generic ones too; Vivec\'s NPCs are split across canton sub-pages so Vivec\'s figure is a severe under-count of the city as a whole (its cantons resolve to their own city= strings).',
    'interiors_with_place_pages counts interiors UESP thought worth a page. Entries with scope=in_settlement carry an explicit city= tag; scope=linked_from_settlement_page were merely linked from the town page and may sit OUTSIDE it (Balmora picks up Arkngthand, Hlormaren and Shulk Egg Mine this way). Use interiors_tagged_to_this_settlement for a conservative count. Either way this is a floor: Morrowind\'s actual interior cell count per town is higher, because UESP does not give every house a page.',
    'Service counts come from NPC Summary flags (merc/train/repair/enchanter/spellmaker/rent), so they count SERVICE PROVIDERS, not shop buildings. A shop with one merchant counts 1.',
    'quests_referencing_settlement is a name match against the quest census Loc/Giver fields; it over-matches for settlements with common names and under-matches quests whose Loc names a dungeon.',
  ],
  totals: {
    settlement_pages: rows.length,
    vvardenfell_settlement_pages: vvardenfellOnly.length,
    npc_pages_in_extract: npcPages,
    npc_pages_resolved_to_a_settlement: rows.reduce((s, r) => s + r.counts.named_npc_pages, 0),
    place_pages_in_extract: placePages.size,
  },
  distributions: {
    named_npc_pages: stat(num((r) => r.counts.named_npc_pages)),
    interiors_with_place_pages: stat(num((r) => r.counts.interiors_with_place_pages)),
    merchants: stat(num((r) => r.counts.merchants)),
    trainers: stat(num((r) => r.counts.trainers)),
    services_listed: stat(num((r) => r.counts.services_listed)),
  },
  ri_wld03_comparison: {
    note: 'RI-WLD03 sets per-tier targets for OUR world and calibrates them against Balmora. These are the real UESP figures for the settlements it names, so the calibration can be checked. All comparison arithmetic is derived (ours).',
    balmora: (() => {
      const b = rows.find((r) => r.page === 'Morrowind:Balmora');
      return b ? {
        named_npc_pages: b.counts.named_npc_pages,
        ri_wld03_claim: '~94 NPCs (community-data, medium confidence)',
        interiors_with_place_pages: b.counts.interiors_with_place_pages,
        interiors_tagged_to_this_settlement: b.counts.interiors_tagged_to_this_settlement,
        merchants: b.counts.merchants,
        trainers: b.counts.trainers,
        services_listed_by_uesp: b.services_listed_by_uesp,
      } : null;
    })(),
    largest_settlements_by_npc_pages: rows.slice(0, 10).map((r) => ({
      name: r.name, npc_pages: r.counts.named_npc_pages, interiors: r.counts.interiors_with_place_pages,
      merchants: r.counts.merchants, trainers: r.counts.trainers, tier: r.derived_tier,
    })),
  },
  settlements: rows,
};

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(out, null, 2) + '\n');
console.error(`wrote ${OUT} — ${rows.length} settlements`);
console.log(JSON.stringify({ totals: out.totals, distributions: out.distributions, top: out.ri_wld03_comparison }, null, 2));
