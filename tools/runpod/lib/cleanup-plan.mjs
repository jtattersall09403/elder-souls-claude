// Pure planning for `cli.mjs cleanup`. No network, no side effects: given the account's Pods and
// templates plus the requested scope, decide what may be destroyed and what must be protected.
//
// The rule this file exists to enforce: **a cleanup with no arguments may never destroy a resource
// belonging to another agent.** Everything else is convenience on top of that.
import { ageMinutes, ownerOfName } from './owner.mjs';
import { isManagedPod, isManagedRuntimeTemplate } from './api.mjs';

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

    if (mine) { decide(true, 'owned by this agent'); continue; }
    if (all && (yes || force)) {
      decide(true, owner === null ? '--all --yes over an unattributed Pod' : `--all --yes over Pod owned by o${owner}`);
      continue;
    }
    if (olderThanMinutes != null && age != null && age >= olderThanMinutes) {
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
} = {}) {
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
