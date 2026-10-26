-- AlterTable
ALTER TABLE "vpn_clients" ADD COLUMN     "localPort" INTEGER NOT NULL DEFAULT 80,
ADD COLUMN     "publicPort" INTEGER NOT NULL DEFAULT 80;

-- AlterTable
ALTER TABLE "vpn_servers" ADD COLUMN     "sshPassword" TEXT,
ADD COLUMN     "sshUser" TEXT NOT NULL DEFAULT 'root',
ALTER COLUMN "sshPrivateKey" DROP NOT NULL;
