#!/usr/bin/env node
// dump-journal.mjs — the journal as text, for the greps that three items depend on.
//
// Named by RI-DLG05 (which owns it), RI-UIX02's Comparison method step 5, and RI-UIX04 step 1.
// It did not exist. Written by the W1-21 builder because RI-UIX02 K5 — "0 coordinate-shaped
// substrings in the RENDERED journal" — cannot run without it, and K5 is one of the six
// detectors that gate S8. Declared in orchestration/status/W1-21.json. RI-DLG05's owner (W1-18)
// should take it over; nothing here is specific to this piece.
//
// TWO SOURCES, AND THE DIFFERENCE MATTERS.
//   --data <dir>  the entries as AUTHORED, read from game/data/quests/**. No browser.
//   --run         the entries as RENDERED, read out of the running screen via getUIState().
// RI-UIX02 step 5 asks for the second explicitly — "run over the RENDERED journal too, not only
// the source data, because a coordinate can be interpolated at render time". A build that
// writes "go to the shrine" in the file and "go to (2752, 425)" on the page passes the first
// and fails the second, and only the second is what the player reads.
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs, wantsHelp, usage, log, REPO_ROOT } from '../lib/cli.mjs';

const USAGE = `
dump-journal.mjs — journal entries as TSV or JSON, from the data or from the running screen.

USAGE
  node tools/corpus/dump-journal.mjs --data game/data/quests/ [--json|--out journal.tsv]
  node tools/corpus/dump-journal.mjs --run [--state ui-journal] [--json]

COLUMNS (RI-DLG05's mandated set)
  journal_id  index  flags  display_name  date_written  text

EXIT 0 ok · 2 nothing to dump
`;

const args = parseArgs();
if (wantsHelp(args)) usage(USAGE);

const rows = [];

if (args.run) {
  const { launchGame } = await import('../lib/browser.mjs');
  const h = await launchGame({ width: 1280, height: 720, timeout: 240000 });
  try {
    await h.h('setRenderRate', 0);
    await h.h('loadState', String(args.state || 'ui-journal'));
    await h.h('stepFrames', 2);
    await h.h('openMenu', 'journal');
    const ui = await h.h('getUIState');
    // The rendered accessor: every string on this screen went through `el()`, which is the only
    // drawing path, so `elements[].text` IS what the glyph rasteriser was given. RI-JRN01
    // M9/M15's "demonstrated rendered-text accessor" is this field, and it is demonstrated by
    // `journal-ui.mjs` JU9, which asserts it byte-matches `getQuestState().journal`.
    for (const e of ui.elements) {
      if (e.kind !== 'journal_entry' || !e.meta) continue;
      rows.push({
        journal_id: e.meta.journal_id, index: e.meta.index,
        flags: (e.meta.flags || []).join('|'), display_name: e.meta.title || '',
        date_written: e.meta.date_text, text: e.text,
      });
    }
  } finally { await h.close(); }
} else {
  const dir = path.resolve(REPO_ROOT, String(args.data || 'game/data/quests'));
  const walk = (d) => {
    if (!fs.existsSync(d)) return;
    for (const f of fs.readdirSync(d)) {
      const p = path.join(d, f);
      if (fs.statSync(p).isDirectory()) { walk(p); continue; }
      if (!f.endsWith('.json')) continue;
      let doc;
      try { doc = JSON.parse(fs.readFileSync(p, 'utf8')); } catch { continue; }
      for (const q of (doc.quests || [])) {
        for (const e of (q.journal || [])) {
          rows.push({
            journal_id: q.id, index: e.index,
            flags: [e.state === 'finished' ? 'quest_finished' : null, e.index === (q.journal[0] || {}).index ? 'quest_name' : null].filter(Boolean).join('|'),
            display_name: q.title || '', date_written: '', text: e.text,
          });
        }
      }
    }
  };
  walk(dir);
}

if (!rows.length) { log('dump-journal: no entries found'); process.exit(2); }
rows.sort((a, b) => (a.journal_id < b.journal_id ? -1 : a.journal_id > b.journal_id ? 1 : a.index - b.index));

if (args.json) {
  console.log(JSON.stringify({ schema: 'elder-souls/journal-dump@1', source: args.run ? 'rendered' : 'data', entries: rows }, null, 2));
} else {
  const header = 'journal_id\tindex\tflags\tdisplay_name\tdate_written\ttext';
  const body = rows.map((r) => [r.journal_id, r.index, r.flags, r.display_name, r.date_written,
    String(r.text).replace(/[\t\n\r]+/g, ' ')].join('\t')).join('\n');
  const text = header + '\n' + body + '\n';
  if (args.out) { fs.writeFileSync(path.resolve(String(args.out)), text); log(`dump-journal: ${rows.length} entries -> ${args.out}`); }
  else process.stdout.write(text);
}
