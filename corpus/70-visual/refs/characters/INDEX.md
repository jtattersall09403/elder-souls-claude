# The character reference set

**This is the set `CLAUDE.md`'s "character directive" requires, and the thing `F10` was blocked on.**
The owner, verbatim: *"the player character and every NPC when I load the game look frankly
ridiculous… I suspect some serious work is needed to build out the set of reference images/gifs for
builders to use as their target and for critics to compare against. They could be compared against
Skyrim and ESO images and gifs for example… Builders must look at the actual reference images/gifs to
guide their work, and must look at actual screenshots and motion captures (e.g. rotating the camera
around the player to view from multiple angles) — **stills are not enough** — from our actual game;
critics must as well."*

**Open the files. Do not read this page instead of them.** A builder who has read this index and
opened nothing has built from imagination, which is the failure this set exists to end.

---

## §1 What it is, in numbers

Generated, not typed. `node tools/visual/character-refs.mjs` derives the whole routing from
`corpus/70-visual/refs/MANIFEST.json` at run time, checks every routed path exists on disk, and
writes `character-reference-set.json` beside this file. Re-run it rather than trusting the table
below; it exits non-zero on a missing file, an underrun floor, or an `n=0` slot with no stated
reason.

```
node tools/visual/character-refs.mjs           # rebuild
node tools/visual/character-refs.mjs --check    # fail if the committed JSON has drifted
```

**As of this writing: 13 slots, 252 distinct files, 210 of them motion, 1 slot at n=0.**

| Slot | n | floor | What it is |
|---|---:|---:|---|
| **C1** | 3 | 3 | Humanoid at close range — face, head and shoulders, **well lit** |
| **C2** | 3 | 2 | Humanoid at close range — **low light / night** |
| **C3** | 4 | 3 | Humanoid at **mid distance** on the third-person gameplay camera |
| **C4** | 25 | 12 | **Full-body** humanoid, head to foot, plain backdrop |
| **C5** | **0** | 0 | **Full-body turnaround / camera orbit** — see §5. Genuinely empty. |
| **M1** | 3 | 2 | **MOTION** — humanoid locomotion: run, stop, turn, no cuts |
| **M2** | 12 | 4 | **MOTION** — humanoid attack chains and committed actions |
| **M3** | 7 | 4 | **MOTION** — humanoid dodge, quickstep, parry |
| **M4** | 6 | 3 | **MOTION** — humanoid NPC/enemy telegraph |
| **M5** | 46 | 20 | **MOTION** — humanoid boss movesets, one action per file |
| **K1** | 5 | 3 | Non-human creature, still |
| **K2** | 136 | 40 | **MOTION** — non-human creature |
| **D1** | 4 | 4 | **Scaled/reptilian humanoid — the race we actually ship** |

---

## §2 What was already here, and had been for over a week

**Read this section before proposing any acquisition.** This project has now recorded the same
defect four times — a document telling builders a reference does not exist while the bytes sit on
disk — and it cost eight days on `REF-A12b`, a week on 33 Morrowind interface captures, and a whole
misdirected prioritisation on Thorn's `n=0`. **Almost everything in the table above was already
vendored.** Of 252 routed files, **227 were on disk before this piece started**; 25 were added.

Measured this turn, not remembered:

- **`modern/character_closeup/` holds 13 images, not one.** `ls corpus/70-visual/refs/modern/character_closeup/ | wc -l` → 13.
  Nine Elden Ring (Melina at 1920×1080, Malenia at **3840×2160**, six Godrick), two Witcher 3 (one at
  **3840×2160**), two RDR2. `RI-VIS09` §1's table and §3.1 both still describe this folder as holding
  one image. They are wrong, and §3.1's "five of six `modern/` profile folders are empty" is wrong
  about every one of them: `combat` 12, `exterior_daylight` 43, `exterior_lowlight` 24,
  `interior_darkemissive` 22, `material_closeup` 9, `ui` 8.
- **`modern/hud/` does not exist.** `ls corpus/70-visual/refs/modern/` returns seven directories and
  `hud` is not among them, while `RI-VIS09` §1 tables it at 24 files.
- **`context/ESO-argonian_character__*.jpg` — four close-range Argonian plates, on disk since
  2026-08-06** (`ls -la corpus/70-visual/refs/context/`). This is the closest reference the project
  holds to the race it actually ships, the owner named ESO by name, and `RI-VIS09` §2 routed it to
  nobody: *"`refs/context/` … may be cited by neither as a target."* **The plates were never missing.
  The route was.** §4 below is that route, and §6 states its limits.
- **207 animated sequences and 10 videos were already registered.** The motion half of this piece was
  very largely already paid for; what it lacked was a table saying which of them is a *person*.

**What is new: 25 files.** `modern/character_fullbody/` — Skyrim full-body armour renders, male and
female, across leather, blades, Stormcloak officer, wolf, orcish, ebony, dwarven, glass, dragonscale,
steel plate, elven, steel and iron. 900×1844 up to **2470×3568**. Source
`elderscrolls.fandom.com`; each record carries its own `licence` and `licence_position` because the
blanket statement in `refs/LICENCE-NOTE.md` names only Bethesda-Morrowind, CD PROJEKT RED and
Rockstar, and that note's own rule is that a differing provenance must not silently inherit it.

---

## §3 The pairing table — which of our captures each slot is the counterpart to

**This is the half that makes the set usable.** A reference nobody can pair with one of our own
frames is decoration. Every row names the capture *we* must take to stand opposite it, at matched
framing.

| Slot | Reference side | **Our side — capture this** | Property under judgement |
|---|---|---|---|
| C1 | `modern/character_closeup/REF-ER__steam-dyules-2764067250.jpg` (Melina, facial close-up)<br>`…REF-ER__steam-dyules-2764143936.jpg`<br>`…REF-W3__steam-1902321246.jpg` | `character_closeup`, subject **≥ 40% of frame height**, daylight, gameplay camera | RI-VIS08 §B3 material separation · §B8 eyes · **RI-VIS10 §B** face |
| C2 | `context/ESO-argonian_character__steam-1536362381.jpg`<br>`…steam-1634540211.jpg`<br>`modern/character_closeup/REF-W3__steam-1399085215.jpg` (3840×2160, night) | the same close-up at 21h, or an interior lit by **one** emissive source | RI-VIS08 §B3 · §B6 skin response · **RI-VIS10 §B** |
| C3 | `…REF-M6__rdr2-horseshoe-overlook-camp.jpg` (Arthur from behind)<br>`…REF-RD__steam-2125085097.jpg`<br>`modern/combat/REF-SK__steam-3386533615.jpg`<br>`…REF-RD__steam-3478652244.jpg` | the **real opening path**, player from behind, at 2–3 m and at 8–10 m | RI-VIS08 §B1 faceting · §B5 contact shadow · **RI-VIS10 §C** |
| C4 | all 25 of `modern/character_fullbody/` | **orbit** the player at 0/45/90/135/180/225/270/315°, whole figure in frame each time | RI-VIS08 §B1 · §B7 weighting · **RI-VIS10 §C** proportion · **§D** dress |
| **C5** | **nothing — n=0** | the orbit above, as a **moving derivative**, is still owed regardless | RI-VIS08 §B1 all round |
| M1 | `video/V3-locomotion__dsr-longplay-t11990.mp4` (30 s, rear camera, run→stop→turn, no cuts)<br>`video/V3-locomotion__ghost-of-tsushima-combat.mp4`<br>`video/V1-dolly__elden-ring-liurnia.mp4` | `capture-trace --scenario locomotion_flat / locomotion_slope20 / locomotion_stairs`, **plus** the moving derivative | RI-VIS08 **C1** sample rate · **C3** foot slide · **C4** root motion |
| M2 | 12 GIFs in `souls-behaviour/anim/attacks/` (ER longsword neutral and strong chains at 600×338 / 700×395 are the two to start from) | `capture-trace --scenario attack_chain` | RI-VIS08 **C2** jerk · **C5** blending · **C7** weapon attachment · **C10** variety |
| M3 | 3 quickstep GIFs at up to 720×405, 4 parry GIFs at 600×338 | `capture-trace --scenario hit_reactions`, plus the roll/dodge sequence | RI-VIS08 **C2** · **C3** · **C5** |
| M4 | 4 Leyndell knight/soldier telegraphs, 2 Lansseax | an NPC in the world, **orbited**, plus its attack telegraph in motion | RI-VIS08 **C10** · **C5** · RI-AI01 telegraph legibility |
| M5 | 46 DS1 humanoid-boss moves (Artorias, Ornstein, Smough, Manus, Four Kings, Nito, Pinwheel), one action per file | every humanoid enemy archetype we ship, per action | RI-VIS08 **C2** · **C5** · **C10** |
| K1 | `modern/combat/REF-SK__steam-3357576452.jpg` (spriggan), `…3421508541.jpg`, `…REF-RD__steam-3006591869.jpg`, `…REF-ER__steam-dyules-2764357311.jpg`, `…REF-ER__steam-neulyiaa-2778374701.jpg` | `creature_closeup` per bestiary archetype **plus the 40 px mask** (RI-VIS08 §D1) | RI-VIS08 §B6 subsurface · §D1 readability · RI-VIS05 §D4 |
| K2 | 136 creature-motion GIFs | every shipped creature, in motion, orbited | RI-VIS08 **C2** · **C9** secondary motion · RI-VIS05 §D4 |
| D1 | all 4 of `context/ESO-argonian_character__*` | our Saxhleel/Argonian player and NPCs, close and mid, lit and dark | **RI-VIS10 §B/§C/§D** · RI-VIS08 §B6 — **read §6 first** |

---

## §4 Routing, and what each side is allowed to do with these files

`RI-VIS09` §2 is the register and it governs. This section adds the character rows and does not
soften anything.

| File set | May be cited | May **not** be cited |
|---|---|---|
| `modern/character_closeup/`, `modern/combat/`, `modern/character_fullbody/` | **FIDELITY only** — RI-VIS08 §B and §C | as an ART_DIRECTION target, ever (RI-VIS01 **CC-2**) |
| `modern/character_fullbody/` specifically | silhouette, proportion, armour construction, material separation | **any** RI-VIS03 band, any `reference-metrics.json` population, any framing/sky/composition statistic — see §5 |
| `souls-behaviour/anim/**`, `video/**` | motion, **only** action-matched and preregistered under RI-VIS09 §5a | texture, colour, anti-aliasing, sharpness — never, these are compressed pixels |
| `context/ESO-argonian_character__*` | **FIDELITY**, construction quality only, under **RI-VIS10 §A2**; and as a **divergence anchor** on the design side | as an ART_DIRECTION *target* — our people must not converge on ESO's Argonians (RI-VIS05) |

**The one rule that catches everybody:** RI-VIS01 CC-2 voids any verdict that cites a modern AAA
reference while its declaration says `ART_DIRECTION`. Every file in this set except the Morrowind
material is modern. **So the design item (`RI-VIS10`) cites none of them as a target** — it is scored
against its own written bar and against Morrowind's transposition, and the modern plates reach it
only through RI-VIS08's fidelity pass. If you find yourself wanting to say "our Saxhleel should look
more like that ESO one", you are writing a fidelity finding, not a design one.

---

## §5 What is missing, stated up front

1. **C5 — a full-body turnaround or camera orbit of one modern humanoid — is `n=0`, and it is the
   one artefact the owner named by example.** The search that was run this turn, so nobody repeats
   it: the MediaWiki APIs of `elderscrolls.fandom.com` and `eldenring.fandom.com`
   (`list=search` in namespace 6; `list=allimages` with `aimime=image/gif`; `aiprefix` over
   Roll/Sprint/Running/Walk/Backstep/Dodge/Turn/Jump/Idle/Locomotion) surfaced no humanoid turnaround.
   The two entries that would have been exactly right — *"Elder Scrolls Online -- Argonian Male /
   Female - Character Creation"* — are `mime: video/youtube`, i.e. embeds with no file behind them.
   `web.archive.org` returns `000` from this container. **What would fill it:** any hash-pinnable
   clip of a single character rotating on the spot, registered under RI-VIS09 §5a.
   **What must not fill it:** the 25 C4 plates read as if they were one figure from many angles.
   They are 13 different figures from one angle. That is not the same claim and the difference is
   exactly the one that let a transparency defect be declared fixed from a single still.
2. **No Skyrim or ESO *motion* exists in this set.** Every motion row is Dark Souls, Elden Ring,
   Ghost of Tsushima, RDR2 or Morrowind. On stills the owner's named standard is now met; on motion
   it is not.
3. **The 25 `character_fullbody/` plates are not composition-valid and carry
   `pixel_metrics_valid: false`.** They are subject crops on a plain backdrop — no scene lighting, no
   depth of field, no post chain — so every whole-frame statistic on them measures the backdrop.
   **Every framing/sky/composition count over that folder is `n=0`, by construction.**
   A trap worth naming: `docs/art-direction/measure-plates.mjs` line 318 computes
   `composition_valid: true` for any non-ART record whose `framing` is not the exact literal
   `'square crop, not the native aspect'`. These records carry
   `framing: "cropped to subject, not the native aspect"`, so that predicate would return `true` for
   them and it would be wrong. The records carry a `framing_note` saying so. The one-line fix belongs
   to whoever owns the art-direction board, not to this set.
4. **Nothing here has been paired with one of our own captures yet.** §3 names the counterpart for
   every slot; none has been taken. Until they are, this set is a target with nothing beside it.
5. **`identified_by` on the new plates is file-level** — the wiki page names the armour set and the
   body it is rendered on. That is stronger than the Morrowind set's slot-level identification and
   weaker than a two-host corroboration. `corroboration: "one-host"` on all 25.

---

## §6 How this set gets misused

- **Reading the index instead of the plates.** The directive is explicit and this is the first way to
  fail it. There are 252 files; open them.
- **Judging a still and calling it motion.** 210 of the 252 are moving for a reason. A character
  verdict built only from `C1`–`C4` has not touched `F10` at all, which is animation.
- **Promoting `character_fullbody/` into a numeric band** because it is the sharpest character
  imagery in the tree at 2470×3568. It is a menu render on a grey card. This is the same argument
  `RI-VIS09` §6 predicts for `modern/hud/`, and the answer is the same.
- **Letting ESO become the design target.** `D1` is four plates of somebody else's Argonians. They
  are here because the owner named ESO as the **quality** standard and because we ship a scaled
  reptilian humanoid and had no reference for one. `RI-VIS05` is unambiguous that the world must not
  converge on ESO, and `RI-VIS10 §A2` carries that ruling for characters with its reversal condition.
  **Reversible:** if a critic shows our Saxhleel reading as an ESO Argonian recolour, the correct
  response is to demote `D1` to a pure divergence anchor, not to argue the routing.
- **Comparing a 210×118 boss GIF against a 1080p capture and calling the difference a finding.**
  Half of `M5` and most of `K2` are thumbnails. They carry *timing and behaviour*, and RI-VIS09 §5a
  requires the mismatch to be recorded before ours is judged, not discovered afterwards.
- **Quietly adding files without re-running the tool.** `character-reference-set.json` is generated.
  Hand edits are lost on the next run, and `--check` is how a reviewer catches it.

---

## §7 Provenance and licence

Every image here is a screenshot or render of a commercial video game and remains under its
publisher's copyright. `refs/LICENCE-NOTE.md` carries the position for the tree; the 25 files in
`modern/character_fullbody/` carry an explicit `licence` and `licence_position` of their own because
their publisher (Bethesda, for Skyrim) and their host (Fandom) are not in that blanket statement.
They are retained solely as internal reference for comparison and critique of our own characters.
They are not redistributed, they are not source material for any asset, and no derivative is made
from them.

The **routing in §3 and §4 is `constructed`** — this file's own authoring, derived from
`CLAUDE.md`'s character directive, `RI-VIS08` §B/§C/§D, `RI-VIS09` §2 and `RI-VIS01` §A. The
**counts in §1 and the file inventory in §2 are `measured`**, produced by
`tools/visual/character-refs.mjs` over `MANIFEST.json` and reproducible by re-running it.
