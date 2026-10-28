"use client";

import React, { useState, useEffect } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Server, ShieldCheck, PlayCircle, Save, Plus, Trash2, ChevronRight } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

export default function VpnSettingsPage() {
  const [loading, setLoading] = useState(false);
  const [provisioning, setProvisioning] = useState(false);
  const [servers, setServers] = useState([]);
  const [selectedServer, setSelectedServer] = useState(null);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
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
    loadServers();
  }, []);

  async function loadServers() {
    setLoading(true);
    try {
      const res = await fetch("/api/vpn/servers");
      if (res.ok) {
        const data = await res.json();
        setServers(data);
      }
    } catch (e) {
      console.error("Failed to load servers", e);
    } finally {
      setLoading(false);
    }
  }

  const handleSelectServer = (server: any) => {
    setSelectedServer(server);
    setFormData({
      name: server.name || "",
      publicIp: server.publicIp || "",
      sshUser: server.sshUser || "root",
      sshPassword: "", // Never load passwords from API
      sshPrivateKey: "", // Never load keys from API
      wireguardPort: server.wireguardPort?.toString() || "51820",
    });

    if (server.hasPrivateKey) setAuthMethod("key");
    else setAuthMethod("password");
  };

  const handleAddServer = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/vpn/servers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      if (res.ok) {
        toast.success("Server added successfully");
        await loadServers();
        setIsAddDialogOpen(false);
        setFormData({
          name: "",
          publicIp: "",
          sshUser: "root",
          sshPassword: "",
          sshPrivateKey: "",
          wireguardPort: "51820",
        });
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to add server");
      }
    } catch (e) {
      toast.error("An error occurred while adding server");
    } finally {
      setLoading(false);
    }
  };

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
      // We use the settings API for updates as it handles upsert
      const res = await fetch("/api/vpn/settings", {
        method: "POST",
        body: JSON.stringify(formData),
      });
      if (res.ok) {
        toast.success("VPN Server settings saved successfully");
        await loadServers();
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
        await loadServers();
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
          <h1 className="text-3xl font-bold tracking-tight">VPN Gateway Management</h1>
          <p className="text-muted-foreground">Manage your WireGuard VPS servers and automate their setup.</p>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button className="flex items-center gap-2">
              <Plus className="w-4 h-4" /> Add New Server
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add VPN Server</DialogTitle>
              <DialogDescription>Enter the basic details to register a new server.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
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
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleAddServer} disabled={loading}>
                {loading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                Add Server
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Server className="w-5 h-5" />
            VPN Servers
          </CardTitle>
          <CardDescription>List of all registered VPN Gateways in your infrastructure.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading && servers.length === 0 ? (
            <div className="flex justify-center py-10">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Public IP</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {servers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-10 text-muted-foreground">
                      No servers found. Add your first VPN server to get started.
                    </TableCell>
                  </TableRow>
                ) : (
                  servers.map((server: any) => (
                    <TableRow key={server.id} className={selectedServer?.id === server.id ? "bg-primary/10" : ""}>
                      <TableCell className="font-medium">{server.name}</TableCell>
                      <TableCell>{server.publicIp}</TableCell>
                      <TableCell>
                        <span className={`px-2 py-1 rounded-full text-xs ${server.isActive ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                          {server.isActive ? "Active" : "Inactive"}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleSelectServer(server)}
                          className="flex items-center gap-1"
                        >
                          Manage <ChevronRight className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {selectedServer && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5" />
                Configuration for {selectedServer.name}
              </CardTitle>
              <CardDescription>
                Fine-tune SSH access and WireGuard settings for this specific gateway.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label>Server Name</Label>
                  <Input
                    value={formData.name}
                    onChange={e => setFormData({...formData, name: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Public IP Address</Label>
                  <Input
                    value={formData.publicIp}
                    readOnly
                    className="bg-muted"
                  />
                </div>
                <div className="space-y-2">
                  <Label>SSH Username</Label>
                  <Input
                    value={formData.sshUser}
                    onChange={e => setFormData({...formData, sshUser: e.target.value})}
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

          <Card className="border-primary/50 bg-primary/5 h-fit">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-primary">
                <PlayCircle className="w-5 h-5" />
                Provisioning
              </CardTitle>
              <CardDescription>
                Automate WireGuard installation on this server.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                This will connect to <strong>{selectedServer.publicIp}</strong> and perform the full setup.
              </p>
              <Button
                onClick={handleProvision}
                disabled={provisioning}
                className="w-full bg-primary hover:bg-primary/90 text-white"
              >
                {provisioning ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    Installing...
                  </>
                ) : (
                  "Configure Gateway Now"
                )}
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
