# 🌐 Project Plan: Universal Secure Gateway
**Vision:** Menghilangkan hambatan infrastruktur jaringan dengan menyediakan akses publik aman dan instan bagi server internal (Localhost/Intranet) tanpa perlu IP Public dari ISP.

## 🎯 Target Market
- **Healthcare (RS/Klinik):** Integrasi SatuSehat/BPJS & online-kan SIMRS.
- **SMEs / UMKM:** Online-kan server database/stok dari kantor/rumah.
- **Developers:** Demo aplikasi ke klien atau testing webhook secara lokal.
- **Government/Corp:** Akses aman ke aplikasi internal tanpa VPN tradisional yang berat.

## 🚀 Feature Roadmap

### Phase 1: Foundation (The Basics) - [DONE]
- [x] RBAC & Security Guard.
- [x] VPN Provisioning System.
- [x] QR Code Config Generator.
- [x] Billing Audit Trail.
- [x] Automated Health Check.

### Phase 2: Flexibility & Scaling (Current Phase)
- [ ] **Multi-Port Forwarding:** Satu tunnel dapat meneruskan banyak port (contoh: 80, 443, 3306, 8080) ke berbagai server internal.
- [ ] **Static IP Allocation:** IP Publik tetap (Fixed IP) untuk kebutuhan whitelisting API/Integrasi.
- [ ] **Custom DNS/Domain Integration:** Menghubungkan IP Publik dengan domain kustom.
- [ ] **Simple Connectivity Dashboard:** Monitoring status tunnel secara real-time untuk pengguna.

### Phase 3: Enterprise & Reliability
- [ ] **High Availability (Failover):** Dual-tunnel redundancy untuk menjamin uptime 99.9%.
- [ ] **SSL/TLS Termination (Reverse Proxy):** Integrasi HTTPS agar akses lebih aman dan profesional.
- [ ] **Bandwidth Management:** Implementasi QoS (Quality of Service) dan limitasi bandwidth per user.
- [ ] **Advanced Firewall:** Kontrol akses IP (IP Whitelisting) untuk port yang dibuka.

### Phase 4: Ecosystem & Monetization
- [ ] **Flexible Billing Model:** Mendukung Top-up (Retail) dan Contract-Based (B2B/Enterprise).
- [ ] **SLA Monitoring:** Dashboard transparansi uptime untuk klien korporat.
- [ ] **Managed Setup Service:** Fitur bantuan konfigurasi otomatis untuk klien non-teknis.

## 🛠 Technical Architecture
- **Core:** WireGuard (Fast, Modern, & Secure).
- **Orchestration:** Next.js + Prisma + PostgreSQL.
- **Gateway:** Linux VPS with optimized IP tables for DNAT.
- **Security:** End-to-end encryption, RBAC, and SSH Key-based management.
