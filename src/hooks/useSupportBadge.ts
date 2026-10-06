"use client";

import { useQuery } from "@tanstack/react-query";

export interface SupportBadge {
  /** Tickets where support wrote something the customer hasn't opened yet. */
  customerUnread: number;
  /** OPEN tickets waiting for a staff reply (0 for non-support roles). */
  staffOpen: number;
}

export const SUPPORT_BADGE_KEY = ["support-badge"] as const;

export function useSupportBadge() {
  return useQuery({
    queryKey: SUPPORT_BADGE_KEY,
    queryFn: async (): Promise<SupportBadge> => {
      const res = await fetch("/api/support/badge");
      if (!res.ok) throw new Error("Failed to load support badge");
      return res.json();
    },
    // Slow poll: the badge is a nudge, not a live feed. The open thread has
    // its own faster polling.
    refetchInterval: 30_000,
    staleTime: 15_000,
  });
}
