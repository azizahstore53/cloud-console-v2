import Link from "next/link";
import { CustomerTicketList } from "@/components/support/CustomerTicketList";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

export default function SupportPage() {
  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Support</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Hubungi tim kami. Balasan biasanya muncul di sini dan bisa Anda lanjutkan kapan saja.
          </p>
        </div>
        <Link href="/support/new">
          <Button className="gap-2">
            <Plus className="h-4 w-4" /> Tiket Baru
          </Button>
        </Link>
      </div>
      <CustomerTicketList />
    </div>
  );
}
