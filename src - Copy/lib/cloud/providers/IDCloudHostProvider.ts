import crypto from "crypto";
import {
  UnsupportedByProviderError,
  type CloudProviderAdapter,
  type InstanceMetrics,
  type ProvisionInstanceParams,
  type ProvisionInstanceResult,
  type RemoteInstanceStatus,
  type VncConsoleSession,
} from "../CloudProviderAdapter";

/**
 * IDCloudHostProvider
 * ---------------------------------------------------------------------------
 * Talks to IDCloudHost's public Cloud VPS API (https://api.idcloudhost.com).
 * Built against their published API reference (Introduction/Authentication/
 * VM/Locations/Parameters sections at https://api.idcloudhost.com/).
 *
 * IMPORTANT — please read before relying on this in production:
 *
 * This was written from IDCloudHost's API documentation, not verified against
 * a live account (this environment has no IDCloudHost credentials to test
 * with). Before going live:
 *
 *   1. Create a real VM through this adapter in a throwaway/dev billing
 *      account and confirm the request/response shapes below match reality
 *      — particularly the exact `status` strings the API returns (this
 *      implementation assumes "running" / "stopped"; intermediate states
 *      like a provisioning/installing phase are not documented and are
 *      mapped defensively to PROVISIONING as a fallback).
 *   2. Confirm whether "Start VM" / "Stop VM" return the updated VM status
 *      inline, or whether you need a follow-up "Get VM Info" call — this
 *      implementation does the latter defensively when the status isn't in
 *      the response.
 *   3. Two capabilities IDCloudHost's public API does **not** expose at the
 *      time of writing: live resource metrics (CPU/RAM/disk %) and a VNC/
 *      console session. Both throw `UnsupportedByProviderError` here so the
 *      UI can show "not available" instead of fabricating numbers. If
 *      IDCloudHost adds these later, implement them here without touching
 *      any caller.
 *   4. There is no dedicated "reboot" endpoint in their API — this adapter
 *      implements reboot as stop-then-start, which is not atomic and will
 *      briefly report STOPPED in between. A true in-place reboot (e.g. ACPI
 *      reset) isn't available via this API surface as documented.
 *
 * Required environment variables (see .env.example):
 *   IDCLOUDHOST_API_KEY            - API token from https://app.idcloudhost.com/
 *   IDCLOUDHOST_LOCATION            - optional location slug (e.g. "jkt01").
 *                                      Omit to use the account's default location.
 *   IDCLOUDHOST_BILLING_ACCOUNT_ID  - optional; required only if your API
 *                                      token isn't already restricted to one
 *                                      billing account.
 *   IDCLOUDHOST_DESIGNATED_POOL_UUID- optional; if unset, the default
 *                                      resource pool is auto-detected on
 *                                      first use.
 *   IDCLOUDHOST_NETWORK_UUID        - optional; omit to use the default
 *                                      private network.
 *
 * Region mapping: this app's `Region.code` (managed in Admin > Regions)
 * should be set to IDCloudHost's actual location slugs when this provider
 * is active — e.g. "jkt01", "jkt02", "jkt03", "sgp01" — not the placeholder
 * "id-jkt-1" style codes used by the mock provider's seed data.
 */

const API_BASE = "https://api.idcloudhost.com/v1";

interface IDCloudHostVmResponse {
  uuid: string;
  status?: string;
  private_ipv4?: string;
  public_ipv4?: string;
  public_ipv6?: string;
  errors?: Record<string, string>;
}

interface IDCloudHostConfig {
  apiKey: string;
  location?: string;
  billingAccountId?: string;
  designatedPoolUuid?: string;
  networkUuid?: string;
}

// Maps our internal image slugs (as used by the create-instance wizard) to
// IDCloudHost's os_name/os_version pair. Cross-check this against
// GET /v1/config/vm_images/plain_os for your account before relying on it —
// available OS versions change over time and may differ by location.
const IMAGE_SLUG_MAP: Record<string, { os_name: string; os_version: string; label: string; family: string }> = {
  "ubuntu-22-04": { os_name: "ubuntu", os_version: "22.04", label: "Ubuntu 22.04 LTS", family: "Ubuntu" },
  "ubuntu-24-04": { os_name: "ubuntu", os_version: "24.04", label: "Ubuntu 24.04 LTS", family: "Ubuntu" },
  "debian-12": { os_name: "debian", os_version: "12", label: "Debian 12 (Bookworm)", family: "Debian" },
  "almalinux-9": { os_name: "almalinux", os_version: "9", label: "AlmaLinux 9", family: "AlmaLinux" },
  "centos-9-stream": { os_name: "centos", os_version: "9", label: "CentOS Stream 9", family: "CentOS" },
};

function generateInitialPassword(): string {
  // Must satisfy IDCloudHost's documented VM password constraint:
  // ^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$  (lower + upper + digit, 8+ chars)
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghijkmnopqrstuvwxyz";
  const digits = "23456789";
  const all = upper + lower + digits;
  const pick = (set: string) => set[crypto.randomInt(set.length)];
  let pw = pick(upper) + pick(lower) + pick(digits);
  for (let i = 0; i < 13; i++) pw += pick(all);
  return pw
    .split("")
    .sort(() => crypto.randomInt(3) - 1)
    .join("");
}

function mapStatus(raw?: string): RemoteInstanceStatus {
  switch ((raw ?? "").toLowerCase()) {
    case "running":
      return "RUNNING";
    case "stopped":
      return "STOPPED";
    case "deleting":
      return "TERMINATING";
    case "deleted":
      return "TERMINATED";
    case "error":
      return "ERROR";
    default:
      // Covers undocumented transitional states (e.g. an install/build
      // phase) — treat unknown-but-present status as still provisioning
      // rather than guessing which terminal state it maps to.
      return "PROVISIONING";
  }
}

export class IDCloudHostProvider implements CloudProviderAdapter {
  readonly providerName = "idcloudhost";
  private config: IDCloudHostConfig;
  private cachedDefaultPoolUuid: string | null = null;

  constructor(config: IDCloudHostConfig) {
    if (!config.apiKey) {
      throw new Error("IDCloudHostProvider requires IDCLOUDHOST_API_KEY to be set.");
    }
    this.config = config;
  }

  private basePath(): string {
    return this.config.location ? `${API_BASE}/${this.config.location}` : API_BASE;
  }

  private async request<T>(
    path: string,
    init: { method: string; body?: URLSearchParams | string; json?: boolean } = { method: "GET" }
  ): Promise<T> {
    const headers: Record<string, string> = { apikey: this.config.apiKey };
    if (init.json) headers["Content-Type"] = "application/json";

    const res = await fetch(`${path}`, {
      method: init.method,
      headers,
      body: init.body,
    });

    const text = await res.text();
    const data = text ? JSON.parse(text) : {};

    if (!res.ok || data?.errors) {
      const message = data?.errors?.Error ?? data?.errors ?? `IDCloudHost API error (HTTP ${res.status})`;
      throw new Error(typeof message === "string" ? message : JSON.stringify(message));
    }

    return data as T;
  }

  private async getDefaultPoolUuid(): Promise<string | undefined> {
    if (this.config.designatedPoolUuid) return this.config.designatedPoolUuid;
    if (this.cachedDefaultPoolUuid) return this.cachedDefaultPoolUuid;

    const pools = await this.request<{ uuid: string; is_default_designated: boolean }[]>(
      `${this.basePath()}/user-resource/host_pool/list`
    );
    const preferred = pools.find((p) => p.is_default_designated) ?? pools[0];
    this.cachedDefaultPoolUuid = preferred?.uuid;
    return this.cachedDefaultPoolUuid ?? undefined;
  }

  async createInstance(params: ProvisionInstanceParams): Promise<ProvisionInstanceResult> {
    const image = IMAGE_SLUG_MAP[params.imageSlug];
    if (!image) {
      throw new Error(
        `Unrecognized image slug "${params.imageSlug}" for IDCloudHost. Add it to IMAGE_SLUG_MAP after ` +
          `checking GET /v1/config/vm_images/plain_os for the exact os_name/os_version pair.`
      );
    }

    const initialPassword = generateInitialPassword();
    const designatedPoolUuid = await this.getDefaultPoolUuid();

    const body = new URLSearchParams({
      name: params.name,
      os_name: image.os_name,
      os_version: image.os_version,
      disks: String(params.storageGb),
      vcpu: String(params.vcpu),
      ram: String(params.ramMb),
      username: "root",
      password: initialPassword,
    });
    if (designatedPoolUuid) body.set("designated_pool_uuid", designatedPoolUuid);
    if (this.config.billingAccountId) body.set("billing_account_id", this.config.billingAccountId);
    if (this.config.networkUuid) body.set("network_uuid", this.config.networkUuid);
    if (params.sshPublicKey) body.set("public_key", params.sshPublicKey);

    const vm = await this.request<IDCloudHostVmResponse>(`${this.basePath()}/user-resource/vm`, {
      method: "POST",
      body,
    });

    return {
      externalId: vm.uuid,
      status: mapStatus(vm.status),
      ipv4Address: vm.public_ipv4 || vm.private_ipv4,
      ipv6Address: vm.public_ipv6,
      metadata: {
        initialUsername: "root",
        initialPassword,
        note: "Save this password now — it is generated once and not retrievable later.",
      },
    };
  }

  async startInstance(externalId: string): Promise<{ status: RemoteInstanceStatus }> {
    const body = new URLSearchParams({ uuid: externalId });
    const vm = await this.request<IDCloudHostVmResponse>(`${this.basePath()}/user-resource/vm/start`, {
      method: "POST",
      body,
    });
    if (vm.status) return { status: mapStatus(vm.status) };
    return this.getInstanceStatus(externalId);
  }

  async stopInstance(externalId: string): Promise<{ status: RemoteInstanceStatus }> {
    const body = new URLSearchParams({ uuid: externalId });
    const vm = await this.request<IDCloudHostVmResponse>(`${this.basePath()}/user-resource/vm/stop`, {
      method: "POST",
      body,
    });
    if (vm.status) return { status: mapStatus(vm.status) };
    return this.getInstanceStatus(externalId);
  }

  async rebootInstance(externalId: string): Promise<{ status: RemoteInstanceStatus }> {
    // No native reboot endpoint is documented for this API — approximate it
    // with stop, then start. Not atomic: a status poll mid-sequence will
    // briefly observe STOPPED rather than a REBOOTING state.
    await this.stopInstance(externalId);
    return this.startInstance(externalId);
  }

  async terminateInstance(externalId: string): Promise<{ status: RemoteInstanceStatus }> {
    await this.request<IDCloudHostVmResponse>(`${this.basePath()}/user-resource/vm`, {
      method: "DELETE",
      body: new URLSearchParams({ uuid: externalId }),
    });
    return { status: "TERMINATED" };
  }

  async getInstanceStatus(externalId: string): Promise<{ status: RemoteInstanceStatus }> {
    const vm = await this.request<IDCloudHostVmResponse>(
      `${this.basePath()}/user-resource/vm?uuid=${encodeURIComponent(externalId)}`
    );
    return { status: mapStatus(vm.status) };
  }

  async getInstanceMetrics(_externalId: string): Promise<InstanceMetrics> {
    throw new UnsupportedByProviderError(this.providerName, "Live resource metrics");
  }

  async getVncConsole(_externalId: string): Promise<VncConsoleSession> {
    throw new UnsupportedByProviderError(
      this.providerName,
      "VNC console (use the IDCloudHost web console at console.idcloudhost.com instead)"
    );
  }

  async listImages() {
    const images = await this.request<
      { os_name: string; display_name: string; versions: { os_version: string; display_name: string; published: boolean }[] }[]
    >(`${API_BASE}/config/vm_images/plain_os`);

    return images.flatMap((img) =>
      img.versions
        .filter((v) => v.published)
        .map((v) => ({
          slug: `${img.os_name}-${v.os_version}`.replace(/\./g, "-"),
          label: `${img.display_name} ${v.display_name}`,
          family: img.display_name,
        }))
    );
  }
}
