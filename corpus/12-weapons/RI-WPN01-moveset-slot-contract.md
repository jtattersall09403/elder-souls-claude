---
id: RI-WPN01
title: The moveset slot contract — every attack a weapon must own, and the schema it serialises to
kind: structure
side: souls
judges: [weapon.moveset.slots, weapon.moveset.schema, weapon.charge.heavy, weapon.moveset.answers, combat.attack.charge, combat.attack.moveset]
provenance: constructed
confidence: high
blind_pair: yes
---

## The bar

In a Souls game a weapon is not a damage number attached to a mesh. It is a **grammar** — a
closed set of sentences the player can say with it, each one a committed animation with its
own frames, its own cost and its own tactical job. Pressing light while standing still,
while sprinting, while rolling, while backstepping, while airborne, while holding the
button, and immediately after a successful block are **seven different attacks**, not one
attack in seven contexts. That is the thing the player is actually learning for forty hours,
and it is the single property that most reliably separates a Souls game from a game with a
sword in it.

"Good" means: every weapon in the game declares a **complete slot table** in data; every
mandatory slot resolves to a distinct animation clip with its own frame data; no slot is
silently aliased to another; the slot table in `game/data/combat/movesets/**` and the slot
behaviour observed in a harness trace are two independent sources that **agree**; and the
union of slots across the player's kit contains at least one credible answer to every enemy
archetype in RI-AI05. A weapon that implements light-attack, heavy-attack and nothing else
is not a weapon at this bar — it is a placeholder, and it scores as one.

This item owns the **slot vocabulary and the data contract**. It does not own frame values:
RI-CMB02 is authoritative on the seven spine classes it publishes, RI-WPN02 §A extends that
table to fifteen, RI-WPN04 owns the contextual-slot windows, RI-WPN05 owns impact, RI-WPN06
owns two-handing and the offhand, and RI-CMB05 owns criticals. Cite them; do not restate
them.

## The reference artifact

### A. `ES-SLOTS/1` — the slot vocabulary

Forty-one legal slot ids. Twenty-five are **mandatory on every melee weapon**; the rest are
conditional or class-gated. The schema file `corpus/12-weapons/moveset.schema.json`
(`elder-souls/moveset@1`) is the normative encoding of this table and is the artifact a
static analyser validates against.

| # | Slot id | Trigger (HARNESS.md §4 button + modifier + state window) | Chains? | M/O | Notes |
|---|---|---|---|---|---|
| 1 | `r1.1` | `light`, `IDLE` | → `r1.2` | **M** | Chain root. RI-CMB02 §A owns its frames for the seven spine classes. |
| 2 | `r1.2` | `light` buffered in `r1.1` recovery | → `r1.3` | **M** | RI-CMB02 §C: startup ×0.78, recovery ×1.05, MV ×0.95. |
| 3 | `r1.3` | `light` buffered in `r1.2` recovery | → `r1.4` or null | **M** | Terminal for 11 of 15 classes. RI-CMB02 §C: recovery ×1.35. |
| 4 | `r1.4` | `light` buffered in `r1.3` recovery | → `r1.5` or null | O | Legal only for DGR, FST, CSW, TSW (see RI-WPN02 §B chain-length column). |
| 5 | `r2` | `heavy`, `IDLE`, tap | → `r2.follow` | **M** | RI-CMB02 §B. |
| 6 | `r2.charged` | `heavy`, `IDLE`, **hold** | null | **M** | `charge_max_f` 1–30. **This slot is what closes the `combat.attack.charge` hole.** |
| 7 | `r2.follow` | `heavy` buffered in any `r1.*` recovery | null | O | The mixed finisher. Where a class has one, it must not be a copy of `r2`. |
| 8 | `run.r1` | `light`, `SPRINT` | null | **M** | RI-WPN04 §B. |
| 9 | `run.r2` | `heavy`, `SPRINT` | null | **M** | RI-WPN04 §B. |
| 10 | `roll.r1` | `light`, `ROLL` f16–f26 (LIGHT tier, RI-CMB01 §B) | → `r1.2` | **M** | RI-WPN04 §B owns the per-tier window. |
| 11 | `roll.r2` | `heavy`, `ROLL` f16–f26 | null | O | Only classes with `arc_sweep_deg ≥ 120`. |
| 12 | `backstep.r1` | `light`, `BACKSTEP` f7–f17 (RI-CMB01 §B) | → `r1.2` | **M** | The lowest-profile slot in the game and the one most likely to be faked. |
| 13 | `jump.r1` | `light`, `AIRBORNE` + `descending` | null | **M** | RI-CMB02 §C: startup ×1.30, poise dmg ×1.80. |
| 14 | `jump.r2` | `heavy`, `AIRBORNE` + `descending` | null | O | |
| 15 | `plunge` | `light`\|`heavy`, `AIRBORNE`, fall height ≥ 3.0 m, target below | null | **M** | Shared between stances; one clip per weapon is sufficient. |
| 16 | `guard.counter` | `light` within **40 f@60** ~~20 f~~ of `BLOCK_SUCCESS` | null | **M** | The shield's offensive verb. Answers TURTLE. RI-WPN06 §C. ⚠ `RI-CMB02` §C says 24 f@60 — pre-existing collision, rebased on both sides, flagged not resolved (`REBASE-S22-REPORT.md` §7). |
| 17 | `guardbreak` | `light` + `forward` modifier, `IDLE` | null | **M** | Kick / shield-bash / thrust-through / shoulder. **The TURTLE answer RI-AI05 §7 demands ship in the kit.** |
| 18 | `art.1` | `heavy` + `two_hand` held (see §D on the input) | null | **M** | Weapon art / skill. One per weapon minimum. |
| 19 | `art.2` | as `art.1`, second charge | null | O | |
| 20 | `parry` | `parry` button, offhand parry tool equipped | → riposte | class-gated | RI-CMB05 owns the window; RI-WPN06 §D owns which classes qualify. |
| 21–35 | `2h.*` | the two-handed mirror of slots 1–3, 5, 6, 8–13, 16, 18 | as 1h | **M** (11 of them) | RI-WPN06 §B: ≥60% must genuinely diverge, and ≥2 must be 2h-exclusive. |
| 36–39 | `bow.draw`, `bow.quick`, `bow.aimed`, `bow.roll` | BOW class only | — | class-gated | Replaces slots 1–14 for BOW. Answers RANGED. |
| 40 | `crit.riposte` | automatic on parry success | — | **owned by RI-CMB05** | Listed for completeness; not counted in the 25. |
| 41 | `crit.backstab` | automatic from behind, `IDLE` | — | **owned by RI-CMB05** | Listed for completeness; not counted in the 25. |

**The mandatory 25**, enumerated so a counter can be written against it:

```
r1.1 r1.2 r1.3 r2 r2.charged run.r1 run.r2 roll.r1 backstep.r1 jump.r1
plunge guard.counter guardbreak art.1                                  (14 one-handed + shared)
2h.r1.1 2h.r1.2 2h.r1.3 2h.r2 2h.r2.charged 2h.run.r1 2h.run.r2
2h.roll.r1 2h.backstep.r1 2h.jump.r1 2h.guard.counter                  (11 two-handed)
                                                                       = 25
```

BOW substitutes `bow.draw bow.quick bow.aimed bow.roll` for the 14 one-handed melee slots
and has no two-handed stance, giving it a mandatory count of **7** (`bow.*` ×4, `plunge`,
`guardbreak` = `none` is legal for BOW only, `art.1`). BOW is the one class permitted a
reduced table, and the reason is stated in RI-WPN02 §A.

### B. Per-slot required fields

Every slot object MUST carry, at minimum:

| Field | Type | Why it is mandatory |
|---|---|---|
| `anim` | `clip_<name>` | The clip id. **The load-bearing field of the whole weapons area** — RI-WPN03's every number is a function of the multiset of clip ids, and RI-WPN04's fallback detector is an equality test on it. |
| `anim_owner` | weapon_id | Who owns the clip. `anim_owner == weapon_id` ⇒ this clip is unique to this weapon. |
| `trigger` | `{button, modifier, state_window}` | Buttons drawn from HARNESS.md §4's closed set only. |
| `chains_to` | slot id \| null | Explicit chain graph. A chain that is implicit in code is unmeasurable. |
| `startup_f`, `active_f`, `recovery_f` | int | The frame contract, **`f@60`**. Tolerance ±0 f against the reference tables. **AMENDED wave 0 (rebase-s22): those tables (`RI-CMB02` §A/§B, `RI-WPN02` §B, `RI-WPN04` §A) are all rebased under seam S22; a moveset authored against the pre-rebase numbers is now wrong by a factor of two. Every frame field in a `moveset.json` must be read as 60 Hz — a bare frame count with no framerate is a defect (S22).** |
| `charge_max_f` | int | Non-zero only on `r2.charged`, `2h.r2.charged`, `bow.aimed`. |
| `stamina` | number | RI-CMB03 owns the economy; this is the per-slot draw. |
| `motion_value` | number | RI-CMB02/RI-WPN02 own the values. |
| `poise_damage` | number | RI-CMB05 owns the model. |
| `root_dz_m` | number | Root-motion displacement. RI-CMB02 §D.3: the controller consumes the root track and adds nothing. |
| `arc_sweep_deg` | number | Angular travel of the hitbox across the active window. The best single differentiator after startup, and unfakeable without a real hitbox. |
| `shape` | enum | `slash_h slash_d slash_v thrust sweep smash spin lash shoot grab`. |
| `hyperarmour` | `{enabled, from_f, to_f, poise_multiplier}` | RI-CMB05 owns semantics; RI-CMB02's derivation `[ceil(0.60×startup), startup+active]` owns the window. |
| `hitbox` | `{kind, radius_m, bone_a, bone_b, multi_hit}` | RI-CMB04 owns the swept-volume test. |
| `answers` | archetype[] | Feeds §E. |

### C. The charge contract (`combat.attack.charge`, the hole this item closes)

A charged heavy is **not** an R2 with a delay. It is a distinct slot with a distinct clip, a
hold phase inserted between startup and active, and a reward that is a *ramp*, not a step.

```
press heavy, hold           -> enter r2.charged
frames 1..startup_f         -> windup clip, IDENTICAL commitment rules to RI-CMB02 §D
frames startup_f+1 .. +c    -> HOLD phase, c ∈ [0, charge_max_f], player is a statue
release, or c == charge_max -> active_f frames of hitbox
                            -> recovery_f frames
motion_value  = base * lerp(1.00, charge_ramp.motion_value_at_full, c / charge_max_f)
poise_damage  = base * lerp(1.00, charge_ramp.poise_damage_at_full, c / charge_max_f)
hyperarmour   = enabled for the whole HOLD phase once c >= ceil(0.5 * charge_max_f)
stamina       = deducted IN FULL on frame 1 (RI-CMB02 §D.6), never per-charge-frame
```

Binding rules:

1. **The hold phase is vulnerable and visible.** Hyperarmour arriving at half charge is the
   whole risk/reward: you are committing to eat a hit in order to break something's poise.
2. **Charge cannot be cancelled**, only released. A charge abandoned by releasing early
   still fires the attack. There is no "let go and go back to neutral".
3. **`charge_max_f` is 1–60 f@60** ~~1–30 frames~~ *(AMENDED wave 0 (rebase-s22))*, per
   RI-CMB02 §C's rebased `+1…+60 f` charge row, and the ramp
   endpoints are ×1.30 motion value and ×1.50 poise damage, matching that row exactly.
4. **Charging is the intended TURTLE answer alongside `guardbreak`** — RI-AI05 §7 requires
   the shield-enemy's answer to ship in the player's kit, and this is half of it.
5. **BOW's `bow.aimed` uses the same machinery** with `charge_max_f` = 45 and a ramp to
   ×1.60 motion value; a bow held past full draw begins draining stamina at 8/s.

### D. Input mapping onto the closed button set

HARNESS.md §4 fixes the button vocabulary at fourteen names. Every slot in §A must be
reachable from that set — a slot that needs a fifteenth button is a harness amendment, not
a design freedom.

| Slot family | Mapping | Note |
|---|---|---|
| `r1.*`, `run.r1`, `roll.r1`, `backstep.r1`, `jump.r1` | `light` + state | State disambiguates; the button never changes. |
| `r2.*`, `run.r2`, `roll.r2`, `jump.r2` | `heavy` + state | |
| `guardbreak` | `light` while `move` vector magnitude ≥ 0.9 forward **and** the last **8 f@60** had no `light` press *(the input buffer; **not rebased** — `RI-CMB01` §C.6)* | The Souls kick. **No new button.** Deliberately awkward, exactly as upstream. |
| `guard.counter` | `light` within **40 f@60** ~~20 f~~ of a `BLOCK_SUCCESS` event | ⚠ see the collision note in the slot table |
| `art.1` / `art.2` | `heavy` while `two_hand` is **held** (not toggled) | Requires the harness to distinguish held from tapped `two_hand`; see the amendment request in §Comparison method. |
| `parry` | `parry` | Already in the closed set. |
| `plunge` | `light` or `heavy` while `AIRBORNE` and a valid target is below | |

### E. The answer matrix (BAR-CRITIQUE-01 **G9**)

Each RI-AI05 archetype × the player slot that answers it × the region by which that slot
must be available. An archetype whose only answer is "out-range it" is a hard fail, and so
is a verb priced in the economy with no mechanic behind it (RI-PRG05 prices arrows; `BOW`
exists in §A for that reason).

| Archetype | Primary answer | Secondary answer | Available by |
|---|---|---|---|
| A1 INFANTRY | `r1.1–r1.3` chain | `roll.r1` punish | R1 (start) |
| A2 TURTLE | `guardbreak` | `r2.charged` (poise break) | **R1, before its first appearance** |
| A3 DUELIST | `backstep.r1` (whiff-punish without spending a roll) | `parry` | R2 |
| A4 POISE_MONSTER | `r2.charged` under hyperarmour (trade) | `guard.counter` | R2 |
| A5 RANGED | `bow.quick` / `bow.aimed` | `run.r1` gap-close | **R1, before its first appearance** |
| A6 AMBUSHER | `crit.backstab` (RI-CMB05) | `roll.r1` | R1 |
| A7 SWARM | `2h.r1.1` on a wide-arc class (`arc_sweep_deg ≥ 150`) | `r2` sweep | R1 |
| A8 CASTER | `run.r1` gap-close | `bow.aimed` interrupt | R2 |
| A9 ELITE | `jump.r1` / `plunge` (poise dmg ×1.80) | `art.1` | R2 |
| A10 GANK_DUO | wide-arc `2h.r2` for angle control | `backstep.r1` | R2 |

**Threshold: every archetype has ≥1 answer available strictly before its first appearance
index in the RI-AI07 placement dump, and the player's total distinct verb count is ≥ 9.**

## Comparison method

Two independent sources must agree — the declared moveset data and the observed trace
(HARNESS.md §7.4). Neither alone is admissible.

Script: **`corpus/80-methods/m-wpn01-slot-contract.mjs`**

**M1 — Schema validation (static, no browser).**
```bash
node tools/analysis/content-stats.mjs --schema corpus/12-weapons/moveset.schema.json \
     --glob 'game/data/combat/movesets/*.json'
```
- **FAIL** any file that does not validate against `elder-souls/moveset@1`.
- **FAIL** any melee weapon with fewer than the 25 mandatory slot ids present.
- Report `slots_present / 25` per weapon, and the histogram over all weapons.
- **HARD FAIL** if the median is < 25 — the game does not have movesets, it has attacks.

**M2 — Slot reachability (harness).** For each weapon × each mandatory slot, build the
scripted input that should produce it, from §A's trigger column:
```js
await H.reset({seed: 1337}); await H.loadState('wpn-dummy-arena');
H.queueInputs(SLOT_SCRIPTS[slot]);            // e.g. roll.r1: {f:0,tap:'roll'},{f:18,tap:'light'}
H.traceStart(); H.stepFrames(240); const t = H.traceStop();
```
From the trace, read the `player.anim` string on the first frame of `phase == 'windup'`
after the press, and `startup/active/recovery` exactly as RI-CMB02 M1 computes them.
- **FAIL** the slot if no attack starts within **24 f@60** ~~12 frames~~ of the trigger. *(AMENDED wave 0 (rebase-s22): a tolerance measured against rebased animation lengths.)*
- **FAIL** the slot if the observed `player.anim` ≠ the declared `anim`.
- **FAIL** the slot if any of `startup/active/recovery` differs from the declared value by
  ≥ 1 frame.
- Report a `weapons × 25` grid of `{ok, missing, wrong_clip, wrong_frames}`. Paste it in the
  verdict; it is this item's single most diagnostic artifact.

**M3 — Alias detection.** Across the whole `slots` object of one weapon, count distinct
`anim` values.
- **HARD FAIL** if `distinct_anim(weapon) < 18` for a melee weapon. Twenty-five slots
  resolving to fewer than eighteen clips means at least eight slots are aliases.
- **HARD FAIL** if `anim(roll.r1) == anim(r1.1)` or `anim(backstep.r1) == anim(r1.1)` or
  `anim(run.r1) == anim(r1.1)` for any weapon. RI-WPN04 owns the deeper version of this
  check; this is the cheap static one that runs without a browser.

**M4 — Charge contract.** For each weapon, drive `r2.charged` at hold durations
`c ∈ {0, 1, ⌈max/4⌉, ⌈max/2⌉, ⌈3max/4⌉, max}` and one over-hold (`max + 20`):
- Extract `motion_value` implied by damage dealt to a fixed-defence dummy, `poise_damage`
  implied by the dummy's `poise_cur` delta, and `player.hyperarmour` presence per frame.
- **FAIL** if the ramp is not monotone in `c`.
- **FAIL** if the ramp is a step function (two distinct values) rather than a lerp — a
  "charged attack" that is really a second attack.
- **FAIL** if hyperarmour is present before `⌈0.5 × charge_max_f⌉` or absent after it.
- **FAIL** if over-holding does anything other than fire at full charge.
- **FAIL** if stamina is deducted more than once (per-charge-frame drain is a different game).
- **FAIL** if any input other than release changes the outcome (charge cancel = AR-1).

**M5 — Answer matrix.** Join `game/data/combat/movesets/*.json` `slots[*].answers[]` against
the RI-AI07 placement dump's `first_appearance_index` per archetype, and against the
RI-PRG08/RI-WLD region ordering.
- **FAIL** if any archetype has zero answering slots.
- **HARD FAIL** if any archetype's earliest answering slot is first available in a later
  region than its first appearance.
- **HARD FAIL** if any archetype's only answer has `shape == 'shoot'` and reach > the
  archetype's aggro radius — that is "out-range it" wearing a mechanic's clothes.
- Report distinct verb count; **FAIL** if < 9.

**M6 — Declared-vs-observed integrity.** Diff every numeric field in the declared moveset
against the M2 trace measurement, across all weapons × all slots.
- Report `agreement = matching_fields / total_fields`.
- **HARD FAIL** if `agreement < 1.00`. HARNESS.md §7.4 states this plainly: a mismatch
  between the declared moveset and the measured trace means the numbers are decorative.

**M7 — Determinism.** Re-run M2 for five seeds; compare `body_sha256` footers.
- **FAIL** on any variance (HARNESS.md §8 D5).

### Harness extensions this method requires

Requested as amendments to HARNESS.md, listed here so the request is on the record:

1. `player.anim_slot: string` in the frame record — the **slot id** the current animation
   was dispatched from, alongside the existing `anim`. Without it, M2 must infer slot from
   clip name, which is exactly the coupling this item exists to break.
2. `player.charge_f: int` — frames held in the charge phase, `-1` when not charging.
3. `two_hand` must distinguish **held** from **tapped** in `queueInputs` (`{"f":100,"hold":["two_hand"],"until":140}` must not toggle stance forty times).
4. Scenario `wpn-dummy-arena`: a flat, collision-free arena with one static training dummy
   of known hurtbox at 2.0 m, one shielded dummy, and one 3.0 m ledge for `plunge`.

## Scoring

| Check | Weight | Pass condition |
|---|---|---|
| M1 schema + slot census | 20 | Every melee weapon has all 25 mandatory slots, valid against the schema |
| M2 slot reachability | 25 | Every slot reachable, correct clip, correct frames (against the **rebased** tables) |
| M3 alias detection | 15 | ≥18 distinct clips per weapon; no contextual slot aliased to `r1.1` |
| M4 charge contract | 15 | Monotone lerp ramp, correct hyperarmour onset, single stamina deduction |
| M5 answer matrix | 15 | Every archetype answered before it appears; ≥9 verbs |
| M6 declared-vs-observed | 10 | 100% field agreement |

Max 100.

| Native | Verdict band |
|---|---|
| ≥ 88 | Meets the bar |
| 65–87 | Below bar — named remedy required |
| < 65 | Loses outright |

**Native-to-ladder mapping (SCORING.md §1.2, mandated by BAR-CRITIQUE-01 W7):**

| Ladder | Native score |
|---|---|
| 4 | 65 |
| 6 | 78 |
| 8 | 92 |

**Hard fails regardless of score:**
- Median `slots_present` < 25 across melee weapons.
- Any weapon with `distinct_anim < 18`.
- `anim(roll.r1) == anim(r1.1)`, or the same for `backstep.r1` / `run.r1`, on any weapon.
- `agreement < 1.00` in M6.
- Any archetype with no answer, or whose answer arrives after its first appearance.
- Charge cancellable by any input (AR-1: attack commitment).
- Any slot whose frame data is authored in seconds rather than frames, **or in frames with no framerate stated (S22)**.

**Blind pair:** hand the critic two `weapons × slots` clip-id grids with weapon names and
clip names hashed, and ask which game's weapons have a grammar. Record the blind pick before
the reveal.

## How we lose

1. **Two slots and a multiplier.** `attack()` and `heavyAttack()`, with rolling / running /
   backstep / jumping "handled" by passing a damage multiplier into the same function. This
   is the default shape of a Three.js combat prototype and it fails M3 statically, without a
   browser, in under a second. It is also the exact failure the user named.
2. **The slot table exists in JSON and nothing reads it.** Data written to satisfy the
   analyser while the runtime keeps its own hard-coded switch. M6 exists solely for this and
   it is a hard fail because the alternative — trusting one source — is how a corpus rots.
3. **Charge implemented as a timer.** `if (heldMs > 500) damage *= 1.3` — a step function,
   no hold clip, no hyperarmour, cancellable by releasing. M4 fires on three separate
   clauses.
4. **`guardbreak` never built**, because kicking is unglamorous and nobody misses it until
   the TURTLE archetype ships and has no answer. Then someone "fixes" TURTLE by lowering its
   poise, and the archetype dissolves into INFANTRY. M5 catches it at the matrix, RI-AI05 M1
   catches the consequence.
5. **`guard.counter` folded into "attack while blocking"**, which RI-CMB02 §D.1 forbids
   outright (no block-cancel, ever). The correct shape is a **40 f@60** ~~20-frame~~ window *after* a
   successful block, which requires a `BLOCK_SUCCESS` event that nobody will emit unless it
   is in the trace vocabulary.
6. **The bow is priced and never built.** RI-PRG05 already sells arrows. A gold sink with no
   mechanic is the cheapest possible lie about content, and M5's second hard fail names it.
7. **Weapon arts as a stat buff.** `art.1` becomes "+15% damage for 10 s" with a particle,
   because authoring a unique committed animation per weapon is expensive. It passes M1,
   passes M2 if someone gives it a clip, and quietly deletes the most expressive slot in the
   table. The defence is RI-WPN03's unique-clip requirement, not this item.
8. **Slots that exist only two-handed.** Someone implements the 1h table, runs out of time,
   and makes `two_hand` a damage multiplier. RI-WPN06 owns the measurement; this item's
   contribution is that eleven `2h.*` ids are in the mandatory 25, so the shortfall is
   visible as a count and not as an opinion.
9. **Frames authored in milliseconds.** `startup: 200` meaning 200 ms. **And its twin, which is
   what actually happened to this corpus: frames authored with no framerate, then copied across a
   30 Hz/60 Hz boundary (seam S22).** Everything in the
   corpus becomes incomparable, and it will be spotted late because the numbers still look
   plausible.
10. **Plunging attacks omitted**, because they need fall-height detection and a target
    below. They are also the single most memorable verb in the reference games' vocabulary,
    and their absence is felt as "the levels have no verticality" rather than as a missing
    slot — so it gets misdiagnosed and misfixed.

## Provenance note

`provenance: constructed`, confidence **high**. The forty-one-slot vocabulary, the mandatory
twenty-five, the schema, the charge contract's ramp arithmetic, the input mapping and the
answer matrix are all **defined for this project**. No FromSoftware title publishes a slot
schema and none should be cited as the source of any cell here.

Grounding is `community-data`, confidence **medium**, from the following. The community
motion-value tables for Elden Ring enumerate attack slots per weapon class as
`1h R1 / 1h R2 / 1h Charged R2 / 1h Running R1 / 1h Running R2 / 1h Rolling R1 /
1h Backstep R1 / 1h Jumping R1 / 1h Jumping R2 / 1h Guard Counter` plus the two-handed
mirror of each, across roughly forty weapon classes and four hundred weapons — which is the
shape §A generalises
([Motion Values — Elden Ring Wiki, Fextralife](https://eldenring.wiki.fextralife.com/Motion+Values);
[Motion Value — Eldenpedia](https://eldenring.wiki.gg/wiki/Motion_Value);
[Motion Values Viewer — Tarnished Traveler](https://tarnishedtraveler.com/elden-ring-motion-values-viewer/)).
Dark Souls 1 is documented as having five basic attack types — R1, R2, rolling, jumping and
running — with no weapon skills, which is why `art.*` is treated here as a later-generation
addition rather than a core requirement of the form
([Moveset — Dark Souls Wiki, Fandom](https://darksouls.fandom.com/wiki/Moveset)). The
roll-into-attack and running-attack inputs are described as distinct context-sensitive moves
rather than modified standard attacks
([Combat 101 — Gamer Guides, Dark Souls II](https://www.gamerguides.com/dark-souls-2/guide/beginners-guide/combat-101/exploring-your-melee-moveset)).
The observation that heavier and longer-windup attacks carry higher motion values, and that
jumping and two-handed attacks trend higher still, shaped the *ordering* constraints in
RI-WPN02 §B but none of its values.

**AMENDED wave 0 (rebase-s22).** Every frame value this item points at was doubled under seam
S22. This item states no frame values of its own, so nothing here needed rebasing except the two
window figures above; what changed is the *meaning* of the contract it enforces.

Cross-dependencies, and who wins on a conflict: RI-CMB02 wins on frame values for its seven
spine classes; RI-CMB01 wins on roll and backstep animation lengths (the `state_window`
bounds in §A slots 10–12 are read from its §B table); RI-CMB03 wins on stamina economy;
RI-CMB05 wins on poise, hyperarmour semantics and both criticals; RI-AI05 wins on the
archetype list in §E; HARNESS.md wins on the button set and the data layout. If this item
and any of those disagree, they win and this file is amended.
