---
id: RI-JRN05
title: Save and load — the state manifest, the round-trip diff, and the storage ruling
kind: structure
side: morrowind
judges: [journey.save.roundtrip, platform.save.persistence, platform.save.storage]
provenance: constructed
confidence: high
blind_pair: no
---

> **This item judges a JOURNEY, not a subsystem.** It is one of eight in `corpus/88-journeys/`.
>
> **Division of labour, binding:** `platform.save.persistence` already exists in the taxonomy
> and was previously unowned; this item claims it. **This item owns the state manifest, the
> round-trip diff, and the storage backend ruling.** It does **not** own what any individual
> piece of state *means* — quest stage semantics belong to `RI-QST04`, journal numbering to
> `RI-DLG05`/`journal.entry.numbering`, faction rank to `RI-QST03`, bounty and witness state to
> the crime item (`RI-CRM01` if it exists; if it does not, its state fields are still on the
> manifest below and their absence is a corpus hole to report, not to invent).
> **`RI-JRN06` owns bloodstain/soul-recovery semantics**; this item owns only whether the
> bloodstain survives a save/load. **`RI-PLT02` owns memory**; a save that leaks is its problem.
>
> **`blind_pair: no` and this is not an oversight.** Correctness is binary. There is no
> version of "our save system reads better than Morrowind's" that means anything. A blind
> judge cannot look at two state diffs and prefer one; either the diff is empty or it is not.
>
> **Subsystem paths pending taxonomy registration** — see `corpus/88-journeys/paths-requested.json`.

## The bar

A player saves in the worst possible moment — three stages into a five-stage quest, standing
in a dungeon they have half-cleared, one minute after a rank-up, with a bounty on their head, a
guard actively hunting them, a bloodstain on the floor two rooms back, an active journal with
forty numbered entries, a disease incubating, a door they unlocked, a corpse they looted, an
NPC whose disposition they raised by nine points, and a topic they learned from a book — then
closes the tab. **A week later they open the game on the same device and every one of those
facts is exactly as they left it.** Not "the important ones". Every one.

The bar is stated as a measurement so it cannot be argued with: **serialise, load, re-serialise,
and diff. The diff must be empty.** Not "the diff contains only cosmetic fields". Not "the diff
contains the camera yaw, which doesn't matter". Empty. A field that is genuinely allowed to
differ (wall-clock timestamp of the write) is declared on the manifest as `volatile` **before**
the test, or it is a defect.

The second half of the bar is the part builders skip: **the browser is a hostile store.** It
evicts. It runs out of quota mid-write. It is opened in a private window with no durable
storage at all. It gets closed halfway through a transaction. A save system that is correct
only when nothing goes wrong is not a save system; it is a serialiser with optimism attached.

## The reference artifact

### A. The storage ruling (BINDING)

The brief asks for a ruling between IndexedDB, `localStorage`, and file download for a
200-quest world. **The ruling is IndexedDB as the sole authoritative store, file
export/import as a mandatory second path, and `localStorage` banned outright.** Reasoning is
recorded here so it is not re-litigated.

| Backend | Verdict | Why |
|---|---|---|
| **IndexedDB** | **AUTHORITATIVE STORE.** | The only browser store with **atomic multi-key transactions**, which is the only mechanism that makes "tab closed mid-write" survivable. Asynchronous, so a 1.5 MB write does not block the sim thread. Stores structured-cloneable objects and binary directly — no JSON string round-trip through the main thread. Quota is measured in hundreds of MB to a percentage of disk, not 5 MB. Supports `navigator.storage.persist()`. |
| **`localStorage`** | **BANNED for save data.** Hard fail if used. | Synchronous and main-thread-blocking: a 1.5 MB `setItem` is a frame-time spike measured in tens of milliseconds, which violates `RI-PLT01`'s sim-loop budget *by construction*. String-only, so every save costs a full JSON serialise plus a UTF-16 store. Practical quota ≈ 5 MB **per origin, total** — a 200-quest world with a 40-entry journal, per-NPC disposition, per-container loot state and world flags will exceed that, and the failure mode is a thrown `QuotaExceededError` in the middle of a write with **no rollback**. There is no transaction, so a multi-key save is torn by definition. It is permitted for exactly one thing: a **≤ 1 KB pointer record** (`{lastSlot, schemaVersion, backend}`) used to decide what to offer on the title screen before IndexedDB opens. |
| **File download / upload** | **MANDATORY, but as export/import only. Never the primary store.** | A download cannot be a save system: it requires a user gesture per write (so no autosave), the file lands somewhere the game cannot read back, and there is no enumeration. But it is the **only** store the browser cannot evict, and it is the only way a player moves a save between devices or recovers from an eviction. It is therefore required, not optional. |
| **Cache Storage / OPFS** | Permitted as an *implementation detail* of the IndexedDB path (e.g. blob chunks in OPFS keyed from IDB), not as a separate declared backend. Whatever is used must satisfy §B's atomicity requirement. |
| **Cloud / server** | **Out of scope and banned.** `HARNESS.md` R1: the game is a static site requiring no network. A save system that needs a server makes the game unmeasurable and unplayable offline. |

**The write protocol (binding, this is what makes the tab-close test passable):**

```
SAVE(slot, state):
  1. gen        := meta.generation + 1                     (monotonic, never reused)
  2. payload    := canonicalise(state)                     (§C — stable key order)
  3. digest     := sha256(payload)
  4. ONE readwrite IDB transaction over ['blobs','saves','meta']:
       put  blobs[slot + ':' + gen]  = payload             (chunked if > 1 MB)
       put  saves[slot]              = {gen, digest, bytes, header, writtenAt}
       put  meta                     = {generation: gen, committed: {slot, gen}}
     — commit or abort. There is no third outcome.
  5. AFTER commit succeeds: delete blobs of generation < gen-1 for this slot.
     (The previous generation is retained. Slots are double-buffered A/B.)

LOAD(slot):
  1. read saves[slot] -> gen, digest
  2. read blobs[slot+':'+gen]; recompute sha256; if mismatch -> fall back to gen-1
  3. if gen-1 also fails digest -> the slot is CORRUPT: report it as corrupt,
     offer import, and NEVER silently start a new game in its place.
```

Two properties fall out and both are checked: a torn write is impossible (IDB transactions are
all-or-nothing), and a *corrupted* write is detectable (digest) and recoverable (previous
generation retained).

**Budgets.**

| Quantity | Budget | Note |
|---|---|---|
| One save, canonical JSON, uncompressed | **≤ 4 MB** | for a 200-quest world at full completion |
| One save, gzipped for export | **≤ 1.5 MB** | `.eldersouls` export file |
| Total origin storage: 10 manual slots + 3 autosaves + 1 quicksave | **≤ 48 MB** | leaves room under any realistic quota |
| Save write wall time, p99 | **≤ 250 ms**, entirely off the sim thread | see `RI-PLT01` — 0 sim frames may be dropped by a save |
| Sim frames delayed by a save | **0** | the sim does not stall for persistence |
| Load: `loadState` → first controllable frame | **≤ 3 s** on the reference desktop class | `RI-PLT03` owns cold TTFP; this is warm |

**Persistence and degradation.**

1. On the first successful save, call `navigator.storage.persist()`. Record the result.
2. On boot, call `navigator.storage.estimate()` and record `{usage, quota}`.
3. If IndexedDB is **absent or non-durable** (Firefox private windows give an in-memory IDB;
   Safari private mode gives a tiny ephemeral quota), the game degrades to an in-memory store
   **and must say so** — but **as an in-fiction line on the save surface itself, never as a
   modal or a toast** (`RI-JRN01` O11 is not repealed by this item). Suggested register: the
   save surface is a ledger; the ledger reads *"This ledger is written in water. Take a copy
   before you leave."* with the export control adjacent.
4. If a write fails with `QuotaExceededError`, the game deletes the oldest autosave and
   retries **once**, then surfaces the failure in the same diegetic register. **A save that
   fails silently is a hard fail.**
5. `localStorage` may hold only the ≤ 1 KB pointer record. Any save payload in `localStorage`
   is HF4.

### B. The state manifest (BINDING)

This is the enumeration the round-trip diff runs over. **A field that exists in the running
game and is not on this manifest is a defect** — that is the whole point of a manifest: it
converts "did we forget something" from a judgement call into a set difference. The manifest
lives as data at `game/data/save-manifest.json` and the harness must be able to produce it
(`A-JRN3`).

| Group | Fields (non-exhaustive within group; the data file is authoritative) | Class |
|---|---|---|
| **Identity** | name, origin/race, birthsign-equivalent, profession, the stamped document text (`RI-JRN01` O10) | durable |
| **Character** | level, souls held, every attribute, every skill's current value **and its accumulated use-progress fraction**, health/stamina/magicka maxima and current, equip load | durable |
| **Inventory** | every item stack: id, count, condition/durability, enchantment charge, stolen-flag, **owner-of-record**, equipped slot, quick-slot assignment | durable |
| **Progression** | HEARTH shrines discovered, HEARTH last-rested, souls-spent history sufficient to reproduce the level curve, weapon upgrade levels and materials held | durable |
| **Quests** | per-quest: stage index, every quest-local flag, chosen branch, failed/severed status, giver disposition delta, time-limits remaining | durable |
| **Journal** | every entry: number, in-world date, text, quest id, **and the append order** — the journal is append-only and its indices are stable (`journal.entry.numbering`) | durable |
| **Dialogue** | `topicsKnown[]`, per-NPC disposition, per-NPC topics already exhausted, persuasion attempt history where it gates | durable |
| **Factions** | membership, rank, reputation, expulsion state and the path back, rivalry locks already tripped | durable |
| **Crime** | bounty per jurisdiction, witnesses alive/dead, stolen-goods registry, guards currently hunting, jail/fine history | durable |
| **World** | every container's contents (including *emptied*), every door's lock state and whether the player unlocked it, every dropped item's position, every hand-placed item taken, shortcut/ladder/gate unlocks, every named NPC's alive/dead status and position, every ordinary enemy's respawn-eligible flag (seam S5) | durable |
| **Death state** | bloodstain existence, position, soul quantity, and which death it belongs to (`RI-JRN06`) | durable |
| **Affliction** | diseases contracted, incubation timers, curses, active long-duration effects and their remaining duration | durable |
| **Travel** | which transport nodes have been physically visited (S7 requires you to have walked there once), Mark position if set | durable |
| **Clock** | in-world date/time, day count, any scheduled world event's countdown | durable |
| **Player pose** | position, yaw, region id, interior id, camera pitch/yaw/distance | durable |
| **RNG** | the seed **and the draw counter** — a load that resets the draw counter is a determinism break (`HARNESS.md` D5) | durable |
| **Meta** | schema version, build commit, harness version, save generation, digest | durable |
| **Declared volatile** | wall-clock `writtenAt`, playtime-seconds counter, screenshot thumbnail bytes, transient UI focus, audio bus levels, current frame index | **volatile** — excluded from the diff *by name*, declared in the manifest, and nothing else may be added to this list without an amendment to this item |

**What the wave-1 repair added to the manifest, and why each was a hole rather than a nicety.**
The manifest is a SPECIFICATION, not a description of the code (`How we lose` #7), so every row
below is stated as the requirement it always was:

| Group | Added | The requirement it restates |
|---|---|---|
| **Fight** *(new)* | the equipped loadout — weapon, shield, offhand configuration, two-handed, endurance, armour poise, HP ceiling, flask — and every combat body and controller, plus the animation rig's held pose and cross-fade | `sim/combat-bridge.js` makes the combat bodies the AUTHORITY and `sim.player` a view. §B's **Inventory** row has required `equipped slot` since wave 1 and nothing on the load path read it; §B's **Character** row requires the pools, and only the body has them. A save that carries the view and not the authority restores a picture of a fight. |
| **Traversal** *(new)* | breath, depth, band, submerged, the mire's progress/refractory/escape count, the fall apex, the slide accumulator | §B **Affliction**: "active long-duration effects and their remaining duration". Drowning is one. |
| **Player pose** | the whole camera rig — `pos`, `pivot`, the spring arm (`arm_len`/`arm_eased`/`arm_desired`/`arm_cast`/`clear_frames`), the containment integrators, the lock distance, the recentre gate, the look buffer, and last frame's projected anchors | §B **Player pose** already said "camera pitch/yaw/**distance**". `camera.dist` is an OUTPUT (`sim/camera.js` assigns `dist = armLen` at the bottom of every solve); the distance is `armLen`, and it had no writer. |
| **Crime** | `crime.ledger`'s fourteen real fields instead of one declared path | M4 is a set difference. One path against fourteen keys fails it in both directions on every state. |
| **World** | `world.npcs`, `world.props` and their record fields; the entity record's `lkp`, `last_seen_ago_frames`, `alert_channel`, `percept_dist_m`, `percept_los`, `encounter_id`, `encounter_role`, `encounter_leader`, `encounter_aggroed`, `encounter_hailed`; `world.capture` | §B **World**: "every named NPC's alive/dead status **and position**". A guard's last-known-position is what its whole search behaviour is driven from; `encounter_hailed` is a one-shot latch, so losing it hails the player twice. |
| **Identity** | `creation.powers`, `creation.drawbacks`, `creation.invariants`, `upbringing_given_as`, `class_family_fit` | §B **Identity**: "birthsign-equivalent". The two arrays are what every birthsign TERM is read out of; without them seam S27's Dry Well drawback is gone after every load. |
| **Progression** | `progression.gold`, `progression.sap_taint`, and the per-skill `levels_since_rest` / `rest_clamped` | §B **Character**: "every skill's current value **and its accumulated use-progress fraction**" — the per-rest cap is part of that accounting, and a reload that clears it re-grants the allowance. |
| **Character** | `carried_weight`, `burden_ratio` | §B **Character**: "equip load". |

**Rule V1.** The volatile list is closed. A field discovered to differ across a round trip
that is not on the volatile list is a defect, and moving it onto the volatile list to make a
test pass is **falsification** under `RI-MTH04`, not a fix.

### C. Canonical serialisation and the state hash

The diff is only meaningful if serialisation is deterministic. Binding:

1. Object keys sorted lexicographically at every depth.
2. Arrays whose order is semantic (journal entries, souls-spent history) keep their order and
   say so in the manifest; arrays whose order is incidental (entity lists, inventory) are
   **sorted by stable id** before serialising. `HARNESS.md` D7 already requires this ordering
   discipline inside the sim; the save inherits it.
3. Numbers: integers as integers; floats rounded to **6 decimal places** at serialisation and
   compared at that precision. A save that round-trips a position to a different float is a
   defect; a diff that fires on the 15th decimal place is a bad instrument. 6 dp = 1 µm.
4. No `undefined`, no `NaN`, no `Infinity`, no functions, no class instances that do not
   declare a `toJSON`. Any of these is a defect: it means state lives in a closure.
5. `getStateHash()` (`A-JRN3`) returns `sha256(canonicalise(saveState()))`. **The round-trip
   test is a comparison of two hashes**; the field-level diff is what you run when they differ.

### D. The five save scenarios (BINDING — these are the moments, not "a save")

Every one of these is a named harness scenario, and each exists because it is a place a naive
implementation loses a specific class of state.

| Id | Scenario | The state it exists to catch |
|---|---|---|
| **SV1** | **Mid-quest.** Three stages into a five-stage faction quest with a branch already taken, the giver's disposition raised, one topic learned from the giver, one quest-local flag set by an optional conversation. | Per-quest flags and branch memory. The classic loss: stage index survives, the *flag that recorded which way you branched* does not. |
| **SV2** | **Mid-dungeon.** Half-cleared Souls-loop dungeon: one shortcut opened, one fog gate passed, four ordinary enemies dead, one chest emptied, one door lockpicked, one ladder kicked down, HEARTH not yet rested at. | World mutation. The classic loss: the shortcut re-locks and the emptied chest refills, because the dungeon is rebuilt from its data file on load. |
| **SV3** | **Post-rank-up.** Within 60 s of a faction rank increase, with the rivalry lock it tripped, the new topics it unlocked, and the trainer it made available. | Derived state. The classic loss: rank is saved but the *consequences* of rank are recomputed wrongly, or the rivalry lock is not persisted because it was implemented as a runtime check. |
| **SV4** | **Bounty and pursuit.** Bounty ≥ 500 in one jurisdiction, 0 in another, two live witnesses, one witness killed, three stolen items in inventory, two guards in an active hunt state. | Crime state and the *identity of witnesses*. The classic loss: the bounty number survives; who saw you does not, so paying it off behaves differently after a load. |
| **SV5** | **Active journal + bloodstain + disease.** 40+ journal entries, a bloodstain from a death two rooms back holding 3,400 souls, a disease with 6 in-world hours of incubation left, an unread book in inventory, a Mark set. | The long tail. The classic loss: the bloodstain, because it is spawned by an event rather than stored as state. |

Each scenario is saved, loaded, **and then continued for 600 frames** — because a state that
loads and then diverges is a different and worse bug than one that fails to load.

### E. The corruption and hostility tests (BINDING)

| Id | Test | Required behaviour |
|---|---|---|
| **CR1** | **Tab closed mid-write.** Begin a save; kill the page context (`page.close()` / CDP `Page.crash`) at 25%, 50% and 75% of the measured p50 write duration. Reopen. | The slot loads at generation *n* or *n-1*. **Never** a partially-written state. Never an unreadable slot. |
| **CR2** | **Truncated blob.** Externally truncate the stored blob to 60% of its length. Load. | Digest mismatch detected, previous generation loaded, the event surfaced. **Silently loading a truncated save is a hard fail.** |
| **CR3** | **Flipped byte.** Flip one byte in the middle of the blob. Load. | Digest mismatch → same path as CR2. |
| **CR4** | **Schema version from the future.** Set `schemaVersion` to current+1. Load. | Refused with a legible in-fiction message; **no partial load**. |
| **CR5** | **Schema version from the past.** Load a save written by the previous schema version. | Either a declared migration runs and the result passes the full diff against a migration expectation file, or the save is refused. **A silent partial load — new fields defaulted, no notice — is a hard fail.** This is the most common real bug in shipped browser games. |
| **CR6** | **Quota exhausted.** Fill the origin to within 1 MB of quota, then save. | Oldest autosave evicted, retry succeeds, **or** a legible failure. Never a silent no-op. Never a corrupted slot. |
| **CR7** | **No durable storage.** Run in a context where `navigator.storage.persist()` returns false and IDB is ephemeral (private-window emulation, `A-JRN3` `simulateStorageFailure('ephemeral')`). | The game is playable, saves in memory, and the export affordance is present and visible on the save surface. |
| **CR8** | **IndexedDB entirely unavailable** (`simulateStorageFailure('no-idb')`). | Game boots and is playable. No unhandled rejection. No blank screen. Export path works. |
| **CR9** | **Two tabs.** Same origin, two tabs, both saving to the same slot. | Last writer wins by generation; **neither slot is corrupted**; the loser is informed. (Use an IDB-backed lock or `navigator.locks`.) |
| **CR10** | **Eviction between sessions.** Delete the IDB database out from under the game and reload. | Title screen shows no saves rather than an error state; the ≤ 1 KB `localStorage` pointer must not claim a save that no longer exists. |
| **CR11** | **Export → wipe → import.** Export `.eldersouls`, clear all origin storage, import. | Full diff empty against the pre-export hash. This is the recovery path and it must actually work. |
| **CR12** | **Import of a foreign/garbage file.** Import a PNG renamed to `.eldersouls`, and a valid save with a mangled digest. | Rejected with a legible reason. No partial application. No exception reaching the console. |

## Comparison method

Run by `critic.platform` (fleet critic **JC-05**, see `JOURNEY-CRITIC-FLEET.md`). Fully
instrumented; there is no naive pass, because a first-time user cannot see a state diff.

```bash
node tools/journey/journey-run.mjs --journey jrn05-saveload --seed 4711 \
     --scenario SV1,SV2,SV3,SV4,SV5 --corruption all \
     --out reports/journeys/<runId>
node tools/journey/state-diff.mjs --in reports/journeys/<runId>
```

**Three further instruments, named here so they are not phantom tools** (`orchestration/TOOL-LOOP.md`
rule 3). All three exist on disk; each declares what it measures and each exits non-zero when it
cannot measure it.

| Tool | What it does | Why the item needs it |
|---|---|---|
| `tools/journey/state-diff.mjs` | M1/M2/M4/M5 with **field-level** evidence, over a seed sweep and a state sweep, plus `getDurableFieldCensus()`. | A round trip compared as one hash is how a 219-frame divergence passed a verdict. |
| `tools/harness/save-break.mjs` | **The falsifier.** Monkey-patches the running build to DELETE one repair at a time — the camera settle order, the rig writers, the re-mirror, the birthsign terms, the ledger's manifest paths, the body grid, the animation rig's cross-fade state, the frame-stamp rebase — re-runs the round trip, and requires the named failure to come back. Then undoes the break and requires the repair to come back with it. | A repair whose deletion changes nothing was never a repair, and a repair whose deletion produces a *different* failure moved the defect rather than closing it. The tool critic's ruling: a self-test written by the same hand as the tool proves less than an independent falsification. |
| `tools/harness/save-consume.mjs` | **CONSUMPTION** (`ARBITRATION` §3, `RI-MTH07` §B). Perturbs a durable model to two well-separated values **plus the null control — the save not carrying it at all** — and observes a consequence a player could see: a cast the player presses being accepted or refused after a HEARTH rest (seam S27), a swing at a fixed standoff reaching the enemy or whiffing, the character drowning, the souls actually recovered from a restored bloodstain. | §CONSUMPTION rule 2: a harness return value is not an observable. The null control is the point of the exercise for a save item — if blanking the field out of the blob changes nothing, the save is writing a field nothing reads. |

Requires harness amendment **`A-JRN3`** (`saveState`/`loadState` promoted to **mandatory**,
plus `getStateHash()`, `getSaveManifest()`, `exportSave()`/`importSave()`, `getStorageInfo()`,
`simulateStorageFailure()`). Until it exists **every check below is `unmeasurable` and scores
0**, fail-closed (CRITIC-DOCTRINE §7.3, SCORING §1.1).

| # | Check | Procedure | Threshold |
|---|---|---|---|
| **M1** | **Round-trip hash** | For each of SV1–SV5: `h0 = getStateHash()`; `blob = saveState()`; `loadState(blob)`; `h1 = getStateHash()`. | `h0 === h1` for **5/5**. **Hard fail: any mismatch.** This is the item's headline measurement. |
| **M2** | **Round-trip field diff** | When M1 fails, run `state-diff.mjs` to produce the field-level diff, excluding only manifest-declared `volatile` fields. Also run it unconditionally to produce the artifact. | Diff is **empty**. Report the diff verbatim in the verdict; a non-empty diff is the evidence. |
| **M3** | **Cold-reload round trip** | Save, `page.close()`, fresh browser context, navigate, `Continue`, `getStateHash()`. | Equals `h0` for 5/5. *This is a different test from M1 and catches state held in module scope that survives `loadState` but not a reload.* |
| **M4** | **Manifest completeness** | Set-difference `getSaveManifest()` against the key set of `canonicalise(saveState())`, both directions. | **0** keys in the save that are not on the manifest; **0** manifest keys absent from the save. Either direction is a defect. |
| **M5** | **Divergence after load** | For each SV*: from the loaded state, run an identical 600-frame scripted input script against (a) the never-saved session and (b) the loaded session, both at the same seed. Compare `body_sha256` of the two traces. | **Identical** for 5/5. **Hard fail: any divergence** — it means the RNG draw counter or a derived cache was not restored. |
| **M6** | **World mutation survival (SV2)** | After load, assert from `listEntities()`/`getQuestState()`: shortcut still open, fog gate still passed, 4 enemies still dead, chest still empty, door still unlocked, ladder still down. | 6/6. Enumerated individually in the verdict, not as a pass/fail blob. |
| **M7** | **Bloodstain survival (SV5)** | After load, a bloodstain entity exists at the recorded position with the recorded soul count; recovering it yields exactly that many souls. | Exact. **Hard fail: souls recovered ≠ souls stored.** |
| **M8** | **Crime state survival (SV4)** | Bounty per jurisdiction exact; witness identities (not just count) exact; stolen-flags exact; guard hunt state exact. Then pay the bounty and assert the resulting state matches the never-saved control. | 4/4 + control match. |
| **M9** | **Journal integrity (SV5)** | Entry count, every entry number, every date, and the SHA-256 of the concatenated entry texts in order. | Exact. **Hard fail: any renumbering or reordering** (`journal.entry.numbering`). |
| **M10** | **Backend attestation** | `getStorageInfo().backend`; plus a CDP audit of `localStorage` contents and total bytes. | `backend === 'indexeddb'`. `localStorage` total ≤ **1024 bytes** and contains no state fields. **Hard fail: any save payload in `localStorage`.** |
| **M11** | **Atomicity under kill (CR1)** | 3 kill points × 5 scenarios = 15 runs. After each, reopen and hash. | 15/15 load at generation *n* or *n-1* with an empty diff against that generation's recorded hash. **Hard fail: any torn or unreadable slot.** |
| **M12** | **Corruption handling (CR2–CR5, CR12)** | Run each; capture the UI text and the console. | 5/5 detected and reported; **0** silent partial loads; **0** unhandled rejections. **Hard fail: a silent partial load.** |
| **M13** | **Hostile storage (CR6–CR10)** | Run each. | 5/5 remain playable with no silent data loss; **0** blank screens; **0** unhandled rejections. |
| **M14** | **Export/import recovery (CR11)** | Export, wipe origin storage, reimport, hash. | Empty diff. **Hard fail: absent export path** — this is the only eviction-proof store. |
| **M15** | **Write does not stall the sim** | `traceStart`, trigger a save, `stepFrames(300)`. From the trace: frames simulated, and per-frame sim time (`A-JRN5`). | **0** dropped sim frames; no sim step exceeding the `RI-PLT01` Tier-S budget. **Hard fail: a synchronous write on the sim thread.** |
| **M16** | **Size budget** | Save at a synthetic 200-quest-complete state (`--state endgame-200q`); measure canonical bytes and gzipped export bytes; measure total origin usage with 14 slots occupied. | ≤ 4 MB / ≤ 1.5 MB / ≤ 48 MB. |
| **M17** | **Slot list honesty** | With 3 slots written, delete one out of band; reload; screenshot the load surface. | The list shows exactly the slots that can actually be loaded. **Hard fail:** an offered slot that errors when chosen. |
| **M18** | **Autosave policy** | From a 20-minute scripted session, log every autosave: when it fired and what triggered it. | Autosave exists; fires on HEARTH rest, on quest-stage change, and on region transition; **never fires during `COMBAT`** (an autosave in a boss fight is a frame-time spike at the worst possible moment — `RI-PLT01`) and never overwrites a manual slot. |
| **M19** | **Second-death bloodstain rule** | Save with a bloodstain; load; die again; assert the first bloodstain is gone and the new one holds the new souls (`RI-JRN06`, seam: Souls owns this). | Exact. Cross-checked against `RI-JRN06` M-D7 — if the two items ever disagree, `RI-JRN06` wins on semantics and this item wins on persistence. |

### CONSUMPTION (`RI-MTH07` / `ARBITRATION` §3) — *(ADDED wave 1, `BAR-CRITIQUE-W1-07-R1` §R4)*

`ARBITRATION` §3's CONSUMPTION check reached the **critics** through the doctrine and reached
**none of the fourteen items** judging the opening, character creation or the journeys — measured
at this pass, `grep -cE 'RI-MTH07|CONSUMPTION|world-side consumer'` returned **0** for every one of
`RI-JRN01`–`RI-JRN08`, `RI-CHR01`–`RI-CHR03`, `RI-PRG02`, `RI-PRG03` and `RI-EXP01`. Which models
must be enumerated, and what a zero costs, are properties of the item and not of a critic's
diligence. For this item:

1. **Enumerate exhaustively** every model this journey requires to act — every table, graph,
   binding map, budget and record it publishes that the running game must read — and list it in
   the verdict. A sample is not an enumeration.
2. **Perturb and observe** per `RI-MTH07` §B: two well-separated values, everything else held
   fixed, plus the null control. For a **journey** the admissible observable is what the player
   could see or do — a drawn string, a rendered object, a surface that appears, an input that is
   accepted or refused, a state that survives. **A harness return value is not an observable**;
   `RI-MTH07` §B1 rules the trace an observer, not a consumer.
3. **Apply the consequence.** Any `coupling == 0` scores **that dimension 0**, fail-closed, and
   appears in the piece's `status_reasons`. There is no `partial`.
4. **The fourth shape.** `RI-MTH07` §A names orphan model, orphan data and orphan predicate.
   `corpus/88-journeys/` produced a fourth — **orphan text**: a string authored, computed
   correctly, carried through the model, exposed through the harness, and never drawn. From the
   player's chair it is identical to a string that was never written. See `RI-JRN09`
   `ES-LEGIBLE/1`.

## Scoring

Native scale: **0–100**, weighted, plus hard fails that cap the item at **2** regardless.

Because correctness here is binary, the weights are deliberately lumpy: the round trip is
worth more than everything else combined.

| Block | Weight | Checks |
|---|---|---|
| **The round trip** | **40** | M1 (20), M2 (5), M3 (10), M5 (5) |
| **Completeness of state** | 20 | M4 (6), M6 (4), M7 (3), M8 (3), M9 (4) |
| **Durability under hostility** | 22 | M11 (8), M12 (6), M13 (4), M14 (4) |
| **Backend discipline** | 10 | M10 (6), M16 (2), M17 (2) |
| **Behaviour** | 8 | M15 (4), M18 (3), M19 (1) |

| Native | Band | Ladder ceiling |
|---|---|---|
| 100 | Meets the bar | 8 |
| 90–99 | Below bar — named remedy required | 6 |
| 60–89 | Recognisably attempting it | 5 |
| < 60 | **We lose** | 4 |

**Note the unusual band boundary: only a perfect score meets the bar.** Every other item in
the corpus tolerates a near miss. This one does not, because a save system that is 97% correct
loses one player's forty-hour character, and that player does not care about the other 97%.

**Hard fails (any one caps the item at 2 and sets `status: FAIL`):**

- **HF1** — Any round-trip hash mismatch (M1), or any post-load trace divergence (M5).
- **HF2** — A torn, partial, or unreadable slot after a kill-during-write (M11).
- **HF3** — A silent partial load: schema mismatch, truncation, or corruption that produces a
  playable-but-wrong state with no notice (M12, CR5).
- **HF4** — Save payload in `localStorage`, or `backend !== 'indexeddb'` without a declared and
  measured degradation path (M10).
- **HF5** — No export/import path (M14).
- **HF6** — Souls recovered from a restored bloodstain ≠ souls stored (M7).
- **HF7** — Journal entries renumbered or reordered by a round trip (M9).
- **HF8** — A synchronous save on the simulation thread, or any dropped sim frame during a
  write (M15).
- **HF9** — An offered save slot that cannot be loaded (M17).

## How we lose

Written pessimistically, in advance, so a critic can tick them off.

1. **`JSON.stringify(gameState)` into `localStorage`.** It is four lines, it works on day one
   with three quests, and it dies at quest ninety with a `QuotaExceededError` thrown from
   inside a `setItem` that has already half-replaced the previous save. This is the single
   most likely implementation and it is HF4 plus HF2 at once.
2. **The world is rebuilt from its data file on load.** Position, level and quest stages are
   saved because they are obviously "player state"; the emptied chest, the opened shortcut and
   the four dead enemies are not, because they live in the scene rather than in a state object.
   SV2 exists solely to catch this and it will catch it.
3. **The bloodstain is an event, not a state.** It is spawned when you die and nobody ever
   asked what happens to it when you quit. The player loses 3,400 souls to a reload and
   correctly concludes the game is broken.
4. **Disposition is saved; who you talked to is not.** Topics already exhausted, persuasion
   attempts already spent, and the specific NPCs who witnessed a crime are all runtime sets.
   They serialise as `[object Set]` or as nothing.
5. **The RNG draw counter is not saved.** Everything loads correctly and then the *next* 600
   frames differ from the control run, because the PRNG restarted. M5 catches it; nothing a
   player does catches it until a boss behaves differently after a reload.
6. **Float drift.** Position round-trips through a JSON float and comes back 1e-13 different,
   which is fine — until it is a value used in an integer comparison and the player is now
   inside a wall. The 6-dp canonicalisation rule exists because the alternative is a diff that
   nobody can read.
7. **The manifest is written after the code.** Somebody enumerates the fields by reading the
   save object, so the manifest is a description of the bug rather than a specification of the
   requirement. M4 is a set-difference in *both* directions precisely to make that useless.
8. **A field is quietly moved to `volatile` to make the diff pass.** This is the failure mode
   the item is most vulnerable to, and it is falsification under `RI-MTH04`, not a fix.
9. **Migration is deferred.** Schema v2 ships, v1 saves load with the new fields defaulted, and
   half the world state is silently wrong. Nobody notices, because nothing crashes. CR5.
10. **Autosave during a boss fight.** A 1.5 MB serialisation on the main thread at the exact
    moment the player is reading a telegraph. `RI-PLT01`'s "no frame over 33 ms in combat" and
    this item's M18 both fire, and the player just calls it lag.
11. **Private browsing is never tested.** The whole thing works perfectly and then a reviewer
    opens it in a Firefox private window, plays for an hour, and loses everything with no
    warning. CR7 exists because this is a *reputational* failure, not just a technical one.
12. **Export is "wave 3".** It is genuinely the least fun thing on this list to build, it is the
    only thing that survives eviction, and it is the first thing cut.
13. **Two tabs.** The player opens a second tab to read something, the first tab autosaves over
    the second tab's progress, and both slots end up describing different worlds. CR9.
14. **The diff is run once, by hand, on a fresh character.** A save system passes trivially at
    minute five and fails at hour forty. Every scenario in §D is deliberately *late-game state*
    for that reason; running M1 on a new game and calling it green is the easiest false pass in
    this item.

## Provenance note

- **`constructed`, confidence high, and binding** — the entire item. The storage ruling in §A,
  the write protocol, the state manifest in §B, the canonicalisation rules in §C, the five
  scenarios in §D, the twelve corruption tests in §E, every threshold and every weight. No
  upstream reference exists for "how a browser game should persist a Morrowind-depth world
  state", so we defined one we can measure (CORPUS-CONTRACT §3).
- **The platform facts underpinning the §A ruling are `canonical-recall`, confidence high**:
  that `localStorage` is synchronous, string-only and practically capped around 5 MB per
  origin; that IndexedDB provides atomic multi-store transactions and asynchronous access;
  that `navigator.storage.persist()`/`estimate()` exist; that Firefox private windows provide
  an in-memory IndexedDB and Safari private mode a restricted ephemeral one; that a download
  requires a user gesture and cannot be read back. These are well-established web-platform
  behaviours, not measurements taken here. **Any threshold that depends on a specific browser's
  quota number is deliberately absent from this item** — the budgets in §A are set by our own
  payload size, not by a quota we would have to guess.
- **Owned elsewhere, cited not restated:** bloodstain semantics and the second-death rule →
  `RI-JRN06`. Journal numbering → `journal.entry.numbering` / `RI-DLG05`. Quest stage and flag
  semantics → `RI-QST04`. Faction rank and rivalry → `RI-QST03`. Seam S5 (what respawns) and
  seam S6 (death preserves quest/journal/faction state) → `ARBITRATION.md`. Sim-thread frame
  budget → `RI-PLT01`. Warm-load time vs cold TTFP → `RI-PLT03`.
- **Harness dependency.** Every check requires **`A-JRN3`**; M15 additionally requires
  **`A-JRN5`** (per-frame sim timing); M11 requires the runner to be able to kill a page
  context mid-transaction. Until they land this item is **unmeasurable** and scores **0**,
  fail-closed. The full amendment request is in `JOURNEY-CRITIC-FLEET.md` §7.
