#!/usr/bin/env node
// w1-17-r2-deletefix.mjs — RULES 6, run as a 2x2, with the control arm watched going red.
//
//   node tools/dialogue/w1-17-r2-deletefix.mjs
//
// W1-17 round 2 shipped TWO independent changes against one number (infos no player can hear
// from any speaker, measured by tools/dialogue/critic-reach.mjs):
//
//   BODIES   game/data/npcs/pop-trades.json — 22 NPC records, giving the archivist / mudborn /
//            sapcutter / fisher / clerk registers a speaker in the towns their lines are gated to,
//            and giving the `magister` archetype the one officer the corpus names.
//   REHOME   tools/dialogue/rehome-actors.mjs --write — 20 infos whose `a` named a JOB (`notary`,
//            `scribe`, `dockhand`, `harbourmistress`, `smuggler`, `walker`, `vakh-speaker`) or an
//            invalid `cell` (`rootlands`, which is not one of the eight settlements).
//
// Rule 6 names three shapes and says to declare which one you have, so this runs all four cells
// rather than the one that flatters the result:
//
//     +-------------------+--------------------+
//     |  bodies OFF       |  bodies ON         |
//     +---------+-------------------+--------------------+
//     | rehome  |   A  (baseline)   |   B                |
//     |  OFF    |                   |                    |
//     +---------+-------------------+--------------------+
//     | rehome  |   C               |   D  (shipped)     |
//     |  ON     |                   |                    |
//     +---------+-------------------+--------------------+
//
// If A == D the fix is inert. If B == A and C == A but D < A, the two changes are TWO GUARDS FOR
// ONE DEFECT and must be reported as such rather than as an inert fix. If B < A and C < A and
// D < min(B, C), they are independent and additive, which is what the triage predicts: the bodies
// close the (actor, town) and `magister` buckets, the re-homes close the job-named-actor and
// invalid-cell buckets, and the two buckets are disjoint.
//
// THE CONTROL IS WATCHED GOING RED. Cell A is the teardown, and a teardown nobody has seen fail
// is not evidence (RULES 6, W1-04's wall-collision control). This tool asserts that cell A
// reproduces the round-1 critic's population of dead infos and EXITS NON-ZERO if the teardown
// changes nothing — i.e. if removing both changes leaves the number where the shipped tree left
// it, the experiment is reported as broken rather than as a pass.
//
// EVERY CELL IS MEASURED WITH THE SAME INSTRUMENT, at the same commit, including the memo-key
// repair this round made to critic-reach.mjs itself. The round-1 figure of 133 was taken with a
// critic-reach whose memoisation was keyed on candidate index lists shared across all topics; the
// `before` printed here is re-taken with the corrected tool so that the two ends of the comparison
// are the same ruler (RULES 12).
'use strict';
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';
import { execFileSync } from 'node:child_process';

const HERE = path.dirname(url.fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');
const NPCS = path.join(ROOT, 'game/data/npcs/pop-trades.json');
const PARKED = path.join(ROOT, 'game/data/npcs/.pop-trades.parked');

function reach() {
  const out = execFileSync('node', [path.join(HERE, 'critic-reach.mjs')], { cwd: ROOT, encoding: 'utf8', env: { ...process.env }, stdio: ['ignore', 'pipe', 'pipe'] });
  const m = out.match(/INFOS NO PLAYER CAN EVER HEAR FROM ANY SPEAKER:\s+(\d+)/);
  const causes = {};
  for (const line of out.split('\n')) {
    const c = line.match(/^\s+(\d+)\s\s(no such actor.*|no \w+ stands.*|always outscored.*|no speaker.*)$/);
    if (c) causes[c[2].replace(/ —.*/, '')] = Number(c[1]);
  }
  return { dead: Number(m[1]), causes };
}
function reachSafe() { try { return reach(); } catch (e) { const o = (e.stdout || '') + ''; const m = o.match(/HEAR FROM ANY SPEAKER:\s+(\d+)/); if (!m) throw e; const causes = {}; for (const line of o.split('\n')) { const c = line.match(/^\s+(\d+)\s\s(no such actor.*|no \w+ stands.*|always outscored.*|no speaker.*)$/); if (c) causes[c[2].replace(/ —.*/, '')] = Number(c[1]); } return { dead: Number(m[1]), causes }; } }

const bodies = (on) => {
  if (on && fs.existsSync(PARKED)) fs.renameSync(PARKED, NPCS);
  if (!on && fs.existsSync(NPCS)) fs.renameSync(NPCS, PARKED);
};
// `--write` verifies that every re-homed line is actually SPOKEN by its named speaker and exits
// non-zero when it is not. In cell C (re-homes on, bodies off) three rows name
// `gideon-archivist-assize`, who only exists when the bodies are in — so a non-zero exit there is
// the experiment working, not the harness breaking. It is captured and reported.
const rehome = (on) => {
  try {
    execFileSync('node', [path.join(HERE, 'rehome-actors.mjs'), on ? '--write' : '--revert'], { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    return null;
  } catch (e) {
    const lines = String(e.stderr || '').split('\n').filter((l) => /never says it|is not in game\/data\/npcs/.test(l));
    return lines.length ? lines.map((l) => l.trim()) : ['(rehome exited non-zero)'];
  }
};

const cells = {};
try {
  for (const [name, b, r] of [['A_neither', false, false], ['B_bodies_only', true, false], ['C_rehome_only', false, true], ['D_shipped', true, true]]) {
    bodies(b);
    const unspoken = rehome(r);
    cells[name] = { ...reachSafe(), unspoken };
    console.log(`${name.padEnd(16)} bodies=${b ? 'ON ' : 'off'} rehome=${r ? 'ON ' : 'off'}   dead = ${String(cells[name].dead).padStart(4)}${unspoken ? `   (+${unspoken.length} re-homed line(s) with no speaker)` : ''}`);
  }
} finally {
  bodies(true); rehome(true);   // always leave the tree in the shipped state
}

console.log('\nby cause, per cell:');
for (const [k, v] of Object.entries(cells)) console.log(`  ${k.padEnd(16)} ${JSON.stringify(v.causes)}`);

const A = cells.A_neither.dead, B = cells.B_bodies_only.dead, C = cells.C_rehome_only.dead, D = cells.D_shipped.dead;
console.log(`\nBEFORE (both changes removed, corrected instrument): ${A}`);
console.log(`AFTER  (shipped):                                    ${D}`);

let verdict, code = 0;
if (A === D) { verdict = 'INERT FIX — the teardown changed nothing. The number was being carried by something else.'; code = 1; }
else if (B === A && C === A) verdict = 'TWO GUARDS FOR ONE DEFECT — neither change moves the number alone; only both together do. Reported as such, per RULES 6.';
else if (B < A && C < A && D < Math.min(B, C)) verdict = 'TWO INDEPENDENT, ADDITIVE FIXES — each moves the number alone and together they move it further. The buckets they close are disjoint.';
else verdict = 'PARTIALLY OVERLAPPING — each change moves the number, but not additively; see the per-cause table.';
console.log(`\nVERDICT: ${verdict}`);

// The control arm must be seen to fail. A teardown that leaves the shipped number in place is
// not a negative result, it is a broken experiment.
if (A <= D) { console.error('\nCONTROL ARM DID NOT GO RED: removing both changes did not raise the dead count. Refusing to report this as evidence.'); code = 1; }
else console.log(`CONTROL ARM WENT RED: ${A} dead with the changes removed, ${D} with them in. The teardown is real.`);

fs.mkdirSync(path.join(ROOT, 'reports/w1-17-r2'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'reports/w1-17-r2/deletefix.json'), JSON.stringify({ tool: 'tools/dialogue/critic-reach.mjs (memo key corrected this round)', cells, before: A, after: D, verdict }, null, 2) + '\n');
process.exit(code);
