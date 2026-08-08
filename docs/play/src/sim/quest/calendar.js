// The in-world calendar. RI-DLG05 §A rule 5: "A dated stamp is mandatory. In-game date at
// write time, in the world's calendar, rendered in prose, not ISO."
//
// Two things this file exists to prevent:
//
//  1. `new Date()` anywhere near a journal write. The date is a pure function of
//     `sim.env.dayCount`, which is a simulated integer. The determinism guard in
//     core/guards.js throws on a wall clock inside a fixed step; this module means nobody
//     ever has a reason to reach for one.
//  2. `2024-03-11` in a journal entry, which RI-DLG05 "How we lose" calls an immersion break
//     AND a schema violation.
//
// Era anchor: RI-LOR02 §1 — "Play opens **Second Seed, 3E 427**." Day 0 of the simulation is
// therefore 1 Second Seed, 3E 427. The month lengths are the Tamrielic calendar
// (`canonical-recall`, high confidence — they are printed in every Elder Scrolls almanac and
// total 365).
'use strict';

/** [name, days]. Sums to 365. */
export const MONTHS = [
  ['Morning Star', 31],
  ["Sun's Dawn", 28],
  ['First Seed', 31],
  ["Rain's Hand", 30],
  ['Second Seed', 31],
  ['Mid Year', 30],
  ["Sun's Height", 31],
  ['Last Seed', 31],
  ['Hearthfire', 30],
  ['Frostfall', 31],
  ["Sun's Dusk", 30],
  ['Evening Star', 31],
];

export const YEAR_DAYS = MONTHS.reduce((a, m) => a + m[1], 0); // 365

/** Day 0 = 1 Second Seed, 3E 427. */
export const EPOCH = { monthIndex: 4, day: 1, era: 3, year: 427 };

const EPOCH_DAY_OF_YEAR = (() => {
  let d = 0;
  for (let i = 0; i < EPOCH.monthIndex; i++) d += MONTHS[i][1];
  return d + (EPOCH.day - 1);
})();

/**
 * dayCount (integer, >= 0) -> { day, month, monthIndex, year, era, text }.
 * `text` is the prose stamp a journal entry carries: "16 Last Seed, 3E 427".
 */
export function dateOf(dayCount) {
  const n = Math.floor(Number(dayCount) || 0);
  if (!Number.isFinite(n) || n < 0) throw new Error(`dateOf(${dayCount}): dayCount must be a non-negative integer`);
  const abs = EPOCH_DAY_OF_YEAR + n;
  const year = EPOCH.year + Math.floor(abs / YEAR_DAYS);
  let doy = abs % YEAR_DAYS;
  let mi = 0;
  while (doy >= MONTHS[mi][1]) { doy -= MONTHS[mi][1]; mi++; }
  return {
    day: doy + 1,
    month: MONTHS[mi][0],
    monthIndex: mi,
    year,
    era: EPOCH.era,
    text: `${doy + 1} ${MONTHS[mi][0]}, ${EPOCH.era}E ${year}`,
  };
}

/** The sortable key the journal screen orders by. Strings sort wrong; this does not. */
export function dayIndexOf(dayCount) { return Math.floor(Number(dayCount) || 0); }

/**
 * Parse a stamp back to a dayCount. Only used by the offline tools (dump-journal.mjs,
 * journal-ui.mjs) so they can sort a TSV without re-running the game.
 */
export function parseDate(text) {
  const m = /^(\d{1,2}) (.+), (\d)E (\d+)$/.exec(String(text).trim());
  if (!m) throw new Error(`parseDate(${JSON.stringify(text)}): not a calendar stamp`);
  const mi = MONTHS.findIndex((x) => x[0] === m[2]);
  if (mi < 0) throw new Error(`parseDate: unknown month ${JSON.stringify(m[2])}`);
  let doy = 0;
  for (let i = 0; i < mi; i++) doy += MONTHS[i][1];
  doy += Number(m[1]) - 1;
  const year = Number(m[4]);
  return (year - EPOCH.year) * YEAR_DAYS + doy - EPOCH_DAY_OF_YEAR;
}
