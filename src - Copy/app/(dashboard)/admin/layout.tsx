import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { isStaff } from "@/lib/permissions";
import { AdminSubNav } from "@/components/admin/AdminSubNav";
import { ShieldAlert } from "lucide-react";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  // Defense in depth — middleware already gates /admin/*, but never trust
  // only the edge layer for authorization checks.
  if (!session?.user) redirect("/login");
  if (!isStaff(session.user.role)) redirect("/dashboard");

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center gap-2">
        <ShieldAlert className="h-5 w-5 text-primary" />
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Admin Panel</h1>
          <p className="text-muted-foreground text-sm">Platform-wide management — visible to staff only.</p>
        </div>
      </div>
      <AdminSubNav role={session.user.role} />
      {children}
    </div>
  );
}
