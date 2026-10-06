import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { twoFactorService } from "@/lib/auth/two-factor/two-factor";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const session = await auth();

  if (!session || !session.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { token } = await req.json();

    if (!token || typeof token !== "string") {
      return NextResponse.json({ error: "Invalid token" }, { status: 400 });
    }

    const tokenValue = token.trim();

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
    });

    if (!user || !user.twoFactorSecret) {
      return NextResponse.json({ error: "2FA not configured" }, { status: 400 });
    }

    // Verify real TOTP token
    const isValid = twoFactorService.verifyToken(tokenValue, user.twoFactorSecret);

    if (!isValid) {
      return NextResponse.json({ error: "Invalid 2FA token" }, { status: 400 });
    }

    // Mark as verified
    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        lastTwoFactorVerifiedAt: new Date(),
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[2FA Verification Error]:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
