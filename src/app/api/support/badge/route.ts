import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { getBadgeCounts } from "@/lib/support/ticketService";

// Polled by the sidebar and the admin tab bar (see useSupportBadge).
export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const counts = await getBadgeCounts(session.user.id, hasPermission(session.user.role, "tickets.manage"));
  return NextResponse.json(counts);
}
