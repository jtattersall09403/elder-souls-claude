#!/usr/bin/env node
// greet-in-engine.mjs — RI-MTH07 §C3, the HAND-FEED AUDIT, for the greetings side.
//
// WHY THIS EXISTS. Every check in this piece — round 1's and round 2's — reaches greetingFor()
// by SUPPLYING it the world facts it needs: `{npcId, reactionGroup, disposition, playerRace,
// nth}`. RI-MTH07 §C3 is explicit that this is not enough:
//
//   "For every harness method that accepts world facts as ARGUMENTS ... assert the same result
//    is reachable WITHOUT supplying them — i.e. drive the world and let the system derive them.
//    A rule that is only reachable by telling the engine what it should have observed is an
//    orphan predicate."
//
// Neither round attempted it. `Engine.talkTo(eid)` is the derived path: it finds the NPC in the
// live sim, derives the disposition with `npcDisposition(eid)`, and derives `nth` from its own
// `_greetCount`. Nothing is injected. This script drives THAT, in a real browser.
//
// Output: the distinct greetings each RG-BWC NPC actually speaks, whether any carries a leak,
// whether the corrected line is reachable, and a null control on non-RG-BWC speakers.
import { launchGame } from '../../../../../../tools/lib/browser.mjs';
import { parseArgs, writeJson } from '../../../../../../tools/lib/cli.mjs';

const args = parseArgs(process.argv.slice(2));
const handle = await launchGame({ ...args, width: 320, height: 240 });
const page = handle.page;
const errors = [];
page.on('pageerror', (e) => errors.push(String(e).slice(0, 300)));
await page.waitForFunction(() => !!window.__HARNESS, null, { timeout: 45000 });
await page.evaluate(() => { try { window.__HARNESS.setRenderRate(0); } catch {} });
const STATE = args.state || 'town-lilmoth';
await page.evaluate(async (s) => { await window.__HARNESS.loadState(s); }, STATE);
await page.evaluate(() => window.__HARNESS.stepFrames(4));

const out = await page.evaluate(() => {
  const H = window.__HARNESS;
  const LEAK = /\bsay it in one line\b|\bkeep it (short|brief|tight|concise)\b|\bplaceholder\b|\btodo\b|\bfixme\b/i;
  const FIXED = /Company time, and Leyawiin bought it/;

  // Who is actually IN the world? Derived, never hand-listed.
  const people = H.listNPCs() || [];
  const ids = people.map((n) => n.eid);

  const rows = [];
  const probe = (eid) => {
    const seen = new Set(); let group = null; let disp = null; const cells = new Set();
    for (let i = 0; i < 20; i++) {
      let r;
      try { r = H.talkTo(eid); } catch (e) { return { eid, error: String(e).slice(0, 140) }; }
      if (!r) break;
      const line = r.greeting && (r.greeting.line || r.greeting.text) ? (r.greeting.line || r.greeting.text) : (typeof r.greeting === 'string' ? r.greeting : null);
      if (line) seen.add(line);
      if (r.greeting && r.greeting.cell) cells.add(JSON.stringify(r.greeting.cell));
      if (r.reaction_group) group = r.reaction_group;
      if (r.disposition != null) disp = r.disposition;
      try { H.conversationClose(); } catch {}
    }
    const lines = [...seen];
    return { eid, group, disp, n_distinct: lines.length, cells: [...cells],
      leaks: lines.filter((l) => LEAK.test(l)), has_fixed: lines.some((l) => FIXED.test(l)), lines };
  };

  for (const eid of ids) rows.push(probe(eid));
  return { n_world_npcs: ids.length, rows, groups: people.map((n) => n.reaction_group) };
});

const bwc = out.rows.filter((r) => r.lines && r.lines.some((l) => /Company time, and Leyawiin bought it/.test(l) || /Blackwood|Company/.test(l)));
const report = {
  what: 'RI-MTH07 §C3 hand-feed audit — greetings driven through Engine.talkTo(), no world fact supplied',
  state: process.env.CRITIC_STATE || 'town-lilmoth',
  n_world_npcs: out.n_world_npcs,
  reaction_groups_present: [...new Set(out.groups)].sort(),
  npcs_probed: out.rows.length,
  npcs_with_error: out.rows.filter((r) => r.error).length,
  total_distinct_lines: out.rows.reduce((a, r) => a + (r.n_distinct || 0), 0),
  npcs_speaking_a_leak: out.rows.filter((r) => r.leaks && r.leaks.length).map((r) => ({ eid: r.eid, leaks: r.leaks })),
  npcs_reaching_the_corrected_line: out.rows.filter((r) => r.has_fixed).map((r) => r.eid),
  rows: out.rows,
  page_errors: errors,
};
console.log(JSON.stringify({ ...report, rows: undefined }, null, 2));
if (args.out) writeJson(args.out, report);
await handle.close();
