import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/admin";
import { runHourlyBillingCycle } from "@/lib/billing/usageBillingJob";

/**
 * Manually triggers the hourly usage billing cycle. Meant for admins to
 * test/demo billing without waiting for the real cron schedule, and as a
 * manual catch-up option if the scheduled job was down for a while.
 */
export async function POST() {
  const guard = await requirePermission("billing.manage");
  if (guard instanceof NextResponse) return guard;

  const summary = await runHourlyBillingCycle();
  return NextResponse.json(summary);
}
