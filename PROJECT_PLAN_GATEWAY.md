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
- [x] VPN Provisioning System (WireGuard).
- [x] Multi-Port Forwarding (Public $\rightarrow$ Local).
- [x] QR Code Config Generator.
- [x] Billing Audit Trail (Balance Tracking).
- [x] Automated Health Check & Admin Notifications.
- [x] Input Validation (Zod) & API Rate Limiting.
- [x] Professional PDF Invoice Generation.
- [x] Enterprise Landing Page (DevCloudhost).

### Phase 2: Growth & Scaling (Current Focus)
- [ ] **Traffic Analytics:** Dashboard visual penggunaan bandwidth (Real-time/Harian).
- [ ] **Recurring Billing:** Sistem langganan otomatis (Monthly/Yearly) vs Top-up manual.
- [ ] **Static IP Management:** UI untuk manajemen dan penguncian IP Publik tetap bagi klien premium.
- [ ] **Simple Connectivity Dashboard:** Halaman status tunnel khusus untuk user (SLA Monitoring).

### Phase 3: Enterprise & Reliability
- [ ] **High Availability (Failover):** Implementasi dual-tunnel untuk redundancy (Automatic failover).
- [ ] **SSL/TLS Termination:** Integrasi Reverse Proxy untuk dukungan domain kustom dan HTTPS.
- [ ] **Bandwidth Management:** Limitasi kecepatan (QoS) per tunnel untuk stabilitas gateway.
- [ ] **Advanced Firewall:** Fitur IP Whitelisting untuk membatasi siapa yang bisa akses port publik.

### Phase 4: Ecosystem & Monetization
- [ ] **B2B Contract Billing:** Sistem penagihan berbasis kontrak tahunan dengan invoice otomatis.
- [ ] **SLA Reporting:** Laporan uptime bulanan otomatis untuk klien korporat.
- [ ] **Managed Setup Module:** Tools untuk membantu konfigurasi remote server klien secara semi-otomatis.

## 🛠 Technical Architecture
- **Core:** WireGuard (Fast, Modern, & Secure).
- **Orchestration:** Next.js + Prisma + PostgreSQL.
- **Gateway:** Linux VPS with optimized IP tables for DNAT.
- **Security:** End-to-end encryption, RBAC, Zod Validation, and Rate Limiting.
