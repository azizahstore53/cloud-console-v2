import { prisma } from "@/lib/prisma";
import { getCloudProvider } from "@/lib/cloud/ProviderFactory";
import { calculateUsageCharge } from "@/lib/billing/calculator";
import { vpnService } from "@/lib/vpn/vpnService";
import type { Instance, InstancePlan, User } from "@prisma/client";

const LOW_BALANCE_WARNING_THRESHOLD = Number(process.env.LOW_BALANCE_WARNING_THRESHOLD ?? 50_000);
const VPN_MONTHLY_PRICE = 300000;

interface BillOneResult {
  amountCharged: number;
  hoursCharged: number;
  insufficientFunds: boolean;
}

export async function billInstanceUsage(
  instance: Instance & { plan: InstancePlan; user: User },
  upTo: Date
): Promise<BillOneResult | null> {
  if (!instance.lastBilledAt) return null;

  const hoursElapsed = (upTo.getTime() - instance.lastBilledAt.getTime()) / (1000 * 60 * 60);
  if (hoursElapsed <= 1 / 3600) return null;

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
  vpnRevoked: { clientId: string; userId: string }[];
  errors: { instanceId: string; error: string }[];
}

export async function runHourlyBillingCycle(): Promise<BillingCycleSummary> {
  const now = new Date();
  const summary: BillingCycleSummary = { processed: 0, totalCharged: 0, autoStopped: [], vpnRevoked: [], errors: [] };

  // 1. Process Instances
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
        } catch {}

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

  // 2. Process VPNs (Auto-Revoke if balance is too low for future renewal)
  // For VPNs, we can check if balance < 10,000 IDR as a critical threshold for disconnect,
  // or check if the monthly renewal date has passed and they can't pay.
  const activeVpns = await prisma.vpnClient.findMany({
    where: { status: "ACTIVE" },
    include: { user: true }
  });

  for (const vpn of activeVpns) {
    try {
      if (vpn.user.balance < 10000) { // Critical threshold
        await vpnService.revokeVpnClient(vpn.id);

        await prisma.activityLog.create({
          data: {
            userId: vpn.userId,
            category: "BILLING",
            action: "vpn.auto_revoke_insufficient_funds",
            message: `VPN Tunnel was automatically revoked — wallet balance too low to maintain service.`,
          },
        });

        summary.vpnRevoked.push({ clientId: vpn.id, userId: vpn.userId });
      }
    } catch (err) {
      console.error(`Failed to revoke VPN ${vpn.id}:`, err);
    }
  }

  return summary;
}
