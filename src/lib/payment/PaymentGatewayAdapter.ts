/**
 * PaymentGatewayAdapter
 * ---------------------------------------------------------------------------
 * Same adapter pattern as CloudProviderAdapter, applied to payment gateways.
 * The mock implementation mirrors Xendit's Invoice API request/response
 * shape so swapping in the real SDK later is a drop-in replacement.
 */

import crypto from "crypto";
import { DoitPaymentGateway } from "./providers/DoitPaymentGateway";

export interface CreatePaymentInvoiceParams {
  externalId: string; // our internal reference, e.g. topup:<transactionId>
  amount: number;
  payerEmail: string;
  description: string;
  successRedirectUrl?: string;
  failureRedirectUrl?: string;
}

export interface PaymentInvoiceResult {
  id: string;
  invoiceUrl: string; // hosted checkout page URL
  status: "PENDING" | "PAID" | "EXPIRED";
  expiryDate: Date;
}

export interface PaymentStatusResult {
  status: "PENDING" | "PAID" | "EXPIRED";
  paidAt?: Date;
}

export interface WebhookPaymentEvent {
  /** Our internal reference — whatever was passed as `externalId` to createInvoice. */
  externalId: string;
  status: "PAID" | "EXPIRED" | "FAILED";
}

export interface PaymentGatewayAdapter {
  readonly gatewayName: string;
  createInvoice(params: CreatePaymentInvoiceParams): Promise<PaymentInvoiceResult>;
  verifyWebhookSignature(payload: string, signatureHeader: string): boolean;
  /**
   * Normalizes a gateway's own webhook payload shape into a common event.
   * Each gateway names its fields differently (Xendit: `external_id`/
   * `status`; others vary) — centralizing this in the adapter means the
   * webhook route itself never needs to know which gateway is active.
   * Return `null` for events the route should acknowledge but ignore
   * (e.g. a non-payment event type).
   */
  parseWebhookPayload(rawBody: string): WebhookPaymentEvent | null;
}

class MockPaymentGateway implements PaymentGatewayAdapter {
  readonly gatewayName = "mock";

  async createInvoice(params: CreatePaymentInvoiceParams): Promise<PaymentInvoiceResult> {
    const id = `mock-inv-${crypto.randomUUID()}`;
    // externalId is namespaced like "topup:<transactionId>" (mirroring how
    // a real gateway's external_id is used in the webhook handler) — the
    // mock checkout page only needs the bare transaction id, since it
    // calls our own confirm endpoint directly rather than going through a
    // webhook.
    const transactionId = params.externalId.includes(":")
      ? params.externalId.split(":")[1]
      : params.externalId;

    return {
      id,
      // Points at our own mock checkout page — see
      // /app/(dashboard)/billing/mock-checkout
      invoiceUrl: `/billing/mock-checkout?ref=${encodeURIComponent(transactionId)}&amount=${params.amount}`,
      status: "PENDING",
      expiryDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
    };
  }

  verifyWebhookSignature(): boolean {
    // Mock always accepts — replace with real HMAC verification per gateway docs:
    // Xendit: x-callback-token header comparison
    // Midtrans: SHA512(order_id+status_code+gross_amount+server_key)
    return true;
  }

  parseWebhookPayload(rawBody: string): WebhookPaymentEvent | null {
    const payload = JSON.parse(rawBody) as { external_id?: string; status?: string };
    if (!payload.external_id || !payload.status) return null;
    return {
      externalId: payload.external_id,
      status: payload.status === "PAID" ? "PAID" : payload.status === "EXPIRED" ? "EXPIRED" : "FAILED",
    };
  }
}

let cached: PaymentGatewayAdapter | null = null;

export function getPaymentGateway(): PaymentGatewayAdapter {
  if (cached) return cached;
  const key = process.env.PAYMENT_GATEWAY ?? "mock";
  switch (key) {
    case "doit":
      const secret = process.env.DOIT_WEBHOOK_SECRET;
      if (!secret) {
        console.warn(
          "⚠️ [PaymentGateway] DOIT_WEBHOOK_SECRET is not set in environment variables. " +
          "Webhook signatures will fail, and payments won't be automatically confirmed."
        );
      }
      cached = new DoitPaymentGateway({
        apiKey: process.env.DOIT_API_KEY ?? "",
        webhookSecret: secret || undefined,
      });
      break;
    case "mock":
    default:
      cached = new MockPaymentGateway();
  }
  return cached;
}
