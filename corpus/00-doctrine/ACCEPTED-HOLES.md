# ACCEPTED HOLES — subsystem paths deliberately left unjudged

`CORPUS-CONTRACT` §4: *"A subsystem with zero judging items is a **corpus hole** — the builder must
not start until the hole is filled."*

A hole is filled in one of two ways: a reference item judges the path, or **the hole is accepted in
writing, here**. This file is the register of the second kind. It is append-only.

---

## Current state

| Wave | Subsystem paths | Holes | Accepted holes |
|---|---:|---:|---:|
| wave 0, after the `holes` task | 323 | **0** | **0** |

**There are currently no accepted holes.** All 323 canonical subsystem paths are judged by at least
one reference item. The fourteen holes open at the start of the `holes` task were all closed with
**option (a)** — a reference item — and none was accepted:

| Path | Closed by |
|---|---|
| `world.water.marsh` | `RI-WLD10` |
| `world.hazard.environment` | `RI-WLD11` (also `RI-WLD10`) |
| `world.region.transition` | `RI-WLD12` |
| `world.interior.continuity` | `RI-WLD13` |
| `world.strangeness.architecture` | `RI-WLD14` |
| `combat.dodge.recovery` | `RI-CMB09` |
| `combat.stamina.exhaustion` | `RI-CMB09` |
| `combat.status.buildup` | `RI-CMB10` |
| `combat.input.latency` | `RI-CMB11` |
| `progression.affliction.economy` | `RI-PRG09` |
| `quests.resolution.exclusive` | `RI-QST09` |
| `quests.state.persistence` | `RI-QST09` |
| `lore.canon.argonian` | `RI-LOR07` |
| `lore.canon.geography` | `RI-LOR07` |

Verify with `node tools/corpus-index.mjs --strict` (exit 0 means zero holes).

---

## How to accept a hole

Accepting a hole is a real decision with a real cost and it is **not** a way to avoid writing an
item. It is legitimate in exactly one situation: **the path is genuinely covered by another item
under a different name**, and the taxonomy entry is a synonym rather than a subject. In that case the
correct fix is usually an **alias** in `subsystems.json`, not an entry here — so an accepted hole
should be rare enough that this file stays short.

It is **never** legitimate for anything load-bearing. Precedent from the `holes` task: the brief
stated that `world.water.marsh` — the water model, in a province named for a marsh — *"is not
acceptable as an accepted hole"*, and it was not accepted.

To accept one, append a section with **all six** fields:

```markdown
### `<subsystem.path>`

- **Accepted:** wave <n>, by <task-id / agent / person>
- **Why no bar is needed:** …
- **What already covers it, if anything:** <RI-ids, and what they judge that overlaps>
- **Risk of not judging it:** the specific thing that could ship wrong and go undetected
- **What would make this a real hole again:** the condition under which this acceptance expires
- **Reviewed at:** the wave by which this must be re-examined
```

An acceptance with no stated risk is not an acceptance; it is a shrug, and a critic finding one MUST
reject it and reopen the hole.

---

## Register

*(empty)*
