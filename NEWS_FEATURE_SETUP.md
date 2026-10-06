# Setup fitur Berita (News + Telegram + Groq)

File di zip ini menimpa/menambah file di dalam project cloud-console kamu.
Extract dengan menimpa folder `src/`, `prisma/schema.prisma`, `.env.example`,
`tailwind.config.ts`, dan `package.json` di project asli.

## 1. Install dependency baru
```
npm install react-markdown @tailwindcss/typography
```
(`undici` juga ditambah sebelumnya untuk ProxmoxProvider — kalau belum ada: `npm install undici`)

## 2. Migrasi database
```
npm run db:migrate
```
Ini akan menambah tabel `news` dari model baru di schema.prisma.

## 3. Isi .env
Salin bagian baru di `.env.example` ke `.env` kamu:
```
TELEGRAM_BOT_TOKEN=          # dari @BotFather di Telegram
TELEGRAM_WEBHOOK_SECRET=     # generate sendiri: openssl rand -hex 32
TELEGRAM_ADMIN_CHAT_ID=      # chat_id Telegram kamu sendiri (lihat langkah 4)
GROQ_API_KEY=                # dari console.groq.com
GROQ_MODEL=llama-3.3-70b-versatile
```

## 4. Cari tahu TELEGRAM_ADMIN_CHAT_ID kamu
1. Buat bot dulu lewat @BotFather di Telegram, dapat token, isi ke `TELEGRAM_BOT_TOKEN`.
2. Kirim 1 pesan apa saja ke bot kamu itu.
3. Buka di browser: `https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/getUpdates`
4. Cari nilai `"chat":{"id": ...}` di response JSON-nya, itu chat_id kamu. Isi ke `TELEGRAM_ADMIN_CHAT_ID`.

## 5. Daftarkan webhook ke Telegram
Setelah app kamu online di domain publik (atau tunnel ngrok/Cloudflare Tunnel untuk testing lokal):
```
curl "https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/setWebhook" \
  -d "url=https://<domain-kamu>/api/telegram/webhook" \
  -d "secret_token=<isi sama persis dengan TELEGRAM_WEBHOOK_SECRET>"
```
Response harus `{"ok":true,"result":true,...}`.

## 6. Coba
Chat ke bot kamu di Telegram:
```
/berita VPS vs Shared Hosting, mana yang cocok untuk UMKM
```
Bot akan balas draft artikel + tombol "✅ Publish" / "🗑️ Buang". Tekan Publish,
lalu buka `https://<domain-kamu>/berita` — artikelnya harus muncul.

Bisa juga post manual tanpa AI lewat Admin Panel → tab **News**.
