import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { reconcileInstanceStatus } from "@/lib/cloud/reconcileInstanceStatus";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const instance = await prisma.instance.findFirst({
    where: { id: params.id, userId: session.user.id },
  });
  if (!instance) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await reconcileInstanceStatus(instance);
  const full = await prisma.instance.findUnique({
    where: { id: instance.id },
    include: { plan: true, region: true, sshKey: true },
  });

  return NextResponse.json({ instance: full });
}
