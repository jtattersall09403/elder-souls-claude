# W1-UIX08 — reading note: what I opened, and what I decided not to copy from each

**This is deliverable 1 of the item, not a courtesy.** `RI-UIX08` §0 exists because for months this
project's builders were told by the register that the dialogue references did not exist while they
sat on disk. §0 is a five-path table stating what each reference may and may not be cited for. This
note names every file I actually opened, what I took from it, and — the required half — **one thing
I deliberately did not copy from it.**

Task: `W1-UIX08-dialogue-window`. Branch `codex/wave1-build-experiment`. Written before any code.

---

## 1. `corpus/86-ui/RI-UIX08-dialogue-window.md` — the bar itself, read in full

Read end to end, including §F's two reversible rulings, the scoring ladder and §G. It is the
governing item and every geometry, colour and behaviour number below is quoted from it or from the
file it quotes.

**Not copied:** its §G human gate. Not because it is optional — the item says an unrun §G caps the
item at 2 once a build exists that can be played — but because a builder cannot run its own quality
gate (rule 22/25) and `create_session` is approval-gated here (rule 0). I build the **ablated arm**
§G requires and leave the gate unrun and scored `not_run`, rather than inventing a cheaper gate that
would answer a different question.

## 2. `corpus/70-visual/refs/morrowind/REF-A12c/REF-A12c-dialogue__mw-owner-20260814.png`

The owner's own 2376×1069 capture, OpenMW for Android. Opened at full resolution and looked at.
Confirms with my own eyes, not by quoting the item: bronze prose with **individual blue words inside
it at word granularity** (`alit hide`, `crab meat`, `netch leather` blue; `and`, `of commercial value
on Vvardenfell include the following:` bronze); `Mages Guild` blue and `Fighters Guild` bronze **in
the same sentence**; the speaker's name `Anarenen` centred in a **gap cut in the tiled border**, with
the beading running past the gap on both sides; `100/100` centred on a blue disposition fill; the
`Goodbye` button the full width of the topic column; and a **near-black interior** through which the
NPC's face and shoulders are visible behind the prose.

**Not copied — three things.** (a) **The green topic column.** It measures ~(144,196,146) and no
entry in the 45-entry `[FontColor]` table is that colour; every native capture renders that list in
`normal` bronze. Copying it would be `RI-VIS09` §6's hazard running backwards — degrading by copying
a reference's known defect. Our column is `#CAA560`. (b) **The Android chrome** — the hamburger top
left, the pause glyph top right, the backpack glyph, the translucent stick ring lower right. That is
the OpenMW-for-Android front end, not Morrowind, and counting it gives nine persistent elements where
the true figure is six. (c) **Its UI scale of 1.93**, which the item's own provenance note says is a
single-element estimate; I derive no absolute size from it.

## 3. `corpus/70-visual/refs/morrowind/REF-A12b/REF-A12b-dialogue__mw-3296790844.jpg` — the native control

Opened and looked at. This is the file that settles colour and the column's structure: the topic list
is **bronze**, not green; it is in **two sections** — `Persuasion` and `Barter` above a horizontal
rule, then `Background`, `Big Helende`, `Gateway`, `guild guide`, `Imperial cult`, `latest rumors`,
`little advice`, `little secret`, `Morrowind lore`, `my trade`, `Nerevarine`, `Sadrith Mora`
alphabetically below it; disposition reads `93/100`; the answer carries its topic as a **heading in a
lighter bronze** (`Service Refusal`) while the greeting above it carries none; and `services` and
`Sadrith Mora` are blue **inside** the prose.

**Not copied:** its pixel statistics. `_provenance.json` marks every file under `refs/morrowind/` as
`pixel_metrics_valid: false` — these are lossy web-sourced JPEGs. I use it for *what is where and in
what family of colour*, and take every numeric colour constant from `openmw.cfg` instead.

## 4. `corpus/70-visual/refs/morrowind/REF-A12b/REF-A12b-journal__mw-147283027.jpg`

Opened. §E5's claim is true and worth having seen: `'The Seven Curses'`, `Red Mountain`,
`Nerevarine`, `the moon-and-star` and `Nerevarine prophecies` are blue links **inside journal
entries**, on cream parchment with near-black ink and red date headings. The topic vocabulary is a
property of the world, not of the conversation.

**Not copied:** the journal's surface. This is the file that proves the orchestrator's "parchment
frame" description was describing the *wrong window*. The parchment, the red date headings and the
painted spine belong to `RI-UIX04`'s journal screen; our dialogue window's interior is near-black and
translucent. I note the link mechanism as a cross-surface fact and build it so the matcher is
reusable, but I do not touch the journal screen — it is not mine.

## 5. `corpus/70-visual/refs/morrowind/REF-A12b/REF-A12b-dialogue__mw-855656143.jpg`

Opened — and it is **not a dialogue window**. It is a face fill-frame with two floating
voice-bark plates (`If you're here for trouble…`, `There is someone watching me. I can tell.`) over
the world. Worth recording because §0's last column for these four says "do not cite for any claim
about a window they do not show", and this one shows none: an agent counting "five native dialogue
captures" and averaging them would be averaging in a file with no window in it.

**Not copied:** anything. Filed as a negative result.

## 6. `corpus/70-visual/refs/morrowind/REF-A12/mygui/openmw_dialogue_window.layout`

Read in full — it is 34 lines. Every geometry number I use is from here: window nominal `588 × 433`,
`MinSize 380 × 230`; history box `8 8 381 381` `Stretch`; history text a further 7 px inset;
scrollbar `370 13 14 371` `Right VStretch`, `Visible=false` until overflow; disposition
`398 8 166 18` `Right Top`; topic list `398 31 166 328` `Right VStretch`; Goodbye `398 366 166 23`
`Right Bottom`.

**Not copied:** its appearance, type or density — it is text, and §0 forbids citing it for look. And
specifically **not** `REF-A12/README.md`'s claim that "both columns `align` to stretch, so the ratio
holds as the window is resized." The layout file contradicts its own README: the three right-hand
widgets are `Right *` at a fixed 166, and the owner's capture proves it in pixels at 23.9% instead of
the nominal 28.2%. Our column is fixed in layout units and right-anchored; the prose absorbs every
pixel of extra width.

## 7. `corpus/70-visual/refs/morrowind/REF-A12/config/openmw.cfg` lines 71–115

Read. The 45-entry `[FontColor]` table, verbatim: `normal 202,165,96` (#CAA560), `header`/`normal_over`
`223,201,159` (#DFC99F), `link 112,126,207` (#707ECF), `link_over 143,155,218` (#8F9BDA),
`link_pressed 175,184,228` (#AFB8E4), `magic 53,69,159` (#35459F). These are the five families the
ΔE row is scored against.

**Not copied:** the other 39 entries, and in particular `fatigue 0,150,60` — the nearest green in the
whole table and still nothing like the owner's column. Its existence is the proof that the green is
not in the vanilla scheme at all rather than merely mis-sampled. Also not copied: `journal_topic
0,0,0` and `journal_link 37,49,112`, which are the journal's darker link families for ink on
parchment — a different surface with a different ground, and using them here would put near-black
links on a near-black panel.

## 8. `corpus/86-ui/RI-UIX06-diegesis-and-ui-style.md`

Read §A (material vocabulary), §B (the forbidden UI-kit set G1–G10), §C (RI-VIS01 appends, incl.
CC-7), §D/§E (F17/F18 metrics) and the scoring. UIX06 wins on house style; UIX08 wins on the
arrangement of this window.

**Not copied:** Morrowind's actual frame *art*. §A's material vocabulary is chitin, root, ink, wet
parchment, bone, resin and reed weave, and G10 fails "any element whose appearance is unchanged if
the game's setting changed". So the frame is the **construction** Morrowind uses — a tiled band, not
a stretched 9-slice; the name in a gap cut in the tiling, not on a plate — executed in this world's
materials. The arrangement is Morrowind's; the substance is Black Marsh's.

## 9. `game/src/render/ui.js`, `game/src/ui/surface.js`, `game/src/ui/system.js`, `game/src/ui/chrome.js`, `game/src/ui/type.js`, `game/src/character/converse.js`

The current surface. `render/ui.js` is the bottom-anchored vellum panel with an `opts[]` reply list —
the item's hard fail, confirmed at source, not assumed: `buildConversationModel()` maps every topic to
`options: [{id, text}]` and the panel draws them as a caret-selected menu. `surface.js` line 46
declares `topic_link` and `grep -rn topic_link game/src/` returns **one hit — the declaration
itself**. The seam for the central mechanism was cut and never used.

**Not copied:** `render/ui.js`'s architecture. The new window is built on `ui/surface.js`'s
`UISurface`, because `el()` is the only way to get a drawing context there and it clips a callback to
the rect it declared — so the element census and the pixels cannot disagree. `render/ui.js` draws
straight to a 2D context with no element declarations at all, which is exactly the "everything drawn
straight to canvas is invisible" failure `RI-UIX01` names. Building the new window in the old file
would have been half a day cheaper and unmeasurable.

---

## What the reading changed about the plan I was given

Four corrections, all from the files above rather than from memory of them:

1. The panel interior is **near-black and translucent**, not parchment. The parchment is the journal.
2. The topic column is **right-anchored at a fixed width**; extra width goes to the prose.
3. The green list is a **mod or a user setting**. Build it bronze.
4. **Morrowind marks no topic as read.** Read/unread marking is a post-2002 affordance, off by
   default, and §F1 rules it off reversibly.

And one thing none of the descriptions carried, which I only have because I opened the native
control: **the topic column has two sections separated by a rule** — what you can *do with this
person* above, what you can *ask them about the world* below.
