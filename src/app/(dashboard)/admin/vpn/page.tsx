"use client";

import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, Server, Trash2 } from "lucide-react";
import { toast } from "sonner";

export default function VpnServerAdminPage() {
  const [servers, setServers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    publicIp: "",
    privateKey: "",
    publicKey: "",
    sshPrivateKey: "",
  });

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
      }
    } catch (error) {
      toast.error("Failed to fetch VPN servers");
    } finally {
      setLoading(false);
    }
  }

  async function handleAddServer() {
    try {
      const res = await fetch("/api/vpn/servers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to add server");
      }

      toast.success("VPN Server added successfully");
      setFormData({ name: "", publicIp: "", privateKey: "", publicKey: "", sshPrivateKey: "" });
      setIsAdding(false);
      await fetchServers();
    } catch (error: any) {
      toast.error(error.message);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">VPN Gateway Management</h1>
          <p className="text-muted-foreground text-sm mt-1">Add and manage your VPN gateway servers.</p>
        </div>
        <Button onClick={() => setIsAdding(true)} className="gap-2">
          <Plus className="h-4 w-4" /> Add VPN Server
        </Button>
      </div>

      {isAdding && (
        <Card className="border-primary/50 bg-primary/5">
          <CardHeader>
            <CardTitle className="text-lg">Add New VPN Gateway</CardTitle>
            <CardDescription>Enter server details to enable VPN provisioning.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Server Name</Label>
                <Input
                  placeholder="SG-VPN-01"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Public IP Address</Label>
                <Input
                  placeholder="1.2.3.4"
                  value={formData.publicIp}
                  onChange={(e) => setFormData({ ...formData, publicIp: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>VPN Private Key</Label>
                <Input
                  type="password"
                  placeholder="Enter private key"
                  value={formData.privateKey}
                  onChange={(e) => setFormData({ ...formData, privateKey: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>VPN Public Key</Label>
                <Input
                  placeholder="Enter public key"
                  value={formData.publicKey}
                  onChange={(e) => setFormData({ ...formData, publicKey: e.target.value })}
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>SSH Private Key (Optional)</Label>
                <Input
                  type="password"
                  placeholder="Enter SSH private key for management"
                  value={formData.sshPrivateKey}
                  onChange={(e) => setFormData({ ...formData, sshPrivateKey: e.target.value })}
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <Button variant="outline" onClick={() => setIsAdding(false)}>Cancel</Button>
              <Button onClick={handleAddServer} className="gap-2">
                <Plus className="h-4 w-4" /> Save Server
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Active VPN Gateways</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : servers.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              <Server className="h-10 w-10 mx-auto mb-3 opacity-20" />
              <p>No VPN servers configured yet.</p>
              <p className="text-xs mt-1">Please add a server to enable VPN services.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Server Name</TableHead>
                  <TableHead>Public IP</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {servers.map((server) => (
                  <TableRow key={server.id}>
                    <TableCell className="font-medium">{server.name}</TableCell>
                    <TableCell className="font-mono text-xs">{server.publicIp}</TableCell>
                    <TableCell>
                      <Badge variant={server.isActive ? "success" : "destructive"}>
                        {server.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </Card>
    </div>
  );
}
