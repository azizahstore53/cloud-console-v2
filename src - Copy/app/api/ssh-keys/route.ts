import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import crypto from "crypto";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const createSchema = z.object({
  name: z.string().min(2).max(64),
  publicKey: z.string().min(20),
});

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const sshKeys = await prisma.sshKey.findMany({ where: { userId: session.user.id }, orderBy: { createdAt: "desc" } });
  return NextResponse.json({ sshKeys });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = createSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid payload" }, { status: 400 });

  const { name, publicKey } = parsed.data;
  const fingerprint = crypto.createHash("md5").update(publicKey.trim()).digest("hex").match(/.{2}/g)!.join(":");

  const sshKey = await prisma.sshKey.create({
    data: { userId: session.user.id, name, publicKey, fingerprint },
  });

  await prisma.activityLog.create({
    data: {
      userId: session.user.id,
      category: "SSH_KEY",
      action: "ssh_key.create",
      message: `Added SSH key "${name}"`,
    },
  });

  return NextResponse.json({ sshKey }, { status: 201 });
}
