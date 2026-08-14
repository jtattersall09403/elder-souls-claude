#!/usr/bin/env node
/**
 * protocol-a-transport-proof.mjs — the delete-the-fix proof for the one change RI-VIS06
 * Protocol A had to make outside its own files.
 *
 * WHAT BROKE, AND IT WAS NOT THE RENDER
 * -------------------------------------
 * On 2026-08-14 Protocol A's capture reached a real RTX 3090, logged
 * `HARDWARE — valid for appearance claims`, planned `2 setups x 3 times x 1 weathers = 6 frames`,
 * and died 66 seconds later on `Error: GET /job?id=... timed out` inside
 * `tools/runpod/lib/http-transport.mjs`. The GPU was fine. The renderer was fine. One HTTPS poll
 * of the job-status endpoint stalled, `PodAgentClient.exec` threw on it, and mandatory Pod cleanup
 * took the frames with it. Protocol A has never run in this project's history and that is why.
 *
 * THE FIX is in `exec()`: a failed poll is retried instead of thrown, because polling is
 * IDEMPOTENT — `outOffset`/`errOffset` advance only after a poll succeeds, so a repeat requests
 * the same byte range and can neither lose nor duplicate a log line, and the job goes on running
 * on the Pod whether or not anyone is listening.
 *
 * WHY THIS FILE EXISTS (RULES.md rule 4, rule 6)
 * ---------------------------------------------
 * A guard that has never fired is not evidence. Four arms, and they are required to DISAGREE:
 *
 *   1. TRANSIENT   a poll fails twice mid-job, then recovers. Fixed code must return the frames.
 *   2. CONTROL     the same script against the OLD behaviour (retry disabled) must LOSE the job.
 *                  If arm 2 passes, arm 1 proves nothing and this suite says so and exits non-zero.
 *   3. PERSISTENT  the agent is genuinely gone: every poll fails. Must still fail, and must not
 *                  hang — a retry loop that never gives up is a worse bug than the one it fixed.
 *   4. NO LOSS     across the transient failures, the reconstructed stdout must be byte-identical
 *                  to what a clean run returns. This is the idempotence claim, actually checked,
 *                  rather than asserted in the comment above.
 *
 * Arm 2 is the one that matters. HAZARDS.md §0's fifth failure shape is a suite whose arms all
 * fabricate the disputed input identically; here the disputed claim is "the old code would have
 * died", so one arm runs the old code and is REQUIRED to die.
 *
 * USAGE  node tools/blind/protocol-a-transport-proof.mjs
 * EXIT   0 all four arms behaved as required; 1 otherwise.
 */
import { PodAgentClient } from '../runpod/lib/http-transport.mjs';

const CHUNKS = ['plan: 2 setups x 3 times x 1 weathers = 6 frames\n', 'frame 1/6 ok\n', 'frame 2/6 ok\n', 'frame 3/6 ok\n', 'DONE\n'];

/**
 * A fake Pod agent. It serves a job whose stdout arrives in CHUNKS, one per successful poll, and
 * it fails whichever polls the caller nominates. `failPolls: 'all'` is a Pod that has gone away.
 */
function makeFetch({ failPolls }) {
  let poll = 0;
  const state = { polls: 0, failures: 0 };
  const impl = async (url, opts = {}) => {
    if (opts.signal?.aborted) throw opts.signal.reason || new Error('aborted');
    if (url.includes('/exec')) {
      return { ok: true, status: 200, text: async () => JSON.stringify({ id: 'job-1' }) };
    }
    if (url.includes('/job')) {
      poll++; state.polls = poll;
      const fail = failPolls === 'all' || (Array.isArray(failPolls) && failPolls.includes(poll));
      if (fail) { state.failures++; throw new Error(`GET /job?id=job-1 timed out`); }
      // Serve from the offset the caller asked for, exactly as the real agent does.
      const outOffset = Number(new URL(url).searchParams.get('outOffset'));
      const whole = CHUNKS.join('');
      const served = CHUNKS.slice(0, Math.min(CHUNKS.length, state.polls)).join('');
      const body = served.slice(outOffset);
      const done = served.length >= whole.length;
      return {
        ok: true, status: 200,
        text: async () => JSON.stringify({
          running: !done, exitCode: done ? 0 : null, timedOut: false,
          stdout: body, stderr: '', outOffset: outOffset + body.length, errOffset: 0, elapsedSec: 1,
        }),
      };
    }
    throw new Error(`unexpected route ${url}`);
  };
  return { impl, state };
}

/** The OLD behaviour, reimplemented exactly: poll once, throw on any failure. This is the control. */
async function execOldWay(fetchImpl) {
  const started = JSON.parse(await (await fetchImpl('https://pod/exec', {})).text());
  let outOffset = 0; let stdout = '';
  for (;;) {
    const status = JSON.parse(await (await fetchImpl(`https://pod/job?id=${started.id}&outOffset=${outOffset}&errOffset=0`, {})).text());
    outOffset = status.outOffset;
    if (status.stdout) stdout += status.stdout;
    if (!status.running) return { exitCode: status.exitCode, stdout };
  }
}

function client(fetchImpl) {
  return new PodAgentClient({ baseUrl: 'https://pod', token: 't'.repeat(40), fetchImpl });
}

const results = [];
const record = (arm, pass, detail) => { results.push({ arm, pass, detail }); console.log(`${pass ? 'PASS' : 'FAIL'}  ${arm}  — ${detail}`); };

// ARM 1 — transient failures mid-job. The fixed exec must ride them out.
let clean = null;
{
  const { impl } = makeFetch({ failPolls: [] });
  clean = await client(impl).exec('render', { pollMs: 1 });
  const { impl: flaky, state } = makeFetch({ failPolls: [2, 3] });
  let out = null; let err = null;
  try { out = await client(flaky).exec('render', { pollMs: 1 }); } catch (e) { err = e; }
  record('1 TRANSIENT (fixed)', Boolean(out) && out.exitCode === 0,
    err ? `threw: ${err.message}` : `survived ${state.failures} failed poll(s), exit ${out.exitCode}, ${out.stdout.length} bytes of stdout`);

  // ARM 4 — idempotence: no log bytes lost or duplicated across the retried polls.
  record('4 NO LOSS', Boolean(out) && out.stdout === clean.stdout,
    out ? (out.stdout === clean.stdout ? 'stdout byte-identical to a clean run' : `stdout DIFFERS: ${JSON.stringify(out.stdout)} vs ${JSON.stringify(clean.stdout)}`) : 'no output to compare');
}

// ARM 2 — THE CONTROL. The same two failures against the old code must lose the job.
{
  const { impl } = makeFetch({ failPolls: [2, 3] });
  let died = false; let detail = '';
  try { const r = await execOldWay(impl); detail = `completed anyway, exit ${r.exitCode}`; }
  catch (e) { died = true; detail = `lost the job exactly as it did on the RTX 3090: ${e.message}`; }
  record('2 CONTROL (old behaviour must die)', died, detail);
}

// ARM 3 — the agent is genuinely gone. Must fail, and must terminate.
{
  const { impl, state } = makeFetch({ failPolls: 'all' });
  const t0 = Date.now();
  let threw = false; let msg = '';
  try { await client(impl).exec('render', { pollMs: 1 }); } catch (e) { threw = true; msg = e.message; }
  const secs = ((Date.now() - t0) / 1000).toFixed(1);
  record('3 PERSISTENT (must give up, not hang)', threw && Number(secs) < 120,
    threw ? `gave up after ${state.polls} polls in ${secs}s: ${msg}` : 'never threw — the retry loop is unbounded');
}

const failed = results.filter((r) => !r.pass);
console.log('');
if (failed.length) {
  console.log(`TRANSPORT PROOF: FAIL — ${failed.map((f) => f.arm).join(', ')}`);
  process.exit(1);
}
console.log('TRANSPORT PROOF: PASS — the retry rides out transient polls without losing a byte, the old');
console.log('behaviour loses the same job (so arm 1 is not vacuous), and a genuinely dead agent still fails.');
process.exit(0);
