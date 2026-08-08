#!/usr/bin/env node
// The picture for W1-20: the door being shut, in the doorkeeper's own words.
//
// A private browser rather than `tools/capture/`, and the reason is rule 20's own test: this is
// not a photograph of a place, it is a photograph of the HUD in a state that has to be DRIVEN —
// a faction standing set, `Engine.factionRefusal()` called, and the toast the call raises drawn
// by the shipped renderer. The capture daemon places a camera; it cannot put a rank on a player.
//
// Run: node tools/quests/w1-20-shot.mjs

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { launchGame } from '../lib/browser.mjs';
import { parseArgs } from '../lib/cli.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = path.join(ROOT, 'docs', 'shots', '2026-08-08-w1-20-the-drowned-court-says-no-in-its-own-words.png');

const args = parseArgs(process.argv.slice(2));
const game = await launchGame(args, { usage: '' });

const said = await game.page.evaluate(() => {
  const H = window.__HARNESS;
  H.setRenderRate(0);
  H.setCharacter({ race: 'saxhleel', upbringing: 'interior', class: 'root-speaker', birthsign: 'raj-xul' });
  // A player who has joined the Drowned Court and is asking for the rank above the one they hold.
  // Before this piece there was no way to be here at all: nothing in the build joined this faction
  // and Q-SOUL-02 has carried `rank_gate: the_drowned_court >= 2` since it was written.
  H.setFactionStanding('the_drowned_court', { member: true, rank: 1, reputation: 12 });
  H.syncFactionStandings();
  const r = H.factionRefusal('the_drowned_court', 2);
  H.renderFrame();
  return r.said;
});

fs.mkdirSync(path.dirname(OUT), { recursive: true });
await game.page.screenshot({ path: OUT });
await game.close();
console.log(`said: ${said}`);
console.log(`wrote ${OUT}`);
