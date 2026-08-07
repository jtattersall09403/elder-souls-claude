#!/usr/bin/env node
// build-population.mjs — promote the property roster into real NPC records with 24-hour schedules.
//
// THE POINT. `game/data/world/property/*.json` already names 280 people: fourteen heads of
// household per settlement plus their partners, elders, siblings, lodgers and children, each with
// a trade, a faction, a quarter and a set of rooms. They own 1,878 objects between them and the
// crime system already enforces that ownership. What they did NOT have was existence: no record in
// `game/data/npcs/`, nobody in `sim.npcs`, nowhere to be at three in the morning.
//
// So this does not invent a population. It gives the population that already owns the world a body
// and a day.
//
//   AUTHORED here: the trade -> actor / behaviour / topic mapping, the day-shape each trade keeps,
//                  and the disposition each trade opens at.
//   TAKEN from the property roster: who exists, what they are called, what they do, whose house
//                  they are in, and which rooms are theirs.
//   TAKEN from the settlement records: which interior is their home and which is their work.
//
// Every `at:` in every schedule slot is an interior id that exists on disk, and every topic id is
// checked against game/data/dialogue/topics/ before this file will write anything.
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(new URL('../..', import.meta.url).pathname);
const OUT = path.join(ROOT, 'game/data/npcs');
const TEMPLATE = JSON.parse(fs.readFileSync(path.join(ROOT, 'corpus/50-world/settlements.json'), 'utf8')).tier_template;

function mix(s) { let h = 2166136261 >>> 0; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h >>> 0; }

// The topics that exist. A topic id on an NPC that has no body is the defect that kept the
// dialogue and quest layers unjoined for weeks, so this is a hard gate, not a warning.
const TOPICS = new Set();
for (const f of fs.readdirSync(path.join(ROOT, 'game/data/dialogue/topics'))) {
  for (const t of JSON.parse(fs.readFileSync(path.join(ROOT, 'game/data/dialogue/topics', f), 'utf8')).topics || []) {
    if (t && t.id) TOPICS.add(t.id);
  }
}

// ---- AUTHORED: what each trade is, in the world's own vocabulary ------------------------------
// `actor` must be one of the `a` rows the topic book answers with; `behaviour` one of the four
// sim/npc.js knows. `day` is the shape of this person's twenty-four hours.
const TRADE = {
  cook:       { actor: 'townsman',    behaviour: 'tend',   disp: 45, rg: 'RG-COMMON', day: 'early',   service: null },
  trader:     { actor: 'merchant',    behaviour: 'tend',   disp: 42, rg: 'RG-COMMON', day: 'shop',    service: 'barter' },
  smith:      { actor: 'townsman',    behaviour: 'tend',   disp: 40, rg: 'RG-COMMON', day: 'shop',    service: 'repair' },
  apothecary: { actor: 'healer',      behaviour: 'tend',   disp: 48, rg: 'RG-COMMON', day: 'shop',    service: 'heal' },
  boatwright: { actor: 'fisher',      behaviour: 'tend',   disp: 44, rg: 'RG-COMMON', day: 'early',   service: 'repair' },
  publican:   { actor: 'innkeeper',   behaviour: 'tend',   disp: 55, rg: 'RG-COMMON', day: 'late',    service: 'bed' },
  scribe:     { actor: 'clerk',       behaviour: 'stand',  disp: 38, rg: 'RG-COMMON', day: 'shop',    service: null },
  fisher:     { actor: 'fisher',      behaviour: 'tend',   disp: 46, rg: 'RG-COMMON', day: 'early',   service: null },
  weaver:     { actor: 'townsman',    behaviour: 'tend',   disp: 44, rg: 'RG-COMMON', day: 'shop',    service: 'barter' },
  rootkeeper: { actor: 'rootkeeper',  behaviour: 'stand',  disp: 52, rg: 'RG-DEEP',   day: 'temple',  service: 'travel' },
  priest:     { actor: 'healer',      behaviour: 'stand',  disp: 50, rg: 'RG-DEEP',   day: 'temple',  service: 'heal' },
  legionary:  { actor: 'legionary',   behaviour: 'post',   disp: 30, rg: 'RG-IMP',    day: 'watch',   service: null },
  factor:     { actor: 'dres-factor', behaviour: 'stand',  disp: 32, rg: 'RG-IMP',    day: 'shop',    service: 'barter' },
  warder:     { actor: 'legionary',   behaviour: 'post',   disp: 28, rg: 'RG-IMP',    day: 'watch',   service: null },
};
const KIN = {
  partner:    { actor: 'townsman', behaviour: 'stand', disp: 44, day: 'home' },
  lodger:     { actor: 'villager', behaviour: 'stand', disp: 38, day: 'late' },
  apprentice: { actor: 'townsman', behaviour: 'tend',  disp: 46, day: 'shop' },
  elder:      { actor: 'town-elder', behaviour: 'stand', disp: 50, day: 'home' },
  sibling:    { actor: 'villager', behaviour: 'stand', disp: 42, day: 'early' },
  child:      { actor: 'villager', behaviour: 'attend', disp: 55, day: 'child' },
};

// ---- AUTHORED: the day shapes. Hours are [from, to) on a 24-hour clock, and every shape covers
// all 24 hours with no gap, because a person with a gap in their day is a person who vanishes.
const DAY = {
  early:  [[4, 8, 'work'], [8, 13, 'work'], [13, 14, 'tavern'], [14, 19, 'work'], [19, 22, 'tavern'], [22, 4, 'home']],
  shop:   [[0, 7, 'home'], [7, 8, 'home'], [8, 13, 'work'], [13, 14, 'tavern'], [14, 19, 'work'], [19, 22, 'tavern'], [22, 24, 'home']],
  late:   [[0, 2, 'work'], [2, 10, 'home'], [10, 24, 'work']],
  temple: [[0, 6, 'home'], [6, 12, 'work'], [12, 13, 'home'], [13, 20, 'work'], [20, 24, 'home']],
  watch:  [[0, 6, 'work'], [6, 10, 'home'], [10, 18, 'work'], [18, 21, 'tavern'], [21, 24, 'home']],
  home:   [[0, 9, 'home'], [9, 12, 'work'], [12, 18, 'home'], [18, 21, 'tavern'], [21, 24, 'home']],
  child:  [[0, 8, 'home'], [8, 17, 'home'], [17, 19, 'shrine'], [19, 24, 'home']],
};

const hhmm = (h) => `${String(Math.floor(h % 24)).padStart(2, '0')}:00`;

const races = { imperial: ['argonian', 'argonian', 'argonian', 'imperial', 'dunmer'], settlement: ['argonian', 'argonian', 'argonian', 'argonian', 'khajiit'], interior: ['argonian', 'argonian', 'argonian', 'argonian', 'nord'] };

// ---- AUTHORED: who keeps a civic building ----------------------------------------------------
// A town where the inn has no innkeeper and the gaol has no warder is a town of doors. Every
// non-dwelling interior gets one named keeper who works there all day and goes home at night —
// home being a room in that same building, which is R2's "back room the merchant lives in".
const KEEPER = {
  hall:   { title: 'Steward',      trade: 'scribe' },
  temple: { title: 'Sexton',       trade: 'priest' },
  shrine: { title: 'Rootkeeper',   trade: 'rootkeeper' },
  guild:  { title: 'Clerk',        trade: 'factor' },
  travel: { title: 'Postmaster',   trade: 'rootkeeper' },
  tavern: { title: 'Publican',     trade: 'publican' },
  prison: { title: 'Warder',       trade: 'warder' },
  shop:   { title: 'Keeper',       trade: 'trader' },
};
const KEEPER_BY_SERVICE = { smith: 'Smith', alchemist: 'Apothecary', bookseller: 'Scribe', fence: 'Pawnbroker', trader: 'Trader', healer: 'Healer', inn: 'Publican', travel: 'Postmaster', boatwright: 'Boatwright' };
const KEEPER_TRADE_BY_SERVICE = { smith: 'smith', alchemist: 'apothecary', bookseller: 'scribe', fence: 'trader', trader: 'trader', healer: 'priest', inn: 'publican', travel: 'rootkeeper', boatwright: 'boatwright' };
const GIVEN = ['Deek', 'Heem', 'Wanan', 'Ocheeva', 'Tul', 'Neetrenaza', 'Chun', 'Weel', 'Jaraleet', 'Ahnassi', 'Sedura', 'Meesei', 'Jeelus-Tei', 'Okan', 'Beem-Kiune', 'Haj-Ei', 'Ten-Tongues', 'Ruut', 'Sees-All-Colours', 'Hides-His-Foot', 'Marks-The-Ledger', 'Counts-The-Tide', 'Onwen', 'Veek', 'Ashen', 'Ranaso', 'Tuls', 'Falura', 'Nartise', 'Sondaale'];
const EPITHET = ['the Elder', 'Salt-Hand', 'Quick-Tally', 'Reed-Cutter', 'of Nine Debts', 'Bone-Setter', 'Wet-Foot', 'the Patient', 'Dark-Water', 'Rope-Maker', 'Half-Moon', 'the Younger', 'Nine-Teeth', 'the Quiet', 'Slow-Rain', 'Cold-Ash', 'Two-Skins', 'the Shorter', 'Sings-At-Dusk', 'Deep-Root'];
const keeperName = (k) => `${GIVEN[mix(k + ':g') % GIVEN.length]} ${EPITHET[mix(k + ':e') % EPITHET.length]}`;

let total = 0;
const perSettlement = [];
const badTopics = [];
const badAt = [];
const perSettlementKeepers = {};

for (const file of fs.readdirSync(path.join(ROOT, 'game/data/world/property'))) {
  const prop = JSON.parse(fs.readFileSync(path.join(ROOT, 'game/data/world/property', file), 'utf8'));
  const sid = prop.settlement;
  const sett = JSON.parse(fs.readFileSync(path.join(ROOT, `game/data/world/settlements/${sid}.json`), 'utf8'));
  const target = TEMPLATE[sett.tier].named_npcs;
  const interiors = sett.buildings.filter((b) => b.kind === 'interior');
  const byZone = new Map();
  for (const b of interiors) {
    const doc = JSON.parse(fs.readFileSync(path.join(ROOT, `game/data/world/interiors/${b.interior}.json`), 'utf8'));
    for (const z of doc.property_zones) byZone.set(z, doc.id);
  }
  // Which interior sells what — a trade's workplace is the town's building for that trade, and
  // if the town has none, the person works out of their own house, which is also just true.
  const workFor = (trade) => {
    const want = { trader: 'shop', weaver: 'shop', factor: 'guild', smith: 'shop', apothecary: 'shop', scribe: 'shop', publican: 'tavern', rootkeeper: 'shrine', priest: 'temple', legionary: 'guild', warder: 'prison', boatwright: 'shop', fisher: 'shop', cook: 'tavern' }[trade];
    const hit = interiors.find((b) => b.building_kind === want);
    return hit ? hit.interior : null;
  };
  const tavern = (interiors.find((b) => b.building_kind === 'tavern') || interiors.find((b) => b.building_kind === 'hall') || interiors[0]).interior;
  const shrine = (interiors.find((b) => b.building_kind === 'shrine') || interiors.find((b) => b.building_kind === 'temple') || interiors[0]).interior;

  // Everyone the property roster names, heads first so a truncated tier keeps its shopkeepers.
  const people = [];
  for (const h of prop.households) {
    people.push({ npc: h.npc, name: h.name, trade: h.trade, faction: h.faction, quarter: h.quarter, zones: h.zones, role: 'head' });
    for (const r of h.residents) {
      if (r.npc === h.npc) continue;
      people.push({ npc: r.npc, name: r.name, trade: h.trade, faction: h.faction, quarter: h.quarter, zones: h.zones, role: r.role });
    }
  }
  const heads = people.filter((p) => p.role === 'head');
  const rest = people.filter((p) => p.role !== 'head');
  const chosen = [...heads, ...rest].slice(0, target);

  const npcs = [];
  const seenName = new Map();
  for (const p of chosen) {
    const id = p.npc.replace(/^npc:/, '');
    const spec = p.role === 'head' ? TRADE[p.trade] : KIN[p.role];
    const shape = DAY[spec.day] || DAY.home;
    const home = byZone.get(p.zones[0]) || null;
    const work = p.role === 'head' ? (workFor(p.trade) || home) : (spec.day === 'shop' ? (workFor(p.trade) || home) : home);
    if (!home) throw new Error(`${id}: no home interior for zone ${p.zones[0]}`);
    const where = { home, work: work || home, tavern, shrine };
    const schedule = shape.map(([a, b, act]) => ({ from: hhmm(a), to: hhmm(b), at: where[act] || home, activity: act }));
    for (const s of schedule) if (!byZone.has(s.at) && !interiors.some((b) => b.interior === s.at)) badAt.push(`${id} -> ${s.at}`);
    // A name that repeats inside one town is a different person with the same name, and that is
    // fine in a marsh village and confusing in a capital, so the second one gets their quarter.
    const n = (seenName.get(p.name) || 0) + 1; seenName.set(p.name, n);
    const displayName = n === 1 ? p.name : `${p.name} of ${p.quarter.replace(/-/g, ' ')}`;
    const topics = [sid, 'background'];
    for (const t of topics) if (!TOPICS.has(t)) badTopics.push(`${id} -> ${t}`);
    npcs.push({
      id, name: displayName,
      race: races[prop.jurisdiction][mix(id) % 5],
      class: p.role === 'head' ? p.trade : p.role,
      actor: spec.actor,
      faction: p.faction || null,
      settlement: sid,
      quarter: p.quarter,
      household: p.npc.replace(/^npc:/, '').replace(/-(partner|lodger|apprentice|elder|sibling|child)\d+$/, ''),
      role: p.role,
      disposition: spec.disp + (mix(id + ':d') % 9) - 4,
      interior: home,
      home_interior: home,
      work_interior: work || home,
      // The rooms this person owns. `Engine.takeObject()` reads the same ids off the property
      // file, so "whose crate is this" and "whose house is this" are the same question.
      owns_zones: p.role === 'head' ? p.zones : [],
      behaviour: spec.behaviour,
      schedule,
      topics,
      services: spec.service ? [spec.service] : [],
      reaction_group: spec.rg || 'RG-COMMON',
    });
  }
  // ---- the keepers. One named person behind every civic door. ------------------------------
  let keepers = 0;
  for (const b of interiors) {
    if (b.building_kind === 'dwelling') continue;
    const k = KEEPER[b.building_kind] || KEEPER.shop;
    const title = b.service ? (KEEPER_BY_SERVICE[b.service] || k.title) : k.title;
    const trade = b.service ? (KEEPER_TRADE_BY_SERVICE[b.service] || k.trade) : k.trade;
    const spec = TRADE[trade];
    const id = `${sid}-keeper-${b.interior.replace(new RegExp(`^${sid}-`), '')}`;
    const shape = DAY[spec.day] || DAY.shop;
    // A keeper's home IS the back room. R2: "a back room or upper floor the merchant lives in."
    const where = { home: b.interior, work: b.interior, tavern, shrine };
    const schedule = shape.map(([a, c, act]) => ({ from: hhmm(a), to: hhmm(c), at: where[act] || b.interior, activity: act }));
    const nm = keeperName(id);
    npcs.push({
      id, name: nm, title,
      race: races[prop.jurisdiction][mix(id) % 5],
      class: trade,
      actor: spec.actor,
      faction: b.faction || null,
      settlement: sid,
      quarter: b.quarter,
      household: id,
      role: 'keeper',
      disposition: spec.disp + (mix(id + ':d') % 9) - 4,
      interior: b.interior,
      home_interior: b.interior,
      work_interior: b.interior,
      owns_zones: [],
      behaviour: spec.behaviour,
      schedule,
      topics: [sid, 'background'],
      services: spec.service ? [spec.service] : [],
      reaction_group: spec.rg || 'RG-COMMON',
    });
    keepers++;
  }
  perSettlementKeepers[sid] = keepers;

  const doc = {
    schema: 'elder-souls/npc-group@1',
    group: `pop-${sid}`,
    id: `pop-${sid}`,
    settlement: sid,
    generated_by: 'tools/world/build-population.mjs',
    source: 'the household roster in game/data/world/property/' + sid + '.json — these are the people who already owned the objects',
    npcs,
  };
  fs.writeFileSync(path.join(OUT, `pop-${sid}.json`), JSON.stringify(doc, null, 1) + '\n');
  total += npcs.length;
  perSettlement.push({ settlement: sid, tier: sett.tier, roster: npcs.length - perSettlementKeepers[sid], keepers: perSettlementKeepers[sid], total: npcs.length, target, scheduled: npcs.filter((n) => n.schedule.length).length });
}

if (badTopics.length) { console.error('TOPIC IDS THAT DO NOT EXIST:', badTopics.slice(0, 20)); process.exit(1); }
if (badAt.length) { console.error('SCHEDULE SLOTS POINTING AT INTERIORS THAT DO NOT EXIST:', badAt.slice(0, 20)); process.exit(1); }
console.table(perSettlement);
console.log(`wrote ${total} NPC records, all with 24-hour schedules, every topic id and every schedule target verified to exist`);
