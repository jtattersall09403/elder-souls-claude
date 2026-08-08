#!/usr/bin/env node
// play.mjs — serve the game for a person, and say so in plain words.
//
// `orchestration/NEXT-DISPATCH.md` §P.1 asks for "clone, one command, a browser window". Until now
// there was no such command: the game has only ever been opened by a harness, which serves it on an
// ephemeral port from inside a Playwright script and closes it again. A critic playing the opening
// by hand had to write its own server first. So did the next one.
//
// This is the same `serveDir` every harness tool uses — deliberately, so what a person sees is what
// the instruments see, on the same headers (the COOP/COEP pair matters: without it SharedArrayBuffer
// and precise timers differ from production and the game behaves subtly differently for the human
// than for the probe). A second, friendlier server would be a second implementation of one system,
// which is rule 10, and this project already has two sprint paths and two right hands.
//
//   node tools/play.mjs             # a fixed port, so the URL is the same every time
//   node tools/play.mjs --port 8123
//
// Ctrl-C stops it.
import { serveDir } from './lib/serve.mjs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const argv = process.argv.slice(2);
const portArg = argv.indexOf('--port');
// A fixed default rather than an ephemeral port: a person needs to be able to reload the page after
// a crash and find the same address. The harness wants port 0 for exactly the opposite reason —
// fourteen agents must not fight over one number.
const port = portArg !== -1 ? Number(argv[portArg + 1]) : 8080;

const { origin, close } = await serveDir(ROOT, { port });
const at = `${origin}/game/index.html`;

console.log(`
  Elder Souls — Argonia

  Open this in a browser:

      ${at}

  What to expect: a title screen, then New. You wake in a barge hold with someone
  on the other bench. Nothing will explain itself to you — that is deliberate, and
  it is the whole design. Walk over to her and reach out to start talking.

  What is known to be wrong today is listed in README.md at the repo root. Read it
  before you decide something is broken; several things are, and they are named.

  Ctrl-C to stop.
`);

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, async () => { await close?.(); process.exit(0); });
}
