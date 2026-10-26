#!/usr/bin/env bash
# =====================================================================
# forward-all-ports.sh — teruskan SEMUA port TCP/UDP dari internet ke
# klien VPN. Port yang benar-benar terbuka di komputer klien otomatis
# bisa diakses lewat IP publik.
#
# Pengaman bawaan (bisa diubah di bagian KONFIGURASI):
#   - Port milik gateway sendiri (SSH 22, WireGuard 51820, dan semua port
#     yang sedang didengarkan gateway) TIDAK diteruskan, supaya Anda tidak
#     terkunci dari server.
#   - Port berisiko (SMB, RDP, database) diblokir dari internet.
#
# Menggantikan fix-gateway.sh. Aman dijalankan berulang (idempotent) dan
# aman jika fix-gateway.sh sudah pernah dijalankan.
# Tidak me-restart wg0, jadi peer yang aktif tidak hilang.
#
# Pemakaian:  sudo bash forward-all-ports.sh
# =====================================================================
set -euo pipefail

# ---------- KONFIGURASI: sesuaikan dengan server Anda ----------
WAN_IFACE="ens3"
WG_IFACE="wg0"
WG_SUBNET="10.0.0.0/24"
WG_PORT="51820"
PUBLIC_IP="103.59.94.110"      # hanya untuk membersihkan aturan lama
CLIENT_IP="10.0.0.8"           # IP internal klien tujuan
CLIENT_PUBKEY="STdOACDGUhUclLWMOASmm4oQCQJVG9FYeP8t2HSRNws="  # kosongkan jika tidak mau script memasang ulang peer
PROTOS="tcp udp"               # protokol yang diteruskan
EXTRA_KEEP_TCP="22"            # port TCP gateway yang TIDAK diteruskan (selain yang terdeteksi otomatis)
EXTRA_KEEP_UDP=""              # port UDP gateway tambahan (WG_PORT selalu dikecualikan)
BLOCK_TCP="135 139 445 3389 5985 5986 3306 5432 1433 6379 27017"   # kosongkan ("") untuk tidak memblokir apa pun
BLOCK_UDP="137 138"
APPLY_CLIENT_DNAT="yes"        # "no" jika DNAT per klien sudah dibuat oleh aplikasi
OLD_PORTS="80 8080"            # aturan per-port versi lama yang dibersihkan
# ---------------------------------------------------------------

WG_CONF="/etc/wireguard/${WG_IFACE}.conf"
RULES_FILE="/etc/wireguard/vpn-rules.sh"
STAMP="$(date +%Y%m%d-%H%M%S)"

log()  { printf '\n\033[1;34m==> %s\033[0m\n' "$*"; }
ok()   { printf '    \033[32m[OK]\033[0m %s\n' "$*"; }
warn() { printf '    \033[33m[!]\033[0m %s\n' "$*"; }

[ "$(id -u)" -eq 0 ] || { echo "Jalankan sebagai root: sudo bash $0"; exit 1; }
command -v wg >/dev/null || { echo "Perintah 'wg' tidak ditemukan"; exit 1; }
ip link show "$WAN_IFACE" >/dev/null 2>&1 || { echo "Interface $WAN_IFACE tidak ada"; exit 1; }
ip link show "$WG_IFACE"  >/dev/null 2>&1 || { echo "Interface $WG_IFACE tidak aktif"; exit 1; }

umask 077

# Port yang didengarkan gateway di interface non-loopback ($1 = tcp | udp)
detect_listen() {
  local flag="-Hltn"
  [ "$1" = "udp" ] && flag="-Hlun"
  ss $flag 2>/dev/null | awk '{print $4}' \
    | grep -vE '^(127\.|\[?::1\]?:)' \
    | sed -E 's/.*:([0-9]+)$/\1/' | grep -E '^[0-9]+$' | sort -un | tr '\n' ' ' || true
}

# ---------------------------------------------------------------------
log "1/7 Backup"
wg showconf "$WG_IFACE" > "/root/wg-live-${STAMP}.conf"
iptables-save > "/root/iptables-${STAMP}.rules"
ok "peer aktif   : /root/wg-live-${STAMP}.conf"
ok "iptables     : /root/iptables-${STAMP}.rules"
if [ -f "$WG_CONF" ]; then
  cp -a "$WG_CONF" "${WG_CONF}.bak-${STAMP}"
  ok "wg0.conf     : ${WG_CONF}.bak-${STAMP}"
fi

# ---------------------------------------------------------------------
log "2/7 IP forwarding"
echo "net.ipv4.ip_forward=1" > /etc/sysctl.d/99-wg-forward.conf
sysctl -q -p /etc/sysctl.d/99-wg-forward.conf
if [ -f /etc/ufw/sysctl.conf ] && grep -qE '^\s*#?\s*net/ipv4/ip_forward' /etc/ufw/sysctl.conf; then
  sed -i -E 's|^\s*#?\s*net/ipv4/ip_forward=.*|net/ipv4/ip_forward=1|' /etc/ufw/sysctl.conf
fi
ok "net.ipv4.ip_forward = $(cat /proc/sys/net/ipv4/ip_forward)"

# ---------------------------------------------------------------------
log "3/7 UFW"
if command -v ufw >/dev/null 2>&1 && ufw status | grep -q "Status: active"; then
  ufw allow "${WG_PORT}/udp" >/dev/null
  ok "UDP ${WG_PORT} diizinkan"
else
  warn "UFW tidak aktif atau tidak terpasang, dilewati"
fi

# ---------------------------------------------------------------------
log "4/7 Port gateway yang dikecualikan dari forwarding"
EXCLUDE_TCP="$(printf '%s\n' $(detect_listen tcp) $EXTRA_KEEP_TCP | sort -un | tr '\n' ' ')"
EXCLUDE_UDP="$(printf '%s\n' $(detect_listen udp) $EXTRA_KEEP_UDP "$WG_PORT" | sort -un | tr '\n' ' ')"
case " $EXCLUDE_TCP " in *" 22 "*) ;; *) EXCLUDE_TCP="22 $EXCLUDE_TCP" ;; esac
ok "TCP tidak diteruskan: ${EXCLUDE_TCP}"
ok "UDP tidak diteruskan: ${EXCLUDE_UDP}"
warn "Jika SSH server Anda memakai port selain 22, pastikan port itu ada di daftar TCP di atas."

# ---------------------------------------------------------------------
log "5/7 File aturan: ${RULES_FILE}"
cat > "$RULES_FILE" <<VARS
#!/usr/bin/env bash
# Dikelola oleh forward-all-ports.sh. Idempotent.
WAN_IFACE="${WAN_IFACE}"
WG_IFACE="${WG_IFACE}"
WG_SUBNET="${WG_SUBNET}"
CLIENT_IP="${CLIENT_IP}"
PROTOS="${PROTOS}"
EXCLUDE_TCP="${EXCLUDE_TCP}"
EXCLUDE_UDP="${EXCLUDE_UDP}"
BLOCK_TCP="${BLOCK_TCP}"
BLOCK_UDP="${BLOCK_UDP}"
APPLY_CLIENT_DNAT="${APPLY_CLIENT_DNAT}"
VARS
cat >> "$RULES_FILE" <<'BODY'
set -u

# ensure_append <tabel> <chain> <spek...> : tambah di bawah bila belum ada
ensure_append() {
  local table="$1"; shift
  iptables -t "$table" -C "$@" 2>/dev/null || iptables -t "$table" -A "$@"
}
# ensure_top <tabel> <chain> <spek...> : sisipkan paling atas bila belum ada
ensure_top() {
  local table="$1" chain="$2"; shift 2
  iptables -t "$table" -C "$chain" "$@" 2>/dev/null || iptables -t "$table" -I "$chain" 1 "$@"
}
# "1 2 3" -> "1,2,3"
csv() { echo "$*" | tr -s ' ' '\n' | sed '/^$/d' | paste -sd, -; }

# 1) FORWARD: izinkan koneksi hasil DNAT dan balasannya.
#    Dipasang PERTAMA; aturan DROP di bawah disisipkan setelahnya sehingga
#    berada DI ATAS aturan ACCEPT ini.
ensure_top filter FORWARD -m conntrack --ctstate DNAT -j ACCEPT
ensure_top filter FORWARD -o "$WG_IFACE" -m conntrack --ctstate RELATED,ESTABLISHED -j ACCEPT

# 2) FORWARD: blokir port berisiko dari internet ke klien VPN
if [ -n "$BLOCK_TCP" ]; then
  ensure_top filter FORWARD -i "$WAN_IFACE" -o "$WG_IFACE" -p tcp -m multiport --dports "$(csv $BLOCK_TCP)" -j DROP
fi
if [ -n "$BLOCK_UDP" ]; then
  ensure_top filter FORWARD -i "$WAN_IFACE" -o "$WG_IFACE" -p udp -m multiport --dports "$(csv $BLOCK_UDP)" -j DROP
fi

# 3) Klien VPN keluar ke internet lewat gateway
ensure_append nat POSTROUTING -s "$WG_SUBNET" -o "$WAN_IFACE" -j MASQUERADE

# 4) Layanan milik gateway sendiri tidak diteruskan (RETURN = proses normal di gateway)
for p in $EXCLUDE_TCP; do
  ensure_top nat PREROUTING -i "$WAN_IFACE" -p tcp --dport "$p" -j RETURN
done
for p in $EXCLUDE_UDP; do
  ensure_top nat PREROUTING -i "$WAN_IFACE" -p udp --dport "$p" -j RETURN
done

# 5) Teruskan SEMUA port lainnya ke klien (port tujuan tetap sama)
if [ "$APPLY_CLIENT_DNAT" = "yes" ]; then
  for proto in $PROTOS; do
    ensure_append nat PREROUTING -i "$WAN_IFACE" -p "$proto" -j DNAT --to-destination "$CLIENT_IP"
  done
fi
BODY
chmod 700 "$RULES_FILE"
ok "file aturan dibuat"

# Hubungkan ke wg0.conf agar aktif lagi setelah wg0 naik / reboot
if [ -f "$WG_CONF" ]; then
  if ! grep -qF "$RULES_FILE" "$WG_CONF"; then
    sed -i "0,/^\[Interface\]/s||[Interface]\nPostUp = ${RULES_FILE}|" "$WG_CONF"
    ok "PostUp ditambahkan ke ${WG_CONF}"
  else
    ok "PostUp sudah ada di ${WG_CONF}"
  fi
  if grep -qiE '^\s*SaveConfig' "$WG_CONF"; then
    sed -i -E 's|^\s*SaveConfig.*|SaveConfig = true|I' "$WG_CONF"
  else
    sed -i "0,/^\[Interface\]/s||[Interface]\nSaveConfig = true|" "$WG_CONF"
  fi
  ok "SaveConfig = true"
  if [ -n "$CLIENT_PUBKEY" ] && ! grep -qF "$CLIENT_PUBKEY" "$WG_CONF"; then
    printf '\n[Peer]\nPublicKey = %s\nAllowedIPs = %s/32\n' "$CLIENT_PUBKEY" "$CLIENT_IP" >> "$WG_CONF"
    ok "peer klien disimpan di ${WG_CONF} (tidak hilang saat restart)"
  fi
else
  warn "${WG_CONF} tidak ditemukan; aturan tidak otomatis aktif setelah reboot"
fi

# Pasang ulang peer yang hilang dari kondisi berjalan
if [ -n "$CLIENT_PUBKEY" ]; then
  if ! wg show "$WG_IFACE" peers | grep -qxF "$CLIENT_PUBKEY"; then
    wg set "$WG_IFACE" peer "$CLIENT_PUBKEY" allowed-ips "${CLIENT_IP}/32"
    ok "peer klien dipasang kembali"
  fi
fi

# ---------------------------------------------------------------------
log "6/7 Bersihkan aturan lama + terapkan aturan baru"
for p in $OLD_PORTS; do
  while iptables -t nat -D PREROUTING -i "$WAN_IFACE" -p tcp --dport "$p" \
        -j DNAT --to-destination "${CLIENT_IP}:${p}" 2>/dev/null; do :; done
  while iptables -t nat -D PREROUTING -d "$PUBLIC_IP" -p tcp --dport "$p" \
        -j DNAT --to-destination "${CLIENT_IP}:${p}" 2>/dev/null; do :; done
done
while iptables -D FORWARD -d "${CLIENT_IP}/32" -p tcp -m tcp --dport 8080 -j ACCEPT 2>/dev/null; do :; done
ok "aturan per-port lama dibersihkan (jika ada)"
bash "$RULES_FILE"
ok "aturan baru diterapkan"

# ---------------------------------------------------------------------
log "7/7 Status"
echo "--- wg show ---"
wg show "$WG_IFACE"
echo
echo "--- nat PREROUTING ---"
iptables -t nat -L PREROUTING -n -v --line-numbers
echo
echo "--- FORWARD (teratas) ---"
iptables -L FORWARD -n -v --line-numbers | head -10
echo
echo "RINGKASAN"
echo "  Diteruskan ke ${CLIENT_IP}: SEMUA port ${PROTOS}"
echo "  Kecuali (tetap di gateway): TCP ${EXCLUDE_TCP}| UDP ${EXCLUDE_UDP}"
echo "  Diblokir dari internet    : TCP ${BLOCK_TCP:-"-"} | UDP ${BLOCK_UDP:-"-"}"
echo
if wg show "$WG_IFACE" latest-handshakes | awk '{ if ($2 > 0) f = 1 } END { exit !f }'; then
  ok "ada peer dengan handshake"
else
  warn "BELUM ada handshake: aktifkan tunnel di Windows, lalu cek lagi dengan: wg show"
fi
