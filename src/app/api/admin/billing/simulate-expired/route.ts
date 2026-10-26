import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isStaff } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const session = await auth();

  if (!session?.user || !session.user.role || !isStaff(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized. Staff access required." }, { status: 403 });
  }

  try {
    const { transactionId } = await req.json();
    if (!transactionId) {
      return NextResponse.json({ error: "transactionId is required" }, { status: 400 });
    }

    const transaction = await prisma.transaction.findUnique({
      where: { id: transactionId }
    });

    if (!transaction) {
      return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
    }

    await prisma.transaction.update({
      where: { id: transactionId },
      data: { status: "EXPIRED" }
    });

    return NextResponse.json({
      message: `Transaction ${transactionId} has been marked as EXPIRED.`,
      status: "EXPIRED"
    });

  } catch (error) {
    console.error("[SimulateExpired] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
