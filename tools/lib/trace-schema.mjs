#!/usr/bin/env node
// trace-schema.mjs — ONE documented, versioned reader for `elder-souls/trace@1`.
//
// WHY THIS EXISTS. TOOL-COVERAGE-R3, "The field audit, in full":
//
//   "A single documented trace-record schema, versioned, would have prevented four of the six
//    rebuilds in this document. That is the highest-value thing this loop could produce next,
//    and it is worth more than any individual tool fix."
//
// Four separate tools independently invented `r.frame`. The engine has never written it. The
// engine writes `f` — `game/src/sim/record.js:51`, one function that builds both `snapshot()`
// and every trace line, precisely so there would not be two dialects. There were four readers.
//
// THE RULE THIS MODULE ENFORCES, and it is the whole point:
//
//   A missing frame is `null`, NEVER 0.
//
// `r.frame ?? 0` is what made this class of bug invisible and dangerous rather than loud. Zero
// is a legal frame number, so every downstream window test (`f - t.f <= 30*fps`,
// `Math.abs(qf - a.f) <= 60*fps`) silently became `0 - 0 <= N` — permanently true — and the
// tools went on to report confident, corroborated, *wrong* findings. `null` cannot be compared;
// it forces the caller to decide, and every caller here decides `unmeasurable`.
//
// USE THIS MODULE. Do not write `r.frame`, `r.f ?? 0`, or `r.player.region` in a new tool.
// If you need a field, run `--census` first and see whether anything writes it.
//
// CLI
//   node tools/lib/trace-schema.mjs --census            field census over every shipped .jsonl
//   node tools/lib/trace-schema.mjs --verify a.b,c.d    are these dotted paths ever written?
//   node tools/lib/trace-schema.mjs --self-test         falsification suite
//
// EXIT: 0 ok; 1 a verified field is written by nothing; 2 usage.
'use strict';

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const REPO = path.resolve(HERE, '..', '..');

export const TRACE_SCHEMA = 'elder-souls/trace@1';

/**
 * The canonical record shape, derived from `game/src/sim/record.js` and confirmed against every
 * shipped artifact. Kept here so a tool author can read the contract without reading the engine,
 * and so `--self-test` can assert the engine still honours it.
 *
 * Top level:      f, t_ms, input{}, player{}, civilians[], camera{}, enemies[], events[],
 *                 rng{}, env{}, perf?{}, character?{}
 * Frame key:      `f`. NOT `frame`. `frame` appears only in ui-text.jsonl, which is a
 *                 different artifact with a different writer.
 * Event shape:    { f, type, ... } — events carry their OWN `f`; see events.js:169.
 * Region:         `env.region`. NOT `player.region`, NOT `world.region`; neither exists.
 * Interior:       `env.interior`.
 * Crouch:         `player.stealth.crouched`. NOT `player.crouched`.
 * Two-handing:    `player.stance` ("one_hand" | "two_hand" | ...). NOT `player.two_handed`.
 * UI:             THERE IS NO `ui` SUBTREE. Menu/dialogue state reaches the trace only as
 *                 `events[].type == "surface_enter"`.
 */
export const CANON = {
  frame_key: 'f',
  legacy_frame_key: 'frame',
  region_path: 'env.region',
  writer: 'game/src/sim/record.js',
  event_frame_key: 'f',
  known_absent: {
    'player.region': 'use env.region',
    'world.region': 'use env.region',
    'player.crouched': 'use player.stealth.crouched',
    'player.two_handed': 'use player.stance === "two_hand"',
    'player.loadout': 'no writer; reconstruct from player.weapon_id / weapon_class / stance / offhand_kind',
    'ui.menu_open': 'no ui subtree; use events[].type == "surface_enter"',
    'ui.dialogue_open': 'no ui subtree; use events[].type == "surface_enter"',
    'ui.surface': 'no ui subtree; use events[].surface on a surface_enter event',
  },
};

// -------------------------------------------------------------------------------------------
// Readers. Every one of these returns null rather than a plausible-looking default.

/**
 * The frame number of a trace record, or **null** if the record does not carry one.
 *
 * Accepts both dialects because `--in` may legitimately be handed an old artifact, but NEVER
 * invents a number. A caller that treats null as 0 has re-introduced the bug this file exists
 * to kill; call `requireFrames()` and report `unmeasurable` instead.
 */
export function frameOf(r) {
  if (!r || typeof r !== 'object') return null;
  if (Number.isFinite(r.f)) return Number(r.f);
  if (Number.isFinite(r.frame)) return Number(r.frame);
  return null;
}

/** The frame of an EVENT. Events carry their own `f`; fall back to the record's. Null-safe. */
export function eventFrameOf(e, r) {
  if (e && typeof e === 'object') {
    if (Number.isFinite(e.f)) return Number(e.f);
    if (Number.isFinite(e.frame)) return Number(e.frame);
  }
  return frameOf(r);
}

/** The region at a record. `env.region` is the only path any writer emits. */
export function regionOf(r) {
  const v = r && r.env && r.env.region;
  return (v === undefined || v === null || v === '') ? null : v;
}

/** Is the player crouched at this record? `player.stealth.crouched`. Null if unknown. */
export function crouchedAt(r) {
  const s = r && r.player && r.player.stealth;
  return (s && typeof s.crouched === 'boolean') ? s.crouched : null;
}

/** Is the player two-handing at this record? Derived from `player.stance`. Null if unknown. */
export function twoHandedAt(r) {
  const st = r && r.player && r.player.stance;
  if (typeof st !== 'string' || !st) return null;
  return /two/.test(st);
}

/** Which frame key, if any, does this record set of records actually use? */
export function detectFrameKey(records) {
  for (const r of records) {
    if (!r || typeof r !== 'object') continue;
    if (Number.isFinite(r.f)) return 'f';
    if (Number.isFinite(r.frame)) return 'frame';
  }
  return null;
}

/**
 * Fail-closed gate. Call this before ANY frame arithmetic.
 * Returns {ok, key, n_with_frame, n_total, why}. `ok:false` means the caller must report
 * `unmeasurable` and exit non-zero — not fall back to 0.
 */
export function requireFrames(records) {
  const body = records.filter((r) => r && r._ !== 'header' && r._ !== 'footer');
  const key = detectFrameKey(body);
  const withFrame = body.filter((r) => frameOf(r) !== null).length;
  if (!body.length) {
    return { ok: false, key: null, n_with_frame: 0, n_total: 0,
      why: 'the trace has no body records at all' };
  }
  if (key === null) {
    return { ok: false, key: null, n_with_frame: 0, n_total: body.length,
      why: `no record carries a frame key. ${TRACE_SCHEMA} numbers frames \`f\` ` +
           `(${CANON.writer}); \`frame\` is accepted as a legacy alias. Neither is present, so ` +
           'every frame-windowed signature in this tool would be arithmetic on invented zeros.' };
  }
  return { ok: true, key, n_with_frame: withFrame, n_total: body.length, why: null };
}

// -------------------------------------------------------------------------------------------
// Artifact loading

/** Parse a .jsonl, tagging each record with its 1-based __line. Tolerates blank/garbage lines. */
export function readJsonl(file) {
  const out = [];
  const lines = fs.readFileSync(file, 'utf8').split('\n');
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i].trim();
    if (!l) continue;
    try { out.push({ ...JSON.parse(l), __line: i + 1 }); } catch { /* header/footer tolerance */ }
  }
  return out;
}

/** Body records only — header/footer sentinels stripped. */
export function bodyOf(records) {
  return records.filter((r) => r && r._ !== 'header' && r._ !== 'footer');
}

export function findArtifacts(root = path.join(REPO, 'reports'), name = null) {
  const out = [];
  const walk = (d) => {
    let ents;
    try { ents = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const e of ents) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.isFile() && e.name.endsWith('.jsonl') && (!name || e.name === name)) out.push(p);
    }
  };
  walk(root);
  return out.sort();
}

// -------------------------------------------------------------------------------------------
// The census — the thing that would have caught all four bugs.

/**
 * Walk every shipped .jsonl and count, per dotted field path, how many records and how many
 * artifacts carry it. Arrays are summarised at `[]` (e.g. `events[].type`).
 */
export function censusFields(files, { maxDepth = 4 } = {}) {
  const rec = new Map();   // path -> {records, artifacts:Set}
  const bump = (p, file) => {
    let e = rec.get(p);
    if (!e) { e = { records: 0, artifacts: new Set() }; rec.set(p, e); }
    e.records++; e.artifacts.add(file);
  };
  const visit = (obj, prefix, file, depth) => {
    if (depth > maxDepth || obj === null || typeof obj !== 'object') return;
    if (Array.isArray(obj)) {
      for (const v of obj) visit(v, prefix + '[]', file, depth);
      return;
    }
    for (const [k, v] of Object.entries(obj)) {
      if (k === '__line') continue;
      const p = prefix ? `${prefix}.${k}` : k;
      bump(p, file);
      if (v && typeof v === 'object') visit(v, p, file, depth + 1);
    }
  };
  let totalRecords = 0;
  for (const f of files) {
    for (const r of readJsonl(f)) { totalRecords++; visit(r, '', f, 0); }
  }
  const out = new Map();
  for (const [p, e] of rec) out.set(p, { records: e.records, artifacts: e.artifacts.size });
  return { fields: out, artifacts: files.length, records: totalRecords };
}

/**
 * Are these dotted paths written by anything? Returns {written:[], unwritten:[]}.
 * A tool declaring the fields it reads and running this at --self-test time cannot ship the
 * `FLAG_FIELDS` defect (a comment asserting a check is not a check — RI-MTH07 §D.3).
 */
export function verifyFields(paths, census) {
  const written = [], unwritten = [];
  for (const p of paths) {
    const hit = census.fields.get(p);
    if (hit && hit.records > 0) written.push({ path: p, ...hit });
    else unwritten.push({ path: p, hint: CANON.known_absent[p] || null });
  }
  return { written, unwritten };
}

// -------------------------------------------------------------------------------------------
// CLI

function main(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const k = a.slice(2);
    const nx = argv[i + 1];
    if (nx && !nx.startsWith('--')) { args[k] = nx; i++; } else args[k] = true;
  }
  if (args.help || argv.length === 0) {
    process.stdout.write(
      'trace-schema.mjs — the one reader for elder-souls/trace@1\n\n' +
      '  --census                 field census over every reports/**/*.jsonl\n' +
      '  --census --name trace.jsonl   restrict to one artifact name\n' +
      '  --verify a.b,c.d         exit 1 if any dotted path is written by nothing\n' +
      '  --self-test              falsification suite\n');
    return 0;
  }
  if (args['self-test']) return selfTest();

  const files = findArtifacts(path.join(REPO, 'reports'), args.name === true ? null : args.name || null);

  if (args.census) {
    const c = censusFields(files);
    process.stdout.write(`trace field census: ${c.artifacts} artifacts, ${c.records} records\n`);
    const rows = [...c.fields.entries()].sort((a, b) => b[1].records - a[1].records);
    const filt = typeof args.grep === 'string' ? new RegExp(args.grep) : null;
    for (const [p, v] of rows) {
      if (filt && !filt.test(p)) continue;
      process.stdout.write(`  ${String(v.records).padStart(8)} rec  ${String(v.artifacts).padStart(3)} art  ${p}\n`);
    }
    process.stdout.write('\nknown-absent paths tools have historically invented:\n');
    for (const [p, hint] of Object.entries(CANON.known_absent)) {
      const hit = c.fields.get(p);
      process.stdout.write(`  ${hit ? 'PRESENT NOW' : 'absent     '} ${p.padEnd(22)} -> ${hint}\n`);
    }
    return 0;
  }

  if (typeof args.verify === 'string') {
    const paths = args.verify.split(',').map((s) => s.trim()).filter(Boolean);
    const c = censusFields(files);
    const v = verifyFields(paths, c);
    for (const w of v.written) process.stdout.write(`  WRITTEN  ${w.path} — ${w.records} records / ${w.artifacts} artifacts\n`);
    for (const u of v.unwritten) process.stdout.write(`  ABSENT   ${u.path}${u.hint ? ` — ${u.hint}` : ' — no artifact in reports/ writes it'}\n`);
    return v.unwritten.length ? 1 : 0;
  }
  process.stderr.write('nothing to do; try --help\n');
  return 2;
}

function selfTest() {
  const L = []; let bad = 0;
  const ok = (n, pass, d) => { L.push(`${pass ? 'PASS' : 'FAIL'} ${n} — ${d}`); if (!pass) bad++; };

  // 1. The core rule. A record with no frame key yields null, not 0.
  ok('a record with no frame key reads null, NOT 0',
    frameOf({ player: {} }) === null, `frameOf({player:{}}) = ${JSON.stringify(frameOf({ player: {} }))}`);
  ok('frame 0 is preserved and is distinguishable from missing',
    frameOf({ f: 0 }) === 0 && frameOf({}) === null, 'f:0 -> 0, {} -> null');
  ok('the engine dialect `f` is read', frameOf({ f: 1234 }) === 1234, '1234');
  ok('the legacy dialect `frame` is accepted', frameOf({ frame: 99 }) === 99, '99');
  ok('`f` wins when both are present', frameOf({ f: 7, frame: 8 }) === 7, '7');

  // 2. Events carry their own f (events.js:169) and fall back to the record.
  ok('eventFrameOf reads the event\'s own f', eventFrameOf({ f: 61, type: 'first_input' }, { f: 5 }) === 61, '61');
  ok('eventFrameOf falls back to the record', eventFrameOf({ type: 'x' }, { f: 5 }) === 5, '5');
  ok('eventFrameOf returns null when neither has one', eventFrameOf({ type: 'x' }, {}) === null, 'null');

  // 3. The paths four tools invented.
  ok('regionOf reads env.region', regionOf({ env: { region: 'ashlands' } }) === 'ashlands', 'ashlands');
  ok('regionOf ignores the invented player.region',
    regionOf({ player: { region: 'ghost' }, env: {} }) === null, 'null — player.region has no writer');
  ok('crouchedAt reads player.stealth.crouched',
    crouchedAt({ player: { stealth: { crouched: true } } }) === true &&
    crouchedAt({ player: { crouched: true } }) === null, 'stealth block only');
  ok('twoHandedAt derives from player.stance',
    twoHandedAt({ player: { stance: 'two_hand' } }) === true &&
    twoHandedAt({ player: { stance: 'one_hand' } }) === false &&
    twoHandedAt({ player: {} }) === null, 'two_hand/one_hand/null');

  // 4. requireFrames is the fail-closed gate, and it must FAIL on the wrong dialect being absent.
  const rf0 = requireFrames([{ player: {} }, { player: {} }]);
  ok('requireFrames REFUSES a trace with no frame key', rf0.ok === false && !!rf0.why, rf0.why || '');
  const rf1 = requireFrames([{ f: 0 }, { f: 1 }]);
  ok('requireFrames accepts the engine dialect', rf1.ok === true && rf1.key === 'f', `key=${rf1.key}`);
  const rf2 = requireFrames([]);
  ok('requireFrames REFUSES an empty trace', rf2.ok === false, rf2.why || '');

  // 5. THE FALSIFICATION THAT MATTERS: the R3 defect, reconstructed. A 30-second window test
  //    over `r.frame ?? 0` on engine-dialect records is permanently true. Over frameOf() it is
  //    correctly false. If this ever passes, the class of bug is back.
  const engineRecs = [{ f: 0, events: [{ type: 'topic' }] }, { f: 100000, events: [{ type: 'item' }] }];
  const oldWay = engineRecs.map((r) => r.frame ?? 0);
  const newWay = engineRecs.map(frameOf);
  const win = 30 * 60;
  ok('R3 REGRESSION GUARD: the old `r.frame ?? 0` reader collapses a 27-minute gap to 0',
    (oldWay[1] - oldWay[0]) === 0 && (oldWay[1] - oldWay[0]) <= win,
    'this is the bug, demonstrated: 0 <= 1800 is always true');
  ok('R3 REGRESSION GUARD: frameOf() preserves the gap and the window test correctly FAILS',
    (newWay[1] - newWay[0]) === 100000 && !((newWay[1] - newWay[0]) <= win),
    `gap=${newWay[1] - newWay[0]} frames, not <= ${win}`);

  // 6. The census must find `f` on the real corpus and must NOT find the invented paths.
  const files = findArtifacts(path.join(REPO, 'reports'), 'trace.jsonl');
  if (files.length) {
    const c = censusFields(files.slice(0, 6));
    ok('census finds `f` on real shipped traces', (c.fields.get('f') || {}).records > 0,
      `${(c.fields.get('f') || {}).records} records over ${c.artifacts} artifacts`);
    ok('census does NOT find `frame` on real shipped traces', !c.fields.has('frame'),
      'trace.jsonl has never carried `frame`');
    const inv = Object.keys(CANON.known_absent).filter((p) => c.fields.has(p));
    ok('none of the historically-invented paths exist on real traces', inv.length === 0,
      inv.length ? `PRESENT: ${inv.join(', ')}` : `all ${Object.keys(CANON.known_absent).length} confirmed absent`);
    ok('census finds env.region, the real region path', (c.fields.get('env.region') || {}).records > 0,
      `${(c.fields.get('env.region') || {}).records} records`);
    ok('census finds events[].f — events carry their own frame',
      (c.fields.get('events[].f') || {}).records > 0, `${(c.fields.get('events[].f') || {}).records} events`);
  } else {
    ok('census could run against shipped traces', false, 'no trace.jsonl under reports/ — cannot verify');
  }

  // 7. verifyFields must go red on an absent field. A checker that cannot go red is not a check.
  const c2 = censusFields(findArtifacts(path.join(REPO, 'reports'), 'trace.jsonl').slice(0, 3));
  const v = verifyFields(['f', 'ui.menu_open'], c2);
  ok('verifyFields separates written from absent (falsification)',
    v.written.length === 1 && v.unwritten.length === 1 && v.unwritten[0].path === 'ui.menu_open',
    `written=${v.written.map((x) => x.path)}, absent=${v.unwritten.map((x) => x.path)}`);

  // 8. The engine's writer still names `f`. If someone renames it, this file must be updated.
  const src = fs.readFileSync(path.join(REPO, CANON.writer), 'utf8');
  ok('the engine writer still emits `f: sim.frame`', /\bf:\s*sim\.frame\b/.test(src),
    `${CANON.writer} checked, not assumed`);
  ok('the engine writer still emits env.region', /region:\s*sim\.env\.region/.test(src), 'env.region');

  for (const l of L) process.stdout.write(l + '\n');
  process.stdout.write(`\ntrace-schema self-test: ${bad === 0 ? 'PASS' : 'FAIL'} (${L.length - bad}/${L.length})\n`);
  return bad === 0 ? 0 : 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  process.exit(main(process.argv.slice(2)));
}
