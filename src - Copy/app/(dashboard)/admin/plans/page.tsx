"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import { formatCurrency } from "@/lib/billing/calculator";
import { Plus, Loader2, Trash2, Cpu } from "lucide-react";

interface Plan {
  id: string; name: string; vcpu: number; ramMb: number; storageGb: number;
  pricePerHour: number; pricePerMonth: number; isActive: boolean;
}

const emptyForm = { name: "", vcpu: 1, ramMb: 1024, storageGb: 25, pricePerHour: 150, pricePerMonth: 75000 };

async function fetchPlans() {
  const res = await fetch("/api/admin/plans");
  if (!res.ok) throw new Error("Failed to load plans");
  return res.json() as Promise<{ plans: Plan[] }>;
}

export default function AdminPlansPage() {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["admin-plans"], queryFn: fetchPlans });
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const create = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/admin/plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to create plan");
      return json;
    },
    onSuccess: () => {
      toast.success("Plan created");
      setOpen(false); setForm(emptyForm);
      qc.invalidateQueries({ queryKey: ["admin-plans"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const toggleActive = useMutation({
    mutationFn: async (plan: Plan) => {
      const res = await fetch(`/api/admin/plans/${plan.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !plan.isActive }),
      });
      if (!res.ok) throw new Error("Failed to update plan");
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-plans"] }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/admin/plans/${id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to delete plan");
      return json;
    },
    onSuccess: (json) => {
      toast.success(json.note ?? "Plan deleted");
      qc.invalidateQueries({ queryKey: ["admin-plans"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2"><Plus className="h-4 w-4" /> New Plan</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Create Instance Plan</DialogTitle></DialogHeader>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 space-y-1.5">
                <Label>Name</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Small-2" />
              </div>
              <div className="space-y-1.5">
                <Label>vCPU</Label>
                <Input type="number" value={form.vcpu} onChange={(e) => setForm({ ...form, vcpu: Number(e.target.value) })} />
              </div>
              <div className="space-y-1.5">
                <Label>RAM (MB)</Label>
                <Input type="number" value={form.ramMb} onChange={(e) => setForm({ ...form, ramMb: Number(e.target.value) })} />
              </div>
              <div className="space-y-1.5">
                <Label>Storage (GB)</Label>
                <Input type="number" value={form.storageGb} onChange={(e) => setForm({ ...form, storageGb: Number(e.target.value) })} />
              </div>
              <div className="space-y-1.5">
                <Label>Price / Hour (IDR)</Label>
                <Input type="number" value={form.pricePerHour} onChange={(e) => setForm({ ...form, pricePerHour: Number(e.target.value) })} />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label>Price / Month (IDR)</Label>
                <Input type="number" value={form.pricePerMonth} onChange={(e) => setForm({ ...form, pricePerMonth: Number(e.target.value) })} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={() => create.mutate()} disabled={form.name.length < 2 || create.isPending} className="gap-2">
                {create.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Create Plan
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-0 divide-y">
          {(data?.plans ?? []).map((plan) => (
            <div key={plan.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div className="flex items-center gap-3 min-w-[140px]">
                <Cpu className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">{plan.name}</span>
              </div>
              <div className="text-xs text-muted-foreground">
                {plan.vcpu} vCPU · {plan.ramMb / 1024}GB RAM · {plan.storageGb}GB SSD
              </div>
              <div className="text-sm font-medium">
                {formatCurrency(plan.pricePerMonth)}/mo · {formatCurrency(plan.pricePerHour)}/hr
              </div>
              <Badge
                variant={plan.isActive ? "success" : "outline"}
                className="cursor-pointer"
                onClick={() => toggleActive.mutate(plan)}
              >
                {plan.isActive ? "Active" : "Inactive"}
              </Badge>
              <Button variant="ghost" size="icon" onClick={() => remove.mutate(plan.id)}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
