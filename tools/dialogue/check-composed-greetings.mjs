#!/usr/bin/env node
// check-composed-greetings.mjs — scan the line the player HEARS, not the fragments it is
// built from.
//
// =========================================================================================
// WHY THIS EXISTS — THE DEFECT WAS DIAGNOSED AS ONE THIRD OF ITSELF, TWICE
// =========================================================================================
// A blind judge, shown a screenshot of the conversation window, flagged one whole line:
//
//     "Say it in one line. Local. Useful."
//
// Round 1 fixed `STANCE['RG-BWC'].cold[3]` (`'Say it in one line.'`) and, re-deriving, decided
// that `Local. Useful.` was a legitimate authored address fragment. The round-1 critic agreed
// and confirmed the withdrawal: it sits in a five-race block whose other four are unambiguously
// in-world speech. **Both were reading the fragment table.** The judge was reading the composed
// line — and in that line, for that faction, to that race, the two words read as a brief. The
// round-2 critic drove `Engine.talkTo('blackwood-company-factor')` in a real browser and found
// it in **all five** lines the NPC can speak, as the opener as often as the closer.
//
// So this file exists because of a structural gap, not an oversight:
//
//   * `check-authoring-leaks.mjs` scans **fragments** (the generator's tables, read as text) and
//     **shipped strings** — and its scope is `game/data/dialogue` and `game/data/books`.
//   * `check-greeting-voice.mjs` scans the exclusivity of a line's halves.
//   * **Nothing scanned what an NPC actually says when the world assembles it.**
//
// Two things live only here:
//
//   1. **`game/data/npcs/**` is outside every other check's scope.** Counted this run and
//      printed below: hand-written `lines.greeting` strings on NPC records, which the engine
//      speaks verbatim when a person has no reaction group or no matching pool. Round 2's own
//      status file names this hole ("a real remaining hole and I am naming it rather than
//      letting the next reader find it"). It is closed here.
//   2. **The DERIVED path.** `RI-MTH07` §C3: *a rule that is only reachable by telling the
//      engine what it should have observed is an orphan predicate.* Every other check reaches
//      `greetingFor()` by supplying `{npcId, reactionGroup, disposition, playerRace, nth}`.
//      `Engine.talkTo(eid)` supplies none of it — it finds the person in the live sim and
//      derives the rest. `--engine` drives that.
//
// =========================================================================================
// WHAT THIS CHECK CANNOT DO, STATED FIRST
// =========================================================================================
// **The pattern list would not have caught the defect that created this file, and it still
// would not.** `Local. Useful.` matches nothing in `tools/lib/authoring-patterns.mjs` and
// should not: two bare adjectives are not a recognisable instruction in isolation. Round 3's
// control arm `I` demonstrates it — the leak check stays GREEN on the restored fragment while
// the voice check goes red. What catches that class of defect is the per-half exclusivity gate
// in `check-greeting-voice.mjs` and a blind judge reading the composed line. This check's
// contribution is **coverage of the composed surface and of the derived path**, plus a direct
// regression assertion on this specific fragment. Do not read a green here as "no authoring
// instruction reached the player".
//
// Usage:
//   node tools/dialogue/check-composed-greetings.mjs                 # offline layer only
//   node tools/dialogue/check-composed-greetings.mjs --engine        # + drive the real engine
//        [--states town-lilmoth,town-soulrest] [--races saxhleel,imperial] [--out <json>]
//
// Exit codes: 0 pass · 1 a leak or a regression in COMPOSED output · 2 an expected speaker was
//             not reached (scope failure — fails closed, never silently passes on a subset)
//             · 3 IO/engine error · 4 the evidence-mutation seal broke (HAZARDS §31).
'use strict';

// ⚠ FIRST IMPORT, DELIBERATELY. See tools/lib/evidence-seal.mjs — the fingerprint is taken in
// that module's body, which ESM evaluates before this file's body and before any import below.
import { verifySeal, reportSeal } from '../lib/evidence-seal.mjs';
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';
import { matchAny, KNOWN_UNMATCHABLE_HALF } from '../lib/authoring-patterns.mjs';

const HERE = path.dirname(url.fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');
const argv = process.argv.slice(2);
const arg = (n, d = null) => { const i = argv.indexOf(n); return i === -1 ? d : argv[i + 1]; };

/** The ADDRESS half this piece owns, as it must now reach the player. Derived from the shipped
 * file rather than hard-coded — see `deriveAddress()`. This is only the cell coordinate. */
const OWNED = { group: 'RG-BWC', class: 'saxhleel' };

/** Both RG-BWC speakers. NOT hand-listed as a constant: derived from game/data/npcs below, so
 * a third one cannot appear without this check noticing. */
function bwcSpeakers() {
  const out = [];
  const walk = (dir) => {
    for (const f of fs.readdirSync(dir).sort()) {
      const p = path.join(dir, f);
      const st = fs.statSync(p);
      if (st.isDirectory()) { walk(p); continue; }
      if (!f.endsWith('.json')) continue;
      let doc; try { doc = JSON.parse(fs.readFileSync(p, 'utf8')); } catch { continue; }
      const rec = (o) => {
        if (Array.isArray(o)) { o.forEach(rec); return; }
        if (!o || typeof o !== 'object') return;
        if (o.reaction_group === OWNED.group && typeof o.id === 'string') {
          out.push({
            id: o.id, name: o.name || null, settlement: o.settlement || null,
            // Somebody with `settlement: null` belongs to no town, so no town state holds them.
            // Their `post` is where they actually stand in the province, and it is the only way
            // to go and meet them. See `--reach-posts`.
            post: (o.post && Array.isArray(o.post.pos)) ? { site: o.post.site || null, pos: o.post.pos } : null,
            file: path.relative(ROOT, p),
          });
        }
        for (const v of Object.values(o)) rec(v);
      };
      rec(doc);
    }
  };
  walk(path.join(ROOT, 'game/data/npcs'));
  return out;
}

/** Every hand-written `lines.greeting` on an NPC record — the surface no other check scans. */
function handWrittenGreetings() {
  const out = [];
  const walk = (dir) => {
    for (const f of fs.readdirSync(dir).sort()) {
      const p = path.join(dir, f);
      const st = fs.statSync(p);
      if (st.isDirectory()) { walk(p); continue; }
      if (!f.endsWith('.json')) continue;
      let doc; try { doc = JSON.parse(fs.readFileSync(p, 'utf8')); } catch { continue; }
      const rec = (o) => {
        if (Array.isArray(o)) { o.forEach(rec); return; }
        if (!o || typeof o !== 'object') return;
        if (o.lines && typeof o.lines === 'object') {
          for (const [k, v] of Object.entries(o.lines)) {
            if (typeof v === 'string') out.push({ npc: o.id || '(unnamed)', key: `lines.${k}`, text: v, file: path.relative(ROOT, p) });
          }
        }
        for (const v of Object.values(o)) rec(v);
      };
      rec(doc);
    }
  };
  walk(path.join(ROOT, 'game/data/npcs'));
  return out;
}

/** The ADDRESS half of a (group, class), derived from the shipped composed lines: it is the
 * longest string that is a prefix of `lines[0]` and a suffix of `lines[1]`. Required to agree
 * across all five disposition bands. Identical derivation to check-greeting-voice.mjs. */
function deriveAddress(pools, group, cls) {
  const cells = pools.filter((p) => p.reaction_group === group && p.player_race_class === cls);
  if (!cells.length) return { error: `no ${group}/${cls} cell in the shipped file` };
  const one = (p) => {
    const a = p.lines[0]; const b = p.lines[1];
    let best = '';
    for (let k = 1; k <= Math.min(a.length, b.length); k++) if (a.slice(0, k) === b.slice(b.length - k)) best = a.slice(0, k);
    return best.trim();
  };
  const distinct = [...new Set(cells.map(one))];
  if (distinct.length !== 1 || !distinct[0]) return { error: `bands disagree on the address: ${JSON.stringify(distinct)}` };
  return { addr: distinct[0], bands: cells.length };
}

async function main() {
  const seal = verifySeal(import.meta.url);
  if (!reportSeal('check-composed-greetings', seal)) process.exit(4);

  const gp = path.join(ROOT, 'game/data/dialogue/greetings.json');
  if (!fs.existsSync(gp)) { console.error(`FAIL: ${gp} missing — scope is stale.`); process.exit(3); }
  const pools = (JSON.parse(fs.readFileSync(gp, 'utf8')).pools) || [];
  if (!pools.length) { console.error('FAIL: greetings.json has no pools.'); process.exit(3); }

  const failures = [];

  // ---- layer 1: the composed lines as shipped ---------------------------------------------
  const composed = pools.flatMap((p, i) => p.lines.map((l, j) => ({ where: `.pools[${i}].lines[${j}]`, group: p.reaction_group, text: l })));
  const composedHits = composed.filter((c) => matchAny(c.text));
  console.log(`\nCOMPOSED LINES (shipped): ${composed.length} lines over ${pools.length} cells · ${composedHits.length} pattern hit(s)`);

  // ---- layer 2: hand-written NPC lines, which no other check scans -------------------------
  const hand = handWrittenGreetings();
  const handHits = hand.filter((h) => matchAny(h.text));
  console.log(`HAND-WRITTEN NPC LINES: ${hand.length} string(s) under game/data/npcs/** · ${handHits.length} pattern hit(s)`);
  console.log('  (this directory is OUTSIDE check-authoring-leaks.mjs\'s scope, which is');
  console.log('   game/data/dialogue and game/data/books. Round 2\'s status file named this hole.)');

  for (const h of [...composedHits, ...handHits]) {
    failures.push({ kind: 'pattern', where: h.where || `${h.file} ${h.npc} ${h.key}`, why: matchAny(h.text), text: h.text });
  }

  // ---- layer 3: the round-3 regression assertion -------------------------------------------
  const addr = deriveAddress(pools, OWNED.group, OWNED.class);
  if (addr.error) {
    console.error(`\nFAIL: could not derive the ${OWNED.group}/${OWNED.class} ADDRESS — ${addr.error}`);
    process.exit(3);
  }
  const stillLeaking = composed.filter((c) => c.text.includes(KNOWN_UNMATCHABLE_HALF));
  console.log(`\nROUND-3 REGRESSION ASSERTION — the fragment two rounds left in place:`);
  console.log(`  ${JSON.stringify(KNOWN_UNMATCHABLE_HALF)} appears in ${stillLeaking.length} composed line(s) (required: 0)`);
  console.log(`  the ${OWNED.group}/${OWNED.class} ADDRESS now reads (agreed by all ${addr.bands} bands):`);
  console.log(`    ${JSON.stringify(addr.addr)}`);
  console.log(`  matched by the authoring-instruction patterns: ${matchAny(addr.addr) || 'no'}`);
  if (stillLeaking.length) {
    failures.push({ kind: 'regression', where: stillLeaking[0].where, why: 'the ADDRESS half the blind judge flagged is back in composed output', text: stillLeaking[0].text });
  }

  // ---- layer 4: the derived path, in a real browser -----------------------------------------
  let engine = null;
  if (argv.includes('--engine')) {
    engine = await driveEngine(pools, addr.addr, failures);
  } else {
    console.log('\nENGINE LAYER: NOT RUN (--engine not given). This run has NOT looked at what any');
    console.log('NPC actually says; it has read the shipped table and the NPC records. RI-MTH07 §C3');
    console.log('is unmet without --engine and this check says so rather than implying otherwise.');
  }

  const out = arg('--out');
  if (out) {
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, `${JSON.stringify({
      what: 'composed-output greeting scan — the line the player hears',
      composed_lines: composed.length,
      hand_written_npc_lines: hand.length,
      owned_address: addr.addr,
      known_unmatchable_half_occurrences: stillLeaking.length,
      engine,
      failures,
    }, null, 2)}\n`);
    console.log(`\nwrote ${out}`);
  }

  if (failures.length) {
    console.log(`\nFAIL: ${failures.length} problem(s) in COMPOSED output:`);
    for (const f of failures.slice(0, 20)) console.log(`  [${f.kind}] ${f.where}\n    (${f.why}) ${JSON.stringify(f.text).slice(0, 200)}`);
    process.exit(failures.some((f) => f.kind === 'scope') ? 2 : 1);
  }
  console.log('\nPASS: no authoring-instruction pattern in any composed line or hand-written NPC');
  console.log('line, and the fragment two rounds left in place is gone from composed output.');
  if (!engine) console.log('(Offline layers only — the derived path was not driven this run.)');
  process.exit(0);
}

// -----------------------------------------------------------------------------------------
// THE ENGINE LAYER
// -----------------------------------------------------------------------------------------
async function driveEngine(pools, ownedAddress, failures) {
  /** Resolve the engine's `greeting_cell` back to the pool's race class. `greetingFor()` sets
   * `cell` to the KEY it matched in `greetings.json`'s pools, so this is the engine's own
   * answer about which cell it served, read back against the shipped file. */
  const cellClass = (cells) => {
    if (!cells || !cells.length) return null;
    const cls = new Set();
    for (const c of cells) {
      const p = pools[Number(c)];
      if (p && p.player_race_class) cls.add(p.player_race_class);
    }
    return cls.size === 1 ? [...cls][0] : null;
  };
  const { launchGame } = await import('../lib/browser.mjs');
  const states = (arg('--states') || 'town-lilmoth').split(',').map((s) => s.trim()).filter(Boolean);
  const races = (arg('--races') || 'saxhleel').split(',').map((s) => s.trim()).filter(Boolean);
  const expected = bwcSpeakers();

  console.log(`\nENGINE LAYER — Engine.talkTo(), nothing hand-fed (RI-MTH07 §C3)`);
  console.log(`  states: ${states.join(', ')}`);
  console.log(`  player races driven: ${races.join(', ')}`);
  console.log(`  ${OWNED.group} speakers derived from game/data/npcs/** (not hand-listed): `
    + `${expected.map((e) => `${e.id}${e.settlement ? ` @${e.settlement}` : ''}`).join(', ')}`);

  const handle = await launchGame({ width: 320, height: 240 });
  const page = handle.page;
  const pageErrors = [];
  page.on('pageerror', (e) => pageErrors.push(String(e).slice(0, 300)));
  const rows = [];
  try {
    await page.waitForFunction(() => !!window.__HARNESS, null, { timeout: 45000 });
    await page.evaluate(() => { try { window.__HARNESS.setRenderRate(0); } catch { /* not all builds */ } });

    for (const state of states) {
      await page.evaluate(async (s) => { await window.__HARNESS.loadState(s); }, state);
      await page.evaluate(() => window.__HARNESS.stepFrames(4));
      for (const race of races) {
        const got = await page.evaluate(async ({ r }) => {
          const H = window.__HARNESS;
          try { H.setCharacter({ race: r }); } catch { /* state may not carry a character */ }
          H.stepFrames(2);
          const people = H.listNPCs() || [];
          const res = [];
          for (const n of people) {
            const seen = new Set();
            // The GROUP comes from the world record, not from talkTo(): talkTo() does not
            // return `reaction_group` at the top level, and reading it from there yields null
            // for every NPC — which silently empties any filter built on it. (The round-2
            // critic's own log has `group: null` on all 60 rows for exactly this reason.)
            let group = n.reaction_group || null; let disp = null; let err = null;
            const cells = new Set(); let handWritten = false;
            for (let i = 0; i < 12; i++) {
              let t;
              try { t = H.talkTo(n.eid); } catch (e) { err = String(e).slice(0, 160); break; }
              if (!t) break;
              const g = t.greeting;
              const line = g && (g.line || g.text) ? (g.line || g.text) : (typeof g === 'string' ? g : null);
              if (line) seen.add(line);
              if (!group && t.reaction_group) group = t.reaction_group;
              if (!group && g && g.reaction_group) group = g.reaction_group;
              // THE ENGINE'S OWN ANSWER for which race-class pool it used. Never the race this
              // tool ASKED for: `setCharacter({race})` does not move `sim.identity.race`, which
              // is what `_talkPlayer()` actually reads, so a requested race can silently not
              // take effect. Labelling a row with the request rather than the observation is how
              // a run reports three races and measures one.
              // `talkTo()` returns the CONVERSATION STATE, in which `greeting` is a plain
              // string and the pool coordinate is top-level `greeting_cell` — there is no
              // nested `{cell, player_race_class}` object to read, which is why the round-2
              // critic's own log has `cells: []` on every row. The cell is resolved back to a
              // (group, band, race-class) against the shipped pools in Node, so the race class
              // is ATTRIBUTED FROM THE ENGINE'S ANSWER and never from what this tool asked for.
              if (t.greeting_cell != null) cells.add(String(t.greeting_cell));
              else if (line) handWritten = true;
              if (t.disposition != null) disp = t.disposition;
              try { H.conversationClose(); } catch { /* already closed */ }
            }
            res.push({ eid: n.eid, group, disp, err, lines: [...seen], cells: [...cells], hand_written: handWritten });
          }
          return res;
        }, { r: race });
        for (const g of got) rows.push({ state, race, ...g });
      }
    }

    // ---- go and stand next to anyone no state holds -------------------------------------
    // `blackwood-company-camp` has `settlement: null` and a `post.site` (`works-camp`) that NO
    // named state declares — grep game/data/states for "site" and there are two, neither of
    // them this one. So no scenario puts the player near them and the round-2 critic could not
    // reach them. Walking the province to their post is the derived path that can: the engine
    // still finds the person, derives disposition, race and greet-count itself. Nothing about
    // the greeting is hand-fed.
    if (argv.includes('--reach-posts')) {
      const drivenSoFar = new Set(rows.map((r) => r.eid));
      const stranded = expected.filter((e) => !drivenSoFar.has(e.id) && e.post);
      for (const s of stranded) {
        for (const race of races) {
          const got = await page.evaluate(async ({ target, r }) => {
            const H = window.__HARNESS;
            try { H.setCharacter({ race: r }); } catch { /* state may carry no character */ }
            try { H.teleport(target.post.pos[0], target.post.pos[2]); } catch (e) { return { fatal: String(e).slice(0, 200) }; }
            H.stepFrames(8);
            const people = H.listNPCs() || [];
            const me = people.find((n) => n.eid === target.id);
            if (!me) return { present: false, nearby: people.length };
            const seen = new Set();
            let err = null;
            for (let i = 0; i < 12; i++) {
              let t;
              try { t = H.talkTo(target.id); } catch (e) { err = String(e).slice(0, 160); break; }
              if (!t) break;
              const g = t.greeting;
              const line = g && (g.line || g.text) ? (g.line || g.text) : (typeof g === 'string' ? g : null);
              if (line) seen.add(line);
              try { H.conversationClose(); } catch { /* already closed */ }
            }
            return { present: true, nearby: people.length, group: me.reaction_group || null, lines: [...seen], err };
          }, { target: s, r: race });

          if (got && got.present) {
            rows.push({ state: `post:${s.post.site}`, race, eid: s.id, group: got.group, disp: null, err: got.err, lines: got.lines });
            console.log(`  reached ${s.id} by walking to its post ${JSON.stringify(s.post.pos)} `
              + `(site "${s.post.site}", no named state declares it): ${got.lines.length} distinct line(s)`);
          } else {
            console.log(`  could NOT reach ${s.id} at its post ${JSON.stringify(s.post.pos)}: `
              + `${got && got.fatal ? got.fatal : `not in listNPCs() after teleport (${got ? got.nearby : '?'} people nearby)`}`);
          }
        }
      }
    }
  } finally {
    await handle.close();
  }

  const spoken = rows.flatMap((r) => r.lines.map((l) => ({
    state: r.state, race_requested: r.race, eid: r.eid, group: r.group, text: l,
    // The pool class the ENGINE derived. A row whose greeting came from a hand-written
    // `lines.greeting` has no cell and no class — that is the fallback path, and it is a
    // surface no other check scans at all.
    prc: cellClass(r.cells),
  })));
  // Did the race this tool asked for actually take effect? `setCharacter({race})` does not move
  // `sim.identity.race`, so it does not. Say so with the observation rather than the request.
  const derivedClasses = [...new Set(rows.map((r) => cellClass(r.cells)).filter(Boolean))];
  const racesRequested = [...new Set(rows.map((r) => r.race))];
  const distinct = new Set(spoken.map((s) => s.text));
  const leaks = spoken.filter((s) => matchAny(s.text));
  const residue = spoken.filter((s) => s.text.includes(KNOWN_UNMATCHABLE_HALF));
  // Reached = the expected speaker was actually STOOD IN FRONT OF and talked to. Keyed on eid,
  // not on the group field, so a null/renamed group cannot make this silently green.
  const drivenEids = new Set(rows.map((r) => r.eid));
  const reached = new Set(expected.filter((e) => drivenEids.has(e.id)).map((e) => e.id));
  const missing = expected.filter((e) => !reached.has(e.id));
  const ownedSpoken = spoken.filter((s) => s.group === OWNED.group && s.prc === OWNED.class);
  const carryingOwned = ownedSpoken.filter((s) => s.text.includes(ownedAddress));

  console.log(`  NPCs driven: ${rows.length} (state × race rows) · distinct greetings heard: ${distinct.size}`);
  console.log(`  player race classes the ENGINE actually derived: ${derivedClasses.join(', ') || '(none — every greeting was hand-written)'}`);
  if (racesRequested.length > derivedClasses.length) {
    console.log(`  ⚠ ${racesRequested.length} race(s) were REQUESTED (${racesRequested.join(', ')}) and the engine`);
    console.log('    derived ' + derivedClasses.length + '. `setCharacter({race})` does not move `sim.identity.race`,');
    console.log('    which is what `_talkPlayer()` reads, so the extra requests changed nothing. This run');
    console.log('    measured the classes listed above and NOT the ones requested. Rows are labelled with');
    console.log('    the engine\'s answer; do not read the request as a measurement.');
  }
  console.log(`  greetings served from a hand-written lines.greeting (no pool cell): ${rows.filter((r) => r.hand_written).length} NPC(s)`);
  console.log(`  errors from talkTo(): ${rows.filter((r) => r.err).length} · page errors: ${pageErrors.length}`);
  console.log(`  authoring-instruction pattern hits in SPOKEN output: ${leaks.length} (required 0)`);
  console.log(`  ${JSON.stringify(KNOWN_UNMATCHABLE_HALF)} in SPOKEN output: ${residue.length} (required 0)`);
  console.log(`  ${OWNED.group} speakers reached: ${[...reached].join(', ') || '(none)'}`);
  console.log(`  ${OWNED.group}/${OWNED.class} lines heard: ${ownedSpoken.length}, of which carry the owned ADDRESS: ${carryingOwned.length}`);

  if (missing.length) {
    // WHY a speaker was not reached matters more than the fact. `game/src/sim/npc.js`: *"a post
    // with a `site` is a named place that is not a town at all, and the only thing that ever
    // spawns one of those is the state file that names the site"*. So a speaker whose post site
    // is declared by NO state file is not merely unvisited — they are **not in the running world
    // at all**, and no `--states` argument can reach them. That is a finding about the world,
    // not about this check, and it is reported as one.
    const declaredSites = new Set();
    const sdir = path.join(ROOT, 'game/data/states');
    for (const f of fs.readdirSync(sdir)) {
      if (!f.endsWith('.json')) continue;
      try { const d = JSON.parse(fs.readFileSync(path.join(sdir, f), 'utf8')); if (d.site) declaredSites.add(d.site); } catch { /* not a state */ }
    }
    console.log(`  SCOPE FAILURE: ${missing.length} of ${expected.length} ${OWNED.group} speaker(s) never reached.`);
    console.log(`  (${declaredSites.size} site(s) are declared by any state file: ${[...declaredSites].join(', ') || 'none'})`);
    for (const m of missing) {
      const site = m.post && m.post.site;
      const byConstruction = site && !declaredSites.has(site);
      console.log(`    ${m.id} (settlement: ${m.settlement || 'null'}, post site: ${site || 'none'})`);
      if (byConstruction) {
        console.log('      UNREACHABLE BY CONSTRUCTION: no state file declares this site, and');
        console.log('      game/src/sim/npc.js spawns a site-posted person ONLY from the state that');
        console.log('      names their site. This person is in no scenario, so nothing they say —');
        console.log(`      their pool lines or their hand-written greeting — can reach a player.`);
        console.log('      One state file naming this site is the whole fix; it is world placement,');
        console.log('      not dialogue, and this check will not invent it.');
      } else {
        console.log('      Not reached in the states given — add the state that holds them to --states.');
      }
      failures.push({
        kind: 'scope',
        where: m.id,
        why: byConstruction
          ? `unreachable by construction: post site "${site}" is declared by no state file, so this ${OWNED.group} speaker is in no scenario`
          : `expected ${OWNED.group} speaker not reached in the states given`,
        text: '',
      });
    }
  }
  for (const l of leaks) failures.push({ kind: 'spoken-pattern', where: `${l.state}/${l.prc || 'hand'}/${l.eid}`, why: matchAny(l.text), text: l.text });
  for (const r of residue) failures.push({ kind: 'spoken-regression', where: `${r.state}/${r.prc || 'hand'}/${r.eid}`, why: 'the flagged fragment is still spoken', text: r.text });
  if (ownedSpoken.length && carryingOwned.length !== ownedSpoken.length) {
    failures.push({ kind: 'wiring', where: `${OWNED.group}/${OWNED.class}`, why: `${ownedSpoken.length - carryingOwned.length} spoken line(s) do not carry the owned ADDRESS — the shipped table and the spoken output disagree`, text: '' });
  }

  return {
    states, races_requested: racesRequested, race_classes_engine_derived: derivedClasses,
    race_request_took_effect: derivedClasses.length >= racesRequested.length,
    hand_written_greeting_npcs: rows.filter((r) => r.hand_written).length,
    npc_rows: rows.length, distinct_greetings: distinct.size,
    bwc_speakers_expected: expected, bwc_speakers_reached: [...reached],
    spoken_pattern_hits: leaks.length, flagged_fragment_spoken: residue.length,
    owned_lines_heard: ownedSpoken.length, owned_lines_carrying_address: carryingOwned.length,
    sample_owned_lines: [...new Set(ownedSpoken.map((s) => s.text))].slice(0, 30),
    page_errors: pageErrors,
    talk_errors: rows.filter((r) => r.err).map((r) => ({ eid: r.eid, err: r.err })).slice(0, 10),
  };
}

main().catch((e) => { console.error(`FAIL (harness): ${e && e.stack ? e.stack : e}`); process.exit(3); });
