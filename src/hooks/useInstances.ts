"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { InstanceWithRelations } from "@/types";

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || data.error || "Request failed");
  return data;
}

export function useInstances() {
  return useQuery({
    queryKey: ["instances"],
    queryFn: () => fetchJson<{ instances: InstanceWithRelations[] }>("/api/instances"),
    // Poll while anything is provisioning/rebooting/terminating so status updates live.
    refetchInterval: (query) => {
      const instances = query.state.data?.instances ?? [];
      const hasTransient = instances.some((i) =>
        ["PROVISIONING", "REBOOTING", "TERMINATING"].includes(i.status)
      );
      return hasTransient ? 3000 : false;
    },
  });
}

export function useInstance(id: string) {
  return useQuery({
    queryKey: ["instances", id],
    queryFn: () => fetchJson<{ instance: InstanceWithRelations }>(`/api/instances/${id}`),
    refetchInterval: (query) => {
      const status = query.state.data?.instance.status;
      return status && ["PROVISIONING", "REBOOTING", "TERMINATING"].includes(status) ? 3000 : false;
    },
  });
}

export function useCreateInstance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      fetchJson<{
        instance: InstanceWithRelations;
        oneTimeCredentials?: { username: string; password: string; note: string };
      }>("/api/instances", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["instances"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useInstanceAction(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (action: "START" | "STOP" | "REBOOT" | "TERMINATE") =>
      fetchJson<{ instance: InstanceWithRelations }>(`/api/instances/${id}/actions`, {
        method: "POST",
        body: JSON.stringify({ action }),
      }),
    onSuccess: (_data, action) => {
      qc.invalidateQueries({ queryKey: ["instances"] });
      qc.invalidateQueries({ queryKey: ["instances", id] });
      toast.success(`Action "${action.toLowerCase()}" sent`);
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
