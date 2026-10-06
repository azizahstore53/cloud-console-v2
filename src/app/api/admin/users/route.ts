import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/admin";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const guard = await requirePermission("users.manage");
  if (guard instanceof NextResponse) return guard;

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      balance: true,
      isActive: true,
      createdAt: true,
      _count: { select: { instances: true } },
    },
  });

  return NextResponse.json({ users });
}
