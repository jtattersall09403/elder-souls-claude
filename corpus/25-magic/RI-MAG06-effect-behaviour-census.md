---
id: RI-MAG06
title: The effect-behaviour census — an effect is what it does, not what its record says it does
kind: trace
side: morrowind
judges: [magic.effects.catalogue, magic.effects.parameters, magic.effects.utility, magic.effects.traversal]
provenance: constructed
confidence: high
blind_pair: no
---

> **Filed by the W1-14 critic, wave 1, under CORPUS-CONTRACT §5 (corpus hole).**
> `RI-MAG02` is the parameter space and `RI-MAG03` is the system that combines it. Neither
> contains a check that an effect **does** anything. `RI-MAG02` M1 is a diff of two JSON files;
> M2 is arithmetic; M3 is a grep; M6 probes ten named effects and no more. A build can ship all
> 55 records, recompute every cost exactly, pass M1, M2, M3 and the economy axis outright, and
> have **five** effects that produce their stated mechanical consequence. That is what wave 1
> shipped, and every existing instrument in `corpus/25-magic/` said it was fine.
> This item is the missing instrument.

## The bar

An effect is a **verb**, and a verb is judged by what happens when it is spoken. `feather` is
not the string `"feather"` plus a number in a list — it is a measurable move of the player
across `RI-CMB01`'s equip-load tier. `calm_beast` is not a row in `effects_active` — it is an
aggroed animal that stops being aggroed. `open_lock` is not an `effect_apply` event — it is a
lock that opens. The bar is therefore blunt and it is the only bar this item has:

> **For each of the 55 effects in `corpus/25-magic/data/effects.json`, the critic must name the
> game system the effect claims to move, read that system's state before and after, and record
> the delta.** An effect whose only observable consequence is (a) HP loss equal to its own
> magnitude, or (b) a row in `effects_active` that no other system reads, **has not shipped.**

"Good" is **≥ 50 of 55 effects moving the system they name**, with the five permitted exceptions
being effects whose consuming system is genuinely owned by a wave that has not run yet — and
each of those five named, in the verdict, with the piece that owns it.

The failure this item exists to catch has a shape and the shape is worth naming, because it is
attractive rather than lazy: a single generic applicator (`for each effect: target.hp -=
outputOf(effect, magnitude)`, then `push` a timer) is *less* code than 55 handlers, it produces
correct-looking `effect_apply` events with correct magnitudes and durations, it satisfies every
static census, and it makes 55 effects available on day one. It is the most economical way to
appear finished.

## The reference artifact

### A. The behaviour classes (the census's output vocabulary — closed)

| Class | Definition | Counts toward the bar |
|---|---|---|
| `FUNCTIONS_AS_SPECIFIED` | The named system's state changed in the direction and magnitude the effect record and `RI-MAG02` describe | **yes** |
| `PARTIAL` | Some of the effect's stated mechanics move, others measurably do not; both halves named | **no** — reported with the failing half |
| `HP_DAMAGE_ONLY` | The only observable consequence is `hp` decreasing by the effect's magnitude, and the effect is not a damage effect | no |
| `UNREAD_TIMER` | A row appears in `getPlayerStats().effects_active` (or the target's equivalent) and no other system's state changes | no |
| `NOT_OBSERVED` | The effect could not be delivered at all — no castable carrier, no reachable target, no contact | no — and it is a **defect in the shelf**, reported separately |
| `UNMEASURABLE` | The consuming system does not exist in this build at all | no — **scores 0 fail-closed**, and the owning piece must be named |

### B. The consuming-system map (BINDING — this is the artifact)

Every effect names exactly one system whose state a critic reads. Where an effect names a
system this project has not built, the row says so, and that row scores `UNMEASURABLE` = 0
until it is built — it is never silently skipped.

| Effect | System to read | The delta that proves it |
|---|---|---|
| `fire_damage` `frost_damage` `shock_damage` `poison_damage` `damage_health` | target `hp` + `status_buildup` | `hp` falls by the deterministic output; the declared buildup kind advances on the S11 meter |
| `drain_health` | target `hp` **and** target `hp_max` | `hp_max` falls for `duration_f`, then returns |
| `absorb_health` | target `hp` **and caster `hp`** | caster `hp` rises by what the target lost |
| `restore_health` `restore_attribute` | caster `hp` / `getPlayerStats().attributes` | rises, clamped at max |
| `resist_element` `resist_disease` `shield` `sap_ward` | damage taken from an identical scripted hit | strictly less than the unbuffed control, by the declared fraction |
| `cure_disease` `cure_poison` `cure_paralysis` | the affliction register | the named affliction leaves it |
| `feather` `burden` | `equip_load_pct` and `roll_class` (`RI-CMB01` M5's cliff) | the tier moves; the 30.00/70.00 discontinuity stays exactly where it was |
| `levitate` | `pos[1]`, horizontal speed, input acceptance, `focus` | `pos[1]` rises; speed ≤ 1.45 m/s **and** < walk; `light`/`heavy`/`block`/`roll`/`parry` all dropped; `iframe` false on every frame; 1.5 Focus per metre |
| `slowfall` | `pos[1]` series in a real fall + fall damage | terminal velocity 3.5 m/s, zero fall damage |
| `buoyancy` `breathe_water` | the water/depth band state (`S25`) | the denied action becomes available; the drown timer stops |
| `leap` | `pos[1]` peak after the cast | strictly greater than the unbuffed jump |
| `night_eye` `chameleon` `invisibility` `muffle` `false_face` | `getStealthState()` — `V`, `sound_r_m`, or the light term | the term moves; `chameleon` clamps at 80; `invisibility` breaks on attack, cast, interact, container and `COMBAT` |
| `detect_life` `detect_key` | the diegetic marker set, **and** the HUD entity count | positions appear; **HUD entity count stays 0** (S8) |
| `hist_sight` | `getQuestState().journal` | exactly **one** new prose entry; **zero** HUD markers |
| `speak_to_the_dead` | `getQuestState().flags` / `topicsKnown` | a knowledge key appears |
| `open_lock` `lock_lock` `ward_trap` | the lock/trap register (`RI-STL02`) | the lock's state changes; the trap disarms |
| `corrode` `shatter` | target armour rating / the breakable's state | the rating falls; the object breaks |
| `telekinesis` | interaction reach | an object outside melee reach becomes takeable |
| `wall` | the collision field (`solidAt`) | solid where it was not |
| `bound_weapon` `bind_lesser` `bind_greater` | loadout / `listEntities()` | a weapon or a summon exists that did not |
| `fortify_attribute` `fortify_skill` | the gate being probed | the gate that refused at base now passes |
| `paralyse` | the S11 buildup meter, then enemy `state` | buildup crosses its threshold, **never** 0 → applied in one frame; the enemy stops acting |
| `silence` | an enemy caster's cast attempts | cast attempts drop to zero for the duration |
| `calm_beast` `demoralise` `frenzy` `charm` | `alert_state`, `target`, and `in_combat` | the fight ends, or the target changes, with **zero** `death` events |
| `soul_trap` | the gem register and `xul_hesh` | a gem fills on the target's death; the counter increments |
| `mend_item` | item condition | rises, and refuses below 10% |
| `mark` `recall` `intervention` | `getPlayerStats().pos` | **the player is somewhere else**; `mark` writes the destination |

### C. The two aggregate numbers a verdict must carry

```
EFFECT-FUNCTION   = |FUNCTIONS_AS_SPECIFIED| / 55
GENERIC-APPLICATOR = |HP_DAMAGE_ONLY| + |UNREAD_TIMER| / 55
```

`GENERIC-APPLICATOR` is the diagnostic. When it is high, the build has one applicator and 55
labels, and no other metric in `corpus/25-magic/` can see it.

## Comparison method

Script owed to `corpus/80-methods/`: **`m-mag06-effect-census.mjs`**. A working reference
implementation exists at
`corpus/90-verdicts/wave1/artifacts/W1-14/consolidate.mjs` + `census.mjs`.

**M1 — Delivery.** For every effect, find a carrier: a shipped spell, a commissioned spell, a
scroll or an enchanted item. Cast it in `arena_flat` at maximum WILLPOWER and school skill with
a rod, against a spawned target at both 6 m and 1.4 m (so touch and volume geometry both make
contact). **Record `NOT_OBSERVED` for any effect with no castable carrier** — including an
effect whose only carrier costs more Focus than the maximum reachable pool.

**M2 — The paired read.** For each effect, read §B's named system **before the cast and after
the effect's full duration**, in the same run, and record the delta. The control is the
identical run with the effect not cast. **An effect is `FUNCTIONS_AS_SPECIFIED` only if the
control and the treatment differ.**

**M3 — The generic-applicator detector (the decisive check).** For every effect that is *not*
one of the five damage effects, assert that the target's `hp` delta is **zero**.
- **A non-damage effect that reduces `hp` by its own magnitude is `HP_DAMAGE_ONLY`.**
- Report the count. **Any count > 3 is a hard fail of this item**, because three is the most a
  build can plausibly get wrong by accident and anything above it is one code path.

**M4 — The unread-timer detector.** For every effect that produces a row in `effects_active`,
run M2's paired read. **A row with no delta anywhere is `UNREAD_TIMER`.** Report the count.

**M5 — Cross-check against the declared flags.** Diff the census against
`effects.json`'s own `changes_traversal` and `changes_quest_resolution` booleans.
**Report every effect declaring `changes_traversal: true` that measured `UNREAD_TIMER`** — that
pair is the exact claim `RI-MAG02` §B's census makes and this item falsifies.

**M6 — The five permitted exceptions.** List every `UNMEASURABLE` row with the piece that owns
the missing consuming system. **More than five is a fail**; five or fewer is a wave-ordering
fact rather than a defect, and the verdict must name each.

## Scoring

| Axis | 10 | 6 (pass floor) | 0 (we lose) |
|---|---|---|---|
| `EFFECT-FUNCTION` | ≥ 50/55 | ≥ 40/55 | < 25/55 |
| `HP_DAMAGE_ONLY` count | 0 | ≤ 3 | > 3 → **hard fail**, one generic applicator |
| `UNREAD_TIMER` count | ≤ 2 | ≤ 8 | > 15 |
| `NOT_OBSERVED` count | 0 | ≤ 2 | > 5 — the shelf ships effects nothing can deliver |
| `UNMEASURABLE` count | 0 | ≤ 5, each with its owning piece named | > 5, or any unnamed |
| Declared-vs-measured (M5) | zero `changes_traversal: true` effects measuring `UNREAD_TIMER` | ≤ 2 | ≥ 5 — the catalogue census is fiction |

**Failure threshold: any axis below 6.** **Aggregation: min-over-axes.**

**Native → ladder anchors:**

| Ladder | 4 | 6 | 8 |
|---|---|---|---|
| Native | 4 / 10 | 6 / 10 | 8 / 10 |

## How we lose

- **The generic applicator.** `dmg += outputOf(effect, magnitude)` for anything with geometry,
  and a timer push for anything without. It is twenty lines, it makes all 55 effects "work" on
  the day the catalogue lands, and it is invisible to every other item in this area. It is what
  wave 1 shipped and it passed the builder's own 10-of-11 static audit.
- **`effect_apply` as proof of work.** The event stream is the most convincing artifact in the
  build: correct effect id, correct magnitude, correct duration, correct target, on the correct
  frame. It proves the effect was *dispatched*, which is not the same as *applied*, and a critic
  reading the event stream instead of the consuming system will sign off on nothing.
- **The census that counts flags.** `changes_traversal: true` is a boolean an author typed. It
  is evidence of intent, and `CRITIC-DOCTRINE` §1.1 says intent is not output. `RI-MAG02` §B
  counts 16 of them and 40 quest-resolution flags, and every one of those numbers survives a
  build in which no effect changes traversal at all.
- **Judging the buff by the buff.** Casting `thick_skin` and reading back
  `effects_active: [{effect: "resist_element", magnitude: 69.48}]` looks exactly like a working
  resist. The only honest read is the damage number from an identical scripted hit, with and
  without.
- **Deferring the consuming system forever.** Each individual effect has a good reason its
  consumer is not built yet — stealth is another piece, water is another piece, quests are
  another piece. Fifty-five good reasons make a catalogue that does nothing. M6 caps it at five.

## Provenance note

**`provenance: constructed`.** Every class name, threshold and count in this item is defined for
this project by the W1-14 critic and is binding because it is exactly measurable. Nothing here
is recalled from Morrowind or from any other build.

The consuming-system map in §B is derived, row by row, from the effect records in
`corpus/25-magic/data/effects.json` and from the rulings in `RI-MAG02` §F, §G, §H and §I — it
adds no new design, it only names where each existing claim becomes readable. Where §B names a
harness call (`getStealthState`, `solidAt`, `getQuestState`, `equip_load_pct`), that call is
already in `corpus/80-methods/HARNESS.md` §3 or in the W1-14/W1-15 amendments to it; this item
requests no new harness surface.

The one number that is a judgement rather than a derivation is **`HP_DAMAGE_ONLY > 3` as a hard
fail**. It is set at three because three is the most a build can plausibly get wrong one effect
at a time; above that it is a single shared code path, which is a different defect and deserves
a different verdict. It should be re-derived if a later build ever fails it with genuinely
independent handlers.
