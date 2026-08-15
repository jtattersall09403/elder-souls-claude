/**
 * subject-proximity.mjs — pick the NPCs that are actually AT the stand you enumerated them from.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * WHY THIS FILE EXISTS: `import { selectByProximity } from './f10-r3-materials.mjs'` DETONATES
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 *
 * `f10-r3-materials.mjs` exports `selectByProximity` and its header invites other tools to import
 * it. But it is a SCRIPT, not a library: its only early exit is an `--self-test` block, and after
 * that its module body unconditionally calls `launchForCapture(...)`, runs a complete 76-frame
 * sweep, and ends in `process.exit()` at line 377. **Importing it therefore runs r3's capture and
 * kills the importing process before a line of the importer executes.**
 *
 * This is not a theory. It was measured on a rented RTX A4500 on 2026-08-15, run
 * `20260815-123332Z-1200`: the Pod was told to run `f10-r5-appearance.mjs`, and the manifest that
 * came home says `"tool": "f10-r3-materials"`, `"seed": 20260814`, 76 frames in r3's slots
 * (B3/C1/C4/M) and none of r5's. Cost of learning it: $0.019.
 *
 * **`tools/visual/f10-r4-digits.mjs` carries the identical import at its line 40.** So round 4's
 * capture tool could never have produced its own H1/H2/F1 shot list either — a second, independent
 * reason that round reported *"ZERO frames in over thirty minutes"* on top of SwiftShader being
 * slow. That tool has not been edited here: `node tools/ownership.mjs --for` reports
 * `tools/visual/` claimed by live piece `W1-30V`, so this file is added alongside rather than
 * fixing theirs. The proper repo fix is a main-module guard in `f10-r3-materials.mjs`
 * (`if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url))`,
 * exactly as `gpu-deck.mjs:433` already does), and it belongs to whoever holds that file.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * WHAT THE FUNCTION IS FOR
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 *
 * `engine.listEntities()` (`game/src/engine.js:11607`) is NOT range-filtered — it returns every
 * NPC in the simulation, wherever it is. Capture tools logged "N npc(s) in range" and then took
 * the first N in list order, and the camera dutifully orbited open sea. Measured on the same Pod
 * run: at stand `char-player`, **60 NPCs enumerated, 27 within 80 m, median offset 5,720 m**; at
 * `street-gideon`, 109 enumerated and 82 rejected. 148 rejections across three stands in one run.
 *
 * The fix is SELECTION, not detection: a liveness gate that rejects an empty frame afterwards has
 * already paid for it.
 *
 * The 80 m threshold is DECLARED, not derived — `game/data/npcs/*.json` carries a position on 0 of
 * 408 records because placement is a run-time property of the sim — so every caller is expected to
 * publish `distances` into its manifest, letting the next reader recalibrate against the real
 * population rather than inherit this number.
 */

/**
 * @param npcs   whatever `listEntities()` returned, already filtered to kind === 'npc'
 * @param stand  { id, x, z } the stand the player was teleported to before enumerating
 * @param maxOffsetM  DECLARED, not derived — see above. Default 80 m, about a settlement's extent.
 * @returns { kept, rejected, distances } — `distances` is the full population, for the manifest.
 */
export function selectByProximity(npcs, stand, maxOffsetM = 80) {
  const withDist = npcs.map((e) => {
    const p = e.pos || [0, 0, 0];
    return { ...e, stand, offset_m: Math.hypot(p[0] - stand.x, p[2] - stand.z) };
  }).sort((a, b) => a.offset_m - b.offset_m);
  const kept = withDist.filter((e) => e.offset_m <= maxOffsetM);
  const rejected = withDist.filter((e) => e.offset_m > maxOffsetM).map((e) => ({
    eid: e.eid, name: e.name, race: e.race, pos: e.pos, offset_m: +e.offset_m.toFixed(1),
    reason: `enumerated at stand ${stand.id} but ${e.offset_m.toFixed(0)} m from it — listEntities() is not range-filtered (engine.js:11607), so list order is not proximity`,
  }));
  const d = withDist.map((e) => +e.offset_m.toFixed(1));
  return {
    kept,
    rejected,
    distances: {
      stand: stand.id, n: d.length,
      min: d[0] ?? null, p10: d[Math.floor(d.length * 0.1)] ?? null,
      median: d[Math.floor(d.length / 2)] ?? null,
      p90: d[Math.floor(d.length * 0.9)] ?? null, max: d[d.length - 1] ?? null,
      within_max_offset: kept.length, beyond_max_offset: rejected.length,
      all_m: d,
    },
  };
}

/**
 * Prove this copy still agrees with the one in `f10-r3-materials.mjs` — WITHOUT importing that
 * file, because importing it is the whole problem. The source text of the function is extracted
 * from both files and compared; drift shows up as a diff rather than as two tools quietly
 * selecting different subjects for two arms of one experiment.
 */
export function sourceMatchesR3(fs, path, repoRoot) {
  const cut = (text) => {
    const start = text.indexOf('export function selectByProximity(');
    if (start < 0) return null;
    let depth = 0, i = text.indexOf('{', start);
    const from = i;
    for (; i < text.length; i++) {
      if (text[i] === '{') depth++;
      else if (text[i] === '}') { depth--; if (depth === 0) return text.slice(from, i + 1).replace(/\s+/g, ' ').trim(); }
    }
    return null;
  };
  const mine = cut(fs.readFileSync(path.join(repoRoot, 'tools/visual/lib/subject-proximity.mjs'), 'utf8'));
  const r3Path = path.join(repoRoot, 'tools/visual/f10-r3-materials.mjs');
  const theirs = fs.existsSync(r3Path) ? cut(fs.readFileSync(r3Path, 'utf8')) : null;
  // engine.js:11517 -> 11607 is a line-number correction in a comment inside the rejection reason,
  // not a behavioural difference; it is normalised out so the check tracks logic, not prose.
  const norm = (s) => (s ? s.replace(/engine\.js:\d+/g, 'engine.js:N') : s);
  return { mine: Boolean(mine), theirs: Boolean(theirs), identical: norm(mine) !== null && norm(mine) === norm(theirs) };
}
