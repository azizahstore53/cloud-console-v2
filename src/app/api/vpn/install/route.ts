import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token");

  if (!token) {
    return new NextResponse("Error: Token is required. Usage: curl -sSL https://your-domain.com/api/vpn/install?token=YOUR_TOKEN | bash", {
      status: 400,
      headers: { "Content-Type": "text/plain" }
    });
  }

  try {
    const client = await prisma.vpnClient.findFirst({
      where: {
        vpnInstallToken: token,
        status: "ACTIVE"
      },
      include: { vpnServer: true }
    });

    if (!client) {
      return new NextResponse("Error: Valid active VPN tunnel not found for this token.", {
        status: 404,
        headers: { "Content-Type": "text/plain" }
      });
    }

    // Use a simple approach to generate config for the script
    const config = `
[Interface]
PrivateKey = ${client.privateKey}
Address = ${client.internalIp}/24
DNS = 1.1.1.1

[Peer]
PublicKey = ${client.vpnServer.publicKey}
Endpoint = ${client.vpnServer.publicIp}:${client.vpnServer.wireguardPort}
AllowedIPs = 0.0.0.0/0
PersistentKeepalive = 25
    `.trim();

    const serverPublicIp = client.vpnServer.publicIp;

    const script = `#!/bin/bash
# WireGuard Auto-Installer for Cloud Console VPN

echo "Starting WireGuard installation..."

if ! command -v wg &> /dev/null; then
    echo "Installing wireguard-tools..."
    sudo apt-get update && sudo apt-get install -y wireguard
fi

echo "Configuring tunnel..."
cat <<EOF | sudo tee /etc/wireguard/wg0.conf
${config}
EOF

echo "Activating tunnel..."
sudo wg-quick up wg0

echo "Enabling on boot..."
sudo systemctl enable wg-quick@wg0

echo "--------------------------------------------------------"
echo "SUCCESS: Your local server is now connected to the VPS Gateway!"
echo "Your services are now accessible via your allocated Public IP."
echo "--------------------------------------------------------"
`;

    return new NextResponse(script, {
      status: 200,
      headers: { "Content-Type": "text/plain" }
    });

  } catch (error) {
    return new NextResponse("Error: An unexpected error occurred during installation.", {
      status: 500,
      headers: { "Content-Type": "text/plain" }
    });
  }
}
