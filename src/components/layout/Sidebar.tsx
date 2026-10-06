"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Server,
  HardDrive,
  Network,
  Rocket,
  Receipt,
  Settings,
  KeyRound,
  Cloud,
  ShieldAlert,
  LifeBuoy,
} from "lucide-react";
import { isStaff } from "@/lib/permissions";
import { useSupportBadge } from "@/hooks/useSupportBadge";
import type { Role } from "@prisma/client";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/compute", label: "Compute", icon: Server },
  { href: "/storage", label: "Storage", icon: HardDrive },
  { href: "/networking", label: "Networking", icon: Network },
  { href: "/apps", label: "App Deployer", icon: Rocket },
  { href: "/ssh-keys", label: "SSH Keys", icon: KeyRound },
  { href: "/billing", label: "Billing", icon: Receipt },
  { href: "/support", label: "Support", icon: LifeBuoy },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar({ role }: { role?: Role }) {
  const pathname = usePathname();
  const { data: badge } = useSupportBadge();

  return (
    <aside className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0 border-r bg-card">
      <div className="flex items-center gap-2 px-6 h-16 border-b">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Cloud className="h-4.5 w-4.5" />
        </div>
        <span className="font-semibold text-lg tracking-tight">CloudConsole</span>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-4 overflow-y-auto">
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
              {item.href === "/support" && !!badge?.customerUnread && (
                <span className="ml-auto rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold leading-none text-primary-foreground">
                  {badge.customerUnread}
                </span>
              )}
            </Link>
          );
        })}

        {role && isStaff(role) && (
          <>
            <div className="pt-3 pb-1 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">
              Administration
            </div>
            <Link
              href="/admin"
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                pathname === "/admin" || pathname.startsWith("/admin/")
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              )}
            >
              <ShieldAlert className="h-4 w-4" />
              Admin Panel
            </Link>
          </>
        )}
      </nav>

      <div className="p-4 border-t">
        <div className="rounded-lg bg-muted p-3 text-xs text-muted-foreground">
          <p className="font-medium text-foreground mb-1">Region</p>
          <p>Jakarta 1 (id-jkt-1)</p>
        </div>
      </div>
    </aside>
  );
}
