// RI-DLG04 step 1, our side: feed the oracle's cases through the SHIPPING engine module and
// emit the same four columns. Nothing here re-derives anything; it imports
// game/src/sim/dialogue/disposition.js — the exact file the game loads — and calls it.
//
//   node tools/dialogue/dump-engine-disposition.mjs --cases /tmp/oracle.tsv --out /tmp/ours.tsv
'use strict';
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';
import { derivedDisposition, persuasionRatings } from '../../game/src/sim/dialogue/disposition.js';

const HERE = path.dirname(url.fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');
const G = JSON.parse(fs.readFileSync(path.join(ROOT, 'game/data/dialogue/persuasion-gmst.json'), 'utf8')).gmst;

const args = Object.fromEntries(process.argv.slice(2).reduce((a, v, i, arr) => (v.startsWith('--') ? [...a, [v.slice(2), arr[i + 1]]] : a), []));
const casesPath = args.cases || '/tmp/oracle.tsv';
const outPath = args.out || '/tmp/ours.tsv';

const lines = fs.readFileSync(casesPath, 'utf8').trim().split('\n');
const head = lines[0].split('\t');
const idx = Object.fromEntries(head.map((h, i) => [h, i]));
const out = [head.join('\t')];

// A one-cell reaction matrix and a one-cell race matrix, so the engine's data-driven lookups
// reproduce exactly the scalar the oracle was handed. This is the ONLY adaptation between the
// two implementations and it moves no arithmetic.
for (let i = 1; i < lines.length; i++) {
  const f = lines[i].split('\t');
  const n = (k) => Number(f[idx[k]]);
  const reaction = n('reaction');
  const rank = n('rank');

  const npc = {
    id: 'oracle-npc',
    baseDisposition: n('base'),
    crimeDispositionModifier: n('crimeMod'),
    race: 'A',
    faction: 'F',
    reaction_group: 'RG',
    Personality: n('nPersonality'), Luck: n('nLuck'), Speechcraft: n('nSpeechcraft'),
    Mercantile: n('nMercantile'), level: n('nLevel'), Reputation: n('nReputation'),
    fatigue: n('nFatigue'), fatigueMax: n('nFatigueMax'),
  };
  const player = {
    race: n('sameRace') ? 'A' : 'B',
    upbringing: 'U',
    factions: { F: { rank, expelled: false } },
    Personality: n('pPersonality'), Luck: n('pLuck'), Speechcraft: n('pSpeechcraft'),
    Mercantile: n('pMercantile'), level: n('pLevel'), Reputation: n('pReputation'),
    fatigue: n('pFatigue'), fatigueMax: n('pFatigueMax'),
    bounty: n('bounty'),
    hasCommonDisease: n('disease') === 1,
    weaponDrawn: n('weaponDrawn') === 1,
    charmMagnitude: n('charm'),
  };
  const ctx = {
    gmst: G,
    attacked: n('attacked') === 1,
    factionReactions: { matrix: { F: { F: reaction } } },
    raceReactions: {
      matrix: { RG: { A: n('raceReaction'), B: n('raceReaction') } },
      upbringings: [{ id: 'U', mods: { RG: n('upbringing') } }],
    },
  };

  const D = derivedDisposition(npc, player, ctx);
  const [n1, n2, n3] = persuasionRatings(npc, false, G);
  const [p1, p2, p3] = persuasionRatings(player, true, G);
  const d = 1 - 0.02 * Math.abs(D - 50);
  const t1 = d * (p1 - n1 + 50);
  const t2 = d * (p2 - n2 + 50);
  const t3 = d * (p3 - n3 + 50) + n('bribeMod');

  const row = f.slice(0, head.length - 5);
  row.push(String(D), d.toFixed(9), t1.toFixed(9), t2.toFixed(9), t3.toFixed(9));
  out.push(row.join('\t'));
}

fs.writeFileSync(outPath, out.join('\n') + '\n');
process.stderr.write(`engine: ${lines.length - 1} cases -> ${outPath}\n`);
