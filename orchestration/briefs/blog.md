# Brief: the build blog

You write for **someone who has played both Morrowind and Dark Souls, and cares about them.**
They know what i-frames are. They know what poise and stamina do, what a silt strider is, why
Vvardenfell felt different from every open world since. They have opinions about the Telvanni.

**They are not a developer or a game designer.** So:

- **Game-side vocabulary you may use freely**: i-frames, poise, stamina, lock-on, backstab,
  hitbox, fog gate, bonfire, topic list, disposition, Great House, faction rank, the journal.
- **Developer vocabulary you must explain the first time it appears in a post**: frame data,
  determinism, root motion, LOD, PBR, swept capsule, streaming, heap allocation, seeded RNG.
  One clause is usually enough — "root motion, meaning the animation drives the character's
  movement rather than the other way round" — then use it freely for the rest of the post.
- **Game-design vocabulary is welcome and interesting, but introduce it**: encounter design,
  telegraph, punish window, pacing curve, difficulty gating, readability, systemic depth. These
  are often the *most* interesting part of a post, because they name something the reader has
  felt while playing but never had a word for. Give them the word and the definition, then use it.

The register to aim for: talking to a friend who loves these games and would enjoy knowing how
the sausage is made, without pretending they already work in the industry.

## Cadence

**Post often and post short.** The default is a **dispatch**: 300–600 words on one thing that
happened, with at least one image. Not a milestone summary — one verdict, one fix, one discovery.
Roughly one per critic verdict filed, one per interesting fix landed, and one whenever something
turns up that would make the reader laugh or wince.

Aim for **several posts a day** while the build is moving. If three verdicts land in an afternoon,
that is three posts, not one round-up. A round-up flattens the specifics, and the specifics are the
entire appeal.

The long form still exists — a **feature**, 900–1,400 words — but only for a wave completing, a new
seam ruling that changes the shape of the game, or a region standing up for the first time. Expect
roughly one feature per five or six dispatches.

**Never post to say nothing happened.** A dispatch needs a fact that was not true yesterday.

### What to write dispatches about

Not an exhaustive list, and not a rota — pick whatever is genuinely the most interesting thing
sitting in the repo that hasn't been written about:

- **A verdict and why it failed.** The score, the single biggest gap in the critic's own words, and
  what the builder had believed was working. Show the images the critic compared.
- **A fix, and what it turned out to be.** Especially when the diagnosis was wrong first — the
  `block_score` business, where "Steam re-encodes screenshots" was a confident wrong answer and the
  real cause was exposure, is a better post than a fix that went to plan.
- **A side-by-side that we lose.** Our shot next to the reference it was judged against, with an
  honest account of the distance. These are the posts the reader will most want.
- **A measurement that surprised us.** Numbers the reader can hold: the trunk road running 502m
  underwater, dialogue word counts, tip speed 2.69× declared.
- **A new seam ruling.** Two things were in conflict and a decision got made. Say what both sides
  wanted and why one won.
- **A disagreement.** When a builder refused its brief, or a critic and the doctrine collided.
- **What a region actually looks like now**, against what the standard says it should.
- **Something that is still bad.** Post these deliberately. A blog that only reports progress reads
  as marketing within about three posts.

## Where things go

- Posts: `docs/blog/YYYY-MM-DD-slug.md`, with front matter `title`, `date`, `summary`. Several posts
  a day share a date, so the slug carries the distinction — make it specific (`w1-01-drowned-road`,
  not `progress-update`). Add `kind: dispatch` or `kind: feature`.
- **Append one line to `docs/blog/COVERED.md`** for every post: the slug and, in a few words, the
  fact it covered. Posts are frequent enough now that reading all of them before writing is
  wasteful; read the ledger first, then only the two or three posts nearest your subject. If the
  ledger does not exist, create it.
- Screenshots: copy into `docs/shots/` and reference as `../shots/<file>.png`.
- **Hard-wrap the markdown source** at a comfortable width. That is fine and correct: the renderer
  joins consecutive wrapped lines into one paragraph, and joins indented continuation lines into
  the bullet above them. Both used to be rendering bugs that put a break mid-sentence; both are
  fixed. Do not reformat posts into single-line paragraphs to work around it.
- Regenerate with `node tools/progress.mjs && node tools/blog.mjs`, which writes `docs/index.html`.
  GitHub Pages serves `/docs` from the working branch. **Always run both, and check the page
  actually contains your post before finishing.**

## Getting screenshots

The game is real and runnable. Capture fresh images rather than reusing old ones:

```
node tools/harness/shoot.mjs        # canonical viewpoints -> reports/runs/SHOTS/
```

Existing captures live in `reports/runs/SHOTS/` and `reports/region-shots/`. Pick shots that show
**what changed since the last post**. Prefer four good ones to twelve repetitive ones. Caption every
image in the alt text so it reads properly to someone skimming.

Note the renderer draws images at 16:9 with `object-fit: cover` inside a comparison block, so a
shot whose subject is at the very top or bottom of the frame will get cropped. Check the rendered
page, not just the source file.

## Side-by-side comparisons

The comparisons the critics run are the most interesting images the project produces, and there is
a block for them:

```
:::compare The trunk road between Stormhold and Helstrom, and what it is supposed to look
like at the waterline. 502 metres of it sit above chest height under water.
![Ours — Stormhold to Helstrom, mid-route](../shots/2026-08-06-drowned-road.png)
![Reference — RI-VIS11, a causeway carried above a tideway](../shots/ref-causeway.jpg)
:::
```

Any number of images; **two or three read best**. Each image's alt text becomes its visible label,
so label them properly — say which is ours and which is the reference, and name the reference item
so a curious reader can look it up. The caption runs underneath the row. Images are clickable
through to full size.

**Where the comparison material lives:**

- `corpus/90-verdicts/wave1/artifacts/<piece>/` — the actual images the critics captured and judged.
  These are the primary source. `W1-01/shot-drowned-road-*.png`, `W1-00/vista-primary-*.png` and
  the like.
- `corpus/70-visual/refs/` — 461 reference images across `morrowind/`, `modern/`,
  `souls-behaviour/`, `context/` and `anti-generic/`. `MANIFEST.json` maps each to its item ID and
  says what it is; read it rather than guessing from filenames.
- `reports/region-shots/` — the regional variation sweep, useful for showing two regions that are
  supposed to look nothing alike and currently do.

Copy both sides into `docs/shots/` (keep the reference's original filename stem so provenance is
traceable) and reference them as `../shots/<file>`. Do not link into `corpus/` — the published site
only serves `docs/`.

**Be straight about which way the comparison goes.** If ours lost, the post says ours lost and by
how much. Do not pick the flattering pair. The reader can see the images.

## How to write

**Rules, in priority order:**

1. **Explain developer terms once, then use them.** Not "we implemented deterministic
   fixed-timestep simulation" cold, but "the simulation now runs on a fixed 60-per-second clock
   that is the same every run — deterministic, meaning identical inputs always produce an
   identical result, which is the only reason any of our measurements mean anything." After that,
   say "deterministic" freely. Never define i-frames or poise; the reader knows.
2. **Show the thing.** Every post has at least one image. A post about the world has a picture of
   the world.
3. **Be honest about failure, and specific about it.** The failures are the most interesting part
   and they build trust. "The first piece failed its review twice" is a better sentence than
   "progress continues." When a critic catches something, explain the catch in a way a lay reader
   can enjoy — the random-number generator that was never used, the save system that worked for
   four seeds out of forty. These are good stories.
4. **Numbers are the point, and this reader enjoys them.** "DS3's light roll gives 13 i-frames
   at 30fps, so 433ms — ours has to match, which at our 60Hz clock means 26" is exactly right.
   Raw internal shorthand like "TTNIT median ≤45s" still needs unpacking: "you should never walk
   more than about 45 seconds without something worth stopping for."
5. **Short paragraphs. No bullet-point soup.** Prose, mostly. Bullets only for genuine lists.
6. **British English, always.** The author is British and the register is British. Use -ise not
   -ize (realise, recognise, prioritised, organised), and colour, behaviour, grey, metres, maths,
   towards, whilst-if-you-must, "learnt". Avoid Americanisms: "gotten", "off of", "different
   than", "reached out", "a ways", "math", "z" spellings. **Exception:** `corpus/` filenames,
   code identifiers, JSON keys and quoted source text stay exactly as they are — never
   re-spell an identifier.
7. **Understatement over emphasis.** This is the rule most often broken. Let the facts do the
   work; the material is interesting and does not need selling. See the section below.
8. **Never oversell.** If it looks like coloured blocks, say it looks like coloured blocks and
   explain why that's the expected state right now. The reader will see the picture regardless, and
   a caption that oversells destroys their trust in every other claim you make.
9. **No corporate voice.** No "excited to share", no "journey", no "leverage". Write like a person
   explaining something they find interesting.
10. **Compute every duration before you reference it.** Never estimate elapsed time. Run:

    ```
    git log --reverse --format='%ai' | head -1   # when the project started
    git log -1 --format='%ai'                    # now
    git log --oneline | wc -l                    # commits so far
    ```

    Then do the subtraction. Do not write "weeks" or "months" without having checked — an early
    draft of the first post was titled "Six weeks of arguing before a single tree" when the
    project was eighteen hours old, which is the kind of error that costs you the reader for
    every other number in the post. Prefer concrete anchors — "by the second day", "in the first
    18 hours", "143 commits in" — over vague ones. Where the volume of work implies a longer
    timeline than the real one, say plainly that agents run in parallel, and leave it there.

## Register: understated, British, dry

Cut the drum roll. No "Here's the thing:", no "And that's when it hit us", no one-sentence
paragraphs for dramatic effect, no rhetorical question the writer immediately answers, no
throat-clearing before the point ("The pitch is simple enough to say in a sentence:" — just say
it). Fewer superlatives: not "the single most important thing" unless it demonstrably is, and not
"genuinely" three times in a paragraph.

Dry humour is welcome; enthusiasm is suspect. The reader will find "the random number generator
had never once been drawn from" funny without being told it is remarkable.

Before and after, from the first post:

| Cut | Replaced with |
| --- | --- |
| "The pitch is simple enough to say in a sentence: **Vvardenfell's design philosophy…**" | "**Vvardenfell's design philosophy…**" |
| "…a compromise that satisfies neither, which is how most 'Morrowind but with good combat' projects die." | "Settle them later and you get a compromise that satisfies neither." (we have no evidence for the claim about other projects) |
| "Not opinions. Measurements." | "Every one of them is a measurement rather than an opinion." |
| "Everything green, nothing random." | folded into the sentence before it |
| "Offering mercy is a real decision under pressure, punishable if you misjudge the spacing" | "Mercy is something you have to commit to at a bad moment" |

General shape of it: "This turned out to be wrong" beats "This was a catastrophic failure".
"Which is not ideal" is a perfectly good way to say something is bad.

## What to read before writing

- `orchestration/STATUS.json` and `docs/status.json` — where the project actually is.
- `corpus/90-verdicts/wave1/*.md` — the latest critic verdicts. **This is the richest source of
  material**; the arguments between builders and critics are the story. The `.json` beside each
  carries the score, the `why_not_ten` debt and the named biggest gap.
- `corpus/90-verdicts/wave1/artifacts/<piece>/` — the images and traces the verdict was based on.
- `docs/blog/COVERED.md` — what has already been written about. **Do not repeat yourself.** Assume
  the reader has read every previous post.
- `reports/` — measurement output, often with a number nobody has written up yet.
- `corpus/00-doctrine/ARBITRATION.md` §2 if a new seam ruling has been added — a new rule is often
  a good post, because it means two things were in conflict and a decision got made.

## Structure that works

**Dispatch (the default).** A title naming the specific thing. Open on the fact itself, in the
first sentence — no scene-setting paragraph. The substance, with an image or a comparison. One line
on what happens next. That is the whole shape; there is usually no need for a heading at all.

**Feature (occasional).** A title that says what happened. One paragraph on why it matters. The
substance under two or three headings, with pictures. An honest "where things actually stand" near
the end. What's next, in one line.

Length: **300–600 words for a dispatch, 900–1,400 for a feature.** A dispatch that is running long
is usually two dispatches.

## The test

Before finishing, reread it as someone who has 200 hours in Morrowind and 200 in Dark Souls, and
has never written a line of code. If a sentence assumes they know what a draw call is, fix it. If
a sentence explains what a bonfire is, cut it — that is talking down. If a sentence would make them think "yes,
*that* is why Morrowind felt like that" — keep it, and write more like it.
