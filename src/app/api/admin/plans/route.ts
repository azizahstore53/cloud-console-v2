import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/lib/admin";
import { prisma } from "@/lib/prisma";

const planSchema = z.object({
  name: z.string().min(2).max(64),
  vcpu: z.number().int().min(1).max(128),
  ramMb: z.number().int().min(512),
  storageGb: z.number().int().min(5),
  pricePerHour: z.number().int().min(0),
  pricePerMonth: z.number().int().min(0),
});

export async function GET() {
  const guard = await requirePermission("catalog.manage");
  if (guard instanceof NextResponse) return guard;
  const plans = await prisma.instancePlan.findMany({ orderBy: { pricePerMonth: "asc" } });
  return NextResponse.json({ plans });
}

export async function POST(req: NextRequest) {
  const guard = await requirePermission("catalog.manage");
  if (guard instanceof NextResponse) return guard;

  const parsed = planSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid payload", issues: parsed.error.flatten() }, { status: 400 });

  const plan = await prisma.instancePlan.create({ data: parsed.data });
  return NextResponse.json({ plan }, { status: 201 });
}
