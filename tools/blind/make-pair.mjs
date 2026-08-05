#!/usr/bin/env node
// make-pair.mjs — assemble a blind comparison pack (CORPUS-CONTRACT §6).
// Takes our artifact and a reference artifact, strips every label that could reveal which
// is which, writes them as A and B under a randomised-but-recorded mapping, and emits the
// judge prompt. The reveal key is written OUTSIDE the pack directory.
import fs from 'node:fs';
import path from 'node:path';
import {
  parseArgs, wantsHelp, usage, die, log, EXIT, ensureDir, writeJson, sha256, mulberry32, utcStamp,
} from '../lib/cli.mjs';

const USAGE = `
make-pair.mjs — build a blind A/B comparison pack.

USAGE
  node tools/blind/make-pair.mjs --ours <path> --ref <path> --out <dir> [options]

OPTIONS
  --ours <path>      Our artifact (image / jsonl trace / json / text)      (required)
  --ref <path>       The reference artifact to compare against            (required)
  --out <dir>        Pack directory to create                             (required)
  --reveal <dir>     Where to write the reveal key (default: <out>.reveal — never inside <out>)
  --seed <n>         Seed for the A/B assignment (default: time-derived, always recorded)
  --kind <k>         image | trace | json | text (default: inferred from extension)
  --question <text>  The single question the judge must answer
  --item <RI-id>     Reference item this pack serves, e.g. RI-VIS02
  --force            Overwrite an existing pack directory
  --help             This message

OUTPUT
  <out>/A.<ext>      artifact A, stripped
  <out>/B.<ext>      artifact B, stripped
  <out>/PROMPT.md    the judge prompt — hand exactly this to the judging agent
  <out>/pack.json    pack metadata WITHOUT the mapping (hashes, kind, question, seed id)
  <reveal>/mapping.json  which of A/B is ours — read ONLY after the pick is recorded

PROTOCOL
  1. Judge reads PROMPT.md, inspects A and B, writes its pick + reasoning to a file.
  2. Only then does anyone open <reveal>/mapping.json.
  3. The verdict records BOTH the blind pick and the reveal. Picking ours is a signal to
     distrust the critic (CORPUS-CONTRACT §6) and forces a re-examination.
`;

const args = parseArgs();
if (wantsHelp(args)) usage(USAGE);
if (!args.ours || !args.ref || !args.out) usage(USAGE, EXIT.USAGE);

const oursPath = path.resolve(String(args.ours));
const refPath = path.resolve(String(args.ref));
for (const [label, p] of [['--ours', oursPath], ['--ref', refPath]]) {
  if (!fs.existsSync(p)) {
    die(EXIT.MISSING_GAME, `${label} not found: ${p}\n` +
      '  Our side usually comes from a harness run (tools/harness/shoot.mjs or trace.mjs);\n' +
      '  the reference side comes from corpus/ (a reference image, trace or excerpt).');
  }
}

const outDir = path.resolve(String(args.out));
if (fs.existsSync(outDir) && fs.readdirSync(outDir).length && !args.force) {
  die(EXIT.USAGE, `pack directory ${outDir} already exists and is not empty (use --force)`);
}
const revealDir = args.reveal ? path.resolve(String(args.reveal)) : outDir + '.reveal';
if (revealDir.startsWith(outDir + path.sep) || revealDir === outDir) {
  die(EXIT.USAGE, 'the reveal key must NOT live inside the pack directory — that defeats the blind.');
}

const ext = path.extname(oursPath).toLowerCase();
const kind = String(args.kind || inferKind(ext));
function inferKind(e) {
  if (['.png', '.jpg', '.jpeg', '.webp'].includes(e)) return 'image';
  if (['.jsonl', '.ndjson'].includes(e)) return 'trace';
  if (e === '.json') return 'json';
  return 'text';
}

// ---------------------------------------------------------------- label stripping
const IDENTIFYING = /^(run_id|runId|scenario|scenario_path|scenario_title|path|file|url|build|git|commit|branch|tool|node|data|started_at|ended_at|computed_at|captured_at|source|label|name|title|author|origin|side|provenance)$/i;
const IDENTIFYING_TEXT = /\b(elder[- ]souls|our (game|build|implementation)|reference|morrowind|dark souls|elden ring|claude|wave \d+|run_id|commit [0-9a-f]{7,})\b/gi;

function stripJsonValue(v, depth = 0) {
  if (Array.isArray(v)) return v.map((x) => stripJsonValue(x, depth + 1));
  if (v && typeof v === 'object') {
    const o = {};
    for (const [k, val] of Object.entries(v)) { if (IDENTIFYING.test(k)) continue; o[k] = stripJsonValue(val, depth + 1); }
    return o;
  }
  return v;
}

async function strip(srcPath) {
  if (kind === 'image') {
    // Re-encode losslessly through pngjs: pixels identical, all text/metadata chunks dropped.
    if (path.extname(srcPath).toLowerCase() === '.png') {
      try {
        const { PNG } = await import('pngjs');
        const png = PNG.sync.read(fs.readFileSync(srcPath));
        const clean = new PNG({ width: png.width, height: png.height });
        png.data.copy(clean.data);
        return { buf: PNG.sync.write(clean), ext: '.png', notes: 'png re-encoded, metadata chunks dropped' };
      } catch (e) { log(`WARNING: png re-encode failed (${e.message}); copying bytes verbatim`); }
    }
    return { buf: fs.readFileSync(srcPath), ext: path.extname(srcPath), notes: 'copied verbatim' };
  }
  if (kind === 'trace') {
    const lines = fs.readFileSync(srcPath, 'utf8').split('\n').filter((l) => l.trim());
    const kept = [];
    for (const l of lines) {
      let r; try { r = JSON.parse(l); } catch { continue; }
      if (r._ === 'header' || r._ === 'footer') continue;   // headers name the run
      kept.push(JSON.stringify(stripJsonValue(r)));
    }
    return { buf: Buffer.from(kept.join('\n') + '\n'), ext: '.jsonl', notes: `header/footer removed, ${kept.length} records kept` };
  }
  if (kind === 'json') {
    const obj = JSON.parse(fs.readFileSync(srcPath, 'utf8'));
    return { buf: Buffer.from(JSON.stringify(stripJsonValue(obj), null, 2) + '\n'), ext: '.json', notes: 'identifying keys removed' };
  }
  const txt = fs.readFileSync(srcPath, 'utf8').replace(IDENTIFYING_TEXT, '[REDACTED]');
  return { buf: Buffer.from(txt), ext: path.extname(srcPath) || '.txt', notes: 'identifying phrases redacted' };
}

// ---------------------------------------------------------------- assignment
const seed = args.seed !== undefined ? Number(args.seed) : (Date.now() & 0x7fffffff);
const rnd = mulberry32(seed);
const oursIsA = rnd() < 0.5;

ensureDir(outDir); ensureDir(revealDir);
const oursStripped = await strip(oursPath);
const refStripped = await strip(refPath);
const aSrc = oursIsA ? oursStripped : refStripped;
const bSrc = oursIsA ? refStripped : oursStripped;
const aFile = path.join(outDir, 'A' + aSrc.ext);
const bFile = path.join(outDir, 'B' + bSrc.ext);
fs.writeFileSync(aFile, aSrc.buf);
fs.writeFileSync(bFile, bSrc.buf);

const question = String(args.question || defaultQuestion(kind));
function defaultQuestion(k) {
  switch (k) {
    case 'image': return 'Which image looks like a current-generation, commercially shipped 3D game, and which looks like a hobby WebGL demo? Answer with A or B and name the three specific visual properties that decided it.';
    case 'trace': return 'Which of these two combat traces reads like a Souls fight — committed attacks, telegraphed windups, stamina as a real constraint, distance being negotiated — and which reads like a naive chase-and-swing? Answer A or B and cite frame ranges.';
    case 'json': return 'Which of these two data sets reads like hand-authored Morrowind-grade content, and which reads like generated filler? Answer A or B and cite specific entries.';
    default: return 'Which of these two excerpts reads like it was written by a game writer for a shipped RPG, and which reads like placeholder text? Answer A or B and quote the lines that decided it.';
  }
}

const packId = `${utcStamp()}-${kind}`;
const pack = {
  schema: 'elder-souls/blind-pack@1',
  pack_id: packId,
  item: args.item || null,
  kind,
  question,
  created_at: new Date().toISOString(),
  files: {
    A: { file: path.basename(aFile), bytes: aSrc.buf.length, sha256: sha256(aSrc.buf), stripping: aSrc.notes },
    B: { file: path.basename(bFile), bytes: bSrc.buf.length, sha256: sha256(bSrc.buf), stripping: bSrc.notes },
  },
  reveal_key_location: 'NOT IN THIS DIRECTORY — held by the run operator',
  instructions: 'Read PROMPT.md. Record your pick and reasoning BEFORE anyone opens the reveal key.',
};
writeJson(path.join(outDir, 'pack.json'), pack);

writeJson(path.join(revealDir, 'mapping.json'), {
  schema: 'elder-souls/blind-reveal@1',
  pack_id: packId,
  item: args.item || null,
  seed,
  A: oursIsA ? 'ours' : 'reference',
  B: oursIsA ? 'reference' : 'ours',
  ours_source: oursPath,
  ref_source: refPath,
  ours_sha256: sha256(fs.readFileSync(oursPath)),
  ref_sha256: sha256(fs.readFileSync(refPath)),
  created_at: new Date().toISOString(),
});

const prompt = `# Blind comparison — pack ${packId}

You are judging two artifacts. You do **not** know which is which, and you must not try to
find out. One of them was produced by the project under review; the other is a reference.
Guessing based on file size, formatting quirks, or metadata is cheating — judge the content.

**Artifacts**
- \`A${aSrc.ext}\`
- \`B${bSrc.ext}\`

**Kind:** ${kind}
${args.item ? `**Reference item:** ${args.item}\n` : ''}
## The question

${question}

## How to answer

Write your answer to a file before anyone reveals the mapping. It must contain, in order:

1. \`PICK: A\` or \`PICK: B\` — one line, nothing else on it.
2. \`CONFIDENCE: high | medium | low\`
3. Three to six bullet points of **specific, checkable evidence** from the artifacts
   (pixel regions, frame numbers, quoted lines, field values). No general impressions.
4. \`WEAKEST POINT:\` one sentence naming the strongest argument *against* your own pick.

Do not hedge, do not decline, do not say the two are equivalent. If they genuinely look
equivalent, that is itself a finding — pick the one that is marginally better and say so.

## After the reveal

The operator reveals the mapping only after your answer is written. If your pick turns out
to be the project's own artifact, per CORPUS-CONTRACT §6 that is a signal to distrust this
judgement: re-examine both artifacts with a harsher lens and record the second pass too.
`;
fs.writeFileSync(path.join(outDir, 'PROMPT.md'), prompt);

log(`pack ${packId} written to ${outDir} (A=${aSrc.ext}, B=${bSrc.ext})`);
log(`reveal key: ${path.join(revealDir, 'mapping.json')} — do not open until the pick is recorded`);
process.stdout.write(outDir + '\n');
