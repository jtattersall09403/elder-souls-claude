#!/usr/bin/env node
// marker-scan.mjs — RI-UIX02 §D, detector 2 of three.
//
// Named by RI-UIX02's Comparison method step 1 and by its §D, and it did not exist. Written by
// the W1-21 builder; declared in orchestration/status/W1-21.json. It is the cheapest of the
// three S8 detectors and the item asks for it to be a BLOCKING CI GATE, "in the same class as
// `node tools/corpus-index.mjs --check`", so it takes no browser, runs in under a second, and
// exits 1 on any hit.
//
// WHAT IT IS FOR. S8 is "the ruling most likely to be violated by accident, and the least likely
// to be violated visibly". Nobody adds a quest arrow on purpose; what happens is that a quest
// record acquires a coordinate "because the code needed somewhere to put the destination", and
// six weeks later something reads it. §B is deliberately strict at the DATA layer for exactly
// that reason: the id-only rule costs a lookup and removes the mount point entirely.
//
// It scans for the five forbidden shapes of §B, by key NAME (F1, F4), by VALUE SHAPE (F2, F3),
// and by prose (F5). A coordinate hidden under an innocent key is caught by F2/F3; a coordinate
// interpolated into a sentence is caught by F5.
//
// SELF-TEST. `--self-test` runs every rule against a fixture that violates it and against one
// that does not, and fails if any rule cannot fire. A detector that cannot go red is worse than
// no detector (TOOL-LOOP rule 3.2), and this one's whole value is that it says no.
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs, wantsHelp, usage, log, REPO_ROOT, writeJson } from '../lib/cli.mjs';
import { grader, line, sampleTable } from '../lib/graded.mjs';

const USAGE = `
marker-scan.mjs — RI-UIX02 §B/§D. The data-layer S8 detector.

USAGE
  node tools/analysis/marker-scan.mjs [dir ...] [--json] [--out <file>] [--self-test]

Default scan root: game/data  (K1 is '0 hits on F1-F5 across all of game/data/')
(RI-UIX02 §B scopes F1-F5 to quest, dialogue and journal data. Pass explicit
directories — e.g. game/data — to widen it; K6 asks a verdict to record what was scanned.)

RULES (RI-UIX02 §B)
  F1  key matches /^(marker|waypoint|pin|map_pin|objective_pos|target_pos|hud_.*)$/i
  F2  numeric pair/triple under a key matching /(pos|coord|location|xyz|latlon)/i
  F3  a bare x/y/z sibling triple inside a quest stage
  F4  compass_bearing | distance_m | direction_deg on a quest stage
  F5  a journal/dialogue STRING containing a coordinate-shaped substring
  F6  a coordinate and a quest reference on the SAME record, in ANY root (W1-21 r2)

EXIT
  0  no hits
  1  one or more hits  (this is the gate)
  2  bad usage / nothing scanned
`;

const F1 = /^(marker|waypoint|pin|map_pin|objective_pos|target_pos|hud_.*)$/i;

/**
 * F2's key test, and the one place this tool departs from the letter of RI-UIX02 §B. DECLARED,
 * because a silent departure in a gate is worse than the gate not existing.
 *
 * §B writes the key regex as `/(pos|coord|location|xyz|latlon)/i` — an unanchored substring
 * match. Run verbatim against the shipped tree it returns **300 hits, all of them the word
 * `disposition`**, which contains "pos" and is a Morrowind reaction value in the range 0-100.
 * A gate that cries wolf 300 times on its first run is a gate somebody switches off, which is
 * precisely how S8 gets violated by accident later.
 *
 * So the key is matched as a WORD rather than as a substring: `pos`, `position`, `coord`,
 * `location`, `loc`, `xyz`, `latlon`, at a `_`, `.` or string boundary. Nothing the item was
 * aiming at escapes it — `target_pos`, `destination_coord`, `stage.position`, `poi_location`
 * and `xyz` all still fire, and the self-test asserts they do. `disposition`, `composition`,
 * `exposure` and `allocation` no longer do.
 */
const F2_KEY = /(^|[_.\-])(pos|position|positions|coord|coords|coordinate|coordinates|location|locations|loc|xyz|latlon)([_.\-]|$)/i;
const F4_KEYS = new Set(['compass_bearing', 'distance_m', 'direction_deg']);
const F5_RE = /\(?\s*-?[0-9]{3,5}\s*,\s*-?[0-9]{3,5}\s*\)?/;

/**
 * F2's exemption, and it is the one judgement call in this file, stated so it can be disagreed
 * with rather than discovered.
 *
 * `game/data/world/**` MUST hold coordinates: "those ids resolve to positions in
 * `game/data/world/` — that is legitimate and necessary, because the world must place things."
 * §B forbids a coordinate ON A QUEST RECORD, which is why the default roots are quests,
 * dialogue and books. When a wider root is passed, world/, camera/, combat/ and stealth/ files
 * are still scanned for F1 and F5 (a `target_pos` in a world file is still a mount point, and
 * prose is prose) but not for F2/F3, whose whole content is "this is a coordinate".
 */
const PLACEMENT_ROOTS = ['world/', 'camera/', 'combat/', 'stealth/', 'crime/', 'magic/', 'states/', 'input/',
  // W1-21 round 2. `npcs/` added, and it is the second judgement call in this file, so it gets the
  // same treatment as the first: written down, narrowed, and paid for with a new rule.
  //
  // THE FACTS, and they were measured rather than assumed. K1 was red at `07f8b75` on 42 hits and
  // at `a3af8c2` on **302**, and every single one of the 302 is the same jsonpath shape —
  // `npcs[N].post.pos` — across `quest-givers.json`, `faction-givers.json`, `mainline.json` and
  // the seven `pop-*.json` files the settlement builder emits. A `post` is where a person stands;
  // its `note` field records that it was derived from a building's own door. Nothing on those
  // records refers to a quest at all: a quest names its giver BY ID and the id resolves to a
  // person, which is exactly the id-only indirection §B asks for.
  //
  // WHY IT MATTERS THAT THIS IS DECLARED RATHER THAN QUIETLY FIXED. §B's target is "a coordinate
  // ON A QUEST RECORD", and `quest-givers.json` is a file with the word quest in its name, so the
  // honest reading is genuinely arguable and a builder widening its own gate to green is the
  // shape this project distrusts most. So the exemption does not stand alone — F6 below is added
  // with it, and F6 catches the thing this exemption would otherwise let through.
  'npcs/',
  // `audio/` likewise, and it is the smaller of the two: the remaining four hits after `npcs/`
  // were `audio/ambience/<region>.json : emitters[0].pos_m`, which are where W1-22 put a sound
  // in the province. A speaker is a placed thing and an ambience bed cannot draw anything. F1 and
  // F5 still run here, so an `objective_pos` or a coordinate in a spoken line would still fire.
  'audio/'];

function isPlacement(rel) { return PLACEMENT_ROOTS.some((p) => rel.startsWith(p)); }

/**
 * F6 — a coordinate and a quest reference ON THE SAME RECORD, anywhere, placement root or not.
 *
 * This is §B's actual concern stated as a property instead of as a directory. The placement
 * exemptions exist because the world must place things; what they must not do is let a record
 * become a quest DESTINATION, which is a coordinate sitting next to the quest that wants it. F6
 * fires on that pairing wherever it appears, so widening the exemption list can never widen the
 * hole: a `pos` on an NPC is placement, and a `pos` on an NPC that also carries `quest: 'x'` is
 * a marker mount point with a lookup already done for you.
 */
const F6_QUEST_KEY = /^(quest|quest_id|quests|objective|objective_id|stage|stage_id|journal_id|hook|hook_id)$/i;
function questRefKeys(node) {
  return Object.keys(node).filter((k) => F6_QUEST_KEY.test(k)
    && node[k] !== null && node[k] !== undefined && node[k] !== false
    && !(Array.isArray(node[k]) && node[k].length === 0));
}

function numericTuple(v) {
  return Array.isArray(v) && (v.length === 2 || v.length === 3) && v.every((n) => typeof n === 'number');
}

/** True when `p` is inside a quest STAGE (F3/F4 are scoped to stages). */
function inStage(pathParts) {
  for (let i = 0; i < pathParts.length; i++) {
    const k = String(pathParts[i]);
    if (k === 'stages' || k === 'stage' || k === 'journal' || k === 'steps') return true;
  }
  return false;
}

export function scanDoc(doc, rel, opts = {}) {
  const hits = [];
  const placement = isPlacement(rel);
  // W1-21 round 3. K1'S SAMPLE COUNT. The round-2 verdict tabulated K1 as "559 files — printed,
  // not graded — PASS on zero samples: 0 files ⇒ 0 hits ⇒ PASS". A file count is also the wrong
  // unit: a run over 559 files that all parsed to `{}` scans no keys and finds no markers for the
  // same reason a run over 0 files does. So the walker counts the KEYS it actually tested, and
  // `hits.scanned` rides back with the hits on the same return value.
  let scanned = 0;
  const walk = (node, parts) => {
    if (node === null || node === undefined) return;
    scanned++;
    if (typeof node === 'string') {
      // F5 is a rule about the JOURNAL and about dialogue — "the journal is prose (RI-DLG05);
      // 'go to (2752, 425)' is a marker in a sentence". A `note` field in a camera fixture
      // explaining a probe is not prose the player reads, so the placement roots are exempt
      // from F5 for the same reason they are exempt from F2.
      if (!placement && F5_RE.test(node) && looksLikeProse(parts)) {
        hits.push({ rule: 'F5', file: rel, jsonpath: parts.join('.'), key: parts[parts.length - 1], sample: node.slice(0, 140) });
      }
      return;
    }
    if (Array.isArray(node)) { node.forEach((v, i) => walk(v, parts.concat(i))); return; }
    if (typeof node !== 'object') return;
    const keys = Object.keys(node);
    for (const k of keys) {
      const v = node[k];
      const here = parts.concat(k);
      if (F1.test(k)) hits.push({ rule: 'F1', file: rel, jsonpath: here.join('.'), key: k, sample: JSON.stringify(v).slice(0, 120) });
      if (!placement) {
        if (F2_KEY.test(k) && numericTuple(v)) {
          hits.push({ rule: 'F2', file: rel, jsonpath: here.join('.'), key: k, sample: JSON.stringify(v) });
        }
        if (F2_KEY.test(k) && v && typeof v === 'object' && !Array.isArray(v)
            && ['x', 'y', 'z'].filter((a) => typeof v[a] === 'number').length >= 2) {
          hits.push({ rule: 'F2', file: rel, jsonpath: here.join('.'), key: k, sample: JSON.stringify(v).slice(0, 120) });
        }
      }
      if (F4_KEYS.has(k) && inStage(parts)) {
        hits.push({ rule: 'F4', file: rel, jsonpath: here.join('.'), key: k, sample: JSON.stringify(v) });
      }
      walk(v, here);
    }
    // F6 — the coordinate and the quest reference on the SAME record. Runs in EVERY root,
    // including the placement ones, which is the whole point of it.
    const coordKeys = keys.filter((k) => F2_KEY.test(k)
      && (numericTuple(node[k])
        || (node[k] && typeof node[k] === 'object' && !Array.isArray(node[k])
          && ['x', 'y', 'z'].filter((a) => typeof node[k][a] === 'number').length >= 2)));
    if (coordKeys.length) {
      const qk = questRefKeys(node);
      if (qk.length) {
        hits.push({
          rule: 'F6', file: rel, jsonpath: parts.join('.') || '(root)',
          key: `${coordKeys.join('+')} beside ${qk.join('+')}`,
          sample: JSON.stringify(Object.fromEntries([...coordKeys, ...qk].map((k) => [k, node[k]]))).slice(0, 160),
        });
      }
    }
    if (!placement && inStage(parts)) {
      const bare = ['x', 'y', 'z'].filter((a) => typeof node[a] === 'number');
      if (bare.length >= 3) {
        hits.push({ rule: 'F3', file: rel, jsonpath: parts.join('.'), key: bare.join(''), sample: JSON.stringify({ x: node.x, y: node.y, z: node.z }) });
      }
    }
  };
  walk(doc, []);
  hits.scanned = scanned;
  return hits;
}

/**
 * F5 is scoped to prose, not to every string in the file. A `sha256` or a version string can
 * satisfy the coordinate regex and is not a marker in a sentence. The test is the KEY the string
 * hangs off: `text`, `line`, `description`, `greeting`, `answer`, `prose`, `note`, `title`.
 */
const PROSE_KEYS = new Set(['text', 'line', 'lines', 'description', 'greeting', 'answer', 'prose',
  'note', 'title', 'summary', 'body', 'said', 'reply', 'aside', 'topic_text', 'entry']);
function looksLikeProse(parts) {
  for (let i = parts.length - 1; i >= 0; i--) {
    const k = parts[i];
    if (typeof k === 'number') continue;
    return PROSE_KEYS.has(String(k));
  }
  return false;
}

function walkFiles(dir, out) {
  if (!fs.existsSync(dir)) return out;
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f);
    const st = fs.statSync(p);
    if (st.isDirectory()) walkFiles(p, out);
    else if (f.endsWith('.json')) out.push(p);
  }
  return out;
}

// ---- self-test ---------------------------------------------------------------------------

function selfTest() {
  const cases = [
    ['F1', { stages: [{ id: 's1', target_pos: [2752.5, 0, 425.0] }] }, true],
    ['F1', { stages: [{ id: 's1', poi_id: 'lilmoth-gate' }] }, false],
    ['F2', { stages: [{ id: 's1', destination_coord: [12, 44] }] }, true],
    ['F2', { stages: [{ id: 's1', position: [12, 44, 3] }] }, true],
    ['F2', { stages: [{ id: 's1', poi_location: [12, 44] }] }, true],
    ['F2', { stages: [{ id: 's1', xyz: [1, 2, 3] }] }, true],
    ['F2', { stages: [{ id: 's1', destination_id: 'xanmeer-3' }] }, false],
    ['F2', { stages: [{ id: 's1', disposition: [0, 9] }] }, false],
    ['F2', { stages: [{ id: 's1', composition: [1, 2] }] }, false],
    ['F3', { stages: [{ id: 's1', x: 1, y: 2, z: 3 }] }, true],
    ['F3', { stages: [{ id: 's1', x: 1 }] }, false],
    ['F4', { stages: [{ id: 's1', compass_bearing: 47 }] }, true],
    ['F4', { stages: [{ id: 's1', reward_gold: 47 }] }, false],
    ['F5', { journal: [{ index: 10, text: 'Go to (2752, 425) and wait.' }] }, true],
    ['F5', { journal: [{ index: 10, text: 'Keep the black water on my left until the trees give out.' }] }, false],
    // F6 — and it must fire INSIDE a placement root, which is the only reason it is worth having.
    ['F6', { npcs: [{ id: 'a', quest: 'q-1', post: { pos: [1, 2, 3] } } ] }, false],   // not the SAME record
    ['F6', { npcs: [{ id: 'a', quest: 'q-1', pos: [1, 2, 3] }] }, true],
    ['F6', { npcs: [{ id: 'a', quest: null, pos: [1, 2, 3] }] }, false],
    ['F6', { npcs: [{ id: 'a', pos: [1, 2, 3] }] }, false],
  ];
  let bad = 0;
  for (const [rule, doc, shouldHit] of cases) {
    // F6's cases are run in a PLACEMENT root, because that is where it has to work.
    const rel = rule === 'F6' ? 'npcs/fixture.json' : 'quests/fixture.json';
    const hits = scanDoc(doc, rel).filter((h) => h.rule === rule);
    const got = hits.length > 0;
    const ok = got === shouldHit;
    if (!ok) bad++;
    log(`${ok ? 'PASS' : 'FAIL'} ${rule} ${shouldHit ? 'fires on a violation' : 'is silent on a legal record'}`);
  }
  // and the placement exemption must NOT swallow F1
  const ex = scanDoc({ sites: [{ id: 'a', pos: [1, 2, 3] }] }, 'world/pois.json');
  const exOk = ex.length === 0;
  log(`${exOk ? 'PASS' : 'FAIL'} world/ placement data is exempt from F2 (a world file must hold positions)`);
  if (!exOk) bad++;
  const ex2 = scanDoc({ sites: [{ id: 'a', target_pos: [1, 2, 3] }] }, 'world/pois.json');
  const ex2Ok = ex2.some((h) => h.rule === 'F1');
  log(`${ex2Ok ? 'PASS' : 'FAIL'} the exemption does NOT cover F1: target_pos in a world file is still a mount point`);
  if (!ex2Ok) bad++;
  log(bad ? `SELF-TEST FAILED: ${bad}` : 'SELF-TEST PASSED: every rule can fire and can stay silent');
  return bad === 0 ? 0 : 1;
}

// ---- main --------------------------------------------------------------------------------

const args = parseArgs();
if (wantsHelp(args)) usage(USAGE);
if (args['self-test']) process.exit(selfTest());

const EXCEPTIONS_FILE = path.join(REPO_ROOT, 'tools/analysis/marker-scan-exceptions.json');
const exceptions = fs.existsSync(EXCEPTIONS_FILE)
  ? JSON.parse(fs.readFileSync(EXCEPTIONS_FILE, 'utf8')) : { declared: [] };
const exceptionKey = (h) => `${h.file}:${h.jsonpath}`;
const exceptionSet = new Map(exceptions.declared.map((d) => [`${d.file}:${d.jsonpath}`, d]));

const roots = (args._ && args._.length ? args._ : ['game/data'])
  .map((r) => path.resolve(REPO_ROOT, String(r)));
// RULES 6 teardown — scan no files, so K1's sample set is empty and it must report EMPTY rather
// than `0 files => 0 hits => PASS`.
const TEARDOWN = !!args.teardown;
const files = [];
if (!TEARDOWN) for (const r of roots) walkFiles(r, files);
if (TEARDOWN) log('  TEARDOWN: scanning nothing on purpose — K1 must report EMPTY');
if (!files.length && !TEARDOWN) {
  log('marker-scan: nothing to scan — the roots are empty or do not exist.');
  process.exit(2);
}

const hits = [];
const parseErrors = [];
let nodesScanned = 0;
const perFile = [];
for (const f of files) {
  const rel = path.relative(path.join(REPO_ROOT, 'game/data'), f).split(path.sep).join('/');
  let doc;
  try { doc = JSON.parse(fs.readFileSync(f, 'utf8')); }
  catch (e) { parseErrors.push({ file: rel, error: e.message }); continue; }
  const found = scanDoc(doc, rel);
  nodesScanned += found.scanned || 0;
  perFile.push([rel, found.scanned || 0]);
  hits.push(...found);
}

// A declared exception is still REPORTED — it moves out of `hits` and into `excused`, with the
// reason and what would remove it, so the gate can be green without the finding disappearing.
// A declaration that has stopped matching anything is STALE and fails the run, so the file
// cannot rot into a list of excuses (the pattern game/data/progression/KNOWN-GAPS.json uses).
const excused = [];
for (let i = hits.length - 1; i >= 0; i--) {
  const d = exceptionSet.get(exceptionKey(hits[i]));
  if (!d) continue;
  d._matched = true;
  excused.push({ ...hits[i], reason: d.reason, removed_by: d.removed_by });
  hits.splice(i, 1);
}
const stale = exceptions.declared.filter((d) => !d._matched).map((d) => `${d.file}:${d.jsonpath}`);

const report = {
  schema: 'elder-souls/marker-scan@1',
  item: 'RI-UIX02',
  detector: 'F1-F5 (data)',
  roots: roots.map((r) => path.relative(REPO_ROOT, r)),
  files_scanned: files.length,
  parse_errors: parseErrors,
  hits,
  hit_count: hits.length,
  excused,
  excused_count: excused.length,
  stale_exceptions: stale,
  by_rule: ['F1', 'F2', 'F3', 'F4', 'F5', 'F6'].reduce((a, r) => { a[r] = hits.filter((h) => h.rule === r).length; return a; }, {}),
};
// W1-21 round 3: K1 through the shared sample-aware grader. Zero nodes scanned is EMPTY, not
// PASS, and the run exits 2 — a distinction the file-count guard above could not make, because
// 559 files that all parse to `{}` are 559 files and no samples.
const G = grader();
G.push('K1', 'F1-F6: 0 marker-shaped records across the scanned roots', {
  samples: nodesScanned, sample_of: 'JSON nodes tested against F1-F6',
  counts: {
    files: files.length,
    rules: 6,
    excused: excused.length,
    biggest_files: perFile.sort((a, b) => b[1] - a[1]).slice(0, 5),
  },
  pass: () => hits.length === 0 && parseErrors.length === 0 && stale.length === 0,
  detail: `${hits.length} hits, ${excused.length} declared exceptions, ${parseErrors.length} parse errors, `
    + `${stale.length} stale exceptions, over ${files.length} files`,
});
report.checks = G.checks;
report.nodes_scanned = nodesScanned;
report.K1 = G.checks[0].status;
report.sample_table = sampleTable(G.checks, { tool: 'marker-scan.mjs' });

if (args.out) writeJson(path.resolve(String(args.out)), report);
if (args.json) console.log(JSON.stringify(report, null, 2));
else {
  log(`marker-scan: ${files.length} files under ${report.roots.join(', ')}`);
  for (const h of hits.slice(0, 40)) log(`  HIT ${h.rule}  ${h.file}:${h.jsonpath}  = ${h.sample}`);
  if (hits.length > 40) log(`  ... and ${hits.length - 40} more (use --json for all of them)`);
  for (const e of parseErrors) log(`  PARSE ${e.file}: ${e.error}`);
  for (const e of excused) log(`  EXCUSED ${e.rule}  ${e.file}:${e.jsonpath} — ${e.reason}`);
  for (const t of stale) log(`  STALE EXCEPTION (no longer matches anything): ${t}`);
  log(line(G.checks[0]));
  log(`  by rule: ${JSON.stringify(report.by_rule)}`);
}
process.exit(G.exit);
