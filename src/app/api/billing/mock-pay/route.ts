import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { confirmTopUp } from "@/lib/billing/calculator";

const schema = z.object({ transactionId: z.string().min(1) });

// Simulates a payment gateway webhook firing after the user "pays" on the
// mock checkout page. A real integration would instead verify a signed
// webhook from Xendit/Midtrans in `src/app/api/webhooks/payment`.
//
// Deliberately does NOT accept an `amount` from the client — the amount
// charged is whatever was recorded when the top-up was originally
// requested (POST /api/billing/topup). Trusting a client-supplied amount
// here would let anyone credit their wallet with any number they like.
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid payload" }, { status: 400 });

  const result = await confirmTopUp({
    transactionId: parsed.data.transactionId,
    gateway: "XENDIT",
    expectedUserId: session.user.id,
  });

  switch (result.status) {
    case "not_found":
      return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
    case "forbidden":
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    case "already_processed":
      // Idempotent no-op — a double-click or retry lands here harmlessly.
      return NextResponse.json({ alreadyProcessed: true });
    case "confirmed":
      return NextResponse.json({ balanceAfter: result.balanceAfter, amount: result.amount });
  }
}
