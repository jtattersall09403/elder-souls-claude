// Cheap fail-closed controls for the exact RI-PRG04 M8 roster predicate.
import { validateRosterPopulation } from '../journey/jrn06-death.mjs';

const ids = Array.from({ length: 20 }, (_, i) => `lilmoth-${String(i + 1).padStart(2, '0')}`);
const arm = (populated = ids, roster = ids) => ({
  populated_eids: populated,
  before: { roster: Object.fromEntries(roster.map((id) => [id, 'lilmoth'])) },
});

const checks = {
  intact: validateRosterPopulation([arm(), arm(), arm()], ids),
  empty_fails: !validateRosterPopulation([arm([], [])], [], 20),
  wrong_settlement_fails: !validateRosterPopulation(
    [arm(ids.map((id) => id.replace('lilmoth', 'archon')), ids)], ids,
  ),
  mismatched_arm_fails: !validateRosterPopulation([arm(), arm(ids.slice(1), ids.slice(1))], ids),
};
const out = { schema: 'w1-13/m8-roster-controls@1', checks, pass: Object.values(checks).every(Boolean) };
process.stdout.write(`${JSON.stringify(out, null, 2)}\n`);
if (!out.pass) process.exitCode = 1;
