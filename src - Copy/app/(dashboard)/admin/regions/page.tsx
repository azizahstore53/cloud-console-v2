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
import { Plus, Loader2, Trash2, MapPin } from "lucide-react";

interface RegionItem { id: string; code: string; name: string; country: string; isActive: boolean }

const emptyForm = { code: "", name: "", country: "Indonesia" };

async function fetchRegions() {
  const res = await fetch("/api/admin/regions");
  if (!res.ok) throw new Error("Failed to load regions");
  return res.json() as Promise<{ regions: RegionItem[] }>;
}

export default function AdminRegionsPage() {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["admin-regions"], queryFn: fetchRegions });
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const create = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/admin/regions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to create region");
      return json;
    },
    onSuccess: () => {
      toast.success("Region created");
      setOpen(false); setForm(emptyForm);
      qc.invalidateQueries({ queryKey: ["admin-regions"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const toggleActive = useMutation({
    mutationFn: async (region: RegionItem) => {
      const res = await fetch(`/api/admin/regions/${region.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !region.isActive }),
      });
      if (!res.ok) throw new Error("Failed to update region");
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-regions"] }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/admin/regions/${id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to delete region");
      return json;
    },
    onSuccess: (json) => {
      toast.success(json.note ?? "Region deleted");
      qc.invalidateQueries({ queryKey: ["admin-regions"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2"><Plus className="h-4 w-4" /> New Region</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Create Region</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>Code</Label>
                <Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="id-bdg-1" />
              </div>
              <div className="space-y-1.5">
                <Label>Name</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Bandung 1" />
              </div>
              <div className="space-y-1.5">
                <Label>Country</Label>
                <Input value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button
                onClick={() => create.mutate()}
                disabled={form.code.length < 2 || form.name.length < 2 || create.isPending}
                className="gap-2"
              >
                {create.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Create Region
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-0 divide-y">
          {(data?.regions ?? []).map((region) => (
            <div key={region.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div className="flex items-center gap-3 min-w-[160px]">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">{region.name}</p>
                  <p className="text-xs text-muted-foreground font-mono">{region.code}</p>
                </div>
              </div>
              <span className="text-sm text-muted-foreground">{region.country}</span>
              <Badge
                variant={region.isActive ? "success" : "outline"}
                className="cursor-pointer"
                onClick={() => toggleActive.mutate(region)}
              >
                {region.isActive ? "Active" : "Inactive"}
              </Badge>
              <Button variant="ghost" size="icon" onClick={() => remove.mutate(region.id)}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
