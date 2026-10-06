import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { getCloudProvider } from "@/lib/cloud/ProviderFactory";
import type { InstanceStatus } from "@prisma/client";

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requirePermission("instances.manage");
  if (guard instanceof NextResponse) return guard;
  const { session } = guard;

  const instance = await prisma.instance.findUnique({ where: { id: params.id } });
  if (!instance || !instance.externalId) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const provider = getCloudProvider();
  const result = await provider.terminateInstance(instance.externalId);

  const updated = await prisma.instance.update({
    where: { id: instance.id },
    data: { status: result.status as InstanceStatus, terminatedAt: new Date() },
  });

  await prisma.activityLog.create({
    data: {
      userId: instance.userId,
      instanceId: instance.id,
      category: "INSTANCE",
      action: "admin.instance_terminate",
      message: `Instance "${instance.name}" force-terminated by admin (${session.user.email ?? session.user.id})`,
    },
  });

  return NextResponse.json({ instance: updated });
}
