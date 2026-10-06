import { createRateLimiter } from "./rateLimit";

// Login attempts, keyed by the submitted email (not IP) — see
// src/lib/auth.ts for why: brute-forcing one account from many rotating
// IPs is a more realistic threat than one IP trying many accounts here,
// and this stays effective either way since it doesn't depend on IP
// headers being trustworthy.
export const loginRateLimiter = createRateLimiter("login", 10, 15 * 60 * 1000); // 10 / 15 min per email

// Account creation, registration link abuse, keyed by client IP.
export const registerRateLimiter = createRateLimiter("register", 5, 60 * 60 * 1000); // 5 / hour per IP

// Password reset requests — also guards against using this endpoint to
// enumerate which emails are registered via timing/volume, on top of
// preventing spam.
export const forgotPasswordRateLimiter = createRateLimiter("forgot-password", 5, 60 * 60 * 1000); // 5 / hour per IP

// Reset-password submissions. Tokens are 32 bytes of crypto-random hex, so
// brute-forcing one is already computationally infeasible — this is
// defense-in-depth against automated abuse, not the primary protection.
export const resetPasswordRateLimiter = createRateLimiter("reset-password", 10, 60 * 60 * 1000); // 10 / hour per IP
