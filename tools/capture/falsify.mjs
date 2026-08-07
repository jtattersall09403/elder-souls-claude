#!/usr/bin/env node
/**
 * falsify.mjs — try to get a bad picture out of the capture service, and fail.
 *
 * TOOL-LOOP rule 3.2: "Can the tool fail? Break the thing it measures on purpose and confirm it
 * goes red. A probe that cannot fail is worse than no probe." AGENT-PROTOCOL says the same thing
 * twice. So this file's whole job is to ATTACK the service, and it exits non-zero if any attack
 * succeeds.
 *
 * It is deliberately separate from the service it attacks, and it is deliberately not the only
 * check: an independent critic should run it, read it, and add to it. A self-test written by the
 * same hand as the tool proves less than an independent falsification, and that lesson cost this
 * project five rejected instruments.
 *
 * THE ATTACKS
 *
 *  A1  UNSTREAMED WORLD — ask for a capture at a place the world has not streamed. The service
 *      must REFUSE it rather than hand back a picture of nothing.
 *      `__no_camera_stream` removes the service's own remedy (the stream-drain at the camera) and
 *      nothing else. It does not touch a single gate. If the gates are real the capture is
 *      refused; if they are decorative a photograph of an empty world comes back.
 *
 *  A2  ARRIVAL EVIDENCE — ask for a placed capture and tell the service it is evidence of arrival.
 *      Six variants, because a gate that only catches the honest caller is not a gate:
 *        a  evidence_of: "arrival"                    — said plainly
 *        b  arrival: "walked"                         — asking it to lie about provenance
 *        c  evidence_of: "appearance", claim: RI-JRN04 — laundered by relabelling
 *        d  ... claim: "is the crossing walkable?"     — laundered by wording
 *        e  ... claim: "how long the route takes"      — a duration claim
 *        f  evidence_of omitted entirely               — must not default to permitted
 *
 *  A3  CONTROL — the same capture as A1 with the remedy left in. This one MUST succeed. Without
 *      it, "the service refused" proves nothing: a service that refuses everything passes A1 and
 *      A2 and is useless. A control that cannot exhibit the success is not a control.
 *
 *  A4  PROVENANCE — every capture that IS returned must carry `arrival: "placed"`, the build key,
 *      a settle proof with all three gates recorded, and a cache flag. S34 requires all four.
 *
 * USAGE
 *   node tools/capture/falsify.mjs [--json] [--out reports/capture]
 */
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs, wantsHelp, usage, ensureDir, log, EXIT, REPO_ROOT, readJson } from '../lib/cli.mjs';
import { CaptureSession, CaptureError } from './client.mjs';

const USAGE = `falsify.mjs — attack the capture service; exit non-zero if any attack succeeds.
  --json          print the full report
  --out <dir>     where to write FALSIFICATION.json (default reports/capture)`;

const args = parseArgs();
if (wantsHelp(args)) usage(USAGE);
const OUT = path.resolve(String(args.out || path.join(REPO_ROOT, 'reports/capture')));
ensureDir(OUT);

const results = [];
const record = (r) => { results.push(r); log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.id}  ${r.summary}`); return r; };

const s = new CaptureSession();

// A place well inside a region, chosen from the world's own data so the coordinates are real.
const regions = readJson(path.join(REPO_ROOT, 'game/data/world/regions.json')).regions;
const r0 = regions.find((r) => r.id === 'deep-marshes') || regions[0];
const cx = (r0.bounds_m.x[0] + r0.bounds_m.x[1]) / 2;
const cz = (r0.bounds_m.z[0] + r0.bounds_m.z[1]) / 2;

// A second place, far from the first, used to park the player so the first is genuinely unresident.
const r1 = regions.find((r) => r.id !== r0.id && Math.hypot(
  (r.bounds_m.x[0] + r.bounds_m.x[1]) / 2 - cx, (r.bounds_m.z[0] + r.bounds_m.z[1]) / 2 - cz) > 4000) || regions[regions.length - 1];
const fx = (r1.bounds_m.x[0] + r1.bounds_m.x[1]) / 2;
const fz = (r1.bounds_m.z[0] + r1.bounds_m.z[1]) / 2;

try {
  // ============================================================================================
  // A3 first — the CONTROL. If this does not succeed, nothing below means anything.
  // ============================================================================================
  {
    const t0 = Date.now();
    let out = null, err = null;
    try { out = await s.capture({ evidence_of: 'appearance', place: { x: cx, z: cz }, pose: { yaw_deg: 30, pitch_deg: 4, eye_m: 1.7, fov: 70 }, time: 11, weather: 'clear', width: 1280, height: 720, no_cache: true }); }
    catch (e) { err = e; }
    record({
      id: 'A3-control',
      what: 'a normal placed capture at the same coordinates, with the service\'s streaming remedy left in',
      must: 'SUCCEED — otherwise "it refused" proves only that it refuses everything',
      pass: !!out && out.settle && out.settle.settled === true,
      summary: out ? `captured in ${Date.now() - t0} ms, settled=${out.settle.settled}, G1 queued=${out.settle.gates.G1_residency.queued}, excess=${out.settle.gates.G3_stability.excess}` : `REFUSED: ${err && err.code} ${err && err.message}`,
      evidence: out ? { path: out.path, settle: out.settle, provenance: out.provenance } : { error: String(err && err.message) },
    });

    // ==========================================================================================
    // A4 — provenance on the capture that DID come back.
    // ==========================================================================================
    const p = out && out.provenance;
    const st = out && out.settle;
    const checks = {
      'arrival === "placed"': !!p && p.arrival === 'placed',
      'build key present': !!p && typeof p.build_key === 'string' && p.build_key.startsWith('game@'),
      'game content sha256 present': !!p && typeof p.game_content_sha256 === 'string' && p.game_content_sha256.length === 64,
      'served_from_cache flag present': !!out && typeof out.cached === 'boolean',
      'settle proof present': !!st && st.settled === true,
      'G1 residency recorded': !!st && st.gates && typeof st.gates.G1_residency.queued === 'number',
      'G2 quiescence recorded': !!st && st.gates && typeof st.gates.G2_quiescence.tiles_queued === 'number',
      'G3 stability recorded': !!st && st.gates && typeof st.gates.G3_stability.excess === 'number',
      'threshold declared': !!st && st.threshold > 0,
      'gap declared': !!st && st.gap_frames > 0,
      'S34 admissibility stated': !!p && /S34/.test(String(p.ruling || '')),
    };
    record({
      id: 'A4-provenance',
      what: 'every capture records arrival, build sha, settle proof and cache status (S34)',
      must: 'ALL PRESENT',
      pass: Object.values(checks).every(Boolean),
      summary: Object.entries(checks).filter(([, v]) => !v).map(([k]) => 'MISSING: ' + k).join('; ') || `all ${Object.keys(checks).length} provenance fields present`,
      evidence: checks,
    });
  }

  // ============================================================================================
  // A1 — a capture at a place the world has not streamed. MUST be refused.
  // ============================================================================================
  {
    // Park the player a long way off first, so the target really is unresident. This is done
    // through the service's own public surface: an ordinary capture somewhere else.
    //
    // `no_cache` is LOAD-BEARING here and the first draft of this file got it wrong. A cache hit
    // never touches the browser — that is the entire point of the cache — so a park capture that
    // is served from cache does not move the player at all, and the "unstreamed" target below was
    // still fully resident from the control capture. The attack then "succeeded" and the report
    // said LOOPHOLE OPEN when the loophole was in the test. Force the render.
    await s.capture({ evidence_of: 'appearance', place: { x: fx, z: fz }, pose: { yaw_deg: 0, pitch_deg: 4, eye_m: 1.7, fov: 70 }, time: 11, weather: 'clear', width: 1280, height: 720, no_cache: true });

    let out = null, err = null;
    const t0 = Date.now();
    try {
      out = await s.capture({
        evidence_of: 'appearance',
        // NO `place`: the player is not teleported, so the streamer is never pumped here.
        camera: { pos: [cx, 40, cz], look: [cx + 30, 20, cz + 30], fov: 70 },
        time: 11, weather: 'clear', width: 1280, height: 720,
        no_cache: true,
        __no_camera_stream: true,   // removes the service's remedy; touches no gate
      });
    } catch (e) { err = e; }
    const refused = !out && err instanceof CaptureError && err.code === 'UNSETTLED';
    const g = err && err.detail && err.detail.settle && err.detail.settle.gates;
    record({
      id: 'A1-unstreamed',
      what: 'a capture at a location the world has not streamed',
      must: 'REFUSE — never return a picture of a world that does not exist',
      pass: refused && g && g.G1_residency.pass === false,
      summary: refused
        ? `refused in ${Date.now() - t0} ms: G1 queued=${g.G1_residency.queued} unbuilt tiles` +
          ` | G3 alone: excess=${g.G3_stability.excess}, would have ${g.G3_stability.pass ? 'PASSED IT' : 'also caught it'}`
        : out ? `LOOPHOLE: returned ${out.path}` : `refused for the wrong reason: ${err && err.code}`,
      evidence: refused ? { code: err.code, gates: g, message: err.message } : { path: out && out.path },
    });
  }

  // ============================================================================================
  // A2 — a placed capture tagged as arrival evidence. MUST be refused, six ways.
  // ============================================================================================
  const base = { place: { x: cx, z: cz }, pose: { yaw_deg: 30, pitch_deg: 4, eye_m: 1.7, fov: 70 }, time: 11, weather: 'clear', width: 1280, height: 720 };
  const attempts = [
    ['a', 'declared outright', { ...base, evidence_of: 'arrival' }],
    ['b', 'asks the service to stamp arrival: "walked"', { ...base, evidence_of: 'appearance', arrival: 'walked' }],
    ['c', 'laundered: labelled appearance, filed under RI-JRN04', { ...base, evidence_of: 'appearance', claim: 'RI-JRN04 M-K12' }],
    ['d', 'laundered: labelled appearance, claim is about walkability', { ...base, evidence_of: 'appearance', claim: 'shows the crossing is walkable on foot' }],
    ['e', 'laundered: a duration claim', { ...base, evidence_of: 'appearance', purpose: 'how long the route takes end to end' }],
    ['f', 'evidence_of omitted entirely', { ...base, claim: 'reachability of the north shore' }],
  ];
  for (const [tag, why, spec] of attempts) {
    let out = null, err = null;
    try { out = await s.capture(spec); } catch (e) { err = e; }
    const refused = !out && err instanceof CaptureError && err.code === 'ARRIVAL_REFUSED';
    record({
      id: `A2${tag}-arrival`,
      what: why,
      must: 'REFUSE — S34(b): the walk IS the measurement',
      pass: refused,
      summary: refused ? `refused: matched ${JSON.stringify(err.detail && err.detail.matched)}` : out ? `LOOPHOLE: returned ${out.path}` : `wrong code: ${err && err.code}`,
      evidence: refused ? { code: err.code, matched: err.detail && err.detail.matched } : { path: out && out.path },
    });
  }

  // ============================================================================================
  // A5 — the cache must not launder a refusal, and must not outlive its build.
  // ============================================================================================
  {
    // Same spec as A3's control but WITHOUT no_cache: the second call must be a cache hit whose
    // provenance still says placed and still carries the settle proof.
    const spec = { evidence_of: 'appearance', place: { x: cx, z: cz }, pose: { yaw_deg: 31, pitch_deg: 4, eye_m: 1.7, fov: 70 }, time: 11, weather: 'clear', width: 1280, height: 720 };
    // Force the first one to render even if a previous falsification run left it in the cache,
    // so "first cached=false, second cached=true" is a statement about THIS run.
    const first = await s.capture({ ...spec, no_cache: true });
    const t0 = Date.now();
    const second = await s.capture(spec);
    const ms = Date.now() - t0;
    record({
      id: 'A5-cache-integrity',
      what: 'a cache hit still carries provenance and a settle proof, and is keyed on the build',
      must: 'HIT, and carry everything a fresh capture carries',
      pass: second.cached === true && first.cached === false && second.provenance.arrival === 'placed'
        && second.settle.settled === true && second.provenance.build_key === first.provenance.build_key
        && second.sha256 === first.sha256,
      summary: `first cached=${first.cached}, second cached=${second.cached} in ${ms} ms, same sha256=${second.sha256 === first.sha256}, build=${second.provenance.build_key}`,
      evidence: { first_cached: first.cached, second_cached: second.cached, hit_ms: ms, build_key: second.provenance.build_key, sha_match: second.sha256 === first.sha256 },
    });
  }
} finally { s.close(); }

const failed = results.filter((r) => !r.pass);
const report = {
  schema: 'elder-souls/capture-falsification@1',
  ran_at: new Date().toISOString(),
  ruling: 'ARBITRATION.md S34',
  attacks: results.length,
  passed: results.length - failed.length,
  failed: failed.length,
  verdict: failed.length === 0 ? 'THE GATES HOLD' : 'LOOPHOLE OPEN',
  results,
};
fs.writeFileSync(path.join(OUT, 'FALSIFICATION.json'), JSON.stringify(report, null, 2));
if (args.json) process.stdout.write(JSON.stringify(report, null, 2) + '\n');
else process.stdout.write(`${report.verdict}: ${report.passed}/${report.attacks} attacks repelled\n`);
process.exit(failed.length ? EXIT.MEASUREMENT_FAIL : EXIT.OK);
