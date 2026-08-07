#!/usr/bin/env node
// mainline-block-attribute.mjs — WHY does a signature fall under a main-quest gate mid-chain?
//
// Written by the W1-19 round-1 critic; declared under `orchestration/TOOL-LOOP.md`.
// `mainline-race-trace.mjs` shows 11 of 40 signatures failing to finish. This says which step
// moved the number and which term of the derived disposition did the moving, by sampling
// `__HARNESS.explainDisposition(npc)` — the live gate's own decomposition — after every quest.
//
//   node tools/quests/mainline-block-attribute.mjs [--out <dir>]

import fs from 'node:fs';
import path from 'node:path';
import { parseArgs, wantsHelp, usage, writeJson, RUNS_DIR, ensureDir } from '../lib/cli.mjs';
import { launchGame } from '../lib/browser.mjs';

const args = parseArgs();
if (wantsHelp(args)) usage('mainline-block-attribute.mjs [--out <dir>]');
const outDir = args.out ? path.resolve(String(args.out)) : path.join(RUNS_DIR, 'W1-19-R1-RACE');
ensureDir(outDir);

const QDIR = path.join(process.cwd(), 'game/data/quests');
const defs = {};
for (const f of fs.readdirSync(QDIR).sort()) {
  if (!f.endsWith('.json')) continue;
  const doc = JSON.parse(fs.readFileSync(path.join(QDIR, f), 'utf8'));
  for (const q of doc.quests || []) defs[q.id] = q;
}
const mainline = JSON.parse(fs.readFileSync(path.join(QDIR, 'mainline.json'), 'utf8'));
const INTENDED = [...mainline.acts.flatMap((a) => a.quests), ...mainline.aftermath.quests];
const plan = INTENDED.map((id) => {
  const q = defs[id];
  return {
    id, topic: q.opens_by.topic, prereq_topics: q.opens_by.prerequisite_topics || [],
    reveals: ((q.deceit || {}).revealed_by || []).map((r) => r.id),
    notes: (q.journal || []).filter((e) => e.state === 'active' || e.state === 'branch').map((e) => e.index).filter((i) => i > 10),
  };
});

// (signature, the gate it dies on, per mainline-race-trace.mjs)
const CASES = [
  { race: 'saxhleel', upbringing: 'interior', watch: 'salt-factor-neloth-vaun' },
  { race: 'naga', upbringing: 'interior', watch: 'salt-factor-neloth-vaun' },
  { race: 'dunmer', upbringing: 'lukiul', watch: 'rootkeeper-ashul-tei' },
];

const handle = await launchGame({ ...args, width: 320, height: 240, timeout: Number(args.timeout || 600000) });
let res;
try {
  res = await handle.page.evaluate(async ({ plan, cases }) => {
    const H = window.__HARNESS;
    await H.ready();
    H.setRenderRate(0);
    const out = [];
    for (const c of cases) {
      H.setSeed(1337); H.loadState('arena_flat'); H.setRenderRate(0); H.setGold(0);
      H.setCharacter({ race: c.race, upbringing: c.upbringing, class: 'reed-walker', birthsign: 'raj-xul' });
      const track = [{ after: '(cold start)', explain: H.explainDisposition(c.watch) }];
      let blocked = null;
      for (const step of plan) {
        H.learnTopic(step.topic);
        for (const t of step.prereq_topics) H.learnTopic(t);
        const o = H.questOpen(step.id);
        if (!o.ok) { blocked = { quest: step.id, reason: o.reason }; break; }
        for (const r of step.reveals) { try { H.questReveal(step.id, r); } catch (e) { /* */ } }
        for (const ix of step.notes) { try { H.questNote(step.id, ix); } catch (e) { /* */ } }
        const avail = H.questResolutions(step.id);
        const pick = avail.find((a) => a.available && a.violence_required === false) || avail.find((a) => a.available);
        if (!pick) { blocked = { quest: step.id, reason: 'no resolution available' }; break; }
        const r = H.questResolve(step.id, pick.id);
        if (!r.ok) { blocked = { quest: step.id, reason: r.reason }; break; }
        track.push({ after: step.id + ' / ' + pick.id, explain: H.explainDisposition(c.watch) });
      }
      out.push({ ...c, blocked, track });
    }
    return out;
  }, { plan, cases: CASES });
} finally { await handle.close(); }

const report = { tool: 'tools/quests/mainline-block-attribute.mjs', schema: 'elder-souls/mainline-block-attribute@1', cases: res };
writeJson(path.join(outDir, 'mainline-block-attribute.json'), report);

for (const c of res) {
  console.log(`\n${c.race}/${c.upbringing} — watching ${c.watch}`);
  console.log(`  blocked: ${c.blocked ? c.blocked.quest + ' — ' + c.blocked.reason : 'never'}`);
  let prev = null;
  for (const t of c.track) {
    const v = t.explain && (t.explain.value ?? null);
    if (prev === null || v !== prev) {
      console.log(`    ${String(v).padStart(4)}  after ${t.after}${prev === null ? '' : `   (moved ${v - prev})`}`);
      console.log(`          terms: ${JSON.stringify(t.explain)}`.slice(0, 400));
    }
    prev = v;
  }
}
console.log(`\nwrote ${path.join(outDir, 'mainline-block-attribute.json')}`);
