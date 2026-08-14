// Shared Pod/template lifecycle checks. Both transports (SSH and HTTPS) must confirm that what
// they created is gone, and must be able to re-find a resource whose create response was lost.

export async function recoverPodByName(client, podName, log, attempts = 5) {
  for (let attempt = 1; attempt <= attempts; attempt++) {
    const pods = await client.listPods().catch((lookupError) => {
      log(`Pod recovery lookup ${attempt}/${attempts} failed: ${lookupError.message}`, 'stderr');
      return [];
    });
    const recovered = pods.find((item) => item.name === podName);
    if (recovered) return recovered;
    if (attempt < attempts) await new Promise((resolve) => setTimeout(resolve, 2_000));
  }
  return null;
}

export async function recoverTemplateByName(client, templateName, log, attempts = 5) {
  for (let attempt = 1; attempt <= attempts; attempt++) {
    const templates = await client.listTemplates().catch((lookupError) => {
      log(`Template recovery lookup ${attempt}/${attempts} failed: ${lookupError.message}`, 'stderr');
      return [];
    });
    const recovered = templates.find((item) => item.name === templateName);
    if (recovered) return recovered;
    if (attempt < attempts) await new Promise((resolve) => setTimeout(resolve, 2_000));
  }
  return null;
}

export async function confirmPodDeleted(client, podId, log, attempts = 5) {
  for (let attempt = 1; attempt <= attempts; attempt++) {
    const found = await client.getPod(podId);
    if (!found) {
      log(`Deletion confirmed: subsequent API lookup for Pod ${podId} returned not found`);
      return true;
    }
    if (attempt < attempts) await new Promise((resolve) => setTimeout(resolve, 2_000));
  }
  return false;
}

export async function confirmTemplateDeleted(client, templateId, log, attempts = 5) {
  for (let attempt = 1; attempt <= attempts; attempt++) {
    const found = await client.getTemplate(templateId, { allow404: true });
    if (!found) {
      log(`Deletion confirmed: subsequent API lookup for template ${templateId} returned not found`);
      return true;
    }
    if (attempt < attempts) await new Promise((resolve) => setTimeout(resolve, 2_000));
  }
  return false;
}
