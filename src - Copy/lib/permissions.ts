import type { Role } from "@prisma/client";

/**
 * permissions
 * ---------------------------------------------------------------------------
 * Single source of truth for "what can this role do". Every /admin API route
 * and every admin nav item checks against this file — never a hardcoded
 * `role === "ADMIN"` scattered around the codebase, so there is exactly one
 * place to look when deciding (or changing) what a role is allowed to do.
 *
 * Roles are a flat hierarchy stored directly on User.role (see
 * schema.prisma) — not a many-to-many roles/permissions table. That's a
 * deliberate simplification: six fixed roles cover the org today, and a
 * full RBAC table is easy to introduce later if you ever need custom
 * per-user permission combinations, but would be pure overhead right now.
 */

export const STAFF_ROLES: Role[] = ["SUPER_ADMIN", "ADMIN", "BILLING", "SUPPORT", "DEVELOPER"];

export function isStaff(role: Role): boolean {
  return STAFF_ROLES.includes(role);
}

export type Permission =
  | "users.manage" // activate/deactivate accounts, edit profile fields (NOT role changes — see canAssignRole)
  | "billing.manage" // view/adjust balances, invoices, transactions, run the billing cycle
  | "instances.manage" // view/reboot/terminate any customer's instance
  | "catalog.manage" // instance plans, regions, blueprints
  | "news.manage"; // the News/Berita admin panel

const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  SUPER_ADMIN: ["users.manage", "billing.manage", "instances.manage", "catalog.manage", "news.manage"],
  ADMIN: ["users.manage", "billing.manage", "instances.manage", "catalog.manage", "news.manage"],
  BILLING: ["billing.manage"],
  SUPPORT: ["instances.manage"],
  DEVELOPER: ["instances.manage", "catalog.manage"],
  CUSTOMER: [],
};

export function hasPermission(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

/**
 * Governs role *assignment* specifically (changing someone's User.role),
 * which is more sensitive than any single Permission above and doesn't fit
 * the same list-of-permissions shape — it's a relation between the actor's
 * role and the role they're trying to grant, not a flat yes/no per role:
 *   - SUPER_ADMIN can assign any role, to anyone.
 *   - ADMIN can assign anything EXCEPT SUPER_ADMIN or ADMIN itself — so an
 *     Admin can build out their Billing/Support/Developer team, but can't
 *     create a peer or superior admin account.
 *   - Every other role can't assign roles at all, regardless of what
 *     `users.manage` would otherwise allow.
 */
export function canAssignRole(actorRole: Role, targetRole: Role): boolean {
  if (actorRole === "SUPER_ADMIN") return true;
  if (actorRole === "ADMIN") return targetRole !== "SUPER_ADMIN" && targetRole !== "ADMIN";
  return false;
}
