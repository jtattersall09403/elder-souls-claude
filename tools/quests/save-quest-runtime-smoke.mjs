#!/usr/bin/env node
/**
 * W1-19 regression smoke for QuestEngine references after a save-blob load.
 *
 * This is a disposable structural harness test, not canonical quest progression. It uses one
 * direct quest transition after restoring the real Q30 fixture so a detached Journal and a
 * clobbered earned-disposition register are both observable in a few frames.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { ensureDir, parseArgs, RUNS_DIR, usage, wantsHelp, writeJson } from '../lib/cli.mjs';
import { launchGame } from '../lib/browser.mjs';

const args = parseArgs();
if (wantsHelp(args)) usage('save-quest-runtime-smoke.mjs [--chromium PATH] [--out DIR]');
const outDir = path.resolve(String(args.out || path.join(RUNS_DIR, 'W1-19-builder-persistent', 'save-quest-runtime')));
ensureDir(outDir);
const fixturePath = path.resolve('evidence/W1-19/fixtures/resume-saxhleel-interior-intended-q30.json');
const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
const sha256 = (p) => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const expectedDisposition = fixture.dialogue.dispositions['undersexton-aveline-rell'];

const handle = await launchGame({ ...args, width: 640, height: 360, timeout: Number(args.timeout || 180000) });
const browserVersion = handle.browser.version();
let observed;
try {
  observed = await handle.page.evaluate(async ({ fixture, expectedDisposition }) => {
    const H = window.__HARNESS;
    await H.ready();
    H.setRenderRate(0);
    H.restoreState(fixture);
    H.clearInputs();
    H.stepFrames(2);
    const beforeState = H.getQuestState();
    const beforeSave = H.saveState();
    const opened = H.questOpen('Q-MAIN-16');
    const afterState = H.getQuestState();
    const afterSave = H.saveState();
    return {
      expected_disposition: expectedDisposition,
      loaded_disposition_before: beforeSave.dialogue.dispositions['undersexton-aveline-rell'],
      loaded_disposition_after: afterSave.dialogue.dispositions['undersexton-aveline-rell'],
      opened,
      journal_before: beforeState.journal.length,
      journal_live_after: afterState.journal.length,
      journal_saved_after: afterSave.journal.length,
      live_tail: afterState.journal.at(-1) || null,
      saved_tail: afterSave.journal.at(-1) || null,
      fixture_completed: beforeSave.quests_completed.length,
    };
  }, { fixture, expectedDisposition });
} finally {
  await handle.close();
}

const failures = [];
if (observed.loaded_disposition_before !== expectedDisposition || observed.loaded_disposition_after !== expectedDisposition) {
  failures.push(`loaded disposition changed from serialized ${expectedDisposition}`);
}
if (!observed.opened?.ok) failures.push(`Q-MAIN-16 structural transition refused: ${observed.opened?.reason || 'unknown'}`);
if (observed.journal_live_after !== observed.journal_before + 1) failures.push('live journal did not receive exactly one post-load entry');
if (observed.journal_saved_after !== observed.journal_before + 1) failures.push('H.saveState() did not persist the post-load journal entry');
if (observed.live_tail?.quest !== 'Q-MAIN-16' || observed.saved_tail?.quest !== 'Q-MAIN-16') failures.push('Q-MAIN-16 is not the live/saved journal tail');

const sourceFiles = ['game/src/engine.js', 'game/src/sim/quest/machine.js', 'game/src/sim/quest/journal.js', 'tools/quests/save-quest-runtime-smoke.mjs'];
const result = {
  schema: 'elder-souls/w1-19-save-quest-runtime-smoke@1',
  tool: 'tools/quests/save-quest-runtime-smoke.mjs',
  canonical_progression: false,
  structural_harness_transition: true,
  ok: failures.length === 0,
  fixture: path.relative(process.cwd(), fixturePath),
  fixture_sha256: sha256(fixturePath),
  browser_version: browserVersion,
  source_hashes: Object.fromEntries(sourceFiles.map((p) => [p, sha256(p)])),
  observed,
  failures,
};
writeJson(path.join(outDir, 'save-quest-runtime-smoke.json'), result);
console.log(`save quest-runtime smoke: ${result.ok ? 'PASS' : 'FAIL'}; journal ${observed.journal_before}->${observed.journal_saved_after}; disposition ${observed.loaded_disposition_before}/${expectedDisposition}`);
console.log(`wrote ${path.join(outDir, 'save-quest-runtime-smoke.json')}`);
if (!result.ok) process.exit(1);
