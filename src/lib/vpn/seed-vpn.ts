import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const vpnServerData = {
    name: "Main VPN Gateway",
    publicIp: "103.59.94.110",
    wireguardPort: 51820,
    privateKey: "QOaRhaeKUhE/u5HVkBpP3pMXA960KdT6f/vZdctnmVQ=",
    publicKey: "AIP8jErkwGoi03KEOPCNtWdmmQjzmjD6T3qwyKzPnEQ=",
    isActive: true,
  };

  console.log("Checking for existing VPN servers...");
  const existingServers = await prisma.vpnServer.findMany();

  if (existingServers.length > 0) {
    console.log(`Found ${existingServers.length} existing server(s). Updating the first one...`);
    await prisma.vpnServer.update({
      where: { id: existingServers[0].id },
      data: vpnServerData,
    });
    console.log("VPN Server updated successfully!");
  } else {
    console.log("No VPN servers found. Creating a new one...");
    await prisma.vpnServer.create({
      data: vpnServerData,
    });
    console.log("VPN Server created successfully!");
  }
}

main()
  .catch((e) => {
    console.error("Error seeding VPN server:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
