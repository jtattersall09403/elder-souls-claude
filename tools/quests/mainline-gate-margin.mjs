#!/usr/bin/env node
// mainline-gate-margin.mjs — how much room does each signature have at each main-quest gate?
//
// Written by the W1-19 round-1 critic; declared under `orchestration/TOOL-LOOP.md`. The wave-3
// clamp note in `game/data/quests/mainline-act*.json` claims each `category:"main"` gate was
// "clamped to the cold-start standing of the WORST of the 540 signatures at this giver". Nothing
// measures the MARGIN that leaves, and margin is the whole question: a gate set exactly at the
// worst signature's cold-start standing survives a cold start and fails the moment any quest
// consequence subtracts a point. `chr-quest-race-gate.mjs` measures the cold start only.
//
// This reads the LIVE gate view (`__HARNESS.getGateDispositions()`, the same map
// `gate.js canOffer()` reads) at a cold start for every signature, and reports
// `standing - disposition_min` per (signature, main-quest gate).
//
//   node tools/quests/mainline-gate-margin.mjs [--out <dir>]

import fs from 'node:fs';
import path from 'node:path';
import { parseArgs, wantsHelp, usage, writeJson, RUNS_DIR, ensureDir } from '../lib/cli.mjs';
import { launchGame } from '../lib/browser.mjs';

const args = parseArgs();
if (wantsHelp(args)) usage('mainline-gate-margin.mjs [--out <dir>]');
const outDir = args.out ? path.resolve(String(args.out)) : path.join(RUNS_DIR, 'W1-19-R1-RACE');
ensureDir(outDir);

const QDIR = path.join(process.cwd(), 'game/data/quests');
const gates = [];
for (const f of fs.readdirSync(QDIR).sort()) {
  if (!f.endsWith('.json')) continue;
  const doc = JSON.parse(fs.readFileSync(path.join(QDIR, f), 'utf8'));
  for (const q of doc.quests || []) {
    if (q.category !== 'main') continue;
    if (!q.giver || q.giver.disposition_min == null) continue;
    gates.push({
      quest: q.id, act: q.act, npc: q.giver.npc_id, min: q.giver.disposition_min,
      race_blind: q.giver.disposition_min_race_blind ?? null,
      clamped: q.giver.disposition_min_race_blind != null,
    });
  }
}

const RACES = ['saxhleel', 'naga', 'dunmer', 'imperial', 'nord', 'breton', 'redguard', 'khajiit', 'orsimer', 'bosmer'];
const UPBRINGINGS = ['interior', 'lukiul', 'foreign-born', 'blackrose'];
const SIGS = [];
for (const r of RACES) for (const u of UPBRINGINGS) SIGS.push([r, u]);

const handle = await launchGame({ ...args, width: 320, height: 240, timeout: Number(args.timeout || 600000) });
let res;
try {
  res = await handle.page.evaluate(async ({ gates, sigs }) => {
    const H = window.__HARNESS;
    await H.ready();
    H.setRenderRate(0);
    const def = H.getCharacter ? H.getCharacter() : null;
    const rows = [];
    for (const [race, upbringing] of sigs) {
      H.setSeed(1337);
      H.loadState('arena_flat');
      H.setRenderRate(0);
      H.setCharacter({ race, upbringing, class: 'reed-walker', birthsign: 'raj-xul' });
      const view = H.getGateDispositions();
      rows.push({
        race, upbringing,
        margins: gates.map((g) => ({ quest: g.quest, npc: g.npc, min: g.min, standing: view[g.npc] ?? null, margin: (view[g.npc] ?? 0) - g.min })),
      });
    }
    return { default_character: def ? { race: def.race, upbringing: def.upbringing } : null, rows };
  }, { gates, sigs: SIGS });
} finally { await handle.close(); }

const perGate = gates.map((g) => {
  const ms = res.rows.map((r) => ({ sig: `${r.race}/${r.upbringing}`, m: r.margins.find((x) => x.quest === g.quest).margin }));
  const worst = ms.reduce((a, b) => (b.m < a.m ? b : a));
  return { ...g, worst_margin: worst.m, worst_signature: worst.sig, signatures_below: ms.filter((x) => x.m < 0).length };
});
perGate.sort((a, b) => a.worst_margin - b.worst_margin);

const out = {
  tool: 'tools/quests/mainline-gate-margin.mjs',
  schema: 'elder-souls/mainline-gate-margin@1',
  default_character: res.default_character,
  signatures: SIGS.length,
  gates: perGate,
  zero_margin_gates: perGate.filter((g) => g.worst_margin === 0).map((g) => g.quest),
  negative_margin_gates: perGate.filter((g) => g.worst_margin < 0).map((g) => `${g.quest} (${g.worst_signature} ${g.worst_margin})`),
  rows: res.rows,
};
writeJson(path.join(outDir, 'mainline-gate-margin.json'), out);

console.log(`\nmain-quest gate margin at a cold start — ${SIGS.length} signatures x ${gates.length} gates`);
console.log(`default character in a fresh boot: ${JSON.stringify(res.default_character)}\n`);
console.log('  quest        act npc                          min  blind  worst margin  worst signature          sigs below');
for (const g of perGate) {
  console.log(`  ${g.quest.padEnd(11)} ${String(g.act ?? '-').padEnd(3)} ${g.npc.padEnd(28)} ${String(g.min).padStart(3)}  ${String(g.race_blind ?? '-').padStart(5)}  ${String(g.worst_margin).padStart(12)}  ${g.worst_signature.padEnd(24)} ${g.signatures_below}`);
}
console.log(`\nzero-margin gates (any subtraction closes them for the worst signature): ${out.zero_margin_gates.join(', ') || 'none'}`);
console.log(`negative-margin gates (already shut at a cold start): ${out.negative_margin_gates.join(', ') || 'none'}`);
console.log(`\nwrote ${path.join(outDir, 'mainline-gate-margin.json')}`);
