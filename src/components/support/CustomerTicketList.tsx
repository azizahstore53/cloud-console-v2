"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { timeAgo } from "@/lib/utils";
import { statusLabel, statusVariant, type TicketStatusValue } from "./ticketLabels";

interface CustomerTicketRow {
  id: string;
  subject: string;
  status: TicketStatusValue;
  customerUnread: boolean;
  lastMessageAt: string;
  relatedInstance: { id: string; name: string } | null;
}

export function CustomerTicketList() {
  const { data, isLoading } = useQuery({
    queryKey: ["tickets-list", "customer"],
    queryFn: async () => {
      const res = await fetch("/api/tickets");
      if (!res.ok) throw new Error("Failed to load tickets");
      return (await res.json()) as { tickets: CustomerTicketRow[] };
    },
    refetchInterval: 15_000,
  });

  const tickets = data?.tickets ?? [];

  return (
    <Card>
      <CardContent className="p-0 divide-y">
        {isLoading && <p className="p-4 text-sm text-muted-foreground">Memuat...</p>}
        {!isLoading && tickets.length === 0 && (
          <p className="p-6 text-sm text-muted-foreground text-center">
            Belum ada tiket. Klik &quot;Tiket Baru&quot; kalau Anda butuh bantuan.
          </p>
        )}
        {tickets.map((t) => (
          <Link
            key={t.id}
            href={`/support/${t.id}`}
            className="flex flex-wrap items-center justify-between gap-3 p-4 hover:bg-accent/50 transition-colors"
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                {t.customerUnread && (
                  <span className="h-2 w-2 shrink-0 rounded-full bg-primary" aria-label="Ada balasan baru" />
                )}
                <span className={t.customerUnread ? "text-sm font-semibold" : "text-sm font-medium"}>
                  {t.subject}
                </span>
              </div>
              {t.relatedInstance && (
                <p className="text-xs text-muted-foreground mt-0.5">Instance: {t.relatedInstance.name}</p>
              )}
            </div>
            <span className="text-xs text-muted-foreground whitespace-nowrap">{timeAgo(t.lastMessageAt)}</span>
            <Badge variant={statusVariant(t.status)}>{statusLabel(t.status, "customer")}</Badge>
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}
