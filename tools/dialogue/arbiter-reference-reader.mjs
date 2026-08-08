// ARBITRATION S37 — the reference reader. NOT the engine; a reference implementation.
//
// This is `game/src/character/converse.js infoFor()` with the specificity score deleted and
// nothing else changed: same admissible set, same returned shape, same short-circuits. It exists
// for two reasons and neither is "to be imported by the game".
//
//   1. It is what makes `arbiter-order-divergence.mjs --gate` a gate rather than an assertion.
//      A gate that has only ever been seen red is half a gate; running the gate against this
//      module shows it green, so a future agent can trust the red.
//   2. It is the diff a builder implementing S37 has to land. The whole change is: delete the
//      score, take the first survivor. Everything else in `infoFor()` — the npc-own-line
//      short-circuit, `infoAllowed()`, the canon register, the `cell` prefix match, the actor
//      filter, and the entire return literal including `to` — is untouched, because under
//      Morrowind's rule all of those are FILTERS and only the CHOICE was ever in dispute.
//
// Do not import this from `game/src/`. When the engine yields, this file's body moves into
// `converse.js` and this file stays here as the thing the gate compares against.
'use strict';
import { buildTopicIndex, infoAllowed } from '../../game/src/character/converse.js';
import { topicKey } from '../../game/src/core/topics.js';

export { buildTopicIndex, infoAllowed };

// Morrowind filter field 6 — Cell — against the SPEAKER's place. Copied verbatim from
// converse.js, which does not export it.
function inCell(npc, cell) {
  if (!cell) return true;
  const want = String(cell).toLowerCase();
  for (const v of [npc.settlement, npc.cell, npc.interior, npc.home_interior, npc.work_interior]) {
    if (!v) continue;
    const s = String(v).toLowerCase();
    if (s === want || s.startsWith(want + '-') || s.startsWith(want + '.')) return true;
  }
  return false;
}
function lineKey(topicId) { return topicKey(topicId).split(' ').join('_'); }

/**
 * RI-DLG01 §A: "The engine walks the topic's INFO list top to bottom and returns the first entry
 * whose *entire* conjunction passes. It does **not** score specificity."
 */
export function infoFor(topicIndex, topicId, npc, player, canon = null) {
  const own = npc.lines ? npc.lines[lineKey(topicId)] : null;
  if (own) return { topic: topicId, actor: npc.actor || null, text: own, gated: false, source: 'npc', from: 'npc-own-line', to: [] };
  const t = topicIndex.get(topicKey(topicId));
  if (!t) return null;
  const actor = npc.actor || null;
  let best = null;
  for (const info of t.infos) {
    if (!infoAllowed(info, player)) continue;
    if (canon && !canon.allows(info, npc)) continue;
    if (info.cell && !inCell(npc, info.cell)) continue;
    const matchesActor = actor && info.a === actor;
    if (!matchesActor && info.a) continue;
    best = info;
    break;                      // <- the whole of S37
  }
  if (!best) return null;
  return {
    topic: topicId, actor: best.a || null, text: best.x,
    gated: !!(best.requires || best.forbids),
    source: best.a ? 'actor' : 'generic',
    from: best.from || null,
    cf: best.cf || null, pos: best.pos || null,
    cell: best.cell || null,
    to: Array.isArray(best.to) ? best.to.slice() : [],
  };
}
