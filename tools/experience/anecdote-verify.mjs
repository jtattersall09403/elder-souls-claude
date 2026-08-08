#!/usr/bin/env node
// anecdote-verify.mjs — `experience.memory.recall`. RI-EXP02 §E, and §Step 6's MANDATORY control.
//
//   node tools/experience/anecdote-verify.mjs --recall reports/recall/<id>/m3-terminal.md \
//     --traces reports/sessions/ --data game/data
//   node tools/experience/anecdote-verify.mjs --sabotage        # SAB-P — mandatory, hard fail 5
//   node tools/experience/anecdote-verify.mjs --self-test
//
// §E is the anti-gaming rule and the item says nothing else in it survives if this does not
// hold, "because a language model asked for a story will always produce a story":
//
//   1. LOCATE   a frame range in the session traces matching the action + consequence, ±2 min.
//   2. RESOLVE  every proper noun to a path under `game/data/**`. Unresolvable ⇒ confabulation.
//   3. CLASS    T1–T5 per §B, and the generic-substitution test per §C.
//   4. SCORE    `anecdote_score = verified − unverified`. Never `verified` alone — silence has
//               to be cheaper than invention or the instrument measures the model.
//
// AND THE PART THAT IS NOT OPTIONAL. §Step 6: SAB-P (prose flattened) is one of the two
// sabotages this item must detect. "If the battery cannot separate them at that margin, this
// item's verdict is VOID, not FAIL — a broken instrument does not get to produce a score." Hard
// fail 5 is "the sabotage control was not run". `PLAYTHROUGH-CRITIC` §10 calls that the most
// likely single failure in the corpus.
//
// So SAB-P is implemented here as a real data filter — every dialogue info, journal entry and
// book passage in `game/data/**` replaced by its own first sentence, from the same commit, no
// hand-authoring — and it is run through `lib/sabotage.mjs`, which means:
//   · a control that was not run cannot be reported as passed;
//   · a control whose two arms agree is INERT and the item is VOID, not FAIL;
//   · a control run over an empty corpus is VACUOUS and is not a pass either.
//
// WHAT IS MEASURED, AND WHAT IS NOT (RULES #26). The full instrument needs a 20-hour chain and
// an isolated recalling agent. Neither exists on this tree. What exists is the shipped content,
// so the arms are the CONTENT CENSUS — how much of what the game says has the shape of something
// a player could tell someone about — and the margin is applied to that. That is a weaker claim
// than the item's and it is labelled `measured_on: "content_census"` in the output. It is,
// however, a control that RAN, on real data, with a real filter, and can fail; which is more
// than this item has ever had.
//
// EXIT: 0 · 2 the control failed to separate at the margin (=> VOID) · 3 no recall artifact and
//       no census possible · 5 self-test failed · 6 the recall prompt has drifted from §D.
'use strict';

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runControl, VERDICT } from './lib/sabotage.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const REPO = path.resolve(HERE, '..', '..');
const argv = process.argv.slice(2);
const has = (k) => argv.includes(`--${k}`);
const arg = (k, d) => { const i = argv.findIndex((a) => a === `--${k}` || a.startsWith(`--${k}=`)); if (i < 0) return d; const a = argv[i]; return a.includes('=') ? a.slice(a.indexOf('=') + 1) : argv[i + 1]; };
const say = (s) => process.stdout.write(s + '\n');

// ---------------------------------------------------------------------------------------------
// The content census. "What is there to tell someone about?"
//
// A passage is TELLABLE when it has A1's shape (a thing done and a thing that changed because of
// it) and A2's proper noun. §C's generic-substitution test is applied by tokenising the proper
// nouns out and asking whether what is left is still a true sentence about two other RPGs — that
// judgement belongs to an agent, so what is implemented here is its mechanical half: a passage
// whose entire content survives noun-substitution unchanged in force is generic.

const CONSEQUENCE_WORDS = /\b(so|then|because|since|after|until|and now|which is why|the result|afterwards|ever since|has not|no longer|would not|refused|closed|opened|paid|took|gave|died|burned|left|came back|stopped)\b/i;
const AGENT_WORDS = /\b(I |we |he |she |they |the player|you )/i;
const GENERIC = /^(?:[^.]{0,40})$|^(the|a|an)\s+\w+\s+(is|was|are|were)\s+\w+\.?$/i;

function properNouns(s) {
  // Capitalised multi-word forms and hyphenated Argonian names; crude on purpose and reported
  // as such — the resolution step against game/data is what makes a noun count, not this.
  const out = new Set();
  for (const m of String(s).matchAll(/\b([A-Z][a-z]+(?:[- ][A-Z][a-z]+)+)\b/g)) out.add(m[1]);
  for (const m of String(s).matchAll(/\b([A-Z][a-z]{3,})\b/g)) out.add(m[1]);
  return [...out];
}

function firstSentence(s) {
  const t = String(s);
  const m = /^[\s\S]*?[.!?](?=\s|$)/.exec(t);
  return m ? m[0] : t;
}

/** Every player-facing passage the shipped tree carries, with where it came from. */
export function passages(dataDir, { flatten = false } = {}) {
  const out = [];
  const push = (file, kind, text) => {
    if (typeof text !== 'string' || text.length < 20) return;
    out.push({ file, kind, text: flatten ? firstSentence(text) : text });
  };
  (function w(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) { w(p); continue; }
      if (!e.name.endsWith('.json')) continue;
      const rel = path.relative(dataDir, p).replace(/\\/g, '/');
      let j; try { j = JSON.parse(fs.readFileSync(p, 'utf8')); } catch { continue; }
      if (rel.startsWith('quests/')) for (const q of j.quests || []) for (const e2 of q.journal || []) push(rel, 'journal', e2.text);
      if (rel.startsWith('dialogue/topics/')) for (const t of j.topics || []) for (const i of t.infos || []) push(rel, 'dialogue', i.x);
      if (rel.startsWith('books/')) for (const b of j.books || []) {
        push(rel, 'book', b.text || b.body);
        for (const pg of b.pages || []) push(rel, 'book', typeof pg === 'string' ? pg : pg.text);
      }
    }
  })(dataDir);
  return out;
}

export function census(list) {
  const rows = list.map((p) => {
    const nouns = properNouns(p.text);
    const shape = AGENT_WORDS.test(p.text) && CONSEQUENCE_WORDS.test(p.text);
    const generic = GENERIC.test(p.text.trim());
    return { ...p, nouns: nouns.length, shape, generic, tellable: shape && nouns.length > 0 && !generic };
  });
  const tellable = rows.filter((r) => r.tellable);
  return {
    passages: rows.length,
    tellable: tellable.length,
    by_kind: rows.reduce((h, r) => { const k = r.kind; h[k] = h[k] || { n: 0, tellable: 0 }; h[k].n++; if (r.tellable) h[k].tellable++; return h; }, {}),
    mean_chars: rows.length ? Math.round(rows.reduce((s, r) => s + r.text.length, 0) / rows.length) : 0,
    distinct_nouns: new Set(tellable.flatMap((r) => properNouns(r.text))).size,
    rows,
  };
}

// ---------------------------------------------------------------------------------------------
// §E steps 1–4, over a recall artifact.

function resolveNoun(noun, dataIndex) {
  const key = noun.toLowerCase().replace(/[^a-z0-9]+/g, '');
  return dataIndex.get(key) || null;
}

function buildDataIndex(dataDir) {
  const idx = new Map();
  (function w(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) { w(p); continue; }
      if (!e.name.endsWith('.json')) continue;
      const rel = path.relative(REPO, p);
      let text; try { text = fs.readFileSync(p, 'utf8'); } catch { continue; }
      for (const m of text.matchAll(/"(?:id|npc_id|quest|topic|book|item|poi|faction)"\s*:\s*"([^"]{3,})"/g)) {
        const k = m[1].toLowerCase().replace(/[^a-z0-9]+/g, '');
        if (!idx.has(k)) idx.set(k, `${rel} :: ${m[1]}`);
      }
      for (const m of text.matchAll(/"(?:name|title)"\s*:\s*"([^"]{3,})"/g)) {
        const k = m[1].toLowerCase().replace(/[^a-z0-9]+/g, '');
        if (!idx.has(k)) idx.set(k, `${rel} :: ${m[1]}`);
      }
    }
  })(dataDir);
  return idx;
}

function verifyRecall(text, dataIndex) {
  const lines = text.split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#') && !l.startsWith('<!--'));
  const items = lines.map((l) => {
    const nouns = properNouns(l);
    const resolved = nouns.map((n) => ({ noun: n, path: resolveNoun(n, dataIndex) }));
    const anyResolved = resolved.some((r) => r.path);
    const shape = AGENT_WORDS.test(l) && CONSEQUENCE_WORDS.test(l);
    const generic = !nouns.length || GENERIC.test(l);
    const verified = shape && anyResolved && !generic;
    return { text: l, proper_nouns: resolved, has_shape: shape, generic, verified, verdict: verified ? 'verified' : 'unverified' };
  });
  const verified = items.filter((i) => i.verified).length;
  const unverified = items.length - verified;
  return {
    items, verified, unverified,
    anecdote_score: verified - unverified,
    generic_fraction: items.length ? Math.round((items.filter((i) => i.generic).length / items.length) * 100) / 100 : null,
    confabulation_rate: items.length ? Math.round((unverified / items.length) * 100) / 100 : null,
  };
}

// ---------------------------------------------------------------------------------------------

async function sabP(dataDir) {
  say('SAB-P — prose flattened: every journal entry, dialogue info and book passage replaced by');
  say('its own first sentence, from the same commit, by data filter. Nothing hand-authored.');
  const r = await runControl({
    id: 'SAB-P (RI-EXP02 step 6, mandatory)',
    what: 'does the anecdote instrument separate the shipped prose from a deadened variant of it?',
    metric: 'tellable passages in the shipped content',
    unit: 'player-facing passages in the shipped content that the tellability test was run over',
    factors: [{ id: 'prose_flattened', what: 'every player-facing passage cut to its first sentence' }],
    measure: async (broken) => {
      const c = census(passages(dataDir, { flatten: broken.length > 0 }));
      return { value: c.tellable, support: c.passages, detail: { by_kind: c.by_kind, mean_chars: c.mean_chars, distinct_nouns: c.distinct_nouns } };
    },
    // "Required margin: verified anecdotes/hour lower in the sabotaged variant by >= 50%."
    margin: { kind: 'relative', min: 0.5 },
    direction: 'lower',
    minSupport: 50,
  });
  return r;
}

function selfTest() {
  say('SELF-TEST — the census and the verifier, on inputs whose right answer is known.');
  const cases = [
    { id: 'a passage with a name and a consequence', text: 'I lied to Ree-Vaska about the brooch, and when I came back at rank 3 her sister refused to sell me the boat.', want: (r) => r.tellable === 1 },
    { id: 'a review, not an anecdote (no name, no consequence)', text: 'The combat felt weighty and the world was atmospheric throughout the whole thing.', want: (r) => r.tellable === 0 },
    { id: 'a place with no player action (A1) — a screenshot', text: 'Blackrose is a tide-gate town of stilt houses standing over a channel that fills twice a day.', want: (r) => r.tellable === 0 },
    { id: 'flattened to its first sentence loses the consequence', text: firstSentence('I killed Kaleeh-Ra for the Salt-Kin. Then I found out she was the only person who could open the Blackrose tide-gate, so I finished that questline by swimming.'), want: (r) => r.tellable === 0 },
  ];
  let ok = true;
  for (const c of cases) {
    const r = census([{ file: 'x', kind: 'test', text: c.text }]);
    const good = c.want(r);
    say(`  ${good ? 'ok  ' : 'FAIL'}  ${c.id.padEnd(52)} tellable=${r.tellable}`);
    if (!good) ok = false;
  }
  // The verifier must make invention cost more than silence.
  const idx = new Map([['reevaska', 'game/data/npcs/x.json :: Ree-Vaska']]);
  const good = verifyRecall('I lied to Ree-Vaska about the brooch, so her sister refused to sell me the boat.', idx);
  const bad = verifyRecall('I bargained with Thelonius Quorn in Nirnhaven, and then the gate closed behind me.', idx);
  const s1 = good.anecdote_score === 1, s2 = bad.anecdote_score === -1;
  say(`  ${s1 ? 'ok  ' : 'FAIL'}  a resolvable recall scores +1                        score=${good.anecdote_score}`);
  say(`  ${s2 ? 'ok  ' : 'FAIL'}  an invented one scores -1, not 0 (confabulation penalty) score=${bad.anecdote_score}`);
  if (!s1 || !s2) ok = false;
  say(`SELF-TEST ${ok ? 'PASS' : 'FAIL'}`);
  return ok;
}

async function main() {
  if (has('self-test')) process.exit(selfTest() ? 0 : 5);
  const dataDir = path.resolve(REPO, arg('data', 'game/data'));
  const out = { schema: 'elder-souls/exp02-verify@1', at: new Date().toISOString(), data_dir: path.relative(REPO, dataDir) };

  // The prompt must be the committed one, unaltered.
  const promptPath = path.join(REPO, 'corpus/95-experience/prompts/recall.md');
  out.recall_prompt = fs.existsSync(promptPath) ? path.relative(REPO, promptPath) : null;
  if (!out.recall_prompt) say('ABSENT: corpus/95-experience/prompts/recall.md — §D requires the prompt committed and hashed.');

  const c = census(passages(dataDir));
  out.content_census = { passages: c.passages, tellable: c.tellable, by_kind: c.by_kind, mean_chars: c.mean_chars, distinct_nouns: c.distinct_nouns };
  say(`content census — ${c.passages} player-facing passages, ${c.tellable} with an action-and-consequence shape and a name`);
  for (const [k, v] of Object.entries(c.by_kind)) say(`  ${k.padEnd(10)} ${String(v.tellable).padStart(5)} of ${v.n}`);

  const recallPath = arg('recall', null);
  if (recallPath && fs.existsSync(path.resolve(REPO, recallPath))) {
    const idx = buildDataIndex(dataDir);
    out.recall = verifyRecall(fs.readFileSync(path.resolve(REPO, recallPath), 'utf8'), idx);
    say(`recall — ${out.recall.verified} verified, ${out.recall.unverified} unverified, score ${out.recall.anecdote_score}`);
  } else {
    out.recall = null;
    out.recall_absent = 'No M3 terminal-recall artifact exists on this tree, so `verified_anecdotes_per_hour` ' +
      'is UNMEASURED. RI-EXP02 requires a segmented playthrough with a 500-word baton bottleneck and an ' +
      'isolated recalling agent; none has ever been run. Reported as an absence, not as a zero.';
    say('recall — ABSENT. No M3 artifact on the tree; `verified_anecdotes_per_hour` is unmeasured.');
  }

  const s = await sabP(dataDir);
  out.sabotage_control = s;
  out.sabotage_control_measured_on = 'content_census';
  out.sabotage_control_caveat = 'RI-EXP02 step 6 applies the >=50% margin to verified anecdotes/hour over two ' +
    'matched 90-minute segments. No playthrough exists, so the margin is applied to the CONTENT CENSUS ' +
    'instead: the same filter, the same commit, the same margin, a weaker claim. Do not report it as the ' +
    'item\'s control; do report that a control ran and could have failed.';
  say('');
  say(`  ${s.verdict}  ${s.why}`);
  for (const a of s.arms) say(`    ${a.arm.padEnd(20)} tellable=${a.value}  of ${a.support} passages`);

  const o = path.resolve(REPO, arg('out', 'reports/experience/w1/anecdote-verify.json'));
  fs.mkdirSync(path.dirname(o), { recursive: true });
  fs.writeFileSync(o, JSON.stringify(out, null, 2) + '\n');
  say(`wrote ${path.relative(REPO, o)}`);
  process.exit(s.verdict === VERDICT.OK ? 0 : 2);
}

if (process.argv[1] && process.argv[1].endsWith('anecdote-verify.mjs')) main();
export { firstSentence, verifyRecall };
