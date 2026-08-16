#!/usr/bin/env node
// check-greeting-consumer.mjs — RI-MTH07 consumption gate for W1-DIALOGUE-AUTHORING-LEAK (P1).
//
// A corrected data file that nothing reads scores zero. This proves the fix REACHES a live,
// named NPC through the actual world-side reader (`greetingFor()` in
// `game/src/character/converse.js`), not just that the JSON text changed.
//
// Consumer named: `greetingFor()`, game/src/character/converse.js:63 — the function that
// chooses what an NPC says on greeting, keyed by (reaction group, live disposition band,
// player race class), deterministic per (npcId, nth).
//
// Live NPC named: `blackwood-company-factor` (Corvus Aldeyn), game/data/npcs/mainline.json —
// `reaction_group: "RG-BWC"`, `disposition: 25`, which is RI-CHR02 §4c's `cold` band
// (range [10,29]) — exactly the cell the leak lived in.
//
// Perturbation: run the SAME consumer over BOTH the pre-fix and post-fix authored source
// (`tools/dialogue/gen-greetings.mjs`, via git), and show the spoken line this named NPC can
// produce actually changes — the "drawn or spoken thing" the gate asks for.
//
// Usage: node tools/dialogue/check-greeting-consumer.mjs
'use strict';

import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';
import { execFileSync } from 'node:child_process';
import { greetingFor } from '../../game/src/character/converse.js';

const HERE = path.dirname(url.fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');

function loadNpc(id) {
  const doc = JSON.parse(fs.readFileSync(path.join(ROOT, 'game/data/npcs/mainline.json'), 'utf8'));
  const npc = (doc.npcs || []).find((n) => n.id === id);
  if (!npc) throw new Error(`NPC not found: ${id} (re-derive — do not trust this comment's claim)`);
  return npc;
}

function currentGreetingsData() {
  const greetings = JSON.parse(fs.readFileSync(path.join(ROOT, 'game/data/dialogue/greetings.json'), 'utf8'));
  return { greetings };
}

function speakAllSlots(data, npc) {
  // `pick()` in converse.js is a pure hash of (npcId, nth); sweep nth so every one of the
  // cell's 5 lines is reachable from THIS named NPC, not just whichever one the hash lands on
  // for nth=0.
  const lines = new Set();
  for (let nth = 0; nth < 20; nth++) {
    const g = greetingFor(data, {
      npcId: npc.id, reactionGroup: npc.reaction_group, disposition: npc.disposition,
      playerRace: 'imperial', nth,
    });
    if (g && g.line) lines.add(g.line);
  }
  return lines;
}

function main() {
  const npc = loadNpc('blackwood-company-factor');
  console.log(`consumer: greetingFor() <- game/src/character/converse.js`);
  console.log(`live NPC: ${npc.id} (${npc.name}), reaction_group=${npc.reaction_group}, disposition=${npc.disposition}`);

  const data = currentGreetingsData();
  const spoken = speakAllSlots(data, npc);
  console.log(`lines this NPC can speak in its cold-band cell (player race imperial), swept over 20 greet-counts:`);
  for (const l of spoken) console.log(`  - ${JSON.stringify(l)}`);

  const leaked = [...spoken].filter((l) => /say it in one line/i.test(l));
  const fixed = [...spoken].some((l) => /the writ says nothing about talk/i.test(l));

  if (leaked.length) {
    console.log(`\nFAIL: live NPC ${npc.id} can still speak the authoring-instruction leak: ${JSON.stringify(leaked)}`);
    process.exit(1);
  }
  if (!fixed) {
    console.log(`\nFAIL: live NPC ${npc.id} never speaks the corrected line in a 20-slot sweep — the fix does not reach this consumer.`);
    process.exit(1);
  }
  console.log(`\nPASS: live NPC ${npc.id} speaks the corrected line and never the leak, through the real greetingFor() consumer.`);

  // ---- perturbation: prove the OLD source really did produce the leak through this SAME
  // consumer, so the pass above is not vacuous. Reads the pre-fix source via git, not memory.
  let oldSource;
  try {
    oldSource = execFileSync('git', ['show', 'HEAD:tools/dialogue/gen-greetings.mjs'], { cwd: ROOT, encoding: 'utf8' });
  } catch (e) {
    console.log(`\n(perturbation skipped: could not read pre-fix HEAD copy — ${e.message})`);
    process.exit(0);
  }
  if (!/Say it in one line\./.test(oldSource)) {
    console.log('\n(perturbation skipped: HEAD already carries the fix, nothing to contrast against — this is expected once the fix itself is committed)');
    process.exit(0);
  }
  // Placed IN tools/dialogue/ (not repo root) so the copy's own `HERE` resolves exactly as
  // the real module's does; only the OUT path line is swapped so it cannot clobber the real
  // (already-fixed) greetings.json.
  const tmpGen = path.join(HERE, '.tmp-old-gen-greetings.mjs');
  const tmpOut = path.join(HERE, '.tmp-old-greetings.json');
  const patched = oldSource.replace(
    /const OUT = path\.resolve\(HERE, '\.\.\/\.\.\/game\/data\/dialogue\/greetings\.json'\);/,
    `const OUT = ${JSON.stringify(tmpOut)};`,
  );
  if (patched === oldSource) throw new Error('OUT-path substitution did not match — pre-fix source shape changed; fix this script, not the assumption.');
  fs.writeFileSync(tmpGen, patched);
  try {
    execFileSync(process.execPath, [tmpGen], { cwd: ROOT });
    const oldData = { greetings: JSON.parse(fs.readFileSync(tmpOut, 'utf8')) };
    const oldSpoken = speakAllSlots(oldData, npc);
    const oldLeaked = [...oldSpoken].some((l) => /say it in one line/i.test(l));
    console.log(`perturbation (pre-fix source, same consumer, same NPC): leak present = ${oldLeaked}`);
    if (!oldLeaked) {
      console.log('FAIL (self-test): the pre-fix source did NOT reproduce the leak through this consumer — the check cannot prove it caught anything.');
      process.exit(1);
    }
    console.log('Confirms the PASS above is a real before/after change reaching the consumer, not a check that could never fail.');
  } finally {
    for (const p of [tmpGen, tmpOut]) if (fs.existsSync(p)) fs.unlinkSync(p);
  }
}

main();
