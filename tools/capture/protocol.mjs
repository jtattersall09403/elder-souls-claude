// protocol.mjs — the wire contract between capture clients and the capture daemon, plus the
// canonical form of a capture spec and the cache key derived from it.
//
// Transport: newline-delimited JSON over a unix domain socket. A unix socket rather than a TCP
// port because there is no port to collide on, the filesystem gives us the rendezvous name for
// free, and the socket file's existence is itself most of the "is it running?" question.
import path from 'node:path';
import crypto from 'node:crypto';
import { RUNS_DIR } from '../lib/cli.mjs';

export const PROTOCOL = 'elder-souls/capture@1';

/** Everything the daemon owns on disk. Under reports/runs/, which is already gitignored. */
export const CAPD_DIR = path.join(RUNS_DIR, '.capture');
export const SOCK_PATH = process.env.ES_CAPTURE_SOCK || path.join(CAPD_DIR, 'capd.sock');
export const LOCK_PATH = path.join(CAPD_DIR, 'capd.lock');
export const LOG_PATH = path.join(CAPD_DIR, 'capd.log');
export const CACHE_DIR = process.env.ES_CAPTURE_CACHE || path.join(RUNS_DIR, 'capture-cache');

/** Defaults. Every one of these is part of the cache key, because every one changes the image. */
export const DEFAULTS = {
  width: 1920,
  height: 1080,
  state: 'default',
  seed: 1337,
  ui: false,
  settle_frames: 24,
  settle_gap: 12,
  settle_threshold: 0.010,
};

const r4 = (n) => (n === null || n === undefined ? null : Math.round(Number(n) * 1e4) / 1e4);
const vec = (v) => (Array.isArray(v) ? v.map(r4) : null);

/**
 * Canonical capture spec — the *complete* list of things that change the picture.
 *
 * S34: "Key must include the game/ tree state, the viewpoint id, and every condition that changes
 * the image: time of day, weather, resolution, and any pose override." Anything a caller can pass
 * that moves a pixel must appear here, or the cache will serve one picture for two requests.
 */
export function canonicalSpec(spec = {}) {
  const c = {
    v: 1,
    viewpoint: spec.viewpoint ? String(spec.viewpoint) : null,
    viewpoints_file: spec.viewpoints_file ? String(spec.viewpoints_file) : null,
    state: spec.state !== undefined ? String(spec.state) : DEFAULTS.state,
    seed: Number(spec.seed ?? DEFAULTS.seed),
    place: spec.place ? { x: r4(spec.place.x), z: r4(spec.place.z), y: spec.place.y === undefined ? null : r4(spec.place.y) } : null,
    camera: spec.camera ? {
      pos: vec(spec.camera.pos),
      look: vec(spec.camera.look),
      dir: vec(spec.camera.dir),
      fov: r4(spec.camera.fov),
      up: vec(spec.camera.up),
    } : null,
    time: spec.time === undefined || spec.time === null ? null : r4(spec.time),
    weather: spec.weather === undefined || spec.weather === null ? null : String(spec.weather),
    tide: spec.tide === undefined || spec.tide === null ? null : String(spec.tide),
    width: Number(spec.width ?? DEFAULTS.width),
    height: Number(spec.height ?? DEFAULTS.height),
    ui: spec.ui === undefined ? DEFAULTS.ui : !!spec.ui,
    menu: spec.menu ? { name: String(spec.menu.name ?? spec.menu), opts: spec.menu.opts ?? null } : null,
    // Arbitrary extra harness calls, applied in order, e.g. [["spawn","champion",10,20]].
    ops: Array.isArray(spec.ops) ? spec.ops.map((o) => (Array.isArray(o) ? o : [o.op, ...(o.args || [])])) : [],
    settle_frames: Number(spec.settle_frames ?? DEFAULTS.settle_frames),
    settle_gap: Number(spec.settle_gap ?? DEFAULTS.settle_gap),
    settle_threshold: Number(spec.settle_threshold ?? DEFAULTS.settle_threshold),
  };
  return c;
}

/** Stable JSON — keys sorted at every level, so key order in the caller cannot fork the cache. */
export function stableJson(v) {
  if (v === null || typeof v !== 'object') return JSON.stringify(v);
  if (Array.isArray(v)) return '[' + v.map(stableJson).join(',') + ']';
  return '{' + Object.keys(v).sort().map((k) => JSON.stringify(k) + ':' + stableJson(v[k])).join(',') + '}';
}

/**
 * The cache key: build ⊕ spec.
 * The build key is FIRST and also becomes the cache subdirectory, so a build change does not
 * merely miss — it lands in a different directory entirely, and the old build's pictures are
 * still there to be diffed rather than silently overwritten.
 */
export function cacheKey(buildKey, spec) {
  const canon = canonicalSpec(spec);
  const payload = stableJson({ build: String(buildKey), spec: canon, protocol: PROTOCOL });
  return { key: crypto.createHash('sha256').update(payload).digest('hex'), canon, payload };
}

/** Where a given capture lives. */
export function cachePaths(buildKey, key, dir = CACHE_DIR) {
  const bucket = path.join(dir, String(buildKey).replace(/[^a-zA-Z0-9@._-]/g, '_'));
  return { bucket, png: path.join(bucket, key + '.png'), json: path.join(bucket, key + '.json') };
}
