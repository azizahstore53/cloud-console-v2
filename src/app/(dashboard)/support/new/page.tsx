import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NewTicketForm } from "@/components/support/NewTicketForm";
import { ArrowLeft } from "lucide-react";

export default async function NewTicketPage({
  searchParams,
}: {
  searchParams: { instanceId?: string };
}) {
  const session = await auth();
  const instances = await prisma.instance.findMany({
    where: { userId: session!.user.id, status: { not: "TERMINATED" } },
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true },
  });

  // Only honour ?instanceId= when it is one of this user's own instances
  // (e.g. a "Butuh bantuan" link from an instance page); anything else is
  // ignored rather than trusted.
  const defaultInstanceId = instances.some((i: { id: string }) => i.id === searchParams.instanceId)
    ? searchParams.instanceId
    : undefined;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <Link
          href="/support"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-3"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Semua tiket
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Tiket Baru</h1>
      </div>
      <NewTicketForm instances={instances} defaultInstanceId={defaultInstanceId} />
    </div>
  );
}
