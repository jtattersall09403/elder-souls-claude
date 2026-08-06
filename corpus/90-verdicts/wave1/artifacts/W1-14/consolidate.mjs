import fs from 'node:fs';
const base='/tmp/claude-0/-home-user-elder-souls-claude/3c195166-6f14-54d0-bf0f-867f7b39d84b/scratchpad/critic/';
const wt='/tmp/claude-0/-home-user-elder-souls-claude/3c195166-6f14-54d0-bf0f-867f7b39d84b/scratchpad/w1-14/';
const census=JSON.parse(fs.readFileSync(base+'census.json'));
const touch=JSON.parse(fs.readFileSync(base+'touch.json'));
const effects=JSON.parse(fs.readFileSync(wt+'game/data/magic/effects.json')).effects;

// per-effect: gather the best evidence across runs
const CLASS = {
  functions_as_specified: ['fire_damage','frost_damage','shock_damage','poison_damage','damage_health'],
  partial: ['levitate'],
};
const damageOnly = {
  shatter:'the_unmaking/shell_splitter: 46 hp', corrode:'verdigris @1.4m: 310 hp, no armour/lock state exists to degrade',
  drain_health:'leech @1.4m: 310 hp to target, 0 hp to caster', absorb_health:'sap_thief @1.4m: 200 hp to target, 0 hp to caster',
  soul_trap:'root_theft: 31 hp; gems 0->0, xul_hesh 0', open_lock:'open: 31 hp to a creature; lockState() null, no lock event',
  lock_lock:'seal @1.4m: 184 hp', ward_trap:'spring_the_trap: 5 hp', burden:'burden: 62 hp; enemy equip tier/roll unchanged',
  silence:'silence: 31 hp; nothing in the build casts to be silenced', paralyse:'the_grey_fuzz: 12 hp, enemy state REPOSITION throughout, no buildup field on the enemy record',
  calm_beast:'still_the_beast on beast_slitherfang: 157 hp, alert_state AGGRO, in_combat true at frame 240',
  demoralise:'demoralise: 111 hp, alert_state AGGRO throughout', frenzy:'frenzy: 111 hp',
  charm:'charm @1.4m: 184 hp', wall:'the_broken_wall: 65 hp; solidAt(0,4) unchanged before and after',
};
const timerOnly = {
  chameleon:'magnitude clamped at 80; getStealthState() identical to baseline',
  invisibility:'active; getStealthState() identical to baseline; does NOT break when the player casts',
  muffle:'getStealthState() identical to baseline', night_eye:'getStealthState() identical to baseline',
  false_face:'getStealthState() identical to baseline', detect_life:'timer only, no world output',
  detect_key:'timer only, no world output', feather:'equip_load_pct 24->24, roll_class LIGHT->LIGHT',
  slowfall:'timer only; arena has no fall to measure (unmeasurable, scored as not-demonstrated)',
  buoyancy:'timer only; no water in arena_flat', breathe_water:'timer only; no water in arena_flat',
  leap:'pos[1] max 0.0 over 60 frames after the cast', shield:'100 damage taken with and without the buff',
  sap_ward:'timer only', resist_element:'100 damage taken with and without the buff',
  resist_disease:'timer only; no disease system exposed', fortify_attribute:'getPlayerStats().attributes identical',
  fortify_skill:'getPlayerStats().attributes identical; no gate re-evaluated',
  restore_health:'hp 420->420 of 620 after the_greater_mending', restore_attribute:'timer only',
  cure_disease:'timer only; no affliction state exposed', cure_poison:'timer only', cure_paralysis:'timer only',
  mend_item:'effect_apply x5, no item condition changes', telekinesis:'timer only, no reach change observable',
  bound_weapon:'timer only; loadout unchanged', bind_lesser:'listEntities() 0 -> 0, nothing summoned',
  bind_greater:'no castable carrier: call_the_deep_drowned costs 185 Focus against a 124 maximum pool',
  speak_to_the_dead:'RITUAL completes, no knowledge flag, no journal entry',
  hist_sight:'RITUAL completes, journal length 0 -> 0',
  mark:'RITUAL completes and writes a position', recall:'RITUAL completes; player position [60,0,60] -> [60,0,60]',
  intervention:'RITUAL completes; no position change',
};
const rows=[];
for (const e of effects) {
  let cls, note;
  if (CLASS.functions_as_specified.includes(e.id)) { cls='FUNCTIONS_AS_SPECIFIED'; note='deterministic HP damage = magnitude x output_per_point; this IS the effect'; }
  else if (CLASS.partial.includes(e.id)) { cls='PARTIAL'; note='altitude_m meter + 1.5 Focus/m tax measured; pos[1] stays 0, drift 4.96 m/s, roll/block/parry all execute, iframe true'; }
  else if (damageOnly[e.id]) { cls='HP_DAMAGE_ONLY'; note=damageOnly[e.id]; }
  else if (timerOnly[e.id]) { cls='UNREAD_TIMER'; note=timerOnly[e.id]; }
  else { cls='UNCLASSIFIED'; note='not reached'; }
  rows.push({ id:e.id, school:e.school, utility_class:e.utility_class, declared_changes_traversal:e.changes_traversal,
              declared_changes_quest_resolution:e.changes_quest_resolution, observed_class:cls, observed:note });
}
const tally={}; for(const r of rows) tally[r.observed_class]=(tally[r.observed_class]||0)+1;
const out={ schema:'elder-souls/critic-effect-census@1', piece:'W1-14', ref_item:'RI-MAG02',
  commit:'75c8e3a', method:'For each of the 71 shipped spells: loadState(arena_flat), setWillpower(99), setCatalyst(rod), all four school skills 100, hearthRest(), setAttuned([spell]), spawn inf_trash, queueInputs press light, step total+180 frames, then read magicEventsDrain(), getMagicState(), listEntities(), getPlayerStats(). Touch-range effects re-run with the target at 1.4 m. Buff effects re-probed against the system they claim to move (damagePlayer, getStealthState, equip_load_pct, listEntities, solidAt, getQuestState).',
  declared_effects: effects.length, tally, rows,
  headline: `${tally.FUNCTIONS_AS_SPECIFIED} of ${effects.length} effects produce the mechanical consequence their own record describes; ${tally.PARTIAL} is partial; ${tally.HP_DAMAGE_ONLY} resolve only as HP damage equal to their magnitude; ${tally.UNREAD_TIMER} are a row in effects_active that nothing in the simulation reads.` };
fs.writeFileSync(base+'effect-census.json', JSON.stringify(out,null,1));
console.log(out.headline); console.log(JSON.stringify(tally));
