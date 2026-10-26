"use client";

import React, { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Globe, Plus, Trash2, RefreshCw, Database,
  CheckCircle2, XCircle, Users,
  CreditCard, Server as ServerIcon, LayoutDashboard
} from "lucide-react";

// VERSION_2_WITH_PASSWORD - Updated to include SSH Password field
function GatewaySetupSection() {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    publicIp: "",
    sshPrivateKey: "",
    sshPassword: "",
    wireguardPort: 51820,
  });

  async function handleSetup() {
    if (!formData.publicIp || (!formData.sshPrivateKey && !formData.sshPassword)) {
      toast.error("Please provide Public IP and either SSH Private Key or Password");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/vpn/setup-gateway", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          sshUser: "serverwg",
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      toast.success("VPN Gateway setup successfully!");
    } catch (err: any) {
      toast.error(err.message || "Gateway setup failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <Card className="max-w-2xl mx-auto shadow-sm">
        <CardHeader>
          <CardTitle className="text-xl flex items-center gap-2">
            <ServerIcon className="h-5 w-5 text-primary" /> Initial Gateway Setup
          </CardTitle>
          <CardDescription>
            Provision a VPS to act as your VPN Gateway. The system will automatically install WireGuard and configure the network.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4">
            <div className="space-y-2">
              <Label htmlFor="publicIp">VPS Public IP Address</Label>
              <Input
                id="publicIp"
                placeholder="e.g. 1.2.3.4"
                value={formData.publicIp}
                onChange={(e) => setFormData({...formData, publicIp: e.target.value})}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sshPrivateKey">SSH Private Key (Optional)</Label>
              <textarea
                id="sshPrivateKey"
                className="flex min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono focus-visible:outline-none focus-visible:ring-ring"
                placeholder="-----BEGIN RSA PRIVATE KEY-----..."
                value={formData.sshPrivateKey}
                onChange={(e) => setFormData({...formData, sshPrivateKey: e.target.value})}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sshPassword">SSH Password (Optional)</Label>
              <Input
                id="sshPassword"
                type="password"
                placeholder="Enter SSH password for serverwg"
                value={formData.sshPassword}
                onChange={(e) => setFormData({...formData, sshPassword: e.target.value})}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="wireguardPort">WireGuard Listen Port</Label>
              <Input
                id="wireguardPort"
                type="number"
                value={formData.wireguardPort}
                onChange={(e) => setFormData({...formData, wireguardPort: parseInt(e.target.value)})}
              />
            </div>
          </div>
          <Button
            onClick={handleSetup}
            disabled={loading}
            className="w-full font-semibold py-6 text-lg"
          >
            {loading ? (
              <><RefreshCw className="mr-2 h-5 w-5 animate-spin" /> Provisioning Gateway...</>
            ) : (
              "Start Automated Setup"
            )}
          </Button>
          <div className="p-4 bg-muted/50 rounded-lg text-xs text-muted-foreground border space-y-2">
            <p className="font-semibold">Technical Requirements:</p>
            <ul className="list-disc pl-4 space-y-1">
              <li>Server must be running <b>Ubuntu/Debian</b>.</li>
              <li>SSH access must be enabled for the <b>serverwg</b> user.</li>
              <li>VPS must have a public IP and permit UDP traffic on the specified port.</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function GatewayListSection() {
  const [loading, setLoading] = useState(true);
  const [servers, setServers] = useState<any[]>([]);

  useEffect(() => {
    fetchServers();
  }, []);

  async function fetchServers() {
    setLoading(true);
    try {
      const res = await fetch("/api/vpn/servers");
      if (res.ok) {
        const data = await res.json();
        setServers(data);
      } else {
        toast.error("Failed to fetch gateway servers");
      }
    } catch (err) {
      toast.error("An error occurred while fetching servers");
    } finally {
      setLoading(false);
    }
  }

  if (loading) return (
    <div className="flex justify-center p-12">
      <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  );

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {servers.length === 0 ? (
          <div className="col-span-full text-center py-20 bg-muted/20 rounded-xl border-2 border-dashed">
            <ServerIcon className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium">No Gateways Found</h3>
            <p className="text-muted-foreground">Setup your first gateway in the "Setup Gateway" tab.</p>
          </div>
        ) : (
          servers.map((server) => (
            <Card key={server.id} className="shadow-sm overflow-hidden">
              <CardHeader className="pb-2">
                <div className="flex justify-between items-start">
                  <CardTitle className="text-lg font-bold">{server.name}</CardTitle>
                  <Badge variant={server.isActive ? "default" : "secondary"}>
                    {server.isActive ? "Active" : "Inactive"}
                  </Badge>
                </div>
                <CardDescription className="font-mono text-xs">{server.publicIp}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">WG Port:</span>
                  <span className="font-medium">{server.wireguardPort}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Public Key:</span>
                  <span className="font-mono text-[10px] truncate ml-4 max-w-[150px]">{server.publicKey}</span>
                </div>
                <div className="pt-2 border-t flex justify-end">
                   <Button variant="ghost" size="sm" onClick={fetchServers}>
                     <RefreshCw className="h-3 w-3 mr-2" /> Refresh
                   </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}

function VpnPoolSection() {
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
      const ips = ipInput.split(/[\n,]+/).map(ip => ip.trim()).filter(ip => ip.length > 0);
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
      const res = await fetch(`/api/vpn/pool?id=${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(await res.text());
      toast.success("IP removed successfully");
      await fetchPoolData();
    } catch (err: any) {
      toast.error("An error occurred while removing IP");
    } finally {
      setLoading(false);
    }
  }

  if (loading) return (
    <div className="flex justify-center p-12">
      <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  );

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-card border-l-4 border-l-blue-500 shadow-sm">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs uppercase font-bold tracking-wider text-muted-foreground">Total IP Stock</CardDescription>
            <CardTitle className="text-3xl font-bold">{summary?.total || 0}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="bg-card border-l-4 border-l-green-500 shadow-sm">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs uppercase font-bold tracking-wider text-green-600">Available</CardDescription>
            <CardTitle className="text-3xl font-bold text-green-600">{summary?.available || 0}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="bg-card border-l-4 border-l-orange-500 shadow-sm">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs uppercase font-bold tracking-wider text-orange-600">In Use</CardDescription>
            <CardTitle className="text-3xl font-bold text-orange-600">{summary?.used || 0}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1 h-fit shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Plus className="h-5 w-5 text-primary" /> Add IP Stock
            </CardTitle>
            <CardDescription>Inject new public IP addresses into the platform pool.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="ipInput" className="text-xs font-semibold uppercase text-muted-foreground">IP Address List</Label>
              <textarea
                id="ipInput"
                className="flex min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                placeholder="1.2.3.4&#10;1.2.3.5"
                value={ipInput}
                onChange={(e) => setIpInput(e.target.value)}
              />
            </div>
            <Button onClick={handleAddIps} disabled={isAdding} className="w-full font-semibold">
              {isAdding ? (
                <><RefreshCw className="mr-2 h-4 w-4 animate-spin" /> Processing...</>
              ) : (
                "Add to Inventory"
              )}
            </Button>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Database className="h-5 w-5 text-primary" /> IP Inventory
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border overflow-hidden bg-card">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 border-b">
                  <tr className="text-left">
                    <th className="p-3 font-semibold text-muted-foreground uppercase text-[10px] tracking-wider">Public IP</th>
                    <th className="p-3 text-center font-semibold text-muted-foreground uppercase text-[10px] tracking-wider">Status</th>
                    <th className="p-3 text-right font-semibold text-muted-foreground uppercase text-[10px] tracking-wider">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {ipList.length === 0 ? (
                    <tr><td colSpan={4} className="p-12 text-center text-muted-foreground italic">No IP addresses available in the pool.</td></tr>
                  ) : (
                    ipList.map((ip) => (
                      <tr key={ip.id} className="hover:bg-muted/40 transition-colors">
                        <td className="p-3 font-mono font-medium">{ip.ipAddress}</td>
                        <td className="p-3 text-center">
                          {ip.isUsed ? (
                            <Badge variant="secondary" className="bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-100">
                              <XCircle className="h-3 w-3 inline mr-1"/> In Use
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 hover:bg-green-50">
                              <CheckCircle2 className="h-3 w-3 inline mr-1"/> Available
                            </Badge>
                          )}
                        </td>
                        <td className="p-3 text-center">
                          {ip.isUsed ? (
                            <Badge
                              variant="outline"
                              className={`${
                                ip.connectionStatus === "ONLINE"
                                  ? "bg-green-50 text-green-600 border-green-200"
                                  : ip.connectionStatus === "OFFLINE"
                                    ? "bg-red-50 text-red-600 border-red-200"
                                    : "bg-gray-50 text-gray-600 border-gray-200"
                              } font-medium`}
                            >
                              {ip.connectionStatus || "UNKNOWN"}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground text-xs">-</span>
                          )}
                        </td>
                        <td className="p-3 text-right">
                          {!ip.isUsed && (
                            <Button variant="ghost" size="sm" onClick={() => handleDeleteIp(ip.id)} className="text-destructive hover:text-destructive hover:bg-destructive/10">
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

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState("vpn");

  const tabs = [
    { id: "setup", label: "Setup Gateway", icon: ServerIcon, color: "text-orange-500" },
    { id: "gateways", label: "Gateways", icon: ServerIcon, color: "text-indigo-500" },
    { id: "vpn", label: "VPN Pool", icon: Globe, color: "text-blue-500" },
    { id: "users", label: "User Management", icon: Users, color: "text-green-500" },
    { id: "billing", label: "Billing/Payments", icon: CreditCard, color: "text-yellow-500" },
    { id: "instances", label: "Compute/VPS", icon: ServerIcon, color: "text-purple-500" },
  ];

  return (
    <div className="space-y-8 p-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <LayoutDashboard className="h-7 w-7 text-primary" />
            </div>
            <h1 className="text-4xl font-extrabold tracking-tight">Admin Control Panel</h1>
          </div>
          <p className="text-muted-foreground text-lg max-w-2xl">
            Centralized infrastructure management. Monitor resources, manage user accounts, and configure platform-wide settings.
          </p>
        </div>
        <Badge variant="outline" className="w-fit px-4 py-1 bg-primary/5 text-primary border-primary/20 font-medium">
          System Administrator
        </Badge>
      </div>

      <div className="flex flex-wrap gap-2 p-1 bg-muted/30 w-fit rounded-xl border">
        {tabs.map(tab => (
          <Button
            key={tab.id}
            variant={activeTab === tab.id ? "default" : "ghost"}
            onClick={() => setActiveTab(tab.id)}
            className={`gap-2 rounded-lg transition-all ${activeTab === tab.id ? "shadow-md" : "text-muted-foreground"}`}
          >
            <tab.icon className={`h-4 w-4 ${activeTab === tab.id ? "text-white" : tab.color}`} />
            <span className="font-medium">{tab.label}</span>
          </Button>
        ))}
      </div>

      <div className="mt-8">
        {activeTab === "setup" && <GatewaySetupSection />}
        {activeTab === "gateways" && <GatewayListSection />}
        {activeTab === "vpn" && <VpnPoolSection />}
        {activeTab === "users" && (
          <div className="flex flex-col items-center justify-center py-32 text-center space-y-4 animate-in slide-in-from-bottom-4 duration-500">
            <div className="p-4 bg-muted rounded-full">
              <Users className="h-12 w-12 text-muted-foreground" />
            </div>
            <div className="space-y-1">
              <h3 className="text-xl font-semibold">User Management</h3>
              <p className="text-muted-foreground max-w-sm">This module is currently under development. Please check back soon.</p>
            </div>
          </div>
        )}
        {activeTab === "billing" && (
          <div className="flex flex-col items-center justify-center py-32 text-center space-y-4 animate-in slide-in-from-bottom-4 duration-500">
            <div className="p-4 bg-muted rounded-full">
              <CreditCard className="h-12 w-12 text-muted-foreground" />
            </div>
            <div className="space-y-1">
              <h3 className="text-xl font-semibold">Billing & Payments</h3>
              <p className="text-muted-foreground max-w-sm">This module is currently under development. Please check back soon.</p>
            </div>
          </div>
        )}
        {activeTab === "instances" && (
          <div className="flex flex-col items-center justify-center py-32 text-center space-y-4 animate-in slide-in-from-bottom-4 duration-500">
            <div className="p-4 bg-muted rounded-full">
              <ServerIcon className="h-12 w-12 text-muted-foreground" />
            </div>
            <div className="space-y-1">
              <h3 className="text-xl font-semibold">Compute Management</h3>
              <p className="text-muted-foreground max-w-sm">This module is currently under development. Please check back soon.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
