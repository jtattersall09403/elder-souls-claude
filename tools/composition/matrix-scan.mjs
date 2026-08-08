#!/usr/bin/env node
// matrix-scan.mjs — RI-CMP01 Comparison method, Stage 1: the claimed edge list.
//
//   node tools/composition/matrix-scan.mjs --data game/data \
//     --systems corpus/95-experience/RI-CMP01.cells.json \
//     --out reports/composition/w1/claims.json
//
// "Parses conditions and effects out of `game/data/**` ... and emits a claimed edge list. Every
// claimed edge carries the data path and the JSON pointer that produced it. **An edge with no
// data path is not a claim; it is an opinion, and the scanner refuses it.**"
//
// THE RULE THAT DECIDES WHAT COUNTS. `HARNESS.md` §7: content that exists only as literals
// inside `.js` is unmeasurable and is treated as content that does not exist. This scanner reads
// `game/data/**` and nothing else, on purpose. A cross-system interaction implemented in a
// `switch` statement scores zero here for the same reason a quest does — and `--js-census`
// reports how much of the tree that rule is silently discarding, so the number is visible rather
// than assumed to be nil.
//
// A CLAIM IS NOT A DEMONSTRATION. Stage 1 output is worth nothing on its own; RI-CMP01 hard fail
// 6 says a wave reporting coverage from this tool with no probe stage scores 0 for every cell.
// This file prints that sentence in its own summary so a reader cannot mistake the two.
//
// SELF-TEST (RULES #4)
//   node tools/composition/matrix-scan.mjs --self-test
// Runs the scanner over the shipped tree, then over a COPY of the tree with one whole class of
// evidence surgically removed (every `consequences.world_flags`, every `requires.disposition`,
// every `souls` field), and requires the corresponding cell's claim count to fall to zero. A
// scanner that reports the same edges after the evidence is deleted is reading its own rule
// table, not the data.
//
// EXIT: 0 scanned · 2 no claim was found for any cell (the data is not readable this way) ·
//       3 the cells artifact is missing · 5 self-test failed.
'use strict';

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const REPO = path.resolve(HERE, '..', '..');
const argv = process.argv.slice(2);
const has = (k) => argv.includes(`--${k}`);
const arg = (k, d) => { const i = argv.findIndex((a) => a === `--${k}` || a.startsWith(`--${k}=`)); if (i < 0) return d; const a = argv[i]; return a.includes('=') ? a.slice(a.indexOf('=') + 1) : argv[i + 1]; };
const say = (s) => process.stdout.write(s + '\n');

// ---------------------------------------------------------------------------------------------
// THE RULE TABLE. Each rule is: where in the tree to look, which JSON pointer inside a record
// carries the evidence, and which directed cell that evidence claims. Everything the scanner
// emits comes from here, and every rule names the mechanism in the words RI-CMP01 §D–§F uses so
// a critic can check the mapping rather than the code.
//
// `at` is a dotted path with `[]` for "every element". `when` may narrow it further.
const RULES = [
  // ---- quests: what gates a quest, and what a quest changes ---------------------------------
  { glob: 'quests/**', root: 'quests[]', at: 'giver.disposition_min', cell: 'DIS->QST', why: '§E: disposition opens a resolution that is otherwise a fight; the giver gate is its cheapest form' },
  { glob: 'quests/**', root: 'quests[]', at: 'rank_gate', cell: 'FAC->QST', why: '§E: rank gates quest availability' },
  { glob: 'quests/**', root: 'quests[]', at: 'opens_by.prerequisite_topics[]', cell: 'LOR->QST', why: '§E: a quest resolvable by knowledge' },
  { glob: 'quests/**', root: 'quests[]', at: 'opens_by.topic', cell: 'LOR->QST', why: '§E: the entry topic is the knowledge that opens it' },
  { glob: 'quests/**', root: 'quests[]', at: 'resolutions[].requires.disposition', cell: 'DIS->QST', why: '§E: DIS→QST' },
  { glob: 'quests/**', root: 'quests[]', at: 'resolutions[].requires.faction_rank', cell: 'FAC->QST', why: '§E: FAC→QST' },
  { glob: 'quests/**', root: 'quests[]', at: 'resolutions[].requires.skills', cell: 'SKL->QST', why: '§E: skill-gated resolutions — pick it, climb it, brew it, talk it' },
  { glob: 'quests/**', root: 'quests[]', at: 'resolutions[].requires.attributes', cell: 'SKL->QST', why: '§E: SKL→QST (attribute demands are the same gate)' },
  { glob: 'quests/**', root: 'quests[]', at: 'resolutions[].requires.gold', cell: 'GLD->QST', why: '§F: a resolution bought' },
  { glob: 'quests/**', root: 'quests[]', at: 'resolutions[].requires.items', cell: 'EQP->QST', why: '§F: a carried token opens a resolution' },
  { glob: 'quests/**', root: 'quests[]', at: 'resolutions[].requires_knowing[]', cell: 'LOR->QST', why: '§E: LOR→QST — a quest resolvable by knowledge alone' },
  { glob: 'quests/**', root: 'quests[]', at: 'resolutions[].method', cell: 'STL->QST', when: (v) => /stealth|theft|steal|pick/i.test(String(v)), why: '§E: stealth resolutions' },
  { glob: 'quests/**', root: 'quests[]', at: 'resolutions[].method', cell: 'SPL->QST', when: (v) => /magic|spell|enchant/i.test(String(v)), why: '§E: spell-solvable quests (S19)' },
  { glob: 'quests/**', root: 'quests[]', at: 'resolutions[].method', cell: 'LOR->QST', when: (v) => /lore|knowledge/i.test(String(v)), why: '§E: LOR→QST' },
  { glob: 'quests/**', root: 'quests[]', at: 'resolutions[].consequences.faction_reputation', cell: 'QST->FAC', why: '§E: quest outcomes advance, close and expel from factions' },
  { glob: 'quests/**', root: 'quests[]', at: 'resolutions[].consequences.world_flags[]', cell: 'QST->WLD', why: '§E: quest outcomes change the world — a village saved or burned' },
  { glob: 'quests/**', root: 'quests[]', at: 'resolutions[].consequences.npc_disposition', cell: 'QST->DIS', why: '§F: outcomes move disposition' },
  { glob: 'quests/**', root: 'quests[]', at: 'resolutions[].consequences.gold', cell: 'QST->GLD', why: '§F: rewards (RI-QST08)' },
  { glob: 'quests/**', root: 'quests[]', at: 'resolutions[].consequences.items[]', cell: 'QST->EQP', why: '§F: reward items' },
  { glob: 'quests/**', root: 'quests[]', at: 'resolutions[].consequences.topics[]', cell: 'QST->LOR', why: '§F: granted topics' },
  { glob: 'quests/**', root: 'quests[]', at: 'resolutions[].consequences.spawns[]', cell: 'QST->ROS', why: '§D: a completed quest changes an area’s enemy composition' },
  { glob: 'quests/**', root: 'quests[]', at: 'resolutions[].consequences.roster', cell: 'QST->ROS', why: '§D: QST→ROS' },
  { glob: 'quests/**', root: 'quests[]', at: 'journal[].index', cell: 'QST->JRN', why: '§F: journal entries are quest state’s face (RI-DLG05)' },
  { glob: 'quests/**', root: 'quests[]', at: 'opens_by.prerequisite_world_flags[]', cell: 'WLD->QST', why: '§E: world state closes and opens quests' },
  { glob: 'quests/hooks.json', root: 'hooks[]', at: 'flag', cell: 'WLD->QST', why: '§E: WLD→QST — the reciprocal that makes consequences persist' },
  { glob: 'quests/hooks.json', root: 'entry_topics[]', at: 'adds_topics[]', cell: 'QST->LOR', why: '§F: granted topics' },

  // ---- dialogue: what a line is conditioned on ---------------------------------------------
  { glob: 'dialogue/topics/**', root: 'topics[]', at: 'infos[].d', cell: 'DIS->LOR', why: '§F: disposition-gated topics (RI-DLG01)' },
  { glob: 'dialogue/topics/**', root: 'topics[]', at: 'infos[].f', cell: 'FAC->LOR', why: '§F: faction archive access grants topics' },
  { glob: 'dialogue/topics/**', root: 'topics[]', at: 'infos[].r', cell: 'LOR->DIS', why: '§F: knowing a person’s history is a topic' },
  { glob: 'dialogue/topics/**', root: 'topics[]', at: 'infos[].q', cell: 'QST->LOR', why: '§F: granted topics' },
  { glob: 'dialogue/topics/**', root: 'topics[]', at: 'infos[].w', cell: 'WLD->LOR', why: '§F: a changed world makes new rumours' },

  // ---- people: schedules, services, disposition --------------------------------------------
  { glob: 'npcs/**', root: 'npcs[]', at: 'services[]', cell: 'DIS->GLD', why: '§E: disposition sets barter prices (RI-DLG04) — it reshapes the whole economy' },
  { glob: 'npcs/**', root: 'npcs[]', at: 'schedule', cell: 'TOD->SCH', why: '§E: schedules ARE time of day (RI-WLD08)' },
  { glob: 'npcs/**', root: 'npcs[]', at: 'disposition', cell: 'DIS->QST', why: '§E: the disposition register the giver gate reads' },
  { glob: 'world/settlements/**', root: '*', at: 'schedule', cell: 'TOD->SCH', why: '§E: TOD→SCH' },

  // ---- the fight: what a body is worth, and what ends it without a corpse -------------------
  { glob: 'combat/enemies/**', root: '*', at: 'souls', cell: 'ROS->LVL', why: '§F: souls (S2, S15)' },
  { glob: 'combat/enemies/**', root: '*', at: 'parley', cell: 'DIS->BOS', why: '§D: the S13 parley threshold on a humanoid boss is a disposition gate' },
  { glob: 'combat/ai.json', root: '*', at: 'leash', cell: 'ROS->WLD', why: '§D: B-11’s leash is what lets a hostile be walked somewhere' },

  // ---- crime, stealth, property -------------------------------------------------------------
  { glob: 'crime/**', root: '*', at: 'bounty', cell: 'STL->GLD', why: '§F: theft as income, bounty as sink' },
  { glob: 'crime/**', root: '*', at: 'witness', cell: 'STL->DIS', why: '§F: being caught tanks it' },
  { glob: 'world/property/**', root: '*', at: 'owner', cell: 'STL->WLD', why: '§F: a stolen key opens a world door' },
  { glob: 'stealth/**', root: '*', at: 'light', cell: 'TOD->STL', why: '§E: night is the stealth system’s enabling condition' },

  // ---- magic, books, factions ---------------------------------------------------------------
  // `spells[].effects[].effect` names an effect id in magic/effects.json. `.id` does not exist
  // on a spell's effect row and a rule written against it would claim nothing forever.
  { glob: 'magic/spells.json', root: 'spells[]', at: 'effects[].effect', cell: 'SPL->WLD', when: (v) => /^(levitate|buoyancy|breathe_water|slowfall|leap|mark|recall|intervention|feather)$/i.test(String(v)), why: '§E: SPL→WLD — levitation and water-walk change which of the world is reachable' },
  { glob: 'magic/spells.json', root: 'spells[]', at: 'effects[].effect', cell: 'SPL->ROS', when: (v) => /^(calm_beast|paralyse|invisibility|chameleon|demoralise|frenzy|muffle|silence|false_face)$/i.test(String(v)), why: '§D: Calm / Paralyse / Command remove an enemy from an encounter without killing it; Invisibility prevents it' },
  { glob: 'magic/spells.json', root: 'spells[]', at: 'effects[].effect', cell: 'SPL->SKL', when: (v) => /^fortify_skill$/i.test(String(v)), why: '§F: fortify-skill (and RI-EXP06 B-02)' },
  { glob: 'magic/spells.json', root: 'spells[]', at: 'effects[].effect', cell: 'SPL->STL', when: (v) => /^(invisibility|chameleon|muffle|silence|night_eye)$/i.test(String(v)), why: '§F: invisibility, chameleon, silence' },
  { glob: 'magic/spells.json', root: 'spells[]', at: 'effects[].effect', cell: 'SPL->DUN', when: (v) => /^(open_lock|levitate)$/i.test(String(v)), why: '§D: SPL→DUN, bounded by S19 — exterior only' },
  { glob: 'magic/spells.json', root: 'spells[]', at: 'skill_req', cell: 'SKL->SPL', why: '§F: which spells can be equipped at all (RI-PRG03)' },
  { glob: 'magic/spells.json', root: 'spells[]', at: 'gold_price', cell: 'GLD->SPL', why: '§F: bought spells' },
  { glob: 'books/**', root: 'books[]', at: 'grants_topics[]', cell: 'LOR->QST', why: '§D/§E: a book is knowledge that opens a route (RI-LOR03)' },
  { glob: 'books/**', root: 'books[]', at: 'teaches_spell', cell: 'LOR->SPL', why: '§F: a book teaches a spell' },
  { glob: 'factions/**', root: '*', at: 'ranks[].skill_min', cell: 'SKL->FAC', why: '§E: skill + attribute thresholds gate rank (RI-QST03)' },
  { glob: 'quests/faction-gates.json', root: '*', at: 'ranks[]', cell: 'SKL->FAC', why: '§E: SKL→FAC — the rank ladder' },
  { glob: 'items/**', root: '*', at: 'faction', cell: 'EQP->FAC', why: '§F: a uniform changes how members and rivals treat you' },
  { glob: 'world/**', root: '*', at: 'tide', cell: 'WEA->WLD', why: '§E: tidewalking — roads and one whole route exist only at low tide (RI-WLD05 #21)' },
];

// ---------------------------------------------------------------------------------------------

function walkFiles(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walkFiles(p, out);
    else if (e.name.endsWith('.json')) out.push(p);
  }
  return out;
}

function globMatches(rel, glob) {
  if (glob.endsWith('/**')) return rel === glob.slice(0, -3) || rel.startsWith(glob.slice(0, -2));
  return rel === glob;
}

/** Resolve a dotted `a.b[].c` path inside `obj`, yielding [value, jsonPointer]. */
function* resolve(obj, dotted, ptr = '') {
  if (!dotted) { yield [obj, ptr]; return; }
  const m = /^([^.[]*)(\[\])?\.?(.*)$/.exec(dotted);
  const key = m[1], isArr = !!m[2], rest = m[3];
  let v = key === '' || key === '*' ? obj : (obj && typeof obj === 'object' ? obj[key] : undefined);
  const p2 = key === '' || key === '*' ? ptr : `${ptr}/${key}`;
  if (v === undefined || v === null) return;
  if (isArr) {
    if (!Array.isArray(v)) return;
    for (let i = 0; i < v.length; i++) yield* resolve(v[i], rest, `${p2}/${i}`);
  } else {
    yield* resolve(v, rest, p2);
  }
}

/** Roots inside a file: `quests[]`, `hooks[]`, or `*` for the file itself. */
function* rootsOf(json, root) {
  if (!root || root === '*') { yield [json, '']; return; }
  yield* resolve(json, root, '');
}

const isEvidence = (v) =>
  v !== undefined && v !== null && v !== '' && v !== false
  && !(Array.isArray(v) && v.length === 0)
  && !(typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === 0);

export function scan({ dataDir, mutate = null } = {}) {
  const files = walkFiles(dataDir);
  const claims = new Map(); // cell -> {cell, why, n, evidence:[{path, pointer, value}]}
  const perFile = new Map();
  let records = 0;
  for (const f of files) {
    const rel = path.relative(dataDir, f).replace(/\\/g, '/');
    let json;
    try { json = JSON.parse(fs.readFileSync(f, 'utf8')); } catch { continue; }
    if (mutate) json = mutate(rel, json);
    for (const rule of RULES) {
      if (!globMatches(rel, rule.glob)) continue;
      for (const [rec, rptr] of rootsOf(json, rule.root)) {
        records++;
        for (const [v, ptr] of resolve(rec, rule.at, rptr)) {
          if (!isEvidence(v)) continue;
          if (rule.when && !rule.when(v)) continue;
          const c = claims.get(rule.cell) || { cell: rule.cell, why: rule.why, n: 0, files: new Set(), evidence: [] };
          c.n++; c.files.add(rel);
          if (c.evidence.length < 6) {
            c.evidence.push({
              data_path: `game/data/${rel}`,
              json_pointer: ptr || '/',
              value: typeof v === 'object' ? (Array.isArray(v) ? `[${v.length}]` : `{${Object.keys(v).join(',')}}`) : v,
            });
          }
          claims.set(rule.cell, c);
          perFile.set(rel, (perFile.get(rel) || 0) + 1);
        }
      }
    }
  }
  return {
    files_read: files.length,
    records_visited: records,
    claims: [...claims.values()].map((c) => ({ ...c, files: [...c.files].sort() })).sort((a, b) => b.n - a.n),
  };
}

/** HARNESS §7's cost, made visible: how much of the tree is `.js` this scanner cannot read. */
function jsCensus() {
  const src = path.join(REPO, 'game/src');
  let files = 0, bytes = 0;
  (function w(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) w(p);
      else if (e.name.endsWith('.js')) { files++; bytes += fs.statSync(p).size; }
    }
  })(src);
  return { js_files: files, js_bytes: bytes, rule: 'HARNESS.md §7 — content that exists only as literals inside .js is unmeasurable and is treated as content that does not exist' };
}

// ---------------------------------------------------------------------------------------------

const ABLATIONS = [
  {
    id: 'delete-every-world-flag', cell: 'QST->WLD',
    mutate: (rel, j) => { if (!rel.startsWith('quests/')) return j;
      for (const q of j.quests || []) for (const r of q.resolutions || []) if (r.consequences) delete r.consequences.world_flags;
      return j; },
  },
  {
    id: 'delete-every-faction-reputation-consequence', cell: 'QST->FAC',
    mutate: (rel, j) => { if (!rel.startsWith('quests/')) return j;
      for (const q of j.quests || []) for (const r of q.resolutions || []) if (r.consequences) delete r.consequences.faction_reputation;
      return j; },
  },
  {
    id: 'delete-every-souls-field', cell: 'ROS->LVL',
    mutate: (rel, j) => { if (!rel.startsWith('combat/enemies/')) return j; delete j.souls; return j; },
  },
  {
    // EVERY knowledge gate, not just `requires_knowing`: the first version of this ablation left
    // `resolutions[].method == "lore_knowledge"` in place and the cell fell 342 -> 25 instead of
    // to zero. A partial ablation that still leaves a claim standing proves nothing, so it is
    // recorded here rather than quietly widened: a self-test arm must remove the WHOLE class.
    id: 'delete-every-knowledge-gate', cell: 'LOR->QST',
    mutate: (rel, j) => { if (!rel.startsWith('quests/')) return j;
      for (const q of j.quests || []) {
        for (const r of q.resolutions || []) { delete r.requires_knowing; if (/lore|knowledge/i.test(String(r.method || ''))) delete r.method; }
        if (q.opens_by) { delete q.opens_by.prerequisite_topics; delete q.opens_by.topic; }
      }
      return j; },
  },
];

async function selfTest(dataDir) {
  say('SELF-TEST — delete a whole class of evidence from a copy of the tree; the cell must go to zero.');
  const base = scan({ dataDir });
  const n = (r, cell) => (r.claims.find((c) => c.cell === cell) || { n: 0 }).n;
  let ok = base.claims.length > 0;
  say(`  ${ok ? 'ok  ' : 'FAIL'}  the shipped tree yields ${base.claims.length} claimed cell(s) from ${base.files_read} files`);
  for (const a of ABLATIONS) {
    const before = n(base, a.cell);
    if (before === 0) { say(`  FAIL  ${a.id.padEnd(42)} ${a.cell} claims nothing before the ablation — this ablation proves nothing`); ok = false; continue; }
    const after = n(scan({ dataDir, mutate: (rel, j) => a.mutate(rel, JSON.parse(JSON.stringify(j))) }), a.cell);
    const red = after === 0;
    say(`  ${red ? 'ok  ' : 'FAIL'}  ${a.id.padEnd(42)} ${a.cell}: ${before} -> ${after}`);
    if (!red) ok = false;
  }
  say(`SELF-TEST ${ok ? 'PASS' : 'FAIL'}`);
  return ok;
}

async function main() {
  const dataDir = path.resolve(REPO, arg('data', 'game/data'));
  if (has('self-test')) process.exit((await selfTest(dataDir)) ? 0 : 5);
  const systemsPath = path.resolve(REPO, arg('systems', 'corpus/95-experience/RI-CMP01.cells.json'));
  if (!fs.existsSync(systemsPath)) {
    say(`ABSENT: ${path.relative(REPO, systemsPath)} — run tools/composition/cells-from-md.mjs first.`);
    process.exit(3);
  }
  const cellsArtifact = JSON.parse(fs.readFileSync(systemsPath, 'utf8'));
  const declared = new Map(cellsArtifact.cells.map((c) => [c.id, c]));
  const r = scan({ dataDir });

  for (const c of r.claims) {
    const d = declared.get(c.cell);
    c.declared_tier = d ? d.tier : null;
    c.declared_crossing = d ? d.crossing : null;
    c.declared_direction = d ? d.direction : null;
    if (!d) c.not_in_matrix = true;
    else if (d.tier === 'none') c.claims_a_cell_the_matrix_says_is_none = true;
  }
  const crossingCells = cellsArtifact.cells.filter((c) => c.crossing);
  const claimedCrossings = r.claims.filter((c) => c.declared_crossing);
  const out = {
    schema: 'elder-souls/cmp01-claims@1',
    tool: 'tools/composition/matrix-scan.mjs',
    stage: 'RI-CMP01 Comparison method Stage 1 — STATIC CLAIMS ONLY',
    warning: 'RI-CMP01 hard fail 6: a wave that reports coverage from this tool with no probe stage ' +
      'scores 0 for every cell. Nothing in this file is a demonstration.',
    at: new Date().toISOString(),
    data_dir: path.relative(REPO, dataDir),
    files_read: r.files_read,
    js_census: jsCensus(),
    declared_crossing_cells: crossingCells.length,
    claimed_cells: r.claims.length,
    claimed_crossing_cells: claimedCrossings.length,
    crossing_cells_with_no_data_claim: crossingCells.filter((c) => !r.claims.some((x) => x.cell === c.id))
      .map((c) => ({ cell: c.id, direction: c.direction, mechanism: c.mechanism || null })),
    claims: r.claims,
  };
  const o = path.resolve(REPO, arg('out', 'reports/composition/w1/claims.json'));
  fs.mkdirSync(path.dirname(o), { recursive: true });
  fs.writeFileSync(o, JSON.stringify(out, null, 2) + '\n');

  say(`matrix-scan  ${r.files_read} data files -> ${r.claims.length} cells with at least one data-path claim`);
  say(`  ${claimedCrossings.length} of ${crossingCells.length} declared seam-crossing cells have any data behind them at all`);
  for (const c of r.claims.slice(0, 30)) {
    say(`  ${c.cell.padEnd(11)} ${String(c.n).padStart(5)} claim(s)  ${c.declared_crossing ? 'CROSSING ' : ''}${c.declared_tier || 'NOT-IN-MATRIX'}  ${c.files.length} file(s)`);
  }
  say(`  ${out.crossing_cells_with_no_data_claim.length} crossing cell(s) have NO data claim: ` +
    out.crossing_cells_with_no_data_claim.map((c) => c.cell).join(', '));
  say(`  HARNESS §7: ${out.js_census.js_files} .js files (${Math.round(out.js_census.js_bytes / 1024)} KB) are invisible to this scanner by rule.`);
  say(`wrote ${path.relative(REPO, o)}`);
  say('STAGE 1 ONLY. None of this is demonstrated. See matrix-probe.mjs.');
  process.exit(r.claims.length ? 0 : 2);
}

if (process.argv[1] && process.argv[1].endsWith('matrix-scan.mjs')) main();
export { RULES };
