#!/usr/bin/env node
/**
 * uesp-infobox.mjs — wikitext template parser for the UESP extract.
 *
 * This is the load-bearing tool: UESP carries its structured data in
 * `{{Template|key=value|positional}}` infoboxes, so everything else
 * (quest census, world census, canon mining) is built on this parser.
 *
 * Library use:
 *   import { parseTemplates, findTemplate, stripWiki, links, loadExtract } from './uesp-infobox.mjs';
 *
 * CLI use:
 *   node uesp-infobox.mjs --title "Morrowind:The Code Book"
 *   node uesp-infobox.mjs --title "Morrowind:Balmora" --template "Place Summary"
 *   node uesp-infobox.mjs --template "Quest Header" --field Reward --limit 20
 *   node uesp-infobox.mjs --template "Quest Header" --count
 *
 * Extract path resolution order:
 *   1. --extract <path>
 *   2. $UESP_EXTRACT
 *   3. /tmp/uesp/extract.jsonl
 *   4. corpus/uesp_morrowind_blackmarsh_extract.jsonl.xz (auto-decompressed to /tmp/uesp/)
 *
 * NEVER decompress into the repo. The auto-path writes to /tmp/uesp/ only.
 */

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..', '..');
const TMP_DIR = '/tmp/uesp';
const TMP_EXTRACT = path.join(TMP_DIR, 'extract.jsonl');
const XZ_SOURCE = path.join(REPO_ROOT, 'corpus', 'uesp_morrowind_blackmarsh_extract.jsonl.xz');

/* ------------------------------------------------------------------ */
/* Extract loading                                                     */
/* ------------------------------------------------------------------ */

let _cache = null;

export function resolveExtractPath(explicit) {
  if (explicit) return explicit;
  if (process.env.UESP_EXTRACT) return process.env.UESP_EXTRACT;
  if (fs.existsSync(TMP_EXTRACT)) return TMP_EXTRACT;
  if (fs.existsSync(XZ_SOURCE)) {
    fs.mkdirSync(TMP_DIR, { recursive: true });
    // decompress to /tmp only — the repo disk allowance is fixed
    const out = fs.openSync(TMP_EXTRACT, 'w');
    try {
      execFileSync('xz', ['-dc', XZ_SOURCE], { stdio: ['ignore', out, 'inherit'], maxBuffer: 1 << 30 });
    } finally {
      fs.closeSync(out);
    }
    return TMP_EXTRACT;
  }
  throw new Error(`Cannot find UESP extract. Looked for ${TMP_EXTRACT} and ${XZ_SOURCE}.`);
}

/** Load all pages: [{title, ns, region, text}]. Cached per process. */
export function loadExtract(explicit) {
  if (_cache) return _cache;
  const p = resolveExtractPath(explicit);
  const raw = fs.readFileSync(p, 'utf8');
  _cache = raw.split('\n').filter(Boolean).map((l) => JSON.parse(l));
  return _cache;
}

/* ------------------------------------------------------------------ */
/* Template parsing                                                    */
/* ------------------------------------------------------------------ */

/**
 * Parse every top-level `{{...}}` template in `text`.
 * Nested templates are kept as raw text inside the parent's parameter values
 * and are also returned individually when `deep` is true.
 *
 * Returns: [{ name, params: {k:v}, positional: [v], raw, start, end }]
 *
 * Correctness notes — these are why a regex is not good enough:
 *  - `|` inside `[[Link|display]]` must not split a parameter.
 *  - `|` inside a nested `{{Tpl|a|b}}` must not split a parameter.
 *  - `|` inside a wikitable `{| ... |}` must not split a parameter.
 *  - the first `=` at depth 0 names a parameter; later `=` are part of the value.
 */
export function parseTemplates(text, { deep = false } = {}) {
  const out = [];
  if (!text) return out;
  for (let i = 0; i < text.length - 1; i++) {
    if (text[i] === '{' && text[i + 1] === '{') {
      const end = matchClose(text, i);
      if (end === -1) continue;
      const raw = text.slice(i, end);
      const tpl = parseOne(raw);
      if (tpl) {
        tpl.start = i;
        tpl.end = end;
        out.push(tpl);
        if (deep) {
          const inner = raw.slice(2, -2);
          for (const sub of parseTemplates(inner, { deep: true })) {
            sub.start += i + 2;
            sub.end += i + 2;
            out.push(sub);
          }
        }
      }
      i = end - 1; // skip past this template; nested handled by `deep`
    }
  }
  return out;
}

/** Find the index just past the `}}` that closes the `{{` at `start`. */
function matchClose(text, start) {
  let depth = 0;
  for (let i = start; i < text.length - 1; i++) {
    const two = text[i] + text[i + 1];
    if (two === '{{') { depth++; i++; continue; }
    if (two === '}}') { depth--; i++; if (depth === 0) return i + 1; continue; }
  }
  return -1;
}

function parseOne(raw) {
  const body = raw.slice(2, -2);
  const parts = splitTopLevel(body);
  if (!parts.length) return null;
  const name = parts[0].trim().replace(/\s+/g, ' ');
  if (!name) return null;
  const params = {};
  const positional = [];
  for (let i = 1; i < parts.length; i++) {
    const seg = parts[i];
    const eq = topLevelEq(seg);
    if (eq === -1) {
      positional.push(seg.trim());
    } else {
      const k = seg.slice(0, eq).trim();
      const v = seg.slice(eq + 1).trim();
      // repeated keys: keep first, stash the rest under k_2, k_3 ...
      if (k in params) {
        let n = 2;
        while (`${k}_${n}` in params) n++;
        params[`${k}_${n}`] = v;
      } else {
        params[k] = v;
      }
    }
  }
  return { name, params, positional, raw };
}

/** Split on `|` at nesting depth 0 (ignoring {{ }}, [[ ]], {| |}, <ref>…). */
function splitTopLevel(body) {
  const parts = [];
  let buf = '';
  let tdepth = 0; // {{ }}
  let ldepth = 0; // [[ ]]
  let bdepth = 0; // {| |}  (wikitables)
  for (let i = 0; i < body.length; i++) {
    const two = body[i] + (body[i + 1] || '');
    if (two === '{{') { tdepth++; buf += two; i++; continue; }
    if (two === '}}') { tdepth--; buf += two; i++; continue; }
    if (two === '{|') { bdepth++; buf += two; i++; continue; }
    if (two === '|}' && bdepth > 0) { bdepth--; buf += two; i++; continue; }
    if (two === '[[') { ldepth++; buf += two; i++; continue; }
    if (two === ']]') { ldepth--; buf += two; i++; continue; }
    if (body[i] === '|' && tdepth === 0 && ldepth === 0 && bdepth === 0) {
      parts.push(buf);
      buf = '';
      continue;
    }
    buf += body[i];
  }
  parts.push(buf);
  return parts;
}

function topLevelEq(seg) {
  let tdepth = 0, ldepth = 0, bdepth = 0;
  for (let i = 0; i < seg.length; i++) {
    const two = seg[i] + (seg[i + 1] || '');
    if (two === '{{') { tdepth++; i++; continue; }
    if (two === '}}') { tdepth--; i++; continue; }
    if (two === '{|') { bdepth++; i++; continue; }
    if (two === '|}' && bdepth > 0) { bdepth--; i++; continue; }
    if (two === '[[') { ldepth++; i++; continue; }
    if (two === ']]') { ldepth--; i++; continue; }
    if (seg[i] === '=' && tdepth === 0 && ldepth === 0 && bdepth === 0) return i;
  }
  return -1;
}

/** First template on the page whose name matches `name` (case-insensitive). */
export function findTemplate(text, name, opts = {}) {
  const want = String(name).toLowerCase();
  return parseTemplates(text, opts).find((t) => t.name.toLowerCase() === want) || null;
}

/** All templates on the page whose name matches `name`. */
export function findTemplates(text, name, opts = { deep: true }) {
  const want = String(name).toLowerCase();
  return parseTemplates(text, opts).filter((t) => t.name.toLowerCase() === want);
}

/* ------------------------------------------------------------------ */
/* Wikitext helpers                                                    */
/* ------------------------------------------------------------------ */

/** `[[Ns:Page|Display]]` → [{target, display}] */
export function links(text) {
  const out = [];
  if (!text) return out;
  const re = /\[\[([^\[\]|]+)(?:\|([^\[\]]*))?\]\]/g;
  let m;
  while ((m = re.exec(text))) {
    out.push({ target: m[1].trim(), display: (m[2] ?? m[1]).trim() });
  }
  return out;
}

/** Strip wikitext down to readable prose. Lossy on purpose. */
export function stripWiki(text) {
  if (!text) return '';
  let s = text;
  s = s.replace(/<ref[^>]*\/>/g, '');
  s = s.replace(/<ref[^>]*>[\s\S]*?<\/ref>/g, '');
  s = s.replace(/<!--[\s\S]*?-->/g, '');
  // drop templates (innermost-out) — several passes handles nesting
  for (let i = 0; i < 8; i++) {
    const next = s.replace(/\{\{[^{}]*\}\}/g, (m) => {
      // keep the display text of link-ish templates
      const mm = /^\{\{(?:Lore Link|Place Link|Quest Link|Item Link|Book Link|Effect Link|MW_SkillLink|Small|Nst|nst)\|([^|}]*)/i.exec(m);
      return mm ? mm[1] : '';
    });
    if (next === s) break;
    s = next;
  }
  s = s.replace(/\[\[(?:[^\[\]|]+)\|([^\[\]]*)\]\]/g, '$1');
  s = s.replace(/\[\[([^\[\]]+)\]\]/g, '$1');
  s = s.replace(/\[\[?[^\s\]]+\s+([^\]]*)\]\]?/g, '$1');
  s = s.replace(/<[^>]+>/g, '');
  s = s.replace(/'''''|'''|''/g, '');
  s = s.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"');
  s = s.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n');
  return s.trim();
}

/** Split page into { "Section Heading": "body" } using == headings ==. */
export function sections(text) {
  const out = { _lead: '' };
  if (!text) return out;
  const lines = text.split('\n');
  let cur = '_lead';
  for (const line of lines) {
    const m = /^\s*(={2,6})\s*(.+?)\s*\1\s*$/.exec(line);
    if (m) {
      cur = m[2].trim();
      if (!(cur in out)) out[cur] = '';
    } else {
      out[cur] = (out[cur] || '') + line + '\n';
    }
  }
  for (const k of Object.keys(out)) out[k] = out[k].trim();
  return out;
}

/** Parse `{| class="wikitable" ... |}` tables into arrays of row-cell arrays. */
export function wikitables(text) {
  const tables = [];
  if (!text) return tables;
  let i = 0;
  while (i < text.length - 1) {
    if (text[i] === '{' && text[i + 1] === '|') {
      let depth = 0, j = i;
      for (; j < text.length - 1; j++) {
        const two = text[j] + text[j + 1];
        if (two === '{|') { depth++; j++; continue; }
        if (two === '|}') { depth--; j++; if (depth === 0) { j++; break; } continue; }
      }
      tables.push(parseTable(text.slice(i, j)));
      i = j;
    } else i++;
  }
  return tables;
}

function parseTable(raw) {
  const rows = [];
  let cur = null;
  const lines = raw.split('\n');
  for (let k = 1; k < lines.length; k++) {
    const line = lines[k];
    if (/^\|\}/.test(line)) break;
    if (/^\|-/.test(line)) { if (cur) rows.push(cur); cur = []; continue; }
    if (/^[!|]/.test(line)) {
      if (!cur) cur = [];
      const sep = line[0];
      let body = line.slice(1);
      const cells = sep === '!' ? body.split('!!') : (body.startsWith('|') ? [body.slice(1)] : body.split('||'));
      for (const c of cells) cur.push(cleanCell(c));
    } else if (cur && cur.length) {
      cur[cur.length - 1] += '\n' + line;
    }
  }
  if (cur) rows.push(cur);
  return rows.filter((r) => r.length);
}

function cleanCell(c) {
  // drop leading attributes like align="center"|
  const m = /^\s*[a-zA-Z-]+\s*=\s*"[^"]*"\s*(?:[a-zA-Z-]+\s*=\s*"[^"]*"\s*)*\|(?!\|)/.exec(c);
  if (m) c = c.slice(m[0].length);
  return c.trim();
}

/* ------------------------------------------------------------------ */
/* CLI                                                                 */
/* ------------------------------------------------------------------ */

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

function main() {
  const o = argv();
  if (o.help) {
    console.log(fs.readFileSync(new URL(import.meta.url)).toString().split('*/')[0].replace(/^\/\*\*?/, ''));
    return;
  }
  const pages = loadExtract(o.extract);
  let subset = pages;
  if (o.title) subset = pages.filter((p) => p.title === o.title || p.title.toLowerCase() === String(o.title).toLowerCase());
  if (o.region) subset = subset.filter((p) => p.region === o.region);
  if (o.ns) subset = subset.filter((p) => p.ns === o.ns);

  const results = [];
  for (const p of subset) {
    const tpls = parseTemplates(p.text, { deep: !!o.deep });
    const picked = o.template
      ? tpls.filter((t) => t.name.toLowerCase() === String(o.template).toLowerCase())
      : tpls;
    if (!picked.length) continue;
    for (const t of picked) {
      if (o.field) {
        if (t.params[o.field] === undefined) continue;
        results.push({ title: p.title, template: t.name, [o.field]: t.params[o.field] });
      } else {
        results.push({ title: p.title, template: t.name, params: t.params, positional: t.positional });
      }
    }
  }
  if (o.count) { console.log(results.length); return; }
  const lim = o.limit ? Number(o.limit) : (o.title ? results.length : 50);
  console.log(JSON.stringify(results.slice(0, lim), null, 2));
}

if (import.meta.url === `file://${process.argv[1]}`) main();
