import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { getClientIp } from "@/lib/rateLimit";
import { forgotPasswordRateLimiter } from "@/lib/rateLimiters";
import { sendPasswordResetEmail } from "@/lib/email/mailer";

const schema = z.object({ email: z.string().email() });

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const limit = forgotPasswordRateLimiter.check(ip);
  if (!limit.success) {
    return NextResponse.json(
      { error: "Too many reset requests from this network. Please try again later." },
      { status: 429, headers: { "Retry-After": String(Math.ceil((limit.resetAt - Date.now()) / 1000)) } }
    );
  }

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid email" }, { status: 400 });

  const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });

  // Always respond success to avoid leaking which emails are registered.
  if (user) {
    // Invalidate any previous outstanding reset links first, so only the
    // most recently requested one works — avoids several old emails all
    // being separately valid at once.
    await prisma.passwordResetToken.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { usedAt: new Date() },
    });

    const token = crypto.randomBytes(32).toString("hex");
    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        token,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      },
    });

    const resetUrl = `${process.env.NEXT_PUBLIC_APP_URL}/reset-password?token=${token}`;
    try {
      await sendPasswordResetEmail(user.email, resetUrl);
    } catch (err) {
      // Don't let an SMTP hiccup leak into the response (that would also
      // reveal to the caller whether the email exists, via a different
      // error path than the 400 below). Log for the admin to investigate,
      // and still return the same generic success message.
      console.error("Failed to send password reset email:", err);
    }
  }

  return NextResponse.json({ success: true });
}
