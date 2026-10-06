import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * These tests mock `@/lib/prisma` with a small in-memory implementation of
 * just the client methods `calculator.ts` actually calls, rather than
 * hitting a real PostgreSQL database. That's a deliberate scope choice:
 *
 * - It keeps this suite fast and dependency-free (no test database to
 *   provision/migrate/seed in CI or on a fresh clone).
 * - It's enough to genuinely exercise the business logic that matters most
 *   here — balance arithmetic, the insufficient-balance guard, and
 *   critically, `confirmTopUp`'s exactly-once claim semantics (the thing
 *   that was vulnerable to double-crediting before it existed).
 *
 * What this does NOT cover: real Postgres transaction isolation, actual
 * row-level locking behavior under real concurrent connections, or
 * anything about the Prisma schema/migrations being correct. The
 * concurrent-confirmation test below works because this mock's mutating
 * step happens to be a single synchronous block with no `await` inside it
 * (mirroring what a real `UPDATE ... WHERE status = 'PENDING'` guarantees
 * atomically in Postgres) — that's a deliberate simulation of the
 * guarantee being relied on, not a proof that the real database provides
 * it. Treat this as a solid unit-test layer; an integration test against a
 * real Postgres instance (e.g. via Testcontainers) would be the natural
 * next step for full confidence.
 */

interface MockUser {
  id: string;
  balance: number;
}

interface MockTransaction {
  id: string;
  userId: string;
  type: string;
  status: string;
  amount: number;
  balanceAfter: number;
  gateway?: string | null;
  gatewayRef?: string | null;
  description?: string | null;
}

const { store, mockPrisma } = vi.hoisted(() => {
  const store = {
    users: new Map<string, MockUser>(),
    transactions: [] as MockTransaction[],
    nextId: 1,
  };

  function genId() {
    return `tx_${store.nextId++}`;
  }

  const mockPrisma: any = {
    user: {
      findUniqueOrThrow: async ({ where }: any) => {
        const user = store.users.get(where.id);
        if (!user) throw new Error(`User ${where.id} not found`);
        return { ...user };
      },
      update: async ({ where, data }: any) => {
        const user = store.users.get(where.id);
        if (!user) throw new Error(`User ${where.id} not found`);
        if (data.balance && typeof data.balance === "object" && "increment" in data.balance) {
          user.balance += data.balance.increment;
        } else if (data.balance !== undefined) {
          user.balance = data.balance;
        }
        return { ...user };
      },
    },
    transaction: {
      create: async ({ data }: any) => {
        const record: MockTransaction = { id: genId(), ...data };
        store.transactions.push(record);
        return { ...record };
      },
      findUnique: async ({ where }: any) => {
        const record = store.transactions.find((t) => t.id === where.id);
        return record ? { ...record } : null;
      },
      updateMany: async ({ where, data }: any) => {
        let count = 0;
        for (const t of store.transactions) {
          const matchesId = where.id === undefined || t.id === where.id;
          const matchesStatus = where.status === undefined || t.status === where.status;
          const matchesUserId = where.userId === undefined || t.userId === where.userId;
          if (matchesId && matchesStatus && matchesUserId) {
            Object.assign(t, data);
            count++;
          }
        }
        return { count };
      },
      update: async ({ where, data }: any) => {
        const record = store.transactions.find((t) => t.id === where.id);
        if (!record) throw new Error(`Transaction ${where.id} not found`);
        Object.assign(record, data);
        return { ...record };
      },
    },
    $transaction: async (arg: any) => {
      if (typeof arg === "function") return arg(mockPrisma);
      return Promise.all(arg);
    },
  };

  return { store, mockPrisma };
});

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

// Imported after the mock is registered, per Vitest's hoisting model.
const { calculateUsageCharge, estimateMonthlyCost, formatCurrency, chargeWallet, creditWallet, confirmTopUp } =
  await import("./calculator");

function seedUser(id: string, balance: number) {
  store.users.set(id, { id, balance });
}

function seedTopUpTransaction(overrides: Partial<MockTransaction> & { userId: string; amount: number }) {
  const record: MockTransaction = {
    id: `tx_${store.nextId++}`,
    type: "TOPUP",
    status: "PENDING",
    balanceAfter: 0,
    gateway: "XENDIT",
    gatewayRef: `mock-ref-${store.nextId}`,
    description: "Wallet top-up",
    ...overrides,
  };
  store.transactions.push(record);
  return record;
}

beforeEach(() => {
  store.users.clear();
  store.transactions.length = 0;
  store.nextId = 1;
});

describe("calculateUsageCharge", () => {
  const hourlyPlan = { pricePerHour: 1000, pricePerMonth: 720_000 };

  it("charges pricePerHour * hoursElapsed for HOURLY plans", () => {
    expect(calculateUsageCharge(hourlyPlan, "HOURLY", 1)).toBe(1000);
    expect(calculateUsageCharge(hourlyPlan, "HOURLY", 2.5)).toBe(2500);
  });

  it("returns 0 for zero elapsed hours", () => {
    expect(calculateUsageCharge(hourlyPlan, "HOURLY", 0)).toBe(0);
    expect(calculateUsageCharge(hourlyPlan, "MONTHLY", 0)).toBe(0);
  });

  it("prorates MONTHLY plans down to an hourly-equivalent rate", () => {
    // 720,000 / (30 * 24) = 1,000 per hour-equivalent
    expect(calculateUsageCharge(hourlyPlan, "MONTHLY", 1)).toBe(1000);
    expect(calculateUsageCharge(hourlyPlan, "MONTHLY", 24)).toBe(24_000);
    expect(calculateUsageCharge(hourlyPlan, "MONTHLY", 720)).toBe(720_000); // full month
  });

  it("rounds to the nearest whole currency unit rather than leaving fractions", () => {
    const plan = { pricePerHour: 333, pricePerMonth: 1 };
    // 333 * (1/3) = 111 exactly-ish; assert the result is an integer either way
    const result = calculateUsageCharge(plan, "HOURLY", 1 / 3);
    expect(Number.isInteger(result)).toBe(true);
  });
});

describe("estimateMonthlyCost", () => {
  it("returns pricePerMonth directly for MONTHLY plans", () => {
    expect(estimateMonthlyCost({ pricePerHour: 1000, pricePerMonth: 500_000 }, "MONTHLY")).toBe(500_000);
  });

  it("extrapolates pricePerHour * 24 * 30 for HOURLY plans", () => {
    expect(estimateMonthlyCost({ pricePerHour: 1000, pricePerMonth: 999 }, "HOURLY")).toBe(720_000);
  });
});

describe("formatCurrency", () => {
  it("formats whole IDR amounts with no decimal places", () => {
    const formatted = formatCurrency(1_000_000);
    expect(formatted).toContain("1.000.000");
    expect(formatted).not.toMatch(/[.,]\d{2}$/); // no cents-style suffix
  });

  it("respects a different currency code when given one", () => {
    const formatted = formatCurrency(100, "USD");
    expect(formatted).toContain("100");
  });
});

describe("chargeWallet", () => {
  it("debits the balance and records a negative-amount SUCCESS transaction", async () => {
    seedUser("u1", 10_000);

    const tx = await chargeWallet({ userId: "u1", amount: 3_000, description: "Usage charge" });

    expect(store.users.get("u1")!.balance).toBe(7_000);
    expect(tx.amount).toBe(-3_000);
    expect(tx.balanceAfter).toBe(7_000);
    expect(tx.status).toBe("SUCCESS");
    expect(tx.type).toBe("USAGE_CHARGE");
  });

  it("throws INSUFFICIENT_BALANCE and leaves the balance untouched when funds are short", async () => {
    seedUser("u1", 1_000);

    await expect(chargeWallet({ userId: "u1", amount: 3_000, description: "Usage charge" })).rejects.toThrow(
      "INSUFFICIENT_BALANCE"
    );

    // The guard must reject before any write happens — balance stays exactly as seeded.
    expect(store.users.get("u1")!.balance).toBe(1_000);
  });
});

describe("creditWallet", () => {
  it("credits the balance and records a positive-amount TOPUP transaction", async () => {
    seedUser("u1", 5_000);

    const tx = await creditWallet({
      userId: "u1",
      amount: 2_000,
      gateway: "MANUAL_TRANSFER",
      gatewayRef: "manual-1",
    });

    expect(store.users.get("u1")!.balance).toBe(7_000);
    expect(tx.amount).toBe(2_000);
    expect(tx.balanceAfter).toBe(7_000);
    expect(tx.type).toBe("TOPUP");
  });
});

describe("confirmTopUp", () => {
  it("confirms a PENDING top-up exactly once and credits the wallet", async () => {
    seedUser("u1", 0);
    const pending = seedTopUpTransaction({ userId: "u1", amount: 50_000 });

    const result = await confirmTopUp({ transactionId: pending.id, gateway: "XENDIT" });

    expect(result).toEqual({ status: "confirmed", balanceAfter: 50_000, amount: 50_000 });
    expect(store.users.get("u1")!.balance).toBe(50_000);
    expect(store.transactions.find((t) => t.id === pending.id)!.status).toBe("SUCCESS");
  });

  it("is a no-op the second time it's called for the same transaction (not a double credit)", async () => {
    seedUser("u1", 0);
    const pending = seedTopUpTransaction({ userId: "u1", amount: 50_000 });

    await confirmTopUp({ transactionId: pending.id, gateway: "XENDIT" });
    const second = await confirmTopUp({ transactionId: pending.id, gateway: "XENDIT" });

    expect(second).toEqual({ status: "already_processed" });
    expect(store.users.get("u1")!.balance).toBe(50_000); // not 100,000
  });

  it("only credits once when two confirmations race for the same transaction", async () => {
    // Regression test for the exact bug class this function was built to
    // close: a duplicated webhook delivery or a double-tapped "Pay" button
    // arriving as two near-simultaneous confirmations for the same
    // transaction must never result in two credits.
    seedUser("u1", 0);
    const pending = seedTopUpTransaction({ userId: "u1", amount: 20_000 });

    const [a, b] = await Promise.all([
      confirmTopUp({ transactionId: pending.id, gateway: "XENDIT" }),
      confirmTopUp({ transactionId: pending.id, gateway: "XENDIT" }),
    ]);

    const statuses = [a.status, b.status].sort();
    expect(statuses).toEqual(["already_processed", "confirmed"]);
    expect(store.users.get("u1")!.balance).toBe(20_000); // not 40,000
  });

  it("never uses a caller-supplied amount — only what's stored on the transaction", async () => {
    seedUser("u1", 0);
    // Seed a PENDING transaction for 10,000. confirmTopUp's signature
    // doesn't even accept an amount parameter — this test documents that
    // constraint and guards against it being reintroduced later.
    const pending = seedTopUpTransaction({ userId: "u1", amount: 10_000 });

    const result = await confirmTopUp({ transactionId: pending.id, gateway: "XENDIT" });

    expect(result.status).toBe("confirmed");
    if (result.status === "confirmed") {
      expect(result.amount).toBe(10_000);
    }
    expect(store.users.get("u1")!.balance).toBe(10_000);
  });

  it("returns forbidden and makes no changes when expectedUserId doesn't match the transaction's owner", async () => {
    seedUser("u1", 0);
    seedUser("attacker", 0);
    const pending = seedTopUpTransaction({ userId: "u1", amount: 50_000 });

    const result = await confirmTopUp({
      transactionId: pending.id,
      gateway: "XENDIT",
      expectedUserId: "attacker",
    });

    expect(result).toEqual({ status: "forbidden" });
    expect(store.users.get("u1")!.balance).toBe(0);
    expect(store.users.get("attacker")!.balance).toBe(0);
  });

  it("returns not_found for a nonexistent transaction id", async () => {
    const result = await confirmTopUp({ transactionId: "does-not-exist", gateway: "XENDIT" });
    expect(result).toEqual({ status: "not_found" });
  });

  it("returns not_found for a transaction that isn't a TOPUP (can't be abused to re-credit a usage charge)", async () => {
    seedUser("u1", 5_000);
    const usageCharge = seedTopUpTransaction({
      userId: "u1",
      amount: 3_000,
      type: "USAGE_CHARGE",
      status: "SUCCESS",
    });

    const result = await confirmTopUp({ transactionId: usageCharge.id, gateway: "XENDIT" });

    expect(result).toEqual({ status: "not_found" });
    expect(store.users.get("u1")!.balance).toBe(5_000);
  });
});
