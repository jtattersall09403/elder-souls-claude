#!/usr/bin/env node
/**
 * The two W1-18 engine seams the 2026-08-10 octopus c9603f64 reverted, applied as a guarded patch.
 *
 * WHY A PATCH AND NOT A RESTORE. `game/src/engine.js` has moved 41 commits since the revert and a
 * live agent holds UNCOMMITTED camera/doorstep work in it on this shared disk. Writing
 * `git show 9a0999fa:game/src/engine.js` over it would revert 1,122 lines of other people's work —
 * which is precisely the disease this re-integration repairs. So only the hunks W1-18 actually
 * added are applied, by anchor, against whatever the file says right now.
 *
 * WHAT IS DELIBERATELY NOT APPLIED. W1-18's own `eavesdrop()` and `examineCorpse()` method bodies.
 * HEAD already carries both in a LATER and better form — they check `n.pos`, use the live
 * `n.noticing` flag, and emit `input_action` through the bus, none of which W1-18's versions do.
 * Re-applying W1-18's would be a downgrade dressed as a recovery. Only the two seams that are
 * genuinely ABSENT at HEAD are applied:
 *
 *   A. `questEngine.awardGold` — the canonical purse writer. `sim/quest/machine.js` calls
 *      `this.awardGold(...)` and NOTHING assigns it at HEAD, so quest gold rewards silently fall
 *      back to writing `sim.progression.gold` directly, bypassing `_setGold()` — the one writer
 *      engine.js's own comment (line ~1230) says "every other purse in the build agrees on".
 *   B. `_eavesdropPending` — the input routing. Without it a crouched interact goes to `talkTo`,
 *      so the eavesdrop reveal channel has a reader and no way for a player to reach it.
 *
 * SAFETY, and each of these has cost this project real work before:
 *   - records the pre-edit md5 and prints it;
 *   - REFUSES to apply twice (exits 0, idempotent — a second run is a no-op, not a double edit);
 *   - REFUSES if any anchor is missing or appears more than once (exits 3);
 *   - never writes unless every anchor matched, so a partial application cannot happen;
 *   - `--check` reports what it would do and writes nothing.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const FILE = new URL('../../game/src/engine.js', import.meta.url).pathname;

const HUNKS = [
  {
    name: 'A: questEngine.awardGold — the canonical purse writer',
    anchor: "    this.questEngine = new QuestEngine(this.questBook, this.factionGates, this.data.quests['quest-hooks'], this.sim);",
    already: 'this.questEngine.awardGold',
    add: [
      '',
      '    // W1-18. Quest gold rewards go through the canonical purse writer so combat, magic,',
      '    // stealth and the UI all agree about what the player has. `sim/quest/quest machine`',
      '    // calls `this.awardGold(...)`; without this line it falls back to writing',
      '    // `sim.progression.gold` directly and bypasses `_setGold()`.',
      '    this.questEngine.awardGold = (amount) => this._setGold(this._gold() + Number(amount || 0));',
    ].join('\n'),
    where: 'after',
  },
  {
    name: 'B1: crouched interact routes to eavesdrop rather than talkTo',
    anchor: '        if (who) this._talkPending = who.eid;',
    already: '_eavesdropPending = who.eid',
    replace: [
      '        if (who) {',
      '          // W1-18. Crouched, you are listening rather than introducing yourself — which is',
      '          // the whole distinction the `eavesdrop` reveal channel rests on.',
      '          if (this.sim.stealth && this.sim.stealth.p.crouched) this._eavesdropPending = who.eid;',
      '          else this._talkPending = who.eid;',
      '        }',
    ].join('\n'),
    where: 'replace',
  },
  {
    name: 'B2: drain the pending eavesdrop beside the other pending interactions',
    anchor: '    if (this._propPending) this._takePropPending();',
    already: 'this._eavesdropPending = null',
    add: '    if (this._eavesdropPending) { const w = this._eavesdropPending; this._eavesdropPending = null; try { this.eavesdrop(w); } catch { /* they walked off */ } }',
    where: 'after',
  },
];

const check = process.argv.includes('--check');
let text = readFileSync(FILE, 'utf8');
const before = createHash('md5').update(text).digest('hex');
console.log(`w1-18-engine-hunks: ${FILE}`);
console.log(`  pre-edit md5 ${before}`);

const todo = [];
for (const h of HUNKS) {
  if (text.includes(h.already)) { console.log(`  SKIP  ${h.name} — already present`); continue; }
  const n = text.split(h.anchor).length - 1;
  if (n !== 1) {
    console.error(`  REFUSE ${h.name} — anchor occurs ${n} time(s), expected exactly 1. The file has moved; re-derive the hunk by hand.`);
    process.exit(3);
  }
  todo.push(h);
  console.log(`  APPLY ${h.name}`);
}

if (todo.length === 0) { console.log('  nothing to do — all hunks already present (idempotent no-op).'); process.exit(0); }
if (check) { console.log('  --check: nothing written.'); process.exit(0); }

for (const h of todo) {
  text = h.where === 'replace' ? text.replace(h.anchor, h.replace) : text.replace(h.anchor, `${h.anchor}\n${h.add}`);
}
writeFileSync(FILE, text);
console.log(`  post-edit md5 ${createHash('md5').update(text).digest('hex')}  (${todo.length} hunk(s) applied)`);
