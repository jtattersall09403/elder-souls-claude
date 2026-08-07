// gamedata.mjs — load the shipped game/data/** trees the way game/src/engine.js assembles them,
// so a static tool and the running game cannot drift.
//
// Written by W1-TOOLS to stop every new instrument re-deriving the same eight `rd()` lines.
// It loads DATA ONLY. Nothing here measures anything: RI-MTH07 is explicit that a tool which
// reads `regions.json` and reports on regions is measuring the design document, so every caller
// that makes a claim about behaviour must go to the browser for it. This module exists so the
// callers that legitimately walk shipped tables (RI-MTH06 §A names `build-viability.mjs` as a
// static walk, by contract) all walk the SAME tables.
'use strict';

import fs from 'node:fs';
import path from 'node:path';
import { DATA_DIR } from './cli.mjs';

export function rd(rel, root = DATA_DIR) {
  return JSON.parse(fs.readFileSync(path.join(root, rel), 'utf8'));
}
export function rdOpt(rel, fallback = null, root = DATA_DIR) {
  const p = path.join(root, rel);
  if (!fs.existsSync(p)) return fallback;
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return fallback; }
}

/** Every .json in a directory, keyed by basename without extension. Missing dir → {}. */
export function rdDir(rel, root = DATA_DIR) {
  const dir = path.join(root, rel);
  const out = {};
  if (!fs.existsSync(dir)) return out;
  for (const f of fs.readdirSync(dir).sort()) {
    if (!f.endsWith('.json')) continue;
    out[f.replace(/\.json$/, '')] = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
  }
  return out;
}

/** Recursive variant, keyed by path relative to `rel` with the extension stripped. */
export function rdTree(rel, root = DATA_DIR) {
  const base = path.join(root, rel);
  const out = {};
  if (!fs.existsSync(base)) return out;
  const walk = (d, prefix) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1))) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p, prefix + e.name + '/');
      else if (e.name.endsWith('.json')) {
        out[prefix + e.name.replace(/\.json$/, '')] = JSON.parse(fs.readFileSync(p, 'utf8'));
      }
    }
  };
  walk(base, '');
  return out;
}

/**
 * The `data.character` bundle game/src/character/*.js expects. Field names are engine.js's,
 * not this file's invention — `sheet.js` reads `data.races.races`, `data.reactions.upbringings`
 * and so on, and will throw loudly if this drifts.
 */
export function loadCharacterData(root = DATA_DIR) {
  return {
    attributes: rd('progression/attributes.json', root),
    skills: rd('progression/skills.json', root),
    races: rd('progression/races.json', root),
    classes: rd('progression/classes.json', root),
    birthsigns: rd('progression/birthsigns.json', root),
    reactions: rd('progression/race-reactions.json', root),
    creation: rd('progression/creation.json', root),
    levels: rdOpt('progression/levels.json', null, root),
    factions: rdOpt('progression/factions.json', null, root),
    creationQuestions: rdOpt('dialogue/creation-questions.json', null, root),
    encounters: rdOpt('world/encounters.json', null, root),
  };
}

/** Every quest record in the tree, flattened, each tagged with the file it came from. */
export function loadQuests(root = DATA_DIR) {
  const dir = path.join(root, 'quests');
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const f of fs.readdirSync(dir).sort()) {
    if (!f.endsWith('.json') || f.startsWith('.')) continue;
    const doc = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
    if (Array.isArray(doc.quests)) for (const q of doc.quests) out.push({ ...q, __file: f });
    else if (doc.stages && doc.id) out.push({ ...doc, __file: f });
  }
  return out;
}

/** The faction rank ladders. `quests/faction-gates.json` is the ladder of record; the two-entry
 *  `progression/factions.json` is a wave-0 skeleton and is returned separately, not merged. */
export function loadFactions(root = DATA_DIR) {
  const gates = rdOpt('quests/faction-gates.json', null, root);
  return {
    ladders: (gates && gates.factions) || [],
    exclusivity: (gates && gates.exclusivity) || null,
    skeleton: rdOpt('progression/factions.json', { factions: [] }, root),
  };
}

/** Enemy statblocks keyed by id. */
export function loadEnemies(root = DATA_DIR) {
  const out = {};
  for (const [, doc] of Object.entries(rdDir('combat/enemies', root))) {
    if (doc && doc.id) out[doc.id] = doc;
  }
  return out;
}

/** Weapon records keyed by id, from every file in game/data/weapons. */
export function loadWeapons(root = DATA_DIR) {
  const out = {};
  for (const [, doc] of Object.entries(rdDir('weapons', root))) {
    const list = Array.isArray(doc) ? doc : (doc.weapons || doc.items || []);
    for (const w of list) if (w && w.id) out[w.id] = w;
  }
  return out;
}

/** Every NPC record in game/data/npcs/**, flattened. */
export function loadNPCs(root = DATA_DIR) {
  const out = [];
  for (const [file, doc] of Object.entries(rdTree('npcs', root))) {
    const list = Array.isArray(doc) ? doc : (doc.npcs || doc.records || []);
    for (const n of list) if (n && typeof n === 'object') out.push({ ...n, __file: file });
  }
  return out;
}

/** Every dialogue topic record in game/data/dialogue/**, flattened. */
export function loadTopics(root = DATA_DIR) {
  const out = [];
  for (const [file, doc] of Object.entries(rdTree('dialogue', root))) {
    const list = Array.isArray(doc) ? doc : (doc.topics || doc.entries || doc.records || []);
    if (!Array.isArray(list)) continue;
    for (const t of list) if (t && typeof t === 'object') out.push({ ...t, __file: file });
  }
  return out;
}

/** Deep-walk any structure, yielding [pathString, value] for every leaf. */
export function* leaves(obj, prefix = '') {
  if (obj === null || typeof obj !== 'object') { yield [prefix, obj]; return; }
  if (Array.isArray(obj)) {
    for (let i = 0; i < obj.length; i++) yield* leaves(obj[i], `${prefix}[${i}]`);
    return;
  }
  for (const k of Object.keys(obj)) yield* leaves(obj[k], prefix ? `${prefix}.${k}` : k);
}

/** Deep-walk yielding every object node (not leaves), with its path. */
export function* nodes(obj, prefix = '') {
  if (obj === null || typeof obj !== 'object') return;
  yield [prefix, obj];
  if (Array.isArray(obj)) {
    for (let i = 0; i < obj.length; i++) yield* nodes(obj[i], `${prefix}[${i}]`);
    return;
  }
  for (const k of Object.keys(obj)) yield* nodes(obj[k], prefix ? `${prefix}.${k}` : k);
}
