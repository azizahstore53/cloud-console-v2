import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isStaff, hasPermission, type Permission } from "@/lib/permissions";

/**
 * Guards a route that any staff role may open (read-only overview pages —
 * e.g. the activity log). For anything that mutates data or shows
 * sensitive data specific to one domain (billing, users, instances,
 * catalog, news), use requirePermission() instead so only the roles that
 * actually own that domain get in.
 *
 * Usage:
 *   const guard = await requireStaff();
 *   if (guard instanceof NextResponse) return guard;
 *   const { session } = guard;
 */
export async function requireStaff() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isStaff(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return { session };
}

/**
 * Guards a route to only the staff roles that hold `permission` — see
 * src/lib/permissions.ts for the full matrix.
 *
 * Usage:
 *   const guard = await requirePermission("billing.manage");
 *   if (guard instanceof NextResponse) return guard;
 *   const { session } = guard;
 */
export async function requirePermission(permission: Permission) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!hasPermission(session.user.role, permission)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return { session };
}
