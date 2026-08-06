#!/usr/bin/env node
/**
 * uesp-stats.mjs — aggregations over the UESP extract.
 *
 *   node uesp-stats.mjs overview                      # pages by ns / region
 *   node uesp-stats.mjs templates --limit 40          # most-used templates
 *   node uesp-stats.mjs templates --region BlackMarsh
 *   node uesp-stats.mjs fields "Quest Header"         # which params that template carries, how often
 *   node uesp-stats.mjs values "Quest Header" Reward --limit 30
 *   node uesp-stats.mjs pages-with "Morrowind Town Table"
 *   node uesp-stats.mjs grep "no need to kill" --region Morrowind
 *   node uesp-stats.mjs sizes --region BlackMarsh     # biggest pages
 *
 * All counts are over the extract as shipped; the extract itself is a filtered
 * snapshot of the 2019-11-07 UESP dump (see corpus/README.txt), so any figure
 * here is `community-data` about that snapshot, not a measurement of the game.
 */

import { loadExtract, parseTemplates } from './uesp-infobox.mjs';

function argv() {
  const a = process.argv.slice(2);
  const o = { _: [] };
  for (let i = 0; i < a.length; i++) {
    if (a[i].startsWith('--')) {
      const k = a[i].slice(2);
      const v = a[i + 1] && !a[i + 1].startsWith('--') ? a[++i] : true;
      o[k] = v;
    } else o._.push(a[i]);
  }
  return o;
}

const o = argv();
const cmd = o._[0] || 'overview';
const limit = o.limit ? Number(o.limit) : 30;

let pages = loadExtract(o.extract);
if (o.ns) pages = pages.filter((p) => p.ns === o.ns);
if (o.region) pages = pages.filter((p) => p.region === o.region);

const tally = (arr) => arr.reduce((m, k) => (m[k] = (m[k] || 0) + 1, m), {});
const top = (obj, n = limit) => Object.entries(obj).sort((a, b) => b[1] - a[1]).slice(0, n);
const print = (rows) => console.log(rows.map(([k, v]) => `${String(v).padStart(6)}  ${k}`).join('\n'));

switch (cmd) {
  case 'overview': {
    console.log('pages:', pages.length);
    console.log('\nby namespace:'); print(top(tally(pages.map((p) => p.ns)), 99));
    console.log('\nby region:'); print(top(tally(pages.map((p) => p.region)), 99));
    const bytes = pages.reduce((s, p) => s + p.text.length, 0);
    console.log(`\nwikitext bytes: ${bytes} (mean ${Math.round(bytes / pages.length)}/page)`);
    break;
  }
  case 'templates': {
    const counts = {};
    for (const p of pages) {
      for (const t of parseTemplates(p.text, { deep: true })) counts[t.name] = (counts[t.name] || 0) + 1;
    }
    print(top(counts));
    break;
  }
  case 'fields': {
    const name = o._[1];
    if (!name) { console.error('usage: fields "<Template Name>"'); process.exit(1); }
    const want = name.toLowerCase();
    const counts = {}; let n = 0;
    for (const p of pages) {
      for (const t of parseTemplates(p.text, { deep: true })) {
        if (t.name.toLowerCase() !== want) continue;
        n++;
        for (const k of Object.keys(t.params)) counts[k] = (counts[k] || 0) + 1;
        if (t.positional.length) counts[`(positional ×${t.positional.length})`] = (counts[`(positional ×${t.positional.length})`] || 0) + 1;
      }
    }
    console.log(`${n} instance(s) of {{${name}}}\n`);
    print(top(counts, 99));
    break;
  }
  case 'values': {
    const name = o._[1], field = o._[2];
    if (!name || !field) { console.error('usage: values "<Template>" <Field>'); process.exit(1); }
    const want = name.toLowerCase();
    const counts = {};
    for (const p of pages) {
      for (const t of parseTemplates(p.text, { deep: true })) {
        if (t.name.toLowerCase() !== want) continue;
        const v = t.params[field];
        if (v !== undefined) counts[v] = (counts[v] || 0) + 1;
      }
    }
    console.log(`${Object.keys(counts).length} distinct value(s) for ${name}.${field}\n`);
    print(top(counts));
    break;
  }
  case 'pages-with': {
    const name = o._[1];
    const want = String(name).toLowerCase();
    const hits = pages.filter((p) => parseTemplates(p.text, { deep: true }).some((t) => t.name.toLowerCase() === want));
    console.log(hits.slice(0, limit).map((p) => p.title).join('\n'));
    console.log(`-- ${hits.length} page(s) carry {{${name}}}`);
    break;
  }
  case 'grep': {
    const re = new RegExp(o._[1], 'gi');
    let total = 0; const perPage = [];
    for (const p of pages) {
      const m = p.text.match(re);
      if (m) { total += m.length; perPage.push([p.title, m.length]); }
    }
    print(perPage.sort((a, b) => b[1] - a[1]).slice(0, limit));
    console.log(`-- ${total} occurrence(s) across ${perPage.length} page(s)`);
    break;
  }
  case 'sizes': {
    print(pages.map((p) => [p.title, p.text.length]).sort((a, b) => b[1] - a[1]).slice(0, limit));
    break;
  }
  default:
    console.error(`unknown command "${cmd}". try: overview templates fields values pages-with grep sizes`);
    process.exit(1);
}
