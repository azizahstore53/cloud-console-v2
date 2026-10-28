import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { vpnService } from "@/lib/vpn/vpnService";
import { prisma } from "@/lib/prisma";
import { EncryptionService } from "@/lib/encryption";

export async function GET() {
  const session = await auth();

  // Only ADMIN or SUPER_ADMIN can view VPN settings
  if (!session?.user || !["SUPER_ADMIN", "ADMIN"].includes(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized: Administrator access required" }, { status: 403 });
  }

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
      hasPassword: !!server.sshPassword,
      hasPrivateKey: !!server.sshPrivateKey,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await auth();

  // Only ADMIN or SUPER_ADMIN can update VPN settings
  if (!session?.user || !["SUPER_ADMIN", "ADMIN"].includes(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized: Administrator access required" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { name, publicIp, sshUser, sshPassword, sshPrivateKey, wireguardPort } = body;

    const encryptedSshKey = sshPrivateKey
      ? EncryptionService.encrypt(sshPrivateKey)
      : null;

    const server = await prisma.vpnServer.upsert({
      where: { publicIp },
      update: {
        name,
        sshUser,
        sshPassword,
        sshPrivateKey: encryptedSshKey,
        wireguardPort,
      },
      create: {
        name,
        publicIp,
        sshUser,
        sshPassword,
        sshPrivateKey: encryptedSshKey,
        wireguardPort,
        publicKey: "pending",
        privateKey: "pending",
      },
    });

    return NextResponse.json({ success: true, server });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
