"use client";

import { useState } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { Search, Loader2 } from "lucide-react";

interface LogEntry {
  id: string; category: string; action: string; message: string; createdAt: string;
  user: { id: string; name: string | null; email: string };
}

const CATEGORIES = ["", "AUTH", "INSTANCE", "BILLING", "DEPLOYMENT", "SSH_KEY", "ACCOUNT", "SYSTEM"];

const CATEGORY_COLOR: Record<string, string> = {
  AUTH: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  INSTANCE: "bg-primary/10 text-primary border-primary/20",
  BILLING: "bg-success/10 text-success border-success/20",
  DEPLOYMENT: "bg-purple-500/10 text-purple-600 border-purple-500/20",
  SSH_KEY: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  ACCOUNT: "bg-slate-500/10 text-slate-600 border-slate-500/20",
  SYSTEM: "bg-red-500/10 text-red-600 border-red-500/20",
};

const selectClass =
  "h-9 rounded-md border border-input bg-transparent px-2.5 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring";

export default function AdminActivityPage() {
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const buildUrl = (cursor?: string) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (category) params.set("category", category);
    if (from) params.set("from", new Date(from).toISOString());
    if (to) params.set("to", new Date(to).toISOString());
    if (cursor) params.set("cursor", cursor);
    return `/api/admin/activity?${params.toString()}`;
  };

  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
    queryKey: ["admin-activity", q, category, from, to],
    queryFn: async ({ pageParam }: { pageParam?: string }) => {
      const res = await fetch(buildUrl(pageParam));
      if (!res.ok) throw new Error("Failed to load activity logs");
      return res.json() as Promise<{ logs: LogEntry[]; nextCursor: string | null }>;
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });

  const logs = data?.pages.flatMap((p) => p.logs) ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search message, action, or user..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="pl-8"
          />
        </div>
        <select className={selectClass} value={category} onChange={(e) => setCategory(e.target.value)}>
          {CATEGORIES.map((c) => <option key={c} value={c}>{c || "All categories"}</option>)}
        </select>
        <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-auto" />
        <span className="text-xs text-muted-foreground">to</span>
        <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-auto" />
      </div>

      <Card>
        <CardContent className="p-0 divide-y">
          {isLoading && <p className="text-sm text-muted-foreground text-center py-10">Loading...</p>}
          {!isLoading && logs.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-10">No activity matches these filters.</p>
          )}
          {logs.map((log) => (
            <div key={log.id} className="flex flex-wrap items-start justify-between gap-3 p-4">
              <div className="flex items-start gap-3 flex-1 min-w-[240px]">
                <Badge variant="outline" className={CATEGORY_COLOR[log.category] ?? ""}>
                  {log.category}
                </Badge>
                <div>
                  <p className="text-sm">{log.message}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {log.user.name ?? log.user.email} · <code className="font-mono">{log.action}</code>
                  </p>
                </div>
              </div>
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                {format(new Date(log.createdAt), "d MMM yyyy, HH:mm:ss")}
              </span>
            </div>
          ))}
        </CardContent>
      </Card>

      {hasNextPage && (
        <div className="flex justify-center">
          <Button variant="outline" onClick={() => fetchNextPage()} disabled={isFetchingNextPage} className="gap-2">
            {isFetchingNextPage && <Loader2 className="h-4 w-4 animate-spin" />}
            Load more
          </Button>
        </div>
      )}
    </div>
  );
}
