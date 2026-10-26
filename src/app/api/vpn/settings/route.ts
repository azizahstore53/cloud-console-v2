import { NextRequest, NextResponse } from "next/server";
import { vpnService } from "@/lib/vpn/vpnService";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const server = await prisma.vpnServer.findFirst({
      where: { isActive: true },
    });

    if (!server) {
      return NextResponse.json({ error: "No active VPN server found" }, { status: 404 });
    }

    return NextResponse.json({
      name: server.name,
      publicIp: server.publicIp,
      sshUser: server.sshUser,
      wireguardPort: server.wireguardPort,
      // We don't send passwords/keys back to the frontend for security,
      // but we could send a flag saying they are configured.
      hasPassword: !!server.sshPassword,
      hasPrivateKey: !!server.sshPrivateKey,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, publicIp, sshUser, sshPassword, sshPrivateKey, wireguardPort } = body;

    const server = await prisma.vpnServer.upsert({
      where: { publicIp },
      update: {
        name,
        sshUser,
        sshPassword,
        sshPrivateKey,
        wireguardPort,
      },
      create: {
        name,
        publicIp,
        sshUser,
        sshPassword,
        sshPrivateKey,
        wireguardPort,
        // These are required but will be filled by provisioning
        publicKey: "pending",
        privateKey: "pending",
      },
    });

    return NextResponse.json({ success: true, server });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
