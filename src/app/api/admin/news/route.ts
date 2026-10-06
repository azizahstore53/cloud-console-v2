import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { createNewsDraft } from "@/lib/news/newsService";

const createSchema = z.object({
  title: z.string().min(4).max(200),
  excerpt: z.string().min(4).max(500),
  content: z.string().min(20),
  coverImageUrl: z.string().url().optional().or(z.literal("")),
});

export async function GET() {
  const guard = await requirePermission("news.manage");
  if (guard instanceof NextResponse) return guard;

  const news = await prisma.news.findMany({ orderBy: { createdAt: "desc" } });
  return NextResponse.json({ news });
}

export async function POST(req: NextRequest) {
  const guard = await requirePermission("news.manage");
  if (guard instanceof NextResponse) return guard;

  const parsed = createSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload", issues: parsed.error.flatten() }, { status: 400 });
  }

  const article = await createNewsDraft({
    title: parsed.data.title,
    excerpt: parsed.data.excerpt,
    content: parsed.data.content,
    coverImageUrl: parsed.data.coverImageUrl || undefined,
    source: "MANUAL",
  });

  return NextResponse.json({ article }, { status: 201 });
}
