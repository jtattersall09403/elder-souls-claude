#!/usr/bin/env node
// w1-17-r2-s37-invariance.mjs — HOW MUCH OF THIS ROUND DEPENDS ON THE RULING NOBODY HAS MADE YET?
//
//   node tools/dialogue/w1-17-r2-s37-invariance.mjs
//
// Seam ruling S37 — *RI-DLG01 §A mandates first-match-wins in authored order; `converse.js
// infoFor()` scores specificity instead* — was in flight while this round was built
// (`orchestration/status/arbiter-dlg-s37.json`, state `starting`;
// `corpus/00-doctrine/ARBITRATION.md` still ends at S36). W1-17 r2 was told not to touch the
// question and did not: no ordering code was changed, `game/src/character/converse.js` was not
// edited at all, and `order-infos.mjs` was not run.
//
// But the round's headline number — infos no player can hear from any speaker — is produced by a
// tool that resolves candidates, so it is fair to ask how much of the result the ruling could
// overturn. THIS MEASURES THAT RATHER THAN ASSERTING IT, by computing the dead set under BOTH
// candidate rules over identical data:
//
//   SCORING          the shipped rule: the admissible info with the strictly highest specificity
//                    score wins; ties go to the earlier one.
//   FIRST-MATCH      RI-DLG01 §A's rule: the FIRST admissible info in authored order wins.
//
// Neither rule is implemented in the engine by this file. Both are evaluated here, over the same
// merged corpus and the same 369-person roster, purely as measurement.
//
// THE STRUCTURAL POINT, which is why the answer is what it is: `a` and `cell` are SPEAKER-side
// gates. Both rules apply them identically, as an admissibility filter, BEFORE either rule chooses
// among the survivors. An info for which no speaker in the province passes `a`/`cell` has an empty
// candidate set under both rules and is dead under both. Only infos that ARE admissible to some
// speaker, and lose to a sibling, can change hands when the rule changes.
'use strict';
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';
import { buildTopicIndex } from '../../game/src/character/converse.js';
import { loadTopicDocs, loadNpcs } from './answer-census.mjs';

const HERE = path.dirname(url.fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');

const idx = buildTopicIndex(loadTopicDocs());
const npcs = loadNpcs();

// player-gate domains, read out of the corpus (same construction as critic-reach.mjs)
const RACES = new Set(), UPS = new Set(), KNOWS = new Set(), DS = new Set([0, 100]);
for (const [, t] of idx) for (const i of t.infos) {
  if (i.d != null) DS.add(Number(i.d));
  for (const g of [i.requires, i.forbids]) {
    if (!g) continue;
    (g.race || []).forEach((x) => RACES.add(x));
    (g.upbringing || []).forEach((x) => UPS.add(x));
    [...(g.knows || []), ...(g.knows_all || [])].forEach((x) => KNOWS.add(x));
  }
}
for (const u of JSON.parse(fs.readFileSync(path.join(ROOT, 'game/data/progression/race-reactions.json'), 'utf8')).upbringings.map((u) => u.id)) UPS.add(u);
const knowsSets = [new Set(), new Set(KNOWS), ...[...KNOWS].map((k) => new Set([k]))];
const PLAYERS = [];
for (const race of [...RACES].sort()) for (const upbringing of [...UPS].sort()) for (const disposition of [...DS].sort((a, b) => a - b)) for (const knows of knowsSets) PLAYERS.push({ race, upbringing, disposition, knows });

function playerAllows(info, p) {
  const req = info.requires || null, forb = info.forbids || null;
  if (req && Array.isArray(req.race) && req.race.indexOf(p.race) < 0) return false;
  if (req && Array.isArray(req.upbringing) && req.upbringing.indexOf(p.upbringing) < 0) return false;
  if (forb && Array.isArray(forb.race) && forb.race.indexOf(p.race) >= 0) return false;
  if (forb && Array.isArray(forb.upbringing) && forb.upbringing.indexOf(p.upbringing) >= 0) return false;
  if (info.d != null && Number(p.disposition) < Number(info.d)) return false;
  if (req && Array.isArray(req.knows) && !req.knows.some((k) => p.knows.has(k))) return false;
  if (req && Array.isArray(req.knows_all) && !req.knows_all.every((k) => p.knows.has(k))) return false;
  if (forb && Array.isArray(forb.knows) && forb.knows.some((k) => p.knows.has(k))) return false;
  return true;
}
function inCell(npc, cell) {
  if (!cell) return true;
  const want = String(cell).toLowerCase();
  for (const v of [npc.settlement, npc.cell, npc.interior, npc.home_interior, npc.work_interior]) {
    if (!v) continue;
    const s = String(v).toLowerCase();
    if (s === want || s.startsWith(want + '-') || s.startsWith(want + '.')) return true;
  }
  return false;
}
const scoreOf = (info, matchesActor) =>
  (matchesActor ? 8 : 0) + (info.cell ? 2 : 0) + (info.requires ? 4 : 0)
  + (info.d != null ? 1 + Math.min(1, Number(info.d) / 100) : 0) + (info.forbids ? 0.5 : 0);

function deadSet(rule) {
  const reachable = new Set(), speakerAdmits = new Set();
  for (const [, t] of idx) {
    for (const npc of npcs) {
      const actor = npc.actor || null;
      const cand = [];
      for (let i = 0; i < t.infos.length; i++) {
        const info = t.infos[i];
        if (info.cell && !inCell(npc, info.cell)) continue;
        const matchesActor = actor && info.a === actor;
        if (!matchesActor && info.a) continue;
        cand.push({ i, info, s: scoreOf(info, matchesActor) });
        speakerAdmits.add(`${t.id}#${i}`);
      }
      if (!cand.length) continue;
      // SCORING sorts by specificity; FIRST-MATCH keeps authored order.
      if (rule === 'scoring') cand.sort((a, b) => (b.s - a.s) || (a.i - b.i));
      for (const p of PLAYERS) {
        for (const c of cand) if (playerAllows(c.info, p)) { reachable.add(`${t.id}#${c.i}`); break; }
      }
    }
  }
  const dead = [];
  for (const [, t] of idx) for (let i = 0; i < t.infos.length; i++) {
    const k = `${t.id}#${i}`;
    if (!reachable.has(k)) dead.push({ k, speakerAdmitted: speakerAdmits.has(k) });
  }
  return dead;
}

const S = deadSet('scoring'), F = deadSet('first-match');
const setS = new Set(S.map((d) => d.k)), setF = new Set(F.map((d) => d.k));
const both = [...setS].filter((k) => setF.has(k));
const onlyS = [...setS].filter((k) => !setF.has(k));
const onlyF = [...setF].filter((k) => !setS.has(k));
const speakerDead = S.filter((d) => !d.speakerAdmitted).length;

console.log('S37 INVARIANCE — how much of this round survives either ruling');
console.log(`corpus: ${[...idx].reduce((n, [, t]) => n + t.infos.length, 0)} infos, ${npcs.length} speakers, ${PLAYERS.length} players\n`);
console.log(`dead under SCORING      (the shipped rule):        ${setS.size}`);
console.log(`dead under FIRST-MATCH  (RI-DLG01 §A's rule):      ${setF.size}`);
console.log(`dead under BOTH  (invariant to the ruling):        ${both.length}`);
console.log(`dead only under SCORING:                           ${onlyS.length}${onlyS.length ? '  ' + onlyS.join(' ') : ''}`);
console.log(`dead only under FIRST-MATCH:                       ${onlyF.length}${onlyF.length ? '  ' + onlyF.join(' ') : ''}`);
console.log(`\nof the ${setS.size} dead under the shipped rule, ${speakerDead} have NO ADMISSIBLE SPEAKER AT ALL`);
console.log('(both rules filter on `a` and `cell` before either of them resolves anything, so those');
console.log(' are dead under any resolution rule the arbiter can choose).');
console.log(`\nS37-DEPENDENT RESIDUE: ${setS.size - speakerDead} info(s).`);

fs.mkdirSync(path.join(ROOT, 'reports/w1-17-r2'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'reports/w1-17-r2/s37-invariance.json'), JSON.stringify({
  dead_scoring: setS.size, dead_first_match: setF.size, dead_both: both.length,
  only_scoring: onlyS, only_first_match: onlyF,
  no_admissible_speaker: speakerDead, s37_dependent_residue: setS.size - speakerDead,
}, null, 2) + '\n');
