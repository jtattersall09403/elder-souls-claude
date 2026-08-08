#!/usr/bin/env node
// critic-deploy-scan-coverage.mjs — what does tools/check-shipped-files.mjs's regex NOT see?
//
// The shipped scanner finds module specifiers with one regex over source text. A regex over
// source is an approximation of a parser, and the question a critic has to answer is not "is it
// an approximation" (it says so itself) but **which real edges of THIS tree fall outside it**.
// A miss only matters if it covers a file that could plausibly go untracked.
//
// So this does two things:
//   1. Runs the shipped SPEC regex, verbatim, over every game/**/*.js, and compares its answer
//      against a second, independent extractor that does not share its bounded-window design.
//      Any specifier the second finds and the first does not is a module the gate cannot protect.
//   2. Enumerates the non-`import` ways this tree names a file at runtime — `new URL(...,
//      import.meta.url)`, `fetch`, worker construction, and everything `index.html` references
//      directly — and reports which of those the scanner covers.
//
//   node tools/world/critic-deploy-scan-coverage.mjs
//   node tools/world/critic-deploy-scan-coverage.mjs --self-test
//
// Rule 4 self-test: the comparison must go red on a specifier it is supposed to catch. It plants
// a synthetic module whose import sits behind a >200-character binding list and requires the
// shipped regex to miss it and this tool to say so. If the shipped regex is ever widened, the
// self-test's "shipped misses it" arm flips and this tool reports that the finding is stale.
import { readdirSync, statSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..');
const GAME = join(ROOT, 'game');
const selfTest = process.argv.includes('--self-test');

// ---- the shipped regex, copied verbatim from tools/check-shipped-files.mjs -------------------
// Copied rather than imported because the tool is a script with top-level side effects; running
// it would run the gate. The copy is checked against the file on every run (below), so it cannot
// silently drift out of date — that check is the thing that makes this comparison honest.
const SPEC = /(?:^|\n)\s*(?:import|export)[\s\S]{0,200}?from\s*['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)/g;

const SHIPPED = join(ROOT, 'tools', 'check-shipped-files.mjs');
if (existsSync(SHIPPED)) {
  const src = readFileSync(SHIPPED, 'utf8');
  if (!src.includes(String(SPEC).slice(1, -2))) {
    console.error('critic-deploy-scan-coverage: the copied SPEC regex no longer appears in');
    console.error('  tools/check-shipped-files.mjs. This comparison is measuring a regex the');
    console.error('  gate does not use. Re-copy it before trusting any number below.');
    process.exit(2);
  }
}

function shippedSpecs(src) {
  const specs = [];
  let m;
  SPEC.lastIndex = 0;
  while ((m = SPEC.exec(src))) {
    const spec = m[1] || m[2];
    if (spec && (spec.startsWith('./') || spec.startsWith('../'))) specs.push(spec);
  }
  return specs;
}

// ---- an independent extractor ---------------------------------------------------------------
// Strips comments and template/string literals first, then reads import and export statements
// with no length bound at all. This is not a parser either, but it fails in different places
// than the shipped one does, which is the only property a control needs.
function stripNonCode(src) {
  let out = '';
  let i = 0;
  const n = src.length;
  let state = 'code';
  while (i < n) {
    const c = src[i], c2 = src.slice(i, i + 2);
    if (state === 'code') {
      if (c2 === '//') { state = 'line'; i += 2; continue; }
      if (c2 === '/*') { state = 'block'; i += 2; continue; }
      if (c === '`') { state = 'tpl'; out += '`'; i++; continue; }
      out += c; i++; continue;
    }
    if (state === 'line') { if (c === '\n') { state = 'code'; out += '\n'; } i++; continue; }
    if (state === 'block') { if (c2 === '*/') { state = 'code'; i += 2; } else { if (c === '\n') out += '\n'; i++; } continue; }
    if (state === 'tpl') { if (c === '\\') { i += 2; continue; } if (c === '`') { state = 'code'; out += '`'; } else if (c === '\n') out += '\n'; i++; continue; }
  }
  return out;
}

const IND = /(?:^|\n)[ \t]*(?:import|export)\b[^;]*?\bfrom\s*['"]([^'"]+)['"]|(?:^|\n)[ \t]*import\s*['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)/g;
function independentSpecs(src) {
  const code = stripNonCode(src);
  const specs = [];
  let m;
  IND.lastIndex = 0;
  while ((m = IND.exec(code))) {
    const spec = m[1] || m[2] || m[3];
    if (spec && (spec.startsWith('./') || spec.startsWith('../'))) specs.push(spec);
  }
  return specs;
}

function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const n of readdirSync(dir).sort()) {
    if (n === 'node_modules') continue;
    const p = join(dir, n);
    if (statSync(p).isDirectory()) walk(p, out); else out.push(p);
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
if (selfTest) {
  // A module whose specifier sits behind a binding list longer than the shipped regex's 200-char
  // window. The shipped extractor must miss it; the independent one must find it. If the first
  // arm flips, the gate has been widened and this tool's headline finding is stale — say so.
  const names = Array.from({ length: 40 }, (_, i) => `binding${i}`).join(',\n  ');
  const fixture = `import {\n  ${names}\n} from './deep/target.js';\n`;
  const a = shippedSpecs(fixture);
  const b = independentSpecs(fixture);
  const shippedMisses = !a.includes('./deep/target.js');
  const independentFinds = b.includes('./deep/target.js');

  // And the reverse arm: on an ordinary short import both must agree, or the "miss" list would
  // be full of noise from an extractor that simply disagrees with everything.
  const plain = `import { a } from './plain.js';\n`;
  const agree = shippedSpecs(plain).includes('./plain.js') && independentSpecs(plain).includes('./plain.js');

  console.log(`critic-deploy-scan-coverage --self-test:`);
  console.log(`  long-binding-list: shipped misses = ${shippedMisses}, independent finds = ${independentFinds}`);
  console.log(`  short import:      both agree      = ${agree}`);
  const ok = shippedMisses && independentFinds && agree;
  console.log(ok ? '  PASS — the comparison distinguishes a specifier the gate cannot see from one it can.'
                 : '  FAIL — either the gate was widened (finding stale) or this extractor is broken.');
  process.exit(ok ? 0 : 1);
}

const jsFiles = walk(GAME).filter((f) => /\.m?js$/.test(f));
const misses = [];
for (const file of jsFiles) {
  const src = readFileSync(file, 'utf8');
  const a = new Set(shippedSpecs(src));
  const b = independentSpecs(src);
  const rel = relative(ROOT, file).split('\\').join('/');
  for (const spec of new Set(b)) {
    if (a.has(spec)) continue;
    const target = resolve(dirname(file), spec);
    misses.push({
      importer: rel,
      spec,
      target: relative(ROOT, target).split('\\').join('/'),
      onDisk: existsSync(target),
    });
  }
}

console.log(`critic-deploy-scan-coverage: ${jsFiles.length} modules under game/.`);
console.log('');
console.log(`  A. Real relative imports the shipped regex does NOT extract: ${misses.length}`);
for (const m of misses) {
  console.log(`     ${m.target}${m.onDisk ? '' : '  (NOT ON DISK)'}`);
  console.log(`       imported by ${m.importer}  as '${m.spec}'`);
}
if (!misses.length) console.log('     (none)');

// ---- B. the non-import ways this tree names a file -------------------------------------------
const patterns = [
  ['new URL(..., import.meta.url)', /new\s+URL\s*\(\s*['"]([^'"]+)['"]\s*,\s*import\.meta\.url/g],
  ['fetch(<literal>)', /\bfetch\s*\(\s*['"]([^'"]+)['"]/g],
  ['new Worker/SharedWorker', /new\s+(?:Shared)?Worker\s*\(\s*[^)]*/g],
  ['audioWorklet.addModule', /addModule\s*\(\s*[^)]*/g],
  ['dynamic import(<computed>)', /import\(\s*(?!['"])[^)]{1,60}\)/g],
];
console.log('');
console.log('  B. Other ways a file is named at runtime, and whether the gate covers them:');
for (const [label, re] of patterns) {
  const hits = [];
  for (const file of jsFiles) {
    const src = readFileSync(file, 'utf8');
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(src))) hits.push(`${relative(ROOT, file).split('\\').join('/')}: ${String(m[0]).replace(/\s+/g, ' ').slice(0, 90)}`);
  }
  console.log(`     ${String(hits.length).padStart(3)}  ${label}  ${hits.length ? '— NOT covered by the gate' : ''}`);
  for (const h of hits.slice(0, 4)) console.log(`          ${h}`);
}

// ---- C. what game/index.html references directly ----------------------------------------------
const html = join(GAME, 'index.html');
if (existsSync(html)) {
  const src = readFileSync(html, 'utf8');
  const refs = [];
  const RE = /(?:src|href)\s*=\s*['"]([^'"]+)['"]/g;
  let m;
  while ((m = RE.exec(src))) refs.push(m[1]);
  console.log('');
  console.log(`  C. game/index.html references ${refs.length} path(s) directly. The gate scans .js only,`);
  console.log('     so every one of these is outside it:');
  for (const r of refs) {
    const p = resolve(GAME, r.replace(/^\.\//, ''));
    console.log(`     ${r}  ${existsSync(p) ? 'on disk' : 'NOT ON DISK'}`);
  }
  const inlineScripts = (src.match(/<script(?![^>]*\bsrc=)/g) || []).length;
  console.log(`     …and ${inlineScripts} inline <script> block(s), never scanned as source.`);
}
console.log('');
console.log('critic-deploy-scan-coverage: reported. Non-zero exit only means the SPEC copy drifted.');
