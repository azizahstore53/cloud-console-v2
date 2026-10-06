import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/lib/admin";
import { prisma } from "@/lib/prisma";

const updateSchema = z.object({
  title: z.string().min(4).max(200).optional(),
  excerpt: z.string().min(4).max(500).optional(),
  content: z.string().min(20).optional(),
  coverImageUrl: z.string().url().optional().or(z.literal("")),
  status: z.enum(["DRAFT", "PUBLISHED"]).optional(),
});

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requirePermission("news.manage");
  if (guard instanceof NextResponse) return guard;

  const article = await prisma.news.findUnique({ where: { id: params.id } });
  if (!article) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ article });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requirePermission("news.manage");
  if (guard instanceof NextResponse) return guard;

  const parsed = updateSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload", issues: parsed.error.flatten() }, { status: 400 });
  }

  const existing = await prisma.news.findUnique({ where: { id: params.id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { status, coverImageUrl, ...rest } = parsed.data;
  const article = await prisma.news.update({
    where: { id: params.id },
    data: {
      ...rest,
      ...(coverImageUrl !== undefined ? { coverImageUrl: coverImageUrl || null } : {}),
      ...(status ? { status } : {}),
      // Stamp publishedAt the first time an article transitions to
      // PUBLISHED; never move it back to null on a later edit, and never
      // bump it again if it's re-saved while already published.
      ...(status === "PUBLISHED" && !existing.publishedAt ? { publishedAt: new Date() } : {}),
    },
  });

  return NextResponse.json({ article });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requirePermission("news.manage");
  if (guard instanceof NextResponse) return guard;

  await prisma.news.deleteMany({ where: { id: params.id } });
  return NextResponse.json({ success: true });
}
