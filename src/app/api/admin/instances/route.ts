import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/admin";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const guard = await requirePermission("instances.manage");
  if (guard instanceof NextResponse) return guard;

  const instances = await prisma.instance.findMany({
    include: {
      plan: true,
      region: true,
      user: { select: { id: true, name: true, email: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return NextResponse.json({ instances });
}
