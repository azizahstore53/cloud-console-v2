import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log("Resetting all VPN IP pools to available...");

  try {
    // Reset Public IP Pool
    const publicReset = await prisma.vpnPublicIpPool.updateMany({
      data: { isUsed: false },
    });
    console.log(`✅ Reset ${publicReset.count} Public IPs to available.`);

    // Reset Internal IP Pool
    const internalReset = await prisma.vpnIpPool.updateMany({
      data: { isUsed: false },
    });
    console.log(`✅ Reset ${internalReset.count} Internal IPs to available.`);

    console.log("\nAll IP pools are now ready for use!");
  } catch (error) {
    console.error("Error resetting IP pools:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
