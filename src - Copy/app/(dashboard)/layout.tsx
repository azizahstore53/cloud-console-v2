import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { balance: true },
  });

  return (
    <div className="min-h-screen bg-muted/30">
      <Sidebar role={session.user.role} />
      <div className="md:pl-64 flex flex-col min-h-screen">
        <Header user={session.user} balance={user?.balance ?? 0} />
        <main className="flex-1 p-4 md:p-8 max-w-[1600px] w-full mx-auto">{children}</main>
      </div>
    </div>
  );
}
