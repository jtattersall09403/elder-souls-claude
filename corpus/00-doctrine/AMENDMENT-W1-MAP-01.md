# AMENDMENT-W1-MAP-01 — `RI-UIX04` JU8 loses its existence clause and keeps everything else

**Filed by:** wave-1 piece W1-MAP (the discovery map), builder.
**Status:** proposed, and **mandated** — `ARBITRATION.md` seam **S35** says of itself:
*"`RI-UIX04` JU8 must be amended rather than worked around; whoever builds this owns the
amendment."* This is that amendment. It is filed by the builder and graded by somebody else.

**Scope, stated first because the scope is the whole argument.** This amendment changes
**one clause in one scoring row and one sentence in one comparison method.** It lowers no
threshold, deletes no prohibition, and softens no hard fail. Every marker prohibition in
`RI-UIX04` §B survives verbatim, including the one — **Q7** — that this amendment is
popularly assumed to be repealing. It is not repealing Q7. Q7 does not say what the scoring
row says.

---

## §1 — What actually happened, in one paragraph

`RI-UIX04` JU8 reads **"No map anywhere (Q7) | `map` unreachable **and non-existent** | a map
exists"**. Seam **S30** upheld that reading and made it doctrine: *"there is no map, because
there is nowhere to put a pin"*. On 2026-08-07 the project's owner overruled S30 and replaced it
with **S35**, on an argument that is short and correct on this project's own terms: a map is
world, a map is outside combat, and outside the fight Morrowind wins — and **Morrowind ships a
map and ships no quest markers, in the same game**, so the existence of the surface was never
what forbade the pin. S30 banned the room to stop the furniture. Under `ARBITRATION.md` §5 a
seam ruling outranks an item's comparison method, so JU8 is now in conflict with a live seam and
one of the two has to move. The seam names which.

## §2 — Q7 is not the clause being amended, and the distinction is load-bearing

This is the part a reader is most likely to get wrong, so it is set out as a table.

| Where the prohibition lives | Exact text | Status under this amendment |
|---|---|---|
| §B **Q7** | *"Any map, minimap, or map page **in or reachable from the journal**"* | **UNCHANGED.** Still a hard fail. Still triggers AR-2. |
| §B **Q8** | *"Location names rendered as links that reveal a position"* | **UNCHANGED.** |
| §A **J8** | *"It must **not** open a map, a location, or a marker"* | **UNCHANGED.** |
| §C method 6 | *"assert a marked proper noun's activation changes `mode` to `dialogue`/`topic` and **never** to `map`, and emits no `worldAnchor`"* | **UNCHANGED.** |
| §C method 7, sentence 1 | *"From `mode == 'journal'`, enumerate every reachable mode via `getUIState().navigable`; assert `map` is not among them."* | **UNCHANGED.** |
| §C method 7, sentence 2 | *"Then assert globally that no `openMenu` name resolves to a map screen — **the map must not exist at all**."* | **AMENDED — §3 below.** |
| Scoring **JU8** | *"`map` unreachable **and non-existent**" / hard fail: **"a map exists"**"* | **AMENDED — §3 below.** |
| "How we lose", bullet 4 | *"JU8 checks reachability *and* existence, and **the existence half is the one that matters**"* | **AMENDED — §3 below.** |

**Q7 as written is a statement about the journal.** Read it again: *in or reachable from the
journal*. It has always been a prohibition on a **route**, not on a **surface**. The surface
prohibition was never in §B at all — it entered the item through the scoring row's parenthetical
*"(Q7)"*, which cites a clause that does not contain it, and through one sentence of method 7.
S30 then quoted the scoring row rather than the prohibition and built a doctrine on it.

So the honest correction is small: **strike the existence half, keep the route half.** Under this
amendment the journal still cannot reach the map, and cannot link to it, and cannot reveal a
position through a topic — every word of that is retained and is still a hard fail. What is no
longer a hard fail is a map screen existing somewhere else in the interface.

## §3 — The amended text

### 3a. Scoring row JU8

Replace:

> | JU8 | No map anywhere (Q7) | `map` unreachable and non-existent | a map exists |

with:

> | JU8 | **The journal cannot reach the map, and the map cannot carry a marker (Q7, Q8, J8; ARBITRATION S35)** | `map` is absent from `getUIState().navigable` in `mode == 'journal'` **and** from `navigable` in `mode == 'map'`; **and** the map screen declares no element of a forbidden kind, no element bearing a quest, objective, giver, target or rumour identity, no line, route or path element, no distance or direction text, and no travel affordance; **and** no place is drawn that the player has not personally stood in | **any** of: `map` reachable from the journal in either direction; a "show on map" affordance in an entry, a topic or a dialogue option; **any API by which a quest can place, request, highlight or name a position on the map**; a drawn route; a distance or bearing readout; travel by selecting a place; a square for a place the player has not stood in; terrain rendered where the player has not been |

Note what this does to the item's difficulty. The old JU8 was a single boolean and one grep away
from passing. The new JU8 is **nine assertions, seven of them hard fails**, and it is materially
harder to pass than the clause it replaces. This amendment does not make the item easier. That is
deliberate: S35's own words are *"the map is defined by what it refuses"*, and a scoring row that
merely notes the map's existence measures nothing about the refusals.

### 3b. Comparison method 7

Replace the second sentence of method 7 with:

> Then, **from every mode**, assert that no `openMenu` name and no argument to `openMenu`
> resolves to a marker, a pin, a highlight or a named position — the map screen must accept no
> parameter that names a place. Enumerate the discovery model's own mutating methods and assert
> that **every one of them has arity 0** (`fn.length === 0`), so that there exists no call by
> which any caller — a quest, a hook, a dialogue effect or a topic — could name a location to
> reveal. Then attempt it: call the plausible mutators by name, pass a place id, pass a
> coordinate, mutate the collections directly, and add a method to the instance. Record each
> attempt and its failure. **An implementation that passes this by convention rather than by
> construction fails it**: the check is that the call does not exist, not that nobody makes it.

### 3c. "How we lose", bullet 4

Replace:

> **The map appears somewhere else and the journal links to it.** … JU8 checks reachability
> *and* existence, and the existence half is the one that matters …

with:

> **The map appears somewhere else and the journal links to it.** The journal itself stays
> clean, so JU3 passes; a "show on map" affordance leaks S8 through a screen this item does not
> own. This is still the failure, and after S35 it is the *only* one of the two that was ever
> real. **The map now exists, so the discipline moves from the surface to the API**: the
> question is no longer "is there a map" but "**is there a function a quest could call**". A map
> with no marker API and a journal with no link to it is compliant; a map with a
> `revealLocation(id)` that nothing currently calls is not, because the next quest author will
> find it and the check that catches them will be a code review rather than a number.

### 3d. One sentence added to the §B table, as a new row

> | Q13 | **Any API, effect, hook, flag or data field by which a quest, dialogue, topic or journal entry can place, request, highlight, name or reveal a position on the map** | the marker, arriving through the back door; **S8 / ARBITRATION S35** |

This is not a new prohibition. It is S35's *"any icon a quest can place, request or highlight"*
written into the item that will be graded against it, so that a critic scoring `RI-UIX04` has the
clause in front of them rather than having to reach for the seam. **It is a hard fail like every
other §B row.**

## §4 — Why the amendment is not "the builder moving its own bar"

Two prior amendments in this project were rejected as unearned, and the standard set by
`AMENDMENT-W1-15-01` is that an amendment must be checkable by arithmetic or by reading rather
than by agreeing with a preference. This one is checkable by reading, in three steps, and a
critic can reject it by doing the same reading:

1. **Read §B Q7.** It says *"in or reachable from the journal"*. It does not say a map may not
   exist. If it did, this amendment would be asking to delete a prohibition and should be
   refused.
2. **Read `ARBITRATION.md` §5.** A seam ruling outranks an item's comparison method. S35 is a
   seam ruling and it is live.
3. **Read S35's last sentence.** *"`RI-UIX04` JU8 must be amended rather than worked around;
   whoever builds this owns the amendment."* The instruction to file this document is in the
   ruling itself.

**What this amendment does NOT ask for**, stated as plainly as the precedent does:

- **No prohibition is deleted.** Q1–Q12 all stand. Q13 is added.
- **No hard fail is softened.** JU8 goes from one hard-fail condition to seven.
- **AR-2 is untouched.** A Q7 hit still triggers it. So does a Q13 hit.
- **S8 is untouched and is not re-litigated.** S35 is explicit: *"S8 still bans the marker, and
  it now has a surface to be banned from rather than an absent one."*
- **The compass and the chart-book are not withdrawn.** S30 proposed both as replacements for
  the map; S35 keeps them *alongside* it. `RI-UIX02` §F is not amended and `shore-compass` and
  `pilots-chart-book` remain items with weight in the inventory. Wayfinding must still work with
  the map closed — a map showing only where you have already been cannot get you anywhere new,
  which is why the signposts (`game/data/world/signposts.json`) are load-bearing and not
  decoration.
- **`RI-UIX01` §B's forbidden element kinds are not touched.** `map`, `map_pin`, `minimap`,
  `compass`, `quest_marker`, `waypoint` and `objective_tracker` remain in
  `ui/surface.js FORBIDDEN_KINDS` and the build emits none of them. The map screen's elements
  are declared under **new** kinds (`map_terrain`, `map_place`, `map_player`), so a census that
  greps for the forbidden names still reads **0** after this amendment, exactly as it did
  before. An implementation that had to widen the forbidden list to draw its map would be
  telling on itself.

## §5 — What was built against the amended clause

Recorded here rather than in the reply, because the amendment should be readable next to the
thing it authorised.

- `game/src/sim/discovery.js` — the discovery model, in the fixed step. **Its only mutator
  takes no arguments.** `observe()` has `length === 0` and reads the player object captured at
  construction; there is no overload, no coordinate form and no place-id form. This is the
  §3b assertion made structural: a caller cannot name a place to reveal because the parameter
  in which it would name one does not exist. The instance is frozen, its collections are
  `#private` class fields, and every reader returns a copy.
- `game/data/ui/map.json` — the reveal radius, the place radii and the palette, as **data** with
  a `how_to_disagree` field, per the precedent set by `game/data/stealth/detection.json`. Set
  the radius to 0 and the map shows one cell; the probe reads the difference.
- `game/src/ui/screens/map.js` — the screen, drawn from `game/data/world/terrain.json`,
  `regions.json` and `pois.json` rather than from an authored image, so the map cannot drift
  from the province. Move a site in the world data and the square moves on the map; the probe
  perturbs exactly that.
- `game/src/ui/system.js` — `map` enters `MODES` and `OPENABLE`; `open('minimap')` and
  `open('worldmap')` still throw, because those are HUD furniture and not this screen.
  `navigable()` **never puts `journal` and `map` adjacent in either direction**, which is
  §3a's first assertion.
- `tools/harness/map-probe.mjs` — the consumption evidence (`RI-MTH07`) and the hostile
  quest-marker attempt required by §3b, each attempt recorded with the error it produced.

---

## Appendix — the one thing a critic should try first

Open the game, walk nowhere, open the map. If it shows you the province, this amendment has been
implemented as a repeal rather than as a narrowing, and JU8 should be failed on its first
assertion. **Undiscovered is unrendered.** A new character's map is nearly all empty ground, and
that is not a loading state.
