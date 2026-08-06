// Entities and their fixed-step update.
//
// SCOPE, stated plainly: **wave 1 piece W1-00 does not own enemy AI.** `RI-AI01`–`RI-AI07`
// and wave-1 piece W1-06 do. What lives here is everything the *harness* needs to be real:
//   * an entity is instantiated from a real statblock in `game/data/combat/enemies/*.json`;
//     `spawn()` with an id that is not in that directory THROWS (RI-MTH01 M6);
//   * every field HARNESS.md §5 requires of an enemy record is present and truthful;
//   * a dead entity stays in the array as `state: "DEAD"` until despawned
//     (RI-MTH01 "How we lose" #6);
//   * `aggro()` really sets `alert_state` to `AGGRO` and really changes the behaviour
//     selected below.
//
// What is NOT here, and is declared rather than faked: approach/circle/commit/punish
// behaviour. A statblock's `ai` field says which behaviour it wants; wave 1 ships exactly
// two — `none` (a training dummy, which is what a dummy actually does) and `hold_ground`
// (turns to face, never attacks). An enemy declaring any other `ai` throws on spawn rather
// than silently behaving like a dummy, because a plausible-but-wrong enemy is worse than an
// absent one.
'use strict';

const DEG = 180 / Math.PI;

export const IMPLEMENTED_AI = new Set(['none', 'hold_ground']);

export function makeEntity(stat, eid, x, z, frame) {
  if (!IMPLEMENTED_AI.has(stat.ai)) {
    throw new Error(
      `spawn('${stat.id}'): archetype declares ai='${stat.ai}', which wave-1 piece W1-00 does ` +
      'not implement. Enemy behaviour is owned by RI-AI01..07 / piece W1-06. Refusing to spawn ' +
      'an entity that would look like an enemy and behave like furniture.');
  }
  return {
    eid,
    id: stat.id,
    archetype: stat.archetype,
    tier: stat.tier,
    ai: stat.ai,
    state: 'IDLE',
    stateEnteredF: frame,
    prevState: null,
    anim: 'idle',
    animFrame: 0,
    animLen: stat.idle_anim_frames || 1,
    phase: 'none',
    hitActive: false,
    hitboxes: [],
    pos: [x, 0, z],
    yaw: 180,
    yawRate: 0,
    speed: 0,
    hp: stat.hp,
    hpMax: stat.hp,
    poise: stat.poise,
    poiseMax: stat.poise,
    stagger: false,
    staggerUntil: 0,
    alert: 0,
    alertState: 'IDLE',
    attackToken: false,
    anchor: [x, 0, z],
    radius_m: stat.radius_m,
    sight_radius_m: stat.sight_radius_m,
    sight_cone_deg: stat.sight_cone_deg,
    hitById: '',
  };
}

export function stepEntities(sim, bus) {
  const p = sim.player;
  for (let i = 0; i < sim.entities.length; i++) {
    const e = sim.entities[i];
    const prev = e.state;

    if (e.hp <= 0) {
      if (e.state !== 'DEAD') { e.state = 'DEAD'; e.stateEnteredF = sim.frame; }
      e.speed = 0; e.yawRate = 0; e.phase = 'none'; e.hitActive = false; e.hitboxes.length = 0;
      continue;
    }
    if (sim.hitstopUntil > sim.frame) { e.phase = 'hitstun'; continue; }

    if (e.stagger) {
      e.state = 'STAGGER'; e.phase = 'hitstun'; e.animFrame++;
      if (sim.frame >= e.staggerUntil) { e.stagger = false; e.state = 'IDLE'; e.animFrame = 0; e.phase = 'none'; }
    } else if (e.ai === 'hold_ground') {
      const dx = p.pos[0] - e.pos[0], dz = p.pos[2] - e.pos[2];
      const d = Math.hypot(dx, dz);
      // Perception: real, and the only thing aggro() short-circuits.
      const facing = Math.abs(norm180(Math.atan2(dx, dz) * DEG - e.yaw));
      const sees = d <= e.sight_radius_m && facing <= e.sight_cone_deg / 2;
      if (sees) e.alert = Math.min(100, e.alert + 4);
      else e.alert = Math.max(0, e.alert - 1);
      e.alertState = e.alert >= 100 ? 'AGGRO' : e.alert >= 50 ? 'SEARCH' : e.alert > 0 ? 'SUSPICIOUS' : 'IDLE';
      if (e.alertState === 'AGGRO') {
        const want = norm360(Math.atan2(dx, dz) * DEG);
        const maxTurn = 240 / 60;
        let t = norm180(want - e.yaw);
        if (t > maxTurn) t = maxTurn; else if (t < -maxTurn) t = -maxTurn;
        e.yaw = norm360(e.yaw + t);
        e.yawRate = Math.abs(t) * 60;
        e.state = 'FACE';
      } else { e.yawRate = 0; e.state = 'IDLE'; }
      e.animFrame = (e.animFrame + 1) % Math.max(1, e.animLen);
    } else {
      // ai === 'none' — a training dummy. It stands there. That is the whole behaviour and
      // it is honest: the trace says IDLE because the thing is idle.
      e.state = 'IDLE'; e.phase = 'none'; e.speed = 0; e.yawRate = 0;
      e.animFrame = (e.animFrame + 1) % Math.max(1, e.animLen);
    }

    if (prev !== e.state) {
      e.prevState = prev; e.stateEnteredF = sim.frame;
      const ev = bus.emit(sim.frame, 'enemy_state');
      ev.eid = e.eid; ev.from = prev; ev.to = e.state;
    }
  }
}

function norm360(a) { a %= 360; return a < 0 ? a + 360 : a; }
function norm180(a) { a = norm360(a); return a > 180 ? a - 360 : a; }
