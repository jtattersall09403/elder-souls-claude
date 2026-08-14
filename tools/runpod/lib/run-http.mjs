// A GPU run driven entirely over HTTPS.
//
// The SSH path in cli.mjs is kept because it is correct anywhere raw TCP works. It cannot work
// *here*: this container blocks raw TCP, and the agent proxy's CONNECT re-terminates TLS, which
// SSH is not. This module is the transport that does work — RunPod publishes a Pod's HTTP ports at
// https://<podId>-<port>.proxy.runpod.net, which is ordinary TLS on 443 and passes the proxy.
//
// The Pod is therefore never held open interactively. It is given work, it does it, and the frames
// come back as one tar over HTTPS.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { RunPodClient, RunPodError, chooseOffers } from './api.mjs';
import { provisionPod } from './provision.mjs';
import { currentOwner, ownerNameSegment } from './owner.mjs';
import {
  confirmPodDeleted,
  confirmTemplateDeleted,
  recoverPodByName,
  recoverTemplateByName,
} from './lifecycle.mjs';
import { createSnapshot, makeTempDir, removeTempDir } from './local.mjs';
import {
  DEFAULT_AGENT_PORT,
  PodAgentClient,
  agentStartCommand,
  newAgentToken,
  podProxyUrl,
} from './http-transport.mjs';
import { guardArtifactWrite, writeFileLoud } from './disk.mjs';
import { claimPod, releasePod } from './claims.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '../../..');
const RUNTIME_TEMPLATE_NAME_PREFIX = 'elder-souls-ephemeral-';

function compactOffer(offer) {
  return {
    gpuTypeId: offer.gpuTypeId,
    displayName: offer.displayName,
    cloudType: offer.cloudType,
    memoryInGb: offer.memoryInGb,
    stockStatus: offer.stockStatus,
    pricePerHourUsd: offer.pricePerHourUsd,
  };
}

async function waitForRunning(client, podId, deadline, log, signal) {
  // The HTTPS transport needs no public IP and no port mapping: RunPod's own proxy addresses the
  // Pod by id. RUNNING is the whole readiness condition on the API side.
  let prior = '';
  while (Date.now() < deadline) {
    if (signal?.aborted) throw signal.reason || new Error('run cancelled');
    const pod = await client.getPod(podId);
    if (!pod) throw new Error(`Pod ${podId} disappeared while starting`);
    const state = `${pod.desiredStatus}|${pod.lastStatusChange || ''}`;
    if (state !== prior) {
      log(`Pod ${podId} state=${pod.desiredStatus} detail=${pod.lastStatusChange || 'starting'}`);
      prior = state;
    }
    if (pod.desiredStatus === 'EXITED' || pod.desiredStatus === 'TERMINATED') throw new Error(`Pod entered ${pod.desiredStatus} before becoming ready`);
    if (pod.desiredStatus === 'RUNNING') return pod;
    await new Promise((resolve) => setTimeout(resolve, 5_000));
  }
  throw new Error(`Pod ${podId} did not reach RUNNING before the readiness deadline`);
}

/**
 * @param {object} args parsed CLI args
 * @param {object} config tools/runpod/config.json
 */
export async function runHttpCommand(args, config, dependencies = {}) {
  const environment = dependencies.environment || {
    apiKey: process.env.RUNPOD_API_KEY,
    templateId: process.env.RUNPOD_GPU_TEMPLATE_ID,
  };
  if (!environment.apiKey) throw new Error('RUNPOD_API_KEY is not set');
  if (!environment.templateId) throw new Error('RUNPOD_GPU_TEMPLATE_ID is not set');
  const { apiKey, templateId } = environment;

  const numberOption = (value, fallback, label) => {
    const number = value === undefined ? fallback : Number(value);
    if (!Number.isFinite(number) || number <= 0) throw new Error(`${label} must be a positive number`);
    return number;
  };
  const maxPrice = numberOption(args.maxPrice, config.maxPricePerHourUsd, '--max-price');
  const maxRuntime = numberOption(args.maxRuntime, config.maxRuntimeMinutes, '--max-runtime');
  if (maxPrice > config.absoluteMaxPricePerHourUsd) throw new Error(`--max-price exceeds hard cap $${config.absoluteMaxPricePerHourUsd}/hr`);
  if (maxRuntime > config.absoluteMaxRuntimeMinutes) throw new Error(`--max-runtime exceeds hard cap ${config.absoluteMaxRuntimeMinutes} minutes`);
  const allowedGpus = args.gpu?.length ? args.gpu : config.allowedGpuTypes;
  for (const gpu of allowedGpus) if (!config.allowedGpuTypes.includes(gpu)) throw new Error(`GPU is not allowed by tools/runpod/config.json: ${gpu}`);
  const clouds = (!args.cloud?.length || args.cloud.includes('all'))
    ? config.cloudTypes
    : args.cloud.map((value) => String(value).toUpperCase());

  const id = `${new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z').replace('T', '-')}-${process.pid}`;
  const owner = dependencies.owner || currentOwner();
  const ownerSegment = ownerNameSegment(owner.slug);
  const outputDir = path.resolve(REPO_ROOT, args.artifactDir || path.join(config.artifactRoot, id));
  // A full disk is why a previous session's captures silently produced nothing. Fail here, loudly,
  // before a Pod is billed for work whose output cannot be stored.
  const space = await guardArtifactWrite(outputDir, { requiredBytes: 256 * 1024 * 1024, label: 'GPU run artifacts' });

  const logPath = path.join(outputDir, 'lifecycle.log');
  const log = (message, stream = 'info') => {
    for (const line of String(message).split('\n')) {
      if (!line) continue;
      const rendered = `${new Date().toISOString()} [${stream}] ${line}`;
      fs.appendFileSync(logPath, `${rendered}\n`);
      (stream === 'stderr' ? process.stderr : process.stdout).write(`${rendered}\n`);
    }
  };

  const startedAt = new Date();
  const deadline = startedAt.getTime() + maxRuntime * 60_000;
  const abortController = new AbortController();
  const client = dependencies.client || new RunPodClient({ apiKey });
  const token = dependencies.token || newAgentToken();
  const agentPort = Number(args.agentPort || DEFAULT_AGENT_PORT);
  const tempDir = makeTempDir();

  let pod = null;
  let podName = null;
  let runtimeTemplate = null;
  let runtimeTemplateName = null;
  let provisionWasUncertain = false;
  let agent = null;
  let error = null;
  let commandExitCode = null;
  let artifactsRetrieved = false;

  const state = {
    schema: 'elder-souls/runpod-run@2',
    runId: id,
    transport: 'https-podproxy',
    owner: { slug: owner.slug, source: owner.source },
    status: 'initializing',
    startedAt: startedAt.toISOString(),
    finishedAt: null,
    diskCheck: space,
    limits: { maxPricePerHourUsd: maxPrice, maxRuntimeMinutes: maxRuntime, allowedGpuTypes: allowedGpus, cloudTypes: clouds },
    sourceTemplateId: templateId,
    runtimeTemplate: null,
    source: null,
    selectedOffer: null,
    pod: null,
    agentUrl: null,
    command: args.command || 'node tools/runpod/worker/smoke.mjs',
    commandExitCode: null,
    artifactDir: outputDir,
    artifactFiles: 0,
    gpu: null,
    cleanup: { attempted: false, terminated: false },
    templateCleanup: { attempted: false, deleted: false, error: null },
    error: null,
  };
  const statePath = path.join(outputDir, 'run.json');
  const save = () => writeFileLoud(statePath, `${JSON.stringify(state, null, 2)}\n`);

  const cancel = (name) => {
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
  log(`Run ${id} over the HTTPS Pod-proxy transport; SSH is not used at any point`);
  log(`Owner tag o${owner.slug} (from ${owner.source}); another agent's bare cleanup will not touch these resources`);
  log(`Local free space ${space.availableBytes == null ? 'unmeasured' : `${(space.availableBytes / 1073741824).toFixed(1)} GiB`}`);

  try {
    const template = await client.getTemplate(templateId);
    if (!template?.imageName) throw new Error(`template ${templateId} does not declare a container image`);
    log(`Source template ${template.id}: ${template.name} (${template.imageName})`);

    state.status = 'snapshotting';
    save();
    const selectedPaths = args.onlyPath?.length ? args.onlyPath : [...config.snapshotPaths, ...(args.include || [])];
    const snapshot = await createSnapshot({ repoRoot: REPO_ROOT, revision: args.revision, paths: selectedPaths, tempDir, log });
    state.source = { ...snapshot };
    delete state.source.archivePath;
    save();
    log(`Snapshot ${snapshot.revision}${snapshot.dirty ? ' + worktree changes' : ''}: ${snapshot.fileCount} files, ${(snapshot.bytes / 1048576).toFixed(1)} MiB`);

    state.status = 'selecting';
    save();
    const offers = await client.listGpuOffers({
      minVcpuPerGpu: config.minVcpuPerGpu,
      minRamPerGpu: config.minRamPerGpu,
      minDiskInGb: config.containerDiskInGb,
    });
    const candidates = chooseOffers(offers, { allowedGpuTypes: allowedGpus, cloudTypes: clouds, maxPricePerHourUsd: maxPrice });
    if (!candidates.length) throw new Error(`no allowed one-GPU offers have capacity at or below $${maxPrice.toFixed(3)}/hr`);
    log(`Eligible candidates: ${candidates.map((offer) => `${offer.displayName}/${offer.cloudType} $${offer.pricePerHourUsd.toFixed(3)}/hr`).join('; ')}`);

    runtimeTemplateName = `${RUNTIME_TEMPLATE_NAME_PREFIX}${ownerSegment}${id}`;
    const runtimeTemplateInput = {
      name: runtimeTemplateName,
      category: 'NVIDIA',
      containerDiskInGb: config.containerDiskInGb,
      dockerEntrypoint: ['bash', '-c'],
      dockerStartCmd: [agentStartCommand({ port: agentPort })],
      env: { POD_AGENT_TOKEN: token },
      imageName: template.imageName,
      isPublic: false,
      isServerless: false,
      // `/http` is what makes RunPod publish the port at <podId>-<port>.proxy.runpod.net.
      ports: [`${agentPort}/http`],
      readme: 'Ephemeral Elder Souls GPU worker driven over HTTPS; deleted by the owning run.',
      volumeInGb: 0,
      volumeMountPath: '/workspace',
    };
    try {
      runtimeTemplate = await client.createTemplate(runtimeTemplateInput);
    } catch (templateCreateError) {
      if (templateCreateError.uncertain !== true) throw templateCreateError;
      log('Template create outcome ambiguous; recovering by unique name before any Pod create', 'stderr');
      runtimeTemplate = await recoverTemplateByName(client, runtimeTemplateName, log, 5);
      if (!runtimeTemplate) throw templateCreateError;
    }
    if (!runtimeTemplate?.id) {
      runtimeTemplate = await recoverTemplateByName(client, runtimeTemplateName, log, 5);
      if (!runtimeTemplate?.id) throw new RunPodError(`template create returned no ID and none named ${runtimeTemplateName} was recoverable`, { uncertain: true });
    }
    state.runtimeTemplate = { id: runtimeTemplate.id, name: runtimeTemplate.name || runtimeTemplateName };
    save();
    log(`Created ephemeral runtime template ${runtimeTemplate.id} exposing ${agentPort}/http`);

    podName = `${config.podNamePrefix}${ownerSegment}${id}`;
    const createInput = (batch) => ({
      name: podName,
      templateId: runtimeTemplate.id,
      computeType: 'GPU',
      cloudType: batch.cloudType,
      gpuCount: 1,
      gpuTypeIds: batch.gpuTypeIds,
      gpuTypePriority: 'availability',
      interruptible: false,
      supportPublicIp: false,
      minVCPUPerGPU: config.minVcpuPerGpu,
      minRAMPerGPU: config.minRamPerGpu,
      ports: [`${agentPort}/http`],
    });
    let provisioned;
    try {
      provisioned = await provisionPod({
        client,
        candidates,
        podName,
        createInput,
        cloudPriority: clouds,
        recoverPodByName: (attempts) => recoverPodByName(client, podName, log, attempts),
        log,
        signal: abortController.signal,
      });
    } catch (createError) {
      pod = createError.pod || pod;
      provisionWasUncertain = createError.uncertain === true;
      throw createError;
    }
    pod = provisioned.pod;
    state.selectedOffer = compactOffer(provisioned.offer);
    const actualPrice = Number(pod.costPerHr ?? pod.adjustedCostPerHr ?? state.selectedOffer.pricePerHourUsd);
    if (!Number.isFinite(actualPrice) || actualPrice > maxPrice) throw new Error(`actual Pod price $${actualPrice}/hr exceeds hard ceiling $${maxPrice}/hr`);
    state.pod = { id: pod.id, name: pod.name || podName, gpuTypeId: state.selectedOffer.gpuTypeId, cloudType: state.selectedOffer.cloudType, pricePerHourUsd: actualPrice };
    state.status = 'provisioned';
    save();
    // Claim it before anything else can look at it: a sibling agent's cleanup reads these.
    claimPod(pod.id, { runId: id, ownerSlug: owner.slug, podName: pod.name || podName });
    log(`Pod ${pod.id}: ${state.selectedOffer.gpuTypeId}, ${state.selectedOffer.cloudType}, $${actualPrice.toFixed(3)}/hr`);

    pod = await waitForRunning(client, pod.id, Math.min(deadline - 60_000, Date.now() + config.readyTimeoutMinutes * 60_000), log, abortController.signal);
    const agentUrl = podProxyUrl(pod.id, agentPort);
    state.agentUrl = agentUrl;
    save();
    log(`Pod RUNNING; control channel is ${agentUrl} (HTTPS through the egress proxy, no SSH)`);
    agent = new PodAgentClient({ baseUrl: agentUrl, token });
    const health = await agent.waitUntilHealthy({
      deadline: Math.min(deadline - 60_000, Date.now() + config.readyTimeoutMinutes * 60_000),
      log,
      signal: abortController.signal,
    });
    state.gpu = health.gpu || null;
    state.status = 'transferring';
    save();
    log(`GPU reported by the Pod: ${health.gpu || '(nvidia-smi gave nothing)'}`);

    const remoteRoot = `/workspace/elder-souls-${id}`;
    const remoteArtifacts = `/workspace/elder-souls-artifacts-${id}`;
    const remoteDisk = await agent.freeSpace('/workspace').catch(() => null);
    if (remoteDisk) log(`Pod free space: ${(remoteDisk.freeBytes / 1073741824).toFixed(1)} GiB`);
    await agent.upload(snapshot.archivePath, `/tmp/elder-souls-${id}.tar.gz`, { log });
    if (!args.noBootstrap) await agent.upload(path.join(HERE, '..', 'worker', 'bootstrap.sh'), `/tmp/elder-souls-bootstrap-${id}.sh`);
    const extract = await agent.exec(
      `set -e; mkdir -p '${remoteRoot}' '${remoteArtifacts}'; tar -xzf '/tmp/elder-souls-${id}.tar.gz' -C '${remoteRoot}'; rm -f '/tmp/elder-souls-${id}.tar.gz'; ls '${remoteRoot}'`,
      { timeoutSec: 300, signal: abortController.signal },
    );
    if (extract.exitCode !== 0) throw new Error(`snapshot extraction failed on the Pod (exit ${extract.exitCode}): ${extract.stderr.slice(-500)}`);
    log(`Snapshot unpacked at ${remoteRoot}`);

    const secondsRemaining = Math.max(1, Math.floor((deadline - Date.now() - 60_000) / 1000));
    if (secondsRemaining < 60) throw new Error('less than 60 seconds remain after provisioning; refusing to start the test command');
    const command = args.command || 'node tools/runpod/worker/smoke.mjs';
    const commandB64 = Buffer.from(command).toString('base64');
    const sourceB64 = Buffer.from(JSON.stringify(state.source)).toString('base64');
    state.status = 'running';
    save();
    log(`Running with ${secondsRemaining}s deadline: ${command}`);
    // --no-bootstrap skips the Node/Playwright install, which is several minutes the caller does
    // not need when the command only wants to interrogate the GPU.
    const remoteCommand = args.noBootstrap
      ? command
      : `bash '/tmp/elder-souls-bootstrap-${id}.sh' '${remoteRoot}' '${remoteArtifacts}' '${commandB64}' '${secondsRemaining}' '${id}' '${sourceB64}'`;
    const result = await agent.exec(remoteCommand, {
      timeoutSec: secondsRemaining,
      cwd: remoteRoot,
      env: {
        RUNPOD_ARTIFACT_DIR: remoteArtifacts,
        RUNPOD_GPU_RUN_ID: id,
        RUNPOD_SOURCE_METADATA_B64: sourceB64,
      },
      signal: abortController.signal,
      onLog: (chunk, stream) => log(chunk.replace(/\n$/, ''), stream === 'stderr' ? 'stderr' : 'info'),
    });
    commandExitCode = result.exitCode;
    state.commandExitCode = commandExitCode;
    state.status = 'retrieving';
    save();

    const files = await agent.downloadDirectory(remoteArtifacts, path.join(outputDir, 'artifacts'), { log });
    artifactsRetrieved = true;
    state.artifactFiles = files;
    if (commandExitCode !== 0) throw new Error(`remote command exited ${commandExitCode}`);
    state.status = 'passed';
  } catch (caught) {
    error = caught;
    state.status = 'failed';
    state.error = { name: caught.name, message: caught.message };
    log(caught.stack || caught.message, 'stderr');
  } finally {
    clearTimeout(watchdog);
    if (agent && !artifactsRetrieved) {
      log('Attempting best-effort artifact retrieval before mandatory Pod cleanup');
      await agent.downloadDirectory(`/workspace/elder-souls-artifacts-${id}`, path.join(outputDir, 'artifacts'), { log })
        .then((files) => { state.artifactFiles = files; artifactsRetrieved = true; })
        .catch((retrieveError) => log(`Best-effort artifact retrieval failed: ${retrieveError.message}`, 'stderr'));
    }
    if (!pod?.id && provisionWasUncertain && podName) {
      pod = await recoverPodByName(client, podName, log, 5);
    }
    state.cleanup = { attempted: Boolean(pod?.id), terminated: false, at: new Date().toISOString(), error: null };
    if (pod?.id) {
      log(`Terminating Pod ${pod.id} in mandatory cleanup`);
      try {
        await client.deletePod(pod.id);
        state.cleanup.terminated = await confirmPodDeleted(client, pod.id, log);
        if (!state.cleanup.terminated) throw new Error(`Pod ${pod.id} remained visible after deletion checks`);
        releasePod(pod.id);
      } catch (cleanupError) {
        state.cleanup.error = cleanupError.message;
        state.status = 'cleanup_failed';
        log(`CRITICAL: Pod ${pod.id} cleanup failed: ${cleanupError.message}`, 'stderr');
        log(`Recovery: node tools/runpod/cli.mjs cleanup --pod ${pod.id}`, 'stderr');
        if (!error) error = cleanupError;
      }
    }
    state.templateCleanup = { attempted: Boolean(runtimeTemplate?.id), deleted: false, at: new Date().toISOString(), error: null };
    if (runtimeTemplate?.id) {
      try {
        await client.deleteTemplate(runtimeTemplate.id);
        state.templateCleanup.deleted = await confirmTemplateDeleted(client, runtimeTemplate.id, log);
        if (!state.templateCleanup.deleted) throw new Error(`template ${runtimeTemplate.id} remained visible after deletion checks`);
      } catch (templateCleanupError) {
        state.templateCleanup.error = templateCleanupError.message;
        state.status = 'cleanup_failed';
        log(`CRITICAL: template ${runtimeTemplate.id} cleanup failed: ${templateCleanupError.message}`, 'stderr');
        if (!error) error = templateCleanupError;
      }
    }
    state.finishedAt = new Date().toISOString();
    save();
    removeTempDir(tempDir);
    process.off('SIGINT', onSigint);
    process.off('SIGTERM', onSigterm);
  }
  if (error) throw error;
  log(`Run ${id} passed over HTTPS; Pod terminated; ${state.artifactFiles} artifact file(s) in ${outputDir}`);
  return state;
}
