#!/usr/bin/env node
// session-run.mjs — the playthrough session driver.
//
// Named by SIX items: RI-EXP01 step 1, RI-EXP02, RI-EXP03, RI-EXP05, RI-CMP03, RI-JRN09.
// It is the single most-named phantom tool in the corpus, and RI-EXP01 — the corpus's only
// pre-existing instrument that asks whether the OPENING IS ANY GOOD — has never been run on any
// build because of it.
//
// RI-EXP01 step 1, verbatim:
//   node tools/experience/session-run.mjs \
//     --session exp-w<N>-firsthour --brief corpus/95-experience/briefs/first-hour.md \
//     --seed 1337 --minutes 60 --render-policy on-demand --profile first-hour
//
// THE PROFILE IS THE INSTRUMENT, not a convenience flag. RI-EXP01 step 1 again:
//   "No debug calls: `teleport`, `spawn`, `aggro`, `setTimeOfDay`, `setWeather` and `loadState`
//    are refused by the driver under `--profile first-hour`; ANY INVOCATION VOIDS THE RUN."
//
// So the refusal is enforced IN THE PAGE, by replacing those harness methods with throwing
// stubs before the session begins, and every attempt is recorded. A driver that merely asked
// the agent nicely not to teleport would be measuring the agent's manners. This is the same
// discipline AGENT-PROTOCOL states for probes: "never open a probe by granting yourself the
// thing under test" — here the thing under test is whether the first hour is discoverable
// WITHOUT being teleported through it.
//
// WHAT THIS TOOL IS AND IS NOT. It is a harness: it boots the game, installs the profile's
// prohibitions, exposes a small stdio protocol a driving agent can act through, records
// everything, and writes a session directory. It does not score, it does not decide whether
// the hour was good, and it does not itself play well — a session with no driving agent is
// recorded honestly as a session in which almost nothing happened.
//
// EXIT: 0 session completed and no prohibition was violated; 1 a prohibition was violated (the
//       run is VOID and says so) or the session could not be driven; 2 usage.
'use strict';

import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import {
  REPO_ROOT, REPORTS_DIR, parseArgs, wantsHelp, usage, writeJson, ensureDir,
  makeRunId, gitInfo, hashDataTree, die, EXIT, log,
} from '../lib/cli.mjs';
import { launchGame } from '../lib/browser.mjs';
import { deriveRefusalSet, capabilityOf, CAPABILITIES } from './lib/capabilities.mjs';

const USAGE = `
session-run.mjs — drive and record a playthrough session.

USAGE
  node tools/experience/session-run.mjs --session exp-w1-firsthour \\
       --brief corpus/95-experience/briefs/first-hour.md \\
       --seed 1337 --minutes 60 --render-policy on-demand --profile first-hour

OPTIONS
  --session ID         session id (becomes the directory name)
  --brief PATH         the instruction-neutral brief handed to the driving agent. It is COPIED
                       into the session directory as an artifact (PLAYTHROUGH-CRITIC §4.2).
  --seed N             seeded before any world load
  --minutes N          simulated minutes to run (60 for the first hour)
  --profile ID         first-hour | free | ending | build-identity   (see PROFILES)
  --render-policy P    on-demand | never | always   (on-demand renders only for captures)
  --drive MODE         stdio | script:<path> | none   (default: none — records an undriven hour
                       honestly rather than pretending an agent played it)
  --out DIR            session directory (default reports/sessions/<session>)
  --shots N            captures across the session
  --list-profiles      print the profiles and the capabilities they refuse
  --audit-surface      boot, classify the WHOLE live harness surface, print it, and exit non-zero
                       if anything is unclassified. This is how a critic checks the refusal set
                       without taking this file's word for it.
  --self-test          prove the prohibition enforcement actually blocks, that the capability
                       derivation catches the aliases a name list misses, and that a violation
                       VOIDS the run rather than being noted in a footnote

PROFILES — each refuses CAPABILITIES; the method list is derived from the live surface
  first-hour       mutate-world, teleport-player, grant-resource, set-environment, load-state,
                   force-hostility, break-fence   (RI-EXP01 step 1 — any invocation voids the run)
  ending           mutate-world, teleport-player, grant-resource, load-state, break-fence
  build-identity   as first-hour  (RI-CMP03 measures whether BUILDS diverge; a driver that can
                   set its own skills is measuring nothing. AGENT-PROTOCOL: every magic probe in
                   the tree opened with setMagicSkills({...100}), which is why a frozen skill
                   register went unseen for two rounds.)
  free             refuses nothing (for tooling development only; marked in the manifest)

  A method tools/experience/lib/capabilities.mjs does not classify is REFUSED, and named in the
  manifest. Six names against a 320-method surface is how round 2 certified a clean first hour
  with an agent-authored NPC standing in it (TOOL-COVERAGE-R2 §8).

STDIO PROTOCOL (--drive stdio)
  One JSON object per line on stdin:
    {"op":"key","key":"w","ms":400}        a real key press
    {"op":"click","x":100,"y":200}
    {"op":"step","frames":120}
    {"op":"call","method":"listEntities","args":[]}   a harness call (subject to the profile)
    {"op":"look","dx":30,"dy":0}
    {"op":"shot"}                          capture a frame
    {"op":"note","text":"..."}             recorded verbatim into the session log
    {"op":"end"}
  One JSON object per line on stdout in reply, always carrying {"ok":bool,"t_min":number}.
`;

// ---------------------------------------------------------------------------------------------
// ROUND 3 — THE PROFILES REFUSE CAPABILITIES, NOT NAMES.
//
// TOOL-COVERAGE-R2 §8: the round-2 profile was SIX NAMES against a 320-METHOD SURFACE. `spawn`
// was refused while `spawnNPC` spawned, `listNPCs()` went 0 -> 1, and the run recorded ZERO
// violations and exited 0. `loadState` was refused while `restoreState` was not; `teleport` was
// refused while `travelRide`, `boardTravel`, `setTravelMark` and `__breakTravelFence` were not.
//
// RI-EXP01 step 1's six names are the item's EXAMPLES of a capability, not the capability. The
// refusal set is now DERIVED from the live surface by `tools/experience/lib/capabilities.mjs`,
// which classifies every method by what it lets you do and FAILS CLOSED on anything it does not
// classify — so a method added next week is refused until somebody rules on it. RI-EXP01's six
// names are asserted to be inside the derived set on every run, so the item's own list is a
// LOWER bound that cannot silently be dropped.
// ---------------------------------------------------------------------------------------------
const PROFILES = {
  'first-hour': {
    refuse_capabilities: ['mutate-world', 'teleport-player', 'grant-resource', 'set-environment',
      'load-state', 'force-hostility', 'break-fence'],
    // RI-EXP01 step 1's literal six. Asserted to be a SUBSET of the derived set on every run.
    item_names: ['teleport', 'spawn', 'aggro', 'setTimeOfDay', 'setWeather', 'loadState'],
    source: 'RI-EXP01 step 1, read as a capability list (TOOL-COVERAGE-R2 §8)',
    voids_run: true,
  },
  ending: {
    refuse_capabilities: ['mutate-world', 'teleport-player', 'grant-resource', 'load-state', 'break-fence'],
    item_names: ['teleport', 'spawn', 'loadState'],
    source: 'RI-EXP05',
    voids_run: true,
  },
  'build-identity': {
    refuse_capabilities: ['mutate-world', 'teleport-player', 'grant-resource', 'set-environment',
      'load-state', 'force-hostility', 'break-fence'],
    item_names: ['teleport', 'spawn', 'aggro', 'setSkills', 'setAttributes', 'setMagicSkills', 'setGold', 'learnSpell'],
    source: 'RI-CMP03 + AGENT-PROTOCOL (never grant yourself the thing under test)',
    voids_run: true,
  },
  free: { refuse_capabilities: [], item_names: [], source: 'tooling development only', voids_run: false },
};

/** Methods this driver itself calls. If the classification refuses one, that is a BUG, and it
 *  must be loud rather than a session that silently cannot step. */
const DRIVER_METHODS = ['setSeed', 'setMode', 'setRenderRate', 'stepFrames', 'renderFrame',
  'screenshot', 'traceStart', 'traceDrain', 'traceStop', 'snapshot', 'getQuestState',
  'getCapabilityReport'];

/**
 * Read the LIVE surface and derive this profile's refusal set from it. Nothing here is a list
 * typed by hand: the surface comes from the running build and the classification is auditable
 * with `--audit-surface`.
 */
async function deriveForProfile(handle, prof) {
  const surface = await handle.page.evaluate(
    () => Object.keys(window.__HARNESS || {}).filter((k) => typeof window.__HARNESS[k] === 'function').sort());
  const d = deriveRefusalSet(surface, prof.refuse_capabilities);
  const missedItemNames = (prof.item_names || []).filter((n) => surface.includes(n) && !d.refuse.includes(n));
  const driverBlocked = DRIVER_METHODS.filter((m) => d.refuse.includes(m));
  return { surface, ...d, missedItemNames, driverBlocked };
}

const args = parseArgs();
if (wantsHelp(args)) usage(USAGE);
if (args['list-profiles']) {
  for (const [k, v] of Object.entries(PROFILES)) {
    process.stdout.write(
      `${k.padEnd(16)} refuses capabilities: ${v.refuse_capabilities.join(', ') || '(nothing)'}\n` +
      `${''.padEnd(16)} the item's own names (a LOWER bound, asserted inside the derived set): ` +
      `${(v.item_names || []).join(', ') || '(none)'}\n` +
      `${''.padEnd(16)} ${v.source}\n`);
  }
  process.stdout.write('\nThe refusal set is derived from the LIVE harness surface at install ' +
    'time and fails closed on anything tools/experience/lib/capabilities.mjs does not classify.\n' +
    'Run --audit-surface against a booted build to see the whole classification.\n');
  process.exit(0);
}
if (args['audit-surface']) {
  const h = await launchGame({ ...args, width: 320, height: 240 });
  try {
    const prof = PROFILES[String(args.profile || 'first-hour')] || PROFILES['first-hour'];
    const d = await deriveForProfile(h, prof);
    process.stdout.write(`harness surface: ${d.surface.length} methods\n`);
    for (const c of CAPABILITIES) {
      const refused = prof.refuse_capabilities.includes(c);
      process.stdout.write(`\n${refused ? 'REFUSED ' : 'allowed '} ${c} (${d.byCapability[c].length})\n  ${d.byCapability[c].join(' ')}\n`);
    }
    process.stdout.write(`\nUNCLASSIFIED (refused, fail-closed): ${d.unclassified.length}\n  ${d.unclassified.join(' ') || '(none)'}\n`);
    process.stdout.write(`\nrefusal set for profile "${args.profile || 'first-hour'}": ${d.refuse.length} methods\n`);
    process.exit(d.unclassified.length ? 1 : 0);
  } finally { await h.close(); }
}
if (args['self-test']) process.exit(await selfTest());

const sessionId = String(args.session || '');
if (!sessionId) die(EXIT.USAGE, '--session <id> is required');
const profileId = String(args.profile || 'free');
const profile = PROFILES[profileId];
if (!profile) die(EXIT.USAGE, `unknown --profile ${profileId}. Known: ${Object.keys(PROFILES).join(', ')}`);

const seed = Number.isFinite(Number(args.seed)) ? Number(args.seed) : 1337;
const minutes = Number(args.minutes || 60);
const renderPolicy = String(args['render-policy'] || 'on-demand');
const driveMode = String(args.drive || 'none');
const outDir = args.out ? path.resolve(String(args.out)) : path.join(REPORTS_DIR, 'sessions', sessionId);
ensureDir(outDir);

const result = await runSession();
writeJson(path.join(outDir, 'session.json'), result);
process.stdout.write(`session-run: ${sessionId} (${profileId}) -> ${path.relative(REPO_ROOT, outDir)}\n`);
process.stdout.write(`  ${result.frames_stepped} frames (${result.minutes_simulated.toFixed(1)} sim-min), ` +
  `${result.trace_records} trace records, ${result.ops} ops\n`);
if (result.void) {
  process.stdout.write(`  RUN VOID: ${result.violations.length} prohibited call(s): ` +
    result.violations.map((v) => v.method).join(', ') + `\n  ${profile.source}\n`);
}
process.exit(result.void || !result.ok ? 1 : 0);

// ---------------------------------------------------------------------------------------------
async function runSession() {
  const t0 = Date.now();
  const handle = await launchGame({ width: 960, height: 540 });
  const ops = [];
  const notes = [];

  try {
    // ---- derive the refusal set FROM THE LIVE SURFACE ----------------------------------
    const derived = await deriveForProfile(handle, profile);
    if (derived.driverBlocked.length) {
      die(EXIT.INTERNAL,
        `the capability classification refuses methods this driver itself needs: ` +
        `${derived.driverBlocked.join(', ')}. That is a bug in ` +
        `tools/experience/lib/capabilities.mjs, not a property of the build. Failing loudly ` +
        `rather than running a session that cannot step.`);
    }
    if (derived.missedItemNames.length) {
      die(EXIT.INTERNAL,
        `${profile.source} names ${derived.missedItemNames.join(', ')} explicitly and the derived ` +
        `capability set does NOT refuse them. The derivation must be a superset of the item's own ` +
        `list, never a replacement for it.`);
    }
    log(`profile ${profileId}: ${derived.refuse.length} of ${derived.surface.length} harness methods ` +
        `refused, derived from capabilities [${profile.refuse_capabilities.join(', ') || 'none'}]` +
        (derived.unclassified.length
          ? `; ${derived.unclassified.length} UNCLASSIFIED and refused fail-closed: ${derived.unclassified.join(', ')}`
          : '; classification covers the whole surface'));

    // ---- install the prohibitions IN THE PAGE ------------------------------------------
    // Not a wrapper in this file: a driving agent that calls window.__HARNESS directly through
    // page.evaluate would walk straight past a Node-side check. The methods are replaced, so
    // there is no path to them at all, and every attempt is recorded with a stack.
    //
    // =========================================================================================
    // ROUND 4 — TOOL-COVERAGE-R3 §4: "the name list is fixed. THE DOOR is not."
    //
    // Round 3's capability classifier is this round's best work and none of it is touched. What
    // it got wrong is SCOPE: prohibitions were installed on one object, and the game publishes
    // two. `game/src/main.js:24` does `window.__ENGINE = engine`, and `__HARNESS.spawnNPC` is a
    // wrapper over `Engine.spawnNPC` (engine.js:1179). The critic installed the first-hour
    // refusal set verbatim and knocked on both doors:
    //
    //     __HARNESS.spawnNPC(…)           refused
    //     n_after_front                 : 0            <- front door holds
    //     window.__ENGINE.spawnNPC(…)     SPAWNED
    //     n_after_side                  : 1            <- an NPC standing in the world
    //     violations recorded           : 1            <- only the refused one
    //     window.__ENGINE.setTimeOfDay(3) SET          <- a second refused capability
    //
    // That is R2 §8's result reproduced through a door the round-3 rebuild did not close: "the
    // run completes, records no violation, and is certified as a clean first-hour session with
    // an agent-authored NPC standing in it."
    //
    // THE FIX, and it is deliberately not a second name list. RI-EXP01 step 1 says "ANY
    // INVOCATION VOIDS THE RUN" about the build's mutating surface, not about one global. So:
    //
    //   1. Enumerate the page's capability-bearing globals AT RUNTIME — every own `window`
    //      property whose value is an object or function carrying callable members. Classified
    //      by VALUE SHAPE, not by name, so a global `main.js` publishes next week is caught
    //      without this file being edited.
    //   2. `__HARNESS` keeps the per-method capability refusal — that surface is classified.
    //   3. EVERY OTHER capability-bearing global is SEALED WHOLE, behind a Proxy that records a
    //      violation and throws on any access that would yield a function or mutate it. There is
    //      no classification of `Engine`'s several hundred methods and there should not be: the
    //      sanctioned play surface is `__HARNESS`, and reaching around it is the violation
    //      regardless of which method is reached for.
    //   4. Anything unrecognised is sealed too, and NAMED in the artifact. Fail closed, exactly
    //      as the method classifier already does.
    //
    // Strings and numbers (`__ES_THREE`, `__ES_COMMIT`, `__ES_BUILT_AT`) carry no capability and
    // are left alone — again decided by shape, not by an allowlist of names that would rot.
    // =========================================================================================
    const sealResult = await installProhibitions(handle, derived, profile);

    log(`session-run: sealed ${sealResult.sealed.length} capability-bearing global(s) ` +
        `[${sealResult.sealed.join(', ') || 'none'}]; ` +
        `${sealResult.inert.length} inert global(s) left alone [${sealResult.inert.join(', ') || 'none'}]` +
        (sealResult.skipped.length ? `; skipped: ${sealResult.skipped.join(', ')}` : ''));
    if ((profile.refuse_capabilities || []).length > 0 && !sealResult.sealed.includes('__ENGINE')) {
      // The specific door R3 walked through. If it is not sealed, say so loudly rather than
      // certifying a session whose enforcement has a known hole.
      process.stderr.write(
        '[session-run] WARNING: window.__ENGINE was NOT sealed on this page. TOOL-COVERAGE-R3 §4 ' +
        'used exactly that object to spawn an NPC into a certified-clean first-hour session. ' +
        `Sealed globals: ${JSON.stringify(sealResult.sealed)}; skipped: ${JSON.stringify(sealResult.skipped)}.\n`);
    }

    await handle.h('setSeed', seed);
    await handle.hOpt('setMode', 'play-instrumented');
    await handle.hOpt('setRenderRate', renderPolicy === 'always' ? 60 : 0);
    await handle.hOpt('traceStart', { all: true });

    // ---- copy the brief in as an artifact ----------------------------------------------
    let brief = null;
    if (args.brief) {
      const bp = path.resolve(String(args.brief));
      if (fs.existsSync(bp)) {
        const txt = fs.readFileSync(bp, 'utf8');
        fs.writeFileSync(path.join(outDir, 'brief.md'), txt);
        brief = { path: path.relative(REPO_ROOT, bp), chars: txt.length };
      } else {
        brief = { path: path.relative(REPO_ROOT, bp), missing: true };
      }
    }

    const totalFrames = Math.round(minutes * 60 * 60);
    let stepped = 0;
    const shotDir = ensureDir(path.join(outDir, 'shots'));
    const shots = [];

    const doOp = async (op) => {
      const rec = { t_ms: Date.now() - t0, op: op.op, frame: stepped };
      try {
        switch (op.op) {
          case 'key':
            await handle.page.keyboard.down(op.key);
            await handle.page.waitForTimeout(Math.min(2000, Number(op.ms || 100)));
            await handle.page.keyboard.up(op.key);
            break;
          case 'click':
            await handle.page.mouse.click(Number(op.x || 0), Number(op.y || 0));
            break;
          case 'look':
            await handle.page.mouse.move(Number(op.dx || 0), Number(op.dy || 0));
            break;
          case 'step': {
            const n = Math.min(Number(op.frames || 60), totalFrames - stepped);
            if (n > 0) { await handle.h('stepFrames', n); stepped += n; }
            rec.frames = n;
            break;
          }
          case 'call': {
            // Goes through the page, so a refused method throws there and is recorded there.
            rec.method = op.method;
            rec.result = await handle.page.evaluate(async ({ m, a }) => {
              try { return { ok: true, value: await window.__HARNESS[m](...(a || [])) }; }
              catch (e) { return { ok: false, error: String(e && e.message || e) }; }
            }, { m: op.method, a: op.args });
            break;
          }
          case 'shot': {
            await handle.hOpt('setRenderRate', 60);
            await handle.hOpt('renderFrame');
            const p = path.join(shotDir, `s-${String(shots.length).padStart(3, '0')}.png`);
            await handle.page.screenshot({ path: p });
            shots.push(path.relative(outDir, p));
            if (renderPolicy !== 'always') await handle.hOpt('setRenderRate', 0);
            rec.shot = path.relative(outDir, p);
            break;
          }
          case 'note':
            notes.push({ t_ms: rec.t_ms, frame: stepped, text: String(op.text || '') });
            break;
          case 'end':
            rec.end = true;
            break;
          default:
            rec.error = `unknown op ${op.op}`;
        }
        rec.ok = !rec.error;
      } catch (e) { rec.ok = false; rec.error = String(e && e.message || e); }
      ops.push(rec);
      return rec;
    };

    // ---- drive -------------------------------------------------------------------------
    if (driveMode === 'stdio') {
      const rl = readline.createInterface({ input: process.stdin, terminal: false });
      for await (const line of rl) {
        const s = line.trim();
        if (!s) continue;
        let op; try { op = JSON.parse(s); } catch { process.stdout.write(JSON.stringify({ ok: false, error: 'bad JSON' }) + '\n'); continue; }
        const rec = await doOp(op);
        process.stdout.write(JSON.stringify({ ok: rec.ok, t_min: stepped / 3600, ...(rec.result ? { result: rec.result } : {}), ...(rec.error ? { error: rec.error } : {}) }) + '\n');
        if (op.op === 'end') break;
      }
      rl.close();
    } else if (driveMode.startsWith('script:')) {
      const sp = path.resolve(driveMode.slice('script:'.length));
      if (!fs.existsSync(sp)) die(EXIT.USAGE, `--drive script:<path> — ${sp} does not exist`);
      const script = JSON.parse(fs.readFileSync(sp, 'utf8'));
      for (const op of (Array.isArray(script) ? script : script.ops || [])) await doOp(op);
    }

    // Whatever the driver left unspent, step out honestly. An undriven session is recorded as
    // an undriven session; it is not padded with synthetic activity.
    if (stepped < totalFrames) {
      const budget = Math.min(totalFrames - stepped, 60 * 60 * 60);  // cap wall time
      await stepChunked(handle, budget, 600);
      stepped += budget;
    }

    if (args.shots) {
      for (let i = shots.length; i < Number(args.shots); i++) await doOp({ op: 'shot' });
    }

    // ---- collect ---------------------------------------------------------------------
    let traceRecords = [];
    const drained = await handle.hOpt('traceDrain');
    if (Array.isArray(drained)) traceRecords = traceRecords.concat(drained);
    const tail = await handle.hOpt('traceStop');
    if (Array.isArray(tail)) traceRecords = traceRecords.concat(tail);
    fs.writeFileSync(path.join(outDir, 'trace.jsonl'),
      traceRecords.map((r) => JSON.stringify(r)).join('\n') + '\n');

    const violations = await handle.page.evaluate(() => window.__SESSION_VIOLATIONS || []);
    const snapshot = await handle.hOpt('snapshot');
    const questState = await handle.hOpt('getQuestState');
    const capability = await handle.hOpt('getCapabilityReport');

    writeJson(path.join(outDir, 'ops.json'), ops);
    writeJson(path.join(outDir, 'notes.json'), notes);
    if (snapshot) writeJson(path.join(outDir, 'snapshot.json'), snapshot);

    return {
      schema: 'elder-souls/session@1',
      tool: 'tools/experience/session-run.mjs',
      session: sessionId, profile: profileId,
      profile_refuses_capabilities: profile.refuse_capabilities,
      profile_prohibitions: derived.refuse,
      profile_prohibitions_count: derived.refuse.length,
      harness_surface_size: derived.surface.length,
      // The audit trail. A reader must be able to see WHICH methods were refused and why, and
      // to spot a method the classification does not cover — which is refused, but loudly.
      classification_by_capability: derived.byCapability,
      classification_unclassified_and_refused: derived.unclassified,
      classification_complete: derived.unclassified.length === 0,
      // ROUND 4 — the ENFORCEMENT SCOPE, published so a critic can check the door as well as
      // the name list. TOOL-COVERAGE-R3 §4: prohibitions were installed on one object and the
      // game publishes two.
      enforcement_scope: {
        classified_surface: '__HARNESS',
        sealed_globals: sealResult.sealed,
        inert_globals_left_alone: sealResult.inert,
        skipped: sealResult.skipped,
        engine_door_sealed: sealResult.sealed.includes('__ENGINE'),
        method: 'Every own window property named `__*` whose VALUE carries callable members is ' +
                'sealed behind a recording Proxy. Classified by shape, not by a name list, so a ' +
                'global main.js publishes next week is caught without editing this file. ' +
                'Strings and numbers (__ES_THREE, __ES_COMMIT) carry no capability and are left.',
        why: 'RI-EXP01 step 1 says ANY INVOCATION VOIDS THE RUN about the build\'s mutating ' +
             'surface, not about one global. __HARNESS.spawnNPC is a wrapper over ' +
             'Engine.spawnNPC, and window.__ENGINE published the unwrapped method.',
      },
      item_named_methods: profile.item_names,
      profile_source: profile.source,
      brief,
      seed, minutes_requested: minutes, render_policy: renderPolicy, drive: driveMode,
      frames_stepped: stepped, minutes_simulated: stepped / 3600,
      trace_records: traceRecords.length,
      ops: ops.length, notes: notes.length, shots: shots.length,
      violations,
      // The headline. RI-EXP01: "any invocation voids the run." Not a caveat — void.
      void: profile.voids_run && violations.length > 0,
      undriven: driveMode === 'none',
      undriven_note: driveMode === 'none'
        ? 'This session had NO DRIVING AGENT. It is recorded as an hour in which the player did ' +
          'almost nothing, which is what happened. Any beat sheet diffed against it will show ' +
          'nearly every beat missing, and that is a fact about this run, not about the build.'
        : null,
      capability_report: capability,
      quest_state_declared_incomplete: !!(questState && questState._declared_incomplete),
      url: handle.url, harness_version: handle.harnessVersion, build: handle.buildInfo,
      git: gitInfo(), data: hashDataTree(),
      page_errors: handle.errors,
      started_at: new Date(t0).toISOString(), ended_at: new Date().toISOString(), wall_ms: Date.now() - t0,
      artifacts: { trace: 'trace.jsonl', ops: 'ops.json', notes: 'notes.json', shots },
      ok: handle.errors.length === 0,
    };
  } finally { await handle.close(); }
}

async function stepChunked(handle, frames, chunk) {
  let done = 0;
  while (done < frames) {
    const n = Math.min(chunk, frames - done);
    await handle.h('stepFrames', n);
    done += n;
  }
}

// ---------------------------------------------------------------------------------------------
// --self-test. TOOL-COVERAGE-R2 §8's four bypasses are cases 3-6, by name.
// ---------------------------------------------------------------------------------------------
/**
 * Install the profile's prohibitions IN THE PAGE and seal every other capability-bearing global.
 *
 * ROUND 4 — this is ONE function called by the run path AND by `--self-test`. Round 3's
 * self-test installed its own simplified copy of the prohibition block, so it was testing a
 * paraphrase of the tool rather than the tool. TOOL-COVERAGE-R3 §4 got its bypass by installing
 * "verbatim as session-run.mjs:511 installs it" — the only way to be sure a critic's verbatim
 * copy and this file agree is for there to be exactly one of them.
 */
export async function installProhibitions(handle, derived, profile) {
  return handle.page.evaluate((cfg) => {
      const { refuse, sealGlobals } = cfg;
      const H = window.__HARNESS;
      window.__SESSION_VIOLATIONS = [];
      window.__SESSION_ORIGINALS = {};
      for (const m of refuse) {
        if (typeof H[m] !== 'function') continue;
        window.__SESSION_ORIGINALS[m] = H[m];
        H[m] = function refused() {
          const err = new Error(
            `__HARNESS.${m}() is refused under this session profile. ` +
            'RI-EXP01 step 1: "any invocation voids the run".');
          window.__SESSION_VIOLATIONS.push({ method: m, at: Date.now(), stack: String(err.stack || '').slice(0, 600) });
          throw err;
        };
      }
      if (!sealGlobals) return { sealed: [], inert: [], skipped: ['sealing disabled for this profile'] };

      // --- discover capability-bearing globals, by SHAPE ---------------------------------
      const carriesCapability = (v) => {
        if (v === null) return false;
        const t = typeof v;
        if (t === 'function') return true;
        if (t !== 'object') return false;                 // strings, numbers, booleans: inert
        try {
          for (const k in v) { if (typeof v[k] === 'function') return true; }
          for (const k of Object.getOwnPropertyNames(v)) { if (typeof v[k] === 'function') return true; }
          const proto = Object.getPrototypeOf(v);
          if (proto && proto !== Object.prototype) {
            for (const k of Object.getOwnPropertyNames(proto)) {
              if (k !== 'constructor' && typeof proto[k] === 'function') return true;
            }
          }
        } catch { return true; }                          // unreadable -> treat as capable
        return false;
      };

      const sealed = [], inert = [], skipped = [];
      window.__SESSION_SEALED_ORIGINALS = {};
      for (const name of Object.getOwnPropertyNames(window)) {
        if (name === '__HARNESS') { skipped.push(name); continue; }          // classified surface
        if (name.startsWith('__SESSION_')) { skipped.push(name); continue; } // this machinery
        if (!name.startsWith('__')) continue;             // the build's own publishing convention
        let val;
        try { val = window[name]; } catch { continue; }
        if (!carriesCapability(val)) { inert.push(name); continue; }
        const desc = Object.getOwnPropertyDescriptor(window, name);
        if (desc && desc.configurable === false && desc.writable === false) {
          skipped.push(`${name} (non-configurable, could not seal)`);
          continue;
        }
        window.__SESSION_SEALED_ORIGINALS[name] = val;
        const record = (op, prop) => {
          const err = new Error(
            `window.${name}.${String(prop)} is SEALED under this session profile. ` +
            'RI-EXP01 step 1: "any invocation voids the run". The sanctioned surface is ' +
            '__HARNESS; reaching around it is the violation, whichever member is reached for.');
          window.__SESSION_VIOLATIONS.push({
            method: `window.${name}.${String(prop)}`, global: name, op, at: Date.now(),
            stack: String(err.stack || '').slice(0, 600),
          });
          return err;
        };
        const handler = {
          get(t, prop, r) {
            if (prop === Symbol.toStringTag || prop === 'constructor' || typeof prop === 'symbol') {
              return Reflect.get(t, prop, t);
            }
            const v = Reflect.get(t, prop, t);
            // Reading a plain data field is not an invocation; reaching for a METHOD is.
            if (typeof v === 'function') {
              const err = record('get-method', prop);
              return function sealed$() { throw err; };
            }
            // A nested object is another door; seal it the same way, recursively.
            if (v && typeof v === 'object') return new Proxy(v, handler);
            return v;
          },
          set(t, prop) { throw record('set', prop); },
          deleteProperty(t, prop) { throw record('delete', prop); },
          apply(t, thisArg, a) { throw record('apply', '()'); },
        };
        try {
          Object.defineProperty(window, name, {
            configurable: true, enumerable: desc ? desc.enumerable : true,
            value: typeof val === 'function'
              ? new Proxy(val, handler)
              : new Proxy(val, handler),
            writable: true,
          });
          sealed.push(name);
        } catch (e) { skipped.push(`${name} (${String((e && e.message) || e).slice(0, 80)})`); }
      }
      return { sealed, inert, skipped };
  }, { refuse: derived.refuse, sealGlobals: (profile.refuse_capabilities || []).length > 0 });
}

async function selfTest() {
  const lines = [];
  let failed = 0;
  const ok = (n, pass, d) => {
    lines.push(`${pass ? 'PASS' : 'FAIL'} ${n} — ${d}`);
    process.stdout.write(lines[lines.length - 1] + '\n');   // flush as produced
    if (!pass) failed++;
  };

  const handle = await launchGame({ ...args, width: 320, height: 240 });
  try {
    const prof = PROFILES['first-hour'];
    const derived = await deriveForProfile(handle, prof);

    ok('the classification covers the WHOLE live surface (fail-closed, so a gap is refused not allowed)',
      derived.unclassified.length === 0,
      `${derived.surface.length} methods classified into ${CAPABILITIES.length} capabilities; ` +
      `unclassified: ${derived.unclassified.join(', ') || 'none'} (any would be REFUSED)`);

    ok('the refusal set is DERIVED, not a six-name list',
      derived.refuse.length > prof.item_names.length * 3,
      `${derived.refuse.length} of ${derived.surface.length} methods refused, against RI-EXP01's ` +
      `${prof.item_names.length} literal names`);

    ok("RI-EXP01's own six names are all inside the derived set",
      derived.missedItemNames.length === 0,
      `${prof.item_names.join(', ')} — all refused`);

    // NULL CONTROL. Every method the critic bypassed must WORK before the profile is installed,
    // or "it was refused" would be indistinguishable from "it never worked".
    const BYPASSES = [
      ['spawnNPC', "the critic's ghost: spawn was refused, spawnNPC spawned and listNPCs went 0 -> 1"],
      ['restoreState', 'loadState was refused, restoreState was not'],
      ['travelRide', 'teleport was refused, travelRide was not'],
      ['boardTravel', 'teleport was refused, boardTravel was not'],
      ['setTravelMark', 'teleport was refused, setTravelMark was not'],
      ['__breakTravelFence', 'a method literally named __breakTravelFence was permitted'],
      ['spawnEncounter', 'the other four spawn aliases'],
      ['spawnCivilian', 'the other four spawn aliases'],
      ['spawnGuard', 'the other four spawn aliases'],
      ['spawnProp', 'the other four spawn aliases'],
    ].filter(([m]) => derived.surface.includes(m));

    ok('CONTROL: every bypassed method EXISTS on this build before anything is installed',
      BYPASSES.length >= 6, BYPASSES.map(([m]) => m).join(', '));

    const before = await handle.page.evaluate(
      (ms) => ms.map((m) => ({ m, present: typeof window.__HARNESS[m] === 'function' })), BYPASSES.map(([m]) => m));
    ok('CONTROL: and they are callable functions, not stubs already throwing',
      before.every((r) => r.present), JSON.stringify(before.map((r) => r.m + ':' + r.present)));

    // The critic's exact reproduction: spawn an NPC and watch listNPCs move, BEFORE the profile.
    const ghostBefore = await handle.page.evaluate(async () => {
      const H = window.__HARNESS;
      const n0 = H.listNPCs().length;
      let spawned = null;
      try { spawned = await H.spawnNPC({ eid: 'selftest-ghost', kind: 'npc', name: 'Ghost', x: 3, z: 3 }); } catch (e) { spawned = { error: String(e && e.message || e) }; }
      return { n0, n1: H.listNPCs().length, spawned };
    });
    ok('CONTROL: spawnNPC really does put an NPC in the world on an unprotected build',
      ghostBefore.n1 > ghostBefore.n0,
      `listNPCs ${ghostBefore.n0} -> ${ghostBefore.n1}, spawnNPC returned ${JSON.stringify(ghostBefore.spawned).slice(0, 120)}`);

    // ---- R3 §4's SIDE DOOR, measured BEFORE the profile is installed -------------------------
    // The null control for the whole section: the side door must demonstrably WORK on an
    // unprotected build, or "it was sealed" is indistinguishable from "it never existed".
    const sideBefore = await handle.page.evaluate(() => {
      const out = { has_engine: typeof window.__ENGINE === 'object' && window.__ENGINE !== null };
      if (!out.has_engine) return out;
      const H = window.__HARNESS;
      out.n0 = H.listNPCs().length;
      try {
        window.__ENGINE.spawnNPC({ eid: 'selftest-side-0', kind: 'npc', name: 'Side Door', x: 6, z: 6 });
        out.spawned = true;
      } catch (e) { out.spawned = false; out.err = String((e && e.message) || e).slice(0, 120); }
      out.n1 = H.listNPCs().length;
      try { window.__ENGINE.setTimeOfDay(3); out.tod = 'SET'; }
      catch (e) { out.tod = 'threw: ' + String((e && e.message) || e).slice(0, 80); }
      return out;
    });
    ok('CONTROL: window.__ENGINE exists and its unwrapped spawnNPC really does move the world',
      sideBefore.has_engine && sideBefore.n1 > sideBefore.n0,
      sideBefore.has_engine
        ? `listNPCs ${sideBefore.n0} -> ${sideBefore.n1} via window.__ENGINE.spawnNPC, ` +
          `setTimeOfDay -> ${sideBefore.tod}. This is TOOL-COVERAGE-R3 §4's bypass, reproduced.`
        : 'window.__ENGINE is not published on this build — the R3 bypass cannot be reproduced');

    // ---- install, THROUGH THE TOOL'S OWN INSTALLER -------------------------------------------
    // Round 3's self-test installed a simplified paraphrase here and so tested a paraphrase.
    const sealed = await installProhibitions(handle, derived, prof);
    ok('the installer seals every capability-bearing global, not only __HARNESS',
      sealed.sealed.includes('__ENGINE'),
      `sealed: [${sealed.sealed.join(', ') || 'none'}]; inert (no callable members, left alone): ` +
      `[${sealed.inert.join(', ') || 'none'}]${sealed.skipped.length ? `; skipped: ${sealed.skipped.join(', ')}` : ''}`);

    // RED -> the bypasses are closed.
    const after = await handle.page.evaluate(async (ms) => {
      const out = [];
      for (const m of ms) {
        try { await window.__HARNESS[m](); out.push({ m, threw: false }); }
        catch { out.push({ m, threw: true }); }
      }
      return { out, violations: window.__SESSION_VIOLATIONS.length };
    }, BYPASSES.map(([m]) => m));
    ok("TOOL-COVERAGE-R2 §8's bypasses are now ALL refused",
      after.out.every((r) => r.threw),
      after.out.map((r) => `${r.m}:${r.threw ? 'refused' : 'ALLOWED'}`).join(' '));
    ok('each attempt is recorded as a violation', after.violations === after.out.length,
      `${after.violations} violation(s) for ${after.out.length} attempt(s)`);

    // And the world did NOT move.
    const ghostAfter = await handle.page.evaluate(async () => {
      const H = window.__HARNESS;
      const n0 = H.listNPCs().length;
      try { await H.spawnNPC({ eid: 'selftest-ghost-2', kind: 'npc', name: 'Ghost2', x: 4, z: 4 }); } catch { /* expected */ }
      return { n0, n1: H.listNPCs().length };
    });
    ok('ENTITY-SIDE: the world does not move when a refused spawn is attempted',
      ghostAfter.n1 === ghostAfter.n0,
      `listNPCs ${ghostAfter.n0} -> ${ghostAfter.n1} across a refused spawnNPC`);

    // Every method RI-EXP01 names must throw too.
    const itemNames = await handle.page.evaluate(async (ms) => {
      const out = [];
      for (const m of ms) { try { await window.__HARNESS[m](); out.push({ m, threw: false }); } catch { out.push({ m, threw: true }); } }
      return out;
    }, prof.item_names);
    ok("RI-EXP01's six still throw (the derivation did not lose them)",
      itemNames.every((r) => r.threw), itemNames.map((r) => `${r.m}:${r.threw ? 'refused' : 'ALLOWED'}`).join(' '));

    ok('cannot be bypassed by calling window.__HARNESS directly',
      (await handle.page.evaluate(async () => {
        try { await window.__HARNESS.teleport(1, 1, {}); return 'BYPASSED'; } catch { return 'refused'; }
      })) === 'refused', 'page.evaluate reaches the same replaced object');

    // =========================================================================================
    // ROUND 4 — THE SIDE DOOR, after installation. This is the check whose ABSENCE let R3
    // certify a clean first-hour session with an agent-authored NPC standing in it. The
    // round-3 self-test's own line — "cannot be bypassed by calling window.__HARNESS directly"
    // — is scoped correctly and passes; it is the SCOPE that was wrong.
    // =========================================================================================
    const sideAfter = await handle.page.evaluate(() => {
      const H = window.__HARNESS;
      const n0 = H.listNPCs().length;
      const r = { n0, attempts: [] };
      const attempt = (label, fn) => {
        try { fn(); r.attempts.push({ label, result: 'ALLOWED' }); }
        catch (e) { r.attempts.push({ label, result: 'refused', why: String((e && e.message) || e).slice(0, 90) }); }
      };
      attempt('__ENGINE.spawnNPC', () => window.__ENGINE.spawnNPC({ eid: 'selftest-side-1', kind: 'npc', name: 'Side', x: 7, z: 7 }));
      attempt('__ENGINE.setTimeOfDay', () => window.__ENGINE.setTimeOfDay(3));
      attempt('__ENGINE.teleport', () => window.__ENGINE.teleport(999, 999));
      // A NESTED door: reaching a method one level down must be sealed too, or the Proxy is
      // theatre. `engine.sim` / `engine.input` are the obvious next handholds.
      attempt('__ENGINE.sim.<nested>', () => window.__ENGINE.sim.findEntity('player'));
      attempt('__ENGINE.input.<nested>', () => window.__ENGINE.input.reset(0));
      // And WRITING to the engine — the most direct mutation of all.
      attempt('__ENGINE.__raceGatesEnabled = true (write)', () => { window.__ENGINE.__raceGatesEnabled = true; });
      r.n1 = H.listNPCs().length;
      r.violations = (window.__SESSION_VIOLATIONS || []).length;
      return r;
    });
    ok('R4: window.__ENGINE is SEALED — every side-door reach is refused (TOOL-COVERAGE-R3 §4)',
      sideAfter.attempts.every((a) => a.result === 'refused'),
      sideAfter.attempts.map((a) => `${a.label}:${a.result}`).join(' '));
    ok('R4: ENTITY-SIDE — no NPC reaches the world through the side door',
      sideAfter.n1 === sideAfter.n0,
      `listNPCs ${sideAfter.n0} -> ${sideAfter.n1} across ${sideAfter.attempts.length} side-door ` +
      'attempts. R3 measured 0 -> 1 here and the run was still certified clean.');
    ok('R4: every side-door attempt is RECORDED as a violation, so the run is voided',
      sideAfter.violations > after.violations,
      `violations ${after.violations} -> ${sideAfter.violations}. R3: "violations recorded: 1 ` +
      '(only the refused one)" while an NPC stood in the world.');

    // FAIL CLOSED on a global that appears and is not classified — the R3 §4 rebuild's last
    // clause. A global published AFTER this file was written must be sealed without an edit.
    const unknownGlobal = await handle.page.evaluate(async () => {
      window.__ES_FUTURE_TOY = { grantEverything() { window.__ES_TOY_FIRED = true; return 'granted'; } };
      window.__ES_INERT_STRING = 'r147';
      return true;
    });
    const reseal = await installProhibitions(handle, derived, prof);
    const unknownAfter = await handle.page.evaluate(() => {
      const out = {};
      try { out.call = window.__ES_FUTURE_TOY.grantEverything(); } catch (e) { out.call = 'refused'; }
      out.fired = !!window.__ES_TOY_FIRED;
      out.inert_readable = window.__ES_INERT_STRING;
      return out;
    });
    ok('R4: FAIL CLOSED — a capability-bearing global this file has never heard of is sealed',
      unknownGlobal && reseal.sealed.includes('__ES_FUTURE_TOY') &&
      unknownAfter.call === 'refused' && unknownAfter.fired === false,
      `__ES_FUTURE_TOY sealed=${reseal.sealed.includes('__ES_FUTURE_TOY')}, ` +
      `call=${unknownAfter.call}, side effect fired=${unknownAfter.fired}. Classified by SHAPE, ` +
      'so main.js can publish a new global without this file being edited.');
    ok('R4: null control — an INERT global (a version string) is left alone, not sealed',
      reseal.inert.includes('__ES_INERT_STRING') && unknownAfter.inert_readable === 'r147',
      `__ES_INERT_STRING still reads "${unknownAfter.inert_readable}" and is listed inert. ` +
      'A sealer that seals everything would break the build\'s own version reporting.');

    // GREEN. A profile that breaks everything measures nothing.
    const stillWorks = await handle.page.evaluate(async () => {
      const out = {};
      for (const m of ['listEntities', 'getPlayerStats', 'getUIState', 'stepFrames', 'queueInputs']) {
        try { await window.__HARNESS[m](m === 'stepFrames' ? 1 : (m === 'queueInputs' ? [] : undefined)); out[m] = 'ok'; }
        catch (e) { out[m] = 'THREW: ' + String(e && e.message || e).slice(0, 80); }
      }
      return out;
    });
    ok('GREEN: observation, input and stepping still work under the profile',
      Object.values(stillWorks).every((v) => v === 'ok'), JSON.stringify(stillWorks));

    ok('a violation VOIDS the run (not a footnote)',
      prof.voids_run && after.violations > 0,
      `voids_run=${prof.voids_run}, violations=${after.violations} => void`);

    // FAIL-CLOSED, proved rather than asserted: a method the classifier does not know is refused.
    const fakeSurface = [...derived.surface, 'grantEverythingToTheDriver'];
    const withUnknown = deriveRefusalSet(fakeSurface, prof.refuse_capabilities);
    ok('FAIL-CLOSED: an unclassified method is REFUSED, not permitted by default',
      withUnknown.refuse.includes('grantEverythingToTheDriver')
      && withUnknown.unclassified.includes('grantEverythingToTheDriver')
      && capabilityOf('grantEverythingToTheDriver') === null,
      'a method added tomorrow is prohibited until somebody rules on it, and is named in the manifest');
  } finally { await handle.close(); }

  process.stdout.write(`\nsession-run self-test: ${failed === 0 ? 'PASS' : 'FAIL'} (${lines.length - failed}/${lines.length})\n`);
  return failed === 0 ? 0 : 1;
}
