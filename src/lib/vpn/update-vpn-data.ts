import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

async function main() {
  try {
    // Read SSH Private Key from the project root
    const sshKeyPath = path.join(process.cwd(), 'id_rsa');
    const sshPrivateKey = fs.readFileSync(sshKeyPath, 'utf8');

    const vpnServerData = {
      name: "Main VPN Gateway",
      publicIp: "103.59.94.110",
      wireguardPort: 51820,
      privateKey: "QOaRhaeKUhE/u5HVkBpP3pMXA960KdT6f/vZdctnmVQ=",
      publicKey: "AIP8jErkwGoi03KEOPCNtWdmmQjzmjD6T3qwyKzPnEQ=",
      sshPrivateKey: sshPrivateKey,
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
      console.log("VPN Server updated successfully with SSH Key!");
    } else {
      console.log("No VPN servers found. Creating a new one...");
      await prisma.vpnServer.create({
        data: vpnServerData,
      });
      console.log("VPN Server created successfully with SSH Key!");
    }
  } catch (error) {
    console.error("Error seeding VPN server:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
