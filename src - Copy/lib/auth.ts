import NextAuth, { type DefaultSession } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { loginRateLimiter } from "@/lib/rateLimiters";
import { isStaff } from "@/lib/permissions";
import type { Role } from "@prisma/client";

// Augment the default session/JWT types with our custom fields (role, id).
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: Role;
      twoFactorVerified?: boolean;
      twoFactorPending?: boolean;
    } & DefaultSession["user"];
  }
  interface User {
    role: Role;
    twoFactorEnabled?: boolean;
    twoFactorPending?: boolean;
    twoFactorVerified?: boolean;
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    id: string;
    role: Role;
    twoFactorPending?: boolean;
    twoFactorVerified?: boolean;
  }
}

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(raw) {
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) return null;
        const { email, password } = parsed.data;
        const rateLimitKey = email.toLowerCase();

        if (!loginRateLimiter.peek(rateLimitKey).success) return null;

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user || !user.passwordHash || !user.isActive) {
          loginRateLimiter.recordFailure(rateLimitKey);
          return null;
        }

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) {
          loginRateLimiter.recordFailure(rateLimitKey);
          return null;
        }

        loginRateLimiter.reset(rateLimitKey);

        const requires2FA = user.twoFactorEnabled || isStaff(user.role);
        const isVerified = user.lastTwoFactorVerifiedAt &&
                           (Date.now() - user.lastTwoFactorVerifiedAt.getTime() < 24 * 60 * 60 * 1000);

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
          role: user.role,
          twoFactorPending: requires2FA && !isVerified,
          twoFactorVerified: !requires2FA || isVerified,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger }) {
      // 1. Initial sign-in
      if (user) {
        token.id = user.id as string;
        token.role = user.role;
        token.twoFactorPending = (user as any).twoFactorPending;
        token.twoFactorVerified = (user as any).twoFactorVerified;
        return token;
      }

      // 2. Handle session updates (via update() call from the client after
      // a successful /api/auth/two-factor/verify). Only re-derive 2FA state
      // from the DB on this explicit trigger — never as a side effect of
      // every request. This callback also runs inside middleware (Edge
      // runtime), where Prisma Client cannot execute queries at all; gating
      // on `trigger === "update"` means that path is only ever taken from a
      // real Node.js API route (where the client's update() call lands),
      // so middleware never attempts the DB call in the first place.
      if (trigger === "update") {
        try {
          const dbUser = await prisma.user.findUnique({
            where: { id: token.id },
          });

          if (dbUser) {
            const requires2FA = dbUser.twoFactorEnabled || isStaff(dbUser.role);
            const isVerified = dbUser.lastTwoFactorVerifiedAt &&
                               (Date.now() - dbUser.lastTwoFactorVerifiedAt.getTime() < 24 * 60 * 60 * 1000);

            token.twoFactorPending = requires2FA && !isVerified;
            token.twoFactorVerified = !requires2FA || isVerified;

            console.log(`[Auth JWT] Refreshed 2FA state for ${token.id}: pending=${token.twoFactorPending}`);
          }
        } catch (error) {
          console.error("[Auth JWT] DB Error during 2FA refresh:", error);
        }
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id;
        session.user.role = token.role;
        session.user.twoFactorVerified = token.twoFactorVerified;
        session.user.twoFactorPending = token.twoFactorPending;
      }
      return session;
    },
  },
});
