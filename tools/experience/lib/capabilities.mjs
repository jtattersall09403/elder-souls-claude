// capabilities.mjs — the harness surface, classified by WHAT A METHOD LETS YOU DO.
//
// WHY THIS FILE EXISTS. TOOL-COVERAGE-R2 §8 broke `session-run.mjs` — the round-1 critic's
// "best instrument of the twelve" — in four minutes, and the break was not subtle:
//
//   before                      : listNPCs() -> 0
//   __HARNESS.spawn(...)        : refused: "RI-EXP01: spawn() is prohibited"   recorded
//   __HARNESS.spawnNPC({...})   : RETURNED {"eid":"critic-ghost","kind":"npc",...}
//   after                       : listNPCs() -> 1
//   violations recorded         : 1        <- only the one that was refused
//
// The run completed, exited 0, and was certified as a clean first-hour session with an
// agent-authored NPC standing in it. `spawn` was prohibited; `spawnNPC`, `spawnEncounter`,
// `spawnCivilian`, `spawnGuard` and `spawnProp` were not. `loadState` was refused while
// `restoreState` was not. `teleport` was refused while `travelRide`, `boardTravel`,
// `setTravelMark` and a method literally named `__breakTravelFence` were not.
//
// RI-EXP01 step 1 names SIX methods. It was written against a smaller harness and the surface
// grew underneath it: **six names against 320 methods**. The item means a CAPABILITY list and
// the enforcement was a NAME list, so every method added since has been permitted by default.
//
// THE RULE THIS FILE IMPLEMENTS. A profile refuses CAPABILITIES, not names. The refusal set is
// derived from the LIVE surface at install time, so a method added tomorrow is covered tomorrow.
// And the classification is **fail-closed**: a method this file does not classify is
// PROHIBITED and named in the manifest, so the next twenty methods someone adds are refused
// until somebody rules on them. An unclassified method is the only thing that can silently
// re-open the hole, so it is the thing that must default shut.
//
// HOW TO EXTEND IT. Add the name to the right set below and say why in a comment. Do not add it
// to `OBSERVE` to make a run go green — that is the failure this file exists to prevent, and
// `session-run --audit-surface` prints the whole classification so a critic can check it.
'use strict';

/**
 * The capability classes. The first five are RI-EXP01's own words expanded into capabilities;
 * the rest are what a 320-method surface actually contains.
 */
export const CAPABILITIES = [
  'mutate-world',      // put something in the world, take something out, or change it
  'teleport-player',   // move the player other than by playing
  'grant-resource',    // hand the character skills, attributes, gold, gear, spells, standing
  'set-environment',   // time, weather, tide, wall clock
  'load-state',        // restore, import or write a save
  'force-hostility',   // make something attack, hurt or arrest the player, or script an enemy
  'break-fence',       // the __break* deliberate-defect switches
  'drive-input',       // press a button, move a stick, open a surface — what a player does
  'harness-control',   // seed, mode, stepping, tracing, rendering, capture
  'observe',           // read the world without changing it
];

// ---------------------------------------------------------------------------------------------
// The explicit table. Names whose prefix would classify them wrongly, and every method whose
// capability is not obvious from its name. Order matters: this table wins over the prefix rules.
// ---------------------------------------------------------------------------------------------
const EXPLICIT = {
  // ---- mutate-world -------------------------------------------------------------------------
  spawn: 'mutate-world', spawnNPC: 'mutate-world', spawnEncounter: 'mutate-world',
  spawnCivilian: 'mutate-world', spawnGuard: 'mutate-world', spawnProp: 'mutate-world',
  despawn: 'mutate-world', killEntity: 'mutate-world', killWitness: 'mutate-world',
  clearProps: 'mutate-world', takeObject: 'mutate-world', takeProp: 'mutate-world',
  addCoverVolume: 'mutate-world', addOccluder: 'mutate-world', addLightSource: 'mutate-world',
  snuffLight: 'mutate-world', addWitness: 'mutate-world', setEntityNamed: 'mutate-world',
  setEntityPos: 'mutate-world', setCameraObstacle: 'mutate-world',
  recoverBloodstain: 'mutate-world', discoverCorpse: 'mutate-world', resolveKilling: 'mutate-world',
  warbroodShift: 'mutate-world', openContainer: 'mutate-world', resetMagicWorld: 'mutate-world',
  addStatusBuildup: 'mutate-world', addAffliction: 'mutate-world', breakInvisibility: 'mutate-world',
  emitStealthSound: 'mutate-world', trapSoul: 'mutate-world', setZoneAmbient: 'mutate-world',
  fogGate: 'mutate-world', lockGate: 'mutate-world', skipDeathSurface: 'mutate-world',
  resetSapTaint: 'mutate-world', renderedTextClear: 'mutate-world',
  // Quest writes. A driver that opens, resolves, fails, reveals or flags a quest has authored
  // the journey RI-EXP01 is trying to observe.
  questOpen: 'mutate-world', questResolve: 'mutate-world', questFail: 'mutate-world',
  questReveal: 'mutate-world', questSetFlag: 'mutate-world', questNote: 'mutate-world',
  learnTopic: 'mutate-world', setWorldKnowledge: 'mutate-world',

  // ---- teleport-player ----------------------------------------------------------------------
  // The six-name list refused `teleport` alone. Everything else here moves the player without
  // walking, and `__breakTravelFence` is in `break-fence` below.
  teleport: 'teleport-player', travelRide: 'teleport-player', boardTravel: 'teleport-player',
  setTravelMark: 'teleport-player', walkPath: 'teleport-player', walkRoute: 'teleport-player',
  setPlayerMotion: 'teleport-player', setLevitating: 'teleport-player', dropFrom: 'teleport-player',
  setAtHearth: 'teleport-player', hearthRest: 'teleport-player', restAt: 'teleport-player',
  setCameraCell: 'teleport-player',

  // ---- grant-resource -----------------------------------------------------------------------
  setSkills: 'grant-resource', setAttributes: 'grant-resource', setMagicSkills: 'grant-resource',
  setGold: 'grant-resource', learnSpell: 'grant-resource', makeSpell: 'grant-resource',
  setLoadout: 'grant-resource', setAttuned: 'grant-resource', setEquipLoad: 'grant-resource',
  setBurden: 'grant-resource', grantSkillUse: 'grant-resource', setCharacter: 'grant-resource',
  setFactionStandings: 'grant-resource', setWillpower: 'grant-resource', setCatalyst: 'grant-resource',
  setDisposition: 'grant-resource', setRespawnRules: 'grant-resource',
  fenceSell: 'grant-resource', enchanterOpen: 'grant-resource',

  // ---- set-environment ----------------------------------------------------------------------
  setTimeOfDay: 'set-environment', setWeather: 'set-environment', setTide: 'set-environment',
  advanceWallClock: 'set-environment',

  // ---- load-state ---------------------------------------------------------------------------
  // `loadState` was refused. `restoreState` and `importSave` do the same job under other names.
  loadState: 'load-state', restoreState: 'load-state', importSave: 'load-state',
  saveState: 'load-state', writeSave: 'load-state', exportSave: 'load-state',
  saveRoundTrip: 'load-state', deleteSaveSlot: 'load-state', simulateStorageFailure: 'load-state',

  // ---- force-hostility ----------------------------------------------------------------------
  aggro: 'force-hostility', raiseEnemyAlert: 'force-hostility', damagePlayer: 'force-hostility',
  killPlayer: 'force-hostility', playerDeath: 'force-hostility', commitCrime: 'force-hostility',
  setCrimeContext: 'force-hostility', queueEnemyScript: 'force-hostility',
  setBounty: 'force-hostility', setStealthState: 'force-hostility', deathCamera: 'force-hostility',

  // ---- drive-input: what a player does with their hands -------------------------------------
  queueInputs: 'drive-input', clearInputs: 'drive-input',
  touchDown: 'drive-input', touchMove: 'drive-input', touchUp: 'drive-input',
  setTouchEnabled: 'drive-input', gamepad: 'drive-input', gamepadPoll: 'drive-input',
  setSyntheticPads: 'drive-input', setPadProfile: 'drive-input',
  lockOn: 'drive-input', lockPress: 'drive-input', lockBegin: 'drive-input',
  openMenu: 'drive-input', closeMenu: 'drive-input', setUIVisible: 'drive-input',
  uiOpen: 'drive-input', uiClose: 'drive-input', uiFocus: 'drive-input', uiSearch: 'drive-input',
  talkTo: 'drive-input', conversationSay: 'drive-input', conversationClose: 'drive-input',
  censusBegin: 'drive-input', censusAnswer: 'drive-input', censusEnter: 'drive-input',
  titleShow: 'drive-input', titleActivate: 'drive-input', titleDismiss: 'drive-input',
  openWrit: 'drive-input', closeWrit: 'drive-input', readWrit: 'observe',
  pickpocketBegin: 'drive-input', openRebinding: 'drive-input', closeRebinding: 'drive-input',
  castNow: 'drive-input', pressCast: 'drive-input', castCameraArm: 'drive-input',
  answerArrest: 'drive-input', bribeWitness: 'drive-input', talkDownWitness: 'drive-input',
  arrestTopics: 'observe', trespassCheck: 'observe',
  camera: 'drive-input', cameraRoute: 'drive-input', cameraRouteEnd: 'drive-input',
  triggerCameraShake: 'drive-input',
  perturbInput: 'drive-input', perturbInputReset: 'drive-input',

  // ---- harness-control: how a runner drives, not how a player plays --------------------------
  ready: 'harness-control', reset: 'harness-control', setSeed: 'harness-control',
  setMode: 'harness-control', setRenderRate: 'harness-control', stepFrames: 'harness-control',
  renderFrame: 'harness-control', screenshot: 'harness-control',
  traceStart: 'harness-control', traceDrain: 'harness-control', traceStop: 'harness-control',
  combatTraceStart: 'harness-control', combatTraceStop: 'harness-control',
  combatTraceDrain: 'harness-control', combatTraceMeta: 'harness-control',
  snapshot: 'harness-control', setViewport: 'harness-control',
  setDevicePixelRatio: 'harness-control', stallMainThread: 'harness-control',
  streamAround: 'harness-control', reanchorFreeRunning: 'harness-control',
  magicEventsDrain: 'harness-control', questEventsDrain: 'harness-control',
  drainStealthEvents: 'harness-control', signatureAudit: 'harness-control',
  rebindBegin: 'drive-input', rebindCommit: 'drive-input', rebindStep: 'drive-input',
  rebindOffer: 'observe', rebindRestore: 'drive-input', rebindUnbind: 'drive-input',
  rebindSerialise: 'observe', rebindView: 'observe',

  // ---- observe: reads whose names do not begin get/list/is -----------------------------------
  npcDisposition: 'observe', questBook: 'observe', questOffers: 'observe',
  questResolutions: 'observe', questResolutionRequirements: 'observe', questVerbCensus: 'observe',
  canJoinFaction: 'observe', coverAt: 'observe', darkCoverage: 'observe', solidAt: 'observe',
  visibilityAt: 'observe', losBetween: 'observe', soundRadiusFor: 'observe',
  projectPoint: 'observe', landReport: 'observe', reportRoute: 'observe', jailLedger: 'observe',
  perceptionState: 'observe', pickpocketState: 'observe', touchState: 'observe',
  touchLayout: 'observe', lockState: 'observe', lockTolerance: 'observe',
  cameraRouteState: 'observe', spellCost: 'observe', quoteSpell: 'observe',
  recallQuote: 'observe', enchantQuote: 'observe', fenceQuote: 'observe',
  travelFare: 'observe', travelQuote: 'observe', probeWard: 'observe',
  isStealthOpener: 'observe', readSave: 'observe',

  // Added by the fail-closed fuse itself. The surface grew from 319 to 325 methods DURING tool
  // round 3 (fourteen agents share this tree) and `--self-test` refused rather than letting the
  // three new names through unclassified. That is the whole point of the default: the hole
  // round 2 shipped was six names against a surface that kept growing.
  explainDisposition: 'observe',   // QuestEngine.explainDisposition — a read with its terms shown
  questDef: 'observe',             // the quest definition as authored
  setFactionStanding: 'grant-resource',  // singular sibling of setFactionStandings
};

// ---------------------------------------------------------------------------------------------
// Prefix rules, applied only when the explicit table has no entry. Every one of these is a READ
// in this codebase; none of them is a widening.
// ---------------------------------------------------------------------------------------------
const PREFIX_RULES = [
  [/^__break/, 'break-fence'],
  [/^get[A-Z]/, 'observe'],
  [/^list[A-Z]/, 'observe'],
];

/** @returns {string|null} the capability, or null when this file does not classify the name. */
export function capabilityOf(method) {
  if (Object.prototype.hasOwnProperty.call(EXPLICIT, method)) return EXPLICIT[method];
  for (const [rx, cap] of PREFIX_RULES) if (rx.test(method)) return cap;
  return null;
}

/**
 * Classify a whole surface and derive the refusal set for a profile.
 *
 * @param {string[]} surface   every function name on window.__HARNESS, read from the LIVE build
 * @param {string[]} refuseCaps the capability classes this profile refuses
 * @returns {{refuse:string[], unclassified:string[], byCapability:object, allowed:string[]}}
 */
export function deriveRefusalSet(surface, refuseCaps) {
  const byCapability = {};
  for (const c of CAPABILITIES) byCapability[c] = [];
  const unclassified = [];
  for (const m of surface) {
    const c = capabilityOf(m);
    if (c === null) { unclassified.push(m); continue; }
    byCapability[c].push(m);
  }
  const want = new Set(refuseCaps);
  const refuse = [
    ...surface.filter((m) => { const c = capabilityOf(m); return c !== null && want.has(c); }),
    // FAIL CLOSED. An unclassified method is refused until somebody rules on it.
    ...unclassified,
  ].sort();
  return {
    refuse,
    unclassified: unclassified.sort(),
    byCapability,
    allowed: surface.filter((m) => !refuse.includes(m)).sort(),
  };
}
