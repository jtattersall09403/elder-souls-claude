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

/**
 * Everything the daemon owns on disk. Under reports/runs/, which is already gitignored.
 *
 * ISOLATION IS DERIVED FROM THE SOCKET, not bolted on beside it. `ES_CAPTURE_SOCK` used to move
 * only the socket: `LOCK_PATH` and `LOG_PATH` stayed pinned to RUNS_DIR/.capture, so the R1
 * critic's deliberately isolated daemon wrote into the SHARED capd.log and contended for the
 * SHARED capd.lock — an "isolated" instance that could still disturb, and be disturbed by, the
 * daemon every other agent on this box is using. All four paths now come from one place.
 */
const SOCK_ENV = process.env.ES_CAPTURE_SOCK || '';
export const SOCK_PATH = SOCK_ENV || path.join(RUNS_DIR, '.capture', 'capd.sock');
/** The directory the daemon owns: the socket's own directory, whatever that is. */
export const CAPD_DIR = path.dirname(SOCK_PATH);
export const LOCK_PATH = path.join(CAPD_DIR, 'capd.lock');
export const LOG_PATH = path.join(CAPD_DIR, 'capd.log');
/** The HMAC key with which the daemon signs its own cache manifests. See server.mjs readCache(). */
export const CACHE_KEY_PATH = path.join(CAPD_DIR, 'cache-mac.key');
export const CACHE_DIR = process.env.ES_CAPTURE_CACHE
  || (SOCK_ENV ? path.join(CAPD_DIR, 'cache') : path.join(RUNS_DIR, 'capture-cache'));

/** Defaults. Every one of these is part of the cache key, because every one changes the image. */
export const DEFAULTS = {
  width: 1920,
  height: 1080,
  state: 'default',
  seed: 1337,
  ui: false,
  settle_frames: 24,
  settle_gap: 12,          // settle.mjs GAP — see its calibration note
  settle_threshold: 0.005, // settle.mjs THRESHOLD — measured, see SETTLE-CALIBRATION.json
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
    // A ground-relative pose. The daemon resolves eye height against the terrain it teleported
    // onto, which a client cannot do without an engine. Every field is in the key.
    pose: spec.pose ? {
      yaw_deg: r4(spec.pose.yaw_deg ?? 0),
      pitch_deg: r4(spec.pose.pitch_deg ?? 0),
      eye_m: r4(spec.pose.eye_m ?? 1.7),
      fov: r4(spec.pose.fov ?? 70),
    } : null,
    // Only the keys the caller actually set. `__HARNESS.camera()` rejects unknown pose keys
    // outright (engine.js:3345 — deliberately, because silently ignoring one froze the camera and
    // returned a plausible state), so emitting `dir: null` here would fail every explicit pose.
    camera: spec.camera ? Object.fromEntries(Object.entries({
      pos: vec(spec.camera.pos),
      look: vec(spec.camera.look),
      dir: vec(spec.camera.dir),
      fov: r4(spec.camera.fov),
      mode: spec.camera.mode === undefined ? null : String(spec.camera.mode),
      lockOn: spec.camera.lockOn === undefined ? null : spec.camera.lockOn,
    }).filter(([, v]) => v !== null && v !== undefined)) : null,
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
    // Force the third frame even when the skip rule would allow two. Changes what is PROVED about
    // the picture, and a proof is part of what a cache entry is, so it is in the key.
    settle_always_c: !!spec.settle_always_c,
    /**
     * THE FALSIFICATION HOOK, AND IT IS IN THE KEY.
     *
     * `__no_camera_stream` removes the daemon's stream-drain at the camera, so a DIFFERENT and
     * emptier world is photographed. It was the one dishonest mutation of the nine the R1 critic
     * tested (`P2-cache-key-honesty`): it moved the picture and did not move the key, and it was
     * dropped by canonicalSpec so it did not appear in the manifest either. Combined with the old
     * `no_cache` — which meant "do not READ" and still wrote — that was a cache-poisoning
     * primitive: alter how the picture is produced, then bank the result under the legitimate key.
     * `no_cache` no longer writes (see server.mjs), and this is now keyed and recorded.
     */
    __no_camera_stream: !!spec.__no_camera_stream,
  };
  return c;
}

/**
 * Top-level spec keys the daemon actually understands. Anything else a caller passes is IGNORED,
 * and silently ignoring `exposure` or `lod` is how a caller comes to believe it asked for something
 * it did not get. `unknownKeys()` is recorded in every manifest and returned to the caller.
 *
 * `no_cache` is deliberately NOT in the canonical spec: it changes only whether the cache is
 * consulted, never the picture, so keying on it would fork the cache for no reason.
 */
export const KNOWN_SPEC_KEYS = new Set([
  'viewpoint', 'viewpoints_file', 'state', 'seed', 'place', 'pose', 'camera',
  'time', 'weather', 'tide', 'width', 'height', 'ui', 'menu', 'ops',
  'settle_frames', 'settle_gap', 'settle_threshold', 'settle_always_c',
  'no_cache', '__no_camera_stream',
  // declaration + free text: read by the arrival gate, recorded in the manifest audit block,
  // deliberately absent from the cache key because none of them moves a pixel.
  'evidence_of', 'arrival', 'claim', 'for', 'purpose', 'note', 'title', 'caption', 'description',
  'why', 'label', 'item', 'ri', 'tags',
]);

export function unknownKeys(spec = {}) {
  return Object.keys(spec).filter((k) => !KNOWN_SPEC_KEYS.has(k));
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
