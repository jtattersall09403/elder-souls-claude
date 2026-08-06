// CONSUMPTION check (ARBITRATION §3 / RI-MTH07): perturb each model this piece ships and
// observe an entity change behaviour. Nothing here reads a report; every number is a fight.
import { NodeArena, loadCombatData } from '/home/user/elder-souls-claude/tools/lib/combat-node.mjs';
const base = loadCombatData();
const clone = () => JSON.parse(JSON.stringify(base));

/** One scripted exchange; returns the observables each model should move. */
function fight(data, opts = {}) {
  const a = new NodeArena({ data, loadout: { weapon: 'straight-sword' } });
  a.player.pos[0] = 0; a.player.pos[2] = opts.d === undefined ? 1.0 : opts.d; a.player.yaw = 180; a.player.evaluateRig(0);
  a.spawn('E1', 'champion_hist_marked', 0, 0, 0);
  a.lockOn('E1');
  a.script('E1', [{ f: 10, move: 'chop' }, { f: 200, move: 'thrust' }, { f: 360, move: 'combo_a' }]);
  const ins = [{ f: 1, move: [0, 0] }];
  for (let k = 2; k < 500; k += 12) ins.push({ f: k, press: ['light'] }, { f: k + 2, release: ['light'] });
  a.queueInputs(ins);
  const P = a.cs.bodyOf('P'), E = a.cs.bodyOf('E1');
  const hp0 = P.hp, ehp0 = E.hp;
  let minDist = Infinity, worstBoundaryJump = 0, worstJump = 0;
  let prevSock = null, prevState = null, prevAnim = null;
  let iframeFrames = 0, staggerFrames = 0;
  for (let i = 0; i < 500; i++) {
    a.step(); a.drain();
    const d = Math.hypot(E.pos[0] - P.pos[0], E.pos[2] - P.pos[2]);
    if (d < minDist) minDist = d;
    const s = [P.socketB[0], P.socketB[1], P.socketB[2]];
    if (prevSock && i > 2) {
      const j = Math.hypot(s[0] - prevSock[0], s[1] - prevSock[1], s[2] - prevSock[2]);
      if (j > worstJump) worstJump = j;
      if ((prevState !== P.state || prevAnim !== P.anim) && j > worstBoundaryJump) worstBoundaryJump = j;
    }
    prevSock = s; prevState = P.state; prevAnim = P.anim;
    if (P.iframe) iframeFrames++;
    if (E.state === 'STAGGER') staggerFrames++;
  }
  return {
    player_damage_taken: Math.round(hp0 - P.hp), enemy_damage_taken: Math.round(ehp0 - E.hp),
    min_centre_distance_m: +minDist.toFixed(3),
    worst_socket_jump_m: +worstJump.toFixed(4),
    worst_boundary_jump_m: +worstBoundaryJump.toFixed(4),
    player_iframe_frames: iframeFrames, enemy_stagger_frames: staggerFrames,
  };
}

const cases = {};
cases.baseline = fight(base);
{ const d = clone(); delete d.hitgeometry.body_hazard; cases.no_body_hazard = fight(d); }
{ const d = clone(); d.hitgeometry.bodies.player_radius_m = 0; d.hitgeometry.bodies.default_enemy_radius_m = 0; cases.body_radius_0 = fight(d); }
{ const d = clone(); d.hitgeometry.bodies.player_radius_m = 0.8; d.hitgeometry.bodies.default_enemy_radius_m = 0.8; cases.body_radius_0p8 = fight(d); }
{ const d = clone(); d.clips.phase_parameterisation.cross_fade.frames = 0; cases.cross_fade_0 = fight(d); }
{ const d = clone(); d.clips.phase_parameterisation.cross_fade.frames = 30; cases.cross_fade_30 = fight(d); }
{ const d = clone(); d.roll.roll.LIGHT.iframes = [5, 6]; cases.iframes_2f = fight(d); }
{ const d = clone(); d.hitgeometry.sweep.substeps = 1; cases.substeps_1 = fight(d); }
{ const d = clone(); d.poise.stagger.tiers.forEach((t) => { t.frames = 4; }); cases.stagger_4f = fight(d); }
console.log(JSON.stringify(cases, null, 1));
