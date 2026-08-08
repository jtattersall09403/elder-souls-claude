# `GAP-W1-skill-and-attribute-scaling-never-reaches-damage` — filed, not closed

**Filed by:** W1-16 (progression: souls, levels, skills, encumbrance, gold), first dispatch,
2026-08-07. **Concerns:** `RI-PRG02` §4 (scaling grades), `RI-PRG03` §5 (the skill grade-shift —
S3's entire in-fight mechanism), and by dependency `RI-PRG02` method 4, `RI-PRG03` methods 4/7,
and both items' `CONSUMPTION` blocks. **Not fixed here** because the repair reaches into weapon
data and damage resolution that `W1-09`/`W1-10`/`W1-11` own and have calibrated at length (dozens
of critic rounds pin exact TTK, hitstop and mass numbers to the current flat `attack_rating`) —
closing this safely needs that ownership, not a unilateral edit from the progression piece.

## The root, in one sentence

`game/src/character/derive.js` implements both halves of the corpus's damage-scaling contract —
`scalingBonus(stat)` (RI-PRG02 §4's piecewise curve) and `effectiveGrade(printed, skill, req)`
(RI-PRG03 §5's skill-shifts-the-grade rule) — correctly, with the right anchors, and **neither
function is called from anywhere outside this file.** `grep -rn "effectiveGrade\b" game/src/`
returns exactly one line: its own definition.

## What actually decides damage today

`game/src/combat/moveset.js` builds each weapon's fight-facing block with
`attack_rating: cls.attack_rating` — a flat number copied straight out of
`game/data/weapons/classes.json` (e.g. the dagger's `96`). `game/src/combat/resolve.js`'s
`computeDamage(motionValue, weaponAR, hurtboxMult, targetAbsorption)` — the one function every
swing's damage goes through — multiplies that flat number by the move's motion value and the
hurtbox multiplier. **No attribute, no skill, and no weapon `grade`/`req` field appears anywhere
in that computation.** `game/data/weapons/classes.json` has no `grade` or `skill_req` field on any
of its entries at all — the schema RI-PRG02 §4 and RI-PRG03 §5 describe (a weapon prints a letter
grade per scaling stat and a skill requirement) does not exist in the shipped weapon data, so
there is nowhere for `effectiveGrade`/`scalingBonus` to read from even if something called them.

**Consequence, stated the way RI-PRG02's own "How we lose" predicts it:** "STR/AGI/INT/HIST still
resolve damage exactly as Souls scaling resolves damage" is *false* as shipped — they resolve
**nothing**. A level-1 character with VIGOUR 10 and a level-99 character with VIGOUR 99, both
holding the same dagger with Blades 5 vs Blades 100, deal *identical* damage per hit. This is not
the S1-purity axis (skill correctly never touches the *hit test* — see `game/src/character/
skilluse.js`'s header, which is honest and accurate about that half); it is the *other* half, the
one RI-PRG03's own `CONSUMPTION` §4 named as unmeasured and told the next reader to run first:
"the grade-shift axis — the only place skill is allowed to touch the fight at all... has never
been measured on any build."

## Why this was not fixed in this round

Wiring it correctly needs, at minimum:
1. A `grade` (per scaling stat) and `skill_req` field added to all 87 entries the weapon-census
   tools count in `game/data/weapons/classes.json` — content authored by whoever owns that file.
2. `weaponFor()` (moveset.js) or `computeDamage()`'s caller to fold in
   `scalingBonus(playerAttribute) * GRADE_COEFF[effectiveGrade(printed, playerSkill, req)]` on top
   of (or in place of) the flat `attack_rating`.
3. A re-run of every W1-09/W1-10/W1-11 TTK, hitstop and exemplar-trace number that assumed a flat
   AR, because this changes damage output for every weapon, at every skill/attribute level other
   than whatever baseline those pieces measured at.

That is a weapon-data and combat-calibration change, not a progression-system change, and doing
it unilaterally risked invalidating calibration this project has spent many rounds establishing
without the owning pieces present to re-verify it. Filed instead, per RULES.md #26.

## What is fixed, for contrast, so the gap is precisely scoped

The **other** half of "skill gates access" (RI-PRG03 §6, not §5) — lock tiers, fence pricing,
sneak detection radius, race-conditioned guard suspicion — was found in the same state (a live,
correctly-climbing skill register in `sim.progression.skills` that nothing downstream ever read;
`sim.stealth.p.security`/`.agility`/`.mercantile`/`.speechcraft`/`.race` were pinned at their
constructor defaults for the entire game) and **is** fixed in this round:
`StealthCrime.syncFromCharacter()`, `game/src/sim/stealth/system.js`. Magic's spell-tier gating
and the merchant/persuasion price multipliers were already wired correctly before this round (see
`game/src/sim/magic/system.js`'s `GAP-W1-magic-skill-frozen` comment and `Engine.getPriceQuote`/
`_talkPersuader`) and needed no repair.

## Repro (no browser needed)

```
grep -rn "effectiveGrade\b" game/src/          # one line: the definition
grep -rn "attack_rating" game/src/combat/moveset.js game/src/combat/resolve.js
                                                # cls.attack_rating, straight from weapon data
python3 -c "import json; d=json.load(open('game/data/weapons/classes.json'));
  print('grade' in d['classes']['DGR'], 'skill_req' in d['classes']['DGR'])"
                                                # False False — the fields don't exist to read
```
