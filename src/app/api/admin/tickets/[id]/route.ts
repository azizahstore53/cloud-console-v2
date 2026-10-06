import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/lib/admin";
import { getStaffTicket, setStaffTicketStatus, assignTicket } from "@/lib/support/ticketService";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requirePermission("tickets.manage");
  if (guard instanceof NextResponse) return guard;

  const ticket = await getStaffTicket(params.id);
  if (!ticket) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ticket });
}

const patchSchema = z.object({
  status: z.enum(["OPEN", "PENDING", "RESOLVED"]).optional(),
  // "me" claims the ticket for the caller; null releases it. A staff member
  // can't assign a ticket to somebody else's id through this endpoint.
  assignedTo: z.union([z.literal("me"), z.null()]).optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requirePermission("tickets.manage");
  if (guard instanceof NextResponse) return guard;
  const { session } = guard;

  const parsed = patchSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  const { status, assignedTo } = parsed.data;

  if (status) {
    const result = await setStaffTicketStatus(
      params.id,
      session.user.id,
      session.user.name ?? session.user.email ?? "staff",
      status
    );
    if (!result) return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (assignedTo !== undefined) {
    const result = await assignTicket(params.id, assignedTo === "me" ? session.user.id : null);
    if (!result) return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
