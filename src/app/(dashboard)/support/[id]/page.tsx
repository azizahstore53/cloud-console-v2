import Link from "next/link";
import { TicketThread } from "@/components/support/TicketThread";
import { ArrowLeft } from "lucide-react";

export default function TicketPage({ params }: { params: { id: string } }) {
  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <Link
        href="/support"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Semua tiket
      </Link>
      <TicketThread ticketId={params.id} mode="customer" />
    </div>
  );
}
