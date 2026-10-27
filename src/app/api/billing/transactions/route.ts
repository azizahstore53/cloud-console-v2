import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const transactions = await prisma.transaction.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      include: {
        invoice: {
          select: {
            id: true,
          },
        },
      },
    });

    // Transform to ensure invoiceId is always present if an invoice exists
    const result = transactions.map(tx => ({
      ...tx,
      invoiceId: tx.invoice?.id || tx.invoiceId,
    }));

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("[Billing API] Transaction Fetch Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
