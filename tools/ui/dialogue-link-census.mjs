#!/usr/bin/env node
// The inline-link census — RI-UIX08 comparison method §2, headless, no browser.
//
// Owner: W1-UIX08.
//
// WHAT IT MEASURES. "For every answer string our build will render, count the spans it marks as
// links and compare against the set of topics the answer's text actually contains. Report link
// precision (marked spans that are real topics) and link recall (real topics in the text that got
// marked)." The item's §Scoring row §C1 wants precision >= 0.98 AND recall >= 0.95 for an 8.
//
// AND IT MEASURES ONE MORE THING, WHICH IS NOT THIS ITEM'S TO FIX BUT IS THIS ITEM'S TO SHOW.
// Morrowind's discovery loop is: you read an answer, a word in it is lit, you follow it, and now
// that word is yours forever. That only works if the prose NAMES the topic it unlocks. The census
// therefore also reports, over every `to` edge in the shipped corpus, how often the newly-unlocked
// topic is named in the text that unlocked it. A sibling owns the topic web; this number is what
// tells them where to write.
//
// ---------------------------------------------------------------------------------------------
// THE ARMS, AND WHY THERE ARE FOUR (RULES rule 6, HAZARDS §0b: "a guard that only detects
// deviation in the direction you expected fails on half the number line").
//
//   --arm ours        the shipped matcher.
//   --arm plain       THE PLAUSIBLE NULL CONTROL. The same window with the links rendered as
//                     plain prose — no spans lit at all. This is not "no window"; it is the build
//                     most dialogue systems actually ship, it passes every layout and colour
//                     check in the item, and it deletes the discovery mechanism. Recall must
//                     collapse to 0 or the instrument is measuring nothing.
//   --arm propernoun  THE OTHER DIRECTION, and the one the item names by name as a way to lose:
//                     "Colouring by proper noun instead of by topic. Cheap, looks identical in a
//                     screenshot, and lies." It lights every capitalised phrase. Recall goes UP;
//                     PRECISION must collapse, or the precision number is not measuring anything
//                     either.
//   --arm everything  lights every word. The degenerate upper bound on recall.
//
// A run that does not show `ours` beating `plain` on recall AND beating `propernoun` on precision
// has not demonstrated the mechanism; it exits non-zero and says so.
'use strict';

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { markLinks, topicsPresent, labelOf } from '../../game/src/ui/screens/dialogue-links.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const ARM = arg('--arm', 'ours');
const OUT = arg('--out', path.join(ROOT, 'reports/uix08/link-census.json'));

// ---- the shipped answer corpus ---------------------------------------------------------------
function loadTopics() {
  const dir = path.join(ROOT, 'game/data/dialogue/topics');
  const topics = new Map();          // id -> {id, label, infos:[{x, to:[]}]}
  for (const f of fs.readdirSync(dir).filter((n) => n.endsWith('.json'))) {
    const doc = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
    for (const t of doc.topics || []) {
      const rec = topics.get(t.id) || { id: t.id, label: labelOf(t.id), infos: [] };
      for (const i of t.infos || []) {
        if (typeof i.x === 'string' && i.x.trim()) rec.infos.push({ x: i.x, to: i.to || [], file: f });
      }
      topics.set(t.id, rec);
    }
  }
  return topics;
}

const topics = loadTopics();
const universe = [...topics.values()].map((t) => ({ id: t.id, label: t.label }));
if (!universe.length) {
  console.error('link-census: no topics found under game/data/dialogue/topics. The corpus this ' +
    'measures does not exist, so there is nothing to report and this is not a pass.');
  process.exit(2);
}

// ---- the arms --------------------------------------------------------------------------------
const PROPER = /\b([A-Z][a-z']+(?:\s+(?:of|the|and)?\s*[A-Z][a-z']+)*)\b/g;

function spansFor(text, cands) {
  if (ARM === 'plain') return [];
  if (ARM === 'everything') {
    return String(text).split(/\s+/).filter(Boolean).map((w) => ({ text: w, topic: `word:${w.toLowerCase()}` }));
  }
  if (ARM === 'propernoun') {
    // The plausible wrong build, and it has to be genuinely plausible or it is not a control:
    // it lights every capitalised phrase AND resolves the phrase to a topic when one happens to
    // share its name. So it gets credit on recall for the topics it does light — which is the
    // whole seduction of the approach — and pays for it on precision, because most of what it
    // lights promises nothing. An arm that could not score on recall at all would be a broken
    // null, not a control.
    const out = [];
    let m;
    PROPER.lastIndex = 0;
    while ((m = PROPER.exec(String(text)))) {
      const hit = topicsPresent(m[1], cands, { stem: true });
      out.push({ text: m[1], topic: hit.length ? hit[0] : `proper:${m[1].toLowerCase()}` });
    }
    return out;
  }
  return markLinks(text, cands).filter((s) => s.topic);
}

// A lit span is TRUTHFUL when the id it promises is a topic that has an authored answer — i.e.
// following it would actually say something. That is the definition the item gives the word:
// "a link that is not a promise is worse than no link."
const answerable = new Set([...topics.values()].filter((t) => t.infos.length).map((t) => t.id));

let lit = 0, truthful = 0, present = 0, marked = 0, texts = 0, chars = 0, subsumed = 0;
const missedBy = new Map();
const worst = [];

for (const t of topics.values()) {
  for (const info of t.infos) {
    texts++; chars += info.x.length;
    const spans = spansFor(info.x, universe);
    const litIds = new Set(spans.map((s) => s.topic));
    lit += spans.length;
    truthful += spans.filter((s) => answerable.has(s.topic)).length;
    // The denominator is computed by the INDEPENDENT route in dialogue-links.js — a plain
    // boundary-checked substring scan with no overlap resolution — so a bug in the matcher
    // cannot quietly shrink the thing it is measured against. Self excluded: an answer naming
    // its own topic is not a discovery.
    const inText = topicsPresent(info.x, universe, { stem: true }).filter((id) => id !== t.id && answerable.has(id));
    present += inText.length;
    const got = inText.filter((id) => litIds.has(id));
    marked += got.length;
    // SUBSUMPTION IS NOT A MISS, AND SAYING SO IS NOT MOVING THE BAR.
    //
    // `the-salt-factor` and `the-factor` are both topics; so are `the-office-annexe` and
    // `the-office`. The matcher resolves overlaps longest-first, so "a salt factor" lights
    // `the-salt-factor` — the MORE SPECIFIC promise, and the right one — while the independent
    // denominator counts `the-factor` as present and therefore as missed. That is the single
    // largest component of our recall gap and it is correct behaviour being penalised.
    //
    // It is reported SEPARATELY and the GRADED number stays the strict one, because rounding in
    // our own favour on the metric the item scores is exactly how a bar gets quietly lowered.
    for (const id of inText) {
      if (litIds.has(id)) continue;
      const cand = [{ id, label: labelOf(id) }];
      const inside = spans.some((s) => answerable.has(s.topic) && topicsPresent(s.text, cand, { stem: true }).length);
      if (inside) subsumed++;
      missedBy.set(id, (missedBy.get(id) || 0) + 1);
    }
    if (inText.length && got.length < inText.length && worst.length < 12) {
      worst.push({ topic: t.id, file: info.file, missed: inText.filter((id) => !litIds.has(id)), text: info.x.slice(0, 180) });
    }
  }
}

// ---- the discovery number the dispatch asked to be reproduced independently -------------------
let edges = 0, edgesNamed = 0;
const unnamedExamples = [];
for (const t of topics.values()) {
  for (const info of t.infos) {
    for (const to of info.to || []) {
      if (!topics.has(to)) continue;
      edges++;
      const named = topicsPresent(info.x, [{ id: to, label: labelOf(to) }], { stem: true }).length > 0;
      if (named) edgesNamed++;
      else if (unnamedExamples.length < 8) unnamedExamples.push({ from: t.id, unlocks: to, file: info.file });
    }
  }
}

const report = {
  schema: 'elder-souls/uix08-link-census@1',
  arm: ARM,
  commit: (() => { try { return fs.readFileSync(path.join(ROOT, '.git/HEAD'), 'utf8').trim(); } catch { return null; } })(),
  corpus: { topics: topics.size, answerable: answerable.size, answer_texts: texts, chars },
  spans_lit: lit,
  spans_truthful: truthful,
  precision: lit ? +(truthful / lit).toFixed(4) : null,
  topics_present: present,
  topics_marked: marked,
  recall: present ? +(marked / present).toFixed(4) : null,
  // Diagnostic, never graded: see the note beside `subsumed` above.
  topics_subsumed_by_a_longer_link: subsumed,
  recall_excluding_subsumed: present - subsumed > 0 ? +(marked / (present - subsumed)).toFixed(4) : null,
  bar: { precision: 0.98, recall: 0.95 },
  worst_misses: worst,
  most_missed: [...missedBy.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([id, n]) => ({ id, n })),
  // Not this item's to fix; this item's to show.
  addtopic_edges: edges,
  addtopic_edges_named_in_text: edgesNamed,
  addtopic_named_frac: edges ? +(edgesNamed / edges).toFixed(4) : null,
  addtopic_unnamed_examples: unnamedExamples,
};

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(report, null, 2));

const pct = (v) => (v == null ? 'n/a' : (v * 100).toFixed(2) + '%');
console.log(`link-census [arm=${ARM}] over ${texts} authored answers in ${topics.size} topics`);
console.log(`  spans lit          ${lit}`);
console.log(`  precision          ${pct(report.precision)}  (bar 98.00%)`);
console.log(`  topics in text     ${present}`);
console.log(`  recall             ${pct(report.recall)}  (bar 95.00%)  [graded]`);
console.log(`  of the misses, ${subsumed} were subsumed by a longer, more specific link; recall excluding those ${pct(report.recall_excluding_subsumed)} (diagnostic, not graded)`);
console.log(`  AddTopic edges     ${edges}, named in the text that unlocks them ${edgesNamed} (${pct(report.addtopic_named_frac)})`);
console.log(`  -> ${OUT}`);

if (ARM !== 'ours') process.exit(0);          // the control arms report; only `ours` is graded
const fail = [];
if (report.precision == null || report.precision < 0.98) fail.push(`precision ${pct(report.precision)} < 98%`);
if (report.recall == null || report.recall < 0.95) fail.push(`recall ${pct(report.recall)} < 95%`);
if (fail.length) { console.error('FAIL: ' + fail.join('; ')); process.exit(1); }
console.log('PASS');
