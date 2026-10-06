import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  // ---------------------------------------------------------------------
  // Regions
  // ---------------------------------------------------------------------
  const regions = await Promise.all(
    [
      { code: "id-jkt-1", name: "Jakarta 1", country: "Indonesia" },
      { code: "id-jkt-2", name: "Jakarta 2", country: "Indonesia" },
      { code: "id-sby-1", name: "Surabaya 1", country: "Indonesia" },
      { code: "sg-sg-1", name: "Singapore 1", country: "Singapore" },
    ].map((r) =>
      prisma.region.upsert({ where: { code: r.code }, update: {}, create: r })
    )
  );

  // ---------------------------------------------------------------------
  // Instance Plans (prices in IDR, smallest unit = whole Rupiah)
  // ---------------------------------------------------------------------
  const planDefs = [
    { name: "Nano-1", vcpu: 1, ramMb: 1024, storageGb: 25, pricePerHour: 150, pricePerMonth: 75000 },
    { name: "Small-2", vcpu: 2, ramMb: 2048, storageGb: 40, pricePerHour: 300, pricePerMonth: 150000 },
    { name: "Standard-2", vcpu: 2, ramMb: 4096, storageGb: 80, pricePerHour: 550, pricePerMonth: 275000 },
    { name: "Standard-4", vcpu: 4, ramMb: 8192, storageGb: 160, pricePerHour: 1100, pricePerMonth: 550000 },
    { name: "Performance-8", vcpu: 8, ramMb: 16384, storageGb: 320, pricePerHour: 2200, pricePerMonth: 1100000 },
  ];
  const plans = [];
  for (const p of planDefs) {
    const existing = await prisma.instancePlan.findFirst({ where: { name: p.name } });
    plans.push(
      existing
        ? await prisma.instancePlan.update({ where: { id: existing.id }, data: p })
        : await prisma.instancePlan.create({ data: p })
    );
  }

  // ---------------------------------------------------------------------
  // App Deployer Blueprints
  // ---------------------------------------------------------------------
  const blueprintDefs = [
    { type: "WORDPRESS" as const, name: "WordPress", description: "WordPress + MySQL + Nginx, ready in minutes.", iconSlug: "wordpress" },
    { type: "NODEJS" as const, name: "Node.js", description: "Node.js runtime with PM2 process manager pre-installed.", iconSlug: "nodejs" },
    { type: "DOCKER" as const, name: "Docker Container", description: "Bring your own Docker image and deploy instantly.", iconSlug: "docker" },
    { type: "POSTGRESQL" as const, name: "Managed PostgreSQL", description: "PostgreSQL 16 with automated daily backups.", iconSlug: "postgresql" },
    { type: "MYSQL" as const, name: "Managed MySQL", description: "MySQL 8 with automated daily backups.", iconSlug: "mysql" },
    { type: "REDIS" as const, name: "Redis Cache", description: "In-memory Redis 7 instance for caching & queues.", iconSlug: "redis" },
  ];
  for (const b of blueprintDefs) {
    const existing = await prisma.blueprint.findFirst({ where: { name: b.name } });
    if (existing) {
      await prisma.blueprint.update({ where: { id: existing.id }, data: b });
    } else {
      await prisma.blueprint.create({ data: b });
    }
  }

  // ---------------------------------------------------------------------
  // Demo users
  // ---------------------------------------------------------------------
  const adminPasswordHash = await bcrypt.hash("Admin12345!", 12);
  const admin = await prisma.user.upsert({
    where: { email: "admin@cloudconsole.dev" },
    update: {},
    create: {
      email: "admin@cloudconsole.dev",
      name: "Platform Admin",
      passwordHash: adminPasswordHash,
      role: "ADMIN",
      balance: 5_000_000,
      emailVerified: new Date(),
    },
  });

  const userPasswordHash = await bcrypt.hash("User12345!", 12);
  const demoUser = await prisma.user.upsert({
    where: { email: "demo@cloudconsole.dev" },
    update: {},
    create: {
      email: "demo@cloudconsole.dev",
      name: "Demo User",
      passwordHash: userPasswordHash,
      role: "USER",
      balance: 500_000,
      emailVerified: new Date(),
    },
  });

  // Seed one sample running instance for the demo user so the dashboard isn't empty.
  const existingDemoInstance = await prisma.instance.findFirst({ where: { userId: demoUser.id } });
  if (!existingDemoInstance) {
    await prisma.instance.create({
      data: {
        userId: demoUser.id,
        name: "demo-web-server",
        status: "RUNNING",
        provider: "mock",
        externalId: `mock-seed-${demoUser.id}`,
        imageSlug: "ubuntu-22-04",
        imageLabel: "Ubuntu 22.04 LTS",
        regionId: regions[0].id,
        planId: plans[1].id,
        ipv4Address: "10.42.13.7",
        ipv6Address: "fd00::1a2b",
        billingCycle: "HOURLY",
        provisionedAt: new Date(),
        lastBilledAt: new Date(),
      },
    });

    await prisma.activityLog.create({
      data: {
        userId: demoUser.id,
        category: "INSTANCE",
        action: "instance.create",
        message: 'Instance "demo-web-server" provisioned',
      },
    });
  }

  console.log("Seed complete.");
  console.log("----------------------------------------------------");
  console.log("Admin login:  admin@cloudconsole.dev / Admin12345!");
  console.log("Demo user:    demo@cloudconsole.dev / User12345!");
  console.log("----------------------------------------------------");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
