#!/usr/bin/env node
// gen-quest-knowledge.mjs — make every `requires.knowledge` key in the magic quests LEARNABLE.
//
// RI-JRN07 M-Q14 calls a knowledge gate that cannot be satisfied "decorative", and decorative is
// a hard fail: the gate exists, the resolution names it, and there is no path in the world by
// which a character can come to know it. `mag-quest.mjs` found three of them in the first ten
// magic resolutions it played — `chain_iron_from_stormhold`, `xanmeer_shelf_is_reachable` and
// their siblings are named by a resolution and revealed by nothing.
//
// `QuestEngine.reveal()` is the ONLY way `ctx.knowledge` gains a key, and it reads
// `def.deceit.revealed_by`. So this tool writes that list, derived from the keys the
// resolutions already reference — it invents no new gate, it gives the existing ones a door.
//
// The channel matters and is not decoration. Where the resolution that needs the key is itself
// `magic_utility`, the key is revealed by a MAGIC channel — `hist_sight` (the Hist shows you)
// or `speak_to_the_dead` (the corpse tells you) — which is RI-MAG04 §E X2's crossing made
// routine rather than special-cased: the thing that unlocks the magic route is itself magic.
//
// Run: node tools/analysis/gen-quest-knowledge.mjs [--check]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const check = process.argv.includes('--check');
const file = path.join(ROOT, 'game/data/quests/magic-utility.json');
const doc = JSON.parse(fs.readFileSync(file, 'utf8'));

let added = 0;
for (const q of doc.quests) {
  const keys = new Set();
  for (const r of q.resolutions || []) {
    for (const k of (r.requires && r.requires.knowledge) || []) keys.add(k);
    for (const k of r.requires_knowing || []) keys.add(k);
  }
  if (!keys.size) continue;
  const magicKeys = new Set();
  for (const r of q.resolutions || []) {
    if (r.method !== 'magic_utility') continue;
    for (const k of (r.requires && r.requires.knowledge) || []) magicKeys.add(k);
    for (const k of r.requires_knowing || []) magicKeys.add(k);
  }
  q.deceit = q.deceit || {};
  const have = new Set(((q.deceit.revealed_by) || []).map((x) => x.id));
  q.deceit.revealed_by = q.deceit.revealed_by || [];
  for (const k of [...keys].sort()) {
    if (have.has(k)) continue;
    const isMagic = magicKeys.has(k);
    q.deceit.revealed_by.push({
      id: k,
      channel: isMagic ? 'magic' : 'overheard',
      source: isMagic ? 'hist_sight' : (q.opens_by && q.opens_by.overheard_from && q.opens_by.overheard_from[0]) || (q.giver && q.giver.npc_id) || 'a stranger',
      also_revealed_by: isMagic
        ? [{ channel: 'document', source: 'a ledger, a stone, or somebody who was there' }]
        : [{ channel: 'magic', source: 'hist_sight' }],
      note: isMagic
        ? 'Revealed by casting `hist_sight` or `speak_to_the_dead` where it happened. The knowledge that opens the magic route is itself obtained by magic (RI-MAG04 §E X2) — and `also_revealed_by` is the mundane door to the identical fact, because RI-MAG04 Q8 forbids a quest completable only by a caster.'
        : 'Overheard, with a magical second door. Every knowledge gate has at least two channels; a gate with one is a lockout wearing a gate costume.',
    });
    added++;
  }
  // (RI-MAG04 Q8, no lockout, is handled on the SAME row: `also_revealed_by` is the mundane
  // door to the identical fact. It cannot be a second entry with the same id — `reveal()` keys
  // on the id and `QuestBook` rejects a reused one — and it must not be a second key, because
  // then the two doors would unlock different things.)
}

const text = JSON.stringify(doc, null, 2) + '\n';
if (check) {
  if (fs.readFileSync(file, 'utf8') !== text) { console.error('magic-utility.json knowledge reveals are stale'); process.exit(20); }
} else {
  fs.writeFileSync(file, text);
}
console.log(`[harness] ${added} knowledge reveal(s) written across ${doc.quests.length} magic quests`);
