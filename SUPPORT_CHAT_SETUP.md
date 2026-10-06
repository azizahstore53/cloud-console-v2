# Setup: Chat Support (Customer ↔ Support)

## 1. Extract
Timpa isi zip ini ke folder project kamu — semua path relatif, aman ditimpa
(tidak ada file yang menghapus fitur lain).

## 2. Migration
```
npm run db:migrate
```
Menambah tabel `support_tickets` dan `ticket_messages`, plus dua kolom
relasi baru di `users` dan `instances`. Tidak mengubah data yang sudah ada.

## 3. Tidak perlu env baru
Fitur ini murni internal — tidak ada API key/kredensial tambahan.

## Cara kerjanya

**Model status**, satu aturan di `src/lib/support/ticketService.ts`, dipakai
oleh API pelanggan maupun staff supaya keduanya tidak pernah berbeda logika:
- Pelanggan menulis → status `OPEN` (giliran staff membalas), tiket yang
  tadinya `RESOLVED` otomatis terbuka lagi.
- Staff menulis → status `PENDING` (giliran pelanggan), `customerUnread`
  jadi `true` untuk badge.
- Staff pertama yang membalas otomatis "mengklaim" tiket yang belum
  ditangani; staff lain yang ikut membalas tidak merebut klaim itu.

**Keamanan yang sudah saya terapkan:**
- Setiap query di sisi pelanggan selalu ikut memfilter `customerId` —
  pelanggan tidak bisa membuka/membalas tiket orang lain walau tahu ID-nya
  (saya tes ini secara terpisah, lihat catatan di bawah).
- Isi pesan dirender sebagai teks biasa (`whitespace-pre-wrap`), bukan HTML
  — tidak ada risiko XSS dari isi chat.
- Ada rate limiter terpisah untuk buat tiket (10/jam) dan kirim pesan
  (20/menit), pakai `createRateLimiter` yang sama seperti fitur lain.
- Panel info pelanggan di sisi staff sengaja tidak menampilkan saldo/wallet
  — role SUPPORT tidak punya izin `billing.manage`, jadi datanya memang
  tidak diambil sama sekali, bukan cuma disembunyikan di tampilan.
- Kalau pelanggan memilih "instance terkait" saat bikin tiket, servernya
  tetap memverifikasi instance itu benar milik dia — ID instance orang lain
  yang dikirim manual lewat request akan ditolak (404), bukan diam-diam
  diterima seperti bug IDOR yang pernah saya temukan di fitur App Deploy dulu.

**Permission baru:** `tickets.manage`, dimiliki SUPER_ADMIN, ADMIN, dan
SUPPORT (lihat tabel di `src/lib/permissions.ts`). Tab "Support" di Admin
Panel otomatis cuma muncul untuk role yang punya izin ini — role BILLING
atau DEVELOPER tidak akan melihatnya sama sekali.

**Verifikasi yang sudah saya lakukan** (di luar sekadar baca kode):
- Schema Prisma tervalidasi dengan validator resmi Prisma (bukan cuma saya
  baca manual) — dijamin tidak ada relasi yang salah/patah.
- Semua file baru lolos type-check TypeScript penuh.
- Logika inti (OPEN/PENDING, auto-assign, unread flag, dan pengecekan
  kepemilikan tiket) saya jalankan lewat 9 skenario test terpisah — semua
  lolos, termasuk skenario "customer lain coba akses tiket yang bukan
  miliknya" yang harus ditolak.
- **Belum saya jalankan** end-to-end di Next.js sungguhan (butuh database +
  browser) — jadi tetap coba dulu di lokal sebelum dipakai pelanggan asli.

## Cara pakai
- Pelanggan: menu **Support** di sidebar → **Tiket Baru**.
- Kalau mau ada tombol "Butuh bantuan" di halaman detail VPS, tinggal
  tambah link `<Link href={`/support/new?instanceId=${instance.id}`}>` di
  halaman `compute/[id]/page.tsx` — servernya sudah otomatis
  memvalidasi/mengisi instance itu di form (lihat poin keamanan di atas).
- Staff (SUPER_ADMIN/ADMIN/SUPPORT): Admin Panel → tab **Support**.

## Lanjutan yang belum dikerjakan (sesuai urutan yang saya usulkan sebelumnya)
1. ~~MVP tiket~~ ← ini
2. Notifikasi tiket baru/balasan ke Telegram staff, dan email cadangan
   kalau pelanggan offline (infrastruktur bot Telegram & SMTP kamu sudah
   ada, tinggal disambungkan)
3. Draf balasan dibantu Groq AI (staff yang tetap mengirim, bukan AI
   otomatis — sama seperti aturan main fitur Berita)
4. Lampiran gambar, balasan template, catatan internal, rating kepuasan
