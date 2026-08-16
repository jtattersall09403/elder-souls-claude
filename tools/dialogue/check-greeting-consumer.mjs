#!/usr/bin/env node
// check-greeting-consumer.mjs — RI-MTH07 consumption gate for W1-DIALOGUE-AUTHORING-LEAK (P1).
//
// A corrected data file that nothing reads scores zero. This proves the fix REACHES live,
// named NPCs through the actual world-side reader (`greetingFor()` in
// `game/src/character/converse.js`), not just that the JSON text changed.
//
// =========================================================================================
// ROUND 2 — THREE THINGS THE ROUND-1 VERSION GOT WRONG
// =========================================================================================
// 1. **It named ONE NPC and there were two.** Round 1 named `blackwood-company-factor`
//    (Corvus Aldeyn, disposition 25). The critic found a second live speaker of the same leak
//    that the round never mentioned — `blackwood-company-camp`, disposition 20, also inside
//    RI-CHR02 §4c's `cold` band [10,29]. A hand-named NPC list is a whitelist, and a whitelist
//    is a denylist of everything else (`HAZARDS` §31 rule 3). So this version **enumerates
//    every NPC in `game/data/npcs/**` and sweeps all of them**, across every player race class
//    and 20 greet-counts, and reports the census it derived. A third speaker cannot hide.
//
// 2. **Its perturbation arm was already dead.** It read the pre-fix generator with
//    `git show HEAD:tools/dialogue/gen-greetings.mjs`, so the moment the fix was committed
//    `HEAD` carried the fix, the arm printed *"(perturbation skipped)"* and the script exited
//    0 — permanently, with no negative control at all. The critic caught it in the verdict.
//    **The blob is now pinned by SHA** (`PRE_FIX_GEN_BLOB` below) to the exact pre-fix content,
//    so it keeps working no matter how far `HEAD` moves, and a missing blob is a **failure**,
//    not a skip.
//
// 3. **It tested the function, not the wiring** (round-1 control C). The engine's import and
//    call of `greetingFor` are now asserted via `tools/lib/call-site.mjs`.
//
// CONSUMER NAMED: `greetingFor()`, `game/src/character/converse.js` — the function that chooses
// what an NPC says on greeting, keyed by (reaction group, live disposition band, player race
// class), deterministic per (npcId, nth).
//
// PERTURBATION: run the SAME consumer over BOTH the pre-fix and post-fix generated greetings
// and show the lines these named NPCs can produce actually change — the "drawn or spoken thing"
// the gate asks for. The pre-fix generator is executed as a COPY with its output path
// redirected, so it can never write the shipped file (`HAZARDS` §31 rule 1).
//
// Exit codes: 0 pass · 1 a live NPC can still speak a leak, or the fix reaches nobody · 2 the
// perturbation (negative control) could not be run or did not reproduce the leak · 3 wiring.
//
// Usage: node tools/dialogue/check-greeting-consumer.mjs
'use strict';

import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';
import { execFileSync } from 'node:child_process';
import { greetingFor } from '../../game/src/character/converse.js';
import { assertCallSites, reportCallSites } from '../lib/call-site.mjs';

const HERE = path.dirname(url.fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');

// The pre-fix `gen-greetings.mjs` blob — the one whose STANCE['RG-BWC'].cold[3] is literally
// 'Say it in one line.'. Pinned by content SHA, NOT by a ref, because `HEAD:` moved past the
// fix within one commit and silently turned this check's only negative control into a no-op.
// Re-derive it if it ever needs replacing:
//   git rev-list --all -- tools/dialogue/gen-greetings.mjs \
//     | while read c; do git show "$c:tools/dialogue/gen-greetings.mjs" \
//         | grep -q 'Say it in one line' && git rev-parse "$c:tools/dialogue/gen-greetings.mjs" && break; done
// Derived by that command on 2026-08-16: four historical blobs carry the leak; this is the
// newest, from commit cdb2938b, and its line 197 reads
//   cold: ['Contract business only.', ..., 'Say it in one line.', "We are working."]
const PRE_FIX_GEN_BLOB = '8e778d4a616adb46376fa79e390e050fd37eb3d9';

const RACE_CLASSES = ['saxhleel', 'naga', 'dunmer', 'imperial', 'other-foreign'];

// The leak class this piece fixed, plus the generic writer's-brief shapes. Deliberately the
// same family as `check-authoring-leaks.mjs` PATTERNS, applied to what an NPC can SAY.
const LEAK = /\bsay it in one line\b|\bkeep it (short|brief|tight|concise)\b|\bplaceholder\b|\btodo\b|\bfixme\b|\blorem ipsum\b/i;
// The round-2 replacement for STANCE['RG-BWC'].cold[3]. Round 1's line ('The writ says nothing
// about talk.') was a correct fix that did not earn its faction: 25 of the 30 shipped lines
// containing `writ` belong to RG-LEDGER, the writ-house clerks. See gen-greetings.mjs.
const FIXED_LINE = /\bCompany time, and Leyawiin bought it\b/;

const CALL_SITES = [
  {
    file: 'game/src/engine.js',
    why: 'the engine must import the greeting reader — a consumer nothing calls is an orphan',
    must_contain: [/import\s*\{[^}]*\bgreetingFor\b[^}]*\}\s*from\s*'\.\/character\/converse\.js'/],
  },
  {
    file: 'game/src/character/converse.js',
    why: 'Conversation must actually call greetingFor() to produce the line an NPC speaks',
    must_contain: ['export function greetingFor(', 'greetingFor(this.data'],
  },
];

/** Every NPC in game/data/npcs/**, so no speaker can be missed by being un-named. */
function allNpcs() {
  const dir = path.join(ROOT, 'game/data/npcs');
  const out = [];
  for (const f of fs.readdirSync(dir).sort()) {
    if (!f.endsWith('.json')) continue;
    const doc = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
    for (const n of (doc.npcs || [])) out.push({ ...n, _file: `game/data/npcs/${f}` });
  }
  if (out.length === 0) throw new Error('no NPCs found under game/data/npcs — has the data layout moved?');
  return out;
}

function loadGreetings(file) {
  return { greetings: JSON.parse(fs.readFileSync(file, 'utf8')) };
}

/** Every line `npc` can speak on greeting, over all race classes and 20 greet-counts.
 * `pick()` in converse.js is a pure hash of (npcId, nth), so the sweep is what makes every
 * line in the cell reachable rather than whichever one nth=0 happens to land on. */
function speakAll(data, npc) {
  const lines = new Set();
  for (const race of RACE_CLASSES) {
    for (let nth = 0; nth < 20; nth++) {
      const g = greetingFor(data, {
        npcId: npc.id, reactionGroup: npc.reaction_group, disposition: npc.disposition,
        playerRace: race, nth,
      });
      if (g && g.line) lines.add(g.line);
    }
  }
  return lines;
}

/** Run the pinned pre-fix generator as a COPY with its output redirected. Returns the parsed
 * pre-fix greetings, or throws — never "skips". */
function buildPreFixGreetings() {
  let src;
  try {
    src = execFileSync('git', ['cat-file', 'blob', PRE_FIX_GEN_BLOB], { cwd: ROOT, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
  } catch (e) {
    throw new Error(`pinned pre-fix generator blob ${PRE_FIX_GEN_BLOB} is unreadable (${e.message}). `
      + 'Do NOT downgrade this to a skip — that is what left round 1 with no negative control. '
      + "Re-derive the blob with the command in this file's header and re-pin it.");
  }
  if (!/Say it in one line\./.test(src)) {
    throw new Error(`pinned blob ${PRE_FIX_GEN_BLOB} does not contain the leak — it is the wrong blob, so this control proves nothing.`);
  }
  // Placed IN tools/dialogue/ so the copy's own `HERE` resolves exactly as the real module's
  // does; only the OUT path is swapped, so it cannot clobber the real greetings.json.
  const tmpGen = path.join(HERE, '.tmp-prefix-gen-greetings.mjs');
  const tmpOut = path.join(HERE, '.tmp-prefix-greetings.json');
  const patched = src.replace(
    /const OUT = path\.resolve\(HERE, '\.\.\/\.\.\/game\/data\/dialogue\/greetings\.json'\);/,
    `const OUT = ${JSON.stringify(tmpOut)};`,
  );
  if (patched === src) throw new Error('OUT-path substitution did not match the pinned blob — fix this script, do not assume the redirect worked.');
  fs.writeFileSync(tmpGen, patched);
  try {
    execFileSync(process.execPath, [tmpGen], { cwd: ROOT, stdio: 'ignore' });
    return { data: loadGreetings(tmpOut), cleanup: () => { for (const p of [tmpGen, tmpOut]) if (fs.existsSync(p)) fs.unlinkSync(p); } };
  } catch (e) {
    for (const p of [tmpGen, tmpOut]) if (fs.existsSync(p)) fs.unlinkSync(p);
    throw e;
  }
}

function main() {
  const shipped = path.join(ROOT, 'game/data/dialogue/greetings.json');
  const beforeHash = fs.readFileSync(shipped);

  const npcs = allNpcs();
  const data = loadGreetings(shipped);
  console.log('consumer: greetingFor() <- game/src/character/converse.js');
  console.log(`census (derived this run): ${npcs.length} NPCs across game/data/npcs/**; `
    + `${npcs.filter((n) => n.reaction_group).length} carry a reaction_group.`);

  // ---- ARM 1: no live NPC anywhere can speak a leak ---------------------------------------
  const offenders = [];
  let spoken = 0;
  for (const npc of npcs) {
    if (!npc.reaction_group) continue;
    const lines = speakAll(data, npc);
    spoken += lines.size;
    for (const l of lines) if (LEAK.test(l)) offenders.push({ npc: npc.id, line: l });
  }
  console.log(`swept ${RACE_CLASSES.length} player race classes x 20 greet-counts per NPC: `
    + `${spoken} distinct (NPC, line) pairs reachable; ${offenders.length} carrying a leak.`);
  if (offenders.length) {
    for (const o of offenders) console.log(`  FAIL ${o.npc}: ${JSON.stringify(o.line)}`);
    console.log('\nFAIL: an authoring-instruction leak is still speakable by a live NPC.');
    process.exit(1);
  }

  // ---- ARM 2: the corrected line reaches the NPCs it was written for ------------------------
  const bwc = npcs.filter((n) => n.reaction_group === 'RG-BWC');
  console.log(`\nRG-BWC speakers found by census (NOT hand-listed): ${bwc.length}`);
  const reached = [];
  for (const npc of bwc) {
    const lines = [...speakAll(data, npc)];
    const has = lines.some((l) => FIXED_LINE.test(l));
    console.log(`  ${has ? 'ok  ' : 'FAIL'} ${npc.id} (${npc.name}) disposition=${npc.disposition} — `
      + `${lines.length} distinct lines; corrected line reachable = ${has}`);
    if (has) reached.push(npc.id);
  }
  if (reached.length !== bwc.length || bwc.length === 0) {
    console.log(`\nFAIL: the corrected line reaches ${reached.length} of ${bwc.length} RG-BWC speakers.`);
    process.exit(1);
  }

  // ---- ARM 3: the negative control, against a PINNED pre-fix blob ---------------------------
  let ctl;
  try {
    ctl = buildPreFixGreetings();
  } catch (e) {
    console.log(`\nFAIL (negative control): ${e.message}`);
    process.exit(2);
  }
  try {
    const preOffenders = [];
    for (const npc of bwc) for (const l of speakAll(ctl.data, npc)) if (LEAK.test(l)) preOffenders.push(npc.id);
    console.log(`\nperturbation (pinned pre-fix generator ${PRE_FIX_GEN_BLOB.slice(0, 12)}, same consumer, same NPCs):`);
    console.log(`  RG-BWC speakers that COULD speak the leak before the fix: ${[...new Set(preOffenders)].join(', ') || '(none)'}`);
    if (preOffenders.length === 0) {
      console.log('\nFAIL (negative control): the pre-fix source did NOT reproduce the leak through');
      console.log('this consumer, so the passes above prove nothing — this check could not fail.');
      process.exit(2);
    }
  } finally {
    ctl.cleanup();
  }

  // ---- ARM 4: the wiring ------------------------------------------------------------------
  if (!reportCallSites('check-greeting-consumer', assertCallSites(ROOT, CALL_SITES))) {
    console.log('\nFAIL: greetingFor() behaves correctly and the shipped engine does not wire it.');
    process.exit(3);
  }

  // ---- the HAZARDS §31 tripwire ------------------------------------------------------------
  if (!fs.readFileSync(shipped).equals(beforeHash)) {
    console.log('\nFAIL: this check modified game/data/dialogue/greetings.json while running.');
    console.log('HAZARDS §31 — a check that rewrites its own evidence cannot be believed.');
    process.exit(2);
  }

  console.log('\nPASS: no live NPC can speak the leak, both RG-BWC speakers reach the corrected');
  console.log('line, the pinned pre-fix control reproduces the defect, and the wiring is present.');
  process.exit(0);
}

main();
