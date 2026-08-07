// critic w1-17-act5, ad hoc: reproduce infoFor() over the SHIPPED converse.js and dialogue data
// (no browser — the SAME production functions the engine calls, executed directly in node).
import fs from 'node:fs';
import path from 'node:path';
import { buildTopicIndex, infoFor } from '/home/user/elder-souls-claude/game/src/character/converse.js';

const dir = '/home/user/elder-souls-claude/game/data/dialogue/topics';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));
const docs = files.map(f => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')));
const idx = buildTopicIndex(docs);

const npcsRaw = JSON.parse(fs.readFileSync('/home/user/elder-souls-claude/game/data/npcs/mainline.json', 'utf8'));
const npcs = npcsRaw.npcs || npcsRaw;
const ixtu = npcs.find(n => n.id === 'ixtu-meer');

// --- Part A: the entry-topic ("the-steward-of-the-count") stub-collision, over the piece's own
// documented signature set (main-quest-argument.json "derived_disposition_worked").
const SIGNATURES = [
  { race: 'saxhleel', upbringing: 'interior',    disposition: 74, label: 'interior-saxhleel' },
  { race: 'naga',     upbringing: 'interior',    disposition: 66, label: 'interior-naga' },
  { race: 'saxhleel', upbringing: 'lukiul',      disposition: 48, label: 'lukiul-saxhleel' },
  { race: 'khajiit',  upbringing: 'blackrose',   disposition: 36, label: 'blackrose-khajiit' },
  { race: 'nord',     upbringing: 'foreign-born',disposition: 30, label: 'foreign-born-nord' },
  { race: 'imperial', upbringing: 'foreign-born',disposition: 24, label: 'foreign-born-imperial' },
  { race: 'dunmer',   upbringing: 'interior',    disposition: 20, label: 'interior-dunmer' },
  { race: 'nord',     upbringing: 'lukiul',      disposition: 18, label: 'lukiul-nord' },
  { race: 'imperial', upbringing: 'lukiul',      disposition: 12, label: 'lukiul-imperial' },
  { race: 'dunmer',   upbringing: 'foreign-born',disposition: 6,  label: 'foreign-born-dunmer' },
  { race: 'dunmer',   upbringing: 'lukiul',      disposition: 0,  label: 'lukiul-dunmer' },
];

const partA = { topic: 'the-steward-of-the-count', note: "Q-MAIN-26's own opens_by.topic, the entry line of the whole Act V conversation. 50-mainline.json ALSO declares a topic with this exact id (a stub, d:20, no race filter, third-person: 'Ixtu-Meer. He has kept the Count...'). buildTopicIndex() merges same-id topic records across files (converse.js:79-82, by design), so infoFor() scores across BOTH files' infos together.", rows: [] };
for (const s of SIGNATURES) {
  const player = { race: s.race, upbringing: s.upbringing, disposition: s.disposition, knows: new Set() };
  const r = infoFor(idx, 'the-steward-of-the-count', ixtu, player);
  const isStub = !!(r && r.text.startsWith('Ixtu-Meer. He has kept the Count'));
  partA.rows.push({ signature: s.label, race: s.race, upbringing: s.upbringing, disposition: s.disposition, delivered: r ? r.text : null, from: isStub ? 'STUB (50-mainline.json, third-person, unauthored-for-this-scene)' : 'main-quest-argument.json (Ixtu-Meer, first-person, race-specific)' });
}
partA.affected = partA.rows.filter(r => r.from.startsWith('STUB')).map(r => r.signature);

// --- Part B: the actor-namespace leak. `a: "rootkeeper"` is shared by 25+ NPC records across
// the province (grep: game/data/npcs/*.json); two of them declare two of the twelve Act V topic
// ids in their OWN `topics` array and are currently unspawned (no settlement, no post.site).
const otherRootkeepers = ['keeper-ei-vashan', 'gallery-intake-keepers'];
const partB = { note: "actor:'rootkeeper' is not unique to ixtu-meer (confirmed: 25+ NPC records across game/data/npcs/*.json share it, per grep). These two share it AND carry an Act-V topic id in their own `topics` array. Neither has a settlement or post.site today (game/data/npcs/mainline.json), so populateSite()/populateSettlement() never spawns them — but game/data/quests/mainline-act5.json's own deceit.revealed_by names 'gallery-intake-keepers' as the talk_to_target source of rev_the_three_accounts, so the record is intended to be reachable, not decorative.", rows: [] };
for (const id of otherRootkeepers) {
  const npc = npcs.find(n => n.id === id);
  const row = { npc: id, name: npc.name, actor: npc.actor, disposition: npc.disposition, settlement: npc.settlement, post: npc.post || null, own_topics: npc.topics, delivers: {} };
  for (const t of npc.topics.filter(t => ['the sill', 'the opening of the count'].includes(t))) {
    const player = { race: npc.race, upbringing: 'interior', disposition: npc.disposition, knows: new Set() };
    const r = infoFor(idx, t, npc, player);
    row.delivers[t] = r ? r.text : null;
  }
  partB.rows.push(row);
}

const out = { generated_by: 'critic w1-17-act5, ad hoc node script executing the SHIPPED game/src/character/converse.js buildTopicIndex()/infoFor() against the SHIPPED game/data/dialogue/topics/**/*.json and game/data/npcs/mainline.json — the same functions and data the browser engine loads, run without a browser because of headless_shell contention (18-30 processes, loadavg 10-14 throughout this session, above the project cap of ~8)', partA, partB };
fs.writeFileSync('/home/user/elder-souls-claude/corpus/90-verdicts/wave1/artifacts/W1-17-act5-r1/converse-node-repro.json', JSON.stringify(out, null, 2));
console.log('Part A affected signatures:', partA.affected);
console.log('wrote converse-node-repro.json');
