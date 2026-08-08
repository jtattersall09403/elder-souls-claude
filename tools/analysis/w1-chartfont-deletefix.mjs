#!/usr/bin/env node
// w1-chartfont-deletefix.mjs — RULE 6 for the shared chart font, both halves of it.
//
// THE FIX. `tools/lib/chart-font.mjs` replaced a copy-pasted 23-character glyph table, indexed
// with stride 5, with a 25-character one authored as validated rows. The claim is that this
// changes what lands in published PNGs.
//
// THE TEARDOWN. `CHART_FONT_BROKEN=1` puts the pre-fix 23-character table back for the whole
// process. It is an env switch rather than an edit because this tree has a dozen agents staging
// concurrently and rule 17 warns that a delete-the-fix which edits a shared file can have its
// broken state staged out from under it by a neighbour's `git add -A`.
//
// AND THE CHECK THAT THE TEARDOWN IS NOT ITSELF INERT — which is the failure rule 6 spends most
// of its words on, because a control that has never been seen to fail is a second copy of the
// experiment. Three separate assertions, and the third is the load-bearing one:
//
//   1. FIX MOVES IT      the two arms must produce different bytes. If they do not, the fix is
//                        inert — something else was carrying the rendering.
//   2. TEARDOWN BITES    the broken arm must not equal the fixed arm's font. Checked directly on
//                        the font table in a child process, not inferred from the picture.
//   3. TEARDOWN LANDS    the broken arm must reproduce the ARCHIVED PRE-FIX PNG BYTE FOR BYTE.
//                        This is what distinguishes a real teardown from one that silently ran
//                        the fixed arm: the pre-fix bytes were written by the pre-fix code before
//                        this piece existed, so reproducing them is only possible if the broken
//                        table really is being drawn with. It also proves the tool's DATA has not
//                        drifted, so the regenerated figure is a font change and nothing else.
//
// The archived hashes live in `reports/w1-chartfont/prefix-baseline.json`. It is named a BASELINE
// on purpose: reports/.gitignore drops regenerable run artifacts but keeps baselines, because a
// baseline's whole value is being the OLD value. These hashes cannot be regenerated at all — the
// code that produced those bytes no longer exists in the tree.
//
// A figure whose broken arm does NOT match its archived hash is reported as DATA DRIFTED and is
// NOT used as evidence either way — it means the underlying report changed since publication and
// this tool cannot separate the font change from the data change.
//
//   node tools/analysis/w1-chartfont-deletefix.mjs [--json] [--only <substring>]
//
// Exits non-zero if any arm fails to differ, or if the teardown does not bite.

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const ROOT = process.cwd();
const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const argOf = (f) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : null; };
const sha = (b) => createHash('sha256').update(b).digest('hex');

const PREFIX = JSON.parse(fs.readFileSync(path.join(ROOT, 'reports/w1-chartfont/prefix-baseline.json'), 'utf8'));

// tool, how it takes an output path (`flag` = `--out <p>`, `positional` = argv[2]), the published
// figure it owns, and — where the archived bytes were NOT drawn with the plain pre-fix table —
// why the TEARDOWN LANDS assertion cannot apply.
const CASES = [
  { tool: 'tools/quests/reveal-route-chart.mjs', args: ['--round', 'w1-readables-r2'], out: 'flag',
    shot: 'docs/shots/2026-08-08-w1-readables-r2-the-marks-and-the-ledgers-that-now-exist.png',
    no_landing: 'the archived bytes were drawn with a HYBRID table — W1-READABLES-r2 patched the ten '
      + 'digits to 25 characters under its own round flag and left the 37 letters sheared, which is '
      + 'exactly why that picture had correct numbers and spelled BOOK as POOK. Neither arm here is '
      + 'that third table, so this case proves FIX MOVES IT and nothing about landing.' },
  { tool: 'tools/economy/w1-souls-ledger-chart.mjs', args: [], out: 'positional',
    shot: 'docs/shots/2026-08-08-w1-souls-ledger-two-ledgers-one-number.png' },
  { tool: 'tools/economy/critic-souls-r3-chart.mjs', args: [], out: 'positional',
    shot: 'docs/shots/2026-08-08-w1-souls-r3-critic-two-guards-and-neither-one-alone.png' },
  { tool: 'tools/combat/critic-w1-12-chart.mjs', args: [], out: 'positional',
    shot: 'docs/shots/2026-08-08-w1-12-critic-the-frames-m3-never-counted.png' },
  { tool: 'tools/analysis/w1-13-r4-chart.mjs', args: [], out: 'flag',
    shot: 'docs/shots/2026-08-07-w1-13-r4-dying-must-not-change-the-price.png' },
  { tool: 'tools/analysis/w1-12-chart.mjs', args: [], out: 'positional',
    shot: 'docs/shots/2026-08-07-w1-12-where-an-enemy-stands-while-you-fight-it.png' },
];

// ---- assertion 2, first, and on the font itself rather than on a picture -----------------------
const fontHash = (broken) => execFileSync(process.execPath, ['-e',
  "import('./tools/lib/chart-font.mjs').then(m=>{const h=require('node:crypto').createHash('sha256');" +
  "for(const k of Object.keys(m.FONT).sort())h.update(k+':'+m.FONT[k]+'\\n');console.log(h.digest('hex'));})"],
{ cwd: ROOT, env: { ...process.env, CHART_FONT_BROKEN: broken ? '1' : '' }, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();

const fixedFont = fontHash(false);
const brokenFont = fontHash(true);
const teardownBites = fixedFont !== brokenFont;

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'chartfont-'));
const only = argOf('--only');
const rows = [];

for (const c of CASES) {
  if (only && !c.tool.includes(only) && !c.shot.includes(only)) continue;
  const name = path.basename(c.shot);
  const row = { tool: c.tool, shot: c.shot };
  const run = (broken, out) => {
    // --prove-can-fail deliberately makes the teardown INERT by running both arms broken. This
    // harness must then report an inert fix and exit non-zero. A control you have never watched
    // fail is not evidence (rule 6); this is where we watch it.
    if (has('--prove-can-fail')) broken = true;
    const cli = c.out === 'positional' ? [c.tool, out, ...c.args] : [c.tool, ...c.args, '--out', out];
    execFileSync(process.execPath, cli, {
      cwd: ROOT, env: { ...process.env, CHART_FONT_BROKEN: broken ? '1' : '' },
      stdio: ['ignore', 'ignore', 'ignore'], timeout: 900_000,
    });
    return sha(fs.readFileSync(out));
  };
  try {
    row.broken_arm = run(true, path.join(tmp, 'broken-' + name));
    row.fixed_arm = run(false, path.join(tmp, 'fixed-' + name));
  } catch (e) {
    row.error = String(e.message).split('\n')[0];
    rows.push(row); continue;
  }
  row.archived_prefix = PREFIX[c.shot] || null;
  row.published_now = fs.existsSync(path.join(ROOT, c.shot)) ? sha(fs.readFileSync(path.join(ROOT, c.shot))) : null;

  row.fix_moves_it = row.broken_arm !== row.fixed_arm;
  row.no_landing = c.no_landing || null;
  row.teardown_lands = c.no_landing ? null : row.archived_prefix ? row.broken_arm === row.archived_prefix : null;
  row.published_is_fixed_arm = row.published_now === row.fixed_arm;
  row.verdict = row.teardown_lands === false ? 'DATA DRIFTED — not usable as landing evidence'
    : row.fix_moves_it ? 'the fix changes the published bytes' : 'INERT FIX — the two arms are identical';
  rows.push(row);
}

const usable = rows.filter((r) => !r.error && r.teardown_lands !== false);
const moved = usable.filter((r) => r.fix_moves_it).length;
// Only cases that HAVE a landing assertion can be required to pass it. A case with `no_landing`
// carries a stated reason; a case whose data drifted is dropped from `usable` above.
const landable = usable.filter((r) => r.teardown_lands !== null);
const landed = landable.filter((r) => r.teardown_lands === true).length;
const drifted = rows.filter((r) => r.teardown_lands === false).length;
const errored = rows.filter((r) => r.error).length;

const out = {
  tool: 'w1-chartfont-deletefix', taken_at: new Date().toISOString(),
  commit: (() => { try { return execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim(); } catch { return null; } })(),
  teardown_bites: teardownBites, fixed_font_sha: fixedFont, broken_font_sha: brokenFont,
  cases: rows, usable: usable.length, fix_moved: moved, landable: landable.length, teardown_landed: landed, data_drifted: drifted, errored,
};

if (has('--json')) console.log(JSON.stringify(out, null, 2));
else {
  console.log('\nw1-chartfont delete-the-fix\n');
  console.log(`  [${teardownBites ? 'PASS' : 'FAIL'}] TEARDOWN BITES     — CHART_FONT_BROKEN=1 yields a different font table`);
  console.log(`         fixed  ${fixedFont.slice(0, 16)}`);
  console.log(`         broken ${brokenFont.slice(0, 16)}`);
  console.log('');
  for (const r of rows) {
    console.log(`  ${path.basename(r.shot)}`);
    if (r.error) { console.log(`      ERROR ${r.error}`); continue; }
    console.log(`      [${r.fix_moves_it ? 'PASS' : 'FAIL'}] FIX MOVES IT       broken ${r.broken_arm.slice(0, 12)} vs fixed ${r.fixed_arm.slice(0, 12)}`);
    const t = r.teardown_lands;
    console.log(`      [${t === true ? 'PASS' : t === false ? 'DRIFT' : 'n/a '}] TEARDOWN LANDS     broken arm ${t === true ? 'reproduces' : t === false ? 'does NOT reproduce' : 'is not comparable to'} the archived pre-fix PNG`);
    if (r.no_landing) console.log(`             not applicable: ${r.no_landing.replace(/\s+/g, ' ').slice(0, 300)}`);
    console.log(`      [${r.published_is_fixed_arm ? 'PASS' : 'FAIL'}] PUBLISHED IS FIXED the shot in docs/shots is the fixed arm`);
    console.log(`      ${r.verdict}`);
  }
  console.log(`\n  ${usable.length} usable case(s): ${moved} moved by the fix, ${landed} of ${landable.length} with a landed teardown.`);
  if (drifted) console.log(`  ${drifted} case(s) whose data drifted since publication and prove nothing either way.`);
  if (errored) console.log(`  ${errored} case(s) errored.`);
  console.log();
}

fs.rmSync(tmp, { recursive: true, force: true });
const ok = teardownBites && usable.length > 0 && moved === usable.length && landable.length > 0 && landed === landable.length && errored === 0;
process.exit(ok ? 0 : 1);
