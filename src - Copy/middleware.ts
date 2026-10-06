import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { isStaff } from "@/lib/permissions";

const PUBLIC_PATHS = ["/login", "/register", "/forgot-password", "/reset-password", "/auth/two-factor", "/berita"];
// Subset of PUBLIC_PATHS that an already-authenticated person gets bounced
// away from (to /dashboard). Reset-password is deliberately excluded —
// someone might follow a reset link while still logged in on this device.
const REDIRECT_IF_AUTHED_PATHS = ["/login", "/register", "/forgot-password"];
const ADMIN_ONLY_PREFIXES = ["/admin"];

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p));
  const isAuthed = !!req.auth;

  // Redirect unauthenticated users away from protected routes
  if (!isAuthed && !isPublic && pathname !== "/") {
    const loginUrl = new URL("/login", req.nextUrl.origin);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Redirect authenticated users away from auth pages (login/register/forgot-password only)
  if (isAuthed && REDIRECT_IF_AUTHED_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.redirect(new URL("/dashboard", req.nextUrl.origin));
  }

  // 2FA Redirection: if user is authenticated but 2FA is pending
  if (isAuthed && req.auth?.user?.twoFactorPending && pathname !== "/auth/two-factor") {
    console.log(`[Middleware] 2FA Pending for user ${req.auth?.user?.id}. Redirecting to /auth/two-factor. Status:`, {
      twoFactorPending: req.auth?.user?.twoFactorPending,
      twoFactorVerified: req.auth?.user?.twoFactorVerified,
    });
    return NextResponse.redirect(new URL("/auth/two-factor", req.nextUrl.origin));
  }

  // RBAC: gate admin-only routes to any staff role — which specific admin
  // sections a staff role can actually use is narrowed further per-page and
  // per-API-route via requirePermission() (see src/lib/permissions.ts).
  if (isAuthed && ADMIN_ONLY_PREFIXES.some((p) => pathname.startsWith(p))) {
    if (!req.auth?.user?.role || !isStaff(req.auth.user.role)) {
      return NextResponse.redirect(new URL("/dashboard", req.nextUrl.origin));
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.png$).*)"],
};
