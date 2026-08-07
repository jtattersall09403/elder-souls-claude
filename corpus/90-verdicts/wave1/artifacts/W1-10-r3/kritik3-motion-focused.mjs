// KRITIK3 — the moving-target reach test, focused on the classes the verdict turns on.
// AGENT-PROTOCOL.md failure mode 3: "if the thing you are measuring responds to motion, the
// target must move." Every reach instrument this piece has been graded on uses a still target.
//
//   S  static (the control — reproduces kritik-reach.mjs / connect-rate.mjs)
//   A  target walks IN at 2.0 m/s through the contact distance
//   R  target walks AWAY at 2.0 m/s through the contact distance
//   M  attacker walks forward into a still target
//
// `at_open_m` is the true separation on the frame the hitbox opened, so a miss can be told from
// a miss at a distance the probe never actually produced.
'use strict';
import fs from 'node:fs';
const ROOT = '/home/user/elder-souls-claude';
const OUT = process.argv[2] || '/dev/stdout';
const { NodeArena, loadCombatData } = await import(`${ROOT}/tools/lib/combat-node.mjs`);
const D = loadCombatData();
const WALK = 2.0 / 60;
const STEP = 0.20, LO = 0.20, HI = 4.20;

const SUBJ = ['hlb_garrison_bill', 'tsw_bog_rapier', 'whp_hide_lash', 'spr_drowned_harpoon',
  'cgs_drowned_reaper', 'ugs_golem_sword', 'ghm_bog_maul',
  'ssw_garrison_sword', 'axe_bog_cleaver', 'mce_bog_iron_mace', 'dgr_shell_knife', 'csw_naga_sickle'];

function fight(weapon, dist, regime) {
  const a = new NodeArena({ data: D, loadout: { weapon } });
  const e = a.spawn('t', 'mat_flesh', 0, dist, 180);
  e.knockbackImmune = true;
  a.lockOn('t');
  const s = D.weaponMovesets[weapon].slots['r1.1'];
  const openF = 4 + s.startup_f;
  const lead = openF * WALK;
  if (regime === 'A') e.pos[2] = dist + lead;
  if (regime === 'R') e.pos[2] = Math.max(0.10, dist - lead);
  const script = [{ f: 4, press: ['light'] }, { f: 6, press: [], release: ['light'] }];
  if (regime === 'M') script.unshift({ f: 1, move: [0, 1] });
  a.queueInputs(script);
  let hit = null, atOpen = null;
  for (let i = 1; i <= s.startup_f + s.active_f + s.recovery_f + 8; i++) {
    if (regime === 'A') e.pos[2] -= WALK;
    else if (regime === 'R') e.pos[2] += WALK;
    a.step();
    if (i === openF) atOpen = +(Math.hypot(e.pos[0] - a.player.pos[0], e.pos[2] - a.player.pos[2])).toFixed(2);
    for (const ev of a.drain()) if (ev.kind === 'IMPACT' && !hit) hit = { via: ev.via, dmg: ev.dmg };
  }
  return { hit: !!hit, via: hit ? hit.via : null, at_open_m: atOpen };
}

const out = { generated: new Date().toISOString(), instrument: 'kritik3-motion-focused.mjs (critic-authored)', step_m: STEP, weapons: {} };
for (const w of SUBJ) {
  const ms = D.weaponMovesets[w];
  const row = { class: ms.class, declared_reach_m: ms.reach_m, regimes: {} };
  for (const reg of ['S', 'A', 'R', 'M']) {
    const cells = [];
    for (let d = LO; d <= Math.min(HI, ms.reach_m + 0.6) + 1e-9; d += STEP) {
      const dd = +d.toFixed(2);
      cells.push({ d: dd, ...fight(w, dd, reg) });
    }
    const hits = cells.filter((c) => c.hit);
    // contiguity is judged over the TRUE separation at the frame the hitbox opened
    const opens = hits.map((c) => c.at_open_m).sort((a, b) => a - b);
    row.regimes[reg] = {
      cells: cells.length, hitting: hits.length,
      hit_fraction: +(hits.length / cells.length).toFixed(3),
      min_at_open_m: opens.length ? opens[0] : null,
      max_at_open_m: opens.length ? opens[opens.length - 1] : null,
      body_hits: hits.filter((c) => c.via === 'body').length,
      vector: cells.map((c) => (c.hit ? 1 : 0)).join(''),
      detail: cells,
    };
  }
  out.weapons[w] = row;
  const f = (r) => `${String(row.regimes[r].hitting).padStart(2)}/${String(row.regimes[r].cells).padEnd(2)} ${String(row.regimes[r].min_at_open_m).padStart(4)}..${String(row.regimes[r].max_at_open_m).padStart(4)}`;
  console.log(`${row.class.padEnd(4)} ${w.padEnd(22)} decl ${String(ms.reach_m).padEnd(6)} | S ${f('S')} | A ${f('A')} | R ${f('R')} | M ${f('M')}`);
}
out.summary = Object.entries(out.weapons).map(([w, r]) => ({
  weapon: w, class: r.class, declared_reach_m: r.declared_reach_m,
  S: r.regimes.S.hit_fraction, A: r.regimes.A.hit_fraction, R: r.regimes.R.hit_fraction, M: r.regimes.M.hit_fraction,
  max_reach_static_m: r.regimes.S.max_at_open_m,
  shortfall_vs_declared_m: r.regimes.S.max_at_open_m === null ? null : +(r.regimes.S.max_at_open_m - r.declared_reach_m).toFixed(2),
}));
fs.writeFileSync(OUT, JSON.stringify(out, null, 1));
console.log('\nnever lands under any regime:', out.summary.filter((x) => !x.S && !x.A && !x.R && !x.M).map((x) => x.weapon));
console.log('lands static but not when the target retreats:', out.summary.filter((x) => x.S > 0 && x.R === 0).map((x) => x.weapon));
console.log('lands static but not when the target closes  :', out.summary.filter((x) => x.S > 0 && x.A === 0).map((x) => x.weapon));
