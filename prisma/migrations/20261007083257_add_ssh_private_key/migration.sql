/*
  Warnings:

  - A unique constraint covering the columns `[vpnInstallToken]` on the table `vpn_clients` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `privateKey` to the `vpn_clients` table without a default value. This is not possible if the table is not empty.
  - Added the required column `sshPrivateKey` to the `vpn_servers` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "vpn_clients" ADD COLUMN     "privateKey" TEXT NOT NULL,
ADD COLUMN     "vpnInstallToken" TEXT;

-- AlterTable
ALTER TABLE "vpn_servers" ADD COLUMN     "sshPrivateKey" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "vpn_ip_pool" (
    "id" TEXT NOT NULL,
    "ipAddress" TEXT NOT NULL,
    "isUsed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vpn_ip_pool_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vpn_public_ip_pool" (
    "id" TEXT NOT NULL,
    "ipAddress" TEXT NOT NULL,
    "isUsed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vpn_public_ip_pool_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "vpn_ip_pool_ipAddress_key" ON "vpn_ip_pool"("ipAddress");

-- CreateIndex
CREATE UNIQUE INDEX "vpn_public_ip_pool_ipAddress_key" ON "vpn_public_ip_pool"("ipAddress");

-- CreateIndex
CREATE UNIQUE INDEX "vpn_clients_vpnInstallToken_key" ON "vpn_clients"("vpnInstallToken");
