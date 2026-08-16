// RI-MTH07 §B perturbation + NULL CONTROL for defect 1, run by the critic.
// Consumer: greetingFor(), game/src/character/converse.js. Entity-side observable: the line a
// named, live NPC speaks. Pre-fix greetings.json is read from git (43d26e6e^), NOT regenerated,
// so this does not depend on the generator or on HEAD carrying the leak.
import fs from 'node:fs';
import { greetingFor } from '/home/user/elder-souls-claude/game/src/character/converse.js';

const R = '/home/user/elder-souls-claude/';
const PRE = JSON.parse(fs.readFileSync('/tmp/claude-0/-home-user-elder-souls-claude/3c195166-6f14-54d0-bf0f-867f7b39d84b/scratchpad/greetings-prefix.json', 'utf8'));
const POST = JSON.parse(fs.readFileSync(R + 'game/data/dialogue/greetings.json', 'utf8'));

const npcDocs = ['game/data/npcs/mainline.json'];
const npcs = [];
for (const f of npcDocs) for (const n of (JSON.parse(fs.readFileSync(R + f, 'utf8')).npcs || [])) npcs.push(n);

function speak(g, npc, race, disp) {
  const out = new Set();
  for (let nth = 0; nth < 40; nth++) {
    const r = greetingFor({ greetings: g }, {
      npcId: npc.id, reactionGroup: npc.reaction_group,
      disposition: disp === undefined ? npc.disposition : disp,
      playerRace: race, nth,
    });
    if (r && r.line) out.add(r.line);
  }
  return [...out];
}
const leaky = ls => ls.filter(l => /say it in one line/i.test(l));

// ---- 1. every live NPC in RG-BWC, every player race class -------------------------------
const bwc = npcs.filter(n => n.reaction_group === 'RG-BWC');
console.log('live RG-BWC NPCs in mainline.json:', bwc.map(n => n.id + ' (' + n.name + ', disp ' + n.disposition + ')').join('; ') || 'NONE');
const RACES = ['saxhleel', 'naga', 'dunmer', 'imperial', 'breton'];
let preLeakLines = 0, postLeakLines = 0;
for (const n of bwc) for (const race of RACES) {
  const a = speak(PRE, n, race), b = speak(POST, n, race);
  preLeakLines += leaky(a).length; postLeakLines += leaky(b).length;
}
console.log('\nPERTURBATION (same consumer, same NPCs, only greetings.json swapped):');
console.log('  pre-fix  : distinct leaked lines reachable =', preLeakLines);
console.log('  post-fix : distinct leaked lines reachable =', postLeakLines);
console.log('  coupling = |0 - ' + preLeakLines + '| / |0 - ' + preLeakLines + '| =', preLeakLines ? (preLeakLines / preLeakLines).toFixed(2) : 'n/a');

// ---- 2. NULL CONTROL: a cell the fix must NOT touch -------------------------------------
console.log('\nNULL CONTROL A — an NPC in a different reaction group must be unchanged:');
const others = npcs.filter(n => n.reaction_group && n.reaction_group !== 'RG-BWC');
let changed = 0, checked = 0;
for (const n of others) for (const race of RACES) {
  const a = JSON.stringify(speak(PRE, n, race)), b = JSON.stringify(speak(POST, n, race));
  checked++; if (a !== b) { changed++; console.log('    CHANGED:', n.id, race); }
}
console.log('  ' + checked + ' (npc x race) cells outside RG-BWC checked; changed =', changed, changed === 0 ? '(clean)' : '(CONTAMINATION)');

console.log('\nNULL CONTROL B — RG-BWC outside the cold band must be unchanged:');
let cchanged = 0, cchecked = 0;
for (const n of bwc) for (const race of RACES) for (const disp of [5, 40, 60, 85]) {
  const a = JSON.stringify(speak(PRE, n, race, disp)), b = JSON.stringify(speak(POST, n, race, disp));
  cchecked++; if (a !== b) { cchanged++; console.log('    CHANGED at disposition', disp, n.id, race); }
}
console.log('  ' + cchecked + ' cells at dispositions 5/40/60/85 checked; changed =', cchanged, cchanged === 0 ? '(clean)' : '(leaked outside the band)');

console.log('\nPROBE IS DRIVING A LIVE CELL (not a stub) — the cold-band lines Corvus Aldeyn now speaks:');
const corvus = bwc.find(n => n.id === 'blackwood-company-factor') || bwc[0];
for (const l of speak(POST, corvus, 'saxhleel')) console.log('   ', JSON.stringify(l));
