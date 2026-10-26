import crypto from "crypto";
import type {
  PaymentGatewayAdapter,
  CreatePaymentInvoiceParams,
  PaymentInvoiceResult,
  PaymentStatusResult,
  WebhookPaymentEvent,
} from "../PaymentGatewayAdapter";

/**
 * DoitPaymentGateway
 * ---------------------------------------------------------------------------
 * Adapter for doit.id (from the IDCloudHost team) — an Indonesian payment
 * gateway supporting VA, QRIS, and bank transfer.
 */

const API_BASE = "https://pay.doit.id/v1";

interface DoitConfig {
  apiKey: string; // pb_test_xxx / pb_live_xxx from the doit.id dashboard
  webhookSecret?: string; // whs_xxx — only needed if you use verifyWebhookSignature
}

interface DoitCreatePaymentResponse {
  id: string;
  status: string;
  amount: number;
  hosted_url?: string;
  qr_content?: string;
  expires_at?: string;
  errors?: unknown;
}

export class DoitPaymentGateway implements PaymentGatewayAdapter {
  readonly gatewayName = "doit";
  private config: DoitConfig;

  constructor(config: DoitConfig) {
    if (!config.apiKey) {
      throw new Error("DoitPaymentGateway requires DOIT_API_KEY to be set.");
    }
    this.config = config;
  }

  async createInvoice(params: CreatePaymentInvoiceParams): Promise<PaymentInvoiceResult> {
    const res = await fetch(`${API_BASE}/payments`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.config.apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": params.externalId,
      },
      body: JSON.stringify({
        amount: params.amount,
        reference: params.externalId,
        description: params.description,
        payer_email: params.payerEmail,
        success_redirect_url: params.successRedirectUrl,
        failure_redirect_url: params.failureRedirectUrl,
      }),
    });

    const text = await res.text();
    console.log("[DoitPaymentGateway] API Response:", text);

    let data;
    try {
      data = JSON.parse(text) as DoitCreatePaymentResponse;
    } catch (e) {
      throw new Error(`doit.id returned non-JSON response: ${text}`);
    }

    if (!res.ok || data.errors) {
      throw new Error(
        typeof data.errors === "string"
          ? data.errors
          : `doit.id payment creation failed (HTTP ${res.status}): ${text}`
      );
    }

    return {
      id: data.id,
      invoiceUrl: data.hosted_url ?? "",
      status: mapStatus(data.status),
      expiryDate: data.expires_at ? new Date(data.expires_at) : new Date(Date.now() + 24 * 60 * 60 * 1000),
    };
  }

  async getPaymentStatus(paymentId: string): Promise<PaymentStatusResult> {
    const res = await fetch(`${API_BASE}/payments/${paymentId}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${this.config.apiKey}`,
        "Content-Type": "application/json",
      },
    });

    const text = await res.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      throw new Error(`doit.id returned non-JSON response: ${text}`);
    }

    if (!res.ok) {
      throw new Error(`doit.id status fetch failed (HTTP ${res.status}): ${text}`);
    }

    return {
      status: mapStatus(data.status),
      paidAt: data.paid_at ? new Date(data.paid_at) : undefined,
    };
  }

  verifyWebhookSignature(payload: string, signatureHeader: string): boolean {
    if (!this.config.webhookSecret || !signatureHeader) return false;

    // Format: "t=1792866257,v1=917f8f..."
    const parts = signatureHeader.split(",");
    const timestampPart = parts.find(p => p.startsWith("t="));
    const v1Part = parts.find(p => p.startsWith("v1="));

    if (!timestampPart || !v1Part) return false;

    const timestamp = timestampPart.split("=")[1];
    const providedSignature = v1Part.split("=")[1];
    if (!timestamp || !providedSignature) return false;

    // PayBridge/Stripe style: HMAC(secret, timestamp + "." + rawBody)
    const signedPayload = `${timestamp}.${payload}`;
    const expected = crypto.createHmac("sha256", this.config.webhookSecret).update(signedPayload).digest("hex");

    try {
      return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(providedSignature));
    } catch {
      return false;
    }
  }

  parseWebhookPayload(rawBody: string): WebhookPaymentEvent | null {
    const payload = JSON.parse(rawBody) as {
      type?: string;
      data?: {
        reference?: string;
        external_id?: string;
        status?: string;
        [key: string]: any;
      };
    };

    const data = payload.data;
    if (!data) return null;

    const externalId = data.reference ?? data.external_id;
    const status = data.status;

    if (!externalId || !status) return null;

    const normalizedStatus = status.toLowerCase();
    return {
      externalId,
      status: normalizedStatus === "paid" || normalizedStatus === "success" ? "PAID" : normalizedStatus === "expired" ? "EXPIRED" : "FAILED",
    };
  }
}

function mapStatus(raw: string): "PENDING" | "PAID" | "EXPIRED" {
  switch (raw?.toLowerCase()) {
    case "paid":
    case "success":
    case "completed":
      return "PAID";
    case "expired":
    case "failed":
      return "EXPIRED";
    default:
      return "PENDING";
  }
}
