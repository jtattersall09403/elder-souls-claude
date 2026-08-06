# Cross-system builder brief

**Status: binding. Handed to every builder, every wave, alongside `BUILDER-PROMPT-TEMPLATE.md`.**
Two pages. Read it before you write anything.

---

## 1. The requirement, in one sentence

> **Your piece must create or carry at least one interaction that crosses a system boundary — and
> that interaction must be observable firing in a harness trace, not merely present in a data file.**

If your piece genuinely has no boundary to cross, say so explicitly (§6). Silence is not an option:
`ARBITRATION.md` §3 requires every critic to report `seam_sterile` on your piece either way.

---

## 2. Why this exists

`ARBITRATION.md` gives you `AR-1` and `AR-2`. They are **leakage** detectors: `AR-1` fails you if a
Morrowind mechanic contaminates the fight, `AR-2` fails you if a Souls convention contaminates the
world. They are correct and they are one-directional. Neither ever asks whether the two halves of this
game **touch**.

Read the nineteen seam rulings as a set and they are a membrane. `S13` locks the topic list out of
combat. `S14` forbids the pause. `S4` splits fatigue from stamina and forbids them to interact.
`RI-PRG07` makes it an automatic `AR-1` fail if inventory Burden affects the roll by any amount.
`RI-PRG03` makes it an automatic fail if any skill is read during hit resolution. Every one is right.
Their sum is a game that can pass every item in this corpus and be **two products stapled together**:
a competent Souls arena bolted to a competent Morrowind world, sharing a save file and nothing else.

Every moment anyone remembers from either reference game is a membrane crossing. Levitating out of a
fight. Paralysing a guard. Talking an Ordinator down. A potion brewed twenty hours earlier deciding a
fight. Luring a knight off a ledge. Opening a shortcut *because* you learned the level while dying in
it.

`AR-3` (`ARBITRATION.md` §3) is the check that fires when they do not touch. This brief is how you
avoid triggering it, and `RI-CMP01` is the project-level floor `AR-3` defers to.

---

## 3. What counts — the three tiers

| Tier | Test | Worth | Example |
|---|---|---|---|
| **trivial** | Only informational. Something is *said about* something else and nothing observable changes. | **0** | An NPC mentions a boss. A journal entry names a place. |
| **mechanical** | A specific observable state change: a number moves, an option appears, a gate opens, a behaviour switches. | **1** | Faction rank changes patrol aggro. A book reveals a boss's weakness. Disposition opens a door that is otherwise a fight. |
| **structural** | The shape of the game changes for hours: a questline resolvable by combat **or** politics, with different world outcomes. | **3** | Killing vs sparing a boss reshapes a faction's leadership and its whole remaining line. |
| **seam-crossing** | The source is out-of-fight state and the target is `ROS`/`BOS`/arena (**W→F**), or the source is a fight outcome and the target is world state beyond souls and corpses (**F→W**). | **×2** | Wearing a faction's armour changes patrol aggro. A boss's death repopulates a district. |

**Trivial does not count.** If your only claim is that an NPC mentions something your piece made, you
have claimed nothing. Aim for at least one **mechanical seam-crossing** cell; aim higher if your piece
touches quests, factions, bosses or world state.

---

## 4. The matrix, and how to claim a cell

The full 19×19 matrix, its 42 declared seam crossings and its 22 structural cells are in
**`corpus/95-experience/RI-CMP01-cross-system-payoff-matrix.md`** §B–§F. The nineteen systems:

`FAC` faction rank · `DIS` disposition · `GLD` gold · `SKL` skills · `SPL` spells · `LOR` lore
knowledge · `STL` stealth/crime · `QST` quest state · `WLD` world state · `TOD` time of day ·
`WEA` weather/tide · `EQP` equipment · `LVL` level · `UPG` upgrade tier · **`ROS` enemy roster** ·
**`BOS` bosses** · `DUN` dungeon layout · `SCH` NPC schedules · `JRN` journal state.

**To claim a cell, put four things in your piece's data and one line in your handover:**

1. **The condition, in `game/data/**`.** `HARNESS.md` §7 is absolute: content that exists only as
   literals inside `.js` is unmeasurable, and unmeasurable content is treated as content that does not
   exist. A cross-system interaction implemented in a `switch` statement **scores zero**.
2. **The effect, in `game/data/**`,** at the same standard.
3. **A declared observable** — the specific thing in an `elder-souls/trace@1` frame that differs when
   the source state is set: an `alert_state`, a `topic` availability, an `hp` curve, a `spawn`, a
   world flag, an `enemies[]` roster id. Name it exactly. *"The player feels the difference"* is not
   an observable.
4. **The claimed tier**, honestly. Over-claiming `structural` when the effect does not persist 30
   simulated minutes is counted in `overclaim_rate` and is scored against the project.
5. **One line in your handover:** `cross_system: EQP→ROS · mechanical · seam-crossing · observable: enemies[].alert_state differs when guard_uniform_lilmoth is worn · data: game/data/npcs/lilmoth-guard.json#/reactions/2`

---

## 5. How it is verified — and why paper claims are worth nothing

`tools/composition/matrix-probe.mjs` runs a **paired A/B harness fork** for every claimed cell:

```
setSeed(n) → loadState(fixture)
  fork A: source state UNSET  ──┐  identical input script, identical seed
  fork B: source state SET    ──┘
  assert the declared observable DIFFERS between A and B, in the claimed direction
```

Both traces are hashed. `HARNESS.md` §8's `D5` guarantees byte-identical traces for the same
(scenario, seed, input script) — so **if fork A and fork B produce the same `body_sha256`, your cell
demonstrably did nothing**, and it scores zero and lands in `paper_cells[]` with your data path
attached.

This is the rule to internalise:

> **A claimed interaction that cannot be demonstrated firing scores zero. Paper interactions are the
> easy fake, and the probe is a difference — a difference cannot be asserted, only observed.**

A cell claimed `structural` gets a second check: the difference must still be present ≥ 30 simulated
minutes later, from a state loaded off the fork. If it is not, it is scored `mechanical`.

---

## 6. If your piece has no boundary to cross

Some pieces are legitimately internal — a shader, a camera spring arm, a frame-data table. `AR-3`
does not automatically fail you. It **does** require you to say so:

> `seam_sterile: true` — justification: *this piece implements the camera spring arm (`S18`); it
> carries no game state and has no source or target in the `RI-CMP01` system list.*

Two things follow. First, **write the justification yourself, in your handover** — a critic writing it
for you will write a worse one. Second, the project-level floor is that **at most 30% of pieces may
report `seam_sterile: true`** (`RI-CMP01` §H). Above 50% the project is building two products, and
that finding lands on the whole wave, not on you.

Before you claim sterility, check the three cheap crossings almost every piece can carry:

- **Does your piece read a world-side state it currently ignores?** Time of day, weather, tide,
  disposition, faction rank, a quest flag, a book read.
- **Does your piece produce a state anything else could read?** A cleared area, a dead named NPC, an
  opened route, a changed schedule.
- **Is there a refusal you could author?** `RI-CMP02` scores an in-fiction refusal (`E2`) above a
  silent no-op (`E0`), because a world that refuses you has noticed you exist and a world that
  silently accepts your action has not.

---

## 7. Things that will get your claim rejected

| | Why |
|---|---|
| The interaction lives in `.js`, not in `game/data/**` | `HARNESS.md` §7 — unmeasurable, therefore absent |
| The observable is "the player notices" or "the fight feels different" | Not in a trace frame; not an observable |
| The cell is trivial (an NPC mentions a thing) but claimed as mechanical | Counted in `overclaim_rate` |
| The A/B fork produces identical traces | The cell does nothing |
| Nineteen claims that all resolve to "the enemy's `alert_state` differs" | One interaction wearing nineteen hats; the structural floor cannot be met with aggro flags |
| The claim fills a **mandated-`none`** cell (`RI-CMP01` §G) | It breaks a seam ruling. `LVL→ROS` and `LVL→BOS` and `UPG→ROS` must stay empty — `S9` forbids enemy level-scaling in both directions. `SKL` may never be read during hit resolution (`S1`). Burden may never affect the roll (`RI-PRG07`). This is an `AR-1` fail, not a bonus |
| The interaction only works from a probe fixture and never in ordinary play | Reported as `reachable_in_play_fraction`; announced now, scored in a later wave |

---

## 8. Where to look for the details

| You need | Read |
|---|---|
| The full matrix, the counting rule, the per-wave floor | `corpus/95-experience/RI-CMP01-cross-system-payoff-matrix.md` |
| What must happen at combinations nobody designed | `corpus/95-experience/RI-CMP02-emergence-fuzzing.md` |
| Whether six different characters can actually go six different ways through your piece | `corpus/95-experience/RI-CMP03-build-identity-payoff.md` |
| The breakages you may **not** close without naming what your rule preserves | `corpus/95-experience/RI-EXP06-permissiveness-budget.md` §C (`PB-RULE`) |
| The supreme law and `AR-1` / `AR-2` / `AR-3` | `corpus/00-doctrine/ARBITRATION.md` |
| The trace format and the data-inspection contract | `corpus/80-methods/HARNESS.md` §5, §7 |

---

## 9. One more rule you will trip over

`RI-EXP06`'s **`PB-RULE`** binds you too:

> **No new anti-exploit hard fail, clamp, cap, cooldown, exception list, or "cannot X while Y" rule
> may be introduced without naming, in the same place, at least one sanctioned breakage it
> **preserves**, and stating how.**

If your piece adds a clamp — and the temptation will arrive the first time a playtester does something
overpowered — carry the line:

> `preserves: B-09 — the clamp is on the arbitrage ratio, not on the disposition-price curve`

An anti-exploit rule that names no preserved breakage is out of process. A game you cannot break is
usually a game whose systems do not touch, and that is the same defect this brief exists to prevent.
