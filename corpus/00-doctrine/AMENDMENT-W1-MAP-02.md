# AMENDMENT-W1-MAP-02 — the map's fog of war is struck. The geography is always drawn; the places are still earned.

**Filed by:** W1-MAP-DEFECTS, on the project owner's instruction of 2026-08-14, given after playing
the deployed build.
**Status:** proposed and **applied**, under `CLAUDE.md` rule 0 (decide, record, proceed) and
`ARBITRATION.md` §5 (an owner ruling outranks an item's comparison method). **Reversible** — §6
names the evidence that would overturn it.
**Amends:** `AMENDMENT-W1-MAP-01` §3a (one clause of the amended JU8) and the `map.json`
`undiscovered_why` note. Everything else in W1-MAP-01, and every prohibition in `RI-UIX04` §B,
survives verbatim.

---

## §1 — The owner's words, which are the whole argument

> *"Morrowind doesn't have it. The main world map displays the full geography of Vvardenfell right
> away, but markers and locations remain hidden until you discover them. As with everything outside
> of combat in this game, we should be matching Morrowind."*

Two clauses, and they pull in opposite directions on purpose:

1. **The geography is not a reward.** Coastline, rivers, the shape of the land, which region is
   which — all of it is on the paper from the first minute, because that is what a map *is* in
   Morrowind and this project's settling rule is that outside the fight, Morrowind wins.
2. **The places still are.** A town, a ruin, a camp you have not found does not appear. That is the
   half that keeps discovery in the game, and it is the half a careless reading of clause 1 deletes.

## §2 — This is a correction, not a new preference. The corpus already said so.

`RI-WLD06` §5 ("What is banned (S8 enforcement)") lists, among the things whose appearance is an
**AR-2 Morrowind-leakage violation that fails the piece outright**:

> no minimap, no auto-path, **no fog-of-war reveal-on-approach**, no glowing outline …

and, in the same paragraph, permits the surface itself:

> A world map item may exist (paper, static, hand-drawn, **no player dot** — or a player dot only
> while standing still and only at settlements, if a later item rules that way).

**Paper, static, hand-drawn.** A sheet of paper does not fill in as you walk. The build shipped
`if (!m.seen(cx, rz)) continue;` in `game/src/ui/screens/map.js` — reveal-on-approach, drawn cell by
cell as the body moves — which is the banned thing, arrived at honestly from a different clause
(W1-MAP-01 §3a's "terrain rendered where the player has not been"). Two items disagreed and nobody
had noticed. The owner's instruction settles it in `RI-WLD06`'s favour.

## §3 — The amended text

### 3a. `AMENDMENT-W1-MAP-01` §3a, scoring row JU8

**Strike one hard-fail condition and one pass condition, and nothing else.**

| Clause | Old | New |
|---|---|---|
| pass condition | "…**and** no place is drawn that the player has not personally stood in" | **UNCHANGED.** Still the pass condition. Still the point. |
| hard fail | "…a square for a place the player has not stood in; **terrain rendered where the player has not been**" | **the trailing clause is struck.** Terrain is drawn everywhere, always. "a square for a place the player has not stood in" remains a hard fail, unchanged. |

Every other clause of JU8 — no forbidden element kind, no quest/objective/giver/target/rumour
identity, no line, route or path, no distance or direction text, no travel affordance, the journal
unreachable in both directions — is untouched and still a hard fail.

### 3b. The appendix test of `AMENDMENT-W1-MAP-01` is **inverted**, not deleted

W1-MAP-01's appendix reads: *"Open the game, walk nowhere, open the map. If it shows you the
province, this amendment has been implemented as a repeal."* Under this amendment the test keeps its
place as the first thing a critic runs, and keeps its teeth, but it now reads:

> **Open the game, walk nowhere, open the map.** You must see the whole province — coast, rivers,
> region colour, the shape of the land. You must see **zero place squares**. A build that shows you
> a single settlement you have not stood in has implemented this amendment as the deletion of
> discovery, and JU8 fails on its first assertion.

That second sentence is the null control, and it is the plausible wrong answer rather than the
trivial one: "reveal the geography *and* every marker with it" looks like a working map in a
screenshot and quietly removes finding places from the game. `tools/harness/map-probe.mjs` S12 is
that assertion (`drawn_cells === total_cells_in_view && places_drawn === 0`), and
`tools/map/fog-control.mjs` is the sabotage that must redden it.

### 3c. `game/data/ui/map.json`

`draw.undiscovered_hex` stays — it is still the colour behind the province while the raster is
loading and outside the province rectangle — but `undiscovered_why` is rewritten to say what it now
means. `reveal.min_m` / `reveal.max_m` keep their meaning **for the discovery model**, which still
records where the body has been: the footprint is what the save carries, what `places` is derived
from, and what makes a forged save inert (W1-MAP-01 §5). It simply no longer decides what the
terrain layer paints.

## §4 — The tension this creates, named, because it is real

`RI-WLD06` is built on the premise that you navigate by **landmark sightlines, signposts and prose
directions**, and it pays for markerlessness three times over. A map that showed every road would
undercut all three: you would follow the line instead of the ridge, and the eighteen region-scale
landmarks and every signposted junction would become decoration.

**So the road stays off the map.** `game/data/world/roads.json` is not imported by
`game/src/ui/screens/map.js` and must never be; S35's "no route, path, trail or line of any kind"
is untouched by this amendment and is asserted every run (`map-probe` S4, and `routes_drawn` on the
terrain element itself). What the player now gets from the map is **orientation** — which way the
coast runs, where the salt hills rise, which river they are standing on — and that is exactly what
Morrowind's own paper map gives you. It tells you where things *are* in the shape of the land; it
does not tell you how to walk there, and it will not name a place you have not found.

Stated as a rule a critic can apply: **the map may show the world. It may not show the way.**

## §5 — What was changed in the build

- `game/src/ui/screens/map.js` — the terrain loop no longer consults `m.seen(cx, rz)`. The whole
  raster inside the drawing box is painted, in both the province and the local view. The place
  loop is **untouched**: it still iterates `m.places`, which is the discovery model's own list.
- `game/src/ui/system.js` — `_mapModel` stops handing the screen a `seen` closure it no longer
  reads, and `state().map` gains `geography_always_drawn` and `cells_in_view` so the new rule is a
  number a probe reads rather than a claim in a comment. `revealed_cells` and `places_discovered`
  keep their old meanings and are still reported, so a probe written against W1-MAP-01 gets a
  changed answer instead of `undefined`.
- `tools/harness/map-probe.mjs` — S8, S12 and C1b are rewritten to assert the NEW rule. C1 is
  unchanged: the reveal radius still drives the discovery model, and that model still has to be
  consumed.
- `tools/map/fog-control.mjs` — the null control. It reveals every place in `pois.json` on the map
  and requires S12 to go red.

## §6 — What would overturn this, and how to reverse it

**Reversal is one line.** Restore `if (!m.seen(cx, rz)) continue;` in the terrain loop of
`game/src/ui/screens/map.js` and revert the three assertions in `map-probe.mjs`. Nothing else in the
build depends on the change; the discovery model, the save format and the place list are untouched.

**Evidence that would overturn it:**

1. **A navigation measurement.** `RI-WLD06` M29 (the fresh-agent navigation test, pass ≥9/10) run
   twice — once with the map available and once without. If the always-visible geography lets an
   agent reach destinations it could not reach from the journal prose alone, the map has become the
   navigation layer and RI-WLD06's three paid-for layers are dead weight. That is the failure this
   amendment risks, and M29 is the instrument that would show it.
2. **A ruling that the LOCAL view is Morrowind's cell map.** Morrowind's *local* map genuinely does
   fog, and this amendment removes the fog from both of our views. It does so because our local view
   is a 500 m zoom of the same province raster rather than a separate interior artifact — fogging it
   would be fogging the world map at a different scale. An arbiter or the owner ruling that the
   local view should behave as Morrowind's cell map would overturn §5's "in both views" and nothing
   else.
3. **A Morrowind map reference.** This build was written **without one**. The project holds 24
   Morrowind world images and Dark Souls interface references and **no image of Morrowind's own
   map**; a sibling piece is acquiring interface references. If that reference lands and shows
   something this amendment gets wrong — most likely about how much of the coast and river network
   is drawn, or about whether unfound settlements are marked but unnamed rather than absent — the
   reference wins.
