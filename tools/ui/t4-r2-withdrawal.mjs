// RI-UIX07 E-T2/E-T3/V7/V8 — the withdrawal, on a fixture that HAS SOMETHING TO FIGHT.
//
// The `ui-journal` run of this probe was INERT: `enemies: 0`, `aggro('undefined'): no such
// entity`, `combat_phase` never left `world`, and "the world set before == the world set after"
// was therefore a comparison of one phase with itself. RULES rule 6's second failure exactly — a
// control arm that is a second copy of the experiment. This runs the same probe on `arena_duel`
// (1 spawn) so the boundary is actually crossed, and REFUSES to report a result if it is not.
import fs from 'node:fs';
import { launchGame } from '/home/user/elder-souls-claude/tools/lib/browser.mjs';

const state = process.argv[2] || 'arena_duel';
const out = process.argv[3] || '/home/user/elder-souls-claude/corpus/90-verdicts/wave1/artifacts/T4-r2/withdrawal-' + state + '.json';
const h = await launchGame({ width: 1920, height: 1080, state });
let r = null;
try {
  r = await Promise.race([
    h.page.evaluate(async () => {
      const H = window.__HARNESS;
      await H.ready();
      if (H.setUIVisible) await H.setUIVisible(true);
      await H.closeMenu(); await H.stepFrames(6);
      const KINDS = ['bearing_dial', 'effect_strip', 'sneak_state', 'place_name', 'breath_meter'];
      const frames = [];
      const rec = (tag) => {
        const st = H.getUIState();
        frames.push({
          tag, frame: H.getFrame(),
          combat_phase: st.combat_phase === undefined ? null : st.combat_phase,
          combat_phase_source: st.combat_phase_source === undefined ? null : st.combat_phase_source,
          frames_since_phase_change: st.frames_since_phase_change === undefined ? null : st.frames_since_phase_change,
          in_combat: st.hud ? st.hud.bearing_withheld_because !== null : null,
          world: (st.elements || []).filter((e) => KINDS.includes(e.kind) && e.visible)
            .map((e) => ({ kind: e.kind, opacity: e.opacity })),
          // E-T5's list: every RI-UIX01 element id on this frame, world set excluded.
          souls_ids: (st.elements || []).filter((e) => e.id.startsWith('hud.') && !KINDS.includes(e.kind) && e.visible)
            .map((e) => e.id).sort(),
          withdrawn: st.hud && st.hud.world ? st.hud.world.withdrawn : null,
        });
      };
      const es = (H.listEnemies ? H.listEnemies() : []) || [];
      for (let i = 0; i < 6; i++) { await H.stepFrames(1); rec('pre'); }
      let aggro = null;
      const eid = (es[0] || {}).eid || (es[0] || {}).id;
      try { aggro = eid ? H.aggro(eid) : 'no enemy in this fixture'; } catch (e) { aggro = String(e.message); }
      for (let i = 0; i < 20; i++) { await H.stepFrames(1); rec('post'); }
      return { state_enemies: es.length, enemy: eid || null, aggro, frames };
    }),
    new Promise((_, rj) => setTimeout(() => rj(new Error('timeout 300s')), 300000)),
  ]);
} finally { await h.close(); }

const pre = r.frames.filter((f) => f.tag === 'pre');
const post = r.frames.filter((f) => f.tag === 'post');
const phases = [...new Set(r.frames.map((f) => f.combat_phase))];
const crossed = phases.includes('world') && phases.includes('fight');
const summary = {
  state, enemies_in_fixture: r.state_enemies, aggro: r.aggro,
  phases_seen: phases,
  // THE GATE ON THE PROBE ITSELF. If the boundary was never crossed, nothing below means anything.
  boundary_crossed: crossed,
  verdict_admissible: crossed,
  world_before: pre.length ? pre[pre.length - 1].world.map((w) => w.kind) : [],
  world_after: post.length ? post[post.length - 1].world.map((w) => w.kind) : [],
  // E-T3: no fade in either direction in this build, so every declared opacity must be exactly 1.
  any_fractional_opacity: r.frames.some((f) => f.world.some((w) => w.opacity > 0 && w.opacity < 1)),
  // E-T5: the Souls element list must be identical across the boundary, id for id.
  souls_identical_across_boundary: pre.length && post.length
    ? JSON.stringify(pre[pre.length - 1].souls_ids.filter((i) => i !== 'hud.toast'))
      === JSON.stringify(post[post.length - 1].souls_ids.filter((i) => i !== 'hud.toast'))
    : null,
  entry_frame: (() => {
    for (let i = 1; i < r.frames.length; i++) {
      if (r.frames[i - 1].combat_phase === 'world' && r.frames[i].combat_phase === 'fight') {
        return { at: r.frames[i].frame, world_before: r.frames[i - 1].world.map((w) => w.kind), world_at: r.frames[i].world.map((w) => w.kind) };
      }
    }
    return null;
  })(),
};
fs.writeFileSync(out, JSON.stringify({ summary, frames: r.frames }, null, 2));
console.log(JSON.stringify(summary, null, 2));
if (!crossed) {
  console.error('\nINERT: the fight boundary was never crossed on `' + state + '` (phases seen: '
    + JSON.stringify(phases) + '). Nothing about withdrawal can be concluded from this run.');
  process.exit(5);
}
