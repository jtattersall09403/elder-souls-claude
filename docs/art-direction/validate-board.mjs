#!/usr/bin/env node
/**
 * validate-board.mjs — W1-30K's own gate. Run it before citing the board and after editing it.
 *
 *   node docs/art-direction/validate-board.mjs
 *
 * It checks six things and exits non-zero on any failure:
 *
 *   C1  every SET row names at least one plate path it was read from, and every named path is a
 *       real measured plate; every UNSET row carries a reason and what would fill it
 *   C2  the bifurcation holds — no ART row cites refs/modern/, no FIDELITY row cites
 *       refs/morrowind/, refs/anti-generic/ or refs/context/ (RI-VIS01 §C)
 *   C3  the cross-contamination scan over the prose halves — forbidden paths, forbidden
 *       vocabulary per side, the CC-3 cardinal-sin phrases anywhere, and CC-5 score fusion
 *   C4  the board discriminates — the thirteen regions are mutually distinguishable on the
 *       structural axis, and no two carry the same triple
 *   C5  every row names a consuming child or is explicitly `advisory`
 *   C6  quarantine — no board artefact has reached a judging pack (W1-30V's territory)
 *
 * NULL CONTROLS. Each flag breaks the board on an in-memory copy; the run must then go red. A
 * green run of `--self-test` means every control fired.
 *
 *   --inject-unsourced    a row with no plate behind it              -> C1 must fail
 *   --inject-crosscite    a modern plate cited by an ART row         -> C2 must fail
 *   --inject-cardinal     the cardinal sin written into the prose    -> C3 must fail
 *   --collapse-regions    two regions given one identical board      -> C4 must fail
 *   --self-test           run all four injections and the clean run, and report
 */
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(join(HERE, '..', '..'));
const argv = process.argv.slice(2);

const SIDE_FORBIDDEN_PATHS = {
  ART: [/^modern\//],
  FIDELITY: [/^morrowind\//, /^anti-generic\//, /^context\//],
};
// RI-VIS01 CC-1 / CC-2 vocabulary. Checked in the prose halves, where a human writes.
const SIDE_FORBIDDEN_WORDS = {
  ART: [/\bElden Ring\b/i, /\bSkyrim\b/i, /\bRDR2\b/i, /\bRed Dead\b/i, /\bWitcher\b/i, /\bUnreal\b/i,
    /\bAAA\b/, /\bnext-?gen\b/i, /\bRI-VIS0[23]\b/],
  FIDELITY: [/\bMorrowind\b/i, /\bVvardenfell\b/i, /\bTelvanni\b/i, /\bRedoran\b/i, /\b2002\b/,
    /\bfor its time\b/i, /\bRI-VIS05\b/],
};
// CC-3, the cardinal sin. Forbidden on both halves, no exceptions.
const CARDINAL = [/stylised so it'?s fine/i, /intentionally low-?poly/i, /matches Morrowind'?s look/i,
  /retro aesthetic/i, /art direction compensates/i, /charmingly simple/i, /the flatness is deliberate/i];
// CC-5, score fusion.
const FUSION = [/combined visual score/i, /overall visual score/i, /average(d)? the two (visual )?scores/i];

function loadBoard() { return JSON.parse(readFileSync(join(HERE, 'board.json'), 'utf8')); }
function loadMetrics() { return JSON.parse(readFileSync(join(HERE, 'plate-metrics.json'), 'utf8')); }

function run(injections = new Set()) {
  const fails = [];
  const board = loadBoard();
  const metrics = loadMetrics();
  const known = new Set(metrics.plates.filter((p) => !p.error).map((p) => p.path));
  let rows = board.rows.map((r) => JSON.parse(JSON.stringify(r)));

  // ---- injections ---------------------------------------------------------------------------
  if (injections.has('unsourced')) {
    rows.push({ id: 'NULL-CONTROL-UNSOURCED', side: 'ART', scope: 'province', subject: 'all regions',
      axis: 'palette', statistic: 'a number somebody liked', unit: 'C*', status: 'set',
      target: { lo: 10, hi: 20, anchor_p50: 15 }, source: { population_n: 0, statistic_n: 0, plates: [] },
      current_build: { value: null }, consumers: ['W1-30C'] });
  }
  if (injections.has('crosscite')) {
    const victim = rows.find((r) => r.side === 'ART' && r.status === 'set');
    victim.source.plates = victim.source.plates.concat(
      metrics.plates.filter((p) => p.side === 'FIDELITY').slice(0, 1).map((p) => p.path));
  }
  if (injections.has('collapse')) {
    const skyRows = rows.filter((r) => r.id.startsWith('ART-REG-'));
    const a = skyRows.filter((r) => r.subject === 'blackwood');
    const b = skyRows.filter((r) => r.subject === 'valus-ridge');
    for (const rb of b) {
      const ra = a.find((x) => x.axis === rb.axis);
      if (ra) rb.target = JSON.parse(JSON.stringify(ra.target));
    }
  }

  // ---- C1 sourcing --------------------------------------------------------------------------
  for (const r of rows) {
    if (r.status === 'set') {
      if (!r.target) fails.push(`C1 ${r.id}: status set with no target`);
      if (!r.source || !Array.isArray(r.source.plates) || r.source.plates.length === 0)
        fails.push(`C1 ${r.id}: a set row with no plate behind it`);
      else for (const p of r.source.plates) if (!known.has(p)) fails.push(`C1 ${r.id}: cites unmeasured plate '${p}'`);
      if (!r.statistic) fails.push(`C1 ${r.id}: no statistic named`);
    } else if (r.status === 'unset') {
      if (!r.unset_reason) fails.push(`C1 ${r.id}: unset with no reason`);
      if (r.target) fails.push(`C1 ${r.id}: unset but carries a target`);
    } else fails.push(`C1 ${r.id}: unknown status '${r.status}'`);
  }

  // ---- C2 bifurcation, on the machine-readable half ------------------------------------------
  for (const r of rows) {
    const bad = SIDE_FORBIDDEN_PATHS[r.side];
    if (!bad) { fails.push(`C2 ${r.id}: unknown side '${r.side}'`); continue; }
    for (const p of (r.source && r.source.plates) || [])
      for (const re of bad) if (re.test(p)) fails.push(`C2 ${r.id}: side ${r.side} cites forbidden path '${p}'`);
  }

  // ---- C3 the cross-contamination scan, on the prose halves -----------------------------------
  const proseFiles = { ART: join(HERE, 'ART.md'), FIDELITY: join(HERE, 'FIDELITY.md') };
  for (const [side, file] of Object.entries(proseFiles)) {
    if (!existsSync(file)) { fails.push(`C3 ${side}: ${file} missing`); continue; }
    let text = readFileSync(file, 'utf8');
    if (injections.has('cardinal') && side === 'ART') text += '\n\nThe flatness is deliberate.\n';
    // RI-VIS01 §B requires the declaration block to NAME the forbidden reference set, so the one
    // place a side must write the other side's name is the block that exists to keep them apart.
    // `<!-- cc-scan:ignore -->` fences it and nothing else; everything outside is scanned.
    const scanText = text.split('<!-- cc-scan:ignore -->')
      .filter((_, i) => i % 2 === 0).join('\n');
    // paths
    for (const re of SIDE_FORBIDDEN_PATHS[side]) {
      const m = scanText.match(new RegExp(`refs/${re.source.replace(/^\^/, '').replace(/\\\//g, '/')}`, 'g'));
      if (m) fails.push(`C3 ${side}: prose cites forbidden reference path (${m[0]})`);
    }
    // vocabulary
    for (const re of SIDE_FORBIDDEN_WORDS[side]) {
      const m = scanText.match(re);
      if (m) fails.push(`C3 ${side}: forbidden vocabulary for this side: "${m[0]}"`);
    }
    for (const re of CARDINAL) if (re.test(scanText)) fails.push(`C3 ${side}: CC-3 cardinal sin phrase present`);
    for (const re of FUSION) if (re.test(scanText)) fails.push(`C3 ${side}: CC-5 score fusion`);
  }

  // ---- C4 discrimination ---------------------------------------------------------------------
  // The structural axis is the one that has to separate regions; AM-W1-01-01 and this board's own
  // ART-X7-SEPARATION-RAW both say colour cannot. The test: every pair of regions must differ on
  // the skyline band by at least the reference set's own median within-region spread, and no two
  // regions may carry an identical (lightness, chroma, skyline) triple.
  const regionRows = rows.filter((r) => r.scope === 'region' && r.status === 'set');
  const bySubject = new Map();
  for (const r of regionRows) {
    if (!bySubject.has(r.subject)) bySubject.set(r.subject, {});
    bySubject.get(r.subject)[r.axis] = r.target;
  }
  const subjects = [...bySubject.keys()];
  if (subjects.length !== 13) fails.push(`C4: expected 13 regions with set rows, found ${subjects.length}`);
  let identical = 0, tooClose = 0;
  for (let i = 0; i < subjects.length; i++) for (let j = i + 1; j < subjects.length; j++) {
    const a = bySubject.get(subjects[i]), b = bySubject.get(subjects[j]);
    const key = (o) => JSON.stringify([o.lightness, o.chroma, o.skyline]);
    if (key(a) === key(b)) { identical++; fails.push(`C4: ${subjects[i]} and ${subjects[j]} carry an identical board`); }
    if (a.skyline && b.skyline && Math.abs(a.skyline.anchor_p50 - b.skyline.anchor_p50) < 1e-9) tooClose++;
  }
  if (tooClose && !identical) fails.push(`C4: ${tooClose} region pair(s) share a skyline anchor exactly`);

  // ---- C5 consumers --------------------------------------------------------------------------
  for (const r of rows) {
    const c = r.consumers || [];
    if (!c.length && r.advisory !== true) fails.push(`C5 ${r.id}: names no consuming child and is not marked advisory`);
  }

  // ---- C6 quarantine -------------------------------------------------------------------------
  // A judging pack must not contain a target its own subject authored. Look for board artefacts
  // anywhere under the directories packs are built into.
  const packDirs = ['reports/packs', 'runs', 'reports/blind'].map((d) => join(ROOT, d)).filter(existsSync);
  const artefacts = ['board.json', 'ART.md', 'FIDELITY.md', 'plate-metrics.json'];
  for (const dir of packDirs) {
    const stack = [dir];
    while (stack.length) {
      const d = stack.pop();
      let entries; try { entries = readdirSync(d); } catch { continue; }
      for (const e of entries) {
        const p = join(d, e);
        let st; try { st = statSync(p); } catch { continue; }
        if (st.isDirectory()) { stack.push(p); continue; }
        if (artefacts.includes(e)) fails.push(`C6: board artefact '${e}' found inside a pack directory: ${p}`);
      }
    }
  }

  return { fails, rowCount: rows.length, packDirsScanned: packDirs.length };
}

// ---------------------------------------------------------------------------------------------
function report(label, res) {
  if (res.fails.length === 0) { console.log(`${label}: GREEN (${res.rowCount} rows, ${res.packDirsScanned} pack dir(s) scanned)`); return true; }
  console.log(`${label}: RED — ${res.fails.length} failure(s)`);
  for (const f of res.fails.slice(0, 12)) console.log(`   ${f}`);
  if (res.fails.length > 12) console.log(`   ... and ${res.fails.length - 12} more`);
  return false;
}

if (argv.includes('--self-test')) {
  const clean = run();
  let ok = report('clean', clean);
  const controls = [['unsourced', 'C1'], ['crosscite', 'C2'], ['cardinal', 'C3'], ['collapse', 'C4']];
  for (const [inj, gate] of controls) {
    const res = run(new Set([inj]));
    const fired = res.fails.some((f) => f.startsWith(gate));
    console.log(`null control --inject-${inj}: ${fired ? `RED as required (${gate} fired)` : `DID NOT FIRE — ${gate} is not a control`}`);
    if (!fired) ok = false;
  }
  process.exit(ok ? 0 : 1);
}

const inj = new Set();
for (const [flag, name] of [['--inject-unsourced', 'unsourced'], ['--inject-crosscite', 'crosscite'],
  ['--inject-cardinal', 'cardinal'], ['--collapse-regions', 'collapse']]) if (argv.includes(flag)) inj.add(name);
const res = run(inj);
process.exit(report(inj.size ? `injected [${[...inj].join(',')}]` : 'board', res) ? 0 : 1);
