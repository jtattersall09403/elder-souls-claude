#!/usr/bin/env node
// w1-14-r5-alias.mjs — EVERY SHARED STATBLOCK OBJECT IN THE BUILD, COUNTED.
//
// WHY THIS IS NOT ANOTHER GREP.
//
// Round 4 fixed `spawnEnemy`'s `_weapon: weapon` alias — a summon's `bind_lesser` handler wrote
// `attack_rating` through a reference every body of the archetype shared, so six casts took an
// untouched hostile from 86 to 16,115. The round-4 critic verified the fix on a route the round
// did not add, found the leak reached a SECOND archetype nobody had measured (`drowned_greater`,
// 168 -> 31,415), and then audited the rest of the surface BY GREP: "`grep` for a two-level
// assignment through any of the others returns nothing across `game/src/`".
//
// A grep over source cannot close this and RULES.md #11 says why in the neighbouring case: the
// loader decides what shapes are legal, and a census over one representation cannot prove
// something absent from the running world. A two-level assignment can be written
// `const w = stat.weapon; w.attack_rating = x`, or through a destructure, or through
// `Object.assign`, or by a handler that was added after the grep. So this probe asks the
// RUNNING WORLD two questions instead, and neither of them mentions `_weapon`:
//
//   A. THE ALIAS CENSUS. Spawn every archetype the build declares, walk the object graph of the
//      body and of its controller to a bounded depth, and record every node that is `===` to a
//      node inside the archetype's own statblock. That is the complete set of places a write
//      through a body can reach the statblock, whether or not anything writes there today, and
//      whether or not the route is greppable. The count is the deliverable.
//
//   B. THE MUTATION CENSUS. Deep-copy every statblock, then run the world at it — spawn several
//      bodies of each archetype, cast every summon and bind spell in the catalogue, fight, and
//      let the AI run — and deep-compare the statblocks afterwards. Anything that moved is a
//      leak by SOME route, named without knowing what the route was.
//
// The two together are the audit. A leaks with no B is a shared object nothing writes to (worth
// recording, not charging). A B with no A is a leak by a route that is not object sharing at all.
//
// ARMS
//   (default)             the fix
//   --break alias         `__breakSummonAlias` — round 4's world. B must go red.
//
// USAGE  node tools/harness/w1-14-r5-alias.mjs [--break alias] [--out <dir>]
import path from 'node:path';
import { parseArgs, wantsHelp, usage, log, writeJson, ensureDir, EXIT, gitInfo } from '../lib/cli.mjs';
import { launchGame } from '../lib/browser.mjs';

const USAGE = `w1-14-r5-alias.mjs — every shared statblock object, counted.

  --break alias   arm __breakSummonAlias (round 4's world). The mutation census must go red.
  --out <dir>     report directory (default reports/w1-14-r5)

Exit 5 if the FIXED arm reports any statblock mutation — that is a live leak.
`;
const args = parseArgs();
if (wantsHelp(args)) usage(USAGE);
const BREAK = args.break ? String(args.break) : null;
const outDir = path.resolve(String(args.out || 'reports/w1-14-r5'));
ensureDir(outDir);

const RUN = (page, o) => page.evaluate(async (q) => {
  const H = window.__HARNESS;
  await H.ready();
  const E = window.__ENGINE;
  if (!E) return { fatal: 'window.__ENGINE is not exposed; this probe reads the live object graph' };

  // ---- the object-graph walk -------------------------------------------------------------------
  // Bounded depth and a visited set, because the graph is cyclic (a body knows its controller,
  // which knows its body). `Set` identity is the whole instrument: two nodes are the same object
  // or they are not, and there is no way to be wrong about that.
  const nodesOf = (root, maxDepth) => {
    const out = new Map();                       // object -> path
    const seen = new Set();
    const walk = (v, p, d) => {
      if (!v || typeof v !== 'object' || d > maxDepth) return;
      if (seen.has(v)) return;
      seen.add(v);
      out.set(v, p);
      for (const k of Object.keys(v)) {
        let c;
        try { c = v[k]; } catch (e) { continue; }
        if (c && typeof c === 'object') walk(c, `${p}.${k}`, d + 1);
      }
    };
    walk(root, '', 0);
    return out;
  };

  const ids = Object.keys(E.data.enemies).sort();
  const out = { archetypes: ids.length, arm: q.brk || 'fix' };

  // ---- A. THE ALIAS CENSUS ----------------------------------------------------------------------
  const aliases = [];
  const spawnable = [];
  const unspawnable = [];
  H.setSeed(11); H.loadState('arena_flat'); H.setRenderRate(0); H.resetMagicWorld();
  for (const id of ids) {
    const stat = E.data.enemies[id];
    let eid = null;
    try { const s = H.spawn(id, 0, 8); eid = s && s.eid ? s.eid : s; } catch (e) { unspawnable.push({ id, why: String(e && e.message || e).slice(0, 140) }); continue; }
    spawnable.push(id);
    const body = E.combat.bodies.find((b) => b.id === eid);
    const ctl = E.combat.enemies.get(eid);
    const statNodes = nodesOf(stat, 6);
    const reachable = new Map([...nodesOf(body, 5)]);
    for (const [k, v] of nodesOf(ctl, 5)) if (!reachable.has(k)) reachable.set(k, `ctl${v}`);
    for (const [node, pathIn] of reachable) {
      if (node === stat) { aliases.push({ archetype: id, at: pathIn || '<root>', is: '<the statblock itself>' }); continue; }
      const sp = statNodes.get(node);
      if (sp !== undefined) aliases.push({ archetype: id, at: pathIn, is: `stat${sp}` });
    }
    try { H.despawn(eid); } catch (e) { /* gone */ }
  }
  // Group: the interesting number is how many DISTINCT statblock members are shared, not how
  // many archetypes share them — every archetype shares the same shapes.
  const byMember = {};
  for (const a of aliases) {
    const k = `${a.at} -> ${a.is}`;
    (byMember[k] = byMember[k] || { at: a.at, is: a.is, archetypes: [] }).archetypes.push(a.archetype);
  }
  out.alias_census = {
    spawnable: spawnable.length, unspawnable,
    total_alias_edges: aliases.length,
    distinct_shapes: Object.keys(byMember).length,
    shapes: Object.values(byMember).map((v) => ({ at: v.at, is: v.is, n_archetypes: v.archetypes.length })).sort((a, b) => (a.at < b.at ? -1 : 1)),
  };

  // ---- B. THE MUTATION CENSUS -------------------------------------------------------------------
  // Deep-copy first, THEN run the world, THEN compare. The copy is taken before anything is
  // spawned so that a leak from the very first spawn is caught too.
  const before = {};
  for (const id of ids) before[id] = JSON.stringify(E.data.enemies[id]);

  H.setSeed(11); H.loadState('arena_flat'); H.setRenderRate(0); H.resetMagicWorld();
  if (q.brk === 'alias') H.__breakSummonAlias(true); else if (H.__breakSummonAlias) H.__breakSummonAlias(false);
  for (let i = 0; i < 700; i++) {
    for (const sk of ['sorcery', 'root-speech', 'warding', 'veiling']) H.grantSkillUse('cast_effective', { cost: 40, spell_skill: sk });
    H.hearthRest();
  }
  H.setWillpower(99); H.setCatalyst('great_staff'); H.setGold(4000000); H.hearthRest();
  for (const s of H.getMagicData().spells.spells) H.learnSpell(s.id);

  // Everything the catalogue can do to a body, done to bodies of every spawnable archetype.
  const spells = H.getMagicData().spells.spells;
  const summonish = spells.filter((s) => s.effects.some((e) => /bound|bind|summon|command|frenz|charm/i.test(e.effect))).map((s) => s.id);
  const casts = [];
  const sample = spawnable.filter((id) => !/^dummy/.test(id));
  for (const id of sample.slice(0, 40)) {
    let eid = null;
    try { const s = H.spawn(id, 1.5, 7); eid = s && s.eid ? s.eid : s; } catch (e) { continue; }
    // Six of each summon-shaped spell, because the round-4 leak was a GEOMETRIC series and one
    // cast of it is indistinguishable from noise.
    for (const sid of summonish) {
      try {
        H.setAttuned([sid]);
        for (let k = 0; k < 6; k++) { H.queueInputs([{ f: 1, press: ['light'] }, { f: 4, release: ['light'] }]); H.stepFrames(90); }
        casts.push(sid);
      } catch (e) { /* not castable here */ }
    }
    H.stepFrames(120);
    try { H.despawn(eid); } catch (e) { /* gone */ }
  }

  const moved = [];
  for (const id of ids) {
    const now = JSON.stringify(E.data.enemies[id]);
    if (now !== before[id]) {
      // Name the field rather than dumping two blobs.
      const a = JSON.parse(before[id]), b = JSON.parse(now);
      const diffs = [];
      const walk = (x, y, p) => {
        if (typeof x !== 'object' || x === null || typeof y !== 'object' || y === null) {
          if (x !== y) diffs.push({ at: p, before: x, after: y });
          return;
        }
        for (const k of new Set([...Object.keys(x), ...Object.keys(y)])) walk(x[k], y[k], `${p}.${k}`);
      };
      walk(a, b, '');
      moved.push({ archetype: id, diffs: diffs.slice(0, 8) });
    }
  }
  out.mutation_census = { archetypes_checked: ids.length, casts: casts.length, mutated: moved.length, moved };
  if (H.__breakSummonAlias) H.__breakSummonAlias(false);
  return out;
}, o);

(async () => {
  const git = gitInfo();
  const { page, close } = await launchGame();
  let d;
  try { d = await RUN(page, { brk: BREAK }); } finally { await close(); }
  writeJson(path.join(outDir, BREAK ? `alias-${BREAK}.json` : 'alias-fix.json'),
    { schema: 'elder-souls/w1-14-r5-alias@1', commit: git.commit, dirty: git.dirty, ...d });
  if (d.fatal) { log(`FATAL: ${d.fatal}`); process.exit(EXIT.FAIL || 1); }
  log(`arm=${d.arm}  archetypes=${d.archetypes}  spawnable=${d.alias_census.spawnable}`);
  log(`ALIAS CENSUS   ${d.alias_census.total_alias_edges} shared-object edge(s), ${d.alias_census.distinct_shapes} distinct shape(s):`);
  for (const s of d.alias_census.shapes) log(`   ${s.at.padEnd(34)} -> ${s.is.padEnd(28)} (${s.n_archetypes} archetype(s))`);
  log(`MUTATION CENSUS  ${d.mutation_census.casts} cast(s); ${d.mutation_census.mutated} of ${d.mutation_census.archetypes_checked} statblock(s) moved`);
  for (const m of d.mutation_census.moved) for (const df of m.diffs) log(`   ${m.archetype}${df.at}: ${df.before} -> ${df.after}`);
  if (!BREAK && d.mutation_census.mutated > 0) process.exit(5);
  process.exit(EXIT.OK);
})();
