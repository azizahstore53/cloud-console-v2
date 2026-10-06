import { prisma } from "@/lib/prisma";
import { getCloudProvider } from "@/lib/cloud/ProviderFactory";
import { calculateUsageCharge } from "@/lib/billing/calculator";
import type { Instance, InstancePlan, User } from "@prisma/client";

const LOW_BALANCE_WARNING_THRESHOLD = Number(process.env.LOW_BALANCE_WARNING_THRESHOLD ?? 50_000);

interface BillOneResult {
  amountCharged: number;
  hoursCharged: number;
  insufficientFunds: boolean;
}

/**
 * Charges a single instance for its elapsed running time, from its
 * `lastBilledAt` anchor up to `upTo`. Always advances the anchor to `upTo`
 * regardless of outcome, so a partial/failed charge never gets re-billed.
 *
 * If the user's balance can't cover the full amount, charges whatever
 * balance remains (draining it to zero) rather than charging nothing —
 * partial usage still gets billed for what was actually consumed, and the
 * caller is told to auto-stop the instance via `insufficientFunds`.
 *
 * Returns `null` if there's nothing to bill yet (anchor missing, or less
 * than a few seconds have elapsed — avoids near-zero noise transactions).
 */
export async function billInstanceUsage(
  instance: Instance & { plan: InstancePlan; user: User },
  upTo: Date
): Promise<BillOneResult | null> {
  if (!instance.lastBilledAt) return null;

  const hoursElapsed = (upTo.getTime() - instance.lastBilledAt.getTime()) / (1000 * 60 * 60);
  if (hoursElapsed <= 1 / 3600) return null; // less than a second — nothing meaningful to bill

  const fullAmount = calculateUsageCharge(instance.plan, instance.billingCycle, hoursElapsed);
  if (fullAmount <= 0) return null;

  return prisma.$transaction(async (tx) => {
    const user = await tx.user.findUniqueOrThrow({ where: { id: instance.userId } });
    const insufficientFunds = user.balance < fullAmount;
    const amountToCharge = insufficientFunds ? user.balance : fullAmount;

    let balanceAfter = user.balance;
    if (amountToCharge > 0) {
      balanceAfter = user.balance - amountToCharge;
      await tx.user.update({ where: { id: user.id }, data: { balance: balanceAfter } });
      await tx.transaction.create({
        data: {
          userId: user.id,
          type: "USAGE_CHARGE",
          status: "SUCCESS",
          amount: -amountToCharge,
          balanceAfter,
          gateway: "BALANCE",
          description: insufficientFunds
            ? `Partial usage charge for "${instance.name}" (${hoursElapsed.toFixed(2)}h, balance exhausted)`
            : `Usage charge for "${instance.name}" (${hoursElapsed.toFixed(2)}h)`,
        },
      });
    }

    await tx.usageRecord.create({
      data: {
        instanceId: instance.id,
        periodStart: instance.lastBilledAt!,
        periodEnd: upTo,
        amount: amountToCharge,
        billed: true,
      },
    });

    await tx.instance.update({ where: { id: instance.id }, data: { lastBilledAt: upTo } });

    // Warn once when a top-up-worthy balance drops below the threshold —
    // only log on the crossing, not on every subsequent hourly charge.
    if (balanceAfter < LOW_BALANCE_WARNING_THRESHOLD && user.balance >= LOW_BALANCE_WARNING_THRESHOLD) {
      await tx.activityLog.create({
        data: {
          userId: user.id,
          category: "BILLING",
          action: "billing.low_balance_warning",
          message: `Wallet balance is running low (below ${LOW_BALANCE_WARNING_THRESHOLD.toLocaleString("id-ID")} IDR) — top up to avoid instances being stopped.`,
        },
      });
    }

    return { amountCharged: amountToCharge, hoursCharged: hoursElapsed, insufficientFunds };
  });
}

export interface BillingCycleSummary {
  processed: number;
  totalCharged: number;
  autoStopped: { instanceId: string; name: string; userId: string }[];
  errors: { instanceId: string; error: string }[];
}

/**
 * Meters every currently-RUNNING instance and charges the elapsed usage
 * since it was last billed. Instances whose owner can't cover the full
 * charge are billed whatever balance remains, then auto-stopped via the
 * cloud provider — mirroring how a real prepaid VPS platform enforces its
 * "no overdraft" billing model.
 *
 * Safe to call repeatedly / at irregular intervals: billing is based on
 * actual elapsed wall-clock time since each instance's own `lastBilledAt`
 * anchor, not a fixed hourly bucket, so a missed or delayed run just bills
 * a larger span next time rather than under- or double-charging.
 */
export async function runHourlyBillingCycle(): Promise<BillingCycleSummary> {
  const now = new Date();
  const summary: BillingCycleSummary = { processed: 0, totalCharged: 0, autoStopped: [], errors: [] };

  const runningInstances = await prisma.instance.findMany({
    where: { status: "RUNNING" },
    include: { plan: true, user: true },
  });

  const provider = getCloudProvider();

  for (const instance of runningInstances) {
    try {
      const result = await billInstanceUsage(instance, now);
      if (!result) continue;

      summary.processed += 1;
      summary.totalCharged += result.amountCharged;

      if (result.insufficientFunds) {
        try {
          await provider.stopInstance(instance.externalId!);
        } catch {
          // Best-effort: even if the provider call fails, still reflect
          // the stop in our own records so the user isn't billed further
          // for an instance we believe is out of funds.
        }

        await prisma.instance.update({ where: { id: instance.id }, data: { status: "STOPPED" } });
        await prisma.activityLog.create({
          data: {
            userId: instance.userId,
            instanceId: instance.id,
            category: "BILLING",
            action: "billing.auto_stop_insufficient_funds",
            message: `Instance "${instance.name}" was automatically stopped — wallet balance reached zero.`,
          },
        });

        summary.autoStopped.push({ instanceId: instance.id, name: instance.name, userId: instance.userId });
      }
    } catch (err) {
      summary.errors.push({
        instanceId: instance.id,
        error: err instanceof Error ? err.message : "Unknown billing error",
      });
    }
  }

  return summary;
}
