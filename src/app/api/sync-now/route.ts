import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isStaff } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { getPaymentGateway } from "@/lib/payment/PaymentGatewayAdapter";
import { confirmTopUp } from "@/lib/billing/calculator";

export async function GET(req: NextRequest) {
  const session = await auth();

  // Guard: Only staff can trigger this manual sync
  if (!session?.user || !session.user.role || !isStaff(session.user.role)) {
    return NextResponse.json({
      error: "Unauthorized. Anda harus login sebagai Admin/Staff untuk menggunakan fitur ini."
    }, { status: 403 });
  }

  try {
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
        message: "Tidak ada transaksi pending yang perlu disinkronkan."
      });
    }

    const gateway = getPaymentGateway();
    let paidCount = 0;
    let expiredCount = 0;

    for (const tx of pendingTransactions) {
      try {
        const statusResult = await gateway.getPaymentStatus(tx.gatewayRef!);

        if (statusResult.status === "PAID") {
          await confirmTopUp({
            transactionId: tx.id,
            gateway: gateway.gatewayName
          });
          paidCount++;
        } else if (statusResult.status === "EXPIRED") {
          await prisma.transaction.update({
            where: { id: tx.id },
            data: { status: "EXPIRED" }
          });
          expiredCount++;
        }
      } catch (err) {
        console.error(`[SyncNow] Error syncing tx ${tx.id}:`, err);
      }
    }

    return NextResponse.json({
      message: "Sinkronisasi selesai!",
      processed: pendingTransactions.length,
      paid: paidCount,
      expired: expiredCount
    });

  } catch (error) {
    console.error("[SyncNow] Critical Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
