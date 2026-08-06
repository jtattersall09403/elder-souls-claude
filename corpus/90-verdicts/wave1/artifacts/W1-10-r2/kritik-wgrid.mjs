// INDEPENDENT critic instrument, W1-10 round 2. Written by critic.weapons, not by the builder.
// It shares NOTHING with tools/harness/critic-w1-10c.mjs or tools/weapons/verify-frames.mjs
// except the game's own modules. One run per (weapon, state, frame k): enter the state with real
// scripted input, press the button on frame k, and record what the RUNTIME actually started —
// the slot, the clip id, the frame triple, and the per-frame pose the clip produced.
'use strict';
import fs from 'node:fs';
import { NodeArena, loadCombatData } from '/home/user/elder-souls-claude/tools/lib/combat-node.mjs';

const D = loadCombatData();
const OUT = process.argv[2] || '/dev/stdout';

// One weapon per weight tier, plus the four spine ids probe C used in round 1.
const WEAPONS = [
  { id: 'dagger', tier: 'LIGHT' },
  { id: 'straight-sword', tier: 'MEDIUM' },
  { id: 'axe', tier: 'HEAVY' },
  { id: 'ultra-greatsword', tier: 'ULTRA' },
];

function mkArena(weapon, extra = {}) {
  return new NodeArena({ data: D, loadout: { weapon, ...extra } });
}

/** Script prefixes that put the player into each enclosing state, and when the state begins. */
const ENTER = {
  ROLL: { script: [{ f: 2, move: [0, 1] }, { f: 3, press: ['roll'] }, { f: 4, release: ['roll'] }], startFrame: 3 },
  BACKSTEP: { script: [{ f: 3, press: ['roll'] }, { f: 4, release: ['roll'] }], startFrame: 3 },
  SPRINT: { script: [{ f: 2, move: [0, 1] }, { f: 2, press: ['sprint'] }], startFrame: 3 },
  AIRBORNE: { script: [{ f: 3, press: ['jump'] }, { f: 4, release: ['jump'] }], startFrame: 3 },
  BLOCK: { script: [{ f: 2, press: ['block'] }], startFrame: 3 },
};

/** Run one (weapon, state, k, button) trial. Returns the ACTION_START that fired, if any. */
function trial(weaponId, state, k, button, opts = {}) {
  const a = mkArena(weaponId, opts.loadout || {});
  const e = ENTER[state];
  const pressF = e.startFrame + k;      // k = frames into the enclosing state
  const script = e.script.slice();
  if (opts.moveDuringPress) script.push({ f: pressF, move: opts.moveDuringPress });
  script.push({ f: pressF, press: [button] });
  script.push({ f: pressF + 2, release: [button] });
  a.queueInputs(script);
  const seen = [];
  const poses = [];
  for (let i = 0; i < 240; i++) {
    a.step();
    for (const ev of a.drain()) {
      if (ev.kind === 'ACTION_START' && ev.tag === 'attack') seen.push({ f: ev.f, ...ev });
      if (ev.kind === 'INPUT_DROPPED') seen.push({ f: ev.f, kind: 'DROP', reason: ev.reason });
      if (ev.kind === 'INPUT_BUFFERED') seen.push({ f: ev.f, kind: 'BUF', reason: ev.reason });
    }
    const m = a.player.move;
    if (m && m.kind === 'attack') poses.push({ f: a.frame, slot: m.slot, anim: m.anim, af: a.player.animFrame });
  }
  const start = seen.find((s) => s.kind === 'ACTION_START');
  const drop = seen.find((s) => s.kind === 'DROP');
  return {
    fired: !!start,
    slot: start ? start.anim_slot : null,
    anim: start ? start.anim : null,
    frames: start ? [start.startup, start.active, start.recovery] : null,
    from_state: start ? start.from_state : null,
    at_state_frame: start ? start.from_state_frame : null,
    reason: start ? start.reason : (drop ? drop.reason : null),
    buffered: seen.some((s) => s.kind === 'BUF'),
    pose_frames: poses.length,
  };
}

/** Standing r1.1 / r2 baseline for a weapon, for the fallback comparison. */
function baseline(weaponId, button) {
  const a = mkArena(weaponId);
  a.queueInputs([{ f: 3, press: [button] }, { f: 5, release: [button] }]);
  let start = null;
  for (let i = 0; i < 200; i++) {
    a.step();
    for (const ev of a.drain()) if (ev.kind === 'ACTION_START' && ev.tag === 'attack' && !start) start = ev;
  }
  return start ? { slot: start.anim_slot, anim: start.anim, frames: [start.startup, start.active, start.recovery] } : null;
}

const report = { generated: new Date().toISOString(), instrument: 'kritik-wgrid.mjs (critic-authored)', grid: {}, baselines: {}, cfs: {} };

const SPAN = { ROLL: 60, BACKSTEP: 50, SPRINT: 46, AIRBORNE: 44, BLOCK: 40 };
const BUTTON = { ROLL: 'light', BACKSTEP: 'light', SPRINT: 'light', AIRBORNE: 'light', BLOCK: 'light' };

for (const w of WEAPONS) {
  report.baselines[w.id] = { r1: baseline(w.id, 'light'), r2: baseline(w.id, 'heavy') };
  report.grid[w.id] = {};
  for (const st of Object.keys(ENTER)) {
    const row = [];
    for (let k = 0; k <= SPAN[st]; k++) row.push(trial(w.id, st, k, BUTTON[st]));
    report.grid[w.id][st] = row;
  }
}

// CFS_live, my definition, deliberately stricter than the builder's: an instance counts as
// CONTEXTUAL only if (a) something fired inside the state, (b) its slot id is the contextual
// slot the state maps to, AND (c) its clip id AND frame triple both differ from the standing
// baseline of the same button. A distinct id playing the standing clip is a FALLBACK.
const CTX_SLOT = { ROLL: 'roll.r1', BACKSTEP: 'backstep.r1', SPRINT: 'run.r1', AIRBORNE: 'jump.r1', BLOCK: null };
let contextual = 0, fallback = 0, absent = 0, total = 0;
const detail = [];
for (const w of WEAPONS) {
  for (const st of Object.keys(ENTER)) {
    total++;
    const base = report.baselines[w.id].r1;
    const hits = report.grid[w.id][st].filter((t) => t.fired && t.from_state === (st === 'BLOCK' ? 'BLOCK_HOLD' : st));
    if (!hits.length) { absent++; detail.push({ w: w.id, st, verdict: 'ABSENT' }); continue; }
    const h = hits[0];
    const wantSlot = CTX_SLOT[st];
    const sameClip = base && h.anim === base.anim;
    const sameFrames = base && JSON.stringify(h.frames) === JSON.stringify(base.frames);
    const ok = (wantSlot === null ? h.slot !== 'r1.1' : h.slot === wantSlot) && !sameClip && !sameFrames;
    if (ok) { contextual++; detail.push({ w: w.id, st, verdict: 'CONTEXTUAL', slot: h.slot, anim: h.anim, frames: h.frames, at: h.at_state_frame }); }
    else { fallback++; detail.push({ w: w.id, st, verdict: 'FALLBACK', slot: h.slot, anim: h.anim, base_anim: base && base.anim }); }
  }
}
report.cfs = { total, contextual, fallback, absent, CFS_live: contextual / total, detail };
fs.writeFileSync(OUT, JSON.stringify(report, null, 1));
console.log(`CFS_live ${(contextual / total).toFixed(4)}  contextual ${contextual} fallback ${fallback} absent ${absent} of ${total}`);
for (const d of detail) console.log(' ', d.w.padEnd(18), d.st.padEnd(10), d.verdict.padEnd(11), d.slot || '', d.anim || '', d.frames ? d.frames.join('/') : '');
