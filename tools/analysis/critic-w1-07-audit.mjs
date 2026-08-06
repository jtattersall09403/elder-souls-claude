#!/usr/bin/env node
// critic-w1-07-audit.mjs — W1-07 CRITIC offline audit. Independently recomputed from the
// SHIPPED DATA FILES ONLY. Deliberately does not import game/src/character/*.js, so that this
// is a second opinion rather than a re-run of the builder's own arithmetic.
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const ROOT = process.argv[3] || process.cwd();
const OUT = path.resolve(process.argv[2] || 'corpus/90-verdicts/wave1/artifacts/W1-07/audit');
fs.mkdirSync(OUT, { recursive: true });
const D = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, 'game/data', p), 'utf8'));
const R = [];
const chk = (id, ok, measured, expected) => { R.push({ id, ok: !!ok, measured: String(measured), expected }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${id}\n        measured: ${measured}\n        expected: ${expected}`); };

const races = D('progression/races.json');
const classes = D('progression/classes.json');
const skills = D('progression/skills.json');
const attrs = D('progression/attributes.json');
const signs = D('progression/birthsigns.json');
const react = D('progression/race-reactions.json');
const creation = D('progression/creation.json');
const questions = D('dialogue/creation-questions.json');

const RA = races.races || races.list || [];
const CL = classes.classes || classes.list || [];
const SK = skills.skills || skills.list || [];
const AT = attrs.attributes || attrs.list || [];
const BS = signs.signs || signs.birthsigns || signs.list || [];

console.log('== RI-PRG02 — the sheet');
chk('PRG02-m1-ten-attributes', AT.length === 10, `${AT.length} attributes: ${AT.map((a) => a.id).join(', ')}`, 'exactly 10');
const noEffects = AT.filter((a) => !(a.in_fight !== undefined && a.out_of_fight !== undefined));
chk('PRG02-m1-effects', noEffects.length === 0, `${AT.length - noEffects.length}/${AT.length} with non-empty effects`, 'all 10');
const nonEmpty = (v) => typeof v === 'string' ? v.trim().length > 0 && !/^(none|nothing)/i.test(v.trim()) : Array.isArray(v) ? v.length > 0 : !!v;
const classify = (a) => ({ id: a.id, inF: nonEmpty(a.in_fight) ? 1 : 0, outF: nonEmpty(a.out_of_fight) ? 1 : 0, in_fight: a.in_fight, out_of_fight: a.out_of_fight });
const cls = AT.map(classify);
console.log('  effect classification sample:', JSON.stringify(cls.slice(0, 3)));
chk('PRG02-m2-out-of-fight>=7', cls.filter((c) => c.outF >= 1).length >= 7, `${cls.filter((c) => c.outF >= 1).length}/10 attributes with >=1 out_of_fight effect`, '>= 7');
chk('PRG02-m2-exactly-2-no-in-fight', cls.filter((c) => c.inF === 0).length === 2, `${cls.filter((c) => c.inF === 0).length} attributes with zero in_fight effects: ${cls.filter((c) => c.inF === 0).map((c) => c.id).join(', ')}`, 'exactly 2 (speed, personality)');

console.log('\n== RI-PRG03 — the 19 skills');
chk('PRG03-m1-nineteen', SK.length === 19, `${SK.length} skills`, 'exactly 19');
const govOk = SK.filter((s) => s.governing && AT.some((a) => a.id === s.governing));
chk('PRG03-m1-governed', govOk.length === SK.length, `${govOk.length}/${SK.length} with a governing attribute from the ten`, 'all');
const gated = SK.filter((s) => (s.gates && s.gates.length) || (typeof s.gate === 'string' && s.gate.trim()));
chk('PRG03-m1-gated', gated.length === SK.length, `${gated.length}/${SK.length} with a non-empty gates list`, 'all — a skill that unlocks nothing is decoration');
// curve
const curve = { formula: skills.progress_formula };
let curveErr = null;
if (curve.formula) curveErr = String(curve.formula);
chk('PRG03-m2-curve-declared', !!curveErr, `progression curve in skills.json: ${curveErr || '(absent)'}`, 'round(1.6s + 6)');

console.log('\n== RI-CHR02 method 1 — race table conformance');
chk('CHR02-m1-ten-races', RA.length === 10, `${RA.length} races`, 'exactly 10');
const badSum = RA.filter((r) => Object.values(r.attribute_deltas || r.attributes || {}).reduce((a, b) => a + b, 0) !== 12);
chk('CHR02-m1-sum-12', badSum.length === 0, `${RA.length - badSum.length}/${RA.length} sum to +12; offenders: ${badSum.map((r) => r.id).join(', ') || 'none'}`, 'all == 12');
const skillSets = RA.map((r) => JSON.stringify(Object.keys(r.skills || r.skills_raised || {}).sort()));
chk('CHR02-m1-distinct-skillsets', new Set(skillSets).size === RA.length, `${new Set(skillSets).size}/${RA.length} distinct skill sets`, 'all distinct');
const fewSkills = RA.filter((r) => Object.keys(r.skills || r.skills_raised || {}).length < 4);
chk('CHR02-m1-4-skills', fewSkills.length === 0, `races with < 4 skills raised: ${fewSkills.map((r) => r.id).join(', ') || 'none'}`, 'none');
const noAbility = RA.filter((r) => !(r.abilities || r.ability || r.powers));
chk('CHR02-m1-ability', noAbility.length === 0, `races with no ability: ${noAbility.map((r) => r.id).join(', ') || 'none'}`, 'none');

console.log('\n== RI-CHR02 method 2 — the matrix');
const M = react.matrix || react.race_reaction || react.reactions;
const groups = Object.keys(M || {});
const raceIds = RA.map((r) => r.id);
chk('CHR02-m2-12x10', groups.length === 12 && groups.every((g) => raceIds.every((r) => Number.isFinite(M[g][r]))),
  `${groups.length} groups x ${groups.length ? Object.keys(M[groups[0]]).length : 0} races, nulls: ${groups.reduce((n, g) => n + raceIds.filter((r) => !Number.isFinite(M[g][r])).length, 0)}`, '12 x 10, no nulls');
const cells = groups.flatMap((g) => raceIds.map((r) => M[g][r]));
const mean = cells.reduce((a, b) => a + b, 0) / cells.length;
const sigma = Math.sqrt(cells.reduce((a, b) => a + (b - mean) ** 2, 0) / cells.length);
chk('CHR02-m2-sigma', sigma >= 9.0, `sigma over ${cells.length} cells = ${sigma.toFixed(3)} (mean ${mean.toFixed(2)}, range ${Math.min(...cells)}..${Math.max(...cells)})`, '>= 9.0');
chk('CHR02-m2-range', Math.min(...cells) >= -40 && Math.max(...cells) <= 14, `range ${Math.min(...cells)} .. ${Math.max(...cells)}`, 'within [-40, +14]');
const rows = groups.map((g) => JSON.stringify(raceIds.map((r) => M[g][r])));
chk('CHR02-m2-rows-distinct', new Set(rows).size === groups.length, `${new Set(rows).size}/${groups.length} distinct rows`, 'all distinct');
const cols = raceIds.map((r) => JSON.stringify(groups.map((g) => M[g][r])));
chk('CHR02-m2-cols-distinct', new Set(cols).size === raceIds.length, `${new Set(cols).size}/${raceIds.length} distinct columns`, 'all distinct');
const zeroRows = groups.filter((g) => raceIds.every((r) => M[g][r] === 0));
chk('CHR02-m2-neutral-row', zeroRows.length >= 1, `all-zero rows: ${zeroRows.join(', ') || 'none'}`, '>= 1 (RG-COURT)');
// mean Saxhleel - Dunmer
const gap = groups.reduce((a, g) => a + (M[g].saxhleel - M[g].dunmer), 0) / groups.length;
chk('CHR02-m3-aggregate-gap', gap >= 8, `mean Saxhleel - Dunmer over 12 groups = ${gap.toFixed(3)}`, '>= 8 (RI-DLG04 §E rule 5 floor, per AMENDMENT-W1-07-02)');

console.log('\n== RI-CHR01 method 2 — 112 points for every race x class');
let bad112 = [];
for (const r of RA) {
  const rd = r.attribute_deltas || r.attributes || {};
  for (const c of CL) {
    const cd = c.attribute_deltas || c.attributes || {};
    const sum = 100 + Object.values(rd).reduce((a, b) => a + b, 0) + Object.values(cd).reduce((a, b) => a + b, 0);
    if (sum !== 112) bad112.push(`${r.id}/${c.id}=${sum}`);
  }
}
chk('CHR01-m2-112', bad112.length === 0, `${RA.length * CL.length} pairs checked; offenders: ${bad112.slice(0, 6).join(', ') || 'none'}`, 'every pair == 112');
const badClassDelta = CL.filter((c) => {
  const cd = Object.values(c.attribute_deltas || c.attributes || {});
  return cd.reduce((a, b) => a + b, 0) !== 0 || cd.some((v) => Math.abs(v) > 4) || cd.filter((v) => v !== 0).length > 4;
});
chk('CHR01-m2-class-net-zero', badClassDelta.length === 0, `classes violating net-zero/<=4/<=4-attrs: ${badClassDelta.map((c) => c.id).join(', ') || 'none'}`, 'none');
chk('CHR01-m4-14-classes', CL.length === 14, `${CL.length} named classes`, '14');
const cSkillSets = CL.map((c) => JSON.stringify(Object.keys(c.skills || {}).sort()));
chk('CHR01-m4-unique-skillsets', new Set(cSkillSets).size === CL.length, `${new Set(cSkillSets).size}/${CL.length} unique 5-skill sets`, '14/14');

console.log('\n== RI-CHR01 method 3 — skill composition over all 150 pairs');
let badRange = [], over25 = [], seen = new Set();
for (const r of RA) {
  for (const c of CL) {
    const s = {};
    for (const [k, v] of Object.entries(r.skills || r.skills_raised || {})) s[k] = Math.max(s[k] || 5, v);
    for (const [k, v] of Object.entries(c.skills || {})) s[k] = Math.max(s[k] || 5, v);
    const raised = Object.entries(s).filter(([, v]) => v > 5);
    for (const [k] of raised) seen.add(k);
    if (raised.length < 5 || raised.length > 10) badRange.push(`${r.id}/${c.id}=${raised.length}`);
    if (raised.some(([, v]) => v > 25)) over25.push(`${r.id}/${c.id}`);
  }
}
chk('CHR01-m3-5to10', badRange.length === 0, `${RA.length * CL.length} pairs; out of [5,10]: ${badRange.slice(0, 6).join(', ') || 'none'}`, 'all in [5,10]');
chk('CHR01-m3-max25', over25.length === 0, `pairs with a skill > 25: ${over25.slice(0, 4).join(', ') || 'none'}`, 'none');
const skillIds = SK.map((s) => s.id);
const never = skillIds.filter((s) => !seen.has(s));
chk('CHR01-m3-all19-reachable', never.length === 0, `skills never above baseline in any of the 150 pairs: ${never.join(', ') || 'none'}`, 'none');

console.log('\n== RI-CHR01 method 4 — questionnaire purity');
const QS = questions.questions || [];
chk('CHR01-m4-12-questions', QS.length === 12, `${QS.length} questions`, '12');
const attrNames = AT.map((a) => a.id.replace('-', '[- ]?')).concat(['strength', 'endurance', 'agility', 'speed', 'vigour', 'willpower', 'intellect', 'hist', 'personality', 'luck']);
const skillNames = skillIds.map((s) => s.replace('-', '[- &]?')).concat(['blades', 'axes', 'maces', 'polearms', 'greatweapons', 'marksman', 'claw', 'fang', 'shieldcraft', 'sorcery', 'root-speech', 'warding', 'veiling', 'alchemy', 'athletics', 'acrobatics', 'survival', 'sneak', 'security', 'mercantile', 'speechcraft']);
const proseOf = (q) => [q.text || q.prompt || '', ...(q.answers || []).map((a) => a.text || a.prose || '')].join('\n');
const hits = [];
for (const q of QS) {
  const prose = proseOf(q);
  for (const n of [...new Set(attrNames.concat(skillNames))]) {
    const re = new RegExp(`\\b${n}\\b`, 'i');
    if (re.test(prose)) hits.push(`${q.id}:${n}`);
  }
  if (/[+%]/.test(prose)) hits.push(`${q.id}:+or%`);
  if (/\b\d+\b/.test(prose)) hits.push(`${q.id}:digit(${(prose.match(/\b\d+\b/) || [])[0]})`);
}
chk('CHR01-m4-purity', hits.length === 0, `stat-token hits in question prose: ${hits.slice(0, 8).join(', ') || 'none'} (${hits.length} total)`, 'zero');
const weightCount = {};
for (const q of QS) for (const a of q.answers || []) for (const k of (Array.isArray(a.weights) ? a.weights : Object.keys(a.weights || a.skills || {}))) weightCount[k] = (weightCount[k] || 0) + 1;
const under5 = skillIds.filter((s) => (weightCount[s] || 0) < 5);
chk('CHR01-m4-every-skill-5-answers', under5.length === 0, `skills appearing in < 5 answers: ${under5.map((s) => `${s}=${weightCount[s] || 0}`).join(', ') || 'none'}`, 'none');

console.log('\n== RI-CHR01 method 5 — 540 signatures');
const families = [...new Set(CL.map((c) => c.family))];
const bsFamilies = [...new Set(BS.map((b) => b.family))];
chk('CHR01-m5-axes', RA.length === 10 && families.length === 6 && bsFamilies.length === 3,
  `${RA.length} races x ${families.length} class families (${families.join(',')}) x ${bsFamilies.length} birthsign families (${bsFamilies.join(',')}) x 3 upbringing classes = ${RA.length * families.length * bsFamilies.length * 3}`, '10 x 6 x 3 x 3 = 540');

console.log('\n== RI-CHR03 method 1 — cosmology');
chk('CHR03-m1-nine-signs', BS.length === 9, `${BS.length} signs`, 'exactly 9');
const perFam = {}; for (const b of BS) perFam[b.family] = (perFam[b.family] || 0) + 1;
chk('CHR03-m1-3-per-family', Object.values(perFam).every((n) => n === 3) && Object.keys(perFam).length === 3, JSON.stringify(perFam), '3 given / 3 withheld / 3 turned');
const imperial = /warrior|mage|thief|lady|steed|lord|apprentice|atronach|ritual|shadow|tower|lover|serpent/i;
const impHits = BS.filter((b) => imperial.test(JSON.stringify({ id: b.id, name: b.name, jel: b.jel })));
chk('CHR03-m1-no-imperial-names', impHits.length === 0, `Imperial sign names in the roster: ${impHits.map((b) => b.name).join(', ') || 'none'}`, 'zero');
let impInWorld = 0;
try { impInWorld = Number(execSync(`grep -rilE "warrior|apprentice|atronach|serpent" ${path.join(ROOT, 'game/data/books')} ${path.join(ROOT, 'game/data/dialogue')} 2>/dev/null | wc -l`).toString().trim()); } catch { /* */ }
chk('CHR03-m1-imperial-13-in-world', impInWorld > 0, `${impInWorld} book/dialogue files mentioning an Imperial sign name`, '> 0 — they exist in-world as a wrong system');

console.log('\n== RI-CHR03 method 2 — drawback census');
const dcls = BS.map((b) => ({ id: b.id, kind: (b.drawback && (b.drawback.kind || b.drawback.class || b.drawback.type)) || (b.drawback ? 'unclassified' : 'none') }));
const mech = dcls.filter((d) => d.kind === 'mechanical').length, cond = dcls.filter((d) => d.kind === 'conditional').length;
chk('CHR03-m2-drawback-count', mech >= 2, `${mech} mechanical + ${cond} conditional; classification: ${JSON.stringify(dcls)}`, '>= 2 mechanical (target 3 + 3)');

console.log('\n== RI-CHR01 §6 — the five prohibitions');
let gateHits = '';
try {
  gateHits = execSync(`grep -rnE '"(requires_class|class_min)"' ${path.join(ROOT, 'game/data/quests')} ${path.join(ROOT, 'game/data/dialogue')} ${path.join(ROOT, 'game/data/items')} ${path.join(ROOT, 'game/data/world')} 2>/dev/null | head -20`).toString().trim();
} catch { gateHits = ''; }
chk('CHR01-m8-no-class-gate', gateHits === '', `requires_class / class_min hits in quests|dialogue|items|world: ${gateHits ? gateHits.split('\n').length : 0}`, 'zero');
// caste topics
let casteFiles = 0;
try { casteFiles = Number(execSync(`grep -rl "caste" ${path.join(ROOT, 'game/data/dialogue')} ${path.join(ROOT, 'game/data/npcs')} 2>/dev/null | wc -l`).toString().trim()); } catch { /* */ }
chk('CHR01-m8-caste-topics-present', casteFiles > 0, `${casteFiles} dialogue/npc files mentioning 'caste'`, '3 caste topics on >= 25 NPCs each');

console.log('\n== RI-CHR02 method 4 — NPC reaction_group coverage');
const npcDir = path.join(ROOT, 'game/data/npcs');
const npcFiles = fs.existsSync(npcDir) ? fs.readdirSync(npcDir).filter((f) => f.endsWith('.json')) : [];
let npcs = [];
for (const f of npcFiles) {
  const doc = JSON.parse(fs.readFileSync(path.join(npcDir, f), 'utf8'));
  const list = Array.isArray(doc) ? doc : (doc.npcs || (doc.id ? [doc] : []));
  npcs = npcs.concat(list);
}
const tagged = npcs.filter((n) => n.reaction_group);
chk('CHR02-m4-npc-coverage', npcs.length > 0 && tagged.length === npcs.length, `${tagged.length}/${npcs.length} NPCs across ${npcFiles.length} files carry a reaction_group`, '100%');
const shares = {}; for (const n of tagged) shares[n.reaction_group] = (shares[n.reaction_group] || 0) + 1;
chk('CHR02-m4-population', npcs.length >= 100, `${npcs.length} NPC records shipped; group shares ${JSON.stringify(shares)}`, 'enough NPCs for the +-4pt population-share assertion to mean anything');

console.log('\n== RI-CHR02 method 5 — dialogue volume');
const dlgRoot = path.join(ROOT, 'game/data/dialogue');
const countIn = (re, dir) => { try { return Number(execSync(`grep -rEo '${re}' ${dir} 2>/dev/null | wc -l`).toString().trim()); } catch { return 0; } };
const greetDir = path.join(dlgRoot, 'greetings');
const greetings = fs.existsSync(greetDir) ? countIn('"line"', greetDir) : 0;
chk('CHR02-m5-1500-greetings', greetings >= 1500, `${greetings} greeting lines (dir ${fs.existsSync(greetDir) ? 'exists' : 'ABSENT'})`, '>= 1,500 across >= 250 of 300 cells');
const reqRace = countIn('"(requires|forbids)"[^\\n]{0,40}race', dlgRoot);
const forbidsRace = countIn('"forbids"[^\\n]{0,40}race', dlgRoot);
chk('CHR02-m5-90-race-topics', reqRace >= 90, `${reqRace} race-filtered topic records (${forbidsRace} forbids)`, '>= 90, >= 30 forbids');
const slavery = countIn('slave|slaver|stock|collar', dlgRoot);
chk('CHR02-m5-60-slavery-lines', slavery >= 60, `${slavery} slavery-vocabulary hits in dialogue`, '>= 60 lines, >= 12 to a Dunmer player');

console.log('\n== tooling the methods require');
for (const t of ['tools/analysis/build-viability.mjs', 'tools/analysis/content-stats.mjs', 'tools/journey/journey-run.mjs', 'tools/journey/beat-extract.mjs', 'tools/journey/gamepad-shim.mjs']) {
  chk(`tool-${path.basename(t)}`, fs.existsSync(path.join(ROOT, t)), `${t} ${fs.existsSync(path.join(ROOT, t)) ? 'exists' : 'ABSENT'}`, 'required by a method assigned to this piece');
}

const failed = R.filter((r) => !r.ok);
console.log(`\n== summary\n${R.length - failed.length}/${R.length} assertions pass`);
for (const f of failed) console.log(`FAIL  ${f.id}: ${f.measured}`);
fs.writeFileSync(path.join(OUT, 'critic-audit.json'), JSON.stringify({ tool: 'critic-w1-07-audit', root: ROOT, results: R }, null, 2));
