import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/lib/admin";
import { canAssignRole } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

const updateSchema = z.object({
  role: z.enum(["SUPER_ADMIN", "ADMIN", "BILLING", "SUPPORT", "DEVELOPER", "CUSTOMER"]).optional(),
  isActive: z.boolean().optional(),
  balanceAdjustment: z.number().int().optional(), // positive to credit, negative to debit
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requirePermission("users.manage");
  if (guard instanceof NextResponse) return guard;
  const { session } = guard;

  const parsed = updateSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  const { role, isActive, balanceAdjustment } = parsed.data;

  if (params.id === session.user.id && (role === "CUSTOMER" || isActive === false)) {
    return NextResponse.json({ error: "You cannot demote or deactivate your own account" }, { status: 400 });
  }

  // Role assignment has its own, narrower rule than plain "users.manage" —
  // e.g. an ADMIN can promote someone to BILLING/SUPPORT/DEVELOPER, but
  // cannot create another ADMIN or SUPER_ADMIN. See canAssignRole() for
  // the exact table.
  if (role && !canAssignRole(session.user.role, role)) {
    return NextResponse.json(
      { error: `Your role cannot assign the ${role} role.` },
      { status: 403 }
    );
  }

  const target = await prisma.user.findUnique({ where: { id: params.id } });
  if (!target) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const updated = await prisma.$transaction(async (tx) => {
    const user = await tx.user.update({
      where: { id: params.id },
      data: {
        role,
        isActive,
        balance: balanceAdjustment ? { increment: balanceAdjustment } : undefined,
      },
    });

    if (balanceAdjustment) {
      await tx.transaction.create({
        data: {
          userId: user.id,
          type: "ADJUSTMENT",
          status: "SUCCESS",
          amount: balanceAdjustment,
          balanceAfter: user.balance,
          gateway: "MANUAL_TRANSFER",
          description: `Manual balance adjustment by admin (${session.user.email ?? session.user.id})`,
        },
      });
    }

    await tx.activityLog.create({
      data: {
        userId: user.id,
        category: "ACCOUNT",
        action: "admin.user_update",
        message: `Account updated by admin${role ? ` — role set to ${role}` : ""}${
          isActive !== undefined ? ` — ${isActive ? "activated" : "deactivated"}` : ""
        }${balanceAdjustment ? ` — balance adjusted by ${balanceAdjustment}` : ""}`,
      },
    });

    return user;
  });

  return NextResponse.json({ user: updated });
}
