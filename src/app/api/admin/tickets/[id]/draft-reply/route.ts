import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/admin";
import { getStaffTicket } from "@/lib/support/ticketService";
import { ticketAiDraftRateLimiter } from "@/lib/support/ticketRateLimiters";
import { generateTicketReplyDraft } from "@/lib/ai/groqClient";

const AUTHOR_LABEL = { CUSTOMER: "Pelanggan", STAFF: "Staff", SYSTEM: "Sistem" } as const;

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requirePermission("tickets.manage");
  if (guard instanceof NextResponse) return guard;
  const { session } = guard;

  if (!ticketAiDraftRateLimiter.check(session.user.id).success) {
    return NextResponse.json({ error: "Terlalu banyak draf AI dibuat. Coba lagi nanti." }, { status: 429 });
  }

  const ticket = await getStaffTicket(params.id);
  if (!ticket) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const lastMessage = ticket.messages[ticket.messages.length - 1];
  if (!lastMessage || lastMessage.senderType !== "CUSTOMER") {
    return NextResponse.json(
      { error: "Draf AI hanya tersedia saat pesan terakhir berasal dari pelanggan." },
      { status: 400 }
    );
  }

  try {
    const draft = await generateTicketReplyDraft({
      subject: ticket.subject,
      relatedInstance: ticket.relatedInstance
        ? {
            name: ticket.relatedInstance.name,
            status: ticket.relatedInstance.status,
            plan: ticket.relatedInstance.plan?.name,
            region: ticket.relatedInstance.region?.name,
          }
        : null,
      // Cap at the most recent messages: enough context for a coherent
      // reply without letting a very long-running ticket blow past Groq's
      // context window or slow the draft down for no benefit.
      transcript: ticket.messages.slice(-20).map((m: { senderType: keyof typeof AUTHOR_LABEL; body: string }) => ({
        author: AUTHOR_LABEL[m.senderType],
        body: m.body,
      })),
    });

    return NextResponse.json({ draft });
  } catch (err) {
    console.error("[draft-reply] Groq call failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Gagal membuat draf AI." },
      { status: 502 }
    );
  }
}
