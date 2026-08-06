# AMENDMENT-W1-10-01 — `moveset.schema.json` cannot encode the tables it exists to encode

**Filed by:** wave-1 builder `W1-10` (weapon movesets).
**Target:** `corpus/12-weapons/moveset.schema.json` (`elder-souls/moveset@1`).
**Kind:** six bound/enum corrections to the *encoding*. **No threshold, no frame value, no
metric and no design decision anywhere in RI-WPN01–06 is changed.** Every correction makes the
schema able to express a number the reference items already publish, and nothing else.
**Status:** applied in-place with inline `AMENDED wave 1 (W1-10)` notes; each edit is listed
below with the published cell that proves it necessary.

## Why this is one amendment and not six

All six defects have a single cause. `moveset.schema.json` is the normative encoding of
RI-WPN01 §A's slot vocabulary, HARNESS.md §4's button set, RI-WPN04 §A's derived frame table and
RI-WPN05 §A's hitstop grid. It was authored beside those tables and then **was not rebased when
seam S22 doubled every frame figure in the area**, and its enums were transcribed from prose
rather than from the tables. RI-WPN01's own provenance note says the quiet part out loud:

> **AMENDED wave 0 (rebase-s22).** Every frame value this item points at was doubled under seam
> S22. This item states no frame values of its own, so nothing here needed rebasing…

The item states no frame values. **Its schema does** — four numeric bounds — and nobody rebased
them. The result is that a moveset authored *correctly* against RI-WPN04 §A fails schema
validation, which is the first line of the weapon critic's mandatory preflight
(`WEAPON-CRITIC.md` §3.1). Measured: **3 of 87** weapon files validate before this amendment;
**87 of 87** after it.

---

## D1 — `active_f` maximum 16 forbids five classes' jumping attack

RI-WPN04 §A's rebased table publishes `jump.r1` active frames per class:

| Class | HLB | GSW | CGS | GHM | UGS |
|---|---|---|---|---|---|
| `jump.r1` active | **18** | **20** | **23** | **20** | **25** |

Every one exceeds the schema's `"active_f": {"maximum": 16}`. The values are not disputable —
they are `round-half-up(class R1 active × 1.25)` from the ×1.25 jump multiplier that RI-CMB02
§C owns and RI-WPN04 §A prints in full. 16 is exactly the pre-S22 bound (`2..16` ← `1..8`).

**Correction:** `active_f` maximum `16` → **`32`** (the pre-rebase 8 × 2 × 2, i.e. the doubled
16). Minimum unchanged at 2.

## D2 — `recovery_f` maximum 90 forbids two classes' jumping attack

RI-WPN04 §A: GHM `jump.r1` = `68 / 20 / 96`, UGS `jump.r1` = `75 / 25 / 106`. Both recoveries
exceed `"recovery_f": {"maximum": 90}`. 90 is the pre-S22 bound doubled *once* from 45 and never
re-checked against the ×1.20 jump-recovery multiplier.

**Correction:** `recovery_f` maximum `90` → **`180`**.

## D3 — `startup_f` maximum 90 forbids GHM and UGS heavy attacks

RI-WPN02 §B, reproducing RI-CMB02 §B's rebased rows: GHM R2 startup **96**, UGS R2 startup
**104**. Both exceed `"startup_f": {"maximum": 90}`.

**Correction:** `startup_f` maximum `90` → **`180`**; minimum `4` → **`6`**, which is RI-CMB02
§E's absolute startup floor and is *not* rebased (RI-WPN04 §A's boxed note: it is a human
reaction-time bar). A minimum of 4 permitted exactly the 4-frame dagger rolling attack that
RI-WPN04 "How we lose" §10 names as a failure.

## D4 — `charge_max_f` maximum 60 forbids the bow

RI-WPN02 §C: *"`bow.aimed` draws for up to **90 f@60**"*. RI-WPN01 §C.5 gives the same slot
`charge_max_f = 45` in pre-rebase frames, which is 90 after S22. The schema's `0..60` is
RI-WPN01 §C.3's melee range (`1–60 f@60`) applied to every slot including the one the corpus
explicitly gives 90.

**Correction:** `charge_max_f` maximum `60` → **`90`**, with the melee `1–60` constraint left
where it belongs — in RI-WPN01 §C.3's prose, checked by the critic, not by the encoding.

## D5 — `trigger.button` lists 8 of HARNESS.md §4's 14 buttons, and omits the one RI-WPN06 requires

The schema says, in its own description: *"Buttons are the closed set from HARNESS.md §4."*
HARNESS.md §4's closed set is fourteen names:

```
light  heavy  roll  block  parry  sprint  jump
use_item  interact  lock_on  two_hand  swap_right  swap_left  menu
```

The enum carries eight: `light heavy parry block use_item interact jump two_hand`. The six
missing are `roll sprint lock_on swap_right swap_left menu`. This is not cosmetic:
RI-WPN06 §C makes offhand configuration **O2 mandatory** and specifies its slots as
*"`off.r1.1`, `off.r1.2`, `off.r2` on the `light`-with-`swap_left`-held input"*, and RI-WPN06 M7
scores the dual-wield chain. **The schema forbids the trigger the item mandates.**

**Correction:** `trigger.button` enum → all fourteen names from HARNESS.md §4, verbatim and in
its order. The schema now means what its own description says.

## D6 — the `slotId` enum omits `r1.5`, which RI-WPN01 §A slot 4 points at

RI-WPN01 §A, row 4: *"`r1.4` | `light` buffered in `r1.3` recovery | → **`r1.5`** or null"*. And
RI-WPN02 §B gives FST `Max chain` = **5**, with §C confirming *"FST … 5-chain"*. A five-hit
chain needs a fifth slot id. The enum stops at `r1.4`.

**Correction:** add `r1.5` (and, for symmetry with the two-handed mirror rule, `2h.r1.5`) to
`$defs.slotId.enum`.

## D7 — `hitstop_f` omits `wood`, which RI-WPN05 §A's grid publishes

RI-WPN05 §A's attacker-hitstop grid has seven material columns: `flesh chitin stone metal shield
**wood** water`. The schema's `hitstop_f` object declares six of them and sets
`additionalProperties: false`, so a weapon that overrides its wood row is invalid.

**Correction:** add `"wood": {"type": "integer"}` to `hitstop_f.properties`.

---

## D8 — `slots.minProperties: 25` makes BOW impossible, and RI-WPN01 says so

RI-WPN01 §A, in the paragraph immediately under the mandatory-25 block:

> BOW substitutes `bow.draw bow.quick bow.aimed bow.roll` for the 14 one-handed melee slots and
> has no two-handed stance, **giving it a mandatory count of 7**… **BOW is the one class
> permitted a reduced table**, and the reason is stated in RI-WPN02 §A.

`minProperties: 25` denies the permission the same item grants in prose. There are only three
ways out and two are worse: cut the bow (re-opens BAR-CRITIQUE-01 rank 9 and hard-fails
RI-WPN01 M5 on A5 RANGED, which has no other answer), or pad the bow to 25 slots (seventeen
invented slots — the exact "slot that exists and is a lie" that RI-WPN04's `CFS` is built to
catch, committed deliberately to satisfy a bound).

**Correction:** replace the unconditional `minProperties: 25` with the conditional the prose
already states:

```jsonc
"slots": { … },                       // minProperties removed from here
"allOf": [
  { "if":   { "properties": { "class": { "const": "BOW" } } },
    "then": { "properties": { "slots": { "minProperties": 7 } } },
    "else": { "properties": { "slots": { "minProperties": 25 } } } }
]
```

This is strictly stronger than the original for the fourteen melee classes and exactly as
strong as RI-WPN01 §A for BOW.

---

## What this amendment deliberately does NOT do

It does not touch `motion_value` (max 4.0), `stamina` (max 90), `poise_damage` (max 140),
`arc_sweep_deg` (max 360) or `reach_m` (max 6.0). W1-10's first generated roster exceeded three
of those on two-handed weapon-art slots — and in every one of those cases the offending number
was **this builder's own multiplier choice**, not a published corpus cell. Those were clamped in
`tools/weapons/build-movesets.mjs` instead. The line the amendment holds is: *amend the encoding
only where a number the corpus itself publishes cannot be written down.*

## Verification

```
node tools/weapons/validate-schema.mjs corpus/12-weapons/moveset.schema.json game/data/combat/movesets
```

Before: `3/87 files validate` — 147 × `swap_left` not in enum, 66 × `wood` not allowed,
66 × maximum bound, 5 × `7 properties < minProperties 25`, 4 × `r1.5` not in enum.
After: `87/87 files validate`.

Every affected numeric bound is a doubling or a direct transcription of a published cell, and
each is annotated inline in the schema with the item and section that fixes it.
