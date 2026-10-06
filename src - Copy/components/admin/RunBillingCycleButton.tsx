"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/billing/calculator";
import { Zap, Loader2 } from "lucide-react";

interface BillingCycleSummary {
  processed: number;
  totalCharged: number;
  autoStopped: { instanceId: string; name: string; userId: string }[];
  errors: { instanceId: string; error: string }[];
}

export function RunBillingCycleButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleRun() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/billing/run-cycle", { method: "POST" });
      const summary: BillingCycleSummary = await res.json();
      if (!res.ok) throw new Error((summary as unknown as { error?: string }).error ?? "Billing cycle failed");

      if (summary.processed === 0) {
        toast.info("Billing cycle ran — no running instances had usage to charge yet.");
      } else {
        toast.success(
          `Billed ${summary.processed} instance(s), ${formatCurrency(summary.totalCharged)} total.`,
          {
            description:
              summary.autoStopped.length > 0
                ? `${summary.autoStopped.length} instance(s) auto-stopped (insufficient balance): ${summary.autoStopped
                    .map((i) => i.name)
                    .join(", ")}`
                : undefined,
            duration: 8000,
          }
        );
      }
      if (summary.errors.length > 0) {
        toast.error(`${summary.errors.length} instance(s) failed to bill — check server logs.`);
      }
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to run billing cycle");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button variant="outline" size="sm" className="gap-2" onClick={handleRun} disabled={loading}>
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
      Run Billing Cycle Now
    </Button>
  );
}
