// `node tools/runpod/cli.mjs selftest`
//
// Every arm here is paired with an arm that must come out differently. A self-test whose arms all
// agree proves only that the code runs; these are built so that deleting the guard, the owner tag,
// the auth check or the ENOSPC classifier turns a PASS into a FAIL.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { cleanupCommand } from '../cli.mjs';
import { currentOwner, ownerNameSegment, ownerOfName, ownerSlug } from './owner.mjs';
import { classifyWriteError, guardArtifactWrite } from './disk.mjs';
import { isClaimLive } from './claims.mjs';
import { PodAgentClient, podAgentScript } from './http-transport.mjs';
import { spawn } from 'node:child_process';

const CONFIG = {
  podNamePrefix: 'elder-souls-gpu-',
  absoluteMaxRuntimeMinutes: 120,
  containerDiskInGb: 30,
};

const MINE = ownerSlug('self-test-owner-A');
const THEIRS = ownerSlug('self-test-owner-B');
const IMAGE = 'runpod/base:1.0.3-ubuntu2404';

function fakeClient(pods, templates = []) {
  const state = {
    pods: pods.map((pod) => ({ ...pod })),
    templates: templates.map((template) => ({ ...template })),
    deletedPods: [],
    deletedTemplates: [],
  };
  return {
    state,
    async getTemplate(id) {
      if (id === 'source-template') return { id, imageName: IMAGE, name: 'source' };
      return state.templates.find((template) => template.id === id) || null;
    },
    async listTemplates() { return state.templates; },
    async listPods() { return state.pods; },
    async getPod(id) { return state.pods.find((pod) => pod.id === id) || null; },
    async deletePod(id) {
      state.deletedPods.push(id);
      state.pods = state.pods.filter((pod) => pod.id !== id);
    },
    async deleteTemplate(id) {
      state.deletedTemplates.push(id);
      state.templates = state.templates.filter((template) => template.id !== id);
    },
  };
}

function podFixture(ownerHex, { id = 'pod-x', ageMinutes = 5 } = {}) {
  return {
    id,
    name: `${CONFIG.podNamePrefix}${ownerNameSegment(ownerHex)}20260814-090000Z-1234`,
    templateId: 'source-template',
    imageName: IMAGE,
    desiredStatus: 'RUNNING',
    costPerHr: 0.27,
    createdAt: new Date(Date.now() - ageMinutes * 60_000).toISOString(),
  };
}

async function runCleanup(args, client, claims = new Map()) {
  const lines = [];
  const result = await cleanupCommand(args, CONFIG, {
    client,
    claims,
    environment: { apiKey: 'x', templateId: 'source-template' },
    owner: { slug: MINE, source: 'self-test', weak: false },
    log: (message) => lines.push(String(message)),
    logError: (message) => lines.push(String(message)),
  });
  return { ...result, lines, deleted: client.state.deletedPods };
}

/** A claim held by a process that is definitely alive but is not us. */
function liveSiblingClaim(podId, runId = 'sibling-run') {
  // pid 1 always exists and is never this process, so "a live sibling" needs no fixture process.
  return { podId, pid: 1, runId, claimedAt: new Date().toISOString() };
}
function deadClaim(podId, runId = 'crashed-run') {
  return { podId, pid: 2147480000, startTicks: '1', runId, claimedAt: new Date().toISOString() };
}

const arms = [
  // --- Job 1: the cleanup guard. Arms 1 and 2 differ only in who owns the Pod. ---
  {
    name: 'cleanup/foreign-pod-is-refused',
    why: 'a bare cleanup must not terminate a Pod another agent created',
    async run() {
      const client = fakeClient([podFixture(THEIRS, { id: 'pod-theirs' })]);
      const result = await runCleanup({}, client);
      if (result.deleted.length !== 0) return { pass: false, detail: `deleted ${result.deleted.join(',')}` };
      if (!result.protectedPods.includes('pod-theirs')) return { pass: false, detail: 'foreign Pod was not reported as protected' };
      return { pass: true, detail: 'foreign Pod survived a bare cleanup and was listed as protected' };
    },
  },
  {
    name: 'cleanup/own-claimed-pod-is-terminated',
    why: 'the guard must not be a blanket refusal; the same call must still clean up a Pod this lineage claimed',
    async run() {
      const client = fakeClient([podFixture(MINE, { id: 'pod-mine' })]);
      // A claim written by this very process: unambiguously ours, not a sibling's.
      const claims = new Map([['pod-mine', { podId: 'pod-mine', pid: process.pid, runId: 'my-run' }]]);
      const result = await runCleanup({}, client, claims);
      if (result.deleted.join(',') !== 'pod-mine') return { pass: false, detail: `deleted [${result.deleted.join(',')}], expected pod-mine` };
      return { pass: true, detail: 'a Pod this process claimed is terminated by the same no-argument command' };
    },
  },
  {
    name: 'cleanup/all-without-yes-refuses-and-exits-nonzero-worthy',
    why: '--all alone must not be enough to kill another agent\'s live work',
    async run() {
      const client = fakeClient([podFixture(THEIRS, { id: 'pod-theirs' })]);
      const result = await runCleanup({ all: true }, client);
      if (result.deleted.length !== 0) return { pass: false, detail: `deleted ${result.deleted.join(',')}` };
      if (!result.refusals.length) return { pass: false, detail: 'no refusal was reported, so a caller could not tell it did nothing' };
      return { pass: true, detail: '--all refused and said so' };
    },
  },
  {
    name: 'cleanup/all-with-yes-does-terminate',
    why: 'the explicit destructive path must still exist, or people will find a worse one',
    async run() {
      const client = fakeClient([podFixture(THEIRS, { id: 'pod-theirs' })]);
      const result = await runCleanup({ all: true, yes: true }, client);
      if (result.deleted.join(',') !== 'pod-theirs') return { pass: false, detail: `deleted [${result.deleted.join(',')}]` };
      return { pass: true, detail: '--all --yes terminated the foreign Pod, as asked' };
    },
  },
  {
    name: 'cleanup/pod-id-refuses-a-foreign-pod-without-force',
    why: '--pod is a targeted repair, not an ownership override',
    async run() {
      const client = fakeClient([podFixture(THEIRS, { id: 'pod-theirs' })]);
      const refused = await runCleanup({ pod: 'pod-theirs' }, client);
      if (refused.deleted.length !== 0) return { pass: false, detail: '--pod terminated a foreign Pod without --force' };
      const forced = await runCleanup({ pod: 'pod-theirs', force: true }, client);
      if (forced.deleted.join(',') !== 'pod-theirs') return { pass: false, detail: '--force did not override' };
      return { pass: true, detail: 'refused without --force, obeyed with it' };
    },
  },
  {
    name: 'cleanup/older-than-floor-is-enforced',
    why: 'a sweep shorter than the runtime cap could catch a live run',
    async run() {
      const client = fakeClient([podFixture(THEIRS, { id: 'pod-theirs', ageMinutes: 400 })]);
      let threw = null;
      try { await runCleanup({ olderThan: '10' }, client); } catch (error) { threw = error.message; }
      if (!threw) return { pass: false, detail: '--older-than 10 was accepted below the 120 minute cap' };
      const swept = await runCleanup({ olderThan: '180' }, client);
      if (swept.deleted.join(',') !== 'pod-theirs') return { pass: false, detail: 'a 400-minute-old Pod was not swept at --older-than 180' };
      return { pass: true, detail: 'floor enforced; legitimate old sweep still works' };
    },
  },
  {
    name: 'cleanup/young-foreign-pod-survives-an-older-than-sweep',
    why: 'the age sweep must protect a Pod that could still be someone\'s live run',
    async run() {
      const client = fakeClient([podFixture(THEIRS, { id: 'pod-young', ageMinutes: 9 })]);
      const result = await runCleanup({ olderThan: '180' }, client);
      if (result.deleted.length !== 0) return { pass: false, detail: 'a 9-minute-old foreign Pod was swept' };
      return { pass: true, detail: 'young foreign Pod protected' };
    },
  },
  {
    name: 'cleanup/sibling-agent-live-pod-survives-despite-an-identical-owner-slug',
    why: 'THE REAL BUG: CLAUDE_CODE_SESSION_ID is container-scoped, so sibling agents share a slug. '
      + 'Four sibling runs on 2026-08-14 all carried slug e9b0d69d and a bare cleanup killed one of them.',
    async run() {
      const client = fakeClient([podFixture(MINE, { id: 'pod-sibling', ageMinutes: 2 })]);
      const claims = new Map([['pod-sibling', liveSiblingClaim('pod-sibling')]]);
      const result = await runCleanup({}, client, claims);
      if (result.deleted.length !== 0) return { pass: false, detail: `deleted a sibling's live Pod: ${result.deleted.join(',')}` };
      if (!result.protectedPods.includes('pod-sibling')) return { pass: false, detail: 'not reported as protected' };
      return { pass: true, detail: "same owner slug, but a live claim from another pid keeps the sibling's Pod alive" };
    },
  },
  {
    name: 'cleanup/crashed-run-pod-is-still-reaped',
    why: 'the claim guard must not become a blanket refusal; a dead pid is exactly what cleanup is for',
    async run() {
      const client = fakeClient([podFixture(MINE, { id: 'pod-crashed', ageMinutes: 2 })]);
      const claims = new Map([['pod-crashed', deadClaim('pod-crashed')]]);
      const result = await runCleanup({}, client, claims);
      if (result.deleted.join(',') !== 'pod-crashed') return { pass: false, detail: `deleted [${result.deleted.join(',')}], expected pod-crashed` };
      return { pass: true, detail: 'a Pod whose claiming process is gone is still terminated' };
    },
  },
  {
    name: 'cleanup/unclaimed-young-pod-with-my-slug-is-not-assumed-mine',
    why: 'a sibling running from another worktree may leave no claim here; age is the only honest signal',
    async run() {
      const client = fakeClient([podFixture(MINE, { id: 'pod-young', ageMinutes: 3 })]);
      const young = await runCleanup({}, client, new Map());
      if (young.deleted.length !== 0) return { pass: false, detail: 'a 3-minute-old unclaimed Pod was assumed to be mine' };
      const old = await runCleanup({}, fakeClient([podFixture(MINE, { id: 'pod-old', ageMinutes: 500 })]), new Map());
      if (old.deleted.join(',') !== 'pod-old') return { pass: false, detail: 'a 500-minute-old orphan was not reaped, so the rule is always-refuse' };
      return { pass: true, detail: 'young unclaimed Pod protected; one past the runtime cap reaped' };
    },
  },
  {
    name: 'cleanup/pod-id-and-older-than-also-respect-a-live-sibling-claim',
    why: 'the targeted and sweep paths must not be a way around the claim guard',
    async run() {
      const claims = new Map([['pod-sibling', liveSiblingClaim('pod-sibling')]]);
      const targeted = await runCleanup({ pod: 'pod-sibling' }, fakeClient([podFixture(MINE, { id: 'pod-sibling', ageMinutes: 2 })]), claims);
      if (targeted.deleted.length !== 0) return { pass: false, detail: '--pod bypassed a live sibling claim' };
      const swept = await runCleanup({ olderThan: '180' }, fakeClient([podFixture(THEIRS, { id: 'pod-sibling', ageMinutes: 500 })]), claims);
      if (swept.deleted.length !== 0) return { pass: false, detail: '--older-than bypassed a live sibling claim' };
      const forced = await runCleanup({ pod: 'pod-sibling', force: true }, fakeClient([podFixture(MINE, { id: 'pod-sibling', ageMinutes: 2 })]), claims);
      if (forced.deleted.join(',') !== 'pod-sibling') return { pass: false, detail: '--force did not override the claim guard' };
      return { pass: true, detail: 'both paths refuse a live claim; --force still overrides deliberately' };
    },
  },
  {
    name: 'claims/liveness-distinguishes-a-running-process-from-a-recycled-pid',
    why: 'if every claim read as live, cleanup would never reap anything',
    async run() {
      const live = isClaimLive({ pid: process.pid, startTicks: null });
      const gone = isClaimLive({ pid: 2147480000, startTicks: '1' });
      const recycled = isClaimLive({ pid: process.pid, startTicks: 'definitely-not-the-real-start-time' });
      if (!live) return { pass: false, detail: 'this very process read as dead' };
      if (gone) return { pass: false, detail: 'a nonexistent pid read as live' };
      if (recycled) return { pass: false, detail: 'a mismatched start time still read as live, so pid reuse is undetected' };
      return { pass: true, detail: 'live pid live, absent pid dead, recycled pid dead' };
    },
  },

  {
    name: 'owner/name-tag-round-trips-and-legacy-names-read-as-unattributed',
    why: 'ownership lives in the Pod name; a date-shaped legacy runId must not be read as an owner',
    async run() {
      const tagged = `${CONFIG.podNamePrefix}${ownerNameSegment(MINE)}20260814-090000Z-1`;
      const legacy = `${CONFIG.podNamePrefix}20260814-090000Z-1`;
      const a = ownerOfName(tagged, CONFIG.podNamePrefix);
      const b = ownerOfName(legacy, CONFIG.podNamePrefix);
      if (a !== MINE) return { pass: false, detail: `tagged name parsed as ${a}` };
      if (b !== null) return { pass: false, detail: `legacy name parsed as owner ${b} — a date was mistaken for an owner slug` };
      return { pass: true, detail: 'tagged -> owner, legacy -> unattributed' };
    },
  },
  {
    name: 'owner/identity-prefers-an-explicit-per-agent-value',
    why: 'the session id is container-scoped, not agent-scoped; claiming otherwise is what let a sibling Pod be killed',
    async run() {
      const explicit = currentOwner({ RUNPOD_OWNER: 'agent-7', CLAUDE_CODE_SESSION_ID: 'sess' });
      const session = currentOwner({ CLAUDE_CODE_SESSION_ID: 'sess' });
      const fallback = currentOwner({});
      if (explicit.slug === session.slug) return { pass: false, detail: 'RUNPOD_OWNER did not take precedence' };
      if (fallback.scope !== 'box') return { pass: false, detail: `hostname fallback scope was ${fallback.scope}` };
      if (session.scope !== 'container') return { pass: false, detail: `session identity claimed scope ${session.scope}; it is container-scoped and must say so` };
      if (explicit.scope !== 'agent') return { pass: false, detail: `RUNPOD_OWNER scope was ${explicit.scope}` };
      return { pass: true, detail: 'scopes reported honestly: RUNPOD_OWNER=agent, session=container, hostname=box' };
    },
  },

  // --- Job 3: a full disk must fail loudly. ---
  {
    name: 'disk/enospc-is-classified-differently-from-other-write-errors',
    why: 'a silent ENOSPC is a clean-looking run that wrote nothing',
    async run() {
      const full = classifyWriteError(Object.assign(new Error('no space'), { code: 'ENOSPC' }), '/x/y.png');
      const denied = classifyWriteError(Object.assign(new Error('denied'), { code: 'EACCES' }), '/x/y.png');
      if (!full.fatal || !/disk is full/i.test(full.message)) return { pass: false, detail: `ENOSPC classified as: ${full.message}` };
      if (denied.kind === full.kind) return { pass: false, detail: 'EACCES and ENOSPC classify identically' };
      return { pass: true, detail: `ENOSPC -> ${full.kind} (fatal), EACCES -> ${denied.kind}` };
    },
  },
  {
    name: 'disk/guard-throws-before-writing-into-a-full-filesystem',
    why: 'the check has to happen before the capture, not after the frames are lost',
    async run() {
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'runpod-selftest-'));
      let threw = null;
      try {
        await guardArtifactWrite(dir, { requiredBytes: Number.MAX_SAFE_INTEGER, label: 'self-test' });
      } catch (error) { threw = error; }
      let passedWhenSpaceIsAmple = true;
      try { await guardArtifactWrite(dir, { requiredBytes: 1024, label: 'self-test' }); }
      catch { passedWhenSpaceIsAmple = false; }
      fs.rmSync(dir, { recursive: true, force: true });
      if (!threw) return { pass: false, detail: 'an impossible space requirement was accepted' };
      if (!passedWhenSpaceIsAmple) return { pass: false, detail: 'a 1 KiB requirement was rejected, so the guard is just always-fail' };
      return { pass: true, detail: 'refuses when space is short, allows when it is not' };
    },
  },

  {
    name: 'disk/harness-refuses-to-launch-a-browser-on-a-full-disk',
    why: 'the 247 harness tools all reach the browser through launchGame, so the check belongs there',
    async run() {
      const script = "import('./tools/lib/browser.mjs').then(m => { m.assertCaptureDiskSpace(); console.log('ALLOWED'); })";
      const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../..');
      const run = (minFreeMb) => new Promise((resolve) => {
        const child = spawn(process.execPath, ['--input-type=module', '-e', script], {
          cwd: repoRoot,
          env: { ...process.env, ELDER_SOULS_MIN_FREE_MB: String(minFreeMb) },
          stdio: ['ignore', 'pipe', 'pipe'],
        });
        let out = '';
        child.stdout.on('data', (chunk) => { out += chunk; });
        child.stderr.on('data', (chunk) => { out += chunk; });
        child.on('close', (code) => resolve({ code, out }));
      });
      const full = await run(100_000_000); // ~95 TiB required: nothing has this
      const fine = await run(1);
      if (full.code === 0) return { pass: false, detail: 'launch was allowed with an impossible free-space floor' };
      if (!/disk is full/i.test(full.out)) return { pass: false, detail: `refusal did not name the disk: ${full.out.slice(0, 200)}` };
      if (fine.code !== 0 || !/ALLOWED/.test(fine.out)) return { pass: false, detail: `a 1 MiB floor also refused, so the guard is always-fail: ${fine.out.slice(0, 200)}` };
      return { pass: true, detail: 'refuses loudly when the disk is short, allows when it is not' };
    },
  },

  // --- Job 2: the HTTP transport, exercised against a real local instance of the pod agent. ---
  {
    name: 'transport/agent-executes-and-reports-both-outcomes',
    why: 'a transport that cannot distinguish success from failure is worse than none',
    async run() {
      return withLocalAgent(async (client) => {
        const ok = await client.exec('echo hello-from-agent', { timeoutSec: 30 });
        const bad = await client.exec('exit 7', { timeoutSec: 30 });
        if (ok.exitCode !== 0) return { pass: false, detail: `success arm exited ${ok.exitCode}` };
        if (!/hello-from-agent/.test(ok.stdout)) return { pass: false, detail: `stdout not captured: ${JSON.stringify(ok.stdout)}` };
        if (bad.exitCode !== 7) return { pass: false, detail: `failure arm exited ${bad.exitCode}, expected 7` };
        return { pass: true, detail: 'exit 0 with stdout, and exit 7, both reported faithfully' };
      });
    },
  },
  {
    name: 'transport/agent-rejects-a-wrong-token',
    why: 'the RunPod proxy URL is public, so the agent is the only thing standing in front of a root shell',
    async run() {
      return withLocalAgent(async (client, { baseUrl }) => {
        const impostor = new PodAgentClient({ baseUrl, token: 'not-the-token' });
        let status = null;
        try { await impostor.exec('echo nope', { timeoutSec: 10 }); }
        catch (error) { status = error.status || error.message; }
        if (status !== 401) return { pass: false, detail: `wrong token produced ${status}, expected 401` };
        const ok = await client.exec('echo yes', { timeoutSec: 10 });
        if (ok.exitCode !== 0) return { pass: false, detail: 'correct token failed' };
        return { pass: true, detail: 'wrong token 401, correct token runs' };
      });
    },
  },
  {
    name: 'transport/artifacts-round-trip-through-http',
    why: 'retrieving frames over HTTPS is the whole point: SSH is unavailable through this proxy',
    async run() {
      return withLocalAgent(async (client) => {
        await client.exec('mkdir -p /tmp/agent-selftest-art && printf FRAMEBYTES > /tmp/agent-selftest-art/frame.txt', { timeoutSec: 30 });
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'runpod-artifacts-'));
        const count = await client.downloadDirectory('/tmp/agent-selftest-art', dir);
        const file = path.join(dir, 'frame.txt');
        const content = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null;
        const missing = await client.downloadDirectory('/tmp/definitely-not-here', dir).then(() => 'no-error').catch(() => 'errored');
        fs.rmSync(dir, { recursive: true, force: true });
        if (content !== 'FRAMEBYTES') return { pass: false, detail: `retrieved ${JSON.stringify(content)} from ${count} file(s)` };
        if (missing !== 'errored') return { pass: false, detail: 'a missing remote directory reported success' };
        return { pass: true, detail: 'file bytes round-tripped; a missing directory errors instead of reporting an empty success' };
      });
    },
  },
];

async function withLocalAgent(body) {
  const token = 'self-test-token-0123456789abcdef0123456789';
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'runpod-agent-'));
  const scriptPath = path.join(dir, 'agent.py');
  fs.writeFileSync(scriptPath, podAgentScript());
  const child = spawn('python3', [scriptPath], {
    env: { ...process.env, POD_AGENT_TOKEN: token, POD_AGENT_PORT: '8991', POD_AGENT_BIND: '127.0.0.1' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let stderr = '';
  child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
  const baseUrl = 'http://127.0.0.1:8991';
  const client = new PodAgentClient({ baseUrl, token });
  try {
    const deadline = Date.now() + 15_000;
    let ready = false;
    while (Date.now() < deadline && !ready) {
      ready = await client.health().then(() => true).catch(() => false);
      if (!ready) await new Promise((resolve) => setTimeout(resolve, 250));
    }
    if (!ready) return { pass: false, detail: `local agent never became healthy: ${stderr.slice(-400)}` };
    return await body(client, { baseUrl, token });
  } finally {
    child.kill('SIGKILL');
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

export async function selfTest({ json = false, only = null } = {}) {
  const results = [];
  for (const arm of arms) {
    if (only && !arm.name.includes(only)) continue;
    let outcome;
    try { outcome = await arm.run(); }
    catch (error) { outcome = { pass: false, detail: `threw: ${error.message}` }; }
    results.push({ name: arm.name, why: arm.why, ...outcome });
    if (!json) {
      console.log(`${outcome.pass ? 'PASS' : 'FAIL'}  ${arm.name}\n      ${outcome.detail}`);
    }
  }
  const failed = results.filter((result) => !result.pass);
  if (json) console.log(JSON.stringify({ schema: 'elder-souls/runpod-selftest@1', results, failed: failed.length }, null, 2));
  else console.log(`\n${results.length - failed.length}/${results.length} arms passed`);
  return failed.length === 0;
}
