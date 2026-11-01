import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/admin";
import { runHourlyBillingCycle } from "@/lib/billing/usageBillingJob";

export async function POST(_req: NextRequest) {
  const guard = await requirePermission("billing.manage");
  if (guard instanceof NextResponse) return guard;

  try {
    const result = await runHourlyBillingCycle();
    return NextResponse.json({
      success: true,
      message: "Billing cycle completed successfully",
      result
    });
  } catch (error) {
    console.error("[Admin Billing Run Error]:", error);
    return NextResponse.json({
      error: "Internal server error during billing cycle",
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
