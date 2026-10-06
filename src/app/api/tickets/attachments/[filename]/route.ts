import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/permissions";
import { readAttachment } from "@/lib/support/ticketAttachments";

/**
 * Serves one attachment, after checking the requester actually has a
 * legitimate reason to see it. This is the real access-control boundary
 * for attachments — the file itself lives outside `public/` specifically
 * so this check can never be bypassed by requesting it directly.
 */
export async function GET(_req: NextRequest, { params }: { params: { filename: string } }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const message = await prisma.ticketMessage.findFirst({
    where: { imageUrl: params.filename },
    select: { ticket: { select: { customerId: true } } },
  });
  // Same 404 whether the file doesn't exist or the requester just isn't
  // allowed to see it — not distinguishing the two avoids confirming to a
  // guesser that a given filename is valid but merely forbidden.
  if (!message) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const isOwner = message.ticket.customerId === session.user.id;
  const isStaff = hasPermission(session.user.role, "tickets.manage");
  if (!isOwner && !isStaff) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const file = await readAttachment(params.filename);
  if (!file) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return new NextResponse(new Uint8Array(file.buffer), {
    headers: {
      "Content-Type": file.mime,
      // Private: a browser/proxy cache must re-check auth each time, not
      // serve a cached copy to a different, unauthorized user later.
      "Cache-Control": "private, max-age=31536000, immutable",
    },
  });
}
