import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { twoFactorService } from "@/lib/auth/two-factor/two-factor";
import { NextResponse } from "next/server";

export async function POST() {
  const session = await auth();

  if (!session || !session.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
    });

    if (!user || !user.email) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Generate a temporary secret for setup
    // In a production app, you might want to store this in a temporary
    // session or cache until the user verifies the first code.
    const { secret, otpauthUrl } = await twoFactorService.generateSecret(user.email);
    const qrCodeUrl = await twoFactorService.generateQrCode(otpauthUrl);

    // We return the secret to the frontend so it can be sent back during verification
    // but it is NOT yet saved to the database.
    return NextResponse.json({
      secret,
      qrCodeUrl,
    });
  } catch (error) {
    console.error("[2FA Setup Init Error]:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
