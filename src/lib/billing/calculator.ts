import { prisma } from "@/lib/prisma";
import type { BillingCycle } from "@prisma/client";

/**
 * Billing calculator — mirrors IDCloudHost-style prepaid usage billing.
 * All amounts are integers in the smallest currency unit (e.g. IDR has no
 * decimal subunit in practice, but we keep integer math throughout to avoid
 * floating point errors).
 */

/** Payment gateways that can credit a wallet top-up. Kept separate from
 * Prisma's `PaymentGateway` enum (which also includes `BALANCE`, used for
 * usage-charge debits, not top-up credits) so this file's public functions
 * can't accidentally be called with a debit-only gateway value. */
export type TopUpGateway = "XENDIT" | "MIDTRANS" | "DOIT" | "MANUAL_TRANSFER";

/** Maps a `PaymentGatewayAdapter.gatewayName` (e.g. "mock", "doit") to the
 * `TopUpGateway` label stored on Transaction rows. Centralized here so
 * every call site (top-up creation, the webhook handler) agrees on the
 * same mapping instead of each hardcoding its own guess. */
export function toTopUpGateway(gatewayName: string): TopUpGateway {
  switch (gatewayName) {
    case "doit":
      return "DOIT";
    case "midtrans":
      return "MIDTRANS";
    case "mock": // the mock gateway impersonates Xendit's shape for local dev
    case "xendit":
    default:
      return "XENDIT";
  }
}

export interface PlanPricing {
  pricePerHour: number;
  pricePerMonth: number;
}

/** Compute the charge for a single elapsed period of instance uptime. */
export function calculateUsageCharge(
  pricing: PlanPricing,
  cycle: BillingCycle,
  hoursElapsed: number
): number {
  if (cycle === "MONTHLY") {
    // Prorate monthly plans down to an hourly-equivalent rate for partial periods.
    const hourlyEquivalent = pricing.pricePerMonth / (30 * 24);
    return Math.round(hourlyEquivalent * hoursElapsed);
  }
  return Math.round(pricing.pricePerHour * hoursElapsed);
}

/** Estimate the monthly cost of a plan for display in the creation wizard. */
export function estimateMonthlyCost(pricing: PlanPricing, cycle: BillingCycle): number {
  return cycle === "MONTHLY" ? pricing.pricePerMonth : pricing.pricePerHour * 24 * 30;
}

/**
 * Charge a user's wallet balance, writing a Transaction row atomically.
 * Throws if the balance would go negative (prepaid model — no overdraft).
 */
export async function chargeWallet(params: {
  userId: string;
  amount: number; // positive number to deduct
  description: string;
  invoiceId?: string;
}) {
  const { userId, amount, description, invoiceId } = params;

  return prisma.$transaction(async (tx) => {
    const user = await tx.user.findUniqueOrThrow({ where: { id: userId } });

    if (user.balance < amount) {
      throw new Error("INSUFFICIENT_BALANCE");
    }

    const balanceBefore = user.balance;
    const balanceAfter = user.balance - amount;

    await tx.user.update({
      where: { id: userId },
      data: { balance: balanceAfter },
    });

    return tx.transaction.create({
      data: {
        userId,
        invoiceId,
        type: "USAGE_CHARGE",
        status: "SUCCESS",
        amount: -amount,
        balanceBefore,
        balanceAfter,
        gateway: "BALANCE",
        description,
      },
    });
  });
}

/** Credit a user's wallet balance directly — for flows with no prior
 * PENDING transaction to reconcile against (e.g. a manual admin credit).
 * For confirming a payment against an existing top-up request, use
 * `confirmTopUp` instead — it's idempotent and never trusts a
 * caller-supplied amount. */
export async function creditWallet(params: {
  userId: string;
  amount: number;
  gateway: TopUpGateway;
  gatewayRef: string;
  description?: string;
}) {
  const { userId, amount, gateway, gatewayRef, description } = params;

  return prisma.$transaction(async (tx) => {
    const user = await tx.user.findUniqueOrThrow({ where: { id: userId } });
    const balanceBefore = user.balance;
    const balanceAfter = user.balance + amount;

    await tx.user.update({
      where: { id: userId },
      data: { balance: balanceAfter },
    });

    return tx.transaction.create({
      data: {
        userId,
        type: "TOPUP",
        status: "SUCCESS",
        amount,
        balanceBefore,
        balanceAfter,
        gateway,
        gatewayRef,
        description: description ?? "Wallet top-up",
      },
    });
  });
}

export type ConfirmTopUpResult =
  | { status: "confirmed"; balanceAfter: number; amount: number }
  | { status: "already_processed" }
  | { status: "not_found" }
  | { status: "forbidden" };

/**
 * Confirms a previously-created PENDING top-up transaction and credits the
 * wallet — safe to call more than once with the same `transactionId`
 * (payment gateways routinely retry webhooks, and a person can double-tap
 * "Pay" in the UI).
 *
 * Two things make this safe where the old creditWallet-on-confirm pattern
 * wasn't:
 *
 * 1. **Idempotent by construction, not by a pre-check.** The PENDING → paid
 *    transition happens via a single `updateMany({ where: { id, status:
 *    "PENDING" } })`. Postgres takes a row lock on that update, so if two
 *    confirmations race (a duplicated webhook delivery, a double-click),
 *    only one of them can ever see `count === 1` — the other sees `0` and
 *    returns `already_processed` having changed nothing. A separate
 *    "check status, then credit" pattern has a race window between the
 *    check and the write; this doesn't.
 * 2. **The amount is never taken from the caller.** It reads whatever
 *    amount was recorded when the top-up was originally requested
 *    (`POST /api/billing/topup`), so nothing calling this — including a
 *    malicious or buggy client — can credit an arbitrary amount by simply
 *    passing a different number.
 *
 * `expectedUserId`, when provided, additionally guards against confirming
 * someone else's transaction (relevant for the user-initiated mock-pay
 * flow, which has a session to check against; the real webhook endpoint
 * has no session and omits this).
 */
export async function confirmTopUp(params: {
  transactionId: string;
  gateway: TopUpGateway;
  expectedUserId?: string;
}): Promise<ConfirmTopUpResult> {
  const { transactionId, gateway, expectedUserId } = params;

  return prisma.$transaction(async (tx) => {
    const existing = await tx.transaction.findUnique({ where: { id: transactionId } });
    if (!existing || existing.type !== "TOPUP") return { status: "not_found" };
    if (expectedUserId && existing.userId !== expectedUserId) return { status: "forbidden" };

    const claim = await tx.transaction.updateMany({
      where: { id: transactionId, status: "PENDING" },
      data: { status: "SUCCESS", gateway },
    });
    if (claim.count === 0) {
      return { status: "already_processed" };
    }

    const user = await tx.user.findUniqueOrThrow({ where: { id: existing.userId } });
    const balanceBefore = user.balance;
    const balanceAfter = user.balance + existing.amount;

    await tx.user.update({
      where: { id: existing.userId },
      data: { balance: balanceAfter },
    });

    await tx.transaction.update({
      where: { id: transactionId },
      data: { balanceBefore, balanceAfter },
    });

    return { status: "confirmed", balanceAfter: user.balance, amount: existing.amount };
  });
}

/**
 * Refunds a user's wallet balance atomically.
 * Used for compensating transactions when a provisioned service fails.
 */
export async function refundWallet(params: {
  userId: string;
  amount: number; // positive number to return
  description: string;
}) {
  const { userId, amount, description } = params;

  return prisma.$transaction(async (tx) => {
    const user = await tx.user.findUniqueOrThrow({ where: { id: userId } });
    const balanceBefore = user.balance;
    const balanceAfter = user.balance + amount;

    await tx.user.update({
      where: { id: userId },
      data: { balance: balanceAfter },
    });

    return tx.transaction.create({
      data: {
        userId,
        type: "REFUND",
        status: "SUCCESS",
        amount,
        balanceBefore,
        balanceAfter,
        gateway: "BALANCE",
        description,
      },
    });
  });
}

export function formatCurrency(amount: number, currency = "IDR"): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}
