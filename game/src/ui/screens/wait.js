// The player-facing world-clock advance. Waiting is not resting: it moves the calendar and the
// people and doors that read it, but restores no pools, respawns nothing and discovers no hearth.
'use strict';

import { C, Ca, bonePip, boneRule } from '../theme.js';
import { screen, hint, ink, inkDim, CALM_ALPHA } from '../chrome.js';
import { drawText, faceOf, measure } from '../type.js';

/** A worked-bone hour dial: physical marks, not a modern slider or a destination list. */
export function drawWait(S, m) {
  const s = S.s;
  const sc = screen(S, 'wait', 'Wait', m.dateNow, 'reed', CALM_ALPHA);
  const [ix, iy, iw, ih] = sc.inner;

  const statement = `Let ${m.hours} ${m.hours === 1 ? 'hour' : 'hours'} pass`;
  S.el({
    id: 'wait.hours', kind: 'wait_duration', rect: [ix, iy + 18 * s, iw, 72 * s],
    text: statement, focused: true, opacity: CALM_ALPHA,
    meta: { hours: m.hours, minimum: 1, maximum: 24 },
  }, (c, r) => {
    const f = faceOf('bone'), size = 28 * s;
    drawText(c, statement, r[0] + r[2] / 2 - measure(statement, f, size) / 2,
      r[1] + 44 * s, f, size, ink());
    boneRule(c, r[0] + 80 * s, r[1] + 62 * s, r[2] - 160 * s, s, 1901);
  });

  const cols = 12;
  const gapX = iw / cols;
  const dialY = iy + 155 * s;
  for (let i = 1; i <= 24; i++) {
    const row = i > cols ? 1 : 0;
    const col = (i - 1) % cols;
    const cx = ix + gapX * (col + 0.5);
    const cy = dialY + row * 72 * s;
    S.el({
      id: `wait.pip.${i}`, kind: 'hour_pip', rect: [cx - 20 * s, cy - 20 * s, 40 * s, 40 * s],
      text: String(i), focused: i === m.hours, opacity: CALM_ALPHA,
      meta: { hour: i, selected: i === m.hours },
    }, (c, r) => {
      bonePip(c, r[0] + r[2] / 2, r[1] + r[3] / 2, 10 * s, s, i <= m.hours, 2000 + i);
      const f = faceOf('ink'), size = 12 * s;
      const t = String(i);
      drawText(c, t, r[0] + r[2] / 2 - measure(t, f, size) / 2, r[1] + r[3] + 10 * s,
        f, size, i === m.hours ? C('resin_pale') : Ca('bone_dim', 0.9));
    });
  }

  const summaryY = iy + 350 * s;
  S.el({
    id: 'wait.clock', kind: 'clock_change', rect: [ix + 170 * s, summaryY, iw - 340 * s, 116 * s],
    text: `${m.clockNow} to ${m.clockAfter}`, opacity: CALM_ALPHA,
    meta: { before: m.clockNow, after: m.clockAfter, date_before: m.dateNow, date_after: m.dateAfter },
  }, (c, r) => {
    const labelFace = faceOf('ink'), valueFace = faceOf('bone');
    drawText(c, 'now', r[0], r[1] + 28 * s, labelFace, 14 * s, inkDim());
    drawText(c, m.clockNow, r[0] + 90 * s, r[1] + 31 * s, valueFace, 20 * s, ink());
    drawText(c, m.dateNow, r[0] + 260 * s, r[1] + 28 * s, labelFace, 14 * s, inkDim());
    boneRule(c, r[0], r[1] + 48 * s, r[2], s, 2117);
    drawText(c, 'after', r[0], r[1] + 86 * s, labelFace, 14 * s, inkDim());
    drawText(c, m.clockAfter, r[0] + 90 * s, r[1] + 89 * s, valueFace, 20 * s, ink());
    drawText(c, m.dateAfter, r[0] + 260 * s, r[1] + 86 * s, labelFace, 14 * s, inkDim());
  });

  hint(S, 'wait.hint', ix, iy + ih + 4 * s, iw,
    'Up or down chooses the hours. Confirm waits. Back leaves the clock alone.', CALM_ALPHA);
}
