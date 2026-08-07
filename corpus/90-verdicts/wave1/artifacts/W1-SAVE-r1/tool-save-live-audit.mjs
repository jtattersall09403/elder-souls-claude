#!/usr/bin/env node
/**
 * save-live-audit.mjs — an INDEPENDENT round-trip instrument for RI-JRN05.
 *
 * Written by the W1-SAVE round-1 critic and declared under `method_deviations`. It exists
 * because `tools/journey/state-diff.mjs` was written by the same hand as the repair it
 * grades (`RI-MTH07` is the whole subject of that objection, and `TOOL-LOOP.md` rule 3 is
 * the rule), and because state-diff.mjs's headline checks are all taken on the SAVE BLOB:
 *
 *   * M1 is `getStateHash()` before vs after — a FIXED-POINT test on the serialiser. A field
 *     that is written to the blob and never read back still passes M1 whenever the value it
 *     re-serialises to happens to equal the value that was saved. That is exactly the case
 *     for every field sitting at its identity value, which is what nine of this repair's own
 *     fields were declared at.
 *   * M2 is the same comparison at field level.
 *   * M4 is a set difference of the blob against the manifest — a document against a document.
 *   * `getDurableFieldCensus()` IS a live-object diff, but it walks a declared subset of the
 *     simulation (`sim.player/camera/env/world/progression/quest/inventory/identity/character/
 *     captured/npcs/props/magic/entities` + the combat bodies) and NOT `sim._traversal`,
 *     `engine.crime`, `engine.travel`, `engine.conversation`, `engine.ui`, `engine.hearths`
 *     or `engine.questEngine`.
 *
 * This tool never looks at the blob. It observes the world through ~30 public harness
 * getters — the same surface every other critic in this project reads the world through —
 * and compares two arms:
 *
 *   CONTROL : preroll               -> observe -> step(N) -> observe
 *   LOADED  : preroll -> save+load  -> observe -> step(N) -> observe
 *
 * A field restored wrongly, restored at a default, or never restored at all shows up in the
 * first comparison. A field whose ABSENCE only changes the future shows up in the second.
 *
 * FRAME REBASE. `loadState()` resets `sim.frame` to 0 (RI-MTH01 A07), so the two arms are at
 * different absolute frames. Rather than maintain an exclusion list (which is how an
 * instrument comes to agree with the thing it measures), every numeric leaf is compared
 * TWICE — as an absolute value and as `value - frameNow` — and the result is classified:
 *
 *   `abs`   both arms agree on the raw number          (an ordinary field)
 *   `rel`   both arms agree on the frame-relative form (a stamp that was correctly rebased)
 *   `stale` ONLY the raw number agrees                 (a stamp that was NOT rebased: the
 *                                                       load restored frame 3140's deadline
 *                                                       into a session that is at frame 0)
 *   `diff`  neither agrees                             (a defect)
 *
 * `stale` is reported separately and is NOT counted as a pass, because a deadline restored
 * unrebased is the defect this piece's own status file reports against the crime ledger.
 *
 * PRE-ROLLS. state-diff.mjs uses ONE pre-roll for all 38 states — spawn two `inf_trash`,
 * aggro one, walk, swing, roll. This tool deliberately uses the moments that pre-roll does
 * not reach: mid-cast, mid-parry, mid-death, mid-menu, mid-travel, in water, mid-fall,
 * at a hearth, mid-crime-hunt, and a control `idle` arm.
 *
 * Exit 0 only if every trial is clean. Exit 20 otherwise.
 */
import path from 'node:path';
import crypto from 'node:crypto';
import { parseArgs, wantsHelp, usage, log, EXIT, writeJson, RUNS_DIR, ensureDir } from '../lib/cli.mjs';
import { launchGame } from '../lib/browser.mjs';

const USAGE = `
save-live-audit.mjs — RI-JRN05 round trip measured on the LIVE WORLD, not on the save blob.

USAGE
  node tools/journey/save-live-audit.mjs [--seeds a,b,c] [--scenarios idle,in-water,...]
                                         [--settle 120] [--out DIR] [--json]

SCENARIOS
  idle mid-cast mid-parry mid-death mid-menu mid-travel in-water mid-fall at-hearth
  mid-crime mid-swing-hitactive deep-water-drowning

OPTIONS
  --seeds <a,b,c>    default 4711,1337,90210,2147483647,7,101,31337,555,12345,777
  --scenarios <a,b>  default: all
  --settle <n>       frames stepped after the observation point in both arms (default 120)
  --out <dir>        default reports/runs/W1-SAVE-LIVE
`;

const args = parseArgs();
if (wantsHelp(args)) usage(USAGE);

const ALL_SCENARIOS = ['idle', 'mid-cast', 'mid-parry', 'mid-death', 'mid-menu', 'mid-travel',
  'in-water', 'mid-fall', 'at-hearth', 'mid-crime', 'mid-swing-hitactive', 'deep-water-drowning'];
const SEEDS = String(args.seeds || '4711,1337,90210,2147483647,7,101,31337,555,12345,777')
  .split(',').map((s) => Number(s.trim()));
const SCENARIOS = String(args.scenarios || ALL_SCENARIOS.join(',')).split(',').map((s) => s.trim());
const SETTLE = Number(args.settle === undefined ? 120 : args.settle);
const outDir = args.out ? path.resolve(String(args.out)) : path.join(RUNS_DIR, 'W1-SAVE-LIVE');
ensureDir(outDir);
const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');

/** Flatten to leaf paths; array indices collapsed only in the REPORT, never in the compare. */
function flat(o, p, acc) {
  if (o === null || o === undefined || typeof o !== 'object') { acc[p] = o === undefined ? '<undefined>' : o; return acc; }
  if (Array.isArray(o)) {
    if (!o.length) { acc[p] = '[]'; return acc; }
    o.forEach((x, i) => flat(x, `${p}[${i}]`, acc));
    return acc;
  }
  const ks = Object.keys(o);
  if (!ks.length) { acc[p] = '{}'; return acc; }
  for (const k of ks) flat(o[k], p ? `${p}.${k}` : k, acc);
  return acc;
}

const DP = 6;
const q = (v) => (typeof v === 'number' && Number.isFinite(v) ? Math.round(v * 10 ** DP) / 10 ** DP : v);

/**
 * Compare one observation from each arm.
 * `fa` / `fb` are the frame each arm was observed at, so a stamp can be tried relative.
 */
function compare(a, b, fa, fb) {
  const A = flat(a, '', {}), B = flat(b, '', {});
  const keys = [...new Set([...Object.keys(A), ...Object.keys(B)])].sort();
  const out = { n: keys.length, abs: 0, rel: 0, stale: [], diff: [] };
  for (const k of keys) {
    const va = q(A[k]), vb = q(B[k]);
    const sa = JSON.stringify(va), sb = JSON.stringify(vb);
    if (sa === sb) {
      // Identical raw. If it looks like a frame stamp it may be a stamp that was NOT rebased:
      // check whether the RELATIVE forms disagree, which is the tell.
      const leaf = k.split('.').pop().replace(/\[\d+\]$/, '');
      // `.const.` / `.budget.` / `.declared` are DATA constants read straight out of a json
      // file (a 45-frame death ease, a 90-frame fog window). They are not frame stamps and a
      // stale check applied to them measures the data file, not the save.
      const isConstant = /\.(const|budget|declared|rules|policy|thresholds|consumers)\./.test(k) || /^declared\./.test(k);
      // Clip-relative counters, not absolute sim-frame indices. `anim_frame` counts frames
      // INTO the current animation and is supposed to be identical across a load.
      const isRelativeCounter = /^(anim_frame|animFrame|anim_phase0|animPhase0|animLen|anim_len)$/.test(leaf);
      const looksLikeStamp = !isConstant && !isRelativeCounter
        && /(^frame$|_f$|_frame$|[a-z]F$|At$|Until$|_until$|_at$)/.test(leaf);
      if (typeof va === 'number' && typeof vb === 'number' && Math.abs(va) > 1 && fa !== fb
          && q(va - fa) !== q(vb - fb) && looksLikeStamp) {
        out.stale.push({ path: k, value: va, control_frame: fa, loaded_frame: fb,
          note: 'raw value identical across a load that reset the frame — the stamp was not rebased' });
      } else out.abs++;
      continue;
    }
    if (typeof va === 'number' && typeof vb === 'number' && q(va - fa) === q(vb - fb)) { out.rel++; continue; }
    out.diff.push({ path: k, control: va === undefined ? null : va, loaded: vb === undefined ? null : vb });
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// The page-side half. One function, so a scenario is a data row rather than a second code path.
// ---------------------------------------------------------------------------------------------
const PAGE = /* js */`
(async (o) => {
  const H = window.__HARNESS;
  H.setRenderRate(0);
  const notes = [];
  const safe = (f, d) => { try { const v = f(); return v === undefined ? (d === undefined ? null : d) : v; } catch (e) { return { __err: String(e && e.message || e) }; } };

  // -------- the observation: the world through the PUBLIC harness, never through the blob ----
  const observe = () => ({
    frame:            safe(() => H.getFrame()),
    player:           safe(() => H.getPlayerStats()),
    entities:         safe(() => H.listEntities()),
    combat:           safe(() => H.getCombatState()),
    camera_rig:       safe(() => H.getCameraRig()),
    camera_frame:     safe(() => H.getCameraFrame()),
    traversal:        safe(() => { const t = H.getTraversalReport(); const c = JSON.parse(JSON.stringify(t)); delete c.declared; return c; }),
    fall:             safe(() => H.getFallState()),
    burden:           safe(() => H.getBurden()),
    gold:             safe(() => H.getGold()),
    sap_taint:        safe(() => H.getSapTaint()),
    magic:            safe(() => H.getMagicState()),
    status:           safe(() => H.getStatus()),
    derived:          safe(() => H.getDerivedStats()),
    character:        safe(() => H.getCharacter()),
    skills:           safe(() => H.getSkillSheet()),
    inventory:        safe(() => H.getInventory()),
    quest:            safe(() => H.getQuestState()),
    world_registers:  safe(() => H.getWorldRegisters()),
    crime:            safe(() => H.getCrimeState()),
    search:           safe(() => H.getSearchState()),
    stealth:          safe(() => H.getStealthState()),
    death:            safe(() => H.getDeathState()),
    travel:           safe(() => H.getTravelState()),
    capture:          safe(() => H.getCaptureState()),
    ui:               safe(() => H.getUIState()),
    conversation:     safe(() => H.getConversationState()),
    dispositions:     safe(() => H.getDispositions()),
    afflictions:      safe(() => H.getStatusState()),
    lock:             safe(() => H.lockState()),
    hazards:          safe(() => H.getHazardReport()),
    npcs:             safe(() => H.listNPCs()),
    seed:             safe(() => H.getSeed()),
  });

  // -------- pre-rolls the builder's instrument does not reach -------------------------------
  const base = (state) => { H.setSeed(o.seed); H.loadState(state || 'default'); H.clearInputs(); };

  const PREROLL = {
    idle: () => { base('arena_flat'); H.stepFrames(30); },

    'mid-swing-hitactive': () => {
      base('arena_flat'); H.teleport(0, 0);
      H.spawn('inf_trash', 0, 2.1, { as: 'liveA' });
      H.aggro('liveA'); H.lockOn('liveA');
      H.queueInputs([{ f: 2, press: ['heavy'] }, { f: 24, release: ['heavy'] }]);
      H.stepFrames(30);   // land inside the active window rather than after it
    },

    'mid-cast': () => {
      base('arena_flat');
      H.setMagicSkills({ destruction: 60, alteration: 60, restoration: 60, mysticism: 60, conjuration: 60, illusion: 60 });
      const sd = H.getMagicData().spells;
      const spells = Array.isArray(sd) ? sd : (sd.spells || Object.values(sd));
      const pick = spells.find((s) => /flame|fire|bolt|shock|frost/i.test(s.id)) || spells[0];
      notes.push('cast spell ' + (pick && pick.id));
      try { H.learnSpell(pick.id); } catch (e) { notes.push('learnSpell: ' + e.message); }
      try { H.setLoadout({ left: 'catalyst', weapon: 'ssw_garrison_sword' }); } catch (e) { notes.push('setLoadout: ' + e.message); }
      H.queueInputs([{ f: 2, press: ['light'] }, { f: 5, release: ['light'] }]);
      H.stepFrames(10);   // mid cast animation, resources already charged
    },

    'mid-parry': () => {
      base('arena_flat'); H.teleport(0, 0);
      H.spawn('inf_trash', 0, 1.8, { as: 'parA' });
      H.aggro('parA'); H.lockOn('parA');
      // Guard raised and held across the save point: press without releasing.
      H.queueInputs([{ f: 2, press: ['block'] }]);
      H.stepFrames(45);
    },

    'mid-death': () => {
      base('arena_flat'); H.teleport(0, 0);
      H.spawn('inf_trash', 2, 2, { as: 'dthA' });
      H.stepFrames(10);
      H.damagePlayer(1e6, { stagger: true });
      H.stepFrames(14);   // inside the death sequence, before respawn
    },

    'mid-menu': () => {
      base('arena_flat');
      H.stepFrames(8);
      try { H.openMenu('inventory'); } catch (e) { notes.push('openMenu: ' + e.message); }
      H.stepFrames(12);
    },

    'mid-travel': () => {
      base('default');
      const net = H.getTravelNetwork();
      let svc = null;
      for (const s of (net.stations || [])) for (const x of (s.services || [])) { if (!svc) svc = x.id || x; }
      notes.push('travel service ' + svc);
      if (svc) {
        try { H.setGold(9999); } catch (e) {}
        try { const b = H.boardTravel(svc); notes.push('board ' + JSON.stringify(b).slice(0, 200)); } catch (e) { notes.push('board: ' + e.message); }
        try { H.travelRide(40); } catch (e) { notes.push('ride: ' + e.message); }
      }
      H.stepFrames(6);
    },

    'in-water': () => {
      base('water_shallows');
      H.stepFrames(6);
      // Walk into it so the band, the depth and the stamina charge are all live.
      H.queueInputs([{ f: 0, move: [0, 1] }]);
      H.stepFrames(90);
    },

    'deep-water-drowning': () => {
      base('default');
      // Find real deep water in the province and stand in it until breath is spent.
      let best = null;
      for (let x = -900; x <= 900 && !best; x += 60) {
        for (let z = -900; z <= 900; z += 60) {
          const w = H.getWaterAt(x, z);
          const d = w && (w.depth_m !== undefined ? w.depth_m : w.depth);
          if (d && d > 4.5) { best = [x, z, d]; break; }
        }
      }
      notes.push('deep water at ' + JSON.stringify(best));
      if (best) { H.teleport(best[0], best[1]); H.stepFrames(1); }
      H.queueInputs([{ f: 0, move: [0, 1] }]);
      H.stepFrames(o.deepFrames || 900);   // long enough to burn the breath meter
    },

    'mid-fall': () => {
      base('default');
      H.stepFrames(2);
      const p = H.getPlayerStats();
      try { H.teleport(p.pos ? p.pos[0] : 0, p.pos ? p.pos[2] : 0, { y: (p.pos ? p.pos[1] : 0) + 40 }); } catch (e) { notes.push('teleport y: ' + e.message); }
      H.stepFrames(14);   // mid-air, apex recorded, vy accumulating
    },

    'at-hearth': () => {
      base('default');
      const hs = H.listHearths().hearths;
      const hr = hs.find((x) => x.kind === 'settlement') || hs[0];
      notes.push('hearth ' + (hr && hr.id));
      H.teleport(hr.pos[0], hr.pos[2]); H.stepFrames(2);
      try { H.hearthRest({ at: hr.id }); } catch (e) { notes.push('rest: ' + e.message); }
      H.stepFrames(20);
    },

    'mid-crime': () => {
      base('stormhold-street');
      H.stepFrames(4);
      try { const c = H.commitCrime('theft', { value: 400 }); notes.push('crime ' + JSON.stringify(c).slice(0, 200));
        try { H.addWitness(c.id !== undefined ? c.id : c.ref, { id: 'wit-1', pos: [2, 0, 2] }); } catch (e) { notes.push('witness: ' + e.message); }
      } catch (e) { notes.push('crime: ' + e.message); }
      try { H.spawnGuard({ id: 'gd-1', pos: [6, 0, 6], hunting: true }); } catch (e) { notes.push('guard: ' + e.message); }
      H.stepFrames(40);
    },
  };

  const run = PREROLL[o.scenario];
  if (!run) return { error: 'no such scenario ' + o.scenario };

  const script = [
    { f: 0, move: [0, 1], look: [3, 0] },
    { f: 30, move: [0, 0] },
    { f: 40, press: ['light'] }, { f: 44, release: ['light'] },
    { f: 80, press: ['roll'] }, { f: 84, release: ['roll'] },
  ];

  // ---- ARM R: the REPRODUCIBILITY CONTROL ---------------------------------------------------
  // Two identical pre-rolls, no save and no load between them. If these two disagree the
  // scenario is contaminated by the run before it and NOTHING measured against it means
  // anything — a control that cannot reproduce itself cannot convict a save.
  run();
  const rFrame1 = H.getFrame();
  const r1 = observe();
  run();
  const rFrame2 = H.getFrame();
  const r2 = observe();

  // ---- ARM A: control, never saved ---------------------------------------------------------
  run();
  const cFrameAtPoint = H.getFrame();
  const cAtPoint = observe();
  H.clearInputs(); H.queueInputs(script);
  H.traceStart(); H.stepFrames(o.settle); const cTrace = H.traceStop();
  const cFrameAfter = H.getFrame();
  const cAfter = observe();

  // ---- ARM B: identical pre-roll, then save + load at the same point ------------------------
  run();
  const hashBefore = H.getStateHash();
  const blob = JSON.parse(JSON.stringify(H.saveState()));
  H.restoreState(JSON.parse(JSON.stringify(blob)));
  const hashAfter = H.getStateHash();
  const lFrameAtPoint = H.getFrame();
  const lAtPoint = observe();
  H.clearInputs(); H.queueInputs(script);
  H.traceStart(); H.stepFrames(o.settle); const lTrace = H.traceStop();
  const lFrameAfter = H.getFrame();
  const lAfter = observe();

  return {
    notes, hashBefore, hashAfter,
    repro: { a: r1, b: r2, fa: rFrame1, fb: rFrame2 },
    control: { atPoint: cAtPoint, after: cAfter, f0: cFrameAtPoint, f1: cFrameAfter, trace: cTrace },
    loaded:  { atPoint: lAtPoint, after: lAfter, f0: lFrameAtPoint, f1: lFrameAfter, trace: lTrace },
    blob_keys: Object.keys(blob).sort(),
  };
})
`;

/** Field-level census over two rebased traces: which FIELD differed, and on how many frames. */
function traceCensus(A, B) {
  const n = Math.min(A.length, B.length);
  const fields = {}; let first = null;
  for (let i = 0; i < n; i++) {
    const a = flat(A[i], '', {}), b = flat(B[i], '', {});
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
      if (JSON.stringify(q(a[k])) !== JSON.stringify(q(b[k]))) {
        const nk = k.replace(/\[\d+\]/g, '[]');
        fields[nk] = (fields[nk] || 0) + 1;
        if (!first) first = { frame: i, field: nk, control: a[k] === undefined ? null : a[k], loaded: b[k] === undefined ? null : b[k] };
      }
    }
  }
  return { frames: n, fields, first, len_control: A.length, len_loaded: B.length };
}

/**
 * `first_input` / `first_control` are RI-PLT03's TTFP stamps. `Engine.firstControlAt` is a
 * per-PAGE latch that nothing resets — not `loadState`, not `reset()` — so the second arm run
 * in one page never re-fires them. That is a property of running two arms in one browser, not
 * of the save, and it is excluded BY NAME here rather than silently.
 */
const SESSION_EVENTS = ['first_input', 'first_control'];

function rebaseTrace(recs) {
  if (!recs || !recs.length) return [];
  const o = recs[0].f;
  return recs.map((x) => {
    const c = JSON.parse(JSON.stringify(x));
    c.f -= o; delete c.t_ms;
    if (c.events) c.events = c.events.filter((e) => !SESSION_EVENTS.includes(e.type));
    for (const e of c.events || []) if (typeof e.f === 'number') e.f -= o;
    for (const e of c.enemies || []) if (typeof e.state_entered_f === 'number') e.state_entered_f = e.state_entered_f < o ? 'pre' : e.state_entered_f - o;
    return c;
  });
}

const handle = await launchGame({ ...args, width: 320, height: 240 });
const report = {
  schema: 'elder-souls/save-live-audit@1',
  item: 'RI-JRN05 M1/M3-shaped/M5, measured on the live world through the public harness',
  written_by: 'W1-SAVE round-1 critic (method_deviations)',
  seeds: SEEDS, scenarios: SCENARIOS, settle_frames: SETTLE,
  declared_exclusions: {
    trace_events: SESSION_EVENTS,
    reason: 'Engine.firstControlAt is a per-PAGE latch (RI-PLT03 TTFP) that no reset clears, so the second arm in one browser never re-fires it. An artifact of the instrument, declared rather than hidden.',
    stale_check_skips: 'paths under .const. / .budget. / .declared / .rules / .policy / .thresholds — data constants, not frame stamps',
  },
  trials: [],
};
try {
  await handle.page.waitForFunction(() => !!(window.__HARNESS && window.__HARNESS.version));
  await handle.page.evaluate(() => window.__HARNESS.ready());
  for (const scenario of SCENARIOS) {
    for (const seed of SEEDS) {
      let t;
      try {
        t = await handle.page.evaluate(`(${PAGE})(${JSON.stringify({ scenario, seed, settle: SETTLE })})`);
      } catch (e) {
        report.trials.push({ scenario, seed, threw: String(e.message).slice(0, 400), pass: false });
        log(`THREW ${scenario} seed ${seed} — ${String(e.message).slice(0, 200)}`);
        continue;
      }
      if (t.error) { report.trials.push({ scenario, seed, error: t.error, pass: false }); continue; }
      const repro = compare(t.repro.a, t.repro.b, t.repro.fa, t.repro.fb);
      const atPoint = compare(t.control.atPoint, t.loaded.atPoint, t.control.f0, t.loaded.f0);
      const after = compare(t.control.after, t.loaded.after, t.control.f1, t.loaded.f1);
      const A = rebaseTrace(t.control.trace), B = rebaseTrace(t.loaded.trace);
      const traceA = sha(A.map((x) => JSON.stringify(x)).join('\n'));
      const traceB = sha(B.map((x) => JSON.stringify(x)).join('\n'));
      const trial = {
        scenario, seed, notes: t.notes,
        preroll_reproducible: repro.diff.length === 0 && repro.stale.length === 0,
        preroll_repeat_diff: repro.diff.slice(0, 40),
        engine_hash_equal: t.hashBefore === t.hashAfter,
        engine_hash_before: t.hashBefore, engine_hash_after: t.hashAfter,
        live_at_save_point: { compared: atPoint.n, equal_abs: atPoint.abs, equal_rebased: atPoint.rel,
          unrebased_stamps: atPoint.stale, differing: atPoint.diff },
        live_after_settle: { compared: after.n, equal_abs: after.abs, equal_rebased: after.rel,
          unrebased_stamps: after.stale, differing: after.diff },
        trace_control_sha256: traceA, trace_loaded_sha256: traceB, trace_identical: traceA === traceB,
        trace_census: traceA === traceB ? null : traceCensus(A, B),
      };
      trial.pass = trial.preroll_reproducible && trial.engine_hash_equal
        && atPoint.diff.length === 0 && after.diff.length === 0
        && atPoint.stale.length === 0 && after.stale.length === 0 && trial.trace_identical;
      // A scenario whose own pre-roll does not reproduce is UNMEASURABLE here, not a save
      // defect. Reported as such rather than folded into the failure count.
      trial.verdict = !trial.preroll_reproducible ? 'unmeasurable-preroll-not-reproducible'
        : (trial.pass ? 'clean' : 'defect');
      report.trials.push(trial);
      log(`${trial.verdict === 'clean' ? 'PASS' : trial.verdict === 'defect' ? 'FAIL' : 'UNMEAS'} ${scenario} seed ${seed} — repro ${trial.preroll_reproducible ? 'ok' : `NO (${repro.diff.length})`}, hash ${trial.engine_hash_equal ? 'ok' : 'MISMATCH'}, live@point ${atPoint.diff.length} diff / ${atPoint.stale.length} stale of ${atPoint.n}, live@+${SETTLE} ${after.diff.length} diff / ${after.stale.length} stale, trace ${trial.trace_identical ? 'identical' : 'DIVERGED'}`);
      if (!trial.preroll_reproducible) log(`     repro: ${repro.diff.slice(0, 6).map((d) => `${d.path} ${JSON.stringify(d.control)}->${JSON.stringify(d.loaded)}`).join(' | ')}`);
      if (atPoint.diff.length) log(`     @point: ${atPoint.diff.slice(0, 8).map((d) => `${d.path} ${JSON.stringify(d.control)}->${JSON.stringify(d.loaded)}`).join(' | ')}`);
      if (after.diff.length) log(`     @settle: ${after.diff.slice(0, 8).map((d) => `${d.path} ${JSON.stringify(d.control)}->${JSON.stringify(d.loaded)}`).join(' | ')}`);
      if (atPoint.stale.length) log(`     stale: ${atPoint.stale.slice(0, 8).map((d) => `${d.path}=${d.value}`).join(' | ')}`);
      if (trial.trace_census) log(`     trace: ${JSON.stringify(trial.trace_census.fields)} first=${JSON.stringify(trial.trace_census.first)}`);
    }
  }
} finally {
  report.page_errors = handle.errors;
  await handle.close();
}
report.trials_passed = report.trials.filter((t) => t.verdict === 'clean').length;
report.trials_defect = report.trials.filter((t) => t.verdict === 'defect').length;
report.trials_unmeasurable = report.trials.filter((t) => t.verdict && t.verdict.startsWith('unmeas')).length;
report.trials_total = report.trials.length;
report.pass = report.trials.every((t) => t.pass) && report.page_errors.length === 0;
writeJson(path.join(outDir, 'save-live-audit.json'), report);
if (args.json) process.stdout.write(JSON.stringify(report, null, 2) + '\n');
else process.stdout.write(path.join(outDir, 'save-live-audit.json') + '\n');
log(`${report.trials_passed}/${report.trials_total} trials clean on the live world`);
process.exit(report.pass ? EXIT.OK : EXIT.MEASUREMENT_FAIL);
