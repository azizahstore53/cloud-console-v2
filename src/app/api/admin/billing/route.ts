import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import type { Prisma, TransactionType, TransactionStatus, InvoiceStatus } from "@prisma/client";

export async function GET(req: NextRequest) {
  const guard = await requirePermission("billing.manage");
  if (guard instanceof NextResponse) return guard;

  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type") as TransactionType | null;
  const status = searchParams.get("status") as TransactionStatus | null;
  const invoiceStatus = searchParams.get("invoiceStatus") as InvoiceStatus | null;
  const search = searchParams.get("q")?.trim();
  const take = Math.min(Number(searchParams.get("take") ?? 50), 200);

  const txWhere: Prisma.TransactionWhereInput = {
    ...(type ? { type } : {}),
    ...(status ? { status } : {}),
    ...(search
      ? {
          OR: [
            { user: { email: { contains: search, mode: "insensitive" } } },
            { user: { name: { contains: search, mode: "insensitive" } } },
            { gatewayRef: { contains: search, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const invoiceWhere: Prisma.InvoiceWhereInput = {
    ...(invoiceStatus ? { status: invoiceStatus } : {}),
    ...(search
      ? {
          OR: [
            { user: { email: { contains: search, mode: "insensitive" } } },
            { user: { name: { contains: search, mode: "insensitive" } } },
            { invoiceNumber: { contains: search, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [transactions, invoices, totals] = await Promise.all([
    prisma.transaction.findMany({
      where: txWhere,
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: "desc" },
      take,
    }),
    prisma.invoice.findMany({
      where: invoiceWhere,
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: "desc" },
      take,
    }),
    prisma.transaction.aggregate({
      where: { type: "TOPUP", status: "SUCCESS" },
      _sum: { amount: true },
    }),
  ]);

  return NextResponse.json({
    transactions,
    invoices,
    lifetimeTopupRevenue: totals._sum.amount ?? 0,
  });
}
