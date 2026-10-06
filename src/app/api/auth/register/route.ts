import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { getClientIp } from "@/lib/rateLimit";
import { registerRateLimiter } from "@/lib/rateLimiters";

const registerSchema = z.object({
  name: z.string().min(2).max(64),
  email: z.string().email(),
  password: z.string().min(8),
});

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const limit = registerRateLimiter.check(ip);
  if (!limit.success) {
    return NextResponse.json(
      { error: "Too many accounts created from this network. Please try again later." },
      { status: 429, headers: { "Retry-After": String(Math.ceil((limit.resetAt - Date.now()) / 1000)) } }
    );
  }

  const parsed = registerSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", issues: parsed.error.flatten() }, { status: 400 });
  }
  const { name, email, password } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: "An account with this email already exists" }, { status: 409 });
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const user = await prisma.user.create({
    data: {
      name,
      email,
      passwordHash,
      role: "CUSTOMER",
      balance: 0,
    },
  });

  await prisma.activityLog.create({
    data: {
      userId: user.id,
      category: "AUTH",
      action: "auth.register",
      message: "Account created",
    },
  });

  return NextResponse.json({ success: true }, { status: 201 });
}
