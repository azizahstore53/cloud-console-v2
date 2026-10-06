import crypto from "crypto";
import type {
  PaymentGatewayAdapter,
  CreatePaymentInvoiceParams,
  PaymentInvoiceResult,
  WebhookPaymentEvent,
} from "../PaymentGatewayAdapter";

/**
 * DoitPaymentGateway
 * ---------------------------------------------------------------------------
 * Adapter for doit.id (from the IDCloudHost team) — an Indonesian payment
 * gateway supporting VA, QRIS, and bank transfer.
 *
 * ⚠️ IMPORTANT — read before using this in anything real:
 *
 * Unlike the IDCloudHost Cloud VPS adapter (built from their public,
 * search-indexed API reference), doit.id's full API documentation at
 * https://doit.id/docs/ was **not accessible to me** when writing this —
 * it didn't surface through web search, and fetching it directly requires
 * a URL that's already appeared in search results. What this file is built
 * from is only:
 *
 *   1. doit.id's public marketing homepage, which confirms: a single
 *      `POST /v1/payments` request creates a payment, authentication is a
 *      single `Authorization: Bearer <key>` header, and their base
 *      messaging says webhook delivery needs "no signature or timestamp."
 *   2. The webhook signing secret format you were issued (`whs_...`),
 *      which implies signature verification *is* available/expected for
 *      your account, seemingly in tension with point 1 above — possibly a
 *      newer feature, an opt-in, or specific to a compatibility mode
 *      (their homepage also mentions Xendit Invoice API and Duitku
 *      compatibility modes).
 *
 * I do not have confirmed answers for:
 *   - The exact request body field names for `POST /v1/payments`
 *     (this file's guesses — `amount`, `reference`, `description`,
 *     `payer_email`, `success_redirect_url`, `failure_redirect_url` — are
 *     reasonable, conventional names, not verified against a real schema).
 *   - The exact response shape (assumed: `id`, `payment_url` or
 *     `qr_content`, `status`, `expires_at` — again, reasonable guesses).
 *   - The exact webhook payload shape and which header carries the
 *     signature, and the precise algorithm/canonicalization used to
 *     compute it. `verifyWebhookSignature` below implements a
 *     conventional HMAC-SHA256-over-the-raw-body check as a starting
 *     point, but this is a best-effort placeholder, not a confirmed
 *     implementation — for a payment webhook, a signature check that's
 *     silently wrong is worse than not having tried, since it can create
 *     false confidence.
 *
 * Before using this for real payments: open https://doit.id/docs/ in your
 * own account (you're logged in; I'm not) and check the "Create Payment"
 * and "Webhooks" pages, then correct the field names, response parsing,
 * and signature logic below to match exactly. I'd rather hand you a
 * clearly-flagged scaffold than a confident-looking implementation built
 * on guesses for the part that moves money.
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
  payment_url?: string;
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

    const data = (await res.json()) as DoitCreatePaymentResponse;
    if (!res.ok || data.errors) {
      throw new Error(
        typeof data.errors === "string"
          ? data.errors
          : `doit.id payment creation failed (HTTP ${res.status})`
      );
    }

    return {
      id: data.id,
      invoiceUrl: data.payment_url ?? "",
      status: mapStatus(data.status),
      expiryDate: data.expires_at ? new Date(data.expires_at) : new Date(Date.now() + 24 * 60 * 60 * 1000),
    };
  }

  /**
   * ⚠️ Best-effort placeholder — see the file header. Verify the header
   * name and algorithm against your account's actual webhook docs before
   * trusting this in production; as written, an incorrect assumption here
   * would either reject every real webhook (safe but broken) or, if the
   * assumed algorithm happens to coincidentally validate malformed input,
   * could be misleading about what's actually being checked. Fails closed
   * (returns false) if the secret isn't configured or the header is missing,
   * rather than silently accepting unverified payloads.
   */
  verifyWebhookSignature(payload: string, signatureHeader: string): boolean {
    if (!this.config.webhookSecret || !signatureHeader) return false;

    const expected = crypto.createHmac("sha256", this.config.webhookSecret).update(payload).digest("hex");

    const provided = signatureHeader.trim();
    if (expected.length !== provided.length) return false;

    try {
      return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(provided));
    } catch {
      return false;
    }
  }

  /**
   * ⚠️ Best-effort placeholder — see the file header. Assumes a payload
   * shaped roughly like `{ event: "payment.paid", reference: "...",
   * status: "paid" }` (a conventional shape, chosen to match doit.id's
   * homepage description of firing "a webhook when a payment is paid"),
   * but the exact field names are not confirmed. Verify against a real
   * webhook payload from your sandbox account (trigger a test payment and
   * log the raw body) and correct the field names below.
   */
  parseWebhookPayload(rawBody: string): WebhookPaymentEvent | null {
    const payload = JSON.parse(rawBody) as {
      event?: string;
      reference?: string;
      external_id?: string;
      status?: string;
    };

    const externalId = payload.reference ?? payload.external_id;
    if (!externalId || !payload.status) return null;

    const status = payload.status.toLowerCase();
    return {
      externalId,
      status: status === "paid" || status === "success" ? "PAID" : status === "expired" ? "EXPIRED" : "FAILED",
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
