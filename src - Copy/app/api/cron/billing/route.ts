import { NextRequest, NextResponse } from "next/server";
import { runHourlyBillingCycle } from "@/lib/billing/usageBillingJob";

/**
 * Hourly usage billing trigger, meant to be called by an external
 * scheduler (system crontab via curl, a hosted cron service like
 * cron-job.org, a GitHub Actions scheduled workflow, or Vercel Cron if
 * ever deployed there) rather than by users of the app.
 *
 * Auth: shared secret via `Authorization: Bearer <CRON_SECRET>` header, or
 * a `?secret=<CRON_SECRET>` query param for schedulers that can't set
 * custom headers. Requests without a valid secret are rejected — this
 * endpoint moves money, so it must not be publicly callable.
 *
 * If you're deploying as a single long-running process on a VPS (the
 * straightforward path for this app), prefer `scripts/run-billing-cycle.ts`
 * via system crontab instead — it calls the same job directly against the
 * database with no HTTP round trip or exposed endpoint at all. This route
 * exists for deployments where only HTTP-reachable cron is available.
 */
function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false; // never allow an unconfigured secret to mean "open to everyone"

  const authHeader = req.headers.get("authorization");
  if (authHeader === `Bearer ${secret}`) return true;

  const querySecret = req.nextUrl.searchParams.get("secret");
  if (querySecret === secret) return true;

  return false;
}

async function handle(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const summary = await runHourlyBillingCycle();
  return NextResponse.json(summary);
}

export async function POST(req: NextRequest) {
  return handle(req);
}

export async function GET(req: NextRequest) {
  return handle(req);
}
