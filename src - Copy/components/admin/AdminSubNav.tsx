"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { hasPermission, type Permission } from "@/lib/permissions";
import type { Role } from "@prisma/client";

const TABS: { href: string; label: string; exact?: boolean; permission?: Permission }[] = [
  { href: "/admin", label: "Overview", exact: true }, // no permission = visible to any staff role
  { href: "/admin/analytics", label: "Analytics", permission: "billing.manage" },
  { href: "/admin/users", label: "Users", permission: "users.manage" },
  { href: "/admin/instances", label: "Instances", permission: "instances.manage" },
  { href: "/admin/plans", label: "Plans", permission: "catalog.manage" },
  { href: "/admin/regions", label: "Regions", permission: "catalog.manage" },
  { href: "/admin/news", label: "News", permission: "news.manage" },
  { href: "/admin/billing", label: "Billing", permission: "billing.manage" },
  { href: "/admin/activity", label: "Activity" },
];

export function AdminSubNav({ role }: { role: Role }) {
  const pathname = usePathname();
  const visibleTabs = TABS.filter((tab) => !tab.permission || hasPermission(role, tab.permission));

  return (
    <div className="border-b flex gap-1 overflow-x-auto">
      {visibleTabs.map((tab) => {
        const active = tab.exact ? pathname === tab.href : pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "px-3 py-2 text-sm font-medium border-b-2 -mb-px whitespace-nowrap transition-colors",
              active
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
