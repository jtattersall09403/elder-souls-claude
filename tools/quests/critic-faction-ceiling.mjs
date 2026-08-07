#!/usr/bin/env node
// critic-faction-ceiling.mjs — CRITIC-WRITTEN (W1-FACTIONS r1), declared under method_deviations.
//
// THE MUTATION faction-probe.mjs's author did not imagine.
//
// faction-probe P4 reports "top derived rank 7 … never set" and P9 reports "17/17 resolutions the
// walk took required no violence". Both are true. P10's own parenthetical says the probe "poked in
// assize_prefect_vacant to clear rank world_state terms" — i.e. the ONE rank term the walk could
// not raise was supplied by the instrument. The rank-6 quest's refuse ending, which the walk
// prefers because it is cheapest and non-violent, is exactly the ending that does NOT vacate the
// seat. So the two headline claims are individually true and jointly untested.
//
// This probe removes the poke and asks the question directly, per RI-MTH07 §B:
//   PERTURB  : resolve the rank-6 quest two ways — the ending the walk chose, and an ending that
//              vacates the seat — holding reputation, attributes and skills fixed.
//   OBSERVE  : the derived rank the shipped FactionGates hands back, and whether Q-*-08 is offered.
//   NULL     : a third resolution the ladder predicts nothing from, to prove the perturbation
//              method is not itself moving the number.
// It NEVER writes a rank and NEVER pokes a world_state flag.

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { launchGame } from '../lib/browser.mjs';
import { parseArgs, writeJson } from '../lib/cli.mjs';
import fs from 'node:fs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const args = parseArgs(process.argv.slice(2));
// questDef() exposes no `resolutions` and no `consequences`, so which ending changes the world is
// invisible from inside the running build. The IDS therefore come from the authored file; every
// BEHAVIOUR below still comes from the engine.
const FILES = { 'Q-ASSZ-07': 'faction-imperial-assize', 'Q-LEDG-07': 'faction-wet-ledger', 'Q-XULA-07': 'faction-xul-aneekh' };
const AUTHORED = {};
for (const [qid, file] of Object.entries(FILES)) {
  const d = JSON.parse(fs.readFileSync(`${ROOT}/game/data/quests/${file}.json`, 'utf8'));
  const q = (d.quests || d).find((x) => x.id === qid);
  AUTHORED[qid] = (q.resolutions || []).map((r) => {
    const wf = (r.consequences || {}).world_flags || [];
    return { id: r.id, method: r.method, violence: !!r.violence_required,
             flags: Array.isArray(wf) ? wf : Object.keys(wf) };
  });
}
const out = { tool: 'critic-faction-ceiling', at: new Date().toISOString(), checks: [], sections: {} };
const check = (id, ok, m) => { out.checks.push({ id, ok: !!ok, measured: m });
  process.stdout.write(`  ${ok ? 'pass' : 'FAIL'}  ${id} — ${m}\n`); };

let handle;
try {
  handle = await launchGame({ ...args, width: 320, height: 240 });
  const page = handle.page; const perr = [];
  page.on('pageerror', (e) => perr.push(String(e).slice(0, 200)));
  await page.waitForFunction(() => !!window.__HARNESS, null, { timeout: 60000 });

  const r = await page.evaluate((AUTHORED) => {
    const H = window.__HARNESS; H.setRenderRate(0); const R = {};
    const LINES = [
      { fac: 'the_imperial_assize', six: 'Q-ASSZ-07', top: 'Q-ASSZ-08', flag: 'assize_prefect_vacant' },
      { fac: 'the_wet_ledger',      six: 'Q-LEDG-07', top: 'Q-LEDG-08', flag: 'ledger_first_chair_vacant' },
      { fac: 'the_xul_aneekh',      six: 'Q-XULA-07', top: 'Q-XULA-08', flag: 'deepkin_speaker_vacant' },
    ];
    const rowFor = (id) => H.questOffers().find(x => x.id === id) || null;
    const flagsNow = () => { try { const f = H.questWorldFlags(); return Array.isArray(f) ? f : Object.keys(f || {}); } catch (e) { return []; } };

    // ---- A. WHICH ENDINGS VACATE THE SEAT, and what do they cost? -------------------------
    R.endings = [];
    for (const L of LINES) {
      R.harness_exposes_resolutions = Object.prototype.hasOwnProperty.call(H.questDef(L.six), 'resolutions');
      const rows = (AUTHORED[L.six] || []).map((res) => {
        let need = null; try { need = H.questResolutionRequirements(L.six, res.id); } catch (e) { need = { err: String(e).slice(0, 90) }; }
        return { id: res.id, method: res.method, violence: !!(res.violence || (need && need.violence_required)),
                 vacates: res.flags.includes(L.flag), requires_knowing: (need && need.requires_knowing) || [] };
      });
      R.endings.push({ quest: L.six, flag: L.flag, rows });
    }

    // ---- B. THE PERTURBATION. Everything else for rank 7 held fixed; only the rank-6 ------
    //         ending varies. No flag is ever poked.
    R.perturb = [];
    for (const L of LINES) {
      const armed = R.endings.find(e => e.quest === L.six);
      const vac = armed.rows.filter(x => x.vacates);
      const nonVacating = armed.rows.filter(x => !x.vacates);
      const trial = (label, resId) => {
        // fresh state each trial
        H.setCharacter({ race: 'saxhleel', upbringing: 'lukiul', class: 'ledger-hand', birthsign: 'raj-xul' });
        const sk = {}; for (const k of Object.keys(H.getSkills())) sk[k] = 100; H.setSkills(sk);
        // clear every faction flag we might be carrying by reloading quest state is not exposed;
        // instead assert the flag's absence and record it.
        H.setFactionStanding(L.fac, { member: true, reputation: 300, rank: 0 });
        const before = flagsNow().includes(L.flag);
        let applied = null, err = null, opened = null;
        if (resId) {
          // `machine.resolve()` returns {ok:false,reason:'quest not open'} for a quest that was
          // never opened — a falsy-looking success. Open it first and record BOTH returns.
          try { opened = H.questOpen(L.six); } catch (e) { err = 'open: ' + String(e).slice(0, 150); }
          try { applied = H.questResolve(L.six, resId); } catch (e) { err = (err ? err + ' | ' : '') + 'resolve: ' + String(e).slice(0, 150); }
          if (applied && applied.ok === false) {
            // satisfy what the resolution asks for, exactly as a player would, then retry once
            try { const need = H.questResolutionRequirements(L.six, resId);
              for (const rev of need.requires_knowing || []) { try { H.questReveal(L.six, rev); } catch (e2) {} }
              if (need.skills) H.setSkills(need.skills);
              if (need.disposition && H.setDisposition) { const def = H.questDef(L.six); if (def.giver) H.setDisposition(def.giver.npc_id, 100); }
              if (need.items) for (const it of need.items) { try { H.giveItem ? H.giveItem(it) : null; } catch (e2) {} }
            } catch (e2) {}
            try { applied = H.questResolve(L.six, resId); } catch (e) { err = (err ? err + ' | ' : '') + 'retry: ' + String(e).slice(0, 150); }
          }
        }
        const after = flagsNow().includes(L.flag);
        const g = H.factionGates().factions.find(x => x.id === L.fac);
        const row = rowFor(L.top);
        return { label, resolution: resId, flag_before: before, flag_after: after,
                 resolve_error: err, opened: opened, resolve_return: applied,
                 applied_ok: !!(applied && applied.ok),
                 derived_rank: g.derived_rank,
                 top_offerable: !!(row && row.offerable),
                 top_gate_unmet: row && row.gate ? row.gate.unmet : null };
      };
      const res = { faction: L.fac, trials: [] };
      res.trials.push(trial('NULL — nothing resolved at all', null));
      if (nonVacating[0]) res.trials.push(trial(`the ending the builder's walk took (${nonVacating[0].method})`, nonVacating[0].id));
      if (vac[0]) res.trials.push(trial(`an ending that vacates the seat (${vac[0].method}, violence=${vac[0].violence})`, vac[0].id));
      const nvVac = vac.find(x => !x.violence);
      if (nvVac && vac[0] && nvVac.id !== vac[0].id) res.trials.push(trial(`a NON-VIOLENT vacating ending (${nvVac.method})`, nvVac.id));
      R.perturb.push(res);
    }

    // ---- C. THE BAD BUILD, with the gate's OWN rule (best of the two favoured attributes,
    //         top two of the six favoured skills) and attributes EARNED by skill use. -------
    const cd = H.getCreationData();
    const races = Object.keys(cd.races || {}); const cls = Object.keys(cd.classes || {});
    const ups = ['lukiul', 'saxhleel-raised', 'imperial-raised', 'marsh-born'];
    const gates = H.factionGates().factions;
    const worst = {}; let n = 0;
    for (const race of races) for (const up of ups) for (const c of cls) {
      try {
        H.setCharacter({ race, upbringing: up, class: c, birthsign: 'raj-xul' });
        const a0 = { ...H.getPlayerStats().attributes }; n++;
        for (const f of gates) {
          const need = Math.max(...f.ranks.map(x => x.attribute || 0));
          const best = Math.max(...f.favoured_attributes.map(x => a0[x] ?? 0));
          // headroom the play path can add: +1 per 15 skill levels in a GOVERNING skill, and the
          // ladder's own rank-7 skill demands are 70 and 35 — so the ceiling is what the character
          // can earn by grinding its governed skills to the cap.
          const m = best - need;
          if (!worst[f.id] || m < worst[f.id].margin_at_creation)
            worst[f.id] = { margin_at_creation: m, best_at_creation: best, rank7_need: need,
                            sig: `${race}/${up}/${c}`,
                            attrs: f.favoured_attributes.map(x => `${x}=${a0[x]}`) };
        }
      } catch (e) { R.sig_err = (R.sig_err || 0) + 1; }
    }
    R.signatures = n; R.worst = worst;
    return R;
  }, AUTHORED);

  out.sections = r; out.page_errors = perr;

  for (const e of r.endings) {
    const vac = e.rows.filter(x => x.vacates);
    const nvVac = vac.filter(x => !x.violence);
    check(`E_${e.quest}_has_a_nonviolent_ending_that_vacates_the_seat`, nvVac.length > 0,
      `${e.rows.length} endings; ${vac.length} vacate ${e.flag} [${vac.map(x=>x.id+'/'+x.method+(x.violence?'/VIOLENT':'')).join(' ')}]; ${e.rows.length - vac.length} do not [${e.rows.filter(x=>!x.vacates).map(x=>x.id+'/'+x.method).join(' ')}]`);
  }
  for (const p of r.perturb) {
    const nul = p.trials[0];
    const took = p.trials.find(t => /builder/.test(t.label));
    const vacT = p.trials.find(t => /vacates the seat/.test(t.label));
    check(`P_${p.faction}_NULL_no_flag_no_rank7`, !nul.flag_after && nul.derived_rank < 7,
      `nothing resolved: flag ${nul.flag_after}, derived rank ${nul.derived_rank}, ${p.faction.replace('the_','')} top quest offerable ${nul.top_offerable}`);
    if (took) check(`P_${p.faction}_the_ending_the_walk_took_does_NOT_reach_rank7`, !took.flag_after && took.derived_rank < 7,
      `${took.label} -> ${took.resolution}: flag ${took.flag_after}, derived rank ${took.derived_rank}, unmet ${JSON.stringify(took.top_gate_unmet)}`);
    if (vacT) check(`P_${p.faction}_a_vacating_ending_DOES_reach_rank7`, vacT.flag_after && vacT.derived_rank === 7,
      `${vacT.label} -> ${vacT.resolution}: flag ${vacT.flag_after}, derived rank ${vacT.derived_rank}, top offerable ${vacT.top_offerable}, unmet ${JSON.stringify(vacT.top_gate_unmet)}`);
  }
  for (const [fid, w] of Object.entries(r.worst)) {
    check(`C_${fid}_worst_signature_creation_margin`, true,
      `worst of ${r.signatures}: ${w.sig} — ${w.attrs.join(', ')}, best ${w.best_at_creation} against rank-7 demand ${w.rank7_need}, margin at creation ${w.margin_at_creation}`);
  }
  check('page_errors_zero', perr.length === 0, `${perr.length} page errors`);
} catch (err) { out.error = String(err && err.stack || err); process.stdout.write('THREW: ' + out.error + '\n'); }
finally { if (handle) await handle.close(); }
writeJson(args.out ? String(args.out) : path.join(ROOT, 'reports', 'critic-faction-ceiling.json'), out);
const f = out.checks.filter(c => !c.ok);
process.stdout.write(`\n${out.checks.length - f.length}/${out.checks.length} checks passed\n`);
process.exit(f.length || out.error ? 1 : 0);
