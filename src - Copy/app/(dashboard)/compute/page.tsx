"use client";

import Link from "next/link";
import { useInstances } from "@/hooks/useInstances";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { InstanceStatusBadge } from "@/components/compute/InstanceStatusBadge";
import { Plus, Server, Cpu, MemoryStick, HardDrive, MapPin } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export default function ComputePage() {
  const { data, isLoading } = useInstances();
  const instances = data?.instances ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Cloud VPS</h1>
          <p className="text-muted-foreground text-sm mt-1">Manage your virtual server instances.</p>
        </div>
        <Link href="/compute/new">
          <Button className="gap-2">
            <Plus className="h-4 w-4" /> Create Instance
          </Button>
        </Link>
      </div>

      {isLoading && (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-44 rounded-xl" />
          ))}
        </div>
      )}

      {!isLoading && instances.length === 0 && (
        <Card>
          <CardContent className="py-16 text-center">
            <Server className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
            <p className="font-medium mb-1">No instances yet</p>
            <p className="text-sm text-muted-foreground mb-4">Launch your first Cloud VPS to get started.</p>
            <Link href="/compute/new">
              <Button className="gap-2">
                <Plus className="h-4 w-4" /> Create Instance
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {instances.map((instance) => (
          <Link key={instance.id} href={`/compute/${instance.id}`}>
            <Card className="hover:border-primary/50 transition-colors h-full">
              <CardContent className="p-5 space-y-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium">{instance.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{instance.imageLabel}</p>
                  </div>
                  <InstanceStatusBadge status={instance.status} />
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1.5">
                    <Cpu className="h-3.5 w-3.5" /> {instance.plan.vcpu} vCPU
                  </div>
                  <div className="flex items-center gap-1.5">
                    <MemoryStick className="h-3.5 w-3.5" /> {instance.plan.ramMb / 1024} GB RAM
                  </div>
                  <div className="flex items-center gap-1.5">
                    <HardDrive className="h-3.5 w-3.5" /> {instance.plan.storageGb} GB SSD
                  </div>
                  <div className="flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5" /> {instance.region.name}
                  </div>
                </div>

                <div className="text-xs font-mono text-muted-foreground border-t pt-3">
                  {instance.ipv4Address ?? "—"}
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
