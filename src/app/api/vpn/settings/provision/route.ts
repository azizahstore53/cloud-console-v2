import { NextRequest, NextResponse } from "next/server";
import { vpnService } from "@/lib/vpn/vpnService";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { publicIp, sshUser, sshPassword, sshPrivateKey, wireguardPort } = body;

    if (!publicIp || !sshUser) {
      return NextResponse.json({ error: "Missing required credentials" }, { status: 400 });
    }

    const server = await vpnService.setupGatewayServer({
      publicIp,
      sshUser,
      sshPassword,
      sshPrivateKey,
      wireguardPort,
    });

    return NextResponse.json({ success: true, server });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
