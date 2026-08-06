#!/usr/bin/env node
// cmb-probe.mjs — the W1-09 instrument. Drives window.__HARNESS directly and produces the
// censuses and probes the RI-CMB items' comparison methods ask for.
//
// Every probe prints OBSERVED numbers read back out of a real run and diffs them against the
// DECLARED numbers in game/data/combat/*.json (which transcribe the corpus). A probe that
// cannot run says so and exits non-zero: RI-MTH04 voids a verdict, and a builder's claim, that
// cannot show a real run.
//
//   node tools/harness/cmb-probe.mjs --probe roll        # RI-CMB01 M1, all four tiers
//   node tools/harness/cmb-probe.mjs --probe iframe      # RI-CMB01 M2, the boundary probe
//   node tools/harness/cmb-probe.mjs --probe frames      # RI-CMB02 M1, all 14 rows
//   node tools/harness/cmb-probe.mjs --probe commit      # RI-CMB02 M2, the commitment grid
//   node tools/harness/cmb-probe.mjs --probe stamina     # RI-CMB03 M1/M2/M3/M6, RI-CMB09
//   node tools/harness/cmb-probe.mjs --probe block       # RI-CMB03 M4/M5
//   node tools/harness/cmb-probe.mjs --probe geometry    # RI-CMB04 M1/M2/M3
//   node tools/harness/cmb-probe.mjs --probe lockon      # RI-CMB06 M1/M2/M3 + directional
//   node tools/harness/cmb-probe.mjs --probe parley      # ARBITRATION §1 / S13
//   node tools/harness/cmb-probe.mjs --probe all
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs, wantsHelp, usage, log, EXIT, REPO_ROOT } from '../lib/cli.mjs';
import { launchGame, requireMethods } from '../lib/browser.mjs';

const USAGE = `
cmb-probe.mjs — W1-09 combat measurement probes.

  --probe <name|all>   roll iframe frames commit stamina block geometry lockon parley
  --out <path>         write the full JSON result here
  --json               print JSON instead of the human table
`;

const args = parseArgs();
if (wantsHelp(args)) usage(USAGE);
const which = String(args.probe || 'all');
const handle = await launchGame(args);
handle.page.on('console', (m) => { if (String(m.text()).startsWith('[probe]')) log(m.text()); });
await requireMethods(handle, ['setSeed', 'loadState', 'stepFrames', 'queueInputs', 'getCombatState', 'getHitGeometry', 'setEquipLoad', 'queueEnemyScript', 'setWorldKnowledge']);

const PROBES = ['roll', 'iframe', 'frames', 'commit', 'stamina', 'block', 'geometry', 'lockon', 'parley'];
const run = which === 'all' ? PROBES : [which];
const out = { schema: 'elder-souls/cmb-probe@1', unit: 'f@60', generated: new Date().toISOString(), probes: {} };

for (const p of run) {
  log(`probe: ${p}`);
  out.probes[p] = await handle.page.evaluate(runProbe, p);
  if (out.probes[p] && out.probes[p].__err) {
    console.error(`probe ${p} FAILED: ${out.probes[p].__err}\n${out.probes[p].__stack || ''}`);
    process.exitCode = EXIT.HARNESS_ERROR;
  }
}
await handle.close();

const dest = args.out ? path.resolve(String(args.out)) : path.join(REPO_ROOT, 'reports', 'w1-09', `cmb-probe-${which}.json`);
fs.mkdirSync(path.dirname(dest), { recursive: true });
fs.writeFileSync(dest, JSON.stringify(out, null, 2) + '\n');

if (args.json) process.stdout.write(JSON.stringify(out, null, 2) + '\n');
else process.stdout.write(render(out) + `\n\nwritten: ${path.relative(REPO_ROOT, dest)}\n`);

// ============================================================================================
// Everything below runs IN THE PAGE.
// ============================================================================================
function runProbe(name) {
  const H = window.__HARNESS;
  const R = {};
  const reset = (state, seed) => { H.setSeed(seed === undefined ? 1337 : seed); H.loadState(state || 'arena_flat'); };
  const step = (n) => H.stepFrames(n);
  const cs = () => H.getCombatState();
  const q = (script) => H.queueInputs(script);
  const mark = (s) => console.log('[probe] ' + s);

  /** Press a button on relative frame f, release 2 frames later. */
  const tap = (f, b) => ([{ f, press: [b] }, { f: f + 2, release: [b] }]);

  /** Run until the player is ACTIONABLE again, sampling per frame. Returns the samples. */
  function sampleFor(n, extract) {
    const rows = [];
    for (let i = 0; i < n; i++) { step(1); rows.push(extract(cs(), i + 1)); }
    return rows;
  }

  try {
    switch (name) {

      // ---- RI-CMB01 M1: animation census over the four tiers ----------------------------
      case 'roll': {
        const tiers = [['LIGHT', 15], ['MEDIUM', 50], ['HEAVY', 85], ['OVERLOADED', 120]];
        R.rows = [];
        for (const [tier, load] of tiers) {
          for (const kind of ['roll', 'backstep']) {
            reset('arena_flat');
            H.setEquipLoad(load);
            step(10);
            // roll = stick held; backstep = no stick
            const script = kind === 'roll'
              ? [{ f: 0, move: [0, 1] }, { f: 1, press: ['roll'] }, { f: 3, release: ['roll'] }]
              : [{ f: 0, move: [0, 0] }, { f: 1, press: ['roll'] }, { f: 3, release: ['roll'] }];
            q(script);
            step(1);                                   // f0: stick set
            const before = cs();
            step(1);                                   // f1: PRESS -> anim_frame must be 1
            const s1 = cs();
            const seq = [{ f: 1, state: s1.player.state, af: s1.player.anim_frame, iv: s1.player.invuln, stam: s1.player.stamina }];
            let f = 1;
            const startPos = s1.player.pos.slice();
            let total = null;
            const perFrame = [];
            while (f < 200) {
              step(1); f++;
              const c = cs();
              seq.push({ f, state: c.player.state, af: c.player.anim_frame, iv: c.player.invuln });
              perFrame.push(c.player.pos.slice());
              if (!c.player.move) { total = f - 1; break; }
            }
            const invulnFrames = seq.filter((x) => x.iv).map((x) => x.af);
            const runs = contiguous(invulnFrames);
            const endPos = perFrame.length ? perFrame[perFrame.length - 1] : startPos;
            const declared = window.__ES_ROLLDATA ? null : null;
            R.rows.push({
              tier, kind,
              press_to_anim_frame_1: s1.player.anim_frame,      // RI-CMB11: must be exactly 1
              stamina_before: before.player.stamina,
              stamina_after_press: s1.player.stamina,
              stamina_cost: +(before.player.stamina - s1.player.stamina).toFixed(2),
              startup: invulnFrames.length ? invulnFrames[0] - 1 : null,
              iframes: invulnFrames.length,
              iframe_window: invulnFrames.length ? [invulnFrames[0], invulnFrames[invulnFrames.length - 1]] : null,
              contiguous_runs: runs.length,
              total,
              recovery: total !== null && invulnFrames.length ? total - invulnFrames[invulnFrames.length - 1] : null,
              distance_m: +Math.hypot(endPos[0] - startPos[0], endPos[2] - startPos[2]).toFixed(3),
              per_frame_delta: perFrame.map((p, i) => +Math.hypot(
                p[0] - (i === 0 ? startPos[0] : perFrame[i - 1][0]),
                p[2] - (i === 0 ? startPos[2] : perFrame[i - 1][2])).toFixed(4)),
            });
          }
        }
        // 8-direction invariance (RI-CMB01 M1: total must not vary across directions)
        R.directions = [];
        for (let d = 0; d < 8; d++) {
          const a = d * Math.PI / 4;
          reset('arena_flat'); H.setEquipLoad(15); step(10);
          q([{ f: 0, move: [+Math.sin(a).toFixed(4), +Math.cos(a).toFixed(4)] }, { f: 1, press: ['roll'] }, { f: 3, release: ['roll'] }]);
          step(2);
          const p0 = cs().player.pos.slice();
          let f = 1, total = null;
          while (f < 200) { step(1); f++; if (!cs().player.move) { total = f - 1; break; } }
          const p1 = cs().player.pos.slice();
          R.directions.push({ dir_deg: Math.round(d * 45), total, distance_m: +Math.hypot(p1[0] - p0[0], p1[2] - p0[2]).toFixed(3) });
        }
        // RI-CMB01 M5: the cliff must be at exactly 30.00 and 70.00, with no interpolation
        R.cliff = [];
        for (const load of [29.0, 29.9, 30.0, 30.01, 30.1, 31.0, 69.0, 69.9, 70.0, 70.01, 70.1, 71.0, 99.9, 100.0, 100.01]) {
          reset('arena_flat'); H.setEquipLoad(load); step(4);
          q([{ f: 0, move: [0, 1] }, { f: 1, press: ['roll'] }, { f: 3, release: ['roll'] }]);
          step(2);
          let iv = 0, f = 1, total = null;
          while (f < 200) { const c = cs(); if (c.player.invuln) iv++; step(1); f++; if (!cs().player.move) { total = f - 1; break; } }
          R.cliff.push({ load, tier: cs().player.tier, iframes: iv, total });
        }
        return R;
      }

      // ---- RI-CMB01 M2: the i-frame boundary probe ---------------------------------------
      case 'iframe': {
        R.tiers = {};
        for (const [tier, load, span] of [['LIGHT', 15, 70], ['MEDIUM', 50, 78], ['HEAVY', 85, 100]]) {
          const H_vec = [];
          for (let k = -6; k <= span; k++) {
            reset('arena_duel');
            H.setEquipLoad(load);
            H.lockOn('E1');
            step(10);
            const base = 20;
            // The enemy's 1-frame threat: a thrust whose ACTIVE frames start at press+k.
            // startup 54, active 8 -> to make active frame 1 land on `base+k` we schedule
            // the attack at base + k - 54.
            const atk = base + k - 54;
            if (atk >= 0) H.queueEnemyScript('E1', [{ f: atk, move: 'thrust' }]);
            q([{ f: 0, move: [0, 1] }, { f: base, press: ['roll'] }, { f: base + 2, release: ['roll'] }]);
            let hit = false, negated = false;
            const hp0 = cs().player.hp;
            for (let i = 0; i < base + 130; i++) {
              step(1);
              const c = cs();
              if (c.player.hp < hp0) hit = true;
            }
            H_vec.push({ k, hit: hit ? 1 : 0 });
          }
          R.tiers[tier] = H_vec;
        }
        return R;
      }

      // ---- RI-CMB02 M1: frame census for all 7 classes x R1/R2 ---------------------------
      case 'frames': {
        R.rows = [];
        const classes = ['dagger', 'straight-sword', 'spear', 'axe', 'halberd', 'greatsword', 'ultra-greatsword'];
        for (const w of classes) {
          mark('frames ' + w);
          for (const mv of ['light', 'heavy']) {
            reset('arena_flat');
            H.loadState({ state: 'arena_flat' });
            // rebuild with this weapon
            H.setWorldKnowledge({});
            const ok = setWeapon(w);
            if (!ok) { R.rows.push({ weapon: w, move: mv, error: 'could not equip' }); continue; }
            step(6);
            q([{ f: 1, press: [mv === 'light' ? 'light' : 'heavy'] }, { f: 3, release: [mv === 'light' ? 'light' : 'heavy'] }]);
            step(1);
            const before = cs();
            step(1);
            const s1 = cs();
            let f = 1, total = null;
            let firstActive = null, lastActive = null;
            const p0 = s1.player.pos.slice();
            const seq = [];
            while (f < 320) {
              const c = cs();
              const g = H.getHitGeometry();
              const me = g.actors.find((a) => a.id === 'P');
              if (me.hitbox_active) { if (firstActive === null) firstActive = c.player.anim_frame; lastActive = c.player.anim_frame; }
              seq.push({ af: c.player.anim_frame, st: c.player.state, hb: me.hitbox_active });
              step(1); f++;
              if (!cs().player.move) { total = f - 1; break; }
            }
            const p1 = cs().player.pos.slice();
            R.rows.push({
              weapon: w, move: mv,
              press_to_anim_frame_1: s1.player.anim_frame,
              startup: firstActive !== null ? firstActive - 1 : null,
              Ps: firstActive,
              active: firstActive !== null ? lastActive - firstActive + 1 : 0,
              recovery: total !== null && firstActive !== null ? total - lastActive : null,
              total,
              stamina_cost: +(before.player.stamina - s1.player.stamina).toFixed(2),
              root_dz_m: +Math.hypot(p1[0] - p0[0], p1[2] - p0[2]).toFixed(3),
              contiguous_active: contiguous(seq.filter((x) => x.hb).map((x) => x.af)).length,
            });
          }
        }
        return R;
      }

      // ---- RI-CMB02 M2: the commitment grid ---------------------------------------------
      case 'commit': {
        const actions = ['roll', 'light', 'block', 'sprint', 'use_item', 'parry'];
        const grid = {};
        // straight sword R1: startup 24, active 10, recovery 40, total 74
        for (const a of actions) {
          const row = [];
          for (let k = 1; k <= 74; k++) {
            reset('arena_flat'); step(6);
            q([{ f: 1, press: ['light'] }, { f: 3, release: ['light'] },
              { f: 1 + k, press: [a] }, { f: 3 + k, release: [a] }]);
            step(1);
            let f = 0, actionableAt = null, executed = null;
            while (f < 260) {
              step(1); f++;
              const c = cs();
              if (c.player.move && c.player.move.id !== 'light' && c.player.move.id.indexOf('light') !== 0 && executed === null) {
                executed = { at: f, id: c.player.move.id };
              }
              if (!c.player.move && actionableAt === null && f > 2) { actionableAt = f; if (executed) break; }
              if (actionableAt !== null && f > actionableAt + 12) break;
            }
            const cancelled = executed && executed.at <= 74;
            row.push(cancelled ? 'C' : executed ? 'B' : '.');
          }
          grid[a] = row.join('');
        }
        R.grid = grid;
        R.legend = { '.': 'ignored (dropped)', B: 'buffered — executed after the animation', C: 'CANCELLED the animation' };
        R.expected = {
          hard_until: 58,
          dodge_cancel_from: 59,
          buffer_from: 67,
          note: 'straight sword R1: startup 24 + active 10 + ceil(0.45*40)=18 -> hard through anim frame 52 of the RECOVERY numbering, which is 24+10+18 = 52 of 74. Dodge-cancel 53..74. Buffer = last 8 = 67..74.',
        };
        return R;
      }

      // ---- RI-CMB03 M1/M2/M3/M6 + RI-CMB09 -----------------------------------------------
      case 'stamina': {
        // M1 regeneration curve
        reset('arena_flat'); step(6);
        q([{ f: 0, move: [0, 1] }, { f: 1, press: ['roll'] }, { f: 3, release: ['roll'] }, { f: 5, move: [0, 0] }]);
        step(2);
        const curve = [];
        for (let i = 0; i < 260; i++) { step(1); curve.push(+cs().player.stamina.toFixed(3)); }
        let resume = null;
        for (let i = 1; i < curve.length; i++) if (curve[i] > curve[i - 1]) { resume = i + 1; break; }
        R.regen = {
          curve_first_120: curve.slice(0, 120),
          first_increase_at_frame_after_spend: resume,
          slope: resume !== null ? +(curve[resume + 30] - curve[resume + 10]).toFixed(4) / 20 : null,
          slope_per_frame: resume !== null ? +((curve[resume + 40] - curve[resume + 5]) / 35).toFixed(4) : null,
        };

        // M2 delay re-arming: three rolls 20 frames apart
        reset('arena_flat'); step(6);
        q([{ f: 0, move: [0, 1] },
          { f: 1, press: ['roll'] }, { f: 3, release: ['roll'] },
          { f: 55, press: ['roll'] }, { f: 57, release: ['roll'] },
          { f: 109, press: ['roll'] }, { f: 111, release: ['roll'] }]);
        const c2 = [];
        for (let i = 0; i < 260; i++) { step(1); c2.push(+cs().player.stamina.toFixed(3)); }
        let firstRise = null;
        for (let i = 1; i < c2.length; i++) if (c2[i] > c2[i - 1]) { firstRise = i; break; }
        R.rearm = { last_spend_at_frame: 110, first_regen_frame: firstRise, samples: c2.slice(100, 170) };

        // RI-CMB09 §3 roll-spam arithmetic + RI-CMB09 M5 exhaustion
        reset('arena_flat'); step(6);
        const spam = [];
        for (let i = 0; i < 40; i++) spam.push({ f: i * 4, press: ['roll'] }, { f: i * 4 + 2, release: ['roll'] });
        spam.unshift({ f: 0, move: [0, 1] });
        q(spam);
        const rolls = [];
        let drops = 0, exEnter = 0, exExit = 0, minStam = 999, zeroFrames = 0;
        let prevMove = null, firstDenial = null;
        for (let i = 1; i <= 700; i++) {
          step(1);
          const c = cs();
          const st = c.player;
          if (st.move && st.move.id === 'roll' && prevMove !== 'roll') rolls.push(i);
          prevMove = st.move ? st.move.id : null;
          if (st.stamina < minStam) minStam = st.stamina;
          if (st.stamina === 0) zeroFrames++;
          if (st.stamina_drops > drops) { drops = st.stamina_drops; if (firstDenial === null) firstDenial = i; }
          if (st.exhausted) exEnter = Math.max(exEnter, 1);
        }
        R.rollspam = {
          rolls_started: rolls.length,
          roll_start_frames: rolls.slice(0, 10),
          cadence_f: rolls.length > 1 ? rolls[1] - rolls[0] : null,
          rolls_before_first_denial: rolls.filter((f) => firstDenial === null || f < firstDenial).length,
          first_denial_frame: firstDenial,
          inputs_dropped_no_stamina: drops,
          stamina_min: +minStam.toFixed(2),
          frames_at_zero: zeroFrames,
          entered_exhausted: !!exEnter,
        };

        // M6 zero-stamina gate: free actions must stay free
        const at0 = cs();
        reset('arena_flat'); step(4);
        q([{ f: 0, move: [0, 1] }].concat(
          Array.from({ length: 8 }, (_, i) => [{ f: 1 + i * 4, press: ['roll'] }, { f: 3 + i * 4, release: ['roll'] }]).flat()));
        for (let i = 0; i < 300; i++) step(1);
        const drained = cs();
        q([{ f: 1, move: [0.4, 0.4] }]);
        const before = cs().player.pos.slice();
        for (let i = 0; i < 30; i++) step(1);
        const after = cs().player.pos.slice();
        R.zero_gate = {
          stamina: drained.player.stamina,
          exhausted: drained.player.exhausted,
          walked_m: +Math.hypot(after[0] - before[0], after[2] - before[2]).toFixed(3),
          walking_is_free: Math.hypot(after[0] - before[0], after[2] - before[2]) > 0.2,
        };
        return R;
      }

      // ---- RI-CMB03 M4/M5: block formula and guard break ---------------------------------
      case 'block': {
        R.blocks = [];
        for (const shield of ['chitin_buckler', 'marsh_oak_medium', 'naga_tower']) {
          reset('arena_duel');
          H.loadState({ state: 'arena_duel' });
          if (!setShield(shield)) { R.blocks.push({ shield, error: 'could not equip' }); continue; }
          H.lockOn('E1');
          H.queueEnemyScript('E1', [{ f: 10, move: 'chop' }]);
          q([{ f: 0, press: ['block'] }]);
          const s0 = cs();
          let ev = null;
          for (let i = 0; i < 180; i++) {
            step(1);
            const g = window.__LASTEV || null;
            const c = cs();
            if (c.player.hp < s0.player.hp || c.player.stamina < s0.player.stamina - 0.1) { ev = { frame: i, hp: c.player.hp, stam: c.player.stamina }; break; }
          }
          const c = cs();
          R.blocks.push({
            shield,
            hp_before: s0.player.hp, hp_after: c.player.hp, chip: +(s0.player.hp - c.player.hp).toFixed(2),
            stam_before: s0.player.stamina, stam_after: c.player.stamina,
            stam_cost: +(s0.player.stamina - c.player.stamina).toFixed(2),
            state: c.player.state,
          });
        }
        // M5 guard break: start with just too little stamina
        reset('arena_duel');
        setShield('marsh_oak_medium');
        H.lockOn('E1');
        H.queueEnemyScript('E1', [{ f: 30, move: 'chop' }]);
        // spend down to below the block cost: chop = 0.80 * 120 = 96 dmg; cost = 96*(1-0.62) = 36.48
        q([{ f: 0, move: [0, 1] }, { f: 1, press: ['roll'] }, { f: 3, release: ['roll'] },
          { f: 53, press: ['roll'] }, { f: 55, release: ['roll'] },
          { f: 106, press: ['roll'] }, { f: 108, release: ['roll'] },
          { f: 160, move: [0, 0] }, { f: 162, press: ['block'] }]);
        const gb = { states: [] };
        for (let i = 0; i < 320; i++) {
          step(1);
          const c = cs();
          gb.states.push({ f: i, st: c.player.state, stam: c.player.stamina, hp: c.player.hp });
        }
        const gbFrames = gb.states.filter((x) => x.st === 'GUARD_BREAK');
        R.guard_break = {
          occurred: gbFrames.length > 0,
          frames: gbFrames.length,
          first_at: gbFrames.length ? gbFrames[0].f : null,
          stamina_at_break: gbFrames.length ? gbFrames[0].stam : null,
          never_negative: gb.states.every((x) => x.stam >= 0),
        };
        return R;
      }

      // ---- RI-CMB04 M1/M2/M3: bone attachment, tunnelling, boundary ----------------------
      case 'geometry': {
        // M1: hurtbox capsule midpoint vs its parent bone origin, across a big pose excursion
        reset('arena_flat'); step(4);
        q([{ f: 0, move: [0, 1] }, { f: 1, press: ['roll'] }, { f: 3, release: ['roll'] }]);
        step(2);
        const drift = {};
        const moved = {};
        let prev = null;
        for (let i = 0; i < 52; i++) {
          const g = H.getHitGeometry();
          const me = g.actors.find((a) => a.id === 'P');
          const bones = {}; for (const b of me.bones) bones[b.id] = b.o;
          for (const h of me.hurtboxes) {
            const mid = [(h.a[0] + h.b[0]) / 2, (h.a[1] + h.b[1]) / 2, (h.a[2] + h.b[2]) / 2];
            const o = bones[h.parent_bone];
            const d = Math.hypot(mid[0] - o[0], mid[1] - o[1], mid[2] - o[2]);
            (drift[h.id] = drift[h.id] || []).push(+d.toFixed(6));
            if (prev && prev[h.id]) {
              const pm = prev[h.id];
              moved[h.id] = (moved[h.id] || 0) + Math.hypot(mid[0] - pm[0], mid[1] - pm[1], mid[2] - pm[2]);
            }
            (prev = prev || {})[h.id] = mid;
          }
          step(1);
        }
        R.bone_attachment = Object.keys(drift).map((id) => ({
          hurtbox: id,
          midpoint_to_bone_origin_min: Math.min(...drift[id]),
          midpoint_to_bone_origin_max: Math.max(...drift[id]),
          variation: +(Math.max(...drift[id]) - Math.min(...drift[id])).toFixed(8),
          total_world_travel_m: +(moved[id] || 0).toFixed(3),
        }));

        // M2/M3: lateral offset sweep against a static target. Hit or miss BY GEOMETRY.
        R.lateral = [];
        for (let off = 0.0; off <= 1.60001; off += 0.05) {
          reset('arena_flat');
          H.spawn('dummy_passive', +off.toFixed(3), 1.7, { as: 'T' });
          step(6);
          q([{ f: 1, press: ['light'] }, { f: 3, release: ['light'] }]);
          let hit = false, minGap = 99;
          for (let i = 0; i < 90; i++) {
            step(1);
            const g = H.getHitGeometry();
            const me = g.actors.find((a) => a.id === 'P');
            const t = g.actors.find((a) => a.id === 'T');
            if (!t) break;
            if (me.hitbox_active) {
              const gap = sweptGap(me.weapon, t.hurtboxes);
              if (gap < minGap) minGap = gap;
            }
            const c = cs();
            const e = c.enemies.find((x) => x.id === 'T');
            if (e && e.hp < 99999) hit = true;
          }
          R.lateral.push({ offset_m: +off.toFixed(3), hit, min_swept_gap_m: +minGap.toFixed(4) });
        }
        // find the crossing
        let cross = null;
        for (let i = 1; i < R.lateral.length; i++) {
          if (R.lateral[i - 1].hit && !R.lateral[i].hit) { cross = { last_hit_m: R.lateral[i - 1].offset_m, first_miss_m: R.lateral[i].offset_m }; break; }
        }
        R.boundary = cross;

        // substep decorativeness check: how far does the weapon capsule travel per frame?
        reset('arena_flat'); step(4);
        q([{ f: 1, press: ['light'] }, { f: 3, release: ['light'] }]);
        step(2);
        const travel = [];
        for (let i = 0; i < 74; i++) {
          const g = H.getHitGeometry();
          const me = g.actors.find((a) => a.id === 'P');
          const n = me.weapon.now, p = me.weapon.prev;
          travel.push({
            af: me.anim_frame,
            tip_travel_m: +Math.hypot(n[3] - p[3], n[4] - p[4], n[5] - p[5]).toFixed(4),
            active: me.hitbox_active,
          });
          step(1);
        }
        R.tip_travel = travel;
        R.tip_travel_peak_active = Math.max(...travel.filter((t) => t.active).map((t) => t.tip_travel_m));
        return R;
      }

      // ---- RI-CMB06: acquisition, hysteresis, directional --------------------------------
      case 'lockon': {
        // directional roll under lock: does a left roll CIRCLE the target?
        R.directional = [];
        for (const [label, mx, my] of [['forward', 0, 1], ['left', -1, 0], ['right', 1, 0], ['back', 0, -1], ['diag_fl', -0.7071, 0.7071]]) {
          reset('arena_duel');
          H.lockOn('E1');
          step(8);
          const t = cs().enemies.find((e) => e.id === 'E1');
          const p0 = cs().player.pos.slice();
          const d0 = t.dist_m;
          q([{ f: 0, move: [mx, my] }, { f: 1, press: ['roll'] }, { f: 3, release: ['roll'] }]);
          for (let i = 0; i < 55; i++) step(1);
          const c = cs();
          const t1 = c.enemies.find((e) => e.id === 'E1');
          R.directional.push({
            stick: label,
            dist_before_m: +d0.toFixed(3),
            dist_after_m: +t1.dist_m.toFixed(3),
            dist_change_m: +(t1.dist_m - d0).toFixed(3),
            bearing_change_deg: +angDiff(t1.bearing_deg, t.bearing_deg).toFixed(2),
            player_yaw_deg: +c.player.yaw_deg.toFixed(2),
            faces_target: Math.abs(angDiff(c.player.yaw_deg, t1.bearing_deg)) < 12,
            travelled_m: +Math.hypot(c.player.pos[0] - p0[0], c.player.pos[2] - p0[2]).toFixed(3),
          });
        }
        // acquisition envelope
        R.envelope = [];
        for (const d of [4, 10, 13.5, 14.5, 17, 19]) {
          reset('arena_flat');
          H.spawn('inf_trash', 0, d, { as: 'A' });
          step(4);
          H.lockOn(null);
          q([{ f: 1, press: ['lock_on'] }, { f: 3, release: ['lock_on'] }]);
          step(4);
          R.envelope.push({ dist_m: d, acquired: cs().lock.target });
        }
        // hysteresis: acquire at 10 m, walk away
        reset('arena_flat');
        H.spawn('inf_trash', 0, 10, { as: 'A' });
        step(4);
        q([{ f: 1, press: ['lock_on'] }, { f: 3, release: ['lock_on'] }, { f: 6, move: [0, -1] }]);
        step(4);
        const acq = cs().lock.target;
        let breakAt = null;
        for (let i = 0; i < 700; i++) {
          step(1);
          const c = cs();
          if (!c.lock.target) { breakAt = c.enemies.find((e) => e.id === 'A').dist_m; break; }
        }
        R.hysteresis = { acquired: acq, broke_at_m: breakAt === null ? null : +breakAt.toFixed(2) };
        // framing
        reset('arena_duel'); H.lockOn('E1'); step(30);
        let framed = 0, n = 0;
        for (let i = 0; i < 120; i++) { step(1); n++; if (cs().lock.both_framed) framed++; }
        R.framing = { frames: n, both_framed: framed, fraction: +(framed / n).toFixed(3) };
        return R;
      }

      // ---- ARBITRATION §1 / seam S13 -------------------------------------------------------
      case 'parley': {
        R.cases = [];
        const cases = [
          { label: 'no knowledge, no rank, no gold', know: { gold: 0, topicsKnown: [], factions: {}, dispositions: { sentry_ghelis: 35 } }, expect: 'REFUSE' },
          { label: 'knows the true name (lore learned OUT of the fight)', know: { gold: 0, topicsKnown: ['the-drowned-ford'], factions: {}, dispositions: { sentry_ghelis: 0 } }, expect: 'ACCEPT/name' },
          { label: 'faction rank 3 in marsh-wardens', know: { gold: 0, topicsKnown: [], factions: { 'marsh-wardens': { rank: 3 } }, dispositions: { sentry_ghelis: 35 } }, expect: 'ACCEPT/faction' },
          { label: 'faction rank 3 but expelled', know: { gold: 0, topicsKnown: [], factions: { 'marsh-wardens': { rank: 3, expelled: true } }, dispositions: { sentry_ghelis: 35 } }, expect: 'REFUSE' },
          { label: 'faction rank 3 and rank in the rival court', know: { gold: 0, topicsKnown: [], factions: { 'marsh-wardens': { rank: 3 }, 'reed-court': { rank: 1 } }, dispositions: { sentry_ghelis: 35 } }, expect: 'REFUSE' },
          { label: '200 gold, disposition 35', know: { gold: 200, topicsKnown: [], factions: {}, dispositions: { sentry_ghelis: 35 } }, expect: 'ACCEPT/gold' },
          { label: '200 gold, disposition 5', know: { gold: 200, topicsKnown: [], factions: {}, dispositions: { sentry_ghelis: 5 } }, expect: 'REFUSE' },
        ];
        for (const c of cases) {
          reset('arena_duel');
          H.setWorldKnowledge(c.know);
          H.lockOn('E1');
          // walk into parley range (6.0 m), then press interact
          q([{ f: 0, move: [0, 1] }, { f: 40, move: [0, 0] }, { f: 44, press: ['interact'] }, { f: 46, release: ['interact'] }]);
          let result = null, states = [];
          for (let i = 0; i < 160; i++) {
            step(1);
            const s = cs();
            states.push(s.player.state);
            const e = s.enemies.find((x) => x.id === 'E1');
            if (e && e.yielded && !result) result = 'ACCEPT';
          }
          const s = cs();
          const e = s.enemies.find((x) => x.id === 'E1');
          R.cases.push({
            case: c.label, expect: c.expect,
            enemy_yielded: !!(e && e.yielded), enemy_alive: !!(e && !e.dead), enemy_hp: e ? e.hp : null,
            parley_states_seen: [...new Set(states.filter((x) => x.indexOf('PARLEY') === 0))],
            gold_after: s.world_knowledge.gold,
          });
        }
        // the beast exemption
        reset('arena_flat');
        H.spawn('beast_slitherfang', 0, 3, { as: 'B' });
        H.setWorldKnowledge({ gold: 9999, topicsKnown: ['the-drowned-ford'], factions: { 'marsh-wardens': { rank: 9 } } });
        step(4);
        q([{ f: 1, press: ['interact'] }, { f: 3, release: ['interact'] }]);
        const seen = [];
        for (let i = 0; i < 40; i++) { step(1); seen.push(cs().player.state); }
        const b = cs().enemies.find((x) => x.id === 'B');
        R.beast_exemption = {
          parley_animation_started: seen.some((s) => s.indexOf('PARLEY') === 0),
          beast_yielded: !!(b && b.yielded),
          note: 'seam S13 exempts beasts; the input must be DROPPED with a named reason, not silently ignored',
        };
        return R;
      }
      default:
        return { __err: `unknown probe '${name}'` };
    }
  } catch (e) {
    return { __err: String(e && e.message || e), __stack: String(e && e.stack || '') };
  }

  // -- in-page helpers ---------------------------------------------------------------------
  function contiguous(arr) {
    const runs = [];
    let s = null, p = null;
    for (const v of arr) { if (s === null) { s = v; p = v; } else if (v === p + 1) p = v; else { runs.push([s, p]); s = v; p = v; } }
    if (s !== null) runs.push([s, p]);
    return runs;
  }
  function angDiff(a, b) { let d = (a - b) % 360; if (d > 180) d -= 360; if (d < -180) d += 360; return d; }
  function setWeapon(id) {
    const st = { state: 'arena_flat' };
    // loadState rebuilds the fight from the named state's loadout; patch it via the engine
    const H2 = window.__HARNESS;
    if (typeof H2.setLoadout === 'function') return !!H2.setLoadout({ weapon: id });
    return false;
  }
  function setShield(id) {
    const H2 = window.__HARNESS;
    if (typeof H2.setLoadout === 'function') return !!H2.setLoadout({ shield: id });
    return false;
  }
  function sweptGap(weapon, hurtboxes) {
    // conservative analytic gap using the two capsule endpoints at both poses
    let best = 99;
    const segs = [[weapon.now.slice(0, 3), weapon.now.slice(3, 6)], [weapon.prev.slice(0, 3), weapon.prev.slice(3, 6)]];
    for (const h of hurtboxes) {
      for (const s of segs) {
        const d = segSeg(s[0], s[1], h.a, h.b) - weapon.r - h.r;
        if (d < best) best = d;
      }
    }
    return best;
  }
  function segSeg(p1, q1, p2, q2) {
    const d1 = sub(q1, p1), d2 = sub(q2, p2), r = sub(p1, p2);
    const a = dot(d1, d1), e = dot(d2, d2), f = dot(d2, r);
    let s, t;
    if (a <= 1e-12 && e <= 1e-12) return Math.hypot(r[0], r[1], r[2]);
    if (a <= 1e-12) { s = 0; t = clamp(f / e); }
    else {
      const c = dot(d1, r);
      if (e <= 1e-12) { t = 0; s = clamp(-c / a); }
      else {
        const b = dot(d1, d2), den = a * e - b * b;
        s = den > 1e-12 ? clamp((b * f - c * e) / den) : 0;
        t = (b * s + f) / e;
        if (t < 0) { t = 0; s = clamp(-c / a); } else if (t > 1) { t = 1; s = clamp((b - c) / a); }
      }
    }
    const c1 = [p1[0] + d1[0] * s, p1[1] + d1[1] * s, p1[2] + d1[2] * s];
    const c2 = [p2[0] + d2[0] * t, p2[1] + d2[1] * t, p2[2] + d2[2] * t];
    return Math.hypot(c1[0] - c2[0], c1[1] - c2[1], c1[2] - c2[2]);
  }
  function sub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
  function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
  function clamp(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
}

function render(o) {
  const L = [];
  for (const [name, r] of Object.entries(o.probes)) {
    L.push(`\n=== ${name} ===`);
    if (r.__err) { L.push(`  ERROR: ${r.__err}`); continue; }
    L.push(JSON.stringify(r, null, 1).split('\n').slice(0, 400).join('\n'));
  }
  return L.join('\n');
}
