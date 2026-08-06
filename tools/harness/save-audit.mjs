#!/usr/bin/env node
// save-audit.mjs — the RI-JRN05 checks that can be taken from a browser without the
// journey-runner fleet: the round trip, the manifest set-difference, the backend
// attestation, the size budget, corruption handling and export/import recovery.
//
// Spec: corpus/88-journeys/RI-JRN05-save-and-load.md. This tool implements M1, M2, M3, M4,
// M10, M12 (CR2/CR3/CR4/CR12), M13 (CR7/CR8/CR10), M14 (CR11), M16 and M17. It does NOT
// implement M11 (kill-during-write), M5/M6/M7/M8/M9 (which need world, crime, bloodstain
// and journal RUNTIMES this wave does not have) or M15/M18 — those stay unmeasured and are
// listed as such in the output rather than quietly omitted.
import path from 'node:path';
import { parseArgs, wantsHelp, usage, log, EXIT, writeJson, RUNS_DIR, ensureDir } from '../lib/cli.mjs';
import { launchGame } from '../lib/browser.mjs';

const USAGE = `
save-audit.mjs — RI-JRN05 save/load checks, run in-browser.

USAGE
  node tools/harness/save-audit.mjs [--states sv1-midquest,sv5-journal-bloodstain,endgame-200q]

OPTIONS
  --states <ids>   Comma-separated named states to audit (default: the three above plus default)
  --entry <path>   HTML entry (default game/index.html)
  --out <dir>      Output directory (default reports/runs/SAVE-AUDIT)
  --json           Print the report
  --help           This message
`;

const args = parseArgs();
if (wantsHelp(args)) usage(USAGE);
const states = String(args.states || 'default,sv1-midquest,sv5-journal-bloodstain,endgame-200q').split(',').map((s) => s.trim());
const outDir = args.out ? path.resolve(String(args.out)) : path.join(RUNS_DIR, 'SAVE-AUDIT');
ensureDir(outDir);

const handle = await launchGame(args);
let report;
try {
  report = await handle.page.evaluate(async (stateIds) => {
    const H = window.__HARNESS;
    await H.ready();
    H.setRenderRate(0);
    const out = { schema: 'elder-souls/save-audit@1', states: {}, checks: {} };

    const gzipSize = async (text) => {
      if (typeof CompressionStream !== 'function') return null;
      const cs = new CompressionStream('gzip');
      const stream = new Blob([text]).stream().pipeThrough(cs);
      const buf = await new Response(stream).arrayBuffer();
      return buf.byteLength;
    };

    // ---- M1 / M2 / M4 / M16 per state -------------------------------------------------
    for (const id of stateIds) {
      H.setSeed(1337);
      H.loadState(id);
      H.stepFrames(120);                       // never audit a state at frame 0 only
      const rt = H.saveRoundTrip();
      const manifest = H.getSaveManifest();
      const blob = H.saveState();
      const canonical = JSON.stringify(blob);
      const exported = H.exportSave();
      out.states[id] = {
        M1_round_trip_hash_equal: rt.equal,
        hash_before: rt.hash_before,
        hash_after: rt.hash_after,
        M2_field_diff_count: rt.diff.length,
        M2_field_diff: rt.diff.slice(0, 20),
        M4_in_save_not_on_manifest: manifest.computed.in_save_not_on_manifest,
        M4_on_manifest_not_in_save: manifest.computed.on_manifest_not_in_save,
        M16_canonical_bytes: rt.canonical_bytes,
        M16_export_bytes: exported.length,
        M16_export_gzip_bytes: await gzipSize(new TextDecoder().decode(exported)),
        journal_entries: blob.journal.length,
        quests: Object.keys(blob.quests).length,
      };
    }

    // ---- M10 backend attestation ------------------------------------------------------
    const info = await H.getStorageInfo();
    out.checks.M10_backend = {
      backend: info.backend,
      persisted: info.persisted,
      quotaBytes: info.quotaBytes,
      localStorage_bytes: info.localStorage.bytes,
      localStorage_keys: info.localStorage.keys,
      pass: /^indexeddb/.test(info.backend) && info.localStorage.bytes <= 1024,
    };

    // ---- write / read / generation ------------------------------------------------------
    H.setSeed(1337); H.loadState('sv5-journal-bloodstain'); H.stepFrames(60);
    const h0 = H.getStateHash();
    const w1 = await H.writeSave('slot-a');
    const w2 = await H.writeSave('slot-a');
    H.loadState('default');
    const back = await H.readSave('slot-a');
    const h1 = H.getStateHash();
    out.checks.write_read = {
      gen_first: w1.gen, gen_second: w2.gen, monotonic: w2.gen === w1.gen + 1,
      read_gen: back.gen, degraded: back.degraded,
      hash_before_write: h0, hash_after_read: h1, equal: h0 === h1,
      bytes: w2.bytes, wall_ms: +w2.wallMs.toFixed(2),
    };

    // ---- M17 slot honesty ----------------------------------------------------------------
    const slots = await H.listSaveSlots();
    out.checks.M17_slots = slots.map((s) => ({ slot: s.slot, gen: s.gen, bytes: s.bytes }));

    // ---- M14 / CR11 export -> wipe -> import ------------------------------------------------
    H.setSeed(1337); H.loadState('sv1-midquest'); H.stepFrames(90);
    const preExport = H.getStateHash();
    const bytes = H.exportSave();
    H.loadState('default');
    H.importSave(bytes);
    out.checks.M14_export_import = { hash_before: preExport, hash_after: H.getStateHash(), equal: preExport === H.getStateHash(), bytes: bytes.length };

    // ---- M12 corruption: CR2 truncate, CR3 flip byte, CR4 future schema, CR12 garbage -------
    const corruption = {};
    for (const kind of ['truncate', 'flip-byte', 'future-schema']) {
      H.setSeed(1337); H.loadState('sv1-midquest'); H.stepFrames(30);
      await H.writeSave('slot-cr');       // gen n
      await H.writeSave('slot-cr');       // gen n+1, so a previous generation exists
      await H.simulateStorageFailure(kind, 'slot-cr');
      let result;
      try {
        const r = await H.readSave('slot-cr');
        result = { outcome: r.ok ? (r.degraded ? 'loaded-previous-generation' : 'loaded-current') : r.reason, detail: r };
      } catch (e) { result = { outcome: 'refused', message: String(e.message).slice(0, 200) }; }
      corruption[kind] = result;
    }
    // CR12: a foreign file, and a valid save with a mangled seal.
    const png = new TextEncoder().encode('\x89PNG\r\n\x1a\n' + 'not a ledger at all');
    try { H.importSave(png); corruption.foreign_file = { outcome: 'ACCEPTED — DEFECT' }; }
    catch (e) { corruption.foreign_file = { outcome: 'refused', message: e.message }; }
    const good = new TextDecoder().decode(H.exportSave());
    const mangled = good.replace(/"digest":"[0-9a-f]{8}/, '"digest":"deadbeef');
    try { H.importSave(new TextEncoder().encode(mangled)); corruption.mangled_digest = { outcome: 'ACCEPTED — DEFECT' }; }
    catch (e) { corruption.mangled_digest = { outcome: 'refused', message: e.message }; }
    out.checks.M12_corruption = corruption;

    // ---- M13 hostile storage: CR7 ephemeral, CR8 no IDB ---------------------------------------
    const hostile = {};
    for (const kind of ['ephemeral', 'no-idb']) {
      await H.simulateStorageFailure(kind);
      const i2 = await H.getStorageInfo();
      let playable = false, wrote = null;
      try {
        H.setSeed(1337); H.loadState('sv1-midquest'); H.stepFrames(60);
        playable = H.getFrame() > 0;
        wrote = await H.writeSave('slot-hostile');
      } catch (e) { wrote = { error: e.message }; }
      hostile[kind] = { backend: i2.backend, notices: i2.notices, persisted: i2.persisted, playable, write: wrote && wrote.ok ? 'ok (in memory)' : wrote };
    }
    out.checks.M13_hostile = hostile;

    out.not_measured_here = {
      M5: 'divergence after load — measured instead by tools/harness/determinism.mjs rung R9',
      M6: 'world mutation survival (SV2) — needs a dungeon runtime (wave-1 piece W1-07)',
      M7: 'bloodstain souls — needs the death/soul runtime (RI-JRN06, wave-1 piece W1-19)',
      M8: 'crime state survival — needs the crime runtime (RI-CRM01, wave-1 piece W1-18)',
      M9: 'journal integrity under a runtime — the journal round-trips, but nothing writes to it yet',
      M11: 'kill-during-write — needs the journey runner to crash a page context mid-transaction',
      M15: 'save does not stall the sim — needs A-JRN9 heap/GC access to attribute the cost',
      M18: 'autosave policy — no autosave exists yet; it belongs with the quest/rest runtimes',
      M19: 'second-death bloodstain rule — RI-JRN06',
    };
    return out;
  }, states);
} finally {
  await handle.close();
}

report.page_errors = handle.errors;
writeJson(path.join(outDir, 'save-audit.json'), report);
for (const [id, s] of Object.entries(report.states)) {
  log(`${id}: round-trip ${s.M1_round_trip_hash_equal ? 'EQUAL' : 'MISMATCH'}  diff=${s.M2_field_diff_count}  canonical=${(s.M16_canonical_bytes / 1024).toFixed(1)} KiB  export=${(s.M16_export_bytes / 1024).toFixed(1)} KiB  gzip=${s.M16_export_gzip_bytes === null ? 'n/a' : (s.M16_export_gzip_bytes / 1024).toFixed(1) + ' KiB'}  manifest-extra=${s.M4_in_save_not_on_manifest.length}/${s.M4_on_manifest_not_in_save.length}`);
}
log(`backend=${report.checks.M10_backend.backend} localStorage=${report.checks.M10_backend.localStorage_bytes}B`);
if (args.json) process.stdout.write(JSON.stringify(report, null, 2) + '\n');
else process.stdout.write(path.join(outDir, 'save-audit.json') + '\n');
const ok = Object.values(report.states).every((s) => s.M1_round_trip_hash_equal && s.M2_field_diff_count === 0)
  && report.checks.M10_backend.pass && report.page_errors.length === 0;
process.exit(ok ? EXIT.OK : EXIT.MEASUREMENT_FAIL);
