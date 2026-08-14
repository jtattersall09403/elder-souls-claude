#!/usr/bin/env node
// check-published-refs.mjs — no licensed reference plate may be published.
//
// Every image under corpus/70-visual/refs/ is held on terms that say, in the provenance record's own
// words: "Retained solely as internal reference for comparison and critique of our own characters;
// never redistributed, never a source for an asset, no derivative made."
//
// docs/ IS published — it is the GitHub Pages site. Copying a reference plate into it is
// redistribution, and it happened once: docs/shots/SB-TEL__ds3-3625638110.jpg, a Dark Souls 3
// telegraph reference, was embedded in a blog post and served publicly from 2026-08-06 until it was
// found on 2026-08-14 by the agent building the character reference set. One of 689 — not systemic,
// which is exactly why nobody noticed.
//
// Compares by content hash, not filename, because a rename would defeat a name check.
//
//   node tools/check-published-refs.mjs              exit 1 if any reference image is published
//   node tools/check-published-refs.mjs --self-test  prove the check can go red

import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const IMG = /\.(jpe?g|png|gif|webp|avif)$/i;
const md5 = p => createHash('md5').update(readFileSync(p)).digest('hex');

function walk(dir, out = []) {
  let entries;
  try { entries = readdirSync(dir); } catch { return out; }
  for (const e of entries) {
    const p = join(dir, e);
    let st; try { st = statSync(p); } catch { continue; }
    if (st.isDirectory()) walk(p, out);
    else if (IMG.test(e)) out.push(p);
  }
  return out;
}

function offenders(refsDir = 'corpus/70-visual/refs', pubDir = 'docs') {
  const refs = new Map();
  for (const p of walk(refsDir)) { try { refs.set(md5(p), p); } catch {} }
  const hits = [];
  for (const p of walk(pubDir)) {
    try { const m = md5(p); if (refs.has(m)) hits.push([p, refs.get(m)]); } catch {}
  }
  return { refCount: refs.size, hits };
}

if (process.argv.includes('--self-test')) {
  // Both arms, per RULES rule 4: a probe that cannot fail is worse than no probe.
  const clean = offenders();
  // Sabotage arm: treat docs/ as if it were the refs tree, so every published image "matches" itself.
  const sab = offenders('docs', 'docs');
  const ok = clean.hits.length === 0 && sab.hits.length > 0;
  console.log(`self-test: clean arm ${clean.hits.length} offender(s); sabotaged arm ${sab.hits.length}.`);
  console.log(ok ? 'self-test OK — the arms disagree, so a published plate is actually detected.'
                 : 'self-test VACUOUS — the arms agree; this check proves nothing.');
  process.exit(ok ? 0 : 1);
}

const { refCount, hits } = offenders();
if (hits.length === 0) {
  console.log(`published-refs: ok — ${refCount} reference image(s) held, none published under docs/.`);
  process.exit(0);
}
console.error(`published-refs: FAIL — ${hits.length} licensed reference image(s) are in the published tree:`);
for (const [pub, ref] of hits) console.error(`  ${pub}\n    is byte-identical to ${ref}`);
console.error('\nThese are held for internal comparison only and may not be redistributed.');
console.error('Remove the copy under docs/ and rewrite whatever cites it.');
process.exit(1);
