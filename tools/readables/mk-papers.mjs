// W1-READABLES round 2 — write the documents the `ledger` and `letter` channels name.
//
// `deceit.revealed_by[].channel` is `ledger` on 28 demanded rows and `letter` on 7, and each of
// them names the document a player learns the truth from. Round 1 of this piece wrote nine of
// them; `tools/quests/reveal-route-audit.mjs` section A.2 listed the twenty-six that were still
// an id with nothing behind it. This file is those twenty-six.
//
// THE STANDARD, and it is the brief's:
//
//   * A ledger is a real book with real rows, in a real place, owned by someone, and the fact
//     the player needs is IN it rather than announced by it. Reading one should be reading.
//   * A letter has a sender, a recipient and a reason to have been written. It is not a quest
//     brief in an envelope.
//   * Nothing here explains itself to the player. There is no summary line at the foot of any of
//     them, because a clerk does not write a summary line for the person who steals his book.
//
// WHERE THEY GO. Same rule as round 1: a document lives in the room where the person who owns it
// stands, and those posts are `npc.post.at_building`, authored by W1-GIVER-PRESENCE. The
// exceptions are declared in PLACEMENT below, one comment each.
import fs from 'node:fs';
import path from 'node:path';

const OUT = 'game/data/books/the-papers-in-evidence.json';
const IDIR = 'game/data/world/interiors';

// ------------------------------------------------------------------------------- the documents
const BOOKS = [];
const doc = (b) => { BOOKS.push(b); return b; };

doc({
  id: 'the-guild-denial',
  knowledge_key: 'item_guild_denial',
  title: 'A reply from the Dyers’ and Salters’ hall at Archon',
  author: 'Onden Varo, clerk to the hall, for the wardens',
  kind: 'letter',
  taxon: 'T4',
  argonian_authored: false,
  unreliability: 'A denial written by an office that has the measurements. It is careful about every claim it makes and careless about which claims it chose to answer.',
  text: `To the harvesters of the lichen beds above the strand, and to any officer of the Provincial Office who is shown this.

Your complaint of the wet season is answered as follows.

The hall does not accept that the vats above the strand are the cause of any sickness on the beds. The run from the vats is carried in a stone channel to the low water and is not turned onto the beds at any point in the process, and no warden has ever ordered otherwise. The hall has the channel measured twice a year and will show the measurements to any officer who asks for them at the counter.

The hall does not accept that the beds have failed. The beds gave four hundred and ten weight last year against four hundred and sixty the year before, and a fall of that size is ordinary in the fifth year of a bed and is written in every dyer's book in the province.

The hall does not accept the reading your own man took. A reading of the low water taken in a jar without salt will show what he says it showed. The hall's method, which is the method in the charter and was in the charter before the hall was granted it, is to take the jar with a measure of salt already in it, because the salt holds the matter down and gives the true colour of the water above it. Your man's jar had no salt in it. We are content that he did not know this and we do not accuse him of anything.

The hall regrets that four of your people are coughing. It observes that the beds are wet ground and that the coughing sickness is common on wet ground, and it has sent a measure of oil to the reed-walk for their use, which is a gift and is not to be entered anywhere as an admission.

The wardens will hear you again at the second bell of any market day. Come to the counter and not to the yard.

Entered on the hall's copy, and the hall's copy is not to leave the hall.`,
});

doc({
  id: 'the-blackrose-lease-stub-book',
  knowledge_key: 'item_blackrose_lease_stub',
  title: 'Counterfoils, the labour-lease, Blackrose',
  author: 'The prison-fortress at Blackrose, four clerks in succession',
  kind: 'ledger',
  taxon: 'T4',
  argonian_authored: false,
  unreliability: 'The half of a torn form that stays in the book. It was never meant to be read as a series, and read as a series it says more than any single lease does.',
  text: `The stub is what is left in the book when the lease is torn out and given to the man who takes the people. It carries the number, the count, the term and the hand that signed. It does not carry the destination, which is on the part that was torn off.

  Book four, stubs 1 to 40. Term of six months. Counts: 8, 12, 6, 9, 11, 7, 14, 6, 8, 10, and so on down the leaf.
  Book four, stub 41. Count 12. Signed by the under-warden. Against it, in the margin: not returned at term. Entered again at stub 63.
  Book four, stub 63. Count 12. Term of six months. Same names as 41, which the clerk has not written out again but has marked with the word again.
  Book four, stub 64. Count 12. Term of six months. Again.
  Book four, stub 65. Count 12. Again.

Note by the third clerk, at the foot of the leaf, and the hand is not a careful one: I have been told to write again and I have written it. I would like it known that I asked what again means when it has been written four times against the same twelve people and I was told that it means the term was renewed. A term is renewed with the leaseholder. Renewed with whom, on stub 65?

  Books four to nine, the run of the seasons. Stubs entered: six hundred and eight. Stubs marked returned at term: one hundred and ninety-seven. Stubs marked again: four hundred and eleven.

Note by the fourth clerk, who has ruled the count above and initialled it: the four hundred and eleven are not dead in this book and are not alive in it. They are only not returned. I have carried the figure forward from the last audit and I will carry it forward from this one, and I am putting my initials against it so that the next clerk knows the figure is a real count and not a guess.

The stubs from book ten are in the same press and are not ruled up. And there has been no audit since.`,
});

doc({
  id: 'the-lease-register-third-hand',
  knowledge_key: 'item_lease_register_third_hand',
  title: 'The lease register, reconciled, third hand throughout',
  author: 'Clerk Meno, for the Prefect’s floor at Blackrose',
  kind: 'ledger',
  taxon: 'T4',
  argonian_authored: false,
  unreliability: 'A fair copy. Everything in it is true and the argument is in what was not copied across.',
  text: `Reconciled from the stub books and the yard returns, this season, by order.

The register has four columns where the stub book has five. The column that is not here is the destination, and the order under which this copy was made says that destinations are a matter for the leaseholder and not for the fortress.

  Entry 210. Count 12. Term six months. Leaseholder: a factor. Returned: no.
  Entry 211. Count 9. Term six months. Leaseholder: a factor. Returned: no.
  Entry 212. Count 14. Term six months. Leaseholder: a factor of the same house. Returned: 3.
  Entry 213. Count 6. Term six months. Leaseholder: a factor. Returned: no.

The word factor stands in this register two hundred and six times and no house is named beside it once. Two hundred and six factors and not one house!

Note by the copying clerk, kept because the Prefect's floor asked for the working papers with the fair copy and did not say to burn them: the stub books do carry the destination on the torn half, and the torn halves come back to us at the end of the term with the returns pinned to them. I have them in the press. Of the two hundred and six, one hundred and ninety-one go to the salt flats east of the Boethiah stone, and the flats are worked under three names, and all three names are on the Dres rolls at Tear. The other fifteen go to the vats at Archon.

I did not put this in the fair copy because I was not asked to and because a clerk who supplies a column the order did not ask for is a clerk who has an opinion. I am putting it here. If the fair copy is ever laid beside the stub books by anyone who can count, the two will not agree, and the disagreement will be a whole column wide.

The working papers are in the third press from the window, under the ledger boards, and are not indexed.`,
});

doc({
  id: 'the-drawer-charters',
  knowledge_key: 'item_tesh_drawer_charters',
  title: 'Four cutting charters, kept in the customs drawer at Lilmoth',
  author: 'The Blackwood Company, and a harbourmistress who did not file them',
  kind: 'letter',
  taxon: 'T4',
  argonian_authored: false,
  unreliability: 'Four ordinary licences. Nothing false was written on any of them.',
  text: `Charter of survey and cutting, first. Granted to the Blackwood Company for the standing hist at the head of the Thorn reach. The measure to be taken by the Company's own man and returned to this house within the season. Signed and sealed. Returned on the day.

Charter of survey and cutting, second. Granted to the Blackwood Company for the standing hist at the head of the Thorn reach. The measure to be taken by the Company's own man and returned to this house within the season. Signed and sealed. Returned eleven days late, with a note that the first man's figures had been mislaid.

Charter of survey and cutting, third. Same tree. Same terms. Returned on the day, with the measure of the trunk at the shoulder given to the eighth part of a measure, which is finer than the form asks for and finer than any of the others.

Charter of survey and cutting, fourth. Same tree. Same terms. Not returned.

In the harbourmistress's hand, on the back of the fourth, which is the only thing in this drawer that was not written by the Company:

Four charters in fourteen months for one tree, and the tree is not a good tree and is not on a road. I have signed all four because the form is in order and a customs house that refuses a form in order is a customs house that gets a new officer.

The first man was Ineel-Sa's boy and he came back and drank in the Stilt and told the room the tree was sound.

The second man I never saw.

The third man I saw twice. He is the one who measured to the eighth part, and he asked me at the counter whether the house kept the earlier measures, and I said the house keeps everything, and he did not ask to see them.

The fourth man went up the reach in the dry season with two hands and a boat and the boat came back with the two hands in it.

I have not filed these. Filed, they go to Archon in the quarterly bag and I do not know who reads the bag at Archon. Here they are in a drawer in a customs house and a drawer is not a hiding place, it is only somewhere that is not Archon.`,
});

doc({
  id: 'the-unsealed-chits',
  knowledge_key: 'item_unsealed_chits',
  title: 'A bundle of toll chits, unsealed, from the gate at Gideon',
  author: 'The gate-hands, and the counting floor above them',
  kind: 'ledger',
  taxon: 'T4',
  argonian_authored: false,
  unreliability: 'The rough half of a two-part record. It is honest because it was never supposed to be kept.',
  text: `A chit is written at the gate by the hand who takes the toll, is torn in two, and goes up to the counting floor to be sealed and entered. The sealed half is the book. The unsealed half is supposed to be burned at the end of the day.

These were not burned. They were kept in a nail-box under the scale by a gate-hand who says he keeps them because the floor has twice sent a chit back down saying the figure was wrong, and he would rather have the paper than the argument.

  Fourth day, dry season. Chits written at the gate: 44. Total taken at the gate: three hundred and eighty.
  Fourth day, dry season. Entered above: 44. Total entered above: three hundred and twelve.

  Fifth day. Written: 51. Taken: four hundred and forty. Entered: 51. Entered above: three hundred and sixty.

  Sixth day. Written: 39. Taken: three hundred and ten. Entered: 39. Entered above: two hundred and forty-eight.

The count of chits agrees every day. It is only the figures that do not, and the figures do not agree by about a fifth, and it is never the same fifth twice.

In the gate-hand's own hand, at the bottom of the box, on a chit with no toll on it: I am not a counting man. I can't rule a column and I don't want to. I can see that forty-four is forty-four. I can see that the number at the bottom of my day is not the number at the bottom of the floor's day, and I have seen it now for four seasons, and it goes the one way and never the other.

I asked the floor once. The factor said the gate weighs light and the floor weighs true, and that the difference is the weighing. It isn't weighing. It's subtraction. What is weighed on a counting floor? Four seasons of it, and I have not had an answer that is a number!

Two chits at the top of the box are stuck together with pitch and cannot be read. They are from the season the audit came.`,
});

doc({
  id: 'the-blackrose-lease-roll',
  knowledge_key: 'item_blackrose_lease_roll',
  title: 'The lease roll, with the renewal clause, Assize copy',
  author: 'The Provincial Office, and a prefect who was a clerk at the time',
  kind: 'ledger',
  taxon: 'T4',
  argonian_authored: false,
  unreliability: 'The Assize’s own copy of an instrument the Assize has never been asked to rule on.',
  text: `The roll of the labour-lease at Blackrose, as renewed, with the clauses entire.

Clause the first. The fortress may lease the labour of persons in its keeping to any leaseholder approved by the Provincial Office, for a term of six months, at the rates in the schedule.

Clause the fourth. A term may be renewed on the application of the leaseholder, provided the Provincial Office has approved the leaseholder within the year.

Clause the ninth, and this is the clause the roll exists for. Where the Provincial Office has not returned an answer to an application within sixty days, the application shall be taken as approved and the term shall run.

Clause the tenth. A term renewed under the ninth clause shall be entered in the register in the ordinary way and shall not be distinguished.

Note in the office hand, against the tenth: added at the request of the fortress, which represented that a register with two kinds of entry in it invites the question which kind an entry is.

The applications under the ninth clause, by year, ruled at the foot of the roll:

  First year: 4.
  Second year: 11.
  Third year: 40.
  Fourth year: 61.
  Fifth year: 74.
  Sixth to eleventh year: not counted. The clerk's note says the count was discontinued because the answer was the same every year and the counting took a week.

Below that, in a different and much later hand, unsigned, in pencil, and not rubbed out:

Sixty days is a long time to be silent and a short time to be silent in. The Office is four hundred miles away. No clerk there stopped answering. They were never asked to answer, because the fortress learned in the third year that an application posted in the wet season will not be answered in the wet season, and a clause that turns silence into a yes will turn a bad road into a policy.

The roll is signed at the foot by a prefect of the day and countersigned by a clerk, and the clerk's initials are worn but are still an H.`,
});

doc({
  id: 'the-stormhold-transfer-file',
  knowledge_key: 'item_stormhold_transfer_file',
  title: 'The transfer file, garrison archive, Stormhold',
  author: 'Nine applications in one hand, and the archive’s own docket',
  kind: 'ledger',
  taxon: 'T4',
  argonian_authored: false,
  unreliability: 'A file kept in perfect order by an office with no reason to keep it and every reason not to lose it.',
  text: `Docket. Applications for transfer of a serving officer, Blackrose station, received at this archive and held.

  Received in the third year. One sheet. Application for transfer to any station in the interior. Reason given: none required by the form. Docketed: forwarded.
  Received in the fourth year. One sheet. To any station. Docketed: forwarded.
  Received in the fifth year. Two sheets, the second being a note asking after the first. Docketed: forwarded, and the note filed.
  Received in the sixth year. One sheet, and the reason box is filled in, which the form does not require. The reason is one line and reads: I have been here longer than the sentences.
  Received in the seventh year. One sheet. To any station. To any rank.
  Received in the eighth year. One sheet.
  Received in the ninth year. One sheet, with a line at the foot in place of the reason: what becomes of these?
  Received in the tenth year. One sheet.
  Received in the eleventh year. One sheet. The hand has changed a good deal since the third year.

Archive note, in the archivist's hand, at the head of the docket: all nine forwarded to the Provincial Office under cover of the ordinary bag. No answer has been received to any of them. The archive does not hold answers. The archive holds what it is sent and what it sends, and it has sent nine and been sent nothing.

Second archive note, dated this season: the officer commanding this district asked for the file and read it at the table and returned it. He asked whether the applications had gone out under his cover or under the fortress's. They went out under the fortress's, which is the ordinary way, and the fortress's cover is the Prefect's floor, and the Prefect's floor is where the applicant sits.

So it is held under the shelf-mark for personnel, which is not a sealed shelf. Any clerk with business in this room may pull it, and in eleven years four people have.`,
});

doc({
  id: 'the-legates-seal-register',
  knowledge_key: 'item_legates_seal_register',
  title: 'The register of the Legate’s seal',
  author: 'The Assize at Gideon, since the seal was cut',
  kind: 'ledger',
  taxon: 'T4',
  argonian_authored: false,
  unreliability: 'A register kept exactly as the instrument requires. Every line in it is a correct entry and the shape of the whole is not in any line.',
  text: `The seal may be set to an instrument by the Legate or by the officer holding the Legate's commission, and every setting is entered here with the date, the cause and the case.

The causes, as the instrument names them: to close a case that has been heard; to stay a case that cannot be heard; to reopen a case where new matter is shown.

  Use 1. To reopen. The matter of the two boats at Stilt-Row. Reopened, heard, and closed the following season.
  Use 2. To stay. The matter of the toll at Tenmarch. Stayed for want of the gate book.
  Use 3. To stay. The matter of the widow of the salt yard. Stayed.
  Use 4. To stay. The matter of the reed-walk fire. Stayed.
  Use 5. To stay. Stayed.
  Use 6 to Use 19. To stay, all fourteen, and the causes are entered in full and are all of them good causes: a witness gone up the coast, a book lost in the wet, a party not found, a party dead, a court not sitting.
  Use 20 to Use 39. To stay.
  Use 40. To stay. The matter of the labour-lease at Blackrose, on the application of the Provincial Office, no party appearing.

The register has two columns and no third. There is no column for what became of a stayed case, because a stayed case does not become anything. It waits, and the instrument does not say for how long, and nothing in this room says what a case is doing after the fourth year of waiting.

Note in the Assize's hand at the foot of the leaf, and it is the only note in the register: the instrument was cut so that a governor could not reopen a heard case to punish a man he disliked. It is a shield and it was described to me as a shield when I was sworn. I have set it forty times. I have reopened once. A shield against what?

But the seal itself is in the drawer of this table, and the drawer has a lock, and the key is on the Legate's ring and on mine.`,
});

doc({
  id: 'the-damp-four',
  knowledge_key: 'item_prefect_returns_damp',
  title: 'Four returns of the Prefect’s floor, water-marked, unbound',
  author: 'A clerk of the eleventh year before, whose initials are on all four',
  kind: 'ledger',
  taxon: 'T4',
  argonian_authored: false,
  unreliability: 'Four working returns that have been in water. The figures are legible and the countersignature is the part that has gone.',
  text: `The quarterly return of the Prefect's floor at Blackrose, being the leases entered, the terms run, the persons returned and the persons not.

Return of the first quarter of that year. Leases entered: 61. Terms run out: 44. Persons returned: 19. Persons not returned: 128. At the foot, the clerk's initials, and beneath them the ruled box for the Provincial Office's countersign, which is empty and has always been empty.

Return of the second quarter. Leases entered: 58. Terms run out: 51. Persons returned: 22. Persons not returned: 141. Countersign box empty.

Return of the third quarter. The leaf has been wet along the fold and the ink of the totals has run into the column rules, but the figures stand: leases 66, terms 49, returned 17, not returned 160. Countersign box empty. In the margin, in the same clerk's hand: sent under the ordinary cover on the ninth. Sent again on the fortieth, no answer. I am entering the second sending because the first is not in the book.

Return of the fourth quarter. Leases 70. Terms 60. Returned 24. Not returned 174. Countersign box empty. In the margin: I have asked the under-warden what a return is for if the Office does not sign it back. He says it is for the fortress, so that the fortress knows. The fortress knows. The fortress is the one counting.

At the head of the bundle, on a slip pinned through all four:

These four were pulled from the press in the wet season and were laid on the sill to dry and were forgotten there for a night, and the sill leaks. They are the only four of that year that came out of the press at all. The rest of the year is bound and shelved and has not been opened.

The clerk's initials on all four are the same two letters and the first of them is an H.`,
});

doc({
  id: 'the-declaration-drafts',
  knowledge_key: 'item_declaration_drafts',
  title: 'Drafts of the court’s declarations, dated at the head',
  author: 'Scribe Hulen, and the office’s ordinary practice',
  kind: 'ledger',
  taxon: 'T4',
  argonian_authored: false,
  unreliability: 'Working drafts kept because the office keeps everything. The dates are the office’s own and were put there for the office’s own reasons.',
  text: `The office drafts a declaration before the sitting, so that a fair copy may be made up the same day and sealed while the court is still in the room. This is written in the practice book and has been the practice for longer than anyone in the building.

  Draft of the declaration in the matter of the wharf tolls. Dated at the head, the day before the sitting. Two amendments in the margin, both of them to the recital of the parties. The finding is not amended.
  Draft in the matter of the salt yard. Dated the day before. No amendments.
  Draft in the matter of the eighth chair. Dated the day before. One amendment, striking a sentence that named a house, and the striking is heavy enough to have gone through the leaf.
  Draft in the matter of the labour-lease. Dated four days before the sitting, which is unusual and which the scribe has initialled to show it was deliberate.
  Draft in the matter of the distraint at Stilt-Row. Dated the day before. The finding as drafted and the finding as declared are the same to the word.

Twenty-two drafts in the bundle. Twenty-two findings as drafted. Twenty-two findings as declared. No draft in this bundle has ever had its finding amended.

Note in the scribe's hand, on the wrapper, and it is a defensive note and reads like one: a draft is not a decision. The court sits, the court hears, the court finds, and if the court finds otherwise than the draft the scribe writes it out again and it takes an hour and everyone waits. That has not happened in my time. It has not happened in my time because the office does not draft what it does not know, and it does not put a matter into the list until it knows.

Second note, smaller, on the inside of the wrapper: I was asked once to draft two of a matter, one each way, and I said I would, and then the matter came off the list. Whose hand takes a matter off a list?

And the bundle is tied with tape, and the tape is not sealed.`,
});

doc({
  id: 'the-prefect-commission',
  knowledge_key: 'item_prefect_commission',
  title: 'The commission of the Prefect, with the schedule of terms',
  author: 'The Imperial Provincial Office, over the Governor’s hand',
  kind: 'ledger',
  taxon: 'T4',
  argonian_authored: false,
  unreliability: 'An instrument that says plainly when it stops. It has never been read to the end in this building.',
  text: `By these presents the office of Prefect for the district of Blackrose is committed to the officer named, with the powers in the schedule, to hold and exercise from the date hereof.

Schedule of powers. To keep the fortress. To take persons into keeping under warrant. To lease the labour of persons in keeping under the roll. To hold the returns. To sit with the Assize when the Assize sits in the district and to have no vote there.

Schedule of terms. The commission runs for six years from the date hereof, and may be renewed by the Office on the application of the holder, and shall not be renewed by silence.

Note in the office hand beneath the terms: the words and shall not be renewed by silence are inserted at the direction of the Legate, the ninth clause of the labour-lease roll having been drawn to his attention.

The date at the head of the commission is eight years old.

Below, on a slip tucked into the fold and in the notary's hand:

The application for renewal is in the letter book of this office, entered in the sixth year, and was sent under the ordinary cover. There is no answer in the letter book and there is no answer in the archive at Stormhold, and I have looked in both.

I have not raised it. I want that written down against my name rather than said, because if it is ever asked when I knew I would rather the answer were a date than an argument.

What the commission is is a piece of paper. What the office is is a fortress with four hundred people in it, a floor of clerks, a roll, a schedule of rates and a court that sits when it is called. None of that stops when a date passes and none of it noticed. A district does not fall over because a sheet in a press ran out. It goes on doing exactly what it did, under a person who is doing exactly what they did, and the only thing that has changed is what the paper would say if a clerk pulled it.

No clerk has pulled it. I am putting this slip in the fold so that when the next one does, they do not have to look for the letter book.`,
});

doc({
  id: 'the-fourth-writ',
  knowledge_key: 'item_fourth_writ_attainder',
  title: 'The fourth writ, and the three before it',
  author: 'The Assize court at Gideon, four sittings',
  kind: 'ledger',
  taxon: 'T4',
  argonian_authored: false,
  unreliability: 'Four instruments of the same kind. The fourth is not forged and is not irregular.',
  text: `A writ of attainder under the Legate's seal puts a person out of the protection of the courts of this province and vests what they hold in the Office. It is heard in open court, on evidence, with the party present or shown to have been called.

  Writ the first. The matter of a pilot of the Topal run, on evidence of piracy, the party present, the party heard. Vested: a boat.
  Writ the second. The matter of a factor of Lilmoth, on evidence of forgery of a customs seal, the party present. Vested: a warehouse and its stock.
  Writ the third. The matter of a warder of Blackrose, on evidence of the sale of persons out of keeping, the party not present and shown to have been called three times. Vested: nothing; the party held nothing.
  Writ the fourth. The matter of a house of Soulrest, on evidence of a debt to the Office, the party not present and shown to have been called once. Vested: the reed ground above the burial stair, the two sheds on it, and the leave to cut on it.

Note by the notary, on the back of the fourth, in the ordinary way of a notary noting an irregularity that is not an irregularity:

The first three are on evidence of a crime. The fourth is on evidence of a debt. There is nothing in the instrument that says a writ must be on a crime. I have read it three times looking for the word and the word is not there, and the reason the word is not there is that no one drafting it thought a debt would be brought under it.

The party was called once and not three times because the instrument says shown to have been called, and once is a showing. I have entered the calling and the entry is correct.

The reed ground vested under the fourth writ was let the same season, on a lease of forty years, to a factor of the Wet Ledger. The lease is in the roll.

What I would say if I were asked, and I have not been asked: the writ does what the writ says. The writ has always done what the writ says. It is only that no writ had been used to take a reed bed before, and now that it has taken one, it is an instrument for taking reed beds and it always was.`,
});

doc({
  id: 'the-eighth-chair-returns',
  knowledge_key: 'item_eighth_chair_returns',
  title: 'The eighth chair’s returns, two years, signed',
  author: 'The Wet Ledger’s counting floor at Gideon',
  kind: 'ledger',
  taxon: 'T4',
  argonian_authored: false,
  unreliability: 'A run of ordinary quarterly returns. The interesting column is the one every clerk skips.',
  text: `Return of a seat at the table, quarterly: what the seat put in, what the seat drew, what stands against the seat, and the hand of the factor who signed the return in.

  Eighth chair, first quarter. Put in: four hundred. Drew: nothing. Against: nothing. Signed in by: R. S.
  Eighth chair, second quarter. Put in: four hundred. Drew: two hundred and twenty. Against: nothing. Signed in by: R. S.
  Eighth chair, third quarter. Put in: six hundred. Drew: nothing. Signed in by: R. S.
  Eighth chair, fourth quarter. Put in: six hundred. Drew: eight hundred and forty. Signed in by: R. S.

  Second year, all four quarters, and the figures rise. Signed in by: R. S., R. S., R. S., R. S.

The seat's own name is not in this book. A seat is a number at this table and the names are on the back leaf in the first chair's room, and that is the house's rule and is not a secrecy.

The signing hand is in this book, because a return has to be brought in by a factor of the house and the house needs to know which of its factors is answerable for it. Eight returns, one hand, two years.

Note in the second chair's writing, in the margin of the second year, unsigned and not struck out: R. S. brings in the eighth chair's return and R. S. sits at this table. I have said at two meetings that a factor should not carry the return of a seat, and both times the answer was that a factor has to carry it and that the eighth chair is at Archon and does not come up.

The eighth chair is at Archon. The eighth chair pays in salt money in the dry season and coin in the wet, which is how a salt factor pays and is not how the other seven seats pay. I am not making an accusation. I am saying that a house whose eighth seat is a salt factor at Archon has a Dres interest at its table, and that everyone here knows it, and that the reason it is not written anywhere is that it is not written anywhere.

The back leaf is fetched when a debt is called. No debt has been called against the eighth chair.`,
});

doc({
  id: 'the-corvo-note',
  knowledge_key: 'item_corvo_note',
  title: 'A note, folded small, in the customs drawer at Lilmoth',
  author: 'Assizer Corvo, to the harbourmistress, unsigned',
  kind: 'letter',
  taxon: 'T4',
  argonian_authored: false,
  unreliability: 'Written by a careful man in a hurry, to a harbourmistress he trusts more than he trusts the post.',
  text: `Tesh —

I'm not putting my name at the bottom of this and you'll know the hand.

You asked me at the shed whether the underwriter's gate can be shut without the table's leave and I told you no, and I have gone and read the articles since, and the answer I gave you was the answer everyone in Gideon gives and it is not the answer in the book.

The gate is shut by a vote of the seats. Seats, not chairs. The articles say seats and the word chair does not appear in the article at all; it appears in the schedule of fees, which was written a hundred years later by people who had started saying chair because there were chairs in the room.

A seat is a party to the compact. The wharf is a party to the compact. It was made a party in the founding, because the founding was four merchants and a wharf, and the wharf has never been struck out, and nothing in the articles says a party stops being a party when it stops sending a hand to the meetings.

So there are five, and every seat in that hall has been counting four for as long as I have been going to it. Where do you think the fifth went?

I'm not going to raise it myself. If I raise it, it's an Assize officer telling a licensed house how to read its own articles, and the house will read it as the Office coming for the compact, and it will close and I will get nothing out of it for ten years. It has to come from inside the hall or from the wharf itself.

The wharf does not know. I asked a porter and he laughed at me.

Burn this or don't, I'm past minding, but don't put it in the bag to Archon. Two things I have sent in that bag have arrived opened and one of them arrived read.

The articles are in the ledger house at Lilmoth on the shelf behind the counter and are not locked up. Go and read the founding article yourself. Do not take my count for it, take the paper's.

C.`,
});

doc({
  id: 'the-wharf-float-book',
  knowledge_key: 'item_wharf_float_book',
  title: 'The float book of the wharf, kept in pencil',
  author: 'The wharf hands, whoever is at the shed',
  kind: 'ledger',
  taxon: 'T4',
  argonian_authored: true,
  unreliability: 'A book kept by people who did not think of it as a book. It is the only record of a thing that has never had a record.',
  text: `The float is the box at the shed. Anyone off the wharf may draw on it who cannot work, and puts back when they can, and the putting back is not a term and has never been a term.

  Drawn: a widow of the Stilt, forty. Put back: nothing yet.
  Drawn: a hand with a crushed foot, twenty. Put back: twenty, over the dry season.
  Drawn: a boy for his mother's burning, thirty. Put back: fifteen. The rest forgiven at the shed by the hands who were there.
  Drawn: a pilot laid up, sixty. Put back: sixty.
  Drawn: a hand, ten. Put back: ten.
  Drawn: the same widow, twenty. Put back: nothing yet.

Six names on the leaf this season and the leaf is a scrap of a tally sheet with the ruling still on it.

It's in pencil because the shed is wet and ink runs, and because a hand who can't write borrows the pencil off the one who can and gives it back.

Note at the foot, and the hand is a careful one and is not a wharf hand's:

A gentleman came down from the Salt House and stood in the shed and asked to see the float book and was told there is no book, there is the leaf. He asked whether the leaf is kept. He was told it is kept until it is full and then a new one is started and the old one goes in the box with the tally sheets.

He asked how much is in the box at the shed. He was told the shed does not count it, you put in and you take out, and it has never been empty.

He said that a fund without a book is not a fund and that we are carrying a risk we cannot see, and he offered to have it entered properly at the house, at no charge, as a service to the wharf. Service!

I've written this down because I don't know how to say what's wrong with it and I can see that it is wrong. A book has an owner. This does not. There is no chair at any table in this province who can call a debt against that box, and that is not because we hid it, it is because we never wrote it down, and the moment it is written down there is a page with a name at the top.

But the pencil is still on the string by the door.`,
});

doc({
  id: 'the-letter-held-to-the-lamp',
  knowledge_key: 'letter_held_to_the_lamp',
  title: 'Two letters that travelled together',
  author: 'The Wet Ledger’s counting floor, in two hands and on one paper stock',
  kind: 'letter',
  taxon: 'T4',
  argonian_authored: false,
  unreliability: 'Two letters that say different things and were made in the same room on the same afternoon.',
  text: `The first, from the counting floor to a yard master at Lilmoth.

Sir. Your account with this house stands at four hundred and ten, the season's interest being added on the ninth as usual, and the house has had no payment from you since the turn of the dry. The house does not press an account in the wet season and has not pressed yours. It asks only that you come to the counter before the second bell of the next market day and say what you intend, and the house will hear it. If the house has not seen you by then the account goes to the second stage, which is a matter for the clerks and not for me.

The second, from the counting floor to a factor of the same house, sent the same day, and not to Lilmoth.

The yard at Lilmoth will not come to the counter. He has not come in three seasons and he will not come now. Have the gear valued at the yard on the market day itself, quietly, and have the valuation ready. If he comes, we have wasted a morning. If he does not come, the second stage opens on the day after and the valuation is already in the book, which saves us the fortnight the valuing takes and saves him the fortnight of knowing it is being done.

Held up to a lamp, the two are one sheet of stock. The wire lines cross at the same spacing and the maker's mark falls in the same quarter of each, which is what happens when two letters are cut from one ream. Both are ruled at the head to the same depth. The second has been folded to the smaller size for the inside bag and the first to the larger for the post, and both folds are fresh.

The house's own separation rule, from the practice book, on the shelf above:

The clerk who writes to a debtor shall not write to the valuer, and the two shall not be written on the same day, and the second shall not be written until the first has been answered or the day for answering has passed.

Note in the practice book beside the rule, in the first chair's hand: this is not a courtesy to the debtor. If the two are written together then the demand was never a demand, and a house that manufactures the default it then collects on is not a house that lends money.`,
});

doc({
  id: 'the-berth-roll',
  knowledge_key: 'item_berth_roll',
  title: 'The berth roll, with the inspection dates',
  author: 'The harbour office at Gideon, and the Ledger’s strongroom copy',
  kind: 'ledger',
  taxon: 'T4',
  argonian_authored: false,
  unreliability: 'A copy of a public roll, kept privately, with one column the public roll does not carry.',
  text: `The roll of berths let on the long shed, with the term, the standing of the bond and the date of the last inspection.

  Berth 4. Let on bond. Bond standing: clear. Inspected: this season.
  Berth 5. Let on bond. Bond standing: in arrears, one season. Inspected: this season.
  Berth 6. Let on bond. Bond standing: clear. Inspected: last season.
  Berth 7. Let on bond, to a bond-wife of Stilt-Row. Bond standing: three seasons from clear. Inspected: not since the letting.
  Berth 8. Let on bond. Bond standing: clear. Inspected: this season.

The bond on berth 7, in the schedule at the back, quarter by quarter: eleven hundred at the letting, paid down to four hundred and forty over nine quarters, no quarter missed, no quarter part-paid.

Note in the strongroom clerk's hand, against berth 7:

The house has instructed that berth 7 be entered in arrears in the roll that goes to the harbour office. It is not in arrears. I have entered it as instructed and I have entered the schedule here so that the two are in the same press and anyone pulling one pulls the other.

I asked the factor why the house wants the berth and not the money. She said the house would rather have the berth than the last four hundred and forty. I said the house will have both if it waits three quarters. She said the house is not waiting.

An inspection clears a bond that is being paid. Berth 7 has not been inspected since the letting, and an inspection is called by the harbour office on the application of the house, and the house has not applied, and the roll that goes to the harbour office says arrears, and a berth in arrears is not inspected because there is nothing to inspect.

I am a clerk and not a lawyer. But what I can see is a circle with three sides to it, and the woman on the berth is inside it.

The schedule is initialled at every quarter by the hand that took the payment, and four of the nine are mine.`,
});

doc({
  id: 'the-soulrest-daughter-letter',
  knowledge_key: 'letter_soulrest_daughter',
  title: 'A letter to the harbour office from a daughter at Soulrest',
  author: 'Ineve Corrano, of Soulrest',
  kind: 'letter',
  taxon: 'T4',
  argonian_authored: false,
  unreliability: 'A private letter about a death, sent to an office, and filed by that office in the ordinary way.',
  text: `To the harbour office at Gideon, and to whoever there has the keeping of the minute book.

I am writing about my father, who sat at your table and whose name I am not going to put in a letter that goes in a bag, because you know which seat he had and you can find him in your own book.

He died in the wet season four years ago, at Soulrest, at my house, of the lung. The Court's chapter took him on the fourth day and he is in the register there and you may have it from them under the Court's hand if my word is not enough for an office.

I am writing because the man who came from Gideon in the dry season to have my father's papers said that my father's seat had voted in the spring, and I said that was not possible, and he said he had it from the minute book, and I said then the minute book is wrong, and he said the minute book is the minute book.

Whose hand is against my father's seat? That is the only thing I am asking for. I do not want anything, and there is no estate. The seat went back to your table when he died and I signed the paper your factor brought and I have the copy.

What I want is for one of you at that table to look at the minute for the spring sitting and see whose hand is against my father's seat, because it is not his, he could not hold a pen by the winter and I wrote his last three letters for him myself.

If the answer is that a seat may be voted by a factor when the holder is dead, then say so and I will not write again. If the answer is that the table did not notice, then I would like that written down somewhere, because four seats overruled the first chair that spring and my father's was one of the four, and my father was in the ground at Soulrest.

I've sent this by the ordinary bag because I don't know any other way to send it.

Docketed at the harbour office in the clerk's hand: received, read, no action, filed with the minute book.`,
});

doc({
  id: 'the-harbour-minute-book',
  knowledge_key: 'item_harbour_minute_book',
  title: 'The minute book of the harbour office, the spring sitting',
  author: 'The clerk to the table at Gideon',
  kind: 'ledger',
  taxon: 'T4',
  argonian_authored: false,
  unreliability: 'A correct minute of a meeting that happened. Everything doubtful about it is in the form the office has always used.',
  text: `Minute of the sitting of the table, spring, at the harbour office.

Present: the first chair, and the seats numbered two, three, five, six, seven and eight, by their holders or by their factors.

The first chair laid the question of the long shed and moved that the letting be held over to the dry.

The question being put, the seats divided.

  For the first chair: seats two and six.
  Against: seats three, five, seven and eight.

The motion falling, the letting proceeds.

The form of the division, from the practice book bound in at the front of this volume: the clerk shall record the seats and not the persons, a seat being the party to the compact and a person being only the hand it comes in.

Note by the clerk, at the foot of the minute, in the ordinary place where a clerk notes an attendance: seat five came in by factor. Seat seven came in by factor. Seat three came in by its holder and left before the division and its factor stood.

There is no note against seat eight because there was nothing unusual about seat eight. Seat eight always comes in by factor.

Bound in after the minute, on the office's own paper, a slip in a different hand:

The daughter's letter about seat three is in this press. I have read it and read the minute and the minute is correct in its own terms. Seat three divided. A seat divides. The book does not say the man was in the room because the book has never said that about a single holder, and the reason it has never said it is that in a hundred years the question has not come up.

Four seats overruled the first chair. Take one of the four away and it is three against three and the first chair holds. Everything let on the long shed since that spring is let on a division of four, and one of the four was a seat whose holder had been dead a year, and the minute is correct, and the letting is good, and both of those are true at once.

And the volume for that spring is on the second shelf, and it is not out of order.`,
});

doc({
  id: 'the-soulrest-licence',
  knowledge_key: 'letter_soulrest_licence',
  title: 'The licence of the house at Soulrest, with the founding article',
  author: 'The Wet Ledger, at its founding, and the Provincial Office',
  kind: 'letter',
  taxon: 'T4',
  argonian_authored: false,
  unreliability: 'The oldest paper in the house and the one no clerk has needed to read.',
  text: `Licence to a house of lending and underwriting, granted at Soulrest, to the compact of four merchants and the wharf, upon the articles annexed.

The articles annexed, so much of them as the licence recites:

Article the first. The compact is of five parties, being four merchants of Gideon and the wharf at Lilmoth, and each party has one seat.

Article the second. No act of the compact binds the compact unless the seats are counted and a majority of the seats consent, and a seat not sending consents to nothing.

Article the fifth. No two seats shall be held by one house, nor shall one house hold a seat and the factorage of another, and if it comes to pass that a house holds two, the second is void from the day it was taken and everything done upon it stands and is not undone.

Article the seventh. The wharf's seat is the wharf's and is not a person's, and is exercised by whoever the wharf sends, and if the wharf sends none the seat is not thereby lost.

Endorsed on the back, in the Office's hand, at the granting: the Office has no view on the articles and grants the licence upon them as they stand.

Endorsed again, much later, in the house's own hand: the fifth article was read aloud at the table in the year the eighth chair was seated and the table resolved that a salt factorage at Archon is not a house of this compact. The resolution is in the minute book.

At the foot of the licence, in a third hand, in pencil, and rubbed but readable:

Article five does not say house of this compact. It says one house. And the word house in the first article means a trading house and not a party, because the first article calls the parties parties.

No clerk has looked at article seven in my lifetime. The wharf has sent none since before my father, so the table counts four, and article two says a seat not sending consents to nothing, and it does not say a seat not sending stops being a seat.

The licence is in the press with the founding papers and the press is not locked, and it is not locked because in sixty years the only people who have opened it are clerks looking for the schedule of fees.`,
});

doc({
  id: 'the-coast-survey-line',
  knowledge_key: 'item_coast_survey_line',
  title: 'A survey line, coast measure, on Company paper',
  author: 'A surveyor of the Blackwood Company, and a hand that added to it after',
  kind: 'ledger',
  taxon: 'T4',
  argonian_authored: false,
  unreliability: 'A working survey, correct in its measurements, kept by people it was not written for.',
  text: `Line run from the coast road at the second cairn, inland, bearings and chains, for the Company.

  Station 1. At the cairn. Ground firm.
  Station 2. Fourteen chains. Ground firm. A sapwell, worked, in use.
  Station 3. Twenty-one chains. A sapwell, worked, in use.
  Station 4. Thirty chains. A sapwell, capped.
  Station 5. Thirty-eight chains. A sapwell, worked, in use. Second well eleven paces east of the first, not on the earlier line.
  Station 6. Forty-nine chains. Ground soft. End of run.

Note by the surveyor: the second well at station 5 is not in the hollow's own list and is not capped and is worked. It is the only one on this line that stands off the track, and the ground around it is beaten down in the way ground is beaten down when people come to it.

Second note, on the back, in a rootkeeper's hand and in the deep forms, rendered here into the common script by the same keeper:

The line was left in a boat at the landing and a boy brought it up. The Company doesn't know we have it, and there's nothing in it the Company would mind us having.

What I mind is station 5. The second well at station 5 is ours. It was opened in my mother's time and it is not on the list because the list is what we tell the Speaker and the Speaker tells the gallery, and the fourth hollow has never told the gallery about that well, because it is the one that is still giving.

The Company has it on a survey line with a bearing on it. Anyone with this paper can walk to it in an afternoon.

Third note, below, in the same hand and much later:

Sacks came up the track in the dry season, five of them, and were left at the second well. They are salt. Interior salt comes up in tied sacks because we have no wire. These are wired.

I have not moved them and I have not told the Speaker, and I want it in writing on this paper that I did not move them, because the day a hand puts salt in that well the first question will be who was at it last.`,
});

doc({
  id: 'the-helstrom-kin-list',
  knowledge_key: 'item_helstrom_kin_list',
  title: 'The kin list, three columns, Helstrom gallery',
  author: 'An elder of the gallery, and a second hand nine years later',
  kind: 'ledger',
  taxon: 'T4',
  argonian_authored: true,
  unreliability: 'A list made for one purpose and added to for another. Both purposes are honest and they are not the same purpose.',
  text: `Kin gone to the coast, by hollow, with the year of going and where they were last heard of.

  First column, in the elder's hand: the name.
  Second column, in the elder's hand: the hollow, and the year.
  Third column, in a hand that is not the elder's: a name from the gallery, and beside it a word.

  Uneel-Vaakh. Fourth hollow, ninth year before. Third column: Ee-Vashum, sister.
  Ossei-Tan. Fourth hollow, ninth year. Third column: Ashul-Tei, cousin by the mother.
  Reeja-Sul. Second hollow, eighth year. Third column: a keeper of the second hollow, husband's brother.
  Xeeja-Naan. Fourth hollow, eighth year. Third column: Ee-Vashum, cousin.
  Hulei-Sa. First hollow, seventh year. Third column: nothing.

Forty names in the first column. Thirty-one have something in the third.

At the head of the leaf, in the elder's hand, and this is what the list was for: these are our people on the coast and this is the year they went, and if we are to fetch any of them back we must know who is left here who will be listened to when they are asked to go and fetch. I have made this so that no keeper is sent to argue with a family they have no standing in.

At the foot, in the second hand, and it is not signed:

The third column is mine. I added it in the ninth year when the gallery began asking who had gone and not who could be sent.

There is a difference between the two lists and it is the whole difference. A list of who will be listened to is a list of the people you send to persuade. A list of who is related is a list of the people you can hold answerable for what a man does on the coast.

I wrote the second one on top of the first because the paper was there and the names were already ruled up. I am putting this note at the foot so that the next reader knows the two columns were made in different years for different questions, and that the elder who made the list did not make the column that hurts.

So the list is kept in the gallery and is not sealed. Anyone of any hollow may read it and four people ever have.`,
});

doc({
  id: 'the-court-shortfall-series',
  knowledge_key: 'item_court_shortfall_series',
  title: 'The shortfall series, kept by the ledgerer',
  author: 'Hosk-Vei, ledgerer of the Drowned Court, and four ledgerers before him',
  kind: 'ledger',
  taxon: 'T4',
  argonian_authored: false,
  unreliability: 'A working series pulled out of the Tally by the people who keep the Tally. It is arithmetic and it is not an argument.',
  text: `The series is not part of the Tally. It is what a ledgerer makes when the chapter asks a question, and the chapter has asked this one five times in four hundred years.

The question: how much less does the coast give back than it took, and when did the giving back begin to fall.

The method, written at the head by the first ledgerer to keep the series: take the return column of each volume, take the tenth year of each reign for a level footing, and set them in a row. Do not smooth them. A smoothed row is an opinion.

  Reign the second, tenth year: return at ninety-six parts in the hundred.
  Reign the third, tenth year: ninety-four.
  Reign the fourth, tenth year: ninety-one.
  Reign the fifth, tenth year: eighty-seven.
  Reign the sixth, tenth year: eighty-two.
  Reign the seventh, tenth year: seventy-six.
  Reign the eighth, tenth year: seventy-one.
  Reign the ninth, tenth year: sixty-eight.
  Reign the tenth, tenth year: sixty-four.

Note by the third ledgerer, and it is the note the chapter asks about: the fall is even. It does not step. A thing that begins in a year steps in that year and this does not step anywhere. I have looked for the step for eleven seasons and there is no step in this series and there is no step in the volumes the series is drawn from.

Note by the fourth ledgerer, below: the cutting crews came into the province in the reign the eighth. The series was already falling by twenty-five parts in the hundred before the first crew took the first tree, and it has fallen by seven since. Whatever the crews are doing, they did not start it.

Note by the present ledgerer, in a hand that is still firm: I am asked this by the hollows now and not by the chapter. I give them the row. I do not give them the volumes, because the volumes do not leave this room, and the row without the volumes is a thing a person may say I made up.

I have put the volume and leaf against every figure above so that a reader who is let into the archive can check each one against the book it came out of. Six of the nine are in the fourth volume. The tenth-year figure of the tenth reign is in the leaves that are still loose.`,
});

doc({
  id: 'the-coast-crew-list',
  knowledge_key: 'item_coast_crew_list',
  title: 'A crew list off the coast run, kept in the gallery',
  author: 'A ship’s clerk at Archon, and a keeper who copied it',
  kind: 'ledger',
  taxon: 'T4',
  argonian_authored: false,
  unreliability: 'A copy of a working list. The copyist has said which parts he could not read and has not guessed at them.',
  text: `Crew shipped on the coast run, dry season, by name, place taken on, and rating.

  Shipped at Archon: eleven, all rated hand.
  Shipped at Lilmoth: four, rated hand, one rated pilot.
  Shipped at Stormhold: two.

  Discharged at Archon at the end of the run: nine.
  Discharged at Lilmoth: five.
  Run: two.
  Dead: one, and the entry gives the day and the cause and the cause is the lung.

Against the name Uneel-Vaakh, taken on at Lilmoth in the eighth year and rated hand: discharged at Archon, and beside the discharge, in the ship's clerk's own shorthand, a mark that the copyist has drawn rather than rendered, because he does not know what it means.

Copyist's note, in the gallery's hand: I have drawn the mark as it stands. I asked at the quay what the mark means. One man told me it is the mark for a hand paid off short and by another that it is the mark for a hand the master will not ship again, and by a third that it is nothing and the clerk's pen slipped.

The same mark stands against two other names on this list and against none of the eleven shipped at Archon.

Second note, lower, and this is the keeper's and not the copyist's:

Uneel-Vaakh came back up the track in the wet season and went to the fourth hollow and has been there since. His sister has not spoken to the gallery about it and the gallery has not asked her.

What the list says is that he was on the coast for a season and was discharged and was marked. What the gallery has been saying for two seasons is a great deal more than that, and none of it is on this paper, and I have copied the paper and not the saying.

I am keeping the copy because the ship's book goes back to Archon at the turn and after that there is nothing to check a name against.`,
});

doc({
  id: 'the-gallery-consensus-record',
  knowledge_key: 'item_gallery_consensus_record',
  title: 'The consensus record of the Helstrom gallery',
  author: 'The gallery, in as many hands as it has had keepers',
  kind: 'ledger',
  taxon: 'T4',
  argonian_authored: true,
  unreliability: 'A record of agreements, kept faithfully, in a form that cannot record who was absent.',
  text: `The record holds, for each matter, the season, the matter, the hollows that stood, and whether the standing was whole.

  Season, the matter of the sap-line across the second hollow's ground. Hollows standing: first, second, third, fourth, high. Whole.
  Season, the matter of the coast question. Hollows standing: first, second, third, high. Not whole. The fourth did not stand and the matter was let lie.
  Season, eleven years before, the matter of the line across the fourth hollow's ground. Hollows standing: first, second, third, high. Whole.

That entry is the one a reader stops at, and the form is why. The record has a column for the hollows that stood and no column for the hollows that were asked. Whole means every hollow present stood. It has always meant that. It has never meant every hollow.

In the keeper's hand, against the eleven-year entry, and added at the time and not since:

The fourth hollow was at the wells that season and sent no keeper and was not sent to. The matter was on the ground of the fourth hollow. Two keepers of this gallery stood for the line and the high hollow's speaker stood with them and the standing was whole because there were three in the room and three stood.

I have written was not sent to because I was the one who did not send, and I did not send because the fourth hollow's speaker had said at the last fourth-day that she would refuse anything to do with a line, and I did not want the matter to fall.

I am writing this so that the word whole in that row is not read as it will be read.

Below, much later, in a different hand:

The line was cut. The fourth hollow's ground carries it. Twice since, the gallery has been asked to look at the entry again and twice the answer has been that the record says whole.

The record does say whole. The record cannot say anything else. It has one word for a thing everyone agreed to and for a thing three people agreed to in a room the fourth was not in, and until the record has two words it will go on saying the same thing about both.

The volume is on the gallery shelf, unlocked, and the eleven-year leaf is the one that has been opened enough to be soft at the corner.`,
});

doc({
  id: 'the-chapter-room-recension',
  knowledge_key: 'item_chapter_room_recension',
  title: 'The chapter room’s copy of the Seventh Recension',
  author: 'The Drowned Court, copied at the chapter, hand unknown',
  kind: 'book',
  taxon: 'T4',
  argonian_authored: false,
  unreliability: 'A fair copy of a text the Court reads aloud four times a year. Whether the ninth clause is old or new is not settled by this book and is not settled by any book in this game.',
  text: `The clauses as read at the chapter, this copy being the one kept in the room and not the one kept in the archive.

Clause the first. The Count is taken at the turn of the tide and is entered the same day.

Clause the fourth. What is entered is not amended. Where a figure is found wrong, the wrong figure stands and the right figure is entered beneath it with the day of the finding.

Clause the eighth. The reading of the Count is the chapter's and is not the Steward's, and the chapter reads what is written and does not read what it believes.

Clause the ninth. Where the Count is broken, the chapter shall look for a claimant, and a claimant is one whose reading of the Count is not the chapter's and whose reading holds.

Clause the tenth. The chapter shall keep the Tally in the archive under the stair and the volumes shall not leave the room.

The book is bound in one sitting and is written in one hand throughout, and the ink of the eight clauses either side of the ninth is the same brown that all this house's ink goes in forty years.

The ninth clause is in a black that has not browned.

Note at the back, in the copyist's hand, and it is the only note in the volume:

I have set out the clauses as I had them. The ninth I had from the archive copy on a separate leaf, loose, in the archive's own hand, and I have entered it in its place because that is where the leaf was folded in.

I asked the ledgerer whether the loose leaf is old. He said the leaf is not old and the clause may be, and that the archive has re-copied loose leaves before when the fold wears through, and that when it does the new leaf is new ink and the clause is whatever age it was.

I asked him whether the archive keeps the leaves it replaces. He said it does not. Then how would a reader tell a re-copied clause from a new one?

I am putting this at the back rather than the front because a note at the front is an argument and a note at the back is a note. The reader who wants the argument will find the two answers in the same place I did.`,
});

// -------------------------------------------------------------------------------- the placement
//
// A document lives in the room where the person who owns it stands. Those posts are
// `npc.post.at_building`. Three exceptions are declared below with the reason.
const PLACEMENT = {
  // Dyer Sallis, posted at archon-vat-house. The hall's reply is in the hall.
  'archon-vat-house': ['the-guild-denial'],
  // Undertaker Vaskh (soulrest-court-steps) holds the stub book he was shown; Hosk-Vei the
  // ledgerer (soulrest-court-steps) keeps the shortfall series; Undersexton Rell's chapter room
  // is the same building and holds the chapter's Recension.
  'soulrest-court-steps': ['the-blackrose-lease-stub-book', 'the-court-shortfall-series', 'the-chapter-room-recension'],
  // Prefect Hallow, posted at blackrose-prison. The register and the four damp returns.
  'blackrose-prison': ['the-lease-register-third-hand', 'the-damp-four'],
  // Harbourmistress Tesh, posted at lilmoth-customs. The drawer is hers and so is the note.
  'lilmoth-customs': ['the-drawer-charters', 'the-corvo-note', 'the-soulrest-licence'],
  // Factor Belliene, Sedd Ravano and Factor Ruvela Sath are all posted at gideon-grange, which
  // is the Ledger's counting floor.
  'gideon-grange': ['the-unsealed-chits', 'the-eighth-chair-returns', 'the-wharf-float-book', 'the-letter-held-to-the-lamp', 'the-berth-roll'],
  // Assizer Corvo, posted at gideon-court.
  'gideon-court': ['the-blackrose-lease-roll', 'the-legates-seal-register', 'the-declaration-drafts'],
  // Scribe Hulen, posted at stormhold-archive.
  'stormhold-archive': ['the-stormhold-transfer-file'],
  // Notary Sedda Vell, posted at blackrose-warders-hall.
  'blackrose-warders-hall': ['the-prefect-commission'],
  // Prefect Galvus Arn, posted at stormhold-praetorium.
  'stormhold-praetorium': ['the-fourth-writ'],
  // Harbourmaster Cuiro-Vaneth, posted at archon-guild-office. The minute book is the harbour
  // office's and the daughter's letter was filed with it, which is what the docket says.
  'archon-guild-office': ['the-harbour-minute-book', 'the-soulrest-daughter-letter'],
  // EXCEPTION 1. Speaker Teel-Ashaan has no `post` in game/data/npcs/** at all, so the giver rule
  // cannot place Q-XULA-02's survey line. It goes to the gallery, where the argument it belongs
  // to happens — the same judgement round 1 recorded for `the-sap-and-the-knife`.
  // EXCEPTION 2. Q-XULA-12's giver is `helstrom-gallery-keepers`, posted here, and the consensus
  // record is the gallery's own book, so that one is a lookup and not a judgement.
  'helstrom-undertemple': ['the-coast-survey-line', 'the-helstrom-kin-list', 'the-gallery-consensus-record'],
  // Ee-Vashum, posted at helstrom-apothecary.
  'helstrom-apothecary': ['the-coast-crew-list'],
};

// -------------------------------------------------------------------------------------- emit
const TITLES = new Map(BOOKS.map((b) => [b.id, b.title]));
const words = (t) => (t.match(/[A-Za-zÀ-ɏ'’-]+/g) || []).length;

const out = {
  schema: 'elder-souls/books@1',
  group: 'the-papers-in-evidence',
  owner: 'W1-READABLES-r2',
  note: 'The twenty-six documents the `ledger` and `letter` channels named and that nothing in game/data/books/** answered to. Written by tools/readables/mk-papers.mjs; placed by the same file.',
  books: BOOKS,
};
fs.writeFileSync(OUT, JSON.stringify(out, null, 1) + '\n');

let placed = 0;
for (const [room, ids] of Object.entries(PLACEMENT)) {
  const p = path.join(IDIR, `${room}.json`);
  const rec = JSON.parse(fs.readFileSync(p, 'utf8'));
  const list = Array.isArray(rec.readable) ? rec.readable : (rec.readable ? [rec.readable] : []);
  for (const id of ids) {
    if (list.some((r) => r.book === id)) continue;
    list.push({ id, title: TITLES.get(id), book: id });
    placed++;
  }
  rec.readable = list;
  fs.writeFileSync(p, JSON.stringify(rec, null, 1) + '\n');
}

const total = BOOKS.reduce((n, b) => n + words(b.text), 0);
console.log(`mk-papers: ${BOOKS.length} documents, ${total} words -> ${OUT}`);
console.log(`mk-papers: ${placed} placement(s) added across ${Object.keys(PLACEMENT).length} rooms`);
for (const b of BOOKS) console.log(`  ${String(words(b.text)).padStart(4)} w  ${b.knowledge_key.padEnd(32)} ${b.id}`);
