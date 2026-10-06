import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/lib/admin";
import { prisma } from "@/lib/prisma";

const updateSchema = z.object({
  name: z.string().min(2).max(64).optional(),
  vcpu: z.number().int().min(1).max(128).optional(),
  ramMb: z.number().int().min(512).optional(),
  storageGb: z.number().int().min(5).optional(),
  pricePerHour: z.number().int().min(0).optional(),
  pricePerMonth: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requirePermission("catalog.manage");
  if (guard instanceof NextResponse) return guard;

  const parsed = updateSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid payload" }, { status: 400 });

  const plan = await prisma.instancePlan.update({ where: { id: params.id }, data: parsed.data });
  return NextResponse.json({ plan });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requirePermission("catalog.manage");
  if (guard instanceof NextResponse) return guard;

  // Soft-delete: plans referenced by existing instances can't be hard-deleted
  // without breaking FK constraints, so we deactivate instead.
  const inUse = await prisma.instance.count({ where: { planId: params.id } });
  if (inUse > 0) {
    const plan = await prisma.instancePlan.update({ where: { id: params.id }, data: { isActive: false } });
    return NextResponse.json({ plan, note: "Plan is in use by existing instances — deactivated instead of deleted." });
  }

  await prisma.instancePlan.delete({ where: { id: params.id } });
  return NextResponse.json({ success: true });
}
