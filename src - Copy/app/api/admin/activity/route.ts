import { NextRequest, NextResponse } from "next/server";
import { requireStaff } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import type { Prisma, ActivityCategory } from "@prisma/client";

export async function GET(req: NextRequest) {
  const guard = await requireStaff();
  if (guard instanceof NextResponse) return guard;

  const { searchParams } = new URL(req.url);
  const category = searchParams.get("category") as ActivityCategory | null;
  const userId = searchParams.get("userId");
  const search = searchParams.get("q")?.trim();
  const from = searchParams.get("from"); // ISO date
  const to = searchParams.get("to"); // ISO date
  const cursor = searchParams.get("cursor"); // activity log id to paginate after
  const take = Math.min(Number(searchParams.get("take") ?? 30), 100);

  const where: Prisma.ActivityLogWhereInput = {
    ...(category ? { category } : {}),
    ...(userId ? { userId } : {}),
    ...(from || to
      ? {
          createdAt: {
            ...(from ? { gte: new Date(from) } : {}),
            ...(to ? { lte: new Date(to) } : {}),
          },
        }
      : {}),
    ...(search
      ? {
          OR: [
            { message: { contains: search, mode: "insensitive" } },
            { action: { contains: search, mode: "insensitive" } },
            { user: { email: { contains: search, mode: "insensitive" } } },
            { user: { name: { contains: search, mode: "insensitive" } } },
          ],
        }
      : {}),
  };

  const logs = await prisma.activityLog.findMany({
    where,
    include: { user: { select: { id: true, name: true, email: true } } },
    orderBy: { createdAt: "desc" },
    take: take + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });

  const hasMore = logs.length > take;
  const page = hasMore ? logs.slice(0, take) : logs;

  return NextResponse.json({
    logs: page,
    nextCursor: hasMore ? page[page.length - 1].id : null,
  });
}
