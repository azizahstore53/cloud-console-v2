"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import { KeyRound, Plus, Trash2, Loader2 } from "lucide-react";

interface SshKeyItem { id: string; name: string; fingerprint: string; createdAt: string }

export default function SshKeysPage() {
  const qc = useQueryClient();
  const { data } = useQuery<{ sshKeys: SshKeyItem[] }>({
    queryKey: ["ssh-keys"],
    queryFn: () => fetch("/api/ssh-keys").then((r) => r.json()),
  });
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [publicKey, setPublicKey] = useState("");

  const create = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/ssh-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, publicKey }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to add key");
      return json;
    },
    onSuccess: () => {
      toast.success("SSH key added");
      setOpen(false); setName(""); setPublicKey("");
      qc.invalidateQueries({ queryKey: ["ssh-keys"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => fetch(`/api/ssh-keys/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success("SSH key removed");
      qc.invalidateQueries({ queryKey: ["ssh-keys"] });
    },
  });

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">SSH Keys</h1>
          <p className="text-muted-foreground text-sm mt-1">Manage public keys used to access your instances.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2"><Plus className="h-4 w-4" /> Add SSH Key</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add SSH Key</DialogTitle>
              <DialogDescription>Paste your public key (e.g. from <code>~/.ssh/id_ed25519.pub</code>).</DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="keyName">Name</Label>
                <Input id="keyName" placeholder="my-laptop" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="keyValue">Public Key</Label>
                <textarea
                  id="keyValue"
                  rows={4}
                  className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm font-mono shadow-sm"
                  placeholder="ssh-ed25519 AAAAC3Nza..."
                  value={publicKey}
                  onChange={(e) => setPublicKey(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button
                onClick={() => create.mutate()}
                disabled={name.length < 2 || publicKey.length < 20 || create.isPending}
                className="gap-2"
              >
                {create.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Add Key
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-0 divide-y">
          {(data?.sshKeys ?? []).length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-10">No SSH keys added yet.</p>
          )}
          {(data?.sshKeys ?? []).map((key) => (
            <div key={key.id} className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <KeyRound className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-medium">{key.name}</p>
                  <p className="text-xs text-muted-foreground font-mono">{key.fingerprint}</p>
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={() => remove.mutate(key.id)}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
