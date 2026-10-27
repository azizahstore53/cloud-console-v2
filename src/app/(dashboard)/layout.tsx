import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { DashboardClientWrapper } from "@/components/layout/DashboardClientWrapper";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { balance: true },
  });

  return (
    <DashboardClientWrapper
      user={session.user}
      balance={user?.balance ?? 0}
      role={session.user.role}
    >
      {children}
    </DashboardClientWrapper>
  );
}
