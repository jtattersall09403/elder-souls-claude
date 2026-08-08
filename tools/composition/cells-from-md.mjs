#!/usr/bin/env node
// cells-from-md.mjs — the living artifact RI-CMP01 names, generated from the item itself.
//
// RI-CMP01 §B: "`RI-CMP01.cells.json` is generated from this table and §D–§F by
// `tools/composition/cells-from-md.mjs`, so the grid, the register and the probe suite cannot
// drift." The file did not exist; nor did the directory. RULES.md #24.
//
// WHAT IT DOES
//   1. Parses §B's 19x19 grid into 342 directed off-diagonal cells with a tier and a
//      crossing flag.
//   2. Attaches §D's mechanism + probe observable to each of the 41 crossing cells, §E's
//      structural claim to each of the 22 structural cells, and §G's mandated-`none` rule.
//   3. RE-DERIVES the direction of every crossing FROM §A's definition, never from which table
//      in §D the cell is printed under — the item requires this in as many words, and §D itself
//      prints four formally-W→F cells under its F→W heading for grouping convenience.
//   4. RECOUNTS the declared totals and CHECKS them against the numbers §B and §H assert
//      (206 non-none / 60.2% / m146 S19 M38 T3 / trivial 15 / none 121 / 41 crossings /
//      22 structural / score 297 / split 30 W→F, 11 F→W). A disagreement is a FINDING about
//      the item and is written into the artifact and printed; it is not silently absorbed.
//
// WHY THE RECOUNT IS THE POINT. §B's totals are described in the item's own provenance note as
// "arithmetic over §B ... verified by recount against the grid rather than asserted". This tool
// is the machine that keeps that true after the next builder proposes a better mechanism for a
// cell marked `none`.
//
// SELF-TEST (RULES #4)
//   node tools/composition/cells-from-md.mjs --self-test
// Mutates a COPY of the item four ways — flip one `.` to `M`, delete a §D register row, break a
// crossing so it satisfies neither §A shape, and corrupt the declared totals line — and requires
// the generator to go red on each. It never writes to the corpus.
//
// EXIT: 0 generated and every declared total agrees · 2 a declared total disagrees with the
//       recount · 3 the item could not be parsed · 4 a crossing violates §A · 5 self-test failed.
'use strict';

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { tables, splitRow, plain } from '../experience/lib/md.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const REPO = path.resolve(HERE, '..', '..');
const ITEM = path.join(REPO, 'corpus/95-experience/RI-CMP01-cross-system-payoff-matrix.md');
const OUT = path.join(REPO, 'corpus/95-experience/RI-CMP01.cells.json');

const argv = process.argv.slice(2);
const has = (k) => argv.includes(`--${k}`);
const arg = (k, d) => { const i = argv.findIndex((a) => a === `--${k}` || a.startsWith(`--${k}=`)); if (i < 0) return d; const a = argv[i]; return a.includes('=') ? a.slice(a.indexOf('=') + 1) : argv[i + 1]; };
const say = (s) => process.stdout.write(s + '\n');

// §A's seam definition, and the two qualifiers in it that a machine CANNOT decide.
//
//   W→F  "the source is state accumulated outside the fight and the target is `ROS`, `BOS`, or
//         `DUN`-AS-ARENA"
//   F→W  "the source is `ROS` or `BOS` and the target is any WORLD-SIDE system BEYOND SOULS AND
//         CORPSES"
//
// `DUN`-as-arena and beyond-souls-and-corpses are judgements. `DUN` is a target in ten cells and
// the item marks exactly one of them (`SPL→DUN`) a crossing, because the other nine are DUN as
// level geometry — a faction-held door, a described back route — and not DUN as arena. Likewise
// `ROS→GLD` (loot) and `BOS→GLD` (a hand-placed reward) are corpses, so §A excludes them, while
// `ROS→LOR` is excluded for a different reason: §H's F→W debt note proposes "what you killed
// becomes what the province talks about" as a NEW cell the matrix does not yet have.
//
// So this tool derives the MECHANICAL half of §A exactly, and reports the residue by name as
// `direction_judgements` rather than pretending to have decided it or silently agreeing with
// the grid. Naming the twenty-four cells whose crossing status rests on a qualifier is the
// service; asserting an answer for them would be the fabrication.
export const FIGHT_SIDE = new Set(['ROS', 'BOS']);
export const TIER_POINTS = { none: 0, trivial: 0, mechanical: 1, structural: 3 };

/** §B's cell glyphs. `·` is the mandated-`none` marker used in the LVL and UPG rows. */
function readGlyph(raw) {
  const s = plain(raw).replace(/\s+/g, '');
  if (s === '/' ) return { tier: 'diagonal', crossing: false };
  if (s === '.' || s === '·') return { tier: 'none', crossing: false, mandated_marker: s === '·' };
  if (s === 't') return { tier: 'trivial', crossing: false };
  if (s === 'm') return { tier: 'mechanical', crossing: false };
  if (s === 'S') return { tier: 'structural', crossing: false };
  if (s === 'M') return { tier: 'mechanical', crossing: true };
  if (s === 'T') return { tier: 'structural', crossing: true };
  return null;
}

/**
 * §A's seam definition, applied to a cell, using §A's own Side column.
 *
 * Returns { dir, basis } where `dir` is 'W2F' | 'F2W' | null and `basis` is 'definite' when the
 * cell falls inside §A's definition with no qualifier in play, or the name of the qualifier that
 * has to be judged.
 */
export function directionOf(src, tgt, side) {
  const srcFight = FIGHT_SIDE.has(src), tgtFight = FIGHT_SIDE.has(tgt);
  if (!srcFight && tgtFight) return { dir: 'W2F', basis: 'definite' };
  if (!srcFight && tgt === 'DUN') return { dir: 'W2F', basis: 'DUN-as-arena (§A qualifier — a judgement)' };
  if (srcFight && side[tgt] === 'world') return { dir: 'F2W', basis: 'definite' };
  if (srcFight && !tgtFight) return { dir: 'F2W', basis: `target is '${side[tgt] || '?'}'-side, not world-side (§A qualifier)` };
  return { dir: null, basis: 'neither shape: both ends are inside the fight' };
}

export function parseItem(text) {
  const errs = [];

  // ---- §A: the nineteen systems --------------------------------------------------------
  const sysTable = tables(text).find((t) => t.header[0] === 'Code' && t.header.includes('System'));
  if (!sysTable) throw new Error('§A: the nineteen-system table is not parseable');
  const systems = sysTable.rows.map((r) => ({
    code: plain(r[0]), name: plain(r[1]), side: plain(r[2]).toLowerCase(), state: plain(r[3]),
  })).filter((s) => /^[A-Z]{3}$/.test(s.code));
  if (systems.length !== 19) errs.push(`§A declares ${systems.length} systems, not 19`);
  const codes = systems.map((s) => s.code);
  const SIDE = Object.fromEntries(systems.map((s) => [s.code, s.side]));
  for (const [c, s] of Object.entries(SIDE)) {
    if (!['world', 'fight', 'both'].includes(s)) errs.push(`§A gives ${c} the side "${s}", which is none of world/fight/both`);
  }

  // ---- §B: the grid --------------------------------------------------------------------
  const lines = text.split('\n');
  const gi = lines.findIndex((l) => l.includes('↓src') && l.includes('tgt'));
  if (gi < 0) throw new Error('§B: the grid header row is not present');
  const header = splitRow(lines[gi]).slice(1).map(plain);
  if (header.join(',') !== codes.join(',')) {
    errs.push(`§B column order ${header.join(',')} does not match §A ${codes.join(',')}`);
  }
  const cells = [];
  for (let i = gi + 2; i < lines.length; i++) {
    if (!lines[i].trim().startsWith('|')) break;
    const row = splitRow(lines[i]);
    const src = plain(row[0]);
    if (!codes.includes(src)) { errs.push(`§B row "${src}" is not one of §A's codes`); continue; }
    for (let c = 0; c < header.length; c++) {
      const tgt = header[c];
      const g = readGlyph(row[c + 1]);
      if (!g) { errs.push(`§B ${src}->${tgt}: unreadable glyph ${JSON.stringify(row[c + 1])}`); continue; }
      if (src === tgt) {
        if (g.tier !== 'diagonal') errs.push(`§B ${src}->${tgt}: the diagonal must be "/"`);
        continue;
      }
      const d = directionOf(src, tgt, SIDE);
      cells.push({
        id: `${src}->${tgt}`, src, tgt,
        src_side: SIDE[src], tgt_side: SIDE[tgt],
        tier: g.tier, crossing: g.crossing,
        mandated_marker: !!g.mandated_marker,
        direction: g.crossing ? d.dir : null,
        shape: d.dir, shape_basis: d.basis,
        points: TIER_POINTS[g.tier] * (g.crossing ? 2 : 1),
      });
    }
  }
  if (cells.length !== 342) errs.push(`§B yields ${cells.length} off-diagonal cells, not 342 (19x18)`);
  const byId = new Map(cells.map((c) => [c.id, c]));

  // §A CONSISTENCY: every cell the grid marks as crossing must satisfy one of §A's two shapes.
  // This is the check the item asks for in "Direction is computed from §A's definition by the
  // tooling, never from which table in §D a cell is printed under", and the defence against
  // "fight-to-fight cells get counted as crossings" in How-we-lose.
  const shapeViolations = cells
    .filter((c) => c.crossing && !c.shape)
    .map((c) => `${c.id} is marked a crossing in §B and satisfies neither shape under §A (${c.shape_basis})`);
  // Not errors: the cells whose crossing status rests on one of §A's two judgement qualifiers.
  // A critic should read this list; the item's own How-we-lose asks for exactly that.
  const judgements = cells
    .filter((c) => !c.crossing && c.tier !== 'none' && c.tier !== 'trivial' && c.shape)
    .map((c) => ({
      id: c.id, tier: c.tier, shape: c.shape, basis: c.shape_basis,
      note: c.shape_basis === 'definite'
        ? 'satisfies §A with no qualifier in play, and §B still does not mark it a crossing — the ' +
          '"beyond souls and corpses" exclusion is the only thing that can be doing the work here'
        : 'excluded by a §A qualifier a machine cannot decide',
    }));
  const definiteButUnmarked = judgements.filter((j) => j.basis === 'definite').map((j) => `${j.id} (${j.tier}, ${j.shape})`);

  // ---- §D: the crossing register -------------------------------------------------------
  const regTables = tables(text).filter((t) => t.header[0] === 'Cell' && /mechanism/i.test(t.header.join(' ')));
  const register = [];
  for (const t of regTables) {
    for (const r of t.rows) {
      const id = plain(r[0]).replace(/\s*→\s*/, '->');
      register.push({ id, mechanism: plain(r[1]), observable: plain(r[2]) });
    }
  }
  for (const e of register) {
    const c = byId.get(e.id);
    if (!c) { errs.push(`§D names ${e.id}, which is not a cell in §B`); continue; }
    c.mechanism = e.mechanism; c.observable = e.observable;
    if (!c.crossing) errs.push(`§D lists ${e.id} in the crossing register but §B does not mark it a crossing`);
  }

  // ---- §E: the structural register -----------------------------------------------------
  const structTable = tables(text).find((t) => t.header[0] === 'Cell' && /structural claim/i.test(t.header.join(' ')));
  if (structTable) {
    for (const r of structTable.rows) {
      const id = plain(r[0]).replace(/\s*→\s*/, '->');
      const c = byId.get(id);
      if (!c) { errs.push(`§E names ${id}, which is not a cell in §B`); continue; }
      c.structural_claim = plain(r[1]);
      if (c.tier !== 'structural') errs.push(`§E claims ${id} is structural; §B marks it ${c.tier}`);
    }
  } else errs.push('§E: the structural register is not parseable');

  // ---- §G: mandated-none and forbidden mechanisms --------------------------------------
  const gTable = tables(text).find((t) => t.header[0] === 'Cell' && /must be/i.test(t.header.join(' ')));
  const mandated = [];
  if (gTable) {
    for (const r of gTable.rows) {
      const rawIds = plain(r[0]);
      const must = plain(r[1]);
      const because = plain(r[2]);
      const forbidden = /forbidden mechanism/i.test(must);
      for (const m of rawIds.matchAll(/([A-Z]{3})\s*→\s*([A-Z*\/]{1,7})/g)) {
        const src = m[1];
        for (const tgt of m[2].split('/')) {
          const t = tgt.trim();
          // "ROS→GLD **via souls**" and "SKL→ROS/BOS **via hit resolution**" constrain a
          // MECHANISM, not a cell: `ROS→GLD` legitimately exists as hand-placed loot (§F, S12)
          // and is `m` in §B. Only an UNQUALIFIED row mandates the cell itself empty.
          const viaM = /\bvia\s+([A-Za-z][A-Za-z ]*)/.exec(rawIds);
          const via = viaM ? viaM[1].trim() : null;
          const rec = { src, tgt: t, must, because, forbidden, via, scope: via ? 'mechanism' : 'cell', raw: rawIds };
          mandated.push(rec);
          if (t !== '*' && byId.has(`${src}->${t}`)) {
            const c = byId.get(`${src}->${t}`);
            (c.mandated_rules || (c.mandated_rules = [])).push(rec);
            c.mandated = must; c.mandated_because = because; c.forbidden_mechanism = forbidden || !!via;
            if (!forbidden && !via && c.tier !== 'none') {
              errs.push(`§G requires ${c.id} to be none; §B marks it ${c.tier}`);
            }
          }
        }
      }
    }
  } else errs.push('§G: the mandated-none table is not parseable');

  // ---- the recount ---------------------------------------------------------------------
  const count = (fn) => cells.filter(fn).length;
  const recount = {
    off_diagonal: cells.length,
    // The item's "206 non-`none`" is m+S+M+T: 146+19+38+3. Trivial cells are declared and score
    // zero, and the item counts them in their own column, not in this one. Both are reported so
    // a reader is never guessing which definition a percentage used.
    non_none: count((c) => c.tier !== 'none' && c.tier !== 'trivial'),
    non_none_incl_trivial: count((c) => c.tier !== 'none'),
    m: count((c) => c.tier === 'mechanical' && !c.crossing),
    S: count((c) => c.tier === 'structural' && !c.crossing),
    M: count((c) => c.tier === 'mechanical' && c.crossing),
    T: count((c) => c.tier === 'structural' && c.crossing),
    trivial: count((c) => c.tier === 'trivial'),
    none: count((c) => c.tier === 'none'),
    crossings: count((c) => c.crossing),
    structural: count((c) => c.tier === 'structural'),
    score: cells.reduce((s, c) => s + c.points, 0),
    w2f: count((c) => c.crossing && c.direction === 'W2F'),
    f2w: count((c) => c.crossing && c.direction === 'F2W'),
    register_rows: register.length,
  };
  recount.declared_coverage = Math.round((recount.non_none / cells.length) * 1000) / 10;

  // §B's and §H's asserted numbers, read out of the item's own prose rather than hard-coded.
  const totalsLine = (text.match(/\*\*Declared totals\*\*[\s\S]{0,600}?Declared matrix score \*\*(\d+)\*\*/) || [])[0] || '';
  const gnum = (re) => { const m = totalsLine.match(re); return m ? Number(m[1]) : null; };
  const declared = {
    non_none: gnum(/\*\*(\d+) non-`none`\*\*/),
    declared_coverage: gnum(/= \*\*([\d.]+)%\*\*/),
    m: gnum(/`m` (\d+)/), S: gnum(/`S` (\d+)/), M: gnum(/`M` (\d+)/), T: gnum(/`T` (\d+)/),
    trivial: gnum(/trivial (\d+)/), none: gnum(/none (\d+)/),
    crossings: gnum(/\(`M`\+`T`\) = (\d+)/),
    structural: gnum(/\(`S`\+`T`\) = (\d+)/),
    score: gnum(/Declared matrix score \*\*(\d+)\*\*/),
  };
  const splitLine = (text.match(/The crossings split (\d+) W→F \/ (\d+) F→W/) || []);
  declared.w2f = splitLine[1] ? Number(splitLine[1]) : null;
  declared.f2w = splitLine[2] ? Number(splitLine[2]) : null;

  const mismatches = [];
  for (const k of Object.keys(declared)) {
    if (declared[k] === null) { mismatches.push(`${k}: the item does not state it in a form this tool can read`); continue; }
    if (declared[k] !== recount[k]) mismatches.push(`${k}: the item declares ${declared[k]}, the grid yields ${recount[k]}`);
  }

  // ---- §H: the wave floors -------------------------------------------------------------
  const floorTable = tables(text).find((t) => /demonstrated live cells/i.test(t.header.join(' ')));
  const floors = {};
  if (floorTable) {
    for (const r of floorTable.rows) {
      const wave = plain(r[0]);
      const n = (s) => { const m = plain(s).match(/(\d+)/); return m ? Number(m[1]) : null; };
      const key = /W1/.test(wave) ? 'W1' : /W2/.test(wave) ? 'W2' : /W3/.test(wave) ? 'W3' : /W4/.test(wave) ? 'W4' : wave;
      floors[key] = { label: wave, live: n(r[1]), structural: n(r[2]), crossings: n(r[3]), score: n(r[4]) };
    }
  } else errs.push('§H: the floor table is not parseable');

  return { systems, cells, register, mandated, recount, declared, mismatches, floors, errs,
    shapeViolations, judgements, definiteButUnmarked, side: SIDE };
}

// ---------------------------------------------------------------------------------------------

function generate({ write = true, itemPath = ITEM, outPath = OUT } = {}) {
  const text = fs.readFileSync(itemPath, 'utf8');
  const p = parseItem(text);
  const artifact = {
    schema: 'elder-souls/cmp01-cells@1',
    generated_by: 'tools/composition/cells-from-md.mjs',
    generated_from: path.relative(REPO, itemPath),
    source_sha256: crypto_sha(text),
    at: new Date().toISOString(),
    note: 'GENERATED. Do not edit; edit the reference item and re-run. Direction is derived from ' +
      "RI-CMP01 §A's definition, never from which table in §D a cell is printed under.",
    systems: p.systems,
    floors: p.floors,
    recount: p.recount,
    declared_in_item: p.declared,
    declared_vs_recount: p.mismatches,
    shape_violations: p.shapeViolations,
    direction_judgements: p.judgements,
    satisfies_a_shape_but_not_marked_a_crossing: p.definiteButUnmarked,
    parse_errors: p.errs,
    mandated_none: p.mandated,
    cells: p.cells,
  };
  if (write) {
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, JSON.stringify(artifact, null, 2) + '\n');
  }
  return artifact;
}

function crypto_sha(s) {
  // eslint-disable-next-line global-require
  return require_crypto().createHash('sha256').update(s).digest('hex').slice(0, 16);
}
let _c = null;
function require_crypto() { if (!_c) _c = globalThis.__nodeCrypto || (globalThis.__nodeCrypto = nodeCrypto()); return _c; }
function nodeCrypto() { return crypto; }
import crypto from 'node:crypto';

// ---------------------------------------------------------------------------------------------

const MUTATIONS = [
  {
    id: 'flip-a-none-to-a-crossing',
    why: 'a builder proposes a mechanism for a cell marked `none` and does not update the totals',
    apply: (t) => t.replace('| **LOR** |m|m|m|.|', '| **LOR** |m|m|m|M|'),
    must: (a) => a.declared_vs_recount.length > 0,
    wants: 'the recount to disagree with the declared totals',
  },
  {
    id: 'delete-a-register-row',
    why: 'a §D register row is lost in an edit and 40 crossings carry a mechanism where 41 are marked',
    apply: (t) => t.replace(/\n\| `UPG→BOS` \|[^\n]*\n/, '\n'),
    must: (a) => a.cells.filter((c) => c.crossing && !c.mechanism).length > 0,
    wants: 'at least one crossing cell with no mechanism',
  },
  {
    id: 'mark-a-fight-to-fight-cell-as-a-crossing',
    why: 'RI-CMP01 How-we-lose: "`BOS→ROS` reads exactly like a seam crossing and is not one"',
    apply: (t) => t.replace('| **BOS** |**T**|**M**|m|.|m|**M**|.|**T**|**T**|.|m|m|m|m|m|/|',
      '| **BOS** |**T**|**M**|m|.|m|**M**|.|**T**|**T**|.|m|m|m|m|**M**|/|'),
    must: (a) => a.shape_violations.length > 0,
    wants: 'a §A shape violation',
  },
  {
    id: 'corrupt-the-declared-total',
    why: 'the item asserts a number nobody recomputes',
    apply: (t) => t.replace('**Seam-crossing (`M`+`T`) = 41.**', '**Seam-crossing (`M`+`T`) = 44.**'),
    must: (a) => a.declared_vs_recount.some((m) => m.startsWith('crossings:')),
    wants: 'the crossing total to be reported as disagreeing',
  },
];

async function selfTest() {
  say('SELF-TEST — the generator must go red on four mutations of a COPY of the item.');
  const text = fs.readFileSync(ITEM, 'utf8');
  const base = generate({ write: false });
  const baseClean = base.declared_vs_recount.length === 0 && base.shape_violations.length === 0
    && base.cells.filter((c) => c.crossing && !c.mechanism).length === 0;
  say(`  ${baseClean ? 'ok  ' : 'FAIL'}  the shipped item parses clean` +
    (baseClean ? '' : `  <-- ${JSON.stringify(base.declared_vs_recount.concat(base.shape_violations))}`));
  const tmp = path.join(REPO, 'tmp', 'cmp01-selftest');
  fs.mkdirSync(tmp, { recursive: true });
  let ok = baseClean;
  for (const m of MUTATIONS) {
    const mutated = m.apply(text);
    if (mutated === text) { say(`  FAIL  ${m.id}: the mutation matched nothing — the item's text moved and this self-test is stale`); ok = false; continue; }
    const p = path.join(tmp, m.id + '.md');
    fs.writeFileSync(p, mutated);
    let red = false, note = '';
    try { red = m.must(generate({ write: false, itemPath: p, outPath: path.join(tmp, m.id + '.json') })); }
    catch (e) { red = true; note = ' (threw: ' + String(e.message).slice(0, 70) + ')'; }
    say(`  ${red ? 'ok  ' : 'FAIL'}  ${m.id.padEnd(38)} wants ${m.wants}${note}`);
    if (!red) ok = false;
  }
  say(`SELF-TEST ${ok ? 'PASS' : 'FAIL'}`);
  return ok;
}

async function main() {
  if (has('self-test')) { process.exit((await selfTest()) ? 0 : 5); }
  const outPath = arg('out', null) ? path.resolve(REPO, arg('out')) : OUT;
  let a;
  try { a = generate({ outPath }); }
  catch (e) { say('cells-from-md: ' + ((e && e.message) || e)); process.exit(3); }
  say(`RI-CMP01.cells.json  <- ${path.relative(REPO, ITEM)}`);
  say(`  ${a.cells.length} off-diagonal cells · ${a.recount.non_none} non-none (${a.recount.declared_coverage}% declared coverage)`);
  say(`  m ${a.recount.m} · S ${a.recount.S} · M ${a.recount.M} · T ${a.recount.T} · trivial ${a.recount.trivial} · none ${a.recount.none}`);
  say(`  crossings ${a.recount.crossings} (${a.recount.w2f} W->F / ${a.recount.f2w} F->W) · structural ${a.recount.structural} · declared matrix score ${a.recount.score}`);
  say(`  W1 floor: ${JSON.stringify(a.floors.W1)}`);
  for (const e of a.parse_errors) say(`  PARSE  ${e}`);
  for (const m of a.declared_vs_recount) say(`  TOTALS ${m}`);
  for (const v of a.shape_violations) say(`  SHAPE  ${v}`);
  say(`  ${a.direction_judgements.length} cell(s) turn on a §A qualifier a machine cannot decide ` +
      `(${a.satisfies_a_shape_but_not_marked_a_crossing.length} of them satisfy §A outright): ` +
      a.satisfies_a_shape_but_not_marked_a_crossing.join(', '));
  say(`wrote ${path.relative(REPO, outPath)}`);
  if (a.shape_violations.length) process.exit(4);
  if (a.declared_vs_recount.length || a.parse_errors.length) process.exit(2);
  process.exit(0);
}

if (process.argv[1] && process.argv[1].endsWith('cells-from-md.mjs')) main();

export { generate, ITEM, OUT };
