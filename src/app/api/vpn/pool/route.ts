import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();

  // Only ADMIN, SUPER_ADMIN, or SUPPORT can manage IP pool
  if (!session?.user || !["SUPER_ADMIN", "ADMIN", "SUPPORT"].includes(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized: Admin or Support access required" }, { status: 403 });
  }

  try {
    const ips = await prisma.vpnPublicIpPool.findMany({
      orderBy: { createdAt: 'desc' }
    });

    // Enrich IP data with real-time connection status from the server
    const enrichedIps = await Promise.all(ips.map(async (ip) => {
      let connectionStatus = "N/A";

      if (ip.isUsed) {
        try {
          const client = await prisma.vpnClient.findFirst({
            where: { allocatedPublicIp: ip.ipAddress }
          });
          if (client) {
            const { vpnService } = await import("@/lib/vpn/vpnService");
            connectionStatus = await vpnService.getClientConnectionStatus(client.id);
          }
        } catch (e) {
          connectionStatus = "ERROR";
        }
      }

      return { ...ip, connectionStatus };
    }));

    const total = enrichedIps.length;
    const used = enrichedIps.filter(ip => ip.isUsed).length;
    const available = total - used;

    return NextResponse.json({
      summary: {
        total,
        used,
        available
      },
      ips: enrichedIps
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const session = await auth();

  if (!session?.user || !["SUPER_ADMIN", "ADMIN", "SUPPORT"].includes(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized: Admin or Support access required" }, { status: 403 });
  }

  try {
    const { ips } = await req.json();

    if (!ips || !Array.isArray(ips)) {
      return NextResponse.json({ error: "Invalid input: 'ips' array is required" }, { status: 400 });
    }

    // Bulk insert IPs into the pool
    const operations = ips.map(ip =>
      prisma.vpnPublicIpPool.upsert({
        where: { ipAddress: ip },
        update: {}, // Do nothing if already exists
        create: {
          ipAddress: ip,
          isUsed: false,
        },
      })
    );

    await prisma.$transaction(operations);

    return NextResponse.json({
      success: true,
      message: `Successfully processed ${ips.length} IP addresses.`
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const session = await auth();

  if (!session?.user || !["SUPER_ADMIN", "ADMIN", "SUPPORT"].includes(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized: Admin or Support access required" }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "IP ID is required" }, { status: 400 });
    }

    const ip = await prisma.vpnPublicIpPool.findUnique({ where: { id } });

    if (!ip) {
      return NextResponse.json({ error: "IP not found" }, { status: 404 });
    }

    if (ip.isUsed) {
      return NextResponse.json({ error: "Cannot delete an IP that is currently in use by a customer" }, { status: 400 });
    }

    await prisma.vpnPublicIpPool.delete({ where: { id } });

    return NextResponse.json({ success: true, message: "IP removed from pool successfully" });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
