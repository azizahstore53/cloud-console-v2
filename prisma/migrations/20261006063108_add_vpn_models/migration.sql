-- CreateEnum
CREATE TYPE "VpnStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'EXPIRED', 'SUSPENDED');

-- CreateTable
CREATE TABLE "vpn_servers" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "publicIp" TEXT NOT NULL,
    "wireguardPort" INTEGER NOT NULL DEFAULT 51820,
    "privateKey" TEXT NOT NULL,
    "publicKey" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vpn_servers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vpn_clients" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "vpnServerId" TEXT NOT NULL,
    "publicKey" TEXT NOT NULL,
    "internalIp" TEXT NOT NULL,
    "allocatedPublicIp" TEXT,
    "status" "VpnStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vpn_clients_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "vpn_servers_publicIp_key" ON "vpn_servers"("publicIp");

-- CreateIndex
CREATE UNIQUE INDEX "vpn_servers_publicKey_key" ON "vpn_servers"("publicKey");

-- CreateIndex
CREATE UNIQUE INDEX "vpn_clients_publicKey_key" ON "vpn_clients"("publicKey");

-- CreateIndex
CREATE UNIQUE INDEX "vpn_clients_internalIp_key" ON "vpn_clients"("internalIp");

-- CreateIndex
CREATE UNIQUE INDEX "vpn_clients_allocatedPublicIp_key" ON "vpn_clients"("allocatedPublicIp");

-- CreateIndex
CREATE INDEX "vpn_clients_userId_idx" ON "vpn_clients"("userId");

-- CreateIndex
CREATE INDEX "vpn_clients_vpnServerId_idx" ON "vpn_clients"("vpnServerId");

-- AddForeignKey
ALTER TABLE "vpn_clients" ADD CONSTRAINT "vpn_clients_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vpn_clients" ADD CONSTRAINT "vpn_clients_vpnServerId_fkey" FOREIGN KEY ("vpnServerId") REFERENCES "vpn_servers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
