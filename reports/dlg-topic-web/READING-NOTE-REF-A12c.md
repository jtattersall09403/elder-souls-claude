# Reading note — REF-A12c, read before any content edit

**File opened:** `corpus/70-visual/refs/morrowind/REF-A12c/REF-A12c-dialogue__mw-owner-20260814.png`
(2376x1069, the owner's own 2026-08-14 capture; OpenMW-for-Android, speaker "Anarenen").
**Read by:** `W1-DLG-TOPIC-WEB` builder, 2026-08-14, before the first byte of content was written.
**Why:** `orchestration/plans/W1-DLG-TOPIC-WEB.md` §3 makes this the builder's first deliverable and
`RI-UIX08` §0 routes it here as the one reference about *writing* rather than about pixels. A1's
floor is supposed to be checkable against a real artefact rather than taste (§5).

## What is actually in the frame

Four answers are stacked in the reply pane; three are legible.

| answer | shape | links | prose length | density |
|---|---|---|---|---|
| `latest rumors` | scrolled off the top, only its last line survives | — | — | — |
| `animal products` | **enumeration** — *"Animal products of commercial value on Vvardenfell include the following: …"* | **17** | ~40 words | ~1 link per 2.4 words |
| `vegetable products` | **enumeration**, same sentence frame | **26** | ~50 words | ~1 link per 1.9 words |
| `someone in particular` | **running narrative prose** — who lives where, who is steward of what | **2–3** (`Mages Guild`, `Imperial cult`) | ~75 words | ~1 link per 30 words |

## The three things I took from it

1. **The "roughly sixty links in one answer" figure in the plan is the frame, not an answer.**
   17 + 26 + 2 ≈ 45 visible, plus whatever the scrolled-off `latest rumors` answer carries. **No
   single answer in this frame carries sixty links.** The plan's §3 and §5 sanity check should be
   read as *sixty links in one screenful of dialogue*, and the per-answer range Morrowind actually
   ships in this frame is **2 to 26**. That is a correction to a figure this plan leans on, and it is
   recorded here rather than quietly used, per §5's own invitation.

2. **Density is a function of the answer's shape, not a constant.** An answer that *enumerates* is
   nearly all links; an answer that *narrates* is nearly none. So a per-occurrence floor like A1's is
   only honest if the corpus is allowed both shapes — and our corpus is overwhelmingly the second
   shape. This is the strongest single piece of evidence available offline that A1's 90% is a hard
   number for this corpus, and it is why §10.1 is right to call it the likeliest failure.

3. **Morrowind leaves proper nouns unlinked in the same sentence where it links another.**
   `Mages Guild` is blue and **`Fighters Guild` is bronze, one line apart, in the same paragraph**;
   `Brara Morvayn`, `Hlaren Ramoran`, `Athyn Sarethi`, `Garisa Llethri`, `Miner Arobar`,
   `Bolvyn Venim`, `Edwinna Elbert`, `Percius Mercius`, `Raesa Pullia`, `Imsin the Dreamer` and
   `Goren Andarys` are all named and none of them is a link. **A link means "there is a topic
   behind this word", not "this word is important."** That is the discipline the marking has to
   carry, and it is the opposite of colouring every proper noun — which is exactly the way
   `RI-UIX08` §C1's recall row can be reached dishonestly from the window's side (§2a).

## The one thing I decided NOT to copy

**The enumeration idiom.** *"Animal products of commercial value on Vvardenfell include the
following: alit hide, crab meat, dreugh wax, …"* is a keyword list wearing a sentence, and it is
how Morrowind hits 26 links in 50 words. Copying it would let this build reach A1's 90% floor
mechanically — write one list answer per hub topic and the ratio moves — while producing precisely
the FAQ the owner complained about. §10.1 names this as the way this piece fails with every row
green, and §6's text pack exists to catch it.

**So the rule I am writing content under:** a destination's label goes into the prose only where a
person would actually say that phrase in that sentence. Where it will not go in without turning the
answer into a list, the honest outcomes are the ones §4C already allows — flag the edge
`implied`, or delete it under the 200-edge cap — **not** a list.
