// arrival.mjs — the S34(b) gate.
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
// mode in which it walks. So the gate is not "decide how to capture" — it is "refuse to be the
// instrument for an arrival claim at all", and stamp `arrival: "placed"` on everything it does
// emit so that a verdict citing one for an arrival claim is visibly VOID (S34).
//
// The gate is deliberately hard to launder. A caller cannot get an arrival capture by
// mislabelling it `appearance`, because the *claim id* is checked independently of the label.

/** Reference-item prefixes whose captures are arrival evidence by their nature. */
const ARRIVAL_ITEM_RE = [
  /^RI-JRN/i,            // S34 names RI-JRN* explicitly
  /^RI-WLD0?3\b/i,       // reachability / traversal
];

/**
 * Claim keywords that mean "this picture asserts a journey or a duration".
 * Matched against `claim`, `for`, `purpose` and `note` — i.e. whatever the caller says the
 * picture is for. Word-boundary matched so "clearing" does not trip "clear".
 */
const ARRIVAL_WORDS = [
  'arrival', 'arrive', 'arrives', 'arrived', 'arriving',
  'reach', 'reached', 'reachable', 'reachability', 'unreachable',
  'travers', 'traversal', 'traversable',
  'walkable', 'walked', 'walk-to', 'walkto', 'on-foot', 'onfoot',
  'route', 'crossing', 'journey', 'pilgrimage', 'pathable', 'navigable',
  'how-long', 'duration', 'elapsed', 'timing', 'timed', 'wall-clock', 'minutes-to', 'time-to',
  'got-there', 'gets-there', 'en-route', 'enroute', 'on-the-way',
];

const WORD_RE = new RegExp('(^|[^a-z0-9])(' + ARRIVAL_WORDS.map((w) => w.replace(/[-]/g, '[- _]?')).join('|') + ')([^a-z0-9]|$)', 'i');

export const ARRIVAL_REFUSAL =
  'S34(b): this service only produces PLACED captures (teleport + camera pose). A capture that is ' +
  'evidence of ARRIVAL — reachability, traversal, the crossing, whether a route is walkable, what a ' +
  'player meets on the way, anything under RI-JRN*, anything timing something — may not be placed, ' +
  'because there the walk IS the measurement. Use a walking instrument instead:\n' +
  '  node tools/world/reachability-walk.mjs      (reachability / traversal)\n' +
  '  __HARNESS.walkRoute() / walkPath()          (the crossing, on foot)\n' +
  'A verdict citing a placed capture for an arrival claim is VOID, not merely marked down.';

/**
 * Classify a capture request.
 * @returns {{ok:true, evidence_of:'appearance'}|{ok:false, reason:string, matched:object}}
 */
export function classify(spec = {}) {
  const declared = String(spec.evidence_of || spec.evidence || 'appearance').toLowerCase();

  // 1. The honest caller who says what it is.
  if (declared === 'arrival' || declared === 'walked') {
    return { ok: false, reason: ARRIVAL_REFUSAL, matched: { field: 'evidence_of', value: declared } };
  }
  if (declared !== 'appearance') {
    return {
      ok: false,
      matched: { field: 'evidence_of', value: declared },
      reason: `evidence_of must be "appearance" or "arrival" (got ${JSON.stringify(declared)}). ` +
        'S34 requires every capture to declare which half of the ruling it falls under; there is ' +
        'no default that guesses for you.',
    };
  }

  // 2. `arrival: "walked"` cannot be requested from a service that never walks. Refuse loudly
  //    rather than quietly stamping "placed" over the caller's intent.
  if (spec.arrival !== undefined && String(spec.arrival).toLowerCase() !== 'placed') {
    return {
      ok: false,
      matched: { field: 'arrival', value: spec.arrival },
      reason: 'arrival is not a caller-supplied field: this service stamps `arrival: "placed"` on ' +
        'everything it emits, because everything it emits is placed. ' + ARRIVAL_REFUSAL,
    };
  }

  // 3. The laundering case: labelled `appearance`, but the claim it is filed under is an
  //    arrival claim. The label does not get to overrule the claim.
  const fields = [['claim', spec.claim], ['for', spec.for], ['purpose', spec.purpose], ['note', spec.note]];
  for (const [name, raw] of fields) {
    if (raw === undefined || raw === null) continue;
    const v = String(raw);
    for (const re of ARRIVAL_ITEM_RE) {
      if (re.test(v.trim())) {
        return {
          ok: false,
          matched: { field: name, value: v, rule: String(re) },
          reason: `${name}=${JSON.stringify(v)} names an item whose captures are arrival evidence. ` + ARRIVAL_REFUSAL,
        };
      }
    }
    const m = WORD_RE.exec(v);
    if (m) {
      return {
        ok: false,
        matched: { field: name, value: v, word: m[2] },
        reason: `${name}=${JSON.stringify(v)} contains ${JSON.stringify(m[2])}, which makes this ` +
          'a claim about a journey rather than about appearance. ' + ARRIVAL_REFUSAL,
      };
    }
  }

  return { ok: true, evidence_of: 'appearance' };
}
