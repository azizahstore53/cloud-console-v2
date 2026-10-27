import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getCloudProvider } from "@/lib/cloud/ProviderFactory";
import { billInstanceUsage } from "@/lib/billing/usageBillingJob";
import type { InstanceStatus } from "@prisma/client";

const actionSchema = z.object({
  action: z.enum(["START", "STOP", "REBOOT", "TERMINATE"]),
});

// Maps the mock/remote provider status back onto our Prisma enum (1:1 today,
// kept as an explicit mapping so a real provider's differently-named states
// can be normalized here without touching callers).
function toInstanceStatus(remote: string): InstanceStatus {
  return remote as InstanceStatus;
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = actionSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid action" }, { status: 400 });

  const instance = await prisma.instance.findFirst({
    where: { id: params.id, userId: session.user.id },
    include: { plan: true, user: true },
  });
  if (!instance) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const provider = getCloudProvider();
  const { action } = parsed.data;

  // Bill the exact elapsed running time up to this moment before the
  // instance stops accruing usage — otherwise a stop/terminate right before
  // the next hourly job run would let that partial usage go unbilled.
  if (action === "STOP" || action === "TERMINATE") {
    try {
      await billInstanceUsage(instance, new Date());
    } catch (err) {
      // Don't block the stop/terminate action on a billing hiccup — log and
      // let the next hourly cycle reconcile it instead.
      console.error("Failed to bill final usage before", action, err);
    }
  }

  let result: { status: string };
  let logMessage: string;

  try {
    // If there's no externalId, we can only "simulate" the action in our DB
    if (!instance.externalId) {
      console.log(`[Provider] No externalId for instance ${instance.id}, simulating ${action}`);
      result = { status: action === "TERMINATE" ? "TERMINATED" : "RUNNING" };
      logMessage = `Instance "${instance.name}" ${action.toLowerCase()} simulated (no external ID)`;
    } else {
      switch (action) {
        case "START":
          result = await provider.startInstance(instance.externalId);
          logMessage = `Instance "${instance.name}" start requested`;
          break;
        case "STOP":
          result = await provider.stopInstance(instance.externalId);
          logMessage = `Instance "${instance.name}" stopped`;
          break;
        case "REBOOT":
          result = await provider.rebootInstance(instance.externalId);
          logMessage = `Instance "${instance.name}" reboot requested`;
          break;
        case "TERMINATE":
          try {
            result = await provider.terminateInstance(instance.externalId);
          } catch (providerErr) {
            console.error(`[Provider] Terminate failed for ${instance.externalId}:`, providerErr);
            result = { status: "TERMINATED" };
          }
          logMessage = `Instance "${instance.name}" termination requested`;
          break;
      }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Cloud provider request failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  const updated = await prisma.instance.update({
    where: { id: instance.id },
    data: {
      status: toInstanceStatus(result.status),
      terminatedAt: action === "TERMINATE" ? new Date() : instance.terminatedAt,
      // Reset the metering anchor whenever the instance starts running again
      // so stopped time is never billed on the next hourly cycle.
      lastBilledAt: action === "START" ? new Date() : instance.lastBilledAt,
    },
    include: { plan: true, region: true, sshKey: true },
  });

  await prisma.activityLog.create({
    data: {
      userId: session.user.id,
      instanceId: instance.id,
      category: "INSTANCE",
      action: `instance.${action.toLowerCase()}`,
      message: logMessage,
    },
  });

  return NextResponse.json({ instance: updated });
}
