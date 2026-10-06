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

    if (!user || (!user.twoFactorSecret && !user.twoFactorRecoveryCodes)) {
      return NextResponse.json({ error: "2FA not configured" }, { status: 400 });
    }

    // A TOTP code from an authenticator app is always exactly 6 digits.
    // Anything else (recovery codes look like "A1B2C-3D4E5") is treated as
    // a recovery-code attempt instead — this is how a lost-device login
    // is recognized without a separate toggle the person has to find while
    // already locked out and stressed.
    const looksLikeTotp = /^\d{6}$/.test(tokenValue);

    if (looksLikeTotp && user.twoFactorSecret) {
      const isValid = twoFactorService.verifyToken(tokenValue, user.twoFactorSecret);
      if (!isValid) {
        return NextResponse.json({ error: "Invalid 2FA token" }, { status: 400 });
      }

      await prisma.user.update({
        where: { id: session.user.id },
        data: { lastTwoFactorVerifiedAt: new Date() },
      });

      return NextResponse.json({ success: true });
    }

    // Recovery code path.
    const result = twoFactorService.verifyAndConsumeRecoveryCode(tokenValue, user.twoFactorRecoveryCodes);
    if (!result.valid) {
      return NextResponse.json({ error: "Invalid 2FA token" }, { status: 400 });
    }

    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        lastTwoFactorVerifiedAt: new Date(),
        twoFactorRecoveryCodes: result.remaining,
      },
    });

    return NextResponse.json({
      success: true,
      usedRecoveryCode: true,
      recoveryCodesLeft: result.codesLeft,
    });
  } catch (error) {
    console.error("[2FA Verification Error]:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
