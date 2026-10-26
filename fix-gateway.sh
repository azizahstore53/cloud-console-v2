#!/usr/bin/env bash
# =====================================================================
# fix-gateway.sh — perbaikan gateway WireGuard (jalankan sebagai root)
#
# Yang dilakukan:
#   1. Backup konfigurasi, daftar peer aktif, dan aturan iptables
#   2. Aktifkan IP forwarding secara permanen
#   3. Izinkan UDP 51820 di UFW
#   4. Pasang aturan iptables (FORWARD, MASQUERADE, DNAT) lewat file aturan
#      yang idempotent, lalu hubungkan ke wg0.conf (PostUp) agar tetap ada
#      setelah reboot
#   5. Hapus aturan lama yang tidak pernah cocok (memakai -d IP publik)
#   6. Tampilkan status dan kunci publik server untuk dicocokkan dengan DB
#
# Pemakaian:  sudo bash fix-gateway.sh
# Aman dijalankan berulang. TIDAK me-restart wg0, jadi peer tidak hilang.
# Setelah `ufw reload`, jalankan ulang script ini (atau: bash /etc/wireguard/vpn-rules.sh).
# =====================================================================
set -euo pipefail

# ---------- KONFIGURASI: sesuaikan dengan server Anda ----------
WAN_IFACE="ens3"              # interface yang menerima trafik dari internet
WG_IFACE="wg0"
WG_SUBNET="10.0.0.0/24"
WG_PORT="51820"
PUBLIC_IP="103.59.94.110"     # hanya dipakai untuk membersihkan aturan lama
CLIENT_IP="10.0.0.8"          # IP internal klien VPN tujuan port forwarding
PORTS="80 8080"               # port TCP yang diteruskan ke CLIENT_IP
# ---------------------------------------------------------------

WG_CONF="/etc/wireguard/${WG_IFACE}.conf"
RULES_FILE="/etc/wireguard/vpn-rules.sh"
STAMP="$(date +%Y%m%d-%H%M%S)"

log()  { printf '\n\033[1;34m==> %s\033[0m\n' "$*"; }
ok()   { printf '    \033[32m[OK]\033[0m %s\n' "$*"; }
warn() { printf '    \033[33m[!]\033[0m %s\n' "$*"; }

[ "$(id -u)" -eq 0 ] || { echo "Jalankan sebagai root: sudo bash $0"; exit 1; }
command -v wg >/dev/null       || { echo "Perintah 'wg' tidak ditemukan"; exit 1; }
ip link show "$WAN_IFACE" >/dev/null 2>&1 || { echo "Interface $WAN_IFACE tidak ada"; exit 1; }
ip link show "$WG_IFACE"  >/dev/null 2>&1 || { echo "Interface $WG_IFACE tidak aktif"; exit 1; }

umask 077

# ---------------------------------------------------------------------
log "1/6 Backup"
wg showconf "$WG_IFACE" > "/root/wg-live-${STAMP}.conf"
ok "peer aktif disimpan di /root/wg-live-${STAMP}.conf"
iptables-save > "/root/iptables-${STAMP}.rules"
ok "aturan iptables disimpan di /root/iptables-${STAMP}.rules"
if [ -f "$WG_CONF" ]; then
  cp -a "$WG_CONF" "${WG_CONF}.bak-${STAMP}"
  ok "${WG_CONF} dibackup ke ${WG_CONF}.bak-${STAMP}"
fi

# ---------------------------------------------------------------------
log "2/6 IP forwarding"
echo "net.ipv4.ip_forward=1" > /etc/sysctl.d/99-wg-forward.conf
sysctl -q -p /etc/sysctl.d/99-wg-forward.conf
if [ -f /etc/ufw/sysctl.conf ] && grep -qE '^\s*#?\s*net/ipv4/ip_forward' /etc/ufw/sysctl.conf; then
  # UFW menimpa sysctl saat reload; samakan nilainya
  sed -i -E 's|^\s*#?\s*net/ipv4/ip_forward=.*|net/ipv4/ip_forward=1|' /etc/ufw/sysctl.conf
fi
ok "net.ipv4.ip_forward = $(cat /proc/sys/net/ipv4/ip_forward)"

# ---------------------------------------------------------------------
log "3/6 UFW"
if command -v ufw >/dev/null 2>&1 && ufw status | grep -q "Status: active"; then
  ufw allow "${WG_PORT}/udp" >/dev/null
  ok "UDP ${WG_PORT} diizinkan"
else
  warn "UFW tidak aktif atau tidak terpasang, langkah ini dilewati"
fi

# ---------------------------------------------------------------------
log "4/6 File aturan iptables: ${RULES_FILE}"
cat > "$RULES_FILE" <<VARS
#!/usr/bin/env bash
# Dikelola oleh fix-gateway.sh. Idempotent: aman dijalankan berulang.
WAN_IFACE="${WAN_IFACE}"
WG_IFACE="${WG_IFACE}"
WG_SUBNET="${WG_SUBNET}"
CLIENT_IP="${CLIENT_IP}"
PORTS="${PORTS}"
VARS
cat >> "$RULES_FILE" <<'BODY'
set -u

# ensure_append <tabel> <chain> <spesifikasi...>  -> tambah di bawah bila belum ada
ensure_append() {
  local table="$1"; shift
  iptables -t "$table" -C "$@" 2>/dev/null || iptables -t "$table" -A "$@"
}
# ensure_top <tabel> <chain> <spesifikasi...>     -> sisipkan paling atas bila belum ada
ensure_top() {
  local table="$1" chain="$2"; shift 2
  iptables -t "$table" -C "$chain" "$@" 2>/dev/null || iptables -t "$table" -I "$chain" 1 "$@"
}

# Izinkan semua koneksi yang sudah di-DNAT (dan balasannya) melewati FORWARD.
# Harus di paling atas supaya tidak didahului chain ufw-*.
ensure_top filter FORWARD -m conntrack --ctstate DNAT -j ACCEPT
ensure_top filter FORWARD -o "$WG_IFACE" -m conntrack --ctstate RELATED,ESTABLISHED -j ACCEPT

# Klien VPN keluar ke internet lewat gateway
ensure_append nat POSTROUTING -s "$WG_SUBNET" -o "$WAN_IFACE" -j MASQUERADE

# Port forwarding: dicocokkan lewat interface WAN, bukan IP publik
# (IP publik di-NAT oleh penyedia, jadi tidak terpasang di server).
for p in $PORTS; do
  ensure_append nat PREROUTING -i "$WAN_IFACE" -p tcp --dport "$p" \
    -j DNAT --to-destination "$CLIENT_IP:$p"
done
BODY
chmod 700 "$RULES_FILE"
ok "file aturan dibuat"

if [ -f "$WG_CONF" ]; then
  if ! grep -qF "$RULES_FILE" "$WG_CONF"; then
    sed -i "0,/^\[Interface\]/s||[Interface]\nPostUp = ${RULES_FILE}|" "$WG_CONF"
    ok "PostUp ditambahkan ke ${WG_CONF}"
  else
    ok "PostUp sudah ada di ${WG_CONF}"
  fi
  # Peer yang ditambahkan lewat `wg set` hilang saat wg0 di-restart/reboot,
  # kecuali SaveConfig aktif (wg-quick menyimpannya ke file saat `down`).
  if grep -qiE '^\s*SaveConfig' "$WG_CONF"; then
    sed -i -E 's|^\s*SaveConfig.*|SaveConfig = true|I' "$WG_CONF"
  else
    sed -i "0,/^\[Interface\]/s||[Interface]\nSaveConfig = true|" "$WG_CONF"
  fi
  ok "SaveConfig = true"
else
  warn "${WG_CONF} tidak ditemukan; aturan tidak akan otomatis aktif setelah reboot"
fi

bash "$RULES_FILE"
ok "aturan diterapkan sekarang"

# ---------------------------------------------------------------------
log "5/6 Bersihkan aturan lama yang tidak pernah cocok"
for p in $PORTS; do
  while iptables -t nat -D PREROUTING -d "$PUBLIC_IP" -p tcp --dport "$p" \
        -j DNAT --to-destination "${CLIENT_IP}:${p}" 2>/dev/null; do :; done
done
while iptables -D FORWARD -d "${CLIENT_IP}/32" -p tcp -m tcp --dport 8080 -j ACCEPT 2>/dev/null; do :; done
ok "aturan lama dibersihkan (jika ada)"

# ---------------------------------------------------------------------
log "6/6 Status"
echo "--- wg show ---"
wg show "$WG_IFACE"
echo
echo "--- nat PREROUTING ---"
iptables -t nat -L PREROUTING -n -v --line-numbers
echo
echo "--- FORWARD (teratas) ---"
iptables -L FORWARD -n -v --line-numbers | head -8

SERVER_PUB="$(wg show "$WG_IFACE" public-key)"
echo
echo "Kunci publik server (harus SAMA dengan kolom publicKey di tabel VpnServer):"
echo "    ${SERVER_PUB}"

echo
if wg show "$WG_IFACE" latest-handshakes | awk '{ if ($2 > 0) f = 1 } END { exit !f }'; then
  ok "ada peer dengan handshake"
  if ping -c1 -W2 "$CLIENT_IP" >/dev/null 2>&1; then
    ok "ping ke ${CLIENT_IP} berhasil"
  else
    warn "ping ke ${CLIENT_IP} gagal (Windows memblokir ICMP itu normal; uji dengan curl)"
  fi
else
  warn "BELUM ada handshake. Langkah berikutnya, di Windows (folder proyek):"
  echo "    npx tsx scripts/fix-vpn-server-key.ts ${SERVER_PUB} ${PUBLIC_IP} ${WG_PORT}"
  echo "    lalu ambil konfigurasi baru dan impor ulang di aplikasi WireGuard."
fi
