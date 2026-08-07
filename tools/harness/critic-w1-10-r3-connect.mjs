#!/usr/bin/env node
// critic-w1-10-r3-connect.mjs — in the SHIPPING BROWSER BUILD: does the swing land?
//
// The builder's `CR` is measured in `tools/lib/combat-node.mjs`. AGENT-PROTOCOL.md forbids
// publishing a number that has only ever been seen outside the browser, so the claim that three
// weapon classes connect at 0% at their own declared spacing is re-taken here, and it is taken
// against a MOVING target as well as a still one (protocol failure mode 3).
import path from 'node:path';
import fs from 'node:fs';
import { parseArgs, wantsHelp, usage, writeJson, ensureDir } from '../lib/cli.mjs';
import { launchGame } from '../lib/browser.mjs';

const USAGE = 'critic-w1-10-r3-connect.mjs — browser connect rate, static and moving target';
const args = parseArgs();
if (wantsHelp(args)) usage(USAGE);
const outDir = args.out ? path.resolve(String(args.out)) : path.resolve('corpus/90-verdicts/wave1/artifacts/W1-10-r3');
ensureDir(outDir);

const SUBJ = ['hlb_garrison_bill', 'tsw_bog_rapier', 'whp_hide_lash', 'cgs_drowned_reaper',
  'spr_drowned_harpoon', 'ghm_bog_maul', 'ugs_golem_sword',
  'ssw_garrison_sword', 'axe_bog_cleaver', 'mce_bog_iron_mace', 'dgr_shell_knife']
  .map((id) => {
    const d = JSON.parse(fs.readFileSync(path.resolve('game/data/combat/movesets', id + '.json'), 'utf8'));
    return { id, cls: d.class, reach: d.reach_m };
  });

const handle = await launchGame({ ...args, width: args.width || 320, height: args.height || 240 });
let report;
try {
  report = await handle.page.evaluate(async (subj) => {
    const H = window.__HARNESS; await H.ready();
    H.setSeed(1337); H.setRenderRate(0);
    const rows = [], errors = [];
    for (const w of subj) {
      for (const mode of ['static', 'approach', 'retreat']) {
        const cells = [];
        for (let d = 0.30; d <= w.reach + 0.301; d += 0.20) {
          const dist = +d.toFixed(2);
          try {
            H.loadState('arena_flat'); H.setLoadout({ weapon: w.id }); H.setRenderRate(0);
            const lead = mode === 'static' ? 0 : 1.0;
            const start = mode === 'approach' ? dist + lead : mode === 'retreat' ? Math.max(0.30, dist - lead) : dist;
            const sp = H.spawn('mat_flesh', 0, start);
            const eid = sp && sp.eid ? sp.eid : (typeof sp === 'string' ? sp : (H.listEntities()[0] || {}).eid);
            H.lockOn(eid);
            H.stepFrames(3);
            H.queueInputs([{ f: 2, press: ['light'] }, { f: 4, release: ['light'] }]);
            let hp0 = null, dmg = 0;
            for (let i = 0; i < 160; i++) {
              const e = H.listEntities().find((x) => x.eid === eid);
              if (e) {
                if (hp0 === null) hp0 = e.hp;
                if (mode === 'approach') H.setEntityPos(eid, 0, Math.max(0.25, e.pos[2] - 2.0 / 60));
                if (mode === 'retreat') H.setEntityPos(eid, 0, e.pos[2] + 2.0 / 60);
              }
              H.stepFrames(1);
              const e2 = H.listEntities().find((x) => x.eid === eid);
              if (e2 && hp0 !== null) dmg = Math.max(dmg, hp0 - e2.hp);
            }
            cells.push({ d: dist, dmg: +Number(dmg).toFixed(2) });
          } catch (e) { errors.push(`${w.id}/${mode}/${dist}: ${String(e.message).slice(0, 120)}`); }
        }
        const hit = cells.filter((c) => c.dmg > 0);
        const target = +(w.reach - 0.20).toFixed(2);
        const nearest = cells.reduce((b, c) => (Math.abs(c.d - target) < Math.abs(b.d - target) ? c : b), cells[0] || { d: 0, dmg: 0 });
        rows.push({
          weapon: w.id, class: w.cls, mode, declared_reach_m: w.reach,
          cells_tested: cells.length, cells_hitting: hit.length,
          hit_fraction: cells.length ? +(hit.length / cells.length).toFixed(3) : null,
          max_hitting_distance_m: hit.length ? Math.max(...hit.map((c) => c.d)) : null,
          min_hitting_distance_m: hit.length ? Math.min(...hit.map((c) => c.d)) : null,
          damage_at_declared_reach_minus_0_20: nearest.dmg, probe_distance_m: nearest.d,
          vector: cells.map((c) => (c.dmg > 0 ? 1 : 0)).join(''),
        });
      }
    }
    return { rows, errors };
  }, SUBJ);
} finally { await handle.close(); }

report.page_errors = handle.pageErrors ? handle.pageErrors.length : null;
writeJson(path.join(outDir, 'kritik3-connect-browser.json'), report);
for (const r of report.rows) {
  console.log(`${r.class.padEnd(4)} ${r.weapon.padEnd(22)} ${r.mode.padEnd(9)} decl ${String(r.declared_reach_m).padEnd(6)} hit ${r.cells_hitting}/${r.cells_tested} max ${r.max_hitting_distance_m} dmg@reach-0.20 ${r.damage_at_declared_reach_minus_0_20} ${r.vector}`);
}
console.log('errors', report.errors.slice(0, 5), 'page_errors', report.page_errors);
