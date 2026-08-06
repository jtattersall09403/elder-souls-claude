---
id: RI-VIS05
title: Art direction — the Morrowind visual language and its Black Marsh transposition
kind: image
side: morrowind
judges: [visual.artdirection.palette, visual.artdirection.silhouette, visual.artdirection.architecture, visual.artdirection.flora, visual.artdirection.creature, visual.artdirection.composition, visual.artdirection.materials, visual.artdirection.ui]
provenance: canonical-recall
confidence: medium
blind_pair: yes
---

> **SIDE DECLARATION: this item is `morrowind`.**
> Cited **only** under `JUDGEMENT SIDE: ART_DIRECTION` (RI-VIS01 §B).
> **This item REFUSES modern-fidelity references.** No Elden Ring, Skyrim SE, RDR2 or Unreal
> screenshot may be introduced into a judgement citing this file, and **no metric from
> RI-VIS03 may be used to pass or fail anything here** — those measure how well a frame is
> rendered, this measures what world it is a frame of. Equally: **nothing in this file
> excuses a fidelity failure.** If a critic finds itself writing "the palette is muted so the
> flatness is fine", it has triggered CC-3 and its verdict is void. Muted is a hue statement.
> Flat is a shading statement. They are not the same claim and they are not judged together.
>
> 2002 screenshots are **legitimate and primary** references here.

## The bar

A player who has never heard of this project, shown a still frame with no UI, must be unable
to name any existing fantasy setting and must be able to describe the place: *hot, wet,
ancient, organic, not built by people like us*. That is what Morrowind achieved in 2002 and
it is the only thing about Morrowind we are inheriting.

The mechanism is specific and reproducible. Morrowind's art direction is not "weird for the
sake of it" — it is a chain of consequences: **the environment produces the materials, the
materials produce the architecture, the architecture produces the silhouette, and the palette
is what the materials actually are.** Vvardenfell is volcanic ash and giant insects, so
Redoran build with chitin shells and everything is ash-grey and ochre. Telvanni grow towers
from fungus, so their skyline is bulbous and root-footed. Nobody quarried a grey rectangular
block, so there is no grey rectangular block anywhere in the game.

~~Black Marsh is standing water, rot, root and the Hist. Therefore: nothing is quarried, most
things are grown or accreted, everything is wet, the light is filtered through canopy or
comes from inside living things~~ …

> **AMENDED wave 0 (rebase-s22), ARBITRATION seam **S24** — this paragraph was the root of the
> chain and it was wrong, so everything downstream of it inherited the error.** **Black Marsh is
> the *name*, not the terrain.** `corpus/50-world/black-marsh-map-source.jpg` and
> `corpus/50-world/regions.json` define **thirteen** regions, and standing water is a property of
> **some** of them: the Clay Moor has *"no standing water"* at all, Valus Ridge is mountain rock
> with cloud *below* the player, the Stone Wastes are arid, the Stone Forest is petrified, the
> Salt Hills are the only cold place in Argonia. `RI-WLD10` §7 puts it numerically — **five
> regions have a tide, eight do not, and two have a water-class index of exactly 0.00.**
> "Everything is wet" is precisely the assumption S24 exists to forbid.

**The mechanism is right; only its input was over-generalised.** Restated per-region, which is
how the rest of this item must be read:

| Chain step | Wetland regions (Rootlands, Deep Marshes, Thornmarsh, Blackwood, the coasts) | Dry and high regions (Valus Ridge, Stone Wastes, Stone Forest, Clay Moor, Salt Hills) |
|---|---|---|
| The environment | standing water, rot, root, canopy | rock, fired clay, salt, petrified wood, altitude |
| Therefore the materials | grown, accreted, lashed, wet | quarried-by-nature, split, kiln-fired, rimed, mineralised |
| Therefore the light | filtered through canopy, or from inside living things | open sky, hard shadow, heat shimmer, cloud below the path |
| Therefore the surface | wet, glossy below a flood line | dry, matte, dust- and salt-crusted |

What is province-wide and survives unchanged: **nothing is quarried by *people*** (no dressed
ashlar anywhere — the Stone Forest's stone is petrified wood, not masonry), the xanmeer is the
one built thing and it is older than everyone, and every asset must trace back up its own
region's chain. Our bar is that a critic can *check* that trace **against the region the shot is
declared in**.

> **S24 SWEEP — AMENDED wave 0 (rebase-s22).** This item was swept against ARBITRATION seam
> **S24** ("the marsh is not all marsh"), which makes
> `corpus/50-world/black-marsh-map-source.jpg` and `corpus/50-world/regions.json` binding on art
> direction. Five corrections were made and are marked inline: the opening derivation chain's
> "everything is wet" premise (§Bar), §C's seven-region palette scope, §D1's three wetland plant
> families (a fourth, XERIC/MINERAL, is added), §D4's wet-glossy fauna rule, §F's blanket ban on
> pines and mountains (which contradicted Valus Ridge outright), and §G's "standing water —
> everywhere" row. **Six region palettes are named as an open gap rather than invented here.**

## The reference artifact

### §A — The Morrowind source language (what we are transposing FROM)

Five properties. These are the ones that transpose; the rest of Morrowind's look is
Vvardenfell-specific and must **not** be copied (we are not making a volcano game).

**A1. Palette: muted, hot-dry, three-family.** Vvardenfell runs on ash-grey and dust-ochre
as the ground state, jade/emerald as the *accent* (glass, Telvanni glow, kwama), and a narrow
band of violet-brown in shadow. Saturation is low across most of the frame, with a small
number of high-chroma accent pixels. Crucially the accents are **wrong colours for their
objects** — the sky at dusk is not orange but a sickly pale green-gold, plant growth is
purple-brown rather than green, water is jade not blue.
→ *transposes as:* the principle (low mean chroma, few high-chroma accents, accents in
unexpected hues), **not** the specific ash-ochre hues.

**A2. Architecture from local material.** Three simultaneous vocabularies, each internally
consistent and mutually alien: Redoran build from the moulded shells of giant native insects
— "organic curves and undecorated exteriors", domed and ribbed, the whole village reading as
a cluster of carapaces on the ground. Telvanni **grow** their towers: "a fantastic organic
form grown and sculpted from stems, caps, and root-like holdfasts of the giant native
mushrooms", with smaller hollowed pods for commoners. Velothi/Temple build stepped, angular,
ancient stone that predates both.
→ *transposes as:* three vocabularies (grown / accreted / ancient-stone), the rule that each
is derived from a local material, and the rule that they never blend.

**A3. Total absence of generic-fantasy stonework.** There is no castle. No portcullis, no
crenellation, no half-timbered inn, no cobbled square, no grey rectangular ashlar block, no
gothic arch, no thatched roof. Not "few" — **none**. This is the single most important and
most fragile property, and the one that decays first as a team reaches for familiar assets.
→ *transposes as:* an explicit forbidden-forms list (§F) that is checked per asset.

**A4. Flora is fungal and wrong.** Vvardenfell's plants are not scaled-up Earth plants. They
are fungal, bulbous, sometimes ambulatory, coloured wrongly, and sized wrongly — tree-sized
mushrooms, knee-high pods that hiss, kelp-like growths on dry land. The player's first
reaction to a plant should be *what is that*, not *that's a fern*.
→ *transposes as:* the wrongness rule (§D3), retargeted from fungus-in-ash to
fungus-and-mangrove hybrid in water.

**A5. Silhouettes are bulbous, ribbed, asymmetric — never orthogonal.** Almost no right
angles outside Imperial forts (which are deliberately alien *because* they are rectangular —
the Empire is the foreign thing). Curves are compound; forms swell and taper; roofs are
domes and caps rather than pitched planes.
→ *transposes as:* the silhouette vocabulary (§E), with the deliberate inversion that in
Black Marsh **the ancient xanmeer stone IS orthogonal**, and that is what makes it alien.

**References for §A:**
- <https://en.uesp.net/wiki/Morrowind:Concept_Art> — the original concept sheets for both
  Telvanni fungal towers and Redoran forms.
- <https://en.uesp.net/wiki/Lore:Great_Houses_of_Morrowind> — the House architectural
  descriptions quoted above.
- <https://en.uesp.net/wiki/Morrowind:Velothi_Towers> — the ancient-stone vocabulary.
- <https://danjb.com/morrowind/morrowind_today/3_graphics/architecture> — a per-style
  architectural walkthrough with 2002 screenshots. **This is a legitimate fidelity-free
  reference: use it for form only.**

### §B — The transposition table (Vvardenfell → Black Marsh)

| Morrowind element | Black Marsh equivalent | Rule preserved |
|---|---|---|
| Redoran chitin shell domes | **Naga-built chitin accretion** — hives and halls built from the moulded plates of giant marsh arthropods, lashed with resin and gut-cord | architecture from the local animal |
| Telvanni grown mushroom towers | **Hist-wood organic architecture** — dwellings grown from and *within* living root masses; a Hist-village is a single organism with rooms | architecture grown, not built |
| Velothi/Temple ancient stepped stone | **Xanmeer ziggurats** — stepped stone pyramids of a lost technique, "built in such a way that they could stand for millennia", carved with reptilian heads "stylized with right angles", now half-swallowed by the marsh | ancient stone predating everyone |
| Imperial forts (alien-by-rectangle) | **Imperial half-sunken villas and decaying prisons** — the Empire's failed attempt at permanence, rotting and subsiding | the foreign thing that does not belong and is *losing* |
| Ash storms | **Rain squalls, spore blooms, and the swamp-gas haze** | weather as a hostile environmental character |
| Silt strider | **Hist-network / hollowed root-barge travel** | in-fiction transport (ARBITRATION S7) |
| Ash-grey + ochre ground state | **Silt-olive + drowned-black ground state** | low-chroma ground, few accents |
| Jade/emerald glass accent | **Bioluminescence** — cyan/violet fungus, amber Hist sap | high-chroma accent in unexpected hues |
| Kwama, netch, cliff racer | **Wamasu, hackwing, voriplasm, giant leeches, swamp-jelly** | fauna that could not exist on Earth |
| Fungal flora | **Mangrove/cypress/fungal hybrids** — buttress roots that are also stalks, gills under the canopy, aerial roots that fruit | flora that is wrong at a glance |

**Sources for the Black Marsh column:** <https://en.uesp.net/wiki/Lore:Xanmeer> ·
<https://en.uesp.net/wiki/Lore:Black_Marsh> · <https://en.uesp.net/wiki/Lore:Argonian> ·
<https://www.imperial-library.info/content/black-marsh> (Improved Emperor's Guide to
Tamriel: Black Marsh). Search-confirmed detail used above: xanmeers as pre-Duskfall stone
ziggurats built to stand for millennia, whose technique is lost; carvings of reptilian heads
stylised with right angles; the Empire managing "no more than half-sunken villas and decaying
prisons"; the Hist as "great life-giving trees of unknown capacities" and the earliest
inhabitants.

### §C — Region palette specification (BINDING; hex values are the spec)

> **⚠ S24 COVERAGE DEFECT — AMENDED wave 0 (rebase-s22). This section specifies palettes for
> SEVEN regions that are not the corpus's regions, and it is the single largest S24 failure in
> the visual area.** `corpus/50-world/regions.json` owns regional identity and defines
> **thirteen** regions, each with its own `palette_hex`; **not one of R1–R7's names appears in
> it**. Worse, the seven that were invented are *all* wetland, canopy or ruin: there is **no
> palette here for the mountains of Valus Ridge, the arid Stone Wastes, the petrified Stone
> Forest, the dry Clay Moor, the red Crimson Coast or the Salt Hills.** A build that
> implemented exactly this section would ship a world that is entirely swamp with a recoloured
> fog — which S24 names, verbatim, as a failed implementation.
>
> **This sweep is a prose-and-scope correction and does NOT invent six palettes**; authoring
> seven-slot colour specifications for six regions is `RI-VIS05`'s own work, not a coherence
> sweep's, and inventing hex values here would be exactly the "manufactured edit" the standing
> rules forbid. What is corrected is the **claim of coverage**:
>
> 1. `regions.json` is the **owner** of the region list and of each region's `palette_hex`
>    triple. This table is an *expansion* of it — the same relationship `RI-AUD03` §B already
>    has, correctly, with the same file.
> 2. The seven rows below are hereby scoped as **region-type palettes for wetland, sub-surface,
>    ruin, coast, deep-swamp, Hist-interior and Morrowind-seam material**, not as the world's
>    region list. Each must be mapped onto the named thirteen, and the six dry/high regions need
>    palettes of their own before this section can be called complete.
> 3. **`RI-WLD04`'s blind test is the enforcement** (≥33/39 region identifications from
>    unlabelled screenshots, every region pair differing on ≥6 of 9 axes). A palette set that
>    covers seven of thirteen regions cannot pass it, and a critic must record that rather than
>    scoring the seven that exist.
>
> **Open, and named as the gap this section owes:** six palettes — Valus Ridge, Stone Wastes,
> Stone Forest, Clay Moor, Crimson Coast, Salt Hills. `regions.json` already carries a
> three-colour `palette_hex` and a one-line `only_here` for each; they are the seed.

Seven **region types**, not seven regions (see the S24 note above). Each has seven slots. **These are the sRGB hex values of the *albedo* the
player should perceive after lighting and grading** — not raw texture values. A critic
samples the screenshot; a builder aims the whole pipeline at it.

Slot meanings: `SHADOW` deepest occluded value · `GROUND_MID` dominant terrain ·
`GROUND_LIGHT` sunlit terrain · `ORGANIC` dominant vegetation/flesh · `STRUCTURE` built
surfaces · `EMISSIVE` the accent, the only high-chroma family · `FOG` atmospheric/distance.

| Region | SHADOW | GROUND_MID | GROUND_LIGHT | ORGANIC | STRUCTURE | EMISSIVE | FOG |
|---|---|---|---|---|---|---|---|
| **R1 Hixinoct Fen** (brackish shallow fen; start region) | `#1C2018` | `#3F4630` | `#7A7A52` | `#5E6B38` | `#6B6353` | `#B8E0A0` | `#97A08A` |
| **R2 The Rootways** (root-tunnels beneath the fen) | `#0E0C12` | `#2A2230` | `#4A3F4E` | `#3B2E2A` | `#33313D` | `#7CE0E8` / `#C77CE8` | `#241E2C` |
| **R3 Xal-Meeru** (xanmeer ziggurat complex) | `#1E211F` | `#6A745E` | `#A9AF90` | `#4C5A3E` | `#8E9377` | `#D8C070` | `#B3B49E` |
| **R4 The Chitin Reach** (naga coast, arthropod hives) | `#1A1512` | `#554636` | `#9E7A4A` | `#7A4C22` | `#C9A46A` / `#D9CFC0` | `#F2C24A` | `#8E8C86` |
| **R5 Blackrot Mire** (deep hostile swamp) | `#0B0F0D` | `#232B24` | `#3C4436` | `#2E3A2C` | `#1F2622` | `#86F06A` | `#4A5348` |
| **R6 Hist Grove** (sap-lit interior of a living Hist) | `#14100A` | `#2E2318` | `#5A452C` | `#3A2C1C` | `#6B5330` | `#F0B24E` | `#6E5A3A` |
| **R7 Ashen Coast** (northern Deshaan border; the Morrowind seam) | `#201C18` | `#5C544A` | `#948872` | `#6E6248` | `#7E7466` | `#E06A3A` | `#B0A490` |

Design notes a builder must honour:
- **Chroma budget.** In any frame, ≤ 8% of non-sky pixels may exceed CIELAB `C* = 45`, and
  those pixels must belong to the region's `EMISSIVE` family. High chroma is a *light source*
  in this world, never a surface. (This is an art-direction rule about *where* saturation
  lives; it is not RI-VIS03 M3, which is a fidelity rule about whether the range exists.)
- **The green trap.** R1/R5 are the danger. Real swamps photograph as green-brown; generic
  fantasy swamps are `#4CAF50` grass over `#8B4513` mud. Our fen is **olive-to-silt**, hue
  rotated toward yellow (60–80°) and away from pure green (120°), and the *wet* surfaces
  desaturate toward grey rather than deepening toward green.
- **Hue relationships, not just hues.** R2's identity is `warm-black wood` against
  `cold-cyan light` — a ~150° hue separation. R6 is the inverse: cold-black bark against warm
  amber. R4 is the only region with a near-monochrome warm ramp, which is why the nacre
  highlight `#D9CFC0` matters so much there.
- **Water is not blue anywhere *there is water*.** R1 water tends `#3A4438`, R5 water tends
  `#12160F` (near black, high absorption), R3 water tends `#5C6659`. A blue water tint anywhere
  outside a deliberate sky reflection is an art-direction defect.
  *(AMENDED wave 0 (rebase-s22), S24: the rule is about hue, not about ubiquity. Several regions
  have no standing water to tint — the Clay Moor has none by specification — and a shot from one
  of those is not exempt from anything, it simply has no water pixels. Do not read this row as
  licence to put a water plane in every region so the rule has something to bind to.)*
- **The two seas are different water and must look it.** `regions.json` and `RI-WLD10` §7 put
  **Topal Bay** on the west and the **Padomaic Ocean** on the east. Two open-water bodies with a
  shared shader and a shared colour is an S24 defect of exactly the kind the tide table forbids.
- **The red littoral.** The **Crimson Coast** is named for its colour, which no swatch in this
  table can produce: every `GROUND_*` slot here is olive, silt, bone or ash. It is the clearest
  single demonstration that this table does not yet cover the world.
- **R7 is a deliberate seam** with Morrowind proper and is the only region permitted the
  ash-grey/ochre family. It exists so the player can *feel* the border. It must be < 6% of
  the world by area or the seam becomes the identity.

**Sky/atmosphere palette (shared, drives §12 sky model and fog colour):**

| Time | Zenith | Horizon | Sun/Moon disc | Fog tint |
|---|---|---|---|---|
| Dawn | `#4A5464` | `#C8A87E` | `#F5D9A8` | `#A99A86` |
| Noon (overcast — the default) | `#8E9AA0` | `#B6BCB4` | `#E8E4D4` | `#A8AFA4` |
| Dusk | `#33404C` | `#B08A5E` | `#E8B070` | `#8A8272` |
| Night | `#0A1018` | `#1C2630` | `#BFD0D8` | `#182028` |
| Spore-bloom (weather event) | `#5E5236` | `#9E8C4E` | `#D8C476` | `#8E8250` |

**Forbidden palette anchors (any of these dominating a frame is an art-direction failure):**
`#4CAF50` saturated grass-green · `#8B4513` saddle-brown mud · `#87CEEB` picture-book sky
blue · `#808080` neutral quarried stone grey · `#2E5B8C` "fantasy water" blue ·
`#8B0000`/`#C0A000` heraldic red/gold · pure `#FFFFFF` and pure `#000000` as surface albedo.

**Self-consistency check (computed, not asserted).** Every declared swatch above was checked
against every forbidden anchor with ΔE2000 (CIELAB, D65) before this file was committed. The
requirement is that **no declared swatch sits within ΔE2000 ≤ 13 of any forbidden anchor** —
otherwise the palette would fail its own `ForbiddenHits` test. Three swatches failed this on
first authoring and were corrected in place: R3 `GROUND_MID` (was `#6E7268`, ΔE 8.8 from
`#808080` — inside the forbidden radius), R3 `STRUCTURE` (was `#8A8C78`, ΔE 10.4), and R4
`GROUND_MID` (was `#5A4230`, ΔE 14.4 from `#8B4513` — passing but uncomfortably tight). The
committed values are R3 `#6A745E` (ΔE 13.4), R3 `#8E9377` (ΔE 13.9), R4 `#554636` (ΔE 17.2).
Tightest remaining separations, for the record: R1 `ORGANIC #5E6B38` vs `#4CAF50` = 24.7;
R1 `GROUND_LIGHT #7A7A52` vs `#4CAF50` = 22.4; R1 `FOG #97A08A` vs `#87CEEB` = 26.3.
This check is re-runnable and must be re-run after any palette amendment:
`node corpus/80-methods/palette-selfcheck.mjs`.

### §D — Flora and fauna specification

**D1. The three plant families** (every plant asset must belong to exactly one, and hybrids
between two families are the good ones):
- **MANGROVE/CYPRESS** — buttressed, stilted, above-water root cages you can walk inside;
  bark black and wet at the base, grey-checked and dry above the flood line; canopy high and
  thin so light comes down in shafts.
- **FUNGAL** — bracket shelves the size of doors growing off trunks; stalked caps at every
  scale from ankle to tower; gills underneath that catch light; flesh rather than wood.
- **AQUATIC/PARASITIC** — floating mats, duckweed skin, hanging moss curtains, air-plants
  and creeper-fruit on the mangroves, tube-worms in the mud.
- **XERIC/MINERAL** — **added wave 0 (rebase-s22), ARBITRATION seam S24.** Thorn-scrub and
  stunted thorn-pine on cliff-lichen (Valus Ridge); whatever survives fired clay (the Clay
  Moor); salt-tolerant rime-grass (the Salt Hills); and the **petrified** growth of the Stone
  Forest, which is not a plant at all any more and must not be lit or shaded as one. Signature
  is the inverse of the other three families: **dry-matte, no subsurface, no wet-line, deep
  normal relief, growth following drainage and shade rather than standing water.**

> **AMENDED wave 0 (rebase-s22), S24.** As written, "every plant asset must belong to exactly
> one" of three **wetland** families made five of the thirteen regions unbuildable — there is no
> legal family for a thorn-pine, a rime-grass or a petrified trunk. The fourth family closes
> that. The `D2` hybrid rule and the `D3` wrongness test apply to it unchanged, and its best
> hybrids cross the seam: a bracket fungus that fruits *stone*, a thorn-pine whose needles are
> chitin.

**D2. The hybrids are the identity.** A cypress whose buttress roots have *gills*. A mushroom
the size of a tree with *bark*. A floating mat that is one organism with a fruiting body. A
thorn-pine that grows *downward* out of an overhang because the cloud layer is below it.
Rule: **at least one plant in every exterior shot must be inexplicable as an Earth plant** —
**in every region, which is the harder half of the rule and the one the dry regions make you
earn** (S24).

**D3. The wrongness test (per asset):** name the Earth plant it resembles. If you can name
one without qualification, the asset fails. Correct answers are of the form "a cypress, but
the roots are gills and it fruits underwater".

**D4. Fauna silhouette rules:** no horses, no wolves, no bears, no dragons, no orcs, no
elves-in-armour. Fauna reads as **arthropod, reptile, or amphibian**, and moves wrongly (too
many joints, or too few). **Wet-glossy and translucent is a *wetland* signature, not a
province-wide one** *(AMENDED wave 0 (rebase-s22), S24)*: `regions.json` puts hackwing eyries,
wamasu and **mountain chitin-hounds** on Valus Ridge, where the correct read is dry, dust-matte
and cold-weathered. A translucent swamp-jelly finish on a ridge animal is the fauna-shaped form
of "everything is swamp with a recoloured fog". The **naga** are
the humanoid apex: heavier, longer-tailed and lower-slung than Argonians, crested, with a
silhouette that reads as *not-a-person* at 50 m — this is the readability bar in VIS08 §D.

### §E — Silhouette vocabulary (the shape grammar)

A critic checks silhouettes by thresholding the frame against the sky (RI-VIS03's `SKY_MASK`,
borrowed as a *tool* only, not as a fidelity judgement) and reading the outline.

| Vocabulary | Belongs to | Reads as | Forbidden neighbours |
|---|---|---|---|
| **Stepped orthogonal** | Xanmeer (R3) | hard horizontal terraces, right angles, a truncated pyramid; **the only right angles in the world** | must never carry a pitched roof, a round tower, or a crenellation |
| **Grown bulbous** | Hist architecture (R6) | swelling and tapering masses, no repeated module, openings that are apertures not doorways | never symmetric, never on a plinth |
| **Root cage** | Rootways (R2), mangroves | interlocking arches at many scales; negative space is the readable feature | never a colonnade (no repeated identical supports) |
| **Chitin accretion** | Naga (R4) | overlapping curved plates, ribbed, insect-segmented, ridged spines | never plank-and-beam, never mortared |
| **Stilted lashed** | fen villages (R1) | thin verticals in water, sagging horizontals, platforms at multiple heights | never a straight street, never a rectangular window |
| **Dry-stacked and wind-cut** *(added wave 0 (rebase-s22), S24)* | Valus Ridge, Stone Wastes, Salt Hills | vertical rock flutes and spires, Imperial border cairns, Ayleid watchtowers standing free against sky rather than sunk in canopy; **silhouettes read against open sky, not against foliage** | never mortared, never lived-in, never snow-capped |
| **Subsiding rectangle** | Imperial ruins (R1/R3) | a familiar rectangular form **tilted, sunk and broken** — familiar shape, failed | must never be intact; an upright Imperial building is a defect |

**Silhouette density rule:** every exterior shot must contain at least one silhouette from a
vocabulary the player has not seen in a generic fantasy game — i.e. at least one of stepped
orthogonal / grown bulbous / root cage / chitin accretion must break the skyline.

### §F — Forbidden forms (the anti-generic list; checked per asset, no exceptions)

Castles · crenellations · portcullises · drawbridges · pitched shingle or thatch roofs ·
half-timbering · cobbled streets · gothic or romanesque arches · quarried rectangular ashlar
· heraldic banners and shields · anvil-and-forge blacksmith stalls · tavern signs ·
torch-sconce-on-stone-wall · knights in plate · wizard-with-pointy-hat · standard longsword/
kite-shield silhouettes · elves, dwarves, orcs as visual archetypes · "ye olde" signage ·
brick · glazed multi-pane windows · wagon-wheel-and-hay-bale set dressing · ~~pine forests ·
mountains with snow caps~~ **generic conifer forest · the Skyrim/Tolkien snow-capped peak**.

> **AMENDED wave 0 (rebase-s22), ARBITRATION seam S24 — two entries on this list contradicted
> the map and had to be narrowed.** `regions.json` gives **Valus Ridge** *"stunted thorn-pine,
> hanging moss curtains, cliff-lichen"* and *"cold rain, cloud BELOW the player on high paths"*,
> and gives the **Salt Hills** *"the only cold place in Argonia, and it is cold at night"*
> (`RI-WLD11` §7). A blanket ban on pines and on mountains would have made two of the thirteen
> binding regions unbuildable — the list was written from the same "the world is all swamp"
> premise this item's opening paragraph carried.
>
> **What is actually forbidden is the *generic* form, not the landform.** Valus Ridge's pines are
> stunted, moss-curtained and thorn-bearing, growing out of limestone flutes that hum a chord
> audible from 400 m; that is not a pine forest, it is a mountain that could not be anywhere
> else. A repeating dark-green conifer cone-mass, or a white triangular peak on the horizon
> because fantasy games have those, remains a hard fail. The test is `RI-VIS07`'s, unchanged:
> if the honest answer to "what is this" is *"a pine forest"* or *"a snowy mountain"*, it fails;
> if it is *"some kind of cold thorn-scrub on humming rock"*, it passes.

Any one of these appearing in a shot is an **art-direction hard fail for that shot**,
regardless of how well rendered it is. (Deliberate exception: the *subsiding* Imperial ruin
vocabulary may use rectangular masonry precisely because it is broken, foreign and losing —
it must be visibly failing in every instance.)

### §G — Materials list (what things are actually made of)

| Material | Where | Visual signature |
|---|---|---|
| Wet black hardwood | mangrove base, root-tunnels, boardwalks | near-black albedo, high gloss below the flood line, hard wet-line above it |
| Dry grey-checked bark | trunks above flood line | mid-grey, deep normal relief, matte |
| Hist heartwood | R6 interiors | warm brown, translucent at thin edges (subsurface), sap beading at cuts |
| Chitin plate | naga structures, armour, fauna | amber-brown, semi-translucent at edges, anisotropic sheen along the ridge direction |
| Nacre / shell inner | naga ornament, tools | pale iridescent, hue-shifting with view angle |
| Xanmeer stone | R3 | pale bone-green-grey, extremely fine carved relief, lichen in the recesses only |
| Lichen and creeper | everything old | high-frequency mottling that follows AO — it grows where it is damp and shaded |
| Silt and mud | fen floor | low-chroma olive-brown, wet-specular in sheets, footprint-deformable |
| Standing water | **the wetland regions only** ~~everywhere~~ *(AMENDED wave 0 (rebase-s22), S24: eight of thirteen regions have no tide and two have no standing water at all — `RI-WLD10` §7 owns the per-region water-class table)* | see §C water notes: never blue; near-mirror at grazing, near-black downward |
| Fired and cracked clay | the Clay Moor | low-chroma warm ochre, polygonal crack network, **heat-shimmer above live kilns**; dry-matte, the exact inverse of the wet-line material above it |
| Bare rock and cliff-lichen | Valus Ridge, the Stone Wastes | pale grey-buff, high normal relief, lichen only in shade; **no wet-gloss anywhere** |
| Petrified wood | the Stone Forest | mineral grain — wood *figure* in stone response; no bark relief, no give, rings visible as colour banding |
| Salt crust and rime | the Salt Hills | white-to-grey efflorescence following drainage lines; the only place in Argonia where breath fogs |
| Fungal flesh | all FUNGAL flora | matte, slightly translucent, no specular, bruises darker where damaged |
| Woven reed and gut-cord | fen village lashings | fibrous, directional, frays |
| Bone and horn | fetishes, tools | dry, chalky, warm-neutral |
| Corroded Imperial iron | ruins | rust-through, orange bloom on grey, structurally failing |

**No polished metal armour anywhere.** No plate steel, no chainmail, no mirror-finish. Metal
in Black Marsh is Imperial, corroded, and out of place.

### §H — UI and iconography (P09)

Morrowind's UI is parchment-and-ink with a Daedric-script motif and does not resemble a modern
game HUD. Ours: **incised glyph forms on a wet-wood/bone ground**, an Argonian-glyph
(Jel-derived) motif for headers and quest markers-that-aren't, no minimap, no compass, no
floating objective markers (ARBITRATION S8), no health bar rendered as a rounded rectangle
with a gradient. Icons are carved or scrimshawed, never flat-vector. Type is a slab/incised
face, never a generic fantasy blackletter and never a modern geometric sans.

## Comparison method

1. Emit the RI-VIS01 §B declaration with `JUDGEMENT SIDE: ART_DIRECTION` and properties from
   the `P*` column only. **Do not open RI-VIS02, RI-VIS03 or RI-VIS04 during this pass.**
2. **Palette conformance (computed).** For each capture, with the region declared by the
   shot name:
   ```
   swatches = the 7 slots of that region (EMISSIVE and FOG excluded from the target set)
   for each non-sky pixel p:  d(p) = min over swatches s of deltaE2000(Lab(p), Lab(s))
   PaletteConformance = |{ p : d(p) <= 18 }| / |FG_MASK|
   ChromaBudget       = |{ p in FG_MASK : C*(p) > 45 }| / |FG_MASK|
   EmissiveAlignment  = fraction of those high-chroma pixels within deltaE2000 <= 25 of the
                        region's EMISSIVE swatch(es)
   ForbiddenHits      = |{ p : min deltaE2000 to any FORBIDDEN anchor (§C) <= 10 }| / |FG_MASK|
   HueHistogram       = 36-bin chroma-weighted hue histogram (as RI-VIS03 M3, reused as a
                        tool; the *thresholds* here are art-direction thresholds, not M3's)
   ```
   Implemented in `corpus/80-methods/palette-conformance.mjs`, same PNG pipeline as
   `vis-metrics.mjs`, ΔE2000 in CIELAB D65.

   | Quantity | Pass | Fail |
   |---|---|---|
   | `PaletteConformance` | ≥ 0.70 | < 0.45 |
   | `ChromaBudget` | ≤ 0.08 | > 0.15 |
   | `EmissiveAlignment` | ≥ 0.75 | < 0.50 |
   | `ForbiddenHits` | ≤ 0.02 | > 0.06 → **hard fail** |

   Note honestly: palette conformance measured on a *final graded frame* is affected by
   lighting. The metric therefore has a companion **albedo capture** — the harness renders
   the same pose with a flat white light, no fog, no tonemapping, and the conformance test is
   run on **that** buffer, with the graded frame checked only for `ChromaBudget` and
   `ForbiddenHits`. Without the albedo capture, conformance is reported `advisory only`.
3. **Silhouette audit (manual, evidenced).** For each exterior capture: threshold against sky,
   list every distinct silhouette breaking the skyline, and assign each to a §E vocabulary or
   to `UNASSIGNED`. Record the count. **≥ 1 must be from the four "not generic" vocabularies**
   or the shot fails the silhouette-density rule.
4. **Forbidden-form sweep (§F).** Scan every capture for every listed form. Any hit is
   recorded with a pixel region and is a hard fail for that shot.
5. **Wrongness sweep (§D3).** For every distinct plant asset visible, write the sentence "it
   is an X, but Y". A plant for which no "but Y" exists fails. Report the ratio of plants with
   a "but" to total distinct plants; **≥ 0.6 required**, and ≥ 1 inexplicable plant per
   exterior shot.
6. **Material trace (§A chain).** Pick three assets at random from the capture set. For each,
   write the chain: *environment → material → structure → silhouette*. An asset whose chain
   cannot be written (i.e. it exists because it looked cool, or because it was in a free asset
   pack) fails. This is the check that catches assets sourced from generic-fantasy libraries.
7. **The Skyrim test (RI-VIS07).** Run it. It is the outer backstop and its result overrides
   a passing score here.
8. **Blind pass (RI-VIS06 §B).** Ours vs a Morrowind 2002 screenshot, unlabeled, with the
   judge asked *which of these two worlds is stranger and less like an existing fantasy
   setting* — a question a 2002 screenshot can win on and which is immune to fidelity.

## Scoring

Six components, each 0–10, reported individually; the ART score is their **minimum**, not
their mean (a single generic element poisons a frame more than five good ones redeem it).

| Component | 10 | 5 | 0 |
|---|---|---|---|
| **Palette** | conformance ≥ 0.85, chroma budget honoured, emissives aligned | conformance ~0.6, some drift toward green-brown | conformance < 0.45, or `ForbiddenHits > 0.06` |
| **Silhouette** | ≥ 3 non-generic vocabularies visible across the capture set, none `UNASSIGNED` | 1 non-generic vocabulary, several `UNASSIGNED` | skyline is describable as "a fantasy village" |
| **Architecture** | all three vocabularies present, none blended, xanmeer's orthogonality reads as alien | one vocabulary implemented, others stubbed | any §F forbidden form present |
| **Flora** | wrongness ratio ≥ 0.8, hybrids present, three families visible | ratio ~0.5, plants readable as Earth plants | foliage is generic broadleaf/fern/pine |
| **Creature** | naga readable as not-a-person at 50 m, fauna arthropod/reptile/amphibian | some fauna generic | humanoid fantasy races present as archetypes |
| **Mood/alienness** | RI-VIS07 answers are all "don't know / somewhere weird" | mixed answers | any judge says "Skyrim" or "generic fantasy" |

**Failure threshold: ART < 6 blocks the wave** (RI-VIS01 §E, `min(ART, FIDELITY) ≥ 6`).
**Hard fails, independent of score:** any §F forbidden form present · `ForbiddenHits > 0.06`
· RI-VIS07 returning "Skyrim" or "generic fantasy" · any modern-fidelity reference cited in
this pass (CC-2).

**What "we lose" looks like:** a fen of green ferns under a blue sky, with a stone tower that
has a wooden door and a pitched roof, and a village of rectangular huts on a straight muddy
street. Every asset individually defensible; the whole thing indistinguishable from forty
other games. Palette conformance 0.31, ForbiddenHits 0.11, silhouette audit returns
"UNASSIGNED ×7", Skyrim test returns "Skyrim, the marsh bit near Morthal". ART = 0.

**Native → ladder anchors — the row mandated by `SCORING.md` §1.2 (BAR-CRITIQUE-01 W7).**
Added wave-1-prep to close BAR-CRITIQUE-02 **C1**; derived from this item's own bands above.
**No threshold in this item was changed.**

| Ladder | 4 | 6 | 8 |
|---|---|---|---|
| Native | 4 / 10 on the worst component | 6 / 10 on the worst component | 8 / 10 on the worst component |

**Aggregation (a property of this item, not of the critic):** min over the six components, never the mean.

## How we lose

- **The green trap.** Someone tints the terrain green because swamps are green, and the whole
  world collapses into `#4CAF50` over `#8B4513`. This is the most likely single failure in
  this file and the palette table exists specifically to prevent it. Detection is one number
  (`ForbiddenHits`).
- **The thirteen-tints-of-one-swamp trap** *(added wave 0 (rebase-s22), ARBITRATION seam S24)*.
  The subtler sibling of the green trap, and the one this item was *itself* set up to fall into
  before the S24 sweep: the palette is per-region, the fog is per-region, the ground texture is
  not, and thirteen genuinely different places — mountain, arid rock, jungle, petrified forest,
  fired clay, red littoral, salt hills, two seas — ship as one wetland with the hue rotated.
  `ForbiddenHits` will not catch it, because none of the tints is forbidden. **`RI-WLD04`'s
  blind region-identification test is the only instrument that does** (≥33/39 from unlabelled
  screenshots, ≥6 of 9 axes differing per pair), and a critic must run it before scoring this
  item's palette conformance, not after.
- **Asset-pack drift.** A free "fantasy village pack" gets used for the fen settlement
  because modelling stilted lashed platforms is slow. Every hut has a pitched roof. §F catches
  it; the temptation to grant an exception "just for the blockout" is what actually kills us,
  because blockouts become final.
- **One vocabulary implemented, three claimed.** Xanmeer geometry is easy (it's boxes), so R3
  gets built and R2/R4/R6 stay as grey tunnels. The world reads as one idea. Guard: the
  silhouette audit counts vocabularies across the *capture set*, not per shot.
- **Bioluminescence as a lighting effect instead of an identity.** Someone adds a cyan
  `PointLight` and calls the Rootways done. The identity is *emissive organisms with
  structure* — gills that glow along their edges, sap that pools and glows in the pool. A
  glowing sphere is not an art direction.
- **Blue water.** Every engine's default water is blue and every shader tutorial is blue.
  Ours is olive, jade-black or near-black, and it will drift blue every single time anyone
  touches the water shader. Put the hex values in the shader as named constants.
- **Argonians as green lizard-men.** The visual cliché is right there and it is exactly the
  generic answer. Ours are regional, feathered/frilled/spined by region, and the naga read as
  a different order of creature entirely, not "a bigger lizard-man".
- **Fidelity work laundered as art work.** A wave adds SSAO and bloom and the art score rises
  because the frame "looks better". It didn't; it looks better-*rendered*. The ART pass must
  be run on the same captures without any reference to whether the render improved. This is
  the reverse contamination of CC-3 and it is CC-4.
- **The palette becomes a mood board nobody samples.** Values live in this file and never in
  the shaders or the texture pipeline. Guard: `palette-conformance.mjs` runs every wave, and
  the hex values are the source of truth that the material library imports.
- **R7 metastasises.** The Ashen Coast is the easiest region to make look good because it is
  literally Morrowind, so it grows. The world becomes Vvardenfell with more water. The < 6%
  area cap is the guard and it needs enforcing early.

## Provenance note

`provenance: canonical-recall`, `confidence: medium`. Read that label carefully — it is doing
real work here.

**What is recalled, and how it was checked.** The §A characterisation of Morrowind's art
direction is the authoring agent's recall of the 2002 game, and the §B Black Marsh column is
recall of Elder Scrolls lore. Both were **partially corroborated by web search in August
2026**, and the corroborated fragments are quoted inline in §A and §B: the House Redoran
"organic curves and undecorated exteriors … inspired by the landscape and by the shells of
giant native insects" and Telvanni "grown and sculpted from stems, caps, and root-like
holdfasts of the giant native mushrooms" descriptions; the xanmeer material (pre-Duskfall
stone ziggurats, lost technique, reptilian heads "stylized with right angles", the Empire's
"half-sunken villas and decaying prisons"); the Hist as the earliest inhabitants. **The UESP
pages themselves returned HTTP 403 to the authoring agent's fetcher**, so the quotes above
come from search-result extracts, not from a full page read. A critic wanting the primary
text should fetch these URLs by another route and correct anything this file gets wrong. That
is a correction, not a failure — file it as an amendment.

**What is constructed, and therefore fully ours.** Everything numeric and everything about
Black Marsh's *look*: the seven regions and their names (R1 Hixinoct Fen, R2 The Rootways,
R3 Xal-Meeru, R4 The Chitin Reach, R5 Blackrot Mire, R6 Hist Grove, R7 Ashen Coast), all 49
palette hex values, the sky/atmosphere table, the forbidden anchor set, the six silhouette
vocabularies, the forbidden-forms list, the materials list, the chroma budget of 8%, and every
threshold in the Comparison method. None of these exist upstream. They are `constructed` and
binding per CORPUS-CONTRACT §3 — a made-up palette we can sample beats an authentic mood we
cannot.

**Known weakness.** The hex values were chosen by the authoring agent by reasoning about hue
relationships, not sampled from reference imagery, and they have never been seen rendered.
The one thing about them that **is** measured rather than asserted is the ΔE2000
self-consistency check in §C — it was actually computed, it caught three real defects in the
first draft (R3's stone was sitting ΔE 8.8 from the forbidden neutral grey, i.e. the palette
failed its own test), and those were corrected before commit. That is evidence the check
works, not evidence the palette is right.

It remains likely that several of the 49 values are wrong in practice. **The first wave that
renders a region should sample the albedo capture and propose corrections by amendment**,
recording both old and new hex and re-running the self-check. Palette drift by silent edit is
forbidden; palette correction by recorded amendment is expected and healthy.
