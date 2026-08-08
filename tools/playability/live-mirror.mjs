#!/usr/bin/env node
// live-mirror.mjs — put a real browser in front of the REAL deployed site.
//
// WHY THIS EXISTS
// ---------------
// Every playability check this project owns has run against a local copy. The owner opened the
// *published* URL on a phone and got a black rectangle, twice, and no instrument could have seen
// it, because no instrument had ever loaded the deployed bytes in a browser.
//
// The obstacle is real and it is not the site. Outbound HTTPS from this container goes through an
// agent proxy, and **headless Chromium cannot complete a TLS handshake through it**. Measured,
// not assumed:
//
//   * a raw CONNECT from python to 127.0.0.1:38351 returns "HTTP/1.1 200 Connection Established";
//   * curl through the same proxy fetches https://jtattersall09403.github.io/… with a 517-byte
//     ClientHello and gets a 200;
//   * Chromium sends a 1736-1832 byte ClientHello through the same tunnel and the upstream RESETS
//     the connection every time — for github.io, for raw.githubusercontent.com, and for
//     example.com alike, so it is Chromium's handshake and not the destination.
//   * `--proxy-server`, `--disable-features=PostQuantumKyber,UseMLKEM,EncryptedClientHello`,
//     `--disable-quic`, `--disable-http2` and `--ssl-version-max=tls1.2` were all tried. None
//     brought the ClientHello under ~1700 bytes and none changed the reset.
//
// Node's TLS *does* traverse the tunnel (its ClientHello is small). So this process fetches the
// live site over the proxy and re-serves it, byte for byte, on plain HTTP at 127.0.0.1 — which
// browsers treat as a secure context, so nothing that needs one behaves differently.
//
// WHAT THIS BUYS AND WHAT IT DOES NOT. It is not "Chromium spoke to github.io" and this file will
// not let anyone say that it was. It IS: the browser resolves the module graph itself, and every
// byte it executes came off the live host on this request. A file that is missing on Pages 404s
// here exactly as it would on the phone; a file that is a commit stale is served stale. The three
// things it cannot test are the CDN's own TLS, HTTP/2 multiplexing, and Pages' cache headers as
// the browser would honour them (`--no-cache` strips them so every load is a cold one, which is
// the case we care about).
//
//   node tools/playability/live-mirror.mjs                 # serve, print the origin, stay up
//   node tools/playability/live-mirror.mjs --check         # fetch one path and exit
//   node tools/playability/live-mirror.mjs --self-test     # rule 4: prove it can report failure
//
// As a library:
//   const m = await serveLive();                 // → { origin, close(), requests, break(re) }
//   `${m.origin}/elder-souls-claude/game/index.html` is the owner's URL, path shape and all.
import http from 'node:http';
import https from 'node:https';
import tls from 'node:tls';
import net from 'node:net';
import { URL } from 'node:url';

export const LIVE_HOST = 'jtattersall09403.github.io';
export const LIVE_BASE = `https://${LIVE_HOST}`;
export const OWNER_LINKS = {
  game: '/elder-souls-claude/game/index.html',
  blog: '/elder-souls-claude/docs/index.html',
  landing: '/elder-souls-claude/',
};

/** The proxy this container forces outbound HTTPS through, or null if there is none. */
export function proxyEndpoint() {
  const raw = process.env.HTTPS_PROXY || process.env.https_proxy || '';
  if (!raw) return null;
  const u = new URL(raw);
  return { host: u.hostname, port: Number(u.port || 80) };
}

/** Open a TCP socket to `host:443`, through the CONNECT proxy when there is one. */
function tunnel(host) {
  return new Promise((resolve, reject) => {
    const px = proxyEndpoint();
    if (!px) {
      const s = net.connect(443, host);
      s.once('connect', () => resolve(s));
      s.once('error', reject);
      return;
    }
    const req = http.request({ host: px.host, port: px.port, method: 'CONNECT', path: `${host}:443` });
    req.once('connect', (res, socket) => {
      if (res.statusCode !== 200) return reject(new Error(`proxy CONNECT ${res.statusCode}`));
      resolve(socket);
    });
    req.once('error', reject);
    req.end();
  });
}

// ONE TUNNEL PER REQUEST, AND `Connection: close`. This is deliberate and it was measured.
// A keep-alive `https.Agent` over pooled tunnels is the obvious optimisation and it makes the
// egress proxy answer `403 x-deny-reason: host_not_allowed` for a host that the very same process
// fetches with 200 one line earlier — a policy denial produced by connection reuse, not by the
// destination. Isolated four ways: `Connection: close` 200, no headers at all 200, curl's own
// headers 200, keep-alive 403/hang. Rule 26: it is slower (≈220 files in 28 s) and that is the
// price of a fetch that is honest about what came off the live host.
//
// The same experiment turned up why Chromium cannot be pointed at the proxy directly: offering
// ALPN `h2` on the tunnel gets an immediate ECONNRESET, which is Chromium's default and is the
// `ERR_CONNECTION_RESET` this whole file exists to route around.

/**
 * GET one live path. Follows redirects (Pages issues them for directory paths).
 * @returns {Promise<{status:number, headers:object, body:Buffer, redirects:string[]}>}
 */
export async function fetchLive(pathname, { host = LIVE_HOST, depth = 0, redirects = [] } = {}) {
  if (depth > 5) throw new Error('too many redirects: ' + redirects.join(' -> '));
  const socket = await tunnel(host);
  const res = await new Promise((resolve, reject) => {
    const req = https.request({
      createConnection: () => tls.connect({ socket, servername: host }),
      host, path: pathname, method: 'GET',
      headers: { Host: host, Connection: 'close', 'User-Agent': 'elder-souls-live-mirror/1' },
    }, resolve);
    req.once('error', reject);
    req.end();
  });
  const chunks = [];
  for await (const c of res) chunks.push(c);
  const body = Buffer.concat(chunks);
  if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
    const next = new URL(res.headers.location, `https://${host}${pathname}`);
    redirects.push(`${res.statusCode} -> ${next.pathname}`);
    return fetchLive(next.pathname + next.search, { host: next.hostname, depth: depth + 1, redirects });
  }
  return { status: res.statusCode, headers: res.headers, body, redirects };
}

/**
 * Serve the live site on localhost over plain HTTP, preserving the path shape exactly.
 * @param {object} opts
 * @param {RegExp|null} opts.breakPaths  paths matching this are answered 404 — the sabotage arm
 *                                       that reproduces the missing-module black screen (rule 4).
 * @param {boolean} opts.cache           reuse bytes within one run (a page fetches main.js once,
 *                                       but several profiles fetch the same 700 files).
 */
export async function serveLive({ breakPaths = null, cache = true, host = LIVE_HOST } = {}) {
  /** @type {Array<{path:string,status:number,bytes:number,ms:number,broken?:boolean}>} */
  const requests = [];
  const store = new Map();
  let broken = breakPaths;
  let retried = 0;   // how many times the live host answered 5xx and we asked again

  const server = http.createServer(async (req, res) => {
    const t0 = Date.now();
    const p = req.url;
    if (broken && broken.test(p)) {
      requests.push({ path: p, status: 404, bytes: 0, ms: 0, broken: true });
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      return res.end('sabotaged by live-mirror --break');
    }
    try {
      let hit = cache ? store.get(p) : null;
      if (!hit) {
        hit = await fetchLive(p, { host });
        // RETRY 5xx, AND COUNT IT. Sweeping ~700 files down one tunnel each makes Pages' CDN
        // answer the occasional 503, and a mirror that passes those straight through
        // MANUFACTURES a failure the site does not have — the first run of this died at
        // `world/hazards.json (503)` for exactly that reason.
        //
        // But the retry must not bury the fact, because the fact is a finding: the game's own
        // loader (game/src/engine.js:10190) has NO retry, so one transient 5xx anywhere in
        // several hundred data files kills the entire boot. That is a black screen a phone on a
        // flaky connection can produce and this machine never will. So the count is kept and
        // reported; a run with a non-zero `retried` is a run that watched the real host wobble.
        for (let i = 0; hit.status >= 500 && i < 3; i++) {
          retried++;
          await new Promise((s) => setTimeout(s, 400 * (i + 1)));
          hit = await fetchLive(p, { host });
        }
        if (cache && hit.status === 200) store.set(p, hit);
      }
      requests.push({ path: p, status: hit.status, bytes: hit.body.length, ms: Date.now() - t0 });
      const headers = { 'Content-Length': hit.body.length, 'Cache-Control': 'no-store' };
      // Pass through only what decides how the browser PARSES the bytes. Everything else
      // (etag, cdn hints, cookies) would only make the local load diverge from a cold one.
      for (const k of ['content-type', 'content-encoding']) if (hit.headers[k]) headers[k] = hit.headers[k];
      res.writeHead(hit.status, headers);
      res.end(hit.body);
    } catch (e) {
      requests.push({ path: p, status: 0, bytes: 0, ms: Date.now() - t0, error: String(e.message || e) });
      res.writeHead(502, { 'Content-Type': 'text/plain' });
      res.end('live-mirror could not reach the live host: ' + String(e.message || e));
    }
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const origin = `http://127.0.0.1:${server.address().port}`;
  return {
    origin, requests,
    get retried() { return retried; },
    url: (k) => origin + (OWNER_LINKS[k] || k),
    setBreak: (re) => { broken = re; },
    close: () => new Promise((r) => server.close(r)),
  };
}

// ── CLI ───────────────────────────────────────────────────────────────────────────────────────
if (import.meta.url === `file://${process.argv[1]}`) {
  const argv = process.argv.slice(2);
  if (argv.includes('--self-test')) {
    // Rule 4. Two arms and they must disagree, or the mirror is reporting its own optimism:
    // a path that certainly exists must come back 200 with bytes, and one that certainly does not
    // must come back 404. A mirror that 200s everything (a stub, a cached index, a proxy error
    // page) passes the first arm alone.
    const real = await fetchLive(OWNER_LINKS.game);
    const bogus = await fetchLive('/elder-souls-claude/game/nope-' + Date.now() + '.js');
    const looksLikeGame = /<canvas id="view"/.test(real.body.toString('utf8'));
    const ok = real.status === 200 && looksLikeGame && bogus.status === 404;
    console.log(`live-mirror --self-test: real path ${real.status} (${real.body.length} b, is-the-game=${looksLikeGame}), absent path ${bogus.status}`);
    // And the sabotage arm must actually sabotage.
    const m = await serveLive({ breakPaths: /main\.js$/ });
    const r = await new Promise((resolve) => http.get(m.origin + '/elder-souls-claude/game/src/main.js', resolve));
    const sabotaged = r.statusCode === 404;
    const untouched = await new Promise((resolve) => http.get(m.origin + OWNER_LINKS.game, resolve));
    await m.close();
    console.log(`live-mirror --self-test: --break 404s the named path = ${sabotaged}, leaves others alone = ${untouched.statusCode === 200}`);
    const all = ok && sabotaged && untouched.statusCode === 200;
    console.log(all ? 'live-mirror --self-test: PASS' : 'live-mirror --self-test: FAIL');
    process.exit(all ? 0 : 1);
  }
  if (argv.includes('--check')) {
    for (const [name, p] of Object.entries(OWNER_LINKS)) {
      const r = await fetchLive(p);
      console.log(`${name.padEnd(8)} ${r.status} ${String(r.body.length).padStart(8)} b  ${r.redirects.join(' ') || ''}`);
    }
    process.exit(0);
  }
  const m = await serveLive();
  console.log(`live-mirror: ${m.origin}  →  ${LIVE_BASE}`);
  for (const [k, v] of Object.entries(OWNER_LINKS)) console.log(`  ${k.padEnd(8)} ${m.origin}${v}`);
}
