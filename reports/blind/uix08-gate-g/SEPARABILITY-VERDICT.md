# Gate G — separability verdict (third reader)

**Reader:** a fresh agent with no project context, who played nothing. Materials received and
used: the two players' five-question answers and preference answers under
`scratchpad/gate-g/work/` (player 1) and `scratchpad/gate-g/play/` (player 2), the unedited
screenshot directories under both, and `reports/blind/uix08-gate-g/SEPARABILITY-READER.md`.
Nothing else was opened — no reference item, no plan, no game source, no `sealing/`, no
`.reveal/`, no `pack.json`, no `leakcheck.json`, and no repository grep to explain anything read.

---

## Verdict

**SEPARABLE. No leak found. Disposition: row 2 of the reader's table — the gate returns, and
§G's ladder row applies.**

The pair is separable, decisively, and both players separated it on the same feature and in the
same direction. The arm lacking the mechanism (`osprey`) read worse to both. This is not `inert`
and it is not `void`.

Two qualifications travel with that pass and are not decoration; the second is a defect in the
instrument, not in the build.

1. **The difference is real but only partially reachable.** It is absent on 2 of the 6 NPCs
   sampled, and present-but-unnoticed on 2 more.
2. **Question 2 of the five presupposes the mechanism**, so the moment a player enters the
   ablated arm the instrument itself tells them what is being varied. This does not meet the
   brief's definition of a leak (it cannot be exploited *without playing*), so it does not void
   the pack — but it makes the *preference* answers weaker evidence than they look, and it should
   be reworded before this instrument is used again.

---

## 1. Reading only the answers, can I tell which arm is which?

Yes, immediately, and without ambiguity. Every one of the four answer documents keys on the same
binary: whether phrases inside what the NPC just said are coloured and can be followed.

`osprey`, player 1 (Q2):

> "in this build I never clicked a coloured word *in what the person said*. The prose is all one
> colour, top to bottom, and none of it responds. The only things you can pick are the entries in
> the list on the right-hand side"

`osprey`, player 2 (Q2):

> "There were no coloured words. I looked. In all five conversations every word in the left-hand
> pane was the same amber… I also deliberately put the cursor into the prose pane and pressed down
> and confirm several times with each person… Nothing highlighted, nothing moved, nothing happened."

`quillon`, player 1 (Q1):

> "in that sentence 'the Ninth Cohort' was written in a different colour. I went across to it and
> pressed confirm and he told me…"

`quillon`, player 2 (Q1):

> "some of the words inside what people say are coloured blue, and you can actually go into the
> paragraph and follow them."

**I can also state what the manipulation was**, which the brief asks me to declare if true: the
arms differ by the presence or absence of followable inline phrases in the speech pane. I derived
that from the answers and the screenshots only. That is a finding about how legible the
manipulation is once played; it is not a leak, because nothing available before or outside play
discloses it (see §3).

**The screenshots settle it independently of anything either player wrote.** Matched frames, same
NPC, same paragraph, opposite arms:

| what | `quillon` frame | `osprey` frame | difference |
|---|---|---|---|
| Sigurd, "Chorrol. Second son. No land. So: the Ninth Cohort." | `play/quillon/r3/017-look.png` | `play/osprey/r1/037-look.png` | "the Ninth Cohort" rendered blue-violet vs. plain amber; identical text otherwise |
| Ingunn, "My people were among the sap cutters who worked this stretch before the cart roads…" | `play/quillon/r2/044-look.png` | `play/osprey/r2/015-look.png` | "the sap cutters" and "the cart roads" blue vs. plain |
| Neekhu, "The carriers have raised their rate on the Thorn run" | `work/quillon/shots5/014-look.png` | (list-only in `osprey`) | "The carriers" blue and underlined under the cursor |
| Xeeth, "emptying the coast" | `work/quillon/shots1/021-look.png` | `work/osprey/shots1/021-look.png` | **none — the two files are byte-identical** |
| Ixthek, "background" / "latest rumors" | `work/quillon/shots3/031-look.png` | `work/osprey/shots4/031-look.png` | **none — zero coloured phrases in either arm** |

Measured over all captures (`md5` of every PNG in both players' directories, 420 files, 194
distinct images): **189 of 420 frames sit in groups that contain byte-identical frames from both
arms.** Per speaker, the fraction of frames having a byte-identical twin in the opposite arm:

```
Ixthek      24 frames   24 identical  100%
Xeeth      164 frames   89 identical   54%
Neekhu      44 frames   12 identical   27%
Sigurd      95 frames   20 identical   21%
Ingunn      24 frames    0 identical    0%
Wuxlukiul   18 frames    0 identical    0%
```

(The 0% rows are weak evidence on their own — an identical twin also requires the two players to
have taken the same action sequence — so I checked those two by eye instead; both carry inline
phrases in `quillon`, see §4. The 100% row for Ixthek is strong: every frame of that conversation
is the same file in both arms.)

## 2. Did the two players key on the same thing as each other?

**Yes — the same thing, in different words, and with the same sign.** This is the strongest form
of the signal the brief describes, and it converges on five separate points, each reached
independently (§5 shows the two accounts were sealed before the second arm was played):

- **The mechanism.** Both name inline coloured phrases in the speech and their absence in the
  other arm, quoted above.
- **The same exemplar, unprompted.** Both key on Sigurd's "the Ninth Cohort" out of his background
  line. Player 1: *"'So: the Ninth Cohort.' I did not translate his sentence into a topic and then
  go and find that topic in a sorted index."* Player 2: *"following it felt like putting a finger
  on the page and saying *that, tell me about that*."*
- **The same worst-thing class in the mechanism arm.** Both independently found the verbatim
  duplicate-append. Player 1: *"the identical paragraph was appended a second time, word for word,
  right below the first."* Player 2 (its Q5 headline): *"Following a coloured word for something
  you already asked reprints the exact same paragraph directly beneath itself, heading and all."*
  Player 2's `play/quillon/r2/032-follow.png` shows the two identical "the arrangement" blocks
  stacked.
- **The same worst-thing in the ablated arm.** Both name the split between an alphabetical column
  and a transcript that never acknowledges anything, and both single out the four "the road to
  Archon / Blackrose / Gideon / Stormhold" entries as the same furniture on every NPC.
- **The same direction of preference**, on the same reasoning. Player 1: *"in `osprey` the only
  live thing on screen was a sorted index in a separate column that never knew what had just been
  said."* Player 2: *"picking from an index is a different and duller act than following a thread."*

Where they differ, they differ in a way that strengthens rather than muddies the reading: player 1
hit a **dead** coloured phrase (Neekhu's "The carriers", confirmed three times, no response) and
called it the worst thing in `quillon`; player 2 never talked to Neekhu in the mechanism arm and so
never met it. I verified player 1's claim: `work/quillon/shots5/014-look.png` and `022-look.png`
are the same screen either side of three `follow` presses, with "The carriers" still coloured and
underlined and nothing appended. That is a build defect the pair surfaced, not a separability
problem.

## 3. Leak check — is there anything that could have told a player which arm was which *without
playing* it?

**No. I found no leak, and I looked at the places a leak would live.**

- **On screen.** Every capture is a full-viewport game frame: no browser chrome, no address bar, no
  console, no build banner, no version string. The only non-diegetic text is the state name
  `helstrom-market` bottom-left, which is character-for-character identical in both arms.
- **In the harness records.** Each `session.json` carries `"arm": "osprey"` / `"arm": "quillon"` —
  the codename the player already had — and `state`, `viewport`, per-step `action`, `speaker`,
  `disposition`, `column`, `cursor_in`. No field names or describes the manipulation. The action
  vocabulary is the same in both arms, including `follow`; the harness does not refuse `follow` or
  refuse to put the cursor in the prose pane in the ablated arm (`cursor_in: "prose"` occurs
  **66 times in `osprey`** and 101 in `quillon`), so nothing structural in the tooling betrays the
  arm before a player reads the screen. Player 2's Q2 confirms it behaviourally: they pressed
  confirm in the prose pane repeatedly in `osprey` and the harness accepted the input and reported
  nothing.
- **In paths and quotations.** Both players quote paths containing only the codename they were
  given (`work/osprey/shots1..4`, `work/quillon/shots1..5`). No filename, title or URL discloses
  arm identity.
- **In the codenames.** `osprey` and `quillon` are arbitrary and carry no relation to a text-link
  mechanism that I can construct. I note, and cannot check without opening `sealing/` (forbidden),
  that they happen to be in alphabetical order matching ablated-then-mechanism; if the pack builder
  assigned codenames by any rule rather than at random that would be worth fixing, but there is no
  evidence here that it did, and it is not exploitable by a player who does not know the rule.

### The instrument leak — named, and deliberately not scored as `void`

**Question 2 as put to both players is "When you clicked a coloured word, did it feel like
following something, or like pressing a button?"** That question presupposes coloured words. In the
ablated arm it therefore announces what is missing, and by implication which arm is the
manipulation and which is the control. Both players felt it and said so:

> Player 1, `osprey` Q2: *"I need to answer this slightly sideways, because in this build I never
> clicked a coloured word…"*
>
> Player 2, `osprey` Q2: *"This one does not apply, and I want to be exact about why rather than
> skip it."*

It also visibly changed player 2's behaviour — *"I also deliberately put the cursor into the prose
pane and pressed down and confirm several times with each person"* is a search conducted because
the question said there was something to find.

I rule this **not a leak under the brief's definition**, which is specifically about knowing which
arm is which *without playing*; this one costs a playthrough to exploit and cannot be used to
pre-classify an arm. So the pack is **not** `void`. But it is a demand characteristic pointing at a
preferred answer, and its effect falls entirely on the **preference** question, not on the
separability finding — which rests on pixels and on five independent convergences. A neutral
rewrite ("Describe how you asked about things people said. Did any of it feel like following
something?") would remove it at no cost, and I recommend it before this instrument runs again.

## 4. Is this pair separable at all?

**Yes — but the difference is reachable on some people and not others, and both players volunteered
this without being asked. They are right, and the true picture is slightly worse than the one they
described.**

Player 1, in the preference file:

> "For Ixthek the two builds are literally the same screens; for Xeeth, across five or six topics,
> I saw no coloured phrases at all… **If I had happened to play only Xeeth and Ixthek in both builds
> I would have written 'I cannot separate them'**, and that should worry whoever is reading this
> more than my preference should please them."

Player 2, in the preference file:

> "In both builds the first person I walked up to, Xeeth, had no coloured words in his prose at all
> — in quillon as well as osprey. **If I had judged quillon on Xeeth alone I would have called the
> two builds identical.**"

Both claims check out against the pictures and the hashes. Xeeth's `quillon` frames are byte-identical
to his `osprey` frames (`work/quillon/shots1/021-look.png` = `work/osprey/shots1/021-look.png`), and
so is every one of the 24 Ixthek frames. Player 2's deepest Xeeth screen in the mechanism arm
(`play/quillon/r2/018-look.png`, three full answers on screen) contains no coloured phrase anywhere.

**What neither player noticed, and what I think matters more:** the mechanism was *present* on two
NPCs where they reported nothing.

- **Ingunn**, `quillon` — `play/quillon/r2/044-look.png` shows "the sap cutters" and "the cart
  roads" coloured in her background answer. Player 2 spoke to her *after* Sigurd, i.e. already
  knowing coloured phrases existed, and never moved the cursor out of the column for the entire
  conversation (steps 35–44, `cursor_in: "column"` throughout). The links were on their screen and
  went unused and unmentioned.
- **Wuxlukiul**, `quillon` — `play/quillon/r3/025-look.png` shows "conclave" coloured. Not
  mentioned in any answer.

So of six NPCs sampled between the two players: **inline phrases absent on 2 (Xeeth, Ixthek),
present on 4 (Sigurd, Neekhu, Ingunn, Wuxlukiul), and actually reported by a player on 2 of those
4** — and on one of those two (Neekhu) the phrase was dead when pressed. The honest summary is that
the pair is separable, that separation is carried almost entirely by Sigurd, and that a player who
walked up to the first NPC in the market would have seen no difference at all in either build.

That is a scope limit on the pass, and it belongs next to the ladder row rather than in a footnote:
**the mechanism separates the arms where it fires, it does not fire on the most obvious first NPC,
and it is dim enough** — player 1: *"the highlight colour is a blue-violet on amber-on-dark, and it
is dim. Twice I read a whole answer before spotting there was anything live in it"* — **that it can
be on screen and still not reach the player.**

## 5. Did the claimed discipline actually hold?

**Yes, and it is checkable rather than merely asserted.** Both players say their first arm's answers
were written and saved before the second arm was started. File modification times against the
harness's own session timestamps:

| player | first arm runs | first-arm answers last modified | second arm's first run |
|---|---|---|---|
| player 1 (`work/`) | `osprey` 10:20:50 → 10:46:17 | `ANSWERS-osprey.md` **10:47:16** | `quillon` **10:51:19** |
| player 2 (`play/`) | `quillon` 10:21:05 → 10:49:44 | `ANSWERS-quillon.md` **10:51:09** | `osprey` **10:56:54** |

Because these are *last*-modification times, each first-arm document was written after its own runs,
before the other arm was launched, **and never touched again**. The claim is not merely honest, it is
verified. The two players also played in genuinely opposite orders, as designed.

**No first-arm answer reads like a comparison.** I checked for the specific tell. Player 1's
`osprey` document never mentions that coloured or followable phrases exist anywhere — its Q2 is
written as an observation about a single build ("The prose is all one colour, top to bottom") plus a
sideways note that the question does not fit, which is explained by the question, not by foreknowledge.
Player 1's forward-looking line — *"If the same text were delivered any other way I'd want more of it
immediately"* — is a hypothetical, not a report of a second build. Player 2's `quillon` document
never mentions a build lacking the mechanism; its sharpest self-criticism, *"every blue word turns
out to be an entry in the list on the right. Nothing is only in the prose,"* is derivable inside
`quillon` alone.

The **second**-arm documents are, correctly, not naive — player 2's `osprey` Q2 describes a
deliberate hunt for links, which only makes sense having played `quillon`. That is inherent in a
within-subject design and is exactly what the counterbalanced order exists to absorb; it was
absorbed, because the naive first-arm account of each arm exists and they agree with each other.

Both players also put their revisions in the preference file rather than editing the sealed answers,
as instructed, and both revisions run *against* their own preference rather than for it — player 1:
*"Two things in `quillon` are worse than anything in `osprey`, and I want them on the record next to
the preference"*; player 2: *"Osprey made me realise that quillon's links are not doing as much as
they felt like they were doing while I played."* That is the behaviour of players following the
protocol, not players flattering it.

## What I could not determine

- **Whether the codename assignment was random.** Checking would require opening `sealing/`, which
  the brief forbids me. The alphabetical coincidence noted in §3 is a thing to rule out at pack
  build, not a finding.
- **Whether the two absent-link NPCs (Xeeth, Ixthek) are absent by design or by defect.** Deciding
  would need the plan or the source, which I did not open. What I can say from the materials is
  that the absence is identical in both arms — so it is a property of the content, not of the
  ablation — and that it materially reduces how reliably a player meets the difference.
- **Whether the dead phrase (Neekhu's "The carriers") and the verbatim duplicate are one bug or
  two.** Both are reproduced in screenshots; diagnosing them is not this reader's job.
- **How the ~5 NPCs neither player visited behave.** Six of the twelve people listed in the market
  (`Xthari-Shuja`, `Anxthari`, `Sheem`, `Shu-Kaan`, `Anxal`, `Tsawux`) were never approached in
  either arm, so the present/absent split above is measured on half the population.

---

## Disposition, stated plainly

Applying the reader's table:

> **reader says: separable, no leak found · players say: the arm without the mechanism read worse,
> ≥2 players → the gate returns, and §G's ladder row applies.**

Both players preferred `quillon`; both located the reason in the same mechanism; both first-arm
accounts were sealed before the second arm and agree with each other; the screenshots show the
difference directly. I record, against the pass and not as a caveat to be dropped in summary: the
mechanism does not fire on 2 of 6 sampled NPCs including the first person a player meets, it went
unnoticed on 2 more where it was present, one instance of it is dead on press, and the instrument's
own question 2 told both players what was under test the moment they entered the ablated arm.
