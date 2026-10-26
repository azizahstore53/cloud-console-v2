# 🛡️ VPN Gateway Setup Guide

This guide provides step-by-step instructions to prepare your VPS as a WireGuard Gateway for the Cloud Console platform.

## 📌 Prerequisites
- A VPS running **Ubuntu 22.04 LTS** or **Debian 11/12**.
- **Root SSH access** to the VPS.
- A Public IP address assigned to the VPS.
- Port `51820/udp` open in your VPS firewall/security group.

---

## 🚀 Option 1: One-Click Automated Setup (Recommended)

This is the fastest way to prepare your server. Run this script as **root**.

### 1.1 Create the Setup Script
Login to your VPS as root and create the script:
```bash
nano setup-vpn.sh
```

### 1.2 Paste this Code
Copy and paste the following code into the file:

```bash
#!/bin/bash
set -e

echo "🚀 Starting VPN Gateway Setup..."

# 1. Update & Install WireGuard
echo "📦 Installing WireGuard..."
apt-get update
apt-get install -y wireguard iptables curl

# 2. Enable IPv4 Forwarding
echo "🌐 Enabling IPv4 Forwarding..."
echo "net.ipv4.ip_forward=1" > /etc/sysctl.d/99-vpn-forwarding.conf
sysctl -p /etc/sysctl.d/99-vpn-forwarding.conf

# 3. Create Base WireGuard Directory
mkdir -p /etc/wireguard
chmod 700 /etc/wireguard

# 4. Setup Firewall
echo "🛡️ Opening WireGuard port (51820/udp)..."
ufw allow 51820/udp || iptables -A INPUT -p udp --dport 51820 -j ACCEPT

echo "----------------------------------------------------------------"
echo "✅ BASE SETUP COMPLETE!"
echo "Your server is now ready to be linked to the Cloud Console."
echo "Now, go to Admin Panel -> Setup Gateway to finalize the config."
echo "----------------------------------------------------------------"
```

### 1.3 Run the Script
```bash
chmod +x setup-vpn.sh
./setup-vpn.sh
```

---

## ⚙️ Step 2: Link VPS to Cloud Console

Now that the base tools are installed, let the Cloud Console automate the configuration and create the secure `serverwg` user.

1.  Login to your **Cloud Console Dashboard**.
2.  Navigate to **Admin Control Panel** $\rightarrow$ **Setup Gateway**.
3.  Fill in the details:
    - **VPS Public IP**: The IP of your VPS.
    - **SSH User**: `serverwg` (Default).
    - **SSH Private Key**: The private key that has root access to the VPS for setup.
    - **WireGuard Port**: `51820` (Default).
4.  Click **"Start Automated Setup"**.

### What happens automatically?
The system will now:
- Connect to your VPS via SSH.
- Generate server keys.
- Configure the `wg0` interface.
- **Create a limited user `serverwg`** and configure passwordless `sudo` permissions for WireGuard & iptables.
- Save the server details to the database.

---

## 🧪 Step 3: Verification




---

## 🛠️ Troubleshooting

| Issue | Solution |
| :--- | :--- |
| `Connection Timeout` | Check if port `51820/udp` is open in your VPS Cloud Firewall (AWS/GCP/DigitalOcean). |
| `Permission Denied` | Ensure the SSH Private Key provided has full root access to the VPS. |
| `Interface wg0 failed` | Run `systemctl status wg-quick@wg0` on the VPS to see the error logs. |
| `No Handshake` | Ensure the local client is using the correct Public Key of the gateway. |
