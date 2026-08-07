#!/usr/bin/env node
// critic-faction-arbitration.mjs — CRITIC-WRITTEN (W1-FACTIONS r1). Declared under
// method_deviations in corpus/90-verdicts/wave1/W1-FACTIONS-r1.md.
//
// Four things the builder's own faction-probe.mjs cannot answer, all in ONE browser:
//
//  A. ARBITRATION. Is faction reputation 112 reachable in the RUNNING engine, and does
//     Q-*-08 become offerable at it? The faction builder says yes; build-viability.mjs
//     says the ceiling is 100 and viability is 0/540. Measured here, not argued.
//  B. CONSUMPTION with a NULL CONTROL (RI-MTH07 §B.3). Perturb reputation across the
//     rank-7 boundary (111 vs 112) and across a boundary the ladder predicts NOTHING at
//     (60 vs 61) and read the offer list back out of questOffers(). coupling must be 1
//     on the real boundary and 0 on the null one.
//  C. THE BAD BUILD. Re-derive the rank ladder for the WORST signature the character
//     builder can produce, not the builder's hand-picked saxhleel/lukiul/ledger-hand.
//  D. MUTUAL EXCLUSION, three ways: join then try the rival; take a quest that pays the
//     rival; and confirm the closure carries a SPOKEN reason rather than a silent refusal.
//
// The probe NEVER sets a rank. It writes reputation (the quantity under arbitration) and
// reads back a decision the shipped gate made.

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { launchGame } from '../lib/browser.mjs';
import { parseArgs, writeJson } from '../lib/cli.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const args = parseArgs(process.argv.slice(2));
const out = { tool: 'critic-faction-arbitration', at: new Date().toISOString(), checks: [], sections: {} };
const check = (id, ok, measured) => { out.checks.push({ id, ok: !!ok, measured });
  process.stdout.write(`  ${ok ? 'pass' : 'FAIL'}  ${id} — ${measured}\n`); };

let handle;
try {
  handle = await launchGame({ ...args, width: 320, height: 240 });
  const page = handle.page;
  const perr = [];
  page.on('pageerror', (e) => perr.push(String(e).slice(0, 200)));
  await page.waitForFunction(() => !!window.__HARNESS, null, { timeout: 60000 });

  const r = await page.evaluate(() => {
    const H = window.__HARNESS;
    H.setRenderRate(0);
    const R = {};
    const LINES = [
      { fac: 'the_imperial_assize', top: 'Q-ASSZ-08', rival: 'the_wet_ledger' },
      { fac: 'the_wet_ledger',      top: 'Q-LEDG-08', rival: 'the_imperial_assize' },
      { fac: 'the_xul_aneekh',      top: 'Q-XULA-08', rival: 'the_wet_ledger' },
    ];
    const offers = () => H.questOffers();
    const offerable = () => offers().filter(x => x.offerable).map(x => x.id);
    const rowFor = (id) => offers().find(x => x.id === id) || null;

    // --------------------------------------------------------------------------------------
    // Grant a maximal sheet so the ONLY thing under test is reputation. Skills/attributes are
    // written directly here on purpose: this probe is not measuring whether a build can reach
    // them (that is section C), it is isolating the reputation term the arbitration is about.
    // --------------------------------------------------------------------------------------
    H.setCharacter({ race: 'saxhleel', upbringing: 'lukiul', class: 'ledger-hand', birthsign: 'raj-xul' });
    const allSkills = {}; for (const k of Object.keys(H.getSkills())) allSkills[k] = 100;
    H.setSkills(allSkills);
    R.attrs_after_max_skills = { ...H.getPlayerStats().attributes };

    // world_state terms the top ranks ask for
    const gatesNow = H.factionGates();
    const flagsWanted = new Set();
    for (const f of gatesNow.factions) for (const rk of f.ranks)
      { const w = rk.world_state; if (typeof w === 'string' && w) flagsWanted.add(w);
        else if (Array.isArray(w)) for (const x of w) flagsWanted.add(x); }
    R.world_flags_poked = [...flagsWanted];
    for (const f of flagsWanted) { try { H.questSetFlag(f, true); } catch (e) {} }

    // --------------------------------------------------------------------------------------
    // A + B. The reputation sweep, per line, reading DERIVED RANK out of the shipped ladder.
    // --------------------------------------------------------------------------------------
    R.sweep = [];
    for (const L of LINES) {
      // membership is required for heldRank(); join by the authored route if we can, else set it
      H.setFactionStanding(L.fac, { member: true, joined_by: 'critic-probe' });
      const rows = [];
      for (const rep of [0, 10, 60, 61, 90, 100, 111, 112, 130, 200, 300]) {
        H.setFactionStanding(L.fac, { member: true, reputation: rep });
        const g = H.factionGates().factions.find(x => x.id === L.fac);
        const row = rowFor(L.top);
        rows.push({ rep, derived_rank: g.derived_rank, reputation_read_back: g.reputation,
                    top_quest_offered: !!(row && row.offerable),
                    top_quest_why: row ? row.why : 'NO SUCH QUEST IN THE BOOK',
                    top_quest_gate_unmet: row && row.gate ? row.gate.unmet : null,
                    n_offerable: offerable().length });
      }
      R.sweep.push({ faction: L.fac, top: L.top, rows });
      H.setFactionStanding(L.fac, { member: false, reputation: 0 });
    }

    // --------------------------------------------------------------------------------------
    // C. THE BAD BUILD. Sweep every race x upbringing x class the creator offers, find the
    //    signature with the LOWEST favoured-attribute floor for each faction, and ask whether
    //    that character can reach rank 7 by grinding its own governed skills to the cap.
    // --------------------------------------------------------------------------------------
    const cd = H.getCreationData ? H.getCreationData() : null;
    const idsOf = (v) => !v ? [] : (Array.isArray(v) ? v.map(x => x.id || x)
                        : (Array.isArray(v.races||v.classes||v.list) ? (v.races||v.classes||v.list).map(x=>x.id||x)
                        : Object.keys(v)));
    const races = idsOf(cd && cd.races);
    const cls   = idsOf(cd && cd.classes);
    let ups = idsOf(cd && (cd.upbringings || (cd.creation && cd.creation.upbringings)));
    if (!ups.length) ups = ['lukiul', 'saxhleel-raised', 'imperial-raised', 'marsh-born'];
    R.creation_raw = { races, ups, cls };
    R.creation = { races: races.length, upbringings: ups.length, classes: cls.length };
    if (!races.length || !cls.length) { R.creation_ABORT = 'creation data unreadable — section C not run'; }
    const gates = H.factionGates().factions;
    const worst = {};
    let n = 0;
    for (const race of races) for (const up of ups) for (const c of cls) {
      try {
      H.setCharacter({ race, upbringing: up, class: c, birthsign: 'raj-xul' });
      const sk = {}; for (const k of Object.keys(H.getSkills())) sk[k] = 100;
      H.setSkills(sk);                      // every skill at the cap = the BEST attributes reachable
      const a = H.getPlayerStats().attributes; n++;
      for (const f of gates) {
        const need = Math.max(...f.ranks.map(r => r.attribute || 0));
        const have = Math.min(...f.favoured_attributes.map(x => a[x] ?? 0));
        const margin = have - need;
        if (!worst[f.id] || margin < worst[f.id].margin)
          worst[f.id] = { margin, have, need, sig: `${race}/${up}/${c}`, attrs: f.favoured_attributes.map(x => `${x}=${a[x]}`) };
      }
      } catch (err) { R.sig_errors = (R.sig_errors||0)+1; }
    }
    R.signatures_swept = n;
    R.worst_signature_per_faction = worst;

    // --------------------------------------------------------------------------------------
    // D. MUTUAL EXCLUSION, in the running gate.
    // --------------------------------------------------------------------------------------
    H.setCharacter({ race: 'saxhleel', upbringing: 'lukiul', class: 'ledger-hand', birthsign: 'raj-xul' });
    const sk2 = {}; for (const k of Object.keys(H.getSkills())) sk2[k] = 100; H.setSkills(sk2);
    for (const f of flagsWanted) { try { H.questSetFlag(f, true); } catch (e) {} }
    const excl = {};
    // (1) join the Ledger at rank 7; does the Assize close, and with what words?
    H.setFactionStanding('the_wet_ledger',     { member: true,  reputation: 300 });
    H.setFactionStanding('the_imperial_assize',{ member: false, reputation: 0 });
    let g2 = H.factionGates();
    excl.after_joining_ledger = {
      ledger_rank: g2.factions.find(f=>f.id==='the_wet_ledger').derived_rank,
      rivalry_locked_now: g2.rivalry_locked_now,
      quests_locked_by_rivalry: g2.quests_locked_by_rivalry,
      assize_closes: (g2.factions.find(f=>f.id==='the_imperial_assize')||{}).closes,
      assize_quests_offerable: offerable().filter(id => id.startsWith('Q-ASSZ')),
      assize_rows: offers().filter(x => x.id.startsWith('Q-ASSZ')).map(x => ({ id: x.id, offerable: x.offerable, why: x.why })),
    };
    // (2) can you hold BOTH at rank 7 in one save? (the defect the builder says it fixed)
    H.setFactionStanding('the_imperial_assize',{ member: true, reputation: 300 });
    g2 = H.factionGates();
    excl.both_joined = {
      ledger_rank: g2.factions.find(f=>f.id==='the_wet_ledger').derived_rank,
      assize_rank:  g2.factions.find(f=>f.id==='the_imperial_assize').derived_rank,
      rivalry_locked_now: g2.rivalry_locked_now,
      quests_locked_by_rivalry: g2.quests_locked_by_rivalry,
      assize_offerable: offerable().filter(id => id.startsWith('Q-ASSZ')),
      ledger_offerable: offerable().filter(id => id.startsWith('Q-LEDG')),
      assize_rows: offers().filter(x => x.id.startsWith('Q-ASSZ')).map(x => ({ id: x.id, offerable: x.offerable, why: x.why })),
      rank_ceiling_declared: g2.declared_exclusivity.rank_ceiling_with_a_second_membership,
    };
    // (3) is the refusal SPOKEN? read the reason strings the gate produced.
    excl.reasons = (g2.quests_locked_by_rivalry || []).map(x => x.why);
    // (4) canJoinFaction — the authored join path
    try { excl.canJoin_assize_while_ledger = H.canJoinFaction('the_imperial_assize', 1); } catch(e){ excl.canJoin_assize_while_ledger = 'THREW: '+String(e).slice(0,120); }
    R.exclusivity = excl;

    R.page_ok = true;
    return R;
  });

  out.sections = r;
  out.page_errors = perr;

  // ---- assertions ---------------------------------------------------------------------------
  for (const s of r.sweep) {
    const at112 = s.rows.find(x => x.rep === 112);
    const at111 = s.rows.find(x => x.rep === 111);
    const at60  = s.rows.find(x => x.rep === 60);
    const at61  = s.rows.find(x => x.rep === 61);
    const at100 = s.rows.find(x => x.rep === 100);
    check(`A_${s.faction}_rank7_at_rep112`, at112.derived_rank === 7,
      `reputation 112 -> derived rank ${at112.derived_rank} (at 100 -> ${at100.derived_rank}); ${s.top} offered=${at112.top_quest_offered}`);
    check(`B_${s.faction}_coupling_on_the_real_boundary`, at111.derived_rank !== at112.derived_rank,
      `rep 111 -> rank ${at111.derived_rank}, rep 112 -> rank ${at112.derived_rank} (predicted a step; coupling = ${at112.derived_rank !== at111.derived_rank ? 1 : 0})`);
    check(`B_${s.faction}_NULL_control_no_step_at_60_61`, at60.derived_rank === at61.derived_rank,
      `rep 60 -> rank ${at60.derived_rank}, rep 61 -> rank ${at61.derived_rank} (ladder predicts no step here; a step would mean the probe, not the gate, is moving the number)`);
  }
  for (const [fid, w] of Object.entries(r.worst_signature_per_faction)) {
    check(`C_${fid}_worst_build_clears_rank7_attribute`, w.margin >= 0,
      `worst of ${r.signatures_swept} signatures is ${w.sig}: favoured attributes ${w.attrs.join(', ')} -> min ${w.have} against rank-7 demand ${w.need}, margin ${w.margin}`);
  }
  const e = r.exclusivity;
  check('D1_joining_the_ledger_closes_the_assize',
    (e.after_joining_ledger.rivalry_locked_now || []).includes('the_imperial_assize') || (e.after_joining_ledger.assize_quests_offerable || []).length === 0,
    `ledger rank ${e.after_joining_ledger.ledger_rank}; rivalry_locked_now=[${e.after_joining_ledger.rivalry_locked_now}]; Assize quests still offerable: ${e.after_joining_ledger.assize_quests_offerable.length} [${e.after_joining_ledger.assize_quests_offerable}]`);
  check('D2_cannot_hold_rank7_in_both',
    !(e.both_joined.ledger_rank === 7 && e.both_joined.assize_rank === 7),
    `with both joined at reputation 300: ledger rank ${e.both_joined.ledger_rank}, assize rank ${e.both_joined.assize_rank}; declared ceiling with a second membership = ${e.both_joined.rank_ceiling_declared}`);
  check('D3_the_closure_is_spoken', (e.reasons || []).length > 0 && e.reasons.every(w => typeof w === 'string' && w.length > 20),
    `${(e.reasons||[]).length} lockout reason(s): ${JSON.stringify((e.reasons||[]).slice(0,3))}`);
  check('page_errors_zero', perr.length === 0, `${perr.length} page errors: ${perr.slice(0,2).join(' | ')}`);
} catch (err) {
  out.error = String(err && err.stack || err);
  process.stdout.write('THREW: ' + out.error + '\n');
} finally {
  if (handle) await handle.close();
}
writeJson(args.out ? String(args.out) : path.join(ROOT, 'reports', 'critic-faction-arbitration.json'), out);
const fails = out.checks.filter(c => !c.ok);
process.stdout.write(`\n${out.checks.length - fails.length}/${out.checks.length} checks passed\n`);
process.exit(fails.length || out.error ? 1 : 0);
