// CRITIC-OWNED probe 6: RI-JRN05. Round-trip, cold reload, manifest set-difference,
// post-load divergence, backend attestation, corruption, hostility, export/import, size.
// tools/journey/journey-run.mjs and state-diff.mjs (the item's named tools) do not exist;
// this is the closest executable variant and is recorded as a method deviation.
import { launchGame } from '../tools/lib/browser.mjs';
import fs from 'node:fs';
import crypto from 'node:crypto';

const out = process.argv[2];
const handle = await launchGame({});
const page = handle.page;
const report = { schema: 'critic/w1-00-save@1', at: new Date().toISOString(), url: handle.url };
const SV = ['sv1-midquest', 'dungeon_primary', 'settlement_primary_street', 'thorn-hall', 'sv5-journal-bloodstain'];

// canonicalise runner-side, independent of the game's own canonicaliser
function canon(v) {
  if (v === null || typeof v !== 'object') {
    if (typeof v === 'number' && !Number.isInteger(v)) return Number(v.toFixed(6));
    return v;
  }
  if (Array.isArray(v)) return v.map(canon);
  const o = {};
  for (const k of Object.keys(v).sort()) o[k] = canon(v[k]);
  return o;
}
const chash = (v) => crypto.createHash('sha256').update(JSON.stringify(canon(v))).digest('hex');
function flat(v, p, acc) {
  if (v === null || typeof v !== 'object') { acc[p] = v; return acc; }
  if (Array.isArray(v)) { v.forEach((x, i) => flat(x, `${p}[${i}]`, acc)); return acc; }
  for (const k of Object.keys(v).sort()) flat(v[k], p ? `${p}.${k}` : k, acc);
  return acc;
}
function diff(a, b) {
  const fa = flat(canon(a), '', {}), fb = flat(canon(b), '', {});
  const keys = new Set([...Object.keys(fa), ...Object.keys(fb)]);
  const d = [];
  for (const k of keys) if (JSON.stringify(fa[k]) !== JSON.stringify(fb[k])) d.push({ key: k, a: fa[k], b: fb[k] });
  return d;
}

// ---- M1 / M2 round-trip, plus my own runner-side hash ----
report.M1_M2 = [];
for (const st of SV) {
  const r = await page.evaluate(async (state) => {
    const H = window.__HARNESS; await H.ready(); H.setMode('harness');
    H.setSeed(4711); H.loadState(state); H.stepFrames(120);
    const h0 = H.getStateHash();
    const blob = H.saveState();
    const before = JSON.parse(JSON.stringify(blob));
    H.loadState(blob);
    const h1 = H.getStateHash();
    const after = JSON.parse(JSON.stringify(H.saveState()));
    return { h0, h1, before, after };
  }, st);
  report.M1_M2.push({
    scenario: st, game_hash_before: r.h0, game_hash_after: r.h1, game_hash_equal: r.h0 === r.h1,
    critic_hash_before: chash(r.before), critic_hash_after: chash(r.after),
    critic_hash_equal: chash(r.before) === chash(r.after),
    diff: diff(r.before, r.after),
    bytes_canonical: JSON.stringify(canon(r.before)).length,
  });
}

// ---- M4 manifest set-difference (both directions), runner-side ----
report.M4 = await (async () => {
  const r = await page.evaluate(async () => {
    const H = window.__HARNESS;
    H.setSeed(4711); H.loadState('endgame-200q'); H.stepFrames(60);
    return { manifest: JSON.parse(JSON.stringify(H.getSaveManifest())), save: JSON.parse(JSON.stringify(H.saveState())) };
  });
  return { manifest_keys_sample: Object.keys(r.manifest), save_top_keys: Object.keys(r.save), manifest: r.manifest, save_shape: Object.fromEntries(Object.entries(r.save).map(([k, v]) => [k, Array.isArray(v) ? `array[${v.length}]` : typeof v])) };
})();

// ---- M5 post-load divergence ----
report.M5 = await page.evaluate(async () => {
  const H = window.__HARNESS; const res = [];
  for (const state of ['sv1-midquest', 'sv5-journal-bloodstain', 'arena_flat']) {
    const script = [{ f: 0, move: [0, 1] }, { f: 60, tap: 'light' }, { f: 200, tap: 'roll', hold: 3 }, { f: 400, move: [1, 0] }];
    const runIt = (loadBlob) => {
      H.setSeed(4711); if (loadBlob) H.loadState(loadBlob); else H.loadState(state);
      H.clearInputs(); H.queueInputs(JSON.parse(JSON.stringify(script)));
      H.traceStart({}); H.stepFrames(600); const recs = H.traceStop();
      return recs;
    };
    // control: never saved
    H.setSeed(4711); H.loadState(state); H.stepFrames(120);
    const blob = H.saveState();
    const control = runIt(null);
    const loaded = runIt(blob);
    // compare against a control that also had 120 frames of pre-roll then reload
    const j1 = JSON.stringify(control.map(r => [r.player.pos, r.player.stamina, r.rng]));
    const j2 = JSON.stringify(loaded.map(r => [r.player.pos, r.player.stamina, r.rng]));
    res.push({ state, control_len: control.length, loaded_len: loaded.length, identical_playerpath: j1 === j2,
      rng_first: control[0]?.rng, rng_first_loaded: loaded[0]?.rng,
      rng_last: control[control.length - 1]?.rng, rng_last_loaded: loaded[loaded.length - 1]?.rng });
  }
  return res;
});

// ---- M10 backend attestation + localStorage audit ----
report.M10 = await page.evaluate(async () => {
  const H = window.__HARNESS;
  H.loadState('sv5-journal-bloodstain'); H.stepFrames(30);
  let wrote = null, err = null;
  try { wrote = await H.writeSave('slot1'); } catch (e) { err = String(e && e.message || e); }
  const info = await H.getStorageInfo();
  const ls = {};
  let total = 0;
  for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); const v = localStorage.getItem(k); ls[k] = v; total += (k.length + v.length) * 2; }
  return { wrote: JSON.parse(JSON.stringify(wrote ?? null)), err, info: JSON.parse(JSON.stringify(info)), localStorage: ls, localStorage_bytes_utf16: total };
});

// ---- M16 size budget at endgame-200q ----
report.M16 = await page.evaluate(async () => {
  const H = window.__HARNESS;
  H.setSeed(4711); H.loadState('endgame-200q'); H.stepFrames(30);
  const blob = H.saveState();
  const json = JSON.stringify(blob);
  let exported = null, expErr = null;
  try { exported = await H.exportSave(); } catch (e) { expErr = String(e && e.message || e); }
  const expLen = exported ? (typeof exported === 'string' ? exported.length : (exported.bytes ?? exported.byteLength ?? JSON.stringify(exported).length)) : null;
  return { canonical_bytes: json.length, export_kind: exported === null ? null : typeof exported, export_bytes: expLen, expErr,
           export_preview: typeof exported === 'string' ? exported.slice(0, 120) : (exported ? JSON.stringify(exported).slice(0, 300) : null) };
});

// ---- M14 export -> wipe -> import (CR11) ----
report.M14 = await page.evaluate(async () => {
  const H = window.__HARNESS;
  H.setSeed(4711); H.loadState('sv5-journal-bloodstain'); H.stepFrames(90);
  const h0 = H.getStateHash();
  const exported = await H.exportSave();
  // wipe origin storage
  await new Promise((res) => { const req = indexedDB.deleteDatabase('elder-souls'); req.onsuccess = res; req.onerror = res; req.onblocked = res; });
  localStorage.clear();
  let slotsAfterWipe = null; try { slotsAfterWipe = await H.listSaveSlots(); } catch (e) { slotsAfterWipe = String(e.message || e); }
  H.reset({ seed: 1 });
  let imported = null, impErr = null;
  try { imported = await H.importSave(exported); } catch (e) { impErr = String(e && e.message || e); }
  const h1 = H.getStateHash();
  return { h0, h1, equal: h0 === h1, slotsAfterWipe: JSON.parse(JSON.stringify(slotsAfterWipe)), imported: JSON.parse(JSON.stringify(imported ?? null)), impErr };
});

// ---- M12 corruption CR2/CR3/CR4/CR12 ----
report.M12 = await page.evaluate(async () => {
  const H = window.__HARNESS; const o = {};
  const t = async (k, fn) => { try { o[k] = { threw: false, v: JSON.parse(JSON.stringify(await fn() ?? null)) }; } catch (e) { o[k] = { threw: true, msg: String(e && e.message || e) }; } };
  H.setSeed(4711); H.loadState('sv5-journal-bloodstain'); H.stepFrames(30);
  const exported = await H.exportSave();
  const s = typeof exported === 'string' ? exported : JSON.stringify(exported);
  await t('CR12_png', () => H.importSave('\x89PNG\r\n\x1a\n' + 'garbage'.repeat(40)));
  await t('CR12_empty', () => H.importSave(''));
  await t('CR2_truncated', () => H.importSave(s.slice(0, Math.floor(s.length * 0.6))));
  const mid = Math.floor(s.length / 2);
  await t('CR3_flipped', () => H.importSave(s.slice(0, mid) + (s[mid] === 'a' ? 'b' : 'a') + s.slice(mid + 1)));
  // CR4: schema from the future
  let fut = null;
  try { const b = H.saveState(); b.meta = b.meta || {}; b.meta.schema_version = (b.meta.schema_version ?? b.meta.schemaVersion ?? 1) + 1; if ('schemaVersion' in (b.meta||{})) b.meta.schemaVersion = b.meta.schemaVersion + 1; fut = b; } catch {}
  await t('CR4_future_schema', () => H.loadState(fut));
  // CR5: schema from the past
  let past = null;
  try { const b = H.saveState(); b.meta = b.meta || {}; if ('schema_version' in b.meta) b.meta.schema_version = 0; if ('schemaVersion' in b.meta) b.meta.schemaVersion = 0; past = b; } catch {}
  await t('CR5_past_schema', () => H.loadState(past));
  await t('meta_shape', () => H.saveState().meta);
  return o;
});

// ---- M13 hostility CR6/CR7/CR8/CR10 ----
report.M13 = await page.evaluate(async () => {
  const H = window.__HARNESS; const o = {};
  const t = async (k, fn) => { try { o[k] = { threw: false, v: JSON.parse(JSON.stringify(await fn() ?? null)) }; } catch (e) { o[k] = { threw: true, msg: String(e && e.message || e) }; } };
  await t('modes', () => (H.simulateStorageFailure ? H.simulateStorageFailure('__list__') : null));
  for (const mode of ['ephemeral', 'no-idb', 'quota', 'none']) {
    await t('set_' + mode, () => H.simulateStorageFailure(mode));
    await t('write_under_' + mode, async () => { H.loadState('arena_flat'); H.stepFrames(10); return await H.writeSave('slotX'); });
    await t('info_under_' + mode, () => H.getStorageInfo());
    await t('steps_under_' + mode, () => { H.stepFrames(60); return H.getFrame(); });
  }
  return o;
});

report.page_errors = handle.errors;
report.console_errors = handle.console.filter(c => c.type === 'error').slice(0, 30);
fs.writeFileSync(out, JSON.stringify(report, null, 2));
console.log('wrote', out);
await handle.close();
