import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { hasPermission, isStaff } from "@/lib/permissions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatsCard } from "@/components/dashboard/StatsCard";
import { formatCurrency } from "@/lib/billing/calculator";
import { timeAgo } from "@/lib/utils";
import { Users, Server, Wallet, Rocket } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { RunBillingCycleButton } from "@/components/admin/RunBillingCycleButton";

export default async function AdminOverviewPage() {
  const session = await auth();
  const canSeeBilling = hasPermission(session!.user.role, "billing.manage");
  const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

  const [
    totalUsers,
    totalInstances,
    runningInstances,
    totalDeployments,
    walletTotals,
    monthRevenue,
    recentUsers,
  ] = await Promise.all([
    prisma.user.count(),
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
      take: 6,
      select: { id: true, name: true, email: true, createdAt: true, role: true },
    }),
  ]);

  return (
    <div className="space-y-6">
      {canSeeBilling && (
        <div className="flex justify-end">
          <RunBillingCycleButton />
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatsCard label="Total Users" value={String(totalUsers)} icon={Users} />
        <StatsCard label="Running Instances" value={`${runningInstances} / ${totalInstances}`} icon={Server} />
        {canSeeBilling && (
          <>
            <StatsCard label="Wallet Liability" value={formatCurrency(walletTotals._sum.balance ?? 0)} icon={Wallet} />
            <StatsCard label="Revenue This Month" value={formatCurrency(monthRevenue._sum.amount ?? 0)} icon={Rocket} />
          </>
        )}
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Recently Registered Users</CardTitle></CardHeader>
        <CardContent className="p-0 divide-y">
          {recentUsers.map((u) => (
            <div key={u.id} className="flex items-center justify-between p-4">
              <div>
                <p className="text-sm font-medium">{u.name ?? "—"}</p>
                <p className="text-xs text-muted-foreground">{u.email}</p>
              </div>
              <div className="flex items-center gap-3">
                <Badge variant={u.role === "SUPER_ADMIN" || u.role === "ADMIN" ? "default" : isStaff(u.role) ? "secondary" : "outline"}>{u.role}</Badge>
                <span className="text-xs text-muted-foreground">{timeAgo(u.createdAt)}</span>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
