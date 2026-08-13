import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { RunPodClient, chooseOffers, isManagedPod, normalizeOffers } from '../lib/api.mjs';
import { createSnapshot, makeEphemeralSshKey, runProcess } from '../lib/local.mjs';

test('offer normalization and selection enforce allowlist, capacity, cloud, and ceiling', () => {
  const offers = normalizeOffers([
    {
      id: 'cheap', displayName: 'Cheap', memoryInGb: 8, secureCloud: true, communityCloud: true,
      secure: { stockStatus: 'High', uninterruptablePrice: 0.25, availableGpuCounts: [1] },
      community: { stockStatus: 'Low', uninterruptablePrice: 0.12, availableGpuCounts: [1, 2] },
    },
    {
      id: 'fallback', displayName: 'Fallback', memoryInGb: 16, secureCloud: true, communityCloud: false,
      secure: { stockStatus: 'Medium', uninterruptablePrice: 0.19, availableGpuCounts: [1] },
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
});

test('RunPod REST uses bearer auth and delete treats 404 as already cleaned', async () => {
  const calls = [];
  const client = new RunPodClient({
    apiKey: 'rpa_test_secret',
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return new Response('', { status: 404 });
    },
  });
  await client.deletePod('pod-123');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://rest.runpod.io/v1/pods/pod-123');
  assert.equal(calls[0].options.headers.Authorization, 'Bearer rpa_test_secret');
});

test('ambiguous create failures are marked uncertain and are never automatically retried', async () => {
  let calls = 0;
  const client = new RunPodClient({
    apiKey: 'rpa_test_secret',
    fetchImpl: async () => { calls++; throw new Error('socket closed'); },
  });
  await assert.rejects(() => client.createPod({ name: 'unique' }), (error) => error.uncertain === true);
  assert.equal(calls, 1);
});

test('orphan cleanup scope cannot select manual, foreign-template, or terminated Pods', () => {
  const policy = { podNamePrefix: 'elder-souls-gpu-', templateId: 'template-a' };
  assert.equal(isManagedPod({ id: 'a', name: 'elder-souls-gpu-run', templateId: 'template-a', desiredStatus: 'RUNNING' }, policy), true);
  assert.equal(isManagedPod({ id: 'b', name: 'manual-pod', templateId: 'template-a', desiredStatus: 'RUNNING' }, policy), false);
  assert.equal(isManagedPod({ id: 'c', name: 'elder-souls-gpu-run', templateId: 'template-b', desiredStatus: 'RUNNING' }, policy), false);
  assert.equal(isManagedPod({ id: 'd', name: 'elder-souls-gpu-old', templateId: 'template-a', desiredStatus: 'TERMINATED' }, policy), false);
  assert.equal(isManagedPod({ id: 'a', name: 'elder-souls-gpu-run', templateId: 'template-a', desiredStatus: 'RUNNING' }, { ...policy, podId: 'other' }), false);
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
  const snapshot = await createSnapshot({ repoRoot: root, paths: ['game'], tempDir: scratch });
  assert.equal(snapshot.dirty, true);
  assert.equal(snapshot.fileCount, 2);
  const extract = path.join(scratch, 'extract');
  fs.mkdirSync(extract);
  await runProcess('tar', ['-xzf', snapshot.archivePath, '-C', extract]);
  assert.equal(fs.readFileSync(path.join(extract, 'game', 'tracked.txt'), 'utf8'), 'after\n');
  assert.equal(fs.readFileSync(path.join(extract, 'game', 'untracked.txt'), 'utf8'), 'new\n');
  assert.equal(fs.existsSync(path.join(extract, 'game', 'deleted.txt')), false);
});

test('ephemeral SSH key is generated with private permissions', async (context) => {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'runpod-key-test-'));
  context.after(() => fs.rmSync(scratch, { recursive: true, force: true }));
  const material = await makeEphemeralSshKey(scratch);
  assert.match(material.publicKey, /^ssh-ed25519 /);
  assert.equal(fs.statSync(material.keyPath).mode & 0o777, 0o600);
  assert.equal(material.ephemeral, true);
});
