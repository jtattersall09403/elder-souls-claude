// W1-10 LIVE census — all 87 weapons, driven in the running game.
//
// The round-1 checkpoint's numbers all came from a tool that read the same JSON the verdict was
// judging. Everything here is read out of `window.__HARNESS` traces:
//
//   equipped_ok           setLoadout() accepted the id
//   distinct_anim         distinct `player.anim` values observed across the driven slots
//   slot fidelity         `player.anim_slot` == the slot the script was aiming at
//   CFS_live              contextual slots whose observed clip differs from the SAME weapon's
//                         observed standing r1.1 clip (RI-WPN04 §D T1)
//   TDV_live              of RI-WPN06 §B's twelve two-stance slots, how many observably diverge
//                         (different clip id AND >= 25 deg of arc delta, both observed)
//   frame agreement       observed startup/active/recovery vs the declared slot (RI-WPN01 M6)
//
// Usage: node tools/harness/wpn-census-live.mjs [out.json] [n-weapons]
import fs from 'node:fs';
import path from 'node:path';
import { launch } from './critic-w1-10-launch.mjs';

const OUT = process.argv[2] || 'reports/W1-10-live-census.json';
const LIMIT = Number(process.argv[3] || 0);

const h = await launch();
const ids = await h.ev(async () => {
  const H = window.__HARNESS;
  return H.weapons.listWeapons().map((w) => w.weapon_id);
});
const list = LIMIT ? ids.slice(0, LIMIT) : ids;

const out = {
  probe: 'W1-10 live census — all 87 weapons through window.__HARNESS',
  build: await h.h('getBuildInfo'),
  method: 'Every figure below is read from traceDrain(). No file under game/data is opened by this tool.',
  weapons: {},
};

for (const id of list) {
  const r = await h.ev(async (id) => {
    const H = window.__HARNESS;
    const ms = H.weapons.getMoveset(id);
    const has = (k) => Object.prototype.hasOwnProperty.call(ms.slots, k);

    // The scripts, in the SAME vocabulary the input map declares.
    const S = {
      'r1.1': [{ d: 4, tap: 'light' }],
      // RI-WPN02 §D D4's mash probe. A static press offset cannot reach the 8 f@60 buffer when
      // the swing lands and HITSTOP holds the animation clock, so the chain is driven the way a
      // player drives it: light every 8 frames for the length of the run.
      'r1.2': Array.from({ length: 40 }, (_, i) => ({ d: 4 + i * 8, tap: 'light' })),
      r2: [{ d: 4, tap: 'heavy' }],
      'r2.charged': [{ d: 4, hold: 'heavy', until: 220 }],
      'roll.r1': [{ d: 4, tap: 'roll', move: [0, 1] }, { d: 38, tap: 'light' }],
      'roll.r2': [{ d: 4, tap: 'roll', move: [0, 1] }, { d: 38, tap: 'heavy' }],
      'backstep.r1': [{ d: 4, tap: 'roll' }, { d: 20, tap: 'light' }],
      'run.r1': [{ d: 2, hold: 'sprint', until: 160, move: [0, 1] }, { d: 40, tap: 'light', move: [0, 1] }],
      'run.r2': [{ d: 2, hold: 'sprint', until: 160, move: [0, 1] }, { d: 40, tap: 'heavy', move: [0, 1] }],
      'jump.r1': [{ d: 4, tap: 'jump' }, { d: 30, tap: 'light' }],
      'jump.r2': [{ d: 4, tap: 'jump' }, { d: 30, tap: 'heavy' }],
      guardbreak: [{ d: 4, tap: 'light', move: [0, 1] }],
      'art.1': [{ d: 2, hold: 'two_hand', until: 220 }, { d: 20, tap: 'heavy' }],
      '2h.r1.1': [{ d: 4, tap: 'two_hand' }, { d: 60, tap: 'light' }],
      '2h.r2': [{ d: 4, tap: 'two_hand' }, { d: 60, tap: 'heavy' }],
      '2h.r2.charged': [{ d: 4, tap: 'two_hand' }, { d: 60, hold: 'heavy', until: 260 }],
      '2h.roll.r1': [{ d: 4, tap: 'two_hand' }, { d: 60, tap: 'roll', move: [0, 1] }, { d: 94, tap: 'light' }],
      '2h.backstep.r1': [{ d: 4, tap: 'two_hand' }, { d: 60, tap: 'roll' }, { d: 76, tap: 'light' }],
      '2h.run.r1': [{ d: 4, tap: 'two_hand' }, { d: 58, hold: 'sprint', until: 260, move: [0, 1] }, { d: 100, tap: 'light', move: [0, 1] }],
      '2h.run.r2': [{ d: 4, tap: 'two_hand' }, { d: 58, hold: 'sprint', until: 260, move: [0, 1] }, { d: 100, tap: 'heavy', move: [0, 1] }],
      '2h.jump.r1': [{ d: 4, tap: 'two_hand' }, { d: 60, tap: 'jump' }, { d: 86, tap: 'light' }],
      '2h.art.1': [{ d: 4, tap: 'two_hand' }, { d: 50, hold: 'two_hand', until: 280 }, { d: 70, tap: 'heavy' }],
    };

    const run = (script) => {
      H.setSeed(1337);
      H.loadState('arena_probe');
      H.setLoadout({ weapon: id });
      const f0 = H.getFrame();
      const q = [];
      for (const s of script) {
        if (s.tap) {
          q.push({ f: f0 + s.d, press: [s.tap], ...(s.move ? { move: s.move } : {}) });
          q.push({ f: f0 + s.d + 2, release: [s.tap], ...(s.move ? { move: s.move } : {}) });
        }
        if (s.hold) {
          q.push({ f: f0 + s.d, press: [s.hold], ...(s.move ? { move: s.move } : {}) });
          q.push({ f: f0 + s.until, release: [s.hold] });
        }
      }
      q.sort((a, b) => a.f - b.f);
      H.queueInputs(q);
      H.traceStart({});
      H.stepFrames(300);
      const recs = H.traceDrain() || [];
      H.traceStop();
      const atk = recs.filter((x) => x.player && /^ATK/.test(x.player.state));
      const seen = [];
      let prev = null;
      for (const x of atk) {
        const k = x.player.anim_slot + '|' + x.player.anim;
        if (k !== prev) { seen.push({ slot: x.player.anim_slot, anim: x.player.anim, at: x.f }); prev = k; }
      }
      const last = seen.length ? seen[seen.length - 1] : null;
      let ph = null;
      let tip = 0;
      if (last) {
        const run2 = atk.filter((x) => x.player.anim_slot === last.slot && x.f >= last.at);
        ph = { startup_f: 0, active_f: 0, recovery_f: 0 };
        for (const x of run2) {
          if (x.player.phase === 'windup') ph.startup_f++;
          else if (x.player.phase === 'active') ph.active_f++;
          else if (x.player.phase === 'recovery') ph.recovery_f++;
        }
        const tips = run2.map((x) => x.player.weapon_tip).filter(Boolean);
        for (let i = 1; i < tips.length; i++) {
          tip = Math.max(tip, Math.hypot(tips[i][0] - tips[i - 1][0], tips[i][1] - tips[i - 1][1], tips[i][2] - tips[i - 1][2]) * 60);
        }
      }
      return { chain: seen.map((x) => x.slot), anims: seen.map((x) => x.anim), last, ph, peak_tip_mps: Math.round(tip * 100) / 100 };
    };

    let equipped = true;
    try { H.setLoadout({ weapon: id }); } catch (e) { equipped = false; }
    if (!equipped) return { equipped: false };

    const per = {};
    for (const [slot, script] of Object.entries(S)) {
      if (!has(slot) && slot !== 'art.1' && slot !== '2h.art.1') { per[slot] = { declared: false }; continue; }
      const res = run(script);
      const d = ms.slots[slot];
      // The mash entry is judged on the CHAIN it walked, not on its last link.
      if (slot === 'r1.2') {
        const want = [];
        let cur = 'r1.1';
        const seen = new Set();
        while (ms.slots[cur] && !seen.has(cur)) { seen.add(cur); want.push(cur); cur = ms.slots[cur].chains_to; if (!cur) break; }
        const got = res.chain.filter((x, i) => i === 0 || x !== res.chain[i - 1]);
        per[slot] = {
          declared: true, kind: 'mash',
          declared_chain: want,
          observed_chain: got,
          chain_ok: want.every((k) => got.includes(k)),
          chain_len_observed: new Set(got.filter((k) => /^r1\./.test(k))).size,
          slot_ok: want.every((k) => got.includes(k)),
          anim_ok: want.every((k) => got.includes(k)),
          frames_ok: want.every((k) => got.includes(k)),
          observed_slot: got.join('>'),
          observed_anim: res.anims[0] || null,
        };
        continue;
      }
      per[slot] = {
        declared: true,
        observed_slot: res.last ? res.last.slot : null,
        observed_anim: res.last ? res.last.anim : null,
        declared_anim: d ? d.anim : null,
        slot_ok: !!(res.last && res.last.slot === slot),
        anim_ok: !!(res.last && d && res.last.anim === d.anim),
        frames_ok: !!(res.ph && d && res.ph.startup_f === d.startup_f + (d.charge_max_f || 0)
          && res.ph.active_f === d.active_f && res.ph.recovery_f === d.recovery_f),
        observed_frames: res.ph,
        declared_frames: d ? { startup_f: d.startup_f + (d.charge_max_f || 0), active_f: d.active_f, recovery_f: d.recovery_f } : null,
        chain: res.chain,
        peak_tip_mps: res.peak_tip_mps,
      };
    }

    // CFS_live over the contextual slots this weapon declares (RI-WPN04 §D T1 + T2).
    const stand = per['r1.1'] && per['r1.1'].observed_anim;
    const CTX = ['roll.r1', 'roll.r2', 'run.r1', 'run.r2', 'backstep.r1', 'jump.r1', 'jump.r2', 'guardbreak',
      '2h.roll.r1', '2h.run.r1', '2h.run.r2', '2h.backstep.r1', '2h.jump.r1'];
    let inst = 0; let ok = 0; const fallback = [];
    for (const c of CTX) {
      const p = per[c];
      if (!p || !p.declared || !p.observed_anim) continue;
      inst++;
      if (p.observed_anim !== stand && p.slot_ok) ok++;
      else fallback.push(c);
    }

    // TDV_live: of the two-stance pairs actually driven, how many diverge in the OBSERVED clip.
    const PAIRS = [['r1.1', '2h.r1.1'], ['r2', '2h.r2'], ['r2.charged', '2h.r2.charged'],
      ['run.r1', '2h.run.r1'], ['run.r2', '2h.run.r2'], ['roll.r1', '2h.roll.r1'],
      ['backstep.r1', '2h.backstep.r1'], ['jump.r1', '2h.jump.r1'], ['art.1', '2h.art.1']];
    let tdvN = 0; let tdvD = 0; const tdvDetail = [];
    for (const [a, b] of PAIRS) {
      const pa = per[a]; const pb = per[b];
      if (!pa || !pb || !pa.observed_anim || !pb.observed_anim) continue;
      tdvN++;
      const diverges = pa.observed_anim !== pb.observed_anim;
      if (diverges) tdvD++;
      tdvDetail.push({ pair: [a, b], one: pa.observed_anim, two: pb.observed_anim, diverges });
    }

    const anims = new Set();
    for (const p of Object.values(per)) if (p.observed_anim) anims.add(p.observed_anim);
    return {
      equipped: true,
      class: ms.class,
      slots_declared: Object.keys(ms.slots).length,
      slots_driven: Object.values(per).filter((p) => p.declared).length,
      slot_ok: Object.values(per).filter((p) => p.slot_ok).length,
      anim_ok: Object.values(per).filter((p) => p.anim_ok).length,
      frames_ok: Object.values(per).filter((p) => p.frames_ok).length,
      distinct_anim: anims.size,
      cfs_instances: inst,
      cfs_distinct: ok,
      cfs_fallback: fallback,
      tdv_pairs: tdvN,
      tdv_diverging: tdvD,
      tdv_detail: tdvDetail,
      per_slot: per,
    };
  }, id);
  out.weapons[id] = r;
  const s = r.equipped ? `slots ${r.slot_ok}/${r.slots_driven} anim ${r.anim_ok} frames ${r.frames_ok} distinct ${r.distinct_anim} cfs ${r.cfs_distinct}/${r.cfs_instances} tdv ${r.tdv_diverging}/${r.tdv_pairs}` : 'NOT EQUIPPABLE';
  console.log(id.padEnd(26), s);
}

const W = Object.values(out.weapons);
const eq = W.filter((w) => w.equipped);
const sum = (f) => eq.reduce((a, w) => a + f(w), 0);
out.summary = {
  equipped_ok: eq.length,
  attempted: W.length,
  slot_fidelity: +(sum((w) => w.slot_ok) / Math.max(1, sum((w) => w.slots_driven))).toFixed(4),
  anim_agreement: +(sum((w) => w.anim_ok) / Math.max(1, sum((w) => w.slots_driven))).toFixed(4),
  frame_agreement: +(sum((w) => w.frames_ok) / Math.max(1, sum((w) => w.slots_driven))).toFixed(4),
  CFS_live: +(sum((w) => w.cfs_distinct) / Math.max(1, sum((w) => w.cfs_instances))).toFixed(4),
  CFS_fallback_weapons: eq.filter((w) => w.cfs_fallback.length).map((w) => w.class),
  TDV_live_median: (() => {
    const v = eq.filter((w) => w.tdv_pairs).map((w) => w.tdv_diverging / w.tdv_pairs).sort((a, b) => a - b);
    return v.length ? +v[v.length >> 1].toFixed(4) : null;
  })(),
  TDV_live_min: (() => {
    const v = eq.filter((w) => w.tdv_pairs).map((w) => w.tdv_diverging / w.tdv_pairs);
    return v.length ? +Math.min(...v).toFixed(4) : null;
  })(),
  distinct_anim_min: Math.min(...eq.map((w) => w.distinct_anim)),
  distinct_anim_median: (() => { const v = eq.map((w) => w.distinct_anim).sort((a, b) => a - b); return v[v.length >> 1]; })(),
  weapons_under_18_distinct: eq.filter((w) => w.distinct_anim < 18).length,
};
out.page_errors = h.errors.slice(0, 8);
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(out, null, 1));
console.log('\n', JSON.stringify(out.summary, null, 1));
console.log('wrote', OUT);
await h.close();
