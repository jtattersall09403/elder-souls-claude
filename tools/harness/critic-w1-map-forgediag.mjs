#!/usr/bin/env node
// critic-w1-map-forgediag.mjs — why did the forged footprint produce ZERO?
//
// A critic whose attack "fails" must prove the attack was delivered before crediting the defence.
// This isolates the forged-save path with an HONEST CONTROL on the same code path: if the honest
// blob also comes back empty, the load is not happening and the forgery proved nothing.
//
// It also settles the C-block question: the empty map showed 15 distinct colours inside the
// terrain box, which is either rendered terrain (a finding) or the player chevron drawn on top
// (an artefact of a naive sample). Sampled with and without the chevron's own rect excluded.
import { parseArgs, log, EXIT } from '../lib/cli.mjs';
import { launchGame } from '../lib/browser.mjs';

const args = parseArgs();
const handle = await launchGame(args);
let out;
try {
  out = await handle.page.evaluate(async () => {
    const H = window.__HARNESS;
    await H.ready();
    H.setRenderRate(0);
    const eng = H._engine || window.__ENGINE;
    const sim = eng.sim;
    const D = sim.discovery;
    const cols = D.cols, rows = D.rows, cell = D.cell, total = cols * rows;
    const nbytes = (total + 7) >> 3;
    const b64 = (b) => { let s = ''; for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]); return btoa(s); };
    const errs = [];
    const step = (n) => { try { H.stepFrames(n); } catch (e) { errs.push(e.message); } };
    const walkTo = (x, z) => { H.teleport(x, z, {}); step(2); };

    await H.loadState('default');
    D.restore(null);
    // Walk a REAL route so the honest blob is substantial, not one cell.
    for (let i = 0; i < 12; i++) walkTo(2000 + i * 130, 800);
    const site = eng.field.sites.find((s) => s.id === 'thorn') || eng.field.sites[0];
    walkTo(site.x, site.z);
    const honest = H.mapState();
    const blob = H.saveState();
    const blobDisc = blob.world.discovery;

    // --- CONTROL: does an honest blob survive this exact call? ---------------------------------
    H.loadState(JSON.parse(JSON.stringify(blob)));
    const afterHonest = H.mapState();

    // --- FORGERY 1: replace the whole discovery block with an all-ones footprint ---------------
    const f1 = JSON.parse(JSON.stringify(blob));
    f1.world.discovery = { stood: b64(new Uint8Array(nbytes).fill(0xFF)), cells: '', places: [], revealed: 0, derived_from: 'stood' };
    H.loadState(f1);
    const afterF1 = H.mapState();
    const restoreF1 = D.lastRestore;

    // --- FORGERY 2: keep every original key, overwrite ONLY `stood` ----------------------------
    const f2 = JSON.parse(JSON.stringify(blob));
    f2.world.discovery.stood = b64(new Uint8Array(nbytes).fill(0xFF));
    H.loadState(f2);
    const afterF2 = H.mapState();
    const restoreF2 = D.lastRestore;

    // --- FORGERY 3: call restore() DIRECTLY, bypassing applySave -------------------------------
    D.restore({ stood: b64(new Uint8Array(nbytes).fill(0xFF)) });
    const afterF3 = { revealed_cells: D.revealedCells, place_count: D.placeCount, places: D.places() };

    // --- the C-block question: what are those 15 colours? --------------------------------------
    D.restore(null);
    H.openMenu('map', {});
    const S = eng.ui.S;
    const terr = S.elements.find((e) => e.kind === 'map_terrain');
    const plr = S.elements.find((e) => e.kind === 'map_player');
    const box = terr.rect;
    const x0 = Math.round(box[0]) + 2, y0 = Math.round(box[1]) + 2;
    const w = Math.max(1, Math.round(box[2]) - 4), hh = Math.max(1, Math.round(box[3]) - 4);
    const img = S.ctx.getImageData(x0, y0, w, hh).data;
    const all = new Map(), excl = new Map();
    const pr = plr ? plr.rect : [-9, -9, 0, 0];
    for (let py = 0; py < hh; py++) {
      for (let px = 0; px < w; px++) {
        const i = (py * w + px) * 4;
        const k = (img[i] << 16) | (img[i + 1] << 8) | img[i + 2];
        all.set(k, (all.get(k) || 0) + 1);
        const gx = x0 + px, gy = y0 + py;
        // exclude the player chevron's own rect, generously padded for its stroke
        if (gx >= pr[0] - 3 && gx <= pr[0] + pr[2] + 3 && gy >= pr[1] - 3 && gy <= pr[1] + pr[3] + 3) continue;
        excl.set(k, (excl.get(k) || 0) + 1);
      }
    }
    H.closeMenu();
    const top = (m) => [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6)
      .map(([k, n]) => ({ hex: '#' + k.toString(16).padStart(6, '0'), n }));

    return {
      step_errors: errs,
      honest_before_save: honest,
      blob_discovery_keys: Object.keys(blobDisc),
      blob_stood_len: (blobDisc.stood || '').length,
      control_honest_reload: afterHonest,
      forgery_whole_block: { live: afterF1, restore_audit: restoreF1 },
      forgery_stood_only: { live: afterF2, restore_audit: restoreF2 },
      forgery_direct_restore: afterF3,
      empty_map_colours: {
        terrain_rect: box, player_rect: pr,
        distinct_all: all.size, distinct_excluding_chevron: excl.size,
        top_all: top(all), top_excluding_chevron: top(excl),
        drawn_cells: terr.meta.drawn_cells,
      },
    };
  });
} finally { await handle.close(); }
log(JSON.stringify(out, null, 2));
process.exit(EXIT.OK);
