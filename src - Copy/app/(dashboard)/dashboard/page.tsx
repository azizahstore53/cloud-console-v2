import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { StatsCard } from "@/components/dashboard/StatsCard";
import { InstanceStatusBadge } from "@/components/compute/InstanceStatusBadge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/billing/calculator";
import { timeAgo } from "@/lib/utils";
import { Server, Wallet, Rocket, Activity, Plus, ArrowRight } from "lucide-react";

export default async function DashboardPage() {
  const session = await auth();
  const userId = session!.user.id;

  const [user, instances, deployments, recentActivity, monthSpend] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: userId } }),
    prisma.instance.findMany({
      where: { userId },
      include: { plan: true, region: true },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    prisma.deployment.count({ where: { userId, status: { in: ["RUNNING", "DEPLOYING"] } } }),
    prisma.activityLog.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 6 }),
    prisma.transaction.aggregate({
      where: {
        userId,
        type: "USAGE_CHARGE",
        createdAt: { gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) },
      },
      _sum: { amount: true },
    }),
  ]);

  const runningCount = instances.filter((i) => i.status === "RUNNING").length;
  const totalCount = await prisma.instance.count({ where: { userId } });
  const spend = Math.abs(monthSpend._sum.amount ?? 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Welcome back, {user.name?.split(" ")[0] ?? "there"}</h1>
          <p className="text-muted-foreground text-sm mt-1">Here's what's happening across your resources today.</p>
        </div>
        <Link href="/compute/new">
          <Button className="gap-2">
            <Plus className="h-4 w-4" /> New Instance
          </Button>
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatsCard label="Running Instances" value={`${runningCount} / ${totalCount}`} icon={Server} />
        <StatsCard label="Wallet Balance" value={formatCurrency(user.balance, user.currency)} icon={Wallet} />
        <StatsCard label="Spent This Month" value={formatCurrency(spend, user.currency)} icon={Activity} />
        <StatsCard label="Active Deployments" value={String(deployments)} icon={Rocket} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Recent Instances</CardTitle>
            <Link href="/compute" className="text-sm text-primary flex items-center gap-1 hover:underline">
              View all <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </CardHeader>
          <CardContent className="space-y-1">
            {instances.length === 0 && (
              <div className="text-center py-10 text-muted-foreground text-sm">
                No instances yet.{" "}
                <Link href="/compute/new" className="text-primary hover:underline">
                  Launch your first VPS
                </Link>
              </div>
            )}
            {instances.map((instance) => (
              <Link
                key={instance.id}
                href={`/compute/${instance.id}`}
                className="flex items-center justify-between rounded-lg px-3 py-3 hover:bg-accent transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Server className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{instance.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {instance.plan.vcpu} vCPU · {instance.plan.ramMb / 1024}GB RAM · {instance.region.name}
                    </p>
                  </div>
                </div>
                <InstanceStatusBadge status={instance.status} />
              </Link>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {recentActivity.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-6">No activity yet.</p>
            )}
            {recentActivity.map((log) => (
              <div key={log.id} className="flex gap-3 text-sm">
                <div className="mt-1.5 h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                <div>
                  <p className="text-foreground/90">{log.message}</p>
                  <p className="text-xs text-muted-foreground">{timeAgo(log.createdAt)}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
