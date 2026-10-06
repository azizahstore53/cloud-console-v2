import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const deploySchema = z.object({
  blueprintId: z.string(),
  name: z.string().min(3).max(64),
  instanceId: z.string().optional(),
});

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [blueprints, deployments] = await Promise.all([
    prisma.blueprint.findMany({ where: { isActive: true } }),
    prisma.deployment.findMany({
      where: { userId: session.user.id },
      include: { blueprint: true, instance: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return NextResponse.json({ blueprints, deployments });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = deploySchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  const { blueprintId, name, instanceId } = parsed.data;

  const blueprint = await prisma.blueprint.findUnique({ where: { id: blueprintId } });
  if (!blueprint) return NextResponse.json({ error: "Blueprint not found" }, { status: 404 });

  const deployment = await prisma.deployment.create({
    data: {
      userId: session.user.id,
      blueprintId,
      instanceId,
      name,
      status: "DEPLOYING",
    },
    include: { blueprint: true, instance: true },
  });

  await prisma.activityLog.create({
    data: {
      userId: session.user.id,
      category: "DEPLOYMENT",
      action: "deployment.create",
      message: `Deploying "${blueprint.name}" as "${name}"`,
    },
  });

  // Simulate deploy completing shortly after (mock PaaS backend).
  setTimeout(async () => {
    await prisma.deployment.update({
      where: { id: deployment.id },
      data: { status: "RUNNING", deployedAt: new Date(), domain: `${name}.apps.cloudconsole.dev` },
    }).catch(() => {});
  }, 6000);

  return NextResponse.json({ deployment }, { status: 201 });
}
