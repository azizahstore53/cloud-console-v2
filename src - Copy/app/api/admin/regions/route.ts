import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/lib/admin";
import { prisma } from "@/lib/prisma";

const regionSchema = z.object({
  code: z.string().min(2).max(32),
  name: z.string().min(2).max(64),
  country: z.string().min(2).max(64),
});

export async function GET() {
  const guard = await requirePermission("catalog.manage");
  if (guard instanceof NextResponse) return guard;
  const regions = await prisma.region.findMany({ orderBy: { name: "asc" } });
  return NextResponse.json({ regions });
}

export async function POST(req: NextRequest) {
  const guard = await requirePermission("catalog.manage");
  if (guard instanceof NextResponse) return guard;

  const parsed = regionSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid payload", issues: parsed.error.flatten() }, { status: 400 });

  const existing = await prisma.region.findUnique({ where: { code: parsed.data.code } });
  if (existing) return NextResponse.json({ error: "Region code already exists" }, { status: 409 });

  const region = await prisma.region.create({ data: parsed.data });
  return NextResponse.json({ region }, { status: 201 });
}
