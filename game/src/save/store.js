// The save store — RI-JRN05 §A, binding.
//
// IndexedDB is the sole authoritative store. `localStorage` holds one ≤ 1 KB pointer record
// and nothing else — any save payload there is HF4. File export/import is a mandatory second
// path and lives in save/exchange.js.
//
// The write protocol is transcribed from §A and is what makes the tab-close test passable:
//
//   SAVE(slot, state):
//     gen     := meta.generation + 1                    monotonic, never reused
//     payload := canonicalise(state)
//     digest  := sha256(payload)
//     ONE readwrite transaction over ['blobs','saves','meta']:
//        put blobs[slot:gen:i]  chunked at 1 MB
//        put saves[slot]        {gen, digest, bytes, chunks, header, writtenAt}
//        put meta               {generation, committed:{slot,gen}}
//     — commit or abort. There is no third outcome.
//     AFTER commit: delete blobs of generation < gen-1 for this slot (A/B double buffer).
//
//   LOAD(slot):
//     read saves[slot] -> gen, digest; read + rejoin chunks; recompute sha256;
//     on mismatch fall back to gen-1; if that also fails the slot is CORRUPT and is
//     reported as corrupt. It is NEVER silently replaced by a new game.
//
// Every write is asynchronous and off the simulation thread's critical path: the sim never
// awaits a save (RI-JRN05 M15 / HF8).
'use strict';

import { canonicalise } from '../core/canonical.js';
import { sha256 } from '../core/sha256.js';

const DB_NAME = 'elder-souls';
const DB_VERSION = 1;
const CHUNK_BYTES = 1024 * 1024;
const POINTER_KEY = 'elder-souls.pointer';
const POINTER_MAX_BYTES = 1024;

export class SaveStore {
  constructor() {
    this.db = null;
    this.backend = 'unopened';
    this.failure = null;          // simulateStorageFailure(kind)
    this.memory = { blobs: new Map(), saves: new Map(), meta: { generation: 0, committed: null } };
    this.persisted = false;
    this.writes = 0;
    this.lastWriteMs = 0;
    this.lastError = null;
    this.notices = [];            // surfaced diegetically by the save surface, never as a modal
  }

  // ---- lifecycle ---------------------------------------------------------------------

  async open() {
    if (this.failure === 'no-idb' || typeof indexedDB === 'undefined') {
      this.backend = 'memory';
      this.notices.push('no-idb');
      return this.backend;
    }
    try {
      this.db = await new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains('blobs')) db.createObjectStore('blobs');
          if (!db.objectStoreNames.contains('saves')) db.createObjectStore('saves');
          if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta');
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error || new Error('indexedDB.open failed'));
        req.onblocked = () => reject(new Error('indexedDB.open blocked by another tab'));
      });
      this.backend = this.failure === 'ephemeral' ? 'indexeddb-ephemeral' : 'indexeddb';
      if (this.failure === 'ephemeral') this.notices.push('ephemeral');
    } catch (e) {
      this.lastError = String(e && e.message || e);
      this.backend = 'memory';
      this.notices.push('no-idb');
    }
    return this.backend;
  }

  async requestPersistence() {
    if (this.failure === 'ephemeral') { this.persisted = false; return false; }
    try {
      if (navigator.storage && navigator.storage.persist) this.persisted = await navigator.storage.persist();
    } catch { this.persisted = false; }
    return this.persisted;
  }

  async estimate() {
    try {
      if (navigator.storage && navigator.storage.estimate) {
        const e = await navigator.storage.estimate();
        return { usage: e.usage || 0, quota: e.quota || 0 };
      }
    } catch { /* fall through */ }
    return { usage: 0, quota: 0 };
  }

  // ---- the write protocol -------------------------------------------------------------

  /**
   * @param {string} slot
   * @param {object} state the save blob
   * @param {object} header a small summary shown on the load surface
   */
  async save(slot, state, header) {
    const payload = canonicalise(state);
    const digest = sha256(payload);
    const bytes = new TextEncoder().encode(payload).length;

    if (this.failure === 'quota') {
      // CR6: evict the oldest autosave and retry ONCE, then surface the failure.
      const evicted = await this._evictOldestAutosave();
      if (!evicted) {
        this.notices.push('quota');
        const e = new Error('The ledger is full. An older page must be torn out before another can be written.');
        e.code = 'QUOTA_EXCEEDED';
        throw e;
      }
      this.failure = null;
    }

    const chunks = [];
    for (let i = 0; i < payload.length; i += CHUNK_BYTES) chunks.push(payload.slice(i, i + CHUNK_BYTES));
    if (chunks.length === 0) chunks.push('');

    const doWrite = async () => {
      const meta = await this._readMeta();
      const gen = meta.generation + 1;
      const record = {
        gen, digest, bytes, chunks: chunks.length,
        header: header || {}, writtenAt: new Date().toISOString(),
      };
      await this._transact(['blobs', 'saves', 'meta'], 'readwrite', (tx) => {
        const blobs = tx.objectStore('blobs');
        for (let i = 0; i < chunks.length; i++) blobs.put(chunks[i], `${slot}:${gen}:${i}`);
        tx.objectStore('saves').put(record, slot);
        tx.objectStore('meta').put({ generation: gen, committed: { slot, gen } }, 'meta');
      });
      // Only AFTER the commit: retire generation gen-2. gen-1 is retained (A/B).
      await this._deleteGenerations(slot, gen - 2);
      this.writes++;
      this._writePointer(slot, state.meta.schema_version);
      return record;
    };

    // CR9: two tabs. A lock serialises the read-modify-write of `meta.generation`, so the
    // loser of the race writes gen+1 rather than clobbering gen.
    let record;
    if (typeof navigator !== 'undefined' && navigator.locks && navigator.locks.request) {
      record = await navigator.locks.request('elder-souls-save', doWrite);
    } else {
      record = await doWrite();
    }
    return record;
  }

  /** @returns {{ok:true, state:object, gen:number, degraded:boolean} | {ok:false, reason:string}} */
  async load(slot) {
    const record = await this._get('saves', slot);
    if (!record) return { ok: false, reason: 'EMPTY_SLOT' };

    for (const gen of [record.gen, record.gen - 1]) {
      if (gen < 1) break;
      const text = await this._readChunks(slot, gen, gen === record.gen ? record.chunks : null);
      if (text === null) continue;
      const digest = sha256(text);
      const expected = gen === record.gen ? record.digest : (record.prevDigest || null);
      if (expected && digest !== expected) {
        this.notices.push(gen === record.gen ? 'digest-mismatch' : 'digest-mismatch-prev');
        continue;
      }
      let state;
      try { state = JSON.parse(text); } catch { this.notices.push('unparseable'); continue; }
      // A previous-generation load is a degradation and is reported, never silent.
      return { ok: true, state, gen, degraded: gen !== record.gen };
    }
    return { ok: false, reason: 'CORRUPT' };
  }

  async listSlots() {
    // M17: the list shows exactly the slots that can actually be loaded.
    const keys = await this._keys('saves');
    const out = [];
    for (const k of keys) {
      const rec = await this._get('saves', k);
      if (!rec) continue;
      const text = await this._readChunks(k, rec.gen, rec.chunks);
      const loadable = text !== null && sha256(text) === rec.digest;
      if (loadable) out.push({ slot: k, gen: rec.gen, bytes: rec.bytes, header: rec.header, writtenAt: rec.writtenAt });
    }
    return out.sort((a, b) => (a.slot < b.slot ? -1 : 1));
  }

  async deleteSlot(slot) {
    const rec = await this._get('saves', slot);
    await this._transact(['blobs', 'saves'], 'readwrite', (tx) => {
      if (rec) for (let g = 1; g <= rec.gen; g++) for (let i = 0; i < (rec.chunks || 1); i++) tx.objectStore('blobs').delete(`${slot}:${g}:${i}`);
      tx.objectStore('saves').delete(slot);
    });
    return true;
  }

  // ---- hostility simulation (A-JRN3) ---------------------------------------------------

  /** kind ∈ quota | ephemeral | no-idb | truncate | flip-byte | future-schema | none */
  async simulateStorageFailure(kind, slot = 'auto') {
    const legal = ['quota', 'ephemeral', 'no-idb', 'truncate', 'flip-byte', 'future-schema', 'none'];
    if (!legal.includes(kind)) throw new Error(`simulateStorageFailure: unknown kind '${kind}'. Legal: ${legal.join(', ')}`);
    if (kind === 'none') { this.failure = null; return 'none'; }
    if (kind === 'truncate' || kind === 'flip-byte' || kind === 'future-schema') {
      const rec = await this._get('saves', slot);
      if (!rec) throw new Error(`simulateStorageFailure('${kind}'): slot '${slot}' has nothing written to corrupt`);
      const text = await this._readChunks(slot, rec.gen, rec.chunks);
      if (text === null) throw new Error(`simulateStorageFailure('${kind}'): slot '${slot}' blob is missing`);
      let mutated;
      if (kind === 'truncate') mutated = text.slice(0, Math.floor(text.length * 0.6));
      else if (kind === 'flip-byte') {
        const i = Math.floor(text.length / 2);
        mutated = text.slice(0, i) + (text[i] === 'a' ? 'b' : 'a') + text.slice(i + 1);
      } else {
        const o = JSON.parse(text);
        o.meta.schema_version = o.meta.schema_version + 1;
        mutated = canonicalise(o);
      }
      const chunks = [];
      for (let i = 0; i < mutated.length; i += CHUNK_BYTES) chunks.push(mutated.slice(i, i + CHUNK_BYTES));
      if (!chunks.length) chunks.push('');
      await this._transact(['blobs', 'saves'], 'readwrite', (tx) => {
        const b = tx.objectStore('blobs');
        for (let i = 0; i < Math.max(chunks.length, rec.chunks); i++) {
          if (i < chunks.length) b.put(chunks[i], `${slot}:${rec.gen}:${i}`);
          else b.delete(`${slot}:${rec.gen}:${i}`);
        }
        // The record still claims the ORIGINAL digest — which is the point: the digest is
        // what detects the damage. For 'future-schema' the digest is updated so the blob is
        // intact and only the version is wrong.
        if (kind === 'future-schema') tx.objectStore('saves').put({ ...rec, digest: sha256(mutated), chunks: chunks.length }, slot);
        else tx.objectStore('saves').put({ ...rec, chunks: chunks.length }, slot);
      });
      return kind;
    }
    this.failure = kind;
    if (kind === 'no-idb') { this.db = null; this.backend = 'memory'; this.notices.push('no-idb'); }
    if (kind === 'ephemeral') { this.backend = 'indexeddb-ephemeral'; this.persisted = false; this.notices.push('ephemeral'); }
    return kind;
  }

  // ---- the ≤ 1 KB localStorage pointer -------------------------------------------------

  _writePointer(slot, schemaVersion) {
    try {
      const rec = JSON.stringify({ lastSlot: slot, schemaVersion, backend: this.backend });
      if (rec.length > POINTER_MAX_BYTES) throw new Error('pointer record exceeds 1 KB');
      localStorage.setItem(POINTER_KEY, rec);
    } catch { /* private mode: the pointer is an optimisation, never a source of truth */ }
  }

  readPointer() {
    try {
      const raw = localStorage.getItem(POINTER_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  }

  /** M10's own instrument: every localStorage key and its byte count, for the audit. */
  localStorageAudit() {
    const out = { keys: [], bytes: 0 };
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        const v = localStorage.getItem(k) || '';
        out.keys.push({ key: k, bytes: k.length + v.length });
        out.bytes += k.length + v.length;
      }
    } catch { /* no localStorage at all is fine */ }
    return out;
  }

  // ---- plumbing -------------------------------------------------------------------------

  _transact(stores, mode, body) {
    if (!this.db) {
      // In-memory degradation. Still all-or-nothing: the body either completes or throws
      // before anything is committed, because it writes to a staging map.
      const staged = { blobs: new Map(), saves: new Map(), meta: new Map() };
      const tx = {
        objectStore: (name) => ({
          put: (v, k) => staged[name].set(k, v),
          delete: (k) => staged[name].set(k, undefined),
          get: () => { throw new Error('reads inside a memory transaction are not supported'); },
        }),
      };
      body(tx);
      for (const name of stores) {
        for (const [k, v] of staged[name]) {
          if (v === undefined) { if (name === 'meta') this.memory.meta = { generation: 0, committed: null }; else this.memory[name].delete(k); }
          else if (name === 'meta') this.memory.meta = v;
          else this.memory[name].set(k, v);
        }
      }
      return Promise.resolve();
    }
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(stores, mode);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error || new Error('transaction failed'));
      tx.onabort = () => reject(tx.error || new Error('transaction aborted'));
      try { body(tx); } catch (e) { try { tx.abort(); } catch { /* already gone */ } reject(e); }
    });
  }

  _get(store, key) {
    if (!this.db) {
      if (store === 'meta') return Promise.resolve(this.memory.meta);
      return Promise.resolve(this.memory[store].get(key));
    }
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction([store], 'readonly');
      const req = tx.objectStore(store).get(key);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  _keys(store) {
    if (!this.db) return Promise.resolve([...this.memory[store].keys()]);
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction([store], 'readonly');
      const req = tx.objectStore(store).getAllKeys();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }

  async _readMeta() {
    const m = await this._get('meta', 'meta');
    return m || { generation: 0, committed: null };
  }

  async _readChunks(slot, gen, count) {
    const parts = [];
    let i = 0;
    for (;;) {
      const c = await this._get('blobs', `${slot}:${gen}:${i}`);
      if (c === undefined) break;
      parts.push(c);
      i++;
      if (count !== null && count !== undefined && i >= count) break;
      if (i > 4096) break;
    }
    if (!parts.length) return null;
    return parts.join('');
  }

  async _deleteGenerations(slot, upTo) {
    if (upTo < 1) return;
    await this._transact(['blobs'], 'readwrite', (tx) => {
      const b = tx.objectStore('blobs');
      for (let g = Math.max(1, upTo - 8); g <= upTo; g++) for (let i = 0; i < 64; i++) b.delete(`${slot}:${g}:${i}`);
    });
  }

  async _evictOldestAutosave() {
    const keys = await this._keys('saves');
    const autos = keys.filter((k) => String(k).startsWith('auto')).sort();
    if (!autos.length) return false;
    await this.deleteSlot(autos[0]);
    this.notices.push('evicted:' + autos[0]);
    return true;
  }
}
