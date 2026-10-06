import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { createTicket, listCustomerTickets } from "@/lib/support/ticketService";
import { notifyStaffOfCustomerMessage } from "@/lib/support/ticketNotifications";
import { ticketCreateRateLimiter } from "@/lib/support/ticketRateLimiters";

const createSchema = z.object({
  subject: z.string().trim().min(4).max(120),
  body: z.string().trim().min(1).max(5000),
  relatedInstanceId: z.string().min(1).max(64).optional().nullable(),
});

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const tickets = await listCustomerTickets(session.user.id);
  return NextResponse.json({ tickets });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!ticketCreateRateLimiter.check(session.user.id).success) {
    return NextResponse.json({ error: "Terlalu banyak tiket dibuat. Coba lagi nanti." }, { status: 429 });
  }

  const parsed = createSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid payload" }, { status: 400 });

  const result = await createTicket({ customerId: session.user.id, ...parsed.data });
  if ("error" in result) return NextResponse.json({ error: "Instance not found" }, { status: 404 });

  await notifyStaffOfCustomerMessage(result.ticket.id);

  return NextResponse.json({ ticket: result.ticket }, { status: 201 });
}
