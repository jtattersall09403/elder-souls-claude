#!/usr/bin/env node
// kritik-regress2.mjs — the lock and the pickpocket, driven correctly.
import { parseArgs, wantsHelp, usage, writeJson } from '../../../../../tools/lib/cli.mjs';
import { launchGame } from '../../../../../tools/lib/browser.mjs';

const args = parseArgs();
if (wantsHelp(args)) usage('kritik-regress2.mjs\n');
args.width = args.width || 320;
args.height = args.height || 240;

const h = await launchGame(args);
const R = { schema: 'elder-souls/critic-probe@1', piece: 'W1-15', round: 2, part: 'regress2', blocks: {} };
const rec = (k, v) => { R.blocks[k] = v; process.stdout.write(`--- ${k}\n${JSON.stringify(v, null, 1)}\n`); };

try {
  await h.h('setRenderRate', 0);

  const lock = await h.page.evaluate(() => {
    const H = window.__HARNESS;
    const out = {};
    const draws = () => (H.snapshot().rng || {}).draws;
    H.setSeed(1337); H.loadState('arena_flat'); H.setRenderRate(0); H.teleport(0, 0);
    H.setStealthState({ security: 60, agility: 60, picks: 12 });
    const d0 = draws();
    out.begin = H.lockBegin('archon.priest0.r0.lock');
    const log = [];
    let opened = null;
    for (let i = 0; i < 1200; i++) {
      const b = H.lockState();
      if (!b) break;
      if (b.open) { opened = i; break; }
      if (b.failed) { out.failed_at = i; break; }
      const err = Math.abs(b.delta_deg);
      if (err <= b.W_deg / 2) {
        const r = H.lockPress();
        log.push({ f: i, delta: b.delta_deg, W: b.W_deg, set_before: b.set, res: r });
      }
      H.stepFrames(1);
    }
    out.opened_at_frame = opened;
    out.presses = log;
    out.final = H.lockState();
    out.draws_before = d0; out.draws_after = draws(); out.draws_delta = draws() - d0;
    // authored ward angles: the chi-square population
    return out;
  });
  rec('B26-lock-live', lock);

  const pp = await h.page.evaluate(() => {
    const H = window.__HARNESS;
    const out = { rows: [] };
    const draws = () => (H.snapshot().rng || {}).draws;
    for (const sneak of [5, 50, 100]) {
      let caught = 0, ok = 0, drawsUsed = 0, err = null;
      for (let seed = 1; seed <= 60; seed++) {
        H.setSeed(seed); H.loadState('arena_flat'); H.setRenderRate(0); H.teleport(0, 0);
        H.setStealthState({ sneak, agility: 40, load: 'light', crouched: true });
        H.stepFrames(1);
        const d0 = draws();
        try {
          H.pickpocketBegin({ dist: 1.0, bearingDeg: 180, targetCivState: 'CALM', moving: false, crouched: true, item_weight: 0.4 });
        } catch (e) { err = String(e.message || e); break; }
        H.queueInputs([{ f: H.getFrame(), press: ['interact'] }, { f: H.getFrame() + 250, release: ['interact'] }]);
        H.stepFrames(240);
        drawsUsed += draws() - d0;
        const ev = H.drainStealthEvents().filter((e) => e.type === 'pickpocket' || e.type === 'crime' || e.type === 'witness');
        if (ev.some((e) => e.caught || e.noticed)) caught++; else ok++;
      }
      out.rows.push({ sneak, caught_of_60: caught, clean: ok, rng_draws_total: drawsUsed, error: err });
      if (err) break;
    }
    return out;
  });
  rec('B27-pickpocket', pp);

  rec('page_errors', h.errors);
} finally {
  if (args.json) writeJson(String(args.json), R);
  await h.close();
}
