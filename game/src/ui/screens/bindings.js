'use strict';

import { screen, ink, inkDim } from '../chrome.js';
import { drawText, faceOf } from '../type.js';

/** Draw the live RebindModel. The labels here are the model's localised labels, not a copy. */
export function drawBindings(S, m) {
  if (!m || !Array.isArray(m.rows)) return 0;
  const s = S.s;
  const sc = screen(S, 'bindings', 'The hand remembers', m.device, 'bone', 0.94);
  const [x, y, w, h] = sc.inner;
  const rowH = Math.max(25 * s, Math.min(38 * s, h / Math.max(1, m.rows.length)));
  let drawn = 0;
  for (let i = 0; i < m.rows.length; i++) {
    const row = m.rows[i];
    const yy = y + i * rowH;
    const text = `${row.label}   ${row.controls[0] || '—'}   ${row.controls[1] || '—'}`;
    S.el({
      id: `bindings.${row.action}`, kind: 'list_row', rect: [x, yy, w, rowH - 2 * s],
      text, focused: !!row.selected, material: 'parchment',
      meta: { action: row.action, controls: row.controls.slice(), selected_slot: row.selected ? m.slot : null },
    }, (c, r) => {
      if (row.selected) { c.fillStyle = 'rgba(180,150,100,.18)'; c.fillRect(r[0], r[1], r[2], r[3]); }
      drawText(c, row.label, r[0] + 8 * s, r[1] + 20 * s, faceOf('bone'), 15 * s, row.selected ? ink() : inkDim());
      drawText(c, row.controls[0] || '—', r[0] + w * 0.58, r[1] + 20 * s, faceOf('ink'), 14 * s, m.slot === 0 && row.selected ? ink() : inkDim());
      drawText(c, row.controls[1] || '—', r[0] + w * 0.78, r[1] + 20 * s, faceOf('ink'), 14 * s, m.slot === 1 && row.selected ? ink() : inkDim());
    });
    drawn++;
  }
  const line = m.message || (m.capturing ? 'The next mark will answer for this deed.' : m.pending ? 'Accept the exchange, or leave it as it was.' : 'Choose a deed, then make the mark you want remembered.');
  S.el({ id: 'bindings.message', kind: 'hint', rect: [x, y + h - 28 * s, w, 28 * s], text: line, material: 'parchment' },
    (c, r) => drawText(c, line, r[0], r[1] + 19 * s, faceOf('ink'), 14 * s, m.message ? ink() : inkDim()));
  return drawn;
}
