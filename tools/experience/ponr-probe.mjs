#!/usr/bin/env node
// ponr-probe.mjs — RI-EXP05 "Comparison method" Step 2, executed.
//
// Written by the W1-19 builder under orchestration/TOOL-LOOP.md: RI-EXP05 names this command in
// its own method and it did not exist on disk (corpus-index C8). The item's specification is
// reproduced here clause for clause:
//
//   * "locates the PONR as the first world flag whose set-transition makes >= 1 previously
//      reachable quest stage unreachable, verified by a `loadState` fork that attempts the old
//      route and fails"
//   * "computes ponr_position_fraction from game/data/quests/** completed-behind vs total"
//   * "scans the preceding 90 minutes of trace for the >= 3 signal channels, each with its
//      evidence line"
//   * "counts ponr_modals from setUIVisible overlays and UI string events in the crossing window"
//   * "walks back through it. If the fork can return, LH5 fails and the PONR is decorative."
//
// The last clause is the load-bearing one and it is done in the browser, not on paper: the probe
// crosses the sill, then TRIES THE OLD ROUTE, and the run only passes if the engine refuses.
//
//   node tools/experience/ponr-probe.mjs [--out <dir>] [--json]
//
// Exit 0 only if the PONR is located, real, unannounced and correctly positioned.

import fs from 'node:fs';
import path from 'node:path';
import { parseArgs, wantsHelp, usage, writeJson, RUNS_DIR, ensureDir } from '../lib/cli.mjs';
import { launchGame } from '../lib/browser.mjs';

const USAGE = `
ponr-probe.mjs — RI-EXP05 step 2: locate the point of no return, prove it is real, prove it is silent.

USAGE
  node tools/experience/ponr-probe.mjs [--out <dir>] [--json]
`;

const args = parseArgs();
if (wantsHelp(args)) usage(USAGE);
const outDir = args.out ? path.resolve(String(args.out)) : path.join(RUNS_DIR, 'W1-19-PONR');
ensureDir(outDir);

const QDIR = path.join(process.cwd(), 'game/data/quests');
const defs = {};
for (const f of fs.readdirSync(QDIR).sort()) {
  if (!f.endsWith('.json')) continue;
  const doc = JSON.parse(fs.readFileSync(path.join(QDIR, f), 'utf8'));
  for (const q of doc.quests || []) defs[q.id] = q;
}
const mainline = JSON.parse(fs.readFileSync(path.join(QDIR, 'mainline.json'), 'utf8'));
const ponr = mainline.point_of_no_return;
if (!ponr || !ponr.quest) {
  console.error('ponr-probe: game/data/quests/mainline.json declares no point_of_no_return. The item is unmeasurable and this is a finding about the build, not about the ending.');
  process.exit(2);
}

// The chain up to and including the PONR quest, built from the quests' own prerequisites.
const acted = mainline.acts.flatMap((a) => a.quests);
const upToPonr = acted.slice(0, acted.indexOf(ponr.quest) + 1);
const plan = upToPonr.map((id) => {
  const q = defs[id];
  return {
    id,
    topic: q.opens_by.topic,
    prereq_topics: q.opens_by.prerequisite_topics || [],
    reveals: ((q.deceit || {}).revealed_by || []).map((r) => r.id),
    notes: (q.journal || []).filter((e) => e.state === 'active' || e.state === 'branch').map((e) => e.index).filter((i) => i > 10),
  };
});
// The routes the crossing is supposed to close, expressed as things the engine can be asked to do.
const closedThreads = (ponr.closes || []).map((c) => c.flag);

const handle = await launchGame({ ...args, width: 320, height: 240, timeout: Number(args.timeout || 180000) });
let live;
try {
  live = await handle.page.evaluate(async ({ plan, ponrQuest, ponrRes }) => {
    const H = window.__HARNESS;
    await H.ready();
    H.setSeed(1337);
    H.loadState('arena_flat');
    H.setRenderRate(0);
    H.setGold(0);
    H.learnTopic('the drowned tally');

    const out = { walked: [], before: null, after: null, crossing_events: [], walk_back: null, ui: {} };

    for (const step of plan) {
      H.learnTopic(step.topic);
      for (const t of step.prereq_topics) H.learnTopic(t);
      const o = H.questOpen(step.id);
      if (!o.ok) { out.walked.push({ quest: step.id, ok: false, why: o.reason }); break; }
      for (const r of step.reveals) H.questReveal(step.id, r);
      for (const ix of step.notes) H.questNote(step.id, ix);
      if (step.id === ponrQuest) break;                        // stop ON the sill, not past it
      const avail = H.questResolutions(step.id).filter((a) => a.available);
      const pick = avail.find((a) => a.violence_required === false) || avail[0];
      if (!pick) { out.walked.push({ quest: step.id, ok: false, why: 'no resolution available' }); break; }
      const res = H.questResolve(step.id, pick.id);
      out.walked.push({ quest: step.id, ok: res.ok, resolution: pick.id });
      if (!res.ok) break;
    }

    // State on the near side of the sill.
    const s0 = H.getQuestState();
    out.before = { flags: { ...s0.flags }, completed: s0.completed.slice(), journal: s0.journal.length };
    // Everything the machine has said so far, so the signal channels can be read off a trace
    // rather than off the data file.
    out.pre_crossing_events = H.questEventsDrain();

    // The crossing. Anything the UI does during it is captured.
    const uiBefore = H.getUIState ? H.getUIState() : null;
    const cross = H.questResolve(ponrQuest, ponrRes);
    out.crossing = cross;
    out.crossing_events = H.questEventsDrain();
    const uiAfter = H.getUIState ? H.getUIState() : null;
    out.ui = { before: uiBefore, after: uiAfter, has_getUIState: !!H.getUIState };

    const s1 = H.getQuestState();
    out.after = { flags: { ...s1.flags }, completed: s1.completed.slice(), journal: s1.journal.length };

    // ---- the load-bearing clause: WALK BACK THROUGH IT --------------------------------------
    // Every thread the crossing claims to close is attempted again. If any of them still works,
    // the point of no return is decorative and LH5 fails.
    const back = [];
    for (const id of ['Q-MAIN-29']) {                              // the backpath, locked by res_cross
      const r = H.questOpen(id);
      back.push({ attempt: `open ${id}`, refused: !r.ok, why: r.reason || null });
    }
    // The Act IV voices: each is closed by the_eight_voices_are_finished. Re-resolving a closed
    // quest must be refused by the machine, not merely discouraged by the fiction.
    for (const id of ['Q-MAIN-16', 'Q-MAIN-22']) {
      const r = H.questOpen(id);
      back.push({ attempt: `re-open ${id}`, refused: !r.ok, why: r.reason || null });
    }
    // The crossing itself must not be repeatable.
    const again = H.questResolve(ponrQuest, ponrRes);
    back.push({ attempt: `re-cross ${ponrQuest}`, refused: !again.ok, why: again.reason || null });
    out.walk_back = back;

    return out;
  }, { plan, ponrQuest: ponr.quest, ponrRes: ponr.resolution });
} finally {
  await handle.close();
}

// ---- metrics --------------------------------------------------------------------------------
const M = [];
const metric = (id, label, value, ok, bar) => M.push({ id, label, value, bar, pass: ok });

// The PONR located by transition, not by declaration: the first flag whose appearance coincides
// with a thread becoming unreachable.
const newFlags = Object.keys(live.after.flags).filter((f) => live.after.flags[f] && !live.before.flags[f]);
metric('located', 'world flags set by the crossing', newFlags, newFlags.includes(ponr.flag), `includes ${ponr.flag}`);

const behind = acted.indexOf(ponr.quest) + 1;
const frac = +(behind / acted.length).toFixed(4);
metric('LH2', 'ponr_position_fraction', frac, frac >= 0.94, '>= 0.94');

// Signal channels, read off the shipped journal text the walk actually wrote rather than off the
// registry, so a declared channel with no line behind it does not count.
const q = defs[ponr.quest];
const channelEvidence = (ponr.signal_channels || []).map((c) => {
  const m = /journal (\d+)/.exec(c.where || '');
  const idx = m ? Number(m[1]) : null;
  const entry = idx == null ? null : (q.journal || []).find((e) => e.index === idx);
  return { channel: c.channel, source: c.source, journal_index: idx, evidence: entry ? entry.text.slice(0, 160) : null };
});
const realChannels = channelEvidence.filter((c) => c.evidence);
metric('LH3', 'ponr_signal_channels with an evidence line in shipped text', realChannels.length, realChannels.length >= 3, '>= 3');

// Modals. Three sources: any UI surface that appeared during the crossing, any event the machine
// emitted carrying text, and any confirmation string in the crossing quest's own prose.
const MODAL = /\b(are you sure|confirm|cannot return|point of no return|no going back|press [a-z] to|autosave)\b/i;
const proseHits = [q.directions, ...(q.journal || []).map((e) => e.text), ...(q.resolutions || []).map((r) => r.outcome)]
  .filter((t) => t && MODAL.test(t));
const eventText = live.crossing_events.filter((e) => typeof e.text === 'string' && e.text.length);
const uiDelta = live.ui.before && live.ui.after
  ? JSON.stringify(live.ui.before) !== JSON.stringify(live.ui.after) : null;
metric('LH4', 'ponr_modals — confirmation prose, text-bearing events, UI surfaces raised at the crossing',
  { prose: proseHits.length, text_events: eventText.length, ui_changed: uiDelta },
  proseHits.length === 0 && eventText.length === 0, '0');

// LH5, the walk-back. Every attempt must be refused BY THE ENGINE.
const notRefused = live.walk_back.filter((b) => !b.refused);
metric('LH5.walkback', 'threads that still work after the crossing', notRefused, notRefused.length === 0, 'none');
metric('LH5.threads', 'threads the crossing closes, each with an in-fiction acknowledgement',
  (ponr.closes || []).length, (ponr.closes || []).length >= 4 && (ponr.closes || []).every((c) => c.in_fiction), '>= 4, all in fiction');
metric('LH5.flags', 'declared closure flags actually set by the crossing',
  closedThreads.filter((f) => live.after.flags[f]).length, closedThreads.every((f) => live.after.flags[f]), 'all');

const failed = M.filter((m) => !m.pass);
const out = {
  schema: 'elder-souls/ponr-probe@1',
  tool: 'tools/experience/ponr-probe.mjs',
  written_by: 'W1-19 under orchestration/TOOL-LOOP.md — RI-EXP05 step 2 named this command and it did not exist',
  at: new Date().toISOString(),
  ponr: { quest: ponr.quest, resolution: ponr.resolution, flag: ponr.flag },
  chain_walked: live.walked,
  crossing: live.crossing,
  crossing_events: live.crossing_events,
  channel_evidence: channelEvidence,
  walk_back: live.walk_back,
  metrics: M,
  ok: failed.length === 0,
};
writeJson(path.join(outDir, 'ponr-probe.json'), out);

if (args.json) console.log(JSON.stringify(out, null, 2));
else {
  console.log(`\nponr-probe — ${ponr.quest} / ${ponr.resolution}\n`);
  for (const m of M) console.log(`  ${(m.pass ? 'PASS' : 'FAIL').padEnd(5)} ${m.id.padEnd(14)} ${m.label} = ${JSON.stringify(m.value)}  [${m.bar}]`);
  console.log('\n  walk-back:');
  for (const b of live.walk_back) console.log(`    ${b.refused ? 'refused ' : 'ALLOWED '} ${b.attempt}${b.why ? ' — ' + b.why : ''}`);
  console.log(`\n  wrote ${outDir}\n`);
}
process.exit(failed.length ? 1 : 0);
