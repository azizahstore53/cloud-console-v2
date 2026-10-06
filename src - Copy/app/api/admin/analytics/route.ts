import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/admin";
import { prisma } from "@/lib/prisma";

function monthKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(key: string) {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-US", { month: "short", year: "2-digit" });
}

/** Builds an ordered list of the last `count` month keys, oldest first. */
function lastMonths(count: number): string[] {
  const out: string[] = [];
  const now = new Date();
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push(monthKey(d));
  }
  return out;
}

export async function GET() {
  const guard = await requirePermission("billing.manage");
  if (guard instanceof NextResponse) return guard;

  const MONTHS = 12;
  const rangeStart = new Date();
  rangeStart.setMonth(rangeStart.getMonth() - (MONTHS - 1));
  rangeStart.setDate(1);
  rangeStart.setHours(0, 0, 0, 0);

  const [users, revenueTx, usageTx] = await Promise.all([
    prisma.user.findMany({ where: { createdAt: { gte: rangeStart } }, select: { createdAt: true } }),
    prisma.transaction.findMany({
      where: { type: "TOPUP", status: "SUCCESS", createdAt: { gte: rangeStart } },
      select: { createdAt: true, amount: true },
    }),
    prisma.transaction.findMany({
      where: { type: "USAGE_CHARGE", status: "SUCCESS", createdAt: { gte: rangeStart } },
      select: { createdAt: true, amount: true },
    }),
  ]);

  const months = lastMonths(MONTHS);
  const userBuckets = Object.fromEntries(months.map((m) => [m, 0]));
  const revenueBuckets = Object.fromEntries(months.map((m) => [m, 0]));
  const usageBuckets = Object.fromEntries(months.map((m) => [m, 0]));

  for (const u of users) {
    const key = monthKey(u.createdAt);
    if (key in userBuckets) userBuckets[key] += 1;
  }
  for (const tx of revenueTx) {
    const key = monthKey(tx.createdAt);
    if (key in revenueBuckets) revenueBuckets[key] += tx.amount;
  }
  for (const tx of usageTx) {
    const key = monthKey(tx.createdAt);
    if (key in usageBuckets) usageBuckets[key] += Math.abs(tx.amount);
  }

  let cumulativeUsers = await prisma.user.count({ where: { createdAt: { lt: rangeStart } } });

  const series = months.map((m) => {
    cumulativeUsers += userBuckets[m];
    return {
      month: monthLabel(m),
      newUsers: userBuckets[m],
      totalUsers: cumulativeUsers,
      topupRevenue: revenueBuckets[m],
      usageRevenue: usageBuckets[m],
    };
  });

  return NextResponse.json({ series });
}
