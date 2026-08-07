#!/usr/bin/env node
// chr-quest-race-gate.mjs — does WHO YOU ARE change whether a quest is offered to you?
//
// Owner: W1-07 (`character.race.access`). The dispatch this answers is NEXT-DISPATCH §1b, and
// it was amended once because the first proposed fix did not work: a tool builder claimed the
// missing NPC records were the whole defect, a tool critic minted one on a shadow tree, booted
// the engine on that same tree, and **it blocked nobody**. So this probe measures the RUNNING
// world through `window.__HARNESS.questOffers()` and never models what the gate would do —
// modelling the gate is precisely the error that produced a confident false red.
//
// Five things it establishes, each of which can go red:
//
//   1. DIFFERENTIATION — drive N character signatures through `questOffers()` and diff the
//      disposition clauses. Round 2 measured six signatures producing a BYTE-IDENTICAL clause
//      set. Anything short of "the clauses differ" fails here.
//   2. THE WORKED EXAMPLE — `RI-MTH06` §A's own case, live: `Q-DEEP-01` asks 50 of
//      `speaker-teel-ashaan` (RG-DEEP, base 50). `dunmer/lukiul` has a ceiling of 34 and must be
//      refused however well it plays; `dunmer/interior` has a ceiling of 60 and must not be
//      refused permanently; `saxhleel/interior` must be offered from a cold start.
//   3. NO DIFFERENTIATION BY SUBTRACTION — the inverse failure a W1-07 critic caught nearby: a
//      race is "different" because it is offered nothing at all. Every race must be able to
//      finish, so every `category:"main"` gate is checked against every signature and the
//      offerable count is reported per race.
//   4. PERTURBATION (`ARBITRATION` §3, `RI-MTH07`) — rewrite the reaction matrix on disk,
//      reboot, and show a live OFFER DECISION change; restore and show it come back.
//   5. DELETE-THE-FIX — remove the wiring from a copy of the engine, reboot, and confirm the
//      byte-identical clauses return. A fix whose removal changes nothing was never the fix.
//
// USAGE
//   node tools/harness/chr-quest-race-gate.mjs [--json <path>] [--no-perturb] [--quiet]
//
// Exit 0 = every check passed. Exit 1 = at least one failed. Exit 2 = the build did not boot.

import fs from 'node:fs';
import path from 'node:path';
import { parseArgs, wantsHelp, usage, writeJson, REPO_ROOT } from '../lib/cli.mjs';
import { launchGame } from '../lib/browser.mjs';

const USAGE = `
chr-quest-race-gate.mjs — race and upbringing on the quest-offer path, measured live.

USAGE
  node tools/harness/chr-quest-race-gate.mjs [--json <path>] [--no-perturb] [--quiet]

OPTIONS
  --json <path>   write the full report here
  --no-perturb    skip the two disk-writing checks (4 and 5); read-only
  --quiet         only the summary lines
  --help          this message
`;

const args = parseArgs(process.argv.slice(2));
if (wantsHelp(args)) { usage(USAGE); process.exit(0); }
const DO_PERTURB = !args['no-perturb'];
const QUIET = !!args.quiet;

const MATRIX = path.join(REPO_ROOT, 'game/data/progression/race-reactions.json');
const MACHINE = path.join(REPO_ROOT, 'game/src/sim/quest/machine.js');

const say = (s) => { if (!QUIET) process.stdout.write(s + '\n'); };
const shout = (s) => process.stdout.write(s + '\n');

const out = {
  tool: 'chr-quest-race-gate', signatures: [], checks: [], failures: [],
  clauses: {}, worked_example: null, viability: null, perturbation: null, delete_the_fix: null,
};
const check = (id, ok, measured, expected) => {
  out.checks.push({ id, ok: !!ok, measured, expected });
  if (!ok) out.failures.push(`${id}: ${measured}`);
  say(`  ${ok ? 'pass' : 'FAIL'}  ${id} — ${measured}`);
};

// The signature set. The first six are the ones the round-2 tool critic drove and found
// byte-identical; the rest widen it to every race so check 3 cannot pass by subtraction.
const RACES = ['saxhleel', 'naga', 'dunmer', 'imperial', 'nord', 'breton', 'redguard', 'khajiit', 'orsimer', 'bosmer'];
const UPBRINGINGS = ['interior', 'lukiul', 'foreign-born', 'blackrose'];
const CRITIC_SIX = [
  ['dunmer', 'lukiul'], ['dunmer', 'foreign-born'], ['saxhleel', 'interior'],
  ['saxhleel', 'lukiul'], ['imperial', 'blackrose'], ['nord', 'foreign-born'],
];

/**
 * Drive one signature through the live offer gate and return only what a gate DECIDED, never
 * anything the probe computed. `clause` is the exact `why` string the build wrote.
 */
async function sweep(page, pairs) {
  return page.evaluate((sigs) => {
    const H = window.__HARNESS;
    H.setRenderRate(0);
    // Every quest in the build opens on a dialogue topic, so a cold-start character is
    // offered nothing at all and an offerable COUNT cannot tell two signatures apart. Learning
    // every `opens_by` topic strips out the one gate that has nothing to do with who you are,
    // and leaves disposition as the only axis still moving. The prerequisite-quest and rank
    // gates are left standing, so this is not "grant yourself the thing under test": it is
    // removing a confound the probe is not measuring.
    const topics = new Set();
    for (const id of H.questBook()) {
      const def = H.questDef ? H.questDef(id) : null;
      if (def && def.opens_by && def.opens_by.topic) topics.add(def.opens_by.topic);
      for (const t of (def && def.opens_by && def.opens_by.prerequisite_topics) || []) topics.add(t);
    }
    const rows = [];
    for (const [race, upbringing] of sigs) {
      H.setCharacter({ race, upbringing, class: 'reed-walker', birthsign: 'raj-xul' });
      for (const t of topics) { try { H.learnTopic(t); } catch (e) { /* not a topic this build knows */ } }
      const offers = H.questOffers();
      const clauses = [];
      let offerable = 0;
      const dispBlocked = [];
      const perQuest = {};
      for (const o of offers) {
        if (o.offerable) offerable++;
        const d = (o.why || []).filter((w) => / disposition [\d.]+\/\d+$/.test(w));
        for (const c of d) clauses.push(`${o.id}|${c}`);
        if (d.length) dispBlocked.push(o.id);
        perQuest[o.id] = { offerable: !!o.offerable, why: (o.why || []).slice() };
      }
      rows.push({
        race, upbringing,
        clauses: clauses.sort(),
        clause_key: clauses.sort().join('\n'),
        offerable, total: offers.length,
        disposition_blocked: dispBlocked.sort(),
        disposition_blocked_key: dispBlocked.sort().join(','),
        per_quest: perQuest,
        gate_dispositions: H.getGateDispositions(),
        register: H.getDispositions(),
      });
    }
    return rows;
  }, pairs);
}

let handle;
let exitCode = 0;
try {
  handle = await launchGame({ ...args, width: 320, height: 240 });
  const page = handle.page;
  const up = await page.waitForFunction(() => !!window.__HARNESS, null, { timeout: 40000 })
    .then(() => true).catch(() => false);
  if (!up) { shout('chr-quest-race-gate: the engine did not construct — every number below would be void'); process.exit(2); }

  // ---- 1. differentiation ------------------------------------------------------------------
  say('\n== 1. differentiation — the same six signatures round 2 found byte-identical');
  const six = await sweep(page, CRITIC_SIX);
  out.signatures = six.map((r) => `${r.race}/${r.upbringing}`);
  for (const r of six) {
    out.clauses[`${r.race}/${r.upbringing}`] = r.clauses;
    say(`     ${(r.race + '/' + r.upbringing).padEnd(22)} ${String(r.offerable).padStart(2)}/${r.total} offerable, ${r.clauses.length} disposition clauses, ${r.disposition_blocked.length} quests blocked on standing`);
  }
  const keys = new Set(six.map((r) => r.clause_key));
  check('DIFFERENTIATION', keys.size > 1,
    `${keys.size} distinct disposition-clause sets across the ${six.length} signatures`,
    '> 1 — round 2 measured exactly 1, byte-identical, which is the defect');

  const offCounts = new Set(six.map((r) => r.offerable));
  const blockedSets = new Set(six.map((r) => r.disposition_blocked_key));
  check('DIFFERENTIATION-DECIDES', offCounts.size > 1 && blockedSets.size > 1,
    `offerable counts across the six: ${six.map((r) => r.offerable).join(', ')}; `
    + `distinct sets of quests refused on standing: ${blockedSets.size}`,
    '> 1 distinct offerable count AND > 1 distinct refusal set — the clause TEXT differing is '
    + 'not enough; the gate has to reach a different DECISION for a different character');

  // ---- 2. the worked example ---------------------------------------------------------------
  say('\n== 2. RI-MTH06 §A worked example — Q-DEEP-01 asks 50 of speaker-teel-ashaan');
  const we = await page.evaluate(async () => {
    const H = window.__HARNESS;
    const rows = {};
    for (const [race, up] of [['dunmer', 'lukiul'], ['dunmer', 'interior'], ['saxhleel', 'interior'], ['nord', 'interior'], ['khajiit', 'foreign-born']]) {
      H.setCharacter({ race, upbringing: up, class: 'reed-walker', birthsign: 'raj-xul' });
      const o = H.questOffers().find((q) => q.id === 'Q-DEEP-01');
      rows[`${race}/${up}`] = {
        why: o ? o.why : null,
        clause: o ? (o.why || []).find((w) => w.includes('speaker-teel-ashaan')) || null : null,
        explain: H.explainDisposition('speaker-teel-ashaan'),
      };
    }
    return rows;
  });
  out.worked_example = we;
  for (const [sig, r] of Object.entries(we)) {
    say(`     ${sig.padEnd(22)} disposition ${String(r.explain.value).padStart(3)}  ${r.clause ? 'REFUSED — ' + r.clause : 'no disposition clause (this giver does not block)'}`);
  }
  const lk = we['dunmer/lukiul'], di = we['dunmer/interior'], si = we['saxhleel/interior'];
  check('WORKED-EXAMPLE-REFUSES', !!lk.clause && lk.explain.value < 50,
    `dunmer/lukiul (assimilated) stands at ${lk.explain.value} against an ask of 50 and is refused: ${lk.clause}`,
    'refused — race term -40 + upbringing -16 puts its ceiling at 34, below the 50 the quest asks');
  check('WORKED-EXAMPLE-ADMITS', !si.clause,
    `saxhleel/interior stands at ${si.explain.value} and carries no disposition clause on Q-DEEP-01`,
    'offered — the native at home must not be gated out of the interior');
  // RI-MTH06 §A's ceiling: the base the world wrote down, plus the two permanent terms, plus
  // every movable term at its maximum (`build-viability.mjs`'s
  // `disposition_other_terms_ceiling: 40`). Taken from the terms the ENGINE reported, never
  // recomputed here, because the intermediate clamp at 0 destroys the arithmetic.
  const ceil = (e) => e.base + e.race_term + e.upbringing_term + e.birthsign_term + 40;
  check('WORKED-EXAMPLE-CEILING', ceil(lk.explain) < 50 && ceil(di.explain) >= 50,
    `ceilings from the engine's own terms: dunmer/lukiul ${ceil(lk.explain)} (permanently short of the 50 asked), dunmer/interior ${ceil(di.explain)} (reaches it)`,
    'lukiul 34 < 50 <= interior 60, exactly RI-MTH06 §A — the upbringing axis partly buys out the race term and never fully cancels it');

  // ---- 3. every race can finish ------------------------------------------------------------
  say('\n== 3. no differentiation by subtraction — every race, every main-quest gate');
  const via = await page.evaluate(({ races, ups }) => {
    const H = window.__HARNESS;
    const topics = new Set();
    for (const id of H.questBook()) {
      const def = H.questDef(id);
      if (def.opens_by && def.opens_by.topic) topics.add(def.opens_by.topic);
      for (const t of (def.opens_by && def.opens_by.prerequisite_topics) || []) topics.add(t);
    }
    const blocked = [];
    const perRace = {};
    for (const race of races) {
      for (const up of ups) {
        H.setCharacter({ race, upbringing: up, class: 'reed-walker', birthsign: 'raj-xul' });
        for (const t of topics) { try { H.learnTopic(t); } catch (e) { /* unknown topic */ } }
        const offers = H.questOffers();
        let n = 0;
        for (const o of offers) {
          const d = (o.why || []).find((w) => / disposition [\d.]+\/\d+$/.test(w));
          if (d && /^Q-MAIN-/.test(o.id)) blocked.push({ signature: `${race}/${up}`, quest: o.id, why: d });
          if (o.offerable) n++;
        }
        perRace[`${race}/${up}`] = n;
      }
    }
    return { blocked, perRace };
  }, { races: RACES, ups: UPBRINGINGS });
  out.viability = via;
  const counts = Object.values(via.perRace);
  check('MAIN-SPINE-OPEN-TO-EVERY-RACE', via.blocked.length === 0,
    `${via.blocked.length} (signature, main quest) pairs blocked on disposition across ${Object.keys(via.perRace).length} signatures`
    + (via.blocked.length ? `: ${via.blocked.slice(0, 6).map((b) => `${b.signature} ${b.quest} ${b.why}`).join('; ')}` : ''),
    'zero — RI-CHR01 §5 criterion 3: no signature may meet a gate with no route it can take');
  check('NOBODY-IS-OFFERED-NOTHING', Math.min(...counts) > 0,
    `offerable quests per signature: min ${Math.min(...counts)}, max ${Math.max(...counts)} over ${counts.length} signatures`,
    '> 0 for every signature — a race that is offered nothing makes the differentiation check pass by subtraction');
  const byRace = {};
  for (const [sig, n] of Object.entries(via.perRace)) { const r = sig.split('/')[0]; byRace[r] = Math.max(byRace[r] || 0, n); }
  say(`     best offerable count per race: ${Object.entries(byRace).map(([r, n]) => `${r} ${n}`).join(', ')}`);

  // ---- 4. perturbation ---------------------------------------------------------------------
  if (DO_PERTURB) {
    say('\n== 4. perturbation — break the reaction matrix on disk and watch a live OFFER DECISION move');
    const original = fs.readFileSync(MATRIX, 'utf8');
    try {
      const doc = JSON.parse(original);
      // Flip the load-bearing cell: a Dunmer becomes as welcome in the interior as a native.
      doc.matrix['RG-DEEP'].dunmer = 14;
      for (const u of doc.upbringings) if (u.id === 'lukiul') u.mods['RG-DEEP'] = 10;
      fs.writeFileSync(MATRIX, JSON.stringify(doc, null, 2) + '\n');
      await page.reload({ waitUntil: 'load' });
      await page.waitForFunction(() => { try { return !!window.__HARNESS && window.__HARNESS.questBook().length > 0; } catch (e) { return false; } }, null, { timeout: 40000 });
      const after = await page.evaluate(() => {
        const H = window.__HARNESS;
        H.setRenderRate(0);
        H.setCharacter({ race: 'dunmer', upbringing: 'lukiul', class: 'reed-walker', birthsign: 'raj-xul' });
        const o = H.questOffers().find((q) => q.id === 'Q-DEEP-01');
        return { clause: (o.why || []).find((w) => w.includes('speaker-teel-ashaan')) || null, value: H.explainDisposition('speaker-teel-ashaan').value };
      });
      out.perturbation = { before: { clause: lk.clause, value: lk.explain.value }, after };
      check('PERTURBATION-MOVES-A-DECISION', !!lk.clause && !after.clause,
        `dunmer/lukiul at speaker-teel-ashaan: ${lk.explain.value} REFUSED -> ${after.value} offered, after two cells of race-reactions.json changed`,
        'the decision flips — if the shipped matrix is edited and no offer changes, nothing reads it');
    } finally {
      fs.writeFileSync(MATRIX, original);
    }
    await page.reload({ waitUntil: 'load' });
    await page.waitForFunction(() => { try { return !!window.__HARNESS && window.__HARNESS.questBook().length > 0; } catch (e) { return false; } }, null, { timeout: 40000 });
    const restored = await page.evaluate(() => {
      const H = window.__HARNESS;
      H.setRenderRate(0);
      H.setCharacter({ race: 'dunmer', upbringing: 'lukiul', class: 'reed-walker', birthsign: 'raj-xul' });
      const o = H.questOffers().find((q) => q.id === 'Q-DEEP-01');
      return { clause: (o.why || []).find((w) => w.includes('speaker-teel-ashaan')) || null, value: H.explainDisposition('speaker-teel-ashaan').value };
    });
    out.perturbation.restored = restored;
    check('PERTURBATION-RESTORES', restored.clause === lk.clause && restored.value === lk.explain.value,
      `restore returns ${restored.value} and the identical clause`,
      'byte-identical to the pre-perturbation reading');

    // ---- 5. delete the fix -----------------------------------------------------------------
    say('\n== 5. delete-the-fix — put the raw register back on the gate and confirm the old defect returns');
    const machineSrc = fs.readFileSync(MACHINE, 'utf8');
    try {
      const reverted = machineSrc.replace('dispositions: this.dispositionView(),', 'dispositions: q.dispositions,');
      if (reverted === machineSrc) throw new Error('delete-the-fix: could not find the wiring to remove — the probe is out of date with the build');
      fs.writeFileSync(MACHINE, reverted);
      await page.reload({ waitUntil: 'load' });
      await page.waitForFunction(() => { try { return !!window.__HARNESS && window.__HARNESS.questBook().length > 0; } catch (e) { return false; } }, null, { timeout: 40000 });
      const without = await sweep(page, CRITIC_SIX);
      const k2 = new Set(without.map((r) => r.clause_key));
      out.delete_the_fix = {
        distinct_clause_sets: k2.size,
        offerable_counts: without.map((r) => r.offerable),
        clause_set: [...k2][0] ? [...k2][0].split('\n') : [],
      };
      check('DELETE-THE-FIX', k2.size === 1,
        `with one line reverted, the ${without.length} signatures collapse to ${k2.size} clause set(s) — the round-2 finding, reproduced`,
        'exactly 1 — if removing the fix leaves the numbers different, something else was doing the work');
    } finally {
      fs.writeFileSync(MACHINE, machineSrc);
    }
    await page.reload({ waitUntil: 'load' });
    await page.waitForFunction(() => { try { return !!window.__HARNESS && window.__HARNESS.questBook().length > 0; } catch (e) { return false; } }, null, { timeout: 40000 });
    const back = await sweep(page, CRITIC_SIX);
    check('DELETE-THE-FIX-RESTORES', new Set(back.map((r) => r.clause_key)).size === keys.size,
      `restoring the line returns ${new Set(back.map((r) => r.clause_key)).size} distinct clause sets`,
      `${keys.size} — the same number measured before the deletion`);
  }
} catch (e) {
  out.failures.push(`probe threw: ${String(e).slice(0, 400)}`);
  shout(`chr-quest-race-gate: ${String(e).slice(0, 600)}`);
  exitCode = 2;
} finally {
  if (handle && handle.close) await handle.close();
}

const passed = out.checks.filter((c) => c.ok).length;
shout(`\nchr-quest-race-gate: ${passed}/${out.checks.length} checks pass, ${out.failures.length} failures`);
for (const f of out.failures) shout(`  FAIL  ${f}`);
if (args.json) writeJson(String(args.json), out);
process.exit(exitCode || (out.failures.length ? 1 : 0));
