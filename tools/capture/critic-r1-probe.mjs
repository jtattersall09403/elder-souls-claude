#!/usr/bin/env node
/**
 * critic-r1-probe.mjs — the CAPTURE-SERVICE-R1 critic's own instrument.
 *
 * TOOL-LOOP rule 3: a self-test written by the same hand as the tool proves the arithmetic its
 * author was thinking about. `falsify.mjs` was written by the service's builder and tests six
 * laundering variants that its author imagined. This file was written by the critic, tests
 * variants the builder did not imagine, and does NOT import falsify.mjs's idea of what an attack
 * is. It exits non-zero when an attack SUCCEEDS.
 *
 * FIVE PHASES
 *   --gates     offline. 30 laundering specs put straight through `classify()`. No daemon needed:
 *               the gate is a pure function and testing it through a browser only hides which
 *               specs got through.
 *   --key       offline. Cache-key honesty. For each mutation of a spec, does the key move when
 *               the PICTURE moves, and hold still when it does not?
 *   --forge     live daemon, NO browser. Writes a manifest into the cache bucket by hand and asks
 *               the daemon for it. Tests whether the daemon re-derives provenance on a hit or
 *               merely replays whatever it finds on disk.
 *   --sticky    live daemon, 3 renders. Does a spec DETERMINE its picture? Sends the same spec
 *               twice with a differently-conditioned capture in between.
 *   --streamer  own browser, no daemon. Independent confirmation of the builder's central finding:
 *               is `renderer.province` ever pumped from the fixed step?
 *
 * Every phase runs against an ISOLATED socket and cache (ES_CAPTURE_SOCK / ES_CAPTURE_CACHE) when
 * --isolate is given, so it cannot disturb another agent's daemon or poison the shared cache.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { parseArgs, wantsHelp, usage, ensureDir, log, EXIT, REPO_ROOT, readJson, sha256 } from '../lib/cli.mjs';

const USAGE = `critic-r1-probe.mjs — the capture critic's own attacks.
  --gates --key --forge --sticky --streamer   (choose one or more; --all runs gates+key)
  --isolate            use a private socket + cache dir under reports/runs/.capture-critic
  --out <dir>          where to write CRITIC-PROBE.json (default reports/capture)`;

const args = parseArgs();
if (wantsHelp(args)) usage(USAGE);

if (args.isolate) {
  const dir = path.join(REPO_ROOT, 'reports/runs/.capture-critic');
  fs.mkdirSync(dir, { recursive: true });
  process.env.ES_CAPTURE_SOCK = path.join(dir, 'capd.sock');
  process.env.ES_CAPTURE_CACHE = path.join(dir, 'cache');
}

const OUT = path.resolve(String(args.out || path.join(REPO_ROOT, 'reports/capture')));
ensureDir(OUT);

const findings = [];
const rec = (r) => {
  findings.push(r);
  log(`${r.beaten ? 'BEATEN' : 'held  '}  ${r.id}  ${r.summary}`);
  return r;
};

// =================================================================================================
// PHASE 1 — THE GATE. Attacks the builder did not write.
// =================================================================================================
async function phaseGates() {
  const { classify } = await import('./arrival.mjs');
  const base = { place: { x: 3000, z: 3000 }, pose: { yaw_deg: 0 }, width: 640, height: 360 };

  // Each entry: [id, why it is an ARRIVAL claim, spec]. Every one of these is a request for a
  // picture that would be cited as evidence of arrival. All 30 must be refused.
  const attacks = [
    // --- morphology. The word list is matched on exact word boundaries, so inflections escape.
    ['M1-traverse', 'the commonest verb form of "traversal"', { ...base, evidence_of: 'appearance', claim: 'shows the player can traverse the mire on foot' }],
    ['M2-traverses', 'third person', { ...base, evidence_of: 'appearance', claim: 'the causeway traverses the channel and is passable' }],
    ['M3-traversing', 'participle', { ...base, evidence_of: 'appearance', claim: 'traversing the northern shelf' }],
    ['M4-routes', 'plural of a listed word', { ...base, evidence_of: 'appearance', claim: 'the two routes out of the delta are usable' }],
    ['M5-crossings', 'plural of a listed word', { ...base, evidence_of: 'appearance', claim: 'both crossings are passable at low tide' }],
    ['M6-journeys', 'plural of a listed word', { ...base, evidence_of: 'appearance', claim: 'the pilgrim journeys end here' }],
    ['M7-walking', 'inflection of walk', { ...base, evidence_of: 'appearance', claim: 'the player got here walking, unaided' }],
    ['M8-reaches', 'inflection of reach', { ...base, evidence_of: 'appearance', claim: 'the player reaches the shrine from the south gate' }],
    ['M9-arrivals', 'plural of arrival', { ...base, evidence_of: 'appearance', claim: 'arrivals at the west stair' }],

    // --- synonyms the list never had.
    ['S1-passable', 'the word a reachability claim actually uses', { ...base, evidence_of: 'appearance', claim: 'the north shelf is passable from the beach' }],
    ['S2-accessible', 'ditto', { ...base, evidence_of: 'appearance', claim: 'the tower is accessible without climbing gear' }],
    ['S3-getto', 'plain english for reachability', { ...base, evidence_of: 'appearance', claim: 'you can get to the island from the causeway' }],
    ['S4-hike', 'a journey by another name', { ...base, evidence_of: 'appearance', claim: 'the hike from Lilmoth to the Hive' }],
    ['S5-trek', 'ditto', { ...base, evidence_of: 'appearance', claim: 'the trek across the ashlands' }],
    ['S6-seconds', 'a duration claim in the unit rather than the word', { ...base, evidence_of: 'appearance', claim: 'it takes 340 seconds from the dock' }],
    ['S7-howfar', 'a distance-travelled claim', { ...base, evidence_of: 'appearance', claim: 'how far the player can go before the ground stops' }],
    ['S8-fromto', 'the shape of every journey claim', { ...base, evidence_of: 'appearance', claim: 'from the south gate to the shrine, on foot, unaided' }],
    ['S9-egress', 'the technical word', { ...base, evidence_of: 'appearance', claim: 'egress from the flooded quarter' }],
    ['S10-navigate', 'inflection escapes "navigable"', { ...base, evidence_of: 'appearance', claim: 'the player can navigate the mangrove' }],

    // --- field-shape laundering. `classify` stringifies whatever it is given.
    ['F1-object-claim', 'a claim expressed as an object stringifies to [object Object]', { ...base, evidence_of: 'appearance', claim: { item: 'RI-JRN04', text: 'is the crossing walkable' } }],
    ['F2-array-object', 'an array of objects, same trick', { ...base, evidence_of: 'appearance', claim: [{ item: 'RI-JRN04' }] }],
    ['F3-nested-note', 'the note as a structured record', { ...base, evidence_of: 'appearance', note: { ri: 'RI-JRN01', asserts: 'arrival' } }],

    // --- fields the gate never reads. These are the ones a real report would use.
    ['U1-title', 'the field a report actually carries', { ...base, evidence_of: 'appearance', title: 'RI-JRN04 — the crossing is walkable' }],
    ['U2-item', 'the reference item, named directly', { ...base, evidence_of: 'appearance', item: 'RI-JRN04' }],
    ['U3-ri', 'ditto, the short key', { ...base, evidence_of: 'appearance', ri: 'RI-WLD03' }],
    ['U4-caption', 'the caption that will sit under the picture in the verdict', { ...base, evidence_of: 'appearance', caption: 'proof the route is walkable end to end' }],
    ['U5-tags', 'a tag list', { ...base, evidence_of: 'appearance', tags: ['reachability', 'RI-JRN04'] }],
    ['U6-description', 'the long field', { ...base, evidence_of: 'appearance', description: 'evidence that the player reached the shrine on foot' }],

    // --- the declaration itself.
    ['D1-omitted', 'evidence_of omitted, nothing else said (falsify.mjs A2f claims this is refused)', { ...base }],
    ['D2-empty', 'evidence_of present but empty — falls back to "appearance"', { ...base, evidence_of: '' }],
  ];

  let beaten = 0;
  const rows = [];
  for (const [id, why, spec] of attacks) {
    const v = classify(spec);
    const got = v.ok ? 'ACCEPTED' : 'refused';
    if (v.ok) beaten++;
    rows.push({ id, why, accepted: v.ok === true, matched: v.matched || null });
  }
  rec({
    id: 'P1-gate-laundering',
    phase: 'gates',
    what: `${attacks.length} arrival-laundering specs the builder's falsifier does not contain`,
    must: 'ALL REFUSED — S34(b)',
    beaten: beaten > 0,
    summary: `${beaten}/${attacks.length} laundering specs ACCEPTED by classify()`,
    evidence: rows,
  });
  return rows;
}

// =================================================================================================
// PHASE 2 — THE CACHE KEY. Does it move when the picture moves?
// =================================================================================================
async function phaseKey() {
  const { cacheKey, canonicalSpec } = await import('./protocol.mjs');
  const BK = 'game@deadbeefdeadbeef';
  const base = {
    evidence_of: 'appearance',
    place: { x: 3000, z: 3000 },
    pose: { yaw_deg: 30, pitch_deg: 4, eye_m: 1.7, fov: 70 },
    time: 11, weather: 'clear', width: 1280, height: 720,
  };
  const k0 = cacheKey(BK, base).key;

  // [id, mutation, does it change the PICTURE?, note]
  const cases = [
    ['K1-no-camera-stream', { ...base, __no_camera_stream: true }, true,
      'removes the daemon\'s stream-drain at the camera: a DIFFERENT (emptier) world is photographed'],
    ['K2-camera-pos-object', { ...base, place: null, camera: { pos: { x: 1, y: 2, z: 3 }, look: [0, 0, 0] } }, true,
      'camera.pos as an object is dropped by vec() from the key but still handed to __HARNESS.camera()'],
    ['K3-op-object-form', { ...base, ops: [{ op: 'spawn', args: ['champion', 10, 20] }] }, true,
      'documented alternative op form — must key the same as the array form'],
    ['K4-op-array-form', { ...base, ops: [['spawn', 'champion', 10, 20]] }, true, 'the array form of the same op'],
    ['K5-yaw-rounding', { ...base, pose: { ...base.pose, yaw_deg: 30.00004 } }, false,
      'sub-1e-4 yaw: rounded away on purpose, and it does not move a pixel'],
    ['K6-claim-text', { ...base, claim: 'the stonework of the west pier' }, false,
      'the claim is not in the key — correct, it does not change the picture'],
    ['K7-tide', { ...base, tide: 'spring-high' }, true, 'tide changes the water line'],
    ['K8-ui', { ...base, ui: true }, true, 'the HUD is in the frame'],
    ['K9-seed', { ...base, seed: 4242 }, true, 'a different simulation'],
  ];

  const rows = [];
  for (const [id, spec, picture_moves, note] of cases) {
    const k = cacheKey(BK, spec).key;
    const key_moves = k !== k0;
    const honest = id === 'K3-op-object-form' || id === 'K4-op-array-form' ? null : key_moves === picture_moves;
    rows.push({ id, note, picture_moves, key_moves, honest });
  }
  // K3/K4 must agree with EACH OTHER, not with base.
  const k3 = cacheKey(BK, cases[2][1]).key, k4 = cacheKey(BK, cases[3][1]).key;
  rows.push({ id: 'K3=K4 op forms agree', note: 'the two documented op spellings must be one key', picture_moves: false, key_moves: k3 !== k4, honest: k3 === k4 });

  const dishonest = rows.filter((r) => r.honest === false);
  rec({
    id: 'P2-cache-key-honesty',
    phase: 'key',
    what: 'for each mutation: does the key move exactly when the picture moves?',
    must: 'key movement === picture movement',
    beaten: dishonest.length > 0,
    summary: dishonest.length ? `${dishonest.length} dishonest: ${dishonest.map((d) => d.id).join(', ')}` : 'all mutations keyed honestly',
    evidence: rows,
  });

  // Canonical-spec completeness: which top-level keys does canonicalSpec silently drop?
  const kitchenSink = {
    ...base, claim: 'x', title: 'y', item: 'RI-JRN04', __no_camera_stream: true, no_cache: true,
    fov: 12, exposure: 3, lod: 'low',
  };
  const canon = canonicalSpec(kitchenSink);
  const dropped = Object.keys(kitchenSink).filter((k) => !(k in canon));
  rec({
    id: 'P2b-canonical-drops',
    phase: 'key',
    what: 'top-level spec fields silently dropped by canonicalSpec (and so absent from key AND manifest)',
    must: 'nothing that reaches the renderer may be dropped',
    beaten: dropped.includes('__no_camera_stream'),
    summary: `dropped: ${dropped.join(', ')}`,
    evidence: { dropped, canon_keys: Object.keys(canon) },
  });
  return rows;
}

// =================================================================================================
// PHASE 3 — CACHE FORGERY. Does the daemon replay provenance it did not derive?
// =================================================================================================
async function phaseForge() {
  const { cacheKey, cachePaths } = await import('./protocol.mjs');
  const { CaptureSession, ensureServer, serverStatus } = await import('./client.mjs');

  // Ask the RUNNING daemon what build key it is serving, rather than recomputing it here: another
  // builder editing game/ mid-probe would otherwise put the forgery in the wrong bucket and the
  // daemon would render instead of hit, which is not the test.
  await ensureServer();
  const BK = (await serverStatus()).build.build_key;
  // A spec that is expensive and unique, so nothing can have rendered it before.
  const spec = {
    evidence_of: 'appearance',
    place: { x: 1234.5, z: 4321.5 },
    pose: { yaw_deg: 77, pitch_deg: 3, eye_m: 1.7, fov: 70 },
    time: 9, weather: 'clear', width: 320, height: 200,
  };
  const { key } = cacheKey(BK, spec);
  const p = cachePaths(BK, key);
  ensureDir(p.bucket);

  // A 1x1 PNG that is manifestly not a capture of anything.
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64');
  fs.writeFileSync(p.png, png);

  // A manifest a hostile (or merely careless) agent could write. Note it claims to be WALKED.
  const forged = {
    schema: 'elder-souls/capture@1',
    cache_key: key,
    path: p.png,
    bytes: png.length,
    sha256: 'not-even-the-hash-of-this-file',
    captured_at: '1999-01-01T00:00:00.000Z',
    spec: { v: 1 },
    provenance: {
      arrival: 'walked',
      evidence_of: 'arrival',
      placement: 'the player walked here from the south gate, unaided',
      build_key: BK,
      served_from_cache: false,
      ruling: 'RI-JRN04: admissible as evidence of ARRIVAL',
    },
    build: { build_key: BK },
    settle: { settled: true, gates: { G1_residency: { pass: true }, G2_quiescence: { pass: true }, G3_stability: { pass: true } } },
  };
  fs.writeFileSync(p.json, JSON.stringify(forged, null, 2));

  const s = new CaptureSession();
  let out = null, err = null;
  const t0 = Date.now();
  try { out = await s.capture(spec); } catch (e) { err = e; }
  finally { s.close(); }

  const served = !!out;
  rec({
    id: 'P3-cache-forgery',
    phase: 'forge',
    what: 'a hand-written manifest in the cache bucket, claiming arrival:"walked" and a settled proof, ' +
      'with a PNG whose bytes do not match the recorded sha256',
    must: 'the daemon must not hand back provenance it did not derive, and must not serve a PNG ' +
      'whose bytes contradict its own manifest',
    beaten: served && out.provenance && out.provenance.arrival === 'walked',
    summary: served
      ? `SERVED in ${Date.now() - t0} ms: arrival=${out.provenance && out.provenance.arrival}, ` +
        `evidence_of=${out.provenance && out.provenance.evidence_of}, settled=${out.settle && out.settle.settled}, ` +
        `sha256 recorded=${out.sha256}, actual=${sha256(fs.readFileSync(p.png))}`
      : `refused: ${err && err.code} ${err && err.message}`,
    evidence: served ? { returned: out } : { error: String(err && err.message) },
  });

  // And the S34 provenance field on an honest hit: does `served_from_cache` ever become true?
  if (served) {
    rec({
      id: 'P3b-served-from-cache-flag',
      phase: 'forge',
      what: 'S34 requires provenance to record "whether it was served from cache"',
      must: 'provenance.served_from_cache === true on a hit',
      beaten: out.provenance && out.provenance.served_from_cache === false && out.cached === true,
      summary: `cached=${out.cached} but provenance.served_from_cache=${out.provenance && out.provenance.served_from_cache}`,
      evidence: { cached: out.cached, provenance_flag: out.provenance && out.provenance.served_from_cache },
    });
  }
  try { fs.unlinkSync(p.png); fs.unlinkSync(p.json); } catch { /* */ }
}

// =================================================================================================
// PHASE 4 — DOES A SPEC DETERMINE ITS PICTURE?
// =================================================================================================
async function phaseSticky() {
  const { CaptureSession } = await import('./client.mjs');
  const regions = readJson(path.join(REPO_ROOT, 'game/data/world/regions.json')).regions;
  const r0 = regions.find((r) => r.id === 'deep-marshes') || regions[0];
  const x = (r0.bounds_m.x[0] + r0.bounds_m.x[1]) / 2;
  const z = (r0.bounds_m.z[0] + r0.bounds_m.z[1]) / 2;

  // The spec under test says WHERE but not WHEN or IN WHAT WEATHER — exactly what
  // `shot.mjs --at x,z` sends when the caller does not pass --time/--weather, which is the
  // documented headline usage.
  const P = { evidence_of: 'appearance', place: { x, z }, pose: { yaw_deg: 12, pitch_deg: 4, eye_m: 1.7, fov: 70 }, width: 640, height: 360, no_cache: true };
  // A conditioned capture at the SAME place, run in between. place -> place, so the daemon's own
  // soundness rule says no reload is needed.
  const Q = { ...P, time: 1, weather: 'storm' };

  const s = new CaptureSession();
  const seq = [];
  try {
    const a = await s.capture(P); seq.push({ tag: 'P first', sha: a.sha256, ms: a.served_in_ms });
    const b = await s.capture(Q); seq.push({ tag: 'Q (time 1, storm)', sha: b.sha256, ms: b.served_in_ms });
    const c = await s.capture(P); seq.push({ tag: 'P again', sha: c.sha256, ms: c.served_in_ms });
    rec({
      id: 'P4-spec-determinism',
      phase: 'sticky',
      what: 'the same spec, sent twice, with a differently-conditioned capture at the same place in between',
      must: 'the same spec must produce the same picture, or the cache promise is false',
      beaten: seq[0].sha !== seq[2].sha,
      summary: seq[0].sha === seq[2].sha
        ? 'the two P captures are byte-identical: the spec determines the picture'
        : `P and P-again DIFFER (${seq[0].sha.slice(0, 12)} vs ${seq[2].sha.slice(0, 12)}) — the picture depends on the job that ran before it`,
      evidence: seq,
    });
  } finally { s.close(); }
}

// =================================================================================================
// PHASE 5 — IS THE PROVINCE STREAMER EVER PUMPED FROM THE FIXED STEP?
// =================================================================================================
async function phaseStreamer() {
  const { launchGame } = await import('../lib/browser.mjs');
  const regions = readJson(path.join(REPO_ROOT, 'game/data/world/regions.json')).regions;
  const A = regions.find((r) => r.id === 'deep-marshes') || regions[0];
  const B = regions.find((r) => r.id !== A.id && Math.hypot(
    (r.bounds_m.x[0] + r.bounds_m.x[1]) / 2 - (A.bounds_m.x[0] + A.bounds_m.x[1]) / 2,
    (r.bounds_m.z[0] + r.bounds_m.z[1]) / 2 - (A.bounds_m.z[0] + A.bounds_m.z[1]) / 2) > 3000) || regions[regions.length - 1];
  const ax = (A.bounds_m.x[0] + A.bounds_m.x[1]) / 2, az = (A.bounds_m.z[0] + A.bounds_m.z[1]) / 2;
  const bx = (B.bounds_m.x[0] + B.bounds_m.x[1]) / 2, bz = (B.bounds_m.z[0] + B.bounds_m.z[1]) / 2;

  const h = await launchGame({ width: 640, height: 360 });
  const call = async (m, ...a) => {
    const r = await h.page.evaluate(async ({ m: mm, a: aa }) => {
      try { return { ok: await window.__HARNESS[mm](...aa) }; } catch (e) { return { err: String(e && e.message || e) }; }
    }, { m, a });
    if (r.err) throw new Error(m + ': ' + r.err);
    return r.ok;
  };
  const out = {};
  try {
    await call('setRenderRate', 0);
    await call('loadState', 'default');
    await call('teleport', ax, az);
    out.after_teleport_A = await call('streamAround', ax, az, 0);
    // 1. Step the fixed step a long time with the camera and the body at B. If anything inside the
    //    step pumps the province, B becomes resident.
    await call('camera', { pos: [bx, 60, bz], look: [bx + 30, 40, bz + 30], fov: 70 });
    await call('stepFrames', 600);
    await call('renderFrame');
    out.B_after_600_steps = await call('streamAround', bx, bz, 0);
    // streamAround(...,0) itself re-focuses; re-teleport to A so the next probe is honest.
    await call('teleport', ax, az);
    // 2. WALK the body a long way with the game's own walking instrument and ask again.
    let walked = null;
    try { walked = await call('walkPath', [[ax, az], [ax + 900, az]], { speed: 'jog', maxFrames: 4000 }); }
    catch (e) { walked = { error: String(e.message) }; }
    out.walk = walked && walked.error ? walked : { frames: walked && walked.frames, path_m: walked && walked.path_m };
    const p = await h.page.evaluate(() => window.__HARNESS.snapshot({ minimal: true }).player.pos);
    out.player_after_walk = p;
    out.at_player_after_walk = await call('streamAround', p[0], p[2], 0);
    out.province_stats = (await call('getWorldStats')).streaming;
  } finally { await h.close(); }

  const stepNeverPumped = out.B_after_600_steps && out.B_after_600_steps.queued > 0;
  rec({
    id: 'P5-streamer-from-step',
    phase: 'streamer',
    what: '600 fixed-step frames with the camera 3+ km from the last teleport, then a probe of what is built there',
    must: 'if the step pumped the streamer, queued would be 0',
    beaten: false,
    summary: stepNeverPumped
      ? `CONFIRMED: after 600 steps, ${out.B_after_600_steps.queued} tiles at the camera are still unbuilt — ` +
        'the fixed step never pumps renderer.province'
      : `NOT confirmed: queued=${out.B_after_600_steps && out.B_after_600_steps.queued}`,
    evidence: out,
  });
  const walkProbe = out.at_player_after_walk;
  rec({
    id: 'P5b-streamer-while-walking',
    phase: 'streamer',
    what: 'the player WALKS 900 m with walkPath() — the instrument S34(b) names for arrival evidence — ' +
      'and we ask what is built where the body ended up',
    must: 'a walking player must not walk off the built world',
    beaten: false,
    summary: walkProbe ? `after walking, ${walkProbe.queued} tile(s) unbuilt at the player, ${walkProbe.tilesResident} resident` : 'walk did not run',
    evidence: { walk: out.walk, player: out.player_after_walk, probe: walkProbe, stats: out.province_stats },
  });
}

// =================================================================================================
const phases = [];
if (args.gates || args.all) phases.push(['gates', phaseGates]);
if (args.key || args.all) phases.push(['key', phaseKey]);
if (args.forge) phases.push(['forge', phaseForge]);
if (args.sticky) phases.push(['sticky', phaseSticky]);
if (args.streamer) phases.push(['streamer', phaseStreamer]);
if (!phases.length) usage(USAGE, EXIT.USAGE);

for (const [name, fn] of phases) {
  log(`--- ${name} ---`);
  try { await fn(); }
  catch (e) { rec({ id: `${name}-ERRORED`, phase: name, beaten: false, summary: 'phase threw: ' + (e && e.message), evidence: { stack: String(e && e.stack) } }); }
}

const beaten = findings.filter((f) => f.beaten);
const report = {
  schema: 'elder-souls/capture-critic-probe@1',
  ran_at: new Date().toISOString(),
  ruling: 'ARBITRATION.md S34',
  written_by: 'the CAPTURE-SERVICE-R1 critic, not the service builder',
  phases: phases.map(([n]) => n),
  attacks_that_succeeded: beaten.length,
  verdict: beaten.length ? 'GATES BEATEN' : 'held',
  findings,
};
const outFile = path.join(OUT, 'CRITIC-PROBE.json');
let prev = {};
try { prev = JSON.parse(fs.readFileSync(outFile, 'utf8')); } catch { /* */ }
if (prev.findings) report.findings = [...prev.findings.filter((f) => !phases.some(([n]) => n === f.phase)), ...findings];
fs.writeFileSync(outFile, JSON.stringify(report, null, 2));
process.stdout.write(`${report.verdict}: ${beaten.length} of ${findings.length} checks found a hole\n`);
process.exit(beaten.length ? EXIT.MEASUREMENT_FAIL : EXIT.OK);
