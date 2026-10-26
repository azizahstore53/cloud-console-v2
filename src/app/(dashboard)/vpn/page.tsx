"use client";

import React, { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Download, Shield, Server, Globe, Copy, RefreshCw, Trash2, Terminal, Plus } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";

function VpnDashboard() {
  const [loading, setLoading] = useState(true);
  const [vpnData, setVpnData] = useState<any>(null);
  const [isProvisioning, setIsProvisioning] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);

  // State for multi-port mappings
  const [portMappings, setPortMappings] = useState([{ publicPort: 80, localPort: 80 }]);

  const addPort = () => setPortMappings([...portMappings, { publicPort: 80, localPort: 80 }]);
  const removePort = (index: number) => {
    if (portMappings.length > 1) {
      setPortMappings(portMappings.filter((_, i) => i !== index));
    }
  };
  const updatePort = (index: number, field: "publicPort" | "localPort", value: number) => {
    const newPorts = [...portMappings];
    newPorts[index][field] = value;
    setPortMappings(newPorts);
  };

  useEffect(() => {
    fetchVpnStatus();
  }, []);

  async function fetchVpnStatus() {
    setLoading(true);
    try {
      const res = await fetch("/api/vpn");
      if (res.status === 404) {
        setVpnData(null);
      } else if (res.ok) {
        const data = await res.json();
        if (data && data.status === "ACTIVE") {
          setVpnData(data);
        } else {
          setVpnData(null);
        }
      }
    } catch (err) {
      toast.error("Failed to fetch VPN status");
    } finally {
      setLoading(false);
    }
  }

  async function handleProvision() {
    setIsProvisioning(true);
    try {
      const res = await fetch("/api/vpn", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ portMappings }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Provisioning failed");
      }

      const data = await res.json();
      toast.success("VPN Tunnel provisioned successfully!");
      setVpnData(data.client);
      await fetchVpnStatus();
    } catch (err: any) {
      toast.error(err.message || "Provisioning failed");
    } finally {
      setIsProvisioning(false);
    }
  }

  async function handleDisconnect() {
    if (!confirm("Are you sure you want to disconnect your VPN tunnel? This will remove your public access.")) {
      return;
    }

    setIsDisconnecting(true);
    try {
      const res = await fetch("/api/vpn", {
        method: "DELETE",
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Failed to disconnect tunnel");
      }

      toast.success("VPN tunnel disconnected successfully");
      setVpnData(null);
      await fetchVpnStatus();
    } catch (err: any) {
      toast.error(err.message || "Disconnection failed");
    } finally {
      setIsDisconnecting(false);
    }
  }

  function downloadConfig() {
    if (!vpnData?.config) return;
    const blob = new Blob([vpnData.config], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "wg0.conf";
    a.click();
    URL.revokeObjectURL(url);
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const installCmd = `curl -sSL ${typeof window !== "undefined" ? window.location.origin : ""} /api/vpn/install?token=${vpnData?.installToken} | bash`;

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight">VPN Tunneling</h1>
          <p className="text-muted-foreground">Connect your local server to the cloud and make it accessible via a public IP.</p>
        </div>
        <div className="flex gap-2">
           <Badge variant={vpnData ? "default" : "outline"}>
            {vpnData ? "Connected" : "No Tunnel"}
           </Badge>
        </div>
      </div>

      {!vpnData ? (
        <Card className="max-w-2xl border-2">
          <CardHeader>
            <CardTitle>Provision New Tunnel</CardTitle>
            <CardDescription>
              Activate your secure tunnel and get a public IP address automatically.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold uppercase text-muted-foreground">Port Mappings</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addPort}
                  className="h-7 px-2 text-xs gap-1"
                >
                  <Plus className="h-3 w-3" /> Add Port
                </Button>
              </div>

              <div className="space-y-3">
                {portMappings.map((mapping, index) => (
                  <div key={index} className="flex items-end gap-3 p-3 border rounded-lg bg-muted/20 animate-in fade-in slide-in-from-left-2 duration-200">
                    <div className="flex-1 space-y-2">
                      <Label className="text-[10px] font-bold uppercase text-muted-foreground">Public Port</Label>
                      <Input
                        type="number"
                        value={mapping.publicPort}
                        onChange={(e) => updatePort(index, "publicPort", parseInt(e.target.value) || 0)}
                        className="h-9"
                        placeholder="e.g. 80"
                      />
                    </div>
                    <div className="flex items-center mb-2 text-muted-foreground">
                      <RefreshCw className="h-4 w-4 rotate-90" />
                    </div>
                    <div className="flex-1 space-y-2">
                      <Label className="text-[10px] font-bold uppercase text-muted-foreground">Local Port</Label>
                      <Input
                        type="number"
                        value={mapping.localPort}
                        onChange={(e) => updatePort(index, "localPort", parseInt(e.target.value) || 0)}
                        className="h-9"
                        placeholder="e.g. 3000"
                      />
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removePort(index)}
                      disabled={portMappings.length === 1}
                      className="h-9 w-9 text-destructive hover:text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-muted-foreground italic">
                Add as many ports as you need. Each public port will route to your specified local port.
              </p>
            </div>

            <div className="flex justify-center py-4">
              <Button
                size="lg"
                onClick={handleProvision}
                disabled={isProvisioning}
                className="px-8 py-6 text-lg font-semibold"
              >
                {isProvisioning ? (
                  <><RefreshCw className="mr-2 h-5 w-5 animate-spin" /> Provisioning...</>
                ) : (
                  "Create Tunnel Now"
                )}
              </Button>
            </div>
            <div className="bg-muted/50 p-4 rounded-lg text-sm text-muted-foreground space-y-2 border">
              <p className="font-semibold text-foreground">Quick Setup Guide:</p>
              <ul className="list-decimal pl-4 space-y-1">
                <li>Define your <b className="text-foreground">Public & Local Port Mappings</b>.</li>
                <li>Click <b className="text-foreground">"Create Tunnel Now"</b> above.</li>
                <li>Once created, copy the <b className="text-foreground">Installation Command</b>.</li>
                <li>Run the command on your local server (Linux) as root.</li>
                <li>Your local app will be instantly available via the allocated Public IP and mapped Public Ports.</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
              <div className="space-y-1">
                <CardTitle className="flex items-center gap-2 text-xl">
                  <Shield className="h-5 w-5 text-primary" />
                  Active Tunnel Configuration
                </CardTitle>
                <CardDescription>Your secure connection to our VPS Gateway is established.</CardDescription>
              </div>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleDisconnect}
                disabled={isDisconnecting}
                className="gap-2"
              >
                <Trash2 className="h-4 w-4" />
                {isDisconnecting ? "Disconnecting..." : "Disconnect"}
              </Button>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1 p-4 border rounded-xl bg-card">
                  <span className="text-xs font-medium text-muted-foreground flex items-center gap-1 uppercase tracking-wider">
                    <Globe className="h-3 w-3" /> Public IP Address
                  </span>
                  <div className="flex items-center justify-between mt-1">
                    <span className="font-mono text-lg font-semibold">{vpnData.publicIp}</span>
                    <Button variant="ghost" size="icon" onClick={() => copyToClipboard(vpnData.publicIp)}>
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div className="space-y-1 p-4 border rounded-xl bg-card">
                  <span className="text-xs font-medium text-muted-foreground flex items-center gap-1 uppercase tracking-wider">
                    <Server className="h-3 w-3" /> Internal Tunnel IP
                  </span>
                  <div className="flex items-center justify-between mt-1">
                    <span className="font-mono text-lg font-semibold">{vpnData.internalIp}</span>
                    <Button variant="ghost" size="icon" onClick={() => copyToClipboard(vpnData.internalIp)}>
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold">WireGuard Configuration</h3>
                  <Button variant="outline" size="sm" onClick={downloadConfig} className="gap-2">
                    <Download className="h-4 w-4" /> Download .conf
                  </Button>
                </div>
                <div className="bg-muted p-4 rounded-xl overflow-auto max-h-60 font-mono text-xs border">
                  <pre>{vpnData.config}</pre>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Quick Install</CardTitle>
                <CardDescription>Run this command on your local server as root.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="bg-black text-green-400 p-3 rounded-lg font-mono text-xs relative group">
                  <code className="block whitespace-pre-wrap break-all">
                    {installCmd}
                  </code>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute top-2 right-2 h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => copyToClipboard(installCmd)}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Terminal className="h-3 w-3" />
                  <span>One-liner installation script</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Mobile Connect</CardTitle>
                <CardDescription>Scan with WireGuard App</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col items-center justify-center space-y-4">
                <div className="bg-white p-3 rounded-xl shadow-sm border">
                  <QRCodeSVG value={vpnData.config} size={160} />
                </div>
                <p className="text-[10px] text-center text-muted-foreground italic">
                  Scan this QR code to automatically import the tunnel config on your device.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}

export default VpnDashboard;
