import { prisma } from "@/lib/prisma";
import { vpnService } from "@/lib/vpn/vpnService";
import { Notification } from "@prisma/client";

export async function checkVpnServersHeartbeat() {
  console.log("[Cron] Starting VPN Servers Heartbeat Check...");

  const healthReport = await vpnService.checkAllServersHealth();
  const { downServers, details } = healthReport;

  if (downServers.length === 0) {
    console.log("[Cron] All VPN servers are healthy.");
    return { status: "OK", downCount: 0 };
  }

  console.error(`[Cron] ALERT: ${downServers.length} VPN servers are DOWN!`);

  // Notify Admin/Staff about the downtime
  const admins = await prisma.user.findMany({
    where: {
      role: { in: ["SUPER_ADMIN", "ADMIN"] }
    }
  });

  const notificationPromises = admins.map(admin =>
    prisma.notification.create({
      data: {
        userId: admin.id,
        title: "⚠️ VPN Server Downtime Alert",
        message: `Critical: ${downServers.length} VPN gateway server(s) are offline. Please check the admin dashboard immediately.`,
        type: "SYSTEM_ALERT",
      }
    })
  );

  await Promise.all(notificationPromises);

  return {
    status: "CRITICAL",
    downCount: downServers.length,
    details
  };
}
