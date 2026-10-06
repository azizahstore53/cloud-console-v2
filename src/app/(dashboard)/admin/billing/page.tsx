"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatCurrency } from "@/lib/billing/calculator";
import { format } from "date-fns";
import { Search, ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface Tx {
  id: string; type: string; status: string; amount: number; gateway: string | null;
  gatewayRef: string | null; description: string | null; createdAt: string;
  user: { id: string; name: string | null; email: string };
}
interface Inv {
  id: string; invoiceNumber: string; status: string; total: number; currency: string;
  dueDate: string; createdAt: string; user: { id: string; name: string | null; email: string };
}

const TX_TYPES = ["", "TOPUP", "USAGE_CHARGE", "REFUND", "ADJUSTMENT"];
const TX_STATUSES = ["", "PENDING", "SUCCESS", "FAILED", "EXPIRED"];
const INVOICE_STATUSES = ["", "DRAFT", "PENDING", "PAID", "OVERDUE", "CANCELLED", "REFUNDED"];

const selectClass =
  "h-9 rounded-md border border-input bg-transparent px-2.5 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring";

function StatusBadge({ status }: { status: string }) {
  const variant =
    status === "SUCCESS" || status === "PAID" ? "success"
    : status === "FAILED" || status === "OVERDUE" || status === "EXPIRED" ? "destructive"
    : "outline";
  return <Badge variant={variant}>{status}</Badge>;
}

export default function AdminBillingPage() {
  const [q, setQ] = useState("");
  const [txType, setTxType] = useState("");
  const [txStatus, setTxStatus] = useState("");
  const [invoiceStatus, setInvoiceStatus] = useState("");

  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (txType) params.set("type", txType);
  if (txStatus) params.set("status", txStatus);
  if (invoiceStatus) params.set("invoiceStatus", invoiceStatus);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-billing", q, txType, txStatus, invoiceStatus],
    queryFn: async () => {
      const res = await fetch(`/api/admin/billing?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to load billing data");
      return res.json() as Promise<{ transactions: Tx[]; invoices: Inv[]; lifetimeTopupRevenue: number }>;
    },
  });

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-5 flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Lifetime Top-up Revenue</p>
            <p className="text-2xl font-semibold mt-1">{formatCurrency(data?.lifetimeTopupRevenue ?? 0)}</p>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by user, email, invoice #, or ref..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="pl-8"
          />
        </div>
      </div>

      <Tabs defaultValue="transactions">
        <TabsList>
          <TabsTrigger value="transactions">Transactions</TabsTrigger>
          <TabsTrigger value="invoices">Invoices</TabsTrigger>
        </TabsList>

        <TabsContent value="transactions" className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <select className={selectClass} value={txType} onChange={(e) => setTxType(e.target.value)}>
              {TX_TYPES.map((t) => <option key={t} value={t}>{t || "All types"}</option>)}
            </select>
            <select className={selectClass} value={txStatus} onChange={(e) => setTxStatus(e.target.value)}>
              {TX_STATUSES.map((s) => <option key={s} value={s}>{s || "All statuses"}</option>)}
            </select>
          </div>

          <Card>
            <CardContent className="p-0 divide-y">
              {isLoading && <Skeleton className="h-40 w-full m-4" />}
              {!isLoading && (data?.transactions.length ?? 0) === 0 && (
                <p className="text-sm text-muted-foreground text-center py-10">No transactions match these filters.</p>
              )}
              {(data?.transactions ?? []).map((tx) => (
                <div key={tx.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                  <div className={`flex h-8 w-8 items-center justify-center rounded-full shrink-0 ${tx.amount >= 0 ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive"}`}>
                    {tx.amount >= 0 ? <ArrowDownLeft className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}
                  </div>
                  <div className="min-w-[160px] flex-1">
                    <p className="text-sm font-medium">{tx.user.name ?? tx.user.email}</p>
                    <p className="text-xs text-muted-foreground">{tx.description ?? tx.type}</p>
                  </div>
                  <Badge variant="outline">{tx.type}</Badge>
                  <StatusBadge status={tx.status} />
                  <span className="text-xs text-muted-foreground w-32 text-right">
                    {format(new Date(tx.createdAt), "d MMM yyyy, HH:mm")}
                  </span>
                  <span className={`text-sm font-semibold w-32 text-right ${tx.amount >= 0 ? "text-success" : "text-foreground"}`}>
                    {tx.amount >= 0 ? "+" : ""}{formatCurrency(tx.amount)}
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="invoices" className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <select className={selectClass} value={invoiceStatus} onChange={(e) => setInvoiceStatus(e.target.value)}>
              {INVOICE_STATUSES.map((s) => <option key={s} value={s}>{s || "All statuses"}</option>)}
            </select>
          </div>

          <Card>
            <CardContent className="p-0 divide-y">
              {isLoading && <Skeleton className="h-40 w-full m-4" />}
              {!isLoading && (data?.invoices.length ?? 0) === 0 && (
                <p className="text-sm text-muted-foreground text-center py-10">No invoices match these filters.</p>
              )}
              {(data?.invoices ?? []).map((inv) => (
                <div key={inv.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                  <div className="min-w-[160px] flex-1">
                    <p className="text-sm font-medium">{inv.invoiceNumber}</p>
                    <p className="text-xs text-muted-foreground">{inv.user.name ?? inv.user.email}</p>
                  </div>
                  <span className="text-xs text-muted-foreground w-32 text-right">
                    Due {format(new Date(inv.dueDate), "d MMM yyyy")}
                  </span>
                  <StatusBadge status={inv.status} />
                  <span className="text-sm font-semibold w-32 text-right">{formatCurrency(inv.total, inv.currency)}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
