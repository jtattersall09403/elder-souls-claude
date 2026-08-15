import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  RunPodClient,
  RunPodError,
  chooseOffers,
  isManagedPod,
  isManagedRuntimeTemplate,
  normalizeOffers,
} from '../lib/api.mjs';
import { runCommand } from '../cli.mjs';
import { createSnapshot, makeEphemeralSshKey, runProcess } from '../lib/local.mjs';
import { buildProvisioningBatches, provisionPod } from '../lib/provision.mjs';
import { launchCandidates } from '../worker/browser-config.mjs';

function offer(gpuTypeId, cloudType, pricePerHourUsd) {
  return {
    gpuTypeId,
    displayName: gpuTypeId,
    cloudType,
    memoryInGb: 8,
    cloudAvailable: true,
    stockStatus: 'Low',
    pricePerHourUsd,
    availableGpuCounts: [1],
  };
}

function podFor(id, gpuTypeId, costPerHr) {
  return { id, gpu: { id: gpuTypeId }, costPerHr, volumeInGb: 0 };
}

function capacityError() {
  return new RunPodError('HTTP 500: This machine does not have the resources to deploy your pod', {
    status: 500,
    details: { error: 'This machine does not have the resources to deploy your pod' },
    creationOutcome: 'definite-non-creation',
    creationFailureKind: 'capacity',
  });
}

function provisionPodFixture(client, candidates, overrides = {}) {
  return provisionPod({
    client,
    candidates,
    podName: 'unique-test-pod',
    createInput: (batch) => ({
      name: 'unique-test-pod',
      cloudType: batch.cloudType,
      gpuCount: 1,
      gpuTypeIds: batch.gpuTypeIds,
      gpuTypePriority: 'availability',
      volumeInGb: 0,
    }),
    recoverPodByName: async () => null,
    ...overrides,
  });
}

test('Chromium hardware smoke keeps the required Linux ANGLE Vulkan feature gates', () => {
  const vulkanCandidates = launchCandidates.filter(({ name }) => name.startsWith('angle-vulkan'));
  assert.equal(vulkanCandidates.length >= 2, true);
  for (const candidate of vulkanCandidates) {
    assert.equal(candidate.args.includes('--use-gl=angle'), true);
    assert.equal(candidate.args.includes('--use-angle=vulkan'), true);
    assert.equal(
      candidate.args.includes('--enable-features=Vulkan,DefaultANGLEVulkan,VulkanFromANGLE'),
      true,
    );
  }
});

test('Pod SSH readiness covers the bounded entrypoint installation budget', () => {
  const config = JSON.parse(fs.readFileSync(path.resolve('tools/runpod/config.json'), 'utf8'));
  const entrypoint = fs.readFileSync(path.resolve('tools/runpod/worker/ssh-entrypoint.sh'), 'utf8');
  const installBudgetSeconds = [...entrypoint.matchAll(/timeout\s+(\d+)s\s+apt-get/g)]
    .reduce((total, match) => total + Number(match[1]), 0);
  assert.equal(installBudgetSeconds > 0, true, 'the entrypoint installation bounds must remain explicit');
  assert.equal(
    config.readyTimeoutMinutes * 60 >= installBudgetSeconds + 60,
    true,
    `readiness ${config.readyTimeoutMinutes * 60}s must cover ${installBudgetSeconds}s of bounded apt work plus boot margin`,
  );
});

test('offer normalization and selection enforce allowlist, capacity, cloud, and ceiling', () => {
  const offers = normalizeOffers([
    {
      id: 'cheap', displayName: 'Cheap', memoryInGb: 8, secureCloud: true, communityCloud: true,
      secure: { stockStatus: 'High', uninterruptablePrice: 0.25, availableGpuCounts: [1] },
      community: { stockStatus: 'Low', uninterruptablePrice: 0.12, availableGpuCounts: [1, 2] },
    },
    {
      id: 'fallback', displayName: 'Fallback', memoryInGb: 16, secureCloud: true, communityCloud: false,
      secure: { stockStatus: 'Medium', uninterruptablePrice: 0.19, availableGpuCounts: null },
      community: null,
    },
    {
      id: 'unapproved', displayName: 'Unapproved', memoryInGb: 80, secureCloud: true,
      secure: { stockStatus: 'High', uninterruptablePrice: 0.01, availableGpuCounts: [1] },
    },
  ]);
  const selected = chooseOffers(offers, {
    allowedGpuTypes: ['cheap', 'fallback'],
    cloudTypes: ['COMMUNITY', 'SECURE'],
    maxPricePerHourUsd: 0.2,
  });
  assert.deepEqual(selected.map((offer) => [offer.gpuTypeId, offer.cloudType, offer.pricePerHourUsd]), [
    ['cheap', 'COMMUNITY', 0.12],
    ['fallback', 'SECURE', 0.19],
  ]);
  assert.equal(offers.find((offer) => offer.gpuTypeId === 'fallback').availableGpuCounts, null);
  const unavailable = offers.find((offer) => (
    offer.gpuTypeId === 'fallback' && offer.cloudType === 'COMMUNITY'
  ));
  assert.equal(Number.isNaN(unavailable.pricePerHourUsd), true);
});

test('numeric max-unreserved capacity is accepted when RunPod omits available GPU counts', () => {
  const offers = normalizeOffers([{
    id: 'numeric-capacity', displayName: 'Numeric capacity', memoryInGb: 16,
    secureCloud: true, communityCloud: false,
    secure: {
      stockStatus: 'Low', uninterruptablePrice: 0.25,
      availableGpuCounts: null, maxUnreservedGpuCount: 2,
    },
  }]);
  const selected = chooseOffers(offers, {
    allowedGpuTypes: ['numeric-capacity'],
    cloudTypes: ['SECURE'],
    maxPricePerHourUsd: 0.5,
  });
  assert.equal(selected.length, 1);
  assert.equal(selected[0].maxUnreservedGpuCount, 2);
});

test('qualitative stock without a live constrained price is never eligible', () => {
  const selected = chooseOffers([{
    ...offer('label-only', 'COMMUNITY', Number.NaN),
    stockStatus: 'High', availableGpuCounts: null, maxUnreservedGpuCount: null,
  }], {
    allowedGpuTypes: ['label-only'],
    cloudTypes: ['COMMUNITY'],
    maxPricePerHourUsd: 0.5,
  });
  assert.deepEqual(selected, []);
});

test('RunPod REST uses bearer auth and delete treats 404 as already cleaned', async () => {
  const calls = [];
  const client = new RunPodClient({
    apiKey: 'unit-test-secret',
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return new Response('', { status: 404 });
    },
  });
  await client.deletePod('pod-123');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://rest.runpod.io/v1/pods/pod-123');
  assert.equal(calls[0].options.headers.Authorization, 'Bearer unit-test-secret');
});

test('ambiguous create failures are marked uncertain and are never automatically retried', async () => {
  let calls = 0;
  const client = new RunPodClient({
    apiKey: 'unit-test-secret',
    fetchImpl: async () => { calls++; throw new Error('socket closed'); },
  });
  await assert.rejects(() => client.createPod({ name: 'unique' }), (error) => error.uncertain === true);
  assert.equal(calls, 1);
});

test('ambiguous ephemeral-template create is marked uncertain and never retried', async () => {
  let calls = 0;
  const client = new RunPodClient({
    apiKey: 'unit-test-secret',
    fetchImpl: async () => { calls++; throw new Error('socket closed'); },
  });
  await assert.rejects(
    () => client.createTemplate({ name: 'elder-souls-ephemeral-unique' }),
    (error) => error.uncertain === true && error.creationOutcome === 'ambiguous',
  );
  assert.equal(calls, 1);
});

test('POST server errors are treated as ambiguous create outcomes', async () => {
  const client = new RunPodClient({
    apiKey: 'unit-test-secret',
    fetchImpl: async () => new Response('{"error":"upstream"}', { status: 503 }),
  });
  await assert.rejects(
    () => client.createPod({ name: 'unique' }),
    (error) => error.status === 503 && error.uncertain === true,
  );
});

test('explicit capacity HTTP 500 is definite non-creation and safely falls back', async () => {
  const requests = [];
  const fetchClient = new RunPodClient({
    apiKey: 'unit-test-secret',
    fetchImpl: async () => new Response(JSON.stringify({
      error: 'create pod: This machine does not have the resources to deploy your pod. Please try a different machine',
      status: 500,
    }), { status: 500 }),
  });
  await assert.rejects(() => fetchClient.createPod({ name: 'unique' }), (error) => (
    error.uncertain === false
    && error.creationOutcome === 'definite-non-creation'
    && error.creationFailureKind === 'capacity'
  ));

  const candidates = [offer('cheap', 'COMMUNITY', 0.12), offer('fallback', 'SECURE', 0.18)];
  const client = {
    async createPod(input) {
      requests.push(input);
      if (requests.length === 1) throw capacityError();
      return podFor('pod-2', 'fallback', 0.18);
    },
    async getPod() { throw new Error('hydration should not be needed'); },
  };
  const result = await provisionPodFixture(client, candidates);
  assert.equal(result.pod.id, 'pod-2');
  assert.deepEqual(requests.map((request) => request.cloudType), ['COMMUNITY', 'SECURE']);
});

test('multiple consecutive capacity failures fall through once per batch to a later success', async () => {
  const candidates = [
    offer('first', 'CLOUD_A', 0.10),
    offer('second', 'CLOUD_B', 0.11),
    offer('third', 'CLOUD_C', 0.12),
  ];
  let creates = 0;
  const client = {
    async createPod() {
      creates++;
      if (creates < 3) throw capacityError();
      return podFor('pod-3', 'third', 0.12);
    },
    async getPod() { throw new Error('hydration should not be needed'); },
  };
  const result = await provisionPodFixture(client, candidates);
  assert.equal(result.offer.gpuTypeId, 'third');
  assert.equal(creates, 3);
});

test('all capacity batches unavailable fails cleanly without orphan recovery', async () => {
  let creates = 0;
  let recoveries = 0;
  await assert.rejects(() => provisionPodFixture({
    async createPod() { creates++; throw capacityError(); },
    async getPod() { throw new Error('hydration should not be needed'); },
  }, [offer('one', 'COMMUNITY', 0.10), offer('two', 'SECURE', 0.11)], {
    recoverPodByName: async () => { recoveries++; return null; },
  }), /all safe eligible cloud\/GPU capacity options were exhausted/);
  assert.equal(creates, 2);
  assert.equal(recoveries, 0);
});

test('ambiguous HTTP 500 performs recovery and never issues a second create', async () => {
  let creates = 0;
  let recoveries = 0;
  const ambiguous = new RunPodError('HTTP 500 unknown', {
    status: 500,
    uncertain: true,
    creationOutcome: 'ambiguous',
    creationFailureKind: 'unknown',
  });
  await assert.rejects(() => provisionPodFixture({
    async createPod() { creates++; throw ambiguous; },
    async getPod() { throw new Error('not reached'); },
  }, [offer('one', 'COMMUNITY', 0.10), offer('two', 'SECURE', 0.11)], {
    recoverPodByName: async () => { recoveries++; return null; },
  }), (error) => error.uncertain === true);
  assert.equal(creates, 1);
  assert.equal(recoveries, 1);
});

test('network timeout after POST takes the fail-closed recovery path', async () => {
  let creates = 0;
  let recoveries = 0;
  const client = new RunPodClient({
    apiKey: 'unit-test-secret',
    requestTimeoutMs: 5,
    fetchImpl: async (_url, { signal }) => new Promise((_resolve, reject) => {
      signal.addEventListener('abort', () => reject(signal.reason), { once: true });
    }),
  });
  const wrapped = {
    async createPod(input) { creates++; return client.createPod(input); },
    async getPod() { throw new Error('not reached'); },
  };
  await assert.rejects(() => provisionPodFixture(wrapped, [offer('one', 'COMMUNITY', 0.10), offer('two', 'SECURE', 0.11)], {
    recoverPodByName: async () => { recoveries++; return null; },
  }), (error) => error.uncertain === true && error.creationFailureKind === 'transport');
  assert.equal(creates, 1);
  assert.equal(recoveries, 1);
});

test('multi-GPU availability batches stay price-capped and allowlisted', async () => {
  const inventory = [
    offer('cheap', 'COMMUNITY', 0.12),
    offer('allowed-fallback', 'COMMUNITY', 0.19),
    offer('too-expensive', 'SECURE', 0.41),
    offer('disallowed', 'SECURE', 0.01),
  ];
  const candidates = chooseOffers(inventory, {
    allowedGpuTypes: ['cheap', 'allowed-fallback', 'too-expensive'],
    cloudTypes: ['COMMUNITY', 'SECURE'],
    maxPricePerHourUsd: 0.20,
  });
  const batches = buildProvisioningBatches(candidates);
  assert.deepEqual(batches.flatMap((batch) => batch.gpuTypeIds), ['cheap', 'allowed-fallback']);
  assert.equal(batches.every((batch) => batch.offers.every((item) => item.pricePerHourUsd <= 0.20)), true);

  let request;
  await provisionPodFixture({
    async createPod(input) { request = input; return podFor('pod-safe', 'allowed-fallback', 0.19); },
    async getPod() { throw new Error('hydration should not be needed'); },
  }, candidates);
  assert.equal(request.gpuTypePriority, 'availability');
  assert.equal(request.gpuCount, 1);
  assert.deepEqual(request.gpuTypeIds, ['cheap', 'allowed-fallback']);
});

test('configured Secure Cloud preference wins over a cheaper Community batch', async () => {
  const candidates = [
    offer('community-cheap', 'COMMUNITY', 0.12),
    offer('secure-reliable', 'SECURE', 0.25),
  ];
  const batches = buildProvisioningBatches(candidates, ['SECURE', 'COMMUNITY']);
  assert.deepEqual(batches.map(({ cloudType }) => cloudType), ['SECURE', 'COMMUNITY']);

  let request;
  const result = await provisionPodFixture({
    async createPod(input) {
      request = input;
      return podFor('pod-secure', 'secure-reliable', 0.25);
    },
    async getPod() { throw new Error('hydration should not be needed'); },
  }, candidates, { cloudPriority: ['SECURE', 'COMMUNITY'] });
  assert.equal(request.cloudType, 'SECURE');
  assert.equal(result.offer.gpuTypeId, 'secure-reliable');
});

test('post-create GPU validation failure preserves the Pod for mandatory cleanup', async () => {
  const created = podFor('pod-needs-cleanup', 'unexpected', 0.10);
  await assert.rejects(() => provisionPodFixture({
    async createPod() { return created; },
    async getPod() { return created; },
  }, [offer('allowed', 'COMMUNITY', 0.10)]), (error) => (
    error.pod?.id === 'pod-needs-cleanup'
    && /did not report one of the explicitly requested GPU types/.test(error.message)
  ));
});

test('successful provision completes SSH, bootstrap, artifact, deletion, and confirmation lifecycle', async (context) => {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'runpod-lifecycle-test-'));
  context.after(() => fs.rmSync(scratch, { recursive: true, force: true }));
  const processCalls = [];
  let createRequest;
  let templateRequest;
  const deleted = new Set();
  const deletedTemplates = new Set();
  const creates = [];
  const createdPods = [
    { ...podFor('pod-unready', 'first', 0.14), name: 'fixture-first', desiredStatus: 'RUNNING', publicIp: '203.0.113.9', portMappings: { 22: 22021 }, volumeInGb: 0 },
    { ...podFor('pod-lifecycle', 'allowed', 0.15), name: 'fixture-pod', desiredStatus: 'RUNNING', publicIp: '203.0.113.10', portMappings: { 22: 22022 }, volumeInGb: 0 },
  ];
  const client = {
    async getTemplate(templateId) {
      if (deletedTemplates.has(templateId)) return null;
      if (templateId === 'runtime-template-test') return { ...templateRequest, id: templateId };
      return { id: 'template-test', name: 'fixture', imageName: 'runpod/base:test', ports: ['22/tcp'], volumeInGb: 0, containerDiskInGb: 30 };
    },
    async createTemplate(input) { templateRequest = input; return { ...input, id: 'runtime-template-test' }; },
    async deleteTemplate(templateId) { deletedTemplates.add(templateId); },
    async listGpuOffers() { return [offer('first', 'COMMUNITY', 0.14), offer('allowed', 'COMMUNITY', 0.15)]; },
    async createPod(input) {
      createRequest = input;
      creates.push(input);
      return createdPods[creates.length - 1];
    },
    async getPod(podId) { return deleted.has(podId) ? null : createdPods.find((pod) => pod.id === podId); },
    async listPods() { return createdPods.filter((pod) => !deleted.has(pod.id)); },
    async deletePod(podId) { deleted.add(podId); },
  };
  const config = {
    podNamePrefix: 'fixture-', maxPricePerHourUsd: 0.2, absoluteMaxPricePerHourUsd: 0.2,
    maxRuntimeMinutes: 5, absoluteMaxRuntimeMinutes: 5, readyTimeoutMinutes: 1,
    containerDiskInGb: 30, minVcpuPerGpu: 4, minRamPerGpu: 16,
    cloudTypes: ['COMMUNITY'], allowedGpuTypes: ['first', 'allowed'], snapshotPaths: ['game'], artifactRoot: scratch,
  };
  await runCommand({
    gpu: [], cloud: [], include: [], onlyPath: [], artifactDir: scratch,
  }, config, {
    environment: { apiKey: 'not-logged', templateId: 'template-test' },
    client,
    commandExists: async () => true,
    makeTempDir: () => scratch,
    removeTempDir: () => {},
    sshKeyMaterial: async () => ({ keyPath: path.join(scratch, 'key'), publicKey: 'ssh-ed25519 fixture', ephemeral: true }),
    createSnapshot: async () => ({ archivePath: path.join(scratch, 'source.tar.gz'), revision: 'abc123', dirty: false, fileCount: 1, bytes: 1, sha256: '00', paths: ['game'] }),
    sshArgs: () => ['ssh-fixture'],
    scpArgs: () => ['scp-fixture'],
    waitForSsh: async () => {
      if (creates.length === 1) throw new Error('fixture SSH readiness timeout');
    },
    runProcess: async (command, args) => {
      processCalls.push([command, ...args]);
      return { code: 0, stdout: '', stderr: '' };
    },
  });
  const state = JSON.parse(fs.readFileSync(path.join(scratch, 'run.json'), 'utf8'));
  assert.equal(state.status, 'passed');
  assert.equal(state.cleanup.terminated, true);
  assert.deepEqual([...deleted].sort(), ['pod-lifecycle', 'pod-unready']);
  assert.equal(creates.length, 2);
  assert.notEqual(creates[0].name, creates[1].name);
  assert.deepEqual(creates[1].gpuTypeIds, ['allowed']);
  assert.equal(createRequest.dockerEntrypoint, undefined);
  assert.equal(createRequest.dockerStartCmd, undefined);
  assert.equal(createRequest.templateId, 'runtime-template-test');
  assert.equal(createRequest.imageName, undefined);
  assert.equal(createRequest.env, undefined);
  assert.deepEqual(templateRequest.dockerEntrypoint, ['bash', '-c']);
  assert.match(templateRequest.dockerStartCmd[0], /exec \/usr\/sbin\/sshd -D -e/);
  assert.equal(templateRequest.env.SSH_PUBLIC_KEY, 'ssh-ed25519 fixture');
  assert.equal(templateRequest.env.PUBLIC_KEY, 'ssh-ed25519 fixture');
  assert.deepEqual(templateRequest.ports, ['22/tcp']);
  assert.equal(templateRequest.isPublic, false);
  assert.equal(templateRequest.volumeInGb, 0);
  assert.equal(processCalls.some(([command]) => command === 'ssh'), true);
  assert.equal(processCalls.some(([command]) => command === 'scp'), true);
  assert.match(fs.readFileSync(path.join(scratch, 'lifecycle.log'), 'utf8'), /deletion confirmed/i);
  assert.match(fs.readFileSync(path.join(scratch, 'lifecycle.log'), 'utf8'), /private per-run template/i);
  assert.deepEqual([...deletedTemplates], ['runtime-template-test']);
  assert.equal(state.templateCleanup.deleted, true);
  assert.equal(state.provisioning.readinessFailures[0].podId, 'pod-unready');
  assert.deepEqual(state.provisioning.attempts.map(({ outcome }) => outcome), ['created', 'created']);
});

test('ambiguous template response is recovered once and the recovered template is deleted', async (context) => {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'runpod-template-recovery-test-'));
  context.after(() => fs.rmSync(scratch, { recursive: true, force: true }));
  let templateCreates = 0;
  let recoveredTemplate;
  let templateDeleted = false;
  const client = {
    async getTemplate(templateId) {
      if (templateId === 'template-test') {
        return { id: templateId, name: 'fixture', imageName: 'runpod/base:test', volumeInGb: 0, containerDiskInGb: 30 };
      }
      return templateDeleted ? null : recoveredTemplate;
    },
    async createTemplate(input) {
      templateCreates++;
      recoveredTemplate = { ...input, id: 'runtime-template-recovered' };
      throw new RunPodError('template response lost', {
        uncertain: true,
        creationOutcome: 'ambiguous',
        creationFailureKind: 'transport',
      });
    },
    async listTemplates() { return templateDeleted ? [] : [recoveredTemplate]; },
    async deleteTemplate() { templateDeleted = true; },
    async listGpuOffers() { return [offer('allowed', 'COMMUNITY', 0.15)]; },
    async createPod() { throw capacityError(); },
  };
  const config = {
    podNamePrefix: 'fixture-', maxPricePerHourUsd: 0.2, absoluteMaxPricePerHourUsd: 0.2,
    maxRuntimeMinutes: 5, absoluteMaxRuntimeMinutes: 5, readyTimeoutMinutes: 1,
    containerDiskInGb: 30, minVcpuPerGpu: 4, minRamPerGpu: 16,
    cloudTypes: ['COMMUNITY'], allowedGpuTypes: ['allowed'], snapshotPaths: ['game'], artifactRoot: scratch,
  };
  await assert.rejects(() => runCommand({
    gpu: [], cloud: [], include: [], onlyPath: [], artifactDir: scratch,
  }, config, {
    environment: { apiKey: 'not-logged', templateId: 'template-test' },
    client,
    commandExists: async () => true,
    makeTempDir: () => scratch,
    removeTempDir: () => {},
    sshKeyMaterial: async () => ({ keyPath: path.join(scratch, 'key'), publicKey: 'ssh-ed25519 fixture', ephemeral: true }),
    createSnapshot: async () => ({ archivePath: path.join(scratch, 'source.tar.gz'), revision: 'abc123', dirty: false, fileCount: 1, bytes: 1, sha256: '00', paths: ['game'] }),
  }), /all safe eligible cloud\/GPU capacity options were exhausted/);
  const state = JSON.parse(fs.readFileSync(path.join(scratch, 'run.json'), 'utf8'));
  assert.equal(templateCreates, 1);
  assert.equal(state.runtimeTemplate.id, 'runtime-template-recovered');
  assert.equal(state.templateCleanup.deleted, true);
  assert.equal(templateDeleted, true);
});

test('orphan cleanup scope cannot select manual, foreign-template, or terminated Pods', () => {
  const policy = {
    podNamePrefix: 'elder-souls-gpu-',
    templateId: 'template-a',
    runtimeTemplateIds: ['runtime-template-a'],
    imageName: 'runpod/base:test',
  };
  assert.equal(isManagedPod({ id: 'a', name: 'elder-souls-gpu-run', templateId: 'template-a', desiredStatus: 'RUNNING' }, policy), true);
  assert.equal(isManagedPod({ id: 'b', name: 'manual-pod', templateId: 'template-a', desiredStatus: 'RUNNING' }, policy), false);
  assert.equal(isManagedPod({ id: 'c', name: 'elder-souls-gpu-run', templateId: 'template-b', desiredStatus: 'RUNNING' }, policy), false);
  assert.equal(isManagedPod({ id: 'd', name: 'elder-souls-gpu-old', templateId: 'template-a', desiredStatus: 'TERMINATED' }, policy), false);
  assert.equal(isManagedPod({ id: 'e', name: 'elder-souls-gpu-run', templateId: 'runtime-template-a', desiredStatus: 'RUNNING' }, policy), true);
  assert.equal(isManagedPod({ id: 'f', name: 'elder-souls-gpu-run', templateId: null, imageName: 'runpod/base:test', desiredStatus: 'RUNNING' }, policy), true);
  assert.equal(isManagedPod({ id: 'g', name: 'elder-souls-gpu-run', templateId: null, image: 'foreign/image', desiredStatus: 'RUNNING' }, policy), false);
  assert.equal(isManagedPod({ id: 'a', name: 'elder-souls-gpu-run', templateId: 'template-a', desiredStatus: 'RUNNING' }, { ...policy, podId: 'other' }), false);
});

test('orphan cleanup only recognizes private runtime templates with the owned prefix and image', () => {
  const policy = { templateNamePrefix: 'elder-souls-ephemeral-', imageName: 'runpod/base:test' };
  assert.equal(isManagedRuntimeTemplate({ name: 'elder-souls-ephemeral-run', imageName: 'runpod/base:test', isPublic: false }, policy), true);
  assert.equal(isManagedRuntimeTemplate({ name: 'manual-template', imageName: 'runpod/base:test', isPublic: false }, policy), false);
  assert.equal(isManagedRuntimeTemplate({ name: 'elder-souls-ephemeral-run', imageName: 'foreign/image', isPublic: false }, policy), false);
  assert.equal(isManagedRuntimeTemplate({ name: 'elder-souls-ephemeral-run', imageName: 'runpod/base:test', isPublic: true }, policy), false);
});

test('worktree snapshot contains exact dirty tracked and untracked bytes', async (context) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'runpod-snapshot-test-'));
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'runpod-snapshot-output-'));
  context.after(() => { fs.rmSync(root, { recursive: true, force: true }); fs.rmSync(scratch, { recursive: true, force: true }); });
  await runProcess('git', ['init', '-q'], { cwd: root });
  await runProcess('git', ['config', 'user.email', 'test@example.invalid'], { cwd: root });
  await runProcess('git', ['config', 'user.name', 'RunPod test'], { cwd: root });
  fs.mkdirSync(path.join(root, 'game'));
  fs.writeFileSync(path.join(root, 'game', 'tracked.txt'), 'before\n');
  fs.writeFileSync(path.join(root, 'game', 'deleted.txt'), 'delete me\n');
  await runProcess('git', ['add', 'game/tracked.txt', 'game/deleted.txt'], { cwd: root });
  await runProcess('git', ['commit', '-qm', 'fixture'], { cwd: root });
  fs.writeFileSync(path.join(root, 'game', 'tracked.txt'), 'after\n');
  fs.unlinkSync(path.join(root, 'game', 'deleted.txt'));
  fs.writeFileSync(path.join(root, 'game', 'untracked.txt'), 'new\n');
  // --worktree is now the OPT-IN, so this test says so explicitly. It used to pass no flag at
  // all, because carrying the working tree used to be the default — which is the defect
  // HAZARDS.md §15a describes.
  const snapshot = await createSnapshot({ repoRoot: root, paths: ['game'], tempDir: scratch, worktree: true });
  assert.equal(snapshot.dirty, true);
  assert.equal(snapshot.worktree, true);
  assert.equal(snapshot.fileCount, 2);
  const extract = path.join(scratch, 'extract');
  fs.mkdirSync(extract);
  await runProcess('tar', ['-xzf', snapshot.archivePath, '-C', extract]);
  assert.equal(fs.readFileSync(path.join(extract, 'game', 'tracked.txt'), 'utf8'), 'after\n');
  assert.equal(fs.readFileSync(path.join(extract, 'game', 'untracked.txt'), 'utf8'), 'new\n');
  assert.equal(fs.existsSync(path.join(extract, 'game', 'deleted.txt')), false);
});

// THE ARM THAT PROVES §15a IS ACTUALLY FIXED, and it is the same fixture as the test above with
// the flag removed. Both arms must disagree: with --worktree the sibling's uncommitted edit is in
// the tar, without it the tar carries the committed bytes and the run is reproducible from a sha.
// A test that only asserted the new behaviour would not show that the old one was ever possible.
test('default snapshot pins the committed revision and leaves a sibling\'s uncommitted edits out (HAZARDS 15a)', async (context) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'runpod-snapshot-pin-'));
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'runpod-snapshot-pin-out-'));
  context.after(() => { fs.rmSync(root, { recursive: true, force: true }); fs.rmSync(scratch, { recursive: true, force: true }); });
  await runProcess('git', ['init', '-q'], { cwd: root });
  await runProcess('git', ['config', 'user.email', 'test@example.invalid'], { cwd: root });
  await runProcess('git', ['config', 'user.name', 'RunPod test'], { cwd: root });
  fs.mkdirSync(path.join(root, 'game'));
  fs.writeFileSync(path.join(root, 'game', 'icons.js'), 'export const ICONS = 1;\n');
  await runProcess('git', ['add', 'game/icons.js'], { cwd: root });
  await runProcess('git', ['commit', '-qm', 'fixture'], { cwd: root });

  // A neighbour is mid-edit on the shared tree — exactly what killed both arms of a paid run.
  fs.writeFileSync(path.join(root, 'game', 'icons.js'), 'export const ICONS = SYNTAX ERROR\n');
  fs.writeFileSync(path.join(root, 'game', 'scratch-note.txt'), 'a sibling was here\n');

  const pinned = await createSnapshot({ repoRoot: root, paths: ['game'], tempDir: scratch });
  assert.equal(pinned.worktree, false);
  assert.ok(pinned.excludedDirtyPaths.includes('game/icons.js'), 'the mid-edit must be NAMED as excluded, not silently dropped');
  assert.ok(pinned.excludedDirtyPaths.includes('game/scratch-note.txt'));
  const extract = path.join(scratch, 'pinned');
  fs.mkdirSync(extract);
  await runProcess('tar', ['-xzf', pinned.archivePath, '-C', extract]);
  assert.equal(fs.readFileSync(path.join(extract, 'game', 'icons.js'), 'utf8'), 'export const ICONS = 1;\n',
    'the paid run must execute the COMMITTED bytes, not the neighbour\'s broken mid-edit');
  assert.equal(fs.existsSync(path.join(extract, 'game', 'scratch-note.txt')), false);

  // The other arm, same fixture: with --worktree the contamination is present. If this arm did
  // not go the other way, the test above would be proving nothing.
  const scratch2 = path.join(scratch, 'wt');
  fs.mkdirSync(scratch2);
  const dirtySnap = await createSnapshot({ repoRoot: root, paths: ['game'], tempDir: scratch2, worktree: true });
  const extract2 = path.join(scratch, 'wt-extract');
  fs.mkdirSync(extract2);
  await runProcess('tar', ['-xzf', dirtySnap.archivePath, '-C', extract2]);
  assert.equal(fs.readFileSync(path.join(extract2, 'game', 'icons.js'), 'utf8'), 'export const ICONS = SYNTAX ERROR\n');
  assert.equal(fs.existsSync(path.join(extract2, 'game', 'scratch-note.txt')), true);
});

test('ephemeral SSH key is generated with private permissions', async (context) => {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'runpod-key-test-'));
  context.after(() => fs.rmSync(scratch, { recursive: true, force: true }));
  const material = await makeEphemeralSshKey(scratch);
  assert.match(material.publicKey, /^ssh-ed25519 /);
  assert.equal(fs.statSync(material.keyPath).mode & 0o777, 0o600);
  assert.equal(material.ephemeral, true);
});
