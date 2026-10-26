import { NextRequest, NextResponse } from "next/server";
import { getPaymentGateway } from "@/lib/payment/PaymentGatewayAdapter";
import { confirmTopUp, toTopUpGateway } from "@/lib/billing/calculator";
import { prisma } from "@/lib/prisma";

/**
 * Real payment gateway webhook endpoint. Point your gateway's callback URL
 * at: POST /api/webhooks/payment
 */

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  console.log("[PaymentWebhook] Raw Body Received:", rawBody);
  console.log("[PaymentWebhook] Headers:", Object.fromEntries(req.headers.entries()));

  const signatureHeaderName = process.env.PAYMENT_WEBHOOK_SIGNATURE_HEADER ?? "paybridge-signature";
  const signature =
    req.headers.get(signatureHeaderName) ??
    req.headers.get("paybridge-signature") ??
    req.headers.get("x-signature") ??
    req.headers.get("x-callback-token") ??
    "";

  console.log(`[PaymentWebhook] Using signature header ${signatureHeaderName}: ${signature}`);

  const gateway = getPaymentGateway();
  if (!gateway.verifyWebhookSignature(rawBody, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let event;
  try {
    event = gateway.parseWebhookPayload(rawBody);
  } catch {
    return NextResponse.json({ error: "Malformed payload" }, { status: 400 });
  }

  if (!event) {
    return NextResponse.json({ received: true });
  }

  if (event.status !== "PAID") {
    if (event.status === "EXPIRED") {
      console.log(`\n🚀 [EVENT EXPIRED DETECTED] Processing expiration for tx: ${event.externalId}\n`);

      const [, transactionId] = event.externalId.includes(":")
        ? event.externalId.split(":")
        : [null, event.externalId];

      if (transactionId) {
        try {
          await prisma.transaction.update({
            where: { id: transactionId },
            data: { status: "EXPIRED" }
          });
          console.log(`✅ [PaymentWebhook] Successfully marked tx ${transactionId} as EXPIRED in DB`);
        } catch (err) {
          console.error(`❌ [PaymentWebhook] DB update failed for tx ${transactionId}:`, err);
        }
      }
    } else {
      console.log(`[PaymentWebhook] Received non-PAID/non-EXPIRED event: ${event.status}`);
    }
    return NextResponse.json({ received: true });
  }

  const [, transactionId] = event.externalId.includes(":")
    ? event.externalId.split(":")
    : [null, event.externalId];
  if (!transactionId) {
    return NextResponse.json({ error: "Malformed reference" }, { status: 400 });
  }

  const result = await confirmTopUp({ transactionId, gateway: toTopUpGateway(gateway.gatewayName) });

  return NextResponse.json({ received: true, result: result.status });
}
