-- Expand Role from a binary ADMIN/USER into a full staff hierarchy.
-- Written by hand instead of relying on `prisma migrate dev` to
-- auto-generate this, because Prisma's default diff for a renamed enum
-- value is DROP the old value + ADD the new one, which fails outright (or
-- silently orphans rows) once any user actually has that value — RENAME
-- VALUE is the safe, zero-downtime way to do this in Postgres.

ALTER TYPE "Role" RENAME VALUE 'USER' TO 'CUSTOMER';

ALTER TYPE "Role" ADD VALUE 'SUPER_ADMIN';
ALTER TYPE "Role" ADD VALUE 'BILLING';
ALTER TYPE "Role" ADD VALUE 'SUPPORT';
ALTER TYPE "Role" ADD VALUE 'DEVELOPER';

-- Existing ADMIN users are left as ADMIN (not auto-promoted to
-- SUPER_ADMIN) — nobody's access silently gets broader than it was.
-- You still need at least one SUPER_ADMIN to grant SUPER_ADMIN/ADMIN to
-- anyone else going forward (only SUPER_ADMIN can do that — see
-- src/lib/permissions.ts), so run this once, manually, for your own
-- account after this migration:
--
--   UPDATE users SET role = 'SUPER_ADMIN' WHERE email = 'you@yourdomain.com';
