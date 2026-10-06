import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/billing/calculator";
import { TopUpDialog } from "@/components/billing/TopUpDialog";
import { Wallet, ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { format } from "date-fns";

export default async function BillingPage() {
  const session = await auth();
  const userId = session!.user.id;

  const [user, transactions, invoices] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: userId } }),
    prisma.transaction.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 20 }),
    prisma.invoice.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 10 }),
  ]);

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Billing &amp; Wallet</h1>
        <p className="text-muted-foreground text-sm mt-1">Manage your prepaid balance, invoices, and payment history.</p>
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

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Transaction History</CardTitle></CardHeader>
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
                  <div>
                    <p className="text-sm font-medium">{tx.description ?? tx.type}</p>
                    <p className="text-xs text-muted-foreground">{format(tx.createdAt, "d MMM yyyy, HH:mm")}</p>
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
          <CardHeader><CardTitle className="text-base">Invoices</CardTitle></CardHeader>
          <CardContent className="space-y-1">
            {invoices.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-8">No invoices yet.</p>
            )}
            {invoices.map((inv) => (
              <div key={inv.id} className="flex items-center justify-between py-2.5 border-b last:border-0">
                <div>
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
