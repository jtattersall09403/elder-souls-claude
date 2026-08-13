import { RunPodError } from './api.mjs';

function unique(values) {
  return [...new Set(values)];
}

export function buildProvisioningBatches(candidates, cloudPriority = []) {
  const byCloud = new Map();
  for (const offer of candidates) {
    if (!byCloud.has(offer.cloudType)) byCloud.set(offer.cloudType, []);
    byCloud.get(offer.cloudType).push(offer);
  }
  return [...byCloud.entries()].map(([cloudType, offers]) => ({
    cloudType,
    offers,
    gpuTypeIds: unique(offers.map((offer) => offer.gpuTypeId)),
    cheapestPricePerHourUsd: Math.min(...offers.map((offer) => offer.pricePerHourUsd)),
  })).sort((left, right) => {
    const leftPriority = cloudPriority.indexOf(left.cloudType);
    const rightPriority = cloudPriority.indexOf(right.cloudType);
    if (leftPriority >= 0 || rightPriority >= 0) {
      if (leftPriority < 0) return 1;
      if (rightPriority < 0) return -1;
      if (leftPriority !== rightPriority) return leftPriority - rightPriority;
    }
    return left.cheapestPricePerHourUsd - right.cheapestPricePerHourUsd;
  });
}

function podGpuTypeId(pod) {
  return pod?.gpu?.id || pod?.gpuTypeId || pod?.machine?.gpuTypeId || null;
}

function selectedOffer(pod, batch) {
  const gpuTypeId = podGpuTypeId(pod);
  if (gpuTypeId) return batch.offers.find((offer) => offer.gpuTypeId === gpuTypeId) || null;
  return batch.offers.length === 1 ? batch.offers[0] : null;
}

function attachPod(error, pod) {
  error.pod = pod;
  return error;
}

export async function provisionPod({
  client,
  candidates,
  podName,
  createInput,
  recoverPodByName,
  cloudPriority = [],
  log = () => {},
  onAttempt = () => {},
  signal,
}) {
  const batches = buildProvisioningBatches(candidates, cloudPriority);
  if (!batches.length) throw new Error('no eligible provisioning batches');
  log(`Provisioning strategy: RunPod availability priority across ${batches.length} cloud batch(es); one POST per cloud at most`);

  for (const [index, batch] of batches.entries()) {
    if (signal?.aborted) throw signal.reason || new Error('run cancelled');
    log(`Provision batch ${index + 1}/${batches.length}: ${batch.cloudType}, availability-ranked GPU types [${batch.gpuTypeIds.join(', ')}]`);
    const attempt = {
      cloudType: batch.cloudType,
      gpuTypeIds: batch.gpuTypeIds,
      advertisedPricesPerHourUsd: Object.fromEntries(batch.offers.map((offer) => [offer.gpuTypeId, offer.pricePerHourUsd])),
      outcome: 'pending',
    };
    onAttempt(attempt);
    let pod;
    try {
      pod = await client.createPod(createInput(batch));
    } catch (error) {
      if (error.creationOutcome === 'definite-non-creation' && error.creationFailureKind === 'capacity') {
        attempt.outcome = 'definite-non-creation';
        attempt.failureKind = 'capacity';
        log(`Create failure classified definite non-creation (capacity): ${error.message}`, 'stderr');
        for (const offer of batch.offers) {
          log(`Capacity candidate rejected: ${offer.gpuTypeId}/${offer.cloudType} advertised $${offer.pricePerHourUsd.toFixed(3)}/hr`, 'stderr');
        }
        continue;
      }

      if (error.creationOutcome === 'definite-non-creation') {
        attempt.outcome = 'definite-non-creation';
        attempt.failureKind = error.creationFailureKind || 'request-rejected';
        log(`Create failure classified definite non-creation (${error.creationFailureKind || 'request rejected'}); fallback is unsafe or inapplicable: ${error.message}`, 'stderr');
        throw error;
      }

      log(`Create failure classified ambiguous (${error.creationFailureKind || 'unknown'}); refusing any second create and starting unique-name recovery: ${error.message}`, 'stderr');
      attempt.outcome = 'ambiguous';
      attempt.failureKind = error.creationFailureKind || 'unknown';
      pod = await recoverPodByName(5);
      if (!pod) {
        const uncertain = new RunPodError(`Pod create outcome is ambiguous; no Pod named ${podName} was recoverable and no second create was issued: ${error.message}`, {
          status: error.status,
          details: error.details,
          uncertain: true,
          creationOutcome: 'ambiguous',
          creationFailureKind: error.creationFailureKind || 'unknown',
        });
        throw uncertain;
      }
      log(`Ambiguous create response recovered Pod ${pod.id} by unique name; no second create was issued`, 'stderr');
      attempt.outcome = 'recovered';
    }

    if (!pod?.id) {
      attempt.outcome = 'ambiguous';
      attempt.failureKind = 'invalid-success-response';
      log('Create returned success without a Pod ID; classifying the outcome as ambiguous and starting unique-name recovery', 'stderr');
      pod = await recoverPodByName(5);
      if (!pod?.id) {
        throw new RunPodError(`Pod create returned no ID; no Pod named ${podName} was recoverable and no second create was issued`, {
          uncertain: true,
          creationOutcome: 'ambiguous',
          creationFailureKind: 'invalid-success-response',
        });
      }
      attempt.outcome = 'recovered';
    }

    let offer = selectedOffer(pod, batch);
    if (!offer) {
      let hydrated;
      try {
        hydrated = await client.getPod(pod.id);
      } catch (error) {
        throw attachPod(error, pod);
      }
      if (hydrated) pod = hydrated;
      offer = selectedOffer(pod, batch);
    }
    if (!offer) {
      throw attachPod(new Error(`created Pod ${pod.id} did not report one of the explicitly requested GPU types: ${batch.gpuTypeIds.join(', ')}`), pod);
    }
    attempt.outcome = attempt.outcome === 'recovered' ? 'recovered' : 'created';
    attempt.podId = pod.id;
    attempt.selectedGpuTypeId = offer.gpuTypeId;
    return { pod, offer, batch };
  }

  throw new Error('all safe eligible cloud/GPU capacity options were exhausted; no Pod was created');
}
