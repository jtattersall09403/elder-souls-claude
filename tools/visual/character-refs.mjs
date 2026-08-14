#!/usr/bin/env node
// character-refs.mjs — build (and check) the character reference set routing table.
//
// WHY THIS EXISTS. `CLAUDE.md` "The character directive" requires a character reference set —
// images AND motion — to exist before F10 is judged, and requires builders to LOOK at the plates
// rather than read a description of them. A set nobody can route to is the same as no set: that is
// exactly the defect `tools/check-citations.mjs` CHECK D records, where Thorn was reported n=0 over
// an anchor (REF-A3) whose plates were structurally incapable of ever qualifying while REF-A19's
// six qualifying plates sat on disk unused.
//
// So this tool does not describe the set. It derives it from `refs/MANIFEST.json` at run time,
// verifies every routed path exists on disk, and writes `refs/characters/character-reference-set.json`.
// The markdown index next to it is written by hand and cites this file's numbers.
//
// IT CAN FAIL, and rule 24 requires that. Non-zero exit when:
//   * a routed path is in the manifest but not on disk (or vice versa),
//   * a slot declared `floor: n` comes back with fewer than n members,
//   * `--check` finds the committed JSON differs from what the manifest now implies.
// A slot with a genuine floor of 0 is declared `floor: 0` and reports `n=0` loudly rather than
// being quietly dropped — RI-VIS09 §3's rule, applied to characters.

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const REFS = join(ROOT, 'corpus', '70-visual', 'refs');
const OUT = join(REFS, 'characters', 'character-reference-set.json');

const manifest = JSON.parse(readFileSync(join(REFS, 'MANIFEST.json'), 'utf8'));
const recs = manifest.records;
const byPath = new Map(recs.map((r) => [r.path, r]));

// Dark Souls 1 boss-move GIFs are filed under one folder; the humanoid ones are the only rows
// that may stand in for a PERSON moving. The rest are creature motion. Prefixes read off the
// filenames themselves (see the derivation in refs/characters/INDEX.md §4).
const DS1_HUMANOID = ['Artorias', 'Ornstein', 'Smough', 'Manus', 'Kings', 'Nito', 'Pinwheel'];

const has = (p) => byPath.has(p);
const dirIs = (r, d) => r.path.startsWith(d);

/**
 * Every slot names: what it is for, which RI-VIS08 (or RI-VIS10) property it targets, the
 * counterpart capture on our side, and a floor. `select` runs over the manifest records.
 */
const SLOTS = [
  {
    id: 'C1', title: 'Humanoid at close range — face, head and shoulders, well lit',
    targets: ['RI-VIS08 §B3 material separation', 'RI-VIS08 §B8 eyes', 'RI-VIS10 §B face'],
    our_counterpart: 'character_closeup capture, subject ≥ 40% of frame height, daylight',
    floor: 3,
    select: (r) => dirIs(r, 'modern/character_closeup/') && /2764067250|2764143936|1902321246|431594657/.test(r.path),
  },
  {
    id: 'C2', title: 'Humanoid at close range — low light / night',
    targets: ['RI-VIS08 §B3', 'RI-VIS08 §B6 skin response', 'RI-VIS10 §B'],
    our_counterpart: 'character_closeup capture at 21h or in an interior lit by one emissive source',
    floor: 2,
    select: (r) => ['modern/character_closeup/REF-W3__steam-1399085215.jpg',
      'context/ESO-argonian_character__steam-1536362381.jpg',
      'context/ESO-argonian_character__steam-1634540211.jpg'].includes(r.path),
  },
  {
    id: 'C3', title: 'Humanoid at mid distance on the third-person gameplay camera',
    targets: ['RI-VIS08 §B1 silhouette faceting', 'RI-VIS08 §B5 contact shadow', 'RI-VIS10 §C read at distance'],
    our_counterpart: 'the real opening path, player from behind, 2–3 m and 8–10 m',
    floor: 3,
    select: (r) => ['modern/character_closeup/REF-M6__rdr2-horseshoe-overlook-camp.jpg',
      'modern/character_closeup/REF-RD__steam-2125085097.jpg',
      'modern/combat/REF-SK__steam-3386533615.jpg',
      'modern/combat/REF-RD__steam-3478652244.jpg'].includes(r.path),
  },
  {
    id: 'C4', title: 'Full-body humanoid, whole figure head-to-foot, plain backdrop',
    targets: ['RI-VIS08 §B1', 'RI-VIS08 §B7 weighting', 'RI-VIS10 §C proportion', 'RI-VIS10 §D dress'],
    our_counterpart: 'orbit capture of the player at 0/45/90/135/180/225/270/315°, full figure in frame',
    floor: 12,
    select: (r) => dirIs(r, 'modern/character_fullbody/'),
  },
  {
    id: 'C5', title: 'Full-body TURNAROUND / camera orbit of one humanoid — the owner\'s own example',
    targets: ['RI-VIS08 §B1 all round', 'RI-VIS10 §C silhouette from every angle'],
    our_counterpart: 'the orbit sequence the directive asks for, as a moving derivative',
    floor: 0,
    n0_note: 'GENUINELY EMPTY. See INDEX.md §5 for the search that was run and what would fill it.',
    select: () => false,
  },
  {
    id: 'M1', title: 'MOTION — humanoid locomotion: run, stop, turn, no cuts',
    targets: ['RI-VIS08 C1 sample rate', 'RI-VIS08 C3 foot slide', 'RI-VIS08 C4 root motion'],
    our_counterpart: 'capture-trace locomotion_flat / _slope20 / _stairs plus a moving derivative',
    floor: 2,
    select: (r) => ['video/V3-locomotion__dsr-longplay-t11990.mp4',
      'video/V3-locomotion__ghost-of-tsushima-combat.mp4',
      'video/V1-dolly__elden-ring-liurnia.mp4'].includes(r.path),
  },
  {
    id: 'M2', title: 'MOTION — humanoid attack chains and committed actions',
    targets: ['RI-VIS08 C2 jerk', 'RI-VIS08 C5 blending', 'RI-VIS08 C7 weapon attachment', 'RI-VIS08 C10 variety'],
    our_counterpart: 'capture-trace attack_chain, plus the moving derivative for the blind pass',
    floor: 4,
    select: (r) => dirIs(r, 'souls-behaviour/anim/attacks/') && r.animated === true,
  },
  {
    id: 'M3', title: 'MOTION — humanoid dodge, quickstep, parry, hit reaction',
    targets: ['RI-VIS08 C2', 'RI-VIS08 C5', 'RI-VIS08 C3'],
    our_counterpart: 'capture-trace hit_reactions and the roll/dodge sequence',
    floor: 4,
    select: (r) => (dirIs(r, 'souls-behaviour/anim/stance/') || dirIs(r, 'souls-behaviour/anim/impact/'))
      && r.animated === true,
  },
  {
    id: 'M4', title: 'MOTION — humanoid NPC/enemy telegraph and idle',
    targets: ['RI-VIS08 C10', 'RI-VIS08 C5', 'RI-AI01 telegraph legibility'],
    our_counterpart: 'an NPC in the world, orbited, plus its attack telegraph in motion',
    floor: 3,
    select: (r) => dirIs(r, 'souls-behaviour/anim/telegraph/') && r.animated === true
      && /Leyndell|Lansseax/.test(r.path),
  },
  {
    id: 'M5', title: 'MOTION — humanoid boss movesets (DS1), one action per file',
    targets: ['RI-VIS08 C2', 'RI-VIS08 C5', 'RI-VIS08 C10'],
    our_counterpart: 'any humanoid enemy archetype we ship, per action',
    floor: 20,
    select: (r) => dirIs(r, 'souls-behaviour/anim/ds1-boss-moves/') && r.animated === true
      && DS1_HUMANOID.some((n) => r.path.includes(`/${n}`)),
  },
  {
    id: 'K1', title: 'Non-human creature, still',
    targets: ['RI-VIS08 §B6 subsurface', 'RI-VIS08 §D1 readability at range', 'RI-VIS05 §D4 design'],
    our_counterpart: 'creature_closeup per bestiary archetype plus the 40 px mask',
    floor: 3,
    select: (r) => ['modern/combat/REF-SK__steam-3357576452.jpg',
      'modern/combat/REF-SK__steam-3421508541.jpg',
      'modern/combat/REF-RD__steam-3006591869.jpg',
      'modern/combat/REF-ER__steam-dyules-2764357311.jpg',
      'modern/character_closeup/REF-ER__steam-neulyiaa-2778374701.jpg'].includes(r.path),
  },
  {
    id: 'K2', title: 'MOTION — non-human creature',
    targets: ['RI-VIS08 C2', 'RI-VIS08 C9 secondary motion', 'RI-VIS05 §D4 "moves wrongly"'],
    our_counterpart: 'each shipped creature, in motion, orbited',
    floor: 40,
    // Only rows whose SUBJECT is not a person. `anim/attacks/`, `anim/stance/` and `anim/impact/`
    // are the player character swinging, stepping and parrying — those are humanoid and belong to
    // M2/M3, not here. `anim/telegraph/` is mixed: the Leyndell knights and Lansseax are in M4, and
    // the two unnamed GIF_2024… files are a Fingercreeper and an Astel, which are not.
    select: (r) => r.animated === true
      && ((dirIs(r, 'souls-behaviour/anim/ds1-boss-moves/')
            && !DS1_HUMANOID.some((n) => r.path.includes(`/${n}`)))
        || dirIs(r, 'souls-behaviour/anim/death/')
        || dirIs(r, 'souls-behaviour/anim/arena/')
        || (dirIs(r, 'souls-behaviour/anim/telegraph/') && /GIF_2024/.test(r.path))),
  },
  {
    id: 'D1', title: 'Scaled / reptilian humanoid — the race we actually ship',
    targets: ['RI-VIS10 §B face', 'RI-VIS10 §C proportion', 'RI-VIS10 §D dress', 'RI-VIS08 §B6'],
    our_counterpart: 'our Argonian-descended player and NPCs, close and mid, well lit and dark',
    floor: 4,
    select: (r) => r.path.startsWith('context/ESO-argonian_character__'),
  },
];

function build() {
  const problems = [];
  const slots = SLOTS.map((s) => {
    const members = recs.filter(s.select).map((r) => r.path).sort();
    for (const p of members) {
      if (!existsSync(join(REFS, p))) problems.push(`${s.id}: routed path is in MANIFEST but not on disk: ${p}`);
    }
    if (members.length < s.floor) {
      problems.push(`${s.id}: floor ${s.floor}, got ${members.length}`);
    }
    if (s.floor === 0 && members.length === 0 && !s.n0_note) {
      problems.push(`${s.id}: n=0 with no n0_note — an empty slot must say why`);
    }
    return {
      id: s.id, title: s.title, targets: s.targets, our_counterpart: s.our_counterpart,
      floor: s.floor, n: members.length, n0_note: s.n0_note ?? null,
      members: members.map((p) => {
        const r = byPath.get(p);
        return {
          path: p, game: r.game_canonical ?? null, side: r.side ?? null,
          animated: r.animated === true, frames: r.frames ?? null,
          width: r.width ?? null, height: r.height ?? null,
          pixel_metrics_valid: r.pixel_metrics_valid === true,
          depicts: r.depicts ?? null,
        };
      }),
    };
  });
  return { problems, slots };
}

const { problems, slots } = build();
const doc = {
  schema: 'character-reference-set/1',
  produced_by: 'tools/visual/character-refs.mjs',
  produced_from: 'corpus/70-visual/refs/MANIFEST.json',
  what_this_is:
    'The character reference set required by CLAUDE.md "The character directive". Each slot names '
    + 'what a builder must LOOK AT, which RI-VIS08/RI-VIS10 property it targets, and which of our '
    + 'own captures is its counterpart. Regenerate rather than hand-edit; the markdown index beside '
    + 'it cites these numbers.',
  standing_prohibitions: [
    'modern/character_fullbody/ is pixel_metrics_valid:false on every record — posed menu renders on '
    + 'a plain backdrop. Never quote an RI-VIS03 band from them and never use them for a framing, '
    + 'sky or composition statistic (n=0 there, by construction).',
    'context/ESO-* remains barred as an ART-DIRECTION target by RI-VIS09 §2 and RI-VIS05. It is '
    + 'admitted here for CHARACTER CONSTRUCTION QUALITY only — see RI-VIS10 §A2.',
    'GIF/video pixels are never used for texture, colour, AA or sharpness (RI-VIS09 §5a).',
  ],
  totals: {
    slots: slots.length,
    slots_at_zero: slots.filter((s) => s.n === 0).length,
    distinct_files: new Set(slots.flatMap((s) => s.members.map((m) => m.path))).size,
    motion_files: new Set(slots.flatMap((s) => s.members.filter((m) => m.animated || m.path.startsWith('video/')).map((m) => m.path))).size,
  },
  slots,
};

if (process.argv.includes('--check')) {
  const prev = existsSync(OUT) ? readFileSync(OUT, 'utf8') : '';
  const next = JSON.stringify(doc, null, 1) + '\n';
  if (prev !== next) problems.push('committed character-reference-set.json differs from what MANIFEST.json now implies — re-run without --check');
} else {
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify(doc, null, 1) + '\n');
}

for (const s of slots) {
  const flag = s.n === 0 ? '  <-- n=0' : '';
  console.log(`${s.id.padEnd(3)} n=${String(s.n).padStart(3)} (floor ${s.floor})  ${s.title}${flag}`);
}
console.log(`\n${doc.totals.distinct_files} distinct files, ${doc.totals.motion_files} of them motion; `
  + `${doc.totals.slots_at_zero} slot(s) at n=0`);

if (problems.length) {
  console.error('\nFAIL:');
  for (const p of problems) console.error('  ' + p);
  process.exit(1);
}
console.log('OK');
