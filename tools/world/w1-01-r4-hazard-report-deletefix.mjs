#!/usr/bin/env node
/**
 * w1-01-r4-hazard-report-deletefix.mjs — DELETE-THE-FIX for the sticky `row.fired`.
 *
 * THE FIX. `game/src/sim/hazards.js` computed the hazard report's `row.fired` from
 * `this.active.get(id)`. A TRAP or a KILL is *deleted* from `active` on the same frame it fires —
 * `if (h.class === 'TRAP' || h.class === 'KILL') { this.active.delete(h.id); this.spent.add(h.id); }`
 * — so from that frame onward the world's own report said `fired: false` about a hazard that had
 * just taken 99.2 HP off the body. Six of the nineteen shipped hazards are TRAP or KILL. Round 4
 * added a `history` map and `row.fired` now means "has this gone off on this body".
 *
 * RULES.md rule 6 wants the fix removed on a copy and the OLD number to come back, and then the
 * two arms checked for actually differing. That is what this does, offline, in bare node against
 * the same module the browser loads: it stands a body inside a TRAP volume, steps it past the
 * telegraph, and reads `row.fired` twice — once through the shipped class, once through a copy of
 * the class with the `history` lookup taken back out.
 *
 * Rule 17: it also checks the GIT INDEX, not just the working file, because a neighbour's
 * `git add -A` has staged a temporary deletion here before now.
 *
 * Usage: node tools/world/w1-01-r4-hazard-report-deletefix.mjs [--out reports/w1-01-r4/hazard-report-deletefix.json]
 */
import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import { WorldField } from '../../game/src/world/field.js';
import { SignatureField } from '../../game/src/world/signature.js';

globalThis.atob = globalThis.atob || ((s) => Buffer.from(s, 'base64').toString('binary'));
const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(join(HERE, '..', '..'));
const rd = (p) => JSON.parse(readFileSync(join(ROOT, p), 'utf8'));
const argv = process.argv.slice(2);
const OUT = argv.includes('--out') ? argv[argv.indexOf('--out') + 1] : 'reports/w1-01-r4/hazard-report-deletefix.json';

const SRC = 'game/src/sim/hazards.js';
const shippedSrc = readFileSync(join(ROOT, SRC), 'utf8');

// ---- rule 17: what does the INDEX hold, not just the file ---------------------------------------
const git = (() => {
  try {
    const q = (c) => execSync(c, { cwd: ROOT }).toString();
    const staged = q(`git show :${SRC}`);
    return {
      commit: q('git rev-parse HEAD').trim(), branch: q('git rev-parse --abbrev-ref HEAD').trim(),
      worktree_has_fix: /this\.history/.test(shippedSrc),
      index_has_fix: /this\.history/.test(staged),
      worktree_matches_index: staged === shippedSrc,
    };
  } catch (e) { return { error: String(e.message || e).slice(0, 200) }; }
})();

// ---- the two arms ------------------------------------------------------------------------------
// Arm B is the shipped file with the `history` lookup in `row.fired` put back to what it was.
// The edit is one line and it is asserted to have applied — a delete-the-fix that silently failed
// to delete the fix is the inert arm RULES.md rule 6 says has passed here twice.
const OLD_LINE = 'row.fired = !!(hist || (cur && cur.fired));';
const NEW_LINE = 'row.fired = !!(cur && cur.fired);';
if (!shippedSrc.includes(OLD_LINE)) {
  process.stderr.write(`FAIL: ${SRC} does not contain the line this probe removes:\n  ${OLD_LINE}\n`
    + 'The fix has moved or been reverted. Retarget this probe rather than reporting a pass.\n');
  process.exit(2);
}
const revertedSrc = shippedSrc.replace(OLD_LINE, NEW_LINE);
if (revertedSrc === shippedSrc) { process.stderr.write('FAIL: the revert changed nothing.\n'); process.exit(2); }

const tmp = join(ROOT, 'game/src/sim/__hazards_deletefix_arm.js');
writeFileSync(tmp, revertedSrc);

const TERRAIN = rd('game/data/world/terrain.json');
const REGIONS = rd('game/data/world/regions.json');
const WATER = rd('game/data/world/water.json');
const HAZ = rd('game/data/world/hazards.json');
const SIGS = rd('game/data/world/signatures.json');

/** Stand a body inside a hazard volume for `frames` and report what the WORLD says about it. */
function standIn(Hazards, id, frames) {
  const field = new WorldField(TERRAIN, REGIONS, WATER);
  field.setRoads(rd('game/data/world/roads.json'));
  const sig = new SignatureField(SIGS);
  field.setSignatures(sig);
  const haz = new Hazards(HAZ, field, sig, REGIONS.regions);
  const h = HAZ.hazards.find((q) => q.id === id);
  const sim = {
    frame: 0, entities: [], cellId: null,
    player: { pos: [0, 0, 0], hp: 620, hpMax: 620, stamina: 120, staminaMax: 120, afflictions: [] },
    quest: { afflictions: [] }, progression: { attributes: {} }, env: {},
  };
  const bus = { emit: () => ({}) };
  // Find a point the WORLD agrees is inside the volume — the predicate is the world's.
  let placed = false;
  for (const rn of h.regions) {
    const r = REGIONS.regions.find((q) => q.name === rn);
    if (!r) continue;
    const bb = r.bounds_m;
    for (let i = 0; i < 400 && !placed; i++) {
      const t = (i * 2654435761) % 1000 / 1000, u = (i * 40503) % 997 / 997;
      sim.player.pos[0] = bb.x[0] + t * (bb.x[1] - bb.x[0]);
      sim.player.pos[2] = bb.z[0] + u * (bb.z[1] - bb.z[0]);
      haz.reset();
      const rep = haz.step(sim, bus, null);
      const row = rep.find((q) => q.id === id);
      if (row && row.inside) placed = true;
    }
    if (placed) break;
  }
  if (!placed) return { placed: false };
  haz.reset();
  sim.player.hp = 620;
  for (let f = 0; f < frames; f++) { sim.frame = f; haz.step(sim, bus, null); }
  const row = haz.lastReport.find((q) => q.id === id) || {};
  return {
    placed: true,
    report_says_fired: !!row.fired,
    hp_lost: +(620 - sim.player.hp).toFixed(2),
    damage_dealt_field: row.damage_dealt ?? null,
    damage_total_field: row.damage_total ?? null,
    fires: row.fires ?? null,
    spent: row.spent ?? null,
  };
}

const SUBJECTS = HAZ.hazards.filter((h) => h.class === 'TRAP' || h.class === 'KILL').map((h) => h.id);
const FRAMES = 1200;

const { Hazards: Fixed } = await import('../../game/src/sim/hazards.js');
const { Hazards: Reverted } = await import('../../game/src/sim/__hazards_deletefix_arm.js');

const rows = [];
for (const id of SUBJECTS) {
  const a = standIn(Fixed, id, FRAMES);
  const b = standIn(Reverted, id, FRAMES);
  rows.push({ id, fixed: a, reverted: b, differs: a.report_says_fired !== b.report_says_fired });
  process.stdout.write(`${id.padEnd(20)} placed=${a.placed ? 'y' : 'n'}  hp_lost=${String(a.hp_lost ?? '-').padStart(7)}  `
    + `report.fired  FIXED=${a.report_says_fired ? 'true ' : 'false'}  REVERTED=${b.report_says_fired ? 'true ' : 'false'}`
    + `${a.report_says_fired !== b.report_says_fired ? '   <- the fix is what makes this true' : ''}\n`);
}
rmSync(tmp, { force: true });

const placed = rows.filter((r) => r.fixed.placed);
const hurt = placed.filter((r) => r.fixed.hp_lost > 0.5);
const lieRestored = hurt.filter((r) => r.reverted.report_says_fired === false);
const doc = {
  schema: 'w1-01/hazard-report-deletefix@1', measured_at: new Date().toISOString(), git,
  fix: 'game/src/sim/hazards.js — row.fired reads a history map instead of the arming state',
  arm_b: `the same file with \`${OLD_LINE}\` put back to \`${NEW_LINE}\``,
  frames_per_stand: FRAMES, subjects: SUBJECTS, rows,
  placed: placed.length, hurt_the_body: hurt.length,
  old_lie_returns_on: lieRestored.map((r) => r.id),
  arms_differ: rows.some((r) => r.differs),
  pass: hurt.length > 0 && lieRestored.length === hurt.length && rows.some((r) => r.differs),
};
mkdirSync(dirname(join(ROOT, OUT)), { recursive: true });
writeFileSync(join(ROOT, OUT), JSON.stringify(doc, null, 1) + '\n');
process.stdout.write(`\n${hurt.length} TRAP/KILL hazard(s) took HP off the body in ${FRAMES} frames.\n`);
process.stdout.write(`With the fix REMOVED, the world's own report calls ${lieRestored.length} of them "not fired" again.\n`);
process.stdout.write(`git: worktree_has_fix=${git.worktree_has_fix} index_has_fix=${git.index_has_fix} worktree_matches_index=${git.worktree_matches_index}\n`);
process.stdout.write(`  ${OUT}\n`);
process.exit(doc.pass ? 0 : 1);
