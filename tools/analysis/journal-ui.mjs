#!/usr/bin/env node
// journal-ui.mjs — RI-UIX04. The journal screen, measured rather than read.
//
// Named by RI-UIX04's Comparison method steps 1, 2 and 5, and by RI-DLG05, and it did not exist.
// Written by the W1-21 builder; declared in orchestration/status/W1-21.json.
//
// THE ONE NUMBER THIS TOOL EXISTS FOR is JU2's `interleave_ratio`, and the item is explicit
// about why: "This single number distinguishes a journal from a quest log, and it does so
// without any judgement call." It is computed from the RENDERED ELEMENT ORDER — not from the
// data, not from the sort function, from the order the screen actually put things on the page —
// because "a critic opens the journal, sees the entries are well written, and scores the
// content, which RI-DLG05 already scored".
//
// The derivation the threshold rests on, restated so a reader can check it rather than believe
// it: with n entries from q quests, a quest-GROUPED view produces exactly q−1 adjacent pairs
// with differing journal_id out of n−1 pairs. A date-interleaved view of q concurrent quests
// approaches 1 − 1/q. So this tool prints BOTH bounds next to the measured ratio, and a critic
// running it on a fixture of a different size can see immediately whether 0.5 is still the
// right bar for that size — RI-UIX04's own warning that "a critic running JU2 on a 40-entry
// state and comparing against 0.5 is using the wrong bar".
//
// It also runs: JU1 (chronological), JU3 (declared prohibitions), JU5 (append-only, byte
// comparison), JU6 (the index carries names and no state), JU7 (search, chronological, and a
// topic never opens a map), JU8 (no map reachable AND none exists), JU9 (verbatim, untruncated),
// and the RI-DLG05 F5 grep over the RENDERED text rather than over the source data.
import fs from 'node:fs';
import path from 'node:path';
import { launchGame } from '../lib/browser.mjs';
import { parseArgs, wantsHelp, usage, log, RUNS_DIR, ensureDir, writeJson, REPO_ROOT } from '../lib/cli.mjs';

const USAGE = `
journal-ui.mjs — RI-UIX04 JU1-JU11, measured on the running screen.

USAGE
  node tools/analysis/journal-ui.mjs [--state ui-journal] [--out <dir>] [--json]
  node tools/analysis/journal-ui.mjs --in reports/journal.json          # static structure only
  node tools/analysis/journal-ui.mjs --diff a.json b.json --expect append-only

EXIT 0 all checks pass · 1 one or more fail · 2 could not measure
`;

const args = parseArgs();
if (wantsHelp(args)) usage(USAGE);

const FORBIDDEN_TEXT = /\b(objective|current objective|tracked|active quests?|to ?do|next step|complete[d]?\s*[:%]|\d+\s*\/\s*\d+\s*(collected|found|done))\b/i;
const FORBIDDEN_GLYPH = /[▸✓☐✔☑■□]|\b\d+%/;
const COORD = /\(?\s*-?[0-9]{3,5}\s*,\s*-?[0-9]{3,5}\s*\)?/;

// ---- --diff: JU5, append-only, by byte comparison -----------------------------------------
if (args.diff) {
  const [pa, pb] = [String(args.diff), String(args._[0] || '')];
  if (!pb) { log('journal-ui --diff needs two capture files'); process.exit(2); }
  const A = JSON.parse(fs.readFileSync(pa, 'utf8'));
  const B = JSON.parse(fs.readFileSync(pb, 'utf8'));
  const key = (e) => `${e.journal_id}/${e.index}`;
  const mapB = new Map(B.entries.map((e) => [key(e), e]));
  const changed = [], missing = [];
  for (const e of A.entries) {
    const b = mapB.get(key(e));
    if (!b) { missing.push(key(e)); continue; }
    if (b.text !== e.text || b.date !== e.date) changed.push({ key: key(e), before: e.text, after: b.text });
  }
  const superset = A.entries.every((e) => mapB.has(key(e))) && B.entries.length >= A.entries.length;
  const ok = !changed.length && !missing.length && superset;
  const rep = {
    schema: 'elder-souls/journal-diff@1', item: 'RI-UIX04', check: 'JU5 append-only',
    before: A.entries.length, after: B.entries.length,
    changed, missing, strict_superset: superset, JU5: ok ? 'PASS' : 'FAIL',
  };
  console.log(JSON.stringify(rep, null, 2));
  process.exit(ok ? 0 : 1);
}

// ---- --in: the static structure check (no browser) -----------------------------------------
if (args.in) {
  const j = JSON.parse(fs.readFileSync(String(args.in), 'utf8'));
  const entries = j.entries || j;
  const byQuest = new Map();
  for (const e of entries) {
    const id = e.journal_id || e.quest;
    if (!byQuest.has(id)) byQuest.set(id, []);
    byQuest.get(id).push(e);
  }
  const problems = [];
  for (const [id, list] of byQuest) {
    const named = list.filter((e) => (e.flags || []).includes('quest_name'));
    if (named.length !== 1) problems.push(`${id}: ${named.length} quest_name-flagged entries (J4 wants exactly 1)`);
    const idx = list.map((e) => e.index === undefined ? e.n : e.index);
    for (let i = 1; i < idx.length; i++) if (idx[i] <= idx[i - 1]) problems.push(`${id}: indices not ascending at ${idx[i - 1]} -> ${idx[i]}`);
  }
  const rep = { schema: 'elder-souls/journal-static@1', quests: byQuest.size, entries: entries.length, problems, ok: !problems.length };
  console.log(JSON.stringify(rep, null, 2));
  process.exit(rep.ok ? 0 : 1);
}

// ---- the live screen ------------------------------------------------------------------------
const RUN = path.join(RUNS_DIR, String(args.out || 'JOURNAL-UI'));
const state = String(args.state || 'ui-journal');
const h = await launchGame({ width: Number(args.width || 1280), height: Number(args.height || 720), timeout: 240000 });
const out = { schema: 'elder-souls/journal-ui@1', item: 'RI-UIX04', at: new Date().toISOString(), state, checks: [] };

try {
  await h.h('setRenderRate', 0);
  await h.h('loadState', state);
  await h.h('stepFrames', 2);
  await h.h('openMenu', 'journal');
  const ui = await h.h('getUIState');

  const rendered = ui.elements.filter((e) => e.kind === 'journal_entry' && e.meta);
  const order = rendered.map((e) => ({ id: e.meta.journal_id, n: e.meta.index, day: e.meta.day, text: e.text, visible: e.visible }));
  const quests = new Set(order.map((o) => o.id));

  // JU1: is the rendered order (date_written, index) ascending?
  let chronological = true;
  for (let i = 1; i < order.length; i++) {
    if (order[i].day < order[i - 1].day || (order[i].day === order[i - 1].day && order[i].n < order[i - 1].n)) chronological = false;
  }
  // JU2, from render order.
  let diff = 0;
  for (let i = 1; i < order.length; i++) if (order[i].id !== order[i - 1].id) diff++;
  const ratio = order.length > 1 ? diff / (order.length - 1) : 0;
  const groupedCeiling = order.length > 1 ? (quests.size - 1) / (order.length - 1) : 0;
  const interleavedIdeal = quests.size ? 1 - 1 / quests.size : 0;

  out.fixture = { entries: order.length, quests: quests.size, visible_on_spread: order.filter((o) => o.visible).length };
  out.interleave = {
    measured: +ratio.toFixed(4),
    grouped_view_ceiling_for_this_size: +groupedCeiling.toFixed(4),
    date_interleaved_ideal: +interleavedIdeal.toFixed(4),
    bar: 0.5, hard_fail_at_or_below: 0.30,
    fixture_is_the_item_size: order.length >= 12 && quests.size >= 4,
  };

  // JU3: declared prohibitions.
  const declaredHits = ui.elements.filter((e) => {
    const t = String(e.text || '');
    return FORBIDDEN_TEXT.test(t) || FORBIDDEN_GLYPH.test(t)
      || /objective|tracker|active_quest|progress|checkbox|track|complete/.test(e.kind);
  }).map((e) => ({ id: e.id, kind: e.kind, text: e.text }));

  // JU4: observed. The rendered-text accessor (RI-JRN01 M9/M15 require one) IS the element
  // text, and it is the string that went through the glyph rasteriser — `el()` is the only
  // drawing path, so there is no text on this screen that is not in `elements[].text`.
  const renderedText = ui.elements.filter((e) => e.visible && e.text).map((e) => String(e.text)).join('\n');
  const observedHits = [];
  for (const re of [FORBIDDEN_TEXT, FORBIDDEN_GLYPH]) {
    const m = renderedText.match(new RegExp(re.source, 'gi'));
    if (m) observedHits.push(...m);
  }
  // F5 over the RENDERED journal, not over the source data.
  const coordHits = (renderedText.match(new RegExp(COORD.source, 'g')) || []);

  // JU6: the index carries display names and no state decoration.
  const idx = ui.elements.filter((e) => e.kind === 'journal_index_row');
  const idxDecorated = idx.filter((e) => /\d+\s*\/\s*\d+|\(\d+\)|active|complete|done|new/i.test(String(e.text || '')));

  // JU7: search, chronological, and a topic never opens a map.
  const search = await h.h('uiSearch', 'count');
  await h.h('openMenu', 'journal');

  // JU8: no map, reachable or otherwise.
  const nav = ui.navigable;
  let mapThrew = false, mapMessage = '';
  try { await h.page.evaluate(() => window.__HARNESS.openMenu('map')); }
  catch (e) { mapThrew = true; mapMessage = String(e.message || e); }
  if (!mapThrew) {
    const r = await h.page.evaluate(() => { try { window.__HARNESS.openMenu('map'); return null; } catch (e) { return String(e.message); } });
    if (r) { mapThrew = true; mapMessage = r; }
  }
  const menus = await h.h('listMenus');

  // JU9: verbatim and untruncated — every rendered entry's text must be byte-identical to the
  // entry in `getQuestState().journal`, and must not end in an ellipsis.
  const source = (await h.h('getQuestState')).journal;
  const truncated = [], altered = [];
  for (const o of order) {
    const src = source.find((e) => e.quest === o.id && e.n === o.n);
    if (!src) { altered.push(`${o.id}/${o.n} rendered but not in the journal`); continue; }
    if (src.text !== o.text) altered.push(`${o.id}/${o.n} rendered text differs from the entry`);
    if (/…\s*$/.test(String(o.text))) truncated.push(`${o.id}/${o.n}`);
  }

  // JU11: the pause rule on this screen.
  const f0 = await h.h('getFrame');
  await h.h('stepFrames', 120);
  const f1 = await h.h('getFrame');

  const push = (id, what, pass, detail) => out.checks.push({ id, what, pass, detail });
  push('JU1', 'chronological default (J1)', chronological && order.length > 0, `${order.length} entries, ascending by (day, index): ${chronological}`);
  push('JU2', 'interleave_ratio >= 0.5 on a >=4-quest / >=12-entry fixture',
    ratio >= 0.5 && out.interleave.fixture_is_the_item_size,
    `measured ${ratio.toFixed(4)} (grouped-view ceiling for this size ${groupedCeiling.toFixed(4)}, date-interleaved ideal ${interleavedIdeal.toFixed(4)}); fixture ${order.length} entries / ${quests.size} quests`);
  push('JU3', 'prohibitions, declared (§B)', declaredHits.length === 0, JSON.stringify(declaredHits));
  push('JU4', 'prohibitions, observed in the rendered text', observedHits.length === 0, JSON.stringify(observedHits.slice(0, 8)));
  push('JU6', 'quest index: names only, no state decoration (J4-J6)',
    idx.length > 0 && idxDecorated.length === 0, `${idx.length} index rows, ${idxDecorated.length} decorated`);
  push('JU7', 'search returns chronological results (J7)',
    !!search && search.chronological, `query "${search && search.query}" -> ${search && search.count} results, chronological ${search && search.chronological}`);
  push('JU8', 'no map: unreachable AND non-existent (Q7)',
    nav.indexOf('map') < 0 && menus.indexOf('map') < 0 && mapThrew && ui.map_exists === false,
    `navigable=[${nav.join(',')}] openMenu names=[${menus.join(',')}] openMenu('map') threw=${mapThrew}`);
  push('JU9', 'entries verbatim and untruncated (J2)', altered.length === 0 && truncated.length === 0,
    `${altered.length} altered, ${truncated.length} truncated`);
  push('F5', 'no coordinate-shaped substring in the RENDERED journal (RI-DLG05 F5 / K5)',
    coordHits.length === 0, JSON.stringify(coordHits.slice(0, 5)));
  push('JU11', 'pause rule: the journal stops the world out of combat', f1 === f0, `frame ${f0} -> ${f1} over 120 steps`);
  push('J10', 'extent is visible: a page count element exists',
    ui.elements.some((e) => e.kind === 'page_count'), '');

  out.map_refusal = mapMessage;
  out.rendered_order = order.map((o) => `${o.id}/${o.n}`);
  out.ok = out.checks.every((c) => c.pass);

  // The capture JU5's --diff compares against.
  ensureDir(RUN);
  writeJson(path.join(RUN, 'capture.json'), {
    at: new Date().toISOString(),
    entries: order.map((o) => ({ journal_id: o.id, index: o.n, day: o.day, text: o.text })),
  });
} finally {
  await h.close();
}

ensureDir(RUN);
writeJson(path.join(RUN, 'journal-ui.json'), out);
if (args.json) console.log(JSON.stringify(out, null, 2));
else {
  for (const c of out.checks) log(`  ${c.pass ? 'PASS' : 'FAIL'} ${c.id} ${c.what} — ${c.detail}`);
  log(`journal-ui: ${out.checks.filter((c) => c.pass).length}/${out.checks.length}`);
  log(`artifacts: ${RUN}`);
}
process.exit(out.ok ? 0 : 1);
