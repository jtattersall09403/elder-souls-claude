# Where we are — 14 August 2026

Written for the owner, in plain language. What changed today, what you should expect to see in the
game that wasn't there before, and what happens next.

**The short version.** Today was mostly about *looking at the game properly for the first time* and
fixing what that revealed. A lot of the day's work is foundations rather than fireworks — but three
things you'll actually notice: the world has shape again instead of grey haze, characters no longer
have holes in them, and the picture has smooth edges instead of jagged ones.

---

## 1. How the game looks

**What was wrong.** Almost everything you saw was being flattened by three separate faults that had
been invisible because nobody had ever compared a screenshot to a reference.

- **The whole world was textured with one small patch of random noise**, repeated everywhere and used
  for colour, bumpiness and shine all at once. It looked like a placeholder because it was one.
- **There was no anti-aliasing at all.** The game asked the browser for it and the browser said yes —
  but the game then drew into a different buffer where that setting doesn't apply, so the request was
  granted and never used. Every edge was jagged and crawled when you moved.
- **The colour grading did nothing.** It was set to boost saturation by 3.5%, which is not a look.

**What's there now.** Twenty proper material sets with real surface detail, edge wear and wetness.
Real anti-aliasing. A genuine colour grade that changes by region, time of day and weather, using
colours the world already had written down. Lighting that actually responds to how rough or polished
a surface is — the old system was baking the sky once when the game started and then never updating
it, so nothing in the world had a believable sheen.

**What you should expect to see.** Surfaces that look like stone, wood, leather and chitin rather
than like tinted noise. Clean edges instead of staircases. Different regions feeling different in
colour and light rather than uniformly grey-green.

---

## 2. The world and why it felt samey

**You were right, and we found the mechanism.** Every horizon in the game was dead flat — all
thirteen regions, at every time of day.

Here's the twist: **the hills were always there.** Valus Ridge has 418 metres of built relief in its
data, and that shape was reaching the graphics card intact. A fog that applied equally at all heights
was erasing it before it reached the screen. Measured: 158 metres of visible relief going in, 49
surviving. One region went from 451 metres of visible shape down to **1.6 metres**.

Better still, the world already carried a setting for exactly this — how quickly fog should thin out
as you climb — and **nothing in the game had ever read it.** That's now connected, along with a
proper physical fog model. Every one of the thirteen regions shows more detail than before, and the
number of unusable "just grey" viewpoints dropped from nine to five.

**Two harder truths underneath it.** In nine of thirteen regions the landform can *never* reach an
eye-level camera, because those regions declare sightlines of 18 to 22 metres — you genuinely cannot
see a hill through that much swamp. Their variety has to come from what's within 20 to 60 metres of
you, and that's still failing. And separately: **most of what distinguishes one region from another
is terrain and air, not colour.** Two agents found that independently, one of them by discovering
that *Morrowind's own regions* can't be told apart from colour alone either.

**What you should expect to see.** Hills, ridges and distance. Regions that read differently as you
walk between them. Still too much fog in places, and still not enough variety *within* a single
region — that's the next piece of work.

---

## 3. Characters

**Your transparency complaint was right, and it took three attempts to diagnose properly.** It was
never a transparency setting — it was **five separate geometric holes** in the model: joint balls
smaller than the limbs they connected (the ankle had none at all), a crest floating 13cm off the
back, a tail root that peeled away from the pelvis when it bent, a belt with 3mm of clearance, and a
ledge at the neck.

Measured across 24 camera angles, 3 distances and 80 poses from the real animations: gaps down from
9,254 pixels to 2,204, and the worst single frame from 1.35% of the body to 0.18%.

**And there's now a proper system behind the characters.** One skeleton, one body plan, seventeen
characters built as variations on it — so improving the base improves all of them at once. That's
been verified rather than hoped: widening the shared body by 6% moved fifteen of the seventeen, with
the two four-legged creatures correctly unaffected.

**Honest caveat, in the builder's own words: "measurably less broken, not good-looking."** Nobody has
yet *looked* at these characters properly or seen them move. That's running now.

---

## 4. Towns and buildings

A kit of 25 building parts and eight architectural grammars, so settlements are composed from shared
pieces rather than each being built from scratch. Measured: no two neighbouring buildings share a
silhouette, and settlements can now be told apart **without using colour at all** — which matters,
because colour turned out not to be what distinguishes places.

Lilmoth got the most attention as the weakest of the eight towns — a tideline with wet stone below and
reed above, three roof profiles, outside stairs.

**Except — you've told me the game actually starts in Thorn, not Lilmoth.** That may mean a chunk of
this prioritisation is pointed at the wrong town. An agent is establishing the truth by playing it
now. If it's Thorn, that matters more than it looks: Thorn is one of four settlements for which we
have **zero usable reference images**.

---

## 5. Combat and enemies

Enemies can now catch you. Previously an enemy chasing a player who was simply *walking* away never
got closer than 9 metres and never once landed inside its own attack range. Now it closes to 1.6
metres and spends 294 frames in range. Enemy variety went from four distinct behaviours (four of
which were identical) to seven of seven distinct — done by changing how they move, leash, block and
disengage rather than by inflating their stats.

The AI feints and combos. That's genuinely good and it's demo-ready.

---

## 6. Dialogue — being worked on now, at your request

**You said the dialogue often doesn't make sense and doesn't feel right, and that's now a live piece
of work** running independently of everything else, because the words can be improved on their own.

An agent is now measuring our dialogue against Morrowind's actual dialogue — line lengths, how often
two characters *disagree* about the same topic, whether speakers have positions and prejudices rather
than being neutral information dispensers. Morrowind's dialogue works because a Temple priest and a
smuggler tell you different things about the same subject, and neither is neutral.

**Two things you asked for that are now planned:**
- **Topics unlocking topics** — asking about one thing revealing others, so a conversation branches
  outward. That's central to how Morrowind conversation *feels* and we don't have it.
- **The dialogue window looking like Morrowind's** — the parchment frame, the speaker's name in the
  title bar, coloured topic keywords inline in the prose, the topic list down the right, disposition
  out of 100, and a Goodbye button.

**A gap worth knowing about**, and it explains a lot: this project has 24 Morrowind reference images
and a set of Dark Souls interface references — and **no Morrowind interface references at all.** So
every menu, journal and dialogue window has been built with nothing to compare against, in a project
whose whole rule is that Morrowind wins everywhere outside a fight. That's being fixed.

---

## 7. The map

**Two defects you found by playing, both now owned.** You can't open the map at all — it exists and
renders, so something in the path from your hands to the screen is broken. And it has fog of war,
which Morrowind doesn't have: Morrowind shows you the whole geography immediately and hides only the
*markers* until you find them. We'll match Morrowind.

We also have no Morrowind map reference image to work against. Being acquired.

---

## 8. How we know any of this — and what changed about that today

This matters because it's why the dashboards said green while you played it and found it poor.

**We can now render on a real graphics card.** Every screenshot this project had ever taken was made
by a software emulator, which is fine for checking that things are consistent and useless for judging
whether anything looks good. A full sweep of 288 screenshots plus 2,220 frames of motion now costs
**four and a half cents and ten minutes** on rented hardware.

**We can now capture motion.** Twelve motion sequences had been declared for months and never once
recorded. Aliasing, crawling edges and bad animation don't show in a still photograph — which is
exactly why they survived.

**And we found out why the scores lied.** The visual quality bar was made almost entirely of checks
that the *measuring instruments* were valid, with effectively one place where a human looks at a
picture and says whether it's good. Worse, the main statistic was one that random noise *raises* —
and the world was textured with random noise. The rule that came out of it now applies to everything:
**statistics can fail a build but can never pass one.** A number going green is necessary and never
sufficient; the gate is what a person sees.

The same audit across all thirty build plans found nine more with the same shape — including one
where the human judges were shown *charts of enemy behaviour* rather than being asked to fight
anything.

---

## 9. Cost

Spend to date is **$6,176**, running at about **$116 an hour**. The efficiency programme has so far
delivered **nothing measurable** — that's the honest position. The measuring instrument only started
working today; before that every "saving" was an assertion. One idea I adopted was measured and found
to do nothing, and was reverted with the number recorded so nobody re-adopts it next month.

There's now a live chart on the progress page showing spend and burn rate, updating every few
minutes.

---

## 10. What happens next week

**In roughly this order:**

1. **Finish the dialogue text.** You've seen it and disliked it; it's the first thing a player meets.
2. **Make the dialogue window look like Morrowind's**, with topics that unlock topics.
3. **Settle where the game starts**, and put the visual effort into the right town.
4. **Fix the map** — make it openable, remove fog of war, show geography and hide markers.
5. **Variety within a single region** — the "six minutes of walking across one kind of ground"
   problem, which is the remaining half of why exploring feels flat.
6. **Judge the visual work by eye**, properly, against references. There's a quality comparison that
   has *never run* in this project's history, and until it does the visual score is capped below the
   bar it's trying to hit.
7. **Work through the backlog of finished-but-unjudged work.** A week of building happened without
   critics; a triage is ranking it so the next twenty checks are the twenty that matter.

**One thing I got wrong that's worth carrying forward.** I described critics as read-only. That's too
narrow: a critic that finds a defect and doesn't say what would fix it has done half a job. Several
today did it properly — one diagnosed a camera fault as a tree rather than a building and saved the
next person a wasted round; another left its own gate failing rather than tune it green, and published
the input the real fix needs. That's the standard, and I'll write it into the critic instructions.
