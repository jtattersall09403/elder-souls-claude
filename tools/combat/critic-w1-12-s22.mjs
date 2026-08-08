#!/usr/bin/env node
// W1-12 ROUND-1 CRITIC — the S22 unit audit, as a tool rather than as an assertion.
//
// ARBITRATION §2 S22 / §1 "I-frame accounting": "Write `f@60` for ours and `t@30` for a Souls
// tick — a bare frame count is a defect." The wave-0 rebase (`REBASE-S22-REPORT.md` §Job 1)
// moved and labelled fourteen reference items. **`RI-AI01` — the item this piece is built
// against — was not one of them.** Its §D transition table carries roughly twenty bare `f`
// figures whose unit has never been stated, and `game/data/combat/ai.json` copies several of
// them across verbatim.
//
// This tool does three things and refuses to guess:
//
//   1. Enumerates every frame-valued leaf `ai.json` ships and reports whether it carries a unit
//      anywhere a machine can read (a `unit` field, an `f@60`/`t@30` in the key, or an `f@60`
//      in the sibling `_note`).
//   2. For each, finds the `RI-AI01` row it came from and reports whether that row states a
//      SECONDS anchor. A seconds anchor pins the unit; a bare `f` does not, and a figure with
//      neither is a window of unknown length — it is either N/60 s or N/30 s and the corpus
//      does not say which.
//   3. Prints both readings side by side, so the size of the ambiguity is a number and not an
//      argument.
//
// It exits non-zero when any shipped frame figure has neither a unit nor a seconds anchor,
// which is the S22 defect stated as a check. Run it against a repaired ai.json and it goes
// green; that is what makes it an instrument and not a complaint.
'use strict';

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const AI_JSON = path.join(ROOT, 'game/data/combat/ai.json');
const ITEM = path.join(ROOT, 'corpus/10-combat/RI-AI01-aggro-approach-spacing.md');

const FRAME_KEY = /(_f|_frames|_frames_to_walk|_frames_to_sprint|_frames_to_stop)$/;

const src = fs.readFileSync(AI_JSON, 'utf8');
const ai = JSON.parse(src);
const item = fs.readFileSync(ITEM, 'utf8');

/** Every RI-AI01 §D row, as {id, condition, dwell, notes}. */
const rows = [];
for (const line of item.split('\n')) {
  const m = /^\|\s*(T\d\d)\s*\|([^|]*)\|([^|]*)\|([^|]*)\|([^|]*)\|([^|]*)\|/.exec(line);
  if (m) rows.push({ id: m[1], from: m[2].trim(), to: m[3].trim(), cond: m[4].trim(), dwell: m[5].trim(), note: m[6].trim() });
}

/** Does any RI-AI01 row that mentions this frame count also state a seconds anchor for it? */
function anchorFor(n) {
  const hits = [];
  for (const r of rows) {
    const blob = `${r.cond} ${r.dwell} ${r.note}`;
    if (!new RegExp(`(^|[^0-9])${n}\\s*f\\b`).test(blob) && !new RegExp(`(^|[^0-9])${n}\\s*[–-]`).test(blob)) continue;
    const secs = [...blob.matchAll(/([0-9]+(?:\.[0-9]+)?)\s*s\b/g)].map((x) => Number(x[1]));
    hits.push({ row: r.id, seconds: secs, blob });
  }
  return hits;
}

function walk(o, prefix, out) {
  for (const k of Object.keys(o)) {
    if (k.startsWith('_')) continue;
    const v = o[k];
    const p = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) walk(v, p, out);
    else if (FRAME_KEY.test(k) || /frames/.test(k)) out.push({ path: p, key: k, value: v });
  }
  return out;
}

const leaves = walk(ai, '', []);
console.log(`game/data/combat/ai.json declares no document-level \`unit\` field: ${ai.unit === undefined}`);
console.log(`(every shipped statblock does — e.g. game/data/combat/enemies/inf_trash.json "unit": "f@60")`);
console.log('');
console.log('path                                  value        unit?   at 60 Hz    if it were t@30   RI-AI01 seconds anchor');
console.log('-'.repeat(118));

let unanchored = 0;
const report = [];
for (const l of leaves) {
  const vals = Array.isArray(l.value) ? l.value : [l.value];
  // A unit is readable by a machine if it is in the key, or in a sibling `_note` for this key.
  const noteKey = `_${l.key.replace(/_f$|_frames$/, '')}_note`;
  const hasUnitInKey = /f@60|t@30/.test(l.key);
  const noteBlob = src.slice(Math.max(0, src.indexOf(`"${l.key}"`)), src.indexOf(`"${l.key}"`) + 600);
  const hasUnitNearby = /f@60|t@30/.test(noteBlob);
  const anchors = vals.flatMap((v) => anchorFor(v)).filter((h) => h.seconds.length);
  const anchored = anchors.length > 0;
  if (!hasUnitInKey && !hasUnitNearby && !anchored) unanchored++;
  const at60 = vals.map((v) => (v / 60).toFixed(2)).join('–');
  const at30 = vals.map((v) => (v / 30).toFixed(2)).join('–');
  const row = {
    path: l.path, value: l.value,
    unit_readable: hasUnitInKey || hasUnitNearby,
    seconds_at_60: at60, seconds_if_t30: at30,
    item_seconds_anchor: anchored ? [...new Set(anchors.map((a) => a.row))] : null,
    ambiguous: !hasUnitInKey && !hasUnitNearby && !anchored,
  };
  report.push(row);
  console.log(
    `${l.path.padEnd(37)} ${String(JSON.stringify(l.value)).padEnd(12)} ${(row.unit_readable ? 'yes' : 'NO ').padEnd(7)} ${(`${at60} s`).padEnd(11)} ${(`${at30} s`).padEnd(17)} ${row.item_seconds_anchor ? row.item_seconds_anchor.join(',') : 'NONE'}`);
}

console.log('');
console.log(`frame-valued leaves shipped: ${leaves.length}`);
console.log(`with NEITHER a machine-readable unit NOR a seconds anchor in RI-AI01: ${unanchored}`);
console.log('');
console.log('RI-AI01 is absent from the wave-0 S22 rebase list (REBASE-S22-REPORT.md §Job 1 names');
console.log('RI-CMB01, RI-CMB02, RI-CMB05, RI-CMB08, RI-AI02, RI-AI03, RI-WPN01-06, RI-CAM04).');
console.log('So the source of every figure above is itself unlabelled, and the ambiguity is real,');
console.log('not pedantic: an aggro roar is either a third of a second or two thirds of one.');

fs.mkdirSync(path.join(ROOT, 'reports/w1-12-critic'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'reports/w1-12-critic/s22.json'),
  JSON.stringify({ ai_json_has_unit_field: ai.unit !== undefined, leaves: report, unanchored }, null, 2));

process.exit(unanchored > 0 ? 1 : 0);
