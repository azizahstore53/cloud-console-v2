"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { timeAgo } from "@/lib/utils";
import { statusLabel, statusVariant, type TicketStatusValue } from "./ticketLabels";

type Filter = TicketStatusValue | "ALL";

const FILTERS: { value: Filter; label: string }[] = [
  { value: "OPEN", label: "Perlu dibalas" },
  { value: "PENDING", label: "Menunggu pelanggan" },
  { value: "RESOLVED", label: "Selesai" },
  { value: "ALL", label: "Semua" },
];

interface StaffTicketRow {
  id: string;
  subject: string;
  status: TicketStatusValue;
  lastMessageAt: string;
  customer: { id: string; name: string | null; email: string };
  assignedTo: { id: string; name: string | null } | null;
  messages: { body: string; senderType: "CUSTOMER" | "STAFF" | "SYSTEM" }[];
}

export function AdminTicketList() {
  const [filter, setFilter] = useState<Filter>("OPEN");

  const { data, isLoading } = useQuery({
    queryKey: ["tickets-list", "staff", filter],
    queryFn: async () => {
      const res = await fetch(`/api/admin/tickets?status=${filter}`);
      if (!res.ok) throw new Error("Failed to load tickets");
      return (await res.json()) as { tickets: StaffTicketRow[] };
    },
    refetchInterval: 10_000,
  });

  const tickets = data?.tickets ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <Button
            key={f.value}
            size="sm"
            variant={filter === f.value ? "default" : "outline"}
            onClick={() => setFilter(f.value)}
          >
            {f.label}
          </Button>
        ))}
      </div>

      <Card>
        <CardContent className="p-0 divide-y">
          {isLoading && <p className="p-4 text-sm text-muted-foreground">Memuat...</p>}
          {!isLoading && tickets.length === 0 && (
            <p className="p-6 text-sm text-muted-foreground text-center">Tidak ada tiket di kategori ini.</p>
          )}
          {tickets.map((t) => {
            const last = t.messages[0];
            const prefix = last?.senderType === "CUSTOMER" ? "Pelanggan: " : last?.senderType === "STAFF" ? "Tim: " : "";
            return (
              <Link
                key={t.id}
                href={`/admin/support/${t.id}`}
                className="flex flex-wrap items-center justify-between gap-3 p-4 hover:bg-accent/50 transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{t.subject}</p>
                  <p className="text-xs text-muted-foreground">
                    {t.customer.name ?? t.customer.email}
                    {t.assignedTo ? ` · ditangani ${t.assignedTo.name ?? "staff"}` : " · belum ditangani"}
                  </p>
                  {last && (
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                      {prefix}
                      {last.body}
                    </p>
                  )}
                </div>
                <span className="text-xs text-muted-foreground whitespace-nowrap">{timeAgo(t.lastMessageAt)}</span>
                <Badge variant={statusVariant(t.status)}>{statusLabel(t.status, "staff")}</Badge>
              </Link>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
