import { prisma } from "@/lib/prisma";
import { getCloudProvider } from "@/lib/cloud/ProviderFactory";
import type { Instance, InstanceStatus } from "@prisma/client";

const TRANSIENT_STATUSES: InstanceStatus[] = ["PROVISIONING", "REBOOTING", "TERMINATING"];

/**
 * Instance state changes happen on the provider's side (mock or real) —
 * nothing pushes that back into our database on its own. The frontend
 * polls instance endpoints every few seconds while status is transient
 * (see `useInstance`/`useInstances`), so reconciliation piggybacks on that
 * same poll instead of running a separate background mechanism.
 *
 * Best-effort: if the provider call fails, returns the instance unchanged
 * and lets the next poll retry.
 */
export async function reconcileInstanceStatus(instance: Instance): Promise<Instance> {
  if (!TRANSIENT_STATUSES.includes(instance.status) || !instance.externalId) return instance;

  try {
    const provider = getCloudProvider();
    const { status } = await provider.getInstanceStatus(instance.externalId);
    if (status === instance.status) return instance;

    return prisma.instance.update({
      where: { id: instance.id },
      data: {
        status: status as InstanceStatus,
        // A freshly-RUNNING instance (finished provisioning, or restarted)
        // starts its metering anchor now, matching the START-action logic.
        lastBilledAt: status === "RUNNING" && !instance.lastBilledAt ? new Date() : instance.lastBilledAt,
      },
    });
  } catch {
    return instance;
  }
}

/** Reconciles a batch of instances in parallel — used by list endpoints. */
export async function reconcileInstanceStatuses(instances: Instance[]): Promise<Instance[]> {
  return Promise.all(instances.map(reconcileInstanceStatus));
}
