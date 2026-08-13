const REST_BASE = 'https://rest.runpod.io/v1';
const GRAPHQL_BASE = 'https://api.runpod.io/graphql';

export class RunPodError extends Error {
  constructor(message, {
    status = null,
    code = null,
    details = null,
    uncertain = false,
    creationOutcome = null,
    creationFailureKind = null,
  } = {}) {
    super(message);
    this.name = 'RunPodError';
    this.status = status;
    this.code = code;
    this.details = details;
    this.uncertain = uncertain;
    this.creationOutcome = creationOutcome;
    this.creationFailureKind = creationFailureKind;
  }
}

const CAPACITY_FAILURE_PATTERNS = [
  /this machine does not have the resources to deploy your pod/i,
  /there are no longer any instances available with the requested specifications/i,
];

function errorText(details) {
  if (typeof details === 'string') return details;
  if (!details || typeof details !== 'object') return '';
  return [details.error, details.message, details.detail]
    .filter((value) => typeof value === 'string')
    .join(' ');
}

// Only narrowly recognized capacity responses override the conservative rule that a create-side
// 5xx is ambiguous. RunPod's REST reference does not publish a general error schema, so unknown
// server responses must never be inferred to mean that no billable Pod exists.
export function classifyCreateFailure({ status, details } = {}) {
  const text = errorText(details);
  if (CAPACITY_FAILURE_PATTERNS.some((pattern) => pattern.test(text))) {
    return { outcome: 'definite-non-creation', kind: 'capacity', text };
  }
  if (Number.isInteger(status) && status >= 400 && status < 500 && ![408, 409, 425, 429].includes(status)) {
    return { outcome: 'definite-non-creation', kind: 'request-rejected', text };
  }
  return { outcome: 'ambiguous', kind: 'unknown', text };
}

function cleanKey(raw) {
  return String(raw || '').replace(/^Bearer\s+/i, '').trim();
}

function safeBody(text, key) {
  return String(text || '').replaceAll(key, '[REDACTED]').slice(0, 2000);
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class RunPodClient {
  constructor({ apiKey, fetchImpl = globalThis.fetch, requestTimeoutMs = 30_000 } = {}) {
    this.apiKey = cleanKey(apiKey);
    if (!this.apiKey) throw new RunPodError('RUNPOD_API_KEY is not set');
    if (typeof fetchImpl !== 'function') throw new RunPodError('global fetch is unavailable; Node 20+ is required');
    this.fetch = fetchImpl;
    this.requestTimeoutMs = requestTimeoutMs;
  }

  async #fetch(label, url, options = {}, { retries = 2, allow404 = false, podCreate = false } = {}) {
    let lastError;
    for (let attempt = 0; attempt <= retries; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(new Error(`${label} timed out`)), this.requestTimeoutMs);
      try {
        const response = await this.fetch(url, { ...options, signal: controller.signal });
        const text = await response.text();
        let body = null;
        if (text) {
          try { body = JSON.parse(text); }
          catch { body = text; }
        }
        if (allow404 && response.status === 404) return null;
        if (!response.ok) {
          const retryable = response.status === 429 || response.status >= 500;
          const creationFailure = podCreate
            ? classifyCreateFailure({ status: response.status, details: body })
            : null;
          const err = new RunPodError(
            `${label} failed with HTTP ${response.status}${text ? `: ${safeBody(text, this.apiKey)}` : ''}`,
            {
              status: response.status,
              details: body,
              // A timeout/rate-limit/server error can arrive after a POST was accepted. Only an
              // explicitly recognized capacity rejection proves that creation did not occur.
              uncertain: creationFailure?.outcome === 'ambiguous',
              creationOutcome: creationFailure?.outcome || null,
              creationFailureKind: creationFailure?.kind || null,
            },
          );
          if (retryable && attempt < retries) {
            lastError = err;
            await delay(500 * (2 ** attempt));
            continue;
          }
          throw err;
        }
        return body;
      } catch (error) {
        if (error instanceof RunPodError) throw error;
        lastError = new RunPodError(`${label} failed before a response was received: ${error.message}`, {
          uncertain: podCreate,
          creationOutcome: podCreate ? 'ambiguous' : null,
          creationFailureKind: podCreate ? 'transport' : null,
        });
        if (podCreate || attempt >= retries) throw lastError;
        await delay(500 * (2 ** attempt));
      } finally {
        clearTimeout(timer);
      }
    }
    throw lastError;
  }

  async rest(method, path, body, options = {}) {
    const headers = { Authorization: `Bearer ${this.apiKey}` };
    if (body !== undefined) headers['content-type'] = 'application/json';
    return this.#fetch(`RunPod ${method} ${path}`, `${REST_BASE}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    }, {
      retries: method === 'POST' ? 0 : 2,
      podCreate: method === 'POST' && path === '/pods',
      ...options,
    });
  }

  async graphql(query, variables = {}) {
    // RunPod's documented GraphQL authentication uses api_key in the query string. Never log URL.
    const body = await this.#fetch('RunPod GraphQL query', `${GRAPHQL_BASE}?api_key=${encodeURIComponent(this.apiKey)}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query, variables }),
    }, { retries: 2 });
    if (body?.errors?.length) {
      throw new RunPodError(`RunPod GraphQL error: ${body.errors.map((item) => item.message).join('; ')}`, {
        details: body.errors,
      });
    }
    return body?.data;
  }

  getTemplate(templateId, { allow404 = false } = {}) {
    return this.rest('GET', `/templates/${encodeURIComponent(templateId)}`, undefined, { allow404 });
  }

  listTemplates() {
    return this.rest('GET', '/templates');
  }

  createTemplate(input) {
    // A lost response can still leave a template containing an ephemeral SSH key. Reuse the
    // conservative create classification so callers recover by unique name instead of retrying.
    return this.rest('POST', '/templates', input, { podCreate: true });
  }

  async deleteTemplate(templateId) {
    await this.rest('DELETE', `/templates/${encodeURIComponent(templateId)}`, undefined, { allow404: true });
  }

  listPods() {
    return this.rest('GET', '/pods');
  }

  getPod(podId) {
    return this.rest('GET', `/pods/${encodeURIComponent(podId)}`, undefined, { allow404: true });
  }

  createPod(input) {
    return this.rest('POST', '/pods', input);
  }

  async deletePod(podId) {
    await this.rest('DELETE', `/pods/${encodeURIComponent(podId)}`, undefined, { allow404: true });
  }

  async listGpuOffers({ minVcpuPerGpu = 0, minRamPerGpu = 0, minDiskInGb = 0 } = {}) {
    for (const [label, value] of Object.entries({ minVcpuPerGpu, minRamPerGpu, minDiskInGb })) {
      if (!Number.isInteger(value) || value < 0) throw new RunPodError(`${label} must be a non-negative integer`);
    }
    const requirements = `gpuCount: 1, minVcpuCount: ${minVcpuPerGpu}, minMemoryInGb: ${minRamPerGpu}, minDisk: ${minDiskInGb}, supportPublicIp: true`;
    const data = await this.graphql(`
      query ElderSoulsGpuOffers {
        gpuTypes {
          id
          displayName
          memoryInGb
          secureCloud
          communityCloud
          secure: lowestPrice(input: { ${requirements}, secureCloud: true }) {
            stockStatus
            uninterruptablePrice
            availableGpuCounts
            maxUnreservedGpuCount
          }
          community: lowestPrice(input: { ${requirements}, secureCloud: false }) {
            stockStatus
            uninterruptablePrice
            availableGpuCounts
            maxUnreservedGpuCount
          }
        }
      }
    `);
    return normalizeOffers(data?.gpuTypes || []);
  }
}

export function normalizeOffers(gpuTypes) {
  return gpuTypes.flatMap((gpu) => [
    { cloudType: 'SECURE', available: gpu.secureCloud, price: gpu.secure },
    { cloudType: 'COMMUNITY', available: gpu.communityCloud, price: gpu.community },
  ].map((offer) => ({
    gpuTypeId: gpu.id,
    displayName: gpu.displayName,
    memoryInGb: gpu.memoryInGb,
    cloudType: offer.cloudType,
    cloudAvailable: offer.available !== false,
    stockStatus: offer.price?.stockStatus || 'None',
    pricePerHourUsd: offer.price?.uninterruptablePrice == null ? Number.NaN : Number(offer.price.uninterruptablePrice),
    availableGpuCounts: Array.isArray(offer.price?.availableGpuCounts) ? offer.price.availableGpuCounts : null,
    maxUnreservedGpuCount: offer.price?.maxUnreservedGpuCount == null ? null : Number(offer.price.maxUnreservedGpuCount),
  })));
}

export function chooseOffers(offers, { allowedGpuTypes, cloudTypes, maxPricePerHourUsd }) {
  const allowed = new Set(allowedGpuTypes);
  const clouds = new Set(cloudTypes);
  return offers.filter((offer) => (
    allowed.has(offer.gpuTypeId)
    && clouds.has(offer.cloudType)
    && offer.cloudAvailable
    && offer.stockStatus !== 'None'
    && Number.isFinite(offer.pricePerHourUsd)
    && offer.pricePerHourUsd <= maxPricePerHourUsd
    // lowestPrice was queried live for gpuCount=1 and this runner's CPU/RAM/disk/public-IP shape.
    // The price is concrete inventory evidence independent of the qualitative stock label. RunPod
    // currently omits both numeric count fields for some valid offers, so creation remains the
    // machine-level authority and uses the API's availability-priority multi-type scheduler.
  )).sort((left, right) => (
    left.pricePerHourUsd - right.pricePerHourUsd
    || allowedGpuTypes.indexOf(left.gpuTypeId) - allowedGpuTypes.indexOf(right.gpuTypeId)
    || cloudTypes.indexOf(left.cloudType) - cloudTypes.indexOf(right.cloudType)
  ));
}

export function isManagedPod(pod, { podNamePrefix, templateId, runtimeTemplateIds = [], imageName, podId } = {}) {
  if (podId && pod.id !== podId) return false;
  const knownTemplateIds = new Set([templateId, ...runtimeTemplateIds].filter(Boolean));
  const identityMatches = knownTemplateIds.has(pod.templateId)
    || Boolean(imageName && (pod.imageName || pod.image) === imageName);
  return String(pod.name || '').startsWith(podNamePrefix)
    && identityMatches
    && pod.desiredStatus !== 'TERMINATED';
}

export function isManagedRuntimeTemplate(template, { templateNamePrefix, imageName } = {}) {
  return String(template?.name || '').startsWith(templateNamePrefix)
    && template?.isPublic !== true
    && (!imageName || template?.imageName === imageName);
}
