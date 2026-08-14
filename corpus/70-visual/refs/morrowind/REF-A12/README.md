# REF-A12 — the Morrowind UI

**This slot is filled by structure, not by a screenshot.** It contains the MyGUI layout and skin
definitions from **OpenMW**, plus the Morrowind.ini fallback table OpenMW ships, which together
describe the 2002 Morrowind interface as *geometry, widget composition, texture vocabulary and
colour constants* rather than as a picture of one.

Two earlier acquisition passes recorded REF-A12 as permanently unfillable, and for their source
they were right: `dehero/mwscr`, which supplied all 89 images on the Morrowind art-direction side,
has the stated editorial rule *"No interface"* — every one of its ~1,600 captures was taken with
the HUD and menus off, by design. There is no inventory, journal, dialogue list or map anywhere in
it. The second pass named the correct alternative and did not act on it. This is that alternative.

---

## Why this is better than a screenshot for what REF-A12 is actually for

REF-A12's job in this corpus is stated in the request: *"The UI: inventory, the dialogue topic
list, the journal, the map. **Our UI is a transposition of these.**"* A transposition needs
measurements. A screenshot of a Morrowind window tells a critic that the frame looks like tooled
bronze; it does not tell them that the frame is **4 px thick with 10 px corner pieces**, that the
client area is inset **8 px at the sides and 28 px at the top**, or that the dialogue topic column
is **166 px of a 588 px window**. Those are the numbers a builder needs and the numbers a reviewer
must check a build against, and they are all here, exactly, as integers.

| Judgement | Screenshot | These files |
|---|---|---|
| Panel construction, border thickness, corner treatment | eyeball it, at whatever scale the shot was taken | exact, in pixels, per widget |
| Layout, column widths, control placement | approximate, and confounded by the window having been dragged/resized | exact, including `MinSize` and stretch/anchor rules |
| Spacing and padding rhythm | not recoverable | `border = 2`, `thickBorder = 4`, `padding = 2` |
| Text colour semantics (normal / link / topic / answer / health / magic) | you see the colours that happened to be on screen | the whole 45-entry table with RGB values |
| **Iconography and texture art** | **shows it** | **names the texture files, does not contain them** |
| **What it actually looked like — sheen, wear, bevel, the tooled-metal read** | **shows it** | **does not show it** |

**So the honest position is: this fills the layout half of REF-A12 completely and precisely, and
does not fill the appearance half at all.** The bottom two rows of that table are the loss, and
they are a real loss. See "What this does not let you judge" below.

---

## Provenance and the one thing to be careful about

**Source:** `https://github.com/OpenMW/openmw` at commit
`f673ab858b8d1ccedeaeb39383896d8be3017ce1` (committed 2026-08-03), paths `files/data/mygui/`,
`files/openmw.cfg`, `files/data/scripts/omw/mwui/constants.lua`. Cloned `--depth 1`; every file
here is a byte-exact copy, unmodified, and its sha256 is in `MANIFEST.json`.

**OpenMW is a reimplementation, and these files are not Bethesda artifacts.** Morrowind's own UI
was compiled into `Morrowind.exe`; there is no shipped layout file to take. What OpenMW's authors
did was reproduce the interface to match the original on screen, expressing it in MyGUI XML. The
numbers below are therefore *OpenMW's measurements of Morrowind's UI*, made by people whose whole
project is matching it pixel-for-pixel, cross-checked against the original by a large user base
over fifteen years. That is very good evidence and it is not the same thing as a primary source.
**Treat every geometry figure here as high-confidence-reproduced, not as canonical.** §7 of the
request accepts `engine: "openmw-vanilla-assets"` for exactly this reason, and that is the
`engine` value recorded on all 38 records.

The one place OpenMW is knowingly *not* reproducing Morrowind is where Morrowind had nothing:
scrollbar arrows and controller glyphs, shipped as `omw_*.dds`. **Those are deliberately excluded
from this folder** so nothing here can be mistaken for 2002 art direction.

---

## What is here

```
REF-A12/
  mygui/    36 files — the layouts and skins (byte-exact from OpenMW)
  config/   openmw.cfg          — the Morrowind.ini fallback table (UI colours at lines 71-115)
            mwui_constants.lua  — border/padding constants used by OpenMW's own UI scripts
```

The four things REF-A12 names, and the file that holds each:

| REF-A12 asks for | File |
|---|---|
| **inventory** | `mygui/openmw_inventory_window.layout`, `mygui/openmw_inventory_tabs.layout` |
| **the dialogue topic list** | `mygui/openmw_dialogue_window.layout` |
| **the journal** | `mygui/openmw_journal.layout`, `mygui/openmw_journal.skin.xml` |
| **the map** | `mygui/openmw_map_window.layout`, `mygui/openmw_map_window.skin.xml` |

Supporting layouts included because our UI transposes them too: book, scroll, container, trade,
stats, spell, tooltips, message box, count, travel, HUD. Supporting skins: window frame, box,
button, list, text, edit, progress, scroll, dialogue, HUD box, HUD energy bar, plus the four
global resource files (`core.skin`, `core.xml`, `skins.xml`, `openmw_layers.xml`,
`openmw_resources.xml`, `openmw_pointer.xml`, `openmw_settings.xml`).

---

## The measurements, read out

Everything below is quoted from the files in this folder. Nothing is recalled or estimated.

### The window frame — `openmw_windows.skin.xml`, `MW_Window`

Nominal skin size **256×256**, `MinSize` **64×64**. Client area offset **`8 28 240 220`** — i.e.
**8 px inset left/right and bottom, 28 px at the top** for the title strip. The border is composed
of eight tiling edge strips and four corner assemblies:

- edges `TB_T` / `TB_B` at **4 px** deep, `TB_L` / `TB_R` at **4 px** wide, each `TileRect`
  (`TileH` and `TileV` true) so the frame *repeats* rather than stretches — this is why Morrowind
  windows keep their bronze grain at any size;
- each corner is three widgets, not one: a **4×4** corner square plus two **10 px** run-off pieces
  (`TB_TL`, `TB_TL_T`, `TB_TL_B` and the three mirrors). The corner is a distinct casting, and the
  10 px shoulder is what stops the tiled edge from butting into it.

`MW_Box` (the inner sunken panel, `openmw_box.skin.xml`) is the same idea at **2 px**: eight
children, edges 2 px, corners 2×2. So the interface has exactly **two border weights, 4 px and
2 px** — outer frame and inner panel — and `mwui_constants.lua` names them `thickBorder = 4` and
`border = 2`, with `padding = 2`.

### Dialogue — `openmw_dialogue_window.layout`

Window **588×433**, `MinSize` **380×230**. Two columns:

- **left, the history**: an `MW_Box` at `8 8 381 381`, with the `BookPage` inset a further 7 px at
  `15 15 364 370`, and a 14 px-wide `MW_VScroll` at x=370 that is `Visible = false` until needed;
- **right, the topic list**: a `MWList` skinned `MW_SimpleList` at `398 31 166 328`. Above it the
  disposition `ProgressBar` (`MW_Progress_Blue`) at `398 8 166 18` with its label overlaid; below
  it the Goodbye `Button` at `398 366 166 23`.

**The topic column is 166 px of 588 — 28% of the window — and it is a bordered list, not a
sidebar.** `MW_SimpleList` is literally `MW_Box` with a 3 px client inset and `ListItemSkin =
MW_ListLine`. Both columns `align` to stretch, so the ratio holds as the window is resized.

### Inventory — `openmw_inventory_window.layout`

Window **600×300**, `MinSize` **40×40**. `LeftPane` **224×223**, `RightPane` at x=228, **350×223**.

- Left: encumbrance `MWDynamicStat` (`MW_ChargeBar_Blue`) at `8 8 212 24`; the paper-doll `MW_Box`
  at `8 38 212 185`, with `AvatarImage` inset **3 px** at `3 3 206 158` and the armour-rating
  `TextBox` occupying the bottom `212×24` **inside the same box**.
- Right: five `AutoSizedButton`s of nominal **60×24** in a 28 px-tall `HBox` (All / Weapon /
  Apparel / Magic / Misc) plus a filter `EditBox`, then the `ItemView` at `0 38 350 185`.

So the inventory is **one-third portrait, two-thirds grid**, the category tabs are *buttons in a
row* rather than a tab strip, and the armour rating lives inside the avatar frame rather than in a
stat column.

### Journal — `openmw_journal.layout`

Window **565×390** on its own `JournalBooks` layer, with **no `MW_Window` frame at all** — the
frame is the book: an `ImageBox` of `textures\tx_menubook.dds` drawn at `-70 0 705 390`, i.e.
**wider than the window and hanging 70 px off the left edge**, so the spine sits where it does.

Two `BookPage`s, **240×320** each, at `(30, 22)` and `(295, 22)` — a **25 px gutter**. Page-number
`TextBox`es of 32×16 at y=350. Controls are `ImageButton`s with distinct idle/over/pressed
textures: prev and next **48×32** at x=205 and x=300, close **48×32** and journal **64×32** at
x=460, options **64×32** at x=40, all on the y=350 baseline.

Font `Journalbook DefaultFont`, `TextColour` **`0 0 0`** — **black ink**, the only place in the
interface where text is black rather than the bronze `202,165,96`. The book metaphor is complete:
paper, ink, page numbers, a gutter, and page-turn buttons instead of a scrollbar.

### Map — `openmw_map_window.layout`

Window **300×300**, skin `MW_Window_Pinnable` (so it can be nailed open over the world, which the
inventory and stats windows also can and the dialogue and journal windows cannot). A `ScrollView`
skinned `MW_MapView` at **284×264** holds either the local or the global map; each carries a
**32×32** `RotatingSkin` compass built from `textures\compass.dds` — **the compass is a rotated
sprite, not a redrawn needle** — and a full-area invisible `Button` to catch drags. A single
`AutoSizedButton` (61×22, expands leftward) at bottom right toggles local/world.

### Colour — `config/openmw.cfg` lines 71–115

The Morrowind.ini `[FontColor]` table, 45 entries, verbatim. The load-bearing ones:

| Role | RGB | Hex |
|---|---|---|
| `normal` | 202, 165, 96 | `#CAA560` |
| `normal_over` / `header` / `notify` / `positive` / `count` | 223, 201, 159 | `#DFC99F` |
| `normal_pressed` | 243, 237, 221 | `#F3EDDD` |
| `active` | 96, 112, 202 | `#6070CA` |
| `link` | 112, 126, 207 | `#707ECF` |
| `journal_link` | 37, 49, 112 | `#253170` |
| `journal_topic` | 0, 0, 0 | `#000000` |
| `answer` | 150, 50, 30 | `#96321E` |
| `health` / `negative` | 200, 60, 30 | `#C83C1E` |
| `magic` | 53, 69, 159 | `#35459F` |
| `fatigue` | 0, 150, 60 | `#00963C` |
| `misc` | 0, 205, 205 | `#00CDCD` |
| `background` | 0, 0, 0 | `#000000` |
| `focus` | 80, 80, 80 | `#505050` |

Note the structure, which is the transposable part: **one warm bronze family for body text with a
three-step normal/over/pressed ramp, one cool blue family for anything interactive, one red for
spoken answers, and the four attribute colours (red / blue / green / cyan) reused for every bar in
the game.** The literal `#ccb589` also appears 21 times directly in layouts, as the tint applied
to controller-glyph images.

### Texture vocabulary — what the interface is built out of

The skins name their textures; the texture files themselves are in `Morrowind.bsa` and are **not**
in this folder or in OpenMW. The full list of Bethesda UI textures the interface references:

`menu_thick_border_{top,bottom,left,right}.dds` and the four
`menu_thick_border_*_corner.dds` · the same eight in `menu_thin_border_*` ·
`menu_bar_gray.dds` (referenced **12 times** — the single most reused element in the UI) ·
`menu_small_energy_bar_{top,bottom,vert}.dds` · `tx_menubook.dds` and the twelve
`tx_menubook_{prev,next,close,journal}_{idle,over,pressed}.dds` · `compass.dds` · `target.dds`.

**That list is itself a design-language finding**: the entire interface is assembled from roughly
**thirty small tiling sprites**, with one large painted asset (`tx_menubook.dds`) for the book.
There is no atlas, no vector, no nine-slice-with-fill — the fill is *tiled*, and that tiling grain
is a large part of why Morrowind's panels read as material rather than as graphic design.

---

## What this does not let you judge — read before citing REF-A12

1. **Appearance.** No pixel of Morrowind's UI art is here. Bevel, sheen, wear, the tooled-bronze
   read, the parchment grain of `tx_menubook.dds` — none of it. If a verdict turns on *how the
   frame looks*, REF-A12 cannot support it and you should say the reference is absent.
2. **Type.** Font *names* are here (`Default`, `Journalbook DefaultFont`); the fonts are not, and
   neither is any rendered size in the layouts — OpenMW takes it from
   `ui._getDefaultFontSize()` at runtime. Line height, letterforms and text density are unjudgeable.
3. **Populated state.** These are empty containers. How dense a real topic list is, how many items
   a real inventory grid holds, how long a real journal entry runs — not recoverable here.
4. **Anything OpenMW got wrong.** Every figure is a reproduction (see "Provenance" above). If a
   claim is load-bearing enough to be worth arguing about, it wants a second source.
5. **Any pixel statistic.** All 38 records carry `pixel_metrics_valid: false` and every numeric
   image field is `null`. These are text files; `make-manifest.py` records their bytes and sha256
   and computes nothing else. **They must never enter a metrics population.**

## Realistic completion of this slot

One 1024×768 vanilla screenshot each of the inventory, the dialogue window, the journal and the
map — four files — would close gaps 1 and 3 entirely and is the only thing that would. That is a
small, well-specified ask for any future pass with access to a screenshot host; it is *not* a
reason to hold RI-VIS05 or the UI transposition work, because the layout half, which is the half a
builder actually consumes, is now complete and exact.

---

## Correction, 2026-08-14 — the slot this README calls unfillable was filled, one folder over

**Everything above is accurate about REF-A12 and out of date about the corpus.** The closing
section — *"One 1024×768 vanilla screenshot each of the inventory, the dialogue window, the journal
and the map — four files — would close gaps 1 and 3 entirely and is the only thing that would"* —
was written before `REF-A12b/` landed on **2026-08-06** with **33 native-engine Morrowind UI
captures**: dialogue ×5, journal ×3, inventory ×4, map ×5, character sheet ×4, barter ×3, book
reader ×4, tooltip ×2, level-up ×2, char creation ×1. They are manifested, eye-verified,
`vanilla_confidence: high`, and routed to `ui-fidelity`. On **2026-08-14** `REF-A12c/` added the
project owner's own 2376×1069 dialogue capture.

**Gaps 1 and 3 in "What this does not let you judge" are therefore closed** — appearance, and
populated state. Gap 2 (type) is partly closed: the captures show rendered letterforms and line
density, though no font file. Gaps 4 and 5 stand unchanged.

**Why this correction is worth writing down rather than quietly deleting the paragraph.** The
pictures existed for eight days and the dialogue window was built in that window with nothing to
compare against, because the two documents a builder actually reads before citing REF-A12 — this
file, and `RI-VIS09` §2 and §3.5 — both still said the appearance reference did not exist. One plan
(`orchestration/plans/W1-21.md`) did cite REF-A12b by path; nothing else did. **The failure was not
acquisition, it was propagation**, and the fix is that a folder landing is not finished until the
register and the READMEs that route consumers to it have been edited.

**What to cite for what, now:**

| You want | Cite |
|---|---|
| exact rects, anchors, border weights, spacing, the `[FontColor]` table | **this folder** — still the only exact source, and still the only one for anchors |
| bevel, sheen, wear, type, iconography, how dense a real list is | **`../REF-A12b/`** |
| the dialogue window at the highest resolution we hold | **`../REF-A12c/`**, with `RI-UIX08` §E's two named traps: its green topic list and its Android corner chrome are **not** Morrowind |
| the dialogue window's *specification*, already written from all three | `corpus/86-ui/RI-UIX08-dialogue-window.md` |

**And one factual correction to the section above, found by measuring the owner's capture against
this folder's own XML.** The line *"Both columns `align` to stretch, so the ratio holds as the
window is resized"* is **wrong**. In `openmw_dialogue_window.layout` the history box is `Stretch`,
but the disposition bar, the topic list and the Goodbye button are all `Right Top` / `Right VStretch`
/ `Right Bottom` at a **fixed 166 px**. The topic column does not hold its ratio: it is
right-anchored at a fixed width and the prose pane absorbs every extra pixel. REF-A12c is the proof
in pixels — a widened window puts the column at **23.9%** of the panel, not the nominal 28.2%. The
"166 px of a 588 px window — 28%" figure elsewhere in this README is correct *at nominal size only*.
