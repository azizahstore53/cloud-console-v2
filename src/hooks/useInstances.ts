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
    onMutate: async (action) => {
      // Cancel outgoing refetches (so they don't overwrite our optimistic update)
      await qc.cancelQueries({ queryKey: ["instances", id] });

      // Snapshot the previous value
      const previousInstance = qc.getQueryData<InstanceWithRelations>(["instances", id]);

      // Optimistically update to a transitioning state
      // Note: We don't have the full InstanceWithRelations type here, but we can update the status
      qc.setQueryData(["instances", id], (old: any) => {
        if (!old) return old;
        const statusMap: Record<string, string> = {
          START: "PROVISIONING", // Or a custom 'STARTING' if the API supports it
          STOP: "STOPPED",
          REBOOT: "REBOOTING",
          TERMINATE: "TERMINATING",
        };
        return {
          ...old,
          instance: {
            ...old.instance,
            status: statusMap[action] || old.instance.status
          },
        };
      });

      return { previousInstance };
    },
    onSuccess: (_data, action) => {
      qc.invalidateQueries({ queryKey: ["instances"] });
      qc.invalidateQueries({ queryKey: ["instances", id] });
      toast.success(`Action "${action.toLowerCase()}" sent`);
    },
    onError: (err: Error, _variables, context) => {
      // Rollback to previous state on error
      if (context?.previousInstance) {
        qc.setQueryData(["instances", id], context.previousInstance);
      }
      toast.error(err.message);
    },
  });
}
