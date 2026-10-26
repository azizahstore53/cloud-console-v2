import { prisma } from "../lib/prisma";
import { vpnService } from "../lib/vpn/vpnService";

async function runHealthCheck() {
  console.log(`[${new Date().toISOString()}] Starting VPN Health Check...`);

  try {
    const { downServers, details } = await vpnService.checkAllServersHealth();

    console.log("Health Check Results:", details);

    if (downServers.length > 0) {
      console.error(`Alert: ${downServers.length} server(s) are DOWN: ${downServers.join(", ")}`);

      for (const ip of downServers) {
        // 1. Mark server as inactive in DB
        await prisma.vpnServer.update({
          where: { publicIp: ip },
          data: { isActive: false },
        });

        // 2. Find all admins to notify
        const admins = await prisma.user.findMany({
          where: {
            role: { in: ["SUPER_ADMIN", "ADMIN"] },
          },
        });

        // 3. Create notifications for each admin
        await prisma.notification.createMany({
          data: admins.map(admin => ({
            userId: admin.id,
            title: "🚨 VPN Server Down!",
            message: `Critical: VPN Server ${ip} is unreachable. Please check the VPS status immediately.`,
            type: "CRITICAL",
          })),
        });
      }
    } else {
      console.log("All VPN servers are healthy.");
    }
  } catch (error: any) {
    console.error("Critical error during health check execution:", error);
  }
}

runHealthCheck().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
