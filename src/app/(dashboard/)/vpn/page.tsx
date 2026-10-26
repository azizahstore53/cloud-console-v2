"use client";

import React, { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Download, Shield, Server, Globe, Copy, RefreshCw, Trash2, Terminal } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";

function VpnDashboard() {
  const [loading, setLoading] = useState(true);
  const [vpnData, setVpnData] = useState<any>(null);
  const [isProvisioning, setIsProvisioning] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);

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
        setVpnData(data);
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
        body: JSON.stringify({}), // Public IP is now allocated automatically by backend
      });

      if (!res.ok) throw new Error(await res.text());

      const data = await res.json();
      toast.success("VPN Tunnel provisioned successfully!");
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

      if (!res.ok) throw new Error(await res.text());

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
              Instantly map your local server to one of our available VPS Gateway Public IPs.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 py-16 text-center">
            <div className="space-y-4 max-w-sm mx-auto">
              <p className="text-sm text-muted-foreground">
                Click the button below to automatically allocate a public IP and create your secure tunnel.
              </p>
              <Button onClick={handleProvision} disabled={isProvisioning} className="w-full">
                {isProvisioning ? "Provisioning..." : "Create Tunnel Now"}
              </Button>
            </div>
            <div className="bg-muted/50 p-4 rounded-lg text-sm text-muted-foreground space-y-2 border inline-block text-left max-w-md mx-auto">
              <p className="font-semibold text-foreground">Quick Setup Guide:</p>
              <ul className="list-decimal pl-4 space-y-1">
                <li>Click <b className="text-foreground">Create Tunnel</b> to allocate your IP.</li>
                <li>Once created, copy the <b className="text-foreground">Installation Command</b>.</li>
                <li>Run the command on your local server (Linux) as root.</li>
                <li>Your local port 80 will be instantly available on your new Public IP.</li>
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
