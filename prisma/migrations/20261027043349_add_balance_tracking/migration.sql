/*
  Warnings:

  - You are about to drop the column `localPort` on the `vpn_clients` table. All the data in the column will be lost.
  - You are about to drop the column `publicPort` on the `vpn_clients` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "transactions" ADD COLUMN     "balanceBefore" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "vpn_clients" DROP COLUMN "localPort",
DROP COLUMN "publicPort";

-- CreateTable
CREATE TABLE "vpn_port_mappings" (
    "id" TEXT NOT NULL,
    "vpnClientId" TEXT NOT NULL,
    "publicPort" INTEGER NOT NULL,
    "localPort" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vpn_port_mappings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "vpn_port_mappings_vpnClientId_publicPort_key" ON "vpn_port_mappings"("vpnClientId", "publicPort");

-- AddForeignKey
ALTER TABLE "vpn_port_mappings" ADD CONSTRAINT "vpn_port_mappings_vpnClientId_fkey" FOREIGN KEY ("vpnClientId") REFERENCES "vpn_clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
