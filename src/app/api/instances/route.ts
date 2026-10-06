import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getCloudProvider } from "@/lib/cloud/ProviderFactory";
import { reconcileInstanceStatuses } from "@/lib/cloud/reconcileInstanceStatus";

const createInstanceSchema = z.object({
  name: z.string().min(3).max(64),
  imageSlug: z.string(),
  imageLabel: z.string(),
  regionId: z.string(),
  planId: z.string(),
  sshKeyId: z.string().optional(),
  billingCycle: z.enum(["HOURLY", "MONTHLY"]).default("HOURLY"),
});

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const instances = await prisma.instance.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
  });

  await reconcileInstanceStatuses(instances);

  const refreshed = await prisma.instance.findMany({
    where: { userId: session.user.id },
    include: { plan: true, region: true, sshKey: true },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ instances: refreshed });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = createInstanceSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload", issues: parsed.error.flatten() }, { status: 400 });
  }
  const input = parsed.data;

  const [region, plan] = await Promise.all([
    prisma.region.findUnique({ where: { id: input.regionId } }),
    prisma.instancePlan.findUnique({ where: { id: input.planId } }),
  ]);
  if (!region || !plan) {
    return NextResponse.json({ error: "Invalid region or plan" }, { status: 400 });
  }

  // Prepaid model: require enough balance to cover at least 1 hour / 1 day upfront.
  const user = await prisma.user.findUniqueOrThrow({ where: { id: session.user.id } });
  const minimumRequired = input.billingCycle === "MONTHLY" ? plan.pricePerMonth : plan.pricePerHour * 24;
  if (user.balance < minimumRequired) {
    return NextResponse.json(
      { error: "INSUFFICIENT_BALANCE", message: "Top up your wallet balance to launch this instance." },
      { status: 402 }
    );
  }

  let sshPublicKey: string | undefined;
  if (input.sshKeyId) {
    const key = await prisma.sshKey.findFirst({ where: { id: input.sshKeyId, userId: session.user.id } });
    sshPublicKey = key?.publicKey;
  }

  const provider = getCloudProvider();
  let result;
  try {
    result = await provider.createInstance({
      name: input.name,
      imageSlug: input.imageSlug,
      regionCode: region.code,
      vcpu: plan.vcpu,
      ramMb: plan.ramMb,
      storageGb: plan.storageGb,
      sshPublicKey,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Cloud provider request failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  const instance = await prisma.instance.create({
    data: {
      userId: session.user.id,
      name: input.name,
      status: "PROVISIONING",
      provider: provider.providerName,
      externalId: result.externalId,
      imageSlug: input.imageSlug,
      imageLabel: input.imageLabel,
      regionId: region.id,
      planId: plan.id,
      sshKeyId: input.sshKeyId,
      ipv4Address: result.ipv4Address,
      ipv6Address: result.ipv6Address,
      billingCycle: input.billingCycle,
      provisionedAt: new Date(),
      lastBilledAt: new Date(),
    },
    include: { plan: true, region: true, sshKey: true },
  });

  await prisma.activityLog.create({
    data: {
      userId: session.user.id,
      instanceId: instance.id,
      category: "INSTANCE",
      action: "instance.create",
      message: `Instance "${instance.name}" is being provisioned in ${region.name}`,
    },
  });

  // Some providers (e.g. IDCloudHost) return a one-time initial root
  // password since their API requires one even for SSH-key-based access.
  // Surface it once in this response only — never persist it in plaintext.
  const oneTimeCredentials =
    result.metadata?.initialPassword
      ? {
          username: (result.metadata.initialUsername as string) ?? "root",
          password: result.metadata.initialPassword as string,
          note: (result.metadata.note as string) ?? "Save this now — it will not be shown again.",
        }
      : undefined;

  return NextResponse.json({ instance, oneTimeCredentials }, { status: 201 });
}
