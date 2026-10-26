import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { vpnService } from "@/lib/vpn/vpnService";

export async function POST(req: Request) {
  const session = await auth();

  // Only ADMIN or SUPER_ADMIN can setup gateway
  if (!session?.user || !["SUPER_ADMIN", "ADMIN"].includes(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized: Administrator access required" }, { status: 403 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const { publicIp, sshPrivateKey, wireguardPort, sshUser } = body;

    if (!publicIp || !sshPrivateKey) {
      return NextResponse.json({ error: "Public IP and SSH Private Key are required" }, { status: 400 });
    }

    console.log(`Initiating gateway setup for server: ${publicIp} (user: ${sshUser || "serverwg"})`);
    const server = await vpnService.setupGatewayServer({
      publicIp,
      sshPrivateKey,
      sshUser: sshUser || "serverwg",
      wireguardPort: wireguardPort ? parseInt(wireguardPort) : 51820,
    });

    return NextResponse.json({
      success: true,
      message: "VPN Gateway server setup successfully!",
      server,
    });
  } catch (error: any) {
    console.error("Gateway Setup API Error:", error);
    return NextResponse.json({ error: error.message || "An unexpected error occurred during gateway setup" }, { status: 500 });
  }
}
