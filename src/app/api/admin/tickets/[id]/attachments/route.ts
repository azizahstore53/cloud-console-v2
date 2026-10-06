import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/admin";
import { addStaffMessage } from "@/lib/support/ticketService";
import { ticketAttachmentRateLimiter } from "@/lib/support/ticketRateLimiters";
import { saveAttachment, MAX_ATTACHMENT_BYTES } from "@/lib/support/ticketAttachments";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requirePermission("tickets.manage");
  if (guard instanceof NextResponse) return guard;
  const { session } = guard;

  if (!ticketAttachmentRateLimiter.check(session.user.id).success) {
    return NextResponse.json({ error: "Terlalu banyak unggahan. Coba lagi nanti." }, { status: 429 });
  }

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "Tidak ada file yang dikirim." }, { status: 400 });
  }
  if (file.size > MAX_ATTACHMENT_BYTES) {
    return NextResponse.json({ error: "Ukuran gambar maksimal 5MB." }, { status: 400 });
  }

  const caption = String(form?.get("caption") ?? "").slice(0, 2000);
  const buffer = Buffer.from(await file.arrayBuffer());

  let saved;
  try {
    saved = await saveAttachment(buffer);
  } catch (err) {
    const reason = err instanceof Error ? err.message : "unknown";
    const message = reason === "too_large" ? "Ukuran gambar maksimal 5MB." : "Format tidak didukung. Gunakan PNG, JPG, GIF, atau WebP.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const message = await addStaffMessage(params.id, session.user.id, caption, {
    imageUrl: saved.filename,
    imageName: file.name.slice(0, 255),
  });
  if (!message) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ message }, { status: 201 });
}
