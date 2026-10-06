/**
 * Simple in-memory fixed-window rate limiter.
 * ---------------------------------------------------------------------------
 * Scope/limitation, stated up front: state lives in process memory, so it
 * resets on restart and isn't shared across multiple app instances or
 * processes. That's a deliberate fit for this app's primary deployment
 * target — a single long-running Node process on one VPS (see the README's
 * "Deploying the Database on IDCloudHost" section for the intended setup).
 *
 * If you ever run multiple app instances behind a load balancer, or deploy
 * serverless (where each invocation may get a fresh process), this stops
 * being effective — an attacker can simply get routed to a different
 * instance with its own separate counters. At that point, switch to a
 * shared store: Upstash Redis + `@upstash/ratelimit` is the common choice
 * and requires no infrastructure beyond a Redis endpoint.
 */

interface Bucket {
  count: number;
  resetAt: number;
}

export interface RateLimitResult {
  success: boolean;
  remaining: number;
  /** Epoch ms when this key's window resets. */
  resetAt: number;
}

const globalForRateLimiters = globalThis as unknown as {
  __rateLimiterBuckets?: Map<string, Map<string, Bucket>>;
};

// Keyed by limiter name so each createRateLimiter() call gets its own
// bucket map, but survives Next.js dev-mode hot-reloading (same pattern as
// the Prisma client singleton in src/lib/prisma.ts) rather than resetting
// on every file save.
const registries =
  globalForRateLimiters.__rateLimiterBuckets ?? new Map<string, Map<string, Bucket>>();
if (process.env.NODE_ENV !== "production") globalForRateLimiters.__rateLimiterBuckets = registries;

export interface RateLimiter {
  /** Consume one attempt from this key's budget and report whether it's
   * still within the limit. Use for endpoints where every call — success
   * or failure — should count (registration, password-reset requests). */
  check(key: string): RateLimitResult;
  /** Read-only: is this key currently over its limit, without consuming
   * an attempt? Use to fail fast before doing expensive work (e.g. a
   * bcrypt compare) when you only want *failures* to count — see
   * `recordFailure`. */
  peek(key: string): RateLimitResult;
  /** Consume one attempt, intended to be called only after a failure.
   * Pair with `peek` (check before doing work) and `reset` (clear on
   * success) to build a "only failed attempts count" limiter, which is
   * what login uses so legitimate repeated successful logins never trip
   * it. */
  recordFailure(key: string): RateLimitResult;
  /** Clear a key's counter entirely — call on success so a prior run of
   * failed attempts doesn't linger and eventually block a legitimate
   * login that came after the person got their password right. */
  reset(key: string): void;
}

export function createRateLimiter(name: string, limit: number, windowMs: number): RateLimiter {
  let store = registries.get(name);
  if (!store) {
    store = new Map<string, Bucket>();
    registries.set(name, store);
  }
  const buckets = store;

  // Lazily sweep expired entries so memory doesn't grow unbounded over a
  // long-running process. Cheap: only runs once the map gets large enough
  // to matter, not on every single check.
  function sweep() {
    if (buckets.size < 10_000) return;
    const now = Date.now();
    for (const [key, bucket] of buckets) {
      if (bucket.resetAt <= now) buckets.delete(key);
    }
  }

  function peekOrConsume(key: string, consume: boolean): RateLimitResult {
    sweep();
    const now = Date.now();
    const existing = buckets.get(key);

    if (!existing || existing.resetAt <= now) {
      if (!consume) return { success: true, remaining: limit, resetAt: now + windowMs };
      const resetAt = now + windowMs;
      buckets.set(key, { count: 1, resetAt });
      return { success: true, remaining: limit - 1, resetAt };
    }

    if (existing.count >= limit) {
      return { success: false, remaining: 0, resetAt: existing.resetAt };
    }

    if (!consume) return { success: true, remaining: limit - existing.count, resetAt: existing.resetAt };

    existing.count += 1;
    return { success: true, remaining: limit - existing.count, resetAt: existing.resetAt };
  }

  return {
    check: (key) => peekOrConsume(key, true),
    peek: (key) => peekOrConsume(key, false),
    recordFailure: (key) => peekOrConsume(key, true),
    reset: (key) => {
      buckets.delete(key);
    },
  };
}

/**
 * Best-effort client IP extraction from `x-forwarded-for`.
 *
 * ⚠️ This header is trivially spoofable unless the app sits behind a
 * reverse proxy/load balancer that's configured to strip any
 * client-supplied `X-Forwarded-For` and set its own. If you deploy this
 * directly exposed (no proxy in front), an attacker can set an arbitrary
 * value here and get a fresh rate-limit bucket on every request, making
 * IP-based limiting a no-op. Behind a properly configured Nginx/Caddy/load
 * balancer in front of the app (the normal setup for a VPS deployment),
 * this is fine.
 */
export function getClientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}
