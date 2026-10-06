import { NextRequest, NextResponse } from "next/server";
import { getPaymentGateway } from "@/lib/payment/PaymentGatewayAdapter";
import { confirmTopUp, toTopUpGateway } from "@/lib/billing/calculator";

/**
 * Real payment gateway webhook endpoint. Point your gateway's callback URL
 * at: POST /api/webhooks/payment
 *
 * Signature verification and payload parsing are both delegated to the
 * active `PaymentGatewayAdapter` (see `verifyWebhookSignature` and
 * `parseWebhookPayload`) — this route doesn't hardcode any one gateway's
 * header names or payload shape, since that varies per provider.
 *
 * The signature header name itself is configurable via
 * `PAYMENT_WEBHOOK_SIGNATURE_HEADER` (defaults cover Xendit's
 * `x-callback-token`) because it varies by gateway and, for doit.id
 * specifically, is not yet confirmed — see
 * `src/lib/payment/providers/DoitPaymentGateway.ts` for why.
 *
 * Idempotency: gateways retry webhook deliveries (duplicate calls for the
 * same event are expected, not exceptional), and two retries can arrive
 * concurrently. `confirmTopUp` handles this at the database level — it
 * atomically claims the PENDING transaction exactly once, so a duplicate
 * delivery here is always a safe no-op rather than a double credit. It
 * also always uses the amount recorded when the top-up was originally
 * requested, never anything from this payload, so a forged or malformed
 * webhook body can't be used to credit an arbitrary amount.
 */

export async function POST(req: NextRequest) {
  const rawBody = await req.text();

  const signatureHeaderName = process.env.PAYMENT_WEBHOOK_SIGNATURE_HEADER ?? "x-callback-token";
  const signature =
    req.headers.get(signatureHeaderName) ??
    req.headers.get("x-signature") ??
    req.headers.get("x-callback-token") ??
    "";

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
    // Not a payment event this route cares about — acknowledge and skip.
    return NextResponse.json({ received: true });
  }
  if (event.status !== "PAID") {
    return NextResponse.json({ received: true });
  }

  const [, transactionId] = event.externalId.includes(":")
    ? event.externalId.split(":")
    : [null, event.externalId];
  if (!transactionId) {
    return NextResponse.json({ error: "Malformed reference" }, { status: 400 });
  }

  const result = await confirmTopUp({ transactionId, gateway: toTopUpGateway(gateway.gatewayName) });

  // Always acknowledge with 200 once the signature and payload are valid —
  // "not_found" or "already_processed" aren't failures from the gateway's
  // point of view, and returning an error here would just trigger more
  // retries for something that isn't going to resolve differently.
  return NextResponse.json({ received: true, result: result.status });
}
