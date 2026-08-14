#!/usr/bin/env node
// Roadmap coverage matrix: every reference item, plan and open gap -> a proposed roadmap item.
// Inventory is DERIVED (fs walk / generated ledgers). Only the item->roadmap mapping is authored.
// Writes orchestration/status/ROADMAP-COVERAGE-AUDIT.coverage.json (machine-readable, versioned)
// and reports/roadmap-audit/coverage.md (readable tables).
// Run from the repo root: node tools/roadmap-coverage.mjs
// Fails non-zero if anything in the inventory has no roadmap home, or if the proposed order
// violates one of its own recorded dependencies.
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const OUT = 'reports/roadmap-audit';
// reports/.gitignore keeps only *.md, by design: run artifacts are reproducible from their tool.
// The machine-readable matrix is a deliverable the orchestrator consumes, so it lands versioned.
const JSON_OUT = 'orchestration/status/ROADMAP-COVERAGE-AUDIT.coverage.json';

/* ---------------------------------------------------------------- inventory */

function walk(dir, acc = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, acc);
    else acc.push(p);
  }
  return acc;
}

// --- reference items: every corpus/**/RI-*.md, front-matter parsed
const riFiles = walk('corpus').filter((p) => /\/RI-[^/]*\.md$/.test(p)).sort();
const REF_ITEMS = riFiles.map((p) => {
  const t = fs.readFileSync(p, 'utf8');
  const fm = (t.match(/^---\n([\s\S]*?)\n---/) || [, ''])[1];
  const g = (k) => {
    const r = fm.match(new RegExp('^' + k + ':\\s*(.*)$', 'm'));
    return r ? r[1].trim().replace(/^["']|["']$/g, '') : '';
  };
  const blk = (fm.match(/^judges:\s*\n((?:\s+-\s.*\n)+)/m) || [])[1];
  const judges = blk ? blk.split('\n').filter(Boolean).map((s) => s.replace(/^\s*-\s*/, '').trim()) : [];
  return { id: g('id'), file: p, area: p.split('/')[1], title: g('title'), kind: g('kind'), side: g('side'), judges };
});

// --- plans: every file in orchestration/plans/
const PLANS = fs.readdirSync('orchestration/plans').sort().map((f) => {
  const p = 'orchestration/plans/' + f;
  const t = fs.readFileSync(p, 'utf8');
  return {
    id: f.replace(/\.md$/, ''),
    file: p,
    title: (t.match(/^#\s+(.*)$/m) || [, ''])[1].trim(),
    cites: [...new Set(t.match(/RI-[A-Z]{2,3}[0-9]{2}/g) || [])].sort(),
  };
});

// --- gaps: generated ledger, open only
const ledger = JSON.parse(fs.readFileSync('corpus/90-verdicts/GAP-LEDGER.json', 'utf8'));
const GAPS = ledger.gaps.filter((x) => x && x.status === 'open')
  .map((x) => ({ id: x.gap_id, severity: x.severity, path: x.subsystem_path || null, what: (x.what || '').slice(0, 160) }));

// --- judged state: derived from every verdict json
const vdir = 'corpus/90-verdicts/wave1';
const JUDGED = {};
for (const f of fs.readdirSync(vdir).filter((x) => x.endsWith('.json'))) {
  const j = JSON.parse(fs.readFileSync(path.join(vdir, f), 'utf8'));
  for (const r of j.reference_items || []) {
    const id = (r.id || '').match(/RI-[A-Z]{2,3}[0-9]{2}/)?.[0];
    if (!id) continue;
    (JUDGED[id] = JUDGED[id] || []).push({ piece: j.piece_id || f, score: r.score_0_10, measured: r.measured });
  }
}
const stateOf = (id) => {
  const v = JUDGED[id];
  if (!v) return { judged: false, verdicts: 0, best_score_0_10: null, state: 'never_judged' };
  const s = v.map((x) => x.score).filter((x) => typeof x === 'number');
  const best = s.length ? Math.max(...s) : null;
  return {
    judged: true, verdicts: v.length, best_score_0_10: best,
    state: best === null ? 'judged_unscored' : best >= 6 ? 'judged_at_or_above_bar' : 'judged_below_bar',
  };
};

/* ------------------------------------------------- proposed roadmap items */
// Ring = what may run concurrently. Ordering is by ring, then by index within ring.
const RINGS = {
  0: 'Instruments — how we know anything. Continuous; never "finished".',
  1: 'The frame — what a rendered pixel looks like. Wave 1 by owner directive.',
  2: 'The body, the camera and the fight — Souls owns everything in here.',
  3: 'The world you can navigate by prose — the substrate B-side quests stand on.',
  4: 'The character and the economies — what you become and what it costs.',
  5: 'People, words and quests — the Morrowind half proper.',
  6: 'The platform — save, input, performance, screens.',
  7: 'The whole thing — judged as an experience, end to end.',
};

const ITEMS = [
  // ---- ring 0
  ['I1', 0, 'The harness and determinism', 'Harness API surface, seeded PRNG actually drawn, fixed-step reproducibility, save-shape probes.'],
  ['I2', 0, 'Capture and the Deck', 'Hardware capture that returns frames under fleet load; many angles + motion as the standing evidence form.'],
  ['I4', 0, 'Consumption as a gate', 'RI-MTH07 enforced on every piece: the world reads the model, demonstrated by perturbation.'],
  ['I5', 0, 'The corpus audited and extended', 'Citation tripwire, the missing instruments, reference plates that can satisfy their own rows, region/topological maps.'],
  ['I3', 0, 'The blind protocols', 'Protocol A (fidelity) and Protocol B (art direction), packs that can express the question their item asks. Runs after I5: a pack that cannot separate quality from provenance is not a judgement.'],

  // ---- ring 1
  ['G1', 1, 'The camera', 'Third-person rig, spring arm, collision pull-in, lock-on framing, camera-relative movement, the camera outside the fight. Scheduled in ring 1, not ring 2: every visual verdict on the player body is taken through it.'],
  ['F1', 1, 'Materials and surface response', 'PBR sets bound to what is drawn; roughness, edge wear, wetness. DONE and evidenced on hardware.'],
  ['F2', 1, 'Shadow, contact and ambient occlusion', 'Contact darkening, soft-where-soft, cascades. The judges’ most universal observation, 5 of 5.'],
  ['F3', 1, 'Ambient and bounce fill', 'GI/ambient so shadows stop crushing to black; tone-mapped shadow lift.'],
  ['F4', 1, 'Light, sky and atmosphere', 'Sun and moons, time of day, fog model, aerial perspective, cloud.'],
  ['F5', 1, 'The frame pipeline', 'Antialiasing, exposure, bloom, tonemapping, grade by region/time/weather; the renderer feature checklist.'],
  ['F6', 1, 'Terrain and vegetation surfaces', 'Terrain texturing/blending/wear; species, density, LOD, wind, canopy shimmer.'],
  ['F7', 1, 'The water surface', 'Surface, shore, depth, refraction; the axis-aligned lane defect.'],
  ['F8', 1, 'The building kit and settlement silhouette', 'Kit parts, grammars, roof profiles, silhouette variety, and the reuse library that makes a good model teach the next one.'],
  ['F9', 1, 'Interiors and practical light', 'Torches, lanterns, emissives, interior light falloff — and the light field stealth has to read.'],
  ['F10', 1, 'Characters and creatures', 'Model quality, silhouette readability, the player’s body under an always-behind camera.'],
  ['F11', 1, 'Animation quality', 'Locomotion, transitions, weight, recovery. Couples to G3; Souls owns the fight, so G3 governs where they meet.'],
  ['F12', 1, 'VFX and particles', 'Magic, weather, dust, smoke, impact, blood.'],
  ['F13', 1, 'Art direction and region identity', 'The look target written as numbers, the transposition spec, the "could this be Skyrim?" detector.'],
  ['F14', 1, 'Performance, LOD and budgets', 'Draw distance, instancing, shadow-caster budget, ordinary hardware.'],

  // ---- ring 2
  ['T1', 2, 'Save and load', 'The state manifest, the round-trip diff, the storage ruling. Scheduled in ring 2, not with the platform work: equip load, roll class and the purse all currently change when you reload, so nothing downstream can be judged across a session.'],
  ['T2', 2, 'Controls and discoverability', 'Desktop action set and pointer lock, a fresh player with no manual, gamepad lifecycle, mobile with an attached pad. Ahead of G7: judging feel means humans playing.'],
  ['G4', 2, 'Enemies that can fight you', 'Aggro/approach/spacing, telegraph doctrine, punish windows, attack strings, roster archetypes. Ahead of G2: an attack volume that cannot reach contact range makes the exchange untestable from the receiving end.'],
  ['G2', 2, 'The exchange', 'Roll and i-frames, equip-load tiers, stamina economy, hitboxes/hurtboxes, poise, stagger, parry, backstab, riposte, input latency.'],
  ['G3', 2, 'Weapons and movesets, wired', 'The 87 authored movesets reachable from the running game; class differentiation, contextual attacks, two-handing, shields, hitstop and material impact.'],
  ['G5', 2, 'Bosses and encounter authorship', 'Phases, tells, arena, the fog-gate loop; placement, sightlines, density, the ambush and the one you learn to skip.'],
  ['G6', 2, 'Combat HUD and impact feedback', 'What the HUD shows and must never show; stamina as a correctness property; impact audio as frame-critical feedback.'],
  ['G7', 2, 'How the fight feels', 'Reactability, decision divergence, difficulty and the curve — judged by humans playing, never by charts.'],
  ['G8', 2, 'Healing, status and exhaustion', 'The Hist-sap flask and its commitment frames; the five status meters and the handoff to the affliction economy; roll-spam and the exhausted state.'],

  // ---- ring 3
  ['W1', 3, 'Terrain form and the road network', 'Landform and geology per region, the terrain grammar, world scale, the one-hour traversal budget, roads that are not underwater.'],
  ['W2', 3, 'Regions that read differently on foot', 'Region identity beyond a colour tint, borders and staggered crossover, the unlabeled-screenshot test.'],
  ['W3', 3, 'Variety within a region', 'The six-minute walk, the patch-size ceiling, density per minute of travel.'],
  ['W4', 3, 'Settlements with an outside', 'Settlement anatomy, exterior fabric for all 202 buildings, layout authored at the generator so buildings stop interpenetrating.'],
  ['W5', 3, 'Doors, interiors and continuity', 'A door you can see, walk through, and come back in by; footprint/bearing/window agreement; verticality and the cave seam.'],
  ['W6', 3, 'Legibility — landmarks and prose directions', 'Landmarks, signposts, and a world you can direct someone across in a sentence. Hard prerequisite for P6.'],
  ['W7', 3, 'Getting around', 'The transport network — modes, routes, fares, stations, walked-it-once — and travel magic: Mark, Recall, the Interventions.'],
  ['W8', 3, 'Dungeons, xanmeers and ruins', 'Places worth entering with rewards worth finding.'],
  ['W9', 3, 'Water and hazards as play', 'Depth bands, wading, swimming, tide, substrate, what standing water does to a fight; the thirteen hazards and the telegraph law.'],
  ['W10', 3, 'The living world', 'Schedules, homes, work, sleep, ecology, ambient events, weather and time as things you plan around.'],
  ['W11', 3, 'Strangeness and the built alienness', 'The thirty things that exist nowhere else, nine architectural grammars, the right-angle census, the opacity budget.'],

  // ---- ring 4
  ['C1', 4, 'Character creation as a played scene', 'The Writ House rendered rather than an API: race, birthsigns, the questionnaire, the naming moment, what it changes and never locks.'],
  ['C2', 4, 'Levelling and the hearth', 'The soul cost curve, souls yield, the ten attributes, skills that improve by use, and a level-up screen that exists at the bonfire.'],
  ['C3', 4, 'Load, inventory and upgrades', 'Equip load and encumbrance surviving a save, the inventory screen, the menu-pause rule, the +N upgrade path and its materials.'],
  ['C4', 4, 'Gold', 'Prices by merchant, disposition and region; barter as a conversation; a purse that persists. Souls level you; gold buys things.'],
  ['C5', 4, 'Affliction and disease', 'Seventeen diseases, their causes, their cures, and the one that has none.'],
  ['C6', 4, 'Magic that does what it says', 'The effect catalogue with behaviour behind it, spellmaking and enchanting with a world-side surface, soul gems, combat casting frames, magic as a quest solution.'],
  ['C7', 4, 'Stealth and theft', 'Detection by light/sound/sight, the search, ownership of every object, locks, pickpocketing, trespass, and a fence that will not buy your victim’s own furniture.'],
  ['C8', 4, 'Crime and justice', 'Being seen, the report chain, bounty, guards who can actually fight, arrest, jail, reputation that persists, and faction-sanctioned crime.'],

  // ---- ring 5
  ['P1', 5, 'The topic web and the dialogue window', 'Topics that unlock topics, the filter stack and first-match-wins, settlement topic webs, and a window that looks like Morrowind’s.'],
  ['P2', 5, 'Voice, disposition and persuasion', 'Speakers who disagree, greetings and rumours, Admire/Intimidate/Taunt/Bribe, measurable style per archetype, tonal range, and characters who address the player.'],
  ['P3', 5, 'The journal', 'Chronological, append-only, in a person’s voice, searchable, and the only navigation aid. No quest markers, ever — enforced by a detector.'],
  ['P4', 5, 'Books and readables with a reader', 'The 65 texts openable and readable in the world: pagination, legibility, reading as a real activity.'],
  ['P5', 5, 'Lore, canon and names', 'The canon-facts registry and contradiction discipline, Jel phonology and naming, the peoples of the province and what they disagree about, the era brief, religion and metaphysics.'],
  ['P6', 5, 'A quest end to end without markers', 'Rumour → giver → prose direction → landmark → resolution → journal. Depends on W6.'],
  ['P7', 5, 'Quest givers who exist, and ladders that open', 'The 94 quest givers standing somewhere a player can reach, and faction ranks past 5 opening the 21 already-authored quests.'],
  ['P8', 5, 'Factions with real ladders', 'Joining, rank, duties, expulsion, rivalry, exclusivity — belonging somewhere costing you somewhere else.'],
  ['P9', 5, 'The main quest', 'Five acts and a backpath, enterable and advanceable by playing rather than by harness.'],
  ['P10', 5, 'Quest texture and consequence', 'Type distribution and density, quests you have to overhear, unique-named rewards, non-combat resolution and the parley, irreversibility and mutually exclusive endings.'],

  // ---- ring 6
  ['T3', 6, 'Load, streaming and budgets', 'Time to first playable, silent region borders, hitch census, memory and the ten-minute traversal leak test, the frame budget.'],
  ['T4', 1, 'The Morrowind screens', 'Inventory, map, character sheet, level-up, journal screen, out-of-combat HUD, the dialogue window\'s look, UI diegesis. Ring 1, not ring 6: these are on screen in the first few minutes, we hold Morrowind interface references for them, and several already score at or near the bar.'],

  // ---- ring 7
  ['E1', 7, 'The opening', 'First launch to first meaningful choice as an unbroken act; the opening as an exchange; the first-hour beat sheet.'],
  ['E2', 7, 'The first hour as interaction', 'What the hands do, and when the player becomes competent.'],
  ['E3', 7, 'Death and recovery', 'Die, lose your souls, respawn, run back, get them back. Checkpoint spacing as level design.'],
  ['E4', 7, 'Cross-system payoff and emergence', 'The seam-sterility floor, the fuzzing protocol for combinations nobody wrote, the permissiveness budget.'],
  ['E5', 7, 'Build identity', 'Six archetypes each taken through the whole game and arriving somewhere different.'],
  ['E6', 7, 'Session shape and pacing', 'The twenty-hour curve, the mid-game sag, the novelty decay, the anecdote census.'],
  ['E7', 7, 'Endings and the last hour', 'The approach, the point of no return, and what the world says about what you did.'],
  ['E8', 7, 'Returning after a week', 'Can a cold player rebuild their own intentions from in-game information alone.'],
  ['E9', 7, 'Sound', 'Regional ambience with things that actually happen in it, music policy and where silence is correct, voice policy, the web-audio voice budget.'],
].map(([id, ring, title, blurb]) => ({ id, ring, title, blurb }));

const ITEM_IDS = new Set(ITEMS.map((i) => i.id));

/* --------------------------------------------- authored mapping: RI -> items */
// primary listed first. "METHOD" = describes how we work, not what we build.
const RI_MAP = {
  // 10-combat
  'RI-AI01': ['G4'], 'RI-AI02': ['G4'], 'RI-AI03': ['G4'], 'RI-AI04': ['G4'], 'RI-AI05': ['G4'],
  'RI-AI06': ['G5'], 'RI-AI07': ['G5'],
  'RI-CMB01': ['G2'], 'RI-CMB02': ['G2', 'G3'], 'RI-CMB03': ['G2'], 'RI-CMB04': ['G2'], 'RI-CMB05': ['G2'],
  'RI-CMB06': ['G1', 'G2'], 'RI-CMB07': ['I1', 'G7'], 'RI-CMB08': ['G8'], 'RI-CMB09': ['G8'],
  'RI-CMB10': ['G8', 'C5'], 'RI-CMB11': ['G2', 'T2'], 'RI-CMB12': ['G7'],
  // 12-weapons
  'RI-WPN01': ['G3'], 'RI-WPN02': ['G3'], 'RI-WPN03': ['G3'], 'RI-WPN04': ['G3'],
  'RI-WPN05': ['G3', 'F11'], 'RI-WPN06': ['G3'], 'RI-WPN07': ['G3'],
  // 15-camera
  'RI-CAM01': ['G1'], 'RI-CAM02': ['G1'], 'RI-CAM03': ['G1'], 'RI-CAM04': ['G1'],
  'RI-CAM05': ['G1'], 'RI-CAM06': ['G1'], 'RI-CAM07': ['F10', 'G1'],
  // 20-progression
  'RI-PRG01': ['C2'], 'RI-PRG02': ['C2'], 'RI-PRG03': ['C2'], 'RI-PRG04': ['C2', 'E3'],
  'RI-PRG05': ['C4'], 'RI-PRG06': ['C2'], 'RI-PRG07': ['C3', 'G2'], 'RI-PRG08': ['C3'], 'RI-PRG09': ['C5'],
  // 22-character
  'RI-CHR01': ['C1'], 'RI-CHR02': ['C1'], 'RI-CHR03': ['C1'],
  // 23-stealth-crime
  'RI-CRM01': ['C8'], 'RI-CRM02': ['C8', 'P8'], 'RI-STL01': ['C7', 'F9'], 'RI-STL02': ['C7'],
  // 25-magic
  'RI-MAG01': ['C6', 'G2'], 'RI-MAG02': ['C6'], 'RI-MAG03': ['C6'], 'RI-MAG04': ['C6', 'P10'],
  'RI-MAG05': ['F12'], 'RI-MAG06': ['C6'],
  // 30-quests
  'RI-QST01': ['P8'], 'RI-QST02': ['P10'], 'RI-QST03': ['P7', 'P8'], 'RI-QST04': ['P6'],
  'RI-QST05': ['P10'], 'RI-QST06': ['P9'], 'RI-QST07': ['P10'], 'RI-QST08': ['P10'], 'RI-QST09': ['P10'],
  // 40-dialogue
  'RI-DLG01': ['P1'], 'RI-DLG02': ['P2'], 'RI-DLG03': ['P2'], 'RI-DLG04': ['P2'], 'RI-DLG05': ['P3'],
  'RI-DLG06': ['P2'], 'RI-DLG07': ['I3', 'P2'], 'RI-DLG08': ['P2'], 'RI-DLG09': ['P10', 'G7'],
  // 50-world
  'RI-TRV01': ['W7'], 'RI-TRV02': ['W7', 'C6'],
  'RI-WLD01': ['W1'], 'RI-WLD02': ['W3'], 'RI-WLD03': ['W4'], 'RI-WLD04': ['W2', 'F13'],
  'RI-WLD05': ['W11'], 'RI-WLD06': ['W6'], 'RI-WLD07': ['W8'], 'RI-WLD08': ['W10'],
  'RI-WLD09': ['W11'], 'RI-WLD10': ['W9', 'F7'], 'RI-WLD11': ['W9'], 'RI-WLD12': ['W2'],
  'RI-WLD13': ['W5'], 'RI-WLD14': ['W11', 'F8'], 'RI-WLD15': ['W3', 'F6'], 'RI-WLD16': ['W1', 'F6'],
  // 60-lore
  'RI-LOR01': ['P5'], 'RI-LOR02': ['P5'], 'RI-LOR03': ['P4'], 'RI-LOR04': ['P5'],
  'RI-LOR05': ['P5'], 'RI-LOR06': ['P5'], 'RI-LOR07': ['P5'], 'RI-LOR08': ['P5'],
  // 70-visual
  'RI-VIS01': ['I3'], 'RI-VIS02': ['I5'], 'RI-VIS03': ['I3', 'F2', 'F3'], 'RI-VIS04': ['F5', 'F2', 'F3', 'F4'],
  'RI-VIS05': ['F13'], 'RI-VIS06': ['I3'], 'RI-VIS07': ['F13'], 'RI-VIS08': ['F10', 'F11'], 'RI-VIS10': ['F10', 'I5'], 'RI-VIS09': ['I5'],
  // 80-methods  (METHOD bucket — but each has a build-side owner too)
  'RI-MTH01': ['I1'], 'RI-MTH02': ['I1'], 'RI-MTH03': ['I3'], 'RI-MTH04': ['I2'],
  'RI-MTH05': ['I5'], 'RI-MTH06': ['I2', 'I5'], 'RI-MTH07': ['I4'],
  // 85-platform
  'RI-PLT01': ['T3', 'F14'], 'RI-PLT02': ['T3'], 'RI-PLT03': ['T3'],
  // 86-ui
  'RI-UIX01': ['G6'], 'RI-UIX02': ['P3'], 'RI-UIX03': ['C3', 'T4'], 'RI-UIX04': ['P3', 'T4'],
  'RI-UIX05': ['P4'], 'RI-UIX06': ['T4', 'F13'], 'RI-UIX07': ['T4'], 'RI-UIX08': ['P1', 'T4'],
  // 87-audio
  'RI-AUD01': ['G6'], 'RI-AUD02': ['E9', 'T3'], 'RI-AUD03': ['E9'], 'RI-AUD04': ['E9'], 'RI-AUD05': ['E9'],
  // 88-journeys
  'RI-JRN01': ['E1'], 'RI-JRN02': ['E2'], 'RI-JRN03': ['T2'], 'RI-JRN04': ['T2'],
  'RI-JRN05': ['T1'], 'RI-JRN06': ['E3'], 'RI-JRN07': ['P6'], 'RI-JRN08': ['E8'], 'RI-JRN09': ['E1'],
  // 95-experience
  'RI-CMP01': ['E4'], 'RI-CMP02': ['E4'], 'RI-CMP03': ['E5'],
  'RI-EXP01': ['E1'], 'RI-EXP02': ['E6'], 'RI-EXP03': ['E6'], 'RI-EXP04': ['E6'],
  'RI-EXP05': ['E7'], 'RI-EXP06': ['E4'],
};

const METHOD_ITEMS = new Set(['RI-MTH01', 'RI-MTH02', 'RI-MTH03', 'RI-MTH04', 'RI-MTH05', 'RI-MTH06', 'RI-MTH07', 'RI-VIS01', 'RI-VIS06', 'RI-CMP02']);

/* ------------------------------------------- authored mapping: plan -> items */
const PLAN_MAP = {
  'BUILDER-EXECUTION-CONTRACT': ['I4'], 'COST-EXPERIMENTS': [], 'COST-INSTRUMENT': [],
  'W1-00': ['I1', 'T1', 'T3'],
  'W1-01': ['W1', 'W2', 'W7'],
  'W1-02': ['W2', 'W11'],
  'W1-03': ['W9', 'F7'],
  'W1-04': ['W4', 'W5'],
  'W1-05': ['W6', 'W7', 'C4'],
  'W1-06': ['G1'],
  'W1-07': ['C1', 'E1'],
  'W1-08': ['T2', 'G7'],
  'W1-09': ['G2', 'G4'],
  'W1-10': ['G3'],
  'W1-11': ['G6', 'G3'],
  'W1-12': ['G4', 'G5'],
  'W1-13': ['C2', 'E3', 'W10'],
  'W1-14': ['C6'],
  'W1-15': ['C7', 'C8'],
  'W1-16': ['C2', 'C3', 'C4'],
  'W1-17': ['P1', 'P2'],
  'W1-18': ['P3', 'P6', 'P10'],
  'W1-19': ['P9'],
  'W1-20': ['P8', 'P7'],
  'W1-21': ['T4', 'G6'],
  'W1-22': ['E9'],
  'W1-23': ['P5'],
  'W1-24': ['F10', 'I3'],
  'W1-25': ['E4'],
  'W1-26': ['E1', 'C1'],
  'W1-27': ['W3', 'P10'],
  'W1-28': ['E2'],
  'W1-29': ['T2'],
  'W1-30': ['F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9', 'F10', 'F11', 'F12', 'F13', 'F14'],
  'W1-30A': ['F5', 'F2'],
  'W1-30B': ['F4', 'F2', 'F3'],
  'W1-30C': ['F1'],
  'W1-30D': ['F10', 'F11'],
  'W1-30E': ['F8'],
  'W1-30F': ['F6'],
  'W1-30G': ['F9'],
  'W1-30H': ['F12', 'F7'],
  'W1-30K': ['F13'],
  'W1-30S': ['F1', 'F2', 'F3', 'F4', 'F5'],
  'W1-30V': ['I2'],
  'W1-30-EVIDENCE': ['I2'],
  'W1-30-LIBRARY': ['F8', 'F10'],
  'W1-DLG-TOPIC-WEB': ['P1'],
  'W1-HUD-TOAST': ['T4', 'G6'],
};

/* -------------------------------------------- authored mapping: gap -> items */
const GAP_MAP = {
  'AUDB2-F1': ['E9'],
  'GAP-FCT-03': ['P7', 'I4'],
  'GAP-PACK-01': ['I3'],
  'GAP-PROSE-01': ['P2'],
  'GAP-W1-02-m68-unanswerable': ['W2', 'I3'],
  'GAP-W1-03-water-surface-undrawn-and-frozen': ['F7', 'W9'],
  'GAP-W1-12-approach-cannot-close-on-a-walking-player': ['G4'],
  'GAP-W1-12-m3-chase-bot-dwell-on-the-items-own-fixture': ['G4'],
  'GAP-W1-13-clock-consequences-never-fire': ['W10'],
  'GAP-W1-13-roster-clause-has-no-control': ['W10', 'I4'],
  'GAP-W1-16-a-save-and-a-reload-change-your-roll-class': ['C3', 'T1'],
  'GAP-W1-16-equip-load-cannot-see-the-thing-in-your-hands': ['C3'],
  'GAP-W1-17-an-archetype-with-no-mouth': ['P2'],
  'GAP-W1-22-event-level-graded-on-a-median': ['E9'],
  'GAP-W1-23-both-registered-voices-on-slavery-are-colonists': ['P5'],
  'GAP-W1-25-the-control-facility-has-an-optional-control': ['E4', 'I4'],
  'GAP-W1-26-creation-cannot-be-completed-from-the-title': ['C1', 'E1'],
  'GAP-W1-26-r3-body-race-fails-silently-and-is-refused-eleven-nodes-later': ['C1'],
  'GAP-W1-30c-wetness-mask-blind-to-instancematrix': ['F1'],
  'GAP-W1-act5-argument-entry-shadowed': ['P1', 'P9'],
  'GAP-W1-attr-scale-ceilings-rest-on-an-unmeasured-souls-economy': ['C2'],
  'GAP-W1-audio-emitter-consumption': ['E9', 'I4'],
  'GAP-W1-combat-exemplar-has-no-danger': ['G7', 'I1'],
  'GAP-W1-consumption-sweep-tripwire-is-a-name-grep': ['I4'],
  'GAP-W1-creation-is-an-api-not-a-scene': ['C1'],
  'GAP-W1-crime-enforcement-is-a-free-win': ['C8'],
  'GAP-W1-deploy-instruments-point-at-the-tester-not-the-player': ['T3'],
  'GAP-W1-enemy-attacks-cannot-reach-contact-range': ['G2'],
  'GAP-W1-enemy-weapon-volume-still-cannot-reach-and-the-body-pays-its-damage': ['G2'],
  'GAP-W1-faction-ladders-are-bricked-up-at-rank-5': ['P7'],
  'GAP-W1-faction-ladders-are-doors-onto-empty-corridors': ['P7', 'P8'],
  'GAP-W1-hearth-levelup-gate-reads-a-method-that-does-not-exist': ['C2'],
  'GAP-W1-height-fog-credit-unanchored': ['F4'],
  'GAP-W1-input-calibration-outlives-its-pad-on-disconnect': ['T2'],
  'GAP-W1-input-discoverability-unmeasured': ['T2'],
  'GAP-W1-interior-door-draws-nothing': ['W5'],
  'GAP-W1-library-martial-single-hand-fingerprint': ['P5', 'P4'],
  'GAP-W1-LIBRARY-the-library-has-no-reader-on-the-world-side': ['P4'],
  'GAP-W1-library-unreachable-contradiction-pairs': ['P4', 'P5'],
  'GAP-W1-m6-pan-correlation-passes-the-panner-it-was-built-to-catch': ['G6'],
  'GAP-W1-magic-effects-no-behaviour': ['C6'],
  'GAP-W1-magic-skill-frozen': ['C6', 'C2'],
  'GAP-W1-magic-spellmaking-has-no-world-side-surface': ['C6'],
  'GAP-W1-mainquest-topic-bootstrap': ['P9', 'P1'],
  'GAP-W1-map-fix-drops-the-journal-from-the-page-walk': ['T4'],
  'GAP-W1-map-the-audit-is-computed-and-never-published': ['T1'],
  'GAP-W1-mark-teaches-nothing-to-the-journal': ['P3'],
  'GAP-W1-pbr-material-set-unbound': ['F1'],
  // The F1 critic's finding: two onBeforeCompile hooks declare uWetness/esWet twice, the actor
  // program fails to link, and no character has a body. F1 owns it; F10 carries the consequence.
  'GAP-W1-f1-actor-body-shader-does-not-link': ['F1', 'F10'],
  'GAP-W1-platform-prng-never-drawn': ['I1'],
  'GAP-W1-platform-save-drops-entity-prev-state': ['T1'],
  'GAP-W1-population-save-reload-repays-every-corpse': ['T1', 'G5'],
  'GAP-W1-provstream-arrival-burst': ['T3'],
  'GAP-W1-quest-givers-not-in-the-world': ['P7'],
  'GAP-W1-questionnaire-route-is-unreadable-and-unnamed': ['C1'],
  'GAP-W1-rendered-text-accessor-blind-to-the-hud-surface': ['T4', 'I1'],
  'GAP-W1-road-join-has-no-gate': ['W1'],
  'GAP-W1-save-purse-has-no-writer': ['C4', 'T1'],
  'GAP-W1-settlement-has-no-outside': ['W4'],
  'GAP-W1-seven-tenths-of-the-indoor-floor-is-at-the-top-of-the-light-scale': ['C7', 'F9'],
  'GAP-W1-souls-alive-keyed-on-eid': ['C2'],
  'GAP-W1-souls-world-copy-of-the-values-is-53pc-stale': ['C2'],
  'GAP-W1-stealth-crime-model-not-coupled-to-the-world': ['C7', 'C8'],
  'GAP-W1-the-building-is-smaller-than-the-room': ['W4'],
  'GAP-W1-the-door-puts-you-inside-the-building': ['W5'],
  'GAP-W1-the-doorstep-cannot-get-you-back-in': ['W5'],
  'GAP-W1-the-fence-buys-your-victims-own-furniture': ['C7'],
  'GAP-W1-the-naming-moment-is-still-orphan-text': ['C1'],
  'GAP-W1-two-placement-mechanisms-collide': ['W5'],
  'GAP-W1-ui-detectors-that-cannot-see': ['T4', 'I1'],
  'GAP-W1-ui-map-outside-the-ar2-detectors': ['T4'],
  'GAP-W1-w1-30d-guard-misses-part-deletion': ['F10', 'I2'],
  'GAP-W1-w1-30e-street-gate-never-ran': ['F8', 'I2'],
  'GAP-W1-w1-30s-seam-incomplete': ['F12'],
  'GAP-W1-walkpath-absorbs-teleports': ['W1', 'I1'],
  'GAP-W1-weapon-animation-model-has-no-rendered-consumer': ['G3', 'F11'],
  'GAP-W1-weapon-impact-and-material-model-has-no-consumer': ['G3'],
  'GAP-W1-weapon-movesets-not-wired-to-the-runtime': ['G3'],
  'GAP-W1-world-region-identity-is-a-tint': ['W2', 'F13'],
  'GAP-W1-world-trunk-road-below-the-waterline': ['W1'],
};

/* --------------------------------------------------------------- assemble */
const problems = [];
const chk = (ids, who) => {
  for (const i of ids) if (!ITEM_IDS.has(i)) problems.push(`${who} -> unknown item ${i}`);
};

const refRows = REF_ITEMS.map((r) => {
  const to = RI_MAP[r.id] || [];
  chk(to, r.id);
  return {
    ...r, covered_by: to,
    bucket: to.length === 0 ? 'UNCOVERED' : (METHOD_ITEMS.has(r.id) ? 'method_doctrine' : 'build'),
    ...stateOf(r.id),
  };
});

const planRows = PLANS.map((p) => {
  const to = PLAN_MAP[p.id];
  if (to === undefined) { problems.push(`plan ${p.id} has no mapping entry`); return { ...p, covered_by: [], bucket: 'UNMAPPED' }; }
  chk(to, p.id);
  return { ...p, covered_by: to, bucket: to.length === 0 ? 'out_of_scope_process' : 'build' };
});

const gapRows = GAPS.map((g) => {
  const to = GAP_MAP[g.id];
  if (to === undefined) { problems.push(`gap ${g.id} has no mapping entry`); return { ...g, covered_by: [], bucket: 'UNMAPPED' }; }
  chk(to, g.id);
  return { ...g, covered_by: to, bucket: to.length === 0 ? 'UNCOVERED' : 'build' };
});

// per-item rollup
const rollup = ITEMS.map((it) => {
  const ri = refRows.filter((r) => r.covered_by.includes(it.id));
  const gp = gapRows.filter((r) => r.covered_by.includes(it.id));
  const pl = planRows.filter((r) => r.covered_by.includes(it.id));
  const scored = ri.map((r) => r.best_score_0_10).filter((x) => typeof x === 'number');
  let state = 'not_started';
  if (gp.length && scored.length) state = scored.every((s) => s >= 6) && !gp.length ? 'at_bar' : 'built_below_bar';
  else if (scored.length) state = scored.every((s) => s >= 6) ? 'at_bar' : 'built_below_bar';
  else if (pl.length) state = 'planned_unjudged';
  return {
    ...it,
    ref_items: ri.map((r) => r.id), n_ref_items: ri.length,
    never_judged: ri.filter((r) => !r.judged).map((r) => r.id),
    open_gaps: gp.map((g) => g.id), n_open_gaps: gp.length,
    blocking_gaps: gp.filter((g) => g.severity === 'blocking' || g.severity === 'critical').length,
    plans: pl.map((p) => p.id),
    derived_state: state,
  };
});

/* ---- back-check: where each proposed item would have lived in the OLD ROADMAP.
   null = the old orchestration/ROADMAP.md (commit dd222b79) had no item for it.
   "partial:X" = the old item X names part of this and silently omits the rest. */
const OLD_HOME = {
  I1: null, I2: 'V17', I3: 'V17/F2', I4: null, I5: 'F3',
  F1: 'V1', F2: 'V2', F3: 'V3', F4: 'V4/V12', F5: 'V5', F6: 'V9/V10', F7: 'V11',
  F8: 'V8', F9: 'partial:V4', F10: 'V6', F11: 'V7', F12: 'V13', F13: 'V15', F14: 'V16',
  G1: null, G2: 'partial:C3', G3: 'C2', G4: 'partial:Step5', G5: 'C4/C7',
  G6: null, G7: 'Step5/C6', G8: null,
  W1: 'partial:D1', W2: 'D1', W3: 'D4', W4: 'Step2b/2c', W5: 'Step2/2b', W6: 'D2',
  W7: null, W8: 'D3', W9: 'partial:V11', W10: 'B4/D5', W11: 'B10',
  C1: null, C2: 'B8', C3: null, C4: 'B6', C5: null, C6: 'B7',
  C7: 'partial:B5', C8: 'B5',
  P1: 'Step3', P2: 'Step3', P3: 'B1', P4: 'B9', P5: 'partial:B9', P6: 'B2',
  P7: 'Step4', P8: 'B3', P9: null, P10: 'partial:B2',
  T1: 'E2', T2: 'E3', T3: 'E4', T4: 'partial:V14',
  E1: 'E1', E2: 'partial:E1', E3: 'C5', E4: null, E5: null, E6: null, E7: null,
  E8: 'E2', E9: 'E5',
};
for (const it of rollup) {
  it.old_roadmap_home = OLD_HOME[it.id] === undefined ? 'MAPPING-MISSING' : OLD_HOME[it.id];
}
const oldHomeless = rollup.filter((r) => r.old_roadmap_home === null);
const oldPartial = rollup.filter((r) => typeof r.old_roadmap_home === 'string' && r.old_roadmap_home.startsWith('partial:'));
const homelessRefIds = [...new Set(oldHomeless.flatMap((r) => r.ref_items))];
const homelessGapIds = [...new Set(oldHomeless.flatMap((r) => r.open_gaps))];

const out = {
  generated: new Date().toISOString(),
  baseline_commit: 'dd222b7951a6d0564c992bb6d39b783f0f293188',
  method: 'Inventory derived by fs walk + generated ledgers. Mapping authored by the audit agent after reading every RI title/front-matter, every plan heading, and every open gap record.',
  inventory_counts: {
    reference_items: refRows.length,
    plans: planRows.length,
    open_gaps: gapRows.length,
    proposed_roadmap_items: ITEMS.length,
  },
  rings: RINGS,
  proposed_items: rollup,
  reference_items: refRows,
  plans: planRows,
  open_gaps: gapRows,
  uncovered: {
    reference_items: refRows.filter((r) => r.bucket === 'UNCOVERED').map((r) => r.id),
    open_gaps: gapRows.filter((r) => r.bucket === 'UNCOVERED' || r.bucket === 'UNMAPPED').map((r) => r.id),
    plans: planRows.filter((r) => r.bucket === 'UNMAPPED').map((r) => r.id),
  },
  mapping_problems: problems,
  old_roadmap_backcheck: {
    note: 'Against orchestration/ROADMAP.md as it stood at baseline commit dd222b79. Now condemned; kept because it names what a memory-written roadmap misses.',
    proposed_items_with_no_old_home: oldHomeless.map((r) => ({ id: r.id, title: r.title, ref_items: r.ref_items, open_gaps: r.open_gaps })),
    proposed_items_only_partially_homed: oldPartial.map((r) => ({ id: r.id, title: r.title, old: r.old_roadmap_home })),
    reference_items_with_no_old_home: homelessRefIds.sort(),
    open_gaps_with_no_old_home: homelessGapIds.sort(),
  },
};

/* ------------------------------------------------------------ dependencies */
// [from, needs, why, evidence]
const DEPS = [
  ['P6', 'W6', 'A quest given in prose cannot be followed across a world with no landmarks to name.', 'RI-JRN07 requires "rumour, giver, prose, landmark, resolution"; RI-WLD06 is the landmark/signpost item.'],
  ['P7', 'W4', 'Unlocking a rank does not make a quest reachable if its giver is standing nowhere.', 'GAP-W1-quest-givers-not-in-the-world (blocking): 9 of 94 givers exist where a player can stand; GAP-W1-settlement-has-no-outside (blocking).'],
  ['P9', 'P1', 'The main quest is entered through a dialogue topic, and two topic files declare the same entry.', 'GAP-W1-mainquest-topic-bootstrap (blocking); GAP-W1-act5-argument-entry-shadowed (blocking).'],
  ['P3', 'W6', 'The journal cannot be judged as the only navigation aid until looking at a landmark writes to it.', 'GAP-W1-mark-teaches-nothing-to-the-journal (blocking): looking at a mark writes a know: flag and no journal entry; journal [10] -> [10] on all four browser legs.'],
  ['C7', 'F9', 'The sneak model reads a light field that is saturated: 71.8% of interior cells read L = 1.0000.', 'GAP-W1-seven-tenths-of-the-indoor-floor-is-at-the-top-of-the-light-scale (blocking, stealth.detection.model).'],
  ['C4', 'T1', 'Gold lives in two places and the spendable one has no writer, so the economy does not survive a reload.', 'GAP-W1-save-purse-has-no-writer (blocking).'],
  ['C3', 'T1', 'A save and a reload change your roll class, so equip-load tiers cannot be judged across a session.', 'GAP-W1-16-a-save-and-a-reload-change-your-roll-class (blocking).'],
  ['C2', 'C1', 'Levelling happens only at the hearth screen, and the hearth gate calls a method that does not exist; creation never reaches a scene to set the stats it levels.', 'GAP-W1-hearth-levelup-gate-reads-a-method-that-does-not-exist (blocking); GAP-W1-creation-is-an-api-not-a-scene (blocking).'],
  ['F10', 'G1', 'The player body is judged under an always-behind camera; you cannot inspect a body you cannot orbit.', 'RI-CAM07 is filed side: modern-fidelity and titled "what the always-behind camera specifically demands of the player’s body"; owner: "rotate the camera around the player".'],
  ['F2', 'I2', 'Visual work is graded from hardware capture, and two W1-30 gates never ran because the camera was in the wrong place or the daemon returned nothing.', 'GAP-W1-w1-30e-street-gate-never-ran (blocking); GAP-W1-w1-30d-guard-misses-part-deletion (major).'],
  ['F13', 'I5', 'Protocol B has never run, and the anchor plates cannot satisfy their own rows.', 'RI-VIS02 best score 0/10 across 1 verdict; RI-VIS09 never named by any verdict.'],
  ['G7', 'G1', 'Nobody can judge how a fight feels without a camera that frames it.', 'RI-CAM03 (lock-on framing) and RI-CAM04 never named by any verdict; RI-CAM01 best 2/10.'],
  ['G7', 'T2', 'Judging feel means humans playing, which means controls a stranger can find.', 'GAP-W1-input-discoverability-unmeasured (major): RI-JRN03’s entire discoverability block, 14 of its 100 points, unmeasured.'],
  ['G3', 'F11', 'The moveset animation model has no rendered consumer, so weapon identity cannot be seen.', 'GAP-W1-weapon-animation-model-has-no-rendered-consumer (blocking): 1150 clips over 2689 slots, 87 weapons.'],
  ['G2', 'G4', 'An enemy attack volume that cannot reach contact range makes the exchange untestable from the receiving end.', 'GAP-W1-enemy-attacks-cannot-reach-contact-range (blocking).'],
  ['W2', 'F6', 'Region identity is currently a tint over three shared primitives; distinguishing regions is a terrain and air problem before it is a colour problem.', 'GAP-W1-world-region-identity-is-a-tint (blocking).'],
  ['W5', 'W4', 'A door cannot be drawn into a building whose exterior does not exist.', 'GAP-W1-settlement-has-no-outside (blocking); GAP-W1-interior-door-draws-nothing (blocking).'],
  ['E1', 'C1', 'Creation cannot be completed from the title screen, so the opening has no first act.', 'GAP-W1-26-creation-cannot-be-completed-from-the-title (blocking).'],
  ['E3', 'C2', 'The corpse run is a souls economy, and SoulsSystem._alive is keyed on eid with nothing authorised to clear it.', 'GAP-W1-souls-alive-keyed-on-eid (major).'],
  ['E9', 'I4', 'All four positional emitters compute every frame and produce no sound on any device.', 'GAP-W1-audio-emitter-consumption (blocking).'],
  ['I3', 'I5', 'A blind pack that cannot separate quality from provenance is not a judgement.', 'GAP-PACK-01 (high, process.critic.discipline).'],
];
out.dependencies = DEPS.map(([from, needs, why, evidence]) => ({ from, needs, why, evidence }));
const ringOf = Object.fromEntries(ITEMS.map((i) => [i.id, i.ring]));
// Rank by (ring, position in the ITEMS array) — the order a reader actually sees, since
// coverage.md groups by ring. Ranking by array position alone let a ring change slip past the
// ordering gate silently; caught by the delete-the-fix arm, which is why this is not `map((i,n))`.
const idx = Object.fromEntries(
  ITEMS.map((i, n) => [i, n])
    .sort((a, b) => (a[0].ring - b[0].ring) || (a[1] - b[1]))
    .map(([i], rank) => [i.id, rank]),
);
out.dependency_order_violations = out.dependencies
  .filter((d) => idx[d.needs] > idx[d.from])
  .map((d) => ({ ...d, from_ring: ringOf[d.from], needs_ring: ringOf[d.needs] }));

fs.mkdirSync(OUT, { recursive: true });
fs.mkdirSync('orchestration/status', { recursive: true });
fs.writeFileSync(JSON_OUT, JSON.stringify(out, null, 1));

/* ------------------------------------------------------------- readable md */
const L = [];
L.push('# Coverage matrix — inventory on disk → proposed roadmap items');
L.push('');
L.push('> **GENERATED.** Regenerate with `node tools/roadmap-coverage.mjs`.');
L.push('> Canonical data: `orchestration/status/ROADMAP-COVERAGE-AUDIT.coverage.json`. Narrative: `reports/roadmap-audit/AUDIT.md`.');
L.push(`> Generated ${out.generated} against baseline \`${out.baseline_commit}\`.`);
L.push('');
L.push('| inventory | n | uncovered |');
L.push('|---|---:|---:|');
L.push(`| reference items (\`corpus/**/RI-*.md\`) | ${refRows.length} | ${out.uncovered.reference_items.length} |`);
L.push(`| plans (\`orchestration/plans/*\`) | ${planRows.length} | ${out.uncovered.plans.length} |`);
L.push(`| open gaps (\`GAP-LEDGER.json\`) | ${gapRows.length} | ${out.uncovered.open_gaps.length} |`);
L.push(`| proposed roadmap items | ${ITEMS.length} | — |`);
L.push('');
L.push('## Proposed items');
L.push('');
for (const ring of Object.keys(RINGS)) {
  L.push(`### Ring ${ring} — ${RINGS[ring]}`);
  L.push('');
  L.push('| id | item | ref items | never judged | open gaps (blocking) | plans | state | old roadmap |');
  L.push('|---|---|---|---|---|---|---|---|');
  for (const it of rollup.filter((r) => String(r.ring) === ring)) {
    L.push(`| \`${it.id}\` | ${it.title} | ${it.ref_items.join(' ') || '—'} | ${it.never_judged.join(' ') || '—'} | ${it.n_open_gaps} (${it.blocking_gaps}) | ${it.plans.join(' ') || '—'} | ${it.derived_state} | ${it.old_roadmap_home === null ? '**none**' : it.old_roadmap_home} |`);
  }
  L.push('');
}
L.push('## Reference items — every id, its home, and its judged state');
L.push('');
L.push('| id | area | side | covered by | judged | best 0-10 | state |');
L.push('|---|---|---|---|---:|---:|---|');
for (const r of refRows) L.push(`| \`${r.id}\` | ${r.area} | ${r.side} | ${r.covered_by.join(' ')} | ${r.verdicts} | ${r.best_score_0_10 ?? '—'} | ${r.state} |`);
L.push('');
L.push('## Open gaps — every id and its home');
L.push('');
L.push('| gap | sev | subsystem path | covered by |');
L.push('|---|---|---|---|');
for (const g of gapRows) L.push(`| \`${g.id}\` | ${g.severity} | \`${g.path || '?'}\` | ${g.covered_by.join(' ')} |`);
L.push('');
L.push('## Plans — every file and its home');
L.push('');
L.push('| plan | title | covered by |');
L.push('|---|---|---|');
for (const p of planRows) L.push(`| \`${p.id}\` | ${p.title} | ${p.covered_by.join(' ') || '*process, not build scope*'} |`);
L.push('');
fs.writeFileSync(path.join(OUT, 'coverage.md'), L.join('\n'));

/* ------------------------------------------------------------------ gates */
// Rule 24: a tool that cannot fail is not a tool. These arms are required to be able to go red.
let bad = 0;
const fail = (m) => { console.error('FAIL: ' + m); bad++; };
if (out.uncovered.reference_items.length) fail(`${out.uncovered.reference_items.length} reference items have no roadmap home: ${out.uncovered.reference_items.join(' ')}`);
if (out.uncovered.plans.length) fail(`${out.uncovered.plans.length} plans have no roadmap home: ${out.uncovered.plans.join(' ')}`);
if (out.uncovered.open_gaps.length) fail(`${out.uncovered.open_gaps.length} open gaps have no roadmap home: ${out.uncovered.open_gaps.join(' ')}`);
if (problems.length) fail(`${problems.length} mapping problems`);
const orphanItems = rollup.filter((r) => !r.n_ref_items && !r.n_open_gaps && !r.plans.length);
if (orphanItems.length) fail(`${orphanItems.length} proposed items have nothing mapped to them: ${orphanItems.map((e) => e.id).join(' ')}`);
if (out.dependency_order_violations.length) {
  for (const v of out.dependency_order_violations) fail(`ordering: ${v.from} is scheduled before ${v.needs}, which it needs — ${v.why}`);
}
// Self-check that the inventory was actually read, not defaulted to empty.
if (!refRows.length || !planRows.length || !gapRows.length) fail('inventory came back empty — run from the repo root');
console.log(bad ? `\n${bad} gate(s) RED` : '\nall gates green');
process.exit(bad ? 1 : 0);

console.log('reference items :', refRows.length, '| uncovered:', out.uncovered.reference_items.length);
console.log('plans           :', planRows.length, '| unmapped :', out.uncovered.plans.length);
console.log('open gaps       :', gapRows.length, '| uncovered:', out.uncovered.open_gaps.length);
console.log('proposed items  :', ITEMS.length);
console.log('mapping problems:', problems.length);
for (const p of problems) console.log('  ' + p);
const empty = rollup.filter((r) => !r.n_ref_items && !r.n_open_gaps && !r.plans.length);
console.log('proposed items with NOTHING mapped to them:', empty.length, empty.map((e) => e.id).join(' '));
console.log('never-judged ref items:', refRows.filter((r) => !r.judged).length);
console.log('judged below bar     :', refRows.filter((r) => r.state === 'judged_below_bar').length);
console.log('judged at/above bar  :', refRows.filter((r) => r.state === 'judged_at_or_above_bar').length);
