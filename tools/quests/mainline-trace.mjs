#!/usr/bin/env node
// Canonical W1-19 two-chain entry point.
//
// The historical implementation behind this filename drove QuestEngine setup verbs directly
// (`questOpen`, `questReveal`, `questNote`, `questResolve`, and `learnTopic`). That made a fast
// structural probe, but W1-19's binding production contract expressly forbids those calls as
// chain evidence. The maintained player-action implementation is mainline-chain-floor.mjs: it
// walks the shipped world, presses ordinary inputs, speaks published conversation choices, reads
// placed documents/marks, and rejects discontinuous travel. Keep one model by delegating here.
//
// Clean use (one cold character per chain by default):
//   node tools/quests/mainline-trace.mjs --out reports/runs/W1-19-mainline-final
//
// The historical drop-topic control maps to the production bootstrap deletion. The old
// drop-reveal/drop-dispo modes relied on the same forbidden setup APIs and therefore fail closed;
// W1-19 exercises knowledge and disposition with matched production checkpoints instead.

import path from 'node:path';
import { spawnSync } from 'node:child_process';

const raw = process.argv.slice(2);
if (raw.includes('--help') || raw.includes('-h')) {
  console.log(`mainline-trace.mjs — W1-19 production-action intended + backpath chains

Usage:
  node tools/quests/mainline-trace.mjs [mainline-chain-floor options]
  node tools/quests/mainline-trace.mjs --sabotage drop-topic

Defaults added when absent: --signature-count 1 --chain both
Historical --sabotage drop-reveal/drop-dispo is intentionally rejected; use the matched Gate B
production observations named by orchestration/plans/W1-19.md.`);
  process.exit(0);
}

const forwarded = [];
for (let i = 0; i < raw.length; i++) {
  if (raw[i] !== '--sabotage') { forwarded.push(raw[i]); continue; }
  const mode = raw[++i];
  if (mode === 'drop-topic') forwarded.push('--sabotage', 'no-bootstrap');
  else if (mode === 'drop-reveal' || mode === 'drop-dispo') {
    console.error(`mainline-trace: historical sabotage '${mode}' used forbidden quest setup APIs; run the W1-19 matched Gate B production control instead.`);
    process.exit(2);
  } else forwarded.push('--sabotage', mode);
}

const has = (name) => forwarded.includes(name);
if (!has('--signature-count')) forwarded.push('--signature-count', '1');
if (!has('--chain')) forwarded.push('--chain', 'both');

const runner = path.resolve('tools/quests/mainline-chain-floor.mjs');
const child = spawnSync(process.execPath, [runner, ...forwarded], {
  cwd: process.cwd(),
  stdio: 'inherit',
  windowsHide: true,
});
if (child.error) {
  console.error(`mainline-trace: failed to start production runner: ${child.error.message}`);
  process.exit(70);
}
process.exit(child.status == null ? 70 : child.status);
