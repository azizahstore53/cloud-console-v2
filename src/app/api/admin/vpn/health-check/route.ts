import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/admin";
import { vpnService } from "@/lib/vpn/vpnService";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  // 1. Authentication Check
  // Check for Secret Token first (for external cron jobs)
  const cronToken = req.headers.get("x-cron-token");
  const isValidCronToken = cronToken && process.env.VPN_CRON_SECRET === cronToken;

  // If no cron token, check for Admin Session
  if (!isValidCronToken) {
    const guard = await requirePermission("instances.manage");
    if (guard instanceof NextResponse) return guard;
  }

  console.log(`[${new Date().toISOString()}] VPN Health Check triggered ${isValidCronToken ? "via Cron Token" : "via Admin Session"}`);

  try {
    const { downServers, details } = await vpnService.checkAllServersHealth();

    if (downServers.length > 0) {
      // 2. Mark down servers as inactive
      await prisma.vpnServer.updateMany({
        where: {
          publicIp: { in: downServers },
        },
        data: { isActive: false },
      });

      // 3. Notify admins
      const admins = await prisma.user.findMany({
        where: {
          role: { in: ["SUPER_ADMIN", "ADMIN"] },
        },
      });

      await prisma.notification.createMany({
        data: admins.map(admin => ({
          userId: admin.id,
          title: "🚨 VPN Server Down!",
          message: `Critical: VPN Server(s) [${downServers.join(", ")}] are unreachable.`,
          type: "CRITICAL",
        })),
      });
    }

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      results: details,
      downCount: downServers.length,
    });
  } catch (error: any) {
    console.error("Error during VPN health check API call:", error);
    return NextResponse.json(
      { error: "Internal server error during health check" },
      { status: 500 }
    );
  }
}
