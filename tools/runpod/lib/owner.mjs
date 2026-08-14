// Ownership identity for RunPod resources.
//
// Several agents share one container and one RunPod account. Before this existed, a bare
// `cli.mjs cleanup` terminated every managed Pod on the account, and on 2026-08-14 it killed
// another agent's live Pod mid-capture. Ownership has to survive a container restart and a
// different process, so it is carried *in the resource name on RunPod* rather than in local
// state: names are the only thing both agents can see.
//
// Name shape: `<prefix>o<8 hex>-<runId>`, e.g. `elder-souls-gpu-o3f2a91bc-20260814-091500Z-1234`.
// The literal `o` marks the segment so a legacy name whose runId begins with a date
// (`20260814-...`, all hex characters) cannot be misread as an owner slug.
import crypto from 'node:crypto';
import os from 'node:os';

export const OWNER_SEGMENT_PATTERN = /^o([0-9a-f]{8})-/;

/** Resolve who "I" am, most explicit source first. */
export function ownerIdentity(env = process.env) {
  const explicit = String(env.RUNPOD_OWNER || '').trim();
  if (explicit) return { source: 'RUNPOD_OWNER', id: explicit, weak: false };
  const session = String(env.CLAUDE_CODE_SESSION_ID || '').trim();
  if (session) return { source: 'CLAUDE_CODE_SESSION_ID', id: session, weak: false };
  // Every agent on this box shares a hostname, so this fallback cannot distinguish agents.
  // It is recorded as weak so the CLI can say so out loud instead of implying safety.
  return { source: 'hostname (weak: shared by every agent on this box)', id: os.hostname(), weak: true };
}

export function ownerSlug(id) {
  return crypto.createHash('sha256').update(String(id)).digest('hex').slice(0, 8);
}

export function currentOwner(env = process.env) {
  const identity = ownerIdentity(env);
  return { ...identity, slug: ownerSlug(identity.id) };
}

/** The owner segment a new resource name must carry. */
export function ownerNameSegment(slug) {
  if (!/^[0-9a-f]{8}$/.test(String(slug))) throw new Error(`owner slug must be 8 hex characters: ${slug}`);
  return `o${slug}-`;
}

/** Owner slug encoded in an existing name, or null when the name predates ownership tagging. */
export function ownerOfName(name, prefix) {
  const value = String(name || '');
  if (!prefix || !value.startsWith(prefix)) return null;
  const match = OWNER_SEGMENT_PATTERN.exec(value.slice(prefix.length));
  return match ? match[1] : null;
}

/** Minutes since a resource was created, or null when RunPod did not report a usable timestamp. */
export function ageMinutes(resource, now = Date.now()) {
  const stamp = resource?.createdAt || resource?.lastStartedAt || resource?.createdAtUtc || null;
  if (!stamp) return null;
  const parsed = Date.parse(stamp);
  if (!Number.isFinite(parsed)) return null;
  return (now - parsed) / 60_000;
}
