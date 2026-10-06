"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useInstance, useInstanceAction } from "@/hooks/useInstances";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { InstanceStatusBadge } from "@/components/compute/InstanceStatusBadge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  ArrowLeft, Play, Square, RotateCw, Trash2, Monitor, Cpu, MemoryStick,
  HardDrive, MapPin, Loader2,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export default function InstanceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data, isLoading } = useInstance(id);
  const action = useInstanceAction(id);
  const [confirmTerminate, setConfirmTerminate] = useState(false);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40 w-full rounded-xl" />
      </div>
    );
  }

  const instance = data?.instance;
  if (!instance) return <p className="text-muted-foreground">Instance not found.</p>;

  const isTransitioning = ["PROVISIONING", "REBOOTING", "TERMINATING"].includes(instance.status);

  async function handleTerminate() {
    await action.mutateAsync("TERMINATE");
    setConfirmTerminate(false);
    router.push("/compute");
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/compute">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">{instance.name}</h1>
            <InstanceStatusBadge status={instance.status} />
          </div>
          <p className="text-muted-foreground text-sm font-mono mt-0.5">{instance.ipv4Address ?? "IP pending..."}</p>
        </div>
      </div>

      {/* Action controls */}
      <Card>
        <CardContent className="p-4 flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            disabled={instance.status === "RUNNING" || isTransitioning}
            onClick={() => action.mutate("START")}
          >
            <Play className="h-4 w-4" /> Start
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            disabled={instance.status !== "RUNNING" || isTransitioning}
            onClick={() => action.mutate("STOP")}
          >
            <Square className="h-4 w-4" /> Stop
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            disabled={instance.status !== "RUNNING" || isTransitioning}
            onClick={() => action.mutate("REBOOT")}
          >
            <RotateCw className="h-4 w-4" /> Reboot
          </Button>
          <Button variant="outline" size="sm" className="gap-2" disabled={instance.status !== "RUNNING"}>
            <Monitor className="h-4 w-4" /> VNC Console
          </Button>
          <div className="flex-1" />
          <Button
            variant="destructive"
            size="sm"
            className="gap-2"
            disabled={instance.status === "TERMINATED" || isTransitioning}
            onClick={() => setConfirmTerminate(true)}
          >
            <Trash2 className="h-4 w-4" /> Terminate
          </Button>
        </CardContent>
      </Card>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="console">VNC Console</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="grid gap-4 sm:grid-cols-2">
            <Card>
              <CardHeader><CardTitle className="text-base">Specifications</CardTitle></CardHeader>
              <CardContent className="space-y-3 text-sm">
                <SpecRow icon={Cpu} label="vCPU" value={`${instance.plan.vcpu} Core`} />
                <SpecRow icon={MemoryStick} label="RAM" value={`${instance.plan.ramMb / 1024} GB`} />
                <SpecRow icon={HardDrive} label="Storage" value={`${instance.plan.storageGb} GB SSD`} />
                <SpecRow icon={MapPin} label="Region" value={instance.region.name} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-base">Network</CardTitle></CardHeader>
              <CardContent className="space-y-3 text-sm font-mono">
                <SpecRow label="IPv4" value={instance.ipv4Address ?? "pending"} />
                <SpecRow label="IPv6" value={instance.ipv6Address ?? "pending"} />
                <SpecRow label="Image" value={instance.imageLabel} />
                <SpecRow label="SSH Key" value={instance.sshKey?.name ?? "None (password auth)"} />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="console">
          <Card>
            <CardContent className="p-0">
              <div className="aspect-video bg-black rounded-lg flex flex-col items-center justify-center text-white/70 gap-3">
                {instance.status === "RUNNING" ? (
                  <>
                    <Monitor className="h-10 w-10" />
                    <p className="text-sm">VNC console placeholder — embed a noVNC/websocket client here.</p>
                    <p className="text-xs font-mono text-white/40">Session target: instance {instance.id}</p>
                  </>
                ) : (
                  <>
                    <Loader2 className="h-8 w-8 animate-spin" />
                    <p className="text-sm">Console unavailable while instance is {instance.status.toLowerCase()}.</p>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="activity">
          <Card>
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              Activity log for this instance appears here.
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={confirmTerminate} onOpenChange={setConfirmTerminate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Terminate instance?</DialogTitle>
            <DialogDescription>
              This will permanently destroy <strong>{instance.name}</strong> and all its data. This action
              cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmTerminate(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleTerminate} disabled={action.isPending} className="gap-2">
              {action.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Terminate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SpecRow({ icon: Icon, label, value }: { icon?: React.ElementType; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground flex items-center gap-2">
        {Icon && <Icon className="h-3.5 w-3.5" />}
        {label}
      </span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
