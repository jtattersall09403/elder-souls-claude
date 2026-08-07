# `GAP-W1-souls-alive-keyed-on-eid` — closed in round 3, and it was a class

**Filed by:** W1-SOULS round 3. **Closes:** `W1-SOULS-r2` HF-1 and HF-2.
**Does not close:** `GAP-W1-population-save-reload-repays-every-corpse` (`W1-POPULATION-r1` §2),
which is the same root seen from a third side and is that piece's to fix. Read on for why the
distinction is the repair rather than a dodge.

## The root, in one sentence

`SoulsSystem._alive` asked **"have I seen this NAME before, at this rest epoch"**, and both halves
of that key are minted by somebody else and reset independently of the bodies they describe — the
eid by whoever spawns, the epoch by `DeathSystem`, the ledger by whichever boundary remembered to
clear it. Three clocks, no invariant tying them together.

## The three faces, and they point in two directions

| # | route | what happened | found by |
|---|---|---|---|
| 1 | `Engine.applyNamedState()` | the boundary cleared four subsystems and not this one; the same fight paid **+384 then +0**, twelve refused re-arms, zero rests | W1-SOULS r2 critic |
| 2 | a partly-cleared post released and re-materialised under `{ tag: p.id }` | five corpses' eids came back on five live, full-HP, hostile bodies worth **+0** | W1-SOULS r2 critic |
| 3 | `Engine.loadState(blob)` | the ledger *was* cleared, while `ordinaryRespawnEpoch` stood still and every post went back to `DORMANT`: kill, save, load, kill again, **paid in full, without bound** | W1-POPULATION r1 critic |

**Faces 2 and 3 pull in opposite directions off the same key.** That is not three bugs with a
shared cause. It is the proof that the key was wrong rather than that the sign was wrong, and it
is why round 2 — which found face 1 itself, wrote *"ANY probe in this tree that recycles an
encounter is doing the same thing"* in its own status file, and then fixed its own instrument by
tagging its fights — fixed the instance and not the class.

## The repair, in two halves that belong to two owners

**1. Identity — `game/src/sim/souls.js`.** The ledger records the **body**: `_alive` maps eid to
`{ ref, alive, paidEpoch }`, where `ref` is the entity object `makeEntity()` minted. Object
identity is the one notion of "this body" nothing in the build can counterfeit — `sim.reset()`
throws the array away, `despawn()` splices the object out, `applySave()` rebuilds every record
through `statFor`, and `spawnEncounter` builds a new object even when it re-uses the name. A
record whose `ref` is not the entity in front of us is about a body that no longer exists, so the
entity in front of us is a new life and is seeded from scratch.

Faces 1 and 2 then close **structurally**: there is no name left to recycle, and the ledger can no
longer outlive the world it describes.

The rest epoch survives, scoped to the one case it was always about: `death.js respawnOrdinary()`
is the only thing in the build that brings the **same object** back, and it is the S5 event.

**2. Boundary hygiene — `game/src/engine.js _sessionObservers()`.** There were two hand-maintained
lists of which per-session observers each boundary cleared, and they had drifted; that drift *is*
face 1. There is now one declared list that both boundaries consume, in which **every observer
must state what it does at each boundary, including "nothing", with a reason**. An omission is now
a written claim somebody can disagree with rather than a missing line nobody notices.

Writing that list immediately found a **fourth instance** nobody had looked for:
`Engine._greetCount` — npc eid → how many times you have spoken to them — was in *neither*
boundary's list, and `character/converse.js pick(lines, npcId, nth)` selects the greeting line
with it. The first person you spoke to in the second scenario of a session answered you with the
fourth thing they had to say. Now cleared at both boundaries.

And a **fifth**, reported and deliberately not fixed here: the blob path never calls
`stealth.resetSubsystem()`; `applySave` restores `crime.ledger` and `crime.zones` and nothing else,
so civilians, searches and pending reports survive a load. Declared in the registry as `why_not`.
Owner: W1-15.

**3. The world's half — `game/src/world/population.js`.** Face 2's under-payment and face 3's farm
are the same defect seen from two sides: **the world rebuilds bodies for free.** Once the ledger
pays per body, it pays for whatever the world builds — which is correct, and which is why round
2's epoch gate could never have been right. A reward system cannot price a respawn it did not
authorise; the price of a respawn is the world's to charge.

So a released post now remembers who was down (`this.down`), `_materialise()` leaves them down, and
the S5 epoch bump clears the register. That is `population.js`'s own stated intent — *"walking away
and coming back is not a respawn, resting is"* — finally kept for a **partly** cleared post and not
only for a finished one. Face 3's route (`applySave` resetting the post table wholesale) is
untouched: it needs the cleared-post set persisted into the save, which is a save-schema decision
belonging to `W1-POPULATION` and named in their own `path_to_ten`.

## What stops the sixth instance

`tools/progression/souls-ledger-oracle.mjs`. It does not test these routes. It enumerates every
route of length 3 over a seven-event world alphabet (`kill_some`, `kill_all`, `release`,
`materialise`, `named_load`, `save_load`, `rest`) plus a seeded sample of length 5, and after every
event it checks three invariants that must hold on *any* route:

* **I1 no double pay** — a body-life is paid at most once per rest epoch. *(souls)*
* **I2 no free kill** — a body-life that dies pays exactly its statblock value × night. *(souls)*
* **I3 no free resurrection** — an eid last observed dead is never observed alive again without
  `ordinaryRespawnEpoch` moving. *(the world: population + the save path)*

Separating I3 from I1/I2 is the whole point. Round 2's epoch gate was the souls ledger trying to
enforce I3 by refusing to pay, which is exactly why it broke in the opposite direction on the
first route nobody had anticipated. There will be a fourth world route — a dungeon reset, a quest
re-staging an ambush, a fast travel streaming a region out and back — and it will fail a named
invariant in the open instead of being absorbed into a reward.

The oracle's own bookkeeping is derived from the route it drove, never from an engine field, so it
would still be correct if `sim/souls.js` were replaced wholesale. `--self-break` runs the identical
routes with the producer disabled and **requires** the run to go red.
