/**
 * Menyamakan kolom publicKey (dan port) di tabel VpnServer dengan kunci publik
 * WireGuard server yang sebenarnya. Konfigurasi klien dibentuk dari kolom ini,
 * jadi kalau salah, handshake WireGuard tidak akan pernah berhasil.
 *
 * Simpan sebagai: scripts/fix-vpn-server-key.ts
 *
 * Pemakaian (dari root proyek):
 *   npx tsx scripts/fix-vpn-server-key.ts <KUNCI_PUBLIK_SERVER> [IP_PUBLIK_SERVER] [PORT]
 *
 * Contoh:
 *   npx tsx scripts/fix-vpn-server-key.ts AIP8jErkwGoi03KEOPCNtWdmmQjzmjD6T3qwyKzPnEQ= 103.59.94.110 51820
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const [newKey, serverIp = "103.59.94.110", portArg = "51820"] = process.argv.slice(2);

  if (!newKey) {
    console.error("Pemakaian: npx tsx scripts/fix-vpn-server-key.ts <KUNCI_PUBLIK_SERVER> [IP_PUBLIK] [PORT]");
    process.exit(1);
  }
  if (!/^[A-Za-z0-9+/]{43}=$/.test(newKey)) {
    console.error("Format kunci publik tidak valid (harus 44 karakter base64 berakhiran '=').");
    process.exit(1);
  }
  const port = Number(portArg);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    console.error("Port tidak valid.");
    process.exit(1);
  }

  const servers = await prisma.vpnServer.findMany({ where: { publicIp: serverIp } });

  if (servers.length === 0) {
    const all = await prisma.vpnServer.findMany({ select: { id: true, publicIp: true } });
    console.error(`Tidak ada VpnServer dengan publicIp ${serverIp}. Yang ada:`, all);
    process.exit(1);
  }

  for (const s of servers) {
    console.log(`\nServer ${s.id} (${s.publicIp})`);
    console.log(`  publicKey di DB : ${s.publicKey}`);
    console.log(`  publicKey asli  : ${newKey}`);
    console.log(`  hasil           : ${s.publicKey === newKey ? "SAMA" : "BEDA -> diperbarui"}`);
    console.log(`  wireguardPort   : ${s.wireguardPort} -> ${port}`);

    await prisma.vpnServer.update({
      where: { id: s.id },
      data: { publicKey: newKey, wireguardPort: port },
    });
  }

  console.log("\nSelesai. Ambil konfigurasi klien yang baru (GET /api/vpn atau tombol unduh),");
  console.log("impor ulang di aplikasi WireGuard, lalu matikan dan nyalakan tunnel.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
