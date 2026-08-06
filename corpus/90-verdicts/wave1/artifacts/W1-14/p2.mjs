import { launchGame } from '/tmp/claude-0/-home-user-elder-souls-claude/3c195166-6f14-54d0-bf0f-867f7b39d84b/scratchpad/w1-14/tools/lib/browser.mjs';
const h = await launchGame({});
const r = await h.page.evaluate(async () => {
  const H = window.__HARNESS; await H.ready();
  H.setSeed(1337); H.loadState('arena_flat'); H.setRenderRate(0);
  H.setWillpower(30); H.setCatalyst?.('rod'); H.setMagicSkills({sorcery:85,root_speech:85,warding:85,veiling:85});
  H.hearthRest(); H.setAttuned(['spark_dart']); H.magicEventsDrain();
  const before = H.getPlayerStats();
  H.queueInputs([{f:2, press:['light']},{f:4, release:['light']}]);
  const frames=[];
  for (let i=0;i<60;i++){ H.stepFrames(1); const s=H.snapshot(); frames.push({f:s.f, state:s.player.state, phase:s.player.phase, anim:s.player.anim, af:s.player.anim_frame, focus:s.player.focus, stam:s.player.stamina, hb:(s.player.hitboxes||[]).length, srb:s.player.stamina_regen_blocked, iframe:s.player.iframe, rng:s.rng&&s.rng.draws, ev:(s.events||[]).map(e=>e.type)}); }
  return { magicState: H.getMagicState(), events: H.magicEventsDrain(), frames, beforeKeys: Object.keys(before) };
});
console.log(JSON.stringify(r.magicState,null,1).slice(0,2000));
console.log('EVENTS', JSON.stringify(r.events).slice(0,1500));
console.log(r.frames.map(f=>`${f.f} ${f.state}/${f.phase} ${f.anim}@${f.af} F${f.focus} S${f.stam} hb${f.hb} rng${f.rng} ${f.ev.join(',')}`).join('\n'));
await h.close();
