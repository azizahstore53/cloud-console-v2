# Deployment Guide - Cloud Console Production

This guide provides step-by-step instructions to deploy the Cloud Console platform to a production environment, specifically focusing on the API Server and the Background Worker system.

## 🏗️ 1. Server Architecture Overview

The system consists of two main components:
1.  **API Server**: Handles the Dashboard, User API, and Billing.
2.  **Background Worker**: Handles the heavy lifting of VPN provisioning and Cron jobs (Heartbeat, Invoicing).

---

## 🚀 2. API Server Setup (Main Node)

### A. Base OS & Dependencies
Install these on a clean Ubuntu 22.04 LTS server:

```bash
# Update System
sudo apt update && sudo apt upgrade -y

# Install Node.js 20 (LTS)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install Redis (Required for BullMQ/Queue)
sudo apt install -y redis-server
sudo systemctl enable redis-server
sudo systemctl start redis-server

# Install PostgreSQL
sudo apt install -y postgresql postgresql-contrib
# Note: Create your database and user as per your .env requirements
```

### B. Application Deployment
```bash
# Clone and Setup
git clone <your-repo-url> cloud-console
cd cloud-console
npm install
npm run build

# Configure Environment
cp .env.example .env
nano .env # Fill in DATABASE_URL, REDIS_HOST, DOIT_API_KEY, etc.
```

### C. Process Management with PM2
To ensure the API and Workers run forever and restart on crash:

```bash
# Install PM2 globally
sudo npm install pm2 -g

# 1. Start the Next.js API
pm2 start npm --name "cloud-console-api" -- start

# 2. Start the VPN Worker (Handles Provisioning)
# Ensure you use the compiled path (usually in .next or dist)
pm2 start dist/lib/queue/vpnWorker.ts --name "vpn-worker"

# 3. Start the Cron System (Heartbeat & Billing)
pm2 start dist/lib/cron/index.ts --name "vpn-cron"

# Save the process list to restart on reboot
pm2 save
pm2 startup
```

---

## 🌐 3. Networking & Security (Reverse Proxy)

### A. Install Nginx & SSL
```bash
sudo apt install -y nginx certbot python3-certbot-nginx

# Configure Nginx (Example)
# Edit /etc/nginx/sites-available/default 
# Proxy pass to http://localhost:3000

sudo systemctl restart nginx

# Generate SSL Certificate
sudo certbot --nginx -d yourdomain.com
```

---

## 🛰️ 4. VPN Gateway Setup (Node Setup)

Follow the specifications in `spec.md`:
1. Install **Ubuntu 22.04**.
2. Install dependencies: `sudo apt install -y curl wget git docker.io docker-compose wireguard`.
3. Harden SSH: **Disable Password Login** $\rightarrow$ Use SSH Keys only.
4. Open Firewall: **UDP Port 51820** (or your chosen port).
5. Connect the server via the Admin Panel $\rightarrow$ VPN Gateway Management.

---

## 🛠️ 5. Maintenance Commands

| Action | Command |
| :--- | :--- |
| Check Process Status | `pm2 status` |
| View Real-time Logs | `pm2 logs` |
| Restart API | `pm2 restart cloud-console-api` |
| Restart Worker | `pm2 restart vpn-worker` |
| Check Redis Status | `redis-cli ping` (Should return PONG) |
| Update Code | `git pull` $\rightarrow$ `npm install` $\rightarrow$ `npm run build` $\rightarrow$ `pm2 restart all` |

---

## 🚩 Final Pre-Flight Checklist
- [ ] `DATABASE_URL` is correct and accessible.
- [ ] `REDIS_HOST` is correct (usually `127.0.0.1`).
- [ ] `DOIT_WEBHOOK_SECRET` is set for payment validation.
- [ ] Firewall ports (80, 443, 51820) are open.
- [ ] SSH Keys are correctly added to the Admin Panel.
