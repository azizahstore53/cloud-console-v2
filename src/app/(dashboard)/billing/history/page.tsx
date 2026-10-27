"use client";

import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatCurrency } from "@/lib/billing/calculator";
import { format } from "date-fns";
import { Loader2, FileText, Download, ArrowUpRight, ArrowDownLeft } from "lucide-react";
import Link from "next/link";

interface Transaction {
  id: string;
  amount: number;
  description: string | null;
  type: string;
  status: string;
  createdAt: string;
  invoiceId?: string;
}

interface Invoice {
  id: string;
  invoiceNumber: string;
  total: number;
  currency: string;
  status: string;
  dueDate: string;
  createdAt: string;
}

export default function BillingHistoryPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const [txRes, invRes] = await Promise.all([
          fetch("/api/billing/transactions"),
          fetch("/api/billing/invoice"),
        ]);

        if (txRes.ok) setTransactions(await txRes.json());
        if (invRes.ok) setInvoices(await invRes.json());
      } catch (error) {
        console.error("Error fetching billing history:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Billing History</h1>
          <p className="text-muted-foreground text-sm mt-1">Complete record of your transactions and invoices.</p>
        </div>
        <Link href="/billing">
          <Button variant="outline" size="sm">Back to Billing</Button>
        </Link>
      </div>

      <Tabs defaultValue="transactions" className="space-y-4">
        <TabsList>
          <TabsTrigger value="transactions">Transactions</TabsTrigger>
          <TabsTrigger value="invoices">Invoices</TabsTrigger>
        </TabsList>

        <TabsContent value="transactions">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">All Transactions</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-10 text-muted-foreground">
                        No transactions found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    transactions.map((tx) => (
                      <TableRow key={tx.id}>
                        <TableCell className="whitespace-nowrap">
                          {format(new Date(tx.createdAt), "d MMM yyyy, HH:mm")}
                        </TableCell>
                        <TableCell className="font-medium">
                          {tx.description || tx.type}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {tx.amount >= 0 ? (
                              <ArrowDownLeft className="h-3 w-3 text-success" />
                            ) : (
                              <ArrowUpRight className="h-3 w-3 text-destructive" />
                            )}
                            <span className="text-xs uppercase">{tx.type}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={tx.status === "SUCCESS" ? "success" : tx.status === "PENDING" ? "outline" : "destructive"}>
                            {tx.status}
                          </Badge>
                        </TableCell>
                        <TableCell className={`text-right font-semibold ${tx.amount >= 0 ? "text-success" : "text-foreground"}`}>
                          {tx.amount >= 0 ? "+" : ""}{formatCurrency(tx.amount)}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="invoices">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">All Invoices</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Invoice #</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoices.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">
                        No invoices found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    invoices.map((inv) => (
                      <TableRow key={inv.id}>
                        <TableCell className="font-medium">{inv.invoiceNumber}</TableCell>
                        <TableCell>
                          {format(new Date(inv.createdAt), "d MMM yyyy")}
                        </TableCell>
                        <TableCell>
                          {format(new Date(inv.dueDate), "d MMM yyyy")}
                        </TableCell>
                        <TableCell>
                          <Badge variant={inv.status === "PAID" ? "success" : inv.status === "OVERDUE" ? "destructive" : "outline"}>
                            {inv.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-semibold">
                          {formatCurrency(inv.total, inv.currency)}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 gap-2"
                            onClick={() => window.open(`/billing/invoice/${inv.id}`, '_blank')}
                          >
                            <Download className="h-3 w-3" /> PDF
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
