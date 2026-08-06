#!/usr/bin/env node
/**
 * merge-manifest.mjs — reconcile two independent reference-image acquisition runs.
 *
 * Two agents fill `corpus/70-visual/refs/` against the same specification
 * (`docs/REFERENCE-IMAGE-REQUEST.md`) with no coordination between them. They will fetch
 * some of the same popular screenshots, disagree about which folder a shot belongs in,
 * and describe the same file with different amounts of care. This tool does the four
 * things that situation needs and refuses to do the one thing it must not.
 *
 *   1. AUDIT      every record against §9's schema, against the file on disk, and against
 *                 the file's actual sha256. A record whose file is missing, or whose file
 *                 has different bytes than the record claims, is the failure that silently
 *                 corrupts every band computed downstream — so it is reported first.
 *   2. DUPLICATES the same bytes under two paths. Reported whether or not a merge is
 *                 happening: the local set can already contain them (`anti-generic/`
 *                 deliberately duplicates `modern/hud/`, and that is legitimate — the tool
 *                 distinguishes declared duplicates from undeclared ones).
 *   3. MERGE      union a foreign manifest into ours BY sha256, never by path. Where both
 *                 sides describe the same bytes, keep the richer record and record the
 *                 conflict rather than silently choosing.
 *   4. FLOORS     per-folder counts against §3's table, counting only records with
 *                 `pixel_metrics_valid: true`, which is what §3 actually says.
 *
 * What it will not do: it never writes an image, never edits a numeric field, and never
 * invents a record for a file it cannot see. Numeric fields belong to
 * `refs/make-manifest.py` and are re-derived there; this tool only ever moves provenance.
 *
 * Usage
 *   node tools/refs/merge-manifest.mjs                      audit + duplicates + floors
 *   node tools/refs/merge-manifest.mjs --merge <foreign>    also merge a foreign manifest
 *   node tools/refs/merge-manifest.mjs --merge <f> --write  write the merged provenance
 *   node tools/refs/merge-manifest.mjs --json               machine-readable report
 *   node tools/refs/merge-manifest.mjs --strict             exit 1 on any AUDIT failure
 *
 * `--write` writes `refs/_provenance.json` only. It then tells you to re-run
 * `make-manifest.py`, which is the only thing allowed to write `MANIFEST.json`. Running
 * without `--write` changes nothing, so the default is always safe. Re-running with
 * `--write` after a successful merge is a no-op: the merge is idempotent because it keys
 * on content hash and compares the resulting provenance block before writing.
 */

import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..');
const REFS = join(ROOT, 'corpus', '70-visual', 'refs');
const MANIFEST = join(REFS, 'MANIFEST.json');
const PROVENANCE = join(REFS, '_provenance.json');

const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const val = (f) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : null; };
const FOREIGN = val('--merge');
const WRITE = has('--write');
const JSON_OUT = has('--json');
const STRICT = has('--strict');

// ---------------------------------------------------------------- §3 floors
// docs/REFERENCE-IMAGE-REQUEST.md §3. Only pixel_metrics_valid:true records count.
const FLOORS = {
  'modern/exterior_daylight':     { images: 12, games: 3, locations: 6 },
  'modern/exterior_lowlight':     { images: 12, games: 3, locations: 6 },
  'modern/interior_darkemissive': { images: 10, games: 2, locations: 5 },
  'modern/character_closeup':     { images: 10, games: 2, locations: 6 },
  'modern/combat':                { images:  8, games: 2, locations: 4 },
  'modern/material_closeup':      { images:  8, games: 2, locations: 6 },
};
// Folders with a floor stated elsewhere in the spec (§5b, §5c, §5d) or no floor at all.
const SOFT_FLOORS = {
  'anti-generic': { images: 4, note: '§5c: four to six' },
  'context':      { images: 4, note: '§5d: four ESO Shadowfen/Murkmire' },
  'video':        { images: 2, note: '§5b: V1-dolly and V2-static required' },
};
const NO_FLOOR = new Set(['modern/hud', 'rejected', 'morrowind/unconfirmed']);

// `side` must agree with the folder (§9). Both spellings of the Morrowind value are
// accepted: §9 writes "morrowind-art", the existing set writes "morrowind-art-direction".
const SIDE_FOR_FOLDER = [
  [/^modern\//,       ['modern-fidelity']],
  [/^morrowind\//,    ['morrowind-art', 'morrowind-art-direction']],
  [/^anti-generic\//, ['anti-generic']],
  [/^context\//,      ['context-neither']],
  [/^video\//,        ['video']],
];

// §9's record shape. `required` must be present on every record; `numeric` is owned by
// make-manifest.py and is only ever checked, never merged.
//
// Two documented exemptions, so the audit stays worth reading:
//   - `rejected/` holds files we obtained and then threw out. §10.3 asks for them in the
//     report's rejection log, not for a full §9 record; demanding one would generate an
//     error per rejected file forever.
//   - `slot` is a REF-M/REF-A identity. `modern/hud/` and `anti-generic/` records do not
//     have one by design — hud is a holding pen and anti-generic is a negative anchor that
//     is never cited by slot. §9 does not assign them slot IDs and neither does this.
const REQUIRED = ['path', 'side', 'game', 'depicts', 'identified_by',
                  'source_url', 'corroboration', 'provenance_chain', 'sha256'];
const SLOT_REQUIRED = (p) =>
  (p.startsWith('modern/') && !p.startsWith('modern/hud/')) ||
  (p.startsWith('morrowind/') && !p.startsWith('morrowind/unconfirmed/'));
const AUDIT_EXEMPT = (p) => p.startsWith('rejected/');
const NUMERIC = ['bytes', 'width', 'height', 'bytes_per_pixel', 'nyq_ratio',
                 'upscale_test', 'block_score', 'sha256'];
const CORROBORATION_OK = new Set(['first-party', 'two-hosts', 'pre-2023-page']);

const rel = (p) => relative(REFS, p).split(sep).join('/');

// ---------------------------------------------------------------- load
function loadManifest(p, label) {
  if (!existsSync(p)) fail(`${label} manifest not found: ${p}`);
  let j;
  try { j = JSON.parse(readFileSync(p, 'utf8')); }
  catch (e) { fail(`${label} manifest is not valid JSON: ${e.message}`); }
  // Accept either {records:[...]} (§9 / ours) or a bare array, which a foreign run may emit.
  const records = Array.isArray(j) ? j : j.records;
  if (!Array.isArray(records)) fail(`${label} manifest has no \`records\` array`);
  return { raw: j, records };
}

function fail(msg) {
  console.error(`merge-manifest: ${msg}`);
  process.exit(2);
}

function walkFiles(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir).sort()) {
    if (name.startsWith('.') || name === 'anti') continue;   // refs/anti/ is harness-owned
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walkFiles(p, out);
    else if (!/\.(md|json|py|mjs|txt)$/i.test(name)) out.push(p);
  }
  return out;
}

const sha256 = (p) => createHash('sha256').update(readFileSync(p)).digest('hex');
const folderOf = (path) => {
  const parts = path.split('/');
  if (parts.length < 2) return '.';
  // modern/exterior_daylight/x.png -> modern/exterior_daylight ; morrowind/REF-A9/x -> morrowind/REF-A9
  return parts.slice(0, parts.length - 1).join('/');
};
const profileFolderOf = (path) => {
  const p = folderOf(path);
  // REF-A12 keeps subdirectories (mygui/, config/); fold them back to the slot folder.
  const m = p.match(/^(morrowind\/[^/]+)\//);
  return m ? m[1] : p;
};

// ---------------------------------------------------------------- 1. audit
function audit(records, filesOnDisk) {
  const problems = [];
  const byPath = new Map();
  const diskHash = new Map();
  for (const f of filesOnDisk) diskHash.set(rel(f), sha256(f));

  for (const r of records) {
    const where = r.path ?? '(record with no path)';
    if (byPath.has(where)) problems.push({ level: 'ERROR', path: where, kind: 'duplicate-record',
      detail: 'two records in the same manifest claim this path' });
    byPath.set(where, r);

    const exempt = AUDIT_EXEMPT(where);
    if (!exempt) {
      for (const k of REQUIRED) {
        if (r[k] === undefined || r[k] === null || r[k] === '')
          problems.push({ level: 'ERROR', path: where, kind: 'missing-field', detail: k });
      }
      if (SLOT_REQUIRED(where) && !r.slot)
        problems.push({ level: 'ERROR', path: where, kind: 'missing-field', detail: 'slot' });
    }
    if (r.PROVENANCE_MISSING)
      problems.push({ level: 'ERROR', path: where, kind: 'no-provenance',
        detail: 'file exists but nothing in _provenance.json describes it' });

    // file presence + byte agreement — the failure that matters most
    const onDisk = diskHash.get(where);
    if (onDisk === undefined) {
      problems.push({ level: 'ERROR', path: where, kind: 'file-missing',
        detail: 'manifest record with no file (§9: never a record without a file)' });
    } else if (r.sha256 && onDisk !== r.sha256) {
      problems.push({ level: 'ERROR', path: where, kind: 'hash-mismatch',
        detail: `record ${String(r.sha256).slice(0, 12)} vs disk ${onDisk.slice(0, 12)} — ` +
                'the file changed after the manifest was written, or was edited in place' });
    }

    // §4 rule 1
    if (r.modified_by_me === true)
      problems.push({ level: 'ERROR', path: where, kind: 'modified_by_me',
        detail: '§9: must be false on every record; this file cannot be used for measurement' });

    // §8b corroboration gate
    if (r.corroboration && !CORROBORATION_OK.has(r.corroboration))
      problems.push({ level: 'WARN', path: where, kind: 'corroboration',
        detail: `"${r.corroboration}" is not one of first-party / two-hosts / pre-2023-page ` +
                '(§8b: such a file belongs in rejected/)' });

    // §9 side/folder agreement
    const m = SIDE_FOR_FOLDER.find(([re]) => re.test(where));
    if (m && r.side && !m[1].includes(r.side))
      problems.push({ level: 'ERROR', path: where, kind: 'side-folder-disagreement',
        detail: `side "${r.side}" but folder wants ${m[1].join(' | ')}` });

    // §8c
    if (Array.isArray(r.identified_by) && r.identified_by.length < 3)
      problems.push({ level: 'WARN', path: where, kind: 'identified_by',
        detail: `${r.identified_by.length} features; §8c wants three` });

    // §5d
    if (where.startsWith('context/') && !Array.isArray(r.forbidden_for))
      problems.push({ level: 'WARN', path: where, kind: 'forbidden_for',
        detail: '§9: context-neither records must carry forbidden_for[]' });

    // a numeric field on a record whose pixel metrics are declared invalid is a contradiction
    if (r.pixel_metrics_valid === true && (r.width == null || r.height == null))
      problems.push({ level: 'WARN', path: where, kind: 'metrics-contradiction',
        detail: 'pixel_metrics_valid true but no dimensions computed' });
  }

  for (const [p] of diskHash) {
    if (!byPath.has(p))
      problems.push({ level: 'ERROR', path: p, kind: 'file-unrecorded',
        detail: 'file on disk with no manifest record' });
  }
  return { problems, byPath, diskHash };
}

// ---------------------------------------------------------------- 2. duplicates
function duplicates(records) {
  const byHash = new Map();
  for (const r of records) {
    if (!r.sha256) continue;
    if (!byHash.has(r.sha256)) byHash.set(r.sha256, []);
    byHash.get(r.sha256).push(r);
  }
  const dups = [];
  for (const [h, rs] of byHash) {
    if (rs.length < 2) continue;
    // A duplicate is *declared* if some member's `duplicate_of` names another member —
    // either its exact path or the folder it sits in, because the existing set writes
    // `duplicate_of: "modern/hud/ — these are byte-identical copies, filed twice…"`.
    // Declared duplicates are legitimate (§5c's anti-generic anchor is deliberately five
    // byte-copies of `modern/hud/` frames). Undeclared ones are the thing to look at: two
    // acquisition runs fetching the same popular screenshot, or one run filing one image
    // under two slots and inflating both counts.
    const paths = rs.map((r) => r.path);
    const declared = rs.some((r) => typeof r.duplicate_of === 'string' &&
      paths.some((p) => p !== r.path &&
        (r.duplicate_of.includes(p) || r.duplicate_of.includes(folderOf(p) + '/'))));
    dups.push({
      sha256: h,
      paths,
      declared,
      folders: [...new Set(rs.map((r) => folderOf(r.path)))],
      cross_side: new Set(rs.map((r) => r.side)).size > 1,
    });
  }
  dups.sort((a, b) => Number(a.declared) - Number(b.declared) || a.paths[0].localeCompare(b.paths[0]));
  return dups;
}

// ---------------------------------------------------------------- 3. merge
// "Richer" = more provenance substance. Deliberately crude and deliberately explained: a
// tie never picks silently, it reports a conflict and keeps ours.
const PROV_WEIGHT = {
  identified_by: 6, depicts: 4, source_url: 3, source_page: 3, corroboration: 3,
  author_or_uploader: 2, capture_date: 2, vanilla_tests: 4, deviation: 2,
  substituted_for: 2, upscaler: 1, sampling: 2, provenance_note: 2, identified_how: 2,
};
function richness(r) {
  let s = 0;
  for (const [k, w] of Object.entries(PROV_WEIGHT)) {
    const v = r[k];
    if (v === undefined || v === null || v === '' || v === 'unknown') continue;
    if (Array.isArray(v)) s += w * Math.min(3, v.length) / 3;
    else if (typeof v === 'object') s += w;
    else s += w;
  }
  return Math.round(s * 100) / 100;
}

function mergeRecords(ours, theirs) {
  const oursByHash = new Map();
  for (const r of ours) if (r.sha256) oursByHash.set(r.sha256, r);
  const oursByPath = new Map(ours.map((r) => [r.path, r]));

  const result = { same_bytes: [], new_files: [], path_collisions: [], conflicts: [], adopted: [] };

  for (const t of theirs) {
    if (!t.path) { result.conflicts.push({ kind: 'foreign-record-no-path', record: t }); continue; }
    const mine = t.sha256 ? oursByHash.get(t.sha256) : null;

    if (mine) {
      // Same bytes, both sides have them. Never add a second copy.
      const entry = {
        sha256: t.sha256, ours: mine.path, theirs: t.path,
        richness_ours: richness(mine), richness_theirs: richness(t),
        same_path: mine.path === t.path,
      };
      entry.keep = entry.richness_theirs > entry.richness_ours ? 'theirs' : 'ours';
      if (entry.keep === 'theirs') result.adopted.push(entry);
      if (mine.path !== t.path)
        result.conflicts.push({ kind: 'same-bytes-different-path', ...entry,
          detail: 'identical image filed under two names; keep ours, drop theirs, note it' });
      if (mine.slot !== t.slot || mine.profile !== t.profile)
        result.conflicts.push({ kind: 'same-bytes-different-classification', sha256: t.sha256,
          ours: `${mine.slot}/${mine.profile}`, theirs: `${t.slot}/${t.profile}`,
          detail: 'two runs sorted the same image into different slots — a human must decide' });
      result.same_bytes.push(entry);
      continue;
    }

    if (oursByPath.has(t.path)) {
      // Different bytes, same path. Never overwrite: that would silently swap an image.
      result.path_collisions.push({ path: t.path, ours_sha: oursByPath.get(t.path).sha256,
        theirs_sha: t.sha256,
        detail: 'same filename, different bytes — the foreign file needs renaming before merge' });
      continue;
    }
    result.new_files.push(t);
  }
  return result;
}

// Build the provenance block a foreign record contributes: §9 provenance fields only.
// Numeric fields are dropped on the floor — make-manifest.py recomputes them from bytes.
function provenanceOf(r) {
  const out = {};
  for (const [k, v] of Object.entries(r)) {
    if (k === 'path' || NUMERIC.includes(k)) continue;
    if (['format', 'bit_depth', 'has_alpha', 'jpeg_quality_est', 'exif_software',
         'exif_datetime', 'xmp_present', 'c2pa_present', 'hf_ratio', 'lines',
         'asset_kind'].includes(k)) continue;
    out[k] = v;
  }
  return out;
}

// ---------------------------------------------------------------- 4. floors
function floors(records) {
  const rows = [];
  const counts = new Map();
  for (const r of records) {
    const f = profileFolderOf(r.path);
    if (!counts.has(f)) counts.set(f, { all: [], valid: [], text: [] });
    // A non-image asset never counts toward any image floor. REF-A12 is filled by 38
    // MyGUI layout/skin files; they are listed, and they are not 38 pictures.
    if (r.asset_kind === 'text') { counts.get(f).text.push(r); continue; }
    counts.get(f).all.push(r);
    if (r.pixel_metrics_valid === true) counts.get(f).valid.push(r);
  }
  const distinct = (rs, k) => new Set(rs.map((r) => r[k]).filter(Boolean)).size;

  const EMPTY = { all: [], valid: [], text: [] };
  for (const [folder, floor] of Object.entries(FLOORS)) {
    const c = counts.get(folder) ?? EMPTY;
    const games = distinct(c.valid, 'game');
    const locs = distinct(c.valid, 'depicts');   // best available proxy for "location"
    rows.push({
      folder, kind: 'hard',
      required: `${floor.images} / ${floor.games} games / ${floor.locations} locs`,
      measurable: c.valid.length, present: c.all.length, text: c.text.length,
      games, locations_approx: locs,
      pass: c.valid.length >= floor.images && games >= floor.games && locs >= floor.locations,
    });
  }
  for (const [folder, floor] of Object.entries(SOFT_FLOORS)) {
    const c = counts.get(folder) ?? EMPTY;
    rows.push({ folder, kind: 'soft', required: `${floor.images} (${floor.note})`,
      measurable: c.valid.length, present: c.all.length, text: c.text.length,
      pass: c.all.length >= floor.images });
  }
  for (const [folder, c] of [...counts].sort()) {
    if (FLOORS[folder] || SOFT_FLOORS[folder]) continue;
    // A morrowind slot filled by structure rather than pictures (REF-A12) passes on the
    // structure, not on a count of 2-3 images it does not have. Reported as its own kind.
    const structural = c.text.length > 0 && c.all.length === 0;
    rows.push({ folder,
      kind: NO_FLOOR.has(folder) ? 'none' : structural ? 'structural' : 'slot',
      required: NO_FLOOR.has(folder) ? '—'
        : structural ? '§5e slot filled by structure' : '§5e: 2–3 (core slots 4–5)',
      measurable: c.valid.length, present: c.all.length, text: c.text.length,
      pass: NO_FLOOR.has(folder) ? null : structural ? true : c.all.length >= 2 });
  }
  return rows;
}

// ---------------------------------------------------------------- report
function pad(s, n) { s = String(s); return s + ' '.repeat(Math.max(0, n - s.length)); }

function main() {
  const { records: ours } = loadManifest(MANIFEST, 'local');
  const files = walkFiles(REFS);
  const { problems } = audit(ours, files);
  const dups = duplicates(ours);
  const rows = floors(ours);

  let merge = null;
  if (FOREIGN) {
    const { records: theirs } = loadManifest(FOREIGN, 'foreign');
    merge = mergeRecords(ours, theirs);
    merge.foreign_count = theirs.length;
  }

  if (JSON_OUT) {
    console.log(JSON.stringify({ local_records: ours.length, files_on_disk: files.length,
      problems, duplicates: dups, floors: rows, merge }, null, 1));
  } else {
    const errs = problems.filter((p) => p.level === 'ERROR');
    const warns = problems.filter((p) => p.level === 'WARN');
    console.log(`\n=== AUDIT  ${ours.length} records, ${files.length} files on disk`);
    console.log(`    ${errs.length} error(s), ${warns.length} warning(s)`);
    const byKind = new Map();
    for (const p of problems) {
      const k = `${p.level} ${p.kind}`;
      if (!byKind.has(k)) byKind.set(k, []);
      byKind.get(k).push(p);
    }
    for (const [k, ps] of [...byKind].sort()) {
      console.log(`  ${pad(k, 34)} ${ps.length}`);
      for (const p of ps.slice(0, 5)) console.log(`      ${p.path}  — ${p.detail}`);
      if (ps.length > 5) console.log(`      … and ${ps.length - 5} more (use --json)`);
    }
    if (!problems.length) console.log('  clean');

    console.log(`\n=== DUPLICATE CONTENT  ${dups.length} hash(es) under more than one path`);
    for (const d of dups) {
      console.log(`  ${d.declared ? 'declared' : 'UNDECLARED'}${d.cross_side ? ' cross-side' : ''}` +
                  `  ${d.sha256.slice(0, 12)}  ${d.paths.join('  ')}`);
    }
    if (!dups.length) console.log('  none');

    console.log('\n=== FOLDER COUNTS vs §3');
    console.log('  measurable = images with pixel_metrics_valid:true — the only ones §3 counts.');
    console.log('  images     = all image files present.   text = non-image assets (never counted).');
    console.log(`  ${pad('folder', 34)}${pad('required', 40)}${pad('measurable', 11)}${pad('images', 8)}${pad('text', 6)}verdict`);
    for (const r of rows) {
      const v = r.pass === null ? '—' : r.pass ? 'PASS' : 'SHORT';
      const extra = r.games !== undefined ? `  [${r.games} games, ~${r.locations_approx} locs]` : '';
      console.log(`  ${pad(r.folder, 34)}${pad(r.required, 40)}${pad(r.measurable, 11)}` +
                  `${pad(r.present, 8)}${pad(r.text || '', 6)}${v}${extra}`);
    }

    if (merge) {
      console.log(`\n=== MERGE  foreign manifest: ${merge.foreign_count} records`);
      console.log(`  new files (foreign only)      ${merge.new_files.length}`);
      console.log(`  same bytes as ours            ${merge.same_bytes.length}` +
                  `  (${merge.adopted.length} where theirs is richer)`);
      console.log(`  path collisions (diff bytes)  ${merge.path_collisions.length}`);
      console.log(`  conflicts needing a human     ${merge.conflicts.length}`);
      for (const c of merge.conflicts.slice(0, 20))
        console.log(`      ${c.kind}: ${c.ours ?? ''} <> ${c.theirs ?? ''} — ${c.detail ?? ''}`);
      for (const p of merge.path_collisions.slice(0, 20))
        console.log(`      COLLISION ${p.path}`);
      for (const n of merge.new_files.slice(0, 20))
        console.log(`      NEW ${n.path}`);
      if (merge.new_files.length > 20) console.log(`      … and ${merge.new_files.length - 20} more`);
    }
    console.log('');
  }

  // ---- write
  if (WRITE) {
    if (!merge) fail('--write needs --merge <foreign-manifest>');
    const prov = existsSync(PROVENANCE) ? JSON.parse(readFileSync(PROVENANCE, 'utf8')) : {};
    let added = 0, upgraded = 0, skippedMissing = 0;
    for (const t of merge.new_files) {
      // Never write a provenance record for a file we cannot see. §9 rule 9.
      if (!existsSync(join(REFS, t.path))) { skippedMissing++; continue; }
      const block = provenanceOf(t);
      if (JSON.stringify(prov[t.path]) !== JSON.stringify(block)) { prov[t.path] = block; added++; }
    }
    const foreignRecords = loadManifest(FOREIGN, 'foreign').records;
    for (const a of merge.adopted) {
      const foreign = foreignRecords.find((r) => r.sha256 === a.sha256);
      if (!foreign || !existsSync(join(REFS, a.ours))) continue;
      // Adopt their provenance onto OUR path. The path is ours; only the description moves.
      const block = provenanceOf(foreign);
      delete block.path;
      block.merge_note = `richer provenance adopted from a foreign acquisition run; that run ` +
                         `filed these bytes as ${a.theirs}`;
      if (JSON.stringify(prov[a.ours]) !== JSON.stringify(block)) { prov[a.ours] = block; upgraded++; }
    }
    const sorted = {};
    for (const k of Object.keys(prov).sort()) sorted[k] = prov[k];
    writeFileSync(PROVENANCE, JSON.stringify(sorted, null, 1));
    console.log(`wrote _provenance.json: +${added} new, ${upgraded} upgraded, ` +
                `${skippedMissing} skipped (no file on disk)`);
    console.log('NEXT: python3 corpus/70-visual/refs/make-manifest.py   ' +
                '(the only writer of MANIFEST.json and of every numeric field)');
  }

  if (STRICT && problems.some((p) => p.level === 'ERROR')) process.exit(1);
}

main();
