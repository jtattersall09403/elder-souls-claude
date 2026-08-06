#!/usr/bin/env node
// chr-probe.mjs — read the character-creation numbers out of the RUNNING game.
//
// Owner: W1-07. creation-audit.mjs measures the shipped data by importing the same modules the
// game imports, which is the right check for arithmetic and the wrong check for wiring: it
// would still pass if the harness never exposed any of it. This probe boots the real game in
// headless Chromium and asks it, through window.__HARNESS, the questions RI-CHR02 methods 3, 7
// and 9 and RI-CHR03 §6 ask — so "the game does this" and "a table on disk says this" are
// separately evidenced.
//
// USAGE
//   node tools/harness/chr-probe.mjs [--state <id>] [--group RG-DEEP] [--json <path>]
import path from 'node:path';
import { parseArgs, wantsHelp, usage, writeJson, log } from '../lib/cli.mjs';
import { launchGame } from '../lib/browser.mjs';

const USAGE = `
chr-probe.mjs — RI-CHR02 M3/M7/M9 asked of the live game through window.__HARNESS.

USAGE
  node tools/harness/chr-probe.mjs [--state <id>] [--group <RG-*>] [--base-price <g>] [--json <path>]
`;
const args = parseArgs();
if (wantsHelp(args)) usage(USAGE);
const GROUP = String(args.group || 'RG-DEEP');
const BASE_PRICE = Number(args['base-price'] || 60);
const STATE = String(args.state || 'wld-dres-raid-road');

const h = await launchGame(args);
const say = (s) => process.stdout.write(s + '\n');
const out = { group: GROUP, base_price: BASE_PRICE, state: STATE, rows: [], encounter: null, races: [] };
try {
  await h.h('setSeed', 1337);
  await h.h('loadState', STATE);

  const data = await h.h('getCreationData');
  out.races = data.races.races.map((r) => r.id);

  say(`== RI-CHR02 M3 / M7 / M9 at ${GROUP}, base disposition 50, a ${BASE_PRICE} g draught ==`);
  say('race      upbringing     disp band      buy   sell  arrest>=  attack>=  susp   loiter');
  for (const race of out.races) {
    for (const up of data.reactions.upbringings.map((u) => u.id)) {
      const r = await h.h('getReaction', { group: GROUP, race, upbringing: up, base: 50 });
      const p = await h.h('getPriceQuote', { group: GROUP, race, upbringing: up, base_price: BASE_PRICE });
      const g = await h.h('getGuardTerms', race);
      const row = {
        race, upbringing: up, disposition: r.disposition.value, band: r.disposition.band,
        race_term: r.term.race, upbringing_term: r.term.upbringing,
        buy: p.buy, sell: p.sell, buy_mult: p.buyMult, sell_mult: p.sellMult,
        arrest_at: g.arrest_at, attack_at: g.attack_at, suspicion: g.suspicion, loiter_s: g.loiter_to_challenge_s,
        player_race_class: r.player_race_class,
      };
      out.rows.push(row);
      say(`${race.padEnd(9)} ${up.padEnd(13)} ${String(row.disposition).padStart(4)} ${row.band.padEnd(9)} ` +
        `${String(row.buy).padStart(5)} ${String(row.sell).padStart(6)} ${String(row.arrest_at).padStart(9)} ` +
        `${String(row.attack_at).padStart(9)} ${String(row.suspicion).padStart(6)} ${String(row.loiter_s).padStart(7)}`);
    }
  }

  // The spread the item's headline claim is about, computed from what the GAME returned.
  const best = out.rows.reduce((a, b) => (b.disposition > a.disposition ? b : a));
  const worst = out.rows.reduce((a, b) => (b.disposition < a.disposition ? b : a));
  say(`\nbest  ${best.race}/${best.upbringing} = ${best.disposition} (${best.band}); ` +
    `worst ${worst.race}/${worst.upbringing} = ${worst.disposition} (${worst.band}); spread ${best.disposition - worst.disposition} points`);
  const rt = (r) => (r.sell_mult / r.buy_mult);
  const sax = out.rows.find((r) => r.race === 'saxhleel' && r.upbringing === 'interior');
  const dun = out.rows.find((r) => r.race === 'dunmer' && r.upbringing === 'foreign-born');
  say(`round trip: Dunmer/foreign-born keeps ${(rt(dun) / rt(sax) * 100).toFixed(1)}% of what a Saxhleel/interior keeps`);
  out.spread = { best, worst, points: best.disposition - worst.disposition, round_trip_pct: +(rt(dun) / rt(sax) * 100).toFixed(2) };

  say('\n== the same encounter, seen by each race (AR-3; statblocks are race-blind) ==');
  const enc = await h.h('getEncounterState', 'dres-raid-party');
  out.encounter = { id: enc.encounter, members: (enc.members || []).map((m) => ({ role: m.role, statblock: m.statblock, moveset: m.moveset, archetype: m.archetype, hp_max: m.hp_max, poise_max: m.poise_max })) };
  out.openings = [];
  for (const race of out.races) {
    await h.h('setCharacter', { race });
    const e = await h.h('getEncounterState', 'dres-raid-party');
    const o = e.opening;
    out.openings.push({ race, ...o });
    say(`${race.padEnd(9)} opening=${String(o.opening).padEnd(8)} aggro_at_m=${String(o.aggro_at_m).padEnd(6)} nets=${String(o.net_behaviour).padEnd(8)} defeat=${o.on_player_defeat}`);
  }
  const fight = [...new Set((enc.members || []).map((m) => `${m.statblock}/${m.moveset}/${m.archetype}/${m.hp_max}/${m.poise_max}`))];
  say(`\nstatblock/moveset/archetype/hp/poise combinations across all ten races: ${fight.length} (${fight.join(' | ')})`);
} finally {
  await h.close();
}
if (args.json) { writeJson(path.resolve(String(args.json)), out); log(`wrote ${args.json}`); }
