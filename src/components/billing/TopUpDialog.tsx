"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import { formatCurrency } from "@/lib/billing/calculator";
import { Plus, Loader2 } from "lucide-react";

const PRESETS = [100000, 250000, 500000, 1000000];

export function TopUpDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState<number>(250000);
  const [loading, setLoading] = useState(false);

  async function handleTopUp() {
    setLoading(true);
    try {
      const res = await fetch("/api/billing/topup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to create top-up");

      // In this mock flow we immediately confirm payment client-side.
      // A real gateway would redirect to `data.checkoutUrl` and confirm via
      // webhook instead. Note this only sends the transaction id — the
      // amount actually credited comes from the PENDING transaction record
      // on the server, never from anything the client sends here.
      const confirmRes = await fetch("/api/billing/mock-pay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transactionId: data.transactionId }),
      });
      const confirmData = await confirmRes.json();
      if (!confirmRes.ok) throw new Error(confirmData.error ?? "Payment confirmation failed");

      toast.success(`${formatCurrency(confirmData.amount ?? amount)} added to your wallet`);
      setOpen(false);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="secondary" className="gap-2">
          <Plus className="h-4 w-4" /> Top Up Balance
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Top Up Wallet</DialogTitle>
          <DialogDescription>Add funds to your prepaid balance to launch and run resources.</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-2">
          {PRESETS.map((preset) => (
            <button
              key={preset}
              onClick={() => setAmount(preset)}
              className={`rounded-lg border p-3 text-sm font-medium transition-colors ${
                amount === preset ? "border-primary bg-primary/5 ring-1 ring-primary" : "hover:bg-accent"
              }`}
            >
              {formatCurrency(preset)}
            </button>
          ))}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="amount">Custom amount (IDR)</Label>
          <Input
            id="amount"
            type="number"
            min={10000}
            step={10000}
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value))}
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={handleTopUp} disabled={loading || amount < 10000} className="gap-2">
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            Pay with Xendit (mock)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
