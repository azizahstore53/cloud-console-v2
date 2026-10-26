"use client";

import React, { useState, useEffect } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Server, ShieldCheck, PlayCircle, Save } from "lucide-react";

export default function VpnSettingsPage() {
  const [loading, setLoading] = useState(false);
  const [provisioning, setProvisioning] = useState(false);
  const [authMethod, setAuthMethod] = useState<"password" | "key">("password");

  const [formData, setFormData] = useState({
    name: "",
    publicIp: "",
    sshUser: "root",
    sshPassword: "",
    sshPrivateKey: "",
    wireguardPort: "51820",
  });

  useEffect(() => {
    async function loadSettings() {
      try {
        const res = await fetch("/api/vpn/settings");
        if (res.ok) {
          const data = await res.json();
          setFormData(prev => ({
            ...prev,
            publicIp: data.publicIp || "",
            sshUser: data.sshUser || "root",
            wireguardPort: data.wireguardPort?.toString() || "51820",
            name: data.name || "",
          }));
          if (data.hasPrivateKey) setAuthMethod("key");
          else if (data.hasPassword) setAuthMethod("password");
        }
      } catch (e) {
        console.error("Failed to load settings", e);
      }
    }
    loadSettings();
  }, []);

  const handleTestConnection = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/vpn/settings/test", {
        method: "POST",
        body: JSON.stringify({
          publicIp: formData.publicIp,
          sshUser: formData.sshUser,
          sshPassword: formData.sshPassword,
          sshPrivateKey: formData.sshPrivateKey,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message || "SSH Connection Successful!");
      } else {
        toast.error(data.error || data.message || "Connection failed");
      }
    } catch (e) {
      toast.error("An error occurred during connection test");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSettings = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/vpn/settings", {
        method: "POST",
        body: JSON.stringify(formData),
      });
      if (res.ok) {
        toast.success("VPN Server settings saved successfully");
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to save settings");
      }
    } catch (e) {
      toast.error("An error occurred while saving");
    } finally {
      setLoading(false);
    }
  };

  const handleProvision = async () => {
    if (!confirm("This will install WireGuard and configure your VPS. This may take a few minutes. Proceed?")) {
      return;
    }
    setProvisioning(true);
    try {
      const res = await fetch("/api/vpn/settings/provision", {
        method: "POST",
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success("Gateway provisioned successfully! Your VPS is now a WireGuard server.");
      } else {
        toast.error(data.error || "Provisioning failed");
      }
    } catch (e) {
      toast.error("An error occurred during provisioning");
    } finally {
      setProvisioning(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">VPN Gateway Settings</h1>
          <p className="text-muted-foreground">Configure your WireGuard VPS server credentials and automate setup.</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Server className="w-5 h-5" />
            Server Connection
          </CardTitle>
          <CardDescription>
            Enter the SSH credentials for your VPS. The system will use these to manage the VPN tunnel.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label>Server Name</Label>
              <Input
                value={formData.name}
                onChange={e => setFormData({...formData, name: e.target.value})}
                placeholder="e.g. Primary Gateway SG"
              />
            </div>
            <div className="space-y-2">
              <Label>Public IP Address</Label>
              <Input
                value={formData.publicIp}
                onChange={e => setFormData({...formData, publicIp: e.target.value})}
                placeholder="1.2.3.4"
              />
            </div>
            <div className="space-y-2">
              <Label>SSH Username</Label>
              <Input
                value={formData.sshUser}
                onChange={e => setFormData({...formData, sshUser: e.target.value})}
                placeholder="root"
              />
            </div>
            <div className="space-y-2">
              <Label>WireGuard Port</Label>
              <Input
                type="number"
                value={formData.wireguardPort}
                onChange={e => setFormData({...formData, wireguardPort: e.target.value})}
              />
            </div>
          </div>

          <div className="space-y-4">
            <Label>Authentication Method</Label>
            <Tabs value={authMethod} onValueChange={(v: any) => setAuthMethod(v)}>
              <TabsList>
                <TabsTrigger value="password">Password</TabsTrigger>
                <TabsTrigger value="key">SSH Private Key</TabsTrigger>
              </TabsList>
              <TabsContent value="password" className="pt-4">
                <div className="space-y-2">
                  <Label>SSH Password</Label>
                  <Input
                    type="password"
                    value={formData.sshPassword}
                    onChange={e => setFormData({...formData, sshPassword: e.target.value})}
                    placeholder="Enter SSH password"
                  />
                </div>
              </TabsContent>
              <TabsContent value="key" className="pt-4">
                <div className="space-y-2">
                  <Label>SSH Private Key</Label>
                  <Textarea
                    rows={6}
                    value={formData.sshPrivateKey}
                    onChange={e => setFormData({...formData, sshPrivateKey: e.target.value})}
                    placeholder="-----BEGIN OPENSSH PRIVATE KEY----- ..."
                  />
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </CardContent>
        <CardFooter className="flex gap-3 justify-end border-t p-6">
          <Button
            variant="outline"
            onClick={handleTestConnection}
            disabled={loading}
            className="flex items-center gap-2"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
            Test Connection
          </Button>
          <Button
            onClick={handleSaveSettings}
            disabled={loading}
            className="flex items-center gap-2"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save Settings
          </Button>
        </CardFooter>
      </Card>

      <Card className="border-primary/50 bg-primary/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-primary">
            <PlayCircle className="w-5 h-5" />
            Automated Gateway Provisioning
          </CardTitle>
          <CardDescription>
            This button will connect to your VPS, install WireGuard, set up IP forwarding, and configure the firewall.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            Warning: This process will modify system files on your VPS. Please ensure you have a backup or are using a fresh server.
          </p>
          <Button
            onClick={handleProvision}
            disabled={provisioning}
            className="w-full md:w-auto bg-primary hover:bg-primary/90 text-white"
          >
            {provisioning ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                Installing WireGuard...
              </>
            ) : (
              "Configure Gateway Now"
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
