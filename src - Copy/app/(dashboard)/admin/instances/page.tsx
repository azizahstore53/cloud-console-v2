"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { InstanceStatusBadge } from "@/components/compute/InstanceStatusBadge";
import { Loader2, Trash2 } from "lucide-react";

interface AdminInstance {
  id: string; name: string; status: string; ipv4Address: string | null;
  plan: { name: string; vcpu: number; ramMb: number };
  region: { name: string };
  user: { id: string; name: string | null; email: string };
}

async function fetchInstances() {
  const res = await fetch("/api/admin/instances");
  if (!res.ok) throw new Error("Failed to load instances");
  return res.json() as Promise<{ instances: AdminInstance[] }>;
}

export default function AdminInstancesPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["admin-instances"], queryFn: fetchInstances, refetchInterval: 5000 });

  const terminate = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/admin/instances/${id}/terminate`, { method: "POST" });
      if (!res.ok) throw new Error("Failed to terminate instance");
      return res.json();
    },
    onSuccess: () => {
      toast.success("Instance terminated");
      qc.invalidateQueries({ queryKey: ["admin-instances"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{data?.instances.length ?? 0} instances across all users.</p>

      <Card>
        <CardContent className="p-0 divide-y">
          {isLoading && <p className="text-sm text-muted-foreground text-center py-10">Loading...</p>}
          {(data?.instances ?? []).map((instance) => (
            <div key={instance.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div className="min-w-[160px]">
                <p className="text-sm font-medium">{instance.name}</p>
                <p className="text-xs text-muted-foreground font-mono">{instance.ipv4Address ?? "—"}</p>
              </div>
              <div className="text-xs text-muted-foreground min-w-[160px]">
                {instance.user.name ?? instance.user.email}
              </div>
              <div className="text-xs text-muted-foreground">
                {instance.plan.name} · {instance.region.name}
              </div>
              <InstanceStatusBadge status={instance.status as never} />
              <div className="ml-auto">
                <Button
                  variant="destructive"
                  size="sm"
                  className="gap-1.5"
                  disabled={instance.status === "TERMINATED" || terminate.isPending}
                  onClick={() => terminate.mutate(instance.id)}
                >
                  {terminate.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                  Force Terminate
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
