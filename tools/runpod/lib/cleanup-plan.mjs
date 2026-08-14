// Pure planning for `cli.mjs cleanup`. No network, no side effects: given the account's Pods and
// templates plus the requested scope, decide what may be destroyed and what must be protected.
//
// The rule this file exists to enforce: **a cleanup with no arguments may never destroy a resource
// belonging to another agent.** Everything else is convenience on top of that.
import { ageMinutes, ownerOfName } from './owner.mjs';
import { isManagedPod, isManagedRuntimeTemplate } from './api.mjs';
import { isClaimLive } from './claims.mjs';

export const SCOPE = {
  MINE: 'mine',
  POD: 'pod',
  OLDER_THAN: 'older-than',
  ALL: 'all',
};

function podLabel(pod) {
  return `${pod.id} ${pod.name || '(unnamed)'}`;
}

/**
 * @returns {{scope:string, terminate:Array, protected:Array, refusals:Array, ownerSlug:string}}
 */
export function planPodCleanup(pods, {
  ownerSlug,
  podNamePrefix,
  templateId,
  runtimeTemplateIds = [],
  imageName,
  podId = null,
  all = false,
  yes = false,
  force = false,
  olderThanMinutes = null,
  now = Date.now(),
  claims = new Map(),
  selfPid = process.pid,
  minOrphanAgeMinutes = 120,
  isLiveClaim = isClaimLive,
} = {}) {
  if (!ownerSlug) throw new Error('planPodCleanup requires an ownerSlug');
  const managed = (pods || []).filter((pod) => isManagedPod(pod, {
    podNamePrefix,
    templateId,
    runtimeTemplateIds,
    imageName,
  }));
  const scope = podId ? SCOPE.POD : (all ? SCOPE.ALL : (olderThanMinutes != null ? SCOPE.OLDER_THAN : SCOPE.MINE));
  const terminate = [];
  const guarded = [];
  const refusals = [];

  for (const pod of managed) {
    const owner = ownerOfName(pod.name, podNamePrefix);
    const mine = owner !== null && owner === ownerSlug;
    const age = ageMinutes(pod, now);
    const decide = (allowed, reason, hint = null) => {
      if (allowed) terminate.push({ pod, owner, mine, age, reason });
      else guarded.push({ pod, owner, mine, age, reason, hint });
    };

    if (podId) {
      if (pod.id !== podId) continue;
      const targetClaim = claims.get(pod.id);
      if (targetClaim && isLiveClaim(targetClaim) && targetClaim.pid !== selfPid && !force) {
        decide(false, `a live run in this container holds it (pid ${targetClaim.pid})`,
          `if you know that run is finished: cleanup --pod ${pod.id} --force`);
        continue;
      }
      if (mine || owner === null || force) {
        decide(true, mine
          ? 'explicitly named and owned by this agent'
          : (owner === null
            ? 'explicitly named; no owner recorded in the Pod name'
            : `explicitly named and --force given (owner o${owner})`));
      } else {
        decide(false, `Pod belongs to another agent (owner o${owner})`,
          `if you are certain that agent is finished: cleanup --pod ${pod.id} --force`);
      }
      continue;
    }

    if (mine) {
      // The owner slug is container-scoped, not agent-scoped: sibling agents in one container hash
      // to the same slug (measured 2026-08-14 — four sibling runs, one slug). So "mine" is only a
      // first pass, and a live local claim is what actually separates my Pod from a sibling's.
      const claim = claims.get(pod.id);
      if (claim && isLiveClaim(claim) && claim.pid !== selfPid) {
        decide(false, `a live run in this container holds it (pid ${claim.pid}${claim.runId ? `, run ${claim.runId}` : ''})`,
          `wait for that run, or if you know it is finished: cleanup --pod ${pod.id} --force`);
        continue;
      }
      if (claim) { decide(true, `owned by this agent; the run that claimed it (pid ${claim.pid}) is gone`); continue; }
      // No claim at all. In a shared container that is not proof the Pod is free — it may belong to
      // a sibling running from a different worktree, or one whose claim file was lost. Only age can
      // settle it, and the runtime cap is the honest threshold.
      if (age == null) {
        decide(false, 'no local claim and RunPod reported no creation time, so it cannot be shown to be free',
          `if you know it is yours: cleanup --pod ${pod.id}`);
        continue;
      }
      if (age < minOrphanAgeMinutes) {
        decide(false, `no local claim and only ${age.toFixed(0)} min old; in a shared container this may be a sibling agent's live run`,
          `wait, or if you know it is yours: cleanup --pod ${pod.id}`);
        continue;
      }
      decide(true, `owned by this agent, unclaimed, and ${age.toFixed(0)} min old, past the ${minOrphanAgeMinutes} min runtime cap`);
      continue;
    }
    if (all && (yes || force)) {
      decide(true, owner === null ? '--all --yes over an unattributed Pod' : `--all --yes over Pod owned by o${owner}`);
      continue;
    }
    if (olderThanMinutes != null && age != null && age >= olderThanMinutes) {
      const sweepClaim = claims.get(pod.id);
      if (sweepClaim && isLiveClaim(sweepClaim) && sweepClaim.pid !== selfPid && !force) {
        decide(false, `older than ${olderThanMinutes} min but a live run in this container still holds it (pid ${sweepClaim.pid})`,
          `if that run is stuck: cleanup --pod ${pod.id} --force`);
        continue;
      }
      decide(true, `older than ${olderThanMinutes} min (age ${age.toFixed(0)} min), so no compliant run can still hold it`);
      continue;
    }

    const who = owner === null ? 'no owner recorded in the Pod name' : `owned by another agent (o${owner})`;
    const ageText = age == null ? 'age unknown' : `age ${age.toFixed(0)} min`;
    decide(false, `${who}, ${ageText}`,
      `safe sweep: cleanup --older-than <minutes>   |   this one only: cleanup --pod ${pod.id} --force`);
    if (all && !(yes || force)) {
      refusals.push(`--all would have terminated ${podLabel(pod)} which this agent does not own; re-run with --all --yes if that is really intended`);
    }
  }

  return { scope, terminate, protected: guarded, refusals, ownerSlug };
}

/**
 * Ephemeral runtime templates cost nothing to keep, so the bias here is even stronger toward
 * leaving another agent's alone: a template deleted mid-run makes that run's own cleanup report a
 * confusing 404.
 */
export function planTemplateCleanup(templates, {
  ownerSlug,
  templateNamePrefix,
  imageName,
  remainingPods = [],
  all = false,
  yes = false,
  force = false,
  olderThanMinutes = null,
  now = Date.now(),
  podScoped = false,
  claims = new Map(),
  selfPid = process.pid,
  isLiveClaim = isClaimLive,
} = {}) {
  // A template whose run is still live in this container belongs to that run, whatever the
  // container-scoped owner slug says.
  const liveRunIds = new Set([...claims.values()]
    .filter((claim) => isLiveClaim(claim) && claim.pid !== selfPid)
    .map((claim) => claim.runId)
    .filter(Boolean));
  const managed = (templates || []).filter((template) => isManagedRuntimeTemplate(template, {
    templateNamePrefix,
    imageName,
  }));
  const remove = [];
  const guarded = [];
  for (const template of managed) {
    const owner = ownerOfName(template.name, templateNamePrefix);
    const mine = owner !== null && owner === ownerSlug;
    const age = ageMinutes(template, now);
    const inUse = remainingPods.some((pod) => pod.templateId === template.id);
    if (inUse) {
      guarded.push({ template, owner, mine, reason: 'a live Pod still references this template' });
      continue;
    }
    // `--pod <id>` is a targeted repair, not a sweep: it never reaches for templates it was not asked about.
    if (podScoped) {
      guarded.push({ template, owner, mine, reason: '--pod scopes cleanup to that Pod only' });
      continue;
    }
    if ([...liveRunIds].some((runId) => String(template.name || '').endsWith(runId))) {
      guarded.push({ template, owner, mine, reason: 'a live run in this container owns it' });
      continue;
    }
    if (mine) { remove.push({ template, owner, mine, reason: 'owned by this agent and unreferenced' }); continue; }
    if (all && (yes || force)) { remove.push({ template, owner, mine, reason: '--all --yes' }); continue; }
    if (olderThanMinutes != null && age != null && age >= olderThanMinutes) {
      remove.push({ template, owner, mine, reason: `unreferenced and older than ${olderThanMinutes} min` });
      continue;
    }
    guarded.push({
      template,
      owner,
      mine,
      reason: owner === null ? 'no owner recorded in the template name' : `owned by another agent (o${owner})`,
    });
  }
  return { remove, protected: guarded };
}
