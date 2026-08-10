// S43's W1-15-owned QST05 seam: enumerate canonical prerequisite references without
// rerunning W1-18's quest population. This is a capability/consumer ledger, not a QST05 score.
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(new URL('../..', import.meta.url).pathname);
const control = process.argv.includes('--control');
const outArg = process.argv.indexOf('--json');
const outPath = outArg >= 0 ? process.argv[outArg + 1] : null;
const dir = path.join(ROOT, 'game/data/quests');
const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json')).sort();

const capabilities = {
  sneak: {
    item: 'RI-STL01', producer: 'game/src/sim/stealth/system.js',
    consumer: control ? null : 'game/src/sim/quest/gate.js', action: 'crouch + world perception',
  },
  theft: {
    item: 'RI-STL02', producer: 'game/src/engine.js',
    consumer: control ? null : 'game/src/sim/stealth/theft.js', action: 'takeObject',
  },
  crime: {
    item: 'RI-CRM01', producer: 'game/src/sim/crime/state.js',
    consumer: control ? null : 'game/src/sim/stealth/system.js', action: 'crime report chain',
  },
};

const refs = [];
function walk(value, keys, file, questId) {
  if (Array.isArray(value)) return value.forEach((v, i) => walk(v, [...keys, i], file, questId));
  if (!value || typeof value !== 'object') return;
  const qid = value.id && keys.length === 1 && keys[0] === 'quests' ? value.id : questId;
  for (const [key, child] of Object.entries(value)) {
    const p = [...keys, key];
    if (key === 'sneak' && keys.at(-1) === 'skills') refs.push({ file, quest: qid, path: p.join('.'), capability: 'sneak', value: child });
    if (key === 'task_kind' && (child === 'theft' || child === 'crime')) refs.push({ file, quest: qid, path: p.join('.'), capability: child, value: child });
    walk(child, p, file, qid);
  }
}
for (const file of files) {
  const doc = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
  for (const quest of doc.quests || []) walk(quest, ['quests'], file, quest.id);
}

const rows = refs.map((r) => ({ ...r, ...capabilities[r.capability] }));
const missing = rows.filter((r) => !r.producer || !r.consumer || !fs.existsSync(path.join(ROOT, r.producer)) || !fs.existsSync(path.join(ROOT, r.consumer)));
const result = { schema: 'elder-souls/w1-15-prerequisite-ledger@1', quest_files: files.length,
  references: rows.length, rows, missing_or_coupling_zero: missing, qst05_score: 'NOT_RUN' };
if (outPath) {
  const abs = path.resolve(ROOT, outPath); fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, JSON.stringify(result, null, 2) + '\n');
}
console.log(`W1-15 prerequisite ledger: ${files.length} canonical files, ${rows.length} references, ${missing.length} missing/coupling-zero; QST05 NOT_RUN.`);
if (control && missing.length === 0) throw new Error('inert control: deleting every consumer did not make the ledger red');
process.exit(missing.length ? 1 : 0);
