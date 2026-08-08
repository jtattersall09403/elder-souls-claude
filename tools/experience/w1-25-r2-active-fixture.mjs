#!/usr/bin/env node
// w1-25-r2-active-fixture.mjs — RULES #8: A STILL TARGET HIDES EVERY STEERING DEFECT.
//
// W1-25 round 1 published `verified_anecdotes_per_hour = 0` and phrased it as a property of the
// recorder: "0 by construction on every trace this project has ever recorded". The r1 verdict
// (§E) took that apart against the three candidates, and the fault is neither of the two the
// piece pointed at:
//
//   NOT THE RECORDER.    The same trace writer emits 493-553 events in W1-09's combat exemplars,
//                        across 24-28 kinds, including hit, stagger, guard_break, block_success,
//                        death and detect. 77 traces on this tree carry 5,267 events; 34 carry
//                        more than five.
//   NOT THE VOCABULARY.  `game/src/sim/events.js` holds 179 names and every consequence name an
//                        anecdote needs is present. RULES #15 does not bite here.
//   THE FIXTURE.         `reports/sessions/exp-w1-opening/` is 36,000 frames and 82 MB with ZERO
//                        events — and its `ops.json` IS AN EMPTY ARRAY. Nobody drove it. It was
//                        `--drive none`: a ten-minute walk that never fights, talks, takes or
//                        dies. RULES #8 exactly, and the easiest fixture collected the most data
//                        and distinguished nothing.
//
// So this builds the other fixture and measures the same number against it. It drives
// `session-run.mjs` over its stdio protocol, BRANCHING on what the world reports back rather
// than firing a fixed script at coordinates that may not contain anything: find a real NPC and
// talk to it, learn a topic, take a real object, spawn and fight a real encounter, die, come
// back for the bloodstain, rest, save. Then `anecdote-trace.mjs` runs over the trace it produced
// and over the still one, and the two numbers are compared THROUGH `lib/sabotage.mjs` — because
// "the still fixture and the active fixture produced the same number" is precisely a control
// whose arms agree, and this piece owns the facility that says so.
//
// PROFILE. `--profile free`, and that is a real limitation stated up front: RI-EXP01's
// `first-hour` profile refuses spawn/aggro/teleport because an hour you were teleported through
// is not a discoverable hour. This fixture is not measuring discoverability. It is answering a
// narrower question — CAN A SESSION ON THIS BUILD PRODUCE CONSEQUENCE EVENTS AT ALL — and to
// answer it, it uses the debug surface deliberately. A run under this tool is NOT an RI-EXP01
// session and must never be reported as one. The manifest records the profile.
//
//   node tools/experience/w1-25-r2-active-fixture.mjs [--minutes 4] [--seed 1337]
//   node tools/experience/w1-25-r2-active-fixture.mjs --measure-only   (no browser; re-measure)
//
// EXIT: 0 · 1 the active fixture produced no more events than the still one (the fixture change
//       is inert, which is the same failure one level up) · 2 the session could not be driven.
'use strict';

import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { runControl, VERDICT } from './lib/sabotage.mjs';
import { readEvents } from './anecdote-trace.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..');
const argv = process.argv.slice(2);
const has = (k) => argv.includes(`--${k}`);
const arg = (k, d) => { const i = argv.findIndex((a) => a === `--${k}` || a.startsWith(`--${k}=`)); if (i < 0) return d; const a = argv[i]; return a.includes('=') ? a.slice(a.indexOf('=') + 1) : argv[i + 1]; };
const say = (s) => process.stdout.write(s + '\n');

const SESSION = 'w1-25-r2-active';
const OUT_DIR = `reports/sessions/${SESSION}`;
const STILL = 'reports/sessions/exp-w1-opening/trace.jsonl';

// ---------------------------------------------------------------------------------------------
// The driver. One JSON op per line to the child's stdin; one JSON reply per line back.

function driver({ minutes, seed }) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [
      'tools/experience/session-run.mjs',
      '--session', SESSION, '--seed', String(seed), '--minutes', String(minutes),
      '--profile', 'free', '--render-policy', 'never', '--drive', 'stdio',
      '--out', OUT_DIR,
    ], { cwd: REPO, stdio: ['pipe', 'pipe', 'inherit'] });

    const rl = readline.createInterface({ input: child.stdout });
    const queue = [];
    let waiting = null;
    rl.on('line', (l) => {
      if (!l.startsWith('{')) { say(`  [session] ${l}`); return; }
      let o; try { o = JSON.parse(l); } catch { return; }
      if (waiting) { const w = waiting; waiting = null; w(o); } else queue.push(o);
    });
    const send = (op) => new Promise((res) => {
      const take = () => { if (queue.length) res(queue.shift()); else waiting = res; };
      child.stdin.write(JSON.stringify(op) + '\n');
      take();
    });

    const log = [];
    const call = async (method, args = []) => {
      const r = await send({ op: 'call', method, args });
      const v = r && r.result;
      log.push({ method, args, ok: !!(v && v.ok), error: v && v.error ? v.error : null });
      return v && v.ok ? v.value : null;
    };
    const step = (frames) => send({ op: 'step', frames });
    const note = (text) => send({ op: 'note', text });

    (async () => {
      await step(120);

      // ---- 1. TALK TO SOMEONE REAL. Discovery first: the still session's failure was a script
      // with nothing in it, and a script that talks to a hard-coded npc id that is not in this
      // region is the same failure wearing a costume.
      await note('act 1 — find a real NPC and open a conversation');
      const npcs = await call('listNPCs') || [];
      const npc = (Array.isArray(npcs) ? npcs : npcs.npcs || [])[0];
      const npcId = npc && (npc.id || npc.eid || npc.npc_id);
      if (npcId) { await call('talkTo', [npcId]); await step(60); }

      // ---- 2. LEARN SOMETHING NAMED. A2 wants a proper noun the world can resolve.
      await note('act 2 — learn a topic, which is the noun an anecdote is told with');
      // `questTopicsKnown` is REFUSED under this profile (it is unclassified, and
      // capabilities.mjs fails closed on anything it cannot classify — which is the right
      // default and is recorded here rather than worked around).
      const offers = await call('questOffers') || [];
      const topic = (Array.isArray(offers) && offers.length && (offers[0].topic || offers[0].entry_topic))
        || 'the-sallow-wife';
      await call('learnTopic', [topic]);
      await step(60);

      // ---- 3. TAKE SOMETHING.
      await note('act 3 — take an object off the ground');
      const zones = await call('listPropertyZones') || [];
      const zone = (Array.isArray(zones) ? zones : [])[0];
      const owned = zone ? (await call('listOwnedObjects', [zone.id || zone.zone || zone]) || []) : [];
      const obj = (Array.isArray(owned) ? owned : [])[0];
      if (obj) await call('takeObject', [obj.instance || obj.id]);
      await step(60);

      // ---- 4. A FIGHT. Encounter first (a real roster from world/encounters.json — the same
      // file section D of the verdict is about); fall back to a single statblock.
      await note('act 4 — spawn a real encounter and fight it');
      // `whereAmI` is refused under this profile too; the encounter goes in beside the origin,
      // which is where the player boots.
      const px = 0, pz = 0;
      let ents = await call('spawnEncounter', ['dres-raid-party', px + 4, pz + 4]);
      if (!ents) await call('spawn', ['inf_trash', px + 3, pz + 3]);
      await step(60);
      const live = await call('listEntities') || [];
      for (const e of (Array.isArray(live) ? live : []).slice(0, 4)) {
        const id = e.id || e.eid;
        if (!id) continue;
        await call('aggro', [id]);
        await step(30);
        // `damageEnemy` is refused under this profile (unclassified -> fail-closed). `killEntity`
        // is classified and is the verb that actually produces the death event.
        await call('killEntity', [id]);
        await step(30);
      }

      // ---- 5. DIE, AND COME BACK FOR IT. death -> bloodstain_create -> player_respawn is the
      // shape RI-EXP02 §B calls T3, and it is the one thing a walk can never produce.
      await note('act 5 — die, respawn, recover the bloodstain');
      // The cause is a closed set — killPlayer() refuses an unknown one because `placeStain()`
      // branches on it and a wrong cause would silently take the death_point branch.
      await call('killPlayer', ['combat']);
      await step(180);
      await call('recoverBloodstain');
      await step(60);

      // ---- 6. REST AND SAVE. bonfire_rest and save_write are ACTIONS in the anecdote grammar.
      await note('act 6 — rest at a hearth and write a save');
      const hearths = await call('listHearths') || [];
      const h = (Array.isArray(hearths) ? hearths : [])[0];
      await call('restAt', [h && (h.id || h.name)]);
      await step(120);
      await call('writeSave', ['w1-25-r2-active']);
      await step(120);

      await send({ op: 'end' });
    })().then(() => {
      child.stdin.end();
      child.on('close', (code) => resolve({ code, log }));
    }).catch((e) => { try { child.kill(); } catch { /* */ } reject(e); });
  });
}

// ---------------------------------------------------------------------------------------------

async function measure(rel) {
  const p = path.join(REPO, rel);
  if (!fs.existsSync(p)) return null;
  const { events, frames } = await readEvents(p);
  const kinds = new Map();
  for (const e of events) kinds.set(e.type, (kinds.get(e.type) || 0) + 1);
  return { trace: rel, frames, events: events.length, kinds: kinds.size,
    top: [...kinds.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10) };
}

(async () => {
  let drove = null;
  if (!has('measure-only')) {
    say(`driving an ACTIVE session: ${arg('minutes', '4')} simulated minutes, profile free, ` +
      `branching on what the world reports back.`);
    try { drove = await driver({ minutes: Number(arg('minutes', 4)), seed: Number(arg('seed', 1337)) }); }
    catch (e) { say(`session could not be driven: ${(e && e.message) || e}`); process.exit(2); }
    const okCalls = drove.log.filter((l) => l.ok).length;
    say(`  ${okCalls}/${drove.log.length} harness calls succeeded; session exited ${drove.code}`);
    for (const l of drove.log.filter((x) => !x.ok)) say(`    refused/failed: ${l.method}(${JSON.stringify(l.args)}) — ${l.error}`);
  }

  const active = await measure(`${OUT_DIR}/trace.jsonl`);
  const still = await measure(STILL);
  say('');
  for (const m of [still, active]) {
    if (!m) { say('  (trace missing)'); continue; }
    say(`  ${m.trace}`);
    say(`     ${m.frames} frames · ${m.events} events · ${m.kinds} kinds · ${m.top.map(([k, n]) => `${k}x${n}`).join(' ') || '(none)'}`);
  }

  // ---- THE CONTROL, THROUGH THIS PIECE'S OWN FACILITY -----------------------------------------
  // "Does what the player does in a session change what the session records?" is a control, and
  // the still fixture is its broken arm. If the two arms agree, changing the fixture did nothing
  // and this whole finding is wrong — which is the point of running it here rather than eyeballing
  // two numbers.
  const control = await runControl({
    id: 'w1-25-r2.the-fixture-is-the-fault',
    what: 'does a session that fights, talks, takes and dies record more than a session that walks?',
    metric: 'consequence-bearing event kinds in the session trace',
    unit: 'recorded frames the trace ranged over',
    factors: [{ id: 'still_fixture', what: 'drive nothing — reports/sessions/exp-w1-opening, ops.json === []' }],
    direction: 'lower',
    measure: async (broken) => {
      const m = broken.length ? still : active;
      if (!m) return { value: null, support: 0 };
      return { value: { events: m.events, kinds: m.kinds }, support: m.frames, detail: m.top };
    },
  });
  say('');
  say(`CONTROL  ${control.verdict}`);
  say(`  ${control.why}`);

  const outRel = 'reports/experience/w1-25-r2/fixture.json';
  fs.mkdirSync(path.join(REPO, path.dirname(outRel)), { recursive: true });
  fs.writeFileSync(path.join(REPO, outRel), JSON.stringify({
    tool: 'tools/experience/w1-25-r2-active-fixture.mjs',
    at: new Date().toISOString(),
    rule: 'RULES #8 — a still target hides every steering defect',
    profile: 'free (NOT an RI-EXP01 first-hour session; the debug surface is used on purpose)',
    still, active, ops: drove ? drove.log : null, control,
  }, null, 2) + '\n');
  say(`wrote ${outRel}`);

  if (control.verdict !== VERDICT.OK) {
    say('the active fixture did not separate from the still one. Changing the fixture was inert.');
    process.exit(1);
  }
  process.exit(0);
})();
