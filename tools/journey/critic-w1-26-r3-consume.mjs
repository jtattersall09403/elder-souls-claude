#!/usr/bin/env node
// critic-w1-26-r3-consume.mjs — RI-MTH07 on the round's load-bearing model, and the
// stopped-world/crate discrimination the round claims to have fixed.
//
// Owner: the W1-26 round-3 CRITIC. Rule 5 (mandatory) and rule 8.
//
// ---- H, CONSUMPTION -------------------------------------------------------------------------
// The model is the race the scribe OBSERVES. Round 3's claim is `coupling 1` with four bodies
// giving four distinct DRAWN sentences and four distinct writs. The builder perturbed by handing
// four bodies to its own harness path. This perturbs somewhere else on purpose:
//
//   * the field is written directly on the RUNNING WORLD (`sim.identity.race`) and the scene is
//     then opened through `titleActivate('new')` — the title row a player commits to — so the
//     observation has to travel body -> census -> model -> glyph without anyone passing it as an
//     argument. `censusBegin({race})` is never called in this file.
//   * a NULL CONTROL: the same body twice must give byte-identical drawn text, or the four
//     differences below are noise.
//   * a SECOND consumer, because one consumer is a demonstration and two is a claim about the
//     field: `_playerGates()`/`reactionTo()` read the same `sim.identity.race`, so the four
//     bodies must also differ in what the province thinks of them. A model with one reader in
//     one scene is the shape sixteen subsystems here have already shipped.
//   * a TEARDOWN (rule 6): freeze the observation to one literal and watch the four arms collapse
//     to one sentence and one writ. Four arms that were never seen to converge are four arms.
//
// ---- D, STOPPED WORLD vs CRATE --------------------------------------------------------------
// Round 2 read twenty 0.000 m samples as geometry. Round 3 says the world was not advancing and
// adds `frames_advanced` so the two cannot be confused again. Both halves are checked:
//
//   D1  the frozen corner (-1.342, 3.862) is not a trap — eight directions, PER-ARM RESET,
//       and how many distinct destinations. This is the builder's own claim, re-run.
//   D2  `frames_advanced` actually discriminates. Two arms constructed to be identical in
//       "metres moved" and different in nothing else: a body against solid geometry with the
//       world RUNNING, and a body in open floor with the world STOPPED. If the field cannot
//       separate those two it has not bought anything.
//   D3  the builder's own inert-control failure, reproduced: eight arms over ONE shared state
//       must return the identical number, and eight arms with a per-arm reset must not. This is
//       the control that catches the control.
//
// EXIT: non-zero if the coupling is not 1, if the null control differs, if the teardown does not
// collapse, or if `frames_advanced` cannot tell a stopped world from a crate.
//
// USAGE
//   node tools/journey/critic-w1-26-r3-consume.mjs [--json <path>]
'use strict';

import path from 'node:path';
import fs from 'node:fs';
import { parseArgs, wantsHelp, usage, writeJson, REPO_ROOT, REPORTS_DIR, ensureDir } from '../lib/cli.mjs';
import { launchGame } from '../lib/browser.mjs';

const USAGE = `
critic-w1-26-r3-consume.mjs — four bodies, four sentences, four writs; and a stopped world.

USAGE
  node tools/journey/critic-w1-26-r3-consume.mjs [--json <path>]
`;
const args = parseArgs();
if (wantsHelp(args)) usage(USAGE);
const jsonPath = args.json ? path.resolve(String(args.json)) : path.join(REPORTS_DIR, 'critic-w1-26-r3', 'consume.json');
ensureDir(path.dirname(jsonPath));
const say = (s) => process.stdout.write(s + '\n');
const loadavg = () => { try { return fs.readFileSync('/proc/loadavg', 'utf8').trim().split(/\s+/).slice(0, 3).map(Number); } catch { return null; } };

const out = {
  schema: 'elder-souls/critic-consume@1', piece: 'W1-26-r3', role: 'critic',
  conditions: { loadavg_at_start: loadavg() },
  arms: [], passes: [], failures: [], checks: {},
};
const pass = (id, what, d) => { out.passes.push(id); out.checks[id] = { ok: true, what, ...d }; say(`  PASS ${id}  ${what}`); };
const fail = (id, what, d) => { out.failures.push(id); out.checks[id] = { ok: false, what, ...d }; say(`  FAIL ${id}  ${what}`); };

// Four bodies the build's own `races.json` knows. The first draft used `altmer` as the fourth
// and the run THREW — which is the finding in section D of the verdict, not a typo: `bodyRace()`
// silently returns null for any id not in `races.json`, and the desk then refuses forever. It is
// measured deliberately below as `ILLEGAL`.
const BODIES = ['saxhleel', 'dunmer', 'khajiit', 'nord'];
const ILLEGAL = 'altmer';   // a real Elder Scrolls race, named in the scribe's OWN written line

const h = await launchGame({ width: 640, height: 360, timeout: 180000 });
try {
  await h.page.waitForFunction(() => window.__HARNESS && window.__HARNESS.ready, { timeout: 180000 });
  await h.page.evaluate(() => window.__HARNESS.ready());
  await h.page.evaluate(() => window.__HARNESS.setMode('play-instrumented'));
  const step = (n = 1) => h.page.evaluate((k) => window.__HARNESS.stepFrames(k), n);

  /**
   * One body. Writes the world field, opens the scene the way the title does, walks to the desk
   * and harvests the DRAWN rows there plus the writ the run produces.
   * @param {string|null} race  null = do not write the field at all (the default body)
   * @param {boolean} freeze    the teardown: pin the observation to one literal
   */
  async function arm(race, freeze) {
    await h.page.reload({ waitUntil: 'load', timeout: 180000 });
    await h.page.waitForFunction(() => window.__HARNESS && window.__HARNESS.ready, { timeout: 180000 });
    await h.page.evaluate(() => window.__HARNESS.ready());
    await h.page.evaluate(() => window.__HARNESS.setMode('play-instrumented'));
    await h.page.evaluate(() => window.__HARNESS.setRenderRate(1));   // the glyph path must RUN
    return h.page.evaluate(async ({ r, fz }) => {
      const H = window.__HARNESS, e = window.__ENGINE;
      if (fz) {
        // THE TEARDOWN. One literal instead of the body — precisely the shape the item forbids
        // and the shape that would satisfy the acceptance test.
        e.bodyRace = () => 'saxhleel';
      }
      if (r) e.sim.identity.race = r;                 // THE PERTURBATION — a world field, nothing else
      const bodyBefore = e.sim.identity.race;
      H.titleActivate('new');
      H.renderedTextClear();
      const rows = [];
      const seen = [];
      let guard = 0;
      while (guard++ < 60) {
        const st = e.census ? e.census.state() : null;
        if (!st || st.done) break;
        seen.push(st.node);
        if (st.paused) { H.censusEnter(st.resume_by === 'walk' ? 'walk' : 'talk'); H.stepFrames(2); continue; }
        H.stepFrames(2);
        const rt = H.getRenderedText({});
        for (const s of rt.distinct) if (!rows.includes(s)) rows.push(s);
        const k = st.input ? st.input.kind : null;
        if (!k) { H.censusAnswer(null); continue; }
        if (k === 'text') { H.censusAnswer('Silence-Under-Salt'); continue; }
        if (k === 'observed') { H.censusAnswer('correct'); continue; }
        if (k === 'pick') { H.censusAnswer((st.input.options || []).map((o) => o.id).slice(0, e.censusSurface.pickCount(st))); continue; }
        const opts = st.input.options || [];
        H.censusAnswer(opts.length ? opts[0].id : null);
      }
      H.stepFrames(4);
      const rt2 = H.getRenderedText({});
      for (const s of rt2.distinct) if (!rows.includes(s)) rows.push(s);
      const ch = e.sim.character || null;
      // THE SECOND CONSUMER. The same field feeds the reaction matrix; if only the scribe reads
      // it, the model is a scene prop.
      //
      // The engine's own comment at censusBegin names `reactionTo()` as the second reader. There
      // is NO `reactionTo` anywhere in game/src — grep it. The function that does exist and does
      // read this field is `_playerGates()` (engine.js), which hands the dialogue offer gates the
      // race, the upbringing and the birthsign. That is what is measured here.
      let reactions = null;
      try {
        // BOTH names the engine's comment cites are wrong: there is no `reactionTo` and no
        // `_playerGates` anywhere in game/src. The function that exists and reads this field is
        // `_talkPlayer()`. Recorded as data rather than asserted, because naming the right
        // function is the builder's job and finding it is mine.
        const tp = e._talkPlayer ? e._talkPlayer() : null;
        reactions = {
          has_reactionTo: typeof e.reactionTo === 'function',
          has_playerGates: typeof e._playerGates === 'function',
          talkPlayer_race: tp ? tp.race : null,
          talkPlayer_topics: tp && tp.topics_known ? tp.topics_known.slice().sort() : null,
          npcs_offering: (() => { try { return e.listEntities ? e.listEntities().filter((x) => x.kind === 'npc').map((x) => [x.id, (x.topics_offered || []).length]) : null; } catch { return 'threw'; } })(),
        };
      } catch (err) { reactions = { error: String(err.message || err) }; }
      // The sentence she says about the body — the one row that must differ per body.
      // Every race id in the build plus every WRONG name the misread table uses. The first draft
      // omitted `Naga` and `Marsh-form`, which are precisely the saxhleel arm's misread, so the
      // default body looked as though it had no misread line when it has a good one.
      const raceRows = rows.filter((s) => /Saxhleel|Naga|Marsh-form|Dunmer|Khajiit|Altmer|Bosmer|Orsimer|Imperial|Nord|Redguard|Breton|Observed as/i.test(s));
      return {
        body_field: bodyBefore,
        census_race: e.census ? e.census.spec.race : null,
        nodes: seen,
        drawn_rows: rows.length,
        race_sentences: raceRows,
        writ_text: ch && ch.writ_text ? ch.writ_text : null,
        writ_len: ch && ch.writ_text ? String(ch.writ_text).length : 0,
        character_race: ch ? ch.race : null,
        reactions,
      };
    }, { r: race, fz: !!freeze });
  }

  // ---- H — four bodies -----------------------------------------------------------------------
  say('  four bodies, perturbing sim.identity.race on the running world:');
  for (const b of BODIES) {
    const r = await arm(b, false);
    out.arms.push({ body: b, ...r });
    say(`    ${b}: census.spec.race=${r.census_race}, ${r.race_sentences.length} race sentence(s), writ ${r.writ_len} chars`);
  }
  // NULL CONTROL — the same body twice.
  const nullA = out.arms.find((a) => a.body === 'dunmer');
  const nullB = await arm('dunmer', false);
  out.checks.null_control = {
    sentences_identical: JSON.stringify(nullA.race_sentences) === JSON.stringify(nullB.race_sentences),
    writ_identical: nullA.writ_text === nullB.writ_text,
  };
  const distinctSentences = new Set(out.arms.map((a) => JSON.stringify(a.race_sentences)));
  const distinctWrits = new Set(out.arms.map((a) => a.writ_text));
  const distinctSpec = new Set(out.arms.map((a) => a.census_race));
  out.checks.coupling = {
    bodies: BODIES.length,
    distinct_census_race: distinctSpec.size,
    distinct_drawn_race_sentences: distinctSentences.size,
    distinct_writs: distinctWrits.size,
    coupling: distinctWrits.size / BODIES.length,
  };
  say(`  distinct: spec.race ${distinctSpec.size}/4, drawn race sentences ${distinctSentences.size}/4, writs ${distinctWrits.size}/4`);
  if (distinctSentences.size === 4 && distinctWrits.size === 4 && distinctSpec.size === 4) {
    pass('H1', 'coupling 1 — four bodies gave four distinct drawn sentences and four distinct writs, perturbed on the world field alone', out.checks.coupling);
  } else {
    fail('H1', `coupling is ${(distinctWrits.size / 4).toFixed(2)}: ${distinctSentences.size}/4 distinct drawn sentences, ${distinctWrits.size}/4 distinct writs`, out.checks.coupling);
  }
  if (out.checks.null_control.sentences_identical && out.checks.null_control.writ_identical) {
    pass('H2', 'null control — the same body twice gives identical drawn text and an identical writ', out.checks.null_control);
  } else {
    fail('H2', 'the null control DIFFERS — the four arms above are noise', out.checks.null_control);
  }
  // second consumer
  const reactionSets = new Set(out.arms.map((a) => JSON.stringify(a.reactions)));
  out.checks.second_consumer = { distinct_reaction_sets: reactionSets.size, sample: out.arms[0].reactions };
  if (reactionSets.size > 1) pass('H3', `the same field has a SECOND world-side consumer: _playerGates() differs across ${reactionSets.size} of 4 bodies`, out.checks.second_consumer);
  else fail('H3', '_playerGates() returns the same thing for all four bodies — outside the census the observed race changes nothing a player can meet', out.checks.second_consumer);

  // ---- H5 — a body whose race the build does not know -------------------------------------
  //
  // `Engine.bodyRace()` ends `rows.some((r) => r.id === id) ? id : null`. A body carrying an id
  // that is not in `races.json` is therefore observed as NULL, silently, at scene start — and
  // `Census.answer()` at `writ.race-observed`, eleven nodes later, throws the round-2 sentence.
  // `altmer` is not in this build's races.json, and it is the race the scribe's own written line
  // says out loud ("Altmer. - No, of course not, you are not tall enough"). The round-2 verdict
  // also recorded the placeholder on this field as `argonian`, which is likewise not an id here.
  // So this is not a hypothetical: it is the round-2 defect with a better sentence over it.
  const illegal = await h.page.evaluate((r) => {
    const H = window.__HARNESS, e = window.__ENGINE;
    e.sim.identity.race = r;
    const observed = e.bodyRace();
    H.titleActivate('new');
    // Walk the player's path with the SURFACE commit, so the catch in _censusApplyPending runs
    // and the player sees what a player would see.
    let guard = 0, stoppedAt = null;
    while (guard++ < 30) {
      const st = e.census ? e.census.state() : null;
      if (!st || st.done) break;
      if (st.paused) { H.censusEnter(st.resume_by === 'walk' ? 'walk' : 'talk'); H.stepFrames(2); continue; }
      try {
        const k = st.input ? st.input.kind : null;
        if (!k) { H.censusAnswer(null); continue; }
        if (k === 'text') { H.censusAnswer('Silence-Under-Salt'); continue; }
        if (k === 'observed') { H.censusAnswer('correct'); continue; }
        const opts = st.input.options || [];
        H.censusAnswer(opts.length ? opts[0].id : null);
      } catch (err) { stoppedAt = { node: st.node, message: String(err.message || err) }; break; }
    }
    return {
      body_field: r,
      bodyRace_returned: observed,
      census_spec_race: e.census ? e.census.spec.race : null,
      stopped_at: stoppedAt,
      nodes_reached: e.census ? e.census.state().node : null,
    };
  }, ILLEGAL);
  out.checks.illegal_body = illegal;
  say(`  H5 body '${ILLEGAL}': bodyRace() -> ${JSON.stringify(illegal.bodyRace_returned)}, stopped ${JSON.stringify(illegal.stopped_at && illegal.stopped_at.node)}`);
  if (illegal.bodyRace_returned === null && illegal.stopped_at) {
    fail('H5', `a body whose race is not in races.json is observed as null SILENTLY and the desk refuses at '${illegal.stopped_at.node}' with "${illegal.stopped_at.message}" — the round-2 stop, unchanged, behind an authored line`, illegal);
  } else if (illegal.bodyRace_returned === null) {
    fail('H5', `bodyRace() returned null for '${ILLEGAL}' with no diagnostic at scene start; the scene did not stop in this arm but the observation is silently absent`, illegal);
  } else {
    pass('H5', `'${ILLEGAL}' is a legal body here (bodyRace -> ${illegal.bodyRace_returned}); no silent null`, illegal);
  }

  // ---- H teardown — pin the observation to a literal ----------------------------------------
  say('  teardown — bodyRace() pinned to one literal:');
  const frozen = [];
  for (const b of BODIES) { const r = await arm(b, true); frozen.push({ body: b, ...r }); }
  out.teardown = frozen;
  const fWrits = new Set(frozen.map((a) => a.writ_text));
  const fSent = new Set(frozen.map((a) => JSON.stringify(a.race_sentences)));
  say(`    frozen: ${fWrits.size}/4 distinct writs, ${fSent.size}/4 distinct sentences`);
  if (fWrits.size === 1 && fSent.size === 1) {
    pass('H4', 'with the observation pinned to a literal all four arms collapse to one writ and one sentence — the coupling above is real and this probe can fail', { distinct_writs: fWrits.size });
  } else {
    fail('H4', `the teardown did NOT collapse (${fWrits.size} writs, ${fSent.size} sentences) — this control is inert and H1 proves nothing`, { frozen });
  }

  // ---- D — the frozen corner, and stopped-world vs crate ------------------------------------
  const DIRS = [['KeyW'], ['KeyS'], ['KeyA'], ['KeyD'], ['KeyW', 'KeyA'], ['KeyW', 'KeyD'], ['KeyS', 'KeyA'], ['KeyS', 'KeyD']];
  const CORNER = [-1.342, 0, 3.862];

  /** Put the body at the corner in the hold, with the scene at hold.out. */
  async function atCorner() {
    await h.page.reload({ waitUntil: 'load', timeout: 180000 });
    await h.page.waitForFunction(() => window.__HARNESS && window.__HARNESS.ready, { timeout: 180000 });
    await h.page.evaluate(() => window.__HARNESS.ready());
    await h.page.evaluate(() => window.__HARNESS.setMode('play-instrumented'));
    await h.page.evaluate(() => window.__HARNESS.setRenderRate(0));
    await h.page.evaluate((c) => {
      const H = window.__HARNESS, e = window.__ENGINE;
      H.titleActivate('new'); H.censusEnter('talk'); H.censusAnswer('Silence-Under-Salt');
      e.sim.player.pos[0] = c[0]; e.sim.player.pos[2] = c[2];
      e.sim.camera.yaw = 0;
    }, CORNER);
    await step(3);
  }

  /** Hold `keys` for `frames` and report metres moved AND frames the world advanced. */
  async function push(keys, frames) {
    const f0 = await h.page.evaluate(() => window.__ENGINE.sim.frame);
    const p0 = await h.page.evaluate(() => window.__ENGINE.sim.player.pos.slice());
    for (const k of keys) await h.page.keyboard.down(k);
    await step(frames);
    for (const k of keys) await h.page.keyboard.up(k);
    await step(1);
    const f1 = await h.page.evaluate(() => window.__ENGINE.sim.frame);
    const p1 = await h.page.evaluate(() => window.__ENGINE.sim.player.pos.slice());
    return { moved: Number(Math.hypot(p1[0] - p0[0], p1[2] - p0[2]).toFixed(4)), frames_advanced: f1 - f0, to: p1.map((v) => Number(v.toFixed(3))) };
  }

  // D1 — per-arm reset, eight directions
  const perArm = [];
  for (const d of DIRS) { await atCorner(); perArm.push({ keys: d.join('+'), ...(await push(d, 40)) }); }
  const destsPerArm = new Set(perArm.map((r) => `${r.to[0]},${r.to[2]}`));
  out.checks.corner_per_arm = { arms: perArm, distinct_destinations: destsPerArm.size };
  say(`  D1 per-arm reset: ${destsPerArm.size} distinct destinations over 8 directions`);
  if (destsPerArm.size >= 5 && perArm.every((r) => r.moved > 0)) {
    pass('D1', `the frozen coordinate is not a trap: 8 directions all moved, ${destsPerArm.size} distinct destinations`, { distinct: destsPerArm.size });
  } else {
    fail('D1', `${perArm.filter((r) => r.moved <= 0).length} direction(s) moved nothing; ${destsPerArm.size} distinct destinations`, { arms: perArm });
  }

  // D3 — the SHARED-STATE version, which is the mistake the builder says it made and fixed
  await atCorner();
  const shared = [];
  for (const d of DIRS) shared.push({ keys: d.join('+'), ...(await push(d, 40)) });
  const destsShared = new Set(shared.map((r) => `${r.to[0]},${r.to[2]}`));
  out.checks.corner_shared_state = { arms: shared, distinct_destinations: destsShared.size };
  say(`  D3 shared state: ${destsShared.size} distinct destinations over 8 directions`);
  if (destsShared.size !== destsPerArm.size) {
    pass('D3', `the two control shapes disagree — shared state gives ${destsShared.size} destinations against ${destsPerArm.size} with a per-arm reset, so the reset is load-bearing and an eight-arm sweep over one state is NOT a control`, { shared: destsShared.size, per_arm: destsPerArm.size });
  } else {
    fail('D3', `shared state and per-arm reset give the same ${destsShared.size} destinations — the builder's reported inert control cannot be reproduced from here, so its fix is unverified`, { shared: destsShared.size, per_arm: destsPerArm.size });
  }

  // D2 — can `frames_advanced` separate a stopped world from a crate?
  await atCorner();
  // (a) into solid geometry, world RUNNING. Push into the hull until it stops moving.
  let crate = null;
  for (let i = 0; i < 8; i++) { const r = await push(['KeyS'], 40); crate = r; if (r.moved < 0.02) break; }
  // (b) open floor, world STOPPED. A menu pauses the world — the branch `Engine._step()` has.
  await atCorner();
  await h.page.keyboard.press('KeyM'); await step(2);
  const uiMode = await h.page.evaluate(() => (window.__ENGINE.ui ? window.__ENGINE.ui.mode : null));
  const stoppedProbe = await (async () => {
    const f0 = await h.page.evaluate(() => window.__ENGINE.sim.frame);
    const p0 = await h.page.evaluate(() => window.__ENGINE.sim.player.pos.slice());
    await h.page.keyboard.down('KeyW');
    // NOT stepFrames — a paused world is measured by wall clock, which is the whole point.
    await h.page.waitForTimeout(1500);
    await h.page.keyboard.up('KeyW');
    const f1 = await h.page.evaluate(() => window.__ENGINE.sim.frame);
    const p1 = await h.page.evaluate(() => window.__ENGINE.sim.player.pos.slice());
    return { moved: Number(Math.hypot(p1[0] - p0[0], p1[2] - p0[2]).toFixed(4)), frames_advanced: f1 - f0, ui_mode: uiMode };
  })();
  out.checks.discriminate = { crate, stopped: stoppedProbe };
  say(`  D2 crate: moved ${crate.moved} m over ${crate.frames_advanced} frames · stopped: moved ${stoppedProbe.moved} m over ${stoppedProbe.frames_advanced} frames (ui '${stoppedProbe.ui_mode}')`);
  if (crate.moved < 0.02 && crate.frames_advanced > 0 && stoppedProbe.moved < 0.02 && stoppedProbe.frames_advanced === 0) {
    pass('D2', `frames_advanced separates them: a crate is 0 m over ${crate.frames_advanced} frames, a stopped world is 0 m over 0 frames`, out.checks.discriminate);
  } else {
    fail('D2', `the two arms are not separated as constructed — crate ${crate.moved} m/${crate.frames_advanced} f, stopped ${stoppedProbe.moved} m/${stoppedProbe.frames_advanced} f`, out.checks.discriminate);
  }

  out.conditions.loadavg_at_end = loadavg();
  out.conditions.page_errors = h.errors.slice(0, 8);
} catch (e) {
  fail('RUN', `threw: ${e.message}`, { stack: String(e.stack || '').split('\n').slice(0, 8) });
} finally {
  say(`\n  ${out.passes.length} pass · ${out.failures.length} fail`);
  writeJson(jsonPath, out);
  say(`  artifact: ${path.relative(process.cwd(), jsonPath)}`);
  await h.close();
  process.exit(out.failures.length ? 1 : 0);
}
