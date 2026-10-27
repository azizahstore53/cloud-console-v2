import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const invoiceId = params.id;

  try {
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        user: true,
        items: true,
        transactions: true,
      },
    });

    if (!invoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    // Security Check: Only the owner or admin can access the invoice
    if (session.user.id !== invoice.userId && session.user.role !== "SUPER_ADMIN" && session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden: You cannot access this invoice" }, { status: 403 });
    }

    // We return the data for the client to generate PDF using jsPDF
    // This avoids server-side PDF generation complexity and is faster.
    return NextResponse.json({
      invoice,
      businessDetails: {
        name: "DevCloudhost",
        email: "billing@devcloudhost.com",
        address: "Digital Infrastructure Hub, Cloud City",
        taxId: "ID-123456789",
      },
    });
  } catch (error: any) {
    console.error("Error fetching invoice data:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
