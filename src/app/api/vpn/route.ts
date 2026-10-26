import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { vpnService } from "@/lib/vpn/vpnService";
import { VpnStatus } from "@prisma/client";
import { z } from "zod";
import { rateLimit } from "@/lib/rate-limit";

// Define strict validation schema for VPN provisioning
const provisionSchema = z.object({
  portMappings: z.array(
    z.object({
      publicPort: z.number().int().min(1).max(65535),
      localPort: z.number().int().min(1).max(65535),
    })
  ).min(1, "At least one port mapping is required").max(10, "Maximum 10 ports allowed per tunnel"),
});

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const vpnClient = await prisma.vpnClient.findFirst({
    where: { userId: session.user.id, status: VpnStatus.ACTIVE },
    orderBy: { createdAt: "desc" },
    include: { vpnServer: true },
  });

  if (!vpnClient) {
    return NextResponse.json({ message: "No active VPN configured" }, { status: 404 });
  }

  const config = await vpnService.generateClientConfig(vpnClient.id);

  return NextResponse.json({
    publicIp: vpnClient.allocatedPublicIp,
    internalIp: vpnClient.internalIp,
    status: vpnClient.status,
    installToken: vpnClient.vpnInstallToken,
    config: config,
  });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // --- RATE LIMITING START ---
  // Limit provisioning to 5 attempts per 15 minutes per user to prevent resource abuse
  const limitCheck = await rateLimit(session.user.id, 5, 15 * 60 * 1000);
  if (!limitCheck.success) {
    return NextResponse.json(
      {
        error: "Too many requests",
        message: "You have exceeded the provisioning limit. Please try again in a few minutes."
      },
      { status: 429 }
    );
  }
  // --- RATE LIMITING END ---

  try {
    const body = await req.json().catch(() => ({}));

    // Validate input using Zod
    const validation = provisionSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        {
          error: "Invalid input data",
          details: validation.error.flatten().fieldErrors
        },
        { status: 400 }
      );
    }

    const { portMappings } = validation.data;

    console.log(`[VPN API] Provisioning for user: ${session.user.id} with ${portMappings.length} ports`);
    const { client, privateKey } = await vpnService.createVpnClient(session.user.id, portMappings);

    return NextResponse.json({
      success: true,
      client,
      privateKey,
    });
  } catch (error: any) {
    console.error("[VPN API] Provisioning Error:", error);
    return NextResponse.json({ error: error.message || "An unexpected error occurred during provisioning" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const vpnClient = await prisma.vpnClient.findFirst({
      where: { userId: session.user.id, status: VpnStatus.ACTIVE },
      orderBy: { createdAt: "desc" },
    });

    if (!vpnClient) {
      return NextResponse.json({ error: "No active VPN tunnel found to disconnect" }, { status: 404 });
    }

    await vpnService.revokeVpnClient(vpnClient.id);

    return NextResponse.json({
      success: true,
      message: "VPN tunnel has been disconnected and revoked successfully",
    });
  } catch (error: any) {
    console.error("[VPN API] Revoke Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
