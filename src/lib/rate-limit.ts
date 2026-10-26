import { NextResponse } from "next/server";

// Simple in-memory store for rate limiting.
// NOTE: In a multi-instance production environment (like Vercel),
// this should be replaced with Redis (e.g., @upstash/ratelimit).
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

export async function rateLimit(
  identifier: string,
  limit: number = 5,
  windowMs: number = 15 * 60 * 1000 // 15 minutes
) {
  const now = Date.now();
  const record = rateLimitStore.get(identifier);

  if (!record || now > record.resetAt) {
    // Reset or create new record
    rateLimitStore.set(identifier, {
      count: 1,
      resetAt: now + windowMs,
    });
    return { success: true, remaining: limit - 1 };
  }

  if (record.count >= limit) {
    return {
      success: false,
      remaining: 0,
      resetAt: record.resetAt
    };
  }

  // Increment count
  record.count++;
  rateLimitStore.set(identifier, record);

  return { success: true, remaining: limit - record.count };
}

// Utility to clear store if needed (e.g., during tests)
export function clearRateLimit(identifier: string) {
  rateLimitStore.delete(identifier);
}
