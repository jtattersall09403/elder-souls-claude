#!/usr/bin/env node
/**
 * uesp-query.mjs — search the UESP extract by title, namespace, region or regex.
 *
 *   node uesp-query.mjs --title "Balmora"                 # title substring
 *   node uesp-query.mjs --title-re "^Morrowind:.*Guild$"  # title regex
 *   node uesp-query.mjs --ns Online --region BlackMarsh --list
 *   node uesp-query.mjs --re "xanmeer" --region BlackMarsh --context 120
 *   node uesp-query.mjs --title "Morrowind:Balmora" --text        # full wikitext
 *   node uesp-query.mjs --title "Morrowind:Balmora" --prose       # stripped prose
 *   node uesp-query.mjs --title "Morrowind:Balmora" --sections    # heading list
 *   node uesp-query.mjs --has-template "Place Summary" --list
 *   node uesp-query.mjs --re "Hist" --region BlackMarsh --count
 *
 * Flags: --ns --region --title --title-re --re (body regex) --i (ignore case, default on)
 *        --list (titles only) --count --json --limit N --context N --text --prose --sections
 */

import {
  loadExtract, stripWiki, sections, parseTemplates,
} from './uesp-infobox.mjs';

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
if (o.help) {
  console.log(`uesp-query.mjs — see header of the file for usage.
  --ns NS            Morrowind|Tribunal|Bloodmoon|Lore|Online|Stormhold|Arena
  --region R         Morrowind|BlackMarsh
  --title S          title substring (case-insensitive)
  --title-re RE      title regex
  --re RE            body regex
  --has-template T   page contains template T
  --list             print titles only
  --count            print number of matches
  --limit N          cap output (default 40)
  --context N        chars of context around --re match (default 100)
  --text|--prose|--sections   dump a page`);
  process.exit(0);
}

const pages = loadExtract(o.extract);
const ci = o.i === undefined ? 'i' : (o.i === 'false' ? '' : 'i');

let sel = pages;
if (o.ns) sel = sel.filter((p) => p.ns === o.ns);
if (o.region) sel = sel.filter((p) => p.region === o.region);
if (o.title) {
  const needle = String(o.title).toLowerCase();
  const exact = sel.filter((p) => p.title.toLowerCase() === needle);
  sel = exact.length ? exact : sel.filter((p) => p.title.toLowerCase().includes(needle));
}
if (o['title-re']) {
  const re = new RegExp(o['title-re'], ci);
  sel = sel.filter((p) => re.test(p.title));
}
if (o['has-template']) {
  const want = String(o['has-template']).toLowerCase();
  sel = sel.filter((p) => parseTemplates(p.text, { deep: true }).some((t) => t.name.toLowerCase() === want));
}
let bodyRe = null;
if (o.re) {
  bodyRe = new RegExp(o.re, ci + 'g');
  sel = sel.filter((p) => { bodyRe.lastIndex = 0; return bodyRe.test(p.text); });
}

if (o.count) { console.log(sel.length); process.exit(0); }

const limit = o.limit ? Number(o.limit) : 40;

if (o.text || o.prose || o.sections) {
  for (const p of sel.slice(0, limit)) {
    console.log(`===== ${p.title}  [${p.ns} / ${p.region}]`);
    if (o.sections) console.log(Object.keys(sections(p.text)).join('\n'));
    else if (o.prose) console.log(stripWiki(p.text));
    else console.log(p.text);
  }
  process.exit(0);
}

if (o.list) {
  console.log(sel.slice(0, limit).map((p) => p.title).join('\n'));
  console.log(`-- ${sel.length} match(es)${sel.length > limit ? `, showing ${limit}` : ''}`);
  process.exit(0);
}

if (o.json) {
  console.log(JSON.stringify(sel.slice(0, limit).map((p) => ({ title: p.title, ns: p.ns, region: p.region })), null, 2));
  process.exit(0);
}

// default: title + regex context snippets
const ctx = o.context ? Number(o.context) : 100;
for (const p of sel.slice(0, limit)) {
  console.log(`===== ${p.title}  [${p.ns} / ${p.region}]`);
  if (bodyRe) {
    bodyRe.lastIndex = 0;
    let m, n = 0;
    while ((m = bodyRe.exec(p.text)) && n < 5) {
      const s = Math.max(0, m.index - ctx), e = Math.min(p.text.length, m.index + m[0].length + ctx);
      console.log('  … ' + p.text.slice(s, e).replace(/\n/g, ' ⏎ ') + ' …');
      n++;
      if (m.index === bodyRe.lastIndex) bodyRe.lastIndex++;
    }
  } else {
    console.log('  ' + stripWiki(p.text).slice(0, 300).replace(/\n/g, ' '));
  }
}
console.log(`-- ${sel.length} match(es)${sel.length > limit ? `, showing ${limit}` : ''}`);
