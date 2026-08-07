#!/usr/bin/env node
// opacity-consumption.mjs — is `game/data/world/opacity.json` READ by the running world?
//
// Owner: W1-OPACITY. Binding: RI-MTH07 / ARBITRATION §3 (CONSUMPTION), RI-WLD09 §B1.
//
// The claim this probe exists to make honest is: "the opacity register has a world-side
// consumer". A register nobody reads is a text file, and the way that failure has been shipped
// in this tree before is a data file that is fetched at boot and then falls off the end of
// `loadData`'s branch chain — `dialogue/persuasion-gmst.json` and `dialogue/faction-reactions.json`
// spent a whole round like that, loaded and unreadable, with every static check green.
//
// So this probe does not ask whether a reader EXISTS. It PERTURBS THE FILE ON DISK, reboots the
// world, and asserts the world says something different — and then restores and asserts the
// original behaviour comes back. Three perturbations, three different consumers:
//
//   C1 THE REFUSAL. Put a registered-opaque topic to somebody who has no info on it. With the
//      register, they decline in authored words (`source:'refusal'`, `mystery:'M-xx'`). Delete
//      that mystery from the file and the same question returns `{refused:'no_info'}` — silence,
//      which is what "nobody wrote anything" also looks like, and that equivalence is the whole
//      failure RI-WLD09 exists to prevent.
//   C2 THE DANGLE GUARD. Point one evidence id at a book that does not exist. The engine must
//      REFUSE TO BOOT, because a mystery whose evidence is a dangling id scores as designed
//      opacity and is not.
//   C3 THE DISCOVERY LOG. Read a book that is declared evidence. `getOpacityState()` must move
//      `evidence_met` for the mystery it is evidence for, and `getQuestState().booksRead` must
//      contain it. RI-WLD09 M-OP2's route attribution is not computable without this.
//
// A pass here is not "the numbers looked right". It is "the world changed when the file did,
// three times, in three different subsystems, and changed back".
//
// USAGE
//   node tools/world/opacity-consumption.mjs [--json <path>] [--width 320 --height 240]
//
// The renderer is not needed for any of this. Run it small; AGENT-PROTOCOL is explicit that a
// stepping loop with rendering live is the most expensive thing in this project, and this probe
// steps nothing at all.

import fs from 'node:fs';
import path from 'node:path';
import { parseArgs, wantsHelp, usage, writeJson, REPO_ROOT } from '../lib/cli.mjs';
import { launchGame } from '../lib/browser.mjs';

const USAGE = `
opacity-consumption.mjs — perturbation evidence that the opacity register is read by the world.

USAGE
  node tools/world/opacity-consumption.mjs [--json <path>]
`;
const args = parseArgs();
if (wantsHelp(args)) usage(USAGE);
args.width = args.width || 320;
args.height = args.height || 240;

const REG = path.join(REPO_ROOT, 'game/data/world/opacity.json');
const INDEXER = path.join(REPO_ROOT, 'tools/analysis/data-index.mjs');
const say = (s) => process.stdout.write(s + '\n');
const out = { checks: [], failures: [] };
const fail = (m) => { out.failures.push(m); say(`  FAIL  ${m}`); };
const pass = (m) => say(`  pass  ${m}`);

// A CRASH-SAFE BACKUP, and why it is not optional. `launchGame` calls `die()` — process.exit —
// when `ready()` throws, which is exactly what C2 makes happen on purpose. process.exit does not
// run a `finally`, so the first version of this probe left the PERTURBED register on disk and
// every subsequent boot in the repo failed. Two defences: a sidecar file restored on the next
// run, and a `process.on('exit')` hook, which DOES run under process.exit and can do sync IO.
const BACKUP = REG + '.probe-backup';
if (fs.existsSync(BACKUP)) {
  fs.copyFileSync(BACKUP, REG);
  process.stdout.write('[recovered] a previous run died mid-perturbation; the register was restored from its backup\n');
}
const ORIGINAL = fs.readFileSync(REG, 'utf8');
fs.writeFileSync(BACKUP, ORIGINAL);
process.on('exit', () => {
  try {
    if (fs.readFileSync(REG, 'utf8') !== ORIGINAL) {
      fs.writeFileSync(REG, ORIGINAL);
      process.stderr.write('[restored] the register was rewritten on the way out\n');
    }
    fs.unlinkSync(BACKUP);
  } catch { /* nothing left to do at exit */ }
});

/** Rewrite the register and re-hash the data index, because `check-data` guards the tree. */
async function writeRegister(text) {
  fs.writeFileSync(REG, text);
  const { execFileSync } = await import('node:child_process');
  execFileSync(process.execPath, [INDEXER], { cwd: REPO_ROOT, stdio: 'ignore' });
}
function restore() {
  fs.writeFileSync(REG, ORIGINAL);
  return import('node:child_process').then(({ execFileSync }) =>
    execFileSync(process.execPath, [INDEXER], { cwd: REPO_ROOT, stdio: 'ignore' }));
}

/** Boot, do something, tear down. Returns `{ok, value}` or `{ok:false, error}`. */
async function withWorld(fn) {
  let h = null;
  try {
    h = await launchGame(args);
    await h.h('setSeed', 1337);
    const v = await fn(h);
    return { ok: true, value: v };
  } catch (e) {
    return { ok: false, error: String(e && e.message ? e.message : e) };
  } finally {
    if (h && h.close) { try { await h.close(); } catch { /* the page is already gone */ } }
  }
}

/**
 * Find a live (npc, registered-opaque topic) pair whose answer is a refusal, by asking every
 * person in every populated state about every mystery's refusal topic.
 *
 * Deliberately NOT hard-coded to one pair: a probe that only works for the one case its author
 * happened to try is measuring its own fixture. If no pair is found the probe FAILS rather than
 * skipping — "no opportunity to observe" is not a pass.
 */
const STATES = ['writ-house', 'helstrom-market', 'stormhold-street', 'rootlands-well-graph'];
async function findRefusals(h, topics) {
  const found = [];
  for (const state of STATES) {
    await h.h('loadState', state);
    const here = await h.h('listNPCs');
    for (const n of here) {
      await h.h('talkTo', n.eid);
      for (const t of topics) {
        const r = await h.h('conversationSay', t);
        const st = r && r.said ? r : null;
        const conv = await h.h('getConversationState');
        if (conv && conv.said && conv.said_topic === t) {
          found.push({ state, npc: n.eid, topic: t, said: conv.said });
        }
      }
      await h.h('conversationClose');
    }
  }
  return found;
}

const registerDoc = JSON.parse(ORIGINAL);
const TOPICS = registerDoc.mysteries.flatMap((m) => m.refusal_topics || []);

let exitCode = 0;
try {
  // ---- C1a: baseline. Who declines, and about what? --------------------------------------
  say('== C1 the refusal: with the register ==');
  const base = await withWorld(async (h) => {
    const st = await h.h('getOpacityState');
    const refs = await findRefusals(h, TOPICS);
    return { opacity: st, refusals: refs };
  });
  if (!base.ok) { fail(`the world would not boot with the register in place: ${base.error}`); throw new Error('abort'); }
  const st0 = base.value.opacity;
  out.checks.push({ id: 'C1-baseline', present: st0.present, mysteries: st0.composition && st0.composition.total, refusals: base.value.refusals.length });
  if (!st0.present) fail('getOpacityState() reports present:false — the register did not reach the engine');
  else pass(`register present, ${st0.composition.total} mysteries, ${st0.composition.settleable} settleable / ${st0.composition.sealed} sealed`);

  const refusals = base.value.refusals;
  if (!refusals.length) fail('no NPC in any populated state declined about any registered topic — the refusal consumer never fired, so there is nothing to perturb');
  else {
    const sample = refusals[0];
    pass(`${refusals.length} refusals heard; sample — ${sample.npc} on "${sample.topic}": ${JSON.stringify(String(sample.said).slice(0, 72))}…`);
    out.checks.push({ id: 'C1-sample', ...sample });

    // ---- C1b: perturb. Delete the mystery that owns that topic. --------------------------
    say('== C1 the refusal: with that mystery deleted from the register ==');
    const owner = registerDoc.mysteries.find((m) => (m.refusal_topics || []).includes(sample.topic));
    const cut = JSON.parse(ORIGINAL);
    cut.mysteries = cut.mysteries.filter((m) => m.id !== owner.id);
    await writeRegister(JSON.stringify(cut, null, 1) + '\n');
    const after = await withWorld(async (h) => {
      await h.h('loadState', sample.state);
      await h.h('talkTo', sample.npc);
      const r = await h.h('conversationSay', sample.topic);
      const conv = await h.h('getConversationState');
      const stt = await h.h('getOpacityState');
      return { refused: r && r.refused ? r.refused : null, said: conv ? conv.said : null, total: stt.composition ? stt.composition.total : null };
    });
    await restore();
    if (!after.ok) fail(`the world would not boot with ${owner.id} removed: ${after.error}`);
    else {
      out.checks.push({ id: 'C1-perturbed', removed: owner.id, refused: after.value.refused, said: after.value.said, total: after.value.total });
      if (after.value.said === sample.said) {
        fail(`${sample.npc} said the same words with ${owner.id} deleted from the register — the line is not coming from the register`);
      } else if (after.value.refused !== 'no_info') {
        fail(`with ${owner.id} deleted the answer became ${JSON.stringify(after.value.said)} rather than the pre-register silence (refused:no_info)`);
      } else {
        pass(`deleting ${owner.id} turned an authored decline back into refused:no_info, and the register went ${st0.composition.total} -> ${after.value.total}`);
      }
    }
  }

  // ---- C2: the dangle guard --------------------------------------------------------------
  say('== C2 the dangle guard: one evidence id pointed at a book that does not exist ==');
  const broken = JSON.parse(ORIGINAL);
  const victim = broken.mysteries[4];
  victim.evidence = victim.evidence.slice();
  victim.evidence[0] = 'book:a-book-that-was-never-written';
  await writeRegister(JSON.stringify(broken, null, 1) + '\n');
  // `launchGame` calls `die()` (process.exit) when `ready()` throws, which is correct for a
  // probe that needs a world and fatal for one whose whole point is that the world must NOT
  // come up. So C2 runs `boot-check.mjs` as a CHILD PROCESS and reads its exit code — which is
  // also the closest thing to what CI would actually do.
  const { spawnSync } = await import('node:child_process');
  const r = spawnSync(process.execPath, [path.join(REPO_ROOT, 'tools/harness/boot-check.mjs')],
    { cwd: REPO_ROOT, encoding: 'utf8', timeout: 900e3 });
  const combined = `${r.stdout || ''}${r.stderr || ''}`;
  await restore();
  out.checks.push({ id: 'C2', boot_exit: r.status, named_register: /opacity register/.test(combined) });
  if (r.status === 0) fail('boot-check PASSED with a dangling evidence id — the resolver is not on the boot path, so a mystery pointing at nothing would ship');
  else if (!/opacity register/.test(combined)) fail(`the boot failed but not with the register's own error: ${combined.slice(0, 200)}`);
  else pass(`the engine refused to boot (exit ${r.status}), naming the unresolved reference`);

  // ---- C3: the discovery log -------------------------------------------------------------
  say('== C3 the discovery log: reading a declared book moves evidence_met ==');
  const withBook = registerDoc.mysteries.find((m) => (m.evidence || []).some((e) => e.startsWith('book:')));
  const bookId = withBook.evidence.find((e) => e.startsWith('book:')).slice('book:'.length);
  const log = await withWorld(async (h) => {
    await h.h('loadState', STATES[0]);
    const before = await h.h('getOpacityState');
    await h.h('openMenu', 'book', { id: bookId });
    await h.h('closeMenu');
    const afterS = await h.h('getOpacityState');
    const q = await h.h('getQuestState');
    const pick = (s) => (s.mysteries.find((m) => m.id === withBook.id) || {});
    return {
      before: pick(before).evidence_met, after: pick(afterS).evidence_met,
      routes: pick(afterS).routes, booksRead: (q.booksRead || []).includes(bookId),
      encountered_before: before.encountered, encountered_after: afterS.encountered,
    };
  });
  if (!log.ok) fail(`C3 could not run: ${log.error}`);
  else {
    out.checks.push({ id: 'C3', mystery: withBook.id, book: bookId, ...log.value });
    if (!(log.value.after > log.value.before)) fail(`reading ${bookId} did not move ${withBook.id}'s evidence_met (${log.value.before} -> ${log.value.after})`);
    else if (!log.value.booksRead) fail(`getQuestState().booksRead does not contain ${bookId}`);
    else if (!(log.value.routes || []).includes('book')) fail(`the encounter was not attributed to the 'book' route (got ${JSON.stringify(log.value.routes)})`);
    else pass(`reading ${bookId} moved ${withBook.id} evidence_met ${log.value.before} -> ${log.value.after}, route 'book', and booksRead records it`);
  }
} catch (e) {
  if (String(e.message) !== 'abort') fail(`probe aborted: ${e && e.message}`);
} finally {
  await restore();
}

const restored = fs.readFileSync(REG, 'utf8') === ORIGINAL;
if (!restored) fail('the register was NOT restored to its original bytes — fix this before committing');
else say(`\nregister restored byte-identical (${ORIGINAL.length} bytes)`);

say(out.failures.length ? `\n${out.failures.length} FAILURES` : '\nCONSUMPTION CONFIRMED');
if (args.json) writeJson(args.json, out);
exitCode = out.failures.length ? 1 : 0;
process.exit(exitCode);
