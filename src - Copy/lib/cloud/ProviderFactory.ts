import type { CloudProviderAdapter } from "./CloudProviderAdapter";
import { MockCloudProvider } from "./providers/MockCloudProvider";
import { IDCloudHostProvider } from "./providers/IDCloudHostProvider";

// -----------------------------------------------------------------------------
// Register additional providers here as they're implemented:
//
//   import { OpenStackProvider } from "./providers/OpenStackProvider";
//   import { ProxmoxProvider } from "./providers/ProxmoxProvider";
//   import { AwsEc2Provider } from "./providers/AwsEc2Provider";
//
// then add a case below. Nothing else in the app needs to change.
// -----------------------------------------------------------------------------

let cached: CloudProviderAdapter | null = null;

export function getCloudProvider(): CloudProviderAdapter {
  if (cached) return cached;

  const providerKey = process.env.CLOUD_PROVIDER ?? "mock";

  switch (providerKey) {
    case "mock":
      cached = new MockCloudProvider();
      break;

    case "idcloudhost":
      cached = new IDCloudHostProvider({
        apiKey: process.env.IDCLOUDHOST_API_KEY ?? "",
        location: process.env.IDCLOUDHOST_LOCATION || undefined,
        billingAccountId: process.env.IDCLOUDHOST_BILLING_ACCOUNT_ID || undefined,
        designatedPoolUuid: process.env.IDCLOUDHOST_DESIGNATED_POOL_UUID || undefined,
        networkUuid: process.env.IDCLOUDHOST_NETWORK_UUID || undefined,
      });
      break;

    // case "openstack":
    //   cached = new OpenStackProvider({
    //     authUrl: process.env.OPENSTACK_AUTH_URL!,
    //     username: process.env.OPENSTACK_USERNAME!,
    //     password: process.env.OPENSTACK_PASSWORD!,
    //     projectId: process.env.OPENSTACK_PROJECT_ID!,
    //   });
    //   break;

    // case "proxmox":
    //   cached = new ProxmoxProvider({
    //     apiUrl: process.env.PROXMOX_API_URL!,
    //     apiToken: process.env.PROXMOX_API_TOKEN!,
    //   });
    //   break;

    // case "aws":
    //   cached = new AwsEc2Provider({
    //     region: process.env.AWS_REGION!,
    //   });
    //   break;

    default:
      throw new Error(
        `Unknown CLOUD_PROVIDER "${providerKey}". Register it in ProviderFactory.ts.`
      );
  }

  return cached;
}
