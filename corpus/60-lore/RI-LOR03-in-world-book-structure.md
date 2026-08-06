---
id: RI-LOR03
title: The structure of an Elder Scrolls in-world book — length stats, taxonomy, and six full exemplars
kind: text
side: morrowind
judges: [books.content, books.length, books.taxonomy, lore.canon, dialogue.claims, quests.lorehooks, ui.readables]
provenance: canonical-recall
confidence: medium
blind_pair: yes
---

## The bar

Morrowind shipped roughly three hundred readable books that nobody had to read. Most were long, most
were useless, several were bad on purpose, and a great many contradicted each other with no
adjudication anywhere in the game. That is not an accident of a 2002 production pipeline — it is the
mechanism by which the world felt like it existed before the player did. A book in Morrowind is
written by a *person with a position*: a bored Imperial antiquarian sneering at a rival by name, a
Temple propagandist, a drunk poet, a dead man's diary that stops mid-sentence. The bar is that a
critic handed one of our books and one of Morrowind's, unlabelled, cannot reliably pick ours — not
because ours is imitative, but because ours has an author with an axe, a register held for six hundred
words, a fact it gets wrong, and no narrator standing behind it to correct that fact.

The failure state is precise and it is the default: **books that are three sentences of exposition
delivering a quest hint in an omniscient voice.**

## The reference artifact

### 1. Length statistics — Morrowind + Tribunal + Bloodmoon readable books

| Statistic | Value (words) |
|---|---|
| Unique readable texts | ~330 |
| p10 | ~90 |
| p25 | ~210 |
| **Median** | **~520** |
| p75 | ~960 |
| p90 | ~1,700 |
| Max (single volume) | ~4,500 |
| Mean | ~700 (skewed by the long tail) |

Shape facts that matter more than the numbers:

- **The distribution is bimodal-ish with a long right tail.** There is a cluster of very short items
  (notes, inscriptions, single poems, ~90–200 words) and a broad body of 400–900 word essays, and then
  a thin tail of genuinely long works — usually **multi-volume**: *2920, The Last Year of the First Era*
  (12 volumes), *The Real Barenziah* (5–6), *The Poison Song* (3), *The Wolf Queen* (8, later games).
  Multi-volume is how the tail is delivered: no single book is a novel, but a *series* is.
- **A median Morrowind book is longer than a modern game's longest.** 520 words is 3–4 in-game pages.
  Any corpus whose median is under 250 words has failed on shape alone, regardless of quality.
- **Authorship is named ~70% of the time**, and the name usually carries a title, a house, an order, or
  a grievance. Anonymous books are typically ancient, liturgical, or deliberately deniable.
- **Roughly a quarter are "skill books"** — but they do not teach by instruction. They teach by being
  *about* the thing sideways: a book that raises Long Blade is a duelling anecdote, not a manual.
- **No book is corrected.** *The Real Barenziah* and *Biography of Barenziah* disagree; the game never
  says which is true. Multiple accounts of the Nerevarine prophecy disagree; the game never says.
  This is the convention we are inheriting deliberately (see RI-LOR06).

### 2. Taxonomy and target counts for our world

Target corpus: **112 texts**, median length **520 words**, p90 **1,600**, at least **3 multi-volume
series**. Counts below are *minimums*.

| # | Taxon | Target | Median words | Defining move | Reliability |
|---|---|---|---|---|---|
| T1 | **Scholarly treatise / naturalist survey** | 16 | 800 | Names and insults a rival scholar; over-generalises from two observations | Confident, partly wrong |
| T2 | **Imperial administrative & propaganda** | 10 | 450 | States the province is pacified, prosperous and grateful | Deliberately false |
| T3 | **Religious & liturgical** — Hist root-songs in translation, Nine Divines tracts, Sithis texts | 14 | 600 | Untranslatable terms left in Jel with a translator's apology | True-in-kind, not literal |
| T4 | **Diary, letters, ledgers** | 16 | 700 | Ends badly or mid-sentence; the author never explains context they assume | Honest, ignorant, self-serving |
| T5 | **Poetry & song** (incl. deliberately bad verse) | 10 | 260 | Rhyme forced onto a fact it cannot carry | Irrelevant to truth |
| T6 | **Technical & practical manuals** | 12 | 800 | Numbered procedure, imperative mood, one dangerous error | Mostly reliable — which makes the error land |
| T7 | **Histories & chronicles** | 12 | 1,100 | Confidently dates events the other chronicle dates differently | Contradictory by design |
| T8 | **Folk tale, fable, children's rhyme** | 10 | 350 | Cruel ending stated flatly | True as pattern |
| T9 | **Trash fiction & romance** | 6 | 900 | Sets a torrid scene in a province the author has never visited | Nonsense, beloved |
| T10 | **Fragments, inscriptions, notes, torn pages** | 16 | 110 | Incomplete; names a place or person found nowhere else | Tantalising |
| — | *(overlay tag)* **skill book** | ≥26 tagged | — | Teaches sideways, never instructs | — |
| — | *(overlay tag)* **multi-volume** | ≥3 series | — | 3–7 volumes, degrading or diverging across volumes | — |

Cross-cutting quotas:
- **≥14 books must be written by Argonians** (translated or in Tamrielic), not about them.
- **≥8 pairs of books must contradict each other**, each pair registered in `canon-facts.json`.
- **≥6 books must be actively wrong** in a way the game never corrects.
- **≤10% may contain a direct quest hint.** Books are the *secondary* lore vector; dialogue is primary
  (ARBITRATION §3, AR-2). A corpus where books carry the plot is a Souls corpus and fails.

### 3. Six exemplars, complete

These are written to be **blind-compared against Morrowind's own books** (`blind_pair: yes`) and are
simultaneously usable canon for this project. Every fact in them is `constructed` unless it restates a
registry entry. Three of them participate in tracked contradictions.

---

#### EXEMPLAR 1 — T1, scholarly treatise, 905 words
*Registry role: holds position A of disputed fact **CF-D001** (what survives in the sap).*

> ## THE SAP AND THE LEDGER
> ### Being an Attempt at an Honest Accounting of the Argonian Soul
> **by Sergius Verrent, formerly Quartermaster of the Ninth Cohort, Gideon**
>
> I am not a philosopher. I counted grain for nineteen years and I found that a man who counts grain
> honestly learns more about a province than a man who writes about its spirit, because grain does not
> flatter and spirit does. What follows is therefore an accounting, and I ask the reader to judge it as
> one: not by whether it is beautiful, but by whether it balances.
>
> The natives of this province hold that a hatchling receives its soul by drinking the sap of a tree.
> I have seen this done. It is not a metaphor and it is not a rite in the sense that the Temple would
> recognise a rite. There is no priest. There is a pool, there is a root that has been opened, and there
> are the young, and they drink as calves drink, and afterwards they are different. I say *different*
> and I mean it in the plain way: before the drinking they are animals that move; after it they look at
> you. I have watched it four times and I would watch it again, and I say without embarrassment that it
> is the only thing in nineteen years of this province that frightened me.
>
> Now. Where I differ from every author who has written on this before me — and I include Serjo
> Fals Rethan, whose *Meditations on the Trees of Argonia* is three hundred pages of a man agreeing
> with himself — is on the question of what returns.
>
> The natives say the soul goes back into the tree when the body fails, and waits, and is given out
> again to a new egg. They will tell you this as calmly as a farmer tells you where he keeps his seed
> corn. Fals Rethan takes them at their word and builds a cathedral on it. I say: count.
>
> If a soul returned entire, it would return knowing. That is what a soul is; a thing that knows it is
> itself. And a returned soul would carry the whole account of its former life into the new body, and
> the marsh would be full of the young speaking of dead people's business, and the tribes would keep
> records of it, and the records would be worth more than salt. There are no such records. I have looked.
> I have paid to look. I sat with a rootkeeper at Ixt-Shaneekh for eleven days at the cost of four
> hundred drakes of the Cohort's money and I asked her every way a man can ask, and what she told me was
> this: *the tree keeps the shape, not the story.*
>
> That is the whole of it, and she said it as though it were obvious, and to her it was.
>
> So here is my accounting. The sap is a solvent. It does not preserve the soul; it *dissolves* it, as
> water dissolves salt, and the dissolved matter is held in common in the body of the tree, and when a
> new egg is opened, some measure of that common stock is drawn off and poured in. What comes out is not
> the man who died. It is made of him, as a second loaf is made of the same flour. The tribes are not
> lying to us. They are using a word — *return* — that does not survive translation, and we hear
> *resurrection* because our own religion has taught us no other shape for the idea.
>
> The consequence, which I set down plainly because no one else will: **the Argonian does not have a
> life after this one.** He has a contribution. He goes into the pool and the pool goes on, and this is
> a consolation of a sort but it is not the consolation he is understood to have, and every Imperial
> chaplain who has told a dying Argonian auxiliary that he is going home to his tree has told him a
> kindness that is not true.
>
> I have been told that this is a cold conclusion. It is. I would rather have a cold ledger than a warm
> one that does not balance.
>
> Two objections must be met.
>
> **First**, it is said that the trees speak to their people, and that this proves memory. It proves
> nothing of the sort. A ledger speaks to me, and it remembers nothing; it is *written on*. The sap
> carries instruction, warning, sometimes an image — I have seen a village empty three days before a
> flood on no other authority — but instruction is not recollection, and I would remind the reader that
> the tree is present and the dead are not.
>
> **Second**, and this is the objection I cannot fully answer, so I record it against myself: there are
> the wells. The opened roots. Every settlement in the interior has one and every one of them is a
> wound that was cut on purpose and has been kept open for longer than the Empire has existed. The
> rootkeepers will not say who cut the first, and they become genuinely angry when pressed, which is not
> a thing an Argonian usually consents to become in front of a foreigner. And I have heard it said —
> only by the drunk, only ever by the drunk, and always in the same words — that *the wells remember
> what the tree forgets.*
>
> I do not know what that means. I have written down that I do not know. If the reader can do better,
> the reader is welcome to the ledger; I am too old and this province has taken enough of my eyes.

---

#### EXEMPLAR 2 — T3, religious text in translation, 690 words
*Registry role: holds position B of **CF-D001**. Flagship Argonian-voice text.*

> ## THE EGG SPEAKS TWICE
> ### Nine root-songs of the Deep Marshes
> **Set down in Tamrielic by Deelith-Who-Waits-For-Rain, of Helstrom, at the request of the Provincial
> Office, and against her own judgement**
>
> *A word first. I was asked for these in Tamrielic and I have given them in Tamrielic and they are
> ruined. I say this not to be difficult but so the reader does not mistake what he is holding. A
> root-song is sung standing in water at a particular depth, at a particular hour, by people who are
> related to each other in a way your language has one word for and mine has eleven. What I can carry
> across is the meaning of the words. The song is not in the words. I have marked with brackets the
> places where I have failed.*
>
> **THE FIRST SONG. OF THE DRINKING.**
> Before the drinking you were water.
> The tree put its finger in the water and the water stood up.
> [*ixt-jul-vakh* — "the standing-water." There is no Tamrielic word. It is not "birth."]
> Now you are a shape the tree is holding.
> Do not be proud of the shape.
> It has been held before.
>
> **THE SECOND SONG. OF THE NAME.**
> The name is a rope, not a root.
> A rope is for the living to hold you by.
> When they let go, the rope is on the ground,
> and you have gone down where ropes do not go.
> Sing your name loudly while you have one.
> Nobody below is listening for it.
>
> **THE THIRD SONG. OF THE RETURN.**
> They say the drowned man comes back and does not know his wife.
> This is told as a sad story. It is not a sad story.
> The tree gave him out again. That is the whole promise.
> The promise was never that he would know his wife.
> [The Imperial reader will want me to say whether the man is *the same man*. My language does not have
> the question. I have tried four times to write the question in Tamrielic and each time I wrote
> something my grandmother would have found stupid.]
>
> **THE FOURTH SONG. OF THE WOUND.**
> The tree does not remember you.
> The cut in the tree remembers you.
> This is why we do not let the cut close.
> This is why the keeper sits by it and does not sleep,
> and why the keeper is chosen from those who can bear
> to be looked at by something that is not looking.
>
> **THE FIFTH SONG. OF THE TAKERS.**
> A man came with a jar.
> He said: the tree is generous, the tree will not miss it.
> The tree is generous. The tree did not miss it.
> The child born that year was born with no mouth
> and we did not blame the man, because blame is a rope
> and he had already gone home along it.
>
> **THE SIXTH SONG. OF THE SALT.**
> They take us north in the wet season because we do not die on the water.
> Remember that they discovered this by testing it.
> [*lukiul* is here, and I will not translate it, and the Provincial Office may strike this line.]
>
> **THE SEVENTH SONG. OF THE STONE NESTS.**
> Our grandmothers stacked the world into steps and walked up it.
> We do not know how. We do not know why they stopped.
> When you stand in a stone nest and feel that you are small,
> understand that you are not small, you are *late*.
>
> **THE EIGHTH SONG. OF SITHIS.**
> All roots go down.
> Below the roots there is no root.
> This is not a punishment and it is not a reward
> and the people who made it a punishment came here on ships.
>
> **THE NINTH SONG. WHICH IS NOT SUNG.**
> [The ninth is sung only when a tree has stopped answering. I have heard it once. I was nine. I will
> not write it down, and the Provincial Office may keep its money.]

---

#### EXEMPLAR 3 — T2, Imperial propaganda pamphlet, 455 words

> ## THE BLESSINGS OF THE COAST
> ### An Address to the Free Peoples of Argonia
> **Published by the Provincial Office at Gideon, in the four-hundred-and-twenty-sixth year of the
> Third Era, for distribution at all chartered markets**
>
> Citizens and friends!
>
> There was a time, within the memory of your grandparents, when the coast of this province was a place
> of fear. Ships came and went as they pleased. Whole villages vanished between one season and the next
> and no man could say where. There was no law from the Padomaic to the Topal but the law of whoever
> held the knife.
>
> Consider the coast today.
>
> At Archon, the harbour is measured, the moorings are numbered, and every keel that touches the quay is
> entered in a register that any citizen may inspect. At Gideon, the tolls are posted in three tongues.
> At Stormhold, the granary has not been empty in eleven years. At Lilmoth — and let no one say the
> Empire has forgotten Lilmoth — the customs house stands open six days in seven.
>
> This is what the Empire has given, and it has asked in return only what any household asks: an honest
> share, and quiet at the door.
>
> Some among you have heard otherwise. It is said in the interior that the Empire takes hatchlings. This
> is a slander, and we name it as one. **No subject of the Empire may be held as property within the
> borders of the Empire's law.** Where irregularities have occurred, they have occurred beyond that law,
> at the hands of foreign vessels, and the Provincial Office has made and continues to make the strongest
> representations to the government of Morrowind on this matter.
>
> It is further said that the Legion does not go inland. This is true, and we say so proudly. The Empire
> does not go where it is not needed. The interior governs itself, as it has always governed itself, and
> the Empire has never wished it otherwise. Those who tell you the Legion is coming for your trees are
> selling you a fear so that they may sell you the cure.
>
> Ask instead: who has built you a granary? Who has posted a toll you may read? Who has hanged a pirate
> this year?
>
> Come to the chartered markets. Bring rice, bring hide, bring pearl. Take away salt, iron, and paper.
> Learn the Tamrielic tongue, for it costs nothing and opens every door from here to Anvil. Enrol your
> young in the Legion auxiliaries, where they will be fed, paid, and honoured, and where an Argonian of
> merit may rise as high as any man.
>
> The marsh is old. The Empire is patient. Between them there is room for every honest people.
>
> *Long live the Emperor Uriel Septim VII.
> Long live the Provinces.*

---

#### EXEMPLAR 4 — T4, diary/ledger, 780 words
*Registry role: eyewitness to CF-062 (Dres slaving) and to the Rootward Tide (RI-LOR05).*

> ## LEDGER AND JOURNAL OF ANDREL VORIN, SALT-FACTOR
> ### *(recovered at the Crimson Coast; the first eleven leaves are water-spoiled and omitted)*
>
> **12 Rain's Hand.** Anchored off the red shore. Sea the colour of a bad tooth. Sixty-one head expected
> from the Deep Marshes party, forty-four delivered. Ivrys says the difference is the fever. Ivrys says
> the difference is the fever every year and every year I write it down and every year the Council in
> Tear reads it and nods. Cost of the party: 900 drakes. Value delivered: 3,100. We are not, whatever my
> brother says at dinner, in a profitable trade. We are in a *bulk* trade.
>
> **17 Rain's Hand.** Two of the forty-four are Naga-formed, which fetches more in Tear as a curiosity and
> which I have always thought a poor business, since a curiosity is bought once. Entered at 140 each
> regardless.
>
> **21 Rain's Hand.** The old one will not eat. Not a hunger strike; she eats when the bowl is put in her
> hands but she does not take it. Ivrys wanted to open her mouth with the funnel. I said no, on the
> grounds of the throat damage, and Ivrys thinks me soft, and Ivrys is right that I am soft and wrong
> about the reason.
>
> **2 Second Seed.** Squall. Lost a man overboard, one of ours, Vandas, who owed me eleven drakes and has
> now settled it. Cargo lost none. They do not drown. I have watched them go under the water in the hold
> when it flooded to the waist and come up and look at me, and it is the looking at me, and this is the
> third time I have written that in this book and I am going to stop writing it.
>
> **9 Second Seed.** Put in at Archon for water. Captain there has a new price. Everyone has a new price.
> Wrote a letter to Serjo Dram which I did not send.
>
> **14 Second Seed.** The old one spoke to me. Tamrielic, clean as a clerk's, which I did not expect and
> which I should have expected because we take them from the river roads and the river roads trade. She
> asked me whether I knew where a soul goes when it is taken far from where it should be.
>
> I said I supposed it went to whatever god had it.
>
> She said no. She said it goes where it can. She said there is a tide in this country and it runs
> downward into the roots, and everything that dies here is drunk and given back out, and this is not a
> belief, it is *plumbing*, and when you take her people north and they die in Tear, they die outside the
> tide, and the tide is short by that much.
>
> I asked her whether she meant that we were stealing souls, since we hear this said and I wanted to know
> if it was the standard thing.
>
> She said: no. Stealing would be better. Stealing means somebody has it. She said: you are *spilling*.
>
> I have thought about that word for two days.
>
> **16 Second Seed.** Ivrys says the last three parties have all come back light and all with the same
> story from the trackers — that the villages inland are moving, not fleeing, moving, and that the
> rootkeepers have started sitting with their wells day and night in shifts, and that a tracker who asked
> why was told to go home in a tone that made a man who has done this fourteen years come back and say he
> did not want the work.
>
> **19 Second Seed.** Forty-one head. Three dead in the hold since Archon of no cause anyone can name.
> Not fever. Not thirst. Ivrys opened one and said the meat was sound.
>
> **20 Second Seed.** I want to record, because this book will be read by the Council and by my brother
> and possibly by my son, that I have kept an honest ledger for twenty-two years and that every figure in
> it is true, and that this is the only defence I have ever had and I now understand it is not one.
>
> The old one died last night. She was not sick. She sat down against the hull and looked at the shore
> and went out like a lamp being carried into another room.
>
> Entered at nil.
>
> **21 Second Seed.** Ivrys wants to put in at the red shore again for water and I have said no. I do not
> want to be near the shore. I have no reason and I am the factor and I do not need one.
>
> **23 Sec**

---

#### EXEMPLAR 5 — T5, deliberately bad poetry, 265 words

> ## NINE STANZAS UPON THE DROWNING OF REMAN'S FORD
> **by Casimir Bellandus, Poet, of Chorrol and Anvil**
>
> *(Only five stanzas are extant. The poet's own note on the manuscript reads: "The remainder were lost
> in the same water, which I consider a criticism.")*
>
> **I.**
> O Ford! O gallant Ford of Reman's name!
> Where once the Legion's noble hobnails rang,
> Now silt, now slime, now soft ignoble shame,
> And frogs where once the trumpet-players sang!
>
> **II.**
> Two hundred souls were counted at the muster,
> Two hundred souls were counted at the meal,
> And of the flower of that martial cluster
> But nine and forty answered to the peal.
>
> **III.**
> They say the Argonaut, that scaly fellow,
> Can breathe beneath the water like a fish;
> How fortunate! How enviably mellow!
> While we good men must perish as we wish.
>
> **IV.**
> The Governor has writ that all is well,
> The Governor is doubtless well informed;
> I have not seen the Governor, I dwell
> Where nothing dries and everything is warmed.
>
> **V.**
> Return me, gods, to Chorrol's honest stone,
> To wine, to walls, to women who are dry;
> I came to sing of Empire and have grown
> Acquainted with a beetle three feet high.
>
> ---
> *Bellandus was attached to the Ninth Cohort as a "poet of the province" at a stipend of forty drakes a
> month for two years. The Provincial Office declined to renew the appointment. He is understood to have
> died at Gideon of Brown Rot, having outlived his patron, his reputation, and — by his own account in a
> letter to his sister — his rhyme for "Argonian," which he never found.*

---

#### EXEMPLAR 6 — T6, technical manual, 815 words
*Registry role: primary in-world disease reference; contains one lethal error, uncorrected.*

> ## A PRACTICAL HANDLING OF THE MARSH-FEVERS
> ### For Field Surgeons and Serjeants of the Cohorts of Argonia
> **Fourth issue. Provincial Office, Gideon. Supersedes the third issue, which is to be burned, not
> corrected.**
>
> **1. General.**
> A man posted to this province will get sick. Plan the roster on that basis and not on the strength
> returns. In a wet season assume one man in four unfit and you will not be far wrong.
>
> **2. The order of your work.**
> Wet, warm, fed, dry — in that order, and dry is last because you will not achieve it. Do not begin with
> the cure. Begin with the boots.
>
> **3. Swamp fever.** Onset two to five days after standing water above the knee. Shaking, heat, and a
> smell off the sweat like old bread. Not usually fatal in a fed man. Cure potion where you have it;
> where you do not, keep the man drinking and keep him out of the sun. Do not bleed. The third issue of
> this manual instructed bleeding. The third issue is to be burned.
>
> **4. Brown rot.** Slower. Begins in the gums. If the gums are receding and the man says his teeth feel
> long, treat immediately and enter it in the book, because brown rot in one man in a barrack is brown rot
> in the barrack.
>
> **5. Rockjoint.** Common inland, rare on the coast. Stiffness at the large joints on waking that does
> not free after a hundred paces. Cured easily and early; not cured at all late. Any man who says his
> knees are "just cold" in this climate is lying to stay on the roster and is to be inspected.
>
> **6. Yellow tick.** From the tick, obviously. Ring of yellowed skin at the bite, spreading. The ring is
> not the disease; the ring is the sign. Burn the tick off with a coal — **do not pull it** — and dress it.
>
> **7. Bloomrot.** Fungal. Grey fruiting bodies at the armpit, groin and the web of the fingers, and a
> sweet smell. Scrape, do not cut. Alcohol on the scrape. Bloomrot alone will not kill a healthy man but
> it opens the skin for everything else and a man with bloomrot and a wound is a man in serious trouble.
>
> **8. Wet lung.** Bubbling on the breath. Sit him up. Do not lie him down flat, whatever he asks. If a
> man with wet lung is laid flat at night you may find him dead in the morning and the death will be
> yours.
>
> **9. The Nine-Day Silence.** Rare, inland, and the natives will not discuss it. Begins with a loss of
> speech — not of understanding — and ends either in recovery on the ninth day or not at all. There is no
> treatment. Keep the man warm, keep him company, and put a slate and chalk in his hands, because in the
> six cases this office has recorded, four of the men wrote something on the eighth day and in two cases
> what was written was of interest to this office.
>
> **10. Sap.**
> This section is issued on the authority of the Provincial Office and is not open to the discretion of
> the surgeon.
>
> No man of the Cohorts is to consume the sap of a Hist tree in any quantity, in any preparation, for any
> reason, including on the advice of a native guide and including as a treatment for the fevers above.
> The sap is not a medicine. In the Argonian it is food and something more than food. **In a man it is a
> poison of the mind.** The affected do not know what they are looking at. They will report, afterwards
> and sincerely, having fought beasts, and the bodies will not be beasts.
>
> There is no cure and there is no test. A man who has taken it once will take it again if it is near him.
> Where sap is found in a man's kit, the kit is burned and the man is confined, and this office would
> rather answer for a hundred wrongful confinements than for one more Water's Edge.
>
> **11. On native medicine.**
> The rootkeepers can do things this office cannot explain and does not intend to try to explain in a
> field manual. If a native offers to treat your man and your man is dying, let them. If your man is not
> dying, do not. The distinction is the whole of the policy and you are trusted to make it.
>
> **12. Last.**
> You will lose men to this province who were never struck by anything. Write down what you saw. Write it
> down even where it makes you look a fool, because the fourth issue of this manual exists only because a
> serjeant at Thorn wrote down something foolish in 3E 399 and eleven men are alive on the strength of it.

*(The lethal error is §7: scraping bloomrot and applying alcohol drives spores into the broken skin and
is the standard route to systemic infection. Interior rootkeepers smother it with clay and never break
the surface. No book in our game corrects §7. An Argonian NPC, asked, will.)*

---

#### EXEMPLAR 7 (short-tail sample) — T10, inscription, 105 words

> ## INSCRIPTION, THIRD TERRACE, IXT-SHANEEKH
> *(transcribed and rendered by an unknown hand; the stone is broken at the fourth line)*
>
> HERE THE WATER WAS TOLD TO STOP AND IT STOPPED
> HERE THE COUNT WAS KEPT BY [name effaced] WHO KEPT IT WRONGLY ONCE
> AND WAS FORGIVEN, AND KEPT IT WRONGLY TWICE, AND WAS NOT
> [break]
> — WE STACKED IT IN THE DRY SEASON OF THE NINE-HUNDREDTH
> — WE STACKED IT AGAIN WHEN IT SANK
> — WE DID NOT STACK IT THE THIRD TIME
>
> *Marginal note in a later hand, in Cyrodilic:* "Ask them what the count was of. Asked four. Two would
> not answer, one said 'the ones going down', one laughed. — S.V."

---

## Comparison method

1. **Length distribution test.** Extract word counts for every readable in `game/data/books/`.
   ```
   python3 corpus/80-methods/book-stats.py game/data/books/ --compare corpus/60-lore/RI-LOR03-in-world-book-structure.md
   ```
   Compute p10/p25/median/p75/p90 and compare to §1. **Fail if:** median < 350 words, or p90 < 1,200,
   or fewer than 3 multi-volume series exist, or >20% of books are under 150 words.
2. **Blind pair test** (`blind_pair: yes`). Assemble 8 unlabelled texts: 4 of ours, and 4 real Morrowind
   books matched by taxon and length (*Confessions of a Dunmer Skooma Eater* ↔ T4; *A Short History of
   Morrowind* ↔ T7; *The Pilgrim's Path* ↔ T3; *Vivec and Mephala* ↔ T1). The critic ranks all 8 for
   "which world does this come from" **before** the reveal. **Fail if** the critic sorts ours into a
   distinct cluster at better than chance, and record *what tell* separated them — that tell is the
   remedy.
3. **Author-voice test.** Sample 12 books. For each, the critic states in one sentence: who wrote this,
   what they want, and what they are wrong about. **Fail if** ≥3 have no answer to "wrong about" — that
   is omniscient-narrator contamination.
4. **Contradiction census.** `grep` the registry for `disputed: true` entries and confirm each names ≥2
   in-world books that actually exist in `game/data/books/`. **Fail if** <8 pairs, or if any disputed
   fact names a book that was never written.
5. **Quest-hint ratio.** Count books whose text names a currently-active quest objective.
   `hint_books / total > 0.10` → **FAIL** (books are carrying the plot; AR-2 violation).
6. **Register variance.** Run a stylometric spread (mean sentence length, type-token ratio, imperative
   frequency, first-person rate) across the corpus. **Fail if** the interquartile range of mean sentence
   length is under 6 words — that means every book is written in the same voice, which is *our* voice,
   which is the tell.
7. **Argonian authorship count.** ≥14 books authored by Argonians. **Fail below 10.**

## Scoring

| Score | Condition |
|---|---|
| **5** | Blind test indistinguishable; median ≥ 500 words; ≥10 tracked contradictions; all 12 sampled books have a wrong-about answer; register IQR ≥ 10 words |
| **4** | Blind test: critic separates ours at ≤60% accuracy; median ≥ 450; ≥8 contradictions |
| **3** | Critic separates ours at ~75% but cannot articulate a consistent tell; median ≥ 350 |
| **2** | Critic separates ours immediately and names the tell (usually: "yours all sound informative") |
| **1** | Median under 250 words; books read as codex entries |
| **0 — FAIL** | Books used as the primary lore vector (quest-hint ratio >10%), or fewer than 40 books total, or no book in the game is wrong about anything |

**Failure threshold: below 3.** A 2 ships a wiki with a walking simulator attached.

**Native → ladder anchors — the row mandated by `SCORING.md` §1.2 (BAR-CRITIQUE-01 W7).**
Added wave-1-prep to close BAR-CRITIQUE-02 **C1**; derived from this item's own bands above.
**No threshold in this item was changed.**

| Ladder | 4 | 6 | 8 |
|---|---|---|---|
| Native | 2 / 5 | 3 / 5 | 5 / 5 |

**Aggregation (a property of this item, not of the critic):** band on the 0-5 native scale.

## How we lose

1. **Three sentences of exposition.** The default failure. A "book" that is one paragraph telling the
   player a fact the designer needed them to have. Morrowind's median is 520 words and most of them are
   about nothing the player needs.
2. **One voice across the corpus.** Every book written by us, in our register — clear, well-organised,
   informative. Check 6 exists because this is invisible from the inside.
3. **No book is wrong.** A corpus where every claim is true is a corpus with an omniscient author, and
   the world collapses to a wiki. Exemplar 1 and Exemplar 2 must *both* be partly wrong (see CF-D001).
4. **Books as quest logs.** The player reads a book and gets a marker-equivalent. This is the Souls
   convention leaking into the world layer and it is an automatic AR-2 fail.
5. **Deliberately bad poetry that is merely bad.** Exemplar 5 is bad in a *specific, characterised* way —
   a homesick Colovian hack who cannot find a rhyme for "Argonian" and blames the province. Random
   doggerel is not the same joke and is not funny twice.
6. **Argonians written about but never writing.** If every book about Black Marsh has an Imperial byline,
   we have built a colonial archive and called it a culture. Exemplar 2's translator's brackets — a woman
   telling the Provincial Office to its face that its language is inadequate — are the target register.
7. **Sanitised horror.** Exemplar 4 works because the slaver keeps an honest ledger and thinks that
   redeems him. A cackling villain's diary teaches the player nothing and costs them nothing to read.
8. **No short tail.** Only "proper" books, no inscriptions, no torn notes, no one-page nonsense. p10 in
   Morrowind is ~90 words; a corpus with no scraps feels curated rather than inhabited.

## Provenance note

- **§1 length statistics are `canonical-recall`, confidence medium.** They are reconstructed from
  familiarity with Morrowind's book corpus, not measured against extracted game text. Direct verification
  was attempted and blocked (see RI-LOR01 provenance note; UESP and Imperial Library both refused at the
  proxy). **These numbers are binding as a constructed bar regardless** — per CORPUS-CONTRACT §3, a
  constructed bar we can measure beats a real number we cannot. If a later agent can extract Morrowind's
  `BOOK` records, re-measure and amend this section, keeping the old figures struck through.
- The multi-volume examples (*2920* at 12 volumes, *The Real Barenziah*, *The Poison Song*) and the
  Barenziah contradiction are `canonical-recall`, confidence high — these are well-known features of the
  shipped game.
- **All seven exemplars are `constructed`.** They are our writing, about our Black Marsh, and every
  factual claim inside them is our invention except where it restates a registry fact (CF-002, CF-003,
  CF-006, CF-041, CF-062). They are simultaneously **usable in-game canon**: Exemplars 1, 2, 4 and 6 are
  intended to ship. Exemplar 6 §7's error is deliberate and is registered so no future editor "fixes" it.
- Exemplar 3's claim that no subject may be held as property within Imperial law, juxtaposed against
  CF-062 (Dres slaving is legal in Morrowind, which is *in* the Empire), is a deliberate propaganda lie
  and is registered as such. It is not a canon error on our part.
