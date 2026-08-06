import { launchGame } from '/tmp/claude-0/-home-user-elder-souls-claude/3c195166-6f14-54d0-bf0f-867f7b39d84b/scratchpad/w1-14/tools/lib/browser.mjs';
import fs from 'node:fs';
const h = await launchGame({});
const out = await h.page.evaluate(async () => {
  const H = window.__HARNESS; await H.ready();
  const R={};
  const setup=(sp)=>{H.setSeed(1337);H.loadState('arena_flat');H.setRenderRate(0);H.setWillpower(99);H.setCatalyst('rod');
    H.setMagicSkills({sorcery:100,root_speech:100,warding:100,veiling:100});H.hearthRest();H.magicEventsDrain();if(sp)H.setAttuned([sp]);};
  const cast=(n=120)=>{H.queueInputs([{f:2,press:['light']},{f:4,release:['light']}]);H.stepFrames(n);};
  const safe=(f)=>{try{return f();}catch(e){return 'ERR:'+String(e.message||e).slice(0,120);}};

  // stealth coupling: chameleon / muffle / invisibility / night_eye
  const visArgs = {motion:'walk'};
  const stealthProbe=()=>safe(()=>({vis:H.visibilityAt(0,0,visArgs), snd:H.soundRadiusFor?H.soundRadiusFor('walk'):null, st:H.getStealthState?H.getStealthState():null}));
  setup(null); H.stepFrames(5); R.stealth_base=stealthProbe();
  setup('the_deep_chameleon'); cast(); R.stealth_chameleon=stealthProbe();
  setup('the_water_film'); cast(); R.stealth_invis=stealthProbe();
  setup('muffle'); cast(); R.stealth_muffle=stealthProbe();
  setup('night_eye'); cast(); R.stealth_nighteye=stealthProbe();

  // locks
  R.lock_api = safe(()=>H.lockState());
  setup('open'); cast(); R.lock_after_open = safe(()=>H.lockState());
  setup('seal'); cast(); R.lock_after_seal = safe(()=>H.lockState());

  // summons / bound weapon: entity count + loadout
  setup(null); H.stepFrames(5); const n0=H.listEntities().length; const w0=safe(()=>H.getPlayerStats().anim);
  setup('call_the_drowned'); cast(200); R.bind_lesser={n0, n1:H.listEntities().length};
  setup('sap_blade'); cast(150); R.bound_weapon={loadout:safe(()=>H.setLoadout?null:null), stats:safe(()=>({stam:H.getPlayerStats().stamina_max}))};

  // wall: collision
  setup('the_broken_wall'); const solid0=safe(()=>H.solidAt(0,4)); cast(200); R.wall={solid_before:solid0, solid_after:safe(()=>H.solidAt(0,4))};

  // leap / slowfall: vertical
  setup('leap'); const y0=H.getPlayerStats().pos[1]; cast(30);
  const ys=[]; for(let i=0;i<60;i++){H.stepFrames(1); ys.push(H.getPlayerStats().pos[1]);}
  R.leap={y0, ymax:Math.max(...ys)};
  setup('slowfall'); cast(60); H.teleport(0,0,{y:30}); const yy=[]; for(let i=0;i<120;i++){H.stepFrames(1); yy.push(H.getPlayerStats().pos[1]);}
  R.slowfall={y_series:[yy[0],yy[20],yy[60],yy[119]], hp:H.getPlayerStats().hp};

  // telekinesis reach
  setup('long_hand'); cast(); R.telekinesis=safe(()=>({objs:(H.listOwnedObjects?H.listOwnedObjects():[]).length}));

  // fortify_skill gate: does a skill number move anywhere queryable
  setup('sure_hand'); const before=safe(()=>H.getPlayerStats().attributes); cast();
  R.fortify={before, after:safe(()=>H.getPlayerStats().attributes), lockGate_before:safe(()=>H.lockGate&&H.lockGate('tier5')), };

  // cures: afflictions
  R.afflictions_api = safe(()=>H.getPlayerStats().afflictions ?? Object.keys(H.getPlayerStats()));
  return R;
});
fs.writeFileSync('/tmp/claude-0/-home-user-elder-souls-claude/3c195166-6f14-54d0-bf0f-867f7b39d84b/scratchpad/critic/battery2.json', JSON.stringify(out,null,1));
console.log(JSON.stringify(out,null,1));
await h.close();
