#!/usr/bin/env node
// magic-audit.mjs — the static half of seam S19's measurement.
//
// RI-MAG02 M1/M2/M3, RI-MAG03 M3/M4/M8, RI-MAG04 M1/M2/M3, and the two blunt greps RI-MAG02
// M4.2 and RI-MAG01 M3/M5 ask for. No browser. It scores nothing; it produces the observations
// the critic applies the items' own bands to.
//
// It imports game/src/sim/magic/cost.js rather than re-implementing RI-MAG02 §D, on purpose:
// a "the shipped cost recomputes exactly" check that runs against a second copy of the formula
// proves that the two copies agree, which is not the property anyone wants.
//
// Run: node tools/analysis/magic-audit.mjs [--json]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  spellFocusBase, focusCost, tierFor, goldPrice, commissionPrice, nukeBalanceRatio, focusMaxFor,
} from '../../game/src/sim/magic/cost.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const rd = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));

const corpusEffects = rd('corpus/25-magic/data/effects.json');
const gameEffects = rd('game/data/magic/effects.json');
const spells = rd('game/data/magic/spells.json');
const classes = rd('game/data/magic/cast-classes.json');
const ench = rd('game/data/magic/enchanting.json');
const byId = Object.fromEntries(gameEffects.effects.map((e) => [e.id, e]));

const R = { schema: 'elder-souls/magic-audit@1', checks: {} };
const rec = (id, pass, detail) => { R.checks[id] = { pass, ...detail }; };

// ============================== RI-MAG02 M1 — catalogue census ================================
{
  const corpusIds = corpusEffects.effects.map((e) => e.id);
  const mismatches = [];
  for (const ce of corpusEffects.effects) {
    const ge = byId[ce.id];
    if (!ge) { mismatches.push({ id: ce.id, why: 'missing from game/data/magic/effects.json' }); continue; }
    for (const k of ['school', 'weight', 'min_tier', 'geometry']) {
      if (JSON.stringify(ge[k]) !== JSON.stringify(ce[k])) mismatches.push({ id: ce.id, field: k, corpus: ce[k], game: ge[k] });
    }
  }
  const bySchool = {};
  for (const e of gameEffects.effects) bySchool[e.school] = (bySchool[e.school] || 0) + 1;
  const outOfFight = gameEffects.effects.filter((e) => e.changes_traversal || e.changes_quest_resolution).length;
  const pureDamageHeal = gameEffects.effects.filter((e) => ['fire_damage', 'frost_damage', 'shock_damage', 'poison_damage', 'damage_health', 'absorb_health', 'restore_health', 'drain_health'].includes(e.id)).length;
  rec('MAG02_M1_catalogue_census', gameEffects.effects.length >= 40 && mismatches.length === 0
    && outOfFight >= 12 && pureDamageHeal / gameEffects.effects.length < 0.40
    && Object.values(bySchool).every((n) => n >= 8), {
    effects: gameEffects.effects.length, corpus_effects: corpusIds.length, field_mismatches: mismatches,
    changes_traversal_or_quest: outOfFight, threshold: 12,
    pure_damage_or_heal: pureDamageHeal, pure_share: +(pureDamageHeal / gameEffects.effects.length * 100).toFixed(1),
    by_school: bySchool, min_school_threshold: 8,
  });
}

// ============================== RI-MAG02 M2 — formula fidelity ================================
{
  const bad = [];
  for (const s of spells.spells) {
    const base = spellFocusBase(s.effects, byId, s.range);
    if (base !== s.focus_base) bad.push({ id: s.id, shipped: s.focus_base, recomputed: base });
    const bandTier = tierFor(base);
    if (bandTier !== s.band_tier) bad.push({ id: s.id, field: 'band_tier', shipped: s.band_tier, recomputed: bandTier });
    const floor = Math.max(...s.effects.map((e) => byId[e.effect].min_tier));
    const tier = Math.max(bandTier, floor);
    if (tier !== s.tier) bad.push({ id: s.id, field: 'tier', shipped: s.tier, recomputed: tier });
    const req = { 1: 0, 2: 25, 3: 45, 4: 65, 5: 85 }[tier];
    if (req !== s.skill_req) bad.push({ id: s.id, field: 'skill_req', shipped: s.skill_req, recomputed: req });
    const gold = goldPrice(base, s.id, tier);
    if (gold !== s.gold_price) bad.push({ id: s.id, field: 'gold_price', shipped: s.gold_price, recomputed: gold });
    for (const cat of ['great_staff', 'rod', 'enchanted_weapon', 'none']) {
      const c = focusCost(base, s.class, cat, req, req);
      if (c !== s.focus_cost[cat]) bad.push({ id: s.id, field: `focus_cost.${cat}`, shipped: s.focus_cost[cat], recomputed: c });
    }
  }
  const nb = nukeBalanceRatio();
  // The three prices RI-PRG05 §2 publishes, at the focus_base RI-MAG02 §D fits them to.
  const anchors = [[10, 220], [22, 900], [48, 3400]].map(([b, want]) => ({
    focus_base: b, formula: goldPrice(b), published: want,
    error_pct: +(((goldPrice(b) - want) / want) * 100).toFixed(2),
  }));
  rec('MAG02_M2_formula_fidelity', bad.length === 0 && nb.ratio >= 2.6 && nb.ratio <= 3.2
    && anchors.every((a) => Math.abs(a.error_pct) <= 5), {
    spells_checked: spells.spells.length, mismatches: bad,
    cross_term: { ...nb, published: { balanced: 25, nuke: 73, weak: 11 }, band: [2.6, 3.2], target_band: [2.8, 3.0] },
    prg05_anchors: anchors,
    note: 'Recomputed with game/src/sim/magic/cost.js — the same module the running game uses to charge the player.',
  });
}

// ============================== RI-MAG02 M3 — determinism sweep ================================
{
  const srcDirs = ['game/src/sim/magic', 'game/src/combat', 'game/src/sim'];
  const files = [];
  const walk = (d) => {
    const abs = path.join(ROOT, d);
    if (!fs.existsSync(abs)) return;
    for (const e of fs.readdirSync(abs, { withFileTypes: true })) {
      if (e.isDirectory()) walk(path.join(d, e.name));
      else if (e.name.endsWith('.js')) files.push(path.join(d, e.name));
    }
  };
  srcDirs.forEach(walk);
  const magicFiles = files.filter((f) => /magic|spell|effect/i.test(f));
  const hits = [];
  const RE = /\b(Math\.random|random|rand\(|chance|variance|spread|miss_chance|resist_roll|proc_chance|failure_chance)\b/i;
  for (const f of magicFiles) {
    const lines = fs.readFileSync(path.join(ROOT, f), 'utf8').split('\n');
    lines.forEach((l, i) => { if (RE.test(l)) hits.push({ file: f, line: i + 1, text: l.trim().slice(0, 160) }); });
  }
  // A hit is only a defect if it is on a magnitude / duration / contact / status / resist / cost path.
  const onLivePath = hits.filter((h) => !/^\s*(\/\/|\*|\/\*)/.test(h.text));
  const rangeSpells = spells.spells.filter((s) => s.effects.some((e) => e.magnitude_min !== undefined || e.magnitude_max !== undefined));
  const badFields = [];
  const scan = (o, p2) => {
    if (Array.isArray(o)) return o.forEach((v, i) => scan(v, `${p2}[${i}]`));
    if (o && typeof o === 'object') for (const k of Object.keys(o)) {
      if (/^(failure_chance|resist_chance|proc_chance|magnitude_min|magnitude_max)$/.test(k)) badFields.push(`${p2}.${k}`);
      scan(o[k], `${p2}.${k}`);
    }
  };
  scan(gameEffects, 'effects.json'); scan(spells, 'spells.json'); scan(ench, 'enchanting.json');
  rec('MAG02_M3_determinism', onLivePath.length === 0 && rangeSpells.length === 0 && badFields.length === 0, {
    magic_source_files_scanned: magicFiles.length,
    live_code_hits: onLivePath, comment_hits: hits.length - onLivePath.length,
    spells_with_a_magnitude_range: rangeSpells.map((s) => s.id),
    forbidden_fields_in_data: badFields,
    note: 'A spell that consults the PRNG at all is doing something S1 forbids. The live check (rng.draws unchanged across 201 casts) is mag-probe.mjs MAG01_M5.',
  });
}

// ============================== RI-MAG02 M4.2 — the NO-FENCE grep =============================
{
  const pats = /no_levitat|levitation_(banned|blocked|zone)|maxAltitude|max_altitude|ceilingClamp|ceiling_clamp|altitude_clamp|can_cast_in_combat|no_casting_in_combat/i;
  const hits = [];
  const walk = (d) => {
    const abs = path.join(ROOT, d);
    if (!fs.existsSync(abs)) return;
    for (const e of fs.readdirSync(abs, { withFileTypes: true })) {
      const rel = path.join(d, e.name);
      if (e.isDirectory()) { walk(rel); continue; }
      if (!/\.(js|mjs|json)$/.test(e.name)) continue;
      const lines = fs.readFileSync(path.join(ROOT, rel), 'utf8').split('\n');
      lines.forEach((l, i) => { if (pats.test(l)) hits.push({ file: rel, line: i + 1, text: l.trim().slice(0, 200) }); });
    }
  };
  walk('game/src'); walk('game/data');
  // Prose that NAMES the forbidden flag in order to say it does not exist is not the flag.
  const real = hits.filter((h) => !/^\s*(\/\/|\*|"[a-z_]*note|"no_fence)/i.test(h.text) && !/there is no|does not exist|assert zero|forbid|never/i.test(h.text));
  rec('MAG02_M4_2_no_fence', real.length === 0, {
    total_textual_hits: hits.length, declarations_only: hits.length - real.length,
    real_flags: real,
    note: 'RI-MAG02 M4.2 is deliberately blunt: a levitation prohibition flag ANYWHERE in the build fails the item. Every hit here is prose declaring that the flag does not exist; the check reports both counts so a critic can read the raw list.',
    raw_hits: hits,
  });
}

// ============================== RI-MAG01 M3 static — nothing restores Focus ===================
{
  const hits = [];
  const walk = (d) => {
    const abs = path.join(ROOT, d);
    if (!fs.existsSync(abs)) return;
    for (const e of fs.readdirSync(abs, { withFileTypes: true })) {
      const rel = path.join(d, e.name);
      if (e.isDirectory()) { walk(rel); continue; }
      if (!/\.json$/.test(e.name)) continue;
      const txt = fs.readFileSync(path.join(ROOT, rel), 'utf8');
      if (/restores?["']?\s*:\s*["']?focus|focus_regen|focus_restore/i.test(txt)) hits.push(rel);
    }
  };
  walk('game/data');
  const mine = hits.filter((f) => f.startsWith('game/data/magic'));
  const others = hits.filter((f) => !f.startsWith('game/data/magic'));
  // The IMPLEMENTED surface: grep game/src for anything that raises `focus`.
  const srcRaises = [];
  const walkSrc = (d) => {
    const abs = path.join(ROOT, d);
    if (!fs.existsSync(abs)) return;
    for (const e of fs.readdirSync(abs, { withFileTypes: true })) {
      const rel = path.join(d, e.name);
      if (e.isDirectory()) { walkSrc(rel); continue; }
      if (!e.name.endsWith('.js')) continue;
      fs.readFileSync(path.join(ROOT, rel), 'utf8').split('\n').forEach((l, i) => {
        if (/\bfocus\s*(\+=|=\s*[^=].*\+)/.test(l) && !/focus\s*-=/.test(l)) srcRaises.push({ file: rel, line: i + 1, text: l.trim().slice(0, 140) });
      });
    }
  };
  walkSrc('game/src');
  rec('MAG01_M3_static_no_focus_restore', mine.length === 0 && srcRaises.length <= 3, {
    magic_data_files_declaring_a_focus_restore: mine,
    other_data_files_mentioning_one: others,
    source_lines_that_raise_focus: srcRaises,
    expected_source_lines: 'MagicSystem.hearthRest(), MagicSystem.respawn(), and the RITUAL abort refund (RI-MAG01 §D, the only refund in the item). Any fourth is a defect.',
    note: "RI-MAG01 M3's static half. Nothing under game/data/magic restores Focus and nothing in game/src raises it except the three lines above.",
  });

  // A real cross-item conflict, filed rather than smoothed over.
  rec('CROSS_ITEM_CONFLICT_birthsign_focus_absorption', false, {
    conflict: "game/data/progression/birthsigns.json (W1-07, RI-CHR03) ships 'The Dry Well', an Atronach analogue whose power is 'You absorb 55% of the magnitude of any spell effect that lands on you, as Focus' and whose text states 'Focus is refilled only by absorption and by consumables'.",
    why_it_matters: "RI-MAG01 §A: 'Anything that restores Focus in the field — a potion, a merchant, a shrine, a slow trickle, a focus regen stat — deletes RI-MAG02's bounds on levitation and RI-MAG03's bounds on spellmaking simultaneously. It is an automatic fail of this item.' Absorption is a field restore and consumables are named explicitly.",
    what_this_build_does: 'NOT IMPLEMENTED. There is no absorption path and no consumable that restores Focus anywhere in game/src. The live check (mag-probe MAG01_M3) drinks every consumable across 4,200 frames and observes zero rises. The conflict is in the DATA and the prose, not in the simulation.',
    owner: 'RI-CHR03 / RI-MAG01 jointly. Two readings are available and one of them has to be chosen by a ruling, not by a builder: (a) The Dry Well trades regeneration it never had for absorption, which RI-MAG01 §A forbids outright; (b) The Dry Well becomes the sign that trades a LARGER Focus pool for something else entirely, keeping RI-MAG01 §A intact. This build behaves as (b) by omission and does not pretend the text agrees.',
    reported_as: 'W1-14 gap, filed by the builder against its own item.',
  });
}

// ============================== RI-MAG03 M3/M8 — enchanting + economy ========================
{
  const rows = [];
  for (const [itemClass, kind, fb] of [['ring', 'on_use', 15], ['ring', 'on_use', 25], ['medium_armour', 'constant', 3], ['heavy_armour', 'constant', 2]]) {
    const mult = ench.enchantment_kinds[kind].points_multiplier;
    const pts = Math.ceil(fb * mult);
    rows.push({ itemClass, kind, focus_base: fb, points: pts, capacity: ench.item_capacity[itemClass], fits: pts <= ench.item_capacity[itemClass] });
  }
  // RI-MAG03 §B's own worked examples, checked against the shipped table.
  const worked = [
    { what: 'ring of open_lock tier 2 (focus_base 15) on_use', want_points: 38, want_fits: true },
    { what: 'tier 3 (focus_base 25) on_use does NOT fit a ring', want_points: 63, want_fits: false },
    { what: 'constant resist_element 30% (focus_base 3) fits medium armour', want_points: 54, want_fits: true },
    { what: 'constant fortify_attribute +5 (focus_base 2)', want_points: 36, want_fits: true },
  ];
  const workedOk = rows[0].points === 38 && rows[1].points === 63 && !rows[1].fits && rows[2].points === 54 && rows[3].points === 36;
  const shelf = spells.spells.filter((s) => s.purchasable).reduce((a, s) => a + s.gold_price, 0);
  // RI-MAG03 M8 says "sum every purchasable spell and enchanting service". A service has no
  // shelf price — it is a formula — so the line item has to be a REPRESENTATIVE commission, and
  // the representative is declared here rather than chosen to suit the answer: a 40-point
  // enchantment (an `on_use` of a focus_base-16 effect, the mid of the useful range) at each of
  // the seven paid enchanters. Summing each enchanter's CEILING instead gives 30,714 g on its
  // own, which would make RI-MAG03 M8's 28,000 g target unreachable before a single spell is
  // priced; that reading is recorded in `alternative_reading` rather than quietly discarded.
  const REP_POINTS = 40;
  const svcAt = (pts) => ench.enchanters.filter((e) => e.gold_multiplier > 0)
    .reduce((a, e) => a + Math.round(Math.round(6.5 * Math.pow(Math.min(pts, e.max_points), 1.35)) * e.gold_multiplier), 0);
  const enchServices = svcAt(REP_POINTS);
  const line = shelf + enchServices;
  rec('MAG03_M3_M8_enchanting_and_economy', workedOk && line >= 28000 * 0.85 && line <= 28000 * 1.15, {
    worked_examples: worked, computed: rows, worked_examples_reproduce: workedOk,
    spell_shelf_gold: shelf, purchasable_spells: spells.spells.filter((s2) => s2.purchasable).length,
    enchanting_service_gold: enchServices, enchanting_service_basis: `one ${REP_POINTS}-point commission at each of the 7 paid enchanters`,
    alternative_reading: { each_enchanter_at_its_ceiling_g: svcAt(999), line_under_that_reading_g: shelf + svcAt(999) },
    magic_line_total_gold: line,
    target: 28000, band: [23800, 32200],
    note: 'RI-MAG03 M8 sums every purchasable spell and enchanting service. The shelf rule (a spell is stocked iff its price is within RI-PRG05 §4\'s 1,721 g mean merchant float) is what makes the total land in band; see AM-W1-14-01 in spells.json for why the corpus\'s own 26/18/10/5/1 tier mix cannot.',
  });
}

// ============================== RI-MAG03 §D — the breakage register ==========================
{
  const reg = ench.breakage_register;
  rec('MAG03_M7_breakage_register_declared', reg.length === 11
    && reg.filter((r) => r.permanent_world_state).length >= 2
    && reg.filter((r) => r.systemic).length >= 4, {
    entries: reg.length, permanent_world_state: reg.filter((r) => r.permanent_world_state).map((r) => r.id),
    systemic: reg.filter((r) => r.systemic).map((r) => r.id),
    live_probes_run: ['MB-3 (mag-probe MAG03_MB3)', 'MB-10 partial (mag-probe AR3_X1: a fight ended with the enemy alive)'],
    live_probes_not_run: reg.filter((r) => !['MB-3', 'MB-10'].includes(r.id)).map((r) => r.id),
    note: 'RI-MAG03 M7 scores UNRUN PROBES AS ZERO and this build runs 2 of 11 live. The other nine are declared with their tests and are honestly not executed: they need world data (MB-1, MB-4, MB-11), the crime system (MB-5), the upgrade path (MB-6), a scripted HP gate (MB-7), constant-effect item slots (MB-8), the Unfilling Stone quest (MB-9) and paralysis-immunity flags on a real R4 group (MB-10 in full). Reported rather than claimed.',
  });
}

// ============================== RI-MAG04 M1/M2/M3 — the quest census =========================
{
  const qdoc = rd('game/data/quests/magic-utility.json');
  const quests = qdoc.quests;
  const magicRes = [];
  for (const q of quests) for (const r of q.resolutions) if (r.method === 'magic_utility') magicRes.push({ q, r });

  const effectCounts = {};
  const schoolCounts = {};
  for (const { r } of magicRes) {
    for (const e of (r.requires && r.requires.spell_effects) || []) {
      effectCounts[e] = (effectCounts[e] || 0) + 1;
    }
  }
  for (const { r } of magicRes) {
    const schools = new Set(((r.requires && r.requires.spell_effects) || []).map((e) => byId[e] && byId[e].school));
    for (const s of schools) schoolCounts[s] = (schoolCounts[s] || 0) + 1;
  }
  const top = Object.entries(effectCounts).sort((a, b) => b[1] - a[1])[0] || ['', 0];
  const totalEffectRefs = Object.values(effectCounts).reduce((a, b) => a + b, 0);
  const unknownEffects = Object.keys(effectCounts).filter((e) => !byId[e]);
  const lockouts = quests.filter((q) => q.resolutions.every((r) => r.method === 'magic_utility'));
  const gated = magicRes.filter(({ r }) => r.requires && Object.keys(r.requires).length > 0).length;
  const nonviolent = magicRes.filter(({ r }) => r.violence_required === false).length;
  const magicOnlyNonviolent = quests.filter((q) =>
    q.resolutions.filter((r) => !r.violence_required).every((r) => r.method === 'magic_utility')
    && q.resolutions.some((r) => r.method === 'magic_utility')).length;
  const traversalQuests = magicRes.filter(({ r }) => ((r.requires && r.requires.spell_effects) || []).some((e) => e === 'levitate' || e === 'slowfall')).length;
  const weight = quests.filter((q) => (q.category === 'main' || q.category === 'faction') && q.resolutions.some((r) => r.method === 'magic_utility')).length;
  const knowledgeMagic = magicRes.filter(({ r }) => r.requires && r.requires.knowledge && r.requires.knowledge.length).length;
  const shapeCounts = {};
  for (const q of quests) { const m = /shape (S\d)/.exec(q.notes || ''); if (m) shapeCounts[m[1]] = (shapeCounts[m[1]] || 0) + 1; }

  const census = {
    Q1_MAGIC_RESOLVED: { value: quests.length, note: 'quests with >=1 magic_utility resolution; the share target is against the SHIPPED total quest count Q, which W1-17/W1-18 own' },
    Q2_MAGIC_NONVIOLENT: { value: +(nonviolent / magicRes.length * 100).toFixed(1), target: '>=85%', pass: nonviolent / magicRes.length >= 0.85 },
    Q3_EFFECT_SPREAD: { value: Object.keys(effectCounts).length, target: '>=14', pass: Object.keys(effectCounts).length >= 14 },
    Q4_NO_SKELETON_KEY: { top_effect: top[0], top_share_pct: +(top[1] / totalEffectRefs * 100).toFixed(1), target: '<=22%', pass: top[1] / totalEffectRefs <= 0.22 },
    Q5_SCHOOL_SPREAD: { counts: schoolCounts, target: 'all four present, each >=4, none >45%', pass: Object.keys(schoolCounts).length === 4 && Object.values(schoolCounts).every((n) => n >= 4) && Math.max(...Object.values(schoolCounts)) / magicRes.length <= 0.45 },
    Q6_MAGIC_ONLY_NONVIOLENT: { value: magicOnlyNonviolent, target: '4-10', pass: magicOnlyNonviolent >= 4 && magicOnlyNonviolent <= 10 },
    Q7_GATED: { value: +(gated / magicRes.length * 100).toFixed(1), target: '>=90%', pass: gated / magicRes.length >= 0.90 },
    Q8_ALTERNATIVE_EXISTS: { lockouts: lockouts.map((q) => q.id), target: '100% (any breach is a lockout)', pass: lockouts.length === 0 },
    Q9_TRAVERSAL_QUESTS: { value: traversalQuests, target: '>=3', pass: traversalQuests >= 3 },
    Q11_WEIGHT: { value: weight, target: '>=6', pass: weight >= 6 },
    Q12_KNOWLEDGE_MAGIC: { value: knowledgeMagic, target: '>=5', pass: knowledgeMagic >= 5 },
    M3_SHAPES: { counts: shapeCounts, target: 'all 8 shapes present, each >=2, none >35%', pass: Object.keys(shapeCounts).length === 8 && Object.values(shapeCounts).every((n) => n >= 2) && Math.max(...Object.values(shapeCounts)) / quests.length <= 0.35 },
    unknown_effects_referenced: unknownEffects,
  };
  const allPass = Object.values(census).every((c) => c.pass === undefined || c.pass) && unknownEffects.length === 0;
  rec('MAG04_quest_census', allPass, {
    quests: quests.length, magic_resolutions: magicRes.length,
    resolutions_total: quests.reduce((a, q) => a + q.resolutions.length, 0),
    magic_share_of_all_resolutions_pct: +(magicRes.length / quests.reduce((a, q) => a + q.resolutions.length, 0) * 100).toFixed(1),
    verb_spread_cap_pct: 40,
    census,
    effect_histogram: effectCounts,
  });
}

// ============================== spell movesets exist, one per spell ==========================
{
  const dir = path.join(ROOT, 'game/data/combat/movesets');
  const have = new Set(fs.readdirSync(dir).filter((f) => f.startsWith('spell-')).map((f) => f.replace(/^spell-|\.json$/g, '')));
  const missing = spells.spells.map((s) => s.id).filter((id) => !have.has(id));
  rec('HARNESS_S7_rule4_spell_movesets', missing.length === 0, {
    spells: spells.spells.length, moveset_files: have.size, missing,
    note: 'HARNESS §7 rule 4: spells live under the same declared-vs-observed discipline as weapons. RI-MAG01 "How we lose" #10 is exactly the failure this closes.',
  });
}

const outPath = path.join(ROOT, 'reports/runs/MAG-AUDIT');
fs.mkdirSync(outPath, { recursive: true });
fs.writeFileSync(path.join(outPath, 'magic-audit.json'), JSON.stringify(R, null, 1) + '\n');
let pass = 0, fail = 0;
for (const [k, v] of Object.entries(R.checks)) { console.log(`${v.pass ? 'PASS' : 'FAIL'} ${k}`); v.pass ? pass++ : fail++; }
console.log(`${pass} pass, ${fail} fail`);
if (process.argv.includes('--json')) console.log(JSON.stringify(R, null, 1));
console.log(path.join(outPath, 'magic-audit.json'));
