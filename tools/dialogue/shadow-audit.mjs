// IS THE SHADOWED LINE DEAD, OR IS THE LINT WRONG ABOUT IT?
//
//   node tools/dialogue/shadow-audit.mjs
//   node tools/dialogue/shadow-audit.mjs --break     # RULES §4: forge a genuinely dead line first
//
// `tools/dialogue/build-graph.mjs` step 4 asks a question about the FILE: given Morrowind's
// first-match-in-authored-order rule, could INFO j ever be reached past INFO i? That question is
// worth asking, but it is a question about paperwork, and this project has been burned by
// paperwork answers (RI-MTH07 §3, and the eighteen models here with no reader). The question a
// player has is different and it is the only one that decides whether text is dead:
//
//     DOES ANYBODY, ANYWHERE IN THE PROVINCE, EVER SAY THIS SENTENCE TO ANY PLAYER?
//
// So this tool takes every shadow build-graph reports and answers that one instead, by running
// the SHIPPING reader (`game/src/character/converse.js infoFor()`) over the SHIPPING roster
// (`game/data/npcs/**`, 347 people) and the four probe players in `answer-census.mjs`, and
// checking whether the shadowed info's own text ever comes back.
//
//   * text never returned  -> the line IS dead. Hard fail. That is a defect in the data and no
//                             argument about ordering models rescues it.
//   * text returned        -> the line is heard. The lint's first-match model disagrees with our
//                             reader's specificity model, and the report says WHO says it, so the
//                             claim is checkable rather than asserted.
//
// This can fail, and `--break` proves it: it inserts a genuinely unreachable info — a line
// carrying the same gates as the one above it, which therefore ties on score and loses the
// `score > bestScore` tie-break forever — and the audit must report it dead.
'use strict';
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';
import { execFileSync } from 'node:child_process';
import { buildTopicIndex, infoFor } from '../../game/src/character/converse.js';
import { loadTopicDocs, loadNpcs, PLAYERS } from './answer-census.mjs';

const HERE = path.dirname(url.fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');
const BREAK = process.argv.includes('--break');

function shadows() {
  const out = path.join(ROOT, 'reports/w1-17/graph');
  // build-graph exits 1 while ANY of its three counts is non-zero — dangling edges and orphans
  // included — and neither of those is this tool's business. The metrics file is written before
  // the exit, so read it and let the caller's own gate be the gate.
  try {
    execFileSync(process.execPath, [path.join(ROOT, 'tools/dialogue/build-graph.mjs'), '--out', out],
      { cwd: ROOT, stdio: ['ignore', 'ignore', 'ignore'] });
  } catch { /* non-zero is expected while the graph has other faults */ }
  return JSON.parse(fs.readFileSync(path.join(out, 'metrics.json'), 'utf8')).unreachable_infos;
}

function main() {
  let docs = loadTopicDocs();
  const npcs = loadNpcs();

  // --break: give one topic a line that genuinely cannot be reached. It carries the SAME gates
  // as the info above it and DIFFERENT words, so it ties on `infoFor()`'s score and loses the
  // `score > bestScore` tie-break to that info forever. If this audit cannot see that, it cannot
  // see anything.
  //
  // The first attempt at this forgery was a byte-copy of the info above it, and the audit called
  // it HEARD — correctly, and uselessly: the audit matches on TEXT, and the copy's text is spoken
  // by the original every day. That is a real limit on what this instrument can see (it finds
  // dead SENTENCES, not dead records) and it is written down here rather than quietly fixed,
  // because a probe whose blind spot is undocumented is the failure mode this file is about.
  let forged = null;
  if (BREAK) {
    for (const doc of docs) {
      for (const t of doc.topics || []) {
        if (t.infos && t.infos.length && t.infos[0].x) {
          const twin = { ...JSON.parse(JSON.stringify(t.infos[0])), x: 'FORGED: nobody in the province can reach this sentence.' };
          forged = { topic: t.id, text: twin.x };
          t.infos.splice(1, 0, twin);
          break;
        }
      }
      if (forged) break;
    }
    console.log(`--break: added a same-gate twin under '${forged.topic}' — it must come back DEAD.\n`);
  }

  const idx = buildTopicIndex(docs);
  const spoken = new Set();
  for (const npc of npcs) for (const p of PLAYERS) for (const t of idx.values()) {
    const r = infoFor(idx, t.id, npc, p);
    if (r && r.text) spoken.add(r.text);
  }

  const rows = BREAK
    ? [{ topic: forged.topic, text: forged.text, synthetic: true }]
    : shadows().map((s) => {
      const t = idx.get(require_key(s.topic));
      const info = t && t.infos ? t.infos[s.shadowed] : null;
      return { topic: s.topic, text: info ? info.x : null, filter: s.shadowed_filter };
    });

  let dead = 0;
  for (const r of rows) {
    if (!r.text) { console.log(`? ${r.topic} — could not resolve the shadowed info`); dead++; continue; }
    const heard = spoken.has(r.text);
    if (!heard) dead++;
    console.log(`${heard ? 'HEARD' : 'DEAD '}  ${r.topic}${r.filter ? '  ' + JSON.stringify(r.filter) : ''}`);
    console.log(`        "${String(r.text).slice(0, 120)}"`);
    if (heard) {
      const who = [];
      for (const npc of npcs) { for (const p of PLAYERS) { const x = infoFor(idx, r.topic, npc, p); if (x && x.text === r.text) { who.push(`${npc.id}/${p.id}`); break; } } if (who.length >= 3) break; }
      console.log(`        said by: ${who.join(', ')}`);
    }
  }
  console.log(`\n${rows.length} shadow(s) audited against the shipped reader; ${dead} genuinely unreachable.`);
  if (BREAK) {
    if (dead === 1) { console.log('BREAK CONFIRMED: the audit reports the forged line dead.'); process.exit(0); }
    console.error('BREAK FAILED: the audit could not see a line nobody can reach. It is not an instrument.');
    process.exit(2);
  }
  if (dead) { console.error(`FAIL: ${dead} authored line(s) that nobody in the province can ever say.`); process.exit(1); }
}

// The index is keyed by the folded spelling; build-graph reports the authored one.
function require_key(id) { return String(id).toLowerCase().replace(/[‘’'`]/g, '').replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim(); }

if (import.meta.url === url.pathToFileURL(process.argv[1] || '').href) main();
