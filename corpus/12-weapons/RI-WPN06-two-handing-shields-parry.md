---
id: RI-WPN06
title: Two-handing, shields, the offhand, and who is allowed to parry
kind: number
side: souls
judges: [weapon.stance.twohand, weapon.offhand.config, weapon.shield.taxonomy, weapon.moveset.slots, combat.block.guard, combat.block.parry]
provenance: constructed
confidence: high
blind_pair: yes
---

## The bar

**Two-handing is a different weapon, not a bigger number.** Gripping a sword in both hands
changes the stance, the arcs, the chain, the reach and what you are willing to stand in front
of — and it costs you your shield, which is the actual decision. A build in which
`two_hand` multiplies damage by 1.15 and plays the same animations has implemented a menu
option, not a mechanic; it has also deleted half of every weapon's moveset, since upstream a
weapon's two-handed table is authored as its own set of attacks.

**The offhand is a build slot, not a decoration.** A shield, a second weapon, a catalyst, a
torch and a bow are five different games. What you put there decides whether you have a
`block` verb at all, whether you can parry, whether you can `guard.counter`, and whether the
`light` button in your left hand does anything.

**Parry is a licence, not a universal.** Not every offhand can parry, the ones that can have
different windows, and a greatshield cannot parry at all — that asymmetry is what makes the
shield choice interesting instead of a stat comparison.

"Good" means: every melee class's two-handed table genuinely diverges from its one-handed
table on most slots and carries at least two attacks that do not exist one-handed; the
stance switch is a committed animation, not an instant toggle; at least three offhand
configurations are implemented and observably change the player's verb list; and parry
eligibility is a declared property of the offhand item with the windows RI-CMB05 already
publishes.

This item owns **stance, offhand configuration and eligibility**. RI-CMB05 owns the parry
window, the riposte and the backstab — every number in §D is cited from it, not restated.
RI-CMB03 owns stability, absorption, block stamina cost and guard break. RI-PRG07 owns equip
load, and RI-PRG02 owns stat requirements.

## The reference artifact

### A. The stance switch

| Property | Value |
|---|---|
| Input | `two_hand` (HARNESS.md §4 closed set), **tapped** |
| Animation | **18 frames**, a distinct clip per weapon class, root-locked |
| Legal from | `IDLE`, `WALK`, `RUN` only |
| **Illegal from** | any `ATTACK` phase, `ROLL`, `BACKSTEP`, `AIRBORNE`, `STAGGER`, `GUARD_BREAK`, `HEAL` |
| Cancellable | no — 18 frames of commitment, same rules as an attack (RI-CMB02 §D) |
| Buffered | yes, by the standard 8-frame buffer |
| Stamina | 0 |
| Effective Strength for requirement checks | **×1.50** while two-handed (RI-PRG02 owns the stat) |
| Offhand item | stowed; `block`, `parry` and `off.*` become unavailable for the whole duration |
| `art.1` input | `heavy` while `two_hand` is **held** — which is why the button must distinguish held from tapped (harness request, RI-WPN01 §Comparison method) |

An instant, frame-zero stance toggle is a **hard fail**: it makes two-handing free in the
middle of a fight, so the shield costs nothing and the decision evaporates.

### B. The headline measurable — two-hand divergence `TDV`

Over the twelve slots that exist in both stances — `r1.1 r1.2 r1.3 r2 r2.charged run.r1
run.r2 roll.r1 backstep.r1 jump.r1 guard.counter art.1` and their `2h.` counterparts:

```
A slot DIVERGES if:
    anim(2h.X) != anim(X)                                  # a genuinely different clip
  AND at least one of:
    |startup/active/recovery delta|  >= 3 f
    shape(2h.X)        != shape(X)
    chains_to(2h.X)    != chains_to(X)
    hyperarmour.enabled differs
    |arc_sweep_deg delta|            >= 25
    |root_dz_m delta|                >= 0.15

TDV = diverging slots / 12                    (per weapon)
```

| Threshold | Value | Meaning |
|---|---|---|
| **`TDV ≥ 0.60`** | **PASS** | ≥8 of 12 slots are genuinely a different attack two-handed |
| `0.25 ≤ TDV < 0.60` | Below bar | Two-handing is partly authored and partly a multiplier |
| **`TDV < 0.25`** | **HARD FAIL** | **Two-handing is a damage multiplier.** |
| **`TDV == 0` for any weapon** | **HARD FAIL** | The 2h clips are the 1h clips |

Two further requirements, both per **class** (satisfied by the class baseline weapon, and
inherited):

| Requirement | Value | Rationale |
|---|---|---|
| **Two-hand-exclusive slots** | **≥ 2** per melee class, declared in `stance.two_hand.exclusive_slots` | An attack that exists only two-handed is the clearest possible statement that this is a different weapon. Examples: UGS's 2h `r2.follow` (overhead into a horizontal sweep); GSW's 2h `art.1`; CGS's 2h `roll.r2` full 360°. |
| **Chain-length change** | ≥ **4** of the 14 melee classes must have `max_chain_len(2h) ≠ max_chain_len(1h)` | Chain length is the grammar; if it never changes with grip, the grip is cosmetic. Reference: FST 5→3 (both fists become one bludgeon), CGS 2→3, UGS 3→2, TSW 3→4. |

**Amendment request against RI-CMB02 §C.** Its two-handed row currently reads *"Different
clip, same frame counts"* with multipliers ×1.15 stamina, ×1.15 motion value, ×1.30 poise
damage. "Different clip, same frame counts" is satisfiable by a re-export and is exactly the
weak form this item exists to close: it permits `TDV = 0` on the frame-delta clause. This item
requests that the row be amended to *"Different clip and a divergent table: RI-WPN06 §B
`TDV ≥ 0.60` binds; the ×1.15/×1.15/×1.30 multipliers apply only to slots that do **not**
diverge."* Until that amendment lands, the multipliers and `TDV` are both binding and a
critic scores both.

**FST exception.** FST's `two_hand` equips a *second* fist and replaces the table entirely
rather than modifying it, so `TDV` is undefined for FST and is reported as `n/a`. Its
requirement instead is that the two-fist table have ≥5 slots that exist in no other FST
configuration. It is the one class where two-handing is a different weapon literally rather
than measurably, and the exception is stated so a critic does not score a `n/a` as a 0.

### C. Offhand configurations

Five configurations. **Three are mandatory**; the others are owned elsewhere and are listed
so the taxonomy is complete.

| # | Configuration | `block`? | `parry`? | `guard.counter`? | Adds | Status |
|---|---|---|---|---|---|---|
| O1 | weapon + shield | yes | shield-dependent (§D) | yes | `shield.bash`, `shield.charge` (greatshield only) | **mandatory** |
| O2 | weapon + weapon (dual) | **no** | if the offhand weapon is parry-capable (§D) | no | `off.r1.1`, `off.r1.2`, `off.r2` on the `light`-with-`swap_left`-held input | **mandatory** |
| O3 | two-handed (offhand empty) | no | no | no | the 11 `2h.*` slots (§B) | **mandatory** |
| O4 | weapon + catalyst | no | no | no | casting slots | **RI-MAG02 owns** (seam S19) |
| O5 | bow (inherently two-handed) | no | no | no | `bow.*` (RI-WPN01 §A) | **mandatory as a class**, not as an offhand |

Requirement: switching between O1, O2 and O3 must change the player's **reachable verb
count** by ≥ 4 in each direction, measured by the M2 probe. A configuration change that adds
or removes fewer than four verbs is a costume change.

**Losing block in O2 is not negotiable.** Dual-wielding trades the entire defensive half of
the kit for an offensive chain; if it keeps `block`, it strictly dominates O1 and the shield
stops existing. This is the most likely balance concession in the whole area.

### D. Shields and parry eligibility

Stability, absorption, weight, block stamina cost and guard break are **owned by RI-CMB03
§B/§D** and are not restated here. Parry windows are **owned by RI-CMB05 §D** and are cited
verbatim. What this item adds is the taxonomy, the guard angle, and who is allowed to parry.

| Shield class | Guard angle (± from forward) | Parry-capable | Parry window (RI-CMB05 §D) | Own slots |
|---|---|---|---|---|
| Buckler | ±50° | **yes** | 34 f animation, active **f5–f13** (9 f) | `shield.bash` |
| Small shield | ±60° | **yes** | 34 f animation, active **f5–f13** (9 f) | `shield.bash` |
| Medium / kite shield | ±75° | **yes** | 40 f animation, active **f8–f14** (7 f) | `shield.bash` |
| Greatshield | ±95° | **no — cannot parry, ever** | — | `shield.bash`, `shield.charge` |
| Dedicated parry tool (parry dagger, and DGR / TSW / CSW held in the offhand) | n/a — no block | **yes** | 32 f animation, active **f3–f14** (12 f) | — |

**Guard angle** is this item's addition: an attack whose incoming direction lies outside the
angle is **not blocked at all** — full damage, full poise damage, no stamina cost, as though
no shield were raised. It is what makes a greatshield's ±95° worth its weight and what makes
turtling against a surrounding group fail. It is geometric and deterministic (S1).

The parry-tool row is the reason DGR, TSW and CSW appear twice in this corpus: as main-hand
classes in RI-WPN02, and as offhand parry tools here. Holding one in the offhand costs the
shield, which is exactly the trade a parry build is.

**Unparryable attacks** are declared per-move in the enemy statblock and must be a minority
of any enemy's moveset (RI-CMB05 §D). Nothing in this item may make an attack unparryable
implicitly.

### E. Shield slots

| Slot | Trigger | Frames | Notes |
|---|---|---|---|
| `shield.bash` | `light` + forward, shield raised | 22 / 4 / 26 | The `guardbreak` variant for O1. Poise damage 24, motion value 0.35 — it exists to break a guard, not to deal damage. |
| `shield.charge` | `sprint` + `light`, greatshield only, two-handed grip on the shield | 30 / 8 / 34 | Root Δz 2.60 m. Carries hyperarmour f18–f38. The greatshield's reason to exist. |
| `guard.counter` | `light` within 20 f of `BLOCK_SUCCESS` | per RI-WPN04 §A multipliers | Weapon slot, not shield slot; unavailable in O2 and O3. |

## Comparison method

Script: **`corpus/80-methods/m-wpn06-stance-offhand.mjs`**

**M1 — `TDV` census (static + harness).** For all 87 weapons, compute `TDV` from the declared
moveset data, then confirm each diverging slot in the harness by driving both stances and
comparing `anim`, frame counts, root track and hitbox path (the RI-WPN04 T1–T4 tests, applied
across stances instead of across contexts).
- Report `TDV` per weapon and per class, plus the exclusive-slot count and the chain-length
  change count.
- **HARD FAIL** on any weapon with `TDV == 0`, or on roster median `TDV < 0.25`.
- **FAIL** any class with <2 two-hand-exclusive slots.
- **FAIL** the item if <4 melee classes change `max_chain_len` with grip.

**M2 — Configuration verb probe.** For each of O1, O2, O3, enumerate reachable verbs by
driving every input in HARNESS.md §4's closed set from every state, and recording which
produce an attack, a block, a parry or nothing.
```js
for (const cfg of ['o1_sword_shield','o2_dual','o3_twohand']) {
  await H.loadState('wpn-loadout-' + cfg);
  // sweep: each of the 14 buttons x 7 states x {tap, hold}
}
```
- Report the verb sets and the pairwise symmetric differences.
- **FAIL** if any pair differs by <4 verbs.
- **HARD FAIL** if `block` is available in O2 or O3.
- **HARD FAIL** if `guard.counter` is available in O2 or O3.

**M3 — Stance switch commitment.** Inject `two_hand` on every frame `k` of an attack, a roll,
a backstep, a stagger and a heal, in separate runs.
- **FAIL** if the stance ever changes during any of those states.
- **FAIL** if the switch animation is not exactly 18 f.
- **FAIL** if the switch is cancellable.
- **FAIL** if two-handing changes any *frame count* on a **non-diverging** slot (the ×1.15
  multipliers in RI-CMB02 §C are stamina, motion value and poise damage only).

**M4 — Guard angle.** Spawn one attacker; teleport it to bearings
`0°, ±30°, ±50°, ±60°, ±75°, ±90°, ±95°, ±120°, 180°` relative to the blocking player's
forward; land one attack from each with each shield class.
- **PASS** if blocked exactly inside the angle and unblocked exactly outside, at every
  bearing, for every class.
- **FAIL** on any bearing where the outcome differs from the table by more than the 1°
  granularity of the probe.
- **FAIL** if an unblocked attack still costs stamina — an out-of-angle hit must behave as
  though no shield were up.

**M5 — Parry eligibility.** For each offhand item, attempt a parry against a parryable enemy
attack.
- **PASS** if exactly the items in §D can parry, with exactly RI-CMB05's windows.
- **HARD FAIL** if a greatshield parries.
- **FAIL** if any parry window differs from RI-CMB05 §D by ≥1 f. (This is a cross-item
  agreement check, not a re-measurement: RI-CMB05's own method owns the numbers.)

**M6 — Shield slots.** Drive `shield.bash` and `shield.charge`; confirm frames, poise damage,
root displacement and the hyperarmour window.
- **FAIL** if `shield.bash` deals more than motion value 0.40 (it is a guard-break tool, and
  a shield that is a good weapon deletes the weapon).
- **FAIL** if `shield.charge` exists on a non-greatshield.

**M7 — Dual-wield chain.** In O2, drive `off.r1.1 → off.r1.2 → off.r2` and confirm the chain
graph, then confirm that the main-hand chain and the offhand chain cannot be interleaved
faster than the 8-frame buffer allows.
- **FAIL** if both hands can attack simultaneously.
- **FAIL** if the offhand chain has no independent clips (RI-WPN03's `UNQ` applies to `off.*`
  slots too).

**M8 — Determinism.** M1's harness half and M4 at five seeds.

### Harness extensions this method requires

1. `two_hand` held-vs-tapped distinction in `queueInputs` (shared request, RI-WPN01).
2. `player.stance: 'one_hand'|'two_hand'|'dual'` and `player.offhand_kind` in the frame
   record. M2 currently has to infer configuration from which inputs worked.
3. `block_success` event (shared request, RI-WPN04).
4. `player.block_angle_deg` — the guard angle in force this frame — so M4 does not have to
   binary-search it.
5. Named loadout states `wpn-loadout-o1_sword_shield`, `wpn-loadout-o2_dual`,
   `wpn-loadout-o3_twohand`, plus one per shield class.
6. `getPlayerStats().equipped` (shared request, RI-WPN02).

## Scoring

| Check | Weight | Pass condition |
|---|---|---|
| M1 `TDV` census | 30 | Median `TDV ≥ 0.60`; ≥2 exclusive slots per class; ≥4 classes change chain length |
| M2 configuration verb probe | 15 | ≥4 verbs difference each pair; no block/guard-counter in O2/O3 |
| M3 stance commitment | 15 | 18 f, uncancellable, illegal from every listed state |
| M4 guard angle | 15 | Every bearing × every shield class exact |
| M5 parry eligibility | 15 | Exactly the §D set, exactly RI-CMB05's windows |
| M6 shield slots | 5 | Frames exact; bash MV ≤ 0.40; charge greatshield-only |
| M7 dual-wield chain | 5 | Chain graph correct; no simultaneous hands; independent clips |

Max 100.

| Native | Verdict band |
|---|---|
| ≥ 85 | Meets the bar |
| 60–84 | Below bar — named remedy required |
| < 60 | Loses outright |

**Native-to-ladder mapping (SCORING.md §1.2 / BAR-CRITIQUE-01 W7):**

| Ladder | Native score |
|---|---|
| 4 | 60 |
| 6 | 74 |
| 8 | 90 |

**Hard fails regardless of score:**
- Any weapon with `TDV == 0`, or roster median `TDV < 0.25` — **two-handing is a damage
  multiplier**.
- An instant (frame-zero) or attack-cancellable stance switch.
- `block` or `guard.counter` available in O2 (dual) or O3 (two-handed).
- A greatshield that can parry.
- Any parry window disagreeing with RI-CMB05 §D.
- Blocking implemented without a guard angle (omnidirectional block).
- Both hands attacking on the same frame in O2.
- Fewer than three offhand configurations implemented.

**Blind pair:** two unlabelled 30-second traces of the same weapon, one one-handed and one
two-handed, with the stance field stripped. The critic is asked whether these are the same
weapon. If it says yes, `TDV` is a fiction regardless of what M1 computed.

## How we lose

1. **`if (twoHanded) damage *= 1.15`.** The default implementation, one line, and it is the
   failure the user's direction is pointed at. `TDV` is 0 and it is a hard fail with no
   partial credit, because the alternative — scoring it as "partially implemented" — is how
   it survives to ship.
2. **The 2h table authored for three classes and inherited for eleven.** GSW, UGS and GHM get
   real two-handed movesets because they are the glamorous ones; the eleven others share
   their one-handed clips. The per-class report exists so this shows as eleven failures and
   not as a passing median.
3. **Instant stance toggle.** It feels responsive, it is one boolean, and it makes shields
   free: two-hand for the damage, one-hand the instant you need to block. Every shield in the
   game becomes strictly better than every alternative and the offhand decision disappears.
4. **Dual-wield keeps the shield's block.** Proposed as "it feels bad to have no defence",
   accepted because it is true, and it ends the shield. The correct answer is that dual-wield
   *should* feel bad defensively; that is the price of `off.*`.
5. **Omnidirectional block.** `if (blocking) damage = 0`. The guard angle is fiddly geometry
   and the failure is invisible until a player discovers that holding block while surrounded
   is optimal. M4 is the only check that fires and it needs a real angle probe.
6. **Greatshield parries.** Nobody encodes the exception, so parry is a property of "having a
   shield". The heaviest, most stable, highest-stability shield then also gets the most
   powerful defensive verb, and the shield taxonomy collapses to a single stat ladder.
7. **Shield bash as a real weapon.** Someone tunes `shield.bash` upward because it feels weak,
   and a shield becomes a better weapon than a mace. Motion value ≤ 0.40 is the cap and it
   will be argued against.
8. **`off.*` slots sharing the main-hand clips.** Dual-wield ships as "you attack twice",
   which is `TDV`'s failure wearing a different hat. RI-WPN03's `UNQ` requirement is extended
   to `off.*` in M7 for exactly this reason.
9. **The stance switch that is legal during recovery.** Small, plausible, and it gives a free
   escape from every committed attack — the same class of failure RI-CMB02 §D exists to
   prevent, arriving through a door nobody was watching.
10. **Two-handing implemented as "hold the button" rather than a toggle**, which collides
    with `art.1`'s input (`heavy` while `two_hand` held) and produces a weapon art every time
    the player two-hands and attacks. Both inputs are in this corpus; only the harness
    amendment that distinguishes held from tapped resolves them, and it must land before
    either is built.

## Provenance note

`provenance: constructed`, confidence **high**. The stance-switch frame count, the `TDV`
metric and its thresholds, the exclusive-slot and chain-length-change requirements, the five
offhand configurations, the ≥4-verb-difference rule, every guard angle, the shield taxonomy
and both shield slots' frame data are **defined for this project**.

**Nothing in §D's parry column is new.** All five parry windows are cited from RI-CMB05 §D
unchanged, and M5 is an agreement check, not a re-measurement. If RI-CMB05 changes, this
table is amended to follow it; the reverse is not permitted.

One amendment request is recorded in §B: RI-CMB02 §C's two-handed row currently reads
"Different clip, same frame counts", which is satisfiable without divergence and is the
weakest form of the requirement this item exists to enforce. The request is that it be
strengthened to reference `TDV ≥ 0.60`.

Grounding is `canonical-recall`, confidence **medium**, of the following observed properties
of Dark Souls 1/3 and Elden Ring: two-handing a weapon plays a visibly different set of
attacks rather than the same attacks with more damage, and grants an effective Strength bonus
for requirement purposes; the stance change is a short animation that cannot be performed
mid-swing; dual-wielding forfeits the shield and adds a distinct offhand attack set; parry is
a property of the offhand item, with bucklers and small shields parrying more readily than
medium shields and greatshields not parrying at all; and blocking has a directional limit
rather than protecting from all sides. Community documentation supports the class-level
structure of two-handed movesets — hyperarmour on *"2-handed Greatswords"* specifically,
i.e. a property that exists only in one stance
([Poise — Dark Souls 3 Wiki, Fextralife](https://darksouls3.wiki.fextralife.com/Poise)) — and
motion-value tables are published with separate 1h and 2h columns for every slot, which is the
data-shape argument for `TDV`
([Motion Values — Elden Ring Wiki, Fextralife](https://eldenring.wiki.fextralife.com/Motion+Values)).
No numeric guard angle, stance-switch duration or divergence metric is published anywhere;
those are ours.

Cross-dependencies, and who wins on a conflict: RI-CMB05 wins on parry, riposte, backstab and
hyperarmour pools; RI-CMB03 wins on stability, absorption, block stamina cost and guard break;
RI-CMB02 wins on commitment rules and the two-handed multipliers pending the §B amendment;
RI-PRG02 wins on the Strength ×1.50 rule and every stat requirement; RI-PRG07 wins on equip
load, which decides whether a greatshield is affordable at all; RI-MAG02 owns O4; RI-WPN01
owns the slot vocabulary and RI-WPN03's `UNQ` floor extends to `off.*` and `2h.*` slots
without restatement.
