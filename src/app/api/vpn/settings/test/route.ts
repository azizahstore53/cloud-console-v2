import { NextRequest, NextResponse } from "next/server";
import { vpnService } from "@/lib/vpn/vpnService";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { publicIp, sshUser, sshPassword, sshPrivateKey } = body;

    if (!publicIp || !sshUser) {
      return NextResponse.json({ error: "Missing required credentials" }, { status: 400 });
    }

    const result = await vpnService.testConnection({
      address: publicIp,
      port: 22,
      username: sshUser,
      password: sshPassword,
      privateKey: sshPrivateKey,
    });

    if (result.success) {
      return NextResponse.json({ success: true, message: result.message });
    } else {
      return NextResponse.json({ success: false, message: result.message }, { status: 400 });
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
