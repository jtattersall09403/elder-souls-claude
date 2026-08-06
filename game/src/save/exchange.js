// Export / import — RI-JRN05 §A, MANDATORY, and §E CR11/CR12.
//
// A download cannot be a save system (it needs a gesture per write, it lands where the game
// cannot read it, and there is no enumeration). But it is the only store the browser cannot
// evict, and the only way a save moves between devices or survives an eviction. So it is
// required, and it is the recovery path M14 checks.
//
// The `.eldersouls` container is deliberately boring and self-describing:
//
//   line 1  {"magic":"ELDERSOULS","container":1,"schema_version":N,"digest":"<sha256 of line 2>"}
//   line 2  <canonical JSON of the save blob>
//
// Two lines, no compression in wave 1 (the budget is ≤ 1.5 MB gzipped for export; the
// server serves it gzipped and the size check reports both figures honestly rather than
// hiding an uncompressed payload behind a compressed number).
'use strict';

import { canonicalise } from '../core/canonical.js';
import { sha256 } from '../core/sha256.js';

export const MAGIC = 'ELDERSOULS';
const ENC = new TextEncoder();
const DEC = new TextDecoder();

/** @returns {Uint8Array} */
export function exportSave(blob) {
  const body = canonicalise(blob);
  const head = JSON.stringify({
    magic: MAGIC, container: 1,
    schema_version: blob.meta.schema_version,
    digest: sha256(body),
    bytes: ENC.encode(body).length,
  });
  return ENC.encode(head + '\n' + body + '\n');
}

/**
 * @param {Uint8Array|ArrayBuffer|string} bytes
 * @returns {object} the save blob
 * @throws with a legible reason. No partial application, ever (CR12).
 */
export function importSave(bytes) {
  let text;
  if (typeof bytes === 'string') text = bytes;
  else if (bytes instanceof ArrayBuffer) text = DEC.decode(new Uint8Array(bytes));
  else if (bytes && bytes.buffer) text = DEC.decode(bytes);
  else throw new Error('importSave: expected bytes or a string');

  const nl = text.indexOf('\n');
  if (nl < 0) throw new Error('This is not a ledger of ours: it has no first line.');
  let head;
  try { head = JSON.parse(text.slice(0, nl)); }
  catch { throw new Error('This is not a ledger of ours: the first line is not a record.'); }
  if (!head || head.magic !== MAGIC) throw new Error('This is not a ledger of ours: the mark on the first page is wrong.');
  if (head.container !== 1) throw new Error(`This ledger is bound in a way we cannot open (container ${head.container}).`);

  const body = text.slice(nl + 1).replace(/\n+$/, '');
  const digest = sha256(body);
  if (digest !== head.digest) throw new Error('This ledger has been altered since it was written; the seal does not match. Nothing has been loaded.');

  let blob;
  try { blob = JSON.parse(body); }
  catch { throw new Error('This ledger is unreadable past the first page. Nothing has been loaded.'); }
  if (!blob || !blob.meta || blob.meta.schema !== 'elder-souls/save@1') {
    throw new Error('This ledger is not a record of a life in this world. Nothing has been loaded.');
  }
  return blob;
}
