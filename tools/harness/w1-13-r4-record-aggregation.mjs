// Wait for the W1-13 round-4 jrn06 aggregation to finish, then record what its method-8 row
// actually says into `orchestration/status/W1-13-r4.json`.
//
// `RULES.md` 1 and 2: the container has killed agents mid-run three times in one day, and a
// 30-minute journey run finishing after its agent is gone is a measurement nobody ever reads.
// This writes the row's own numbers into the status file the moment they exist, so a successor
// or a critic inherits the answer rather than the question.
//
// It asserts nothing and grades nothing. It copies six booleans and the three arms' headline
// numbers out of the journey and into the status file, and says plainly if the row is absent.

import fs from 'node:fs';

const JOURNEY = process.argv[2] || 'reports/journeys/w1-13-r4-jrn06/journey.json';
const STATUS = 'orchestration/status/W1-13-r4.json';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const deadline = Date.now() + 45 * 60 * 1000;

while (!fs.existsSync(JOURNEY)) {
  if (Date.now() > deadline) {
    console.log('timed out waiting for', JOURNEY);
    process.exit(2);
  }
  await sleep(15000);
}

const j = JSON.parse(fs.readFileSync(JOURNEY, 'utf8'));
const row = (j.checks || {})['m_prg04_m8_clock_consequence'];
const st = JSON.parse(fs.readFileSync(STATUS, 'utf8'));

const arm = (x) => (!x ? null : {
  hour_before: x.before.hour, hour_after: x.after.hour, days_moved: x.days_moved,
  hours_moved: x.hours_moved, rest_clocks: x.rest_clocks,
  shops_total: x.shops_total, shops_closed_n: x.shops_closed_n, shops_opened_n: x.shops_opened_n,
  npcs_moved_n: x.npcs_moved_n,
  souls_before: x.before.souls_for_one_ordinary_kill,
  souls_after: x.after.souls_for_one_ordinary_kill,
  souls_ratio: x.souls_ratio,
});

st.aggregation = {
  run: JOURNEY,
  run_id: j.run_id || null,
  git: j.git || null,
  instruments: Object.keys(j.checks || {}).length,
  failed: j.failed || [],
  page_errors: (j.page_errors || []).length,
  m_prg04_m8_clock_consequence: row ? {
    pass: row.pass,
    clauses: {
      c1_clock_reads_23_00: row.c1_clock_reads_23_00,
      c2_night_roster_active: row.c2_night_roster_active,
      c3_merchants_closed: row.c3_merchants_closed,
      c4_timed_quest_consumed_6h: row.c4_timed_quest_consumed_6h,
      c5_four_rests_advance_24h: row.c5_four_rests_advance_24h,
      c6_same_shop_state_after_the_round_trip: row.c6_same_shop_state_after_the_round_trip,
      c7_souls_rate_1_35x_after_the_rest: row.c7_souls_rate_1_35x_after_the_rest,
    },
    rested: arm(row.rested),
    no_rest_control: arm(row.no_rest_control),
    four_rests: arm(row.four_rests),
  } : 'ROW ABSENT from the aggregation',
  m_d14: j.checks && j.checks.m_d14_stain_visibility ? {
    pass: j.checks.m_d14_stain_visibility.pass,
    daylight: j.checks.m_d14_stain_visibility.daylight_12m_visible,
    dark: j.checks.m_d14_stain_visibility.dark_6m_visible,
    min_margin_px_daylight: j.checks.m_d14_stain_visibility.min_margin_px_daylight,
    min_margin_px_dark: j.checks.m_d14_stain_visibility.min_margin_px_dark,
    margin_floors_met: j.checks.m_d14_stain_visibility.margin_floors_met,
  } : null,
  note: 'Recorded by tools/harness/w1-13-r4-record-aggregation.mjs so the numbers survive the run. '
    + 'The standalone probe (reports/runs/W1-13-R4/clock-consequences.json) passes all six '
    + 'measurable clauses at commit 0f6ff17; if the aggregation row disagrees, THE DISAGREEMENT IS '
    + 'THE FINDING and belongs in the verdict, not smoothed over.',
};
st.next_step = 'critic — read status.aggregation for the journey row beside the standalone probe';
fs.writeFileSync(STATUS, JSON.stringify(st, null, 2));
console.log('recorded. m8 pass =', row ? row.pass : 'ROW ABSENT');
if (row) {
  console.log('c1', row.c1_clock_reads_23_00, 'c2', row.c2_night_roster_active,
    'c3', row.c3_merchants_closed, 'c5', row.c5_four_rests_advance_24h,
    'c6', row.c6_same_shop_state_after_the_round_trip, 'c7', row.c7_souls_rate_1_35x_after_the_rest);
  for (const [n, a] of [['rested', row.rested], ['control', row.no_rest_control], ['four', row.four_rests]]) {
    const x = arm(a);
    if (x) console.log(n, JSON.stringify(x));
  }
}
