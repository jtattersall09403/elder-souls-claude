// The character sheet: how a race, a class and a birthsign compose into ten attributes and
// nineteen skills, and how that reduces to one of the 540 signatures.
//
// Owner: W1-07. Binding sources:
//   RI-CHR01 §2  attribute_at_creation(a) = 10 + raceDelta + classDelta, total ALWAYS 112
//   RI-CHR01 §2  skill_at_creation(s)     = max(5, raceSkill, classSkill), 5..10 raised
//   RI-CHR01 §5  signature = (race, class_family, birthsign_family, upbringing_class) = 540
//   RI-CHR02 §1  race deltas sum to +12 — the ONLY source of net gain
//   RI-CHR01 §4  class deltas sum to 0   — class only redistributes
//
// Every function here is pure and total: same inputs, same outputs, no clock, no RNG. That
// is deliberate — the audit tool in tools/analysis/creation-audit.mjs imports this exact
// module rather than reimplementing the arithmetic, so a critic is measuring the shipped
// composition and not a second copy of it that happens to agree.
'use strict';

export const BASE_ATTRIBUTE = 10;
export const BASE_SKILL = 5;
export const ATTRIBUTE_TOTAL_INVARIANT = 112;

/** Ten attribute ids in RI-PRG02 §1 order. Tie-breaks everywhere use this order. */
export function attributeIds(data) { return data.attributes.attributes.map((a) => a.id); }
/** Nineteen skill ids in RI-PRG03 §1 order. */
export function skillIds(data) { return data.skills.skills.map((s) => s.id); }

export function raceById(data, id) {
  const r = data.races.races.find((x) => x.id === id);
  if (!r) throw new Error(`unknown race: ${JSON.stringify(id)}`);
  return r;
}
export function classById(data, id) {
  const c = data.classes.classes.find((x) => x.id === id);
  if (!c) throw new Error(`unknown class: ${JSON.stringify(id)}`);
  return c;
}
export function birthsignById(data, id) {
  const b = data.birthsigns.signs.find((x) => x.id === id);
  if (!b) throw new Error(`unknown birthsign: ${JSON.stringify(id)}`);
  return b;
}
export function upbringingById(data, id) {
  const u = data.reactions.upbringings.find((x) => x.id === id);
  if (!u) throw new Error(`unknown upbringing: ${JSON.stringify(id)}`);
  return u;
}

/**
 * A class-shaped object from the custom route, so composeAttributes/composeSkills never has
 * to know which route produced it. `attribute_deltas` here is built from the two favoured and
 * two neglected picks and is sum-zero by construction.
 */
export function customClass({ name, favoured, neglected, primary, secondary }) {
  if (favoured.length !== 2) throw new Error('custom class: exactly two favoured attributes');
  if (neglected.length !== 2) throw new Error('custom class: exactly two neglected attributes');
  if (primary.length !== 3) throw new Error('custom class: exactly three primary skills');
  if (secondary.length !== 2) throw new Error('custom class: exactly two secondary skills');
  const all = [...favoured, ...neglected];
  if (new Set(all).size !== 4) throw new Error('custom class: the four attributes must be distinct');
  const sk = [...primary, ...secondary];
  if (new Set(sk).size !== 5) throw new Error('custom class: the five skills must be distinct');
  const attribute_deltas = {};
  for (const a of favoured) attribute_deltas[a] = 4;
  for (const a of neglected) attribute_deltas[a] = -4;
  const skills = {};
  for (const s of primary) skills[s] = 25;
  for (const s of secondary) skills[s] = 15;
  return { id: 'custom', name: name || 'Custom', family: 'custom', custom: true, attribute_deltas, skills };
}

/** attribute_at_creation(a) = 10 + raceDelta[a] + classDelta[a]. Always sums to 112. */
export function composeAttributes(data, raceId, classDef) {
  const race = raceById(data, raceId);
  const out = {};
  for (const id of attributeIds(data)) {
    out[id] = BASE_ATTRIBUTE + (race.attribute_deltas[id] || 0) + ((classDef && classDef.attribute_deltas[id]) || 0);
  }
  return out;
}

/** skill_at_creation(s) = max(5, raceSkill, classSkill). */
export function composeSkills(data, raceId, classDef) {
  const race = raceById(data, raceId);
  const out = {};
  for (const id of skillIds(data)) {
    const r = race.skills[id] || 0;
    const c = (classDef && classDef.skills[id]) || 0;
    out[id] = Math.max(BASE_SKILL, r, c);
  }
  return out;
}

export function sumValues(map) {
  let t = 0;
  for (const k of Object.keys(map)) t += map[k];
  return t;
}

export function skillsAboveBaseline(skills) {
  return Object.keys(skills).filter((k) => skills[k] > BASE_SKILL).sort();
}

/** RI-CHR01 §5: the four-part signature, and its 540-cell index. */
export function signatureOf(data, { race, classId, classFamily, birthsign, upbringing }) {
  const fam = classFamily || (classId ? classById(data, classId).family : null);
  const sign = birthsignById(data, birthsign);
  const up = upbringingById(data, upbringing);
  return {
    race,
    class_family: fam,
    birthsign_family: sign.family,
    upbringing_class: up.signature_class,
    key: `${race}|${fam}|${sign.family}|${up.signature_class}`,
  };
}

export function classFamilies(data) {
  const seen = [];
  for (const c of data.classes.classes) if (seen.indexOf(c.family) < 0) seen.push(c.family);
  return seen;
}

/**
 * The full creation composition, in one object. This is what the census hands to the sim and
 * what getCharacter() returns. `invariants` is computed here rather than asserted elsewhere so
 * that a broken table surfaces at creation time and not in a critic's spreadsheet.
 */
export function composeCharacter(data, spec) {
  const classDef = spec.custom ? customClass(spec.custom) : classById(data, spec.classId);
  const attributes = composeAttributes(data, spec.race, classDef);
  const skills = composeSkills(data, spec.race, classDef);
  const sign = birthsignById(data, spec.birthsign);
  const second = spec.birthsignSecond ? birthsignById(data, spec.birthsignSecond) : null;
  const up = upbringingById(data, spec.upbringing);
  const raised = skillsAboveBaseline(skills);
  const sig = signatureOf(data, {
    race: spec.race, classId: classDef.custom ? null : classDef.id, classFamily: classDef.family,
    birthsign: spec.birthsign, upbringing: spec.upbringing,
  });
  return {
    given_name: spec.givenName || '',
    hatch_name: spec.hatchName || '',
    hatch_name_refused: !!spec.hatchNameRefused,
    sex: spec.sex || 'unrecorded',
    race: spec.race,
    upbringing: spec.upbringing,
    upbringing_given_as: up.given_as,
    class_id: classDef.id,
    class_name: classDef.custom ? (spec.custom.name || 'Custom') : classDef.name,
    class_family: classDef.family,
    class_route: spec.route || (classDef.custom ? 'custom' : 'named'),
    birthsign: spec.birthsign,
    birthsign_second: spec.birthsignSecond || null,
    attributes,
    skills,
    signature: sig,
    powers: birthsignPowers(sign, second),
    drawbacks: birthsignDrawbacks(sign, second),
    invariants: {
      attribute_total: sumValues(attributes),
      attribute_total_ok: sumValues(attributes) === ATTRIBUTE_TOTAL_INVARIANT,
      race_delta_sum: sumValues(raceById(data, spec.race).attribute_deltas),
      class_delta_sum: sumValues(classDef.attribute_deltas),
      skills_above_baseline: raised.length,
      skills_above_baseline_ok: raised.length >= 5 && raised.length <= 10,
      max_skill: Math.max(...Object.values(skills)),
      max_skill_ok: Math.max(...Object.values(skills)) <= 25,
    },
  };
}

/**
 * Kaal-Kaal composition, and the single line this whole sign lives or dies on.
 * RI-CHR03 method 9: the POWER is halved, the DRAWBACK is not.
 */
export function birthsignPowers(sign, second) {
  const out = [{ sign: sign.id, scale: 1.0, power: sign.power }];
  if (second) out.push({ sign: second.id, scale: 0.5, power: second.power, via: 'kaal-kaal' });
  return out;
}
export function birthsignDrawbacks(sign, second) {
  const out = [];
  if (sign.drawback && sign.drawback.kind !== 'none') out.push({ sign: sign.id, scale: 1.0, drawback: sign.drawback });
  if (second && second.drawback && second.drawback.kind !== 'none') {
    out.push({ sign: second.id, scale: 1.0, drawback: second.drawback, via: 'kaal-kaal', note: 'FULL magnitude. RI-CHR03 method 9.' });
  }
  return out;
}

/** Does this character have Focus regeneration at all? The Dry Well answer is no, forever. */
export function focusRegenAllowed(character) {
  for (const d of character.drawbacks) if (d.drawback.removes_system === 'focus_regeneration') return false;
  return true;
}
