import { NodeArena, loadCombatData } from '/home/user/elder-souls-claude/tools/lib/combat-node.mjs';
const base = loadCombatData();
const clone = () => JSON.parse(JSON.stringify(base));

function rollFight(data, lead) {
  const a = new NodeArena({ data, loadout: { weapon: 'straight-sword' } });
  a.player.pos[2] = 2.4; a.player.yaw = 180; a.player.evaluateRig(0);
  a.spawn('E1', 'champion_hist_marked', 0, 0, 0);
  a.lockOn('E1');
  a.script('E1', [{ f: 10, move: 'chop' }]);   // active window opens at f 10+68+1 = 79
  const press = 79 - lead;
  a.queueInputs([{ f: 1, move: [0, 1] }, { f: press, press: ['roll'] }, { f: press + 2, release: ['roll'] }]);
  const P = a.cs.bodyOf('P');
  const hp0 = P.hp; let neg = 0, hit = 0, ifr = 0, states = new Set();
  for (let i = 0; i < 240; i++) {
    a.step(); if (P.iframe) ifr++; states.add(P.state);
    for (const e of a.drain()) { if (e.kind === 'IFRAME_NEGATE' && e.dst === 'P') neg++; if (e.kind === 'HIT' && e.dst === 'P') hit++; }
  }
  return { lead, iframe_frames: ifr, negations: neg, hits: hit, damage: Math.round(hp0 - P.hp) };
}
const R = { full: [], two: [] };
const d2 = clone(); d2.roll.roll.LIGHT.iframes = [5, 6]; d2.roll.roll.LIGHT.iframe_count = 2;
for (const lead of [4, 8, 12, 16, 20, 24]) { R.full.push(rollFight(base, lead)); R.two.push(rollFight(d2, lead)); }
console.log(JSON.stringify(R, null, 1));
