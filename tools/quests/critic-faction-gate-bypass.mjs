#!/usr/bin/env node
// critic-faction-gate-bypass.mjs — CRITIC-WRITTEN (W1-FACTIONS r1), declared under method_deviations.
//
// THE MUTATION. Found while trying to reach rank 7 without poking a flag: on a character with NO
// faction membership, NO reputation and a rank-6 gate that refuses out loud, `questResolve()`
// applied Q-LEDG-07's succession-enabling ending in full — reputation, world flags, unlocks and
// NPC dispositions — because `QuestMachine.reveal()` creates the quest record that
// `resolve()`'s only gate ("quest not open") tests for.
//
// The offer gate — rank, reputation, topics, disposition and the whole mutual-exclusion model the
// piece was built to add — is enforced by `open()` and NOT by `resolve()`.
//
// Structure: CONTROL (resolve before any reveal → must be refused), then the BYPASS (reveal, then
// resolve → observe), then the WORLD (did rank, flags and the offer list actually move).

import path from 'node:path'; import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { launchGame } from '../lib/browser.mjs';
import { parseArgs, writeJson } from '../lib/cli.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const args = parseArgs(process.argv.slice(2));
const d = JSON.parse(fs.readFileSync(`${ROOT}/game/data/quests/faction-wet-ledger.json`, 'utf8'));
const q7 = (d.quests || d).find((x) => x.id === 'Q-LEDG-07');
const REVEALS = ((q7.deceit || {}).revealed_by || []).map((r) => r.id);
const out = { tool: 'critic-faction-gate-bypass', at: new Date().toISOString(), checks: [], sections: {} };
const check = (id, ok, m) => { out.checks.push({ id, ok: !!ok, measured: m });
  process.stdout.write(`  ${ok ? 'pass' : 'FAIL'}  ${id} — ${m}\n`); };

let handle;
try {
  handle = await launchGame({ ...args, width: 320, height: 240 });
  const page = handle.page; const perr = [];
  page.on('pageerror', (e) => perr.push(String(e).slice(0, 200)));
  await page.waitForFunction(() => !!window.__HARNESS, null, { timeout: 60000 });

  const r = await page.evaluate(({ REVEALS }) => {
    const H = window.__HARNESS; H.setRenderRate(0); const R = {};
    const Q = 'Q-LEDG-07', RES = 'res_show_the_returns', FLAG = 'ledger_first_chair_vacant';
    const off = (id) => H.questOffers().find((x) => x.id === id) || null;
    const flags = () => H.questWorldFlags();
    const rank = () => (H.factionGates().factions.find((f) => f.id === 'the_wet_ledger') || {}).derived_rank;

    // A NOBODY. Never joined anything; reputation 0.
    H.setCharacter({ race: 'saxhleel', upbringing: 'lukiul', class: 'ledger-hand', birthsign: 'raj-xul' });
    const sk = {}; for (const k of Object.keys(H.getSkills())) sk[k] = 100; H.setSkills(sk);
    R.standing_at_start = H.getFactionStanding();
    R.rank_at_start = rank();
    R.flag_at_start = flags().includes(FLAG);
    R.q7_offer_row = off(Q);
    R.q8_offerable_at_start = !!(off('Q-LEDG-08') || {}).offerable;

    // The gate speaks.
    R.open_refusal = H.questOpen(Q);

    // CONTROL — resolve with no record. Must be refused. If this succeeds the probe is measuring
    // nothing, because there was never a gate to bypass.
    R.control_resolve = H.questResolve(Q, RES);

    // THE BYPASS — one reveal, which is how a player learns a truth, then the same call again.
    R.reveals_available = REVEALS;
    R.reveal_return = REVEALS.length ? H.questReveal(Q, REVEALS[0]) : 'no reveals declared';
    R.bypass_resolve = H.questResolve(Q, RES);

    // THE WORLD.
    R.flag_after = flags().includes(FLAG);
    R.rank_after = rank();
    R.reputation_after = (H.factionGates().factions.find((f) => f.id === 'the_wet_ledger') || {}).reputation;
    R.standing_after = H.getFactionStanding();
    R.q8_row_after = off('Q-LEDG-08');
    R.completed = (H.getSaveState ? null : null);
    return R;
  }, { REVEALS });

  out.sections = r; out.page_errors = perr;
  check('CONTROL_resolve_without_a_record_is_refused', r.control_resolve && r.control_resolve.ok === false,
    `questResolve on an unopened quest -> ${JSON.stringify(r.control_resolve)}`);
  check('GATE_open_refuses_this_character', r.open_refusal && r.open_refusal.ok === false,
    `questOpen -> ${JSON.stringify((r.open_refusal || {}).reason)}`);
  check('BYPASS_resolve_after_a_reveal_is_ALSO_refused', !(r.bypass_resolve && r.bypass_resolve.ok),
    `after questReveal, questResolve -> ok=${(r.bypass_resolve || {}).ok}; world_flags applied: ${JSON.stringify((r.bypass_resolve || {}).world_flags)}; unlocked: ${JSON.stringify((r.bypass_resolve || {}).unlocked)}; reputation written: ${JSON.stringify((r.bypass_resolve || {}).faction_reputation)}`);
  check('WORLD_rank7_flag_not_raised_by_a_nonmember', !r.flag_after,
    `ledger_first_chair_vacant after the bypass: ${r.flag_after} (was ${r.flag_at_start}); derived rank ${r.rank_at_start} -> ${r.rank_after}; reputation ${r.reputation_after}`);
  check('WORLD_succession_quest_still_closed', !(r.q8_row_after && r.q8_row_after.offerable),
    `Q-LEDG-08 offerable: ${r.q8_offerable_at_start} -> ${!!(r.q8_row_after || {}).offerable}; why: ${JSON.stringify((r.q8_row_after || {}).why)}`);
  check('page_errors_zero', perr.length === 0, `${perr.length} page errors`);
} catch (e) { out.error = String(e && e.stack || e); process.stdout.write('THREW: ' + out.error + '\n'); }
finally { if (handle) await handle.close(); }
writeJson(args.out ? String(args.out) : path.join(ROOT, 'reports', 'critic-faction-gate-bypass.json'), out);
const f = out.checks.filter((c) => !c.ok);
process.stdout.write(`\n${out.checks.length - f.length}/${out.checks.length} checks passed\n`);
process.exit(f.length || out.error ? 1 : 0);
