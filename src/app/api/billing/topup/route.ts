import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getPaymentGateway } from "@/lib/payment/PaymentGatewayAdapter";
import { toTopUpGateway } from "@/lib/billing/calculator";

const topupSchema = z.object({
  amount: z.number().int().min(10000).max(50_000_000),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = topupSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid amount" }, { status: 400 });

  const { amount } = parsed.data;
  const user = await prisma.user.findUniqueOrThrow({ where: { id: session.user.id } });
  const gateway = getPaymentGateway();

  // Create a PENDING transaction first, then hand off to the payment gateway.
  const transaction = await prisma.transaction.create({
    data: {
      userId: user.id,
      type: "TOPUP",
      status: "PENDING",
      amount,
      balanceAfter: user.balance, // unchanged until payment confirms
      gateway: toTopUpGateway(gateway.gatewayName),
      description: "Wallet top-up",
    },
  });

  const invoice = await gateway.createInvoice({
    externalId: `topup:${transaction.id}`,
    amount,
    payerEmail: user.email,
    description: "CloudConsole wallet top-up",
  });

  await prisma.transaction.update({
    where: { id: transaction.id },
    data: {
      gatewayRef: invoice.id,
      paymentUrl: invoice.invoiceUrl
    },
  });

  return NextResponse.json({ checkoutUrl: invoice.invoiceUrl, transactionId: transaction.id });
}
