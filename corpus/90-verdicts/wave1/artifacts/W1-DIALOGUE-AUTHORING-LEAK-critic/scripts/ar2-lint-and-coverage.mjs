// AR-2 (RI-DLG03 step 7 diegetic lint) + the coverage measurements behind the biggest gap.
import fs from 'node:fs'; import path from 'node:path';
const R = '/home/user/elder-souls-claude/';
function walk(d, o = []) { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); if (fs.statSync(p).isDirectory()) walk(p, o); else if (f.endsWith('.json')) o.push(p); } return o; }

// ---- AR-2 / RI-DLG03 step 7, verbatim regex from the item, and a word-anchored reading ----
const LIT = /\b(quest|objective|marker|waypoint|your (map|journal|compass)|coordinates?|[0-9]+ ?(m|metres|meters|yards)\b|head (north|south|east|west) [0-9])/i;
const ANC = /\b(quests?|objectives?|markers?|waypoints?|your (map|journal|compass)|coordinates?|[0-9]+ ?(m|metres|meters|yards)\b|head (north|south|east|west) [0-9])\b/i;
let lit = 0, anc = 0, checked = 0; const ancHits = [];
for (const f of [...walk(R + 'game/data/dialogue/greetings'), R + 'game/data/dialogue/greetings.json', R + 'game/data/dialogue/rumours.json']) {
  const d = JSON.parse(fs.readFileSync(f, 'utf8'));
  (function rec(v, kp, key) {
    if (typeof v === 'string') { if (/^(x|lines|line)$/.test(key)) { checked++; if (LIT.test(v)) lit++; if (ANC.test(v)) { anc++; ancHits.push([f.replace(R, ''), kp, v.slice(0, 110)]); } } return; }
    if (Array.isArray(v)) v.forEach((x, i) => rec(x, kp + '[' + i + ']', key)); else if (v && typeof v === 'object') for (const k of Object.keys(v)) rec(v[k], kp + '.' + k, k);
  })(d, '', '');
}
console.log('=== AR-2 / RI-DLG03 step-7 diegetic lint ===');
console.log('greeting+rumour lines checked :', checked);
console.log('item regex as written         :', lit, 'hits  <-- unanchored: \\b(quest|... matches "question"');
console.log('word-anchored reading         :', anc, 'hits');
for (const h of ancHits) console.log('   ', h[0], h[1], JSON.stringify(h[2]));

// ---- coverage of the standing check (the biggest gap's numbers) ----
const TEXT_KEYS = new Set(['lines', 'line', 'text', 'x', 'greeting', 'a']);
let all = 0, inGreetings = 0;
function count(v, key, bump) { if (typeof v === 'string') { if (TEXT_KEYS.has(key)) bump(); } else if (Array.isArray(v)) v.forEach(x => count(x, key, bump)); else if (v && typeof v === 'object') for (const k of Object.keys(v)) count(v[k], k, bump); }
for (const d of ['game/data/dialogue', 'game/data/books']) for (const f of walk(R + d)) { try { count(JSON.parse(fs.readFileSync(f, 'utf8')), '', () => all++); } catch (e) { } }
count(JSON.parse(fs.readFileSync(R + 'game/data/dialogue/greetings.json', 'utf8')), '', () => inGreetings++);
const fr = JSON.parse(fs.readFileSync(R + 'game/data/dialogue/faction-refusals.json', 'utf8'));
let spokenInvisible = 0; const keys = new Set();
for (const [, rec] of Object.entries(fr.factions || {})) for (const [k, v] of Object.entries(rec)) if (typeof v === 'string' && !TEXT_KEYS.has(k) && !k.startsWith('_')) { spokenInvisible++; keys.add(k); }
for (const [k, v] of Object.entries(fr.not_joinable || {})) if (typeof v === 'string' && !k.startsWith('_')) { spokenInvisible++; keys.add('not_joinable.' + k); }
console.log('\n=== check-authoring-leaks.mjs coverage ===');
console.log('strings its TEXT_KEYS whitelist reaches under dialogue/ + books/ :', all);
console.log('   ...of which live in greetings.json, the file it REGENERATES  :', inGreetings, '(' + (100 * inGreetings / all).toFixed(1) + '%)');
console.log('spoken faction-refusal strings it cannot see at all             :', spokenInvisible);
console.log('   under keys                                                  :', [...keys].join(', '));
console.log('factions with a spoken refusal voice                            :', Object.keys(fr.factions || {}).length);
