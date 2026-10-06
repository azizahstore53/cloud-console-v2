import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { TicketThread } from "@/components/support/TicketThread";
import { ArrowLeft } from "lucide-react";

export default async function AdminTicketPage({ params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user || !hasPermission(session.user.role, "tickets.manage")) redirect("/admin");

  return (
    <div className="space-y-4">
      <Link
        href="/admin/support"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Semua tiket
      </Link>
      <TicketThread ticketId={params.id} mode="staff" />
    </div>
  );
}
