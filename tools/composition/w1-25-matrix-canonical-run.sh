#!/usr/bin/env bash
# The W1-25 canonical-path re-measurement, as one RunPod worker command.
#
# WHY A POD AND NOT THIS BOX. matrix-probe needs a browser window; tools/contention.mjs reported
# 5 browser instances and load 5.34 per core against a 4.0 ceiling all session, which is the exact
# reason the 2026-08-08 canonical artifact records `ran:false` in the first place. The Pod is used
# here as an UNCONTENDED box, not for its GPU — every probe calls setRenderRate(0) and reads state,
# never pixels. Running the tool's own contention gate on an idle machine is what lets the
# canonical number be produced through the gate honestly rather than with --force.
#
# THREE ARMS, ONE PROVISIONING (RULES #4, #6).
#   1. --self-test          15 probes x 3 fake worlds, no browser.
#   2. the canonical run    default --out, i.e. reports/composition/w1/matrix.json.
#   3. two null controls    the identical live sweep with the source-state fork removed. Both must
#                           report 0 demonstrated cells; a cell demonstrated with no fork is a
#                           difference the instrument manufactured, and it would void the same cell
#                           in arm 2. `on` and `off` are the two PLAUSIBLE wrong answers (source
#                           state always set / never set), not the trivial empty world.
#
# Nothing here uses `set -e`: a non-zero exit is a RESULT for this tool (2 = wave floor missed),
# and aborting on it would throw away the arms that had not run yet.
A=$RUNPOD_ARTIFACT_DIR
node tools/contention.mjs > "$A/contention.txt" 2>&1
echo "contention exit $?" >> "$A/exits.txt"

node tools/composition/matrix-probe.mjs --self-test > "$A/self-test.log" 2>&1
echo "self-test exit $?" >> "$A/exits.txt"

node tools/composition/matrix-probe.mjs > "$A/canonical.log" 2>&1
echo "canonical exit $?" >> "$A/exits.txt"
cp reports/composition/w1/matrix.json "$A/canonical-matrix.json" || echo "canonical artifact MISSING" >> "$A/exits.txt"

node tools/composition/matrix-probe.mjs --null-control on \
  --out reports/composition/w1-25-matrix-canonical/null-control-on.json > "$A/null-on.log" 2>&1
echo "null-on exit $?" >> "$A/exits.txt"
cp reports/composition/w1-25-matrix-canonical/null-control-on.json "$A/" || echo "null-on artifact MISSING" >> "$A/exits.txt"

node tools/composition/matrix-probe.mjs --null-control off \
  --out reports/composition/w1-25-matrix-canonical/null-control-off.json > "$A/null-off.log" 2>&1
echo "null-off exit $?" >> "$A/exits.txt"
cp reports/composition/w1-25-matrix-canonical/null-control-off.json "$A/" || echo "null-off artifact MISSING" >> "$A/exits.txt"

cat "$A/exits.txt"
ls -la "$A"
