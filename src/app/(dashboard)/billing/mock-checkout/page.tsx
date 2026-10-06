"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/billing/calculator";
import { CheckCircle2, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

/**
 * Stands in for a hosted checkout page (Xendit/Midtrans). In production this
 * route would not exist — the user is redirected to the gateway's own
 * hosted invoice URL instead, and payment confirmation arrives via the
 * webhook at /api/webhooks/payment.
 */
export default function MockCheckoutPage() {
  const router = useRouter();
  const params = useSearchParams();
  const displayAmount = Number(params.get("amount") ?? 0); // cosmetic only — see handlePay
  const transactionId = params.get("ref") ?? "";
  const [loading, setLoading] = useState(false);
  const [paid, setPaid] = useState(false);

  async function handlePay() {
    setLoading(true);
    try {
      // Only the transaction id is sent — the amount actually credited is
      // whatever was recorded server-side when the top-up was requested,
      // never the `displayAmount` from this page's URL.
      const res = await fetch("/api/billing/mock-pay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transactionId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Payment failed");
      setPaid(true);
      setTimeout(() => router.push("/billing"), 1500);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Payment failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <div className="flex items-center gap-2 text-muted-foreground text-xs mb-2">
            <ShieldCheck className="h-4 w-4" /> Mock Payment Gateway
          </div>
          <CardTitle>Confirm Payment</CardTitle>
          <CardDescription>Reference: {transactionId || "—"}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-center py-4">
            <p className="text-3xl font-semibold">{formatCurrency(displayAmount)}</p>
            <p className="text-sm text-muted-foreground mt-1">CloudConsole wallet top-up</p>
          </div>

          {paid ? (
            <div className="flex flex-col items-center gap-2 py-2 text-success">
              <CheckCircle2 className="h-8 w-8" />
              <p className="text-sm">Payment confirmed. Redirecting...</p>
            </div>
          ) : (
            <Button className="w-full gap-2" onClick={handlePay} disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Pay Now
            </Button>
          )}

          <p className="text-xs text-muted-foreground text-center">
            This is a structural placeholder. Swap in the real Xendit/Midtrans
            hosted checkout redirect in production.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
