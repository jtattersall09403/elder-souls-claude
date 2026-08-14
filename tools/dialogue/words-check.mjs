// WORDS-CHECK — does our dialogue have people in it, or one helpful narrator with many names?
//
//   node tools/dialogue/words-check.mjs                 # ours (game/data/dialogue)
//   node tools/dialogue/words-check.mjs --reference     # Morrowind, the positive control
//   node tools/dialogue/words-check.mjs --arm <file>    # an arbitrary arm (the null control)
//   node tools/dialogue/words-check.mjs --self-test     # all three; the instrument proves itself
//   node tools/dialogue/words-check.mjs --worst 25      # the 25 lines furthest outside the bar
//
// EXIT  0 pass · 1 one or more axes failed · 2 usage · 10 missing input · 3 self-test broke
//
// WHY THIS EXISTS, AND WHAT IT IS NOT.
//
// RULING W2 of the 2026-08-14 owner directives: *telling apart is not liking*. A check that
// asks "can a judge distinguish speaker A from speaker B?" measures GENERICNESS, and a corpus
// can be perfectly distinguishable and still be dead. So no axis here is a discrimination
// task. Every axis is an ABSOLUTE property of the writing, measured the same way on Morrowind
// and on us, and each one names a thing a *person* does that a *narrator* does not:
//
//   speakers disagree · somebody is rude to you · somebody wants something for themselves ·
//   the mouths have different rhythms · the sentences are spoken, not written.
//
// THE NULL CONTROL IS THE PLAUSIBLE WRONG ANSWER, NOT THE TRIVIAL ONE. An empty file fails
// everything by accident and proves nothing. The arm in
// `corpus/40-dialogue/data/one-voice-arm.json` is fluent, grammatical, on-topic, correctly
// spelled, factually consistent with our own setting, and pleasant to read — and every line
// of it is the same helpful narrator. It was hand-written for this instrument as the thing we
// are most likely to actually ship. If this check ever passes that file, it has stopped
// measuring voice and started measuring grammar, and `--self-test` is what says so.
//
// S51: the null arm is NOT generated from the tables the game's dialogue is built against
// (`dialogue/speakers.json` archetype bands, the topic graph, the tic regexes). It is prose
// written to a different specification — "answer the question, be helpful, be pleasant" — so
// the two arms do not converge as the game's dialogue gets more correct. They diverge.
'use strict';
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';
import zlib from 'node:zlib';

const HERE = path.dirname(url.fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');
const argv = process.argv.slice(2);
const has = (k) => argv.includes('--' + k);
const arg = (k, d) => { const i = argv.indexOf('--' + k); return i < 0 ? d : argv[i + 1]; };

// ---------------------------------------------------------------- text primitives
const TOK = /[A-Za-z']+/g;
const tok = (t) => (t.toLowerCase().match(TOK) || []);
const sents = (t) => t.replace(/\s+/g, ' ').trim().split(/(?<=[.!?])\s+/).filter((s) => TOK.test(s));

// Stance tiers. Deliberately the SAME regex families as corpus/80-methods/tone-metrics.py §B,
// so the two instruments cannot disagree about what "warm" means. Kept here rather than
// imported because that file is Python and this one gates a Node toolchain.
const W_PRAISE = [/\bwell done\b/i, /\bgood work\b/i, /\bimpressive\b/i, /\byou have earned\b/i,
  /\byou have proved\b/i, /\bcongratulations\b/i, /\b(i|we) (am|are) proud\b/i,
  /\byou are (a |the )?(hero|champion|saviou?r)/i, /\byou have my (respect|admiration)\b/i];
const W_THANKS = [/\bthank(s| you)\b/i, /\b(i am|i'm|we are|we're) grateful\b/i, /\bmy thanks\b/i,
  /\bbless(ings)? (on )?you\b/i, /\byou have my thanks\b/i];
const W_COURTESY = [/\bwelcome\b/i, /\bwhat can i do for you\b/i, /\bhow (can|may) i help\b/i,
  /\bmy friend\b/i, /\bglad (to see|you)/i, /\bgood to see you\b/i, /\bat your service\b/i,
  /\bplease(d)? to meet\b/i, /\bany time you (need|want)\b/i];
const C_DISMISS = [/\bleave me( alone)?\b/i, /\bi know nothing\b/i, /\bmake it quick\b/i,
  /\bgo away\b/i, /\bnot interested\b/i, /\bi have nothing (to say|for you)\b/i,
  /\bstate your business\b/i, /\bwhat do you want\b/i, /\bi haven'?t got time\b/i,
  /\bwas there something you actually wanted\b/i, /\bask (someone|somebody) else\b/i];
const C_CONTEMPT = [/\bget out of my sight\b/i, /\bn'wah\b/i, /\bfilthy\b/i, /\bfool\b/i,
  /\byou (are|'re) nothing\b/i, /\bdon'?t waste my time\b/i, /\bidiot\b/i, /\bwretch\b/i,
  /\byou people\b/i, /\byour kind\b/i, /\bouter\b.{0,12}\bdry-one\b/i, /\bstupid\b/i];
const C_THREAT = [/\bdon'?t come back\b/i, /\byou'?ll be sorry\b/i, /\bor be put down\b/i,
  /\bi will have you\b/i, /\bpay it in a cell\b/i, /\bthere is a price\b/i,
  /\bbefore i (will )?speak to you\b/i, /\bstand down\b/i];
const hitAny = (t, rs) => rs.some((r) => r.test(t));

// First-person STAKE: not merely the word "I", but the speaker asserting an interest,
// possession, opinion or refusal of their own. A narrator answers; a person wants.
const STAKE = [
  /\bi (want|need|owe|keep|paid|pay|sold|sell|lost|took|will not|won'?t|do not|don'?t|cannot|can'?t|refuse|swear|say|think|reckon|hate|like|mind|remember|told|asked|charge|am not|'?m not)\b/i,
  /\bmy (own|share|coin|money|name|price|word|business|trade|house|people|fault|line|debt|boat|net|desk|well)\b/i,
  /\bour (own|share|coin|price|people|law|water|dead|business|debt)\b/i,
  /\b(mine|ours)\b/i,
  /\bwe (do not|don'?t|will not|won'?t|keep|owe|pay|take|charge)\b/i,
];

// A judgement aimed at a third party: prejudice, snobbery, grievance, partisanship.
// Morrowind's people are provincial about each other; a narrator is even-handed.
const PARTISAN = [/\b(they|those|that lot|his sort|her sort|their sort)\b[^.?!]{0,60}\b(never|always|won'?t|can'?t|don'?t|lie|liars?|steal|thieves|cheat|greedy|lazy|soft|mad|fools?)\b/i,
  /\b(outlander|provincial|dry-one|outsider|foreigner|mainlander)s?\b/i,
  /\bthe (empire|office|temple|house|cohort|guild)[^.?!]{0,50}\b(never|won'?t|does not|doesn'?t|cares? nothing|took|takes)\b/i,
  /\b(i|we) (do not|don'?t) (trust|deal with|talk to|serve)\b/i,
  /\b(no better than|nothing but|little more than)\b/i,
  /\b(they say|people say|so they claim|if you believe)\b/i];

// ---------------------------------------------------------------- corpora
function loadOurs(root) {
  const dir = path.resolve(ROOT, root);
  if (!fs.existsSync(dir)) { console.error('missing ' + dir); process.exit(10); }
  const rows = [];
  const files = [];
  (function walkDir(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walkDir(p); else if (e.name.endsWith('.json')) files.push(p);
    }
  })(dir);
  for (const f of files.sort()) {
    let doc; try { doc = JSON.parse(fs.readFileSync(f, 'utf8')); } catch { continue; }
    const rel = path.relative(ROOT, f);
    (function walk(n, topic) {
      if (Array.isArray(n)) { for (const v of n) walk(v, topic); return; }
      if (!n || typeof n !== 'object') return;
      const here = (n.infos || n.greetings) && typeof n.id === 'string' ? n.id : topic;
      if (typeof n.x === 'string' && n.x.trim().split(/\s+/).length >= 4) {
        rows.push({ file: rel, topic: here || n.topic || null, speaker: n.a || null, text: n.x });
      }
      for (const [k, v] of Object.entries(n)) if (k !== 'x') walk(v, here);
    })(doc, null);
  }
  return rows;
}

function loadArm(p) {
  const f = path.resolve(ROOT, p);
  if (!fs.existsSync(f)) { console.error('missing ' + f); process.exit(10); }
  const d = JSON.parse(fs.readFileSync(f, 'utf8'));
  const rows = [];
  for (const t of d.topics || []) for (const i of t.infos || [])
    rows.push({ file: p, topic: t.id, speaker: i.a || null, text: i.x });
  return rows;
}

function loadReference() {
  const f = path.join(ROOT, 'corpus/40-dialogue/data/morrowind-dialogue.csv.gz');
  if (!fs.existsSync(f)) { console.error('missing ' + f); process.exit(10); }
  const csv = zlib.gunzipSync(fs.readFileSync(f)).toString('utf8');
  // minimal RFC4180 parse
  const rows = []; let row = [], cur = '', q = false;
  for (let i = 0; i < csv.length; i++) {
    const c = csv[i];
    if (q) { if (c === '"') { if (csv[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c; }
    else if (c === '"') q = true;
    else if (c === ',') { row.push(cur); cur = ''; }
    else if (c === '\n') { row.push(cur); rows.push(row); row = []; cur = ''; }
    else if (c !== '\r') cur += c;
  }
  if (cur || row.length) { row.push(cur); rows.push(row); }
  const head = rows.shift().map((h) => h.replace(/^﻿|"/g, ''));
  const iS = head.indexOf('SpeakerId'), iT = head.indexOf('DialogueText');
  return rows.filter((r) => r[iT] && r[iT].trim())
    .map((r) => ({ file: 'morrowind', topic: null, speaker: r[iS] || null, text: r[iT] }));
}

// ---------------------------------------------------------------- axes
function dedupe(rows) {
  const seen = new Set(); const out = [];
  for (const r of rows) { if (seen.has(r.text)) continue; seen.add(r.text); out.push(r); }
  return out;
}

function rhythm(texts) {
  const SL = []; let W = 0;
  for (const t of texts) { W += tok(t).length; for (const s of sents(t)) SL.push(tok(s).length); }
  if (!SL.length) return null;
  const mean = SL.reduce((a, b) => a + b, 0) / SL.length;
  return { words: W, wps: mean, short: SL.filter((x) => x <= 6).length / SL.length,
    long30: SL.filter((x) => x > 30).length / SL.length, sents: SL.length };
}

const CONTENT_STOP = new Set(('a an the and or but if of to in on at for with from by is are was were be been being it its this that these those there here you your yours i my me we our us they them their he she his her not no do does did have has had will would can could shall should may might must as so than then when what which who whom whose how why all any some one two three no nor s t re ve ll d m').split(' '));
function contentSet(t) { return new Set(tok(t).filter((w) => w.length > 2 && !CONTENT_STOP.has(w))); }
function jaccard(a, b) { let i = 0; for (const x of a) if (b.has(x)) i++; const u = a.size + b.size - i; return u ? i / u : 1; }

function measure(rows, label) {
  const R = dedupe(rows);
  const texts = R.map((r) => r.text);
  const rh = rhythm(texts);

  // A1 — rhythm spread across mouths (RI-DLG06's §B separation rule, applied to whoever the
  // corpus calls a speaker: our `a` archetypes, Morrowind's SpeakerId).
  const byS = new Map();
  for (const r of R) { if (!r.speaker) continue; if (!byS.has(r.speaker)) byS.set(r.speaker, []); byS.get(r.speaker).push(r.text); }
  const fps = [...byS.entries()].map(([s, ts]) => ({ s, ...rhythm(ts) })).filter((f) => f.words >= 400)
    .sort((a, b) => b.wps - a.wps);
  const spread = fps.length >= 2 ? fps[0].wps - fps[fps.length - 1].wps : 0;

  // A2/A3 — stance. Warmth must be earned by a marker; friction likewise.
  let warm = 0, cold = 0;
  for (const t of texts) {
    const w = hitAny(t, W_PRAISE) || hitAny(t, W_THANKS) || hitAny(t, W_COURTESY);
    const c = hitAny(t, C_DISMISS) || hitAny(t, C_CONTEMPT) || hitAny(t, C_THREAT);
    if (w && !c) warm++; else if (c && !w) cold++;
  }

  // A4 — disagreement. Only meaningful where a corpus records WHICH TOPIC a line answers.
  // The vendored Morrowind CSV carries no topic column, so this axis is scored on arms that
  // have one and reported as `n/a` on the reference. That absence is stated, not papered over.
  let multi = 0, disagreeing = 0; const agreeing = [];
  const byT = new Map();
  for (const r of R) { if (!r.topic) continue; if (!byT.has(r.topic)) byT.set(r.topic, []); byT.get(r.topic).push(r); }
  for (const [t, list] of byT) {
    const spk = new Set(list.map((r) => r.speaker || '_'));
    if (list.length < 2 || spk.size < 2) continue;
    multi++;
    let any = false;
    for (let i = 0; i < list.length && !any; i++) for (let j = i + 1; j < list.length; j++) {
      if ((list[i].speaker || '_') === (list[j].speaker || '_')) continue;
      const A = contentSet(list[i].text), B = contentSet(list[j].text);
      // materially different = the two answers barely share subject matter (different CONTENT,
      // not different wording) AND at least one of them is somebody's own position rather than
      // a neutral report. Two neutral paraphrases of one fact score high jaccard; two neutral
      // reports of two different facts score low jaccard but no stake, and are not disagreement
      // — they are a division of labour. Both halves are required.
      const stake = hitAny(list[i].text, STAKE) || hitAny(list[j].text, STAKE)
        || hitAny(list[i].text, PARTISAN) || hitAny(list[j].text, PARTISAN);
      if (jaccard(A, B) <= 0.20 && stake) { any = true; break; }
    }
    if (any) disagreeing++; else agreeing.push(t);
  }

  // A5 — somebody wants something. A6 — somebody has a prejudice.
  const stakeRate = texts.filter((t) => hitAny(t, STAKE)).length / texts.length;
  const partisanRate = texts.filter((t) => hitAny(t, PARTISAN)).length / texts.length;

  // A7 — spoken, not written. Contractions and second person are the two cheapest signals
  // that a line is speech; RI-DLG08 T13/T14 give Morrowind's rates and a floor under both.
  const allW = texts.join(' ');
  const nW = tok(allW).length;
  const contr = (allW.match(/\b\w+'(s|t|re|ve|ll|d|m)\b/gi) || []).length / nW * 1000;
  const second = (allW.match(/\b(you|your|yours|yourself)\b/gi) || []).length / nW * 1000;

  return { label, texts: R.length, words: rh.words, wps: rh.wps, short: rh.short,
    long30: rh.long30, speakers: fps.length, spread, fps,
    warm: warm / texts.length, cold: cold / texts.length,
    multiTopics: multi, disagreeing, disagreeRate: multi ? disagreeing / multi : null,
    agreeingTopics: agreeing, stakeRate, partisanRate, contr, second, rows: R };
}

// ---------------------------------------------------------------- the bar
// Every threshold is anchored on a MEASURED Morrowind figure or on a corpus item that quotes
// one. The `mw` column is what the reference arm actually scores when this file is run with
// --reference, and --self-test asserts the reference passes: a bar Morrowind fails is a wrong
// bar (RI-DLG08 §E), and this instrument would rather fail itself than mis-grade the game.
const AXES = [
  { id: 'A1', name: 'rhythm spread across mouths (max-min w/sent)', get: (m) => m.spread,
    cmp: '>=', bar: 8.0, src: 'RI-DLG06 §B "Global spread"; Morrowind class spread 11.9' },
  { id: 'A2', name: 'friction — share of lines that are cold', get: (m) => m.cold,
    cmp: '>=', bar: 0.030, src: 'RI-DLG08 I3; Morrowind cold_rate 0.0489' },
  { id: 'A3', name: 'warmth — share of lines that are warm', get: (m) => m.warm,
    cmp: '>=', bar: 0.050, src: 'RI-DLG08 I2 floor; Morrowind warm_rate 0.1254' },
  { id: 'A4', name: 'disagreement — multi-speaker topics with a materially different pair',
    get: (m) => m.disagreeRate, cmp: '>=', bar: 0.60, optional: true,
    src: 'RI-DLG07 category 4 ("≥3 must be different answers to the same topic")' },
  { id: 'A5', name: 'stake — lines where the speaker wants/keeps/refuses something',
    get: (m) => m.stakeRate, cmp: '>=', bar: 0.18, src: 'measured on the reference arm' },
  { id: 'A6', name: 'partisanship — lines carrying a judgement of somebody else',
    get: (m) => m.partisanRate, cmp: '>=', bar: 0.045, src: 'measured on the reference arm' },
  { id: 'A7', name: 'speech — contractions per 1k words', get: (m) => m.contr,
    cmp: '>=', bar: 20.0, src: 'RI-DLG08 T13 band 20-50; Morrowind 35.05' },
  { id: 'A8', name: 'speech — second-person tokens per 1k words', get: (m) => m.second,
    cmp: '>=', bar: 30.0, src: 'RI-DLG08 T14 band 38-65; Morrowind 52.69 (floor relaxed to 30)' },
  { id: 'A9', name: 'control — sentences over 30 words', get: (m) => m.long30,
    cmp: '<=', bar: 0.020, src: 'RI-DLG08 T7 band 0.2-2.0%; Morrowind 0.59%' },
];

function score(m) {
  const out = [];
  for (const a of AXES) {
    const v = a.get(m);
    if (v === null || v === undefined) { out.push({ ...a, v: null, pass: null }); continue; }
    out.push({ ...a, v, pass: a.cmp === '>=' ? v >= a.bar : v <= a.bar });
  }
  return out;
}

function report(m, quiet) {
  const S = score(m);
  if (!quiet) {
    console.log(`\n== ${m.label} ==`);
    console.log(`  ${m.texts} distinct texts · ${m.words} words · ${m.speakers} mouths with >=400 words`);
    console.log(`  w/sent ${m.wps.toFixed(2)} · <=6w ${(m.short * 100).toFixed(1)}% · >30w ${(m.long30 * 100).toFixed(2)}%`);
    if (m.multiTopics) console.log(`  multi-speaker topics ${m.multiTopics} · with a materially different pair ${m.disagreeing}`);
    console.log('');
    for (const s of S) {
      const mark = s.pass === null ? 'n/a ' : s.pass ? ' ok ' : 'FAIL';
      const val = s.v === null ? '   —  ' : (s.v < 1 ? s.v.toFixed(4) : s.v.toFixed(2)).padStart(7);
      console.log(`  ${mark} ${s.id} ${val} ${s.cmp} ${s.bar}   ${s.name}`);
    }
    const top = m.fps.slice(0, 3), bot = m.fps.slice(-3);
    if (m.fps.length >= 2) console.log(`\n  longest mouths: ${top.map((f) => `${f.s} ${f.wps.toFixed(1)}`).join(' · ')}`
      + `\n  shortest mouths: ${bot.map((f) => `${f.s} ${f.wps.toFixed(1)}`).join(' · ')}`);
  }
  const failed = S.filter((s) => s.pass === false && !s.optional);
  const failedOpt = S.filter((s) => s.pass === false && s.optional);
  if (!quiet) console.log(`\n  ${failed.length} required axis/axes failed`
    + (failedOpt.length ? `, ${failedOpt.length} advisory` : '') + `\n`);
  return { S, failed: failed.length, failedAll: failed.length + failedOpt.length };
}

// ---------------------------------------------------------------- main
if (has('worst')) {
  const n = parseInt(arg('worst', '25'), 10);
  const m = measure(loadOurs('game/data/dialogue'), 'ours');
  const scored = m.rows.map((r) => {
    const SL = sents(r.text).map((s) => tok(s).length);
    const worst = Math.max(0, ...SL);
    const w = hitAny(r.text, W_PRAISE) || hitAny(r.text, W_THANKS) || hitAny(r.text, W_COURTESY);
    const c = hitAny(r.text, C_DISMISS) || hitAny(r.text, C_CONTEMPT) || hitAny(r.text, C_THREAT);
    return { ...r, worst, flat: !w && !c, stake: hitAny(r.text, STAKE),
      pen: worst + (!w && !c ? 8 : 0) + (hitAny(r.text, STAKE) ? 0 : 6) + (/\b(you|your)\b/i.test(r.text) ? 0 : 5) };
  }).sort((a, b) => b.pen - a.pen).slice(0, n);
  for (const r of scored) console.log(`[${r.pen}] ${r.file} :: ${r.topic} :: ${r.speaker}\n    ${r.text}\n`);
  process.exit(0);
}

if (has('self-test')) {
  // The instrument proving itself. Three arms, three predictions written before the run.
  //   POSITIVE  Morrowind must PASS every non-advisory axis it can be scored on.
  //   NULL      the one-voice arm must FAIL, and specifically on A1/A2/A4/A5/A6 — the
  //             voice axes — while its grammar, spelling and on-topic-ness are beyond reproach.
  //   OURS      reported, not asserted; this is the thing under test.
  const ref = measure(loadReference(), 'MORROWIND (positive control)');
  const rr = report(ref);
  const nul = measure(loadArm('corpus/40-dialogue/data/one-voice-arm.json'), 'ONE-VOICE ARM (null control — the plausible wrong answer)');
  const nr = report(nul);
  const our = measure(loadOurs('game/data/dialogue'), 'OURS (game/data/dialogue)');
  const orr = report(our);

  let bad = 0;
  const say = (ok, msg) => { console.log(`  ${ok ? 'ok  ' : 'BROKEN'} ${msg}`); if (!ok) bad++; };
  console.log('== SELF-TEST ==');
  say(rr.failed === 0, `the reference passes every required axis (a bar Morrowind fails is a wrong bar) — ${rr.failed} failed`);
  say(nr.failed >= 3, `the null control fails (>=3 required axes) — ${nr.failed} failed`);
  const nulFailIds = nr.S.filter((s) => s.pass === false).map((s) => s.id);
  say(['A1', 'A2', 'A4', 'A5', 'A6'].filter((x) => nulFailIds.includes(x)).length >= 3,
    `the null control fails on the VOICE axes specifically — failed ${nulFailIds.join(',') || 'none'}`);
  // and it must fail for the right reason: it is not failing because it is short, empty or
  // ungrammatical. Assert it is a real, fluent corpus first.
  say(nul.words >= 1500, `the null control is a real corpus, not an empty file — ${nul.words} words`);
  say(nul.wps >= 7 && nul.wps <= 20, `the null control writes ordinary sentences — w/sent ${nul.wps.toFixed(2)}`);
  say(nul.multiTopics >= 15, `the null control answers the same topics we do, from several mouths — ${nul.multiTopics} multi-speaker topics`);
  console.log(bad ? `\n  SELF-TEST BROKEN (${bad})\n` : '\n  self-test ok\n');
  process.exit(bad ? 3 : 0);
}

const rows = has('reference') ? loadReference()
  : arg('arm') ? loadArm(arg('arm'))
    : loadOurs(arg('ours', 'game/data/dialogue'));
const label = has('reference') ? 'MORROWIND (reference)' : arg('arm') ? `ARM ${arg('arm')}` : `OURS (${arg('ours', 'game/data/dialogue')})`;
const m = measure(rows, label);
const r = report(m);
if (arg('json')) fs.writeFileSync(path.resolve(ROOT, arg('json')),
  JSON.stringify({ label, at: new Date().toISOString(),
    metrics: Object.fromEntries(Object.entries(m).filter(([k]) => !['rows', 'fps', 'agreeingTopics'].includes(k))),
    fingerprints: m.fps, axes: r.S.map(({ id, name, v, bar, cmp, pass, src }) => ({ id, name, v, bar, cmp, pass, src })),
    topics_where_everybody_agrees: m.agreeingTopics }, null, 2));
process.exit(r.failed ? 1 : 0);
