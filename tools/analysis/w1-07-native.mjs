#!/usr/bin/env node
/** Cheap W1-07 native-population and control census. No browser and no API-only credit. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { composeCharacter } from '../../game/src/character/sheet.js';
import { derivePools, applyBirthsignToPools } from '../../game/src/character/derive.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const rd = (p) => JSON.parse(fs.readFileSync(path.join(root, 'game/data', p), 'utf8'));
const data = {
  attributes: rd('progression/attributes.json'), skills: rd('progression/skills.json'),
  races: rd('progression/races.json'), reactions: rd('progression/race-reactions.json'),
  classes: rd('progression/classes.json'), birthsigns: rd('progression/birthsigns.json'),
};
const rows = [];
const check = (id, ok, measured, control = null, dependency = null) => rows.push({ id, state: ok ? 'GREEN' : 'RED', measured, control, dependency });

const races = data.races.races.map(x => x.id);
const families = data.classes.families;
const signs = data.birthsigns.signs;
const upClasses = [...new Set(data.reactions.upbringings.map(x => x.signature_class))];
const classFor = new Map(families.map(f => [f, data.classes.classes.find(c => c.family === f)]));
const upFor = new Map(upClasses.map(u => [u, data.reactions.upbringings.find(x => x.signature_class === u)]));

const signatures = new Map();
for (const race of races) for (const family of families) for (const sign of signs) for (const up of upClasses) {
  const ch = composeCharacter(data, { race, classId: classFor.get(family).id, birthsign: sign.id, upbringing: upFor.get(up).id });
  signatures.set(ch.signature.key, ch);
}
check('CHR01-signature-population', signatures.size === 540, `${signatures.size}/540`, 'delete one sign: population becomes 480');
check('CHR01-signature-invariants', [...signatures.values()].every(c => c.invariants.attribute_total_ok && c.invariants.skills_above_baseline_ok), `${[...signatures.values()].filter(c => c.invariants.attribute_total_ok && c.invariants.skills_above_baseline_ok).length}/540`, 'set one race delta +1: attribute invariant goes red');

const familyCounts = Object.fromEntries(['given', 'withheld', 'turned'].map(f => [f, signs.filter(s => s.family === f).length]));
check('CHR03-roster-families', signs.length === 9 && Object.values(familyCounts).every(n => n === 3), `${signs.length} signs; ${JSON.stringify(familyCounts)}`, 'delete one sign: roster and 540 population go red');
const drawbacks = signs.filter(s => s.drawback?.kind !== 'none');
check('CHR03-drawback-population', drawbacks.filter(s => s.drawback.kind === 'mechanical').length === 3 && drawbacks.filter(s => s.drawback.kind === 'conditional').length === 3, `mechanical=${drawbacks.filter(s => s.drawback.kind === 'mechanical').length}, conditional=${drawbacks.filter(s => s.drawback.kind === 'conditional').length}`, 'neutralise any drawback.kind: count goes red');

const base = derivePools({ vigour: 10, endurance: 10, willpower: 10, strength: 10 });
const composed = signs.map(sign => {
  const ch = composeCharacter(data, { race: races[0], classId: data.classes.classes[0].id, birthsign: sign.id, upbringing: data.reactions.upbringings[0].id });
  return { sign: sign.id, pools: applyBirthsignToPools(base, ch) };
});
const source = fs.readFileSync(path.join(root, 'game/src/engine.js'), 'utf8') + fs.readFileSync(path.join(root, 'game/src/sim/magic/system.js'), 'utf8');
const consumers = {
  flask_charges: '_birthsignBaseEstus', travel_fare: 'travel_fare_multiplier', merchant_disposition: 'birthsign_disposition_delta',
  focus_max_multiplier: 'focusMax = pools.focus_max', spell_absorption: 'spellAbsorption = pools.spell_absorption',
  hearth_focus_restore: 'focusRestoresAtHearth = pools.focus_restores_at_hearth',
};
for (const [model, token] of Object.entries(consumers)) check(`CONSUMPTION-${model}`, source.includes(token), source.includes(token) ? `live consumer: ${token}` : 'no live consumer', `delete consumer token: row goes red`);

const twoDrink = data.birthsigns.signs.find(s => s.id === 'kaal-kaal');
const dry = data.birthsigns.signs.find(s => s.id === 'nu-ixtu');
const ch2 = composeCharacter(data, { race: races[0], classId: data.classes.classes[0].id, birthsign: twoDrink.id, birthsignSecond: dry.id, upbringing: data.reactions.upbringings[0].id });
const p2 = applyBirthsignToPools(base, ch2);
check('CHR03-kaal-kaal-all-eight', signs.filter(s => s.id !== 'kaal-kaal').every(second => {
  const ch = composeCharacter(data, { race: races[0], classId: data.classes.classes[0].id, birthsign: 'kaal-kaal', birthsignSecond: second.id, upbringing: data.reactions.upbringings[0].id });
  return ch.powers.at(-1).scale === 0.5 && ch.drawbacks.every(d => d.scale === 1);
}), '8/8 second-sign compositions: power=0.5, drawback=1.0', 'halve drawback scale: row goes red');
check('CHR03-kaal-kaal-dry-well', p2.focus_max === Math.round(base.focus_max * 1.3) && !p2.focus_restores_at_hearth, `focus ${base.focus_max}->${p2.focus_max}; hearth restore=${p2.focus_restores_at_hearth}`, 'neutralise Dry Well drawback: restore becomes true');

// These are deliberately fail-closed: the required sibling walks/fresh judge are not replaced
// by this census.
rows.push({ id: 'CHR01-end-to-end-viability', state: 'RED', measured: 'tool named by satisfied plan is absent', dependency: 'RI-MTH06 / tools/quests/viability-walk.mjs full signature walk' });
rows.push({ id: 'CHR01-blind-ordinary-play-20', state: 'NOT_RUN', measured: 'builder prepared no self-judged blind result', dependency: 'fresh independent judge' });
rows.push({ id: 'CHR03-decidability-walk', state: 'RED', measured: 'no current walk covers every sign x six families', dependency: 'quest viability + W1-16 progression + W1-09 combat' });

const commit = process.env.W1_COMMIT || 'WORKTREE';
const out = { schema: 'elder-souls/w1-07-native@1', commit, generated_at: new Date().toISOString(), summary: Object.fromEntries(['GREEN','RED','NOT_RUN'].map(s => [s, rows.filter(r => r.state === s).length])), rows };
const dir = path.join(root, 'reports/w1-07-r4'); fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(path.join(dir, 'native-census.json'), JSON.stringify(out, null, 2) + '\n');
for (const r of rows) console.log(`${r.state.padEnd(7)} ${r.id}: ${r.measured}`);
console.log(JSON.stringify(out.summary));
process.exitCode = rows.some(r => r.state === 'RED' && !r.dependency) ? 1 : 0;
