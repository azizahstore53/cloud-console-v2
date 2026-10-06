"use client";

import { useQuery } from "@tanstack/react-query";
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { formatCurrency } from "@/lib/billing/calculator";
import { Skeleton } from "@/components/ui/skeleton";

interface MonthPoint {
  month: string;
  newUsers: number;
  totalUsers: number;
  topupRevenue: number;
  usageRevenue: number;
}

async function fetchAnalytics() {
  const res = await fetch("/api/admin/analytics");
  if (!res.ok) throw new Error("Failed to load analytics");
  return res.json() as Promise<{ series: MonthPoint[] }>;
}

const currencyTick = (v: number) =>
  v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)}jt` : v >= 1_000 ? `${(v / 1_000).toFixed(0)}rb` : String(v);

export default function AdminAnalyticsPage() {
  const { data, isLoading } = useQuery({ queryKey: ["admin-analytics"], queryFn: fetchAnalytics });
  const series = data?.series ?? [];

  const totalNewUsers = series.reduce((sum, p) => sum + p.newUsers, 0);
  const totalTopup = series.reduce((sum, p) => sum + p.topupRevenue, 0);
  const totalUsage = series.reduce((sum, p) => sum + p.usageRevenue, 0);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">New Signups (12mo)</p>
            <p className="text-2xl font-semibold mt-1">{totalNewUsers}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">Top-up Revenue (12mo)</p>
            <p className="text-2xl font-semibold mt-1">{formatCurrency(totalTopup)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">Usage Revenue (12mo)</p>
            <p className="text-2xl font-semibold mt-1">{formatCurrency(totalUsage)}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">User Growth</CardTitle>
          <CardDescription>New signups per month, with cumulative total users.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-72 w-full" />
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <ComposedChart data={series} margin={{ left: -10 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="month" fontSize={12} tickLine={false} />
                <YAxis yAxisId="left" fontSize={12} tickLine={false} allowDecimals={false} />
                <YAxis yAxisId="right" orientation="right" fontSize={12} tickLine={false} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ borderRadius: 8, fontSize: 12 }}
                  labelClassName="font-medium"
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar yAxisId="left" dataKey="newUsers" name="New Users" fill="hsl(221 83% 53%)" radius={[4, 4, 0, 0]} barSize={24} />
                <Line yAxisId="right" type="monotone" dataKey="totalUsers" name="Total Users" stroke="hsl(38 92% 50%)" strokeWidth={2} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Revenue Growth</CardTitle>
          <CardDescription>Wallet top-ups vs. metered usage charges, per month (IDR).</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-72 w-full" />
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <ComposedChart data={series} margin={{ left: -10 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="month" fontSize={12} tickLine={false} />
                <YAxis fontSize={12} tickLine={false} tickFormatter={currencyTick} />
                <Tooltip
                  formatter={(value: number) => formatCurrency(value)}
                  contentStyle={{ borderRadius: 8, fontSize: 12 }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="topupRevenue" name="Top-up Revenue" stackId="rev" fill="hsl(221 83% 53%)" radius={[0, 0, 0, 0]} />
                <Bar dataKey="usageRevenue" name="Usage Revenue" stackId="rev" fill="hsl(142 71% 45%)" radius={[4, 4, 0, 0]} />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
