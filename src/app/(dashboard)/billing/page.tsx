import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/billing/calculator";
import { TopUpDialog } from "@/components/billing/TopUpDialog";
import { Wallet, ArrowDownLeft, ArrowUpRight, CreditCard, History, PieChart, Server, ShieldCheck } from "lucide-react";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default async function BillingPage() {
  const session = await auth();
  const userId = session!.user.id;

  const [user, transactions, invoices] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: userId } }),
    prisma.transaction.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 20 }),
    prisma.invoice.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 10 }),
  ]);

  const pendingPayments = transactions.filter(tx => tx.status === "PENDING");

  const monthStart = startOfMonth(new Date());
  const monthEnd = endOfMonth(new Date());

  const monthlyUsage = await prisma.transaction.aggregate({
    where: {
      userId,
      createdAt: { gte: monthStart, lte: monthEnd },
      status: "SUCCESS",
      type: { not: "TOPUP" },
    },
    _sum: { amount: true },
  });

  const allMonthlyTxs = await prisma.transaction.findMany({
    where: {
      userId,
      createdAt: { gte: monthStart, lte: monthEnd },
      status: "SUCCESS",
      type: { not: "TOPUP" },
    },
  });

  const spending = {
    compute: allMonthlyTxs
      .filter(tx => tx.description?.toLowerCase().includes("instance") || tx.type === "USAGE_CHARGE")
      .reduce((sum, tx) => sum + Math.abs(tx.amount), 0),
    vpn: allMonthlyTxs
      .filter(tx => tx.description?.toLowerCase().includes("vpn"))
      .reduce((sum, tx) => sum + Math.abs(tx.amount), 0),
    others: 0,
  };

  const totalSpent = Math.abs(monthlyUsage._sum.amount ?? 0);
  spending.others = totalSpent - (spending.compute + spending.vpn);

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Billing &amp; Wallet</h1>
          <p className="text-muted-foreground text-sm mt-1">Manage your prepaid balance, invoices, and payment history.</p>
        </div>
        <Link href="/billing/history">
          <Button variant="outline" size="sm" className="gap-2">
            <History className="h-4 w-4" /> View Full History
          </Button>
        </Link>
      </div>

      <Card className="bg-gradient-to-br from-primary to-primary/70 text-primary-foreground border-0">
        <CardContent className="p-6 flex items-center justify-between">
          <div>
            <p className="text-sm opacity-80 flex items-center gap-2">
              <Wallet className="h-4 w-4" /> Wallet Balance
            </p>
            <p className="text-3xl font-semibold mt-1">{formatCurrency(user.balance, user.currency)}</p>
          </div>
          <TopUpDialog />
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
              <Server className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Compute</p>
              <p className="text-sm font-bold">{formatCurrency(spending.compute)}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">VPN</p>
              <p className="text-sm font-bold">{formatCurrency(spending.vpn)}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-600 dark:bg-slate-900/30 dark:text-slate-400">
              <PieChart className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total Spent (Month)</p>
              <p className="text-sm font-bold">{formatCurrency(totalSpent)}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {pendingPayments.length > 0 && (
        <Card className="border-orange-500/50 bg-orange-50/30 dark:bg-orange-900/10">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2 text-orange-600 dark:text-orange-400">
              <CreditCard className="h-4 w-4" /> Pending Payments
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {pendingPayments.map((tx) => (
              <div key={tx.id} className="flex items-center justify-between p-3 bg-background rounded-lg border border-orange-200 dark:border-orange-900/30 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400">
                    <CreditCard className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Top Up - {formatCurrency(tx.amount)}</p>
                    <p className="text-xs text-muted-foreground">{format(tx.createdAt, "d MMM yyyy, HH:mm")}</p>
                  </div>
                </div>
                {tx.paymentUrl ? (
                  <Button
                    asChild
                    size="sm"
                    className="bg-orange-600 hover:bg-orange-700 text-white"
                  >
                    <a href={tx.paymentUrl} target="_blank" rel="noopener noreferrer">
                      Pay Now
                    </a>
                  </Button>
                ) : (
                  <Badge variant="outline" className="text-muted-foreground">Processing</Badge>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Recent Transactions</CardTitle>
            <Link href="/billing/history">
              <Button variant="ghost" size="sm" className="h-8 text-xs">View All</Button>
            </Link>
          </CardHeader>
          <CardContent className="space-y-1">
            {transactions.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-8">No transactions yet.</p>
            )}
            {transactions.map((tx) => (
              <div key={tx.id} className="flex items-center justify-between py-2.5 border-b last:border-0">
                <div className="flex items-center gap-3">
                  <div className={`flex h-8 w-8 items-center justify-center rounded-full ${tx.amount >= 0 ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive"}`}>
                    {tx.amount >= 0 ? <ArrowDownLeft className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}
                  </div>
                  <div className="flex flex-col">
                    <p className="text-sm font-medium">{tx.description ?? tx.type}</p>
                    <div className="flex items-center gap-2">
                      <p className="text-xs text-muted-foreground">{format(tx.createdAt, "d MMM yyyy, HH:mm")}</p>
                      {tx.status === "PENDING" && <Badge variant="outline" className="text-[10px] h-4 px-1">Pending</Badge>}
                      {tx.status === "EXPIRED" && <Badge variant="destructive" className="text-[10px] h-4 px-1">Expired</Badge>}
                    </div>
                  </div>
                </div>
                <span className={`text-sm font-semibold ${tx.amount >= 0 ? "text-success" : "text-foreground"}`}>
                  {tx.amount >= 0 ? "+" : ""}{formatCurrency(tx.amount)}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Recent Invoices</CardTitle>
            <Link href="/billing/history">
              <Button variant="ghost" size="sm" className="h-8 text-xs">View All</Button>
            </Link>
          </CardHeader>
          <CardContent className="space-y-1">
            {invoices.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-8">No invoices yet.</p>
            )}
            {invoices.map((inv) => (
              <div key={inv.id} className="flex items-center justify-between py-2.5 border-b last:border-0">
                <div className="flex flex-col">
                  <p className="text-sm font-medium">{inv.invoiceNumber}</p>
                  <p className="text-xs text-muted-foreground">Due {format(inv.dueDate, "d MMM yyyy")}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold">{formatCurrency(inv.total, inv.currency)}</p>
                  <Badge variant={inv.status === "PAID" ? "success" : inv.status === "OVERDUE" ? "destructive" : "outline"}>
                    {inv.status}
                  </Badge>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
