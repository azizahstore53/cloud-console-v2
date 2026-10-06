import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/lib/admin";
import { prisma } from "@/lib/prisma";

const updateSchema = z.object({
  name: z.string().min(2).max(64).optional(),
  country: z.string().min(2).max(64).optional(),
  isActive: z.boolean().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requirePermission("catalog.manage");
  if (guard instanceof NextResponse) return guard;

  const parsed = updateSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid payload" }, { status: 400 });

  const region = await prisma.region.update({ where: { id: params.id }, data: parsed.data });
  return NextResponse.json({ region });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requirePermission("catalog.manage");
  if (guard instanceof NextResponse) return guard;

  const inUse = await prisma.instance.count({ where: { regionId: params.id } });
  if (inUse > 0) {
    const region = await prisma.region.update({ where: { id: params.id }, data: { isActive: false } });
    return NextResponse.json({ region, note: "Region is in use by existing instances — deactivated instead of deleted." });
  }

  await prisma.region.delete({ where: { id: params.id } });
  return NextResponse.json({ success: true });
}
