#!/usr/bin/env node
// Project the canon registry into the game, WITHOUT its answers.
//
// Owner: W1-23. Binding sources: RI-LOR06 §2 (the registry and its schema), RI-LOR06 §1.2
// (nothing in the game corrects a contradiction), RI-MTH07 / ARBITRATION §3 (CONSUMPTION),
// RI-WLD09 §B1 (the sealed-half convention this copies).
//
// `corpus/60-lore/data/canon-facts.json` is the authored registry and stays where it is: it is
// the writers' room's file and it holds the rulings. `game/data/lore/canon.json` is what the
// build gets, and the difference between the two is the point of this script.
//
// WHAT IS REMOVED, and why removal rather than a flag:
//
//   `authorially_true`   the ruling on which side of a dispute is right. Replaced by
//                        `truth_seal`, the sha256 of the ruling string. A critic proves the
//                        dispute was authored WITH a ruling by re-hashing the corpus half; the
//                        running game cannot state the ruling, because the characters are not
//                        in the build. RI-LOR06 §1.2 forbids the game from correcting a
//                        contradiction, and a rule that depends on nobody writing the wrong
//                        function is weaker than a rule that depends on the bytes being absent.
//   `notes`              writers' room commentary, frequently naming the answer in passing.
//   `sources_real`       real-world citations. Provenance is a corpus concern.
//
// WHAT IS KEPT: the claim, the tier, the dispute and its positions (id, in-world source, stance,
// who holds it in prose AND in machine form), the shipped sources that voice each position, the
// dialogue topics the dispute is argued on, and `player_discoverable`.
//
// `--check` verifies the shipped file is up to date without writing, for CI and for a builder
// who wants to know whether somebody else has moved the registry underneath them.
'use strict';

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const SRC = path.join(ROOT, 'corpus/60-lore/data/canon-facts.json');
const OUT = path.join(ROOT, 'game/data/lore/canon.json');

const sha = (s) => crypto.createHash('sha256').update(String(s), 'utf8').digest('hex');

/** Fields that never leave the corpus. */
const STRIPPED = new Set(['authorially_true', 'notes', 'sources_real', 'note', 'provenance', 'confidence']);

export function project(reg) {
  // W1-23 r2. `reg.truth_seal_salt` lives only in the corpus half (this function builds its own
  // top-level output object below and never spreads `reg` into it, so the salt cannot leak by
  // accident the way a field would if this just copied the source forward). Sealing on
  // `authorially_true` alone meant a bare-letter ruling — "A"/"B"/"C" — was invertible in three
  // guesses against the position ids the shipped file already publishes next to the seal: the W1-23
  // round-1 verdict recovered 9 of 26 that way. Folding the fact id and an unshipped salt into the
  // hash input closes that without touching the leak-scan below, which is a different, correctly
  // scoped check (verbatim prose inclusion, not brute-force seal inversion).
  const salt = typeof reg.truth_seal_salt === 'string' ? reg.truth_seal_salt : '';
  const facts = [];
  for (const f of reg.facts) {
    const out = {};
    for (const [k, v] of Object.entries(f)) {
      if (STRIPPED.has(k)) continue;
      out[k] = v;
    }
    if (f.disputed) {
      // A deliberately-open dispute has NO answer, so there is nothing to seal and saying so is
      // the honest signal. Anything else carries the hash of its ruling and not the ruling.
      out.truth_seal = f.deliberately_open ? null : sha(`${f.id}|${String(f.authorially_true)}|${salt}`);
      out.positions = (f.positions || []).map((p) => ({
        id: p.id,
        in_world_source: p.in_world_source || null,
        stance: p.stance || null,
        held_by: p.held_by || [],
        holders: p.holders || null,
        voiced_by: p.voiced_by || [],
      }));
    }
    facts.push(out);
  }
  const disputed = facts.filter((f) => f.disputed);
  return {
    schema: 'canon@1',
    id: 'canon',
    owner: 'W1-23',
    source: 'corpus/60-lore/data/canon-facts.json',
    generated_by: 'tools/lore/build-canon.mjs',
    what_this_is:
      'The province\'s canon, world-side. What is held true, what is argued about, and which '
      + 'shipped book or speaker takes which side. It carries NO ruling on who is right: '
      + '`authorially_true` is replaced by `truth_seal`, the sha256 of the ruling, which stays in '
      + 'the corpus. The game cannot adjudicate a dispute because the answer is not in the build.',
    sealed_half: 'corpus/60-lore/data/canon-facts.json `authorially_true` — never shipped, never quoted here',
    consumed_by: [
      'game/src/world/canon.js — CanonRegistry; built at boot from engine.data.canon',
      'game/src/engine.js _installCanon() — resolves every voiced_by source and every argued-on topic against the loaded data and THROWS on a dangle; installs the register on the conversation',
      'game/src/character/converse.js — infoFor() offers a line that claims a side of a dispute ONLY to a speaker the register says holds that side',
      'game/src/engine.js getCanonState() — the harness surface: which disputes this playthrough has heard argued, and from how many sides',
      'tools/lore/canon-census.mjs — the corpus-wide census (RI-LOR06 comparison method §4 and §5)',
      'tools/lore/build-canon.mjs — the only writer',
    ],
    id_scheme: {
      'CF-nnn': 'a canon fact',
      'CF-Dnnn': 'a registered dispute',
      'CF-Cnnn': 'our invention, binding on this project',
      voiced_by: 'book:<book id> | dialogue:<topic id>#<actor> | npc:<npc id>',
    },
    counts: {
      facts: facts.length,
      by_tier: facts.reduce((a, f) => { a[f.tier] = (a[f.tier] || 0) + 1; return a; }, {}),
      disputed: disputed.length,
      deliberately_open: disputed.filter((f) => f.deliberately_open).length,
      positions: disputed.reduce((a, f) => a + f.positions.length, 0),
      voiced_sources: disputed.reduce((a, f) => a + f.positions.reduce((b, p) => b + p.voiced_by.length, 0), 0),
      argued_on_topics: [...new Set(facts.flatMap((f) => f.topics || []))].length,
    },
    facts,
  };
}

function main(argv) {
  const reg = JSON.parse(fs.readFileSync(SRC, 'utf8'));
  const doc = project(reg);
  const text = `${JSON.stringify(doc, null, 2)}\n`;

  // Belt and braces: prove no ruling string survived the projection. A future edit that adds a
  // field carrying the answer would otherwise ship it silently, which is exactly the failure
  // mode the strip list is meant to close.
  const leaked = [];
  for (const f of reg.facts) {
    if (!f.disputed || f.deliberately_open) continue;
    const truth = String(f.authorially_true || '');
    const body = truth.replace(/^partial:/, '').trim();
    if (body.length >= 24 && text.includes(body.slice(0, 40))) leaked.push(`${f.id}: ruling text is present in the shipped file`);
  }
  if (leaked.length) { console.error(`build-canon: REFUSED to write.\n  - ${leaked.join('\n  - ')}`); return 1; }

  if (argv.includes('--check')) {
    const cur = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : '';
    if (cur === text) { console.log(`build-canon --check: up to date (${doc.counts.facts} facts, ${doc.counts.disputed} disputed)`); return 0; }
    console.error('build-canon --check: game/data/lore/canon.json is STALE. Run tools/lore/build-canon.mjs.');
    return 1;
  }

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, text);
  console.log(`wrote ${path.relative(ROOT, OUT)}`);
  console.log(`  facts ${doc.counts.facts}  disputed ${doc.counts.disputed}  positions ${doc.counts.positions}  voiced sources ${doc.counts.voiced_sources}  argued on ${doc.counts.argued_on_topics} topics`);
  console.log(`  rulings shipped: 0 (${doc.counts.disputed - doc.counts.deliberately_open} sealed, ${doc.counts.deliberately_open} deliberately open and therefore unsealed)`);
  return 0;
}

process.exit(main(process.argv.slice(2)));
