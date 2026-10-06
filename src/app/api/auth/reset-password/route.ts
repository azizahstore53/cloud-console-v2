import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

const resetSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8),
});

/**
 * Lets the reset-password page check a token's validity as soon as it
 * loads, before the person types anything — so an expired/already-used
 * link shows a clear message immediately instead of only failing after
 * they've filled in a new password.
 */
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token) return NextResponse.json({ valid: false, reason: "missing" }, { status: 400 });

  const record = await prisma.passwordResetToken.findUnique({ where: { token } });
  if (!record) return NextResponse.json({ valid: false, reason: "not_found" });
  if (record.usedAt) return NextResponse.json({ valid: false, reason: "used" });
  if (record.expiresAt < new Date()) return NextResponse.json({ valid: false, reason: "expired" });

  return NextResponse.json({ valid: true });
}

export async function POST(req: NextRequest) {
  const parsed = resetSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", issues: parsed.error.flatten() }, { status: 400 });
  }
  const { token, password } = parsed.data;

  const record = await prisma.passwordResetToken.findUnique({ where: { token } });
  if (!record) {
    return NextResponse.json({ error: "This reset link is invalid." }, { status: 400 });
  }
  if (record.usedAt) {
    return NextResponse.json({ error: "This reset link has already been used." }, { status: 400 });
  }
  if (record.expiresAt < new Date()) {
    return NextResponse.json({ error: "This reset link has expired. Request a new one." }, { status: 400 });
  }

  const passwordHash = await bcrypt.hash(password, 12);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: record.userId },
      data: { passwordHash },
    }),
    // Consume this token...
    prisma.passwordResetToken.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    }),
    // ...and invalidate any other outstanding reset links for this user, so
    // an older email/link can't be replayed after the password has already
    // been changed via a newer one.
    prisma.passwordResetToken.updateMany({
      where: { userId: record.userId, usedAt: null, id: { not: record.id } },
      data: { usedAt: new Date() },
    }),
    prisma.activityLog.create({
      data: {
        userId: record.userId,
        category: "AUTH",
        action: "auth.password_reset",
        message: "Password was reset via a reset-password link.",
      },
    }),
  ]);

  return NextResponse.json({ success: true });
}
