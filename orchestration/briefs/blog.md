# Brief: the build blog

> **Read the audience section below before you write a word, and the worked example in
> §"Register" before you finish.** The recurring failure is not inaccuracy — it is writing an
> accurate post for a developer. The reader is a casual player who knows nothing about how games
> are made. Plain English, full sentences, few numbers, understated throughout.

You write for **someone who has played Morrowind and Dark Souls casually and enjoyed them.**
They remember wandering Vvardenfell and being told to find a man in Balmora with no map marker.
They remember dying to the same knight several times. That is the extent of it.

**They are not developers or designers, and they know nothing about how games are made.** They
have never heard of a hitbox, an i-frame, a frame count, or a random seed. Assume none of it.
This is the single most important line in this brief and the one most easily drifted from — every
post is written for that person, not for the person who would enjoy the raw numbers.

- **Vocabulary you may use freely** — only what a casual player would have picked up from playing:
  stamina, blocking, dodging, levelling up, a bonfire, a save file, a quest, your journal, a
  shopkeeper, a spell. Nothing beyond that.
- **Everything else must be explained in ordinary words, the first time, every post.** Not
  "i-frames" but "a brief window during a dodge where attacks pass through you". Not "hitbox" but
  "the invisible shape the game uses to work out whether a sword actually connected". Not
  "deterministic" but "run it twice with the same inputs and you get exactly the same result".
  If explaining it would take more than a sentence, that is a sign the detail does not belong in
  the post at all.
- **Ideas from game design are welcome and are often the best part of a post** — why a boss
  telegraphs its attacks, why being lost can be a feature rather than a fault, why a world that
  never surprises you stops being worth walking across. Explain each one in plain terms as you go.
  These name something the reader has felt while playing without ever having a word for it, which
  is satisfying. But introduce the idea in ordinary language first and only then, if it helps, give
  it its name.

The register to aim for: explaining something you find interesting to a friend who plays games but
has never built one, over a pint, without showing off.

## Cadence

**Owner instruction, and it supersedes everything this section used to say:** *"Reduce blogs
frequency. More like a twice daily roundup of key things done/achieved/improved that day with a
selection of visuals and images to showcase. And they should be less harsh."* This is a hard
requirement on frequency, not a suggestion: **two roundups a day, not a post per finding.** The
older version of this brief asked for several short posts a day, one per verdict; that is exactly
the thing the owner asked to stop, and if you are about to file a fourth post today, don't — fold it
into the next roundup instead.

**The default and near-only form is the roundup**: one post covering roughly half a day's work
(morning/overnight and afternoon/evening are a reasonable split, but go by what actually landed, not
the clock), 500–900 words, with a small selection of images — enough to show the two or three most
visible things, not a gallery of everything that happened. It covers **several** things at once:
whatever verdicts landed, fixes shipped, or discoveries turned up in that window, each given a short
paragraph or two, not each given its own post.

Structure a roundup the way the recently merged PR descriptions structure themselves — read a
handful of them before you write (`gh pr list --state merged --limit 10` against
`jtattersall09403/elder-souls-claude`, or the equivalent GitHub tool) and copy their shape, not just
their sentences:

- **Lead with what changed, in plain language**, one short paragraph per topic — what was worked on,
  what it now does, what the reader should expect to see in the game as a result.
- **Say honestly how far each thing has got.** The PRs do this with a rough percentage or a plain
  "still outstanding" line, and it reads as honest bookkeeping, not as a complaint. Copy that: "the
  settlement streets are about two-thirds built out" is a completely normal sentence, not bad news.
- **Close with a line or two on what's next**, the way the PRs do.

**Never post to say nothing happened**, and never pad a thin window out to two roundups a day for
its own sake — if a period was quiet, say so briefly in the next roundup rather than manufacturing
one, or, on a genuinely dead half-day, skip it once and note the gap when the next roundup opens.

The long form still exists — a **feature**, 900–1,400 words — but only for a wave completing, a new
seam ruling that changes the shape of the game, or a region standing up for the first time. These are
rare next to the twice-daily roundups, not an alternative rhythm running alongside them.

### What a roundup covers

Not an exhaustive list — pick whichever of these actually happened in the window, and cover several
in one roundup rather than spreading them across separate posts:

- **What got built or fixed, and what to expect in the game because of it.** This is the backbone of
  every roundup. State plainly what stage it has reached — "still being built out", "roughly half
  done", "the first pass is in and it needs another round" are all fine, ordinary sentences.
- **A verdict, summarised kindly.** What a critic checked, what it found, and what the builder
  believed was working. A gap the critic found is a normal part of the process, not an indictment —
  say what it was and that someone is now on it.
- **A side-by-side that shows the distance still to close.** Our shot next to the reference, with an
  honest, matter-of-fact account of the gap. These are the images the reader will most want to see.
- **A discovery worth a sentence** — but only where the fact means something on its own, without
  jargon or setup. "Half a kilometre of the main road ran under water" works on its own.
- **A new seam ruling**, summarised: two things were in conflict, a decision got made, briefly why.
- **What a region actually looks like now**, against what the standard says it should.

**An unbuilt thing is "not yet built".** That is the normal, expected state of a project mid-wave,
not a scandal and not something to apologise for. See the tone section below — this is a hard
requirement, not a style preference.

### Follow-ups: close the loop on what you already told the reader

**Owner instruction, and this is a standing requirement, not an option.** *"Some of the future blogs
should talk about how issues, limitations and flaws described in earlier blogs have since been
fixed, with screenshot evidence."*

A reader who was told the blade sweeps underground, the movesets never reach the screen, the purse
empties on save, or the level-up screen is refused at every well, is owed the ending. Without it the
blog is a list of complaints and the reader has no way to tell a project that fixes things from one
that only notices them.

**One roundup can close several stories at once**, as one of its sections rather than a post to
itself. The owner's words: *"you wouldn't have to do one post per ending — you could have the agent
decide to do a single post that wraps up a batch of them."* A section closing four defects the
reader was told about and has not heard the end of is often better than four separate mentions, and
it is the right shape when the fixes share a cause.

**The rule: most roundups should close at least one earlier thread**, as a section within that
roundup (`kind: followup` only if a whole roundup happens to be dedicated to closures, which will be
rare). Within that section:

1. **Name the earlier post and link it** — `[the post where we found it](#slug)`. The slug is the
   post's anchor on the page.
2. **Restate the original defect in one sentence**, in the reader's terms, so the post stands alone.
3. **Show it fixed, with a picture.** A before-and-after pair through `:::compare` is the strongest
   form this blog has, and both shots must be of *the same thing* — same weapon, same spot, same
   time of day. Pull the old shot from `docs/shots/` (they are dated, so the old one is still
   there) and the new one from what the builders have saved since.
4. **Give the number both ways.** "Above ground on 0 of 40 frames" → "92 of 100" is the whole story
   in nine words.
5. **Say what is still not right.** Almost every fix in this project has left a residue, and the
   builder's own report usually names it. A follow-up that claims a clean win is usually wrong and
   the next critic will say so in public.

**Where to find the material.** `reports/blog-feed.jsonl` lines carry `kind: "fix"`;
`docs/blog/COVERED.md` says what was already told to the reader. **Run
`node tools/blog-threads.mjs`** — it lists every defect the blog has reported against the fixes that
have landed since, so you can see at a glance which stories are owed an ending.

Do not manufacture one. If nothing that was blogged has actually been fixed since, say so in a
regular post — that is also information, and it is more honest than a follow-up about a defect that
is still open.

## Where things go

- Posts: `docs/blog/YYYY-MM-DD-slug.md`, with front matter `title`, `date`, **`time`**, `summary`.
  Two roundups a day share a date, so the slug carries the distinction — make it specific
  (`w1-roundup-morning`, `w1-roundup-evening`, or name the headline topic —
  `w1-30-settlement-streets` — not `progress-update`). Add `kind: roundup` (the default) or
  `kind: feature` for the rare long form.
- **`time:` is not optional.** Write it as `13:42Z`, in UTC, taken with `date -u +%H:%MZ` when you
  finish the post. Posts are ordered on the page to the minute — without it the reader gets the
  day's posts in an order that is not the order they happened. If you omit it the renderer falls
  back to the commit that added the file, which lumps everything in a batch together.
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

1. **Plain English and full sentences, throughout.** Explain a term in ordinary words the first
   time it appears, in every post — you cannot assume a reader has seen the earlier ones. Not "we
   implemented deterministic fixed-timestep simulation", but "the game now works in fixed steps,
   sixty a second, and runs identically every time — which is the only reason any of the
   measurements below mean anything." After that you can use the shorthand for the rest of that
   post. Terms like i-frames, poise, hitboxes and frame counts all need this treatment: they are
   developer words, not player words, however familiar they may feel while writing.
2. **Show the thing.** Every post has at least one image. A post about the world has a picture of
   the world.
3. **Be honest about failure, and specific about it.** The failures are the most interesting part
   and they build trust. "The first piece failed its review twice" is a better sentence than
   "progress continues." When a critic catches something, explain the catch in a way a lay reader
   can enjoy — the random-number generator that was never used, the save system that worked for
   four seeds out of forty. These are good stories.
4. **At most one or two numbers in a paragraph, and each one carried by a sentence that says
   what it means.** Numbers are evidence, not content. A reader who is not a developer skims a
   stack of figures and takes nothing from it, and a paragraph that reads like a spec sheet loses
   them for the rest of the post. Never write a decimal place that does not change the point —
   "a standard deviation of 9.894" tells this reader nothing, whereas "someone clearly sat down
   and filled it in by hand" tells them the thing that actually matters. Prefer the comparison to
   the measurement: "half a second, when it should have been a second" beats "0.500 s against
   1.03 s". Internal shorthand is always unpacked — never "TTNIT median ≤45s", instead "you should
   never walk more than about 45 seconds without something worth stopping for."
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

### The worked example — read this one properly

This paragraph was published and flagged by the project's owner as **totally wrong in tone**. It is
the failure mode to watch for, because everything in it is *true* and it is still unreadable for the
person we are writing for:

> Behind those identical frames is the twelve-by-ten race reaction matrix, and it is good work:
> authored rather than generated, standard deviation 9.894 across 120 cells, every row and column
> distinct. Driven live it gives an interior-raised Saxhleel disposition 74 and a foreign-born
> Dunmer 6 on identical stats, and prices move with it to within 1.4%.

What is wrong with it: five numbers in two sentences, none of them explained. "Twelve-by-ten
matrix", "standard deviation", "cells", "driven live", "disposition 74" are all internal terms
used raw. It asserts "it is good work" rather than showing anything. It reads like a status
report to a colleague. A casual player gets nothing from it at all.

The same facts, written for the actual reader:

> Behind those identical pictures there is something that does work. The game keeps a table of how
> warmly each sort of person treats each sort of stranger, and someone has plainly sat down and
> filled it in by hand rather than letting a formula do it. An Argonian raised in the province gets
> something close to a welcome. A Dunmer from abroad, identical in every other respect, gets
> suspicion. The shopkeepers charge them differently, too, which is the part I liked.

Same information, no jargon, and the one thing worth noticing — that it was written by hand — is
the thing the paragraph is about. Note the last clause: mild, personal, undersold. That is the
register.

**On assertiveness.** Say less than you could. Let the reader reach the conclusion. Avoid "it is
good work", "this is the crucial point", "and that is exactly why" — state the fact and stop. If
something is impressive, describing it plainly is enough; if it needs a label to seem impressive,
it probably is not.

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

Before finishing, reread the whole post as **someone who played both games a few years ago, enjoyed
them, and has never built or designed anything.** Then check three things:

1. **Is there a sentence they would skim?** A run of numbers, an unexplained term, a clause that
   only makes sense if you already know how the thing works. Rewrite it or cut it.
2. **Is there a sentence that tells them what to think?** "It is good work", "this is the crucial
   part", "remarkably". Cut the label and leave the fact.
3. **Is there a sentence that would make them say "oh — that's why that felt like that"?** Keep it,
   and write more like it. That sentence is the reason anyone reads this.

If a paragraph cannot survive all three, it is usually because it was written for a colleague
rather than for the reader.
