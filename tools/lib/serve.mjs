// Minimal static file server. The game MUST be servable over http:// (not file://) so
// ES modules, fetch() of data files and WebGL texture loads behave the same as in a browser.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.jsonl': 'application/x-ndjson; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp',
  '.gltf': 'model/gltf+json', '.glb': 'model/gltf-binary', '.bin': 'application/octet-stream',
  '.ktx2': 'image/ktx2', '.wasm': 'application/wasm', '.svg': 'image/svg+xml',
  '.ogg': 'audio/ogg', '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
};

export async function serveDir(root, { port = 0, host = '127.0.0.1' } = {}) {
  const rootAbs = path.resolve(root);
  const requests = [];
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost');
    let p = decodeURIComponent(url.pathname);
    if (p.endsWith('/')) p += 'index.html';
    const file = path.join(rootAbs, path.normalize(p).replace(/^(\.\.[/\\])+/, ''));
    requests.push({ path: p, at: Date.now() });
    if (!file.startsWith(rootAbs) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404, { 'content-type': 'text/plain' });
      res.end('404 ' + p);
      return;
    }
    const body = fs.readFileSync(file);
    res.writeHead(200, {
      'content-type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream',
      'content-length': body.length,
      'cache-control': 'no-store',
      // Enable SharedArrayBuffer / precise timers parity with production hosting.
      'cross-origin-opener-policy': 'same-origin',
      'cross-origin-embedder-policy': 'require-corp',
      'cross-origin-resource-policy': 'cross-origin',
    });
    res.end(body);
  });
  await new Promise((r, j) => { server.once('error', j); server.listen(port, host, r); });
  const addr = server.address();
  return {
    root: rootAbs,
    origin: `http://${host}:${addr.port}`,
    requests,
    close: () => new Promise((r) => server.close(r)),
  };
}
