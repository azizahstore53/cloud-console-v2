import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/admin";
import { listStaffTickets, type StaffTicketFilter } from "@/lib/support/ticketService";

const FILTERS: StaffTicketFilter[] = ["OPEN", "PENDING", "RESOLVED", "ALL"];

export async function GET(req: NextRequest) {
  const guard = await requirePermission("tickets.manage");
  if (guard instanceof NextResponse) return guard;

  const requested = req.nextUrl.searchParams.get("status") ?? "OPEN";
  const filter = FILTERS.includes(requested as StaffTicketFilter) ? (requested as StaffTicketFilter) : "OPEN";

  const tickets = await listStaffTickets(filter);
  return NextResponse.json({ tickets });
}
