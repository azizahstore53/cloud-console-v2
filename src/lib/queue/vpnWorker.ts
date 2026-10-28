import { Worker } from 'bullmq';
import { redisConnection, VPN_QUEUE_NAME } from './redis';
import { VpnProvisioningJobData } from './vpnQueue';
import { vpnService } from '@/lib/vpn/vpnService';
import { prisma } from '@/lib/prisma';

export const vpnWorker = new Worker(
  VPN_QUEUE_NAME,
  async (job) => {
    const { userId, serverId, publicIp, internalIp, portMappings } = job.data as VpnProvisioningJobData;

    console.log(`[VPN Worker] Processing provisioning for user ${userId} on server ${serverId}`);

    try {
      // We call a specialized internal method to do the actual SSH work
      // This method should be added to vpnService
      await vpnService.processProvisioning({
        userId,
        serverId,
        publicIp,
        internalIp,
        portMappings,
      });

      console.log(`[VPN Worker] Successfully provisioned VPN for user ${userId}`);
    } catch (error: any) {
      console.error(`[VPN Worker] Provisioning failed for user ${userId}:`, error);

      // Update status to FAILED in DB
      await prisma.vpnClient.updateMany({
        where: {
          userId,
          internalIp
        },
        data: { status: 'FAILED' }
      });

      throw error; // BullMQ will handle retry based on config
    }
  },
  { connection: redisConnection }
);
