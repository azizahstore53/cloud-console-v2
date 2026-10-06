"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Rocket, Loader2, Globe } from "lucide-react";
import { timeAgo } from "@/lib/utils";

interface Blueprint { id: string; name: string; description: string; type: string; iconSlug: string }
interface Deployment {
  id: string; name: string; status: string; domain: string | null; createdAt: string;
  blueprint: Blueprint;
}

async function fetchAppsData() {
  const res = await fetch("/api/apps/deploy");
  return res.json() as Promise<{ blueprints: Blueprint[]; deployments: Deployment[] }>;
}

const STATUS_VARIANT: Record<string, "success" | "warning" | "destructive" | "outline"> = {
  RUNNING: "success", DEPLOYING: "warning", PENDING: "warning", FAILED: "destructive",
  STOPPED: "outline", REMOVED: "outline",
};

export default function AppsPage() {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["apps"], queryFn: fetchAppsData, refetchInterval: 5000 });
  const [selected, setSelected] = useState<Blueprint | null>(null);
  const [appName, setAppName] = useState("");

  const deploy = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/apps/deploy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ blueprintId: selected!.id, name: appName.trim() }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Deploy failed");
      return json;
    },
    onSuccess: () => {
      toast.success("Deployment started");
      setSelected(null);
      setAppName("");
      qc.invalidateQueries({ queryKey: ["apps"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">App Deployer</h1>
        <p className="text-muted-foreground text-sm mt-1">One-click blueprint installer for common application stacks.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {(data?.blueprints ?? []).map((bp) => (
          <Card key={bp.id} className="hover:border-primary/50 transition-colors">
            <CardHeader>
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary mb-2">
                <Rocket className="h-5 w-5" />
              </div>
              <CardTitle className="text-base">{bp.name}</CardTitle>
              <CardDescription>{bp.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button size="sm" className="w-full" onClick={() => setSelected(bp)}>Deploy</Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-3">Your Deployments</h2>
        <Card>
          <CardContent className="p-0 divide-y">
            {(data?.deployments ?? []).length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-10">No deployments yet.</p>
            )}
            {(data?.deployments ?? []).map((d) => (
              <div key={d.id} className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Rocket className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{d.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {d.blueprint.name} · {timeAgo(new Date(d.createdAt))}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {d.domain && (
                    <span className="hidden sm:flex items-center gap-1 text-xs text-muted-foreground">
                      <Globe className="h-3.5 w-3.5" /> {d.domain}
                    </span>
                  )}
                  <Badge variant={STATUS_VARIANT[d.status] ?? "outline"}>{d.status}</Badge>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Deploy {selected?.name}</DialogTitle>
            <DialogDescription>{selected?.description}</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="appName">App name</Label>
            <Input id="appName" placeholder="my-wordpress-site" value={appName} onChange={(e) => setAppName(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelected(null)}>Cancel</Button>
            <Button
              onClick={() => deploy.mutate()}
              disabled={appName.trim().length < 3 || deploy.isPending}
              className="gap-2"
            >
              {deploy.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Deploy Now
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
