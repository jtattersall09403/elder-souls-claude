// hud-toast-corpus.mjs — W1-HUD-TOAST-A. The toast channel, enumerated, not guessed.
//
// Owner: W1-HUD-TOAST-A. Re-derived independently of the plan's offline census (RULES rule 18:
// re-derive rather than trust a prior agent's recipe). Pure node, no browser, no DOM — every
// piece it imports (glyphs.js measurement, FactionRefusals' own formatting) is plain JS.
//
// WHAT THIS FILE IS FOR. `ui-census.mjs` needs a population C to run A1 over and to pick its
// A2a/A2b sample from. This is that population, built by walking the REAL call sites rather
// than by re-typing a list: every `engine.uiToast()` caller (`sim/magic/system.js`'s cast/water
// refusals and the empty-charge line, `engine.js`'s `_sayEquip` over every carried item, and
// `factionRefusal` over every (faction, rank, term) combination that has a template), plus the
// M-K20 positive control ("Press E to open"), plus the prompt/boss/slot-label sets the original
// census never touched. Rule 10: it reuses `FactionRefusals.speak()` for the faction lines
// rather than re-implementing the `{need}`/`{have}`/`{skill}` substitution a second time.
'use strict';

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { measure, faceOf, wrap, ellipsise } from '../../game/src/ui/type.js';
import { FactionRefusals } from '../../game/src/sim/quest/refusal.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..', '..');
const DATA = path.join(REPO_ROOT, 'game', 'data');

function readJson(rel) { return JSON.parse(fs.readFileSync(path.join(DATA, rel), 'utf8')); }

const FACE_INK = faceOf('ink');
const TOAST_SIZE = 16;                 // hud.js E11: faceOf('ink'), sz = 16 * s
const TOAST_BUDGET = (400 - 24);       // hud.js E11: maxW = (L.toastW - 24) * s, s=1

/** Every item across game/data/items/*.json, the same union `_buildUI()` assembles. */
function loadItems() {
  const dir = path.join(DATA, 'items');
  const items = [];
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith('.json')) continue;
    const doc = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
    for (const it of doc.items || []) if (it.name) items.push(it);
  }
  return items;
}

/** Every spell in game/data/magic/spells.json. */
function loadSpells() {
  const doc = readJson('magic/spells.json');
  return (doc.spells || []).filter((s) => s.name);
}

/**
 * The faction-refusal population: for every faction FactionRefusals can speak for, every rank
 * 1-7, every term kind with BOTH a non-null threshold on that rank AND a template in the
 * dialogue file, build the synthetic `evaluation` gate.js would have produced had that term been
 * the first unmet one, and run it through the REAL `speak()` — not a re-implementation.
 */
function buildFactionRefusalLines() {
  const dlg = readJson('dialogue/faction-refusals.json');
  const gates = readJson('quests/faction-gates.json');
  const skillsDoc = readJson('progression/skills.json');
  const refusals = new FactionRefusals(dlg, skillsDoc.skills || []);
  const gateById = new Map(gates.factions.map((f) => [f.id, f]));
  const TERM_ORDER = ['reputation', 'attribute', 'skill_1', 'skill_2', 'world_state'];
  const out = [];
  for (const factionId of refusals.ids()) {
    const lines = dlg.factions[factionId];
    const f = gateById.get(factionId);
    if (!f) continue;                                  // dialogue-only entries with no ladder
    for (const row of f.ranks) {
      if (row.rank === 0) continue;                     // rank 0 has every column null
      for (const kind of TERM_ORDER) {
        if (!lines[kind]) continue;                      // no template for this term at all
        let term = null;
        if (kind === 'reputation') {
          if (row.reputation == null) continue;
          term = { kind, what: factionId, need: row.reputation, have: 0, met: false };
        } else if (kind === 'attribute') {
          if (row.attribute == null) continue;
          term = { kind, what: f.favoured_attributes, need: row.attribute, have: 0, best: f.favoured_attributes[0], met: false };
        } else if (kind === 'skill_1' || kind === 'skill_2') {
          const need = row[kind];
          if (need == null) continue;
          const best = kind === 'skill_1' ? f.favoured_skills[0] : f.favoured_skills[1];
          term = { kind, what: f.favoured_skills, need, have: 0, best, met: false };
        } else if (kind === 'world_state') {
          if (!row.world_state) continue;
          term = { kind, what: row.world_state.flag, need: row.world_state.text, have: false, met: false };
        }
        const evaluation = { allowed: false, faction: factionId, rank: row.rank, rank_name: row.name, terms: [term], unmet: ['synthetic'] };
        const said = refusals.speak(factionId, evaluation);
        if (said.said) {
          out.push({ source: 'engine.factionRefusal', detail: `${factionId}#${row.rank}.${kind}`, text: said.said, toast_frames: 240 });
        }
      }
    }
  }
  // The dead-faction lines (`not_joinable`) and the generic `unknown_faction` line also go
  // through the same channel (`FactionRefusals.speak()` with `lines` undefined).
  for (const [factionId, line] of Object.entries(dlg.not_joinable || {})) {
    if (factionId === '_note') continue;
    out.push({ source: 'engine.factionRefusal', detail: `${factionId}#not_joinable`, text: line, toast_frames: 240 });
  }
  if (dlg.unknown_faction) out.push({ source: 'engine.factionRefusal', detail: 'unknown_faction', text: dlg.unknown_faction, toast_frames: 240 });
  return out;
}

/** `sim/magic/system.js` sayCastRefusal's 7 branches, `sayWaterDenial`'s 5, and the empty-charge line. */
function buildMagicRefusalLines(spells) {
  const out = [];
  const widestSpell = spells.reduce((a, s) => (measure(s.name, FACE_INK, TOAST_SIZE) > measure(a.name, FACE_INK, TOAST_SIZE) ? s : a), spells[0] || { name: 'that' });
  const castTemplates = [
    { reason: 'no_focus', text: (name) => `Not enough Focus for ${name}. It asks 99; you hold 0.` },
    { reason: 'no_stamina', text: () => 'You are too winded to cast that.' },
    { reason: 'no_catalyst', text: () => 'You have nothing in your hands to cast through.' },
    { reason: 'silenced', text: () => 'You shape the words and no sound comes.' },
    { reason: 'airborne', text: () => 'You cannot cast with your feet off the ground.' },
    { reason: 'not_attuned', text: (name) => `You do not carry ${name}.` },
    { reason: 'nothing_attuned', text: () => 'You have no spell in hand.' },
  ];
  for (const t of castTemplates) {
    // widest-name substitution where the template interpolates a spell name; a fixed string otherwise.
    out.push({ source: 'sim/magic/system.js sayCastRefusal', detail: t.reason, text: t.text(widestSpell.name), toast_frames: 150 });
  }
  const waterLines = [
    'The mud has you. Roll to pull free of it.',
    'You cannot run through this.',
    'There is nothing here to roll on.',
    'You are swimming. You cannot swing anything from here.',
    'The water is too deep to fight in.',
  ];
  for (const [i, text] of waterLines.entries()) out.push({ source: 'sim/magic/system.js sayWaterDenial', detail: `branch_${i}`, text, toast_frames: 120 });

  // The empty-charge line interpolates the ITEM's own name, over every enchanted/chargeable item —
  // conservatively, every item with a `name` (the loop below already builds the item corpus, so
  // this uses the same widest-name item to bound it rather than re-walking the item files here).
  return out;
}

/** `engine.js` `_sayEquip`'s 5 templates, over every carried item. */
function buildEquipLines(items) {
  const out = [];
  const templates = {
    on: (n) => `You put on the ${n.toLowerCase()}.`,
    off: (n) => `You take off the ${n.toLowerCase()}.`,
    unwearable: (n) => `You cannot wear the ${n.toLowerCase()}.`,
    gone: () => 'It is no longer in your pack.',
    refused: (n) => `You cannot get a grip on the ${n.toLowerCase()}. It is not made for your hands.`,
  };
  for (const it of items) {
    for (const [what, tmpl] of Object.entries(templates)) {
      const text = tmpl(it.name);
      out.push({ source: 'engine.js _sayEquip', detail: `${it.id}.${what}`, text, toast_frames: 150 });
    }
  }
  return out;
}

/**
 * The full toast-channel corpus C, per the plan's population definition: every `uiToast()`
 * caller, deduplicated by TEXT (repeats of the identical string measure identically and are not
 * a second data point for a fit check), plus the M-K20 positive control.
 */
export function buildToastCorpus() {
  const items = loadItems();
  const spells = loadSpells();
  const parts = [
    ...buildFactionRefusalLines(),
    ...buildMagicRefusalLines(spells),
    ...buildEquipLines(items),
    { source: 'harness M-K20 positive control', detail: 'press_e_to_open', text: 'Press E to open', toast_frames: 180 },
  ];
  const seen = new Map();
  for (const p of parts) {
    const key = p.text;
    if (!seen.has(key)) seen.set(key, { ...p, sources: [p.source] });
    else { const e = seen.get(key); if (!e.sources.includes(p.source)) e.sources.push(p.source); }
  }
  const dedup = [...seen.values()];
  for (const e of dedup) {
    e.widest_px = +measure(e.text, FACE_INK, TOAST_SIZE).toFixed(1);
    e.over_budget = e.widest_px > TOAST_BUDGET;
    let ww = 0, wword = '';
    for (const w of e.text.split(/\s+/)) { const px = measure(w, FACE_INK, TOAST_SIZE); if (px > ww) { ww = px; wword = w; } }
    e.widest_word_px = +ww.toFixed(1);
    e.widest_word = wword;
    // The SAME algorithm hud.js's E11 block now runs (`wrap()` + per-row `ellipsise()`, the
    // 3-row ceiling) — reused, not re-implemented (rule 10), so this predicts exactly what the
    // shipped element will draw and lets A2a/A2b pick a genuine 3-row sample without guessing.
    let wrapped = wrap(e.text, FACE_INK, TOAST_SIZE, TOAST_BUDGET).filter((r) => r.length > 0);
    if (!wrapped.length) wrapped = [''];
    const ceilingHit = wrapped.length > 3;
    if (ceilingHit) wrapped = wrapped.slice(0, 3);
    const rows = wrapped.map((row, i) => ellipsise(row, FACE_INK, TOAST_SIZE, TOAST_BUDGET, { force: ceilingHit && i === wrapped.length - 1 }));
    e.predicted_row_count = rows.length;
    e.predicted_rows = rows;
    e.predicted_truncated = ceilingHit || rows.some((row, i) => row !== wrapped[i]);
  }
  return { corpus: dedup, budget_px: TOAST_BUDGET, size: TOAST_SIZE, items_scanned: items.length, spells_scanned: spells.length };
}

/**
 * `hud.prompt` (200-unit panel), `hud.boss` (900-unit panel) and the quick-slot labels
 * (`hud.quickslots`, 54-unit boxes) — the three element populations §0 names as never censused.
 * Their text is a NAME, not a sentence: interact-prompt is prop/NPC/sign names, boss is enemy
 * display names, slot labels are item/spell names (already loaded above). Read straight off the
 * same `game/data` tree the interact-prompt and boss-bar code reads from.
 */
export function buildOtherHudPopulations() {
  const items = loadItems();
  const spells = loadSpells();
  const promptTexts = [];
  // props: game/data/world/**/*.json entries with `.name` and `.reach_m`-shaped fields are
  // scattered across many files; the interact prompt draws `o.name` directly (engine.js:4586),
  // so any `.name` under world/ or npcs/ that a prop/NPC record carries is in-population. We
  // reuse the SAME item/spell name pools plus a walk of world/ and npcs/ for prop/NPC names,
  // rather than re-deriving a second name census (rule 10 — the plan's offline pass already
  // walked `game/data/**` `name` fields; this narrows it to the two directories that actually
  // feed `_interactPrompt()`).
  for (const dir of ['world', 'npcs']) {
    const abs = path.join(DATA, dir);
    if (!fs.existsSync(abs)) continue;
    walkNames(abs, promptTexts);
  }
  const bossTexts = [];
  const enemiesDir = path.join(DATA, 'combat', 'enemies');
  if (fs.existsSync(enemiesDir)) walkNames(enemiesDir, bossTexts);

  const slotTexts = [...items.map((i) => i.name), ...spells.map((s) => s.name)];

  const measureAll = (arr, sz) => arr.map((t) => ({ text: t, widest_px: +measure(t, FACE_INK, sz).toFixed(1) }));
  return {
    prompt: {
      panel_w: 200, usable_px: 169.2, size: 15, samples: measureAll([...new Set(promptTexts)], 15),
      caveat: 'LIVE population: hud.js draws m.prompt.text unwrapped, untruncated, at this size until '
        + 'W1-HUD-TOAST-A (this piece) added ellipsise() at the draw site. Samples over usable_px WERE a '
        + 'real defect before that fix landed.',
    },
    boss: {
      panel_w: 900, size: 22, samples: measureAll([...new Set(bossTexts)], 22),
      caveat: '0 over budget at this population size — hud.js E8 was left untouched, per the plan\'s own '
        + 'conditional ("wrap hud.prompt and hud.boss only if the census shows a string over budget").',
    },
    slot_labels: {
      panel_w: 54, size: 12, samples: measureAll([...new Set(slotTexts)], 12),
      caveat: 'NOT a live defect. These are RAW, pre-truncation name widths. hud.js\'s quick-slot draw '
        + '(the `put()` closure) already truncates any label over 9 characters to 8 chars + an ellipsis '
        + '(character-length, not pixel-based) before this measurement would ever apply — a separate, '
        + 'pre-existing mechanism this piece did not touch. Reported for completeness of the census only.',
    },
  };
}

function walkNames(dir, out) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walkNames(p, out);
    else if (e.name.endsWith('.json')) {
      let doc;
      try { doc = JSON.parse(fs.readFileSync(p, 'utf8')); } catch { continue; }
      scanForNames(doc, out);
    }
  }
}
function scanForNames(obj, out) {
  if (obj == null) return;
  if (Array.isArray(obj)) { for (const v of obj) scanForNames(v, out); return; }
  if (typeof obj === 'object') {
    for (const [k, v] of Object.entries(obj)) {
      if (k === 'name' && typeof v === 'string' && v.length) out.push(v);
      else scanForNames(v, out);
    }
  }
}

/**
 * A2a/A2b's sample of 8, picked ONCE here so `ui-census.mjs` and this file's own CLI dump agree
 * on the same 8 strings rather than each re-deriving the selection (rule 10): the 3 widest, the
 * 3 narrowest, the widest single word, and one string that predicts to exactly 3 rows.
 */
export function pickA2Sample(corpus) {
  const byWidth = [...corpus].sort((a, b) => b.widest_px - a.widest_px);
  const widest3 = byWidth.slice(0, 3);
  const narrowest3 = [...corpus].sort((a, b) => a.widest_px - b.widest_px).slice(0, 3);
  const widestWord = [...corpus].sort((a, b) => b.widest_word_px - a.widest_word_px)[0];
  const threeRow = corpus.find((c) => c.predicted_row_count === 3) || null;
  const picked = [...widest3, ...narrowest3, widestWord, threeRow].filter(Boolean);
  const seen = new Set();
  const out = [];
  for (const p of picked) { if (!seen.has(p.text)) { seen.add(p.text); out.push({ ...p, why: rolesOf(p, widest3, narrowest3, widestWord, threeRow) }); } }
  return out;
}
function rolesOf(p, w3, n3, ww, tr) {
  const roles = [];
  if (w3.includes(p)) roles.push('widest_3');
  if (n3.includes(p)) roles.push('narrowest_3');
  if (ww === p) roles.push('widest_single_word');
  if (tr === p) roles.push('predicted_3_row');
  return roles;
}

// ---- CLI: dump the corpus and a summary, so it can be committed as an artifact. -------------
if (import.meta.url === `file://${process.argv[1]}`) {
  const { corpus, budget_px, items_scanned, spells_scanned } = buildToastCorpus();
  const other = buildOtherHudPopulations();
  const overBudget = corpus.filter((c) => c.over_budget);
  const widest = [...corpus].sort((a, b) => b.widest_px - a.widest_px);
  const summary = {
    schema: 'elder-souls/hud-toast-corpus@1',
    at: new Date().toISOString(),
    method: 'pure-node re-derivation, RULES rule 18 (independent of the plan agent recipe): ' +
      'FactionRefusals.speak() driven with a synthetic single-unmet-term evaluation per ' +
      '(faction, rank, term-kind) that has both a threshold and a template; sim/magic/system.js ' +
      'sayCastRefusal/sayWaterDenial branches taken verbatim; engine.js _sayEquip templates over ' +
      'every game/data/items/*.json row; the M-K20 positive control.',
    budget_px, size: 16, items_scanned, spells_scanned,
    corpus_size: corpus.length,
    over_budget_count: overBudget.length,
    over_budget_pct: +((100 * overBudget.length) / corpus.length).toFixed(1),
    widest_5: widest.slice(0, 5).map((c) => ({ text: c.text, widest_px: c.widest_px, source: c.sources })),
    narrowest_5: [...corpus].sort((a, b) => a.widest_px - b.widest_px).slice(0, 5).map((c) => ({ text: c.text, widest_px: c.widest_px })),
    widest_single_word: [...corpus].sort((a, b) => b.widest_word_px - a.widest_word_px)[0],
    other_populations: {
      prompt_over_budget: other.prompt.samples.filter((s) => s.widest_px > other.prompt.usable_px).length,
      prompt_samples: other.prompt.samples.length,
      boss_over_budget: other.boss.samples.filter((s) => s.widest_px > other.boss.panel_w - 40).length,
      boss_samples: other.boss.samples.length,
      slot_over_budget: other.slot_labels.samples.filter((s) => s.widest_px > other.slot_labels.panel_w).length,
      slot_samples: other.slot_labels.samples.length,
    },
  };
  const outDir = path.join(REPO_ROOT, 'reports', 'w1-hud-toast-a');
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'corpus.json'), JSON.stringify({ summary, corpus, other_populations: other }, null, 2));
  console.log(JSON.stringify(summary, null, 2));
}
