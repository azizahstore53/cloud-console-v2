import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getCloudProvider } from "@/lib/cloud/ProviderFactory";

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const provider = getCloudProvider();
  const images = await provider.listImages();
  return NextResponse.json({ images });
}
