"use client";

import React, { useState } from "react";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { cn } from "@/lib/utils";
import type { Role } from "@prisma/client";
import type { SessionUser } from "@/types";

export function DashboardClientWrapper({
  children,
  user,
  balance,
  role
}: {
  children: React.ReactNode;
  user: SessionUser;
  balance: number;
  role: Role;
}) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  return (
    <div className="min-h-screen bg-muted/30 flex">
      <Sidebar role={role} isOpen={isSidebarOpen} />

      <div className={cn(
        "flex flex-col min-h-screen transition-all duration-300 ease-in-out flex-1",
        isSidebarOpen ? "md:pl-64" : "md:pl-0"
      )}>
        <Header
          user={user}
          balance={balance}
          onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
          isSidebarOpen={isSidebarOpen}
        />
        <main className="flex-1 p-4 md:p-8 max-w-[1600px] w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
