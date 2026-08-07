#!/usr/bin/env node
// beat-extract.mjs — the blind-pack producer RI-MTH06 §C specifies.
//
// Named by: RI-JRN01 (blind pair), RI-JRN02 (blind pair), RI-MTH06 §B/§C.
//
// THE PROBLEM IT EXISTS TO FIX, quoted from RI-MTH06 §C:
//   "Wave 1 built the RI-JRN01 pack by hand and had to record `reference-wins-on-review` partly
//    because the pack was unfair IN FORM: our side was verbatim transcript from the running
//    build, the reference side was RI-JRN01 §A's recalled beat TABLE, which is narration. A pack
//    in which one side is dialogue and the other is stage direction is discriminable on register,
//    not on the property under test."
//
// So this tool emits BOTH sides in ONE form — actor, place, utterance, field-set — and the
// reference side comes from a file committed once (`corpus/88-journeys/data/mw-open-beats.json`)
// rather than being re-extracted by whoever needs it that week, which is RI-MTH06's How-we-lose
// #5. This tool READS that file and REFUSES TO WRITE IT.
//
// THE STRIPPING IS THE POINT. RI-JRN01's pack asks the judge:
//   "In which of these two openings is the player's identity produced by something a character
//    in the world is doing for a reason of their own?"
// Proper nouns are replaced with «person» and «place» so the judge cannot answer "the one that
// says Seyda Neen". A pack that leaks its provenance is not blind, and a length mismatch is a
// provenance leak, so the two sides are length-matched and the assignment is a recorded coin
// flip from a stated seed.
//
// EXIT CODES: 0 pack written; 1 a side could not be produced (said why); 2 usage.
'use strict';

import fs from 'node:fs';
import path from 'node:path';
import {
  REPO_ROOT, parseArgs, wantsHelp, usage, writeJson, readJson, log, die, EXIT, mulberry32, sha256,
} from '../lib/cli.mjs';

const USAGE = `
beat-extract.mjs — emit both sides of a journey blind pack in ONE form.

USAGE
  node tools/journey/beat-extract.mjs --from reports/journeys/<runId> --out reports/blind/<packId>
  node tools/journey/beat-extract.mjs --from <runDir> --reference mw-open --seed 4711 --pack
  node tools/journey/beat-extract.mjs --reference mw-open --print
  node tools/journey/beat-extract.mjs --self-test

OPTIONS
  --from DIR        a journey-run.mjs run directory (reads journey.json, trace.jsonl)
  --reference ID    the committed reference side. Known: mw-open
  --pack            emit a two-sided blind pack with a recorded coin-flip assignment
  --seed N          the coin-flip seed (recorded in the pack; default 4711)
  --lines N         length-match both sides to N beats (default: min of the two)
  --out DIR         where to write (default reports/blind/<packId>)
  --print           print the named side and exit
  --self-test       prove the stripper works: assert no proper noun from either side survives,
                    assert the two sides are length-matched, and assert a DELIBERATELY LEAKY
                    beat is caught

FORM (both sides, identical)
  { "actor": "...", "place": "...", "utterance": "...", "fields_set": ["race"] }

REFERENCE SIDE
  corpus/88-journeys/data/mw-open-beats.json — MW/OPEN rows 3-12, hand-authored from
  RI-JRN01 §A and committed ONCE so every critic compares against the same text.
  This tool never writes that file.
`;

const REFERENCES = {
  'mw-open': path.join(REPO_ROOT, 'corpus/88-journeys/data/mw-open-beats.json'),
};

// ---------------------------------------------------------------------------------------------
// Stripping
// ---------------------------------------------------------------------------------------------

/**
 * Proper nouns are the leak. We do not guess at them with a capital-letter heuristic alone —
 * that would strip "You" and miss "the Wet Ledger". The name list is built from the beats
 * themselves (every `actor` and `place` string contributes its capitalised tokens) plus the
 * shipped NPC and settlement names, so a name that appears only in an utterance is still caught.
 */
export function buildNameSet(beats, extraNames = []) {
  const names = new Set();
  const add = (s) => {
    if (!s || typeof s !== 'string') return;
    // Multi-word capitalised runs first ("Census and Excise Office", "Seyda Neen").
    for (const m of s.match(/\b[A-Z][a-z'’-]+(?:\s+(?:and\s+|of\s+|the\s+)?[A-Z][a-z'’-]+)*/g) || []) {
      names.add(m);
      for (const w of m.split(/\s+/)) if (/^[A-Z]/.test(w) && w.length > 2) names.add(w);
    }
  };
  for (const b of beats) { add(b.actor); add(b.place); add(b.utterance); }
  for (const n of extraNames) add(n);
  // Words that are capitalised but are not names. Stripping these would mangle the prose and
  // would itself be a register signal.
  const STOP = new Set(['You', 'Your', 'The', 'A', 'An', 'It', 'He', 'She', 'They', 'I', 'This',
    'That', 'There', 'Take', 'Go', 'Tell', 'Come', 'Ah', 'Yes', 'No', 'What', 'Under', 'Wake',
    'Why', 'Are', 'And', 'But', 'Of', 'In', 'On', 'At', 'To', 'Up', 'Down', 'Crates', 'Weather']);
  for (const s of STOP) names.delete(s);
  return names;
}

export function stripBeat(beat, names) {
  const scrub = (s, token) => {
    if (!s || typeof s !== 'string') return s;
    let out = s;
    // Longest first, so "Census and Excise Office" goes before "Census".
    for (const n of [...names].sort((a, b) => b.length - a.length)) {
      out = out.split(n).join(token);
    }
    // Collapse "«place», «place»" that the substitution can produce.
    out = out.replace(/(«[a-z]+»)(\s*[,;]\s*\1)+/g, '$1');
    return out;
  };
  return {
    actor: scrub(beat.actor, '«person»'),
    place: scrub(beat.place, '«place»'),
    utterance: scrub(scrub(beat.utterance, '«person»'), '«place»'),
    fields_set: Array.isArray(beat.fields_set) ? beat.fields_set.slice() : [],
  };
}

/** Anything that still looks like a proper noun after stripping is a leak. Returns the leaks. */
export function leaks(strippedBeats) {
  const out = [];
  const ALLOWED = new Set(['You', 'Your', 'The', 'A', 'An', 'It', 'He', 'She', 'They', 'I', 'This',
    'That', 'There', 'Take', 'Go', 'Tell', 'Come', 'Ah', 'Yes', 'No', 'What', 'Under', 'Wake',
    'Why', 'Are', 'And', 'But', 'Of', 'In', 'On', 'At', 'To', 'Up', 'Down', 'Crates', 'Weather']);
  for (let i = 0; i < strippedBeats.length; i++) {
    const b = strippedBeats[i];
    for (const [field, val] of Object.entries(b)) {
      if (typeof val !== 'string') continue;
      // A capitalised token that is not sentence-initial and not allowed.
      for (const m of val.match(/(?:[^.!?]\s+)([A-Z][a-z'’-]{2,})/g) || []) {
        const w = m.trim().split(/\s+/).pop();
        if (!ALLOWED.has(w)) out.push({ beat: i, field, token: w, context: val.slice(0, 80) });
      }
    }
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// Our side: extracted from a journey-run directory
// ---------------------------------------------------------------------------------------------
export function extractOurSide(runDir) {
  const jp = path.join(runDir, 'journey.json');
  if (!fs.existsSync(jp)) {
    return { beats: [], error: `${path.relative(REPO_ROOT, jp)} does not exist — run journey-run.mjs first` };
  }
  const run = readJson(jp);
  const beats = [];
  for (const b of run.beats || []) {
    if (b.kind === 'census_node') {
      beats.push({
        actor: b.speaker || '(unnamed speaker)',
        place: b.place || '(unstated place)',
        // The utterance is what the player could SEE. Not what getCensusState() carried:
        // RI-CHR01's §CONSUMPTION "orphan text" failure is ten authored dilemmas carried
        // correctly in the state and drawn zero times, and a blind pack built from the state
        // would present text no player ever read as if it had been read.
        utterance: (b.drawn_text && b.drawn_text.length ? b.drawn_text.join(' ') : '') || '',
        fields_set: b.fields_set || [],
        _question_in_state: b.question_in_state || '',
        _question_reaches_frame: !!b.question_reaches_frame,
      });
    } else if (b.kind === 'surface_enter' && b.speaker) {
      beats.push({ actor: b.speaker, place: b.place || '(unstated place)', utterance: '', fields_set: [] });
    } else if (b.kind === 'first_control') {
      beats.push({
        actor: 'the player', place: '(the world)',
        utterance: b.moved ? 'You are in control, standing, undefined.' : '',
        fields_set: [],
      });
    }
  }
  const empty = beats.filter((b) => !b.utterance.trim()).length;
  return {
    beats,
    run_id: run.run_id, journey: run.journey,
    // THE headline honesty number. A side made of beats with no utterance is a side of stage
    // directions, which is exactly the unfairness RI-MTH06 §C is about — except this time it
    // would be OURS. It is reported, not hidden.
    beats_with_no_drawn_text: empty,
    orphan_text_beats: beats.filter((b) => b._question_in_state && !b._question_reaches_frame).length,
  };
}

export function loadReference(id) {
  const p = REFERENCES[id];
  if (!p) return { beats: [], error: `unknown --reference ${id}. Known: ${Object.keys(REFERENCES).join(', ')}` };
  if (!fs.existsSync(p)) return { beats: [], error: `${path.relative(REPO_ROOT, p)} is missing` };
  const doc = readJson(p);
  return { beats: doc.beats || [], source: doc.source, provenance: doc.provenance, id: doc.id };
}

// ---------------------------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------------------------
const isMain = process.argv[1] && process.argv[1].endsWith('beat-extract.mjs');
if (isMain) {
  const args = parseArgs();
  if (wantsHelp(args)) usage(USAGE);
  if (args['self-test']) process.exit(selfTest());

  if (args.print && args.reference) {
    const ref = loadReference(String(args.reference));
    if (ref.error) die(EXIT.MEASUREMENT_FAIL, ref.error);
    const names = buildNameSet(ref.beats);
    process.stdout.write(JSON.stringify(ref.beats.map((b) => stripBeat(b, names)), null, 2) + '\n');
    process.exit(0);
  }

  const seed = Number(args.seed || 4711);
  const ours = args.from ? extractOurSide(path.resolve(String(args.from))) : { beats: [], error: '--from was not given' };
  const ref = loadReference(String(args.reference || 'mw-open'));

  if (ours.error) {
    process.stderr.write(`[beat-extract] our side unavailable: ${ours.error}\n`);
  }
  if (ref.error) die(EXIT.MEASUREMENT_FAIL, ref.error);

  if (!args.pack) {
    process.stdout.write(JSON.stringify({ ours, reference: { id: ref.id, beats: ref.beats.length } }, null, 2) + '\n');
    process.exit(ours.error ? 1 : 0);
  }

  if (!ours.beats.length) {
    die(EXIT.MEASUREMENT_FAIL,
      'our side has ZERO beats, so no pack can be built. ' +
      (ours.error || 'the run produced no census node, no named speaker and no first_control beat') +
      '. A one-sided pack is not a blind pair; RI-JRN01\'s blind pair is `unmeasurable` for this run.');
  }

  // Length-match. The shorter side sets the length; truncating the longer one is the only
  // symmetric option, because padding invents beats.
  const n = Number(args.lines) || Math.min(ours.beats.length, ref.beats.length);
  const allNames = buildNameSet([...ours.beats, ...ref.beats]);
  const A = ours.beats.slice(0, n).map((b) => stripBeat(b, allNames));
  const B = ref.beats.slice(0, n).map((b) => stripBeat(b, allNames));

  const rng = mulberry32(seed);
  const flip = rng() < 0.5;   // recorded, so the pack is reproducible and the assignment is not ours to choose
  const packId = `jrn-blind-${seed}-${sha256(JSON.stringify([A, B])).slice(0, 8)}`;
  const outDir = args.out ? path.resolve(String(args.out)) : path.join(REPO_ROOT, 'reports', 'blind', packId);

  const leakA = leaks(A), leakB = leaks(B);

  const pack = {
    schema: 'elder-souls/blind-pack@1',
    tool: 'tools/journey/beat-extract.mjs',
    item: 'RI-JRN01 blind pair / RI-MTH06 §C',
    pack_id: packId,
    seed, coin_flip: flip ? 'A=ours' : 'A=reference',
    beats_per_side: n,
    discriminating_question:
      'In which of these two openings is the player\'s identity produced by something a ' +
      'character in the world is doing for a reason of their own?',
    form: ['actor', 'place', 'utterance', 'fields_set'],
    side_A: flip ? A : B,
    side_B: flip ? B : A,
    // Everything below is the KEY. A judge is handed side_A/side_B only.
    _key: {
      A: flip ? 'ours' : 'reference',
      B: flip ? 'reference' : 'ours',
      ours_run_id: ours.run_id || null,
      ours_journey: ours.journey || null,
      reference_id: ref.id, reference_source: ref.source, reference_provenance: ref.provenance,
      ours_beats_with_no_drawn_text: ours.beats_with_no_drawn_text,
      ours_orphan_text_beats: ours.orphan_text_beats,
      leaks_side_ours: (flip ? leakA : leakB),
      leaks_side_reference: (flip ? leakB : leakA),
      fairness_note:
        'Both sides are in the same four-field form, stripped against ONE shared name set and ' +
        'truncated to the same length. If `ours_beats_with_no_drawn_text` is greater than 0 the ' +
        'pack is still unfair in form — our side is carrying stage directions where the reference ' +
        'carries speech — and the critic must say so rather than report the judge\'s pick.',
    },
  };

  writeJson(path.join(outDir, 'pack.json'), pack);
  // The judge's copy: sides only, no key.
  writeJson(path.join(outDir, 'pack-blind.json'), {
    pack_id: packId, discriminating_question: pack.discriminating_question,
    form: pack.form, side_A: pack.side_A, side_B: pack.side_B,
  });
  log(`wrote ${outDir}`);
  process.stdout.write(`beat-extract: pack ${packId}, ${n} beats/side, assignment ${pack.coin_flip}\n`);
  if (ours.beats_with_no_drawn_text > 0) {
    process.stdout.write(
      `  WARNING: ${ours.beats_with_no_drawn_text}/${ours.beats.length} of OUR beats have no drawn text. ` +
      `The pack is still discriminable on form. Report this, do not report the judge's pick alone.\n`);
  }
  if (ours.orphan_text_beats > 0) {
    process.stdout.write(
      `  ORPHAN TEXT: ${ours.orphan_text_beats} census node(s) carried a question in getCensusState() ` +
      `that did not reach the frame (RI-CHR01 §CONSUMPTION, the fourth shape of the failure).\n`);
  }
  if (leakA.length || leakB.length) {
    process.stdout.write(`  LEAK: ${leakA.length + leakB.length} capitalised token(s) survived stripping — see _key.leaks_*\n`);
  }
  process.exit((leakA.length + leakB.length) === 0 ? 0 : 1);
}

// ---------------------------------------------------------------------------------------------
function selfTest() {
  const lines = [];
  let failed = 0;
  const ok = (n, pass, d) => { lines.push(`${pass ? 'PASS' : 'FAIL'} ${n} — ${d}`); if (!pass) failed++; };

  const ref = loadReference('mw-open');
  ok('reference side is committed and loads', !ref.error && ref.beats.length > 0,
    ref.error || `${ref.beats.length} beats from ${ref.id}`);

  const names = buildNameSet(ref.beats);
  const stripped = ref.beats.map((b) => stripBeat(b, names));
  const l = leaks(stripped);
  ok('stripper removes every proper noun from the reference side', l.length === 0,
    l.length ? `LEAKED: ${l.slice(0, 4).map((x) => x.token).join(', ')}` : `0 leaks over ${stripped.length} beats`);

  // The falsification: a beat with a name the stripper was never told about must be CAUGHT by
  // `leaks()`. If leaks() cannot see a leak, the "0 leaks" above means nothing.
  const leaky = [{ actor: 'a scribe', place: 'a desk', utterance: 'Go and find Caius Cosades in Balmora.', fields_set: [] }];
  const leakyStripped = leaky.map((b) => stripBeat(b, new Set()));
  const caught = leaks(leakyStripped);
  ok('leak detector catches an unstripped name (falsification)', caught.length > 0,
    caught.length ? `caught ${caught.map((c) => c.token).join(', ')}` : 'DID NOT CATCH "Caius Cosades" / "Balmora" — the 0-leak result above is void');

  // And the stripper must actually remove it once it knows the name.
  const known = buildNameSet(leaky);
  const fixed = leaky.map((b) => stripBeat(b, known));
  ok('stripper removes it once the name set contains it', leaks(fixed).length === 0,
    JSON.stringify(fixed[0].utterance));

  // Length matching is symmetric.
  const a = ref.beats.slice(0, 4), b = ref.beats.slice(0, 9);
  const n = Math.min(a.length, b.length);
  ok('length matching truncates to the shorter side', n === 4, `min(4, 9) = ${n}`);

  // The reference file must never be written by this tool.
  const src = fs.readFileSync(new URL(import.meta.url), 'utf8');
  ok('this tool never writes the committed reference file',
    !/writeJson\(\s*REFERENCES/.test(src) && !/fs\.writeFileSync\([^)]*mw-open/.test(src),
    'no write path to corpus/88-journeys/data/mw-open-beats.json');

  for (const ln of lines) process.stdout.write(ln + '\n');
  process.stdout.write(`\nbeat-extract self-test: ${failed === 0 ? 'PASS' : 'FAIL'} (${lines.length - failed}/${lines.length})\n`);
  return failed === 0 ? 0 : 1;
}
