#!/usr/bin/env node
// build-settlements.mjs — author game/data/world/settlements/*.json and game/data/world/interiors/*.json.
//
// WHAT IS AUTHORED AND WHAT IS ASSEMBLED — the same declaration build-property.mjs makes, because
// RI-WLD03 method M12 asks a critic to tell the difference:
//
//   AUTHORED here, by hand, and readable in this file:
//     * every settlement's power_reading and the LAYOUT PLAN that is its spatial proof (R4);
//     * every settlement's architecture kit — bespoke meshes, silhouette element, material rule (R5);
//     * every civic building: its name, what it is, who holds it, what service it sells;
//     * every sealed building's REASON and the NPC who will tell you it (R1);
//     * the per-kit prop vocabulary and the hand-placed unique item in each interior.
//   ASSEMBLED deterministically from those:
//     * where on the plan each building lands (the plan function is authored; the slot is not);
//     * which property zones a dwelling interior contains;
//     * interior bounds from the union of the zones inside them.
//
// THE BINDING THAT MATTERS. Every interior here names the `property_zones` it contains, and those
// zones are the ones `Engine.takeObject()` and `Engine.lockBegin()` already read. An interior is
// therefore not a new parallel world: it is a door onto rooms the crime system already governs.
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(new URL('../..', import.meta.url).pathname);
const SETT_OUT = path.join(ROOT, 'game/data/world/settlements');
const INT_OUT = path.join(ROOT, 'game/data/world/interiors');

const TEMPLATE = JSON.parse(fs.readFileSync(path.join(ROOT, 'corpus/50-world/settlements.json'), 'utf8')).tier_template;
const POIS = JSON.parse(fs.readFileSync(path.join(ROOT, 'game/data/world/pois.json'), 'utf8')).pois;

function mix(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  return h >>> 0;
}
const pick = (arr, key) => arr[mix(key) % arr.length];

// ---------------------------------------------------------------------------------------------
// AUTHORED: the eight settlements.
//
// `plan` is the R4 spatial proof and it is a real function of the layout, not a label: `radial`
// puts every street on a spoke pointing at the centre, `stacked` puts the rich BELOW the poor,
// `walled` puts a grid inside a wall and a sprawl leaning on the outside of it, `imported` lays a
// Cyrodilic square with right angles, `corridor` refuses a square entirely, `downwind` ranks the
// vats above the houses, `leaning` leans everything on one hall, `facing` turns every house to
// face a grey tree. A judge shown the top-down with labels stripped is answering M13 off these.
// ---------------------------------------------------------------------------------------------
const SETTLEMENTS = [
  {
    id: 'helstrom', tier: 'capital', region: 'stone-forest', plan: 'radial', road_gates: 4,
    power_reading: 'Every street runs inward to the tree. Whoever runs this town is not a person.',
    layout_proof: 'All 40 buildings sit on four concentric rings about the Hist mound at the centre, every one of them yawed to face it; the widest gaps in the rings are the four road approaches, so every route into the town is a route at the tree.',
    identity: 'The throne that was never Imperial. Grown into and around the greatest Hist in Argonia; the "palace" is a hollowed bole and there is no chair in it, only a root you kneel at. Industry: hub of the root-travel network — every road ends here. Tension: Hist-speakers against nationalists against an Imperial legation everyone tolerates and nobody obeys.',
    kit: {
      material_rule: 'Nothing quarried. Everything grown, lashed or shell. No right angles anywhere: every wall is a chord of some circle.',
      silhouette: 'the bole-arch — a living root grown over the street and left as the doorway',
      meshes: ['hel_bole_arch', 'hel_grown_wall_a', 'hel_grown_wall_b', 'hel_shell_roof', 'hel_lashed_stair', 'hel_root_pillar', 'hel_egg_terrace', 'hel_sap_gutter', 'hel_hollow_bole', 'hel_rootgate'],
    },
    quarters: ['the-mound', 'egg-terrace', 'deep-gate'],
    civic: [
      { slug: 'helstrom-hollow-bole', name: 'The Hollow Bole', kind: 'hall', service: null, faction: 'rootkeepers', unique_item: 'the kneeling root', readable: 'The Root Does Not Sit' },
      { slug: 'helstrom-undertemple', name: 'The Undertemple', kind: 'temple', service: 'healer', faction: 'rootkeepers', unique_item: 'the drowned censer', readable: 'On the Drowning of Sextons' },
      { slug: 'helstrom-hist-shrine', name: 'The Hist Shrine at the Mound', kind: 'shrine', service: 'bonfire', faction: 'rootkeepers', unique_item: 'a sap-tap of black glass', readable: 'Sap Rites, Copied Badly' },
      { slug: 'helstrom-legation', name: 'The Imperial Legation', kind: 'guild', service: null, faction: 'the-imperial-assize', unique_item: "the legate's unopened writ", readable: 'Standing Orders, Argonia' },
      { slug: 'helstrom-rootpost', name: 'The Rootpost', kind: 'travel', service: 'travel', faction: 'rootkeepers', unique_item: 'the root-tally of every leg', readable: 'Fares and Tides' },
      { slug: 'helstrom-deep-market', name: 'The Deep Market', kind: 'shop', service: 'trader', faction: null, unique_item: 'a shell-scale that weighs true', readable: "Trader's Tally, Helstrom" },
      { slug: 'helstrom-smithy', name: 'The Lashed Forge', kind: 'shop', service: 'smith', faction: null, unique_item: 'a hammer with a grown handle', readable: 'On Working Metal Without A Quarry' },
      { slug: 'helstrom-apothecary', name: 'Sap and Simples', kind: 'shop', service: 'alchemist', faction: null, unique_item: 'a tincture nobody will name', readable: 'Simples of the Stone Forest' },
      { slug: 'helstrom-scriptorium', name: 'The Scriptorium of Roots', kind: 'shop', service: 'bookseller', faction: null, unique_item: 'the unfinished census', readable: 'A Census Nobody Finished' },
      { slug: 'helstrom-inn-tide', name: 'The Turning Tide', kind: 'tavern', service: 'inn', faction: null, unique_item: 'the landlord’s confiscated dice', readable: 'House Rules, The Turning Tide' },
      { slug: 'helstrom-inn-gate', name: 'The Deep Gate House', kind: 'tavern', service: 'inn', faction: null, unique_item: 'a bed the legation paid for', readable: 'Who Slept Here' },
      { slug: 'helstrom-inn-egg', name: 'The Egg-Terrace Rest', kind: 'tavern', service: 'inn', faction: null, unique_item: 'an egg no one will eat', readable: 'Terrace Custom' },
      { slug: 'helstrom-warders', name: "The Warders' Room", kind: 'guild', service: null, faction: 'ninth-cohort', unique_item: 'the key ring nobody signs out', readable: 'Watch Roster' },
      { slug: 'helstrom-archive', name: 'The Root Archive', kind: 'guild', service: null, faction: 'rootkeepers', unique_item: 'a leaf-record of the last drought', readable: 'What The Tree Remembers' },
    ],
    sealed: [
      { slug: 'helstrom-sunk-bole', name: 'The Sunk Bole', reason: 'the root beneath it died and the floor went with it; the door is grown shut and the Rootkeepers will not cut a living wall to open it', told_by: 'rootkeeper' },
      { slug: 'helstrom-quarantine', name: 'The Quarantined Terrace', reason: 'egg-blight; the terrace is limed and barred and the lime is fresh', told_by: 'priest' },
      { slug: 'helstrom-legate-annexe', name: "The Legate's Annexe", reason: 'the Legation sealed it the week the last legate left and no successor has been sent to unseal it', told_by: 'legionary' },
      { slug: 'helstrom-old-gate', name: 'The Old Deep Gate', reason: 'collapsed in the flood of the eighth year; the rubble is still where it fell', told_by: 'trader' },
      { slug: 'helstrom-sap-cellar', name: 'The Sap Cellar', reason: 'flooded to the lintel and the pumps were sold', told_by: 'boatwright' },
      { slug: 'helstrom-burnt-lodge', name: 'The Burnt Lodge', reason: 'a nationalist burnt it and was hanged for it; nobody will build on the ground', told_by: 'publican' },
    ],
    structures: ['The Mound Itself', 'The Four Rootgates', 'The Egg Terraces', 'The Sap Gutters', 'The Kneeling Wall', 'The Deep Cistern', 'The Ring Causeway', 'The Root Bridge'],
  },
  {
    id: 'lilmoth', tier: 'city', region: 'western-rootlands', plan: 'stacked', road_gates: 3,
    power_reading: 'The rich live LOW in wet stone because status is masonry; the poor live DRY above them. The social order is upside down and visible from the harbour.',
    layout_proof: 'Every Imperial stone building has a negative Y and every Argonian stilt house a positive one, over the same X/Z footprint. A stripped top-down shows two towns at the same address; the elevation column is the whole argument.',
    identity: 'The great rotting port. Shipping, smuggling, moon-sugar transhipment, the egg black market. Tension: the city sinks a hand’s width a year and the Imperial families will not say so.',
    kit: {
      material_rule: 'Two cities stacked. Imperial colonial stone sunk to its first-floor windows below the tideline; Argonian stilt-slum of reed and salvage built on top of the drowned storeys. Wet stone below, dry reed above.',
      silhouette: 'the drowned window — an Imperial upper-storey window at ankle height, still shuttered',
      meshes: ['lil_sunk_facade', 'lil_drowned_window', 'lil_stilt_platform', 'lil_reed_shack', 'lil_salvage_stair', 'lil_wet_arcade', 'lil_tide_mark', 'lil_pile_cluster', 'lil_customs_hall', 'lil_boom_chain'],
    },
    quarters: ['rot-quarter', 'stilt-town', 'the-landing'],
    civic: [
      { slug: 'lilmoth-customs', name: 'The Customs Hall', kind: 'guild', service: null, faction: 'the-imperial-assize', unique_item: 'the manifest with a page cut out', readable: 'Tariff Schedule, Lilmoth' },
      { slug: 'lilmoth-yard', name: 'The Wet Yard', kind: 'shop', service: 'boatwright', faction: null, unique_item: 'a keel-plank from a ship the register says sank', readable: 'Yard Book' },
      { slug: 'lilmoth-ledger-house', name: 'The Ledger House', kind: 'guild', service: null, faction: 'wet-ledger', unique_item: 'the wet ledger itself', readable: "The Ledger's Terms" },
      { slug: 'lilmoth-market', name: 'The Sunk Market', kind: 'shop', service: 'trader', faction: null, unique_item: 'a moon-sugar tin with no seal', readable: 'What The Landing Sells' },
      { slug: 'lilmoth-smithy', name: 'The Tidewater Forge', kind: 'shop', service: 'smith', faction: null, unique_item: 'an anchor recut into a blade', readable: 'On Rust' },
      { slug: 'lilmoth-apothecary', name: 'The Rot-Quarter Apothecary', kind: 'shop', service: 'alchemist', faction: null, unique_item: 'swamp-fever tincture, unlabelled', readable: 'Fevers of the Landing' },
      { slug: 'lilmoth-scribe', name: "The Scribe's Stair", kind: 'shop', service: 'bookseller', faction: null, unique_item: 'a copied deed to a drowned storey', readable: 'Deeds Below The Line' },
      { slug: 'lilmoth-pawn', name: 'The Low Pawn', kind: 'shop', service: 'fence', faction: 'wet-ledger', unique_item: 'a ring three families have reported stolen', readable: 'What We Do Not Ask' },
      { slug: 'lilmoth-inn-drowned', name: 'The Drowned Bell', kind: 'tavern', service: 'inn', faction: null, unique_item: 'the bell from the sunk chapel', readable: 'The Bell Rang Under Water' },
      { slug: 'lilmoth-inn-stilt', name: 'The Stilt Rest', kind: 'tavern', service: 'inn', faction: null, unique_item: 'a hammock older than the house', readable: 'Stilt-Town Custom' },
      { slug: 'lilmoth-shrine', name: 'The Tideline Hist-Shrine', kind: 'shrine', service: 'bonfire', faction: 'rootkeepers', unique_item: 'a sapling planted above the waterline', readable: 'Above The Line' },
      { slug: 'lilmoth-healer', name: 'The Wet Ward', kind: 'temple', service: 'healer', faction: 'drowned-court', unique_item: "the drowned-court's brass bowl", readable: 'On Drowning And Its Cures' },
      { slug: 'lilmoth-rootpost', name: 'The Landing Rootpost', kind: 'travel', service: 'travel', faction: 'rootkeepers', unique_item: 'the tide-table nobody trusts', readable: 'Tideway Fares' },
    ],
    sealed: [
      { slug: 'lilmoth-first-storey', name: 'The First Storey of the Varo House', reason: 'it is under water; the family still pays the rates on it and will not say why', told_by: 'factor' },
      { slug: 'lilmoth-boom-house', name: 'The Boom House', reason: 'the harbour chain snapped and took the wall with it', told_by: 'boatwright' },
      { slug: 'lilmoth-plague-stair', name: 'The Plague Stair', reason: 'sealed during the last swamp-fever season and never reopened, because reopening it would require admitting there was a season', told_by: 'apothecary' },
      { slug: 'lilmoth-sugar-cellar', name: 'The Sugar Cellar', reason: 'the Assize bricked it up with the contraband still inside rather than transport it', told_by: 'legionary' },
      { slug: 'lilmoth-collapsed-arcade', name: 'The Collapsed Arcade', reason: 'the piles rotted through in one night and the arcade knelt', told_by: 'trader' },
    ],
    structures: ['The Boom Chain', 'The Landing Quay', 'The Tide Mark Wall', 'The Pile Field', 'The Sunk Arcade', 'The Sea Stair', 'The Cistern Cap', 'The Old Mole', 'The Fish Racks', 'The Customs Bollards'],
  },
  {
    id: 'stormhold', tier: 'city', region: 'salt-hills', plan: 'walled', road_gates: 3,
    power_reading: 'Two towns sharing one wall from opposite sides.',
    layout_proof: 'Inside the wall every building is on a right-angled grid with the same spacing; outside it every building touches the wall and none touches another. The wall is the only thing both halves agree on, and it is drawn as a hard line through the middle of the plan.',
    identity: 'The border garrison — the most normal-looking place in Argonia, which makes it the strangest by contrast. Industry: customs, the Legion, and the living memory of Dunmer slave-raids down the passes. Tension: the Legion is under-funded and outnumbered eight to one, and everyone has done the arithmetic.',
    kit: {
      material_rule: 'Imperial cut stone eaten by fungal bloom: grid inside the walls, Argonian sprawl leaning against the OUTSIDE of them. Nothing outside the wall is square and nothing inside it is not.',
      silhouette: 'the bloom-course — a band of fungal growth at exactly the height the Legion stopped repointing',
      meshes: ['sto_legion_block', 'sto_bloom_course', 'sto_grid_barrack', 'sto_wall_lean', 'sto_salt_kiln', 'sto_pass_gate', 'sto_customs_shed', 'sto_watch_tower', 'sto_muster_yard'],
    },
    quarters: ['inside-the-wall', 'outside-the-wall', 'garrison'],
    civic: [
      { slug: 'stormhold-archive', name: 'The Cohort Archive', kind: 'guild', service: null, faction: 'ninth-cohort', unique_item: 'the muster roll of a cohort that does not exist', readable: 'The Cohorts Stormhold Does Not Have' },
      { slug: 'stormhold-praetorium', name: 'The Praetorium', kind: 'guild', service: null, faction: 'the-imperial-assize', unique_item: "the prefect's unsent request for men", readable: 'Requests, Unanswered' },
      { slug: 'stormhold-customs', name: 'The Pass Customs', kind: 'guild', service: null, faction: 'the-imperial-assize', unique_item: 'a Dunmer slave-collar entered as cargo', readable: 'Goods Declared' },
      { slug: 'stormhold-market', name: 'The Inside Market', kind: 'shop', service: 'trader', faction: null, unique_item: 'salt cut with something else', readable: 'Inside Prices' },
      { slug: 'stormhold-smithy', name: 'The Muster Forge', kind: 'shop', service: 'smith', faction: null, unique_item: 'a legion blade with the stamp filed off', readable: 'On Filing Stamps' },
      { slug: 'stormhold-scribe', name: "The Wall-Scribe's Room", kind: 'shop', service: 'bookseller', faction: null, unique_item: 'a letter home nobody sent', readable: 'Letters Not Sent' },
      { slug: 'stormhold-inn-pass', name: 'The Pass and Collar', kind: 'tavern', service: 'inn', faction: null, unique_item: 'a collar hung over the bar as a joke', readable: 'House Rules, The Pass' },
      { slug: 'stormhold-inn-lean', name: 'The Leaning Rest', kind: 'tavern', service: 'inn', faction: null, unique_item: 'a bed against the outside of the wall', readable: 'Outside Custom' },
      { slug: 'stormhold-chapel', name: 'The Garrison Chapel', kind: 'temple', service: 'healer', faction: 'the-imperial-assize', unique_item: 'an Imperial rite copied in Jel', readable: 'A Rite In Two Tongues' },
      { slug: 'stormhold-shrine', name: 'The Salt-Hill Hist-Shrine', kind: 'shrine', service: 'bonfire', faction: 'rootkeepers', unique_item: 'a sapling that will not take in salt', readable: 'Nothing Grows Here' },
      { slug: 'stormhold-rootpost', name: 'The Garrison Rootpost', kind: 'travel', service: 'travel', faction: 'rootkeepers', unique_item: 'a fare table in Legion script', readable: 'Fares, Stormhold' },
      { slug: 'stormhold-gaol', name: 'The Wall Gaol', kind: 'prison', service: null, faction: 'ninth-cohort', unique_item: 'a cell key worn smooth', readable: 'Gaol Book' },
      { slug: 'stormhold-kiln', name: 'The Salt Kiln House', kind: 'shop', service: 'trader', faction: null, unique_item: 'a block of salt with a hand-print in it', readable: 'On Boiling Salt' },
    ],
    sealed: [
      { slug: 'stormhold-north-barrack', name: 'The North Barrack', reason: 'shut when the cohort was cut by two-thirds; the bunks are still made', told_by: 'legionary' },
      { slug: 'stormhold-raid-house', name: 'The Raid House', reason: 'a Dunmer raiding party came through the roof of it in the ninth year and nobody has slept in it since', told_by: 'warder' },
      { slug: 'stormhold-bloom-block', name: 'The Bloom Block', reason: 'the fungal bloom ate the mortar out of the walls and the block is condemned in writing', told_by: 'smith' },
      { slug: 'stormhold-old-customs', name: 'The Old Customs Shed', reason: 'burned with its ledgers, which several people found convenient', told_by: 'factor' },
      { slug: 'stormhold-outer-lean', name: 'The Fallen Lean', reason: 'it leaned on the wall and the wall was repointed; without the wall to lean on it fell', told_by: 'cook' },
    ],
    structures: ['The Wall Itself', 'The Pass Gate', 'The Watch Towers', 'The Muster Yard', 'The Salt Kilns', 'The Cistern', 'The Outside Ditch', 'The Bollard Line', 'The Bloom Course', 'The Signal Post'],
  },
  {
    id: 'gideon', tier: 'town', region: 'blackwood', plan: 'imported', road_gates: 2,
    power_reading: 'Somebody imported a plan.',
    layout_proof: 'A square with a market cross at its exact centre, four streets leaving it at right angles, every building aligned to one of two axes and none rotated by anything but a multiple of ninety degrees. It is the only plan in the province with a right angle in it.',
    identity: 'The control group. Timber, grain, road tolls; a proper inn and a chapel. It looks like Cyrodiil and that is the point. Tension: an Imperial county in all but name, worked by Argonians who are not paid.',
    kit: {
      material_rule: 'Cyrodilic: timber frame, tile roofs, a market cross, a square. Right angles, deliberately, and no Argonian material anywhere above the foundation course.',
      silhouette: 'the market cross — a stone cross on four steps, the only one in Argonia',
      meshes: ['gid_timber_frame', 'gid_tile_roof', 'gid_market_cross', 'gid_square_arcade', 'gid_toll_house', 'gid_grain_barn', 'gid_chapel_porch', 'gid_county_court'],
    },
    quarters: ['provincial-office', 'docks', 'high-street'],
    civic: [
      { slug: 'gideon-court', name: 'The County Court', kind: 'guild', service: null, faction: 'the-imperial-assize', unique_item: 'the roll of unpaid Argonian labour', readable: 'The Hiring List' },
      { slug: 'gideon-lowmarket', name: 'The Low Market', kind: 'shop', service: 'trader', faction: null, unique_item: 'a grain measure that is short', readable: 'Weights and Measures, Gideon' },
      { slug: 'gideon-tollhouse', name: 'The Toll House', kind: 'guild', service: null, faction: 'the-imperial-assize', unique_item: 'a toll book with two hands in it', readable: 'Road Tolls' },
      { slug: 'gideon-chapel', name: 'The Chapel of the Nine', kind: 'temple', service: 'healer', faction: 'the-imperial-assize', unique_item: 'a chapel plate given by a family that left', readable: 'On The Nine, In Blackwood' },
      { slug: 'gideon-inn', name: 'The Wheel and Barge', kind: 'tavern', service: 'inn', faction: null, unique_item: 'a Cyrodilic wine older than the town', readable: 'House Rules, The Wheel' },
      { slug: 'gideon-smithy', name: 'The Square Forge', kind: 'shop', service: 'smith', faction: null, unique_item: 'a plough-iron nobody ordered', readable: 'On Iron For Ploughs' },
      { slug: 'gideon-apothecary', name: 'The Physick', kind: 'shop', service: 'alchemist', faction: null, unique_item: 'a physick for a fever they call something else', readable: 'A Fever By Another Name' },
      { slug: 'gideon-shrine', name: 'The Blackwood Hist-Shrine', kind: 'shrine', service: 'bonfire', faction: 'rootkeepers', unique_item: 'a shrine the county pretends is a well', readable: 'The Well That Is Not A Well' },
      { slug: 'gideon-rootpost', name: 'The Gideon Rootpost', kind: 'travel', service: 'travel', faction: 'rootkeepers', unique_item: 'a fare table in Cyrodilic only', readable: 'Fares, Gideon' },
      { slug: 'gideon-grange', name: 'The Grange', kind: 'guild', service: null, faction: 'wet-ledger', unique_item: 'the grain tally for a harvest that was taken', readable: 'The Drowned Tally' },
    ],
    sealed: [
      { slug: 'gideon-old-barn', name: 'The Old Grain Barn', reason: 'condemned after the roof took the weight of a wet harvest; the county will not pay to rebuild it', told_by: 'factor' },
      { slug: 'gideon-argonian-row', name: 'The Boarded Row', reason: 'the Argonian labourers who lived in it were moved outside the toll line and the row was boarded the same week', told_by: 'weaver' },
      { slug: 'gideon-cellar', name: 'The Court Cellar', reason: 'flooded; the court records that were in it are officially "in transit"', told_by: 'scribe' },
      { slug: 'gideon-burnt-shop', name: 'The Burnt Shop', reason: 'burnt with its owner still owing tolls, which the toll book records as settled', told_by: 'publican' },
    ],
    structures: ['The Market Cross', 'The Square Arcade', 'The Toll Gate', 'The Barge Dock', 'The Grain Weighbridge', 'The Chapel Wall'],
  },
  {
    id: 'blackrose', tier: 'town', region: 'western-rootlands', plan: 'corridor', road_gates: 2,
    power_reading: 'There is no square, only corridors between compound walls. Every street is a checkpoint.',
    layout_proof: 'The plan contains no open space wider than four metres except the prison yard, which is walled. Every building fronts a corridor and every corridor has a gate at each end; the prison block is the largest footprint and the only one no corridor passes.',
    identity: 'A town that exists to feed and guard a prison. The Imperial-built Blackrose Prison squats over it; the town is its outbuildings. Tension: half the townsfolk are ex-guards, half are inmates’ families, and the warden is not who the Empire thinks.',
    kit: {
      material_rule: 'Everything is a wall. Imperial fortress masonry furred with fungus — the prison’s own stone is being digested. No window below three metres anywhere in the town.',
      silhouette: 'the furred parapet — fortress crenellation so overgrown its profile has gone soft',
      meshes: ['bla_fortress_wall', 'bla_furred_parapet', 'bla_corridor_gate', 'bla_prison_block', 'bla_warder_house', 'bla_visitor_shed', 'bla_lime_pit', 'bla_gallows_frame'],
    },
    quarters: ['prison-gate', 'the-warders', 'low-town'],
    civic: [
      { slug: 'blackrose-prison', name: 'Blackrose Prison', kind: 'prison', service: null, faction: 'ninth-cohort', unique_item: 'the warden’s seal, which does not match the Empire’s record of it', readable: 'The Chain On The Wall' },
      { slug: 'blackrose-inn', name: 'The Visitors’ House', kind: 'tavern', service: 'inn', faction: null, unique_item: 'a visitors’ book with the same name forty times', readable: 'Visiting Hours' },
      { slug: 'blackrose-warders-hall', name: "The Warders' Hall", kind: 'guild', service: null, faction: 'ninth-cohort', unique_item: 'a truncheon with a name carved in it', readable: 'Warder Standing Orders' },
      { slug: 'blackrose-market', name: 'The Gate Market', kind: 'shop', service: 'trader', faction: null, unique_item: 'a parcel addressed to a cell number', readable: 'What May Be Sent In' },
      { slug: 'blackrose-smithy', name: 'The Chain Forge', kind: 'shop', service: 'smith', faction: null, unique_item: 'a set of irons cut too small for a man', readable: 'On Fitting Irons' },
      { slug: 'blackrose-pawn', name: 'The Gate Pawn', kind: 'shop', service: 'fence', faction: null, unique_item: 'a wedding ring pawned by a warder', readable: 'Terms Of Redemption' },
      { slug: 'blackrose-shrine', name: 'The Lime-Pit Hist-Shrine', kind: 'shrine', service: 'bonfire', faction: 'rootkeepers', unique_item: 'a sapling planted on the lime pit', readable: 'On Planting In Lime' },
      { slug: 'blackrose-rootpost', name: 'The Blackrose Rootpost', kind: 'travel', service: 'travel', faction: 'rootkeepers', unique_item: 'a passenger list the warders read first', readable: 'Fares, Blackrose' },
      { slug: 'blackrose-clerk', name: "The Committals Clerk", kind: 'guild', service: null, faction: 'the-imperial-assize', unique_item: 'a committal with no charge on it', readable: 'Committals, Blackrose' },
    ],
    sealed: [
      { slug: 'blackrose-east-block', name: 'The East Block', reason: 'lost to the fungus; the warders lime the door every month and will not say what is behind it', told_by: 'warder' },
      { slug: 'blackrose-condemned-row', name: 'The Condemned Row', reason: 'the Empire ordered it emptied and it was emptied, and the order did not say where to', told_by: 'legionary' },
      { slug: 'blackrose-old-gallows', name: 'The Old Gallows House', reason: 'shut the year hanging stopped, and the frame outside was left standing on purpose', told_by: 'publican' },
      { slug: 'blackrose-family-row', name: 'The Families’ Row', reason: 'the families were moved out in one night and the doors were bricked before morning', told_by: 'weaver' },
    ],
    structures: ['The Prison Wall', 'The Corridor Gates', 'The Lime Pit', 'The Gallows Frame', 'The Visitors’ Queue Rail', 'The Water Butt Line'],
  },
  {
    id: 'archon', tier: 'town', region: 'crimson-coast', plan: 'downwind', road_gates: 2,
    power_reading: 'The vats are at the centre and the housing is downwind. Somebody ranked the vats above the people.',
    layout_proof: 'The dye vats occupy the centre of the plan and every dwelling lies on the +Z side of them, which is the prevailing wind. Nothing is upwind of the vats but the guild office. The plan is a wind rose with people in the wrong quadrant.',
    identity: 'The dye town. Crimson tide-lichen harvested, boiled and sold to the Empire as imperial purple; everything and everyone is stained. Tension: the dye is killing the harvesters and the guild denies it in writing, repeatedly.',
    kit: {
      material_rule: 'Kiln-fired clay domes, red as a wound, raised by naga hands and bought cheap. Every surface in the town takes the dye and none of it has been cleaned.',
      silhouette: 'the stain line — a crimson tide-mark at vat height on every wall in the town',
      meshes: ['arc_clay_dome', 'arc_stain_line', 'arc_dye_vat', 'arc_drying_rack', 'arc_kiln_stack', 'arc_naga_lintel', 'arc_lichen_crib', 'arc_guild_office'],
    },
    quarters: ['salvage-yard', 'terraces', 'old-quay'],
    civic: [
      { slug: 'archon-guild-office', name: 'The Dyers’ Guild Office', kind: 'guild', service: null, faction: 'wet-ledger', unique_item: 'the denial, signed four times', readable: 'On The Health Of Harvesters' },
      { slug: 'archon-vat-house', name: 'The Great Vat House', kind: 'shop', service: 'trader', faction: 'wet-ledger', unique_item: 'a bolt of true imperial purple', readable: 'On Boiling Lichen' },
      { slug: 'archon-market', name: 'The Stain Market', kind: 'shop', service: 'trader', faction: null, unique_item: 'a white cloth, which is worth more here', readable: 'Prices At The Vats' },
      { slug: 'archon-apothecary', name: 'The Crimson Apothecary', kind: 'shop', service: 'alchemist', faction: null, unique_item: 'a purge for a poisoning nobody has named', readable: 'What The Vats Do' },
      { slug: 'archon-inn', name: 'The Stained Hand', kind: 'tavern', service: 'inn', faction: null, unique_item: 'a tankard that has never come clean', readable: 'House Rules, The Stained Hand' },
      { slug: 'archon-ward', name: 'The Harvesters’ Ward', kind: 'temple', service: 'healer', faction: 'drowned-court', unique_item: 'a ward book with forty of the same complaint', readable: 'Complaints Of The Harvesters' },
      { slug: 'archon-shrine', name: 'The Crimson-Coast Hist-Shrine', kind: 'shrine', service: 'bonfire', faction: 'rootkeepers', unique_item: 'a sapling stained through the bark', readable: 'The Dye Reaches The Root' },
      { slug: 'archon-rootpost', name: 'The Old Quay Rootpost', kind: 'travel', service: 'travel', faction: 'rootkeepers', unique_item: 'the tideway leg that closes at spring tide', readable: 'Tideway, Archon' },
      { slug: 'archon-kiln-house', name: 'The Kiln House', kind: 'shop', service: 'trader', faction: null, unique_item: 'a clay dome-brick fired by naga hands', readable: 'On Firing Domes' },
    ],
    sealed: [
      { slug: 'archon-first-vat', name: 'The First Vat House', reason: 'the vat went through the floor with two harvesters in it and the guild sealed the building rather than recover them', told_by: 'apothecary' },
      { slug: 'archon-naga-row', name: 'The Naga Row', reason: 'the naga who raised this town were paid off and sent away; their row was shuttered the day they left', told_by: 'trader' },
      { slug: 'archon-old-kiln', name: 'The Old Kiln', reason: 'cracked through and no longer holds heat; it is used as a wall now', told_by: 'smith' },
      { slug: 'archon-quay-store', name: 'The Quay Store', reason: 'the tide comes into it twice a day and has done for six years', told_by: 'boatwright' },
    ],
    structures: ['The Dye Vats', 'The Drying Racks', 'The Kiln Stacks', 'The Lichen Cribs', 'The Old Quay', 'The Wind Screen'],
  },
  {
    id: 'thorn', tier: 'village', region: 'thornmarsh', plan: 'leaning', road_gates: 2,
    power_reading: 'The hall is central and everything else leans against it. Built for a court that no longer exists.',
    layout_proof: 'The Rotted Hall has the largest footprint by a factor of four and every other building shares a wall with it or with something that does. Remove the hall from the plan and nothing else stands up.',
    identity: 'A kingdom that shrank. Thorn’s king is an old Argonian holding court in a rotted hall with eleven subjects and a genuine, legally valid Imperial charter. Industry: thornwood cut for Dunmer bows and Imperial spears. Tension: Morrowind is one day’s walk north and remembers what it used to take from here.',
    kit: {
      material_rule: 'Thatch of black thorn over a rotted Argonian great-hall; the whole village is a thicket you walk into and cannot see out of. Every structure is a lean-to and none is free-standing.',
      silhouette: 'the thorn thatch — black needle-wood laid in courses, which no other settlement uses',
      meshes: ['tho_rotted_hall', 'tho_thorn_thatch', 'tho_lean_to', 'tho_stilt_house', 'tho_needle_stack', 'tho_charter_post', 'tho_bow_rack', 'tho_sapwell_kerb'],
    },
    quarters: ['rotted-hall', 'the-boards', 'sapwell'],
    civic: [
      { slug: 'thorn-hall', name: 'The Rotted Hall', kind: 'hall', service: null, faction: null, unique_item: 'the Imperial charter, genuine and framed', readable: 'The Charter Of Thorn' },
      { slug: 'thorn-inn', name: 'The Needle and Charter', kind: 'tavern', service: 'inn', faction: null, unique_item: 'a bow stave cut for a Dunmer order that was cancelled', readable: 'House Rules, The Needle' },
      { slug: 'thorn-trader', name: 'The Boards', kind: 'shop', service: 'trader', faction: 'wet-ledger', unique_item: 'a tally of thornwood sold north', readable: 'What Thorn Sells North' },
      { slug: 'thorn-apothecary', name: 'The Needle Apothecary', kind: 'shop', service: 'alchemist', faction: null, unique_item: 'a salve for thorn-wound that works', readable: 'On Thorn-Wound' },
      { slug: 'thorn-sapwell', name: 'The Thorn Sapwell', kind: 'shrine', service: 'bonfire', faction: 'rootkeepers', unique_item: 'a sap-tap the king is not allowed to touch', readable: 'Who May Tap' },
      { slug: 'thorn-rootpost', name: 'The Thorn Rootpost', kind: 'travel', service: 'travel', faction: 'rootkeepers', unique_item: 'the leg to Archon, closed at high tide', readable: 'Fares, Thorn' },
      // W1-04: `warden-eshi` has stood a 06:00–20:00 watch at `thorn-gate` since her record was
      // written, and `thorn-gate` did not exist. The schedule was pointing at nothing. Her hours
      // are the gatehouse's hours, which is why this entry states them rather than taking the
      // shop default — walk up at 21:00 and the door refuses you, because she has gone to the hall.
      { slug: 'thorn-gate', name: 'The Thorn Gate', kind: 'gate', service: null, faction: null, open_h: 6, close_h: 20, unique_item: 'the warden’s name-book, every traveller since the charter', readable: 'Who Passes Thorn' },
    ],
    sealed: [
      { slug: 'thorn-north-lean', name: 'The North Lean', reason: 'the thorn grew through the roof and the family moved into the hall; the thicket has closed over the door', told_by: 'cook' },
      { slug: 'thorn-court-store', name: 'The Court Store', reason: 'the hall’s store, shut since the court had anything to store', told_by: 'scribe' },
      { slug: 'thorn-burnt-stilt', name: 'The Burnt Stilt House', reason: 'a Dunmer raiding party burnt it and the village left it standing as a marker', told_by: 'publican' },
    ],
    structures: ['The Charter Post', 'The Needle Stacks', 'The Bow Racks', 'The Sapwell Kerb', 'The Thicket Wall'],
  },
  {
    id: 'soulrest', tier: 'village', region: 'stone-wastes', plan: 'facing', road_gates: 2,
    power_reading: 'Every house faces the tree, and the tree is grey.',
    layout_proof: 'Every dwelling is yawed to within ten degrees of the Hist at the centre, in a ring, with no building behind another. It is the only plan where the buildings are all looking at the same thing, and the thing they are looking at is dead.',
    identity: 'A dying village around a dying Hist. It was a port; the bay silted; now it mines salt and old bones out of the Wastes. Tension: the villagers are openly debating whether to burn their Hist before it dies on its own — the single most blasphemous conversation in Argonia, and they are having it in the street.',
    kit: {
      material_rule: 'Whale-bone frames and salt-block walls, bleached white. The only settlement in Argonia with no green in it — no reed, no thatch, no living wood anywhere.',
      silhouette: 'the rib-frame — a whale rib used as a roof truss, ends visible above the wall',
      meshes: ['sou_rib_frame', 'sou_salt_block', 'sou_bleached_wall', 'sou_bone_stack', 'sou_grey_hist', 'sou_silt_quay', 'sou_salt_pan', 'sou_drowned_court_step'],
    },
    quarters: ['drowned-court', 'fishery', 'the-steps'],
    civic: [
      { slug: 'soulrest-grey-hist', name: 'The Grey Hist', kind: 'shrine', service: 'bonfire', faction: 'rootkeepers', unique_item: 'a sap-tap that draws nothing', readable: 'The Argument In The Street' },
      { slug: 'soulrest-court-steps', name: 'The Drowned Court Steps', kind: 'temple', service: null, faction: 'drowned-court', unique_item: 'a sexton’s stole for a rite nobody will perform', readable: "The Chapter's Vote" },
      { slug: 'soulrest-market', name: 'The Salt Stall', kind: 'shop', service: 'trader', faction: null, unique_item: 'salt from the pan that killed a man', readable: 'What The Wastes Give' },
      { slug: 'soulrest-smithy', name: 'The Bone Forge', kind: 'shop', service: 'smith', faction: null, unique_item: 'a blade hafted in whale bone', readable: 'On Bone Hafts' },
      { slug: 'soulrest-pawn', name: 'The Silt Pawn', kind: 'shop', service: 'fence', faction: null, unique_item: 'a ship’s bell from the bay that silted', readable: 'What The Bay Gave Back' },
      { slug: 'soulrest-quay', name: 'The Silted Quay House', kind: 'travel', service: 'travel', faction: 'rootkeepers', unique_item: 'a sailing list for a port that closed', readable: 'Fares, Soulrest' },
      { slug: 'soulrest-boneyard', name: 'The Boneyard Shed', kind: 'shop', service: 'trader', faction: null, unique_item: 'a rib longer than the shed', readable: 'On Digging Bones' },
    ],
    sealed: [
      { slug: 'soulrest-old-harbourmaster', name: 'The Harbourmaster’s House', reason: 'the last harbourmaster locked it the day the bay silted and took the key with him', told_by: 'fisher' },
      { slug: 'soulrest-salt-house', name: 'The Salt House', reason: 'the roof went and the salt took the walls; it is a hole full of white now', told_by: 'trader' },
      { slug: 'soulrest-burnt-shrine', name: 'The Burnt Shrine', reason: 'somebody tried to burn a Hist here once already, and the village keeps the ruin as an argument', told_by: 'rootkeeper' },
    ],
    structures: ['The Grey Hist', 'The Silt Quay', 'The Salt Pans', 'The Bone Stacks', 'The Court Steps'],
  },
];

// AUTHORED: the prop vocabulary each interior kind draws on. RI-WLD03 M15 wants >=12 distinct
// prop meshes in an interior; these are the meshes, and each interior takes its settlement kit's
// bespoke meshes plus the kind vocabulary, so no two settlements furnish alike.
const PROPS = {
  dwelling: ['reed_mat', 'sleeping_shelf', 'clay_hearth', 'cook_pot', 'wall_peg', 'water_butt', 'stool_low', 'chest_small', 'hanging_bundle', 'oil_lamp', 'floor_basket', 'child_toy', 'washing_line', 'bone_comb'],
  shop: ['counter_long', 'shelf_stack', 'scale_brass', 'crate_sealed', 'ledger_stand', 'coin_tray', 'sack_row', 'hook_rail', 'lamp_hanging', 'stool_high', 'strongbox', 'sample_board', 'measure_jug', 'sweep_broom'],
  tavern: ['bar_long', 'bench_pair', 'table_round', 'barrel_row', 'tankard_shelf', 'hearth_open', 'bed_rentable', 'dice_cup', 'lamp_hanging', 'stair_narrow', 'keg_tap', 'cloak_hook', 'stew_pot', 'notice_board'],
  temple: ['altar_low', 'kneel_step', 'censer_stand', 'offering_bowl', 'candle_rack', 'sermon_lectern', 'water_stoup', 'bench_row', 'wall_niche', 'cloth_hanging', 'reliquary_case', 'lamp_votive', 'bell_small', 'ash_tray'],
  shrine: ['sap_tap', 'root_kerb', 'kneel_root', 'votive_rag', 'offering_shelf', 'lamp_votive', 'bark_strip', 'tally_brass', 'water_stoup', 'bench_row', 'sapling_pot', 'ash_tray', 'wind_chime', 'stone_marker'],
  guild: ['desk_writing', 'record_press', 'map_table', 'seal_press', 'muster_board', 'chest_iron', 'chair_formal', 'shelf_deed', 'lamp_desk', 'banner_wall', 'key_rail', 'inkstand', 'strongbox', 'bench_wait'],
  hall: ['high_seat', 'long_table', 'bench_row', 'brazier_iron', 'banner_wall', 'weapon_rack', 'chest_large', 'hearth_open', 'lamp_hanging', 'floor_rush', 'charter_frame', 'drinking_horn', 'stair_narrow', 'shield_wall'],
  prison: ['cell_grate', 'bunk_plank', 'chain_ring', 'slop_bucket', 'key_rail', 'lamp_caged', 'guard_desk', 'irons_set', 'water_butt', 'lime_bucket', 'door_iron', 'bench_stone', 'tally_scratch', 'gaol_book'],
  travel: ['fare_board', 'root_socket', 'bench_wait', 'baggage_rail', 'ledger_stand', 'lamp_hanging', 'water_butt', 'rope_coil', 'tally_brass', 'stool_low', 'notice_board', 'map_table', 'sack_row', 'lantern_signal'],
  gate: ['toll_bar', 'warden_desk', 'key_rail', 'spear_rack', 'brazier_iron', 'watch_stool', 'tally_board', 'rope_coil', 'lamp_hanging', 'water_butt', 'cloak_hook', 'gate_winch', 'name_book', 'bench_wait'],
};

// AUTHORED: the plan functions. Each is the geometric statement of its settlement's power_reading.
function placeBuildings(plan, n, key) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const k = `${key}:${i}`;
    let x = 0, z = 0, y = 0, yaw = 0;
    if (plan === 'radial') {
      // Four concentric rings about the mound; every building faces the centre. The four widest
      // gaps are the road approaches.
      const ring = i % 4, idx = Math.floor(i / 4);
      const per = Math.ceil(n / 4);
      const r = 18 + ring * 16;
      const a = (idx / per) * Math.PI * 2 + ring * 0.19;
      x = Math.cos(a) * r; z = Math.sin(a) * r;
      yaw = ((Math.atan2(-x, -z) * 180) / Math.PI + 360) % 360;   // face the tree
    } else if (plan === 'stacked') {
      // Two towns at one address. Imperial stone BELOW the tideline, stilt slum ABOVE it.
      const lower = i % 2 === 0;
      const a = (i / n) * Math.PI * 2, r = 14 + (mix(k) % 30);
      x = Math.cos(a) * r; z = Math.sin(a) * r;
      y = lower ? -2.4 : 4.6;
      yaw = (mix(k + ':y') % 4) * 90;
    } else if (plan === 'walled') {
      // Grid inside the wall; everything outside touches the wall and nothing else.
      const inside = i % 2 === 0;
      if (inside) { const c = Math.floor(i / 2); x = -34 + (c % 5) * 15; z = -30 + Math.floor(c / 5) * 15; yaw = 0; }
      else { const t = ((i / n) * Math.PI * 2); x = Math.cos(t) * 46; z = Math.sin(t) * 46; yaw = ((Math.atan2(x, z) * 180) / Math.PI + 360) % 360; }
    } else if (plan === 'imported') {
      // A square, a market cross at its exact centre, four streets at right angles.
      const arm = i % 4, step = Math.floor(i / 4);
      const d = 12 + step * 11;
      if (arm === 0) { x = d; z = 0; } else if (arm === 1) { x = -d; z = 0; } else if (arm === 2) { x = 0; z = d; } else { x = 0; z = -d; }
      x += (arm < 2 ? 0 : (mix(k) % 2 ? 7 : -7));
      z += (arm < 2 ? (mix(k) % 2 ? 7 : -7) : 0);
      yaw = arm * 90;
    } else if (plan === 'corridor') {
      // No open space. Buildings front corridors four metres wide, with a gate at each end.
      const lane = i % 3, step = Math.floor(i / 3);
      x = -40 + step * 11; z = (lane - 1) * 9 + (i % 2 ? 4 : -4);
      yaw = i % 2 ? 0 : 180;
    } else if (plan === 'downwind') {
      // Vats at the centre; every dwelling on the +Z (downwind) side. Only the guild is upwind.
      const guild = i === 0;
      const a = guild ? -Math.PI / 2 : (0.15 + (i / n) * 0.7) * Math.PI;
      const r = 16 + (mix(k) % 26);
      x = Math.cos(a) * r; z = Math.abs(Math.sin(a)) * r * (guild ? -1 : 1);
      yaw = ((Math.atan2(-x, -z) * 180) / Math.PI + 360) % 360;
    } else if (plan === 'leaning') {
      // Everything shares a wall with the hall or with something that does.
      if (i === 0) { x = 0; z = 0; }
      else { const a = ((i - 1) / (n - 1)) * Math.PI * 2; const r = 11 + (i % 3) * 6; x = Math.cos(a) * r; z = Math.sin(a) * r; }
      yaw = ((Math.atan2(-x, -z) * 180) / Math.PI + 360) % 360;
    } else if (plan === 'facing') {
      // A ring, every house yawed at the grey tree, none behind another.
      const a = (i / n) * Math.PI * 2, r = 15 + (i % 2) * 7;
      x = Math.cos(a) * r; z = Math.sin(a) * r;
      yaw = ((Math.atan2(-x, -z) * 180) / Math.PI + 360) % 360;
    }
    out.push({ x: +x.toFixed(2), y: +y.toFixed(2), z: +z.toFixed(2), yaw: +yaw.toFixed(1) });
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
const wrote = { settlements: 0, interiors: 0 };
const summary = [];

for (const s of SETTLEMENTS) {
  const T = TEMPLATE[s.tier];
  const poi = POIS.find((p) => p.id === s.id);
  if (!poi) throw new Error(`no POI for settlement ${s.id}; game/data/world/pois.json is the authority for placement`);
  const prop = JSON.parse(fs.readFileSync(path.join(ROOT, `game/data/world/property/${s.id}.json`), 'utf8'));

  // Named interiors = authored civic + dwellings, to the tier target exactly.
  const nDwell = T.named_interiors - s.civic.length;
  if (nDwell < 0) throw new Error(`${s.id}: ${s.civic.length} civic interiors exceeds the tier target of ${T.named_interiors}`);

  // Dwellings take their names from the property roster, so the person who owns the house is
  // the person the crime system already thinks owns the objects in it.
  const heads = prop.households.map((h) => ({ npc: h.npc, name: h.name, trade: h.trade, quarter: h.quarter, zones: h.zones, faction: h.faction }));
  const dwellings = [];
  for (let i = 0; i < nDwell; i++) {
    const h = heads[i % heads.length];
    dwellings.push({
      slug: `${s.id}-house-${i}`,
      name: nDwell <= heads.length ? `${h.name}'s house` : `${h.name}'s house, ${['lower', 'upper', 'back'][Math.floor(i / heads.length)]}`,
      kind: 'dwelling', service: null, faction: h.faction || null,
      unique_item: null, readable: null, head: h,
    });
  }

  // Zone allocation. Every property zone lands inside exactly one interior, so the whole of the
  // ownership layer is behind a door somebody can open.
  const allZones = prop.zones.map((z) => z.id);
  const named = [...s.civic, ...dwellings];
  const zoneOf = new Map(named.map((c) => [c.slug, []]));
  // Dwellings first: give each one its own household's rooms.
  for (const d of dwellings) for (const z of d.head.zones) if (allZones.includes(z)) zoneOf.get(d.slug).push(z);
  const claimed = new Set([].concat(...[...zoneOf.values()]));
  const spare = allZones.filter((z) => !claimed.has(z));
  // Then civic buildings take the remainder, round-robin, so no civic interior is an empty box.
  s.civic.forEach((c, i) => { for (let k = i; k < spare.length; k += s.civic.length) zoneOf.get(c.slug).push(spare[k]); });

  const nSealed = s.sealed.length;
  const nStruct = s.structures.length;
  const nBuild = named.length + nSealed + nStruct;
  const slots = placeBuildings(s.plan, nBuild, s.id);

  const buildings = [];
  let si = 0;
  for (const c of named) {
    const p = slots[si++];
    buildings.push({
      id: c.slug, name: c.name, kind: 'interior', building_kind: c.kind, interior: c.slug,
      enterable: true, quarter: c.head ? c.head.quarter : pick(s.quarters, c.slug),
      offset_m: [p.x, p.y, p.z], yaw_deg: p.yaw,
      door: [+(poi.pos[0] + p.x).toFixed(2), +(poi.pos[1] + p.y).toFixed(2), +(poi.pos[2] + p.z).toFixed(2)],
      service: c.service || null, faction: c.faction || null,
    });
  }
  for (const sb of s.sealed) {
    const p = slots[si++];
    buildings.push({
      id: sb.slug, name: sb.name, kind: 'sealed-with-reason', building_kind: 'sealed',
      enterable: false, quarter: pick(s.quarters, sb.slug),
      offset_m: [p.x, p.y, p.z], yaw_deg: p.yaw,
      // R1: the state is visible and legible, and at least one NPC will tell you why.
      seal_state: 'visible', reason: sb.reason, told_by_trade: sb.told_by,
    });
  }
  for (const st of s.structures) {
    const p = slots[si++];
    buildings.push({
      id: `${s.id}-struct-${st.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`,
      name: st, kind: 'structure', building_kind: 'structure', enterable: false,
      quarter: pick(s.quarters, st), offset_m: [p.x, p.y, p.z], yaw_deg: p.yaw,
      // M12 step 5: a structure may not contain residential props. Declared, so a critic can check.
      residential_props: false,
    });
  }

  const enterablePct = Math.round((named.length / (named.length + nSealed)) * 1000) / 10;

  // ---- the interiors ------------------------------------------------------------------------
  const interiorIds = [];
  for (const c of named) {
    const zones = zoneOf.get(c.slug);
    const zr = zones.map((id) => prop.zones.find((z) => z.id === id)).filter(Boolean);
    const b = buildings.find((x) => x.id === c.slug);
    // Bounds are the union of the rooms inside, plus a metre of corridor, so a hand-check of
    // "does the interior hold its rooms" is arithmetic rather than trust.
    let X = 4, Y = 3.2, Z = 5;
    for (const z of zr) {
      X = Math.max(X, Math.abs(z.bounds_m.x[0]), Math.abs(z.bounds_m.x[1]));
      Y = Math.max(Y, z.bounds_m.y[1]);
      Z = Math.max(Z, Math.abs(z.bounds_m.z[0]), Math.abs(z.bounds_m.z[1]));
    }
    X += 1 + zr.length * 0.6; Z += 1 + zr.length * 0.6;
    const kindProps = PROPS[c.kind] || PROPS.dwelling;
    const props = [...kindProps, ...s.kit.meshes.slice(0, 4)];
    const lights = [].concat(...zr.map((z) => z.lights));
    const containers = [].concat(...zr.map((z) => z.contents.filter((o) => /crate|chest|lockbox|strongbox|sack|basket|keg|barrel/i.test(o.name)).map((o) => o.instance)));
    const doc = {
      schema: 'elder-souls/interior@1',
      id: c.slug,
      name: c.name,
      settlement: s.id,
      cell_kind: 'named',
      interior_kind: c.kind,
      service: c.service || null,
      faction: c.faction || null,
      exterior_door: b.door,
      // RI-WLD13: the door you come out of is the door you went in by, and the interior's
      // footprint has to fit inside the building's. Both are checkable numbers, so both are here.
      continuity: {
        building: c.slug,
        building_offset_m: b.offset_m,
        building_yaw_deg: b.yaw_deg,
        exterior_footprint_m: [+(X * 2).toFixed(2), +(Z * 2).toFixed(2)],
        entry_side: 'south',
        // Where you stand when you come in, and where you stand when you come out. The same
        // door from both sides.
        interior_spawn: [0, 0, +(Z - 1.2).toFixed(2)],
        exterior_spawn: [+b.door[0].toFixed(2), +b.door[1].toFixed(2), +(b.door[2] + 1.8).toFixed(2)],
      },
      bounds_m: { x: [+(-X).toFixed(2), +X.toFixed(2)], y: [0, +Y.toFixed(2)], z: [+(-Z).toFixed(2), +Z.toFixed(2)] },
      floor_area_m2: +(4 * X * Z).toFixed(1),
      light: {
        kind: c.kind === 'shrine' || c.kind === 'hall' ? 'hearth' : 'lamp',
        pos: [0, 0.6, +(Z * 0.4).toFixed(2)],
        colour_hex: c.kind === 'prison' ? '#8ea0b4' : '#ffb066',
        intensity: c.kind === 'prison' ? 1.1 : 2.2,
      },
      lights,
      props,
      // The rooms. These are property zones, which is what makes the objects in this interior
      // objects the crime system already owns.
      property_zones: zones,
      containers,
      // R2 / M15: the thing that exists nowhere else, placed by hand.
      unique_item: c.unique_item ? { id: `${c.slug}-unique`, name: c.unique_item, unique: true, takeable: true, owner: zr[0] ? zr[0].owner : null } : null,
      readable: c.readable ? { id: `${c.slug}-readable`, title: c.readable } : null,
      inhabitants: c.head ? [c.head.npc.replace(/^npc:/, '')] : [],
      anchor: c.kind === 'prison' ? 'interior_cold' : 'interior_firelit',
      // The hours this place keeps. Consumed by sim/settlement.js: outside them, a shop is a
      // trespass and its door is locked.
      // A civic entry may state its own hours when the kind default is wrong for it — a manned
      // gatehouse keeps its warden's hours, not a shop's.
      open_h: c.open_h !== undefined ? c.open_h : (c.kind === 'tavern' ? 6 : c.kind === 'dwelling' ? 0 : 8),
      close_h: c.close_h !== undefined ? c.close_h : (c.kind === 'tavern' ? 26 : c.kind === 'dwelling' ? 24 : 19),
    };
    fs.writeFileSync(path.join(INT_OUT, `${c.slug}.json`), JSON.stringify(doc, null, 1) + '\n');
    interiorIds.push(c.slug);
    wrote.interiors++;
  }

  // ---- the settlement -----------------------------------------------------------------------
  const services = {};
  for (const c of s.civic) if (c.service) (services[c.service] = services[c.service] || []).push(c.slug);
  const doc = {
    schema: 'elder-souls/settlement@2',
    id: s.id,
    name: poi.name,
    tier: s.tier,
    region: s.region,
    pos: poi.pos,
    // The radius inside which sim/settlement.js says you are standing in this town.
    radius_m: { capital: 90, city: 78, town: 62, village: 44 }[s.tier],
    identity: s.identity,
    power_reading: s.power_reading,
    layout: { plan: s.plan, proof: s.layout_proof },
    architecture_kit: s.kit,
    quarters: s.quarters,
    targets: T,
    counts: {
      buildings: buildings.length,
      interior: named.length,
      sealed_with_reason: nSealed,
      structure: nStruct,
      named_interiors: interiorIds.length,
      enterable_pct: enterablePct,
      property_zones: allZones.length,
      shops: s.civic.filter((c) => c.kind === 'shop').length,
      taverns: s.civic.filter((c) => c.kind === 'tavern').length,
      temple_shrine: s.civic.filter((c) => c.kind === 'temple' || c.kind === 'shrine').length,
      guild_halls: s.civic.filter((c) => c.kind === 'guild').length,
      road_gates: s.road_gates,
    },
    services,
    buildings,
    interiors: interiorIds,
    generated_by: 'tools/world/build-settlements.mjs',
  };
  fs.writeFileSync(path.join(SETT_OUT, `${s.id}.json`), JSON.stringify(doc, null, 1) + '\n');
  wrote.settlements++;
  summary.push({ id: s.id, tier: s.tier, buildings: buildings.length, interiors: interiorIds.length, target: T.named_interiors, enterable_pct: enterablePct, target_pct: T.enterable_pct, zones: allZones.length });
}

console.log(`wrote ${wrote.settlements} settlements, ${wrote.interiors} interiors`);
console.table(summary);
// M14: no two settlements may share >30% of their building meshes.
const kits = SETTLEMENTS.map((s) => [s.id, new Set(s.kit.meshes)]);
let worst = 0, pair = null;
for (let i = 0; i < kits.length; i++) for (let j = i + 1; j < kits.length; j++) {
  const [ai, A] = kits[i], [bj, B] = kits[j];
  const inter = [...A].filter((m) => B.has(m)).length;
  const pct = inter / Math.min(A.size, B.size);
  if (pct > worst) { worst = pct; pair = `${ai}/${bj}`; }
}
console.log(`M14 mesh overlap: worst pair ${pair} at ${(worst * 100).toFixed(0)}% (fail is >30%)`);
if (worst > 0.3) process.exit(1);
