// arrival.mjs — the S34(b) gate. REBUILT after CAPTURE-SERVICE-R1 beat the first version
// 28 times out of 30.
//
// ARBITRATION.md S34 splits captures on what the picture is evidence OF:
//
//   (a) evidence of APPEARANCE  — may be placed (teleported, posed, conditions set) and served
//       from a build-keyed cache. What a region looks like; whether two regions are
//       distinguishable; whether an impact frame reads; whether a menu is legible.
//   (b) evidence of ARRIVAL     — may NOT. Reachability, traversal, the crossing, whether a route
//       is walkable, what a player meets on the way, anything under RI-JRN* asserting a journey,
//       and anything timing something. There the walk IS the measurement.
//
// EVERY capture this service produces is placed: it teleports and it poses the camera. There is no
// mode in which it walks.
//
// =================================================================================================
// WHY THIS FILE WAS REWRITTEN, AND WHAT CHANGED IN KIND
// =================================================================================================
// The first version was a DENYLIST of exact words, word-boundary matched, read out of four field
// names, with `evidence_of` defaulting to "appearance" when absent. The CAPTURE-SERVICE-R1 critic
// put thirty laundering specs through it and twenty-eight were accepted:
//
//   * inflection walked past every stem — `traverse` past `travers`, `crossings` past `crossing`,
//     `routes` past `route`, `walking` past `walked`, `reaches` past `reach`;
//   * the words a reachability claim actually uses were never on the list at all — `passable`,
//     `accessible`, `you can get to`, `hike`, `trek`, `egress`, `navigate`, `takes 340 seconds`;
//   * `String(raw)` turned an object claim into `[object Object]`, which matches nothing;
//   * six fields a real report carries — `title`, `item`, `ri`, `caption`, `tags`, `description` —
//     were never read, so `item: 'RI-JRN04'`, the item S34 names explicitly, passed verbatim;
//   * omitting the declaration entirely defaulted to PERMITTED.
//
// A denylist of words cannot work, because the space of English ways to assert a journey is not
// enumerable and the gate loses to every one it did not think of. **So the gate is inverted.**
//
//   LAYER A — THE DECLARATION, AND IT IS THE GATE. `evidence_of` is REQUIRED, must be a string,
//             and must be an EXACT token of a CLOSED vocabulary (see PURPOSES). A token in the
//             appearance class is permitted; a token in the arrival class is refused with the S34(b)
//             explanation; ANYTHING ELSE — absent, empty, misspelt, invented, an object, an array —
//             is REFUSED. There is no default. The failure mode of an unrecognised input is
//             refusal, not acceptance: the gate FAILS CLOSED.
//
//   LAYER B — REFERENCE-ITEM CLASS, scanned RECURSIVELY over every string anywhere in the spec,
//             at any depth, in keys as well as values. An RI-JRN* (or RI-WLD03) reference makes the
//             capture arrival evidence by the nature of the item, whatever the declaration says.
//
//   LAYER C — CONTRADICTION. A declaration of `appearance` accompanied by prose that asserts a
//             journey is a caller contradicting itself, and the contradiction is refused. Matched
//             on STEMS (prefixes of a word, so inflections cannot escape) and PHRASES, over the
//             same recursive scan, on text with hyphens and underscores normalised to spaces so
//             `on-foot` and `on foot` are one thing.
//
// Layers B and C can only ever REFUSE. They cannot permit anything Layer A did not permit, so the
// gate's soundness does not rest on the completeness of a word list — that is the whole point of
// the inversion. They are there to catch the caller whose free text contradicts its own
// declaration, which is what laundering looks like.
//
// AND ACCEPTANCE IS NO LONGER SILENT. `classify()` returns an `audit` block — the declared purpose,
// its class, and every string the scan read — and the daemon writes it into the manifest. The R1
// critic's finding (f) was that a laundered capture left no trace of what it was requested for;
// now every capture records its declaration and its free text, so a later audit can find one.
//
// =================================================================================================
// WHAT THIS GATE DOES *NOT* CLAIM
// =================================================================================================
// It does not claim to recognise every English sentence that asserts a journey; nothing can. What
// it claims is narrower and checkable: no capture leaves this service without an explicit,
// recognised declaration of what it is evidence of, that declaration is recorded in the manifest
// beside the picture, and the admissibility statement names it. A verdict that cites a capture
// declared `region-appearance` for a reachability claim is VOID by inspection of the sidecar,
// which is S34's own final defence and does not depend on this file being clever.

/** The exit code / wire code a refusal carries. */
export const REFUSED_CODE = 'ARRIVAL_REFUSED';

/**
 * THE CLOSED VOCABULARY. A capture must declare its purpose as exactly one of these tokens.
 *
 * Appearance-class purposes are permitted (S34(a)). Arrival-class purposes are named here on
 * purpose rather than left out: a caller who honestly declares `reachability` deserves the refusal
 * that tells it which instrument to use instead, not a bare "unrecognised".
 */
export const PURPOSES = {
  // ---- APPEARANCE. Permitted: none of these becomes truer for having been walked to. ----
  'appearance': { class: 'appearance', means: 'what something looks like (the generic declaration)' },
  'region-appearance': { class: 'appearance', means: 'what a region looks like' },
  'region-distinctness': { class: 'appearance', means: 'whether two regions read as different places' },
  'landform': { class: 'appearance', means: 'the shape of the ground as drawn' },
  'material': { class: 'appearance', means: 'surface, texture, palette' },
  'lighting': { class: 'appearance', means: 'how a scene is lit' },
  'weather': { class: 'appearance', means: 'how weather reads in frame' },
  'silhouette': { class: 'appearance', means: 'readability of a shape against its background' },
  'composition': { class: 'appearance', means: 'framing and art direction' },
  'impact-frame': { class: 'appearance', means: 'whether a hit or an effect reads on the frame it lands' },
  'vfx': { class: 'appearance', means: 'a visual effect as drawn' },
  'character': { class: 'appearance', means: 'how a character or its gear looks' },
  'interior': { class: 'appearance', means: 'the look of an interior' },
  'menu': { class: 'appearance', means: 'menu legibility' },
  'ui': { class: 'appearance', means: 'HUD legibility' },
  'regression': { class: 'appearance', means: 'a before/after frame for a rendering change' },
  'fidelity': { class: 'appearance', means: 'render fidelity at a canonical viewpoint' },
  'art-direction': { class: 'appearance', means: 'art direction at a canonical viewpoint' },

  // ---- ARRIVAL. Refused: for these the walk IS the measurement (S34(b)). ----
  'arrival': { class: 'arrival', means: 'that the player got somewhere' },
  'walked': { class: 'arrival', means: 'that the player walked here' },
  'reachability': { class: 'arrival', means: 'whether somewhere can be reached' },
  'traversal': { class: 'arrival', means: 'whether ground can be crossed' },
  'crossing': { class: 'arrival', means: 'whether the crossing can be made' },
  'route': { class: 'arrival', means: 'whether a route works end to end' },
  'journey': { class: 'arrival', means: 'a journey and what is met on it' },
  'travel': { class: 'arrival', means: 'travelling from one place to another' },
  'encounter-on-the-way': { class: 'arrival', means: 'what a player meets while travelling' },
  'duration': { class: 'arrival', means: 'how long something takes' },
  'timing': { class: 'arrival', means: 'how long something takes' },
  'distance': { class: 'arrival', means: 'how far something is by travel' },
};

export const APPEARANCE_PURPOSES = Object.keys(PURPOSES).filter((k) => PURPOSES[k].class === 'appearance');
export const ARRIVAL_PURPOSES = Object.keys(PURPOSES).filter((k) => PURPOSES[k].class === 'arrival');

/** Reference-item prefixes whose captures are arrival evidence by the nature of the item. */
const ARRIVAL_ITEM_RE = [
  /\bRI[-_ ]?JRN\s*\d*/i,       // S34 names RI-JRN* explicitly
  /\bRI[-_ ]?WLD0?3\b/i,        // reachability / traversal
];

/**
 * Layer C, part 1: STEMS. Matched as a PREFIX of a word, so every inflection of the stem is caught
 * — which is the specific thing that beat the first version. `travers` catches `traverse`,
 * `traverses`, `traversing`, `traversal`, `traversable`.
 *
 * Chosen so that no ordinary word about APPEARANCE begins with one of them. Two deliberate
 * omissions, both measured against the project's real callers:
 *
 *   * bare `cross` / `crossing` is NOT here. `tools/harness/viewpoints-province.json` contains
 *     `VPP-vista-crossing` — a canonical viewpoint whose whole purpose is a picture of what the
 *     crossing LOOKS LIKE, which S34(a) permits — and `shoot.mjs` puts the viewpoint id into the
 *     claim text. Every one of the critic's specs that mentions a crossing also says `passable`,
 *     `walkable` or `RI-JRN04`, so nothing is lost by leaving it out and a legitimate viewpoint is
 *     not broken. A gate that refuses a legitimate capture is the same defect as one that refuses
 *     nothing.
 *   * bare `pass` is NOT here (it would catch `passage`, `passing light`); `passab` is.
 */
const STEMS = [
  'arriv',            // arrive arrives arrived arriving arrival arrivals
  'reach',            // reach reaches reached reachable reachability unreachable
  'travers',          // traverse traverses traversing traversal traversable
  'passab', 'impassab',
  'accessib', 'inaccessib',
  'navigab', 'navigat',
  'pathab',
  'walkab', 'walkpath', 'walkroute',
  'route',            // route routes
  'journey',          // journey journeys
  'pilgrimage',
  'hike', 'hiking',
  'trek',
  'egress', 'ingress',
  'wayfind',
  'footpath',
  'elapsed',
  'unaided',          // the word a "the player got here by itself" claim uses
];

/**
 * Layer C, part 2: WHOLE WORDS. Words whose stem is too common to prefix-match.
 * `walk` alone would catch `walkway`, which is a noun about how a place looks.
 */
const WORDS = [
  'walk', 'walks', 'walked', 'walking',
  'foot', 'afoot',
  'jog', 'jogs', 'jogged', 'jogging',
  'swim', 'swam', 'swum', 'swimming',
  'climbed',
];

/**
 * Layer C, part 3: PHRASES, matched as substrings of the normalised text. These are the SHAPES a
 * reachability or duration claim takes when it uses no single incriminating word.
 */
const PHRASES = [
  'on foot', 'by foot',
  'get to', 'gets to', 'got to', 'getting to', 'get there', 'got there', 'gets there',
  'how far', 'how long',
  'end to end',
  'travel time', 'time to', 'time from', 'wall clock',
  'from the dock', 'made it to',
  'can go before', 'how much of the way',
];

/** Layer C, part 4: a DURATION. "it takes 340 seconds from the dock" names no listed word. */
const DURATION_RE = /\b\d+(?:\.\d+)?\s*(?:sec|secs|second|seconds|min|mins|minute|minutes|hour|hours|frames?)\b/;

const STEM_RE = new RegExp('(?:^|[^a-z0-9])(' + STEMS.join('|') + ')[a-z]*', 'i');
const WORD_RE = new RegExp('(?:^|[^a-z0-9])(' + WORDS.join('|') + ')(?:[^a-z0-9]|$)', 'i');

export const ARRIVAL_REFUSAL =
  'S34(b): this service only produces PLACED captures (teleport + camera pose). A capture that is ' +
  'evidence of ARRIVAL — reachability, traversal, the crossing, whether a route is walkable, what a ' +
  'player meets on the way, anything under RI-JRN*, anything timing something — may not be placed, ' +
  'because there the walk IS the measurement. Use a walking instrument instead:\n' +
  '  node tools/world/reachability-walk.mjs      (reachability / traversal)\n' +
  '  __HARNESS.walkRoute() / walkPath()          (the crossing, on foot)\n' +
  'A verdict citing a placed capture for an arrival claim is VOID, not merely marked down.';

const vocabularyHelp = () =>
  'evidence_of must be exactly one of the declared purposes. Permitted (S34(a), appearance):\n  ' +
  APPEARANCE_PURPOSES.join(', ') + '\nRefused (S34(b), arrival — use a walking instrument):\n  ' +
  ARRIVAL_PURPOSES.join(', ') + '\nThere is no default: a capture that does not say what it is ' +
  'evidence of is refused, because S34 requires every capture to declare which half of the ruling ' +
  'it falls under and a gate that guesses is a gate that can be beaten by saying nothing.';

/** Whitespace/punctuation normalisation used by layer C only. Layer B reads the raw text. */
function normalise(s) {
  return String(s).toLowerCase().replace(/[\-_/\\.,;:()[\]{}"']+/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Every string anywhere in the spec: values at any depth, and keys too. Bounded so a hostile or
 * merely enormous spec cannot make the gate expensive.
 *
 * The R1 critic's field-shape attacks — `claim: {item:'RI-JRN04', ...}` and `claim:[{item:...}]` —
 * beat the first version because it did `String(raw)`, which is `"[object Object]"`. Walking the
 * structure is the fix, and it also removes the "fields the gate never reads" class of attack
 * entirely: there is no chosen list of field names any more.
 */
export function collectStrings(root, { maxNodes = 4000, maxDepth = 12 } = {}) {
  const out = [];
  let nodes = 0;
  let truncated = false;
  const seen = new Set();
  const walk = (v, path, depth) => {
    if (truncated) return;
    if (++nodes > maxNodes || depth > maxDepth) { truncated = true; return; }
    if (v === null || v === undefined) return;
    const t = typeof v;
    if (t === 'string') { out.push({ path, value: v }); return; }
    if (t === 'number' || t === 'boolean' || t === 'bigint') { out.push({ path, value: String(v) }); return; }
    if (t === 'function' || t === 'symbol') { out.push({ path, value: String(v) }); return; }
    if (t !== 'object') return;
    if (seen.has(v)) return;            // cycles
    seen.add(v);
    if (Array.isArray(v)) { v.forEach((e, i) => walk(e, `${path}[${i}]`, depth + 1)); return; }
    for (const k of Object.keys(v)) {
      out.push({ path: path ? `${path}.<key>` : '<key>', value: k });   // a key can carry a claim too
      walk(v[k], path ? `${path}.${k}` : k, depth + 1);
    }
  };
  walk(root, '', 0);
  return { strings: out, truncated };
}

/** Free-text fields that must be prose if present at all. R3: refuse a non-string, do not stringify. */
const PROSE_FIELDS = ['claim', 'for', 'purpose', 'note', 'title', 'caption', 'description', 'why', 'label'];

/**
 * Classify a capture request.
 *
 * @returns {{ok:true, evidence_of:string, purpose_class:'appearance', audit:object}
 *          |{ok:false, reason:string, code:string, matched:object, audit:object}}
 */
export function classify(spec) {
  const audit = {
    declared: null,
    declared_class: null,
    scanned_strings: 0,
    scan_truncated: false,
    free_text: [],
    layers_run: [],
  };

  // ---- LAYER A. The declaration. This is the gate, and it fails closed. -------------------------
  audit.layers_run.push('A-declaration');
  if (spec === null || typeof spec !== 'object' || Array.isArray(spec)) {
    return {
      ok: false, code: REFUSED_CODE, audit,
      matched: { field: 'spec', value: Object.prototype.toString.call(spec) },
      reason: 'a capture spec must be an object. ' + vocabularyHelp(),
    };
  }
  const rawDecl = spec.evidence_of;
  if (typeof rawDecl !== 'string' || rawDecl.trim() === '') {
    return {
      ok: false, code: REFUSED_CODE, audit,
      matched: { field: 'evidence_of', value: rawDecl === undefined ? '(absent)' : JSON.stringify(rawDecl) },
      reason: (rawDecl === undefined
        ? 'this capture does not declare what it is evidence of. '
        : `evidence_of must be a non-empty string (got ${JSON.stringify(rawDecl)}). `) + vocabularyHelp(),
    };
  }
  const declared = rawDecl.trim().toLowerCase();
  audit.declared = declared;
  const entry = PURPOSES[declared];
  if (!entry) {
    return {
      ok: false, code: REFUSED_CODE, audit,
      matched: { field: 'evidence_of', value: declared, rule: 'not in the closed vocabulary' },
      reason: `evidence_of ${JSON.stringify(declared)} is not a declared purpose. ` + vocabularyHelp(),
    };
  }
  audit.declared_class = entry.class;
  if (entry.class !== 'appearance') {
    return {
      ok: false, code: REFUSED_CODE, audit,
      matched: { field: 'evidence_of', value: declared, rule: `declared purpose is in the ARRIVAL class (${entry.means})` },
      reason: `evidence_of ${JSON.stringify(declared)} — ${entry.means} — is ARRIVAL evidence. ` + ARRIVAL_REFUSAL,
    };
  }

  // `arrival` is not a caller-supplied field: this service stamps it, because it knows.
  if (spec.arrival !== undefined && String(spec.arrival).toLowerCase() !== 'placed') {
    return {
      ok: false, code: REFUSED_CODE, audit,
      matched: { field: 'arrival', value: String(spec.arrival) },
      reason: 'arrival is not a caller-supplied field: this service stamps `arrival: "placed"` on ' +
        'everything it emits, because everything it emits is placed. ' + ARRIVAL_REFUSAL,
    };
  }

  // A prose field that is not prose is a laundering shape, not a typo: `claim: {item:'RI-JRN04'}`
  // used to stringify to "[object Object]" and match nothing.
  audit.layers_run.push('A-prose-shape');
  for (const f of PROSE_FIELDS) {
    const v = spec[f];
    if (v === undefined || v === null) continue;
    if (typeof v !== 'string') {
      return {
        ok: false, code: REFUSED_CODE, audit,
        matched: { field: f, value: Object.prototype.toString.call(v), rule: 'prose field is not a string' },
        reason: `${f} must be a plain string; got ${Object.prototype.toString.call(v)}. A structured ` +
          'value here cannot be read as a claim, and the first version of this gate stringified it to ' +
          '"[object Object]" and accepted it. Say what the picture is evidence of in words, and put ' +
          'the reference item in `item`.',
      };
    }
  }

  // ---- The recursive scan, shared by layers B and C. -------------------------------------------
  const { strings, truncated } = collectStrings(spec);
  audit.scanned_strings = strings.length;
  audit.scan_truncated = truncated;
  audit.free_text = strings
    .filter((s) => PROSE_FIELDS.some((f) => s.path === f) || s.path === 'item' || s.path === 'ri' || s.path.startsWith('tags'))
    .map((s) => ({ path: s.path, value: s.value }));
  if (truncated) {
    return {
      ok: false, code: REFUSED_CODE, audit,
      matched: { field: 'spec', rule: 'too large to scan exhaustively' },
      reason: 'this spec is too large or too deeply nested for the arrival gate to read all of it, ' +
        'and a gate that cannot read its input must not permit it. Flatten the spec.',
    };
  }

  // ---- LAYER B. Reference-item class, anywhere in the spec, at any depth. -----------------------
  audit.layers_run.push('B-reference-item');
  for (const { path, value } of strings) {
    for (const re of ARRIVAL_ITEM_RE) {
      const m = re.exec(value);
      if (m) {
        return {
          ok: false, code: REFUSED_CODE, audit,
          matched: { field: path || '(root)', value, item: m[0], rule: String(re) },
          reason: `${path || 'the spec'} = ${JSON.stringify(value)} names ${JSON.stringify(m[0].trim())}, ` +
            'an item whose captures are arrival evidence by the nature of the item, whatever ' +
            `evidence_of says. ` + ARRIVAL_REFUSAL,
        };
      }
    }
  }

  // ---- LAYER C. The declaration contradicted by the spec's own prose. ---------------------------
  audit.layers_run.push('C-contradiction');
  for (const { path, value } of strings) {
    const n = normalise(value);
    if (!n) continue;
    let hit = null;
    const sm = STEM_RE.exec(n);
    if (sm) hit = { rule: 'stem', word: sm[1], matched_text: sm[0].trim() };
    if (!hit) { const wm = WORD_RE.exec(n); if (wm) hit = { rule: 'word', word: wm[1], matched_text: wm[1] }; }
    if (!hit) { const p = PHRASES.find((ph) => n.includes(ph)); if (p) hit = { rule: 'phrase', word: p, matched_text: p }; }
    if (!hit) { const dm = DURATION_RE.exec(n); if (dm) hit = { rule: 'duration', word: dm[0], matched_text: dm[0] }; }
    if (hit) {
      return {
        ok: false, code: REFUSED_CODE, audit,
        matched: { field: path || '(root)', value, ...hit },
        reason: `${path || 'the spec'} = ${JSON.stringify(value)} contains ${JSON.stringify(hit.matched_text)}, ` +
          `which asserts a journey or a duration. That CONTRADICTS the declaration ` +
          `evidence_of=${JSON.stringify(declared)}: a picture cannot be evidence of appearance and ` +
          'evidence of arrival at the same time. ' + ARRIVAL_REFUSAL,
      };
    }
  }

  return { ok: true, evidence_of: declared, purpose_class: 'appearance', purpose_means: entry.means, audit };
}
