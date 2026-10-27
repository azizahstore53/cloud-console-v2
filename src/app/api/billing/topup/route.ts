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

  // Create a local Invoice first for record-keeping
  const invoiceNumber = `INV-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const invoice = await prisma.invoice.create({
    data: {
      userId: user.id,
      invoiceNumber,
      status: "PENDING",
      subtotal: amount,
      total: amount,
      dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours from now
      currency: user.currency,
    },
  });

  // Create a PENDING transaction linked to the invoice
  const transaction = await prisma.transaction.create({
    data: {
      userId: user.id,
      invoiceId: invoice.id,
      type: "TOPUP",
      status: "PENDING",
      amount,
      balanceAfter: user.balance, // unchanged until payment confirms
      gateway: toTopUpGateway(gateway.gatewayName),
      description: "Wallet top-up",
    },
  });

  const gatewayInvoice = await gateway.createInvoice({
    externalId: `topup:${transaction.id}`,
    amount,
    payerEmail: user.email,
    description: "CloudConsole wallet top-up",
  });

  await prisma.transaction.update({
    where: { id: transaction.id },
    data: {
      gatewayRef: gatewayInvoice.id,
      paymentUrl: gatewayInvoice.invoiceUrl
    },
  });

  return NextResponse.json({ checkoutUrl: gatewayInvoice.invoiceUrl, transactionId: transaction.id });
}
