"use client";

import React, { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Globe, Plus, Trash2, RefreshCw, Database, CheckCircle2, XCircle } from "lucide-react";

function VpnPoolManagement() {
  const [loading, setLoading] = useState(true);
  const [ipList, setIpList] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [ipInput, setIpInput] = useState("");
  const [isAdding, setIsAdding] = useState(false);

  useEffect(() => {
    fetchPoolData();
  }, []);

  async function fetchPoolData() {
    setLoading(true);
    try {
      const res = await fetch("/api/vpn/pool");
      if (res.ok) {
        const data = await res.json();
        setSummary(data.summary);
        setIpList(data.ips);
      } else {
        toast.error("Failed to fetch IP pool data");
      }
    } catch (err) {
      toast.error("An error occurred while fetching data");
    } finally {
      setLoading(false);
    }
  }

  async function handleAddIps() {
    if (!ipInput) return;

    setIsAdding(true);
    try {
      // Support bulk input separated by commas or newlines
      const ips = ipInput
        .split(/[\n,]+/)
        .map(ip => ip.trim())
        .filter(ip => ip.length > 0);

      const res = await fetch("/api/vpn/pool", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ips }),
      });

      if (!res.ok) throw new Error(await res.text());

      toast.success("IP addresses added to pool successfully!");
      setIpInput("");
      await fetchPoolData();
    } catch (err: any) {
      toast.error(err.message || "Failed to add IPs");
    } finally {
      setIsAdding(false);
    }
  }

  async function handleDeleteIp(id: string) {
    if (!confirm("Are you sure you want to remove this IP from the pool?")) return;

    try {
      const res = await fetch(`/api/vpn/pool?id=${id}`, {
        method: "DELETE",
      });

      if (!res.ok) throw new Error(await res.text());

      toast.success("IP removed successfully");
      await fetchPoolData();
    } catch (err: any) {
      toast.error(err.message || "Failed to remove IP");
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight">VPN Public IP Pool</h1>
          <p className="text-muted-foreground">Manage the stock of public IP addresses for customer tunnels.</p>
        </div>
        <Button onClick={fetchPoolData} variant="outline" size="sm" className="gap-2">
          <RefreshCw className="h-4 w-4" /> Refresh
        </Button>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="text-xs uppercase font-semibold">Total IP Stock</CardDescription>
            <CardTitle className="text-3xl">{summary?.total || 0}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="text-xs uppercase font-semibold text-green-600">Available</CardDescription>
            <CardTitle className="text-3xl text-green-600">{summary?.available || 0}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="text-xs uppercase font-semibold text-blue-600">In Use</CardDescription>
            <CardTitle className="text-3xl text-blue-600">{summary?.used || 0}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Add IP Form */}
        <Card className="lg:col-span-1 h-fit">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Plus className="h-5 w-5" /> Add IP Stock
            </CardTitle>
            <CardDescription>
              Add new public IPs to the pool. Supports bulk input (comma or newline separated).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="ipInput">Public IP Address(es)</Label>
              <textarea
                id="ipInput"
                className="flex min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                placeholder="e.g. 1.2.3.4&#10;1.2.3.5&#10;1.2.3.6"
                value={ipInput}
                onChange={(e) => setIpInput(e.target.value)}
              />
            </div>
            <Button onClick={handleAddIps} disabled={isAdding} className="w-full">
              {isAdding ? "Adding..." : "Add to Pool"}
            </Button>
          </CardContent>
        </Card>

        {/* IP List Table */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Database className="h-5 w-5" /> IP Inventory
            </CardTitle>
            <CardDescription>List of all registered public IPs and their current usage status.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left p-3 font-medium text-muted-foreground uppercase text-xs">Public IP</th>
                    <th className="text-center p-3 font-medium text-muted-foreground uppercase text-xs">Status</th>
                    <th className="text-right p-3 font-medium text-muted-foreground uppercase text-xs">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {ipList.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="p-8 text-center text-muted-foreground">
                        No IP addresses found in the pool.
                      </td>
                    </tr>
                  ) : (
                    ipList.map((ip) => (
                      <tr key={ip.id} className="hover:bg-muted/30 transition-colors">
                        <td className="p-3 font-mono font-medium">{ip.ipAddress}</td>
                        <td className="p-3 text-center">
                          {ip.isUsed ? (
                            <Badge variant="secondary" className="bg-blue-100 text-blue-700 hover:bg-blue-100">
                              <div className="flex items-center gap-1">
                                <XCircle className="h-3 w-3" /> In Use
                              </div>
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                              <div className="flex items-center gap-1">
                                <CheckCircle2 className="h-3 w-3" /> Available
                              </div>
                            </Badge>
                          )}
                        </td>
                        <td className="p-3 text-right">
                          {!ip.isUsed && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteIp(ip.id)}
                              className="text-destructive hover:text-destructive hover:bg-destructive/10"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default VpnPoolManagement;
