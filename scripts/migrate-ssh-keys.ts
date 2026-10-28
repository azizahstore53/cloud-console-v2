import { PrismaClient } from "@prisma/client";
import { EncryptionService } from "../src/lib/encryption.js";

const prisma = new PrismaClient();

async function migrateSshKeys() {
  console.log("🚀 Starting SSH Key Migration...");

  try {
    const servers = await prisma.vpnServer.findMany({
      where: {
        sshPrivateKey: { not: null },
      },
    });

    console.log(`Found ${servers.length} servers with SSH keys.`);
    let migratedCount = 0;
    let skippedCount = 0;

    for (const server of servers) {
      const key = server.sshPrivateKey!;

      // Check if the key is already encrypted.
      // Encrypted keys follow the format "iv:encrypted_data"
      // We check if it contains ':' and is long enough.
      if (key.includes(":") && key.length > 32) {
        console.log(`⏩ Skipping ${server.name} (${server.publicIp}) - already encrypted.`);
        skippedCount++;
        continue;
      }

      try {
        console.log(`🔐 Encrypting key for ${server.name} (${server.publicIp})...`);
        const encryptedKey = EncryptionService.encrypt(key);

        await prisma.vpnServer.update({
          where: { id: server.id },
          data: { sshPrivateKey: encryptedKey },
        });

        migratedCount++;
      } catch (err) {
        console.error(`❌ Failed to migrate ${server.name}:`, err);
      }
    }

    console.log("\n--- Migration Summary ---");
    console.log(`✅ Successfully migrated: ${migratedCount}`);
    console.log(`⏩ Already encrypted: ${skippedCount}`);
    console.log("--------------------------\n");
  } catch (error) {
    console.error("🚨 Critical migration error:", error);
  } finally {
    await prisma.$disconnect();
  }
}

migrateSshKeys();
