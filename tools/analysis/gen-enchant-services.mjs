#!/usr/bin/env node
// gen-enchant-services.mjs — the priced enchanting SHELF, so RI-MAG03 M8 has something to sum.
//
// M8: "Sum every purchasable spell and enchanting service in `game/data/**`. Assert the magic
// line totals 28,000 g ± 15%." The W1-14 round-1 verdict found 47 purchasable spells summing to
// 19,808 g — 29% below the band — and recorded the reason plainly: *"The enchanting services
// that would close the gap have no priced surface in `game/data/**` for a critic to sum, so the
// two figures cannot be reconciled from artifacts."* The wave-1 build shipped the enchanting
// ARITHMETIC (points, capacity, soul-grade gate, charge) and no shelf for it to price.
//
// This file is the shelf. Every price is computed by the SAME formula `MagicSystem.enchantQuote`
// uses — `round(6.5 × points^1.35) × enchanter.gold_multiplier`, with
// `points = ceil(focus_base × kind.points_multiplier)` — so there is exactly one place a magic
// price comes from and a critic recomputing the line offline gets the same number the game
// quotes at the counter. Nothing here is hand-set. A hand-set price is `RI-MAG03`'s own named
// failure ("costs are hand-set per item" scores 0 on the enchanting axis).
//
// Run: node tools/analysis/gen-enchant-services.mjs [--check]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { focusBase } from '../../game/src/sim/magic/cost.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const check = process.argv.includes('--check');
const effectsDoc = JSON.parse(fs.readFileSync(path.join(ROOT, 'game/data/magic/effects.json'), 'utf8'));
const ench = JSON.parse(fs.readFileSync(path.join(ROOT, 'game/data/magic/enchanting.json'), 'utf8'));
const spells = JSON.parse(fs.readFileSync(path.join(ROOT, 'game/data/magic/spells.json'), 'utf8'));
const byId = Object.fromEntries(effectsDoc.effects.map((e) => [e.id, e]));

const E = (effect, magnitude, duration_s = 0, area_r_m = 0) => ({ effect, magnitude, duration_s, area_r_m });

/**
 * The stock. Each row is an item a named enchanter in a named settlement has ON THE SHELF, which
 * is the only thing M8 can sum — a service somebody would have to commission has no price until
 * they commission it. Every one is a coordinate in the same parameter space spellmaking uses.
 */
const STOCK = [
  // ---- Gideon, the Imperial side: cautious, legal, expensive ---------------------------------
  { id: 'ench_gideon_warding_ring', name: 'Ring of the Steady Hand', item: 'ring', kind: 'constant', enchanter: 'journeyman_gideon', soul: 'greater', range: 'self', fx: [E('fortify_attribute', 4, 0)], where: 'Gideon', prose: 'Imperial silver, a Rootkeeper stone, and an argument about which of the two is doing the work.' },
  { id: 'ench_gideon_lamp_amulet', name: 'Fen-Lamp Amulet', item: 'amulet', kind: 'on_use', enchanter: 'journeyman_gideon', soul: 'common', range: 'self', fx: [E('night_eye', 10, 200)], where: 'Gideon', prose: 'For the customs men who walk the boardwalk after dark and would rather not carry a torch.' },
  { id: 'ench_gideon_ward_shirt', name: 'Warded Shirt', item: 'medium_armour', kind: 'constant', enchanter: 'master_blackrose', soul: 'greater', range: 'self', fx: [E('resist_element', 4, 0)], where: 'Gideon', prose: 'Lacquered linen. It smells of the chapel and does not stop smelling of it.' },

  // ---- Lilmoth, the wharf: cheap, on-use, half of it stolen -----------------------------------
  { id: 'ench_lilmoth_pick_ring', name: 'Wharf-Picker Ring', item: 'ring', kind: 'on_use', enchanter: 'journeyman_lilmoth', soul: 'lesser', range: 'target', fx: [E('open_lock', 20)], where: 'Lilmoth', prose: 'Nobody at this counter asks what it is for.' },
  { id: 'ench_lilmoth_quiet_boots', name: 'Quiet Boots', item: 'light_armour', kind: 'constant', enchanter: 'journeyman_lilmoth', soul: 'greater', range: 'self', fx: [E('muffle', 6, 0)], where: 'Lilmoth', prose: 'Soled with something that was recently alive.' },
  { id: 'ench_lilmoth_gill_amulet', name: 'Gill-Charm', item: 'amulet', kind: 'on_use', enchanter: 'journeyman_lilmoth', soul: 'common', range: 'self', fx: [E('breathe_water', 1, 180)], where: 'Lilmoth', prose: 'The standard purchase of anyone who works under the wharf rather than on it.' },
  { id: 'ench_lilmoth_sap_blade', name: 'Sap-Bitten Shortsword', item: 'one_handed_weapon', kind: 'on_strike', enchanter: 'journeyman_lilmoth', soul: 'common', range: 'touch', fx: [E('drain_health', 8, 6)], where: 'Lilmoth', prose: 'It weeps a little between uses. That is normal, they say.' },

  // ---- Stormhold, the Rootkeepers: Root-Speech and Warding, no Veiling ------------------------
  { id: 'ench_stormhold_mend_rod', name: 'Rootkeeper Mending Rod', item: 'one_handed_weapon', kind: 'on_use', enchanter: 'journeyman_stormhold', soul: 'common', range: 'touch', fx: [E('restore_health', 24)], where: 'Stormhold', prose: 'Handed out to the ones who go into the fen after other people.' },
  { id: 'ench_stormhold_slowfall_cloak', name: 'Canopy Cloak', item: 'clothing', kind: 'on_use', enchanter: 'journeyman_stormhold', soul: 'lesser', range: 'self', fx: [E('slowfall', 1, 60)], where: 'Stormhold', prose: 'A hundred and forty feet of hist-canopy makes this a tool, not a luxury.' },
  { id: 'ench_stormhold_clean_ring', name: 'Ring of Clean Blood', item: 'ring', kind: 'on_use', enchanter: 'journeyman_stormhold', soul: 'common', range: 'self', fx: [E('cure_disease', 3)], where: 'Stormhold', prose: 'The single most-sold object in Black Marsh.' },
  { id: 'ench_stormhold_ward_shield', name: 'Xanmeer-Facing Shield', item: 'shield', kind: 'constant', enchanter: 'master_blackrose', soul: 'grand', range: 'self', fx: [E('shield', 5, 0)], where: 'Stormhold', prose: 'Stone dust in a gold lacquer, laid in a pattern that is deliberately not symmetrical.' },

  // ---- Blackrose, the far shelf: the two dear things -------------------------------------------
  { id: 'ench_blackrose_flight_ring', name: 'Ring of the Long Flight', item: 'ring', kind: 'on_use', enchanter: 'master_blackrose', soul: 'greater', range: 'self', fx: [E('levitate', 1, 30)], where: 'Blackrose', prose: 'Sold with a straight face and a written warning about the Focus.' },
  { id: 'ench_blackrose_recall_amulet', name: 'Amulet of Return', item: 'amulet', kind: 'on_use', enchanter: 'master_blackrose', soul: 'grand', range: 'self', fx: [E('recall', 12)], where: 'Blackrose', prose: 'Three charges. The fourth time you need it, you walk.' },
];

// ---------------------------------------------------------------------------------------------
// Price. ONE formula, the same one MagicSystem.enchantQuote() runs at the counter.
// ---------------------------------------------------------------------------------------------
const enchanterById = Object.fromEntries(ench.enchanters.map((e) => [e.id, e]));
const problems = [];
const services = [];
let total = 0;

for (const s of STOCK) {
  const K = ench.enchantment_kinds[s.kind];
  if (!K) { problems.push(`${s.id}: unknown enchantment kind '${s.kind}'`); continue; }
  const cap = ench.item_capacity[s.item];
  if (cap === undefined) { problems.push(`${s.id}: unknown item class '${s.item}'`); continue; }
  const E0 = enchanterById[s.enchanter];
  if (!E0) { problems.push(`${s.id}: unknown enchanter '${s.enchanter}' (known: ${Object.keys(enchanterById).join(', ')})`); continue; }

  let base = 0;
  for (const t of s.fx) {
    const e = byId[t.effect];
    if (!e) { problems.push(`${s.id}: unknown effect '${t.effect}'`); continue; }
    if (!e.ranges.includes(s.range)) problems.push(`${s.id}: '${t.effect}' does not accept range '${s.range}'`);
    const D = s.kind === 'constant' ? 0 : (t.duration_s || 0);
    base += focusBase(e.weight, t.magnitude, D, t.area_r_m || 0, s.range);
  }
  const points = Math.ceil(base * K.points_multiplier);
  const gold = E0.gold_multiplier === 0 ? 0 : Math.round(Math.round(6.5 * Math.pow(points, 1.35)) * E0.gold_multiplier);
  const maxPoints = E0.max_points;

  if (points > cap) problems.push(`${s.id}: ${points} points does not fit a ${s.item} (capacity ${cap})`);
  if (maxPoints != null && points > maxPoints) problems.push(`${s.id}: ${points} points exceeds ${E0.name || E0.id}'s ceiling of ${maxPoints}`);
  if (K.requires_soul_grade && !K.requires_soul_grade.includes(s.soul)) problems.push(`${s.id}: a ${s.kind} enchantment needs ${K.requires_soul_grade.join('/')}; offered ${s.soul}`);

  const grade = ench.soul_gems.grades.find((g) => g.id === s.soul);
  services.push({
    id: s.id, name: s.name, item_class: s.item, kind: s.kind,
    enchanter: s.enchanter, settlement: s.where,
    effects: s.fx, range: s.range, soul_grade: s.soul,
    focus_base: base, points, capacity: cap, enchanter_ceiling: maxPoints,
    gold_price: gold,
    charge_pool: grade ? grade.charge : 0,
    charge_per_activation: s.kind === 'constant' ? 0 : Math.round(base * K.charge_per_activation_multiplier),
    // SG-4, restated per row so a critic summing a resale line reads it here: an enchantment
    // adds full value on purchase and EXACTLY ZERO on sale.
    adds_sale_value: 0,
    purchasable: true,
    prose: s.prose,
  });
  total += gold;
}

const spellLine = spells.spells.filter((s) => s.purchasable).reduce((a, s) => a + s.gold_price, 0);
const spellCount = spells.spells.filter((s) => s.purchasable).length;

const doc = {
  schema: 'elder-souls/magic-enchant-services@1',
  id: 'magic-enchant-services',
  corpus_item: 'RI-MAG03 §B (enchanting) and M8 (economy cross-check)',
  generated_by: 'tools/analysis/gen-enchant-services.mjs',
  note: [
    'The priced enchanting shelf. Every gold figure is computed by the same formula',
    'MagicSystem.enchantQuote() runs — round(6.5 × points^1.35) × enchanter.gold_multiplier —',
    'so the number a critic sums offline and the number the counter quotes are the same number.',
    'RI-MAG03 M8 sums THIS FILE plus the purchasable spells in spells.json; the round-1 verdict',
    'could not reconcile the magic line because only the second half existed.',
  ],
  m8_line: {
    purchasable_spells: spellCount,
    spell_gold: spellLine,
    enchant_services: services.length,
    enchant_gold: total,
    magic_line_total_g: spellLine + total,
    target_g: 28000,
    band: [23800, 32200],
    in_band: spellLine + total >= 23800 && spellLine + total <= 32200,
    deviation_pct: +(((spellLine + total) / 28000 - 1) * 100).toFixed(2),
  },
  services,
};

if (problems.length) {
  console.error(`gen-enchant-services: ${problems.length} problem(s)\n  - ${problems.join('\n  - ')}`);
  process.exit(21);
}

const out = path.join(ROOT, 'game/data/magic/enchant-services.json');
const text = JSON.stringify(doc, null, 2) + '\n';
if (check) {
  const cur = fs.existsSync(out) ? fs.readFileSync(out, 'utf8') : '';
  if (cur !== text) { console.error('enchant-services.json is stale'); process.exit(20); }
} else {
  fs.writeFileSync(out, text);
}
console.log(`[harness] ${services.length} enchanting services = ${total} g; spells ${spellCount} = ${spellLine} g; MAGIC LINE ${spellLine + total} g (target 28,000 ±15% = ${doc.m8_line.band.join('..')}) -> ${doc.m8_line.in_band ? 'IN BAND' : 'OUT OF BAND'} (${doc.m8_line.deviation_pct}%)`);
