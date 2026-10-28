import { Queue, Worker, Job } from 'bullmq';
import { redisConnection } from './redis';

export const VPN_QUEUE_NAME = 'vpn-provisioning';

export const vpnQueue = new Queue(VPN_QUEUE_NAME, {
  connection: redisConnection,
});

export interface VpnProvisioningJobData {
  userId: string;
  serverId: string;
  publicIp: string;
  internalIp: string;
  portMappings: { publicPort: number; localPort: number }[];
}

export async function addVpnProvisioningJob(data: VpnProvisioningJobData) {
  await vpnQueue.add('provision-vpn', data, {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
    removeOnComplete: true,
  });
}
