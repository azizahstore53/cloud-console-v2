import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isStaff } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { getPaymentGateway } from "@/lib/payment/PaymentGatewayAdapter";
import { confirmTopUp } from "@/lib/billing/calculator";

export async function POST(req: NextRequest) {
  const session = await auth();

  // 1. Guard: Only staff can trigger manual sync
  if (!session?.user || !session.user.role || !isStaff(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized. Staff access required." }, { status: 403 });
  }

  try {
    // 2. Find all PENDING transactions that have a gateway reference
    const pendingTransactions = await prisma.transaction.findMany({
      where: {
        status: "PENDING",
        NOT: {
          gatewayRef: { equals: null }
        }
      }
    });

    if (pendingTransactions.length === 0) {
      return NextResponse.json({
        message: "No pending transactions to sync.",
        synced: 0
      });
    }

    console.log(`[BillingSync] Found ${pendingTransactions.length} pending transactions. Starting sync...`);

    const gateway = getPaymentGateway();
    const results = {
      processed: 0,
      paid: 0,
      expired: 0,
      errors: 0
    };

    for (const tx of pendingTransactions) {
      try {
        // Use the gateway adapter to get the latest status from the provider
        const statusResult = await gateway.getPaymentStatus(tx.gatewayRef!);

        if (statusResult.status === "PAID") {
          // Use the same confirmTopUp logic as the webhook to ensure idempotency
          await confirmTopUp({
            transactionId: tx.id,
            gateway: gateway.gatewayName
          });
          results.paid++;
        } else if (statusResult.status === "EXPIRED") {
          await prisma.transaction.update({
            where: { id: tx.id },
            data: { status: "EXPIRED" }
          });
          results.expired++;
        }
        results.processed++;
      } catch (err) {
        console.error(`[BillingSync] Failed to sync transaction ${tx.id}:`, err);
        results.errors++;
      }
    }

    return NextResponse.json({
      message: "Sync completed successfully",
      ...results
    });

  } catch (error) {
    console.error("[BillingSync] Critical error during sync:", error);
    return NextResponse.json({ error: "Internal server error during sync" }, { status: 500 });
  }
}
