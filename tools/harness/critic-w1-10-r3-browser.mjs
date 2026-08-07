#!/usr/bin/env node
// critic-w1-10-r3-browser.mjs — W1-10 round-3 CRITIC, in the shipping browser build.
//
// Everything else this critic measures runs in `tools/lib/combat-node.mjs`, which
// AGENT-PROTOCOL.md warns "agrees with the browser for short measurements and diverges for long
// fights". So the claims that decide the verdict are re-taken here, through `window.__HARNESS`,
// in headless Chromium against the game a player would load:
//
//   A  CONSUMPTION preflight — setLoadout() every roster weapon, equipped_ok / 87.
//   B  The blade-inclination defect — for the classes the builder reports at CR 0.000 and two it
//      reports healthy, the world-space Y of the weapon tip through the ACTIVE window of a
//      horizontal sweep, read off getHitGeometry(). A `slash_h` whose blade is below the floor
//      is not a horizontal sweep, and no number in RI-WPN02 §D can see it.
//   C  Connect: does the swing damage a target at the weapon's own declared reach - 0.20 m?
//      Static AND with the target walking in, in the browser, where perception and steering run.
//   D  Screenshots of one sweep, so the animation is judged and not only tabulated.
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs, wantsHelp, usage, writeJson, ensureDir } from '../lib/cli.mjs';
import { launchGame } from '../lib/browser.mjs';

const USAGE = 'critic-w1-10-r3-browser.mjs — weapon reach, blade inclination and equip, in the browser';
const args = parseArgs();
if (wantsHelp(args)) usage(USAGE);
const outDir = args.out ? path.resolve(String(args.out)) : path.resolve('corpus/90-verdicts/wave1/artifacts/W1-10-r3');
ensureDir(outDir);
ensureDir(path.join(outDir, 'frames'));

const ROSTER = fs.readdirSync(path.resolve('game/data/combat/movesets'))
  .filter((f) => f.endsWith('.json'))
  .map((f) => JSON.parse(fs.readFileSync(path.resolve('game/data/combat/movesets', f), 'utf8')))
  .filter((d) => d.weapon_id)
  .map((d) => ({ id: d.weapon_id, cls: d.class, reach: d.reach_m, shape: d.slots['r1.1'] ? d.slots['r1.1'].shape : null }));

const handle = await launchGame({ ...args, width: args.width || 640, height: args.height || 400 });
let report = { errors: [] }, shots = {};
try {
  report = await handle.page.evaluate(async (roster) => {
    const H = window.__HARNESS; await H.ready();
    H.setSeed(1337); H.setRenderRate(0);
    const out = { equip: {}, incline: [], connect: [], errors: [] };

    // ---- A. CONSUMPTION preflight ---------------------------------------------------------
    let ok = 0; const bad = [];
    H.loadState('arena_flat');
    for (const w of roster) {
      try { H.setLoadout({ weapon: w.id }); H.stepFrames(2); ok++; }
      catch (e) { bad.push(w.id + ': ' + String(e.message).slice(0, 90)); }
    }
    out.equip = { roster: roster.length, equipped_ok: ok, failed: bad };

    // ---- B. blade inclination through a horizontal sweep -----------------------------------
    const SUBJ = ['cgs_drowned_reaper', 'hlb_garrison_bill', 'tsw_bog_rapier', 'whp_hide_lash',
      'spr_drowned_harpoon', 'ghm_bog_maul', 'ugs_golem_sword',
      'ssw_garrison_sword', 'axe_bog_cleaver', 'mce_bog_iron_mace', 'dgr_shell_knife'];
    for (const wid of SUBJ) {
      const meta = roster.find((r) => r.id === wid);
      try {
        H.loadState('arena_flat'); H.setLoadout({ weapon: wid }); H.setRenderRate(0);
        H.stepFrames(4);
        H.queueInputs([{ f: 2, press: ['light'] }, { f: 4, release: ['light'] }]);
        const act = [];
        for (let i = 0; i < 140; i++) {
          H.stepFrames(1);
          const g = H.getHitGeometry();
          const me = g.actors.find((a) => a.id === 'player') || g.actors[0];
          if (!me) continue;
          if (!me.hitbox_active) continue;
          const n = me.weapon.now;                    // [ax,ay,az, bx,by,bz]
          const root = me.pos;
          act.push({
            f: i,
            tip_y: n[4], guard_y: n[1],
            tip_r: Math.hypot(n[3] - root[0], n[5] - root[2]),
            // inclination of the blade axis (guard -> tip) against the horizontal, degrees
            incl_deg: Math.atan2(n[4] - n[1], Math.hypot(n[3] - n[0], n[5] - n[2])) * 180 / Math.PI,
          });
        }
        const tipY = act.map((a) => a.tip_y);
        const inc = act.map((a) => a.incl_deg);
        out.incline.push({
          weapon: wid, class: meta ? meta.cls : null, shape: meta ? meta.shape : null,
          declared_reach_m: meta ? meta.reach : null,
          active_frames: act.length,
          tip_y_min: tipY.length ? Math.min(...tipY) : null,
          tip_y_max: tipY.length ? Math.max(...tipY) : null,
          tip_y_below_floor_frac: tipY.length ? tipY.filter((y) => y < 0).length / tipY.length : null,
          incl_deg_mean: inc.length ? inc.reduce((a, b) => a + b, 0) / inc.length : null,
          incl_deg_min: inc.length ? Math.min(...inc) : null,
          max_tip_radius_m: act.length ? Math.max(...act.map((a) => a.tip_r)) : null,
          samples: act,
        });
      } catch (e) { out.errors.push('incline ' + wid + ': ' + String(e.message).slice(0, 180)); }
    }

    // ---- C. connect at declared reach - 0.20 m, static and with the target walking in -------
    const CONN = ['hlb_garrison_bill', 'tsw_bog_rapier', 'whp_hide_lash', 'spr_drowned_harpoon',
      'ghm_bog_maul', 'ugs_golem_sword', 'ssw_garrison_sword', 'axe_bog_cleaver'];
    for (const wid of CONN) {
      const meta = roster.find((r) => r.id === wid);
      const reach = meta ? meta.reach : 2.0;
      for (const mode of ['static', 'approach', 'retreat']) {
        try {
          H.loadState('arena_flat'); H.setLoadout({ weapon: wid }); H.setRenderRate(0);
          const target = Math.max(0.4, +(reach - 0.20).toFixed(2));
          const d0 = mode === 'approach' ? +(target + 1.0).toFixed(2)
            : mode === 'retreat' ? Math.max(0.4, +(target - 1.0).toFixed(2)) : target;
          const eid = H.spawn('mat_flesh', 0, d0);
          H.lockOn(eid);
          H.stepFrames(3);
          H.queueInputs([{ f: 2, press: ['light'] }, { f: 4, release: ['light'] }]);
          let dmg = 0, hp0 = null, closest = 99;
          for (let i = 0; i < 200; i++) {
            const ents = H.listEntities();
            const e = ents.find((x) => x.id === eid);
            if (e) {
              if (hp0 === null) hp0 = e.hp;
              if (mode === 'approach') H.setEntityPos(eid, 0, Math.max(0.30, e.pos[2] - 2.0 / 60));
              if (mode === 'retreat') H.setEntityPos(eid, 0, e.pos[2] + 2.0 / 60);
            }
            H.stepFrames(1);
            const e2 = H.listEntities().find((x) => x.id === eid);
            if (e2) { closest = Math.min(closest, Math.abs(e2.pos[2])); dmg = Math.max(dmg, hp0 - e2.hp); }
          }
          out.connect.push({ weapon: wid, class: meta ? meta.cls : null, mode, reach_m: reach, target_m: target, start_m: d0, damage: +Number(dmg).toFixed(2), closest_m: +closest.toFixed(2) });
        } catch (e) { out.errors.push('connect ' + wid + '/' + mode + ': ' + String(e.message).slice(0, 180)); }
      }
    }
    return out;
  }, ROSTER);

  // ---- D. frames of one sweep, for the animation judgement ---------------------------------
  for (const w of ['cgs_drowned_reaper', 'ssw_garrison_sword', 'hlb_garrison_bill']) {
    try {
      const frames = await handle.page.evaluate(async (weapon) => {
        const H = window.__HARNESS; await H.ready();
        H.loadState('arena_flat'); H.setLoadout({ weapon }); H.setRenderRate(0);
        H.spawn('mat_flesh', 0, 2.2);
        H.stepFrames(4);
        try { H.camera({ pos: [3.8, 1.6, -1.4], look: [0, 1.0, 0.8], fov: 55 }); } catch (e) { /* default rig */ }
        H.queueInputs([{ f: 2, press: ['light'] }, { f: 4, release: ['light'] }]);
        const imgs = [];
        for (let i = 0; i < 66; i++) {
          H.stepFrames(1);
          if (i % 6 === 0) imgs.push({ f: i, png: await H.screenshot() });
        }
        return imgs;
      }, w);
      shots[w] = frames;
    } catch (e) { report.errors.push('shots ' + w + ': ' + String(e.message).slice(0, 180)); }
  }
} finally {
  await handle.close();
}

for (const [w, frames] of Object.entries(shots)) {
  for (const fr of frames) {
    const b64 = String(fr.png).replace(/^data:image\/png;base64,/, '');
    fs.writeFileSync(path.join(outDir, 'frames', `${w}-f${String(fr.f).padStart(3, '0')}.png`), Buffer.from(b64, 'base64'));
  }
}
report.page_errors = handle.pageErrors ? handle.pageErrors.length : null;
report.page_error_sample = handle.pageErrors ? handle.pageErrors.slice(0, 5) : null;
// keep the artifact readable: the per-frame samples go to a sidecar
const samples = {};
for (const r of report.incline || []) { samples[r.weapon] = r.samples; delete r.samples; }
writeJson(path.join(outDir, 'kritik3-browser.json'), report);
writeJson(path.join(outDir, 'kritik3-browser-samples.json'), samples);
console.log('equipped_ok', report.equip && report.equip.equipped_ok, '/', report.equip && report.equip.roster,
  'failed', report.equip && report.equip.failed.length);
for (const r of report.incline || []) {
  console.log(`incline ${r.class} ${r.weapon.padEnd(24)} shape=${r.shape} active=${r.active_frames} tip_y ${Number(r.tip_y_min).toFixed(2)}..${Number(r.tip_y_max).toFixed(2)} below_floor ${(r.tip_y_below_floor_frac * 100).toFixed(0)}% incl_mean ${Number(r.incl_deg_mean).toFixed(1)}deg max_tip_r ${Number(r.max_tip_radius_m).toFixed(2)} vs decl ${r.declared_reach_m}`);
}
for (const c of report.connect || []) console.log(`connect ${c.class} ${c.weapon.padEnd(22)} ${c.mode.padEnd(9)} target ${c.target_m} dmg ${c.damage} closest ${c.closest_m}`);
console.log('errors', (report.errors || []).slice(0, 8));
console.log('page_errors', report.page_errors);
