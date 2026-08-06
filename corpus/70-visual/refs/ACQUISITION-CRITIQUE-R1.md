# Reference coverage critique — round 1

**Role:** REFERENCE COVERAGE CRITIC. I build nothing. **Round:** 1 of a loop that closes only when a
critic is completely satisfied.
**Measured:** 2026-08-06, against real files on disk, not against `MANIFEST.json`.

> **FILENAME COLLISION, READ FIRST.** A file called `ACQUISITION-CRITIQUE-R1.md` already existed at
> this path when I started. It is a different critique — of `acquire.py`, written before that script
> had ever run — and it is **preserved verbatim** as `ACQUISITION-CRITIQUE-R1-code.md` / `.json`.
> Its 472-candidate handover, `ACQUISITION-CRITIQUE-R1-candidates.json`, is **untouched and still
> authoritative** for the ten buckets it covers. My own handover is a *separate, additive* file,
> `ACQUISITION-CRITIQUE-R1-souls-candidates.json` (734 candidates, 12 buckets, zero overlap —
> the earlier pool predates amendment A5 and contains no Dark Souls at all).

---

# VERDICT: **INSUFFICIENT**

Not marginally. The set has 173 images and **cannot answer a single one of the questions the user
asked it to answer.**

- **Dark Souls: zero.** Not one file from Dark Souls Remastered or Dark Souls III anywhere in the
  repository. The `refs/souls-behaviour/` tree that amendment **A5** mandates — `camera/`,
  `attacks/`, `telegraph/`, `stance/`, `impact/`, `ui-combat/` — **does not exist as a directory.**
  Six reference items (`RI-CAM01`, `RI-CAM03`, `RI-CAM07`, `RI-WPN01`–`RI-WPN06`, `RI-AI02`) are
  `provenance: constructed` with no visual reference of any kind, exactly as the amendment says.
- **Morrowind menus: zero pixels.** `REF-A12` is 38 OpenMW MyGUI XML files. It records that the
  dialogue window is 588×433 and that `normal` text is RGB 202,165,96. It contains **no image**.
  `refs/morrowind/REF-A12b/` and `refs/morrowind/REF-A20/` — both mandated by **A2** — do not exist.
- **`refs/modern/ui/`, `refs/context/`, `refs/video/`, `refs/modern/material_closeup/`: zero.**
  Four more empty or absent destinations, two of them (`V1-dolly`, `V2-static`) marked *required*.
- **Not one of the six `refs/modern/` profile floors is met**, on count, on distinct games, or on
  the §3 anti-curation rule. `interior_darkemissive` has **8 files and 0 measurable ones**.
- And the half of the set that *looks* healthy is not. **All 89 Morrowind images are 320×320 square
  crops** — see finding F1, which is the most important thing in this document.

The user's instinct was right twice over. They found A5. **There is a second missing axis, and it is
not a missing subject — it is a missing *resolution and framing* standard on the half of the corpus
that already reads PASS.**

---

## 1. Pass 1 — coverage against what was already asked for

Floors from `docs/REFERENCE-IMAGE-REQUEST.md` §3 as amended by A1/A2/A4. **§3 counts only files with
`pixel_metrics_valid: true`**, so both columns are shown. Counted by walking the directory tree;
provenance joined from `_provenance.json` (138 records) falling back to `MANIFEST.json` (165).

### 1a. `refs/modern/` — the fidelity side

| Folder / slot | Floor (imgs/games/locs) | Files on disk | **Countable** | Distinct games | Interval-run (§3 needs ≥½) | Verdict |
|---|---|---|---|---|---|---|
| `exterior_daylight` | 12 / 3 / 6 | 10 | **3** | **1** (Elden Ring) | 0 of 10, needs ≥6 | **FAIL ×3** |
| `exterior_lowlight` | 12 / 3 / 6 | 11 | **3** | **1** (Elden Ring) | 0 of 11, needs ≥6 | **FAIL ×3** |
| `interior_darkemissive` | 10 / 2 / 5 | 8 | **0** | **1** (Elden Ring) | 0 of 8, needs ≥5 | **FAIL — no measurable file at all** |
| `character_closeup` | 10 / 2 / 6 | 12 | **8** | 2 (ER, RDR2) | exempt | **FAIL** — count met, but 11 of 12 are one game and the ≥½ rear-view rule is unverified |
| `combat` | 8 / 2 / 4 | 2 | **2** | **1** (Elden Ring) | exempt | **FAIL** |
| `material_closeup` | 8 / 2 / 6 | **0** | 0 | 0 | exempt | **FAIL — empty** |
| `modern/ui` (`REF-M22`, A2) | ≥2 games | **directory absent** | 0 | 0 | n/a | **FAIL — never created** |
| `modern/hud` | — (A1 dissolves this folder) | 28 | 24 | 2 (W3, ER) | 24 of 24 | **MISFILED** — see G07 |

**Whole modern side: 3 distinct games exist** (Elden Ring 46, Witcher 3 29, RDR2 1). **Per profile it
is 1 everywhere except `character_closeup`, where it is 2.** No profile except `character_closeup`
meets even A4's reduced two-game minimum. `RI-VIS03`'s twelve metric bands cannot be calibrated in
any profile today.

**Zero interval-run frames exist anywhere in `refs/modern/`.** §3 calls its anti-curation rule the
paragraph to "read twice"; compliance is 0%. The only 24 interval-run frames in the project are
sitting in `modern/hud/`, which A1 has dissolved — see G07, which is free.

### 1b. `refs/morrowind/` — the art-direction side

| Slot group | Floor | Files | Verdict |
|---|---|---|---|
| `REF-A1`–`REF-A19` excl. `A12` | 2–3, core five 4–5 | 89 (4–6 each, 18 of 19 slots) | **PASS on count — and this number is misleading. See F1.** |
| `REF-A12` (core, 4–5) | 4–5 images | 38 XML/layout/config files, **0 images** | **FAIL — the slot asks for the UI and holds no picture of it** |
| `REF-A12b` (A2) | 2–3 × 8 sub-kinds | **directory absent** | **FAIL — never created** |
| `REF-A20` (A2) | loading/splash | **directory absent** | **FAIL — never created** |

### 1c. Everything else

| Folder | Floor | Files | Verdict |
|---|---|---|---|
| `anti-generic/` | 4–6 | 5 (Witcher 3) | **PASS** |
| `context/` | 4 (ESO Shadowfen/Murkmire) | **0** | **FAIL — empty** |
| `video/` | V1 + V2 **required**, V3/V4 wanted | **0** | **FAIL — empty** |
| `souls-behaviour/` (A5, six subfolders) | entire axis | **directory absent** | **FAIL — the amendment's central deliverable does not exist** |
| `rejected/` | n/a | 8, with reasons | ok |

### 1d. Catalogue hygiene defects found while counting

| # | Defect |
|---|---|
| **H1** | `MANIFEST.json` holds 165 records; **173 images are on disk**. The manifest has never been regenerated since the 46 Elden Ring files landed. Catalogue and disk are out of sync *again*, in the opposite direction from the last time. `make-manifest.py` must be re-run — it is the only writer of every numeric field. |
| **H2** | `_provenance.json` was, at 11:30, reduced to **46 Elden-Ring-only records**, having previously held 165. A concurrent agent restored it to 138 mid-review. It is still 35 short of the 173 files on disk. **The near-miss is the finding**: provenance is being rewritten wholesale rather than merged, and `tools/refs/merge-manifest.mjs` exists precisely to prevent that. |
| **H3** | **All 46 Elden Ring records carry `slot: "REF-M-supplemental"`.** Not one fills a named `REF-M` slot. Every §5a slot from `REF-M1` to `REF-M21` is therefore still formally unfilled, including the ones the images plainly satisfy. |
| **H4** | 31 of 46 are `pixel_metrics_valid: false`; 30 of 46 `heavily_recompressed: true`. The catalogue reads 46 and measures 15. Honestly recorded — but it means every headline count in circulation is roughly 3× optimistic. |
| **H5** | 3 records are `corroboration: "unknown"`. §8b: "An image satisfying none of the three goes in `rejected/`." Not optional. |

---

## 2. Pass 2 — fresh findings

Re-derived from the 138 corpus items, ignoring the slot list. Each finding names the item that
cannot otherwise be judged.

### F1 — The Morrowind set is 89 square thumbnails, and it cannot answer the questions its own slots ask. *(This is the second missing axis.)*

**Every one of the 89 Morrowind images is 320×320 or 321×320.** Not "mostly", as `RI-VIS09` §1
records — 89 of 89, verified against `MANIFEST.json`'s script-computed `width`/`height`. They are
AVIF previews, square-cropped from 4:3 originals.

Read the slot definitions against that number:

- **`REF-A13`** — "Armour and clothing on NPCs, **readable at close range**." Five 320×320 crops.
- **`REF-A14`** — "Weapons, **close enough to read the design language**." Five 320×320 crops.
- **`REF-A15`** — "Books, scrolls and written pages, **plus Daedric script signage**." Daedric
  script is not legible at 320 px. One image in this slot was already moved to `rejected/` for
  exactly this reason — *"neither the page nor the Daedric script can be read"* — and the same
  objection applies to the five that stayed.
- **`REF-A10`** (core) — "at **readable size**". **`REF-A6`** (core) — creature design.
- And worse, because a **1:1 crop of a 4:3 frame has thrown the composition away**:
  **`REF-A1`** "exterior **vista**", **`REF-A8`** "settlement **density and layout**",
  **`REF-A19`** "a stilted or waterside **settlement**". You cannot judge a vista or a layout from a
  square crop of it. `RI-WLD03` (settlement anatomy), `RI-WLD14` (built alienness, whose acceptance
  test is *"crop a single building onto a neutral background and ask what made it"*) and `RI-VIS05`
  — the single highest visual-signal item in the corpus — are all being judged against pictures
  that no longer contain their subject.

**Nobody has asked for this because the folder reads PASS on count.** A4 says breadth beats depth, and
the bifurcation protocol asks "is there a reference?" — never "can the reference be read?" There is
no resolution or framing floor on `refs/morrowind/` at all; §4 explicitly says *"no minimum
resolution in `refs/morrowind/`, and larger is not better there"*, which is correct in spirit
(a 4K modded shot is worse than a 1024×768 vanilla one) and has been read as licence for a 320 px
square crop. **The rule that is missing is not resolution — it is `full frame, native aspect,
uncropped`.**

**Classification: BLOCKING, and cheap.** Verified live: Steam app **22320** serves full-frame native
vanilla Morrowind at 1152×864 (4:3 — comfortably inside §7's V7 test), 1360×768 and 1920×1080.
Confirmed by ranged GET on sids `3374281716` (1920×1080), `434307874` (1920×1080), `366393520`
(1152×864), `217602477` (1152×864). **The entire art-direction reference set should be re-acquired
at full frame.** It is one script run against a source that is already proven.

### F2 — A5's richest artifact is a per-move animation library, and it has a name

A5 rule 3 says *"video is first-class here, not a fallback"* and rule 6 says *"a wiki's
attack-animation still"* serves. `refs/video/` is empty and nothing in the corpus names a source.

`darksouls.fandom.com` hosts **`Category:Dark Souls: Boss Attack Animations`** — animated clips
named by boss **and by individual move**: `Artorias - Heavy Slam`, `Artorias - Somersault Attack`,
`Artorias - Overwhelming Leap`, `Artorias - Heavy Spin`, `Artorias - Heavy Thrust`,
`Artorias - Wrath of the Abyss`, `Artorias - Spin Attack`, `Artorias - Abyss Sludge`.

That is precisely the artifact `RI-AI02` needs and does not have. Its bar is *"the player must be
able to see, from the enemy's silhouette alone — no UI, no sound, no colour flash — which attack is
coming and roughly when"*, and it enumerates attack anatomy in `f@60`. A telegraph claim is a claim
about **one named move's windup silhouette**, and a per-move clip is the only artifact that
isolates one. Same for `RI-WPN01`–`RI-WPN04` (windup silhouette, arc type, follow-through, recovery
posture *per weapon class*) and `RI-AI06` (*"the moves have distinct silhouettes"*, *"within four or
five attempts the player can name most of the moves"* — the wiki has named them for us).

**Two mechanics the builder must know, both verified:**

1. The wiki's **HTML is Cloudflare-403**, but **`api.php` returns 200**. Enumerate with
   `action=query&list=categorymembers`, resolve bytes with `action=query&prop=imageinfo&iiprop=url|size|mime`.
2. `static.wikia.nocookie.net` **transcodes to animated WebP unconditionally** — the stated
   605,902-byte GIF arrives as a 220,726-byte WebP. Verified three ways: with `Accept: image/gif`,
   without the `/revision/latest` suffix, and on the bare path. Under §4 that is a re-encode. **A5
   rule 3 sets `pixel_metrics_valid: false` across the whole behavioural axis**, so it is acceptable
   *here and nowhere else*, recorded as a `deviation`.

**Classification: BLOCKING, high value, and the route is proven.**

### F3 — The fog gate and the arena are a designed object, and A5's six subfolders do not include them

`RI-AI06`: *"The arena is part of the moveset. A boss's spacing behaviour is only meaningful in a
space that has a size, a shape, and a small number of legible features. And the loop around the
fight — fog gate in, die, run back, fog gate in — **is a designed object with its own budget**."*

A5 lists `camera/ attacks/ telegraph/ stance/ impact/ ui-combat/`. The **arena is not there**, and
neither §5a nor §5b has an arena or fog-gate slot. So the one claim `RI-AI06` makes that is purely
visual — arena size, shape, and *how many legible features* — has no reference and cannot be scored.
The fog gate specifically is the genre's single most recognisable framing device and we have no
picture of one. **A5 needs a seventh subfolder, `arena/`.**

**Classification: BLOCKING.** 59 arena candidates and 79 fog/bonfire candidates harvested.

### F4 — Death and respawn presentation

`RI-JRN06`'s bar is a sequence of *visible* events, not numbers: *"Control is taken for a bounded,
skippable moment"*; *"There is a bloodstain, **visible from a distance**, at the place they died —
not at the nearest navmesh node, not floating in geometry."*

Whether a bloodstain reads at distance is a composition-and-contrast question that can only be
settled against an image of one, and whether the death card is "bounded" is a question about a
full-screen presentation nobody has requested. A5 has no `death/` subfolder. `RI-PRG04` (hearth and
death) sits behind the same gap. **Classification: BLOCKING.** 60 `you died` candidates, three games.

### F5 — Menu *interaction*, not static menu screens — and Morrowind's real UI property is that windows are simultaneous

A2 asks for Morrowind menus "as rendered" and `REF-M22` for "modern menu/inventory screens". Both
are framed as **static single screens**, and that framing loses the property that actually matters.

Morrowind's interface is not a sequence of modal pages. It is a **user-arranged, resizable,
simultaneous tiling** — inventory, character sheet, map and magic all on screen at once, dragged
where the player wants them. `REF-A12`'s MyGUI XML records `map 300x300 pinnable` as an *attribute*;
it cannot show what a pinned layout looks like or how dense the result is. `RI-UIX03` owns inventory
and the pause rule; `RI-UIX06` §A1 requires **≥6 of nine materials present across the full UI set**
and §A2 requires that **no element is a plain rectangle** — both are judgements about the *assembled*
interface, not about one panel.

I verified a candidate that supplies exactly this: Steam sid **`3212740588`** is a single frame
holding character sheet + paperdoll inventory + world map + magic/powers window, tiled by the player.
One image answers four slots and the composition question none of them asks.

**The ask the builder should run is "menu mode with multiple windows open", not "inventory".**
**Classification: BLOCKING** (as a stated triage criterion; the images are abundant).

### F6 — There is creature reference for Morrowind and for nothing else

`REF-A6` covers Morrowind creatures. **§5a has no creature or enemy slot at all** — `REF-M6` is the
*player* from behind. So on the fidelity axis there is zero reference for a non-humanoid enemy at
combat distance, which makes `RI-VIS08` §D (the creature *design* vs creature *quality* seam) and
`RI-AI05` (roster archetypes) unjudgeable on the side that owns quality. `RI-CAM07` §F transposes
the same seam to the player and inherits the hole.

**Classification: BLOCKING.** 79 candidates across three games.

### F7 — Armour and weapons at readable scale on the modern side

`REF-A13`/`REF-A14` cover Morrowind — at 320 px (F1). §5a covers **nothing**: `REF-M6` is a full-body
rear view at 40–70% of frame height, which does not resolve a pauldron joint, a scabbard mount or a
cloth-to-metal transition.

`RI-CAM07` §B is *"the back-surface requirement"*: *"the back of the head, the back of the armour,
the backs of the legs and the hanging scabbard get more screen-time than any other surface in the
game, and they must be authored accordingly."* There is no modern reference at the scale that
sentence is judged at. This is not `material_closeup` either — that slot is one surface filling the
frame, not an armour set at 2 m.

**Classification: BLOCKING.** Note the Dark Souls III status screen (verified: sid `3670478265`)
renders the character live beside the menu, serving `REF-M22`, `souls-behaviour/stance/` and this
finding in one file.

### F8 — How a Souls level communicates a shortcut

`RI-JRN06` checks *"the shortcut ladder they kicked down is still down"*. `RI-WLD07` owns verticality
and interiors, `RI-WLD06` markerless navigation, `RI-AI06` the runback budget. The visual grammar of
a Souls shortcut — the one-way door seen from its wrong side, the kicked ladder, the lift that
reconnects two known places — is a **composition** claim, and nothing in the reference set is a
composition. **Classification: SUBSTITUTABLE** (elevator/ladder/bonfire framing serves; 58 candidates
harvested) — but it must be *asked for*, and it never has been.

### F9 — `REF-M19` states a framing constraint that no search query can express

`REF-M19` requires **one frame containing both near water seen steeply from above and far water at a
grazing angle**, because `RI-WLD10`'s metric compares those two regions *inside a single frame*. No
`searchText` can express that. It is not a search problem and more candidates will not fix it — it
is a **triage-criterion** problem, and neither candidate pool flags it. The same is true of §5a's
"foreground present, sky visible" and of `REF-M6`'s "≥half must be back or three-quarter-rear".

**Classification: INFERABLE → the fix is a written triage checklist, not a download.** Every
candidate list in this repository is ordered by Steam rating, which is a proxy for *beauty* — the
exact bias §3's anti-curation rule exists to defeat.

### F10 — NPC idle and conversation posture

`RI-DLG*` owns conversation; Morrowind's NPCs face the player rigidly with no conversation staging,
and that is a design-language property our transposition inherits or rejects deliberately.
**Classification: SUBSTITUTABLE** — `REF-A8` (town street with NPCs) and `REF-A13` partly serve it at
full frame once F1 is fixed. 35 candidates harvested; low priority.

### F11 — Weather as it actually appears, per game

`REF-M14` (rain), `REF-M20` (fog), `REF-M21` (overcast) each name one image across four games. The
prior code critique established overcast is genuinely scarce (3–8 hits per game against ~50 for
dramatic queries) and correctly called that a property of what people upload rather than a search
failure. **Classification: INFERABLE** — measure the daylight population and apply known diffuse-sky
shifts, recorded as `derived`, per A3's worked example. Do not keep this BLOCKING.

---

## 3. Gap register — every gap, classified per A3

IDs are `R1C-*` to avoid colliding with the code critique's `G01`–`G18`.

| ID | Gap | Class | Specific search / resolution |
|---|---|---|---|
| **R1C-01** | `refs/souls-behaviour/` does not exist. Entire A5 axis, six subfolders, zero files. `RI-CAM01`, `RI-CAM03`, `RI-CAM07`, `RI-WPN01`–`06`, `RI-AI02` have no visual reference. | **BLOCKING** | Steam `/app/570940/screenshots/?p=N&browsefilter=toprated&searchText=Q` and `/app/374320/…`. Queries run and delivered: `lock on`, `boss fight`, `greatsword`, `swing`, `attack`, `shield`, `armor`. **403 candidates already harvested** into `ACQUISITION-CRITIQUE-R1-souls-candidates.json` buckets `souls_behaviour_camera` (67), `souls_behaviour_attacks` (75), `souls_behaviour_stance` (80), `souls_ui_combat` (42). Do not re-run these. |
| **R1C-02** | All 89 Morrowind images are 320×320 crops; `REF-A13`/`A14`/`A15`/`A10`/`A6` unreadable, `A1`/`A8`/`A19` decomposed. **(F1)** | **BLOCKING** | Steam app **22320**, `/app/22320/screenshots/?p=N&browsefilter=toprated&searchText=<slot subject>`. Verified full-frame native: 1152×864, 1360×768, 1920×1080. Re-acquire all 19 slots at full frame; keep the AVIF crops only as a fallback and mark them `superseded`. Apply §7's seven vanilla tests — V7 passes at ≤1920×1080. |
| **R1C-03** | `morrowind/REF-A12b/` absent — no pixel of Morrowind's UI exists. A2 calls this "the highest-value art-direction acquisition left". | **BLOCKING** | App **22320**, `searchText=` each of `journal`, `map`, `barter`, `dialogue`, `character sheet`, `book`, `level up`. **71 candidates delivered** (bucket `morrowind_menus`). Eyeballed and confirmed: sid `2347256727` = vanilla dialogue window with topic list; sid `3212740588` = four-window menu-mode composite. |
| **R1C-04** | `morrowind/REF-A20/` absent — no loading/splash screens. | **BLOCKING** | App **22320**, `searchText=loading screen`, `main menu`, `title screen`. **29 candidates delivered** (bucket `morrowind_loading`). |
| **R1C-05** | No per-move attack animation clips. `refs/video/` empty; V1 and V2 are *required*. **(F2)** | **BLOCKING** | `https://darksouls.fandom.com/api.php?action=query&list=categorymembers&cmtitle=Category:Dark%20Souls:%20Boss%20Attack%20Animations&cmlimit=500&format=json` → per-file `&prop=imageinfo&iiprop=url|size|mime`. HTML is 403; the API is 200. Bytes arrive as animated WebP (see F2 caveat 2). Also: `youtube.com/watch?v=iNgDzC_pOi8` (DS3 all-weapon moveset showcase), `gamedeveloper.com/blogs/anatomy-of-an-enemy-attack-in-dark-souls-3` (attack-phase analysis, directly citable by `RI-AI02`). |
| **R1C-06** | No fog gate, no boss arena framing. A5 has no `arena/` subfolder. **(F3)** | **BLOCKING** | Add `souls-behaviour/arena/`. **59 + 79 candidates delivered** (`souls_arena_framing`, `souls_foggate`). **Triage by eye is mandatory** — `searchText=fog gate` on 374320 returns architecture, not fog gates (verified, sid `1914625699`). |
| **R1C-07** | No death/respawn presentation, no bloodstain. **(F4)** | **BLOCKING** | Add `souls-behaviour/death/`. **60 candidates delivered** (`souls_death`, apps 570940 / 374320 / 1245620, `searchText=you died`). |
| **R1C-08** | `modern/ui/` (`REF-M22`) absent; F17–F19 have no reference population. | **BLOCKING** | 56 candidates in the **prior** pool (`modern_ui_REF-M22`), plus my bucket `souls_ui_combat` (42, incl. DS3 `inventory`/`menu` and ER `inventory`). Flagship: DS3 sid `3670478265`, status screen with live character render. |
| **R1C-09** | No creature/enemy design reference outside Morrowind. **(F6)** | **BLOCKING** | Bucket `souls_creature_design`, **79 candidates**, apps 570940/374320/1245620, queries `dragon`, `enemy`, `boss`, `knight`. |
| **R1C-10** | No armour or weapon at readable scale on the modern side. **(F7)** | **BLOCKING** | Buckets `souls_behaviour_stance` (80, `shield`/`armor`) and `souls_behaviour_attacks` (75). Triage for: single figure, 2–4 m, armour occupying ≥30% of frame. |
| **R1C-11** | `interior_darkemissive` has **0** measurable files of a floor of 10. | **BLOCKING** | Prior pool bucket `interior_darkemissive` (36 candidates, 3 games) is authoritative; my `souls_foggate` bucket incidentally holds strong dark-interior frames (e.g. DS3 sid `1914625699`). |
| **R1C-12** | `material_closeup` empty (floor 8/2/6). | **BLOCKING** | Prior pool, 42 candidates, 4 games. Already researched — download. |
| **R1C-13** | `exterior_daylight` / `exterior_lowlight` at 3 countable each, 1 game each, 0 interval-run. | **BLOCKING** | Prior pool: 99 + 78 candidates across 4 and 3 games. **And G07 below is free.** |
| **R1C-14** | `context/` empty (4 ESO Shadowfen/Murkmire). | **SUBSTITUTABLE** | Prior pool, 30 candidates, app 306130. Cited by nobody; do it last. |
| **R1C-15** | No shortcut / level-connection composition reference. **(F8)** | **SUBSTITUTABLE** | Bucket `souls_shortcut_level`, 58 candidates (`shortcut`, `elevator`, `ladder`, `bonfire`). |
| **R1C-16** | No NPC idle / conversation posture reference. **(F10)** | **SUBSTITUTABLE** | Bucket `morrowind_npc_posture`, 35 candidates. Largely absorbed by R1C-02's full-frame re-acquisition. |
| **R1C-17** | `REF-M19` within-frame near/far water, `REF-M6` rear-view ratio, §5a foreground/sky — unexpressible as queries. **(F9)** | **INFERABLE** | No search. Write a **triage checklist** the builder applies by eye to every candidate, and record the pass rate. The absence of this checklist is why 173 images produced 15 measurable ones. |
| **R1C-18** | `REF-M21` overcast, `REF-M14` rain, `REF-M20` fog — genuinely scarce. **(F11)** | **INFERABLE** | Do not keep BLOCKING past round 2. Measure the daylight population, apply diffuse-sky shifts, record `derived` per A3. |
| **R1C-19** | Frame-exact temporal calibration for hitstop (`RI-WPN05`, 2 f vs 8 f) is not obtainable from any published artifact at frame accuracy. | **IMPOSSIBLE** | Accept in writing. `RI-WPN05`'s hitstop **table** is already `constructed` and community frame-data video can corroborate *ordering* (dagger < ultra greatsword) but not absolute frame counts. State the risk; do not let this block the axis. |
| **G07** *(inherited, still open, still free)* | 24 Witcher 3 interval-run frames sit in `modern/hud/`, which A1 dissolved. They are the **only** interval-run frames in the project and the exact thing `exterior_daylight`/`exterior_lowlight` need for §3. | **BLOCKING (zero-cost)** | No download. Move the bytes, re-file `profile`, keep `has_hud: true`, record the deviation. This alone takes two profiles from 3 countable to ~15 and from 0% to >50% interval-run compliance. |
| **H1–H5** *(§1d)* | Manifest stale, provenance rewritten not merged, all 46 ER slots `REF-M-supplemental`, 3 `corroboration: unknown`. | **BLOCKING (hygiene)** | Re-run `make-manifest.py`; use `tools/refs/merge-manifest.mjs` for every provenance write; assign real `REF-M*` slot ids; move the 3 unknowns to `rejected/` per §8b. |

---

## 4. Ranked work list for the builder

Highest value first. Ranks 0–2 are free or nearly free and should be done before any download.

| Rank | Work | Why it is here | Gaps |
|---|---|---|---|
| **0** | Release the 24 Witcher 3 interval-run frames from `modern/hud/` into `exterior_daylight`/`exterior_lowlight` per A1. | **Zero downloads.** Takes the two largest profiles from 3 countable to ~15, and §3 anti-curation compliance from 0% to over half. Nothing else in this document is cheaper. | G07 |
| **1** | Re-run `make-manifest.py`; route every provenance write through `merge-manifest.mjs`; assign real `REF-M*` slot ids to the 46; move the 3 `unknown` to `rejected/`. | Every count anyone quotes is currently wrong, and provenance has already been destroyed once today. Do this before adding 700 more files. | H1–H5 |
| **2** | Write the **triage checklist** (F9) and apply it to both candidate pools before downloading anything. | 173 images produced 15 measurable ones because there was no criterion between "found" and "committed". Doing this second makes ranks 3–8 cheaper. | R1C-17 |
| **3** | **`refs/souls-behaviour/`** — create the tree, add `arena/` and `death/`, fill `camera/ attacks/ telegraph/ stance/ impact/ ui-combat/ arena/ death/` from my 734 candidates. | The user's explicit ask, the whole of A5, and six reference items with **no** visual reference. Dark Souls is at zero and this is the only work that changes that. | R1C-01, 06, 07, 10 |
| **4** | **`morrowind/REF-A12b/` + `REF-A20/`** — Morrowind menus and loading screens, 100 candidates delivered, two verified by eye. | The user's second explicit ask. A2 calls A12b the highest-value art-direction acquisition left, and it turns out cheap. Prefer **multi-window menu-mode** frames per F5. | R1C-03, 04 |
| **5** | **Re-acquire all 19 `REF-A*` slots at full frame** from app 22320, superseding the 320×320 crops. | F1 — the largest silent failure in the set. `RI-VIS05` is the corpus's highest visual-signal item and is currently judged against thumbnails. | R1C-02 |
| **6** | `interior_darkemissive` (0 countable), then `material_closeup` (0), then the second and third game in the two exterior profiles. | Three named `RI-VIS03` profiles that cannot be calibrated at all. Already researched in the prior 472 — download, do not search. | R1C-11, 12, 13 |
| **7** | Per-move attack animations from the Dark Souls wiki API, then V1/V2 into `refs/video/`. | `RI-AI02` and `RI-WPN01`–`04` cannot be judged without temporal reference, and V1/V2 are marked *required*. | R1C-05 |
| **8** | Creature/enemy design (79), shortcut composition (58), `context/` ESO (30), NPC posture (35). | Real gaps, lower leverage, all researched. | R1C-09, 14, 15, 16 |
| **9** | Write down R1C-18 as `derived` and R1C-19 as accepted-impossible, with the risk stated and the dependent bar lowered. | A3: a gap may not stay BLOCKING past three rounds, and a bar with no obtainable reference is a permanent self-inflicted fail. | R1C-18, 19 |

**Corpus amendments this critique requires** (filed, not proceeded on informally, per A5's own
closing paragraph):

1. **A5 gains two subfolders** — `arena/` (F3) and `death/` (F4).
2. **§5e gains a framing floor** — *full frame, native aspect, uncropped* for `refs/morrowind/`.
   This is the rule whose absence caused F1, and no existing sentence implies it.
3. **§5a gains a creature/enemy slot** (F6) and an **armour-at-2 m slot** (F7).
4. **A2's menu slots gain a multi-window requirement** (F5).

---

## 5. Dead ends — do not repeat these

**Mine, this round:**

| Dead end | Detail |
|---|---|
| Morrowind `searchText=spellmaking` | App 22320 returns **0 results**. Every other Morrowind menu query returns 5–15. Spellmaking must be found another way or classified SUBSTITUTABLE against the generic magic window. |
| `darksouls.fandom.com` HTML | Cloudflare interstitial, **HTTP 403** on `/wiki/...`. **`api.php` returns 200** — use it. |
| `static.wikia.nocookie.net` original bytes | Always transcodes to animated WebP. Verified with `Accept: image/gif`, on the bare path, and without `/revision/latest` — all three returned the identical 220,726-byte WebP against a stated 605,902-byte GIF. The true GIF bytes are **not obtainable**. Acceptable on the A5 axis only (`pixel_metrics_valid: false`); §4-violating anywhere else. |
| `searchText` semantics, reconfirmed | Matches the **uploader's title**, not the image. DS3 `fog gate` top hit (sid `1914625699`) is a dark cathedral exterior. Every candidate needs eyes. |

**Inherited from `ACQUISITION-CRITIQUE-R1-code.md` — still true, do not re-test:**
`/workshop/browse/?section=screenshots` returns the mod workshop for any app that has one;
Steam rate-limits the `/sharedfiles/filedetails/` detail endpoint hard (429s at 8 concurrent);
`HEAD` on `images.steamusercontent.com` returns a bogus `Content-Length: 92` for a sizeable
minority — use a ranged GET; the bare `ugc/<A>/<B>/` URL is the original and `?imw=5000` is an
Akamai re-encode; Skyrim SE's top-rated gallery is ENB/mod-contaminated and titles do not disclose
it; RDR2 and Witcher 3 galleries are photo-mode-heavy; `api.github.com` unauthenticated 403s;
`en.uesp.net` 403s (its own bot protection); Steam store trailers are all cut montages and cannot
serve V1/V2; "overcast" is genuinely scarce everywhere.

**A cheaper harvest route than the one used last round** (mine, verified): the **listing page card
already contains the bare `ugc` original URL** — regex `apphub_CardContentPreviewImage" src="…"` and
truncate at `/?imw=`. No detail-page fetch, so no 429 exposure. 734 candidates cost 47 listing
fetches. 36 of 36 sampled originals returned HTTP 206 on a ranged GET.

---

## 6. What would make round 2 return SUFFICIENT

Not "more images". Specifically:

1. `refs/souls-behaviour/` exists, with `arena/` and `death/`, and holds Dark Souls and Elden Ring
   frames against `RI-CAM01`, `RI-CAM03`, `RI-CAM07`, `RI-WPN01`–`06`, `RI-AI02` **by item id**.
2. `refs/morrowind/REF-A12b/` holds Morrowind's menus as pixels, including at least two multi-window
   menu-mode frames.
3. No image in `refs/morrowind/` is a square crop.
4. `MANIFEST.json`, `_provenance.json` and the disk agree, and every `REF-M*` and `REF-A*` slot id is
   either filled or reported unfilled by name.
5. Every remaining gap is classified, and no gap is BLOCKING for a reason nobody has named a search
   for.
