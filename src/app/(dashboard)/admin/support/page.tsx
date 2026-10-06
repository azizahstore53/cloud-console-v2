import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { AdminTicketList } from "@/components/support/AdminTicketList";

export default async function AdminSupportPage() {
  const session = await auth();
  // The API is the real gate (requirePermission), but a staff role without
  // this permission who opens the URL directly should be sent back to the
  // overview rather than see an empty shell.
  if (!session?.user || !hasPermission(session.user.role, "tickets.manage")) redirect("/admin");

  return <AdminTicketList />;
}
