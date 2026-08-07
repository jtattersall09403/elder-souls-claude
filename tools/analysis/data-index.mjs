#!/usr/bin/env node
// data-index.mjs — regenerate game/data/index.json, the manifest HARNESS.md §7 rule 5 requires.
//
// "It lists every data file with a schema id, so an analyser can tell 'absent' from
// 'renamed'." The manifest is generated from the tree rather than hand-maintained,
// because a hand-maintained manifest drifts and a drifted manifest is worse than none.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { parseArgs, wantsHelp, usage, DATA_DIR, EXIT, die, log } from '../lib/cli.mjs';

const USAGE = `
data-index.mjs — regenerate game/data/index.json from the data tree.

USAGE
  node tools/analysis/data-index.mjs [--check]

OPTIONS
  --check   Do not write; exit 20 if index.json is stale.
  --help    This message.
`;

const args = parseArgs();
if (wantsHelp(args)) usage(USAGE);
if (!fs.existsSync(DATA_DIR)) die(EXIT.MISSING_GAME, `no data tree at ${DATA_DIR}`);

const files = [];
const walk = (dir, rel = '') => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1))) {
    const p = path.join(dir, e.name);
    const r = rel ? `${rel}/${e.name}` : e.name;
    if (e.isDirectory()) walk(p, r);
    // Dotfiles are not content. `quests/.resolution-baseline.json` is the generator-guard
    // snapshot written by 54a4145 ("Restore nine quest routes lost to a generator"); it is a
    // tool's own bookkeeping, carries no `schema`, and has fail-closed this indexer — and so
    // the HARNESS.md §7 rule 5 manifest it maintains — for every piece since. Skipping the dot
    // prefix is the narrowest fix that does not weaken the schema rule for real data files.
    else if (e.name.startsWith('.')) continue;
    else if (e.name.endsWith('.json') && r !== 'index.json') {
      const raw = fs.readFileSync(p);
      let doc;
      try { doc = JSON.parse(raw); }
      catch (err) { die(EXIT.MEASUREMENT_FAIL, `${r} is not valid JSON: ${err.message}`); }
      if (!doc.schema) die(EXIT.MEASUREMENT_FAIL, `${r} has no "schema" field — HARNESS.md §7 rule 5 requires one per file`);
      files.push({
        path: r,
        schema: doc.schema,
        id: doc.id || null,
        bytes: raw.length,
        sha256: crypto.createHash('sha256').update(raw).digest('hex').slice(0, 16),
        declared_incomplete: doc.declared_incomplete ? true : undefined,
      });
    }
  }
};
walk(DATA_DIR);

const index = {
  schema: 'elder-souls/data-index@1',
  generated_by: 'tools/analysis/data-index.mjs',
  note: 'Generated from the tree. Do not hand-edit. `declared_incomplete: true` marks a file whose owning wave-1 piece is not W1-00 and which says so in its own body.',
  file_count: files.length,
  files,
};

const outPath = path.join(DATA_DIR, 'index.json');
const text = JSON.stringify(index, null, 2) + '\n';
if (args.check) {
  const cur = fs.existsSync(outPath) ? fs.readFileSync(outPath, 'utf8') : '';
  if (cur !== text) die(EXIT.MEASUREMENT_FAIL, 'game/data/index.json is stale — run `node tools/analysis/data-index.mjs`');
  log(`index.json is current (${files.length} files)`);
} else {
  fs.writeFileSync(outPath, text);
  log(`wrote ${outPath} (${files.length} files)`);
}
