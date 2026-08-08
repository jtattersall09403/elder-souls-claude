// W1-READABLES — three more volumes of the Drowned Tally, and the one field that makes the
// fourth volume readable by the quest that already names it.
import fs from 'node:fs';

const P = 'game/data/books/the-drowned-tally.json';
const doc = JSON.parse(fs.readFileSync(P, 'utf8'));

// --- 1. the fourth volume was ALREADY WRITTEN and already names the Steward in its last line.
// Q-MAIN-06's `rev_the_steward_named` has named `item_tally_volume_four` as its source since the
// quest was authored. All that was missing was the key that links the two.
const four = doc.books.find((b) => b.id === 'the-drowned-tally-fourth-volume');
if (!four) throw new Error('the fourth volume has moved');
four.knowledge_key = 'item_tally_volume_four';

const add = [];

add.push({
  id: 'the-drowned-tally-tenth-volume',
  knowledge_key: 'item_the_drowned_tally',
  title: 'The Drowned Tally, Tenth Volume: the leaves either side of the thirty-ninth year',
  author: 'the sextons of Soulrest; the note on the licence roll by Hosk-Vei',
  kind: 'ledger',
  taxon: 'T4',
  argonian_authored: false,
  unreliability: 'Every figure in it was measured by the person who wrote it and not one of them was ever set against the figure above. A book can be honest line by line and say nothing at all until somebody adds it up.',
  readable_before: 'Q-MAIN-06',
  topics_taught: ['the-drowned-tally', 'the-return-column', 'the-cutting', 'the-burial-stair'],
  text: `A note from the archive, set at the front, because a reader who comes to this volume out of order will not otherwise know why it is the one every reader is sent to.

The tenth is the volume in which the return column stops being level. Nine volumes go before it and the return is nine, and nine, and nine, and an eight where a sexton was tired, for three hundred and sixty years. This one begins the same way and does not end the same way.

Leaf one hundred and two, in the hand of Sexton Corvo Sedd the elder. The year twenty-six.

Received twenty-two in the season. Returns: nine, nine, nine, nine, nine, eight, nine, nine, nine, nine, nine, nine, eight, nine, nine, nine, nine, nine, nine, nine, nine, nine.

Leaf one hundred and nine, Sedd. The year thirty-three.

Received nineteen. Returns: nine throughout, and a nine struck through and written again as nine, because I dropped the stick in the water and drew a second time to be sure.

Leaf one hundred and fourteen, Sedd. The year thirty-nine.

Received twenty-six. Returns: nine, nine, nine, eight, eight, nine, eight, eight, seven, eight, eight, eight, seven, eight, eight, eight, eight, seven, eight, eight, eight, seven, eight, eight, eight and seven.

In the margin, in the small even hand that is not Sedd's: the sevens are correct. Do not draw them again.

Sedd, under it: I have drawn them again. They are sevens. I have gone back through my own last four leaves and this is the first season in twelve years with a seven in it and there are six of them!

Leaf one hundred and twenty, Sedd. The year forty-five.

Received thirty-one. Returns run between six and eight, and the eights are the ones received in the first month.

At the foot: I have written to the chapter to ask a plain question. Has any house on this coast recut the standing measure inside my service? The chapter has written back that none has, and has asked me not to raise it at the sitting.

Leaf one hundred and thirty-one, in the hand of Sexton Bela Ravano the younger. The year fifty-two.

Received forty. Returns between five and seven. Ravano, at the foot: Sedd is dead and I have his leaves and his question. What is wrong with the stick? Nothing is wrong with the stick. I've three of them and they agree.

Leaf one hundred and forty-eight, Ravano. The year sixty-one.

Received thirty-six. Returns between four and six. In the margin, one correction, downward, in the small even hand. Ravano has written beside it: agreed, and thank you, and who are you? Under that, in a third hand, later and harder: Ravel, don't write to it!

Leaf one hundred and sixty, the last leaf of this volume. The year seventy.

Received forty-four. Returns between four and five.

The archive's note, at the back, written by me and signed, because a reader may want to know which parts of the last four pages are the book and which are the archivist.

The book is everything above. What follows is mine.

I have set this volume against the Provincial Office's licence roll, which is kept at Gideon and which I have read twice and copied once. The first licence to open a sapwell for sale was granted on the seventh day of the seventh month of the year forty-seven, and there is no earlier grant in the roll and no gap in the roll where one could have been.

The first seven in this book is in the year thirty-nine. That's eight years of daylight, and I have written it here because in thirty years I have had four readers in this room and three of them arrived certain that the cutting came first. It would be a great deal tidier if it had. The Court would like it. The Cutters would deserve it. I have looked for a way to read these two dates in the other order and there is not one.

What I will not do is add this book up for you. Eleven volumes are on that shelf and the sum is a season's work and the sixth of them can be read two ways, and a total in my hand is a total in the hand of a man who has already told you what he thinks it says. Wedge the door. The lamp oil is yours.`,
});

add.push({
  id: 'the-drowned-tally-appendix',
  knowledge_key: 'item_the_drowned_tally_appendix',
  title: 'The Drowned Tally, the appendix bound at the back: of readers, and what was measured of them after',
  author: 'the archivists of Soulrest, each in turn, none of them signing',
  kind: 'ledger',
  taxon: 'T4',
  argonian_authored: false,
  unreliability: 'The one part of the Tally that was never meant to be read by the person it is about, and it is written in exactly the same dry hand as the burials.',
  readable_before: 'Q-MAIN-13',
  topics_taught: ['the-drowned-tally', 'the-count', 'the-return-column', 'the-sealing'],
  text: `Bound at the back of the current volume and moved forward each time the current volume changes. It is four leaves and it has been four leaves for four hundred years.

Entered here: every person who has been put into the Count at the seventh bay, the date of it, and what was measured of them at each re-issue afterward. The measure is the ordinary one. A re-issue that comes back as what went in is entered as nine.

  Aveline Rell the elder, the second archivist of that name. Put in on the fourth of the wet, year one hundred and ninety-one.
      first re-issue    nine
      second            nine
      third             eight and a part
      fourth            eight
      fifth             seven and a part
      sixth             seven
      seventh           six and a part
    Died between the seventh and an eighth. The chapter recorded that she had become difficult to be in a room with and was in no pain.

  Ollo Vaen the younger, sexton. Put in on the ninth of the dry, year two hundred and forty.
      first             nine
      second            eight and a part
      third             eight
      fourth            seven
    Four, and then he stopped going into the water. He lived thirty years after and is buried under the stair.

  Ixina Sheel, of the Xul-Aneekh, who came to the Court for this and for nothing else. Put in on the first of the wet, year three hundred and four.
      first             nine
      second            nine
      third             nine
      fourth            eight and a part
      fifth             eight
      sixth             seven and a part
    Six entries and no seventh. The gallery took her back and did not send word.

  Tertius Ollo, a legate's clerk, against the Court's advice and with the Court's leave. Put in on the sixth of the dry, year three hundred and fifty-one.
      first             eight and a part
    One. He wouldn't go in a second time and he was the only one of them who was told this appendix existed, because he asked, out loud, in this room, whether there was a book of the ones who had gone before him.

The archive's standing note on this appendix, copied forward by each archivist and never signed by any of them.

The cost as it is stated to a candidate is true and is complete as far as it goes: the pattern is taken, the pattern is kept, and there is no rite, no keeper, no cure and no ending in this province that takes it back out. Every archivist has said that plainly and every archivist has said it three times.

What is in this appendix is the term that is not stated. A pattern that is held in the Count comes back from a well a little further from itself each time it is drawn, and the column above is what a little further looks like when it is written down over sixty years.

Why is it not stated? Because it was stated once, to a clerk who asked, and he did not go in, and the Court needed a reader that season and did not get one.

That is the reason and it isn't a good one. Whoever is archivist when this is read out loud in front of a witness will have to say it in his own voice, and every archivist who has ever kept these four leaves has known that the day would come and has hoped to be dead first.`,
});

add.push({
  id: 'the-drowned-tally-severances',
  knowledge_key: 'item_the_drowned_tally_severances',
  title: 'The Drowned Tally, the severed entries: three, with the dates',
  author: 'the archivists of Soulrest, in the ordinary hand',
  kind: 'ledger',
  taxon: 'T4',
  argonian_authored: false,
  unreliability: 'Three entries written by three people who were each certain the Court would not survive theirs. The Court survived all three, which the book records and does not comment on.',
  readable_before: 'Q-MAIN-30',
  topics_taught: ['the-drowned-tally', 'the-ninth-clause', 'the-drowned-court', 'the-fair-copies'],
  text: `Kept as a set of three leaves, out of order with the rest, because they are read together or they are read wrong.

An entry of this kind is made when a claim under the ninth clause is severed: when the claimant is shown to have been mistaken, or when the claimant breaks the thing the clause is about, or when the claimant dies in a way that ends it. The form was set at the first of them and has not been altered.

The first. Year one hundred and twelve, the eighth of the wet.

A claimant of nine years' standing, a sexton of this house, who read the count and gave the chapter a figure and was found, by two hands working apart, to have added the fourth volume twice. The figure was withdrawn. He was not put out of the house and he did not ask to be. Entered by the archivist of the day, whose note reads: the count is wrong and the clause is not. We will need another reader and there is no rule that says the next one must be better than this one.

The second. Year two hundred and sixty-eight, the third of the dry.

A claimant who killed a rootkeeper at the fourth hollow, in an argument about a gate, in front of eleven people. The claim was severed the same season by the chapter without a vote, which is the only time that has been done. The archivist's note reads: the clause asks for a person who is owed nothing. It does not ask for a good one. The chapter has decided that it does, and I am entering the decision and not agreeing with it.

The third. Year three hundred and nineteen, the first of the wet.

A claimant who went down at the Bone Ladder and did not come up, in the second year, before anything was settled either way. Entered by the archivist of the day, whose note reads: it isn't known whether the claim was ever good. Nothing that has happened tells us. A death is not an argument and I would ask a later reader not to make it into one.

The archive's note at the foot of the third leaf, added later, in a fourth hand.

Three in four hundred years, and the book was longer than all three of them. It went on being kept the next morning in each case, by whoever was next, and the return column did not change on any of the three days.

What a reader is to take from this: the clause was severed and the count was still there. Has the machine under the Wastes ever had an opinion about the Court's paperwork? This house cannot answer that, and none of the three entries above pretends to.

Space is left below for a fourth. It has been left below for a fourth since the third was written and the leaf has never been cut down to fit the book.`,
});

for (const b of add) {
  if (doc.books.some((x) => x.id === b.id)) throw new Error(`already present: ${b.id}`);
  doc.books.push(b);
}
doc.note = doc.note + ' — W1-READABLES added the TENTH volume (the leaves either side of the thirty-ninth year, where the return column stops being level, with the licence-roll date in the archive\'s note at the back), the APPENDIX (what was measured of previous readers after the tasting) and the SEVERANCES, and gave the fourth volume the `knowledge_key` Q-MAIN-06 had been naming at it since the quest was written. Q-MAIN-06, Q-MAIN-13 and Q-MAIN-30 name these four as `deceit.revealed_by[].source` of channel `ledger`; before this they named nothing.';

fs.writeFileSync(P, JSON.stringify(doc, null, 2) + '\n');
const w = add.reduce((a, b) => a + b.text.split(/\s+/).length, 0);
console.log(`the-drowned-tally.json: ${doc.books.length} volumes, +${add.length} new (${w} words), fourth volume keyed`);
