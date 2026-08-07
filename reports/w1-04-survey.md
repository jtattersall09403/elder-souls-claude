# W1-04 survey — settlements, interiors and the people in them, as actually shipped

Taken before any of my edits, on branch `claude/morrowind-souls-threejs-game-mou39v` at `8fbc98e`.
Everything below is a count of files and a grep of call sites, not an estimate.

## 1. What exists

| Thing | On disk | Wave-1 requirement | Wave-3 floor |
|---|---|---|---|
| Settlement records (`game/data/world/settlements/`) | **1** — `thorn.json` | all 8 named settlements | 8 |
| Interior records (`game/data/world/interiors/`) | **2** — `thorn-hall`, `writ-house` | — | 250 |
| Property files (`game/data/world/property/`) | **8** — one per settlement | 8 | 8 |
| NPC records (`game/data/npcs/`) | **76** across 6 files | — | 269 |
| NPCs declaring a `schedule` | **5 of 76** | — | — |

`thorn.json` carries its own `declared_incomplete` block naming **W1-04** as the owner of the
other seven settlements. That is honest and it is correct; this survey is the receipt.

The property layer is the strongest thing here and it was not built by this piece. All eight
files exist, each with households (14 in Thorn), zones (29 in Thorn) carrying `owner`,
`owner_name`, `class`, `faction`, `residents`, `bounds_m`, `lights` (some `snuffable`),
`contents` with per-instance `owner` / `owner_scope` / `value_g` / `unique` / `stolen_from`,
and `locks`.

## 2. What consumes it — the RI-MTH07 answer, path by path

This is the part that matters. A model with no world-side consumer is the defect that has now
taken this project twelve times, and three of my nine paths are sitting in exactly that state.

| Path | Live consumer today | Verdict |
|---|---|---|
| `world.property.ownership` | `Engine.takeObject()` reads `zone.contents[].owner` / `owner_scope` and files a real crime through `st.commitCrime`; `sim/stealth/theft.js:74` reads `zone.class` and `zone.faction` | **consumed** (built by W1-15) |
| `world.locks.security` | `Engine.lockBegin()` resolves `zone.locks[]` into a live `STL_LockAttempt` | **consumed** (built by W1-15) |
| `world.persistence.state` | `save/state.js` writes `world.npcs[]`, `pose.interior`, `clock.time_of_day`, and the stolen registry | **partly consumed** |
| `world.faction.presence` | `zone.faction` reaches `theft.js` trespass; nothing else is keyed on who is present in a town | **thin** |
| `world.npc.population` | `sim/npc.js` `makeNPC()` / `stepNPCs()` — people exist and turn to face you | **consumed, but shallow** |
| `world.settlement.anatomy` | **none** | **dead data** |
| `world.interior.named` | **one expression**: `Object.keys(d.interiors).length` in `getWorldStats()` | **a census, not a consumer** |
| `world.interior.continuity` | **none** | **dead data** |
| `world.npc.schedule` | **none** | **dead data** |

### The schedule is the twelfth failure, verbatim

`game/data/npcs/*.json` records carry

```json
"schedule": [ {"from": "06:00", "to": "22:00", "at": "thorn-hall"} ]
```

`makeNPC()` in `game/src/sim/npc.js` does not copy the field onto the entity at all. `stepNPCs()`
— which *is* on the live path, `sim/step.js:124` calls it — turns a person's yaw toward the player
and, for `post` behaviour, counts loiter frames. **Nobody in this world has ever moved.** This is
`topics_taught` again with a different field name.

The property layer has the same shape of hole one level down: every zone carries
`schedule: {open_h, close_h}` and **nothing reads it**, so trespass is time-blind — a shop is as
much a trespass at noon as at three in the morning, and a house is as little.

### `env.settlement` is written by nothing

`makeEnvironment()` declares it. `sim/quest/topic-supply.js` reads it, because RI-DLG02 requires
rumours to differ per town. `engine.js:1517` reads it. The **only** writer in the tree is
`loadState`'s patch. Walking into a town does not tell the world you are in that town, so the
per-settlement rumour book can only ever be driven by hand from a probe.

## 3. Dangling references nothing checks

* **Interiors.** NPC records name **11 distinct interior ids**: `barge-hold`, `blackrose-inn`,
  `blackrose-prison`, `gideon-court`, `gideon-lowmarket`, `helstrom-undertemple`,
  `lilmoth-customs`, `lilmoth-yard`, `stormhold-archive`, `thorn-hall`, `writ-house`.
  **Two of the eleven exist.** Nothing validates it at boot.
* **Topics.** After slug-normalisation (`core/topics.js` is slug-tolerant), **9 of 116** topic ids
  on NPC records have no body in `game/data/dialogue/topics/`: `lukiul`, `my-work`,
  `the-chapter-s-vote`, `the-hold`, `the-interior-s-consent`, `the-ledger-s-terms`, `the-list`,
  `the-writ`, `your-hatch-name`.

## 4. Population spread

76 records over 10 settlements plus two region-level buckets, and 13 with `settlement: null`:

```
gideon 10  soulrest 10  helstrom 9  lilmoth 7  stormhold 6  blackrose 5  archon 5
thorn 3  tidewrack 3  rootlands 3  thornmarsh 2  (null) 13
```

Note `tidewrack` and `rootlands` are named as settlements by NPC records but are not among the
eight, and have no property file. `thorn` has 3 NPC records against a `targets.named_npcs` of 12
in its own settlement file.

## 5. Baselines before my changes

All three gates green, so any red after my work is mine:

```
node tools/check-data.mjs        exit 0   (366 files indexed)
node tools/check-content.mjs     exit 0
node tools/harness/boot-check.mjs exit 0
```

## 6. What this piece therefore has to do

1. Author the seven missing settlement records so all eight exist and are enterable.
2. Author interiors for every id something already points at, so the eleven dangling references
   resolve.
3. Give the settlement, interior and schedule models **world-side consumers on the live step**,
   and prove each by perturbing the model and watching an entity change behaviour.
4. Make `env.settlement` and `env.interior` something the world sets, not something a probe sets.
5. Only then arm any assertion. The engine has been taken down twice by a fail-closed check that
   landed ahead of its own data.

---

# Part II — the after-state

Taken after the piece's edits, on the same branch. Same method: counts of files and greps of call
sites, not estimates. Part I above is left exactly as it was written — it is the before-picture and
rewriting it would destroy the only record of what was actually shipped.

## 7. What exists now

| Thing | Before | Now | Wave-1 requirement | Wave-3 floor |
|---|---|---|---|---|
| Settlement records | 1 (`thorn`) | **8** — all eight named | all 8, enterable | 8 |
| Interior records | 2 | **115** | — | 250 |
| NPC records | 76 | **336** | — | 269 |
| NPCs declaring a `schedule` | 5 of 76 | **265 of 336** | — | — |
| Interiors carrying `continuity.interior_spawn` | 0 of 2 | **115 of 115** | — | — |
| Dangling interior ids on NPC records | 11 of 13 | **0** | — | — |
| NPC `settlement` values that resolve | 333 of 336 | **336 of 336** | — | — |

The wave-3 NPC floor of 269 is already clear at wave 1. The interior floor of 250 is not — 115 of
250 — and that is stated rather than dressed up.

## 8. What consumes it now

Every row in §2 that read **dead data** now has a consumer on the live step, and each was proved by
perturbing the model and watching an entity change behaviour, not by asserting the file parses.
`tools/world/w1-04-consumption.mjs` runs 13 checks across all nine paths in the browser against the
real `Engine`; `--self-test` cuts each consumer on purpose and requires 4/4 invertible checks to go
red before it will exit 0.

The largest thing found in that pass was not a missing consumer but a **broken one**: `sim.player.pos`
is not the player position, it is a mirror that `combat-bridge.mirror()` overwrites at the top of
every step. `useDoor()` and `leaveInterior()` wrote the mirror, so **a door taken on frame N was
silently undone on frame N+1** — and nothing was red, because `sim.env.interior` was set correctly
the whole time. Every census-shaped check passed while the player never went anywhere. Fixed with
`Engine._placeBody()`; the body now holds the declared `interior_spawn` across steps and returns to
the declared `exterior_spawn`, round-trip error 0.000 m at both ends.

## 9. The `settlement` field on an NPC record

Part I §4 listed `rootlands` (3) and `thornmarsh` (2) among the NPC settlement values and noted they
"are not among the eight". That understated it. Two consumers key on this string —
`RumourBook.pick()` for what the town is saying and `RoadBook.forNpc()` for the way out of it — and
both are written as:

```js
npc.settlement || <the settlement the PLAYER is standing in>
```

That fallback is deliberate: an NPC spawned from a state file usually carries no settlement, and
without it four people stood in Soulrest and none could tell you the road out. **A junk string does
not fail the fallback, it defeats it.** `"rootlands" || fallback` is `"rootlands"`, every rumour row
filters out on `r.settlement !== settlement`, the road book's `bySettlement` lookup misses, and the
person answers nothing while nothing goes red. So a bad value is strictly worse than no value.

`thornmarsh` was repaired a round earlier by W1-19. The three `rootlands` records — a Hist-grove
rootkeeper, a Vakh speaker, a river-band elder on a bank — are repaired here. `rootlands` was not a
region id either: the world has `western-rootlands` and `eastern-rootlands`. These three are
wilderness people and `null` is the representation `topic-supply.js` documents for exactly them
(*"a hermit on the Clay Moor is not a signpost"*), so they now speak for wherever the player meets
them rather than for nowhere.

`tidewrack` is **not** part of the defect and was deliberately left alone. It has no settlement
record and no road out of it — correctly; it is the opening prison barge and there is no road off a
barge — but it does have a rumour bucket, so the three people aboard can answer for where they are.

Measured, with the player standing in Thorn and only the record's own field differing:

| NPC | as shipped | with the junk value restored |
|---|---|---|
| `rootlands-keeper` | 2 roads, a rumour | **0 roads, no rumour** |
| `rootlands-drowned-speaker` | 2 roads, a rumour | **0 roads, no rumour** |
| `rootlands-band-elder` | 2 roads, a rumour | **0 roads, no rumour** |
| `widow-ineel` | 2 roads, a rumour | **0 roads, no rumour** |
| `herbwife-ossa` | 2 roads, a rumour | **0 roads, no rumour** |

`tools/world/w1-04-settlement-field.mjs` is the receipt. It imports the real `RumourBook` and
`RoadBook` from `game/src/sim/quest/topic-supply.js` and wires them exactly as
`Engine._installTopicSupply()` does — nothing in it reimplements the consumer. It runs in bare Node
because `topic-supply.js` imports only `core/topics.js`. It includes a control townsperson and exits
non-zero if the control is silent, so the run distinguishes *the field is consumed* from *the books
are empty*.

**The class is now checked, not just the instances.** `tools/check-data.mjs` — the checker every
agent already runs, wired into `.githooks/pre-commit` — asserts that every non-null NPC `settlement`
resolves against settlement records ∪ rumour buckets. It skips `null` (deliberate and supported) and
no-ops entirely when the key space is empty, so it cannot take the engine down while world data is
mid-move. Reintroducing `rootlands` on one record makes it exit 1 naming the record.

The check went in **after** the data was clean. That ordering is the point: a fail-closed assertion
landed ahead of its own data has taken this engine down four times and blocks every other agent,
since they all boot-check.

## 10. Still open, and owned by others

* **Interiors: 115 of the wave-3 floor of 250.** Wave-1 requirement (all eight settlements exist and
  are enterable) is met; the wave-3 count is not, and no later reader should infer otherwise.
* **9 of 124 NPC topic ids have no body** in `game/data/dialogue/topics/`: `the-chapter-s-vote` (×3),
  `the-interior-s-consent` (×2), `the-ledger-s-terms`, `the-hold`, `your-hatch-name`, `the-writ`,
  `my-work`, `the-list`, `lukiul`. **All nine are on files owned by other pieces** — `mainline.json`
  (quest layer) and `writ-house.json` (W1-07 creation). Reported rather than silently filled: seeding
  a gate with a string of my own invention is exactly how the quest and dialogue layers went unjoined
  for weeks. The 260 NPCs authored by this piece reference **0** missing topics.
* **Region ids are not a namespace.** `thorn.json` says `"region": "thornmarsh"` while the world
  elsewhere uses `western-rootlands` / `eastern-rootlands`, and `game/data/world/regions.json` is the
  authority for neither. Nothing validates a settlement's `region` against anything. Not repaired
  here because the region model belongs to the map/world builder, but it is the same class of defect
  as the one above and will bite the same way.
