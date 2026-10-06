import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/admin";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const guard = await requirePermission("billing.manage");
  if (guard instanceof NextResponse) return guard;

  const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

  const [
    totalUsers,
    activeUsers,
    totalInstances,
    runningInstances,
    totalDeployments,
    walletTotals,
    monthRevenue,
    recentUsers,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { isActive: true } }),
    prisma.instance.count(),
    prisma.instance.count({ where: { status: "RUNNING" } }),
    prisma.deployment.count(),
    prisma.user.aggregate({ _sum: { balance: true } }),
    prisma.transaction.aggregate({
      where: { type: "TOPUP", status: "SUCCESS", createdAt: { gte: startOfMonth } },
      _sum: { amount: true },
    }),
    prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, name: true, email: true, createdAt: true, role: true },
    }),
  ]);

  return NextResponse.json({
    totalUsers,
    activeUsers,
    totalInstances,
    runningInstances,
    totalDeployments,
    totalWalletLiability: walletTotals._sum.balance ?? 0,
    monthRevenue: monthRevenue._sum.amount ?? 0,
    recentUsers,
  });
}
