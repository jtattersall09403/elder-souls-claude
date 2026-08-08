#!/usr/bin/env node
// cc-scan.mjs — THE BIFURCATION PROTOCOL, AS SOMETHING THAT RUNS.
//
// `corpus/70-visual/RI-VIS01-bifurcation-protocol.md` §Comparison-method step 5 names this exact
// path and this exact CLI, and its own provenance note closes with: "`cc-scan.mjs` does not exist
// yet — it is specified here and owed by the methods owner; until it exists, §C is run by hand
// and the critic states 'cc-scan: manual' in its verdict." RULES.md rule 24: if a method names a
// tool that does not exist, build it, and make it able to fail. This is that tool.
//
// ---------------------------------------------------------------------------------------------
// WHAT THIS IS AND — MORE IMPORTANTLY — WHAT IT IS NOT.
//
// RI-VIS01 §How-we-lose says it in one line: **"The lint becomes the judge. cc-scan.mjs passes
// because the critic avoided the banned words while making the banned argument."** A phrase list
// is a tripwire and the human-readable rule in §C is the law. So a tool that only greps for
// "intentionally low-poly" is a tool that certifies careful liars, and shipping one as "the
// bifurcation protocol" would be worse than shipping nothing.
//
// Therefore this file runs TWO checks with different standing, and says which is which in every
// output it produces:
//
//   STRUCTURAL (load-bearing, mechanically decidable, cannot be talked around)
//     S1  A declaration block exists, and is well-formed.
//     S2  JUDGEMENT SIDE is singular and one of the two legal values.
//     S3  Every PROPERTIES UNDER JUDGEMENT id exists in RI-VIS01 §A — parsed FROM THE ITEM FILE,
//         not restated here — and every one is on the declared side's column. A P* and an F* in
//         one declaration is §B's "automatic void".
//     S4  PERMITTED / FORBIDDEN reference sets match the declared side.
//     S5  CAPTURE names a file and a sha256, and the sha256 IS THE SHA256 OF THAT FILE. This is
//         the one that stops a declaration being decorative: a capture line nobody can resolve
//         is a claim about an image that may not exist. (`--no-capture-check` for a verdict whose
//         shots were never committed; it is recorded as a WAIVER in the output, not as a pass.)
//     S6  ORDERING. The declaration must be emitted before the body cites a shot — RI-VIS01
//         §How-we-lose, "Retroactive declaration ... Detectable only by ordering". Any reference
//         to a capture path or a `.png`/`.jpg` outside a declaration block, before the first
//         declaration block, is a hit.
//     S7  SCORE FUSION (CC-5) is structural, not lexical: a single number presented as *the*
//         visual score. Detected as a line carrying a visual-score noun and exactly one numeric
//         score, or an explicit mean/average of the two sides.
//     S8  Two sides judged in one file must be two declaration blocks with DISJOINT property
//         sets. §B: "A critic judging both sides in one pass runs two passes and emits two
//         declarations."
//
//   LEXICAL (a tripwire — a hit is "go and re-read this line", never by itself a verdict)
//     CC-1 … CC-7, the phrase lists from §C, scoped to the declaration block that encloses each
//     line, exactly as §C requires. Reported as `tripwire` with the offending line and the
//     enclosing side, and they are NOT summed into the structural result.
//
// The exit code distinguishes them, because a caller that cannot tell a proved void from a
// prompt-to-re-read will collapse the two and then ignore both:
//
//   0  clean:      structural checks all pass, no tripwire hit
//   1  usage / could not read the inputs
//   4  TRIPWIRE:   structure is sound, a §C phrase fired. Re-read the line. Not a void by itself.
//   5  VOID:       a structural check failed. RI-VIS01 §B/§Scoring: the verdict is void, scores 0.
//   6  ABSENT:     the file makes visual claims and carries NO declaration at all. §B: void.
//
// ---------------------------------------------------------------------------------------------
// RULES.md rule 4 — THE FALSIFIER. `--self-test` builds twelve synthetic verdicts, one per
// failure RI-VIS01 names plus a clean control, and requires this scanner to return the declared
// verdict on every one. It then re-runs the whole suite NINE TIMES with this file's own checks
// deliberately disabled (`--break=<id>`), and requires the suite to go red under every single
// break. A break that leaves the suite green is a check that does no work, and the runner names
// it and exits non-zero. An instrument that cannot be made to fail is not an instrument.
//
// The clean control matters as much as the dirty ones: a scanner that voids everything is as
// useless as one that voids nothing, and the "canvas exists / non-zero dimensions / no page
// errors" failure this project already shipped was a check whose green arm was never tested
// against a subject that should have been red.
'use strict';

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const VIS01 = path.join(ROOT, 'corpus/70-visual/RI-VIS01-bifurcation-protocol.md');

export const EXIT = { OK: 0, USAGE: 1, TRIPWIRE: 4, VOID: 5, ABSENT: 6 };

// ---------------------------------------------------------------------------------------------
// Deliberate self-defects. Nothing in normal operation sets these; `--self-test --break=<id>`
// does, and the self-test requires the suite to go red under each.
const BREAKS = new Set();
export function breakScanner(id) { BREAKS.add(String(id)); }
export function repairScanner() { BREAKS.clear(); }
export const SCANNER_BREAKS = [
  'partition',        // §A parsed as "every id is on every side" — S3's cross-side check dies
  'side-singular',    // S2 accepts a declaration naming both sides
  'refsets',          // S4 stops checking the permitted/forbidden pair
  'capture-sha',      // S5 accepts any sha256, matching or not
  'ordering',         // S6 stops looking for retroactive declarations
  'fusion',           // S7 stops looking for a single fused visual score
  'disjoint',         // S8 stops requiring two declarations to be disjoint
  'phrases',          // CC-1..CC-7 phrase lists emptied
  'scope',            // phrase hits stop being scoped to the enclosing declaration's side
];

// ---------------------------------------------------------------------------------------------
// §A, PARSED FROM THE ITEM. RULES.md rule 18: the item is authoritative and a summary of it is
// not. If a property is appended to RI-VIS01 §A (F17–F19 already were, mid-project, by RI-UIX06),
// this tool learns it on the next run rather than drifting silently into a second, staler copy of
// the partition.

/** @returns {{art:Set<string>, fidelity:Set<string>, rows:Array}} */
export function loadPartition(file = VIS01) {
  const md = fs.readFileSync(file, 'utf8');
  const art = new Set(), fidelity = new Set(), rows = [];
  // | # | Property | Side | Judged against | Item |   — ids are P01.., F01.., or **F17** etc.
  for (const line of md.split('\n')) {
    if (!line.startsWith('|')) continue;
    const cells = line.split('|').map((c) => c.trim().replace(/\*\*/g, ''));
    if (cells.length < 5) continue;
    const id = cells[1];
    if (!/^[PF]\d{2}$/.test(id)) continue;
    const side = cells[3].toUpperCase();
    if (side !== 'ART' && side !== 'FIDELITY') continue;
    rows.push({ id, property: cells[2], side });
    if (BREAKS.has('partition')) { art.add(id); fidelity.add(id); continue; }
    (side === 'ART' ? art : fidelity).add(id);
  }
  if (!rows.length) throw new Error(`cc-scan: parsed 0 property rows out of ${file}. The §A table moved or changed shape; this tool must not guess.`);
  return { art, fidelity, rows };
}

// ---------------------------------------------------------------------------------------------
// §C phrase lists, verbatim from the item. Every entry below appears in RI-VIS01 §C's Detection
// column. `sides` is the declaration side under which the phrase is a hit — the "scoped to the
// declaration block that encloses each line" clause.

const RX = (s) => new RegExp(s, 'i');
export const PHRASES = [
  { cc: 'CC-1', sides: ['FIDELITY'], what: '2002 reference cited under SIDE: FIDELITY', rx: [
    /\bmorrowind\b/i, /\b2002\b/i, /\bvvardenfell\b/i, /\btelvanni\b/i, /\bredoran\b/i,
    /bethesda-era/i, /\bfor its time\b/i, /\bRI-VIS05\b/,
  ] },
  { cc: 'CC-2', sides: ['ART_DIRECTION'], what: 'modern AAA reference cited under SIDE: ART_DIRECTION', rx: [
    /\belden ring\b/i, /\bskyrim se\b/i, /\brdr2\b/i, /\bunreal\b/i, /\bAAA\b/, /next-gen/i,
    /\bRI-VIS0[23]\b/,
  ] },
  { cc: 'CC-3', sides: ['FIDELITY', 'ART_DIRECTION'], fOnly: true, what: 'THE CARDINAL SIN — low fidelity excused as style', rx: [
    /stylised so it'?s fine/i, /stylized so it'?s fine/i, /intentionally low-?poly/i,
    /matches morrowind'?s look/i, /retro aesthetic/i, /art direction compensates/i,
    /charmingly simple/i, /the flatness is deliberate/i,
  ] },
  { cc: 'CC-4', sides: ['FIDELITY', 'ART_DIRECTION'], what: 'art direction excused by fidelity', rx: [
    /it'?s generic but it looks great/i, /the lighting carries it/i,
    /high fidelity so the setting reads/i,
  ] },
  { cc: 'CC-6', sides: ['FIDELITY', 'ART_DIRECTION'], what: 'reference-free assertion', rx: [
    /\bit looks bad\b/i, /\blooks fine\b/i, /\blooks great\b/i,
  ] },
  { cc: 'CC-7', sides: ['FIDELITY', 'ART_DIRECTION'], fOnly: true, what: 'the diegetic-blur excuse (F17/F18/F19)', rx: [
    /meant to look like old parchment/i, /the softness is the wet-paper look/i,
    /hand-?drawn so it shouldn'?t be crisp/i, /the blur is atmospheric/i, /weathered look/i,
    /it'?s supposed to look aged/i, /the texture reads as damp/i,
    /diegetic so fidelity doesn'?t apply/i,
  ] },
];

// ---------------------------------------------------------------------------------------------
// The declaration block.

const DECL_OPEN = /^\s*={2,}\s*VIS DECLARATION\s*={2,}\s*$/;
const DECL_CLOSE = /^\s*={2,}\s*END DECLARATION\s*={2,}\s*$/;

/**
 * Pull every declaration block out of a verdict, with the line range it governs. A block governs
 * from its own opening line to the next block's opening line (or EOF) — that is what "the
 * declaration block that encloses each line" means for a file with two passes in it.
 */
export function parseDeclarations(text) {
  const lines = text.split('\n');
  const blocks = [];
  let cur = null;
  for (let i = 0; i < lines.length; i++) {
    const L = lines[i];
    if (DECL_OPEN.test(L)) { cur = { start: i, end: null, fields: {}, raw: [], malformed: false }; blocks.push(cur); continue; }
    if (cur && cur.end === null && DECL_CLOSE.test(L)) { cur.end = i; continue; }
    if (cur && cur.end === null) {
      cur.raw.push(L);
      const m = L.match(/^\s*([A-Z][A-Z /]*[A-Z])\s*:\s*(.*?)\s*(?:#.*)?$/);
      if (m) cur.fields[m[1].trim()] = m[2].trim();
    }
  }
  for (const b of blocks) if (b.end === null) b.malformed = true;
  // Governed ranges.
  for (let i = 0; i < blocks.length; i++) {
    blocks[i].governs = [blocks[i].start, i + 1 < blocks.length ? blocks[i + 1].start - 1 : lines.length - 1];
  }
  return { blocks, lines };
}

const SIDE_ALIASES = {
  FIDELITY: 'FIDELITY',
  ART_DIRECTION: 'ART_DIRECTION',
  'ART DIRECTION': 'ART_DIRECTION',
  ART: 'ART_DIRECTION',
};

function normSide(s) {
  const k = String(s || '').trim().toUpperCase().replace(/\s+/g, ' ');
  return SIDE_ALIASES[k] || SIDE_ALIASES[k.replace(/ /g, '_')] || null;
}

function sha256File(p) {
  return crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
}

/** Does this file make a visual claim at all? Only such a file needs a declaration. */
export function makesVisualClaims(text) {
  return /\b(RI-VIS0[1-9]|RI-UIX06|RI-CAM07|fidelity|art direction|art-direction)\b/i.test(text);
}

// ---------------------------------------------------------------------------------------------
// The scan.

/**
 * @param {string} text        verdict body
 * @param {object} opts
 * @param {string} [opts.file] path, used to resolve CAPTURE: relative names
 * @param {boolean} [opts.captureCheck=true]
 * @param {object} [opts.partition]
 */
export function scan(text, opts = {}) {
  const partition = opts.partition || loadPartition();
  const captureCheck = opts.captureCheck !== false;
  const baseDir = opts.file ? path.dirname(path.resolve(opts.file)) : ROOT;
  const { blocks, lines } = parseDeclarations(text);

  const structural = [];   // {id, ok, why}
  const tripwires = [];    // {cc, line_no, line, side, what}
  const waivers = [];
  const S = (id, ok, why) => structural.push({ id, ok: !!ok, why });

  // ---- S1 / ABSENT ---------------------------------------------------------------------------
  if (blocks.length === 0) {
    const claims = makesVisualClaims(text);
    S('S1', !claims, claims
      ? 'no === VIS DECLARATION === block, in a file that makes visual claims. RI-VIS01 §B: "A verdict without it is void and scores 0."'
      : 'no declaration block, and the file makes no visual claim — nothing to declare.');
    return finish({ structural, tripwires, waivers, blocks, absent: claims, declarations: [] });
  }

  const decls = [];
  for (const b of blocks) {
    const side = normSide(b.fields['JUDGEMENT SIDE']);
    const propsRaw = String(b.fields['PROPERTIES UNDER JUDGEMENT'] || '');
    const props = propsRaw.split(/[,\s]+/).map((s) => s.trim().replace(/\*\*/g, '')).filter((s) => /^[PF]\d{2}$/.test(s));
    decls.push({ ...b, side, props, propsRaw });
  }

  // ---- S1 well-formed ------------------------------------------------------------------------
  const malformed = decls.filter((d) => d.malformed);
  S('S1', malformed.length === 0, malformed.length
    ? `${malformed.length} declaration block(s) opened and never closed with === END DECLARATION ===`
    : `${decls.length} declaration block(s), all closed`);

  // ---- S2 side singular ----------------------------------------------------------------------
  const badSide = BREAKS.has('side-singular') ? [] : decls.filter((d) => {
    if (!d.side) return true;
    const raw = String(d.fields['JUDGEMENT SIDE'] || '');
    // "FIDELITY and ART_DIRECTION", "both", a comma — §B: "JUDGEMENT SIDE is singular."
    return /\b(and|both|\+|,|\/)\b/i.test(raw) || /both/i.test(raw);
  });
  S('S2', badSide.length === 0, badSide.length
    ? `JUDGEMENT SIDE is not a single legal value in ${badSide.length} block(s): ${badSide.map((d) => JSON.stringify(d.fields['JUDGEMENT SIDE'] || '(missing)')).join(', ')}. §B: it is singular; a critic judging both sides runs two passes.`
    : `every JUDGEMENT SIDE is exactly one of FIDELITY | ART_DIRECTION`);

  // ---- S3 properties on the declared side ----------------------------------------------------
  const s3 = [];
  for (const d of decls) {
    if (!d.props.length) { s3.push(`a block declares no PROPERTIES UNDER JUDGEMENT (${JSON.stringify(d.propsRaw)})`); continue; }
    const legal = d.side === 'ART_DIRECTION' ? partition.art : partition.fidelity;
    const other = d.side === 'ART_DIRECTION' ? partition.fidelity : partition.art;
    for (const p of d.props) {
      if (!partition.art.has(p) && !partition.fidelity.has(p)) {
        s3.push(`${p} is not in RI-VIS01 §A at all — §A is "exhaustive and closed"; an unlisted property is UNASSIGNED and needs a corpus extension first`);
      } else if (!legal.has(p) && other.has(p)) {
        s3.push(`${p} is a ${d.side === 'ART_DIRECTION' ? 'FIDELITY' : 'ART'} property declared under SIDE: ${d.side} — §B: "Mixing a P* and an F* in one declaration is an automatic void"`);
      }
    }
  }
  S('S3', s3.length === 0, s3.length ? s3.join('; ') : `all ${decls.reduce((n, d) => n + d.props.length, 0)} declared properties resolve in §A and sit on their declared side`);

  // ---- S4 reference sets ---------------------------------------------------------------------
  const s4 = [];
  if (!BREAKS.has('refsets')) {
    for (const d of decls) {
      const perm = String(d.fields['PERMITTED REFERENCE SET'] || '');
      const forb = String(d.fields['FORBIDDEN REFERENCE SET'] || '');
      if (!perm || !forb) { s4.push('a block omits PERMITTED or FORBIDDEN REFERENCE SET'); continue; }
      const wantPerm = d.side === 'FIDELITY' ? 'RI-VIS02' : 'RI-VIS05';
      const wantForb = d.side === 'FIDELITY' ? 'RI-VIS05' : 'RI-VIS02';
      if (!perm.includes(wantPerm)) s4.push(`SIDE: ${d.side} must permit ${wantPerm}, and permits ${JSON.stringify(perm)}`);
      if (!forb.includes(wantForb)) s4.push(`SIDE: ${d.side} must forbid ${wantForb}, and forbids ${JSON.stringify(forb)}`);
      if (perm.includes(wantForb)) s4.push(`SIDE: ${d.side} lists the forbidden set ${wantForb} as PERMITTED`);
    }
  }
  S('S4', s4.length === 0, s4.length ? s4.join('; ') : 'permitted/forbidden reference sets match the declared side in every block');

  // ---- S5 capture resolves and its sha256 is real --------------------------------------------
  const s5 = [];
  const captures = [];
  for (const d of decls) {
    const cap = String(d.fields.CAPTURE || '').trim();
    if (!cap) { s5.push('a block omits CAPTURE — §Comparison-method step 1: "Record sha256 of every PNG in the declaration"'); continue; }
    const m = cap.match(/^(\S+)\s+sha256:([0-9a-fA-F]{6,64})/);
    if (!m) { s5.push(`CAPTURE ${JSON.stringify(cap)} is not "<path> sha256:<hex>"`); continue; }
    const [, rel, hex] = m;
    const cand = [path.resolve(baseDir, rel), path.resolve(ROOT, rel)];
    const hit = cand.find((p) => fs.existsSync(p) && fs.statSync(p).isFile());
    if (!captureCheck) { waivers.push(`capture sha256 not verified for ${rel} (--no-capture-check)`); captures.push({ rel, declared: hex, actual: null, ok: null }); continue; }
    if (!hit) { s5.push(`CAPTURE names ${rel}, which is not on disk at ${cand.map((c) => path.relative(ROOT, c)).join(' or ')}. A declaration citing an unresolvable image is a claim about a picture nobody can look at.`); captures.push({ rel, declared: hex, actual: null, ok: false }); continue; }
    const actual = sha256File(hit);
    const ok = BREAKS.has('capture-sha') ? true : actual.startsWith(hex.toLowerCase()) || hex.toLowerCase() === actual;
    if (!ok) s5.push(`CAPTURE ${rel} declares sha256:${hex} and the file on disk hashes to ${actual}`);
    captures.push({ rel, declared: hex, actual, ok });
  }
  S('S5', s5.length === 0, s5.length ? s5.join('; ') : `every CAPTURE resolves on disk and its declared sha256 matches (${captures.length} capture(s))`);

  // ---- S6 ordering: no shot cited before the first declaration --------------------------------
  const s6 = [];
  if (!BREAKS.has('ordering')) {
    const firstDecl = decls[0].start;
    for (let i = 0; i < firstDecl; i++) {
      const L = lines[i];
      if (/\.(png|jpe?g|avif|webp)\b/i.test(L) && !/^\s*(#|>|\/\/)/.test(L)) {
        s6.push(`line ${i + 1} cites a capture before any declaration is emitted: ${L.trim().slice(0, 120)}`);
      }
    }
  }
  S('S6', s6.length === 0, s6.length
    ? s6.join('; ') + ' — §How-we-lose "Retroactive declaration ... Detectable only by ordering: the declaration must cite the capture sha256 before the body references any specific shot region."'
    : 'no capture is cited before the first declaration block');

  // ---- S7 score fusion (CC-5, structurally) ---------------------------------------------------
  const s7 = [];
  if (!BREAKS.has('fusion')) {
    for (let i = 0; i < lines.length; i++) {
      const L = lines[i];
      if (/\b(mean|average|averaged|weighted)\b[^.]{0,40}\b(art|fidelity|visual)\b/i.test(L)
        || /\b(art|fidelity)\b[^.]{0,40}\b(averaged|mean of|weighted with)\b/i.test(L)) {
        s7.push(`line ${i + 1} averages the two sides: ${L.trim().slice(0, 120)}`);
        continue;
      }
      // "VISUAL: 5/10" / "overall visual score: 6" — one number where §E requires an ordered pair.
      const m = L.match(/\b(?:combined |overall |single )?visual(?: score)?\s*[:=]\s*(\d+(?:\.\d+)?)\s*(?:\/\s*\d+)?/i);
      if (m && !/\bart\b/i.test(L) && !/\bfidelity\b/i.test(L)) {
        s7.push(`line ${i + 1} reports one fused visual score: ${L.trim().slice(0, 120)} — §E: "The ship gate is min(), never mean()", and CC-5 fails any single combined visual score.`);
      }
    }
  }
  S('S7', s7.length === 0, s7.length ? s7.join('; ') : 'no fused visual score and no mean over the two sides');

  // ---- S8 two sides => two disjoint declarations ----------------------------------------------
  const s8 = [];
  if (!BREAKS.has('disjoint')) {
    const sides = new Set(decls.map((d) => d.side).filter(Boolean));
    if (sides.size === 2) {
      const a = new Set(decls.filter((d) => d.side === 'ART_DIRECTION').flatMap((d) => d.props));
      const f = new Set(decls.filter((d) => d.side === 'FIDELITY').flatMap((d) => d.props));
      const both = [...a].filter((p) => f.has(p));
      if (both.length) s8.push(`the two passes share ${both.join(', ')} — §Scoring: "the two score sets sharing a reference item ... voids the verdict"`);
    }
  }
  S('S8', s8.length === 0, s8.length ? s8.join('; ') : (new Set(decls.map((d) => d.side)).size === 2 ? 'the two passes declare disjoint property sets' : 'one side judged; disjointness not applicable'));

  // ---- CC-1..CC-7, scoped to the enclosing block ----------------------------------------------
  if (!BREAKS.has('phrases')) {
    for (const d of decls) {
      const [lo, hi] = d.governs;
      const inDecl = new Set();
      for (let i = d.start; i <= (d.end === null ? d.start : d.end); i++) inDecl.add(i);
      for (let i = lo; i <= hi; i++) {
        if (inDecl.has(i)) continue;          // the declaration's own text is not the verdict body
        const L = lines[i];
        if (!L.trim()) continue;
        for (const p of PHRASES) {
          const scoped = BREAKS.has('scope') ? true : p.sides.includes(d.side);
          if (!scoped) continue;
          // CC-3 / CC-7 only bite when the sentence is ABOUT an F* property (§C: "applied to any
          // F* property"). A sentence with no F* id in it, and no F* in the enclosing
          // declaration, is not the cardinal sin — it is an art-direction sentence.
          if (p.fOnly && !BREAKS.has('scope')) {
            const fInLine = /\bF\d{2}\b/.test(L);
            const fInDecl = d.props.some((x) => x.startsWith('F'));
            if (!fInLine && !fInDecl) continue;
          }
          for (const rx of p.rx) {
            if (rx.test(L)) {
              tripwires.push({ cc: p.cc, what: p.what, side: d.side, line_no: i + 1, line: L.trim().slice(0, 160), matched: String(rx) });
              break;
            }
          }
        }
      }
    }
  }

  return finish({ structural, tripwires, waivers, blocks: decls, absent: false, declarations: decls.map((d) => ({ side: d.side, properties: d.props, capture: d.fields.CAPTURE || null, line: d.start + 1 })), captures });
}

function finish(r) {
  const failed = r.structural.filter((s) => !s.ok);
  const verdict = r.absent ? 'ABSENT' : failed.length ? 'VOID' : r.tripwires.length ? 'TRIPWIRE' : 'CLEAN';
  return {
    schema: 'elder-souls/cc-scan@1',
    item: 'RI-VIS01',
    verdict,
    exit: EXIT[verdict === 'CLEAN' ? 'OK' : verdict],
    structural: r.structural,
    structural_failed: failed.map((s) => s.id),
    tripwires: r.tripwires,
    waivers: r.waivers,
    declarations: r.declarations || [],
    captures: r.captures || [],
    scanner_breaks: [...BREAKS],
    note: 'structural checks are load-bearing and decide the verdict; CC-1..CC-7 are a tripwire and never decide it alone (RI-VIS01 §How-we-lose: "The lint becomes the judge").',
  };
}

export function format(res, file) {
  const out = [];
  out.push(`cc-scan  ${file || '(stdin)'}  ->  ${res.verdict}`);
  for (const s of res.structural) out.push(`  ${s.ok ? 'ok  ' : 'FAIL'} ${s.id}  ${s.why}`);
  for (const w of res.waivers) out.push(`  WAIVED  ${w}`);
  if (res.tripwires.length) {
    out.push(`  -- tripwire (${res.tripwires.length}) — re-read these lines; a confirmed hit voids, the hit alone does not --`);
    for (const t of res.tripwires) out.push(`  ${t.cc}  [${t.side}]  line ${t.line_no}: ${t.line}`);
  }
  return out.join('\n');
}

// ---------------------------------------------------------------------------------------------
// SELF-TEST. RULES.md rule 4.

const DECL = (side, props, cap = 'docs/shots/nonexistent.png', sha = 'deadbeef') => [
  '=== VIS DECLARATION ===',
  `JUDGEMENT SIDE: ${side}`,
  `PROPERTIES UNDER JUDGEMENT: ${props}`,
  `PERMITTED REFERENCE SET: ${side === 'FIDELITY' ? 'RI-VIS02 (modern)' : 'RI-VIS05 (Morrowind)'}`,
  `FORBIDDEN REFERENCE SET: ${side === 'FIDELITY' ? 'RI-VIS05 (Morrowind 2002)' : 'RI-VIS02 (modern)'}`,
  `CAPTURE: ${cap}  sha256:${sha}`,
  '=== END DECLARATION ===',
].join('\n');

function selfTestCases() {
  const clean = [
    DECL('FIDELITY', 'F02, F03, F05'),
    '',
    'F02 material separation: the specular signature spread is 1.08x against a bar of 2x. Hard fail.',
    'F03 lighting: no indirect term is present in the shipped renderer.',
    'F05 ambient occlusion: absent.',
    '',
    DECL('ART_DIRECTION', 'P01, P02'),
    '',
    'P01 palette: the marsh greens sit in a 12-degree hue band.',
    'P02 silhouette: the xanmeer reads as a stepped mass.',
    '',
    'ART DIRECTION : 6/10   FIDELITY : 3/10   SHIP GATE: min = 3 -> BLOCKED',
  ].join('\n');

  return [
    { id: 'clean-two-pass', want: 'CLEAN', text: clean },

    { id: 'no-declaration-at-all', want: 'ABSENT', text:
      'The fidelity here is decent and the art direction is strong. Visuals look coherent.' },

    { id: 'mixed-P-and-F-in-one-block', want: 'VOID', text:
      DECL('FIDELITY', 'F02, P01') + '\n\nF02 is weak and P01 is fine.' },

    { id: 'property-not-in-partition', want: 'VOID', text:
      DECL('FIDELITY', 'F02, F44') + '\n\nF44 subsurface scattering on Hist sap is unmeasured.' },

    { id: 'both-sides-in-one-declaration', want: 'VOID', text:
      DECL('FIDELITY and ART_DIRECTION', 'F02') + '\n\nJudged together.' },

    { id: 'wrong-reference-set', want: 'VOID', text:
      [ '=== VIS DECLARATION ===', 'JUDGEMENT SIDE: FIDELITY',
        'PROPERTIES UNDER JUDGEMENT: F02', 'PERMITTED REFERENCE SET: RI-VIS05 (Morrowind)',
        'FORBIDDEN REFERENCE SET: RI-VIS02 (modern)', 'CAPTURE: docs/shots/x.png  sha256:deadbeef',
        '=== END DECLARATION ===', '', 'F02 is judged against the 2002 set.' ].join('\n') },

    { id: 'retroactive-declaration', want: 'VOID', text:
      'The back crop in shots/w03/player_back.png shows no relief at all.\n\n' + DECL('FIDELITY', 'F02') },

    { id: 'fused-single-score', want: 'VOID', text:
      DECL('FIDELITY', 'F02') + '\n\nF02 is thin.\n\nVISUAL: 5/10 — overall a reasonable showing.' },

    { id: 'the-two-sides-averaged', want: 'VOID', text:
      clean + '\n\nTaking the mean of art and fidelity gives 4.5 overall.' },

    { id: 'the-cardinal-sin', want: 'TRIPWIRE', text:
      DECL('FIDELITY', 'F11') + '\n\nF11 geometric density is low, but it is intentionally low-poly and matches Morrowind\'s look, so it passes.' },

    // Verbatim from §C's CC-7 detection column. A paraphrase does NOT fire, and that is the
    // documented limit of a lint: see the "lint becomes the judge" note at the head of this file.
    { id: 'the-diegetic-blur-excuse', want: 'TRIPWIRE', text:
      DECL('FIDELITY', 'F17') + '\n\nF17 glyph edges are soft, but the softness is the wet-paper look.' },

    // The scoping clause: the SAME sentence, on the art-direction side, where it is legitimate.
    { id: 'morrowind-named-under-ART-is-not-a-hit', want: 'CLEAN', text:
      DECL('ART_DIRECTION', 'P01, P02') + '\n\nP01 palette is judged against Morrowind\'s Ascadian Isles tints, per RI-VIS05.' },

    // S8: two passes that share a property. §Scoring — the two score sets must be disjoint.
    { id: 'two-passes-sharing-a-property', want: 'VOID', text:
      DECL('FIDELITY', 'F02, P01') .replace('F02, P01', 'F02') + '\n\nF02 is thin.\n\n' +
      DECL('ART_DIRECTION', 'P01').replace('PROPERTIES UNDER JUDGEMENT: P01', 'PROPERTIES UNDER JUDGEMENT: P01, F02') +
      '\n\nP01 is strong and F02 is re-judged here.' },

    // S5: a CAPTURE that resolves on disk and whose declared sha256 is wrong. This is the only
    // case run with the capture check ARMED, because it is the only one with a real file.
    { id: 'capture-sha-does-not-match-the-file', want: 'VOID', captureCheck: true, text:
      DECL('FIDELITY', 'F02', 'docs/PLAN.md', '0000000000000000000000000000000000000000000000000000000000000000') +
      '\n\nF02 material separation is thin.' },
  ];
}

async function selfTest() {
  const cases = selfTestCases();
  const run = () => cases.map((c) => {
    let got;
    try { got = scan(c.text, { captureCheck: c.captureCheck === true }).verdict; } catch (e) { got = 'THREW:' + e.message; }
    return { id: c.id, want: c.want, got, ok: got === c.want };
  });

  repairScanner();
  const base = run();
  const baseBad = base.filter((r) => !r.ok);

  const lines = [];
  lines.push('cc-scan --self-test');
  lines.push('');
  lines.push('A. the suite, intact:');
  for (const r of base) lines.push(`   ${r.ok ? 'ok  ' : 'FAIL'} ${r.id.padEnd(36)} got ${String(r.got).padEnd(9)} want ${r.want}`);
  lines.push(`   ${baseBad.length === 0 ? 'PASS' : 'FAIL'}  ${base.length - baseBad.length}/${base.length}`);
  lines.push('');
  lines.push('B. the falsifier — every check disabled in turn; the suite MUST go red under each');
  lines.push('   (a break that leaves the suite green is a check that does no work):');

  const uselessBreaks = [];
  for (const b of SCANNER_BREAKS) {
    repairScanner();
    breakScanner(b);
    const r = run();
    const bad = r.filter((x) => !x.ok);
    repairScanner();
    if (bad.length === 0) uselessBreaks.push(b);
    lines.push(`   ${bad.length ? 'went red' : 'STAYED GREEN'}  --break=${b.padEnd(16)} ${bad.length} case(s) now wrong` +
      (bad.length ? `: ${bad.map((x) => `${x.id}(${x.want}->${x.got})`).slice(0, 4).join(', ')}` : ''));
  }

  const ok = baseBad.length === 0 && uselessBreaks.length === 0;
  lines.push('');
  if (uselessBreaks.length) lines.push(`   ! ${uselessBreaks.length} break(s) left the suite green: ${uselessBreaks.join(', ')} — those checks are not doing work.`);
  lines.push(`${ok ? 'PASS' : 'FAIL'}  ${base.length} cases, ${SCANNER_BREAKS.length} deliberate self-defects, ${uselessBreaks.length} inert.`);
  process.stdout.write(lines.join('\n') + '\n');
  return ok ? 0 : 1;
}

// ---------------------------------------------------------------------------------------------

const USAGE = `
cc-scan.mjs — RI-VIS01 §C, as something that runs. Named by that item's own Comparison method.

USAGE
  node corpus/80-methods/cc-scan.mjs <verdict.md> [more.md ...] [--json out.json]
  node corpus/80-methods/cc-scan.mjs --self-test [--json out.json]

OPTIONS
  --no-capture-check   Do not verify CAPTURE sha256 against the file on disk. Recorded as a
                       WAIVER in the output; it is not a pass.
  --json <path>        Write the machine-readable result.
  --quiet              Machine output only.
  --self-test          RULES.md rule 4. Twelve synthetic verdicts with known verdicts, then the
                       whole suite re-run with each of this file's own checks disabled; the suite
                       must go red under every one.

EXIT
  0 clean · 1 usage/IO · 4 TRIPWIRE (re-read the line) · 5 VOID (structural) · 6 ABSENT (no declaration)
`;

async function main() {
  const argv = process.argv.slice(2);
  if (argv.includes('--help') || argv.includes('-h') || argv.length === 0) { process.stdout.write(USAGE.trimStart()); process.exit(argv.length === 0 ? EXIT.USAGE : 0); }
  const jsonAt = argv.indexOf('--json');
  const jsonOut = jsonAt >= 0 ? argv[jsonAt + 1] : null;
  const quiet = argv.includes('--quiet');
  const captureCheck = !argv.includes('--no-capture-check');

  if (argv.includes('--self-test')) {
    const code = await selfTest();
    process.exit(code);
  }

  const files = argv.filter((a, i) => !a.startsWith('--') && !(jsonAt >= 0 && i === jsonAt + 1));
  if (!files.length) { process.stdout.write(USAGE.trimStart()); process.exit(EXIT.USAGE); }

  const partition = loadPartition();
  const all = [];
  let worst = EXIT.OK;
  for (const f of files) {
    let text;
    try { text = fs.readFileSync(f, 'utf8'); }
    catch (e) { process.stderr.write(`cc-scan: cannot read ${f}: ${e.message}\n`); process.exit(EXIT.USAGE); }
    const res = scan(text, { file: f, captureCheck, partition });
    res.file = path.relative(ROOT, path.resolve(f));
    all.push(res);
    if (res.exit > worst) worst = res.exit;
    if (!quiet) process.stdout.write(format(res, res.file) + '\n\n');
  }
  const payload = { schema: 'elder-souls/cc-scan-run@1', n: all.length, worst_exit: worst, partition_rows: partition.rows.length, results: all };
  if (jsonOut) { fs.mkdirSync(path.dirname(path.resolve(jsonOut)), { recursive: true }); fs.writeFileSync(jsonOut, JSON.stringify(payload, null, 2)); process.stderr.write(`cc-scan: wrote ${jsonOut}\n`); }
  if (quiet) process.stdout.write(JSON.stringify(payload, null, 2) + '\n');
  process.exit(worst);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
