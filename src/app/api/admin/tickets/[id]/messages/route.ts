import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/lib/admin";
import { addStaffMessage } from "@/lib/support/ticketService";
import { notifyCustomerOfStaffReply } from "@/lib/support/ticketNotifications";
import { ticketMessageRateLimiter } from "@/lib/support/ticketRateLimiters";

const schema = z.object({ body: z.string().trim().min(1).max(5000) });

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requirePermission("tickets.manage");
  if (guard instanceof NextResponse) return guard;
  const { session } = guard;

  if (!ticketMessageRateLimiter.check(session.user.id).success) {
    return NextResponse.json({ error: "Terlalu cepat. Tunggu sebentar sebelum mengirim lagi." }, { status: 429 });
  }

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid payload" }, { status: 400 });

  const message = await addStaffMessage(params.id, session.user.id, parsed.data.body);
  if (!message) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await notifyCustomerOfStaffReply(params.id);

  return NextResponse.json({ message }, { status: 201 });
}
