import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { vpnService } from "@/lib/vpn/vpnService";

export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const id = params.id;

    if (!id) {
      return NextResponse.json({ error: "Server ID is required" }, { status: 400 });
    }

    // 1. Proteksi RBAC: Hanya admin yang bisa menghapus gateway
    const guard = await requirePermission("instances.manage");
    if (guard instanceof NextResponse) return guard;

    const server = await prisma.vpnServer.findUnique({
      where: { id },
      include: { clients: true },
    });

    if (!server) {
      return NextResponse.json({ error: "Server not found" }, { status: 404 });
    }

    // 2. Cleanup Process
    // We must remove all associated clients and release their IPs
    // to prevent "ghost" active IPs in the VPN Pool.
    await prisma.$transaction(async (tx) => {
      for (const client of server.clients) {
        // Release Public IP
        if (client.allocatedPublicIp) {
          await tx.vpnPublicIpPool.updateMany({
            where: { ipAddress: client.allocatedPublicIp },
            data: { isUsed: false },
          });
        }
        // Release Internal IP
        if (client.internalIp) {
          await tx.vpnIpPool.updateMany({
            where: { ipAddress: client.internalIp },
            data: { isUsed: false },
          });
        }
        // Delete Client
        await tx.vpnClient.delete({
          where: { id: client.id },
        });
      }

      // Finally, delete the server
      await tx.vpnServer.delete({
        where: { id },
      });
    });

    return NextResponse.json({
      success: true,
      message: `Gateway ${server.name} and all associated resources have been removed.`,
    });
  } catch (error: any) {
    console.error("Error deleting VPN server:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
