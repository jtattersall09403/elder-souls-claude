#!/usr/bin/env node
// critic-w1-17 instrument 1 — an INDEPENDENT census of every filter field authored on every
// info in game/data/dialogue/topics/**, written without reading build-graph.mjs's own loader.
//
// It exists to settle W1-17's most consequential claim by itself: that `r` (Morrowind filter
// field 2, the Construction Set's own column name for Race) is authored on ZERO infos while the
// corpus writes the same gate as `requires.race` / `forbids.race`. If that is true then the
// pre-fix lint was blind to every race gate in the province and its 105 "unreachable infos"
// were a defect in the instrument. If it is false, 105 infos really are dead text.
//
// --break re-spells requires.race as `r` on load, which is what the corpus would look like if
// the builder's claim were wrong. The census must then report the opposite and exit 1.
'use strict';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : 'game/data/dialogue/topics');
const BREAK = process.argv.includes('--break');

const files = fs.readdirSync(ROOT).filter((f) => f.endsWith('.json')).sort();
const counts = new Map();
let infos = 0, topicRecords = 0, skipped = 0;
const perFile = [];

for (const f of files) {
  const doc = JSON.parse(fs.readFileSync(path.join(ROOT, f), 'utf8'));
  let fInfos = 0;
  for (const t of doc.topics || []) {
    if (!t || typeof t.id !== 'string') { skipped++; continue; }
    topicRecords++;
    for (const info of t.infos || []) {
      const rec = { ...info };
      if (BREAK && rec.requires && Array.isArray(rec.requires.race)) {
        rec.r = rec.requires.race.slice();
        const q = { ...rec.requires }; delete q.race;
        rec.requires = Object.keys(q).length ? q : undefined;
      }
      infos++; fInfos++;
      for (const k of Object.keys(rec)) {
        if (rec[k] === undefined) continue;
        counts.set(k, (counts.get(k) || 0) + 1);
        if (k === 'requires' || k === 'forbids') {
          for (const sub of Object.keys(rec[k] || {})) {
            const kk = `${k}.${sub}`;
            counts.set(kk, (counts.get(kk) || 0) + 1);
          }
        }
      }
    }
  }
  perFile.push([f, fInfos]);
}

const rows = [...counts.entries()].sort((a, b) => b[1] - a[1]);
console.log(`# critic-field-census over ${ROOT}`);
console.log(`# ${files.length} files, ${topicRecords} topic records, ${infos} infos, ${skipped} non-topic rows skipped`);
console.log(`# mode: ${BREAK ? 'BREAK (requires.race re-spelt as `r`)' : 'shipped'}`);
console.log('');
for (const [k, n] of rows) console.log(String(n).padStart(6), k);
console.log('');
for (const [f, n] of perFile) console.log(String(n).padStart(6), f);

const r = counts.get('r') || 0;
const rreq = counts.get('requires.race') || 0;
const rforb = counts.get('forbids.race') || 0;
console.log('');
console.log(`VERDICT  r=${r}  requires.race=${rreq}  forbids.race=${rforb}`);
if (BREAK) {
  if (r > 0) { console.log('BREAK ARM OK — the census sees `r` when `r` is authored.'); process.exit(1); }
  console.log('BREAK ARM FAILED — the census cannot see `r` at all; it is not measuring what it claims.');
  process.exit(2);
}
if (r === 0 && rreq + rforb > 0) {
  console.log('CONFIRMED — the CS column name `r` is authored nowhere; every race gate in the');
  console.log('province is spelt requires.race / forbids.race. A lint reading only `r` is blind to all of them.');
  process.exit(0);
}
console.log('REFUTED — `r` is authored; the builder\'s claim does not hold.');
process.exit(1);
