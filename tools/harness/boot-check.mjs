#!/usr/bin/env node
// boot-check.mjs — does the GAME come up? Not the environment: the game.
//
// This exists because `smoke.mjs` is honest about being an *environment* self-test — its own
// header says "It does not touch the game" — and the orchestrator was nonetheless using it as a
// post-commit boot check. So a build could ship with the engine failing to construct and smoke
// would pass 6/6, which is exactly what happened: a data file violating its own assertion threw
// out of input setup before `window.__HARNESS` was ever assigned, and three separate agents lost
// measurement rounds to it while every boot check on the tree stayed green.
//
// The single assertion that matters: `window.__HARNESS` exists after the page has had time to
// construct. Everything else here is diagnosis for when it does not.
//
// Run: node tools/harness/boot-check.mjs   (wired into .githooks/pre-commit and the orchestration tick)

import { launchGame } from '../lib/browser.mjs';
import { parseArgs, wantsHelp, usage, log, EXIT, writeJson } from '../lib/cli.mjs';

const USAGE = `
boot-check.mjs — prove the engine actually constructs.

USAGE
  node tools/harness/boot-check.mjs [--timeout <ms>] [--out <file>]

OPTIONS
  --timeout <ms>  How long to wait for window.__HARNESS (default 30000)
  --out <path>    Write a JSON report here
  --help          This message

Exit 0 = the engine came up. Non-zero = the build is broken and every measurement
taken against it is void. Page errors and failed requests are printed on failure.
`;

const args = parseArgs(process.argv.slice(2));
if (wantsHelp(args)) { usage(USAGE); process.exit(0); }

const timeout = Number(args.timeout ?? 30000);
const errors = [];
let handle;

try {
  handle = await launchGame({ ...args, width: 320, height: 240 });
  const page = handle.page;
  page.on('pageerror', e => errors.push({ kind: 'pageerror', text: String(e).slice(0, 400) }));
  page.on('console', m => { if (m.type() === 'error') errors.push({ kind: 'console', text: m.text().slice(0, 400) }); });
  page.on('requestfailed', r => errors.push({ kind: 'requestfailed', text: r.url().slice(-120) }));

  const up = await page.waitForFunction(() => !!window.__HARNESS, null, { timeout })
    .then(() => true).catch(() => false);

  // A harness object that exists but cannot answer is not a booted game.
  const alive = up && await page.evaluate(() => {
    try { return typeof window.__HARNESS.getState === 'function' || typeof window.__HARNESS.snapshot === 'function'; }
    catch { return false; }
  }).catch(() => false);

  // A game that constructs but cannot draw a frame is still broken, and this check used to say
  // PASS through both of them. The tool builder hit it twice in one session: `_mapPoiNames` and
  // `_spawnInscriptions` were each called from the render path before the method existed, and
  // boot-check stayed green throughout because it never asked for a picture. So: step once with
  // rendering on and require that a frame actually came out. 320x240, one frame — cheap enough
  // to keep in the commit hook.
  let drew = null, drawError = null;
  if (alive) {
    drew = await page.evaluate(async () => {
      const H = window.__HARNESS;
      try {
        const before = window.__ENGINE?.loop?.stats?.rendersTotal ?? null;
        if (typeof H.setRenderRate === 'function') H.setRenderRate(60);
        if (typeof H.stepFrames === 'function') H.stepFrames(1); else return null;
        const after = window.__ENGINE?.loop?.stats?.rendersTotal ?? null;
        if (before == null || after == null) return null;   // no counter: cannot say, do not claim
        return after > before;
      } catch (e) { return { error: String(e).slice(0, 400) }; }
    }).catch(e => ({ error: String(e).slice(0, 400) }));
    if (drew && typeof drew === 'object') { drawError = drew.error; drew = false; }
  }

  // A game that constructs, answers and draws can still be broken on the SECOND frame after a
  // load, and this check used to say PASS through that too. `save/fight.js` serialised the live
  // `SoulsAI` as a plain object; the next fixed step threw `this.ai.step is not a function` and
  // killed every stepping probe in the project, for a wave, while every boot check on the tree
  // stayed green — because boot does not step, and nothing here had ever loaded a save.
  //
  // So: put one hostile on the floor, save, load, and step. That is the smallest motion that
  // exercises save -> load -> step, which is the seam a whole class of defect hides behind.
  //
  // BUDGET, measured and then trimmed rather than assumed — every agent runs this, so a second
  // here is a second times fourteen. `saveRoundTrip()` cost 3.11 s, because on top of the load
  // it takes two `getStateHash()` calls (a full `saveState()` each) and a `stateDiff`, none of
  // which this arm needs. `saveState()` -> structural clone -> `loadState()` is the same seam
  // for ~1.1 s: spawn 1 ms, first step 139 ms (the AI is built there), saveState 17 ms, clone
  // 18 ms, loadState ~900 ms, final step 15 ms. The 900 ms is `loadState()` rebuilding the
  // world, which is the thing under test and is not reducible.
  //
  // It claims NOTHING it cannot know. If the verbs are absent, or no live AI ever came up, the
  // result is null and the gate below ignores it: a vacuous arm reported as a pass is how this
  // project has shipped three inert controls.
  let stepped = null, stepError = null, stepMs = null;
  if (alive && drew !== false) {
    const r = await page.evaluate(async () => {
      const H = window.__HARNESS;
      const t0 = performance.now();
      try {
        for (const v of ['stepFrames', 'spawn', 'saveState', 'loadState', 'setRenderRate']) {
          if (typeof H[v] !== 'function') return { skip: `no ${v}()` };
        }
        H.setRenderRate(0);
        const p = H.getCombatState && H.getCombatState().player;
        if (!p) return { skip: 'no combat state' };
        // `guard_legion` is in ai.json's override table, so it resolves to `souls` and really
        // does build a SoulsAI. A body that resolves to `none` would make this arm vacuous.
        const eid = H.spawn('guard_legion', p.pos[0] + 4, p.pos[2] + 1, {});
        if (typeof H.aggro === 'function') { try { H.aggro(eid); } catch { /* not fatal */ } }
        H.stepFrames(1);                       // the AI is built on the controller's first step
        const liveAI = () => {
          const c = window.__ENGINE && window.__ENGINE.combat;
          if (!c || !c.enemies) return null;
          let n = 0;
          for (const [, ctl] of c.enemies) if (ctl.ai && typeof ctl.ai.step === 'function') n++;
          return n;
        };
        const before = liveAI();
        if (!before) return { skip: 'no live AI on the floor — nothing for this arm to lose' };
        H.loadState(JSON.parse(JSON.stringify(H.saveState())));   // the round trip, cheaply
        const after = liveAI();
        H.stepFrames(2);                       // <- the frame the defect lived on
        return { ok: after >= before, ai_before: before, ai_after: after, ms: performance.now() - t0 };
      } catch (e) { return { error: String(e && e.message || e).slice(0, 300), ms: performance.now() - t0 }; }
    }).catch((e) => ({ error: String(e).slice(0, 300) }));
    stepMs = r && r.ms != null ? Math.round(r.ms) : null;
    if (r && r.skip) stepped = null;           // cannot know: claim nothing
    else if (r && r.error) { stepped = false; stepError = r.error; }
    else if (r && r.ok === false) { stepped = false; stepError = `a live AI was lost across the round trip: ${r.ai_before} before, ${r.ai_after} after`; }
    else if (r && r.ok === true) stepped = true;
  }

  const report = {
    ok: !!alive && drew !== false && stepped !== false, harness_present: up, harness_responsive: !!alive,
    rendered_a_frame: drew, render_error: drawError,
    stepped_after_a_load: stepped, step_error: stepError, step_ms: stepMs,
    errors, timeout_ms: timeout,
  };
  if (args.out) writeJson(args.out, report);

  // ARMED, and only after being shown to be both silent and capable of firing — the rule this
  // project keeps paying for is: author the check, prove it is silent on the shipped tree, prove
  // it can go red, and only then let it fail closed.
  //   * silent on HEAD, quiet box: `rendered_a_frame: true`.
  //   * able to fail: driven directly, `setRenderRate(60)` then one step advances
  //     `loop.stats.rendersTotal`; `setRenderRate(0)` then one step does not. An instrument that
  //     read true in both cases could not notice a frame that never came out.
  // It stays quiet where it cannot know: if the engine exposes no render counter, `drew` is null
  // and nothing is claimed either way.
  const STRICT_RENDER = true;
  if (alive && drew === false) {
    log(`[harness] boot-check: the engine constructed but no frame came out.`);
    if (drawError) log(`  ${drawError}`);
    for (const e of errors.slice(0, 8)) log(`  [${e.kind}] ${e.text}`);
    if (STRICT_RENDER) {
      console.log(JSON.stringify(report));
      await handle.close().catch(() => { });
      process.exit(EXIT?.FAIL ?? 12);
    }
  }

  // ARMED, and on the same terms as the render assertion above (RULES 13).
  //   * silent on the repaired tree: `stepped_after_a_load: true`, ~0.6 s.
  //   * able to fail: run against the pre-fix source, `stepFrames(2)` after the round trip
  //     throws `this.ai.step is not a function` and this arm reports it. Both the throw and the
  //     quieter variant are caught — an AI restored as `null` does not throw at all, so the arm
  //     counts live AIs before and after rather than only watching for an exception.
  //   * quiet where it cannot know: no verbs, no combat state or no live AI on the floor and
  //     `stepped_after_a_load` is null and nothing is claimed either way.
  const STRICT_STEP = true;
  if (alive && stepped === false) {
    log('[harness] boot-check: the engine drew a frame and then died on the step after a load.');
    if (stepError) log(`  ${stepError}`);
    log('  This is the shape that stays invisible: boot passes, the first frame passes, and every');
    log('  stepping probe on the box dies with an error about its own caller. See tools/check-save-shape.mjs.');
    for (const e of errors.slice(0, 8)) log(`  [${e.kind}] ${e.text}`);
    if (STRICT_STEP) {
      console.log(JSON.stringify(report));
      await handle.close().catch(() => { });
      process.exit(EXIT?.FAIL ?? 12);
    }
  }

  if (!alive) {
    log(`boot-check: FAIL — window.__HARNESS ${up ? 'present but unresponsive' : 'never appeared'} within ${timeout} ms`);
    if (!errors.length) log('boot-check: no page errors captured — suspect a rejected promise or a throw inside module setup');
    for (const e of errors.slice(0, 8)) log(`  ${e.kind}: ${e.text}`);
    log('boot-check: every measurement taken against this build is void until this passes.');
    process.exitCode = EXIT.HARNESS_ABSENT;
  } else {
    log('boot-check: PASS — the engine constructed and the harness answers.');
  }
} catch (e) {
  log(`boot-check: FAIL — could not launch: ${e.message}`);
  process.exitCode = EXIT.HARNESS_ABSENT;
} finally {
  try { await handle?.close?.(); } catch { }
}
