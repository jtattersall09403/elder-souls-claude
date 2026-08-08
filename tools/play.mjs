#!/usr/bin/env node
// play.mjs — serve the game and print the URL a person opens.
//
// This is §P.1's "one command": clone, run it, click the link, get a title screen. It is not a
// probe and it measures nothing. It exists because the round-2 verdict's §13 answer to "can a
// person clone this and run one command?" was *no* — there was no server script anywhere in the
// tree, and `file://` cannot work here because `game/index.html` is an ES module that `fetch`es
// its data.
//
// Two things it checks before it prints a URL, because a link that serves a broken page is worse
// than no link:
//   * `game/index.html` and `game/data/index.json` exist;
//   * every file `game/data/index.json` lists is on disk. A missing data file shows up in the
//     browser as a blank canvas and a console message nobody asked the owner to open.
//
// USAGE
//   ./play.sh                 (or: node tools/play.mjs)
//   ./play.sh --port 8123
//   ./play.sh --host 0.0.0.0  bind on every interface, for a browser on another machine
'use strict';

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { serveDir } from './lib/serve.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const GAME = path.join(REPO_ROOT, 'game');

const argv = process.argv.slice(2);
const argOf = (name, dflt) => {
  const i = argv.indexOf('--' + name);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : dflt;
};
if (argv.includes('--help') || argv.includes('-h')) {
  process.stdout.write('usage: ./play.sh [--port <n>] [--host <addr>]\n');
  process.exit(0);
}
const port = Number(argOf('port', process.env.PORT || 8080));
const host = String(argOf('host', '127.0.0.1'));

const say = (s) => process.stdout.write(s + '\n');

// ---- refuse to print a URL for a tree that cannot serve a playable page ----------------------
const problems = [];
for (const rel of ['index.html', 'data/index.json', 'src/main.js']) {
  if (!fs.existsSync(path.join(GAME, rel))) problems.push(`game/${rel} is missing`);
}
if (!problems.length) {
  const index = JSON.parse(fs.readFileSync(path.join(GAME, 'data/index.json'), 'utf8'));
  const missing = (index.files || []).map((f) => f.path).filter((p) => !fs.existsSync(path.join(GAME, 'data', p)));
  if (missing.length) problems.push(`${missing.length} data file(s) listed in game/data/index.json are not on disk: ${missing.slice(0, 4).join(', ')}${missing.length > 4 ? ' …' : ''}`);
}
if (problems.length) {
  say('This tree cannot serve a playable page:');
  for (const p of problems) say('  - ' + p);
  say('');
  say('Nothing was served. Fix the above and run ./play.sh again.');
  process.exit(1);
}

let srv;
try {
  srv = await serveDir(GAME, { port, host });
} catch (err) {
  if (err && err.code === 'EADDRINUSE') {
    say(`Port ${port} is already in use. Try:  ./play.sh --port ${port + 1}`);
    process.exit(1);
  }
  throw err;
}

say('');
say('  Elder Souls is being served. Open this in a browser:');
say('');
say(`      ${srv.origin}/index.html`);
say('');
say('  New game, then walk to the woman on the other bench and press E to talk to her.');
say('  Move with WASD, look with the mouse, E or Enter to interact. Escape gives the cursor back.');
say('  Type your name on the keyboard; Enter writes it down.');
say('');
say('  Ctrl-C stops the server.');
say('');

const stop = async () => { try { await srv.close(); } catch { /* shutting down */ } process.exit(0); };
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
