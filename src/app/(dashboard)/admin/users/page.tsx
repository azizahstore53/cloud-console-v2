"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { formatCurrency } from "@/lib/billing/calculator";
import { timeAgo } from "@/lib/utils";
import { canAssignRole, STAFF_ROLES } from "@/lib/permissions";
import { Loader2, Wallet, Ban, CheckCircle } from "lucide-react";
import type { Role } from "@prisma/client";

const ALL_ROLES: Role[] = ["SUPER_ADMIN", "ADMIN", "BILLING", "SUPPORT", "DEVELOPER", "CUSTOMER"];

function roleBadgeVariant(role: Role) {
  if (role === "SUPER_ADMIN" || role === "ADMIN") return "default" as const;
  if ((STAFF_ROLES as Role[]).includes(role)) return "secondary" as const;
  return "outline" as const;
}

interface AdminUser {
  id: string; name: string | null; email: string; role: Role;
  balance: number; isActive: boolean; createdAt: string;
  _count: { instances: number };
}

async function fetchUsers() {
  const res = await fetch("/api/admin/users");
  if (!res.ok) throw new Error("Failed to load users");
  return res.json() as Promise<{ users: AdminUser[] }>;
}

export default function AdminUsersPage() {
  const { data: session } = useSession();
  const viewerRole = session?.user?.role;
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["admin-users"], queryFn: fetchUsers });
  const [adjustTarget, setAdjustTarget] = useState<AdminUser | null>(null);
  const [adjustAmount, setAdjustAmount] = useState<number>(100000);

  const patchUser = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: Record<string, unknown> }) => {
      const res = await fetch(`/api/admin/users/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Update failed");
      return json;
    },
    onSuccess: () => {
      toast.success("User updated");
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      setAdjustTarget(null);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{data?.users.length ?? 0} registered users.</p>

      <Card>
        <CardContent className="p-0 divide-y">
          {isLoading && <p className="text-sm text-muted-foreground text-center py-10">Loading...</p>}
          {(data?.users ?? []).map((u) => {
            // Options this viewer is actually allowed to grant. The
            // server enforces the real rule (canAssignRole) regardless —
            // this only avoids offering an option that would just 403,
            // and always keeps the user's current role visible even if
            // the viewer couldn't have granted it themselves (e.g. an
            // ADMIN viewing an existing SUPER_ADMIN).
            const assignableRoles = viewerRole
              ? ALL_ROLES.filter((r) => r === u.role || canAssignRole(viewerRole, r))
              : [u.role];

            return (
              <div key={u.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="min-w-[180px]">
                  <p className="text-sm font-medium">{u.name ?? "—"}</p>
                  <p className="text-xs text-muted-foreground">{u.email}</p>
                </div>

                <div className="text-xs text-muted-foreground">
                  {u._count.instances} instance{u._count.instances === 1 ? "" : "s"} · joined {timeAgo(new Date(u.createdAt))}
                </div>

                <div className="flex items-center gap-1 text-sm font-medium">
                  <Wallet className="h-3.5 w-3.5 text-muted-foreground" />
                  {formatCurrency(u.balance)}
                </div>

                <Badge variant={u.isActive ? "success" : "destructive"}>{u.isActive ? "Active" : "Suspended"}</Badge>

                <div className="flex items-center gap-2 ml-auto">
                  <Select
                    value={u.role}
                    disabled={assignableRoles.length <= 1}
                    onValueChange={(role) => patchUser.mutate({ id: u.id, payload: { role } })}
                  >
                    <SelectTrigger className="w-[150px] h-9">
                      <SelectValue>
                        <Badge variant={roleBadgeVariant(u.role)}>{u.role}</Badge>
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {assignableRoles.map((r) => (
                        <SelectItem key={r} value={r}>{r}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => { setAdjustTarget(u); setAdjustAmount(100000); }}
                  >
                    Adjust Balance
                  </Button>
                  <Button
                    variant={u.isActive ? "destructive" : "outline"}
                    size="sm"
                    className="gap-1.5"
                    onClick={() => patchUser.mutate({ id: u.id, payload: { isActive: !u.isActive } })}
                  >
                    {u.isActive ? <Ban className="h-3.5 w-3.5" /> : <CheckCircle className="h-3.5 w-3.5" />}
                    {u.isActive ? "Suspend" : "Reactivate"}
                  </Button>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Dialog open={!!adjustTarget} onOpenChange={(o) => !o && setAdjustTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adjust balance — {adjustTarget?.name ?? adjustTarget?.email}</DialogTitle>
            <DialogDescription>
              Current balance: {adjustTarget ? formatCurrency(adjustTarget.balance) : "—"}. Enter a positive
              amount to credit, or negative to debit.
            </DialogDescription>
          </DialogHeader>
          <Input
            type="number"
            step={10000}
            value={adjustAmount}
            onChange={(e) => setAdjustAmount(Number(e.target.value))}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setAdjustTarget(null)}>Cancel</Button>
            <Button
              className="gap-2"
              disabled={patchUser.isPending || adjustAmount === 0}
              onClick={() =>
                adjustTarget &&
                patchUser.mutate({ id: adjustTarget.id, payload: { balanceAdjustment: adjustAmount } })
              }
            >
              {patchUser.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Apply Adjustment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
