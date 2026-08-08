#!/usr/bin/env node
// standing-check.mjs — THE one command. Would the owner, opening the links in the README right
// now, on the device in their pocket, see the game?
//
// WHY ONE COMMAND. Rule 9: ten checks confirmed individually and never together is how a green
// build ships broken. Three instruments existed and nothing ran them, which the W1-DEPLOY critic
// wrote down as "unwired — and the published URL 404'd during this round with nothing watching".
// A check nobody runs has the same value as a check that cannot fail.
//
// WHAT IT RUNS, in the order a failure is cheapest to diagnose:
//   1. verify-live-site   every published file retrievable, and the deployed bytes are ours.
//                         Names UNTRACKED files, because "written and never committed" is how the
//                         first black screen happened and a 404 alone does not say that.
//   2. verify-links       the blog and the landing page, and every internal link inside them,
//                         resolved the way a browser resolves it.
//   3. verify-playable    the game itself, in a real browser, at eight device shapes, reading the
//                         whole framebuffer at several instants and pressing keys and glass.
//
//   node tools/playability/standing-check.mjs                # the live site
//   node tools/playability/standing-check.mjs --local        # the working tree, same path shape
//   node tools/playability/standing-check.mjs --quick        # skip the eight-shape browser leg
//   node tools/playability/standing-check.mjs --self-test    # rule 4, every arm, end to end
//
// Exit 0 only if a person would see a moving picture and every link resolves.
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const LOCAL = has('--local');
const QUICK = has('--quick');
const SELF = has('--self-test');
const pass = (a) => argv.filter((x) => !['--local', '--quick', '--self-test'].includes(x));

const run = (rel, args) => new Promise((resolve) => {
  const t0 = Date.now();
  const p = spawn(process.execPath, [path.join(ROOT, rel), ...args], { cwd: ROOT, stdio: 'inherit' });
  p.on('close', (code) => resolve({ rel, code: code ?? 1, ms: Date.now() - t0 }));
});

const legs = [];
if (SELF) {
  // RULE 4, end to end. Each instrument's own self-test drives it against something that is
  // genuinely broken and requires it to go red. If any of them passes a broken page, this whole
  // command is decoration and should say so before anyone trusts a green run of it.
  console.log('standing-check --self-test: every instrument must be shown failing.\n');
  legs.push(await run('tools/world/verify-live-site.mjs', ['--self-test']));
  legs.push(await run('tools/playability/verify-links.mjs', ['--self-test']));
  legs.push(await run('tools/world/verify-playable.mjs', ['--self-test', ...(LOCAL ? ['--local'] : [])]));
} else {
  const where = LOCAL ? '--local' : null;
  console.log(`standing-check: ${LOCAL ? 'the working tree, at the live site\'s path shape' : 'the LIVE site'}\n`);
  // verify-live-site has no --local mode: it exists to ask the internet a question. Skipped
  // rather than faked, and said so, because a leg that silently becomes a no-op is worse than an
  // absent one — that is how "all green" stops meaning anything.
  if (!LOCAL) legs.push(await run('tools/world/verify-live-site.mjs', []));
  else console.log('standing-check: SKIPPING verify-live-site — it asks the deployed host a question and there is no deployed host in --local.\n');
  legs.push(await run('tools/playability/verify-links.mjs', where ? [where] : []));
  if (!QUICK) legs.push(await run('tools/world/verify-playable.mjs', [...(where ? [where] : []), ...pass()]));
  else console.log('\nstanding-check: SKIPPING verify-playable (--quick) — nothing here has looked at a pixel.\n');
}

console.log('\n──────────────────────────────────────────────────────────────');
let bad = 0;
for (const l of legs) {
  if (l.code !== 0) bad++;
  console.log(`  ${l.code === 0 ? 'PASS' : 'FAIL'}  ${path.basename(l.rel).padEnd(22)} ${(l.ms / 1000).toFixed(0)}s`);
}
console.log(bad
  ? `standing-check: FAIL — ${bad} of ${legs.length} leg(s). Read the leg's own output above; each one prints what it saw and what it means.`
  : `standing-check: PASS — ${legs.length} leg(s). The links resolve and a person would see a moving picture.`);
process.exit(bad ? 1 : 0);
