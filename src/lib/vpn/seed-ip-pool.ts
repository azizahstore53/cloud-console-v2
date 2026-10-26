import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // .1 dipakai gateway wg0, jadi mulai dari .2
  const ips = Array.from({ length: 253 }, (_, i) => ({
    ipAddress: `10.0.0.${i + 2}`,
    isUsed: false,
  }));

  const result = await prisma.vpnIpPool.createMany({ data: ips, skipDuplicates: true });
  console.log(`Ditambahkan ${result.count} IP internal`);
}

main().catch(console.error).finally(() => prisma.$disconnect());