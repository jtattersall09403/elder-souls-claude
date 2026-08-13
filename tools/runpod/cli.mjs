#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { RunPodClient, RunPodError, chooseOffers, isManagedPod } from './lib/api.mjs';
import { provisionPod } from './lib/provision.mjs';
import {
  commandExists,
  createSnapshot,
  makeTempDir,
  removeTempDir,
  runProcess,
  scpArgs,
  sshArgs,
  sshKeyMaterial,
} from './lib/local.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '../..');
const CONFIG_PATH = path.join(HERE, 'config.json');
const HELP = `
Safe, temporary RunPod GPU browser test runner.

USAGE
  npm run gpu:list
  npm run gpu:doctor
  npm run gpu:test -- [options]
  npm run gpu:cleanup -- [--dry-run] [--pod <id>]

RUN OPTIONS
  --command <shell>       Command in the worker (default: GPU/game smoke test)
  --max-price <USD/hr>   Price ceiling, capped by config (default: 1.00)
  --max-runtime <min>    Whole lifecycle deadline, capped by config (default: 20)
  --gpu <RunPod GPU ID>  Restrict to an allowed type; repeat for fallbacks
  --cloud <type>         all, community, or secure (default: all)
  --revision <rev>       Archive this committed revision instead of the worktree
  --include <path>       Add a repo-relative path to the default snapshot; repeatable
  --only-path <path>     Replace default snapshot paths; repeatable
  --artifact-dir <path>  Local run directory (default: reports/runpod-gpu/runs/<run-id>)
  --ssh-key <path>       Private key (default: inject a per-run ephemeral key)

The run command requires RUNPOD_API_KEY and RUNPOD_GPU_TEMPLATE_ID. It always requests
one on-demand GPU, no persistent volume, a public SSH port, and deletes the Pod in a
finally path. SIGINT/SIGTERM and the runtime watchdog also enter that cleanup path.
`;

function parseArgs(argv) {
  const parsed = { _: [], include: [], onlyPath: [], gpu: [], cloud: [] };
  const multi = new Set(['include', 'only-path', 'gpu', 'cloud']);
  for (let index = 0; index < argv.length; index++) {
    const token = argv[index];
    if (!token.startsWith('--')) { parsed._.push(token); continue; }
    const equal = token.indexOf('=');
    const key = token.slice(2, equal < 0 ? undefined : equal);
    const normalized = key.replace(/-([a-z])/g, (_, char) => char.toUpperCase());
    if (['help', 'dry-run'].includes(key)) { parsed[normalized] = true; continue; }
    const value = equal >= 0 ? token.slice(equal + 1) : argv[++index];
    if (value === undefined || value.startsWith('--')) throw new Error(`--${key} requires a value`);
    if (multi.has(key)) parsed[normalized].push(value);
    else parsed[normalized] = value;
  }
  return parsed;
}

function loadConfig() {
  const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  if (config.schema !== 'elder-souls/runpod-config@1') throw new Error(`unsupported config schema in ${CONFIG_PATH}`);
  return config;
}

function numberOption(value, fallback, label) {
  const number = value === undefined ? fallback : Number(value);
  if (!Number.isFinite(number) || number <= 0) throw new Error(`${label} must be a positive number`);
  return number;
}

function runId() {
  return `${new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z').replace('T', '-')}-${process.pid}`;
}

function safeMkdir(directory) {
  fs.mkdirSync(directory, { recursive: true });
}

function writeJson(file, value) {
  safeMkdir(path.dirname(file));
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function makeLogger(logPath) {
  safeMkdir(path.dirname(logPath));
  return (message, stream = 'info') => {
    const lines = String(message).split('\n');
    for (const line of lines) {
      if (!line) continue;
      const rendered = `${new Date().toISOString()} [${stream}] ${line}`;
      fs.appendFileSync(logPath, `${rendered}\n`);
      (stream === 'stderr' ? process.stderr : process.stdout).write(`${rendered}\n`);
    }
  };
}

function requireEnvironment() {
  const apiKey = process.env.RUNPOD_API_KEY;
  const templateId = process.env.RUNPOD_GPU_TEMPLATE_ID;
  if (!apiKey) throw new Error('RUNPOD_API_KEY is not set');
  if (!templateId) throw new Error('RUNPOD_GPU_TEMPLATE_ID is not set');
  return { apiKey, templateId };
}

function resolveClouds(values, config) {
  if (!values.length || values.includes('all')) return config.cloudTypes;
  const clouds = values.map((value) => String(value).toUpperCase());
  for (const cloud of clouds) if (!config.cloudTypes.includes(cloud)) throw new Error(`cloud must be one of: all, community, secure`);
  return [...new Set(clouds)];
}

function resolveGpus(values, config) {
  if (!values.length) return config.allowedGpuTypes;
  for (const gpu of values) {
    if (!config.allowedGpuTypes.includes(gpu)) {
      throw new Error(`GPU is not allowed by tools/runpod/config.json: ${gpu}`);
    }
  }
  return [...new Set(values)];
}

function compactOffer(offer) {
  return {
    gpuTypeId: offer.gpuTypeId,
    displayName: offer.displayName,
    cloudType: offer.cloudType,
    memoryInGb: offer.memoryInGb,
    stockStatus: offer.stockStatus,
    pricePerHourUsd: offer.pricePerHourUsd,
    availableGpuCounts: offer.availableGpuCounts,
    maxUnreservedGpuCount: offer.maxUnreservedGpuCount,
  };
}

async function listCommand(args, config) {
  const { apiKey } = requireEnvironment();
  const client = new RunPodClient({ apiKey });
  const maxPrice = numberOption(args.maxPrice, config.maxPricePerHourUsd, '--max-price');
  if (maxPrice > config.absoluteMaxPricePerHourUsd) throw new Error(`--max-price exceeds hard cap $${config.absoluteMaxPricePerHourUsd}/hr`);
  const allowed = resolveGpus(args.gpu, config);
  const clouds = resolveClouds(args.cloud, config);
  const offers = await client.listGpuOffers({
    minVcpuPerGpu: config.minVcpuPerGpu,
    minRamPerGpu: config.minRamPerGpu,
    minDiskInGb: config.containerDiskInGb,
  });
  const rows = offers.filter((offer) => allowed.includes(offer.gpuTypeId) && clouds.includes(offer.cloudType))
    .sort((left, right) => (Number.isFinite(left.pricePerHourUsd) ? left.pricePerHourUsd : Infinity) - (Number.isFinite(right.pricePerHourUsd) ? right.pricePerHourUsd : Infinity));
  console.table(rows.map((offer) => ({
    GPU: offer.displayName || offer.gpuTypeId,
    ID: offer.gpuTypeId,
    cloud: offer.cloudType,
    VRAM_GB: offer.memoryInGb,
    USD_hr: Number.isFinite(offer.pricePerHourUsd) ? offer.pricePerHourUsd.toFixed(3) : 'n/a',
    stock: offer.stockStatus,
    one_GPU: offer.availableGpuCounts?.includes(1) || offer.maxUnreservedGpuCount >= 1
      ? 'counted'
      : (Number.isFinite(offer.pricePerHourUsd) && offer.stockStatus !== 'None' ? 'priced' : 'no'),
    eligible: chooseOffers([offer], { allowedGpuTypes: allowed, cloudTypes: clouds, maxPricePerHourUsd: maxPrice }).length ? 'yes' : 'no',
  })));
}

async function doctorCommand(args, config) {
  const { apiKey, templateId } = requireEnvironment();
  const client = new RunPodClient({ apiKey });
  const checks = [];
  for (const command of ['git', 'tar', 'ssh', 'scp']) {
    checks.push({ check: `local command: ${command}`, ok: await commandExists(command) });
  }
  checks.push({ check: 'local command: ssh-keygen', ok: await commandExists('ssh-keygen'), detail: 'used for a per-run ephemeral key' });
  try {
    const template = await client.getTemplate(templateId);
    checks.push({ check: 'RunPod API authentication', ok: true });
    checks.push({ check: 'configured template exists', ok: template?.id === templateId, detail: template?.name });
    checks.push({ check: 'template is not marked serverless', ok: template?.isServerless !== true, detail: `isServerless=${template?.isServerless ?? 'omitted'}` });
    checks.push({ check: 'template exposes SSH', ok: template?.ports?.includes('22/tcp'), detail: (template?.ports || []).join(', ') });
    checks.push({ check: 'template has no persistent volume', ok: Number(template?.volumeInGb || 0) === 0, detail: `${template?.volumeInGb || 0} GB` });
    checks.push({ check: 'container disk is at least configured size', ok: Number(template?.containerDiskInGb || 0) >= config.containerDiskInGb, detail: `${template?.containerDiskInGb} GB` });
    checks.push({ check: 'template image recorded (Ubuntu 24.04 is an operator contract)', ok: Boolean(template?.imageName), detail: template?.imageName });
  } catch (error) {
    checks.push({ check: 'RunPod API authentication/template lookup', ok: false, detail: error.message });
  }
  console.table(checks);
  if (checks.some((check) => !check.ok)) process.exitCode = 2;
}

async function cleanupCommand(args, config) {
  const { apiKey, templateId } = requireEnvironment();
  const client = new RunPodClient({ apiKey });
  const pods = await client.listPods();
  const matches = (pods || []).filter((pod) => isManagedPod(pod, {
    podNamePrefix: config.podNamePrefix,
    templateId,
    podId: args.pod,
  }));
  if (!matches.length) {
    console.log('No tool-managed orphaned Pods found.');
    return;
  }
  for (const pod of matches) {
    console.log(`${args.dryRun ? 'would terminate' : 'terminating'} ${pod.id} ${pod.name} ${pod.gpu?.displayName || ''} $${pod.costPerHr || '?'}/hr`);
    if (!args.dryRun) await client.deletePod(pod.id);
  }
}

async function waitForReady(client, podId, deadline, log, signal) {
  let prior = '';
  while (Date.now() < deadline) {
    if (signal.aborted) throw signal.reason || new Error('run cancelled');
    const pod = await client.getPod(podId);
    if (!pod) throw new Error(`Pod ${podId} disappeared while starting`);
    const state = `${pod.desiredStatus}|${pod.lastStatusChange || ''}|${pod.publicIp || ''}|${pod.portMappings?.['22'] || ''}`;
    if (state !== prior) {
      log(`Pod ${podId} state=${pod.desiredStatus} detail=${pod.lastStatusChange || 'starting'} publicIp=${pod.publicIp || 'pending'} sshPort=${pod.portMappings?.['22'] || 'pending'}`);
      prior = state;
    }
    if (pod.desiredStatus === 'EXITED' || pod.desiredStatus === 'TERMINATED') throw new Error(`Pod entered ${pod.desiredStatus} before becoming ready`);
    if (pod.desiredStatus === 'RUNNING' && pod.publicIp && pod.portMappings?.['22']) return pod;
    await new Promise((resolve) => setTimeout(resolve, 5_000));
  }
  throw new Error(`Pod ${podId} did not expose SSH before the readiness deadline`);
}

async function waitForSsh(connection, deadline, log, signal, {
  runProcessImpl = runProcess,
  sshArgsImpl = sshArgs,
} = {}) {
  let attempt = 0;
  while (Date.now() < deadline) {
    if (signal.aborted) throw signal.reason || new Error('run cancelled');
    attempt++;
    const result = await runProcessImpl('ssh', [...sshArgsImpl(connection), 'true'], { allowFailure: true, signal });
    if (result.code === 0) {
      log(`SSH ready after ${attempt} attempt(s)`);
      return;
    }
    if (attempt === 1 || attempt % 3 === 0) log(`SSH not ready (attempt ${attempt}): ${result.stderr.trim().split('\n').at(-1) || `exit ${result.code}`}`);
    await new Promise((resolve) => setTimeout(resolve, 5_000));
  }
  throw new Error('Pod API was ready but SSH never became reachable; verify the template starts sshd and exposes 22/tcp');
}

async function recoverPodByName(client, podName, log, attempts = 5) {
  for (let attempt = 1; attempt <= attempts; attempt++) {
    const pods = await client.listPods().catch((lookupError) => {
      log(`Pod recovery lookup ${attempt}/${attempts} failed: ${lookupError.message}`, 'stderr');
      return [];
    });
    const recovered = pods.find((item) => item.name === podName);
    if (recovered) return recovered;
    if (attempt < attempts) await new Promise((resolve) => setTimeout(resolve, 2_000));
  }
  return null;
}

async function confirmPodDeleted(client, podId, log, attempts = 5) {
  for (let attempt = 1; attempt <= attempts; attempt++) {
    const found = await client.getPod(podId);
    if (!found) {
      log(`Deletion confirmed: subsequent API lookup for Pod ${podId} returned not found`);
      return true;
    }
    if (attempt < attempts) await new Promise((resolve) => setTimeout(resolve, 2_000));
  }
  return false;
}

function sourcePaths(args, config) {
  const selected = args.onlyPath.length ? args.onlyPath : [...config.snapshotPaths, ...args.include];
  for (const value of selected) {
    if (path.isAbsolute(value) || value.split(/[\\/]/).includes('..')) throw new Error(`snapshot path must stay inside the repository: ${value}`);
  }
  return [...new Set(selected)];
}

export async function runCommand(args, config, dependencies = {}) {
  const environment = dependencies.environment || requireEnvironment();
  const { apiKey, templateId } = environment;
  const commandExistsImpl = dependencies.commandExists || commandExists;
  const createSnapshotImpl = dependencies.createSnapshot || createSnapshot;
  const makeTempDirImpl = dependencies.makeTempDir || makeTempDir;
  const removeTempDirImpl = dependencies.removeTempDir || removeTempDir;
  const runProcessImpl = dependencies.runProcess || runProcess;
  const scpArgsImpl = dependencies.scpArgs || scpArgs;
  const sshArgsImpl = dependencies.sshArgs || sshArgs;
  const sshKeyMaterialImpl = dependencies.sshKeyMaterial || sshKeyMaterial;
  const waitForReadyImpl = dependencies.waitForReady || waitForReady;
  const waitForSshImpl = dependencies.waitForSsh || waitForSsh;
  const maxPrice = numberOption(args.maxPrice, config.maxPricePerHourUsd, '--max-price');
  const maxRuntime = numberOption(args.maxRuntime, config.maxRuntimeMinutes, '--max-runtime');
  if (maxPrice > config.absoluteMaxPricePerHourUsd) throw new Error(`--max-price exceeds hard cap $${config.absoluteMaxPricePerHourUsd}/hr`);
  if (maxRuntime > config.absoluteMaxRuntimeMinutes) throw new Error(`--max-runtime exceeds hard cap ${config.absoluteMaxRuntimeMinutes} minutes`);
  const allowedGpus = resolveGpus(args.gpu, config);
  const clouds = resolveClouds(args.cloud, config);
  for (const command of ['git', 'tar', 'ssh', 'scp', 'ssh-keygen']) if (!await commandExistsImpl(command)) throw new Error(`required local command not found: ${command}`);

  const id = runId();
  const outputDir = path.resolve(REPO_ROOT, args.artifactDir || path.join(config.artifactRoot, id));
  safeMkdir(outputDir);
  const log = makeLogger(path.join(outputDir, 'lifecycle.log'));
  const statePath = path.join(outputDir, 'run.json');
  const startedAt = new Date();
  const deadline = startedAt.getTime() + maxRuntime * 60_000;
  const abortController = new AbortController();
  let caughtSignal = null;
  let pod = null;
  let connection = null;
  let commandResult = null;
  let artifactsRetrieved = false;
  let error = null;
  let cleanup = { attempted: false, terminated: false };
  let podName = null;
  let provisionWasUncertain = false;
  const tempDir = makeTempDirImpl();
  const keyMaterial = await sshKeyMaterialImpl(args.sshKey, tempDir);
  const sshKey = keyMaterial.keyPath;
  const client = dependencies.client || new RunPodClient({ apiKey });
  const state = {
    schema: 'elder-souls/runpod-run@1',
    runId: id,
    status: 'initializing',
    startedAt: startedAt.toISOString(),
    finishedAt: null,
    limits: { maxPricePerHourUsd: maxPrice, maxRuntimeMinutes: maxRuntime, allowedGpuTypes: allowedGpus, cloudTypes: clouds },
    templateId,
    source: null,
    provisioning: { strategy: null, candidates: [], attempts: [], readinessFailures: [] },
    selectedOffer: null,
    pod: null,
    command: args.command || 'node tools/runpod/worker/smoke.mjs',
    commandExitCode: null,
    artifactDir: outputDir,
    cleanup,
    error: null,
  };
  const save = () => writeJson(statePath, state);
  const retrieveArtifacts = async () => {
    if (!connection || artifactsRetrieved) return false;
    safeMkdir(path.join(outputDir, 'artifacts'));
    const remoteArtifacts = `/workspace/elder-souls-artifacts-${id}`;
    const transferController = new AbortController();
    const transferBudgetMs = Math.max(5_000, Math.min(120_000, deadline - Date.now()));
    const transferTimer = setTimeout(() => transferController.abort(new Error('artifact retrieval deadline reached')), transferBudgetMs);
    const retrieved = await runProcessImpl('scp', [
      ...scpArgsImpl(connection),
      '-r',
      `root@${connection.host}:${remoteArtifacts}/.`,
      path.join(outputDir, 'artifacts'),
    ], { allowFailure: true, capture: false, signal: transferController.signal, log }).finally(() => clearTimeout(transferTimer));
    artifactsRetrieved = retrieved.code === 0;
    if (artifactsRetrieved) log(`Artifacts retrieved to ${path.join(outputDir, 'artifacts')}`);
    else log(`Best-effort artifact retrieval failed with scp exit ${retrieved.code}`, 'stderr');
    return artifactsRetrieved;
  };
  const cancel = (name) => {
    if (caughtSignal) {
      log(`Second ${name}; cleanup may require npm run gpu:cleanup`, 'stderr');
      process.exit(128 + (name === 'SIGINT' ? 2 : 15));
    }
    caughtSignal = name;
    log(`${name} received; cancelling work and entering Pod cleanup`, 'stderr');
    abortController.abort(new Error(name));
  };
  const onSigint = () => cancel('SIGINT');
  const onSigterm = () => cancel('SIGTERM');
  process.on('SIGINT', onSigint);
  process.on('SIGTERM', onSigterm);
  const watchdog = setTimeout(() => {
    log(`Maximum runtime ${maxRuntime} minutes reached; cancelling and entering Pod cleanup`, 'stderr');
    abortController.abort(new Error(`maximum runtime ${maxRuntime} minutes reached`));
  }, maxRuntime * 60_000);

  save();
  log(`Run ${id}: hard limits $${maxPrice.toFixed(3)}/hr, ${maxRuntime} minutes, 1 GPU, no persistent volume`);
  log(`SSH identity: ${keyMaterial.ephemeral ? 'per-run ephemeral key (injected as SSH_PUBLIC_KEY/PUBLIC_KEY)' : sshKey}`);
  try {
    const template = await client.getTemplate(templateId);
    if (template?.id !== templateId) throw new Error(`template lookup did not return configured template ${templateId}`);
    if (template?.isServerless === true) throw new Error(`RUNPOD_GPU_TEMPLATE_ID ${templateId} is a Serverless template, not a Pod template`);
    if (!template?.imageName) throw new Error(`template ${templateId} does not declare a container image`);
    if (!(template?.ports || []).includes('22/tcp')) throw new Error(`template ${templateId} does not expose 22/tcp; SSH transfer cannot be made safe`);
    if (Number(template?.volumeInGb || 0) !== 0) log(`Template declares ${template.volumeInGb} GB volume; run request overrides it to 0 GB`);
    log(`Template ${template.id}: ${template.name} (${template.imageName}), container disk=${template.containerDiskInGb} GB, volume=0 GB`);

    state.status = 'snapshotting';
    save();
    const snapshot = await createSnapshotImpl({ repoRoot: REPO_ROOT, revision: args.revision, paths: sourcePaths(args, config), tempDir, log });
    state.source = { ...snapshot };
    delete state.source.archivePath;
    save();
    log(`Snapshot ${snapshot.revision}${snapshot.dirty ? ' + worktree changes' : ''}: ${snapshot.fileCount} files, ${(snapshot.bytes / 1048576).toFixed(1)} MiB, sha256=${snapshot.sha256}`);

    state.status = 'selecting';
    save();
    const allOffers = await client.listGpuOffers({
      minVcpuPerGpu: config.minVcpuPerGpu,
      minRamPerGpu: config.minRamPerGpu,
      minDiskInGb: config.containerDiskInGb,
    });
    const candidates = chooseOffers(allOffers, { allowedGpuTypes: allowedGpus, cloudTypes: clouds, maxPricePerHourUsd: maxPrice });
    if (!candidates.length) throw new Error(`no allowed one-GPU offers have capacity at or below $${maxPrice.toFixed(3)}/hr`);
    state.provisioning.strategy = 'GraphQL podFindAndDeployOnDemand with startSsh=true, one explicit GPU/cloud candidate at a time';
    state.provisioning.candidates = candidates.map(compactOffer);
    save();
    log(`Eligible live one-GPU candidates: ${candidates.map((offer) => `${offer.displayName}/${offer.cloudType} $${offer.pricePerHourUsd.toFixed(3)}/hr counts=${offer.availableGpuCounts?.join(',') || 'omitted'} maxUnreserved=${offer.maxUnreservedGpuCount ?? 'omitted'}`).join('; ')}`);

    let provisioningSequence = 0;
    let remainingCandidates = [...candidates];
    podName = `${config.podNamePrefix}${id}`;
    log('SSH bootstrap: GraphQL startSsh, image-default ENTRYPOINT/CMD, and per-run public key');
    const createInput = (batch) => ({
      name: podName,
      templateId,
      computeType: 'GPU',
      cloudType: batch.cloudType,
      gpuCount: 1,
      gpuTypeId: batch.gpuTypeIds[0],
      interruptible: false,
      supportPublicIp: true,
      ports: [...new Set([...(template.ports || []), '22/tcp'])],
      containerDiskInGb: config.containerDiskInGb,
      volumeInGb: 0,
      minVCPUPerGPU: config.minVcpuPerGpu,
      minRAMPerGPU: config.minRamPerGpu,
      // SSH_PUBLIC_KEY is RunPod's per-Pod override. Official image startup scripts consume the
      // platform-provided PUBLIC_KEY, so set both names to the same ephemeral key.
      env: { SSH_PUBLIC_KEY: keyMaterial.publicKey, PUBLIC_KEY: keyMaterial.publicKey },
    });
    while (remainingCandidates.length) {
      provisioningSequence++;
      podName = `${config.podNamePrefix}${id}${provisioningSequence === 1 ? '' : `-${provisioningSequence}`}`;
      let provisioned;
      try {
        provisioned = await provisionPod({
          client,
          candidates: remainingCandidates,
          podName,
          createInput,
          createPod: (input) => client.createGpuPodWithSsh(input),
          cloudPriority: clouds,
          individualOffers: true,
          recoverPodByName: (attempts) => recoverPodByName(client, podName, log, attempts),
          log,
          onAttempt: (attempt) => {
            attempt.podName = podName;
            state.provisioning.attempts.push(attempt);
            save();
          },
          signal: abortController.signal,
        });
      } catch (createError) {
        // A post-create validation or hydration failure carries the known Pod so finally can delete
        // it even though provisioning did not return normally.
        pod = createError.pod || pod;
        provisionWasUncertain = createError.uncertain === true;
        throw createError;
      }
      pod = provisioned.pod;
      provisionWasUncertain = false;
      state.selectedOffer = compactOffer(provisioned.offer);
      if (Number(pod.volumeInGb || 0) !== 0 || pod.networkVolume || pod.networkVolumeId) {
        throw new Error(`created Pod ${pod.id} unexpectedly has persistent storage attached`);
      }
      if (typeof pod.machine?.secureCloud === 'boolean') {
        const actualCloud = pod.machine.secureCloud ? 'SECURE' : 'COMMUNITY';
        if (actualCloud !== state.selectedOffer.cloudType) {
          throw new Error(`created Pod ${pod.id} cloud ${actualCloud} differs from requested ${state.selectedOffer.cloudType}`);
        }
      }
      const actualPrice = Number(pod.costPerHr ?? pod.adjustedCostPerHr ?? state.selectedOffer.pricePerHourUsd);
      state.pod = { id: pod.id, name: pod.name || podName, gpuTypeId: state.selectedOffer.gpuTypeId, cloudType: state.selectedOffer.cloudType, pricePerHourUsd: actualPrice };
      state.status = 'provisioned';
      save();
      log(`Pod ${pod.id} created: ${state.selectedOffer.gpuTypeId}, ${state.selectedOffer.cloudType}, $${actualPrice.toFixed(3)}/hr`);
      if (!Number.isFinite(actualPrice) || actualPrice > maxPrice) throw new Error(`actual Pod price $${actualPrice}/hr exceeds hard ceiling $${maxPrice}/hr`);

      const readyDeadline = Math.min(deadline - 60_000, Date.now() + config.readyTimeoutMinutes * 60_000);
      try {
        pod = await waitForReadyImpl(client, pod.id, readyDeadline, log, abortController.signal);
        const readyPrice = Number(pod.costPerHr ?? pod.adjustedCostPerHr ?? state.pod.pricePerHourUsd);
        if (!Number.isFinite(readyPrice) || readyPrice > maxPrice) {
          throw new Error(`running Pod price $${readyPrice}/hr exceeds hard ceiling $${maxPrice}/hr`);
        }
        state.pod.pricePerHourUsd = readyPrice;
        save();
        log(`Pod ${pod.id} ready; API-confirmed running price $${readyPrice.toFixed(3)}/hr`);
        connection = { host: pod.publicIp, port: pod.portMappings['22'], keyPath: sshKey, knownHostsPath: path.join(tempDir, 'known_hosts') };
        await waitForSshImpl(connection, readyDeadline, log, abortController.signal, { runProcessImpl, sshArgsImpl });
        break;
      } catch (readinessError) {
        if (abortController.signal.aborted) throw readinessError;
        const failedPodId = pod.id;
        const failedOffer = state.selectedOffer;
        log(`Pod ${failedPodId} readiness failed for ${failedOffer.gpuTypeId}/${failedOffer.cloudType}: ${readinessError.message}`, 'stderr');
        log(`Terminating unready Pod ${failedPodId}; no replacement will be created until deletion is confirmed`, 'stderr');
        await client.deletePod(failedPodId);
        if (!await confirmPodDeleted(client, failedPodId, log)) {
          throw new Error(`unready Pod ${failedPodId} remained visible; refusing a replacement create`);
        }
        state.provisioning.readinessFailures.push({
          podId: failedPodId,
          podName,
          gpuTypeId: failedOffer.gpuTypeId,
          cloudType: failedOffer.cloudType,
          reason: readinessError.message,
          deletionConfirmed: true,
        });
        remainingCandidates = remainingCandidates.filter((candidate) => !(
          candidate.gpuTypeId === failedOffer.gpuTypeId && candidate.cloudType === failedOffer.cloudType
        ));
        pod = null;
        connection = null;
        state.pod = null;
        state.selectedOffer = null;
        save();
        if (!remainingCandidates.length) throw new Error('all eligible GPU/cloud candidates failed bounded Pod readiness checks; no Pod remains');
        if (Date.now() >= deadline - 60_000) throw new Error('runtime deadline leaves no safe time for another Pod readiness attempt');
        log(`Deletion confirmed; retrying with ${remainingCandidates.length} different eligible GPU/cloud candidate(s)`);
      }
    }
    state.status = 'transferring';
    save();
    const remoteRoot = `/workspace/elder-souls-${id}`;
    const remoteArtifacts = `/workspace/elder-souls-artifacts-${id}`;
    await runProcessImpl('ssh', [...sshArgsImpl(connection), `mkdir -p '${remoteRoot}' '${remoteArtifacts}'`], { signal: abortController.signal, log });
    await runProcessImpl('scp', [...scpArgsImpl(connection), snapshot.archivePath, `root@${connection.host}:/tmp/elder-souls-${id}.tar.gz`], { signal: abortController.signal, log });
    await runProcessImpl('ssh', [...sshArgsImpl(connection), `tar -xzf '/tmp/elder-souls-${id}.tar.gz' -C '${remoteRoot}' && rm -f '/tmp/elder-souls-${id}.tar.gz'`], { signal: abortController.signal, log });
    // Controller files are deliberately overlaid after extraction. This lets --revision target a
    // commit older than this infrastructure without changing any game/tool bytes under test.
    await runProcessImpl('scp', [
      ...scpArgsImpl(connection),
      path.join(HERE, 'worker', 'bootstrap.sh'),
      `root@${connection.host}:/tmp/elder-souls-bootstrap-${id}.sh`,
    ], { signal: abortController.signal, log });
    await runProcessImpl('ssh', [...sshArgsImpl(connection), `mkdir -p '${remoteRoot}/tools/runpod/worker'`], { signal: abortController.signal, log });
    await runProcessImpl('scp', [
      ...scpArgsImpl(connection),
      path.join(HERE, 'worker', 'smoke.mjs'),
      `root@${connection.host}:${remoteRoot}/tools/runpod/worker/smoke.mjs`,
    ], { signal: abortController.signal, log });
    log(`Transferred exact snapshot to Pod ${pod.id}:${remoteRoot}`);

    const secondsRemaining = Math.max(1, Math.floor((deadline - Date.now() - 45_000) / 1000));
    if (secondsRemaining < 60) throw new Error('less than 60 seconds remain after provisioning; refusing to start test command');
    const command = args.command || 'node tools/runpod/worker/smoke.mjs';
    const commandB64 = Buffer.from(command).toString('base64');
    const sourceB64 = Buffer.from(JSON.stringify(state.source)).toString('base64');
    state.status = 'running';
    save();
    log(`Running on Pod ${pod.id} with ${secondsRemaining}s command deadline: ${command}`);
    commandResult = await runProcessImpl('ssh', [
      ...sshArgsImpl(connection),
      `bash '/tmp/elder-souls-bootstrap-${id}.sh' '${remoteRoot}' '${remoteArtifacts}' '${commandB64}' '${secondsRemaining}' '${id}' '${sourceB64}'`,
    ], { allowFailure: true, capture: false, signal: abortController.signal, log });
    state.commandExitCode = commandResult.code;
    state.status = 'retrieving';
    save();
    if (!await retrieveArtifacts()) throw new Error('artifact retrieval failed');
    if (commandResult.code !== 0) throw new Error(`remote test command exited ${commandResult.code}`);
    state.status = 'passed';
  } catch (caught) {
    error = caught;
    state.status = caughtSignal ? 'cancelled' : 'failed';
    state.error = { name: caught.name, message: caught.message };
    log(caught.stack || caught.message, 'stderr');
  } finally {
    clearTimeout(watchdog);
    if (connection && !artifactsRetrieved) {
      log('Attempting best-effort artifact retrieval before mandatory Pod cleanup');
      await retrieveArtifacts().catch((retrieveError) => log(`Best-effort artifact retrieval error: ${retrieveError.message}`, 'stderr'));
    }
    if (!pod?.id && provisionWasUncertain && podName) {
      log(`Resolving uncertain provision outcome for ${podName} before mandatory cleanup`, 'stderr');
      pod = await recoverPodByName(client, podName, log, 5);
      if (pod?.id) {
        state.pod = state.pod || {
          id: pod.id,
          name: pod.name || podName,
          gpuTypeId: pod.gpu?.id || pod.gpuTypeId || null,
          cloudType: pod.cloudType || null,
          pricePerHourUsd: Number(pod.costPerHr ?? pod.adjustedCostPerHr),
        };
        log(`Recovered uncertain Pod ${pod.id} for mandatory cleanup`, 'stderr');
      }
    }
    state.cleanup = cleanup = { attempted: Boolean(pod?.id) || provisionWasUncertain, terminated: false, at: new Date().toISOString(), error: null };
    if (pod?.id) {
      log(`Terminating Pod ${pod.id} in mandatory cleanup`);
      try {
        await client.deletePod(pod.id);
        cleanup.terminated = await confirmPodDeleted(client, pod.id, log);
        if (!cleanup.terminated) throw new Error(`Pod ${pod.id} remained visible after deletion checks`);
        log(`Pod ${pod.id} terminated and deletion confirmed`);
      } catch (cleanupError) {
        cleanup.error = cleanupError.message;
        state.status = 'cleanup_failed';
        log(`CRITICAL: Pod ${pod.id} cleanup failed: ${cleanupError.message}`, 'stderr');
        log(`Recovery: npm run gpu:cleanup -- --pod ${pod.id}`, 'stderr');
        if (!error) error = cleanupError;
      }
    } else if (provisionWasUncertain) {
      cleanup.error = `No Pod named ${podName} was visible after repeated recovery checks; run npm run gpu:cleanup immediately`;
      state.status = 'cleanup_unconfirmed';
      log(`CRITICAL: ${cleanup.error}`, 'stderr');
      if (!error) error = new Error(cleanup.error);
    }
    state.cleanup = cleanup;
    state.finishedAt = new Date().toISOString();
    save();
    removeTempDirImpl(tempDir);
    process.off('SIGINT', onSigint);
    process.off('SIGTERM', onSigterm);
  }
  if (error) throw error;
  log(`Run ${id} passed; Pod terminated; metadata: ${statePath}`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const command = args._[0];
  if (args.help || !command) { console.log(HELP.trim()); return; }
  const config = loadConfig();
  if (command === 'list') return listCommand(args, config);
  if (command === 'doctor') return doctorCommand(args, config);
  if (command === 'cleanup') return cleanupCommand(args, config);
  if (command === 'run') return runCommand(args, config);
  throw new Error(`unknown command: ${command}\n${HELP}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    const prefix = error instanceof RunPodError ? 'RunPod error' : 'GPU runner error';
    console.error(`${prefix}: ${error.message}`);
    process.exitCode = error.message === 'SIGINT' ? 130 : 1;
  });
}
