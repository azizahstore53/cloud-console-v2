import { randomUUID } from "crypto";
import type {
  CloudProviderAdapter,
  InstanceMetrics,
  ProvisionInstanceParams,
  ProvisionInstanceResult,
  RemoteInstanceStatus,
  VncConsoleSession,
} from "../CloudProviderAdapter";

/**
 * In-memory mock backend. Simulates a hypervisor/cloud API so the entire
 * product (wizard, actions, dashboard) works without any real credentials.
 *
 * State lives in-process (resets on server restart) — fine for local dev
 * and demos. Swap CLOUD_PROVIDER env var to point at a real adapter later;
 * no other code needs to change.
 */

interface MockInstanceState {
  externalId: string;
  status: RemoteInstanceStatus;
  ipv4Address: string;
  ipv6Address: string;
}

const store = new Map<string, MockInstanceState>();

function randomIp(): string {
  return `10.${rand(0, 255)}.${rand(0, 255)}.${rand(2, 254)}`;
}
function rand(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/** Simulate provisioning finishing after a short delay by flipping state. */
function scheduleTransition(id: string, to: RemoteInstanceStatus, delayMs: number) {
  setTimeout(() => {
    const s = store.get(id);
    if (s) s.status = to;
  }, delayMs);
}

const AVAILABLE_IMAGES = [
  { slug: "ubuntu-22-04", label: "Ubuntu 22.04 LTS", family: "Ubuntu" },
  { slug: "ubuntu-24-04", label: "Ubuntu 24.04 LTS", family: "Ubuntu" },
  { slug: "debian-12", label: "Debian 12 (Bookworm)", family: "Debian" },
  { slug: "centos-9-stream", label: "CentOS Stream 9", family: "CentOS" },
  { slug: "almalinux-9", label: "AlmaLinux 9", family: "AlmaLinux" },
  { slug: "rocky-linux-9", label: "Rocky Linux 9", family: "Rocky Linux" },
  { slug: "windows-server-2022", label: "Windows Server 2022", family: "Windows" },
];

export class MockCloudProvider implements CloudProviderAdapter {
  readonly providerName = "mock";

  async createInstance(params: ProvisionInstanceParams): Promise<ProvisionInstanceResult> {
    const externalId = `mock-${randomUUID()}`;
    const state: MockInstanceState = {
      externalId,
      status: "PROVISIONING",
      ipv4Address: randomIp(),
      ipv6Address: `fd00::${rand(1000, 9999)}`,
    };
    store.set(externalId, state);

    // Simulate provisioning taking ~8s, then boot to RUNNING
    scheduleTransition(externalId, "RUNNING", 8000);

    return {
      externalId,
      status: state.status,
      ipv4Address: state.ipv4Address,
      ipv6Address: state.ipv6Address,
    };
  }

  async startInstance(externalId: string) {
    const s = this.require(externalId);
    s.status = "PROVISIONING";
    scheduleTransition(externalId, "RUNNING", 2000);
    return { status: s.status };
  }

  async stopInstance(externalId: string) {
    const s = this.require(externalId);
    s.status = "STOPPED";
    return { status: s.status };
  }

  async rebootInstance(externalId: string) {
    const s = this.require(externalId);
    s.status = "REBOOTING";
    scheduleTransition(externalId, "RUNNING", 3000);
    return { status: s.status };
  }

  async terminateInstance(externalId: string) {
    const s = this.require(externalId);
    s.status = "TERMINATING";
    scheduleTransition(externalId, "TERMINATED", 2000);
    return { status: s.status };
  }

  async getInstanceStatus(externalId: string) {
    const s = this.require(externalId);
    return { status: s.status };
  }

  async getInstanceMetrics(externalId: string): Promise<InstanceMetrics> {
    this.require(externalId);
    return {
      cpuUsagePercent: rand(2, 85),
      ramUsagePercent: rand(10, 90),
      diskUsagePercent: rand(5, 70),
      networkInMbps: rand(0, 50) / 10,
      networkOutMbps: rand(0, 50) / 10,
    };
  }

  async getVncConsole(externalId: string): Promise<VncConsoleSession> {
    this.require(externalId);
    return {
      url: `wss://mock-console.local/vnc/${externalId}?token=${randomUUID()}`,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000),
    };
  }

  async listImages() {
    return AVAILABLE_IMAGES;
  }

  private require(externalId: string): MockInstanceState {
    const s = store.get(externalId);
    if (!s) {
      // Self-heal for dev convenience (e.g. after a server restart wiped memory)
      const healed: MockInstanceState = {
        externalId,
        status: "RUNNING",
        ipv4Address: randomIp(),
        ipv6Address: `fd00::${rand(1000, 9999)}`,
      };
      store.set(externalId, healed);
      return healed;
    }
    return s;
  }
}
