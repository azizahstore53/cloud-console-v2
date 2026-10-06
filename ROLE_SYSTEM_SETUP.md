# Setup: 6-role system (Super Admin, Admin, Billing, Support, Developer, Customer)

## 1. Extract file-file di zip ini
Timpa ke folder project kamu, sesuai path relatifnya (termasuk folder migration baru).

## 2. Jalankan migration
```
npm run db:migrate
```
Migration ini SAYA TULIS TANGAN (bukan auto-generate Prisma) supaya user
`USER` lama yang sudah ada di database aman berubah nama jadi `CUSTOMER`
tanpa kehilangan data — pakai `ALTER TYPE ... RENAME VALUE`, bukan
drop-and-recreate.

## 3. WAJIB — jadikan akun kamu sendiri SUPER_ADMIN
Setelah migration jalan, semua akun yang tadinya `ADMIN` **tetap** `ADMIN`
(tidak otomatis naik jadi Super Admin — supaya tidak ada yang akses-nya
diam-diam melebar). Karena cuma SUPER_ADMIN yang bisa mengangkat SUPER_ADMIN
atau ADMIN baru, kamu perlu jalankan ini SEKALI secara manual (lewat
`npm run db:studio` atau psql langsung):

```sql
UPDATE users SET role = 'SUPER_ADMIN' WHERE email = 'emailmu@domain.com';
```

Tanpa langkah ini, tidak ada satu pun akun yang bisa mempromosikan akun lain
ke ADMIN/SUPER_ADMIN lewat UI (chicken-and-egg problem yang memang disengaja
demi keamanan).

## Cara kerja sistemnya

Satu file jadi sumber kebenaran tunggal: **`src/lib/permissions.ts`**.
- `STAFF_ROLES` — role mana saja yang boleh buka `/admin` sama sekali.
- `ROLE_PERMISSIONS` — permission apa yang dimiliki tiap role (`users.manage`,
  `billing.manage`, `instances.manage`, `catalog.manage`, `news.manage`).
- `canAssignRole(actor, target)` — aturan KHUSUS soal siapa boleh mengangkat
  siapa jadi apa (lebih ketat dari permission biasa):
  - **SUPER_ADMIN** bisa mengangkat siapa saja jadi apa saja.
  - **ADMIN** bisa mengangkat orang jadi BILLING/SUPPORT/DEVELOPER/CUSTOMER,
    tapi **tidak bisa** membuat ADMIN atau SUPER_ADMIN baru.
  - Role lain tidak bisa mengubah role siapa pun.

Setiap route API di `/api/admin/*` sekarang pakai
`requirePermission("billing.manage")` dkk (bukan `requireAdmin()` binari
lama) — jadi kalau nanti kamu mau ubah siapa boleh apa, cukup edit
`ROLE_PERMISSIONS` di satu file itu, tidak perlu sentuh belasan route satu-satu.

Tab di Admin Panel (Users/Billing/Instances/Plans/dst) otomatis
sembunyi/muncul sesuai permission viewer — misal akun **SUPPORT** yang login
hanya akan melihat tab **Overview**, **Instances**, dan **Activity**; tab
**Billing**/**Users** tidak akan muncul sama sekali untuknya.

## Batasan yang perlu kamu tahu (belum saya kerjakan, di luar scope kali ini)
- Halaman admin (bukan API-nya) belum di-redirect otomatis kalau staff
  membuka URL yang bukan haknya secara langsung (mis. Support ketik manual
  `/admin/billing` di address bar) — API-nya tetap aman (403), tapi
  tampilannya cuma jadi kosong/error, bukan redirect rapi ke `/admin`. Kalau
  mau saya rapikan juga, tinggal bilang.
- Ditemukan (bukan dibuat) 2 route billing yang tumpang tindih:
  `/api/admin/billing/run-cycle` (pakai `usageBillingJob.ts`) dan
  `/api/admin/billing/run` (pakai `billingEngine.ts`) — dua implementasi
  berbeda untuk hal yang kelihatannya sama. Saya cuma perbaiki permission
  guard-nya, tidak saya gabungkan/hapus salah satunya karena itu di luar
  yang diminta — worth dicek mana yang sebenarnya dipakai UI kamu sekarang.
