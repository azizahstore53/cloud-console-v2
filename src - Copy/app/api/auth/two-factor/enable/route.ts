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
    const { secret, token } = await req.json();

    if (!secret || !token) {
      return NextResponse.json({ error: "Secret and token are required" }, { status: 400 });
    }

    // 1. Verify the token against the provided secret
    const isValid = twoFactorService.verifyToken(token, secret);

    if (!isValid) {
      return NextResponse.json({ error: "Invalid verification code" }, { status: 400 });
    }

    // 2. Generate recovery codes
    const recoveryCodes = twoFactorService.generateRecoveryCodes();

    // 3. Save to database
    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        twoFactorSecret: secret,
        twoFactorEnabled: true,
        twoFactorRecoveryCodes: recoveryCodes.join(", "),
      },
    });

    return NextResponse.json({
      success: true,
      recoveryCodes
    });
  } catch (error) {
    console.error("[2FA Enable Error]:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
