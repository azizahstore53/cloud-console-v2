import { prisma } from "../prisma";
import { Client } from "ssh2";
import { VpnServer, VpnStatus } from "@prisma/client";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import os from "os";
import { chargeWallet, refundWallet } from "../billing/calculator";

export interface VpnConfig {
  address: string;
  port: number;
  username: string;
  privateKey?: string;
  password?: string;
}

function getLocalDefaultPrivateKey(): string | undefined {
  const possiblePaths = [
    path.join(os.homedir(), ".ssh", "id_rsa"),
    path.join(os.homedir(), ".ssh", "id_ed25519"),
    "C:\\Users\\Prakom\\.ssh\\id_rsa",
  ];
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      try {
        console.log(`[SSH] Falling back to local private key from: ${p}`);
        return fs.readFileSync(p, "utf8");
      } catch (e) {
        // ignore
      }
    }
  }
  return undefined;
}

export class VpnManagementService {
  private async getSshClient(config: VpnConfig): Promise<Client> {
    const privateKey = config.privateKey?.trim() || getLocalDefaultPrivateKey();
    console.log(`[SSH] Attempting connection to ${config.username}@${config.address}:${config.port || 22} (hasPrivateKey: ${!!privateKey}, hasPassword: ${!!config.password})`);

    return new Promise((resolve, reject) => {
      const conn = new Client();
      conn.on("ready", () => {
            console.log(`[SSH] Connection established successfully to ${config.username}@${config.address}`);
            resolve(conn);
          })
          .on("error", (err: any) => {
            console.error(`[SSH] Connection error to ${config.username}@${config.address}: ${err.message}`);
            reject(err);
          })
          .connect({
            host: config.address,
            port: config.port || 22,
            username: config.username,
            privateKey: privateKey,
            password: config.password,
            readyTimeout: 10000,
            keepaliveInterval: 5000,
          });
    });
  }

  private async getSshClientWithFallback(config: VpnConfig): Promise<Client> {
    try {
      // Try with provided user (e.g. serverwg)
      return await this.getSshClient(config);
    } catch (err) {
      if (config.username && config.username !== "root") {
        console.warn(`${config.username} connection failed, falling back to root...`);
        return this.getSshClient({ ...config, username: "root" });
      }
      throw err;
    }
  }

  private async executeCommand(conn: Client, cmd: string): Promise<string> {
    return new Promise((resolve, reject) => {
      // Prefix all commands with sudo for non-root users
      const sudoCmd = cmd.trim().startsWith("sudo ") ? cmd : `sudo ${cmd}`;
      conn.exec(sudoCmd, (err, stream) => {
        if (err) return reject(err);
        let data = "";
        stream.on("data", (d: any) => { data += d; })
              .on("close", () => resolve(data.trim()))
              .on("error", reject);
      });
    });
  }

  /**
   * Verifies if SSH connection is possible with given credentials.
   */
  async testConnection(config: VpnConfig): Promise<{ success: boolean; message: string }> {
    try {
      const conn = await this.getSshClient(config);
      conn.end();
      return { success: true, message: "SSH connection successful" };
    } catch (err: any) {
      return { success: false, message: err.message || "Connection failed" };
    }
  }

  /**
   * Configures a limited sudo user on the gateway to avoid using root.
   * This should be called once during gateway setup.
   */
  async setupLimitedUser(config: VpnConfig, targetUser: string = "serverwg") {
    try {
      const conn = await this.getSshClient(config);
      try {
        console.log(`Configuring limited sudo user '${targetUser}'...`);

        // 1. Create targetUser if not exists
        await this.executeCommand(conn, `id -u ${targetUser} || useradd -m -s /bin/bash ${targetUser}`);

        // 2. Setup SSH directory for targetUser
        await this.executeCommand(conn, `mkdir -p /home/${targetUser}/.ssh`);
        await this.executeCommand(conn, `chmod 700 /home/${targetUser}/.ssh`);

        // 3. Add authorized_keys from root
        await this.executeCommand(conn, `cp /root/.ssh/authorized_keys /home/${targetUser}/.ssh/authorized_keys || true`);
        await this.executeCommand(conn, `chmod 600 /home/${targetUser}/.ssh/authorized_keys`);
        await this.executeCommand(conn, `chown -R ${targetUser}:${targetUser} /home/${targetUser}/.ssh`);

        // 4. Configure Sudoers for targetUser (Allow wg, iptables, systemctl without password)
        const sudoRules = `${targetUser} ALL=(ALL) NOPASSWD: /usr/bin/wg, /usr/sbin/iptables, /sbin/iptables, /usr/sbin/wg, /usr/bin/systemctl, /bin/systemctl`;
        await this.executeCommand(conn, `echo "${sudoRules}" > /etc/sudoers.d/${targetUser}`);
        await this.executeCommand(conn, `chmod 440 /etc/sudoers.d/${targetUser}`);

        return { success: true };
      } finally {
        conn.end();
      }
    } catch (err: any) {
      console.error("Failed to setup limited user:", err);
      throw new Error(`Limited user setup failed: ${err.message}`);
    }
  }

  /**
   * Automates the initial setup of a VPS to act as a WireGuard Gateway.
   */
  async setupGatewayServer(config: {
    publicIp: string;
    sshUser?: string;
    sshPassword?: string;
    sshPrivateKey?: string;
    wireguardPort?: number;
  }) {
    const { publicIp, sshUser = "root", sshPassword, sshPrivateKey, wireguardPort = 51820 } = config;

    const sshConfig: VpnConfig = {
      address: publicIp,
      port: 22,
      username: sshUser,
      privateKey: sshPrivateKey,
      password: sshPassword,
    };

    try {
      const conn = await this.getSshClient(sshConfig);
      try {
        console.log("Starting automated gateway setup on", publicIp);

        // 1. Update & Install WireGuard
        await this.executeCommand(conn, "apt-get update");
        await this.executeCommand(conn, "apt-get install -y wireguard iptables");

        // 2. Enable IPv4 Forwarding
        await this.executeCommand(conn, "echo 'net.ipv4.ip_forward=1' > /etc/sysctl.d/99-vpn-forwarding.conf");
        await this.executeCommand(conn, "sysctl -p /etc/sysctl.d/99-vpn-forwarding.conf");

        // 3. Generate Server Keys
        await this.executeCommand(conn, "mkdir -p /etc/wireguard");
        await this.executeCommand(conn, "chmod 700 /etc/wireguard");

        // Only generate if doesn't exist
        const existingKey = await this.executeCommand(conn, "cat /etc/wireguard/private.key").catch(() => "");
        let privateKey = existingKey;

        if (!privateKey) {
          privateKey = await this.executeCommand(conn, "wg genkey");
          await this.executeCommand(conn, `echo '${privateKey}' > /etc/wireguard/private.key`);
          await this.executeCommand(conn, "chmod 600 /etc/wireguard/private.key");
        }

        const publicKey = await this.executeCommand(conn, `echo '${privateKey}' | wg pubkey`);

        // 4. Setup wg0 Configuration
        const defaultInterface = await this.executeCommand(conn, "ip route get 8.8.8.8 | awk '{print $5; exit}'");

        const wgConfig = `[Interface]
PrivateKey = ${privateKey}
Address = 10.0.0.1/24
ListenPort = ${wireguardPort}
PostUp = iptables -t nat -A POSTROUTING -o ${defaultInterface} -j MASQUERADE
PostDown = iptables -t nat -D POSTROUTING -o ${defaultInterface} -j MASQUERADE`;

        await this.executeCommand(conn, `echo "${wgConfig}" > /etc/wireguard/wg0.conf`);

        // 5. Start & Enable WireGuard
        await this.executeCommand(conn, "systemctl enable wg-quick@wg0");
        await this.executeCommand(conn, "systemctl restart wg-quick@wg0");

        // 6. Open Firewall Port
        await this.executeCommand(conn, `ufw allow ${wireguardPort}/udp || iptables -A INPUT -p udp --dport ${wireguardPort} -j ACCEPT`);

        // 7. Setup limited sudo user only if connecting as root
        const managerUser = sshUser === "root" ? "serverwg" : sshUser;
        if (sshUser === "root") {
          await this.setupLimitedUser({
            address: publicIp,
            port: 22,
            username: "root",
            privateKey: sshPrivateKey,
            password: sshPassword,
          }, managerUser);
        }

        // Save server to DB
        const server = await prisma.vpnServer.upsert({
          where: { publicIp },
          update: {
            publicKey,
            privateKey,
            sshPrivateKey: sshPrivateKey || undefined,
            sshPassword: sshPassword || undefined,
            sshUser: managerUser,
            wireguardPort,
            isActive: true
          },
          create: {
            name: `Gateway-${publicIp}`,
            publicIp,
            publicKey,
            privateKey,
            sshPrivateKey: sshPrivateKey || undefined,
            sshPassword: sshPassword || undefined,
            sshUser: managerUser,
            wireguardPort,
            isActive: true
          }
        });

        return server;
      } finally {
        conn.end();
      }
    } catch (err: any) {
      console.error("Gateway setup failed:", err);
      throw new Error(`Failed to setup gateway server: ${err.message}`);
    }
  }

  /**
   * Checks if a VPN client is actually connected by verifying the latest handshake on the server.
   */
  async getClientConnectionStatus(clientId: string) {
    const client = await prisma.vpnClient.findUnique({
      where: { id: clientId },
      include: { vpnServer: true }
    });

    if (!client) throw new Error("VPN Client not found");

    const sshConfig: VpnConfig = {
      address: client.vpnServer.publicIp,
      port: 22,
      username: client.vpnServer.sshUser || "serverwg",
      privateKey: client.vpnServer.sshPrivateKey,
    };

    try {
      const conn = await this.getSshClientWithFallback(sshConfig);
      try {
        // Get the latest handshake timestamp for the peer
        const output = await this.executeCommand(conn, `wg show wg0 peer ${client.publicKey} latest-handshakes`);

        if (!output || output.includes("no peers")) {
          return "OFFLINE";
        }

        const handshakeTimestamp = parseInt(output.trim());
        if (handshakeTimestamp === 0) return "OFFLINE";

        const now = Math.floor(Date.now() / 1000);
        const diff = now - handshakeTimestamp;

        // If last handshake was more than 3 minutes ago, consider it offline
        return diff < 180 ? "ONLINE" : "OFFLINE";
      } finally {
        conn.end();
      }
    } catch (err) {
      console.error(`Status check failed for client ${clientId}:`, err);
      return "UNKNOWN";
    }
  }

  /**
   * Checks the health of all active VPN servers.
   * Returns a list of servers that are down.
   */
  async checkAllServersHealth(): Promise<{ downServers: string[]; details: any[] }> {
    const servers = await prisma.vpnServer.findMany({
      where: { isActive: true },
    });

    const downServers: string[] = [];
    const details: any[] = [];

    for (const server of servers) {
      const sshConfig: VpnConfig = {
        address: server.publicIp,
        port: 22,
        username: server.sshUser || "root",
        privateKey: server.sshPrivateKey,
        password: server.sshPassword,
      };

      try {
        const conn = await this.getSshClient(sshConfig);
        conn.end();
        details.push({ ip: server.publicIp, status: "UP" });
      } catch (err: any) {
        console.error(`[HealthCheck] Server ${server.publicIp} is DOWN: ${err.message}`);
        downServers.push(server.publicIp);
        details.push({ ip: server.publicIp, status: "DOWN", error: err.message });
      }
    }

    return { downServers, details };
  }
  private async verifyResourcesAvailable() {
    const [server, publicIp, internalIp] = await Promise.all([
      prisma.vpnServer.findFirst({
        where: { isActive: true },
        orderBy: { updatedAt: "desc" },
      }),
      prisma.vpnPublicIpPool.findFirst({ where: { isUsed: false } }),
      prisma.vpnIpPool.findFirst({ where: { isUsed: false } }),
    ]);

    if (!server) throw new Error("No active VPN Gateway server found");
    if (!publicIp) throw new Error("No available public IP addresses in the pool");
    if (!internalIp) throw new Error("No available internal IP addresses in the pool");

    return { server, publicIp, internalIp };
  }

  /**
   * Undoes changes made to a VPN server and releases IPs.
   */
  private async cleanupVpnResources(params: {
    server: VpnServer;
    publicIp: string;
    internalIp: string;
    publicKey?: string;
    publicPort?: number;
    localPort?: number;
  }) {
    const { server, publicIp, internalIp, publicKey, publicPort = 80, localPort = 80 } = params;

    const sshConfig: VpnConfig = {
      address: server.publicIp,
      port: 22,
      username: server.sshUser || "serverwg",
      privateKey: server.sshPrivateKey,
    };

    try {
      const conn = await this.getSshClientWithFallback(sshConfig);
      try {
        if (publicKey) {
          await this.executeCommand(conn, `wg set wg0 peer ${publicKey} remove`);
        }
        // Note: In the new multi-port system, we should cleanup all mappings.
        // But for backward compatibility during migration, we still cleanup the provided ports.
        await this.executeCommand(conn, `iptables -t nat -D PREROUTING -d ${publicIp} -p tcp --dport ${publicPort} -j DNAT --to-destination ${internalIp}:${localPort} || true`);
        await this.executeCommand(conn, `iptables -t nat -D POSTROUTING -o wg0 -d ${internalIp} -j MASQUERADE || true`);
      } finally {
        conn.end();
      }
    } catch (err) {
      console.error("Failed to cleanup remote VPN resources:", err);
    }

    // Release IPs back to pool
    await prisma.$transaction([
      prisma.vpnPublicIpPool.update({
        where: { ipAddress: publicIp },
        data: { isUsed: false },
      }),
      prisma.vpnIpPool.update({
        where: { ipAddress: internalIp },
        data: { isUsed: false },
      }),
    ]);
  }

  /**
   * Alokasikan VPN Client baru dengan Public & Internal IP otomatis dan Multi-Port Mapping
   */
  async createVpnClient(userId: string, portMappings: { publicPort: number, localPort: number }[] = [{ publicPort: 80, localPort: 80 }]) {
    // 1. Pre-Verification (Read-Only)
    const resources = await this.verifyResourcesAvailable();
    const { server, publicIp: availablePublicIp, internalIp: availableInternalIp } = resources;

    // 2. Atomic Resource Reservation
    await prisma.$transaction([
      prisma.vpnPublicIpPool.update({
        where: { id: availablePublicIp.id },
        data: { isUsed: true },
      }),
      prisma.vpnIpPool.update({
        where: { id: availableInternalIp.id },
        data: { isUsed: true },
      }),
    ]);

    const publicIp = availablePublicIp.ipAddress;
    const internalIp = availableInternalIp.ipAddress;

    // 3. Billing
    try {
      await chargeWallet({
        userId,
        amount: 300000,
        description: "Initial monthly subscription for VPN Tunneling",
      });
    } catch (error: any) {
      await prisma.$transaction([
        prisma.vpnPublicIpPool.update({ where: { ipAddress: publicIp }, data: { isUsed: false } }),
        prisma.vpnIpPool.update({ where: { ipAddress: internalIp }, data: { isUsed: false } }),
      ]);
      if (error.message === "INSUFFICIENT_BALANCE") {
        throw new Error("Insufficient balance to activate VPN tunnel. Please top up your wallet.");
      }
      throw error;
    }

    // 4. Provisioning (External Side Effects)
    const sshConfig: VpnConfig = {
      address: server.publicIp,
      port: 22,
      username: server.sshUser || "serverwg",
      privateKey: server.sshPrivateKey,
    };

    let conn: Client | null = null;
    let createdPublicKey: string | null = null;

    try {
      conn = await this.getSshClientWithFallback(sshConfig);
      console.log(`SSH Connection established to ${server.publicIp}`);
      const privateKey = await this.executeCommand(conn, "wg genkey");
      createdPublicKey = await this.executeCommand(conn, `echo ${privateKey} | wg pubkey`);

      await this.executeCommand(conn, `wg set wg0 peer ${createdPublicKey} allowed-ips ${internalIp}/32`);

      // Apply MULTI-PORT forwardings
      for (const mapping of portMappings) {
        await this.executeCommand(conn, `iptables -t nat -A PREROUTING -d ${publicIp} -p tcp --dport ${mapping.publicPort} -j DNAT --to-destination ${internalIp}:${mapping.localPort}`);
        // We only need one MASQUERADE rule per client regardless of port count
      }
      await this.executeCommand(conn, `iptables -t nat -A POSTROUTING -o wg0 -d ${internalIp} -j MASQUERADE`);

      const installToken = crypto.randomBytes(16).toString("hex");

      // Create Client and Port Mappings in one transaction
      const result = await prisma.$transaction(async (tx) => {
        const client = await tx.vpnClient.create({
          data: {
            userId,
            vpnServerId: server.id,
            publicKey: createdPublicKey!,
            privateKey,
            internalIp,
            allocatedPublicIp: publicIp,
            vpnInstallToken: installToken,
            status: VpnStatus.ACTIVE,
            portMappings: {
              create: portMappings.map(m => ({
                publicPort: m.publicPort,
                localPort: m.localPort,
              }))
            }
          },
          include: { portMappings: true }
        });

        return client;
      });

      return { client: result, privateKey };
    } catch (error: any) {
      await this.cleanupVpnResources({
        server,
        publicIp,
        internalIp,
        publicKey: createdPublicKey ?? undefined,
      });

      await refundWallet({
        userId,
        amount: 300000,
        description: `Refund: VPN Provisioning failed - ${error.message}`,
      });

      throw error;
    } finally {
      if (conn) conn.end();
    }
  }

  // src/lib/vpn/vpnService.ts

async revokeVpnClient(clientId: string) {
  const client = await prisma.vpnClient.findUnique({
    where: { id: clientId },
    include: { vpnServer: true }
  });

  if (!client) throw new Error("VPN Client not found");

  const sshConfig: VpnConfig = {
    address: client.vpnServer.publicIp,
    port: 22,
    username: client.vpnServer.sshUser || "serverwg",
    privateKey: client.vpnServer.sshPrivateKey,
  };

  // 1. Coba hapus peer & iptables di server
  try {
    const conn = await this.getSshClientWithFallback(sshConfig);
    try {
      await this.executeCommand(conn, `wg set wg0 peer ${client.publicKey} remove`);
      if (client.allocatedPublicIp) {
        // Abaikan error jika rule iptables tidak ditemukan
        await this.executeCommand(
          conn,
          `iptables -t nat -D PREROUTING -d ${client.allocatedPublicIp} -p tcp --dport ${client.publicPort || 80} -j DNAT --to-destination ${client.internalIp}:${client.localPort || 80} || true`
        );
        await this.executeCommand(
          conn,
          `iptables -t nat -D POSTROUTING -o wg0 -d ${client.internalIp} -j MASQUERADE || true`
        );
      }
    } finally {
      conn.end();
    }
  } catch (err) {
    console.warn("Gagal mengeksekusi perintah SSH cleanup, tetap update status DB:", err);
  }

  // 2. Bebaskan IP Public & Internal
  if (client.allocatedPublicIp) {
    await prisma.vpnPublicIpPool.update({
      where: { ipAddress: client.allocatedPublicIp },
      data: { isUsed: false },
    });
  }

  await prisma.vpnIpPool.update({
    where: { ipAddress: client.internalIp },
    data: { isUsed: false },
  });

  // 3. Hapus data client agar IP pool bersih dan bisa dialokasikan ulang tanpa tabrakan unique constraint
  await prisma.vpnClient.delete({
    where: { id: clientId },
  });

  return { success: true };
}

  async generateClientConfig(clientId: string) {
    const client = await prisma.vpnClient.findUnique({
      where: { id: clientId },
      include: { vpnServer: true }
    });

    if (!client) throw new Error("VPN Client not found");

    const config = `
[Interface]
PrivateKey = ${client.privateKey}
Address = ${client.internalIp}/24
DNS = 1.1.1.1

[Peer]
PublicKey = ${client.vpnServer.publicKey}
Endpoint = ${client.vpnServer.publicIp}:${client.vpnServer.wireguardPort}
AllowedIPs = 0.0.0.0/0
PersistentKeepalive = 25
    `.trim();

    return config;
  }
}

export const vpnService = new VpnManagementService();
