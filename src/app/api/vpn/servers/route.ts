import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { EncryptionService } from "@/lib/encryption";

const vpnServerSchema = z.object({
  name: z.string().min(3).max(64),
  publicIp: z.string().ip(),
  privateKey: z.string().min(10),
  publicKey: z.string().min(10),
  sshPrivateKey: z.string().optional(),
});

export async function GET() {
  const session = await auth();

  if (!session?.user || !["SUPER_ADMIN", "ADMIN"].includes(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized: Administrator access required" }, { status: 403 });
  }

  try {
    const servers = await prisma.vpnServer.findMany({
      orderBy: { createdAt: 'desc' }
    });

    // We don't return the private keys (encrypted or not) to the frontend for security
    const sanitizedServers = servers.map(s => {
      const { sshPrivateKey, ...rest } = s;
      return rest;
    });

    return NextResponse.json(sanitizedServers);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user || !["SUPER_ADMIN", "ADMIN"].includes(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized: Administrator access required" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const parsed = vpnServerSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input", issues: parsed.error.flatten() }, { status: 400 });
    }

    const encryptedSshKey = parsed.data.sshPrivateKey
      ? EncryptionService.encrypt(parsed.data.sshPrivateKey)
      : null;

    const server = await prisma.vpnServer.create({
      data: {
        name: parsed.data.name,
        publicIp: parsed.data.publicIp,
        privateKey: parsed.data.privateKey,
        publicKey: parsed.data.publicKey,
        sshPrivateKey: encryptedSshKey,
        isActive: true,
      },
    });

    return NextResponse.json(server, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
