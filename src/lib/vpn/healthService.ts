import net from "net";

export interface HealthStatus {
  ip: string;
  name: string;
  status: "ONLINE" | "OFFLINE";
  latency: number | null;
  error?: string;
}

export class VpnHealthService {
  /**
   * Checks if a server is reachable by attempting a TCP connection to a specific port.
   * This is a "TCP Ping" - it only checks if the port is open, not if the service is fully functional.
   */
  static async checkServerHealth(ip: string, name: string, port: number = 22): Promise<HealthStatus> {
    const start = Date.now();

    return new Promise((resolve) => {
      const socket = new net.Socket();

      // Set a timeout to prevent the check from hanging
      socket.setTimeout(3000);

      socket.on("connect", () => {
        const latency = Date.now() - start;
        socket.destroy();
        resolve({
          ip,
          name,
          status: "ONLINE",
          latency,
        });
      });

      socket.on("timeout", () => {
        socket.destroy();
        resolve({
          ip,
          name,
          status: "OFFLINE",
          latency: null,
          error: "Connection timed out",
        });
      });

      socket.on("error", (err) => {
        socket.destroy();
        resolve({
          ip,
          name,
          status: "OFFLINE",
          latency: null,
          error: err.message,
        });
      });

      socket.connect(port, ip);
    });
  }

  /**
   * Checks health for a list of servers in parallel.
   */
  static async checkAllServers(servers: { id: string; publicIp: string; name: string; wireguardPort?: number }[]) {
    const checks = servers.map(server =>
      // We check both SSH (22) and WireGuard port for better accuracy
      this.checkServerHealth(server.publicIp, server.name, server.wireguardPort || 22)
    );

    return Promise.all(checks);
  }
}
