#!/bin/bash

# ==============================================================================
# WIREGUARD VPS AUTO-CONFIGURATION SCRIPT
# ------------------------------------------------------------------------------
# This script performs a full installation and configuration of WireGuard
# on Ubuntu/Debian servers to act as a VPN Gateway.
#
# Features:
# 1. Install WireGuard
# 2. Configure IPv4 Forwarding (Kernel level)
# 3. Set up iptables MASQUERADE for traffic routing
# 4. Generate Server Keys
# 5. Create a limited 'vpn-manager' user for the Cloud Console API
# 6. Configure Sudoers for seamless automation
# ==============================================================================

set -e

# --- Configuration ---
WG_PORT=51820
WG_INTERFACE="wg0"
WG_ADDRESS="10.0.0.1/24"
VPN_USER="serverwg"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${GREEN}Starting WireGuard Gateway Setup...${NC}"

# 1. Update & Install WireGuard
echo -e "${YELLOW}[1/6] Installing WireGuard...${NC}"
apt-get update -y
apt-get install -y wireguard iptables curl

# 2. Enable IPv4 Forwarding
echo -e "${YELLOW}[2/6] Configuring IPv4 Forwarding...${NC}"
echo "net.ipv4.ip_forward=1" > /etc/sysctl.d/99-wireguard.conf
sysctl -p /etc/sysctl.d/99-wireguard.conf

# 3. Network Interface & Firewall Setup
echo -e "${YELLOW}[3/6] Configuring iptables MASQUERADE...${NC}"
# Get default interface name (eth0, ens3, etc)
IFACE=$(ip route get 8.8.8.8 | awk '{print $5; exit}')

# Add rules to iptables
iptables -A FORWARD -i $WG_INTERFACE -j ACCEPT
iptables -A FORWARD -o $WG_INTERFACE -j ACCEPT
iptables -t nat -A POSTROUTING -o $IFACE -j MASQUERADE

# Make iptables rules persistent
apt-get install -y iptables-persistent
iptables-save > /etc/iptables/rules.v4

# 4. Generate Server Keys
echo -e "${YELLOW}[4/6] Generating WireGuard Keys...${NC}"
mkdir -p /etc/wireguard
chmod 700 /etc/wireguard
cd /etc/wireguard

umask 077
wg genkey | tee privatekey | wg pubkey > publickey

# 5. Create vpn-manager user
echo -e "${YELLOW}[5/6] Setting up vpn-manager user...${NC}"
if id "$VPN_USER" &>/dev/null; then
    echo "User $VPN_USER already exists."
else
    useradd -m -s /bin/bash $VPN_USER
    echo "Created user $VPN_USER"
fi

# 6. Configure Sudoers for serverwg
echo -e "${YELLOW}[6/6] Configuring Sudo permissions...${NC}"
echo "$VPN_USER ALL=(ALL) NOPASSWD: /usr/bin/wg, /usr/sbin/iptables, /sbin/iptables, /usr/sbin/wg, /usr/bin/systemctl" > /etc/sudoers.d/$VPN_USER
chmod 440 /etc/sudoers.d/$VPN_USER

# Finalize WireGuard Config
cat <<EOF > /etc/wireguard/wg0.conf
[Interface]
Address = $WG_ADDRESS
ListenPort = $WG_PORT
PrivateKey = $(cat /etc/wireguard/privatekey)
PostUp = iptables -A FORWARD -i $WG_INTERFACE -j ACCEPT; iptables -t nat -A POSTROUTING -o $IFACE -j MASQUERADE
PostDown = iptables -D FORWARD -i $WG_INTERFACE -j ACCEPT; iptables -t nat -D POSTROUTING -o $IFACE -j MASQUERADE
EOF

# Start WireGuard
systemctl enable wg-quick@wg0
systemctl start wg-quick@wg0

echo -e "${GREEN}======================================================${NC}"
echo -e "${GREEN}SUCCESS: VPS is now a configured WireGuard Gateway!${NC}"
echo -e "Server Public Key: $(cat /etc/wireguard/publickey)"
echo -e "WireGuard Port: $WG_PORT"
echo -e "Management User: $VPN_USER"
echo -e "${GREEN}======================================================${NC}"
