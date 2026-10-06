/**
 * CloudProviderAdapter
 * ---------------------------------------------------------------------------
 * A clean, provider-agnostic contract for anything that can provision and
 * control compute instances. Implement this interface once per backend
 * (OpenStack, Proxmox, AWS EC2, DigitalOcean, ...) and the rest of the
 * application (API routes, server actions, UI) never needs to know which
 * concrete provider is running underneath.
 *
 * To add a new provider:
 *   1. Create `src/lib/cloud/providers/<Name>Provider.ts` implementing this
 *      interface.
 *   2. Register it in `ProviderFactory.ts`.
 *   3. Set CLOUD_PROVIDER=<name> in .env
 *
 * No other file in the codebase should import a concrete provider directly —
 * always go through `getCloudProvider()` from ProviderFactory.
 */

export interface ProvisionInstanceParams {
  name: string;
  hostname?: string;
  imageSlug: string; // e.g. "ubuntu-22-04"
  regionCode: string; // e.g. "id-jkt-1"
  vcpu: number;
  ramMb: number;
  storageGb: number;
  sshPublicKey?: string;
}

export interface ProvisionInstanceResult {
  externalId: string; // ID on the underlying provider/hypervisor
  status: RemoteInstanceStatus;
  ipv4Address?: string;
  ipv6Address?: string;
  /**
   * Provider-specific extras that don't fit the common shape — e.g. an
   * auto-generated initial root/admin password that must be shown to the
   * user once and never persisted in plaintext. Callers should check for
   * known keys defensively; this is intentionally loose since it varies
   * per provider.
   */
  metadata?: Record<string, unknown>;
}

export type RemoteInstanceStatus =
  | "PROVISIONING"
  | "RUNNING"
  | "STOPPED"
  | "REBOOTING"
  | "TERMINATING"
  | "TERMINATED"
  | "ERROR";

export interface InstanceMetrics {
  cpuUsagePercent: number;
  ramUsagePercent: number;
  diskUsagePercent: number;
  networkInMbps: number;
  networkOutMbps: number;
}

export interface VncConsoleSession {
  url: string; // websocket/URL to embed in a VNC client
  expiresAt: Date;
}

/**
 * Thrown by an adapter method when the underlying provider's API has no
 * equivalent capability (e.g. IDCloudHost's public API has no VNC console
 * or live resource-metrics endpoint at the time this was written). Callers
 * should catch this specifically and degrade the UI gracefully — showing
 * "not available on this provider" — rather than treating it as a hard
 * failure or silently fabricating data.
 */
export class UnsupportedByProviderError extends Error {
  constructor(providerName: string, capability: string) {
    super(`${capability} is not supported by the "${providerName}" cloud provider.`);
    this.name = "UnsupportedByProviderError";
  }
}

export interface CloudProviderAdapter {
  /** Human-readable identifier, e.g. "mock", "openstack", "proxmox", "aws" */
  readonly providerName: string;

  /** Provision a new compute instance. Should be idempotent-safe to retry. */
  createInstance(params: ProvisionInstanceParams): Promise<ProvisionInstanceResult>;

  /** Start a stopped instance. */
  startInstance(externalId: string): Promise<{ status: RemoteInstanceStatus }>;

  /** Gracefully stop a running instance. */
  stopInstance(externalId: string): Promise<{ status: RemoteInstanceStatus }>;

  /** Reboot a running instance. */
  rebootInstance(externalId: string): Promise<{ status: RemoteInstanceStatus }>;

  /** Permanently destroy an instance and release its resources. */
  terminateInstance(externalId: string): Promise<{ status: RemoteInstanceStatus }>;

  /** Poll current status directly from the provider (source of truth). */
  getInstanceStatus(externalId: string): Promise<{ status: RemoteInstanceStatus }>;

  /**
   * Fetch lightweight point-in-time resource metrics for dashboards/graphs.
   * @throws {UnsupportedByProviderError} if the backend has no metrics API.
   */
  getInstanceMetrics(externalId: string): Promise<InstanceMetrics>;

  /**
   * Request a short-lived VNC/console session.
   * @throws {UnsupportedByProviderError} if the backend has no console API
   * (the person may still be able to use the provider's own web console).
   */
  getVncConsole(externalId: string): Promise<VncConsoleSession>;

  /** List available OS images/templates for the instance creation wizard. */
  listImages(): Promise<{ slug: string; label: string; family: string }[]>;
}
