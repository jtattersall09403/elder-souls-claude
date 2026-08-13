const REST_BASE = 'https://rest.runpod.io/v1';
const GRAPHQL_BASE = 'https://api.runpod.io/graphql';

export class RunPodError extends Error {
  constructor(message, { status = null, code = null, details = null, uncertain = false } = {}) {
    super(message);
    this.name = 'RunPodError';
    this.status = status;
    this.code = code;
    this.details = details;
    this.uncertain = uncertain;
  }
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

  async #fetch(label, url, options = {}, { retries = 2, allow404 = false } = {}) {
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
          const err = new RunPodError(
            `${label} failed with HTTP ${response.status}${text ? `: ${safeBody(text, this.apiKey)}` : ''}`,
            { status: response.status, details: body },
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
          uncertain: options.method === 'POST',
        });
        if (options.method === 'POST' || attempt >= retries) throw lastError;
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
    }, { retries: method === 'POST' ? 0 : 2, ...options });
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

  getTemplate(templateId) {
    return this.rest('GET', `/templates/${encodeURIComponent(templateId)}`);
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

  async listGpuOffers() {
    const data = await this.graphql(`
      query ElderSoulsGpuOffers {
        gpuTypes {
          id
          displayName
          memoryInGb
          secureCloud
          communityCloud
          secure: lowestPrice(input: { gpuCount: 1, secureCloud: true }) {
            stockStatus
            uninterruptablePrice
            availableGpuCounts
          }
          community: lowestPrice(input: { gpuCount: 1, secureCloud: false }) {
            stockStatus
            uninterruptablePrice
            availableGpuCounts
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
    pricePerHourUsd: Number(offer.price?.uninterruptablePrice),
    availableGpuCounts: offer.price?.availableGpuCounts || [],
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
    && offer.availableGpuCounts.includes(1)
  )).sort((left, right) => (
    left.pricePerHourUsd - right.pricePerHourUsd
    || allowedGpuTypes.indexOf(left.gpuTypeId) - allowedGpuTypes.indexOf(right.gpuTypeId)
    || cloudTypes.indexOf(left.cloudType) - cloudTypes.indexOf(right.cloudType)
  ));
}

export function isManagedPod(pod, { podNamePrefix, templateId, podId } = {}) {
  if (podId && pod.id !== podId) return false;
  return String(pod.name || '').startsWith(podNamePrefix)
    && (!pod.templateId || pod.templateId === templateId)
    && pod.desiredStatus !== 'TERMINATED';
}
